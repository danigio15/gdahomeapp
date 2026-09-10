/// L'auto e la colonnina che arrivano da un'integrazione, gia' fatte.
///
/// E' il porto fedele di `core/auto-device-binding.js` e di
/// `core/wallbox-device-binding.js`: si sceglie l'integrazione, si sceglie il
/// dispositivo, e la vettura nasce con le caselle `dm.ev_*` gia' piene invece
/// di battere venti entity_id a mano. Chi guida l'assegnazione e' il
/// `device_class` quando c'e' — e' quello che Home Assistant dichiara, non
/// quello che si indovina — e solo dove non basta si guardano le parole, in
/// tutte le lingue che le integrazioni delle auto usano davvero.
///
/// Una casella la si riempie una volta sola: la stessa entita' non puo' essere
/// insieme l'odometro e l'ultimo viaggio, e la prima domanda che se la prende
/// la toglie dal mazzo per le successive. L'ordine delle domande e' quello
/// della plancia, riga per riga: cambiarlo vorrebbe dire due auto diverse
/// dallo stesso dispositivo.
///
/// La wallbox e evcc non sono l'auto: la colonnina e' DELLA CASA, l'auto e' UNA
/// DELLE AUTO. Le sue caselle stanno in `cd_entity_overrides`, separate, e non
/// se le porta via nessun cambio di vettura.
library;

import '../entita.dart';
import 'legame.dart' show DaLeggere;

/* ─── gli attrezzi ───────────────────────────────────────────────────────── */

String _pulito(Object? valore) => '${valore ?? ''}'.trim();

String _dominio(DaLeggere una) => una.id.split('.').first;

/// Le parole di un'entita', come le legge la plancia: l'entity_id, il nome del
/// registro e il `friendly_name` dello stato, con gli underscore fatti spazi.
String _parole(DaLeggere una, Map<String, Entita>? stato) =>
    '${una.id} ${una.nome} ${_pulito(stato?[una.id]?.attributi['friendly_name'])}'
        .replaceAll('_', ' ');

String _classe(DaLeggere una, Map<String, Entita>? stato) => _pulito(
  una.classe.isNotEmpty
      ? una.classe
      : stato?[una.id]?.attributi['device_class'],
).toLowerCase();

String _unita(DaLeggere una, Map<String, Entita>? stato) => _pulito(
  una.unita.isNotEmpty
      ? una.unita
      : stato?[una.id]?.attributi['unit_of_measurement'],
);

/// Le impostazioni del dispositivo non sono l'auto: il volume dell'avvisatore
/// e la versione del firmware stanno nel pannello del dispositivo. La
/// diagnostica pero' NON si scarta: parecchie integrazioni ci mettono la
/// batteria di servizio e la pressione delle gomme.
bool _soloImpostazione(DaLeggere una) =>
    una.categoria.trim().toLowerCase() == 'config';

RegExp _re(String sorgente) => RegExp(sorgente, caseSensitive: false);

/// Una lettera della norma IEC 61851 come stato: «vehicle status» a B con
/// l'auto attaccata e' il cavo detto meglio di qualunque acceso/spento.
/// `eUnaLettera` in `stato-della-ricarica.js`.
bool eUnaLettera(String? stato) =>
    RegExp(r'^[abcdfABCDF]$').hasMatch(_pulito(stato));

/* ─── il cavo, che leggono in due ────────────────────────────────────────── */

final _paroleDelCavo = _re(
  r'\b(connected|connection|plugged|plug|cavo|cable|collegat\w*|vehicle status|angeschlossen|conectad\w*)\b',
);
final _connessioneDetta = _re(
  r'\b(connected|connection|plugged|collegat\w*|attaccat\w*|angeschlossen|conectad\w*)\b',
);
final _caricaInCorso = _re(
  r'\b(charging|in carica|ricarica in corso|l[äa]dt|cargando|en charge)\b',
);

