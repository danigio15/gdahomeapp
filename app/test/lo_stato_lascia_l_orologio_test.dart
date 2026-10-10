/// «Quando compare la scritta "telefono staccato" il simbolo della casa in
/// alto è troppo su e non si preme; e mettici un rimando alle case
/// abbinate.»
///
/// La schermata che dice com'è la casa — staccata, irraggiungibile, nessuna
/// — sta dove sta la plancia, che la barra del titolo non ce l'ha: la sua
/// riga in cima deve lasciare lo spazio dell'orologio, e in fondo c'è il
/// tasto per le case.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/casa/impostazioni.dart';
import 'package:gdahome/schermate/plancia_vera.dart';

void main() {
  testWidgets('la riga in cima sta sotto l\'orologio, e le case sono a un '
      'tasto', (tester) async {
    late Collegamento collegamento;
    late Impostazioni impostazioni;
    await tester.runAsync(() async {
      final archivio = ArchivioDelleCase(CassaforteInMemoria());
      await archivio.apri();
      collegamento = Collegamento(archivio: archivio);
      impostazioni = Impostazioni(
        sulTelefono: true,
        android: false,
        dispensa: DispensaInMemoria(),
      );
      await impostazioni.carica();
    });
    expect(collegamento.comeVa, ComeVa.nessunaCasa);

    /* Un iPhone con la tacca: 47 punti di orologio in cima. */
    tester.view.padding = const FakeViewPadding(top: 47 * 3);
    tester.view.viewPadding = const FakeViewPadding(top: 47 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    var aperte = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PlanciaVera(
            collegamento: collegamento,
            fabbrica: FabbricaDellaPlancia(),
            impostazioni: impostazioni,
            vaiAlleCase: () => aperte++,
          ),
        ),
      ),
    );
    await tester.pump();

    final inCima = find.byIcon(Icons.home_work_rounded).first;
    expect(tester.getTopLeft(inCima).dy, greaterThanOrEqualTo(47 + 20));

    final tasto = find.byKey(const Key('stato-vai-alle-case'));
    expect(tasto, findsOneWidget);
    await tester.tap(tasto);
    expect(aperte, 1);
    await tester.tap(inCima);
    expect(aperte, 2);
  });
}
