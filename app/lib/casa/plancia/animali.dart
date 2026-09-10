/// Gli animali di casa (#358): il porto in Dart di `core/animali-model.js`.
///
/// Un animale non e' un apparecchio: e' un nome, una foto e un pugno di cose
/// che lo riguardano sparse su piu' dispositivi — il distributore del cibo,
/// la lettiera, la fontanella, la porta col microchip, il collare. Le
/// integrazioni che le portano sono tante e nessuna parla come le altre:
/// PetKit chiama «food level» il cibo, SurePetcare pubblica un `binary_sensor`
/// che dice dentro o fuori, Tractive un `device_tracker` e una batteria.
///
/// Qui sta la parte che ragiona, e ragiona sugli stessi indizi della plancia:
/// dato un dispositivo con le sue entita', dire quale fa da livello del cibo
/// e quale da ultima pulizia della lettiera. Deve restare il porto fedele del
/// modello della plancia: se qui si indovinasse in un altro modo, lo stesso
/// distributore verrebbe configurato in due modi diversi a seconda di dove lo
/// si tocca.
library;

import '../catalogo/catalogo.dart';
import '../entita.dart';

/// La chiave in cui vive la configurazione degli animali.
const chiaveDegliAnimali = 'cd_animali';

/// Un tetto alle schede: dodici animali sono gia' un canile.
const massimoAnimali = 12;

String _pulito(Object? valore) => '${valore ?? ''}'.trim();
String _minuscolo(Object? valore) => _pulito(valore).toLowerCase();
final _separatori = RegExp(r'[_\-./]+');

/* ── le specie ─────────────────────────────────────────────────────────── */

/// Le specie che si sanno riconoscere: la chiave, il simbolo e la parola.
const leSpecie = <(String, String, String)>[
  ('gatto', '🐱', 'Gatto'),
  ('cane', '🐶', 'Cane'),
  ('altro', '🐾', 'Altro'),
];

/// La specie con quella chiave, o l'ultima («altro») se non si conosce.
(String, String, String) specieDiSerie(Object? chiave) {
  final voluta = _pulito(chiave);
  for (final una in leSpecie) {
    if (una.$1 == voluta) return una;
  }
  return leSpecie.last;
}

final _indiziDiSpecie = <(String, RegExp)>[
  ('cane', RegExp(r'cane\b|cani\b|dog\b|dogs\b|hund|chien|perro|cagnol|puppy')),
  (
    'gatto',
    RegExp(
      r'gatt|cat\b|cats\b|feline|katze|chat\b|micio|kitty|litter|lettiera',
    ),
  ),
];

/// Che bestia e', letto da come si chiamano il dispositivo e le sue entita'.
String specieDalNome(Object? testo) {
  final parole = ' ${_minuscolo(testo).replaceAll(_separatori, ' ')} ';
  for (final (chiave, indizio) in _indiziDiSpecie) {
    if (indizio.hasMatch(parole)) return chiave;
  }
  return 'altro';
}

/* ── le caselle di un animale ──────────────────────────────────────────── */

/// Una casella che si **legge**: dove puo' vivere, quali parole la
/// riconoscono, a che gruppo appartiene sulla scheda.
///
/// L'ordine e' quello in cui si assegnano: un'entita' presa da una casella non
/// viene piu' offerta alle successive, e le caselle piu' strette stanno prima.
class CasellaDellAnimale {
  const CasellaDellAnimale(
    this.chiave,
    this.gruppo, {
    required this.domini,
    required this.deve,
    required this.etichetta,
    required this.esempio,
    this.poi,
    this.maNon,
    this.classe = '',
    this.numero = false,
    this.giorni = false,
    this.guasto = false,
    this.spiega,
  });

  final String chiave;
  final String gruppo;
  final List<String> domini;
  final RegExp deve;
  final RegExp? poi;
  final RegExp? maNon;

  /// La `device_class` che l'entita' deve avere, se serve.
  final String classe;

  /// Una quota: si disegna come barra, non come parola.
  final bool numero;

  /// Contata in giorni: l'essiccante, il deodorante.
  final bool giorni;

  /// Un si'/no che dice «c'e' un problema».
  final bool guasto;

  /// Come si chiama nella Config, e l'esempio in grigio.
  final String etichetta;
  final String esempio;
  final String? spiega;
}

