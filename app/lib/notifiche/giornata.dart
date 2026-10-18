/// «La tua giornata»: i numeri della casa di oggi, chiesti al ponte sul filo.
///
/// La risposta di `ponte/energia/giornata` (il contratto sta in
/// `ponte/src/notifiche.js`, `giornataDettagliata`) e' fatta di sezioni, e
/// **ognuna c'e' solo se in casa c'e' quello che serve**: senza auto niente
/// auto, senza solare termico niente acqua calda. Qui si legge tutto con
/// pazienza — un campo che manca, o di un tipo che non ci si aspetta, e'
/// `null`, e la sua sezione non si mostra — e niente solleva.
///
/// Solo numeri e nomi delle cose: nessun nome di persona, nessuna entita'. La
/// pagina che li mostra e' `schermate/la_tua_giornata.dart`.
///
/// La pagina e' di gdahome Premium: una casa Base risponde
/// `premium-richiesto`, e qui diventa un [PremiumRichiesto].
library;

import '../parole.dart';
import '../ponte/errori.dart';
import '../ponte/filo.dart';

/// Il comando del ponte.
const comandoDellaGiornata = 'ponte/energia/giornata';

/// La giornata, chiesta alla casa.
///
/// Solleva [PremiumRichiesto] se la casa non e' Premium; gli altri no del
/// ponte arrivano come sono (`ComandoRifiutato`, `FiloCaduto`).
Future<GiornataDellaCasa> chiediLaGiornata(Filo filo) async {
  try {
    final detto = await filo.risultato({
      'type': comandoDellaGiornata,
    }, entro: const Duration(seconds: 20));
    return GiornataDellaCasa.leggi(detto);
  } on ComandoRifiutato catch (no) {
    if (no.codice == 'premium-richiesto') {
      throw PremiumRichiesto(no.spiegazione);
    }
    rethrow;
  }
}

/* ─── leggere con pazienza ──────────────────────────────────────────────── */

double? _numero(Object? cosa) =>
    cosa is num && cosa.isFinite ? cosa.toDouble() : null;

int? _intero(Object? cosa) => _numero(cosa)?.round();

String? _testo(Object? cosa) =>
    cosa is String && cosa.trim().isNotEmpty ? cosa.trim() : null;

Map<String, dynamic>? _mappa(Object? cosa) =>
    cosa is Map ? cosa.map((k, v) => MapEntry('$k', v)) : null;

List<Map<String, dynamic>> _mappe(Object? cosa) => [
  if (cosa is List)
    for (final una in cosa)
      if (_mappa(una) case final m?) m,
];

/// Una serie ora per ora: `null` dove non si sa.
List<double?> _serie(Object? cosa) => [
  if (cosa is List)
    for (final uno in cosa) _numero(uno),
];

final _orario = RegExp(r'^\d{1,2}:\d{2}$');

String? _ora(Object? cosa) =>
    cosa is String && _orario.hasMatch(cosa.trim()) ? cosa.trim() : null;

/* ─── le sezioni ────────────────────────────────────────────────────────── */

/// Il sole, la casa, la rete: il taccuino dell'energia.
class EnergiaDelGiorno {
  const EnergiaDelGiorno({
    this.giorno,
    this.sole,
    this.casa,
    this.presi,
    this.ceduti,
    this.usato,
    this.quotaInCasa,
    this.euroRete,
    this.euroCeduti,
    this.risparmio,
    this.picco,
    this.piccoIl,
    this.prodotta = const [],
    this.consumata = const [],
    this.perFascia = const {},
  });

  final DateTime? giorno;

  /// kWh dal sole, dalla casa, presi e ceduti alla rete, usati del sole.
  final double? sole;
  final double? casa;
  final double? presi;
  final double? ceduti;
  final double? usato;

  /// Quanto del sole e' rimasto in casa, da 0 a 1.
  final double? quotaInCasa;
  final double? euroRete;
  final double? euroCeduti;
  final double? risparmio;

  /// kW, e l'ora.
  final double? picco;
  final String? piccoIl;

  /// kWh ora per ora (il ponte li manda in decimi: qui sono gia' kWh).
  final List<double> prodotta;
  final List<double> consumata;

  /// kWh presi dalla rete per fascia: indice → kWh.
  final Map<int, double> perFascia;

