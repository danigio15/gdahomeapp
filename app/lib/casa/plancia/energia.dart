/// Il modello dell'energia: la famiglia piu' grossa della Config.
///
/// La pagina Energia non e' una fila di caselle come le altre: e' un
/// **modello** (`cd_energy_model`) con quattro gruppi — la casa, la rete, il
/// solare, la batteria — piu' il raffreddamento dell'inverter, le tariffe e
/// **piu' impianti**, che e' la cosa che nell'app non c'era.
///
/// E ogni casella sta in due posti insieme: dentro il modello, sotto il suo
/// percorso (`solar.power`), e fra le sostituzioni della casa, sotto la sua
/// chiave (`dm.energy_potenza_fotovoltaico`). Non e' un doppione per
/// distrazione: il modello e' quello che leggono i moduli nuovi, le chiavi
/// quelle che legge il runtime vecchio, e una configurazione scritta in un
/// posto solo si vede a meta'. La corrispondenza sta in `ENERGY_SLOT_MAP`
/// dentro `core/energy-projection.js`, ed e' quella qui sotto.
library;

import 'segno.dart';

/// Dove va ogni casella dell'energia: percorso nel modello → chiave fra le
/// sostituzioni. Copiata da `ENERGY_SLOT_MAP`, comprese le cinque del
/// raffreddamento, che li' arrivano da `COOLING_SLOT_MAP`.
const caselleDellEnergia = <String, String>{
  'cooling.inverter_ac_temperature': 'dm.energy_temperatura_ac_inverter',
  'cooling.inverter_dc_temperature': 'dm.energy_temperatura_dc_inverter',
  'cooling.battery_temperature': 'dm.energy_temperatura_batteria',
  'cooling.fan_power': 'dm.energy_potenza_ventola_inverter',
  'cooling.fan_switch': 'dm.energy_interruttore_ventola_inverter',
  'house.power': 'dm.energy_potenza_consumo_casa',
  'house.daily_energy': 'dm.energy_consumo_casa_oggi',
  'house.monthly_energy': 'dm.energy_consumo_casa_mese',
  'house.annual_energy': 'dm.energy_consumo_casa_anno',
  'house.total_energy': 'dm.core_043',
  'grid.power': 'dm.energy_potenza_scambio_rete',
  'grid.daily_import_energy': 'dm.energy_energia_prelevata_oggi',
  'grid.daily_export_energy': 'dm.energy_energia_immessa_oggi',
  'grid.monthly_import_energy': 'dm.energy_rete_acquistata_mese',
  'grid.monthly_export_energy': 'dm.energy_rete_venduta_mese',
  'grid.annual_import_energy': 'dm.energy_rete_acquistata_anno',
  'grid.annual_export_energy': 'dm.energy_rete_venduta_anno',
  'grid.total_import_energy': 'dm.core_045',
  'grid.total_export_energy': 'dm.core_044',
  'solar.power': 'dm.energy_potenza_fotovoltaico',
  'solar.daily_energy': 'dm.energy_produzione_solare_oggi',
  'solar.monthly_energy': 'dm.energy_produzione_solare_mese',
  'solar.annual_energy': 'dm.energy_produzione_solare_anno',
  'solar.total_energy': 'dm.core_046',
  'battery.power': 'dm.energy_potenza_batteria',
  'battery.soc': 'dm.energy_stato_carica_batteria',
  'battery.daily_charged_energy': 'dm.energy_batteria_caricata_oggi',
  'battery.monthly_charged_energy': 'dm.energy_batteria_caricata_mese',
  'battery.annual_charged_energy': 'dm.energy_batteria_caricata_anno',
  'battery.daily_discharged_energy': 'dm.energy_batteria_scaricata_oggi',
  'battery.monthly_discharged_energy': 'dm.energy_batteria_usata_mese',
  'battery.annual_discharged_energy': 'dm.energy_batteria_usata_anno',
  'battery.total_charged_energy': 'dm.core_041',
  'battery.total_discharged_energy': 'dm.core_042',
};

