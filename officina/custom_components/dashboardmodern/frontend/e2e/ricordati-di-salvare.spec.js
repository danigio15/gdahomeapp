/* «Se ho inserito in una sezione una entità e cambio sezione, mi deve
 * ricordare di salvare.»
 *
 * Nel Config si scrive un'entità nella scheda UPS e si tocca un'altra
 * linguetta senza salvare: la plancia si ferma e chiede. «Resta qui» lascia
 * tutto com'è, «Esci senza salvare» porta via, «Salva e continua» salva e poi
 * porta via. Dopo un salvataggio, cambiare scheda non chiede più niente. */
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
  visibility: { home: true },
};

async function avvia(page, testInfo) {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => window.apriConfigEntita?.());
  await expect(page.locator('#editor-modal .ed-tab[data-tab="ups"]')).toHaveCount(1);
}

async function scriviNellUps(page) {
  await page.locator('#editor-modal .ed-tab[data-tab="ups"]').click();
  await expect(page.locator("#ed-body .dm-ups-ed")).toBeVisible();
  if (!(await page.locator("#ed-body input[data-dm-ups-field]").count())) {
    await page.locator("#ed-body [data-dm-ups-aggiungi]").click();
  }
  const campo = page
    .locator("#ed-body input[data-dm-ups-field]:not([data-dm-ups-field='name'])")
    .first();
  await expect(campo).toHaveCount(1);
  /* Il campo vero sta dietro al cercatore 🔍, che ci scrive l'entità e lo
   * annuncia: si fa lo stesso. */
  await campo.evaluate((nodo) => {
    nodo.value = "sensor.ups_batteria";
    nodo.dispatchEvent(new Event("input", { bubbles: true }));
    nodo.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const DIALOGO = "#dm-ricordati-di-salvare";

test("un'entità non salvata: cambiando scheda la plancia chiede", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await scriviNellUps(page);

  const luci = page.locator('#editor-modal .ed-tab[data-tab="luci"]');
  await luci.click();
  await expect(page.locator(DIALOGO)).toBeVisible();
  await expect(page.locator(`${DIALOGO} .dm-rds-scheda`)).toContainText("UPS");
  /* Il tocco è stato fermato: si è ancora nell'UPS. */
  await expect(page.locator("#editor-modal .ed-tab.active")).toHaveAttribute("data-tab", "ups");

  await page.locator(`${DIALOGO} [data-dm-rds="resta"]`).click();
  await expect(page.locator(DIALOGO)).toHaveCount(0);
  await expect(page.locator("#editor-modal .ed-tab.active")).toHaveAttribute("data-tab", "ups");

  await luci.click();
  await page.locator(`${DIALOGO} [data-dm-rds="esci"]`).click();
  await expect(page.locator(DIALOGO)).toHaveCount(0);
  await expect(page.locator("#editor-modal .ed-tab.active")).toHaveAttribute("data-tab", "luci");
  /* Uscito senza salvare: tornando alle altre schede non chiede più. */
  await page.locator('#editor-modal .ed-tab[data-tab="ups"]').click();
  await expect(page.locator(DIALOGO)).toHaveCount(0);
});

test("«Salva e continua» salva e porta dove si voleva", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await scriviNellUps(page);

  await page.locator('#editor-modal .ed-tab[data-tab="luci"]').click();
  await page.locator(`${DIALOGO} [data-dm-rds="salva"]`).click();
  await expect(page.locator(DIALOGO)).toHaveCount(0);
  await expect(page.locator("#editor-modal .ed-tab.active")).toHaveAttribute("data-tab", "luci");
  expect(await page.evaluate(() => localStorage.getItem("cd_ups") || "")).toContain(
    "sensor.ups_batteria",
  );
});

test("dopo «Salva sezione» cambiare scheda non chiede niente", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await scriviNellUps(page);
  await page.locator("#ed-body [data-dm-save-all]").click();
  await page.locator('#editor-modal .ed-tab[data-tab="luci"]').click();
  await expect(page.locator(DIALOGO)).toHaveCount(0);
  await expect(page.locator("#editor-modal .ed-tab.active")).toHaveAttribute("data-tab", "luci");
});

test("chiudere la finestra con un'entità non salvata chiede anche lì", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await scriviNellUps(page);
  await page.locator("#editor-modal .ed-head-close[onclick*='remove']").click();
  await expect(page.locator(DIALOGO)).toBeVisible();
  await page.locator(`${DIALOGO} [data-dm-rds="esci"]`).click();
  await expect(page.locator("#editor-modal")).toHaveCount(0);
});
