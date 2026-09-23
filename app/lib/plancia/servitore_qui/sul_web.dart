/// Il servitore, nel browser.
///
/// Sul telefono la plancia arriva da un server vero che l'app apre su
/// `127.0.0.1`. In un browser un server non si puo' aprire, ed e' la sola
/// ragione per cui la versione web diceva «la plancia si vede sul telefono».
///
/// Un **service worker** fa la stessa cosa da dentro: si mette in mezzo alle
/// richieste di `dashboardmodern_static/` e di `api/` e risponde lui. I file
/// non ce li ha: li chiede qui, e qui si chiedono al ponte **sul filo**,
/// esattamente come li chiede il telefono. Stessa strada, stessi byte, stessa
/// cifratura; cambia solo chi li serve all'ultimo metro.
///
/// Il WebSocket della plancia non puo' passare di li' — un service worker
/// vede le richieste, non i WebSocket — e allora non e' un WebSocket: e' un
/// oggetto finto, messo nella pagina insieme alle altre premesse, che manda i
/// messaggi a questa pagina e riceve da qui. Dall'altra parte c'e' la stessa
/// [Cucitura] del telefono, che li rinumera e li mette sul filo.
///
/// Cosa questo **non** aggiunge: nessuna porta nuova sul ponte, e niente che
/// esca dal browser. Un service worker risponde solo alle pagine della sua
/// origine, e la sua origine e' l'app stessa. E funziona ovunque funzioni il
/// filo — anche fuori casa, passando dal centralino.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';
import 'dart:typed_data';

import 'package:web/web.dart' as web;

import '../../ponte/errori.dart';
import '../../ponte/filo.dart';
import '../chi_parla.dart';
import '../cucitura.dart';
import '../pannello.dart';
import '../precarichi.dart';
import '../premesse.dart';
import '../ritratto.dart';

/// Quanto si aspetta un file dal ponte. Come sul telefono: puo' passare dal
/// centralino con la casa dall'altra parte del paese.
const _attesaDellaCommissione = Duration(seconds: 90);

/// Se il browser sa aprire il gzip da se'.
///
/// `dart:io` nel browser non c'e', e per questo la plancia dal browser
/// arrivava cruda: il ponte comprimeva solo per il telefono. Ma il
/// decompressore non c'era da portarselo in casa — ce l'ha il browser, e si
/// chiama `DecompressionStream`.
///
/// Dentro casa non si sente: sono file su una rete locale. Fuori casa la
/// plancia a freddo passa dal centralino, e sono nove megabyte e un quarto
/// invece di tre. Il gzip su un modulo lo riduce a un terzo, e a freddo la
/// plancia e' fatta quasi tutta di moduli.
///
/// Si guarda una volta. Chi non ce l'ha — un browser di sei anni fa — chiede i
/// file crudi come prima, e la plancia si apre come si apriva.
final bool siApreIlGzip = globalContext.has('DecompressionStream');

/// Il gzip, aperto dal browser.
///
/// Non c'e' modo di dare dei byte a un `DecompressionStream` senza passare dai
/// flussi: si fa una risposta finta coi byte compressi, si manda il suo corpo
/// dentro il decompressore, e si legge quello che esce come si legge una
/// risposta qualunque. Il lavoro lo fa tutto il browser, e in Dart non passa
/// un byte in piu' del necessario.
Future<Uint8List> apriIlGzip(Uint8List byte) async {
  final compressa = web.Response(byte.toJS);
  final corpo = compressa.body;
  if (corpo == null) throw const ComandoRifiutato('il gzip è arrivato vuoto');
  final decompressore = web.DecompressionStream('gzip');
  final aperta = web.Response(
    corpo.pipeThrough(
      web.ReadableWritablePair(
        readable: decompressore.readable,
        writable: decompressore.writable,
      ),
    ),
  );
  final letto = await aperta.arrayBuffer().toDart;
  return letto.toDart.asUint8List();
}

/// Quello che alla schermata serve sapere di un servitore, senza `dart:io`.
abstract interface class ServitoreDiQuestoSistema {
  /// La pagina da aprire per questo pannello, in questa casa: [casa] e'
  /// l'identificativo della casa nell'app, e vuoto vuol dire «senza». Con la
  /// casa la pagina tiene le sue cose a parte, casa per casa
  /// (`premesse.dart`).
  Uri paginaDi(PannelloDellaPlancia pannello, {String casa = ''});

