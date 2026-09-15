/* Che l'avviso «non hai ancora collegato le tue entita'» dica la verita'.
 *
 * La plancia lo scrive mezzo secondo dopo che la pagina e' pronta, se quattro
 * cose sono vuote, e quella domanda se la fa una volta sola. Qui la
 * configurazione arriva sul filo — dopo — e il servitore le tiene il posto
 * (`Premesse.lAvvisoAspettaLaConfigurazione`, `ponte/src/premesse.js`).
 *
 * Quattro casi, in un browser vero, su una pagina finta che ha dentro quel
 * pezzo di plancia com'e' scritto:
 *
 *   - configurazione piena che arriva tardi, col loro avviso di ripristino:
 *     l'avviso non deve comparire;
 *   - vuota che arriva tardi: l'avviso compare, ed e' giusto;
 *   - piena che arriva **senza** nessun avviso — e' il caso del deposito
 *     locale del browser, che non fa scattare niente: il posto se ne va da
 *     se';
 *   - vuota che non arriva mai: l'avviso compare con la scadenza, se no in
 *     una casa davvero vuota non comparirebbe mai.
 *
 *     node collaudo/guarda-l-avviso.mjs
 *
 * Dura un quarto di minuto — dodici secondi li aspetta la scadenza — e non ha
 * bisogno ne' del ponte ne' dell'app: e' l'unica cosa del collaudo che si puo'
 * far girare da sola. */
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { AVVISO_ASPETTA_LA_CONFIGURAZIONE } from "../ponte/src/premesse.js";

const DOVE = mkdtempSync(join(tmpdir(), "gdahome-avviso-"));

/* La pagina finta: il pezzo della plancia che conta, com'e' scritto in
 * `dashboard-runtime-it.js` — le quattro domande, l'avviso col suo nome, e la
 * domanda fatta una volta sola mezzo secondo dopo. */
function pagina() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>prova</title></head>
<body><div id="page-home"><p>la Home</p></div>
<script>
var CD_REQUIRE_MAPPING = true;
let ENTITY_OVERRIDES = {};
var CONFIG = {};
function cdCfg(chiave){ return CONFIG[chiave] || {}; }
function cdCfgList(chiave){ var v = CONFIG[chiave]; return Array.isArray(v) ? v : []; }
function cdEmptyStateCheck(){
  if (typeof CD_REQUIRE_MAPPING === 'undefined' || !CD_REQUIRE_MAPPING) return;
  const noSlots = !Object.keys(ENTITY_OVERRIDES || {}).length;
  const noRooms = !(cdCfgList('cd_stanze')).length;
  const noClima = !(cdCfgList('cd_clima_units')).length;
  const noLights = !Object.keys(cdCfg('cd_luci') || {}).length;
  if (!(noSlots && noRooms && noClima && noLights)) return;
  const home = document.getElementById('page-home');
  if (!home || document.getElementById('cd-empty-banner')) return;
  const b = document.createElement('div');
  b.id = 'cd-empty-banner';
  b.textContent = 'La dashboard e quasi pronta!';
  home.insertBefore(b, home.firstChild);
}
document.addEventListener('DOMContentLoaded', () => setTimeout(cdEmptyStateCheck, 500));
/* Quello che fa il ponte quando la configurazione arriva sul filo. */
window.arrivaLaConfigurazione = function (piena, conLAvviso) {
  if (piena) { ENTITY_OVERRIDES = { 'dm.casa': 'sensor.casa' }; CONFIG['cd_stanze'] = [{ nome: 'Cucina' }]; }
  /* Senza avviso: e' come quando la configurazione arriva dal deposito locale
     del browser, che non fa scattare «ripristinata». */
  if (conLAvviso) window.dispatchEvent(new CustomEvent('dashboardmodern:persistence-restored', { detail: {} }));
};
</script>
${AVVISO_ASPETTA_LA_CONFIGURAZIONE}
</body></html>`;
}

/* Lo stesso Chromium del collaudo, cercato come lo cerca lui: quello detto a
 * mano, poi quelli che Playwright ha gia' scaricato, e se non si trova niente
 * decide Playwright. */
function ilBrowser() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const scaricati = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!scaricati || !existsSync(scaricati)) return null;
  for (const nome of readdirSync(scaricati)) {
    if (!nome.startsWith("chromium")) continue;
    for (const coda of [
      ["chrome-linux", "chrome"],
      ["chrome-linux", "headless_shell"],
      ["chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"],
    ]) {
      const dove = join(scaricati, nome, ...coda);
      if (existsSync(dove)) return dove;
    }
  }
  return null;
}

const dove = ilBrowser();
const browser = await chromium.launch({ ...(dove ? { executablePath: dove } : {}) });

async function guarda(piena, { conLAvviso = true, aspetta = 200 } = {}) {
  writeFileSync(join(DOVE, "prova-avviso.html"), pagina());
  const p = await browser.newPage();
  const guai = [];
  p.on("pageerror", (e) => guai.push(e.message));
  await p.goto(`file://${join(DOVE, "prova-avviso.html")}`, { waitUntil: "domcontentloaded" });
  /* Un secondo: la domanda della plancia e' partita — la fa a mezzo secondo —
   * e la configurazione non e' ancora arrivata. */
  await p.waitForTimeout(1000);
  const prima = await p.evaluate(() => {
    const chi = document.getElementById("cd-empty-banner");
    return {
      cE: Boolean(chi),
      nostro: Boolean(chi && chi.hasAttribute("data-gdahome-posto")),
      siVede: Boolean(chi && chi.offsetParent !== null),
    };
  });
  await p.evaluate(([q, avviso]) => window.arrivaLaConfigurazione(q, avviso), [piena, conLAvviso]);
  await p.waitForTimeout(aspetta);
  const dopo = await p.evaluate(() => {
    const chi = document.getElementById("cd-empty-banner");
    return {
      cE: Boolean(chi),
      nostro: Boolean(chi && chi.hasAttribute("data-gdahome-posto")),
      siVede: Boolean(chi && chi.offsetParent !== null),
      scritta: (chi && chi.textContent) || "",
    };
  });
  await p.close();
  return { prima, dopo, guai };
}

