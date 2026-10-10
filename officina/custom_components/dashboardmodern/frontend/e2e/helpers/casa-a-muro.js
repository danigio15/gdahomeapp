/* Una casa finta per la plancia a muro: tre stanze, luci, clima, tapparelle,
 * una centrale, una telecamera e le azioni. La usano le prove del pannello e
 * quelle della sua scheda nel config. */
import { bootNamespacedDashboard } from "./namespaced-dashboard.js";

export const SEME_A_MURO = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "soggiorno",
        name: "Soggiorno",
        temp: "sensor.soggiorno_temperatura",
        hum: "sensor.soggiorno_umidita",
      },
      { id: "cucina", name: "Cucina" },
    ],
    cameras: [{ id: "k1", name: "Cancello", entity: "camera.cancello" }],
    appliances: [],
    loads: [],
    lights: [
      {
        id: "l1",
        name: "Luci soggiorno",
        entity: "light.soggiorno",
        room_id: "soggiorno",
        room: "Soggiorno",
      },
      {
        id: "l2",
        name: "Luce tavolo",
        entity: "light.tavolo",
        room_id: "soggiorno",
        room: "Soggiorno",
      },
      { id: "l3", name: "Luci cucina", entity: "light.cucina", room_id: "cucina", room: "Cucina" },
    ],
    climate: [
      {
        id: "c1",
        name: "Clima",
        entity: "climate.soggiorno",
        room_id: "soggiorno",
        room: "Soggiorno",
      },
    ],
    ev: [],
    covers: [
      {
        id: "t1",
        name: "Tapparelle",
        entity: "cover.soggiorno",
        room_id: "soggiorno",
        room: "Soggiorno",
      },
    ],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: { "dm.security_centrale_allarme": "alarm_control_panel.casa" },
  },
  visibility: { home: true, lights: true, climate: true, covers: true },
};

export const AZIONI_A_MURO = [
  { name: "Buongiorno", type: "scene", entity: "scene.buongiorno" },
  { name: "Esco", type: "script", entity: "script.esco" },
  { name: "Rientro", type: "script", entity: "script.rientro" },
  { name: "Cena", type: "scene", entity: "scene.cena" },
  { name: "Cinema", type: "scene", entity: "scene.cinema" },
  { name: "Buonanotte", type: "script", entity: "script.buonanotte" },
];

export const STATI_A_MURO = {
  "light.soggiorno": {
    state: "on",
    attributes: {
      friendly_name: "Soggiorno",
      brightness: 179,
      supported_color_modes: ["color_temp", "hs"],
    },
  },
  "light.tavolo": {
    state: "off",
    attributes: { friendly_name: "Tavolo", supported_color_modes: ["brightness"] },
  },
  "light.cucina": {
    state: "on",
    attributes: { friendly_name: "Cucina", brightness: 255, supported_color_modes: ["brightness"] },
  },
  "climate.soggiorno": {
    state: "heat",
    attributes: {
      friendly_name: "Soggiorno",
      current_temperature: 21.2,
      temperature: 21.5,
      hvac_modes: ["off", "heat", "cool", "auto"],
      hvac_action: "heating",
      target_temp_step: 0.5,
      min_temp: 7,
      max_temp: 30,
    },
  },
  "cover.soggiorno": {
    state: "open",
    attributes: { friendly_name: "Tapparelle", current_position: 60 },
  },
  "sensor.soggiorno_temperatura": { state: "21.2", attributes: { unit_of_measurement: "°C" } },
  "sensor.soggiorno_umidita": { state: "54", attributes: { unit_of_measurement: "%" } },
  "weather.casa": { state: "partlycloudy", attributes: { temperature: 17 } },
  "alarm_control_panel.casa": {
    state: "disarmed",
    attributes: {
      friendly_name: "Casa",
      supported_features: 1 + 2 + 4,
      code_format: "number",
      code_arm_required: true,
    },
  },
  "camera.cancello": { state: "idle", attributes: { friendly_name: "Cancello" } },
  "button.apri_cancello": { state: "unknown", attributes: { friendly_name: "Apri cancello" } },
  "lock.porta": { state: "locked", attributes: { friendly_name: "Apri porta" } },
  "person.anna": { state: "home", attributes: { friendly_name: "Anna" } },
  "person.marco": { state: "home", attributes: { friendly_name: "Marco" } },
  "person.luca": { state: "not_home", attributes: { friendly_name: "Luca" } },
  "binary_sensor.finestra_cucina": {
    state: "on",
    attributes: { friendly_name: "Finestra cucina", device_class: "window" },
  },
  "binary_sensor.presenza": {
    state: "off",
    attributes: { friendly_name: "Presenza ingresso", device_class: "motion" },
  },
  "scene.buongiorno": { state: "scening" },
  "scene.cena": { state: "scening" },
  "scene.cinema": { state: "scening" },
  "script.esco": { state: "off" },
  "script.rientro": { state: "off" },
  "script.buonanotte": { state: "off" },
};

/** Apre la plancia con la casa finta, Premium o Base, e il config a muro dato. */
export async function apriLaCasaAMuro(
  page,
  testInfo,
  { premium = true, muro = null, stati = STATI_A_MURO } = {},
) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((p) => {
    window.__GDAHOME_PREMIUM__ = p;
    window.__SERVIZI__ = [];
  }, premium);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME_A_MURO);
  await page.evaluate(
    ({ letture, azioni, muro }) => {
      const raw = eval("_RAW_STATES");
      for (const [id, voce] of Object.entries(letture))
        raw[id] = { entity_id: id, state: voce.state, attributes: voce.attributes || {} };
      localStorage.setItem("cd_quick_actions", JSON.stringify(azioni));
      localStorage.setItem(
        "cd_people",
        JSON.stringify([
          { entity: "person.anna", name: "Anna" },
          { entity: "person.marco", name: "Marco" },
          { entity: "person.luca", name: "Luca" },
        ]),
      );
      if (muro) localStorage.setItem("cd_muro", JSON.stringify(muro));
      /* I comandi non vanno a Home Assistant: si annotano. */
      window.cdCallServiceJson = (domain, service, data) =>
        window.__SERVIZI__.push({ domain, service, data });
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      window.dispatchEvent(new CustomEvent("dashboardmodern:muro"));
    },
    { letture: stati, azioni: AZIONI_A_MURO, muro },
  );
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
}

export const MURO_DI_PROVA = {
  attiva: true,
  pagine: [
    { id: "p1", modello: "stanza", stanza: "Soggiorno" },
    {
      id: "p2",
      modello: "scene",
      scene: [
        { azione: "Buongiorno", sotto: "Tapparelle su, luci soft" },
        { azione: "Esco", sotto: "Tutto spento, antifurto inserito" },
        { azione: "Rientro", sotto: "Antifurto spento, ingresso acceso" },
        { azione: "Cena", sotto: "Luce calda sul tavolo" },
        { azione: "Cinema", sotto: "Luci al 10%, tapparelle giù" },
        { azione: "Buonanotte", sotto: "Spegne tutto, antifurto notte" },
      ],
    },
    {
      id: "p3",
      modello: "ingresso",
      ingresso: {
        centrale: "alarm_control_panel.casa",
        telecamera: "camera.cancello",
        apri: "button.apri_cancello",
        apri2: "lock.porta",
        esco: "Esco",
        rientro: "Rientro",
      },
    },
  ],
};