  /// L'indirizzo di una pagina qualunque servita da qui: serve al ritratto di
  /// una persona, che e' una pagina nostra messa di fianco ai file della
  /// plancia.
  Uri indirizzoDi(String percorso, {Map<String, String> domande});

  Future<void> spegni();
  set leggera(bool valore);
  set margini(({double alto, double basso}) quanto);
}

/// Accende il servitore del browser: registra il service worker e si mette in
/// ascolto. `null` se il browser non sa fare i service worker — allora la
/// plancia non si puo' servire, e la schermata lo dice invece di restare
/// bianca.
Future<ServitoreDiQuestoSistema?> alzaIlServitore({
  required Filo? Function() filo,
  required String lingua,
}) async {
  final servitore = _ServitoreSulWeb(filo, lingua);
  return await servitore.accendi() ? servitore : null;
}

class _ServitoreSulWeb implements ServitoreDiQuestoSistema {
  _ServitoreSulWeb(this._filo, String lingua) {
    premesse.lingua = lingua;
  }

  final Filo? Function() _filo;
  final premesse = Premesse();

  Cucitura? _cucitura;

  /* Due ascolti, e non uno: quello che manda un service worker a una pagina
   * **non** arriva su `window`, arriva su `navigator.serviceWorker`. Quello
   * che manda un riquadro alla pagina che lo ospita arriva su `window`. Sono
   * due strade diverse, e ascoltarne una sola vuol dire meta' delle cose che
   * non arrivano mai — che qui voleva dire una plancia bianca e un 502. */
  StreamSubscription<web.MessageEvent>? _dalLavoratore;
  StreamSubscription<web.MessageEvent>? _dalRiquadro;

  /* I file arrivati in un pacco e non ancora chiesti dal service worker.
   *
   * Nel browser un disco non c'e', e il deposito vero lo fa il browser stesso:
   * i file della plancia hanno l'impronta nel percorso — non cambiano mai — e
   * si servono con la data lunga, cosi' una ricarica non li richiede
   * (`plancia-sw.js`). Questo qui e' solo il banco di passaggio fra il pacco e
   * la domanda che arriva un istante dopo: ogni file si consegna una volta e
   * si toglie, e quello che nessuno chiede se ne va con la pagina. */
  final _pronti = <String, ({int stato, String tipo, List<int> byte})>{};

  /* Quello che sta arrivando, per non chiederlo due volte: un file dentro un
   * pacco che parte e' un file che il service worker chiedera' fra poco, e
   * chiederlo da solo sarebbe rifare la strada lenta. E' la stessa promessa
   * del servitore sul telefono (`servitore.dart`, `_inArrivo`). */
  final _inArrivo =
      <String, Future<({int stato, String tipo, List<int> byte})>>{};

  @override
  set leggera(bool valore) => premesse.leggera = valore;
  @override
  set margini(({double alto, double basso}) quanto) =>
      premesse.margini = quanto;

  Future<bool> accendi() async {
    /* Un browser i service worker li fa girare solo dove la pagina e' arrivata
     * in modo sicuro: `https`, o `localhost`. E' una regola sua, e provarci
     * lo stesso vuol dire un'eccezione dentro un `try` e nessuno che capisce
     * perche' la plancia non c'e'. Meglio saperlo e dirlo. */
    if (!web.window.isSecureContext) return false;
    final lavoratori = web.window.navigator.serviceWorker;
    try {
      /* Ambito la radice, non una cartella: la plancia chiama i suoi file per
       * indirizzo assoluto — `/dashboardmodern_static/…` — e un ambito piu'
       * stretto non li vedrebbe passare. */
      await lavoratori.register('plancia-sw.js'.toJS).toDart;
      await lavoratori.ready.toDart;
    } catch (_) {
      return false;
    }
    /* Due strade, e ognuna porta solo le sue cose: dal service worker le
     * domande dei file, dalla finestra il WebSocket del riquadro. Chi sia
     * davvero a parlare si guarda messaggio per messaggio (`chi_parla.dart`).
     */
    _dalLavoratore = web.EventStreamProviders.messageEvent
        .forTarget(lavoratori)
        .listen((evento) => _arrivato(evento, _daUnLavoratore(evento)));
    _dalRiquadro = web.EventStreamProviders.messageEvent
        .forTarget(web.window)
        .listen((evento) => _arrivato(evento, _daUnRiquadro(evento)));
    return true;
  }

