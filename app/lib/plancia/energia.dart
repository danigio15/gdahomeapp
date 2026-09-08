/// L'energia: cosa entra, cosa esce, e dove va a finire.
///
/// Quattro numeri rispondono a tutto: quanto produce il sole, quanto consuma
/// la casa, quanto si sta prendendo dalla rete (o dandole), e come sta la
/// batteria. Il segno della rete e' l'unica cosa che va letta bene: **positivo
/// si preleva, negativo si immette** — invertirlo vuol dire raccontare che si
/// sta guadagnando mentre si sta pagando.
///
/// Gli impianti possono essere piu' d'uno: chi ha unito due appartamenti ha
/// due contatori e una casa sola. Il primo sta nelle chiavi canoniche, gli
/// altri in `plants` accanto; e chi non ha mappato niente a mano puo' avere
/// tutto dietro i riferimenti `dm.*` dell'editor, che valgono solo per il
/// primo.
library;

import '../casa/entita.dart';
import 'configurazione.dart';
import 'numeri.dart';
import 'tessere.dart';

/// I quattro gruppi, nell'ordine in cui si leggono.
enum GruppoDiEnergia {
  casa('house', 'Casa', 'dm.energy_potenza_consumo_casa'),
  solare('solar', 'Solare', 'dm.energy_potenza_fotovoltaico'),
  rete('grid', 'Rete', 'dm.energy_potenza_scambio_rete'),
  batteria('battery', 'Batteria', 'dm.energy_potenza_batteria');

  const GruppoDiEnergia(this.chiave, this.nome, this.riferimento);

  /// Come si chiama nella configurazione: `house`, `solar`, `grid`, `battery`.
  final String chiave;
  final String nome;

  /// Il riferimento dell'editor, che vale solo per il primo impianto.
  final String riferimento;
}

/// Una riga di potenza: un gruppo, i suoi watt, e — per la batteria — la
/// carica.
typedef RigaDiEnergia = ({GruppoDiEnergia gruppo, num? watt, num? carica});

/// Quanto costa e quanto rende un kilowattora, come sta scritto in
/// configurazione.
class PrezziDellEnergia {
  const PrezziDellEnergia({required this.costo, required this.immissione});

  factory PrezziDellEnergia.dalla(ConfigurazioneDellaPlancia config) =>
      PrezziDellEnergia(
        costo: comeNumero(config.grezzo('cd_costo_kwh')),
        immissione: comeNumero(config.grezzo('cd_prezzo_immissione')),
      );

  /// Quanto si paga un kWh prelevato.
  final num? costo;

  /// Quanto si incassa per un kWh immesso.
  final num? immissione;

  bool get ceNe => costo != null || immissione != null;

  /// Quanto costa quello che si e' consumato oggi.
  num? spesaDi(num? kwh) => kwh == null || costo == null ? null : kwh * costo!;
}

/// La lettura di un impianto: le potenze adesso e i totali di oggi.
class LetturaDellImpianto {
  const LetturaDellImpianto({
    required this.id,
    required this.nome,
    required this.righe,
    required this.casa,
    required this.solare,
    required this.rete,
    required this.batteria,
    required this.carica,
    required this.oggi,
    required this.solareOggi,
    required this.prelevatoOggi,
    required this.immessoOggi,
  });

  final String id;
  final String nome;
  final List<RigaDiEnergia> righe;

  /// I watt di adesso, gruppo per gruppo.
  final num? casa;
  final num? solare;
  final num? rete;
  final num? batteria;

  /// Quanto e' carica, da 0 a 100.
  final num? carica;

  /// I kilowattora di oggi.
  final num? oggi;
  final num? solareOggi;
  final num? prelevatoOggi;
  final num? immessoOggi;

  /// `true` quando dalla rete si sta prendendo. Il segno lo dice: positivo si
  /// preleva, negativo si immette.
  bool get siPreleva => (rete ?? 0) > 0;
  bool get siImmette => (rete ?? 0) < 0;

  /// La batteria si sta caricando quando i suoi watt sono positivi.
  bool get siCarica => (batteria ?? 0) > 0;
  bool get siScarica => (batteria ?? 0) < 0;

