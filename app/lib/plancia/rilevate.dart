/// Le tessere che nessuno configura: le rileva Home Assistant.
///
/// Batterie, aria, fumo e gas, allagamenti. Non c'e' una sezione da riempire
/// e non c'e' niente da scegliere: chi ha in casa un sensore di quelli se lo
/// ritrova in Home, perche' e' Home Assistant a dire cos'e' un rilevatore di
/// fumo — `device_class: smoke` — non il nome che gli e' stato dato.
///
/// L'elenco viene comunque prima dalla configurazione, quando c'e':
/// `cd_gruppi_extra` tiene quello che la persona ha aggiunto e
/// `cd_gruppi_removed` quello che ha tolto apposta, e una cosa tolta non deve
/// tornare al primo riavvio. Il rilevamento serve solo a riempire il vuoto —
/// ed e' lo stesso che fa la plancia web il primo giro, quindi i due elenchi
/// combaciano.
///
/// Le regole vengono da `flood-alerts-section.js`, `smoke-alerts-section.js`,
/// `aria-model.js` e dai modelli in `home-widgets-section.js`.
library;

import '../casa/entita.dart';
import 'configurazione.dart';
import 'numeri.dart';
import 'tessere.dart';

/// Come si guarda tutta la casa in una volta. Le tessere rilevate sono le
/// uniche che ne hanno bisogno: tutte le altre partono da un elenco scritto.
typedef Elenco = List<Entita> Function();

/* ─── Gli elenchi sorvegliati ────────────────────────────────────────────── */

/// Quello che la persona ha aggiunto a un gruppo, e quello che ne ha tolto.
class GruppiSorvegliati {
  const GruppiSorvegliati({required this.aggiunte, required this.tolte});

  factory GruppiSorvegliati.dalla(ConfigurazioneDellaPlancia config) =>
      GruppiSorvegliati(
        aggiunte: _perGruppo(config.grezzo('cd_gruppi_extra')),
        tolte: _perGruppo(config.grezzo('cd_gruppi_removed')),
      );

  final Map<String, List<String>> aggiunte;
  final Map<String, List<String>> tolte;

  static Map<String, List<String>> _perGruppo(Object? grezzo) {
    if (grezzo is! Map) return const {};
    final fuori = <String, List<String>>{};
    for (final voce in grezzo.entries) {
      final lista = voce.value;
      if (lista is! List) continue;
      fuori[pulito(voce.key)] = [
        for (final id in lista)
          if (pulito(id).isNotEmpty) pulito(id),
      ];
    }
    return fuori;
  }

  /// L'elenco di un gruppo: quello scritto se c'e', se no quello rilevato;
  /// meno quello tolto, e senza doppioni.
  ///
  /// Chi ha scritto un elenco ha gia' scelto, e il rilevamento sta zitto: se
  /// ne rimettesse dentro uno tolto apposta, non si farebbe mai pace.
  ///
  /// `visti` cambia la regola per il fumo, che e' l'unico gruppo a tenere un
  /// registro di quello che ha gia' incontrato: li' un rilevatore **nuovo**
  /// entra anche in un elenco scritto — l'antincendio comprato ieri deve
  /// comparire da solo — ma uno gia' visto e tolto resta fuori.
  List<String> elenco(
    String gruppo, {
    required List<String> rilevati,
    List<String>? visti,
  }) {
    final scritte = aggiunte[gruppo];
    final fuori = tolte[gruppo]?.toSet() ?? <String>{};
    final candidati = <String>[
      if (visti == null)
        ...(scritte ?? rilevati)
      else ...[
        ...?scritte,
        for (final id in rilevati)
          if (!visti.contains(id) && !(scritte?.contains(id) ?? false)) id,
      ],
    ];
    final viste = <String>{};
    return [
      for (final id in candidati)
        if (id.isNotEmpty && !fuori.contains(id) && viste.add(id)) id,
    ];
  }
}

/* ─── Le batterie ────────────────────────────────────────────────────────── */

/// Una batteria sorvegliata: quanta ne resta.
class LivelloDiBatteria {
  const LivelloDiBatteria({
    required this.entita,
    required this.nome,
    required this.livello,
  });

