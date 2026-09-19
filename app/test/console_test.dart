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
import 'package:gdahome/casa/cruscotto.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/barra.dart';
import 'package:gdahome/schermate/console.dart';
import 'package:gdahome/schermate/menu.dart';
import 'package:gdahome/vestito/oggetti.dart';

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

  test('la voce Cruscotto c\'è solo da chi installa', () {
    /* Come la Console: a decidere se esiste è il ponte, non l'app. In casa di
     * un cliente quella voce non c'è proprio — una porta che non si apre è
     * peggio di una porta che non c'è. */
    expect(vociDellaBarra(), isNot(contains(Sezione.cruscotto)));
    expect(vociDellaBarra(conIlCruscotto: true), contains(Sezione.cruscotto));
    expect(
      vociDellaBarra(conIlCruscotto: true).length,
      vociDellaBarra().length + 1,
    );
    /* E le due voci sono indipendenti: chi risponde alle chat non è per
     * questo un installatore, e viceversa. */
    expect(
      vociDellaBarra(conLaConsole: true),
      isNot(contains(Sezione.cruscotto)),
    );
    expect(
      vociDellaBarra(conIlCruscotto: true),
      isNot(contains(Sezione.console)),
    );
  });

  test('la voce Gestione c\'è solo dove si tiene il quadro', () {
    /* La terza delle tre, e per un pezzo era l'unica che nell'app non c'era
     * proprio: il ponte fabbricava già la sua voce nella barra di Home
     * Assistant, e qui nessuno l'aveva mai scritta. Non era rotta: mancava. */
    expect(vociDellaBarra(), isNot(contains(Sezione.gestione)));
    expect(vociDellaBarra(conLaGestione: true), contains(Sezione.gestione));
    expect(
      vociDellaBarra(conLaGestione: true).length,
      vociDellaBarra().length + 1,
    );
    /* Indipendente dalle altre due, come le altre due fra loro. */
    expect(
      vociDellaBarra(conIlCruscotto: true),
      isNot(contains(Sezione.gestione)),
    );
    expect(
      vociDellaBarra(conLaGestione: true),
      isNot(contains(Sezione.cruscotto)),
    );
  });

  test('ogni sezione ha il suo disegno, e nessuna ne divide uno', () {
    /* Due voci vicine con lo stesso disegno sono due voci che si leggono
     * uguali: nella barra il nome si legge, ma il disegno è quello che si
     * riconosce prima. `gestione` era nata con quello della Console. */
    final disegni = <String, Sezione>{};
    for (final una in Sezione.values) {
      final gia = disegni[una.disegno];
      expect(
        gia,
        isNull,
        reason:
            '${una.name} e ${gia?.name} hanno lo stesso disegno '
            '«${una.disegno}»',
      );
      disegni[una.disegno] = una;
      /* E deve esistere davvero: un disegno che non c'è lascia un buco. */
      expect(
        disegniDegliOggetti,
        contains(una.disegno),
        reason: 'il disegno «${una.disegno}» di ${una.name} non esiste',
      );
    }
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

/* ─── Il codice non si ribatte ────────────────────────────────────────────
 *
 * «Se il codice è inserito nella configurazione add-on non lo deve richiedere
 * più.» Sta nella scheda dell'add-on — è quello che fa esistere la voce — e
 * dentro Home Assistant la tessera lo passa alla pagina da un pezzo. Nell'app
 * no: l'app aveva solo l'indirizzo, e la pagina lo richiedeva da capo. Due
 * volte lo stesso codice, e la seconda fa pensare che la prima sia andata
 * storta.
 */

testWidgets('il ponte dice dove si apre il cruscotto, e con che codice', (
  tester,
) async {
  late PonteFinto ponte;
  late Collegamento collegamento;
  await tester.runAsync(() async {
    ponte = await PonteFinto.alza();
    ponte.lInstallatore = true;
    ponte.ilCodiceDelCruscotto = 'codice-del-cruscotto';
    collegamento = await _casaCollegata(ponte);
  });
  await _lasciaFare(tester);

  final filo = collegamento.filo!;
  late QuadroDiQuestaCasa detto;
  await tester.runAsync(() async {
    detto = await IlCruscotto(filo).dove();
  });
  expect(detto.cruscotto, 'https://quadro.gdahome.org/console/');
  expect(detto.chiave, 'codice-del-cruscotto');

  /* E dove il ponte il codice non lo dà — chi non amministra — resta vuoto, e
   * la pagina se lo fa battere come prima. Non è un guasto. */
  ponte.ilCodiceDelCruscotto = '';
  await tester.runAsync(() async {
    detto = await IlCruscotto(filo).dove();
  });
  expect(detto.cruscotto, 'https://quadro.gdahome.org/console/');
  expect(detto.chiave, '');

  await tester.runAsync(() async {
    await collegamento.chiudi();
    await ponte.spegni();
  });
});

testWidgets('un codice senza la sua porta non si tiene', (tester) async {
  /* Se la casa non è di chi installa, l'indirizzo non c'è — e un codice senza
   * dove andare non apre niente: si butta invece di portarselo dietro. */
  late PonteFinto ponte;
  late Collegamento collegamento;
  await tester.runAsync(() async {
    ponte = await PonteFinto.alza();
    ponte.lInstallatore = false;
    ponte.ilCodiceDelCruscotto = 'un-codice-che-non-apre-niente';
    collegamento = await _casaCollegata(ponte);
  });
  await _lasciaFare(tester);

  late QuadroDiQuestaCasa detto;
  await tester.runAsync(() async {
    detto = await IlCruscotto(collegamento.filo!).dove();
  });
  expect(detto.cruscotto, '');
  expect(detto.chiave, '');

  await tester.runAsync(() async {
    await collegamento.chiudi();
    await ponte.spegni();
  });
});