  /// Quanta parte del consumo di casa se la sta facendo il sole, da 0 a 100.
  ///
  /// `null` quando manca un pezzo: una percentuale inventata su un numero che
  /// non c'e' e' peggio di nessuna percentuale.
  int? get quotaDelSole {
    if (casa == null || solare == null || casa! <= 0) return null;
    final dalSole = solare! > casa! ? casa! : solare!;
    return (dalSole / casa! * 100).round().clamp(0, 100);
  }

  bool get ceQualcosa => righe.isNotEmpty || casa != null;
}

/// Un carico: una cosa di casa che consuma, con quanto consuma.
class Carico {
  Carico._(Map grezzo, int posto)
    : id = pulito(grezzo['id']).isNotEmpty
          ? pulito(grezzo['id'])
          : 'carico-${posto + 1}',
      nome = pulito(grezzo['name']),
      icona = pulito(grezzo['icon']),
      colore = pulito(grezzo['color']),
      stanzaId = pulito(grezzo['room_id']),
      potenza = pulito(grezzo['power_entity']),
      /* Le due liste dei carichi scrivono la stessa cosa con due nomi:
       * `energyLoads` — quella della pagina Energia — dice `energy_entity`,
       * `loads` dice `daily_energy_entity`. Si guardano tutt'e due, se no
       * meta' delle case perde i kilowattora di oggi. */
      oggi = pulito(grezzo['energy_entity']).isNotEmpty
          ? pulito(grezzo['energy_entity'])
          : pulito(grezzo['daily_energy_entity']),
      mese = pulito(grezzo['monthly_energy_entity']),
      totale = pulito(grezzo['total_energy_entity']),
      ordine = comeNumero(grezzo['order'])?.toInt() ?? posto,
      /* Chi ha spento «mostra in plancia» lo ha fatto apposta: un carico che
       * si compila solo a mano, per il rapporto di fine mese, in plancia
       * sarebbe una riga che non si muove mai. */
      inPlancia = grezzo['show_in_dashboard'] != false;

  final String id;
  final String nome;
  final String icona;
  final String colore;
  final String stanzaId;
  final String potenza;
  final String oggi;
  final String mese;
  final String totale;
  final int ordine;
  final bool inPlancia;

  String get etichetta => nome.isEmpty ? id : nome;
}

/// Quanto sta consumando un carico adesso, e quanto ha consumato oggi.
typedef LetturaDelCarico = ({Carico carico, num? watt, num? oggi});

/* ─── Leggere ────────────────────────────────────────────────────────────── */

/// Le letture di tutti gli impianti configurati, il primo per primo.
List<LetturaDellImpianto> lettureDegliImpianti(
  ConfigurazioneDellaPlancia config,
  Leggi leggi,
) {
  final impianti = config.impianti;
  if (impianti.isEmpty) return const [];
  return [
    for (final impianto in impianti)
      if (impianto.posto == 0 || impianto.configurato)
        letturaDellImpianto(config, leggi, impianto),
  ];
}

