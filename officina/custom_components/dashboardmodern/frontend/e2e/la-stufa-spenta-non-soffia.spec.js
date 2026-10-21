import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* #293: «anche se la stufa a pellet e' spenta l'icona della ventola gira
 * sempre e anche la riga tratteggiata tra la stufa e i gradi della stanza
 * scorre sempre». Il ventilatore e' un `number` (livello 3 di 5): il livello
 * resta scritto anche a stufa spenta, e bastava quello per far girare tutto.
 * E #294 («i dati sono troppo scuri»): la pagina si fotografa in chiaro e in
 * scuro, per guardarla. */
const RENDER = process.env.DM_FOTO || "";
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
const s = (id, state, attributes = {}) => [id, { entity_id: id, state, attributes }];
const STATI = Object.fromEntries([
  s("sensor.k_stato", "off"),
  s("sensor.k_corpo", "33", { unit_of_measurement: "°C" }),
  s("sensor.k_mandata", "22", { unit_of_measurement: "°C" }),
  s("sensor.k_acqua", "60", { unit_of_measurement: "°C" }),
  s("sensor.k_alto", "60", { unit_of_measurement: "°C" }),
  s("sensor.k_p1", "33", { unit_of_measurement: "%" }),
  s("sensor.k_p2", "85", { unit_of_measurement: "%" }),
  s("climate.stufa", "off", {
    temperature: 20,
    current_temperature: 21.5,
    hvac_modes: ["off", "heat"],
  }),
  s("sensor.s_temp", "21.5", { unit_of_measurement: "°C" }),
  s("sensor.s_fumi", "30", { unit_of_measurement: "°C" }),
  s("number.s_pot", "3", { min: 1, max: 5, step: 1 }),
  s("number.s_vent", "3", { min: 1, max: 5, step: 1 }),
]);
const CALDAIA = [
  {
    id: "k",
    name: "Klover",
    stato: "sensor.k_stato",
    mandata: "sensor.k_mandata",
    uscita: "boiler",
    temperaturaCaldaia: "sensor.k_corpo",
    acquaCalda: "sensor.k_acqua",
    boilerAlto: "sensor.k_alto",
    pellet: "sensor.k_p1",
    pellet2: "sensor.k_p2",
  },
];
const STUFE = [
  {
    name: "Stufa Piazzetta",
    clima: "climate.stufa",
    temperatura: "sensor.s_temp",
    fumi: "sensor.s_fumi",
    potenza: "number.s_pot",
    ventilatore: "number.s_vent",
  },
  { name: "Stufa alloggio", clima: "climate.stufa" },
];

async function apriLaStufa(page, testInfo, { tema, clima }) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(
    ({ stati, caldaie, stufe, tema, clima }) => {
      document.documentElement.setAttribute("data-theme", tema);
      Object.assign(eval("_RAW_STATES"), stati, clima ? { "climate.stufa": clima } : {});
      localStorage.setItem(
        "cd_impianti_termici",
        JSON.stringify({ solare: false, scaldabagno: false, caldaia: true, stufa: true }),
      );
      localStorage.setItem("cd_caldaia", JSON.stringify(caldaie));
      localStorage.setItem("cd_stufe", JSON.stringify(stufe));
      document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
      document.getElementById("page-boiler")?.classList.add("active");
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { stati: STATI, caldaie: CALDAIA, stufe: STUFE, tema, clima },
  );
  await page.waitForTimeout(600);
  await page.locator(".dm-it-tab", { hasText: /stufa/i }).first().click();
  await page.waitForTimeout(500);
  return page.locator(".dm-it-stage:not([hidden])");
}

const comeGira = (palco) =>
  palco.evaluate((n) => ({
    aria: n.querySelector(".dm-it-scena")?.getAttribute("data-aria"),
    ventola: n.querySelector(".dm-it-stufa-ventola")?.getAttribute("data-gira"),
  }));

for (const tema of ["light", "dark"])
  test(`la stufa spenta non soffia (${tema})`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "una misura sola basta");
    const palco = await apriLaStufa(page, testInfo, { tema });
    expect(await comeGira(palco)).toEqual({ aria: "false", ventola: "false" });
    if (RENDER) await palco.screenshot({ path: `${RENDER}/stufa-spenta-${tema}.png` });
  });

test("la stufa che scalda soffia", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "una misura sola basta");
  const palco = await apriLaStufa(page, testInfo, {
    tema: "dark",
    clima: {
      entity_id: "climate.stufa",
      state: "heat",
      attributes: {
        temperature: 22,
        current_temperature: 20,
        hvac_action: "heating",
        hvac_modes: ["off", "heat"],
      },
    },
  });
  expect(await comeGira(palco)).toEqual({ aria: "true", ventola: "true" });
  if (RENDER) await palco.screenshot({ path: `${RENDER}/stufa-accesa-dark.png` });
});
