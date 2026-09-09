/// L'indice di ricerca delle entita': lo stesso della plancia, in Dart.
///
/// Non e' un cercatore rifatto a somiglianza. E' il **porto riga per riga** di
/// `ponte/plancia/src/core/entity-search-index.js`, la parte della dashboard
/// che sa due cose:
///
///  - **cercare in fretta** fra tremila entita', ripiegando gli accenti,
///    spezzando in gettoni, e dando piu' peso a un'entita' il cui
///    identificativo comincia con quello che si e' scritto che a una che se lo
///    trova in mezzo al nome;
///  - **indovinare cosa vuole un campo.** «Sensore di temperatura» vuole un
///    `sensor` con `device_class: temperature` e i gradi come unita';
///    «Valvola» vuole un `valve` o uno `switch`. Le regole sono quelle, con
///    le stesse parole italiane e inglesi, ed e' quello che fa comparire la
///    pastiglia «suggerite per questo campo».
///
/// Perche' un porto e non una cosa nuova: chi configura la stessa casa dal
/// browser e dal telefono deve vedere **gli stessi suggerimenti**. Se qui si
/// indovinasse in un altro modo, la stessa casella proporrebbe due cose
/// diverse a seconda di dove la si apre, e sembrerebbe che una delle due
/// sbagli.
///
/// Quando la dashboard cambia quelle regole, questo file va riallineato. La
/// prova `entita_cercate_test.dart` tiene fermi i casi che contano.
library;

import '../entita.dart';

/// Gli stati che non contano: un'entita' che non risponde non e' quasi mai
/// quella che si sta configurando.
const _spente = {'unavailable', 'unknown', 'none', ''};

/// Ripiega un testo: minuscolo, e senza accenti.
///
/// Gli accenti si tolgono perche' chi cerca «temperatura» deve trovare
/// «Temperatura salotto» e anche «Temperatură» di un'integrazione tradotta
/// male, e perche' sulla tastiera del telefono l'accento e' un tasto lungo che
/// nessuno preme mentre cerca.
String ripiega(String? valore) {
  final testo = (valore ?? '').toLowerCase();
  /* Un giro solo sulle lettere, e la stringa nuova si costruisce solo se una
   * lettera accentata c'e' davvero: quasi nessun nome ne ha, e allocare tremila
   * copie per niente e' proprio il costo per entita' che quest'indice esiste
   * per togliere. */
  var dove = -1;
  for (var quale = 0; quale < testo.length; quale += 1) {
    if (_accenti.containsKey(testo[quale])) {
      dove = quale;
      break;
    }
  }
  if (dove < 0) return testo;
  final fuori = StringBuffer(testo.substring(0, dove));
  for (var quale = dove; quale < testo.length; quale += 1) {
    final lettera = testo[quale];
    fuori.write(_accenti[lettera] ?? lettera);
  }
  return fuori.toString();
}

/* La tabella e' corta apposta: sono le lettere accentate che compaiono nei nomi
 * delle entita' di una casa italiana, piu' quelle delle lingue vicine. Dart non
 * ha la normalizzazione Unicode nella libreria di serie, e tirarsi dentro un
 * pacchetto per venti lettere sarebbe sproporzionato. */
const _accenti = {
  'à': 'a',
  'á': 'a',
  'â': 'a',
  'ä': 'a',
  'ã': 'a',
  'å': 'a',
  'è': 'e',
  'é': 'e',
  'ê': 'e',
  'ë': 'e',
  'ì': 'i',
  'í': 'i',
  'î': 'i',
  'ï': 'i',
  'ò': 'o',
  'ó': 'o',
  'ô': 'o',
  'ö': 'o',
  'õ': 'o',
  'ù': 'u',
  'ú': 'u',
  'û': 'u',
  'ü': 'u',
  'ñ': 'n',
  'ç': 'c',
  'ý': 'y',
  'ÿ': 'y',
};

final _separatori = RegExp(r'[^a-z0-9]+');

/// Spezza un testo ripiegato nelle sue parole.
List<String> gettoni(String ripiegato) =>
    ripiegato.split(_separatori).where((uno) => uno.isNotEmpty).toList();

String _iniziali(List<String> quali) {
  final fuori = StringBuffer();
  for (final uno in quali) {
    fuori.write(uno[0]);
  }
  return fuori.toString();
}