/// La lettura di un impianto.
LetturaDellImpianto letturaDellImpianto(
  ConfigurazioneDellaPlancia config,
  Leggi leggi,
  Impianto impianto,
) {
  /* I riferimenti `dm.*` valgono solo per il primo: sono le caselle che
   * l'editor riempie da se', e ce n'e' una serie sola. */
  final primo = impianto.posto == 0;

  Map<String, String> caselleDi(GruppoDiEnergia gruppo) => switch (gruppo) {
    GruppoDiEnergia.casa => impianto.casa,
    GruppoDiEnergia.solare => impianto.solare,
    GruppoDiEnergia.rete => impianto.rete,
    GruppoDiEnergia.batteria => impianto.batteria,
  };

  num? valore(
    GruppoDiEnergia gruppo,
    String casella, {
    String ripiego = '',
    bool inWatt = false,
  }) {
    final entita = pulito(caselleDi(gruppo)[casella]);
    final quale = entita.isNotEmpty ? entita : (primo ? ripiego : '');
    if (quale.isEmpty) return null;
    final letto = _risolvi(config, leggi, quale);
    if (letto == null) return null;
    final numeroLetto = comeNumero(letto.stato);
    if (numeroLetto == null) return null;
    if (!inWatt) return numeroLetto;
    /* Chi pubblica in kilowatt lo dichiara nell'unita': moltiplicare a
     * occhio vorrebbe dire sbagliare di mille su meta' delle case. */
    final unita = pulito(letto.attributi['unit_of_measurement']).toLowerCase();
    return unita == 'kw' ? numeroLetto * 1000 : numeroLetto;
  }

  final potenze = <GruppoDiEnergia, num?>{
    for (final gruppo in GruppoDiEnergia.values)
      gruppo: valore(
        gruppo,
        'power',
        ripiego: gruppo.riferimento,
        inWatt: true,
      ),
  };
  final carica = valore(
    GruppoDiEnergia.batteria,
    'soc',
    ripiego: 'dm.energy_stato_carica_batteria',
  );

  return LetturaDellImpianto(
    id: impianto.id,
    nome: impianto.etichetta(),
    righe: [
      for (final gruppo in GruppoDiEnergia.values)
        if (potenze[gruppo] != null ||
            (gruppo == GruppoDiEnergia.batteria && carica != null))
          (
            gruppo: gruppo,
            watt: potenze[gruppo],
            carica: gruppo == GruppoDiEnergia.batteria ? carica : null,
          ),
    ],
    casa: potenze[GruppoDiEnergia.casa],
    solare: potenze[GruppoDiEnergia.solare],
    rete: potenze[GruppoDiEnergia.rete],
    batteria: potenze[GruppoDiEnergia.batteria],
    carica: carica,
    oggi: valore(
      GruppoDiEnergia.casa,
      'daily_energy',
      ripiego: 'dm.energy_consumo_casa_oggi',
    ),
    solareOggi: valore(GruppoDiEnergia.solare, 'daily_energy'),
    prelevatoOggi: valore(GruppoDiEnergia.rete, 'daily_import_energy'),
    immessoOggi: valore(GruppoDiEnergia.rete, 'daily_export_energy'),
  );
}

/// Gli impianti sommati in uno solo: chi ha unito due appartamenti ha una
/// casa sola.
///
/// Sommare due «non lo so» non fa zero, fa «non lo so»: uno zero al posto di
/// un buco e' una bugia che si legge come un dato.
LetturaDellImpianto sommaDegliImpianti(List<LetturaDellImpianto> letture) {
  num? somma(Iterable<num?> valori) {
    final veri = valori.whereType<num>().toList();
    return veri.isEmpty ? null : veri.reduce((a, b) => a + b);
  }

  /// La carica e' una media, non una somma: due batterie al 50% fanno 50%.
  num? media(Iterable<num?> valori) {
    final veri = valori.whereType<num>().toList();
    return veri.isEmpty ? null : veri.reduce((a, b) => a + b) / veri.length;
  }

  final casa = somma(letture.map((l) => l.casa));
  final solare = somma(letture.map((l) => l.solare));
  final rete = somma(letture.map((l) => l.rete));
  final batteria = somma(letture.map((l) => l.batteria));
  final carica = media(letture.map((l) => l.carica));
  final potenze = {
    GruppoDiEnergia.casa: casa,
    GruppoDiEnergia.solare: solare,
    GruppoDiEnergia.rete: rete,
    GruppoDiEnergia.batteria: batteria,
  };
  return LetturaDellImpianto(
    id: 'insieme',
    nome: 'Casa',
    righe: [
      for (final gruppo in GruppoDiEnergia.values)
        if (potenze[gruppo] != null ||
            (gruppo == GruppoDiEnergia.batteria && carica != null))
          (
            gruppo: gruppo,
            watt: potenze[gruppo],
            carica: gruppo == GruppoDiEnergia.batteria ? carica : null,
          ),
    ],
    casa: casa,
    solare: solare,
    rete: rete,
    batteria: batteria,
    carica: carica,
    oggi: somma(letture.map((l) => l.oggi)),
    solareOggi: somma(letture.map((l) => l.solareOggi)),
    prelevatoOggi: somma(letture.map((l) => l.prelevatoOggi)),
    immessoOggi: somma(letture.map((l) => l.immessoOggi)),
  );
}

