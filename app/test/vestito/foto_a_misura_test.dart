import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/vestito/foto_a_misura.dart';

void main() {
  test('la larghezza del riquadro per la densita\' dello schermo', () {
    // Un riquadro largo 400 punti e alto 100: comanda la larghezza.
    expect(
      FotoAMisura.pixelPer(
        const BoxConstraints(maxWidth: 400, maxHeight: 100),
        3,
      ),
      1200,
    );
  });

  test('in un riquadro alto comanda l\'altezza (cover di una 16:9)', () {
    // 400 x 360: per riempirlo una foto 16:9 deve essere larga 640 punti.
    expect(
      FotoAMisura.pixelPer(
        const BoxConstraints(maxWidth: 400, maxHeight: 360),
        2,
      ),
      1280,
    );
  });

  test('senza limiti si apre intera', () {
    expect(FotoAMisura.pixelPer(const BoxConstraints(), 3), isNull);
  });

  testWidgets('la foto 4K si apre alla misura dello schermo', (tester) async {
    tester.view.devicePixelRatio = 3;
    tester.view.physicalSize = const Size(1080, 2400);
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MaterialApp(
        home: Center(
          child: SizedBox(
            width: 360,
            height: 200,
            child: FotoAMisura(kTransparentImage, key: const Key('foto')),
          ),
        ),
      ),
    );
    final immagine = tester.widget<Image>(
      find.descendant(
        of: find.byKey(const Key('foto')),
        matching: find.byType(Image),
      ),
    );
    final misura = immagine.image as ResizeImage;
    // 200 punti di altezza * 16/9 = 356; vince la larghezza, 360 * 3.
    expect(misura.width, 1080);
    expect(misura.allowUpscaling, isFalse);
  });
}

/// Un PNG di un pixel trasparente.
final kTransparentImage = Uint8List.fromList(const <int>[
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, //
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
  0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
]);
