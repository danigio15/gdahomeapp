/// Una giornata intera, come la manda la casa (`ponte/energia/giornata`):
/// gli stessi numeri del disegno approvato della pagina «La tua giornata».
/// Per le prove e per le foto.
///
/// Nessun nome di persona: chi si sveglia e' «Prima persona», chi rientra e'
/// nessuno in particolare.
library;

const Map<String, dynamic> giornataDiProva = {
  'giornata': {
    'd': '2026-10-18',
    'sole': 18.4,
    'casa': 11.6,
    'presi': 3.1,
    'ceduti': 4.8,
    'usato': 13.6,
    'quotaInCasa': 0.74,
    'euroRete': 0.52,
    'euroCeduti': 0.38,
    'risparmio': 2.41,
    'picco': 4.9,
    'piccoIl': '13:10',
    'p': [
      0, 0, 0, 0, 0, 0, 1, 5, 14, 25, 35, 43, 48, 49, 46, 39, 29, 17, 6, //
      1, 0, 0, 0, 0,
    ],
    'c': [
      4, 3, 3, 3, 3, 3, 5, 9, 7, 6, 19, 21, 8, 7, 6, 7, 12, 9, 14, 22, 16, //
      10, 7, 5,
    ],
    'perFascia': {'0': 0.6, '2': 2.5},
  },
  'conSole': true,
  'piu': [
    {'nome': 'Pompa di calore', 'kwh': 4.2, 'eur': 0.38, 'sole': 0.62},
    {'nome': 'Forno', 'kwh': 1.9, 'eur': 0.31, 'sole': 0},
    {'nome': 'Lavastoviglie', 'kwh': 1.08, 'eur': 0.0, 'sole': 1},
    {'nome': 'Lavatrice', 'kwh': 0.94, 'eur': 0.05, 'sole': 0.72},
    {'nome': 'Frigorifero', 'kwh': 0.85, 'eur': 0.06, 'sole': 0.55},
  ],
  'ieri': 16.4,
  'media': 15.2,
  'record': 'mese',
  'batteria': {
    'caricata': 6.8,
    'usata': 5.1,
    'massimo': 100,
    'massimoAlle': '14:40',
    'stasera': 62,
    'capacita': 10,
  },
  'fasce': {
    'nomi': {'0': 'F1', '1': 'F2', '2': 'F3'},
    'piuBassa': {'nome': 'F3', 'dalle': '23:00'},
    'prezzi': {'F1': 0.175, 'F2': 0.155, 'F3': 0.135},
  },
  'domani': {
    'met': [
      ['9', 'sole'],
      ['11', 'sole'],
      ['13', 'sole'],
      ['15', 'poco'],
      ['17', 'nuvole'],
    ],
    'soleFino': '15:00',
    'pioggia': false,
    'max': 21,
    'consiglio':
        'Lavatrice e lavastoviglie entro le 13: gratis col sole. '
        'Auto: ricarica dalle 10.',
  },
  'settimana': [
    {'d': '2026-10-17', 'pk': 16.4, 'casa': 11.2, 'eur': 0.61},
  ],
  'clima': {
    'stanze': [
      {
        'nome': 'Soggiorno',
        'min': 19.3,
        'media': 21.0,
        'max': 22.6,
        'umidita': 48,
        'ore': [
          20.1, 19.9, 19.7, 19.5, 19.4, 19.3, 19.6, 20.4, 21.0, 21.2, 21.4, //
          21.7, 22.0, 22.4, 22.6, 22.5, 22.2, 21.9, 21.6, 21.4, 21.3, 21.0,
          20.7, 20.4,
        ],
      },
      {
        'nome': 'Camera',
        'min': 18.4,
        'media': 19.4,
        'max': 20.2,
        'umidita': 52,
        'ore': [
          19.0, 18.8, 18.7, 18.6, 18.5, 18.4, 18.6, 19.2, 19.4, 19.3, 19.2, //
          19.4, 19.6, 19.9, 20.0, 20.0, 19.8, 19.6, 19.5, 19.6, 19.9, 20.2,
          19.9, 19.4,
        ],
      },
      {
        'nome': 'Bagno',
        'min': 19.9,
        'media': 21.2,
        'max': 22.8,
        'umidita': 61,
        'ore': [
          20.5, 20.3, 20.2, 20.1, 20.0, 19.9, 21.5, 22.8, 22.0, 21.4, 21.0, //
          21.0, 21.2, 21.4, 21.5, 21.4, 21.2, 21.0, 21.3, 22.6, 22.0, 21.4,
          21.0, 20.8,
        ],
      },
    ],
    'fuori': {
      'min': 9.1,
      'max': 20.6,
      'ore': [
        11.0, 10.5, 10.0, 9.6, 9.3, 9.1, 9.4, 11.0, 13.0, 15.0, 17.0, 18.5, //
        19.6, 20.3, 20.6, 20.2, 19.0, 17.2, 15.6, 14.5, 13.6, 12.8, 12.1, 11.5,
      ],
    },
  },
  'riscaldamento': {
    'minutiAcceso': 250,
    'comfort': 92,
    'range': [19, 23],
    'obiettivo': 21,
    'finestreAperte': 2,
    'minutiClimaSpento': 14,
    'ieriMinuti': 285,
  },
  'solareTermico': {
    'collettore': {
      'max': 80,
      'maxAlle': '13:00',
      'ore': [
        14, 13, 12, 12, 11, 11, 12, 20, 35, 52, 66, 74, 78, 80, 79, 74, 63, //
        45, 28, 20, 17, 16, 15, 14,
      ],
    },
    'bollitore': {
      'max': 65,
      'maxAlle': '15:00',
      'ore': [
        52, 51, 50.5, 50, 49.6, 49.2, 48, 44, 43, 44, 47, 52, 57, 61, 64, //
        65, 64.5, 63, 59, 55, 54, 53.5, 53, 52.5,
      ],
    },
    'pompa': {'minuti': 495, 'da': '09:05', 'a': '17:20'},
    'caloreKwh': 6.3,
    'euro': 0.95,
    'pressione': 2.1,
    'resistenzaMinuti': 0,
  },
  'auto': [
    {
      'nome': 'Auto elettrica',
      'ricariche': [
        {
          'da': '10:20',
          'a': '14:05',
          'kwh': 9.8,
          'socDa': 66,
          'socA': 90,
          'quotaSole': 0.88,
          'euro': 0.21,
        },
      ],
      'viaggi': [
        {'da': '07:36', 'a': '08:20', 'soc': 14, 'km': 32, 'lento': false},
        {'da': '17:30', 'a': '18:12', 'soc': 14, 'km': 31, 'lento': false},
        {'da': '19:30', 'a': '20:18', 'soc': 18, 'km': 19, 'lento': true},
      ],
      'usatiKwh': 13.7,
      'usatiPct': 36,
      'km': 82,
      'kwh100': 16.7,
      'kmStimati': true,
      'socStasera': 58,
      'soc': [
        [0, 80],
        [7.6, 80],
        [8.33, 66],
        [10.33, 66],
        [14.08, 90],
        [17.5, 90],
        [18.2, 76],
        [19.5, 76],
        [20.3, 58],
        [24, 58],
      ],
    },
  ],
  'acqua': {
    'litri': 212,
    'ieriPct': -8,
    'gas': 0.0,
    'irrigazione': {'litri': 40, 'zone': 2, 'alle': '18:30'},
  },
  'eventi': [
    {'ora': '07:02', 'testo': 'Prima persona sveglia, tapparelle aperte'},
    {'ora': '08:10', 'testo': 'Antifurto inserito · casa vuota 7 h 40 min'},
    {'ora': '15:50', 'testo': 'Rientro, antifurto disinserito'},
    {'ora': '17:40', 'testo': 'Lavatrice finita · 0,05 €'},
    {'ora': '23:30', 'testo': 'Antifurto notte'},
  ],
  'conti': {'porte': 14, 'automazioni': 36, 'avvisi': 0},
  'mese': {'euro': 18.70, 'sole': 312.5, 'giorni': 18},
  'confronto': {'ieriSolePct': 12, 'settimanaPct': 21, 'meseRetePct': -14},
  'daSistemare': [
    {'icona': 'batteria', 'testo': 'Sensore porta ingresso al 12%'},
    {'icona': 'aggiornamento', 'testo': '1 aggiornamento disponibile'},
  ],
  'inBreve': [
    {
      'icona': 'sole',
      'testo':
          'Hai preso dalla rete solo **3,1 kWh** (**0,52 €**): il resto '
          'l\'ha dato il sole.',
    },
    {
      'icona': 'clima',
      'testo':
          'In casa fra **18,4°** e **22,6°**; fuori minima 9,1°, massima '
          '20,6°.',
    },
    {
      'icona': 'acqua',
      'testo':
          'Acqua calda a **65°** col solare termico, senza resistenza '
          'elettrica.',
    },
    {
      'icona': 'energia',
      'testo': 'Il più acceso: **Pompa di calore**, 4,2 kWh (62% col sole).',
    },
  ],
};