  final String entita;
  final String nome;
  final num livello;

  bool get scarica => livello <= sogliaDellaBatteria;
}

/// Sotto questa quota una batteria e' da cambiare.
const num sogliaDellaBatteria = 20;

/// Un sensore di batteria come lo dichiara Home Assistant: percentuale, non
/// «la batteria e' a posto» di un binario.
bool eUnaBatteria(Entita entita) =>
    entita.dominio == 'sensor' &&
    pulito(entita.attributi['device_class']) == 'battery' &&
    pulito(entita.attributi['unit_of_measurement']) == '%';

/* ─── L'aria ─────────────────────────────────────────────────────────────── */

/// Come sta una misura dell'aria, dal meglio al peggio.
enum GradoDellAria {
  buona('Buona'),
  discreta('Discreta'),
  scarsa('Scarsa'),
  cattiva('Cattiva');

  const GradoDellAria(this.parola);

  final String parola;
}

/// Una sostanza che sappiamo leggere, coi tre confini fra i quattro gradini.
class _Sostanza {
  const _Sostanza(this.simbolo, this.nome, this.soglie, [this.perUnita]);

  final String simbolo;
  final String nome;
  final List<num> soglie;

  /// La stessa sostanza in un'altra unita' sono altri numeri: i composti
  /// organici volatili si pubblicano in microgrammi o in parti per miliardo,
  /// e fra i due c'e' un fattore mille.
  final Map<String, List<num>>? perUnita;
}

const _sostanze = <String, _Sostanza>{
  'pm25': _Sostanza('🌫️', 'PM2.5', [15, 25, 50]),
  'pm10': _Sostanza('🌫️', 'PM10', [25, 50, 90]),
  'pm1': _Sostanza('🌫️', 'PM1', [10, 20, 40]),
  'carbon_dioxide': _Sostanza('🫁', 'Anidride carbonica', [800, 1000, 1400]),
  'carbon_monoxide': _Sostanza('☠️', 'Monossido di carbonio', [4.4, 9.4, 12.4]),
  'volatile_organic_compounds': _Sostanza(
    '🧪',
    'Composti organici volatili',
    [300, 1000, 3000],
    {
      'ppb': [65, 220, 660],
      'ppm': [0.065, 0.22, 0.66],
    },
  ),
  'volatile_organic_compounds_parts': _Sostanza(
    '🧪',
    'Composti organici volatili',
    [65, 220, 660],
    {
      'ppm': [0.065, 0.22, 0.66],
    },
  ),
  'nitrogen_dioxide': _Sostanza('🏭', 'Biossido di azoto', [40, 90, 120]),
  'ozone': _Sostanza('🌬️', 'Ozono', [100, 130, 240]),
  'sulphur_dioxide': _Sostanza('🏭', 'Biossido di zolfo', [100, 200, 350]),
  'aqi': _Sostanza('📈', "Indice di qualita' dell'aria", [50, 100, 150]),
};

/// La lettura di un sensore dell'aria: quanto, di che sostanza, e come sta.
class LetturaDellAria {
  const LetturaDellAria({
    required this.entita,
    required this.nome,
    required this.sostanza,
    required this.simbolo,
    required this.valore,
    required this.unita,
    required this.grado,
    required this.quanto,
  });

  final String entita;
  final String nome;
  final String sostanza;
  final String simbolo;
  final num valore;
  final String unita;
  final GradoDellAria grado;

  /// Quanto e' lontana dall'ultimo gradino, in centesimi: l'anello pieno vuol
  /// dire «guarda qui», non «va tutto bene».
  final int quanto;

  /// Il numero con la sua unita': «412 ppm», «12,4 µg/m³».
  String get scritto {
    final cifre = valore.abs() >= 100 ? 0 : 1;
    return '${numero(valore, cifre: cifre)}${unita.isEmpty ? '' : ' $unita'}';
  }
}

/// Se un'entita' e' una misura dell'aria: lo dice Home Assistant, non il nome.
bool eUnaMisuraDellAria(Entita entita) =>
    entita.dominio == 'sensor' &&
    _sostanze.containsKey(pulito(entita.attributi['device_class']));

