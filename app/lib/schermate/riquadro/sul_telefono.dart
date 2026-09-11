/// Il WebView sul telefono: Android e iPhone, con quello che serve alla
/// plancia.
library;

import 'dart:async';

import 'package:flutter/painting.dart' show Color;
import 'package:flutter/widgets.dart' show Widget;
import 'package:file_selector/file_selector.dart' as archivio;
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

/// Un controllore pronto a caricare la plancia.
///
/// Tre cose, e tutt'e tre per la plancia: il JavaScript, senza il quale non
/// esiste; i video delle telecamere che partono senza un dito sopra, come
/// fanno nel browser; e le uscite, che portano fuori — dal riquadro la
/// plancia non si porta via, ma un collegamento verso un altro sito si apre
/// nel browser del telefono, che e' dove lo aprirebbe la plancia dentro Home
/// Assistant.
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
  Future<void> Function(String messaggio)? dice,
  Future<bool> Function(String domanda)? chiede,
  Future<String> Function(String domanda, String diSerie)? faScrivere,
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
        onNavigationRequest: (richiesta) {
          if (siPuoAndare(richiesta.url)) return NavigationDecision.navigate;
          unawaited(_fuori(richiesta.url));
          return NavigationDecision.prevent;
        },
      ),
    );
  final piattaforma = controllore.platform;
  if (piattaforma is AndroidWebViewController) {
    unawaited(piattaforma.setMediaPlaybackRequiresUserGesture(false));
    /* Le foto della Config: nella plancia si caricano con una casella
     * `<input type="file">`, e su Android un WebView non ha di suo nessuna
     * finestra da aprire — si toccava «scegli una foto» e non succedeva
     * niente. Gliela si da': la galleria quando la pagina chiede un'immagine,
     * l'archivio del telefono quando chiede altro, e il file torna alla
     * pagina come se l'avesse scelto un browser. Sull'iPhone il WebView ce
     * l'ha gia'. */
    unawaited(piattaforma.setOnShowFileSelector(_scegli));
  }
  /* I tre dialoghi della pagina: `alert`, `confirm`, `prompt`.
   *
   * Un WebView non ne ha nessuno di suo — non e' un browser, e' un pezzo di
   * schermo — e senza questi tre pezzi la plancia parla e non si sente: sul
   * telefono di Apple `alert()` non mostrava niente e `confirm()` rispondeva
   * **no** da solo. Nella plancia ci sono centocinquanta `alert` e trentuno
   * `confirm`, e i `confirm` sono tutti «lo cancello?»: ogni cestino
   * risultava annullato in silenzio, e chi lo premeva vedeva l'oggetto
   * ancora li' senza una parola.
   *
   * Li mostra l'app, con le sue finestre — vedi `plancia_vera.dart` — che
   * sono quelle del sistema in cui la pagina sta. */
  try {
    if (dice != null) {
      unawaited(
        piattaforma.setOnJavaScriptAlertDialog(
          (richiesta) => dice(richiesta.message),
        ),
      );
    }
    if (chiede != null) {
      unawaited(
        piattaforma.setOnJavaScriptConfirmDialog(
          (richiesta) => chiede(richiesta.message),
        ),
      );
    }
    if (faScrivere != null) {
      unawaited(
        piattaforma.setOnJavaScriptTextInputDialog(
          (richiesta) =>
              faScrivere(richiesta.message, richiesta.defaultText ?? ''),
        ),
      );
    }
  } catch (_) {
    /* Una piattaforma che non li sa fare: la pagina resta com'era prima,
     * e non e' un motivo per non avere il riquadro. */
  }
  return controllore;
}