/// Se un nome parla del CAVO. Vale la parola piu' forte — un «connected», un
/// «plugged», un «collegato» dicono il cavo e basta — e solo quando quella
/// non c'e' si guarda se il nome parla di una carica in corso.
bool parlaDelCavo(String? nome) {
  final testo = nome ?? '';
  if (!_paroleDelCavo.hasMatch(testo)) return false;
  return _connessioneDetta.hasMatch(testo) || !_caricaInCorso.hasMatch(testo);
}

/* ─── i vocabolari dell'auto ─────────────────────────────────────────────── */

final _paroleDellAuto = <String, RegExp>{
  'batteria': _re(
    r'\b(soc|state of charge|batteria(?! di servizio| 12)|battery(?! voltage| 12)|hv batt|traction batt)\b',
  ),
  'batteriaServizio': _re(
    r'\b(12\s?v|aux(iliary)? batt|batteria (di )?servizio|starter batt|bordbatterie)\b',
  ),
  'carburante': _re(
    r'\b(fuel|carburante|benzina|gasolio|diesel|tank|serbatoio|kraftstoff|combustible|niveau de carburant)\b',
  ),
  'autonomia': _re(
    r'\b(range|autonomia|reichweite|autonomie|autonom[ií]a|dte|distance to empty)\b',
  ),
  'odometro': _re(
    r'\b(odometer|odometro|contachilometri|kilometerstand|kilometraje|totalizzatore)\b',
  ),
  'ultimoViaggio': _re(
    r'\b(last trip|ultimo viaggio|trip distance|letzte fahrt|dernier trajet)\b',
  ),
  'carburanteTotale': _re(
    r'\b(fuel (used|consumed)|carburante (consumato|totale)|verbrauch(t)?|consommation totale)\b',
  ),
  'ricarica': _re(
    r'\b(charging|charge state|stato (di )?ricarica|ladezustand|estado de carga|en charge|plug|cavo|cable)\b',
  ),
  'potenza': _re(
    r'\b(charg\w* power|potenza (di )?ricarica|ladeleistung|puissance)\b',
  ),
  'target': _re(r'\b(target|limite|soglia|ladeziel|objetivo)\b'),
  'motore': _re(
    r'\b(engine|motore|ignition|quadro|z[üu]ndung|encendido|moteur)\b',
  ),
  /* Le portiere si chiedono in due tempi: prima «e' chiusa a chiave?», che e'
   * il riepilogo che la card vuole, e solo dopo la singola porta. */
  'serratura': _re(
    r'\b(lock(ed)?|serratur|bloccat|verrouill|verriegel|cerrad)\b',
  ),
  'portiere': _re(r'\b(door|portier|porte|t[üu]r|puerta)\b'),
  'finestrini': _re(r'\b(window|finestrin|fenster|ventana|vitre)\b'),
  'bagagliaio': _re(
    r'\b(trunk|boot|bagagliaio|kofferraum|maletero|coffre|tailgate|hatch|liftgate)\b',
  ),
  'cofano': _re(r'\b(hood|bonnet|cofano|motorhaube|cap[óo]|capot|frunk)\b'),
  'allarme': _re(r'\b(alarm|allarm|antifurt|alarma|alarme)\b'),
  'olio': _re(r'\b(oil|olio|[öo]l\b|aceite|huile)\b'),
  'esterna': _re(
    r'\b(outside|external|ambient|esterna|au(ss|ß)en|exterior|ext[ée]rieur)\b',
  ),
  'pneumatici': _re(
    r'\b(tyre|tire|pneumatic|pneumatici|reifen|neum[áa]tic|pneu)\b',
  ),
};

