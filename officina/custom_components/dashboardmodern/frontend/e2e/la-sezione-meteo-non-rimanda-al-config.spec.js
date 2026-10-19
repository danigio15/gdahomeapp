/* «Devi togliere dalle sezioni il rimando al config. Qua non ci deve essere.»
 *
 * La pagina Meteo, senza una stazione, mostrava la carta «Hai una stazione
 * meteo? Aggiungi i suoi sensori in ⚙️ Config › Meteo…» con il tasto «Apri
 * Meteo nel Config». Qui si apre la pagina vera, con la sola entità weather,
 * e si guarda che del Config non ci sia traccia: né la carta, né il tasto, né
 * la parola. Le previsioni ci sono, perché la pagina senza stazione si
 * arrangia col servizio meteo.
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
    entityOverrides: { "dm.home_meteo": "weather.casa" },
  },
  visibility: { home: true },
};

async function avvia(page, testInfo) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    const H = 3600000;
    const previsioni = (tipo) => {
      const adesso = Date.now();
      if (tipo === "hourly") {
        const ora = Math.floor(adesso / H) * H;
        return Array.from({ length: 24 }, (_, i) => ({
          datetime: new Date(ora + i * H).toISOString(),
          condition: i > 3 && i < 8 ? "rainy" : "partlycloudy",
          temperature: 18 - i * 0.3,
          precipitation_probability: i > 3 && i < 8 ? 70 : 10,
        }));
      }
      const mezzanotte = new Date(adesso);
      mezzanotte.setHours(0, 0, 0, 0);
      return Array.from({ length: 7 }, (_, i) => {
        const giorno = new Date(mezzanotte);
        giorno.setDate(giorno.getDate() + i);
        return {
          datetime: giorno.toISOString(),
          condition: i < 2 ? "rainy" : "sunny",
          temperature: 20 + i,
          templow: 11 + (i % 3),
          precipitation_probability: i < 2 ? 60 : 0,
        };
      });
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
          result = {
            response: { [entita]: { forecast: previsioni(message.service_data?.type) } },
          };
        } else if (message.type === "history/history_during_period") result = {};
        this.onmessage?.({
          data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
        });
      }
      close() {}
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
    window.WebSocket = MockSocket;
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  /* La casa: solo l'entità weather e il sole. Nessun sensore di stazione. */
  await page.evaluate(() => {
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
      humidity: 64,
      pressure: 1014,
      pressure_unit: "hPa",
      wind_speed: 12,
      wind_speed_unit: "km/h",
      wind_bearing: 230,
      temperature_unit: "°C",
    });
    const tra = (ore) => new Date(Date.now() + ore * 3600000).toISOString();
    metti("sun.sun", "above_horizon", { next_rising: tra(14), next_setting: tra(1) });
    window.render?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
  });
}

test("la pagina Meteo senza stazione non rimanda al Config", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  const voce = page.locator('nav.tabs .tab[data-tab="meteo"]');
  await expect(voce).toHaveCount(1);
  await expect.poll(() => voce.evaluate((nodo) => getComputedStyle(nodo).display)).not.toBe("none");
  await voce.evaluate((nodo) => nodo.click());
  const pagina = page.locator("#page-meteo");
  await expect(pagina).toHaveClass(/active/);
  /* La pagina c'è, e dice il tempo dal servizio meteo. */
  await expect(
    pagina.locator('[data-dm-meteo-blocco="adesso"] [data-dm-meteo-gradi]'),
  ).toContainText("18,6");
  await expect(pagina.locator(".dm-meteo-ora")).toHaveCount(24);
  await expect(pagina.locator('[data-dm-meteo-blocco="stazione"]')).toHaveCount(0);
  /* Del Config niente: né la carta, né il tasto, né la parola. */
  await expect(pagina.locator('[data-dm-meteo-blocco="invito"]')).toHaveCount(0);
  await expect(pagina.locator(".dm-meteo-invito, [data-dm-meteo-apri-config]")).toHaveCount(0);
  const testo = await pagina.innerText();
  expect(testo).not.toMatch(/config/i);
  expect(testo).not.toContain("Hai una stazione meteo");
  expect(testo).not.toContain("⚙️");
  /* E nessun tasto della pagina apre il Config. */
  await expect(page.locator("#editor-modal.show")).toHaveCount(0);
});
