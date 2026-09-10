/// Il caldo: la caldaia, e le cose che scaldano oltre ai termosifoni.
///
/// La caldaia sta in una chiave sua e non fra quelle del solare: sono
/// un'altra macchina, e mescolarle vorrebbe dire una scheda in cui meta' dei
/// campi non riguarda chi la sta compilando.
library;

const chiaveDellaCaldaia = 'cd_caldaia';

/// Cosa si guarda di una caldaia, e in che ordine.
///
/// Mandata e ritorno prima di tutto: la differenza fra i due dice se
/// l'impianto sta cedendo calore o sta girando a vuoto, ed e' la ragione per
/// cui si apre questa pagina. La pressione subito dopo, perche' e' l'unica
/// cosa che ogni tanto va rabboccata a mano.
const caselleDellaCaldaia = <(String, String, String, List<String>)>[
  (
    'stato',
    'Se sta lavorando',
    'acceso',
    ['binary_sensor', 'sensor', 'switch'],
  ),
  ('fiamma', 'La fiamma', 'acceso', ['binary_sensor', 'sensor']),
  /* «Non permette accensione/spegnimento della caldaia»: la pagina leggeva e
   * basta. Lo stato dice se la macchina lavora, ma non la comanda — sono due
   * entita' diverse, e chi ha un interruttore sulla caldaia lo vuole sotto le
   * dita dove la guarda invece che in un'altra pagina. */
  (
    'interruttore',
    'Cosa la accende e la spegne',
    'acceso',
    ['switch', 'input_boolean', 'climate'],
  ),
  /* Le elettrovalvole di riciclo: sono quelle che smistano l'acqua fra il
   * riscaldamento e il sanitario, e da come stanno si capisce dove sta
   * andando il calore — che e' meta' di quello che si viene a guardare qui.
   * Due, perche' due sono in un impianto normale. */
  (
    'valvola',
    'Elettrovalvola di riciclo',
    'acceso',
    ['binary_sensor', 'switch', 'valve'],
  ),
  (
    'valvola2',
    'La seconda elettrovalvola',
    'acceso',
    ['binary_sensor', 'switch', 'valve'],
  ),
  ('mandata', 'Temperatura di mandata (°C)', 'gradi', ['sensor']),
  ('ritorno', 'Temperatura di ritorno (°C)', 'gradi', ['sensor']),
  ('acquaCalda', 'Temperatura dell\'acqua calda (°C)', 'gradi', ['sensor']),
  ('pressione', 'Pressione (bar)', 'bar', ['sensor']),
  ('modulazione', 'Modulazione (%)', 'percento', ['sensor']),
  /* Quello che una caldaia a pellet o a legna ha in piu' (#346), da chi ha
   * una Froling letta con «Froling Connect»: la combustione da guardare — i
   * fumi, l'ossigeno che avanza, il ventilatore che tira — e un serbatoio che
   * si svuota. Stanno in coda a quelle di prima, nell'ordine in cui le ha
   * chieste, e la scheda le raccoglie sotto un titolo loro: chi ha una
   * caldaia a gas non se le trova in mezzo alle sue. Il ventilatore dei fumi
   * puo' essere una percentuale di comando o un interruttore: lo capisce la
   * plancia dalla lettura, non chi configura. */
  ('temperaturaCaldaia', 'Temperatura della caldaia', 'gradi', ['sensor']),
  ('boilerAlto', 'Boiler sanitario, sonda alta', 'gradi', ['sensor']),
  ('boilerBasso', 'Boiler sanitario, sonda bassa', 'gradi', ['sensor']),
  ('fumi', 'Temperatura dei fumi', 'gradi', ['sensor']),
  (
    'ventilatoreFumi',
    'Ventilatore dei fumi',
    'percento',
    ['fan', 'sensor', 'number', 'switch', 'input_boolean'],
  ),
  ('ossigeno', 'Ossigeno residuo (%)', 'percento', ['sensor']),
  ('pellet', 'Livello del pellet', 'percento', ['sensor']),
  ('mandataCalcolata', 'Mandata calcolata', 'gradi', ['sensor']),
];

