/* Le finestre del gruppo «sistema», in una plancia vera.
 *
 * Una casa con la lavatrice e la friggitrice accese, il mini PC, il NAS fermo,
 * le cose in evidenza, una sezione propria per il serbatoio sul tetto, la coda
 * delle segnalazioni e una risposta dell'assistenza. Si tocca ogni tessera e
 * si guarda che si apra la sua finestra disegnata — non quella generica, con
 * il verdetto e «Le misure» — e che i comandi ci siano.
 *
 * Con LE_FINESTRE_FOTO si fotografa ogni finestra in quella cartella.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const FOTO = process.env.LE_FINESTRE_FOTO || "";

const st = (entity_id, state, attributes = {}, minutiFa = 0) => {
  const quando = new Date(Date.now() - minutiFa * 60000).toISOString();
  return { entity_id, state, attributes, last_changed: quando, last_updated: quando };
};
const n = (entity_id, state, unit, extra = {}, minutiFa = 0) =>
  st(entity_id, state, { unit_of_measurement: unit, ...extra }, minutiFa);

const STATI = [
  /* La lavatrice e la lavastoviglie, con l'integrazione. */
  st("sensor.lavatrice_machine_status", "running", { friendly_name: "Lavatrice Stato" }),
  st("sensor.lavatrice_fase", "washing", { friendly_name: "Lavatrice Fase" }),
  n("sensor.lavatrice_tempo_rimanente", "50", "min", { friendly_name: "Lavatrice Tempo" }),
  n("sensor.lavatrice_temperatura", "40", "°C", { friendly_name: "Lavatrice Temperatura" }),
  n("sensor.lavatrice_centrifuga", "1200", "rpm", { friendly_name: "Lavatrice Centrifuga" }),
  st("select.lavatrice_programma", "Cotone", { friendly_name: "Lavatrice Programma" }),
  n("sensor.lavatrice_power", "1180", "W", { device_class: "power" }),
  st("switch.lavatrice_lavatrice", "on", { friendly_name: "Lavatrice" }),
  st("sensor.lavastoviglie_machine_status", "running", { friendly_name: "Lavastoviglie Stato" }),
  st("sensor.lavastoviglie_fase", "drying", { friendly_name: "Lavastoviglie Fase" }),
  n("sensor.lavastoviglie_tempo_rimanente", "18", "min", { friendly_name: "Lavastoviglie Tempo" }),
  st("select.lavastoviglie_programma", "eco_50", { friendly_name: "Lavastoviglie Programma" }),
  n("sensor.lavastoviglie_power", "35", "W", { device_class: "power" }),
  st("switch.lavastoviglie_lavastoviglie", "on", { friendly_name: "Lavastoviglie" }),
  /* La friggitrice che cuoce, il forno e il piano spenti. */
  st("sensor.philips_airfryer_status", "cooking", { friendly_name: "Airfryer Status" }),
  n("sensor.philips_airfryer_temp", "180", "°C", { device_class: "temperature" }),
  n("sensor.philips_airfryer_total_time", "900", "s"),
  n("sensor.philips_airfryer_time_remaining", "445", "s"),
  st("sensor.philips_airfryer_dialog", "patatine"),
  st("binary_sensor.philips_airfryer_drawer_open", "off", { device_class: "door" }),
  n("sensor.forno_temperatura", "24", "°C"),
  st("switch.forno", "off", { friendly_name: "Forno" }),
  st("switch.piano_cottura", "off", { friendly_name: "Piano cottura" }),
  /* Il mini PC. */
  n("sensor.cpu", "37", "%", { friendly_name: "CPU" }),
  n("sensor.ram", "68", "%", { friendly_name: "RAM" }),
  n("sensor.disco", "54", "%", { friendly_name: "Disco" }),
  n("sensor.tcpu", "61", "°C", { friendly_name: "Temperatura CPU" }),
  n("sensor.watt", "13", "W", { friendly_name: "Potenza" }),
  n("sensor.giu", "215", "Mbit/s", { friendly_name: "Download" }),
  n("sensor.su", "96", "Mbit/s", { friendly_name: "Upload" }),
  n("sensor.ping", "18", "ms", { friendly_name: "Ping" }),
  st("binary_sensor.internet", "on", { friendly_name: "Internet", device_class: "connectivity" }),
  /* Le macchine e la rete. */
  st("binary_sensor.nas_status", "off", { device_class: "running", friendly_name: "NAS" }, 180),
  st("switch.nas", "off", { friendly_name: "NAS" }),
  st("binary_sensor.ha_status", "on", { device_class: "running", friendly_name: "Home Assistant" }),
  st("binary_sensor.frigate_status", "on", { device_class: "running", friendly_name: "Frigate" }),
  st("binary_sensor.fritzbox", "on", {
    device_class: "connectivity",
    friendly_name: "FRITZ!Box 7590",
  }),
  st(
    "binary_sensor.ripetitore_salotto",
    "off",
    { device_class: "connectivity", friendly_name: "Ripetitore salotto" },
    40,
  ),
  /* In evidenza. */
  st("switch.pompa_pozzo", "on", { friendly_name: "Pompa del pozzo" }, 25),
  n("sensor.quadro", "31.2", "°C", { device_class: "temperature", friendly_name: "Quadro" }, 2),
  n("sensor.cisterna", "72", "%", { friendly_name: "Cisterna" }, 10),
  st("binary_sensor.cancello", "off", { device_class: "gate", friendly_name: "Cancello" }, 600),
  /* Il serbatoio sul tetto. */
  n("sensor.serbatoio_tetto_level", "64", "%", {}),
  st("switch.valvola_ingresso", "on", { friendly_name: "Ingresso" }),
  st("switch.valvola_uscita", "off", { friendly_name: "Uscita" }),
  n("sensor.acqua_tetto", "19.5", "°C", {
    device_class: "temperature",
    friendly_name: "Temperatura acqua",
  }),
];

