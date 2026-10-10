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
    const entita = (k) => body.locator(`[data-mu-ed-campo="pagine.0.comandi.${k}.entita"]`);
    await expect(entita(0)).toHaveValue("light.soggiorno");
    await body.locator('[data-mu-ed-posto-giu="0.0"]').click();
    await expect(entita(0)).toHaveValue("light.tavolo");
    /* Il sesto posto si sceglie con la ricerca del config: la stessa lente,
     * la stessa finestra, e qualunque entita' — qui la serratura. */
    await body.locator('[data-mu-ed-posto="pagine.0.comandi.5"] [data-mu-ed-pick]').first().click();
    await expect(page.locator("#cd-entpick")).toBeVisible();
    await page.locator("#cd-ep-search").fill("lock.porta");
    await page.locator("#cd-entpick").getByText("lock.porta").first().click();
    await expect(entita(5)).toHaveValue("lock.porta");
    /* E il suo aspetto: il nome sul tablet, la riga sotto, il disegno. */
    await body.locator('[data-mu-ed-campo="pagine.0.comandi.5.nome"]').fill("Portone");
    await body.locator('[data-mu-ed-campo="pagine.0.comandi.5.sotto"]').fill("Tocca per aprire");
    await body.locator('[data-mu-ed-campo="pagine.0.comandi.5.disegno"]').selectOption("varchi");
    /* Un posto si svuota e resta libero al suo posto. */
    await body.locator('[data-mu-ed-svuota="pagine.0.comandi.4"]').click();
    await body.locator('[data-mu-ed-campo="pagine.0.titolo"]').fill("Salone");
    await body.locator("[data-dm-save-all]").click();
    const muro = await salvato(page);
    expect(muro.pagine[0].scelti).toBe(true);
    expect(muro.pagine[0].titolo).toBe("Salone");
    expect(muro.pagine[0].comandi.map((c) => c.entita || c.azione || c.tipo)).toEqual([
      "light.tavolo",
      "light.soggiorno",
      "climate.soggiorno",
      "cover.soggiorno",
      "vuoto",
      "lock.porta",
    ]);
    expect(muro.pagine[0].comandi[5]).toMatchObject({
      tipo: "entita",
      nome: "Portone",
      sotto: "Tocca per aprire",
      disegno: "varchi",
    });
  });

  test("le pagine nuove: personalizzata, tutte le luci, clima freddo e caldo", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: { attiva: true, pagine: [] } });
    await apriLaScheda(page);
    const body = page.locator("#ed-body");
    for (const modello of ["personale", "luci", "freddo", "caldo"])
      await body.locator(`[data-mu-ed-nuova="${modello}"]`).click();
    await expect(body.locator('[data-mu-ed-pagina="1"]')).toContainText(/luci/i);
    await body.locator("[data-dm-save-all]").click();
    const muro = await salvato(page);
    expect(muro.pagine.map((p) => p.modello)).toEqual(["personale", "luci", "freddo", "caldo"]);
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