/// Il gruppo delle caselle che ha solo chi brucia pellet o legna:
/// `GRUPPO_PELLET` in `core/impianti-termici.js`. La prima porta il titolo.
const caselleDelPellet = <String>[
  'temperaturaCaldaia',
  'boilerAlto',
  'boilerBasso',
  'fumi',
  'ventilatoreFumi',
  'ossigeno',
  'pellet',
  'mandataCalcolata',
];

/// Gli esempi e gli aiuti che l'editor della plancia scrive sotto le caselle
/// del pellet (`ETICHETTE` in `impianti-termici-editor-section.js`).
const esempiDelPellet = <String, String>{
  'temperaturaCaldaia': 'sensor.caldaia_temperatura',
  'boilerAlto': 'sensor.caldaia_boiler_alto',
  'boilerBasso': 'sensor.caldaia_boiler_basso',
  'fumi': 'sensor.caldaia_fumi',
  'ventilatoreFumi': 'fan.caldaia_ventilatore_fumi',
  'ossigeno': 'sensor.caldaia_ossigeno',
  'pellet': 'sensor.caldaia_pellet',
  'mandataCalcolata': 'sensor.caldaia_mandata_calcolata',
};

const aiutiDelPellet = <String, String>{
  'temperaturaCaldaia':
      'E\' l\'acqua dentro la caldaia, non quella che parte verso i '
      'termosifoni',
  'boilerBasso': 'Le due sonde insieme dicono quanta acqua calda e\' rimasta',
  'ventilatoreFumi':
      'Va bene una percentuale di comando o un interruttore: quale sia lo '
      'capisce da se\'',
  'pellet':
      'In percentuale diventa il serbatoio disegnato in pagina; in kg si '
      'legge in chili',
  'mandataCalcolata':
      'Il grado che la centralina si e\' data: accanto alla mandata vera dice '
      'se ci sta arrivando',
};

/// Cosa c'e' all'altro capo del tubo.
///
/// «Richiesta di visualizzare o radiatore o boiler»: la scena disegnava sempre
/// un radiatore, e chi ha una caldaia che serve solo l'accumulo sanitario ci
/// vedeva un termosifone che non ha. Di serie i radiatori, che e' il caso
/// comune.
const usciteDellaCaldaia = ['radiatori', 'boiler'];

/// Una caldaia, ripulita.
Map<String, String> leggiUnaCaldaia(dynamic letto) {
  final dato = letto is Map
      ? Map<String, dynamic>.from(letto)
      : <String, dynamic>{};
  final fuori = <String, String>{'name': '${dato['name'] ?? ''}'.trim()};
  for (final (campo, _, _, _) in caselleDellaCaldaia) {
    fuori[campo] = '${dato[campo] ?? ''}'.trim();
  }
  final uscita = '${dato['uscita'] ?? ''}'.trim().toLowerCase();
  fuori['uscita'] = usciteDellaCaldaia.contains(uscita)
      ? uscita
      : usciteDellaCaldaia.first;
  return fuori;
}

/// Le caldaie di casa. Una riga senza nemmeno un'entita' non e' una caldaia a
/// meta': e' una riga vuota, e disegnarla vorrebbe dire una macchina che non
/// dice niente.
List<Map<String, String>> leggiLeCaldaie(dynamic letto) {
  final righe = letto is List
      ? letto
      : (letto is Map ? [letto] : const <dynamic>[]);
  final fuori = <Map<String, String>>[];
  for (final (quale, riga) in righe.indexed) {
    final una = leggiUnaCaldaia(riga);
    final id = riga is Map ? '${riga['id'] ?? ''}'.trim() : '';
    una['id'] = id.isNotEmpty ? id : 'caldaia-${quale + 1}';
    fuori.add(una);
  }
  return fuori;
}

