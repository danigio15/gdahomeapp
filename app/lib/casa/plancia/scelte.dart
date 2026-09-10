/// Le scelte della plancia arrivate con la 1.4.17, e la loro forma.
///
/// Sono le chiavi piccole: un si'/no, una parola, un oggetto di tre campi.
/// Stanno insieme perche' ognuna da sola sarebbe un file di venti righe, e
/// perche' hanno tutte la stessa regola — la forma la decide la plancia, e
/// qui la si ricopia dal suo modello, con accanto il nome del file da cui
/// viene.
library;

String _pulito(Object? valore) => '${valore ?? ''}'.trim();

/* ── Assist (#360): `core/assist-model.js` ─────────────────────────────── */

/// La chiave in cui vive la configurazione di Assist.
const chiaveDiAssist = 'cd_assist';

/// Come si chiama Assist nell'elenco delle sezioni accese (`cd_sections`).
const sezioneDiAssist = 'assist';

/// Il comando che elenca gli assistenti configurati in casa.
const tipoDegliAgenti = 'conversation/agent/info';

/// La configurazione di Assist, ripulita. `agente` vuoto vuol dire «quello
/// di serie»; la voce e' spenta di serie, il tasto acceso.
class Assist {
  const Assist({
    this.agente = '',
    this.lingua = '',
    this.voce = false,
    this.tasto = true,
  });

  factory Assist.da(Object? letto) {
    final dato = letto is Map ? letto : const {};
    return Assist(
      agente: _pulito(dato['agente'] ?? dato['agent_id']),
      lingua: _pulito(dato['lingua'] ?? dato['language']),
      voce: dato['voce'] == true,
      tasto: dato['tasto'] != false,
    );
  }

  final String agente;
  final String lingua;
  final bool voce;
  final bool tasto;

  Map<String, dynamic> get daScrivere => {
    'agente': agente,
    'lingua': lingua,
    'voce': voce,
    'tasto': tasto,
  };

  Assist con({String? agente, String? lingua, bool? voce, bool? tasto}) =>
      Assist(
        agente: agente ?? this.agente,
        lingua: lingua ?? this.lingua,
        voce: voce ?? this.voce,
        tasto: tasto ?? this.tasto,
      );
}

/// Se Assist e' acceso: la fascia della sezione vince, e dove non c'e' vale
/// ancora il tasto di prima, che diceva la stessa cosa.
bool assistAcceso(Object? sezioni, Object? config) {
  final scelta = sezioni is Map ? sezioni[sezioneDiAssist] : null;
  if (scelta == false) return false;
  if (scelta == true) return true;
  return Assist.da(config).tasto;
}

/* ── I tasti d'inserimento su misura (#413): `core/antifurto-su-misura.js` */

/// Dove si scrivono i modi su misura.
const chiaveDellAntifurtoSuMisura = 'cd_antifurto_su_misura';

/// Che cosa sa eseguire ogni dominio quando gli si dice «inserisci cosi'».
/// Solo domini che un antifurto fatto in casa usa davvero.
const serviziSuMisura = <String, String>{
  'script': 'turn_on',
  'scene': 'turn_on',
  'button': 'press',
  'input_button': 'press',
  'automation': 'trigger',
  'switch': 'turn_on',
  'input_boolean': 'turn_on',
  'light': 'turn_on',
  'select': 'select_option',
  'input_select': 'select_option',
  'alarm_control_panel': 'alarm_arm_away',
};

/// I domini che si possono mettere su un tasto dell'antifurto.
final dominiSuMisura = serviziSuMisura.keys.toList();

/// Il disegno di serie di un tasto nuovo.
const disegnoDiSerieDelTasto = 'mdi:shield-home';

String _dominioDi(String entita) {
  final punto = entita.indexOf('.');
  return punto > 0 ? entita.substring(0, punto).toLowerCase() : '';
}

/// Se questa entita' e' una di quelle che chiedono anche l'opzione.
bool vuoleUnOpzione(Object? entita) =>
    const ['select', 'input_select'].contains(_dominioDi(_pulito(entita)));

