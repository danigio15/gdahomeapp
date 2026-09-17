/// Le fotografie della sezione Aggiornamenti, e del foglio del changelog.
///
/// Non e' una prova: e' un attrezzo per **guardare**. Per questo il nome non
/// finisce in `_test.dart` — `flutter test` da solo non lo prende, e non fa
/// rosso il workflow su un carattere disegnato mezzo punto piu' in la'. Si
/// lancia a mano quando il foglio cambia:
///
/// ```sh
/// cd app && flutter test --update-goldens test/foto/aggiornamenti_foto.dart
/// ```
///
/// Le fotografie finiscono in `collaudo/foto/aggiornamenti/`, accanto a quelle che
/// fa il banco — ed e' una cartella che la repository non tiene
/// (`collaudo/.gitignore`). Quindi non c'e' niente da confrontare e non c'e'
/// niente che possa diventare rosso: `--update-goldens` non e' un rimedio, e'
/// il modo in cui si usa.
///
/// La schermata e' quella **vera**, col ponte finto del collaudo e con
/// `QuantoCiSta` intorno come l'ha la home: cosi' la larghezza in fotografia
/// e' quella dell'app e non una piu' larga. Dentro il foglio c'e' il
/// `CHANGELOG.md` **vero** di gdahome, che e' quello che Home Assistant
/// manderebbe.
///
/// **I loghi qui sono finti**, e non per pigrizia: quelli veri li manda Home
/// Assistant — l'icona di un add-on dalla casa, il marchio di un'integrazione
/// dai marchi di Home Assistant — e il banco non ha ne' una casa vera ne'
/// internet. Sono tre quadrati disegnati qui, della misura giusta: dicono
/// dove va il logo e quanto posto prende, non che faccia ha.
library;

import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'dart:ui' show AccessibilityFeatures;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/aggiornamenti.dart';
import 'package:gdahome/vestito/markdown.dart' show aSpaziaturaFissa;
import 'package:gdahome/vestito/quanto_e_largo.dart';
import 'package:gdahome/vestito/tema.dart';

import '../ponte/ponte_finto.dart';

/// Un telefono che ha chiesto meno movimento: il fondo dell'app respira per
/// sempre, e aspettare che tutto si fermi non finirebbe mai.
class _SenzaMovimento implements AccessibilityFeatures {
  const _SenzaMovimento();

  @override
  bool get accessibleNavigation => false;
  @override
  bool get boldText => false;
  @override
  bool get disableAnimations => true;
  @override
  bool get highContrast => false;
  @override
  bool get invertColors => false;
  @override
  bool get onOffSwitchLabels => false;
  @override
  bool get reduceMotion => true;
  @override
  bool get autoPlayAnimatedImages => false;
  @override
  bool get autoPlayVideos => false;
  @override
  bool get deterministicCursor => false;
  @override
  bool get supportsAnnounce => false;
}

/// I caratteri veri dell'app, caricati dal disco.
///
/// Senza questo la fotografia esce con un carattere di riserva, e guardare una
/// fotografia per dire se un testo si legge con un carattere che non e' quello
/// non serve a niente.
Future<void> _iCaratteri() async {
  final famiglie = {
    'Inter': ['400', '500', '600', '700', '800', '900'],
    'Oswald': ['200', '400', '700'],
  };
  for (final famiglia in famiglie.entries) {
    final carica = FontLoader(famiglia.key);
    for (final peso in famiglia.value) {
      final file = File('assets/carattere/${famiglia.key}-$peso.ttf');
      carica.addFont(
        file.readAsBytes().then((byte) => byte.buffer.asByteData()),
      );
    }
    await carica.load();
  }
  await _laSpaziaturaFissa();
  await _leIcone();
}

/// Le icone di Material, caricate dalla cartella dell'SDK.
///
/// Anche queste `flutter_tester` non le ha: senza, ogni icona esce come un
/// quadratino vuoto — e una fotografia con dei quadratini al posto delle
/// icone racconta un'app che non c'e'. Il file sta dentro Flutter, e dov'e'
/// Flutter lo dice `FLUTTER_ROOT`, che il comando delle prove mette.
Future<void> _leIcone() async {
  final radice = Platform.environment['FLUTTER_ROOT'];
  if (radice == null || radice.isEmpty) return;
  final file = File(
    '$radice/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf',
  );
  if (!file.existsSync()) return;
  await (FontLoader('MaterialIcons')
        ..addFont(file.readAsBytes().then((byte) => byte.buffer.asByteData())))
      .load();
}

