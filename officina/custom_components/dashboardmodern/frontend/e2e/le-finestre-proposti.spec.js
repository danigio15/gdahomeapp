/* Le finestre nuove di Energia, Temperatura, Auto e Solare termico.
 *
 * Le quattro tessere aprivano la finestra generica — «Le misure» a caselle
 * tutte uguali, coi nomi grezzi delle integrazioni. Adesso ognuna ha la sua,
 * come nelle bozze approvate: qui si apre ogni tessera su una casa verosimile
 * e si guarda che ci sia la finestra nuova, coi pezzi che contano e senza i
 * nomi grezzi.
 *
 * Con `DM_FOTO=<cartella>` la prova lascia anche la fotografia di ogni
 * finestra aperta, per confrontarla con la bozza.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const MAPPA = {
  "dm.ev_batteria_auto": "sensor.leapmotor_b10_soc",
  "dm.ev_autonomia": "sensor.leapmotor_b10_range",
  "dm.ev_stato_ricarica": "sensor.wallbox_stato",
  "dm.ev_potenza_ricarica": "sensor.wallbox_potenza_carica",
  "dm.ev_target_soc": "number.leapmotor_b10_target",
  "dm.ev_posizione": "device_tracker.leapmotor_b10",
  "dm.ev_odometro": "sensor.leapmotor_b10_odometer",
  "dm.ev_km_dall_ultima_ricarica": "sensor.km_dall_ultima_carica",
  "dm.ev_finestrini": "sensor.leapmotor_b10_window_front",
  "dm.ev_pneumatico_ant_sx": "sensor.leapmotor_b10_tire_fl",
  "dm.ev_pneumatico_ant_dx": "sensor.leapmotor_b10_tire_fr",
  "dm.ev_pneumatico_post_sx": "sensor.leapmotor_b10_tire_rl",
  "dm.ev_pneumatico_post_dx": "sensor.leapmotor_b10_tire_rr",
  "dm.boiler_sonda_temperatura_1": "sensor.temperatura_pannello_solare",
  "dm.boiler_sonda_temperatura_3": "sensor.temperatura_boiler",
  "dm.boiler_delta_temperatura": "sensor.delta_solare_termico_boiler",
  "dm.boiler_pressione_acqua": "sensor.pressione_acqua",
  "dm.boiler_potenza_resistenza_boiler": "sensor.boiler_potenza",
  "dm.boiler_interruttore_boiler": "switch.boiler",
  "dm.boiler_stato_pompa_solare": "binary_sensor.pompa_solare",
  "dm.boiler_valvola_di_sicurezza": "cover.valvola_di_sicurezza",
};

const ORA_FA = new Date(Date.now() - 2 * 3600_000).toISOString();

/* entity → [stato, unita', nome] */
const VALORI = {
  "sensor.casa_w": ["256", "W", "Casa"],
  "sensor.rete_w": ["12", "W", "Rete"],
  "sensor.fv_w": ["523", "W", "Fotovoltaico"],
  "sensor.batteria_w": ["146", "W", "Batteria"],
  "sensor.batteria_soc": ["20", "%", "Stato di carica"],
  "sensor.casa_oggi": ["1.9", "kWh", "Casa oggi"],
  "sensor.fv_oggi": ["4.2", "kWh", "Produzione oggi"],
  "sensor.rete_presa_oggi": ["2.2", "kWh", "Prelievo oggi"],
  "sensor.rete_data_oggi": ["0.4", "kWh", "Immissione oggi"],
  "sensor.lavanderia_temperature": ["25.5", "°C", "Lavanderia"],
  "sensor.lavanderia_humidity": ["61", "%", "Lavanderia umidità"],
  "sensor.camera_temperature": ["24.3", "°C", "Camera"],
  "sensor.camera_humidity": ["64", "%", "Camera umidità"],
  "sensor.locale_tecnico_temperature": ["18.4", "°C", "Locale tecnico"],
  "sensor.locale_tecnico_humidity": ["74", "%", "Locale tecnico umidità"],
  "sensor.leapmotor_b10_soc": ["32", "%", "LEAPMOTOR B10 SOC"],
  "sensor.leapmotor_b10_range": ["138", "km", "LEAPMOTOR B10 RANGE"],
  "sensor.wallbox_stato": ["charging", "", "Wallbox stato"],
  "sensor.wallbox_potenza_carica": ["7.2", "kW", "Wallbox potenza carica"],
  "number.leapmotor_b10_target": ["80", "%", "LEAPMOTOR B10 TARGET"],
  "device_tracker.leapmotor_b10": ["home", "", "LEAPMOTOR B10 LOCATION"],
  "sensor.leapmotor_b10_odometer": ["9019", "km", "LEAPMOTOR B10 ODOMETER"],
  "sensor.km_dall_ultima_carica": ["647", "km", "km percorsi dall'ultima ricarica"],
  "sensor.leapmotor_b10_window_front": ["0", "%", "LEAPMOTOR B10 WINDOW FRONT"],
  "sensor.leapmotor_b10_tire_fl": ["2.2", "bar", "LEAPMOTOR B10 TIRE FL"],
  "sensor.leapmotor_b10_tire_fr": ["2.3", "bar", "LEAPMOTOR B10 TIRE FR"],
  "sensor.leapmotor_b10_tire_rl": ["2.3", "bar", "LEAPMOTOR B10 TIRE RL"],
  "sensor.leapmotor_b10_tire_rr": ["2.3", "bar", "LEAPMOTOR B10 TIRE RR"],
  "sensor.temperatura_pannello_solare": ["17.1", "°C", "Temperatura Pannello Solare"],
  "sensor.temperatura_boiler": ["37.5", "°C", "Temperatura Boiler"],
  "sensor.delta_solare_termico_boiler": ["-21", "°C", "BOILER_OFFSET"],
  "sensor.pressione_acqua": ["2.5", "bar", "Pressione acqua"],
  "sensor.boiler_potenza": ["0", "W", "Boiler potenza"],
  "switch.boiler": ["on", "", "Boiler"],
  "binary_sensor.pompa_solare": ["off", "", "Solare Termico"],
  "cover.valvola_di_sicurezza": ["closed", "", "Valvola di Sicurezza"],
};