const PIATTAFORME = {
  "binary_sensor.nas_status": "proxmoxve",
  "binary_sensor.ha_status": "proxmoxve",
  "binary_sensor.frigate_status": "proxmoxve",
  "binary_sensor.fritzbox": "fritz",
  "binary_sensor.ripetitore_salotto": "fritz",
};
const NOMI = { proxmoxve: "Proxmox VE", fritz: "FRITZ!Box" };

const appl = (id, nome, tipo, prefisso, stanza = "room-lavanderia") => ({
  id,
  name: nome,
  icon: tipo,
  visual_key: tipo,
  device_type: tipo,
  visual_type: "asset",
  room_id: stanza,
  threshold_run: 5,
  threshold_standby: 1,
  state_entity: `sensor.${prefisso}_machine_status`,
  remaining_entity: `sensor.${prefisso}_tempo_rimanente`,
  power_entity: `sensor.${prefisso}_power`,
  control_entity: `switch.${prefisso}_${prefisso}`,
  integration: "hon",
  device_entities: STATI.map((s) => s.entity_id).filter((e) => e.includes(prefisso)),
  entities: [`switch.${prefisso}_${prefisso}`, `sensor.${prefisso}_power`],
  metadata: { dm_campi_scelti: true },
});

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "room-lavanderia", name: "Lavanderia", icon: "mdi:washing-machine" },
      { id: "room-cucina", name: "Cucina", icon: "mdi:countertop" },
    ],
    appliances: [
      appl("a-lav", "Lavatrice", "lavatrice", "lavatrice"),
      appl("a-lst", "Lavastoviglie", "lavastoviglie", "lavastoviglie", "room-cucina"),
      {
        id: "a-frig",
        name: "Friggitrice",
        icon: "friggitrice",
        visual_key: "friggitrice",
        device_type: "friggitrice",
        visual_type: "asset",
        room_id: "room-cucina",
        state_entity: "sensor.philips_airfryer_status",
        cottura_tempo_rimanente: "sensor.philips_airfryer_time_remaining",
        cottura_tempo_totale: "sensor.philips_airfryer_total_time",
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
      },
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
    entityOverrides: {
      "dm.server_cpu": "sensor.cpu",
      "dm.server_ram": "sensor.ram",
      "dm.server_disco": "sensor.disco",
      "dm.server_temperatura_cpu": "sensor.tcpu",
      "dm.server_potenza_raspberry_server": "sensor.watt",
      "dm.server_speedtest_download": "sensor.giu",
      "dm.server_speedtest_upload": "sensor.su",
      "dm.server_ping_internet": "sensor.ping",
      "dm.server_stato_internet": "binary_sensor.internet",
    },
  },
  visibility: { home: true, appliances: true, server: true },
};

