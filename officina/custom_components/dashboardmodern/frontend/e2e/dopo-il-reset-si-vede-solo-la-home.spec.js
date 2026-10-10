/* «Ho fatto un reset totale ma ci sono sezioni attive anche dopo: devono
 * attivarsi solo se si inseriscono entità. Da nuovo deve uscire tutto non
 * visibile, solo Home e Config.»
 *
 * Le sezioni che decidono da sole se hanno contenuto (UPS, Piante, Acqua e
 * gas, Le tue sezioni…) nella barra non c'erano, ma l'elenco del Config le
 * dava accese: guardava solo `cd_sections`, dove «non scritto» vuol dire
 * acceso. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const VUOTA = {
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
};

test("su una plancia azzerata l'elenco accende solo la Home", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, VUOTA);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => apriConfigEntita());
  await page.locator('.ed-tab[data-tab="visib"]').first().click();
  await expect(page.locator("#dm-elenco-sezioni")).toBeVisible({ timeout: 15_000 });

  const accese = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('#dm-elenco-sezioni [role="switch"][aria-checked="true"]')].map(
        (n) => n.dataset.dmSezioneInt,
      ),
    );
  await expect.poll(accese).toEqual(["home"]);
  /* Le quattro della segnalazione, una per una. */
  for (const chiave of ["ups", "piante", "contatori", "mie"])
    await expect(
      page.locator(`#dm-elenco-sezioni [data-dm-sezione-int="${chiave}"]`),
    ).toHaveAttribute("aria-checked", "false");
  /* E nella barra c'è solo Home (e Config). */
  const voci = await page.evaluate(() =>
    [...document.querySelectorAll("nav.tabs .tab")]
      .filter((n) => getComputedStyle(n).display !== "none")
      .map((n) => n.dataset.tab),
  );
  expect(voci.sort()).toEqual(["config", "home"]);
});
