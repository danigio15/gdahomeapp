/// Il WebView sul web: un `iframe`, e niente da impostare.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';

import 'package:flutter/painting.dart' show Color;
import 'package:flutter/widgets.dart' show Widget;
import 'package:url_launcher/url_launcher.dart';
import 'package:web/web.dart' as web;
import 'package:webview_flutter/webview_flutter.dart';

import '../../casa/fuori.dart';
import '../../plancia/premesse.dart' show ilMenuDalRiquadro;

/// Un controllore pronto a caricare una pagina. Sul web sa fare solo quello:
/// non dice quando la pagina e' arrivata ne' se e' arrivata, quindi la si da'
/// per arrivata subito — il velo si toglie, e sotto il riquadro fa da se'.
/// Il fondo, [sfondo], qui non si imposta: e' un `iframe`, e il fondo e'
/// della pagina.
/// I tre dialoghi (`dice`, `chiede`, `faScrivere`) qui non si passano: in un
/// `iframe` li fa il browser, come li farebbe alla plancia dentro Home
/// Assistant. Stanno nella firma perche' la firma e' una sola. Per la stessa
/// ragione c'e' `quandoFotografaLaCasa` e qui non si usa: quella fotografia
/// la legge Android Auto, e in un browser Android Auto non c'e'.
WebViewController costruisciIlControllore({
  required void Function() quandoCaricata,
  required void Function(String perche) quandoFallisce,
  required bool Function(String indirizzo) siPuoAndare,
  required Color sfondo,
  Future<void> Function(String messaggio)? dice,
  Future<bool> Function(String domanda)? chiede,
  Future<String> Function(String domanda, String diSerie)? faScrivere,
  void Function(String pagina)? quandoCambiaPagina,
  void Function()? quandoChiedeIlMenu,
  void Function(String foto)? quandoFotografaLaCasa,
}) {
  final controllore = WebViewController();
  /* Chi va avvisato quando la pagina «arriva». Si tiene da parte perche'
   * serve **ogni volta** che si apre una pagina, non solo la prima: qui non
   * c'e' nessun «pagina finita» da ascoltare, e chi disegna resta dietro il
   * velo finche' qualcuno non gli dice che puo' togliersi. */
  _laFine[controllore] = quandoCaricata;
  scheduleMicrotask(quandoCaricata);
  if (quandoCambiaPagina != null || quandoChiedeIlMenu != null) {
    _ascoltaIlRiquadro(quandoCambiaPagina, quandoChiedeIlMenu);
  }
  return controllore;
}

final _laFine = Expando<void Function()>('quandoCaricata');

/// Apre una pagina nel riquadro.
///
/// Sul web l'`iframe` non dice quando ha finito, quindi la pagina si da' per
/// arrivata subito — come alla prima costruzione. **Non e' un dettaglio**: il
/// velo sopra il riquadro si alza quando arriva quell'avviso, e senza questa
/// riga cambiare pagina — scegliere un'altra plancia — lasciava «Apro la
/// plancia…» a schermo per sempre, con la plancia gia' aperta sotto.
Future<void> apriLaPagina(WebViewController controllore, Uri pagina) async {
  await controllore.loadRequest(pagina);
  final fine = _laFine[controllore];
  if (fine != null) scheduleMicrotask(fine);
}

/// Quello che il riquadro dice a chi lo ospita: quale pagina della plancia si
/// e' accesa, e che si vuole il menu dell'app.
///
/// Nel browser il riquadro e' un `iframe` e parla a chi lo ospita con un
/// messaggio; sul telefono c'e' un canale del WebView. La pagina prova tutte
/// e due le strade e non sa quale delle due c'e' (`premesse.dart`).
///
/// Si ascolta una volta sola: il riquadro puo' rinascere — cambia la
/// composizione, si ricarica — e un ascolto per ogni nascita vorrebbe dire
/// dieci ascolti che dicono la stessa cosa dieci volte.
bool _ascolto = false;

