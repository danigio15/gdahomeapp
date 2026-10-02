/* La cottura, dentro gli Elettrodomestici (#71).
 *
 * «Mi piacerebbe pilotare la mia friggitrice ad aria della Philips.» La
 * friggitrice sta cuocendo le patatine con l'integrazione `philips_airfryer`
 * da HACS: i tempi in secondi, i comandi soltanto come servizi. In Home c'e'
 * la sua tessera, e toccarla porta agli Elettrodomestici, sulla voce Cottura:
 * la risposta grande, l'anello, i gradi col − e il +, e i tasti che premono i
 * servizi giusti. Poi finisce, e la tessera dice «Pronta».
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Se c'e' dove metterle, le fotografie delle schermate. */
const SCATTI = process.env.COTTURA_SCATTI || "";
/* Nelle fotografie della pagina intera, la barra e la bolla della chat che
 * galleggiano sopra si tolgono: coprirebbero proprio quello che si guarda. */
const SENZA_GALLEGGIANTI =
  "nav.tabs,.bottom-nav-bar,#bottomNavHandle,[class*='chat-fab'],[class*='assist-fab'],[id*='chat-fab']{visibility:hidden!important}";

const ADESSO = new Date().toISOString();
const st = (entity_id, state, attributes = {}) => ({
  entity_id,
  state,
  attributes,
  last_changed: ADESSO,
  last_updated: ADESSO,
});

const STATI = [
  st("sensor.philips_airfryer_status", "cooking", { friendly_name: "Airfryer Status" }),
  st("sensor.philips_airfryer_temp", "180", {
    unit_of_measurement: "°C",
    device_class: "temperature",
  }),
  st("sensor.philips_airfryer_total_time", "900", { unit_of_measurement: "s" }),
  st("sensor.philips_airfryer_time_remaining", "452", { unit_of_measurement: "s" }),
  st("sensor.philips_airfryer_dialog", "patatine"),
  st("binary_sensor.philips_airfryer_drawer_open", "off", { device_class: "door" }),
  st("sensor.forno_temperatura", "24", { unit_of_measurement: "°C" }),
  st("switch.forno", "off", { friendly_name: "Forno" }),
  st("switch.piano_cottura", "off", { friendly_name: "Piano cottura" }),
];

const FRIGGITRICE = {
  id: "a-frig",
  name: "Friggitrice",
  icon: "friggitrice",
  visual_key: "friggitrice",
  device_type: "friggitrice",
  visual_type: "asset",
  room_id: "room-cucina",
  integration: "philips_airfryer",
  integration_name: "Philips Airfryer",
  state_entity: "sensor.philips_airfryer_status",
  remaining_entity: "sensor.philips_airfryer_time_remaining",
  cycle_duration_entity: "sensor.philips_airfryer_total_time",
  cottura_programma: "sensor.philips_airfryer_dialog",
  cottura_temperatura: "sensor.philips_airfryer_temp",
  cottura_cassetto: "binary_sensor.philips_airfryer_drawer_open",
  cottura_pausa: "philips_airfryer.pause",
  cottura_riprendi: "philips_airfryer.start_resume",
  cottura_stop: "philips_airfryer.stop",
  cottura_piu_un_minuto: "philips_airfryer.adjust_time time=60 method=add",
  cottura_piu_caldo: "philips_airfryer.adjust_temp temp=5 method=add",
  cottura_meno_caldo: "philips_airfryer.adjust_temp temp=5 method=subtract",
  entities: ["sensor.philips_airfryer_status"],
  metadata: { dm_campi_scelti: true },
};

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-cucina", name: "Cucina", icon: "mdi:countertop" }],
    appliances: [
      FRIGGITRICE,
      {
        id: "a-forno",
        name: "Forno",
        icon: "forno",
        visual_key: "forno",
        device_type: "forno",
        visual_type: "asset",
        room_id: "room-cucina",
        control_entity: "switch.forno",
        cottura_temperatura: "sensor.forno_temperatura",
        entities: ["switch.forno"],
        metadata: { dm_campi_scelti: true },
      },
      {
        id: "a-piano",
        name: "Piano cottura",
        icon: "piano_cottura",
        visual_key: "piano_cottura",
        device_type: "piano_cottura",
        visual_type: "asset",
        room_id: "room-cucina",
        control_entity: "switch.piano_cottura",
        entities: ["switch.piano_cottura"],
        metadata: { dm_campi_scelti: true },
      },
    ],
    loads: [],
  },
  visibility: { home: true, appliances: true },
};

