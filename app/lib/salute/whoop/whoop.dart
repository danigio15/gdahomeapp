/// Il WHOOP: cosa si prende dall'account collegato, e come diventa Salute.
///
/// Il WHOOP arriva all'app per due strade.
///
/// - **Senza fare niente.** L'app WHOOP scrive gia' in Apple Salute e in
///   Health Connect il sonno, il battito a riposo, l'HRV, il respiro, gli
///   allenamenti e le calorie. Il lettore di sempre (`lettore_qui/`) li
///   prende con gli altri, e riconosce dall'origine del campione che sono
///   «da WHOOP» ([Fonte.daOrigine]).
/// - **«Collega WHOOP».** Recupero, sforzo e prestazione del sonno in Salute
///   non ci sono: li da' solo l'API di WHOOP, con l'account collegato
///   (`collegamento_whoop.dart`). Qui si leggono le sue risposte e si
///   trasformano nelle misure della Salute ([DatiWhoop.perLaSalute]), con la
///   fonte scritta accanto.
///
/// Qui niente rete e niente Flutter: si prova con le risposte finte.
///
/// Le risposte sono quelle dell'API v2 (`/v2/recovery`, `/v2/cycle`,
/// `/v2/activity/sleep`, `/v2/activity/workout`): `records`, `score_state`,
/// e dentro `score` i numeri. I nomi dei campi vanno ricontrollati sulla
/// documentazione di developer.whoop.com quando l'app sara' registrata: chi
/// manca, qui, manca e basta — una lettura storta non diventa un numero.
library;

import '../../parole.dart';
import '../il_corpo.dart';

/// Le zone del recupero, come le colora WHOOP: verde da 67, gialla da 34,
/// rossa sotto.
enum ZonaDelRecupero {
  verde,
  gialla,
  rossa;

  static ZonaDelRecupero di(double percento) => percento >= 67
      ? ZonaDelRecupero.verde
      : percento >= 34
      ? ZonaDelRecupero.gialla
      : ZonaDelRecupero.rossa;

  String get nome => switch (this) {
    ZonaDelRecupero.verde => inLingua(it: 'Verde', en: 'Green'),
    ZonaDelRecupero.gialla => inLingua(it: 'Giallo', en: 'Yellow'),
    ZonaDelRecupero.rossa => inLingua(it: 'Rosso', en: 'Red'),
  };

  /// Cosa vuol dire, in una riga.
  String get perche => switch (this) {
    ZonaDelRecupero.verde => inLingua(
      it: 'Il corpo ha recuperato bene: oggi può reggere uno sforzo alto.',
      en: 'Your body recovered well: today it can handle high strain.',
    ),
    ZonaDelRecupero.gialla => inLingua(
      it: 'Recupero a metà: uno sforzo moderato va bene.',
      en: 'Partly recovered: moderate strain is fine.',
    ),
    ZonaDelRecupero.rossa => inLingua(
      it: 'Il corpo chiede riposo: meglio una giornata leggera.',
      en: 'Your body needs rest: keep today light.',
    ),
  };
}

/* I campi delle risposte: numeri e date, o niente. Un numero scritto come
 * stringa, un campo che manca, una data storta: `null`, non un'eccezione. */
double? _numero(Object? valore) => switch (valore) {
  final num n when n.isFinite => n.toDouble(),
  _ => null,
};

DateTime? _data(Object? valore) =>
    valore is String ? DateTime.tryParse(valore)?.toLocal() : null;

Map<String, Object?>? _mappa(Object? valore) =>
    valore is Map ? valore.cast<String, Object?>() : null;

/// I record di una risposta a elenco: `{records: [...], next_token}`.
List<Map<String, Object?>> recordDi(Object? risposta) {
  final record = _mappa(risposta)?['records'];
  if (record is! List) return const [];
  return [
    for (final r in record)
      if (_mappa(r) case final m?) m,
  ];
}

/* Un record conta solo se WHOOP l'ha gia' calcolato: `PENDING_SCORE` e
 * `UNSCORABLE` non hanno numeri. */
Map<String, Object?>? _punteggio(Map<String, Object?> record) =>
    record['score_state'] == 'SCORED' ? _mappa(record['score']) : null;

/// Da millisecondi a minuti.
double? _minuti(Object? milli) {
  final ms = _numero(milli);
  return ms == null ? null : ms / 60000;
}

/// Un recupero: quello della mattina, calcolato dalla notte.
class RecuperoWhoop {
  const RecuperoWhoop({
    required this.percento,
    required this.quando,
    this.hrv,
    this.battitoRiposo,
    this.ossigeno,
    this.temperaturaPelle,
    this.calibrando = false,
  });