/// Un modo su misura ripulito, o `null` se non ha niente da premere: senza
/// entita' il tasto non farebbe niente, e un menu senza la voce da scegliere
/// e' la stessa cosa detta in un altro modo.
Map<String, dynamic>? normalizzaModoSuMisura(Object? grezzo, [int indice = 0]) {
  if (grezzo is! Map) return null;
  final entita = _pulito(grezzo['entita']);
  if (!entita.contains('.') ||
      !serviziSuMisura.containsKey(_dominioDi(entita))) {
    return null;
  }
  final id = _pulito(grezzo['id']).isNotEmpty
      ? _pulito(grezzo['id'])
      : 'su-misura-${indice + 1}';
  final opzione = _pulito(grezzo['opzione']);
  if (vuoleUnOpzione(entita) && opzione.isEmpty) return null;
  return {
    'id': id,
    'nome': _pulito(grezzo['nome']),
    'icona': _pulito(grezzo['icona']),
    'entita': entita,
    'opzione': opzione,
    'stato': _pulito(grezzo['stato']).isNotEmpty
        ? _pulito(grezzo['stato'])
        : entita,
    'valore': _pulito(grezzo['valore']).isNotEmpty
        ? _pulito(grezzo['valore'])
        : opzione,
  };
}

/// Quali righe la plancia terrebbe: e' la spia «finche' non scegli cosa
/// premere questo tasto non compare».
bool modoSuMisuraBuono(Map<String, dynamic> riga, int indice) =>
    normalizzaModoSuMisura(riga, indice) != null;

/* ── Il flusso dell'energia in Home (#415): `flusso-di-casa-section.js` ── */

/// Dove si dice se il flusso in Home si vuole: un si'/no, e senza niente
/// scritto si vede.
const chiaveDelFlussoInHome = 'cd_flusso_home';

bool flussoInHome(Object? letto) => letto != false;

/* ── La riga sotto il meteo (#356, #357): `core/come-sta-la-casa.js` ──── */

/// Quali voci si vedono, e da quale contatto arriva la posta.
const chiaveDellaBarraDiCasa = 'cd_barra_casa';

/// Le voci della barra, nell'ordine della plancia, con disegno e parola.
const vociDellaBarra = <(String, String, String)>[
  ('posta', '📬', 'Posta'),
  ('rifiuti', '♻️', 'Rifiuti'),
  ('sicurezza', '🛡️', 'Sicurezza'),
  ('luci', '💡', 'Luci'),
  ('tapparelle', '🪟', 'Finestre'),
  ('clima', '❄️', 'Clima'),
  ('prese', '🔌', 'Prese'),
  ('media', '🔊', 'Musica'),
];

/// La configurazione della barra, ripulita: di serie ci sono tutte le voci.
class BarraDiCasa {
  BarraDiCasa({Map<String, bool>? voci, this.posta = ''})
    : voci =
          voci ?? {for (final (chiave, _, _) in vociDellaBarra) chiave: true};

  factory BarraDiCasa.da(Object? letto) {
    final dato = letto is Map ? letto : const {};
    final scelte = dato['voci'] is Map ? dato['voci'] as Map : const {};
    return BarraDiCasa(
      voci: {
        for (final (chiave, _, _) in vociDellaBarra)
          chiave: scelte[chiave] != false,
      },
      posta: _pulito(dato['posta']),
    );
  }

  final Map<String, bool> voci;
  final String posta;

  Map<String, dynamic> get daScrivere => {'voci': voci, 'posta': posta};
}

/* ── La lingua (#350): `core/i18n.js` ──────────────────────────────────── */

/// Dove sta scritta la lingua scelta. **Non e' JSON**: la plancia la legge
/// con `localStorage.getItem` e la scrive con `setItem`, nuda. Scriverla con
/// le virgolette intorno vorrebbe dire una lingua che nessuno riconosce.
const chiaveDellaLingua = 'cd_lingua';

/// Le lingue della plancia, col nome che hanno nella loro lingua, in ordine
/// alfabetico del nome — come nella tendina della Config.
const lingueDellaPlancia = <(String, String)>[
  ('de', 'Deutsch'),
  ('en', 'English'),
  ('es', 'Español'),
  ('fr', 'Français'),
  ('it', 'Italiano'),
  ('nl', 'Nederlands'),
  ('pl', 'Polski'),
  ('pt', 'Português'),
  ('tr', 'Türkçe'),
  ('ru', 'Русский'),
  ('ar', 'العربية'),
  ('hi', 'हिन्दी'),
  ('ja', '日本語'),
  ('ko', '한국어'),
  ('zh-Hans', '简体中文'),
  ('zh-Hant', '繁體中文'),
];

/* ── L'orologio in testata: `orologio-section.js` ──────────────────────── */

/// Se l'ora si vede in testata. Anche questa **non e' JSON**: la plancia
/// legge `getItem(chiave) !== "0"`, quindi si spegne scrivendo la parola `0`
/// e si accende togliendo la chiave.
const chiaveDellOrologio = 'cd_orologio';

bool orologioAcceso(String? grezzo) => grezzo != '0';