/// Un gruppo del modello, con le sue caselle e come si chiamano.
class GruppoDellEnergia {
  const GruppoDellEnergia(this.chiave, this.nome, this.sotto, this.caselle);

  /// `house`, `grid`, `solar`, `battery`, `cooling`.
  final String chiave;
  final String nome;
  final String sotto;

  /// Il campo dentro il gruppo, e come si chiama.
  final List<(String, String)> caselle;

  /// Il percorso della casella nel modello: `solar.power`.
  String percorsoDi(String campo) => '$chiave.$campo';
}

/// I gruppi, coi nomi che usa la Config della plancia.
const gruppiDellEnergia = <GruppoDellEnergia>[
  GruppoDellEnergia('solar', 'Solare', 'Quello che produci', [
    ('power', 'Potenza adesso (W)'),
    ('daily_energy', 'Prodotta oggi (kWh)'),
    ('monthly_energy', 'Prodotta questo mese (kWh)'),
    ('annual_energy', 'Prodotta quest\'anno (kWh)'),
    ('total_energy', 'Prodotta da sempre (kWh)'),
  ]),
  GruppoDellEnergia('house', 'Casa', 'Quello che consumi', [
    ('power', 'Potenza adesso (W)'),
    ('daily_energy', 'Consumata oggi (kWh)'),
    ('monthly_energy', 'Consumata questo mese (kWh)'),
    ('annual_energy', 'Consumata quest\'anno (kWh)'),
    ('total_energy', 'Consumata da sempre (kWh)'),
  ]),
  GruppoDellEnergia('grid', 'Rete', 'Quello che prendi e quello che dai', [
    ('power', 'Scambio adesso (W)'),
    ('daily_import_energy', 'Presa oggi (kWh)'),
    ('daily_export_energy', 'Data oggi (kWh)'),
    ('monthly_import_energy', 'Presa questo mese (kWh)'),
    ('monthly_export_energy', 'Data questo mese (kWh)'),
    ('annual_import_energy', 'Presa quest\'anno (kWh)'),
    ('annual_export_energy', 'Data quest\'anno (kWh)'),
    ('total_import_energy', 'Presa da sempre (kWh)'),
    ('total_export_energy', 'Data da sempre (kWh)'),
  ]),
  GruppoDellEnergia('battery', 'Batteria', 'L\'accumulo, se ce l\'hai', [
    ('soc', 'Carica (%)'),
    ('power', 'Potenza adesso (W)'),
    ('daily_charged_energy', 'Caricata oggi (kWh)'),
    ('daily_discharged_energy', 'Scaricata oggi (kWh)'),
    ('monthly_charged_energy', 'Caricata questo mese (kWh)'),
    ('monthly_discharged_energy', 'Scaricata questo mese (kWh)'),
    ('annual_charged_energy', 'Caricata quest\'anno (kWh)'),
    ('annual_discharged_energy', 'Scaricata quest\'anno (kWh)'),
    ('total_charged_energy', 'Caricata da sempre (kWh)'),
    ('total_discharged_energy', 'Scaricata da sempre (kWh)'),
  ]),
  GruppoDellEnergia(
    'cooling',
    'Raffreddamento',
    'Le temperature dell\'inverter e la sua ventola',
    [
      ('inverter_dc_temperature', 'Temperatura DC (°C)'),
      ('inverter_ac_temperature', 'Temperatura AC (°C)'),
      ('battery_temperature', 'Temperatura batteria (°C)'),
      ('fan_power', 'Potenza della ventola (W)'),
      ('fan_switch', 'Interruttore della ventola'),
    ],
  ),
];

