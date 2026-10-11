/* «Mi mostri come prima entità quella aperta.»
 *
 * Nella finestra delle Finestre, aperta toccando la tessera in Home, l'elenco
 * delle letture mette in cima quelle aperte; e il numero in cima conta le
 * finestre aperte, quelle col solo sensore comprese. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const INFISSI = [
  { name: "Cucina", contact: "binary_sensor.finestra_cucina" },
  { name: "Cucinino", contact: "binary_sensor.finestra_cucinino" },
  { name: "Camera da letto", contact: "binary_sensor.finestra_camera" },
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: INFISSI,
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, tapparelle: true },
};

const finestra = (id, aperta) => ({
  entity_id: id,
  state: aperta ? "on" : "off",
  attributes: { device_class: "window" },
});

const STATI = {
  "binary_sensor.finestra_cucina": finestra("binary_sensor.finestra_cucina", false),
  "binary_sensor.finestra_cucinino": finestra("binary_sensor.finestra_cucinino", false),
  "binary_sensor.finestra_camera": finestra("binary_sensor.finestra_camera", true),
};

test("nella finestra delle Finestre l'aperta sta in cima", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(
    ({ s, righe }) => {
      window.localStorage.setItem("cd_tapparelle", JSON.stringify(righe));
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...s } };
      const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
      if (raw) Object.assign(raw, s);
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      window.renderHomeWidgets?.();
    },
    { s: STATI, righe: INFISSI },
  );

  const tessera = page.locator('.dm-tile[data-dm-widget="tapparelle"]').first();
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  await tessera.click();
  /* La finestra e' quella disegnata per le Finestre (`finestre/comandi.js`):
   * una scheda per stanza, e l'anta dice «Finestra aperta». */
  const finestra = page.locator('#dm-widget-popup [data-dm-widget-detail="tapparelle"]');
  await expect(finestra.getByText("Finestra aperta").first()).toBeVisible({ timeout: 15_000 });
  /* Le stanze si leggono in quest'ordine: prima l'aperta, poi le altre. */
  await expect(finestra).toContainText(
    /Camera da letto[\s\S]{0,200}?Finestra aperta[\s\S]{0,200}?Cucina[\s\S]{0,200}?Finestra chiusa[\s\S]{0,200}?Cucinino/,
  );
  /* Il numero in cima conta l'aperta, e la nomina: al posto del vecchio «1/3»
   * delle misure c'e' «Finestre aperte 1 · Camera da letto». */
  const eroe = finestra.locator(".dm-f-tapparelle-eroe").first();
  await expect(eroe).toContainText("Finestre aperte");
  await expect(eroe.locator(".dm-f-num")).toHaveText("1");
  await expect(eroe).toContainText("Camera da letto");
  await page.screenshot({ path: testInfo.outputPath("finestre-aperte-prima.png") });
});
