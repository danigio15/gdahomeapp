/// Il modello degli apparecchi: quello della plancia, in Dart.
///
/// Una luce, una telecamera, una tapparella, un'auto, un elettrodomestico: per
/// la plancia sono tutti la stessa cosa — un **apparecchio** — con qualche
/// campo in piu' a seconda della sezione. Il modello sta in
/// `ponte/plancia/src/core/device-model.js`, funzione `normalizeDevice`, e
/// questo file lo rifa' riga per riga.
///
/// Perche' e' importante, e non e' pignoleria: **un campo che il modello non
/// conosce sparisce alla prima normalizzazione**. Nel codice della plancia
/// quell'avvertimento e' scritto cinque volte, ogni volta accanto a un campo
/// che era sparito davvero — il contatto dell'infisso di una tapparella,
/// l'inferriata, l'indirizzo RTSP di una telecamera. Se l'app scrive una forma
/// che il modello non riconosce, la plancia la butta appena la rilegge, e
/// quello che si e' configurato sembra non essersi salvato.
///
/// Quindi qui si scrive **la forma che `normalizeDevice` produce**, cosi' la
/// sua normalizzazione sui nostri dati non cambia niente.
library;

import 'dart:math';

/// Le sezioni che hanno apparecchi, coi nomi che usa la plancia
/// (`SECTION_KEYS` in `core/migrations.js`).
enum Sezione {
  stanze('rooms', 'cd_stanze'),
  telecamere('cameras', 'cd_cameras'),
  elettrodomestici('appliances', 'cd_appliances'),
  carichi('loads', 'cd_loads'),
  luci('lights', 'cd_luci'),
  clima('climate', 'cd_clima_units'),
  auto('ev', 'cd_ev_cars'),
  finestre('covers', 'cd_tapparelle'),
  prese('sockets', 'cd_prese'),
  robot('robots', 'cd_robot');

  const Sezione(this.nome, this.chiave);

  /// Come si chiama nel modello canonico: `rooms`, `ev`, `covers`.
  final String nome;

  /// La chiave storica sul ponte: `cd_stanze`, `cd_ev_cars`.
  final String chiave;
}

/// I campi che il modello conosce per tutti. Quello che sta fuori da qui e da
/// [_diSezione] non sopravvive a una normalizzazione della plancia.
const _diTutti = {
  'id',
  'section',
  'name',
  'icon',
  'image',
  'image_url',
  'visual_type',
  'visual_key',
  'emoji_icon',
  'room_id',
  'room',
  'entities',
  'entity',
  'enabled',
  'order',
  'metadata',
};

/// I campi in piu' di ogni sezione, presi da `normalizeDevice`.
const _diSezione = <String, Set<String>>{
  'climate': {'type', 'valvola'},
  'cameras': {'stream', 'rtsp', 'vivo'},
  'covers': {'contact', 'contact_out'},
  /* Un elettrodomestico connesso porta molto piu' di un interruttore: il
   * programma, la fase, il tempo che manca, la durata del ciclo, due
   * temperature, l'allarme, l'ora di avvio, l'energia e il costo dell'ultimo
   * ciclo. Sono caselle vere di `normalizeDevice`, non appunti — e una
   * casella non dichiarata sparisce al primo salvataggio dell'app, che e' il
   * difetto che in questo file e' gia' costato sei righe aggiunte dopo la
   * segnalazione di qualcuno. */
  'appliances': _diUnApparecchio,
  'loads': _diUnApparecchio,
};

