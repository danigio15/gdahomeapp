/// Il WebView sul telefono: Android e iPhone, con quello che serve alla
/// plancia.
library;

import 'dart:async';

import 'package:flutter/painting.dart' show Color;
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

/// Un controllore pronto a caricare la plancia.
///
/// Tre cose, e tutt'e tre per la plancia: il JavaScript, senza il quale non
/// esiste; i video delle telecamere che partono senza un dito sopra, come
/// fanno nel browser; e le uscite chiuse — dal riquadro non si esce verso
/// altri siti, perche' non c'e' nessun posto dove andare.
WebViewController costruisciIlControllore({
  required void Function() quandoCaricata,
  required void Function(String perche) quandoFallisce,
  required bool Function(String indirizzo) siPuoAndare,
}) {
  final PlatformWebViewControllerCreationParams parametri;
  if (WebViewPlatform.instance is WebKitWebViewPlatform) {
    parametri = WebKitWebViewControllerCreationParams(
      allowsInlineMediaPlayback: true,
      mediaTypesRequiringUserAction: const <PlaybackMediaTypes>{},
    );
  } else {
    parametri = const PlatformWebViewControllerCreationParams();
  }
  final controllore = WebViewController.fromPlatformCreationParams(parametri)
    ..setJavaScriptMode(JavaScriptMode.unrestricted)
    ..setBackgroundColor(const Color(0x00000000))
    ..setNavigationDelegate(
      NavigationDelegate(
        onPageFinished: (_) => quandoCaricata(),
        onWebResourceError: (errore) {
          /* Un'immagine che non arriva non e' la pagina che non arriva. */
          if (errore.isForMainFrame ?? true) quandoFallisce(errore.description);
        },
        onNavigationRequest: (richiesta) => siPuoAndare(richiesta.url)
            ? NavigationDecision.navigate
            : NavigationDecision.prevent,
      ),
    );
  final piattaforma = controllore.platform;
  if (piattaforma is AndroidWebViewController) {
    unawaited(piattaforma.setMediaPlaybackRequiresUserGesture(false));
  }
  return controllore;
}

Future<void> ricarica(WebViewController controllore, Uri pagina) =>
    controllore.reload();
