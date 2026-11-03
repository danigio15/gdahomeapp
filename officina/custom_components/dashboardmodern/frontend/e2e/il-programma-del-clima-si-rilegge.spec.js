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
  {
    ritardo = 1500,
    rifiuta = "",
    tema = "",
    salvato = SALVATO,
    ricarica = true,
    rifiutaStato = false,
    illeggibile = false,
    finestraAperta = false,
    altrui = false,
    spegne = false,
  } = {},
) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    window.__GDAHOME_PREMIUM__ = true;
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    async ({
      tema,
      ritardo,
      rifiuta,
      salvato,
      ricarica,
      rifiutaStato,
      illeggibile,
      finestraAperta,
      altrui,
      spegne,
    }) => {
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
      /* `ricarica`: se Home Assistant ricarica l'automazione appena scritta
       * (il ponte lo dice con `confermata`). Se no, la casa continua a dire
       * quella di prima, e nessuno la fa scattare. */
      const casa = { config: {}, comandi: [], ritardo, ricarica, rifiutaStato };
      grezzi["binary_sensor.finestra_sala"] = {
        entity_id: "binary_sensor.finestra_sala",
        state: finestraAperta ? "on" : "off",
        attributes: { friendly_name: "Finestra sala", device_class: "window" },
      };
      if (salvato)
        casa.config.p1 = HA.inHomeAssistant(
          { id: "p1", nome: "Programma Sala", attiva: true, tipo: "crono", crono: salvato },
          { stati: grezzi },
        );
      window.__CASA__ = casa;
      const elenco = () => [
        ...Object.entries(casa.config).map(([id, config]) => ({
          entity_id: `automation.${id}`,
          id,
          nome: config.alias,
          attiva: true,
          modello: HA.dallaHomeAssistant(config, { stati: grezzi }),
          modificabile: true,
          climi: ["climate.sala"],
          programma: true,
          config,
        })),
        /* Il programma della sala toccato a mano in Home Assistant: e'
         * nostro, comanda la sala, ma la plancia non lo sa piu' leggere. */
        ...(illeggibile && !casa.config.p7
          ? [
              {
                entity_id: "automation.p7",
                id: "p7",
                nome: "Programma Sala",
                attiva: true,
                modello: null,
                modificabile: true,
                climi: ["climate.sala"],
                programma: true,
              },
            ]
          : []),
        /* Un programma di chi abita: alle 6:30 21 gradi. Programma la sala. */
        ...(altrui
          ? [
              {
                entity_id: "automation.z1",
                id: "z1",
                nome: "Mattina calda",
                attiva: true,
                modello: null,
                modificabile: true,
                climi: ["climate.sala"],
                climiAOrario: ["climate.sala"],
                programma: false,
              },
            ]
          : []),
        /* «Spegni tutto alle 23»: tocca la sala, non la programma. */
        ...(spegne
          ? [
              {
                entity_id: "automation.z2",
                id: "z2",
                nome: "Spegni tutto alle 23",
                attiva: true,
                modello: null,
                modificabile: true,
                climi: ["climate.sala"],
                climiAOrario: [],
                programma: false,
              },
            ]
          : []),
      ];
      const risposta = (m) => {
        casa.comandi.push(m);
        if (m.type === "ponte/automazioni/stato" && casa.rifiutaStato)
          return { errore: "ponte_automazioni" };
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
          const id = m.automazione_id || m.automazione?.id || "p9";
          const scritta = HA.inHomeAssistant({ ...m.automazione, id }, { stati: grezzi });
          casa.scritte = { ...(casa.scritte || {}), [id]: scritta };
          if (!casa.ricarica)
            return {
              id,
              alias: scritta.alias,
              entity_id: `automation.${id}`,
              applicato: false,
              confermata: false,
            };
          casa.config[id] = scritta;
          /* Il ponte fa decidere subito il programma: i gradi di adesso. */
          grezzi["climate.sala"].attributes.temperature = window.__GRADI_ADESSO__?.(m) ?? 19;
          return {
            id,
            alias: casa.config[id].alias,
            entity_id: `automation.${id}`,
            applicato: true,
            confermata: true,
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
    {
      tema,
      ritardo,
      rifiuta,
      salvato,
      ricarica,
      rifiutaStato,
      illeggibile,
      finestraAperta,
      altrui,
      spegne,
    },
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

/* Il programma del video: la sera dalle 17:00 alle 22:30. */
const DEL_VIDEO = {
  termostati: ["climate.sala"],
  fuori: 17,
  programma: {
    feriali: [
      { da: 390, a: 510, gradi: 21 },
      { da: 1020, a: 1350, gradi: 20.5 },
    ],
    festivi: [{ da: 480, a: 1380, gradi: 20.5 }],
  },
};

test("la sera dalle 17 alle 20, come nel video: ricaricata la pagina parte alle 20, stesso programma", async ({
  page,
}, testInfo) => {
  let programma = await avvia(page, testInfo, { ritardo: 200, salvato: DEL_VIDEO });
  await expect.poll(() => orari(programma), { timeout: 10_000 }).toEqual([390, 510, 1020, 1350]);
  await programma.locator('[data-dm-prg-ora="1:da"]').selectOption("1200");
  await programma.locator("[data-dm-prg-salva]").click();
  await expect(programma.locator(".dm-prg-esito")).toContainText(/termostato è stato aggiornato/);
  const [salvata] = await salvate(page);
  expect(salvata.automazione_id).toBe("p1");
  const crono = await page.evaluate(() => window.__CASA__.scritte.p1.variables.gdahome_crono);
  /* La seconda partenza della plancia: la pagina ricaricata legge da Home
   * Assistant quello che il ponte ha scritto (la catena vera e' in
   * `ponte/test/il-programma-del-clima-col-ponte-vero.test.js`). */
  programma = await avvia(page, testInfo, { ritardo: 600, salvato: crono });
  await expect(programma).toContainText(/Leggo il programma/);
  await expect.poll(() => orari(programma), { timeout: 10_000 }).toEqual([390, 510, 1200, 1350]);
  /* Uno solo, lo stesso: nessun «altro programma» accanto. */
  expect(await page.evaluate(() => Object.keys(window.__CASA__.config))).toEqual(["p1"]);
  await expect(programma).not.toContainText(/altr[oi] (programm|\d)/);
});

test("salvato ma non ancora ricaricato da Home Assistant: non dice «aggiornato», e le modifiche restano", async ({
  page,
}, testInfo) => {
  const programma = await avvia(page, testInfo, { ritardo: 200, ricarica: false });
  await expect.poll(() => orari(programma), { timeout: 10_000 }).toEqual([390, 510, 1020, 1140]);
  await programma.locator('[data-dm-prg-ora="1:a"]').selectOption("1200");
  await programma.locator("[data-dm-prg-salva]").click();
  const esito = programma.locator(".dm-prg-esito");
  await expect(esito).toContainText(/non l'ha ancora ricaricato/);
  await expect(esito).not.toContainText(/aggiornato/);
  /* Non e' il verde del «fatto»: e' un'attesa. */
  await expect(esito).toHaveClass(/dm-prg-esito-attesa/);
  /* La casa rilegge e dice ancora quella di prima: si tiene quella salvata. */
  await page.evaluate(async () => {
    const { chiediAllaCasa } = await import("/src/sections/automazioni-section.js");
    await chiediAllaCasa({ forza: true });
  });
  await page.waitForTimeout(600);
  expect(await orari(programma)).toEqual([390, 510, 1020, 1200]);
});

test("se Home Assistant non salva, lo dice e le modifiche restano", async ({ page }, testInfo) => {
  const programma = await avvia(page, testInfo, { ritardo: 200, rifiuta: "ponte_automazioni" });
  await expect.poll(() => orari(programma), { timeout: 10_000 }).toEqual([390, 510, 1020, 1140]);
  await programma.locator('[data-dm-prg-fuori="0.5"]').click();
  await programma.locator("[data-dm-prg-salva]").click();
  await expect(programma.locator(".dm-prg-errore")).toContainText(/Non salvato/);
  await expect(programma.locator(".dm-prg-fuori").first()).toContainText("22,5");
});

test("la casa non risponde: lo dice, «Riprova» rilegge, e il programma arriva", async ({
  page,
}, testInfo) => {
  const programma = await avvia(page, testInfo, { ritardo: 200, rifiutaStato: true });
  await expect(programma.locator("[data-dm-prg-riprova]")).toBeVisible({ timeout: 10_000 });
  await expect(programma).toContainText(/Non riesco a leggere il programma/);
  await expect(programma).not.toContainText(/Leggo il programma/);
  await expect(programma.locator("[data-dm-prg-salva]")).toHaveCount(0);
  const proposte = () =>
    page.evaluate(
      () => window.__CASA__.comandi.filter((m) => m.type === "ponte/automazioni/proposte").length,
    );
  const propostePrima = await proposte();
  await page.evaluate(() => (window.__CASA__.rifiutaStato = false));
  await programma.locator("[data-dm-prg-riprova]").click();
  await expect.poll(() => orari(programma), { timeout: 10_000 }).toEqual([390, 510, 1020, 1140]);
  /* Riprovare rilegge solo l'elenco: le proposte non c'entrano. */
  expect(await proposte()).toBe(propostePrima);
});

test("chiusa la finestra mentre la casa non risponde, il nuovo tentativo non parte piu'", async ({
  page,
}, testInfo) => {
  const programma = await avvia(page, testInfo, { ritardo: 200, rifiutaStato: true });
  await expect(programma.locator("[data-dm-prg-riprova]")).toBeVisible({ timeout: 10_000 });
  const stato = () =>
    page.evaluate(
      () => window.__CASA__.comandi.filter((m) => m.type === "ponte/automazioni/stato").length,
    );
  await page.evaluate(() =>
    window.chiudiClimaPopup?.({ target: document.getElementById("clima-popup-overlay") }),
  );
  const dopo = await stato();
  await page.waitForTimeout(6500);
  expect(await stato()).toBe(dopo);
});

test("un programma della sala che non si legge piu': niente programma di serie, si sceglie", async ({
  page,
}, testInfo) => {
  const programma = await avvia(page, testInfo, { ritardo: 200, salvato: null, illeggibile: true });
  await expect(programma).toContainText(/qui non si legge più/, {
    timeout: 10_000,
  });
  /* Il programma di serie non si mostra come se fosse quello vero. */
  await expect(programma.locator("select.dm-prg-ora")).toHaveCount(0);
  await expect(programma.locator("[data-dm-prg-salva]")).toHaveCount(0);
  await programma.locator('[data-dm-prg-scelta="rifai"]').click();
  await expect(programma).toContainText(/viene sostituito da questo/);
  await programma.locator("[data-dm-prg-salva]").click();
  await expect.poll(async () => (await salvate(page)).length).toBe(1);
  const [salvata] = await salvate(page);
  /* Sopra quello, con lo stesso id: non un secondo programma accanto. */
  expect(salvata.automazione_id).toBe("p7");
  expect(salvata.sovrascrivi).toBe(true);
});

test("«Crea comunque»: dopo il salvataggio si vede l'esito, l'avviso non torna, e risalvando e' lo stesso programma", async ({
  page,
}, testInfo) => {
  /* La casa non ha ancora ricaricato: l'elenco non lo dice ancora. */
  const programma = await avvia(page, testInfo, {
    ritardo: 200,
    salvato: null,
    altrui: true,
    ricarica: false,
  });
  const crea = programma.locator('[data-dm-prg-scelta="nuovo"]');
  await expect(crea).toBeVisible({ timeout: 10_000 });
  await crea.click();
  await programma.locator("[data-dm-prg-salva]").click();
  await expect(programma.locator(".dm-prg-esito")).toBeVisible({ timeout: 10_000 });
  await expect(crea).toHaveCount(0);
  /* La casa rilegge e non lo dice ancora: si resta sul programma salvato. */
  await page.evaluate(async () => {
    const { chiediAllaCasa } = await import("/src/sections/automazioni-section.js");
    await chiediAllaCasa({ forza: true });
  });
  await page.waitForTimeout(600);
  await expect(crea).toHaveCount(0);
  await expect(programma.locator("[data-dm-prg-salva]")).toBeVisible();
  /* Si cambia ancora e si risalva: lo stesso id, non un secondo programma. */
  await programma.locator("[data-dm-prg-fuori]").last().click();
  await programma.locator("[data-dm-prg-salva]").click();
  await expect.poll(async () => (await salvate(page)).length, { timeout: 10_000 }).toBe(2);
  const [prima, seconda] = await salvate(page);
  expect(prima.automazione_id).toBe("");
  expect(seconda.automazione_id).toBe(prima.automazione.id);
  expect(seconda.automazione.id).toBe(prima.automazione.id);
});

test("«Spegni tutto alle 23» tocca la sala ma non la blocca: il programma si apre, con una nota", async ({
  page,
}, testInfo) => {
  const programma = await avvia(page, testInfo, { ritardo: 200, spegne: true });
  await expect.poll(() => orari(programma), { timeout: 10_000 }).toEqual([390, 510, 1020, 1140]);
  await expect(programma.locator("[data-dm-prg-scelta]")).toHaveCount(0);
  await expect(programma.locator(".dm-prg-tocca")).toContainText(/un'altra automazione tocca/);
  await expect(programma).not.toContainText(/Toglil/);
  await expect(programma.locator("[data-dm-prg-salva]")).toBeVisible();
});

test("salvato con la finestra aperta: lo dice, e non promette i gradi", async ({
  page,
}, testInfo) => {
  const programma = await avvia(page, testInfo, {
    ritardo: 200,
    finestraAperta: true,
    salvato: { ...SALVATO, finestre: ["binary_sensor.finestra_sala"], finestraSpegne: true },
  });
  await expect.poll(() => orari(programma), { timeout: 10_000 }).toEqual([390, 510, 1020, 1140]);
  await programma.locator('[data-dm-prg-fuori="0.5"]').click();
  await programma.locator("[data-dm-prg-salva]").click();
  await expect(programma.locator(".dm-prg-esito")).toContainText(/finestra aperta/);
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
        /* 05: salvato, Home Assistant non l'ha ancora ricaricato. */
        programma = await avvia(page, testInfo, { ritardo: 300, tema, ricarica: false });
        await expect
          .poll(() => orari(programma), { timeout: 10_000 })
          .toEqual([390, 510, 1020, 1140]);
        await programma.locator('[data-dm-prg-ora="1:a"]').selectOption("1200");
        await programma.locator("[data-dm-prg-salva]").click();
        await expect(programma.locator(".dm-prg-esito")).toContainText(/non l'ha ancora/);
        await scatta(`05-programma-salvato-non-ricaricato-${suf}`);
        /* 06: salvato con la finestra aperta. */
        programma = await avvia(page, testInfo, {
          ritardo: 300,
          tema,
          finestraAperta: true,
          salvato: { ...SALVATO, finestre: ["binary_sensor.finestra_sala"], finestraSpegne: true },
        });
        await expect
          .poll(() => orari(programma), { timeout: 10_000 })
          .toEqual([390, 510, 1020, 1140]);
        await programma.locator('[data-dm-prg-fuori="0.5"]').click();
        await programma.locator("[data-dm-prg-salva]").click();
        await expect(programma.locator(".dm-prg-esito")).toContainText(/finestra aperta/);
        await scatta(`06-programma-finestra-aperta-${suf}`);
        /* 07: la casa non risponde, «Riprova». */
        programma = await avvia(page, testInfo, { ritardo: 300, tema, rifiutaStato: true });
        await expect(programma.locator("[data-dm-prg-riprova]")).toBeVisible({ timeout: 10_000 });
        await scatta(`07-programma-non-letto-riprova-${suf}`);
        /* 08: il programma della sala toccato in Home Assistant. */
        programma = await avvia(page, testInfo, {
          ritardo: 300,
          tema,
          salvato: null,
          illeggibile: true,
        });
        await expect(programma.locator('[data-dm-prg-scelta="rifai"]')).toBeVisible({
          timeout: 10_000,
        });
        await scatta(`08-programma-illeggibile-${suf}`);
        /* 09: «Spegni tutto alle 23» tocca la sala ma non blocca il programma. */
        programma = await avvia(page, testInfo, { ritardo: 300, tema, spegne: true });
        await expect
          .poll(() => orari(programma), { timeout: 10_000 })
          .toEqual([390, 510, 1020, 1140]);
        await expect(programma.locator(".dm-prg-tocca")).toBeVisible();
        await page.waitForTimeout(400);
        await programma.locator(".dm-prg-tocca").scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        await finestra.screenshot({ path: `${DOVE}/09-programma-spegni-alle-23-${suf}.png` });
      }
  });
});
