/* Le automazioni (Premium), come le vede chi apre la plancia.
 *
 * Le esegue la casa (`ponte/src/automazioni.js`), e le loro regole si provano
 * nel ponte. Qui si guarda la plancia: la voce «Automazioni» del config subito
 * dopo «Azioni», col bollino PREMIUM, e senza Premium col lucchetto e il velo;
 * la lista con «Prossimo» e «Ultime eseguite» che dice la casa; i modelli; un
 * editor che crea e salva in `cd_automazioni`; e nell'app la voce del config
 * che non c'e', con la pagina a schermo pieno aperta dalla maniglia.
 *
 * E le proposte («Suggerite per la tua casa ✨»): il blocco con tre carte,
 * «Vedi tutte», «Crea» che apre l'editor gia' compilato e si salva a mano,
 * «No, grazie» che la toglie e lo dice alla casa, e senza Premium una carta
 * sola sopra il velo.
 *
 * La casa qui e' finta, e risponde a `ponte/automazioni/stato` e alle
 * proposte come il ponte.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
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

const STATI = {
  "light.corridoio": { state: "off", attributes: { friendly_name: "Luce corridoio" } },
  "binary_sensor.pir_corridoio": {
    state: "off",
    attributes: { friendly_name: "Corridoio", device_class: "motion" },
  },
  "binary_sensor.finestra": {
    state: "off",
    attributes: { friendly_name: "Finestra soggiorno", device_class: "window" },
  },
  "climate.soggiorno": {
    state: "heat",
    attributes: { friendly_name: "Termostato soggiorno", hvac_modes: ["off", "heat"] },
  },
  "cover.soggiorno": { state: "open", attributes: { friendly_name: "Tapparelle soggiorno" } },
};

const UNA = {
  id: "a1",
  nome: "",
  attiva: true,
  quando: { tipo: "orario", ore: ["07:15"], giorni: [true, true, true, true, true, false, false] },
  allora: [{ tipo: "tapparella", entita: "cover.soggiorno", modo: "apri" }],
};

/* Le proposte come le manda la casa (`core/automazioni-proposte.js`). */
const PROPOSTE = [
  {
    id: "movimento-luce:binary_sensor.pir_corridoio|light.corridoio",
    gruppo: "dispositivi",
    chiave: "movimentoLuce",
    disegno: "presenza",
    dati: { area: "Corridoio" },
    automazione: {
      attiva: true,
      quando: { tipo: "movimento", entita: ["binary_sensor.pir_corridoio"], verso: "si" },
      soloSe: [{ tipo: "notte", da: "", a: "" }],
      allora: [
        { tipo: "accendi", entita: ["light.corridoio"], livello: 20 },
        { tipo: "aspetta", minuti: 2 },
        { tipo: "spegni", entita: ["light.corridoio"] },
      ],
    },
  },
  {
    id: "finestra-clima:binary_sensor.finestra|climate.soggiorno",
    gruppo: "dispositivi",
    chiave: "finestraClima",
    disegno: "finestra",
    dati: { area: "Soggiorno", finestra: "Finestra soggiorno" },
    automazione: {
      attiva: true,
      quando: { tipo: "stato", entita: ["binary_sensor.finestra"], a: "on", per: 2 },
      allora: [
        { tipo: "clima", entita: ["climate.soggiorno"], modo: "spegni" },
        { tipo: "aspettaChe", entita: "binary_sensor.finestra", stato: "off", massimo: 720 },
        { tipo: "accendi", entita: ["climate.soggiorno"] },
      ],
    },
  },
  {
    id: "elettrodomestico:sensor.lavatrice_potenza",
    gruppo: "dispositivi",
    chiave: "elettrodomestico",
    disegno: "elettrodomestici",
    dati: { nome: "Lavatrice" },
    automazione: {
      attiva: true,
      quando: {
        tipo: "elettrodomestico",
        entita: "sensor.lavatrice_potenza",
        soglia: 5,
        minuti: 3,
      },
      allora: [{ tipo: "notifica", testo: "Lavatrice" }],
    },
  },
  {
    id: "abitudine-accende-feriali:light.corridoio",
    gruppo: "abitudini",
    chiave: "abitudineOrario",
    disegno: "luci",
    dati: {
      nome: "Luce corridoio",
      ora: "19:10",
      festivi: false,
      da: "19:00",
      a: "19:20",
      verso: "accende",
      settimane: 3,
    },
    automazione: {
      attiva: true,
      quando: {
        tipo: "orario",
        ore: ["19:10"],
        giorni: [true, true, true, true, true, false, false],
      },
      allora: [{ tipo: "accendi", entita: ["light.corridoio"] }],
    },
  },
];