/// Le sedici caselle, nell'ordine della plancia.
final leCaselleDellAnimale = <CasellaDellAnimale>[
  CasellaDellAnimale(
    'cibo_livello',
    'ciotola',
    domini: const ['sensor'],
    numero: true,
    deve: RegExp(
      r'food|cibo|crocchett|kibble|feed|hopper|granul|futter|nourriture',
    ),
    poi: RegExp(
      r'level|livell|left|remain|riman|percent|stock|quantit|amount|residu|storage|serbatoi',
    ),
    etichetta: 'Livello del cibo',
    esempio: 'sensor.petkit_food_level',
    spiega: 'Quanto cibo resta nel distributore, in percentuale',
  ),
  CasellaDellAnimale(
    'cibo_ultima',
    'ciotola',
    domini: const ['sensor'],
    deve: RegExp(r'food|cibo|feed|erogaz|pasto|meal|dispens'),
    poi: RegExp(r'last|ultim|previous|timestamp|when'),
    etichetta: 'Ultima erogazione',
    esempio: 'sensor.petkit_last_feed',
  ),
  CasellaDellAnimale(
    'cibo_porzioni',
    'ciotola',
    domini: const ['sensor'],
    deve: RegExp(
      r'portion|porzion|dispens|erogat|eaten|mangiat|ration|serving|feeding|pasti',
    ),
    etichetta: 'Porzioni erogate',
    esempio: 'sensor.petkit_portions_today',
  ),
  /* La sabbia che RESTA, e il cassetto che si RIEMPIE: due numeri che si
   * somigliano e vogliono dire il contrario (#373). La sabbia sta prima
   * perche' e' la piu' stretta. */
  CasellaDellAnimale(
    'lettiera_sabbia',
    'lettiera',
    domini: const ['sensor'],
    numero: true,
    deve: RegExp(r'sand|sabbia|litter|lettiera'),
    poi: RegExp(r'level|livell|left|remain|riman|percent|residu|quantit|stock'),
    maNon: RegExp(r'waste|rifiut|drawer|cassett|deodor|bin\b|trash|garbage'),
    etichetta: 'Sabbia rimasta (si svuota)',
    esempio: 'sensor.petkit_litter_level',
    spiega:
        'Quanta sabbia resta: avvisa da sotto. Non e\' il cassetto dei '
        'rifiuti, che invece si riempie',
  ),
  CasellaDellAnimale(
    'lettiera_riempimento',
    'lettiera',
    domini: const ['sensor'],
    numero: true,
    deve: RegExp(r'waste|rifiut|drawer|cassett|litter|lettiera'),
    poi: RegExp(r'level|livell|percent|full|pien|weight|peso|capacit|riempim'),
    maNon: RegExp(r'sand|sabbia|deodor'),
    etichetta: 'Cassetto dei rifiuti (si riempie)',
    esempio: 'sensor.litter_robot_waste_drawer',
  ),
  CasellaDellAnimale(
    'lettiera_ultima',
    'lettiera',
    domini: const ['sensor'],
    deve: RegExp(r'litter|lettiera|clean|puliz|scoop|cycle|ciclo|toilet'),
    poi: RegExp(r'last|ultim|previous|timestamp|when'),
    etichetta: 'Ultima pulizia della lettiera',
    esempio: 'sensor.litter_robot_last_seen',
    spiega: 'Da questa si conta da quanto e\' da pulire',
  ),
  CasellaDellAnimale(
    'lettiera_visite',
    'lettiera',
    domini: const ['sensor'],
    deve: RegExp(
      r'visit|visite|uses|usage|utilizz|times|conteggi|count|entries|ingressi',
    ),
    etichetta: 'Visite alla lettiera',
    esempio: 'sensor.litter_robot_uses_today',
  ),
  CasellaDellAnimale(
    'lettiera_deodorante',
    'lettiera',
    domini: const ['sensor'],
    numero: true,
    giorni: true,
    deve: RegExp(r'deodor|odor|freshener|profum|purific'),
    maNon: RegExp(r'reset|azzera'),
    etichetta: 'Deodorante — giorni rimasti',
    esempio: 'sensor.petkit_deodorant_days',
    spiega: 'Un consumabile con la scadenza: si conta in giorni',
  ),
  CasellaDellAnimale(
    'lettiera_cestino',
    'lettiera',
    domini: const ['binary_sensor'],
    guasto: true,
    deve: RegExp(r'waste|rifiut|bin\b|cestin|trash|garbage|sacchett|bag\b|box'),
    etichetta: 'Cestino dei rifiuti (problema si\'/no)',
    esempio: 'binary_sensor.petkit_waste_bin',
    spiega: 'Un si\'/no che dice quando sostituire il sacco',
  ),
  CasellaDellAnimale(
    'acqua_filtro',
    'acqua',
    domini: const ['sensor'],
    numero: true,
    deve: RegExp(r'filter|filtro|cartucc|cartridge'),
    etichetta: 'Filtro della fontanella',
    esempio: 'sensor.fontanella_filtro',
    spiega: 'Quanto resta del filtro, in percentuale',
  ),
  CasellaDellAnimale(
    'acqua_livello',
    'acqua',
    domini: const ['sensor'],
    numero: true,
    deve: RegExp(r'water|acqua|fountain|fontanel|drink|bever|abbevera'),
    poi: RegExp(
      r'level|livell|left|remain|riman|percent|quantit|residu|serbatoi',
    ),
    etichetta: 'Livello dell\'acqua',
    esempio: 'sensor.fontanella_acqua',
  ),
  CasellaDellAnimale(
    'porta',
    'porta',
    domini: const ['binary_sensor', 'device_tracker', 'sensor'],
    deve: RegExp(
      r'inside|outside|dentro|fuori|indoor|outdoor|flap|door|gattaiol|presence|presenza|location|posizion',
    ),
    etichetta: 'Porta col microchip',
    esempio: 'binary_sensor.micio_dentro',
    spiega: 'Dice se e\' dentro o fuori',
  ),
  CasellaDellAnimale(
    'collare_batteria',
    'collare',
    domini: const ['sensor'],
    numero: true,
    classe: 'battery',
    deve: RegExp(r'batter|carica|charge|akku'),
    etichetta: 'Batteria del collare',
    esempio: 'sensor.tractive_batteria',
  ),
  CasellaDellAnimale(
    'collare_posizione',
    'collare',
    domini: const ['device_tracker'],
    deve: RegExp('.'),
    etichetta: 'Posizione del collare',
    esempio: 'device_tracker.tractive_micio',
  ),
  CasellaDellAnimale(
    'cibo_essiccante',
    'ciotola',
    domini: const ['sensor'],
    numero: true,
    giorni: true,
    deve: RegExp(r'desiccant|essiccant|dry(er|ing)?\b|deumidif|silica|assorb'),
    maNon: RegExp(r'reset|azzera'),
    etichetta: 'Essiccante — giorni rimasti',
    esempio: 'sensor.petkit_desiccant_days',
    spiega: 'Un consumabile con la scadenza: si conta in giorni',
  ),
  CasellaDellAnimale(
    'peso',
    'animale',
    domini: const ['sensor'],
    classe: 'weight',
    deve: RegExp(r'weight|peso|gewicht|poids'),
    etichetta: 'Peso dell\'animale',
    esempio: 'sensor.micio_peso',
  ),
];

