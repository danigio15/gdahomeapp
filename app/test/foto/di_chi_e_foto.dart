/// Le fotografie di «Di chi è questo telefono?»: il foglio per chi si era
/// abbinato prima, chiaro e scuro, e la casella nell'abbinamento.
///
/// Non e' una prova: e' un attrezzo per **guardare**, come le altre foto. Si
/// lancia a mano, e la cartella la dice `GDAHOME_FOTO`:
///
/// ```sh
/// cd app && GDAHOME_FOTO=/tmp/foto flutter test --update-goldens test/foto/di_chi_e_foto.dart
/// ```
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/schermate/aggiungi_casa.dart';
import 'package:gdahome/schermate/di_chi_e.dart';
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

void main() {
  setUpAll(_iCaratteri);

  for (final scuro in [false, true]) {
    final tinta = scuro ? 'scuro' : 'chiaro';

    testWidgets('il foglio, $tinta', (tester) async {
      tester.view.physicalSize = const Size(1170, 2532);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: scuro ? temaScuro() : temaChiaro(),
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: FilledButton(
                  onPressed: () => chiediDiChiE(context),
                  child: const Text('apri'),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('apri'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Persona 1');
      /* Senza il cursore che lampeggia, e senza tastiera: la foto e' il foglio. */
      FocusManager.instance.primaryFocus?.unfocus();
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_cartella/di-chi-e-foglio-$tinta.png'),
      );
    });

    testWidgets('nell\'abbinamento, $tinta', (tester) async {
      tester.view.physicalSize = const Size(1170, 2532);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      final archivio = ArchivioDelleCase(CassaforteInMemoria());
      await archivio.apri();
      await archivio.segnaIlProprietario('Persona 1');
      await tester.pumpWidget(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: scuro ? temaScuro() : temaChiaro(),
          home: AggiungiCasa(archivio: archivio, quandoFatto: (_) {}),
        ),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Di chi è questo telefono?'));
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_cartella/di-chi-e-abbinamento-$tinta.png'),
      );
    });
  }
}