async function avvia(
  page,
  testInfo,
  { premium = true, app = false, automazioni = [UNA], proposte = [] } = {},
) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(
    ({ premium, app }) => {
      window.__GDAHOME_PREMIUM__ = premium;
      /* Il segno con cui l'app serve la plancia (`premesse.dart`). */
      if (app)
        document.addEventListener("DOMContentLoaded", () => {
          const foglio = document.createElement("style");
          foglio.id = "gdahome-config-fuori";
          document.head.append(foglio);
        });
    },
    { premium, app },
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    ({ stati, automazioni, proposte }) => {
      localStorage.setItem("cd_automazioni", JSON.stringify(automazioni));
      const grezzi = eval("_RAW_STATES");
      for (const [entity, stato] of Object.entries(stati))
        grezzi[entity] = { entity_id: entity, ...stato };
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...grezzi } };
      /* La casa finta: dice cosa viene dopo e cosa ha fatto. */
      window.__CASA__ = {
        premium: true,
        prossimi: [{ id: "a1", alle: Date.now() + 3_600_000 }],
        ultime: [{ id: "a1", alle: Date.now() - 600_000, esito: "ok" }],
        perAutomazione: { a1: { alle: Date.now() - 600_000, esito: "ok" } },
        inCorso: [],
      };
      window.__PROPOSTE__ = proposte;
      window.__SCARTATE__ = [];
      const vero = window.eval("ws");
      window.__FINTO__ = {
        readyState: 1,
        send(grezzo) {
          const m = JSON.parse(grezzo);
          if (!String(m.type).startsWith("ponte/automazioni/")) return vero?.send?.(grezzo);
          if (m.type === "ponte/automazioni/proposte/scarta") window.__SCARTATE__.push(m.proposta);
          const elenco = () =>
            window.__PROPOSTE__.filter((p) => !window.__SCARTATE__.includes(p.id));
          const risultato =
            m.type === "ponte/automazioni/stato"
              ? window.__CASA__
              : { proposte: elenco(), giorni: 21, abitudiniPronte: true };
          setTimeout(() => {
            const attese = window.eval("pendingWsCallbacks");
            const torna = attese[m.id];
            delete attese[m.id];
            torna?.({ id: m.id, type: "result", success: true, result: risultato });
          }, 10);
        },
      };
      window.eval("ws = window.__FINTO__");
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { stati: STATI, automazioni, proposte },
  );
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
}

async function apriLaVoce(page) {
  await page.evaluate(() => window.apriConfigEntita?.());
  const voce = page.locator('#editor-modal .ed-tab[data-tab="automazioni"]');
  await expect(voce).toHaveCount(1);
  await page.evaluate(() => window.editorSwitch("automazioni"));
  return voce;
}

const salvate = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("cd_automazioni") || "[]"));

test("la voce sta dopo Azioni, col bollino PREMIUM, e la lista dice quello che la casa ha fatto", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  const voce = await apriLaVoce(page);
  await expect(voce.locator(".au-tab-prem")).toHaveText("PREMIUM");
  expect(
    await page.evaluate(
      () => document.querySelector('.ed-tab[data-tab="sez8"]')?.nextElementSibling?.dataset?.tab,
    ),
  ).toBe("automazioni");
  const pagina = page.locator("#ed-body .au-web");
  await expect(pagina.locator(".au-riga")).toHaveCount(1);
  await expect(pagina.locator(".au-riga .au-quando")).toContainText("Alle 07:15");
  await expect(pagina.locator(".au-riga .au-allora")).toContainText("apri Tapparelle soggiorno");
  await expect(pagina.locator(".au-riga .au-ultima")).toContainText("ultima volta: oggi");
  await expect(pagina.locator(".au-box.blu .au-pross b")).toHaveText(/\d\d:\d\d/);
  await expect(pagina.locator(".au-ult i")).toHaveText("✓");
  /* Senza proposte il blocco non c'e'. */
  await expect(pagina.locator(".pro")).toHaveCount(0);
  /* L'interruttore la spegne e la salva, senza aprirla. */
  await pagina.locator('[data-au-attiva="a1"]').click();
  await expect.poll(async () => (await salvate(page))[0]?.attiva).toBe(false);
  await expect(pagina.locator(".au-riga")).toHaveClass(/spenta/);
});

