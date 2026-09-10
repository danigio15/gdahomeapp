/// Le correzioni al rilevamento: i varchi, la presenza, le macchine, le
/// batterie.
///
/// Quattro sezioni della plancia che non si configurano per cominciare: un
/// contatto lo dichiara Home Assistant col suo `device_class`, un rilevatore
/// di movimento pure, una batteria e' un sensore in percentuale marcato
/// `battery`, un container di Proxmox e' un `binary_sensor` con classe
/// `running`. Chi ne ha uno se lo ritrova. La configurazione serve solo a
/// **correggere** quel rilevamento — togliere il sensore del frigo che
/// qualcuno ha etichettato «door», aggiungere quello che nessuno ha
/// etichettato, dare un nome piu' chiaro di «Contact 4B» — ed e' la stessa
/// forma per tutte e quattro, perche' e' lo stesso problema.
///
/// E' il porto in Dart di `core/varchi-di-casa.js`, `core/presenza-in-casa.js`,
/// `core/macchine-e-rete.js` e `core/batterie-di-casa.js`.
library;

import '../entita.dart';

String _pulito(Object? valore) => '${valore ?? ''}'.trim();

/* ── varchi e presenza: la stessa forma ────────────────────────────────── */

/// Dove si scrive la configurazione dei varchi (#367, #377).
const chiaveDeiVarchi = 'cd_varchi';

/// Dove si scrive la configurazione della presenza (#432).
const chiaveDellaPresenza = 'cd_presenza';

/// Le classi che contano come varco: le stesse del rilevamento.
const classiDelVarco = ['door', 'window', 'opening', 'garage_door'];

/// Le classi che contano come rilevatore. `moving` c'e' perche' qualche
/// integrazione la usa per i sensori a radar, e `vibration` no: una lavatrice
/// che vibra non e' qualcuno che passa.
const classiDellaPresenza = ['motion', 'occupancy', 'presence', 'moving'];

/// Il disegno di un varco, dalla classe che Home Assistant gli ha dato.
String disegnoDelVarco(String classe) => switch (_pulito(classe)) {
  'window' => '🪟',
  'garage_door' => '🏚️',
  'opening' => '🚧',
  _ => '🚪',
};

/// Il disegno di un rilevatore.
String disegnoDelRilevatore(String classe) => switch (_pulito(classe)) {
  'occupancy' || 'presence' => '🧍',
  _ => '🏃',
};

/// Se questa entita' e' un varco, per quello che ne dice Home Assistant.
bool eUnVarco(Entita una) =>
    una.id.startsWith('binary_sensor.') &&
    classiDelVarco.contains(_pulito(una.attributi['device_class']));

/// Se questa entita' e' un rilevatore di presenza.
bool eUnRilevatore(Entita una) =>
    una.id.startsWith('binary_sensor.') &&
    classiDellaPresenza.contains(_pulito(una.attributi['device_class']));

/// La configurazione di varchi e presenza, ripulita: quali entita' non
/// contano, quali si aggiungono a mano, come si chiamano.
class Correzioni {
  Correzioni({
    List<String>? escluse,
    List<String>? aggiunte,
    Map<String, String>? nomi,
  }) : escluse = escluse ?? [],
       aggiunte = aggiunte ?? [],
       nomi = nomi ?? {};

  /// Come la legge la plancia (`normalizzaVarchi` / `normalizzaPresenza`):
  /// elenchi ripuliti, con un punto dentro, senza doppioni; nomi solo dove
  /// c'e' scritto qualcosa.
  factory Correzioni.da(Object? letto) {
    final dato = letto is Map
        ? Map<String, dynamic>.from(letto)
        : const <String, dynamic>{};
    return Correzioni(
      escluse: _elenco(dato['escluse']),
      aggiunte: _elenco(dato['aggiunte']),
      nomi: _nomi(dato['nomi']),
    );
  }

  final List<String> escluse;
  final List<String> aggiunte;
  final Map<String, String> nomi;

  Map<String, dynamic> get daScrivere => {
    'escluse': escluse,
    'aggiunte': aggiunte,
    'nomi': nomi,
  };

