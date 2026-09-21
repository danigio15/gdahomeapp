/* La sezione MiniPC si accorge della configurazione che arriva dopo.
 *
 * «Ho inserito manualmente i dati della sezione dal configurazione, se la apro
 * vedo vuoto poi chiudo e riapro ed escono; da app sono vuoti.»
 *
 * Il guscio la mappa delle caselle se la prende una volta sola, quando il suo
 * script viene letto. Chi la cambia dopo — la configurazione che arriva dal
 * ponte, l'editor che salva, un altro telefono che sincronizza — non scrive
 * dentro quella mappa: la sostituisce, chiamando `cdApplyCanonicalOverrides`.
 * Da quel momento il guscio legge giusto, ma nessuno ridisegnava: la pagina
 * restava su NON CONFIGURATO coi numeri a trattino finché non si usciva e si
 * rientrava. Nell'app quello è il caso normale, non l'eccezione.
 *
 * Qui si pretende quello che si vede: aperta prima della configurazione dice
 * onestamente che non ce n'è, e appena arriva si raddrizza da sola — senza
 * chiudere e riaprire niente.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const MAPPA = {
  "dm.server_cpu": "sensor.minipc_cpu",
  "dm.server_ram": "sensor.minipc_ram",
  "dm.server_disco": "sensor.minipc_disco",
  "dm.server_temperatura_cpu": "sensor.minipc_temp",
  "dm.server_raggiungibilita_google": "binary_sensor.minipc_google",
};
const STATI = {
  "sensor.minipc_cpu": { state: "14.2", attributes: { unit_of_measurement: "%" } },
  "sensor.minipc_ram": { state: "62", attributes: { unit_of_measurement: "%" } },
  "sensor.minipc_disco": { state: "35", attributes: { unit_of_measurement: "%" } },
  "sensor.minipc_temp": { state: "66", attributes: { unit_of_measurement: "°C" } },
  "binary_sensor.minipc_google": { state: "on", attributes: {} },
};
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
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, server: true },
};

const pastiglia = (page) => page.locator("#v-srv-net-status");

async function avvia(page, testInfo) {
  test.setTimeout(120_000);
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((s) => {
    Object.assign(eval("_RAW_STATES"), s);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.locator('.tab[data-tab="server"]').evaluate((n) => n.click());
  await expect(page.locator("#page-server")).toHaveClass(/active/);
}

test("la configurazione che arriva dopo si vede senza riaprire la pagina", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);

  /* Prima che arrivi: nessuna casella compilata, e la pagina lo dice invece di
   * far finta. Grigio, non rosso: non è un guasto, è una casa da configurare. */
  await expect(pastiglia(page)).toHaveText(/NON CONFIGURATO/);

  /* Ora arriva, come arriva nell'app: il ponte consegna la configurazione e il
   * guscio si sostituisce la mappa. Nessuno tocca la pagina. */
  await page.evaluate((m) => window.cdApplyCanonicalOverrides?.(m), MAPPA);

  /* E la pagina si raddrizza da sola. Questa era la riga che falliva: restava
   * NON CONFIGURATO fino a un'uscita e un rientro. */
  await expect(pastiglia(page)).toHaveText(/ONLINE/);
});

test("una casella che si svuota torna a dire che non c'è, sempre senza riaprire", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await page.evaluate((m) => window.cdApplyCanonicalOverrides?.(m), MAPPA);
  await expect(pastiglia(page)).toHaveText(/ONLINE/);

  /* Il contrario vale uguale: chi toglie la mappatura deve vederlo subito, o
   * crederebbe di avere ancora configurato quello che ha appena cancellato. */
  await page.evaluate(() => window.cdApplyCanonicalOverrides?.({}));
  await expect(pastiglia(page)).toHaveText(/NON CONFIGURATO/);
});
