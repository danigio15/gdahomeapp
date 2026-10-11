/* Le finestre degli impianti, disegnate una per una.
 *
 * Scaldabagno, caldaia, UPS, accumulo, acqua e gas, piscina, irrigazione e
 * ventilazione aprivano la finestra generica: il verdetto che contava le
 * righe, «Le misure» a caselle uguali, «Lo stato» a pillole, i comandi in
 * fondo. Qui si apre ogni tessera su una casa seminata e si guarda che la
 * finestra nuova ci sia, coi suoi pezzi: la risposta in grande in cima, i
 * comandi subito sotto, e niente della finestra generica.
 *
 * Con `DM_SCATTI` impostata ogni finestra si fotografa (sul telefono) in
 * quella cartella, come `fatta-<chiave>.png`.
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
    irrigation: {
      zones: [
        { name: "Prato davanti", entity: "switch.zona_prato" },
        { name: "Siepe", entity: "switch.zona_siepe" },
        { name: "Orto", entity: "switch.zona_orto" },
        { name: "Aiuole retro", entity: "switch.zona_aiuole" },
      ],
      soilEnt: "sensor.terreno_umidita",
    },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, ups: true, piscina: true, irrigazione: true, contatori: true },
};

const MINUTI = 60_000;

const CONFIG = {
  cd_scaldabagni: [
    {
      name: "Bagno",
      interruttore: "switch.scaldabagno",
      temperatura: "sensor.scaldabagno_acqua",
      obiettivo: "input_number.scaldabagno_obiettivo",
      potenza: "sensor.scaldabagno_potenza",
      energia: "sensor.scaldabagno_energia",
    },
  ],
  cd_caldaia: {
    fiamma: "binary_sensor.caldaia_fiamma",
    interruttore: "switch.caldaia",
    mandata: "sensor.caldaia_mandata",
    ritorno: "sensor.caldaia_ritorno",
    acquaCalda: "sensor.caldaia_sanitaria",
    pressione: "sensor.caldaia_pressione",
    modulazione: "sensor.caldaia_modulazione",
  },
  cd_ups: [
    {
      name: "Rack",
      rete: "binary_sensor.ups_rete",
      batteria: "sensor.ups_batteria",
      carico: "sensor.ups_carico",
      autonomia: "sensor.ups_autonomia",
      tensione: "sensor.ups_tensione",
      potenza: "sensor.ups_potenza",
      temperatura: "sensor.ups_temperatura",
    },
  ],
  cd_contatori: {
    righe: [
      { entity: "sensor.contatore_acqua", genere: "acqua", name: "Contatore acqua" },
      { entity: "sensor.contatore_gas", genere: "gas", name: "Gas" },
      { entity: "sensor.pressione_acqua", genere: "pressione", name: "Pressione" },
      { entity: "sensor.portata_acqua", genere: "portata", name: "Portata" },
    ],
  },
  cd_accumulo: {
    righe: [1, 2].map((n) => ({
      entity: `sensor.jk_${n}_soc`,
      name: `Pacco ${n}`,
      tipo: "jk",
      soh: `sensor.jk_${n}_soh`,
      corrente: `sensor.jk_${n}_corrente`,
      potenza: `sensor.jk_${n}_potenza`,
      temperatura: `sensor.jk_${n}_temperatura`,
      cicli: `sensor.jk_${n}_cicli`,
      tensione: `sensor.jk_${n}_tensione`,
      capacita: "120",
      unita: "Ah",
      celle: Array.from({ length: 16 }, (_v, i) => `sensor.jk_${n}_cella_${i + 1}`),
    })),
  },
  cd_piscina: {
    tempEnt: "sensor.piscina_acqua",
    phEnt: "sensor.piscina_ph",
    clEnt: "sensor.piscina_cloro",
    pumpEnt: "switch.pool_pump_filter",
    heatEnt: "switch.piscina_riscaldamento",
    lightEnt: "light.piscina",
    clMin: 1,
    clMax: 3,
    phMin: 7.2,
    phMax: 7.6,
  },
  cd_vmc: [
    {
      clima: "fan.vmc",
      esterna: "sensor.vmc_esterna",
      immissione: "sensor.vmc_immissione",
      ripresa: "sensor.vmc_ripresa",
      espulsione: "sensor.vmc_espulsione",
      bypass: "binary_sensor.vmc_bypass",
      estate: "binary_sensor.vmc_estate",
      filtri: "binary_sensor.vmc_filtri",
      ventola_immissione: "sensor.vmc_ventola",
    },
  ],
};

function stati(adesso) {
  const prima = (minuti) => new Date(adesso - minuti * MINUTI).toISOString();
  const s = {};
  const metti = (id, stato, attributi = {}, da = 5) => {
    s[id] = {
      entity_id: id,
      state: String(stato),
      attributes: { friendly_name: id, ...attributi },
      last_changed: prima(da),
      last_updated: prima(da),
    };
  };
  metti("light.salotto", "on");
  // Lo scaldabagno sta scaldando da 47 minuti.
  metti("switch.scaldabagno", "on", {}, 47);
  metti("sensor.scaldabagno_acqua", 41.6, { unit_of_measurement: "°C" });
  metti("input_number.scaldabagno_obiettivo", 55, { min: 30, max: 75, step: 1 });
  metti("sensor.scaldabagno_potenza", 1180, { unit_of_measurement: "W" });
  metti("sensor.scaldabagno_energia", 2.3, { unit_of_measurement: "kWh" });
  // La caldaia scalda la casa.
  metti("binary_sensor.caldaia_fiamma", "on");
  metti("switch.caldaia", "on");
  metti("sensor.caldaia_mandata", 58.4, { unit_of_measurement: "°C" });
  metti("sensor.caldaia_ritorno", 46.9, { unit_of_measurement: "°C" });
  metti("sensor.caldaia_sanitaria", 47.2, { unit_of_measurement: "°C" });
  metti("sensor.caldaia_pressione", 1.4, { unit_of_measurement: "bar" });
  metti("sensor.caldaia_modulazione", 38, { unit_of_measurement: "%" });
  // L'UPS e' in rete da tre giorni.
  metti("binary_sensor.ups_rete", "on", {}, 3 * 24 * 60 + 10);
  metti("sensor.ups_batteria", 100, { unit_of_measurement: "%" });
  metti("sensor.ups_carico", 23, { unit_of_measurement: "%" });
  metti("sensor.ups_autonomia", 42, { unit_of_measurement: "min" });
  metti("sensor.ups_tensione", 231, { unit_of_measurement: "V" });
  metti("sensor.ups_potenza", 138, { unit_of_measurement: "W" });
  metti("sensor.ups_temperatura", 31.5, { unit_of_measurement: "°C" });
  // I contatori, senza lo storico del Recorder: si legge il contatore.
  metti("sensor.contatore_acqua", 412.873, { unit_of_measurement: "m³", device_class: "water" });
  metti("sensor.contatore_gas", 1834.2, { unit_of_measurement: "m³", device_class: "gas" });
  metti("sensor.pressione_acqua", 3.1, { unit_of_measurement: "bar", device_class: "pressure" });
  metti("sensor.portata_acqua", 0, { unit_of_measurement: "L/min" }, 47);
  // Due pacchi JK, il secondo con le celle sbilanciate.
  for (const n of [1, 2]) {
    const soc = n === 1 ? 81 : 75;
    const corrente = n === 1 ? 12.6 : 10.7;
    metti(`sensor.jk_${n}_soc`, soc, { unit_of_measurement: "%" });
    metti(`sensor.jk_${n}_soh`, n === 1 ? 98 : 96, { unit_of_measurement: "%" });
    metti(`sensor.jk_${n}_corrente`, corrente, { unit_of_measurement: "A" });
    metti(`sensor.jk_${n}_potenza`, Math.round(53.3 * corrente), { unit_of_measurement: "W" });
    metti(`sensor.jk_${n}_temperatura`, n === 1 ? 27.1 : 28.3, { unit_of_measurement: "°C" });
    metti(`sensor.jk_${n}_cicli`, n === 1 ? 214 : 238);
    metti(`sensor.jk_${n}_tensione`, 53.3, { unit_of_measurement: "V" });
    for (let i = 1; i <= 16; i++) {
      const volt =
        n === 2 && i === 13 ? 3.303 : n === 2 && i === 8 ? 3.345 : 3.33 + (i % 4) * 0.003;
      metti(`sensor.jk_${n}_cella_${i}`, volt, { unit_of_measurement: "V" });
    }
  }
  metti("dm.energy_potenza_fotovoltaico", 2400, { unit_of_measurement: "W" });
  // La piscina: acqua in ordine, filtrazione accesa.
  metti("sensor.piscina_acqua", 26.8, { unit_of_measurement: "°C" });
  metti("sensor.piscina_ph", 7.3);
  metti("sensor.piscina_cloro", 1.2, { unit_of_measurement: "ppm" });
  metti("switch.pool_pump_filter", "on", { friendly_name: "POOL_PUMP_FILTER" });
  metti("switch.piscina_riscaldamento", "off");
  metti("light.piscina", "off");
  // L'irrigazione: il prato bagna da 7 minuti, il terreno al 34%.
  metti("switch.zona_prato", "on", {}, 7);
  for (const id of ["switch.zona_siepe", "switch.zona_orto", "switch.zona_aiuole"])
    metti(id, "off");
  metti("sensor.terreno_umidita", 34, { unit_of_measurement: "%" });
  // La ventilazione recupera il 77% del calore.
  metti("fan.vmc", "on", { preset_modes: ["low", "medium", "boost"], preset_mode: "medium" });
  metti("sensor.vmc_esterna", 12.4, { unit_of_measurement: "°C" });
  metti("sensor.vmc_immissione", 19.6, { unit_of_measurement: "°C" });
  metti("sensor.vmc_ripresa", 21.8, { unit_of_measurement: "°C" });
  metti("sensor.vmc_espulsione", 14.1, { unit_of_measurement: "°C" });
  metti("binary_sensor.vmc_bypass", "off");
  metti("binary_sensor.vmc_estate", "off");
  metti("binary_sensor.vmc_filtri", "off");
  metti("sensor.vmc_ventola", 1420, { unit_of_measurement: "rpm" });
  return s;
}

async function avvia(page, testInfo) {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate(
    ({ config, seminati }) => {
      for (const [chiave, valore] of Object.entries(config))
        localStorage.setItem(chiave, JSON.stringify(valore));
      const grezzi = eval("_RAW_STATES");
      Object.assign(grezzi, seminati);
      /* I comandi non escono di casa: si contano. */
      window.__comandi = [];
      window.dmCallHaService = (dominio, servizio, dati) => {
        window.__comandi.push({ dominio, servizio, dati });
        return Promise.resolve(true);
      };
      window.applyStates?.();
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { config: CONFIG, seminati: stati(Date.now()) },
  );
  await page.waitForTimeout(1600);
}

