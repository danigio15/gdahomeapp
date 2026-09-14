/// Le prove di quanto e' largo: non si chiede che dispositivo e', si guarda
/// quanto posto c'e'.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/vestito/quanto_e_largo.dart';

void main() {
  group('le soglie', () {
    test('sotto i 600 è un telefono, o una finestra stretta', () {
      expect(QuantoELargo.dallaLarghezza(360), QuantoELargo.telefono);
      expect(QuantoELargo.dallaLarghezza(599), QuantoELargo.telefono);
    });

    test('fino ai 900 è un tablet in piedi', () {
      expect(QuantoELargo.dallaLarghezza(600), QuantoELargo.tablet);
      expect(QuantoELargo.dallaLarghezza(834), QuantoELargo.tablet);
    });

    test('oltre i 900 c\'è posto per la barra', () {
      expect(QuantoELargo.dallaLarghezza(900), QuantoELargo.computer);
      expect(QuantoELargo.dallaLarghezza(1920), QuantoELargo.computer);
    });

    test('la barra resta solo dove avanza schermo', () {
      expect(QuantoELargo.telefono.laBarraResta, isFalse);
      /* Un tablet in piedi: 192 punti su 700 sono un quarto della pagina. */
      expect(QuantoELargo.tablet.laBarraResta, isFalse);
      expect(QuantoELargo.computer.laBarraResta, isTrue);
    });

    test('il telefono non ha un limite di larghezza: è già stretto', () {
      expect(QuantoELargo.telefono.quantoLarga, double.infinity);
      expect(QuantoELargo.computer.quantoLarga, 1100);
    });
  });

  group('quanto ci sta', () {
    testWidgets('su un telefono non tocca niente', (prova) async {
      prova.view.physicalSize = const Size(720, 1560);
      prova.view.devicePixelRatio = 2;
      addTearDown(prova.view.reset);
      await prova.pumpWidget(
        const MaterialApp(
          home: QuantoCiSta(child: SizedBox(key: Key('dentro'))),
        ),
      );
      expect(prova.getSize(find.byKey(const Key('dentro'))).width, 360);
    });

    testWidgets('su un computer si ferma dove si legge', (prova) async {
      prova.view.physicalSize = const Size(3840, 2160);
      prova.view.devicePixelRatio = 2;
      addTearDown(prova.view.reset);
      await prova.pumpWidget(
        MaterialApp(
          home: QuantoCiSta(
            child: Container(key: const Key('dentro'), color: Colors.red),
          ),
        ),
      );
      expect(prova.getSize(find.byKey(const Key('dentro'))).width, 1100);
    });

    testWidgets('a chi chiede tutto si dà tutto', (prova) async {
      prova.view.physicalSize = const Size(3840, 2160);
      prova.view.devicePixelRatio = 2;
      addTearDown(prova.view.reset);
      await prova.pumpWidget(
        MaterialApp(
          home: QuantoCiSta(
            quanto: double.infinity,
            child: Container(key: const Key('dentro'), color: Colors.red),
          ),
        ),
      );
      expect(prova.getSize(find.byKey(const Key('dentro'))).width, 1920);
    });
  });
}
