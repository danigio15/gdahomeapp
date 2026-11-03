/* «Widget come elettrodomestici o luci o prese potrebbero avere un'opzione
 * che si auto nascondono?» (#355)
 *
 * Si accende l'opzione dal Config, sulla riga delle Luci. Con tutto spento la
 * tessera sparisce dalla Home; appena una luce si accende torna; e spegnendo
 * l'opzione resta sempre, come prima. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [
      { entity: "light.salotto", name: "Salotto" },
      { entity: "light.cucina", name: "Cucina" },
    ],
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

/* Lo stato delle luci, come arriva da Home Assistant. */
const metti = (page, accese) =>
  page.evaluate((quali) => {
    const stati = eval("_RAW_STATES");
    for (const id of ["light.salotto", "light.cucina"])
      stati[id] = {
        entity_id: id,
        state: quali.includes(id) ? "on" : "off",
        attributes: { friendly_name: id },
      };
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, accese);

async function apriLeTessere(page) {
  await page.locator(".ha-menu-btn").click();
  await page.locator("#cd-app-menu button", { hasText: /Configurazione|Configuration/ }).click();
  await page.locator('.ed-tab[data-tab="todo"]').click();
}

test("la tessera delle Luci sparisce con tutto spento e torna quando una si accende", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60_000,
  });
  await metti(page, []);
  const tessera = page.locator('#dm-widgets .dm-tile[data-dm-widget="luci"]');
  /* Di serie si vede anche con tutto spento. */
  await expect(tessera).toBeVisible({ timeout: 20_000 });

  /* Dal Config, sulla riga delle Luci. */
  await apriLeTessere(page);
  const casella = page.locator('#ed-body [data-widget-solo-acceso="luci"]');
  await expect(casella).toBeVisible({ timeout: 20_000 });
  await expect(casella).not.toBeChecked();
  await casella.check();
  await expect(casella).toBeChecked();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("cd_widgets")).soloAccese),
  ).toEqual(["luci"]);
  await page.locator("#editor-modal .ed-head-close").click();

  await expect(tessera).toHaveCount(0, { timeout: 10_000 });
  await metti(page, ["light.cucina"]);
  await expect(tessera).toBeVisible({ timeout: 10_000 });
  await metti(page, []);
  await expect(tessera).toHaveCount(0, { timeout: 10_000 });

  /* Spenta l'opzione, la tessera resta anche con tutto spento. */
  await apriLeTessere(page);
  await page.locator('#ed-body [data-widget-solo-acceso="luci"]').uncheck();
  await page.locator("#editor-modal .ed-head-close").click();
  await expect(tessera).toBeVisible({ timeout: 10_000 });
});