/// Un tasto: quello che si puo' **chiedere** a un dispositivo (#373).
///
/// Sta in un elenco a parte e non fra le caselle perche' non e' la stessa
/// cosa: una casella si legge, un tasto si preme.
class AzioneDellAnimale {
  const AzioneDellAnimale(
    this.chiave,
    this.gruppo, {
    required this.glifo,
    required this.domini,
    required this.deve,
    required this.etichetta,
    required this.esempio,
    this.poi,
    this.maNon,
  });

  final String chiave;
  final String gruppo;
  final String glifo;
  final List<String> domini;
  final RegExp deve;
  final RegExp? poi;
  final RegExp? maNon;
  final String etichetta;
  final String esempio;
}

/// Le sette azioni, nell'ordine della plancia.
final leAzioniDellAnimale = <AzioneDellAnimale>[
  AzioneDellAnimale(
    'cibo_eroga',
    'ciotola',
    glifo: '🍽️',
    domini: const ['button', 'script', 'switch'],
    deve: RegExp(r'feed|eroga|dispens|porzion|portion|pasto|meal|snack|manual'),
    maNon: RegExp(r'reset|azzera|desiccant|essiccant'),
    etichetta: 'Eroga una porzione',
    esempio: 'button.petkit_manual_feed',
  ),
  AzioneDellAnimale(
    'cibo_essiccante_reset',
    'ciotola',
    glifo: '♻️',
    domini: const ['button'],
    deve: RegExp(r'desiccant|essiccant|dry(er|ing)?\b|silica|deumidif'),
    poi: RegExp(r'reset|azzera|replace|sostitu|cambi'),
    etichetta: 'Azzera l\'essiccante',
    esempio: 'button.petkit_reset_desiccant',
  ),
  AzioneDellAnimale(
    'lettiera_pulisci',
    'lettiera',
    glifo: '🧹',
    domini: const ['button', 'script', 'switch'],
    deve: RegExp(r'clean|puliz|scoop|cycle|ciclo'),
    maNon: RegExp(r'reset|azzera|deodor|maintenance|manutenz'),
    etichetta: 'Pulisci la lettiera',
    esempio: 'button.litter_robot_clean',
  ),
  AzioneDellAnimale(
    'lettiera_livella',
    'lettiera',
    glifo: '🪄',
    domini: const ['button', 'script', 'switch'],
    deve: RegExp(r'level(l)?ing|livell|spiana|flatten|even'),
    etichetta: 'Livella la sabbia',
    esempio: 'button.petkit_level_litter',
  ),
  /* La manutenzione e' DUE tasti e non uno: «petkit li espone cosi'». */
  AzioneDellAnimale(
    'lettiera_manutenzione_avvia',
    'lettiera',
    glifo: '🛠️',
    domini: const ['button', 'script', 'switch'],
    deve: RegExp(r'maintenance|manutenz'),
    maNon: RegExp(r'exit|esci|end|fine|stop|quit|termina'),
    etichetta: 'Entra in manutenzione',
    esempio: 'button.petkit_start_maintenance',
  ),
  AzioneDellAnimale(
    'lettiera_manutenzione_esci',
    'lettiera',
    glifo: '🚪',
    domini: const ['button', 'script', 'switch'],
    deve: RegExp(r'maintenance|manutenz'),
    poi: RegExp(r'exit|esci|end|fine|stop|quit|termina'),
    etichetta: 'Esci dalla manutenzione',
    esempio: 'button.petkit_exit_maintenance',
  ),
  AzioneDellAnimale(
    'lettiera_deodorante_reset',
    'lettiera',
    glifo: '♻️',
    domini: const ['button'],
    deve: RegExp(r'deodor|odor|freshener|profum|purific'),
    poi: RegExp(r'reset|azzera|replace|sostitu|cambi'),
    etichetta: 'Azzera il deodorante',
    esempio: 'button.petkit_reset_deodorant',
  ),
];

