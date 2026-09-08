/// Le prove delle tessere che si rilevano da sole.
///
/// Nessuna di queste sta scritta in configurazione: la casa demo ha sei
/// sensori di batteria, un rilevatore di fumo e uno di allagamento, e le
/// tessere devono uscire da li' senza che nessuno abbia scelto niente.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/entita.dart';
import 'package:gdahome/plancia/configurazione.dart';
import 'package:gdahome/plancia/rilevate.dart';
import 'package:gdahome/plancia/tessere.dart';

import 'casa_demo.dart';

void main() {
  final demo = CasaDemo.leggi();
  final config = demo.configurazione;

  Tessera tessera(List<Tessera> tutte, String chiave) => tutte.firstWhere(
    (t) => t.chiave == chiave,
    orElse: () =>
        throw StateError('manca «$chiave» fra ${tutte.map((t) => t.chiave)}'),
  );

  List<Tessera> rilevate([Entita? Function(String)? leggi]) =>
      tessereRilevate(config, leggi ?? demo.stato, demo.tutte);

  test('le batterie: solo quelle scariche fanno numero', () {
    final batterie = tessera(rilevate(), 'batterie');
    /* Sei sensori di batteria in casa, uno solo sotto il venti per cento. */
    expect(batterie.valore, '1');
    expect(batterie.didascalia, 'Batteria telefono Marco 9%');
    expect(batterie.allarme, isTrue);
    expect(batterie.anello, 17);
    expect(batterie.righe.length, 6);
    /* Le piu' scariche per prime: e' l'ordine in cui si guarda. */
    expect(batterie.righe.first.nome, 'Batteria telefono Marco');
    expect(batterie.righe.first.valore, '9%');
    expect(batterie.righe.last.valore, '100%');
  });

  test('a batterie piene la tessera non c\'e\'', () {
    final piene = rilevate(
      demo.con({
        'sensor.telefono_marco_batteria': entita(
          'sensor.telefono_marco_batteria',
          '88',
          attributi: const {
            'device_class': 'battery',
            'unit_of_measurement': '%',
            'friendly_name': 'Batteria telefono Marco',
          },
        ),
      }),
    );
    expect(piene.where((t) => t.chiave == 'batterie'), isEmpty);
  });

  test('il fumo si vede anche quando tace, e dice quanti ne guarda', () {
    final fumo = tessera(rilevate(), 'fumo');
    expect(fumo.valore, '1');
    expect(fumo.didascalia, 'Tutto tranquillo');
    expect(fumo.allarme, isFalse);
    expect(fumo.anello, 0);
    expect(fumo.righe.single.nome, 'Fumo cucina');
  });

  test('quando il fumo suona la tessera passa in allarme e lo nomina', () {
    final acceso = rilevate(
      demo.con({
        'binary_sensor.fumo_cucina': entita(
          'binary_sensor.fumo_cucina',
          'on',
          attributi: const {
            'device_class': 'smoke',
            'friendly_name': 'Fumo cucina',
          },
        ),
      }),
    );
    final fumo = tessera(acceso, 'fumo');
    expect(fumo.allarme, isTrue);
    expect(fumo.valore, '1');
    expect(fumo.didascalia, 'Fumo cucina');
    expect(fumo.anello, 100);
  });

  test('gli allagamenti restano a casa asciutta', () {
    final acqua = tessera(rilevate(), 'allagamenti');
    expect(acqua.valore, '1');
    expect(acqua.didascalia, 'Tutto asciutto');
    expect(acqua.allarme, isFalse);
  });

  test("l'aria non c'e' se nessuno la misura", () {
    expect(rilevate().where((t) => t.chiave == 'aria'), isEmpty);
  });

  test("l'aria giudica dalla misura messa peggio, non dalla media", () {
    final letture = [
      for (final una in [
        entita(
          'sensor.salotto_co2',
          '1520',
          attributi: const {
            'device_class': 'carbon_dioxide',
            'unit_of_measurement': 'ppm',
            'friendly_name': 'CO2 salotto',
          },
        ),
        entita(
          'sensor.salotto_pm25',
          '4',
          attributi: const {
            'device_class': 'pm25',
            'unit_of_measurement': 'µg/m³',
            'friendly_name': 'PM2.5 salotto',
          },
        ),
      ])
        letturaDellAria(una, una.nome)!,
    ];
    expect(letture.first.grado, GradoDellAria.cattiva);
    expect(letture.last.grado, GradoDellAria.buona);
    expect(peggioreDellAria(letture)!.entita, 'sensor.salotto_co2');
    expect(
      fraseDellAria(letture),
      "Fra 2 misure, la peggiore e' Anidride carbonica 1.520 ppm (CO2 salotto). "
      'Aprire una finestra la fa scendere in fretta.',
    );
  });

  test("l'unita' cambia le soglie, non la sostanza", () {
    /* Gli stessi composti in microgrammi e in parti per miliardo differiscono
     * di mille: con le soglie sbagliate un'aria buona si direbbe cattiva. */
    final ppb = letturaDellAria(
      entita(
        'sensor.cov',
        '80',
        attributi: const {
          'device_class': 'volatile_organic_compounds',
          'unit_of_measurement': 'ppb',
        },
      ),
      'COV',
    )!;
    final microgrammi = letturaDellAria(
      entita(
        'sensor.cov2',
        '80',
        attributi: const {
          'device_class': 'volatile_organic_compounds',
          'unit_of_measurement': 'µg/m³',
        },
      ),
      'COV',
    )!;
    expect(ppb.grado, GradoDellAria.discreta);
    expect(microgrammi.grado, GradoDellAria.buona);
  });

  test('una cosa tolta apposta non torna al riavvio', () {
    final senzaFumo = ConfigurazioneDellaPlancia.daiValori({
      ...{
        for (final voce in demo.risposta['snapshot']['values'].entries)
          voce.key as String: voce.value as String,
      },
      'cd_gruppi_removed': '{"fumo": ["binary_sensor.fumo_cucina"]}',
    });
    final tessere = tessereRilevate(senzaFumo, demo.stato, demo.tutte);
    expect(tessere.where((t) => t.chiave == 'fumo'), isEmpty);
    /* Le altre non si toccano. */
    expect(tessere.where((t) => t.chiave == 'batterie'), isNotEmpty);
  });

  test('quello che la persona ha scritto vince sul rilevamento', () {
    final scelte = ConfigurazioneDellaPlancia.daiValori({
      ...{
        for (final voce in demo.risposta['snapshot']['values'].entries)
          voce.key as String: voce.value as String,
      },
      'cd_gruppi_extra': '{"batt": ["sensor.telefono_laura_batteria", "sensor.telefono_marco_batteria"]}',
      'cd_avvisi_names_extra': '{"sensor.telefono_marco_batteria": "Marco"}',
    });
    final batterie = tessera(
      tessereRilevate(scelte, demo.stato, demo.tutte),
      'batterie',
    );
    expect(batterie.righe.length, 2);
    expect(batterie.righe.first.nome, 'Marco');
    expect(batterie.anello, 50);
  });
}
