/// Le fotografie di «Collegare questa casa?»: il foglio che apre il link
/// `gdahome://collega?invito=…` della console, al primo avvio e con una casa
/// gia' nell'app (Base: si ricollega quella), chiaro e scuro.
///
/// Non e' una prova: e' un attrezzo per **guardare**, come le altre foto. Si
/// lancia a mano, e la cartella la dice `GDAHOME_FOTO`:
///
/// ```sh
/// cd app && GDAHOME_FOTO=/tmp/foto flutter test --update-goldens test/foto/collega_dal_link_foto.dart
/// ```
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/ponte/invito.dart';
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

/// Un invito inventato, come quello che la console mette nel link.
final _invito = Invito.leggi(
  'gdahome|1|ABCD2345EFGH6789|wss://centralino.esempio.dev|192.168.1.50:8098',
);

void main() {
  setUpAll(_iCaratteri);

  for (final scuro in [false, true]) {
    final tinta = scuro ? 'scuro' : 'chiaro';

    for (final conUnaCasa in [false, true]) {
      final dove = conUnaCasa ? 'base' : 'benvenuto';

      testWidgets('il foglio, $dove, $tinta', (tester) async {
        tester.view.physicalSize = const Size(824, 1800);
        tester.view.devicePixelRatio = 2;
        addTearDown(tester.view.reset);
        final archivio = ArchivioDelleCase(CassaforteInMemoria());
        await archivio.apri();
        if (conUnaCasa) {
          await archivio.aggiungi(
            nome: 'Casa',
            segno: 'segno',
            casaAlCentralino: 'casa_prova_1',
          );
        }
        await tester.pumpWidget(
          MaterialApp(
            debugShowCheckedModeBanner: false,
            theme: scuro ? temaScuro() : temaChiaro(),
            home: AggiungiCasa(
              archivio: archivio,
              invitoDaUnLink: _invito,
              soloCaseGiaNote: conUnaCasa,
              quandoFatto: (_) {},
            ),
          ),
        );
        /* La villa del benvenuto si accende piano: qualche secondo, e il
         * foglio sopra. */
        for (var giro = 0; giro < 30; giro += 1) {
          await tester.pump(const Duration(milliseconds: 100));
        }
        await expectLater(
          find.byType(MaterialApp),
          matchesGoldenFile('$_cartella/collega-dal-link-$dove-$tinta.png'),
        );
      });
    }
  }
}
