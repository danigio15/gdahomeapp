/// Le fotografie della pagina «Salute»: spenta la prima volta, e accesa con
/// le misure dell'Apple Watch, chiaro e scuro.
///
/// ```sh
/// cd app && GDAHOME_FOTO=/tmp/foto flutter test --update-goldens test/foto/salute_foto.dart
/// ```
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/salute/il_corpo.dart';
import 'package:gdahome/salute/postino_della_salute.dart';
import 'package:gdahome/schermate/salute.dart';
import 'package:gdahome/vestito/tema.dart';

import '../salute/finti.dart';

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
    for (final acceso in [false, true]) {
      final come = acceso ? 'accesa' : 'spenta';

      testWidgets('la pagina Salute $come, $tinta', (tester) async {
        tester.view.physicalSize = const Size(390 * 3, 1500 * 3);
        tester.view.devicePixelRatio = 3;
        addTearDown(tester.view.reset);
        late Collegamento collegamento;
        late PostinoDellaSalute postino;
        await tester.runAsync(() async {
          final archivio = ArchivioDelleCase(CassaforteInMemoria());
          await archivio.apri();
          await archivio.segnaIlProprietario('Marco');
          collegamento = Collegamento(archivio: archivio);
          postino = PostinoDellaSalute(
            lettore: LettoreFinto(),
            dispensa: DispensaInMemoria(),
            adesso: () => LettoreFinto.adesso,
          );
          if (acceso) {
            await postino.accendi(
              FiloFinto(),
              const ScelteDellaSalute(persona: 'Marco'),
            );
          } else {
            await postino.carica();
          }
        });
        await tester.pumpWidget(
          MaterialApp(
            debugShowCheckedModeBanner: false,
            theme: scuro ? temaScuro() : temaChiaro(),
            home: SchermataDellaSalute(
              collegamento: collegamento,
              postino: postino,
            ),
          ),
        );
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 300)),
        );
        await tester.pumpAndSettle();
        await expectLater(
          find.byType(MaterialApp),
          matchesGoldenFile('$_cartella/salute-$come-$tinta.png'),
        );
      });
    }
  }
}
