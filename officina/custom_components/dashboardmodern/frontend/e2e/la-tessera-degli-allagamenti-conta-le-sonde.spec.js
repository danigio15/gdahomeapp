/* La tessera degli Allagamenti conta le sonde, non quello che le sta accanto.
 *
 * Dal campo, con lo scatto: «continua ad uscire questo allarme bagnato ma non
 * c'è nessuna entità allarme, sono 5 i sensori configurati, questo 6 non
 * esiste». Il sesto c'era: un'entità finita nel gruppo Allagamenti dalla
 * scheda degli avvisi — dove fra i gruppi c'è anche «Allagamenti» — col nome
 * scritto a mano. La tessera la leggeva come legge tutte le altre, acceso vuol
 * dire bagnato, e un antifurto inserito faceva dire alla casa «C'è acqua».
 *
 * Qui si difende la regola nuova dalla parte di chi guarda: nella tessera è
 * una sonda chi dichiara umidità o chi non dichiara niente; chi dichiara di
 * essere un'altra cosa resta nella scheda della configurazione — dove c'è
 * scritto che sonda non è, e c'è il cestino — ma fuori dal conto.
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
    lights: [{ entity: "light.salotto", name: "Salotto" }],
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

test("un avviso nel gruppo Allagamenti non diventa una sonda bagnata", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_gruppi_extra",
      JSON.stringify({
        allag: [
          "binary_sensor.perdita_lavatrice",
          "binary_sensor.perdita_piscina",
          /* Il sesto della segnalazione: ce l'ha messo la scheda degli avvisi,
           * col nome battuto a mano — ed è per questo che è minuscolo. */
          "binary_sensor.allarme_casa",
        ],
      }),
    );
    localStorage.setItem("cd_allag_rilevato", "true");
    localStorage.setItem(
      "cd_avvisi_names_extra",
      JSON.stringify({ "binary_sensor.allarme_casa": "allarme" }),
    );
    const stati = eval("_RAW_STATES");
    stati["light.salotto"] = {
      entity_id: "light.salotto",
      state: "on",
      attributes: { friendly_name: "Salotto" },
    };
    for (const [id, nome] of [
      ["binary_sensor.perdita_lavatrice", "Sensore perdita acqua lavatrice Umidità"],
      ["binary_sensor.perdita_piscina", "Perdita Piscina Umidità"],
    ])
      stati[id] = {
        entity_id: id,
        state: "off",
        attributes: { friendly_name: nome, device_class: "moisture" },
      };
    /* Inserito, e infatti acceso: è quello che faceva dire «C'è acqua». */
    stati["binary_sensor.allarme_casa"] = {
      entity_id: "binary_sensor.allarme_casa",
      state: "on",
      attributes: { friendly_name: "Allarme casa", device_class: "safety" },
    };
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await page.waitForTimeout(1500);

  const tessera = page.locator('[data-dm-widget="allagamenti"]');
  await expect(tessera).toBeVisible({ timeout: 30000 });
  /* Due sonde, non tre: il numero è la prima cosa che si legge. */
  await expect(tessera).toContainText("2");
  /* E la casa è asciutta: l'antifurto inserito non è acqua. */
  await expect(tessera).not.toContainText("allarme");

  await tessera.click();
  const finestra = page.locator("#dm-widget-popup .dm-widget-detail");
  await expect(finestra).toBeVisible({ timeout: 10000 });
  await expect(finestra).not.toContainText("C'e' acqua");
  await expect(finestra.locator(".dm-w-row")).toHaveCount(2);
  await expect(finestra).toContainText("Perdita Piscina Umidità");
  await expect(finestra).not.toContainText("allarme");
});
