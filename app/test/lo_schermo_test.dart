import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/la_finestra.dart';
import 'package:gdahome/casa/lo_schermo.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'il pannello a muro nasconde le barre, e di notte abbassa la luce',
    () async {
      final finestra = <MethodCall>[];
      final sistema = <MethodCall>[];
      final messaggero =
          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
      messaggero.setMockMethodCallHandler(canaleDellaFinestra, (c) async {
        finestra.add(c);
        return null;
      });
      messaggero.setMockMethodCallHandler(SystemChannels.platform, (c) async {
        sistema.add(c);
        return null;
      });

      await loSchermoDice('muro:si');
      await loSchermoDice('muro:si');
      expect(
        sistema
            .where((c) => c.method == 'SystemChrome.setEnabledSystemUIMode')
            .length,
        1,
        reason: 'solo quando cambia',
      );
      expect(sistema.last.arguments, 'SystemUiMode.immersiveSticky');

      await loSchermoDice('spento:si');
      expect(finestra.single.method, 'luminosita');
      expect(finestra.single.arguments, 0.0);

      /* Spento il pannello, la luce torna quella del sistema. */
      await loSchermoDice('muro:no');
      expect(sistema.last.arguments, 'SystemUiMode.edgeToEdge');
      expect(finestra.last.arguments, -1.0);
    },
  );

  test('il chiosco nasconde le barre anche senza pannello, e al ritorno si rimettono', () async {
    final sistema = <MethodCall>[];
    final messaggero =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    messaggero.setMockMethodCallHandler(SystemChannels.platform, (c) async {
      sistema.add(c);
      return null;
    });
    List<Object?> modi() => [
      for (final c in sistema)
        if (c.method == 'SystemChrome.setEnabledSystemUIMode') c.arguments,
    ];

    await loSchermoDice('chiosco:si');
    expect(modi().last, 'SystemUiMode.immersiveSticky');
    /* Il pannello che si spegne non rimette le barre: il chiosco e' acceso. */
    await loSchermoDice('muro:si');
    await loSchermoDice('muro:no');
    expect(modi().last, 'SystemUiMode.immersiveSticky');
    /* Android le ha rimesse (un ritorno, un pieghevole aperto): si ritolgono. */
    final quante = modi().length;
    await loSchermoRimetti();
    expect(modi().length, quante + 1);
    expect(modi().last, 'SystemUiMode.immersiveSticky');
    /* Spento il chiosco tornano, e da li' il ritorno non tocca piu' niente. */
    await loSchermoDice('chiosco:no');
    expect(modi().last, 'SystemUiMode.edgeToEdge');
    final dopo = modi().length;
    await loSchermoRimetti();
    expect(modi().length, dopo);
  });

  test(
    'col campanello lo schermo resta acceso, e quando suona si sveglia',
    () async {
      final finestra = <MethodCall>[];
      final messaggero =
          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
      messaggero.setMockMethodCallHandler(canaleDellaFinestra, (c) async {
        finestra.add(c);
        return null;
      });
      messaggero.setMockMethodCallHandler(
        SystemChannels.platform,
        (c) async => null,
      );
      List<Object?> acceso() => [
        for (final c in finestra)
          if (c.method == 'acceso') c.arguments,
      ];

      /* Senza pannello a muro non si tiene acceso niente, e non si sveglia
       * niente: un telefono in tasca non si accende per un campanello. */
      await loSchermoDice('acceso:si');
      await loSchermoDice('sveglia');
      expect(acceso(), isEmpty);
      expect(finestra.where((c) => c.method == 'sveglia'), isEmpty);
      expect(schermoTenutoAcceso, isFalse);

      /* Col pannello si': una volta sola, finche' non cambia. */
      await loSchermoDice('muro:si');
      await loSchermoDice('acceso:si');
      expect(acceso(), [true]);
      expect(schermoTenutoAcceso, isTrue);

      /* Di notte la luce va al minimo; lo squillo la rimette piena e chiede
       * all'app di riaccendere lo schermo. */
      await loSchermoDice('spento:si');
      await loSchermoDice('sveglia');
      final dopo = finestra.map((c) => c.method).toList();
      expect(dopo.sublist(dopo.length - 2), ['luminosita', 'sveglia']);
      expect(finestra[finestra.length - 2].arguments, -1.0);

      /* Spento il pannello, lo schermo torna del sistema. */
      await loSchermoDice('muro:no');
      expect(acceso(), [true, false]);
      expect(schermoTenutoAcceso, isFalse);
      await loSchermoDice('acceso:no');
      expect(acceso(), [true, false]);
    },
  );
}
