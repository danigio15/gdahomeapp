/* La testa ferma resta dov'era, e la riga sotto il meteo si vede.
 *
 * «Se si attiva intestazione fissa si cava tutta la parte sotto l'orario e si
 * abbassa tutto su iPhone. Anche su HA fa uguale.» La testa ferma si fermava
 * sotto la fascia dell'orologio — ma il corpo, che e' quello che scorre, la
 * fascia l'aveva gia' lasciata fuori col suo margine in cima: la testa
 * scendeva di un'altra fascia intera e copriva la riga di cosa e' acceso.
 * E perdeva la sua card: il fondo della plancia le era dipinto sopra.
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
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: { house: { power: "sensor.casa_w" } },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

const misure = (page) =>
  page.evaluate(() => {
    const dove = (nodo) => {
      const r = nodo.getBoundingClientRect();
      return { alto: Math.round(r.top), basso: Math.round(r.bottom) };
    };
    const testa = document.querySelector("body > header");
    return {
      testa: dove(testa),
      riga: dove(document.getElementById("dm-casa-fascia")),
      fondo: getComputedStyle(testa).backgroundImage,
    };
  });

test("con la testa ferma la card resta al suo posto e la riga sotto il meteo si vede", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  /* Una riga sotto il meteo (l'avviso del sovraccarico), e la fascia
   * dell'orologio come la scrive l'app su un telefono. */
  await page.evaluate(() => {
    const mappa = { "dm.energy_potenza_consumo_casa": "sensor.casa_w" };
    localStorage.setItem("cd_entity_overrides", JSON.stringify(mappa));
    window.cdApplyCanonicalOverrides?.(mappa);
    localStorage.setItem("cd_energia_soglia", JSON.stringify({ sorgente: "casa", ambra: 4500 }));
    const stati = eval("_RAW_STATES");
    stati["sensor.casa_w"] = {
      entity_id: "sensor.casa_w",
      state: "5910",
      attributes: { unit_of_measurement: "W" },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
    document.documentElement.style.setProperty("--gdahome-alto", "120px");
  });
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#dm-casa-fascia")).toBeVisible();
  const prima = await misure(page);

  /* Si accende, come dal Config. */
  await page.evaluate(() => {
    localStorage.setItem("dm_testa_fissa", "1");
    window.__DASHBOARDMODERN_TESTA_FISSA__ &&
      document.documentElement.setAttribute("data-dm-testa-fissa", "true");
    window.dispatchEvent(new Event("resize"));
  });
  await page.waitForTimeout(300);
  const ferma = await misure(page);
  expect(ferma.testa.alto, "la testa resta dov'era").toBe(prima.testa.alto);
  expect(ferma.riga.alto, "la riga resta dov'era").toBe(prima.riga.alto);
  expect(ferma.riga.alto, "e la testa non la copre").toBeGreaterThanOrEqual(ferma.testa.basso);
  expect(ferma.fondo, "la card ha il suo fondo").toContain("gradient");

  /* Scorrendo resta ferma sotto l'orologio. */
  await page.evaluate(() => {
    const lungo = document.createElement("div");
    lungo.style.height = "3000px";
    document.getElementById("page-home").append(lungo);
  });
  await page.mouse.move(200, 600);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(400);
  const scorsa = await misure(page);
  expect(scorsa.testa.alto).toBe(prima.testa.alto);
  expect(scorsa.riga.alto).toBeLessThan(prima.riga.alto);
  if (process.env.DM_FOTO)
    await page.screenshot({ path: `${process.env.DM_FOTO}/testa-fissa-scorsa.png` });
});