/// Le quattro ruote, e le parole con cui le integrazioni le distinguono.
final _ruote = <(String, RegExp)>[
  (
    'dm.ev_pneumatico_ant_sx',
    _re(
      r'\b(front[- _]?left|ant\w*[- _]?(sx|sinistr)|vorne links|avant gauche|fl)\b',
    ),
  ),
  (
    'dm.ev_pneumatico_ant_dx',
    _re(
      r'\b(front[- _]?right|ant\w*[- _]?(dx|destr)|vorne rechts|avant droit|fr)\b',
    ),
  ),
  (
    'dm.ev_pneumatico_post_sx',
    _re(
      r'\b(rear[- _]?left|post\w*[- _]?(sx|sinistr)|hinten links|arri[èe]re gauche|rl)\b',
    ),
  ),
  (
    'dm.ev_pneumatico_post_dx',
    _re(
      r'\b(rear[- _]?right|post\w*[- _]?(dx|destr)|hinten rechts|arri[èe]re droit|rr)\b',
    ),
  ),
];

/* ─── il mazzo ───────────────────────────────────────────────────────────── */

/// Le entita' di un dispositivo, da cui ogni domanda prende la prima che
/// risponde e la toglie dal mazzo.
class _Mazzo {
  _Mazzo(Iterable<DaLeggere> entita, this.stato)
    : elenco = [
        for (final una in entita)
          if (!una.spenta && una.id.contains('.')) una,
      ] {
    libere.addAll(elenco.map((una) => una.id));
  }

  final List<DaLeggere> elenco;
  final Map<String, Entita>? stato;
  final Set<String> libere = {};
  final Map<String, String> mappa = {};

  /// Prende la prima entita' che risponde alla domanda, e la toglie dal
  /// mazzo: una casella riempita non si riempie due volte, e un'entita' presa
  /// non finisce anche altrove.
  bool prendi(
    String ref,
    bool Function(DaLeggere una) domanda, {
    bool ancheImpostazioni = false,
  }) {
    if ((mappa[ref] ?? '').isNotEmpty) return false;
    for (final una in elenco) {
      if (!libere.contains(una.id)) continue;
      if (_soloImpostazione(una) && !ancheImpostazioni) continue;
      if (!domanda(una)) continue;
      mappa[ref] = una.id;
      libere.remove(una.id);
      return true;
    }
    return false;
  }

  bool Function(DaLeggere) conClasse(String nome) =>
      (una) => _classe(una, stato) == nome;

  bool percentuale(DaLeggere una) => _unita(una, stato) == '%';

  String parole(DaLeggere una) => _parole(una, stato);
}

/* ─── l'auto ─────────────────────────────────────────────────────────────── */

/// Quello che un dispositivo ha lasciato capire di un'auto.
class LegameDellAuto {
  const LegameDellAuto({required this.mappa, required this.tipo});

  /// `ref → entity_id`, solo le caselle riempite.
  final Map<String, String> mappa;

  /// `''` (elettrica), `termica` o `ibrida`: da [motoreDalleCaselle].
  final String tipo;
}

