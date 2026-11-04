/// La Salute dal telefono: cosa si legge, e come lo si porta a casa.
///
/// «Tutto questo non lo possiamo gestire direttamente da app gdahome?» Si'.
/// L'app legge le ultime misure da **Apple Salute** sull'iPhone (HealthKit:
/// anche quelle dell'Apple Watch) e da **Health Connect** su Android
/// (Galaxy Watch, Pixel Watch, Fitbit, Amazfit/Zepp, Withings, Garmin…), e le
/// manda al ponte di casa sullo stesso filo cifrato di tutto il resto. Il
/// ponte le scrive in Home Assistant come sensori
/// (`ponte/src/il-corpo-dal-telefono.js`) e la pagina Salute della plancia li
/// trova da sola, col nome della persona.
///
/// **Niente va da nessun'altra parte.** Il centralino, da fuori casa, porta
/// solo byte cifrati; non c'e' un nostro server che le riceva o le tenga.
/// L'app non scrive mai in Salute o in Health Connect: legge e basta.
///
/// Qui niente Flutter e niente piattaforma: si prova senza un telefono.
/// Leggere davvero lo fa [LettoreDellaSalute] (`lettore.dart`).
library;

import 'dart:convert';

import '../parole.dart';

/// Le misure: la chiave e' quella del ponte (`MISURE_DAL_TELEFONO`).
enum MisuraDelCorpo {
  passi,
  distanza,
  piani,
  battito,
  battitoRiposo,
  peso,
  grasso,
  sistolica,
  diastolica,
  ossigeno,
  sonno,
  calorie,
  calorieRiposo,
  esercizio,
  inPiedi;

  String get titolo => switch (this) {
    MisuraDelCorpo.passi => inLingua(it: 'Passi', en: 'Steps'),
    MisuraDelCorpo.distanza => inLingua(
      it: 'Distanza a piedi',
      en: 'Walking distance',
    ),
    MisuraDelCorpo.piani => inLingua(it: 'Piani saliti', en: 'Flights climbed'),
    MisuraDelCorpo.battito => inLingua(it: 'Battito', en: 'Heart rate'),
    MisuraDelCorpo.battitoRiposo => inLingua(
      it: 'Battito a riposo',
      en: 'Resting heart rate',
    ),
    MisuraDelCorpo.peso => inLingua(it: 'Peso', en: 'Weight'),
    MisuraDelCorpo.grasso => inLingua(it: 'Massa grassa', en: 'Body fat'),
    MisuraDelCorpo.sistolica => inLingua(
      it: 'Pressione massima',
      en: 'Systolic pressure',
    ),
    MisuraDelCorpo.diastolica => inLingua(
      it: 'Pressione minima',
      en: 'Diastolic pressure',
    ),
    MisuraDelCorpo.ossigeno => inLingua(it: 'Ossigeno', en: 'Blood oxygen'),
    MisuraDelCorpo.sonno => inLingua(it: 'Sonno', en: 'Sleep'),
    MisuraDelCorpo.calorie => inLingua(
      it: 'Calorie attive',
      en: 'Active calories',
    ),
    MisuraDelCorpo.calorieRiposo => inLingua(
      it: 'Calorie a riposo',
      en: 'Resting calories',
    ),
    MisuraDelCorpo.esercizio => inLingua(
      it: 'Minuti di esercizio',
      en: 'Exercise minutes',
    ),
    MisuraDelCorpo.inPiedi => inLingua(it: 'Ore in piedi', en: 'Stand hours'),
  };

