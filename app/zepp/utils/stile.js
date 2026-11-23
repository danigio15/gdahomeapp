/* Lo stile al polso, uguale a quello dell'Apple Watch e di Wear OS: nero
 * pieno (sugli AMOLED il nero e' spento, e la batteria ringrazia), l'ambra
 * F59E0B dell'accento, il grigio delle righe spente.
 *
 * Dove stanno le cose lo dice `disposizione.js`, in proporzione allo schermo
 * vero: qui si legge com'e' fatto lo schermo, una volta sola.
 */

import { getDeviceInfo, SCREEN_SHAPE_ROUND } from "@zos/device";

import { loSchermo } from "./disposizione";

export const COLORE = {
  nero: 0x000000,
  carta: 0x1c1f26,
  cartaSu: 0x2a2f38,
  ambra: 0xf59e0b,
  ambraPremuta: 0xd97706,
  ambraTenue: 0x3d2c0e,
  testo: 0xffffff,
  tenue: 0xa3abb8,
  scuroSullAmbra: 0x3d2a05,
  rosso: 0xf87171,
};

const info = getDeviceInfo();

/** Lo schermo di questo orologio: misure, forma, e la funzione `px`. */
export const SCHERMO = loSchermo({
  larghezza: info.width,
  altezza: info.height,
  tondo: info.screenShape === SCREEN_SHAPE_ROUND,
});

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
