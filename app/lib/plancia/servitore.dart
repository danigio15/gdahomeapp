/// Il servitore: il server locale che serve la plancia vera al WebView.
///
/// La plancia di DashboardModern e' una pagina web, e l'app la fa girare
/// dentro un WebView **cosi' com'e'**, senza rifarla: stessa grafica, stesse
/// interazioni, stessa configurazione di quella che si vede in Home Assistant.
/// Perche' funzioni le servono due cose che dal telefono non ci sono: i suoi
/// file, che stanno in Home Assistant, e un WebSocket che parli Home Assistant
/// sullo stesso indirizzo da cui e' arrivata la pagina.
///
/// Tutte e due le da' questo server, che ascolta su `127.0.0.1` e non e'
/// raggiungibile da nessun altro:
///
///  - i file li chiede al ponte, sul filo, con `ponte/http`, e li tiene sul
///    disco: il percorso ha dentro un'impronta che cambia a ogni aggiornamento
///    dell'integrazione, quindi un file preso una volta vale finche' esiste;
///  - `/api/websocket` e' **cucito** sul filo dell'app: la pagina crede di
///    parlare con Home Assistant, e i suoi messaggi passano dal filo con i
///    numeri del filo, e tornano con i suoi. Home Assistant vuole numeri sempre
///    crescenti su un filo, e due contatori non possono spartirsene uno;
///  - le chiamate REST della plancia — lo storico, le istantanee delle
///    telecamere — vanno al ponte allo stesso modo dei file.
///
/// La pagina si serve con in testa uno script che le dice di essere
/// **ospitata**: e' il modo in cui la plancia gira dentro il pannello di Home
/// Assistant, e in quel modo non chiede nessun segno — usa il WebSocket che
/// trova, ed e' il nostro. Nessuna credenziale di Home Assistant arriva mai
/// alla pagina, e nemmeno al telefono.
///
/// Chi puo' bussare a questo server: **solo il WebView dell'app**. Sul
/// telefono `127.0.0.1` lo raggiunge qualunque altra app, e nel browser
/// qualunque pagina; e da questo server, attraverso il filo, si comanda la
/// casa. Percio' la porta ha una chiave: la pagina si apre con la chiave
/// nell'indirizzo — che conosce solo chi l'ha aperta, cioe' l'app — e da li'
/// in poi la chiave viaggia in un biscotto, che il browser mette da se' su
/// ogni richiesta della pagina e che nessun altro ha. Senza, si riceve un no.
///
/// Niente Flutter qui dentro, ed e' voluto: si prova per intero senza uno
/// schermo, e gira anche da solo, da riga di comando, per il collaudo.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:isolate';
import 'dart:math';
import 'dart:typed_data';

import '../misure/lavori.dart';
import '../ponte/altrove/altrove.dart';
import '../ponte/errori.dart';
import '../ponte/filo.dart';
import 'cucitura.dart';
import 'pannello.dart';
import 'premesse.dart';

/// Come si trova il filo, adesso.
///
/// E' una funzione e non un filo perche' il filo cambia — si cambia casa, cade
/// e si rialza — e il servitore vive piu' a lungo di ognuno di loro.
typedef TrovaIlFilo = Filo? Function();

