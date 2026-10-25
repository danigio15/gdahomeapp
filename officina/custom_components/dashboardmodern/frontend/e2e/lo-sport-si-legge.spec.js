/* Lo sport: la pagina, la tessera e la finestra nella Home, la scheda del
 * Config.
 *
 * Dal campo: «una card di sport dove scegli lo sport da seguire — la tua
 * squadra di calcio, la F1, la MotoGP — e vedi i risultati». I risultati sono
 * quelli veri di un fine settimana di fine ottobre 2026 (`ponte/test/sport/`),
 * messi in forma dallo stesso `ponte/src/sport.js` che gira nell'add-on; il
 * ponte qui e' finto solo nel filo, e risponde quello che risponderebbe lui.
 * Due momenti: la domenica alle 13:10, con Inter-Fiorentina in corso, e il
 * sabato sera, con la partita da giocare domani.
 */
import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import {
  calcioDaEspn,
  f1DaJolpica,
  f1DalVivoDaEspn,
  motoDaPulselive,
  partitaDettaglioDaEspn,
  sessioneF1DaJolpica,
  sessioneMotoDaPulselive,
} from "../../../../../ponte/src/sport.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [{ id: "l1", name: "Cucina", entity: "light.cucina" }],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

const campione = (nome) =>
  JSON.parse(
    readFileSync(new URL(`../../../../../ponte/test/sport/${nome}.json`, import.meta.url)),
  );

const SABATO = Date.parse("2026-10-24T20:00:00Z");
const DOMENICA = Date.parse("2026-10-25T12:10:00Z");
/* Domenica sera: il gran premio degli Stati Uniti e' al giro 36 (ESPN vero). */
const IN_GARA = Date.parse("2026-10-25T21:06:00Z");

const CONFIG = {
  seguiti: [
    { tipo: "calcio", campionato: "ita.1", squadra: "110", nome: "Internazionale" },
    { tipo: "f1", preferito: "leclerc" },
    { tipo: "motogp", preferito: "" },
  ],
};

/* I risultati che il ponte manderebbe a quell'ora. La domenica la partita e'
 * in corso: 2-1 al 67'. */
function risultati(adesso) {
  const prossime = campione("calcio-inter-tutte-prossime");
  const giocate = campione("calcio-inter-tutte");
  if (adesso === DOMENICA) {
    const giorno = campione("calcio-serie-a-giorno");
    const viva = giorno.events.find((e) => e.shortName === "FIO @ INT");
    viva.competitions[0].status = {
      displayClock: "67'",
      type: { name: "STATUS_SECOND_HALF", state: "in", shortDetail: "67'" },
    };
    for (const c of viva.competitions[0].competitors) c.score = c.homeAway === "home" ? "2" : "1";
    giocate.events.push(viva);
    prossime.events = prossime.events.filter((e) => String(e.id) !== String(viva.id));
  }
  const inter = calcioDaEspn({
    id: "110",
    campionato: "ita.1",
    giocate,
    prossime,
    classifica: campione("calcio-serie-a-classifica"),
    classificheDelleCoppe: { "uefa.champions": campione("calcio-champions-classifica") },
  });
  const f1 = f1DaJolpica({
    gara: campione("f1-ultima-gara"),
    sprint: campione("f1-sprint"),
    calendario: campione("f1-calendario"),
    piloti: campione("f1-piloti"),
    costruttori: campione("f1-costruttori"),
    adesso,
  });
  if (adesso === IN_GARA) f1.dalVivo = f1DalVivoDaEspn(campione("f1-dal-vivo"), f1.piloti);
  const eventi = campione("moto-eventi");
  const moto = motoDaPulselive({
    eventi,
    eventoGara: eventi.find((e) => e.country?.iso === "AU" && !e.test),
    tipo: "SPR",
    gara: campione("moto-sprint"),
    campionato: campione("moto-classifica"),
    quando: "2026-10-24T05:00:00+00:00",
    sessioniProssime: campione("moto-sessioni"),
    sessioniGara: campione("moto-sessioni"),
    adesso,
  });
  return [inter, f1, moto];
}