async function chiudi(page) {
  await page.locator("#dm-widget-popup [data-dm-widget-close]").first().click();
  await page.waitForTimeout(350);
}

async function apri(page, chiave) {
  const tessera = page.locator(`#dm-widgets .dm-tile[data-dm-widget="${chiave}"]`);
  await tessera.scrollIntoViewIfNeeded();
  await tessera.click();
  const finestra = page.locator(`#dm-widget-popup [data-dm-widget-detail="${chiave}"]`);
  await expect(finestra).toBeVisible();
  await expect(finestra.locator(`.dm-f-${chiave}`)).toBeVisible();
  /* La finestra generica non c'e' piu': niente verdetto, niente «Le misure». */
  await expect(finestra.locator(".dm-w-racconto")).toHaveCount(0);
  return finestra;
}

async function fotografa(page, testInfo, chiave) {
  const cartella = process.env.DM_SCATTI;
  if (!cartella) return;
  /* Le foto del telefono vanno nella cartella; quelle del desktop restano
   * fra i risultati della prova. */
  const percorso =
    testInfo.project.name === "mobile"
      ? `${cartella}/fatta-${chiave}.png`
      : testInfo.outputPath(`fatta-${chiave}.png`);
  /* La finestra intera: il corpo scorre, e si allunga la pagina finche' ci sta. */
  const prima = page.viewportSize();
  const alta = await page.evaluate(() => {
    const corpo = document.querySelector("#dm-widget-popup .dm-w-body");
    const scheda = document.querySelector("#dm-widget-popup .dm-widget-detail");
    if (!corpo || !scheda) return 0;
    return Math.ceil(
      scheda.getBoundingClientRect().height + corpo.scrollHeight - corpo.clientHeight + 160,
    );
  });
  if (alta > prima.height) {
    await page.setViewportSize({ width: prima.width, height: alta });
    await page.waitForTimeout(400);
  }
  await page.locator("#dm-widget-popup .dm-widget-detail").screenshot({ path: percorso });
  await page.setViewportSize(prima);
}