  @override
  Uri paginaDi(PannelloDellaPlancia quale, {String casa = ''}) {
    premesse.pannello = quale;
    premesse.casa = casa;
    /* Assoluto, e risolto sulla base del documento.
     *
     * Assoluto perche' il riquadro vuole un indirizzo con lo schema: senza,
     * non apre niente e dice soltanto «manca lo schema». Sulla base del
     * documento — e non sulla radice del sito — perche' sotto l'ingress di
     * Home Assistant la radice non e' dove sta l'app. Il service worker
     * guarda dove il percorso **contiene** la cartella, non dove comincia, ed
     * e' per questo che regge tutti e due i casi. */
    final dove = Uri.base.resolve(
      quale.percorsoDellaPagina(premesse.lingua).replaceFirst('/', ''),
    );
    /* Quale plancia, nell'indirizzo: non per la pagina — le premesse le mette
     * il lavoratore — ma perche' due plance dello stesso ponte hanno gli
     * stessi file, e chi guarda il riquadro lo rifa' solo quando l'indirizzo
     * cambia. Solo per quelle in piu': la prima tiene l'indirizzo di
     * sempre. */
    final domande = <String, String>{
      if (!quale.primario && quale.profilo.isNotEmpty) 'plancia': quale.profilo,
      /* E quale casa, per la stessa ragione: due case hanno la stessa
       * pagina, e cambiando casa il riquadro si deve rifare. */
      if (casa.isNotEmpty) 'casa': casa,
    };
    if (domande.isEmpty) return dove;
    return dove.replace(queryParameters: domande);
  }

  @override
  Uri indirizzoDi(String percorso, {Map<String, String> domande = const {}}) =>
      /* Sulla base del documento, non sulla radice: sotto l'ingress di Home
       * Assistant — e sotto `/app/` quando l'app la serve il ponte — la radice
       * non e' dove sta l'app, e il service worker non vedrebbe passare
       * niente. */
      Uri.base
          .resolve(percorso.startsWith('/') ? percorso.substring(1) : percorso)
          .replace(queryParameters: domande.isEmpty ? null : domande);

  @override
  Future<void> spegni() async {
    await _dalLavoratore?.cancel();
    _dalLavoratore = null;
    await _dalRiquadro?.cancel();
    _dalRiquadro = null;
    await _cucitura?.chiudi();
    _cucitura = null;
  }

  /* ─── Quello che arriva ─────────────────────────────────────────────────*/

  /// Il nostro service worker: un lavoratore, e quello della plancia.
  DaChi _daUnLavoratore(web.MessageEvent evento) {
    final fonte = evento.source;
    if (fonte == null || !fonte.isA<web.ServiceWorker>()) return DaChi.altro;
    final lui = fonte as web.ServiceWorker;
    return lui.scriptURL.split('?').first.endsWith('/plancia-sw.js')
        ? DaChi.lavoratore
        : DaChi.altro;
  }

  /// Un riquadro di questa pagina: la finestra che ha scritto e' proprio
  /// quella che sta dentro uno dei nostri `iframe`. Un'altra scheda, o la
  /// pagina che ha aperto questa, non lo e'.
  DaChi _daUnRiquadro(web.MessageEvent evento) {
    final fonte = evento.source;
    if (fonte == null) return DaChi.altro;
    final riquadri = web.document.querySelectorAll('iframe');
    for (var quale = 0; quale < riquadri.length; quale += 1) {
      final uno = riquadri.item(quale);
      if (uno == null || !uno.isA<web.HTMLIFrameElement>()) continue;
      final dentro = (uno as web.HTMLIFrameElement).contentWindow;
      if (dentro != null && dentro.strictEquals(fonte).toDart) {
        return DaChi.riquadro;
      }
    }
    return DaChi.altro;
  }

  void _arrivato(web.MessageEvent evento, DaChi chi) {
    final detto = evento.data.dartify();
    if (detto is! Map) return;
    if (!siAscolta(
      che: detto['che'],
      chi: chi,
      origine: evento.origin,
      mia: web.window.location.origin,
    )) {
      return;
    }
    switch (detto['che']) {
      /* Dal service worker: un file da servire. */
      case 'gdahome/chiedi':
        unawaited(_serviIlFile(detto));
      /* Dal riquadro della plancia: il suo WebSocket. */
      case 'gdahome/ws-apri':
        _apriLaCucitura();
      case 'gdahome/ws-su':
        unawaited(_cucitura?.dallaPagina('${detto['testo'] ?? ''}'));
    }
  }

