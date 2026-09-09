/// La barra del salvataggio deve starci su un telefono.
///
/// Ci stava su uno schermo largo e non su un telefono: «Lascia stare» e
/// «Salva» accanto all'avviso prendevano trecentoventi punti su
/// quattrocentosei, all'avviso ne restavano tredici — una lettera per riga —
/// e «Salva» finiva fuori dal bordo destro. Cioe' da nessuna schermata della
/// configurazione si poteva piu' salvare niente. Il collaudo l'ha visto in
/// fotografia; queste prove lo tengono fermo.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/schermate/configurazione/pezzi.dart';

Widget _barra({bool sta = false}) => MaterialApp(
  home: Scaffold(
    body: SafeArea(
      top: false,
      child: Column(
        children: [
          const Expanded(child: SizedBox()),
          BarraDelSalvataggio(
            cEqualcosa: true,
            sta: sta,
            salva: () {},
            lascia: () {},
          ),
        ],
      ),
    ),
  ),
);

void main() {
  for (final (quanto, come) in [
    (320.0, 'un telefono piccolo'),
    (430.0, 'un telefono normale'),
    (250.0, 'una finestra strettissima'),
  ]) {
    testWidgets('su $come si vedono i due bottoni', (prova) async {
      prova.view.physicalSize = Size(quanto * 2, 1864);
      prova.view.devicePixelRatio = 2;
      addTearDown(prova.view.reset);
      await prova.pumpWidget(_barra());
      await prova.pumpAndSettle();

      expect(find.text('Salva'), findsOneWidget);
      expect(find.text('Lascia stare'), findsOneWidget);
      /* Dentro lo schermo per davvero: un bottone spinto oltre il bordo
       * destro esiste nell'albero e non si puo' premere. */
      for (final quale in ['Salva', 'Lascia stare']) {
        final riquadro = prova.getRect(find.text(quale));
        expect(riquadro.right, lessThanOrEqualTo(quanto), reason: quale);
        expect(riquadro.left, greaterThanOrEqualTo(0.0), reason: quale);
      }
      /* E l'avviso resta una riga sola: se si mette a capo una lettera per
       * volta la barra si mangia mezzo schermo. */
      expect(
        prova.getSize(find.text('Non ancora salvato')).height,
        lessThan(30),
      );
    });
  }

  testWidgets('mentre salva il tondo non allarga la barra', (prova) async {
    prova.view.physicalSize = const Size(640, 1864);
    prova.view.devicePixelRatio = 2;
    addTearDown(prova.view.reset);
    await prova.pumpWidget(_barra(sta: true));
    await prova.pump();
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(
      prova.getSize(find.byType(BarraDelSalvataggio)).height,
      lessThan(120),
    );
  });

  testWidgets('senza niente da salvare la barra non c\'e\'', (prova) async {
    await prova.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BarraDelSalvataggio(
            cEqualcosa: false,
            sta: false,
            salva: () {},
            lascia: () {},
          ),
        ),
      ),
    );
    await prova.pumpAndSettle();
    expect(find.text('Salva'), findsNothing);
  });
}
