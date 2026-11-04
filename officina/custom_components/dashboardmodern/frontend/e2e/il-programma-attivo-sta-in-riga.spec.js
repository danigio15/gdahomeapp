/* Il Programma dopo la revisione: la pastiglia dice solo «Attivo» e il
 * prossimo cambio sta sotto il titolo (a 360 la pastiglia diventava «Attivo ·
 * dom…»); le modifiche non salvate si dicono; ogni tasto e orario e' alto 44
 * px; e un condizionatore ha le fasce azzurre, non arancioni. A 360, a 390 e
 * sul computer. Con DM_RENDER=<cartella> lascia la foto «dopo-programma-*».
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SCHERMI = [
  { nome: "telefono360", width: 360, height: 780 },
  { nome: "telefono390", width: 390, height: 844 },
  { nome: "computer", width: 1280, height: 900 },
];

const seme = (TIPO) => ({
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-sala", name: "Sala", icon: "🛋️", metadata: {} }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [{ id: "c1", name: "Sala", entity: "climate.sala", room: "room-sala", type: TIPO }],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { clima: true },
});

async function avvia(
  page,
  testInfo,
  { premium = true, tema = "", tipo = "termo", modo = "heat" } = {},
) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((premium) => {
    window.__GDAHOME_PREMIUM__ = premium;
  }, premium);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme(tipo));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    async ({ tema, modo }) => {
      if (tema) document.documentElement.setAttribute("data-theme", tema);
      const HA = await import("/src/core/automazioni-ha.js");
      const grezzi = window.eval("_RAW_STATES");
      grezzi["climate.sala"] = {
        entity_id: "climate.sala",
        state: modo,
        attributes: {
          friendly_name: "Sala",
          hvac_modes: ["off", "heat", "auto"],
          hvac_action: "idle",
          current_temperature: 19.5,
          temperature: 20,
          min_temp: 5,
          max_temp: 30,
          target_temp_step: 0.5,
        },
      };
      const casa = { config: {}, comandi: [] };
      window.__CASA__ = casa;
      const elenco = () =>
        Object.entries(casa.config).map(([id, config]) => ({
          entity_id: `automation.p${id}`,
          id,
          nome: config.alias,
          attiva: true,
          modello: HA.dallaHomeAssistant(config, { stati: grezzi }),
          modificabile: true,
          config,
        }));
      const risposta = (m) => {
        casa.comandi.push(m);
        if (m.type === "ponte/automazioni/stato")
          return {
            premium: true,
            puoScrivere: true,
            automazioni: elenco(),
            aree: [],
            categorie: [],
          };
        if (m.type === "ponte/automazioni/salva") {
          const id = m.automazione_id || String(5000 + Object.keys(casa.config).length);
          casa.config[id] = HA.inHomeAssistant({ ...m.automazione, id }, { stati: grezzi });
          return { id, alias: casa.config[id].alias };
        }
        return { proposte: [], giorni: 21, abitudiniPronte: true };
      };
      const vero = window.eval("ws");
      window.eval("ws = window.__FINTO__ =" + "{}");
      Object.assign(window.__FINTO__, {
        readyState: 1,
        send(grezzo) {
          const m = JSON.parse(grezzo);
          if (!String(m.type).startsWith("ponte/automazioni/")) return vero?.send?.(grezzo);
          const result = risposta(m);
          setTimeout(() => {
            const attese = window.eval("pendingWsCallbacks");
            const torna = attese[m.id];
            delete attese[m.id];
            torna?.({ id: m.id, type: "result", success: true, result });
          }, 10);
        },
      });
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { tema, modo },
  );
  await page.waitForTimeout(800);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => window.apriClimaPopup?.("climate.sala", null));
  const programma = page.locator("#clima-popup-overlay [data-dm-prg]");
  await expect(programma).toBeVisible({ timeout: 15_000 });
  return programma;
}

const salvate = (page) =>
  page.evaluate(() => window.__CASA__.comandi.filter((m) => m.type === "ponte/automazioni/salva"));

for (const schermo of SCHERMI) {
  test(`la pastiglia dice «Attivo», il prossimo cambio sta sotto il titolo (${schermo.nome})`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: schermo.width, height: schermo.height });
    const programma = await avvia(page, testInfo);
    await programma.locator("[data-dm-prg-apri]").click();
    // Si salva il programma di serie: da li' e' attivo.
    await programma.locator("[data-dm-prg-salva]").click();
    await expect.poll(async () => (await salvate(page)).length).toBe(1);
    const stato = programma.locator(".dm-prg-stato");
    await expect(stato).toHaveText("Attivo", { timeout: 10_000 });
    expect(await stato.evaluate((n) => n.scrollWidth <= n.clientWidth)).toBe(true);
    const prossimo = programma.locator("[data-dm-prg-prossimo]");
    await expect(prossimo).toBeVisible();
    await expect(prossimo).toHaveText(/(alle|domani alle) \d\d:\d\d → \d+(,\d)?°/);
    expect(await prossimo.evaluate((n) => n.scrollWidth <= n.clientWidth + 1)).toBe(true);
    // La testa sta dentro la finestra.
    const testa = await programma.locator(".dm-prg-testa").boundingBox();
    const finestra = await page.locator("#clima-popup-overlay .clima-popup").boundingBox();
    expect(testa.x + testa.width).toBeLessThanOrEqual(finestra.x + finestra.width + 0.5);

    // Ogni tasto e ogni orario: almeno 44 px.
    for (const tasto of await programma
      .locator(".dm-prg-gradi button, .dm-prg-ora, .dm-prg-via")
      .all()) {
      const box = await tasto.boundingBox();
      expect(
        box.height,
        await tasto.evaluate((n) => n.outerHTML.slice(0, 60)),
      ).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }

    // Una modifica non salvata si dice; tornata com'era, no.
    await expect(programma.locator("[data-dm-prg-sporca]")).toHaveCount(0);
    await programma.locator('[data-dm-prg-fuori="0.5"]').click();
    await expect(programma.locator("[data-dm-prg-sporca]")).toHaveText("Modifiche non salvate");
    await programma.locator('[data-dm-prg-fuori="-0.5"]').click();
    await expect(programma.locator("[data-dm-prg-sporca]")).toHaveCount(0);

    if (schermo.width === 360 && process.env.DM_RENDER) {
      /* La finestra intera, senza lo scorrimento, e senza l'avviso del
       * salvataggio che passa sopra. */
      await page.addStyleTag({
        content:
          "#clima-popup-overlay.show{position:absolute!important;inset:0 auto auto 0!important;width:100%!important;min-height:100vh;height:auto!important;align-items:flex-start!important}#clima-popup-overlay .clima-popup{max-height:none!important;overflow:visible!important}",
      });
      await page.waitForTimeout(3500);
      await page.locator("#clima-popup-overlay .clima-popup").screenshot({
        path: `${process.env.DM_RENDER}/dopo-programma-attivo-${schermo.nome}.png`,
      });
    }
  });
}