/// Le caselle `dm.ev_*` che questo dispositivo sa riempire: e'
/// `legaLAutoAlDispositivo`. Non salva niente: chi chiama decide cosa farne.
LegameDellAuto legaLAutoAlDispositivo(
  Iterable<DaLeggere> entita, {
  Map<String, Entita>? stato,
}) {
  final mazzo = _Mazzo(entita, stato);
  bool Function(DaLeggere) conParola(String chiave, [String? dominio]) =>
      (una) =>
          (dominio == null || _dominio(una) == dominio) &&
          _paroleDellAuto[chiave]!.hasMatch(mazzo.parole(una));
  final conClasse = mazzo.conClasse;
  final percentuale = mazzo.percentuale;

  /* La posizione: un `device_tracker` e' esattamente quello. */
  mazzo.prendi('dm.ev_posizione', (una) => _dominio(una) == 'device_tracker');

  /* Le due batterie, nell'ordine che conta: prima quella di servizio, che si
   * riconosce dalle parole, o la sua percentuale si prenderebbe il posto
   * della batteria di trazione. */
  mazzo.prendi(
    'dm.ev_batteria_servizio',
    (una) =>
        percentuale(una) &&
        _paroleDellAuto['batteriaServizio']!.hasMatch(mazzo.parole(una)),
  );
  /* Oppure in volt (#348): meta' delle integrazioni pubblica la batteria da
   * 12 V come tensione, non come livello. Solo se parla di batteria di
   * servizio — una tensione qualunque e' della colonnina o della rete. */
  mazzo.prendi(
    'dm.ev_batteria_servizio',
    (una) =>
        (conClasse('voltage')(una) ||
            RegExp(
              r'^m?v$',
              caseSensitive: false,
            ).hasMatch(_unita(una, stato))) &&
        _paroleDellAuto['batteriaServizio']!.hasMatch(mazzo.parole(una)),
  );
  mazzo.prendi(
    'dm.ev_batteria_auto',
    (una) => conClasse('battery')(una) && _dominio(una) == 'sensor',
  );
  /* «Target SoC» parla di SoC ma non e' la batteria: e' il traguardo della
   * ricarica, e ha la sua casella piu' sotto. */
  mazzo.prendi(
    'dm.ev_batteria_auto',
    (una) =>
        percentuale(una) &&
        conParola('batteria')(una) &&
        !conParola('target')(una),
  );

  /* Il serbatoio: una percentuale che parla di carburante. Un sensore in
   * litri e' il consumo totale, non il livello. */
  mazzo.prendi(
    'dm.ev_carburante',
    (una) =>
        percentuale(una) &&
        _paroleDellAuto['carburante']!.hasMatch(mazzo.parole(una)),
  );

  mazzo.prendi(
    'dm.ev_autonomia',
    (una) => conClasse('distance')(una) && conParola('autonomia')(una),
  );
  mazzo.prendi('dm.ev_autonomia', conParola('autonomia', 'sensor'));
  mazzo.prendi('dm.ev_odometro', conParola('odometro', 'sensor'));
  mazzo.prendi('dm.ev_ultimo_viaggio', conParola('ultimoViaggio', 'sensor'));
  mazzo.prendi(
    'dm.ev_carburante_totale',
    conParola('carburanteTotale', 'sensor'),
  );

  /* La ricarica: lo stato, la potenza e il traguardo. Un'auto pubblica sia
   * «Charging» sia «Battery Charging»: la prima e' il nome che uno riconosce
   * sulla card. «Discharging» non e' «charging» e non entra. */
  bool nuda(DaLeggere una) =>
      !RegExp(r'\bbatter', caseSensitive: false).hasMatch(una.nome.trim());

  /* Il cavo, e prima dello stato della ricarica: quasi tutte le integrazioni
   * delle auto pubblicano il loro «charger connected», e le parole del cavo
   * stanno anche nel vocabolario della ricarica — chi arriva primo si porta
   * via l'entita'. Un `binary_sensor` che parla del cavo, oppure un sensore
   * che pubblica la lettera della norma. */
  bool lettera(DaLeggere una) => eUnaLettera(stato?[una.id]?.stato);
  mazzo.prendi(
    'dm.ev_cavo_collegato',
    (una) =>
        parlaDelCavo(mazzo.parole(una)) &&
        (_dominio(una) == 'binary_sensor' || lettera(una)),
  );

  mazzo.prendi(
    'dm.ev_stato_ricarica',
    (una) =>
        conParola('ricarica')(una) && nuda(una) && _dominio(una) != 'sensor',
  );
  mazzo.prendi(
    'dm.ev_stato_ricarica',
    (una) => conParola('ricarica')(una) && nuda(una),
  );
  mazzo.prendi(
    'dm.ev_stato_ricarica',
    (una) => conParola('ricarica')(una) && _dominio(una) != 'sensor',
  );
  mazzo.prendi('dm.ev_stato_ricarica', conParola('ricarica', 'sensor'));
  mazzo.prendi(
    'dm.ev_potenza_ricarica',
    (una) => conClasse('power')(una) && conParola('potenza')(una),
  );
  mazzo.prendi('dm.ev_potenza_ricarica', conParola('potenza', 'sensor'));

  /* Il target: prima uno che si puo' COMANDARE — un `number` o una tendina —
   * perche' la plancia lo usa per cambiare il limite. Ma deve parlare di
   * CARICA: un `number.cabin_target_temperature` e' un target anche lui. */
  bool comandabile(DaLeggere una) => const [
    'select',
    'input_select',
    'number',
    'input_number',
  ].contains(_dominio(una));
  bool parlaDiCarica(DaLeggere una) => RegExp(
    r'\b(soc|charg\w*|carica|limit\w*|ladeziel|ladelimit)\b',
    caseSensitive: false,
  ).hasMatch(mazzo.parole(una));
  mazzo.prendi(
    'dm.ev_target_soc',
    (una) =>
        comandabile(una) &&
        conParola('target')(una) &&
        (percentuale(una) || parlaDiCarica(una)),
  );
  mazzo.prendi(
    'dm.ev_target_soc',
    (una) => percentuale(una) && conParola('target')(una),
  );

  /* Le aperture e i comandi: le classi di Home Assistant per prime. */
  mazzo.prendi('dm.ev_portiere', (una) => _dominio(una) == 'lock');
  mazzo.prendi('dm.ev_portiere', (una) => _classe(una, stato) == 'lock');
  mazzo.prendi('dm.ev_portiere', conParola('serratura'));
  mazzo.prendi('dm.ev_portiere', (una) => _classe(una, stato) == 'door');
  mazzo.prendi('dm.ev_portiere', conParola('portiere'));
  mazzo.prendi('dm.ev_finestrini', (una) => _classe(una, stato) == 'window');
  mazzo.prendi('dm.ev_finestrini', conParola('finestrini'));
  mazzo.prendi('dm.ev_bagagliaio', conParola('bagagliaio'));
  mazzo.prendi('dm.ev_cofano', conParola('cofano'));
  mazzo.prendi('dm.ev_allarme', conParola('allarme'));
  mazzo.prendi('dm.ev_motore', conParola('motore'));

  /* Le temperature: l'olio e quella di fuori sono due gradi diversi. */
  mazzo.prendi(
    'dm.ev_temperatura_olio',
    (una) => conClasse('temperature')(una) && conParola('olio')(una),
  );
  mazzo.prendi(
    'dm.ev_temperatura_esterna',
    (una) => conClasse('temperature')(una) && conParola('esterna')(una),
  );

  /* Le gomme: prima le quattro ruote per nome, poi quella riepilogativa. */
  for (final (ref, ruota) in _ruote) {
    mazzo.prendi(
      ref,
      (una) =>
          _paroleDellAuto['pneumatici']!.hasMatch(mazzo.parole(una)) &&
          ruota.hasMatch(mazzo.parole(una)),
    );
  }
  mazzo.prendi('dm.ev_pneumatici', conParola('pneumatici'));

  return LegameDellAuto(
    mappa: Map.unmodifiable(mazzo.mappa),
    tipo: motoreDalleCaselle(mazzo.mappa),
  );
}

