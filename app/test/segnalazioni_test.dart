/// Le prove delle schermate delle segnalazioni e dell'assistenza: si apre
/// una segnalazione dalla barra, si vede il filo, si scrive in chat.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/casa/segnalazioni.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/assistenza.dart';
import 'package:gdahome/schermate/segnalazioni.dart';

import 'ponte/ponte_finto.dart';

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

Map<String, String> _diagnostica() => const {
  'app': '10·prova',
  'sistema': 'prova',
};

void main() {
  testWidgets('si apre una segnalazione e se ne vede il filo', (tester) async {
    late PonteFinto ponte;
    late Collegamento collegamento;
    await tester.runAsync(() async {
      ponte = await PonteFinto.alza();
      collegamento = await _casaCollegata(ponte);
    });

    await tester.pumpWidget(
      MaterialApp(
        home: SchermataDelleSegnalazioni(
          collegamento: collegamento,
          diagnostica: _diagnostica,
        ),
      ),
    );
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 200)),
    );
    await tester.pumpAndSettle();

    expect(find.text('Nessuna segnalazione'), findsOneWidget);
    expect(find.text('Nuova segnalazione'), findsOneWidget);

    await tester.tap(find.text('Nuova segnalazione'));
    await tester.pumpAndSettle();
    /* Quello che parte da solo si vede prima di mandare. */
    expect(find.text('Parte anche questo, da solo'), findsOneWidget);
    expect(find.text('app: 10·prova'), findsOneWidget);

    await tester.tap(find.text('Idea'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, 'In due parole'),
      'Una tessera per la piscina',
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'Racconta'),
      'Sarebbe bello vederla in home.',
    );
    /* Il bottone sta in fondo a una pagina piu' alta della finestra di
     * prova: si scorre fin li', come farebbe un dito. */
    await tester.ensureVisible(find.text('Manda'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Manda'));
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 300)),
    );
    await tester.pumpAndSettle();

    /* Si finisce nel filo, con le proprie parole dentro un fumetto. */
    expect(find.text('Una tessera per la piscina'), findsOneWidget);
    expect(find.text('Sarebbe bello vederla in home.'), findsOneWidget);
    expect(find.text('#7'), findsOneWidget);
    final mandata = ponte.arrivati.lastWhere(
      (uno) => uno['type'] == 'ponte/segnalazioni/crea',
    );
    expect(mandata['tipo'], 'idea');
    expect(mandata['diagnostica'], {'app': '10·prova', 'sistema': 'prova'});

    /* Il manutentore risponde, e rileggendo si vede. */
    ponte.rispondeIlManutentore(7, 'Buona idea, la faccio.');
    await tester.tap(find.byTooltip('Rileggi'));
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 300)),
    );
    await tester.pumpAndSettle();
    expect(find.text('Buona idea, la faccio.'), findsOneWidget);
    expect(find.textContaining('chi fa l\'app'), findsWidgets);

    /* Si risponde dal fondo: la risposta arriva al ponte, e il filo la
     * mostra come terzo messaggio. */
    await tester.enterText(find.byType(TextField).last, 'Grazie!');
    await tester.tap(find.byTooltip('Manda'));
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 600)),
    );
    await tester.pumpAndSettle();
    expect(
      ponte.arrivati.where(
        (uno) => uno['type'] == 'ponte/segnalazioni/rispondi',
      ),
      hasLength(1),
    );
    expect((ponte.segnalazioni.single['messaggi'] as List), hasLength(3));
    expect(find.text('Grazie!'), findsWidgets);

    /* Tornando all'elenco, la segnalazione c'e', con i suoi tre messaggi. */
    await tester.pageBack();
    await tester.pump();
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 600)),
    );
    await tester.pumpAndSettle();
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 300)),
    );
    await tester.pumpAndSettle();
    /* L'insegna scrive in maiuscolo, come sulla plancia. */
    expect(find.text('LE TUE SEGNALAZIONI'), findsOneWidget);
    expect(find.text('Una tessera per la piscina'), findsOneWidget);
    expect(find.textContaining('3 messaggi'), findsOneWidget);

    await tester.runAsync(() async {
      await collegamento.chiudi();
      await ponte.spegni();
    });
  });

  testWidgets('senza centralino si dice, e non si puo\' scrivere', (
    tester,
  ) async {
    late PonteFinto ponte;
    late Collegamento collegamento;
    await tester.runAsync(() async {
      ponte = await PonteFinto.alza();
      ponte.conIlCentralino = false;
      collegamento = await _casaCollegata(ponte);
    });
    await tester.pumpWidget(
      MaterialApp(
        home: SchermataDelleSegnalazioni(
          collegamento: collegamento,
          diagnostica: _diagnostica,
        ),
      ),
    );
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 200)),
    );
    await tester.pumpAndSettle();
    expect(
      find.textContaining('non passa da nessun centralino'),
      findsOneWidget,
    );
    expect(find.text('Nuova segnalazione'), findsNothing);
    await tester.runAsync(() async {
      await collegamento.chiudi();
      await ponte.spegni();
    });
  });

  testWidgets('la chat di assistenza: si scrive, e la risposta torna', (
    tester,
  ) async {
    late PonteFinto ponte;
    late Collegamento collegamento;
    await tester.runAsync(() async {
      ponte = await PonteFinto.alza();
      collegamento = await _casaCollegata(ponte);
    });
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SchermataDellAssistenza(
            collegamento: collegamento,
            diagnostica: _diagnostica,
          ),
        ),
      ),
    );
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 200)),
    );
    await tester.pumpAndSettle();
    expect(find.text('Ciao'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'Buongiorno, una domanda.');
    await tester.tap(find.byTooltip('Manda'));
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 300)),
    );
    await tester.pumpAndSettle();
    expect(find.text('Buongiorno, una domanda.'), findsOneWidget);
    expect(find.text('Ciao'), findsNothing);
    expect(ponte.chat, isNotNull);
    final chat = Segnalazione.leggi(Map<String, dynamic>.from(ponte.chat!));
    expect(chat.messaggi.single.testo, 'Buongiorno, una domanda.');

    await tester.runAsync(() async {
      await collegamento.chiudi();
      await ponte.spegni();
    });
  });
}
