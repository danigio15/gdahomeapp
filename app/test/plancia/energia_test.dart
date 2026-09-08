/// Le prove dell'energia.
///
/// Il segno della rete e' tutto: positivo si preleva, negativo si immette, e
/// leggerlo al contrario vuol dire raccontare che si sta guadagnando mentre
/// si sta pagando. La casa demo ha due impianti — casa e dependance — e i
/// numeri sono quelli che scrive la plancia web sulle sue anteprime.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/plancia/energia.dart';

import 'casa_demo.dart';

void main() {
  final demo = CasaDemo.leggi();
  final config = demo.configurazione;

  test('due impianti: il primo dalle chiavi canoniche, l\'altro da plants', () {
    final letture = lettureDegliImpianti(config, demo.stato);
    expect(letture.length, 2);
    expect(letture.first.id, 'impianto');
    expect(letture.last.nome, 'Dependance');
  });

  test('la somma degli impianti fa la casa intera', () {
    final letture = lettureDegliImpianti(config, demo.stato);
    final insieme = sommaDegliImpianti(letture);
    /* Gli stessi 7,66 kW che la tessera della Home scrive in copertina. */
    expect(insieme.casa, closeTo(7660, 1));
    expect(
      insieme.casa,
      closeTo((letture.first.casa ?? 0) + (letture.last.casa ?? 0), 0.01),
    );
  });

  test('sommare due «non lo so» non fa zero', () {
    final vuoti = [
      for (final lettura in lettureDegliImpianti(config, (_) => null)) lettura,
    ];
    final insieme = sommaDegliImpianti(vuoti);
    expect(insieme.casa, isNull);
    expect(insieme.oggi, isNull);
    expect(insieme.ceQualcosa, isFalse);
  });

  test('il verso della rete e della batteria lo dice il segno', () {
    final letture = lettureDegliImpianti(config, demo.stato);
    final primo = letture.first;
    expect(primo.rete, isNotNull);
    expect(primo.siPreleva || primo.siImmette, isTrue);
    /* I due versi non possono essere veri insieme. */
    expect(primo.siPreleva && primo.siImmette, isFalse);
    expect(primo.siCarica && primo.siScarica, isFalse);
  });

  test('i kilowatt si portano a watt, i watt restano watt', () {
    final inKilowatt = letturaDellImpianto(
      config,
      (id) => id == 'sensor.casa_potenza'
          ? entita(
              'sensor.casa_potenza',
              '2.4',
              attributi: const {'unit_of_measurement': 'kW'},
            )
          : null,
      config.impianti.first,
    );
    expect(inKilowatt.casa, closeTo(2400, 0.01));
  });

  test('la quota del sole non si inventa quando manca un pezzo', () {
    final letture = lettureDegliImpianti(config, demo.stato);
    final insieme = sommaDegliImpianti(letture);
    expect(insieme.quotaDelSole, inInclusiveRange(0, 100));

    final senzaSole = letturaDellImpianto(
      config,
      (id) => id == 'sensor.casa_potenza'
          ? entita('sensor.casa_potenza', '900')
          : null,
      config.impianti.first,
    );
    expect(senzaSole.quotaDelSole, isNull);
  });

  test('i carichi: solo quelli da mostrare, in ordine, coi loro watt', () {
    final carichi = carichiDellEnergia(config);
    /* Vale `energyLoads`, che e' l'elenco della pagina Energia; `loads` e' un
     * altro elenco, quello delle tessere, e mescolarli farebbe comparire due
     * volte le stesse macchine con due nomi diversi. */
    expect(carichi.map((c) => c.nome), [
      'Wallbox',
      'Clima',
      'Lavanderia',
      'Cucina',
      'Boiler',
    ]);
    final letture = lettureDeiCarichi(config, demo.stato);
    expect(letture.length, 5);
    expect(letture.first.watt, isNotNull);
    /* `energyLoads` scrive i kilowattora di oggi in `energy_entity`. */
    expect(letture.first.oggi, isNotNull);
  });

  test('i prezzi si leggono dalla configurazione', () {
    final prezzi = PrezziDellEnergia.dalla(config);
    expect(prezzi.costo, 0.28);
    expect(prezzi.immissione, 0.09);
    expect(prezzi.spesaDi(10), closeTo(2.8, 0.001));
    expect(prezzi.spesaDi(null), isNull);
  });

  group('il disegno di un carico', () {
    test('viene dal nome, che e\' l\'unica cosa che un carico ha', () {
      expect(disegnoDelCarico('Wallbox'), 'ev');
      expect(disegnoDelCarico('Ricarica auto'), 'ev');
      expect(disegnoDelCarico('Climatizzazione'), 'clima');
      expect(disegnoDelCarico('Boiler'), 'scaldabagno');
      expect(disegnoDelCarico('Pompa piscina'), 'piscina');
    });

    test('un nome che non dice niente prende quello generico', () {
      /* Meglio un disegno che non dice niente di uno che dice il falso: un
       * frigorifero con la macchina sopra si legge, e si legge sbagliato. */
      expect(disegnoDelCarico('Gruppo 3'), 'elettrodomestici');
      expect(disegnoDelCarico(''), 'elettrodomestici');
    });
  });
}
