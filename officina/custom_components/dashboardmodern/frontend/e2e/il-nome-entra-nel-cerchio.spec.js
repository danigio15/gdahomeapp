/* «I cerchi dei flussi: il testo non entra, deve essere adattato.»
 *
 * «LOCALE TECNICO» usciva dai bordi del cerchio anche coi puntini: in cima un
 * cerchio e' piu' stretto che al centro. Il nome va su due righe se serve, e
 * la scritta si stringe finche' non entra. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const STANZE = [
  ["cucina", "Cucina"],
  ["cucinino", "Cucinino"],
  ["lavanderia", "Lavanderia"],
  ["tecnico", "Locale tecnico"],
  ["ripostiglio", "Ripostiglioelettrodomestici"],
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: STANZE.map(([id, name]) => ({ id, name })),
    cameras: [],
    appliances: STANZE.map(([id]) => ({
      id: `app-${id}`,
      name: `Apparecchio ${id}`,
      power_entity: `sensor.${id}_w`,
      room_id: id,
    })),
    loads: [{ id: "load-wallbox", name: "Wallbox", power_entity: "sensor.wallbox_w", order: 0 }],
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

test("il nome di ogni stanza resta dentro il suo cerchio", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((stanze) => {
    const raw = eval("_RAW_STATES");
    const letture = { "sensor.wallbox_w": "0", "sensor.rete_w": "300", "sensor.casa_w": "300" };
    for (const [id] of stanze) letture[`sensor.${id}_w`] = "0";
    for (const [id, valore] of Object.entries(letture))
      raw[id] = { entity_id: id, state: valore, attributes: { unit_of_measurement: "W" } };
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STANZE);
  await page
    .locator('.tab[data-tab="energy"]')
    .first()
    .evaluate((b) => b.click());
  await expect(page.locator("#view-ist [data-dm-flow-node]")).toHaveCount(6, { timeout: 20_000 });
  await page.waitForTimeout(800);

  const fuori = await page.evaluate(() =>
    [...document.querySelectorAll("#view-ist [data-dm-flow-node]")]
      .map((nodo) => {
        const nome = nodo.querySelector(".node-label");
        const cerchio = nodo.getBoundingClientRect();
        const r = cerchio.width / 2;
        const cx = cerchio.left + r;
        const cy = cerchio.top + r;
        /* Ogni riga della scritta, alla sua altezza, contro la corda del
         * cerchio in quel punto. */
        const intervallo = document.createRange();
        intervallo.selectNodeContents(nome);
        /* Coi puntini il testo nascosto non conta: conta la scatola. */
        const coiPuntini = getComputedStyle(nome).textOverflow === "ellipsis";
        const righe = coiPuntini
          ? [nome.getBoundingClientRect()]
          : [...intervallo.getClientRects()].filter((riga) => riga.width > 0);
        const sporge = righe.some((riga) => {
          const dy = Math.max(Math.abs(riga.top - cy), Math.abs(riga.bottom - cy));
          const mezzaCorda = Math.sqrt(Math.max(0, r * r - dy * dy));
          return riga.left < cx - mezzaCorda - 2 || riga.right > cx + mezzaCorda + 2;
        });
        return {
          nome: nome.textContent,
          /* Tagliato senza dirlo: un nome impossibile finisce coi puntini. */
          tagliato:
            nome.scrollWidth > nome.clientWidth + 1 &&
            getComputedStyle(nome).textOverflow !== "ellipsis",
          sporge,
        };
      })
      .filter((voce) => voce.tagliato || voce.sporge),
  );
  await page.screenshot({ path: testInfo.outputPath("nomi-nei-cerchi.png") });
  expect(fuori).toEqual([]);
});