/// Un'entita' preparata per essere cercata.
///
/// Tutto quello che serve a cercare si calcola **una volta**, quando l'indice
/// si costruisce: ripiegare tremila nomi a ogni lettera battuta era esattamente
/// il difetto che questo indice e' nato per togliere.
class Cercabile {
  Cercabile._({
    required this.id,
    required this.nome,
    required this.dominio,
    required this.oggetto,
    required this.classe,
    required this.unita,
    required this.stanza,
    required this.stato,
    required this.malus,
    required this.idPiegato,
    required this.oggettoPiegato,
    required this.nomePiegato,
    required this.stanzaPiegata,
    required this.pagliaio,
    required this.gettoniDellId,
    required this.gettoniDelNome,
    required this.gettoniDellaStanza,
    required this.iniziali,
  });

  /// Da un'entita' della casa. `null` se non e' un'entita' vera.
  ///
  /// [stanza] arriva dai registri di Home Assistant (vedi `registro.dart`):
  /// negli stati non c'e', e senza di lei il cercatore non sa dire che
  /// `sensor.0x00124b` sta in cameretta.
  static Cercabile? da(Entita una, {String stanza = ''}) {
    final id = una.id.trim();
    final dove = id.indexOf('.');
    if (dove <= 0) return null;
    final oggetto = id.substring(dove + 1);
    final nome = una.nome.trim().isEmpty ? id : una.nome.trim();
    final laStanza = stanza.trim().isNotEmpty
        ? stanza.trim()
        : '${una.attributi['area'] ?? ''}'.trim();
    final idPiegato = ripiega(id);
    final nomePiegato = ripiega(nome);
    final stanzaPiegata = laStanza.isEmpty ? '' : ripiega(laStanza);
    /* Il dominio non e' una parola dell'entita': contare `sensor.` come tale
     * farebbe combaciare ogni sensore della casa con una casella che nella sua
     * etichetta dice «sensore», e il dominio e' gia' un vincolo suo. */
    final gettoniDelNome = gettoni(nomePiegato);
    return Cercabile._(
      id: id,
      nome: nome,
      dominio: id.substring(0, dove),
      oggetto: oggetto,
      classe: '${una.attributi['device_class'] ?? ''}'.toLowerCase(),
      unita: '${una.attributi['unit_of_measurement'] ?? ''}',
      stanza: laStanza,
      stato: una.stato,
      /* Due malus, tutti e due indipendenti da cosa si cerca: un'entita' che
       * adesso non risponde e' raramente quella che si sta configurando, e fra
       * due che valgono uguale quella con l'identificativo piu' corto e' la
       * piu' specifica. */
      malus:
          (_spente.contains(una.stato.toLowerCase()) ? -80.0 : 0.0) -
          (id.length < 80 ? id.length : 80) * 0.25,
      idPiegato: idPiegato,
      oggettoPiegato: ripiega(oggetto),
      nomePiegato: nomePiegato,
      stanzaPiegata: stanzaPiegata,
      pagliaio: '$idPiegato $nomePiegato $stanzaPiegata',
      gettoniDellId: gettoni(ripiega(oggetto)),
      gettoniDelNome: gettoniDelNome,
      gettoniDellaStanza: stanzaPiegata.isEmpty
          ? const []
          : gettoni(stanzaPiegata),
      iniziali: _iniziali(gettoniDelNome),
    );
  }

  final String id;
  final String nome;
  final String dominio;
  final String oggetto;
  final String classe;
  final String unita;
  final String stanza;
  final String stato;
  final double malus;
  final String idPiegato;
  final String oggettoPiegato;
  final String nomePiegato;
  final String stanzaPiegata;
  final String pagliaio;
  final List<String> gettoniDellId;
  final List<String> gettoniDelNome;
  final List<String> gettoniDellaStanza;
  final String iniziali;

  bool _qualcheGettone(bool Function(String) prova) {
    for (final uno in gettoniDellId) {
      if (prova(uno)) return true;
    }
    for (final uno in gettoniDelNome) {
      if (prova(uno)) return true;
    }
    for (final uno in gettoniDellaStanza) {
      if (prova(uno)) return true;
    }
    return false;
  }
}

/* ─── Cosa vuole un campo ────────────────────────────────────────────────── */

