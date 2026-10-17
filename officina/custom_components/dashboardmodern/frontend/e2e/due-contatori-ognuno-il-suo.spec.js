import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Due contatori, ognuno il suo.
 *
 * «Come sai ho la casa divisa in due impianti, questo è quello della zona
 * giorno e mi ha messo in automatico anche il bagno dove c'è la lavatrice e
 * l'esterno, ma non sono configurati.» — «Poi le soglie ho visto che sono in
 * comune, anche queste andrebbero divise, io ho due contatori.»
 *
 * Tre cose, viste dal vivo:
 *  · la lavatrice della zona notte non fa più il cerchio «Bagno» nella zona
 *    giorno, e la pompa che nessuno ha assegnato non fa «Esterno» da nessuna
 *    parte — il config lo chiede;
 *  · due contatori sotto la loro soglia non fanno un sovraccarico, e quando uno
 *    la passa l'avviso dice quale;
 *  · con un impianto solo tutto resta com'era.
 */
const STANZE = [
  { id: "soggiorno", name: "Soggiorno", floor: "Piano terra" },
  { id: "cucina", name: "Cucina", floor: "Piano terra" },
  { id: "bagno", name: "Bagno", floor: "Primo piano" },
  { id: "esterno", name: "Esterno" },
];

const APPARECCHI = [
  {
    id: "app-forno",
    name: "Forno",
    room_id: "cucina",
    power_entity: "sensor.forno_w",
    plant: "impianto",
  },
  {
    id: "app-tv",
    name: "TV",
    room_id: "soggiorno",
    power_entity: "sensor.tv_w",
    plant: "impianto",
  },
  { id: "app-lava", name: "Lavatrice", room_id: "bagno", power_entity: "sensor.lava_w" },
  { id: "app-pompa", name: "Pompa", room_id: "esterno", power_entity: "sensor.pompa_w" },
];

const seme = ({ dueImpianti = true } = {}) => ({
  schema_version: 4,
  sections: {
    rooms: STANZE,
    cameras: [],
    appliances: dueImpianti ? APPARECCHI : APPARECCHI.map(({ plant: _via, ...resto }) => resto),
    loads: dueImpianti
      ? [
          {
            id: "lavatrice",
            name: "Lavatrice",
            icon: "🌀",
            power_entity: "sensor.lava_w",
            order: 0,
            plant: "impianto-2",
          },
        ]
      : [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {
      name: "Zona Giorno",
      grid: { power: "sensor.rete_w" },
      house: { power: "sensor.casa_w" },
      ...(dueImpianti
        ? {
            plants: [
              {
                id: "impianto-2",
                name: "Zona Notte",
                grid: { power: "sensor.rete2_w" },
                house: { power: "sensor.casa2_w" },
              },
            ],
            metadata: { plant_seq: 2 },
          }
        : {}),
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
});

const LETTURE = {
  "sensor.forno_w": "1700",
  "sensor.tv_w": "60",
  "sensor.lava_w": "1610",
  "sensor.pompa_w": "0",
  "sensor.rete_w": "1970",
  "sensor.casa_w": "1970",
  "sensor.rete2_w": "1800",
  "sensor.casa2_w": "1800",
};

async function avvia(page, testInfo, opzioni) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme(opzioni));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await leggi(page, LETTURE);
}

async function leggi(page, letture) {
  await page.evaluate((valori) => {
    const raw = eval("_RAW_STATES");
    for (const [id, valore] of Object.entries(valori))
      raw[id] = { entity_id: id, state: valore, attributes: { unit_of_measurement: "W" } };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  }, letture);
}

const cerchi = (page) =>
  page.evaluate(() =>
    [
      ...new Set(
        [...document.querySelectorAll("#page-energy [data-dm-flow-node]")]
          .map((nodo) => (nodo.querySelector(".node-label")?.textContent || "").trim())
          .filter(Boolean),
      ),
    ].sort(),
  );

async function apriEnergia(page) {
  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((b) => b.click());
  await page.waitForTimeout(1200);
}

test("la lavatrice della zona notte non fa il «Bagno» della zona giorno", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await avvia(page, testInfo);
  await apriEnergia(page);

  /* Zona Giorno: le sue stanze. Né Bagno (la lavatrice è dell'altro
   * contatore: stessa potenza del suo carico) né Esterno (la pompa non ha un
   * impianto, e non lo si indovina). */
  await expect.poll(() => cerchi(page)).toEqual(["Cucina", "Soggiorno"]);

  await page
    .locator('#page-energy [data-dm-impianto="impianto-2"]')
    .evaluate((pillola) => pillola.click());
  /* Zona Notte: la lavatrice una volta sola, nel suo Bagno. */
  await expect.poll(() => cerchi(page)).toEqual(["Bagno"]);
});

test("due contatori sotto la loro soglia non fanno un sovraccarico, e uno sopra dice quale", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await avvia(page, testInfo);
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_energia_soglia",
      JSON.stringify({
        sorgente: "casa",
        ambra: 2000,
        rossa: 3000,
        perImpianto: { "impianto-2": { sorgente: "casa", ambra: 1500, rossa: 2500 } },
      }),
    );
  });
  await leggi(page, { "sensor.casa_w": "1970", "sensor.casa2_w": "1400" });
  await apriEnergia(page);
  /* 1,97 + 1,40 = 3,37 kW: la somma passerebbe i 3 kW, nessuno dei due la sua. */
  await page.waitForTimeout(800);
  await expect(page.locator("#dm-soglia-striscia")).toHaveCount(0);

  await leggi(page, { "sensor.casa2_w": "2600" });
  const striscia = page.locator("#dm-soglia-striscia");
  await expect(striscia).toHaveCount(1);
  await expect(striscia).toContainText("Zona Notte");
  await expect(striscia).toHaveAttribute("data-livello", "rossa");
});

test("il config dice chi non ha un impianto, e lo si assegna", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await avvia(page, testInfo);
  await page.evaluate(() => window.apriConfigEntita?.());
  await page.waitForSelector("#editor-modal", { timeout: 20_000 });
  await page.evaluate(() => window.editorSwitch?.("energy"));
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const linguetta = document.querySelector(
      '[data-energy-tab="loads"],[data-energy-panel-tab="loads"]',
    );
    linguetta?.click();
    const pannello = document.querySelector('[data-energy-panel="loads"]');
    if (pannello) pannello.hidden = false;
    window.dispatchEvent(new CustomEvent("dashboardmodern:editor-rendered"));
  });
  const box = page.locator("[data-dm-impianti-box]");
  await expect(box).toHaveCount(1, { timeout: 20_000 });
  await expect(box).toContainText("senza impianto");
  /* La lavatrice è suggerita (stessa potenza di un carico di Zona Notte): la
   * si conferma; la pompa no, e resta da assegnare. */
  await box.locator("[data-dm-imp-conferma]").evaluate((tasto) => tasto.click());
  await expect
    .poll(() =>
      page.evaluate(() => {
        const voci = window.DashboardModernModules?.store?.getSection?.("appliances") || [];
        return voci.find((voce) => voce.id === "app-lava")?.plant || "";
      }),
    )
    .toBe("impianto-2");
});

test("con un impianto solo i cerchi delle stanze restano quelli di sempre", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await avvia(page, testInfo, { dueImpianti: false });
  await apriEnergia(page);
  await expect.poll(() => cerchi(page)).toEqual(["Bagno", "Cucina", "Esterno", "Soggiorno"]);
});
