/* Il programma del clima salvato si rilegge com'e', e decide subito.
 *
 * Dal campo (1.18.9.1): «sembra che non salva il programma», «se ricarichi la
 * pagina ti cambia l'orario», «ogni tanto torna sempre quello originale»,
 * «anche il target non cambia». La finestra si apriva prima che la casa
 * avesse risposto: la bozza nasceva dal programma di serie (06:30–08:30 21°,
 * 17:00–22:30 20,5°, fuori 17°) e restava quella anche quando arrivava il
 * programma vero, che cosi' sembrava perso; e salvare non cambiava i gradi
 * fino al cambio di fascia dopo. Qui la casa risponde in ritardo, come una
 * casa vera, e il programma salvato e' diverso da quello di serie.
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

/* Quello che Marco ha salvato: la sera accorciata alle 19 e fuori 22°. */
const SALVATO = {
  termostati: ["climate.sala"],
  fuori: 22,
  programma: {
    feriali: [
      { da: 390, a: 510, gradi: 21 },
      { da: 1020, a: 1140, gradi: 20.5 },
    ],
    festivi: [{ da: 480, a: 1380, gradi: 20.5 }],
  },
};

const DOVE = process.env.DM_FOTO_PRG || "";

async function avvia(
  page,
  testInfo,
  { ritardo = 1500, rifiuta = "", tema = "", salvato = SALVATO } = {},
) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    window.__GDAHOME_PREMIUM__ = true;
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    async ({ tema, ritardo, rifiuta, salvato }) => {
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
          current_temperature: 19.7,
          temperature: 19,
          min_temp: 5,
          max_temp: 30,
          target_temp_step: 0.5,
        },
      };
      const casa = { config: {}, comandi: [], ritardo };
      if (salvato)
        casa.config.p1 = HA.inHomeAssistant(
          { id: "p1", nome: "Programma Sala", attiva: true, tipo: "crono", crono: salvato },
          { stati: grezzi },
        );
      window.__CASA__ = casa;
      const elenco = () =>
        Object.entries(casa.config).map(([id, config]) => ({
          entity_id: `automation.${id}`,
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
          if (casa.rifiuta) return { errore: casa.rifiuta };
          const id = m.automazione_id || "p9";
          casa.config[id] = HA.inHomeAssistant({ ...m.automazione, id }, { stati: grezzi });
          /* Il ponte fa decidere subito il programma: i gradi di adesso. */
          grezzi["climate.sala"].attributes.temperature = window.__GRADI_ADESSO__?.(m) ?? 19;
          return {
            id,
            alias: casa.config[id].alias,
            entity_id: `automation.${id}`,
            applicato: true,
          };
        }
        return { proposte: [], giorni: 21, abitudiniPronte: true };
      };
      casa.rifiuta = rifiuta;
      const vero = window.eval("ws");
      window.eval("ws = window.__FINTO__ =" + "{}");
      Object.assign(window.__FINTO__, {
        readyState: 1,
        send(grezzo) {
          const m = JSON.parse(grezzo);
          if (!String(m.type).startsWith("ponte/automazioni/")) return vero?.send?.(grezzo);
          const result = risposta(m);
          /* Una casa vera risponde con calma: l'elenco arriva dopo che la
           * finestra si e' gia' aperta. */
          setTimeout(
            () => {
              const attese = window.eval("pendingWsCallbacks");
              const torna = attese[m.id];
              delete attese[m.id];
              if (result?.errore)
                torna?.({
                  id: m.id,
                  type: "result",
                  success: false,
                  error: { code: result.errore, message: "Message malformed: tempo scaduto" },
                });
              else torna?.({ id: m.id, type: "result", success: true, result });
            },
            m.type === "ponte/automazioni/stato" ? casa.ritardo : 10,
          );
        },
      });
      const { gradiAlle, cronoPulito } = await import("/src/core/automazioni.js");
      window.__GRADI_ADESSO__ = (m) => gradiAlle(cronoPulito(m.automazione.crono), Date.now());
    },
    { tema, ritardo, rifiuta, salvato },
  );
  await page.waitForTimeout(300);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => window.apriClimaPopup?.("climate.sala", null));
  const programma = page.locator("#clima-popup-overlay [data-dm-prg]");
  await expect(programma).toBeVisible({ timeout: 15_000 });
  await programma.locator("[data-dm-prg-apri]").click();
  return programma;
}

const salvate = (page) =>
  page.evaluate(() => window.__CASA__.comandi.filter((m) => m.type === "ponte/automazioni/salva"));
const orari = (programma) =>
  programma.locator("select.dm-prg-ora").evaluateAll((s) => s.map((x) => Number(x.value)));

test("aperta prima che la casa risponda, la finestra mostra il programma salvato e non quello di serie", async ({
  page,
}, testInfo) => {
  const programma = await avvia(page, testInfo);
  /* Finche' la casa non risponde si aspetta: niente programma di serie da
   * toccare (o salvare sopra quello vero). */
  await expect(programma).toContainText(/Leggo il programma/);
  await expect(programma.locator("[data-dm-prg-salva]")).toHaveCount(0);
  /* Poi arriva quello salvato: la sera finisce alle 19 e fuori sono 22°. */
  await expect.poll(() => orari(programma), { timeout: 10_000 }).toEqual([390, 510, 1020, 1140]);
  await expect(programma.locator(".dm-prg-fuori").first()).toContainText("22");
  await expect(programma.locator("[data-dm-prg-attivo]")).toBeVisible();
});