/* I dettagli che il ponte manderebbe toccando una partita o una sessione. */
function dettagli() {
  return {
    calcio: partitaDettaglioDaEspn(campione("calcio-partita")),
    Q: sessioneF1DaJolpica(campione("f1-ultime-qualifiche"), "Q"),
    S: sessioneF1DaJolpica(campione("f1-sprint"), "S"),
    G: sessioneF1DaJolpica(campione("f1-ultima-gara"), "G"),
    motogp: sessioneMotoDaPulselive(campione("moto-q2")),
  };
}

/* Gli stemmi veri, se GitHub li ha scaricati (`strumenti/sport-campioni`). */
function stemmi() {
  const fuori = {};
  const cartella = new URL("../../../../../strumenti/sport-campioni/loghi/", import.meta.url);
  for (const r of risultati(SABATO)) {
    if (r.tipo !== "calcio") continue;
    const ids = new Set([
      ...r.classifica.map((x) => x.id),
      ...r.coppe.flatMap((c) => c.classifica.map((x) => x.id)),
      ...Object.values(dettagli().calcio).flatMap((x) => (x?.id ? [x.id] : [])),
      ...[...r.ultime, ...r.prossime].flatMap((p) => [p.casa.id, p.fuori.id]),
    ]);
    for (const id of ids) {
      const file = new URL(`${id}.png`, cartella);
      if (existsSync(file)) fuori[id] = readFileSync(file).toString("base64");
    }
  }
  /* E i simboli delle scuderie di F1, bianchi (`f1:<constructorId>`). */
  const scuderie = new URL("../../../../../strumenti/sport-campioni/scuderie/", import.meta.url);
  for (const id of [
    "mercedes",
    "ferrari",
    "mclaren",
    "red_bull",
    "rb",
    "alpine",
    "haas",
    "audi",
    "williams",
    "aston_martin",
    "cadillac",
  ]) {
    const file = new URL(`${id}-0.webp`, scuderie);
    if (existsSync(file)) fuori[`f1:${id}`] = readFileSync(file).toString("base64");
  }
  return fuori;
}

async function boot(page, testInfo, { adesso, tema = "light" }) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 150_000 : 100_000);
  await page.clock.install({ time: adesso });
  await page.addInitScript(
    ({ risposte, loghi, dettagli }) => {
      window.__sport = { chieste: [], dettagli: [] };
      class MockSocket extends EventTarget {
        static OPEN = 1;
        readyState = 1;
        onopen = null;
        onmessage = null;
        constructor() {
          super();
          queueMicrotask(() => {
            this.onopen?.({});
            this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
          });
        }
        send(raw) {
          const message = JSON.parse(raw);
          if (message.type === "auth") return;
          let result = null;
          let success = true;
          if (message.type === "get_states") result = [];
          else if (message.type === "frontend/get_user_data") result = { value: null };
          else if (message.type === "get_config") result = { latitude: 45.46, longitude: 9.19 };
          else if (message.type === "ponte/sport/risultati") {
            window.__sport.chieste.push(message.seguiti);
            result = { risultati: risposte };
          } else if (message.type === "ponte/sport/squadre") {
            result = {
              squadre: risposte[0].classifica.map(({ id, nome, breve, sigla, colore }) => ({
                id,
                nome,
                breve,
                sigla,
                colore,
              })),
            };
          } else if (message.type === "ponte/sport/dettaglio") {
            const cosa = message.cosa || {};
            window.__sport.dettagli.push(cosa);
            result = {
              dettaglio:
                cosa.tipo === "calcio"
                  ? dettagli.calcio
                  : cosa.tipo === "f1"
                    ? dettagli[cosa.sessione]
                    : dettagli.motogp,
            };
          } else if (message.type === "ponte/sport/logo") {
            (window.__sport.loghi ||= []).push(String(message.squadra));
            const corpo = loghi[String(message.squadra)];
            if (corpo)
              result = {
                stato: 200,
                tipo: String(message.squadra).startsWith("f1:") ? "image/webp" : "image/png",
                corpo,
              };
            else {
              success = false;
              result = null;
            }
          }
          setTimeout(() => {
            this.onmessage?.({
              data: JSON.stringify(
                success
                  ? { id: message.id, type: "result", success: true, result }
                  : {
                      id: message.id,
                      type: "result",
                      success: false,
                      error: { code: "not_found" },
                    },
              ),
            });
          }, 10);
        }
        close() {}
      }
      window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
      window.WebSocket = MockSocket;
    },
    { risposte: risultati(adesso), loghi: stemmi(), dettagli: dettagli() },
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60_000,
  });
  /* Il velo della plancia aspetta che il tempo passi: con l'orologio finto
   * si aspetta che se ne vada davvero, prima di guardare. */
  await expect(page.locator("#cd-boot-overlay")).toHaveCount(0, { timeout: 30_000 });
  await page.evaluate(
    ({ config, tema }) => {
      document.documentElement.setAttribute("data-theme", tema);
      _RAW_STATES["light.cucina"] = {
        entity_id: "light.cucina",
        state: "off",
        attributes: { friendly_name: "Cucina" },
      };
      localStorage.setItem("cd_sport", JSON.stringify(config));
      window.render?.();
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
    },
    { config: CONFIG, tema },
  );
}

