import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

/* «Una sezione sola, Animali, dove ogni voce ha il suo tipo: cane, gatto,
 * altro animale, acquario, terrario — e ho tre terrari.» La sezione Acquario
 * non c'è più: la sua vasca arriva da sola negli Animali, e in cima alla
 * pagina le pastiglie dicono quali tipi ci sono.
 */
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
  visibility: { home: true, animali: true },
};

const gradi = { device_class: "temperature", unit_of_measurement: "°C" };
const STATI = [
  { entity_id: "sensor.micio_food", state: "64", attributes: { unit_of_measurement: "%" } },
  { entity_id: "sensor.pogona_caldo", state: "31.2", attributes: gradi },
  {
    entity_id: "sensor.pogona_umidita",
    state: "33",
    attributes: { device_class: "humidity", unit_of_measurement: "%" },
  },
  { entity_id: "switch.pogona_uvb", state: "on", attributes: {} },
  { entity_id: "sensor.gechi_caldo", state: "30.4", attributes: gradi },
  { entity_id: "sensor.acquario_temperatura", state: "25.6", attributes: gradi },
];

const ANIMALI = [
  { id: "micio", nome: "Micio", specie: "gatto", cibo_livello: "sensor.micio_food" },
  {
    id: "pogona",
    nome: "Pogona",
    specie: "terrario",
    righe: [
      { entity: "sensor.pogona_caldo", name: "Lato caldo", genere: "temperatura" },
      { entity: "sensor.pogona_umidita", name: "Umidità", genere: "umidita" },
      { entity: "switch.pogona_uvb", name: "UVB", genere: "uvb" },
    ],
  },
  {
    id: "gechi",
    nome: "Gechi",
    specie: "terrario",
    righe: [{ entity: "sensor.gechi_caldo", name: "Lato caldo", genere: "temperatura" }],
  },
];

const ACQUARIO = {
  vasca: "Vasca tropicale",
  litri: "240",
  righe: [{ entity: "sensor.acquario_temperatura", name: "Temperatura", genere: "temperatura" }],
};

async function apri(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(
    ({ stati, animali, acquario }) => {
      stati.forEach((voce) => {
        _RAW_STATES[voce.entity_id] = structuredClone(voce);
        STATES[voce.entity_id] = structuredClone(voce);
      });
      localStorage.setItem("cd_animali", JSON.stringify(animali));
      localStorage.setItem("cd_acquario", JSON.stringify(acquario));
      /* La configurazione «arriva», come da Home Assistant: è lì che il
       * travaso trova la vasca di prima. */
      window.dispatchEvent(new CustomEvent("dashboardmodern:persistence-restored"));
    },
    { stati: STATI, animali: ANIMALI, acquario: ACQUARIO },
  );
  await clickBottomTab(page, "animali", testInfo);
  await page.waitForSelector('#page-animali [data-dm-animale="acquario"]');
}

test("l'acquario di prima arriva negli Animali, una volta sola", async ({ page }, testInfo) => {
  await apri(page, testInfo);
  await expect(page.locator('.tab[data-tab="acquario"]')).toHaveCount(0);
  const vasca = page.locator('#page-animali [data-dm-animale="acquario"]');
  await expect(vasca).toContainText("Vasca tropicale");
  await expect(vasca).toContainText("240 L");
  /* Un secondo arrivo della configurazione non lo porta due volte. */
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("dashboardmodern:persistence-restored")),
  );
  const ids = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cd_animali")).map((voce) => voce.id),
  );
  expect(ids).toEqual(["micio", "pogona", "gechi", "acquario"]);
});

test("le pastiglie dei tipi filtrano la pagina", async ({ page }, testInfo) => {
  await apri(page, testInfo);
  const filtri = page.locator("#page-animali [data-dm-animali-filtro]");
  await expect(filtri).toHaveText(["Tutti4", "Gatti1", "Acquari1", "Terrari2"]);
  await page.locator('[data-dm-animali-filtro="terrario"]').click();
  await expect(page.locator("#page-animali [data-dm-animale]")).toHaveCount(2);
  await expect(page.locator('[data-dm-animali-filtro="terrario"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  /* Il terrario secco lo dice, con la forcella del terrario. */
  const pogona = page.locator('#page-animali [data-dm-animale="pogona"]');
  await expect(pogona).toContainText("Umidità troppo bassa");
  await expect(pogona).toHaveAttribute("data-gravita", "urgente");
  await page.locator('[data-dm-animali-filtro="tutti"]').click();
  await expect(page.locator("#page-animali [data-dm-animale]")).toHaveCount(4);
});
