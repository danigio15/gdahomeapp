/// Le automazioni di Home Assistant che mandano notifiche, come le dice il
/// ponte (`ponte/notifiche/ha/elenco`): per le prove e per le fotografie.
/// Nessun nome di persona: i telefoni sono «Persona 1».
library;

const telefonoQui = 'dm_questo';
const telefonoDiPersona1 = 'dm_persona_1';

/// Le sei del disegno approvato, tutte spente tranne tre.
Map<String, dynamic> datiDaHomeAssistant({
  bool premium = true,
  DateTime? adesso,
}) {
  final ora = adesso ?? DateTime(2026, 10, 18, 18, 40);
  final ieri = ora
      .subtract(const Duration(days: 1))
      .copyWith(hour: 18, minute: 42)
      .millisecondsSinceEpoch;
  return {
    'premium': premium,
    'proponi': true,
    'telefoni': [
      {'id': telefonoQui, 'nome': '', 'modello': 'Pixel 8', 'io': true},
      {
        'id': telefonoDiPersona1,
        'nome': 'Persona 1',
        'modello': 'iPhone 15',
        'io': false,
      },
    ],
    'automazioni': [
      {
        'chiave': '1700000000001',
        'alias': 'Lavatrice finita',
        'quando': {
          'it': 'Quando Lavatrice · potenza resta sotto 5 W per 3 minuti',
          'en': 'When Washer · power stays below 5 W for 3 minutes',
        },
        'ultimaVolta': ieri,
        'bersaglio': 'questo',
        'telefoni': <String>[],
        'anteprima': {'titolo': 'Lavatrice', 'testo': 'Il bucato è pronto: …'},
        'ultimo': {
          'titolo': 'Lavatrice',
          'testo': 'Il bucato è pronto: 1 h 52 min, 0,9 kWh',
          'il': ieri,
        },
        'conFoto': false,
        'conTasti': false,
        'urgente': false,
        'testoCheCambia': true,
        'acceso': true,
        'a': 'questo',
        'silenzio': true,
        'nuova': false,
      },
      {
        'chiave': '1700000000004',
        'alias': 'Porta garage aperta da 10 minuti',
        'bersaglio': 'tutti',
        'anteprima': {
          'titolo': '',
          'testo': 'La porta del garage è aperta da 10 minuti',
        },
        'conTasti': true,
        'acceso': true,
      },
      {
        'chiave': '1700000000002',
        'alias': 'Allarme: movimento in giardino',
        'bersaglio': 'questo',
        'anteprima': {'titolo': 'Allarme', 'testo': 'Movimento in giardino'},
        'ultimo': {
          'titolo': 'Allarme',
          'testo': 'Movimento in giardino alle 02:14',
          'il': ieri,
        },
        'conFoto': true,
        'conTasti': true,
        'urgente': true,
        'acceso': true,
      },
      {
        'chiave': '1700000000008',
        'alias': 'Bollette: lettura contatore',
        'bersaglio': 'questo',
        'anteprima': {'titolo': '', 'testo': 'Ottobre: 212 kWh, 18 m³ di gas'},
        'acceso': false,
      },
      {
        'chiave': '1700000000006',
        'alias': 'Buongiorno: meteo di oggi',
        'bersaglio': 'questo',
        'anteprima': {
          'titolo': '',
          'testo': 'Nuvoloso, 14–19 °C, pioggia dalle 16',
        },
        'testoCheCambia': true,
        'acceso': false,
        'nuova': true,
      },
      {
        'chiave': '1700000000003',
        'alias': 'Batterie dei sensori scariche',
        'bersaglio': 'altro',
        'telefoni': [telefonoDiPersona1],
        'acceso': false,
      },
    ],
  };
}