/// La lettura di un sensore, o niente quando non si sa leggere: una casella
/// vuota in mezzo alle altre e' peggio di una casella in meno.
LetturaDellAria? letturaDellAria(Entita entita, String nome) {
  final classe = pulito(entita.attributi['device_class']);
  final sostanza = _sostanze[classe];
  if (sostanza == null) return null;
  final valore = comeNumero(entita.stato);
  if (valore == null) return null;
  final unita = pulito(entita.attributi['unit_of_measurement']);
  final soglie = sostanza.perUnita?[unita.toLowerCase()] ?? sostanza.soglie;
  final grado = valore <= soglie[0]
      ? GradoDellAria.buona
      : valore <= soglie[1]
      ? GradoDellAria.discreta
      : valore <= soglie[2]
      ? GradoDellAria.scarsa
      : GradoDellAria.cattiva;
  final fondo = soglie[2] == 0 ? 1 : soglie[2];
  return LetturaDellAria(
    entita: entita.id,
    nome: nome,
    sostanza: sostanza.nome,
    simbolo: sostanza.simbolo,
    valore: valore,
    unita: unita,
    grado: grado,
    quanto: (valore / fondo * 100).round().clamp(0, 100),
  );
}

/// Il giudizio di un insieme di letture: il peggiore, perche' l'aria di una
/// casa e' buona quando lo sono tutte le sue misure.
LetturaDellAria? peggioreDellAria(List<LetturaDellAria> letture) {
  if (letture.isEmpty) return null;
  return letture.reduce(
    (peggio, voce) => voce.grado.index > peggio.grado.index ? voce : peggio,
  );
}

/// Cosa c'e' da sapere, in una frase: il numero da solo non dice niente.
String fraseDellAria(List<LetturaDellAria> letture) {
  final peggiore = peggioreDellAria(letture);
  if (peggiore == null) return '';
  final dove = peggiore.nome.isEmpty ? '' : ' (${peggiore.nome})';
  final misura = '${peggiore.sostanza} ${peggiore.scritto}';
  final testa = letture.length > 1
      ? "Fra ${letture.length} misure, la peggiore e' $misura$dove."
      : '$misura$dove.';
  if (peggiore.sostanza.startsWith('Anidride') &&
      (peggiore.grado == GradoDellAria.scarsa ||
          peggiore.grado == GradoDellAria.cattiva)) {
    return '$testa Aprire una finestra la fa scendere in fretta.';
  }
  if (peggiore.grado == GradoDellAria.buona) {
    return "$testa Non c'e' niente da fare.";
  }
  return testa;
}

/* ─── Fumo, gas e allagamenti ────────────────────────────────────────────── */

/// Le classi che il rilevamento del fumo riconosce: Home Assistant le dichiara
/// tutte con lo stesso vocabolario, e il monossido sta nella stessa famiglia.
const classiDelFumo = ['smoke', 'gas', 'carbon_monoxide'];

bool eUnRilevatoreDiFumo(Entita entita) =>
    entita.dominio == 'binary_sensor' &&
    classiDelFumo.contains(
      pulito(entita.attributi['device_class']).toLowerCase(),
    );

bool eUnSensoreDiAllagamento(Entita entita) =>
    entita.dominio == 'binary_sensor' &&
    pulito(entita.attributi['device_class']).toLowerCase() == 'moisture';

/// `on` e' fumo rilevato, o acqua per terra: come ogni sensore binario.
bool suona(Entita? letto) => pulito(letto?.stato).toLowerCase() == 'on';

/* ─── Le tessere ─────────────────────────────────────────────────────────── */

/// Le quattro tessere rilevate, nell'ordine in cui la Home le vuole.
///
/// `leggi` serve a rileggere una per una le entita' scritte in configurazione;
/// `elenco` a guardare tutta la casa quando la configurazione tace.
List<Tessera> tessereRilevate(
  ConfigurazioneDellaPlancia config,
  Leggi leggi,
  Elenco elenco,
) {
  final c = _Rilevatore(config, leggi, elenco);
  return [?_batterie(c), ?_allagamenti(c), ?_fumo(c), ?_aria(c)];
}

