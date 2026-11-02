/* Le stanze in Home hanno la foto della stanza (#348).
 *
 * Dal campo: «le stanze nella home non hanno l'immagine di sfondo». La foto
 * di una stanza si vedeva sulla tessera delle Stanze e sulla card della
 * Temperatura, ma la tessera della stessa stanza nel blocco della Home restava
 * senza: la Home non era fra le pagine guardate. Qui si mette la foto alla
 * stanza, si spunta la stanza in Home, e si guarda che la tessera porti la
 * foto e che quello che si legge resti chiaro sopra il velo scuro.
 */
import { expect, test } from "@playwright/test";
import { SEME_A_MURO, STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

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
  test(`la stanza in Home porta la foto della stanza (${tema})`, async ({ page }, testInfo) => {
    const seme = structuredClone(SEME_A_MURO);
    const stanza = seme.sections.rooms[0];
    stanza.immagine = { src: "disegno:soggiorno" };
    await apriLaCasaAMuro(page, testInfo, {
      muro: null,
      seme,
      stati: STATI_A_MURO,
      caselle: { cd_home_stanze: [stanza.id] },
    });
    await page.evaluate((tema) => document.documentElement.setAttribute("data-theme", tema), tema);
    const tessera = page.locator(
      `#page-home .dm-stanza-plancia[data-dm-stanza-plancia="${stanza.id}"]`,
    );
    await expect(tessera).toBeVisible({ timeout: 20_000 });
    await expect(tessera).toHaveClass(/dm-rq-fondo/, { timeout: 10_000 });
    await expect(tessera.locator(":scope > .dm-rq-img")).toHaveCount(1);
    await page.waitForTimeout(300);
    if (process.env.DM_FOTO)
      await tessera.screenshot({
        path: `${process.env.DM_FOTO}/stanza-home-foto-${tema}-${testInfo.project.name}.png`,
      });
    const scritte = await tessera.evaluate((card) =>
      [
        ...card.querySelectorAll(
          ".dm-stanza-plancia-nome,.dm-stanza-plancia-gradi,.dm-stanza-plancia-umido,.dm-stanza-plancia-didascalia",
        ),
      ]
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