/* ── Il grafico delle temperature (#433): `core/il-grafico-delle-stanze.js` */

/// Chi resta fuori dal grafico delle Temperature: `{spente: [id, …]}`.
const chiaveDelGraficoDelleStanze = 'cd_grafico_stanze';

/// Le serie spente, come insieme.
Set<String> serieSpente(Object? letto) {
  final elenco = letto is Map ? letto['spente'] : null;
  return {
    for (final una in (elenco is List ? elenco : const []))
      if (_pulito(una).isNotEmpty) _pulito(una),
  };
}

/* ── Il radar meteo (#266): `radar-meteo-section.js`, `core/radar-mappa.js` */

/// La configurazione del radar: da dove arrivano i quadratini e dove si
/// guarda.
const chiaveDelRadar = 'cd_radar_meteo';

/// I servizi della pioggia che si conoscono, e quello di serie.
const serviziDelRadar = <(String, String)>[('rainviewer', 'RainViewer')];
const servizioDiSerieDelRadar = 'rainviewer';

/// Le mappe di fondo fra cui scegliere, e quella di serie.
const fondiDellaMappa = <(String, String)>[('osm', 'OpenStreetMap')];
const fondoDiSerieDellaMappa = 'osm';

/// La parola con cui si dice «nessuno» nella tendina del servizio.
const nessunRadar = 'nessuno';

/// Il raggio di serie e' quello della segnalazione.
const raggioDiSerieDelRadar = 30;

/// I campi che l'editor della plancia scrive, cosi' come li chiama.
const campiDelRadar = <String>[
  'entity',
  'servizio',
  'fondo',
  'modello',
  'fondoModello',
  'zona',
  'raggio',
  'zoomPioggia',
  'lat',
  'lon',
];

/* ── Il motore dell'auto (#326): `core/vehicle-model.js` ───────────────── */

/// Il motore dichiarato da chi non ha nessun profilo auto. E' una parola
/// dentro JSON — `""`, `"termica"`, `"ibrida"` — scritta con
/// `writeJsonIfChanged`, quindi **con** le virgolette.
const chiaveDelMotoreDiCasa = 'cd_ev_motore';

/// I tipi di motore, con le parole della tendina della Config.
const tipiDiMotore = <(String, String)>[
  ('', 'Elettrica'),
  ('termica', 'Termica (benzina, diesel, GPL)'),
  ('ibrida', 'Ibrida plug-in'),
];

/// Il tipo ripulito: `termica`, `ibrida`, o vuoto che vuol dire elettrica.
String tipoMotore(Object? valore) {
  final voce = _pulito(valore).toLowerCase();
  return voce == 'termica' || voce == 'ibrida' ? voce : '';
}

/* ── Gli allagamenti gia' rilevati: `flood-alerts-section.js` ──────────── */

/// Il gemello di `cd_fumo_rilevato`, ma con un'altra forma: un si'/no. Dice
/// che il rilevamento automatico dei sensori di allagamento e' gia' passato
/// una volta, cosi' una lista svuotata resta vuota invece di riempirsi da
/// sola.
const chiaveDegliAllagamentiRilevati = 'cd_allag_rilevato';

/// Il gruppo dei sensori di allagamento dentro `cd_gruppi_extra`.
const gruppoDegliAllagamenti = 'allagamento';

/* ── Le tavolozze: `core/tavolozze.js`, `tavolozze-section.js` ─────────── */

/// Le tavolozze in piu' oltre a chiaro e scuro, con la famiglia, il disegno
/// e il nome della Config. Chiave `cd_tavolozza`, **di questo dispositivo**:
/// non sta fra le chiavi che viaggiano.
const tavolozzeDellaPlancia = <(String, String, String, String)>[
  ('notte', 'scuro', '🌌', 'Notte blu'),
  ('grafite', 'scuro', '🪨', 'Grafite'),
  ('bosco', 'scuro', '🌲', 'Bosco'),
  ('sabbia', 'chiaro', '🏜️', 'Sabbia'),
  ('menta', 'chiaro', '🌿', 'Menta'),
  ('ardesia', 'chiaro', '🩶', 'Ardesia'),
];

/* ── Il verso della batteria (#434): `core/energy-flow-truth.js` ───────── */

/// Se il sensore della batteria scrive positivo quando si carica:
/// `{girata: true}`. Chi non tocca niente resta com'era.
const chiaveDelVersoDellaBatteria = 'cd_batteria_verso';

bool batteriaGirata(Object? letto) {
  if (letto == true || letto == 'true' || letto == 1) return true;
  if (letto is Map) return batteriaGirata(letto['girata']);
  return false;
}
