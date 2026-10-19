/// Le fotografie della pagina di una notifica toccata (`la_notifica.dart`):
/// «Antifurto · Inserito notte» chiara e scura, sul telefono e sul tablet, e
/// una elaborata, «Lavatrice finita», con la sua scheda.
///
/// Non e' una prova: e' un attrezzo per **guardare**. Si lancia a mano, e la
/// cartella la dice `GDAHOME_FOTO`:
///
/// ```sh
/// cd app && GDAHOME_FOTO=/tmp/foto flutter test --update-goldens test/foto/la_notifica_foto.dart
/// ```
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/notifiche/consegna.dart';
import 'package:gdahome/notifiche/modello.dart';
import 'package:gdahome/notifiche/scheda.dart';
import 'package:gdahome/schermate/la_notifica.dart';
import 'package:gdahome/vestito/sfondo.dart';
import 'package:gdahome/vestito/tema.dart';

import '../notifiche/schede_di_prova.dart';

final _cartella =
    Platform.environment['GDAHOME_FOTO'] ?? '/home/user/render/gdahome-app';

Future<void> _iCaratteri() async {
  const famiglie = {
    'Inter': ['400', '500', '600', '700', '800', '900'],
    'Oswald': ['200', '400', '700'],
  };
  for (final famiglia in famiglie.entries) {
    final carica = FontLoader(famiglia.key);
    for (final peso in famiglia.value) {
      final file = File('assets/carattere/${famiglia.key}-$peso.ttf');
      if (!file.existsSync()) continue;
      carica.addFont(
        file.readAsBytes().then((byte) => byte.buffer.asByteData()),
      );
    }
    await carica.load();
  }
  final radice = Platform.environment['FLUTTER_ROOT'] ?? '/opt/sdk/flutter';
  final icone = File(
    '$radice/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf',
  );
  if (icone.existsSync()) {
    await (FontLoader('MaterialIcons')..addFont(
          icone.readAsBytes().then((byte) => byte.buffer.asByteData()),
        ))
        .load();
  }
}

Widget _app(Widget pagina, {required bool scuro}) => MaterialApp(
  debugShowCheckedModeBanner: false,
  theme: temaChiaro(),
  darkTheme: temaScuro(),
  themeMode: scuro ? ThemeMode.dark : ThemeMode.light,
  locale: const Locale('it'),
  supportedLocales: const [Locale('it'), Locale('en')],
  localizationsDelegates: const [
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ],
  builder: (context, schermata) =>
      SfondoVivo(child: schermata ?? const SizedBox.shrink()),
  /* Una pagina sotto, come nell'app: la freccia per tornare c'e'. */
  home: const Scaffold(),
  onGenerateRoute: (_) => MaterialPageRoute<void>(builder: (_) => pagina),
  initialRoute: '/notifica',
);

final _adesso = DateTime(2026, 10, 18, 22, 10);

ToccoDellaNotifica _antifurto() => ToccoDellaNotifica(
  casa: 'casa',
  notifica: NotificaArrivata(
    id: 'a',
    tipo: 'inserimenti',
    categoria: 'sicurezza',
    urgenza: 'normale',
    titolo: '🌙 Antifurto · Inserito notte',
    testo: 'Casa di prova',
    quando: DateTime(2026, 10, 18, 21, 59),
    scade: DateTime(2100),
    tasti: const [
      TastoDellaNotifica('guarda', 'Guarda', apre: true),
      TastoDellaNotifica('disinserisci', 'Disinserisci'),
    ],
  ),
);

ToccoDellaNotifica _lavatrice() => ToccoDellaNotifica(
  casa: 'casa',
  notifica: NotificaArrivata(
    id: 'l',
    tipo: 'elettrodomestici',
    categoria: 'casa',
    urgenza: 'normale',
    titolo: '🧺 Lavatrice finita',
    testo: '1 h 52 min · 0,94 kWh · 0,05 € · 72% dal sole',
    quando: DateTime(2026, 10, 18, 17, 42),
    scade: DateTime(2100),
    scheda: schedeDiProva['ciclo'],
  ),
);