/* ─────────────────────── piu' di un impianto ─────────────────────────────
 *
 * «Io ho una casa che e' l'unione di due appartamenti, quindi ho 2 misuratori
 * di consumo nei due appartamenti e ogni appartamento ha i rispettivi
 * carichi.»
 *
 * E' la cosa che l'utente ha chiesto per nome — «non si possono inserire piu'
 * impianti elettrici» — ed e' lo stesso modello della plancia
 * (`core/energy-plants.js`), con la sua regola davanti a tutte: **non si
 * sposta niente**. L'impianto che c'e' gia' resta esattamente dov'e', al primo
 * livello di `cd_energy_model`, con le chiavi che il runtime legge da sempre.
 * Chi ha una casa sola non migra un bel niente. Gli altri stanno in un elenco
 * accanto, sotto `plants`.
 *
 * E la seconda regola, che nasce da come sono andate le auto: **l'id di un
 * impianto non e' il suo nome**. Nasce una volta, non si ricalcola, non si
 * riusa. Rinominare «Casa Giovanni» in «Casa di sopra» non tocca l'id, e
 * quello che a quell'id e' appeso — carichi, tariffa, storico — resta appeso.
 */

/// L'id del primo impianto non e' scelto: e' quello, sempre.
///
/// Serve a due cose. Chi ha una casa sola e non ha mai visto questa schermata
/// ha comunque un impianto con un id, senza che nessuno glielo abbia scritto.
/// E le chiavi di runtime del primo impianto restano quelle di sempre —
/// `cd_costo_kwh` e non `cd_costo_kwh_qualcosa` — cosi' lo storico di chi
/// c'era prima non riparte da zero.
const primoImpianto = 'impianto';

/// I quattro gruppi di cui un impianto e' fatto. Il raffreddamento no: quello
/// e' della casa, non dell'impianto, e sta al primo livello del modello.
const gruppiDellImpianto = ['house', 'grid', 'solar', 'battery'];

/// Dove resta scritto il numero piu' alto mai distribuito.
const campoDelSegno = 'plant_seq';

/// Dove si tiene l'impianto che si sta guardando.
///
/// Non e' configurazione: e' l'ultima linguetta toccata, come il periodo
/// scelto o la stanza aperta. Sta fuori dal modello apposta — cambiarla non
/// deve sporcare quello che si salva.
const chiaveDellImpiantoScelto = 'cd_energy_plant';

/// Un impianto: il suo nome, il suo id, e i suoi quattro gruppi di sensori.
class Impianto {
  Impianto(this.dentro);

  /// Normalizza quello che c'e' scritto. L'id non si inventa dal nome: se
  /// manca, il primo prende quello di sempre e gli altri il loro numero
  /// d'ordine — ma un impianto nato da [nuovoImpianto] un id ce l'ha gia', e
  /// quello resta.
  factory Impianto.da(dynamic letto, [int quale = 0]) {
    final base = letto is Map
        ? Map<String, dynamic>.from(letto)
        : <String, dynamic>{};
    final id = '${base['id'] ?? ''}'.trim();
    final dentro = <String, dynamic>{
      'id': id.isNotEmpty
          ? id
          : (quale == 0 ? primoImpianto : '$primoImpianto-${quale + 1}'),
      'name': '${base['name'] ?? ''}'.trim(),
      'metadata': base['metadata'] is Map
          ? Map<String, dynamic>.from(base['metadata'] as Map)
          : <String, dynamic>{},
    };
    for (final gruppo in gruppiDellImpianto) {
      dentro[gruppo] = base[gruppo] is Map
          ? Map<String, dynamic>.from(base[gruppo] as Map)
          : <String, dynamic>{};
    }
    return Impianto(dentro);
  }

  /// Un impianto nuovo, vuoto, con un id che non e' mai stato di nessuno.
  factory Impianto.nuovo(
    List<Impianto> elenco, {
    String nome = '',
    Map<String, dynamic> metadata = const {},
  }) => Impianto.da({
    'id': prossimoIdentificativo<Impianto>(
      elenco: elenco,
      metadata: metadata,
      prefisso: primoImpianto,
      identificativo: (uno) => uno.id,
      campoSegno: campoDelSegno,
      minimo: 1,
    ),
    'name': nome.trim(),
  }, 1);