/* La pagina intera: la plancia scorre dentro di se', e la foto «a pagina
 * intera» del browser si ferma allo schermo. Si allunga lo schermo quanto la
 * pagina, si fotografa, e si torna come prima. */
async function fotoDellaPagina(page, dove) {
  if (!dove) return;
  const prima = page.viewportSize();
  const alta = await page.evaluate(() => {
    const pagina = document.getElementById("page-sport");
    const sopra = pagina.getBoundingClientRect().top + window.scrollY;
    return Math.ceil(sopra + pagina.scrollHeight + 140);
  });
  await page.setViewportSize({ width: prima.width, height: Math.max(prima.height, alta) });
  await page.waitForTimeout(400);
  await page.screenshot({ path: dove, animations: "disabled" });
  await page.setViewportSize(prima);
}

const foto = (testInfo, nome) =>
  process.env.DM_FOTO ? `${process.env.DM_FOTO}/${nome}-${testInfo.project.name}.png` : null;

async function apriLoSport(page) {
  const voce = page.locator('.tab[data-tab="sport"]');
  await expect(voce).toHaveCount(1, { timeout: 20_000 });
  await voce.evaluate((n) => n.click());
  await expect(page.locator("#page-sport .dm-sport-blocco")).toHaveCount(3, { timeout: 20_000 });
}

for (const tema of ["light", "dark"]) {
  test(`domenica, partita in corso: la pagina Sport (${tema})`, async ({ page }, testInfo) => {
    await boot(page, testInfo, { adesso: DOMENICA, tema });
    await apriLoSport(page);
    const pagina = page.locator("#page-sport");
    /* La partita in grande e' quella in corso, col minuto. */
    await expect(pagina.locator('[data-dm-sport-partita="dal-vivo"] .dm-sport-gol')).toContainText(
      "2",
    );
    await expect(pagina.locator("[data-dm-sport-live]")).toContainText("67'");
    /* La F1: il gran premio di oggi, il podio di Singapore, la classifica. */
    const f1 = pagina.locator('[data-dm-sport-blocco="f1"]');
    await expect(f1).toContainText("United States");
    await expect(f1.locator(".dm-sport-gradino")).toHaveCount(3);
    /* Il simbolo di ogni scuderia, bianco sul suo colore: nel podio e nei
     * costruttori. */
    await expect(f1.locator(".dm-sport-gradino .dm-sport-scud img")).toHaveCount(3, {
      timeout: 10_000,
    });
    await expect(f1.locator(".dm-sport-scud img").first()).toHaveAttribute("src", /^(data|blob):/);
    const chiesti = await page.evaluate(() => window.__sport.loghi || []);
    expect(chiesti.some((x) => x === "f1:mercedes")).toBe(true);
    /* Al ponte vanno solo le scelte: niente nomi, niente pilota del cuore. */
    const chieste = await page.evaluate(() => window.__sport.chieste[0]);
    expect(chieste).toEqual([
      { tipo: "calcio", campionato: "ita.1", squadra: "110" },
      { tipo: "f1" },
      { tipo: "motogp" },
    ]);
    await fotoDellaPagina(page, foto(testInfo, `sport-pagina-domenica-${tema}`));
  });
}

