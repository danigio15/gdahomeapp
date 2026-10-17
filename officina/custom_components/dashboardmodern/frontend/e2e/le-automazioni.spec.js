/* Le automazioni (Premium), come le vede chi apre la plancia.
 *
 * Le esegue la casa (`ponte/src/automazioni.js`), e le loro regole si provano
 * nel ponte. Qui si guarda la plancia: la voce «Automazioni» del config subito
 * dopo «Azioni», col bollino PREMIUM, e senza Premium col lucchetto e il velo;
 * la lista con «Prossimo» e «Ultime eseguite» che dice la casa; i modelli; un
 * editor che crea e salva in `cd_automazioni`; e nell'app la voce del config
 * che non c'e', con la pagina a schermo pieno aperta dalla maniglia.
 *
 * La casa qui e' finta, e risponde a `ponte/automazioni/stato` come il ponte.
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

async function avvia(page, testInfo, { premium = true, app = false, automazioni = [UNA] } = {}) {
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
    ({ stati, automazioni }) => {
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
      const vero = window.eval("ws");
      window.__FINTO__ = {
        readyState: 1,
        send(grezzo) {
          const m = JSON.parse(grezzo);
          if (m.type !== "ponte/automazioni/stato") return vero?.send?.(grezzo);
          setTimeout(() => {
            const attese = window.eval("pendingWsCallbacks");
            const torna = attese[m.id];
            delete attese[m.id];
            torna?.({ id: m.id, type: "result", success: true, result: window.__CASA__ });
          }, 10);
        },
      };
      window.eval("ws = window.__FINTO__");
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { stati: STATI, automazioni },
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