const _diUnApparecchio = {
  'state_entity',
  'remaining_entity',
  'cycle_duration_entity',
  'temperature_entity',
  'temperature_entity_2',
  'alert_entity',
  'last_start_entity',
  'last_duration_entity',
  'last_energy_entity',
  'last_cost_entity',
  'report_entity',
  'report_label',
  'report_icon',
  'report_order',
  'show_in_report',
  'show_in_dashboard',
  'switch_disabled',
  'category',
  'device_type',
  'threshold_run',
  'threshold_standby',
  'cycle_minutes',
  'off_delay_minutes',
  'temp_min',
  'temp_max',
  'max_power',
  'price_kwh',
  /* Di quale impianto e' questo carico. Vuoto vuol dire il primo. */
  'plant',
  /* Da quale dispositivo viene, quando viene da un'integrazione. */
  'device_id',
  'integration',
  'integration_name',
  'device_name',
  'device_manufacturer',
  'device_model',
  'device_entities',
};

/// I campi da cui `deviceEntities` raccoglie le entita' di un apparecchio.
const campiDiEntita = [
  'control_entity',
  'power_entity',
  'energy_entity',
  'daily_energy_entity',
  'monthly_energy_entity',
  'total_energy_entity',
  'history_entity',
  'entity',
];

final _aCaso = Random();

/// Un identificativo nuovo, nella forma della plancia: `sezione-qualcosa`.
String fabbricaUnId(String sezione) {
  final quando = DateTime.now().millisecondsSinceEpoch.toRadixString(36);
  /* Non `1 << 32`: sul web gli spostamenti di bit sono a trentadue, quel
   * numero vale **zero**, e `nextInt(0)` non e' un numero a caso — e' un
   * errore che porta giu' la schermata. Il collaudo l'ha visto aprendo una
   * luce; su un telefono non sarebbe mai successo, ed e' proprio per questo
   * che il collaudo guarda l'app girare invece di crederci sulla parola. */
  final caso = _aCaso.nextInt(0x7fffffff).toRadixString(36);
  return '$sezione-$quando-$caso';
}

/// I nomi che la plancia considera «nessun nome»: un elettrodomestico che si
/// chiama «Generico» non ha un nome, ha un difetto.
final _nomiVuoti = RegExp(
  r'^(generico|generic|other|altro|appliance)$',
  caseSensitive: false,
);

/// Un apparecchio, nella forma che la plancia si aspetta.
///
/// Si tiene la mappa grezza: i campi che questo modello non conosce ma la
/// plancia si', e quelli che le sezioni si scrivono da sole, restano dove
/// sono invece di sparire quando l'app risalva.
class Apparecchio {
  Apparecchio(this.dentro);

  /// Da quello che c'e' scritto nella configurazione.
  factory Apparecchio.da(
    Map<String, dynamic> letto, {
    required Sezione sezione,
    List<Apparecchio> stanze = const [],
    int quale = 0,
  }) {
    final fuori = Map<String, dynamic>.from(letto);

    /* La stanza: la plancia tiene l'id **e** il nome, e chi legge usa l'uno o
     * l'altro. Se si scrive solo l'id, mezza dozzina di sezioni che leggono il
     * nome mostrano ancora quella di prima. */
    final idScritto = '${letto['room_id'] ?? letto['roomId'] ?? ''}';
    final nomeScritto = '${letto['room'] ?? ''}';
    final trovata = stanze
        .where((una) => una.id == nomeScritto || una.nome == nomeScritto)
        .firstOrNull;
    final idDellaStanza = idScritto.isNotEmpty
        ? idScritto
        : (trovata?.id ?? '');
    final quellaDellId = stanze
        .where((una) => una.id == idDellaStanza || una.nome == idDellaStanza)
        .firstOrNull;
    final nomeAccanto =
        idDellaStanza.isNotEmpty &&
            quellaDellId != null &&
            quellaDellId.nome != nomeScritto &&
            quellaDellId.id != nomeScritto
        ? quellaDellId.nome
        : (idDellaStanza.isNotEmpty &&
                  quellaDellId == null &&
                  idScritto.isNotEmpty &&
                  idScritto != nomeScritto
              ? ''
              : nomeScritto);

    final disegnoScritto = '${letto['icon'] ?? ''}';
    final emoji =
        !disegnoScritto.startsWith('mdi:') && _nonEAscii(disegnoScritto)
        ? disegnoScritto
        : '${letto['emoji_icon'] ?? ''}';
    final immagine = '${letto['image'] ?? letto['image_url'] ?? ''}';
    final nome = '${letto['name'] ?? ''}'.trim();

    fuori['id'] = '${letto['id'] ?? ''}'.isEmpty
        ? fabbricaUnId(sezione.nome)
        : '${letto['id']}';
    fuori['section'] = sezione.nome;
    fuori['name'] = _nomiVuoti.hasMatch(nome) ? '' : nome;
    fuori['icon'] = disegnoScritto.toLowerCase().startsWith('mdi:')
        ? disegnoScritto
        : '';
    fuori['image'] = immagine;
    fuori['image_url'] = immagine;
    fuori['emoji_icon'] = emoji;
    fuori['room_id'] = idDellaStanza;
    fuori['room'] = nomeAccanto;
    fuori['entities'] = entitaDi(letto);
    fuori['enabled'] = letto['enabled'] != false;
    fuori['order'] = _numero(letto['order']) ?? quale;
    fuori['metadata'] = Map<String, dynamic>.from(
      letto['metadata'] is Map ? letto['metadata'] as Map : const {},
    );
    return Apparecchio(fuori);
  }

