/// Le prove del riassunto.
///
/// Quello che si prova qui e' **cosa decide di dire la home**, che e' logica e
/// non disegno. La casa e' finta ma vera nella forma: le entita' hanno gli
/// stessi attributi che manda Home Assistant.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/riassunto.dart';
import 'package:gdahome/casa/stato_della_casa.dart';
import 'package:gdahome/ponte/filo.dart';

import '../ponte/ponte_finto.dart';

void main() {
  late PonteFinto ponte;
  late Filo filo;
  late StatoDellaCasa casa;

  Future<Riassunto> conLaCasaChe(
    List<Map<String, dynamic>> entita, {
    DateTime? adesso,
  }) async {
    ponte.entita = entita;
    filo = Filo.fisso(
      indirizzo: ponte.indirizzo,
      segno: segnoBuono,
      chi: chiBuono,
      chiave: chiaveBuona,
    );
    await filo.apri();
    casa = StatoDellaCasa(filo);
    await casa.attacca();
    return Riassunto.di(casa, adesso: adesso);
  }

  setUp(() async => ponte = await PonteFinto.alza());
  tearDown(() async {
    await casa.stacca();
    await filo.chiudi();
    await ponte.spegni();
  });

  test('con tutto spento lo dice, invece di non dire niente', () async {
    final riassunto = await conLaCasaChe([
      PonteFinto.unaEntita('light.cucina', 'off', nome: 'Cucina'),
      PonteFinto.unaEntita('light.salotto', 'off', nome: 'Salotto'),
    ]);

    expect(riassunto.luciAccese, isEmpty);
    expect(riassunto.tuttoSpento, isTrue);
    final luci = riassunto.tessere.firstWhere((una) => una.chiave == 'luci');
    expect(luci.valore, 'tutte spente');
    expect(luci.attenzione, isFalse);
  });

  test('le luci accese si contano e si nominano', () async {
    final riassunto = await conLaCasaChe([
      PonteFinto.unaEntita('light.cucina', 'on', nome: 'Cucina'),
      PonteFinto.unaEntita('light.salotto', 'on', nome: 'Salotto'),
      PonteFinto.unaEntita('light.bagno', 'off', nome: 'Bagno'),
    ]);

    expect(riassunto.luciAccese.length, 2);
    final luci = riassunto.tessere.firstWhere((una) => una.chiave == 'luci');
    expect(luci.valore, '2 accese');
    expect(luci.dettaglio, 'Cucina, Salotto');
  });

  test('oltre tre nomi si scrive «e altri N»', () async {
    final riassunto = await conLaCasaChe([
      for (var i = 1; i <= 5; i += 1)
        PonteFinto.unaEntita('light.l$i', 'on', nome: 'Luce $i'),
    ]);
    final luci = riassunto.tessere.firstWhere((una) => una.chiave == 'luci');
    expect(luci.dettaglio, 'Luce 1, Luce 2, Luce 3 e altri 2');
  });

  test('una finestra aperta e\' una cosa da guardare', () async {
    final riassunto = await conLaCasaChe([
      PonteFinto.unaEntita(
        'binary_sensor.f1',
        'on',
        nome: 'Finestra cucina',
        tipo: 'window',
      ),
      PonteFinto.unaEntita(
        'binary_sensor.f2',
        'off',
        nome: 'Finestra bagno',
        tipo: 'window',
      ),
      /* Un movimento acceso non e' un'apertura: non deve finire nel conto. */
      PonteFinto.unaEntita(
        'binary_sensor.m',
        'on',
        nome: 'Movimento',
        tipo: 'motion',
      ),
    ]);

    expect(riassunto.apertureAperte.length, 1);
    final aperture = riassunto.tessere.firstWhere(
      (una) => una.chiave == 'aperture',
    );
    /* «1 aperte» e' quello che ci scriveva prima, e si e' visto solo
     * guardando una fotografia della schermata vera. */
    expect(aperture.valore, '1 aperta');
    expect(aperture.titolo, 'Un\'apertura');
    expect(aperture.attenzione, isTrue);
  });

  test('senza aperture la tessera non compare', () async {
    final riassunto = await conLaCasaChe([
      PonteFinto.unaEntita('light.cucina', 'off', nome: 'Cucina'),
    ]);
    expect(riassunto.tessere.any((una) => una.chiave == 'aperture'), isFalse);
  });

  test(
    'la temperatura e\' la media dei sensori, e i muti non contano',
    () async {
      final riassunto = await conLaCasaChe([
        PonteFinto.unaEntita(
          'sensor.a',
          '20.0',
          tipo: 'temperature',
          unita: '°C',
        ),
        PonteFinto.unaEntita(
          'sensor.b',
          '22.0',
          tipo: 'temperature',
          unita: '°C',
        ),
        PonteFinto.unaEntita(
          'sensor.rotto',
          'unavailable',
          tipo: 'temperature',
        ),
        /* Un'umidita' non e' una temperatura. */
        PonteFinto.unaEntita('sensor.u', '99.0', tipo: 'humidity', unita: '%'),
      ]);

      expect(riassunto.temperaturaMedia, 21.0);
      expect(
        riassunto.tessere
            .firstWhere((una) => una.chiave == 'temperatura')
            .valore,
        '21.0°',
      );
    },
  );

  test('senza sensori di temperatura la tessera non compare', () async {
    final riassunto = await conLaCasaChe([
      PonteFinto.unaEntita('light.cucina', 'off'),
    ]);
    expect(riassunto.temperaturaMedia, isNull);
    expect(
      riassunto.tessere.any((una) => una.chiave == 'temperatura'),
      isFalse,
    );
  });

  test('l\'antifurto si legge inserito o disinserito', () async {
    var riassunto = await conLaCasaChe([
      PonteFinto.unaEntita(
        'alarm_control_panel.casa',
        'armed_away',
        nome: 'Antifurto',
      ),
    ]);
    expect(riassunto.allarmeInserito, isTrue);
    expect(
      riassunto.tessere.firstWhere((una) => una.chiave == 'allarme').valore,
      'inserito',
    );

    await casa.stacca();
    await filo.chiudi();
    riassunto = await conLaCasaChe([
      PonteFinto.unaEntita(
        'alarm_control_panel.casa',
        'disarmed',
        nome: 'Antifurto',
      ),
    ]);
    expect(riassunto.allarmeInserito, isFalse);
  });

  test('quello che non risponde da poco si segnala, quello fermo da mesi no', () async {
    final adesso = DateTime.utc(2026, 9, 7, 12);
    final riassunto = await conLaCasaChe([
      PonteFinto.unaEntita(
        'sensor.appena_morto',
        'unavailable',
        nome: 'Sensore garage',
        cambiataIl: adesso.subtract(const Duration(hours: 2)).toIso8601String(),
      ),
      PonteFinto.unaEntita(
        'sensor.morto_da_mesi',
        'unavailable',
        nome: 'Vecchia integrazione',
        cambiataIl: adesso.subtract(const Duration(days: 90)).toIso8601String(),
      ),
    ], adesso: adesso);

    /* Uno da due ore e' una batteria finita stanotte: si dice. Uno da tre mesi
     * e' un'integrazione configurata male, e non e' la home il posto dove
     * dirlo. */
    expect(riassunto.mute.map((una) => una.id), ['sensor.appena_morto']);
    expect(
      riassunto.tessere.firstWhere((una) => una.chiave == 'mute').attenzione,
      isTrue,
    );
  });

  test('una casa vuota da un riassunto vuoto senza esplodere', () async {
    final riassunto = await conLaCasaChe([]);
    expect(riassunto.quante, 0);
    expect(
      riassunto.tessere.length,
      1,
      reason: 'resta solo la tessera delle luci',
    );
    expect(riassunto.tuttoSpento, isTrue);
  });

  test('uno e tanti si scrivono diversi', () async {
    var riassunto = await conLaCasaChe([
      PonteFinto.unaEntita('light.una', 'on', nome: 'Una'),
      PonteFinto.unaEntita('switch.una', 'on', nome: 'Presa'),
      PonteFinto.unaEntita(
        'binary_sensor.una',
        'on',
        nome: 'Finestra',
        tipo: 'window',
      ),
    ]);
    expect(
      riassunto.tessere.firstWhere((t) => t.chiave == 'luci').valore,
      '1 accesa',
    );
    expect(
      riassunto.tessere.firstWhere((t) => t.chiave == 'prese').valore,
      '1 accesa',
    );
    expect(
      riassunto.tessere.firstWhere((t) => t.chiave == 'aperture').valore,
      '1 aperta',
    );

    await casa.stacca();
    await filo.chiudi();
    riassunto = await conLaCasaChe([
      PonteFinto.unaEntita('light.una', 'on', nome: 'Una'),
      PonteFinto.unaEntita('light.due', 'on', nome: 'Due'),
      PonteFinto.unaEntita(
        'binary_sensor.una',
        'on',
        nome: 'F1',
        tipo: 'window',
      ),
      PonteFinto.unaEntita(
        'binary_sensor.due',
        'on',
        nome: 'F2',
        tipo: 'window',
      ),
    ]);
    expect(
      riassunto.tessere.firstWhere((t) => t.chiave == 'luci').valore,
      '2 accese',
    );
    expect(
      riassunto.tessere.firstWhere((t) => t.chiave == 'aperture').valore,
      '2 aperte',
    );
  });

  test('le tessere stanno in un ordine stabile', () async {
    final riassunto = await conLaCasaChe([
      PonteFinto.unaEntita('light.l', 'on', nome: 'Luce'),
      PonteFinto.unaEntita(
        'binary_sensor.f',
        'on',
        nome: 'Finestra',
        tipo: 'window',
      ),
      PonteFinto.unaEntita('sensor.t', '20.0', tipo: 'temperature'),
      PonteFinto.unaEntita(
        'alarm_control_panel.a',
        'armed_home',
        nome: 'Antifurto',
      ),
      PonteFinto.unaEntita('switch.p', 'on', nome: 'Presa'),
    ]);

    expect(riassunto.tessere.map((una) => una.chiave), [
      'luci',
      'aperture',
      'temperatura',
      'allarme',
      'prese',
    ]);
  });
}
