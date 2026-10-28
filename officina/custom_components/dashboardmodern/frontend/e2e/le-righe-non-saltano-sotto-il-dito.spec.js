/* «Quando ne spengo o accendo una si riordinano, e spesso mentre faccio tap
 * mi confonde e sbaglio a premere» (#334).
 *
 * La finestra delle luci mette in cima quelle accese quando si apre; da li' in
 * poi l'ordine resta quello, anche se una luce si accende o si spegne. Chiusa
 * e riaperta, si riordina.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const LUCI = ["light.salotto", "light.cucina", "light.studio", "light.camera"];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-salotto", name: "Salotto", icon: "🛋️", metadata: {} }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [
      { entity: "light.salotto", name: "Salotto", room_id: "room-salotto" },
      { entity: "light.cucina", name: "Cucina" },
      { entity: "light.studio", name: "Studio" },
      { entity: "light.camera", name: "Camera" },
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

async function accendi(page, accese) {
  await page.evaluate(
    ({ luci, quali }) => {
      const stati = eval("_RAW_STATES");
      for (const id of luci)
        stati[id] = {
          entity_id: id,
          state: quali.includes(id) ? "on" : "off",
          attributes: { friendly_name: id },
        };
      window.applyStates?.();
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    },
    { luci: LUCI, quali: accese },
  );
}

const ordine = (page) =>
  page
    .locator("#dm-widget-popup [data-dm-w-light]")
    .evaluateAll((righe) => righe.map((riga) => riga.getAttribute("data-dm-w-light")));

test("le luci restano al loro posto mentre la finestra e' aperta", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate(() => {
    window.dmCallHaService = () => Promise.resolve(true);
  });
  await accendi(page, ["light.studio"]);
  await page.waitForTimeout(1200);
  await page.locator('#dm-widgets .dm-tile[data-dm-widget="luci"]').click();
  await expect(page.locator("#dm-widget-popup")).toBeVisible();
  /* All'apertura: accese in cima. */
  await expect
    .poll(() => ordine(page))
    .toEqual(["light.studio", "light.salotto", "light.cucina", "light.camera"]);
  const prima = await ordine(page);
  await page.screenshot({ path: testInfo.outputPath("luci-prima.png") });

  /* Si accende la Camera e si spegne lo Studio: la finestra si ridisegna, e
   * nessuna riga cambia posto. */
  await accendi(page, ["light.camera"]);
  await page.waitForTimeout(2500);
  await expect(page.locator('#dm-widget-popup [data-dm-w-light="light.camera"]')).toHaveAttribute(
    "data-on",
    "true",
  );
  expect(await ordine(page)).toEqual(prima);
  await page.screenshot({ path: testInfo.outputPath("luci-dopo.png") });

  /* Chiusa e riaperta: si riordina, accese in cima. */
  await page.keyboard.press("Escape");
  await expect(page.locator("#dm-widget-popup")).toBeHidden();
  await page.locator('#dm-widgets .dm-tile[data-dm-widget="luci"]').click();
  await expect
    .poll(() => ordine(page))
    .toEqual(["light.camera", "light.salotto", "light.cucina", "light.studio"]);
});