  /// Come si legge, in una riga sotto il nome.
  String get comeSiLegge => switch (this) {
    MisuraDelCorpo.passi ||
    MisuraDelCorpo.piani ||
    MisuraDelCorpo.esercizio => inLingua(it: 'quelli di oggi', en: "today's"),
    MisuraDelCorpo.distanza => inLingua(it: 'quella di oggi', en: "today's"),
    MisuraDelCorpo.inPiedi || MisuraDelCorpo.calorieRiposo => inLingua(
      it: 'quelle di oggi',
      en: "today's",
    ),
    MisuraDelCorpo.battito => inLingua(it: "l'ultimo", en: 'the latest'),
    MisuraDelCorpo.battitoRiposo => inLingua(it: "l'ultimo", en: 'the latest'),
    MisuraDelCorpo.peso => inLingua(it: "l'ultima pesata", en: 'the latest'),
    MisuraDelCorpo.grasso => inLingua(it: "l'ultima pesata", en: 'the latest'),
    MisuraDelCorpo.sistolica || MisuraDelCorpo.diastolica => inLingua(
      it: "l'ultima misurazione",
      en: 'the latest reading',
    ),
    MisuraDelCorpo.ossigeno => inLingua(it: "l'ultimo", en: 'the latest'),
    MisuraDelCorpo.sonno => inLingua(it: "l'ultima notte", en: 'last night'),
    MisuraDelCorpo.calorie => inLingua(it: 'quelle di oggi', en: "today's"),
  };
}

/// Fin dove si guarda indietro per «l'ultimo» valore di una misura.
///
/// «In Salute il battito c'e', 73 il 1° novembre, ma l'app non lo vede»: il
/// battito si cercava solo negli ultimi due giorni, l'ossigeno anche, e un
/// orologio lasciato sul comodino un fine settimana bastava a farli sparire.
/// L'ultimo valore resta l'ultimo anche se ha qualche giorno: la data si
/// scrive accanto, nell'app e nella plancia, e chi legge decide.
///
/// Il tetto e' quello del ponte: una misura piu' vecchia di 45 giorni il
/// ponte non la scrive (`VECCHIA` in `ponte/src/il-corpo-dal-telefono.js`),
/// e cercarla piu' indietro vorrebbe dire mandarla per farla buttare.
const limiteDelPonte = Duration(days: 45);

/// Per misura: quanto indietro, al massimo. Passi e calorie sono «di oggi»,
/// il sonno e' «l'ultima notte» (`ilSonnoDiStanotte`).
Duration? finestraDellUltimo(MisuraDelCorpo misura) => switch (misura) {
  MisuraDelCorpo.battito ||
  MisuraDelCorpo.battitoRiposo ||
  MisuraDelCorpo.ossigeno => const Duration(days: 30),
  MisuraDelCorpo.peso ||
  MisuraDelCorpo.grasso ||
  MisuraDelCorpo.sistolica ||
  MisuraDelCorpo.diastolica => limiteDelPonte,
  MisuraDelCorpo.passi ||
  MisuraDelCorpo.distanza ||
  MisuraDelCorpo.piani ||
  MisuraDelCorpo.calorie ||
  MisuraDelCorpo.calorieRiposo ||
  MisuraDelCorpo.esercizio ||
  MisuraDelCorpo.inPiedi ||
  MisuraDelCorpo.sonno => null,
};

/// Le misure «di oggi»: si sommano da mezzanotte, e la casa le conta come
/// contatori che ripartono ogni mattina.
bool eDiOggi(MisuraDelCorpo misura) => switch (misura) {
  MisuraDelCorpo.passi ||
  MisuraDelCorpo.distanza ||
  MisuraDelCorpo.piani ||
  MisuraDelCorpo.calorie ||
  MisuraDelCorpo.calorieRiposo ||
  MisuraDelCorpo.esercizio ||
  MisuraDelCorpo.inPiedi => true,
  _ => false,
};

/// Se il telefono la sa dare. I minuti di esercizio e le ore in piedi sono
/// gli anelli dell'Apple Watch: Health Connect non li ha, e su Android non
/// si mostrano nemmeno.
bool siPuoLeggere(MisuraDelCorpo misura, {required bool iPhone}) =>
    iPhone ||
    (misura != MisuraDelCorpo.esercizio && misura != MisuraDelCorpo.inPiedi);

/// Gli scalini con cui si cerca: prima l'ultimo giorno, poi la settimana,
/// poi tutta la finestra. Un Apple Watch scrive un battito ogni pochi minuti:
/// chiedere trenta giorni di battiti per tenerne uno sarebbe chiederne
/// migliaia, e quasi sempre basta il primo scalino.
List<Duration> scaliniFinoA(Duration finestra) => [
  for (final d in const [Duration(days: 1), Duration(days: 7)])
    if (d < finestra) d,
  finestra,
];