  static EnergiaDelGiorno? leggi(Object? grezzo) {
    final g = _mappa(grezzo);
    if (g == null) return null;
    List<double> decimi(Object? cosa) => [
      for (final uno in _serie(cosa)) (uno ?? 0) / 10,
    ];
    final fasce = _mappa(g['perFascia']) ?? const {};
    return EnergiaDelGiorno(
      giorno: DateTime.tryParse('${g['d'] ?? ''}'),
      sole: _numero(g['sole']),
      casa: _numero(g['casa']),
      presi: _numero(g['presi']),
      ceduti: _numero(g['ceduti']),
      usato: _numero(g['usato']),
      quotaInCasa: _numero(g['quotaInCasa']),
      euroRete: _numero(g['euroRete']),
      euroCeduti: _numero(g['euroCeduti']),
      risparmio: _numero(g['risparmio']),
      picco: _numero(g['picco']),
      piccoIl: _ora(g['piccoIl']),
      prodotta: decimi(g['p']),
      consumata: decimi(g['c']),
      perFascia: {
        for (final MapEntry(:key, :value) in fasce.entries)
          if (int.tryParse(key) case final i? when _numero(value) != null)
            i: _numero(value)!,
      },
    );
  }
}

/// Uno di quelli che hanno consumato di piu'.
class Consumatore {
  const Consumatore({
    required this.nome,
    required this.kwh,
    this.euro,
    this.sole,
  });
  final String nome;
  final double kwh;
  final double? euro;

  /// Quanto ne e' venuto dal sole, da 0 a 1.
  final double? sole;
}

/// La batteria di casa. Il ponte di prima dice solo la carica di stasera.
class BatteriaDiCasa {
  const BatteriaDiCasa({
    this.stasera,
    this.caricata,
    this.caricataDalSole,
    this.usata,
    this.massimo,
    this.massimoAlle,
    this.capacita,
  });

  /// Percento.
  final double? stasera;
  final double? caricata;

  /// Quanto della carica e' venuto dal sole, da 0 a 1.
  final double? caricataDalSole;
  final double? usata;
  final double? massimo;
  final String? massimoAlle;
  final double? capacita;

  static BatteriaDiCasa? leggi(Object? grezzo) {
    if (_numero(grezzo) case final carica?) {
      return BatteriaDiCasa(stasera: carica);
    }
    final b = _mappa(grezzo);
    if (b == null) return null;
    final letta = BatteriaDiCasa(
      stasera: _numero(b['stasera']),
      caricata: _numero(b['caricata']),
      caricataDalSole: _numero(b['caricataDalSole']),
      usata: _numero(b['usata']),
      massimo: _numero(b['massimo']),
      massimoAlle: _ora(b['massimoAlle']),
      capacita: _numero(b['capacita']),
    );
    return letta.stasera == null &&
            letta.caricata == null &&
            letta.usata == null &&
            letta.massimo == null
        ? null
        : letta;
  }
}

/// Le fasce: come si chiamano e, se il ponte lo sa, quanto costano.
class FasceDellaRete {
  const FasceDellaRete({this.nomi = const {}, this.prezzi = const {}});
  final Map<int, String> nomi;
  final Map<int, double> prezzi;

  /// `{nomi: {"0": "F1", …}, prezzi: {"F1": 0.175, …}}`: i prezzi stanno
  /// sotto il **nome** della fascia (o, da un ponte che li scrive cosi',
  /// sotto il suo indice). Una fascia senza nome e' «F» e il suo numero.
  static FasceDellaRete leggi(Object? grezzo) {
    final f = _mappa(grezzo);
    final scritti = _mappa(f?['nomi']) ?? const {};
    final prezzi = _mappa(f?['prezzi']) ?? const {};
    final nomi = <int, String>{
      for (final MapEntry(:key, :value) in scritti.entries)
        if (int.tryParse(key) case final i? when _testo(value) != null)
          i: _testo(value)!,
    };
    final perIndice = <int, double>{};
    for (final MapEntry(:key, :value) in prezzi.entries) {
      final prezzo = _numero(value);
      if (prezzo == null) continue;
      if (int.tryParse(key) case final i?) {
        perIndice[i] = prezzo;
        continue;
      }
      for (final MapEntry(key: i, value: nome) in nomi.entries) {
        if (nome == key) perIndice[i] = prezzo;
      }
      /* «F2» senza nomi: la fascia numero due, indice uno. */
      if (RegExp(r'^F(\d)$').firstMatch(key) case final m?
          when !nomi.containsValue(key)) {
        perIndice.putIfAbsent(int.parse(m.group(1)!) - 1, () => prezzo);
      }
    }
    return FasceDellaRete(nomi: nomi, prezzi: perIndice);
  }
}