/// Che auto e', a giudicare da quello che pubblica: il serbatoio da solo dice
/// benzina, il serbatoio con la batteria di trazione dice ibrida. Quando non
/// si capisce si tace — `''` e' «elettrica», che e' il valore di sempre.
String motoreDalleCaselle(Map<String, String> mappa) {
  final serbatoio = _pulito(mappa['dm.ev_carburante']).isNotEmpty;
  final batteria = _pulito(mappa['dm.ev_batteria_auto']).isNotEmpty;
  if (serbatoio && batteria) return 'ibrida';
  if (serbatoio) return 'termica';
  return '';
}

/// Il motore com'e' scritto nel profilo: `termica`, `ibrida`, o niente.
String tipoMotore(Object? valore) {
  final voce = _pulito(valore).toLowerCase();
  return voce == 'termica' || voce == 'ibrida' ? voce : '';
}

/* ─── la colonnina ───────────────────────────────────────────────────────── */

/// Le caselle che appartengono alla colonnina e non alla vettura:
/// `CASELLE_DELLA_WALLBOX`. Si riempiono dall'integrazione, e non se le porta
/// via nessun cambio d'auto.
const caselleDellaWallbox = <String>[
  'dm.ev_potenza_wallbox',
  'dm.ev_energia_wallbox_oggi',
  'dm.ev_energia_wallbox_mese',
  'dm.ev_tensione_wallbox',
  'dm.ev_temperatura_wallbox',
  'dm.ev_modalita_ricarica_evcc',
  'dm.ev_energia_sessione',
  'dm.ev_percentuale_solare_sessione',
  /* Il cavo: e' la colonnina a sapere se e' dentro. */
  'dm.ev_cavo_collegato',
];

