/* «Fatto», oppure «Non è partito» con il perche'.
 *
 * Il fatto se ne va da solo dopo un attimo: si guarda e si abbassa il polso.
 * Il no resta finche' non lo si tocca, col tasto per riprovare — che torna
 * alla pagina di prima, dove il tasto si ripreme.
 */

import { back } from "@zos/router";
import { px } from "@zos/utils";
import { widget } from "@zos/ui";
import { BasePage } from "@zeppos/zml/base-page";

import { COLORE, LARGO, TONDO, frase } from "../utils/stile";
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
      const cx = LARGO / 2;
      const cy = TONDO ? px(150) : px(130);
      if (esito.ok) {
        tela.metti(widget.CIRCLE, {
          center_x: cx,
          center_y: cy,
          radius: px(66),
          color: COLORE.ambra,
        });
        tela.metti(widget.IMG, {
          x: cx - px(36),
          y: cy - px(36),
          w: px(72),
          h: px(72),
          src: "segni/si-grande.png",
        });
      } else {
        tela.metti(widget.CIRCLE, {
          center_x: cx,
          center_y: cy,
          radius: px(66),
          color: COLORE.rosso,
        });
        tela.metti(widget.CIRCLE, {
          center_x: cx,
          center_y: cy,
          radius: px(60),
          color: COLORE.nero,
        });
        tela.metti(widget.IMG, {
          x: cx - px(36),
          y: cy - px(36),
          w: px(72),
          h: px(72),
          src: "segni/no-grande.png",
        });
      }
      tela.scritta({
        x: 0,
        y: cy + px(82),
        w: LARGO,
        h: px(56),
        testo: esito.titolo,
        grande: esito.ok ? 46 : 34,
        colore: esito.ok ? COLORE.testo : COLORE.rosso,
        centro: true,
      });
      if (esito.testo) frase(esito.testo, cy + px(140), { margine: TONDO ? 56 : 34, alto: 70 });
      if (esito.ok) {
        via = setTimeout(() => back(), 1800);
      } else {
        tela.tasto({
          y: TONDO ? px(350) : px(340),
          w: px(230),
          testo: "Riprova",
          pieno: true,
          quando: () => back(),
        });
      }
    },

    onDestroy() {
      if (via) clearTimeout(via);
      tela.svuota();
    },
  }),
);
