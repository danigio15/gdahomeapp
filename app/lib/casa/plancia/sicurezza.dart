/// La sicurezza: i tasti dell'allarme, le porte che si aprono, le allerte.
///
/// Tre cose diverse tenute insieme da una domanda sola — «cosa sta succedendo
/// a casa» — e da tre chiavi che nell'app non c'erano.
library;

import '../entita.dart';

/* ── i tasti dell'antifurto ───────────────────────────────────────────────
 *
 * La centrale dice cosa ACCETTA; chi la usa decide cosa gli serve. Una Ring
 * accetta Casa, Fuori, Notte, Vacanza e Parziale: chi in vacanza non ci va mai
 * si ritrova due tasti che non premera' mai, e in fondo alla fila il tasto che
 * usa ogni sera.
 *
 * La casella tiene solo le modalita' **tolte**: cosi' una centrale che domani
 * dichiara un inserimento in piu' lo mostra da sola, senza che nessuno debba
 * aggiornare un elenco. E lo sblocco non si toglie mai — e' l'unico che deve
 * esserci sempre. */

const chiaveDeiModi = 'cd_antifurto_modi';

/// Le modalita' che una centrale puo' accettare, coi nomi che usa la plancia.
const modiDellAntifurto = <(String, String, String)>[
  ('home', '🏠', 'Casa'),
  ('away', '🚪', 'Fuori'),
  ('night', '🌙', 'Notte'),
  ('vacation', '🧳', 'Vacanza'),
  ('custom', '⚙️', 'Parziale'),
];

/// Quali tasti si e' scelto di non vedere, da qualunque cosa ci sia scritta.
///
/// Legge sia l'elenco (`['vacation']`) sia la mappa (`{'vacation': false}`):
/// sono le due forme che si trovano in giro, e una configurazione vecchia non
/// deve perdersi.
List<String> modiNascosti(dynamic letto) {
  final validi = {for (final (modo, _, _) in modiDellAntifurto) modo};
  final grezzo = <String>[];
  if (letto is List) {
    for (final uno in letto) {
      grezzo.add('$uno');
    }
  } else if (letto is Map) {
    for (final voce in letto.entries) {
      if (voce.value == false) grezzo.add('${voce.key}');
    }
  }
  return [
    for (final uno in grezzo)
      if (validi.contains(uno.trim().toLowerCase())) uno.trim().toLowerCase(),
  ];
}

/// Lo stesso elenco, con un tasto acceso o spento.
List<String> conIlModo(List<String> nascosti, String quale, bool acceso) {
  final dopo = [...nascosti]..remove(quale);
  if (!acceso) dopo.add(quale);
  return dopo;
}

/* ── le porte che si aprono ───────────────────────────────────────────────
 *
 * Serratura, pulsante, rele', cancello o script. Ognuna puo' avere un PIN — da
 * quattro a otto cifre — che viene chiesto prima di aprire: e' una chiave, non
 * una conferma, e una porta protetta continua a chiederla anche a chi la
 * conferma l'ha spenta. */

const chiaveDellePorte = 'cd_security_doors';

/// Se il tocco su un'apertura chiede conferma. **Spenta solo se lo si e'
/// detto**: un cancello aperto per sbaglio te ne accorgi dopo. Ma chi apre il
/// proprio portone dieci volte al giorno la conferma la conosce a memoria, e
/// per lui e' solo un tocco in piu'.
const chiaveDellaConferma = 'cd_porte_conferma';

bool siChiedeConferma(dynamic letto) => letto != false && letto != 'false';

/// L'icona di serie di una porta e' quella del catalogo di casa, non
/// un'emoji di sistema.
const iconaDellaPorta = 'mdi:door-closed';

/// Cosa fa il tocco su una serratura che sa anche aprire (1.4.17):
/// `apri` (o vuoto, che vale lo stesso), `sblocca`, `entrambi`. Qualunque
/// altra cosa vale vuoto, come fa `gestoDellaPorta` nella plancia.
const gestiDellaPorta = ['apri', 'sblocca', 'entrambi'];

String gestoDellaPorta(Object? letto) {
  final voce = '${letto ?? ''}'.trim().toLowerCase();
  return voce == 'sblocca' || voce == 'entrambi' ? voce : '';
}

/// Se una serratura sa anche aprire: il primo bit di `supported_features`.
bool serraturaSaAprire(Entita? stato) {
  if (stato == null || !stato.id.startsWith('lock.')) return false;
  final tratti = stato.attributi['supported_features'];
  final numero = tratti is num ? tratti.toInt() : int.tryParse('$tratti');
  return numero != null && (numero & 1) == 1;
}