const CODA = [
  {
    number: 209,
    type: "assistenza",
    title: "Non trovo la pagina Piscina",
    state: "inviato",
    author: "persona-11-p",
    created_at: new Date().toISOString(),
  },
  {
    number: 204,
    type: "bug",
    title: "Le tapparelle non si fermano a metà",
    state: "in-carico",
    author: "chiara-r",
    created_at: new Date().toISOString(),
  },
  {
    number: 201,
    type: "bug",
    title: "Il meteo resta indietro",
    state: "inviato",
    author: "persona-3-b",
    created_at: "2026-09-20T10:00:00Z",
  },
  {
    number: 199,
    type: "feature",
    title: "Un grafico dell'acqua",
    state: "inviato",
    author: "persona-11-p",
    created_at: "2026-09-25T10:00:00Z",
  },
  {
    number: 175,
    type: "bug",
    title: "La sveglia non suona",
    state: "inviato",
    author: "persona-2-t",
    created_at: "2026-08-01T10:00:00Z",
  },
  {
    number: 170,
    type: "feature",
    title: "Le stanze in ordine",
    state: "inviato",
    author: "persona-2-t",
    created_at: "2026-08-03T10:00:00Z",
  },
  {
    number: 150,
    type: "bug",
    title: "Chiusa da tempo",
    state: "risolto",
    author: "persona-2-t",
    created_at: "2026-07-01T10:00:00Z",
  },
];

async function accendi(page, testInfo) {
  test.setTimeout(240_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(
    ({ haStates, piattaforme, nomi }) => {
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
            result = Array.isArray(m.entity_ids)
              ? {
                  entities: m.entity_ids
                    .filter((entity) => piattaforme[entity])
                    .map((entity) => ({ entity_id: entity, platform: piattaforme[entity] })),
                }
              : {
                  integrations: Object.entries(nomi).map(([domain, name]) => ({
                    domain,
                    name,
                    custom: false,
                    devices: 1,
                    entries: [],
                  })),
                  devices: [],
                  entities: [],
                };
          else if (m.type === "dashboardmodern/chat/state")
            result = {
              enabled: true,
              console: false,
              opened: true,
              name: "Persona 17",
              unread: 2,
              preview:
                "Vai in Configurazione → Piscina e scegli Pompa piscina, poi salva. Dovrebbe comparire subito.",
              written_at: Date.now() - 4 * 60000,
              messages: 3,
            };
          else if (m.type === "call_service") {
            window.__CHIAMATE__ = [
              ...(window.__CHIAMATE__ || []),
              [m.domain, m.service, m.service_data],
            ];
            result = {};
          }
          queueMicrotask(() =>
            this.onmessage?.({
              data: JSON.stringify({ id: m.id, type: "result", success: true, result }),
            }),
          );
        }
        close() {
          this.onclose?.({});
        }
      }
      window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
      window.WebSocket = MockSocket;
    },
    { haStates: STATI, piattaforme: PIATTAFORME, nomi: NOMI },
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((x) => x.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    ({ stati, coda, piattaforme }) => {
      localStorage.setItem(
        "cd_macchine",
        JSON.stringify({
          righe: [
            { entity: "binary_sensor.nas_status", name: "NAS", famiglia: "macchine" },
            { entity: "binary_sensor.ha_status", name: "Home Assistant", famiglia: "macchine" },
            { entity: "binary_sensor.frigate_status", name: "Frigate", famiglia: "macchine" },
            { entity: "binary_sensor.fritzbox", name: "FRITZ!Box 7590", famiglia: "rete" },
            {
              entity: "binary_sensor.ripetitore_salotto",
              name: "Ripetitore salotto",
              famiglia: "rete",
            },
          ],
        }),
      );
      localStorage.setItem(
        "cd_evidenza",
        JSON.stringify([
          { name: "Pompa del pozzo", icon: "💧", entity: "switch.pompa_pozzo" },
          { name: "Quadro elettrico", icon: "⚡", entity: "sensor.quadro" },
          { name: "Cisterna", icon: "🛢️", entity: "sensor.cisterna" },
          { name: "Cancello", icon: "🚪", entity: "binary_sensor.cancello" },
        ]),
      );
      localStorage.setItem(
        "cd_sezioni_mie",
        JSON.stringify([
          {
            id: "serbatoio",
            titolo: "Serbatoio sul tetto",
            icona: "🏠",
            voci: [
              { entity: "sensor.serbatoio_tetto_level" },
              { entity: "switch.valvola_ingresso", nome: "Ingresso" },
              { entity: "switch.valvola_uscita", nome: "Uscita" },
              { entity: "sensor.acqua_tetto", nome: "Temperatura acqua" },
            ],
          },
        ]),
      );
      const conosciute = window.__DASHBOARDMODERN_DI_CHI_E__?.piattaforme;
      if (conosciute)
        for (const [id, dominio] of Object.entries(piattaforme)) conosciute.set(id, dominio);
      const segnalazioni = window.__DASHBOARDMODERN_SEGNALAZIONI__;
      if (segnalazioni) {
        segnalazioni.console = true;
        segnalazioni.queue = coda;
        segnalazioni.queueAt = Date.now();
        segnalazioni.nonLetti = [
          { number: 209, title: "Non trovo la pagina Piscina", messages: 2, opened: false },
          { number: 204, title: "Le tapparelle non si fermano a metà", messages: 1, opened: true },
        ];
      }
      const adesso = new Date().toISOString();
      for (const voce of stati) {
        const nuovo = { ...structuredClone(voce) };
        if (voce.entity_id.startsWith("sensor.philips")) {
          nuovo.last_changed = adesso;
          nuovo.last_updated = adesso;
        }
        _RAW_STATES[voce.entity_id] = nuovo;
        STATES[voce.entity_id] = structuredClone(nuovo);
      }
      window.dispatchEvent(new CustomEvent("dashboardmodern:segnalazioni-coda"));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
      window.renderHomeWidgets?.();
    },
    { stati: STATI, coda: CODA, piattaforme: PIATTAFORME },
  );
  await page.waitForTimeout(1500);
}

