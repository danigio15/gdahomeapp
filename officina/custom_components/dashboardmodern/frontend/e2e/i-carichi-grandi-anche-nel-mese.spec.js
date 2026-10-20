import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

/* I numeri dei carichi, grandi uguali nell'istantanea, nel giorno e nel mese.
 *
 * Dal campo: «i valori dei carichi sotto casa si leggono per la parte
 * istantanea, ma sono piu' piccoli per giornaliera e mensile». Nel foglio la
 * misura grande c'era solo per l'istantanea; nel giorno e nel mese restava
 * quella vecchia, 13 punti (9,5 sul telefono).
 */
const seed = {
  schema_version: 4,
  sections: {
    rooms: [],
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
  visibility: { home: true, energy: true },
};

const CARICHI = [
  ["wallbox", "Wallbox", 0, 0, 206.6],
  ["cucina", "Cucina", 79, 0.4, 23.9],
  ["cucinino", "Cucinino", 7, 1.1, 15.6],
];

test("i numeri dei carichi: nel giorno e nel mese grandi come nell'istantanea", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.evaluate(async (carichi) => {
    const metti = (entity_id, state, unit) => {
      const voce = { entity_id, state: String(state), attributes: { unit_of_measurement: unit } };
      _RAW_STATES[entity_id] = structuredClone(voce);
      STATES[entity_id] = structuredClone(voce);
    };
    for (const [id, , w, giorno, mese] of carichi) {
      metti(`sensor.${id}_w`, w, "W");
      metti(`sensor.${id}_giorno`, giorno, "kWh");
      metti(`sensor.${id}_mese`, mese, "kWh");
    }
    await DashboardModernModules.store.replaceSection(
      "loads",
      carichi.map(([id, nome], order) => ({
        id: `flow-${id}`,
        name: nome,
        order,
        show_in_dashboard: true,
        power_entity: `sensor.${id}_w`,
        daily_energy_entity: `sensor.${id}_giorno`,
        monthly_energy_entity: `sensor.${id}_mese`,
      })),
    );
    dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
    await new Promise((resolve) => setTimeout(resolve, 260));
    window.dmRefreshEnergyFlows?.();
  }, CARICHI);
  await clickBottomTab(page, "energy", testInfo);

  const misura = async (vista) => {
    await page
      .locator(`#page-energy button.sub-tab-btn[onclick*="'${vista.replace("view-", "")}'"]`)
      .first()
      .click();
    const valore = page.locator(`#${vista} [data-dm-flow-node="flow-wallbox"] .dm-flow-value`);
    await expect(valore).toBeVisible();
    if (process.env.DM_RENDER_DIR)
      await page.locator(`#${vista}`).screenshot({
        path: `${process.env.DM_RENDER_DIR}/carichi-${vista}-${testInfo.project.name}.png`,
      });
    return valore.evaluate((nodo) => Number.parseFloat(getComputedStyle(nodo).fontSize));
  };
  const istantanea = await misura("view-ist");
  const giorno = await misura("view-day");
  const mese = await misura("view-month");
  expect(istantanea).toBeGreaterThanOrEqual(18);
  expect(giorno).toBe(istantanea);
  /* «206,6 kWh» e' lungo: puo' stringersi per stare nel cerchio, ma poco. */
  expect(mese).toBeGreaterThanOrEqual(istantanea * 0.62);
  expect(mese).toBeGreaterThan(13);
});
