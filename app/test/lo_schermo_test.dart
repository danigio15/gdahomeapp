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

  /* La luminosita' del pannello (#224): il pannello dice un numero, l'app lo
   * porta alla finestra — salendo in fretta, scendendo piano — e la rende al
   * sistema quando il pannello se ne va. */
  test('la luce del pannello sale, scende piano, e torna al sistema', () async {
    loSchermoDaCapo();
    passoDellaLuce = Duration.zero;
    addTearDown(() => passoDellaLuce = const Duration(milliseconds: 40));
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
    List<Object?> luce() => [
      for (final c in finestra)
        if (c.method == 'luminosita') c.arguments,
    ];

    /* Senza pannello il numero non vale: un telefono non si abbassa. */
    await loSchermoDice('luce:20');
    expect(luce(), isEmpty);

    await loSchermoDice('muro:si');
    await loSchermoDice('luce:90');
    expect(luce(), [0.9], reason: 'la prima volta dritti al valore');
    expect(luceDelPannello, 0.9);
    await loSchermoDice('luce:90');
    expect(luce(), [0.9], reason: 'solo quando cambia');

    await loSchermoDice('luce:20');
    expect(luce().last as double, closeTo(0.2, 1e-9));
    await loSchermoDice('luce:500');
    expect(luce().last, 1.0);

    /* Il campanello rende la luce al sistema su Android: si rimette quella
     * del pannello subito dopo. */
    await loSchermoDice('sveglia');
    final metodi = finestra.map((c) => c.method).toList();
    expect(metodi.sublist(metodi.length - 2), ['sveglia', 'luminosita']);

    await loSchermoDice('muro:no');
    expect(luce().last, -1.0);
    expect(luceDelPannello, isNull);
  });

  test('la dissolvenza: sale in pochi passi, scende in molti', () {
    const passo = Duration(milliseconds: 40);
    final su = passiDellaLuce(0.2, 0.9, passo: passo);
    final giu = passiDellaLuce(0.9, 0.2, passo: passo);
    expect(su.length, 10);
    expect(giu.length, 50);
    expect(su.last, 0.9);
    expect(giu.last, closeTo(0.2, 1e-9));
    for (var i = 1; i < giu.length; i++) {
      expect(giu[i], lessThan(giu[i - 1]));
    }
    expect(passiDellaLuce(0.5, 0.5), [0.5]);
  });

  test('la luce della stanza in tre parole, senza ballare sulle soglie', () {
    expect(luceDellaStanza(2), 'buio');
    expect(luceDellaStanza(30), 'penombra');
    expect(luceDellaStanza(300), 'chiaro');
    /* Da buio si esce solo sopra i 12 lux, da chiaro solo sotto i 50. */
    expect(luceDellaStanza(9, 'buio'), 'buio');
    expect(luceDellaStanza(9, 'penombra'), 'penombra');
    expect(luceDellaStanza(60, 'chiaro'), 'chiaro');
    expect(luceDellaStanza(60, 'penombra'), 'penombra');
  });

  /* I sensori si accendono solo col pannello acceso, e alla pagina arrivano
   * parole: «c'e'», «buio». Le capacita' del tablet le chiede la Config. */
  test(
    'i sensori del tablet: solo col pannello, e alla pagina solo parole',
    () async {
      loSchermoDaCapo();
      final finestra = <MethodCall>[];
      final pagina = <Map<String, Object?>>[];
      final messaggero =
          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
      messaggero.setMockMethodCallHandler(canaleDellaFinestra, (c) async {
        finestra.add(c);
        if (c.method == 'sensori') return {'luce': true, 'prossimita': false};
        return null;
      });
      messaggero.setMockMethodCallHandler(
        SystemChannels.platform,
        (c) async => null,
      );
      Future<void> dici(String detto) =>
          loSchermoDice(detto, allaPagina: (d) async => pagina.add(d));
      List<Object?> ascolta() => [
        for (final c in finestra)
          if (c.method == 'ascolta') c.arguments,
      ];

      await dici('capacita?');
      expect(pagina.single, {
        'capacita': {
          'luce': true,
          'prossimita': false,
          'piattaforma': 'android',
        },
      });

      /* Chiesti prima del pannello: si aspetta che il pannello ci sia. */
      await dici('sensori:luce+prossimita');
      expect(ascolta(), isEmpty);
      await dici('muro:si');
      expect(ascolta().single, ['luce', 'prossimita']);

      await loSchermoSente('luce', lux: 3);
      await loSchermoSente('luce', lux: 8);
      await loSchermoSente('luce', lux: 200);
      await loSchermoSente('prossimita', vicino: true);
      expect(pagina.skip(1).toList(), [
        {'luce': 'buio'},
        {'luce': 'chiaro'},
        {'prossimita': 'si'},
      ]);

      /* Spento il pannello i sensori si spengono, e la pagina lo sa. */
      await dici('muro:no');
      expect(ascolta().last, isEmpty);
      expect(pagina.last, {'luce': '', 'prossimita': ''});
      await loSchermoSente('prossimita', vicino: true);
      expect(pagina.last, {'luce': '', 'prossimita': ''});
    },
  );
}