ToccoDellaNotifica _movimento() => ToccoDellaNotifica(
  casa: 'casa',
  notifica: NotificaArrivata(
    id: 'm',
    tipo: 'movimento',
    categoria: 'movimento',
    urgenza: 'normale',
    titolo: '📷 Movimento · Ingresso',
    testo: '18:22 · casa vuota',
    quando: DateTime(2026, 10, 18, 18, 22),
    scade: DateTime(2100),
    camera: 'camera.ingresso',
    tasti: const [
      TastoDellaNotifica('guarda', 'Guarda', apre: true),
      TastoDellaNotifica('inserisci', 'Inserisci antifurto'),
    ],
  ),
);

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await _iCaratteri();
  });

  for (final (dove, lato) in const [
    ('telefono', Size(390, 844)),
    ('tablet', Size(834, 1194)),
  ]) {
    for (final scuro in const [false, true]) {
      final tinta = scuro ? 'scuro' : 'chiaro';
      testWidgets('antifurto inserito notte, $dove, $tinta', (tester) async {
        tester.view.physicalSize = lato * 3;
        tester.view.devicePixelRatio = 3;
        addTearDown(tester.view.reset);
        await tester.pumpWidget(
          _app(
            SchermataDellaNotifica(
              tocco: _antifurto(),
              nomeDellaCasa: 'Casa di prova',
              adesso: _adesso,
              etichettaDelPosto: 'Apri Sicurezza',
              vaiAlPosto: (_) async {},
            ),
            scuro: scuro,
          ),
        );
        await tester.pumpAndSettle();
        await expectLater(
          find.byType(MaterialApp),
          matchesGoldenFile('$_cartella/antifurto-$dove-$tinta.png'),
        );
      });
    }
  }

  for (final scuro in const [false, true]) {
    final tinta = scuro ? 'scuro' : 'chiaro';
    testWidgets('lavatrice finita con la scheda, $tinta', (tester) async {
      tester.view.physicalSize = const Size(390, 844) * 3;
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final disegno = (await tester.runAsync(
        () => disegnaLaNotifica(
          scheda: schedeDiProva['ciclo'],
          attesa: const Duration(seconds: 30),
        ),
      ))!;
      await tester.pumpWidget(
        _app(
          SchermataDellaNotifica(
            tocco: _lavatrice(),
            nomeDellaCasa: 'Casa di prova',
            adesso: _adesso,
            immagineIniziale: disegno.grande,
          ),
          scuro: scuro,
        ),
      );
      await tester.runAsync(() async {
        for (final una in find.byType(Image).evaluate()) {
          await precacheImage((una.widget as Image).image, una);
        }
      });
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_cartella/lavatrice-$tinta.png'),
      );
    });
  }

  for (final scuro in const [false, true]) {
    final tinta = scuro ? 'scuro' : 'chiaro';
    testWidgets('movimento con la foto del momento, $tinta', (tester) async {
      tester.view.physicalSize = const Size(390, 844) * 3;
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final disegno = (await tester.runAsync(
        () => disegnaLaNotifica(
          foto: File('test/notifiche/porta-di-prova.jpg').readAsBytesSync(),
          attesa: const Duration(seconds: 30),
        ),
      ))!;
      await tester.pumpWidget(
        _app(
          SchermataDellaNotifica(
            tocco: _movimento(),
            nomeDellaCasa: 'Casa di prova',
            adesso: _adesso,
            immagineIniziale: disegno.grande,
            etichettaDelPosto: 'Guarda dal vivo',
            vaiAlPosto: (_) async {},
          ),
          scuro: scuro,
        ),
      );
      await tester.runAsync(() async {
        for (final una in find.byType(Image).evaluate()) {
          await precacheImage((una.widget as Image).image, una);
        }
      });
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_cartella/movimento-$tinta.png'),
      );
    });
  }
}