  /// Uno nuovo, vuoto, gia' con l'identificativo.
  factory Apparecchio.nuovo(Sezione sezione, {int quale = 0}) =>
      Apparecchio.da(const {}, sezione: sezione, quale: quale);

  /// La mappa com'e', pronta da riscrivere nella configurazione.
  final Map<String, dynamic> dentro;

  String get id => '${dentro['id'] ?? ''}';
  String get nome => '${dentro['name'] ?? ''}';
  String get entita => '${dentro['entity'] ?? ''}';
  String get stanza => '${dentro['room'] ?? ''}';
  String get idDellaStanza => '${dentro['room_id'] ?? ''}';
  String get emoji => '${dentro['emoji_icon'] ?? ''}';
  String get immagine => '${dentro['image'] ?? ''}';
  bool get acceso => dentro['enabled'] != false;
  int get ordine => _numero(dentro['order']) ?? 0;

  List<String> get tutteLeEntita => [
    for (final una in (dentro['entities'] as List? ?? const []))
      if (una is String) una,
  ];

  /// Cambia un campo. Il valore vuoto lo toglie, che e' come fa la plancia:
  /// una chiave che c'e' ma non dice niente e' peggio di una che non c'e',
  /// perche' la prima sembra configurata.
  void metti(String campo, Object? valore) {
    final prima = campiDiEntita.contains(campo) ? '${dentro[campo] ?? ''}' : '';
    if (valore == null || (valore is String && valore.trim().isEmpty)) {
      dentro.remove(campo);
    } else {
      dentro[campo] = valore is String ? valore.trim() : valore;
    }
    if (!campiDiEntita.contains(campo) && campo != 'entities') return;
    /* L'entita' di prima esce dall'elenco.
     *
     * L'elenco si ricava dai campi, ma **contiene anche se stesso**: senza
     * toglierla, cambiare la presa di un elettrodomestico lasciava dentro
     * anche quella vecchia, e la plancia continuava a leggere una presa che
     * non era piu' di nessuno. Si toglie solo se non e' rimasta in un altro
     * campo, che due caselle possono puntare alla stessa entita' apposta. */
    if (prima.isNotEmpty && prima != '${dentro[campo] ?? ''}') {
      final altrove = campiDiEntita.any(
        (uno) => uno != campo && '${dentro[uno] ?? ''}' == prima,
      );
      if (!altrove) {
        dentro['entities'] = [
          for (final una in (dentro['entities'] as List? ?? const []))
            if (una != prima) una,
        ];
      }
    }
    dentro['entities'] = entitaDi(dentro);
  }

