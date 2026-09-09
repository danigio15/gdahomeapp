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
import 'pannello.dart';

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

/// I comandi di Home Assistant che dopo la risposta continuano a mandare
/// eventi con lo stesso numero. Per questi l'instradamento resta; per tutti
/// gli altri si toglie appena arriva la risposta, se no un telefono che tiene
/// la plancia aperta per giorni si porterebbe dietro un numero per ogni
/// comando mai mandato.
const _cheContinuano = {
  'subscribe_events',
  'subscribe_trigger',
  'render_template',
  'history/stream',
  'camera/webrtc/offer',
  'camera/web_rtc_offer',
};

class Servitore {
  Servitore({
    required TrovaIlFilo filo,
    required this.cartella,
    this.lingua = 'it',
    this.portaAperta = false,
    this.leggera = false,
    void Function(String)? racconta,
  }) : _trovaIlFilo = filo,
       _racconta = racconta ?? ((_) {});

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
  ({double alto, double basso}) margini = (alto: 0, basso: 0);

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
  bool leggera;

  /// Il tema della plancia su questo dispositivo: `auto`, `chiaro`, `scuro`.
  String tema = 'auto';

  /// Come sta la barra in fondo alla plancia: `scomparsa` o `fissa`.
  String barra = 'scomparsa';

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
  PannelloDellaPlancia? pannello;

