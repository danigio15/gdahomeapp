/// Le misure di come va l'app: quanto ci mette a disegnare, e quanto spesso
/// il filo principale resta bloccato.
///
/// Servono a chi legge una segnalazione, non a chi la manda: «va a scatti»
/// e' una sensazione, «un fotogramma su cinque sopra i trentadue millesimi,
/// il peggiore mezzo secondo, sulla scheda video» e' una cosa su cui si puo'
/// lavorare. Si tengono gli ultimi sessanta secondi.
library;

import 'dart:async';

import 'package:flutter/scheduler.dart';

import '../parole.dart';

class Misure {
  Misure._();

  /// Una sola per tutta l'app.
  static final Misure io = Misure._();

  static const Duration finestra = Duration(seconds: 60);
  static const Duration passo = Duration(milliseconds: 100);

  /* Un fotogramma che passa i trentadue millesimi — due fotogrammi a
   * sessanta al secondo — si vede. */
  static const int lentoOltreMs = 32;

  /* Oltre questo non e' uno scatto: e' l'app che dormiva.
   *
   * Android congela quello che nessuno sta guardando, e l'orologio di qui si
   * ferma con lei: al ritorno il ritardo e' di mezzo minuto. Segnarlo come
   * blocco vorrebbe dire mettere in cima alla pagina un numero che non parla
   * dell'app — e nasconderci sotto i blocchi veri, che sono decimi di
   * secondo. Si contano a parte: sapere che l'app e' stata in pausa serve a
   * leggere il resto. */
  static const int dormivaOltreMs = 2000;

  final _fotogrammi = <_Fotogramma>[];
  final _blocchi = <_Blocco>[];
  final _pause = <DateTime>[];
  Timer? _orologio;
  DateTime? _ultimoTic;
  bool _accese = false;

  /// Si accende una volta, all'avvio, e non si spegne piu'.
  void accendi() {
    if (_accese) return;
    _accese = true;
    SchedulerBinding.instance.addTimingsCallback(_arrivati);
    _orologio = Timer.periodic(passo, _tic);
  }

  /// Ferma l'orologio. Serve alle prove, che accendono e spengono.
  void spegni() {
    _orologio?.cancel();
    _orologio = null;
    _accese = false;
  }

  void _arrivati(List<FrameTiming> tempi) {
    final ora = DateTime.now();
    for (final uno in tempi) {
      _fotogrammi.add(
        _Fotogramma(
          ora,
          uno.buildDuration.inMicroseconds,
          uno.rasterDuration.inMicroseconds,
        ),
      );
    }
    _pota(ora);
  }

  /* Un orologio che dovrebbe suonare ogni cento millesimi: se suona in
   * ritardo, il filo principale era occupato a fare altro — decifrare,
   * leggere un JSON, costruire una lista — e lo schermo era fermo. */
  void _tic(Timer _) {
    final ora = DateTime.now();
    final prima = _ultimoTic;
    _ultimoTic = ora;
    if (prima != null) {
      final tardi = ora.difference(prima).inMilliseconds - passo.inMilliseconds;
      if (tardi > dormivaOltreMs) {
        _pause.add(ora);
      } else if (tardi > 80) {
        _blocchi.add(_Blocco(ora, tardi));
      }
    }
    _pota(ora);
  }

  void _pota(DateTime ora) {
    final soglia = ora.subtract(finestra);
    _fotogrammi.removeWhere((uno) => uno.quando.isBefore(soglia));
    _blocchi.removeWhere((uno) => uno.quando.isBefore(soglia));
    _pause.removeWhere((uno) => uno.isBefore(soglia));
  }

  /// Gli ultimi sessanta secondi, in numeri.
  UltimoMinuto get ultimoMinuto {
    _pota(DateTime.now());
    final quanti = _fotogrammi.length;
    var lenti = 0;
    var uiTotale = 0;
    var uiMax = 0;
    var gpuTotale = 0;
    var gpuMax = 0;
    for (final uno in _fotogrammi) {
      final ui = uno.uiMicro ~/ 1000;
      final gpu = uno.gpuMicro ~/ 1000;
      if (ui > lentoOltreMs || gpu > lentoOltreMs) lenti += 1;
      uiTotale += ui;
      gpuTotale += gpu;
      if (ui > uiMax) uiMax = ui;
      if (gpu > gpuMax) gpuMax = gpu;
    }
    var bloccoMax = 0;
    for (final uno in _blocchi) {
      if (uno.ms > bloccoMax) bloccoMax = uno.ms;
    }
    return UltimoMinuto(
      fotogrammi: quanti,
      lenti: lenti,
      uiMedioMs: quanti == 0 ? 0 : uiTotale ~/ quanti,
      uiMaxMs: uiMax,
      gpuMedioMs: quanti == 0 ? 0 : gpuTotale ~/ quanti,
      gpuMaxMs: gpuMax,
      blocchi: _blocchi.length,
      bloccoMaxMs: bloccoMax,
      pause: _pause.length,
    );
  }

  /// Una riga, per la diagnostica che parte con una segnalazione.
  String get riassunto => ultimoMinuto.riga;
}

class UltimoMinuto {
  const UltimoMinuto({
    required this.fotogrammi,
    required this.lenti,
    required this.uiMedioMs,
    required this.uiMaxMs,
    required this.gpuMedioMs,
    required this.gpuMaxMs,
    required this.blocchi,
    required this.bloccoMaxMs,
    this.pause = 0,
  });

  final int fotogrammi;
  final int lenti;
  final int uiMedioMs;
  final int uiMaxMs;
  final int gpuMedioMs;
  final int gpuMaxMs;
  final int blocchi;
  final int bloccoMaxMs;

  /// Quante volte l'app e' stata messa da parte e ripresa, nell'ultimo
  /// minuto. Non e' un difetto: e' il contesto per leggere il resto.
  final int pause;

  int get percentoLenti =>
      fotogrammi == 0 ? 0 : (lenti * 100 / fotogrammi).round();

  String get riga {
    final inPausa = pause == 0 ? '' : '; in pausa ${volte(pause)}';
    return fotogrammi == 0
        ? 'nessun fotogramma nell\'ultimo minuto; blocchi: $blocchi'
              '${blocchi == 0 ? '' : ' (max $bloccoMaxMs ms)'}$inPausa'
        : '$fotogrammi fotogrammi in 60 s, $percentoLenti% lenti; '
              'UI $uiMedioMs ms (max $uiMaxMs), GPU $gpuMedioMs ms (max $gpuMaxMs); '
              'blocchi: $blocchi${blocchi == 0 ? '' : ' (max $bloccoMaxMs ms)'}'
              '$inPausa';
  }
}

class _Fotogramma {
  const _Fotogramma(this.quando, this.uiMicro, this.gpuMicro);
  final DateTime quando;
  final int uiMicro;
  final int gpuMicro;
}

class _Blocco {
  const _Blocco(this.quando, this.ms);
  final DateTime quando;
  final int ms;
}
