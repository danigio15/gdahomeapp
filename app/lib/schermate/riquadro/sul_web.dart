/// Il WebView sul web: un `iframe`, e niente da impostare.
library;

import 'dart:async';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';

import 'package:flutter/painting.dart' show Color;
import 'package:flutter/widgets.dart' show Widget;
import 'package:web/web.dart' as web;
import 'package:webview_flutter/webview_flutter.dart';

/// Un controllore pronto a caricare una pagina. Sul web sa fare solo quello:
/// non dice quando la pagina e' arrivata ne' se e' arrivata, quindi la si da'
/// per arrivata subito — il velo si toglie, e sotto il riquadro fa da se'.
/// Il fondo, [sfondo], qui non si imposta: e' un `iframe`, e il fondo e'
/// della pagina.
/// I tre dialoghi (`dice`, `chiede`, `faScrivere`) qui non si passano: in un
/// `iframe` li fa il browser, come li farebbe alla plancia dentro Home
/// Assistant. Stanno nella firma perche' la firma e' una sola.
WebViewController costruisciIlControllore({
  required void Function() quandoCaricata,
  required void Function(String perche) quandoFallisce,
  required bool Function(String indirizzo) siPuoAndare,
  required Color sfondo,
  Future<void> Function(String messaggio)? dice,
  Future<bool> Function(String domanda)? chiede,
  Future<String> Function(String domanda, String diSerie)? faScrivere,
  void Function(String pagina)? quandoCambiaPagina,
}) {
  final controllore = WebViewController();
  /* Chi va avvisato quando la pagina «arriva». Si tiene da parte perche'
   * serve **ogni volta** che si apre una pagina, non solo la prima: qui non
   * c'e' nessun «pagina finita» da ascoltare, e chi disegna resta dietro il
   * velo finche' qualcuno non gli dice che puo' togliersi. */
  _laFine[controllore] = quandoCaricata;
  scheduleMicrotask(quandoCaricata);
  if (quandoCambiaPagina != null) _ascoltaIlRiquadro(quandoCambiaPagina);
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

/// Quale pagina della plancia si e' accesa, detta dal riquadro.
///
/// Nel browser il riquadro e' un `iframe` e parla a chi lo ospita con un
/// messaggio; sul telefono c'e' un canale del WebView. La pagina prova tutte
/// e due le strade e non sa quale delle due c'e' (`premesse.dart`).
///
/// Si ascolta una volta sola: il riquadro puo' rinascere — cambia la
/// composizione, si ricarica — e un ascolto per ogni nascita vorrebbe dire
/// dieci ascolti che dicono la stessa cosa dieci volte.
bool _ascolto = false;

void _ascoltaIlRiquadro(void Function(String pagina) quandoCambiaPagina) {
  if (_ascolto) return;
  _ascolto = true;
  web.window.addEventListener(
    'message',
    ((web.MessageEvent evento) {
      final detto = evento.data;
      if (detto == null || !detto.isA<JSObject>()) return;
      final oggetto = detto as JSObject;
      try {
        if (oggetto.getProperty('gdahome'.toJS)?.dartify() != 'pagina') return;
        final dove = oggetto.getProperty('dove'.toJS)?.dartify();
        if (dove is String && dove.isNotEmpty) quandoCambiaPagina(dove);
      } catch (_) {
        /* Un messaggio di qualcun altro, fatto in un altro modo: non e'
         * nostro e non ci riguarda. */
      }
    }).toJS,
  );
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
