/* Una luce sola, col dimmer: l'arco della luminosita', meno e piu' di dieci
 * alla volta, e il tasto per spegnerla o accenderla.
 *
 * Sul tondo l'arco corre lungo il bordo; sul quadrato e' un anello al
 * centro (`disposizione.js`, `laLuce`). I tocchi su meno e piu' non partono
 * uno per uno: si aspetta che il dito si fermi un attimo, e parte l'ultimo
 * valore. Dieci colpetti di fila sarebbero dieci giri della casa, e una
 * lampadina che sfarfalla.
 */

import { back } from "@zos/router";
import { widget, prop } from "@zos/ui";
import { BasePage } from "@zeppos/zml/base-page";

import { COLORE, SCHERMO } from "../utils/stile";
import { laLuce } from "../utils/disposizione";
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

function laLuceDellaFoto() {
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
      const luce = laLuceDellaFoto();
      if (!luce) return back();
      livello = luce.acceso ? luce.luminosita || 100 : 0;
      this.disegna(luce);
    },

    disegna(luce) {
      tela.svuota();
      const d = laLuce(SCHERMO);
      const comune = {
        center_x: d.arco.cx,
        center_y: d.arco.cy,
        radius: d.arco.r,
        start_angle: d.arco.da,
        end_angle: d.arco.a,
        line_width: d.arco.spessore,
      };
      tela.metti(widget.ARC_PROGRESS, { ...comune, color: COLORE.cartaSu, level: 100 });
      arco = tela.metti(widget.ARC_PROGRESS, { ...comune, color: COLORE.ambra, level: livello });
      tela.scritta(d.nome, luce.nome);
      cifra = tela.scritta(d.cifra, `${livello}%`);
      tela.scritta(d.etichetta, "LUMINOSITÀ");
      tela.tasto(d.meno, "−", { quando: () => this.cambia(-PASSO) });
      tela.tasto(d.piu, "+", { quando: () => this.cambia(PASSO) });
      tela.tasto(d.tasto, livello > 0 ? "Spegni" : "Accendi", {
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
      const luce = laLuceDellaFoto();
      if (r.ok && luce) {
        livello = luce.acceso ? luce.luminosita || 100 : 0;
        this.disegna(luce);
        return;
      }
      if (!r.ok) cifra?.setProperty(prop.TEXT, "—");
    },

    onDestroy() {
      if (inAttesa) clearTimeout(inAttesa);
      tela.svuota();
    },
  }),
);