test("sabato sera: la prossima partita col conto alla rovescia, la tessera e la finestra in Home", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo, { adesso: SABATO });
  await apriLoSport(page);
  const pagina = page.locator("#page-sport");
  await expect(pagina.locator('[data-dm-sport-partita="prossima"]').first()).toContainText(
    "Fiorentina",
  );
  await expect(pagina.locator(".dm-sport-manca").first()).toContainText("tra");
  await fotoDellaPagina(page, foto(testInfo, "sport-pagina-sabato"));
  /* In Home: alle 22 di sabato la cosa che conta sono le qualifiche di Austin,
   * fra un'ora. */
  await page.locator('.tab[data-tab="home"]').evaluate((n) => n.click());
  const tessera = page.locator('#dm-widgets .dm-tile[data-dm-widget="sport"]');
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  await expect(tessera).toContainText("Qualifiche");
  const doveTessera = foto(testInfo, "sport-tessera");
  if (doveTessera)
    await page.locator("#dm-widgets").screenshot({ path: doveTessera, animations: "disabled" });
  await tessera.click();
  const finestra = page.locator("#dm-widget-popup");
  await expect(finestra.locator(".dm-sport-finestra .dm-sport-blocco")).toHaveCount(3);
  const doveFinestra = foto(testInfo, "sport-finestra");
  if (doveFinestra) {
    await page.waitForTimeout(300);
    await finestra.screenshot({ path: doveFinestra, animations: "disabled" });
  }
});

for (const tema of ["light", "dark"]) {
  test(`gara in corso: l'ordine dal vivo, il giro, tutto l'ordine, la Home (${tema})`, async ({
    page,
  }, testInfo) => {
    await boot(page, testInfo, { adesso: IN_GARA, tema });
    await apriLoSport(page);
    const f1 = page.locator('#page-sport [data-dm-sport-blocco="f1"]');
    const vivo = f1.locator("[data-dm-sport-dal-vivo]");
    await expect(vivo).toContainText("Giro 36");
    await expect(vivo.locator(".dm-sport-vivo > li.dm-sport-pos")).toHaveCount(10);
    await expect(vivo.locator(".dm-sport-vivo > li").first()).toContainText("Antonelli");
    /* Leclerc e' il pilota del cuore: la sua riga si vede. */
    await expect(vivo.locator(".dm-sport-vivo > li.mia")).toContainText("Leclerc");
    /* Nell'elenco delle sessioni la gara dice «In diretta», non l'ora. */
    await expect(f1.locator(".dm-sport-sessioni li.in-corso")).toContainText("In diretta");
    await fotoDellaPagina(page, foto(testInfo, `sport-in-gara-${tema}`));
    await vivo.locator(".dm-sport-tutta").click();
    const foglio = page.locator(".dm-foglio-scelta");
    await expect(foglio.locator("li.dm-sport-pos")).toHaveCount(22);
    const doveFoglio = foto(testInfo, `sport-in-gara-ordine-${tema}`);
    if (doveFoglio) {
      await page.waitForTimeout(300);
      await page.screenshot({ path: doveFoglio, animations: "disabled" });
    }
    await page.keyboard.press("Escape");
    /* In Home la tessera dice chi e' in testa e a che giro. */
    await page.locator('.tab[data-tab="home"]').evaluate((n) => n.click());
    const tessera = page.locator('#dm-widgets .dm-tile[data-dm-widget="sport"]');
    await expect(tessera).toContainText("Antonelli", { timeout: 20_000 });
    await expect(tessera).toContainText("Giro 36");
    await tessera.click();
    const finestra = page.locator("#dm-widget-popup");
    await expect(finestra.locator("[data-dm-sport-dal-vivo] .dm-sport-vivo > li")).toHaveCount(5);
    const doveFinestra = foto(testInfo, `sport-in-gara-finestra-${tema}`);
    if (doveFinestra) {
      await page.waitForTimeout(300);
      await finestra.screenshot({ path: doveFinestra, animations: "disabled" });
    }
  });
}