  final Map<String, dynamic> dentro;

  String get id => '${dentro['id'] ?? ''}'.trim();

  String get nome => '${dentro['name'] ?? ''}'.trim();

  set nome(String quale) => dentro['name'] = quale.trim();

  Map<String, dynamic> get metadata => dentro['metadata'] is Map
      ? Map<String, dynamic>.from(dentro['metadata'] as Map)
      : <String, dynamic>{};

  /// Se in questo impianto e' stata scritta almeno una entita'.
  bool get configurato {
    for (final gruppo in gruppiDellImpianto) {
      final dove = dentro[gruppo];
      if (dove is! Map) continue;
      for (final valore in dove.values) {
        if ('${valore ?? ''}'.trim().isNotEmpty) return true;
      }
    }
    return false;
  }

  /// Come si chiama quando chi l'ha fatto non gli ha dato un nome.
  String comeSiChiama(int quale, [String senzaNome = 'Impianto']) =>
      nome.isNotEmpty
      ? nome
      : (quale == 0 ? senzaNome : '$senzaNome ${quale + 1}');
}

/// Tutti gli impianti, il primo per primo.
///
/// Il primo sta in cima all'oggetto salvato — dove il runtime lo cerca — e gli
/// altri nell'elenco `plants` accanto. Una configurazione scritta gia' come
/// elenco (un'esportazione, un ripristino da un'altra plancia) non deve
/// perdere il primo impianto: qui si riconosce e si riporta nella forma buona.
List<Impianto> elencoDegliImpianti(dynamic salvato) {
  if (salvato is List) {
    return [
      for (final (quale, uno) in salvato.indexed) Impianto.da(uno, quale),
    ];
  }
  final base = salvato is Map
      ? Map<String, dynamic>.from(salvato)
      : <String, dynamic>{};
  final altri = base['plants'] is List ? base['plants'] as List : const [];
  return [
    Impianto.da(base, 0),
    for (final (quale, uno) in altri.indexed) Impianto.da(uno, quale + 1),
  ];
}

/// Gli impianti che vale la pena disegnare, con l'indice che avevano.
///
/// Se non ne e' configurato nessuno resta il primo: una plancia appena
/// installata deve poter mostrare la sua pagina vuota, non nessuna pagina.
List<(int, Impianto)> impiantiConfigurati(dynamic salvato) {
  final tutti = elencoDegliImpianti(salvato).indexed.toList();
  final scritti = tutti.where((uno) => uno.$2.configurato).toList();
  return scritti.isNotEmpty ? scritti : tutti.take(1).toList();
}

/// L'impianto scelto, o il primo che c'e'.
Impianto? scegliLImpianto(List<Impianto> elenco, String scelto) {
  final id = scelto.trim();
  for (final uno in elenco) {
    if (uno.id == id) return uno;
  }
  return elenco.isEmpty ? null : elenco.first;
}

/// Dove si tiene, per QUESTO impianto, una cosa che prima era una sola.
///
/// La tariffa, le viste, i contatori: il primo impianto continua a usare la
/// chiave di sempre, cosi' chi c'era prima non perde niente; gli altri hanno
/// la loro, col loro id attaccato.
String chiaveDellImpianto(String base, Impianto? impianto, int quale) {
  final id = impianto?.id ?? '';
  if (quale == 0 || id.isEmpty || id == primoImpianto) return base;
  return '${base}_$id';
}

/* ─────────────────────── come si vede in Home ────────────────────────────
 *
 * «Ho fatto due impianti diversi avendo due appartamenti uniti con due
 * contatori separati. Tutto bene nella sezione energia ma il widget in Home
 * page e' solo quello del primo impianto.»
 *
 * Di serie la somma — e' quello che una Home dice — e chi vuole il dettaglio
 * ce l'ha in un tocco. Con un impianto solo non c'e' niente da scegliere.
 */

