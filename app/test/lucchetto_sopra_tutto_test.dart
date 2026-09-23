/// Il velo del lucchetto, visto dall'app intera (#54).
///
/// Tre cose che prima non erano vere, e che qui si guardano:
///
///  - all'apertura la casa **non si vede nemmeno un attimo** prima che si
///    sappia se va chiesto il volto;
///  - il velo sta sopra **tutto**, anche sopra una pagina aperta sopra la
///    home — prima copriva la home e basta;
///  - lasciando l'app il velo si mette **subito**, e col lucchetto acceso la
///    finestra si dichiara riservata: e' quello che si vede nell'elenco delle
///    app recenti.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/dispensa/dispensa.dart';
import 'package:gdahome/casa/il_lucchetto.dart';
import 'package:gdahome/casa/impostazioni.dart';
import 'package:gdahome/casa/la_finestra.dart';
import 'package:gdahome/casa/la_guardia.dart';
import 'package:gdahome/main.dart';
import 'package:gdahome/schermate/riconoscimento.dart';

/// Una guardia che risponde quando glielo si dice.
class _GuardiaFinta implements LaGuardia {
  Completer<ComeEAndata> risposta = Completer();
  int chieste = 0;

  @override
  Future<CosaSaFareIlTelefono> cosaSaFare() async => const CosaSaFareIlTelefono(
    sa: {ComeRiconosce.volto},
    ceUnaGuardiaDelSistema: true,
  );

  @override
  Future<ComeEAndata> chiedi({required String perche}) {
    chieste += 1;
    return risposta.future;
  }
}

void main() {
  late Impostazioni impostazioni;
  late _GuardiaFinta guardia;
  late ValueNotifier<Widget?> velo;
  final finestra = <Object?>[];

  setUp(() async {
    impostazioni = Impostazioni(
      sulTelefono: true,
      android: true,
      dispensa: DispensaInMemoria(),
    );
    await impostazioni.carica();
    velo = ValueNotifier(null);
    finestra.clear();
    TestWidgetsFlutterBinding.ensureInitialized().defaultBinaryMessenger
        .setMockMethodCallHandler(canaleDellaFinestra, (chiamata) async {
          finestra.add(chiamata.arguments);
          return null;
        });
  });

  tearDown(() {
    TestWidgetsFlutterBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(canaleDellaFinestra, null);
  });

  /* La guardia nasce **dentro** la prova, non in `setUp`: la sua risposta
   * e' un `Completer`, e un `Completer` nato fuori dal tempo finto della
   * prova risponde quando la prova e' gia' finita. */
  Widget lApp() => MaterialApp(
    builder: (context, schermata) =>
        SopraTutto(velo: velo, child: schermata ?? const SizedBox.shrink()),
    home: Portone(
      cassaforte: CassaforteInMemoria(),
      impostazioni: impostazioni,
      guardia: guardia,
    ),
  );

  /// Qualche giro, uno alla volta, guardando a ogni giro che la casa non si
  /// veda mentre il velo non c'e' ancora.
  Future<void> finoAlVelo(WidgetTester tester) async {
    for (var giro = 0; giro < 40; giro += 1) {
      await tester.pump(const Duration(milliseconds: 20));
      if (find.byType(IlVeloDelRiconoscimento).evaluate().isNotEmpty) return;
      expect(
        find.text('Colleghiamo la casa'),
        findsNothing,
        reason: 'la casa si è vista prima del velo',
      );
    }
    fail('il velo non è mai arrivato');
  }

  testWidgets('all\'apertura la casa non si vede prima del velo', (
    tester,
  ) async {
    guardia = _GuardiaFinta();
    await impostazioni.metti(
      lucchetto: const IlLucchetto(allAvvio: true, alRitorno: true),
    );
    await tester.pumpWidget(lApp());
    await finoAlVelo(tester);
    expect(guardia.chieste, 1);
    expect(find.text('Colleghiamo la casa'), findsNothing);
    expect(finestra, [true], reason: 'la finestra è riservata');

    guardia.risposta.complete(ComeEAndata.si);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.byType(IlVeloDelRiconoscimento), findsNothing);
    expect(find.text('Colleghiamo la casa'), findsOneWidget);
  });

  testWidgets('lasciando l\'app il velo copre anche le pagine aperte sopra', (
    tester,
  ) async {
    guardia = _GuardiaFinta();
    await impostazioni.metti(
      lucchetto: const IlLucchetto(allAvvio: true, alRitorno: true),
    );
    guardia.risposta.complete(ComeEAndata.si);
    await tester.pumpWidget(lApp());
    for (var giro = 0; giro < 10; giro += 1) {
      await tester.pump(const Duration(milliseconds: 20));
    }
    expect(find.text('Colleghiamo la casa'), findsOneWidget);

    /* Una pagina sopra la home: e' qui che il velo di prima non arrivava. */
    final navigatore = tester.state<NavigatorState>(find.byType(Navigator));
    unawaited(
      navigatore.push(
        MaterialPageRoute<void>(
          builder: (_) => const Scaffold(body: Text('una pagina sopra')),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('una pagina sopra'), findsOneWidget);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    await tester.pump();
    expect(
      find.text('una pagina sopra'),
      findsNothing,
      reason: 'coperta appena l\'app smette di essere davanti',
    );
    expect(velo.value, isNotNull);

    /* Tornando entro il minuto non si chiede niente, e si toglie. */
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));
    expect(find.text('una pagina sopra'), findsOneWidget);
    expect(guardia.chieste, 1, reason: 'solo quella dell\'apertura');
  });

  testWidgets('col lucchetto spento non si copre niente', (tester) async {
    guardia = _GuardiaFinta();
    await tester.pumpWidget(lApp());
    for (var giro = 0; giro < 10; giro += 1) {
      await tester.pump(const Duration(milliseconds: 20));
    }
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    await tester.pump();
    expect(find.text('Colleghiamo la casa'), findsOneWidget);
    expect(velo.value, isNull);
    expect(finestra, [false]);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
  });
}
