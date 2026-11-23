/* Le icone dell'app per Zepp OS, disegnate da qui.
 *
 * Zepp OS non disegna SVG e non ha le emoji a colori che usano l'Apple Watch
 * e Wear OS (`segno()` in `LaFoto.kt`): ogni segno e' un PNG negli asset, uno
 * per il tondo e uno per il quadrato. Si disegnano a tratto, come quelli dei
 * mockup, in due colori: ambra sul grigio della riga spenta, nero sull'ambra
 * della riga accesa. Anche l'interruttore (SLIDE_SWITCH) vuole tre immagini.
 *
 * Si rifanno con Chromium di Playwright, dalla cartella `app/zepp`:
 *
 *     node strumenti/disegna-le-icone.mjs
 *
 * (Playwright non e' una dipendenza dell'orologio: se non si trova, gli si
 * dice dov'e', per esempio `NODE_PATH=$(npm root -g)` se e' installato per
 * tutta la macchina.)
 */

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const qui = dirname(fileURLToPath(import.meta.url));
const AMBRA = "#f59e0b";
const NERO = "#000000";

/* Gli stessi tratti dei mockup (24x24, tratto 2). */
const TRATTI = {
  luce: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  azione: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" fill="C" stroke="none"/>',
  varco: '<path d="M3 21V8M21 21V8M3 10h18M3 15h18M8 10v5M13 10v5M18 10v5"/>',
  casa: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  sole: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  presa: '<path d="M9 3v5M15 3v5M6 8h12v4a6 6 0 0 1-12 0zM12 18v3"/>',
  si: '<path d="m5 12.5 4.5 4.5L19 7.5" stroke-width="3"/>',
  no: '<path d="M12 6v8M12 18.5v.5" stroke-width="3"/>',
  lega: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  spegni: '<path d="M12 3v8M6.3 7a8 8 0 1 0 11.4 0" stroke-width="2.4"/>',
};

function segno(tratto, colore, lato) {
  const dentro = tratto.replaceAll('"C"', `"${colore}"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lato}" height="${lato}" viewBox="0 0 24 24" fill="none" stroke="${colore}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${dentro}</svg>`;
}

/* L'interruttore: il fondo acceso, quello spento, e il pallino. */
const INTERRUTTORE = {
  "interruttore-si": `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="36"><rect width="64" height="36" rx="18" fill="${AMBRA}"/></svg>`,
  "interruttore-no": `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="36"><rect width="64" height="36" rx="18" fill="#3b4049"/></svg>`,
  "interruttore-pallino": `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="14" fill="#ffffff"/></svg>`,
};

const disegni = {};
for (const [nome, tratto] of Object.entries(TRATTI)) {
  disegni[`segni/${nome}`] = segno(tratto, AMBRA, 30);
  disegni[`segni/${nome}-nero`] = segno(tratto, NERO, 30);
}
/* Il bollo grande di «Fatto» e del no: lo stesso segno, piu' grosso. */
disegni["segni/si-grande"] = segno(TRATTI.si, NERO, 72);
disegni["segni/no-grande"] = segno(TRATTI.no, "#f87171", 72);
disegni["segni/lega-grande"] = segno(TRATTI.lega, NERO, 52);
for (const [nome, svg] of Object.entries(INTERRUTTORE)) disegni[nome] = svg;

const browser = await chromium.launch();
const pagina = await browser.newPage({ deviceScaleFactor: 1 });
for (const [nome, svg] of Object.entries(disegni)) {
  await pagina.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
  const figura = pagina.locator("svg");
  for (const forma of ["common.r", "common.s"]) {
    const dove = join(qui, "..", "assets", forma, `${nome}.png`);
    mkdirSync(dirname(dove), { recursive: true });
    await figura.screenshot({ path: dove, omitBackground: true });
  }
}
await browser.close();
console.log(`${Object.keys(disegni).length} icone, per il tondo e per il quadrato.`);
