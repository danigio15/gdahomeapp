/* «Nella sezione stanze la parte elettrodomestici ha icone non del catalogo.
 * Non deve esserci nulla che non sia nel nostro catalogo.»
 *
 * Il frigorifero col cubetto di ghiaccio, il forno con la pizza, la friggitrice
 * con le patatine: nella pagina di una stanza le righe portavano le emoji del
 * sistema, accanto alla scocca blu notte della sezione Elettrodomestici. Adesso
 * ogni segno della pagina viene dal catalogo di casa.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seme = {
  schema_version: 4,
  sections: {
    rooms: [
      { name: "Cucina", icon: "mdi:countertop", temp: "sensor.t_cucina", hum: "sensor.h_cucina" },
    ],
    cameras: [],
    appliances: [
      {
        name: "Lavastoviglie",
        entity: "sensor.lavastoviglie",
        room: "Cucina",
        visual_key: "dishwasher",
      },
      { name: "Forno", entity: "sensor.forno", room: "Cucina", visual_key: "oven" },
      { name: "Frigorifero", entity: "sensor.frigo", room: "Cucina", visual_key: "fridge" },
      { name: "Microonde", entity: "sensor.microonde", room: "Cucina", visual_key: "microwave" },
      { name: "Frog", entity: "sensor.frog", room: "Cucina", visual_key: "coffee" },
      { name: "Friggitrice aria", entity: "sensor.friggitrice", room: "Cucina" },
    ],
    loads: [],
    climate: [{ name: "Clima cucina", entity: "climate.cucina", room: "Cucina", type: "clima" }],
    ev: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
    covers: [],
    prese: [{ name: "Presa isola", entity: "switch.isola", room: "Cucina" }],
  },
  visibility: { home: true, stanze: true },
};

const stati = {
  "sensor.t_cucina": { state: "22.4", attributes: {} },
  "sensor.h_cucina": { state: "51", attributes: {} },
  "sensor.lavastoviglie": { state: "0", attributes: {} },
  "sensor.forno": { state: "0", attributes: {} },
  "sensor.frigo": { state: "87", attributes: {} },
  "sensor.microonde": { state: "0", attributes: {} },
  "sensor.frog": { state: "0", attributes: {} },
  "sensor.friggitrice": { state: "0", attributes: {} },
  "climate.cucina": { state: "off", attributes: {} },
  "switch.isola": { state: "off", attributes: {} },
  "light.cucina": { state: "on", attributes: {} },
};

const EMOJI = /\p{Extended_Pictographic}/u;

test("nella pagina di una stanza ogni segno viene dal catalogo, nessuna emoji", async ({
  page,
}, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.evaluate(
    ({ s }) => {
      window.__HASS__ = { states: s };
      window.hass = { ...(window.hass || {}), states: s };
      window._RAW_STATES = s;
      window.localStorage.setItem("cd_luci", JSON.stringify({ "light.cucina": "Luce cucina" }));
      window.localStorage.setItem("cd_luci_rooms", JSON.stringify({ "light.cucina": "Cucina" }));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
    },
    { s: stati },
  );
  await page.locator('.tab[data-tab="stanze"]').first().click();
  await expect(page.locator("#page-stanze")).toHaveClass(/active/);

  /* L'elenco: la tessera della stanza porta il suo disegno. */
  const tessera = page.locator('#page-stanze .dm-stanze-tessera[data-dm-stanza="room-cucina"]');
  await expect(tessera.locator(".dm-stanze-tessera-ic svg")).toHaveCount(1);
  expect(await tessera.locator(".dm-stanze-tessera-ic").innerText()).not.toMatch(EMOJI);

  await tessera.click();
  await expect(page.locator("#page-stanze")).toContainText("Friggitrice aria");

  /* Ogni riga ha il disegno dentro il suo tondo, e nessuna scritta. */
  const tondi = page.locator("#page-stanze .dm-stanze-orb");
  const quanti = await tondi.count();
  expect(quanti).toBeGreaterThanOrEqual(7);
  for (let i = 0; i < quanti; i += 1) {
    await expect(tondi.nth(i).locator("svg")).toHaveCount(1);
    expect(await tondi.nth(i).innerText()).not.toMatch(EMOJI);
  }
  /* I sei elettrodomestici sono sei disegni diversi, dal catalogo loro. */
  const tipi = await page
    .locator("#page-stanze .dm-stanze-orb [data-dm-art]")
    .evaluateAll((nodi) => nodi.map((nodo) => nodo.dataset.dmArt));
  for (const tipo of ["dishwasher", "oven", "fridge", "microwave", "coffee", "air-fryer"])
    expect(tipi).toContain(tipo);

  /* Le linguette delle stanze e i tasti della scena: disegni anche loro. */
  expect(await page.locator("#page-stanze .dm-stanze-tabs").innerText()).not.toMatch(EMOJI);
  expect(await page.locator("#page-stanze .dm-stanze-scena").innerText()).not.toMatch(EMOJI);

  await page.locator("#page-stanze").screenshot({
    path: testInfo.outputPath("stanza-dal-catalogo.png"),
  });
});