test("le finestre degli impianti: la risposta in cima, i comandi sotto", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);

  // Lo scaldabagno: il serbatoio, la resistenza e l'obiettivo coi tasti.
  let finestra = await apri(page, "scaldabagno");
  await expect(finestra.locator(".dm-f-scaldabagno-serbatoio")).toBeVisible();
  await expect(finestra.locator(".dm-f-imp-grande")).toHaveText("41,6°");
  await expect(finestra.locator('[data-dm-w-light="switch.scaldabagno"]')).toBeVisible();
  await expect(finestra).toContainText("scalda da 47 minuti");
  await fotografa(page, testInfo, "scaldabagno");
  await finestra.locator('[data-dm-f-obiettivo="su"]').click();
  await expect
    .poll(() => page.evaluate(() => window.__comandi.at(-1)))
    .toMatchObject({
      dominio: "input_number",
      servizio: "set_value",
      dati: { entity_id: "input_number.scaldabagno_obiettivo", value: 56 },
    });
  await chiudi(page);

  // La caldaia: il giro mandata/ritorno e l'interruttore.
  finestra = await apri(page, "caldaia");
  await expect(finestra.locator(".dm-f-caldaia-giro")).toContainText("58,4°");
  await expect(finestra.locator(".dm-f-caldaia-giro")).toContainText("46,9°");
  await expect(finestra.locator('[data-dm-w-light="switch.caldaia"]')).toBeVisible();
  await expect(finestra.locator('[data-dm-f-casella="pressione"]')).toContainText("nella norma");
  await fotografa(page, testInfo, "caldaia");
  await chiudi(page);

  // L'UPS: la corrente c'e', e quanto regge se va via.
  finestra = await apri(page, "ups");
  await expect(finestra.locator(".dm-f-ups-eroe")).toContainText("Corrente presente");
  await expect(finestra.locator(".dm-f-ups-autonomia")).toHaveText("42 min");
  await expect(finestra.locator('[data-dm-f-casella="carico"]')).toContainText("138 W");
  await fotografa(page, testInfo, "ups");
  await chiudi(page);

  // L'accumulo: un pacco per scheda, e l'avviso solo per il secondo.
  finestra = await apri(page, "accumulo");
  await expect(finestra.locator(".dm-f-accumulo-pacco")).toHaveCount(2);
  await expect(finestra.locator("[data-dm-f-avviso]")).toHaveCount(1);
  await expect(finestra.locator("[data-dm-f-avviso]")).toContainText("Pacco 2");
  await fotografa(page, testInfo, "accumulo");
  await chiudi(page);

  // Acqua e gas: senza storico la lettura del contatore, non un trattino.
  await expect(
    page.locator('#dm-widgets .dm-tile[data-dm-widget="contatori"] [data-dm-tile-value]'),
  ).not.toHaveText("—");
  finestra = await apri(page, "contatori");
  await expect(finestra.locator("[data-dm-f-oggi]")).toContainText("412,873");
  await expect(finestra.locator('[data-dm-f-casella="pressione"]')).toContainText("3,1 bar");
  await expect(finestra.locator(".dm-f-contatori-letture")).toContainText("1.834,2");
  await fotografa(page, testInfo, "contatori");
  await chiudi(page);

  // La piscina: la chimica con la fascia, i comandi coi nomi umani.
  finestra = await apri(page, "piscina");
  await expect(finestra.locator('[data-dm-f-chimica="ph"]')).toHaveAttribute("data-bene", "true");
  await expect(finestra.locator(".dm-f-imp-tasti")).toContainText("Filtrazione");
  await expect(finestra).not.toContainText("POOL_PUMP_FILTER");
  await expect(finestra.locator("[data-dm-w-light]")).toHaveCount(3);
  await fotografa(page, testInfo, "piscina");
  await chiudi(page);

  // L'irrigazione: quattro zone (il sensore non e' una zona) e il tasto per fermarla.
  finestra = await apri(page, "irrigazione");
  await expect(finestra.locator("[data-dm-f-zone] .dm-f-irrigazione-zona")).toHaveCount(4);
  await expect(finestra.locator(".dm-f-irrigazione-zona").first()).toContainText("Prato davanti");
  await expect(finestra.locator('[data-dm-f-casella="terreno"]')).toContainText("34%");
  await fotografa(page, testInfo, "irrigazione");
  await finestra.locator('[data-dm-f-ferma="irrigazione"]').click();
  await expect
    .poll(() => page.evaluate(() => window.__comandi.at(-1)))
    .toMatchObject({ dominio: "switch", servizio: "turn_off" });
  await chiudi(page);

  // La ventilazione: il recupero, i due flussi, la velocita' a tasti.
  finestra = await apri(page, "vmc");
  await expect(finestra.locator(".dm-f-imp-grande")).toHaveText("77%");
  await expect(finestra.locator('[data-dm-f-temperatura="immissione"]')).toContainText("19,6°");
  await expect(finestra.locator(".dm-f-vmc-modo")).toHaveCount(3);
  await expect(finestra.locator('.dm-f-vmc-modo[data-on="true"]')).toContainText("Normale");
  await fotografa(page, testInfo, "vmc");

  /* Niente esce dalla finestra di traverso, sul telefono come sul desktop. */
  const largo = await page.evaluate(() => {
    const corpo = document.querySelector("#dm-widget-popup .dm-w-body");
    return corpo.scrollWidth - corpo.clientWidth;
  });
  expect(largo).toBeLessThanOrEqual(1);
});
