/* Una casa di prova per «Chiedi alla casa…».
 *
 * Gli stati come li manda Home Assistant, le aree come le dice il suo
 * registro, e quello che la plancia aggiunge di suo — le previsioni, l'energia
 * di adesso, le macchine, l'auto, l'agenda, i rifiuti. Mercoledi' 14 ottobre
 * 2026, alle tre del pomeriggio: Persona 1 e' in casa, Persona 2 e' al lavoro.
 */

const ORA = 3_600_000;

/** Le tre del pomeriggio del giorno della prova, nel fuso di chi la fa. */
export const ADESSO = new Date(2026, 9, 14, 15, 0, 0).getTime();

const fa = (ms) => new Date(ADESSO - ms).toISOString();
const alle = (giorni, ore, minuti = 0) => new Date(2026, 9, 14 + giorni, ore, minuti, 0).getTime();

function stato(entity, state, attributes = {}, cambiato = ORA) {
  return {
    entity_id: entity,
    state,
    attributes,
    last_changed: fa(cambiato),
    last_updated: fa(cambiato),
  };
}

export const AREE = {
  "light.soggiorno": "Soggiorno",
  "light.lampada_divano": "Soggiorno",
  "light.cucina": "Cucina",
  "light.pensile": "Cucina",
  "light.camera": "Camera da letto",
  "light.comodino": "Camera da letto",
  "light.bagno": "Bagno",
  "light.studio": "Studio",
  "light.giardino": "Giardino",
  "light.portico": "Giardino",
  "sensor.temp_soggiorno": "Soggiorno",
  "sensor.temp_cucina": "Cucina",
  "sensor.temp_camera": "Camera da letto",
  "sensor.temp_bagno": "Bagno",
  "sensor.umidita_soggiorno": "Soggiorno",
  "sensor.umidita_cucina": "Cucina",
  "sensor.umidita_camera": "Camera da letto",
  "sensor.umidita_bagno": "Bagno",
  "sensor.temp_esterna": "Giardino",
  "sensor.frigo_temperatura": "Cucina",
  "climate.camera": "Camera da letto",
  "climate.soggiorno": "Soggiorno",
  "cover.tapparella_soggiorno": "Soggiorno",
  "cover.tapparella_camera": "Camera da letto",
  "cover.cancello": "Giardino",
  "cover.garage": "Garage",
  "binary_sensor.finestra_camera": "Camera da letto",
  "binary_sensor.finestra_bagno": "Bagno",
  "binary_sensor.porta_ingresso": "Ingresso",
  "binary_sensor.frigo_porta": "Cucina",
  "lock.porta_ingresso": "Ingresso",
  "switch.presa_tv": "Soggiorno",
  "switch.macchina_caffe": "Cucina",
  "media_player.tv_sala": "Soggiorno",
  "fan.ventilatore_camera": "Camera da letto",
  "camera.cancello": "Giardino",
  "camera.giardino": "Giardino",
  "camera.ingresso": "Ingresso",
};

