/// Le notifiche di Premium nella pagina «Notifiche»: in una casa Base
/// «Elaborate» e il «Riepilogo della sera» hanno il lucchetto e il bollino
/// PREMIUM, e al tocco si spiega che si compra solo dalle app sugli store.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/notifiche/modello.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/notifiche.dart';
import 'package:gdahome/schermate/premium.dart';

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

/// La pagina, con la casa che dice [premium] (`null`: un ponte di prima).
Future<(PonteFinto, Collegamento)> _laPagina(
  WidgetTester tester, {
  required bool? premium,
  String stile = 'elaborate',
}) async {
  tester.view.physicalSize = const Size(1200, 2600);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  late PonteFinto ponte;
  late Collegamento collegamento;
  await tester.runAsync(() async {
    ponte = await PonteFinto.alza();
    if (premium == null) {
      ponte.notifiche.remove('premium');
    } else {
      ponte.notifiche['premium'] = premium;
    }
    ponte.notifiche['impostazioni'] = {
      'acceso': true,
      'eventi': <String, dynamic>{},
      'stile': stile,
    };
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

Future<void> _chiudi(
  WidgetTester tester,
  (PonteFinto, Collegamento) coppia,
) async {
  await tester.runAsync(() async {
    await coppia.$2.chiudi();
    await coppia.$1.spegni();
  });
}

void main() {
  testWidgets('Base: lucchetto e bollino su Elaborate e sul riepilogo', (
    tester,
  ) async {
    final coppia = await _laPagina(tester, premium: false);
    /* «Elaborate», in cima, col bollino. */
    expect(
      find.descendant(
        of: find.byKey(const Key('stile-elaborate')),
        matching: find.byType(BollinoPremium),
      ),
      findsOneWidget,
    );
    /* Anche se sul ponte c'e' scritto «elaborate», in Base sono semplici. */
    expect(
      find.descendant(
        of: find.byKey(const Key('stile-semplici')),
        matching: find.byIcon(Icons.check_circle_rounded),
      ),
      findsOneWidget,
    );
    final scorre = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(
      find.byKey(const Key('voce-riepilogo-bloccata')),
      300,
      scrollable: scorre,
    );
    final riepilogo = find.byKey(const Key('voce-riepilogo-bloccata'));
    /* A meta' schermo: appena entrata in fondo, la voce sta sotto il bordo
     * e il tocco cade fuori. */
    await Scrollable.ensureVisible(tester.element(riepilogo), alignment: 0.5);
    await tester.pumpAndSettle();
    expect(
      find.descendant(of: riepilogo, matching: find.byType(BollinoPremium)),
      findsOneWidget,
    );
    /* Nessun interruttore acceso: in Base il riepilogo non c'e'. */
    expect(
      find.descendant(of: riepilogo, matching: find.byType(Switch)),
      findsNothing,
    );
    /* Ne' l'orario, ne' la pagina della giornata. */
    expect(find.text('Ogni sera alle'), findsNothing);
    expect(find.byKey(const Key('apri-la-giornata')), findsNothing);

    await tester.tap(riepilogo);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('spiegazione-premium')), findsOneWidget);
    expect(find.byKey(const Key('premium-solo-dagli-store')), findsOneWidget);
    expect(find.text(PerchePremium.notifiche), findsOneWidget);
    expect(
      coppia.$1.chieste.where(
        (una) => una['type'] == 'ponte/notifiche/imposta',
      ),
      isEmpty,
      reason: 'il lucchetto non cambia niente sulla casa',
    );
    await _chiudi(tester, coppia);
  });

  testWidgets('Base: toccando «Elaborate» si spiega, e non si sceglie', (
    tester,
  ) async {
    final coppia = await _laPagina(tester, premium: false, stile: 'semplici');
    await tester.tap(find.byKey(const Key('stile-elaborate')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('spiegazione-premium')), findsOneWidget);
    expect(
      coppia.$1.chieste.where(
        (una) => una['type'] == 'ponte/notifiche/imposta',
      ),
      isEmpty,
    );
    await _chiudi(tester, coppia);
  });

  testWidgets('Premium: niente lucchetti, e la giornata a un tocco', (
    tester,
  ) async {
    final coppia = await _laPagina(tester, premium: true);
    expect(find.byType(BollinoPremium), findsNothing);
    await tester.scrollUntilVisible(
      find.byKey(const Key('apri-la-giornata')),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.byKey(const Key('voce-riepilogo-bloccata')), findsNothing);
    expect(find.text('Ogni sera alle'), findsOneWidget);
    await _chiudi(tester, coppia);
  });

  testWidgets('un ponte di prima non lo dice: vale la licenza dell\'app', (
    tester,
  ) async {
    final coppia = await _laPagina(tester, premium: null);
    /* La licenza che l'app conosce: Base, e i lucchetti ci sono… */
    coppia.$2.licenza.forza = false;
    await tester.pump();
    expect(find.byType(BollinoPremium), findsWidgets);
    /* …Premium, e non ci sono. */
    coppia.$2.licenza.forza = true;
    await tester.pump();
    expect(find.byType(BollinoPremium), findsNothing);
    coppia.$2.licenza.forza = null;
    await _chiudi(tester, coppia);
  });

  testWidgets('il foglio di una voce: in Base «Elaborata» e «Nel riepilogo» '
      'hanno il lucchetto', (tester) async {
    var spiegata = 0;
    final cambiate = <SceltaDellaVoce>[];
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: FoglioDellaVoce(
            evento: 'elettrodomestici',
            scelta: const SceltaDellaVoce(
              stile: 'elaborata',
              come: 'riepilogo',
            ),
            stileGenerale: 'semplici',
            premium: false,
            spiegaIlPremium: () => spiegata += 1,
            cambia: cambiate.add,
          ),
        ),
      ),
    );
    await tester.tap(find.byKey(const Key('voce-stile-elaborata-bloccata')));
    await tester.pump();
    await tester.ensureVisible(
      find.byKey(const Key('voce-come-riepilogo-bloccata')),
    );
    await tester.tap(find.byKey(const Key('voce-come-riepilogo-bloccata')));
    await tester.pump();
    expect(spiegata, 2);
    expect(cambiate, isEmpty);
  });

  test('lo stato porta «premium», e un ponte di prima no', () {
    expect(StatoDelleNotifiche.leggi({'premium': false}).premium, isFalse);
    expect(StatoDelleNotifiche.leggi({'premium': true}).premium, isTrue);
    expect(StatoDelleNotifiche.leggi({}).premium, isNull);
    final andata = StatoDelleNotifiche.leggi({'premium': false}).inJson();
    expect(StatoDelleNotifiche.leggi(andata).premium, isFalse);
  });
}
