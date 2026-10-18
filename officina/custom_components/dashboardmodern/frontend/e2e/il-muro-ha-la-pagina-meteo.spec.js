/* La pagina Meteo della plancia a muro.
 *
 * «La sezione meteo della plancia principale su un tablet grande e' bella:
 * la vorrei a muro come pagina intera.» Qui, nella plancia vera:
 *
 *  - nel config «A muro» c'e' METEO fra le pagine da aggiungere, e si salva;
 *  - la pagina mostra la temperatura grande, la condizione, le misure, le
 *    prossime ore e i prossimi giorni, con le previsioni chieste a
 *    `weather.get_forecasts` come le chiede la pagina Meteo della plancia;
 *  - senza nessun meteo in Home Assistant dice dove sceglierlo.
 *
 * Con DM_FOTO=<cartella> lascia le fotografie: il config, il tablet da dieci
 * pollici chiaro e scuro, e il pannello piccolo da 800×480. */
import { expect, test } from "@playwright/test";
import { STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const muro = (page) => page.locator("#dm-muro");
const salvato = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("cd_muro") || "null"));

/* La casa senza le persone: la pagina Meteo non ne ha bisogno. */
const SENZA_PERSONE = Object.fromEntries(
  Object.entries(STATI_A_MURO).filter(([id]) => !id.startsWith("person.")),
);
const STATI = {
  ...SENZA_PERSONE,
  "weather.casa": {
    state: "partlycloudy",
    attributes: {
      friendly_name: "Meteo casa",
      temperature: 18.6,
      apparent_temperature: 17.4,
      humidity: 64,
      pressure: 1014,
      pressure_unit: "hPa",
      wind_speed: 12,
      wind_gust_speed: 26,
      wind_speed_unit: "km/h",
      wind_bearing: 230,
      temperature_unit: "°C",
      precipitation_unit: "mm",
    },
  },
};

const MURO_COL_METEO = (tema = "chiaro") => ({
  attiva: true,
  tema,
  meteo: "weather.casa",
  pagine: [
    { id: "meteo", modello: "meteo" },
    { id: "p1", modello: "stanza", stanza: "Soggiorno" },
  ],
});

/* Home Assistant finto: risponde alle previsioni, ora per ora e giorno per
 * giorno, e conta le domande. Una giornata d'autunno che si guasta nel
 * pomeriggio e torna bella dopodomani. */
