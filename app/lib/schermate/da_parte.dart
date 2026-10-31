/// Il riquadro della plancia che si fa da parte, mentre la barra lo copre.
///
/// E' un oggetto e non una funzione per un motivo solo: cosi' nelle prove si
/// puo' mettere al suo posto qualcosa che tiene il conto di quando viene
/// chiamato. Quello che fa davvero — e perche' serve solo nel browser — sta in
/// `da_parte_qui/qui.dart`.
library;

import 'package:flutter/foundation.dart';

import 'da_parte_qui/qui.dart' as pagina;

/// Se la barra copre la plancia **del tutto**, aperta fino in fondo.
///
/// Dal campo: «lo scroll del menu ha dei frame lag, non scorre fluido». Su
/// Android la plancia la compone il sistema (composizione ibrida, vedi
/// `riquadroDelWebView`), e tutto quello che l'app disegna sopra le passa
/// attraverso a ogni fotogramma: il menu che scorre sopra la plancia scorre a
/// scatti. A menu aperto fino in fondo della plancia resta una striscia sotto
/// il velo scuro, e la si toglie dalla scena — resta caricata, e torna com'era
/// appena il menu comincia a chiudersi.
final planciaCopertaDelTutto = ValueNotifier<bool>(false);

class LaPlanciaDaParte {
  const LaPlanciaDaParte();

  /// Se il riquadro della plancia si fa da parte, perche' la barra lo copre.
  void siFaDaParte(bool si) => pagina.laPlanciaSiFaDaParte(si);

  /// Se la barra la copre del tutto ([planciaCopertaDelTutto]).
  void copertaDelTutto(bool si) => planciaCopertaDelTutto.value = si;
}