/// Fin dove si cerca l'ultima notte: un orologio rimasto a caricare stanotte
/// non cancella quella di ieri.
const notteFinoA = Duration(days: 3);

/// Sveglio piu' di cosi' fra due tratti, e sono due sonni diversi.
const risveglioFinoA = Duration(hours: 2);

/// Un sonno piu' corto di cosi' e' un pisolino, non la notte.
const notteAlmeno = Duration(hours: 3);

/// Le misure accese di serie: quelle che quasi ogni orologio ha, e quelle
/// che Salute mostra per prime («Attività», distanza, piani).
const misureDiSerie = {
  MisuraDelCorpo.passi,
  MisuraDelCorpo.distanza,
  MisuraDelCorpo.piani,
  MisuraDelCorpo.battito,
  MisuraDelCorpo.battitoRiposo,
  MisuraDelCorpo.peso,
  MisuraDelCorpo.sistolica,
  MisuraDelCorpo.diastolica,
  MisuraDelCorpo.sonno,
  MisuraDelCorpo.calorie,
  MisuraDelCorpo.calorieRiposo,
  MisuraDelCorpo.esercizio,
  MisuraDelCorpo.inPiedi,
};

/// Le misure che c'erano prima di «Attività» (novembre 2026): chi le ha
/// scelte allora non ha mai visto le nuove, e le trova accese
/// ([ScelteDellaSalute.daQuelloCheCEra]). Quelle che si toglie dopo, restano
/// tolte.
const misureDiPrima = {
  MisuraDelCorpo.passi,
  MisuraDelCorpo.battito,
  MisuraDelCorpo.battitoRiposo,
  MisuraDelCorpo.peso,
  MisuraDelCorpo.grasso,
  MisuraDelCorpo.sistolica,
  MisuraDelCorpo.diastolica,
  MisuraDelCorpo.ossigeno,
  MisuraDelCorpo.sonno,
  MisuraDelCorpo.calorie,
};

/// Le scelte di questo telefono: se e' acceso, il nome, cosa si manda.
class ScelteDellaSalute {
  const ScelteDellaSalute({
    this.acceso = false,
    this.persona = '',
    this.misure = misureDiSerie,
    this.ultimoInvio,
    this.viste = const {...MisuraDelCorpo.values},
    this.adAppChiusa = true,
    this.ultimoDaChiusa = false,
    this.chiestoDaChiusa = false,
  });

  final bool acceso;

  /// Se le misure vanno a casa anche con l'app chiusa
  /// (`ad_app_chiusa.dart`). Acceso di serie: chi accende la Salute vuole
  /// la plancia aggiornata, non aggiornata solo quando apre l'app.
  final bool adAppChiusa;

  /// Se l'ultimo invio ([ultimoInvio]) e' partito ad app chiusa: la pagina
  /// lo scrive, cosi' si vede che funziona.
  final bool ultimoDaChiusa;

  /// Se il permesso di leggere ad app chiusa e' gia' stato chiesto: su
  /// Android e' un permesso a parte di Health Connect, e si chiede una volta
  /// sola, con l'app davanti. Su iPhone non serve.
  final bool chiestoDaChiusa;

  /// Il nome con cui la casa la chiama: «Marco». Vuoto, il ponte usa quello
  /// di «Di chi è questo telefono?».
  final String persona;
  final Set<MisuraDelCorpo> misure;
  final DateTime? ultimoInvio;

  /// Le misure che questo telefono ha gia' visto nell'elenco, e per cui il
  /// permesso e' gia' stato chiesto. Una misura nuova dell'app, di serie, si
  /// accende da sola; ma il permesso va chiesto ([daChiedere]).
  final Set<MisuraDelCorpo> viste;

  /// Le misure accese che il telefono non ha mai visto: di Salute o di
  /// Health Connect non c'e' ancora il permesso.
  Set<MisuraDelCorpo> get daChiedere => misure.difference(viste);

