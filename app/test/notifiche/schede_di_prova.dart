/// Le schede delle notifiche elaborate, come le manda la casa
/// (`ponte/src/sentinella.js`, contratto «notifiche v2»): per le prove e per
/// le foto.
library;

import 'dart:io';
import 'dart:typed_data';

const Map<String, Map<String, dynamic>> schedeDiProva = {
  'ciclo': {
    'v': 1,
    't': 'ciclo',
    'n': 'Lavatrice',
    'i': 'lavatrice',
    'da': '15:50',
    'a': '17:42',
    'min': 112,
    'kwh': 0.94,
    'eur': 0.05,
    'sole': 0.72,
    'batt': 0.0,
    'rkwh': 0.26,
    'reur': 0.05,
    'senza': 0.16,
    'w': [
      30, 1900, 2050, 1980, 400, 180, 160, 170, 150, 160, 170, 600, 620, //
      180, 170, 160, 600, 650, 700, 300, 120, 110, 400, 450, 380, 60, 40, 20,
    ],
    's': [
      1500, 1480, 1450, 1420, 1400, 1350, 1300, 1250, 1200, 1150, 1100, //
      1000, 950, 900, 850, 800, 700, 650, 600, 520, 450, 400, 350, 300, 250,
      200, 150, 100,
    ],
  },
  'giornata': {
    'v': 1,
    't': 'giornata',
    'd': '2026-10-17',
    'pk': 18.4,
    'casa': 0.74,
    'ris': 2.41,
    'rk': 3.1,
    're': 0.52,
    'ced': 4.8,
    'pkw': 4.9,
    'pora': '13:10',
    'rec': 'ottobre',
    'p': [
      0, 0, 0, 0, 0, 0, 1, 5, 14, 25, 35, 43, 48, 49, 46, 39, 29, 17, 6, //
      1, 0, 0, 0, 0,
    ],
    'c': [
      4, 3, 3, 3, 3, 3, 5, 9, 7, 6, 19, 21, 8, 7, 6, 7, 12, 9, 14, 22, 16, //
      10, 7, 5,
    ],
    'met': [
      ['9', 'sole'],
      ['11', 'sole'],
      ['13', 'sole'],
      ['15', 'poco'],
      ['17', 'nuvole'],
    ],
    'cons': 'lavatrice entro le 13',
    'batt': 0.62,
  },
  'giornata-senza-sole': {
    'v': 1,
    't': 'giornata',
    'd': '2026-12-03',
    'pk': null,
    'rk': 11.6,
    're': 1.84,
    'c': [
      4, 3, 3, 3, 3, 3, 5, 9, 7, 6, 9, 11, 8, 7, 6, 7, 12, 19, 24, 22, 16, //
      10, 7, 5,
    ],
    'met': [
      ['9', 'pioggia'],
      ['12', 'nuvole'],
      ['15', 'pioggia'],
    ],
    'cons': 'lavatrice dopo le 23, costa meno',
  },
  'ups': {
    'v': 1,
    't': 'ups',
    'n': 'UPS di casa',
    'car': 0.96,
    'min': 25,
    'w': 180,
    'dalle': '18:04',
    'acc': ['router', 'NAS', 'telecamere'],
  },
  'antifurto': {
    'v': 1,
    't': 'antifurto',
    'zona': 'Finestra cucina',
    'ora': '18:22',
    'modo': 'Totale',
    'dalle': '08:10',
    'sir': true,
    'ev': [
      ['18:22', 'Finestra cucina aperta', 'r'],
      ['18:21', 'Movimento in Cucina', 'a'],
    ],
  },
  'movimento': {'v': 1, 't': 'movimento', 'cam': 'Ingresso', 'ora': '18:22:07'},
};

/// Una foto finta di telecamera: il disegno di una porta.
Uint8List fotoDiProva() =>
    File('test/notifiche/porta-di-prova.jpg').readAsBytesSync();
