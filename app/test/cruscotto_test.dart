/// La schermata del cruscotto: quando apre il riquadro, e quando non lo apre.
///
/// La riga che conta e' la seconda. Le sezioni dell'app restano tutte in piedi
/// — la home le tiene in un `IndexedStack`, perche' la plancia non si rifaccia
/// a ogni ritorno — quindi questa schermata **esiste anche quando nessuno la
/// guarda**. Se aprisse il riquadro alla costruzione, ogni installatore che
/// avvia l'app andrebbe a chiedere il cruscotto senza averlo chiesto.
///
/// E' successo davvero, ed e' venuto fuori per la porta di servizio: sei prove
/// del portone, che con questa schermata non c'entrano niente, sono diventate
/// rosse perche' `flutter_tester` un WebView non ce l'ha e costruirne uno
/// solleva. Quelle prove hanno fatto da sentinella per caso; questa lo fa
/// apposta.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/schermate/cruscotto.dart';

Widget _conLaSchermata({required String dove, required bool visibile}) =>
    MaterialApp(
      home: Scaffold(
        body: SchermataDelCruscotto(dove: dove, visibile: visibile),
      ),
    );

void main() {
  testWidgets('finché non si guarda, non apre niente', (tester) async {
    /* Se provasse ad aprire, `flutter_tester` solleverebbe: il WebView qui non
     * c'e'. Che questa prova passi **e'** la prova. */
    await tester.pumpWidget(
      _conLaSchermata(
        dove: 'https://quadro.gdahome.org/console/',
        visibile: false,
      ),
    );
    await tester.pump();
    expect(tester.takeException(), isNull);
  });

  testWidgets('senza indirizzo lo dice, invece di aprire il nulla', (
    tester,
  ) async {
    await tester.pumpWidget(_conLaSchermata(dove: '', visibile: true));
    await tester.pump();
    expect(tester.takeException(), isNull);
    expect(find.textContaining('manca l\'indirizzo'), findsOneWidget);
  });

  testWidgets('un indirizzo che non è un indirizzo vale come niente', (
    tester,
  ) async {
    /* `Uri.tryParse` su queste non torna `null`: torna un `Uri` senza casa, e
     * fidarsi del solo `tryParse` voleva dire provare ad aprirle. */
    for (final storto in [
      '',
      '   ',
      'quadro.gdahome.org',
      'javascript:alert(1)',
    ]) {
      await tester.pumpWidget(_conLaSchermata(dove: storto, visibile: true));
      await tester.pump();
      expect(
        tester.takeException(),
        isNull,
        reason: 'ha provato ad aprire «$storto»',
      );
      expect(
        find.textContaining('manca l\'indirizzo'),
        findsOneWidget,
        reason: 'con «$storto» non ha detto che manca',
      );
    }
  });
}
