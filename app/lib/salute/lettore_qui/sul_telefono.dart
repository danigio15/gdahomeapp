/// Sul telefono: Apple Salute (HealthKit) o Health Connect, col pacchetto
/// `health`.
///
/// Si legge soltanto. Ogni misura si chiede per conto suo, e una che non
/// risponde — permesso negato, nessun dato, un orologio che non la misura —
/// manca e basta: le altre arrivano lo stesso.
library;

import 'dart:io' show Platform;

import 'package:health/health.dart';

import '../il_corpo.dart';
import '../lettore.dart';
import 'sul_web.dart' show LettoreCheNonCE;

LettoreDellaSalute lettoreDiQuestoSistema() =>
    Platform.isIOS || Platform.isAndroid
    ? LettoreDelTelefono()
    : const LettoreCheNonCE();

/// Il sonno su iPhone, dormito davvero.
///
/// «Salute continua a non prendere i dati»: si chiedeva soltanto
/// `SLEEP_ASLEEP`, che in HealthKit e' «addormentato, senza fase». Da
/// watchOS 9 l'Apple Watch non lo scrive piu': scrive le fasi — essenziale
/// (`SLEEP_LIGHT`), profondo, REM — e il pacchetto `health` filtra per
/// valore, quindi di una notte col Watch non arrivava niente. Si chiedono
/// tutte: le app vecchie e le bilance-materasso scrivono ancora la prima.
const sonnoDormitoSuIPhone = [
  HealthDataType.SLEEP_ASLEEP,
  HealthDataType.SLEEP_LIGHT,
  HealthDataType.SLEEP_DEEP,
  HealthDataType.SLEEP_REM,
];

/// Un iPhone senza Watch scrive solo «a letto», dagli orari di Riposo: e'
/// quello che Salute stessa mostra come sonno, e si usa se di dormito non
/// c'e' niente.
const sonnoALettoSuIPhone = [HealthDataType.SLEEP_IN_BED];

/// I tipi da chiedere per ogni misura. Il sonno: su iPhone le fasi del
/// dormito e il «a letto», su Android le sessioni di sonno.
List<HealthDataType> tipiDi(MisuraDelCorpo misura, {required bool iPhone}) =>
    switch (misura) {
      MisuraDelCorpo.passi => [HealthDataType.STEPS],
      MisuraDelCorpo.battito => [HealthDataType.HEART_RATE],
      MisuraDelCorpo.battitoRiposo => [HealthDataType.RESTING_HEART_RATE],
      MisuraDelCorpo.peso => [HealthDataType.WEIGHT],
      MisuraDelCorpo.grasso => [HealthDataType.BODY_FAT_PERCENTAGE],
      MisuraDelCorpo.sistolica => [HealthDataType.BLOOD_PRESSURE_SYSTOLIC],
      MisuraDelCorpo.diastolica => [HealthDataType.BLOOD_PRESSURE_DIASTOLIC],
      MisuraDelCorpo.ossigeno => [HealthDataType.BLOOD_OXYGEN],
      MisuraDelCorpo.sonno =>
        iPhone
            ? [...sonnoDormitoSuIPhone, ...sonnoALettoSuIPhone]
            : [HealthDataType.SLEEP_SESSION],
      MisuraDelCorpo.calorie => [HealthDataType.ACTIVE_ENERGY_BURNED],
    };

class LettoreDelTelefono implements LettoreDellaSalute {
  LettoreDelTelefono({Health? health}) : _health = health ?? Health();

  final Health _health;
  bool _pronto = false;

  bool get _iPhone => Platform.isIOS;

  Future<void> _preparati() async {
    if (_pronto) return;
    await _health.configure();
    _pronto = true;
  }

  @override
  Future<DoveSiLegge> dove() async {
    if (_iPhone) return DoveSiLegge.appleSalute;
    try {
      final stato = await _health.getHealthConnectSdkStatus();
      return stato == HealthConnectSdkStatus.sdkAvailable
          ? DoveSiLegge.healthConnect
          : DoveSiLegge.healthConnectDaInstallare;
    } catch (_) {
      return DoveSiLegge.healthConnectDaInstallare;
    }
  }

  @override
  Future<bool> chiediIlPermesso(Set<MisuraDelCorpo> misure) async {
    await _preparati();
    final tipi = {for (final m in misure) ...tipiDi(m, iPhone: _iPhone)}
        .toList();
    if (tipi.isEmpty) return true;
    try {
      return await _health.requestAuthorization(
        tipi,
        permissions: [for (final _ in tipi) HealthDataAccess.READ],
      );
    } catch (_) {
      return false;
    }
  }

