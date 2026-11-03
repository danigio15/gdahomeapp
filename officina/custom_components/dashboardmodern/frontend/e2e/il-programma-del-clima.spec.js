/* Il programma del clima, nella finestra del termostato.
 *
 * Dal campo: «quando apri qui ti scegli gli orari delle fasce e le
 * temperature». Si apre la finestra del termostato della Sala, si apre
 * «🗓️ Programma», si aggiunge una fascia, si cambiano i gradi e si salva: in
 * Home Assistant arriva un cronotermostato col programma a fasce, che poi la
 * finestra rilegge. Senza Premium il programma si vede ma non si tocca.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-sala", name: "Sala", icon: "🛋️", metadata: {} }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [{ id: "c1", name: "Sala", entity: "climate.sala", room: "room-sala", type: "termo" }],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { clima: true },
};

const foto = async (page, nome) => {
  if (!process.env.DM_FOTO) return;
  await page.waitForTimeout(300);
  await page.locator("#clima-popup-overlay .clima-popup").screenshot({
    path: `${process.env.DM_FOTO}/${nome}.png`,
  });
};

async function avvia(page, testInfo, { premium = true, tema = "" } = {}) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((premium) => {
    window.__GDAHOME_PREMIUM__ = premium;
  }, premium);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    async ({ tema }) => {
      if (tema) document.documentElement.setAttribute("data-theme", tema);
      const HA = await import("/src/core/automazioni-ha.js");
      const grezzi = window.eval("_RAW_STATES");
      grezzi["climate.sala"] = {
        entity_id: "climate.sala",
        state: "heat",
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
    { tema },
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

test("dalla finestra del termostato si fa il programma a fasce e si salva in Home Assistant", async ({
  page,
}, testInfo) => {
  const programma = await avvia(page, testInfo);
  await expect(programma.locator(".dm-prg-stato")).toHaveText(/non c'è ancora/);
  await programma.locator("[data-dm-prg-apri]").click();
  /* Il programma di serie: due fasce nei feriali. */
  await expect(programma.locator(".dm-prg-fascia")).toHaveCount(2);
  await expect(programma.locator(".dm-prg-barra i")).toHaveCount(2);

  /* Una fascia in piu', dopo l'ultima, e mezzo grado in meno. */
  await programma.locator("[data-dm-prg-aggiungi]").click();
  await expect(programma.locator(".dm-prg-fascia")).toHaveCount(3);
  await programma.locator('[data-dm-prg-gradi="2:-0.5"]').click();
  await expect(programma.locator(".dm-prg-fascia").nth(2).locator("b")).toHaveText(/19,5°|19\.5°/);
  /* E la prima comincia alle 6:00. */
  await programma.locator('[data-dm-prg-ora="0:da"]').selectOption("360");
  await expect(programma.locator('[data-dm-prg-ora="0:da"]')).toHaveValue("360");

  /* I festivi copiano i feriali. */
  await programma.locator('[data-dm-prg-giorno="festivi"]').click();
  await expect(programma.locator(".dm-prg-fascia")).toHaveCount(1);
  await programma.locator("[data-dm-prg-copia]").click();
  await expect(programma.locator(".dm-prg-fascia")).toHaveCount(3);

  await programma.locator("[data-dm-prg-salva]").click();
  await expect.poll(async () => (await salvate(page)).length).toBe(1);
  const [salvata] = await salvate(page);
  expect(salvata.automazione_id).toBe("");
  expect(salvata.automazione.tipo).toBe("crono");
  expect(salvata.automazione.nome).toBe("Programma Sala");
  expect(salvata.automazione.crono.termostati).toEqual(["climate.sala"]);
  expect(salvata.automazione.crono.programma.feriali).toEqual([
    { da: 360, a: 510, gradi: 21 },
    { da: 1020, a: 1350, gradi: 20.5 },
    { da: 1350, a: 1440, gradi: 19.5 },
  ]);
  expect(salvata.automazione.crono.programma.festivi).toEqual(
    salvata.automazione.crono.programma.feriali,
  );

  /* La finestra rilegge quello che Home Assistant ha: adesso il programma
   * c'e', e salvando di nuovo si aggiorna lo stesso. */
  await expect(programma.locator(".dm-prg-stato")).not.toHaveText(/non c'è ancora/, {
    timeout: 10_000,
  });
  await expect(programma.locator("[data-dm-prg-attivo]")).toBeVisible();
  await programma.locator('[data-dm-prg-fuori="0.5"]').click();
  await programma.locator("[data-dm-prg-salva]").click();
  await expect.poll(async () => (await salvate(page)).length).toBe(2);
  const seconda = (await salvate(page))[1];
  expect(seconda.automazione_id).toBe("5000");
  expect(seconda.automazione.crono.fuori).toBe(17.5);
});

test("senza Premium il programma si vede ma non si tocca", async ({ page }, testInfo) => {
  const programma = await avvia(page, testInfo, { premium: false });
  await programma.locator("[data-dm-prg-apri]").click();
  await expect(programma.locator(".dm-prg-velo")).toBeVisible();
  await expect(programma.locator(".dm-prg-velo")).toContainText("Premium");
  await expect(programma.locator(".dm-prg-velato .dm-prg-fascia")).toHaveCount(2);
  /* Il corpo e' inerte: un tocco forzato non cambia niente e non salva. */
  await programma
    .locator("[data-dm-prg-aggiungi]")
    .evaluate((tasto) => tasto.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await programma
    .locator("[data-dm-prg-salva]")
    .evaluate((tasto) => tasto.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await expect(programma.locator(".dm-prg-velato .dm-prg-fascia")).toHaveCount(2);
  expect(await salvate(page)).toEqual([]);
});

test("le foto del programma: telefono scuro, chiaro, senza Premium", async ({ page }, testInfo) => {
  test.skip(!process.env.DM_FOTO, "solo per le foto");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [tema, premium, nome] of [
    ["dark", true, "programma-clima-scuro"],
    ["light", true, "programma-clima-chiaro"],
    ["dark", false, "programma-clima-senza-premium"],
  ]) {
    const programma = await avvia(page, testInfo, { premium, tema });
    await programma.locator("[data-dm-prg-apri]").click();
    if (premium) {
      /* La sera piu' bassa dopo le 22:30, e la notte presto a 18,5°. */
      await programma.locator("[data-dm-prg-aggiungi]").click();
      for (let i = 0; i < 4; i += 1)
        await programma.locator('[data-dm-prg-gradi="2:-0.5"]').click();
      await programma.locator("[data-dm-prg-aggiungi]").click();
      for (let i = 0; i < 3; i += 1)
        await programma.locator('[data-dm-prg-gradi="0:-0.5"]').click();
      await expect(programma.locator(".dm-prg-fascia")).toHaveCount(4);
    }
    await programma.scrollIntoViewIfNeeded();
    await foto(page, nome);
  }
});
