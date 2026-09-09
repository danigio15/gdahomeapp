/// Il cercatore deve indovinare come indovina la dashboard.
///
/// Sono le prove che tengono fermo il porto: se un giorno le regole si
/// scollegano da quelle di `entity-search-index.js`, la stessa casella
/// proporrebbe due cose diverse dal telefono e dal browser, e una delle due
/// sembrerebbe sbagliata. Qui stanno i casi che contano.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/cerca/indice.dart';
import 'package:gdahome/casa/entita.dart';

Entita _una(
  String id, {
  String nome = '',
  String stato = 'on',
  String? classe,
  String? unita,
  String? stanza,
}) => Entita(
  id: id,
  stato: stato,
  attributi: {
    if (nome.isNotEmpty) 'friendly_name': nome,
    if (classe != null) 'device_class': classe,
    if (unita != null) 'unit_of_measurement': unita,
    if (stanza != null) 'area': stanza,
  },
);

List<Cercabile> _casa(List<Entita> quali) => [
  for (final una in quali)
    if (Cercabile.da(una) != null) Cercabile.da(una)!,
];

void main() {
  group('la ripiegatura', () {
    test('toglie gli accenti e le maiuscole', () {
      expect(ripiega('Umidità Salotto'), 'umidita salotto');
      expect(ripiega('Temperatura Cameretta'), 'temperatura cameretta');
    });

    test('un testo senza accenti torna com\'era, in minuscolo', () {
      expect(ripiega('sensor.Cucina_LED'), 'sensor.cucina_led');
    });

    test('spezza in parole sui segni', () {
      expect(gettoni('sensor.salotto_temp-2'), [
        'sensor',
        'salotto',
        'temp',
        '2',
      ]);
    });
  });

  group('cosa vuole una casella', () {
    test('«Sensore di temperatura» vuole un sensore coi gradi', () {
      final vuole = cosaVuole(etichetta: 'Sensore di temperatura');
      expect(vuole.domini, contains('sensor'));
      expect(vuole.classi, contains('temperature'));
      expect(vuole.unita, contains('°C'));
      expect(vuole.vuoto, isFalse);
    });

    test('la chiave della casella conta quanto l\'etichetta', () {
      /* `dm.energy_potenza_batteria` non ha etichetta, e deve bastare. */
      final vuole = cosaVuole(chiave: 'dm.energy_potenza_batteria');
      expect(vuole.classi, contains('power'));
      expect(vuole.classi, contains('battery'));
    });

    test('l\'unita\' fra parentesi si legge', () {
      final vuole = cosaVuole(etichetta: 'Potenza fotovoltaico (W)');
      expect(vuole.unita, contains('W'));
    });

    test('una casella per una luce accetta anche un rele\'', () {
      /* E' scritto apposta nella dashboard: una lampada dietro uno switch si
       * configura come una light, e il cercatore le deve proporre tutte e
       * due. */
      final vuole = cosaVuole(etichetta: 'Luce del salotto');
      expect(vuole.domini, containsAll(['light', 'switch']));
    });

    test('le parole che non dicono niente non contano', () {
      final vuole = cosaVuole(etichetta: 'Entita\' opzionale del campo');
      expect(vuole.vuoto, isTrue);
    });

    test('il dominio scritto nel testo si riconosce', () {
      final vuole = cosaVuole(suggerimento: 'es. climate.salotto');
      expect(vuole.domini, contains('climate'));
    });
  });

  group('chi merita la pastiglia «suggerita»', () {
    final casa = _casa([
      _una(
        'sensor.salotto_temperatura',
        nome: 'Temperatura salotto',
        classe: 'temperature',
        unita: '°C',
        stato: '21.4',
      ),
      _una('light.salotto', nome: 'Luce salotto'),
      _una(
        'sensor.salotto_umidita',
        nome: 'Umidita\' salotto',
        classe: 'humidity',
        unita: '%',
      ),
      _una('automation.salotto_sera', nome: 'Salotto la sera'),
    ]);

    test('il sensore giusto e\' suggerito, gli altri no', () {
      final vuole = cosaVuole(etichetta: 'Sensore di temperatura');
      final trovate = cerca(casa, vuole: vuole);
      final suggerite = trovate
          .where((una) => una.suggerita)
          .map((una) => una.una.id);
      expect(suggerite, ['sensor.salotto_temperatura']);
    });

    test('e sta in cima anche senza scrivere niente', () {
      final vuole = cosaVuole(etichetta: 'Sensore di temperatura');
      expect(
        cerca(casa, vuole: vuole).first.una.id,
        'sensor.salotto_temperatura',
      );
    });

    test('una casella che sa il dominio non la accontenta un\'altra', () {
      /* Una luce che ha per caso la parola della stanza non e' un sensore di
       * temperatura: darle la pastiglia farebbe perdere di senso la
       * pastiglia. */
      final vuole = cosaVuole(etichetta: 'Sensore di temperatura salotto');
      final luce = casa.firstWhere((una) => una.id == 'light.salotto');
      expect(quantoCentra(luce, vuole).forte, isFalse);
    });

    test('senza suggerimenti nessuno e\' suggerito', () {
      final trovate = cerca(casa, vuole: const CosaVuole.niente());
      expect(trovate.every((una) => !una.suggerita), isTrue);
    });
  });

  group('la ricerca', () {
    final casa = _casa([
      _una('light.cucina', nome: 'Luce cucina'),
      _una('switch.cucina_presa', nome: 'Presa cucina'),
      _una(
        'sensor.cucina_temperatura',
        nome: 'Temperatura cucina',
        classe: 'temperature',
      ),
      _una('light.bagno', nome: 'Faretti bagno'),
      _una('sensor.rotta', nome: 'Sensore rotto', stato: 'unavailable'),
    ]);

    test('trova sul nome e sull\'identificativo', () {
      expect(cerca(casa, scritto: 'cucina').length, 3);
      expect(cerca(casa, scritto: 'faretti').single.una.id, 'light.bagno');
    });

    test('tutte le parole devono comparire', () {
      expect(
        cerca(casa, scritto: 'cucina presa').single.una.id,
        'switch.cucina_presa',
      );
      expect(cerca(casa, scritto: 'cucina inesistente'), isEmpty);
    });

    test('chi comincia con quello che si e\' scritto sta prima', () {
      final trovate = cerca(casa, scritto: 'light.cucina');
      expect(trovate.first.una.id, 'light.cucina');
    });

    test('un\'entita\' che non risponde scende', () {
      final trovate = cerca(casa, scritto: 'sensor');
      expect(trovate.last.una.id, 'sensor.rotta');
    });

    test('senza niente scritto ci sono tutte', () {
      expect(cerca(casa).length, casa.length);
    });

    test('il filtro per dominio tiene solo quello', () {
      final trovate = cerca(casa, soloIlDominio: 'light');
      expect(trovate.map((una) => una.una.dominio).toSet(), {'light'});
    });

    test('quello che c\'e\' gia\' nella casella sta in cima', () {
      final vuole = cosaVuole(etichetta: 'Luce', adesso: 'light.bagno');
      expect(cerca(casa, vuole: vuole).first.una.id, 'light.bagno');
    });

    test('a pari punteggio l\'ordine non balla', () {
      /* Due liste che cambiano ordine fra una lettera e l'altra si leggono
       * come una lista che salta. */
      final prima = cerca(
        casa,
        scritto: 'cucina',
      ).map((una) => una.una.id).toList();
      final dopo = cerca(
        casa,
        scritto: 'cucina',
      ).map((una) => una.una.id).toList();
      expect(prima, dopo);
    });

    test('quello che non e\' un\'entita\' non entra nell\'indice', () {
      expect(Cercabile.da(_una('senzapunto')), isNull);
      expect(Cercabile.da(_una('')), isNull);
    });
  });

  _leStanze();
}