/// Domani: il cielo ora per ora, fino a quando c'e' sole, il consiglio.
class Domani {
  const Domani({
    this.cielo = const [],
    this.soleFino,
    this.massima,
    this.consiglio,
  });

  /// `(ora, com'e')`: `sole`, `poco`, `nuvole`, `pioggia`.
  final List<(String, String)> cielo;
  final String? soleFino;
  final double? massima;
  final String? consiglio;

  static Domani? leggi(Object? grezzo) {
    final d = _mappa(grezzo);
    if (d == null) return null;
    final met = d['met'];
    final letto = Domani(
      cielo: [
        if (met is List)
          for (final uno in met)
            if (uno is List && uno.length >= 2) ('${uno[0]}', '${uno[1]}'),
      ],
      soleFino: _ora(d['soleFino']),
      massima: _numero(d['max'] ?? d['massima']),
      consiglio: _testo(d['consiglio']),
    );
    return letto.cielo.isEmpty &&
            letto.soleFino == null &&
            letto.consiglio == null
        ? null
        : letto;
  }
}

class StanzaDelClima {
  const StanzaDelClima({
    required this.nome,
    this.min,
    this.media,
    this.max,
    this.umidita,
    this.ore = const [],
  });
  final String nome;
  final double? min;
  final double? media;
  final double? max;
  final double? umidita;
  final List<double?> ore;
}

class ClimaDiCasa {
  const ClimaDiCasa({
    required this.stanze,
    this.fuoriMin,
    this.fuoriMax,
    this.fuori = const [],
  });
  final List<StanzaDelClima> stanze;
  final double? fuoriMin;
  final double? fuoriMax;
  final List<double?> fuori;

  static ClimaDiCasa? leggi(Object? grezzo) {
    final c = _mappa(grezzo);
    if (c == null) return null;
    final stanze = [
      for (final s in _mappe(c['stanze']).take(6))
        if (_testo(s['nome']) case final nome?)
          StanzaDelClima(
            nome: nome,
            min: _numero(s['min']),
            media: _numero(s['media']),
            max: _numero(s['max']),
            umidita: _numero(s['umidita']),
            ore: _serie(s['ore']),
          ),
    ];
    final fuori = _mappa(c['fuori']);
    if (stanze.isEmpty && fuori == null) return null;
    return ClimaDiCasa(
      stanze: stanze,
      fuoriMin: _numero(fuori?['min']),
      fuoriMax: _numero(fuori?['max']),
      fuori: _serie(fuori?['ore']),
    );
  }
}

class Riscaldamento {
  const Riscaldamento({
    this.minutiAcceso,
    this.comfort,
    this.range,
    this.obiettivo,
    this.finestreAperte,
    this.minutiClimaSpento,
    this.ieriMinuti,
  });
  final int? minutiAcceso;

  /// Percento del tempo nel [range].
  final double? comfort;
  final (double, double)? range;
  final double? obiettivo;
  final int? finestreAperte;
  final int? minutiClimaSpento;
  final int? ieriMinuti;

  static Riscaldamento? leggi(Object? grezzo) {
    final r = _mappa(grezzo);
    if (r == null) return null;
    final range = r['range'];
    final letto = Riscaldamento(
      minutiAcceso: _intero(r['minutiAcceso']),
      comfort: _numero(r['comfort']),
      range:
          range is List &&
              range.length == 2 &&
              _numero(range[0]) != null &&
              _numero(range[1]) != null
          ? (_numero(range[0])!, _numero(range[1])!)
          : null,
      obiettivo: _numero(r['obiettivo']),
      finestreAperte: _intero(r['finestreAperte']),
      minutiClimaSpento: _intero(r['minutiClimaSpento']),
      ieriMinuti: _intero(r['ieriMinuti']),
    );
    return letto.minutiAcceso == null && letto.comfort == null ? null : letto;
  }
}

class UnaTemperatura {
  const UnaTemperatura({this.massima, this.alle, this.ore = const []});
  final double? massima;
  final String? alle;
  final List<double?> ore;

