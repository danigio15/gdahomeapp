/// Il WebView sul web: un `iframe`, e niente da impostare.
library;

import 'package:webview_flutter/webview_flutter.dart';

/// Un controllore pronto a caricare una pagina. Sul web sa fare solo quello.
WebViewController costruisciIlControllore({
  required void Function() quandoCaricata,
  required void Function(String perche) quandoFallisce,
  required bool Function(String indirizzo) siPuoAndare,
}) => WebViewController();

/// Sul web un `iframe` non si ricarica: si ricarica la pagina.
Future<void> ricarica(WebViewController controllore, Uri pagina) =>
    controllore.loadRequest(pagina);
