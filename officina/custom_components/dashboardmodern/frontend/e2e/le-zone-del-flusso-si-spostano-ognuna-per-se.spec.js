/* Ogni zona del flusso Energia si sistema per conto suo.
 *
 * «Ho cercato di spostare i flussi ma metto a posto una zona, la salvo e si
 * incasina l'altra e viceversa.» Due impianti, due linguette in cima
 * all'Energia, cerchi diversi sotto Casa ma con nomi in comune (Rete, Casa,
 * «Altro», «Non monitorati»). Si sposta e si salva in una, poi nell'altra, si
 * ricarica: ognuna e' come la si era lasciata, e nessun cerchio e' tagliato
 * dal bordo del palco.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

test.use({ timezoneId: "Europe/Rome", locale: "it-IT" });

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "bagno", name: "Bagno" },
      { id: "spogliatoio", name: "Spogliatoio" },
      { id: "cucina", name: "Cucina" },
      { id: "sala-cinema", name: "Sala cinema" },
    ],
    cameras: [],
    appliances: [
      {
        id: "scalda",
        name: "Scaldasalviette",
        power_entity: "sensor.scalda_w",
        room_id: "bagno",
        plant: "impianto",
      },
      {
        id: "luce",
        name: "Luce armadio",
        power_entity: "sensor.luce_w",
        room_id: "spogliatoio",
        plant: "impianto",
      },
      { id: "sveglia", name: "Sveglia", power_entity: "sensor.sveglia_w", plant: "impianto" },
      {
        id: "forno",
        name: "Forno",
        power_entity: "sensor.forno_w",
        room_id: "cucina",
        plant: "impianto-2",
      },
      { id: "router", name: "Router", power_entity: "sensor.router_w", plant: "impianto-2" },
      {
        id: "proiettore",
        name: "Proiettore",
        power_entity: "sensor.proi_w",
        room_id: "sala-cinema",
        plant: "impianto-2",
      },
    ],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {
      id: "impianto",
      name: "Mansarda",
      grid: { power: "sensor.rete_a_kw" },
      house: { power: "sensor.casa_a_kw" },
      plants: [
        {
          id: "impianto-2",
          name: "Taverna",
          grid: { power: "sensor.rete_b_kw" },
          house: { power: "sensor.casa_b_kw" },
        },
      ],
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

const LETTURE = {
  "sensor.scalda_w": ["0", "W"],
  "sensor.luce_w": ["29", "W"],
  "sensor.sveglia_w": ["0", "W"],
  "sensor.forno_w": ["96", "W"],
  "sensor.router_w": ["15", "W"],
  "sensor.proi_w": ["0", "W"],
  "sensor.rete_a_kw": ["0.06", "kW"],
  "sensor.casa_a_kw": ["0.06", "kW"],
  "sensor.rete_b_kw": ["0.3", "kW"],
  "sensor.casa_b_kw": ["0.3", "kW"],
};

async function stati(page) {
  await page.evaluate((valori) => {
    const raw = eval("_RAW_STATES");
    for (const [id, [v, u]] of Object.entries(valori))
      raw[id] = { entity_id: id, state: v, attributes: { unit_of_measurement: u } };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, LETTURE);
}

async function allEnergia(page) {
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await stati(page);
  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((b) => b.click());
  await expect(page.locator('#view-ist [data-dm-flow-node="stanza-altro"]')).toBeVisible({
    timeout: 20_000,
  });
}

async function zona(page, id, cerchio) {
  await page
    .locator(`[data-dm-impianto="${id}"]`)
    .first()
    .evaluate((b) => b.click());
  await expect(page.locator(`#view-ist [data-dm-flow-node="${cerchio}"]`)).toBeVisible({
    timeout: 20_000,
  });
  /* I cerchi arrivano al loro posto con una transizione. */
  await page.waitForTimeout(600);
}

/* Dove stanno i cerchi sotto Casa, in percento del palco, e quanti escono. */
const fotografia = (page) =>
  page.evaluate(() => {
    const palco = document.querySelector("#view-ist .flow-stage");
    const P = palco.getBoundingClientRect();
    const posti = {};
    const fuori = [];
    for (const n of palco.querySelectorAll(":scope > [data-dm-flow-node]")) {
      const r = n.getBoundingClientRect();
      if (r.width < 2) continue;
      posti[n.dataset.dmFlowNode] = {
        x: Math.round(((r.left + r.width / 2 - P.left) / P.width) * 1000) / 10,
        y: Math.round(((r.top + r.height / 2 - P.top) / P.height) * 1000) / 10,
      };
      if (
        r.left < P.left - 1 ||
        r.right > P.right + 1 ||
        r.top < P.top - 1 ||
        r.bottom > P.bottom + 1
      )
        fuori.push(n.dataset.dmFlowNode);
    }
    return { posti, fuori };
  });