/// Se questa casella e' della colonnina, e quindi della casa.
bool eDellaWallbox(String ref) => caselleDellaWallbox.contains(_pulito(ref));

final _comandabile = RegExp(r'^(select|input_select|number|input_number)\.');

/// Il limite di carica e' della casa quando e' quello che comanda: un
/// `number` di evcc non se lo porta via il profilo dell'auto, che lo pubblica
/// come sensore di sola lettura.
bool eTargetDiCasa(String ref, Object? valore) =>
    _pulito(ref) == 'dm.ev_target_soc' &&
    _comandabile.hasMatch(_pulito(valore));

final _paroleDellaColonnina = <String, RegExp>{
  'colonnina': _re(
    r'\b(wallbox|charger|charging station|ladestation|loadpoint|ladepunkt|evse|go-?e|easee|keba|zaptec|openwb|pulsar|wall connector|colonnina)\b',
  ),
  'sessione': _re(
    r'\b(session|sessione|charged energy|geladene energie|energia caricata)\b',
  ),
  'oggi': _re(r'\b(today|oggi|daily|giornaliera|heute|t[äa]glich|hoy)\b'),
  'mese': _re(r'\b(month|mese|monthly|mensile|monat|mes)\b'),
  'sole': _re(
    r'\b(solar|pv|autarky|autarkie|autarchia|self.?consumption|sonne)\b',
  ),
  'modalita': _re(r'\b(mode|modus|modalit[àa]|charge mode|lademodus)\b'),
  'totale': _re(r'\b(total|totale|gesamt|lifetime|cumulat)\b'),
  'target': _re(
    r'\b(limit ?soc|limitsoc|soc ?limit|target ?soc|targetsoc|target|charg\w* ?limit|ladelimit|ladeziel|limite (di )?(ri)?carica)\b',
  ),
  'nonTarget': _re(
    r'\b(effective|vehicle|min(imum)?|plan\w*|phase\w*|current|corrente)\b',
  ),
};

/// Quello che un dispositivo ha lasciato capire di una colonnina.
class LegameDellaWallbox {
  const LegameDellaWallbox({required this.mappa, required this.evcc});

  final Map<String, String> mappa;

  /// Se il dispositivo sembra evcc: porta la modalita' di ricarica, che una
  /// wallbox nuda non ha.
  final bool evcc;
}