/// Una regola: se il campo dice una di queste parole, vuole cosi'.
class _Regola {
  const _Regola(
    this.parole, {
    this.classi = const [],
    this.unita = const [],
    this.domini = const [],
  });
  final List<String> parole;
  final List<String> classi;
  final List<String> unita;
  final List<String> domini;
}

/* Le parole che una casella usa, e cosa deve essere un'entita' per starci
 * dentro. Sono le stesse della plancia, nello stesso ordine: tenute corte
 * apposta, ogni voce deve descrivere una casella che esiste davvero
 * nell'editor. */
const _regole = <_Regola>[
  _Regola(
    ['temperatura', 'temperature', 'temp', 'termometro', 'sonda'],
    classi: ['temperature'],
    unita: ['°C', '°F'],
    domini: ['sensor'],
  ),
  _Regola(
    ['umidita', 'humidity', 'hum'],
    classi: ['humidity'],
    unita: ['%'],
    domini: ['sensor'],
  ),
  _Regola(
    ['potenza', 'power', 'watt', 'istantanea', 'istantaneo', 'assorbimento'],
    classi: ['power'],
    unita: ['W', 'kW'],
    domini: ['sensor'],
  ),
  _Regola(
    [
      'energia',
      'energy',
      'kwh',
      'consumo',
      'consumi',
      'produzione',
      'prelievo',
      'immissione',
      'prelevata',
      'immessa',
      'acquistata',
      'venduta',
      'giornaliera',
      'mensile',
      'annuale',
    ],
    classi: ['energy'],
    unita: ['kWh', 'Wh', 'MWh'],
    domini: ['sensor'],
  ),
  _Regola(
    ['batteria', 'battery', 'soc', 'carica', 'accumulo'],
    classi: ['battery'],
    unita: ['%'],
    domini: ['sensor'],
  ),
  _Regola(
    ['tensione', 'voltage', 'volt'],
    classi: ['voltage'],
    unita: ['V'],
    domini: ['sensor'],
  ),
  _Regola(
    ['corrente', 'current', 'ampere'],
    classi: ['current'],
    unita: ['A'],
    domini: ['sensor'],
  ),
  _Regola(
    ['pressione', 'pressure'],
    classi: ['pressure', 'atmospheric_pressure'],
    unita: ['bar', 'hPa', 'psi'],
    domini: ['sensor'],
  ),
  _Regola(
    ['illuminamento', 'illuminance', 'lux', 'luminosita'],
    classi: ['illuminance'],
    unita: ['lx'],
    domini: ['sensor'],
  ),
  _Regola(
    ['pioggia', 'rain', 'precipitazioni'],
    classi: ['precipitation', 'precipitation_intensity'],
    unita: ['mm'],
    domini: ['sensor'],
  ),
  _Regola(
    ['vento', 'wind'],
    classi: ['wind_speed'],
    unita: ['km/h', 'm/s'],
    domini: ['sensor'],
  ),
  _Regola(
    ['acqua', 'water', 'portata'],
    classi: ['water'],
    unita: ['L', 'm³'],
    domini: ['sensor'],
  ),
  _Regola(
    ['gas', 'metano'],
    classi: ['gas'],
    unita: ['m³'],
    domini: ['sensor'],
  ),
  _Regola(
    ['prezzo', 'price', 'costo', 'tariffa'],
    classi: ['monetary'],
    unita: ['€', 'EUR', '€/kWh'],
    domini: ['sensor'],
  ),
  /* Una casella per una luce accetta anche un rele': una lampada dietro uno
   * `switch.` si configura nella scheda Luci esattamente come una `light.`, e
   * il cercatore le deve proporre tutte e due — se no quello switch, che e'
   * proprio quello che la casella vuole, non compare mai. */
  _Regola(
    ['luce', 'luci', 'light', 'lampada', 'lampadario', 'faretti', 'led'],
    domini: ['light', 'switch'],
  ),
  _Regola(
    [
      'clima',
      'climate',
      'condizionatore',
      'termostato',
      'termosifone',
      'riscaldamento',
      'hvac',
      'split',
    ],
    domini: ['climate'],
  ),
  _Regola(['telecamera', 'camera', 'videocamera', 'cam'], domini: ['camera']),
  _Regola(
    [
      'tapparella',
      'tapparelle',
      'serranda',
      'serrande',
      'cover',
      'shutter',
      'blind',
      'tenda',
    ],
    domini: ['cover'],
  ),
  _Regola(
    ['presa', 'plug', 'socket', 'interruttore', 'switch', 'relay', 'rele'],
    domini: ['switch', 'input_boolean'],
  ),
  _Regola(
    ['porta', 'door', 'finestra', 'window', 'contatto', 'apertura'],
    classi: ['door', 'window', 'opening', 'garage_door'],
    domini: ['binary_sensor'],
  ),
  _Regola(
    ['movimento', 'motion', 'presenza', 'presence', 'occupancy', 'pir'],
    classi: ['motion', 'occupancy', 'presence'],
    domini: ['binary_sensor'],
  ),
  _Regola(
    ['allagamento', 'leak', 'perdita'],
    classi: ['moisture'],
    domini: ['binary_sensor'],
  ),
  _Regola(['fumo', 'smoke'], classi: ['smoke'], domini: ['binary_sensor']),
  _Regola(['meteo', 'weather', 'previsioni'], domini: ['weather']),
  _Regola(['scena', 'scene'], domini: ['scene']),
  _Regola(['script', 'azione'], domini: ['script']),
  _Regola(['automazione', 'automation'], domini: ['automation']),
  _Regola(['allarme', 'alarm', 'antifurto'], domini: ['alarm_control_panel']),
  _Regola(
    [
      'pompa',
      'pump',
      'irrigazione',
      'irrigation',
      'valvola',
      'valve',
      'elettrovalvola',
    ],
    domini: ['switch', 'valve'],
  ),
  _Regola(['ventilatore', 'fan', 'ventola', 'aspiratore'], domini: ['fan']),
  _Regola(
    ['serratura', 'lock', 'cancello', 'gate', 'garage'],
    classi: ['garage', 'door'],
    domini: ['lock', 'cover'],
  ),
];