async function apri(page, chiave) {
  const tessera = page.locator(`#dm-widgets [data-dm-widget="${chiave}"]`).first();
  await expect(tessera, `manca la tessera ${chiave}`).toBeVisible({ timeout: 20_000 });
  await tessera.evaluate((nodo) => nodo.scrollIntoView({ block: "center" }));
  await tessera.click();
  const finestra = page.locator(`#dm-widget-popup [data-dm-widget-detail="${chiave}"]`);
  await expect(finestra).toBeVisible();
  /* La finestra e' quella disegnata, non la generica. */
  await expect(finestra.locator(".dm-f")).toHaveCount(1);
  await expect(finestra.locator(".dm-w-caselle, .dm-w-verdetto")).toHaveCount(0);
  return finestra;
}

async function chiudi(page, nome, testInfo) {
  if (FOTO && testInfo.project.name === "mobile") {
    await page.waitForTimeout(500);
    const carta = page.locator("#dm-widget-popup .dm-widget-detail");
    await carta.screenshot({ path: `${FOTO}/fatta-${nome}.png` });
    /* Se il corpo scorre, anche il fondo: niente deve restare tagliato. */
    const scorre = await carta.evaluate((nodo) => {
      const corpo = nodo.querySelector(".dm-w-body");
      const scatola = [corpo, nodo, nodo.parentElement].find(
        (uno) => uno && uno.scrollHeight > uno.clientHeight + 4,
      );
      if (!scatola) return false;
      scatola.scrollTop = scatola.scrollHeight;
      return true;
    });
    if (scorre) {
      await page.waitForTimeout(300);
      await carta.screenshot({ path: `${FOTO}/fatta-${nome}-2.png` });
    }
  }
  await page.keyboard.press("Escape");
  await expect(page.locator("#dm-widget-popup .dm-widget-detail")).toHaveCount(0);
}

