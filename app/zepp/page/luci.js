/* Un elenco di dispositivi con l'interruttore: le luci (e le prese), oppure
 * i cancelli e le porte. Con `misure` e' invece «La casa»: i numeri
 * dell'energia, senza tasti.
 *
 * La riga si gira subito, al tocco, col suo colpetto; se il comando non parte
 * torna com'era e si dice perche'. E' quello che fanno l'Apple Watch e Wear OS
 * (`IlTelefono.kt`, `gira`): «premo e non cambia stato» non deve tornare.
 *
 * Toccando il nome di una luce che sa dire la luminosita' si apre il dimmer.
 * Mentre la pagina e' davanti si guarda la casa ogni venti secondi.
 */

import { push } from "@zos/router";
import { widget } from "@zos/ui";
import { BasePage } from "@zeppos/zml/base-page";

import { COLORE, SCHERMO, segnoDelGenere } from "../utils/stile";
import { laLista } from "../utils/disposizione";
import { Tela } from "../utils/tela";
import { diGenere, diQuando, girato } from "../utils/la-foto";
import {
  chiediLaFoto,
  colpetto,
  guardaOgniTanto,
  laFotoDiPrima,
  manda,
} from "../utils/il-telefono";

const tela = new Tela();
let chiesto = { titolo: "Luci", generi: ["luce"], misure: false };
let smetti = null;

function ilDettaglio(d) {
  if (d.luminosita != null && d.acceso) return `${d.stato || "Accesa"} · ${d.luminosita}%`;
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
      smetti = guardaOgniTanto(this, (foto) => this.disegna(foto));
    },

    build() {
      const foto = laFotoDiPrima();
      if (foto) this.disegna(foto);
    },

    onResume() {
      smetti?.();
      smetti = guardaOgniTanto(this, (foto) => this.disegna(foto));
    },

    onPause() {
      smetti?.();
      smetti = null;
    },

    disegna(foto) {
      tela.svuota();
      if (chiesto.misure) return this.disegnaLeMisure(foto);
      const righe = diGenere(foto, chiesto.generi);
      const accese = righe.filter((d) => d.acceso).length;
      const d = laLista(SCHERMO, Math.max(righe.length, 1));
      tela.scritta(d.titolo, chiesto.titolo.toUpperCase());
      if (!righe.length) {
        tela.scritta(d.sotto, "Niente da comandare qui");
        return;
      }
      tela.scritta(
        d.sotto,
        `${accese} di ${righe.length} ${chiesto.generi.includes("luce") ? "accese" : "aperti"}`,
      );
      righe.forEach((dispositivo, i) => {
        const posto = d.righe[i];
        const apri =
          dispositivo.luminosita != null
            ? () => push({ url: "page/luce", params: JSON.stringify({ id: dispositivo.id }) })
            : () => this.gira(dispositivo);
        tela.fondo(posto.fondo, { quando: apri });
        tela.segno(posto.segno, segnoDelGenere(dispositivo.genere), {
          acceso: dispositivo.acceso,
          quando: apri,
        });
        tela.scritta(posto.nome, dispositivo.nome, { quando: apri });
        tela.scritta(posto.det, ilDettaglio(dispositivo), {
          colore: dispositivo.acceso ? COLORE.ambra : COLORE.tenue,
          quando: apri,
        });
        const i_ = posto.interruttore;
        tela.metti(widget.SLIDE_SWITCH, {
          x: i_.x,
          y: i_.y,
          w: i_.w,
          h: i_.h,
          select_bg: "interruttore-si.png",
          unselect_bg: "interruttore-no.png",
          slide_src: "interruttore-pallino.png",
          slide_select_x: i_.w - Math.round(i_.h * 0.89),
          slide_un_select_x: Math.round(i_.h * 0.11),
          slide_y: Math.round(i_.h * 0.11),
          checked: dispositivo.acceso,
          checked_change_func: (_w, acceso) => {
            if (acceso !== dispositivo.acceso) this.gira(dispositivo);
          },
        });
      });
    },

    disegnaLeMisure(foto) {
      const d = laLista(SCHERMO, Math.max(foto.misure.length, 1), { conInterruttore: false });
      tela.scritta(d.titolo, "LA CASA");
      tela.scritta(d.sotto, diQuando(foto.quando));
      foto.misure.forEach((m, i) => {
        const posto = d.righe[i];
        tela.fondo(posto.fondo);
        tela.segno(posto.segno, "sole");
        tela.scritta(posto.nome, m.valore);
        tela.scritta(posto.det, m.nome);
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
      smetti?.();
      smetti = null;
      tela.svuota();
    },
  }),
);
