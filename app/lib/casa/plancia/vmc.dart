/// La ventilazione meccanica controllata (#371): il porto di `core/vmc-model.js`.
///
/// Una VMC non e' un termostato: ha DUE flussi d'aria che si incrociano dentro
/// uno scambiatore, e quattro temperature che li descrivono —
///
///     fuori ──[esterna]──▶ scambiatore ──[immissione]──▶ dentro casa
///     fuori ◀─[espulsione]── scambiatore ◀──[ripresa]── dentro casa
///
/// — piu' le pastiglie di come sta lavorando (il bypass, l'estate, i filtri)
/// e le ventole. Qui c'e' la forma con cui si scrive: quattro macchine al
/// massimo, ognuna con le sue caselle.
library;

/// La chiave in cui vive la configurazione della VMC.
const chiaveDellaVmc = 'cd_vmc';

/// Un tetto: quattro macchine sono gia' un palazzo, non una casa.
const massimoVmc = 4;

/// Le quattro temperature, nell'ordine in cui si leggono, con le parole della
/// Config della plancia e l'esempio in grigio.
const temperatureDellaVmc = <(String, String, String, String)>[
  ('esterna', '🌡️', 'Aria esterna', 'sensor.vmc_temperatura_esterna'),
  ('immissione', '➡️', 'Immissione (in casa)', 'sensor.vmc_immissione'),
  ('ripresa', '🏠', 'Ripresa (da casa)', 'sensor.vmc_ripresa'),
  ('espulsione', '⬅️', 'Espulsione (fuori)', 'sensor.vmc_espulsione'),
];

/// Le pastiglie di come sta lavorando: `binary_sensor`.
const interruttoriDellaVmc = <(String, String, String, String)>[
  ('bypass', '🔀', 'Bypass aperto', 'binary_sensor.vmc_bypass'),
  ('estate', '☀️', 'Modalita\' estate', 'binary_sensor.vmc_estate'),
  ('filtri', '🧽', 'Filtri da cambiare', 'binary_sensor.vmc_filtri'),
];

/// Le ventole e i livelli: numeri che si leggono e basta.
const numeriDellaVmc = <(String, String, String, String)>[
  (
    'ventola_immissione',
    '🌀',
    'Ventola immissione (giri)',
    'sensor.vmc_ventola_immissione',
  ),
  (
    'ventola_espulsione',
    '🌀',
    'Ventola espulsione (giri)',
    'sensor.vmc_ventola_espulsione',
  ),
  (
    'livello_immissione',
    '📶',
    'Livello immissione',
    'sensor.vmc_livello_immissione',
  ),
  ('livello_ripresa', '📶', 'Livello ripresa', 'sensor.vmc_livello_ripresa'),
];

/// La macchina: l'entita' `climate` (o `fan`) che la comanda.
const macchinaDellaVmc = (
  'clima',
  '🎛️',
  'Entita\' climate della macchina',
  'climate.vmc',
);

/// Tutte le caselle di una macchina, in un elenco solo, nell'ordine della
/// plancia: `clima` prima, poi le temperature, gli interruttori, i numeri.
const campiDellaVmc = <String>[
  'clima',
  'esterna',
  'immissione',
  'ripresa',
  'espulsione',
  'bypass',
  'estate',
  'filtri',
  'ventola_immissione',
  'ventola_espulsione',
  'livello_immissione',
  'livello_ripresa',
];

String _pulito(Object? valore) => '${valore ?? ''}'.trim();

/// Una macchina ripulita, con tutte le caselle: e' cosi' che la scrive la
/// plancia (`normalizzaVmc`).
Map<String, dynamic> normalizzaVmc(Object? input, [int indice = 0]) {
  final grezzo = input is Map
      ? Map<String, dynamic>.from(input)
      : const <String, dynamic>{};
  final unita = <String, dynamic>{
    'id': _pulito(grezzo['id']).isNotEmpty
        ? _pulito(grezzo['id'])
        : 'vmc-${indice + 1}',
    'nome': _pulito(grezzo['nome'] ?? grezzo['name']),
    'stanza': _pulito(grezzo['stanza'] ?? grezzo['room'] ?? grezzo['room_id']),
  };
  for (final campo in campiDellaVmc) {
    unita[campo] = _pulito(grezzo[campo]);
  }
  return unita;
}

/// L'elenco delle macchine, senza doppioni di identificativo, non piu' di
/// quattro.
List<Map<String, dynamic>> normalizzaVmcTutte(Object? input) {
  final elenco = input is List
      ? input
      : input is Map
      ? [input]
      : const [];
  final visti = <String>{};
  final fuori = <Map<String, dynamic>>[];
  for (final (indice, voce) in elenco.indexed) {
    final unita = normalizzaVmc(voce, indice);
    var id = '${unita['id']}';
    var scarto = 2;
    while (visti.contains(id)) {
      id = '${unita['id']}-${scarto++}';
    }
    visti.add(id);
    fuori.add({...unita, 'id': id});
    if (fuori.length >= massimoVmc) break;
  }
  return fuori;
}

/// Se la macchina ha qualcosa da mostrare: almeno una casella piena.
bool vmcDisegnabile(Map<String, dynamic> unita) =>
    campiDellaVmc.any((campo) => '${unita[campo] ?? ''}'.trim().isNotEmpty);