/// Le caselle della colonnina che questo dispositivo sa riempire:
/// `legaLaWallboxAlDispositivo`.
LegameDellaWallbox legaLaWallboxAlDispositivo(
  Iterable<DaLeggere> entita, {
  Map<String, Entita>? stato,
}) {
  final mazzo = _Mazzo(entita, stato);
  bool Function(DaLeggere) dice(String chiave) =>
      (una) => _paroleDellaColonnina[chiave]!.hasMatch(mazzo.parole(una));
  final conClasse = mazzo.conClasse;
  final percentuale = mazzo.percentuale;
  bool energia(DaLeggere una) =>
      conClasse('energy')(una) ||
      RegExp('kwh', caseSensitive: false).hasMatch(_unita(una, stato));

  /* La modalita' di ricarica: una tendina che dice di esserlo. Non la PRIMA
   * tendina qualunque: una colonnina ne pubblica anche altre — il blocco del
   * cavo, la scelta delle fasi. */
  mazzo.prendi(
    'dm.ev_modalita_ricarica_evcc',
    (una) =>
        const ['select', 'input_select'].contains(_dominio(una)) &&
        dice('modalita')(una),
  );

  /* La potenza: quella che sta erogando adesso. */
  mazzo.prendi(
    'dm.ev_potenza_wallbox',
    (una) =>
        conClasse('power')(una) &&
        (dice('colonnina')(una) || _dominio(una) == 'sensor'),
  );

  /* Le energie, nell'ordine in cui si distinguono: prima la sessione — che
   * ha una parola sua — poi oggi, poi il mese. */
  mazzo.prendi(
    'dm.ev_energia_sessione',
    (una) => energia(una) && dice('sessione')(una),
  );
  mazzo.prendi(
    'dm.ev_energia_wallbox_oggi',
    (una) => energia(una) && dice('oggi')(una) && !dice('mese')(una),
  );
  mazzo.prendi(
    'dm.ev_energia_wallbox_mese',
    (una) => energia(una) && dice('mese')(una),
  );

  /* La quota di sole della sessione: evcc la pubblica come percentuale. */
  mazzo.prendi(
    'dm.ev_percentuale_solare_sessione',
    (una) => percentuale(una) && dice('sole')(una),
  );

  /* Tensione e temperatura: le dice la classe. */
  mazzo.prendi('dm.ev_tensione_wallbox', conClasse('voltage'));
  mazzo.prendi('dm.ev_temperatura_wallbox', conClasse('temperature'));

  /* Il target di carica, ma solo se si puo' COMANDARE. Un limite e'
   * un'impostazione per definizione, e le integrazioni lo marcano cosi'. */
  mazzo.prendi(
    'dm.ev_target_soc',
    (una) =>
        const [
          'select',
          'input_select',
          'number',
          'input_number',
        ].contains(_dominio(una)) &&
        dice('target')(una) &&
        !dice('nonTarget')(una),
    ancheImpostazioni: true,
  );

  /* Il cavo: il sensore che dice se e' dentro. */
  mazzo.prendi(
    'dm.ev_cavo_collegato',
    (una) =>
        parlaDelCavo(mazzo.parole(una)) &&
        !dice('nonTarget')(una) &&
        (_dominio(una) == 'binary_sensor' ||
            eUnaLettera(stato?[una.id]?.stato)),
  );

  return LegameDellaWallbox(
    mappa: Map.unmodifiable(mazzo.mappa),
    evcc: (mazzo.mappa['dm.ev_modalita_ricarica_evcc'] ?? '').isNotEmpty,
  );
}

/// Le etichette delle caselle della colonnina, per l'anteprima: sono otto e
/// si dicono per intero (`NOMI_WALLBOX`).
const nomiDellaWallbox = <String, String>{
  'dm.ev_potenza_wallbox': 'Potenza',
  'dm.ev_energia_wallbox_oggi': 'Energia oggi',
  'dm.ev_energia_wallbox_mese': 'Energia mese',
  'dm.ev_tensione_wallbox': 'Tensione',
  'dm.ev_temperatura_wallbox': 'Temperatura',
  'dm.ev_modalita_ricarica_evcc': 'Modalita\' di ricarica',
  'dm.ev_energia_sessione': 'Energia della sessione',
  'dm.ev_percentuale_solare_sessione': 'Quota di sole',
  'dm.ev_cavo_collegato': 'Cavo collegato',
};

/// evcc si riconosce dal nome dell'integrazione: il dominio della sua
/// integrazione HACS e' `evcc_intg`, quello di altre `evcc`.
bool eEvcc(String dominio, String nome) =>
    RegExp('evcc', caseSensitive: false).hasMatch('$dominio $nome');