  final double percento;
  final DateTime quando;

  /// HRV in millisecondi (RMSSD).
  final double? hrv;
  final double? battitoRiposo;

  /// Ossigeno nel sangue, in percentuale: solo dal WHOOP 4.0 in poi.
  final double? ossigeno;

  /// Temperatura della pelle, in gradi: solo dal WHOOP 4.0 in poi.
  final double? temperaturaPelle;

  /// I primi giorni WHOOP impara il «solito» di chi lo porta, e il
  /// recupero e' ancora approssimativo.
  final bool calibrando;

  ZonaDelRecupero get zona => ZonaDelRecupero.di(percento);

  static RecuperoWhoop? daRecord(Map<String, Object?> record) {
    final punti = _punteggio(record);
    final percento = _numero(punti?['recovery_score']);
    final quando = _data(record['created_at']) ?? _data(record['updated_at']);
    if (punti == null || percento == null || quando == null) return null;
    if (percento < 0 || percento > 100) return null;
    return RecuperoWhoop(
      percento: percento,
      quando: quando,
      hrv: _numero(punti['hrv_rmssd_milli']),
      battitoRiposo: _numero(punti['resting_heart_rate']),
      ossigeno: _numero(punti['spo2_percentage']),
      temperaturaPelle: _numero(punti['skin_temp_celsius']),
      calibrando: punti['user_calibrating'] == true,
    );
  }

  Map<String, Object?> inJson() => {
    'percento': percento,
    'quando': quando.toUtc().toIso8601String(),
    'hrv': ?hrv,
    'rhr': ?battitoRiposo,
    'spo2': ?ossigeno,
    'pelle': ?temperaturaPelle,
    if (calibrando) 'calibrando': true,
  };

  static RecuperoWhoop? daJson(Object? grezzo) {
    final m = _mappa(grezzo);
    final percento = _numero(m?['percento']);
    final quando = _data(m?['quando']);
    if (m == null || percento == null || quando == null) return null;
    return RecuperoWhoop(
      percento: percento,
      quando: quando,
      hrv: _numero(m['hrv']),
      battitoRiposo: _numero(m['rhr']),
      ossigeno: _numero(m['spo2']),
      temperaturaPelle: _numero(m['pelle']),
      calibrando: m['calibrando'] == true,
    );
  }
}

/// Lo sforzo di un ciclo: da quando ci si sveglia a quando ci si
/// riaddormenta. Quello in corso non ha ancora la fine, e cresce.
class SforzoWhoop {
  const SforzoWhoop({
    required this.sforzo,
    required this.inizio,
    this.fine,
    this.kcal,
    this.battitoMedio,
    this.battitoMassimo,
  });

  /// Da 0 a 21.
  final double sforzo;
  final DateTime inizio;
  final DateTime? fine;

  /// L'energia del ciclo, metabolismo compreso: WHOOP la da' in kilojoule.
  final double? kcal;
  final double? battitoMedio;
  final double? battitoMassimo;

  static SforzoWhoop? daRecord(Map<String, Object?> record) {
    final punti = _punteggio(record);
    final sforzo = _numero(punti?['strain']);
    final inizio = _data(record['start']);
    if (punti == null || sforzo == null || inizio == null) return null;
    if (sforzo < 0 || sforzo > 21) return null;
    final kj = _numero(punti['kilojoule']);
    return SforzoWhoop(
      sforzo: sforzo,
      inizio: inizio,
      fine: _data(record['end']),
      kcal: kj == null ? null : kj / 4.184,
      battitoMedio: _numero(punti['average_heart_rate']),
      battitoMassimo: _numero(punti['max_heart_rate']),
    );
  }

  Map<String, Object?> inJson() => {
    'sforzo': sforzo,
    'inizio': inizio.toUtc().toIso8601String(),
    'fine': ?fine?.toUtc().toIso8601String(),
    'kcal': ?kcal,
    'medio': ?battitoMedio,
    'massimo': ?battitoMassimo,
  };

  static SforzoWhoop? daJson(Object? grezzo) {
    final m = _mappa(grezzo);
    final sforzo = _numero(m?['sforzo']);
    final inizio = _data(m?['inizio']);
    if (m == null || sforzo == null || inizio == null) return null;
    return SforzoWhoop(
      sforzo: sforzo,
      inizio: inizio,
      fine: _data(m['fine']),
      kcal: _numero(m['kcal']),
      battitoMedio: _numero(m['medio']),
      battitoMassimo: _numero(m['massimo']),
    );
  }
}

