import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

/* La pappa degli animali.
 *
 * Dal campo: «sulla sezione animali possiamo inserire, come hai fatto con la
 * pulizia, il cibo, cosi' confermo che e' stato dato da mangiare e mi avvisa
 * quando sara' da rifare?». La scheda ha la fascia della pappa: da quanto ha
 * mangiato, fra quanto tocca, il tasto «Ha mangiato» e per qualche secondo
 * «Annulla».
 */
const ORA = 60 * 60_000;
const ANIMALI = [
  {
    id: "a1",
    nome: "Micio",
    specie: "gatto",
    cibo_livello: "sensor.food",
    cibo_eroga: "button.feed",
    lettiera_sabbia: "sensor.litter",
    lettiera_pulisci: "button.clean",
    lettiera_cestino: "binary_sensor.waste_bin",
    pappa_ogni: "12",
    pappa: new Date(Date.now() - 13 * ORA).toISOString(),
  },
  {
    id: "a2",
    nome: "Fido",
    specie: "cane",
    pappa_ogni: "8",
    pappa: new Date(Date.now() - 3 * ORA).toISOString(),
  },
];

const STATI = [
  { entity_id: "sensor.food", state: "64", attributes: { unit_of_measurement: "%" } },
  { entity_id: "sensor.litter", state: "12", attributes: { unit_of_measurement: "%" } },
  { entity_id: "binary_sensor.waste_bin", state: "off", attributes: {} },
  { entity_id: "button.feed", state: "2026-09-07T08:00:00+00:00", attributes: {} },
  { entity_id: "button.clean", state: "2026-09-07T07:00:00+00:00", attributes: {} },
];

const seed = {
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

async function apriGliAnimali(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.evaluate((dato) => localStorage.setItem("cd_animali", JSON.stringify(dato)), ANIMALI);
  await page.evaluate(
    (haStati) =>
      haStati.forEach((voce) => {
        _RAW_STATES[voce.entity_id] = structuredClone(voce);
        STATES[voce.entity_id] = structuredClone(voce);
      }),
    STATI,
  );
  await page.evaluate(() => {
    window.__CHIAMATE__ = [];
    window.dmCallHaService = (dominio, servizio, dati) => {
      window.__CHIAMATE__.push([dominio, servizio, dati]);
      return Promise.resolve();
    };
  });
  await clickBottomTab(page, "animali", testInfo);
  await page.waitForSelector("#page-animali .dm-animale-card");
}

test("la fascia della pappa: l'ora passata si vede, e «Ha mangiato» la segna", async ({
  page,
}, testInfo) => {
  await apriGliAnimali(page, testInfo);
  const micio = page.locator('#page-animali [data-dm-animale="a1"]');
  const fido = page.locator('#page-animali [data-dm-animale="a2"]');
  await expect(micio.locator('[data-dm-animale-gruppo="pappa"]')).toHaveAttribute(
    "data-ora",
    "true",
  );
  await expect(micio.locator('[data-dm-animale-avviso="pappa_da_dare"]')).toHaveCount(1);
  await expect(fido.locator('[data-dm-animale-lettura="pappa"]')).toContainText("3 ore fa");
  await expect(fido.locator('[data-dm-animale-lettura="pappa"]')).toContainText("fra 5 ore");
  if (process.env.DM_RENDER_DIR)
    await page.screenshot({
      path: `${process.env.DM_RENDER_DIR}/pappa-${testInfo.project.name}.png`,
      fullPage: true,
    });

  await micio.locator("[data-dm-animale-pappa]").click();
  await expect(
    page.locator('#page-animali [data-dm-animale="a1"] [data-dm-animale-gruppo="pappa"]'),
  ).toHaveAttribute("data-ora", "false");
  await expect(
    page.locator('#page-animali [data-dm-animale="a1"] [data-dm-animale-avviso="pappa_da_dare"]'),
  ).toHaveCount(0);
  await expect(page.locator("#page-animali [data-dm-animale-pappa-annulla]")).toHaveCount(1);
  const salvata = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_animali"))[0]);
  expect(Date.now() - Date.parse(salvata.pappa)).toBeLessThan(60_000);
  if (process.env.DM_RENDER_DIR)
    await page.screenshot({
      path: `${process.env.DM_RENDER_DIR}/pappa-segnata-${testInfo.project.name}.png`,
      fullPage: true,
    });

  await page.locator("#page-animali [data-dm-animale-pappa-annulla]").click();
  await expect(
    page.locator('#page-animali [data-dm-animale="a1"] [data-dm-animale-gruppo="pappa"]'),
  ).toHaveAttribute("data-ora", "true");
});
