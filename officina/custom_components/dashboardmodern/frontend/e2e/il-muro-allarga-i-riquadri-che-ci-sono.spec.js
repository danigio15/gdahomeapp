/* Una pagina del muro con meno riquadri dei posti li allarga.
 *
 * Dal campo, su un pannello da 4": «in questa paginetta ho lasciato solo il
 * predefinito dell'antifurto, ma pur togliendo tutto rimane piccolo e non si
 * espande pur essendoci spazio». La griglia scelta (sei, otto, dodici posti)
 * era la misura di ogni casella; adesso e' il tetto. Un riquadro solo prende
 * la pagina, e dentro ci sta quello che serve: l'antifurto dice «2 di 3
 * inserite» e mostra i tasti di ogni area.
 */
import { expect, test } from "@playwright/test";
import { STATI_A_MURO, apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const muro = (page) => page.locator("#dm-muro");
const area = (nome, state) => ({
  state,
  attributes: {
    friendly_name: nome,
    supported_features: 1 + 2 + 4,
    code_format: "number",
    code_arm_required: true,
  },
});
const STATI = {
  ...STATI_A_MURO,
  "alarm_control_panel.casa": area("Casa", "armed_away"),
  "alarm_control_panel.garage": area("Garage", "armed_home"),
  "alarm_control_panel.giardino": area("Giardino", "disarmed"),
};
/* L'ingresso con il solo antifurto: tolto tutto il resto. */
const SOLO_ANTIFURTO = {
  persone: false,
  finestre: false,
  citofono: false,
  esco: "",
  rientro: "",
  telecamera: "",
};
const TRE_AREE = [
  "alarm_control_panel.casa",
  "alarm_control_panel.garage",
  "alarm_control_panel.giardino",
];

/* Quanta parte della pagina sotto la testa copre il riquadro. */
function quotaDellaPagina(page, selettore) {
  return page.evaluate((sel) => {
    const pannello = document.getElementById("dm-muro");
    const testa = pannello.querySelector(".mu-testa").getBoundingClientRect();
    const riquadro = pannello.querySelector(sel).getBoundingClientRect();
    const libera = window.innerWidth * (window.innerHeight - testa.bottom);
    return (riquadro.width * riquadro.height) / libera;
  }, selettore);
}

test("sul pannello da 4\" l'antifurto da solo prende la pagina, con le aree e i loro tasti", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 480, height: 480 });
  await apriLaCasaAMuro(page, testInfo, {
    stati: STATI,
    muro: {
      attiva: true,
      pagine: [{ id: "p1", modello: "ingresso", ingresso: { ...SOLO_ANTIFURTO, aree: TRE_AREE } }],
    },
  });
  await expect(muro(page)).toHaveAttribute("data-compatto", "1");
  const carta = muro(page).locator(".mu-allarme");
  await expect(carta).toBeVisible();
  await expect(carta.locator(".mu-stato-allarme")).toHaveText("2 di 3 inserite");
  expect(await quotaDellaPagina(page, ".mu-allarme")).toBeGreaterThan(0.75);
  /* Tutte e tre le aree, coi loro tasti, dentro la card. */
  await expect(carta.locator(".mu-area")).toHaveCount(3);
  const fondo = await carta.evaluate((c) => c.getBoundingClientRect().bottom);
  for (const tasto of await carta.locator(".mu-area button").all()) {
    await expect(tasto).toBeVisible();
    expect((await tasto.boundingBox()).y + (await tasto.boundingBox()).height).toBeLessThanOrEqual(
      fondo,
    );
  }
});

test("con un'area sola l'antifurto grande ha i tasti dei modi", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 480, height: 480 });
  await apriLaCasaAMuro(page, testInfo, {
    stati: STATI,
    muro: {
      attiva: true,
      pagine: [
        {
          id: "p1",
          modello: "ingresso",
          ingresso: { ...SOLO_ANTIFURTO, aree: ["alarm_control_panel.casa"] },
        },
      ],
    },
  });
  const carta = muro(page).locator(".mu-allarme");
  await expect(carta.locator(".mu-stato-allarme")).toBeVisible();
  await expect(carta.locator('.mu-modi [data-mu-fa="allarme"]').first()).toBeVisible();
  expect(await quotaDellaPagina(page, ".mu-allarme")).toBeGreaterThan(0.75);
});

