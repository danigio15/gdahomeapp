/// Quanto costano i lavori pesanti, contati mentre si fanno.
///
/// «L'app va a scatti» e' una sensazione; «il filo principale si e' fermato
/// due volte, fino a centosettantotto millesimi» e' una misura — ma non dice
/// *cosa* stava facendo. Questo lo dice: ogni lavoro pesante si conta da
/// solo, e in diagnostica si legge quante volte, quanto in tutto e qual e'
/// stato il peggiore. Un lavoro che da solo dura quanto un blocco e' il
/// colpevole; se sono tutti piccoli e i blocchi restano, non e' il lavoro —
/// e' la roba da buttare che si accumula, e allora si guarda chi la produce.
///
/// Niente Flutter qui dentro: lo usano anche il filo e il servitore, che uno
/// schermo non ce l'hanno.
library;

import 'dart:async';

import '../parole.dart';

class Lavori {
  Lavori._();

  /// Uno solo per tutta l'app.
  static final Lavori io = Lavori._();

  final _conti = <String, _Conto>{};
  DateTime? _dal;

  /// Conta un lavoro che si aspetta. Il tempo e' quello vero, dall'inizio
  /// alla fine: per un lavoro fatto altrove ci sta dentro anche il viaggio,
  /// ed e' giusto cosi' — chi aspetta aspetta anche quello.
  Future<T> conto<T>(String cosa, Future<T> Function() lavoro) async {
    final da = Stopwatch()..start();
    try {
      return await lavoro();
    } finally {
      segna(cosa, da.elapsedMicroseconds);
    }
  }

  /// Conta un lavoro che si fa e basta, qui, senza aspettare niente.
  T subito<T>(String cosa, T Function() lavoro) {
    final da = Stopwatch()..start();
    try {
      return lavoro();
    } finally {
      segna(cosa, da.elapsedMicroseconds);
    }
  }

  void segna(String cosa, int micro) {
    _dal ??= DateTime.now();
    (_conti[cosa] ??= _Conto()).piu(micro);
  }

  /// Si riparte da zero: si chiama quando si entra in una casa, cosi' i
  /// numeri e quelli del traffico parlano dello stesso pezzo di tempo.
  void azzera() {
    _conti.clear();
    _dal = DateTime.now();
  }

  DateTime? get dal => _dal;

  /// I lavori, dal piu' caro al meno caro.
  List<UnLavoro> get tutti {
    final fatti = [
      for (final uno in _conti.entries)
        UnLavoro(
          cosa: uno.key,
          quante: uno.value.quante,
          totaleMs: uno.value.totaleMicro ~/ 1000,
          maxMs: uno.value.maxMicro ~/ 1000,
        ),
    ]..sort((a, b) => b.totaleMs.compareTo(a.totaleMs));
    return fatti;
  }

  /// Una riga sola, per la diagnostica che parte con una segnalazione.
  String get riassunto {
    final fatti = tutti;
    if (fatti.isEmpty) {
      return inLingua(it: 'niente da segnare', en: 'nothing to note');
    }
    return fatti.take(4).map((uno) => uno.riga).join('; ');
  }
}

class UnLavoro {
  const UnLavoro({
    required this.cosa,
    required this.quante,
    required this.totaleMs,
    required this.maxMs,
  });

  final String cosa;
  final int quante;
  final int totaleMs;
  final int maxMs;

  String get riga => '$cosa ${quante}x, $totaleMs ms (max $maxMs)';
}

class _Conto {
  int quante = 0;
  int totaleMicro = 0;
  int maxMicro = 0;

  void piu(int micro) {
    quante += 1;
    totaleMicro += micro;
    if (micro > maxMicro) maxMicro = micro;
  }
}