void _ascoltaIlRiquadro(
  void Function(String pagina)? quandoCambiaPagina,
  void Function()? quandoChiedeIlMenu,
) {
  if (_ascolto) return;
  _ascolto = true;
  web.window.addEventListener(
    'message',
    ((web.MessageEvent evento) {
      /* Solo da un riquadro di questa pagina: un'altra finestra — la pagina
       * che ha aperto l'app, una scheda aperta da lei — non apre il menu e
       * non sposta la plancia. L'origine qui non si guarda: nel collaudo la
       * plancia arriva da una porta sua. */
      if (!_daUnNostroRiquadro(evento)) return;
      final detto = evento.data;
      if (detto == null || !detto.isA<JSObject>()) return;
      final oggetto = detto as JSObject;
      try {
        final cosa = oggetto.getProperty('gdahome'.toJS)?.dartify();
        /* I tre trattini della plancia: aprono il menu dell'app, e sono la
         * porta del menu su questa schermata — sopra la plancia l'app non
         * disegna niente, perche' un `iframe` i tocchi se li mangia. */
        if (cosa == ilMenuDalRiquadro) {
          quandoChiedeIlMenu?.call();
          return;
        }
        if (cosa != 'pagina') return;
        final dove = oggetto.getProperty('dove'.toJS)?.dartify();
        if (dove is String && dove.isNotEmpty) quandoCambiaPagina?.call(dove);
      } catch (_) {
        /* Un messaggio di qualcun altro, fatto in un altro modo: non e'
         * nostro e non ci riguarda. */
      }
    }).toJS,
  );
}

/// Se chi ha scritto e' la finestra dentro uno degli `iframe` di questa
/// pagina.
bool _daUnNostroRiquadro(web.MessageEvent evento) {
  final fonte = evento.source;
  if (fonte == null) return false;
  final riquadri = web.document.querySelectorAll('iframe');
  for (var quale = 0; quale < riquadri.length; quale += 1) {
    final uno = riquadri.item(quale);
    if (uno == null || !uno.isA<web.HTMLIFrameElement>()) continue;
    final dentro = (uno as web.HTMLIFrameElement).contentWindow;
    if (dentro != null && dentro.strictEquals(fonte).toDart) return true;
  }
  return false;
}

/// Sul web un `iframe` non si ricarica: si riapre la pagina.
///
/// E si riapre con [apriLaPagina], non con `loadRequest`: e' la stessa cosa
/// piu' l'avviso che la pagina e' arrivata, e senza quell'avviso il velo
/// sopra il riquadro non si alza mai piu'. Il velo si mette **prima** di
/// ricaricare — lo mette chi disegna la schermata — e qui non c'e' nessun
/// «pagina finita» da ascoltare: chi la apre e' anche chi deve dire che c'e'.
Future<void> ricarica(WebViewController controllore, Uri pagina) =>
    apriLaPagina(controllore, pagina);

/// Nel browser le barre del telefono non ci sono, e non c'e' niente da dire.
Future<void> diciLeMisure(
  WebViewController controllore, {
  required double alto,
  required double basso,
}) async {}

/// Il parcheggio, nel browser: non si fa, e la ragione e' che non serve.
///
/// Sul telefono la plancia sta in un WebView che Android compone per conto
/// suo, e continuare a disegnare sotto una schermata che non la mostra costa
/// davvero. Nel browser sta in una cornice che, quando l'app mostra un'altra
/// schermata, il browser non disegna: il lavoro se lo risparmia lui. E se la
/// scheda intera passa in secondo piano, la plancia se ne accorge da se' —
/// `document.visibilityState`, che nel browser dice la verita'.
///
/// C'e' e non fa niente, come `diciLeMisure`: le due parti dell'app chiamano
/// le stesse cose, e quale delle due abbia qualcosa da fare lo decide il file,
/// non chi chiama.
Future<void> parcheggia(
  WebViewController controllore,
  bool parcheggiata,
) async {}

