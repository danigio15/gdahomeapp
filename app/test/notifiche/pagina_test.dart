/// La pagina «Notifiche» e l'editor, contro un ponte finto: quello che si
/// tocca arriva alla casa, e resta nella copia per casa.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/notifiche/modello.dart';
import 'package:gdahome/notifiche/notifiche.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/notifica_personalizzata.dart';
import 'package:gdahome/schermate/notifiche.dart';

import '../ponte/ponte_finto.dart';

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

void main() {
  testWidgets('un interruttore va alla casa e resta nella copia', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1200, 2600);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    late PonteFinto ponte;
    late Collegamento collegamento;
    await tester.runAsync(() async {
      ponte = await PonteFinto.alza();
      collegamento = await _casaCollegata(ponte);
    });
    final cassaforte = CassaforteInMemoria();
    await tester.pumpWidget(
      MaterialApp(
        home: SchermataDelleNotifiche(
          collegamento: collegamento,
          cassaforte: cassaforte,
        ),
      ),
    );
    await _lasciaFare(tester);
    expect(find.text('Antifurto scattato'), findsOneWidget);
    expect(
      ponte.chieste.map((una) => una['type']),
      contains('ponte/notifiche/stato'),
    );

    final riga = find.ancestor(
      of: find.text('Antifurto scattato'),
      matching: find.byType(Row),
    );
    await tester.tap(
      find.descendant(of: riga.first, matching: find.byType(Switch)),
    );
    await _lasciaFare(tester);

    final imposta = ponte.chieste.lastWhere(
      (una) => una['type'] == 'ponte/notifiche/imposta',
    );
    expect(
      (imposta['impostazioni'] as Map)['eventi'],
      containsPair('antifurto', false),
    );
    final copia = await tester.runAsync(
      () => CopiaDelleNotifiche(cassaforte).leggi(collegamento.casa!.id),
    );
    expect(copia!.impostazioni.evento('antifurto'), isFalse);

    await tester.runAsync(() async {
      await collegamento.chiudi();
      await ponte.spegni();
    });
  });

  testWidgets('l\'editor salva una personalizzata sulla casa', (tester) async {
    tester.view.physicalSize = const Size(1200, 2600);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    late PonteFinto ponte;
    late Collegamento collegamento;
    await tester.runAsync(() async {
      ponte = await PonteFinto.alza();
      collegamento = await _casaCollegata(ponte);
    });
    await tester.pumpWidget(
      MaterialApp(
        home: SchermataDellaNotificaPersonalizzata(
          collegamento: collegamento,
          stato: StatoDelleNotifiche.leggi(ponte.notifiche),
          regola: const NotificaPersonalizzata(
            entita: 'sensor.temperatura_freezer',
            valore: '-12',
            per: 10,
            titolo: 'Freezer troppo caldo',
            chi: ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
          ),
          storiaIniziale: const [],
        ),
      ),
    );
    await tester.pump();
    await tester.tap(find.widgetWithText(FilledButton, 'Salva'));
    await _lasciaFare(tester);
    final salva = ponte.chieste.lastWhere(
      (una) => una['type'] == 'ponte/notifiche/personalizzata/salva',
    );
    expect((salva['regola'] as Map)['entita'], 'sensor.temperatura_freezer');
    expect((salva['regola'] as Map)['condizione'], 'sopra');
    expect((ponte.notifiche['personalizzate'] as List), hasLength(1));
    await tester.runAsync(() async {
      await collegamento.chiudi();
      await ponte.spegni();
    });
  });

  test('un tasto di una notifica va alla casa, col suo numero', () async {
    final ponte = await PonteFinto.alza();
    final collegamento = await _casaCollegata(ponte);
    try {
      await Notifiche(collegamento.filo!).premi('n-1', 'spegni');
      expect(
        ponte.chieste.last,
        containsPair('type', 'ponte/notifiche/azione'),
      );
      expect(ponte.chieste.last, containsPair('notifica', 'n-1'));
      expect(ponte.chieste.last, containsPair('azione', 'spegni'));
    } finally {
      await collegamento.chiudi();
      await ponte.spegni();
    }
  });
}
