/* «Fatto», oppure «Non è partito» con il perche'.
 *
 * Il fatto se ne va da solo dopo un attimo: si guarda e si abbassa il polso.
 * Il no resta finche' non lo si tocca, col tasto per riprovare — che torna
 * alla pagina di prima, dove il tasto si ripreme.
 */

import { back } from "@zos/router";
import { BasePage } from "@zeppos/zml/base-page";

import { COLORE, SCHERMO } from "../utils/stile";
import { lEsito } from "../utils/disposizione";
import { Tela } from "../utils/tela";

const tela = new Tela();
let esito = { ok: true, titolo: "Fatto", testo: "" };
let via = null;

Page(
  BasePage({
    onInit(params) {
      try {
        esito = { ...esito, ...JSON.parse(params || "{}") };
      } catch (e) {
        // Niente da dire: «Fatto».
      }
    },

    build() {
      const d = lEsito(SCHERMO);
      if (esito.ok) tela.bollo(d.bollo, "si-grande");
      else tela.bollo(d.bollo, "no-grande", { pieno: false, colore: COLORE.rosso });
      tela.scritta(d.titolo, esito.titolo, { colore: esito.ok ? COLORE.testo : COLORE.rosso });
      if (esito.testo) tela.scritta(d.perche, esito.testo);
      if (esito.ok) {
        via = setTimeout(() => back(), 1800);
      } else {
        tela.tasto(d.tasto, "Riprova", { pieno: true, quando: () => back() });
      }
    },

    onDestroy() {
      if (via) clearTimeout(via);
      tela.svuota();
    },
  }),
);
