/* La scheda «A muro» del config.
 *
 * Con Premium si scrive: si aggiunge una pagina, si sceglie il modello, si
 * salva, e chiudendo il config il pannello c'e'. Con Base la scheda si vede
 * chiusa, e non si salva niente. */
import { expect, test } from "@playwright/test";
import { MURO_DI_PROVA, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

async function apriLaScheda(page) {
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="muro"]').click();
  await expect(page.locator("#ed-body .mu-ed")).toBeVisible();
}

const salvato = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("cd_muro") || "null"));

test.describe("la scheda a muro", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("con Premium si aggiunge una pagina, si salva, e il pannello c'e'", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: null });
    await apriLaScheda(page);
    const body = page.locator("#ed-body");
    await expect(body.locator(".mu-ed-lucchetto")).toHaveCount(0);
    await expect(body.locator(".ed-section-title, h2").first()).toContainText(/muro/i);
    await body.locator('[data-mu-ed-alterna="attiva"]').click();
    await body.locator('[data-mu-ed-nuova="stanza"]').click();
    await expect(body.locator('[data-mu-ed-pagina="0"]')).toBeVisible();
    await expect(body.locator('[data-mu-ed-campo="pagine.0.stanza"]')).toHaveValue("Soggiorno");
    await body.locator('[data-mu-ed-nuova="scene"]').click();
    await body.locator('[data-mu-ed-metti="tema"][data-mu-ed-valore="scuro"]').click();
    await body.locator("[data-dm-save-all]").click();
    const muro = await salvato(page);
    expect(muro.attiva).toBe(true);
    expect(muro.tema).toBe("scuro");
    expect(muro.pagine.map((p) => p.modello)).toEqual(["stanza", "scene"]);
    expect(muro.pagine[1].scene.map((s) => s.azione)).toEqual([
      "Buongiorno",
      "Esco",
      "Rientro",
      "Cena",
      "Cinema",
      "Buonanotte",
    ]);
    /* Mentre il config e' aperto il pannello non lo copre; chiuso, c'e'. */
    await expect(page.locator("#dm-muro")).toHaveCount(0);
    await page.evaluate(() => document.getElementById("editor-modal")?.remove());
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("dashboardmodern:muro")));
    await expect(page.locator("#dm-muro")).toBeVisible();
    await expect(page.locator("#dm-muro")).toHaveAttribute("data-tema", "dark");
  });

  test("i comandi della stanza si scelgono a mano e si riordinano", async ({ page }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      muro: { attiva: true, pagine: [{ id: "p1", modello: "stanza", stanza: "Soggiorno" }] },
    });
    await apriLaScheda(page);
    const body = page.locator("#ed-body");
    await body.locator('[data-mu-ed-alterna="pagine.0.segue"]').click();
    await expect(body.locator('[data-mu-ed-campo="pagine.0.comandi.0"]')).toHaveValue(
      "luce|light.soggiorno",
    );
    await body.locator('[data-mu-ed-posto-giu="0.0"]').click();
    await expect(body.locator('[data-mu-ed-campo="pagine.0.comandi.0"]')).toHaveValue(
      "luce|light.tavolo",
    );
    await body.locator('[data-mu-ed-campo="pagine.0.comandi.5"]').selectOption("luce|light.cucina");
    await body.locator("[data-dm-save-all]").click();
    const muro = await salvato(page);
    expect(muro.pagine[0].scelti).toBe(true);
    expect(muro.pagine[0].comandi.map((c) => c.entita || c.azione)).toEqual([
      "light.tavolo",
      "light.soggiorno",
      "climate.soggiorno",
      "cover.soggiorno",
      "Buongiorno",
      "light.cucina",
    ]);
  });

  test("con Base la scheda e' chiusa e non salva", async ({ page }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { premium: false, muro: MURO_DI_PROVA });
    await apriLaScheda(page);
    await expect(page.locator("#ed-body .mu-ed-lucchetto")).toContainText(/Premium/);
    await page.locator('#ed-body [data-mu-ed-alterna="attiva"]').click({ force: true });
    expect((await salvato(page)).attiva).toBe(true);
    await expect(page.locator("#dm-muro")).toHaveCount(0);
  });
});
