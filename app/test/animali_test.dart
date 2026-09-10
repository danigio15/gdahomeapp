/// Gli animali: il porto di `animali-model.js`, tenuto fermo dalle prove.
///
/// Quello che conta e' che un distributore PetKit finisca nelle stesse
/// caselle da qui e dal browser: se il motore indovinasse in un altro modo,
/// lo stesso dispositivo verrebbe configurato in due modi diversi a seconda
/// di dove lo si tocca.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/catalogo/catalogo.dart';
import 'package:gdahome/casa/entita.dart';
import 'package:gdahome/casa/plancia/animali.dart';

EntitaDelDispositivo _e(
  String id, {
  String nome = '',
  String classe = '',
  String categoria = '',
  bool spenta = false,
  String traduzione = '',
}) => EntitaDelDispositivo(
  id: id,
  nome: nome,
  classe: classe,
  unita: '',
  categoria: categoria,
  spenta: spenta,
  chiaveDiTraduzione: traduzione,
);

const _petkit = Dispositivo(
  id: 'd-petkit',
  nome: 'Distributore Micio',
  marca: 'PetKit',
  modello: 'Fresh Element',
  integrazione: 'petkit',
  stanza: 'Cucina',
  quanteEntita: 6,
  spento: false,
);

void main() {
  group('la forma', () {
    test('un animale nuovo ha tutte le chiavi, nell\'ordine della plancia', () {
      final uno = normalizzaAnimale(const {}, 0);
      expect(uno.keys.take(6), [
        'id',
        'nome',
        'specie',
        'foto',
        'stanza',
        'nascosto',
      ]);
      expect(uno['id'], 'animale-1');
      expect(uno['specie'], 'altro');
      expect(uno['nascosto'], false);
      for (final chiave in [...chiaviDelleCaselle, ...chiaviDelleAzioni]) {
        expect(uno[chiave], '', reason: chiave);
      }
      expect(uno['soglie'], soglieDiSerie);
      expect(uno['dispositivi'], isEmpty);
      expect(uno.keys.last, 'dispositivi');
    });

    test(
      'legge anche i nomi vecchi, e una soglia storta vale quella di serie',
      () {
        final uno = normalizzaAnimale({
          'name': ' Micio ',
          'species': 'gatto',
          'photo': '/local/micio.jpg',
          'room_id': 'cucina',
          'soglie': {'cibo': '35', 'lettiera': -3, 'giorni': 'x'},
          'dispositivi': [
            {
              'id': 'd1',
              'name': 'Feeder',
              'integration': 'petkit',
              'manufacturer': 'PetKit',
            },
            {'name': 'senza id'},
          ],
        });
        expect(uno['nome'], 'Micio');
        expect(uno['specie'], 'gatto');
        expect(uno['foto'], '/local/micio.jpg');
        expect(uno['stanza'], 'cucina');
        expect((uno['soglie'] as Map)['cibo'], 35);
        expect((uno['soglie'] as Map)['lettiera'], 80);
        expect((uno['soglie'] as Map)['giorni'], 7);
        expect(uno['dispositivi'], [
          {
            'id': 'd1',
            'nome': 'Feeder',
            'integrazione': 'petkit',
            'integrazione_nome': '',
            'marca': 'PetKit',
            'modello': '',
          },
        ]);
      },
    );

    test('la sabbia finita nel cassetto torna al posto suo', () {
      final uno = normalizzaAnimale({
        'lettiera_riempimento': 'sensor.petkit_litter_level',
      });
      expect(uno['lettiera_sabbia'], 'sensor.petkit_litter_level');
      expect(uno['lettiera_riempimento'], '');
      final cassetto = normalizzaAnimale({
        'lettiera_riempimento': 'sensor.litter_robot_waste_drawer',
      });
      expect(
        cassetto['lettiera_riempimento'],
        'sensor.litter_robot_waste_drawer',
      );
      expect(cassetto['lettiera_sabbia'], '');
    });

    test('niente doppioni di identificativo, e non piu\' di dodici', () {
      final tanti = normalizzaAnimali([
        for (var i = 0; i < 15; i += 1) {'id': 'gatto', 'nome': 'G$i'},
      ]);
      expect(tanti, hasLength(massimoAnimali));
      expect(tanti.map((uno) => uno['id']).toSet(), hasLength(massimoAnimali));
      expect(tanti[1]['id'], 'gatto-2');
    });

    test('una riga vuota non si salva, un nome solo si', () {
      expect(animaleConQualcosa(normalizzaAnimale(const {})), isFalse);
      expect(animaleConQualcosa(normalizzaAnimale({'nome': 'Micio'})), isTrue);
      expect(
        animaleConQualcosa(normalizzaAnimale({'cibo_eroga': 'button.x'})),
        isTrue,
      );
    });
  });

  group('il legame', () {
    test('specie dal nome', () {
      expect(specieDalNome('PetKit Feeder cat'), 'gatto');
      expect(specieDalNome('Tractive dog collar'), 'cane');
      expect(specieDalNome('Distributore'), 'altro');
      expect(specieDalNome('litter_robot_4'), 'gatto');
    });

    test(
      'un PetKit finisce nelle caselle giuste, una entita\' per casella',
      () {
        final entita = [
          _e('sensor.petkit_food_level', nome: 'Food level', categoria: ''),
          _e('sensor.petkit_food_level_warning', nome: 'Food level warning'),
          _e(
            'sensor.petkit_last_feed',
            nome: 'Last feed',
            traduzione: 'last_feed',
          ),
          _e('sensor.petkit_portions_today', nome: 'Portions dispensed today'),
          _e('sensor.petkit_desiccant_days', nome: 'Desiccant remaining days'),
          _e('button.petkit_manual_feed', nome: 'Manual feed'),
          /* Un tasto marcato configurazione resta un tasto. */
          _e(
            'button.petkit_reset_desiccant',
            nome: 'Reset desiccant',
            categoria: 'config',
          ),
          /* Un sensore di configurazione non riempie una casella. */
          _e(
            'sensor.petkit_food_level_cfg',
            nome: 'Food level',
            categoria: 'diagnostic',
          ),
          _e('sensor.petkit_spenta', nome: 'Food level', spenta: true),
        ];
        final proposta = proponiLeCaselleDellAnimale(
          entita,
          stato: (_) => null,
        );
        expect(proposta['cibo_livello'], 'sensor.petkit_food_level');
        expect(proposta['cibo_ultima'], 'sensor.petkit_last_feed');
        expect(proposta['cibo_porzioni'], 'sensor.petkit_portions_today');
        expect(proposta['cibo_essiccante'], 'sensor.petkit_desiccant_days');
        expect(proposta['cibo_eroga'], 'button.petkit_manual_feed');
        expect(
          proposta['cibo_essiccante_reset'],
          'button.petkit_reset_desiccant',
        );
        expect(proposta.containsKey('lettiera_sabbia'), isFalse);
      },
    );

    test('la sabbia e il cassetto non finiscono nella stessa casella', () {
      final entita = [
        _e(
          'sensor.litter_robot_waste_drawer_level',
          nome: 'Waste drawer level',
        ),
        _e('sensor.petkit_litter_level', nome: 'Litter level'),
        _e('sensor.litter_robot_last_seen', nome: 'Last clean cycle'),
        _e('binary_sensor.petkit_waste_bin', nome: 'Waste bin full'),
      ];
      final proposta = proponiLeCaselleDellAnimale(entita, stato: (_) => null);
      expect(proposta['lettiera_sabbia'], 'sensor.petkit_litter_level');
      expect(
        proposta['lettiera_riempimento'],
        'sensor.litter_robot_waste_drawer_level',
      );
      expect(proposta['lettiera_ultima'], 'sensor.litter_robot_last_seen');
      expect(proposta['lettiera_cestino'], 'binary_sensor.petkit_waste_bin');
    });

    test('la classe si legge anche dallo stato di casa', () {
      final entita = [_e('sensor.tractive_batteria', nome: 'Batteria')];
      final conClasse = proponiLeCaselleDellAnimale(
        entita,
        stato: (id) => Entita(
          id: id,
          stato: '80',
          attributi: const {'device_class': 'battery'},
        ),
      );
      expect(conClasse['collare_batteria'], 'sensor.tractive_batteria');
      final senza = proponiLeCaselleDellAnimale(entita, stato: (_) => null);
      expect(senza.containsKey('collare_batteria'), isFalse);
    });

    test('collegare riempie solo le caselle vuote e si somma al dispositivo di prima', () {
      final prima = normalizzaAnimale({
        'nome': 'Micio',
        'cibo_livello': 'sensor.mio',
        'dispositivi': [
          {'id': 'd-lettiera', 'nome': 'Lettiera'},
        ],
      });
      final andata = collegaAnimaleAlDispositivo(
        dispositivo: _petkit,
        entita: [
          _e('sensor.petkit_food_level', nome: 'Food level'),
          _e('button.petkit_manual_feed', nome: 'Manual feed'),
        ],
        stato: (_) => null,
        nomeDellIntegrazione: 'PetKit',
        precedente: prima,
      );
      expect(andata.riempite, ['cibo_eroga']);
      expect(andata.animale['cibo_livello'], 'sensor.mio');
      expect(andata.animale['nome'], 'Micio');
      expect(andata.animale['specie'], 'gatto');
      expect((andata.animale['dispositivi'] as List).map((d) => d['id']), [
        'd-lettiera',
        'd-petkit',
      ]);
      expect(
        (andata.animale['dispositivi'] as List).last['integrazione_nome'],
        'PetKit',
      );
    });

    test('un animale nuovo prende il nome dal dispositivo', () {
      final andata = collegaAnimaleAlDispositivo(
        dispositivo: _petkit,
        entita: [_e('sensor.petkit_food_level', nome: 'Food level')],
        stato: (_) => null,
        indice: 3,
      );
      expect(andata.animale['id'], 'animale-4');
      expect(andata.animale['nome'], 'Distributore Micio');
      expect(andata.riempite, ['cibo_livello']);
    });

    test('come si preme un tasto lo dice il dominio', () {
      expect(pressioneDellAzione('button.x'), ('button', 'press'));
      expect(pressioneDellAzione('script.x'), ('script', 'turn_on'));
      expect(pressioneDellAzione('sensor.x'), isNull);
      expect(pressioneDellAzione('niente'), isNull);
    });
  });
}
