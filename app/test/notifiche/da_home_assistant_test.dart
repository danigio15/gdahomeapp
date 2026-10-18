/// «Da Home Assistant» nella pagina Notifiche: le automazioni che mandano
/// notifiche, quali ricevere anche qui, e il foglio di una. Contro un ponte
/// finto: quello che si tocca arriva alla casa.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/notifiche/modello.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/notifiche.dart';

import '../ponte/ponte_finto.dart';
import 'da_home_assistant_di_prova.dart';

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

Future<void> _lasciaFare(WidgetTester tester) async {
  for (var giro = 0; giro < 5; giro += 1) {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 200)),
    );
    await tester.pump();
  }
}

Future<(PonteFinto, Collegamento)> _apri(
  WidgetTester tester, {
  Map<String, dynamic>? dati,
  bool premium = true,
}) async {
  tester.view.physicalSize = const Size(412 * 3, 900 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  late PonteFinto ponte;
  late Collegamento collegamento;
  await tester.runAsync(() async {
    ponte = await PonteFinto.alza();
    ponte.notifiche['premium'] = premium;
    ponte.daHomeAssistant = dati;
    collegamento = await _casaCollegata(ponte);
  });
  await tester.pumpWidget(
    MaterialApp(
      home: SchermataDelleNotifiche(
        collegamento: collegamento,
        cassaforte: CassaforteInMemoria(),
      ),
    ),
  );
  await _lasciaFare(tester);
  return (ponte, collegamento);
}

Future<void> _chiudi(PonteFinto ponte, Collegamento collegamento) async {
  await collegamento.chiudi();
  await ponte.spegni();
}

/* Fino a vederla, e poi in mezzo: in fondo allo schermo un tocco cade
 * fuori. */
Future<void> _finoA(WidgetTester tester, Finder cosa) async {
  await tester.scrollUntilVisible(
    cosa,
    300,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.runAsync(
    () => Scrollable.ensureVisible(tester.element(cosa.first), alignment: 0.4),
  );
  await tester.pumpAndSettle();
}

void main() {
  test('il modello legge il ponte, e la notifica porta da dove viene', () {
    final dati = NotificheDaHomeAssistant.leggi(datiDaHomeAssistant());
    expect(dati.automazioni, hasLength(6));
    expect(dati.questo?.modello, 'Pixel 8');
    final lavatrice = dati.automazioni.first;
    expect(lavatrice.perMe, isTrue);
    expect(lavatrice.testo, 'Il bucato è pronto: 1 h 52 min, 0,9 kWh');
    expect(lavatrice.quando, startsWith('Quando Lavatrice'));
    final batterie = dati.automazioni.last;
    expect(batterie.perMe, isFalse);
    expect(batterie.testo, isEmpty);
    expect(batterie.titolo, 'Batterie dei sensori scariche');
    expect(
      NotificheDaHomeAssistant.leggi({'fatto': true}).automazioni,
      isEmpty,
    );

    final arrivata = NotificaArrivata.leggi({
      'v': 1,
      'id': 'x',
      'tipo': 'ha_notify',
      'cat': 'homeassistant',
      'titolo': 'Lavatrice',
      'testo': 'Il bucato è pronto',
      'fonte': 'Automazione di Home Assistant · Lavatrice finita',
      'azioni': [
        {'id': 'ha1', 'etichetta': 'Apri telecamera'},
      ],
    })!;
    expect(arrivata.daHomeAssistant, isTrue);
    expect(arrivata.fonte, 'Automazione di Home Assistant · Lavatrice finita');
    expect(arrivata.tasti.single.etichetta, 'Apri telecamera');
  });

  testWidgets('un ponte di prima: la sezione non c\'e\'', (tester) async {
    final (ponte, collegamento) = await _apri(tester);
    await _finoA(tester, find.text('Quando'));
    expect(find.byKey(const Key('sezione-da-home-assistant')), findsNothing);
    await tester.runAsync(() => _chiudi(ponte, collegamento));
  });

  testWidgets('la sezione: quante, le etichette, e gli interruttori', (
    tester,
  ) async {
    final (ponte, collegamento) = await _apri(
      tester,
      dati: datiDaHomeAssistant(),
    );
    await _finoA(tester, find.text('Batterie dei sensori scariche'));
    expect(
      find.text('Ho trovato 6 automazioni che ti mandano notifiche'),
      findsOneWidget,
    );
    expect(find.text('Va al telefono di Persona 1'), findsOneWidget);
    expect(find.text('Con foto'), findsOneWidget);
    expect(find.text('Testo che cambia'), findsNWidgets(2));
    expect(find.text('NUOVA'), findsOneWidget);

    /* Le bollette: accesa, e alla casa. */
    final riga = find.byKey(const Key('ha-1700000000008'));
    await _finoA(tester, riga);
    await tester.tap(find.descendant(of: riga, matching: find.byType(Switch)));
    await _lasciaFare(tester);
    final imposta = ponte.chieste.lastWhere(
      (una) => una['type'] == 'ponte/notifiche/ha/imposta',
    );
    expect(imposta['voci'], {
      '1700000000008': {'acceso': true},
    });

    /* «Accendi quelle di questo telefono»: solo quelle per lui, spente. */
    await _finoA(
      tester,
      find.byKey(const Key('accendi-quelle-di-questo-telefono')),
    );
    await tester.tap(
      find.byKey(const Key('accendi-quelle-di-questo-telefono')),
    );
    await _lasciaFare(tester);
    final tutte = ponte.chieste.lastWhere(
      (una) => una['type'] == 'ponte/notifiche/ha/imposta',
    );
    expect((tutte['voci'] as Map).keys, ['1700000000006']);

    /* «Proponimi le nuove». */
    await _finoA(tester, find.byKey(const Key('proponimi-le-nuove')));
    await tester.tap(
      find.descendant(
        of: find.byKey(const Key('proponimi-le-nuove')),
        matching: find.byType(Switch),
      ),
    );
    await _lasciaFare(tester);
    expect(
      ponte.chieste.last,
      containsPair('type', 'ponte/notifiche/ha/proponi'),
    );
    expect(ponte.chieste.last['acceso'], isFalse);
    await tester.runAsync(() => _chiudi(ponte, collegamento));
  });

  testWidgets('Base: quella di un altro telefono e «Proponimi» col lucchetto', (
    tester,
  ) async {
    final (ponte, collegamento) = await _apri(
      tester,
      dati: datiDaHomeAssistant(premium: false),
      premium: false,
    );
    await _finoA(tester, find.byKey(const Key('proponimi-le-nuove')));
    final riga = find.byKey(const Key('ha-1700000000003'));
    await _finoA(tester, riga);
    final interruttore = tester.widget<Switch>(
      find.descendant(of: riga, matching: find.byType(Switch)),
    );
    expect(interruttore.onChanged, isNull);
    expect(
      find.descendant(
        of: find.byKey(const Key('proponimi-le-nuove')),
        matching: find.byKey(const Key('bollino-premium')),
      ),
      findsOneWidget,
    );
    await tester.tap(riga);
    await _lasciaFare(tester);
    expect(
      ponte.chieste.where((una) => una['type'] == 'ponte/notifiche/ha/imposta'),
      isEmpty,
    );
    await tester.runAsync(() => _chiudi(ponte, collegamento));
  });

  testWidgets('il foglio: cosa dice, chi la riceve, e «Ricevila»', (
    tester,
  ) async {
    final (ponte, collegamento) = await _apri(
      tester,
      dati: datiDaHomeAssistant(),
    );
    await _finoA(tester, find.text('Bollette: lettura contatore'));
    await tester.tap(find.text('Bollette: lettura contatore'));
    await tester.pumpAndSettle();
    expect(find.byType(FoglioDaHomeAssistant), findsOneWidget);
    expect(find.text('COSA DICE'), findsOneWidget);
    expect(find.text('Trovato'), findsOneWidget);
    expect(find.text('Telefono di Persona 1'), findsOneWidget);
    expect(find.text('Tutti i telefoni della casa'), findsOneWidget);
    await tester.tap(find.byKey(const Key('ha-ricevila')));
    await _lasciaFare(tester);
    expect(ponte.chieste.last['voci'], {
      '1700000000008': {'acceso': true},
    });
    expect(find.byKey(const Key('ha-non-piu')), findsOneWidget);
    /* A un altro telefono (Premium). */
    await tester.tap(find.byKey(const Key('ha-a-$telefonoDiPersona1')));
    await _lasciaFare(tester);
    expect(ponte.chieste.last['voci'], {
      '1700000000008': {'a': telefonoDiPersona1},
    });
    await tester.runAsync(() => _chiudi(ponte, collegamento));
  });

  testWidgets('il foglio in Base: le altre scelte col bollino', (tester) async {
    final (ponte, collegamento) = await _apri(
      tester,
      dati: datiDaHomeAssistant(premium: false),
      premium: false,
    );
    await _finoA(tester, find.text('Allarme: movimento in giardino'));
    await tester.tap(find.text('Allarme: movimento in giardino'));
    await tester.pumpAndSettle();
    /* L'altro telefono, tutti, e la foto coi tasti. */
    expect(
      find.descendant(
        of: find.byType(FoglioDaHomeAssistant),
        matching: find.byKey(const Key('bollino-premium')),
      ),
      findsNWidgets(3),
    );
    expect(
      find.text('La foto e i tasti arrivano con Premium: qui arriva il testo.'),
      findsOneWidget,
    );
    await tester.tap(find.byKey(const Key('ha-a-tutti')));
    await _lasciaFare(tester);
    expect(
      ponte.chieste.where((una) => una['type'] == 'ponte/notifiche/ha/imposta'),
      isEmpty,
    );
    await tester.runAsync(() => _chiudi(ponte, collegamento));
  });
}
