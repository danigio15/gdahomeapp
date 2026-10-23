/* Le pagine Dispositivi (con le integrazioni) e Aiutanti dell'app.
 *
 * Si aprono dal menu laterale dell'app con le loro maniglie
 * (`gdahomeApriIDispositivi`, `gdahomeApriGliAiutanti`), a schermo pieno,
 * con la faccia delle Automazioni. Il ponte e' finto: risponde come
 * `ponte/src/integrazioni.js` e `ponte/src/aiutanti.js`, e la procedura
 * guidata di Home Assistant e' quella di un'integrazione di prova (un
 * indirizzo, un errore, poi la voce creata).
 *
 * Con `DM_FOTO=<cartella>` lascia le fotografie delle pagine.
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
  visibility: { home: true },
};

const STATI = {
  "light.lampada_divano": { state: "on", attributes: { friendly_name: "Lampada divano" } },
  "sensor.lampada_divano_potenza": {
    state: "7.4",
    attributes: {
      friendly_name: "Lampada divano Potenza",
      unit_of_measurement: "W",
      device_class: "power",
    },
  },
  "climate.termostato": {
    state: "heat",
    attributes: { friendly_name: "Termostato", current_temperature: 20.8 },
  },
  "sensor.termostato_batteria": {
    state: "84",
    attributes: {
      friendly_name: "Termostato Batteria",
      unit_of_measurement: "%",
      device_class: "battery",
    },
  },
  "switch.presa_forno": { state: "off", attributes: { friendly_name: "Presa forno" } },
  "sensor.presa_forno_energia": {
    state: "12.31",
    attributes: {
      friendly_name: "Presa forno Energia",
      unit_of_measurement: "kWh",
      device_class: "energy",
    },
  },
  "binary_sensor.porta_ingresso": {
    state: "off",
    attributes: { friendly_name: "Porta ingresso", device_class: "door" },
  },
  "cover.tapparella_camera": { state: "open", attributes: { friendly_name: "Tapparella camera" } },
  "sensor.temperatura_bagno": {
    state: "unavailable",
    attributes: { friendly_name: "Temperatura bagno", device_class: "temperature" },
  },
  "sensor.fritz_download": {
    state: "48.2",
    attributes: { friendly_name: "FRITZ!Box Download", unit_of_measurement: "Mbit/s" },
  },
  "input_boolean.modalita_vacanza": {
    state: "off",
    attributes: { friendly_name: "Modalità vacanza" },
  },
  "input_boolean.ospiti_in_casa": { state: "on", attributes: { friendly_name: "Ospiti in casa" } },
  "input_number.temperatura_comfort": {
    state: "21.5",
    attributes: {
      friendly_name: "Temperatura comfort",
      min: 16,
      max: 26,
      step: 0.5,
      unit_of_measurement: "°C",
    },
  },
  "input_select.modo_della_casa": {
    state: "Casa",
    attributes: {
      friendly_name: "Modo della casa",
      options: ["Casa", "Fuori", "Notte", "Vacanza"],
    },
  },
  "timer.lavatrice": {
    state: "active",
    attributes: { friendly_name: "Timer lavatrice", remaining: "0:42:10", duration: "1:30:00" },
  },
  "counter.aperture_portone": {
    state: "14",
    attributes: { friendly_name: "Aperture portone oggi", step: 1 },
  },
  "input_button.campanello_finto": {
    state: "unknown",
    attributes: { friendly_name: "Suona il campanello" },
  },
  "schedule.orari_ufficio": { state: "on", attributes: { friendly_name: "Orari ufficio" } },
  "sensor.consumo_cucina": {
    state: "2.4",
    attributes: { friendly_name: "Consumo giornaliero cucina", unit_of_measurement: "kWh" },
  },
  "light.luci_giorno": { state: "on", attributes: { friendly_name: "Tutte le luci giorno" } },
};

const DISPOSITIVI = {
  stanze: [
    { id: "soggiorno", nome: "Soggiorno" },
    { id: "cucina", nome: "Cucina" },
    { id: "camera", nome: "Camera" },
    { id: "bagno", nome: "Bagno" },
  ],
  dispositivi: [
    {
      id: "d1",
      nome: "Lampada divano",
      stanza: "soggiorno",
      marca: "Signify",
      modello: "Hue Go",
      versione: "1.104.2",
      integrazione: "Philips Hue",
      dominio: "hue",
      voce: "e_hue000001",
      entita: [
        { id: "light.lampada_divano", nome: "" },
        { id: "sensor.lampada_divano_potenza", nome: "", diagnostica: true },
      ],
    },
    {
      id: "d2",
      nome: "Termostato",
      stanza: "soggiorno",
      marca: "Netatmo",
      modello: "Smart Thermostat",
      versione: "",
      integrazione: "Netatmo",
      dominio: "netatmo",
      voce: "e_netatmo01",
      entita: [
        { id: "climate.termostato", nome: "" },
        { id: "sensor.termostato_batteria", nome: "", batteria: true, diagnostica: true },
      ],
    },
    {
      id: "d3",
      nome: "Presa forno",
      stanza: "cucina",
      marca: "Shelly",
      modello: "Plus 1PM",
      versione: "1.4.4",
      integrazione: "Shelly",
      dominio: "shelly",
      voce: "e_shelly001",
      entita: [
        { id: "switch.presa_forno", nome: "" },
        { id: "sensor.presa_forno_energia", nome: "" },
      ],
    },
    {
      id: "d4",
      nome: "Porta ingresso",
      stanza: "cucina",
      marca: "Aqara",
      modello: "MCCGQ11LM",
      versione: "",
      integrazione: "Zigbee Home Automation",
      dominio: "zha",
      voce: "e_zha000001",
      entita: [{ id: "binary_sensor.porta_ingresso", nome: "" }],
    },
    {
      id: "d5",
      nome: "Tapparella camera",
      stanza: "camera",
      marca: "Shelly",
      modello: "Plus 2PM",
      versione: "1.4.4",
      integrazione: "Shelly",
      dominio: "shelly",
      voce: "e_shelly001",
      entita: [{ id: "cover.tapparella_camera", nome: "" }],
    },
    {
      id: "d6",
      nome: "Sensore bagno",
      stanza: "bagno",
      marca: "Aqara",
      modello: "WSDCGQ11LM",
      versione: "",
      integrazione: "Zigbee Home Automation",
      dominio: "zha",
      voce: "e_zha000001",
      entita: [{ id: "sensor.temperatura_bagno", nome: "Temperatura bagno" }],
    },
    {
      id: "d7",
      nome: "FRITZ!Box 7590",
      stanza: "",
      marca: "AVM",
      modello: "FRITZ!Box 7590",
      versione: "7.57",
      integrazione: "FRITZ!Box Tools",
      dominio: "fritz",
      voce: "e_fritz0001",
      entita: [{ id: "sensor.fritz_download", nome: "Download" }],
    },
  ],
};

const INTEGRAZIONI = {
  voci: [
    {
      id: "e_zha000001",
      dominio: "zha",
      integrazione: "Zigbee Home Automation",
      titolo: "Zigbee Home Automation",
      stato: "ok",
      perche: "",
      fonte: "user",
      opzioni: true,
      ricaricabile: true,
      disattivata: false,
      dispositivi: 38,
      entita: 214,
    },
    {
      id: "e_shelly001",
      dominio: "shelly",
      integrazione: "Shelly",
      titolo: "Shelly",
      stato: "ok",
      perche: "",
      fonte: "zeroconf",
      opzioni: false,
      ricaricabile: true,
      disattivata: false,
      dispositivi: 12,
      entita: 96,
    },
    {
      id: "e_hue000001",
      dominio: "hue",
      integrazione: "Philips Hue",
      titolo: "Hue Bridge",
      stato: "ok",
      perche: "",
      fonte: "zeroconf",
      opzioni: true,
      ricaricabile: true,
      disattivata: false,
      dispositivi: 9,
      entita: 31,
    },
    {
      id: "e_fritz0001",
      dominio: "fritz",
      integrazione: "FRITZ!Box Tools",
      titolo: "FRITZ!Box 7590",
      stato: "ok",
      perche: "",
      fonte: "user",
      opzioni: true,
      ricaricabile: true,
      disattivata: false,
      dispositivi: 1,
      entita: 44,
    },
    {
      id: "e_netatmo01",
      dominio: "netatmo",
      integrazione: "Netatmo",
      titolo: "Netatmo",
      stato: "errore",
      perche: "Accesso scaduto",
      fonte: "user",
      opzioni: false,
      ricaricabile: true,
      disattivata: false,
      dispositivi: 3,
      entita: 18,
    },
    {
      id: "e_meteo0001",
      dominio: "met",
      integrazione: "Meteorologisk institutt (Met.no)",
      titolo: "Casa",
      stato: "disattivata",
      perche: "",
      fonte: "user",
      opzioni: true,
      ricaricabile: true,
      disattivata: true,
      dispositivi: 1,
      entita: 2,
    },
  ],
  trovate: [
    {
      flow_id: "f_trovata01",
      dominio: "shelly",
      integrazione: "Shelly",
      titolo: "Shelly Plus 1PM",
    },
  ],
  riparazioni: [
    {
      flow_id: "f_ripara001",
      dominio: "netatmo",
      integrazione: "Netatmo",
      titolo: "Netatmo",
      voce: "e_netatmo01",
    },
  ],
};

const CATALOGO = {
  integrazioni: [
    {
      dominio: "esphome",
      nome: "ESPHome",
      tipo: "device",
      cloud: false,
      installata: false,
      personalizzata: false,
    },
    {
      dominio: "shelly",
      nome: "Shelly",
      tipo: "device",
      cloud: false,
      installata: true,
      personalizzata: false,
    },
    {
      dominio: "sonos",
      nome: "Sonos",
      tipo: "hub",
      cloud: false,
      installata: false,
      personalizzata: false,
    },
    {
      dominio: "tado",
      nome: "tado°",
      tipo: "hub",
      cloud: true,
      installata: false,
      personalizzata: false,
    },
  ],
};

const AIUTANTI = {
  semplici: [
    {
      tipo: "input_boolean",
      id: "modalita_vacanza",
      entity_id: "input_boolean.modalita_vacanza",
      nome: "Modalità vacanza",
      config: { id: "modalita_vacanza", name: "Modalità vacanza", icon: "mdi:beach" },
      stanza: "",
    },
    {
      tipo: "input_boolean",
      id: "ospiti_in_casa",
      entity_id: "input_boolean.ospiti_in_casa",
      nome: "Ospiti in casa",
      config: { id: "ospiti_in_casa", name: "Ospiti in casa" },
      stanza: "",
    },
    {
      tipo: "input_number",
      id: "temperatura_comfort",
      entity_id: "input_number.temperatura_comfort",
      nome: "Temperatura comfort",
      config: {
        id: "temperatura_comfort",
        name: "Temperatura comfort",
        min: 16,
        max: 26,
        step: 0.5,
        unit_of_measurement: "°C",
        mode: "slider",
      },
      stanza: "",
    },
    {
      tipo: "input_select",
      id: "modo_della_casa",
      entity_id: "input_select.modo_della_casa",
      nome: "Modo della casa",
      config: {
        id: "modo_della_casa",
        name: "Modo della casa",
        options: ["Casa", "Fuori", "Notte", "Vacanza"],
      },
      stanza: "",
    },
    {
      tipo: "input_button",
      id: "campanello_finto",
      entity_id: "input_button.campanello_finto",
      nome: "Suona il campanello",
      config: { id: "campanello_finto", name: "Suona il campanello" },
      stanza: "",
    },
    {
      tipo: "timer",
      id: "lavatrice",
      entity_id: "timer.lavatrice",
      nome: "Timer lavatrice",
      config: { id: "lavatrice", name: "Timer lavatrice", duration: "1:30:00", restore: true },
      stanza: "",
    },
    {
      tipo: "counter",
      id: "aperture_portone",
      entity_id: "counter.aperture_portone",
      nome: "Aperture portone oggi",
      config: { id: "aperture_portone", name: "Aperture portone oggi", step: 1, initial: 0 },
      stanza: "",
    },
    {
      tipo: "schedule",
      id: "orari_ufficio",
      entity_id: "schedule.orari_ufficio",
      nome: "Orari ufficio",
      config: {
        id: "orari_ufficio",
        name: "Orari ufficio",
        monday: [{ from: "09:00:00", to: "18:00:00" }],
        tuesday: [{ from: "09:00:00", to: "18:00:00" }],
        wednesday: [{ from: "09:00:00", to: "18:00:00" }],
        thursday: [{ from: "09:00:00", to: "18:00:00" }],
        friday: [{ from: "09:00:00", to: "13:00:00" }],
      },
      stanza: "",
    },
  ],
  calcolati: [
    {
      voce: "e_util00001",
      dominio: "utility_meter",
      tipoNome: "Contatore di consumi",
      nome: "Consumo giornaliero cucina",
      entita: ["sensor.consumo_cucina"],
      opzioni: true,
    },
    {
      voce: "e_group0001",
      dominio: "group",
      tipoNome: "Gruppo",
      nome: "Tutte le luci giorno",
      entita: ["light.luci_giorno"],
      opzioni: true,
    },
  ],
  tipiCalcolati: [
    { dominio: "derivative", nome: "Derivata" },
    { dominio: "group", nome: "Gruppo" },
    { dominio: "min_max", nome: "Min / Max" },
    { dominio: "threshold", nome: "Soglia" },
    { dominio: "template", nome: "Template" },
    { dominio: "utility_meter", nome: "Contatore di consumi" },
  ],
};

/* La procedura di prova: l'indirizzo, la porta, e la prima volta un errore. */
const PAROLE_SHELLY = {
  "step.user.title": "Collega un dispositivo Shelly",
  "step.user.description": "Scrivi l'indirizzo del dispositivo in casa.",
  "step.user.data.host": "Indirizzo",
  "step.user.data.port": "Porta",
  "step.user.data_description.host": "L'indirizzo IP o il nome del dispositivo Shelly.",
  "error.cannot_connect": "Impossibile connettersi al dispositivo.",
};