/// Se questo PIN va bene: vuoto (nessun PIN) o da quattro a otto cifre.
bool ilPinVaBene(String quale) {
  final pulito = quale.trim();
  if (pulito.isEmpty) return true;
  return RegExp(r'^\d{4,8}$').hasMatch(pulito);
}

/* ── le allerte ───────────────────────────────────────────────────────────
 *
 * Sei categorie, ognuna con la sua entita' principale. Le caselle in piu'
 * servono a chi ha l'informazione spezzata: Blitzortung tiene il conteggio dei
 * fulmini e la distanza in due entita' diverse. */

const chiaveDelleAllerte = 'cd_allerte';

/// Le categorie, con le caselle che ognuna accetta. La prima e' l'entita'
/// principale, e da sola basta. Sono le `CATEGORIE` di `allerte-model.js`
/// (1.4.17): otto — pollini e comfort con le loro caselle in piu', gli
/// scioperi e i treni arrivati con la 1.4.17.
const categorieDelleAllerte =
    <(String, String, String, List<(String, String)>)>[
      (
        'terremoti',
        '🌍',
        'Terremoti',
        [
          ('entity', 'L\'entita\' della scossa'),
          ('magnitudo', 'La magnitudo'),
          ('distanza', 'La distanza (km)'),
        ],
      ),
      ('meteo', '⛈️', 'Meteo', [('entity', 'L\'allerta meteo')]),
      (
        'fulmini',
        '⚡',
        'Fulmini',
        [
          ('entity', 'Il conteggio dei fulmini'),
          ('distanza', 'La distanza (km)'),
        ],
      ),
      (
        'pollini',
        '🌾',
        'Pollini',
        [
          ('entity', 'Pollini di oggi'),
          ('erba', 'Graminacee (facoltativo)'),
          ('erbacce', 'Erbacce (facoltativo)'),
          ('albero', 'Alberi (facoltativo)'),
        ],
      ),
      (
        'comfort',
        '🌡️',
        'Comfort',
        [
          ('entity', 'Percezione'),
          ('humidex', 'Humidex (facoltativo)'),
          ('calore', 'Indice di calore (facoltativo)'),
          ('gelo', 'Rischio gelo (facoltativo)'),
        ],
      ),
      ('voli', '✈️', 'Voli', [('entity', 'I voli sopra casa')]),
      ('scioperi', '🪧', 'Scioperi', [('entity', 'Sensore degli scioperi')]),
      (
        'treni',
        '🚆',
        'Treni',
        [
          ('entity', 'Treno seguito'),
          ('stazione', 'Stazione preferita (facoltativa)'),
        ],
      ),
    ];

/// Gli esempi in grigio delle caselle, quelli della Config della plancia.
const esempiDelleAllerte = <String, String>{
  'pollini.entity': 'sensor.pollini_oggi',
  'pollini.erba': 'sensor.polline_graminacee',
  'pollini.erbacce': 'sensor.polline_erbacce',
  'pollini.albero': 'sensor.polline_alberi',
  'comfort.humidex': 'sensor.thermal_comfort_humidex',
  'comfort.calore': 'sensor.thermal_comfort_heat_index',
  'comfort.gelo': 'sensor.thermal_comfort_frost_risk',
  'scioperi.entity': 'sensor.scioperi_italia',
  'treni.entity': 'sensor.treno_selezionato',
  'treni.stazione': 'sensor.stazione_termini',
};

/* ── l'aria che si respira ────────────────────────────────────────────────
 *
 * Dentro `cd_allerte` c'e' anche `aria`: la misura in copertina, i sensori da
 * non contare, quelli aggiunti a mano con la loro classe, e i confini di
 * ogni misura. E' `normalizzaAria` di `aria-model.js`. Va tenuta quando si
 * riscrivono le allerte: la Config della plancia stessa la perde — e'
 * un difetto suo, della 1.4.17 — e l'app non deve fare lo stesso. */

/// Le misure dell'aria che si conoscono: la classe, il nome, e i tre
/// confini di serie — buona fino a, discreta fino a, scarsa fino a.
const misureDellAria = <(String, String, List<num>)>[
  ('pm25', 'PM2.5', [15, 25, 50]),
  ('pm10', 'PM10', [25, 50, 90]),
  ('pm1', 'PM1', [10, 20, 40]),
  ('carbon_dioxide', 'Anidride carbonica', [800, 1000, 1400]),
  ('carbon_monoxide', 'Monossido di carbonio', [4, 10, 30]),
  (
    'volatile_organic_compounds',
    'Composti organici volatili',
    [300, 1000, 3000],
  ),
  (
    'volatile_organic_compounds_parts',
    'Composti organici volatili (ppb)',
    [65, 220, 660],
  ),
  ('nitrogen_dioxide', 'Biossido di azoto', [40, 90, 120]),
  ('ozone', 'Ozono', [100, 130, 240]),
  ('sulphur_dioxide', 'Biossido di zolfo', [100, 200, 350]),
  ('aqi', 'Indice di qualita\' dell\'aria', [50, 100, 150]),
];

