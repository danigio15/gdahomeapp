/* Una luce sola, col dimmer: l'arco della luminosita', meno e piu' di dieci
 * alla volta, e il tasto per spegnerla o accenderla.
 *
 * Sul tondo l'arco corre lungo il bordo; sul quadrato e' un anello al
 * centro. I tocchi su meno e piu' non partono uno per uno: si aspetta che il
 * dito si fermi un attimo, e parte l'ultimo valore. Dieci colpetti di fila
 * sarebbero dieci giri della casa, e una lampadina che sfarfalla.
 */

import { back } from "@zos/router";
import { px } from "@zos/utils";
import { widget, prop } from "@zos/ui";
import { BasePage } from "@zeppos/zml/base-page";

import { COLORE, LARGO, TONDO } from "../utils/stile";
import { Tela } from "../utils/tela";
import { colpetto, laFotoDiPrima, manda } from "../utils/il-telefono";

const tela = new Tela();
const PASSO = 10;
const QUANTO_SI_ASPETTA_IL_DITO_MS = 600;

let id = "";
let livello = 0;
let arco = null;
let cifra = null;
let inAttesa = null;

function laLuce() {
  return (laFotoDiPrima()?.dispositivi || []).find((d) => d.id === id);
}

Page(
  BasePage({
    onInit(params) {
      try {
        id = JSON.parse(params || "{}").id || "";
      } catch (e) {
        id = "";
      }
    },

    build() {
      const luce = laLuce();
      if (!luce) return back();
      livello = luce.acceso ? luce.luminosita || 100 : 0;
      this.disegna(luce);
    },

    disegna(luce) {
      tela.svuota();
      const cx = LARGO / 2;
      const cy = TONDO ? LARGO / 2 : px(218);
      const raggio = TONDO ? LARGO / 2 - px(18) : px(146);
      const spessore = TONDO ? px(16) : px(18);
      const comune = {
        center_x: cx,
        center_y: cy,
        radius: raggio,
        start_angle: -135,
        end_angle: 135,
        line_width: spessore,
      };
      tela.metti(widget.ARC_PROGRESS, { ...comune, color: COLORE.cartaSu, level: 100 });
      arco = tela.metti(widget.ARC_PROGRESS, { ...comune, color: COLORE.ambra, level: livello });
      tela.scritta({
        x: 0,
        y: TONDO ? px(70) : px(22),
        w: LARGO,
        h: px(30),
        testo: luce.nome,
        grande: 21,
        centro: true,
      });
      cifra = tela.scritta({
        x: 0,
        y: TONDO ? px(140) : px(116),
        w: LARGO,
        h: px(100),
        testo: `${livello}%`,
        grande: 80,
        centro: true,
      });
      tela.scritta({
        x: 0,
        y: TONDO ? px(240) : px(214),
        w: LARGO,
        h: px(26),
        testo: "LUMINOSITÀ",
        grande: 18,
        colore: COLORE.tenue,
        centro: true,
      });
      const lato = TONDO ? px(72) : px(64);
      const yTondi = TONDO ? px(268) : px(262);
      const dentro = TONDO ? px(70) : px(118);
      tela.metti(widget.BUTTON, {
        x: dentro,
        y: yTondi,
        w: lato,
        h: lato,
        radius: lato / 2,
        normal_color: COLORE.cartaSu,
        press_color: COLORE.carta,
        text: "−",
        text_size: px(40),
        click_func: () => this.cambia(-PASSO),
      });
      tela.metti(widget.BUTTON, {
        x: LARGO - dentro - lato,
        y: yTondi,
        w: lato,
        h: lato,
        radius: lato / 2,
        normal_color: COLORE.cartaSu,
        press_color: COLORE.carta,
        text: "+",
        text_size: px(40),
        click_func: () => this.cambia(PASSO),
      });
      tela.tasto({
        y: TONDO ? px(480 - 44 - 66) : px(450 - 18 - 76),
        w: TONDO ? px(200) : px(270),
        h: TONDO ? px(66) : px(76),
        testo: livello > 0 ? "Spegni" : "Accendi",
        quando: () => this.interruttore(),
      });
    },

    /* Meno e piu': l'arco e il numero cambiano subito, il comando dopo. */
    cambia(quanto) {
      colpetto();
      livello = Math.max(0, Math.min(100, livello + quanto));
      arco.setProperty(prop.LEVEL, livello);
      cifra.setProperty(prop.TEXT, `${livello}%`);
      if (inAttesa) clearTimeout(inAttesa);
      inAttesa = setTimeout(() => {
        inAttesa = null;
        const cosa = livello === 0 ? { cosa: "gira" } : { cosa: "luminosita", valore: livello };
        manda(this, { id, ...cosa }).then((r) => this.dopo(r));
      }, QUANTO_SI_ASPETTA_IL_DITO_MS);
    },

    interruttore() {
      colpetto();
      manda(this, { id, cosa: "gira" }).then((r) => this.dopo(r));
    },

    /* Com'e' andata: se la casa ha mandato la fotografia, vale quella. */
    dopo(r) {
      const luce = laLuce();
      if (r.ok && luce) {
        livello = luce.acceso ? luce.luminosita || 100 : 0;
        this.disegna(luce);
        return;
      }
      if (!r.ok) {
        cifra.setProperty(prop.TEXT, "—");
      }
    },

    onDestroy() {
      if (inAttesa) clearTimeout(inAttesa);
      tela.svuota();
    },
  }),
);
