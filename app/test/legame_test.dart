/// Le prove del motore che indovina.
///
/// La lavatrice qui sotto e' quella vera di chi ha chiesto la funzione: una
/// Hoover con l'integrazione hOn, che espone venticinque entita' — dieci delle
/// quali sono interruttori, e uno solo accende la macchina. E' il caso in cui
/// una lista di parole inglesi non basta, perche' su un Home Assistant in
/// italiano gli interruttori si chiamano «Pausa» e «Prelavaggio».
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/catalogo/catalogo.dart';
import 'package:gdahome/casa/entita.dart';
import 'package:gdahome/casa/plancia/apparecchio.dart';
import 'package:gdahome/casa/plancia/legame.dart';

EntitaDelDispositivo _una(
  String id, {
  String nome = '',
  String traduzione = '',
  String classe = '',
  String unita = '',
  String classeDiStato = '',
  String categoria = '',
  bool spenta = false,
}) => EntitaDelDispositivo(
  id: id,
  nome: nome,
  classe: classe,
  unita: unita,
  categoria: categoria,
  spenta: spenta,
  chiaveDiTraduzione: traduzione,
  classeDiStato: classeDiStato,
);

/// La lavatrice di hOn, com'e' davvero: nomi in italiano, chiavi di traduzione
/// in inglese, e dieci interruttori.
final _lavatrice = <EntitaDelDispositivo>[
  _una(
    'sensor.lavatrice_potenza',
    nome: 'Potenza',
    traduzione: 'power',
    classe: 'power',
    unita: 'W',
  ),
  _una(
    'sensor.lavatrice_tensione',
    nome: 'Tensione',
    traduzione: 'voltage',
    classe: 'voltage',
    unita: 'V',
  ),
  _una(
    'sensor.lavatrice_energia_totale',
    nome: 'Energia totale',
    traduzione: 'total_energy',
    classe: 'energy',
    unita: 'kWh',
    classeDiStato: 'total_increasing',
  ),
  _una(
    'sensor.lavatrice_energia_oggi',
    nome: 'Energia oggi',
    traduzione: 'energy_today',
    classe: 'energy',
    unita: 'kWh',
    classeDiStato: 'total_increasing',
  ),
  _una(
    'sensor.lavatrice_energia_ciclo',
    nome: 'Energia del ciclo',
    traduzione: 'cycle_energy',
    classe: 'energy',
    unita: 'kWh',
  ),
  _una(
    'sensor.lavatrice_tempo_rimanente',
    nome: 'Tempo rimanente',
    traduzione: 'remaining_time',
    unita: 'min',
  ),
  _una(
    'sensor.lavatrice_avvio_ritardato',
    nome: 'Avvio ritardato',
    traduzione: 'delay_time',
    unita: 'min',
  ),
  _una(
    'sensor.lavatrice_fase',
    nome: 'Fase del programma',
    traduzione: 'program_phase',
  ),
  _una(
    'sensor.lavatrice_durata',
    nome: 'Durata del programma',
    traduzione: 'program_duration',
    unita: 'min',
  ),
  _una(
    'binary_sensor.lavatrice_problema',
    nome: 'Problema',
    traduzione: 'error',
    classe: 'problem',
  ),
  _una('switch.lavatrice', nome: 'Lavatrice', traduzione: 'machine'),
  _una('switch.lavatrice_pausa', nome: 'Pausa', traduzione: 'pause'),
  _una(
    'switch.lavatrice_prelavaggio',
    nome: 'Prelavaggio',
    traduzione: 'prewash',
  ),
  _una(
    'switch.lavatrice_risciacquo_extra',
    nome: 'Risciacquo in piu\'',
    traduzione: 'extra_rinse',
  ),
  _una('switch.lavatrice_vapore', nome: 'Vapore', traduzione: 'steam'),
  _una(
    'sensor.lavatrice_wifi',
    nome: 'Potenza del segnale',
    traduzione: 'rssi',
    classe: 'signal_strength',
    unita: 'dBm',
    categoria: 'diagnostic',
  ),
];

const _hon = Integrazione(
  dominio: 'hon',
  nome: 'hOn',
  quantiDispositivi: 2,
  diQualcunAltro: true,
);

const _dispositivo = Dispositivo(
  id: 'dev-lavatrice',
  nome: 'Lavatrice',
  marca: 'Hoover',
  modello: 'HW-2431',
  integrazione: 'hon',
  stanza: 'Bagno',
  quanteEntita: 16,
  spento: false,
);

