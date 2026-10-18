/* «Devi togliere dalle sezioni il rimando al config. Qua non ci deve essere.»
 *
 * La pagina Meteo, senza stazione, mostrava una carta «Hai una stazione
 * meteo? Aggiungi i suoi sensori in ⚙️ Config › Meteo» con il tasto «Apri
 * Meteo nel Config». Non era la sola: la Sicurezza senza telecamere diceva
 * «Apri configurazione», le Automazioni «Gestisci nel config ›», la ricarica
 * di notte «Imposta», GdANav «Collega», la finestra delle voci in evidenza
 * «Scegli cosa tenere in evidenza», e una ventina di pagine vuote finivano con
 * «aggiungilo dalla scheda … della configurazione».
 *
 * Le sezioni mostrano la casa. Il Config si apre dalla sua voce, e basta:
 * qui si tiene fermo che nessuna delle pagine toccate torni a rimandarci.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { blocchiDellaPagina } from "../src/core/la-pagina-meteo.js";
import { renderLightsPopupMarkup } from "../src/sections/lights-scene-section.js";
import { renderLightsPageMarkup } from "../src/sections/lights-page-section.js";
import { roomPageMarkup } from "../src/sections/rooms-page-section.js";
import { seasonEmptyMarkup } from "../src/sections/climate-thermal-section.js";

const leggi = (percorso) => readFile(new URL(percorso, import.meta.url), "utf8");

/* Le pagine e le finestre che rimandavano al Config. */
const SEZIONI = [
  "meteo-section.js",
  "security-showcase-section.js",
  "automazioni-casa-section.js",
  "ricarica-di-notte-section.js",
  "gdanav-section.js",
  "finestre/sistema.js",
  "accumulo-section.js",
  "acquario-section.js",
  "allerte-section.js",
  "animali-section.js",
  "appliance-showcase-section.js",
  "auto-termica-section.js",
  "batterie-section.js",
  "calendario-section.js",
  "citofono-section.js",
  "climate-thermal-section.js",
  "contatori-section.js",
  "energy-flow-section.js",
  "ev-stato-e-target-section.js",
  "history-section.js",
  "il-popup-dell-auto-racconta-section.js",
  "impianti-termici-section.js",
  "lights-page-section.js",
  "lights-scene-section.js",
  "piante-section.js",
  "pool-irrigation-scene-section.js",
  "prese-section.js",
  "presenza-section.js",
  "radar-meteo-section.js",
  "rifiuti-section.js",
  "rooms-page-section.js",
  "stampanti-section.js",
  "subload-popup-section.js",
  "temperature-trend-section.js",
  "ups-section.js",
  "varchi-section.js",
];

/* I tasti e i ganci che aprivano il Config da una sezione. */
const TASTI = [
  /data-dm-meteo-apri-config/,
  /apriMeteoNelConfig/,
  /data-dm-open-config/,
  /data-auc-config/,
  /apriNelConfig/,
  /data-rn="imposta"/,
  /apriLeImpostazioniDellEnergia/,
  /data-gn-collega/,
  /data-dm-w-config/,
];

/* Le parole che mandano al Config, dentro le frasi che la pagina scrive. */
const RIMANDO =
  /(nel config|in config|⚙️ ?(Config|→)|Configurazione [›→]|Impostazioni [›→]|della configurazione|dalla Configurazione|apri la configurazione|Apri configurazione|dall'editor|dell'editor|nella scheda|dalla scheda [A-Z])/i;

/* Le Impostazioni di Home Assistant non sono il Config della plancia: dire di
 * riconnettere un'integrazione in «Dispositivi e servizi» resta. */
const DI_HOME_ASSISTANT = /Dispositivi e servizi|Home Assistant →/;

/* Le frasi italiane delle coppie `t("…", "…")`, su una riga o su due. */
function frasi(sorgente) {
  const fuori = [];
  const re = /\bt\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1\s*,/g;
  let m;
  while ((m = re.exec(sorgente))) fuori.push(m[2]);
  return fuori;
}

for (const file of SEZIONI) {
  test(`${file}: nessun tasto e nessuna frase che rimandi al Config`, async () => {
    const sorgente = await leggi(`../src/sections/${file}`);
    for (const tasto of TASTI) assert.doesNotMatch(sorgente, tasto, `${file} ha ancora ${tasto}`);
    const colpevoli = frasi(sorgente).filter(
      (frase) => RIMANDO.test(frase) && !DI_HOME_ASSISTANT.test(frase),
    );
    assert.deepEqual(colpevoli, [], `${file} rimanda ancora al Config`);
  });
}

test("Meteo: senza stazione nessun blocco «invito», nemmeno per chi configura", () => {
  const tutto = { adesso: true, stazione: false, ore: true, giorni: true, radar: true };
  assert.deepEqual(blocchiDellaPagina({}, { ...tutto, invito: true }), [
    "adesso",
    "ore",
    "giorni",
    "radar",
  ]);
  assert.ok(!blocchiDellaPagina({}, { ...tutto, invito: true }).includes("invito"));
});

test("Meteo: la carta «Hai una stazione meteo?» non esiste piu'", async () => {
  const meteo = await leggi("../src/sections/meteo-section.js");
  assert.doesNotMatch(meteo, /Hai una stazione meteo\?/);
  assert.doesNotMatch(meteo, /dm-meteo-invito/);
  assert.doesNotMatch(meteo, /invitoMarkup/);
});

test("le pagine vuote lo dicono e basta: luci, stanze, clima", () => {
  for (const html of [renderLightsPopupMarkup([]), renderLightsPageMarkup([]), roomPageMarkup([])]) {
    assert.doesNotMatch(html, RIMANDO);
    assert.doesNotMatch(html, /<button/);
  }
  assert.match(renderLightsPageMarkup([]), /Nessuna luce configurata\./);
  assert.match(roomPageMarkup([]), /Nessuna stanza configurata\./);
  const misto = seasonEmptyMarkup("caldo", [
    { entity: "climate.bagno", zone: "caldo", mesi: [10, 11, 12, 1, 2, 3, 4] },
    { entity: "climate.studio", zone: "caldo", mesi: [11, 12, 1, 2] },
  ]);
  assert.doesNotMatch(misto, RIMANDO);
});

test("Sicurezza senza telecamere: il titolo, senza «Apri configurazione»", async () => {
  const sicurezza = await leggi("../src/sections/security-showcase-section.js");
  const vuoto = sicurezza.slice(sicurezza.indexOf("data-dm-cam-empty"));
  const fine = vuoto.indexOf("</div>\n  </section>");
  const blocco = vuoto.slice(0, fine);
  assert.match(blocco, /labels\.empty\b/);
  assert.doesNotMatch(blocco, /<button/);
  assert.doesNotMatch(sicurezza, /emptyCta|emptyHint/);
});
