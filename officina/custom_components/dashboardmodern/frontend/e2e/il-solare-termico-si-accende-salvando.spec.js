/* «Sezione termica: ho inserito entità sul solare termico ma la sezione non
 * è diventata automaticamente visibile.»
 *
 * La sezione è nascosta (com'è dopo un azzeramento). Si sceglie una sonda del
 * solare termico e si preme «Salva sezione»: la sezione si accende. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seme = {
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
  visibility: { home: true },
};

test("una sonda del solare termico salvata accende la sezione", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => {
    const sezioni = JSON.parse(localStorage.getItem("cd_sections") || "{}");
    sezioni.boiler = false;
    localStorage.setItem("cd_sections", JSON.stringify(sezioni));
    window.apriConfigEntita();
  });
  const sonda = page.locator('#ed-body .ed-slot-in[data-ref="dm.boiler_sonda_temperatura_1"]');
  await page.evaluate(() => {
    const scheda = [...document.querySelectorAll("#editor-modal .ed-tab")].find((tab) =>
      document.querySelector('.ed-slot-in[data-ref="dm.boiler_sonda_temperatura_1"]')
        ? false
        : /termic|solare/i.test(tab.textContent || ""),
    );
    scheda?.click();
  });
  await expect(sonda).toHaveCount(1, { timeout: 20_000 });
  await sonda.evaluate((campo) => {
    campo.value = "sensor.pannello_solare";
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#ed-body [data-dm-save-all]").click();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("cd_sections") || "{}").boiler))
    .not.toBe(false);
});
