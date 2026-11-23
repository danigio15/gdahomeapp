/* Un elenco di dispositivi con l'interruttore: le luci (e le prese), oppure
 * i cancelli e le porte. Con `misure` e' invece «La casa»: i numeri
 * dell'energia, senza tasti.
 *
 * La riga si gira subito, al tocco, col suo colpetto; se il comando non parte
 * torna com'era e si dice perche'. E' quello che fanno l'Apple Watch e Wear OS
 * (`IlTelefono.kt`, `gira`): «premo e non cambia stato» non deve tornare.
 *
 * Toccando il nome di una luce che sa dire la luminosita' si apre il dimmer.
 */

import { push } from "@zos/router";
import { px } from "@zos/utils";
import { widget } from "@zos/ui";
import { BasePage } from "@zeppos/zml/base-page";

import { COLORE, LARGO, MISURE, segnoDelGenere } from "../utils/stile";
import { Tela } from "../utils/tela";
import { diGenere, diQuando, girato } from "../utils/la-foto";
import { chiediLaFoto, colpetto, laFotoDiPrima, manda } from "../utils/il-telefono";

const tela = new Tela();
let chiesto = { titolo: "Luci", generi: ["luce"], misure: false };

function dettaglio(d) {
  if (d.luminosita != null)
    return d.acceso ? `${d.stato || "Accesa"} · ${d.luminosita}%` : d.stato || "Spenta";
  return d.stato;
}

Page(
  BasePage({
    onInit(params) {
      try {
        chiesto = { ...chiesto, ...JSON.parse(params || "{}") };
      } catch (e) {
        // Niente parametri: le luci.
      }
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
      if (chiesto.misure) return this.disegnaLeMisure(foto);
      const righe = diGenere(foto, chiesto.generi);
      const accese = righe.filter((d) => d.acceso).length;
      tela.testata(
        chiesto.titolo,
        righe.length
          ? `${accese} di ${righe.length} ${chiesto.generi.includes("luce") ? "accese" : "aperti"}`
          : "",
      );
      if (!righe.length) {
        tela.scritta({
          x: 0,
          y: px(MISURE.lista),
          w: LARGO,
          h: px(60),
          testo: "Niente da comandare qui.",
          colore: COLORE.tenue,
          centro: true,
        });
        return;
      }
      const x = px(MISURE.margine);
      const w = LARGO - x * 2;
      const h = px(MISURE.riga);
      righe.forEach((d, i) => {
        const y = px(MISURE.lista) + i * (h + px(MISURE.spazio));
        const apri =
          d.luminosita != null
            ? () => push({ url: "page/luce", params: JSON.stringify({ id: d.id }) })
            : () => this.gira(d);
        tela.fondo({ x, y, w, h, raggio: h / 2, quando: apri });
        tela.segno({
          cx: x + px(41),
          cy: y + h / 2,
          raggio: px(27),
          nome: segnoDelGenere(d.genere),
          acceso: d.acceso,
          quando: apri,
        });
        tela.scritta({
          x: x + px(80),
          y: y + px(14),
          w: w - px(170),
          h: px(32),
          testo: d.nome,
          quando: apri,
        });
        tela.scritta({
          x: x + px(80),
          y: y + px(46),
          w: w - px(170),
          h: px(24),
          testo: dettaglio(d),
          grande: 16,
          colore: d.acceso ? COLORE.ambra : COLORE.tenue,
          quando: apri,
        });
        tela.metti(widget.SLIDE_SWITCH, {
          x: x + w - px(80),
          y: y + (h - px(36)) / 2,
          w: px(64),
          h: px(36),
          select_bg: "interruttore-si.png",
          unselect_bg: "interruttore-no.png",
          slide_src: "interruttore-pallino.png",
          slide_select_x: px(32),
          slide_un_select_x: px(4),
          slide_y: px(4),
          checked: d.acceso,
          checked_change_func: (_w, acceso) => {
            if (acceso !== d.acceso) this.gira(d);
          },
        });
      });
    },

    disegnaLeMisure(foto) {
      tela.testata("La casa", diQuando(foto.quando));
      const x = px(MISURE.margine);
      const w = LARGO - x * 2;
      const h = px(MISURE.riga);
      foto.misure.forEach((m, i) => {
        const y = px(MISURE.lista) + i * (h + px(MISURE.spazio));
        tela.fondo({ x, y, w, h, raggio: h / 2 });
        tela.segno({ cx: x + px(41), cy: y + h / 2, raggio: px(27), nome: "sole" });
        tela.scritta({ x: x + px(80), y: y + px(14), w: w - px(100), h: px(32), testo: m.valore });
        tela.scritta({
          x: x + px(80),
          y: y + px(46),
          w: w - px(100),
          h: px(24),
          testo: m.nome,
          grande: 16,
          colore: COLORE.tenue,
        });
      });
    },

    /* Gira la riga subito; se il comando non parte, la rimette com'era. */
    gira(d) {
      colpetto();
      const foto = laFotoDiPrima();
      if (!foto) return;
      const prima = foto.dispositivi;
      foto.dispositivi = prima.map((x) => (x.id === d.id ? girato(x) : x));
      this.disegna(foto);
      manda(this, { id: d.id, cosa: "gira" }).then((r) => {
        if (r.ok) {
          if (r.foto) this.disegna(r.foto);
          return;
        }
        foto.dispositivi = prima;
        this.disegna(foto);
        push({
          url: "page/esito",
          params: JSON.stringify({ ok: false, titolo: "Non è partito", testo: r.testo }),
        });
      });
    },

    onDestroy() {
      tela.svuota();
    },
  }),
);
