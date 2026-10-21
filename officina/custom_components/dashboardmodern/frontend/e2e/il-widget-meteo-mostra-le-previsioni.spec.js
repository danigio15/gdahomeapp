/* Il widget Meteo nella Home.
 *
 * Dal campo: «sarebbe bello mettere anche un widget delle previsioni del
 * meteo, senza aprire il radar». Una tessera fra i widget, coi dati della
 * sezione Meteo: i gradi e il cielo; toccandola, le prossime ore e i prossimi
 * giorni. Il radar resta nella pagina Meteo.
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
    lights: [{ id: "l1", name: "Cucina", entity: "light.cucina" }],
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

/* Un quadratino trasparente: le tessere della mappa e della pioggia. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/* Le caselle della testata: nel seme, cioe' nella configurazione condivisa,
 * che e' da dove il guscio le rilegge. Scritte solo in memoria non
 * sopravviverebbero al primo salvataggio di un'altra chiave. */
const SOLO_METEO = { "dm.home_meteo": "weather.casa" };
const CON_STAZIONE = {
  ...SOLO_METEO,
  "dm.home_meteo_temperatura": "sensor.gw1100a_outdoor_temperature",
  "dm.home_meteo_umidita": "sensor.gw1100a_humidity",
  "dm.home_meteo_vento": "sensor.gw1100a_wind_speed",
  "dm.home_meteo_vento_direzione": "sensor.gw1100a_wind_direction",
};

async function boot(page, testInfo, { radar = null, caselle = SOLO_METEO } = {}) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  const chiesti = { pioggia: 0, fondo: 0 };
  await page.route("https://**", (route) => {
    const indirizzo = route.request().url();
    if (indirizzo.startsWith("https://api.rainviewer.com/")) {
      const adesso = Math.floor(Date.now() / 1000);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          host: "https://tilecache.rainviewer.com",
          radar: {
            past: [0, 1, 2].map((indice) => ({
              time: adesso - (2 - indice) * 600,
              path: `/v2/radar/finto${indice}`,
            })),
          },
        }),
      });
    }
    if (indirizzo.startsWith("https://tilecache.rainviewer.com/")) {
      chiesti.pioggia += 1;
      return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    }
    if (indirizzo.startsWith("https://server.arcgisonline.com/")) {
      chiesti.fondo += 1;
      return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    }
    return route.fulfill({ status: 200, body: "" });
  });
  await page.addInitScript((configurazione) => {
    /* Le domande a Home Assistant: le previsioni e la cronologia rispondono,
     * e si contano. */
    const H = 3600000;
    window.__w206 = { previsioni: [], storia: [] };
    const previsioni = (tipo, entita) => {
      const adesso = Date.now();
      if (tipo === "hourly") {
        const ora = Math.floor(adesso / H) * H;
        return Array.from({ length: 24 }, (_, indice) => {
          const pioggia = indice >= 2 && indice <= 8;
          return {
            datetime: new Date(ora + indice * H).toISOString(),
            condition: pioggia ? "rainy" : "partlycloudy",
            temperature: 18 - indice * 0.3,
            precipitation_probability: pioggia ? 70 : 10,
            precipitation: pioggia ? 0.5 : 0,
          };
        });
      }
      const mezzanotte = new Date(adesso);
      mezzanotte.setHours(0, 0, 0, 0);
      return Array.from({ length: 7 }, (_, indice) => {
        const giorno = new Date(mezzanotte);
        giorno.setDate(giorno.getDate() + indice);
        return {
          datetime: giorno.toISOString(),
          condition: indice < 2 ? "rainy" : "sunny",
          temperature: 20 + indice,
          templow: 11 + (indice % 3),
          precipitation_probability: indice < 2 ? 60 : 0,
          precipitation: indice < 2 ? 3.1 : 0,
          entita,
        };
      });
    };
    const storia = (entita) => {
      const adesso = Date.now();
      const fuori = {};
      for (const entity of entita) {
        fuori[entity] = Array.from({ length: 25 }, (_, indice) => {
          const quando = adesso - (24 - indice) * H;
          /* La pressione scende di quattro ettopascal nelle ultime tre ore: da
           * 1013 a 1009, che e' lo stato di adesso. */
          const valore = entity.includes("pressure")
            ? indice <= 21
              ? 1013
              : 1013 - (indice - 21) * 1.3
            : entity.includes("daily_rain")
              ? indice < 10
                ? 0
                : 2.8
              : 10 + indice / 3;
          return { s: String(valore), lu: quando / 1000 };
        });
      }
      return fuori;
    };
    class MockSocket extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      onopen = null;
      onmessage = null;
      constructor() {
        super();
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === "auth") return;
        let result = null;
        if (message.type === "get_states") result = [];
        else if (message.type === "frontend/get_user_data") result = { value: null };
        else if (message.type === "get_config") result = { latitude: 44.5, longitude: 11.3 };
        else if (message.type === "call_service" && message.service === "get_forecasts") {
          const entita = message.target?.entity_id;
          window.__w206.previsioni.push(message.service_data?.type);
          result = {
            response: { [entita]: { forecast: previsioni(message.service_data?.type, entita) } },
          };
        } else if (message.type === "history/history_during_period") {
          window.__w206.storia.push(message.entity_ids);
          result = storia(message.entity_ids || []);
        }
        this.onmessage?.({
          data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
        });
      }
      close() {}
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
    window.WebSocket = MockSocket;
    if (configurazione) {
      const originale = Storage.prototype.getItem;
      Storage.prototype.getItem = function (chiave) {
        if (String(chiave).endsWith("cd_radar_meteo")) return JSON.stringify(configurazione);
        return originale.call(this, chiave);
      };
    }
  }, radar);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, {
    ...SEME,
    sections: { ...SEME.sections, entityOverrides: caselle },
  });
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  return chiesti;
}