/// Una notte: quanto si e' dormito, in che fasi, e quanto rispetto al
/// bisogno (la prestazione).
class SonnoWhoop {
  const SonnoWhoop({
    required this.inizio,
    required this.fine,
    required this.leggero,
    required this.profondo,
    required this.rem,
    required this.sveglio,
    this.prestazione,
    this.efficienza,
    this.respiro,
  });

  final DateTime inizio;
  final DateTime fine;

  /// Le fasi, in minuti. Il profondo e' lo «slow wave sleep» di WHOOP.
  final double leggero;
  final double profondo;
  final double rem;
  final double sveglio;

  /// Quanto si e' dormito rispetto a quanto serviva, in percentuale.
  final double? prestazione;
  final double? efficienza;

  /// Atti al minuto, durante la notte.
  final double? respiro;

  /// Dormito davvero: le tre fasi, senza lo sveglio.
  double get dormiti => leggero + profondo + rem;

  static SonnoWhoop? daRecord(Map<String, Object?> record) {
    /* I pisolini non sono «la notte». */
    if (record['nap'] == true) return null;
    final punti = _punteggio(record);
    final fasi = _mappa(punti?['stage_summary']);
    final inizio = _data(record['start']);
    final fine = _data(record['end']);
    if (punti == null || fasi == null || inizio == null || fine == null) {
      return null;
    }
    final leggero = _minuti(fasi['total_light_sleep_time_milli']);
    final profondo = _minuti(fasi['total_slow_wave_sleep_time_milli']);
    final rem = _minuti(fasi['total_rem_sleep_time_milli']);
    if (leggero == null || profondo == null || rem == null) return null;
    return SonnoWhoop(
      inizio: inizio,
      fine: fine,
      leggero: leggero,
      profondo: profondo,
      rem: rem,
      sveglio: _minuti(fasi['total_awake_time_milli']) ?? 0,
      prestazione: _numero(punti['sleep_performance_percentage']),
      efficienza: _numero(punti['sleep_efficiency_percentage']),
      respiro: _numero(punti['respiratory_rate']),
    );
  }

  Map<String, Object?> inJson() => {
    'inizio': inizio.toUtc().toIso8601String(),
    'fine': fine.toUtc().toIso8601String(),
    'leggero': leggero,
    'profondo': profondo,
    'rem': rem,
    'sveglio': sveglio,
    'prestazione': ?prestazione,
    'efficienza': ?efficienza,
    'respiro': ?respiro,
  };

  static SonnoWhoop? daJson(Object? grezzo) {
    final m = _mappa(grezzo);
    final inizio = _data(m?['inizio']);
    final fine = _data(m?['fine']);
    if (m == null || inizio == null || fine == null) return null;
    return SonnoWhoop(
      inizio: inizio,
      fine: fine,
      leggero: _numero(m['leggero']) ?? 0,
      profondo: _numero(m['profondo']) ?? 0,
      rem: _numero(m['rem']) ?? 0,
      sveglio: _numero(m['sveglio']) ?? 0,
      prestazione: _numero(m['prestazione']),
      efficienza: _numero(m['efficienza']),
      respiro: _numero(m['respiro']),
    );
  }
}

/// Un allenamento, con lo sforzo che e' costato.
class AllenamentoWhoop {
  const AllenamentoWhoop({
    required this.sport,
    required this.sforzo,
    required this.inizio,
    required this.fine,
    this.kcal,
    this.battitoMedio,
  });

  /// Il nome che da' WHOOP («running», «cycling»…), cosi' com'e'.
  final String sport;
  final double sforzo;
  final DateTime inizio;
  final DateTime fine;
  final double? kcal;
  final double? battitoMedio;

  Duration get durata => fine.difference(inizio);

  static AllenamentoWhoop? daRecord(Map<String, Object?> record) {
    final punti = _punteggio(record);
    final sforzo = _numero(punti?['strain']);
    final inizio = _data(record['start']);
    final fine = _data(record['end']);
    if (punti == null || sforzo == null || inizio == null || fine == null) {
      return null;
    }
    final kj = _numero(punti['kilojoule']);
    final sport = record['sport_name'];
    return AllenamentoWhoop(
      sport: sport is String && sport.trim().isNotEmpty
          ? sport.trim()
          : 'activity',
      sforzo: sforzo,
      inizio: inizio,
      fine: fine,
      kcal: kj == null ? null : kj / 4.184,
      battitoMedio: _numero(punti['average_heart_rate']),
    );
  }