/// Consegna alla pagina del quadro il codice che apre il cruscotto.
///
/// **Anche nel browser, e non era scontato.** Una stesura di questo file
/// diceva che qui non serviva: la pagina del quadro sta in un `iframe` di
/// un'altra origine, e il codice il browser se lo sarebbe tenuto nel suo
/// deposito, battuto una volta sola nella vita di quel browser. Non e'
/// cosi', e si e' visto dal campo: il cruscotto lo chiedeva **a ogni**
/// apertura. Il deposito di una pagina che sta dentro il riquadro di un
/// altro sito e' a parte — Safari lo separa da anni, Chrome dal 2023 — e a
/// volte non dura nemmeno la sessione. Quindi la si consegna, come sul
/// telefono e come fa la tessera dentro Home Assistant
/// (`ponte/carta/plancia.js`): un `postMessage` con la stessa forma, che la
/// pagina ascolta gia'.
///
/// **A chi.** Al riquadro che ha aperto [pagina], e a nessun altro: il
/// secondo argomento di `postMessage` e' l'origine del quadro, cosi' il
/// messaggio lo legge quella pagina e basta, anche se un giorno nel
/// documento ci finisse un altro riquadro. Il riquadro si riconosce
/// dall'indirizzo che gli e' stato dato — il cruscotto e la gestione sono due
/// riquadri sulla stessa origine, con due codici diversi, e il codice di uno
/// non deve finire nell'altro.
///
/// **Quando.** Sul `load` del riquadro, che per una pagina scritta in un file
/// solo vuol dire a script gia' letto, e ascoltatore gia' attaccato; e tre
/// colpi dopo per sicurezza, come fa la tessera. Il riquadro puo' non
/// esserci ancora quando si arriva qui: `quandoCaricata` nel browser scatta
/// subito, e la vista attacca il riquadro al documento al fotogramma dopo.
/// Allora lo si aspetta, per qualche secondo, e poi ci si arrende in
/// silenzio — la pagina il codice lo chiede da se', come ha sempre fatto.
Future<void> consegnaLaChiave(
  WebViewController controllore,
  String chiave, {
  required Uri pagina,
}) async {
  if (chiave.isEmpty) return;
  _rispondiAChiChiedeLaChiave(pagina, chiave);
  final dove = pagina.toString();
  for (final fra in const [0, 100, 300, 700, 1500, 3000, 6000]) {
    if (fra > 0) await Future<void>.delayed(Duration(milliseconds: fra));
    final riquadro = _ilRiquadroDi(dove);
    if (riquadro == null) continue;
    /* Il codice sta sull'elemento, e l'ascoltatore lo rilegge da li' a ogni
     * `load`: cosi' un codice arrivato dopo — la home lo richiede finche'
     * non ce l'ha — prende il posto di quello di prima senza un secondo
     * ascoltatore, e una pagina ricaricata riceve sempre l'ultimo. Un
     * ascoltatore per riquadro, attaccato una volta. */
    riquadro.setAttribute(_consegnato, chiave);
    if (!riquadro.hasAttribute(_inAscolto)) {
      riquadro.setAttribute(_inAscolto, 'sì');
      riquadro.addEventListener(
        'load',
        ((web.Event _) => _consegnaA(
          riquadro.contentWindow,
          riquadro.getAttribute(_consegnato) ?? '',
          pagina,
        )).toJS,
      );
    }
    _consegnaA(riquadro.contentWindow, chiave, pagina);
    return;
  }
}

/// E la stessa consegna dall'altro verso: la pagina **chiede**, e qui si
/// risponde.
///
/// La consegna a spinta qui sopra ha un punto debole che dal campo si e'
/// visto: chi ospita deve trovare il riquadro e indovinare il momento, e
/// nell'app web una delle due cose non tornava — il cruscotto restava a
/// chiedere il codice a chi ce l'aveva gia' in mano. Allora la pagina del
/// quadro, appena si apre senza codice, manda `{gdahome: "chiave?"}` a chi
/// la contiene e a chi l'ha aperta, finche' qualcuno risponde. Qui si
/// risponde: a **quella** pagina (`evento.source`), con il codice che vale
/// per la **sua** origine, e a nessun'altra. Un ascolto solo, per tutta la
/// vita dell'app; il codice per origine si aggiorna a ogni consegna, cosi'
/// una pagina riaperta riceve sempre l'ultimo.
final Map<String, String> _codiciPerOrigine = {};
bool _rispondo = false;

void _rispondiAChiChiedeLaChiave(Uri pagina, String chiave) {
  _codiciPerOrigine[pagina.origin] = chiave;
  if (_rispondo) return;
  _rispondo = true;
  web.window.addEventListener(
    'message',
    ((web.MessageEvent evento) {
      try {
        final detto = evento.data;
        if (detto == null || !detto.isA<JSObject>()) return;
        final cosa = (detto as JSObject).getProperty('gdahome'.toJS)?.dartify();
        if (cosa != 'chiave?') return;
        final codice = _codiciPerOrigine[evento.origin] ?? '';
        final fonte = evento.source;
        if (codice.isEmpty || fonte == null) return;
        (fonte as web.Window).postMessage(
          {'gdahome': 'chiave', 'chiave': codice}.jsify(),
          evento.origin.toJS,
        );
      } catch (_) {
        /* Un messaggio di qualcun altro, o una pagina gia' andata: niente
         * da rispondere a nessuno. */
      }
    }).toJS,
  );
}

/// L'attributo in cui il riquadro tiene l'ultimo codice da consegnare.
const String _consegnato = 'data-gdahome-chiave';

/// E quello che dice che l'ascoltatore del `load` c'e' gia'.
const String _inAscolto = 'data-gdahome-ascolta';