test("la scheda Sport del Config: cosa si segue, il pilota del cuore, aggiungere una squadra", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo, { adesso: SABATO });
  /* I risultati servono al pilota del cuore: si apre prima la pagina. */
  await apriLoSport(page);
  await page.evaluate(() => window.apriConfigEntita?.());
  await page.evaluate(() => window.editorSwitch?.("sport"));
  const corpo = page.locator("#ed-body .dm-sport-ed");
  await expect(corpo).toBeVisible({ timeout: 20_000 });
  await expect(corpo.locator(".dm-sport-ed-voce")).toHaveCount(3);
  await expect(corpo.locator('[data-dm-sport-preferito="1"]')).toHaveValue("leclerc");
  /* La F1 e la MotoGP ci sono gia': i loro tasti sono spenti. */
  await expect(corpo.locator('[data-dm-sport-aggiungi="f1"]')).toBeDisabled();
  await corpo.locator("[data-dm-sport-nuova]").click();
  const squadra = page.locator("#ed-body [data-dm-sport-squadra]");
  await expect(squadra).toBeVisible({ timeout: 10_000 });
  const dove = foto(testInfo, "sport-config");
  if (dove) await page.locator("#ed-body").screenshot({ path: dove, animations: "disabled" });
  /* Si aggiunge il Milan: entra in fondo, col suo nome. */
  await squadra.selectOption({ label: "AC Milan" });
  await expect(page.locator("#ed-body .dm-sport-ed-voce")).toHaveCount(4);
  const salvato = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_sport")));
  expect(salvato.seguiti.at(-1)).toMatchObject({
    tipo: "calcio",
    campionato: "ita.1",
    nome: "AC Milan",
  });
});

/* Il foglio del dettaglio, da solo: la sua scheda. */
async function fotoDelFoglio(page, dove) {
  if (!dove) return;
  await page.waitForTimeout(300);
  const box = await page.locator("#dm-sport-dettaglio .dm-foglio-scelta-scheda").boundingBox();
  await page.screenshot({ path: dove, clip: box, animations: "disabled" });
}

/* Un pezzo della pagina: lo schermo si allunga quanto la pagina, come per la
 * foto intera, e si ritaglia il pezzo. */
async function fotoDiUnPezzo(page, pezzo, dove) {
  if (!dove) return;
  const prima = page.viewportSize();
  const alta = await page.evaluate(() => {
    const pagina = document.getElementById("page-sport");
    const sopra = pagina.getBoundingClientRect().top + window.scrollY;
    return Math.ceil(sopra + pagina.scrollHeight + 140);
  });
  await page.setViewportSize({ width: prima.width, height: Math.max(prima.height, alta) });
  await page.waitForTimeout(400);
  const box = await pezzo.boundingBox();
  await page.screenshot({ path: dove, clip: box, animations: "disabled" });
  await page.setViewportSize(prima);
}

