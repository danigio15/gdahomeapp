/// Il WebView sul telefono: Android e iPhone, con quello che serve alla
/// plancia.
library;

import 'dart:async';

import 'package:flutter/painting.dart' show Color;
import 'package:flutter/widgets.dart' show Widget;
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

/// Un controllore pronto a caricare la plancia.
///
/// Tre cose, e tutt'e tre per la plancia: il JavaScript, senza il quale non
/// esiste; i video delle telecamere che partono senza un dito sopra, come
/// fanno nel browser; e le uscite chiuse — dal riquadro non si esce verso
/// altri siti, perche' non c'e' nessun posto dove andare.
///
/// E un fondo **pieno**, [sfondo], non trasparente. Un WebView trasparente
/// va composto con quello che ha sotto a ogni fotogramma, e Android gli
/// toglie le scorciatoie che ha per una superficie opaca: con una plancia
/// che si muove sempre e' lavoro in piu' sessanta volte al secondo, per
/// mostrare un fondo che la pagina copre comunque.
WebViewController costruisciIlControllore({
  required void Function() quandoCaricata,
  required void Function(String perche) quandoFallisce,
  required bool Function(String indirizzo) siPuoAndare,
  required Color sfondo,
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
    ..setBackgroundColor(sfondo.withValues(alpha: 1))
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

/// Dice alla pagina quanto prendono le barre del telefono, adesso.
///
/// Sono due variabili CSS, e la pagina le usa nei suoi margini: cambiarle
/// costa un fotogramma e non ricarica niente — girando lo schermo la plancia
/// si risistema senza ripartire da capo.
Future<void> diciLeMisure(
  WebViewController controllore, {
  required double alto,
  required double basso,
}) async {
  try {
    await controllore.runJavaScript(
      'document.documentElement.style.setProperty('
      '"--gdahome-alto","${alto.round()}px");'
      'document.documentElement.style.setProperty('
      '"--gdahome-basso","${basso.round()}px");',
    );
  } catch (_) {
    /* La pagina non c'e' ancora, o se n'e' andata: alla prossima. */
  }
}

/// Il riquadro che mostra il WebView.
///
/// Su Android, con [ibrido], il riquadro lo compone il sistema per conto suo
/// (composizione ibrida): Flutter gli lascia il buco e disegna intorno. Senza,
/// il WebView disegna in una tessitura che Flutter ricompone a ogni suo
/// fotogramma — e una plancia che si muove sempre e' un fotogramma dietro
/// l'altro, sulla stessa scheda video dell'app. Sull'iPhone la scelta non
/// c'e': e' sempre il sistema a comporre.
Widget riquadroDelWebView(
  WebViewController controllore, {
  required bool ibrido,
}) {
  final piattaforma = controllore.platform;
  if (ibrido && piattaforma is AndroidWebViewController) {
    return WebViewWidget.fromPlatformCreationParams(
      params: AndroidWebViewWidgetCreationParams(
        controller: piattaforma,
        displayWithHybridComposition: true,
      ),
    );
  }
  return WebViewWidget(controller: controllore);
}
