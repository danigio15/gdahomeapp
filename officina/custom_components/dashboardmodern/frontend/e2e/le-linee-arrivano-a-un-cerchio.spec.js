import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Le linee del flusso arrivano a un cerchio.
 *
 * «La grafica dei flussi ha sempre due flussi presenti anche se non portano a
 * nulla»: sotto Casa una linea arancione che andava verso il bordo e una
 * azzurra corta ferma nel vuoto, accanto a Bagno e Altro.
 *
 * Erano i binari — la strada tenue sotto ogni linea accesa — di cerchi che non
 * c'erano piu'. Quando i carichi scritti a mano lasciano il posto ai cerchi
 * delle stanze (gli elettrodomestici arrivano dopo, e ogni cambio di
 * configurazione rifa' la scena), le loro linee si tolgono, ma il binario che
 * stava sotto restava nel disegno, acceso, con la strada di prima.
 *
 * Con `DM_FOTO=<cartella>` lascia le fotografie. */
const STANZE = [
  { id: "bagno", name: "Bagno" },
  { id: "cucina", name: "Cucina" },
];

const CARICHI = [
  { id: "frigo", name: "Frigo", icon: "🧊", power_entity: "sensor.frigo_w", order: 0 },
  { id: "clima", name: "Clima", icon: "❄️", power_entity: "sensor.clima_w", order: 1 },
];

const APPARECCHI = [
  { id: "app-asciuga", name: "Asciugatrice", room_id: "bagno", power_entity: "sensor.asciuga_w" },
  { id: "app-tv", name: "TV", power_entity: "sensor.tv_w" },
];

const seme = () => ({
  schema_version: 4,
  sections: {
    rooms: STANZE,
    cameras: [],
    appliances: [],
    loads: CARICHI,
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: { grid: { power: "sensor.rete_w" }, house: { power: "sensor.casa_w" } },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
});

const LETTURE = {
  "sensor.frigo_w": "90",
  "sensor.clima_w": "75",
  "sensor.asciuga_w": "165",
  "sensor.tv_w": "0",
  "sensor.rete_w": "200",
  "sensor.casa_w": "200",
};

async function leggi(page, letture) {
  await page.evaluate((valori) => {
    const raw = eval("_RAW_STATES");
    for (const [id, valore] of Object.entries(valori))
      raw[id] = { entity_id: id, state: valore, attributes: { unit_of_measurement: "W" } };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  }, letture);
}

async function foto(page, testInfo, nome) {
  if (!process.env.DM_FOTO) return;
  const scena = page.locator("#view-ist .flow-stage").first();
  await scena.screenshot({ path: `${process.env.DM_FOTO}/${nome}-${testInfo.project.name}.png` });
}

/* I binari accesi della vista Istantaneo, e se sotto ciascuno c'e' ancora la
 * sua linea, mostrata. */
const binariAccesi = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("#view-ist .dm-flow-binario")]
      .filter((b) => getComputedStyle(b).display !== "none")
      .map((b) => {
        const linea = b.nextElementSibling;
        const mostrata =
          Boolean(linea) &&
          linea.__dmBinario === b &&
          getComputedStyle(linea).display !== "none" &&
          Number(getComputedStyle(linea).opacity) > 0;
        return { d: b.getAttribute("d"), mostrata };
      }),
  );

test("i carichi lasciano il posto alle stanze: nessuna linea resta senza cerchio", async ({
  page,
}, testInfo) => {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme());
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await leggi(page, LETTURE);
  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((b) => b.click());
  await page.waitForTimeout(1500);
  /* Prima: i due carichi scritti a mano, accesi, coi loro binari. */
  expect((await binariAccesi(page)).length).toBeGreaterThan(0);

  /* Arrivano gli elettrodomestici con le stanze: i carichi entrano nei cerchi
   * delle stanze, e le loro linee si tolgono. */
  await page.evaluate(
    async ({ apparecchi }) => {
      const negozio = window.DashboardModernModules.store;
      await negozio.replaceSection("appliances", apparecchi);
    },
    { apparecchi: APPARECCHI },
  );
  await leggi(page, LETTURE);
  await page.waitForTimeout(1500);
  await foto(page, testInfo, "flusso-stanze");

  const binari = await binariAccesi(page);
  expect(binari.filter((b) => !b.mostrata)).toEqual([]);
  /* E le linee vive il loro binario ce l'hanno ancora. */
  expect(binari.length).toBeGreaterThan(0);
});
