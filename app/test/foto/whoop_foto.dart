/// Le fotografie del WHOOP nella Salute: le schede con l'account collegato,
/// il dettaglio del recupero, e la riga «WHOOP» da collegare (coi dati che
/// l'app WHOOP scrive gia' in Salute) e collegata. Chiaro e scuro, telefono,
/// a due pixel per punto. Dati inventati.
///
/// ```sh
/// cd app && GDAHOME_FOTO=/tmp/foto flutter test --update-goldens test/foto/whoop_foto.dart
/// ```
library;

import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FontLoader;
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/schermate/salute.dart';
import 'package:gdahome/schermate/salute_whoop.dart';
import 'package:gdahome/vestito/sfondo.dart';
import 'package:gdahome/vestito/tema.dart';

import '../salute/scena_whoop.dart';
import '../salute/whoop_finto.dart';

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

/// Il telefono: 390 punti di larghezza, due pixel per punto.
void _telefono(WidgetTester tester, double alto) {
  tester.view.physicalSize = Size(390 * 2, alto * 2);
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
}

Future<ScenaWhoop> _laPagina(
  WidgetTester tester, {
  required bool scuro,
  required bool collegato,
}) async {
  late ScenaWhoop scena;
  await tester.runAsync(() async {
    scena = await ScenaWhoop.prepara(collegato: collegato);
  });
  await tester.pumpWidget(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      builder: (context, pagina) => SfondoVivo(child: pagina),
      theme: scuro ? temaScuro() : temaChiaro(),
      home: SchermataDellaSalute(
        collegamento: scena.collegamento,
        postino: scena.postino,
        whoop: scena.whoop,
      ),
    ),
  );
  await tester.runAsync(
    () => Future<void>.delayed(const Duration(milliseconds: 300)),
  );
  await tester.pumpAndSettle();
  return scena;
}

Future<void> _scatta(WidgetTester tester, String nome) => expectLater(
  find.byType(MaterialApp),
  matchesGoldenFile('$_cartella/$nome.png'),
);

void main() {
  setUpAll(_iCaratteri);

  for (final scuro in [false, true]) {
    final tinta = scuro ? 'scuro' : 'chiaro';

    testWidgets('la Salute con le schede WHOOP, $tinta', (tester) async {
      _telefono(tester, 1100);
      await _laPagina(tester, scuro: scuro, collegato: true);
      await _scatta(tester, 'whoop-salute-$tinta');
    });

    testWidgets('il dettaglio del recupero, $tinta', (tester) async {
      _telefono(tester, 1200);
      final scena = await _laPagina(tester, scuro: scuro, collegato: true);
      await tester.pumpWidget(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          builder: (context, pagina) => SfondoVivo(child: pagina),
          theme: scuro ? temaScuro() : temaChiaro(),
          home: SchermataDelRecupero(
            dati: scena.whoop.ultimi!,
            adesso: mattinaWhoop,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await _scatta(tester, 'whoop-recupero-$tinta');
    });

    testWidgets('le impostazioni con «Collega WHOOP», $tinta', (tester) async {
      _telefono(tester, 1500);
      await _laPagina(tester, scuro: scuro, collegato: false);
      await _scatta(tester, 'whoop-collega-$tinta');
    });

    testWidgets('le impostazioni con «Collegato», $tinta', (tester) async {
      _telefono(tester, 844);
      await _laPagina(tester, scuro: scuro, collegato: true);
      final riga = find.byKey(const Key('whoop-riga'));
      await tester.scrollUntilVisible(
        riga,
        300,
        scrollable: find.byType(Scrollable).first,
      );
      /* La riga in cima, e sotto il nome e le misure. */
      unawaited(Scrollable.ensureVisible(tester.element(riga), alignment: .06));
      await tester.pumpAndSettle();
      await _scatta(tester, 'whoop-collegato-$tinta');
    });
  }
}