class _Rilevatore {
  _Rilevatore(this.config, this._leggi, this._elenco)
    : gruppi = GruppiSorvegliati.dalla(config),
      _nomiScelti = _nomiDati(config);

  final ConfigurazioneDellaPlancia config;
  final Leggi _leggi;
  final Elenco _elenco;
  final GruppiSorvegliati gruppi;
  final Map<String, String> _nomiScelti;
  List<Entita>? _casa;

  /// Tutta la casa, letta una volta sola anche se la guardano in quattro.
  List<Entita> get casa => _casa ??= _elenco();

  Entita? stato(String id) => _leggi(id);

  bool dentro(String entita) => config.widget.dentro(entita);

  /// Prima il nome che la persona ha scritto, poi quello di Home Assistant:
  /// un nome dato una volta vale ovunque.
  String nome(String id) {
    final scelto = _nomiScelti[id];
    if (scelto != null && scelto.isNotEmpty) return scelto;
    final amichevole = pulito(stato(id)?.attributi['friendly_name']);
    if (amichevole.isNotEmpty) return amichevole;
    final coda = id.split('.').skip(1).join('.').replaceAll('_', ' ').trim();
    if (coda.isEmpty) return id;
    return coda[0].toUpperCase() + coda.substring(1);
  }

  /// Le entita' di un gruppo, gia' passate al setaccio dei widget esclusi.
  List<String> gruppo(
    String nome, {
    required bool Function(Entita) rileva,
    List<String>? visti,
    int massimo = 80,
  }) {
    final rilevati = [
      for (final una in casa)
        if (rileva(una)) una.id,
    ]..sort();
    return gruppi
        .elenco(nome, rilevati: rilevati.take(massimo).toList(), visti: visti)
        .where(dentro)
        .toList();
  }

  static Map<String, String> _nomiDati(ConfigurazioneDellaPlancia config) {
    final grezzo = config.grezzo('cd_avvisi_names_extra');
    if (grezzo is! Map) return const {};
    return {
      for (final voce in grezzo.entries) pulito(voce.key): pulito(voce.value),
    };
  }

  /// I rilevatori di fumo gia' incontrati un'altra volta.
  List<String> get fumoGiaVisto {
    final grezzo = config.grezzo('cd_fumo_rilevato');
    if (grezzo is! List) return const [];
    return [
      for (final id in grezzo)
        if (pulito(id).isNotEmpty) pulito(id),
    ];
  }
}

Tessera? _batterie(_Rilevatore c) {
  final entita = c.gruppo('batt', rileva: eUnaBatteria);
  if (entita.isEmpty) return null;
  final livelli = <LivelloDiBatteria>[
    for (final id in entita)
      if (comeNumero(c.stato(id)?.stato) case final livello?)
        LivelloDiBatteria(entita: id, nome: c.nome(id), livello: livello),
  ]..sort((una, altra) => una.livello.compareTo(altra.livello));
  final scariche = livelli.where((una) => una.scarica).toList();
  /* A batterie piene la tessera non c'e': e' un avviso, e un avviso che si
   * accende sempre non avvisa piu' nessuno. */
  if (scariche.isEmpty) return null;
  return Tessera(
    chiave: 'batterie',
    colore: '#eab308',
    etichetta: 'Batterie',
    allarme: true,
    valore: '${scariche.length}',
    didascalia:
        '${scariche.first.nome} ${numero(scariche.first.livello, cifre: 0)}%',
    anello: (scariche.length / livelli.length * 100).round(),
    righe: [
      for (final una in livelli)
        Riga(
          entita: una.entita,
          nome: una.nome,
          grezzo: una.livello,
          valore: '${numero(una.livello, cifre: 0)}%',
          acceso: una.scarica,
          simbolo: una.scarica ? '🪫' : '🔋',
        ),
    ],
  );
}

const _coloriDellAria = {
  GradoDellAria.buona: '#16a34a',
  GradoDellAria.discreta: '#f59e0b',
  GradoDellAria.scarsa: '#f97316',
  GradoDellAria.cattiva: '#dc2626',
};