/// Un carattere a spaziatura fissa, per il `codice` dentro le note.
///
/// `flutter_tester` non ha **nessun** carattere di sistema: «monospace», che
/// su un telefono e in un browser si risolve da se', qui non si risolve, e il
/// codice esce a quadratini vuoti. Una fotografia con dei quadratini al posto
/// di `1.4.32.8` non dice quello che si vede davvero, dice il contrario.
/// Percio' il banco ne presta uno del sistema; se non ne trova, presta
/// l'Inter, che almeno si legge.
Future<void> _laSpaziaturaFissa() async {
  const dove = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf',
    '/System/Library/Fonts/Menlo.ttc',
  ];
  final quale = dove
      .map(File.new)
      .firstWhere(
        (uno) => uno.existsSync(),
        orElse: () => File('assets/carattere/Inter-400.ttf'),
      );
  for (final nome in ['monospace', ...aSpaziaturaFissa]) {
    await (FontLoader(nome)..addFont(
          quale.readAsBytes().then((byte) => byte.buffer.asByteData()),
        ))
        .load();
  }
}

/// Un segno finto: un quadrato con una lettera, della misura di un logo vero.
///
/// Disegnato e poi impacchettato in PNG, perche' e' quello che arriva dal
/// filo: cosi' la fotografia mostra la strada intera — byte che diventano
/// un'immagine dentro il quadrato — e non una scorciatoia che in casa non
/// esiste.
Future<Uint8List> _unSegno(Color tinta, String lettera) async {
  const lato = 128.0;
  final registratore = ui.PictureRecorder();
  final tela = Canvas(registratore);
  tela.drawRRect(
    RRect.fromRectAndRadius(
      const Rect.fromLTWH(0, 0, lato, lato),
      const Radius.circular(26),
    ),
    Paint()..color = tinta,
  );
  final scritta = TextPainter(
    text: TextSpan(
      text: lettera,
      style: const TextStyle(
        color: Color(0xFFFFFFFF),
        fontSize: 74,
        fontWeight: FontWeight.w800,
        fontFamily: 'Inter',
      ),
    ),
    textDirection: TextDirection.ltr,
  )..layout();
  scritta.paint(
    tela,
    Offset((lato - scritta.width) / 2, (lato - scritta.height) / 2),
  );
  final immagine = await registratore.endRecording().toImage(
    lato.toInt(),
    lato.toInt(),
  );
  final byte = await immagine.toByteData(format: ui.ImageByteFormat.png);
  return byte!.buffer.asUint8List();
}

Map<String, dynamic> _voce(
  String entita,
  String nome, {
  String da = '',
  String a = '',
  String dettagli = '',
  String note = '',
  bool nostra = false,
  bool logo = false,
  bool leNote = false,
  bool installabile = true,
  bool stacca = false,
  bool inCorso = false,
  int quanto = -1,
}) => {
  'entita': entita,
  'nome': nome,
  'da': da,
  'a': a,
  'nostra': nostra,
  'logo': logo,
  'leNote': leNote,
  'installabile': installabile,
  'stacca': stacca,
  'inCorso': inCorso,
  'quanto': quanto,
  'dettagli': dettagli,
  'note': note,
};

