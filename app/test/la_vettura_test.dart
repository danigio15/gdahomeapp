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
}