  static UnaTemperatura? leggi(Object? grezzo) {
    final t = _mappa(grezzo);
    if (t == null) return null;
    return UnaTemperatura(
      massima: _numero(t['max']),
      alle: _ora(t['maxAlle']),
      ore: _serie(t['ore']),
    );
  }
}

class SolareTermico {
  const SolareTermico({
    this.collettore,
    this.bollitore,
    this.pompaMinuti,
    this.pompaDa,
    this.pompaA,
    this.caloreKwh,
    this.euro,
    this.pressione,
    this.resistenzaMinuti,
  });
  final UnaTemperatura? collettore;
  final UnaTemperatura? bollitore;
  final int? pompaMinuti;
  final String? pompaDa;
  final String? pompaA;
  final double? caloreKwh;
  final double? euro;
  final double? pressione;
  final int? resistenzaMinuti;

  static SolareTermico? leggi(Object? grezzo) {
    final s = _mappa(grezzo);
    if (s == null) return null;
    final pompa = _mappa(s['pompa']);
    final letto = SolareTermico(
      collettore: UnaTemperatura.leggi(s['collettore']),
      bollitore: UnaTemperatura.leggi(s['bollitore']),
      pompaMinuti: _intero(pompa?['minuti']),
      pompaDa: _ora(pompa?['da']),
      pompaA: _ora(pompa?['a']),
      caloreKwh: _numero(s['caloreKwh']),
      euro: _numero(s['euro']),
      pressione: _numero(s['pressione']),
      resistenzaMinuti: _intero(s['resistenzaMinuti']),
    );
    return letto.collettore == null && letto.bollitore == null ? null : letto;
  }
}

class Ricarica {
  const Ricarica({
    this.da,
    this.a,
    this.kwh,
    this.socDa,
    this.socA,
    this.quotaSole,
    this.euro,
  });
  final String? da;
  final String? a;
  final double? kwh;
  final double? socDa;
  final double? socA;
  final double? quotaSole;
  final double? euro;
}

class Viaggio {
  const Viaggio({this.da, this.a, this.soc, this.km, this.lento = false});
  final String? da;
  final String? a;

  /// Percento della batteria consumato.
  final double? soc;
  final double? km;
  final bool lento;
}

class AutoDelGiorno {
  const AutoDelGiorno({
    required this.nome,
    this.ricariche = const [],
    this.viaggi = const [],
    this.usatiKwh,
    this.usatiPct,
    this.km,
    this.kwh100,
    this.socStasera,
    this.soc = const [],
    this.kmStimati = false,
  });
  final String nome;

  /// Se i km sono stimati (dai kWh): allora si scrivono con «≈».
  final bool kmStimati;
  final List<Ricarica> ricariche;
  final List<Viaggio> viaggi;
  final double? usatiKwh;
  final double? usatiPct;
  final double? km;
  final double? kwh100;
  final double? socStasera;

  /// `(ora decimale, percento)`, per il grafico.
  final List<(double, double)> soc;

  static List<AutoDelGiorno> leggiTutte(Object? grezzo) => [
    for (final a in _mappe(grezzo))
      AutoDelGiorno(
        nome: _testo(a['nome']) ?? inLingua(it: 'Auto', en: 'Car'),
        ricariche: [
          for (final r in _mappe(a['ricariche']))
            Ricarica(
              da: _ora(r['da']),
              a: _ora(r['a']),
              kwh: _numero(r['kwh']),
              socDa: _numero(r['socDa']),
              socA: _numero(r['socA']),
              quotaSole: _numero(r['quotaSole']),
              euro: _numero(r['euro']),
            ),
        ],
        viaggi: [
          for (final v in _mappe(a['viaggi']))
            Viaggio(
              da: _ora(v['da']),
              a: _ora(v['a']),
              soc: _numero(v['soc']),
              km: _numero(v['km']),
              lento: v['lento'] == true,
            ),
        ],
        usatiKwh: _numero(a['usatiKwh']),
        usatiPct: _numero(a['usatiPct']),
        km: _numero(a['km']),
        kwh100: _numero(a['kwh100']),
        socStasera: _numero(a['socStasera']),
        kmStimati: a['kmStimati'] == true,
        soc: [
          if (a['soc'] case final List punti)
            for (final p in punti)
              if (p is List &&
                  p.length >= 2 &&
                  _numero(p[0]) != null &&
                  _numero(p[1]) != null)
                (_numero(p[0])!, _numero(p[1])!),
        ],
      ),
  ];
}