final _colonnine = _re(
  r'\b(wallbox|charger|charging|charge ?point|evse|go-?e|goecharger|easee|keba|zaptec|openwb|pulsar|wall connector|tesla wall|ocpp|myenergi|zappi|smartevse|alfen|webasto|wattpilot|juice|emobility|colonnina|ladestation)\b',
);

/// Una colonnina si riconosce dal nome dell'integrazione: gli otto che si
/// incontrano davvero e le parole con cui si chiamano. Chi ne ha una che qui
/// non c'e' la trova lo stesso: se il filtro non lascia niente si mostrano
/// tutte le integrazioni.
bool eUnaColonnina(String dominio, String nome) =>
    !eEvcc(dominio, nome) &&
    _colonnine.hasMatch('$dominio $nome'.replaceAll('_', ' '));

/// Com'e' andata a mettere la colonnina nelle sostituzioni di casa.
class ColonninaMessa {
  const ColonninaMessa({required this.prossime, required this.tenute});

  /// `cd_entity_overrides` com'e' dopo.
  final Map<String, dynamic> prossime;

  /// Le caselle che erano gia' di un ALTRO dispositivo e sono rimaste sue.
  final List<String> tenute;
}

final _comanda = RegExp(r'^(select|input_select|number|input_number)\.');
final _legge = RegExp(r'^(sensor|binary_sensor)\.');

/// Il secondo dispositivo si aggiunge al primo, non lo scalza: e' la regola di
/// `collegaLaWallbox`. Una casella gia' occupata da un ALTRO dispositivo resta
/// dov'e'; una vuota si riempie; una che porta gia' un'entita' DI QUESTO
/// dispositivo si riscrive. Con un'eccezione: un COMANDO scalza una lettura —
/// il target di carica lo portano in due, l'auto come sensore e evcc come
/// numero, e tenere il sensore vorrebbe dire una tendina che non comanda.
ColonninaMessa mettiLaColonninaNelleSostituzioni(
  Map<String, dynamic> salvate,
  Map<String, String> mappa, {
  required Set<String> sue,
}) {
  final prossime = Map<String, dynamic>.from(salvate);
  final tenute = <String>[];
  for (final voce in mappa.entries) {
    final gia = _pulito(prossime[voce.key]);
    if (gia.isNotEmpty &&
        gia != voce.value &&
        !sue.contains(gia) &&
        !(_comanda.hasMatch(voce.value) && _legge.hasMatch(gia))) {
      tenute.add(voce.key);
      continue;
    }
    prossime[voce.key] = voce.value;
  }
  return ColonninaMessa(prossime: prossime, tenute: tenute);
}

/// Le caselle di casa che un cambio d'auto non deve toccare: quelle della
/// colonnina, e il limite di carica quando e' un comando (`soloLaColonnina`).
Map<String, dynamic> soloLaColonnina(Map<String, dynamic> sostituzioni) => {
  for (final voce in sostituzioni.entries)
    if (_pulito(voce.value).isNotEmpty &&
        (eDellaWallbox(voce.key) || eTargetDiCasa(voce.key, voce.value)))
      voce.key: voce.value,
};

/// Versa le caselle di un'auto nelle sostituzioni di casa — il gesto di
/// «mettere in uso» — tenendo da parte quelle della colonnina.
Map<String, dynamic> versaLAutoNelleSostituzioni(
  Map<String, dynamic> sostituzioni,
  Map<String, String> caselle,
) {
  final colonnina = soloLaColonnina(sostituzioni);
  final prossime = Map<String, dynamic>.from(sostituzioni);
  for (final voce in caselle.entries) {
    if (voce.key.startsWith('dm.ev_') && _pulito(voce.value).isNotEmpty) {
      prossime[voce.key] = voce.value;
    }
  }
  prossime.addAll(colonnina);
  return prossime;
}
