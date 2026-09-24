/* «Possibilità di togliere la sezione se uno non dispone di telecamere» (#113).
 *
 * Le telecamere non sono una sezione della plancia: stanno dentro Sicurezza,
 * insieme all'allarme e ai varchi. Chi non ne ha una poteva solo spegnere
 * Sicurezza intera — e perdere anche l'allarme e le porte, che con le
 * telecamere non c'entrano niente.
 *
 * Il modello si prova senza browser; qui si pretende la cosa che il modello
 * non può dimostrare: che il riquadro sparisca dalla pagina vera, che sparisca
 * anche la sua pastiglia in cima, e che quello che gli sta accanto resti dov'è.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const CAMERE = [
  { id: "cam-corte", name: "Cortile", entity: "camera.cortile" },
  { id: "cam-porta", name: "Ingresso", entity: "camera.ingresso" },
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: CAMERE,
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, security: true },
};

const STATI = {
  "camera.cortile": {
    entity_id: "camera.cortile",
    state: "idle",
    attributes: { friendly_name: "Cortile" },
  },
  "camera.ingresso": {
    entity_id: "camera.ingresso",
    state: "idle",
    attributes: { friendly_name: "Ingresso" },
  },
};

async function apriSicurezza(page, testInfo) {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    ({ stati, camere }) => {
      const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
      if (raw) Object.assign(raw, stati);
      localStorage.setItem("cd_cameras", JSON.stringify(camere));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { stati: STATI, camere: CAMERE },
  );
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => document.getElementById("editor-modal")?.remove());
  await page
    .locator('.tab[data-tab="security"]')
    .first()
    .evaluate((n) => n.click());
  await page.waitForTimeout(800);
}

/* Si scrive col nome che la plancia usa, non con quello intestato
 * all'istanza: il deposito di questa prova è avvolto, e l'involucro il
 * prefisso ce lo mette lui. Scrivendolo a mano si finisce accanto alla chiave
 * vera, e la pagina non si accorge di niente. */
const spegni = (page, mostra) =>
  page.evaluate((valore) => {
    localStorage.setItem("cd_telecamere_in_sicurezza", JSON.stringify({ mostra: valore }));
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  }, mostra);

test("il riquadro delle telecamere si toglie, e l'allarme resta", async ({ page }, testInfo) => {
  await apriSicurezza(page, testInfo);

  const cctv = page.locator("#page-security .dm-sec-cctv");
  const pastiglia = page.locator("#page-security [data-dm-cctv-pill]");
  /* Quello che si vede nella pagina, per nome: si confronta com'era e com'è,
   * e si pretende che l'unica cosa cambiata siano le telecamere. Un elenco
   * fisso di blocchi non andrebbe bene — questa pagina ne disegna di diversi a
   * seconda di cosa la casa ha — e la domanda vera è proprio «cos'altro si è
   * mosso». */
  const iBlocchi = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("#page-security .dm-sec-shell > *")]
        .filter((n) => n.offsetParent !== null)
        .map((n) => n.className)
        .sort(),
    );

  /* Chi non ha mai toccato l'interruttore le vede, come prima. */
  await expect(cctv).toBeVisible({ timeout: 20_000 });
  const prima = await iBlocchi();
  expect(prima, "il riquadro delle telecamere deve esserci").toContain("dm-sec-cctv");
  await page.screenshot({
    path: process.env.SCATTO_PRIMA || "/tmp/sicurezza-con.png",
    clip: await page
      .locator("#page-security")
      .boundingBox()
      .then((b) => ({
        x: b.x,
        y: b.y,
        width: b.width,
        height: Math.min(b.height, 900),
      })),
  });

  /* Spento: il riquadro se ne va, e con lui la pastiglia che parlava delle
   * stesse telecamere. */
  await spegni(page, false);
  await expect(cctv).toBeHidden({ timeout: 20_000 });
  await expect(pastiglia).toBeHidden();
  /* E quello che con le telecamere non c'entra resta dov'era: è per non
   * perderlo che questo interruttore esiste. */
  const dopo = await iBlocchi();
  expect(dopo, "si deve essere mosso solo il riquadro delle telecamere").toEqual(
    prima.filter((nome) => nome !== "dm-sec-cctv"),
  );
  await page.screenshot({
    path: process.env.SCATTO_DOPO || "/tmp/sicurezza-senza.png",
    clip: await page
      .locator("#page-security")
      .boundingBox()
      .then((b) => ({
        x: b.x,
        y: b.y,
        width: b.width,
        height: Math.min(b.height, 900),
      })),
  });

  /* E si torna indietro: le telecamere non sono state cancellate. */
  await spegni(page, true);
  await expect(cctv).toBeVisible({ timeout: 20_000 });
  const quante = await page.evaluate(
    () => JSON.parse(localStorage.getItem("cd_cameras") || "[]").length,
  );
  expect(quante, "le telecamere configurate non si toccano").toBe(2);
});
