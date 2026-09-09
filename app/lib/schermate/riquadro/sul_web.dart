/// Il WebView sul web: un `iframe`, e niente da impostare.
library;

import 'dart:async';

import 'package:flutter/painting.dart' show Color;
import 'package:flutter/widgets.dart' show Widget;
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

/// Nel browser il riquadro e' uno solo: la scelta della composizione e' di
/// Android.
Widget riquadroDelWebView(
  WebViewController controllore, {
  required bool ibrido,
}) => WebViewWidget(controller: controllore);
