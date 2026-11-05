/* I cerchi del Flusso energetico si spostano dentro il disegno (#379).
 *
 * «Vedi come poter spostare le cose anche nei disegni, tipo i cerchi nel
 * Flusso energetico.» Con ✏️ sulla pagina Energia ogni cerchio ha la sua
 * maniglia: Solare, Rete, Batteria, Casa e ogni carico. Le linee che toccano
 * un cerchio spostato si ridisegnano curve, dal bordo al bordo, e la corrente
 * continua a correrci dentro. Salva scrive `cd_disegni` («energia:computer» o
 * «energia:telefono»), la stessa disposizione per Istantaneo, Giorno e Mese.
 * Senza scelta il disegno e' quello di sempre.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

test.use({ timezoneId: "Europe/Rome", locale: "it-IT" });

const CARICHI = [
  { id: "frigo", name: "Frigo", icon: "🧊", power_entity: "sensor.frigo_w", order: 0 },
  { id: "clima", name: "Clima", icon: "❄️", power_entity: "sensor.clima_w", order: 1 },
  { id: "lavatrice", name: "Lavatrice", icon: "🧺", power_entity: "sensor.lava_w", order: 2 },
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: CARICHI,
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {
      solar: { power: "sensor.sole_w" },
      grid: { power: "sensor.rete_w" },
      house: { power: "sensor.casa_w" },
      battery: { power: "sensor.batt_w", soc: "sensor.batt_soc" },
    },
    entityOverrides: {
      "dm.energy_potenza_fotovoltaico": "sensor.sole_w",
      "dm.energy_potenza_scambio_rete": "sensor.rete_w",
      "dm.energy_potenza_batteria": "sensor.batt_w",
      "dm.energy_potenza_consumo_casa": "sensor.casa_w",
      "dm.energy_stato_carica_batteria": "sensor.batt_soc",
    },
  },
  visibility: { home: true, energy: true },
};

const LETTURE = {
  "sensor.sole_w": ["3200", "W"],
  "sensor.rete_w": ["-400", "W"],
  "sensor.batt_w": ["-900", "W"],
  "sensor.casa_w": ["1900", "W"],
  "sensor.batt_soc": ["64", "%"],
  "sensor.frigo_w": ["90", "W"],
  "sensor.clima_w": ["750", "W"],
  "sensor.lava_w": ["420", "W"],
};

async function apri(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.evaluate((valori) => {
    const raw = eval("_RAW_STATES");
    for (const [id, [v, u]] of Object.entries(valori))
      raw[id] = { entity_id: id, state: v, attributes: { unit_of_measurement: u } };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, LETTURE);
  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((b) => b.click());
  await expect(page.locator('#view-ist [data-dm-flow-node="frigo"]')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator("#view-ist #n-battery")).toBeVisible();
}

const linea = (page, id) => page.locator(`#${id}`).getAttribute("d");
const salvata = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("cd_disegni") || "{}"));
/* Il centro di un cerchio in percento del suo palco. */
const centro = (page, sel) =>
  page.locator(sel).evaluate((n) => {
    const palco = n.closest(".flow-stage").getBoundingClientRect();
    const r = n.getBoundingClientRect();
    return {
      x: ((r.left + r.width / 2 - palco.left) / palco.width) * 100,
      y: ((r.top + r.height / 2 - palco.top) / palco.height) * 100,
    };
  });

async function entra(page) {
  await page.evaluate(() => window.dmDisposizione.entraInModifica());
  await expect(page.locator("html")).toHaveAttribute("data-dm-modifica", "energy");
  await expect(page.locator("[data-dm-disegno-strato='energia']")).toBeAttached();
}

async function trascina(page, nodo, dx, dy, { durante } = {}) {
  const maniglia = page.locator(`[data-dm-disegno-nodo="${nodo}"]`);
  await maniglia.scrollIntoViewIfNeeded();
  await expect(maniglia).toBeVisible();
  const box = await maniglia.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i += 1) await page.mouse.move(x + (dx * i) / 10, y + (dy * i) / 10);
  if (durante) await durante();
  await page.mouse.up();
}

test("senza scelta il disegno e' quello di sempre, e niente lo ridisegna", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "il computer");
  await apri(page, testInfo);
  await expect(page.locator("#dm-flusso-posizioni")).toHaveCount(0);
  await expect(page.locator("#page-energy [data-dm-d-di-serie]")).toHaveCount(0);
  await expect(page.locator("#page-energy [data-dm-flow-nuovo]")).toHaveCount(0);
});