test('sul 10" un riquadro solo prende la pagina, tre stanno in quattro caselle', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await apriLaCasaAMuro(page, testInfo, {
    muro: {
      attiva: true,
      pagine: [
        { id: "p1", modello: "personale", comandi: [{ tipo: "luce", entita: "light.soggiorno" }] },
        {
          id: "p2",
          modello: "personale",
          comandi: [
            { tipo: "luce", entita: "light.soggiorno" },
            { tipo: "clima", entita: "climate.soggiorno" },
            { tipo: "tapparella", entita: "cover.soggiorno" },
          ],
        },
      ],
    },
  });
  const luce = muro(page).locator('.mu-card[data-mu-entita="light.soggiorno"]');
  await expect(luce).toBeVisible();
  /* Niente posti liberi disegnati attorno. */
  await expect(muro(page).locator(".mu-vuoto")).toHaveCount(0);
  expect(
    await quotaDellaPagina(page, '.mu-card[data-mu-entita="light.soggiorno"]'),
  ).toBeGreaterThan(0.75);

  await muro(page).locator('[data-mu-pagina="1"]').click();
  const griglia = muro(page).locator(".mu-g6");
  await expect(griglia).toHaveClass(/mu-adatta/);
  await expect(muro(page).locator(".mu-vuoto")).toHaveCount(0);
  const caselle = await griglia.evaluate((g) =>
    [...g.children].map((c) => {
      const r = c.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) };
    }),
  );
  expect(caselle).toHaveLength(3);
  /* Due sopra, affiancati e larghi uguali; il terzo sotto, largo quanto loro due. */
  expect(caselle[0].y).toBe(caselle[1].y);
  expect(Math.abs(caselle[0].w - caselle[1].w)).toBeLessThanOrEqual(1);
  expect(caselle[2].y).toBeGreaterThan(caselle[0].y);
  expect(caselle[2].w).toBeGreaterThan(caselle[0].w * 1.9);
});

test("un posto lasciato libero in mezzo resta, e la pagina piena resta com'era", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const sei = [
    { tipo: "luce", entita: "light.soggiorno" },
    { tipo: "luce", entita: "light.tavolo" },
    { tipo: "luce", entita: "light.cucina" },
    { tipo: "clima", entita: "climate.soggiorno" },
    { tipo: "tapparella", entita: "cover.soggiorno" },
    { tipo: "entita", entita: "lock.porta" },
  ];
  await apriLaCasaAMuro(page, testInfo, {
    muro: {
      attiva: true,
      pagine: [
        {
          id: "p1",
          modello: "personale",
          comandi: [
            { tipo: "luce", entita: "light.soggiorno" },
            { tipo: "vuoto" },
            { tipo: "clima", entita: "climate.soggiorno" },
          ],
        },
        { id: "p2", modello: "personale", comandi: sei },
      ],
    },
  });
  const griglia = muro(page).locator(".mu-g6");
  await expect(griglia.locator(":scope > *")).toHaveCount(3);
  await expect(griglia.locator(":scope > .mu-vuoto")).toHaveCount(1);
  await muro(page).locator('[data-mu-pagina="1"]').click();
  await expect(griglia.locator(":scope > *")).toHaveCount(6);
  await expect(griglia).not.toHaveClass(/mu-adatta/);
});

test("sul telefono un riquadro solo riempie la pagina", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await apriLaCasaAMuro(page, testInfo, {
    muro: {
      attiva: true,
      pagine: [
        { id: "p1", modello: "personale", comandi: [{ tipo: "luce", entita: "light.soggiorno" }] },
      ],
    },
  });
  await expect(muro(page)).toHaveAttribute("data-verso", "verticale");
  expect(
    await quotaDellaPagina(page, '.mu-card[data-mu-entita="light.soggiorno"]'),
  ).toBeGreaterThan(0.75);
});