  /* Una pagina nuova si annuncia, e la cucitura e' **sua**.
   *
   * Qui c'era il difetto che teneva il pallino della plancia rosso con il filo
   * vivo, e si vedeva solo nel browser.
   *
   * Nel browser la pagina della plancia si ricarica per un sacco di ragioni
   * normali: si preme «Salva» nella Configurazione, si tocca «Plancia» nella
   * barra essendoci gia', si cambia «Plancia leggera», la casa arriva dopo che
   * la pagina si era aperta. Ogni ricarica e' un documento nuovo, con un
   * WebSocket nuovo che si annuncia — e trovava una cucitura ancora viva,
   * quella del documento di prima, che parlava con una pagina che non
   * esisteva piu'. La cucitura non si apriva, `auth_ok` non arrivava, e la
   * plancia restava in «Riconnessione...»: pallino rosso, nessuno stato,
   * nessuna configurazione — cioe' «non hai ancora collegato le tue entita'»
   * su una casa configurata.
   *
   * Sul telefono non capitava, e per un motivo che qui non c'era: li' ogni
   * pagina apre un WebSocket vero al servitore, e ognuno si prende **la sua**
   * cucitura (`servitore.dart`, `_cuciture`). Adesso fa lo stesso anche qui:
   * chi arriva prende il posto di chi c'era. */
  void _apriLaCucitura() {
    final vecchia = _cucitura;
    _cucitura = null;
    /* Si abbandona senza dire niente: un «chiudi» andrebbe a tutti i riquadri
     * della pagina, cioe' anche a quello nuovo che si e' appena annunciato. */
    if (vecchia != null) unawaited(vecchia.abbandona());
    /* Il filo **quando e' dentro**, non quello che c'e': `auth_ok` vuol dire
     * «da qui si passa», e con un filo che sta ancora bussando sarebbe una
     * bugia che la plancia paga con cinque secondi di rosso a ogni giro. */
    final cucitura = Cucitura(_VersoIlRiquadro(), () => filoPronto(_filo));
    _cucitura = cucitura;
    unawaited(
      cucitura.avvia().whenComplete(() {
        if (identical(_cucitura, cucitura)) _cucitura = null;
      }),
    );
  }
}

extension on _ServitoreSulWeb {
  /// Un file della plancia, chiesto dal service worker e preso sul filo.
  Future<void> _serviIlFile(Map<Object?, Object?> detto) async {
    final numero = detto['numero'];
    final percorso = '${detto['percorso'] ?? ''}';
    if (numero == null || percorso.isEmpty) return;
    /* La pagina che disegna un ritratto e' nostra, non della plancia: sta di
     * fianco ai suoi moduli perche' e' li' che li va a prendere, e chiederla
     * al ponte vorrebbe dire un 404. */
    if (percorso.split('?').first.endsWith('/$fileDelRitratto')) {
      _rispondi({
        'che': 'gdahome/file',
        'numero': numero,
        'stato': 200,
        'tipo': 'text/html; charset=utf-8',
        'byte': Uint8List.fromList(utf8.encode(paginaDelRitratto)),
      });
      return;
    }
    try {
      final preso = await _dalBanco(percorso) ?? await _chiedi(percorso);
      var corpo = preso.byte;
      var tipo = preso.tipo;
      /* La pagina della plancia si serve con le premesse: e' l'unico file che
       * si tocca, e non e' un file della dashboard — e' quello che si aggiunge
       * alla pagina servita. */
      if (tipo.startsWith('text/html')) {
        final letta = utf8.decode(corpo, allowMalformed: true);
        corpo = utf8.encode(
          premesse.conLePremesse(letta, ilWebSocket: ilWebSocketDelRiquadro),
        );
        tipo = 'text/html; charset=utf-8';
        /* E adesso i moduli, prima che il browser li chieda. Vedi
         * `precarichi.dart`: da fuori casa sono nove giri invece di
         * trecentosettantanove. Dopo aver risposto, e senza aspettare. */
        unawaited(_portaAvanti(percorso, letta));
      }
      _rispondi({
        'che': 'gdahome/file',
        'numero': numero,
        'stato': preso.stato,
        'tipo': tipo,
        'byte': Uint8List.fromList(corpo),
      });
    } on Object catch (male) {
      _rispondi({
        'che': 'gdahome/file',
        'numero': numero,
        'stato': 502,
        'corpo': '$male',
      });
    }
  }