/// Le chiavi delle caselle e delle azioni, nell'ordine.
final chiaviDelleCaselle = [for (final una in leCaselleDellAnimale) una.chiave];
final chiaviDelleAzioni = [for (final una in leAzioniDellAnimale) una.chiave];

/// I gruppi della scheda, con le parole della Config della plancia.
const gruppiDellAnimale = <(String, String)>[
  ('ciotola', '🍽️ Ciotola e distributore'),
  ('lettiera', '🚽 Lettiera'),
  ('acqua', '💧 Acqua'),
  ('porta', '🚪 Porta col microchip'),
  ('collare', '📡 Collare'),
  ('animale', '🐾 L\'animale'),
];

/// Come si preme un tasto, dal dominio dell'entita': dominio e servizio, o
/// `null` se non e' un'entita' che si preme.
(String, String)? pressioneDellAzione(Object? entita) {
  final id = _pulito(entita);
  final punto = id.indexOf('.');
  if (punto <= 0) return null;
  final dominio = id.substring(0, punto).toLowerCase();
  if (dominio == 'button' || dominio == 'input_button') {
    return (dominio, 'press');
  }
  if (const [
    'script',
    'switch',
    'scene',
    'automation',
    'input_boolean',
  ].contains(dominio)) {
    return (dominio, 'turn_on');
  }
  return null;
}

/* ── le soglie ─────────────────────────────────────────────────────────── */

