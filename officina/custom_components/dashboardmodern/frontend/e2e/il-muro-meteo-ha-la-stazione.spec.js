/* La pagina Meteo della plancia a muro, con la stazione di casa.
 *
 * «Si riesce ad impaginare la plancia a muro come la normale?» Con una
 * stazione nella configurazione della pagina Meteo della plancia, il muro
 * mostra quello che mostra la plancia:
 *
 *  - «Adesso» con le misure della stazione, non quelle dell'entità weather
 *    (19,6° misurati, non i 18° del servizio), la percepita con la minima e
 *    la massima, la frase sulla pioggia, le pastiglie con l'alba e il
 *    tramonto, e da dove arrivano le misure;
 *  - «La mia stazione» con le sue tessere, ognuna con le ultime 24 ore chieste
 *    alla cronologia una volta sola;
 *  - accanto, i prossimi giorni e le prossime ore;
 *  - niente esce dal pannello e niente scorre di lato, dal tablet da dieci
 *    pollici al pannello da 800×480, e in verticale.
 *
 * Con DM_FOTO=<cartella> lascia le fotografie: il muro chiaro e scuro, i
 * pannelli piccoli, il verticale, e la pagina Meteo della plancia con gli
 * stessi dati per confronto. */
import { expect, test } from "@playwright/test";
import { STATI_A_MURO, SEME_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

/* Una sera di ottobre, sereno, a giornata finita. Le ore si scrivono in UTC. */
const ADESSO = Date.parse("2026-10-18T21:40:00Z");
test.use({ timezoneId: "UTC", locale: "it-IT" });

const muro = (page) => page.locator("#dm-muro");

const SENZA_PERSONE = Object.fromEntries(
  Object.entries(STATI_A_MURO).filter(
    ([id]) => !id.startsWith("person.") && !id.startsWith("weather."),
  ),
);

const STAZIONE = {
  temperatura: "sensor.stazione_temperatura",
  umidita: "sensor.stazione_umidita",
  pressione: "sensor.stazione_pressione",
  pioggia: "sensor.stazione_pioggia",
  vento: "sensor.stazione_vento",
  direzione: "sensor.stazione_direzione_vento",
  uv: "sensor.stazione_uv",
  luce: "sensor.stazione_luminosita",
};

const STATI = {
  ...SENZA_PERSONE,
  "weather.forecast_home": {
    state: "clear-night",
    attributes: {
      friendly_name: "Forecast Home",
      temperature: 18,
      apparent_temperature: 22.3,
      humidity: 72,
      pressure: 1019,
      pressure_unit: "hPa",
      wind_speed: 4,
      wind_speed_unit: "km/h",
      wind_bearing: 200,
      temperature_unit: "°C",
      precipitation_unit: "mm",
    },
  },
};

/* Le letture della stazione adesso, scritte un minuto fa. */
const LETTURE = {
  [STAZIONE.temperatura]: [19.6, { device_class: "temperature", unit_of_measurement: "°C" }],
  [STAZIONE.umidita]: [65, { device_class: "humidity", unit_of_measurement: "%" }],
  [STAZIONE.pressione]: [
    1021,
    { device_class: "atmospheric_pressure", unit_of_measurement: "mbar" },
  ],
  [STAZIONE.pioggia]: [0, { device_class: "precipitation_intensity", unit_of_measurement: "mm/h" }],
  [STAZIONE.vento]: [0, { device_class: "wind_speed", unit_of_measurement: "m/s" }],
  [STAZIONE.direzione]: [135, { unit_of_measurement: "°" }],
  [STAZIONE.uv]: [0, { unit_of_measurement: "UV index" }],
  [STAZIONE.luce]: [0, { device_class: "illuminance", unit_of_measurement: "lx" }],
};

/* La configurazione della pagina Meteo della plancia: le caselle della
 * testata, la pioggia della barra, e le misure solo della pagina. Il muro non
 * ha niente di suo da scegliere. */
const SEME = {
  ...SEME_A_MURO,
  sections: {
    ...SEME_A_MURO.sections,
    entityOverrides: {
      ...SEME_A_MURO.sections.entityOverrides,
      "dm.home_meteo": "weather.forecast_home",
      "dm.home_meteo_temperatura": STAZIONE.temperatura,
      "dm.home_meteo_umidita": STAZIONE.umidita,
      "dm.home_meteo_vento": STAZIONE.vento,
      "dm.home_meteo_vento_direzione": STAZIONE.direzione,
    },
  },
};
const CASELLE = {
  cd_barra_casa: { pioggia: STAZIONE.pioggia },
  cd_meteo: { pressione: STAZIONE.pressione, uv: STAZIONE.uv, luminosita: STAZIONE.luce },
};

const MURO_COL_METEO = (tema = "scuro") => ({
  attiva: true,
  tema,
  meteo: "weather.forecast_home",
  pagine: [
    { id: "meteo", modello: "meteo" },
    { id: "p1", modello: "stanza", stanza: "Soggiorno" },
  ],
});

/* Home Assistant finto: le previsioni (una notte serena, una settimana
 * asciutta) e la cronologia delle ultime 24 ore, contando le domande. */
async function homeAssistant(page) {
  /* L'ora parte da ADESSO e poi scorre: il velo della plancia aspetta che passi. */
  await page.clock.install({ time: ADESSO });
  await page.addInitScript(
    ({ stazione }) => {
      const H = 3600000;
      const M = 60000;
      window.__w = { previsioni: [], storia: [] };
      const previsioni = (tipo) => {
        const adesso = Date.now();
        if (tipo === "hourly") {
          const ora = Math.floor(adesso / H) * H;
          return Array.from({ length: 24 }, (_, i) => {
            const h = new Date(ora + i * H).getUTCHours();
            const notte = h < 7 || h > 18;
            return {
              datetime: new Date(ora + i * H).toISOString(),
              condition: notte ? "clear-night" : h < 10 ? "partlycloudy" : "sunny",
              temperature: 16 + 2.5 * Math.cos(((h - 14) / 24) * 2 * Math.PI),
              precipitation_probability: 0,
              precipitation: 0,
            };
          });
        }
        const mezzanotte = new Date(adesso);
        mezzanotte.setUTCHours(0, 0, 0, 0);
        const giorni = [
          "sunny",
          "sunny",
          "partlycloudy",
          "cloudy",
          "rainy",
          "partlycloudy",
          "sunny",
        ];
        return giorni.map((condition, i) => ({
          datetime: new Date(mezzanotte.getTime() + i * 24 * H).toISOString(),
          condition,
          temperature: [18, 19, 18, 17, 15, 16, 18][i],
          templow: [15, 12, 11, 12, 11, 10, 10][i],
          precipitation_probability: [0, 0, 10, 20, 70, 20, 0][i],
          precipitation: [0, 0, 0, 0, 4.2, 0, 0][i],
        }));
      };
      /* Una giornata vera: la minima all'alba, la massima nel primo
       * pomeriggio, la pressione che sale piano, il sole e l'UV di giorno. */
      const valore = (entity, quando) => {
        const d = new Date(quando);
        const h = d.getUTCHours() + d.getUTCMinutes() / 60;
        const giorno = Math.max(0, Math.sin(((h - 7.4) / 11) * Math.PI));
        if (entity === stazione.temperatura)
          return 17.4 + 4.6 * Math.cos(((h - 14.3) / 24) * 2 * Math.PI) + (h > 20 ? 0.9 : 0);
        if (entity === stazione.umidita) return 66 - 18 * giorno + 6 * Math.sin(h / 3);
        if (entity === stazione.pressione) {
          /* Ferma fino a tre ore fa, poi sale di un ettopascal: «in aumento». */
          const tre = Date.now() - 3 * H;
          return quando < tre
            ? 1018.6 + ((quando - (Date.now() - 24 * H)) / (21 * H)) * 1.3
            : 1019.9 + ((quando - tre) / (3 * H)) * 1.0;
        }
        if (entity === stazione.pioggia) return 0;
        if (entity === stazione.vento) return Math.max(0, 2.6 * giorno + Math.sin(h * 2) * 0.6);
        if (entity === stazione.direzione) return 135;
        if (entity === stazione.uv) return Math.round(3.8 * giorno * 10) / 10;
        if (entity === stazione.luce) return Math.round(61000 * giorno);
        return 0;
      };
      const storia = (entita) => {
        const adesso = Date.now();
        const fuori = {};
        for (const entity of entita) {
          const righe = [];
          for (let quando = adesso - 24 * H; quando < adesso - M; quando += 10 * M)
            righe.push({ s: String(valore(entity, quando)), lu: quando / 1000 });
          /* I picchi di oggi, alle loro ore. */
          const oggi = new Date(adesso);
          oggi.setUTCHours(0, 0, 0, 0);
          if (entity === stazione.uv)
            righe.push({ s: "4", lu: (oggi.getTime() + 11 * H + 43 * M) / 1000 });
          if (entity === stazione.luce)
            righe.push({ s: "63372", lu: (oggi.getTime() + 13 * H + 4 * M) / 1000 });
          righe.sort((a, b) => a.lu - b.lu);
          fuori[entity] = righe;
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
          else if (message.type === "call_service" && message.service === "get_forecasts") {
            const entita = message.target?.entity_id;
            window.__w.previsioni.push(message.service_data?.type);
            result = {
              response: { [entita]: { forecast: previsioni(message.service_data?.type) } },
            };
          } else if (message.type === "history/history_during_period") {
            window.__w.storia.push(message.entity_ids);
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
    },
    { stazione: STAZIONE },
  );
}

/* Le letture della stazione e il sole, con la loro ora: «aggiornate 1 min fa». */
async function laStazione(page) {
  await page.evaluate(
    ({ letture, adesso }) => {
      const raw = eval("_RAW_STATES");
      const fa = new Date(adesso - 60000).toISOString();
      for (const [id, [state, attributes]] of Object.entries(letture))
        raw[id] = { entity_id: id, state: String(state), attributes, last_updated: fa };
      raw["sun.sun"] = {
        entity_id: "sun.sun",
        state: "below_horizon",
        attributes: {
          next_rising: new Date(Date.parse("2026-10-19T07:26:00Z")).toISOString(),
          next_setting: new Date(Date.parse("2026-10-19T18:23:00Z")).toISOString(),
        },
        last_updated: fa,
      };
      window.render?.();
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      window.dispatchEvent(new CustomEvent("dashboardmodern:muro"));
    },
    { letture: LETTURE, adesso: ADESSO },
  );
}

async function apri(page, testInfo, { tema = "scuro", muroAcceso = true } = {}) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  await homeAssistant(page);
  await apriLaCasaAMuro(page, testInfo, {
    muro: muroAcceso ? MURO_COL_METEO(tema) : { ...MURO_COL_METEO(tema), attiva: false },
    stati: STATI,
    seme: SEME,
    caselle: CASELLE,
  });
  await laStazione(page);
}

async function foto(page, nome, opzioni = {}) {
  await expect(page.locator("#cd-boot-overlay")).toHaveCount(0);
  if (process.env.DM_FOTO)
    await page.screenshot({ path: `${process.env.DM_FOTO}/${nome}.png`, ...opzioni });
}

/* Niente esce dal pannello, niente scorre di lato, nessuna tessera tagliata. */
function misuraLaPagina(nodo) {
  const r = nodo.getBoundingClientRect();
  const viste = (sel) => [...nodo.querySelectorAll(sel)].filter((n) => n.offsetParent);
  const fuori = (n) => {
    const q = n.getBoundingClientRect();
    return q.bottom > r.bottom + 1 || q.right > r.right + 1 || q.left < r.left - 1;
  };
  const scatole = viste(".mu-carta, .dm-meteo-tessera, .dm-meteo-adesso");
  /* Le scritte su una riga sola che il puntino taglierebbe. */
  const righe = viste(
    ".dm-meteo-nome, .dm-meteo-valore, .dm-meteo-stato, .dm-meteo-pill, .dm-meteo-fonte, .mu-mt-giorno-n, .mu-mt-ora-h",
  );
  /* La linea delle 24 ore non passa sopra il numero. */
  const sopra = viste(".dm-meteo-tessera")
    .filter((t) => {
      const valore = t.querySelector(".dm-meteo-valore")?.getBoundingClientRect();
      const grafico = t.querySelector(".dm-meteo-grafico")?.getBoundingClientRect();
      return valore && grafico && grafico.top < valore.bottom - 2;
    })
    .map((t) => t.dataset.dmMeteoMisura);
  return {
    sopra,
    basso: r.bottom <= window.innerHeight + 1,
    destra: r.right <= window.innerWidth + 1,
    lato: document.scrollingElement.scrollWidth <= window.innerWidth + 1,
    fuori: scatole.filter(fuori).length,
    tagliate: scatole
      .filter((c) => c.scrollHeight > c.clientHeight + 2)
      .map((c) => c.dataset.dmMeteoMisura || c.dataset.muMeteoBlocco || c.className),
    scritte: righe
      .filter((n) => n.scrollWidth > n.clientWidth + 1)
      .map((n) => n.textContent.trim()),
    tessere: viste("[data-dm-meteo-misura]").map((n) => n.dataset.dmMeteoMisura),
  };
}

for (const [tema, nome] of [
  ["scuro", "dark"],
  ["chiaro", "light"],
]) {
  test(`il muro impagina il meteo come la plancia, con la stazione (1280×800 ${nome})`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await apri(page, testInfo, { tema });
    await expect(muro(page)).toHaveAttribute("data-tema", nome);
    const pagina = muro(page).locator('.mu-mt-stazione[data-mu-meteo="weather.forecast_home"]');
    await expect(pagina).toBeVisible();
    const adesso = pagina.locator('[data-dm-meteo-blocco="adesso"]');
    /* I gradi della stazione, non i 18 dell'entità weather. */
    await expect(adesso.locator("[data-dm-meteo-gradi]")).toContainText("19,6");
    await expect(adesso).toContainText("Sereno");
    await expect(adesso).toContainText("Percepita 22,3°");
    await expect(adesso).toContainText("Min 15°");
    await expect(adesso).toContainText("Max 18°");
    await expect(adesso.locator("[data-dm-meteo-frase]")).toContainText(
      "Niente pioggia nelle prossime 24 ore",
    );
    await expect(adesso).toContainText("Umidità 65%");
    await expect(adesso).toContainText("Vento 0 m/s SE");
    await expect(adesso).toContainText("Pressione 1021 mbar");
    await expect(adesso).toContainText("Alba 07:26 · Tramonto 18:23");
    await expect(adesso.locator("[data-dm-meteo-fonte]")).toHaveText(
      "Misure: la tua stazione · Previsioni: Forecast Home (weather.forecast_home)",
    );
    /* La mia stazione: le sette tessere, ognuna con le sue 24 ore. */
    const stazione = pagina.locator('[data-dm-meteo-blocco="stazione"]');
    await expect(stazione.locator(".dm-meteo-titolo")).toContainText("La mia stazione");
    await expect(stazione.locator(".dm-meteo-titolo")).toContainText("aggiornate 1 min fa");
    await expect(stazione.locator("[data-dm-meteo-misura]")).toHaveCount(7);
    for (const chiave of ["temperatura", "umidita", "pressione", "pioggia", "vento", "sole"])
      await expect(
        stazione.locator(`[data-dm-meteo-misura="${chiave}"] .dm-meteo-spark path`).first(),
      ).toBeAttached();
    await expect(stazione.locator('[data-dm-meteo-misura="temperatura"]')).toContainText("19,6");
    await expect(stazione.locator('[data-dm-meteo-misura="umidita"]')).toContainText(
      "punto di rugiada",
    );
    await expect(stazione.locator('[data-dm-meteo-misura="pressione"]')).toContainText(
      "in aumento",
    );
    await expect(stazione.locator('[data-dm-meteo-misura="pressione"]')).toContainText(
      "+1 hPa nelle ultime 3 ore",
    );
    await expect(stazione.locator('[data-dm-meteo-misura="pioggia"]')).toContainText("asciutto");
    await expect(stazione.locator('[data-dm-meteo-misura="vento"] .dm-meteo-bussola')).toHaveCount(
      1,
    );
    await expect(stazione.locator('[data-dm-meteo-misura="vento"]')).toContainText("sud-est");
    await expect(stazione.locator('[data-dm-meteo-misura="uv"]')).toContainText(
      "massimo di oggi 4 alle 11:43",
    );
    await expect(stazione.locator('[data-dm-meteo-misura="sole"]')).toContainText(
      "picco 63372 lx alle 13:04",
    );
    /* Le linee hanno un nome loro: la pagina della plancia ha le sue. */
    expect(
      await stazione.locator("linearGradient").evaluateAll((g) => g.map((n) => n.id)),
    ).toContain("dm-meteo-g-muro-temperatura");
    /* Accanto i giorni e le ore. */
    await expect(pagina.locator("[data-mu-meteo-giorno]").first()).toContainText("Oggi");
    await expect(pagina.locator("[data-mu-meteo-ora]").first()).toBeVisible();
    /* La cronologia si chiede una volta: il battito non la richiede. */
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("dashboardmodern:muro")));
    const chieste = await page.evaluate(
      (id) => window.__w.storia.filter((elenco) => elenco.includes(id)),
      STAZIONE.temperatura,
    );
    expect(chieste).toHaveLength(1);
    expect(chieste[0]).toHaveLength(Object.keys(STAZIONE).length);
    const misure = await pagina.evaluate(misuraLaPagina);
    expect(misure).toMatchObject({
      basso: true,
      destra: true,
      lato: true,
      fuori: 0,
      tagliate: [],
      scritte: [],
      sopra: [],
    });
    expect(misure.tessere).toHaveLength(7);
    await foto(page, `muro-meteo-stazione-1280x800-${nome}`);
  });
}

