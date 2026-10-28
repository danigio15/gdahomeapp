/* «Sulla pagina home della plancia a muro mi compare il riquadro telecamera
 * anche se non ne ho da impostare: non si puo' mettere altro al suo posto?»
 * (#337)
 *
 * Senza telecamera e senza tasti per aprire il citofono non c'e', e l'antifurto
 * prende tutta la larghezza; con la telecamera c'e', e nel config si toglie.
 */
import { expect, test } from "@playwright/test";
import { SEME_A_MURO, STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const muro = (page) => page.locator("#dm-muro");

const STATI = {
  ...STATI_A_MURO,
  "alarm_control_panel.casa": {
    state: "disarmed",
    attributes: { friendly_name: "Antifurto", supported_features: 1 + 2 + 4 },
  },
  "binary_sensor.finestra_cucina": {
    state: "on",
    attributes: { friendly_name: "Finestra cucina", device_class: "window" },
  },
};

const SEME = {
  ...SEME_A_MURO,
  sections: {
    ...SEME_A_MURO.sections,
    entityOverrides: { "dm.security_centrale_allarme": "alarm_control_panel.casa" },
  },
};

const apri = (page, testInfo, ingresso) =>
  apriLaCasaAMuro(page, testInfo, {
    muro: {
      attiva: true,
      pagine: [
        {
          id: "ing",
          modello: "ingresso",
          ingresso: { centrale: "alarm_control_panel.casa", ...ingresso },
        },
      ],
    },
    stati: STATI,
    seme: SEME,
    caselle: {
      cd_entity_overrides: { "dm.security_centrale_allarme": "alarm_control_panel.casa" },
    },
  });

test.describe("il citofono a muro solo dove serve", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("senza telecamera e senza tasti il citofono non c'e'", async ({ page }, testInfo) => {
    await apri(page, testInfo, { letture: ["binary_sensor.finestra_cucina"] });
    await expect(muro(page).locator(".mu-ingresso")).toBeVisible();
    await expect(muro(page).locator(".mu-citofono")).toHaveCount(0);
    await expect(muro(page).locator(".mu-ingresso")).toHaveClass(/mu-senza-citofono/);
    await expect(muro(page)).not.toContainText("Nessuna telecamera");
    await page.waitForTimeout(500);
    await page.screenshot({ path: testInfo.outputPath("ingresso-senza-citofono.png") });
  });

  test("con la telecamera c'e', e dal config si toglie", async ({ page }, testInfo) => {
    await apri(page, testInfo, { telecamera: "camera.cancello" });
    await expect(muro(page).locator(".mu-citofono")).toHaveCount(1);
    await page.waitForTimeout(500);
    await page.screenshot({ path: testInfo.outputPath("ingresso-con-citofono.png") });
  });

  test("tolto nel config, non c'e' nemmeno con la telecamera", async ({ page }, testInfo) => {
    await apri(page, testInfo, { telecamera: "camera.cancello", citofono: false });
    await expect(muro(page).locator(".mu-ingresso")).toBeVisible();
    await expect(muro(page).locator(".mu-citofono")).toHaveCount(0);
  });
});
