/* La plancia a muro sui due Sonoff NSPanel Pro.
 *
 * «Sul 4 pollici il titolo resta "SOGGIOR…", e sul 120 sotto ai riquadri
 * resta un buco vuoto.» Due pannelli piccoli, due misure da tenere:
 *
 * - NSPanel Pro 86: 480x480. Il nome della stanza resta intero e l'ora non
 *   esce dalla testa: le linguette cedono prima, fino ai disegni stretti.
 * - NSPanel Pro 120: 750x1334, cioe' 375x667 punti. I riquadri crescono fino
 *   a riempire la pagina; su un telefono piu' alto crescono al massimo di due
 *   quinti, che e' il patto con «sul telefono li trovo troppo grandi». */
import { expect, test } from "@playwright/test";
import { MURO_DI_PROVA, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const muro = (page) => page.locator("#dm-muro");

/* Le misure si prendono coi caratteri arrivati: e' la condizione vera. */
async function pronta(page) {
  await page.evaluate(() => document.fonts.ready);
  await expect(muro(page).locator(".mu-tit")).toBeVisible();
  await page.waitForTimeout(300);
}

/* La pagina nasce gia' alla misura del pannello: e' cosi' sul NSPanel, e un
 * ridimensionamento dopo l'avvio rifarebbe le misure e nasconderebbe il
 * difetto (la testa misurata prima che arrivi Oswald). */
test.describe("NSPanel Pro 86", () => {
  /* Come il pannello vero: 480x480, densita' 1, schermo a tocco. */
  test.use({
    viewport: { width: 480, height: 480 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });

  test("il nome della stanza resta intero e l'ora dentro la testa", async ({ page }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await pronta(page);
    const misure = await page.evaluate(() => {
      const m = document.querySelector("#dm-muro");
      const tit = m.querySelector(".mu-tit");
      const testa = m.querySelector(".mu-testa").getBoundingClientRect();
      const testo = (nodo) => {
        const r = document.createRange();
        r.selectNodeContents(nodo);
        return r.getBoundingClientRect();
      };
      return {
        titolo: testo(tit).width,
        posto: tit.getBoundingClientRect().width,
        ora: testo(m.querySelector(".mu-ora")).right,
        bordo: testa.right,
      };
    });
    /* Il testo intero sta nel suo posto: niente puntini. Al decimo di pixel:
     * prima mancavano 0,14 pixel (116,70 di testo in 116,56 di posto), e
     * tanto basta al browser per mettere i puntini. */
    expect(misure.titolo).toBeLessThanOrEqual(misure.posto + 0.01);
    /* L'ora finisce dentro la carta della testa. */
    expect(misure.ora).toBeLessThanOrEqual(misure.bordo);
  });
});

test.describe("NSPanel Pro 120", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("i riquadri riempiono la pagina", async ({ page }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await pronta(page);
    const vuoto = await page.evaluate(() => {
      const g = document.querySelector("#dm-muro .mu-g6");
      const carte = [...g.querySelectorAll(".mu-card")];
      const fondo = Math.max(...carte.map((c) => c.getBoundingClientRect().bottom));
      return g.getBoundingClientRect().bottom - fondo;
    });
    expect(vuoto).toBeLessThan(4);
  });
});

test.describe("un telefono alto", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("i riquadri crescono al massimo di due quinti", async ({ page }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await pronta(page);
    const alto = await page.evaluate(() =>
      Number.parseFloat(
        getComputedStyle(document.querySelector("#dm-muro .mu-g6 .mu-card")).height,
      ),
    );
    expect(alto).toBeGreaterThanOrEqual(149);
    expect(alto).toBeLessThanOrEqual(210.5);
  });
});
