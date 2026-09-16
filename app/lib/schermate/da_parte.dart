/// Il riquadro della plancia che si fa da parte, mentre la barra lo copre.
///
/// E' un oggetto e non una funzione per un motivo solo: cosi' nelle prove si
/// puo' mettere al suo posto qualcosa che tiene il conto di quando viene
/// chiamato. Quello che fa davvero — e perche' serve solo nel browser — sta in
/// `da_parte_qui/qui.dart`.
library;

import 'da_parte_qui/qui.dart' as pagina;

class LaPlanciaDaParte {
  const LaPlanciaDaParte();

  /// Se il riquadro della plancia si fa da parte, perche' la barra lo copre.
  void siFaDaParte(bool si) => pagina.laPlanciaSiFaDaParte(si);
}
