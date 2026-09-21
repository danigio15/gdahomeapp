/* «Rooms must be displayed in groups based on the selected floor... Small icons
 * should appear on the card to indicate the status or count of lights, climate
 * control, power outlets, alerts, doors, windows, and temperature» (#17, parti
 * 1 e 2).
 *
 * La pagina Stanze si apriva su UNA stanza, con la fila delle linguette in
 * cima: con venti stanze — ed è il caso che teneva aperta anche la #12, «via il
 * limite di 8 stanze» — quella fila è uno scorrimento in cui si cerca il nome.
 *
 * Qui si guarda quello che vede una persona: l'elenco diviso per piano, le
 * pastiglie che dicono com'è messa ogni stanza senza entrarci, e il giro
 * completo — entro, torno.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        name: "Cucina",
        icon: "mdi:silverware-fork-knife",
        floor: "Piano terra",
        temp: "sensor.t_cucina",
      },
      { name: "Salotto", icon: "mdi:sofa", floor: "Piano terra", temp: "sensor.t_salotto" },
      { name: "Bagno", icon: "mdi:shower", floor: "Piano terra", temp: "sensor.t_bagno" },
      { name: "Camera", icon: "mdi:bed", floor: "Primo piano", temp: "sensor.t_camera" },
      { name: "Studio", icon: "mdi:desk", floor: "Primo piano" },
      { name: "Cantina", icon: "mdi:stairs-down" },
    ],
    cameras: [],
    appliances: [],
    loads: [],
    ev: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
    climate: [],
    people: [],
    covers: [{ name: "Finestra cucina", entity: "cover.fin_cucina", room: "Cucina" }],
    prese: [{ name: "TV", entity: "switch.tv", room: "Salotto" }],
  },
  visibility: { home: true, stanze: true },
};

const LUCI = {
  "light.cucina_1": "Cucina",
  "light.cucina_2": "Cucina",
  "light.cucina_3": "Cucina",
  "light.salotto_1": "Salotto",
  "light.salotto_2": "Salotto",
  "light.bagno": "Bagno",
  "light.camera": "Camera",
};
const STANZE_LUCI = {
  "light.cucina_1": "Cucina",
  "light.cucina_2": "Cucina",
  "light.cucina_3": "Cucina",
  "light.salotto_1": "Salotto",
  "light.salotto_2": "Salotto",
  "light.bagno": "Bagno",
  "light.camera": "Camera",
};

const stati = {
  "sensor.t_cucina": { state: "21", attributes: {} },
  "sensor.t_salotto": { state: "22", attributes: {} },
  "sensor.t_bagno": { state: "23", attributes: {} },
  "sensor.t_camera": { state: "19", attributes: {} },
  "light.cucina_1": { state: "on", attributes: {} },
  "light.cucina_2": { state: "on", attributes: {} },
  "light.cucina_3": { state: "on", attributes: {} },
  "light.salotto_1": { state: "on", attributes: {} },
  "light.salotto_2": { state: "on", attributes: {} },
  "light.bagno": { state: "off", attributes: {} },
  "light.camera": { state: "off", attributes: {} },
  "cover.fin_cucina": { state: "open", attributes: { current_position: 60 } },
  "switch.tv": { state: "on", attributes: {} },
};

async function apriLeStanze(page, testInfo) {
  test.setTimeout(90_000);
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(
    ({ s, luci, stanze }) => {
      window.__HASS__ = { states: s };
      window.hass = { ...(window.hass || {}), states: s };
      window._RAW_STATES = s;
      window.localStorage.setItem("cd_luci", JSON.stringify(luci));
      window.localStorage.setItem("cd_luci_rooms", JSON.stringify(stanze));
      window.cdFloorNames = () => ["Piano terra", "Primo piano"];
      /* I comandi si raccolgono invece di partire: qui si guarda CHE COSA la
       * plancia chiede a Home Assistant, non cosa fa Home Assistant. */
      window.__DM_CHIAMATE__ = [];
      window.dmCallHaService = (domain, service, data) =>
        window.__DM_CHIAMATE__.push({ domain, service, data });
      window.cdCallServiceJson = window.dmCallHaService;
      window.callService = window.dmCallHaService;
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
    },
    { s: stati, luci: LUCI, stanze: STANZE_LUCI },
  );
  await page.locator('.tab[data-tab="stanze"]').first().click();
  await expect(page.locator("#page-stanze")).toHaveClass(/active/);
  await expect(page.locator("#page-stanze .dm-stanze-tessera")).toHaveCount(6);
}

