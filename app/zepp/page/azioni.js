/* Le azioni rapide della plancia: un tocco, e si dice com'e' andata.
 *
 * «Fatto» su una cosa che non parte da qui sarebbe una bugia: una che il
 * telefono deve fare da se' si vede spenta, con scritto perche', come su Wear
 * OS («Parte quando apri GdAHome»).
 */

import { push } from "@zos/router";
import { px } from "@zos/utils";
import { BasePage } from "@zeppos/zml/base-page";

import { COLORE, LARGO, MISURE } from "../utils/stile";
import { Tela } from "../utils/tela";
import { chiediLaFoto, colpetto, laFotoDiPrima, manda } from "../utils/il-telefono";

const tela = new Tela();

Page(
  BasePage({
    onInit() {
      chiediLaFoto(this)
        .then((r) => r.foto && this.disegna(r.foto))
        .catch(() => {});
    },

    build() {
      const foto = laFotoDiPrima();
      if (foto) this.disegna(foto);
    },

    disegna(foto) {
      tela.svuota();
      tela.testata("Azioni", foto.azioni.length ? "Tocca per farla partire" : "");
      if (!foto.azioni.length) {
        tela.scritta({
          x: 0,
          y: px(MISURE.lista),
          w: LARGO,
          h: px(60),
          testo: "Nessuna azione rapida nella plancia.",
          colore: COLORE.tenue,
          centro: true,
        });
        return;
      }
      const x = px(MISURE.margine);
      const w = LARGO - x * 2;
      const h = px(MISURE.riga);
      foto.azioni.forEach((a, i) => {
        const y = px(MISURE.lista) + i * (h + px(MISURE.spazio));
        const via = a.subito ? () => this.fai(a) : null;
        tela.fondo({ x, y, w, h, raggio: h / 2, quando: via });
        tela.segno({ cx: x + px(41), cy: y + h / 2, raggio: px(27), nome: "azione", quando: via });
        if (a.subito) {
          tela.scritta({ x: x + px(80), y, w: w - px(100), h, testo: a.nome, quando: via });
        } else {
          tela.scritta({
            x: x + px(80),
            y: y + px(14),
            w: w - px(100),
            h: px(32),
            testo: a.nome,
            colore: COLORE.tenue,
          });
          tela.scritta({
            x: x + px(80),
            y: y + px(46),
            w: w - px(100),
            h: px(24),
            testo: "Si fa dal telefono",
            grande: 16,
            colore: COLORE.tenue,
          });
        }
      });
    },

    fai(a) {
      colpetto();
      manda(this, { id: a.id, cosa: "azione" }).then((r) => {
        push({
          url: "page/esito",
          params: JSON.stringify(
            r.ok
              ? { ok: true, titolo: "Fatto", testo: `${a.nome} è partita` }
              : { ok: false, titolo: "Non è partito", testo: r.testo },
          ),
        });
      });
    },

    onDestroy() {
      tela.svuota();
    },
  }),
);
