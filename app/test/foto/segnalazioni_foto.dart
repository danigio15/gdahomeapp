/// Le fotografie della segnalazione nuova: l'avviso accanto ai bottoni degli
/// allegati, e la finestra che si apre la prima volta.
///
/// Non e' una prova: e' un attrezzo per **guardare**. Si lancia a mano:
///
/// ```sh
/// cd app && flutter test --update-goldens test/foto/segnalazioni_foto.dart
/// ```
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/allegati.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/casa/impostazioni.dart';
import 'package:gdahome/casa/segnalazioni.dart';
import 'package:gdahome/parole.dart';
import 'package:gdahome/ponte/filo.dart';
import 'package:gdahome/schermate/segnalazioni.dart';
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

class _FiloMuto implements Filo {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await _iCaratteri();
  });

  for (final lingua in const ['it', 'en']) {
    testWidgets('segnalazione nuova, $lingua', (tester) async {
      tester.view.physicalSize = const Size(390 * 3, 844 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final impostazioni = Impostazioni(
        sulTelefono: true,
        android: true,
        dispensa: DispensaInMemoria(),
      );
      await tester.runAsync(impostazioni.carica);
      laLingua = lingua == 'en' ? Lingua.inglese : Lingua.italiano;
      addTearDown(() => laLingua = Lingua.italiano);
      await tester.pumpWidget(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: temaChiaro(),
          locale: Locale(lingua),
          supportedLocales: const [Locale('it'), Locale('en')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          builder: (context, schermata) =>
              SfondoVivo(child: schermata ?? const SizedBox.shrink()),
          home: NuovaSegnalazione(
            segnalazioni: Segnalazioni(_FiloMuto()),
            diagnostica: const {'app': '1.11.6', 'sistema': 'android'},
            quandoMandata: (_) async {},
            scegli: (_) async => null,
            impostazioni: impostazioni,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.byType(GliAllegati),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_cartella/segnalazione-avviso-$lingua.png'),
      );
      await tester.tap(find.byIcon(Icons.photo_library_rounded).first);
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_cartella/segnalazione-finestra-$lingua.png'),
      );
    });
  }
}
