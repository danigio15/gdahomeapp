/* L'ora e la data nella striscia del meteo.
 *
 * «La barra del meteo e' un po' bruttina con tutto quel buco senza niente:
 * se si mette l'orario e la data piu' grandi?» E «invece su app manca la
 * data». Sullo schermo largo l'ora e' grande e la data e' scritta per esteso
 * accanto; sul telefono l'ora resta piccola, ma la data c'e' sotto.
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
    entityOverrides: { "dm.home_meteo": "weather.casa" },
  },
  visibility: { home: true },
};

async function avvia(page, testInfo, tema) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((tema) => {
    document.documentElement.setAttribute("data-theme", tema);
    const grezzi = eval("_RAW_STATES");
    grezzi["weather.casa"] = {
      entity_id: "weather.casa",
      state: "partlycloudy",
      attributes: { friendly_name: "Meteo", temperature: 14.4, humidity: 51, wind_speed: 21.2 },
    };
    window.cdApplyCanonicalOverrides?.({ "dm.home_meteo": "weather.casa" });
    window.render?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, tema);
  await expect(page.locator("#w-temp")).toHaveText("14.4°C");
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForTimeout(600);
}

for (const tema of ["dark", "light"])
  test(`ora e data in testata (${tema})`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const telefono = testInfo.project.name === "mobile";
    if (!telefono) await page.setViewportSize({ width: 1600, height: 1000 });
    await avvia(page, testInfo, tema);
    const orologio = page.locator("header .dm-orologio");
    await expect(orologio.locator(".dm-orologio-ora")).toBeVisible();
    if (telefono) {
      /* Sul telefono la data c'e', corta, sotto l'ora. */
      await expect(orologio.locator(".dm-orologio-data")).toBeVisible();
      await expect(orologio.locator(".dm-orologio-giorno")).toBeHidden();
    } else {
      /* Sullo schermo largo l'ora e' grande e il giorno per esteso accanto. */
      const misura = await orologio
        .locator(".dm-orologio-ora")
        .evaluate((n) => parseFloat(getComputedStyle(n).fontSize));
      expect(misura).toBeGreaterThanOrEqual(30);
      await expect(orologio.locator(".dm-orologio-giorno")).toBeVisible();
      await expect(orologio.locator(".dm-orologio-giorno")).toHaveText(/\d/);
    }
    if (process.env.DM_FOTO) {
      await page
        .locator("header:not(.dm-page-mast)")
        .first()
        .screenshot({
          path: `${process.env.DM_FOTO}/testata-${tema}-${testInfo.project.name}.png`,
        });
      await page.screenshot({
        path: `${process.env.DM_FOTO}/home-${tema}-${testInfo.project.name}.png`,
      });
    }
  });
