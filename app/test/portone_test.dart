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

import 'dart:ui' show AccessibilityFeatures;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/main.dart';
import 'package:gdahome/ponte/indirizzo.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/aggiungi_casa.dart';
import 'package:gdahome/schermate/barra.dart';
import 'package:gdahome/schermate/lettore.dart';
import 'package:gdahome/plancia/pannello.dart';
import 'package:gdahome/plancia/servitore_qui/qui.dart';
import 'package:gdahome/schermate/plancia_vera.dart';
import 'package:gdahome/ponte/filo.dart';

import 'ponte/ponte_finto.dart';

/// Aspetta che la casa abbia risposto anche su dove sta la plancia: finche'
/// non lo fa, la home mostra una rotella, e una rotella non si «assesta» mai.
Future<void> _finoAllaPlancia(Collegamento collegamento) async {
  final fine = DateTime.now().add(const Duration(seconds: 5));
  while (!collegamento.pannelloLetto && DateTime.now().isBefore(fine)) {
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
}

/// La plancia vera, nelle prove: un servitore che non serve niente e un
/// riquadro che e' una scritta. Un WebView qui non c'e', e quello che si
/// prova e' **dove si finisce**: che la home sia la plancia, e a quale
/// indirizzo la si e' aperta.
class _PlanciaFinta extends FabbricaDellaPlancia {
  @override
  Future<ServitoreDiQuestoSistema?> servitore(
    Filo? Function() filo, {
    String lingua = 'it',
  }) async => _ServitoreFinto();

  @override
  Widget riquadro(
    Uri pagina, {
    required Key chiave,
    required VoidCallback quandoCaricata,
    required void Function(String perche) quandoFallisce,
  }) => _RiquadroFinto(key: chiave, pagina: pagina, caricata: quandoCaricata);
}

class _ServitoreFinto implements ServitoreDiQuestoSistema {
  @override
  Uri paginaDi(PannelloDellaPlancia pannello) =>
      Uri.parse('http://127.0.0.1:1${pannello.percorsoDellaPagina('it')}');

  @override
  Future<void> spegni() async {}
}

/// Si dice caricato al primo fotogramma, come una pagina che arriva.
class _RiquadroFinto extends StatefulWidget {
  const _RiquadroFinto({
    super.key,
    required this.pagina,
    required this.caricata,
  });
  final Uri pagina;
  final VoidCallback caricata;

  @override
  State<_RiquadroFinto> createState() => _RiquadroFintoState();
}

class _RiquadroFintoState extends State<_RiquadroFinto> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => widget.caricata());
  }

  @override
  Widget build(BuildContext context) =>
      Center(child: Text('LA PLANCIA VERA ${widget.pagina}'));
}

/// Un telefono che ha chiesto meno movimento.
///
/// Serve a tutte le prove: il fondo dell'app respira per sempre, e
/// `pumpAndSettle` aspetta che tutto si fermi — con qualcosa che non si ferma
/// mai, ogni attesa scade. Chiedendo «meno animazioni» il fondo sta fermo, che
/// e' quello che fa anche su un telefono vero con quella preferenza accesa.
class _SenzaMovimento implements AccessibilityFeatures {
  const _SenzaMovimento();

  @override
  bool get accessibleNavigation => false;
  @override
  bool get boldText => false;
  @override
  bool get disableAnimations => true;
  @override
  bool get highContrast => false;
  @override
  bool get invertColors => false;
  @override
  bool get onOffSwitchLabels => false;
  @override
  bool get reduceMotion => true;
  @override
  bool get autoPlayAnimatedImages => false;
  @override
  bool get autoPlayVideos => false;
  @override
  bool get deterministicCursor => false;
  @override
  bool get supportsAnnounce => false;
}

/// Tira su la barra delle sezioni, come si fa col dito sulla maniglia.
///
/// La barra non c'e' finche' non la si chiama: e' una dock, e sta sotto il
/// bordo. Le prove che vogliono andare da qualche parte passano di qui.
Future<void> apriLaBarra(WidgetTester tester) async {
  /* La barra si richiude da sola poco dopo che si e' scelto. Se si premesse
   * la maniglia mentre e' ancora aperta la si chiuderebbe, e il tocco dopo
   * cadrebbe nel vuoto: si lascia passare il tempo che ci mette a togliersi
   * di mezzo, e poi la si chiama. */
  await tester.pump(const Duration(seconds: 5));
  await tester.pumpAndSettle();
  await tester.tap(find.bySemanticsLabel(nomeDellaManiglia));
  await tester.pumpAndSettle();
}

/// Una voce **della barra**, e non la tessera che sulla pagina dietro si
/// chiama allo stesso modo: «CLIMA» c'e' in tutti e due i posti, e premere
/// quella sbagliata apre la finestra di una tessera invece della pagina.
Finder nellaBarra(String scritta) => find.descendant(
  of: find.byType(BarraDelleSezioni),
  matching: find.text(scritta),
);