  Future<List<Campione>> _campioni(
    List<HealthDataType> tipi,
    DateTime da,
    DateTime a,
  ) async {
    final punti = await _health.getHealthDataFromTypes(
      types: tipi,
      startTime: da,
      endTime: a,
    );
    return [
      for (final p in punti)
        if (p.value is NumericHealthValue)
          Campione(
            (p.value as NumericHealthValue).numericValue.toDouble(),
            p.dateFrom,
            p.dateTo,
          ),
    ];
  }

  @override
  Future<Map<MisuraDelCorpo, Lettura>> leggi(
    Set<MisuraDelCorpo> misure, {
    DateTime? adesso,
  }) async {
    await _preparati();
    final ora = adesso ?? DateTime.now();
    final mezzanotte = DateTime(ora.year, ora.month, ora.day);
    final fuori = <MisuraDelCorpo, Lettura>{};
    for (final misura in misure) {
      try {
        final lettura = await _leggiUna(misura, ora, mezzanotte);
        if (lettura != null) fuori[misura] = lettura;
      } catch (_) {
        /* Questa no: le altre si'. */
      }
    }
    return fuori;
  }

  Future<Lettura?> _leggiUna(
    MisuraDelCorpo misura,
    DateTime ora,
    DateTime mezzanotte,
  ) async {
    final tipi = tipiDi(misura, iPhone: _iPhone);
    switch (misura) {
      case MisuraDelCorpo.passi:
        /* Il totale lo fa il sistema: telefono e orologio insieme, senza
         * contare due volte gli stessi passi. */
        final passi = await _health.getTotalStepsInInterval(mezzanotte, ora);
        return passi == null ? null : Lettura(passi.toDouble(), ora);
      case MisuraDelCorpo.calorie:
        final tratti = await _campioni(tipi, mezzanotte, ora);
        if (tratti.isEmpty) return null;
        final somma = tratti.fold<double>(0, (s, c) => s + c.valore);
        return Lettura(somma.roundToDouble(), ora);
      case MisuraDelCorpo.sonno:
        final da = mezzanotte.subtract(notteFinoA + const Duration(hours: 6));
        if (!_iPhone) {
          return ilSonnoDiStanotte(await _campioni(tipi, da, ora), ora);
        }
        /* Ogni tipo per conto suo: uno che non risponde non porta via gli
         * altri. Le fasi della stessa notte si uniscono in
         * `ilSonnoDiStanotte`, senza contare due volte. */
        Future<List<Campione>> dei(List<HealthDataType> quali) async => [
          for (final tipo in quali)
            ...await _campioni([tipo], da, ora).catchError((_) => <Campione>[]),
        ];
        return ilSonnoDiStanotte(await dei(sonnoDormitoSuIPhone), ora) ??
            ilSonnoDiStanotte(await dei(sonnoALettoSuIPhone), ora);
      case MisuraDelCorpo.battito:
      case MisuraDelCorpo.battitoRiposo:
      case MisuraDelCorpo.ossigeno:
      case MisuraDelCorpo.peso:
      case MisuraDelCorpo.grasso:
      case MisuraDelCorpo.sistolica:
      case MisuraDelCorpo.diastolica:
        final ultimo = await _lUltimoEntro(
          tipi,
          ora,
          finestraDellUltimo(misura)!,
        );
        if (ultimo == null) return null;
        final percentuale =
            misura == MisuraDelCorpo.ossigeno ||
            misura == MisuraDelCorpo.grasso;
        return percentuale
            ? Lettura(comePercentuale(ultimo.valore), ultimo.quando)
            : ultimo;
    }
  }

  /* L'ultimo valore, cercato a scalini: l'ultimo giorno, la settimana, la
   * finestra intera (`scaliniFinoA`). Ci si ferma al primo che ne ha. */
  Future<Lettura?> _lUltimoEntro(
    List<HealthDataType> tipi,
    DateTime ora,
    Duration finestra,
  ) async {
    for (final scalino in scaliniFinoA(finestra)) {
      final ultimo = lUltimo(await _campioni(tipi, ora.subtract(scalino), ora));
      if (ultimo != null) return ultimo;
    }
    return null;
  }

  @override
  Future<void> installaHealthConnect() async {
    if (_iPhone) return;
    await _health.installHealthConnect();
  }
}
