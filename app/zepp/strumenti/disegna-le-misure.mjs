/* I disegni di controllo: ogni pagina su ogni forma di Amazfit, con le
 * misure vere di `utils/disposizione.js`.
 *
 * Non c'e' un orologio su cui guardare, e il simulatore di Zepp non gira
 * qui. Questi disegni non sono belli: sono fedeli. Ogni pezzo sta dove la
 * pagina lo mette, con le sue misure, dentro la forma vera dello schermo — il
 * cerchio, o il quadrato con gli angoli del modello — e le parole sono quelle
 * della casa d'esempio (`app-side/vetrina.js`). Servono a vedere a occhio
 * quello che `test/misure.test.js` controlla coi conti.
 *
 *     node strumenti/disegna-le-misure.mjs <cartella>
 *
 * Serve Playwright (vedi `disegna-le-icone.mjs`).
 */

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { LE_FORME, laCasa, laLista, laLuce, loSchermo } from "../utils/disposizione.js";
import { laFotoDellaVetrina } from "../app-side/vetrina.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const qui = dirname(fileURLToPath(import.meta.url));
const fuori = resolve(process.argv[2] || join(qui, "..", "misure"));
mkdirSync(fuori, { recursive: true });
const carattere = pathToFileURL(join(qui, "..", "..", "assets", "carattere")).href;

const COLORE = {
  testo: "#fff",
  tenue: "#a3abb8",
  ambra: "#f59e0b",
  nero: "#000",
  carta: "#1c1f26",
};
const SEGNI = {
  luce: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z",
  azione: "M13 2 4 14h7l-1 8 9-12h-7l1-8z",
  varco: "M3 21V8M21 21V8M3 10h18M3 15h18M8 10v5M13 10v5M18 10v5",
  sole: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
};

const esc = (t) =>
  String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

function testo(p, parola, { colore = null, spesso = 700 } = {}) {
  const giustifica = p.allinea === "sinistra" ? "left" : "center";
  const righe = p.righe > 1;
  return `<div style="position:absolute;left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;
    display:flex;align-items:center;justify-content:${giustifica === "left" ? "flex-start" : "center"};
    font-size:${p.grande}px;font-weight:${spesso};color:${colore || COLORE[p.colore] || COLORE.testo};
    line-height:1.25;text-align:${giustifica};${righe ? "" : "white-space:nowrap;"}overflow:hidden;text-overflow:ellipsis">
    <span style="${righe ? "" : "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"}max-width:100%">${esc(parola)}</span></div>`;
}

function riquadro(p, colore) {
  return `<div style="position:absolute;left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;border-radius:${p.r}px;background:${colore}"></div>`;
}

function segno(c, nome, acceso, s) {
  const lato = Math.round(c.r * 1.15);
  return `<div style="position:absolute;left:${c.cx - c.r}px;top:${c.cy - c.r}px;width:${c.r * 2}px;height:${c.r * 2}px;border-radius:50%;
    background:${acceso ? COLORE.ambra : "#3d2c0e"};display:grid;place-items:center">
    <svg width="${lato}" height="${lato}" viewBox="0 0 24 24" fill="${nome === "azione" ? (acceso ? "#000" : COLORE.ambra) : "none"}"
      stroke="${acceso ? "#000" : COLORE.ambra}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${SEGNI[nome]}"/></svg></div>`;
}

function interruttore(p, acceso) {
  const pallino = Math.round(p.h * 0.78);
  const bordo = Math.round((p.h - pallino) / 2);
  return `<div style="position:absolute;left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;border-radius:${p.h / 2}px;background:${acceso ? COLORE.ambra : "#3b4049"}">
    <div style="position:absolute;top:${bordo}px;left:${acceso ? p.w - bordo - pallino : bordo}px;width:${pallino}px;height:${pallino}px;border-radius:50%;background:${acceso ? "#fff" : "#d1d5db"}"></div></div>`;
}

function laPaginaDellaCasa(s, foto) {
  const d = laCasa(s);
  const luci = foto.dispositivi.filter((x) => x.genere === "luce");
  const accese = luci.filter((x) => x.acceso).length;
  const dati = [
    ["Luci", `${accese} accese`, "luce", accese > 0],
    ["Azioni", `${foto.azioni.length} pronte`, "azione", false],
    ["Cancelli", "Tutti chiusi", "varco", false],
    ["La casa", `${foto.misure[0].nome} ${foto.misure[0].valore}`, "sole", false],
  ];
  let html = testo(d.titolo, "CASA");
  d.riquadri.forEach((r, i) => {
    const [nome, det, quale, acceso] = dati[i];
    html += riquadro(r.fondo, acceso ? COLORE.ambra : COLORE.carta);
    html += segno(r.segno, quale, acceso, s);
    html += testo(r.nome, nome, { colore: acceso ? "#000" : null });
    html += testo(r.det, det, { colore: acceso ? "#3d2a05" : null, spesso: 600 });
  });
  html += testo(d.piede, "Aggiornato adesso", { spesso: 600 });
  return html;
}

