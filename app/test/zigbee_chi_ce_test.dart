/// Chi c'è già nella rete, la sua scheda, e la mappa (#128).
///
/// «Voglio vedere elenco completo dei dispositivi e poterli eliminare e
/// eventualmente associare dispositivi già esistenti nella plancia. Crea
/// inoltre la possibilità di mostrare la mappa di collegamento.»
///
/// Le quattro cose stanno nella stessa sezione ma non allo stesso livello: i
/// passi dell'abbinamento vanno in un verso solo e da loro non si torna
/// indietro, mentre da una scheda e da una mappa si torna sempre — ci si è
/// andati a guardare qualcosa. Qui si difende anche quello.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/casa/zigbee.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/zigbee.dart';
import 'package:gdahome/vestito/tema.dart';

import 'ponte/ponte_finto.dart';

/* Una rete come una casa vera: l'antenna, un ripetitore a corrente, e due
 * cose a batteria in fondo a un ramo. */
final _inRete = <Map<String, Object?>>[
  {
    'id': '0x00',
    'nome': 'Antenna',
    'marca': 'Nabu Casa',
    'modello': 'SkyConnect',
    'tipo': 'coordinatore',
    'potenza': 'rete',
    'dispositivo': 'dev-antenna',
  },
  {
    'id': '0x01',
    'nome': 'Presa cucina',
    'marca': 'Xiaomi',
    'modello': 'ZNCZ12LM',
    'tipo': 'router',
    'potenza': 'rete',
    'dispositivo': 'dev-presa',
  },
  {
    'id': '0x02',
    'nome': 'Porta ingresso',
    'marca': 'Aqara',
    'modello': 'MCCGQ11LM',
    'tipo': 'terminale',
    'potenza': 'batteria',
    'dispositivo': 'dev-porta',
  },
];