test("dai modelli all'editor: si crea, si legge e si salva", async ({ page }, testInfo) => {
  await avvia(page, testInfo, { automazioni: [] });
  await apriLaVoce(page);
  const pagina = page.locator("#ed-body .au-web");
  await pagina.locator('[data-au-vai="modelli"]').first().click();
  await expect(pagina.locator(".au-mod")).toHaveCount(8);
  await pagina.locator('[data-au-modello="luce"]').click();
  await expect(pagina.locator(".au-blocco.au-q")).toBeVisible();
  await expect(pagina.locator('select[data-au-campo="quando.entita.0"]')).toHaveValue(
    "binary_sensor.pir_corridoio",
  );
  /* La tendina del QUANDO: sette cose, una sola si sceglie. */
  await pagina.locator("[data-au-tendina]").click();
  await expect(pagina.locator(".au-tendina [data-au-quando]")).toHaveCount(7);
  await pagina.locator('.au-tendina [data-au-quando="movimento"]').click();
  /* Notte fra le 23 e le 6, che attraversa la mezzanotte. */
  await pagina.locator('[data-au-campo="soloSe.0.da"]').fill("23:00");
  await pagina.locator('[data-au-campo="soloSe.0.da"]').dispatchEvent("change");
  await pagina.locator('[data-au-campo="soloSe.0.a"]').fill("06:00");
  await pagina.locator('[data-au-campo="soloSe.0.a"]').dispatchEvent("change");
  await pagina.locator('[data-au-testo="nome"]').fill("Luce corridoio di notte");
  await expect(pagina.locator("[data-au-leggi]")).toContainText(
    "quando c'è movimento in Corridoio, solo se di notte (23:00–06:00), accendi Luce corridoio al 30%, aspetta 2 min e spegni Luce corridoio",
  );
  await pagina.locator("[data-au-salva]").click();
  await expect
    .poll(() => salvate(page))
    .toMatchObject([
      {
        nome: "Luce corridoio di notte",
        attiva: true,
        quando: { tipo: "movimento", entita: ["binary_sensor.pir_corridoio"], verso: "si" },
        soloSe: [{ tipo: "notte", da: "23:00", a: "06:00" }],
        allora: [
          { tipo: "accendi", entita: ["light.corridoio"], livello: 30 },
          { tipo: "aspetta", minuti: 2 },
          { tipo: "spegni", entita: ["light.corridoio"] },
        ],
      },
    ]);
  await expect(pagina.locator(".au-riga")).toHaveCount(1);
});

test("il cronotermostato: due temperature e le fasce trascinate", async ({ page }, testInfo) => {
  await avvia(page, testInfo, { automazioni: [] });
  await apriLaVoce(page);
  const pagina = page.locator("#ed-body .au-web");
  await pagina.locator('[data-au-vai="modelli"]').first().click();
  await pagina.locator('[data-au-modello="crono"]').click();
  await expect(pagina.locator('[data-au-barra="feriali"] i')).toHaveCount(48);
  await pagina.locator('[data-au-gradi="inCasa"][data-au-passo="0.5"]').click();
  /* Un tocco sulla mezz'ora di mezzanotte la accende. */
  const barra = pagina.locator('[data-au-barra="festivi"]');
  const box = await barra.boundingBox();
  await page.mouse.click(box.x + 3, box.y + box.height / 2);
  await pagina.locator("[data-au-salva]").click();
  await expect
    .poll(() => salvate(page))
    .toMatchObject([
      {
        tipo: "crono",
        crono: {
          termostati: ["climate.soggiorno"],
          inCasa: 21.5,
          fuori: 18,
          festivi: [
            [0, 30],
            [480, 1320],
          ],
          finestre: ["binary_sensor.finestra"],
        },
      },
    ]);
});