test("le finestre del sistema si aprono, ciascuna con la sua forma", async ({ page }, testInfo) => {
  await accendi(page, testInfo);

  let finestra = await apri(page, "elettrodomestici");
  /* Chi finisce prima sta sopra: la friggitrice (7 min), poi la lavastoviglie. */
  const ordine = await finestra
    .locator(".dm-f-el-mac")
    .evaluateAll((nodi) => nodi.map((nodo) => nodo.dataset.dmFApparecchio));
  expect(ordine).toEqual(["a-frig", "a-lst", "a-lav"]);
  await expect(finestra.locator(".dm-f-el-fermo")).toHaveCount(2);
  await expect(finestra).toContainText(/Cotone/);
  await chiudi(page, "elettrodomestici", testInfo);

  /* La cottura apre una finestra come le altre, non la pagina. */
  finestra = await apri(page, "cottura");
  await expect(page.locator("#page-appliances-main")).not.toHaveClass(/active/);
  await expect(finestra.locator(".dm-f-cot-anello .dm-f-num")).toHaveText(/^7:[0-5]\d$/);
  await expect(finestra.locator('[data-dm-f-comando="pausa"]')).toBeVisible();
  await expect(finestra.locator('[data-dm-f-comando="stop"]')).toBeVisible();
  await expect(finestra.locator('[data-dm-w-sezione="cottura"]')).toContainText("Apri la cucina");
  await chiudi(page, "cottura", testInfo);

  finestra = await apri(page, "minipc");
  await expect(finestra.locator(".dm-f-pc-anello")).toContainText("37%");
  await expect(finestra.locator(".dm-f-pc-quota")).toHaveCount(2);
  await expect(finestra.locator(".dm-f-pc-cas").first()).toContainText("215");
  await chiudi(page, "minipc", testInfo);

  finestra = await apri(page, "macchine");
  await expect(finestra.locator(".dm-f-mac-giu")).toHaveCount(2);
  await expect(finestra.locator(".dm-f-mac-giu").first()).toContainText("NAS");
  await expect(finestra.locator(".dm-f-mac-avvia")).toHaveCount(1);
  await expect(finestra).not.toContainText(/\bserver\b NAS/);
  await chiudi(page, "macchine", testInfo);

  finestra = await apri(page, "evidenza");
  await expect(
    finestra.locator('.dm-f-ev-cmd [data-dm-w-light="switch.pompa_pozzo"]'),
  ).toBeVisible();
  await expect(finestra.locator(".dm-f-ev-voce")).toHaveCount(3);
  await expect(finestra).toContainText("Chiuso");
  await chiudi(page, "evidenza", testInfo);

  finestra = await apri(page, "mia-serbatoio");
  await expect(finestra.locator(".dm-f-mia-vasca")).toHaveCount(1);
  await expect(finestra.locator(".dm-f-mia-leva")).toHaveCount(2);
  await expect(finestra).not.toContainText("serbatoio_tetto_level");
  await chiudi(page, "sezionimie", testInfo);

  finestra = await apri(page, "segnalazioni");
  await expect(finestra.locator(".dm-f-seg-riga .dm-f-num")).toHaveText("6");
  await expect(finestra.locator(".dm-f-seg-att")).toHaveCount(2);
  await expect(finestra.locator(".dm-f-seg-ferme")).toContainText("#175");
  await chiudi(page, "segnalazioni", testInfo);

  finestra = await apri(page, "assistenza");
  await expect(finestra.locator(".dm-f-chat-bolla")).toContainText("Dovrebbe comparire subito.");
  await expect(finestra.locator("[data-dm-chat-rispondi]")).toBeVisible();
  await expect(finestra).not.toContainText(/AM|PM/);
  await chiudi(page, "assistenza", testInfo);
});

test("dalla finestra il NAS si avvia, e la pompa si spegne con la leva", async ({
  page,
}, testInfo) => {
  await accendi(page, testInfo);
  await page.evaluate(() => {
    window.__CHIAMATE__ = [];
  });
  let finestra = await apri(page, "macchine");
  await finestra.locator(".dm-f-mac-avvia").click();
  await expect
    .poll(() => page.evaluate(() => JSON.stringify(window.__CHIAMATE__ || [])))
    .toContain("switch.nas");
  await page.keyboard.press("Escape");
  finestra = await apri(page, "evidenza");
  await finestra.locator('[data-dm-w-light="switch.pompa_pozzo"]').click();
  await expect
    .poll(() => page.evaluate(() => JSON.stringify(window.__CHIAMATE__ || [])))
    .toContain("switch.pompa_pozzo");
});
