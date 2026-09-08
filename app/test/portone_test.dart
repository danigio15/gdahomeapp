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
import 'package:gdahome/schermate/lettore.dart';
import 'package:gdahome/schermate/plancia/plancia.dart';

import 'plancia/casa_demo.dart';
import 'ponte/ponte_finto.dart';

/// Aspetta che la casa abbia risposto anche sulla plancia: finche' non lo
/// fa, la home mostra una rotella, e una rotella non si «assesta» mai.
Future<void> _finoAllaPlancia(Collegamento collegamento) async {
  final fine = DateTime.now().add(const Duration(seconds: 5));
  while (!collegamento.planciaLetta && DateTime.now().isBefore(fine)) {
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
}

void main() {
  testWidgets('senza case si finisce sulla schermata per aggiungerne una', (
    tester,
  ) async {
    await tester.pumpWidget(AppDiCasa(cassaforte: CassaforteInMemoria()));
    await tester.pumpAndSettle();

    expect(find.text('Colleghiamo la casa'), findsOneWidget);
    expect(find.text('Inquadra il codice'), findsOneWidget);

    /* La cosa che si sta provando e' quello che **non** c'e'.
     *
     * Una casella sola, e non e' nemmeno il codice: e' il nome della casa.
     * Nessun indirizzo, nessuna porta, nessun codice da battere, e soprattutto
     * nessuna credenziale di Home Assistant — che e' una promessa scritta a
     * schermo, e la prima cosa che si romperebbe rimettendo dentro un campo
     * per volta. */
    expect(find.byType(TextField), findsOneWidget);
    expect(find.text('Indirizzo di Home Assistant in casa'), findsNothing);
    expect(find.text('Indirizzo di casa (facoltativo)'), findsNothing);
    expect(
      find.textContaining('Non ti verra\' mai chiesta la password'),
      findsOneWidget,
    );
  });

  testWidgets('quello che si inquadra si legge, e si abbina da solo', (
    tester,
  ) async {
    /* La prova di quello che fa questa schermata di quello che ha letto.
     *
     * La fotocamera qui non c'e' — nelle prove non c'e' mai — e non e' lei che
     * si sta provando: e' la decisione che viene dopo. Quel quadretto li' dice
     * un indirizzo di casa che non risponde e nessun centralino, quindi si
     * arriva fin dove si puo' arrivare senza rete, e quello che si vede e' che
     * l'invito e' stato letto per intero. */
    final archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.apri();

    await tester.pumpWidget(
      MaterialApp(
        home: AggiungiCasa(
          archivio: archivio,
          centralino: null,
          quandoFatto: (_) {},
          inquadra: (_) async =>
              const UnQuadretto('gdahome|1|ABCD2345EFGH6789||'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Inquadra il codice'));
    await tester.pumpAndSettle();

    expect(
      find.textContaining('non dice da dove si entra'),
      findsOneWidget,
      reason:
          'l\'invito e\' stato letto, e si e\' arrivati a scegliere la strada',
    );
  });

  testWidgets('un quadretto che non e\' nostro lo dice, e non «riprova»', (
    tester,
  ) async {
    final archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.apri();

    await tester.pumpWidget(
      MaterialApp(
        home: AggiungiCasa(
          archivio: archivio,
          quandoFatto: (_) {},
          inquadra: (_) async =>
              const UnQuadretto('https://www.esempio.it/qualcosa'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Inquadra il codice'));
    await tester.pumpAndSettle();

    expect(find.textContaining('non e\' un codice di gdahome'), findsOneWidget);
  });

  testWidgets('un quadretto di un ponte piu\' nuovo manda ad aggiornare', (
    tester,
  ) async {
    /* La differenza che conta: «non ti capisco» manda a controllare il codice,
     * «sei vecchia» manda ad aggiornare l'app. Sono due strade diverse, e
     * indovinare quale sia tocca a noi. */
    final archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.apri();

    await tester.pumpWidget(
      MaterialApp(
        home: AggiungiCasa(
          archivio: archivio,
          quandoFatto: (_) {},
          inquadra: (_) async => const UnQuadretto('gdahome|9|ABCD||'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Inquadra il codice'));
    await tester.pumpAndSettle();

    expect(find.textContaining('aggiorna l\'app'), findsOneWidget);
  });

  testWidgets('se la fotocamera non c\'e\', le lettere si aprono da sole', (
    tester,
  ) async {
    /* Il caso che si dimentica: chi apre il lettore e trova una fotocamera che
     * non si apre non ha «annullato». Riportarlo alla schermata di prima con
     * in mezzo allo schermo lo stesso bottone che ha appena fallito vuol dire
     * lasciarlo li'. */
    final archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.apri();

    await tester.pumpWidget(
      MaterialApp(
        home: AggiungiCasa(
          archivio: archivio,
          quandoFatto: (_) {},
          inquadra: (_) async => const SiScriveAMano(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Inquadra il codice'));
    await tester.pumpAndSettle();

    expect(
      find.widgetWithText(TextField, 'Le lettere sotto al quadretto'),
      findsOneWidget,
    );
  });

  testWidgets('tornare indietro dal lettore non e\' un errore', (tester) async {
    /* Chi apre il lettore e poi cambia idea non ha sbagliato niente, e non
     * deve trovarsi un messaggio rosso addosso. */
    final archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.apri();

    await tester.pumpWidget(
      MaterialApp(
        home: AggiungiCasa(
          archivio: archivio,
          quandoFatto: (_) {},
          inquadra: (_) async => const NienteDaLeggere(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Inquadra il codice'));
    await tester.pumpAndSettle();

    expect(find.text('Inquadra il codice'), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget);
    /* Le due cose che si direbbero di un quadretto letto male: nessuna delle
     * due, perche' non si e' letto niente. */
    expect(find.textContaining('Inquadra quello che sta'), findsNothing);
    expect(find.textContaining('aggiorna l\'app'), findsNothing);
  });

  testWidgets('senza codice non si abbina niente', (tester) async {
    await tester.pumpWidget(AppDiCasa(cassaforte: CassaforteInMemoria()));
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.textContaining('Scrivilo a mano'));
    await tester.tap(find.textContaining('Scrivilo a mano'));
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
      /* La casella c'e' ancora, ma sta di la': serve a chi il centralino non
       * ce l'ha, o a chi vuole abbinare senza far passare niente da fuori. Ci
       * si arriva dallo stesso bottone delle lettere, e quello che si scrive
       * dentro viene controllato come prima. */
      await tester.pumpWidget(AppDiCasa(cassaforte: CassaforteInMemoria()));
      await tester.pumpAndSettle();

      expect(find.text('Indirizzo di casa (facoltativo)'), findsNothing);
      await tester.ensureVisible(find.textContaining('Scrivilo a mano'));
      await tester.tap(find.textContaining('Scrivilo a mano'));
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
       * centralino. Li' l'indirizzo di casa serve davvero — a meno che non lo
       * dica il quadretto — e se manca si dice **perche'**, non «riprova». */
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

      await tester.ensureVisible(find.textContaining('Scrivilo a mano'));
      await tester.tap(find.textContaining('Scrivilo a mano'));
      await tester.pumpAndSettle();

      expect(
        find.text('Indirizzo di Home Assistant in casa'),
        findsOneWidget,
        reason:
            'senza centralino l\'indirizzo e\' l\'unica strada battuta a mano',
      );

      await tester.enterText(
        find.widgetWithText(TextField, 'Le lettere sotto al quadretto'),
        'ABCD2345EFGH6789',
      );
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
    'con una casa aperta la home e\' la plancia, e il menu porta al resto',
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
        await _finoAllaPlancia(collegamento);
      });

      await tester.pumpWidget(AppDiCasa(collegamento: collegamento));
      await tester.pump();
      await tester.pump();

      expect(find.text('Casa mia'), findsOneWidget);
      expect(find.text('in casa'), findsOneWidget);
      /* La cosa che si sta provando e' quello che **non** c'e'. La prima
       * schermata e' la plancia: nessuna entita', nessun contatore, nessun
       * bottone per spegnere le luci. Quelle cose stanno dietro il menu. */
      expect(find.text('Cucina'), findsNothing);
      expect(find.textContaining('accese'), findsNothing);
      expect(find.textContaining('Spegni'), findsNothing);
      expect(find.text('Dispositivi'), findsNothing);

      /* Il menu: per etichetta e non per icona, perche' l'etichetta e' quello
       * che legge chi usa l'app senza vederla. */
      await tester.tap(find.byTooltip('Menu'));
      await tester.pumpAndSettle();
      expect(find.text('Home'), findsOneWidget);
      expect(find.text('Dispositivi'), findsOneWidget);
      /* I blocchi che non ci sono ancora si vedono lo stesso, spenti: cosi'
       * si sa dove sta andando l'app. */
      expect(find.text('Aiutanti'), findsOneWidget);
      expect(find.text('Zigbee'), findsOneWidget);
      expect(find.text('Automazioni'), findsOneWidget);
      expect(find.text('presto'), findsNWidgets(3));
      expect(find.text('Le tue case'), findsOneWidget);
      /* Il nome della casa sta anche nel menu, con da dove si passa. */
      expect(find.text('Casa mia'), findsNWidgets(2));

      /* Da li' ai dispositivi: il menu si chiude, la sezione cambia, e le
       * entita' compaiono adesso — non prima. */
      await tester.tap(find.text('Dispositivi'));
      await tester.pumpAndSettle();
      expect(find.text('Dispositivi'), findsOneWidget, reason: 'il titolo');
      expect(find.text('Luci'), findsOneWidget);
      expect(find.text('Cucina'), findsOneWidget);
      expect(find.text('Salotto'), findsOneWidget);
      expect(find.text('Home'), findsNothing, reason: 'il menu e\' chiuso');

      await tester.runAsync(() async {
        await collegamento.chiudi();
        await ponte.spegni();
      });
    },
  );

  testWidgets(
    'con DashboardModern configurata la home e\' la plancia: persone, tessere, azioni',
    (tester) async {
      /* La casa demo di DashboardModern: quello che compare qui sono gli
       * stessi numeri delle anteprime della plancia web. */
      final demo = CasaDemo.leggi();
      late PonteFinto ponte;
      late Collegamento collegamento;

      await tester.runAsync(() async {
        ponte = await PonteFinto.alza();
        ponte.entita = demo.grezze;
        ponte.configurazione = demo.risposta;
        final archivio = ArchivioDelleCase(CassaforteInMemoria());
        await archivio.apri();
        await archivio.aggiungi(
          nome: 'Smart Home',
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
        await _finoAllaPlancia(collegamento);
      });

      await tester.pumpWidget(AppDiCasa(collegamento: collegamento));
      await tester.pump();
      await tester.pump();

      /* Le persone stanno in cima, coi loro numeri. */
      expect(find.text('PERSONE'), findsOneWidget);
      expect(find.text('Giovanni'), findsOneWidget);
      expect(find.text('Laura'), findsOneWidget);
      expect(find.text('82%'), findsOneWidget);
      expect(find.text('Casa'), findsOneWidget, reason: 'Giovanni e\' a casa');
      expect(find.text('Fuori'), findsOneWidget, reason: 'Laura e\' fuori');
      expect(find.text('Ufficio'), findsOneWidget, reason: 'Marco e\' in zona');

      /* Le tessere, coi numeri della plancia web. Stanno sotto, e una
       * ListView costruisce solo quello che si vede. «LUCI» sta anche fra
       * le azioni rapide: si cerca dentro le tessere. */
      Finder tessera(String testo) => find.descendant(
        of: find.byType(TesseraDellaHome),
        matching: find.text(testo),
      );
      await tester.scrollUntilVisible(
        tessera('LUCI'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(tessera('LUCI'), findsOneWidget);
      expect(tessera('4'), findsWidgets);
      expect(tessera('CLIMA'), findsOneWidget);
      expect(tessera('22,5'), findsOneWidget);
      /* Le tessere che chiedono attenzione stanno scritte per nome
       * nell'intestazione: la batteria di Marco al 9% e la finestra aperta
       * in cucina. */
      expect(
        find.textContaining('chiedono attenzione: Batterie, Finestra cucina'),
        findsOneWidget,
      );
      await tester.scrollUntilVisible(
        find.text('AZIONI RAPIDE'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('AZIONI RAPIDE'), findsOneWidget);
      expect(find.text('CANCELLO'), findsOneWidget);

      /* La finestra di una tessera: le luci, con gli interruttori. La
       * tessera esiste ancora ma e' scorsa via: la si riporta a schermo, se
       * no il tocco cade nel vuoto. */
      await tester.ensureVisible(tessera('LUCI'));
      await tester.pumpAndSettle();
      await tester.tap(tessera('LUCI'));
      await tester.pumpAndSettle();
      expect(find.text('Faretti soggiorno'), findsOneWidget);
      expect(find.text('Tutto regolare'), findsNothing);
      expect(find.text('In corso'), findsOneWidget);

      await tester.runAsync(() async {
        await collegamento.chiudi();
        await ponte.spegni();
      });
    },
  );

  testWidgets(
    'dal menu si va nelle pagine della plancia: luci, clima, stanze',
    (tester) async {
      final demo = CasaDemo.leggi();
      late PonteFinto ponte;
      late Collegamento collegamento;

      await tester.runAsync(() async {
        ponte = await PonteFinto.alza();
        ponte.entita = demo.grezze;
        ponte.configurazione = demo.risposta;
        final archivio = ArchivioDelleCase(CassaforteInMemoria());
        await archivio.apri();
        await archivio.aggiungi(
          nome: 'Smart Home',
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
        await _finoAllaPlancia(collegamento);
      });

      await tester.pumpWidget(AppDiCasa(collegamento: collegamento));
      await tester.pump();
      await tester.pump();

      Future<void> vaiA(String pagina) async {
        await tester.tap(find.byTooltip('Menu'));
        await tester.pumpAndSettle();
        await tester.tap(
          find.descendant(of: find.byType(Drawer), matching: find.text(pagina)),
        );
        await tester.pumpAndSettle();
      }

      /* Il menu elenca le pagine che questa casa ha. */
      await tester.tap(find.byTooltip('Menu'));
      await tester.pumpAndSettle();
      for (final pagina in [
        'Home',
        'Stanze',
        'Luci',
        'Clima',
        'Temperatura',
        'Finestre',
      ]) {
        expect(
          find.descendant(of: find.byType(Drawer), matching: find.text(pagina)),
          findsOneWidget,
          reason: pagina,
        );
      }
      await tester.tap(
        find.descendant(of: find.byType(Drawer), matching: find.text('Luci')),
      );
      await tester.pumpAndSettle();

      expect(find.text('4/8 accese'), findsOneWidget);
      expect(find.text('Faretti soggiorno'), findsOneWidget);
      expect(find.text('ACCESA · 75%'), findsOneWidget);
      expect(find.text('Accendi tutte'), findsOneWidget);

      await vaiA('Clima');
      expect(find.text('Clima soggiorno'), findsOneWidget);
      expect(find.text('TARGET'), findsWidgets);
      expect(find.text('FREDDO'), findsOneWidget, reason: 'la linguetta');
      expect(find.text('CALDO'), findsOneWidget);

      await vaiA('Temperatura');
      expect(find.text('COMFORT'), findsWidgets);
      expect(find.text('22,4'), findsOneWidget, reason: 'il soggiorno');

      await vaiA('Finestre');
      expect(find.text('3 aperte · 1 chiusa'), findsOneWidget);
      expect(find.text('Tapparella soggiorno'), findsOneWidget);
      /* La cucina sta sotto: le schede delle finestre sono alte, e una
       * ListView costruisce solo quello che si vede. */
      await tester.scrollUntilVisible(
        find.text('FINESTRA APERTA'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('FINESTRA APERTA'), findsOneWidget, reason: 'la cucina');

      await vaiA('Stanze');
      expect(find.text('SENSORI DELLA STANZA'), findsOneWidget);
      expect(find.text('2/2'), findsOneWidget, reason: 'le luci del soggiorno');
      await tester.scrollUntilVisible(
        find.text('Strip TV'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('Strip TV'), findsOneWidget);

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
      await _finoAllaPlancia(collegamento);
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
      await _finoAllaPlancia(collegamento);
    });

    await tester.pumpWidget(AppDiCasa(collegamento: collegamento));
    await tester.pump();
    await tester.pump();
    /* L'ultima aggiunta e' quella attiva: chi abbina una casa ci vuole entrare. */
    expect(find.text('Dai miei'), findsOneWidget);

    /* L'elenco delle case sta nel menu. Per etichetta e non per icona:
     * l'icona e' un dettaglio del vestito, l'etichetta e' quello che legge
     * chi usa l'app senza vederla. */
    await tester.tap(find.byTooltip('Menu'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Le tue case'));
    await tester.pumpAndSettle();
    expect(find.text('Le tue case'), findsOneWidget, reason: 'il titolo');
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
      await _finoAllaPlancia(collegamento);
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
