/* «Con l'ultimo aggiornamento mi da' ancora il clima acceso. Ma il clima e'
 * spento.» Il termostato Netatmo era in «auto», in antigelo a 12 gradi con 23
 * in casa, `hvac_action: idle`: la pastiglia diceva «1 unita' accesa» e il
 * tasto «Spegni» faceva rispondere a Netatmo un errore. Un termostato fermo
 * non e' acceso: niente pastiglia, e nella tessera Clima e' «In pausa». */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const UNITA = [{ id: "c1", name: "Casa", entity: "climate.casa", type: "termo" }];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [{ id: "l1", name: "Cucina", entity: "light.cucina" }],
    climate: UNITA,
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, clima: true },
};

const NETATMO = {
  hvac_modes: ["auto", "heat"],
  min_temp: 7,
  max_temp: 30,
  target_temp_step: 0.5,
  preset_modes: ["away", "boost", "frost_guard", "schedule"],
  current_temperature: 23.1,
  temperature: 12,
  preset_mode: "frost_guard",
  supported_features: 401,
  friendly_name: "Casa",
};

async function avvia(page, testInfo, azione) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    ({ unita, attributi, azione: fa }) => {
      window.localStorage.setItem("cd_clima_units", JSON.stringify(unita));
      const stati = eval("_RAW_STATES");
      stati["light.cucina"] = {
        entity_id: "light.cucina",
        state: "on",
        attributes: { friendly_name: "Cucina" },
      };
      stati["climate.casa"] = {
        entity_id: "climate.casa",
        state: "auto",
        attributes: { ...attributi, hvac_action: fa },
      };
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { unita: UNITA, attributi: NETATMO, azione },
  );
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await expect(page.locator('#dm-casa-riga [data-dm-casa="luci"]')).toBeVisible();
}

const foto = async (page, nome, testInfo) => {
  if (process.env.DM_FOTO)
    await page.screenshot({
      path: `${process.env.DM_FOTO}/termostato-${nome}-${testInfo.project.name}.png`,
    });
};

test("fermo in auto: niente «unità accesa», e nella tessera è «In pausa»", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo, "idle");
  await page.waitForTimeout(600);
  await expect(page.locator('#dm-casa-riga [data-dm-casa="clima"]')).toHaveCount(0);
  await foto(page, "home", testInfo);
  await page.evaluate(() => window.dmOpenWidget?.("clima"));
  const tessera = page.locator('[data-dm-widget="clima"]').first();
  if (await tessera.count()) await tessera.click();
  const finestra = page.locator("#dm-widget-popup");
  await expect(finestra).toBeVisible();
  await expect(finestra).toContainText("0 accese su 1");
  await expect(finestra).toContainText("In pausa");
  await foto(page, "tessera", testInfo);
});

test("quando scalda, la pastiglia c'è", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo, "heating");
  await expect(page.locator('#dm-casa-riga [data-dm-casa="clima"]')).toBeVisible();
});
