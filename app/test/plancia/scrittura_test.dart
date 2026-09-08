/// Le prove del salvataggio: quello che si rimanda, e come si legge la
/// risposta.
library;

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/plancia/configurazione.dart';
import 'package:gdahome/plancia/scrittura.dart';

void main() {
  group('lo scatto da rimandare', () {
    test('porta indietro anche le chiavi che l\'app non ha toccato', () {
      final config = ConfigurazioneDellaPlancia.daiValori({
        'cd_lights': '{"groups":[{"name":"Cucina"}]}',
        'cd_qualcosa_che_non_conosciamo': '{"a":1}',
      });

      final scatto = config.scattoCon({'cd_branding': '{"title":"Casa"}'});

      expect(scatto['cd_branding'], '{"title":"Casa"}');
      /* Identiche, non ricostruite: l'archivio sostituisce tutto lo scatto, e
       * una chiave riscritta a modo nostro sarebbe una chiave rovinata. */
      expect(scatto['cd_lights'], '{"groups":[{"name":"Cucina"}]}');
      expect(scatto['cd_qualcosa_che_non_conosciamo'], '{"a":1}');
    });

    test('una chiave messa a vuoto si toglie', () {
      final config = ConfigurazioneDellaPlancia.daiValori({
        'cd_lights': '{"groups":[]}',
        'cd_pool': '{"tempEnt":"sensor.x"}',
      });

      final scatto = config.scattoCon({'cd_pool': ''});

      expect(scatto.containsKey('cd_pool'), isFalse);
      expect(scatto['cd_lights'], '{"groups":[]}');
    });
  });

  group('cambiare una sezione', () {
    test('scrive la canonica e la vecchia, che devono dire la stessa cosa', () {
      final config = ConfigurazioneDellaPlancia.daiValori({
        'dm_dashboard_state':
            '{"sections":{"sockets":[{"entity":"switch.vecchia"}],'
            '"lights":[{"entity":"light.cucina"}]},"visibility":{"sockets":true}}',
        'cd_prese': '[{"entity":"switch.vecchia"}]',
      });

      final cambiamenti = config.cambiaLaSezione('sockets', [
        {'entity': 'switch.nuova', 'name': 'Presa nuova'},
      ]);

      expect(cambiamenti['cd_prese'], contains('switch.nuova'));
      final stato = jsonDecode(
        cambiamenti['dm_dashboard_state']!,
      ) as Map<String, Object?>;
      final sezioni = stato['sections']! as Map<String, Object?>;
      expect((sezioni['sockets']! as List).single, {
        'entity': 'switch.nuova',
        'name': 'Presa nuova',
      });
      /* Quello che non si e' toccato resta: le altre sezioni, e le parti dello
       * stato che quest'app nemmeno legge. */
      expect(sezioni['lights'], [
        {'entity': 'light.cucina'},
      ]);
      expect(stato['visibility'], {'sockets': true});
    });

    test('una sezione senza chiave vecchia scrive solo la canonica', () {
      final config = ConfigurazioneDellaPlancia.daiValori(const {});

      final cambiamenti = config.cambiaLaSezione('doors', const []);

      expect(cambiamenti.keys, ['dm_dashboard_state']);
    });
  });

  group('la risposta della casa', () {
    test('salvata', () {
      final esito = leggiLEsito({
        'status': 'saved',
        'profile': 'primary',
        'snapshot': {
          'revision': 8,
          'values': {'cd_lights': '{"groups":[]}'},
        },
      });

      expect(esito.esito, EsitoDelSalvataggio.salvata);
      expect(esito.andata, isTrue);
      expect(esito.adesso.revisione, 8);
    });

    test('invariata vale come andata bene: era gia\' cosi\'', () {
      final esito = leggiLEsito({
        'status': 'unchanged',
        'snapshot': {'revision': 3, 'values': {}},
      });

      expect(esito.esito, EsitoDelSalvataggio.invariata);
      expect(esito.andata, isTrue);
    });

    test('scavalcata: torna il lavoro dell\'altro, non il nostro', () {
      final esito = leggiLEsito({
        'status': 'conflict',
        'snapshot': {
          'revision': 12,
          'values': {'cd_branding': '{"title":"La sua"}'},
        },
      });

      expect(esito.esito, EsitoDelSalvataggio.scavalcata);
      expect(esito.andata, isFalse);
      expect(esito.adesso.revisione, 12);
      expect(esito.adesso.titolo, 'La sua');
    });

    test('rifiutata quando si sta per svuotare una plancia configurata', () {
      final esito = leggiLEsito({
        'status': 'refused-empty',
        'snapshot': {'revision': 4, 'values': {}},
      });

      expect(
        esito.esito,
        EsitoDelSalvataggio.rifiutataPerchePresumibilmenteVuota,
      );
      expect(esito.andata, isFalse);
    });

    test('una risposta che non si capisce non e\' un salvataggio', () {
      /* Meglio credere di non aver scritto e andare a rileggere, che credere
       * di aver scritto e tenersi in mano una configurazione che in casa non
       * c'e'. */
      expect(leggiLEsito(null).esito, EsitoDelSalvataggio.scavalcata);
      expect(
        leggiLEsito({'status': 'boh'}).esito,
        EsitoDelSalvataggio.scavalcata,
      );
    });
  });
}
