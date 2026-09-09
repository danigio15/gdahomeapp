/// Il catalogo delle integrazioni, letto come lo manda il ponte.
///
/// La forma la decide `ponte/src/catalogo.js`, e queste prove la tengono
/// ferma: se cambia di la' senza cambiare di qua, il menu delle integrazioni
/// si svuota in silenzio — che e' il modo peggiore di rompersi.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/catalogo/catalogo.dart';

void main() {
  group('il catalogo', () {
    final risposta = {
      'integrations': [
        {'domain': 'hon', 'name': 'hOn', 'custom': true, 'devices': 2},
        {
          'domain': 'home_connect',
          'name': 'Home Connect',
          'custom': false,
          'devices': 1,
        },
      ],
      'devices': [
        {
          'id': 'dev1',
          'name': 'Lavatrice',
          'manufacturer': 'Candy',
          'model': 'RO4',
          'integration': 'hon',
          'area': 'Lavanderia',
          'entities': 22,
          'disabled': false,
        },
        {
          'id': 'dev2',
          'name': 'Forno',
          'manufacturer': 'Bosch',
          'model': '',
          'integration': 'home_connect',
          'area': '',
          'entities': 9,
          'disabled': true,
        },
      ],
      'entities': [
        {
          'entity_id': 'sensor.lavatrice_tempo',
          'device_id': 'dev1',
          'name': 'Tempo rimanente',
          'unit': 'min',
          'category': '',
          'disabled': false,
        },
        {
          'entity_id': 'sensor.lavatrice_firmware',
          'device_id': 'dev1',
          'name': 'Firmware',
          'category': 'diagnostic',
          'disabled': false,
        },
      ],
    };

    test('legge integrazioni, dispositivi ed entita\'', () {
      final letto = leggiIlCatalogo(risposta);
      expect(letto.integrazioni.length, 2);
      expect(letto.dispositivi.length, 2);
      expect(letto.entita['dev1']!.length, 2);
    });

    test('le entita\' stanno sotto il loro dispositivo', () {
      final letto = leggiIlCatalogo(risposta);
      expect(letto.entita['dev2'], isNull);
      expect(letto.entita['dev1']!.map((una) => una.id), [
        'sensor.lavatrice_tempo',
        'sensor.lavatrice_firmware',
      ]);
    });

    test('i dispositivi si filtrano per integrazione', () {
      final letto = leggiIlCatalogo(risposta);
      expect(letto.dellIntegrazione('hon').single.nome, 'Lavatrice');
      expect(letto.dellIntegrazione('miele'), isEmpty);
    });

    test('marca, modello e stanza stanno in una riga sola', () {
      final letto = leggiIlCatalogo(risposta);
      expect(letto.dispositivi.first.sotto, 'Candy · RO4 · Lavanderia');
      /* Il forno non ha modello ne' stanza: la riga non deve restare coi
       * puntini in mezzo. */
      expect(letto.dispositivi.last.sotto, 'Bosch');
    });

    test('quello che e\' spento lo dice', () {
      final letto = leggiIlCatalogo(risposta);
      expect(letto.dispositivi.last.spento, isTrue);
    });

    test('le entita\' di servizio si riconoscono', () {
      /* Sono quelle che il menu nasconde di serie: una lavatrice ne ha venti
       * fra firmware e stati interni, e in mezzo a quelle il tempo rimanente
       * non si trova piu'. */
      final letto = leggiIlCatalogo(risposta);
      final servizio = letto.entita['dev1']!.where(
        (una) => una.categoria.isNotEmpty,
      );
      expect(servizio.single.nome, 'Firmware');
    });

    test('una risposta storta non fa cadere niente', () {
      expect(leggiIlCatalogo(null).integrazioni, isEmpty);
      expect(leggiIlCatalogo('boh').dispositivi, isEmpty);
      expect(leggiIlCatalogo({'devices': 'no'}).dispositivi, isEmpty);
    });
  });
}
