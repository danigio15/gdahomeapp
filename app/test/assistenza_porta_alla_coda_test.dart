/// «Assistenza su app non mi fa vedere le chat che arrivano da utenti.»
///
/// Le chat delle altre case ci sono, e ci sono sempre state: stanno nella
/// Console, che e' una voce a parte del menu e compare in **una casa sola al
/// mondo** — quella che nelle opzioni del ponte ha la chiave della console.
///
/// Quello che mancava e' la strada. Chi risponde apre «Assistenza», perche' e'
/// li' che la parola lo porta, e trovava la propria di conversazione: una
/// schermata che dice «Ciao» a chi le chat le deve leggere, e nessun segno che
/// da qualche altra parte ci fosse una coda.
///
/// Qui si difende la strada, e si difende anche il suo contrario: nelle case
/// che alla console non rispondono quel tasto non deve esserci. Una porta che
/// non si apre e' peggio di una porta che non c'e' — e questo tasto, in casa
/// di un cliente, aprirebbe le parole di tutti gli altri.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/assistenza.dart';

import 'ponte/ponte_finto.dart';

const _unaCasa = 'casa_0123456789abcdef0123456789abcdef';
const _ilTasto = 'Le chat delle case';

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

Future<Collegamento> _apriLAssistenza(
  WidgetTester tester, {
  required bool rispondeAlleAltre,
}) async {
  late PonteFinto ponte;
  late Collegamento collegamento;
  await tester.runAsync(() async {
    ponte = await PonteFinto.alza();
    ponte.laConsole = rispondeAlleAltre;
    ponte.unaCasaChiedeAiuto(
      _unaCasa,
      'Le telecamere non partono.',
      nome: 'Giovanni',
    );
    collegamento = await _casaCollegata(ponte);
  });

  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: SchermataDellAssistenza(
          collegamento: collegamento,
          diagnostica: () => const {},
        ),
      ),
    ),
  );
  await _lasciaFare(tester);
  return collegamento;
}

void main() {
  testWidgets('da Assistenza si arriva alla coda, in casa di chi risponde', (
    tester,
  ) async {
    await _apriLAssistenza(tester, rispondeAlleAltre: true);
    expect(find.text(_ilTasto), findsOneWidget);

    await tester.tap(find.text(_ilTasto));
    await _lasciaFare(tester);

    /* E dentro c'e' la coda vera: la casa che ha scritto, e le sue parole.
     * Senza questo il tasto sarebbe verde in una prova e vuoto in mano. */
    expect(find.text('Giovanni'), findsOneWidget);
    expect(find.text('Le telecamere non partono.'), findsOneWidget);
  });

  testWidgets('in una casa qualunque quel tasto non c\'è', (tester) async {
    await _apriLAssistenza(tester, rispondeAlleAltre: false);
    expect(find.text(_ilTasto), findsNothing);
    /* La schermata resta quella di prima: si scrive a chi fa l'app. */
    expect(find.text('Ciao'), findsOneWidget);
  });
}
