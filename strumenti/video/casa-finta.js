/* Una casa che non c'e', per far girare la plancia vera.
 *
 * La plancia ospitata non apre un WebSocket verso Home Assistant: apre quello
 * che le da' chi la ospita — `window.__DASHBOARDMODERN_BRIDGE_WS__` — ed e'
 * cosi' che l'app le fa da casa (`app/lib/plancia/`) e che il ponte le fa da
 * casa dentro Home Assistant (`ponte/src/cucitura.js`).
 *
 * Questa e' la terza: una casa **finta**, che sta tutta dentro il browser e
 * risponde come risponderebbe Home Assistant. Serve a una cosa sola — poter
 * fotografare la plancia **vera** per le copertine e i video, senza una casa
 * accesa da qualche parte.
 *
 * Non e' un pezzo del prodotto e non deve diventarlo: le entita' qui dentro
 * sono inventate, e si vedono solo nelle immagini.
 */
(function () {
  "use strict";

  const ADESSO = "2026-09-16T09:41:00.000+02:00";

  /* In che lingua si fotografa. Lo dice chi apre la pagina
     (`plancia-vera.mjs`), prima di ogni altro codice. */
  const LINGUA = window.__CASA_FINTA_LINGUA__ === "en" ? "en" : "it";

  /* I nomi delle cose di casa, in inglese.
   *
   * Non e' un vezzo: in una copertina inglese una tessera che dice «CLIMATE»
   * con sotto «Termostato» si vede, ed e' l'unica cosa che tradisce che la
   * fotografia e' stata presa da un'altra parte. Chi ha Home Assistant in
   * inglese le sue entita' le ha chiamate cosi'. */
  const IN_INGLESE = {
    Sole: "Sun",
    Casa: "Home",
    Soggiorno: "Living room",
    Cucina: "Kitchen",
    Camera: "Bedroom",
    Bagno: "Bathroom",
    Studio: "Study",
    "Presa TV": "TV socket",
    Termostato: "Thermostat",
    "Temperatura soggiorno": "Living room temperature",
    "Umidità soggiorno": "Living room humidity",
    "Temperatura camera": "Bedroom temperature",
    "Potenza casa": "Home power",
    "Energia oggi": "Energy today",
    "Produzione solare": "Solar production",
    "Porta d'ingresso": "Front door",
    "Finestra cucina": "Kitchen window",
    "Tapparella soggiorno": "Living room blind",
    "Tapparella camera": "Bedroom blind",
    Ingresso: "Entrance",
    Giardino: "Garden",
    Garage: "Garage",
    Cortile: "Yard",
    "TV soggiorno": "Living room TV",
    "Batteria di Daniele": "Daniele's battery",
    "Batteria di Giulia": "Giulia's battery",
    "Batteria di Marco": "Marco's battery",
    Antifurto: "Alarm",
    Portone: "Front gate",
    Robot: "Robot",
    Auto: "Car",
    "Temperatura esterna": "Outdoor temperature",
    "Umidità esterna": "Outdoor humidity",
    Vento: "Wind",
    "Qualità dell'aria": "Air quality",
    Irrigazione: "Irrigation",
    Agenda: "Calendar",
    "Manutenzione caldaia": "Boiler service",
  };

  const inLingua = (parola) => (LINGUA === "en" && IN_INGLESE[parola]) || parola;

  /* Una casa verosimile: quello che ha chiunque abbia Home Assistant da un
     anno. I nomi sono scritti in italiano e tradotti qui sopra: la plancia si
     fotografa in tutte e due le lingue. */
  const stato = (entity_id, state, attributes = {}) => ({
    entity_id,
    state: String(state),
    attributes: Object.assign({}, attributes, {
      ...(attributes.friendly_name ? { friendly_name: inLingua(attributes.friendly_name) } : {}),
      ...(attributes.message ? { message: inLingua(attributes.message) } : {}),
    }),
    last_changed: ADESSO,
    last_updated: ADESSO,
    context: { id: entity_id, parent_id: null, user_id: null },
  });

  const LE_COSE = [
    stato("sun.sun", "above_horizon", { friendly_name: "Sole" }),
    /* Il meteo con le sue previsioni **negli attributi**: la plancia le legge
       da li'. Senza, in cima resta la striscia vuota che si era vista. */
    stato("weather.casa", "sunny", {
      friendly_name: "Casa",
      temperature: 21.4,
      apparent_temperature: 21,
      temperature_unit: "°C",
      humidity: 48,
      pressure: 1014,
      pressure_unit: "hPa",
      wind_speed: 6,
      wind_speed_unit: "km/h",
      wind_bearing: 210,
      visibility: 20,
      visibility_unit: "km",
      precipitation_unit: "mm",
      attribution: "Casa finta",
      supported_features: 3,
      forecast: [
        {
          datetime: "2026-09-16T12:00:00+02:00",
          condition: "sunny",
          temperature: 24,
          templow: 15,
          precipitation: 0,
          precipitation_probability: 0,
          wind_speed: 7,
          humidity: 45,
        },
        {
          datetime: "2026-09-17T12:00:00+02:00",
          condition: "partlycloudy",
          temperature: 23,
          templow: 14,
          precipitation: 0,
          precipitation_probability: 10,
          wind_speed: 9,
          humidity: 52,
        },
        {
          datetime: "2026-09-18T12:00:00+02:00",
          condition: "rainy",
          temperature: 19,
          templow: 13,
          precipitation: 6.2,
          precipitation_probability: 80,
          wind_speed: 14,
          humidity: 76,
        },
        {
          datetime: "2026-09-19T12:00:00+02:00",
          condition: "cloudy",
          temperature: 20,
          templow: 12,
          precipitation: 0.4,
          precipitation_probability: 30,
          wind_speed: 11,
          humidity: 63,
        },
        {
          datetime: "2026-09-20T12:00:00+02:00",
          condition: "sunny",
          temperature: 22,
          templow: 12,
          precipitation: 0,
          precipitation_probability: 0,
          wind_speed: 6,
          humidity: 48,
        },
      ],
    }),
    stato("light.soggiorno", "on", {
      friendly_name: "Soggiorno",
      brightness: 196,
      color_mode: "brightness",
      supported_color_modes: ["brightness"],
    }),
    stato("light.cucina", "on", { friendly_name: "Cucina", brightness: 220 }),
    stato("light.camera", "off", { friendly_name: "Camera" }),
    stato("light.bagno", "on", { friendly_name: "Bagno", brightness: 120 }),
    stato("light.studio", "off", { friendly_name: "Studio" }),
    stato("switch.presa_tv", "on", { friendly_name: "Presa TV" }),
    stato("climate.soggiorno", "heat", {
      friendly_name: "Termostato",
      current_temperature: 21.4,
      temperature: 21,
      hvac_modes: ["off", "heat"],
      min_temp: 7,
      max_temp: 28,
      supported_features: 1,
    }),
    stato("sensor.temperatura_soggiorno", "21.4", {
      friendly_name: "Temperatura soggiorno",
      unit_of_measurement: "°C",
      device_class: "temperature",
      state_class: "measurement",
    }),
    stato("sensor.umidita_soggiorno", "48", {
      friendly_name: "Umidità soggiorno",
      unit_of_measurement: "%",
      device_class: "humidity",
    }),
    stato("sensor.temperatura_camera", "19.8", {
      friendly_name: "Temperatura camera",
      unit_of_measurement: "°C",
      device_class: "temperature",
    }),
    stato("sensor.potenza_casa", "1240", {
      friendly_name: "Potenza casa",
      unit_of_measurement: "W",
      device_class: "power",
      state_class: "measurement",
    }),
    stato("sensor.energia_oggi", "8.4", {
      friendly_name: "Energia oggi",
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    }),
    stato("sensor.produzione_solare", "2100", {
      friendly_name: "Produzione solare",
      unit_of_measurement: "W",
      device_class: "power",
    }),
    stato("binary_sensor.porta_ingresso", "off", {
      friendly_name: "Porta d'ingresso",
      device_class: "door",
    }),
    stato("binary_sensor.finestra_cucina", "on", {
      friendly_name: "Finestra cucina",
      device_class: "window",
    }),
    stato("cover.tapparella_soggiorno", "open", {
      friendly_name: "Tapparella soggiorno",
      current_position: 100,
      device_class: "shutter",
      supported_features: 15,
    }),
    stato("cover.tapparella_camera", "closed", {
      friendly_name: "Tapparella camera",
      current_position: 0,
      device_class: "shutter",
      supported_features: 15,
    }),
    stato("camera.ingresso", "idle", { friendly_name: "Ingresso", entity_picture: "" }),
    stato("camera.giardino", "idle", { friendly_name: "Giardino", entity_picture: "" }),
    stato("camera.garage", "idle", { friendly_name: "Garage", entity_picture: "" }),
    stato("camera.cortile", "idle", { friendly_name: "Cortile", entity_picture: "" }),
    stato("media_player.soggiorno", "paused", {
      friendly_name: "TV soggiorno",
      media_title: "—",
      supported_features: 84159,
    }),
    stato("person.daniele", "home", { friendly_name: "Daniele" }),
    stato("person.giulia", "home", { friendly_name: "Giulia" }),
    stato("person.marco", "not_home", { friendly_name: "Marco" }),
    stato("sensor.batteria_daniele", "78", {
      friendly_name: "Batteria di Daniele",
      unit_of_measurement: "%",
      device_class: "battery",
    }),
    stato("sensor.batteria_giulia", "54", {
      friendly_name: "Batteria di Giulia",
      unit_of_measurement: "%",
      device_class: "battery",
    }),
    stato("sensor.batteria_marco", "31", {
      friendly_name: "Batteria di Marco",
      unit_of_measurement: "%",
      device_class: "battery",
    }),
    stato("alarm_control_panel.casa", "armed_home", {
      friendly_name: "Antifurto",
      supported_features: 15,
    }),
    stato("lock.portone", "locked", { friendly_name: "Portone" }),
    stato("vacuum.robot", "docked", { friendly_name: "Robot", battery_level: 100 }),
    stato("sensor.auto_batteria", "82", {
      friendly_name: "Auto",
      unit_of_measurement: "%",
      device_class: "battery",
    }),
    /* Il meteo di fuori: i numeri che la plancia mette accanto al nome della
       casa, ognuno nel suo posto (`dm.home_meteo_*`). */
    stato("sensor.temperatura_esterna", "18.6", {
      friendly_name: "Temperatura esterna",
      unit_of_measurement: "°C",
      device_class: "temperature",
      state_class: "measurement",
    }),
    stato("sensor.umidita_esterna", "61", {
      friendly_name: "Umidità esterna",
      unit_of_measurement: "%",
      device_class: "humidity",
    }),
    stato("sensor.vento", "8", {
      friendly_name: "Vento",
      unit_of_measurement: "km/h",
      device_class: "wind_speed",
    }),
    stato("sensor.qualita_aria", "18", {
      friendly_name: "Qualità dell'aria",
      unit_of_measurement: "µg/m³",
      device_class: "pm25",
    }),
    stato("switch.irrigazione", "off", { friendly_name: "Irrigazione" }),
    stato("calendar.casa", "off", { friendly_name: "Agenda", message: "Manutenzione caldaia" }),
  ];

  const CONFIGURAZIONE = {
    latitude: 45.07,
    longitude: 7.69,
    elevation: 239,
    unit_system: {
      length: "km",
      mass: "kg",
      temperature: "°C",
      volume: "L",
      pressure: "hPa",
      wind_speed: "km/h",
      accumulated_precipitation: "mm",
    },
    location_name: inLingua("Casa"),
    time_zone: "Europe/Rome",
    components: ["light", "climate", "sensor", "camera", "cover", "person", "weather"],
    config_dir: "/config",
    version: "2026.9.1",
    country: "IT",
    language: LINGUA,
    currency: "EUR",
    state: "RUNNING",
    safe_mode: false,
    config_source: "storage",
    allowlist_external_dirs: [],
    allowlist_external_urls: [],
    internal_url: null,
    external_url: null,
  };

  const UTENTE = {
    id: "gdahome",
    name: inLingua("Casa"),
    is_owner: true,
    is_admin: true,
    credentials: [],
    mfa_modules: [],
  };

  /* La configurazione della plancia: la stessa busta che tiene il ponte
   * (`ponte/src/configurazione.js`), qui tenuta nel browser.
   *
   * Sta in `localStorage` e non in una variabile perche' quando la plancia si
   * configura da sola **si ricarica**, e una variabile non sopravvive a un
   * ricarico: al secondo giro si ritroverebbe vuota come al primo. */
  const CHIAVE = "casa-finta-busta";

  function bustaSalvata() {
    try {
      const roba = window.localStorage.getItem(CHIAVE);
      return roba ? JSON.parse(roba) : null;
    } catch (_errore) {
      return null;
    }
  }

  function salvaLaBusta(busta) {
    try {
      window.localStorage.setItem(CHIAVE, JSON.stringify(busta));
    } catch (_errore) {
      /* senza memoria si riparte da capo, non si rompe niente */
    }
  }

  function laBusta() {
    return (
      bustaSalvata() ||
      window.__CASA_FINTA_BUSTA__ || {
        revision: 0,
        updated_at: 0,
        keys_revision: 0,
        writer_generation: 0,
        reset: false,
        values: {},
      }
    );
  }

  const scatto = () => {
    const busta = laBusta();
    return {
      profile: "primary",
      requested_profile: null,
      snapshot: {
        revision: busta.revision || 0,
        updated_at: busta.updated_at || 0,
        keys_revision: busta.keys_revision || 0,
        writer_generation: busta.writer_generation || 0,
        reset: false,
        values: busta.values || {},
      },
      recoverable: [],
      profiles: ["primary"],
    };
  };

  /* Quello che non si sa ancora rispondere si logga e si risponde «niente»:
     e' cosi' che si scopre cosa chiede davvero la plancia. */
  const CHIESTO = (window.__CASA_FINTA_CHIESTO__ = []);

  /* `manda` arriva da fuori perche' un paio di comandi non si esauriscono in
     una risposta: le previsioni del meteo arrivano come **evento**, dopo. */
  function risposta(detto, manda) {
    const tipo = detto.type;
    switch (tipo) {
      case "get_states":
        return LE_COSE;
      case "get_config":
        return CONFIGURAZIONE;
      case "get_services":
        return {};
      case "get_panels":
        return {};
      case "auth/current_user":
        return UTENTE;
      case "config/area_registry/list":
        return [
          { area_id: "soggiorno", name: inLingua("Soggiorno"), picture: null },
          { area_id: "cucina", name: inLingua("Cucina"), picture: null },
          { area_id: "camera", name: inLingua("Camera"), picture: null },
          { area_id: "bagno", name: inLingua("Bagno"), picture: null },
        ];
      case "config/device_registry/list":
        return [];
      case "config/entity_registry/list":
        return LE_COSE.map((cosa) => ({
          entity_id: cosa.entity_id,
          name: null,
          icon: null,
          platform: "demo",
          area_id: null,
          device_id: null,
          disabled_by: null,
          hidden_by: null,
          entity_category: null,
        }));
      case "config/label_registry/list":
      case "config/floor_registry/list":
      case "config/category_registry/list":
        return [];
      case "frontend/get_user_data":
        return { value: null };
      case "frontend/get_translations":
        return { resources: {} };
      case "persistent_notification/subscribe":
      case "subscribe_events":
      case "subscribe_entities":
      case "subscribe_trigger":
        return null;
      case "dashboardmodern/config/get":
        return scatto();
      case "dashboardmodern/config/set": {
        const busta = laBusta();
        salvaLaBusta({
          revision: (busta.revision || 0) + 1,
          updated_at: Date.now(),
          keys_revision: (busta.keys_revision || 0) + 1,
          writer_generation: busta.writer_generation || 1,
          reset: false,
          values: Object.assign({}, busta.values, detto.values || {}),
        });
        return scatto();
      }
      case "dashboardmodern/clima/timer/list":
        return { timers: [] };
      case "dashboardmodern/tickets/list":
        return { tickets: [] };
      /* Le previsioni, come le chiede Home Assistant di oggi: chi le chiede
         cosi' le riceve una volta e basta, e alla plancia basta. */
      case "weather/subscribe_forecast": {
        const meteo = LE_COSE.find((cosa) => cosa.entity_id === detto.entity_id);
        const previsioni = meteo?.attributes?.forecast || [];
        setTimeout(() => {
          manda({
            id: detto.id,
            type: "event",
            event: { type: detto.forecast_type || "daily", forecast: previsioni },
          });
        }, 0);
        return null;
      }
      case "dashboardmodern/integrations/catalog":
        return { integrazioni: [] };
      case "dashboardmodern/www/list":
        return { foto: [] };
      case "dashboardmodern/chat/state":
        return { aperta: false, messaggi: [] };
      default:
        CHIESTO.push(tipo);
        return null;
    }
  }

  window.CasaFinta = function CasaFinta(indirizzo) {
    const presa = this;
    this.url = String(indirizzo || "");
    this.readyState = 0;
    this.protocol = "";
    this.extensions = "";
    this.bufferedAmount = 0;
    this.binaryType = "blob";
    const ascolto = {};

    const fai = (tipo, roba) => {
      const evento = Object.assign({ type: tipo, target: presa }, roba);
      (ascolto[tipo] || []).forEach((chi) => chi.call(presa, evento));
      const suo = presa["on" + tipo];
      if (typeof suo === "function") suo.call(presa, evento);
    };
    const manda = (oggetto) => fai("message", { data: JSON.stringify(oggetto) });

    this.addEventListener = (tipo, chi) => {
      (ascolto[tipo] = ascolto[tipo] || []).push(chi);
    };
    this.removeEventListener = (tipo, chi) => {
      ascolto[tipo] = (ascolto[tipo] || []).filter((quale) => quale !== chi);
    };
    this.close = () => {
      if (presa.readyState === 3) return;
      presa.readyState = 3;
      fai("close", { code: 1000, reason: "", wasClean: true });
    };
    this.send = (testo) => {
      let detto;
      try {
        detto = JSON.parse(testo);
      } catch (_errore) {
        return;
      }
      if (!detto || detto.type === "auth") return;
      if (detto.type === "ping") {
        manda({ id: detto.id, type: "pong" });
        return;
      }
      const roba = risposta(detto, manda);
      manda({ id: detto.id, type: "result", success: true, result: roba });
    };

    setTimeout(() => {
      presa.readyState = 1;
      fai("open", {});
      manda({ type: "auth_ok", ha_version: "gdahome" });
    }, 0);
  };
  window.CasaFinta.CONNECTING = 0;
  window.CasaFinta.OPEN = 1;
  window.CasaFinta.CLOSING = 2;
  window.CasaFinta.CLOSED = 3;
})();
