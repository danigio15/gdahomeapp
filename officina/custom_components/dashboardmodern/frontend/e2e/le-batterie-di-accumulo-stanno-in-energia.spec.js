/* «Poter aggiungere tutte le entità dei BMS, per esempio ho due BMS JK con
 * stati di carica, stati di salute, correnti e tensioni varie.» (#117)
 *
 * Qui si guarda la plancia vera con due JK come li pubblica esphome-jk-bms,
 * uno con le celle in regola e uno da bilanciare:
 *
 *   · la scheda «Batteria di accumulo» del Config, sotto l'insegna Energia, che alla prima apertura si
 *     riempie da sola dei due pacchi, con le loro sedici celle;
 *   · la linguetta «Batterie» dentro Energia, accanto a Istantanea, con la
 *     risposta grande, l'avviso del pacco da bilanciare e una scheda per pacco;
 *   · la tessera «Accumulo» in Home, che chiede attenzione e porta alla
 *     linguetta.
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
    lights: [{ entity: "light.salotto", name: "Salotto" }],
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

const BILANCIATE = [
  3.334, 3.338, 3.331, 3.336, 3.34, 3.332, 3.335, 3.337, 3.33, 3.336, 3.333, 3.339, 3.332, 3.336,
  3.338, 3.342,
];
const SBILANCIATE = [
  3.326, 3.327, 3.329, 3.327, 3.324, 3.325, 3.326, 3.345, 3.328, 3.325, 3.326, 3.327, 3.303, 3.325,
  3.328, 3.326,
];

/* Gli stati di un JK, coi nomi di esphome-jk-bms e il nome del dispositivo
 * davanti a ogni entità, come li scrive Home Assistant. */
function jk(n, { soc, corrente, celle, delta }) {
  const prefisso = `sensor.jk_bms_${n}`;
  const nome = `Pacco ${n}`;
  const stati = {};
  const metti = (coda, valore, unita, parola) =>
    (stati[`${prefisso}_${coda}`] = {
      state: String(valore),
      attributes: { unit_of_measurement: unita, friendly_name: `${nome} ${parola}` },
    });
  metti("state_of_charge", soc, "%", "State of charge");
  metti("state_of_health", n === 1 ? 98 : 96, "%", "State of health");
  metti("total_voltage", n === 1 ? 53.42 : 53.18, "V", "Total voltage");
  metti("current", corrente, "A", "Current");
  metti("power", Math.round(53.3 * corrente), "W", "Power");
  metti("delta_cell_voltage", delta, "V", "Delta cell voltage");
  metti("charging_cycles", n === 1 ? 214 : 238, "", "Charging cycles");
  metti("temperature_sensor_1", n === 1 ? 27.1 : 28.3, "°C", "Temperature sensor 1");
  metti("power_tube_temperature", n === 1 ? 31 : 33, "°C", "Power tube temperature");
  metti("capacity_remaining", Math.round(1.2 * soc), "Ah", "Capacity remaining");
  metti("total_battery_capacity_setting", 120, "Ah", "Total battery capacity setting");
  celle.forEach((volt, i) => metti(`cell_voltage_${i + 1}`, volt, "V", `Cell voltage ${i + 1}`));
  return stati;
}

const STATI = {
  ...jk(1, { soc: 81, corrente: 12.6, celle: BILANCIATE, delta: 0.012 }),
  ...jk(2, { soc: 75, corrente: 10.7, celle: SBILANCIATE, delta: 0.042 }),
};

async function avvia(page, testInfo, { dichiarati = true } = {}) {
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
    /* Una luce qualunque: la striscia dei widget in Home c'è solo se c'è
     * qualcosa da mostrarci. E il sole sul tetto, che dice da dove arriva la
     * carica. */
    grezzi["light.salotto"] = { entity_id: "light.salotto", state: "on", attributes: {} };
    grezzi["dm.energy_potenza_fotovoltaico"] = {
      entity_id: "dm.energy_potenza_fotovoltaico",
      state: "2400",
      attributes: { unit_of_measurement: "W" },
    };
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);
  if (dichiarati) {
    /* I pacchi come li scrive la scheda alla prima apertura: è la prima prova
     * qui sotto a dire che li scrive così. */
    await page.evaluate(() => window.apriConfigEntita());
    await page.locator('#editor-modal .ed-tab[data-tab="accumulo"]').click();
    await expect(
      page.locator('#ed-body [data-dm-dich-sezione="accumulo"] .dm-dich-riga'),
    ).toHaveCount(2, {
      timeout: 15_000,
    });
    await chiudiIlConfig(page);
  }
  await page.waitForTimeout(800);
}