/// Quello che la pagina ha chiesto con una casella `<input type="file">`.
///
/// **Quello che ha chiesto lei**, e non una foto per tutti. Le caselle della
/// Config chiedono immagini — la faccia di una persona, un elettrodomestico,
/// un'auto — e li' la galleria e' la cosa giusta: e' dove stanno le foto, e
/// il selettore del sistema le mostra grandi. Ma non tutte le caselle
/// chiedono un'immagine: il ripristino di un backup vuole un `.json`, e nella
/// galleria di JSON non ce n'e' uno. Con la galleria per tutti, quel tasto
/// apriva le foto e non c'era niente da scegliere.
///
/// Quindi si guarda cosa dice `accept`: se chiede immagini, la galleria; se
/// chiede altro — o non dice niente — l'archivio del telefono.
Future<List<String>> _scegli(FileSelectorParams parametri) async {
  if (_chiedeUnImmagine(parametri.acceptTypes)) {
    try {
      final scelta = await ImagePicker().pickImage(source: ImageSource.gallery);
      return scelta == null ? const <String>[] : ['file://${scelta.path}'];
    } catch (_) {
      /* Permesso negato, o non c'e' galleria: alla pagina si dice niente, che
       * e' quello che dice un browser quando si annulla. */
      return const <String>[];
    }
  }
  try {
    final gruppo = archivio.XTypeGroup(
      label: 'file',
      extensions: _leEstensioni(parametri.acceptTypes),
      mimeTypes: _iTipi(parametri.acceptTypes),
    );
    final scelto = await archivio.openFile(
      acceptedTypeGroups: gruppo.allowsAny ? const [] : [gruppo],
    );
    return scelto == null ? const <String>[] : ['file://${scelto.path}'];
  } catch (_) {
    return const <String>[];
  }
}

/* `accept` arriva come lo scrive la pagina: «tutte le immagini», `.json`,
 * `application/json`, o niente. Un elenco vuoto vuol dire «un file
 * qualunque», e un file qualunque non e' una foto.
 *
 * La parola che vuol dire «tutte le immagini» qui non si scrive per esteso:
 * in Dart i commenti si annidano, e quella parola dentro un commento apre un
 * commento che non si chiude piu' — si e' mangiata meta' del file. */
bool _chiedeUnImmagine(List<String> chiesti) =>
    chiesti.isNotEmpty &&
    chiesti.every(
      (uno) =>
          uno.startsWith('image/') ||
          const [
            '.jpg',
            '.jpeg',
            '.png',
            '.webp',
            '.gif',
            '.heic',
          ].contains(uno.toLowerCase()),
    );

List<String> _leEstensioni(List<String> chiesti) => [
  for (final uno in chiesti)
    if (uno.startsWith('.')) uno.substring(1).toLowerCase(),
];

List<String> _iTipi(List<String> chiesti) => [
  for (final uno in chiesti)
    if (uno.contains('/')) uno.toLowerCase(),
];

/// Un collegamento che porta fuori dalla plancia: si apre nel browser del
/// telefono, non nel riquadro.
///
/// La plancia ne ha qualcuno, e non sono di contorno: il tasto «Sostieni il
/// progetto» va su PayPal, l'autorizzazione delle segnalazioni su
/// `github.com/login/device`, il meteo su Windy, un indirizzo su una mappa.
/// Dentro Home Assistant si aprono in una scheda nuova; qui la scheda nuova
/// non c'e', e prima di adesso si toccavano e non succedeva niente.
///
/// Solo `http` e `https`. Un `blob:` o un `data:` non e' un posto dove
/// andare: e' un file che la pagina ha fatto, e lo apre lei.
Future<void> _fuori(String indirizzo) async {
  final dove = Uri.tryParse(indirizzo);
  if (dove == null) return;
  if (dove.scheme != 'http' && dove.scheme != 'https') return;
  try {
    await launchUrl(dove, mode: LaunchMode.externalApplication);
  } catch (_) {
    /* Nessun browser, o il sistema ha detto no: alla pagina non si dice
     * niente, che e' quello che vede chi tocca un collegamento morto. */
  }
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

/// Apre la Configurazione della plancia: la sua pagina, quella vera.
///
/// La maniglia la mette il servitore in fondo alla pagina
/// (`Premesse.laConfigFuoriDallaPlancia`), e riprova da se' finche' la
/// linguetta della plancia non ha il suo ascoltatore. Se la pagina non c'e'
/// ancora — il WebView appena nato — si ripiega sull'indirizzo, che la apre
/// appena caricata.
Future<void> apriLaConfig(WebViewController controllore, Uri pagina) async {
  try {
    await controllore.runJavaScript(
      'window.gdahomeApriLaConfig&&window.gdahomeApriLaConfig()',
    );
  } catch (_) {
    try {
      await controllore.loadRequest(pagina.replace(fragment: 'gdahome-config'));
    } catch (_) {
      /* Niente da fare: la Config si apre alla prossima. */
    }
  }
}

/// Riporta la plancia dov'era prima della Configurazione.
Future<void> tornaDallaConfig(WebViewController controllore) async {
  try {
    await controllore.runJavaScript(
      'window.gdahomeTornaDallaConfig&&window.gdahomeTornaDallaConfig()',
    );
  } catch (_) {
    /* La pagina non c'e' ancora: non c'e' nemmeno da dove tornare. */
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
