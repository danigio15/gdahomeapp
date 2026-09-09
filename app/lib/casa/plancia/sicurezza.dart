/// La sicurezza: i tasti dell'allarme, le porte che si aprono, le allerte.
///
/// Tre cose diverse tenute insieme da una domanda sola — «cosa sta succedendo
/// a casa» — e da tre chiavi che nell'app non c'erano.
library;

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
/// principale, e da sola basta.
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
      ('pollini', '🌾', 'Pollini', [('entity', 'La concentrazione')]),
      ('comfort', '🌡️', 'Comfort', [('entity', 'L\'indice di comfort')]),
      ('voli', '✈️', 'Voli', [('entity', 'I voli sopra casa')]),
    ];

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

/// Le allerte da salvare: le caselle vuote non si scrivono.
Map<String, dynamic> allerteDaScrivere(Map<String, Map<String, String>> quali) {
  final fuori = <String, dynamic>{};
  for (final (chiave, _, _, _) in categorieDelleAllerte) {
    final voce = <String, dynamic>{
      for (final campo in (quali[chiave] ?? const {}).entries)
        if (campo.value.trim().isNotEmpty) campo.key: campo.value.trim(),
    };
    if (voce.isNotEmpty) fuori[chiave] = voce;
  }
  return fuori;
}
