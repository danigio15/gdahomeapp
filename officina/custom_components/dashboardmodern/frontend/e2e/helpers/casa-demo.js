/* La casa demo, dentro una prova.
 *
 * E' la stessa casa inventata del collaudo e del sito (`collaudo/casa-demo.json`),
 * con la stessa Home Assistant finta che il sito si porta in pagina
 * (`sito/casa-in-pagina.js`): persone, luci, clima, antifurto, telecamere,
 * piscina, musica, tapparelle e la configurazione della plancia gia' fatta.
 * Serve alle prove che vogliono guardare una sezione **piena**, come la vede
 * chi ha una casa vera, e non ricostruita a pezzi per l'occasione. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RADICE = new URL("../../../../../../", import.meta.url);
const CRUDO = JSON.parse(
  readFileSync(fileURLToPath(new URL("collaudo/casa-demo.json", RADICE)), "utf8"),
);
const CASA = {
  origine: "collaudo/casa-demo.json",
  entita: CRUDO.entita.map(({ entity_id, state, attributes }) => ({
    entity_id,
    state,
    attributes: attributes ?? {},
  })),
  configurazione: CRUDO.configurazione,
};
const IN_PAGINA = readFileSync(fileURLToPath(new URL("sito/casa-in-pagina.js", RADICE)), "utf8");

/* Accende la plancia sulla casa demo.
 *
 * La casa finta tiene la configurazione in memoria, e ricaricando la pagina
 * ripartirebbe da quella del file: il ponte vero invece la scrive su disco.
 * Per essere quello, qui la configurazione che la plancia ha salvato si tiene
 * in `sessionStorage` quando la pagina se ne va, e si rimette al posto di
 * quella del file quando torna — cosi' «Salva, ricarica» si prova davvero. */
export async function nellaCasaDemo(page) {
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await page.addInitScript((casa) => {
    const CHIAVE = "e2e-casa-demo-configurazione";
    let salvata = null;
    try {
      salvata = JSON.parse(sessionStorage.getItem(CHIAVE) || "null");
    } catch (_e) {}
    window.CASA_DEMO = salvata?.values
      ? { ...casa, configurazione: { ...casa.configurazione, snapshot: salvata } }
      : casa;
    window.addEventListener("pagehide", () => {
      const scatto = window.__CASA_IN_PAGINA__?.scatto?.();
      if (scatto?.values) sessionStorage.setItem(CHIAVE, JSON.stringify(scatto));
    });
  }, CASA);
  await page.addInitScript({ content: IN_PAGINA });
  await page.goto("/legacy/dashboard.html");
  await pronta(page);
}

export async function pronta(page) {
  await page.waitForFunction(
    () =>
      Boolean(window.dmDisposizione?.elenchi) &&
      document.querySelectorAll(".tab[data-tab]").length > 3,
    null,
    { timeout: 45_000 },
  );
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
}

/* Apre una sezione dalla barra, anche se sul telefono la sua voce e' fuori
 * dallo schermo o nel menu: quello che si prova qui e' la pagina, non la barra. */
export async function apri(page, sezione) {
  await page.evaluate((s) => {
    const voce = document.querySelector(`.tab[data-tab="${s}"]`);
    if (voce) voce.click();
    else window.switchTab?.(s);
  }, sezione);
  await page.waitForFunction(
    (s) => {
      const p = document.getElementById(`page-${s}`);
      return Boolean(p && p.offsetHeight > 0 && p.querySelector("[data-dm-disp-tasto]"));
    },
    sezione,
    { timeout: 20_000 },
  );
}