/// I carichi da mostrare in plancia, in ordine.
List<Carico> carichiDellEnergia(ConfigurazioneDellaPlancia config) {
  final grezzi = config.sezione('energyLoads') ?? config.sezione('loads');
  if (grezzi is! List) return const [];
  final elenco = [
    for (final (posto, uno) in grezzi.indexed)
      if (uno is Map) Carico._(uno, posto),
  ]..sort((una, altra) => una.ordine.compareTo(altra.ordine));
  return [
    for (final carico in elenco)
      if (carico.inPlancia && carico.potenza.isNotEmpty) carico,
  ];
}

/// Quanto consuma ogni carico adesso.
List<LetturaDelCarico> lettureDeiCarichi(
  ConfigurazioneDellaPlancia config,
  Leggi leggi,
) => [
  for (final carico in carichiDellEnergia(config))
    (
      carico: carico,
      watt: _wattDi(config, leggi, carico.potenza),
      oggi: comeNumero(_risolvi(config, leggi, carico.oggi)?.stato),
    ),
];

num? _wattDi(ConfigurazioneDellaPlancia config, Leggi leggi, String entita) {
  final letto = _risolvi(config, leggi, entita);
  final valore = comeNumero(letto?.stato);
  if (valore == null) return null;
  final unita = pulito(letto!.attributi['unit_of_measurement']).toLowerCase();
  return unita == 'kw' ? valore * 1000 : valore;
}

/// Legge un'entita', passando dalle caselle dell'editor quando il nome
/// comincia per `dm.`.
Entita? _risolvi(
  ConfigurazioneDellaPlancia config,
  Leggi leggi,
  String riferimento,
) {
  final chiave = pulito(riferimento);
  if (chiave.isEmpty) return null;
  final diretta = leggi(chiave);
  if (diretta != null) return diretta;
  final risolta = chiave.startsWith('dm.') ? config.entita(chiave) : null;
  return risolta == null ? null : leggi(risolta);
}

/* ─── Il flusso: chi produce, chi consuma, dove finisce la differenza ────── */

/// Quale finestra di tempo si sta guardando.
///
/// Sono tre viste della stessa casa, e non tre pagine: nessuna delle tre ha
/// bisogno dello storico, perche' i kilowattora di oggi e del mese sono
/// contatori che la casa tiene gia' — vanno solo letti da un'altra casella.
enum PeriodoDellEnergia {
  adesso('Adesso'),
  oggi('Oggi'),
  mese('Mese');

  const PeriodoDellEnergia(this.titolo);
  final String titolo;
}

/// Un cerchio del flusso: quello che c'e' scritto dentro.
///
/// `secondo` c'e' dove una cosa sola non basta a dire com'e' andata: la rete
/// in un giorno ha preso e dato, e dire solo il saldo nasconde meta' della
/// storia. La batteria uguale, con quanto si e' caricata e quanto si e'
/// scaricata.
class NodoDelFlusso {
  const NodoDelFlusso({
    required this.chiave,
    required this.nome,
    required this.disegno,
    required this.colore,
    this.valore,
    this.unita = 'W',
    this.secondo,
    this.unitaDelSecondo = '',
    this.sotto = '',
    this.acceso = false,
  });

  final String chiave;
  final String nome;
  final String disegno;

  /// Il colore del cerchio e della linea che ne esce, come `#rrggbb`.
  final String colore;

  final num? valore;
  final String unita;

  /// Il secondo numero, dove ce n'e' uno.
  final num? secondo;
  final String unitaDelSecondo;

  /// Una riga piu' piccola sotto: la carica della batteria.
  final String sotto;

  /// Sta succedendo qualcosa: il cerchio si illumina e la sua linea scorre.
  final bool acceso;
}

/// Il flusso di un impianto in un dato periodo: i quattro cerchi grandi e i
/// carichi sotto.
class FlussoDellEnergia {
  const FlussoDellEnergia({
    required this.periodo,
    required this.solare,
    required this.rete,
    required this.batteria,
    required this.casa,
    required this.carichi,
  });

  final PeriodoDellEnergia periodo;
  final NodoDelFlusso solare;
  final NodoDelFlusso rete;
  final NodoDelFlusso batteria;
  final NodoDelFlusso casa;