async function trascina(page, nodo, dx, dy) {
  const maniglia = page.locator(`[data-dm-disegno-nodo="${nodo}"]`);
  await maniglia.scrollIntoViewIfNeeded();
  const box = await maniglia.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i += 1) await page.mouse.move(x + (dx * i) / 10, y + (dy * i) / 10);
  await page.mouse.up();
}

async function sistema(page, mosse) {
  await page.evaluate(() => window.dmDisposizione.entraInModifica());
  await expect(page.locator("[data-dm-disegno-strato='energia']")).toBeAttached();
  for (const [nodo, dx, dy] of mosse) await trascina(page, nodo, dx, dy);
  await page.locator('[data-dm-disp-azione="salva"]').click();
  await expect(page.locator("html")).not.toHaveAttribute("data-dm-modifica", /./);
  await page.waitForTimeout(600);
}

test("sposto e salvo una zona, poi l'altra, ricarico: ognuna come l'avevo lasciata", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "webkit-ipad", "il trascinamento col mouse");
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await allEnergia(page);
  const passo = testInfo.project.name === "mobile" ? 40 : 90;

  await zona(page, "impianto-2", "stanza-cucina");
  const taverna0 = await fotografia(page);
  expect(taverna0.fuori).toEqual([]);

  await zona(page, "impianto", "stanza-bagno");
  expect((await fotografia(page)).fuori).toEqual([]);
  await sistema(page, [
    ["carico:stanza-altro", -passo, 60],
    ["carico:carichi-non-monitorati", -passo, 30],
    ["casa", -passo, 0],
  ]);
  const mansarda = await fotografia(page);
  expect(mansarda.fuori).toEqual([]);

  /* La Taverna non se n'e' accorta. */
  await zona(page, "impianto-2", "stanza-cucina");
  expect((await fotografia(page)).posti).toEqual(taverna0.posti);
  await sistema(page, [
    ["carico:stanza-altro", passo, 40],
    ["carico:stanza-cucina", 0, 60],
  ]);
  const taverna = await fotografia(page);
  expect(taverna.fuori).toEqual([]);

  /* E la Mansarda non si e' accorta della Taverna. */
  await zona(page, "impianto", "stanza-bagno");
  expect((await fotografia(page)).posti).toEqual(mansarda.posti);

  /* Due caselle, una per zona, coi cerchi chiamati per id. */
  const salvata = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_disegni") || "{}"));
  const variante = testInfo.project.name === "mobile" ? "telefono" : "computer";
  expect(Object.keys(salvata).sort()).toEqual([
    `energia-impianto-2:${variante}`,
    `energia-impianto:${variante}`,
  ]);
  expect(salvata[`energia-impianto:${variante}`]).toHaveProperty("carico:stanza-bagno");
  expect(salvata[`energia-impianto-2:${variante}`]).toHaveProperty("carico:stanza-cucina");

  /* Ricarico: ognuna come l'avevo lasciata. */
  await page.reload();
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await allEnergia(page);
  await zona(page, "impianto", "stanza-bagno");
  expect((await fotografia(page)).posti).toEqual(mansarda.posti);
  await zona(page, "impianto-2", "stanza-cucina");
  expect((await fotografia(page)).posti).toEqual(taverna.posti);
});

test("la disposizione comune di prima si divide fra le zone al primo Salva", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "il computer");
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  /* Com'era salvato fino alla 1.19.8: una casella sola per tutte le zone. */
  const vecchia = {
    "carico:stanza-bagno": { x: 20, y: 70 },
    "carico:stanza-cucina": { x: 15, y: 72.5 },
  };
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate((v) => {
    localStorage.setItem("cd_disegni", JSON.stringify({ "energia:computer": v }));
    window.dispatchEvent(new Event("storage"));
  }, vecchia);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await allEnergia(page);
  /* Prima del Salva ogni zona vede la disposizione di sempre. */
  await zona(page, "impianto", "stanza-bagno");
  const bagno = (await fotografia(page)).posti["stanza-bagno"];
  expect(Math.abs(bagno.x - 20)).toBeLessThan(1);
  await zona(page, "impianto-2", "stanza-cucina");
  expect(Math.abs((await fotografia(page)).posti["stanza-cucina"].x - 15)).toBeLessThan(1);
  /* Si sistema la Taverna: la Mansarda si tiene la sua copia. */
  await sistema(page, [["carico:stanza-altro", 90, 30]]);
  const salvata = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_disegni") || "{}"));
  expect(salvata["energia:computer"]).toBeUndefined();
  expect(salvata["energia-impianto:computer"]).toEqual(vecchia);
  expect(salvata["energia-impianto-2:computer"]["carico:stanza-cucina"]).toEqual(
    vecchia["carico:stanza-cucina"],
  );
  await zona(page, "impianto", "stanza-bagno");
  expect(Math.abs((await fotografia(page)).posti["stanza-bagno"].x - 20)).toBeLessThan(1);
});