const AUTO = [{ id: "b10", uid: "b10", name: "Leapmotor B10", tipo: "", ov: { ...MAPPA } }];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "lavanderia",
        name: "Lavanderia",
        icon: "🧺",
        temp: "sensor.lavanderia_temperature",
      },
      { id: "camera", name: "Camera da letto", icon: "🛏️", temp: "sensor.camera_temperature" },
      {
        id: "tecnico",
        name: "Locale tecnico",
        icon: "🔧",
        temp: "sensor.locale_tecnico_temperature",
      },
    ],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: AUTO,
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {
      house: { power: "sensor.casa_w", daily_energy: "sensor.casa_oggi" },
      grid: {
        power: "sensor.rete_w",
        daily_import_energy: "sensor.rete_presa_oggi",
        daily_export_energy: "sensor.rete_data_oggi",
      },
      solar: { power: "sensor.fv_w", daily_energy: "sensor.fv_oggi" },
      battery: { power: "sensor.batteria_w", soc: "sensor.batteria_soc" },
    },
    entityOverrides: { ...MAPPA },
  },
  visibility: { home: true, energy: true, ev: true, boiler: true, temp: true },
};

async function avvia(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    ({ mappa, auto }) => {
      localStorage.setItem("cd_entity_overrides", JSON.stringify(mappa));
      localStorage.setItem("cd_ev_cars", JSON.stringify(auto));
      localStorage.setItem("cd_ev_car_active", "0");
      window.cdApplyCanonicalOverrides?.(mappa);
    },
    { mappa: MAPPA, auto: AUTO },
  );
  await page.evaluate(
    ({ valori, oraFa }) => {
      for (const [entity, [state, unita, nome]] of Object.entries(valori)) {
        const voce = {
          entity_id: entity,
          state,
          last_changed: oraFa,
          last_updated: oraFa,
          attributes: {
            friendly_name: nome,
            ...(unita ? { unit_of_measurement: unita } : {}),
          },
        };
        _RAW_STATES[entity] = structuredClone(voce);
        STATES[entity] = structuredClone(voce);
      }
      window.render?.();
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
    },
    { valori: VALORI, oraFa: ORA_FA },
  );
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
}