/* Il Config è una finestra sopra la plancia: finché è aperta copre la barra. */
async function chiudiIlConfig(page) {
  await page.evaluate(() => document.getElementById("editor-modal")?.remove());
}

async function fotografa(page, testInfo, nome, { intera = "" } = {}) {
  const cartella = process.env.DM_SCATTI;
  const percorso = cartella
    ? `${cartella}/batterie-${nome}-${testInfo.project.name}.png`
    : testInfo.outputPath(`batterie-${nome}.png`);
  /* La pagina intera: sul telefono scorre dentro la plancia e non il
   * documento, e `fullPage` fotograferebbe solo il primo schermo. Si allunga
   * la finestra fin dove arriva la pagina, e poi la si rimette com'era. */
  const prima = page.viewportSize();
  if (intera) {
    const alta = await page.evaluate((scelta) => {
      const nodo = document.querySelector(scelta);
      return Math.ceil(nodo.getBoundingClientRect().bottom + window.scrollY + 140);
    }, intera);
    await page.setViewportSize({ width: prima.width, height: Math.max(prima.height, alta) });
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: percorso });
  if (intera) await page.setViewportSize(prima);
}

test("la scheda del Config trova i due JK da sola, con le loro celle", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { dichiarati: false });
  /* Senza pacchi dichiarati la linguetta in Energia non c'è. */
  await expect(page.locator('#page-energy [data-dm-energia-vista="accumulo"]')).toBeHidden();

  await page.evaluate(() => window.apriConfigEntita());
  const linguetta = page.locator('#editor-modal .ed-tab[data-tab="accumulo"]');
  await expect(linguetta).toHaveText("Batteria di accumulo");
  await linguetta.click();
  const righe = page.locator('#ed-body [data-dm-dich-sezione="accumulo"] .dm-dich-riga');
  await expect(righe).toHaveCount(2, { timeout: 15_000 });
  await expect(righe.nth(0)).toContainText("Pacco 1");
  await expect(righe.nth(0)).toContainText("JK BMS · 16 celle");
  await expect(righe.nth(1)).toHaveAttribute("data-dm-dich-stato", "male");

  const salvati = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_accumulo")));
  expect(salvati.righe).toHaveLength(2);
  expect(salvati.righe[0]).toMatchObject({
    entity: "sensor.jk_bms_1_state_of_charge",
    name: "Pacco 1",
    tipo: "jk",
    tensione: "sensor.jk_bms_1_total_voltage",
    corrente: "sensor.jk_bms_1_current",
    delta: "sensor.jk_bms_1_delta_cell_voltage",
    mos: "sensor.jk_bms_1_power_tube_temperature",
  });
  expect(salvati.righe[1].celle).toHaveLength(16);
  expect(salvati.righe[1].celle[15]).toBe("sensor.jk_bms_2_cell_voltage_16");

  /* La riga aperta ha una casella per ogni entità del pacco, e le celle in una
   * casella sola. */
  await righe.nth(1).locator("[data-dm-dich-apri]").click();
  const corpo = page.locator('#ed-body [data-dm-dich-indice="1"] .dm-dich-corpo');
  await righe.nth(0).scrollIntoViewIfNeeded();
  await fotografa(page, testInfo, "config");
  await expect(corpo.locator('[data-dm-dich-campo="soglia"]')).toHaveAttribute("placeholder", "30");
  await expect(corpo.locator('[data-dm-dich-campo="celle"]')).toHaveValue(/cell_voltage_1\n/);
  /* «Trova le celle» le rimette tutte, dal prefisso delle altre entità. */
  await corpo.locator('[data-dm-dich-campo="celle"]').fill("");
  await corpo.locator("[data-dm-accu-trova]").click();
  await expect(corpo.locator('[data-dm-dich-campo="celle"]')).toHaveValue(
    /sensor\.jk_bms_2_cell_voltage_1\n[\s\S]*sensor\.jk_bms_2_cell_voltage_16$/,
  );
  await fotografa(page, testInfo, "config-celle");
});