  /// Aggiunge a mano: entra fra le aggiunte ed esce dalle escluse.
  void aggiungi(String entita) {
    final id = _pulito(entita);
    if (!id.contains('.')) return;
    if (!aggiunte.contains(id)) aggiunte.add(id);
    escluse.remove(id);
  }

  /// Toglie dai conti: entra fra le escluse ed esce dalle aggiunte.
  void togli(String entita) {
    final id = _pulito(entita);
    if (!escluse.contains(id)) escluse.add(id);
    aggiunte.remove(id);
  }

  /// Rimette una tolta: esce dalle escluse e basta.
  void rimetti(String entita) => escluse.remove(_pulito(entita));

  /// Il nome scelto, o niente per tornare a quello di Home Assistant.
  void chiama(String entita, String nome) {
    final id = _pulito(entita);
    if (_pulito(nome).isEmpty) {
      nomi.remove(id);
    } else {
      nomi[id] = _pulito(nome);
    }
  }
}

List<String> _elenco(Object? valori) {
  final visti = <String>{};
  return [
    for (final uno in (valori is List ? valori : const []))
      if (_pulito(uno).contains('.') && visti.add(_pulito(uno))) _pulito(uno),
  ];
}

Map<String, String> _nomi(Object? valori) => {
  if (valori is Map)
    for (final voce in valori.entries)
      if (_pulito(voce.key).contains('.') && _pulito(voce.value).isNotEmpty)
        _pulito(voce.key): _pulito(voce.value),
};

/// Le entita' di casa che contano, date le correzioni: le rilevate meno le
/// escluse, piu' le aggiunte a mano. Nell'ordine: prima le rilevate come
/// stanno in casa, poi quelle aggiunte che il rilevamento non aveva.
List<Entita> entitaCheContano(
  List<Entita> casa,
  Correzioni scelte, {
  required bool Function(Entita) rilevata,
}) {
  final viste = <String>{};
  final fuori = <Entita>[];
  for (final una in casa) {
    if (scelte.escluse.contains(una.id)) continue;
    if (!rilevata(una) && !scelte.aggiunte.contains(una.id)) continue;
    if (viste.add(una.id)) fuori.add(una);
  }
  for (final id in scelte.aggiunte) {
    if (viste.contains(id) || scelte.escluse.contains(id)) continue;
    /* Aggiunta a mano ma non in casa adesso: si vede lo stesso, muta, che
     * toglierla dalla vista vorrebbe dire non poterla piu' togliere. */
    if (viste.add(id)) {
      fuori.add(Entita(id: id, stato: 'unavailable', attributi: const {}));
    }
  }
  return fuori;
}

/* ── le macchine del server e la rete (#382) ───────────────────────────── */

/// Dove si scrive la configurazione delle macchine.
const chiaveDelleMacchine = 'cd_macchine';

/// Le due famiglie, con la classe che Home Assistant usa per dichiararle, il
/// disegno e la parola della Config.
const famiglieDelleMacchine = <(String, String, String, String)>[
  ('macchine', 'running', '📦', 'Macchine e container'),
  ('rete', 'connectivity', '📶', 'Rete'),
];

/// Se questa entita' e' una candidata: un `binary_sensor` con una delle due
/// classi. La classe da sola pero' non basta — la mette anche la lavatrice e
/// ogni telefono — e per questo si adotta per integrazione.
String famigliaCandidata(Entita una) {
  if (!una.id.startsWith('binary_sensor.')) return '';
  final classe = _pulito(una.attributi['device_class']);
  for (final (famiglia, laClasse, _, _) in famiglieDelleMacchine) {
    if (classe == laClasse) return famiglia;
  }
  return '';
}

/// La configurazione delle macchine: le integrazioni da cui si adotta, le
/// escluse, le aggiunte con la loro famiglia, i nomi.
class Macchine {
  Macchine({
    List<String>? integrazioni,
    List<String>? escluse,
    Map<String, String>? aggiunte,
    Map<String, String>? nomi,
  }) : integrazioni = integrazioni ?? [],
       escluse = escluse ?? [],
       aggiunte = aggiunte ?? {},
       nomi = nomi ?? {};

