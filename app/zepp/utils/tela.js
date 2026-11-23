/* La tela: disegna i pezzi di `disposizione.js` coi widget di Zepp OS, e li
 * butta giu' tutti insieme quando arriva una fotografia nuova.
 *
 * Su Zepp OS un widget resta finche' non lo si cancella: ridisegnare sopra
 * senza cancellare vuol dire due righe una sull'altra, e la memoria al polso
 * e' poca.
 */

import { createWidget, deleteWidget, widget, align, event, text_style } from "@zos/ui";

import { COLORE, SCHERMO } from "./stile";

const COLORI_DEL_TESTO = { testo: COLORE.testo, tenue: COLORE.tenue, ambra: COLORE.ambra };

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

  /** Un testo dove la disposizione lo mette. Una riga sola finisce coi
   * puntini; piu' righe vanno a capo. Se c'e' `quando`, anche il testo si
   * tocca: sta sopra il tasto, e il dito non deve cercare il bordo. */
  scritta(pezzo, parola, { colore = null, quando = null } = {}) {
    const t = this.metti(widget.TEXT, {
      x: pezzo.x,
      y: pezzo.y,
      w: pezzo.w,
      h: pezzo.h,
      text: String(parola ?? ""),
      text_size: pezzo.grande,
      color: colore ?? COLORI_DEL_TESTO[pezzo.colore] ?? COLORE.testo,
      align_h: pezzo.allinea === "sinistra" ? align.LEFT : align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: pezzo.righe > 1 ? text_style.WRAP : text_style.ELLIPSIS,
    });
    if (quando) t.addEventListener(event.CLICK_UP, () => quando());
    return t;
  }

  /** Il fondo di un riquadro o di una riga: un tasto tutto tondo. */
  fondo(pezzo, { colore = COLORE.carta, premuto = COLORE.cartaSu, quando = null } = {}) {
    return this.metti(widget.BUTTON, {
      x: pezzo.x,
      y: pezzo.y,
      w: pezzo.w,
      h: pezzo.h,
      radius: pezzo.r,
      normal_color: colore,
      press_color: premuto,
      text: "",
      click_func: () => quando && quando(),
    });
  }

  /** Un tasto con la scritta dentro. */
  tasto(pezzo, parola, { pieno = false, quando = null } = {}) {
    return this.metti(widget.BUTTON, {
      x: pezzo.x,
      y: pezzo.y,
      w: pezzo.w,
      h: pezzo.h,
      radius: pezzo.r,
      normal_color: pieno ? COLORE.ambra : COLORE.cartaSu,
      press_color: pieno ? COLORE.ambraPremuta : COLORE.carta,
      color: pieno ? COLORE.nero : COLORE.testo,
      text_size: Math.round(Math.min(pezzo.h * 0.42, SCHERMO.px(24))),
      text: String(parola),
      click_func: () => quando && quando(),
    });
  }

  /** Il segno in un tondo: ambra tenue, o ambra pieno se e' acceso. Le
   * icone sono PNG da 30 a 480 di larghezza (`strumenti/disegna-le-icone.mjs`),
   * e zeus le porta alla misura di ogni schermo. */
  segno(cerchio, nome, { acceso = false, quando = null } = {}) {
    this.metti(widget.CIRCLE, {
      center_x: cerchio.cx,
      center_y: cerchio.cy,
      radius: cerchio.r,
      color: acceso ? COLORE.ambra : COLORE.ambraTenue,
    });
    const lato = SCHERMO.px(30);
    const i = this.metti(widget.IMG, {
      x: cerchio.cx - Math.round(lato / 2),
      y: cerchio.cy - Math.round(lato / 2),
      w: lato,
      h: lato,
      auto_scale: true,
      src: `segni/${nome}${acceso ? "-nero" : ""}.png`,
    });
    if (quando) i.addEventListener(event.CLICK_UP, () => quando());
  }

  /** Il bollo grande di «Fatto», del no e del collegamento. */
  bollo(cerchio, nome, { pieno = true, colore = COLORE.ambra } = {}) {
    this.metti(widget.CIRCLE, {
      center_x: cerchio.cx,
      center_y: cerchio.cy,
      radius: cerchio.r,
      color: colore,
    });
    if (!pieno) {
      this.metti(widget.CIRCLE, {
        center_x: cerchio.cx,
        center_y: cerchio.cy,
        radius: cerchio.r - SCHERMO.px(6),
        color: COLORE.nero,
      });
    }
    const lato = Math.round(cerchio.r * 1.1);
    this.metti(widget.IMG, {
      x: cerchio.cx - Math.round(lato / 2),
      y: cerchio.cy - Math.round(lato / 2),
      w: lato,
      h: lato,
      auto_scale: true,
      src: `segni/${nome}.png`,
    });
  }
}