/* Parole che in un'etichetta non dicono niente su cosa vuole la casella. */
const _paroleVuote = {
  'entita',
  'entity',
  'id',
  'sensore',
  'sensor',
  'seleziona',
  'scegli',
  'campo',
  'opzionale',
  'oppure',
  'esempio',
  'the',
  'and',
  'for',
  'del',
  'della',
  'delle',
  'dei',
  'con',
  'per',
  'nel',
  'una',
  'uno',
  'che',
  'lo',
  'la',
  'il',
  'di',
  'da',
};

/// I domini che si riconoscono dentro un testo, per esempio in `sensor.qualcosa`.
const dominiNoti = {
  'sensor',
  'binary_sensor',
  'switch',
  'light',
  'cover',
  'climate',
  'camera',
  'weather',
  'automation',
  'script',
  'scene',
  'select',
  'number',
  'fan',
  'lock',
  'vacuum',
  'media_player',
  'water_heater',
  'valve',
  'button',
  'person',
  'device_tracker',
  'alarm_control_panel',
  'sun',
  'input_boolean',
  'input_number',
  'input_select',
  'input_text',
  'input_datetime',
  'counter',
  'humidifier',
};

final _unDominio = RegExp(r'\b([a-z_]+)\.');
final _unUnita = RegExp(
  r'\((w|kw|wh|kwh|mwh|v|a|%|°c|°f|bar|lx|mm|m3|km/h|m/s)\)',
  caseSensitive: false,
);
const _unitaPerBene = {
  'w': 'W',
  'kw': 'kW',
  'wh': 'Wh',
  'kwh': 'kWh',
  'mwh': 'MWh',
  'v': 'V',
  'a': 'A',
  '%': '%',
  '°c': '°C',
  '°f': '°F',
  'bar': 'bar',
  'lx': 'lx',
  'mm': 'mm',
  'm3': 'm³',
  'km/h': 'km/h',
  'm/s': 'm/s',
};

/// Cosa si e' capito che vuole una casella.
class CosaVuole {
  const CosaVuole({
    required this.domini,
    required this.classi,
    required this.unita,
    required this.parole,
    required this.stanza,
    required this.adesso,
  });

  const CosaVuole.niente()
    : domini = const {},
      classi = const {},
      unita = const {},
      parole = const [],
      stanza = '',
      adesso = '';

  final Set<String> domini;
  final Set<String> classi;
  final Set<String> unita;
  final List<String> parole;
  final String stanza;

