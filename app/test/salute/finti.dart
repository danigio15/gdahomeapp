/// Il telefono e la casa finti per le prove della Salute.
library;

import 'package:gdahome/ponte/filo.dart';
import 'package:gdahome/salute/il_corpo.dart';
import 'package:gdahome/salute/lettore.dart';

/// Un iPhone con Apple Salute piena: l'Apple Watch di Marco.
class LettoreFinto implements LettoreDellaSalute {
  LettoreFinto({this.permesso = true, this.dove_ = DoveSiLegge.appleSalute});

  bool permesso;
  final DoveSiLegge dove_;
  final chiesti = <Set<MisuraDelCorpo>>[];
  int letture = 0;

  static final adesso = DateTime(2026, 10, 29, 10);

  static final tutte = <MisuraDelCorpo, Lettura>{
    MisuraDelCorpo.passi: Lettura(7842, adesso),
    MisuraDelCorpo.battito: Lettura(
      72,
      adesso.subtract(const Duration(minutes: 3)),
    ),
    MisuraDelCorpo.battitoRiposo: Lettura(58, DateTime(2026, 10, 29, 6)),
    MisuraDelCorpo.peso: Lettura(78.4, DateTime(2026, 10, 28, 7, 5)),
    MisuraDelCorpo.sistolica: Lettura(124, DateTime(2026, 10, 28, 20, 10)),
    MisuraDelCorpo.diastolica: Lettura(81, DateTime(2026, 10, 28, 20, 10)),
    MisuraDelCorpo.sonno: Lettura(452, DateTime(2026, 10, 29, 6, 30)),
    MisuraDelCorpo.ossigeno: Lettura(97, DateTime(2026, 10, 29, 6)),
  };

  @override
  Future<DoveSiLegge> dove() async => dove_;

  @override
  Future<bool> chiediIlPermesso(Set<MisuraDelCorpo> misure) async {
    chiesti.add(misure);
    return permesso;
  }

  @override
  Future<Map<MisuraDelCorpo, Lettura>> leggi(
    Set<MisuraDelCorpo> misure, {
    DateTime? adesso,
  }) async {
    letture++;
    return {
      for (final e in tutte.entries)
        if (misure.contains(e.key)) e.key: e.value,
    };
  }

  @override
  Future<void> installaHealthConnect() async {}
}

/// Il filo con la casa: ricorda quello che gli si manda.
class FiloFinto implements Filo {
  FiloFinto({this.aperto = true});

  bool aperto;
  final mandati = <Map<String, dynamic>>[];

  @override
  bool get dentro => aperto;

  @override
  Future<dynamic> risultato(
    Map<String, dynamic> comando, {
    Duration? entro,
  }) async {
    mandati.add(comando);
    return {'scritte': []};
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