test("salvato, resta com'e' quando la casa rilegge, e il termostato prende subito i gradi di adesso", async ({
  page,
}, testInfo) => {
  const programma = await avvia(page, testInfo, { ritardo: 200 });
  await expect.poll(() => orari(programma), { timeout: 10_000 }).toEqual([390, 510, 1020, 1140]);
  /* La seconda fascia fino alle 20 e fuori un grado in meno. */
  await programma.locator('[data-dm-prg-ora="1:a"]').selectOption("1200");
  for (let i = 0; i < 2; i += 1) await programma.locator('[data-dm-prg-fuori="-0.5"]').click();
  await programma.locator("[data-dm-prg-salva]").click();
  await expect.poll(async () => (await salvate(page)).length).toBe(1);
  const [salvata] = await salvate(page);
  /* Lo stesso programma, non uno nuovo accanto. */
  expect(salvata.automazione_id).toBe("p1");
  expect(salvata.automazione.crono.fuori).toBe(21);
  expect(salvata.automazione.crono.programma.feriali[1]).toEqual({
    da: 1020,
    a: 1200,
    gradi: 20.5,
  });
  await expect(programma.locator(".dm-prg-esito")).toContainText(
    /Salvato in Home Assistant\. Adesso vale/,
  );
  await expect(programma.locator(".dm-prg-esito")).toContainText(/termostato è stato aggiornato/);
  /* La casa rilegge (anche piu' volte): resta quello salvato. */
  await page.evaluate(async () => {
    const { chiediAllaCasa } = await import("/src/sections/automazioni-section.js");
    await chiediAllaCasa({ forza: true });
  });
  await page.waitForTimeout(600);
  expect(await orari(programma)).toEqual([390, 510, 1020, 1200]);
  await expect(programma.locator(".dm-prg-fuori").first()).toContainText("21");
});

test("se Home Assistant non salva, lo dice e le modifiche restano", async ({ page }, testInfo) => {
  const programma = await avvia(page, testInfo, { ritardo: 200, rifiuta: "ponte_automazioni" });
  await expect.poll(() => orari(programma), { timeout: 10_000 }).toEqual([390, 510, 1020, 1140]);
  await programma.locator('[data-dm-prg-fuori="0.5"]').click();
  await programma.locator("[data-dm-prg-salva]").click();
  await expect(programma.locator(".dm-prg-errore")).toContainText(/Non salvato/);
  await expect(programma.locator(".dm-prg-fuori").first()).toContainText("22,5");
});

test.describe("le foto", () => {
  test.use({ deviceScaleFactor: 2 });
  test("le foto del programma che si rilegge: computer e telefono, chiaro e scuro", async ({
    page,
  }, testInfo) => {
    test.skip(!DOVE, "solo per le foto");
    const finestra = page.locator("#clima-popup-overlay .clima-popup");
    const scatta = async (nome) => {
      await page.waitForTimeout(400);
      await finestra.evaluate((n) => (n.scrollTop = n.scrollHeight));
      await page.waitForTimeout(200);
      await finestra.screenshot({ path: `${DOVE}/${nome}.png` });
    };
    for (const [schermo, w, h] of [
      ["computer", 1440, 900],
      ["telefono", 390, 844],
    ])
      for (const tema of ["light", "dark"]) {
        const suf = `${schermo}-${tema === "light" ? "chiaro" : "scuro"}`;
        await page.setViewportSize({ width: w, height: h });
        /* 01: dopo il ricaricamento, quello salvato. */
        let programma = await avvia(page, testInfo, { ritardo: 300, tema });
        await expect
          .poll(() => orari(programma), { timeout: 10_000 })
          .toEqual([390, 510, 1020, 1140]);
        await scatta(`01-programma-salvato-riletto-${suf}`);
        /* 02 e 04: salvato, e il termostato prende i gradi di adesso. */
        await programma.locator('[data-dm-prg-ora="1:a"]').selectOption("1200");
        await programma.locator("[data-dm-prg-salva]").click();
        await expect(programma.locator(".dm-prg-esito")).toBeVisible();
        await scatta(`02-programma-salvato-conferma-${suf}`);
        /* La finestra rilegge il termostato: l'obiettivo e' quello della fascia. */
        await page.evaluate(() => window.apriClimaPopup?.("climate.sala", null));
        await page.waitForTimeout(400);
        await finestra.evaluate((n) => (n.scrollTop = 0));
        await page.waitForTimeout(300);
        await finestra.screenshot({ path: `${DOVE}/04-target-segue-la-fascia-${suf}.png` });
        /* 03: Home Assistant non salva. */
        programma = await avvia(page, testInfo, {
          ritardo: 300,
          tema,
          rifiuta: "ponte_automazioni",
        });
        await expect
          .poll(() => orari(programma), { timeout: 10_000 })
          .toEqual([390, 510, 1020, 1140]);
        await programma.locator('[data-dm-prg-fuori="0.5"]').click();
        await programma.locator("[data-dm-prg-salva]").click();
        await expect(programma.locator(".dm-prg-errore")).toBeVisible();
        await scatta(`03-programma-errore-${suf}`);
      }
  });
});
