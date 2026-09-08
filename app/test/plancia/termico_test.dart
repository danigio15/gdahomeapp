/// Le prove dell'acqua calda: scaldabagno e caldaia.
///
/// La casa demo non ha ne' l'uno ne' l'altra — non ce l'ha nemmeno la plancia
/// web nelle sue anteprime — quindi qui la configurazione si scrive a mano,
/// che e' anche il modo di provare i casi storti: la caldaia senza manometro,
/// lo scaldabagno col solo rele'.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/entita.dart';
import 'package:gdahome/plancia/configurazione.dart';
import 'package:gdahome/plancia/termico.dart';
import 'package:gdahome/plancia/tessere.dart';

import 'casa_demo.dart';

void main() {
  final demo = CasaDemo.leggi();

  /// La casa demo con qualche chiave in piu' nella configurazione.
  ConfigurazioneDellaPlancia conLeChiavi(Map<String, String> chiavi) =>
      ConfigurazioneDellaPlancia.daiValori({
        for (final voce in (demo.risposta['snapshot']['values'] as Map).entries)
          voce.key as String: voce.value as String,
        ...chiavi,
      });

  Tessera? tessera(List<Tessera> tutte, String chiave) =>
      tutte.where((t) => t.chiave == chiave).firstOrNull;

  group('lo scaldabagno', () {
    final config = conLeChiavi({
      'cd_scaldabagni':
          '[{"id":"boiler","name":"Scaldabagno bagno",'
          '"entity":"water_heater.bagno","potenza":"sensor.scaldabagno_watt"}]',
    });

    Entita? leggi(String id) => switch (id) {
      'water_heater.bagno' => entita(
        'water_heater.bagno',
        'heat',
        attributi: const {
          'current_temperature': 44.2,
          'temperature': 55,
          'min_temp': 10,
          'friendly_name': 'Scaldabagno',
        },
      ),
      'sensor.scaldabagno_watt' => entita('sensor.scaldabagno_watt', '1180'),
      _ => null,
    };

    test('dice quanto manca all\'acqua calda, non quanto e\' calda', () {
      final lettura = lettureDegliScaldabagni(config, leggi).single;
      expect(lettura.temperatura, 44.2);
      expect(lettura.obiettivo, 55);
      expect(lettura.acceso, isTrue);
      expect(lettura.stato, StatoDelloScaldabagno.scalda);
      /* Da dieci gradi a cinquantacinque: quarantaquattro e due e' il 76%. */
      expect(lettura.quota, closeTo(0.76, 0.01));
      /* Un `water_heater` si comanda da se', anche senza un rele' mappato. */
      expect(lettura.comandabile, 'water_heater.bagno');
    });

    test('la tessera scrive i gradi e verso dove sta andando', () {
      final t = tessera(tessereTermiche(config, leggi), 'scaldabagno')!;
      expect(t.valore, '44,2°');
      expect(t.didascalia, 'Scalda verso 55°');
      expect(t.anello, 76);
      expect(t.attiva, isTrue);
      expect(t.righe.first.nome, 'Resistenza');
      expect(t.righe.map((r) => r.nome), [
        'Resistenza',
        'Acqua adesso',
        'Obiettivo',
        'Consumo',
      ]);
      expect(t.righe.last.valore, '1.180 W');
    });

    test('arrivata a temperatura dice che l\'acqua e\' pronta', () {
      Entita? calda(String id) => id == 'water_heater.bagno'
          ? entita(
              'water_heater.bagno',
              'heat',
              attributi: const {
                'current_temperature': 54.8,
                'temperature': 55,
                'min_temp': 10,
              },
            )
          : leggi(id);
      final t = tessera(tessereTermiche(config, calda), 'scaldabagno')!;
      expect(t.didascalia, 'Acqua pronta');
      /* Mezzo grado di tolleranza: sotto quello la resistenza si sta gia'
       * spegnendo da sola, e dire «scalda» su un'acqua calda e' sbagliato. */
      expect(t.attiva, isFalse);
    });

    test('col solo rele\' parla l\'interruttore', () {
      final soloRele = conLeChiavi({
        'cd_scaldabagni':
            '[{"id":"b","name":"Boiler","interruttore":"switch.boiler"}]',
      });
      final t = tessera(
        tessereTermiche(soloRele, (id) => entita('switch.boiler', 'on')),
        'scaldabagno',
      )!;
      expect(t.valore, 'Acceso');
      /* Senza obiettivo non c'e' una corsa da misurare: niente anello, invece
       * di un cerchio pieno a caso. */
      expect(t.anello, isNull);
    });
  });

  group('la caldaia', () {
    final config = conLeChiavi({
      'cd_caldaia':
          '{"name":"Caldaia","fiamma":"binary_sensor.fiamma",'
          '"mandata":"sensor.mandata","ritorno":"sensor.ritorno",'
          '"pressione":"sensor.pressione","modulazione":"sensor.modulazione"}',
    });

    Entita? leggi(String id) => switch (id) {
      'binary_sensor.fiamma' => entita('binary_sensor.fiamma', 'on'),
      'sensor.mandata' => entita('sensor.mandata', '62.4'),
      'sensor.ritorno' => entita('sensor.ritorno', '48.1'),
      'sensor.pressione' => entita('sensor.pressione', '1.6'),
      'sensor.modulazione' => entita('sensor.modulazione', '38'),
      _ => null,
    };

    test('di una caldaia si guarda il salto, non una temperatura', () {
      final lettura = lettureDelleCaldaie(config, leggi).single;
      expect(lettura.mandata, 62.4);
      expect(lettura.salto, 14.3);
      /* La fiamma accesa e' gia' una caldaia accesa: chi mappa solo il
       * bruciatore non deve mappare anche uno stato. */
      expect(lettura.acceso, isTrue);
      expect(lettura.inFunzione, isTrue);
      expect(
        verdettoDellaPressione(lettura.pressione),
        VerdettoDellaPressione.buona,
      );
    });

    test('la tessera scrive la mandata e il salto', () {
      final t = tessera(tessereTermiche(config, leggi), 'caldaia')!;
      expect(t.valore, '62,4°');
      expect(t.didascalia, 'Salto 14,3°');
      expect(t.anello, 38);
      expect(t.attiva, isTrue);
      expect(t.allarme, isFalse);
      expect(t.righe.map((r) => r.nome), [
        'Bruciatore',
        'Mandata',
        'Ritorno',
        'Pressione',
        'Modulazione',
      ]);
    });

    test('la pressione bassa e\' l\'unica cosa che chiede di alzarsi', () {
      Entita? sgonfia(String id) => id == 'sensor.pressione'
          ? entita('sensor.pressione', '0.7')
          : leggi(id);
      final t = tessera(tessereTermiche(config, sgonfia), 'caldaia')!;
      expect(t.allarme, isTrue);
      expect(t.didascalia, 'Pressione bassa: rabbocca');
    });

    test('due caldaie: parla quella accesa, e le righe le portano tutte', () {
      final due = conLeChiavi({
        'cd_caldaia':
            '[{"name":"Zona giorno","fiamma":"binary_sensor.g",'
            '"mandata":"sensor.mg"},'
            '{"name":"Zona notte","fiamma":"binary_sensor.n",'
            '"mandata":"sensor.mn"}]',
      });
      Entita? stati(String id) => switch (id) {
        'binary_sensor.g' => entita('binary_sensor.g', 'off'),
        'binary_sensor.n' => entita('binary_sensor.n', 'on'),
        'sensor.mg' => entita('sensor.mg', '30'),
        'sensor.mn' => entita('sensor.mn', '58'),
        _ => null,
      };
      final t = tessera(tessereTermiche(due, stati), 'caldaia')!;
      expect(t.valore, '58,0°');
      expect(t.righe.first.nome, 'Zona giorno · Bruciatore');
      expect(t.righe.map((r) => r.nome), contains('Zona notte · Mandata'));
    });

    test('una riga senza nemmeno un\'entita\' non e\' una caldaia', () {
      final vuota = conLeChiavi({'cd_caldaia': '{"name":"Nuova"}'});
      expect(tessera(tessereTermiche(vuota, (_) => null), 'caldaia'), isNull);
    });
  });
}
