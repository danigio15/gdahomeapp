/// Chi legge la salute sul telefono: Apple Salute o Health Connect.
///
/// Un'interfaccia, perche' le prove non hanno un telefono e il browser non ha
/// ne' l'uno ne' l'altro: nel browser [lettoreDiQuestoSistema] torna un
/// lettore che non c'e' (`disponibile` falso), e la pagina lo dice.
library;

import 'il_corpo.dart';

export 'lettore_qui/sul_web.dart'
    if (dart.library.io) 'lettore_qui/sul_telefono.dart'
    show lettoreDiQuestoSistema;

/// Com'e' messo il telefono.
enum DoveSiLegge {
  /// Apple Salute, sull'iPhone.
  appleSalute,

  /// Health Connect, su Android, installato e pronto.
  healthConnect,

  /// Android, ma Health Connect manca o va aggiornato.
  healthConnectDaInstallare,

  /// Qui non si legge niente: il browser.
  daNessunaParte,
}

abstract interface class LettoreDellaSalute {
  /// Dove legge, su questo telefono.
  Future<DoveSiLegge> dove();

  /// Chiede il permesso di leggere queste misure. `true` se il sistema ha
  /// risposto: su iPhone Apple non dice mai se il permesso c'e' (per non far
  /// sapere che dati ha uno), e una misura negata torna semplicemente vuota.
  Future<bool> chiediIlPermesso(Set<MisuraDelCorpo> misure);

  /// Le ultime letture delle misure scelte: quelle che non ci sono mancano.
  Future<Map<MisuraDelCorpo, Lettura>> leggi(
    Set<MisuraDelCorpo> misure, {
    DateTime? adesso,
  });

  /// Su Android: porta a installare o aggiornare Health Connect.
  Future<void> installaHealthConnect();
}
