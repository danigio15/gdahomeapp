/// «Se ci sono piu' persone nella casa e apro la mappa di gdanav mi mostra
/// sulla mappa la posizione delle persone della casa.» Quali sono le dice la
/// plancia, dove stanno Home Assistant.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/entita.dart';
import 'package:gdahome/schermate/navigatore_qui/le_persone.dart';

Entita e(String id, String stato, [Map<String, dynamic> a = const {}]) =>
    Entita(id: id, stato: stato, attributi: a);

void main() {
  test('le persone della plancia, senza quelle nascoste', () {
    final persone = lePersoneDallaPlancia({
      'cd_people':
          '[{"name":"Persona 1","entity":"person.persona_1","address":"sensor.tel_geocoded_location"},'
          '{"name":"Persona 2","entity":"person.persona_2","nascosta":true},'
          '{"name":"Senza entita"}]',
    });
    expect(persone.map((p) => p.entita), ['person.persona_1']);
    expect(persone.single.indirizzo, 'sensor.tel_geocoded_location');
    expect(lePersoneDallaPlancia({'cd_people': 'non json'}), isEmpty);
  });

  test('sulla mappa solo chi ha un punto, con l\'indirizzo scritto bene', () {
    final stati = {
      'person.persona_1': e('person.persona_1', 'not_home', {
        'friendly_name': 'Persona 1',
        'latitude': 40.86,
        'longitude': 14.28,
      }),
      'sensor.tel_geocoded_location': e(
        'sensor.tel_geocoded_location',
        'Via Toledo, 12, 80134 Napoli NA, Italia',
      ),
      'person.persona_2': e('person.persona_2', 'home'),
    };
    final persona_1 = sullaMappa((
      entita: 'person.persona_1',
      nome: '',
      indirizzo: 'sensor.tel_geocoded_location',
    ), (id) => stati[id]);
    expect(persona_1?.id, 'person.persona_1');
    expect(persona_1?.nome, 'Persona 1');
    expect(persona_1?.posizione.lat, 40.86);
    expect(persona_1?.dove, 'Via Toledo 12, Napoli');
    expect(
      sullaMappa((
        entita: 'person.persona_2',
        nome: 'Persona 2',
        indirizzo: '',
      ), (id) => stati[id]),
      isNull,
    );
  });

  test('«home» o una zona non sono un indirizzo', () {
    expect(indirizzoLeggibile(e('sensor.tel_geocoded_location', 'home')), '');
    expect(indirizzoLeggibile(e('device_tracker.tel', 'Lavoro')), '');
    expect(indirizzoLeggibile(e('sensor.g', '40.85,14.26')), '');
    expect(
      indirizzoLeggibile(
        e('sensor.g', 'qualunque', {
          'Thoroughfare': 'Via Toledo',
          'Sub Thoroughfare': '12',
          'Locality': 'Napoli',
        }),
      ),
      'Via Toledo 12, Napoli',
    );
  });
}
