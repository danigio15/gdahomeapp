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

  /* Una casa verosimile: quello che ha chiunque abbia Home Assistant da un
     anno. I nomi sono italiani perche' la plancia si fotografa in italiano. */
  const stato = (entity_id, state, attributes = {}) => ({
    entity_id,
    state: String(state),
    attributes,
    last_changed: ADESSO,
    last_updated: ADESSO,
    context: { id: entity_id, parent_id: null, user_id: null },
  });

  const LE_COSE = [
    stato("sun.sun", "above_horizon", { friendly_name: "Sole" }),
    stato("weather.casa", "sunny", {
      friendly_name: "Casa",
      temperature: 21.4,
      temperature_unit: "°C",
      humidity: 48,
      pressure: 1014,
      wind_speed: 6,
      forecast: [],
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
    location_name: "Casa",
    time_zone: "Europe/Rome",
    components: ["light", "climate", "sensor", "camera", "cover", "person", "weather"],
    config_dir: "/config",
    version: "2026.9.1",
    country: "IT",
    language: "it",
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
    name: "Casa",
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

  function risposta(detto) {
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
          { area_id: "soggiorno", name: "Soggiorno", picture: null },
          { area_id: "cucina", name: "Cucina", picture: null },
          { area_id: "camera", name: "Camera", picture: null },
          { area_id: "bagno", name: "Bagno", picture: null },
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
      const roba = risposta(detto);
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
