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
import 'dart:typed_data';

import 'package:web/web.dart' as web;

import '../../ponte/errori.dart';
import '../../ponte/filo.dart';
import '../cucitura.dart';
import '../pannello.dart';
import '../premesse.dart';

/// Quanto si aspetta un file dal ponte. Come sul telefono: puo' passare dal
/// centralino con la casa dall'altra parte del paese.
const _attesaDellaCommissione = Duration(seconds: 90);

/// Il WebSocket finto, che la plancia usa credendo sia quello vero.
///
/// La plancia ospitata apre il filo e aspetta `auth_ok`; qui `send` e
/// `onmessage` passano dalla pagina che ospita. Si dichiarano anche
/// `addEventListener` e le costanti, perche' la plancia usa tutti e due i
/// modi — le proprieta' `on*` in un punto, gli ascoltatori in un altro — e
/// mancarne uno vuol dire una plancia che parte e non riceve mai niente.
const String _ilWebSocketFinto =
    '(function(){'
    'function Finto(_indirizzo,_protocolli){'
    'var io=this;'
    'this.readyState=0;this.url="gdahome://plancia";'
    'this.onopen=null;this.onmessage=null;this.onclose=null;this.onerror=null;'
    'this._ascolti={};'
    'Finto._aperti.push(this);'
    'this._chiama=function(che,evento){'
    'var suo=io["on"+che];if(suo)try{suo.call(io,evento);}catch(e){}'
    'var altri=io._ascolti[che]||[];'
    'for(var i=0;i<altri.length;i++)try{altri[i].call(io,evento);}catch(e){}'
    '};'
    'setTimeout(function(){'
    'if(io.readyState!==0)return;'
    'io.readyState=1;io._chiama("open",{type:"open"});'
    'parent.postMessage({che:"gdahome/ws-apri"},"*");'
    '},0);'
    '}'
    'Finto._aperti=[];'
    'Finto.prototype.addEventListener=function(che,quale){'
    '(this._ascolti[che]=this._ascolti[che]||[]).push(quale);};'
    'Finto.prototype.removeEventListener=function(che,quale){'
    'var altri=this._ascolti[che]||[];var dove=altri.indexOf(quale);'
    'if(dove>=0)altri.splice(dove,1);};'
    'Finto.prototype.send=function(testo){'
    'if(this.readyState!==1)return;'
    'parent.postMessage({che:"gdahome/ws-su",testo:String(testo)},"*");};'
    'Finto.prototype.close=function(){'
    'if(this.readyState>=2)return;'
    'this.readyState=3;'
    'this._chiama("close",{type:"close",code:1000,wasClean:true});};'
    'Finto.CONNECTING=0;Finto.OPEN=1;Finto.CLOSING=2;Finto.CLOSED=3;'
    'Finto.prototype.CONNECTING=0;Finto.prototype.OPEN=1;'
    'Finto.prototype.CLOSING=2;Finto.prototype.CLOSED=3;'
    'window.addEventListener("message",function(evento){'
    'var detto=evento.data;if(!detto)return;'
    'if(detto.che==="gdahome/ws-giu"){'
    'for(var i=0;i<Finto._aperti.length;i++){'
    'var uno=Finto._aperti[i];if(uno.readyState!==1)continue;'
    'uno._chiama("message",{type:"message",data:detto.testo});}}'
    'else if(detto.che==="gdahome/ws-chiudi"){'
    'for(var j=0;j<Finto._aperti.length;j++){'
    'var due=Finto._aperti[j];if(due.readyState>=2)continue;'
    'due.readyState=3;'
    'due._chiama("close",{type:"close",code:1006,wasClean:false});}}'
    '});'
    'return Finto;})()';

/// Quello che alla schermata serve sapere di un servitore, senza `dart:io`.
abstract interface class ServitoreDiQuestoSistema {
  Uri paginaDi(PannelloDellaPlancia pannello);
  Future<void> spegni();
  set leggera(bool valore);
  set tema(String quale);
  set barra(String come);
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