test("un condizionatore ha le fasce azzurre, un termosifone ambra", async ({ page }, testInfo) => {
  const programma = await avvia(page, testInfo, { tipo: "clima", modo: "cool" });
  await programma.locator("[data-dm-prg-apri]").click();
  const colore = await programma
    .locator(".dm-prg-fascia")
    .first()
    .evaluate((n) => n.style.getPropertyValue("--g"));
  expect(colore).toContain("#0284c7");
  expect(colore).not.toContain("#ea580c");
});

test("al buio la barra non e' marrone", async ({ page }, testInfo) => {
  const programma = await avvia(page, testInfo, { tema: "dark" });
  await programma.locator("[data-dm-prg-apri]").click();
  /* Il colore vero, in pixel: il fondo e' un color-mix, e il browser lo
   * scrive in oklab. */
  const [r, g, b] = await programma.locator(".dm-prg-barra").evaluate((n) => {
    const tela = document.createElement("canvas");
    tela.width = tela.height = 1;
    const c = tela.getContext("2d");
    c.fillStyle = getComputedStyle(n).backgroundColor;
    c.fillRect(0, 0, 1, 1);
    return [...c.getImageData(0, 0, 1, 1).data];
  });
  /* Un velo leggero sulla card scura: scuro, e non un marrone (rosso molto
   * sopra il blu). */
  expect(r + g + b).toBeLessThan(3 * 90);
  expect(r - b).toBeLessThan(35);
});
