/// La pagina Salute col WHOOP: le schede ci sono solo quando qualcosa viene
/// dal WHOOP, la riga dice «Collega» o «Collegato · Scollega», e il
/// recupero si apre nel suo dettaglio.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/salute/il_corpo.dart';
import 'package:gdahome/salute/whoop/collegamento_whoop.dart';
import 'package:gdahome/schermate/salute.dart';
import 'package:gdahome/schermate/salute_whoop.dart';

import 'scene.dart';
import 'scena_whoop.dart';

Future<ScenaWhoop> _laPagina(
  WidgetTester tester, {
  required bool collegato,
  Map<MisuraDelCorpo, Lettura>? dalTelefono,
  bool conWhoop = true,
}) async {
  tester.view.physicalSize = const Size(390 * 3, 3200 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  late ScenaWhoop scena;
  await tester.runAsync(() async {
    scena = await ScenaWhoop.prepara(
      collegato: collegato,
      dalTelefono: dalTelefono,
    );
  });
  await tester.pumpWidget(
    MaterialApp(
      home: SchermataDellaSalute(
        collegamento: scena.collegamento,
        postino: scena.postino,
        whoop: conWhoop ? scena.whoop : null,
      ),
    ),
  );
  await tester.runAsync(
    () => Future<void>.delayed(const Duration(milliseconds: 200)),
  );
  await tester.pumpAndSettle();
  return scena;
}

void main() {
  testWidgets('senza WHOOP: niente schede, niente «da WHOOP»', (tester) async {
    await _laPagina(tester, collegato: false, dalTelefono: tutteDiMarco);
    expect(find.byType(SchedeWhoop), findsNothing);
    expect(find.textContaining('da WHOOP'), findsNothing);
    /* La riga per collegarlo c'e', e recupero e sforzo non si scelgono. */
    expect(find.byKey(const Key('whoop-collega')), findsOneWidget);
    expect(find.byKey(const Key('salute-misura-recupero')), findsNothing);
    expect(find.byKey(const Key('salute-misura-sforzo')), findsNothing);
  });

  testWidgets('la pagina di prima, se il WHOOP non c\'e\' nell\'app', (
    tester,
  ) async {
    await _laPagina(tester, collegato: false, conWhoop: false);
    expect(find.byKey(const Key('whoop-riga')), findsNothing);
  });

  testWidgets(
    'senza collegare: quello che l\'app WHOOP scrive in Salute, «da WHOOP»',
    (tester) async {
      await _laPagina(tester, collegato: false);
      expect(find.byType(SchedeWhoop), findsOneWidget);
      expect(find.byKey(const Key('whoop-scheda-sonno')), findsOneWidget);
      expect(find.byKey(const Key('whoop-scheda-cuore')), findsOneWidget);
      /* Recupero e sforzo solo con l'account. */
      expect(find.byKey(const Key('whoop-scheda-recupero')), findsNothing);
      expect(find.byKey(const Key('whoop-scheda-sforzo')), findsNothing);
      expect(find.text("l'ultimo · 55 bpm · da WHOOP"), findsOneWidget);
      expect(find.text("l'ultima · 46 ms · da WHOOP"), findsOneWidget);
      expect(find.text('quelli di oggi · 2.318'), findsOneWidget);
      expect(find.text('Collega'), findsOneWidget);
    },
  );

  testWidgets('collegato: le quattro schede e «Collegato · Scollega»', (
    tester,
  ) async {
    await _laPagina(tester, collegato: true);
    for (final scheda in ['recupero', 'sforzo', 'sonno', 'cuore']) {
      expect(find.byKey(Key('whoop-scheda-$scheda')), findsOneWidget);
    }
    expect(find.text('78%'), findsOneWidget);
    expect(find.text('12,4'), findsOneWidget);
    expect(find.textContaining('Collegato'), findsOneWidget);
    expect(find.byKey(const Key('whoop-scollega')), findsOneWidget);
    expect(find.byKey(const Key('salute-misura-recupero')), findsOneWidget);
    expect(find.text("l'ultimo · 78% · da WHOOP"), findsOneWidget);
  });

  testWidgets('il recupero si apre nel dettaglio', (tester) async {
    await _laPagina(tester, collegato: true);
    await tester.tap(find.byKey(const Key('whoop-scheda-recupero')));
    await tester.pumpAndSettle();
    expect(find.byType(SchermataDelRecupero), findsOneWidget);
    expect(find.byKey(const Key('whoop-recupero-percento')), findsOneWidget);
    expect(find.text('Verde'), findsOneWidget);
    expect(find.text('48 ms'), findsOneWidget);
  });

  testWidgets('«Collega» apre la pagina di WHOOP', (tester) async {
    final scena = await _laPagina(tester, collegato: false);
    await tester.tap(find.byKey(const Key('whoop-collega')));
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 100)),
    );
    await tester.pumpAndSettle();
    final attesa = await tester.runAsync(
      () => scena.whoop.cassaforte.leggi(CollegamentoWhoop.chiaveAttesa),
    );
    expect(attesa, isNotNull);
  });

  testWidgets('«Scollega» chiede, poi toglie tutto', (tester) async {
    final scena = await _laPagina(tester, collegato: true);
    await tester.tap(find.byKey(const Key('whoop-scollega')));
    await tester.pumpAndSettle();
    expect(find.text('Scollegare WHOOP?'), findsOneWidget);
    await tester.tap(find.byKey(const Key('whoop-scollega-si')));
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 200)),
    );
    await tester.pumpAndSettle();
    expect(scena.whoop.collegato, isFalse);
    expect(scena.server.revocato, isTrue);
    expect(find.byKey(const Key('whoop-collega')), findsOneWidget);
    expect(find.byKey(const Key('whoop-scheda-recupero')), findsNothing);
  });
}