  HttpServer? _server;
  final _inArrivo = <String, Future<_Scaricato>>{};
  final _cuciture = <_Cucitura>{};

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
      final cucitura = _Cucitura(this, presa);
      _cuciture.add(cucitura);
      cucitura.avvia().whenComplete(() => _cuciture.remove(cucitura));
      return;
    }

    if (percorso.startsWith(_fissi)) {
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
  /// Lo stile della plancia leggera: si mette in testa alla pagina, dopo
  /// le premesse, e vince su tutto con `!important`.
  static const String stileLeggero =
      '<style id="gdahome-leggera">'
      '*,*::before,*::after{animation-iteration-count:1!important}'
      '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'
      '</style>';

  /// Le misure delle barre del telefono, e cosa farne.
  ///
  /// Tre righe, e ognuna toglie un'aria di troppo: il contenuto comincia un
  /// dito sotto l'orologio invece di due, finisce un dito sopra i tasti, e la
  /// barra della plancia si appoggia sopra i tasti invece di restare a
  /// mezz'aria. Il resto della pagina — i margini ai lati, tutto il suo
  /// disegno — non si tocca.
  ///
  /// Va **in fondo alla pagina**, non in testa, e con un selettore piu' lungo
  /// del necessario. La plancia scrive le sue misure con `!important`, e fra
  /// due `!important` della stessa forza vince l'ultimo che si legge: messo
  /// in testa, il mio perdeva e la barra della plancia finiva sotto i tasti
  /// del telefono. Le regole senza `!important` — i margini in cima — invece
  /// vincevano lo stesso, ed e' per questo che il difetto si vedeva solo in
  /// fondo.
  String get stileDelleMisure =>
      '<style id="gdahome-misure">'
      ':root{--gdahome-alto:${margini.alto.round()}px;'
      '--gdahome-basso:${margini.basso.round()}px}'
      'html body .app{padding-top:calc(var(--gdahome-alto) + 8px)!important;'
      'padding-bottom:calc(var(--gdahome-basso) + 40px)!important}'
      /* La barra della plancia si alza sopra i tasti del telefono, **in
       * tutti e due i modi in cui puo' stare li'**: ferma, che e' come sta
       * di solito, o chiamata dalla maniglia. La prima volta avevo scritto
       * solo il secondo, e sul telefono — dove la barra e' ferma — non
       * cambiava niente: la classe che aspettavo non c'era. Nascosta resta
       * dov'e', che fuori dallo schermo e' fuori dallo schermo. */
      'html body.cd-nav-fixed nav.tabs.bottom-nav-bar,'
      'html body nav.tabs.bottom-nav-bar.visible{'
      'bottom:calc(var(--gdahome-basso) + 8px)!important}'
      /* Con la barra ferma la pagina lascia gia' il posto sotto: gliene si
       * lascia altrettanto piu' i tasti. */
      'html body.cd-nav-fixed{'
      'padding-bottom:calc(var(--gdahome-basso) + 112px)!important}'
      'html body .bottom-nav-handle{'
      'bottom:calc(var(--gdahome-basso) + 6px)!important}'
      /* Solo dove c'e' un puntatore vero: su un telefono il «sopra» non
       * esiste, e un dito che sfiora non deve tirare su la barra. */
      '@media (hover:hover) and (pointer:fine){'
      'html body nav.tabs.bottom-nav-bar:hover{'
      'bottom:calc(var(--gdahome-basso) + 20px)!important}}'
      '</style>';

  /// Toglie dalla plancia la sua Config, e dice dov'e' andata.
  ///
  /// La configurazione della casa adesso sta nel menu dell'app: tenerne due,
  /// una qui e una li', vorrebbe dire due posti dove cambiare la stessa cosa e
  /// due occasioni di trovarla diversa. Quella della plancia sparisce.
  ///
  /// **Non si tocca un file della dashboard.** I file restano quelli
  /// pubblicati — e devono restarlo, che il ponte li ricontrolla uno per uno
  /// (vedi `ponte/src/provenienza.js`) e una plancia con un file cambiato si
  /// direbbe modificata. Qui si aggiunge soltanto qualcosa **alla pagina
  /// servita**, che e' lo stesso posto da cui la plancia riceve gia' le misure
  /// delle barre del telefono.
  ///
  /// Si toglie in due modi insieme, e servono tutti e due: lo stile fa sparire
  /// la voce dalla barra e la sua pagina, e il pezzo di programma chiude
  /// l'editor se qualcosa riesce ad aprirlo lo stesso — la plancia ha piu' di
  /// una strada per arrivarci, e nasconderne una sola vorrebbe dire trovarsi
  /// l'editor addosso da un'altra.
  String get senzaConfig =>
      '<style id="gdahome-senza-config">'
      '#tab-config,#page-config,.tab[data-tab="config"]{display:none!important}'
      '#editor-modal,#cd-entpick{display:none!important}'
      '</style>'
      '<script>(function(){'
      'var chiudi=function(){'
      'var quali=["editor-modal","cd-entpick"];'
      'for(var i=0;i<quali.length;i++){'
      'var uno=document.getElementById(quali[i]);if(uno)uno.remove();}'
      '};'
      /* Un osservatore e non un controllo ogni tanto: l'editor si apre
       * mettendo un nodo nel corpo della pagina, e un osservatore se ne
       * accorge nello stesso fotogramma. Un controllo a tempo lo lascerebbe
       * vedere per un attimo, ed e' proprio l'attimo in cui uno ci mette il
       * dito. */
      'if(window.MutationObserver){'
      'new MutationObserver(chiudi).observe(document.documentElement,'
      '{childList:true,subtree:true});}'
      'document.addEventListener("DOMContentLoaded",chiudi);'
      'chiudi();'
      '})();</script>';

  /// Il tema e la barra, scritti dove la plancia se li aspetta.
  ///
  /// Sono di **questo dispositivo** — il tablet in cucina puo' stare sullo
  /// scuro mentre il telefono segue il sistema — e la dashboard li tiene
  /// apposta fuori dalle chiavi che si sincronizzano. Quando la sua Config
  /// sparisce, li tiene l'app; e siccome la plancia li legge dal deposito
  /// locale della pagina, glieli si scrive li' **prima** che parta, se no li
  /// legge vuoti e poi cambia colore sotto gli occhi.
  String get leMieMisureDellaPlancia {
    final quale = switch (tema) {
      'chiaro' => 'light',
      'scuro' => 'dark',
      _ => 'auto',
    };
    final come = barra == 'fissa' ? 'fixed' : 'auto';
    return '<script>try{'
        'localStorage.setItem("cd_theme",${jsonEncode(quale)});'
        'localStorage.setItem("cd_navbar_mode",${jsonEncode(come)});'
        '}catch(e){}</script>';
  }

  String conLePremesse(String pagina) {
    final quale = pannello;
    final premessa =
        '<script>'
        'window.__DASHBOARDMODERN_HOSTED__=true;'
        'window.__DASHBOARDMODERN_BRIDGE_WS__=(function(Vera){'
        'var dove=(location.protocol==="https:"?"wss://":"ws://")+location.host+"/api/websocket";'
        'function Cucita(_indirizzo,protocolli){'
        'return protocolli===undefined?new Vera(dove):new Vera(dove,protocolli);}'
        'Cucita.prototype=Vera.prototype;'
        'Cucita.CONNECTING=0;Cucita.OPEN=1;Cucita.CLOSING=2;Cucita.CLOSED=3;'
        'return Cucita;})(window.WebSocket);'
        'window.__DASHBOARDMODERN_INSTANCE__=${jsonEncode(quale?.istanza ?? '')};'
        'window.__DASHBOARDMODERN_PROFILE__=${jsonEncode(quale?.profilo ?? 'primary')};'
        'window.__DASHBOARDMODERN_PRIMARY__=${quale?.primario ?? true};'
        'window.__DASHBOARDMODERN_LOCALE__=${jsonEncode(lingua)};'
        'window.__GDAHOME__=true;'
        '</script>'
        '$leMieMisureDellaPlancia'
        '${leggera ? stileLeggero : ''}';
    final testa = RegExp(
      r'<head[^>]*>',
      caseSensitive: false,
    ).firstMatch(pagina);
    final conLaPremessa = testa == null
        ? '$premessa$pagina'
        : pagina.replaceRange(testa.end, testa.end, premessa);

    /* Le misure e la Config tolta vanno in fondo: vedi [stileDelleMisure],
     * che spiega perche' in testa perdevano contro lo stile della plancia. */
    final inFondo = '$stileDelleMisure$senzaConfig';
    final fine = RegExp(
      r'</body\s*>',
      caseSensitive: false,
    ).firstMatch(conLaPremessa);
    if (fine == null) return '$conLaPremessa$inFondo';
    return conLaPremessa.replaceRange(fine.start, fine.start, inFondo);
  }

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

/// Un WebSocket della pagina, cucito sul filo dell'app.
///
/// Dalla parte della pagina si comporta come il ponte del pannello di Home
/// Assistant: dice `auth_ok` e basta, appena il filo c'e'. Non c'e' niente da
/// autenticare — il filo lo e' gia', e la porta ha la sua chiave — e la
/// plancia ospitata in un punto aspetta `auth_ok` senza mandare nessun
/// `auth`. Un `auth` che arriva lo stesso si lascia cadere. Da li' in poi ogni
/// messaggio va sul filo col numero del filo e torna col numero della pagina.
///
/// Quando il filo cade, la pagina si vede chiudere il WebSocket: e' quello che
/// vedrebbe con Home Assistant, e sa cosa fare — riprova da sola dopo cinque
/// secondi, e ricomincia da capo con le sue sottoscrizioni.
class _Cucitura {
  _Cucitura(this._servitore, this._presa);

  final Servitore _servitore;
  final WebSocket _presa;
  final _numeri = <int, int>{};
  final _finita = Completer<void>();

  Filo? _filo;
  StreamSubscription<StatoDelFilo>? _guardaIlFilo;
  bool _dentro = false;

  Future<void> avvia() {
    _presa.listen(
      (dynamic grezzo) => unawaited(_dallaPagina(grezzo)),
      onDone: _pagina,
      onError: (Object _) => _pagina(),
      cancelOnError: true,
    );
    unawaited(_entra());
    return _finita.future;
  }

  Future<void> _dallaPagina(dynamic grezzo) async {
    if (grezzo is! String) return;
    final Map<String, dynamic> detto;
    try {
      final letto = jsonDecode(grezzo);
      if (letto is! Map<String, dynamic>) return;
      detto = letto;
    } catch (_) {
      return;
    }

    /* Un `auth` non serve a niente qui, e prima di `auth_ok` non si
     * ascolta: quello che arriva prima lo manda una pagina che non ha
     * aspettato, e non e' un comando. */
    if (!_dentro || detto['type'] == 'auth') return;

    final filo = _filo;
    if (filo == null || !filo.dentro) {
      await chiudi();
      return;
    }

    final suo = detto['id'];
    if (suo is! int) return;
    final tipo = detto['type'];
    final messaggio = Map<String, dynamic>.of(detto)..remove('id');

    /* Una disdetta parla del numero della sottoscrizione, e quel numero e' il
     * suo: va tradotto nel nostro, e poi dimenticato. */
    if (tipo == 'unsubscribe_events') {
      final quale = messaggio['subscription'];
      final mio = quale is int ? _numeri.remove(quale) : null;
      if (mio != null) {
        messaggio['subscription'] = mio;
        filo.dimentica(mio);
      }
    }

    try {
      late final int mio;
      mio = filo.instrada(messaggio, (risposta) {
        /* Il testo cosi' com'e' arrivato, col suo numero rimesso in testa:
         * niente da aprire e richiudere, che su un `get_states` grosso era
         * un decimo di secondo di schermo fermo. */
        _mandaTesto(risposta.conNumero(suo));
        /* Un comando che ha avuto la sua risposta e non manda eventi non
         * serve piu' a nessuno. */
        if (risposta.tipo == 'result' &&
            (tipo is! String ||
                !_continua(tipo) ||
                risposta.successo != true)) {
          filo.dimentica(mio);
          _numeri.remove(suo);
        }
      });
      _numeri[suo] = mio;
    } on FiloCaduto {
      await chiudi();
    }
  }

  static bool _continua(String tipo) =>
      _cheContinuano.contains(tipo) || tipo.startsWith('subscribe_');

  Future<void> _entra() async {
    final filo = await _servitore._filoPronto();
    if (_finita.isCompleted) return;
    if (filo == null) {
      _manda({'type': 'auth_invalid', 'message': 'la casa non risponde'});
      await chiudi();
      return;
    }
    _filo = filo;
    _dentro = true;
    _guardaIlFilo = filo.stato.listen((stato) {
      if (stato != StatoDelFilo.dentro) unawaited(chiudi());
    });
    _manda({'type': 'auth_ok', 'ha_version': 'gdahome'});
  }

  void _manda(Map<String, dynamic> cosa) => _mandaTesto(jsonEncode(cosa));

  void _mandaTesto(String testo) {
    if (_presa.readyState != WebSocket.open) return;
    try {
      _presa.add(testo);
    } catch (_) {
      /* Chiusa fra il controllo e la scrittura. */
    }
  }

  /// La pagina se n'e' andata.
  void _pagina() {
    _dimenticaTutto();
    if (!_finita.isCompleted) _finita.complete();
  }

  /// Si chiude da questa parte: il filo e' caduto, o il servitore si spegne.
  Future<void> chiudi() async {
    _dimenticaTutto();
    try {
      await _presa.close(WebSocketStatus.goingAway, 'il filo e\' caduto');
    } catch (_) {
      /* Gia' chiusa. */
    }
    if (!_finita.isCompleted) _finita.complete();
  }

  void _dimenticaTutto() {
    unawaited(_guardaIlFilo?.cancel());
    _guardaIlFilo = null;
    final filo = _filo;
    if (filo != null) {
      for (final mio in _numeri.values) {
        filo.dimentica(mio);
      }
    }
    _numeri.clear();
  }
}