  /// Un file dal ponte, sul filo. E' la stessa commissione del telefono.
  Future<({int stato, String tipo, List<int> byte})> _chiedi(
    String percorso,
  ) async {
    final filo = _filo();
    if (filo == null) throw const FiloCaduto('il filo non c\'è');
    final testo = await filo.testoDi({
      'type': 'ponte/http',
      'metodo': 'GET',
      'percorso': percorso,
      /* Compresso, se il browser sa aprirlo — e lo sa (vedi [siApreIlGzip]).
       *
       * Qui prima si chiedeva sempre crudo: `dart:io` nel browser non c'e', e
       * un decompressore in casa per una cosa che il ponte sa gia' non fare
       * sembrava il modo lungo. Il decompressore pero' non c'era da portare:
       * ce l'ha il browser. Fuori casa, a freddo, sono i megabyte della
       * plancia che passano dal centralino, e ce n'e' un terzo. */
      'senzaGzip': !siApreIlGzip,
    }, entro: _attesaDellaCommissione);
    final letto = jsonDecode(testo);
    final risposta = letto is Map ? letto['result'] : null;
    if (risposta is! Map) {
      throw const ComandoRifiutato('la casa ha risposto una cosa strana');
    }
    final corpo = risposta['corpo'];
    final stato = risposta['stato'];
    var byte = corpo is String ? base64.decode(corpo) : Uint8List(0);
    if (risposta['compresso'] == 'gzip') {
      /* Un ponte che comprime dopo che gli si e' chiesto di non farlo e' un
       * ponte di prima di questa riga: non c'e' niente da aprire, e dirlo e'
       * meglio che mostrare una plancia di byte illeggibili. */
      if (!siApreIlGzip) {
        throw const ComandoRifiutato(
          'la casa ha compresso, e qui non si apre: aggiorna l\'add-on',
        );
      }
      byte = await apriIlGzip(byte);
    }
    return (
      stato: stato is int ? stato : 502,
      tipo: risposta['tipo'] is String
          ? risposta['tipo'] as String
          : 'application/octet-stream',
      byte: byte,
    );
  }

  /// Un file che e' gia' arrivato in un pacco, o che sta arrivando.
  ///
  /// `null` vuol dire «non lo ho»: allora si chiede da solo, come prima.
  Future<({int stato, String tipo, List<int> byte})?> _dalBanco(
    String percorso,
  ) async {
    final pronto = _pronti.remove(percorso);
    if (pronto != null) return pronto;
    final inArrivo = _inArrivo[percorso];
    if (inArrivo == null) return null;
    try {
      return await inArrivo;
    } catch (_) {
      /* Il pacco non e' arrivato: si chiede da solo. */
      return null;
    }
  }

  /// I moduli della pagina, chiesti in pacchi prima che li chieda il browser.
  ///
  /// E' la stessa cosa che fa il servitore sul telefono, e per la stessa
  /// ragione: la pagina porta l'elenco dei file che vuole subito, e chiederli
  /// in pacchi invece che uno per volta e' la differenza fra un minuto e
  /// qualche secondo da fuori casa. Vedi `precarichi.dart`.
  ///
  /// Non solleva mai: un pacco che non arriva e' una plancia che si apre come
  /// si apriva ieri.
  Future<void> _portaAvanti(String percorsoDellaPagina, String pagina) async {
    try {
      final quali = iPrecarichiDellaPagina(
        pagina,
        cartella: laCartellaDi(percorsoDellaPagina.split('?').first),
      );
      final daChiedere = quali
          .where((quale) => !_pronti.containsKey(quale))
          .where((quale) => !_inArrivo.containsKey(quale))
          .toList();
      if (daChiedere.isEmpty) return;

      final pacchi = aPacchi(daChiedere);
      for (var da = 0; da < pacchi.length; da += pacchiInsieme) {
        final adesso = pacchi.sublist(
          da,
          da + pacchiInsieme > pacchi.length
              ? pacchi.length
              : da + pacchiInsieme,
        );
        await Future.wait(adesso.map(_unPacco));
      }
    } catch (_) {
      /* Niente da dire a nessuno: i file si chiedono come sempre. */
    }
  }

