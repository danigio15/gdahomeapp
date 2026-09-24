/// Il WebView sul telefono: Android e iPhone, con quello che serve alla
/// plancia.
library;

import 'dart:convert';
import 'dart:async';

import 'package:flutter/painting.dart' show Color;
import 'package:flutter/widgets.dart' show Widget;
import 'package:file_selector/file_selector.dart' as archivio;
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

import '../../casa/fuori.dart';
import '../../plancia/premesse.dart' show ilMenuDalTelefono;
import 'biglietto.dart';

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
  void Function(String pagina)? quandoCambiaPagina,
  void Function()? quandoChiedeIlMenu,
  void Function(String foto)? quandoFotografaLaCasa,
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
  /* Il canale da cui la pagina parla all'app. Ci passano due cose, e il
   * canale e' uno solo perche' uno solo ne serve: quale pagina della plancia
   * si e' accesa — al menu dell'app serve per non restare segnato su una
   * voce mentre sotto c'e' un'altra pagina — e la richiesta del menu, che
   * arriva quando si premono i tre trattini della plancia. Si distinguono
   * dalla parola: quella del menu non e' il nome di nessuna pagina, e non
   * potra' esserlo (`premesse.dart`). Il nome del canale e' quello che la
   * pagina cerca. */
  /* Il canale della fotografia per l'auto, e perche' e' un canale a parte.
   *
   * Di la' passano nomi di pagine: una fotografia mandata di la' un'app
   * vecchia la prenderebbe per il nome di una pagina, e il menu resterebbe
   * senza voce accesa. Ma la ragione vera e' l'altro verso — e' la PAGINA che
   * guarda se questo canale c'e' prima di preparare qualcosa: nel browser,
   * dentro Home Assistant e su un'app di prima non c'e', e li' la plancia non
   * legge le tessere, non conta le persone e non accende nessun timer.
   * Registrarlo qui e' quindi anche il modo di dire alla plancia «in questa
   * macchina c'e' un'auto che ascolta». */
  if (quandoFotografaLaCasa != null) {
    unawaited(
      controllore.addJavaScriptChannel(
        'gdahomeAuto',
        onMessageReceived: (messaggio) =>
            quandoFotografaLaCasa(messaggio.message),
      ),
    );
  }
  if (quandoCambiaPagina != null || quandoChiedeIlMenu != null) {
    unawaited(
      controllore.addJavaScriptChannel(
        'gdahomeDice',
        onMessageReceived: (messaggio) {
          final detto = messaggio.message;
          if (detto == ilMenuDalTelefono) {
            quandoChiedeIlMenu?.call();
            return;
          }
          quandoCambiaPagina?.call(detto);
        },
      ),
    );
  }
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
  if (dove == null || !siApreFuori(dove)) return;
  try {
    await launchUrl(dove, mode: LaunchMode.externalApplication);
  } catch (_) {
    /* Nessun browser, o il sistema ha detto no: alla pagina non si dice
     * niente, che e' quello che vede chi tocca un collegamento morto. */
  }
}

Future<void> ricarica(WebViewController controllore, Uri pagina) =>
    controllore.reload();

/// Apre una pagina nel riquadro. Qui basta chiederlo: quando la pagina e'
/// arrivata lo dice il WebView, con `onPageFinished`.
Future<void> apriLaPagina(WebViewController controllore, Uri pagina) =>
    controllore.loadRequest(pagina);

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

/// Dice alla plancia che nessuno la sta guardando, o che qualcuno e' tornato.
///
/// La plancia sa gia' mettersi a riposo: dentro Home Assistant, quando si va
/// su un'altra pagina, chi la ospita le scrive addosso un segno — il
/// parcheggio — e lei smette di disegnare. Il patto sta scritto in due posti,
/// `ponte/plancia/src/legacy/host.js` di la' e `shared.js` di qua, e i nomi
/// sono questi.
///
/// Nell'app quel segno non glielo scriveva nessuno. Le altre schermate si
/// ricevono un `visibile` e si azzittiscono; la plancia no, e restava viva a
/// pieno ritmo sotto una schermata che non la mostrava: il suo disegno da
/// settecento righe due volte al secondo, i suoi timer, le sue animazioni.
/// Non si vedeva, ma si sentiva — il telefono che si scalda con la plancia
/// aperta, e gli scatti sulle schermate dell'app.
///
/// Al ritorno si manda anche un `pageshow`, che e' il modo con cui la plancia
/// capisce «rimettiti in pari»: e' quello che fa gia' chi la ospita dentro
/// Home Assistant, e due modi diversi di svegliarla sarebbero due modi da
/// tenere allineati.
Future<void> parcheggia(
  WebViewController controllore,
  bool parcheggiata,
) async {
  final detto = parcheggiata ? 'true' : 'false';
  try {
    await controllore.runJavaScript(
      'window.__DASHBOARDMODERN_PARCHEGGIATA__=$detto;'
      'window.dispatchEvent(new CustomEvent('
      '"dashboardmodern:parcheggio",{detail:{parcheggiata:$detto}}));'
      '${parcheggiata ? '' : 'window.dispatchEvent(new Event("pageshow"));'}',
    );
  } catch (_) {
    /* La pagina non c'e' ancora, o se n'e' andata: al prossimo giro. */
  }
}