for (const tema of ["light", "dark"]) {
  test(`toccando: chi ha segnato, le formazioni, le statistiche, la qualifica (${tema})`, async ({
    page,
  }, testInfo) => {
    await boot(page, testInfo, { adesso: DOMENICA, tema });
    await apriLoSport(page);
    const pagina = page.locator("#page-sport");
    /* Un'ultima partita: si apre il foglio con la cronaca. */
    await pagina
      .locator(".dm-sport-calcio > .dm-sport-scheda .dm-sport-riga.dm-sport-tocca")
      .first()
      .click();
    const foglio = page.locator("#dm-sport-dettaglio");
    await expect(foglio.locator(".dm-sport-cronaca li").first()).toBeVisible({ timeout: 10_000 });
    const chiesto = await page.evaluate(() => window.__sport.dettagli.at(-1));
    expect(chiesto.tipo).toBe("calcio");
    expect(chiesto.lega).toMatch(/^[a-z]/);
    expect(chiesto.id).toMatch(/^\d+$/);
    await fotoDelFoglio(page, foto(testInfo, `sport-partita-cronaca-${tema}`));
    await foglio.locator('[data-dm-sport-linguetta="statistiche"]').click();
    await expect(foglio.locator('[data-dm-sport-parte="statistiche"]')).toBeVisible();
    await expect(foglio.locator('[data-dm-sport-parte="cronaca"]')).toBeHidden();
    await fotoDelFoglio(page, foto(testInfo, `sport-partita-statistiche-${tema}`));
    await foglio.locator('[data-dm-sport-linguetta="formazioni"]').click();
    await expect(foglio.locator(".dm-sport-formazione")).toHaveCount(2);
    await fotoDelFoglio(page, foto(testInfo, `sport-partita-formazioni-${tema}`));
    await page.keyboard.press("Escape");
    await expect(foglio).toHaveCount(0);
    /* Le qualifiche di Austin, gia' corse: i tre turni. */
    const f1 = pagina.locator('[data-dm-sport-blocco="f1"]');
    await f1.locator(".dm-sport-sessioni li.dm-sport-tocca", { hasText: "Qualifiche" }).click();
    await expect(foglio.locator(".dm-sport-tabella .dm-sport-pos")).toHaveCount(22, {
      timeout: 10_000,
    });
    expect(await page.evaluate(() => window.__sport.dettagli.at(-1))).toMatchObject({
      tipo: "f1",
      sessione: "Q",
    });
    await fotoDelFoglio(page, foto(testInfo, `sport-qualifiche-${tema}`));
    await page.keyboard.press("Escape");
    /* La MotoGP: la Q2 dell'ultimo fine settimana. */
    const moto = pagina.locator('[data-dm-sport-blocco="motogp"]');
    await moto.locator(".dm-sport-scheda-tasto", { hasText: "Qualifica 2" }).click();
    await expect(foglio.locator(".dm-sport-tabella .dm-sport-pos").first()).toBeVisible({
      timeout: 10_000,
    });
    await fotoDelFoglio(page, foto(testInfo, `sport-motogp-q2-${tema}`));
    await page.keyboard.press("Escape");
  });
}

test("la Champions: il suo blocco, la classifica della fase campionato, la classifica intera", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo, { adesso: SABATO });
  await apriLoSport(page);
  const coppa = page.locator('#page-sport [data-dm-sport-coppa="uefa.champions"]');
  await expect(coppa).toBeVisible({ timeout: 20_000 });
  await expect(coppa).toContainText("Champions League");
  await expect(coppa.locator(".dm-sport-pos.mia")).toHaveCount(1);
  const dove = foto(testInfo, "sport-champions");
  await fotoDiUnPezzo(page, coppa, dove);
  /* La classifica intera, con le zone. */
  await coppa.locator(".dm-sport-scheda.dm-sport-tocca", { hasText: "Fase campionato" }).click();
  const foglio = page.locator("#dm-sport-dettaglio");
  await expect(foglio.locator(".dm-sport-pos")).toHaveCount(36);
  await expect(foglio.locator(".dm-sport-legenda")).toContainText("Ottavi");
  await fotoDelFoglio(page, foto(testInfo, "sport-champions-classifica"));
});
