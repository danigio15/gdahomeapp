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
    MisuraDelCorpo.sonno => inLingua(it: 'stanotte', en: 'last night'),
    MisuraDelCorpo.calorie => inLingua(it: 'quelle di oggi', en: "today's"),
  };
}

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

/// Il sonno di stanotte, in minuti: i tratti di sonno finiti dopo le 18 di
/// ieri, sommati senza contare due volte quelli che si sovrappongono — un
/// iPhone e un orologio scrivono la stessa notte due volte.
Lettura? ilSonnoDiStanotte(Iterable<Campione> tratti, DateTime adesso) {
  final daIeri = DateTime(adesso.year, adesso.month, adesso.day - 1, 18);
  final validi = [
    for (final t in tratti)
      if (t.a.isAfter(daIeri) && t.a.isAfter(t.da)) t,
  ]..sort((x, y) => x.da.compareTo(y.da));
  if (validi.isEmpty) return null;
  var minuti = 0.0;
  DateTime? finoA;
  for (final t in validi) {
    final da = finoA != null && t.da.isBefore(finoA) ? finoA : t.da;
    if (t.a.isAfter(da)) minuti += t.a.difference(da).inSeconds / 60;
    if (finoA == null || t.a.isAfter(finoA)) finoA = t.a;
  }
  if (minuti < 1) return null;
  return Lettura(minuti.roundToDouble(), finoA!);
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