for (const [larghezza, altezza, almeno] of [
  [1024, 600, 7],
  [800, 480, 3],
  [800, 1280, 7],
]) {
  test(`il meteo con la stazione ci sta a ${larghezza}×${altezza}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: larghezza, height: altezza });
    await apri(page, testInfo);
    const pagina = muro(page).locator(".mu-mt-stazione");
    await expect(pagina).toBeVisible();
    await expect(pagina.locator("[data-dm-meteo-gradi]")).toContainText("19,6");
    await expect(
      pagina.locator('[data-dm-meteo-misura="temperatura"] .dm-meteo-spark path').first(),
    ).toBeAttached();
    await foto(page, `muro-meteo-stazione-${larghezza}x${altezza}-dark`);
    const misure = await pagina.evaluate(misuraLaPagina);
    expect(misure).toMatchObject({
      basso: true,
      destra: true,
      lato: true,
      fuori: 0,
      tagliate: [],
      scritte: [],
      sopra: [],
    });
    expect(misure.tessere.length).toBeGreaterThanOrEqual(almeno);
  });
}

test("la pagina Meteo della plancia con gli stessi dati, per confronto", async ({
  page,
}, testInfo) => {
  /* Alta abbastanza da vederla intera senza scorrere: la barra in basso resta
   * in fondo, sotto i giorni. */
  await page.setViewportSize({ width: 1280, height: 1760 });
  await apri(page, testInfo, { muroAcceso: false });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  const voce = page.locator('nav.tabs .tab[data-tab="meteo"]');
  await expect.poll(() => voce.evaluate((n) => getComputedStyle(n).display)).not.toBe("none");
  await voce.evaluate((nodo) => nodo.click());
  const pagina = page.locator("#page-meteo");
  await expect(pagina).toHaveClass(/active/);
  await expect(pagina.locator("[data-dm-meteo-gradi]")).toContainText("19,6");
  await expect(
    pagina.locator('[data-dm-meteo-blocco="stazione"] [data-dm-meteo-misura]'),
  ).toHaveCount(7);
  /* Le stesse parole sul muro e qui. */
  await expect(pagina.locator("[data-dm-meteo-fonte]")).toHaveText(
    "Misure: la tua stazione · Previsioni: Forecast Home (weather.forecast_home)",
  );
  await expect(
    pagina.locator('[data-dm-meteo-misura="sole"] linearGradient#dm-meteo-g-sole'),
  ).toHaveCount(1);
  await foto(page, "plancia-meteo-stazione-1280-dark");
});
