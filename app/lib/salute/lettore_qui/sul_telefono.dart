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

/// I tipi da chiedere per ogni misura. Il sonno: su iPhone i tratti
/// «addormentato», su Android le sessioni di sonno.
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
      MisuraDelCorpo.sonno => [
        iPhone ? HealthDataType.SLEEP_ASLEEP : HealthDataType.SLEEP_SESSION,
      ],
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
        final tratti = await _campioni(
          tipi,
          mezzanotte.subtract(const Duration(hours: 30)),
          ora,
        );
        return ilSonnoDiStanotte(tratti, ora);
      case MisuraDelCorpo.battito:
      case MisuraDelCorpo.ossigeno:
        final ultimo = lUltimo(
          await _campioni(tipi, ora.subtract(const Duration(days: 2)), ora),
        );
        if (ultimo == null || misura != MisuraDelCorpo.ossigeno) return ultimo;
        return Lettura(comePercentuale(ultimo.valore), ultimo.quando);
      case MisuraDelCorpo.battitoRiposo:
        return lUltimo(
          await _campioni(tipi, ora.subtract(const Duration(days: 7)), ora),
        );
      case MisuraDelCorpo.peso:
      case MisuraDelCorpo.grasso:
      case MisuraDelCorpo.sistolica:
      case MisuraDelCorpo.diastolica:
        final ultimo = lUltimo(
          await _campioni(tipi, ora.subtract(const Duration(days: 45)), ora),
        );
        if (ultimo == null || misura != MisuraDelCorpo.grasso) return ultimo;
        return Lettura(comePercentuale(ultimo.valore), ultimo.quando);
    }
  }

  @override
  Future<void> installaHealthConnect() async {
    if (_iPhone) return;
    await _health.installHealthConnect();
  }
}