/// Come si vuole vedere l'energia in Home.
const chiaveDelleTessere = 'cd_energia_tessere';
const tesseraSomma = 'somma';
const tesseraPerImpianto = 'una-per-impianto';

String comeSiVedeLEnergia(dynamic salvato) =>
    '${salvato ?? ''}'.trim() == tesseraPerImpianto
    ? tesseraPerImpianto
    : tesseraSomma;

/// Il modello dell'energia, come lo tiene la plancia.
///
/// Tiene la mappa grezza: quello che questo modello non conosce — e la plancia
/// si' — resta dov'e' invece di sparire alla prima riscrittura.
class ModelloDellEnergia {
  ModelloDellEnergia(this.dentro);

  factory ModelloDellEnergia.da(dynamic letto) {
    final grezzo = letto is Map
        ? Map<String, dynamic>.from(letto)
        : <String, dynamic>{};
    /* I quattro gruppi ci sono sempre, anche vuoti: e' come li scrive
     * `migrateEnergy`, e chi legge non deve controllarli uno per uno. */
    for (final quale in [...gruppiDellImpianto, 'metadata']) {
      grezzo[quale] = grezzo[quale] is Map
          ? Map<String, dynamic>.from(grezzo[quale] as Map)
          : <String, dynamic>{};
    }
    if (grezzo['cooling'] is Map) {
      grezzo['cooling'] = Map<String, dynamic>.from(grezzo['cooling'] as Map);
    }
    return ModelloDellEnergia(grezzo);
  }

  final Map<String, dynamic> dentro;

  List<Impianto>? _impianti;

  /// Gli impianti: **piu' di uno**, ed e' quello che nell'app non c'era.
  ///
  /// Si leggono una volta e restano quelli: se ogni domanda ne rifacesse di
  /// nuovi, scrivere una casella dentro `modello.impianti.first` scriverebbe
  /// dentro una copia buttata via un istante dopo — e la configurazione di
  /// qualcuno sparirebbe senza che niente lo dica.
  List<Impianto> get impianti => _impianti ??= elencoDegliImpianti(dentro);

  /// Rimette gli impianti nella forma che il runtime sa gia' leggere.
  ///
  /// Quello che non appartiene agli impianti — una chiave aggiunta da una
  /// versione futura — resta dov'e': riscrivere l'oggetto da zero vorrebbe
  /// dire buttare via cio' che non si conosce.
  void mettiGliImpianti(List<Impianto> elenco) {
    final impianti = [
      for (final (quale, uno) in elenco.indexed) Impianto.da(uno.dentro, quale),
    ];
    dentro.remove('plants');
    for (final gruppo in gruppiDellImpianto) {
      dentro.remove(gruppo);
    }
    if (impianti.isNotEmpty) {
      final primo = impianti.first;
      dentro['id'] = primo.id;
      dentro['name'] = primo.nome;
      dentro['metadata'] = primo.metadata;
      for (final gruppo in gruppiDellImpianto) {
        dentro[gruppo] = primo.dentro[gruppo];
      }
    }
    if (impianti.length > 1) {
      dentro['plants'] = [for (final uno in impianti.skip(1)) uno.dentro];
    }
    /* Il segno sale e non scende mai, nemmeno quando un impianto viene
     * cancellato: e' cio' che impedisce a un id di tornare buono una seconda
     * volta, con addosso quello che apparteneva a chi non c'e' piu'. */
    final annotato = <String, dynamic>{
      if (dentro['metadata'] is Map)
        ...Map<String, dynamic>.from(dentro['metadata'] as Map),
    };
    annotato[campoDelSegno] = segnoPiuAlto<Impianto>(
      elenco: impianti,
      metadata: annotato,
      prefisso: primoImpianto,
      identificativo: (uno) => uno.id,
      campoSegno: campoDelSegno,
      minimo: 1,
    );
    dentro['metadata'] = annotato;
    /* Scritti gli impianti, quelli tenuti da parte non valgono piu': la
     * prossima domanda li rilegge da quello che c'e' davvero scritto. */
    _impianti = null;
  }

