/* La card del clima del muro, a scelta come quella della plancia.
 *
 * «Perche' nel clima del muro non vedo la stessa cosa? Intendo la linea della
 * temperatura e i numeri in quel modo: non e' piu' bello?» In «Altre
 * impostazioni › Card del clima» si sceglie: come il muro, raccolta, o come
 * la plancia principale, con la temperatura della stanza grande e la riga
 * della scala con la voluta.
 */
import { expect, test } from "@playwright/test";
import { SEME_A_MURO, STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const muro = (page) => page.locator("#dm-muro");
const servizi = (page) => page.evaluate(() => window.__SERVIZI__.slice());

const STATI = {
  ...STATI_A_MURO,
  "climate.riscaldamento": {
    state: "off",
    attributes: {
      friendly_name: "Riscaldamento",
      current_temperature: 19.3,
      temperature: 47,
      hvac_modes: ["off", "heat"],
      target_temp_step: 0.5,
      min_temp: 30,
      max_temp: 75,
    },
  },
  "climate.acqua_sanitaria": {
    state: "heat",
    attributes: {
      friendly_name: "Acqua sanitaria",
      current_temperature: 55.5,
      temperature: 58,
      hvac_modes: ["off", "heat"],
      hvac_action: "heating",
      target_temp_step: 0.5,
      min_temp: 30,
      max_temp: 70,
    },
  },
};

const SEME = structuredClone(SEME_A_MURO);
SEME.sections.climate.push(
  { id: "c2", name: "Riscaldamento", entity: "climate.riscaldamento", type: "termo" },
  { id: "c3", name: "Acqua sanitaria", entity: "climate.acqua_sanitaria", type: "termo" },
);

const muroCon = (cartaClima, tema = "chiaro") => ({
  attiva: true,
  tema,
  cartaClima,
  pagine: [
    {
      id: "p1",
      modello: "personale",
      titolo: "Clima",
      comandi: [
        { tipo: "clima", entita: "climate.soggiorno" },
        { tipo: "clima", entita: "climate.riscaldamento" },
        { tipo: "clima", entita: "climate.acqua_sanitaria" },
      ],
    },
  ],
});

const foto = (page, nome, testInfo) =>
  process.env.DM_FOTO
    ? page.screenshot({ path: `${process.env.DM_FOTO}/clima-${nome}-${testInfo.project.name}.png` })
    : null;

for (const tema of ["chiaro", "scuro"])
  test(`come la plancia (${tema}): la stanza grande, la riga con la voluta, e i tasti comandano`, async ({
    page,
  }, testInfo) => {
    await apriLaCasaAMuro(page, testInfo, {
      muro: muroCon("plancia", tema),
      stati: STATI,
      seme: SEME,
    });
    const acqua = muro(page).locator('.mu-cp[data-mu-entita="climate.acqua_sanitaria"]');
    await expect(acqua).toBeVisible();
    await expect(acqua.locator(".mu-cp-n")).toContainText("55,5");
    await expect(acqua.locator(".mu-cp-target")).toContainText("58");
    /* Gli estremi della scala ai lati; sul pannello piccolo resta la voluta. */
    if (testInfo.project.name !== "mobile") {
      await expect(acqua.locator(".mu-cp-sotto")).toContainText("30°");
      await expect(acqua.locator(".mu-cp-sotto")).toContainText("70°");
    }
    /* Il pallino della voluta sta dove sta 58 fra 30 e 70. */
    const sinistra = await acqua
      .locator(".mu-cp-pallino")
      .evaluate((n) => parseFloat(n.style.left));
    expect(sinistra).toBeCloseTo(70, 0);
    const spento = muro(page).locator('.mu-cp[data-mu-entita="climate.riscaldamento"]');
    await expect(spento.locator(".mu-cp-stato")).toHaveText(/Spento/i);
    await foto(page, `come-la-plancia-${tema}`, testInfo);
    await acqua.locator('[data-mu-fa="piu"]').click();
    await expect
      .poll(async () =>
        (await servizi(page)).some(
          (v) =>
            v.service === "set_temperature" &&
            v.data?.entity_id === "climate.acqua_sanitaria" &&
            v.data?.temperature === 58.5,
        ),
      )
      .toBe(true);
  });

test("di serie resta la card del muro", async ({ page }, testInfo) => {
  await apriLaCasaAMuro(page, testInfo, { muro: muroCon(undefined), stati: STATI, seme: SEME });
  await expect(
    muro(page).locator('[data-mu-entita="climate.acqua_sanitaria"]').first(),
  ).toBeVisible();
  await expect(muro(page).locator(".mu-cp")).toHaveCount(0);
  await foto(page, "come-il-muro", testInfo);
});

test("nel config del muro si sceglie, in Altre impostazioni, e si salva", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "il config si prova sul tablet");
  await page.setViewportSize({ width: 1280, height: 900 });
  await apriLaCasaAMuro(page, testInfo, { muro: muroCon(undefined), stati: STATI, seme: SEME });
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="muro"]').click();
  const body = page.locator("#ed-body");
  await body.locator("[data-mu-ed-altro]").click();
  const scelta = body.locator('[data-mu-ed-metti="cartaClima"][data-mu-ed-valore="plancia"]');
  await expect(body.locator('[data-mu-ed-metti="cartaClima"].si')).toHaveAttribute(
    "data-mu-ed-valore",
    "muro",
  );
  await scelta.click();
  await expect(scelta).toHaveClass(/\bsi\b/);
  const riga = scelta.locator("xpath=ancestor::*[contains(@class,'mu-ed-riga')][1]");
  await riga.scrollIntoViewIfNeeded();
  if (process.env.DM_FOTO)
    await riga.screenshot({
      path: `${process.env.DM_FOTO}/clima-config-${testInfo.project.name}.png`,
    });
  await body.locator("[data-dm-save-all]").click();
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("cd_muro") || "null")?.cartaClima),
    )
    .toBe("plancia");
});
