/* «Sbaglio qualcosa nella configurazione? Che menu devo selezionare per il
 * BMS?» (#264, Huawei LUNA2000)
 *
 * Una LUNA2000 con l'integrazione Huawei Solar non ha un BMS da scegliere: la
 * batteria la racconta l'inverter, e le sue entità vanno in Energia, «Flussi
 * ed entità», nei due riquadri della batteria. La scheda «Batteria di
 * accumulo» è facoltativa, e adesso lo dice in testa; se la si apre lo stesso
 * trova da sola i due moduli della LUNA, col tipo «Huawei LUNA2000».
 *
 * Con `DM_SCATTI` nell'ambiente le fotografie finiscono lì; senza, accanto ai
 * risultati della prova.
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
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

/* Le entità come le scrive Huawei Solar: il dispositivo «Battery» davanti a
 * tutte, e i moduli numerati. */
function huawei() {
  const stati = {};
  const metti = (id, valore, unita, nome, classe = "") =>
    (stati[`sensor.${id}`] = {
      state: String(valore),
      attributes: {
        unit_of_measurement: unita,
        friendly_name: nome,
        ...(classe ? { device_class: classe } : {}),
      },
    });
  metti("battery_state_of_capacity", 64, "%", "Battery State of capacity", "battery");
  metti("battery_charge_discharge_power", 1830, "W", "Battery Charge/Discharge power", "power");
  metti("battery_bus_voltage", 451.2, "V", "Battery Bus voltage", "voltage");
  metti("battery_bus_current", 4.1, "A", "Battery Bus current", "current");
  metti("battery_day_charge", 3.4, "kWh", "Battery Day charge", "energy");
  metti("battery_day_discharge", 1.2, "kWh", "Battery Day discharge", "energy");
  metti("battery_rated_capacity", 10000, "Wh", "Battery Rated capacity", "energy_storage");
  stati["sensor.battery_status"] = {
    state: "Running",
    attributes: { friendly_name: "Battery Status" },
  };
  for (const n of [1, 2]) {
    const nome = `Battery ${n}`;
    metti(`battery_${n}_state_of_capacity`, n === 1 ? 66 : 62, "%", `${nome} State of capacity`, "battery");
    metti(`battery_${n}_charge_discharge_power`, n === 1 ? 940 : 890, "W", `${nome} Charge/Discharge power`, "power");
    metti(`battery_${n}_bus_voltage`, 451.2, "V", `${nome} Bus voltage`, "voltage");
    metti(`battery_${n}_bus_current`, n === 1 ? 2.1 : 2.0, "A", `${nome} Bus current`, "current");
    metti(`battery_${n}_maximum_temperature`, n === 1 ? 24 : 25, "°C", `${nome} Maximum temperature`, "temperature");
    metti(`battery_${n}_minimum_temperature`, n === 1 ? 21 : 22, "°C", `${nome} Minimum temperature`, "temperature");
    metti(`battery_${n}_total_charge`, 812, "kWh", `${nome} Total charge`, "energy");
  }
  return stati;
}

async function avvia(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate((stati) => {
    const grezzi = eval("_RAW_STATES");
    for (const [id, stato] of Object.entries(stati)) grezzi[id] = { entity_id: id, ...stato };
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, huawei());
  await page.waitForTimeout(500);
}

async function fotografa(page, testInfo, nome) {
  const cartella = process.env.DM_SCATTI;
  const percorso = cartella
    ? `${cartella}/huawei-${nome}-${testInfo.project.name}.png`
    : testInfo.outputPath(`huawei-${nome}.png`);
  await page.screenshot({ path: percorso });
}

test("la scheda dell'accumulo dice dove va una LUNA2000, e ne trova i moduli", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('#editor-modal .ed-tab[data-tab="accumulo"]').click();
  const scheda = page.locator('#ed-body [data-dm-dich-sezione="accumulo"]');
  await expect(scheda).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(600);
  await fotografa(page, testInfo, "config-accumulo");

  /* In testa: è facoltativa, e la batteria dell'inverter si mette in Energia. */
  const avviso = page.locator("#ed-body [data-dm-accu-inverter]");
  await expect(avviso).toBeVisible();
  await expect(avviso).toContainText("Flussi ed entità");
  await expect(avviso).toContainText("Huawei LUNA2000");

  /* I due moduli, non tre: la somma «Battery» non è un pacco in più. */
  const righe = scheda.locator(".dm-dich-riga");
  await expect(righe).toHaveCount(2, { timeout: 15_000 });
  await expect(righe.nth(0)).toContainText("Huawei LUNA2000");
  const salvati = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_accumulo")));
  expect(salvati.righe).toHaveLength(2);
  expect(salvati.righe[0]).toMatchObject({
    entity: "sensor.battery_1_state_of_capacity",
    tipo: "huawei",
    potenza: "sensor.battery_1_charge_discharge_power",
    tensione: "sensor.battery_1_bus_voltage",
    corrente: "sensor.battery_1_bus_current",
    temperatura: "sensor.battery_1_maximum_temperature",
  });

  await righe.nth(0).locator("[data-dm-dich-apri]").click();
  const corpo = page.locator('#ed-body [data-dm-dich-indice="0"] .dm-dich-corpo');
  await expect(corpo.locator('[data-dm-dich-campo="tipo"]')).toHaveValue("huawei");
  await righe.nth(0).scrollIntoViewIfNeeded();
  await fotografa(page, testInfo, "config-modulo");
});
