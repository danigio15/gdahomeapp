/* «Stamattina avevo l'indifferenziato, stasera devo uscire per domani mattina
 * organico e vetro: dopo una certa ora sparisca il rifiuto di oggi» (#333).
 *
 * La mattina la tessera in Home dice il ritiro di oggi; dalle 14 (l'ora si
 * sceglie nel Config) dice quello di domani, cioe' cosa mettere fuori stasera.
 */
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
  visibility: { home: true, rifiuti: true },
};

async function aCheOra(page, testInfo, ora) {
  test.setTimeout(150_000);
  await page.clock.setFixedTime(new Date(2026, 9, 28, ora, 0));
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => {
    const giorni = Array.from({ length: 14 }, () => []);
    giorni[0] = ["indifferenziato"];
    giorni[1] = ["organico", "vetro"];
    window.localStorage.setItem(
      "cd_rifiuti",
      JSON.stringify({ turno: { inizio: "2026-10-28", giorni } }),
    );
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.renderHomeWidgets?.();
  });
  const tessera = page.locator('.dm-tile[data-dm-widget="rifiuti"]').first();
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  return tessera;
}

test("la mattina la tessera dice il ritiro di oggi", async ({ page }, testInfo) => {
  const tessera = await aCheOra(page, testInfo, 10);
  await expect(tessera.locator("[data-dm-tile-caption]")).toContainText(/Indifferenziat/i);
  await tessera.screenshot({ path: testInfo.outputPath("rifiuti-mattina.png") });
});

test("la sera la tessera dice cosa mettere fuori per domani", async ({ page }, testInfo) => {
  const tessera = await aCheOra(page, testInfo, 19);
  const didascalia = tessera.locator("[data-dm-tile-caption]");
  await expect(didascalia).toContainText(/Organico/i);
  await expect(didascalia).not.toContainText(/Indifferenziat/i);
  await tessera.screenshot({ path: testInfo.outputPath("rifiuti-sera.png") });
  await tessera.click();
  const finestra = page.locator("#dm-widget-popup");
  await expect(finestra).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: testInfo.outputPath("rifiuti-sera-finestra.png") });
});

test("l'ora del cambio si sceglie nella scheda Rifiuti del Config", async ({ page }, testInfo) => {
  await aCheOra(page, testInfo, 19);
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="rifiuti"]').click();
  const campo = page.locator("#ed-body [data-dm-rifiuti-dopo-le]");
  await expect(campo).toHaveValue("14");
  await campo.evaluate((nodo) => nodo.closest("label")?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath("rifiuti-config.png") });
  await campo.fill("20");
  await page.locator("#ed-body [data-dm-rifiuti-save]").evaluate((tasto) => tasto.click());
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("cd_rifiuti") || "{}").dopoLe))
    .toBe(20);
});
