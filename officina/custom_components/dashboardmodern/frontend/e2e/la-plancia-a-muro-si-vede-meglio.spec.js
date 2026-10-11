/* La plancia a muro: sezioni da vedere, griglie da scegliere, e un config che
 * mostra quello che fa.
 *
 * «Per la plancia wall riusciamo a fare meglio? Come configuratore e come
 * sezioni da gestire e vedere; i dati devono essere in real time e piu'
 * personalizzabili.» Qui: le pagine Ambienti, Telecamere, Energia e
 * Tapparelle sul tablet, la griglia da quattro, l'energia che cambia mentre
 * la si guarda; nel config l'anteprima dal vivo, la bozza che non si perde
 * cambiando scheda, la pagina duplicata e il colore. */
import { expect, test } from "@playwright/test";
import { STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const muro = (page) => page.locator("#dm-muro");
const salvato = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("cd_muro") || "null"));

const STATI = {
  ...STATI_A_MURO,
  "sensor.casa_w": { state: "850", attributes: { unit_of_measurement: "W" } },
  "sensor.fv_w": { state: "3.2", attributes: { unit_of_measurement: "kW" } },
  "sensor.rete_w": { state: "-1200", attributes: { unit_of_measurement: "W" } },
  "sensor.batteria": { state: "80", attributes: { unit_of_measurement: "%" } },
};

/* I campi entita' diventano la riga «Scegli entità»: la casella vera resta
 * sotto, nascosta, ed e' quella che la ricerca riempie e fa «change». */
async function scriviLEntita(body, via, valore) {
  await body.locator(`[data-mu-ed-campo="${via}"]`).evaluate((campo, v) => {
    campo.value = v;
    campo.dispatchEvent(new Event("change", { bubbles: true }));
  }, valore);
}

const MURO = {
  attiva: true,
  pagine: [
    { id: "p1", modello: "stanza", stanza: "Soggiorno", griglia: 4, colore: "#ec4899" },
    { id: "p2", modello: "ambienti" },
    { id: "p3", modello: "energia", energia: {
      casa: "sensor.casa_w",
      solare: "sensor.fv_w",
      rete: "sensor.rete_w",
      batteria: "sensor.batteria",
    } },
    { id: "p4", modello: "telecamere" },
    { id: "p5", modello: "tapparelle" },
  ],
};