/// Le caldaie da salvare: si tengono anche quelle vuote, perche' una appena
/// aggiunta vive nella maschera finche' non si compila.
List<Map<String, dynamic>> caldaieDaScrivere(List<Map<String, String>> quali) =>
    [
      for (final una in quali)
        {
          for (final voce in una.entries)
            if (voce.value.trim().isNotEmpty) voce.key: voce.value.trim(),
        },
    ];

/* ── le cose che scaldano, oltre ai termosifoni ───────────────────────────
 *
 * Il termocamino, l'aspiratore della canna fumaria, la caldaia come
 * interruttore: sono voci che la plancia teneva cablate e adesso si scrivono.
 * Un elenco vuoto vuol dire «svuotato apposta» e resta vuoto; **mai scritto**
 * vuol dire un'altra cosa, e li' la plancia semina le tre storiche a chi ha
 * quelle entita' davvero. */

const chiaveDelTermicoCaldo = 'cd_termico_caldo';

/// Una voce del caldo, ripulita. Senza nome o senza entita' non e' una voce.
Map<String, String>? leggiUnaVoceDelCaldo(dynamic letto) {
  final dato = letto is Map
      ? Map<String, dynamic>.from(letto)
      : <String, dynamic>{};
  final nome = '${dato['name'] ?? ''}'.trim();
  final entita = '${dato['entity'] ?? ''}'.trim();
  if (nome.isEmpty || !entita.contains('.')) return null;
  final disegno = '${dato['icon'] ?? ''}'.trim();
  return {
    'name': nome,
    'entity': entita,
    'icon': disegno.isNotEmpty ? disegno : '🔥',
  };
}

List<Map<String, String>> leggiIlTermicoCaldo(dynamic letto) {
  if (letto is! List) return const [];
  return [
    for (final uno in letto)
      if (leggiUnaVoceDelCaldo(uno) case final voce?) voce,
  ];
}

/// Quali macchine ci sono nel locale caldaia.
///
/// `cd_impianti_termici` **non** e' un elenco di impianti: e' la risposta a
/// «cosa hai davvero», tre si'/no. La pagina Gestione termica mostra solo
/// quelli spuntati, e con due o tre compaiono le linguette per passare
/// dall'uno all'altro.
///
/// L'app ci scriveva un elenco di profili con dentro delle entita'. Quello
/// che la plancia fa con un elenco sta scritto in `normalizzaScelta`: se non
/// e' un oggetto — e un Array non lo e' — torna `null`, cioe' «non ha ancora
/// scelto», e la scelta vera se ne va. Peggio: salvare da qui cancellava le
/// tre spunte fatte dal browser.
const chiaveDegliImpiantiTermici = 'cd_impianti_termici';

/// I tre, nell'ordine in cui il calore arriva in casa: prima quello che e'
/// gratis, poi quello che si paga a corrente, poi quello che si paga a gas.
/// Da `TIPI_TERMICI`, e le parole da `ETICHETTE_TERMICHE` e dai suoi aiuti.
const iTipiTermici = <(String, String, String)>[
  (
    'solare',
    'Solare termico',
    'Pannelli sul tetto e accumulo: le caselle sono quelle della voce Solare '
        'termico.',
  ),
  (
    'scaldabagno',
    'Scaldabagno',
    'Uno scaldabagno elettrico, anche alimentato dal fotovoltaico.',
  ),
  (
    'caldaia',
    'Caldaia',
    'Una caldaia a gas: mandata, ritorno e pressione del circuito.',
  ),
];

/// Quali sono accesi, da quello che c'e' scritto.
///
/// Un elenco — la forma che l'app scriveva prima — vale come «non ha mai
/// scelto», che e' esattamente quello che ne fa la plancia.
Map<String, bool> laScelaTermica(Object? scritto) {
  final dato = scritto is Map ? scritto : const <String, dynamic>{};
  return {
    for (final (tipo, _, _) in iTipiTermici)
      tipo:
          dato[tipo] == true ||
          dato[tipo] == 'true' ||
          dato[tipo] == 1 ||
          dato[tipo] == '1',
  };
}