const conLaConfigurazione = await guarda(true);
const senza = await guarda(false);
/* E le stesse due senza nessun avviso: la configurazione che arriva dal
 * deposito locale non fa scattare «ripristinata», e il posto non puo' restare
 * occupato per sempre — se no in una casa davvero vuota l'avviso non
 * comparirebbe mai. Il conto alla rovescia e' dodici secondi. */
const mutaEPiena = await guarda(true, { conLAvviso: false, aspetta: 700 });
const mutaEVuota = await guarda(false, { conLAvviso: false, aspetta: 13_000 });
await browser.close();

console.log("configurazione piena, arrivata tardi:");
console.log("  prima:", JSON.stringify(conLaConfigurazione.prima));
console.log("  dopo: ", JSON.stringify(conLaConfigurazione.dopo));
console.log("  guai: ", conLaConfigurazione.guai);
console.log("configurazione vuota, arrivata tardi:");
console.log("  prima:", JSON.stringify(senza.prima));
console.log("  dopo: ", JSON.stringify(senza.dopo));
console.log("  guai: ", senza.guai);
console.log("piena, e nessun avviso (deposito locale):");
console.log("  dopo: ", JSON.stringify(mutaEPiena.dopo));
console.log("vuota, e nessun avviso: l'avviso arriva con la scadenza:");
console.log("  dopo: ", JSON.stringify(mutaEVuota.dopo));

const bene =
  conLaConfigurazione.prima.nostro &&
  !conLaConfigurazione.prima.siVede &&
  !conLaConfigurazione.dopo.cE &&
  senza.prima.nostro &&
  !senza.prima.siVede &&
  senza.dopo.cE &&
  !senza.dopo.nostro &&
  senza.dopo.siVede &&
  /* Senza nessun avviso: il posto se ne va da se' appena la configurazione
   * c'e', e se non c'e' l'avviso arriva con la scadenza. */
  !mutaEPiena.dopo.cE &&
  mutaEVuota.dopo.cE &&
  !mutaEVuota.dopo.nostro &&
  mutaEVuota.dopo.siVede &&
  !conLaConfigurazione.guai.length &&
  !senza.guai.length &&
  !mutaEPiena.guai.length &&
  !mutaEVuota.guai.length;
console.log(bene ? "\nTUTTO BENE" : "\nNON VA");
process.exit(bene ? 0 : 1);