test("sul computer la batteria si trascina, le sue linee la seguono, Salva la tiene in tutte le viste", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "il computer");
  await apri(page, testInfo);
  const prima = await linea(page, "line-solar-battery");
  const casaPrima = await linea(page, "line-solar-home");
  await entra(page);
  await expect(page.locator("[data-dm-disegno-strato]").first()).toHaveAttribute(
    "data-dm-variante",
    "computer",
  );
  /* Ogni cerchio ha la sua maniglia: i quattro e i carichi. */
  for (const nodo of ["solare", "rete", "batteria", "casa", "carico:frigo", "carico:clima"])
    await expect(page.locator(`[data-dm-disegno-nodo="${nodo}"]`)).toHaveCount(1);
  await trascina(page, "batteria", 140, 110, {
    /* Mentre la si porta, la linea dal Solare la segue gia'. */
    durante: async () => expect.poll(() => linea(page, "line-solar-battery")).not.toBe(prima),
  });
  const spostata = await linea(page, "line-solar-battery");
  expect(spostata).toMatch(/^M [\d.-]+ [\d.-]+ C /);
  /* La linea Solare → Casa non tocca la batteria: resta quella di serie. */
  expect(await linea(page, "line-solar-home")).toBe(casaPrima);
  await expect(page.locator(".dm-disp-conta")).toContainText("1 modifica");
  await page.locator('[data-dm-disp-azione="salva"]').click();
  await expect(page.locator("html")).not.toHaveAttribute("data-dm-modifica", /./);
  const scritta = await salvata(page);
  expect(Object.keys(scritta)).toEqual(["energia:computer"]);
  const posto = scritta["energia:computer"].batteria;
  expect(posto.x).toBeGreaterThan(80);
  /* Il cerchio sta dove l'ha lasciato la mano, e la corrente continua. */
  const qui = await centro(page, "#view-ist #n-battery");
  expect(Math.abs(qui.x - posto.x)).toBeLessThan(1);
  expect(Math.abs(qui.y - posto.y)).toBeLessThan(1);
  expect(await linea(page, "line-solar-battery")).toBe(spostata);
  /* La stessa disposizione vale per Giorno e Mese. */
  await page.locator("#page-energy").getByText("Giornaliera").first().click();
  await expect(page.locator("#view-day #n-battery-day")).toBeVisible();
  const giorno = await centro(page, "#view-day #n-battery-day");
  expect(Math.abs(giorno.x - posto.x)).toBeLessThan(1);
  expect(await linea(page, "line-solar-battery-day")).not.toBe(prima);
});

test("un carico si trascina e la sua linea da Casa lo segue; Annulla rimette tutto", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "il computer");
  await apri(page, testInfo);
  const frigo = '#view-ist [data-dm-flow-node="frigo"]';
  const daDove = await centro(page, frigo);
  await entra(page);
  await trascina(page, "carico:frigo", 120, -90);
  await expect.poll(async () => (await centro(page, frigo)).y).toBeLessThan(daDove.y - 5);
  await expect(page.locator(".dm-disp-conta")).toContainText("1 modifica");
  await page.locator('[data-dm-disp-azione="annulla"]').click();
  await expect(page.locator("html")).not.toHaveAttribute("data-dm-modifica", /./);
  await expect.poll(async () => Math.abs((await centro(page, frigo)).y - daDove.y)).toBeLessThan(1);
  expect(await salvata(page)).toEqual({});

  /* E con Salva resta. */
  await entra(page);
  await trascina(page, "carico:frigo", 120, -90);
  await page.locator('[data-dm-disp-azione="salva"]').click();
  const scritta = await salvata(page);
  expect(Object.keys(scritta["energia:computer"])).toEqual(["carico:frigo"]);
  await expect.poll(async () => (await centro(page, frigo)).y).toBeLessThan(daDove.y - 5);
});

test("Ripristina rimette i cerchi e le linee di serie, lettera per lettera", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "il computer");
  await apri(page, testInfo);
  const diSerie = await linea(page, "line-solar-battery");
  const reteDiSerie = await linea(page, "line-solar-grid");
  /* Una scelta che arriva da un altro dispositivo. */
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_disegni",
      JSON.stringify({
        "energia:computer": { batteria: { x: 85, y: 52.5 }, rete: { x: 15, y: 50 } },
      }),
    );
    window.dispatchEvent(new CustomEvent("dashboardmodern:config-synced"));
  });
  await expect(page.locator("#dm-flusso-posizioni")).toHaveCount(1);
  await expect.poll(() => linea(page, "line-solar-battery")).not.toBe(diSerie);
  await expect.poll(() => linea(page, "line-solar-grid")).not.toBe(reteDiSerie);
  await expect
    .poll(async () => Math.round((await centro(page, "#view-ist #n-battery")).x))
    .toBe(85);

  await entra(page);
  await page.locator('[data-dm-disp-azione="ripristina"]').click();
  await expect.poll(() => linea(page, "line-solar-battery")).toBe(diSerie);
  expect(await linea(page, "line-solar-grid")).toBe(reteDiSerie);
  await page.locator('[data-dm-disp-azione="salva"]').click();
  expect(await salvata(page)).toEqual({});
  await expect(page.locator("#dm-flusso-posizioni")).toHaveCount(0);
  await expect(page.locator("#page-energy [data-dm-d-di-serie]")).toHaveCount(0);
});

test("sul telefono la scelta e' del telefono: il computer resta com'era", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "il telefono");
  await apri(page, testInfo);
  const prima = await linea(page, "m-line-solar-battery");
  await page.evaluate(() => document.querySelector("section.page.active")?.scrollIntoView());
  await entra(page);
  await expect(page.locator("[data-dm-disegno-strato]").first()).toHaveAttribute(
    "data-dm-variante",
    "telefono",
  );
  await trascina(page, "batteria", -10, 150);
  await expect.poll(() => linea(page, "m-line-solar-battery")).not.toBe(prima);
  await page.locator('[data-dm-disp-azione="salva"]').click();
  const scritta = await salvata(page);
  expect(Object.keys(scritta)).toEqual(["energia:telefono"]);
  expect(scritta["energia:telefono"].batteria).toBeTruthy();
});