test("le stanze per piano", async ({ page }, testInfo) => {
  await apriLeStanze(page, testInfo);

  /* I piani, nell'ordine in cui stanno, e la riga che dice se lassù è rimasto
   * acceso qualcosa: chi sale le scale vuole quella, non il conto stanza per
   * stanza fatto con gli occhi. */
  await expect(page.locator("#page-stanze .dm-stanze-piano")).toHaveText([
    /PIANO TERRA\s*5 accese/i,
    /PRIMO PIANO\s*tutto spento/i,
    /SENZA PIANO\s*tutto spento/i,
  ]);
  await expect(page.locator("#page-stanze .dm-stanze-tessera")).toHaveCount(6);
  await expect(page.locator("#page-stanze .dm-stanze-indice-testa")).toContainText("2 piani");

  /* Le pastiglie della cucina: tre luci accese, i gradi della sua sonda, una
   * finestra aperta. E niente prese, che in cucina non ce ne sono accese. */
  const pastiglie = (stanza) =>
    page
      .locator(`#page-stanze .dm-stanze-tessera[data-dm-stanza="${stanza}"] .dm-stanze-pill`)
      .evaluateAll((nodi) =>
        nodi.map((nodo) => `${nodo.dataset.dmStanzaPill}=${nodo.querySelector("b").textContent}`),
      );
  await expect.poll(() => pastiglie("room-cucina")).toEqual(["luci=3", "gradi=21°", "finestre=1"]);
  await expect.poll(() => pastiglie("room-salotto")).toEqual(["luci=2", "prese=1", "gradi=22°"]);
  /* Una stanza senza sonda non dice «0°»: `Number(null)` fa zero, e una
   * pastiglia a zero gradi non è una misura mancante, è una misura sbagliata. */
  await expect.poll(() => pastiglie("room-studio")).toEqual([]);

  /* Toccandola si entra, e da dentro si torna all'elenco. */
  await page.locator('#page-stanze .dm-stanze-tessera[data-dm-stanza="room-cucina"]').click();
  await expect(page.locator("[data-dm-stanze-indice]")).toBeVisible();
  await expect(page.locator("#page-stanze .dm-stanze-tessera")).toHaveCount(0);
  /* Dentro la stanza la fila delle linguette resta: serve a saltare alla
   * stanza dopo senza tornare indietro. */
  await expect(page.locator("#page-stanze .dm-stanze-tabs")).toHaveCount(1);

  await page.locator("[data-dm-stanze-indice]").click();
  await expect(page.locator("#page-stanze .dm-stanze-tessera")).toHaveCount(6);
});

/* «Clicking on one of these small icons — for example, the light icon — should
 * toggle the device without needing to enter the room» (#17, parte 3).
 *
 * È la parte delicata, e non per il codice: una tessera che finora si toccava
 * per ENTRARE diventa una tessera con sette bersagli dentro, e il tocco
 * sbagliato spegne le luci a chi voleva solo guardare. Perciò il tocco non
 * spegne: chiede. E dopo che si è spento resta il modo di tornare indietro.
 */
test("la lampadina chiede prima di spegnere, e si può tornare indietro", async ({
  page,
}, testInfo) => {
  await apriLeStanze(page, testInfo);
  const cucina = '#page-stanze .dm-stanze-tessera[data-dm-stanza="room-cucina"]';
  const lampadina = `${cucina} [data-dm-stanza-spegni="luci"]`;

  /* La pastiglia che comanda è un tasto: con la tastiera ci si arriva, e chi
   * ascolta sente che è una cosa che si preme. */
  await expect(page.locator(lampadina)).toHaveCount(1);
  await expect(page.locator(lampadina)).toHaveJSProperty("tagName", "BUTTON");
  /* Quelle che non comandano no: il tocco scivola sulla tessera, che porta
   * dentro. */
  await expect(page.locator(`${cucina} [data-dm-stanza-pill="gradi"]`)).toHaveJSProperty(
    "tagName",
    "SPAN",
  );

  /* Un tocco: chiede, e non è ancora successo niente. */
  await page.locator(lampadina).click();
  await expect(page.locator(`${cucina} [data-dm-stanza-velo="chiesta"]`)).toContainText(
    /Spengo 3 luci\?/,
  );
  await expect(page.evaluate(() => window.__DM_CHIAMATE__.length)).resolves.toBe(0);
  /* E la stanza non si è aperta sotto il velo: chi voleva solo guardare è
   * ancora dov'era. */
  await expect(page.locator("#page-stanze .dm-stanze-tessera")).toHaveCount(6);

  /* Il secondo tocco spegne davvero, e resta l'annulla. */
  await page.locator(`${cucina} [data-dm-stanza-conferma="luci"]`).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__DM_CHIAMATE__.filter((c) => c.service === "turn_off").map((c) => c.data.entity_id),
      ),
    )
    .toEqual(["light.cucina_1", "light.cucina_2", "light.cucina_3"]);
  await expect(page.locator(`${cucina} [data-dm-stanza-velo="annulla"]`)).toBeVisible();

  /* L'annulla riaccende quelle che ha spento lui, non «tutto com'era»: in
   * mezzo secondo la casa è già cambiata da sola. */
  await page.locator(`${cucina} [data-dm-stanza-annulla]`).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__DM_CHIAMATE__.filter((c) => c.service === "turn_on").map((c) => c.data.entity_id),
      ),
    )
    .toEqual(["light.cucina_1", "light.cucina_2", "light.cucina_3"]);
  await expect(page.locator(`${cucina} .dm-stanze-velo`)).toHaveCount(0);
});

test("la domanda se ne va da sola, e chi passava non ha spento niente", async ({
  page,
}, testInfo) => {
  await apriLeStanze(page, testInfo);
  const cucina = '#page-stanze .dm-stanze-tessera[data-dm-stanza="room-cucina"]';
  await page.locator(`${cucina} [data-dm-stanza-spegni="luci"]`).click();
  await expect(page.locator(`${cucina} [data-dm-stanza-velo="chiesta"]`)).toBeVisible();
  /* Due secondi: il tempo di leggerla e di decidere, non tanto da restare lì a
   * ingombrare la tessera di chi passava. */
  await expect(page.locator(`${cucina} .dm-stanze-velo`)).toHaveCount(0, { timeout: 6000 });
  await expect(page.evaluate(() => window.__DM_CHIAMATE__.length)).resolves.toBe(0);
});
