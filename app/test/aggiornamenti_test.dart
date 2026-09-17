/// Le prove della sezione Aggiornamenti: cosa si vede, e cosa succede quando
/// si preme.
///
/// La sezione esiste per una frase sola — «chi utilizzerà app non vedrà mai
/// aggiornamenti se non accede su HA» — e quindi la prima cosa da provare non
/// e' che sia bella: e' che quando in casa c'e' qualcosa da fare, **lo dica**,
/// e che premendo si faccia davvero.
///
/// Poi c'e' la parte che si sbaglia sempre, ed e' quella per cui queste prove
/// esistono: due comandi di questa schermata **fanno cadere il filo**, ed e'
/// quello che devono fare. Aggiornare gdahome riavvia il ponte; riavviare Home
/// Assistant ferma la casa. Detto prima e' un'attesa, non detto e' un guasto —
/// e un'app che dopo un tocco si sconnette senza spiegazioni e' un'app che
/// quel tasto non se lo fa premere mai piu'.
library;

import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui' show AccessibilityFeatures;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/aggiornamenti.dart';
import 'package:gdahome/vestito/marchio.dart';
import 'package:gdahome/vestito/tema.dart';

import 'ponte/ponte_finto.dart';

/// Un telefono che ha chiesto meno movimento: il fondo dell'app respira per
/// sempre, e `pumpAndSettle` con qualcosa che non si ferma mai non finisce.
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

Map<String, dynamic> _voce(
  String entita,
  String nome, {
  String da = '',
  String a = '',
  bool installabile = true,
  bool stacca = false,
  bool inCorso = false,
  int quanto = -1,
  String dettagli = '',
  String note = '',
  bool logo = false,
  bool nostra = false,
}) => {
  'entita': entita,
  'nome': nome,
  'da': da,
  'a': a,
  'installabile': installabile,
  'stacca': stacca,
  'inCorso': inCorso,
  'quanto': quanto,
  'dettagli': dettagli,
  'note': note,
  'logo': logo,
  'nostra': nostra,
};

