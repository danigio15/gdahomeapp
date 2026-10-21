/* «Nella sezione carichi, se sono impostati gli elettrodomestici, in
 * automatico deve creare i flussi con le stanze: cerchio Cucina, e dietro
 * tutti gli elettrodomestici di Cucina; fuori la somma è il totale del
 * cerchio. L'unico che resta sempre fuori è la Wallbox.»
 *
 * Sul documento vero: sotto Casa la Wallbox, poi Cucina e Lavanderia coi loro
 * watt sommati, e «Altro» col Boiler che una stanza non ce l'ha. Toccando
 * Cucina la finestra elenca i suoi elettrodomestici. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "cucina", name: "Cucina" },
      { id: "lavanderia", name: "Lavanderia" },
    ],
    cameras: [],
    appliances: [
      { id: "forno", name: "Forno", power_entity: "sensor.forno_w", room_id: "cucina" },
      { id: "frigo", name: "Frigo", power_entity: "sensor.frigo_w", room_id: "cucina" },
      {
        id: "lavatrice",
        name: "Lavatrice",
        power_entity: "sensor.lavatrice_w",
        room_id: "lavanderia",
      },
    ],
    loads: [
      { id: "load-wallbox", name: "Wallbox", power_entity: "sensor.wallbox_w", order: 0 },
      { id: "boiler", name: "Boiler", power_entity: "sensor.boiler_w", order: 1 },
    ],
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
};

const LETTURE = {
  "sensor.forno_w": "1000",
  "sensor.frigo_w": "150",
  "sensor.lavatrice_w": "400",
  "sensor.wallbox_w": "1600",
  "sensor.boiler_w": "50",
  "sensor.rete_w": "3200",
  "sensor.casa_w": "3200",
};

/* I numeri stanno dentro il cerchio, non solo dentro il suo quadrato.
 *
 * «Cerchi energia: i valori ora toccano i cerchi.» Il numero si stringeva
 * quando usciva dal quadrato della bolla, ma la bolla e' tonda: all'altezza
 * del numero, sotto il centro, la corda e' piu' corta del lato, e «206,6 kWh»
 * ci stava nel quadrato toccando il bordo del cerchio. Qui si misura la corda
 * vera, alla riga alta e a quella bassa del numero.
 */
const MEDIE = {
  /* 206,6 kWh in Cucina e 23,4 in Lavanderia, come sul telefono del campo. */
  "sensor.forno_w": [{ mean: 103300 }, { mean: 103300 }],
  "sensor.frigo_w": [{ mean: 0 }],
  "sensor.lavatrice_w": [{ mean: 23400 }],
};

async function apriLaGiornaliera(page, testInfo) {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(
    () => Boolean(window.DashboardModernEnergyService?.broker?.request),
    null,
    {
      timeout: 30_000,
    },
  );
  await page.evaluate(
    ({ letture, medie }) => {
      const raw = eval("_RAW_STATES");
      for (const [id, valore] of Object.entries(letture))
        raw[id] = { entity_id: id, state: valore, attributes: { unit_of_measurement: "W" } };
      const broker = window.DashboardModernEnergyService.broker;
      const prima = broker.request.bind(broker);
      broker.request = async (domanda, ...resto) => {
        if (
          domanda?.type === "recorder/statistics_during_period" &&
          domanda.types?.includes("mean")
        )
          return Object.fromEntries(
            domanda.statistic_ids.filter((id) => medie[id]).map((id) => [id, medie[id]]),
          );
        return prima(domanda, ...resto);
      };
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { letture: LETTURE, medie: MEDIE },
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

/* Per ogni numero delle bolle dei carichi: quanto sborda dalla corda del
 * cerchio (al netto del bordo), alla sua riga alta e a quella bassa. */
const sbordi = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("#view-day .n-load")]
      .filter((bolla) => bolla.offsetParent !== null)
      .flatMap((bolla) => {
        const b = bolla.getBoundingClientRect();
        const r = b.width / 2 - 4;
        const cx = b.left + b.width / 2;
        const cy = b.top + b.height / 2;
        return [...bolla.querySelectorAll("span:not(.node-label):not(.node-icon)")]
          .filter((n) => n.textContent.trim() && n.getClientRects().length)
          .map((n) => {
            const t = n.getBoundingClientRect();
            /* Il testo vero, non la scatola: un intervallo sui suoi caratteri. */
            const intervallo = document.createRange();
            intervallo.selectNodeContents(n);
            const v = intervallo.getBoundingClientRect();
            const dy = Math.max(Math.abs(v.top - cy), Math.abs(v.bottom - cy));
            const mezzaCorda = dy < r ? Math.sqrt(r * r - dy * dy) : 0;
            const fuori = Math.max(cx - mezzaCorda - v.left, v.right - (cx + mezzaCorda));
            return {
              testo: n.textContent.trim(),
              fuori: Math.round(fuori * 10) / 10,
              largo: Math.round(v.width),
              r: Math.round(r),
            };
          });
      }),
  );

test("i kWh delle stanze stanno dentro il cerchio", async ({ page }, testInfo) => {
  await apriLaGiornaliera(page, testInfo);
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.querySelector("#view-day")?.textContent.replace(/\s+/g, " ") || "",
        ),
      { timeout: 15_000 },
    )
    .toMatch(/206[.,]6 ?kWh/);
  await page.waitForTimeout(600);
  const misure = await sbordi(page);
  console.log(JSON.stringify(misure));
  expect(misure.length).toBeGreaterThan(0);
  expect(misure.filter((m) => m.fuori > 0)).toEqual([]);
  if (process.env.DM_FOTO)
    await page
      .locator("#view-day .flow-stage")
      .first()
      .screenshot({ path: `${process.env.DM_FOTO}/cerchi-${testInfo.project.name}.png` });
});
