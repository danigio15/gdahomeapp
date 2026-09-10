/// Chi abita la casa, e la sua faccia.
///
/// Una persona nella plancia non e' solo un nome e un'entita': porta la foto,
/// la batteria del telefono, i sensori che la Companion App si porta dietro —
/// in carica, indirizzo, attivita', Wi-Fi, orologio, tempo di rientro,
/// distanza, direzione — e un **ritratto**.
///
/// Il ritratto e' la parte che sembra piu' piccola e non lo e'. Non e' una
/// foto: si compone — persona, capelli, barba, colori, carnagione, vestito,
/// occhiali, collana — e quello che si salva sono **le scelte**. A disegnarle
/// e' il compositore della plancia (`plancia/ritratto.dart` dice come, e
/// perche' non lo rifacciamo qui): a questo file tocca sapere quali scelte
/// esistono e come si scrivono, che e' la parte che deve combaciare riga per
/// riga con `core/avatar-3d.js` e `core/person-model.js`.
library;

import 'lettere.dart';

String _pulito(Object? valore) => '${valore ?? ''}'.trim();

/* ─── Le file fra cui si sceglie ─────────────────────────────────────────── */

/// Chi si e': le teste renderizzate a monte.
const lePersone = <(String, String)>[
  ('uomo', 'Uomo'),
  ('donna', 'Donna'),
  ('neutro', 'Neutro'),
  ('ragazzo', 'Ragazzo'),
  ('ragazza', 'Ragazza'),
  ('anziano', 'Anziano'),
  ('anziana', 'Anziana'),
];

/// Ragazzi e anziani non hanno le varianti di capelli: a monte non sono state
/// renderizzate. Per loro le file «Capelli» e «Colore capelli» non si
/// applicano, e dirlo qui evita che l'editor le mostri per finta.
const _conICapelli = {'uomo', 'donna', 'neutro'};

bool personaHaCapelli(String persona) => _conICapelli.contains(persona);

/// Il taglio. Il catalogo elenca le **varianti** renderizzate — lisci, barba,
/// ricci, rossi, bianchi, biondi, calvo — qui invece stanno le **scelte**: il
/// taglio, la barba e i colori sono file separate, e la traduzione da scelta a
/// variante la fa il compositore.
const iCapelli = <(String, String)>[
  ('lisci', 'Lisci'),
  ('ricci', 'Ricci'),
  ('calvo', 'Calvo'),
];

const leBarbe = <(String, String)>[
  ('nessuna', 'Nessuna'),
  ('rasata', 'Rasata'),
  ('corta', 'Corta'),
  ('lunga', 'Lunga'),
];

const iColoriDeiCapelli = <(String, String)>[
  ('naturale', 'Naturale'),
  ('biondo', 'Biondo'),
  ('rosso', 'Rosso'),
  ('bianco', 'Bianco'),
  ('castano', 'Castano'),
  ('rame', 'Rame'),
  ('grigio', 'Grigio'),
  ('rosa', 'Rosa'),
];

const iColoriDellaBarba = <(String, String)>[
  ('naturale', 'Naturale'),
  ('grigia', 'Grigia'),
  ('bionda', 'Bionda'),
  ('rame', 'Rame'),
  ('castana', 'Castana'),
];

const iColoriDegliOcchi = <(String, String)>[
  ('marrone', 'Marroni'),
  ('verde', 'Verdi'),
  ('azzurro', 'Azzurri'),
  ('grigio', 'Grigi'),
  ('nero', 'Neri'),
];

const leCarnagioni = <(String, String)>[
  ('chiara', 'Chiara'),
  ('chiara2', 'Chiara 2'),
  ('media', 'Media'),
  ('ambrata', 'Ambrata'),
  ('scura', 'Scura'),
];

/// Il vestito. «nessuno» non e' un vestito: e' il ritratto della sola testa.
const iVestiti = <(String, String)>[
  ('nessuno', 'Nessuno'),
  ('casual', 'Maglietta'),
  ('polo', 'Polo'),
  ('camicia', 'Camicia'),
  ('ufficio', 'Completo'),
  ('attesa', 'Abito'),
  ('saluto', 'Saluto'),
  ('medico', 'Medico'),
  ('cuoco', 'Cuoco'),
  ('smoking', 'Smoking'),
  ('velo', 'Velo'),
  ('pompiere', 'Pompiere'),
  ('poliziotto', 'Poliziotto'),
  ('muratore', 'Muratore'),
  ('operaio', 'Operaio'),
  ('meccanico', 'Meccanico'),
  ('contadino', 'Contadino'),
  ('pilota', 'Pilota'),
  ('astronauta', 'Astronauta'),
  ('giudice', 'Giudice'),
  ('supereroe', 'Supereroe'),
  ('scienziato', 'Scienziato'),
  ('insegnante', 'Insegnante'),
  ('studente', 'Studente'),
  ('informatico', 'Informatico'),
  ('artista', 'Artista'),
  ('cantante', 'Cantante'),
  ('guardia', 'Guardia'),
  ('detective', 'Detective'),
  ('turbante', 'Turbante'),
  ('supercattivo', 'Supercattivo'),
  ('mago', 'Mago'),
  ('fata', 'Fata'),
  ('vampiro', 'Vampiro'),
  ('elfo', 'Elfo'),
];

