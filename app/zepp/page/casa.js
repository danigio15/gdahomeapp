/* La prima pagina: quattro riquadri grandi, per il dito e non per la punta
 * di una matita. Luci, Azioni, Cancelli, e com'e' la casa.
 *
 * Se l'orologio non e' ancora abbinato si spiega come si fa, e basta: il
 * codice si scrive sul telefono, nell'app Zepp, non con la tastiera al polso.
 *
 * Mentre la pagina e' davanti si guarda la casa ogni venti secondi
 * (`guardaOgniTanto`); con lo schermo spento no.
 */

import { push } from "@zos/router";
import { BasePage } from "@zeppos/zml/base-page";

import { COLORE, SCHERMO } from "../utils/stile";
import { lAbbinamento, laCasa } from "../utils/disposizione";
import { Tela } from "../utils/tela";
import { diGenere, diQuando } from "../utils/la-foto";
import { chiediLaFoto, guardaOgniTanto, laFotoDiPrima } from "../utils/il-telefono";

const tela = new Tela();
let smetti = null;

function apri(url, params) {
  push({ url, params: JSON.stringify(params || {}) });
}

function iRiquadri(foto) {
  const luci = diGenere(foto, ["luce", "presa"]);
  const accese = luci.filter((l) => l.acceso).length;
  const varchi = diGenere(foto, ["varco", "porta"]);
  const aperti = varchi.filter((v) => v.acceso).length;
  const misura = foto.misure[0];
  return [
    {
      nome: "Luci",
      det: accese ? `${accese} access${accese === 1 ? "a" : "e"}` : "Tutte spente",
      segno: "luce",
      acceso: accese > 0,
      quando: () => apri("page/luci", { titolo: "Luci", generi: ["luce", "presa"] }),
    },
    {
      nome: "Azioni",
      det: `${foto.azioni.length} pront${foto.azioni.length === 1 ? "a" : "e"}`,
      segno: "azione",
      quando: () => apri("page/azioni"),
    },
    {
      nome: "Cancelli",
      det:
        varchi.length === 0
          ? "Nessuno"
          : aperti
            ? `${aperti} apert${aperti === 1 ? "o" : "i"}`
            : "Tutti chiusi",
      segno: "varco",
      acceso: aperti > 0,
      quando: () => apri("page/luci", { titolo: "Cancelli", generi: ["varco", "porta"] }),
    },
    {
      nome: "La casa",
      /* Il numero, e basta: «Produzione» non ci sta su un tondo piccolo, e
       * il nome lo dice la pagina che si apre. */
      det: misura ? misura.valore : diQuando(foto.quando),
      segno: "sole",
      quando: () => apri("page/luci", { titolo: "La casa", generi: [], misure: true }),
    },
  ];
}

function disegnaLaCasa(foto) {
  tela.svuota();
  const d = laCasa(SCHERMO);
  tela.scritta(d.titolo, (foto.casa || "Casa").toUpperCase());
  iRiquadri(foto).forEach((r, i) => {
    const posto = d.riquadri[i];
    tela.fondo(posto.fondo, {
      colore: r.acceso ? COLORE.ambra : COLORE.carta,
      premuto: r.acceso ? COLORE.ambraPremuta : COLORE.cartaSu,
      quando: r.quando,
    });
    tela.segno(posto.segno, r.segno, { acceso: r.acceso, quando: r.quando });
    tela.scritta(posto.nome, r.nome, { colore: r.acceso ? COLORE.nero : null, quando: r.quando });
    tela.scritta(posto.det, r.det, {
      colore: r.acceso ? COLORE.scuroSullAmbra : null,
      quando: r.quando,
    });
  });
  tela.scritta(d.piede, diQuando(foto.quando));
}

function disegnaLAbbinamento(testo) {
  tela.svuota();
  const d = lAbbinamento(SCHERMO);
  tela.bollo(d.bollo, "lega-grande");
  tela.scritta(d.titolo, "Collega la casa");
  tela.scritta(
    d.spiega,
    testo ||
      "Sul telefono apri Zepp › GdAHome e scrivi il codice della scheda GdAHome in Home Assistant.",
    { colore: COLORE.testo },
  );
}

function disegnaLAttesa() {
  tela.svuota();
  const d = laCasa(SCHERMO);
  tela.scritta({ ...d.piede, y: Math.round(SCHERMO.H / 2 - d.piede.h / 2) }, "Cerco la casa…");
}

Page(
  BasePage({
    onInit() {
      this.aggiorna();
      smetti = guardaOgniTanto(this, disegnaLaCasa);
    },

    build() {
      const prima = laFotoDiPrima();
      if (prima) disegnaLaCasa(prima);
      else disegnaLAttesa();
    },

    onResume() {
      this.aggiorna();
      smetti?.();
      smetti = guardaOgniTanto(this, disegnaLaCasa);
    },

    onPause() {
      smetti?.();
      smetti = null;
    },

    aggiorna() {
      chiediLaFoto(this)
        .then((r) => {
          if (!r.abbinato) disegnaLAbbinamento(r.testo);
          else if (r.foto) disegnaLaCasa(r.foto);
          else if (!laFotoDiPrima()) disegnaLAbbinamento(r.testo);
        })
        .catch(() => {
          if (!laFotoDiPrima()) {
            disegnaLAbbinamento(
              "Il telefono non risponde. Apri l'app Zepp e tieni il telefono vicino.",
            );
          }
        });
    },

    onDestroy() {
      smetti?.();
      smetti = null;
      tela.svuota();
    },
  }),
);