/* Le stanze: senza, il cercatore e' cieco proprio dove servirebbe di piu'. */
void _leStanze() {
  group('le stanze dai registri', () {
    test('una parola che sta solo nella stanza si trova lo stesso', () {
      /* `sensor.0x00124b` non dice niente a nessuno: chi lo configura cerca
       * «cameretta», e quella parola sta solo nel registro. */
      final casa = _casa([
        _una('sensor.0x00124b0022', nome: 'Temperatura', classe: 'temperature'),
      ]);
      expect(cerca(casa, scritto: 'cameretta'), isEmpty);

      final conStanza = [
        Cercabile.da(
          _una(
            'sensor.0x00124b0022',
            nome: 'Temperatura',
            classe: 'temperature',
          ),
          stanza: 'Cameretta',
        )!,
      ];
      expect(
        cerca(conStanza, scritto: 'cameretta').single.una.id,
        'sensor.0x00124b0022',
      );
    });

    test('la stanza del campo alza chi ci sta dentro', () {
      final quali = [
        Cercabile.da(
          _una('sensor.uno', nome: 'Temperatura', classe: 'temperature'),
          stanza: 'Salotto',
        )!,
        Cercabile.da(
          _una('sensor.due', nome: 'Temperatura', classe: 'temperature'),
          stanza: 'Cameretta',
        )!,
      ];
      final vuole = cosaVuole(
        etichetta: 'Sensore di temperatura',
        stanza: 'Cameretta',
      );
      expect(cerca(quali, vuole: vuole).first.una.id, 'sensor.due');
    });
  });
}