/// La fila «Colore vestito» vale solo per i busti che il compositore sa
/// ricolorare: tessuti a tinta piena, dichiarati dallo script che li ha
/// preparati. Per gli altri la scelta non ha effetto, e l'editor non la mostra.
const _ricolorabili = {
  'ufficio',
  'medico',
  'casual',
  'saluto',
  'polo',
  'camicia',
  'attesa',
};

bool vestitoRicolorabile(String vestito) => _ricolorabili.contains(vestito);

const iColoriDelVestito = <(String, String)>[
  ('blu', 'Blu'),
  ('verde', 'Verde'),
  ('rosso', 'Rosso'),
  ('giallo', 'Giallo'),
  ('viola', 'Viola'),
  ('grigio', 'Grigio'),
];

const gliOcchiali = <(String, String)>[
  ('nessuno', 'Nessuno'),
  ('tondi', 'Tondi'),
  ('quadrati', 'Quadrati'),
  ('sole', 'Da sole'),
];

const leCollane = <(String, String)>[
  ('nessuna', 'Nessuna'),
  ('catenina', 'Catenina'),
  ('pendente', 'Pendente'),
];

/// I colori del cerchietto con le iniziali: coppie sfondo/inchiostro gia'
/// accordate col resto della plancia. Un colore libero scritto a mano puo'
/// rendere le iniziali illeggibili, uno di questi no.
const iColoriDellaPersona = <String>[
  '#0ea5e9',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#f43f5e',
  '#f59e0b',
  '#16a34a',
  '#14b8a6',
  '#64748b',
];

String _dentro(String valore, List<(String, String)> quali) =>
    quali.any((uno) => uno.$1 == valore) ? valore : quali.first.$1;

/* ─── Il ritratto ────────────────────────────────────────────────────────── */

/// Le scelte di un ritratto, gia' messe in riga.
///
/// E' il porto di `normalizeAvatar3d`: le stesse file, gli stessi valori di
/// ripiego, e le stesse tre traduzioni dalle vecchie varianti — «barba»,
/// «rossi», «bianchi»/«biondi» erano tagli, adesso sono un taglio piu' un
/// colore o una barba. Chi si era fatto la faccia con la versione di prima non
/// deve ritrovarsi senza.
class RitrattoScelto {
  const RitrattoScelto({
    this.persona = 'uomo',
    this.capelli = 'lisci',
    this.barba = 'nessuna',
    this.coloreCapelli = 'naturale',
    this.coloreBarba = 'naturale',
    this.occhi = 'marrone',
    this.carnagione = 'chiara',
    this.vestito = 'nessuno',
    this.coloreVestito = 'blu',
    this.occhiali = 'nessuno',
    this.collana = 'nessuna',
  });