test("la linguetta Batterie in Energia: due pacchi, uno da bilanciare", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await page.locator('.tab[data-tab="energy"]').click();
  const linguetta = page.locator('#page-energy [data-dm-energia-vista="accumulo"]');
  await expect(linguetta).toBeVisible();
  await expect(linguetta).toHaveText(/Batterie/);
  await linguetta.click();

  const vista = page.locator("#view-batterie");
  await expect(vista).toHaveClass(/active/);
  await expect(page.locator("#view-ist")).not.toHaveClass(/active/);
  const testa = vista.locator(".dm-accu-testa");
  await expect(testa.locator("strong")).toHaveText("In carica");
  await expect(testa.locator(".dm-accu-soc")).toHaveText("78%");
  await expect(testa.locator(".dm-accu-nomi")).toContainText("dal fotovoltaico");
  await expect(testa.locator(".dm-accu-nomi")).toContainText("piena fra");
  await expect(testa.locator("[data-dm-accu-avviso]")).toHaveCount(1);
  await expect(testa.locator("[data-dm-accu-avviso]")).toContainText(
    "Pacco 2: celle da bilanciare (Δ 42 mV)",
  );

  const pacchi = vista.locator("[data-dm-accu-pacco]");
  await expect(pacchi).toHaveCount(2);
  await expect(pacchi.nth(0)).toHaveAttribute("data-stato", "bene");
  await expect(pacchi.nth(1)).toHaveAttribute("data-stato", "attenzione");
  await expect(pacchi.nth(1).locator(".dm-pool-badge")).toHaveText("Da bilanciare");
  await expect(pacchi.nth(0).locator(".dm-accu-cella")).toHaveCount(16);
  await expect(pacchi.nth(1).locator('.dm-accu-cella[data-tipo="min"] em')).toHaveText("13");
  await expect(pacchi.nth(1).locator('.dm-accu-cella[data-tipo="max"] em')).toHaveText("8");
  await expect(pacchi.nth(0).locator('[data-dm-accu-dato="corrente"]')).toContainText("in carica");
  await expect(pacchi.nth(0).locator(".dm-pool-card-title")).toContainText("🔋");

  /* Niente esce dal bordo: la pagina non scorre di lato. */
  const largo = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(largo).toBeLessThanOrEqual(1);
  await fotografa(page, testInfo, "energia", { intera: "#view-batterie" });

  /* Un'altra linguetta spegne questa, come fanno fra loro. */
  await page.locator("#page-energy .sub-tab-btn", { hasText: "Istantanea" }).click();
  await expect(vista).not.toHaveClass(/active/);
  await expect(linguetta).not.toHaveClass(/active/);
});

test("la tessera Accumulo in Home chiede attenzione e porta alla linguetta", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await page.locator('.tab[data-tab="home"]').click();
  const tessera = page.locator('#dm-widgets [data-dm-widget="accumulo"]').first();
  await tessera.waitFor({ state: "visible", timeout: 20_000 });
  await expect(tessera.locator("[data-dm-tile-value]")).toContainText("78");
  await expect(tessera.locator("[data-dm-tile-caption]")).toContainText("Pacco 2");
  await tessera.scrollIntoViewIfNeeded();
  await fotografa(page, testInfo, "home");

  await tessera.click();
  await expect(page.locator('#dm-widget-popup [data-dm-widget-detail="accumulo"]')).toBeVisible();
  const vai = page.locator("#dm-widget-popup [data-dm-w-sezione]");
  await expect(vai).toBeVisible();
  await vai.click();
  await expect(page.locator("#page-energy")).toHaveClass(/active/);
  await expect(page.locator("#view-batterie")).toHaveClass(/active/);
  await expect(page.locator('#page-energy [data-dm-energia-vista="accumulo"]')).toHaveClass(
    /active/,
  );
});