  /// La configurazione vista da un impianto.
  ///
  /// Si sostituiscono i quattro gruppi e nient'altro: i metadati, il
  /// raffreddamento, e una chiave scritta da una versione futura restano dove
  /// sono. E' la forma che legge la proiezione — e cambiare impianto cambia
  /// quali sensori legge tutto il resto.
  Map<String, dynamic> modelloDellImpianto(Impianto? impianto) {
    if (impianto == null) return Map<String, dynamic>.from(dentro);
    return {
      ...dentro,
      for (final gruppo in gruppiDellImpianto) gruppo: impianto.dentro[gruppo],
    };
  }

  /// Cosa c'e' scritto in una casella di questo impianto, dal suo percorso.
  ///
  /// Il raffreddamento non appartiene a un impianto — e' l'inverter di casa —
  /// e si legge dal primo livello del modello anche quando gli impianti sono
  /// due.
  String casella(String percorso, {Impianto? impianto}) {
    final pezzi = percorso.split('.');
    if (pezzi.length != 2) return '';
    final dove = gruppiDellImpianto.contains(pezzi.first) && impianto != null
        ? impianto.dentro[pezzi.first]
        : dentro[pezzi.first];
    if (dove is! Map) return '';
    return '${dove[pezzi.last] ?? ''}'.trim();
  }

  /// Scrive una casella. Vuota la toglie, e toglie il gruppo se resta vuoto —
  /// tranne i quattro che la plancia vuole sempre.
  void mettiLaCasella(String percorso, String quale, {Impianto? impianto}) {
    final pezzi = percorso.split('.');
    if (pezzi.length != 2) return;
    final suo = gruppiDellImpianto.contains(pezzi.first) && impianto != null;
    final casa = suo ? impianto.dentro : dentro;
    final gruppo = casa[pezzi.first] is Map
        ? Map<String, dynamic>.from(casa[pezzi.first] as Map)
        : <String, dynamic>{};
    if (quale.trim().isEmpty) {
      gruppo.remove(pezzi.last);
    } else {
      gruppo[pezzi.last] = quale.trim();
    }
    final sempre = {...gruppiDellImpianto, 'metadata'};
    if (gruppo.isEmpty && !sempre.contains(pezzi.first)) {
      casa.remove(pezzi.first);
    } else {
      casa[pezzi.first] = gruppo;
    }
  }

  /// Il prezzo dell'energia presa dalla rete puo' essere **un'entita'** invece
  /// di un numero fisso: chi ha una tariffa oraria la legge da li'.
  String get entitaDelPrezzo {
    final tariffe = dentro['rates'];
    return tariffe is Map ? '${tariffe['import_entity'] ?? ''}'.trim() : '';
  }

  set entitaDelPrezzo(String quale) {
    if (quale.trim().isEmpty) {
      dentro.remove('rates');
    } else {
      dentro['rates'] = {'import_entity': quale.trim()};
    }
  }

  /// Quante caselle sono riempite, su quante ce ne sono, per un impianto.
  (int piene, int tutte) quante([Impianto? impianto]) {
    var piene = 0;
    for (final percorso in caselleDellEnergia.keys) {
      if (casella(percorso, impianto: impianto).isNotEmpty) piene += 1;
    }
    return (piene, caselleDellEnergia.length);
  }
}

/* ────────────── i carichi, che adesso appartengono a un impianto ─────────── */