export function statiDiProva() {
  const s = {};
  const metti = (...voci) => {
    for (const v of voci) s[v.entity_id] = v;
  };
  metti(
    stato("person.persona_1", "home", { friendly_name: "Persona 1" }, 2 * ORA),
    stato("person.persona_2", "lavoro", { friendly_name: "Persona 2" }, 6 * ORA + 48 * 60_000),
    stato("zone.lavoro", "0", { friendly_name: "Lavoro" }),
    stato("zone.home", "1", { friendly_name: "Casa" }),

    stato("light.soggiorno", "on", { friendly_name: "Soggiorno" }),
    stato("light.lampada_divano", "on", { friendly_name: "Lampada divano" }),
    stato("light.cucina", "on", { friendly_name: "Cucina" }),
    stato("light.pensile", "off", { friendly_name: "Pensile" }),
    stato("light.camera", "off", { friendly_name: "Camera" }),
    stato("light.comodino", "off", { friendly_name: "Comodino" }),
    stato("light.bagno", "off", { friendly_name: "Bagno" }),
    stato("light.studio", "off", { friendly_name: "Lampada studio" }),
    stato("light.giardino", "off", { friendly_name: "Luci giardino" }),
    stato("light.portico", "unavailable", { friendly_name: "Portico" }),
    stato("light.tutte", "on", {
      friendly_name: "Tutte le luci",
      entity_id: ["light.soggiorno", "light.cucina"],
    }),

    stato("sensor.temp_soggiorno", "22.6", {
      friendly_name: "Temperatura soggiorno",
      device_class: "temperature",
      unit_of_measurement: "°C",
    }),
    stato("sensor.temp_cucina", "21.5", {
      friendly_name: "Temperatura cucina",
      device_class: "temperature",
      unit_of_measurement: "°C",
    }),
    stato("sensor.temp_camera", "19.8", {
      friendly_name: "Temperatura camera",
      device_class: "temperature",
      unit_of_measurement: "°C",
    }),
    stato("sensor.temp_bagno", "21.7", {
      friendly_name: "Temperatura bagno",
      device_class: "temperature",
      unit_of_measurement: "°C",
    }),
    stato("sensor.umidita_soggiorno", "52", {
      friendly_name: "Umidità soggiorno",
      device_class: "humidity",
      unit_of_measurement: "%",
    }),
    stato("sensor.umidita_cucina", "48", {
      friendly_name: "Umidità cucina",
      device_class: "humidity",
      unit_of_measurement: "%",
    }),
    stato("sensor.umidita_camera", "55", {
      friendly_name: "Umidità camera",
      device_class: "humidity",
      unit_of_measurement: "%",
    }),
    stato("sensor.umidita_bagno", "68", {
      friendly_name: "Umidità bagno",
      device_class: "humidity",
      unit_of_measurement: "%",
    }),
    stato("sensor.temp_esterna", "14.2", {
      friendly_name: "Temperatura esterna",
      device_class: "temperature",
      unit_of_measurement: "°C",
    }),
    stato("sensor.frigo_temperatura", "4", {
      friendly_name: "Frigo temperatura",
      device_class: "temperature",
      unit_of_measurement: "°C",
    }),

    stato("weather.casa", "cloudy", {
      friendly_name: "Casa",
      temperature: 13.8,
      humidity: 71,
      wind_speed: 12,
    }),

    stato("climate.camera", "heat", {
      friendly_name: "Termostato camera",
      current_temperature: 19.8,
      temperature: 20,
      target_temp_step: 0.5,
      min_temp: 7,
      max_temp: 30,
    }),
    stato("climate.soggiorno", "heat", {
      friendly_name: "Termostato soggiorno",
      current_temperature: 22.4,
      temperature: 21,
      target_temp_step: 0.5,
    }),

    stato("cover.tapparella_soggiorno", "open", {
      friendly_name: "Tapparella soggiorno",
      device_class: "shutter",
      current_position: 100,
    }),
    stato("cover.tapparella_camera", "closed", {
      friendly_name: "Tapparella camera",
      device_class: "shutter",
      current_position: 0,
    }),
    stato("cover.cancello", "closed", { friendly_name: "Cancello", device_class: "gate" }),
    stato("cover.garage", "closed", { friendly_name: "Basculante garage", device_class: "garage" }),

    stato(
      "binary_sensor.finestra_camera",
      "on",
      { friendly_name: "Finestra camera", device_class: "window" },
      40 * 60_000,
    ),
    stato("binary_sensor.finestra_bagno", "off", {
      friendly_name: "Finestra bagno",
      device_class: "window",
    }),
    stato("binary_sensor.porta_ingresso", "off", {
      friendly_name: "Porta ingresso",
      device_class: "door",
    }),
    stato("binary_sensor.frigo_porta", "on", {
      friendly_name: "Porta frigo",
      device_class: "door",
    }),

    stato("lock.porta_ingresso", "locked", { friendly_name: "Serratura ingresso" }),
    stato("alarm_control_panel.casa", "disarmed", {
      friendly_name: "Antifurto",
      code_format: "number",
      code_arm_required: true,
    }),

    stato("switch.presa_tv", "on", { friendly_name: "Presa TV" }),
    stato("switch.macchina_caffe", "off", { friendly_name: "Macchina caffè" }),
    stato("media_player.tv_sala", "on", { friendly_name: "TV Sala" }),
    stato("fan.ventilatore_camera", "off", { friendly_name: "Ventilatore" }),

    stato("camera.cancello", "idle", { friendly_name: "Cancello" }),
    stato("camera.giardino", "idle", { friendly_name: "Giardino" }),
    stato("camera.ingresso", "idle", { friendly_name: "Ingresso" }),

    stato("update.home_assistant_core_update", "on", {
      friendly_name: "Home Assistant Core Update",
      title: "Home Assistant Core",
      latest_version: "2026.10.2",
    }),
    stato("update.esphome_update", "on", {
      friendly_name: "ESPHome Update",
      title: "ESPHome",
      latest_version: "2026.10.0",
    }),
    stato("update.zigbee_update", "off", { friendly_name: "Zigbee Update", title: "Zigbee" }),

    stato("sensor.sensore_porta_batteria", "8", {
      friendly_name: "Sensore porta batteria",
      device_class: "battery",
      unit_of_measurement: "%",
    }),
    stato("sensor.telecomando_batteria", "15", {
      friendly_name: "Telecomando batteria",
      device_class: "battery",
      unit_of_measurement: "%",
    }),
    stato("sensor.termometro_batteria", "80", {
      friendly_name: "Termometro batteria",
      device_class: "battery",
      unit_of_measurement: "%",
    }),
    stato("sensor.accumulo_soc", "76", {
      friendly_name: "Batteria accumulo SOC",
      device_class: "battery",
      unit_of_measurement: "%",
    }),

    stato("sensor.consumo_casa_oggi", "8.4", {
      friendly_name: "Consumo casa oggi",
      device_class: "energy",
      unit_of_measurement: "kWh",
    }),
    stato("sensor.produzione_fotovoltaico_oggi", "12.6", {
      friendly_name: "Produzione fotovoltaico oggi",
      device_class: "energy",
      unit_of_measurement: "kWh",
    }),
    stato("sensor.prelievo_rete_oggi", "3.1", {
      friendly_name: "Prelievo rete oggi",
      device_class: "energy",
      unit_of_measurement: "kWh",
    }),
  );
  return s;
}