void main() {
  late PonteFinto ponte;
  late Collegamento collegamento;

  Future<void> respira(WidgetTester tester) async {
    for (var giro = 0; giro < 6; giro += 1) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 120)),
      );
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  Future<void> unaCasa(WidgetTester tester) async {
    await tester.runAsync(() async {
      ponte = await PonteFinto.alza();
      ponte.laReteZigbee = 'zha';
      ponte.inReteZigbee
        ..clear()
        ..addAll(_inRete.map((una) => Map<String, Object?>.from(una)));
      ponte.entitaDelDispositivoZigbee['dev-porta'] = [
        {
          'entity': 'binary_sensor.porta_ingresso',
          'classe': 'door',
          'categoria': '',
        },
      ];
      final archivio = ArchivioDelleCase(CassaforteInMemoria());
      await archivio.aggiungi(
        nome: 'Casa',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        inCasa: ponte.indirizzo,
      );
      collegamento = Collegamento(
        archivio: archivio,
        sonda: Sonda(bussa: (dove) async => dove == ponte.indirizzo.salute),
      );
      await collegamento.apri();
    });
    addTearDown(() async {
      await collegamento.chiudi();
      await ponte.spegni();
    });
  }

  Future<void> apri(
    WidgetTester tester, {
    void Function(DispositivoEntrato)? allaPlancia,
  }) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: temaChiaro(),
        home: Scaffold(
          body: SchermataZigbee(
            collegamento: collegamento,
            visibile: true,
            quandoVaMessoNellaPlancia: allaPlancia,
          ),
        ),
      ),
    );
    await tester.pump();
    await respira(tester);
  }

  Future<void> premi(WidgetTester tester, Finder cosa) async {
    await tester.ensureVisible(cosa);
    await tester.pump();
    await tester.tap(cosa);
    await respira(tester);
  }

  testWidgets('sotto il tasto c\'è chi c\'è già, con quanti sono', (
    tester,
  ) async {
    await unaCasa(tester);
    await apri(tester);
    expect(find.text('CE NE SONO 3'), findsOneWidget);
    expect(find.text('Antenna'), findsOneWidget);
    expect(find.text('Presa cucina'), findsOneWidget);
    /* Sotto il nome c'è marca e modello: è quello che fa dire «ah, è quello»
     * a chi guarda un elenco di nomi che ha scelto mesi fa. */
    expect(find.text('Xiaomi ZNCZ12LM'), findsOneWidget);
  });

  testWidgets('in una casa senza rete l\'elenco non c\'è, e non è un errore', (
    tester,
  ) async {
    await tester.runAsync(() async {
      ponte = await PonteFinto.alza();
      ponte.laReteZigbee = '';
      final archivio = ArchivioDelleCase(CassaforteInMemoria());
      await archivio.aggiungi(
        nome: 'Casa',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        inCasa: ponte.indirizzo,
      );
      collegamento = Collegamento(
        archivio: archivio,
        sonda: Sonda(bussa: (dove) async => dove == ponte.indirizzo.salute),
      );
      await collegamento.apri();
    });
    addTearDown(() async {
      await collegamento.chiudi();
      await ponte.spegni();
    });
    await apri(tester);
    expect(find.textContaining('CE NE SONO'), findsNothing);
  });

  testWidgets('toccando una riga si apre la sua scheda, e si torna indietro', (
    tester,
  ) async {
    await unaCasa(tester);
    await apri(tester);
    await premi(tester, find.text('Presa cucina'));
    /* La scheda: cos'è, che mestiere fa, e la targa in chiaro — che è quello
     * che si incolla in una segnalazione. */
    expect(find.text('Fa da ponte per gli altri'), findsOneWidget);
    expect(find.text('0x01'), findsOneWidget);
    expect(find.text('Togli dalla rete'), findsOneWidget);
    /* E il «indietro» c'è, perché da qui ha senso: ci si è venuti a guardare
     * qualcosa. Nei passi dell'abbinamento non c'è, e non deve esserci. */
    expect(find.byType(BackButton), findsOneWidget);
  });

  testWidgets('a batteria si dice, e «non si sa» non diventa «a corrente»', (
    tester,
  ) async {
    await unaCasa(tester);
    await apri(tester);
    await premi(tester, find.text('Porta ingresso'));
    expect(find.textContaining('va a batteria'), findsOneWidget);
    expect(find.text('Sta in fondo a un ramo · va a batteria'), findsOneWidget);
  });

  testWidgets('togliere chiede conferma, e dice cosa costa rimetterlo', (
    tester,
  ) async {
    await unaCasa(tester);
    await apri(tester);
    await premi(tester, find.text('Porta ingresso'));
    await premi(tester, find.text('Togli dalla rete'));
    /* Non «vuoi procedere»: si dice la parte che costa. */
    expect(find.textContaining('riabbinarlo da qui'), findsOneWidget);
    /* E si può ancora dire di no. */
    expect(find.text('Lascia stare'), findsOneWidget);
    await premi(tester, find.text('Lascia stare'));
    expect(ponte.inReteZigbee.length, 3, reason: 'non si è tolto niente');
  });

  testWidgets('chi regge gli altri lo dice, prima di toglierlo', (
    tester,
  ) async {
    await unaCasa(tester);
    await apri(tester);
    await premi(tester, find.text('Presa cucina'));
    await premi(tester, find.text('Togli dalla rete'));
    /* Togliere un ripetitore non è come togliere un sensore: quello che ci
     * passava deve trovarsi un'altra strada. */
    expect(
      find.textContaining('tiene su la rete per gli altri'),
      findsOneWidget,
    );
  });

  testWidgets('confermato, sparisce dalla rete e dall\'elenco', (tester) async {
    await unaCasa(tester);
    await apri(tester);
    await premi(tester, find.text('Porta ingresso'));
    await premi(tester, find.text('Togli dalla rete'));
    await premi(tester, find.text('Toglilo'));
    /* La scheda si chiude scorrendo via, e finche' scorre sta ancora in
     * pagina: senza aspettare che finisca si troverebbe il nome di uno che
     * non c'e' piu' e si direbbe che e' un errore dell'app. */
    await tester.pump(const Duration(milliseconds: 400));
    expect(ponte.inReteZigbee.length, 2);
    /* E tornando indietro l'elenco si è già rifatto: una riga rimasta lì
     * sarebbe una bugia. */
    expect(find.text('CE NE SONO 2'), findsOneWidget);
    expect(find.text('Porta ingresso'), findsNothing);
  });

  testWidgets(
    '«Mettilo nella plancia» consegna le entità, non un guscio vuoto',
    (tester) async {
      DispositivoEntrato? consegnato;
      await unaCasa(tester);
      await apri(tester, allaPlancia: (suo) => consegnato = suo);
      await premi(tester, find.text('Porta ingresso'));
      await premi(tester, find.text('Mettilo nella plancia'));
      expect(consegnato, isNotNull);
      /* È la riga che rende vero il tasto: il foglietto «Dove lo metto?» la
     * sezione la decide dall'ENTITÀ, e senza queste avrebbe proposto niente. */
      expect(consegnato!.entita.length, 1);
      expect(consegnato!.entita.first.entity, 'binary_sensor.porta_ingresso');
      expect(consegnato!.entita.first.classe, 'door');
    },
  );

  testWidgets('la mappa non si rifà da sola: aprirla non tocca la rete', (
    tester,
  ) async {
    await unaCasa(tester);
    await apri(tester);
    await premi(tester, find.text('Guarda la rete'));
    /* Il giro vero dura fino a un minuto e mentre lo fa la rete è occupata:
     * farlo partire da solo a ogni apertura vorrebbe dire le luci di casa più
     * lente ogni volta che qualcuno guarda questa pagina. */
    expect(ponte.mappeRifatte, 0);
    expect(find.text('Rifai il giro'), findsOneWidget);
  });

  testWidgets('senza mappa si dice perché, invece di una figura vuota', (
    tester,
  ) async {
    await unaCasa(tester);
    await apri(tester);
    await premi(tester, find.text('Guarda la rete'));
    expect(find.textContaining('non ha ancora guardato'), findsOneWidget);
  });

  testWidgets('premendo «Rifai il giro» la mappa arriva e si vede', (
    tester,
  ) async {
    await unaCasa(tester);
    ponte.mappaZigbee =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">'
        '<circle cx="5" cy="5" r="4" fill="#7c3aed"/></svg>';
    await apri(tester);
    await premi(tester, find.text('Guarda la rete'));
    await premi(tester, find.text('Rifai il giro'));
    expect(ponte.mappeRifatte, 1);
    expect(find.textContaining('non ha ancora guardato'), findsNothing);
  });

  /* ── Che sul telefono la mappa si legga ────────────────────────────────
   *
   * Dal campo, con lo scatto: «La mappa dopo vari tentativi si e caricata ma
   * non si vede nulla e non si puo ne fare zoom ne niente». Erano due cose: il
   * disegno di una casa con ottanta apparecchi e' largo due metri di schermo —
   * e quello si e' corretto nel ponte, dove si disegna — e qui dentro non si
   * poteva ingrandire, perche' la figura stava in una lista che si prende il
   * dito.
   *
   * Qui si difende quello che si e' fatto di conseguenza: la figura si apre in
   * una pagina sua, dove il dito serve solo a lei, e sotto ci sono i rami in
   * parole, che su un telefono sono la cosa che si legge davvero. */
  void conIRami() {
    ponte.mappaZigbee =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">'
        '<circle cx="5" cy="5" r="4" fill="#7c3aed"/></svg>';
    ponte.ramiZigbee = [
      {
        'id': '0x00',
        'nome': 'Antenna',
        'tipo': 'coordinatore',
        'potenza': 'rete',
        'qualita': null,
        'appesi': <Object?>[],
      },
      {
        'id': '0x01',
        'nome': 'Presa cucina',
        'tipo': 'router',
        'potenza': 'rete',
        'qualita': 200,
        'appesi': [
          {
            'id': '0x02',
            'nome': 'Porta ingresso',
            'tipo': 'terminale',
            'potenza': 'batteria',
            'qualita': 30,
          },
        ],
      },
    ];
    ponte.soliZigbee = [
      {
        'id': '0x09',
        'nome': 'Sensore terrazzo',
        'tipo': 'terminale',
        'potenza': 'batteria',
        'qualita': null,
      },
    ];
  }

  testWidgets('la rete si legge anche a righe: chi regge chi, e quanto bene', (
    tester,
  ) async {
    await unaCasa(tester);
    conIRami();
    await apri(tester);
    await premi(tester, find.text('Guarda la rete'));
    expect(find.text('Chi regge chi'), findsOneWidget);
    /* Piu' d'uno: gli stessi nomi stanno anche nell'elenco dei dispositivi, che
     * e' la pagina da cui si e' arrivati. Qui conta che ci siano. */
    expect(find.text('Presa cucina'), findsAtLeastNWidgets(1));
    expect(find.text('Porta ingresso'), findsAtLeastNWidgets(1));
    /* Un filo sotto cinquanta e' un filo che si spezza appena qualcuno accende
     * il microonde: si dice in una parola, perche' un numero da zero a
     * duecentocinquantacinque non lo legge nessuno. */
    expect(find.text('debole'), findsOneWidget);
    /* E chi non parla con nessuno sta in fondo, come nel disegno. */
    expect(find.text('Sensore terrazzo'), findsOneWidget);
  });

  testWidgets('il disegno si apre in una pagina sua, dove si ingrandisce', (
    tester,
  ) async {
    await unaCasa(tester);
    conIRami();
    await apri(tester);
    await premi(tester, find.text('Guarda la rete'));
    /* Nella pagina della rete la figura non si ingrandisce: e' un'anteprima, e
     * il dito serve alla lista. */
    expect(find.byType(InteractiveViewer), findsNothing);
    await premi(tester, find.textContaining('Tocca per aprirla'));
    /* Aperta, invece, c'e' solo lei — e i tre tasti per muoversi. */
    expect(find.byType(InteractiveViewer), findsOneWidget);
    /* Per il nome e non per l'icona: l'icona dell'ingrandimento sta anche
     * sull'anteprima, nella pagina di sotto. */
    expect(find.byTooltip('Ingrandisci'), findsOneWidget);
    expect(find.byTooltip('Rimpicciolisci'), findsOneWidget);
    expect(find.byTooltip('Tutta intera'), findsOneWidget);
    /* E si sposta davvero: senza margine infinito un disegno grande quanto la
     * finestra non si muove di un pixel, che e' il difetto segnalato. */
    final viewer = tester.widget<InteractiveViewer>(
      find.byType(InteractiveViewer),
    );
    expect(viewer.boundaryMargin, const EdgeInsets.all(double.infinity));
    expect(viewer.maxScale, greaterThan(4));
  });
}
