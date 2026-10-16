/* La pagina Meteo (#206).
 *
 * «Una pagina tutta per il meteo: com'è adesso, cosa misura la mia stazione,
 * e cosa arriva.» Qui si guarda la pagina vera, nella plancia vera:
 *
 *  - la voce nella barra compare da sola quando c'è un'entità weather;
 *  - con la stazione ci sono le sue tessere, ognuna con le ultime 24 ore
 *    chieste alla cronologia di Home Assistant, e le previsioni chieste a
 *    `weather.get_forecasts`;
 *  - senza stazione la pagina si arrangia con l'entità weather, e propone di
 *    aggiungerla;
 *  - la scheda del Config salva i sensori dove li leggono già la testata e
 *    l'irrigazione;
 *  - il radar della finestra delle previsioni si disegna anche nella pagina,
 *    con le tessere finte servite da qui, senza rompere la finestra.
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

async function apriLaPagina(page) {
  const voce = page.locator('nav.tabs .tab[data-tab="meteo"]');
  await expect(voce).toHaveCount(1);
  await expect.poll(() => voce.evaluate((nodo) => getComputedStyle(nodo).display)).not.toBe("none");
  await voce.evaluate((nodo) => nodo.click());
  await expect(page.locator("#page-meteo")).toHaveClass(/active/);
}

test("con un'entità weather la voce compare accanto a Temperatura, e la stazione ha le sue tessere", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo, { caselle: CON_STAZIONE });
  /* Senza meteo la voce c'è ma non si vede: la pagina non avrebbe niente da dire. */
  await expect
    .poll(() =>
      page.evaluate(() => {
        const voce = document.querySelector('nav.tabs .tab[data-tab="meteo"]');
        return voce ? getComputedStyle(voce).display : "manca";
      }),
    )
    .toBe("none");
  await casa(page);
  await apriLaPagina(page);
  /* Accanto alla Temperatura. */
  expect(
    await page.evaluate(
      () =>
        document.querySelector('nav.tabs .tab[data-tab="meteo"]').previousElementSibling?.dataset
          ?.tab,
    ),
  ).toBe("temp");

  const pagina = page.locator("#page-meteo");
  const adesso = pagina.locator('[data-dm-meteo-blocco="adesso"]');
  await expect(adesso).toBeVisible();
  /* I gradi sono quelli della stazione, non dell'entità weather. */
  await expect(adesso.locator("[data-dm-meteo-gradi]")).toContainText("18,4");
  await expect(adesso.locator("[data-dm-meteo-fonte]")).toContainText("Misure: la tua stazione");
  await expect(adesso.locator("[data-dm-meteo-fonte]")).toContainText("Casa (weather.casa)");
  /* La frase sulle prossime ore, dalle previsioni orarie. */
  await expect(adesso.locator("[data-dm-meteo-frase]")).toContainText("Pioggia in arrivo verso le");
  await expect(adesso.locator("[data-dm-meteo-frase]")).toContainText("70% di probabilità");
  await expect(adesso).toContainText("Alba");

  /* Le tessere della stazione: una per sensore, nessuna per quelli che mancano. */
  const stazione = pagina.locator('[data-dm-meteo-blocco="stazione"]');
  await expect(stazione).toBeVisible();
  await expect(stazione.locator("[data-dm-meteo-misura]")).toHaveCount(7);
  await expect(
    stazione.locator('[data-dm-meteo-misura="temperatura"] .dm-meteo-spark'),
  ).toHaveCount(1);
  /* La pressione scende di quattro ettopascal in tre ore. */
  await expect(stazione.locator('[data-dm-meteo-misura="pressione"] .dm-meteo-stato')).toHaveText(
    /in calo/i,
  );
  await expect(stazione.locator('[data-dm-meteo-misura="pressione"]')).toContainText(
    "tempo in peggioramento",
  );
  /* Il vento da sud-ovest va verso nord-est: la freccia lo dice. */
  const vento = stazione.locator('[data-dm-meteo-misura="vento"]');
  await expect(vento).toContainText("sud-ovest");
  await expect(vento).toContainText("(225°)");
  await expect(vento.locator("[data-dm-meteo-freccia]")).toHaveAttribute(
    "data-dm-meteo-freccia",
    "45",
  );
  await expect(stazione.locator('[data-dm-meteo-misura="umidita"]')).toContainText(
    "punto di rugiada",
  );
  await expect(stazione.locator('[data-dm-meteo-misura="uv"]')).toContainText("moderato");
  await expect(stazione.locator('[data-dm-meteo-misura="pioggia"] rect')).not.toHaveCount(0);

  /* Le previsioni: ventiquattro ore e sette giorni. */
  await expect(pagina.locator(".dm-meteo-ora")).toHaveCount(24);
  await expect(pagina.locator(".dm-meteo-giorno")).toHaveCount(7);
  await expect(pagina.locator(".dm-meteo-giorno").first()).toContainText("Oggi");
  /* Senza radar configurato il suo blocco non c'è. */
  await expect(pagina.locator('[data-dm-meteo-posto="radar"]')).toBeHidden();

  /* Le domande: le due previsioni, e la cronologia di tutti i sensori insieme. */
  const chieste = await page.evaluate(() => window.__w206);
  expect([...chieste.previsioni].sort()).toEqual(expect.arrayContaining(["hourly"]));
  expect(chieste.storia.length).toBeGreaterThanOrEqual(1);
  expect(chieste.storia[0]).toEqual(expect.arrayContaining(["sensor.gw1100a_relative_pressure"]));
  expect(chieste.storia[0].length).toBe(10);
});