/// Il riquadro che ha aperto quell'indirizzo, se e' gia' nel documento.
web.HTMLIFrameElement? _ilRiquadroDi(String dove) {
  final riquadri = web.document.querySelectorAll('iframe');
  for (var quale = 0; quale < riquadri.length; quale += 1) {
    final uno = riquadri.item(quale);
    if (uno == null || !uno.isA<web.HTMLIFrameElement>()) continue;
    final riquadro = uno as web.HTMLIFrameElement;
    if (riquadro.src.startsWith(dove)) return riquadro;
  }
  return null;
}

/// Tre colpi a distanza crescente, come la tessera: `load` dice che il
/// documento c'e', non che il suo ascoltatore ci sia gia'.
void _consegnaA(web.Window? finestra, String chiave, Uri pagina) {
  if (finestra == null || chiave.isEmpty) return;
  final origine = pagina.origin;
  void manda() {
    try {
      finestra.postMessage(
        {'gdahome': 'chiave', 'chiave': chiave}.jsify(),
        origine.toJS,
      );
    } catch (_) {
      /* La pagina se n'e' andata mentre aspettavamo: non c'e' niente da
       * dire a nessuno. */
    }
  }

  manda();
  for (final fra in const [300, 1500]) {
    Timer(Duration(milliseconds: fra), manda);
  }
}

/// Apre il cruscotto in una scheda del browser, col codice dietro.
///
/// `url_launcher` apre la scheda con `noopener`, che e' la cosa giusta per
/// un collegamento qualunque: la pagina nuova non puo' toccare questa. Ma
/// cosi' non le si puo' nemmeno parlare, e il codice resterebbe qui — ed e'
/// il motivo per cui dal browser il cruscotto lo richiedeva. Il quadro e' una
/// pagina nostra: si apre tenendo la maniglia, e le si consegna il codice
/// come al riquadro. Piu' colpi, e piu' lontani: una scheda nuova non dice
/// quando ha finito di leggere, e su un telefono ci mette qualche secondo.
///
/// Se il browser la scheda non la apre — un blocco dei popup, che qui non
/// dovrebbe scattare perche' si arriva da un tocco — si ripiega sulla via di
/// prima, e il codice lo si batte.
///
/// La maniglia si tiene **solo quando c'e' un codice da consegnare**, e solo
/// verso un quadro in `https` (lo decide chi chiama, `eUnQuadroSicuro`):
/// senza codice la scheda si apre con `noopener`, come un collegamento
/// qualunque. Con la maniglia la pagina aperta sa chi l'ha aperta, e per
/// questo qui nessun messaggio si accetta da una finestra che non sia quella
/// giusta (`servitore_qui/sul_web.dart`).
Future<void> apriFuori(Uri pagina, String chiave) async {
  if (!siApreFuori(pagina)) return;
  if (chiave.isNotEmpty) _rispondiAChiChiedeLaChiave(pagina, chiave);
  /* Senza il codice non serve la maniglia: la scheda si apre come un
   * collegamento qualunque, `noopener` e `noreferrer` — non sa chi l'ha
   * aperta e non la puo' toccare. */
  if (chiave.isEmpty) {
    await launchUrl(pagina, mode: LaunchMode.externalApplication);
    return;
  }
  web.Window? finestra;
  try {
    finestra = web.window.open(pagina.toString(), '_blank');
  } catch (_) {
    finestra = null;
  }
  if (finestra == null) {
    await launchUrl(pagina, mode: LaunchMode.externalApplication);
    return;
  }
  if (chiave.isEmpty) return;
  for (final fra in const [400, 1200, 2500, 5000, 9000]) {
    await Future<void>.delayed(Duration(milliseconds: fra));
    _consegnaA(finestra, chiave, pagina);
  }
}

/// Apre la Configurazione della plancia: la sua pagina, quella vera.
///
/// Nel browser il riquadro e' un `iframe`, e la plancia arriva dallo stesso
/// posto da cui arriva l'app — il service worker, sotto la stessa origine —
/// quindi la si chiama per mano: la maniglia che il servitore ha messo in
/// fondo alla pagina (`Premesse.laConfigFuoriDallaPlancia`) sta li' dentro,
/// e da qui si tira.
///
/// Non si passa dall'indirizzo: cambiare il solo pezzo dopo il cancelletto
/// non ricarica niente — e' cosi' che funziona un ancoraggio — e la pagina
/// non se ne accorgerebbe. Si prova su ogni riquadro: quello della plancia
/// e' l'unico che la maniglia ce l'ha.
Future<void> apriLaConfig(WebViewController controllore, Uri pagina) async =>
    _tira('gdahomeApriLaConfig', 'apri-la-config');

