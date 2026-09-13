/// La fascia che fa arrivare alla barra i tocchi che la pagina si mangia.
///
/// E' un oggetto e non tre funzioni per un motivo solo: cosi' nelle prove si
/// puo' mettere al suo posto qualcosa che tiene il conto di quando viene
/// chiamata. Quello che fa davvero — e perche' serve solo nel browser — sta in
/// `maniglia_qui/qui.dart`.
library;

import 'maniglia_qui/qui.dart' as pagina;

class LaFasciaDelGesto {
  const LaFasciaDelGesto();

  /// Mette la fascia dove sta la maniglia. Chiamarla due volte non fa niente.
  void metti({
    required double larga,
    required double alta,
    required double dalBordo,
  }) => pagina.mettiLaFascia(larga: larga, alta: alta, dalBordo: dalBordo);

  /// La toglie.
  void togli() => pagina.togliLaFascia();

  /// Se il riquadro della plancia si fa da parte, perche' la barra lo copre.
  void laPlanciaSiFaDaParte(bool si) => pagina.laPlanciaSiFaDaParte(si);
}