test("senza stazione la pagina usa l'entità weather e propone di aggiungerla", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await casa(page, { stazione: false });
  await apriLaPagina(page);
  const pagina = page.locator("#page-meteo");
  const adesso = pagina.locator('[data-dm-meteo-blocco="adesso"]');
  await expect(adesso.locator("[data-dm-meteo-gradi]")).toContainText("18,6");
  await expect(adesso.locator("[data-dm-meteo-fonte]")).toContainText(
    "Misure e previsioni: Casa (weather.casa)",
  );
  await expect(adesso).toContainText("Umidità");
  await expect(pagina.locator('[data-dm-meteo-blocco="stazione"]')).toHaveCount(0);
  const invito = pagina.locator('[data-dm-meteo-blocco="invito"]');
  await expect(invito).toBeVisible();
  await expect(invito).toContainText("Hai una stazione meteo?");
  await expect(pagina.locator(".dm-meteo-ora")).toHaveCount(24);
  /* Senza sensori non si chiede nessuna cronologia. */
  expect((await page.evaluate(() => window.__w206)).storia).toEqual([]);
  /* L'invito porta alla scheda Meteo del Config. */
  await invito.locator("[data-dm-meteo-apri-config]").click();
  await expect(page.locator('#editor-modal .ed-tab.active[data-tab="meteo"]')).toHaveCount(1, {
    timeout: 15_000,
  });
});

test("la scheda Meteo trova i sensori della stazione e li salva dove li leggono già gli altri", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await casa(page, { stazione: true });
  /* Si ricomincia senza scelte: la stazione c'è, ma nessuno l'ha ancora detta. */
  await page.evaluate(() => {
    localStorage.removeItem("cd_meteo");
    localStorage.removeItem("cd_barra_casa");
  });
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  /* La linguetta la aggiunge la scheda appena il Config si apre. */
  await expect(page.locator('#editor-modal .ed-tab[data-tab="meteo"]')).toHaveCount(1, {
    timeout: 15_000,
  });
  await page.evaluate(() => window.editorSwitch?.("meteo"));
  const corpo = page.locator("#ed-body");
  await expect(corpo.locator(".dm-meteo-ed")).toHaveCount(1, { timeout: 15_000 });
  await expect(corpo.locator('[data-dm-meteo-gruppo="previsioni"]')).toBeVisible();
  await expect(corpo.locator('[data-dm-meteo-campo="meteo"]')).toHaveValue("weather.casa");
  await expect(corpo.locator('[data-dm-meteo-gruppo="radar"] [data-dm-radar-fonte]')).toHaveCount(
    3,
  );
  await expect(corpo.locator('[data-dm-meteo-gruppo="pagina"] [data-dm-meteo-int]')).toHaveCount(5);

  await corpo.locator("[data-dm-meteo-trova]").click();
  await expect(corpo.locator('[data-dm-meteo-misura="pressione"]')).toHaveValue(
    "sensor.gw1100a_relative_pressure",
  );
  const salvato = await page.evaluate(() => ({
    meteo: JSON.parse(localStorage.getItem("cd_meteo") || "{}"),
    barra: JSON.parse(localStorage.getItem("cd_barra_casa") || "{}"),
    caselle: JSON.parse(localStorage.getItem("cd_entity_overrides") || "{}"),
  }));
  /* Le nuove nella chiave della pagina… */
  expect(salvato.meteo.pressione).toBe("sensor.gw1100a_relative_pressure");
  expect(salvato.meteo.raffica).toBe("sensor.gw1100a_wind_gust");
  expect(salvato.meteo.uv).toBe("sensor.gw1100a_uv_index");
  /* …la pioggia dove la legge l'irrigazione… */
  expect(salvato.barra.pioggiaOggi).toBe("sensor.gw1100a_daily_rain");
  expect(salvato.barra.pioggia).toBe("sensor.gw1100a_rain_rate");
  /* …e la temperatura nella casella della testata. */
  expect(salvato.caselle["dm.home_meteo_temperatura"]).toBe("sensor.gw1100a_outdoor_temperature");
  expect(salvato.caselle["dm.home_meteo"]).toBe("weather.casa");

  /* Un blocco si spegne, e uno si sposta: si salva subito. */
  await corpo.locator('[data-dm-meteo-int="giorni"]').click();
  await corpo.locator('[data-dm-meteo-su="radar"]').click();
  const pagina = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_meteo") || "{}"));
  expect(pagina.spenti).toEqual(["giorni"]);
  expect(pagina.ordine).toEqual(["adesso", "stazione", "ore", "radar", "giorni"]);
  /* E un sensore tolto a mano, salvato col tasto in fondo, se ne va. */
  await corpo.locator('[data-dm-meteo-misura="uv"]').evaluate((campo) => {
    campo.value = "";
  });
  await page.evaluate(() => document.querySelector("#ed-body [data-dm-meteo-save]").click());
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cd_meteo") || "{}").uv)).toBe(
    "",
  );
});

