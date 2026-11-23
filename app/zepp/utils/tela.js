/* La tela: i pezzi disegnati da una pagina, da buttare giu' tutti insieme
 * quando arriva una fotografia nuova e si ridisegna.
 *
 * Su Zepp OS un widget resta finche' non lo si cancella: ridisegnare sopra
 * senza cancellare vuol dire due righe una sull'altra, e la memoria al polso
 * e' poca.
 */

import { createWidget, deleteWidget, widget, align, event } from "@zos/ui";
import { px } from "@zos/utils";
import { COLORE, LARGO, MISURE } from "./stile";

export class Tela {
  constructor() {
    this.pezzi = [];
  }

  metti(tipo, opzioni) {
    const w = createWidget(tipo, opzioni);
    this.pezzi.push(w);
    return w;
  }

  svuota() {
    for (const w of this.pezzi) deleteWidget(w);
    this.pezzi = [];
  }

  /** Il titolo in ambra in cima, e sotto la riga piccola (se c'e'). */
  testata(titolo, sotto = "") {
    this.scritta({
      x: 0,
      y: px(MISURE.titolo),
      w: LARGO,
      h: px(44),
      testo: titolo.toUpperCase(),
      grande: 32,
      colore: COLORE.ambra,
      centro: true,
    });
    if (sotto) {
      this.scritta({
        x: 0,
        y: px(MISURE.sotto),
        w: LARGO,
        h: px(28),
        testo: sotto,
        grande: 20,
        colore: COLORE.tenue,
        centro: true,
      });
    }
  }

  /** Un tasto grande, tutto tondo: il fondo di un riquadro o di una riga. */
  fondo({ x, y, w, h, raggio, colore = COLORE.carta, premuto = COLORE.cartaSu, quando }) {
    return this.metti(widget.BUTTON, {
      x,
      y,
      w,
      h,
      radius: raggio,
      normal_color: colore,
      press_color: premuto,
      text: "",
      click_func: () => quando && quando(),
    });
  }

  /** Un testo su una riga. Se c'e' `quando`, anche il testo si tocca: sta
   * sopra il tasto, e il dito non deve dover cercare il bordo. */
  scritta({ x, y, w, h, testo, grande = 22, colore = COLORE.testo, centro = false, quando }) {
    const t = this.metti(widget.TEXT, {
      x,
      y,
      w,
      h,
      text: testo,
      text_size: px(grande),
      color: colore,
      align_h: centro ? align.CENTER_H : align.LEFT,
      align_v: align.CENTER_V,
    });
    if (quando) t.addEventListener(event.CLICK_UP, () => quando());
    return t;
  }

  /** Il segno in un tondo: ambra tenue, o ambra pieno se e' acceso. */
  segno({ cx, cy, raggio, nome, acceso = false, quando }) {
    this.metti(widget.CIRCLE, {
      center_x: cx,
      center_y: cy,
      radius: raggio,
      color: acceso ? COLORE.ambra : COLORE.ambraTenue,
    });
    const lato = px(30);
    const i = this.metti(widget.IMG, {
      x: cx - lato / 2,
      y: cy - lato / 2,
      w: lato,
      h: lato,
      src: `segni/${nome}${acceso ? "-nero" : ""}.png`,
    });
    if (quando) i.addEventListener(event.CLICK_UP, () => quando());
  }

  /** Un tasto con la scritta dentro, largo quanto si chiede, centrato. */
  tasto({ y, w, h = px(76), testo, pieno = false, quando }) {
    return this.metti(widget.BUTTON, {
      x: (LARGO - w) / 2,
      y,
      w,
      h,
      radius: h / 2,
      normal_color: pieno ? COLORE.ambra : COLORE.cartaSu,
      press_color: pieno ? 0xd97706 : COLORE.carta,
      color: pieno ? COLORE.nero : COLORE.testo,
      text_size: px(22),
      text: testo,
      click_func: () => quando && quando(),
    });
  }
}
