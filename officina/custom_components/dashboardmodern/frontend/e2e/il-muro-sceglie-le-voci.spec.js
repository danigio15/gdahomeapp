/* I menu a tendina sul muro.
 *
 * «Sulla personalizzata, se inserisco un select mi apre la tendina delle
 * scelte disponibili? Come lo fa su telefono. Ora se lo metto e premo non fa
 * nulla.» E «ho provato anche la tendina "oppure un'azione": premendo non fa
 * niente lo stesso». Il riquadro di un select dice la voce di adesso e apre le
 * voci; un'azione su un menu senza voce fissata le apre anche lei; una con la
 * voce fissata la mette e basta.
 */
import { expect, test } from "@playwright/test";
import { AZIONI_A_MURO, STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const muro = (page) => page.locator("#dm-muro");
const servizi = (page) => page.evaluate(() => window.__SERVIZI__.slice());

const STATI = {
  ...STATI_A_MURO,
  "input_select.modo_casa": {
    state: "Giorno",
    attributes: { friendly_name: "Modo casa", options: ["Giorno", "Notte", "Vacanza"] },
  },
  "select.ventilazione": {
    state: "Auto",
    attributes: { friendly_name: "Ventilazione", options: ["Auto", "Bassa", "Alta"] },
  },
};

const AZIONI = [
  ...AZIONI_A_MURO,
  { name: "Ventilazione", type: "scene", entity: "select.ventilazione" },
  { name: "Notte", type: "scene", entity: "input_select.modo_casa", option: "Notte" },
];

const MURO = {
  attiva: true,
  pagine: [
    {
      id: "p1",
      modello: "personale",
      titolo: "Casa",
      comandi: [
        { tipo: "entita", entita: "input_select.modo_casa" },
        { tipo: "azione", azione: "Ventilazione" },
        { tipo: "azione", azione: "Notte" },
      ],
    },
  ],
};

async function apri(page, testInfo) {
  /* Sul telefono il muro piccolo, sul resto il tablet. */
  if (testInfo.project.name !== "mobile") await page.setViewportSize({ width: 1280, height: 800 });
  await apriLaCasaAMuro(page, testInfo, { muro: MURO, stati: STATI, azioni: AZIONI });
  await expect(muro(page)).toBeVisible();
}

test("il riquadro di un select dice la voce e apre le voci", async ({ page }, testInfo) => {
  await apri(page, testInfo);
  const riquadro = muro(page).locator('[data-mu-fa="scelte"]', { hasText: "Modo casa" });
  await expect(riquadro).toContainText("Giorno");
  if (process.env.DM_FOTO)
    await page.screenshot({
      path: `${process.env.DM_FOTO}/muro-riquadro-select-${testInfo.project.name}.png`,
    });
  await riquadro.click();
  const finestra = muro(page).locator(".mu-fin-scelte");
  await expect(finestra.locator("[data-mu-voce]")).toHaveText(["Giorno", "Notte", "Vacanza"]);
  await expect(finestra.locator('[data-mu-voce="Giorno"]')).toHaveClass(/\bsi\b/);
  if (process.env.DM_FOTO)
    await page.screenshot({
      path: `${process.env.DM_FOTO}/muro-voci-${testInfo.project.name}.png`,
    });
  await finestra.locator('[data-mu-voce="Vacanza"]').click();
  expect(await servizi(page)).toEqual([
    {
      domain: "input_select",
      service: "select_option",
      data: { entity_id: "input_select.modo_casa", option: "Vacanza" },
    },
  ]);
  await expect(muro(page).locator(".mu-finestra")).toHaveCount(0);
});

test("un'azione su un menu: senza voce le apre, con la voce la mette", async ({
  page,
}, testInfo) => {
  await apri(page, testInfo);
  await muro(page).locator('[data-mu-azione="Ventilazione"]').click();
  const finestra = muro(page).locator(".mu-fin-scelte");
  await expect(finestra.locator("[data-mu-voce]")).toHaveText(["Auto", "Bassa", "Alta"]);
  if (process.env.DM_FOTO)
    await page.screenshot({
      path: `${process.env.DM_FOTO}/muro-voci-azione-${testInfo.project.name}.png`,
    });
  await finestra.locator('[data-mu-voce="Alta"]').click();
  await muro(page).locator('[data-mu-azione="Notte"]').click();
  expect(await servizi(page)).toEqual([
    {
      domain: "select",
      service: "select_option",
      data: { entity_id: "select.ventilazione", option: "Alta" },
    },
    {
      domain: "input_select",
      service: "select_option",
      data: { entity_id: "input_select.modo_casa", option: "Notte" },
    },
  ]);
});