async function conLePrevisioni(page) {
  await page.addInitScript(() => {
    const H = 3600000;
    window.__previsioni = [];
    const previsioni = (tipo) => {
      const adesso = Date.now();
      if (tipo === "hourly") {
        const ora = Math.floor(adesso / H) * H;
        return Array.from({ length: 24 }, (_, i) => {
          const pioggia = i >= 5 && i <= 9;
          return {
            datetime: new Date(ora + i * H).toISOString(),
            condition: pioggia
              ? i === 7
                ? "pouring"
                : "rainy"
              : i < 5
                ? "partlycloudy"
                : "cloudy",
            temperature: 18.6 - i * 0.35 + (i < 4 ? i * 0.4 : 0),
            precipitation_probability: pioggia ? 60 + (i % 3) * 10 : i < 5 ? 10 : 20,
            precipitation: pioggia ? 0.8 : 0,
          };
        });
      }
      const mezzanotte = new Date(adesso);
      mezzanotte.setHours(0, 0, 0, 0);
      const giorni = [
        "rainy",
        "lightning-rainy",
        "cloudy",
        "partlycloudy",
        "sunny",
        "sunny",
        "fog",
      ];
      return giorni.map((condition, i) => {
        const giorno = new Date(mezzanotte);
        giorno.setDate(giorno.getDate() + i);
        return {
          datetime: giorno.toISOString(),
          condition,
          temperature: [20, 17, 16, 19, 22, 23, 18][i],
          templow: [11, 10, 8, 9, 11, 12, 10][i],
          precipitation_probability: [70, 90, 30, 10, 0, 0, 10][i],
          precipitation: [3.1, 12, 0.4, 0, 0, 0, 0][i],
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
        else if (message.type === "call_service" && message.service === "get_forecasts") {
          const entita = message.target?.entity_id;
          window.__previsioni.push(message.service_data?.type);
          result = { response: { [entita]: { forecast: previsioni(message.service_data?.type) } } };
        }
        this.onmessage?.({
          data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
        });
      }
      close() {}
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
    window.WebSocket = MockSocket;
  });
}

async function foto(page, nome) {
  if (process.env.DM_FOTO) await page.screenshot({ path: `${process.env.DM_FOTO}/${nome}.png` });
}

test("nel config si aggiunge la pagina Meteo, e si salva", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await conLePrevisioni(page);
  await apriLaCasaAMuro(page, testInfo, {
    muro: { attiva: true, meteo: "weather.casa", pagine: [] },
    stati: STATI,
  });
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="muro"]').click();
  const body = page.locator("#ed-body");
  await expect(body.locator(".mu-ed")).toBeVisible();
  const aggiungi = body.locator('[data-mu-ed-nuova="meteo"]');
  await expect(aggiungi).toHaveText(/Meteo/);
  await aggiungi.scrollIntoViewIfNeeded();
  await foto(page, "muro-meteo-config-elenco");
  await aggiungi.click();
  const pagina = body.locator('[data-mu-ed-pagina="0"]');
  await expect(pagina).toContainText(/Meteo/);
  /* Niente da scegliere: dice quale meteo usa, e dove si cambia. */
  await expect(body.locator('[data-mu-ed-meteo="weather.casa"]')).toContainText("Meteo casa");
  await expect(body.locator('[data-mu-ed-campo="pagine.0.griglia"]')).toHaveCount(0);
  /* L'anteprima si rifà quando arrivano le previsioni. */
  await expect(body.locator(".mu-anteprima [data-mu-meteo-giorno]")).toHaveCount(7);
  await pagina.scrollIntoViewIfNeeded();
  await foto(page, "muro-meteo-config-pagina");
  await body.locator("[data-dm-save-all]").click();
  const scritto = await salvato(page);
  expect(scritto.pagine.map((p) => p.modello)).toEqual(["meteo"]);
});

for (const [tema, nome] of [
  ["chiaro", "light"],
  ["scuro", "dark"],
]) {
  test(`il tablet da dieci pollici mostra il meteo grande (${nome})`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await conLePrevisioni(page);
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_COL_METEO(tema), stati: STATI });
    await expect(muro(page)).toBeVisible();
    await expect(muro(page)).toHaveAttribute("data-tema", nome);
    const pagina = muro(page).locator('.mu-mt[data-mu-meteo="weather.casa"]');
    await expect(pagina).toBeVisible();
    await expect(pagina.locator("[data-mu-meteo-gradi]")).toHaveText("19°");
    await expect(pagina.locator(".mu-mt-cond")).toHaveText("Poco nuvoloso");
    await expect(pagina.locator('[data-mu-meteo-misura="umidita"]')).toContainText("64");
    await expect(pagina.locator('[data-mu-meteo-misura="vento"]')).toContainText("12");
    await expect(pagina.locator('[data-mu-meteo-misura="vento"]')).toContainText("SO");
    await expect(pagina.locator('[data-mu-meteo-misura="pressione"]')).toContainText("1014");
    /* Le previsioni arrivano dalla stessa domanda della pagina Meteo. */
    await expect(pagina.locator("[data-mu-meteo-ora]")).toHaveCount(12);
    await expect(pagina.locator("[data-mu-meteo-giorno]")).toHaveCount(7);
    await expect(pagina.locator("[data-mu-meteo-giorno]").first()).toContainText("Oggi");
    await expect(pagina.locator("[data-mu-meteo-giorno]").first()).toContainText("11°");
    await expect(pagina.locator("[data-mu-meteo-giorno]").first()).toContainText("20°");
    await expect(pagina.locator(".mu-mt-forbice")).toContainText("Max 20°");
    await expect(pagina.locator(".mu-mt-frase")).toContainText(/Pioggia verso le/);
    const chieste = await page.evaluate(() => window.__previsioni);
    expect(chieste).toEqual(expect.arrayContaining(["hourly", "daily"]));
    /* In alto il meteo non si ripete: la pagina lo dice in grande. */
    await expect(muro(page).locator('.mu-testa [data-mu-temperatura="meteo"]')).toHaveCount(0);
    /* Niente esce dal pannello, niente scorre. */
    const fuori = await pagina.evaluate((nodo) => {
      const r = nodo.getBoundingClientRect();
      const tutti = [...nodo.querySelectorAll(".mu-carta")];
      return {
        basso: r.bottom <= window.innerHeight + 1,
        destra: r.right <= window.innerWidth + 1,
        tagliate: tutti.filter((c) => c.scrollHeight > c.clientHeight + 2).length,
      };
    });
    expect(fuori).toEqual({ basso: true, destra: true, tagliate: 0 });
    await foto(page, `muro-meteo-1280x800-${nome}`);
  });
}

test("il pannello piccolo da 800×480 tiene il meteo intero", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 800, height: 480 });
  await conLePrevisioni(page);
  await apriLaCasaAMuro(page, testInfo, { muro: MURO_COL_METEO("scuro"), stati: STATI });
  const pagina = muro(page).locator(".mu-mt");
  await expect(pagina).toBeVisible();
  await expect(pagina.locator("[data-mu-meteo-gradi]")).toHaveText("19°");
  await expect(pagina.locator("[data-mu-meteo-giorno]").first()).toBeVisible();
  await expect(pagina.locator("[data-mu-meteo-ora]").first()).toBeVisible();
  /* Ci stanno sei ore e cinque giorni; le altre se ne vanno senza tagliare. */
  const viste = await pagina.evaluate((nodo) => ({
    ore: [...nodo.querySelectorAll("[data-mu-meteo-ora]")].filter((n) => n.offsetParent).length,
    giorni: [...nodo.querySelectorAll("[data-mu-meteo-giorno]")].filter((n) => n.offsetParent)
      .length,
    tagliate: [...nodo.querySelectorAll(".mu-carta")].filter(
      (c) => c.scrollHeight > c.clientHeight + 2,
    ).length,
    dentro: nodo.getBoundingClientRect().bottom <= window.innerHeight + 1,
  }));
  expect(viste).toEqual({ ore: 6, giorni: 5, tagliate: 0, dentro: true });
  await foto(page, "muro-meteo-800x480-dark");
});

test("senza nessun meteo la pagina dice dove sceglierlo", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const senzaMeteo = Object.fromEntries(
    Object.entries(STATI).filter(([id]) => !id.startsWith("weather.")),
  );
  await apriLaCasaAMuro(page, testInfo, {
    muro: { attiva: true, pagine: [{ id: "meteo", modello: "meteo" }] },
    stati: senzaMeteo,
  });
  const vuoto = muro(page).locator("[data-mu-meteo-vuoto]");
  await expect(vuoto).toBeVisible();
  await expect(vuoto).toContainText("Nessun meteo da mostrare");
  await expect(vuoto).toContainText("Altre impostazioni › Meteo");
  await foto(page, "muro-meteo-vuoto");
});
