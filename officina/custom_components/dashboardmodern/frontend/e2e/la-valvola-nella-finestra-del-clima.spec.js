/* La valvola nella finestra del Clima della Home.
 *
 * «Poi qui sarebbe carino avere le % di apertura valvola.» Ogni riga della
 * finestra dice quanto e' aperta la valvola dell'unita', con la stessa
 * lettura della card del Clima: la casella «Valvola» se c'e', se no gli
 * attributi del termostato. Senza valvola la riga non dice niente; con una
 * casella che adesso non risponde dice «—».
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const CLIMI = [
  {
    id: "cl0",
    name: "Soggiorno",
    entity: "climate.soggiorno",
    valvola: "sensor.valvola_soggiorno",
  },
  { id: "cl1", name: "Cucina", entity: "climate.cucina" },
  { id: "cl2", name: "Studio", entity: "climate.studio" },
  { id: "cl3", name: "Bagnetto", entity: "climate.bagnetto", valvola: "sensor.valvola_bagnetto" },
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: CLIMI,
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, climate: true },
};

async function avvia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((climi) => {
    const grezzi = eval("_RAW_STATES");
    climi.forEach((unita, indice) => {
      grezzi[unita.entity] = {
        entity_id: unita.entity,
        state: "heat",
        attributes: {
          friendly_name: unita.name,
          current_temperature: 20 + indice,
          temperature: 21,
          hvac_modes: ["off", "heat"],
          hvac_action: indice === 0 ? "heating" : "idle",
          /* La Cucina la valvola la dice nel termostato stesso. */
          ...(unita.entity === "climate.cucina" ? { pi_heating_demand: 30 } : {}),
        },
      };
    });
    /* La casella «Valvola» del Soggiorno risponde, quella del Bagnetto no. */
    grezzi["sensor.valvola_soggiorno"] = {
      entity_id: "sensor.valvola_soggiorno",
      state: "64",
      attributes: { unit_of_measurement: "%" },
    };
    grezzi["sensor.valvola_bagnetto"] = {
      entity_id: "sensor.valvola_bagnetto",
      state: "unavailable",
      attributes: {},
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, CLIMI);
  await page.waitForTimeout(2000);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page
    .locator('#dm-widgets .dm-tile[data-dm-widget="clima"]')
    .evaluate((nodo) => nodo.click());
  await expect(page.locator("#dm-widget-popup .dm-w-row").first()).toBeVisible();
}

const riga = (page, entita) =>
  page.locator(`#dm-widget-popup .dm-w-row:has([data-dm-w-clima="${entita}"])`);

test("ogni riga dice quanto e' aperta la valvola, se ce l'ha", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  // La casella «Valvola» dell'unita'.
  await expect(riga(page, "climate.soggiorno").locator("[data-dm-w-valvola]")).toHaveText(
    /valvola 64%/,
  );
  // L'attributo del termostato, quando la casella non c'e'.
  await expect(riga(page, "climate.cucina").locator("[data-dm-w-valvola]")).toHaveText(
    /valvola 30%/,
  );
  // Niente valvola: niente.
  await expect(riga(page, "climate.studio").locator("[data-dm-w-valvola]")).toHaveCount(0);
  // La casella c'e' ma non risponde: «—».
  await expect(riga(page, "climate.bagnetto").locator("[data-dm-w-valvola]")).toHaveText(
    /valvola —/,
  );
});

test("la valvola si aggiorna mentre la finestra e' aperta", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await page.evaluate(() => {
    const grezzi = eval("_RAW_STATES");
    grezzi["sensor.valvola_soggiorno"] = {
      entity_id: "sensor.valvola_soggiorno",
      state: "12",
      attributes: { unit_of_measurement: "%" },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await expect(riga(page, "climate.soggiorno").locator("[data-dm-w-valvola]")).toHaveText(
    /valvola 12%/,
    { timeout: 15_000 },
  );
});
