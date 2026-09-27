/// La fotografia della pagina «aggiornala»: il giorno dei pagamenti, sopra
/// un'app che e' sotto la versione minima.
///
/// Non e' una prova: e' un attrezzo per **guardare**, come `premium_foto.dart`.
/// Si lancia a mano:
///
/// ```sh
/// cd app && flutter test --update-goldens test/foto/aggiorna_foto.dart
/// ```
///
/// Esce due volte: `aggiorna-l-app-android.png` («Aggiorna dal Play Store») e
/// `aggiorna-l-app-ios.png` («Aggiorna dall'App Store»), la seconda con
/// `debugDefaultTargetPlatformOverride` su iOS.
///
/// Le fotografie finiscono in `/home/user/render/gdahome-app/` (o dove dice
/// `GDAHOME_FOTO`), fuori dalla repository.
library;

import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/aggiornamento_obbligatorio.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/vestito/sfondo.dart';
import 'package:gdahome/vestito/tema.dart';

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

/// Ogni fotografia due volte: Android e iPhone. La variante mette
/// `debugDefaultTargetPlatformOverride` e lo rimette a posto nel suo tearDown.
final _sistemi = TargetPlatformVariant(const {
  TargetPlatform.android,
  TargetPlatform.iOS,
});

bool get _iPhone => defaultTargetPlatform == TargetPlatform.iOS;

String get _sistema => _iPhone ? 'ios' : 'android';

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await _iCaratteri();
  });

  const telefono = Size(390, 844);

  testWidgets('la pagina «aggiornala», sopra un\'app troppo vecchia', (
    tester,
  ) async {
    tester.view.physicalSize = Size(telefono.width * 3, telefono.height * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    final versione = VersioneMinima(
      chiedi: () async => 9999999,
      dispensa: DispensaInMemoria(),
      attiva: true,
    );
    await tester.runAsync(versione.parti);
    addTearDown(versione.dispose);

    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: temaChiaro(),
        darkTheme: temaScuro(),
        themeMode: ThemeMode.light,
        locale: const Locale('it'),
        supportedLocales: const [Locale('it'), Locale('en')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        builder: (context, schermata) => AggiornamentoObbligatorio(
          versione: versione,
          apri: () async {},
          child: SfondoVivo(child: schermata ?? const SizedBox.shrink()),
        ),
        home: const Scaffold(body: Center(child: Text('la casa'))),
      ),
    );
    for (var i = 0; i < 30; i += 1) {
      await tester.pump(const Duration(milliseconds: 50));
    }
    /* Il marchio e' un'immagine: si decodifica fuori dal tempo finto. */
    await tester.runAsync(() async {
      for (final elemento in find.byType(Image).evaluate()) {
        final immagine = elemento.widget as Image;
        await precacheImage(immagine.image, elemento);
      }
      await Future<void>.delayed(const Duration(milliseconds: 200));
    });
    await tester.pump();
    expect(find.byType(PaginaAggiornala), findsOneWidget);
    expect(
      find.text(
        _iPhone ? 'Aggiorna dall\'App Store' : 'Aggiorna dal Play Store',
      ),
      findsOneWidget,
    );
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('$_cartella/aggiorna-l-app-$_sistema.png'),
    );
  }, variant: _sistemi);
}
