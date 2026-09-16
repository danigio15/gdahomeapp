/// Le prove della schermata Console: la coda si vede, si apre, si risponde.
///
/// E la cosa che si paga piu' cara se e' sbagliata: la voce del menu. La
/// Console la vede **una casa sola al mondo**, e in tutte le altre non deve
/// esserci proprio — una porta che c'e' e non si apre e' peggio di una porta
/// che non c'e'.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/barra.dart';
import 'package:gdahome/schermate/console.dart';
import 'package:gdahome/schermate/menu.dart';

import 'ponte/ponte_finto.dart';

const _unaCasa = 'casa_0123456789abcdef0123456789abcdef';

Future<Collegamento> _casaCollegata(PonteFinto ponte) async {
  final archivio = ArchivioDelleCase(CassaforteInMemoria());
  await archivio.apri();
  await archivio.aggiungi(
    nome: 'Casa mia',
    segno: segnoBuono,
    identificativo: chiBuono,
    chiave: chiaveBuona,
    inCasa: ponte.indirizzo,
  );
  final collegamento = Collegamento(
    archivio: archivio,
    sonda: Sonda(bussa: (dove) async => dove == ponte.indirizzo.salute),
  );
  await collegamento.apri();
  return collegamento;
}

/* Un giro di andata e ritorno col ponte finto vuole il tempo vero — i socket
 * parlano solo li' — e le continuazioni dell'app girano nel tempo finto. */
Future<void> _lasciaFare(WidgetTester tester) async {
  for (var giro = 0; giro < 5; giro += 1) {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 250)),
    );
    await tester.pump();
  }
}

void main() {
  test('la voce Console c\'è in una casa sola, e nelle altre no', () {
    expect(vociDellaBarra(), isNot(contains(Sezione.console)));
    expect(vociDellaBarra(conLaConsole: true), contains(Sezione.console));
    /* E il resto del menu non cambia: e' una voce in piu', non un menu
     * diverso. */
    expect(
      vociDellaBarra(conLaConsole: true).length,
      vociDellaBarra().length + 1,
    );
  });

  testWidgets('la coda si vede, si apre un filo e si risponde', (tester) async {
    late PonteFinto ponte;
    late Collegamento collegamento;
    await tester.runAsync(() async {
      ponte = await PonteFinto.alza();
      ponte.laConsole = true;
      ponte.unaCasaChiedeAiuto(
        _unaCasa,
        'Le telecamere non partono.',
        nome: 'Giovanni',
      );
      collegamento = await _casaCollegata(ponte);
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: SchermataDellaConsole(collegamento: collegamento)),
      ),
    );
    await _lasciaFare(tester);

    /* L'elenco: chi ha scritto, quanto c'e' da leggere, e l'ultima cosa
     * detta. L'insegna scrive in maiuscolo, come sulla plancia. */
    expect(find.text('CONVERSAZIONI · 1 DA LEGGERE'), findsOneWidget);
    expect(find.text('Giovanni'), findsOneWidget);
    expect(find.text('Le telecamere non partono.'), findsOneWidget);

    await tester.tap(find.text('Giovanni'));
    await _lasciaFare(tester);

    /* Dentro: il filo, e la strada per tornare indietro. */
    expect(find.text('Tutte le conversazioni'), findsOneWidget);
    expect(find.text('Le telecamere non partono.'), findsOneWidget);
    /* E sotto il fumetto c'e' scritto chi l'ha detto. Da questa parte l'altro
     * non e' «chi fa l'app» — quello sono io — ma la casa che ha chiesto
     * aiuto: scambiarli vorrebbe dire leggere le proprie risposte come
     * domande. */
    expect(find.textContaining('Giovanni ·'), findsOneWidget);
    expect(find.textContaining('chi fa l\'app'), findsNothing);

    await tester.enterText(find.byType(TextField).last, 'Che modello sono?');
    await tester.tap(find.byTooltip('Manda'));
    await _lasciaFare(tester);
    expect(find.text('Che modello sono?'), findsWidgets);
    /* La risposta e' partita davvero, e per il centralino viene dalla
     * console: e' quella che nella casa di chi ha chiesto aiuto arriva come
     * risposta dell'assistenza. */
    expect(ponte.fili[_unaCasa]!.last['da'], 'console');
    /* E aperta vuol dire letta: il pallino se ne va. */
    expect(ponte.conversazioni.single['non_letti'], 0);

    /* Si chiude la schermata prima di finire: il giro dei dieci secondi si
     * spegne con lei, e la prova non resta con un timer appeso. */
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.runAsync(() async {
      await collegamento.chiudi();
      await ponte.spegni();
    });
  });

  testWidgets('senza coda si dice cosa ci arriverà', (tester) async {
    late PonteFinto ponte;
    late Collegamento collegamento;
    await tester.runAsync(() async {
      ponte = await PonteFinto.alza();
      ponte.laConsole = true;
      collegamento = await _casaCollegata(ponte);
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: SchermataDellaConsole(collegamento: collegamento)),
      ),
    );
    await _lasciaFare(tester);
    expect(find.text('Nessuno ha scritto'), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.runAsync(() async {
      await collegamento.chiudi();
      await ponte.spegni();
    });
  });
}