class AcquaEGas {
  const AcquaEGas({
    this.litri,
    this.ieriPct,
    this.gas,
    this.irrigazioneLitri,
    this.irrigazioneZone,
    this.irrigazioneAlle,
  });
  final double? litri;
  final double? ieriPct;
  final double? gas;
  final double? irrigazioneLitri;
  final int? irrigazioneZone;
  final String? irrigazioneAlle;

  bool get vuota => litri == null && gas == null && irrigazioneLitri == null;

  static AcquaEGas? leggi(Object? grezzo) {
    final a = _mappa(grezzo);
    if (a == null) return null;
    final irrigazione = _mappa(a['irrigazione']);
    final letta = AcquaEGas(
      litri: _numero(a['litri']),
      ieriPct: _numero(a['ieriPct']),
      gas: _numero(a['gas']),
      irrigazioneLitri: _numero(irrigazione?['litri']),
      irrigazioneZone: _intero(irrigazione?['zone']),
      irrigazioneAlle: _ora(irrigazione?['alle']),
    );
    return letta.vuota ? null : letta;
  }
}

class Conti {
  const Conti({this.porte, this.automazioni, this.avvisi});
  final int? porte;
  final int? automazioni;
  final int? avvisi;

  static Conti? leggi(Object? grezzo) {
    final c = _mappa(grezzo);
    if (c == null) return null;
    final letti = Conti(
      porte: _intero(c['porte']),
      automazioni: _intero(c['automazioni']),
      avvisi: _intero(c['avvisi']),
    );
    return letti.porte == null &&
            letti.automazioni == null &&
            letti.avvisi == null
        ? null
        : letti;
  }
}

class Confronto {
  const Confronto({this.ieriSolePct, this.settimanaPct, this.meseRetePct});
  final double? ieriSolePct;
  final double? settimanaPct;
  final double? meseRetePct;

  bool get vuoto =>
      ieriSolePct == null && settimanaPct == null && meseRetePct == null;
}

/// Una riga scritta dal ponte, con un'icona: «In breve», «Da sistemare».
class Riga {
  const Riga({required this.icona, required this.testo});
  final String icona;

  /// Con `**grassetto**` segnato cosi'.
  final String testo;

  static List<Riga> leggiTutte(Object? grezzo, {int quante = 8}) => [
    for (final r in _mappe(grezzo).take(quante))
      if (_testo(r['testo']) case final testo?)
        Riga(icona: _testo(r['icona']) ?? '', testo: testo),
  ];
}

/// Un fatto della giornata in casa, con l'ora.
class FattoDellaGiornata {
  const FattoDellaGiornata({required this.ora, required this.testo});
  final String ora;
  final String testo;
}

/// Tutta la giornata.
class GiornataDellaCasa {
  const GiornataDellaCasa({
    this.energia,
    this.conSole = false,
    this.piu = const [],
    this.ieri,
    this.media,
    this.record,
    this.batteria,
    this.fasce = const FasceDellaRete(),
    this.domani,
    this.clima,
    this.riscaldamento,
    this.solareTermico,
    this.auto = const [],
    this.acqua,
    this.eventi = const [],
    this.conti,
    this.meseEuro,
    this.confronto,
    this.daSistemare = const [],
    this.inBreve = const [],
  });

  final EnergiaDelGiorno? energia;
  final bool conSole;
  final List<Consumatore> piu;

  /// kWh del sole (o della casa, senza sole) di ieri e della settimana.
  final double? ieri;
  final double? media;

  /// `mese`, `anno`, o `null`.
  final String? record;
  final BatteriaDiCasa? batteria;
  final FasceDellaRete fasce;
  final Domani? domani;
  final ClimaDiCasa? clima;
  final Riscaldamento? riscaldamento;
  final SolareTermico? solareTermico;
  final List<AutoDelGiorno> auto;
  final AcquaEGas? acqua;
  final List<FattoDellaGiornata> eventi;
  final Conti? conti;

  /// Gli euro della rete dal primo del mese.
  final double? meseEuro;
  final Confronto? confronto;
  final List<Riga> daSistemare;
  final List<Riga> inBreve;

