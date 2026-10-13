/* «Continua a dare problema, esce ancora il —.»
 *
 * Nella Giornaliera, sotto Casa: Cucina e Lavanderia col loro numero, e il
 * Locale tecnico a «—», sbiadito. Dentro il Locale tecnico c'e' un server che
 * misura solo i watt, con un sensore senza `state_class`: Home Assistant non
 * ne compila le medie orarie, e la domanda che doveva dargli i kilowattora
 * tornava vuota. Adesso i kilowattora si contano dalla storia degli stati.
 *
 * La seconda prova e' la mattina dopo un riavvio: il giornaliero del NAS e'
 * «unavailable» e il contatore dell'UPS non ha statistiche. Anche li' il
 * numero arriva dalla storia, e mentre arriva il cerchio dice «…». */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = (apparecchiDelLocale) => ({
  schema_version: 4,
  sections: {
    rooms: [
      { id: "cucina", name: "Cucina", icon: "mdi:stove" },
      { id: "lavanderia", name: "Lavanderia", icon: "mdi:washing-machine" },
      { id: "locale_tecnico", name: "Locale tecnico", icon: "mdi:wrench" },
    ],
    cameras: [],
    appliances: [
      {
        id: "frigo",
        name: "Frigo",
        room_id: "cucina",
        power_entity: "sensor.frigo_w",
        daily_energy_entity: "sensor.frigo_oggi",
      },
      {
        id: "lavatrice",
        name: "Lavatrice",
        room_id: "lavanderia",
        power_entity: "sensor.lavatrice_w",
        daily_energy_entity: "sensor.lavatrice_oggi",
      },
      ...apparecchiDelLocale,
    ],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {
      grid: { power: "sensor.rete_w" },
      house: { power: "sensor.casa_w" },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
});

const SERVER = {
  id: "server",
  name: "Server",
  room_id: "locale_tecnico",
  power_entity: "sensor.server_w",
};
const NAS = {
  id: "nas",
  name: "NAS",
  room_id: "locale_tecnico",
  daily_energy_entity: "sensor.nas_oggi",
};
const UPS = {
  id: "ups",
  name: "UPS",
  room_id: "locale_tecnico",
  power_entity: "sensor.ups_w",
  total_energy_entity: "sensor.ups_totale",
};

const W = { unit_of_measurement: "W", state_class: "measurement" };
const KWH = { unit_of_measurement: "kWh", device_class: "energy" };
const STATI = {
  "sensor.frigo_w": ["80", W],
  "sensor.frigo_oggi": ["0.8", { ...KWH, state_class: "total_increasing" }],
  "sensor.lavatrice_w": ["0", W],
  "sensor.lavatrice_oggi": ["0", { ...KWH, state_class: "total_increasing" }],
  /* La presa del server: watt, ma nessuna `state_class`. */
  "sensor.server_w": ["85", { unit_of_measurement: "W" }],
  "sensor.nas_oggi": ["unavailable", {}],
  "sensor.ups_w": ["40", { unit_of_measurement: "W" }],
  "sensor.ups_totale": ["820.5", { unit_of_measurement: "kWh" }],
  "sensor.rete_w": ["420", W],
  "sensor.casa_w": ["420", W],
};

/* Mette in piedi la plancia, gli stati e un Recorder di prova che risponde
 * alle medie orarie solo per chi le ha, e alla storia per tutti. */
async function preparaIlLocaleTecnico(page, testInfo, apparecchi, { lento = false } = {}) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME(apparecchi));
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(
    () => Boolean(window.DashboardModernEnergyService?.broker?.request),
    null,
    {
      timeout: 30_000,
    },
  );
  await page.evaluate(
    ({ stati, lento }) => {
      const raw = eval("_RAW_STATES");
      for (const [id, [stato, attributi]] of Object.entries(stati))
        raw[id] = { entity_id: id, state: stato, attributes: attributi };
      const adesso = Date.now() / 1000;
      const mezzanotte = new Date();
      mezzanotte.setHours(0, 0, 0, 0);
      const daMezzanotte = mezzanotte.getTime() / 1000;
      const storia = {
        "sensor.server_w": [{ s: "85", lu: daMezzanotte - 3600 }],
        "sensor.nas_oggi": [
          { s: "0", lu: daMezzanotte },
          { s: "0.4", lu: Math.max(daMezzanotte + 1, adesso - 600) },
          { s: "unavailable", lu: Math.max(daMezzanotte + 2, adesso - 30) },
        ],
        "sensor.ups_totale": [
          { s: "819.8", lu: daMezzanotte },
          { s: "820.5", lu: Math.max(daMezzanotte + 1, adesso - 60) },
        ],
      };
      window.__DOMANDE_DEL_FLUSSO__ = [];
      window.__RISPONDI__ = !lento;
      const inAttesa = [];
      window.__SBLOCCA__ = () => {
        window.__RISPONDI__ = true;
        inAttesa.splice(0).forEach((fatto) => fatto());
      };
      const broker = window.DashboardModernEnergyService.broker;
      const prima = broker.request.bind(broker);
      const quando = () =>
        window.__RISPONDI__ ? Promise.resolve() : new Promise((fatto) => inAttesa.push(fatto));
      broker.request = async (domanda, ...resto) => {
        if (
          domanda?.type === "recorder/statistics_during_period" &&
          domanda.types?.length === 1 &&
          domanda.types[0] === "mean"
        ) {
          window.__DOMANDE_DEL_FLUSSO__.push(domanda);
          await quando();
          /* Nessuno di questi sensori ha le medie orarie. */
          return {};
        }
        if (domanda?.type === "history/history_during_period") {
          window.__DOMANDE_DEL_FLUSSO__.push(domanda);
          await quando();
          return Object.fromEntries(
            domanda.entity_ids.filter((id) => storia[id]).map((id) => [id, storia[id]]),
          );
        }
        return prima(domanda, ...resto);
      };
      /* Il primo paniere del Recorder e' arrivato, e di questi contatori non sa niente. */
      window.dispatchEvent(new CustomEvent("dashboardmodern:period-bundle", { detail: {} }));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { stati: STATI, lento },
  );
  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((b) => b.click());
  await page
    .locator("#page-energy .sub-tab-btn", { hasText: /Giornaliera/i })
    .first()
    .click();
}

const valoreDelCerchio = (page, nome) =>
  page.evaluate((cercato) => {
    const nodo = [...document.querySelectorAll("#view-day [data-dm-flow-node]")].find(
      (n) => (n.querySelector(".node-label")?.textContent || "").trim().toLowerCase() === cercato,
    );
    return (nodo?.querySelector(".dm-flow-value")?.textContent || "").trim();
  }, nome.toLowerCase());

test("il server con i soli watt, senza medie orarie: il Locale tecnico ha i suoi kWh", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await preparaIlLocaleTecnico(page, testInfo, [SERVER]);
  await expect.poll(() => valoreDelCerchio(page, "Cucina"), { timeout: 15_000 }).toBe("0,8 kWh");
  await expect.poll(() => valoreDelCerchio(page, "Lavanderia")).toBe("0,0 kWh");
  await expect
    .poll(() => valoreDelCerchio(page, "Locale tecnico"), { timeout: 15_000 })
    .toMatch(/^\d+,\d kWh$/);
  /* Prima le medie orarie, poi — vuote — la storia del server. */
  const domande = await page.evaluate(() =>
    window.__DOMANDE_DEL_FLUSSO__.map((d) => [d.type, d.statistic_ids || d.entity_ids]),
  );
  expect(domande).toContainEqual(["history/history_during_period", ["sensor.server_w"]]);
});

test("dopo un riavvio: il giornaliero che non risponde e il totale senza statistiche contano lo stesso", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await preparaIlLocaleTecnico(page, testInfo, [NAS, UPS], { lento: true });
  await expect.poll(() => valoreDelCerchio(page, "Cucina"), { timeout: 15_000 }).toBe("0,8 kWh");
  /* Mentre la storia viaggia il cerchio dice che sta leggendo, non «—». */
  await expect.poll(() => valoreDelCerchio(page, "Locale tecnico")).toBe("…");
  await page.evaluate(() => window.__SBLOCCA__());
  /* NAS 0,4 + UPS 0,7. */
  await expect
    .poll(() => valoreDelCerchio(page, "Locale tecnico"), { timeout: 15_000 })
    .toBe("1,1 kWh");
});