  /// Quello che c'e' scritto adesso nella casella: si mette in cima, che
  /// riaprire un campo gia' pieno e non ritrovarci dentro quello che c'era e'
  /// il modo piu' rapido di cambiarlo per sbaglio.
  final String adesso;

  bool get vuoto =>
      domini.isEmpty && classi.isEmpty && unita.isEmpty && parole.isEmpty;
}

/// Legge una casella e capisce cosa vuole, da come e' descritta.
///
/// [chiave] e' il riferimento della casella (`dm.energy_potenza_batteria`),
/// [etichetta] quello che c'e' scritto sopra, [domini] i domini che chi chiama
/// sa gia', [adesso] quello che la casella contiene.
CosaVuole cosaVuole({
  String chiave = '',
  String etichetta = '',
  String suggerimento = '',
  List<String> domini = const [],
  String adesso = '',
  String stanza = '',
}) {
  final iDomini = <String>{};
  final leClassi = <String>{};
  final leUnita = <String>{};
  final leParole = <String>[];

  for (final uno in domini) {
    if (dominiNoti.contains(uno)) iDomini.add(uno);
  }
  final testo = ripiega(
    [
      chiave,
      suggerimento,
      etichetta,
      adesso,
    ].where((uno) => uno.isNotEmpty).join(' '),
  );
  for (final trovato in _unDominio.allMatches(testo)) {
    final quale = trovato.group(1)!;
    if (dominiNoti.contains(quale)) iDomini.add(quale);
  }

  final unita = _unUnita.firstMatch(testo);
  if (unita != null) {
    final perBene = _unitaPerBene[unita.group(1)!.toLowerCase()];
    if (perBene != null) leUnita.add(perBene);
  }

  final parole = gettoni(testo)
      .where(
        (una) =>
            una.length >= 3 &&
            !_paroleVuote.contains(una) &&
            !dominiNoti.contains(una),
      )
      .toList();
  for (final regola in _regole) {
    final ce = regola.parole.any(
      (parola) => parole.any(
        (quale) =>
            quale == parola || (parola.length >= 4 && quale.startsWith(parola)),
      ),
    );
    if (!ce) continue;
    iDomini.addAll(regola.domini);
    leClassi.addAll(regola.classi);
    leUnita.addAll(regola.unita);
  }
  for (final una in parole) {
    if (leParole.length >= 6) break;
    if (!leParole.contains(una)) leParole.add(una);
  }

  return CosaVuole(
    domini: iDomini,
    classi: leClassi,
    unita: leUnita,
    parole: leParole,
    stanza: ripiega(stanza),
    adesso: adesso.contains('.') ? adesso : '',
  );
}

/* ─── I punteggi ─────────────────────────────────────────────────────────── */

/// Quanto un'entita' somiglia a quello che la casella vuole, e se lo somiglia
/// **forte** — cioe' se merita la pastiglia «suggerita».
({double punti, bool forte}) quantoCentra(Cercabile una, CosaVuole vuole) {
  if (vuole.vuoto) return (punti: 0, forte: false);
  var punti = 0.0;
  var forte = false;
  if (vuole.domini.isNotEmpty) {
    punti += vuole.domini.contains(una.dominio) ? 150 : -35;
  }
  if (vuole.classi.isNotEmpty &&
      una.classe.isNotEmpty &&
      vuole.classi.contains(una.classe)) {
    punti += 110;
    forte = true;
  }
  if (vuole.unita.isNotEmpty && una.unita.isNotEmpty) {
    if (vuole.unita.contains(una.unita)) {
      punti += 70;
      forte = true;
    } else {
      punti -= 20;
    }
  }
  if (vuole.stanza.isNotEmpty &&
      una.stanzaPiegata.isNotEmpty &&
      una.stanzaPiegata == vuole.stanza) {
    punti += 45;
    forte = true;
  }
  var quante = 0;
  for (final parola in vuole.parole) {
    if (quante >= 3) break;
    if (una._qualcheGettone(
      (gettone) =>
          gettone == parola ||
          (parola.length >= 4 && gettone.startsWith(parola)),
    )) {
      punti += 28;
      quante += 1;
      forte = true;
    }
  }
  /* Una casella che sa il suo dominio non la accontenta un'altra: una luce che
   * ha per caso il nome della stanza non e' un sensore di temperatura, e
   * darle la pastiglia farebbe perdere di senso la pastiglia. */
  if (forte && vuole.domini.isNotEmpty && !vuole.domini.contains(una.dominio)) {
    forte = false;
  }
  return (punti: punti, forte: forte);
}