test("senza Premium: la voce col lucchetto e il velo", async ({ page }, testInfo) => {
  await avvia(page, testInfo, { premium: false });
  const voce = await apriLaVoce(page);
  await expect(voce).toHaveClass(/au-chiusa/);
  await expect(voce.locator(".au-lucchetto")).toHaveCount(1);
  const velo = page.locator("#ed-body .au-velo");
  await expect(velo.locator("h3")).toHaveText("Automazioni con Premium");
  await expect(velo.locator("[data-au-scopri]")).toHaveText("Scopri Premium");
  await expect(velo).toContainText("Premium si attiva dall'app gdahome.");
  /* Quello che c'e' sotto non si tocca: resta salvato com'e'. */
  expect((await salvate(page))[0].attiva).toBe(true);
});

test("nell'app la voce del config non c'e', e la pagina si apre a schermo pieno", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { app: true });
  await page.evaluate(() => window.apriConfigEntita?.());
  await expect(page.locator("#editor-modal .ed-tab").first()).toBeVisible();
  await expect(page.locator('#editor-modal .ed-tab[data-tab="automazioni"]')).toHaveCount(0);
  await page.evaluate(() => {
    document.querySelector("#editor-modal .ed-head-close")?.click();
    document.getElementById("editor-modal")?.remove();
  });
  await page.evaluate(() => window.gdahomeApriLeAutomazioni());
  const pagina = page.locator("#page-automazioni");
  await expect(pagina).toHaveClass(/active/);
  await expect(pagina.locator(".au-titolo h1")).toHaveText("Automazioni");
  await expect(pagina.locator(".au-riga")).toHaveCount(1);
  await page.evaluate(() => window.gdahomeTornaDalleAutomazioni());
  await expect(page.locator("#page-automazioni")).toHaveCount(0);
  await expect(page.locator(".page.active")).toHaveCount(1);
});

test("tutta Home Assistant: un evento, un servizio, la ricerca su tutte le entità e le Avanzate", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { automazioni: [] });
  await apriLaVoce(page);
  const pagina = page.locator("#ed-body .au-web");
  await pagina.locator('[data-au-vai="modelli"]').first().click();
  await pagina.locator('[data-au-modello="zero"]').click();
  /* I QUANDO generici stanno dietro «Altro…», chiusi di serie. */
  await pagina.locator("[data-au-tendina]").click();
  await expect(pagina.locator('.au-tendina [data-au-quando="evento"]')).toHaveCount(0);
  await pagina.locator("[data-au-tendina-altro]").click();
  await pagina.locator('.au-tendina [data-au-quando="evento"]').click();
  await pagina.locator('[data-au-testo="quando.evento"]').fill("zha_event");
  await pagina.locator('[data-au-aggiungi="quando.filtroRighe"]').click();
  await pagina.locator('[data-au-testo="quando.filtroRighe.0.0"]').fill("command");
  await pagina.locator('[data-au-testo="quando.filtroRighe.0.1"]').fill("on");
  /* «🔍 Tutte le entità…»: la ricerca del config, su tutta la casa. */
  await pagina.locator('select[data-au-campo="allora.0.entita.0"]').selectOption("__cerca__");
  const ricerca = page.locator("#cd-entpick");
  await expect(ricerca).toBeVisible();
  await page.locator("#cd-ep-search").fill("cover.soggiorno");
  await ricerca.getByText("cover.soggiorno").first().click();
  await expect(ricerca).toHaveCount(0);
  await expect(pagina.locator('[data-au-campo="allora.0.tipo"]')).toHaveValue("accendi");
  /* Il servizio a mano sta nel gruppo «Altro…» delle azioni. */
  await pagina.locator('[data-au-aggiungi="allora"]').click();
  await pagina.locator('[data-au-campo="allora.1.tipo"]').selectOption("servizio");
  await pagina.locator('[data-au-testo="allora.1.servizio"]').fill("notify.notify");
  await pagina.locator('[data-au-testo="allora.1.dati"]').fill('{"message":"Tasto"}');
  /* Le Avanzate sono chiuse di serie. */
  await expect(pagina.locator('[data-au-campo="modo"]')).toHaveCount(0);
  await pagina.locator("[data-au-avanzate]").click();
  await pagina.locator('[data-au-campo="modo"]').selectOption("ignora");
  await pagina.locator('[data-au-campo="pausa"]').selectOption("5");
  await pagina.locator('[data-au-testo="nome"]').fill("Tasto della sala");
  await pagina.locator("[data-au-salva]").click();
  await expect
    .poll(() => salvate(page))
    .toMatchObject([
      {
        nome: "Tasto della sala",
        quando: { tipo: "evento", evento: "zha_event", filtro: { command: "on" } },
        modo: "ignora",
        pausa: 5,
        allora: [
          { tipo: "accendi" },
          { tipo: "servizio", servizio: "notify.notify", dati: { message: "Tasto" } },
        ],
      },
    ]);
  /* Un servizio che apre la casa non si salva: lo si dice. */
  await pagina.locator(".au-riga").first().click();
  await pagina.locator('[data-au-testo="allora.1.servizio"]').fill("lock.unlock");
  await pagina.locator("[data-au-salva]").click();
  await expect(pagina.locator(".au-errore")).toContainText("Questo servizio la casa non lo chiama");
});

