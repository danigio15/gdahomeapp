/// Le prove delle schermate delle segnalazioni e dell'assistenza: si apre
/// una segnalazione dalla barra, si vede il filo, si scrive in chat.
library;

import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/allegati.dart';
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

/* La pagina e' piu' alta della finestra di prova, e la lista costruisce
 * solo quello che si vede: un bottone in fondo **non esiste** finche' non ci
 * si scorre. Si scorre come farebbe un dito, finche' compare. */
Future<void> _scorriFinoA(WidgetTester tester, Finder cosa) async {
  await tester.scrollUntilVisible(
    cosa,
    200,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.pumpAndSettle();
}

/* Un giro di andata e ritorno col ponte finto ha bisogno del tempo vero —
 * i socket parlano solo li' — e le continuazioni dell'app girano nel tempo
 * finto, a ogni `pump`. Quando un gesto fa due viaggi di fila, come mandare
 * una segnalazione e poi la sua foto, ci vogliono piu' giri alternati. */
Future<void> _lasciaFare(WidgetTester tester) async {
  for (var giro = 0; giro < 5; giro += 1) {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 250)),
    );
    await tester.pump();
  }
  await tester.pumpAndSettle();
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
    await _scorriFinoA(tester, find.text('Manda'));
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

  testWidgets('una foto scelta si allega alla segnalazione, e poi al filo', (
    tester,
  ) async {
    late PonteFinto ponte;
    late Collegamento collegamento;
    await tester.runAsync(() async {
      ponte = await PonteFinto.alza();
      collegamento = await _casaCollegata(ponte);
    });
    /* Il selettore del sistema nelle prove non c'e': al suo posto una
     * funzione che torna una foto finta, e si ricorda cosa le e' stato
     * chiesto. */
    final chieste = <DaDoveLAllegato>[];
    Future<Allegato?> scegliFinto(DaDoveLAllegato daDove) async {
      chieste.add(daDove);
      return Allegato(
        nome: daDove == DaDoveLAllegato.video ? 'clip.mp4' : 'cucina.jpg',
        tipo: daDove == DaDoveLAllegato.video ? 'video/mp4' : 'image/jpeg',
        byte: Uint8List.fromList(List.filled(300, 7)),
      );
    }

    await tester.pumpWidget(
      MaterialApp(
        home: SchermataDelleSegnalazioni(
          collegamento: collegamento,
          diagnostica: _diagnostica,
          scegli: scegliFinto,
        ),
      ),
    );
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 200)),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Nuova segnalazione'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextField, 'In due parole'),
      'La luce lampeggia',
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'Racconta'),
      'Si vede nel video.',
    );
    /* Si sceglie una foto: compare fra gli allegati, col suo peso. */
    await _scorriFinoA(tester, find.text('Foto'));
    await tester.tap(find.text('Foto'));
    await tester.pumpAndSettle();
    expect(chieste, [DaDoveLAllegato.galleria]);
    expect(find.text('cucina.jpg · 300 B'), findsOneWidget);
    /* E un video. */
    await tester.tap(find.text('Video'));
    await tester.pumpAndSettle();
    expect(find.text('clip.mp4 · 300 B'), findsOneWidget);
    /* Uno si toglie. */
    await tester.tap(find.byTooltip('Togli').last);
    await tester.pumpAndSettle();
    expect(find.text('clip.mp4 · 300 B'), findsNothing);

    await _scorriFinoA(tester, find.text('Manda'));
    await tester.tap(find.text('Manda'));
    await _lasciaFare(tester);

    /* Prima la segnalazione, poi la foto; nel filo c'e' il messaggio che
     * la indica. */
    expect(ponte.allegati, hasLength(1));
    expect(ponte.allegati.single['nome'], 'cucina.jpg');
    expect(ponte.allegati.single['byte'], 300);
    expect(find.text('📷 cucina.jpg (300 B)'), findsOneWidget);

    /* Dal filo si allega ancora, dalla graffetta. */
    await tester.tap(find.byTooltip('Allega'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Un video dalla galleria'));
    await _lasciaFare(tester);
    expect(ponte.allegati, hasLength(2));
    /* Un video ha il suo disegno: lo sceglie il tipo, non il nome. */
    expect(find.text('🎬 clip.mp4 (300 B)'), findsOneWidget);

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

  testWidgets('i filtri dell\'elenco: gli stessi della dashboard, coi conti', (
    tester,
  ) async {
    late PonteFinto ponte;
    late Collegamento collegamento;
    await tester.runAsync(() async {
      ponte = await PonteFinto.alza();
      collegamento = await _casaCollegata(ponte);
      /* Tre segnalazioni, una per gruppo: e' la coda su cui i filtri hanno
       * qualcosa da dire. Lo stato lo scrive il centralino, e «in-carico» e'
       * quello che mette quando una issue e' assegnata a qualcuno. */
      ponte.segnalazioni.addAll([
        {
          'numero': 1,
          'tipo': 'problema',
          'titolo': 'La luce della cucina',
          'stato': 'aperta',
          'aperta_il': '2026-09-08T10:00:00Z',
          'url': '',
          'messaggi': [
            {'da': 'casa', 'testo': 'non si accende', 'il': ''},
          ],
        },
        {
          'numero': 2,
          'tipo': 'idea',
          'titolo': 'Una tessera per la piscina',
          'stato': 'in-carico',
          'aperta_il': '2026-09-08T11:00:00Z',
          'url': '',
          'messaggi': [
            {'da': 'casa', 'testo': 'sarebbe bello', 'il': ''},
          ],
        },
        {
          'numero': 3,
          'tipo': 'domanda',
          'titolo': 'Come si abbina un telefono',
          'stato': 'chiusa',
          'aperta_il': '2026-09-08T12:00:00Z',
          'url': '',
          'messaggi': [
            {'da': 'casa', 'testo': 'come si fa?', 'il': ''},
          ],
        },
      ]);
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

    /* I quattro tasti ci sono, con le parole della dashboard. */
    for (final nome in ['Da lavorare', 'In lavorazione', 'Chiuse', 'Tutte']) {
      expect(find.text(nome), findsOneWidget, reason: nome);
    }
    /* E i conti: uno per gruppo, e tre in «Tutte». Sono quello che dice cosa
     * c'e' prima di premere. */
    expect(find.text('3'), findsOneWidget);
    expect(find.text('1'), findsNWidgets(3));

    /* Si parte da «Tutte»: ci sono tutte e tre. */
    expect(find.text('La luce della cucina'), findsOneWidget);
    expect(find.text('Una tessera per la piscina'), findsOneWidget);
    expect(find.text('Come si abbina un telefono'), findsOneWidget);

    /* «Chiuse» lascia la chiusa e porta via le altre. */
    await tester.tap(find.text('Chiuse'));
    await tester.pumpAndSettle();
    expect(find.text('Come si abbina un telefono'), findsOneWidget);
    expect(find.text('La luce della cucina'), findsNothing);
    expect(find.text('Una tessera per la piscina'), findsNothing);

    /* «In lavorazione» e' il gruppo di mezzo, quello che senza tre stati non
     * si potrebbe nemmeno mostrare. */
    await tester.tap(find.text('In lavorazione'));
    await tester.pumpAndSettle();
    expect(find.text('Una tessera per la piscina'), findsOneWidget);
    expect(find.text('in lavorazione'), findsOneWidget);
    expect(find.text('Come si abbina un telefono'), findsNothing);

    /* Un gruppo vuoto lo dice, e dice anche cosa premere. */
    await tester.tap(find.text('Da lavorare'));
    await tester.pumpAndSettle();
    expect(find.text('La luce della cucina'), findsOneWidget);

    await tester.tap(find.text('Tutte'));
    await tester.pumpAndSettle();
    expect(find.text('Come si abbina un telefono'), findsOneWidget);

    await tester.runAsync(() async {
      await collegamento.chiudi();
      await ponte.spegni();
    });
  });
}
