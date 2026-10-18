/// Le fotografie del riepilogo della sera: la scheda della notifica
/// (1080×540, come la disegna l'app) e la pagina «La tua giornata», intera,
/// scura e chiara, larga quanto un telefono (412 punti).
///
/// Non e' una prova: e' un attrezzo per **guardare**. Si lancia a mano:
///
/// ```sh
/// cd app && GDAHOME_FOTO=/tmp/foto flutter test test/foto/giornata_foto.dart
/// ```
library;

import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/notifiche/scheda.dart';
import 'package:gdahome/schermate/la_tua_giornata.dart';
import 'package:gdahome/vestito/tema.dart';

import '../notifiche/giornata_di_prova.dart';
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

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(_iCaratteri);

  for (final MapEntry(key: nome, value: scheda) in {
    'giornata': schedeDiProva['giornata']!,
    'giornata-senza-sole': schedeDiProva['giornata-senza-sole']!,
    'giornata-lunga': schedeLunghe['giornata']!,
  }.entries) {
    testWidgets('la scheda $nome', (tester) async {
      testiTagliati.clear();
      final disegno = (await tester.runAsync(
        () => disegnaLaNotifica(
          scheda: scheda,
          attesa: const Duration(seconds: 30),
        ),
      ))!;
      expect(disegno.grande, isNotNull);
      expect(testiTagliati, isEmpty);
      Directory(_cartella).createSync(recursive: true);
      File('$_cartella/scheda-$nome.png').writeAsBytesSync(disegno.grande!);
    });
  }

  for (final scuro in [true, false]) {
    final quale = scuro ? 'scura' : 'chiara';
    testWidgets('la pagina, $quale', (tester) async {
      const larga = 412.0;
      tester.view.devicePixelRatio = 2;
      tester.view.physicalSize = const Size(larga * 2, 9000 * 2);
      addTearDown(tester.view.reset);
      final cornice = GlobalKey();
      final tema = scuro ? temaScuro() : temaChiaro();
      await tester.pumpWidget(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: tema,
          locale: const Locale('it'),
          supportedLocales: const [Locale('it'), Locale('en')],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          home: Align(
            alignment: Alignment.topCenter,
            child: RepaintBoundary(
              key: cornice,
              child: Material(
                color: tema.colorScheme.surface,
                child: SizedBox(
                  width: larga,
                  child: PaginaDellaGiornata(
                    giornata: GiornataDellaCasa.leggi(giornataDiProva),
                    tuttaLunga: true,
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      /* I disegni degli oggetti si caricano fuori dal tempo finto. */
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 400)),
      );
      await tester.pumpAndSettle();
      final quadro =
          cornice.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final byte = await tester.runAsync(() async {
        final immagine = await quadro.toImage(pixelRatio: 2);
        final png = await immagine.toByteData(format: ui.ImageByteFormat.png);
        immagine.dispose();
        return png!.buffer.asUint8List();
      });
      Directory(_cartella).createSync(recursive: true);
      File('$_cartella/pagina-giornata-$quale.png').writeAsBytesSync(byte!);
    });
  }
}
