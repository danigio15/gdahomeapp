/* La prima pagina: quattro riquadri grandi, per il dito e non per la punta
 * di una matita. Luci, Azioni, Cancelli, e com'e' la casa.
 *
 * Se l'orologio non e' ancora abbinato si spiega come si fa, e basta: il
 * codice si scrive sul telefono, nell'app Zepp, non con la tastiera al polso.
 */

import { push } from "@zos/router";
import { px } from "@zos/utils";
import { widget, align, text_style } from "@zos/ui";
import { BasePage } from "@zeppos/zml/base-page";

import { COLORE, LARGO, TONDO } from "../utils/stile";
import { Tela } from "../utils/tela";
import { diGenere, diQuando } from "../utils/la-foto";
import { chiediLaFoto, laFotoDiPrima } from "../utils/il-telefono";

const tela = new Tela();

function apri(url, params) {
  push({ url, params: JSON.stringify(params || {}) });
}

function riquadri(foto) {
  const luci = diGenere(foto, ["luce"]);
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
      det: misura ? `${misura.nome} ${misura.valore}` : diQuando(foto.quando),
      segno: "sole",
      quando: () => apri("page/luci", { titolo: "La casa", generi: [], misure: true }),
    },
  ];
}

function disegnaLaCasa(foto) {
  tela.svuota();
  tela.testata(foto.casa || "Casa");
  const spazio = px(12);
  const margine = TONDO ? px(72) : px(18);
  const w = (LARGO - margine * 2 - spazio) / 2;
  const h = TONDO ? px(135) : px(139);
  const cima = TONDO ? px(110) : px(96);
  riquadri(foto).forEach((r, i) => {
    const x = margine + (i % 2) * (w + spazio);
    const y = cima + Math.floor(i / 2) * (h + spazio);
    tela.fondo({
      x,
      y,
      w,
      h,
      raggio: px(30),
      colore: r.acceso ? COLORE.ambra : COLORE.carta,
      premuto: r.acceso ? 0xd97706 : COLORE.cartaSu,
      quando: r.quando,
    });
    tela.segno({
      cx: x + w / 2,
      cy: y + px(38),
      raggio: px(25),
      nome: r.segno,
      acceso: r.acceso,
      quando: r.quando,
    });
    const colore = r.acceso ? COLORE.nero : COLORE.testo;
    tela.scritta({
      x,
      y: y + px(68),
      w,
      h: px(30),
      testo: r.nome,
      colore,
      centro: true,
      quando: r.quando,
    });
    tela.scritta({
      x: x + px(6),
      y: y + px(98),
      w: w - px(12),
      h: px(24),
      testo: r.det,
      grande: 16,
      colore: r.acceso ? 0x3d2a05 : COLORE.tenue,
      centro: true,
      quando: r.quando,
    });
  });
  tela.scritta({
    x: 0,
    y: cima + 2 * h + spazio + px(14),
    w: LARGO,
    h: px(24),
    testo: diQuando(foto.quando),
    grande: 16,
    colore: COLORE.tenue,
    centro: true,
  });
}

function disegnaLAbbinamento(testo) {
  tela.svuota();
  const cx = LARGO / 2;
  const cy = TONDO ? px(150) : px(120);
  tela.metti(widget.CIRCLE, { center_x: cx, center_y: cy, radius: px(48), color: COLORE.ambra });
  tela.metti(widget.IMG, {
    x: cx - px(26),
    y: cy - px(26),
    w: px(52),
    h: px(52),
    src: "segni/lega-grande.png",
  });
  tela.scritta({
    x: 0,
    y: cy + px(62),
    w: LARGO,
    h: px(44),
    testo: "Collega la casa",
    grande: 32,
    colore: COLORE.ambra,
    centro: true,
  });
  tela.metti(widget.TEXT, {
    x: px(TONDO ? 60 : 30),
    y: cy + px(112),
    w: LARGO - px(TONDO ? 120 : 60),
    h: px(110),
    text:
      testo ||
      "Sul telefono apri Zepp › GdAHome e scrivi il codice della scheda GdAHome in Home Assistant.",
    text_size: px(19),
    color: COLORE.testo,
    align_h: align.CENTER_H,
    text_style: text_style.WRAP,
  });
}

function disegnaLAttesa() {
  tela.svuota();
  tela.scritta({
    x: 0,
    y: 0,
    w: LARGO,
    h: px(TONDO ? 480 : 450),
    testo: "Cerco la casa…",
    colore: COLORE.tenue,
    centro: true,
  });
}

Page(
  BasePage({
    build() {
      const prima = laFotoDiPrima();
      if (prima) disegnaLaCasa(prima);
      else disegnaLAttesa();
    },

    onResume() {
      this.aggiorna();
    },

    onInit() {
      this.aggiorna();
    },

    aggiorna() {
      chiediLaFoto(this)
        .then((r) => {
          if (!r.abbinato) disegnaLAbbinamento(r.testo);
          else if (r.foto) disegnaLaCasa(r.foto);
        })
        .catch(() => {
          if (!laFotoDiPrima())
            disegnaLAbbinamento(
              "Il telefono non risponde. Apri l'app Zepp e tieni il telefono vicino.",
            );
        });
    },

    onDestroy() {
      tela.svuota();
    },
  }),
);
