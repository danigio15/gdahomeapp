/// Le fotografie della prima schermata, «Colleghiamo la casa»: quella che
/// vede chi ha appena scaricato l'app. Telefono e tablet, chiaro e scuro.
///
/// Non e' una prova: e' un attrezzo per **guardare**. Si lancia a mano, e la
/// cartella la dice `GDAHOME_FOTO`:
///
/// ```sh
/// cd app && GDAHOME_FOTO=/tmp/foto flutter test --update-goldens test/foto/il_benvenuto_foto.dart
/// ```
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/schermate/aggiungi_casa.dart';
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

  const schermi = {
    'telefono': (Size(1170, 2532), 3.0),
    'tablet': (Size(2000, 1500), 2.0),
    'orizzontale': (Size(2532, 1170), 3.0),
  };
  for (final scuro in [false, true]) {
    final tinta = scuro ? 'scuro' : 'chiaro';
    for (final schermo in schermi.entries) {
      testWidgets('il benvenuto, ${schermo.key}, $tinta', (tester) async {
        tester.view.physicalSize = schermo.value.$1;
        tester.view.devicePixelRatio = schermo.value.$2;
        addTearDown(tester.view.reset);
        final archivio = ArchivioDelleCase(CassaforteInMemoria());
        await archivio.apri();
        await tester.pumpWidget(
          MaterialApp(
            debugShowCheckedModeBanner: false,
            theme: scuro ? temaScuro() : temaChiaro(),
            home: AggiungiCasa(archivio: archivio, quandoFatto: (_) {}),
          ),
        );
        /* Le immagini (il marchio) si caricano davvero, fuori dal tempo finto. */
        await tester.runAsync(() async {
          for (final e in find.byType(Image).evaluate()) {
            await precacheImage((e.widget as Image).image, e);
          }
        });
        /* Le animazioni d'ingresso finiscono: la foto e' la schermata ferma. */
        await tester.pump(const Duration(seconds: 3));
        await expectLater(
          find.byType(MaterialApp),
          matchesGoldenFile('$_cartella/benvenuto-${schermo.key}-$tinta.png'),
        );
        /* Il pannello coi passi, salito sopra la villa. */
        if (schermo.key == 'telefono') {
          await tester.tap(find.byKey(const Key('benvenuto-collega')));
          await tester.pump();
          await tester.pump(const Duration(seconds: 1));
          await expectLater(
            find.byType(MaterialApp),
            matchesGoldenFile(
              '$_cartella/benvenuto-telefono-$tinta-pannello.png',
            ),
          );
        }
      });
    }
  }
}