  ScelteDellaSalute con({
    bool? acceso,
    String? persona,
    Set<MisuraDelCorpo>? misure,
    DateTime? ultimoInvio,
    Set<MisuraDelCorpo>? viste,
    bool? adAppChiusa,
    bool? ultimoDaChiusa,
    bool? chiestoDaChiusa,
  }) => ScelteDellaSalute(
    acceso: acceso ?? this.acceso,
    persona: persona ?? this.persona,
    misure: misure ?? this.misure,
    ultimoInvio: ultimoInvio ?? this.ultimoInvio,
    viste: viste ?? this.viste,
    adAppChiusa: adAppChiusa ?? this.adAppChiusa,
    ultimoDaChiusa: ultimoDaChiusa ?? this.ultimoDaChiusa,
    chiestoDaChiusa: chiestoDaChiusa ?? this.chiestoDaChiusa,
  );

  /// Dopo aver chiesto il permesso: tutte viste.
  ScelteDellaSalute tutteViste() => con(viste: {...MisuraDelCorpo.values});

  Map<String, Object?> inJson() => {
    'acceso': acceso,
    'persona': persona,
    'misure': [for (final m in misure) m.name],
    'viste': [for (final m in viste) m.name],
    if (ultimoInvio != null) 'ultimo': ultimoInvio!.millisecondsSinceEpoch,
    'chiusa': adAppChiusa,
    if (ultimoDaChiusa) 'ultimoDaChiusa': true,
    if (chiestoDaChiusa) 'chiestoDaChiusa': true,
  };

  String get comeSiScrive => jsonEncode(inJson());

  static ScelteDellaSalute daQuelloCheCEra(Object? grezzo) {
    Object? letto = grezzo;
    if (grezzo is String) {
      try {
        letto = jsonDecode(grezzo);
      } catch (_) {
        return const ScelteDellaSalute();
      }
    }
    if (letto is! Map) return const ScelteDellaSalute();
    Set<MisuraDelCorpo>? daNomi(Object? nomi) => nomi is List
        ? {
            for (final nome in nomi)
              for (final m in MisuraDelCorpo.values)
                if (m.name == nome) m,
          }
        : null;
    final scelte = daNomi(letto['misure']);
    /* Chi ha scelto prima delle misure nuove non le ha mai viste: quelle
     * di serie le trova accese, e il permesso si chiede al primo invio. */
    final viste = daNomi(letto['viste']) ?? misureDiPrima;
    final misure = scelte == null
        ? misureDiSerie
        : {...scelte, ...misureDiSerie.difference(viste)};
    final ultimo = letto['ultimo'];
    return ScelteDellaSalute(
      acceso: letto['acceso'] == true,
      persona: personaPulita('${letto['persona'] ?? ''}'),
      misure: misure,
      viste: scelte == null ? const {...MisuraDelCorpo.values} : viste,
      ultimoInvio: ultimo is int
          ? DateTime.fromMillisecondsSinceEpoch(ultimo)
          : null,
      /* Chi l'aveva gia' accesa prima che ci fosse: acceso anche lui. */
      adAppChiusa: letto['chiusa'] != false,
      ultimoDaChiusa: letto['ultimoDaChiusa'] == true,
      chiestoDaChiusa: letto['chiestoDaChiusa'] == true,
    );
  }
}

/// Su iPhone, i tipi di Salute che svegliano l'app chiusa quando arriva un
/// dato nuovo (`ios/Runner/LaSaluteAdAppChiusa.swift`).
///
/// Non tutti quelli che si leggono: ogni tipo osservato e' una sveglia in
/// piu', e al risveglio si leggono e si mandano comunque **tutte** le misure
/// scelte. Bastano quelli che cambiano spesso — i passi e le calorie, che
/// l'iPhone scrive tutto il giorno — e quelli che arrivano di rado ma
/// contano subito: la notte, la pesata, la pressione.
Set<String> daOsservareSuIPhone(Set<MisuraDelCorpo> misure) => {
  for (final m in misure)
    switch (m) {
      MisuraDelCorpo.passi ||
      MisuraDelCorpo.distanza ||
      MisuraDelCorpo.piani => 'HKQuantityTypeIdentifierStepCount',
      MisuraDelCorpo.calorie ||
      MisuraDelCorpo.calorieRiposo ||
      MisuraDelCorpo.esercizio ||
      MisuraDelCorpo.inPiedi => 'HKQuantityTypeIdentifierActiveEnergyBurned',
      MisuraDelCorpo.battito ||
      MisuraDelCorpo.battitoRiposo ||
      MisuraDelCorpo.ossigeno => 'HKQuantityTypeIdentifierHeartRate',
      MisuraDelCorpo.sonno => 'HKCategoryTypeIdentifierSleepAnalysis',
      MisuraDelCorpo.peso ||
      MisuraDelCorpo.grasso => 'HKQuantityTypeIdentifierBodyMass',
      MisuraDelCorpo.sistolica || MisuraDelCorpo.diastolica =>
        'HKQuantityTypeIdentifierBloodPressureSystolic',
    },
};