/// Il campo con cui un carico dice a che impianto appartiene.
///
/// Vuoto vuol dire il primo, sempre. Non e' una svista: e' cio' che permette a
/// otto carichi gia' configurati di restare dove sono senza che nessuno li
/// tocchi, il giorno in cui questo campo compare.
const campoDellImpianto = 'plant';

/// Se questo carico appartiene a questo impianto.
bool caricoDellImpianto(
  Map<String, dynamic> carico,
  Impianto? impianto,
  int quale,
) {
  final scritto = '${carico[campoDellImpianto] ?? ''}'.trim();
  if (scritto.isEmpty) return quale == 0 || impianto?.id == primoImpianto;
  return scritto == (impianto?.id ?? '');
}

/// I carichi di un impianto, nell'ordine in cui stavano.
List<Map<String, dynamic>> carichiDellImpianto(
  List<Map<String, dynamic>> carichi,
  Impianto? impianto,
  int quale,
) => [
  for (final uno in carichi)
    if (caricoDellImpianto(uno, impianto, quale)) uno,
];

/// I carichi che restano quando un impianto se ne va: nessuno dei suoi.
///
/// Cancellando la casa restavano li': orfani, invisibili in ogni flusso perche'
/// il loro impianto non esisteva piu', e pronti a riapparire tutti insieme il
/// giorno in cui un impianto nuovo avesse ripreso quell'id. Per questo gli id
/// non si riutilizzano, e per questo qui si cancella davvero.
List<Map<String, dynamic>> senzaICarichiDellImpianto(
  List<Map<String, dynamic>> carichi,
  String id,
) {
  final quale = id.trim();
  if (quale.isEmpty || quale == primoImpianto) return [...carichi];
  return [
    for (final uno in carichi)
      if ('${uno[campoDellImpianto] ?? ''}'.trim() != quale) uno,
  ];
}

/* ─────────────────── dal modello alle caselle storiche ──────────────────── */

/// I contatori di sempre, e i periodi che si ricavano da loro.
///
/// Chi ha un solo contatore totale non deve compilare oggi, mese e anno: la
/// plancia li ricava da quello. Ma se un periodo e' scritto a mano, quello
/// vince — e il totale smette di fare da sostituto per lui.
const _totaliCheFannoDaPeriodo = <String, Map<String, String>>{
  'house.total_energy': {
    'daily_energy': 'dm.energy_consumo_casa_oggi',
    'monthly_energy': 'dm.energy_consumo_casa_mese',
    'annual_energy': 'dm.energy_consumo_casa_anno',
  },
  'grid.total_import_energy': {
    'daily_import_energy': 'dm.energy_energia_prelevata_oggi',
    'monthly_import_energy': 'dm.energy_rete_acquistata_mese',
    'annual_import_energy': 'dm.energy_rete_acquistata_anno',
  },
  'grid.total_export_energy': {
    'daily_export_energy': 'dm.energy_energia_immessa_oggi',
    'monthly_export_energy': 'dm.energy_rete_venduta_mese',
    'annual_export_energy': 'dm.energy_rete_venduta_anno',
  },
  'solar.total_energy': {
    'daily_energy': 'dm.energy_produzione_solare_oggi',
    'monthly_energy': 'dm.energy_produzione_solare_mese',
    'annual_energy': 'dm.energy_produzione_solare_anno',
  },
  'battery.total_charged_energy': {
    'daily_charged_energy': 'dm.energy_batteria_caricata_oggi',
    'monthly_charged_energy': 'dm.energy_batteria_caricata_mese',
    'annual_charged_energy': 'dm.energy_batteria_caricata_anno',
  },
  'battery.total_discharged_energy': {
    'daily_discharged_energy': 'dm.energy_batteria_scaricata_oggi',
    'monthly_discharged_energy': 'dm.energy_batteria_usata_mese',
    'annual_discharged_energy': 'dm.energy_batteria_usata_anno',
  },
};

