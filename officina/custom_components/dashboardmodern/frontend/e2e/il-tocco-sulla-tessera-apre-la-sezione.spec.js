/* Il tocco sulla tessera porta dritti nella sezione, per chi lo sceglie (#156).
 *
 * «Quando clicco sul widget, esempio elettrodomestici, e' possibile scegliere
 *  se aprire direttamente la sezione e non il riepilogo?» E poi: «non
 *  intendevo il pulsante "Apri sezione", intendevo la possibilita' di saltare
 *  direttamente dal widget alla sezione aperta».
 *
 * La scelta e' tessera per tessera, nel Config dei widget, spenta di serie:
 * chi non la tocca vede la finestra di sempre. E dove la sezione non c'e' —
 * spenta in configurazione — il tocco apre la finestra come sempre, invece di
 * non fare niente.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [
      { name: "Salotto", order: 0, temp: "sensor.salotto_temperatura" },
      { name: "Cucina", order: 1, temp: "sensor.cucina_temperatura" },
    ],
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
  },
  visibility: {},
};

async function avvia(page, testInfo, dirette) {
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate((scelte) => {
    if (scelte) {
      const widget = JSON.parse(localStorage.getItem("cd_widgets") || "{}");
      localStorage.setItem("cd_widgets", JSON.stringify({ ...widget, dirette: scelte }));
    }
    const grezzi = eval("_RAW_STATES");
    for (const [entity, gradi] of [
      ["sensor.salotto_temperatura", "21.4"],
      ["sensor.cucina_temperatura", "22.1"],
    ]) {
      grezzi[entity] = {
        entity_id: entity,
        state: gradi,
        attributes: { unit_of_measurement: "°C", device_class: "temperature" },
      };
    }
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, dirette);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  const tessera = page.locator('#dm-widgets [data-dm-widget="temperatura"]').first();
  await tessera.waitFor({ state: "visible", timeout: 20_000 });
  return tessera;
}

const doveSono = (page) =>
  page.evaluate(() => ({
    aperta: !document.getElementById("dm-widget-popup")?.hidden,
    pagina: document.querySelector(".page.active")?.id || "",
  }));

test("di serie il tocco apre la finestra, come sempre", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const tessera = await avvia(page, testInfo, null);
  await tessera.click();
  await expect(
    page.locator('#dm-widget-popup [data-dm-widget-detail="temperatura"]'),
  ).toBeVisible();
});

test("scelto nel Config, il tocco porta dritti nella sezione", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const tessera = await avvia(page, testInfo, ["temperatura"]);
  await tessera.click();
  await expect
    .poll(() => doveSono(page), { timeout: 15_000 })
    .toEqual({ aperta: false, pagina: "page-temp" });
});

test("con la sezione spenta il tocco apre la finestra", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const tessera = await avvia(page, testInfo, ["temperatura"]);
  await page.evaluate(() => {
    const sezioni = JSON.parse(localStorage.getItem("cd_sections") || "{}");
    sezioni.temp = false;
    localStorage.setItem("cd_sections", JSON.stringify(sezioni));
    window.cdApplyNavVis?.();
  });
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            getComputedStyle(document.querySelector('.tab[data-tab="temp"]')).display === "none",
        ),
      { timeout: 10_000 },
    )
    .toBe(true);
  await tessera.click();
  await expect(
    page.locator('#dm-widget-popup [data-dm-widget-detail="temperatura"]'),
  ).toBeVisible();
});

test("la casella sta nel Config dei widget e salva la scelta", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo, null);
  await page.locator(".ha-menu-btn").click();
  await page.locator("#cd-app-menu button", { hasText: /Configurazione|Configuration/ }).click();
  await page.locator('.ed-tab[data-tab="todo"]').click();
  const casella = page.locator('#ed-body [data-widget-diretta="temperatura"]');
  await expect(casella).toBeAttached({ timeout: 15_000 });
  /* Le tessere che vivono solo in Home non la offrono: gli allagamenti e le
   * entita' in evidenza non hanno una sezione in cui portare. */
  for (const chiave of ["allagamenti", "evidenza"]) {
    const riga = page.locator(`#ed-body [data-widget-key="${chiave}"]`);
    await expect(riga).toBeAttached();
    await expect(riga.locator("[data-widget-diretta]")).toHaveCount(0);
  }
  await casella.check();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("cd_widgets") || "{}").dirette))
    .toEqual(["temperatura"]);
});