/// Le soglie oltre le quali la scheda alza la voce, quando nessuno le ha
/// cambiate. Sono di casa, non di laboratorio.
const soglieDiSerie = <String, num>{
  'cibo': 20,
  'acqua': 20,
  'filtro': 10,
  'lettiera': 80,
  'sabbia': 20,
  'lettiera_ore': 24,
  'giorni': 7,
  'collare': 20,
};

/// Come si chiama ogni soglia nella Config della plancia.
const etichetteDelleSoglie = <(String, String)>[
  ('cibo', 'Avvisa sotto il cibo (%)'),
  ('acqua', 'Avvisa sotto l\'acqua (%)'),
  ('filtro', 'Avvisa sotto il filtro (%)'),
  ('lettiera', 'Avvisa sopra il cassetto dei rifiuti (%)'),
  ('sabbia', 'Avvisa sotto la sabbia (%)'),
  ('lettiera_ore', 'Lettiera da pulire dopo (ore)'),
  ('giorni', 'Avvisa sotto i giorni rimasti'),
  ('collare', 'Avvisa sotto il collare (%)'),
];

num? _numero(Object? valore) {
  if (valore is num) return valore.isFinite ? valore : null;
  return num.tryParse('${valore ?? ''}'.trim().replaceAll(',', '.'));
}

/// Una soglia scritta a mano: un numero, oppure niente e vale quella di
/// serie. Un numero negativo non e' una soglia.
num sogliaScritta(Object? valore, num difetto) {
  final letto = _numero(valore);
  if (letto == null || letto < 0) return difetto;
  return letto;
}

/* ── la configurazione ─────────────────────────────────────────────────── */

/// Un animale ripulito, con **tutte** le sue chiavi nell'ordine della
/// plancia: e' cosi' che `normalizzaAnimale` lo scrive, e scriverlo uguale
/// vuol dire che un salvataggio dall'app e uno dal browser sono lo stesso
/// salvataggio.
Map<String, dynamic> normalizzaAnimale(Object? input, [int indice = 0]) {
  final grezzo = input is Map
      ? Map<String, dynamic>.from(input)
      : <String, dynamic>{};
  final animale = <String, dynamic>{
    'id': _pulito(grezzo['id']).isNotEmpty
        ? _pulito(grezzo['id'])
        : 'animale-${indice + 1}',
    'nome': _pulito(grezzo['nome'] ?? grezzo['name']),
    'specie': specieDiSerie(grezzo['specie'] ?? grezzo['species']).$1,
    'foto': _pulito(grezzo['foto'] ?? grezzo['photo']),
    'stanza': _pulito(grezzo['stanza'] ?? grezzo['room'] ?? grezzo['room_id']),
    'nascosto': grezzo['nascosto'] == true,
  };
  for (final chiave in chiaviDelleCaselle) {
    animale[chiave] = _pulito(grezzo[chiave]);
  }
  for (final chiave in chiaviDelleAzioni) {
    animale[chiave] = _pulito(grezzo[chiave]);
  }
  /* Chi aveva la sabbia nella casella del cassetto se la ritrova al posto
   * suo: il verso lo dice l'entita' stessa. */
  final riempimento = '${animale['lettiera_riempimento']}';
  if (riempimento.isNotEmpty && '${animale['lettiera_sabbia']}'.isEmpty) {
    final nome = _minuscolo(riempimento).replaceAll(_separatori, ' ');
    if (!RegExp(r'waste|rifiut|drawer|cassett').hasMatch(nome) &&
        RegExp(r'sand|sabbia|litter|lettiera').hasMatch(nome)) {
      animale['lettiera_sabbia'] = riempimento;
      animale['lettiera_riempimento'] = '';
    }
  }
  final soglieScritte = grezzo['soglie'] is Map
      ? Map<String, dynamic>.from(grezzo['soglie'] as Map)
      : const <String, dynamic>{};
  animale['soglie'] = {
    for (final voce in soglieDiSerie.entries)
      voce.key: sogliaScritta(soglieScritte[voce.key], voce.value),
  };
  /* I dispositivi collegati: un animale ne ha spesso piu' d'uno, e ognuno
   * arriva da un giro suo del menu delle integrazioni. */
  final dispositivi = grezzo['dispositivi'];
  animale['dispositivi'] = [
    for (final voce in (dispositivi is List ? dispositivi : const []))
      if (voce is Map && _pulito(voce['id']).isNotEmpty)
        {
          'id': _pulito(voce['id']),
          'nome': _pulito(voce['nome'] ?? voce['name']),
          'integrazione': _pulito(voce['integrazione'] ?? voce['integration']),
          'integrazione_nome': _pulito(
            voce['integrazione_nome'] ?? voce['integration_name'],
          ),
          'marca': _pulito(voce['marca'] ?? voce['manufacturer']),
          'modello': _pulito(voce['modello'] ?? voce['model']),
        },
  ];
  return animale;
}