void main() {
  late PonteFinto ponte;
  late Collegamento collegamento;

  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    TestWidgetsFlutterBinding
            .instance
            .platformDispatcher
            .accessibilityFeaturesTestValue =
        const _SenzaMovimento();
  });

  tearDown(() async {
    TestWidgetsFlutterBinding.instance.platformDispatcher
        .clearAccessibilityFeaturesTestValue();
  });

  /// Tira su il ponte finto e una casa collegata, nel tempo vero: il
  /// collegamento vuole rete vera e timer veri, e dentro `testWidgets`
  /// l'orologio lo muove il `pump`.
  Future<void> unaCasa(WidgetTester tester) async {
    await tester.runAsync(() async {
      ponte = await PonteFinto.alza();
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

  /// Lascia passare un momento di tempo **vero**, e poi ridisegna.
  ///
  /// Qualche fotogramma a mano e non `pumpAndSettle`: quando
  /// un'installazione e' in corso e Home Assistant non dice a che punto sta,
  /// la striscia si muove da sola per sempre — e' fatta apposta, perche' una
  /// barra ferma sembra un'app bloccata — e «aspetta che tutto si fermi» li'
  /// non finisce mai.
  Future<void> respira(WidgetTester tester) async {
    /* Due giri e non uno: un tocco puo' fare due domande di fila — installa,
     * e poi rileggi l'elenco — e la seconda parte solo quando la prima e'
     * tornata. */
    for (var volta = 0; volta < 2; volta += 1) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 250)),
      );
      for (var giro = 0; giro < 8; giro += 1) {
        await tester.pump(const Duration(milliseconds: 50));
      }
    }
  }

  /// La schermata da sola, col vestito dell'app: i tasti di quest'app sono
  /// larghi quanto la riga, e con un tema di serie si disegnerebbero in un
  /// altro modo.
  Future<void> apri(WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: temaChiaro(),
        home: Scaffold(
          body: SchermataDegliAggiornamenti(collegamento: collegamento),
        ),
      ),
    );
    await tester.pump();
    /* La prima lettura passa dal filo, che e' rete vera: dentro `testWidgets`
     * il tempo e' finto e un giro sulla rete non finirebbe mai. Si lascia
     * girare l'orologio vero un momento, e poi si disegna. */
    await respira(tester);
  }

  testWidgets('una casa a posto lo dice, e il riavvio c\'è lo stesso', (
    tester,
  ) async {
    await unaCasa(tester);
    await apri(tester);

    /* «Tutto aggiornato» vale il posto che occupa: e' la risposta alla domanda
     * per cui si e' aperta questa sezione, e una schermata vuota si legge come
     * una schermata rotta. */
    expect(find.text('Tutto aggiornato'), findsOneWidget);

    /* Il riavvio non dipende dagli aggiornamenti: e' li' anche quando non c'e'
     * niente da fare, che e' proprio quando serve — «una cosa non risponde e
     * non si capisce perche'». */
    expect(find.text('Riavvia Home Assistant'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, 'Riavvia'), findsOneWidget);
  });

  testWidgets('quello che aspetta si vede, con le versioni e le note', (
    tester,
  ) async {
    await unaCasa(tester);
    ponte.aggiornamenti.addAll([
      _voce(
        'update.dashboardmodern_update',
        'DashboardModern',
        da: '1.4.30',
        a: '1.4.31',
        dettagli: 'Le finestre non restano più offuscate.',
      ),
      _voce('update.termostato', 'Termostato', a: '3.1', installabile: false),
    ]);
    await apri(tester);

    expect(find.text('2 aggiornamenti da fare'), findsOneWidget);
    expect(find.text('DashboardModern'), findsOneWidget);
    expect(find.text('1.4.30 → 1.4.31'), findsOneWidget);
    expect(find.text('Le finestre non restano più offuscate.'), findsOneWidget);

    /* Un tasto solo: quello del firmware che si cambia col cacciavite non c'e'
     * — sarebbe una promessa che non si mantiene — e al suo posto c'e' scritto
     * dove si fa. */
    expect(find.widgetWithText(FilledButton, 'Installa'), findsOneWidget);
    expect(
      find.text('Questo si aggiorna dal suo apparecchio.'),
      findsOneWidget,
    );
  });

  testWidgets('installare parte col tocco, e la riga passa a «In corso»', (
    tester,
  ) async {
    await unaCasa(tester);
    ponte.aggiornamenti.add(
      _voce('update.dashboardmodern_update', 'DashboardModern', a: '1.4.31'),
    );
    await apri(tester);

    await tester.tap(find.widgetWithText(FilledButton, 'Installa'));
    await tester.pump();
    /* Il tasto sparisce **subito**, senza aspettare che l'elenco se ne
     * accorga: fra il tocco e l'entita' che si dichiara in corso passano
     * secondi, e in quei secondi un tasto ancora acceso e' una seconda
     * installazione della stessa cosa. */
    expect(find.widgetWithText(FilledButton, 'Installa'), findsNothing);
    expect(find.text('In corso'), findsOneWidget);

    await respira(tester);
    expect(ponte.installati, ['update.dashboardmodern_update']);
  });

  testWidgets(
    'quello che porta giù il filo lo dice prima, e si può dire di no',
    (tester) async {
      await unaCasa(tester);
      ponte.aggiornamenti.add(
        _voce('update.gdahome_update', 'gdahome', a: '0.21.0', stacca: true),
      );
      await apri(tester);

      /* Il bollino si vede senza premere niente: la riga stessa dice che quella
     * cosa li' riavvia la casa. */
      expect(find.text('riavvia la casa'), findsOneWidget);

      await tester.tap(find.widgetWithText(FilledButton, 'Installa'));
      await tester.pumpAndSettle();
      expect(find.text('Aggiornare gdahome?'), findsOneWidget);
      expect(
        find.textContaining('l\'app resta senza collegamento'),
        findsOneWidget,
      );

      /* Annullando non parte niente: e' il punto di chiederlo. */
      await tester.tap(find.text('Annulla'));
      await tester.pumpAndSettle();
      expect(ponte.installati, isEmpty);

      await tester.tap(find.widgetWithText(FilledButton, 'Installa'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Aggiorna'));
      await tester.pumpAndSettle();
      await respira(tester);
      expect(ponte.installati, ['update.gdahome_update']);
    },
  );

  testWidgets('il riavvio si chiede prima, e poi la schermata lo racconta', (
    tester,
  ) async {
    await unaCasa(tester);
    await apri(tester);

    await tester.tap(find.widgetWithText(OutlinedButton, 'Riavvia'));
    await tester.pumpAndSettle();
    expect(find.text('Riavviare Home Assistant?'), findsOneWidget);
    expect(find.textContaining('niente luci'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Riavvia'));
    await tester.pumpAndSettle();
    await respira(tester);

    expect(ponte.riavviata, isTrue);
    /* Da qui in poi il filo cade, ed e' l'unica schermata dell'app in cui una
     * caduta e' una buona notizia: si racconta invece di mostrare un errore. */
    expect(find.text('Home Assistant si sta riavviando'), findsOneWidget);
    expect(find.textContaining('non c\'è niente da fare'), findsOneWidget);
  });

  testWidgets(
    'un add-on più vecchio dell\'app lo spiega invece di girare a vuoto',
    (tester) async {
      await unaCasa(tester);
      ponte.sagliAggiornamenti = false;
      await apri(tester);

      expect(
        find.textContaining('gdahome in casa è più vecchio dell\'app'),
        findsOneWidget,
      );
    },
  );

  testWidgets('il logo arriva dal ponte e si mette al posto dell\'iniziale', (
    tester,
  ) async {
    await unaCasa(tester);
    ponte.aggiornamenti.add(
      _voce('update.un_addon', 'Un add-on', da: '1.0', a: '1.1', logo: true),
    );
    ponte.loghi['update.un_addon'] = _unPng();
    await apri(tester);

    /* Prima che arrivi c'era l'iniziale; adesso c'e' l'immagine. */
    expect(find.byType(Image), findsWidgets);
    expect(find.text('U'), findsNothing);
  });

  testWidgets('chi non ha un logo tiene la sua iniziale, e non e\' un guasto', (
    tester,
  ) async {
    await unaCasa(tester);
    ponte.aggiornamenti.addAll([
      /* Dice di averne uno, ma la casa non lo da\': capita, e la riga resta
       * una riga fatta bene. */
      _voce('update.bugiardo', 'Bugiardo', da: '1.0', a: '1.1', logo: true),
      /* E chi non ne ha nemmeno uno dichiarato non lo chiede affatto. */
      _voce('update.zeta', 'Zeta', da: '2.0', a: '2.1'),
    ]);
    await apri(tester);
    await respira(tester);

    expect(find.text('B'), findsOneWidget);
    expect(find.text('Z'), findsOneWidget);
    /* Nessun errore a schermo: un logo che manca non e\' una cosa rotta. */
    expect(find.textContaining('Non si riesce'), findsNothing);
  });

  testWidgets(
    'il nostro segno e\' quello dell\'app, e non si chiede a nessuno',
    (tester) async {
      await unaCasa(tester);
      ponte.aggiornamenti.add(
        _voce(
          'update.dashboardmodern_update',
          'DashboardModern',
          da: '1.4.32.7',
          a: '1.4.32.8',
          nostra: true,
        ),
      );
      await apri(tester);
      await respira(tester);

      /* `nostra` lo decide il ponte dal titolo, e il ponte finto fa lo stesso:
     * la riga disegna il marchio dell'app, che sta gia\' nel telefono. */
      expect(find.byType(Marchio), findsOneWidget);
      expect(find.text('D'), findsNothing);
    },
  );

  testWidgets('«Cosa cambia» c\'e\' solo dove ci sono note da leggere', (
    tester,
  ) async {
    await unaCasa(tester);
    ponte.aggiornamenti.addAll([
      _voce(
        'update.con_note',
        'Con note',
        da: '1.0',
        a: '1.1',
        note: 'https://gdahome.org/note',
      ),
      _voce('update.senza', 'Senza', da: '2.0', a: '2.1'),
    ]);
    await apri(tester);

    expect(find.widgetWithText(TextButton, 'Cosa cambia'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Installa'), findsNWidgets(2));
  });
}

/// Un PNG vero, il piu\' piccolo che si possa disegnare: un punto solo.
///
/// Serve perche\' `Image.memory` apra qualcosa davvero — con dei byte
/// qualunque chiamerebbe `errorBuilder`, e la prova direbbe il contrario di
/// quello che vuole dire.
Uint8List _unPng() => base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/'
  'q842iQAAAABJRU5ErkJggg==',
);