  /// Se non c'e' niente da mostrare.
  bool get vuota =>
      energia == null &&
      piu.isEmpty &&
      batteria == null &&
      domani == null &&
      clima == null &&
      riscaldamento == null &&
      solareTermico == null &&
      auto.isEmpty &&
      acqua == null &&
      eventi.isEmpty &&
      conti == null &&
      (confronto?.vuoto ?? true) &&
      daSistemare.isEmpty &&
      inBreve.isEmpty;

  static GiornataDellaCasa leggi(Object? grezzo) {
    final r = _mappa(grezzo) ?? const {};
    final confronto = _mappa(r['confronto']);
    final mese = _mappa(r['mese']);
    return GiornataDellaCasa(
      energia: EnergiaDelGiorno.leggi(r['giornata']),
      conSole: r['conSole'] == true,
      piu: [
        for (final c in _mappe(r['piu']).take(8))
          if (_testo(c['nome']) case final nome?)
            if (_numero(c['kwh']) case final kwh? when kwh > 0)
              Consumatore(
                nome: nome,
                kwh: kwh,
                euro: _numero(c['eur']),
                sole: _numero(c['sole']),
              ),
      ],
      ieri: _numero(r['ieri']),
      media: _numero(r['media']),
      record: _testo(r['record']),
      batteria: BatteriaDiCasa.leggi(r['batteria']),
      fasce: FasceDellaRete.leggi(r['fasce']),
      domani: Domani.leggi(r['domani']),
      clima: ClimaDiCasa.leggi(r['clima']),
      riscaldamento: Riscaldamento.leggi(r['riscaldamento']),
      solareTermico: SolareTermico.leggi(r['solareTermico']),
      auto: AutoDelGiorno.leggiTutte(r['auto']),
      acqua: AcquaEGas.leggi(r['acqua']),
      eventi: [
        for (final e in _mappe(r['eventi']).take(8))
          if ((_ora(e['ora']), _testo(e['testo'])) case (
            final ora?,
            final testo?,
          ))
            FattoDellaGiornata(ora: ora, testo: testo),
      ],
      conti: Conti.leggi(r['conti']),
      meseEuro: _numero(mese?['euro']),
      confronto: confronto == null
          ? null
          : Confronto(
              ieriSolePct: _numero(confronto['ieriSolePct']),
              settimanaPct: _numero(confronto['settimanaPct']),
              meseRetePct: _numero(confronto['meseRetePct']),
            ),
      daSistemare: Riga.leggiTutte(r['daSistemare']),
      inBreve: Riga.leggiTutte(r['inBreve'], quante: 4),
    );
  }
}

/* ─── i numeri come si dicono ──────────────────────────────────────────── */

/// «18,4» in italiano, «18.4» in inglese.
String decimaleDetto(double valore, int quanti) {
  final testo = valore.toStringAsFixed(quanti);
  return inLingua(it: testo.replaceAll('.', ','), en: testo);
}

String euroDetto(double valore) => inLingua(
  it: '${decimaleDetto(valore, 2)} €',
  en: '€${decimaleDetto(valore, 2)}',
);

/// «+12%», «−8%»: col meno vero, non il trattino.
String percentoConSegno(double valore) {
  final tondo = valore.round();
  if (tondo == 0) return '0%';
  return '${tondo > 0 ? '+' : '−'}${tondo.abs()}%';
}

/// «4 h 10 min», «35 min».
String minutiDetti(int minuti) {
  if (minuti < 60) return '$minuti min';
  final resto = minuti % 60;
  return resto == 0 ? '${minuti ~/ 60} h' : '${minuti ~/ 60} h $resto min';
}

/// Il nome del mese di una data, minuscolo in italiano.
String meseDi(DateTime data) => inLingua(
  it: const [
    'gennaio',
    'febbraio',
    'marzo',
    'aprile',
    'maggio',
    'giugno',
    'luglio',
    'agosto',
    'settembre',
    'ottobre',
    'novembre',
    'dicembre',
  ][data.month - 1],
  en: const [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ][data.month - 1],
);

/// «Domenica 18 ottobre», «Sunday October 18».
String giornoDetto(DateTime data) {
  final giorno = inLingua(
    it: const [
      'Lunedì',
      'Martedì',
      'Mercoledì',
      'Giovedì',
      'Venerdì',
      'Sabato',
      'Domenica',
    ][data.weekday - 1],
    en: const [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ][data.weekday - 1],
  );
  return inLingua(
    it: '$giorno ${data.day} ${meseDi(data)}',
    en: '$giorno ${meseDi(data)} ${data.day}',
  );
}