async function apri(page, chiave) {
  const tessera = page.locator(`#dm-widgets .dm-tile[data-dm-widget="${chiave}"]`);
  await expect(tessera).toHaveCount(1, { timeout: 15_000 });
  await tessera.click();
  const finestra = page.locator(`#dm-widget-popup .dm-f-${chiave}`);
  await expect(finestra).toBeVisible();
  return finestra;
}

async function fotografa(page, chiave, testInfo) {
  const cartella = process.env.DM_FOTO;
  if (!cartella) return;
  const nome = testInfo.project.name === "mobile" ? chiave : `${chiave}-${testInfo.project.name}`;
  await page.waitForTimeout(400);
  /* Tutta la finestra, non solo quello che sta nello schermo: il corpo si
   * srotola per la fotografia. */
  await page.addStyleTag({
    content:
      "#dm-widget-popup,#dm-widget-popup *{max-height:none!important}#dm-widget-popup .dm-w-body{overflow:visible!important}",
  });
  await page.waitForTimeout(200);
  const scheda = page.locator("#dm-widget-popup .dm-widget-detail");
  await scheda.screenshot({ path: `${cartella}/fatta-${nome}.png` });
}

const testo = (locator) => locator.evaluate((nodo) => nodo.textContent.replace(/\s+/g, " "));

test("Energia: la casa adesso, da dove arriva, le fonti e l'autoconsumo vero", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  const finestra = await apri(page, "energia");
  await expect(finestra.locator(".dm-f-energia-eroe")).toContainText("256 W");
  await expect(finestra.locator(".dm-f-energia-barra i").first()).toBeVisible();
  await expect(finestra.locator(".dm-f-energia-fonte")).toHaveCount(3);
  /* Produzione 4,2 e immissione 0,4: il 90% del sole e' rimasto in casa. */
  await expect(finestra.locator(".dm-f-energia-giorno")).toContainText("90%");
  /* Nessun prezzo scritto: niente spesa inventata. */
  await expect(finestra).not.toContainText(/Spesa stimata|Estimated cost/);
  /* E la finestra generica non c'e' piu'. */
  await expect(page.locator("#dm-widget-popup .dm-w-casella")).toHaveCount(0);
  await fotografa(page, "energia", testInfo);
});

test("Temperatura: la media in cima e le stanze dalla piu' calda", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  const finestra = await apri(page, "temperatura");
  const nomi = await finestra
    .locator(".dm-f-temperatura-nome b")
    .evaluateAll((nodi) => nodi.map((n) => n.textContent.trim()));
  expect(nomi).toEqual(["Lavanderia", "Camera da letto", "Locale tecnico"]);
  await expect(finestra.locator(".dm-f-temperatura-um[data-alta='true']")).toHaveCount(1);
  await fotografa(page, "temperatura", testInfo);
});

test("Auto: anello, posizione, chilometri e le quattro gomme, senza nomi grezzi", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  const finestra = await apri(page, "ev");
  await expect(finestra.locator(".dm-f-ev-anello")).toContainText("32%");
  await expect(finestra.locator(".dm-f-ev-dx")).toContainText("138 km");
  await expect(finestra.locator(".dm-f-ev-chip")).toContainText("7,2 kW");
  await expect(finestra.locator(".dm-f-ev-g .dm-f-num")).toHaveCount(4);
  const tutto = await testo(finestra);
  expect(tutto).not.toMatch(/TIRE|WINDOW|ODOMETER|LEAPMOTOR B10 /);
  expect(tutto).toMatch(/9019|9\.019/);
  await fotografa(page, "ev", testInfo);
});

test("Solare termico: pannello e boiler, la frase, lo stato coi nomi dei tasti", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  const finestra = await apri(page, "solare");
  await expect(finestra.locator(".dm-f-solare-nodo")).toHaveCount(2);
  await expect(finestra.locator(".dm-f-solare-frase")).toBeVisible();
  const tutto = await testo(finestra);
  expect(tutto).not.toMatch(/BOILER_OFFSET|obiettivo|Delta acceso/i);
  await expect(finestra.locator(".dm-f-solare-st")).toHaveCount(3);
  await expect(finestra.locator(".dm-f-solare-st[data-on='true']")).toContainText(/Boiler/);
  await fotografa(page, "solare", testInfo);
});