/// L'aria, ripulita come fa `normalizzaAria`: `principale` con un punto
/// dentro, elenchi di entita', aggiunte con una classe conosciuta, soglie
/// di tre numeri crescenti.
Map<String, dynamic> leggiLAria(dynamic letto) {
  final dato = letto is Map
      ? Map<String, dynamic>.from(letto)
      : <String, dynamic>{};
  String pulito(Object? v) => '${v ?? ''}'.trim();
  final principale = pulito(dato['principale']);
  final viste = <String>{};
  final escluse = [
    for (final una
        in (dato['escluse'] is List ? dato['escluse'] as List : const []))
      if (pulito(una).contains('.') && viste.add(pulito(una))) pulito(una),
  ];
  final aggiunte = <String, String>{};
  if (dato['aggiunte'] is Map) {
    for (final voce in (dato['aggiunte'] as Map).entries) {
      final id = pulito(voce.key);
      final classe = pulito(voce.value);
      if (id.contains('.') && misureDellAria.any((m) => m.$1 == classe)) {
        aggiunte[id] = classe;
      }
    }
  }
  final soglie = <String, List<num>>{};
  if (dato['soglie'] is Map) {
    for (final voce in (dato['soglie'] as Map).entries) {
      final classe = pulito(voce.key);
      if (!misureDellAria.any((m) => m.$1 == classe)) continue;
      final grezze = voce.value;
      if (grezze is! List || grezze.length != 3) continue;
      final numeri = [
        for (final uno in grezze)
          uno is num ? uno : num.tryParse('${uno ?? ''}'.trim()),
      ];
      if (numeri.any((n) => n == null || !n.isFinite || n < 0)) continue;
      final tre = numeri.cast<num>();
      if (!(tre[0] < tre[1] && tre[1] < tre[2])) continue;
      soglie[classe] = tre;
    }
  }
  return {
    'principale': principale.contains('.') ? principale : '',
    'escluse': escluse,
    'aggiunte': aggiunte,
    'soglie': soglie,
  };
}

/// La configurazione delle allerte, ripulita: una voce per categoria, con le
/// sue caselle e il suo nome.
Map<String, Map<String, String>> leggiLeAllerte(dynamic letto) {
  final dato = letto is Map
      ? Map<String, dynamic>.from(letto)
      : <String, dynamic>{};
  final fuori = <String, Map<String, String>>{};
  for (final (chiave, _, _, caselle) in categorieDelleAllerte) {
    final voce = dato[chiave] is Map
        ? Map<String, dynamic>.from(dato[chiave] as Map)
        : <String, dynamic>{};
    fuori[chiave] = {
      'nome': '${voce['nome'] ?? ''}'.trim(),
      for (final (casella, _) in caselle)
        casella: '${voce[casella] ?? ''}'.trim(),
    };
  }
  return fuori;
}

/// Le categorie che hanno almeno l'entita' principale.
List<String> allerteConfigurate(Map<String, Map<String, String>> quali) => [
  for (final (chiave, _, _, _) in categorieDelleAllerte)
    if ((quali[chiave]?['entity'] ?? '').contains('.')) chiave,
];

/// Le allerte da salvare: le caselle vuote non si scrivono, e quello che
/// nella chiave non e' una categoria — l'aria — resta com'era.
Map<String, dynamic> allerteDaScrivere(
  Map<String, Map<String, String>> quali, {
  dynamic prima,
}) {
  final fuori = <String, dynamic>{
    if (prima is Map)
      for (final voce in prima.entries)
        if (!categorieDelleAllerte.any((c) => c.$1 == '${voce.key}'))
          '${voce.key}': voce.value,
  };
  for (final (chiave, _, _, _) in categorieDelleAllerte) {
    final voce = <String, dynamic>{
      for (final campo in (quali[chiave] ?? const {}).entries)
        if (campo.value.trim().isNotEmpty) campo.key: campo.value.trim(),
    };
    if (voce.isNotEmpty) fuori[chiave] = voce;
  }
  return fuori;
}
