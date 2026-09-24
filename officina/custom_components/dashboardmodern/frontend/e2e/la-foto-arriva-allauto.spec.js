/* La plancia passa al telefono la fotografia che Android Auto legge.
 *
 * Il nucleo prova la forma senza browser; qui si pretende la cosa che il
 * nucleo non può dimostrare: che sulla pagina vera, con la casa configurata,
 * dal canale dell'app esca davvero un messaggio, che dentro ci siano i numeri
 * dell'energia scritti come si leggono in casa, chi c'è e i tasti — e che
 * quando non cambia niente non si rimandi nulla, perché quel messaggio sul
 * telefono diventa una scrittura su disco.
 *
 * E la cosa più importante: che fuori dall'app — dove il canale non c'è — non
 * si prepari niente del tutto.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const PERSONE = [
  { id: "p-gio", name: "Giovanni", entity: "person.giovanni" },
  { id: "p-ada", name: "Ada", entity: "person.ada" },
  { id: "p-ex", name: "Chi non c'è più", entity: "person.ex", nascosta: true },
];

const AZIONI = [
  { name: "Buonanotte", icon: "🌙", type: "scene", entity: "scene.buonanotte" },
  { name: "Cancello", icon: "🚧", type: "script", entity: "script.cancello" },
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "sala", name: "Sala" }],
    cameras: [],
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
  visibility: { home: true },
};

const STATI = {
  "person.giovanni": {
    entity_id: "person.giovanni",
    state: "home",
    attributes: { friendly_name: "Giovanni" },
  },
  "person.ada": {
    entity_id: "person.ada",
    state: "not_home",
    attributes: { friendly_name: "Ada" },
  },
  "person.ex": {
    entity_id: "person.ex",
    state: "home",
    attributes: { friendly_name: "Chi non c'è più" },
  },
  /* Le entità dell'energia di serie: sono quelle che la tessera legge quando
   * nessuno gliene ha scritte altre. */
  "dm.energy_potenza_consumo_casa": {
    entity_id: "dm.energy_potenza_consumo_casa",
    state: "725",
    attributes: { unit_of_measurement: "W" },
  },
  "dm.energy_potenza_fotovoltaico": {
    entity_id: "dm.energy_potenza_fotovoltaico",
    state: "485",
    attributes: { unit_of_measurement: "W" },
  },
};

/* Il canale dell'app, finto: quello vero lo installa il WebView del telefono
 * (`app/lib/schermate/riquadro/sul_telefono.dart`), e la pagina non ha modo di
 * sapere che questo non è lui. Si mette PRIMA che la pagina parta, perché è
 * all'avvio che la sezione guarda se c'è qualcuno che ascolta. */
async function conLAuto(page) {
  await page.addInitScript(() => {
    window.__fotoRicevute = [];
    window.gdahomeAuto = {
      postMessage(detto) {
        window.__fotoRicevute.push(detto);
      },
    };
  });
}

async function apriLaCasa(page, testInfo) {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    ({ stati, persone, azioni }) => {
      const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
      if (raw) Object.assign(raw, stati);
      localStorage.setItem("cd_people", JSON.stringify(persone));
      localStorage.setItem("cd_quick_actions", JSON.stringify(azioni));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { stati: STATI, persone: PERSONE, azioni: AZIONI },
  );
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => document.getElementById("editor-modal")?.remove());
  await page.waitForTimeout(800);
}

/* La fotografia si manda dal battito, che è ogni mezzo minuto: qui non si
 * aspetta mezzo minuto, si chiede alla sezione di guardare adesso. È la stessa
 * funzione che chiama il timer. */
const guardaAdesso = (page, quando) =>
  page.evaluate((adesso) => window.gdahomeFotoInAuto?.adesso?.(adesso) === true, quando);

test("dentro l'app la fotografia parte, e porta quello che si legge guidando", async ({
  page,
}, testInfo) => {
  await conLAuto(page);
  await apriLaCasa(page, testInfo);

  expect(await guardaAdesso(page, 1_000_000)).toBe(true);
  const detti = await page.evaluate(() => window.__fotoRicevute);
  expect(detti.length, "l'app deve aver ricevuto una fotografia").toBeGreaterThan(0);
  const foto = JSON.parse(detti.at(-1));

  /* Il nome della casa non lo mette la plancia: la plancia sa di essere una
   * plancia, non sa di quale delle case dell'app è. */
  expect(foto.casa).toBe("");
  expect(foto.quando).toBe(1_000_000);

  /* I numeri sono già scritti, non grezzi: sono le stesse righe che la
   * finestra dell'Energia mostra in casa. */
  expect(foto.fotovoltaico.length).toBeGreaterThan(0);
  expect(foto.fotovoltaico.length).toBeLessThanOrEqual(3);
  for (const misura of foto.fotovoltaico) {
    expect(misura.nome, "una misura senza nome non si legge").toBeTruthy();
    expect(misura.valore).toMatch(/\d/);
    expect(misura.valore, "il numero deve essere scritto, non grezzo").toMatch(/W|kW|%/);
  }

  /* Chi è nascosto in Home resta nascosto anche in auto. */
  expect(foto.persone).toEqual([
    { nome: "Giovanni", inCasa: true },
    { nome: "Ada", inCasa: false },
  ]);

  /* E i tasti, col posto e il nome nell'id: fra la fotografia e il tasto
   * premuto qualcuno può aver riordinato l'elenco. */
  expect(foto.azioni).toEqual([
    { id: "0|Buonanotte", nome: "Buonanotte", segno: "🌙" },
    { id: "1|Cancello", nome: "Cancello", segno: "🚧" },
  ]);
});

test("se non cambia niente non si rimanda, e se cambia sì", async ({ page }, testInfo) => {
  await conLAuto(page);
  await apriLaCasa(page, testInfo);

  await guardaAdesso(page, 1_000_000);
  const quante = async () => (await page.evaluate(() => window.__fotoRicevute)).length;
  const dopoLaPrima = await quante();

  /* Un minuto dopo, con la casa ferma: niente. Ogni messaggio qui diventa una
   * scrittura su disco sul telefono, e riscriverlo per ridire la stessa cosa
   * vorrebbe dire scrivere tutto il giorno per niente. */
  expect(await guardaAdesso(page, 1_060_000)).toBe(false);
  expect(await quante()).toBe(dopoLaPrima);

  /* Qualcuno è tornato a casa: si rimanda. */
  await page.evaluate(() => {
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) raw["person.ada"] = { entity_id: "person.ada", state: "home", attributes: {} };
  });
  expect(await guardaAdesso(page, 1_120_000)).toBe(true);
  const ultima = await page.evaluate(() => JSON.parse(window.__fotoRicevute.at(-1)));
  expect(ultima.persone).toEqual([
    { nome: "Giovanni", inCasa: true },
    { nome: "Ada", inCasa: true },
  ]);
});

test("fuori dall'app non si prepara niente", async ({ page }, testInfo) => {
  /* Nessun canale: nel browser e dentro Home Assistant la sezione non legge le
   * tessere, non conta le persone e non accende nessun timer. */
  await apriLaCasa(page, testInfo);
  expect(await page.evaluate(() => window.gdahomeAuto ?? null)).toBeNull();
  /* Nemmeno la porta con cui si chiede una fotografia: senza canale la sezione
     non si installa affatto. */
  expect(await page.evaluate(() => window.gdahomeFotoInAuto ?? null)).toBeNull();
  expect(await guardaAdesso(page, 1_000_000)).toBe(false);
});
