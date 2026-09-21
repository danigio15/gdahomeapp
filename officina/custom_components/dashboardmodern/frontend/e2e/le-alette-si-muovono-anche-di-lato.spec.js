/* Le alette orizzontali accanto a quelle verticali (#56).
 *
 * «I miei climatizzatori hanno alette sia verticali che orizzontali, al
 * momento vengono visti solo i comandi per le alette verticali ma non quelli
 * per quelle orizzontali.» Home Assistant pubblica il secondo asse con la
 * stessa forma del primo — `swing_horizontal_modes` accanto a `swing_modes` —
 * e lo comanda con un servizio suo, `set_swing_horizontal_mode`. Il pannello
 * ne leggeva solo metà.
 *
 * Qui si pretende quello che si vede e quello che parte: le due righe quando
 * la macchina ha due assi, una sola con il nome di sempre quando ne ha uno, e
 * il servizio giusto col nome giusto del parametro — che è la parte che, se
 * sbagliata, dà tasti che non fanno niente sulla casa vera.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Due macchine: la prima muove il getto in tutti e due i sensi, la seconda
 * solo su e giù, come la stragrande maggioranza. */
const CLIMI = [
  { id: "cl0", name: "Salone", entity: "climate.salone", assi: "due" },
  { id: "cl1", name: "Cucina", entity: "climate.cucina", assi: "uno" },
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: CLIMI,
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, climate: true },
};

async function avvia(page, testInfo) {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((climi) => {
    const grezzi = eval("_RAW_STATES");
    climi.forEach((unita) => {
      grezzi[unita.entity] = {
        entity_id: unita.entity,
        state: "cool",
        attributes: {
          friendly_name: unita.name,
          current_temperature: 24,
          temperature: 22,
          hvac_modes: ["off", "heat", "cool"],
          fan_modes: ["auto", "alto"],
          fan_mode: "auto",
          swing_modes: ["off", "vertical", "both"],
          swing_mode: "vertical",
          ...(unita.assi === "due"
            ? {
                swing_horizontal_modes: ["off", "sinistra", "destra", "oscilla"],
                swing_horizontal_mode: "destra",
              }
            : {}),
          min_temp: 16,
          max_temp: 32,
          target_temp_step: 0.5,
          hvac_action: "cooling",
        },
      };
    });
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, CLIMI);
  await page.waitForTimeout(2000);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.locator('#dm-widgets .dm-tile[data-dm-widget="clima"]').evaluate((n) => n.click());
  await expect(page.locator("#dm-widget-popup .dm-w-row").first()).toBeVisible();
}

const apriIlPannello = async (page, entity) => {
  await page.locator(`#dm-widget-popup [data-dm-w-more="${entity}"]`).evaluate((n) => n.click());
  const pannello = page.locator(`#dm-widget-popup [data-dm-w-panel="${entity}"]`);
  await expect(pannello).toBeVisible();
  return pannello;
};

test("due assi: due righe, e ognuna dice quale muove", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  const pannello = await apriIlPannello(page, "climate.salone");

  const verticali = await pannello
    .locator("[data-dm-w-swing]")
    .evaluateAll((nodi) => nodi.map((n) => n.dataset.dmWSwing));
  expect(verticali).toEqual(["off", "vertical", "both"]);
  const orizzontali = await pannello
    .locator("[data-dm-w-swing-h]")
    .evaluateAll((nodi) => nodi.map((n) => n.dataset.dmWSwingH));
  expect(orizzontali).toEqual(["off", "sinistra", "destra", "oscilla"]);

  /* Quella scelta è segnata, su tutte e due le righe e per il suo asse. */
  await expect(pannello.locator('[data-dm-w-swing="vertical"]')).toHaveAttribute("data-on", "true");
  await expect(pannello.locator('[data-dm-w-swing-h="destra"]')).toHaveAttribute("data-on", "true");

  /* Con due righe i nomi si distinguono, o non si sa quale si sta toccando. */
  const etichette = await pannello
    .locator(".dm-w-panel-lbl")
    .evaluateAll((nodi) => nodi.map((n) => n.textContent.trim()));
  expect(etichette).toContain("Alette verticali");
  expect(etichette).toContain("Alette orizzontali");
});

test("un asse solo: una riga sola, col nome di sempre", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  const pannello = await apriIlPannello(page, "climate.cucina");
  await expect(pannello.locator("[data-dm-w-swing]")).toHaveCount(3);
  await expect(pannello.locator("[data-dm-w-swing-h]")).toHaveCount(0);
  const etichette = await pannello
    .locator(".dm-w-panel-lbl")
    .evaluateAll((nodi) => nodi.map((n) => n.textContent.trim()));
  expect(etichette).toContain("Alette");
  expect(etichette).not.toContain("Alette verticali");
});

test("toccando un'aletta orizzontale parte il suo servizio, non quello verticale", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  /* La plancia chiama Home Assistant dalla prima di queste che trova, quindi
   * si ascoltano tutte e due invece di indovinare quale. */
  await page.evaluate(() => {
    window.__chiamate = [];
    for (const nome of ["dmCallHaService", "callService"]) {
      const vero = window[nome];
      if (typeof vero !== "function") continue;
      window[nome] = (...argomenti) => {
        window.__chiamate.push(argomenti);
        return vero.apply(window, argomenti);
      };
    }
  });
  const pannello = await apriIlPannello(page, "climate.salone");

  await pannello.locator('[data-dm-w-swing-h="sinistra"]').evaluate((n) => n.click());
  /* Il servizio è un altro, e il parametro si chiama come l'attributo: se uno
   * dei due nomi è sbagliato il tasto non fa niente, e sulla casa vera non se
   * ne accorge nessuno finché non lo prova. */
  const orizzontale = await page.evaluate(() =>
    window.__chiamate.find((c) => JSON.stringify(c).includes("swing_horizontal")),
  );
  expect(JSON.stringify(orizzontale)).toContain("set_swing_horizontal_mode");
  expect(JSON.stringify(orizzontale)).toContain('"swing_horizontal_mode":"sinistra"');
  expect(JSON.stringify(orizzontale)).toContain("climate.salone");

  /* E quella verticale continua a chiamare la sua. */
  await pannello.locator('[data-dm-w-swing="both"]').evaluate((n) => n.click());
  const verticale = await page.evaluate(() =>
    window.__chiamate.find(
      (c) => JSON.stringify(c).includes("set_swing_mode") && JSON.stringify(c).includes("both"),
    ),
  );
  expect(JSON.stringify(verticale)).toContain('"swing_mode":"both"');
});