/// Riporta la plancia dov'era prima della Configurazione.
Future<void> tornaDallaConfig(WebViewController controllore) async =>
    _tira('gdahomeTornaDallaConfig', 'torna-dalla-config');

/// Passa alla plancia un dispositivo appena abbinato (#54, passo 4).
///
/// Qui non si tira nessuna maniglia: si **bussa**, e basta. Il foglietto della
/// plancia un messaggio se lo aspetta gia' — e' la strada con cui il guscio
/// parla col suo ospite — e quella strada attraversa le origini, mentre
/// chiamare una funzione dentro un riquadro di un'altra origine no.
///
/// Il messaggio si manda **a tutti i riquadri**: quello della plancia lo
/// riconosce dal marchio e dall'azione, gli altri lo lasciano cadere. E dal
/// di la' si guarda che arrivi dal proprio ospite: e' la stessa regola con cui
/// gia' oggi si passano le premesse.
Future<void> doveLoMetto(
  WebViewController controllore,
  String dispositivo,
) async {
  final detto = <String, Object?>{
    'source': 'dashboardmodern-host',
    'action': 'dove-lo-metto',
    'dispositivo': jsonDecode(dispositivo),
  };
  final riquadri = web.document.querySelectorAll('iframe');
  for (var quale = 0; quale < riquadri.length; quale += 1) {
    final uno = riquadri.item(quale);
    if (uno == null || !uno.isA<web.HTMLIFrameElement>()) continue;
    final dentro = (uno as web.HTMLIFrameElement).contentWindow;
    if (dentro == null) continue;
    try {
      dentro.postMessage(detto.jsify(), '*'.toJS);
    } catch (_) {
      /* Un riquadro che non si lascia parlare non e' il nostro. */
    }
  }
}

/// Tira una delle maniglie che il servitore ha messo nella pagina servita.
///
/// Due strade per la stessa cosa, e la seconda non e' un lusso.
///
/// La prima e' **chiamare** la funzione dentro il riquadro: e' immediata, e
/// funziona finche' la pagina e l'app stanno sulla stessa origine — in casa
/// e' cosi', perche' la plancia la serve il service worker dell'app.
///
/// Dove non lo e', il browser non lascia nemmeno guardare se quella funzione
/// esiste: solleva, e prima qui si passava al riquadro dopo — che non c'e' —
/// e il tasto «Configurazione» non faceva niente senza dire niente. Succede
/// nel collaudo, dove la plancia arriva da una porta sua perche' nel browser
/// un server dentro la pagina non si apre; e basta che un giorno la plancia
/// stia altrove perche' succeda anche in casa.
///
/// Allora, quando la chiamata non arriva, si **bussa**: un messaggio
/// attraversa le origini, e la pagina servita sa cosa farne
/// (`Premesse.laConfigFuoriDallaPlancia`).
void _tira(String maniglia, String ordine) {
  final riquadri = web.document.querySelectorAll('iframe');
  for (var quale = 0; quale < riquadri.length; quale += 1) {
    final uno = riquadri.item(quale);
    /* `is` fra due tipi di interoperabilita' non guarda cosa c'e' davvero
     * sotto: `isA` si', ed e' quello che l'analizzatore chiede. */
    if (uno == null || !uno.isA<web.HTMLIFrameElement>()) continue;
    final dentro = (uno as web.HTMLIFrameElement).contentWindow;
    if (dentro == null) continue;
    try {
      if (dentro.has(maniglia)) {
        dentro.callMethod(maniglia.toJS);
        return;
      }
      /* La finestra si guarda, e quella maniglia non ce l'ha: non e' la
       * plancia, e non c'e' niente da bussarle. */
      continue;
    } catch (_) {
      /* Un riquadro di un'altra origine non si lascia guardare. Non vuol dire
       * che non sia il nostro: si bussa. */
    }
    try {
      dentro.postMessage({'gdahome': ordine}.jsify(), '*'.toJS);
    } catch (_) {
      /* Se non si puo' nemmeno bussare, quel riquadro non e' raggiungibile:
       * si passa al prossimo. */
    }
  }
}

/// Nel browser il riquadro e' uno solo: la scelta della composizione e' di
/// Android.
Widget riquadroDelWebView(
  WebViewController controllore, {
  required bool ibrido,
}) => WebViewWidget(controller: controllore);
