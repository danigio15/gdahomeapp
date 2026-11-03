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
  battito,
  battitoRiposo,
  peso,
  grasso,
  sistolica,
  diastolica,
  ossigeno,
  sonno,
  calorie;

  String get titolo => switch (this) {
    MisuraDelCorpo.passi => inLingua(it: 'Passi', en: 'Steps'),
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
  };

  /// Come si legge, in una riga sotto il nome.
  String get comeSiLegge => switch (this) {
    MisuraDelCorpo.passi => inLingua(it: 'quelli di oggi', en: "today's"),
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
  MisuraDelCorpo.calorie ||
  MisuraDelCorpo.sonno => null,
};

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

/// Le misure accese di serie: quelle che quasi ogni orologio ha.
const misureDiSerie = {
  MisuraDelCorpo.passi,
  MisuraDelCorpo.battito,
  MisuraDelCorpo.battitoRiposo,
  MisuraDelCorpo.peso,
  MisuraDelCorpo.sistolica,
  MisuraDelCorpo.diastolica,
  MisuraDelCorpo.sonno,
};

/// Le scelte di questo telefono: se e' acceso, il nome, cosa si manda.
class ScelteDellaSalute {
  const ScelteDellaSalute({
    this.acceso = false,
    this.persona = '',
    this.misure = misureDiSerie,
    this.ultimoInvio,
  });

  final bool acceso;

  /// Il nome con cui la casa la chiama: «Marco». Vuoto, il ponte usa quello
  /// di «Di chi è questo telefono?».
  final String persona;
  final Set<MisuraDelCorpo> misure;
  final DateTime? ultimoInvio;

  ScelteDellaSalute con({
    bool? acceso,
    String? persona,
    Set<MisuraDelCorpo>? misure,
    DateTime? ultimoInvio,
  }) => ScelteDellaSalute(
    acceso: acceso ?? this.acceso,
    persona: persona ?? this.persona,
    misure: misure ?? this.misure,
    ultimoInvio: ultimoInvio ?? this.ultimoInvio,
  );

  Map<String, Object?> inJson() => {
    'acceso': acceso,
    'persona': persona,
    'misure': [for (final m in misure) m.name],
    if (ultimoInvio != null) 'ultimo': ultimoInvio!.millisecondsSinceEpoch,
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
    final nomi = letto['misure'];
    final misure = nomi is List
        ? {
            for (final nome in nomi)
              for (final m in MisuraDelCorpo.values)
                if (m.name == nome) m,
          }
        : misureDiSerie;
    final ultimo = letto['ultimo'];
    return ScelteDellaSalute(
      acceso: letto['acceso'] == true,
      persona: personaPulita('${letto['persona'] ?? ''}'),
      misure: misure,
      ultimoInvio: ultimo is int
          ? DateTime.fromMillisecondsSinceEpoch(ultimo)
          : null,
    );
  }
}

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

  Map<String, Object> inJson() => {
    'valore': (valore * 10).round() / 10,
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
  for (final t in buoni) {
    if (finoA != null && t.da.difference(finoA) > risveglioFinoA) {
      sonni.add((minuti: minuti, fine: finoA));
      minuti = 0;
      finoA = null;
    }
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
    MisuraDelCorpo.passi ||
    MisuraDelCorpo.calorie => inLingua(it: 'oggi', en: 'today'),
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
