/* L'editor dice perché la card non mostrerà quel consumo (#47).
 *
 * «Gli elettrodomestici non mostrano i consumi. Effettuata integrazione in
 * smarthings di samsung ma niente.» La card pretende un sensore in W o kW, e
 * scartava in silenzio tutto il resto. Un contatore di kWh — quello che le
 * integrazioni portano più spesso — finiva nel campo della potenza e non
 * accendeva niente, senza una parola.
 *
 * La frase si prova a tavolino; qui si pretende quello che si vede: l'avviso
 * sotto il campo giusto quando la scheda si apre, che sparisce appena si
 * scrive un sensore buono e torna appena se ne scrive uno storto.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const STATI = {
  "sensor.tv_energia": {
    state: "412.5",
    attributes: { friendly_name: "TV energia", unit_of_measurement: "kWh", state_class: "total" },
  },
  "sensor.tv_potenza": {
    state: "95",
    attributes: { friendly_name: "TV potenza", unit_of_measurement: "W" },
  },
};

/* La TV come la mappa chi ha l'integrazione Samsung: i kWh nel campo della
 * potenza, perché è l'unico numero di consumo che l'integrazione porta. */
const seme = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-salotto", name: "Salotto", icon: "🛋️", metadata: {} }],
    cameras: [],
    appliances: [
      {
        id: "appliance-tv",
        name: "TV Salotto",
        visual_type: "asset",
        visual_key: "tv",
        device_type: "tv",
        icon: "tv",
        power_entity: "sensor.tv_energia",
        entities: ["sensor.tv_energia"],
        show_in_dashboard: true,
      },
    ],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    energyLoads: [],
    entityOverrides: {},
  },
  visibility: { home: true, appliances: true },
};

async function apriLaScheda(page, testInfo) {
  test.setTimeout(90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.evaluate((s) => {
    window.__HASS__ = { states: s };
    window.hass = { ...(window.hass || {}), states: s };
    window._RAW_STATES = s;
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  }, STATI);
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("appliances");
    window.edApplEdit(0);
  });
  const scheda = page.locator("#dm-appliance-editor-modal");
  await expect(scheda).toBeVisible();
  return scheda;
}

test("i kWh nel campo della potenza si fanno dire di no, e dove andare", async ({
  page,
}, testInfo) => {
  const scheda = await apriLaScheda(page, testInfo);
  const avviso = scheda.locator("[data-dm-power-warning]");
  await expect(avviso).toBeVisible();
  await expect(avviso).toContainText("contatore di energia");
  await expect(avviso).toContainText("Energia totale");
  /* Sotto il campo che sbaglia, non da un'altra parte. */
  const campo = scheda.locator('input[name="power_entity"]');
  await expect(campo).toHaveValue("sensor.tv_energia");
  await expect(avviso.locator("xpath=ancestor::label[1]")).toContainText("Potenza istantanea");
});

test("l'avviso sparisce col sensore giusto e torna con quello storto", async ({
  page,
}, testInfo) => {
  const scheda = await apriLaScheda(page, testInfo);
  const avviso = scheda.locator("[data-dm-power-warning]");
  const riga = scheda.locator('input[name="power_entity"]').locator("xpath=parent::span");

  /* Il campo non si tocca a mano: l'entità sta dentro una pastiglia, con il
   * cestino per toglierla e la matita per scriverla. Sono le due strade che
   * ha chi configura, e l'avviso deve seguirle tutte e due. */
  await riga.locator(".dm-chip-clear").click();
  await expect(scheda.locator('input[name="power_entity"]')).toHaveValue("");
  /* Un campo svuotato non è un errore: non c'è ancora niente da sbagliare. */
  await expect(avviso).toBeHidden();

  await riga.locator(".dm-chip-manual").click();
  const campo = scheda.locator('input[name="power_entity"]');
  await expect(campo).toBeVisible();

  await campo.fill("sensor.tv_potenza");
  await expect(avviso).toBeHidden();

  await campo.fill("sensor.tv_energia");
  await expect(avviso).toBeVisible();
  await expect(avviso).toContainText("contatore di energia");
});