test.describe("la plancia a muro si vede meglio", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("le pagine da guardare, la griglia scelta e l'energia dal vivo", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO, stati: STATI });
    await expect(muro(page)).toBeVisible();
    /* Cinque pagine: le linguette tengono il disegno, il nome solo l'aperta. */
    await expect(muro(page).locator(".mu-pagine.mu-molte")).toBeVisible();
    /* La stanza in quattro posti grandi, due per due, col suo colore. */
    const g = muro(page).locator(".mu-g6");
    await expect(g).toHaveAttribute("style", /--mu-col:2;--mu-righe:2/);
    await expect(g.locator(".mu-card")).toHaveCount(4);
    await expect(muro(page).locator(".mu-testa")).toHaveAttribute("style", /#ec4899/);

    await muro(page).locator('[data-mu-pagina="1"]').click();
    const soggiorno = muro(page).locator(".mu-ambiente").filter({ hasText: "Soggiorno" });
    await expect(soggiorno).toContainText("21,2°");
    await expect(soggiorno).toContainText(/1 luce accesa/i);
    await expect(soggiorno).toContainText(/54%/);

    await muro(page).locator('[data-mu-pagina="2"]').click();
    const misura = (k) => muro(page).locator(`[data-mu-misura="${k}"]`);
    await expect(misura("casa")).toContainText("850 W");
    await expect(misura("solare")).toContainText("3,2 kW");
    await expect(misura("rete")).toContainText(/Cede alla rete/i);
    await expect(misura("rete")).toContainText("1,2 kW");
    await expect(misura("batteria")).toContainText("80%");
    /* Il consumo della casa non e' nella configurazione di nessuna sezione:
     * passa lo stesso dal cancello, perche' il tablet lo sta mostrando. */
    await page.evaluate(() =>
      window.DashboardModernEnergyService.broker.ingestState({
        entity_id: "sensor.casa_w",
        state: "1500",
        attributes: { unit_of_measurement: "W" },
      }),
    );
    await expect(misura("casa")).toContainText("1,5 kW", { timeout: 1500 });

    await muro(page).locator('[data-mu-pagina="3"]').click();
    await muro(page).locator(".mu-cam").first().click();
    await expect(muro(page).locator(".mu-finestra .mu-video-fin")).toBeVisible();
    await muro(page).locator('.mu-finestra [data-mu-fa="chiudi"]').click();

    await muro(page).locator('[data-mu-pagina="4"]').click();
    await muro(page).locator('[data-mu-fa="giu"][data-mu-entita="cover.soggiorno"]').click();
    await expect
      .poll(() => page.evaluate(() => window.__SERVIZI__.map((s) => `${s.domain}.${s.service}`)))
      .toEqual(["cover.close_cover"]);
  });

  test("il config: anteprima dal vivo, griglia, bozza che resta, pagina duplicata", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      muro: { attiva: true, pagine: [{ id: "p1", modello: "stanza", stanza: "Soggiorno" }] },
      stati: STATI,
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => window.apriConfigEntita());
    await page.locator('.ed-tab[data-tab="muro"]').click();
    const body = page.locator("#ed-body");

    /* L'anteprima e' la pagina del tablet, coi suoi sei posti. */
    const anteprima = body.locator(".mu-ed-anteprima .mu-anteprima");
    await expect(anteprima.locator(".mu-g6 .mu-card")).toHaveCount(6);
    await expect(anteprima.locator(".mu-tit")).toHaveText(/Soggiorno/i);

    /* Quattro posti: l'anteprima e i posti del config cambiano insieme. */
    await body.locator('[data-mu-ed-metti="pagine.0.griglia"][data-mu-ed-valore="4"]').click();
    await expect(anteprima.locator(".mu-g6 .mu-card")).toHaveCount(4);
    await expect(body.locator(".mu-ed-posti .mu-ed-posto")).toHaveCount(4);
    await expect(body.locator(".mu-ed-sporca")).toBeVisible();

    /* Il nome scritto cambia l'anteprima senza ridisegnare il campo. */
    await body.locator('[data-mu-ed-campo="pagine.0.titolo"]').fill("Salone");
    await expect(anteprima.locator(".mu-tit")).toHaveText(/Salone/i);

    /* Un'altra scheda e ritorno: la bozza c'e' ancora. */
    const altra = page.locator('.ed-tab:not([data-tab="muro"])').first();
    await altra.click();
    await page.locator('.ed-tab[data-tab="muro"]').click();
    await expect(body.locator(".mu-ed-sporca")).toBeVisible();
    await expect(
      body.locator('[data-mu-ed-metti="pagine.0.griglia"][data-mu-ed-valore="4"]'),
    ).toHaveClass(/si/);

    /* Duplicare e colorare. */
    await body.locator('[data-mu-ed-copia="0"]').click();
    await expect(body.locator('[data-mu-ed-pagina="1"]')).toBeVisible();
    await body.locator('[data-mu-ed-metti="pagine.1.colore"][data-mu-ed-valore="#10b981"]').click();
    await expect(anteprima.locator(".mu-testa")).toHaveAttribute("style", /#10b981/);

    await body.locator("[data-dm-save-all]").click();
    await expect(body.locator(".mu-ed-sporca")).toHaveCount(0);
    const m = await salvato(page);
    expect(m.pagine.map((p) => [p.modello, p.griglia, p.titolo, p.colore])).toEqual([
      ["stanza", 4, "Salone", ""],
      ["stanza", 4, "Salone 2", "#10b981"],
    ]);
    expect(m.pagine[0].id).not.toBe(m.pagine[1].id);
  });

  test("il config dell'energia propone le misure della plancia, e si sceglie il meteo", async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: { attiva: true, pagine: [] }, stati: STATI });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => window.apriConfigEntita());
    await page.locator('.ed-tab[data-tab="muro"]').click();
    const body = page.locator("#ed-body");
    for (const modello of ["energia", "ambienti", "telecamere", "tapparelle"])
      await body.locator(`[data-mu-ed-nuova="${modello}"]`).click();
    await body.locator('[data-mu-ed-apri="0"]').click();
    await scriviLEntita(body, "pagine.0.energia.casa", "sensor.casa_w");
    await expect(body.locator(".mu-anteprima [data-mu-misura='casa']")).toContainText("850 W");
    await body.locator("[data-mu-ed-altro]").click();
    await scriviLEntita(body, "meteo", "weather.casa");
    await body.locator('[data-mu-ed-alterna="riposo.torna"]').click();
    await body.locator("[data-dm-save-all]").click();
    const m = await salvato(page);
    expect(m.pagine.map((p) => p.modello)).toEqual([
      "energia",
      "ambienti",
      "telecamere",
      "tapparelle",
    ]);
    expect(m.pagine[0].energia.casa).toBe("sensor.casa_w");
    expect(m.meteo).toBe("weather.casa");
    expect(m.riposo.torna).toBe(false);
  });
});