/// L'elenco degli animali, senza doppioni di identificativo e non piu' di
/// dodici. Un animale appena aggiunto, senza caselle, resta: buttarlo via
/// vorrebbe dire che premere «Aggiungi» non fa niente.
List<Map<String, dynamic>> normalizzaAnimali(Object? input) {
  final elenco = input is List
      ? input
      : input is Map
      ? [input]
      : const [];
  final visti = <String>{};
  final fuori = <Map<String, dynamic>>[];
  for (final (indice, voce) in elenco.indexed) {
    final animale = normalizzaAnimale(voce, indice);
    var id = '${animale['id']}';
    var scarto = 2;
    while (visti.contains(id)) {
      id = '${animale['id']}-${scarto++}';
    }
    visti.add(id);
    fuori.add({...animale, 'id': id});
    if (fuori.length >= massimoAnimali) break;
  }
  return fuori;
}

/// Se un animale ha una scheda da mostrare: un nome, o almeno una casella.
bool animaleDisegnabile(Map<String, dynamic> animale) =>
    animale['nascosto'] != true &&
    ('${animale['nome'] ?? ''}'.isNotEmpty ||
        chiaviDelleCaselle.any(
          (chiave) => '${animale[chiave] ?? ''}'.trim().isNotEmpty,
        ));

/// Se questa riga ha qualcosa: il nome, o un'entita' in una casella
/// qualunque. E' la regola con cui la plancia rifiuta di salvare una riga
/// vuota.
bool animaleConQualcosa(Map<String, dynamic> animale) =>
    '${animale['nome'] ?? ''}'.trim().isNotEmpty ||
    [
      ...chiaviDelleCaselle,
      ...chiaviDelleAzioni,
    ].any((chiave) => '${animale[chiave] ?? ''}'.trim().isNotEmpty);

/* ── il legame con un dispositivo ──────────────────────────────────────── */

/// Le parole con cui un'entita' si presenta: id, nome, chiave di traduzione,
/// nome che ha in casa.
String _paroleDi(EntitaDelDispositivo voce, Entita? Function(String) stato) {
  final inCasa = stato(voce.id);
  return _minuscolo(
    [
      voce.id,
      voce.nome,
      voce.chiaveDiTraduzione,
      '${inCasa?.attributi['friendly_name'] ?? ''}',
    ].map(_pulito).join(' ').replaceAll(_separatori, ' '),
  );
}

String _dominioDi(EntitaDelDispositivo voce) =>
    _pulito(voce.id).split('.').first;

String _classeDi(EntitaDelDispositivo voce, Entita? Function(String) stato) =>
    _minuscolo(
      voce.classe.isNotEmpty
          ? voce.classe
          : stato(voce.id)?.attributi['device_class'],
    );

