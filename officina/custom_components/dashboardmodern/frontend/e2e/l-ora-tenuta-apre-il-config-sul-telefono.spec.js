/* «Con questo formato se clicco su ora non si attiva il config.»
 *
 * Sul telefono in verticale il pannello a muro e' compatto: dell'orologio
 * restano solo le cifre. Tenendole premute due secondi il config si apriva
 * davvero — e il dito, alzandosi, lo richiudeva: a tutto schermo la ✕ del
 * config sta in alto a destra, proprio sotto l'ora, e il clic del rilascio
 * finiva li'. Sul tablet la ✕ e' lontana, e non succedeva.
 *
 * Qui il dito e' un dito: tocchi veri mandati al browser (non il mouse, che
 * non fa nascere il clic del rilascio allo stesso modo), una volta sulle
 * cifre e una volta poco sotto, dove un pollice si posa quando guarda l'ora.
 */
import { expect, test } from "@playwright/test";
import { apriLaCasaAMuro, MURO_DI_PROVA } from "./helpers/casa-a-muro.js";

test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });

const muro = (page) => page.locator("#dm-muro");

/* Un dito tenuto fermo per `ms` sul punto dato, poi alzato. */
async function tieniIlDito(page, punto, ms) {
  const cdp = await page.context().newCDPSession(page);
  const tocco = { ...punto, id: 1, radiusX: 8, radiusY: 8, force: 1 };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [tocco] });
  await page.waitForTimeout(ms);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

for (const [dove, sotto] of [
  ["sulle cifre", 0],
  ["poco sotto le cifre", 10],
]) {
  test(`sul telefono il dito tenuto ${dove} apre il config, e alzandosi non lo richiude`, async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(browserName !== "chromium", "i tocchi veri si mandano solo a Chromium");
    await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
    await expect(muro(page)).toBeVisible();
    await expect(muro(page)).toHaveAttribute("data-compatto", "1");
    await expect(muro(page)).toHaveAttribute("data-verso", "verticale");
    const cifre = await muro(page).locator(".mu-h").boundingBox();
    const punto = {
      x: cifre.x + cifre.width / 2,
      y: sotto ? cifre.y + cifre.height + sotto : cifre.y + cifre.height / 2,
    };
    await tieniIlDito(page, punto, 2400);
    await page.waitForTimeout(600);
    await expect(page.locator("#editor-modal")).toBeVisible();
    await expect(page.locator("#ed-body .mu-ed")).toBeVisible();
    await expect(muro(page)).toHaveCount(0);
    /* La ✕ c'e' e funziona: il clic del rilascio si e' fermato, quello vero
     * dopo no. */
    await page.locator("#editor-modal .ed-head-close").last().click();
    await expect(page.locator("#editor-modal")).toHaveCount(0);
    await expect(muro(page)).toBeVisible();
  });
}

test("sul telefono un tocco breve sull'ora non apre niente", async ({
  page,
  browserName,
}, testInfo) => {
  test.skip(browserName !== "chromium", "i tocchi veri si mandano solo a Chromium");
  await apriLaCasaAMuro(page, testInfo, { muro: MURO_DI_PROVA });
  const cifre = await muro(page).locator(".mu-h").boundingBox();
  await tieniIlDito(page, { x: cifre.x + cifre.width / 2, y: cifre.y + cifre.height / 2 }, 200);
  await page.waitForTimeout(2300);
  await expect(page.locator("#editor-modal")).toHaveCount(0);
  await expect(muro(page)).toBeVisible();
});
