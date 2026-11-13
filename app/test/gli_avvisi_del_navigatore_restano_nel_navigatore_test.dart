/// Gli avvisi del navigatore restano nel navigatore.
///
/// Dal campo, in viaggio con Android Auto: sulla pagina Energia della plancia
/// e' comparso un riquadro scuro in basso, «3D aumentato non è disponibile su
/// questo telefono: torno alla vista 3D». La plancia non c'entrava niente.
///
/// La strada: la guida partita dall'auto apre la schermata di guida di gdanav
/// anche sul telefono (`SchermataPrincipale._guidaDaFuori`), dentro la sezione
/// del navigatore che la home tiene in piedi nascosta (l'`IndexedStack`). Se
/// la scena 3D si ferma, gdanav lo dice con uno SnackBar preso da
/// `ScaffoldMessenger.maybeOf(context)` (`lasciaAumentataConAvviso`).
/// GdanavDentro non ha un messaggero suo: si arrivava a quello dell'app, che
/// mostra lo SnackBar sullo Scaffold che si vede — la plancia.
///
/// Con un messaggero suo intorno alla sezione, l'avviso resta li': lo si
/// vede quando si apre il navigatore, non sopra un'altra pagina.
library;

import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Com'e' fatta la home intorno alle sezioni: uno Scaffold, l'IndexedStack,
/// gli orologi fermi per le nascoste. Nel navigatore un Navigator suo con uno
/// Scaffold, come GdanavDentro e la schermata di guida.
Widget _home({
  required int mostrata,
  required bool conMessaggeroSuo,
  required void Function(BuildContext) guida,
}) {
  Widget navigatore = Navigator(
    onGenerateRoute: (_) => MaterialPageRoute<void>(
      builder: (_) => Scaffold(
        body: Builder(
          builder: (context) {
            guida(context);
            return const Text('mappa');
          },
        ),
      ),
    ),
  );
  if (conMessaggeroSuo) navigatore = ScaffoldMessenger(child: navigatore);
  return MaterialApp(
    home: Scaffold(
      body: IndexedStack(
        index: mostrata,
        children: [
          TickerMode(enabled: mostrata == 0, child: const Text('Istantanea')),
          TickerMode(enabled: mostrata == 1, child: navigatore),
        ],
      ),
    ),
  );
}

const _avviso =
    '3D aumentato non è disponibile su questo telefono: torno alla vista 3D';

void _avvisa(BuildContext context) =>
    ScaffoldMessenger.maybeOf(context)
        ?.showSnackBar(const SnackBar(content: Text(_avviso)));

void main() {
  testWidgets('senza un messaggero suo, l\'avviso del navigatore nascosto '
      'finiva sopra la plancia', (tester) async {
    BuildContext? dentro;
    await tester.pumpWidget(
      _home(mostrata: 0, conMessaggeroSuo: false, guida: (c) => dentro = c),
    );
    _avvisa(dentro!);
    await tester.pumpAndSettle();
    /* Il difetto, com'era: si vede, e la sezione mostrata e' la plancia. */
    expect(find.text(_avviso).hitTestable(), findsOneWidget);
  });

  testWidgets('col messaggero suo resta nel navigatore, e si vede quando lo '
      'si apre', (tester) async {
    BuildContext? dentro;
    await tester.pumpWidget(
      _home(mostrata: 0, conMessaggeroSuo: true, guida: (c) => dentro = c),
    );
    _avvisa(dentro!);
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('Istantanea').hitTestable(), findsOneWidget);
    expect(find.text(_avviso).hitTestable(), findsNothing);

    /* Si apre il navigatore: l'avviso e' li', dove ha senso. */
    await tester.pumpWidget(
      _home(mostrata: 1, conMessaggeroSuo: true, guida: (c) => dentro = c),
    );
    /* L'orologio della sezione riparte: un giro per riaccenderlo, poi
     * l'entrata dello SnackBar. */
    await tester.pumpAndSettle();
    expect(find.text(_avviso).hitTestable(), findsOneWidget);
  });

  test('la home mette il navigatore dentro un messaggero suo', () {
    final home = File('lib/schermate/home.dart').readAsStringSync();
    expect(
      RegExp(
        r'Sezione\.navigatore\s*=>\s*ScaffoldMessenger\(\s*child:\s*IlNavigatore\(',
      ).hasMatch(home),
      isTrue,
      reason: 'gli SnackBar di gdanav arriverebbero al messaggero dell\'app',
    );
  });
}