/// Un nome di persona: parole corte, niente segni strani, al piu' 30.
String personaPulita(String testo) {
  final pulito = testo
      .replaceAll(RegExp(r'''[\u0000-\u001f<>"'`\\{}]'''), '')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
  return pulito.length > 30 ? pulito.substring(0, 30).trim() : pulito;
}

/// Una lettura: il valore e quando e' stata presa.
class Lettura {
  const Lettura(this.valore, this.quando);
  final double valore;
  final DateTime quando;

  /* Due decimali: 0,19 km di distanza con uno solo sarebbero 0,2. */
  Map<String, Object> inJson() => {
    'valore': (valore * 100).round() / 100,
    'quando': quando.toUtc().toIso8601String(),
  };
}

/// Un campione grezzo, com'e' uscito da Salute o da Health Connect.
class Campione {
  const Campione(this.valore, this.da, this.a);
  final double valore;
  final DateTime da;
  final DateTime a;
}

/// L'ultimo campione: il piu' recente per fine.
Lettura? lUltimo(Iterable<Campione> campioni) {
  Campione? ultimo;
  for (final c in campioni) {
    if (ultimo == null || c.a.isAfter(ultimo.a)) ultimo = c;
  }
  return ultimo == null ? null : Lettura(ultimo.valore, ultimo.a);
}

/// Una percentuale: Apple la da' come frazione (0,97), Health Connect come
/// numero (97). Qui sempre come numero.
double comePercentuale(double valore) => valore <= 1.0 ? valore * 100 : valore;

/// Le ore in piedi di oggi: le ore in cui l'Apple Watch dice «in piedi»
/// (`HKCategoryValueAppleStandHour.stood`, che vale 0; «fermo» vale 1).
/// Un'ora scritta due volte si conta una.
Lettura? leOreInPiedi(Iterable<Campione> ore, DateTime adesso) {
  final inPiedi = {
    for (final o in ore)
      if (o.valore == 0) DateTime(o.da.year, o.da.month, o.da.day, o.da.hour),
  };
  if (ore.isEmpty) return null;
  return Lettura(inPiedi.length.toDouble(), adesso);
}

/// La somma di quello che il telefono ha dato per oggi.
double sommaDiOggi(Iterable<double> valori) =>
    valori.fold<double>(0, (s, v) => s + v);

/// Le calorie a riposo di oggi su Android: Health Connect le da' solo dentro
/// le calorie totali (il metabolismo e' un ritmo, non un'energia), e le
/// attive si tolgono. Senza totali, niente.
double? caloriaRiposoDaiTotali(double? totali, double? attive) {
  if (totali == null) return null;
  final riposo = totali - (attive ?? 0);
  return riposo < 0 ? 0 : riposo;
}

