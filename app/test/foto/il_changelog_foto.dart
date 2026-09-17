/// Le fotografie del foglio del changelog.
///
/// Non e' una prova: e' un attrezzo per **guardare**. Per questo il nome non
/// finisce in `_test.dart` — `flutter test` da solo non lo prende, e non fa
/// rosso il workflow su un carattere disegnato mezzo punto piu' in la'. Si
/// lancia a mano quando il foglio cambia:
///
/// ```sh
/// cd app && flutter test --update-goldens test/foto/il_changelog_foto.dart
/// ```
///
/// Le fotografie finiscono in `collaudo/foto/changelog/`, accanto a quelle che
/// fa il banco — ed e' una cartella che la repository non tiene
/// (`collaudo/.gitignore`). Quindi non c'e' niente da confrontare e non c'e'
/// niente che possa diventare rosso: `--update-goldens` non e' un rimedio, e'
/// il modo in cui si usa.
///
/// Dietro il foglio c'e' la **schermata vera** degli aggiornamenti, col ponte
/// finto del collaudo: cosi' la fotografia dice anche quanto della pagina
/// resta a vedersi, e se «Installa» sta dove si arriva senza scorrere. Dentro
/// il foglio c'e' il `CHANGELOG.md` **vero** di gdahome, che e' esattamente
/// quello che Home Assistant manderebbe.
library;

import 'dart:io';
import 'dart:ui' show AccessibilityFeatures;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/aggiornamenti.dart';
import 'package:gdahome/schermate/il_changelog.dart';
import 'package:gdahome/vestito/markdown.dart' show aSpaziaturaFissa;
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

Map<String, dynamic> _voce(
  String entita,
  String nome, {
  String da = '',
  String a = '',
  String dettagli = '',
  String note = '',
}) => {
  'entita': entita,
  'nome': nome,
  'da': da,
  'a': a,
  'installabile': true,
  'stacca': false,
  'inCorso': false,
  'quanto': -1,
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

  /// Apre la schermata, ci mette sopra il foglio, e scatta.
  Future<void> unaFoto(
    WidgetTester tester, {
    required String dove,
    required Size quanto,
    required double punti,
    required bool scuro,
  }) async {
    tester.view.physicalSize = Size(
      quanto.width * punti,
      quanto.height * punti,
    );
    tester.view.devicePixelRatio = punti;
    addTearDown(tester.view.reset);

    await unaCasa(tester);
    ponte.aggiornamenti.addAll([
      _voce(
        'update.gdahome',
        'gdahome',
        da: '1.4.32.7',
        a: '1.4.32.8',
        dettagli:
            'Il firewall dell\'ufficio, spiegato dove si legge l\'indirizzo.',
        note: 'https://github.com/danigio15/gdahomeapp/blob/main/ponte/CHANGELOG.md',
      ),
      _voce(
        'update.home_assistant_core',
        'Home Assistant Core',
        da: '2026.9.1',
        a: '2026.9.2',
      ),
    ]);

    await tester.pumpWidget(
      MaterialApp(
        theme: scuro ? temaScuro() : temaChiaro(),
        home: Scaffold(
          body: SchermataDegliAggiornamenti(collegamento: collegamento),
        ),
      ),
    );
    await tester.pump();
    await respira(tester);

    /* Non si aspetta: quel `Future` finisce quando il foglio si chiude, e
     * questo foglio resta aperto — e' quello che si vuole fotografare. */
    apriIlChangelog(
      tester.element(find.byType(SchermataDegliAggiornamenti)),
      nome: 'gdahome',
      versioni: '1.4.32.7 → 1.4.32.8',
      testo: ilChangelog,
      laVersioneNuova: '1.4.32.8',
      riassunto:
          'Il firewall dell\'ufficio, spiegato dove si legge l\'indirizzo.',
      quandoInstalla: () {},
      quandoApreUnLink: (dove) {},
    ).ignore();
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('../../../collaudo/foto/changelog/$dove.png'),
    );
  }

  testWidgets('il foglio, su un telefono', (tester) async {
    await unaFoto(
      tester,
      dove: 'telefono',
      quanto: const Size(430, 932),
      punti: 2,
      scuro: false,
    );
  });

  testWidgets('il foglio, su un telefono al buio', (tester) async {
    await unaFoto(
      tester,
      dove: 'telefono-scuro',
      quanto: const Size(430, 932),
      punti: 2,
      scuro: true,
    );
  });

  testWidgets('il foglio, da computer', (tester) async {
    await unaFoto(
      tester,
      dove: 'computer',
      quanto: const Size(1440, 900),
      punti: 1,
      scuro: false,
    );
  });

  testWidgets('il foglio, da computer al buio', (tester) async {
    await unaFoto(
      tester,
      dove: 'computer-scuro',
      quanto: const Size(1440, 900),
      punti: 1,
      scuro: true,
    );
  });
}