Apparecchio _vuoto() => Apparecchio.nuovo(Sezione.elettrodomestici);

Apparecchio _unaStanza(String id, String nome) => Apparecchio.da({
  'id': id,
  'name': nome,
}, sezione: Sezione.stanze);

void main() {
  group('Le caselle proposte', () {
    test('la lavatrice di hOn riempie le caselle giuste', () {
      final proposta = proponiLeCaselle(
        [for (final una in _lavatrice) DaLeggere.dalCatalogo(una)],
        nomeDelDispositivo: 'Lavatrice',
      );

      expect(proposta['power_entity'], 'sensor.lavatrice_potenza');
      expect(proposta['daily_energy_entity'], 'sensor.lavatrice_energia_oggi');
      expect(proposta['last_energy_entity'], 'sensor.lavatrice_energia_ciclo');
      expect(
        proposta['total_energy_entity'],
        'sensor.lavatrice_energia_totale',
      );
      expect(proposta['remaining_entity'], 'sensor.lavatrice_tempo_rimanente');
      expect(proposta['cycle_duration_entity'], 'sensor.lavatrice_durata');
      expect(proposta['state_entity'], 'sensor.lavatrice_fase');
      expect(proposta['alert_entity'], 'binary_sensor.lavatrice_problema');
    });

    test('fra dieci interruttori sceglie quello che accende la macchina', () {
      /* Il tasto giusto e' quello che porta il nome del dispositivo. E'
       * l'unico segnale che non parla una lingua sola: «Pausa» e «Vapore»
       * hanno un nome loro, la macchina no. */
      final proposta = proponiLeCaselle(
        [for (final una in _lavatrice) DaLeggere.dalCatalogo(una)],
        nomeDelDispositivo: 'Lavatrice',
      );
      expect(proposta['control_entity'], 'switch.lavatrice');
    });

    test('il tempo rimanente non e\' l\'avvio ritardato', () {
      /* Si somigliano — tutti e due in minuti, tutti e due «tempo» — e sono
       * la cosa piu' facile da scambiare. Chi guarda la tessera vedrebbe un
       * conto alla rovescia che non finisce mai. */
      final proposta = proponiLeCaselle(
        [for (final una in _lavatrice) DaLeggere.dalCatalogo(una)],
        nomeDelDispositivo: 'Lavatrice',
      );
      expect(
        proposta.values,
        isNot(contains('sensor.lavatrice_avvio_ritardato')),
      );
    });

    test('la tensione non passa per potenza, e il wifi non passa mai', () {
      final proposta = proponiLeCaselle(
        [for (final una in _lavatrice) DaLeggere.dalCatalogo(una)],
        nomeDelDispositivo: 'Lavatrice',
      );
      expect(proposta.values, isNot(contains('sensor.lavatrice_tensione')));
      expect(proposta.values, isNot(contains('sensor.lavatrice_wifi')));
    });

    test('un\'entita\' sola non fa due caselle', () {
      final proposta = proponiLeCaselle(
        [for (final una in _lavatrice) DaLeggere.dalCatalogo(una)],
        nomeDelDispositivo: 'Lavatrice',
      );
      expect(proposta.values.toSet().length, proposta.values.length);
    });

    test('le entita\' spente non si propongono', () {
      final proposta = proponiLeCaselle([
        DaLeggere.dalCatalogo(
          _una(
            'sensor.spenta_potenza',
            nome: 'Potenza',
            classe: 'power',
            unita: 'W',
            spenta: true,
          ),
        ),
      ]);
      expect(proposta, isEmpty);
    });

    test('le temperature solo per chi tiene il freddo', () {
      final entita = [
        DaLeggere.dalCatalogo(
          _una(
            'sensor.frigo_temperatura',
            nome: 'Temperatura frigo',
            classe: 'temperature',
            unita: '°C',
          ),
        ),
        DaLeggere.dalCatalogo(
          _una(
            'sensor.frigo_congelatore',
            nome: 'Temperatura congelatore',
            classe: 'temperature',
            unita: '°C',
          ),
        ),
      ];
      final freddo = proponiLeCaselle(entita, tipo: 'frigo');
      expect(freddo['temperature_entity'], 'sensor.frigo_temperatura');
      expect(freddo['temperature_entity_2'], 'sensor.frigo_congelatore');

      /* Su una lavatrice la «temperatura» e' quella del programma, e una barra
       * al posto dei watt non racconterebbe niente. */
      final caldo = proponiLeCaselle(entita, tipo: 'lavatrice');
      expect(caldo.containsKey('temperature_entity'), isFalse);
    });

    test('l\'energia di oggi non diventa il totale', () {
      final proposta = proponiLeCaselle([
        DaLeggere.dalCatalogo(
          _una(
            'sensor.forno_energia_oggi',
            nome: 'Energia oggi',
            classe: 'energy',
            unita: 'kWh',
            classeDiStato: 'total_increasing',
          ),
        ),
      ]);
      expect(proposta['daily_energy_entity'], 'sensor.forno_energia_oggi');
      expect(proposta.containsKey('total_energy_entity'), isFalse);
    });
  });

  group('Che apparecchio e\'', () {
    test('dal nome e dal modello', () {
      expect(indovinaIlTipo(nome: 'Lavatrice', marca: 'Hoover'), 'lavatrice');
      expect(indovinaIlTipo(nome: 'Dishwasher'), 'lavastoviglie');
      expect(indovinaIlTipo(nome: 'Frigorifero Samsung'), 'frigo');
      /* La lavasciuga e' una lavatrice, non un'asciugatrice: la prima regola
       * che la prende deve essere quella, e per questo sta prima. */
      expect(indovinaIlTipo(nome: 'Lavasciuga'), 'lavatrice');
    });

    test('dalle entita\', quando il nome non dice niente', () {
      expect(
        indovinaIlTipo(
          nome: 'HW-2431',
          entita: [
            DaLeggere.dalCatalogo(
              _una('sensor.x_spin_speed', nome: 'Spin speed'),
            ),
          ],
        ),
        'lavatrice',
      );
    });

    test('quello che non si sa e\' «generico»', () {
      expect(indovinaIlTipo(nome: 'Coso 4000'), 'generico');
    });
  });

  group('La stanza', () {
    test('l\'area di Home Assistant diventa la stanza che si chiama uguale', () {
      final stanze = [_unaStanza('rooms-1', 'Bagno'), _unaStanza('rooms-2', 'Cucina')];
      expect(stanzaPerArea('Bagno', stanze), 'rooms-1');
      expect(stanzaPerArea('bagno', stanze), 'rooms-1');
      expect(stanzaPerArea('Garage', stanze), '');
      expect(stanzaPerArea('', stanze), '');
    });
  });

  group('Il legame', () {
    test('collegare riempie tipo, stanza, nome e caselle', () {
      final quale = _vuoto();
      final stanze = [_unaStanza('rooms-1', 'Bagno')];
      final andata = collegaAlDispositivo(
        quale,
        dispositivo: _dispositivo,
        entita: _lavatrice,
        integrazione: _hon,
        stanze: stanze,
      );

      expect(quale.nome, 'Lavatrice');
      expect(quale.dentro['visual_key'], 'lavatrice');
      expect(quale.dentro['device_type'], 'lavatrice');
      expect(quale.dentro['visual_type'], 'asset');
      expect(quale.idDellaStanza, 'rooms-1');
      expect(quale.stanza, 'Bagno');
      expect(quale.dentro['power_entity'], 'sensor.lavatrice_potenza');
      expect(quale.dentro['control_entity'], 'switch.lavatrice');
      expect(andata.riempite, contains('remaining_entity'));
      expect(andata.tenute, isEmpty);
    });

    test('quello che si e\' scritto a mano non si tocca', () {
      final quale = _vuoto()
        ..metti('control_entity', 'switch.la_mia')
        ..metti('name', 'La lavatrice di casa');
      final andata = collegaAlDispositivo(
        quale,
        dispositivo: _dispositivo,
        entita: _lavatrice,
        integrazione: _hon,
      );
      expect(quale.dentro['control_entity'], 'switch.la_mia');
      expect(quale.nome, 'La lavatrice di casa');
      expect(andata.tenute, contains('control_entity'));
      expect(andata.riempite, isNot(contains('control_entity')));
    });

    test('lo storico e il report seguono il contatore totale', () {
      final quale = _vuoto();
      collegaAlDispositivo(
        quale,
        dispositivo: _dispositivo,
        entita: _lavatrice,
        integrazione: _hon,
      );
      expect(
        quale.dentro['history_entity'],
        'sensor.lavatrice_energia_totale',
      );
      expect(quale.dentro['report_entity'], 'sensor.lavatrice_energia_totale');
      expect(quale.dentro['energy_entity'], 'sensor.lavatrice_energia_totale');
    });

    test('l\'elenco piatto porta anche le caselle che il modello non conta', () {
      /* `entities` si ricava dalle otto caselle che il modello dichiara, e le
       * caselle di un dispositivo sono tredici: senza scriverlo a mano, il
       * tempo rimanente e la fase sparirebbero dall'elenco che la plancia
       * legge quando non guarda i campi. */
      final quale = _vuoto();
      collegaAlDispositivo(
        quale,
        dispositivo: _dispositivo,
        entita: _lavatrice,
        integrazione: _hon,
      );
      final elenco = (quale.dentro['entities'] as List).cast<String>();
      expect(elenco, contains('sensor.lavatrice_tempo_rimanente'));
      expect(elenco, contains('sensor.lavatrice_fase'));
      expect(elenco, contains('switch.lavatrice'));
    });

    test('si segna da dove viene, e le entita\' accese', () {
      final quale = _vuoto();
      collegaAlDispositivo(
        quale,
        dispositivo: _dispositivo,
        entita: _lavatrice,
        integrazione: _hon,
      );
      expect(quale.dentro['device_id'], 'dev-lavatrice');
      expect(quale.dentro['integration'], 'hon');
      expect(quale.dentro['integration_name'], 'hOn');
      expect(quale.dentro['device_manufacturer'], 'Hoover');
      expect(quale.dentro['device_model'], 'HW-2431');
      expect(
        (quale.dentro['device_entities'] as List).length,
        _lavatrice.length,
      );
      expect(eCollegato(quale), isTrue);
    });

    test('nessuna casella sparisce quando la plancia rilegge', () {
      final quale = _vuoto();
      collegaAlDispositivo(
        quale,
        dispositivo: _dispositivo,
        entita: _lavatrice,
        integrazione: _hon,
      );
      expect(quale.campiCheSparirebbero, isEmpty);
    });

    test('scollegare toglie il legame e lascia le caselle', () {
      final quale = _vuoto();
      collegaAlDispositivo(
        quale,
        dispositivo: _dispositivo,
        entita: _lavatrice,
        integrazione: _hon,
      );
      scollega(quale);
      expect(quale.dentro['device_id'], isNull);
      expect(quale.dentro['integration'], isNull);
      expect(quale.dentro['device_entities'], isNull);
      /* Le caselle restano: chi scollega vuole smettere di seguire il
       * dispositivo, non buttare via quello che ha configurato. */
      expect(quale.dentro['power_entity'], 'sensor.lavatrice_potenza');
      expect(eCollegato(quale), isFalse);
    });

    test('l\'etichetta dice integrazione, marca, modello e quante entita\'', () {
      final quale = _vuoto();
      collegaAlDispositivo(
        quale,
        dispositivo: _dispositivo,
        entita: _lavatrice,
        integrazione: _hon,
      );
      expect(
        etichettaDelLegame(quale),
        'hOn · Hoover HW-2431 · ${_lavatrice.length} entita\'',
      );
    });
  });

  group('L\'entita\' principale', () {
    test('si prende la prima del dominio che la sezione vuole', () {
      final quale = Apparecchio.nuovo(Sezione.luci);
      mettiLEntitaPrincipale(
        quale,
        [
          _una('sensor.lampada_potenza', nome: 'Potenza'),
          _una('light.lampada', nome: 'Lampada'),
          _una('switch.lampada_notte', nome: 'Notturna'),
        ],
        domini: const ['light'],
      );
      expect(quale.entita, 'light.lampada');
    });

    test('non scavalca quella che c\'e\' gia\'', () {
      final quale = Apparecchio.nuovo(Sezione.luci)
        ..metti('entity', 'light.la_mia');
      mettiLEntitaPrincipale(quale, [
        _una('light.lampada', nome: 'Lampada'),
      ], domini: const ['light']);
      expect(quale.entita, 'light.la_mia');
    });

    test('le spente non si prendono', () {
      final quale = Apparecchio.nuovo(Sezione.luci);
      mettiLEntitaPrincipale(quale, [
        _una('light.spenta', nome: 'Spenta', spenta: true),
        _una('light.viva', nome: 'Viva'),
      ], domini: const ['light']);
      expect(quale.entita, 'light.viva');
    });

    test('senza domini si prende la prima, e con domini sbagliati niente', () {
      final senza = Apparecchio.nuovo(Sezione.elettrodomestici);
      mettiLEntitaPrincipale(senza, [_una('sensor.qualcosa', nome: 'Qualcosa')]);
      expect(senza.entita, 'sensor.qualcosa');

      final storto = Apparecchio.nuovo(Sezione.luci);
      mettiLEntitaPrincipale(storto, [
        _una('sensor.qualcosa', nome: 'Qualcosa'),
      ], domini: const ['light']);
      expect(storto.entita, '');
    });
  });

  group('I parenti che stanno fuori', () {
    List<Entita> casaFinta() => [
      Entita(
        id: 'sensor.energia_oggi_lavatrice',
        stato: '0.8',
        attributi: const {
          'friendly_name': 'Energia oggi lavatrice',
          'unit_of_measurement': 'kWh',
          'device_class': 'energy',
          'state_class': 'total_increasing',
        },
      ),
      Entita(
        id: 'sensor.presa_lavatrice_potenza',
        stato: '1200',
        attributi: const {
          'friendly_name': 'Lavatrice potenza',
          'unit_of_measurement': 'W',
          'device_class': 'power',
        },
      ),
      Entita(
        id: 'sensor.energia_oggi_forno',
        stato: '1.4',
        attributi: const {
          'friendly_name': 'Energia oggi forno',
          'unit_of_measurement': 'kWh',
          'device_class': 'energy',
        },
      ),
      Entita(
        id: 'switch.lavatrice_del_vicino',
        stato: 'off',
        attributi: const {'friendly_name': 'Lavatrice del vicino'},
      ),
    ];

    test('trovano potenza ed energia che stanno su un altro dispositivo', () {
      final trovati = parentiFuoriDalDispositivo(
        nomeDelDispositivo: 'Lavatrice',
        casa: casaFinta(),
      );
      expect(trovati['power_entity'], 'sensor.presa_lavatrice_potenza');
      expect(
        trovati['daily_energy_entity'],
        'sensor.energia_oggi_lavatrice',
      );
      /* Il forno non c'entra: non porta il nome del dispositivo. */
      expect(trovati.values, isNot(contains('sensor.energia_oggi_forno')));
    });

    test('un interruttore non si pesca mai per nome', () {
      /* Pescare un interruttore per nome vuol dire, prima o poi, accendere
       * l'apparecchio del vicino di scaffale. */
      final trovati = parentiFuoriDalDispositivo(
        nomeDelDispositivo: 'Lavatrice',
        casa: casaFinta(),
      );
      expect(trovati.containsKey('control_entity'), isFalse);
      expect(trovati.values, isNot(contains('switch.lavatrice_del_vicino')));
    });

    test('un nome corto non pesca niente', () {
      /* «tv» dentro un identificativo lo si trova ovunque: `sensor.attivita`,
       * `sensor.tvb`. Sotto le quattro lettere non si cerca. */
      expect(
        parentiFuoriDalDispositivo(nomeDelDispositivo: 'TV', casa: casaFinta()),
        isEmpty,
      );
    });

    test('riempiono solo dove il dispositivo non arriva', () {
      final quale = _vuoto();
      collegaAlDispositivo(
        quale,
        dispositivo: _dispositivo,
        entita: _lavatrice,
        integrazione: _hon,
        fuori: parentiFuoriDalDispositivo(
          nomeDelDispositivo: 'Lavatrice',
          casa: casaFinta(),
        ),
      );
      /* La potenza ce l'ha gia' il dispositivo: quella della presa non entra. */
      expect(quale.dentro['power_entity'], 'sensor.lavatrice_potenza');
    });
  });

  group('Il menu delle integrazioni', () {
    test('un\'integrazione senza dispositivi non e\' una voce di menu', () {
      final catalogo = IlCatalogo(
        integrazioni: const [
          Integrazione(
            dominio: 'zulu',
            nome: 'Zulu',
            quantiDispositivi: 1,
            diQualcunAltro: false,
          ),
          _hon,
          Integrazione(
            dominio: 'vuota',
            nome: 'Vuota',
            quantiDispositivi: 0,
            diQualcunAltro: false,
          ),
        ],
        dispositivi: const [
          _dispositivo,
          Dispositivo(
            id: 'dev-zulu',
            nome: 'Zeta',
            marca: '',
            modello: '',
            integrazione: 'zulu',
            stanza: '',
            quanteEntita: 3,
            spento: false,
          ),
          /* Senza entita' non c'e' niente da mostrare. */
          Dispositivo(
            id: 'dev-nudo',
            nome: 'Nudo',
            marca: '',
            modello: '',
            integrazione: 'vuota',
            stanza: '',
            quanteEntita: 0,
            spento: false,
          ),
        ],
        entita: const {},
      );

      final menu = integrazioniConDispositivi(catalogo);
      expect(menu.map((uno) => uno.$1.dominio).toList(), ['hon', 'zulu']);
      expect(menu.first.$2.single.id, 'dev-lavatrice');
    });
  });
}