test("le proposte: il blocco con tre carte, Vedi tutte e «No, grazie»", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { proposte: PROPOSTE });
  await apriLaVoce(page);
  const pagina = page.locator("#ed-body .au-web");
  const blocco = pagina.locator(".pro");
  await expect(blocco.locator(".pro-testa h3")).toHaveText("Suggerite per la tua casa ✨");
  await expect(blocco.locator(".pro-carta")).toHaveCount(3);
  await expect(blocco.locator(".pro-carta").first().locator(".pro-q")).toHaveText(
    "Quando c'è movimento in Corridoio di notte",
  );
  await expect(blocco.locator(".pro-carta").first().locator(".pro-a")).toContainText(
    "accendi Luce corridoio al 20%, spegni dopo 2 min",
  );
  await expect(blocco.locator(".pro-carta").first().locator(".pro-perche")).toContainText(
    "in Corridoio ci sono un sensore di movimento e una luce.",
  );
  /* Il blocco sta fra la casa e «Le tue automazioni». */
  expect(
    await pagina.evaluate((au) => au.querySelector(".pro").nextElementSibling?.className),
  ).toContain("au-testa");

  await blocco.locator(".pro-tutte").click();
  await expect(blocco.locator(".pro-tutte")).toHaveCount(0);
  await expect(page.locator("#ed-body .dm-alberatura-titolo-nome")).toHaveText(
    "Proposte per la tua casa",
  );
  const gruppi = pagina.locator(".pro-gruppo");
  await expect(gruppi).toHaveCount(2);
  await expect(gruppi.nth(0)).toContainText("Dai tuoi dispositivi");
  await expect(gruppi.nth(0)).toContainText("· 3");
  await expect(gruppi.nth(1)).toContainText("Dalle tue abitudini");
  await expect(gruppi.nth(1)).toContainText("ultime 3 settimane");
  await expect(pagina.locator(".pro-elenco .au-riga")).toHaveCount(4);
  await expect(pagina.locator(".pro-elenco .au-riga").nth(3)).toContainText(
    "Alle 19:10 nei giorni feriali",
  );
  await expect(pagina.locator(".pro-fondo")).toContainText("niente esce di casa");

  /* «No, grazie»: sparisce, e la casa lo sa. */
  await pagina.locator('[data-au-scarta="elettrodomestico:sensor.lavatrice_potenza"]').click();
  await expect(pagina.locator(".pro-elenco .au-riga")).toHaveCount(3);
  expect(await page.evaluate(() => window.__SCARTATE__)).toEqual([
    "elettrodomestico:sensor.lavatrice_potenza",
  ]);
  await pagina.locator('.au-indietro[data-au-vai="lista"]').click();
  await expect(pagina.locator(".pro-tutte")).toHaveText("Vedi tutte (3) ›");
});

