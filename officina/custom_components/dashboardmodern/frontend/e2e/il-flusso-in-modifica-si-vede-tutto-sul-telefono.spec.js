/* Sul telefono, in modifica, il flusso energetico si vede fino in fondo.
 *
 * Nel video delle novita', nella casa demo a 390×844: entrando in ✏️ sulla
 * pagina Energia la fila in fondo (Boiler, Climatizzazione, Wallbox) era
 * tagliata a meta' schermo, con una fascia vuota fino alle barre. Per mettere
 * il disegno sopra le barre si faceva scorrere la **finestra**; ma li' chi
 * scorre e' il `body` (alto quanto lo schermo, `overflow-y:auto`), e salendo
 * tutto intero tagliava quello che aveva sotto il suo bordo.
 *
 * Qui si guarda quello che il browser disegna davvero: al centro di ogni
 * cerchio in fondo c'e' il cerchio, non lo sfondo. */
import { expect, test } from "@playwright/test";
import { apri, nellaCasaDemo } from "./helpers/casa-demo.js";

test.use({ timezoneId: "Europe/Rome", locale: "it-IT" });
test.skip(({ isMobile }) => !isMobile, "sul telefono");

test("in modifica la fila in fondo del flusso si vede e si prende", async ({ page }) => {
  test.setTimeout(120_000);
  await nellaCasaDemo(page);
  await apri(page, "energy");
  await expect(page.locator("#page-energy .flow-stage").first()).toBeVisible();

  await page.locator("#page-energy [data-dm-disp-tasto]").first().tap();
  await expect(page.locator("html")).toHaveAttribute("data-dm-modifica", "energy");
  /* L'ingresso fa scorrere due volte: subito e quando la pagina si assesta. */
  await page.waitForTimeout(800);

  const fondo = () =>
    page.evaluate(() => {
      const barre = [
        ...document.querySelectorAll("[data-dm-disp-barra],body > [data-dm-disegno-testa]"),
      ]
        .map((b) => b.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0);
      const tetto = Math.min(innerHeight, ...barre.map((r) => r.top));
      const carichi = [
        ...document.querySelectorAll("#page-energy .flow-stage .node.n-load"),
      ].filter((n) => {
        const r = n.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      return carichi.map((n) => {
        const r = n.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height * 0.7;
        const visto = document.elementFromPoint(x, y);
        /* Il cerchio, o la sua maniglia (sta sopra, al centro): non lo sfondo
         * della pagina, che e' quello che si vedeva dove il body tagliava. */
        return {
          dentro: r.top >= 0 && r.bottom <= tetto,
          disegnato: Boolean(
            visto &&
            (n.contains(visto) ||
              visto.closest?.(".flow-stage") ||
              visto.closest?.(".dm-dis-maniglia")),
          ),
        };
      });
    });

  await expect.poll(async () => (await fondo()).length).toBeGreaterThanOrEqual(3);
  const carichi = await fondo();
  for (const c of carichi) {
    expect(c.dentro).toBe(true);
    expect(c.disegnato).toBe(true);
  }
});
