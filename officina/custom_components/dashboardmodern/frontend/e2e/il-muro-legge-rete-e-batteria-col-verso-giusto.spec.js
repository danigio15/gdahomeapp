/* Il muro legge la rete e la batteria col verso giusto.
 *
 * Dal campo, con un FoxESS: la pagina Energia diceva «Preleva dalla rete»
 * mentre la casa cedeva. L'inverter pubblica la rete in due sensori, sempre
 * positivi, e la batteria col segno al contrario. Qui la rete in due sensori
 * e la batteria girata col suo interruttore, e nel config il modo e il verso. */
import { expect, test } from "@playwright/test";
import { STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const muro = (page) => page.locator("#dm-muro");
const misura = (page, k) => muro(page).locator(`[data-mu-misura="${k}"]`);

const STATI = {
  ...STATI_A_MURO,
  "sensor.casa_w": { state: "1800", attributes: { unit_of_measurement: "W" } },
  "sensor.fv_w": { state: "3.4", attributes: { unit_of_measurement: "kW" } },
  "sensor.fox_prelievo": { state: "0", attributes: { unit_of_measurement: "W" } },
  "sensor.fox_immissione": { state: "900", attributes: { unit_of_measurement: "W" } },
  "sensor.fox_soc": { state: "78", attributes: { unit_of_measurement: "%" } },
  /* Positivo quando carica: il contrario di quello che il muro si aspetta. */
  "sensor.fox_batteria": { state: "700", attributes: { unit_of_measurement: "W" } },
};

const MURO = {
  attiva: true,
  pagine: [
    {
      id: "p1",
      modello: "energia",
      energia: {
        casa: "sensor.casa_w",
        solare: "sensor.fv_w",
        prelievo: "sensor.fox_prelievo",
        immissione: "sensor.fox_immissione",
        batteria: "sensor.fox_soc",
        potenzaBatteria: "sensor.fox_batteria",
        invertiBatteria: true,
      },
    },
  ],
};

test("rete in due sensori e batteria girata: cede e carica, non preleva", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await apriLaCasaAMuro(page, testInfo, { muro: MURO, stati: STATI });
  await expect(muro(page)).toBeVisible();
  await expect(misura(page, "rete")).toContainText(/Cede alla rete/i);
  await expect(misura(page, "rete")).toContainText("900 W");
  await expect(misura(page, "batteria")).toContainText("78%");
  await expect(misura(page, "batteria")).toContainText(/In carica · 700 W/i);
  if (process.env.DM_FOTO)
    await page.screenshot({ path: `${process.env.DM_FOTO}/muro-energia-giorno.png` });

  /* La sera: preleva 100 W, la batteria si scarica 1,1 kW. */
  await page.evaluate(() => {
    const b = window.DashboardModernEnergyService.broker;
    b.ingestState({
      entity_id: "sensor.fox_immissione",
      state: "0",
      attributes: { unit_of_measurement: "W" },
    });
    b.ingestState({
      entity_id: "sensor.fox_prelievo",
      state: "100",
      attributes: { unit_of_measurement: "W" },
    });
    b.ingestState({
      entity_id: "sensor.fox_batteria",
      state: "-1100",
      attributes: { unit_of_measurement: "W" },
    });
    b.ingestState({
      entity_id: "sensor.fv_w",
      state: "0",
      attributes: { unit_of_measurement: "kW" },
    });
  });
  await expect(misura(page, "rete")).toContainText(/Preleva dalla rete/i, { timeout: 1500 });
  await expect(misura(page, "batteria")).toContainText(/In scarica · 1,1 kW/i);
  if (process.env.DM_FOTO)
    await page.screenshot({ path: `${process.env.DM_FOTO}/muro-energia-sera.png` });

  /* Nel config: «Due sensori» acceso, l'interruttore della batteria girato. */
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="muro"]').click();
  const body = page.locator("#ed-body");
  await expect(body.locator('[data-mu-ed-campo="pagine.0.energia.prelievo"]')).toHaveCount(1);
  await expect(body.locator('[data-mu-ed-campo="pagine.0.energia.rete"]')).toHaveCount(0);
  await expect(
    body.locator('[data-mu-ed-alterna="pagine.0.energia.invertiBatteria"]'),
  ).toHaveAttribute("aria-checked", "true");
  if (process.env.DM_FOTO) {
    await body.getByText("Rete: come la misuri").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.DM_FOTO}/muro-energia-config-rete.png` });
  }
  /* Tornando a un sensore col segno, i due si svuotano. */
  await body.locator('[data-mu-ed-modo-energia="rete"][data-mu-ed-valore="false"]').click();
  await expect(body.locator('[data-mu-ed-campo="pagine.0.energia.rete"]')).toHaveCount(1);
  await expect(body.locator('[data-mu-ed-campo="pagine.0.energia.prelievo"]')).toHaveCount(0);
});