  @override
  set leggera(bool valore) => premesse.leggera = valore;
  @override
  set tema(String quale) => premesse.tema = quale;
  @override
  set barra(String come) => premesse.barra = come;
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
    _dalLavoratore = web.EventStreamProviders.messageEvent
        .forTarget(lavoratori)
        .listen(_arrivato);
    _dalRiquadro = web.EventStreamProviders.messageEvent
        .forTarget(web.window)
        .listen(_arrivato);
    return true;
  }

  @override
  Uri paginaDi(PannelloDellaPlancia quale) {
    premesse.pannello = quale;
    /* Assoluto, e risolto sulla base del documento.
     *
     * Assoluto perche' il riquadro vuole un indirizzo con lo schema: senza,
     * non apre niente e dice soltanto «manca lo schema». Sulla base del
     * documento — e non sulla radice del sito — perche' sotto l'ingress di
     * Home Assistant la radice non e' dove sta l'app. Il service worker
     * guarda dove il percorso **contiene** la cartella, non dove comincia, ed
     * e' per questo che regge tutti e due i casi. */
    return Uri.base.resolve(
      quale.percorsoDellaPagina(premesse.lingua).replaceFirst('/', ''),
    );
  }

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

  void _arrivato(web.MessageEvent evento) {
    final detto = evento.data.dartify();
    if (detto is! Map) return;
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

  void _apriLaCucitura() {
    if (_cucitura != null) return;
    final cucitura = Cucitura(_VersoIlRiquadro(), () async => _filo());
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
    try {
      final preso = await _chiedi(percorso);
      var corpo = preso.byte;
      var tipo = preso.tipo;
      /* La pagina della plancia si serve con le premesse: e' l'unico file che
       * si tocca, e non e' un file della dashboard — e' quello che si aggiunge
       * alla pagina servita. */
      if (tipo.startsWith('text/html')) {
        final scritta = premesse.conLePremesse(
          utf8.decode(corpo, allowMalformed: true),
          ilWebSocket: _ilWebSocketFinto,
        );
        corpo = utf8.encode(scritta);
        tipo = 'text/html; charset=utf-8';
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
    if (filo == null) throw const FiloCaduto('il filo non c\'e\'');
    final testo = await filo.testoDi({
      'type': 'ponte/http',
      'metodo': 'GET',
      'percorso': percorso,
      /* Nel browser il gzip non si apre: `dart:io` non c'e', e mettersi in
       * casa un decompressore per una cosa che il ponte sa gia' non fare e'
       * il modo lungo. Il ponte lo salta, e sul filo passa qualche byte in
       * piu' — che sulla rete di casa non si sente, e fuori casa e' il prezzo
       * di poter guardare la casa da un browser. */
      'senzaGzip': true,
    }, entro: _attesaDellaCommissione);
    final letto = jsonDecode(testo);
    final risposta = letto is Map ? letto['result'] : null;
    if (risposta is! Map) {
      throw const ComandoRifiutato('il ponte ha risposto una cosa strana');
    }
    if (risposta['compresso'] == 'gzip') {
      throw const ComandoRifiutato(
        'il ponte ha compresso, e qui non si apre: aggiorna l\'add-on',
      );
    }
    final corpo = risposta['corpo'];
    final stato = risposta['stato'];
    return (
      stato: stato is int ? stato : 502,
      tipo: risposta['tipo'] is String
          ? risposta['tipo'] as String
          : 'application/octet-stream',
      byte: corpo is String ? base64.decode(corpo) : const <int>[],
    );
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

  @override
  void manda(String testo) =>
      _aTutti({'che': 'gdahome/ws-giu', 'testo': testo});

  @override
  Future<void> chiudi() async => _aTutti({'che': 'gdahome/ws-chiudi'});

  /* A tutti i riquadri della pagina: ce n'e' uno solo — la plancia — e
   * cercarlo per nome vorrebbe dire legarsi a come il riquadro e' fatto. */
  void _aTutti(Map<String, Object?> cosa) {
    final riquadri = web.document.querySelectorAll('iframe');
    for (var quale = 0; quale < riquadri.length; quale += 1) {
      final uno = riquadri.item(quale);
      /* `is` non basta: fra due tipi che vivono in JavaScript risponde sempre
       * di si' senza guardare cosa c'e' davvero sotto. */
      if (uno == null || !uno.isA<web.HTMLIFrameElement>()) continue;
      (uno as web.HTMLIFrameElement).contentWindow?.postMessage(
        cosa.jsify(),
        '*'.toJS,
      );
    }
  }
}
