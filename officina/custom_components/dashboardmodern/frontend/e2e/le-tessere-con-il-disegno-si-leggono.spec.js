/* Le tessere della Home con un disegno di sfondo si leggono (#287).
 *
 * Dal campo: «è possibile che le scritte dei dati che riporta siano più
 * leggibili: c'è poco contrasto, e sui dispositivi sono troppo piccole». Con
 * un disegno dietro, il nome della tessera e il numero restavano nei colori
 * della tessera chiara — marrone, grigio — sopra un fondo scuro e pieno di
 * forme. Qui si guarda quello che si vede: il colore del nome e del numero.
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

test("le scritte di una tessera col disegno sono chiare, sopra un velo scuro", async ({
  page,
}, testInfo) => {
  await apriLaCasaAMuro(page, testInfo, {
    muro: null,
    seme: structuredClone(SEME_A_MURO),
    stati: STATI_A_MURO,
    caselle: {
      cd_immagini_riquadri: {
        "home:luci": disegno("lampadina"),
        "home:clima": disegno("condizionatore"),
        "home:tapparelle": disegno("tapparella"),
        "home:telecamere": disegno("telecamera"),
      },
    },
  });
  await page.locator('.tab[data-tab="home"]').evaluate((n) => n.click());
  const tessere = page.locator("#page-home .dm-tile.dm-rq-fondo");
  await expect(tessere).toHaveCount(4, { timeout: 20_000 });
  if (process.env.DM_RENDER_DIR)
    await page.locator("#page-home").screenshot({
      path: `${process.env.DM_RENDER_DIR}/tessere-col-disegno-${testInfo.project.name}.png`,
    });
  const scritte = await tessere.evaluateAll((carte) =>
    carte
      .flatMap((card) => [...card.querySelectorAll("*")])
      .filter((n) => {
        if (!n.childNodes.length) return false;
        const testo = [...n.childNodes]
          .filter((c) => c.nodeType === 3)
          .map((c) => c.textContent.trim())
          .join("");
        const r = n.getBoundingClientRect();
        return testo && r.width > 0 && r.height > 0 && getComputedStyle(n).visibility !== "hidden";
      })
      .map((n) => ({
        testo: n.textContent.trim().slice(0, 30),
        colore: getComputedStyle(n).color,
        opacita: Number(getComputedStyle(n).opacity),
        corpo: Number.parseFloat(getComputedStyle(n).fontSize),
      })),
  );
  expect(scritte.length).toBeGreaterThan(0);
  for (const s of scritte) {
    expect(luminosita(s.colore), `«${s.testo}» in ${s.colore}`).toBeGreaterThan(0.6);
    expect(s.opacita, `«${s.testo}»`).toBeGreaterThan(0.85);
  }
});
