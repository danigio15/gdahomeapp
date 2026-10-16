/* «Se vado su Luci e Porte continua a sparire la parte sopra. Nelle altre
 * schede no.» Su iPhone, dalla 1.11 alla 1.14.
 *
 * Le cure di prima partivano da una misura sbagliata: la «larghezza zero»
 * della segnalazione era presa dalla pagina della segnalazione stessa, dove
 * la fascia e' spenta apposta. Qui si rifa' la strada di chi la usa — Luci e
 * Porte, col tasto in basso e col tasto Home della pagina, anche dopo aver
 * scorso la pagina — e a ogni ritorno si guarda la fila in alto davvero: che
 * menu, nome e ingranaggio abbiano una misura, e che al loro centro, sullo
 * schermo, ci siano loro e non qualcos'altro.
 *
 * Gira anche su WebKit (il motore di Safari), che e' dove succede. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ name: "Cucina", icon: "🍳" }, { name: "Sala", icon: "🛋️" }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: Array.from({ length: 14 }, (_v, i) => ({
      entity: `light.luce_${i}`,
      name: `Luce ${i}`,
    })),
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, luci: true, varchi: true },
};

const STATI = Object.fromEntries([
  ...Array.from({ length: 14 }, (_v, i) => [
    `light.luce_${i}`,
    { state: i % 3 ? "off" : "on", attributes: { friendly_name: `Luce ${i}` } },
  ]),
  ...Array.from({ length: 10 }, (_v, i) => [
    `binary_sensor.porta_${i}`,
    {
      state: i % 4 ? "off" : "on",
      attributes: { device_class: i % 2 ? "window" : "door", friendly_name: `Porta ${i}` },
    },
  ]),
]);

async function avvia(page, testInfo) {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((stati) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);
}

const segno = (page) => page.evaluate(() => document.body.dataset.dmPagina || "");

/* La fila in alto com'e' adesso, misurata come la vede chi guarda. */
function laFila(page) {
  return page.evaluate(() => {
    const testata = document.querySelector("body>header:not(.dm-page-mast)");
    const pezzi = {
      sinistra: testata?.querySelector(":scope > .header-left-wrap"),
      nome: testata?.querySelector(".brand-text"),
      ingranaggio: testata?.querySelector(":scope > .dm-editor-entry"),
    };
    const fuori = {};
    for (const [nome, nodo] of Object.entries(pezzi)) {
      if (!nodo) {
        fuori[nome] = { manca: true };
        continue;
      }
      const r = nodo.getBoundingClientRect();
      const stile = getComputedStyle(nodo);
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const sopra = r.width && r.height ? document.elementFromPoint(cx, cy) : null;
      fuori[nome] = {
        x: Math.round(r.left),
        y: Math.round(r.top),
        largo: Math.round(r.width),
        alto: Math.round(r.height),
        display: stile.display,
        vis: stile.visibility,
        opacita: stile.opacity,
        suo: Boolean(sopra && (sopra === nodo || nodo.contains(sopra))),
        sopra: sopra
          ? `${sopra.tagName.toLowerCase()}${sopra.id ? `#${sopra.id}` : ""}.${String(sopra.className || "")
              .split(" ")
              .slice(0, 2)
              .join(".")}`
          : "",
      };
    }
    const rt = testata?.getBoundingClientRect();
    fuori.testata = rt
      ? { y: Math.round(rt.top), alto: Math.round(rt.height), largo: Math.round(rt.width) }
      : { manca: true };
    fuori.scroll = Math.round(window.scrollY);
    return fuori;
  });
}

async function controllaLaFila(page, passo, testInfo) {
  await page.waitForTimeout(700);
  const fila = await laFila(page);
  // Nel registro della corsa: e' quello che serve se su WebKit non va.
  console.log(`[fila] ${testInfo.project.name} ${passo}: ${JSON.stringify(fila)}`);
  if (process.env.DM_FOTO)
    await page.screenshot({ path: `${process.env.DM_FOTO}/fila-${testInfo.project.name}-${passo}.png` });
  for (const pezzo of ["sinistra", "nome", "ingranaggio"]) {
    expect(fila[pezzo].manca, `${passo}: ${pezzo} c'e'`).toBeUndefined();
    expect(fila[pezzo].largo, `${passo}: ${pezzo} ha una larghezza`).toBeGreaterThan(8);
    expect(fila[pezzo].alto, `${passo}: ${pezzo} ha un'altezza`).toBeGreaterThan(8);
    expect(fila[pezzo].y, `${passo}: ${pezzo} sta sullo schermo`).toBeGreaterThanOrEqual(-1);
    expect(fila[pezzo].suo, `${passo}: sopra ${pezzo} c'e' ${fila[pezzo].sopra}`).toBe(true);
  }
}

async function andata(page, tab, pagina) {
  await page.locator(`.tab[data-tab="${tab}"]`).click();
  await expect.poll(() => segno(page)).toBe(pagina);
}

async function ritornoColTastoInBasso(page) {
  await page.locator('.tab[data-tab="home"]').click();
  await expect.poll(() => segno(page)).toBe("page-home");
}

async function ritornoColTastoDellaPagina(page, pagina) {
  await page.locator(`#${pagina} [data-dm-mast-back]`).first().click();
  await expect.poll(() => segno(page)).toBe("page-home");
}

test.describe("la fila in alto torna da Luci e da Porte", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("Luci e Porte, col tasto in basso e col tasto della pagina, anche dopo aver scorso", async ({
    page,
  }, testInfo) => {
    await avvia(page, testInfo);
    await controllaLaFila(page, "0-avvio", testInfo);

    await andata(page, "luci", "page-luci");
    await ritornoColTastoInBasso(page);
    await controllaLaFila(page, "1-luci-tasto-in-basso", testInfo);

    await andata(page, "varchi", "page-varchi");
    await ritornoColTastoInBasso(page);
    await controllaLaFila(page, "2-porte-tasto-in-basso", testInfo);

    await andata(page, "luci", "page-luci");
    await ritornoColTastoDellaPagina(page, "page-luci");
    await controllaLaFila(page, "3-luci-tasto-della-pagina", testInfo);

    await andata(page, "varchi", "page-varchi");
    await ritornoColTastoDellaPagina(page, "page-varchi");
    await controllaLaFila(page, "4-porte-tasto-della-pagina", testInfo);

    /* Scorrendo la pagina prima di tornare: le Luci di una casa vera sono
     * una pagina lunga. */
    await andata(page, "luci", "page-luci");
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(400);
    await ritornoColTastoInBasso(page);
    await controllaLaFila(page, "5-luci-dopo-lo-scorrimento", testInfo);

    await andata(page, "varchi", "page-varchi");
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(400);
    await ritornoColTastoInBasso(page);
    await controllaLaFila(page, "6-porte-dopo-lo-scorrimento", testInfo);

    /* E per confronto una scheda dove non succede. */
    await page.locator('.tab[data-tab="temp"]').evaluate((b) => b.click());
    await expect.poll(() => segno(page)).toBe("page-temp");
    await ritornoColTastoInBasso(page);
    await controllaLaFila(page, "7-temperature", testInfo);
  });
});
