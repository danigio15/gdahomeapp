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

    final id =
        ponte.arrivati.lastWhere(
              (uno) => uno['type'] == 'subscribe_events',
            )['id']
            as int;
    ponte.cambia(
      id,
      'sensor.zoe_batteria',
      PonteFinto.unaEntita(
        'sensor.zoe_batteria',
        '79',
        unita: '%',
        aggiornataIl: '2026-09-07T07:05:00.000000+00:00',
      ),
    );
    await finche(() => fonte.ultima?.batteria == 79);
    expect(fonte.ultima?.batteria, 79);
    expect(fonte.ultima?.sorgente, TipoSorgente.gdahome);
  });
}