/// L'ultima notte di sonno, in minuti. I tratti si mettono in fila e si
/// uniscono in «sonni»: fra un tratto e l'altro al piu' [risveglioFinoA]
/// sveglio, e quelli che si sovrappongono non si contano due volte — un
/// iPhone e un orologio scrivono la stessa notte due volte. La notte e'
/// l'ultimo sonno lungo almeno [notteAlmeno]: un pisolino, anche della
/// sera, non e' «l'ultima notte». Chi lavora di notte dorme di giorno, e
/// vale lo stesso. Se di sonni lunghi non ce ne sono, l'ultimo che c'e'.
/// Stanotte, se c'e'; se l'orologio stanotte era a caricare, quella
/// prima, fino a [notteFinoA] indietro.
Lettura? ilSonnoDiStanotte(Iterable<Campione> tratti, DateTime adesso) {
  final buoni = [
    for (final t in tratti)
      if (t.a.isAfter(t.da) &&
          !t.a.isAfter(adesso) &&
          adesso.difference(t.a) <= notteFinoA)
        t,
  ]..sort((x, y) => x.da.compareTo(y.da));
  if (buoni.isEmpty) return null;
  final sonni = <({double minuti, DateTime fine})>[];
  var minuti = 0.0;
  DateTime? finoA;
  DateTime? notteDelSonno;
  for (final t in buoni) {
    final notteDelTratto = laNotteDi(t.da);
    /* Un risveglio di notte (sveglio dalle 2 alle 4:30) non spezza la
     * notte: due tratti cominciati nella stessa notte — dalle 18 alle 12
     * del giorno dopo — sono un sonno solo, qualunque sia il buco. Il
     * pisolino delle 17:30 comincia prima: resta a parte. */
    final stessaNotte =
        notteDelTratto != null && notteDelTratto == notteDelSonno;
    if (finoA != null &&
        t.da.difference(finoA) > risveglioFinoA &&
        !stessaNotte) {
      sonni.add((minuti: minuti, fine: finoA));
      minuti = 0;
      finoA = null;
      notteDelSonno = null;
    }
    notteDelSonno ??= notteDelTratto;
    final da = finoA != null && t.da.isBefore(finoA) ? finoA : t.da;
    if (t.a.isAfter(da)) minuti += t.a.difference(da).inSeconds / 60;
    if (finoA == null || t.a.isAfter(finoA)) finoA = t.a;
  }
  sonni.add((minuti: minuti, fine: finoA!));
  final lunghi = [
    for (final s in sonni)
      if (s.minuti >= notteAlmeno.inMinutes) s,
  ];
  final notte = (lunghi.isEmpty ? sonni : lunghi).reduce(
    (x, y) => y.fine.isAfter(x.fine) ? y : x,
  );
  if (notte.minuti < 1) return null;
  return Lettura(notte.minuti.roundToDouble(), notte.fine);
}

/// La notte in cui comincia un tratto di sonno: dalle 18 alle 12 del giorno
/// dopo vale la data della sera; dalle 12 alle 18 nessuna notte (e' un
/// sonno di giorno: un pisolino, o chi lavora di notte).
DateTime? laNotteDi(DateTime quando) {
  if (quando.hour >= 18) {
    return DateTime(quando.year, quando.month, quando.day);
  }
  if (quando.hour < 12) {
    return DateTime(quando.year, quando.month, quando.day - 1);
  }
  return null;
}

/// Quello che va al ponte: `{passi: {valore, quando}, …}`, solo le misure
/// scelte e lette.
Map<String, Object> perIlPonte(
  Map<MisuraDelCorpo, Lettura> lette,
  Set<MisuraDelCorpo> scelte,
) => {
  for (final MapEntry(key: misura, value: lettura) in lette.entries)
    if (scelte.contains(misura)) misura.name: lettura.inJson(),
};

/// Quando, se non e' oggi: «1 nov» in italiano, «Nov 1» in inglese; ieri e'
/// «ieri». Oggi niente: «l'ultimo · 73 bpm» basta. Come la plancia, che
/// accanto a una misura vecchia scrive il giorno.
String? quandoSeNonOggi(DateTime quando, DateTime adesso) {
  final giorno = DateTime(quando.year, quando.month, quando.day);
  final oggi = DateTime(adesso.year, adesso.month, adesso.day);
  final indietro = oggi.difference(giorno).inDays;
  if (indietro <= 0) return null;
  if (indietro == 1) return inLingua(it: 'ieri', en: 'yesterday');
  const mesi = [
    ('gen', 'Jan'),
    ('feb', 'Feb'),
    ('mar', 'Mar'),
    ('apr', 'Apr'),
    ('mag', 'May'),
    ('giu', 'Jun'),
    ('lug', 'Jul'),
    ('ago', 'Aug'),
    ('set', 'Sep'),
    ('ott', 'Oct'),
    ('nov', 'Nov'),
    ('dic', 'Dec'),
  ];
  final (it, en) = mesi[quando.month - 1];
  return inLingua(it: '${quando.day} $it', en: '$en ${quando.day}');
}

