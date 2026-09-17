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

    test('la barra non resta da nessuna parte: si chiama col ☰, sempre', () {
      /* Prima restava aperta su uno schermo da computer, e il ragionamento
       * stava in piedi da solo: dove lo schermo avanza, una barra che si
       * nasconde è un gesto in più per ogni cambio di pagina.
       *
       * In pratica non reggeva: nel browser gdahome diventava un'app con due
       * facce — sul telefono il menu si chiama col ☰, su un computer stava
       * sempre lì a sinistra e il ☰ non c'era — e chi la usa in tutti e due i
       * posti doveva imparare due abitudini per la stessa cosa. Più duecento
       * punti di larghezza mangiati proprio dove c'è la plancia.
       *
       * Una sola apertura, la stessa dappertutto. */
      for (final quanto in QuantoELargo.values) {
        expect(
          quanto.laBarraResta,
          isFalse,
          reason: '«$quanto» tiene la barra aperta: il ☰ dev\'essere uno solo',
        );
      }
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
