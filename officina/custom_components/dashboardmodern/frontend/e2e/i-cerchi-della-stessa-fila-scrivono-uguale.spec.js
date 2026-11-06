/* «Perché il locale tecnico sembra avere una dimensione dei caratteri
 * differente rispetto agli altri.»
 *
 * Sul telefono, Energia › Giornaliera: «LOCALE TECNICO» su due righe e il suo
 * «0,2 kWh» grande il doppio di «65,5 kWh» della wallbox accanto. Ogni numero
 * si stringeva per conto suo, e quello sotto il nome lungo — sceso fin sul
 * bordo del cerchio — non veniva nemmeno misurato.
 *
 * Qui il documento di quella casa: la wallbox e quattro stanze, una col nome
 * su due righe e il numero piu' corto. Tutti i numeri dei carichi hanno la
 * stessa misura, e la misura e' quella del cerchio (`misureDelCarico`), non
 * quella che serve al testo. Lo stesso per i nomi. E nell'istantanea i
 * quattro cerchioni: «0 W» della rete accanto a «4,20 kW» del sole. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { misureDelCarico } from "../src/sections/energy-flow-section.js";

const STANZE = [
  ["cucina", "Cucina", "forno"],
  ["cucinino", "Cucinino", "piastra"],
  ["lavanderia", "Lavanderia", "lavatrice"],
  ["tecnico", "Locale tecnico", "pompa"],
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: STANZE.map(([id, name]) => ({ id, name })),
    cameras: [],
    appliances: STANZE.map(([room_id, , id]) => ({
      id,
      name: id,
      power_entity: `sensor.${id}_w`,
      room_id,
    })),
    loads: [{ id: "load-wallbox", name: "Wallbox", power_entity: "sensor.wallbox_w", order: 0 }],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {
      solar: { power: "sensor.sole_w" },
      grid: { power: "sensor.rete_w" },
      house: { power: "sensor.casa_w" },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
};

/* L'istantanea: il sole a 4,20 kW e la rete ferma a «0 W». */
const LETTURE = {
  "sensor.sole_w": "4200",
  "sensor.rete_w": "0",
  "sensor.casa_w": "4200",
  "sensor.wallbox_w": "2600",
  "sensor.forno_w": "1200",
  "sensor.piastra_w": "0",
  "sensor.lavatrice_w": "400",
  "sensor.pompa_w": "0",
};

/* Il giorno, coi numeri della foto: 65,5 · 25,7 · 3,3 · 15,9 · 0,2 kWh. */
const MEDIE = {
  "sensor.wallbox_w": [{ mean: 65500 }],
  "sensor.forno_w": [{ mean: 25700 }],
  "sensor.piastra_w": [{ mean: 3300 }],
  "sensor.lavatrice_w": [{ mean: 15900 }],
  "sensor.pompa_w": [{ mean: 200 }],
};

