/* La linguetta «Bollette» in Energia (#295): «una nuova scheda che riporta i
 * dati reali delle bollette arrivate». I sensori sono quelli di EON Energia
 * Italia della segnalazione; la plancia li trova da sola dai nomi. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [{ entity: "light.salotto", name: "Salotto" }],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

const eur = { unit_of_measurement: "€" };
const STATI = {
  "sensor.eon_latest_invoice": {
    state: "52.0",
    attributes: { ...eur, friendly_name: "Latest Invoice" },
  },
  "sensor.eon_total_invoiced": {
    state: "316.0",
    attributes: { ...eur, friendly_name: "Total Invoiced" },
  },
  "sensor.eon_unpaid_invoices": {
    state: "52.0",
    attributes: { ...eur, friendly_name: "Unpaid Invoices" },
  },
  "sensor.eon_invoice_payment_status": {
    state: "unpaid",
    attributes: { friendly_name: "Invoice Payment Status" },
  },
  "sensor.eon_potenza_impegnata": {
    state: "6.0",
    attributes: { unit_of_measurement: "kW", friendly_name: "Potenza impegnata" },
  },
  "sensor.eon_scadenza_offerta": {
    state: "2028-03-31",
    attributes: { friendly_name: "Scadenza offerta" },
  },
  "sensor.eon_daily_consumption": {
    state: "22.79",
    attributes: { unit_of_measurement: "kWh", friendly_name: "Daily Consumption" },
  },
  "light.salotto": { state: "on", attributes: {} },
};

for (const tema of ["light", "dark"])
  test(`la linguetta Bollette con i dati di E.ON (${tema})`, async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
    await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
    await page.waitForFunction(
      () => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true,
      null,
      {
        timeout: 60000,
      },
    );
    await page.evaluate(
      ({ stati, tema }) => {
        document.documentElement.setAttribute("data-theme", tema);
        const grezzi = eval("_RAW_STATES");
        for (const [id, stato] of Object.entries(stati)) grezzi[id] = { entity_id: id, ...stato };
        window.applyStates?.();
        window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      },
      { stati: STATI, tema },
    );
    await page.locator('.tab[data-tab="energy"]').click();
    const linguetta = page.locator('#page-energy [data-dm-energia-vista="bollette"]');
    await expect(linguetta).toBeVisible();
    await linguetta.click();
    const vista = page.locator("#view-bollette");
    await expect(vista).toHaveClass(/active/);
    await expect(vista.locator(".dm-bol-cifra strong")).toHaveText(/52,00\s€/);
    await expect(vista.locator(".dm-bol-stato")).toHaveText("Non pagata");
    await expect(vista).toContainText("316,00 €");
    await expect(vista).toContainText("31 marzo 2028");
    await expect(vista).toContainText("6 kW");
    /* Niente di largo che esca dallo schermo. */
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    if (process.env.DM_FOTO)
      await vista.screenshot({
        path: `${process.env.DM_FOTO}/bollette-${tema}-${testInfo.project.name}.png`,
      });
  });

test("senza sensori di bolletta la linguetta non c'e'", async ({ page }, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.locator('.tab[data-tab="energy"]').click();
  await expect(page.locator('#page-energy [data-dm-energia-vista="bollette"]')).toBeHidden();
});