/// I tipi dei file, dall'estensione. Quelli di un modulo JavaScript **devono**
/// essere `text/javascript`: un browser un modulo con un altro tipo non lo
/// esegue, e la plancia e' fatta di duecentosettanta moduli.
const _tipi = <String, String>{
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

/// Un percorso e' fatto di lettere, numeri e pochi segni. Niente `..`: e' un
/// percorso sul disco, e chi lo chiede e' una pagina web. I file della
/// plancia hanno nomi semplici, e un `%` in un nome di file non e' un file:
/// e' un browser che ha trovato uno spazio, o qualcuno che prova.
final _percorsoDelFile = RegExp(r'^/[A-Za-z0-9_\-./@+~]+$');
final _percorsoBuono = RegExp(r'^/[A-Za-z0-9_\-./@+~%]+$');

/// La cartella dei file della plancia.
const _fissi = '/dashboardmodern_static/';

/// Le immagini che stanno in `config/www` di Home Assistant.
///
/// La plancia le chiama cosi' da sempre — `/local/foto.jpg` — perche' dentro
/// Home Assistant e' Home Assistant a servirle. Qui la plancia gira dietro il
/// servitore, e quell'indirizzo non porterebbe da nessuna parte: passa dal
/// ponte come tutto il resto, e il ponte le legge dal disco. Cosi' la stessa
/// configurazione mostra la stessa foto in tutti e due i posti.
const _diCasa = '/local/';

/// Quanto puo' essere grande il corpo di una chiamata REST della plancia.
const _corpoMassimo = 4 * 1024 * 1024;

/// Il biscotto che porta la chiave, e il nome della chiave nell'indirizzo.
const _biscotto = 'gdahome';
const _ingresso = 'ingresso';

/// La porta su cui il servitore ascolta sul telefono. **Fissa, e non a caso.**
///
/// Un browser tiene quello che una pagina si salva — e la plancia ci salva la
/// sua configurazione — per **origine**, e l'origine e' fatta anche dalla
/// porta. Con una porta diversa a ogni avvio, ogni avvio era una pagina nuova
/// che non si ricordava niente: la plancia ripartiva vuota, con «la dashboard
/// e' quasi pronta», e si riempiva solo quando riusciva a rileggersi dal
/// ponte. Col filo giu' — un telefono che si riapre fuori casa, e il
/// centralino ci mette qualche secondo — non ci riusciva, e sembrava che la
/// configurazione fosse andata persa. Non era persa: era su un'altra origine,
/// e nessuno l'avrebbe piu' letta.
///
/// Il numero non vuol dire niente: e' alto, fuori da quelli che si assegnano
/// da soli, e non e' di nessun servizio conosciuto. Su `127.0.0.1` la puo'
/// raggiungere un'altra app del telefono, ma senza la chiave non ne cava
/// niente — la chiave nasce col servitore e non e' nell'indirizzo di nessuno.
const int portaDiCasa = 43117;

/// Quante porte si provano prima di arrendersi a una qualunque.
const int porteDaProvare = 8;

/// Quanto si aspetta il filo prima di dire alla pagina che non c'e': e' il
/// tempo di una riconnessione, non di piu'.
const _attesaDelFilo = Duration(seconds: 20);

/// Quanto si aspetta una commissione. Piu' di un comando: un file da un
/// megabyte che passa dal centralino, su una rete del cellulare, ci mette il
/// suo tempo, e un file che arriva tardi vale piu' di un file che non arriva.
const _attesaDellaCommissione = Duration(seconds: 90);

class Servitore {
  Servitore({
    required TrovaIlFilo filo,
    required this.cartella,
    this.lingua = 'it',
    this.portaAperta = false,
    bool leggera = false,
    void Function(String)? racconta,
  }) : _trovaIlFilo = filo,
       _racconta = racconta ?? ((_) {}) {
    premesse
      ..lingua = lingua
      ..leggera = leggera;
  }

  final TrovaIlFilo _trovaIlFilo;

  /// `true` quando la radice (`/`) porta alla pagina, chiave compresa. Serve
  /// al servitore da riga di comando, dove chi bussa e' il collaudo; sul
  /// telefono nessuno deve poter chiedere la chiave a nessuno.
  final bool portaAperta;

  /// Quanto prendono le barre del telefono, in punti CSS: l'orologio in
  /// cima, i tasti (o la barretta) in fondo.
  ///
  /// La pagina arriva ai bordi dello schermo — il suo fondo passa sotto
  /// tutt'e due — e questi due numeri le dicono dove non deve scrivere.
  /// Prima li teneva l'app, lasciando due bande vuote intorno al riquadro: la
  /// plancia sembrava una pagina dentro una cornice, e sopra e sotto l'aria
  /// era doppia — quella della cornice piu' quella della pagina.
  ///
  /// Si riscrivono girando lo schermo, e allora la pagina non si ricarica: le
  /// due misure sono variabili CSS, e l'app le cambia da fuori.
  ({double alto, double basso}) get margini => premesse.margini;
  set margini(({double alto, double basso}) quanto) =>
      premesse.margini = quanto;

  /// La plancia senza quello che un telefono non regge.
  ///
  /// Il foglio di stile della plancia ha settantadue animazioni che non
  /// finiscono mai — puntini che pulsano, fiamme che tremolano — e sedici
  /// sfocature dietro le tessere, fino a quarantadue pixel. Nel browser di un
  /// computer non si notano; in un WebView su un telefono vogliono dire
  /// ridisegnare tutto sessanta volte al secondo, per sempre, sulla stessa
  /// scheda video che deve disegnare anche l'app: e l'app va a scatti. Con
  /// questa le animazioni infinite fanno un giro e si fermano, e le
  /// sfocature spariscono. Si cambia da fuori, e vale dalla pagina dopo.
  bool get leggera => premesse.leggera;
  set leggera(bool quanto) => premesse.leggera = quanto;

  /// Il tema della plancia su questo dispositivo: `auto`, `chiaro`, `scuro`.
  String get tema => premesse.tema;
  set tema(String quale) => premesse.tema = quale;

  /// Come sta la barra in fondo alla plancia: `scomparsa` o `fissa`.
  String get barra => premesse.barra;
  set barra(String come) => premesse.barra = come;

  /// La chiave della porta: nasce con il servitore, e la conosce solo chi
  /// apre la pagina dall'indirizzo che [paginaDi] da'.
  final String chiave = _chiaveNuova();

  /// Dove si tengono i file della plancia, fra un'apertura e l'altra.
  final Directory cartella;

  /// La lingua della plancia: sceglie quale pagina si apre e cosa si dice
  /// alla pagina.
  final String lingua;

  final void Function(String) _racconta;

  /// Il pannello che si sta servendo. Si scrive prima di aprire la pagina:
  /// e' da qui che la pagina sa quale istanza e quale profilo e'.
  PannelloDellaPlancia? get pannello => premesse.pannello;
  set pannello(PannelloDellaPlancia? quale) => premesse.pannello = quale;

  HttpServer? _server;
  final _inArrivo = <String, Future<_Scaricato>>{};
  final _cuciture = <Cucitura>{};

  /// Su quale porta si ascolta. Solo dopo [alza].
  int get porta => _server?.port ?? 0;

  /// Da dove la pagina viene servita: `http://127.0.0.1:<porta>`.
  Uri get radice => Uri(scheme: 'http', host: '127.0.0.1', port: porta);

  bool get acceso => _server != null;

  /// La pagina da aprire nel WebView per questo pannello, con la chiave. Da
  /// qui in poi e' questo il pannello che si serve.
  Uri paginaDi(PannelloDellaPlancia quale) {
    pannello = quale;
    return radice.replace(
      path: quale.percorsoDellaPagina(lingua),
      queryParameters: {_ingresso: chiave},
    );
  }

  /// Si mette in ascolto. Su `127.0.0.1` e basta: nessun altro sulla rete
  /// deve poter chiedere niente a questo server.
  ///
  /// Con [porta] a zero il sistema ne da' una qualunque: va bene alle prove,
  /// che ne accendono tante insieme. Sul telefono no — li' si chiede
  /// [portaDiCasa], e il perche' e' scritto li'.
  Future<void> alza({int porta = 0}) async {
    if (_server != null) return;
    final server = porta == portaDiCasa
        ? await _laPortaDiCasa()
        : await HttpServer.bind(InternetAddress.loopbackIPv4, porta);
    /* `dart:io` mette di suo un'intestazione che vieta di mostrare la pagina
     * dentro un riquadro di un'altra origine. Sul telefono non cambia niente
     * — il WebView la apre per intero — ma nel collaudo la plancia sta in un
     * riquadro dentro l'app web, e senza questo il browser lo lascia vuoto.
     * La porta ha la sua chiave: chi la inquadra senza non vede niente. */
    server.defaultResponseHeaders.removeAll('x-frame-options');
    _server = server;
    unawaited(_ascolta(server));
  }

  /* La porta di casa, o una vicina.
   *
   * Occupata da qualcun altro — un'altra app, o l'app stessa che si e'
   * riavviata prima che il sistema liberasse la porta — si prova la
   * successiva, e dopo qualche tentativo una qualunque: meglio una plancia
   * che riparte smemorata che una plancia che non parte. */
  Future<HttpServer> _laPortaDiCasa() async {
    for (var i = 0; i < porteDaProvare; i += 1) {
      try {
        return await HttpServer.bind(
          InternetAddress.loopbackIPv4,
          portaDiCasa + i,
        );
      } on SocketException {
        _racconta(
          'la porta ${portaDiCasa + i} e\' occupata, provo la prossima',
        );
      }
    }
    _racconta('nessuna porta di casa libera: la plancia ripartira\' vuota');
    return HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  }

  /// Chi bussa ha la chiave? Nel biscotto, o — la prima volta —
  /// nell'indirizzo.
  bool _haLaChiave(HttpRequest richiesta) {
    for (final uno in richiesta.cookies) {
      if (uno.name == _biscotto && uno.value == chiave) return true;
    }
    return richiesta.uri.queryParameters[_ingresso] == chiave;
  }

  void _no(HttpRequest richiesta) =>
      _rispondi(richiesta, 403, 'text/plain', utf8.encode('serve la chiave'));

  Future<void> spegni() async {
    final server = _server;
    _server = null;
    for (final cucitura in List.of(_cuciture)) {
      await cucitura.chiudi();
    }
    await server?.close(force: true);
  }

  Future<void> _ascolta(HttpServer server) async {
    await for (final richiesta in server) {
      unawaited(
        _servi(richiesta).catchError((Object errore) {
          _racconta('richiesta andata storta: $errore');
          _rispondi(richiesta, 500, 'text/plain', utf8.encode('$errore'));
        }),
      );
    }
  }

  Future<void> _servi(HttpRequest richiesta) async {
    final percorso = richiesta.uri.path;

    if (percorso == '/' && portaAperta && pannello != null) {
      richiesta.response.redirect(paginaDi(pannello!));
      return;
    }

    /* Tutto il resto vuole la chiave: i file, le chiamate, il filo. */
    if (!_haLaChiave(richiesta)) {
      _no(richiesta);
      return;
    }

    if (percorso == '/api/websocket') {
      if (!WebSocketTransformer.isUpgradeRequest(richiesta)) {
        _rispondi(richiesta, 426, 'text/plain', utf8.encode('WebSocket'));
        return;
      }
      final presa = await WebSocketTransformer.upgrade(richiesta);
      final cucitura = Cucitura(_LaPresa(presa), _filoPronto);
      /* Chi ascolta la pagina e' l'adattatore, non la cucitura: la cucitura
       * il trasporto non lo conosce, ed e' l'intera ragione per cui la stessa
       * sta in piedi anche nel browser, dove un WebSocket da ascoltare non
       * c'e'. */
      presa.listen(
        (dynamic grezzo) {
          if (grezzo is String) unawaited(cucitura.dallaPagina(grezzo));
        },
        onDone: cucitura.laPaginaSeNEAndata,
        onError: (Object _) => cucitura.laPaginaSeNEAndata(),
        cancelOnError: true,
      );
      _cuciture.add(cucitura);
      cucitura.avvia().whenComplete(() => _cuciture.remove(cucitura));
      return;
    }

    if (percorso.startsWith(_fissi) || percorso.startsWith(_diCasa)) {
      await _file(richiesta, percorso);
      return;
    }

    if (percorso.startsWith('/api/')) {
      await _api(richiesta);
      return;
    }

    if (percorso == '/' && pannello != null) {
      richiesta.response.redirect(paginaDi(pannello!));
      return;
    }

    _rispondi(
      richiesta,
      404,
      'text/plain',
      utf8.encode('qui non c\'e\' niente'),
    );
  }

  /* ─── I file ───────────────────────────────────────────────────────────── */

  Future<void> _file(HttpRequest richiesta, String percorso) async {
    if (!_percorsoDelFile.hasMatch(percorso) ||
        percorso.contains('..') ||
        percorso.contains('//')) {
      _rispondi(richiesta, 400, 'text/plain', utf8.encode('percorso strano'));
      return;
    }

    final tipo = _tipoDi(percorso);
    final eLaPagina = tipo.startsWith('text/html');
    final sulDisco = File('${cartella.path}$percorso');

    /* Prima si guarda se sta gia' arrivando, poi se sta sul disco, e solo
     * dopo si chiede: l'ordine conta, perche' un file che sta arrivando non
     * e' ancora sul disco, e chiederlo di nuovo vorrebbe dire due volte la
     * strada lenta per lo stesso modulo. */
    List<int>? byte;
    final inArrivo = _inArrivo[percorso];
    if (inArrivo == null && await sulDisco.exists()) {
      byte = await sulDisco.readAsBytes();
    } else {
      final _Scaricato preso;
      try {
        preso = await (inArrivo ?? _scarica(percorso, sulDisco));
      } on ErroreDelPonte catch (errore) {
        _rispondi(
          richiesta,
          502,
          'text/plain',
          utf8.encode('il ponte non ha risposto: ${errore.spiegazione}'),
        );
        return;
      }
      if (preso.stato != 200) {
        _rispondi(richiesta, preso.stato, preso.tipo, preso.byte);
        return;
      }
      byte = preso.byte;
    }

    if (eLaPagina) {
      /* Da qui in poi la chiave sta nel biscotto: il browser lo mette da se'
       * su ogni cosa che la pagina chiede, e su nient'altro. */
      richiesta.response.cookies.add(
        Cookie(_biscotto, chiave)
          ..path = '/'
          ..httpOnly = true
          ..sameSite = SameSite.strict,
      );
      _rispondi(
        richiesta,
        200,
        tipo,
        utf8.encode(conLePremesse(utf8.decode(byte, allowMalformed: true))),
        cache: 'no-store',
      );
      return;
    }
    /* Il percorso ha dentro l'impronta: quello che c'e' non cambia mai. */
    _rispondi(
      richiesta,
      200,
      tipo,
      byte,
      cache: 'public, max-age=31536000, immutable',
    );
  }

  /// Un file, dal ponte, e poi sul disco.
  ///
  /// Due richieste per lo stesso file mentre e' in arrivo aspettano la stessa
  /// risposta: la pagina chiede gli stessi moduli da piu' parti insieme, e
  /// chiederli due volte al ponte e' sprecare la strada lenta. La scrittura
  /// sul disco sta **dentro** l'attesa: chi arriva dopo trova il file, non un
  /// file che sta per esserci.
  Future<_Scaricato> _scarica(String percorso, File sulDisco) {
    return _inArrivo.putIfAbsent(percorso, () async {
      try {
        final preso = await _commissione('GET', percorso);
        if (preso.stato == 200) await _metti(sulDisco, preso.byte);
        return preso;
      } finally {
        _inArrivo.remove(percorso);
      }
    });
  }

  Future<_Scaricato> _commissione(
    String metodo,
    String percorso, {
    List<int>? corpo,
    String? tipoDelCorpo,
  }) async {
    final filo = await _filoPronto();
    if (filo == null) throw const FiloCaduto('il filo non c\'e\'');
    /* Il **testo** della risposta, non la risposta aperta: quello che c'e'
     * dentro si apre altrove, tutto in una volta. Vedi [_spacchetta]. */
    final testo = await Lavori.io.conto(
      'risposte del ponte, aspettate',
      () => filo.testoDi({
        'type': 'ponte/http',
        'metodo': metodo,
        'percorso': percorso,
        if (corpo != null) 'corpo': base64.encode(corpo),
        if (tipoDelCorpo != null) 'tipo': tipoDelCorpo,
      }, entro: _attesaDellaCommissione),
    );
    return _spacchetta(testo);
  }

  Future<void> _metti(File dove, List<int> byte) async {
    try {
      await dove.parent.create(recursive: true);
      /* Prima un file a parte, poi il nome vero: chi legge non deve mai
       * trovare un file scritto a meta'. */
      final provvisorio = File('${dove.path}.parte');
      await provvisorio.writeAsBytes(byte, flush: true);
      await provvisorio.rename(dove.path);
    } catch (errore) {
      _racconta('non riesco a tenere ${dove.path}: $errore');
    }
  }

  /// La pagina della plancia, con in testa quello che le serve sapere.
  ///
  /// E' lo stesso che le dice il pannello di Home Assistant quando la ospita:
  /// che e' ospitata (e quindi non chiede segni e usa il WebSocket che trova),
  /// quale istanza e quale profilo e', in che lingua. Lo script va **prima di
  /// ogni altro**, ed e' per questo che si mette in cima a `<head>`: il
  /// preludio della plancia legge queste cose appena parte.
  ///
  /// Il WebSocket che trova e' quello vero del browser, con una cosa in piu':
  /// qualunque indirizzo gli si dia, va al servitore. La plancia, ospitata,
  /// apre un secondo filo per la configurazione e lo punta a un nome finto —
  /// `dashboardmodern.invalid` — contando sul fatto che il ponte del
  /// pannello l'indirizzo lo ignora. Qui il ponte e' un server, e
  /// l'indirizzo va detto giusto.
  /// Le premesse della pagina: stanno in `premesse.dart`, senza `dart:io`,
  /// perche' le usa anche il browser — dove un server non c'e' e la plancia la
  /// serve un service worker. Uguali per tutti e due; cambia solo da dove
  /// arriva il WebSocket.
  final premesse = Premesse();

  String conLePremesse(String pagina) =>
      premesse.conLePremesse(pagina, ilWebSocket: ilWebSocketDelServitore);

  /* ─── Le chiamate REST ─────────────────────────────────────────────────── */

  Future<void> _api(HttpRequest richiesta) async {
    final percorso = richiesta.uri.hasQuery
        ? '${richiesta.uri.path}?${richiesta.uri.query}'
        : richiesta.uri.path;
    if (!_percorsoBuono.hasMatch(richiesta.uri.path) ||
        richiesta.uri.path.contains('..')) {
      _rispondi(richiesta, 400, 'text/plain', utf8.encode('percorso strano'));
      return;
    }

    final pezzi = <int>[];
    await for (final pezzo in richiesta) {
      pezzi.addAll(pezzo);
      if (pezzi.length > _corpoMassimo) {
        _rispondi(richiesta, 413, 'text/plain', utf8.encode('troppo grande'));
        return;
      }
    }

    final _Scaricato preso;
    try {
      preso = await _commissione(
        richiesta.method,
        percorso,
        corpo: pezzi.isEmpty ? null : pezzi,
        tipoDelCorpo: richiesta.headers.contentType?.toString(),
      );
    } on ErroreDelPonte catch (errore) {
      _rispondi(
        richiesta,
        502,
        'text/plain',
        utf8.encode('il ponte non ha risposto: ${errore.spiegazione}'),
      );
      return;
    }
    _rispondi(
      richiesta,
      preso.stato,
      preso.tipo,
      preso.byte,
      cache: 'no-store',
    );
  }

  /* ─── Il filo ──────────────────────────────────────────────────────────── */

  /// Il filo, quando e' dentro. Aspetta una riconnessione in corso, ma non
  /// per sempre: `null` quando non c'e' verso.
  Future<Filo?> _filoPronto({Duration entro = _attesaDelFilo}) async {
    final fine = DateTime.now().add(entro);
    while (true) {
      final filo = _trovaIlFilo();
      if (filo != null && filo.dentro) return filo;
      if (DateTime.now().isAfter(fine)) return null;
      if (filo == null) {
        await Future<void>.delayed(const Duration(milliseconds: 250));
        continue;
      }
      /* C'e' ma non e' dentro: si aspetta che lo dica lui, invece di
       * guardare l'orologio. */
      final resta = fine.difference(DateTime.now());
      try {
        await filo.stato
            .firstWhere((stato) => stato == StatoDelFilo.dentro)
            .timeout(resta < Duration.zero ? Duration.zero : resta);
      } catch (_) {
        /* Scaduto, o il filo e' stato chiuso: si riguarda dall'inizio. */
      }
    }
  }

  void _rispondi(
    HttpRequest richiesta,
    int stato,
    String tipo,
    List<int> byte, {
    String? cache,
  }) {
    final risposta = richiesta.response;
    try {
      risposta.statusCode = stato;
      risposta.headers.set(HttpHeaders.contentTypeHeader, tipo);
      if (cache != null) {
        risposta.headers.set(HttpHeaders.cacheControlHeader, cache);
      }
      risposta.headers.contentLength = byte.length;
      risposta.add(byte);
    } catch (_) {
      /* Chiusa dall'altra parte. */
    }
    unawaited(risposta.close().catchError((_) {}));
  }
}

/// Trentadue cifre esadecimali, da un generatore che non si indovina.
String _chiaveNuova() {
  final caso = Random.secure();
  return List.generate(
    16,
    (_) => caso.nextInt(256).toRadixString(16).padLeft(2, '0'),
  ).join();
}

String _tipoDi(String percorso) {
  final punto = percorso.lastIndexOf('.');
  if (punto < 0) return 'application/octet-stream';
  return _tipi[percorso.substring(punto).toLowerCase()] ??
      'application/octet-stream';
}

/// Oltre questo, una risposta si apre **altrove**. E' la stessa soglia delle
/// buste, per la stessa ragione: sotto, spedire il lavoro costa piu' del
/// lavoro.
const int _grossa = 16 * 1024;

/// Apre la risposta a una commissione: il JSON, il base64, il gzip.
///
/// Tutto insieme, e altrove quando e' grossa. Un file della plancia, arrivato
/// qui, sono quattro cose grandi una dopo l'altra: il testo del messaggio, la
/// sua copia dentro il JSON aperto, i byte del base64, i byte scompattati.
/// Farle sul filo che disegna lo schermo voleva dire riempirlo di roba da
/// buttare — nove megabyte in mezzo minuto, all'avvio della plancia — e
/// buttarla, quando ce n'e' tanta, e' un decimo di secondo di schermo fermo.
///
/// Qui ne torna una sola, e **trasferita**, non copiata: i byte cambiano
/// isolato senza passare per la memoria di questo.
Future<_Scaricato> _spacchetta(String testo) async {
  final (int, String, TransferableTypedData?) preso;
  try {
    preso = testo.length < _grossa
        ? Lavori.io.subito('risposte aperte qui', () => _apri(testo))
        : await Lavori.io.conto(
            'risposte aperte altrove',
            () => altrove(() => _apri(testo)),
          );
  } on ErroreDelPonte {
    rethrow;
  } catch (_) {
    throw const ComandoRifiutato('il ponte ha risposto una cosa strana');
  }
  final (stato, tipo, corpo) = preso;
  return _Scaricato(
    stato,
    tipo,
    corpo == null ? const <int>[] : corpo.materialize().asUint8List(),
  );
}

/// Il lavoro vero, scritto in modo da poter partire per un altro isolato:
/// prende testo e torna byte, non tocca niente di qui.
(int, String, TransferableTypedData?) _apri(String testo) {
  final letto = jsonDecode(testo);
  final risposta = letto is Map ? letto['result'] : null;
  if (risposta is! Map) {
    throw const ComandoRifiutato('il ponte ha risposto una cosa strana');
  }
  final stato = risposta['stato'];
  final corpo = risposta['corpo'];
  var byte = corpo is String ? base64.decode(corpo) : Uint8List(0);
  if (risposta['compresso'] == 'gzip') {
    byte = Uint8List.fromList(gzip.decode(byte));
  }
  return (
    stato is int ? stato : 502,
    risposta['tipo'] is String
        ? risposta['tipo'] as String
        : 'application/octet-stream',
    byte.isEmpty ? null : TransferableTypedData.fromList([byte]),
  );
}

/// Quello che torna da una commissione, gia' spacchettato.
class _Scaricato {
  const _Scaricato(this.stato, this.tipo, this.byte);

  final int stato;
  final String tipo;
  final List<int> byte;
}

/* ─── La cucitura ───────────────────────────────────────────────────────── */

/// La pagina, vista dalla cucitura: qui e' un WebSocket vero.
///
/// La cucitura sta in `cucitura.dart` e non sa che trasporto ha sotto: sul
/// telefono e' questo, nel browser sono due pagine che si parlano. La
/// rinumerazione dei messaggi e' la stessa, ed e' l'unica cosa che conta.
class _LaPresa implements VersoLaPagina {
  _LaPresa(this._presa);

  final WebSocket _presa;

  @override
  bool get aperta => _presa.readyState == WebSocket.open;

  @override
  void manda(String testo) => _presa.add(testo);

  @override
  Future<void> chiudi() =>
      _presa.close(WebSocketStatus.goingAway, 'il filo e\' caduto');
}
