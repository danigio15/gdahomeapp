/// Le prove della sezione Zigbee: cosa si vede, e cosa succede premendo (#54).
///
/// La schermata e' una cosa sola che va avanti — si apre la rete, si aspetta,
/// entra qualcuno, gli si da' un nome — e le prove seguono quella strada, dal
/// primo tasto all'ultimo, contro un ponte finto ma vero.
///
/// Le due che contano di piu' non sono sul giro dritto:
///
///  - **la rete che si richiude da sola senza che sia entrato nessuno.** La
///    schermata deve tornare alla porta. Restare su un conto alla rovescia
///    fermo a zero vorrebbe dire qualcuno che preme il tasto di una presa
///    davanti a una porta chiusa;
///  - **l'app riaperta mentre la rete e' ancora aperta.** Si torna dov'era,
///    invece di far ricominciare da capo una cosa che sta gia' andando.
library;

import 'dart:ui' show AccessibilityFeatures;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/casa/zigbee.dart';
import 'package:gdahome/schermate/barra.dart';
import 'package:gdahome/schermate/menu.dart';
import 'package:gdahome/schermate/zigbee.dart';
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

void main() {
  /* La voce del menu prima di tutto: e' l'unica dell'elenco che dipende da
   * com'e' fatta **la casa** invece che da com'e' fatta l'app. Una casa senza
   * ZHA e senza Zigbee2MQTT non deve vederla: quella schermata li' non
   * potrebbe aprire niente, e una porta che non si apre e' peggio di una
   * porta che non c'e'. */
  test('la voce c\'e\' solo dove una rete Zigbee c\'e\' davvero', () {
    expect(vociDellaBarra(), isNot(contains(Sezione.zigbee)));
    expect(vociDellaBarra(conZigbee: true), contains(Sezione.zigbee));
    expect(
      vociDellaBarra(conZigbee: true).length,
      vociDellaBarra().length + 1,
      reason: 'accendendo Zigbee non deve comparire nient\'altro',
    );
  });

  /* E nella webapp non c'è comunque: aprire una rete Zigbee si fa in piedi
   * davanti al dispositivo, col telefono in una mano, e nel browser sarebbe
   * una porta che si apre su metà di quello che promette. Con lei se ne
   * vanno Aiutanti e Automazioni, per la stessa ragione. */
  test(
    'nella webapp Navigatore, Zigbee, Aiutanti e Automazioni non ci sono',
    () {
      final nelBrowser = vociDellaBarra(conZigbee: true, nellApp: false);
      expect(nelBrowser, isNot(contains(Sezione.zigbee)));
      expect(nelBrowser, isNot(contains(Sezione.aiutanti)));
      expect(nelBrowser, isNot(contains(Sezione.automazioni)));
      /* E il navigatore: vuole il GPS e la voce del telefono. */
      expect(nelBrowser, isNot(contains(Sezione.navigatore)));
      /* E il resto c'è tutto: si tolgono tre voci, non si fa un'altra app. */
      expect(nelBrowser, contains(Sezione.plancia));
      expect(nelBrowser, contains(Sezione.dispositivi));
      expect(nelBrowser, contains(Sezione.configurazione));
      expect(
        vociDellaBarra(conZigbee: true).length - nelBrowser.length,
        4,
        reason: 'nella webapp mancano esattamente quelle quattro',
      );
    },
  );

  test('e chi è solo dell\'app lo dichiara lei, non la barra', () {
    /* Aggiungerne una domani vuol dire una parola nel suo elenco, e non una
     * riga in più dentro il filtro. */
    expect(Sezione.values.where((una) => una.soloNellApp).toSet(), {
      Sezione.navigatore,
      Sezione.zigbee,
      Sezione.aiutanti,
      Sezione.automazioni,
    });
  });

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

  tearDown(() {
    TestWidgetsFlutterBinding.instance.platformDispatcher
        .clearAccessibilityFeaturesTestValue();
  });

  /// Tira su il ponte finto e una casa collegata, nel tempo vero.
  Future<void> unaCasa(WidgetTester tester, {String rete = 'zha'}) async {
    await tester.runAsync(() async {
      ponte = await PonteFinto.alza();
      ponte.laReteZigbee = rete;
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
  /// Il filo e' rete vera: dentro `testWidgets` il tempo e' finto e un giro
  /// sulla rete non finirebbe mai.
  Future<void> respira(WidgetTester tester, {int volte = 2}) async {
    for (var volta = 0; volta < volte; volta += 1) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 250)),
      );
      for (var giro = 0; giro < 8; giro += 1) {
        await tester.pump(const Duration(milliseconds: 50));
      }
    }
  }

  /// Scorre fino al tasto e poi lo preme.
  ///
  /// Serve davvero: il conto alla rovescia è un anello da duecento punti, e
  /// sotto ci stanno tre righe di istruzioni — su uno schermo corto «Richiudi
  /// la rete adesso» finisce sotto la piega. Un `tap` su un tasto fuori
  /// schermo non fallisce: **manca**, e la prova legge «il comando non è
  /// arrivato» senza dire perché.
  Future<void> premi(WidgetTester tester, String cosa) async {
    await tester.ensureVisible(find.text(cosa));
    await tester.pump();
    await tester.tap(find.text(cosa));
  }

  Future<void> apri(WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: temaChiaro(),
        home: Scaffold(
          body: SchermataZigbee(collegamento: collegamento, visibile: true),
        ),
      ),
    );
    await tester.pump();
    await respira(tester);
  }

  testWidgets('a rete chiusa si vede quale c\'è, e il tasto per aprirla', (
    tester,
  ) async {
    await unaCasa(tester);
    await apri(tester);
    expect(find.text('ZHA'), findsOneWidget);
    expect(find.text('Apri la rete'), findsOneWidget);
    /* E le due cose da fare prima, che sono il motivo per cui questa schermata
     * non è solo un tasto: un dispositivo lontano dalla rete non entra. */
    expect(find.textContaining('vicino a una presa'), findsOneWidget);
    expect(find.textContaining('Tienilo spento'), findsOneWidget);
  });

  testWidgets('con Zigbee2MQTT la schermata è la stessa, la rete no', (
    tester,
  ) async {
    await unaCasa(tester, rete: 'zigbee2mqtt');
    await apri(tester);
    expect(find.text('Zigbee2MQTT'), findsOneWidget);
    expect(find.text('Apri la rete'), findsOneWidget);
  });

  testWidgets('premendo si apre, e comincia il conto alla rovescia', (
    tester,
  ) async {
    await unaCasa(tester);
    await apri(tester);
    await premi(tester, 'Apri la rete');
    await respira(tester);

    /* La rete è aperta davvero, non solo a schermo. */
    expect(
      ponte.chieste.any((detto) => detto['type'] == 'ponte/zigbee/apri'),
      isTrue,
    );
    expect(find.text('Adesso tocca a te'), findsOneWidget);
    /* L'anello si misura su per quanto era aperta all'inizio, non su quanto
     * resta adesso: tarandolo su se stesso resterebbe **fermo a pieno** per
     * tutto il tempo, perché il numero sopra e quello sotto sarebbero sempre
     * lo stesso. Appena aperta è pieno, ed è giusto. */
    final anello = tester.widget<CircularProgressIndicator>(
      find.descendant(
        of: find.byType(Stack),
        matching: find.byType(CircularProgressIndicator),
      ),
    );
    expect(anello.value, closeTo(1, 0.05));
    expect(find.text('Sto ascoltando la casa'), findsOneWidget);
    expect(find.text('Richiudi la rete adesso'), findsOneWidget);
    /* Il conto alla rovescia è quello del ponte, non un cronometro locale:
     * quattro minuti meno il tempo che ci ha messo il giro. */
    expect(find.textContaining(':'), findsWidgets);
  });

  testWidgets('quando entra qualcuno si passa a dargli un nome', (
    tester,
  ) async {
    await unaCasa(tester);
    await apri(tester);
    await premi(tester, 'Apri la rete');
    await respira(tester);

    ponte.entratiInZigbee.add({
      'id': 'dev-1',
      'nome': 'TRADFRI bulb E27',
      'marca': 'IKEA',
      'modello': 'TRADFRI bulb E27',
      'tramite': 'zha',
    });
    /* Il giro chiede una volta al secondo: gliene si lascia passare più di
     * uno, di tempo vero. */
    await respira(tester, volte: 6);

    expect(find.text('È entrato'), findsOneWidget);
    /* La casella arriva già piena col nome di fabbrica: cancellare è più
     * veloce che scrivere da zero, e fa vedere cosa c'era prima. */
    expect(find.widgetWithText(TextField, 'TRADFRI bulb E27'), findsOneWidget);
    expect(find.textContaining('nome di fabbrica'), findsOneWidget);
  });

  testWidgets('il nome che si scrive arriva al registro di casa', (
    tester,
  ) async {
    await unaCasa(tester);
    await apri(tester);
    await premi(tester, 'Apri la rete');
    await respira(tester);
    ponte.entratiInZigbee.add({
      'id': 'dev-1',
      'nome': 'TS0121',
      'marca': 'TuYa',
      'modello': 'TS0121',
      'tramite': 'zha',
    });
    await respira(tester, volte: 6);

    await tester.enterText(find.byType(TextField), 'Presa lavatrice');
    await tester.pump();
    await premi(tester, 'Chiamalo così');
    await respira(tester);

    expect(ponte.rinominatiInZigbee['dev-1'], 'Presa lavatrice');
    expect(find.text('È a posto'), findsOneWidget);
    /* E si dice che manca ancora la sezione: in casa c'è, nella plancia no,
     * e chi ha appena finito deve sapere che c'è un passo in più. */
    expect(find.text('Gli manca una sezione'), findsOneWidget);
    expect(find.text('Aggiungine un altro'), findsOneWidget);
  });

  testWidgets('finito, si consegna alla plancia quello che è entrato', (
    tester,
  ) async {
    /* Il passo 4: chi scrive nella configurazione è la plancia, e da qui si
     * consegna. Le entità viaggiano tutte: quale delle sei dica cos'è
     * l'oggetto lo sa lei, che le sue sezioni le conosce. */
    await unaCasa(tester);
    DispositivoEntrato? consegnato;
    await tester.pumpWidget(
      MaterialApp(
        theme: temaChiaro(),
        home: Scaffold(
          body: SchermataZigbee(
            collegamento: collegamento,
            visibile: true,
            quandoVaMessoNellaPlancia: (suo) => consegnato = suo,
          ),
        ),
      ),
    );
    await tester.pump();
    await respira(tester);
    await premi(tester, 'Apri la rete');
    await respira(tester);
    ponte.entratiInZigbee.add({
      'id': 'dev-1',
      'nome': 'TS0121',
      'entita': [
        {'entity': 'switch.ts0121', 'classe': 'outlet', 'categoria': ''},
      ],
    });
    await respira(tester, volte: 6);
    await tester.enterText(find.byType(TextField), 'Presa lavatrice');
    await tester.pump();
    await premi(tester, 'Chiamalo così');
    await respira(tester);

    await premi(tester, 'Adesso mettilo nella plancia');
    await tester.pump();
    expect(consegnato, isNotNull);
    expect(consegnato!.nome, 'Presa lavatrice');
    expect(consegnato!.entita.first.entity, 'switch.ts0121');
  });

  testWidgets('un dispositivo senza entità non si consegna', (tester) async {
    /* Il foglietto della plancia decide la sezione dalle entità: aprirlo su un
     * dispositivo che non ne ha vorrebbe dire un foglietto che non sa cosa
     * proporre e non potrebbe scrivere niente. Il tasto non c'è, e la nota
     * dice cosa fare invece. */
    await unaCasa(tester);
    await tester.pumpWidget(
      MaterialApp(
        theme: temaChiaro(),
        home: Scaffold(
          body: SchermataZigbee(
            collegamento: collegamento,
            visibile: true,
            quandoVaMessoNellaPlancia: (_) {},
          ),
        ),
      ),
    );
    await tester.pump();
    await respira(tester);
    await premi(tester, 'Apri la rete');
    await respira(tester);
    ponte.entratiInZigbee.add({'id': 'dev-1', 'nome': 'TS0121'});
    await respira(tester, volte: 6);
    await tester.enterText(find.byType(TextField), 'Qualcosa');
    await tester.pump();
    await premi(tester, 'Chiamalo così');
    await respira(tester);

    expect(find.text('È a posto'), findsOneWidget);
    expect(find.text('Adesso mettilo nella plancia'), findsNothing);
    expect(find.textContaining('dalla Configurazione'), findsOneWidget);
  });

  testWidgets('senza un nome il tasto non si preme', (tester) async {
    await unaCasa(tester);
    await apri(tester);
    await premi(tester, 'Apri la rete');
    await respira(tester);
    ponte.entratiInZigbee.add({'id': 'dev-1', 'nome': 'TS0121'});
    await respira(tester, volte: 6);

    await tester.enterText(find.byType(TextField), '   ');
    await tester.pump();
    final tasto = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Chiamalo così'),
    );
    expect(tasto.onPressed, isNull);
  });

  testWidgets('richiudendo la rete si torna alla porta', (tester) async {
    await unaCasa(tester);
    await apri(tester);
    await premi(tester, 'Apri la rete');
    await respira(tester);
    await premi(tester, 'Richiudi la rete adesso');
    await respira(tester);

    expect(
      ponte.chieste.any((detto) => detto['type'] == 'ponte/zigbee/chiudi'),
      isTrue,
    );
    expect(find.text('Apri la rete'), findsOneWidget);
    expect(find.text('Sto ascoltando la casa'), findsNothing);
  });

  testWidgets('la rete che scade da sola riporta alla porta', (tester) async {
    /* Aperta per un soffio: si aspetta che scada, e la schermata deve tornare
     * dove si riapre. Un conto alla rovescia fermo a zero non dice cosa fare,
     * e chi lo guarda continua a premere il tasto di una presa davanti a una
     * porta che si è già richiusa. */
    await unaCasa(tester);
    /* Tre secondi e non uno: aprire e disegnare costa già mezzo secondo di
     * tempo vero, e una finestra da un secondo sarebbe già chiusa prima che
     * la prova riesca a vedere l'attesa che vuole provare. */
    ponte.quantoRestaApertaZigbee = 3;
    await apri(tester);
    await premi(tester, 'Apri la rete');
    await respira(tester);
    expect(find.text('Sto ascoltando la casa'), findsOneWidget);

    await respira(tester, volte: 14);
    expect(find.text('Apri la rete'), findsOneWidget);
    expect(find.text('Sto ascoltando la casa'), findsNothing);
  });

  testWidgets('riaprendo l\'app a rete aperta si torna ad aspettare', (
    tester,
  ) async {
    /* L'apertura l'ha fatta un'altra sessione — o questa, prima che il
     * telefono finisse in tasca. La schermata la raccoglie invece di
     * ricominciare da capo una cosa che sta già andando. */
    await unaCasa(tester);
    await tester.runAsync(() async {
      await collegamento.filo!.risultato({'type': 'ponte/zigbee/apri'});
    });
    await apri(tester);
    expect(find.text('Sto ascoltando la casa'), findsOneWidget);
    expect(find.text('Apri la rete'), findsNothing);
  });

  testWidgets('col filo giù la schermata lo dice, invece di un tasto muto', (
    tester,
  ) async {
    await unaCasa(tester);
    await tester.runAsync(() => collegamento.chiudi());
    await apri(tester);
    expect(find.text('La casa non risponde'), findsOneWidget);
    expect(find.text('Apri la rete'), findsNothing);
  });
}