  /// I carichi, al massimo cinque: sono i posti che il disegno ha.
  final List<NodoDelFlusso> carichi;

  bool get ceQualcosa =>
      solare.valore != null ||
      rete.valore != null ||
      batteria.valore != null ||
      casa.valore != null;
}

/// I colori dei cerchi, gli stessi della plancia.
const _coloreDelSole = '#f59e0b';
const _coloreDellaRete = '#1e40af';
const _coloreDellaBatteria = '#15803d';
const _coloreDellaCasa = '#0f172a';

/// I colori dei carichi, nell'ordine in cui si incontrano.
const _coloriDeiCarichi = [
  '#06b6d4',
  '#0ea5e9',
  '#e11d48',
  '#ea580c',
  '#7c3aed',
];

/// Il flusso, letto dalla casa.
FlussoDellEnergia flussoDellEnergia(
  ConfigurazioneDellaPlancia config,
  Leggi leggi, {
  required Impianto impianto,
  required PeriodoDellEnergia periodo,
  List<Carico> carichi = const [],
}) {
  /* La stessa lettura di `letturaDellImpianto`, e per gli stessi motivi: i
   * riferimenti `dm.*` valgono solo per il primo impianto, e chi pubblica in
   * kilowatt lo dichiara nell'unita'. */
  final primo = impianto.posto == 0;
  Map<String, String> caselleDi(GruppoDiEnergia gruppo) => switch (gruppo) {
    GruppoDiEnergia.casa => impianto.casa,
    GruppoDiEnergia.solare => impianto.solare,
    GruppoDiEnergia.rete => impianto.rete,
    GruppoDiEnergia.batteria => impianto.batteria,
  };
  num? casella(GruppoDiEnergia gruppo, String nome, {bool inWatt = false}) {
    final scritta = pulito(caselleDi(gruppo)[nome]);
    final quale = scritta.isNotEmpty
        ? scritta
        : (primo && nome == 'power' ? gruppo.riferimento : '');
    if (quale.isEmpty) return null;
    final letto = _risolvi(config, leggi, quale);
    final numeroLetto = letto == null ? null : comeNumero(letto.stato);
    if (numeroLetto == null) return null;
    if (!inWatt) return numeroLetto;
    final unita = pulito(letto!.attributi['unit_of_measurement']).toLowerCase();
    return unita == 'kw' ? numeroLetto * 1000 : numeroLetto;
  }

  final adesso = periodo == PeriodoDellEnergia.adesso;
  final quando = switch (periodo) {
    PeriodoDellEnergia.adesso => '',
    PeriodoDellEnergia.oggi => 'daily',
    PeriodoDellEnergia.mese => 'monthly',
  };
  final unita = adesso ? 'W' : 'kWh';

  final solare = adesso
      ? casella(GruppoDiEnergia.solare, 'power', inWatt: true)
      : casella(GruppoDiEnergia.solare, '${quando}_energy');
  final casa = adesso
      ? casella(GruppoDiEnergia.casa, 'power', inWatt: true)
      : casella(GruppoDiEnergia.casa, '${quando}_energy');
  final rete = adesso
      ? casella(GruppoDiEnergia.rete, 'power', inWatt: true)
      : null;
  final presa = adesso
      ? null
      : casella(GruppoDiEnergia.rete, '${quando}_import_energy');
  final data = adesso
      ? null
      : casella(GruppoDiEnergia.rete, '${quando}_export_energy');
  final batteria = adesso
      ? casella(GruppoDiEnergia.batteria, 'power', inWatt: true)
      : null;
  final caricata = adesso
      ? null
      : casella(GruppoDiEnergia.batteria, '${quando}_charged_energy');
  final scaricata = adesso
      ? null
      : casella(GruppoDiEnergia.batteria, '${quando}_discharged_energy');
  final carica = adesso ? casella(GruppoDiEnergia.batteria, 'soc') : null;

  return FlussoDellEnergia(
    periodo: periodo,
    solare: NodoDelFlusso(
      chiave: 'solare',
      nome: 'Solare',
      disegno: 'solare',
      colore: _coloreDelSole,
      valore: solare,
      unita: unita,
      acceso: (solare ?? 0) > 0,
    ),
    rete: NodoDelFlusso(
      chiave: 'rete',
      nome: 'Rete',
      disegno: 'energia',
      colore: _coloreDellaRete,
      valore: adesso ? rete : presa,
      unita: unita,
      secondo: data,
      unitaDelSecondo: unita,
      acceso: adesso
          ? (rete ?? 0).abs() > 0
          : (presa ?? 0) > 0 || (data ?? 0) > 0,
    ),
    batteria: NodoDelFlusso(
      chiave: 'batteria',
      nome: 'Batteria',
      disegno: 'batterie',
      colore: _coloreDellaBatteria,
      valore: adesso ? batteria : caricata,
      unita: unita,
      secondo: scaricata,
      unitaDelSecondo: unita,
      sotto: carica == null ? '' : '${numero(carica, cifre: 0)}%',
      acceso: adesso
          ? (batteria ?? 0).abs() > 0
          : (caricata ?? 0) > 0 || (scaricata ?? 0) > 0,
    ),
    casa: NodoDelFlusso(
      chiave: 'casa',
      nome: 'Casa',
      disegno: 'home',
      colore: _coloreDellaCasa,
      valore: casa,
      unita: unita,
      acceso: (casa ?? 0) > 0,
    ),
    carichi: [
      for (final (posto, carico) in carichi.take(5).indexed)
        _nodoDelCarico(config, leggi, carico, posto, periodo),
    ],
  );
}