test("le proposte: «Crea» apre l'editor gia' compilato, e solo Salva la scrive", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { automazioni: [], proposte: PROPOSTE });
  await apriLaVoce(page);
  const pagina = page.locator("#ed-body .au-web");
  await pagina.locator(".pro-carta").first().locator("[data-au-crea]").click();
  await expect(pagina.locator(".pro-etichetta .pro-pill")).toHaveText("Proposta ✨");
  await expect(pagina.locator(".pro-etichetta")).toContainText("finché non salvi non parte niente");
  await expect(pagina.locator(".au-indietro")).toHaveText("‹ Automazioni");
  await expect(pagina.locator('[data-au-testo="nome"]')).toHaveValue(
    "Luce col movimento in Corridoio",
  );
  await expect(pagina.locator('select[data-au-campo="quando.entita.0"]')).toHaveValue(
    "binary_sensor.pir_corridoio",
  );
  /* Finche' non si salva, non c'e' niente. */
  expect(await salvate(page)).toEqual([]);
  await pagina.locator("[data-au-salva]").click();
  await expect
    .poll(() => salvate(page))
    .toMatchObject([
      {
        nome: "Luce col movimento in Corridoio",
        quando: { tipo: "movimento", entita: ["binary_sensor.pir_corridoio"] },
        soloSe: [{ tipo: "notte" }],
        allora: [
          { tipo: "accendi", entita: ["light.corridoio"], livello: 20 },
          { tipo: "aspetta", minuti: 2 },
          { tipo: "spegni", entita: ["light.corridoio"] },
        ],
      },
    ]);
  /* Salvata, non e' piu' una proposta. */
  await expect(pagina.locator(".au-riga")).toHaveCount(1);
  await expect(pagina.locator(".pro-tutte")).toHaveText("Vedi tutte (3) ›");
  await expect(
    pagina.locator(
      '[data-au-proposta="movimento-luce:binary_sensor.pir_corridoio|light.corridoio"]',
    ),
  ).toHaveCount(0);
  /* E la lavatrice: l'avviso ha gia' le sue parole. */
  await pagina.locator('[data-au-crea="elettrodomestico:sensor.lavatrice_potenza"]').click();
  await pagina.locator("[data-au-salva]").click();
  await expect
    .poll(async () => (await salvate(page))[1]?.allora?.[0]?.testo)
    .toBe("Lavatrice ha finito");
});

test("le proposte senza Premium: una si legge, le altre sono un numero", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { premium: false, proposte: PROPOSTE });
  await apriLaVoce(page);
  const pagina = page.locator("#ed-body .au-web");
  const blocco = pagina.locator(".pro.pro-senza");
  await expect(blocco.locator(".pro-carta")).toHaveCount(1);
  await expect(blocco.locator(".pro-crea.prem")).toHaveText("✨ Crea con Premium");
  await expect(blocco.locator("[data-au-scarta]")).toHaveCount(0);
  await expect(blocco.locator(".pro-altre")).toContainText(
    "altre 3 proposte pronte: le trovi tutte con Premium",
  );
  /* Sopra il velo, non sotto. */
  await expect(pagina.locator(".au-velato .pro")).toHaveCount(0);
  await blocco.locator(".pro-crea.prem").click();
  await expect(pagina.locator(".au-scopri-di-piu")).toBeVisible();
  expect(await salvate(page)).toHaveLength(1);
});

test("le proposte nell'app: le carte scorrono coi puntini, e Vedi tutte apre la pagina", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { app: true, proposte: PROPOSTE });
  await page.evaluate(() => window.gdahomeApriLeAutomazioni());
  const pagina = page.locator("#page-automazioni");
  await expect(pagina.locator(".pro-carta")).toHaveCount(3);
  await expect(pagina.locator(".pro-punti i")).toHaveCount(3);
  await expect(pagina.locator(".pro-punti i.si")).toHaveCount(1);
  await expect(pagina.locator(".pro-carte")).toHaveCSS("overflow-x", "auto");
  await pagina.locator(".pro-tutte").click();
  await expect(pagina.locator(".au-titolo h1")).toHaveText("Proposte");
  await expect(pagina.locator(".pro-elenco .au-riga")).toHaveCount(4);
  await pagina.locator(".pro-elenco [data-au-crea]").first().click();
  await expect(pagina.locator(".pro-etichetta")).toBeVisible();
  await expect(pagina.locator(".au-indietro")).toHaveText("‹ Automazioni");
});