  /// Un pacco: si prenota ogni file, si chiede, si mette sul banco.
  Future<void> _unPacco(List<String> quali) async {
    final attese =
        <String, Completer<({int stato, String tipo, List<int> byte})>>{};
    for (final quale in quali) {
      final aspetta = Completer<({int stato, String tipo, List<int> byte})>();
      attese[quale] = aspetta;
      aspetta.future.ignore();
      _inArrivo[quale] = aspetta.future;
    }
    var restano = quali;
    try {
      while (restano.isNotEmpty) {
        final dentro = await _ilPacco(restano);
        if (dentro.isEmpty) {
          throw const ComandoRifiutato('il pacco è tornato vuoto');
        }
        final ancora = <String>[];
        for (final quale in restano) {
          final preso = dentro[quale];
          if (preso == null) {
            ancora.add(quale);
            continue;
          }
          _pronti[quale] = preso;
          attese[quale]!.complete(preso);
        }
        restano = ancora;
      }
    } catch (male) {
      for (final quale in restano) {
        if (!attese[quale]!.isCompleted) attese[quale]!.completeError(male);
      }
    } finally {
      for (final quale in quali) {
        if (identical(_inArrivo[quale], attese[quale]!.future)) {
          _inArrivo.remove(quale);
        }
      }
    }
  }

  /// Il pacco, dal ponte. La stessa strada di [_chiedi], con piu' file.
  Future<Map<String, ({int stato, String tipo, List<int> byte})>> _ilPacco(
    List<String> quali,
  ) async {
    final filo = _filo();
    if (filo == null) throw const FiloCaduto('il filo non c\'è');
    final testo = await filo.testoDi({
      'type': 'ponte/http-molti',
      'percorsi': quali,
      'senzaGzip': !siApreIlGzip,
    }, entro: _attesaDellaCommissione);
    final letto = jsonDecode(testo);
    final risposta = letto is Map ? letto['result'] : null;
    final dentro = risposta is Map ? risposta['file'] : null;
    if (dentro is! Map) {
      throw const ComandoRifiutato('la casa ha risposto una cosa strana');
    }
    final fuori = <String, ({int stato, String tipo, List<int> byte})>{};
    for (final uno in dentro.entries) {
      final quale = uno.key;
      final dati = uno.value;
      if (quale is! String || dati is! Map) continue;
      final corpo = dati['corpo'];
      var byte = corpo is String ? base64.decode(corpo) : Uint8List(0);
      if (dati['compresso'] == 'gzip') {
        if (!siApreIlGzip) continue;
        byte = await apriIlGzip(byte);
      }
      final stato = dati['stato'];
      fuori[quale] = (
        stato: stato is int ? stato : 502,
        tipo: dati['tipo'] is String
            ? dati['tipo'] as String
            : 'application/octet-stream',
        byte: byte,
      );
    }
    return fuori;
  }

  /// Al service worker, che aspetta con quel numero.
  void _rispondi(Map<String, Object?> cosa) {
    web.window.navigator.serviceWorker.controller?.postMessage(cosa.jsify());
  }
}

/// La pagina, vista dalla cucitura: qui e' il riquadro della plancia, e i
/// messaggi ci arrivano come messaggi fra pagine.
class _VersoIlRiquadro implements VersoLaPagina {
  @override
  bool get aperta => true;

  /* Qui la stringa serve davvero: fra due pagine passano messaggi di
   * JavaScript, e la plancia dall'altra parte aspetta testo. Nel browser non
   * c'e' nemmeno un altro isolato da cui copiare, quindi questa e' l'unica
   * copia della strada — la stessa di prima. */
  @override
  void manda(Uint8List byte) =>
      _aTutti({'che': 'gdahome/ws-giu', 'testo': utf8.decode(byte)});

  @override
  Future<void> chiudi() async => _aTutti({'che': 'gdahome/ws-chiudi'});

  /* A tutti i riquadri della pagina: ce n'e' uno solo — la plancia — e
   * cercarlo per nome vorrebbe dire legarsi a come il riquadro e' fatto.
   *
   * Ma solo **sulla nostra origine**: il messaggio lo riceve un riquadro che
   * mostra una pagina servita da qui, e nessun altro — non il cruscotto del
   * quadro, non una pagina che nel frattempo il riquadro ha aperto altrove.
   * Dentro ci sono le risposte della casa. */
  void _aTutti(Map<String, Object?> cosa) {
    final mia = web.window.location.origin;
    final riquadri = web.document.querySelectorAll('iframe');
    for (var quale = 0; quale < riquadri.length; quale += 1) {
      final uno = riquadri.item(quale);
      /* `is` non basta: fra due tipi che vivono in JavaScript risponde sempre
       * di si' senza guardare cosa c'e' davvero sotto. */
      if (uno == null || !uno.isA<web.HTMLIFrameElement>()) continue;
      try {
        (uno as web.HTMLIFrameElement).contentWindow?.postMessage(
          cosa.jsify(),
          mia.toJS,
        );
      } catch (_) {
        /* Un riquadro che non si lascia parlare non e' il nostro. */
      }
    }
  }
}
