/// Le prove del portone: dove finisce chi apre l'app.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/main.dart';
import 'package:gdahome/ponte/custodia.dart';
import 'package:gdahome/ponte/indirizzo.dart';

void main() {
  testWidgets('senza segno si finisce al primo avvio', (tester) async {
    await tester.pumpWidget(AppDiCasa(custodia: CustodiaInMemoria()));
    await tester.pumpAndSettle();

    expect(find.text('Colleghiamo la casa'), findsOneWidget);
    expect(find.text('Entra'), findsOneWidget);
  });

  testWidgets(
    'un indirizzo che non si capisce lo dice, senza uscire dalla schermata',
    (tester) async {
      await tester.pumpWidget(AppDiCasa(custodia: CustodiaInMemoria()));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).first, 'non un indirizzo');
      await tester.tap(find.text('Entra'));
      await tester.pump();

      expect(find.text('Questo indirizzo non si capisce.'), findsOneWidget);
    },
  );

  testWidgets('con l\'indirizzo buono ma senza codice, lo dice', (
    tester,
  ) async {
    await tester.pumpWidget(AppDiCasa(custodia: CustodiaInMemoria()));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).first, '192.168.1.50');
    await tester.tap(find.text('Entra'));
    await tester.pump();

    expect(find.text('Manca il codice.'), findsOneWidget);
  });

  testWidgets(
    'con un segno gia\' in custodia si va in casa, non al primo avvio',
    (tester) async {
      final custodia = CustodiaInMemoria();
      await custodia.scriviIlSegno('un-segno');
      /* Una porta su cui non risponde nessuno: la schermata della casa deve
     * comparire lo stesso, con la sua barra di attesa, invece di rimandare al
     * primo avvio. */
      await custodia.scriviLIndirizzo(
        const IndirizzoDelPonte(casa: '127.0.0.1', porta: 1),
      );

      await tester.pumpWidget(AppDiCasa(custodia: custodia));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(find.text('Casa'), findsOneWidget);
      expect(find.text('Colleghiamo la casa'), findsNothing);
    },
  );
}
