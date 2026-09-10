/// Le prove del legame dell'auto e della colonnina, il porto di
/// `core/auto-device-binding.js` e `core/wallbox-device-binding.js`.
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/entita.dart';
import 'package:gdahome/casa/plancia/legame.dart' show DaLeggere;
import 'package:gdahome/casa/plancia/legame_auto.dart';

DaLeggere _una(
  String id, {
  String nome = '',
  String classe = '',
  String unita = '',
  String categoria = '',
  bool spenta = false,
}) => DaLeggere(
  id: id,
  nome: nome,
  classe: classe,
  unita: unita,
  categoria: categoria,
  spenta: spenta,
);

/// Un'auto coreana com'e' davvero: venti entita', i nomi in inglese.
final _ev6 = <DaLeggere>[
  _una('device_tracker.ev6_location', nome: 'Location'),
  _una('sensor.ev6_12v_battery', nome: '12V Battery', unita: '%'),
  _una(
    'sensor.ev6_ev_battery_level',
    nome: 'EV Battery Level',
    classe: 'battery',
    unita: '%',
  ),
  _una('sensor.ev6_target_soc', nome: 'Target SoC', unita: '%'),
  _una(
    'sensor.ev6_ev_range',
    nome: 'EV Range',
    classe: 'distance',
    unita: 'km',
  ),
  _una(
    'sensor.ev6_odometer',
    nome: 'Odometer',
    classe: 'distance',
    unita: 'km',
  ),
  _una('sensor.ev6_trip_distance', nome: 'Trip Distance', unita: 'km'),
  _una('binary_sensor.ev6_charger_connected', nome: 'Charger Connected'),
  _una('binary_sensor.ev6_ev_battery_charge', nome: 'EV Battery Charge'),
  _una('binary_sensor.ev6_charging', nome: 'Charging'),
  _una(
    'sensor.ev6_charging_power',
    nome: 'Charging Power',
    classe: 'power',
    unita: 'kW',
  ),
  _una('lock.ev6_door_lock', nome: 'Door Lock'),
  _una(
    'binary_sensor.ev6_front_left_door',
    nome: 'Front Left Door',
    classe: 'door',
  ),
  _una(
    'binary_sensor.ev6_front_left_window',
    nome: 'Front Left Window',
    classe: 'window',
  ),
  _una('binary_sensor.ev6_trunk', nome: 'Trunk', classe: 'opening'),
  _una('binary_sensor.ev6_hood', nome: 'Hood', classe: 'opening'),
  _una('binary_sensor.ev6_engine', nome: 'Engine'),
  _una(
    'sensor.ev6_tire_pressure_front_left',
    nome: 'Tire Pressure Front Left',
    unita: 'psi',
  ),
  _una(
    'sensor.ev6_tire_pressure_rear_right',
    nome: 'Tire Pressure Rear Right',
    unita: 'psi',
  ),
  _una('sensor.ev6_tire_pressure_all', nome: 'Tire Pressure All', unita: 'psi'),
  /* Le impostazioni non sono l'auto. */
  _una(
    'number.ev6_ac_charging_limit',
    nome: 'AC Charging Limit',
    unita: '%',
    categoria: 'config',
  ),
  _una('switch.ev6_disabled', nome: 'Disabled', spenta: true),
];