/// Consegna alla pagina del quadro il codice che apre il cruscotto.
///
/// **La stessa strada della tessera dentro Home Assistant**
/// (`ponte/carta/plancia.js`): un `postMessage` con la stessa forma, che la
/// pagina ascolta gia'. Dentro Home Assistant il codice non si ribatte da un
/// pezzo; nell'app si ribatteva, perche' l'app aveva solo l'indirizzo.
///
/// Non nell'indirizzo, e per il motivo di sempre: un `#chiave=…` finirebbe
/// nella cronologia e in ogni schermata che qualcuno manda per chiedere aiuto.
///
/// Il codice si incolla dentro un `postMessage` passando da `jsonEncode`, non
/// fra due apici: di la' c'e' una riga scritta da qualcuno in una casella, e
/// un apice in mezzo trasformerebbe una chiave in un pezzo di programma.
///
/// Si manda piu' di una volta, come fa la tessera: `load` dice che il
/// documento c'e', non che il suo script e' arrivato in fondo ad attaccare
/// l'ascoltatore. Tre colpi a distanza crescente costano tre messaggi e
/// tolgono una corsa che si perde in silenzio.
///
/// [pagina] qui non serve — il WebView e' uno e la pagina dentro e' quella —
/// sta nella firma perche' la firma e' una sola: nel browser e' quello che
/// dice a quale riquadro consegnare (`sul_web.dart`).
Future<void> consegnaLaChiave(
  WebViewController controllore,
  String chiave, {
  required Uri pagina,
}) async {
  if (chiave.isEmpty) return;
  final detto = jsonEncode({'gdahome': 'chiave', 'chiave': chiave});
  for (final fra in const [
    Duration.zero,
    Duration(milliseconds: 300),
    Duration(milliseconds: 1500),
  ]) {
    if (fra > Duration.zero) await Future<void>.delayed(fra);
    try {
      await controllore.runJavaScript('window.postMessage($detto,"*")');
    } catch (_) {
      /* La pagina non c'e' ancora, o se n'e' andata: c'e' il colpo dopo. */
    }
  }
}

/// Apre il cruscotto nel browser del telefono, col suo biglietto.
///
/// Fuori dall'app il codice non si consegna: quello e' un browser di un
/// altro, e a una scheda aperta con `launchUrl` non si parla. Nell'indirizzo
/// il codice non ci va — finirebbe nella cronologia — e ci va un biglietto,
/// che vale un minuto e una volta sola (`biglietto.dart`): il cruscotto lo
/// cambia con il codice appena si apre, e non lo chiede. Se il quadro non
/// risponde si apre la pagina com'e', e il codice lo chiede lei, come prima.
Future<void> apriFuori(Uri pagina, String chiave) async {
  if (!siApreFuori(pagina)) return;
  await launchUrl(
    await conIlBiglietto(pagina, chiave),
    mode: LaunchMode.externalApplication,
  );
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

/// Passa alla plancia un dispositivo appena abbinato, perche' chieda lei dove
/// va a finire (#54, passo 4).
///
/// La maniglia la mette la plancia stessa — `installDoveLoMettoSection` la
/// appende a `window` — e a scrivere e' lei: le sue sezioni hanno cinque
/// forme diverse, e scriverle dall'app vorrebbe dire scriverle due volte.
///
/// [dispositivo] arriva **gia' in JSON**, da `ilFoglietto`: qui non si
/// costruisce niente a mano. Il nome del dispositivo lo scrive chi ha il
/// telefono in mano e finisce dentro un programma che si esegue, quindi passa
/// da `jsonEncode`, che le virgolette e le barre le chiude lui.
Future<void> doveLoMetto(
  WebViewController controllore,
  String dispositivo,
) async {
  try {
    await controllore.runJavaScript(
      'window.gdahomeDoveLoMetto&&window.gdahomeDoveLoMetto($dispositivo)',
    );
  } catch (_) {
    /* La pagina non c'e' ancora, o e' una plancia vecchia che quella maniglia
     * non ce l'ha: il dispositivo in casa c'e' lo stesso, e la sezione si
     * sceglie dall'editor come si e' sempre fatto. */
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
