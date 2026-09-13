/// Nel browser: la fascia che rivela la maniglia, e la plancia che si fa da
/// parte.
///
/// Il perche' sta in `qui.dart`. Qui c'e' il come, ed e' poco: un elemento
/// invisibile e una proprieta' che si accende e si spegne. Niente gesti
/// riscritti — quelli restano della maniglia disegnata dall'app, che e' lo
/// stesso pezzo di codice del telefono.
library;

import 'dart:js_interop';

import 'package:web/web.dart' as web;

/// La fascia, finche' c'e'.
web.HTMLDivElement? _fascia;

/// Mette la fascia sopra il riquadro, esattamente dove sta la maniglia.
///
/// Si puo' chiamare quante volte si vuole: la fascia e' una, e la seconda
/// chiamata non fa niente. Le misure arrivano da chi disegna la maniglia — non
/// si riscrivono qui — se no il dito troverebbe il gesto in un posto e la
/// pillola in un altro.
void mettiLaFascia({
  required double larga,
  required double alta,
  required double dalBordo,
}) {
  if (_fascia != null) return;
  final vista = web.document.querySelector('flutter-view');
  final fascia = web.document.createElement('div') as web.HTMLDivElement;
  /* Per chi non vede non c'e': la maniglia ha il suo nome, e lo dice l'app
   * (`Semantics` in `barra.dart`). Il suo riquadro sta **sopra** questa fascia
   * — l'ordine nella pagina lo decide il motore, e la parte per chi non vede
   * la mette per ultima — percio' con un lettore di schermo il tocco arriva al
   * nome e questa fascia non si mette in mezzo. */
  fascia.setAttribute('aria-hidden', 'true');
  fascia.style
    ..position = 'fixed'
    ..left = '${dalBordo}px'
    ..top = '50%'
    ..transform = 'translateY(-50%)'
    ..width = '${larga}px'
    ..height = '${alta}px'
    ..background = 'transparent'
    /* Il browser non deve farne un suo gesto — scorrere la pagina, tornare
     * indietro — se no il trascinamento se lo prende lui e all'app non arriva
     * niente. E' la stessa cosa che fa la maniglia sul telefono, dove il dito
     * che si muove sulla pillola non scorre la plancia sotto. */
    ..touchAction = 'none'
    ..cursor = 'pointer';
  fascia.addEventListener(
    'pointerdown',
    ((web.PointerEvent evento) {
      /* Il dito parte da qui e in mezzo secondo e' fuori: il resto del
       * trascinamento cadrebbe sul riquadro, che se lo mangia, e l'app
       * vedrebbe un tocco che comincia e non finisce mai. Prendendosi il
       * puntatore, tutti i movimenti fino a quando si stacca restano suoi —
       * salgono alla vista, e la maniglia li riceve dove sono davvero. */
      try {
        fascia.setPointerCapture(evento.pointerId);
      } catch (_) {
        /* Un puntatore che non c'e' piu': il gesto e' finito prima, e non
         * c'e' niente da tenere. */
      }
    }).toJS,
  );
  /* Sopra il riquadro, sotto la parte per chi non vede: e' l'ordine nella
   * pagina che lo decide, non un numero messo a mano. */
  final semantica = vista?.querySelector('flt-semantics-host');
  if (vista != null && semantica != null) {
    vista.insertBefore(fascia, semantica);
  } else if (vista != null) {
    vista.appendChild(fascia);
  } else {
    /* Nessuna vista: l'app non e' ancora nella pagina. Non si mette niente, e
     * chi disegna richiamera' al prossimo giro. */
    return;
  }
  _fascia = fascia;
}

/// Toglie la fascia.
void togliLaFascia() {
  _fascia?.remove();
  _fascia = null;
}

/// Se il riquadro della plancia si fa da parte.
///
/// Mentre la barra lo copre, si: i tocchi lo attraversano e arrivano all'app,
/// cosi' le voci della barra si premono e toccare fuori la chiude. La fascia
/// si fa da parte con lui — a barra aperta sta sotto le sue prime voci, e un
/// tocco che voleva «Plancia» finirebbe a lei.
void laPlanciaSiFaDaParte(bool si) {
  final quanto = si ? 'none' : 'auto';
  _fascia?.style.pointerEvents = quanto;
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