test("il radar si disegna nella pagina, più grande, senza togliersi dalla finestra delle previsioni", async ({
  page,
}, testInfo) => {
  const chiesti = await boot(page, testInfo, {
    radar: { servizio: "rainviewer", lat: "44.5", lon: "11.3", raggio: "30" },
  });
  await casa(page, { stazione: false });
  await apriLaPagina(page);
  const posto = page.locator("#page-meteo .dm-meteo-radar-posto");
  const blocco = posto.locator(".dm-radar-blocco");
  await expect(blocco).toHaveAttribute("data-dm-modo", "mappa", { timeout: 15_000 });
  await expect(blocco).toHaveAttribute("data-dm-radar", "vivo", { timeout: 15_000 });
  await expect(blocco.locator(".dm-radar-legenda")).toBeVisible();
  await expect(blocco.locator("[data-dm-radar-firma-fondo]")).toContainText("Esri");
  /* Tre fotogrammi, uno acceso alla volta, con la sua ora. */
  await expect(blocco.locator(".dm-radar-strato")).toHaveCount(3);
  await expect(blocco.locator("[data-dm-radar-ora]")).toBeVisible();
  expect(chiesti.pioggia).toBeGreaterThan(0);
  expect(chiesti.fondo).toBeGreaterThan(0);
  /* La testa la dice la pagina, col suo titolo. */
  await expect(
    page.locator('#page-meteo [data-dm-meteo-blocco="radar"] .dm-meteo-titolo'),
  ).toContainText("Radar pioggia");
  await expect(blocco.locator(".dm-radar-testa")).toBeHidden();
  const larghezza = await blocco.locator(".dm-radar-quadro").evaluate((nodo) => nodo.offsetWidth);
  if (testInfo.project.name === "desktop") {
    /* Sul computer i giorni e il radar stanno affiancati. */
    await expect(page.locator("#meteo-wrap")).toHaveAttribute("data-dm-meteo-coppia", "true");
    const [giorni, radar] = await page.evaluate(() =>
      ["giorni", "radar"].map((chiave) =>
        document
          .querySelector(`#meteo-wrap [data-dm-meteo-posto="${chiave}"]`)
          .getBoundingClientRect(),
      ),
    );
    expect(Math.abs(giorni.top - radar.top)).toBeLessThan(4);
    expect(radar.left).toBeGreaterThan(giorni.left + 100);
    expect(larghezza).toBeGreaterThan(450);
  } else expect(larghezza).toBeGreaterThan(300);

  /* La finestra delle previsioni ha ancora il suo. */
  await page.evaluate(() => window.apriMeteo?.());
  await expect(page.locator("#weather-modal .dm-radar-blocco")).toHaveAttribute(
    "data-dm-modo",
    "mappa",
    {
      timeout: 15_000,
    },
  );
  await expect(posto.locator(".dm-radar-blocco")).toHaveCount(1);
});