void main() {
  /* Il fondo dell'app si muove da solo, e `pumpAndSettle` non si assesta mai
   * finche' qualcosa si muove. Qui si dice a Flutter che questo telefono ha
   * chiesto meno movimento: il fondo resta dov'e', e le attese finiscono. */
  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    final binding = TestWidgetsFlutterBinding.instance;
    binding.platformDispatcher.accessibilityFeaturesTestValue =
        const _SenzaMovimento();
  });
  tearDown(() {
    TestWidgetsFlutterBinding.instance.platformDispatcher
        .clearAccessibilityFeaturesTestValue();
  });

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

      await tester.pumpWidget(
        AppDiCasa(collegamento: collegamento, plancia: _PlanciaFinta()),
      );
      await tester.pump();
      await tester.pump();

      /* La home e' la plancia vera, aperta sul servitore alla pagina che il
       * pannello di DashboardModern dice. */
      expect(find.textContaining('LA PLANCIA VERA'), findsOneWidget);
      expect(
        find.textContaining(
          '/dashboardmodern_static/abc123/legacy/dashboard.html',
        ),
        findsOneWidget,
      );
      /* La cosa che si sta provando e' quello che **non** c'e'. La prima
       * schermata e' la plancia: nessuna entita', nessun contatore, nessun
       * bottone per spegnere le luci. Quelle cose stanno dietro il menu. */
      expect(find.text('Cucina'), findsNothing);
      expect(find.textContaining('accese'), findsNothing);
      expect(find.textContaining('Spegni'), findsNothing);
      expect(find.text('Dispositivi'), findsNothing);

      /* La barra: si chiama dalla maniglia in fondo, come la dock della
       * plancia. In cima c'e' la casa in cui si e', e da dove ci si passa;
       * sotto, i nomi in maiuscolo e per intero. */
      await apriLaBarra(tester);
      expect(nellaBarra('Casa mia'), findsOneWidget);
      expect(nellaBarra('in casa'), findsOneWidget);
      expect(nellaBarra('PLANCIA'), findsOneWidget);
      expect(nellaBarra('DISPOSITIVI'), findsOneWidget);
      /* I blocchi che non ci sono ancora si vedono lo stesso, spenti: cosi'
       * si sa dove sta andando l'app. */
      expect(nellaBarra('AIUTANTI'), findsOneWidget);
      expect(nellaBarra('ZIGBEE'), findsOneWidget);
      expect(nellaBarra('AUTOMAZIONI'), findsOneWidget);

      /* Finche' la si scorre non se ne va. La barra si toglie di mezzo da
       * sola dopo qualche secondo, ma cercare la propria sezione fra venti
       * voci ci mette di piu' di cosi': se sparisse sotto il dito mentre la
       * si scorre, si dovrebbe richiamarla ogni volta. Qui passa piu' tempo
       * di quanto ne basti a chiuderla, ma in mezzo la si tocca. */
      final barra = tester.state<BarraDelleSezioniState>(
        find.byType(BarraDelleSezioni),
      );
      await tester.pump(const Duration(seconds: 3));
      await tester.drag(find.byType(BarraDelleSezioni), const Offset(-60, 0));
      await tester.pump(const Duration(seconds: 3));
      expect(
        barra.aperta,
        isTrue,
        reason: 'scorrendola, il conto alla rovescia riparte',
      );
      /* Lasciata stare, invece, se ne va. */
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();
      expect(barra.aperta, isFalse, reason: 'da sola si chiude');
      await apriLaBarra(tester);

      /* Da li' ai dispositivi: la barra si richiude, la sezione cambia, e le
       * entita' compaiono adesso — non prima. */
      await tester.tap(nellaBarra('DISPOSITIVI'));
      await tester.pumpAndSettle();
      expect(find.text('Dispositivi'), findsOneWidget, reason: 'il titolo');
      expect(find.text('Luci'), findsOneWidget);
      expect(find.text('Cucina'), findsOneWidget);
      expect(find.text('Salotto'), findsOneWidget);

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

    await tester.pumpWidget(
      AppDiCasa(collegamento: collegamento, plancia: _PlanciaFinta()),
    );
    await tester.pump();
    await tester.pump();

    /* Lo dice la barra: la plancia e' una pagina web, e da dove ci si passa
     * non lo sa. */
    await apriLaBarra(tester);
    expect(nellaBarra('da fuori'), findsOneWidget);
    expect(nellaBarra('Casa'), findsOneWidget);

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

    await tester.pumpWidget(
      AppDiCasa(collegamento: collegamento, plancia: _PlanciaFinta()),
    );
    await tester.pump();
    await tester.pump();
    /* L'ultima aggiunta e' quella attiva: chi abbina una casa ci vuole
     * entrare. Il nome sta in cima alla barra. */
    await apriLaBarra(tester);
    expect(nellaBarra('Dai miei'), findsOneWidget);

    /* L'elenco delle case sta dietro quel nome. Per etichetta e non per
     * icona: l'icona e' un dettaglio del vestito, l'etichetta e' quello che
     * legge chi usa l'app senza vederla. */
    await tester.tap(find.byTooltip(nomeDelleCase));
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

    await tester.pumpWidget(
      AppDiCasa(collegamento: collegamento, plancia: _PlanciaFinta()),
    );
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