function laPaginaDelleLuci(s, foto) {
  const luci = foto.dispositivi.filter((x) => x.genere === "luce");
  const d = laLista(s, luci.length);
  let html = testo(d.titolo, "LUCI");
  html += testo(d.sotto, `${luci.filter((x) => x.acceso).length} di ${luci.length} accese`, {
    spesso: 600,
  });
  d.righe.forEach((r, i) => {
    const l = luci[i];
    html += riquadro(r.fondo, COLORE.carta);
    html += segno(r.segno, "luce", l.acceso, s);
    html += testo(r.nome, l.nome);
    const det = l.luminosita != null && l.acceso ? `${l.stato} · ${l.luminosita}%` : l.stato;
    html += testo(r.det, det, { colore: l.acceso ? COLORE.ambra : null, spesso: 600 });
    html += interruttore(r.interruttore, l.acceso);
  });
  return html;
}

function laPaginaDellaLuce(s, foto) {
  const d = laLuce(s);
  const luce = foto.dispositivi[0];
  const { cx, cy, r, spessore } = d.arco;
  const punto = (g) => [
    cx + r * Math.cos(((g - 90) * Math.PI) / 180),
    cy + r * Math.sin(((g - 90) * Math.PI) / 180),
  ];
  const arco = (da, a) => {
    const [x1, y1] = punto(da);
    const [x2, y2] = punto(a);
    return `M${x1} ${y1} A${r} ${r} 0 ${a - da > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  };
  const fine = -135 + 270 * (luce.luminosita / 100);
  let html = `<svg style="position:absolute;left:0;top:0" width="${s.W}" height="${s.H}">
    <path d="${arco(-135, 135)}" stroke="#2a2f38" stroke-width="${spessore}" fill="none" stroke-linecap="round"/>
    <path d="${arco(-135, fine)}" stroke="${COLORE.ambra}" stroke-width="${spessore}" fill="none" stroke-linecap="round"/></svg>`;
  html += testo(d.nome, luce.nome);
  html += testo(d.cifra, `${luce.luminosita}%`);
  html += testo(d.etichetta, "LUMINOSITÀ", { spesso: 600 });
  for (const [t, segnale] of [
    [d.meno, "−"],
    [d.piu, "+"],
  ]) {
    html +=
      riquadro(t, "#2a2f38") +
      testo({ ...t, grande: Math.round(t.h * 0.55), allinea: "centro", righe: 1 }, segnale);
  }
  html +=
    riquadro(d.tasto, "#2a2f38") +
    testo({ ...d.tasto, grande: s.px(22), allinea: "centro", righe: 1 }, "Spegni");
  return html;
}

const PAGINE = { casa: laPaginaDellaCasa, luci: laPaginaDelleLuci, luce: laPaginaDellaLuce };

const browser = await chromium.launch();
const pagina = await browser.newPage({ deviceScaleFactor: 2 });
const foto = laFotoDellaVetrina();
for (const forma of LE_FORME) {
  const s = loSchermo(forma);
  for (const [nome, disegna] of Object.entries(PAGINE)) {
    const bordo = 12;
    const raggio = s.tondo ? "50%" : `${s.angolo}px`;
    await pagina.setViewportSize({ width: s.W + bordo * 2 + 20, height: s.H + bordo * 2 + 44 });
    await pagina.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      @font-face{font-family:Inter;font-weight:600;src:url(${carattere}/Inter-600.ttf)}
      @font-face{font-family:Inter;font-weight:700;src:url(${carattere}/Inter-700.ttf)}
      body{margin:0;background:#0d0f12;font-family:Inter,sans-serif;padding:10px}
      .cassa{display:inline-block;padding:${bordo}px;background:#2a2d33;border-radius:${s.tondo ? "50%" : `${s.angolo + bordo}px`}}
      .schermo{position:relative;width:${s.W}px;height:${s.H}px;background:#000;overflow:hidden;border-radius:${raggio}}
      .nome{color:#8b93a1;font:600 12px Inter,sans-serif;margin-top:6px}
    </style></head><body><div class="cassa"><div class="schermo">${disegna(s, foto)}</div></div>
      <div class="nome">${forma.nome} · ${esc(forma.modelli)}</div></body></html>`);
    await pagina.evaluate(() => document.fonts.ready);
    await pagina.screenshot({ path: join(fuori, `${nome}-${forma.nome}.png`), fullPage: true });
  }
}
await browser.close();
console.log(`${LE_FORME.length * Object.keys(PAGINE).length} disegni in ${fuori}`);
