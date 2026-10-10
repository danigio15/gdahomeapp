/* «Nella sezione carichi, se sono impostati gli elettrodomestici, in
 * automatico deve creare i flussi con le stanze: cerchio Cucina, e dietro
 * tutti gli elettrodomestici di Cucina; fuori la somma è il totale del
 * cerchio. L'unico che resta sempre fuori è la Wallbox.»
 *
 * Sul documento vero: sotto Casa la Wallbox, poi Cucina e Lavanderia coi loro
 * watt sommati, e «Altro» col Boiler che una stanza non ce l'ha. Toccando
 * Cucina la finestra elenca i suoi elettrodomestici. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "cucina", name: "Cucina" },
      { id: "lavanderia", name: "Lavanderia" },
    ],
    cameras: [],
    appliances: [
      { id: "forno", name: "Forno", power_entity: "sensor.forno_w", room_id: "cucina" },
      { id: "frigo", name: "Frigo", power_entity: "sensor.frigo_w", room_id: "cucina" },
      {
        id: "lavatrice",
        name: "Lavatrice",
        power_entity: "sensor.lavatrice_w",
        room_id: "lavanderia",
      },
    ],
    loads: [
      { id: "load-wallbox", name: "Wallbox", power_entity: "sensor.wallbox_w", order: 0 },
      { id: "boiler", name: "Boiler", power_entity: "sensor.boiler_w", order: 1 },
    ],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {
      grid: { power: "sensor.rete_w" },
      house: { power: "sensor.casa_w" },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

const LETTURE = {
  "sensor.forno_w": "1000",
  "sensor.frigo_w": "150",
  "sensor.lavatrice_w": "400",
  "sensor.wallbox_w": "1600",
  "sensor.boiler_w": "50",
  "sensor.rete_w": "3200",
  "sensor.casa_w": "3200",
};

test("sotto Casa la Wallbox e le stanze, ognuna col totale dei suoi elettrodomestici", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((letture) => {
    const raw = eval("_RAW_STATES");
    for (const [id, valore] of Object.entries(letture))
      raw[id] = { entity_id: id, state: valore, attributes: { unit_of_measurement: "W" } };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, LETTURE);
  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((b) => b.click());
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll("#view-ist [data-dm-flow-node]")].map((nodo) =>
          (nodo.querySelector(".node-label")?.textContent || "").trim(),
        ),
      ),
    )
    .toEqual(["Wallbox", "Cucina", "Lavanderia", "Altro"]);
  const valore = (nome) =>
    page.evaluate((cercato) => {
      const nodo = [...document.querySelectorAll("#view-ist [data-dm-flow-node]")].find(
        (n) => (n.querySelector(".node-label")?.textContent || "").trim() === cercato,
      );
      return (nodo?.textContent || "").replace(/\s+/g, " ").trim();
    }, nome);
  /* Fuori la somma: Forno 1000 + Frigo 150. */
  expect(await valore("Cucina")).toMatch(/1[.,]15 ?kW|1150 ?W/);
  expect(await valore("Lavanderia")).toMatch(/400 ?W/);
  expect(await valore("Altro")).toMatch(/50 ?W/);
  expect(await valore("Wallbox")).toMatch(/1[.,]60? ?kW|1600 ?W/);
  await page.screenshot({ path: testInfo.outputPath("flusso-per-stanza.png") });

  /* Dentro Cucina, i suoi elettrodomestici. */
  await page.locator("#view-ist [data-dm-flow-node]", { hasText: "Cucina" }).first().click();
  await expect(page.locator("#subloads-list [data-dm-subload-card]")).toHaveCount(2, {
    timeout: 10_000,
  });
  await expect(page.locator("#subloads-list")).toContainText("Forno");
  await expect(page.locator("#subloads-list")).toContainText("Frigo");
  await expect(page.locator("#subloads-title")).toContainText(/cucina/i);
});

test("in Giornaliera la stanza somma i kWh ricavati dalla potenza", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(
    () => Boolean(window.DashboardModernEnergyService?.broker?.request),
    null,
    {
      timeout: 30_000,
    },
  );
  await page.evaluate((letture) => {
    const raw = eval("_RAW_STATES");
    for (const [id, valore] of Object.entries(letture))
      raw[id] = { entity_id: id, state: valore, attributes: { unit_of_measurement: "W" } };
    /* Il Recorder di prova: per ogni potenza, le medie delle ore di oggi. */
    const medie = {
      "sensor.forno_w": [{ mean: 1000 }, { mean: 500 }],
      "sensor.frigo_w": [{ mean: 100 }, { mean: 100 }, { mean: 100 }],
      "sensor.lavatrice_w": [{ mean: 800 }],
    };
    const broker = window.DashboardModernEnergyService.broker;
    const prima = broker.request.bind(broker);
    window.__DOMANDE_DEI_KWH__ = [];
    broker.request = async (domanda, ...resto) => {
      if (
        domanda?.type === "recorder/statistics_during_period" &&
        domanda.types?.includes("mean")
      ) {
        window.__DOMANDE_DEI_KWH__.push(domanda);
        return Object.fromEntries(
          domanda.statistic_ids.filter((id) => medie[id]).map((id) => [id, medie[id]]),
        );
      }
      return prima(domanda, ...resto);
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, LETTURE);
  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((b) => b.click());
  await page
    .locator("#page-energy .sub-tab-btn", { hasText: /Giornaliera/i })
    .first()
    .click();
  const valore = (nome) =>
    page.evaluate((cercato) => {
      const nodo = [...document.querySelectorAll("#view-day [data-dm-flow-node]")].find(
        (n) => (n.querySelector(".node-label")?.textContent || "").trim() === cercato,
      );
      return (nodo?.textContent || "").replace(/\s+/g, " ").trim();
    }, nome);
  /* Forno 1,5 kWh + Frigo 0,3 kWh. */
  await expect.poll(() => valore("Cucina"), { timeout: 15_000 }).toMatch(/1[.,]8\d* ?kWh/);
  await expect.poll(() => valore("Lavanderia")).toMatch(/0[.,]8\d* ?kWh/);
  await page.screenshot({ path: testInfo.outputPath("flusso-giornaliero-per-stanza.png") });
});