async function accendi(page, testInfo, seme = SEME) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((haStates) => {
    class MockSocket extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      onopen = null;
      onmessage = null;
      onclose = null;
      onerror = null;
      constructor() {
        super();
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(raw) {
        const m = JSON.parse(raw);
        if (m.type === "auth") return;
        let result = null;
        if (m.type === "get_states") result = haStates;
        else if (m.type === "frontend/get_user_data") result = { value: null };
        else if (m.type === "dashboardmodern/integrations/catalog")
          result = { integrations: [], devices: [], entities: [] };
        this.onmessage?.({
          data: JSON.stringify({ id: m.id, type: "result", success: true, result }),
        });
      }
      close() {
        this.onclose?.({});
      }
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
    window.WebSocket = MockSocket;
  }, STATI);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((x) => x.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await cambia(page, STATI);
  /* Le chiamate a Home Assistant si guardano e non partono. */
  await page.evaluate(() => {
    window.__CHIAMATE__ = [];
    window.dmCallHaService = (dominio, servizio, dati) => {
      window.__CHIAMATE__.push([dominio, servizio, dati]);
      return Promise.resolve();
    };
  });
}

/* Scrive gli stati come li scriverebbe Home Assistant, e lo dice. */
async function cambia(page, stati) {
  await page.evaluate((elenco) => {
    const adesso = new Date().toISOString();
    for (const voce of elenco) {
      const nuovo = { ...structuredClone(voce), last_changed: adesso, last_updated: adesso };
      _RAW_STATES[voce.entity_id] = nuovo;
      STATES[voce.entity_id] = structuredClone(nuovo);
    }
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  }, stati);
}

async function apriLaCottura(page) {
  const tessera = page.locator('#dm-widgets [data-dm-widget="cottura"]');
  await expect(tessera).toBeVisible({ timeout: 15_000 });
  await tessera.click();
  const pagina = page.locator("#page-appliances-main");
  await expect(pagina).toHaveClass(/active/);
  const cottura = pagina.locator("[data-dm-cottura]");
  await expect(cottura).toBeVisible();
  return cottura;
}

test("la tessera dice quanto manca, e porta alla Cottura dentro gli Elettrodomestici", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await accendi(page, testInfo);
  const tessera = page.locator('#dm-widgets [data-dm-widget="cottura"]');
  await expect(tessera).toBeVisible({ timeout: 15_000 });
  await expect(tessera.locator("[data-dm-tile-label]")).toHaveText("Friggitrice");
  await expect(tessera.locator("[data-dm-tile-value]")).toHaveText("8");
  await expect(tessera.locator("[data-dm-tile-caption]")).toContainText("Pronta fra 8 min");
  await expect(tessera.locator("[data-dm-tile-caption]")).toContainText("180 °C");
  await expect(tessera.locator("[data-dm-tile-caption]")).toContainText("Patatine");
  if (SCATTI)
    await tessera.screenshot({ path: `${SCATTI}/cottura-tessera-${testInfo.project.name}.png` });

  const cottura = await apriLaCottura(page);
  /* La voce accanto a Panoramica e' accesa, e dice quanti cuociono. */
  const voce = page.locator("#page-appliances-main [data-dm-side-cottura]");
  await expect(voce).toHaveClass(/active/);
  await expect(voce.locator("[data-dm-cottura-conto]")).toHaveText("1");
  await expect(page.locator("#page-appliances-main #appl-grid-overview")).toBeHidden();

  const testa = cottura.locator("[data-dm-cot-testa]");
  await expect(testa).toContainText("Pronta fra 8 min");
  await expect(testa).toContainText("Friggitrice · Patatine · 180 °C · alle");
  await expect(testa).toContainText("Forno e Piano cottura spenti");

  const scheda = cottura.locator('[data-dm-cot-scheda="a-frig"]');
  await expect(scheda.locator(".dm-cot-fase")).toHaveText(/In cottura/i);
  await expect(scheda.locator(".dm-cot-ring b")).toHaveText(/^7:[0-5]\d$/);
  await expect(scheda.locator(".dm-cot-ring i")).toHaveText("di 15 min");
  await expect(scheda.locator("[data-dm-cot-programma]")).toHaveText("Patatine");
  await expect(scheda.locator("[data-dm-cot-cassetto]")).toHaveText("Cassetto chiuso");
  await expect(scheda.locator(".dm-cot-nota")).toContainText(
    /Pronta alle \d\d:\d\d · avviata alle/,
  );
  await expect(scheda.locator("[data-dm-cot-gradi]")).toContainText("180");
  /* In cottura: Pausa, +1 min, Stop, − e +. Riprendi no. */
  await expect(scheda.locator('[data-dm-cot-comando="pausa"]')).toBeVisible();
  await expect(scheda.locator('[data-dm-cot-comando="piu_un_minuto"]')).toBeVisible();
  await expect(scheda.locator('[data-dm-cot-comando="stop"]')).toBeVisible();
  await expect(scheda.locator('[data-dm-cot-comando="riprendi"]')).toHaveCount(0);
  await expect(scheda.locator('[data-dm-cot-comando="piu_caldo"]')).toBeVisible();

  /* Gli altri in cucina, una riga ciascuno, col loro disegno. */
  await expect(cottura.locator("[data-dm-cot-altro]")).toHaveCount(2);
  await expect(cottura.locator('[data-dm-cot-altro="a-forno"]')).toContainText("dentro 24 °C");
  await expect(cottura.locator('[data-dm-cot-altro="a-forno"] .dm-appliance-art')).toHaveCount(1);

  /* L'anello scende da solo, senza che Home Assistant dica niente. */
  const primo = await scheda.locator(".dm-cot-ring b").textContent();
  await expect
    .poll(() => scheda.locator(".dm-cot-ring b").textContent(), { timeout: 4000 })
    .not.toBe(primo);

  if (SCATTI) {
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SCATTI}/cottura-${testInfo.project.name}.png` });
    await cottura.screenshot({
      path: `${SCATTI}/cottura-pagina-${testInfo.project.name}.png`,
      style: SENZA_GALLEGGIANTI,
    });
  }

  /* E Panoramica torna alle schede. */
  await page.locator("#page-appliances-main [data-dm-side-overview]").first().click();
  await expect(page.locator("#page-appliances-main #appl-grid-overview")).toBeVisible();
  await expect(cottura).toBeHidden();
});

test("pausa, riprendi, un minuto in piu' e stop chiamano i servizi della friggitrice", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await accendi(page, testInfo);
  const cottura = await apriLaCottura(page);
  const scheda = cottura.locator('[data-dm-cot-scheda="a-frig"]');
  const bersaglio = { entity_id: "sensor.philips_airfryer_status" };

  await scheda.locator('[data-dm-cot-comando="pausa"]').click();
  await expect
    .poll(() => page.evaluate(() => window.__CHIAMATE__))
    .toEqual([["philips_airfryer", "pause", bersaglio]]);

  await scheda.locator('[data-dm-cot-comando="piu_un_minuto"]').click();
  await scheda.locator('[data-dm-cot-comando="meno_caldo"]').click();
  await expect
    .poll(() => page.evaluate(() => window.__CHIAMATE__.slice(1)))
    .toEqual([
      ["philips_airfryer", "adjust_time", { time: 60, method: "add", ...bersaglio }],
      ["philips_airfryer", "adjust_temp", { temp: 5, method: "subtract", ...bersaglio }],
    ]);

  /* La friggitrice si ferma: la Pausa diventa Riprendi, e il tempo si ferma. */
  await cambia(page, [st("sensor.philips_airfryer_status", "pause")]);
  await expect(scheda.locator(".dm-cot-fase")).toHaveText(/In pausa/i);
  await expect(scheda.locator('[data-dm-cot-comando="pausa"]')).toHaveCount(0);
  await scheda.locator('[data-dm-cot-comando="riprendi"]').click();
  await expect
    .poll(() => page.evaluate(() => window.__CHIAMATE__.at(-1)))
    .toEqual(["philips_airfryer", "start_resume", bersaglio]);

  await scheda.locator('[data-dm-cot-comando="stop"]').click();
  await expect
    .poll(() => page.evaluate(() => window.__CHIAMATE__.at(-1)))
    .toEqual(["philips_airfryer", "stop", bersaglio]);
});

test("finita, la tessera dice «Pronta» in verde e la Cottura lo dice in cima", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await accendi(page, testInfo);
  const tessera = page.locator('#dm-widgets [data-dm-widget="cottura"]');
  await expect(tessera).toBeVisible({ timeout: 15_000 });
  /* Gli avvisi a finestra sono una scelta di chi abita la casa: qui accesa. */
  await page.evaluate(() =>
    localStorage.setItem("cd_widgets", JSON.stringify({ avvisiInPopup: true })),
  );
  await cambia(page, [
    st("sensor.philips_airfryer_status", "finish"),
    st("sensor.philips_airfryer_time_remaining", "0", { unit_of_measurement: "s" }),
  ]);
  await expect(tessera.locator("[data-dm-tile-value]")).toHaveText("Pronta");
  await expect(tessera.locator("[data-dm-tile-caption]")).toContainText("Patatine · fine alle");
  await expect(tessera).toHaveAttribute("style", /#16a34a/);
  /* La fine apre da sola la finestra della tessera, come un avviso
   * personalizzato: una volta, quando succede. */
  const finestra = page.locator('#dm-widget-popup [data-dm-widget-detail="cottura"]');
  await expect(finestra).toBeVisible();
  await expect(finestra).toContainText("Patatine");
  await page.keyboard.press("Escape");
  await expect(finestra).toHaveCount(0);
  if (SCATTI)
    await tessera.screenshot({
      path: `${SCATTI}/cottura-tessera-pronta-${testInfo.project.name}.png`,
    });
  const cottura = await apriLaCottura(page);
  await expect(cottura.locator("[data-dm-cot-testa]")).toContainText("Pronta");
  await expect(cottura.locator('[data-dm-cot-scheda="a-frig"] .dm-cot-fase')).toHaveText(/Pronta/i);
  /* Finita, i tasti della cottura non servono piu'. */
  await expect(cottura.locator("[data-dm-cot-comando]")).toHaveCount(0);
  if (SCATTI)
    await cottura.screenshot({
      path: `${SCATTI}/cottura-pronta-${testInfo.project.name}.png`,
      style: SENZA_GALLEGGIANTI,
    });
});

test("nel Config la friggitrice compila da sola le caselle della Cottura", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  /* La stessa friggitrice, ma senza nessuna casella della cottura scritta. */
  const nuda = Object.fromEntries(
    Object.entries(FRIGGITRICE).filter(([chiave]) => !chiave.startsWith("cottura_")),
  );
  await accendi(page, testInfo, {
    ...SEME,
    sections: { ...SEME.sections, appliances: [nuda, ...SEME.sections.appliances.slice(1)] },
  });
  await page.evaluate(() => {
    window.apriConfigEntita();
    window.editorSwitch("appliances");
    window.edApplEdit(0);
  });
  const modulo = page.locator("#dm-appliance-editor-modal");
  await expect(modulo).toBeVisible({ timeout: 20_000 });
  const cottura = modulo.locator("[data-appl-cottura]");
  await expect(cottura).toBeVisible();
  /* Il piede della scheda sta fermo in basso: la fascia si apre e si porta in
   * cima, come farebbe il dito scorrendo. */
  await cottura.evaluate((nodo) => {
    nodo.open = true;
    nodo.scrollIntoView({ block: "start" });
  });
  await expect(cottura.locator("[data-appl-cottura-anteprima]")).toContainText("Nessun tasto");

  await cottura.locator("[data-appl-cottura-cerca]").dispatchEvent("click");
  await expect(cottura.locator('input[name="cottura_pausa"]')).toHaveValue(
    "philips_airfryer.pause",
  );
  await expect(cottura.locator('input[name="cottura_piu_un_minuto"]')).toHaveValue(
    "philips_airfryer.adjust_time time=60 method=add",
  );
  await expect(cottura.locator('input[name="cottura_programma"]')).toHaveValue(
    "sensor.philips_airfryer_dialog",
  );
  await expect(cottura.locator("[data-appl-cottura-anteprima]")).toContainText(
    "Pausa · Riprendi · Stop · +1 min · Più caldo · Meno caldo",
  );
  if (SCATTI) {
    await cottura.evaluate((nodo) => nodo.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: `${SCATTI}/cottura-config-${testInfo.project.name}.png` });
  }

  /* Un forno non e' in cucina per sbaglio: la lavatrice invece la Cottura non
   * ce l'ha, e cambiando tipo la fascia sparisce. */
  await modulo.locator("button[type=submit]").click();
  await expect(modulo).toHaveCount(0, { timeout: 20_000 });
  const salvata = await page.evaluate(() => {
    const stato = JSON.parse(window.localStorage.getItem("dm_dashboard_state") || "{}");
    return stato?.sections?.appliances?.[0] || null;
  });
  expect(salvata.cottura_stop).toBe("philips_airfryer.stop");
  expect(salvata.cottura_bersaglio).toBe("sensor.philips_airfryer_status");
});
