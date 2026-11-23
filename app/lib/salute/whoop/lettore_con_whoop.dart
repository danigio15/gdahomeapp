/// Il lettore della Salute, col WHOOP collegato accanto.
///
/// Tutto come il lettore di sempre — Apple Salute o Health Connect — piu',
/// se l'account WHOOP e' collegato, le misure che da' WHOOP: recupero e
/// sforzo, che in Salute non ci sono, e la versione WHOOP di HRV, battito a
/// riposo, sonno, respiro, ossigeno e pelle. Per ogni misura la lettura piu'
/// nuova ([unisciColWhoop]).
///
/// Cosi' il WHOOP va a casa con il resto, dallo stesso postino e con gli
/// stessi tempi: ogni quarto d'ora ad app aperta, e ad app chiusa quando il
/// telefono sveglia l'app.
library;

import '../il_corpo.dart';
import '../lettore.dart';
import 'collegamento_whoop.dart';
import 'whoop.dart';

class LettoreConWhoop implements LettoreDellaSalute {
  LettoreConWhoop(this.dentro, this.whoop);

  final LettoreDellaSalute dentro;
  final CollegamentoWhoop whoop;

  /* Le misure che solo WHOOP sa dare non si chiedono al telefono: per
   * quelle non c'e' nessun permesso di Salute. */
  Set<MisuraDelCorpo> _delTelefono(Set<MisuraDelCorpo> misure) => {
    for (final m in misure)
      if (!soloDaWhoop(m)) m,
  };

  @override
  Future<DoveSiLegge> dove() => dentro.dove();

  @override
  Future<bool> chiediIlPermesso(Set<MisuraDelCorpo> misure) =>
      dentro.chiediIlPermesso(_delTelefono(misure));

  @override
  Future<Set<MisuraDelCorpo>> senzaPermesso(Set<MisuraDelCorpo> misure) =>
      dentro.senzaPermesso(_delTelefono(misure));

  @override
  Future<Map<MisuraDelCorpo, Lettura>> leggi(
    Set<MisuraDelCorpo> misure, {
    DateTime? adesso,
  }) async {
    final daSalute = await dentro.leggi(_delTelefono(misure), adesso: adesso);
    await whoop.carica();
    if (!whoop.collegato) return daSalute;
    DatiWhoop? dati;
    try {
      dati = await whoop.aggiorna();
    } catch (_) {
      /* WHOOP non risponde: quello che si aveva. */
      dati = whoop.ultimi;
    }
    if (dati == null) return daSalute;
    return unisciColWhoop(daSalute, dati.perLaSalute(), misure);
  }

  @override
  Future<void> installaHealthConnect() => dentro.installaHealthConnect();

  @override
  Future<bool> chiediIlPermessoDaChiusa() => dentro.chiediIlPermessoDaChiusa();

  @override
  Future<bool> puoLeggereDaChiusa() => dentro.puoLeggereDaChiusa();
}
