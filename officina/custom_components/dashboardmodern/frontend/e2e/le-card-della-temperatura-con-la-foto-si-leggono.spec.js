/* Le card della Temperatura con la foto della stanza si leggono (#294).
 *
 * Dal campo: «i dati che mostra sono troppo scuri e non si capiscono e
 * rimangono illeggibili». Con la foto della stanza dietro, il nome e i gradi
 * restavano nei colori della card chiara — quasi neri — sopra la foto
 * velata di scuro: il foglio della Temperatura vinceva su quello delle foto.
 * Qui si guarda il colore di quello che si legge, in chiaro e in scuro.
 */
import { expect, test } from "@playwright/test";
import { SEME_A_MURO, STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const disegno = (chiave) => ({ src: `disegno:${chiave}` });

/* La luminosita' relativa di un colore `rgb(a)`, da 0 (nero) a 1 (bianco). */
function luminosita(colore) {
  const [r, g, b] = (colore.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const lin = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

for (const tema of ["light", "dark"])
  test(`le card della Temperatura con la foto si leggono (${tema})`, async ({ page }, testInfo) => {
    const seme = structuredClone(SEME_A_MURO);
    /* La foto di una stanza sta nella stanza: e' la stessa sulla tessera
     * delle Stanze e sulla card della Temperatura. */
    seme.sections.rooms[0].immagine = disegno("soggiorno");
    await apriLaCasaAMuro(page, testInfo, { muro: null, seme, stati: STATI_A_MURO });
    await page.evaluate((tema) => document.documentElement.setAttribute("data-theme", tema), tema);
    await page
      .locator('.tab[data-tab="temp"]')
      .first()
      .evaluate((n) => n.click());
    const carte = page.locator("#temp-grid .temp-card.dm-rq-fondo");
    await expect(carte.first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(400);
    if (process.env.DM_FOTO)
      await page.locator("#temp-grid").screenshot({
        path: `${process.env.DM_FOTO}/temperatura-foto-${tema}-${testInfo.project.name}.png`,
      });
    const scritte = await carte.evaluateAll((card) =>
      card
        .flatMap((c) => [...c.querySelectorAll(".cp-name,.cp-temp-current,.cp-temp-target .val")])
        .filter((n) => n.textContent.trim() && n.getBoundingClientRect().width > 0)
        .map((n) => ({
          testo: n.textContent.trim().slice(0, 30),
          colore: getComputedStyle(n).color,
        })),
    );
    expect(scritte.length).toBeGreaterThan(0);
    for (const s of scritte)
      expect(luminosita(s.colore), `«${s.testo}» in ${s.colore}`).toBeGreaterThan(0.6);
  });