/** Le fonti di `sapereDellaCasa` per questa casa: quello che darebbe la plancia. */
export function fontiDiProva(cambia = {}) {
  return {
    states: statiDiProva(),
    adesso: ADESSO,
    areaDi: AREE,
    aree: [
      "Soggiorno",
      "Cucina",
      "Camera da letto",
      "Bagno",
      "Studio",
      "Ingresso",
      "Garage",
      "Giardino",
    ],
    meteo: "weather.casa",
    previsioni: {
      giorni: [
        {
          datetime: new Date(alle(0, 12)).toISOString(),
          condition: "cloudy",
          temperature: 17,
          templow: 9,
          precipitation_probability: 20,
        },
        {
          datetime: new Date(alle(1, 12)).toISOString(),
          condition: "rainy",
          temperature: 13,
          templow: 8,
          precipitation_probability: 80,
        },
        {
          datetime: new Date(alle(2, 12)).toISOString(),
          condition: "sunny",
          temperature: 18,
          templow: 10,
          precipitation_probability: 0,
        },
        {
          datetime: new Date(alle(3, 12)).toISOString(),
          condition: "partlycloudy",
          temperature: 19,
          templow: 11,
          precipitation_probability: 10,
        },
      ],
    },
    energia: { solare: 2400, rete: -300, casa: 1200, batteria: -900, soc: 76 },
    elettrodomestici: [
      { name: "Lavatrice", mode: "running", type: "lavatrice", restano: 25 * 60 },
      { name: "Lavastoviglie", mode: "idle", type: "lavastoviglie" },
    ],
    auto: [{ nome: "Auto", percentuale: 64, km: 280, inCarica: true, fine: "2 h alla fine" }],
    eventi: [
      { summary: "Dentista", inizio: alle(0, 17, 30), fine: alle(0, 18, 30) },
      { summary: "Cena con gli amici", inizio: alle(0, 20), fine: alle(0, 23) },
      { summary: "Riunione", inizio: alle(1, 9), fine: alle(1, 10) },
    ],
    rifiuti: [
      { name: "Plastica", quando: "domani", giorni: 1 },
      { name: "Carta", quando: "domani", giorni: 1 },
      { name: "Umido", quando: "sabato", giorni: 3 },
    ],
    ...cambia,
  };
}
