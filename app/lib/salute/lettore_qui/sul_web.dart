/// Nel browser: niente Salute e niente Health Connect.
library;

import '../il_corpo.dart';
import '../lettore.dart';

LettoreDellaSalute lettoreDiQuestoSistema() => const LettoreCheNonCE();

class LettoreCheNonCE implements LettoreDellaSalute {
  const LettoreCheNonCE();

  @override
  Future<DoveSiLegge> dove() async => DoveSiLegge.daNessunaParte;

  @override
  Future<bool> chiediIlPermesso(Set<MisuraDelCorpo> misure) async => false;

  @override
  Future<Map<MisuraDelCorpo, Lettura>> leggi(
    Set<MisuraDelCorpo> misure, {
    DateTime? adesso,
  }) async => const {};

  @override
  Future<void> installaHealthConnect() async {}
}