  /// Da quello che c'e' scritto nella configurazione. `null` per chi un
  /// ritratto non ce l'ha: allora valgono l'emoji e, per ultime, le iniziali.
  static RitrattoScelto? da(Object? letto) {
    if (letto is! Map) return null;
    final persona = _dentro('${letto['persona'] ?? ''}', lePersone);
    var capelli = '${letto['capelli'] ?? ''}';
    var barba = '${letto['barba'] ?? ''}';
    var coloreCapelli = '${letto['coloreCapelli'] ?? ''}';
    /* Le vecchie varianti: erano tagli, adesso sono un taglio piu' altro. */
    if (capelli == 'barba') {
      capelli = 'lisci';
      if (barba.isEmpty) barba = 'corta';
    } else if (capelli == 'rossi') {
      capelli = 'lisci';
      if (coloreCapelli.isEmpty) coloreCapelli = 'rosso';
    } else if (capelli == 'bianchi' || capelli == 'biondi') {
      if (coloreCapelli.isEmpty) {
        coloreCapelli = capelli == 'biondi' ? 'biondo' : 'bianco';
      }
      capelli = 'lisci';
    }
    final haCapelli = personaHaCapelli(persona);
    return RitrattoScelto(
      persona: persona,
      capelli: haCapelli ? _dentro(capelli, iCapelli) : iCapelli.first.$1,
      barba: _dentro(barba, leBarbe),
      coloreCapelli: haCapelli
          ? _dentro(coloreCapelli, iColoriDeiCapelli)
          : iColoriDeiCapelli.first.$1,
      coloreBarba: _dentro('${letto['coloreBarba'] ?? ''}', iColoriDellaBarba),
      occhi: _dentro('${letto['occhi'] ?? ''}', iColoriDegliOcchi),
      carnagione: _dentro('${letto['carnagione'] ?? ''}', leCarnagioni),
      vestito: _dentro('${letto['vestito'] ?? ''}', iVestiti),
      coloreVestito: _dentro(
        '${letto['coloreVestito'] ?? ''}',
        iColoriDelVestito,
      ),
      occhiali: _dentro('${letto['occhiali'] ?? ''}', gliOcchiali),
      collana: _dentro('${letto['collana'] ?? ''}', leCollane),
    );
  }

  final String persona;
  final String capelli;
  final String barba;
  final String coloreCapelli;
  final String coloreBarba;
  final String occhi;
  final String carnagione;
  final String vestito;
  final String coloreVestito;
  final String occhiali;
  final String collana;

  RitrattoScelto con({
    String? persona,
    String? capelli,
    String? barba,
    String? coloreCapelli,
    String? coloreBarba,
    String? occhi,
    String? carnagione,
    String? vestito,
    String? coloreVestito,
    String? occhiali,
    String? collana,
  }) => RitrattoScelto(
    persona: persona ?? this.persona,
    capelli: capelli ?? this.capelli,
    barba: barba ?? this.barba,
    coloreCapelli: coloreCapelli ?? this.coloreCapelli,
    coloreBarba: coloreBarba ?? this.coloreBarba,
    occhi: occhi ?? this.occhi,
    carnagione: carnagione ?? this.carnagione,
    vestito: vestito ?? this.vestito,
    coloreVestito: coloreVestito ?? this.coloreVestito,
    occhiali: occhiali ?? this.occhiali,
    collana: collana ?? this.collana,
  );

  Map<String, String> get scritto => {
    'persona': persona,
    'capelli': capelli,
    'barba': barba,
    'coloreCapelli': coloreCapelli,
    'coloreBarba': coloreBarba,
    'occhi': occhi,
    'carnagione': carnagione,
    'vestito': vestito,
    'coloreVestito': coloreVestito,
    'occhiali': occhiali,
    'collana': collana,
  };

  /// Di che colore viene la barba, davvero.
  ///
  /// Su una testa bionda una barba nera non e' naturale: e' un trucco. Chi un
  /// colore l'ha scelto apposta vince sempre; chi ha lasciato «naturale» trova
  /// la barba del colore della chioma.
  String get barbaComeViene {
    if (coloreBarba != 'naturale') return coloreBarba;
    if (!personaHaCapelli(persona)) return 'naturale';
    return const {
          'biondo': 'bionda',
          'bianco': 'grigia',
          'grigio': 'grigia',
          'rosso': 'rame',
          'rame': 'rame',
          'castano': 'castana',
        }[coloreCapelli] ??
        'naturale';
  }
}

/* ─── La persona ─────────────────────────────────────────────────────────── */

/// I sensori facoltativi che una persona si porta dietro oltre alla batteria:
/// quelli della Companion App, l'orologio, e quelli di Waze o Proximity.
const iSensoriDellaPersona = <(String, String, List<String>)>[
  ('batteryState', 'In carica', ['binary_sensor', 'sensor']),
  ('watch', 'Batteria dell\'orologio', ['sensor']),
  ('distance', 'Distanza da casa', ['sensor']),
  ('travel', 'Tempo per rientrare', ['sensor']),
  ('address', 'Indirizzo', ['sensor']),
  ('activity', 'Cosa sta facendo', ['sensor']),
  ('wifi', 'A quale Wi-Fi e\' attaccata', ['sensor']),
  ('direction', 'Si avvicina o si allontana', ['sensor']),
];

/// I domini di un'entita' che puo' dire dove sta una persona.
const dominiDellaPersona = ['person', 'device_tracker'];

