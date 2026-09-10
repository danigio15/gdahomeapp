/// Le vasche: il porto di `pool-model.js`, tenuto fermo dalle prove.
///
/// La regola che conta e' una: **non si sposta niente**. La prima vasca resta
/// in cima a `cd_piscina`, dove il runtime l'ha sempre cercata; le altre stanno
/// nell'elenco `pools` accanto. Chi ha una piscina sola non ha un elenco e non
/// ha niente da migrare — e se una di queste prove cade, e' successo proprio
/// quello che la regola esiste per impedire.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/plancia/vasche.dart';

void main() {
  group('leggere le vasche', () {
    test('senza niente c\'e\' una vasca coi valori di partenza', () {
      final vasche = leVasche(<String, dynamic>{});
      expect(vasche, hasLength(1));
      expect(vasche.first['id'], 'piscina');
      expect(vasche.first['phMin'], 7.0);
      expect(vasche.first['phMax'], 7.6);
      expect(vasche.first['filterStart'], '09:00');
      expect(vasche.first['filterHours'], 8);
      expect(vasche.first['autoHours'], true);
    });

    test('la prima sta in cima, le altre nell\'elenco accanto', () {
      final vasche = leVasche(<String, dynamic>{
        'tempEnt': 'sensor.acqua',
        'pools': [
          {'tempEnt': 'sensor.idro', 'name': 'Idromassaggio'},
        ],
      });
      expect(vasche, hasLength(2));
      expect(vasche[0]['tempEnt'], 'sensor.acqua');
      expect(vasche[0]['id'], 'piscina');
      expect(vasche[1]['tempEnt'], 'sensor.idro');
      expect(vasche[1]['id'], 'piscina-2');
      expect(vasche[1]['name'], 'Idromassaggio');
    });

    test('una configurazione gia\' scritta come elenco non perde la prima', () {
      final vasche = leVasche([
        {'tempEnt': 'sensor.una'},
        {'tempEnt': 'sensor.due'},
      ]);
      expect(vasche, hasLength(2));
      expect(vasche[0]['tempEnt'], 'sensor.una');
      expect(vasche[1]['tempEnt'], 'sensor.due');
    });

    test('un id gia\' scritto si tiene', () {
      final vasche = leVasche(<String, dynamic>{'id': 'la-mia'});
      expect(vasche.first['id'], 'la-mia');
    });
  });

  group('salvare le vasche', () {
    test('con una sola non nasce nessun elenco', () {
      final scritto = vascheDaSalvare([
        {'tempEnt': 'sensor.acqua'},
      ], <String, dynamic>{});
      expect(scritto.containsKey('pools'), isFalse);
      expect(scritto['tempEnt'], 'sensor.acqua');
      expect(scritto['id'], 'piscina');
    });

    test('con due, la seconda va nell\'elenco', () {
      final scritto = vascheDaSalvare([
        {'tempEnt': 'sensor.acqua'},
        {'tempEnt': 'sensor.idro'},
      ], <String, dynamic>{});
      expect(scritto['tempEnt'], 'sensor.acqua');
      expect(scritto['pools'], hasLength(1));
      expect((scritto['pools'] as List).first['tempEnt'], 'sensor.idro');
    });

    /* La plancia in `cd_piscina` ci tiene anche i secondi di filtrazione di
     * oggi. Riscrivere l'oggetto da zero azzererebbe lo storico di chi ha la
     * piscina da prima, e non se ne accorgerebbe nessuno finche' la tessera
     * non dicesse «0 ore» a fine giornata. */
    test('quello che non e\' di una vasca resta dov\'era', () {
      final scritto = vascheDaSalvare(
        [
          {'tempEnt': 'sensor.acqua'},
        ],
        <String, dynamic>{
          'cd_pool_run': {'giorno': '2026-09-10', 'secondi': 4200},
          'tempEnt': 'sensor.vecchia',
        },
      );
      expect(scritto['cd_pool_run'], isNotNull);
      expect(scritto['tempEnt'], 'sensor.acqua');
    });

    test('togliere la seconda toglie anche l\'elenco', () {
      final prima = vascheDaSalvare([
        {'tempEnt': 'sensor.acqua'},
        {'tempEnt': 'sensor.idro'},
      ], <String, dynamic>{});
      final dopo = vascheDaSalvare([
        {'tempEnt': 'sensor.acqua'},
      ], prima);
      expect(dopo.containsKey('pools'), isFalse);
    });

    test('scritte e rilette sono le stesse', () {
      final partenza = [
        {'tempEnt': 'sensor.acqua', 'lightEnt': 'light.piscina'},
        {'tempEnt': 'sensor.idro', 'name': 'Idro', 'clMin': 1.0},
      ];
      final tornate = leVasche(vascheDaSalvare(partenza, <String, dynamic>{}));
      expect(tornate, hasLength(2));
      expect(tornate[0]['lightEnt'], 'light.piscina');
      expect(tornate[1]['name'], 'Idro');
      expect(tornate[1]['clMin'], 1.0);
    });
  });

  group('quando vale la pena disegnarla', () {
    test('una vasca vuota non conta', () {
      expect(vascaConfigurata(leVasche(<String, dynamic>{}).first), isFalse);
    });

    test('basta una qualunque delle sue entita\'', () {
      for (final campo in [
        'tempEnt',
        'pumpEnt',
        'phEnt',
        'clEnt',
        'heatEnt',
        'lightEnt',
      ]) {
        expect(
          vascaConfigurata({campo: 'sensor.qualcosa'}),
          isTrue,
          reason: campo,
        );
      }
    });

    test('le soglie da sole non bastano', () {
      expect(vascaConfigurata({'phMin': 7.0, 'phMax': 7.6}), isFalse);
    });
  });

  test('come si chiama', () {
    expect(comeSiChiamaLaVasca({'name': 'Idro'}, 1), 'Idro');
    expect(comeSiChiamaLaVasca(<String, dynamic>{}, 0), 'La piscina');
    expect(comeSiChiamaLaVasca(<String, dynamic>{}, 1), 'Vasca 2');
  });
}