  /// Mette la stanza: l'id **e** il nome, che la plancia vuole tutti e due.
  void mettiLaStanza(Apparecchio? quale) {
    if (quale == null) {
      dentro
        ..remove('room_id')
        ..remove('room');
      return;
    }
    dentro['room_id'] = quale.id;
    dentro['room'] = quale.nome;
  }

  /// Cosa la plancia butterebbe via riscrivendo questo apparecchio.
  ///
  /// Non serve a niente in produzione: serve alle prove, che sono il posto in
  /// cui accorgersi che un campo nuovo non e' dichiarato — invece di
  /// accorgersene su un telefono, quando quel campo e' gia' sparito.
  Set<String> get campiCheSparirebbero {
    final sezione = '${dentro['section'] ?? ''}';
    final noti = {..._diTutti, ...?_diSezione[sezione], ...campiDiEntita};
    return dentro.keys.where((uno) => !noti.contains(uno)).toSet();
  }
}

bool _nonEAscii(String testo) => testo.runes.any((uno) => uno > 0x7f);

int? _numero(dynamic valore) => switch (valore) {
  final int quanto => quanto,
  final num quanto => quanto.toInt(),
  final String quanto => int.tryParse(quanto),
  _ => null,
};

/// Tutte le entita' di un apparecchio, senza doppioni e nell'ordine della
/// plancia (`deviceEntities`).
List<String> entitaDi(Map<String, dynamic> letto) {
  final fuori = <String>{};
  for (final campo in campiDiEntita) {
    final valore = letto[campo];
    if (valore is String && valore.trim().isNotEmpty) fuori.add(valore.trim());
  }
  for (final una in (letto['entities'] as List? ?? const [])) {
    if (una is String && una.trim().isNotEmpty) {
      fuori.add(una.trim());
    } else if (una is Map && una['entity'] is String) {
      final quale = (una['entity'] as String).trim();
      if (quale.isNotEmpty) fuori.add(quale);
    }
  }
  return fuori.toList();
}

/// Legge un elenco di apparecchi dalla configurazione.
///
/// Le luci arrivano come mappa `{'light.cucina': 'Cucina'}` invece che come
/// elenco: e' la forma piu' vecchia, e la plancia la converte
/// (`migrateLights`). Qui si fa lo stesso, se no chi ha una configurazione di
/// prima si ritrova le luci sparite.
List<Apparecchio> leggiGliApparecchi(
  dynamic letto, {
  required Sezione sezione,
  List<Apparecchio> stanze = const [],
}) {
  final grezzi = <Map<String, dynamic>>[];
  if (letto is List) {
    for (final uno in letto) {
      if (uno is Map) grezzi.add(Map<String, dynamic>.from(uno));
    }
  } else if (letto is Map) {
    if (sezione == Sezione.luci || sezione == Sezione.prese) {
      for (final voce in letto.entries) {
        grezzi.add({'entity': '${voce.key}', 'name': '${voce.value}'});
      }
    } else {
      /* Un oggetto solo vale come elenco di uno: e' come nascono quasi tutte
       * le sezioni, e una configurazione scritta a mano non deve perdersi. */
      grezzi.add(Map<String, dynamic>.from(letto));
    }
  }
  return [
    for (final (quale, uno) in grezzi.indexed)
      Apparecchio.da(uno, sezione: sezione, stanze: stanze, quale: quale),
  ];
}

/// Riscrive un elenco di apparecchi nella forma della sua chiave.
Object scriviGliApparecchi(List<Apparecchio> quali, Sezione sezione) {
  /* Le luci e le prese tornano mappa: la plancia legge tutte e due le forme,
   * ma il resto del suo codice — sei moduli — legge la mappa. Cambiargliela
   * sotto vorrebbe dire romperli tutti insieme. */
  if (sezione == Sezione.luci || sezione == Sezione.prese) {
    return {
      for (final uno in quali)
        if (uno.entita.isNotEmpty) uno.entita: uno.nome,
    };
  }
  return [for (final uno in quali) uno.dentro];
}