void main() {
  late PonteFinto ponte;
  late Collegamento collegamento;
  late String ilChangelog;

  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await _iCaratteri();
    ilChangelog = await File('../ponte/CHANGELOG.md').readAsString();
  });

  setUp(() {
    TestWidgetsFlutterBinding
            .instance
            .platformDispatcher
            .accessibilityFeaturesTestValue =
        const _SenzaMovimento();
  });

  tearDown(() {
    TestWidgetsFlutterBinding.instance.platformDispatcher
        .clearAccessibilityFeaturesTestValue();
  });

  /// Una casa collegata a un ponte finto, come nel collaudo.
  Future<void> unaCasa(WidgetTester tester) async {
    await tester.runAsync(() async {
      ponte = await PonteFinto.alza();
      final archivio = ArchivioDelleCase(CassaforteInMemoria());
      await archivio.aggiungi(
        nome: 'Casa',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        inCasa: ponte.indirizzo,
      );
      collegamento = Collegamento(
        archivio: archivio,
        sonda: Sonda(bussa: (dove) async => dove == ponte.indirizzo.salute),
      );
      await collegamento.apri();
    });
    addTearDown(() async {
      await collegamento.chiudi();
      await ponte.spegni();
    });
  }

  /// Un momento di tempo vero, e poi si ridisegna: la prima lettura passa dal
  /// filo, che e' rete vera.
  Future<void> respira(WidgetTester tester) async {
    for (var volta = 0; volta < 2; volta += 1) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 250)),
      );
      for (var giro = 0; giro < 8; giro += 1) {
        await tester.pump(const Duration(milliseconds: 50));
      }
    }
  }

  /// La casa del banco: quello che una casa vera ha da aggiornare.
  ///
  /// Sei righe, e sono i sei casi che questa schermata deve saper disegnare:
  /// la nostra (che porta il suo marchio e porta giu' il filo), il sistema,
  /// un add-on col suo logo, un'integrazione col suo marchio, una che di logo
  /// non ne ha, e un firmware che si cambia sull'apparecchio.
  Future<void> unaCasaDaAggiornare(WidgetTester tester) async {
    ponte.aggiornamenti.addAll([
      _voce(
        'update.dashboardmodern_update',
        'gdahome',
        da: '1.4.32.7',
        a: '1.4.32.8',
        nostra: true,
        stacca: true,
        leNote: true,
        dettagli:
            'Il firewall dell\'ufficio, spiegato dove si legge l\'indirizzo.',
        note: 'https://github.com/danigio15/gdahomeapp/blob/main/ponte/CHANGELOG.md',
      ),
      _voce(
        'update.home_assistant_core',
        'Home Assistant Core',
        da: '2026.9.1',
        a: '2026.9.2',
        stacca: true,
        logo: true,
        dettagli: 'Correzioni, e due integrazioni nuove.',
      ),
      _voce(
        'update.mosquitto',
        'Mosquitto broker',
        da: '6.5.1',
        a: '6.5.2',
        logo: true,
      ),
      _voce(
        'update.shelly_salotto',
        'Shelly Plus 2PM (salotto)',
        da: '1.4.4',
        a: '1.5.0',
        logo: true,
        dettagli: 'Il conteggio dell\'energia non si azzera piu\' di notte.',
      ),
      _voce(
        'update.un_termostato',
        'Termostato corridoio',
        da: '3.1',
        a: '3.2',
      ),
      _voce(
        'update.una_serratura',
        'Serratura ingresso',
        da: '2.0.8',
        a: '2.1.0',
        installabile: false,
      ),
    ]);
    /* Le note lunghe che questa casa sa dare: il `CHANGELOG.md` vero, che e'
     * quello che Home Assistant manderebbe. */
    ponte.leNote['update.dashboardmodern_update'] = ilChangelog;
    /* Disegnare un'immagine vuole l'orologio vero: dentro `testWidgets` il
     * tempo e' finto, e `toImage` non tornerebbe mai. */
    await tester.runAsync(() async {
      ponte.loghi['update.home_assistant_core'] = await _unSegno(
        const Color(0xFF41BDF5),
        'H',
      );
      ponte.loghi['update.mosquitto'] = await _unSegno(
        const Color(0xFF3C5280),
        'M',
      );
      ponte.loghi['update.shelly_salotto'] = await _unSegno(
        const Color(0xFF4495D1),
        'S',
      );
    });
  }

  /// La schermata, col vestito e la larghezza che le da' la home.
  Widget laSchermata({required bool scuro}) => MaterialApp(
    /* Via la fascia rossa dell'angolo: in fotografia e' l'unica cosa che si
     * vede che nell'app non c'e'. */
    debugShowCheckedModeBanner: false,
    theme: scuro ? temaScuro() : temaChiaro(),
    home: Scaffold(
      body: QuantoCiSta(
        child: SchermataDegliAggiornamenti(collegamento: collegamento),
      ),
    ),
  );

  void quantoGrande(
    WidgetTester tester, {
    required Size quanto,
    required double punti,
  }) {
    tester.view.physicalSize = Size(
      quanto.width * punti,
      quanto.height * punti,
    );
    tester.view.devicePixelRatio = punti;
    addTearDown(tester.view.reset);
  }

  /// La sezione, con i suoi segni.
  Future<void> laSezione(
    WidgetTester tester, {
    required String dove,
    required Size quanto,
    required double punti,
    required bool scuro,
  }) async {
    quantoGrande(tester, quanto: quanto, punti: punti);
    await unaCasa(tester);
    await unaCasaDaAggiornare(tester);
    await tester.pumpWidget(laSchermata(scuro: scuro));
    await tester.pump();
    await respira(tester);
    /* I segni arrivano uno per volta, dopo l'elenco: si lascia il tempo di
     * tutti e tre, che e' quello che si vede aprendo la sezione. */
    await respira(tester);
    await respira(tester);
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('../../../collaudo/foto/aggiornamenti/$dove.png'),
    );
  }

  /// Apre la schermata, ci mette sopra il foglio, e scatta.
  /// La stessa schermata, col foglio del changelog aperto sopra.
  Future<void> ilFoglio(
    WidgetTester tester, {
    required String dove,
    required Size quanto,
    required double punti,
    required bool scuro,
  }) async {
    quantoGrande(tester, quanto: quanto, punti: punti);
    await unaCasa(tester);
    await unaCasaDaAggiornare(tester);
    await tester.pumpWidget(laSchermata(scuro: scuro));
    await tester.pump();
    /* Tre giri: l'elenco, e poi i segni che arrivano uno per volta. Anche se
     * il foglio li copre, una domanda lasciata sul filo quando l'albero si
     * spegne fa fallire il banco — e non e' un guasto dell'app, e' che qui
     * l'albero si spegne a comando. */
    await respira(tester);
    await respira(tester);
    await respira(tester);

    /* Si preme «Cosa cambia» davvero, invece di chiamare il foglio a mano:
     * cosi' la fotografia mostra quello che vede chi lo preme — il foglio che
     * sale, e il testo che arriva dal filo. */
    await tester.tap(find.widgetWithText(TextButton, 'Cosa cambia'));
    await tester.pump();
    await respira(tester);
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('../../../collaudo/foto/aggiornamenti/$dove.png'),
    );
  }

  /// Il foglio mentre il testo sta arrivando, e il foglio quando non arriva.
  ///
  /// Sono i due stati che si vedono solo quando qualcosa va piano o va male, e
  /// sono quelli che nessuno guarda mai: percio' si fotografano.
  Future<void> ilFoglioChe(
    WidgetTester tester, {
    required String dove,
    required bool arriva,
  }) async {
    quantoGrande(tester, quanto: const Size(430, 932), punti: 2);
    await unaCasa(tester);
    await unaCasaDaAggiornare(tester);
    if (!arriva) {
      /* `null` e' la casa che dice no: e' come si prova una Home Assistant che
       * `update/release_notes` non lo conosce. */
      ponte.leNote['update.dashboardmodern_update'] = null;
    }
    await tester.pumpWidget(laSchermata(scuro: false));
    await tester.pump();
    await respira(tester);
    await respira(tester);
    await respira(tester);

    await tester.tap(find.widgetWithText(TextButton, 'Cosa cambia'));
    /* Qualche fotogramma e non `respira`: si vuole il foglio **prima** che la
     * risposta arrivi, che e' l'attimo che si vede premendo. */
    for (var giro = 0; giro < 8; giro += 1) {
      await tester.pump(const Duration(milliseconds: 40));
    }
    if (!arriva) {
      await respira(tester);
      await tester.pumpAndSettle();
    }

    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('../../../collaudo/foto/aggiornamenti/$dove.png'),
    );
    /* Il foglio resta aperto con una domanda sul filo: qui l'albero si spegne
     * a comando, e una domanda appesa fa fallire il banco. */
    if (arriva) await respira(tester);
  }

  const telefono = Size(430, 932);
  const computer = Size(1440, 900);

  testWidgets('la sezione, su un telefono', (tester) async {
    await laSezione(
      tester,
      dove: 'sezione',
      quanto: telefono,
      punti: 2,
      scuro: false,
    );
  });

  testWidgets('la sezione, su un telefono al buio', (tester) async {
    await laSezione(
      tester,
      dove: 'sezione-scuro',
      quanto: telefono,
      punti: 2,
      scuro: true,
    );
  });

  testWidgets('la sezione, da computer', (tester) async {
    await laSezione(
      tester,
      dove: 'sezione-computer',
      quanto: computer,
      punti: 1,
      scuro: false,
    );
  });

  testWidgets('il foglio, su un telefono', (tester) async {
    await ilFoglio(
      tester,
      dove: 'foglio',
      quanto: telefono,
      punti: 2,
      scuro: false,
    );
  });

  testWidgets('il foglio, su un telefono al buio', (tester) async {
    await ilFoglio(
      tester,
      dove: 'foglio-scuro',
      quanto: telefono,
      punti: 2,
      scuro: true,
    );
  });

  testWidgets('il foglio, mentre il testo sta arrivando', (tester) async {
    await ilFoglioChe(tester, dove: 'foglio-aspetta', arriva: true);
  });

  testWidgets('il foglio, quando le note non arrivano', (tester) async {
    await ilFoglioChe(tester, dove: 'foglio-niente', arriva: false);
  });

  testWidgets('il foglio, da computer', (tester) async {
    await ilFoglio(
      tester,
      dove: 'foglio-computer',
      quanto: computer,
      punti: 1,
      scuro: false,
    );
  });
}
