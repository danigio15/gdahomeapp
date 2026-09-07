/// Le prove delle schermate: dove finisce chi apre l'app.
///
/// Non si prova che sia bello: si prova **dove si finisce**, che e' l'unica
/// cosa dell'interfaccia che si possa affermare senza guardare uno schermo.
///
/// Una cosa da sapere per leggerle. Dentro `testWidgets` il tempo e' finto: i
/// timer non scattano da soli e le attese non scadono, perche' e' il `pump` a
/// far girare l'orologio. Il collegamento vero invece vuole rete vera e timer
/// veri, e in quel mondo li' non arriverebbe mai in fondo. Percio' il
/// collegamento si apre dentro `runAsync`, dove il tempo torna quello vero, e
/// solo dopo si disegna: quando la schermata compare, la casa e' gia' letta.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/main.dart';
import 'package:gdahome/ponte/indirizzo.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/aggiungi_casa.dart';

import 'ponte/ponte_finto.dart';

void main() {
  testWidgets('senza case si finisce sulla schermata per aggiungerne una', (
    tester,
  ) async {
    await tester.pumpWidget(AppDiCasa(cassaforte: CassaforteInMemoria()));
    await tester.pumpAndSettle();

    expect(find.text('Colleghiamo la casa'), findsOneWidget);
    expect(find.text('Abbina'), findsOneWidget);

    /* La cosa che si sta provando e' quello che **non** c'e'.
     *
     * Due caselle: il codice e il nome della casa. Nessun indirizzo, nessuna
     * porta, e soprattutto nessuna credenziale di Home Assistant — che e' una
     * promessa scritta a schermo, e la prima cosa che si romperebbe
     * rimettendo dentro un campo per volta. */
    expect(find.byType(TextField), findsNWidgets(2));
    expect(
      find.text('Indirizzo di Home Assistant in casa'),
      findsNothing,
      reason: 'con un centralino l\'indirizzo non lo deve battere nessuno',
    );
    expect(
      find.textContaining('Non ti verra\' mai chiesta la password'),
      findsOneWidget,
    );
  });

  testWidgets('senza codice non si abbina niente', (tester) async {
    await tester.pumpWidget(AppDiCasa(cassaforte: CassaforteInMemoria()));
    await tester.pumpAndSettle();

    /* Il modulo e' piu' alto della finestra di prova: senza questo, il tocco
     * cadrebbe fuori dallo schermo e non premerebbe niente. */
    await tester.ensureVisible(find.text('Abbina'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Abbina'));
    await tester.pump();

    expect(find.textContaining('Manca il codice'), findsOneWidget);
  });

  testWidgets(
    'l\'indirizzo si puo\' scrivere lo stesso, per chi ne ha bisogno',
    (tester) async {
      /* La casella c'e' ancora, ma sta chiusa: serve a chi il centralino non
       * ce l'ha, o a chi vuole abbinare senza far passare niente da fuori. Ci
       * si arriva da un bottone, e quello che si scrive dentro viene
       * controllato come prima. */
      await tester.pumpWidget(AppDiCasa(cassaforte: CassaforteInMemoria()));
      await tester.pumpAndSettle();

      expect(find.text('Indirizzo di casa (facoltativo)'), findsNothing);
      await tester.ensureVisible(
        find.textContaining('Il codice non funziona?'),
      );
      await tester.tap(find.textContaining('Il codice non funziona?'));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.widgetWithText(TextField, 'Indirizzo di casa (facoltativo)'),
        'non un indirizzo',
      );
      await tester.ensureVisible(find.text('Abbina'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Abbina'));
      await tester.pump();

      expect(find.text('L\'indirizzo di casa non si capisce.'), findsOneWidget);
    },
  );

  testWidgets(
    'un\'app senza centralino dice cosa manca, non «non ha funzionato»',
    (tester) async {
      /* Il caso di chi si compila l'app per conto suo senza accendere nessun
       * centralino. Li' l'indirizzo di casa serve davvero, la casella e' gia'
       * aperta, e se manca si dice **perche'** — non «riprova». */
      final archivio = ArchivioDelleCase(CassaforteInMemoria());
      await archivio.apri();

      await tester.pumpWidget(
        MaterialApp(
          home: AggiungiCasa(
            archivio: archivio,
            centralino: null,
            quandoFatto: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.text('Indirizzo di Home Assistant in casa'),
        findsOneWidget,
        reason: 'senza centralino l\'indirizzo e\' l\'unica strada, e si vede subito',
      );

      await tester.enterText(find.byType(TextField).first, 'ABCD2345');
      await tester.ensureVisible(find.text('Abbina'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Abbina'));
      await tester.pump();

      expect(find.textContaining('Serve l\'indirizzo di casa'), findsOneWidget);
    },
  );

  /* ─── Le prove con una casa collegata ───────────────────────────────────
   *
   * Tutto quello che tocca la rete sta dentro `runAsync`, **compresa
   * l'accensione del ponte finto**. Il giro che accetta le connessioni vive
   * nella zona in cui e' nato: acceso fuori da `runAsync` resterebbe nel tempo
   * finto, non risponderebbe mai a nessuno, e la prova si pianterebbe su una
   * rotella che gira. */

  testWidgets(
    'con una casa aperta la home mostra il riassunto e da dove si passa',
    (tester) async {
      late PonteFinto ponte;
      late Collegamento collegamento;

      await tester.runAsync(() async {
        ponte = await PonteFinto.alza();
        ponte.entita = [
          PonteFinto.unaEntita('light.cucina', 'on', nome: 'Cucina'),
          PonteFinto.unaEntita('light.salotto', 'on', nome: 'Salotto'),
          PonteFinto.unaEntita(
            'binary_sensor.f',
            'on',
            nome: 'Finestra',
            tipo: 'window',
          ),
          PonteFinto.unaEntita(
            'sensor.t',
            '21.0',
            tipo: 'temperature',
            unita: '°C',
          ),
        ];
        final archivio = ArchivioDelleCase(CassaforteInMemoria());
        await archivio.apri();
        await archivio.aggiungi(
          nome: 'Casa mia',
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

      await tester.pumpWidget(AppDiCasa(collegamento: collegamento));
      await tester.pump();
      await tester.pump();

      expect(find.text('Casa mia'), findsOneWidget);
      expect(find.text('in casa'), findsOneWidget);
      expect(find.text('2 accese'), findsOneWidget);
      expect(find.text('1 aperta'), findsOneWidget);
      expect(find.text('21.0°'), findsOneWidget);
      expect(find.text('Spegni tutte le luci'), findsOneWidget);
      /* I blocchi che non ci sono ancora si vedono lo stesso, spenti: cosi' si sa
     * dove sta andando l'app. */
      expect(find.text('Zigbee'), findsOneWidget);

      /* «Plancia» sta sotto il bordo, e una ListView costruisce solo quello
       * che si vede: per trovarla bisogna scorrere davvero, come farebbe un
       * dito. Ed e' anche il posto giusto in cui sta, perche' e' l'ultimo
       * blocco che arrivera'. */
      await tester.scrollUntilVisible(find.text('Plancia'), 120);
      expect(find.text('Plancia'), findsOneWidget);

      await tester.runAsync(() async {
        await collegamento.chiudi();
        await ponte.spegni();
      });
    },
  );

  testWidgets('da fuori casa la home lo scrive, ed e\' la stessa casa', (
    tester,
  ) async {
    late PonteFinto ponte;
    late Collegamento collegamento;

    await tester.runAsync(() async {
      ponte = await PonteFinto.alza();
      final finto = IndirizzoDelPonte.leggi('192.168.99.99')!;
      final archivio = ArchivioDelleCase(CassaforteInMemoria());
      await archivio.apri();
      await archivio.aggiungi(
        nome: 'Casa',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        inCasa: finto,
        daFuoriCasa: ponte.indirizzo,
      );
      collegamento = Collegamento(
        archivio: archivio,
        sonda: Sonda(bussa: (dove) async => dove == ponte.indirizzo.salute),
      );
      await collegamento.apri();
    });

    await tester.pumpWidget(AppDiCasa(collegamento: collegamento));
    await tester.pump();
    await tester.pump();

    expect(find.text('da fuori'), findsOneWidget);
    expect(find.text('Casa'), findsOneWidget);

    await tester.runAsync(() async {
      await collegamento.chiudi();
      await ponte.spegni();
    });
  });

  testWidgets('l\'elenco delle case fa passare dall\'una all\'altra', (
    tester,
  ) async {
    late PonteFinto mia;
    late PonteFinto loro;
    late ArchivioDelleCase archivio;
    late Collegamento collegamento;

    await tester.runAsync(() async {
      mia = await PonteFinto.alza();
      loro = await PonteFinto.alza();
      mia.entita = [
        PonteFinto.unaEntita('light.cucina', 'off', nome: 'Cucina'),
      ];
      loro.entita = [
        PonteFinto.unaEntita('light.salotto', 'off', nome: 'Salotto'),
      ];

      archivio = ArchivioDelleCase(CassaforteInMemoria());
      await archivio.apri();
      await archivio.aggiungi(
        nome: 'Casa mia',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        inCasa: mia.indirizzo,
      );
      await archivio.aggiungi(
        nome: 'Dai miei',
        segno: segnoBuono,
        identificativo: chiBuono,
        chiave: chiaveBuona,
        inCasa: loro.indirizzo,
      );
      collegamento = Collegamento(
        archivio: archivio,
        sonda: Sonda(bussa: (_) async => true),
      );
      await collegamento.apri();
    });

    await tester.pumpWidget(AppDiCasa(collegamento: collegamento));
    await tester.pump();
    await tester.pump();
    /* L'ultima aggiunta e' quella attiva: chi abbina una casa ci vuole entrare. */
    expect(find.text('Dai miei'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.swap_horiz));
    await tester.pumpAndSettle();
    expect(find.text('Le tue case'), findsOneWidget);
    expect(find.text('Casa mia'), findsOneWidget);

    /* Il cambio vero — filo giu', filo su — vuole di nuovo il tempo vero. */
    await tester.runAsync(
      () => collegamento.cambiaCasa(archivio.tutte.first.id),
    );
    await tester.pump();

    expect(collegamento.casa!.nome, 'Casa mia');
    expect(collegamento.stato!['light.cucina'], isNotNull);
    expect(
      collegamento.stato!['light.salotto'],
      isNull,
      reason: 'la casa di prima non deve restare mescolata',
    );

    await tester.runAsync(() async {
      await collegamento.chiudi();
      await mia.spegni();
      await loro.spegni();
    });
  });

  testWidgets('una casa che non risponde lo dice invece di girare a vuoto', (
    tester,
  ) async {
    late Collegamento collegamento;

    await tester.runAsync(() async {
      final archivio = ArchivioDelleCase(CassaforteInMemoria());
      await archivio.apri();
      await archivio.aggiungi(
        nome: 'Casa',
        segno: 'x',
        identificativo: chiBuono,
        chiave: chiaveBuona,
        inCasa: IndirizzoDelPonte.leggi('192.168.99.99')!,
      );
      collegamento = Collegamento(
        archivio: archivio,
        sonda: Sonda(
          bussa: (_) async => false,
          attesa: const Duration(milliseconds: 50),
        ),
      );
      await collegamento.apri();
    });

    await tester.pumpWidget(AppDiCasa(collegamento: collegamento));
    await tester.pump();
    await tester.pump();

    expect(find.text('Non trovo la casa'), findsOneWidget);
    /* Non un «non ha funzionato» generico: questa casa si raggiunge solo dalla
     * sua rete perche' nel ponte non e' stato messo nessun centralino, e
     * glielo si dice — con scritto dove si mette. */
    expect(find.textContaining('solo dalla sua rete'), findsOneWidget);

    await tester.runAsync(() => collegamento.chiudi());
  });
}
