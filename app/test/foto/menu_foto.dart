/// Le fotografie del menu dell'app, con e senza la voce «Cruscotto».
///
/// Non e' una prova: e' un attrezzo per **guardare**, come
/// `aggiornamenti_foto.dart`. Per questo il nome non finisce in `_test.dart` —
/// `flutter test` da solo non lo prende, e non fa rosso il workflow per un
/// carattere disegnato mezzo punto piu' in la'. Si lancia a mano:
///
/// ```sh
/// cd app && flutter test --update-goldens test/foto/menu_foto.dart
/// ```
///
/// Le fotografie finiscono in `collaudo/foto/menu/`, che la repository non
/// tiene: non c'e' niente da confrontare e niente che possa diventare rosso.
///
/// Quello che si vuole vedere e' **la differenza**: la stessa app, la stessa
/// barra, e una voce in piu' dove il ponte ha acceso `installatore`. In casa di
/// un cliente quella voce non e' nascosta — non c'e' proprio, ed e' la riga per
/// cui un installatore puo' fidarsi a mettere i suoi clienti dentro il quadro.
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/schermate/barra.dart';
import 'package:gdahome/schermate/cruscotto.dart';
import 'package:gdahome/schermate/da_parte.dart';
import 'package:gdahome/schermate/menu.dart';
import 'package:gdahome/vestito/sfondo.dart';
import 'package:gdahome/vestito/tema.dart';

/// I caratteri veri dell'app, dal disco.
///
/// Senza, la fotografia esce col carattere di riserva — e guardare una
/// fotografia per dire se una voce si legge, con un carattere che non e'
/// quello, non serve a niente.
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
  await _leIcone();
}

/// Le icone di Material, dalla cartella dell'SDK.
///
/// `flutter_tester` non le ha: senza, ogni icona esce come un quadratino
/// vuoto, e una fotografia di un menu fatto di quadratini racconta un'app che
/// non esiste.
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

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await _iCaratteri();
  });

  /// Un telefono: la misura su cui questo menu si guarda davvero.
  const telefono = Size(390, 844);

  /// La misura dello schermo, e se il sistema e' al buio.
  void quantoGrande(WidgetTester tester, {required bool scuro}) {
    tester.view.physicalSize = Size(telefono.width * 3, telefono.height * 3);
    tester.view.devicePixelRatio = 3;
    tester.platformDispatcher.platformBrightnessTestValue = scuro
        ? Brightness.dark
        : Brightness.light;
    addTearDown(tester.view.reset);
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
  }

  Widget laBarra({
    required GlobalKey<BarraDelleSezioniState> chiave,
    required bool conIlCruscotto,
    required bool scuro,
  }) => MaterialApp(
    debugShowCheckedModeBanner: false,
    /* I due temi come li passa l'app (`main.dart`), e quale dei due vale detto
     * qui a mano.
     *
     * Nell'app non c'e' nessun `themeMode`: vale quello di sistema, e sceglie
     * la luminosita' del telefono. Sotto le prove pero' cambiare la
     * luminosita' finta non arriva a `MaterialApp`, e la fotografia usciva col
     * tema chiaro e il testo del tema scuro sopra — illeggibile, e per giunta
     * un guasto che nell'app non esiste. Dirlo qui e' una bugia piccola e
     * innocua: il tema disegnato e' esattamente quello che si vedrebbe. */
    theme: temaChiaro(),
    darkTheme: temaScuro(),
    themeMode: scuro ? ThemeMode.dark : ThemeMode.light,
    /* `SfondoVivo` sotto tutto, come in `main.dart`.
     *
     * Il tema mette apposta `scaffoldBackgroundColor: transparent` — il fondo
     * lo dipinge lui, e le schermate ci galleggiano sopra. Senza, la
     * fotografia esce col fondo **trasparente**: al chiaro non si nota, al
     * buio si vede il testo chiaro del tema scuro sopra il bianco, cioe'
     * illeggibile. Un guasto che nell'app non c'e', e che solo il render
     * poteva far vedere. */
    home: SfondoVivo(
      child: Scaffold(
        body: Stack(
          children: [
            BarraDelleSezioni(
              key: chiave,
              sezioni: vociDellaBarra(conIlCruscotto: conIlCruscotto),
              aperta: Sezione.plancia,
              vai: (_) {},
              vaiAlleCase: () {},
              daParte: const LaPlanciaDaParte(),
            ),
          ],
        ),
      ),
    ),
  );

  Future<void> scatta(
    WidgetTester tester, {
    required String dove,
    required bool conIlCruscotto,
    required bool scuro,
  }) async {
    quantoGrande(tester, scuro: scuro);

    final chiave = GlobalKey<BarraDelleSezioniState>();
    await tester.pumpWidget(
      laBarra(chiave: chiave, conIlCruscotto: conIlCruscotto, scuro: scuro),
    );
    await tester.pump();
    chiave.currentState!.apri();
    /* Si fanno passare due secondi **a passi**, non con `pumpAndSettle`.
     *
     * `pumpAndSettle` fa correre l'orologio finche' non si ferma tutto — e qui
     * non si ferma mai per conto suo, perche' la barra ha un timer che dopo
     * quattro secondi la richiude da sola. Il risultato erano tre fotografie
     * identiche di una pagina bianca: la barra si era aperta e richiusa prima
     * dello scatto. */
    for (var i = 0; i < 40; i += 1) {
      await tester.pump(const Duration(milliseconds: 50));
    }
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('../../../collaudo/foto/menu/$dove.png'),
    );
  }

  testWidgets('il menu in casa di un cliente', (tester) async {
    await scatta(
      tester,
      dove: 'senza-cruscotto',
      conIlCruscotto: false,
      scuro: false,
    );
  });

  testWidgets('il menu da chi installa', (tester) async {
    await scatta(
      tester,
      dove: 'con-cruscotto',
      conIlCruscotto: true,
      scuro: false,
    );
  });

  testWidgets('il menu da chi installa, al buio', (tester) async {
    await scatta(
      tester,
      dove: 'con-cruscotto-scuro',
      conIlCruscotto: true,
      scuro: true,
    );
  });

  /* E la schermata che quella voce apre.
   *
   * Sta qui e non in un attrezzo suo perche' e' la stessa cosa guardata un
   * gesto piu' in la': si preme la voce, e si vede questa. */
  Future<void> laSchermata(
    WidgetTester tester, {
    required String dove,
    required bool scuro,
  }) async {
    quantoGrande(tester, scuro: scuro);

    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: temaChiaro(),
        darkTheme: temaScuro(),
        themeMode: scuro ? ThemeMode.dark : ThemeMode.light,
        home: SfondoVivo(
          child: Scaffold(
            appBar: AppBar(title: Text(Sezione.cruscotto.titolo)),
            body: const SchermataDelCruscotto(
              dove: 'https://quadro.gdahome.org/console/',
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('../../../collaudo/foto/menu/$dove.png'),
    );
  }

  testWidgets('la schermata del cruscotto', (tester) async {
    await laSchermata(tester, dove: 'schermata', scuro: false);
  });

  testWidgets('la schermata del cruscotto, al buio', (tester) async {
    await laSchermata(tester, dove: 'schermata-scuro', scuro: true);
  });
}