Tessera? _aria(_Rilevatore c) {
  final letture =
      <LetturaDellAria>[
        for (final una in c.casa)
          if (eUnaMisuraDellAria(una) && c.dentro(una.id))
            if (letturaDellAria(una, c.nome(una.id)) case final lettura?)
              lettura,
      ]..sort((una, altra) {
        final sostanza = una.sostanza.compareTo(altra.sostanza);
        return sostanza != 0 ? sostanza : una.nome.compareTo(altra.nome);
      });
  final peggiore = peggioreDellAria(letture);
  if (peggiore == null) return null;
  return Tessera(
    chiave: 'aria',
    colore: _coloriDellAria[peggiore.grado]!,
    etichetta: 'Aria',
    /* Rossa in cima come gli allagamenti solo quando l'aria e' da cambiare. */
    allarme: peggiore.grado == GradoDellAria.cattiva,
    valore: peggiore.scritto,
    didascalia: '${peggiore.grado.parola} · ${peggiore.sostanza}',
    anello: peggiore.quanto,
    righe: [
      for (final lettura in letture)
        Riga(
          entita: lettura.entita,
          nome: lettura.nome,
          simbolo: lettura.simbolo,
          grezzo: lettura.valore,
          valore: lettura.scritto,
          acceso: lettura.grado.index >= GradoDellAria.scarsa.index,
        ),
    ],
  );
}

Tessera? _fumo(_Rilevatore c) {
  final entita = c.gruppo(
    'fumo',
    rileva: eUnRilevatoreDiFumo,
    visti: c.fumoGiaVisto,
  );
  if (entita.isEmpty) return null;
  final righe = [
    for (final id in entita)
      Riga(
        entita: id,
        nome: c.nome(id),
        acceso: suona(c.stato(id)),
        valore: suona(c.stato(id)) ? 'Fumo rilevato' : 'Tranquillo',
        simbolo: suona(c.stato(id)) ? '🔥' : '💨',
        daQuando: c.stato(id)?.cambiataIl,
      ),
  ];
  final suonano = righe.where((r) => r.acceso == true).toList();
  /* La tessera resta anche a casa tranquilla, e dice quanti ne sta guardando:
   * una sentinella che si vede solo a disastro avvenuto non permette di
   * accorgersi che ha smesso di guardare. */
  return Tessera(
    chiave: 'fumo',
    colore: suonano.isEmpty ? '#94a3b8' : '#ef4444',
    etichetta: 'Fumo e gas',
    allarme: suonano.isNotEmpty,
    attiva: suonano.isNotEmpty,
    valore: '${suonano.isEmpty ? righe.length : suonano.length}',
    didascalia: suonano.isEmpty
        ? 'Tutto tranquillo'
        : suonano.map((r) => r.nome).join(' · '),
    anello: suonano.isEmpty ? 0 : 100,
    righe: [...suonano, ...righe.where((r) => r.acceso != true)],
  );
}

Tessera? _allagamenti(_Rilevatore c) {
  final entita = c.gruppo('allag', rileva: eUnSensoreDiAllagamento);
  if (entita.isEmpty) return null;
  final righe = [
    for (final id in entita)
      Riga(
        entita: id,
        nome: c.nome(id),
        acceso: suona(c.stato(id)),
        valore: suona(c.stato(id)) ? 'Bagnato' : 'Asciutto',
        simbolo: suona(c.stato(id)) ? '🌊' : '💧',
        daQuando: c.stato(id)?.cambiataIl,
      ),
  ];
  final bagnati = righe.where((r) => r.acceso == true).toList();
  return Tessera(
    chiave: 'allagamenti',
    colore: bagnati.isEmpty ? '#94a3b8' : '#38bdf8',
    etichetta: 'Allagamenti',
    allarme: bagnati.isNotEmpty,
    attiva: bagnati.isNotEmpty,
    valore: '${bagnati.isEmpty ? righe.length : bagnati.length}',
    didascalia: bagnati.isEmpty
        ? 'Tutto asciutto'
        : bagnati.map((r) => r.nome).join(' · '),
    anello: bagnati.isEmpty ? 0 : 100,
    righe: [...bagnati, ...righe.where((r) => r.acceso != true)],
  );
}