NodoDelFlusso _nodoDelCarico(
  ConfigurazioneDellaPlancia config,
  Leggi leggi,
  Carico carico,
  int posto,
  PeriodoDellEnergia periodo,
) {
  final quale = switch (periodo) {
    PeriodoDellEnergia.adesso => carico.potenza,
    PeriodoDellEnergia.oggi => carico.oggi,
    PeriodoDellEnergia.mese => carico.mese,
  };
  final letto = quale.isEmpty ? null : _risolvi(config, leggi, quale);
  var valore = letto == null ? null : comeNumero(letto.stato);
  if (valore != null && periodo == PeriodoDellEnergia.adesso) {
    final unita = pulito(letto!.attributi['unit_of_measurement']).toLowerCase();
    if (unita == 'kw') valore *= 1000;
  }
  return NodoDelFlusso(
    chiave: carico.id,
    nome: carico.nome,
    disegno: disegnoDelCarico(carico.nome),
    colore: carico.colore.isNotEmpty
        ? carico.colore
        : _coloriDeiCarichi[posto % _coloriDeiCarichi.length],
    valore: valore,
    unita: periodo == PeriodoDellEnergia.adesso ? 'W' : 'kWh',
    acceso: (valore ?? 0) > 0,
  );
}

/// Che disegno dare a un carico, dal suo nome.
///
/// I carichi se li scrive chi configura, e non hanno una chiave da cui
/// ricavare il disegno: restano tutti uguali, e cinque cerchi con dentro la
/// stessa lavatrice non dicono niente. Il nome invece qualcosa lo dice quasi
/// sempre — «Wallbox», «Clima», «Boiler» — e dove non lo dice si torna al
/// disegno generico, che e' meglio di uno sbagliato.
String disegnoDelCarico(String nome) {
  final parola = nome.toLowerCase();
  bool ce(List<String> quali) => quali.any(parola.contains);
  if (ce(['wallbox', 'auto', 'ricarica', 'colonnina', 'ev'])) return 'ev';
  if (ce(['clima', 'condizion', 'pompa di calore', 'split'])) return 'clima';
  if (ce(['boiler', 'scaldabagno', 'scaldaacqua'])) return 'scaldabagno';
  if (ce(['caldaia', 'termo'])) return 'caldaia';
  if (ce(['luci', 'illumin'])) return 'luci';
  if (ce(['piscina', 'pompa'])) return 'piscina';
  if (ce(['irriga', 'giardino'])) return 'irrigazione';
  if (ce(['server', 'nas', 'rack', 'minipc'])) return 'minipc';
  if (ce(['forno', 'cucina', 'piano', 'induzione'])) return 'prese';
  return 'elettrodomestici';
}