/// Le sostituzioni ricavate dal modello.
///
/// Una configurazione dell'energia sta in due posti insieme: nel modello, che
/// leggono i moduli nuovi, e fra le sostituzioni (`cd_entity_overrides`), che
/// legge il runtime storico. **Non e' un doppione per distrazione**: scritta in
/// un posto solo si vede a meta'. Qui il secondo posto si ricava dal primo, che
/// e' come fa la plancia in `projectEnergySlots` — cosi' non ci sono due
/// verita' che possono discordare.
///
/// [modello] e' quello dell'impianto che si sta guardando: cambiare impianto
/// cambia quali sensori legge tutto il resto.
Map<String, dynamic> proiezioneDellEnergia(
  Map<String, dynamic> modello,
  Map<String, dynamic> sostituzioni,
) {
  final fuori = Map<String, dynamic>.from(sostituzioni);
  String dentro(String gruppo, String campo) {
    final dove = modello[gruppo];
    return dove is Map ? '${dove[campo] ?? ''}'.trim() : '';
  }

  for (final percorso in caselleDellEnergia.keys) {
    if (_totaliCheFannoDaPeriodo.containsKey(percorso)) continue;
    final pezzi = percorso.split('.');
    final valore = dentro(pezzi.first, pezzi.last);
    final casella = caselleDellEnergia[percorso]!;
    if (valore.isNotEmpty) {
      fuori[casella] = valore;
    } else {
      fuori.remove(casella);
    }
  }
  for (final MapEntry(key: percorso, value: periodi)
      in _totaliCheFannoDaPeriodo.entries) {
    final pezzi = percorso.split('.');
    final totale = dentro(pezzi.first, pezzi.last);
    final casellaDelTotale = caselleDellEnergia[percorso]!;
    final serve = periodi.keys.any(
      (campo) => dentro(pezzi.first, campo).isEmpty,
    );
    if (totale.isNotEmpty && serve) {
      fuori[casellaDelTotale] = totale;
    } else {
      fuori.remove(casellaDelTotale);
    }
    for (final MapEntry(key: campo, value: casella) in periodi.entries) {
      final scritto = dentro(pezzi.first, campo);
      if (scritto.isNotEmpty) {
        fuori[casella] = scritto;
      } else {
        fuori.remove(casella);
      }
    }
  }
  return fuori;
}

/* ────────────────────── quali viste dell'Energia si vedono ──────────────── */

/// Le cinque linguette della pagina Energia, e come si chiamano.
///
/// Chi non ha la batteria non ha niente da vedere in «Temperature», e chi
/// guarda solo la bolletta non vuole la mappa dei flussi: si spengono. E'
/// `cdEnList` del runtime, con la stessa regola di lettura — **quello che non
/// e' scritto `false` e' acceso** — cosi' una plancia che questa chiave non
/// l'ha mai vista le mostra tutte, come ha sempre fatto.
const chiaveDelleViste = 'cd_energy_views';

const vistaDellEnergia = <(String, String, String)>[
  ('ist', '⚡', 'Istantanea (mappa dei flussi)'),
  ('day', '📅', 'Giornaliera'),
  ('month', '📆', 'Mensile'),
  ('panoramica', '📊', 'Report (elettrodomestici e analisi)'),
  ('temp', '🌡️', 'Temperature dell\'inverter'),
];

bool laVistaSiVede(Map<String, dynamic> viste, String quale) =>
    viste[quale] != false;

/// Lo stesso oggetto, con una vista accesa o spenta.
///
/// Accesa si **toglie** invece di scriverla `true`: e' come la scrive il
/// runtime, e tiene la chiave piccola — con cinque viste tutte accese non c'e'
/// niente da salvare.
Map<String, dynamic> conLaVista(
  Map<String, dynamic> viste,
  String quale,
  bool accesa,
) {
  final dopo = Map<String, dynamic>.from(viste);
  if (accesa) {
    dopo.remove(quale);
  } else {
    dopo[quale] = false;
  }
  return dopo;
}
