/* Lo stile al polso, uguale a quello dell'Apple Watch e di Wear OS: nero
 * pieno (sugli AMOLED il nero e' spento, e la batteria ringrazia), l'ambra
 * F59E0B dell'accento, il grigio delle righe spente.
 *
 * Le misure si scrivono una volta per il tondo (disegnato a 480) e una per il
 * quadrato (a 390x450); `px` le porta allo schermo vero — 466, 454, 416... —
 * come dice `platforms` in `app.json`.
 */

import { getDeviceInfo, SCREEN_SHAPE_ROUND } from "@zos/device";
import { px } from "@zos/utils";
import { createWidget, widget, align, text_style } from "@zos/ui";

export const COLORE = {
  nero: 0x000000,
  carta: 0x1c1f26,
  cartaSu: 0x2a2f38,
  ambra: 0xf59e0b,
  ambraTenue: 0x3d2c0e,
  testo: 0xffffff,
  tenue: 0xa3abb8,
  rosso: 0xf87171,
  verde: 0x34d399,
};

const info = getDeviceInfo();
export const TONDO = info.screenShape === SCREEN_SHAPE_ROUND;
export const LARGO = info.width;
export const ALTO = info.height;

/* Dove stanno le cose, nelle due forme. */
export const MISURE = TONDO
  ? { titolo: 34, sotto: 80, lista: 116, margine: 50, riga: 88, spazio: 10 }
  : { titolo: 22, sotto: 66, lista: 104, margine: 16, riga: 88, spazio: 10 };

/** Un testo che va a capo, centrato: le spiegazioni e gli esiti. `y` e'
 * gia' dello schermo, il resto e' in misure di disegno. */
export function frase(
  testo,
  y,
  { colore = COLORE.tenue, grande = 20, alto = 90, margine = 56 } = {},
) {
  return createWidget(widget.TEXT, {
    x: px(margine),
    y,
    w: LARGO - px(margine * 2),
    h: px(alto),
    text: testo,
    text_size: px(grande),
    color: colore,
    align_h: align.CENTER_H,
    text_style: text_style.WRAP,
  });
}

/** Il segno di un dispositivo, dal genere che manda la plancia (`segno()` in `LaFoto.kt`). */
export function segnoDelGenere(genere) {
  switch (genere) {
    case "luce":
      return "luce";
    case "varco":
    case "porta":
      return "varco";
    case "presa":
      return "presa";
    default:
      return "azione";
  }
}
