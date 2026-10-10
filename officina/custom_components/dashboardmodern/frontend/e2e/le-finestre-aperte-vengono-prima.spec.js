/* «Mi mostri come prima entità quella aperta.»
 *
 * Nella finestra delle Finestre, aperta toccando la tessera in Home, l'elenco
 * delle letture mette in cima quelle aperte; e il conto «aperte» delle misure
 * dice lo stesso numero della frase in cima, finestre col solo sensore
 * comprese. */
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
  await expect(page.getByText("Aperta", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  /* Le righe si leggono in quest'ordine: prima l'aperta, poi le altre. */
  await expect(page.locator("body")).toContainText(
    /Camera da letto[\s\S]{0,200}?Aperta[\s\S]{0,200}?Cucina[\s\S]{0,200}?Chiusa[\s\S]{0,200}?Cucinino/,
  );
  /* Le misure contano l'aperta come la frase in cima. */
  await expect(page.getByText("1/3", { exact: true }).last()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("finestre-aperte-prima.png") });
});
