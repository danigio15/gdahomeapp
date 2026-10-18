/// Le prove della vettura: l'auto della sezione Auto della plancia, letta
/// dalla configurazione, e i suoi dati per gdanav.
library;

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/casa/entita.dart';
import 'package:gdahome/ponte/sonda.dart';
import 'package:gdahome/schermate/navigatore_qui/la_vettura.dart';
import 'package:gdanav_app/gdanav_app.dart';

import 'ponte/ponte_finto.dart';

/* Come la manda il ponte: ogni valore e' testo, spesso JSON dentro. */
Map<String, dynamic> valori({
  List<Map<String, dynamic>>? auto,
  String attiva = '',
  Map<String, String> vive = const {},
}) => {
  'cd_ev_cars': jsonEncode(auto ?? const []),
  'cd_ev_car_active': attiva,
  'cd_entity_overrides': jsonEncode(vive),
};

Entita e(String id, String stato, [Map<String, dynamic> a = const {}]) =>
    Entita(
      id: id,
      stato: stato,
      attributi: a,
      aggiornataIl: DateTime(2026, 9, 25, 10),
    );

void main() {
  final zoe = {
    'uid': 'auto-1',
    'name': 'La Zoe',
    'brand': 'Renault',
    'model': 'Zoe R135',
    'kwh': '52',
    'ov': {
      'dm.ev_batteria_auto': 'sensor.zoe_batteria',
      'dm.ev_autonomia': 'sensor.zoe_autonomia',
      'dm.ev_stato_ricarica': 'sensor.zoe_ricarica',
      'dm.ev_posizione': 'device_tracker.zoe',
    },
  };
  final tesla = {
    'uid': 'auto-2',
    'name': '',
    'brand': 'Tesla',
    'model': 'Model 3 Long Range',
    'ov': {'dm.ev_batteria_auto': 'sensor.tesla_soc'},
  };

  test('l\'auto attiva, con nome, marca, modello e batteria', () {
    final v = LaVettura.daiValori(
      valori(auto: [zoe, tesla], attiva: 'auto-1'),
    )!;
    expect(v.auto.etichetta, 'La Zoe');
    expect(v.auto.marca, 'Renault');
    expect(v.auto.modello, 'Zoe R135');
    expect(v.auto.kwh, 52);
    expect(v.sensori['dm.ev_batteria_auto'], 'sensor.zoe_batteria');
  });

  test(
    'l\'attiva come la sceglie la pagina: uid, poi posizione, se no la prima',
    () {
      expect(
        LaVettura.daiValori(valori(auto: [zoe, tesla], attiva: 'auto-2'))!
            .auto
            .marca,
        'Tesla',
      );
      expect(
        LaVettura.daiValori(valori(auto: [zoe, tesla], attiva: '1'))!
            .auto
            .marca,
        'Tesla',
      );
      expect(
        LaVettura.daiValori(valori(auto: [zoe, tesla], attiva: 'sparita'))!
            .auto
            .marca,
        'Renault',
      );
      /* Un nome vuoto non e' un nome: si dice marca e modello. */
      expect(
        LaVettura.daiValori(valori(auto: [tesla]))!.auto.etichetta,
        'Tesla Model 3 Long Range',
      );
    },
  );

  test('i sensori dell\'auto vincono su quelli della casa', () {
    final v = LaVettura.daiValori(
      valori(
        auto: [zoe],
        vive: {
          'dm.ev_batteria_auto': 'sensor.altro',
          'dm.ev_odometro': 'sensor.zoe_km',
        },
      ),
    )!;
    expect(v.sensori['dm.ev_batteria_auto'], 'sensor.zoe_batteria');
    expect(v.sensori['dm.ev_odometro'], 'sensor.zoe_km');
  });

  test('niente auto elettrica, niente vettura', () {
    expect(LaVettura.daiValori(valori()), isNull);
    expect(
      LaVettura.daiValori(
        valori(
          auto: [
            {...zoe, 'tipo': 'termica'},
          ],
        ),
      ),
      isNull,
    );
    /* Senza profili ma con la batteria nella mappa della casa, l'auto c'e'. */
    expect(
      LaVettura.daiValori(valori(vive: {'dm.ev_battery': 'sensor.soc'})),
      isNotNull,
    );
  });

  test('la lettura: batteria, autonomia, carica e posizione, dagli stati', () {
    final v = LaVettura.daiValori(valori(auto: [zoe]))!;
    final stati = {
      for (final x in [
        e('sensor.zoe_batteria', '72.5'),
        e('sensor.zoe_autonomia', '150', {'unit_of_measurement': 'mi'}),
        e('sensor.zoe_ricarica', 'charging'),
        e('device_tracker.zoe', 'home', {
          'latitude': 44.49,
          'longitude': 11.34,
        }),
      ])
        x.id: x,
    };
    final l = v.lettura((id) => stati[id])!;
    expect(l.sorgente, TipoSorgente.gdahome);
    expect(l.batteria, 72.5);
    expect(l.autonomiaKm, closeTo(241.4, 0.1));
    expect(l.inCarica, isTrue);
    expect(l.latitudine, 44.49);
    expect(l.longitudine, 11.34);
    expect(l.letto, DateTime(2026, 9, 25, 10));
  });

  test(
    'quello che la plancia non chiede si trova fra i sensori dell\'auto',
    () {
      final v = LaVettura.daiValori(valori(auto: [zoe]))!.coiVicini([
        'sensor.zoe_outdoor_temperature',
        'sensor.zoe_battery_temperature',
        'sensor.zoe_speed',
        'sensor.zoe_power',
        'sensor.zoe_charging_power',
        'sensor.zoe_12v_battery_temperature',
      ]);
      final stati = {
        for (final x in [
          e('sensor.zoe_batteria', '42'),
          e('sensor.zoe_outdoor_temperature', '18.5', {
            'device_class': 'temperature',
            'unit_of_measurement': '°C',
            'friendly_name': 'Zoe Outdoor temperature',
          }),
          e('sensor.zoe_12v_battery_temperature', '30', {
            'device_class': 'temperature',
            'unit_of_measurement': '°C',
          }),
          e('sensor.zoe_battery_temperature', '77', {
            'device_class': 'temperature',
            'unit_of_measurement': '°F',
          }),
          e('sensor.zoe_speed', '50', {'unit_of_measurement': 'mph'}),
          e('sensor.zoe_charging_power', '7400', {
            'device_class': 'power',
            'unit_of_measurement': 'W',
          }),
          e('sensor.zoe_power', '12500', {
            'device_class': 'power',
            'unit_of_measurement': 'W',
          }),
        ])
          x.id: x,
      };
      final l = v.lettura((id) => stati[id])!;
      expect(l.temperaturaEsternaC, 18.5);
      expect(l.temperaturaBatteriaC, closeTo(25, 0.01));
      expect(l.velocitaKmh, closeTo(80.47, 0.01));
      expect(l.potenzaKw, 12.5);
    },
  );

  test('senza batteria (o col sensore muto) non si manda niente', () {
    final v = LaVettura.daiValori(valori(auto: [zoe]))!;
    expect(v.lettura((_) => null), isNull);
    expect(v.lettura((id) => e(id, 'unavailable')), isNull);
  });

  test('in carica, con le parole della pagina', () {
    expect(LaVettura.inCarica('C'), isTrue);
    expect(LaVettura.inCarica('B'), isFalse);
    expect(LaVettura.inCarica('Charging'), isTrue);
    expect(LaVettura.inCarica('not_charging'), isFalse);
    expect(LaVettura.inCarica('Charge complete'), isFalse);
    expect(LaVettura.inCarica('on'), isTrue);
    expect(LaVettura.inCarica('off'), isFalse);
    expect(LaVettura.inCarica('connected', kw: 7.2), isTrue);
    expect(LaVettura.inCarica('connected', kw: 0), isFalse);
    expect(LaVettura.inCarica(null), isNull);
    expect(LaVettura.inCarica(null, kw: 11), isTrue);
  });

  /* GdAAuto dice la capacita' e il consumo: la capacita' vale quando nella
   * plancia non e' scritta, e i dati del consumo vanno a gdanav coi nomi del
   * contratto delle sorelle. */
  test('la capacita\' e il consumo dell\'auto, coi nomi del contratto', () {
    final b10 = {
      'uid': 'auto-3',
      'name': 'B10',
      'ov': {
        'dm.ev_batteria_auto': 'sensor.b10_batteria',
        'dm.ev_capacita_batteria': 'sensor.b10_capacita_batteria',
        'dm.ev_energia_residua': 'sensor.b10_energia_residua',
        'dm.ev_consumo_medio': 'sensor.b10_consumo_medio',
        'dm.ev_potenza_riscaldatore': 'sensor.b10_potenza_riscaldatore',
        'dm.ev_comando_clima': 'switch.b10_clima',
        'dm.ev_batteria_in_riscaldamento': 'binary_sensor.b10_scalda',
        'dm.ev_temperatura_interna': 'sensor.b10_temperatura_interna',
      },
    };
    final stati = {
      'sensor.b10_capacita_batteria': e(
        'sensor.b10_capacita_batteria',
        '67.1',
        {'unit_of_measurement': 'kWh'},
      ),
      'sensor.b10_energia_residua': e('sensor.b10_energia_residua', '40200', {
        'unit_of_measurement': 'Wh',
      }),
      'sensor.b10_consumo_medio': e('sensor.b10_consumo_medio', '15.8', {
        'unit_of_measurement': 'kWh/100 km',
      }),
      'sensor.b10_potenza_riscaldatore': e(
        'sensor.b10_potenza_riscaldatore',
        '1200',
        {'unit_of_measurement': 'W'},
      ),
      'switch.b10_clima': e('switch.b10_clima', 'on'),
      'binary_sensor.b10_scalda': e('binary_sensor.b10_scalda', 'off'),
      'sensor.b10_temperatura_interna': e(
        'sensor.b10_temperatura_interna',
        '21.5',
        {'unit_of_measurement': '°C'},
      ),
    };
    Entita? stato(String id) => stati[id];
    final v = LaVettura.daiValori(valori(auto: [b10]))!;
    expect(v.auto.kwh, isNull);
    expect(v.autoConLaCapacita(stato).kwh, 67.1);
    expect(v.autoConLaCapacita(stato).etichetta, 'B10');
    expect(v.datiDelConsumo(stato), {
      'energia_kwh': 40.2,
      'capacita_kwh': 67.1,
      'consumo_medio_kwh100': 15.8,
      'potenza_clima_w': 1200.0,
      'clima_acceso': true,
      'batteria_in_riscaldamento': false,
      'temperatura_interna_c': 21.5,
    });
    /* Lo scritto vince sul sensore. */
    final scritta = LaVettura.daiValori(
      valori(
        auto: [
          {...b10, 'kwh': '66'},
        ],
      ),
    )!;
    expect(scritta.autoConLaCapacita(stato).kwh, 66);
    /* Un dato che manca non si inventa. */
    expect(v.datiDelConsumo((_) => null), isEmpty);
  });

  /* Tutto insieme, sul filo vero: il ponte da' la configurazione della
   * plancia e gli stati, e un cambiamento della batteria arriva a gdanav
   * senza che nessuno abbini niente. */
  test('dal ponte a gdanav, in tempo reale', () async {
    final ponte = await PonteFinto.alza();
    ponte.configurazione = {
      'profile': 'primary',
      'snapshot': {
        'values': valori(auto: [zoe], attiva: 'auto-1'),
      },
    };
    ponte.entita = [
      PonteFinto.unaEntita('sensor.zoe_batteria', '80', unita: '%'),
      PonteFinto.unaEntita('sensor.zoe_autonomia', '300', unita: 'km'),
    ];
    final archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.aggiungi(
      nome: 'Casa',
      segno: segnoBuono,
      identificativo: chiBuono,
      chiave: chiaveBuona,
      inCasa: ponte.indirizzo,
    );
    final collegamento = Collegamento(
      archivio: archivio,
      sonda: Sonda(bussa: (dove) async => dove == ponte.indirizzo.salute),
    );
    final fonte = SorgenteGdahome();
    final filo = IlFiloDellaVettura(collegamento, fonte);
    addTearDown(() async {
      filo.ferma();
      await collegamento.chiudi();
      await ponte.spegni();
    });

    Future<void> finche(bool Function() fatto) async {
      for (var i = 0; i < 100 && !fatto(); i += 1) {
        await Future<void>.delayed(const Duration(milliseconds: 50));
      }
    }

    filo.avvia();
    await collegamento.apri();
    await finche(() => fonte.ultima != null);
    expect(fonte.collegata, isTrue);
    expect(fonte.auto?.etichetta, 'La Zoe');
    expect(fonte.ultima?.batteria, 80);
    expect(fonte.ultima?.autonomiaKm, 300);

    /* Solo i sensori dell'auto: niente get_states, niente eventi di tutta la
     * casa. Da fuori casa erano un megabyte e mezzo a ogni collegamento, e
     * ogni cambiamento di ogni entita' dopo. */
    final abbonamento = ponte.arrivati.lastWhere(
      (uno) => uno['type'] == 'subscribe_entities',
    );
    expect(abbonamento['entity_ids'], [
      'device_tracker.zoe',
      'sensor.zoe_autonomia',
      'sensor.zoe_batteria',
      'sensor.zoe_ricarica',
    ]);
    expect(ponte.arrivati.where((uno) => uno['type'] == 'get_states'), isEmpty);
    expect(
      ponte.arrivati.where((uno) => uno['type'] == 'subscribe_events'),
      isEmpty,
    );

    ponte.evento(abbonamento['id'] as int, {
      'c': {
        'sensor.zoe_batteria': {
          '+': {'s': '79', 'lc': 1788764700.0},
        },
      },
    });
    await finche(() => fonte.ultima?.batteria == 79);
    expect(fonte.ultima?.batteria, 79);
    expect(fonte.ultima?.autonomiaKm, 300);
    expect(fonte.ultima?.sorgente, TipoSorgente.gdahome);
    expect(
      fonte.ultima?.letto,
      DateTime.fromMillisecondsSinceEpoch(1788764700000, isUtc: true),
    );
  });

  test('senza un\'auto elettrica non ci si abbona a niente', () async {
    final ponte = await PonteFinto.alza();
    ponte.configurazione = {
      'profile': 'primary',
      'snapshot': {'values': <String, dynamic>{}},
    };
    ponte.entita = [PonteFinto.unaEntita('sensor.qualunque', '1')];
    final archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.aggiungi(
      nome: 'Casa',
      segno: segnoBuono,
      identificativo: chiBuono,
      chiave: chiaveBuona,
      inCasa: ponte.indirizzo,
    );
    final collegamento = Collegamento(
      archivio: archivio,
      sonda: Sonda(bussa: (dove) async => dove == ponte.indirizzo.salute),
    );
    final fonte = SorgenteGdahome();
    final filo = IlFiloDellaVettura(collegamento, fonte);
    addTearDown(() async {
      filo.ferma();
      await collegamento.chiudi();
      await ponte.spegni();
    });

    filo.avvia();
    await collegamento.apri();
    for (
      var i = 0;
      i < 100 &&
          !ponte.arrivati.any(
            (uno) => uno['type'] == 'dashboardmodern/config/get',
          );
      i += 1
    ) {
      await Future<void>.delayed(const Duration(milliseconds: 50));
    }
    await Future<void>.delayed(const Duration(milliseconds: 200));
    final chiesti = ponte.arrivati.map((uno) => uno['type']).toSet();
    expect(chiesti, contains('dashboardmodern/config/get'));
    expect(chiesti, isNot(contains('subscribe_entities')));
    expect(chiesti, isNot(contains('get_states')));
    expect(chiesti, isNot(contains('subscribe_events')));
    expect(fonte.ultima, isNull);
  });

  /* La B10 di un utente, con l'integrazione Leapmotor: «Da gdahome · 2 h
   * fa» mentre ABRP diceva «2 min», e le temperature «non arriva». */
  group('una Leapmotor B10', () {
    final b10 = {
      'uid': 'auto-b10',
      'name': 'B10',
      'brand': 'Leapmotor',
      'model': 'B10',
      'kwh': '56.2',
      'ov': {'dm.ev_batteria_auto': 'sensor.b10_battery'},
    };
    final adesso = DateTime.utc(2026, 10, 13, 21, 48);
    Entita t(String id, String nome, String stato, String classe) => Entita(
      id: id,
      stato: stato,
      attributi: {
        'friendly_name': nome,
        'device_class': classe,
        if (classe == 'temperature') 'unit_of_measurement': '°C',
      },
      aggiornataIl: adesso.subtract(const Duration(minutes: 2)),
    );
    final batteria = Entita(
      id: 'sensor.b10_battery',
      stato: '63',
      attributi: const {'unit_of_measurement': '%', 'device_class': 'battery'},
      /* Al 63% da due ore: Home Assistant non sposta l'ora se il valore
       * non cambia. */
      aggiornataIl: adesso.subtract(const Duration(hours: 2)),
    );
    final sensori = [
      t(
        'sensor.b10_outdoor_temperature',
        'B10 Outdoor temperature',
        '15',
        'temperature',
      ),
      t(
        'sensor.b10_interior_temperature',
        'B10 Temperatura interna',
        '23',
        'temperature',
      ),
      t(
        'sensor.b10_battery_min_temperature',
        'B10 Temperatura minima batteria',
        '22',
        'temperature',
      ),
      t(
        'sensor.b10_climate_set_temperature_left',
        'B10 Climate set temp left',
        '21',
        'temperature',
      ),
      t(
        'sensor.b10_last_vehicle_update',
        'B10 Ultimo aggiornamento del veicolo',
        adesso.subtract(const Duration(minutes: 2)).toIso8601String(),
        'timestamp',
      ),
      t(
        'sensor.b10_last_successful_refresh',
        'B10 Ultimo aggiornamento cloud',
        adesso.subtract(const Duration(seconds: 30)).toIso8601String(),
        'timestamp',
      ),
      t(
        'sensor.b10_charging_finish_time',
        'B10 Charging finish time',
        adesso.add(const Duration(hours: 3)).toIso8601String(),
        'timestamp',
      ),
    ];
    final stati = {
      for (final x in [batteria, ...sensori]) x.id: x,
    };
    final v = LaVettura.daiValori(valori(auto: [b10]))!
        .coiVicini([for (final x in sensori) x.id]);

    test('le temperature: fuori e batteria, mai quella dell\'abitacolo', () {
      final l = v.lettura((id) => stati[id], adesso: adesso)!;
      expect(l.temperaturaEsternaC, 15);
      expect(l.temperaturaBatteriaC, 22);
    });

    test('con solo quella dell\'abitacolo, fuori non arriva', () {
      final senza = {...stati}..remove('sensor.b10_outdoor_temperature');
      final l = v.lettura((id) => senza[id], adesso: adesso)!;
      expect(l.temperaturaEsternaC, isNull);
      expect(l.temperaturaBatteriaC, 22);
      expect(
        LaVettura.eDiFuori(stati['sensor.b10_interior_temperature']!),
        isFalse,
      );
    });

    test(
      'l\'eta\' e\' quella dei dati dell\'auto, non della batteria ferma',
      () {
        final l = v.lettura((id) => stati[id], adesso: adesso)!;
        expect(l.letto, adesso.subtract(const Duration(minutes: 2)));
      },
    );

    test('senza l\'ora del veicolo, quella del cloud', () {
      final senza = {...stati}..remove('sensor.b10_last_vehicle_update');
      final l = v.lettura((id) => senza[id], adesso: adesso)!;
      expect(l.letto, adesso.subtract(const Duration(seconds: 30)));
    });

    test(
      'senza sensori dell\'ora, il sensore del dispositivo piu\' fresco',
      () {
        final soloNumeri = {
          for (final x in [batteria, ...sensori])
            if (x.attributi['device_class'] != 'timestamp') x.id: x,
        };
        final l = v.lettura((id) => soloNumeri[id], adesso: adesso)!;
        expect(l.letto, adesso.subtract(const Duration(minutes: 2)));
      },
    );

    test('un\'ora nel futuro non si crede', () {
      final futuro = {
        ...stati,
        'sensor.b10_last_vehicle_update': t(
          'sensor.b10_last_vehicle_update',
          'B10 Ultimo aggiornamento del veicolo',
          adesso.add(const Duration(days: 1)).toIso8601String(),
          'timestamp',
        ),
      };
      final l = v.lettura((id) => futuro[id], adesso: adesso)!;
      expect(l.letto, adesso.subtract(const Duration(seconds: 30)));
    });

    test(
      'il nome dell\'auto davanti ai sensori, ma non una parola qualsiasi',
      () {
        expect(
          IlFiloDellaVettura.prefissoDellAuto('sensor.b10_battery'),
          'b10_',
        );
        expect(
          IlFiloDellaVettura.prefissoDellAuto('sensor.battery_level'),
          isNull,
        );
        expect(IlFiloDellaVettura.prefissoDellAuto('sensor.ev_soc'), isNull);
      },
    );
  });

  test('gdanav chiede dati freschi: la casa rilegge l\'auto, e la temperatura '
      'resta quando l\'auto si addormenta', () async {
    final ponte = await PonteFinto.alza();
    final zoeConFuori = {
      ...zoe,
      'ov': {
        ...zoe['ov']! as Map<String, String>,
        'dm.ev_temperatura_esterna': 'sensor.zoe_fuori',
      },
    };
    ponte.configurazione = {
      'profile': 'primary',
      'snapshot': {
        'values': valori(auto: [zoeConFuori], attiva: 'auto-1'),
      },
    };
    final ora = DateTime.now().toUtc().toIso8601String();
    ponte.entita = [
      PonteFinto.unaEntita('sensor.zoe_batteria', '80', unita: '%'),
      PonteFinto.unaEntita(
        'sensor.zoe_fuori',
        '12.5',
        unita: '°C',
        tipo: 'temperature',
        cambiataIl: ora,
        aggiornataIl: ora,
      ),
    ];
    final archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.aggiungi(
      nome: 'Casa',
      segno: segnoBuono,
      identificativo: chiBuono,
      chiave: chiaveBuona,
      inCasa: ponte.indirizzo,
    );
    final collegamento = Collegamento(
      archivio: archivio,
      sonda: Sonda(bussa: (dove) async => dove == ponte.indirizzo.salute),
    );
    final fonte = SorgenteGdahome();
    final filo = IlFiloDellaVettura(collegamento, fonte);
    addTearDown(() async {
      filo.ferma();
      await collegamento.chiudi();
      await ponte.spegni();
    });

    Future<void> finche(bool Function() fatto) async {
      for (var i = 0; i < 100 && !fatto(); i += 1) {
        await Future<void>.delayed(const Duration(milliseconds: 50));
      }
    }

    filo.avvia();
    await collegamento.apri();
    await finche(() => fonte.ultima?.temperaturaEsternaC != null);
    expect(fonte.ultima?.temperaturaEsternaC, 12.5);

    await fonte.chiediAggiornamento();
    final chiesta = ponte.arrivati.lastWhere(
      (uno) => uno['type'] == 'call_service',
    );
    expect(chiesta['domain'], 'homeassistant');
    expect(chiesta['service'], 'update_entity');
    expect(
      (chiesta['target'] as Map)['entity_id'],
      containsAll(['sensor.zoe_batteria', 'sensor.zoe_fuori']),
    );
    /* Due richieste di fila: la seconda aspetta il suo turno. */
    final quante = ponte.arrivati.where((u) => u['type'] == 'call_service');
    await fonte.chiediAggiornamento();
    expect(
      ponte.arrivati.where((u) => u['type'] == 'call_service').length,
      quante.length,
    );

    /* L'auto dorme: la temperatura diventa «unknown», ma quella di poco fa
     * vale ancora. */
    final abbonamento = ponte.arrivati.lastWhere(
      (uno) => uno['type'] == 'subscribe_entities',
    );
    ponte.evento(abbonamento['id'] as int, {
      'c': {
        'sensor.zoe_fuori': {
          '+': {'s': 'unknown'},
        },
        'sensor.zoe_batteria': {
          '+': {'s': '79', 'lc': DateTime.now().millisecondsSinceEpoch / 1000},
        },
      },
    });
    await finche(() => fonte.ultima?.batteria == 79);
    expect(fonte.ultima?.temperaturaEsternaC, 12.5);
  });

  group('la forma stretta di subscribe_entities', () {
    test('lo stato intero: s, a, lc, e lu solo quando serve', () {
      final e = Entita.daStretta('sensor.zoe_batteria', {
        's': '80',
        'a': {'unit_of_measurement': '%'},
        'lc': 1788764400.5,
      })!;
      expect(e.stato, '80');
      expect(e.unita, '%');
      expect(
        e.cambiataIl,
        DateTime.fromMicrosecondsSinceEpoch(1788764400500000, isUtc: true),
      );
      expect(e.aggiornataIl, e.cambiataIl);
      expect(Entita.daStretta('x', {'a': {}}), isNull);
    });

    test('un cambiamento: valore, attributi nuovi e tolti, e le ore', () {
      final prima = Entita.daStretta('device_tracker.zoe', {
        's': 'home',
        'a': {'latitude': 40.8, 'longitude': 14.2, 'gps_accuracy': 5},
        'lc': 1788764400.0,
      })!;
      final dopo = prima.conIlCambio({
        '+': {
          's': 'not_home',
          'a': {'latitude': 40.9},
          'lc': 1788764500.0,
        },
        '-': {
          'a': ['gps_accuracy'],
        },
      });
      expect(dopo.stato, 'not_home');
      expect(dopo.attributi, {'latitude': 40.9, 'longitude': 14.2});
      expect(dopo.cambiataIl, DateTime.utc(2026, 9, 7, 7, 1, 40));
      expect(dopo.aggiornataIl, dopo.cambiataIl);

      /* Stesso valore riscritto: si sposta solo l'ora della scrittura. */
      final riscritta = dopo.conIlCambio({
        '+': {'lu': 1788764600.0},
      });
      expect(riscritta.stato, 'not_home');
      expect(riscritta.cambiataIl, dopo.cambiataIl);
      expect(riscritta.aggiornataIl, DateTime.utc(2026, 9, 7, 7, 3, 20));
    });
  });

  test('gdanav manda alla casa solo i comandi dei viaggi, e solo col filo '
      'aperto', () async {
    final ponte = await PonteFinto.alza();
    ponte.configurazione = {
      'profile': 'primary',
      'snapshot': {'values': <String, dynamic>{}},
    };
    ponte.viaggi = [
      {'id': 'v_1', 'tipo': 'una'},
    ];
    final archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.aggiungi(
      nome: 'Casa',
      segno: segnoBuono,
      identificativo: chiBuono,
      chiave: chiaveBuona,
      inCasa: ponte.indirizzo,
    );
    final collegamento = Collegamento(
      archivio: archivio,
      sonda: Sonda(bussa: (dove) async => dove == ponte.indirizzo.salute),
    );
    final fonte = SorgenteGdahome();
    final filo = IlFiloDellaVettura(collegamento, fonte);
    addTearDown(() async {
      filo.ferma();
      await collegamento.chiudi();
      await ponte.spegni();
    });

    // Prima del filo: un errore, non un'attesa.
    await expectLater(
      filo.comandoAllaCasa({'type': 'ponte/viaggi/elenco'}),
      throwsStateError,
    );
    filo.avvia();
    // gdanav sa come chiedere alla casa i suoi viaggi.
    expect(fonte.chiedi, isNotNull);
    await collegamento.apri();
    final elenco = await fonte.chiedi!({'type': 'ponte/viaggi/elenco'});
    expect(elenco, {
      'sbloccato': true,
      'viaggi': [
        {'id': 'v_1', 'tipo': 'una'},
      ],
    });
    // Nient'altro passa da qui: la casa non si comanda dal navigatore.
    await expectLater(
      filo.comandoAllaCasa({'type': 'call_service', 'domain': 'lock'}),
      throwsArgumentError,
    );
    filo.ferma();
    expect(fonte.chiedi, isNull);
  });
}
