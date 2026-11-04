/* La finestra del termostato scorre sul telefono, e il fondo resta sopra la
 * barra in basso.
 *
 * Dal campo (1.18.9.2, telefono): «non c'è lo scroll, non vedo le cose
 * sotto». La finestra («Cucina»: gradi, modalità, Spegni/Accendi e sotto il
 * Programma) era alta l'88% dello schermo e centrata: il suo fondo finiva
 * dietro la barra di navigazione della plancia, che sta sopra a tutto. Il
 * Programma aperto e «Salva il programma» restavano li' sotto, anche
 * scorrendo fino in fondo. Qui si apre la finestra su quattro telefoni (due
 * alti, due bassi come l'app con la tastiera di sistema e le barre), con la
 * barra in vista, chiaro e scuro, si apre il Programma e si arriva a «Salva il
 * programma»: deve vedersi ed essere il primo sotto il dito.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-cucina", name: "Cucina", icon: "🍳", metadata: {} }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [
      { id: "c1", name: "Cucina", entity: "climate.cucina", room: "room-cucina", type: "termo" },
    ],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { clima: true },
};

const DOVE = process.env.DM_FOTO_SCORRE || "";

async function avvia(page, testInfo, { tema = "" } = {}) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    window.__GDAHOME_PREMIUM__ = true;
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate((tema) => {
    if (tema) document.documentElement.setAttribute("data-theme", tema);
    const grezzi = window.eval("_RAW_STATES");
    grezzi["climate.cucina"] = {
      entity_id: "climate.cucina",
      state: "off",
      attributes: {
        friendly_name: "Cucina",
        hvac_modes: ["heat", "sleep", "off"],
        hvac_action: "off",
        current_temperature: 20.5,
        current_humidity: 56,
        temperature: 18,
        min_temp: 5,
        max_temp: 30,
        target_temp_step: 0.5,
      },
    };
    /* La casa: nessun programma ancora, si puo' scrivere. */
    const vero = window.eval("ws");
    window.eval("ws = window.__FINTO__ =" + "{}");
    Object.assign(window.__FINTO__, {
      readyState: 1,
      send(grezzo) {
        const m = JSON.parse(grezzo);
        if (!String(m.type).startsWith("ponte/automazioni/")) return vero?.send?.(grezzo);
        const result =
          m.type === "ponte/automazioni/stato"
            ? { premium: true, puoScrivere: true, automazioni: [], aree: [], categorie: [] }
            : { proposte: [], giorni: 21, abitudiniPronte: true };
        setTimeout(() => {
          const attese = window.eval("pendingWsCallbacks");
          const torna = attese[m.id];
          delete attese[m.id];
          torna?.({ id: m.id, type: "result", success: true, result });
        }, 50);
      },
    });
  }, tema);
  await page.waitForTimeout(300);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  /* La barra in basso in vista, come sul telefono di chi l'ha visto. */
  await page.evaluate(() => {
    const barra = document.querySelector("nav.tabs.bottom-nav-bar");
    barra?.classList.add("visible");
  });
  await page.evaluate(() => window.apriClimaPopup?.("climate.cucina", null));
  const finestra = page.locator("#clima-popup-overlay .clima-popup");
  await expect(finestra).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(500);
  return finestra;
}

/* Il primo elemento sotto il dito al centro di `quale`: e' lui o un suo
 * figlio, non la barra o il velo. */
const eSottoIlDito = (pagina, selettore) =>
  pagina.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return "manca";
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (y < 0 || y > innerHeight) return `fuori schermo (${Math.round(y)} su ${innerHeight})`;
    const sopra = document.elementFromPoint(x, y);
    return sopra && (sopra === el || el.contains(sopra))
      ? "si"
      : `coperto da ${sopra?.tagName}.${String(sopra?.className || "").slice(0, 40)}`;
  }, selettore);

const TELEFONI = [
  { nome: "390x844", width: 390, height: 844 },
  { nome: "360x740", width: 360, height: 740 },
  /* Bassi: e' qui che il fondo finiva dietro la barra. */
  { nome: "390x540", width: 390, height: 540, basso: true },
  { nome: "360x600", width: 360, height: 600, basso: true },
];

for (const tel of TELEFONI) {
  test.describe(`telefono ${tel.nome}`, () => {
    test.use({
      viewport: { width: tel.width, height: tel.height },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
    });

    for (const tema of ["light", "dark"]) {
      test(`${tema}: la finestra scorre e «Salva il programma» si vede sopra la barra`, async ({
        page,
      }, testInfo) => {
        const finestra = await avvia(page, testInfo, { tema });
        /* Il fondo della finestra non finisce sotto la barra in basso. */
        const misure = await page.evaluate(() => {
          const f = document
            .querySelector("#clima-popup-overlay .clima-popup")
            .getBoundingClientRect();
          const b = document.querySelector("nav.tabs.bottom-nav-bar");
          const rb = b && getComputedStyle(b).display !== "none" ? b.getBoundingClientRect() : null;
          return {
            fondo: f.bottom,
            cima: f.top,
            barra: rb ? rb.top : innerHeight,
            alto: innerHeight,
          };
        });
        expect(misure.cima).toBeGreaterThanOrEqual(0);
        expect(misure.fondo).toBeLessThanOrEqual(misure.barra + 1);
        if (DOVE)
          await page.screenshot({ path: `${DOVE}/01-finestra-aperta-${tel.nome}-${tema}.png` });
        /* Si apre il Programma: la finestra lo porta in vista. */
        const programma = page.locator("#clima-popup-overlay [data-dm-prg]");
        await expect(programma).toBeVisible({ timeout: 15_000 });
        await programma.locator("[data-dm-prg-apri]").click();
        const salva = programma.locator("[data-dm-prg-salva]");
        await expect(salva).toHaveCount(1, { timeout: 15_000 });
        /* Il Programma aperto e' stato portato in vista. */
        expect(await eSottoIlDito(page, "#clima-popup-overlay [data-dm-prg-apri]")).toBe("si");
        /* La finestra scorre (non il resto della pagina) fino a «Salva». */
        const scorre = await finestra.evaluate((f) => f.scrollHeight > f.clientHeight + 1);
        if (tel.basso) expect(scorre).toBe(true);
        await finestra.evaluate((f) => f.scrollTo({ top: f.scrollHeight }));
        await page.waitForTimeout(300);
        expect(await eSottoIlDito(page, "#clima-popup-overlay [data-dm-prg-salva]")).toBe("si");
        if (DOVE)
          await page.screenshot({
            path: `${DOVE}/02-in-fondo-col-programma-${tel.nome}-${tema}.png`,
          });
      });
    }

    test("anche con la rotella: la finestra scorre da sola", async ({ page }, testInfo) => {
      test.skip(!tel.basso, "sul telefono alto c'e' poco da scorrere");
      const finestra = await avvia(page, testInfo);
      const programma = page.locator("#clima-popup-overlay [data-dm-prg]");
      await programma.locator("[data-dm-prg-apri]").click();
      await expect(programma.locator("[data-dm-prg-salva]")).toHaveCount(1, { timeout: 15_000 });
      const prima = await finestra.evaluate((f) => f.scrollTop);
      const box = await finestra.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.7);
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(300);
      const dopo = await finestra.evaluate((f) => f.scrollTop);
      expect(dopo).toBeGreaterThan(prima);
      expect(await eSottoIlDito(page, "#clima-popup-overlay [data-dm-prg-salva]")).toBe("si");
    });
  });
}