void main() {
  group('l\'auto da un dispositivo', () {
    test('la EV6 riempie le caselle giuste, ognuna una volta sola', () {
      final legame = legaLAutoAlDispositivo(_ev6);
      final mappa = legame.mappa;
      expect(mappa['dm.ev_posizione'], 'device_tracker.ev6_location');
      /* Prima la batteria di servizio, o la sua percentuale si prenderebbe
       * il posto di quella di trazione. */
      expect(mappa['dm.ev_batteria_servizio'], 'sensor.ev6_12v_battery');
      expect(mappa['dm.ev_batteria_auto'], 'sensor.ev6_ev_battery_level');
      expect(mappa['dm.ev_autonomia'], 'sensor.ev6_ev_range');
      expect(mappa['dm.ev_odometro'], 'sensor.ev6_odometer');
      expect(mappa['dm.ev_ultimo_viaggio'], 'sensor.ev6_trip_distance');
      /* Il cavo prima dello stato: «Charger Connected» e' il cavo, non la
       * carica, e chi arriva primo si porta via l'entita'. */
      expect(
        mappa['dm.ev_cavo_collegato'],
        'binary_sensor.ev6_charger_connected',
      );
      /* «Charging» vince su «EV Battery Charge»: e' il nome che uno
       * riconosce sulla card. */
      expect(mappa['dm.ev_stato_ricarica'], 'binary_sensor.ev6_charging');
      expect(mappa['dm.ev_potenza_ricarica'], 'sensor.ev6_charging_power');
      /* «Target SoC» parla di SoC ma e' il traguardo, non la batteria. */
      expect(mappa['dm.ev_target_soc'], 'sensor.ev6_target_soc');
      expect(mappa['dm.ev_portiere'], 'lock.ev6_door_lock');
      expect(mappa['dm.ev_finestrini'], 'binary_sensor.ev6_front_left_window');
      expect(mappa['dm.ev_bagagliaio'], 'binary_sensor.ev6_trunk');
      expect(mappa['dm.ev_cofano'], 'binary_sensor.ev6_hood');
      expect(mappa['dm.ev_motore'], 'binary_sensor.ev6_engine');
      expect(
        mappa['dm.ev_pneumatico_ant_sx'],
        'sensor.ev6_tire_pressure_front_left',
      );
      expect(
        mappa['dm.ev_pneumatico_post_dx'],
        'sensor.ev6_tire_pressure_rear_right',
      );
      expect(mappa['dm.ev_pneumatici'], 'sensor.ev6_tire_pressure_all');
      /* Un'impostazione e un'entita' spenta non entrano. */
      expect(mappa.values, isNot(contains('number.ev6_ac_charging_limit')));
      expect(mappa.values, isNot(contains('switch.ev6_disabled')));
      /* Ogni entita' una volta sola. */
      expect(mappa.values.toSet().length, mappa.length);
      /* Senza serbatoio e' elettrica: si tace. */
      expect(legame.tipo, '');
    });

    test('il serbatoio dice benzina, col la batteria dice ibrida', () {
      final termica = legaLAutoAlDispositivo([
        _una('sensor.golf_fuel_level', nome: 'Fuel Level', unita: '%'),
        _una('sensor.golf_range', nome: 'Range', unita: 'km'),
      ]);
      expect(termica.mappa['dm.ev_carburante'], 'sensor.golf_fuel_level');
      expect(termica.tipo, 'termica');
      final ibrida = legaLAutoAlDispositivo([
        _una('sensor.rav4_fuel', nome: 'Fuel', unita: '%'),
        _una(
          'sensor.rav4_battery',
          nome: 'Battery',
          classe: 'battery',
          unita: '%',
        ),
      ]);
      expect(ibrida.tipo, 'ibrida');
      expect(motoreDalleCaselle(const {}), '');
      expect(tipoMotore('Ibrida'), 'ibrida');
      expect(tipoMotore('boh'), '');
    });

    test('la batteria di servizio anche in volt (#348)', () {
      final legame = legaLAutoAlDispositivo([
        _una(
          'sensor.id3_12v_battery_voltage',
          nome: '12V Battery Voltage',
          classe: 'voltage',
          unita: 'V',
        ),
        _una(
          'sensor.id3_charger_voltage',
          nome: 'Charger Voltage',
          classe: 'voltage',
          unita: 'V',
        ),
        _una(
          'sensor.id3_battery',
          nome: 'Battery',
          classe: 'battery',
          unita: '%',
        ),
      ]);
      expect(
        legame.mappa['dm.ev_batteria_servizio'],
        'sensor.id3_12v_battery_voltage',
      );
      expect(legame.mappa['dm.ev_batteria_auto'], 'sensor.id3_battery');
    });

    test(
      'il target comandabile vince sul sensore, ma deve parlare di carica',
      () {
        final legame = legaLAutoAlDispositivo([
          _una('sensor.auto_target_soc', nome: 'Target SoC', unita: '%'),
          _una(
            'number.auto_cabin_target_temperature',
            nome: 'Cabin target temperature',
            unita: '°C',
          ),
          _una('number.auto_charge_target', nome: 'Charge target', unita: '%'),
        ]);
        expect(legame.mappa['dm.ev_target_soc'], 'number.auto_charge_target');
      },
    );

    test('la lettera della norma e\' il cavo, letta dallo stato', () {
      final stato = {
        'sensor.auto_vehicle_status': const Entita(
          id: 'sensor.auto_vehicle_status',
          stato: 'B',
          attributi: {},
        ),
      };
      final legame = legaLAutoAlDispositivo([
        _una('sensor.auto_vehicle_status', nome: 'Vehicle status'),
      ], stato: stato);
      expect(
        legame.mappa['dm.ev_cavo_collegato'],
        'sensor.auto_vehicle_status',
      );
      expect(eUnaLettera('C'), isTrue);
      expect(eUnaLettera('on'), isFalse);
    });

    test('quello che il registro non dice lo dice lo stato', () {
      final stato = {
        'sensor.auto_km': const Entita(
          id: 'sensor.auto_km',
          stato: '12000',
          attributi: {
            'friendly_name': 'Contachilometri',
            'unit_of_measurement': 'km',
          },
        ),
      };
      final legame = legaLAutoAlDispositivo([
        _una('sensor.auto_km'),
      ], stato: stato);
      expect(legame.mappa['dm.ev_odometro'], 'sensor.auto_km');
    });
  });

  group('il cavo', () {
    test('vale la parola piu\' forte', () {
      expect(parlaDelCavo('Charger connected'), isTrue);
      expect(parlaDelCavo('Plug'), isTrue);
      expect(parlaDelCavo('Cable charging'), isFalse);
      expect(parlaDelCavo('Plugged and charging'), isTrue);
      expect(parlaDelCavo('Battery level'), isFalse);
    });
  });

  group('la colonnina da un dispositivo', () {
    final goe = <DaLeggere>[
      _una(
        'sensor.goe_power',
        nome: 'go-e Charger Power',
        classe: 'power',
        unita: 'W',
      ),
      _una(
        'sensor.goe_energy_total',
        nome: 'Total energy',
        classe: 'energy',
        unita: 'kWh',
      ),
      _una(
        'sensor.goe_session_energy',
        nome: 'Session energy',
        classe: 'energy',
        unita: 'kWh',
      ),
      _una(
        'sensor.goe_energy_today',
        nome: 'Energy today',
        classe: 'energy',
        unita: 'kWh',
      ),
      _una(
        'sensor.goe_energy_month',
        nome: 'Energy this month',
        classe: 'energy',
        unita: 'kWh',
      ),
      _una(
        'sensor.goe_voltage_l1',
        nome: 'Voltage L1',
        classe: 'voltage',
        unita: 'V',
      ),
      _una(
        'sensor.goe_temperature',
        nome: 'Temperature',
        classe: 'temperature',
        unita: '°C',
      ),
      _una('binary_sensor.goe_car_connected', nome: 'Car connected'),
      /* Due tendine che non parlano della modalita' di ricarica: il blocco
       * del cavo e la scelta delle fasi. */
      _una('select.goe_cable_lock', nome: 'Cable lock'),
      _una('select.goe_phase_switch', nome: 'Phase switch'),
    ];

    test('la go-e riempie le sue otto caselle e non e\' evcc', () {
      final legame = legaLaWallboxAlDispositivo(goe);
      final mappa = legame.mappa;
      expect(mappa['dm.ev_potenza_wallbox'], 'sensor.goe_power');
      expect(mappa['dm.ev_energia_sessione'], 'sensor.goe_session_energy');
      expect(mappa['dm.ev_energia_wallbox_oggi'], 'sensor.goe_energy_today');
      expect(mappa['dm.ev_energia_wallbox_mese'], 'sensor.goe_energy_month');
      expect(mappa['dm.ev_tensione_wallbox'], 'sensor.goe_voltage_l1');
      expect(mappa['dm.ev_temperatura_wallbox'], 'sensor.goe_temperature');
      expect(mappa['dm.ev_cavo_collegato'], 'binary_sensor.goe_car_connected');
      /* Non la PRIMA tendina qualunque: una tendina che non dice di essere
       * la modalita' non lo e'. */
      expect(mappa.containsKey('dm.ev_modalita_ricarica_evcc'), isFalse);
      expect(legame.evcc, isFalse);
      expect(mappa.values.toSet().length, mappa.length);
    });

    test(
      'evcc porta la modalita\', il limite comandabile e la quota di sole',
      () {
        final legame = legaLaWallboxAlDispositivo([
          _una('select.evcc_garage_mode', nome: 'Garage charge mode'),
          _una(
            'number.evcc_garage_limit_soc',
            nome: 'Garage limit SoC',
            unita: '%',
            categoria: 'config',
          ),
          _una(
            'sensor.evcc_garage_effective_limit_soc',
            nome: 'Garage effective limit SoC',
            unita: '%',
          ),
          _una(
            'sensor.evcc_garage_solar_percentage',
            nome: 'Garage solar percentage',
            unita: '%',
          ),
          _una(
            'sensor.evcc_garage_charge_power',
            nome: 'Garage charge power',
            classe: 'power',
            unita: 'W',
          ),
          _una(
            'sensor.evcc_garage_charged_energy',
            nome: 'Garage charged energy',
            classe: 'energy',
            unita: 'kWh',
          ),
        ]);
        final mappa = legame.mappa;
        expect(
          mappa['dm.ev_modalita_ricarica_evcc'],
          'select.evcc_garage_mode',
        );
        expect(mappa['dm.ev_target_soc'], 'number.evcc_garage_limit_soc');
        expect(
          mappa['dm.ev_percentuale_solare_sessione'],
          'sensor.evcc_garage_solar_percentage',
        );
        expect(
          mappa['dm.ev_potenza_wallbox'],
          'sensor.evcc_garage_charge_power',
        );
        expect(
          mappa['dm.ev_energia_sessione'],
          'sensor.evcc_garage_charged_energy',
        );
        expect(legame.evcc, isTrue);
      },
    );

    test('il secondo dispositivo si aggiunge al primo, e un comando scalza una lettura', () {
      final messa = mettiLaColonninaNelleSostituzioni(
        {
          'dm.ev_potenza_wallbox': 'sensor.goe_power',
          'dm.ev_target_soc': 'sensor.ev6_target_soc',
          'dm.ev_cavo_collegato': 'binary_sensor.goe_car_connected',
          'dm.energy_potenza_casa': 'sensor.casa',
        },
        {
          'dm.ev_potenza_wallbox': 'sensor.evcc_charge_power',
          'dm.ev_target_soc': 'number.evcc_limit_soc',
          'dm.ev_modalita_ricarica_evcc': 'select.evcc_mode',
          'dm.ev_cavo_collegato': 'binary_sensor.evcc_connected',
        },
        sue: {
          'sensor.evcc_charge_power',
          'number.evcc_limit_soc',
          'select.evcc_mode',
          'binary_sensor.evcc_connected',
        },
      );
      expect(messa.tenute, ['dm.ev_potenza_wallbox', 'dm.ev_cavo_collegato']);
      expect(messa.prossime['dm.ev_potenza_wallbox'], 'sensor.goe_power');
      expect(messa.prossime['dm.ev_target_soc'], 'number.evcc_limit_soc');
      expect(
        messa.prossime['dm.ev_modalita_ricarica_evcc'],
        'select.evcc_mode',
      );
      expect(messa.prossime['dm.energy_potenza_casa'], 'sensor.casa');
      /* Una casella DI QUESTO dispositivo si riscrive. */
      final rifatta = mettiLaColonninaNelleSostituzioni(
        {'dm.ev_potenza_wallbox': 'sensor.goe_power_old'},
        {'dm.ev_potenza_wallbox': 'sensor.goe_power'},
        sue: {'sensor.goe_power_old', 'sensor.goe_power'},
      );
      expect(rifatta.tenute, isEmpty);
      expect(rifatta.prossime['dm.ev_potenza_wallbox'], 'sensor.goe_power');
    });

    test('mettere in uso un\'auto non porta via la colonnina', () {
      final prossime = versaLAutoNelleSostituzioni(
        {
          'dm.ev_potenza_wallbox': 'sensor.goe_power',
          'dm.ev_target_soc': 'number.evcc_limit_soc',
          'dm.ev_batteria_auto': 'sensor.vecchia_batteria',
          'dm.ev_odometro': 'sensor.vecchio_odometro',
        },
        {
          'dm.ev_batteria_auto': 'sensor.ev6_ev_battery_level',
          'dm.ev_target_soc': 'sensor.ev6_target_soc',
          'dm.ev_potenza_wallbox': 'sensor.ev6_chissa',
          'dm.energy_x': 'sensor.no',
        },
      );
      expect(prossime['dm.ev_batteria_auto'], 'sensor.ev6_ev_battery_level');
      expect(prossime['dm.ev_odometro'], 'sensor.vecchio_odometro');
      expect(prossime['dm.ev_target_soc'], 'number.evcc_limit_soc');
      expect(prossime['dm.ev_potenza_wallbox'], 'sensor.goe_power');
      expect(prossime.containsKey('dm.energy_x'), isFalse);
      expect(eDellaWallbox('dm.ev_cavo_collegato'), isTrue);
      expect(eDellaWallbox('dm.ev_batteria_auto'), isFalse);
      expect(eTargetDiCasa('dm.ev_target_soc', 'sensor.x'), isFalse);
    });

    test('evcc e le colonnine si riconoscono dal nome dell\'integrazione', () {
      expect(eEvcc('evcc_intg', 'evcc'), isTrue);
      expect(eUnaColonnina('evcc_intg', 'evcc'), isFalse);
      expect(eUnaColonnina('goecharger', 'go-e Charger'), isTrue);
      expect(eUnaColonnina('easee', 'Easee EV Charger'), isTrue);
      expect(eUnaColonnina('kia_uvo', 'Kia UVO'), isFalse);
    });
  });

  group('le tabelle', () {
    test(
      'le caselle della colonnina sono quelle di wallbox-device-binding.js',
      () {
        final sorgente = File(
          '../ponte/plancia/src/core/wallbox-device-binding.js',
        ).readAsStringSync();
        final da = sorgente.indexOf('export const CASELLE_DELLA_WALLBOX');
        final blocco = sorgente.substring(da, sorgente.indexOf(']);', da));
        final loro = RegExp(r'"(dm\.ev_[a-z_]+)"')
            .allMatches(blocco)
            .map((trovato) => trovato.group(1))
            .toList();
        expect(caselleDellaWallbox, loro);
      },
    );
  });
}