/// Un identificativo come lo fabbrica la plancia: minuscolo, senza accenti.
String identificativoDellaPersona(String valore) => senzaAccenti(valore)
    .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
    .replaceAll(RegExp(r'^-+|-+$'), '');

/// Le iniziali: l'avatar che non si deve disegnare. Due lettere, come le
/// rubriche dei telefoni — piu' di due diventano un timbro.
String inizialiDi(String nome) {
  final parole = _pulito(nome).split(RegExp(r'\s+')).where((una) => una.isNotEmpty);
  if (parole.isEmpty) return '?';
  return parole.take(2).map((una) => una[0].toUpperCase()).join();
}

/// Una persona, nella forma che la plancia si aspetta.
///
/// Si tiene la mappa grezza, come gli apparecchi: quello che questo modello
/// non conosce ma la plancia si' resta dov'e' invece di sparire al primo
/// salvataggio.
class Persona {
  Persona(this.dentro);

  factory Persona.da(Map<String, dynamic> letto, {int quale = 0}) {
    final fuori = Map<String, dynamic>.from(letto);
    final nome = _pulito(letto['name']);
    final entita = _pulito(letto['entity']);
    fuori['id'] = _pulito(letto['id']).isNotEmpty
        ? _pulito(letto['id'])
        : 'person-${identificativoDellaPersona(nome.isNotEmpty ? nome : entita.split('.').skip(1).join('.'))}';
    fuori['name'] = nome;
    fuori['entity'] = entita;
    fuori['photo'] = _pulito(letto['photo']);
    fuori['battery'] = _pulito(letto['battery']);
    fuori['nascosta'] = letto['nascosta'] == true;
    for (final (campo, _, _) in iSensoriDellaPersona) {
      fuori[campo] = _pulito(letto[campo]);
    }
    final avatar = letto['avatar'] is Map
        ? Map<String, dynamic>.from(letto['avatar'] as Map)
        : <String, dynamic>{};
    final colore = _pulito(avatar['color']);
    fuori['avatar'] = {
      ...avatar,
      'emoji': _pulito(avatar['emoji']),
      'color': iColoriDellaPersona.contains(colore)
          ? colore
          : iColoriDellaPersona[quale % iColoriDellaPersona.length],
      'face': RitrattoScelto.da(avatar['face'])?.scritto,
    };
    return Persona(fuori);
  }

  factory Persona.nuova({int quale = 0}) =>
      Persona.da(const {}, quale: quale);

  final Map<String, dynamic> dentro;

  String get id => '${dentro['id'] ?? ''}';
  String get nome => '${dentro['name'] ?? ''}';
  String get entita => '${dentro['entity'] ?? ''}';
  String get foto => '${dentro['photo'] ?? ''}';
  bool get nascosta => dentro['nascosta'] == true;

  Map<String, dynamic> get _avatar => dentro['avatar'] is Map
      ? Map<String, dynamic>.from(dentro['avatar'] as Map)
      : <String, dynamic>{};

  String get emoji => '${_avatar['emoji'] ?? ''}';
  String get colore => '${_avatar['color'] ?? iColoriDellaPersona.first}';

  /// Il ritratto scelto, o `null` per chi non ne ha uno.
  RitrattoScelto? get ritratto => RitrattoScelto.da(_avatar['face']);

  void metti(String campo, Object? valore) {
    if (valore == null || (valore is String && valore.trim().isEmpty)) {
      dentro.remove(campo);
    } else {
      dentro[campo] = valore is String ? valore.trim() : valore;
    }
  }

  void mettiNellAvatar(String campo, Object? valore) {
    final avatar = _avatar;
    if (valore == null || (valore is String && valore.trim().isEmpty)) {
      avatar.remove(campo);
    } else {
      avatar[campo] = valore is String ? valore.trim() : valore;
    }
    dentro['avatar'] = avatar;
  }

  /// Mette — o toglie — il ritratto.
  void mettiIlRitratto(RitrattoScelto? quale) =>
      mettiNellAvatar('face', quale?.scritto);
}

/// Legge le persone dalla configurazione.
List<Persona> lePersoneDi(Object? letto) {
  if (letto is! List) return [];
  final fuori = <Persona>[];
  for (final una in letto) {
    if (una is! Map) continue;
    final mappa = Map<String, dynamic>.from(una);
    /* Una voce senza nome ne' entita' non e' una persona: si scarta invece di
     * disegnare una scheda vuota. */
    if (_pulito(mappa['name']).isEmpty && _pulito(mappa['entity']).isEmpty) {
      continue;
    }
    fuori.add(Persona.da(mappa, quale: fuori.length));
  }
  return fuori;
}