async function avvia(page, testInfo, { no = "" } = {}) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const foglio = document.createElement("style");
      foglio.id = "gdahome-config-fuori";
      document.head.append(foglio);
    });
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    ({ stati, dispositivi, integrazioni, catalogo, aiutanti, parole, no }) => {
      const grezzi = window.eval("_RAW_STATES");
      const metti = (id, stato) => {
        grezzi[id] = { entity_id: id, ...stato };
        window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), [id]: grezzi[id] } };
      };
      for (const [entity, stato] of Object.entries(stati)) metti(entity, stato);
      const casa = {
        comandi: [],
        servizi: [],
        integrazioni: structuredClone(integrazioni),
        aiutanti: structuredClone(aiutanti),
        tentativi: 0,
      };
      window.__CASA__ = casa;
      const passoShelly = (extra = {}) => ({
        flow_id: "f_nuova0001",
        handler: "shelly",
        tipo: "form",
        step_id: "user",
        schema: [
          { name: "host", required: true, type: "string" },
          { name: "port", optional: true, type: "integer", default: 80 },
        ],
        errori: {},
        segnaposti: {},
        ultimo: false,
        genere: "integrazione",
        parole,
        ...extra,
      });
      const risposta = (m) => {
        casa.comandi.push(m);
        if (m.type === "ponte/dispositivi/elenco") return dispositivi;
        if (m.type === "ponte/integrazioni/elenco") return casa.integrazioni;
        if (m.type === "ponte/integrazioni/catalogo") return catalogo;
        if (m.type === "ponte/integrazioni/ricarica") return { riavvio: false };
        if (m.type === "ponte/integrazioni/disattiva") {
          const v = casa.integrazioni.voci.find((x) => x.id === m.voce);
          v.disattivata = m.disattiva;
          v.stato = m.disattiva ? "disattivata" : "ok";
          return { riavvio: false };
        }
        if (m.type === "ponte/integrazioni/elimina") {
          casa.integrazioni.voci = casa.integrazioni.voci.filter((x) => x.id !== m.voce);
          return { riavvio: false };
        }
        if (m.type === "ponte/flussi/avvia") return passoShelly();
        if (m.type === "ponte/flussi/leggi") return passoShelly({ flow_id: m.flow_id });
        if (m.type === "ponte/flussi/annulla") return { fatto: true };
        if (m.type === "ponte/flussi/passo") {
          casa.tentativi += 1;
          if (casa.tentativi === 1) return passoShelly({ errori: { base: "cannot_connect" } });
          casa.integrazioni.voci.push({
            id: "e_nuova0001",
            dominio: "shelly",
            integrazione: "Shelly",
            titolo: "Shelly Plus 1PM",
            stato: "ok",
            perche: "",
            fonte: "user",
            opzioni: false,
            ricaricabile: true,
            disattivata: false,
            dispositivi: 1,
            entita: 6,
          });
          return {
            flow_id: m.flow_id,
            handler: "shelly",
            tipo: "create_entry",
            voce: "e_nuova0001",
            titolo: "Shelly Plus 1PM",
            genere: "integrazione",
            parole,
          };
        }
        if (m.type === "ponte/aiutanti/elenco") return casa.aiutanti;
        if (m.type === "ponte/aiutanti/crea") {
          const id = m.campi.name.toLowerCase().replace(/\W+/g, "_");
          casa.aiutanti.semplici.push({
            tipo: m.tipo,
            id,
            entity_id: `${m.tipo}.${id}`,
            nome: m.campi.name,
            config: { id, ...m.campi },
            stanza: "",
          });
          metti(`${m.tipo}.${id}`, {
            state: String(m.campi.min ?? "off"),
            attributes: { friendly_name: m.campi.name, ...m.campi },
          });
          return { id, ...m.campi };
        }
        if (m.type === "ponte/aiutanti/modifica") {
          const a = casa.aiutanti.semplici.find((x) => x.id === m.aiutante);
          Object.assign(a.config, m.campi);
          a.nome = m.campi.name || a.nome;
          return a.config;
        }
        if (m.type === "ponte/aiutanti/elimina") {
          if (m.voce)
            casa.aiutanti.calcolati = casa.aiutanti.calcolati.filter((c) => c.voce !== m.voce);
          else casa.aiutanti.semplici = casa.aiutanti.semplici.filter((a) => a.id !== m.aiutante);
          return { fatto: true };
        }
        return null;
      };
      const vero = window.eval("ws");
      window.__FINTO__ = {
        readyState: 1,
        send(grezzo) {
          const m = JSON.parse(grezzo);
          const nostro = /^ponte\/(dispositivi|integrazioni|flussi|aiutanti)\//.test(
            String(m.type),
          );
          const servizio = m.type === "call_service";
          if (!nostro && !servizio) return vero?.send?.(grezzo);
          let result = null;
          let errore = null;
          if (servizio) {
            const dati = m.service_data || m.target || {};
            casa.servizi.push({ domain: m.domain, service: m.service, data: dati });
            const s = grezzi[dati.entity_id];
            if (s && m.service === "toggle")
              metti(dati.entity_id, { ...s, state: s.state === "on" ? "off" : "on" });
            if (s && m.service === "set_value")
              metti(dati.entity_id, { ...s, state: String(dati.value) });
            if (s && m.service === "increment")
              metti(dati.entity_id, { ...s, state: String(Number(s.state) + 1) });
          } else if (no === "premium")
            errore = {
              code: "premium-richiesto",
              message: "le integrazioni sono di GdAHome Premium",
            };
          else if (no === "vietato")
            errore = {
              code: "unauthorized",
              message: "le integrazioni le gestisce chi amministra Home Assistant",
            };
          else result = risposta(m);
          setTimeout(() => {
            const attese = window.eval("pendingWsCallbacks");
            const torna = attese[m.id];
            delete attese[m.id];
            torna?.(
              errore
                ? { id: m.id, type: "result", success: false, error: errore }
                : { id: m.id, type: "result", success: true, result },
            );
            window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
          }, 10);
        },
      };
      window.eval("ws = window.__FINTO__");
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    {
      stati: STATI,
      dispositivi: DISPOSITIVI,
      integrazioni: INTEGRAZIONI,
      catalogo: CATALOGO,
      aiutanti: AIUTANTI,
      parole: PAROLE_SHELLY,
      no,
    },
  );
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
}