/// Propone, casella per casella, l'entita' del dispositivo che la riempie.
///
/// Restituisce solo le caselle trovate. Un'entita' serve una casella sola; a
/// pari merito vince quella con l'id piu' corto, che di solito e' la piu'
/// semplice — «food_level» prima di «food_level_warning». Le entita' di
/// configurazione e diagnostica non riempiono una casella che si legge, ma
/// un tasto si': su un Petkit «reset essiccante» e' un `button` marcato
/// `config`, e resta un comando.
Map<String, String> proponiLeCaselleDellAnimale(
  List<EntitaDelDispositivo> entita, {
  required Entita? Function(String id) stato,
}) {
  final tutte = [
    for (final una in entita)
      if (!una.spenta && _pulito(una.id).contains('.')) una,
  ];
  final daLeggere = [
    for (final una in tutte)
      if (!const ['config', 'diagnostic'].contains(_minuscolo(una.categoria)))
        una,
  ];
  final presi = <String>{};
  final proposta = <String, String>{};
  EntitaDelDispositivo? scegli(
    List<EntitaDelDispositivo> fra,
    List<String> domini,
    String classe,
    RegExp deve,
    RegExp? poi,
    RegExp? maNon,
  ) {
    final buone = [
      for (final voce in fra)
        if (!presi.contains(_pulito(voce.id)) &&
            domini.contains(_dominioDi(voce)) &&
            (classe.isEmpty || _classeDi(voce, stato) == classe))
          if (_vaBene(_paroleDi(voce, stato), deve, poi, maNon)) voce,
    ]..sort((a, b) => _pulito(a.id).length.compareTo(_pulito(b.id).length));
    return buone.isEmpty ? null : buone.first;
  }

  for (final campo in leCaselleDellAnimale) {
    final scelta = scegli(
      daLeggere,
      campo.domini,
      campo.classe,
      campo.deve,
      campo.poi,
      campo.maNon,
    );
    if (scelta == null) continue;
    presi.add(_pulito(scelta.id));
    proposta[campo.chiave] = _pulito(scelta.id);
  }
  for (final azione in leAzioniDellAnimale) {
    final scelta = scegli(
      tutte,
      azione.domini,
      '',
      azione.deve,
      azione.poi,
      azione.maNon,
    );
    if (scelta == null) continue;
    presi.add(_pulito(scelta.id));
    proposta[azione.chiave] = _pulito(scelta.id);
  }
  return proposta;
}

bool _vaBene(String parole, RegExp deve, RegExp? poi, RegExp? maNon) {
  if (!deve.hasMatch(parole)) return false;
  if (poi != null && !poi.hasMatch(parole)) return false;
  return maNon == null || !maNon.hasMatch(parole);
}

/// Cosa e' successo collegando un dispositivo: l'animale com'e' adesso e le
/// caselle riempite.
class AnimaleCollegato {
  const AnimaleCollegato(this.animale, this.riempite);
  final Map<String, dynamic> animale;
  final List<String> riempite;
}

/// Collega un animale a un dispositivo: scrive il legame e riempie le caselle
/// rimaste vuote, senza toccare quello che chi configura ha gia' scritto.
///
/// Collegarne un secondo si somma al primo invece di sostituirlo: le cose di
/// un animale stanno su piu' dispositivi.
AnimaleCollegato collegaAnimaleAlDispositivo({
  required Dispositivo dispositivo,
  required List<EntitaDelDispositivo> entita,
  required Entita? Function(String id) stato,
  String nomeDellIntegrazione = '',
  int indice = 0,
  Map<String, dynamic>? precedente,
}) {
  final animale = normalizzaAnimale(precedente ?? const {}, indice);
  final proposta = proponiLeCaselleDellAnimale(entita, stato: stato);
  final riempite = <String>[];
  for (final voce in proposta.entries) {
    if ('${animale[voce.key] ?? ''}'.isNotEmpty) continue;
    animale[voce.key] = voce.value;
    riempite.add(voce.key);
  }
  if ('${animale['nome']}'.isEmpty) animale['nome'] = _pulito(dispositivo.nome);
  final specie = specieDalNome(
    [
      dispositivo.nome,
      dispositivo.modello,
      dispositivo.marca,
      for (final una in entita) una.id,
    ].map(_pulito).join(' '),
  );
  if (animale['specie'] == 'altro' && specie != 'altro') {
    animale['specie'] = specie;
  }
  final id = _pulito(dispositivo.id);
  final dispositivi = List<Map<String, dynamic>>.from(
    (animale['dispositivi'] as List).cast<Map<String, dynamic>>(),
  );
  if (id.isNotEmpty && !dispositivi.any((voce) => voce['id'] == id)) {
    dispositivi.add({
      'id': id,
      'nome': _pulito(dispositivo.nome),
      'integrazione': _pulito(dispositivo.integrazione),
      'integrazione_nome': _pulito(nomeDellIntegrazione).isNotEmpty
          ? _pulito(nomeDellIntegrazione)
          : _pulito(dispositivo.integrazione),
      'marca': _pulito(dispositivo.marca),
      'modello': _pulito(dispositivo.modello),
    });
    animale['dispositivi'] = dispositivi;
  }
  return AnimaleCollegato(animale, riempite);
}