async function apriLEnergia(page, testInfo) {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(
    () => Boolean(window.DashboardModernEnergyService?.broker?.request),
    null,
    { timeout: 30_000 },
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
}

/* Per ogni cerchio visibile della vista: il nome, il numero, le loro misure
 * del carattere, il lato del cerchio, quante righe fa il nome e quanto il
 * numero sborda dalla corda (al netto del bordo). */
const cerchi = (page, vista, quali) =>
  page.evaluate(
    ({ vista, quali }) =>
      [...document.querySelectorAll(`${vista} ${quali}`)]
        .filter((bolla) => bolla.offsetParent !== null)
        .map((bolla) => ({
          bolla,
          numero: [...bolla.querySelectorAll("span")].find(
            (n) =>
              /\d/.test(n.textContent) && !n.querySelector("span") && n.getClientRects().length,
          ),
        }))
        .filter(({ numero }) => numero)
        .map(({ bolla, numero }) => {
          const nome = bolla.querySelector(".node-label");
          const b = bolla.getBoundingClientRect();
          const r = b.width / 2 - 4;
          const cx = b.left + b.width / 2;
          const cy = b.top + b.height / 2;
          const intervallo = document.createRange();
          intervallo.selectNodeContents(numero);
          const v = intervallo.getBoundingClientRect();
          const dy = Math.max(Math.abs(v.top - cy), Math.abs(v.bottom - cy));
          const mezzaCorda = dy < r ? Math.sqrt(r * r - dy * dy) : 0;
          const altezzaNome = nome.getBoundingClientRect().height;
          return {
            nome: nome.textContent.trim(),
            numero: numero.textContent.trim(),
            misuraNumero: getComputedStyle(numero).fontSize,
            misuraNome: getComputedStyle(nome).fontSize,
            lato: bolla.offsetWidth,
            righeDelNome: Math.round(
              altezzaNome / Number.parseFloat(getComputedStyle(nome).lineHeight),
            ),
            fuori:
              Math.round(Math.max(cx - mezzaCorda - v.left, v.right - (cx + mezzaCorda)) * 10) / 10,
          };
        }),
    { vista, quali },
  );

function scrivonoUguale(misure) {
  expect(misure.length).toBeGreaterThan(1);
  /* Una misura sola per i numeri e una per i nomi: quella del cerchio. */
  const [{ lato }] = misure;
  const attese = misureDelCarico(lato);
  expect(new Set(misure.map((m) => m.lato))).toEqual(new Set([lato]));
  expect(new Set(misure.map((m) => m.misuraNumero))).toEqual(new Set([`${attese.numero}px`]));
  expect(new Set(misure.map((m) => m.misuraNome))).toEqual(new Set([`${attese.nome}px`]));
  /* E dentro il cerchio, anche il numero sotto il nome su due righe. */
  expect(misure.filter((m) => m.fuori > 0)).toEqual([]);
  expect(misure.every((m) => m.righeDelNome <= 2)).toBe(true);
}

test("giornaliera: «0,2 kWh» del locale tecnico come «65,5 kWh» della wallbox", async ({
  page,
}, testInfo) => {
  await apriLEnergia(page, testInfo);
  await page
    .locator("#page-energy .sub-tab-btn", { hasText: /Giornaliera/i })
    .first()
    .click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () => document.querySelector("#view-day")?.textContent.replace(/\s+/g, " ") || "",
        ),
      { timeout: 15_000 },
    )
    .toMatch(/0[.,]2 ?kWh/);
  await page.waitForTimeout(600);
  const misure = await cerchi(page, "#view-day", ".n-load");
  console.log(JSON.stringify(misure));
  expect(misure.map((m) => m.numero.replace(/\s+/g, " "))).toEqual(
    expect.arrayContaining(["65,5 kWh", "0,2 kWh"]),
  );
  /* Il caso della foto c'e' davvero: il nome lungo va su due righe. */
  expect(misure.find((m) => /locale/i.test(m.nome))?.righeDelNome).toBe(2);
  scrivonoUguale(misure);
});

test("istantanea: i carichi uguali fra loro, e «0 W» come «4,20 kW» nei cerchioni", async ({
  page,
}, testInfo) => {
  await apriLEnergia(page, testInfo);
  await expect(page.locator("#view-ist [data-dm-flow-node]")).toHaveCount(5, { timeout: 20_000 });
  await expect
    .poll(() => page.locator("#v-solar").textContent(), { timeout: 15_000 })
    .toMatch(/4[.,]20 ?kW/);
  await page.waitForTimeout(600);
  scrivonoUguale(await cerchi(page, "#view-ist", ".n-load"));
  const cerchioni = await cerchi(page, "#view-ist", ".node:not(.n-load)");
  console.log(JSON.stringify(cerchioni));
  expect(cerchioni.map((m) => m.numero)).toEqual(expect.arrayContaining(["0 W"]));
  expect(new Set(cerchioni.map((m) => m.misuraNumero)).size).toBe(1);
  expect(new Set(cerchioni.map((m) => m.misuraNome)).size).toBe(1);
});