/// Quanto vale una parola cercata su un'entita'. Negativo vuol dire «non c'e'».
double _quantoVale(Cercabile una, String parola) {
  if (!una.pagliaio.contains(parola)) {
    return parola.length >= 2 && una.iniziali.contains(parola) ? 18 : -1;
  }
  if (una.idPiegato.startsWith(parola)) return 100;
  if (una.oggettoPiegato.startsWith(parola)) return 92;
  if (una.nomePiegato.startsWith(parola)) return 88;
  if (una._qualcheGettone((gettone) => gettone.startsWith(parola))) return 70;
  if (una.idPiegato.contains(parola)) return 40;
  if (una.nomePiegato.contains(parola)) return 34;
  if (una.stanzaPiegata.isNotEmpty && una.stanzaPiegata.contains(parola)) {
    return 26;
  }
  if (parola.length >= 2 && una.iniziali.contains(parola)) return 18;
  return -1;
}

/// Quello che si sta cercando, spezzato.
class Cercato {
  Cercato(String scritto)
    : piegato = ripiega(scritto).trim().replaceAll(RegExp(r'\s+'), ' '),
      parole = ripiega(scritto)
          .trim()
          .replaceAll(RegExp(r'\s+'), ' ')
          .split(' ')
          .where((una) => una.isNotEmpty)
          .toList();

  final String piegato;
  final List<String> parole;
  bool get vuoto => parole.isEmpty;
}

/// Il punteggio di un'entita' per quello che si e' scritto, senza i
/// suggerimenti. `null` quando una parola non combacia per niente: combaciare
/// e ordinare sono lo stesso giro sulle stringhe gia' pronte.
double? puntiDelCercato(Cercabile una, Cercato cosa) {
  var punti = una.malus;
  for (final parola in cosa.parole) {
    final vale = _quantoVale(una, parola);
    if (vale < 0) return null;
    punti += vale;
  }
  if (cosa.parole.length > 1 && una.idPiegato.contains(cosa.piegato)) {
    punti += 30;
  }
  if (cosa.piegato.isNotEmpty && una.idPiegato == cosa.piegato) punti += 400;
  return punti;
}

/// Il punteggio intero, suggerimenti compresi.
double? puntiInTutto(Cercabile una, Cercato cosa, CosaVuole vuole) {
  final base = puntiDelCercato(una, cosa);
  if (base == null) return null;
  return base +
      quantoCentra(una, vuole).punti +
      (vuole.adesso.isNotEmpty && una.id == vuole.adesso ? 220 : 0);
}

/// Un'entita' trovata, col suo posto in classifica.
class Trovata {
  const Trovata(this.una, this.punti, {required this.suggerita});
  final Cercabile una;
  final double punti;

  /// Merita la pastiglia: non e' solo del dominio giusto — e' proprio quella
  /// che la casella sta chiedendo.
  final bool suggerita;
}

/// Cerca, ordina e restituisce. E' il giro intero, quello che la maschera
/// chiama a ogni lettera battuta.
List<Trovata> cerca(
  List<Cercabile> dove, {
  String scritto = '',
  CosaVuole vuole = const CosaVuole.niente(),
  String? soloIlDominio,
  bool soloLeSuggerite = false,
}) {
  final cosa = Cercato(scritto);
  final fuori = <Trovata>[];
  for (final una in dove) {
    if (soloIlDominio != null && una.dominio != soloIlDominio) continue;
    final centra = quantoCentra(una, vuole);
    if (soloLeSuggerite && !centra.forte) continue;
    final base = puntiDelCercato(una, cosa);
    if (base == null) continue;
    fuori.add(
      Trovata(
        una,
        base +
            centra.punti +
            (vuole.adesso.isNotEmpty && una.id == vuole.adesso ? 220 : 0),
        suggerita: centra.forte,
      ),
    );
  }
  fuori.sort((prima, dopo) {
    final quanto = dopo.punti.compareTo(prima.punti);
    /* A pari punteggio, in ordine di identificativo: due liste che cambiano
     * ordine fra una lettera e l'altra si leggono come una lista che salta. */
    return quanto != 0 ? quanto : prima.una.id.compareTo(dopo.una.id);
  });
  return fuori;
}
