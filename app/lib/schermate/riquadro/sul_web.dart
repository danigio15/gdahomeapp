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
WebViewController costruisciIlControllore({
  required void Function() quandoCaricata,
  required void Function(String perche) quandoFallisce,
  required bool Function(String indirizzo) siPuoAndare,
  required Color sfondo,
}) {
  scheduleMicrotask(quandoCaricata);
  return WebViewController();
}

/// Sul web un `iframe` non si ricarica: si ricarica la pagina.
Future<void> ricarica(WebViewController controllore, Uri pagina) =>
    controllore.loadRequest(pagina);

/// Nel browser le barre del telefono non ci sono, e non c'e' niente da dire.
Future<void> diciLeMisure(
  WebViewController controllore, {
  required double alto,
  required double basso,
}) async {}

/// Apre la Config della plancia: quella vera, con `apriConfigEntita`.
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
Future<void> apriLaConfig(WebViewController controllore, Uri pagina) async {
  const maniglia = 'gdahomeApriLaConfig';
  final riquadri = web.document.querySelectorAll('iframe');
  for (var quale = 0; quale < riquadri.length; quale += 1) {
    final uno = riquadri.item(quale);
    /* `is` fra due tipi di interoperabilita' non guarda cosa c'e' davvero
     * sotto: `isA` si', ed e' quello che l'analizzatore chiede. */
    if (uno == null || !uno.isA<web.HTMLIFrameElement>()) continue;
    final dentro = (uno as web.HTMLIFrameElement).contentWindow;
    if (dentro == null) continue;
    try {
      if (!dentro.has(maniglia)) continue;
      dentro.callMethod(maniglia.toJS);
      return;
    } catch (_) {
      /* Un riquadro di un'altra origine non si guarda nemmeno: si passa al
       * prossimo. */
    }
  }
}

/// Nel browser il riquadro e' uno solo: la scelta della composizione e' di
/// Android.
Widget riquadroDelWebView(
  WebViewController controllore, {
  required bool ibrido,
}) => WebViewWidget(controller: controllore);