async function foto(page, testInfo, nome, { intera = false } = {}) {
  if (!process.env.DM_FOTO) return;
  /* La pagina scorre dentro la plancia: per vederla tutta si allunga lo
   * schermo, e poi si rimette com'era. */
  const prima = page.viewportSize();
  if (intera) {
    const alta = await page.evaluate(
      () => document.querySelector(".page.active")?.scrollHeight || 1600,
    );
    await page.setViewportSize({ width: prima.width, height: Math.min(4000, alta + 220) });
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${process.env.DM_FOTO}/${nome}-${testInfo.project.name}.png` });
  if (intera) await page.setViewportSize(prima);
}

const comandi = (page, tipo) =>
  page.evaluate((tipo) => window.__CASA__.comandi.filter((m) => m.type === tipo), tipo);
const servizi = (page) => page.evaluate(() => window.__CASA__.servizi);

test("Dispositivi: per stanza, il foglio con le entità comandabili, per integrazione", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await page.evaluate(() => window.gdahomeApriIDispositivi());
  const pagina = page.locator("#page-dispositivi");
  await expect(pagina).toHaveClass(/active/);
  await expect(pagina.locator(".dm-page-mast-title")).toHaveText("Dispositivi");
  await expect(pagina.locator("[data-dv-linguetta]")).toHaveText(["Dispositivi", "Integrazioni"]);
  await expect(pagina.locator("[data-dv-disp]")).toHaveCount(7);
  await expect(pagina.locator(".aug-titolo")).toHaveText([
    "Bagno",
    "Camera",
    "Cucina",
    "Soggiorno",
    "Senza stanza",
  ]);
  await expect(pagina.locator(".ad-kpi .dm-lucip-kpi b")).toHaveText(["7", "10", "1"]);
  await expect(pagina.locator('[data-dv-disp="d6"]')).toContainText("Non risponde");
  await foto(page, testInfo, "dispositivi-per-stanza", { intera: true });
  /* L'interruttore della riga comanda l'entità principale. */
  await pagina.locator('[data-dv-disp="d3"] [data-dv-int]').click();
  await expect
    .poll(() => servizi(page))
    .toContainEqual({
      domain: "switch",
      service: "toggle",
      data: { entity_id: "switch.presa_forno" },
    });
  await pagina.locator('[data-dv-disp="d1"]').click();
  const foglio = page.locator("#dv-foglio .ad-foglio");
  await expect(foglio.locator("h4")).toHaveText("Lampada divano");
  await expect(foglio.locator(".dv-ent")).toHaveCount(2);
  await expect(foglio.locator(".dv-et")).toHaveText("Diagnostica");
  await expect(foglio).toContainText("Signify Hue Go");
  await foto(page, testInfo, "dispositivi-foglio");
  await foglio.locator("[data-dv-ricarica]").click();
  await expect
    .poll(() => comandi(page, "ponte/integrazioni/ricarica"))
    .toEqual([expect.objectContaining({ voce: "e_hue000001" })]);
  await page.locator("#dv-foglio").click({ position: { x: 5, y: 5 } });
  await expect(page.locator("#dv-foglio")).toHaveCount(0);
  await pagina.locator('[data-dv-per="integrazione"]').click();
  await expect(pagina.locator(".aug-titolo")).toContainText(["FRITZ!Box Tools", "Shelly"]);
  await pagina.locator("[data-dv-cerca]").fill("shelly");
  await expect(pagina.locator("[data-dv-disp]")).toHaveCount(2);
  await page.evaluate(() => window.gdahomeTornaDaiDispositivi());
  await expect(page.locator("#page-dispositivi")).toHaveCount(0);
});

test("Integrazioni: ricarica dall'elenco, il foglio, disattiva, elimina con conferma, ripara", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await page.evaluate(() => window.gdahomeApriIDispositivi("integrazioni"));
  const pagina = page.locator("#page-dispositivi");
  await expect(pagina.locator('[data-dv-linguetta="integrazioni"]')).toHaveClass(/si/);
  await expect(pagina.locator(".dv-trovata")).toContainText("Trovata in rete: Shelly Plus 1PM");
  await expect(pagina.locator(".aug-titolo")).toHaveText([
    "Da guardare",
    "Installate",
    "Disattivate",
  ]);
  await expect(pagina.locator(".ad-kpi .dm-lucip-kpi b")).toHaveText(["6", "64", "2"]);
  await foto(page, testInfo, "integrazioni-elenco", { intera: true });
  await pagina.locator('[data-dv-ricarica="e_zha000001"]').click();
  await expect
    .poll(() => comandi(page, "ponte/integrazioni/ricarica"))
    .toEqual([expect.objectContaining({ voce: "e_zha000001" })]);
  await expect(pagina.locator(".dv-avviso")).toContainText("Ricaricata: Zigbee Home Automation");
  await pagina.locator('[data-dv-int-voce="e_fritz0001"]').click();
  const foglio = page.locator("#dv-foglio .ad-foglio");
  await expect(foglio.locator("h4")).toHaveText("FRITZ!Box 7590");
  await expect(foglio.locator(".tasti button")).toHaveText(["↻ Ricarica", "⚙️ Opzioni"]);
  await expect(foglio.locator(".op-mod button")).toHaveText(["Disattiva", "Elimina"]);
  await foto(page, testInfo, "integrazioni-foglio");
  await foglio.locator("[data-dv-disattiva]").click();
  await expect
    .poll(() => comandi(page, "ponte/integrazioni/disattiva"))
    .toEqual([expect.objectContaining({ voce: "e_fritz0001", disattiva: true })]);
  await expect(pagina.locator('[data-aug="i-spente"] [data-dv-int-voce]')).toHaveCount(2);
  /* Elimina: due tocchi, e il secondo dice cosa si perde. */
  await pagina.locator('[data-dv-int-voce="e_hue000001"]').click();
  await foglio.locator("[data-dv-elimina]").click();
  await expect(foglio.locator("h4")).toHaveText("Eliminare «Hue Bridge»?");
  await expect(foglio).toContainText("9 dispositivi e 31 entità");
  await foto(page, testInfo, "integrazioni-elimina");
  expect(await comandi(page, "ponte/integrazioni/elimina")).toEqual([]);
  await foglio.locator("[data-dv-elimina-si]").click();
  await expect
    .poll(() => comandi(page, "ponte/integrazioni/elimina"))
    .toEqual([expect.objectContaining({ voce: "e_hue000001", conferma: true })]);
  await expect(pagina.locator('[data-dv-int-voce="e_hue000001"]')).toHaveCount(0);
  /* Ripara apre la procedura che Home Assistant ha già cominciato. */
  await pagina.locator('[data-dv-ripara="f_ripara001"]').click();
  await expect(page.locator("#pg-foglio .ad-foglio")).toBeVisible();
  await expect
    .poll(() => comandi(page, "ponte/flussi/leggi"))
    .toEqual([expect.objectContaining({ flow_id: "f_ripara001" })]);
});

test("Aggiungi un'integrazione: il catalogo, la procedura guidata, l'errore, la voce creata", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await page.evaluate(() => window.gdahomeApriIDispositivi("integrazioni"));
  const pagina = page.locator("#page-dispositivi");
  await pagina.locator("[data-dv-aggiungi]").click();
  const foglio = page.locator("#dv-foglio .ad-foglio");
  await expect(foglio.locator("[data-dv-nuova]")).toHaveCount(4);
  await foglio.locator("[data-dv-cercacat]").fill("shel");
  await expect(foglio.locator("[data-dv-nuova]")).toHaveCount(1);
  await expect(foglio.locator("[data-dv-cercacat]")).toBeFocused();
  await foto(page, testInfo, "integrazioni-aggiungi");
  await foglio.locator('[data-dv-nuova="shelly"]').click();
  const pg = page.locator("#pg-foglio .ad-foglio");
  await expect(pg.locator("h4")).toHaveText("Collega un dispositivo Shelly");
  await expect(pg.locator(".pg-et")).toHaveText(["Indirizzo *", "Porta"]);
  await expect(pg.locator('[data-pg-campo="port"]')).toHaveValue("80");
  /* Senza l'indirizzo non si parte. */
  await pg.locator("[data-pg-invia]").click();
  await expect(pg.locator(".pg-campo.sbagliato em")).toHaveText("Serve una risposta.");
  expect(await comandi(page, "ponte/flussi/passo")).toEqual([]);
  await pg.locator('[data-pg-campo="host"]').fill("192.168.1.47");
  await foto(page, testInfo, "procedura-modulo");
  await pg.locator("[data-pg-invia]").click();
  await expect(pg.locator(".pg-no")).toHaveText("Impossibile connettersi al dispositivo.");
  /* Quello che si era scritto resta. */
  await expect(pg.locator('[data-pg-campo="host"]')).toHaveValue("192.168.1.47");
  await pg.locator('[data-pg-campo="host"]').fill("192.168.1.48");
  await pg.locator("[data-pg-invia]").click();
  await expect(pg.locator(".pg-fatto b")).toHaveText("Shelly Plus 1PM");
  await foto(page, testInfo, "procedura-fatto");
  const passi = await comandi(page, "ponte/flussi/passo");
  expect(passi.at(-1)).toMatchObject({
    flow_id: "f_nuova0001",
    dati: { host: "192.168.1.48", port: 80 },
  });
  await pg.locator(".tasti [data-pg-chiudi]").click();
  await expect(page.locator("#pg-foglio")).toHaveCount(0);
  await expect(pagina.locator('[data-dv-int-voce="e_nuova0001"]')).toHaveCount(1);
  expect(await comandi(page, "ponte/flussi/annulla")).toEqual([]);
});

test("Aiutanti: per tipo coi valori vivi, il foglio che li cambia, crea, modifica, elimina", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await page.evaluate(() => window.gdahomeApriGliAiutanti());
  const pagina = page.locator("#page-aiutanti");
  await expect(pagina).toHaveClass(/active/);
  await expect(pagina.locator(".dm-page-mast-title")).toHaveText("Aiutanti");
  await expect(pagina.locator(".aug-titolo")).toHaveText([
    "Interruttori",
    "Numeri",
    "Elenchi",
    "Pulsanti",
    "Timer",
    "Contatori",
    "Programmi",
    "Sensori calcolati",
  ]);
  await expect(
    pagina.locator('[data-ai-semplice="input_number.temperatura_comfort"]'),
  ).toContainText("21,5 °C");
  await expect(pagina.locator('[data-ai-semplice="timer.lavatrice"]')).toContainText(
    "in corso 0:42:10",
  );
  await foto(page, testInfo, "aiutanti-elenco", { intera: true });
  await pagina.locator('[data-ai-semplice="input_boolean.modalita_vacanza"] [data-ai-int]').click();
  await expect
    .poll(() => servizi(page))
    .toContainEqual({
      domain: "input_boolean",
      service: "toggle",
      data: { entity_id: "input_boolean.modalita_vacanza" },
    });
  await pagina.locator('[data-ai-semplice="counter.aperture_portone"]').click();
  const foglio = page.locator("#ai-foglio .ad-foglio");
  await foglio.locator('[data-ai-servizio="increment"]').click();
  await expect
    .poll(() => servizi(page))
    .toContainEqual({
      domain: "counter",
      service: "increment",
      data: { entity_id: "counter.aperture_portone" },
    });
  await page.locator("#ai-foglio").click({ position: { x: 5, y: 5 } });
  await pagina.locator('[data-ai-semplice="input_number.temperatura_comfort"]').click();
  await expect(foglio.locator(".ai-valore b")).toHaveText("21,5 °C");
  await foto(page, testInfo, "aiutanti-foglio-numero");
  /* Modifica: il modulo coi campi di quel tipo, gia' riempito. */
  await foglio.locator("[data-ai-modifica]").click();
  await expect(foglio.locator('[data-pg-campo="min"]')).toHaveValue("16");
  await foglio.locator('[data-pg-campo="max"]').fill("27");
  await foglio.locator("[data-ai-salva]").click();
  await expect
    .poll(() => comandi(page, "ponte/aiutanti/modifica"))
    .toEqual([
      expect.objectContaining({
        tipo: "input_number",
        aiutante: "temperatura_comfort",
        campi: expect.objectContaining({ min: 16, max: 27, name: "Temperatura comfort" }),
      }),
    ]);
  /* Nuovo: i tipi semplici e quelli calcolati. */
  await pagina.locator(".ad-filtri [data-ai-nuovo]").click();
  await expect(foglio.locator("[data-ai-crea]")).toHaveCount(9);
  await expect(foglio.locator("[data-ai-crea-calcolato]")).toHaveCount(6);
  await foto(page, testInfo, "aiutanti-nuovo");
  await foglio.locator('[data-ai-crea="input_select"]').click();
  await foglio.locator('[data-pg-campo="name"]').fill("Chi cucina");
  await foglio.locator('[data-pg-campo="options"]').fill("Io\nTu\nNessuno");
  await foto(page, testInfo, "aiutanti-modulo");
  await foglio.locator("[data-ai-salva]").click();
  await expect
    .poll(() => comandi(page, "ponte/aiutanti/crea"))
    .toEqual([
      expect.objectContaining({
        tipo: "input_select",
        campi: expect.objectContaining({ name: "Chi cucina", options: ["Io", "Tu", "Nessuno"] }),
      }),
    ]);
  await expect(pagina.locator('[data-ai-semplice="input_select.chi_cucina"]')).toHaveCount(1);
  /* Un programma: le fasce scritte a mano. */
  await pagina.locator(".ad-filtri [data-ai-nuovo]").click();
  await foglio.locator('[data-ai-crea="schedule"]').click();
  await foglio.locator('[data-pg-campo="name"]').fill("Irrigazione");
  await foglio.locator('[data-pg-campo="monday"]').fill("6-7, 20:30-21");
  await foglio.locator("[data-ai-salva]").click();
  await expect.poll(async () => (await comandi(page, "ponte/aiutanti/crea")).length).toBe(2);
  expect((await comandi(page, "ponte/aiutanti/crea"))[1].campi.monday).toEqual([
    { from: "06:00:00", to: "07:00:00" },
    { from: "20:30:00", to: "21:00:00" },
  ]);
  /* Elimina un calcolato: con la conferma. */
  await pagina.locator('[data-ai-calcolato="e_group0001"]').click();
  await foglio.locator("[data-ai-elimina]").click();
  await foglio.locator("[data-ai-elimina-si]").click();
  await expect
    .poll(() => comandi(page, "ponte/aiutanti/elimina"))
    .toEqual([expect.objectContaining({ voce: "e_group0001", conferma: true })]);
  await page.evaluate(() => window.gdahomeTornaDagliAiutanti());
  await expect(page.locator("#page-aiutanti")).toHaveCount(0);
});

test("senza Premium le due pagine sono velate; chi non amministra legge il perché", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { no: "premium" });
  await page.evaluate(() => window.gdahomeApriIDispositivi());
  const pagina = page.locator("#page-dispositivi");
  await expect(pagina.locator(".ad-chiusa .carta h3")).toHaveText("Dispositivi");
  await expect(pagina.locator(".ad-chiusa .sotto [data-dv-disp]")).toHaveCount(4);
  await foto(page, testInfo, "dispositivi-premium");
  await page.evaluate(() => window.gdahomeApriGliAiutanti());
  await expect(page.locator("#page-dispositivi")).toHaveCount(0);
  await expect(page.locator("#page-aiutanti .ad-chiusa .carta h3")).toHaveText("Aiutanti");
  await foto(page, testInfo, "aiutanti-premium");
});

test("chi non amministra Home Assistant non vede niente, e legge perché", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { no: "vietato" });
  await page.evaluate(() => window.gdahomeApriIDispositivi());
  const pagina = page.locator("#page-dispositivi");
  await expect(pagina.locator(".ad-vuoto h3")).toHaveText("Solo per chi amministra");
  await expect(pagina.locator("[data-dv-disp]")).toHaveCount(0);
});