/* La casa: l'entità weather, il sole, e se serve la stazione. */
async function casa(page, { stazione = true } = {}) {
  await page.evaluate((conStazione) => {
    const metti = (id, state, attributes = {}) => {
      _RAW_STATES[id] = {
        entity_id: id,
        state: String(state),
        attributes,
        last_updated: new Date(Date.now() - 60000).toISOString(),
      };
    };
    metti("weather.casa", "partlycloudy", {
      friendly_name: "Casa",
      temperature: 18.6,
      apparent_temperature: 17.9,
      humidity: 64,
      pressure: 1014,
      pressure_unit: "hPa",
      wind_speed: 12,
      wind_speed_unit: "km/h",
      wind_bearing: 230,
      temperature_unit: "°C",
      precipitation_unit: "mm",
    });
    const domani = (ore) => new Date(Date.now() + ore * 3600000).toISOString();
    metti("sun.sun", "above_horizon", { next_rising: domani(14), next_setting: domani(1) });
    if (conStazione) {
      metti("sensor.gw1100a_outdoor_temperature", 18.4, {
        device_class: "temperature",
        unit_of_measurement: "°C",
      });
      metti("sensor.gw1100a_humidity", 66, { device_class: "humidity", unit_of_measurement: "%" });
      metti("sensor.gw1100a_relative_pressure", 1009, {
        device_class: "atmospheric_pressure",
        unit_of_measurement: "hPa",
      });
      metti("sensor.gw1100a_wind_speed", 14, {
        device_class: "wind_speed",
        unit_of_measurement: "km/h",
      });
      metti("sensor.gw1100a_wind_gust", 31, {
        device_class: "wind_speed",
        unit_of_measurement: "km/h",
      });
      metti("sensor.gw1100a_wind_direction", 225, { unit_of_measurement: "°" });
      metti("sensor.gw1100a_daily_rain", 2.8, {
        device_class: "precipitation",
        unit_of_measurement: "mm",
      });
      metti("sensor.gw1100a_rain_rate", 0, {
        device_class: "precipitation_intensity",
        unit_of_measurement: "mm/h",
      });
      metti("sensor.gw1100a_uv_index", 3, { unit_of_measurement: "UV index" });
      metti("sensor.gw1100a_solar_radiation", 312, {
        device_class: "irradiance",
        unit_of_measurement: "W/m²",
      });
      localStorage.setItem(
        "cd_barra_casa",
        JSON.stringify({
          pioggia: "sensor.gw1100a_rain_rate",
          pioggiaOggi: "sensor.gw1100a_daily_rain",
        }),
      );
      localStorage.setItem(
        "cd_meteo",
        JSON.stringify({
          pressione: "sensor.gw1100a_relative_pressure",
          raffica: "sensor.gw1100a_wind_gust",
          uv: "sensor.gw1100a_uv_index",
          radiazione: "sensor.gw1100a_solar_radiation",
        }),
      );
    }
    window.render?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
  }, stazione);
}

test("il widget Meteo: i gradi e il cielo sulla tessera, le ore e i giorni nella finestra", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await page.evaluate(() => {
    _RAW_STATES["light.cucina"] = {
      entity_id: "light.cucina",
      state: "off",
      attributes: { friendly_name: "Cucina" },
    };
  });
  await casa(page, { stazione: false });
  await page.locator('.tab[data-tab="home"]').evaluate((n) => n.click());
  const tessera = page.locator('#dm-widgets .dm-tile[data-dm-widget="meteo"]');
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  await expect(tessera.locator(".dm-tile-value")).toContainText("18,6");
  /* Arrivate le previsioni, la didascalia porta anche la massima e la minima. */
  await expect(tessera).toContainText("Poco nuvoloso", { timeout: 20_000 });
  await expect(tessera).toContainText("20° / 11°", { timeout: 20_000 });
  if (process.env.DM_RENDER_DIR)
    await page.locator("#dm-widgets").screenshot({
      path: `${process.env.DM_RENDER_DIR}/widget-meteo-tessera-${testInfo.project.name}.png`,
    });
  await tessera.click();
  const finestra = page.locator("#dm-widget-popup");
  await expect(finestra.locator(".dm-f-mt")).toBeVisible();
  await expect(finestra.locator(".dm-f-mt-gradi")).toContainText("18,6");
  await expect(finestra.locator(".dm-f-mt-ora")).toHaveCount(12);
  await expect(finestra.locator(".dm-f-mt-giorno")).toHaveCount(5);
  await expect(finestra.locator(".dm-f-mt-frase")).toContainText("Pioggia");
  /* Niente radar qui: sta nella pagina Meteo. */
  await expect(finestra.locator("canvas, .dm-radar, [data-dm-radar]")).toHaveCount(0);
  if (process.env.DM_RENDER_DIR)
    await finestra.screenshot({
      path: `${process.env.DM_RENDER_DIR}/widget-meteo-finestra-${testInfo.project.name}.png`,
    });
  /* I giorni stanno sotto: si scorre fin li'. */
  await finestra.locator(".dm-f-mt-giorno").last().scrollIntoViewIfNeeded();
  if (process.env.DM_RENDER_DIR)
    await finestra.screenshot({
      path: `${process.env.DM_RENDER_DIR}/widget-meteo-giorni-${testInfo.project.name}.png`,
    });
});
