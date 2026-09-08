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
