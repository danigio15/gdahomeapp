/* L'aggiornamento si installa dalla pastiglia, anche dal browser.
 *
 * Dal campo: «da browser non ti dà più il tasto aggiorna; da app c'è il
 * widget in alto che ti dice che c'è un aggiornamento, se lo clicchi ti dà la
 * stessa schermata del browser». La finestra della pastiglia trattava
 * l'aggiornamento come una luce: «1 acceso · tocca per spegnere», e nessun
 * tasto. Adesso dice «Da installare», le versioni, e il tasto «Installa».
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
    lights: [{ id: "l1", name: "Cucina", entity: "light.cucina" }],
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

test("«Installa» nella finestra degli aggiornamenti chiama update.install", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    stati["light.cucina"] = {
      entity_id: "light.cucina",
      state: "off",
      attributes: { friendly_name: "Cucina" },
    };
    stati["update.browser_mod_update"] = {
      entity_id: "update.browser_mod_update",
      state: "on",
      attributes: {
        friendly_name: "browser_mod Update",
        installed_version: "2.3.1",
        latest_version: "2.4.0",
        supported_features: 23,
        in_progress: false,
      },
    };
    window.__chiamate = [];
    window.dmCallHaService = (dominio, servizio, dati) => {
      window.__chiamate.push(`${dominio}.${servizio} ${dati.entity_id}`);
      return new Promise(() => {});
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  const pastiglia = page.locator('#dm-casa-riga [data-dm-casa="aggiornamenti"]');
  await expect(pastiglia).toBeVisible({ timeout: 20_000 });
  await pastiglia.click();

  const elenco = page.locator("#dm-casa-popup");
  await expect(elenco).toBeVisible();
  await expect(elenco.locator("[data-dm-casa-sotto]")).toHaveText(
    "1 da installare · tocca Installa",
  );
  const riga = elenco.locator(".dm-casa-voce");
  await expect(riga).toHaveCount(1);
  /* La parola la dice il tasto: niente pastiglia accanto. */
  await expect(riga.locator(".dm-casa-stato")).toHaveCount(0);
  await expect(riga.locator(".d-sub")).toHaveText("2.3.1 → 2.4.0");
  await expect(elenco).not.toContainText("spegnere");
  if (process.env.DM_RENDER_DIR)
    await elenco.locator("[data-dm-casa-scheda]").screenshot({
      path: `${process.env.DM_RENDER_DIR}/aggiornamento-da-installare-${testInfo.project.name}.png`,
    });
  const installa = riga.locator("[data-dm-casa-installa]");
  await expect(installa).toHaveText("Installa");
  await installa.click();
  await expect(installa).toHaveText("In corso");
  await expect(installa).toBeDisabled();
  expect(await page.evaluate(() => window.__chiamate)).toEqual([
    "update.install update.browser_mod_update",
  ]);
});
