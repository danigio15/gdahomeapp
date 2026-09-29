/* «Ho inserito l'entità power del climatizzatore ma non mi dà acceso mentre il
 * clima è acceso, se è stato acceso dal telecomando. Ho 5 climatizzatori, tutti
 * e 5 con i loro magnetotermici Wi-Fi.»
 *
 * Un climatizzatore comandato all'infrarosso non dice a Home Assistant che il
 * telecomando l'ha acceso: il suo `climate.*` resta «off», e il magnetotermico
 * sotto sa la verità. Con l'entità del consumo e la soglia (#490) la card lo
 * dava acceso; il suo tasto però chiedeva al termostato, e un clima acceso dal
 * telecomando lo «riaccendeva» invece di spegnerlo.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const PRESA = "sensor.magnetotermico_salotto_potenza";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [
      {
        id: "cl-1",
        name: "Salotto",
        entity: "climate.salotto",
        consumo: PRESA,
        soglia_consumo: 20,
      },
    ],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, clima: true },
};

async function avvia(page, testInfo, { clima, watt }) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.toggleClima?.__dmClimaPower === true);
  await page.evaluate(
    ({ clima: modo, watt: letti, presa, unita }) => {
      /* L'unità come la salva la scheda del Config: con la presa e la soglia. */
      window.localStorage.setItem("cd_clima_units", JSON.stringify(unita));
      const stati =
        window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null") ||
        window._RAW_STATES;
      stati["climate.salotto"] = {
        entity_id: "climate.salotto",
        state: modo,
        attributes: { hvac_modes: ["off", "cool"], friendly_name: "Salotto" },
      };
      stati[presa] = {
        entity_id: presa,
        state: String(letti),
        attributes: { unit_of_measurement: "W" },
      };
      window.__chiamate = [];
      window.dmCallHaService = (dominio, servizio, dati) => {
        window.__chiamate.push({ dominio, servizio, dati });
        return Promise.resolve();
      };
    },
    { clima, watt, presa: PRESA, unita: seed.sections.climate },
  );
}

test("acceso dal telecomando: il tasto lo spegne, non lo riaccende", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  /* Home Assistant dice «off», il magnetotermico legge 850 W. */
  await avvia(page, testInfo, { clima: "off", watt: 850 });
  const esito = await page.evaluate(() => {
    window.toggleClima("climate.salotto", "freddo");
    return window.__chiamate;
  });
  expect(esito).toHaveLength(1);
  expect(esito[0].servizio).toBe("set_hvac_mode");
  expect(esito[0].dati).toMatchObject({ entity_id: "climate.salotto", hvac_mode: "off" });
});

test("spento dal telecomando: il tasto lo riaccende, non lo rispegne", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  /* Home Assistant dice «cool», il magnetotermico legge i 7 W di riposo. */
  await avvia(page, testInfo, { clima: "cool", watt: 7 });
  const esito = await page.evaluate(() => {
    window.toggleClima("climate.salotto", "freddo");
    return window.__chiamate;
  });
  expect(esito).toHaveLength(1);
  expect(esito[0].dati).toMatchObject({ entity_id: "climate.salotto", hvac_mode: "cool" });
});

test("senza la soglia decide il termostato, come prima", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await avvia(page, testInfo, { clima: "off", watt: 850 });
  const esito = await page.evaluate(() => {
    const unita = JSON.parse(window.localStorage.getItem("cd_clima_units"));
    delete unita[0].soglia_consumo;
    window.localStorage.setItem("cd_clima_units", JSON.stringify(unita));
    window.toggleClima("climate.salotto", "freddo");
    return window.__chiamate;
  });
  expect(esito).toHaveLength(1);
  expect(esito[0].dati).toMatchObject({ entity_id: "climate.salotto", hvac_mode: "cool" });
});
