/* «Quando va sulle luci rgb per impostare i colori non si riesce più a
 * cliccare chiudi per tornare indietro: bisogna chiudere gda e riaprirlo»
 * (#215) — e «quando ritorni nella schermata principale dopo aver aperto delle
 * schede spariscono i tasti» (#214). Le foto venivano da un iPhone con la
 * tacca, dentro l'app di Home Assistant: la riga della scheda della luce, col
 * nome e «✕ CHIUDI», stava sotto l'orologio e la batteria; e la Home
 * cominciava col meteo, col menu e il nome della casa finiti sotto la barra di
 * stato.
 *
 * Un browser di prova la tacca non ce l'ha: la fascia si finge, come quella
 * dei tasti di Android in `la-barra-scansa-i-tasti-del-telefono`, scrivendo la
 * variabile da cui la plancia la legge. Poi si guarda dove sono le cose, e si
 * preme davvero.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-sala", name: "Sala", icon: "mdi:sofa", order: 0 }],
    cameras: [],
    appliances: [],
    loads: [],
    climate: [],
    ev: [],
    covers: [],
    lights: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, lights: true },
};

/* L'iPhone con la tacca: cinquantanove punti di barra di stato. */
const TACCA = 59;

async function telefono(browser) {
  const contesto = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  return { contesto, page: await contesto.newPage() };
}

/* La plancia rimisura la fascia a 400 e a 1500 millisecondi dall'avvio: si
 * aspetta che abbia finito, e da li' la variabile e' della prova. */
async function fingiLaTacca(page, pixel) {
  await page.waitForTimeout(1800);
  await page.evaluate((quanti) => {
    document.documentElement.style.setProperty("--dm-cima-di-sistema", `${quanti}px`);
  }, pixel);
  await page.waitForTimeout(200);
}

async function accendiLaPlancia(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60000,
  });
}

test("la scheda della luce colorata si chiude anche con la tacca sopra", async ({
  browser,
}, testInfo) => {
  test.setTimeout(150_000);
  const { contesto, page } = await telefono(browser);
  await accendiLaPlancia(page, testInfo);
  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    stati["light.led_dietro_tv"] = {
      entity_id: "light.led_dietro_tv",
      state: "on",
      attributes: {
        friendly_name: "Led dietro tv",
        supported_color_modes: ["hs"],
        color_mode: "hs",
        brightness: 180,
        rgb_color: [255, 80, 40],
        hs_color: [12, 84],
      },
    };
    window.applyStates?.();
    localStorage.setItem("cd_luci", JSON.stringify({ "light.led_dietro_tv": "Led dietro tv" }));
    localStorage.setItem("cd_luci_rooms", JSON.stringify({ "light.led_dietro_tv": "room-sala" }));
    window.cdCallServiceJson = () => {};
  });
  await fingiLaTacca(page, TACCA);

  const apri = () => page.evaluate(() => window.dmOpenLightControl("light.led_dietro_tv"));
  expect(await apri()).toBe(true);
  const scheda = page.locator("#dm-light-control-modal");
  await expect(scheda).toBeVisible();
  /* E' la scheda di una luce a colori: il blocco del colore c'e'. */
  await expect(scheda.locator('[data-block="color"]')).toBeVisible();

  /* La finestra comincia sotto la fascia, e finisce dentro lo schermo: alta
   * quanto il vetro e spinta giu' sarebbe uscita dal fondo. */
  const misure = await page.evaluate(() => {
    const finestra = document.querySelector("#dm-light-control-modal .dm-lightctl-dialog");
    const chiudi = finestra.querySelector("[data-close]");
    const f = finestra.getBoundingClientRect();
    const c = chiudi.getBoundingClientRect();
    return { cima: f.top, fondo: f.bottom, chiudi: c.top, alto: innerHeight };
  });
  expect(misure.cima).toBeGreaterThanOrEqual(TACCA);
  expect(misure.chiudi).toBeGreaterThanOrEqual(TACCA);
  expect(misure.fondo).toBeLessThanOrEqual(misure.alto + 0.5);

  /* E si preme col dito, dove sta disegnato. */
  await scheda.locator("[data-close]").tap();
  await expect(scheda).toHaveCount(0);

  /* La seconda porta: Esc, anche con il fuoco fuori dalla finestra — il
   * selettore nativo del colore il fuoco se lo porta via. */
  expect(await apri()).toBe(true);
  await expect(scheda).toBeVisible();
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    document.body.focus();
  });
  await page.keyboard.press("Escape");
  await expect(scheda).toHaveCount(0);
  await contesto.close();
});

test("col chiosco la fascia della Home sta sotto la tacca, anche tornando alla Home", async ({
  browser,
}, testInfo) => {
  test.setTimeout(150_000);
  const { contesto, page } = await telefono(browser);
  await accendiLaPlancia(page, testInfo);
  await fingiLaTacca(page, TACCA);
  /* Il chiosco com'e' dentro l'app di Home Assistant: la plancia a tutto
   * vetro, il segno sul documento. */
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-dm-ios-kiosk", "true");
    document.body.setAttribute("data-dm-ios-kiosk", "true");
  });

  /* Si aprono delle schede e si torna alla Home. */
  for (const scheda of ["energy", "luci", "home"]) {
    await page.evaluate(
      (nome) => document.querySelector(`.tab[data-tab="${nome}"]`)?.click(),
      scheda,
    );
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => window.scrollTo(0, 0));

  const fascia = page.locator("body>header:not(.dm-page-mast)");
  await expect(fascia).toBeVisible();
  const cima = await fascia.evaluate((nodo) => nodo.getBoundingClientRect().top);
  expect(cima).toBeGreaterThanOrEqual(TACCA);
  await contesto.close();
});