  Map<String, Object?> inJson() => {
    'sport': sport,
    'sforzo': sforzo,
    'inizio': inizio.toUtc().toIso8601String(),
    'fine': fine.toUtc().toIso8601String(),
    'kcal': ?kcal,
    'medio': ?battitoMedio,
  };

  static AllenamentoWhoop? daJson(Object? grezzo) {
    final m = _mappa(grezzo);
    final sforzo = _numero(m?['sforzo']);
    final inizio = _data(m?['inizio']);
    final fine = _data(m?['fine']);
    if (m == null || sforzo == null || inizio == null || fine == null) {
      return null;
    }
    return AllenamentoWhoop(
      sport: '${m['sport'] ?? 'activity'}',
      sforzo: sforzo,
      inizio: inizio,
      fine: fine,
      kcal: _numero(m['kcal']),
      battitoMedio: _numero(m['medio']),
    );
  }
}

/// Tutto quello che si e' preso dall'account WHOOP in un giro.
class DatiWhoop {
  const DatiWhoop({
    required this.preso,
    this.recuperi = const [],
    this.sforzo,
    this.sonno,
    this.allenamenti = const [],
  });

  /// Quando si e' preso.
  final DateTime preso;

  /// Gli ultimi recuperi, dal piu' nuovo: il primo e' quello di oggi, gli
  /// altri fanno la settimana nel dettaglio.
  final List<RecuperoWhoop> recuperi;
  final SforzoWhoop? sforzo;
  final SonnoWhoop? sonno;

  /// Gli ultimi allenamenti, dal piu' nuovo.
  final List<AllenamentoWhoop> allenamenti;

  RecuperoWhoop? get recupero => recuperi.isEmpty ? null : recuperi.first;

  /// Dalle quattro risposte dell'API. Una che manca — lo scope negato, un
  /// errore — lascia vuota solo la sua parte.
  static DatiWhoop dalleRisposte({
    required DateTime preso,
    Object? recuperi,
    Object? cicli,
    Object? sonni,
    Object? allenamenti,
  }) {
    List<T> tutti<T>(Object? risposta, T? Function(Map<String, Object?>) da) {
      return [
        for (final r in recordDi(risposta))
          if (da(r) case final T x) x,
      ];
    }

    final ricevuti = tutti(recuperi, RecuperoWhoop.daRecord)
      ..sort((a, b) => b.quando.compareTo(a.quando));
    final sforzi = tutti(cicli, SforzoWhoop.daRecord)
      ..sort((a, b) => b.inizio.compareTo(a.inizio));
    final notti = tutti(sonni, SonnoWhoop.daRecord)
      ..sort((a, b) => b.fine.compareTo(a.fine));
    final fatti = tutti(allenamenti, AllenamentoWhoop.daRecord)
      ..sort((a, b) => b.inizio.compareTo(a.inizio));
    return DatiWhoop(
      preso: preso,
      recuperi: ricevuti.take(7).toList(),
      sforzo: sforzi.firstOrNull,
      sonno: notti.firstOrNull,
      allenamenti: fatti.take(5).toList(),
    );
  }

  /// Le misure della Salute che il WHOOP collegato sa dare, tutte con la
  /// fonte. Vanno a casa con le altre (`lettore_con_whoop.dart`).
  Map<MisuraDelCorpo, Lettura> perLaSalute() {
    const w = Fonte.whoop;
    final r = recupero;
    final s = sonno;
    final f = sforzo;
    Lettura? da(double? valore, DateTime? quando) =>
        valore == null || quando == null
        ? null
        : Lettura(valore, quando, fonte: w);
    return {
      MisuraDelCorpo.recupero: ?da(r?.percento, r?.quando),
      MisuraDelCorpo.hrv: ?da(r?.hrv, r?.quando),
      MisuraDelCorpo.battitoRiposo: ?da(r?.battitoRiposo, r?.quando),
      MisuraDelCorpo.ossigeno: ?da(r?.ossigeno, r?.quando),
      MisuraDelCorpo.temperaturaPelle: ?da(r?.temperaturaPelle, r?.quando),
      /* Lo sforzo del ciclo in corso: «adesso» e' quando lo si e' preso. */
      MisuraDelCorpo.sforzo: ?da(
        f?.sforzo,
        f?.fine ?? (f == null ? null : preso),
      ),
      MisuraDelCorpo.sonno: ?da(s?.dormiti.roundToDouble(), s?.fine),
      MisuraDelCorpo.respiro: ?da(s?.respiro, s?.fine),
    };
  }

