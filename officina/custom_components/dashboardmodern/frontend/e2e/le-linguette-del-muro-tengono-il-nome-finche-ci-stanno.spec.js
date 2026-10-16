/* Le linguette del muro tengono il nome finche' ci stanno.
 *
 * «Sfrutta al massimo lo spazio che c'e' a sinistra. Da un 4 pollici a un 15
 * gli spazi aumentano di tanto: mantieni il nome scritto fin dove possibile,
 * poi diventano icone.» Cinque pagine: sul 15 pollici tutti i nomi, su uno
 * stretto il nome solo dell'aperta. */
import { expect, test } from "@playwright/test";
import { STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const MURO = {
  attiva: true,
  pagine: [
    { id: "p1", modello: "stanza", stanza: "Soggiorno" },
    { id: "p2", modello: "ambienti" },
    { id: "p3", modello: "telecamere" },
    { id: "p4", modello: "tapparelle" },
    { id: "p5", modello: "energia" },
  ],
};

const fila = (page) => page.locator("#dm-muro .mu-testa .mu-pagine");
const nomiVisti = (page) =>
  fila(page)
    .locator("button span")
    .evaluateAll((nodi) => nodi.filter((n) => n.offsetWidth > 0).length);

for (const [schermo, w, h, nomi] of [
  ["15 pollici", 1920, 1080, 5],
  ["10 pollici", 1280, 800, null],
  ["4 pollici", 800, 480, 1],
]) {
  test(`${schermo}: i nomi finche' ci stanno, poi i disegni`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: w, height: h });
    await apriLaCasaAMuro(page, testInfo, { muro: MURO, stati: STATI_A_MURO });
    await expect(fila(page)).toBeVisible();
    if (nomi !== null) await expect.poll(() => nomiVisti(page)).toBe(nomi);
    /* Mai tagliata: la testa non esce dal suo spazio. */
    expect(
      await fila(page).evaluate(
        (f) => f.parentElement.scrollWidth <= f.parentElement.clientWidth + 1,
      ),
    ).toBe(true);
    if (process.env.DM_FOTO)
      await page.screenshot({
        path: `${process.env.DM_FOTO}/linguette-${w}.png`,
        clip: { x: 0, y: 0, width: w, height: Math.min(h, 200) },
      });
  });
}