  /// Come la legge la plancia (`normalizzaMacchine`).
  factory Macchine.da(Object? letto) {
    final dato = letto is Map
        ? Map<String, dynamic>.from(letto)
        : const <String, dynamic>{};
    final integrazioni = <String>{
      for (final una
          in (dato['integrazioni'] is List
              ? dato['integrazioni'] as List
              : const []))
        if (_pulito(una).isNotEmpty) _pulito(una),
    }.toList()..sort();
    final aggiunte = <String, String>{};
    if (dato['aggiunte'] is Map) {
      for (final voce in (dato['aggiunte'] as Map).entries) {
        final id = _pulito(voce.key);
        final quale = _pulito(voce.value);
        if (id.contains('.') &&
            famiglieDelleMacchine.any((f) => f.$1 == quale)) {
          aggiunte[id] = quale;
        }
      }
    }
    return Macchine(
      integrazioni: integrazioni,
      escluse: _elenco(dato['escluse']),
      aggiunte: aggiunte,
      nomi: _nomi(dato['nomi']),
    );
  }

  final List<String> integrazioni;
  final List<String> escluse;
  final Map<String, String> aggiunte;
  final Map<String, String> nomi;

  Map<String, dynamic> get daScrivere => {
    'integrazioni': [...integrazioni]..sort(),
    'escluse': escluse,
    'aggiunte': aggiunte,
    'nomi': nomi,
  };

  void aggiungi(String entita, String famiglia) {
    final id = _pulito(entita);
    if (!id.contains('.') ||
        !famiglieDelleMacchine.any((f) => f.$1 == famiglia)) {
      return;
    }
    aggiunte[id] = famiglia;
    escluse.remove(id);
  }

  void togli(String entita) {
    final id = _pulito(entita);
    if (!escluse.contains(id)) escluse.add(id);
    aggiunte.remove(id);
  }

  void rimetti(String entita) => escluse.remove(_pulito(entita));

  void chiama(String entita, String nome) {
    final id = _pulito(entita);
    if (_pulito(nome).isEmpty) {
      nomi.remove(id);
    } else {
      nomi[id] = _pulito(nome);
    }
  }

  void scegliIntegrazione(String dominio, bool scelta) {
    final quale = _pulito(dominio);
    integrazioni.remove(quale);
    if (scelta && quale.isNotEmpty) integrazioni.add(quale);
    integrazioni.sort();
  }
}

/* ── le batterie di casa (#398) ────────────────────────────────────────── */

/// Dove si scrive la soglia delle batterie.
const chiaveDelleBatterie = 'cd_batterie';

/// Il gruppo con cui la plancia sorveglia le batterie, dentro
/// `cd_gruppi_extra`, `cd_gruppi_removed` e `cd_avvisi_names_extra`: non e'
/// di questa scheda, e' di tutti.
const gruppoDelleBatterie = 'batt';

/// Venti e' quello che c'era: sotto il venti per cento una pila la si compra.
const sogliaPredefinitaDelleBatterie = 20;

/// Oltre il novanta non si sta piu' avvisando.
const sogliaMassimaDelleBatterie = 90;

/// La soglia scritta in configurazione, o quella di serie: un intero fra uno
/// e novanta.
int sogliaDelleBatterie(Object? letto) {
  final scritta = letto is Map ? letto['soglia'] : null;
  final numero = scritta is num
      ? scritta
      : num.tryParse('${scritta ?? ''}'.trim());
  if (numero == null || !numero.isFinite) return sogliaPredefinitaDelleBatterie;
  return numero.clamp(1, sogliaMassimaDelleBatterie).round();
}

/// Se questa entita' e' una batteria che ha senso guardare: deve dire una
/// percentuale. Un `device_class: battery` che risponde `on` e `off` e'
/// l'allarme «batteria scarica» di certi sensori, non un livello.
bool eUnaBatteria(Entita una) =>
    _pulito(una.attributi['device_class']) == 'battery' &&
    _pulito(una.attributi['unit_of_measurement']) == '%';

/// Il livello di una batteria, o `null` se non e' un numero.
num? livelloDellaBatteria(Entita una) => num.tryParse(una.stato);