/// Perche' l'ultimo invio alla casa non e' andato. La casa dice di no per
/// due motivi suoi (`ponte/src/il-corpo-dal-telefono.js`), e poi c'e' la
/// casa che non risponde.
enum GuastoDellaSalute {
  /// La casa non ha GdAHome Premium: `premium-richiesto`.
  premiumRichiesto,

  /// Il telefono non e' intestato a un utente di Home Assistant:
  /// `unauthorized`. Va riabbinato.
  telefonoNonIntestato,

  /// Il filo e' caduto, o la casa non ha risposto in tempo.
  casaNonRisponde,

  /// Un altro no della casa.
  altro;

  /// Da un codice di rifiuto della casa. `null`: non era un rifiuto.
  static GuastoDellaSalute daCodice(String? codice) => switch (codice) {
    'premium-richiesto' => GuastoDellaSalute.premiumRichiesto,
    'unauthorized' => GuastoDellaSalute.telefonoNonIntestato,
    _ => GuastoDellaSalute.altro,
  };

  /// Cosa dire, in una riga che si capisce senza sapere cos'e' un ponte.
  String get spiegazione => switch (this) {
    GuastoDellaSalute.premiumRichiesto => inLingua(
      it:
          'La casa non accetta le misure: la salute dal telefono è di '
          'GdAHome Premium, e questa casa non ce l\'ha.',
      en:
          "Your home doesn't accept the readings: health from the phone is "
          "part of GdAHome Premium, and this home doesn't have it.",
    ),
    GuastoDellaSalute.telefonoNonIntestato => inLingua(
      it:
          'La casa non accetta le misure: questo telefono non è intestato a '
          'un utente di Home Assistant. Abbinalo di nuovo entrando col tuo '
          'utente.',
      en:
          "Your home doesn't accept the readings: this phone isn't linked to a "
          'Home Assistant user. Pair it again, signing in as yourself.',
    ),
    GuastoDellaSalute.casaNonRisponde => inLingua(
      it: 'La casa non risponde: riprovo da solo fra poco.',
      en: "Your home isn't answering: I'll retry shortly.",
    ),
    GuastoDellaSalute.altro => inLingua(
      it: 'La casa ha rifiutato le misure. Riprovo da solo fra poco.',
      en: 'Your home refused the readings. I\'ll retry shortly.',
    ),
  };
}

/// Sotto una misura scelta che Salute o Health Connect non hanno dato.
/// Apple non dice mai se il permesso di leggere c'e': una misura negata e
/// una che non c'e' sembrano uguali, e allora si dicono tutte e due.
String nessunValore(MisuraDelCorpo misura, {required bool iPhone}) {
  final finestra = finestraDellUltimo(misura);
  final quando = switch (misura) {
    _ when eDiOggi(misura) => inLingua(it: 'oggi', en: 'today'),
    MisuraDelCorpo.sonno => inLingua(
      it: 'nelle ultime notti',
      en: 'for the last few nights',
    ),
    _ => inLingua(
      it: 'negli ultimi ${finestra!.inDays} giorni',
      en: 'in the last ${finestra.inDays} days',
    ),
  };
  return iPhone
      ? inLingua(
          it:
              'Salute non ne ha $quando. Se in Salute c\'è, controlla in '
              'Impostazioni › Salute › Accesso ai dati e dispositivi › GdAHome.',
          en:
              "Health has none $quando. If Health has it, check Settings › "
              'Health › Data Access & Devices › GdAHome.',
        )
      : inLingua(
          it:
              'Health Connect non ne ha $quando. Se c\'è, controlla in Health '
              'Connect › Autorizzazioni app › GdAHome.',
          en:
              "Health Connect has none $quando. If it's there, check Health "
              'Connect › App permissions › GdAHome.',
        );
}
