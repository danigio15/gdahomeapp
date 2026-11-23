/* Le azioni rapide della plancia: un tocco, e si dice com'e' andata.
 *
 * «Fatto» su una cosa che non parte da qui sarebbe una bugia: una che la
 * casa non lascia partire dal polso (l'antifurto, una serratura, una che
 * chiede conferma) si vede spenta, con scritto perche'.
 */

import { push } from "@zos/router";
import { BasePage } from "@zeppos/zml/base-page";

import { COLORE, SCHERMO } from "../utils/stile";
import { laLista } from "../utils/disposizione";
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
      const d = laLista(SCHERMO, Math.max(foto.azioni.length, 1), { conInterruttore: false });
      tela.scritta(d.titolo, "AZIONI");
      if (!foto.azioni.length) {
        tela.scritta(d.sotto, "Nessuna azione rapida");
        return;
      }
      tela.scritta(d.sotto, "Tocca per farla partire");
      foto.azioni.forEach((a, i) => {
        const posto = d.righe[i];
        const via = a.subito ? () => this.fai(a) : null;
        tela.fondo(posto.fondo, { quando: via });
        tela.segno(posto.segno, "azione", { quando: via });
        if (a.subito) {
          /* Senza la riga sotto, il nome sta al centro della riga. */
          tela.scritta({ ...posto.nome, y: posto.fondo.y, h: posto.fondo.h }, a.nome, {
            quando: via,
          });
        } else {
          tela.scritta(posto.nome, a.nome, { colore: COLORE.tenue });
          tela.scritta(posto.det, "Si fa dal telefono");
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