  Map<String, Object?> inJson() => {
    'preso': preso.toUtc().toIso8601String(),
    'recuperi': [for (final r in recuperi) r.inJson()],
    'sforzo': ?sforzo?.inJson(),
    'sonno': ?sonno?.inJson(),
    'allenamenti': [for (final a in allenamenti) a.inJson()],
  };

  static DatiWhoop? daJson(Object? grezzo) {
    final m = _mappa(grezzo);
    final preso = _data(m?['preso']);
    if (m == null || preso == null) return null;
    List<T> elenco<T>(Object? lista, T? Function(Object?) da) => lista is List
        ? [
            for (final x in lista)
              if (da(x) case final T y) y,
          ]
        : const [];
    return DatiWhoop(
      preso: preso,
      recuperi: elenco(m['recuperi'], RecuperoWhoop.daJson),
      sforzo: SforzoWhoop.daJson(m['sforzo']),
      sonno: SonnoWhoop.daJson(m['sonno']),
      allenamenti: elenco(m['allenamenti'], AllenamentoWhoop.daJson),
    );
  }
}

/// Le letture di Salute e quelle del WHOOP collegato, insieme: per ogni
/// misura chiesta la piu' nuova; a pari merito il WHOOP, che e' la fonte
/// che chi l'ha collegato ha scelto. Quelle che vengono solo dal WHOOP
/// (recupero, sforzo) arrivano solo da li'.
Map<MisuraDelCorpo, Lettura> unisciColWhoop(
  Map<MisuraDelCorpo, Lettura> daSalute,
  Map<MisuraDelCorpo, Lettura> daWhoop,
  Set<MisuraDelCorpo> misure,
) => {
  for (final misura in misure)
    if (_laPiuNuova(daSalute[misura], daWhoop[misura]) case final l?) misura: l,
};

Lettura? _laPiuNuova(Lettura? salute, Lettura? whoop) {
  if (salute == null) return whoop;
  if (whoop == null) return salute;
  return salute.quando.isAfter(whoop.quando) ? salute : whoop;
}

/// Quello che le schede del WHOOP mostrano nella pagina Salute: dai dati
/// dell'account collegato, e se non c'e' da quello che l'app WHOOP ha
/// scritto in Salute o in Health Connect. Senza niente del WHOOP, niente
/// schede ([daMostrare]).
class QuadroWhoop {
  const QuadroWhoop({
    this.recupero,
    this.settimana = const [],
    this.sforzo,
    this.allenamento,
    this.sonno,
    this.sonnoDaSalute,
    this.hrv,
    this.battitoRiposo,
  });

  final RecuperoWhoop? recupero;

  /// I recuperi dei giorni prima, dal piu' nuovo.
  final List<RecuperoWhoop> settimana;
  final SforzoWhoop? sforzo;

  /// L'ultimo allenamento, se c'e'.
  final AllenamentoWhoop? allenamento;
  final SonnoWhoop? sonno;

  /// La notte scritta dall'app WHOOP in Salute, se l'account non e'
  /// collegato: solo le ore, senza fasi ne' prestazione.
  final Lettura? sonnoDaSalute;
  final Lettura? hrv;
  final Lettura? battitoRiposo;

  bool get daMostrare =>
      recupero != null ||
      sforzo != null ||
      sonno != null ||
      sonnoDaSalute != null ||
      hrv != null ||
      battitoRiposo != null;

  static QuadroWhoop da(DatiWhoop? dati, Map<MisuraDelCorpo, Lettura> lette) {
    Lettura? delWhoop(MisuraDelCorpo misura) {
      final letta = lette[misura];
      final dalWhoop = dati?.perLaSalute()[misura];
      return _laPiuNuova(letta?.fonte == Fonte.whoop ? letta : null, dalWhoop);
    }

    final sonno = lette[MisuraDelCorpo.sonno];
    return QuadroWhoop(
      recupero: dati?.recupero,
      settimana: dati?.recuperi ?? const [],
      sforzo: dati?.sforzo,
      allenamento: dati?.allenamenti.firstOrNull,
      sonno: dati?.sonno,
      sonnoDaSalute: dati?.sonno == null && sonno?.fonte == Fonte.whoop
          ? sonno
          : null,
      hrv: delWhoop(MisuraDelCorpo.hrv),
      battitoRiposo: delWhoop(MisuraDelCorpo.battitoRiposo),
    );
  }
}
