/* La pagina Clima del muro si puo' aprire anche sul Termostato.
 *
 * Dal campo: «mettici anche termostato come scelta, manca». Il tablet ha tre
 * linguette — Freddo, Caldo e, quando in casa c'e' un termostato col caldo e
 * il freddo, Termostato — ma nel config «Si apre su» offriva solo le prime
 * due. Adesso le offre tutte e tre, e la pagina si apre dove si e' scelto. Le
 * pagine di prima, senza zona o con Freddo e Caldo, restano com'erano.
 */
import { expect, test } from "@playwright/test";
import { SEME_A_MURO, STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const muro = (page) => page.locator("#dm-muro");
const salvato = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("cd_muro") || "null"));

/* La casa del muro, con in piu' un termostato col caldo e il freddo. */
function casaColTermostato() {
  const seme = structuredClone(SEME_A_MURO);
  seme.sections.climate.push({
    id: "c2",
    name: "Termostato",
    entity: "climate.termostato",
    type: "termo",
    room_id: "soggiorno",
    room: "Soggiorno",
  });
  const stati = {
    ...STATI_A_MURO,
    "climate.termostato": {
      state: "heat_cool",
      attributes: {
        friendly_name: "Termostato",
        hvac_modes: ["off", "heat", "cool", "heat_cool"],
        hvac_action: "idle",
        current_temperature: 21.4,
        temperature: null,
        target_temp_low: 20,
        target_temp_high: 26,
        min_temp: 4,
        max_temp: 35,
        target_temp_step: 0.5,
      },
    },
  };
  return { seme, stati };
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

test("nel config «Si apre su» ha tre scelte, e Termostato si salva", async ({ page }, testInfo) => {
  const { seme, stati } = casaColTermostato();
  await apriLaCasaAMuro(page, testInfo, {
    seme,
    stati,
    muro: { attiva: true, pagine: [{ id: "p1", modello: "clima" }] },
  });
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="muro"]').click();
  const body = page.locator("#ed-body");
  await expect(body.locator(".mu-ed")).toBeVisible();
  const scelte = body.locator('[data-mu-ed-metti="pagine.0.zona"]');
  await expect(scelte).toHaveCount(3);
  expect(await scelte.evaluateAll((tasti) => tasti.map((t) => t.dataset.muEdValore))).toEqual([
    "freddo",
    "caldo",
    "termostato",
  ]);
  await expect(scelte.nth(2)).toHaveText(/Termostato/);
  /* Una pagina senza zona si apre su Freddo, come prima. */
  await expect(scelte.nth(0)).toHaveClass(/\bsi\b/);

  await scelte.nth(2).click();
  await expect(body.locator('[data-mu-ed-metti="pagine.0.zona"].si')).toHaveAttribute(
    "data-mu-ed-valore",
    "termostato",
  );
  /* Il termostato c'e': nessun avviso sotto la scelta. */
  await expect(body.getByText(/non c'è ancora un termostato/)).toHaveCount(0);
  await body.locator("[data-dm-save-all]").click();
  expect((await salvato(page)).pagine[0].zona).toBe("termostato");
});

test("la pagina che si apre sul Termostato mostra la sua linguetta e la sua card", async ({
  page,
}, testInfo) => {
  const { seme, stati } = casaColTermostato();
  await apriLaCasaAMuro(page, testInfo, {
    seme,
    stati,
    muro: { attiva: true, pagine: [{ id: "p1", modello: "clima", zona: "termostato" }] },
  });
  await expect(muro(page)).toBeVisible();
  await expect(muro(page).locator('[data-mu-zona="termostato"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(muro(page).locator('.mu-card[data-mu-entita="climate.termostato"]')).toBeVisible();
  await expect(muro(page).locator('.mu-card[data-mu-entita="climate.soggiorno"]')).toHaveCount(0);
});

test("le pagine di prima si aprono dove si aprivano", async ({ page }, testInfo) => {
  const { seme, stati } = casaColTermostato();
  await apriLaCasaAMuro(page, testInfo, {
    seme,
    stati,
    muro: {
      attiva: true,
      pagine: [
        { id: "p1", modello: "clima" },
        { id: "p2", modello: "caldo" },
      ],
    },
  });
  await expect(muro(page).locator('[data-mu-zona="freddo"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await muro(page).locator('[data-mu-pagina="1"]').click();
  await expect(muro(page).locator('[data-mu-zona="caldo"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("senza termostati col caldo e il freddo la scelta lo dice, e la pagina si apre su Freddo", async ({
  page,
}, testInfo) => {
  await apriLaCasaAMuro(page, testInfo, {
    muro: { attiva: true, pagine: [{ id: "p1", modello: "clima", zona: "termostato" }] },
  });
  await expect(muro(page).locator('[data-mu-zona="termostato"]')).toHaveCount(0);
  await expect(muro(page).locator('[data-mu-zona="freddo"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="muro"]').click();
  const body = page.locator("#ed-body");
  await expect(body.getByText(/non c'è ancora un termostato/)).toBeVisible();
});
