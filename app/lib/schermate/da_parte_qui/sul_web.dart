/// Nel browser: la plancia che si fa da parte mentre la barra la copre.
///
/// Il perche' sta in `qui.dart`. Qui c'e' il come, ed e' poco: una proprieta'
/// che si accende e si spegne.
library;

import 'dart:js_interop';

import 'package:web/web.dart' as web;

/// Se il riquadro della plancia si fa da parte.
///
/// Mentre la barra lo copre, si: i tocchi lo attraversano e arrivano all'app,
/// cosi' le voci della barra si premono e toccare fuori la chiude.
void laPlanciaSiFaDaParte(bool si) {
  final quanto = si ? 'none' : 'auto';
  /* Tutti i riquadri, non solo quello della plancia: quale sia quello giusto
   * lo sa il motore, non noi, e un riquadro che in quel momento non si vede
   * non se ne accorge. */
  final riquadri = web.document.querySelectorAll('flt-platform-view');
  for (var quale = 0; quale < riquadri.length; quale += 1) {
    final uno = riquadri.item(quale);
    if (uno == null || !uno.isA<web.HTMLElement>()) continue;
    (uno as web.HTMLElement).style.pointerEvents = quanto;
  }
}
