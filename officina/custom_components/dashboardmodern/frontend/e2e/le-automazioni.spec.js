/* Le automazioni (Premium), come le vede chi apre la plancia.
 *
 * Sono quelle vere di Home Assistant: le esegue lui, e la plancia le
 * racconta, le accende e le spegne, e le scrive passando dal ponte
 * (`ponte/automazioni/salva`), che le traduce con `core/automazioni-ha.js`.
 * Le traduzioni si provano nel ponte; qui si guarda la plancia:
 *
 *  - il config: la voce «Automazioni» dopo «Azioni», col bollino PREMIUM;
 *    tutte quelle di Home Assistant in righe compatte, a gruppi (le categorie
 *    di Home Assistant, Per tipo, Per stanza) che partono chiusi e si
 *    ricordano aperti, la riga in parole al posto di «Avanzata…», la
 *    ricerca, le etichette gdahome e Blueprint, l'interruttore che chiama
 *    `automation.turn_off`; l'editor che salva in Home Assistant e il
 *    «Salvata in Home Assistant ✓»; una semplice che si modifica, una
 *    complessa col riassunto e «Apri in Home Assistant ↗»; «Elimina» con la
 *    conferma; il cronotermostato; i pezzi di tutta Home Assistant; le
 *    proposte; l'invito a convertire quelle della versione di prova;
 *  - la sezione della dashboard: la linguetta subito prima di Config, le tre
 *    tessere, i gruppi per categoria con le righe compatte, «＋ Nuova»,
 *    l'interruttore, il foglio di una riga;
 *  - senza Premium: tutto velato, e «Scopri Premium» che in Home Assistant
 *    apre la finestra «Premium arriva con le app»;
 *  - nell'app: niente linguetta e niente voce del config; la pagina del menu
 *    con la faccia della dashboard, «＋ Nuova» nella barra dei filtri, e il
 *    foglio con «✏️ Modifica».
 *
 * La casa qui e' finta: tiene le configurazioni come Home Assistant e
 * risponde ai comandi del ponte con lo stesso traduttore.
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
  "water_heater.boiler": { state: "eco", attributes: { friendly_name: "Scaldabagno" } },
  "person.persona_1": { state: "home", attributes: { friendly_name: "Persona 1" } },
};

/* Le automazioni di Home Assistant di questa casa: due nate dalla plancia,
 * una scritta a mano, una complessa e una da blueprint. */
const SEGNO = "Creata con la plancia GdAHome. #gdahome";
const HA = {
  1001: {
    id: "1001",
    alias: "Tapparelle mattina",
    description: SEGNO,
    mode: "restart",
    triggers: [{ trigger: "time", at: ["07:15:00"] }],
    conditions: [{ condition: "time", weekday: ["mon", "tue", "wed", "thu", "fri"] }],
    actions: [{ action: "cover.open_cover", target: { entity_id: "cover.soggiorno" } }],
  },
  1002: {
    id: "1002",
    alias: "Luce corridoio di notte",
    description: SEGNO,
    mode: "restart",
    triggers: [
      { trigger: "state", entity_id: "binary_sensor.pir_corridoio", from: "off", to: "on" },
    ],
    conditions: [{ condition: "state", entity_id: "sun.sun", state: "below_horizon" }],
    actions: [
      {
        action: "light.turn_on",
        target: { entity_id: "light.corridoio" },
        data: { brightness_pct: 20 },
      },
      { delay: { minutes: 2 } },
      { action: "light.turn_off", target: { entity_id: "light.corridoio" } },
    ],
  },
  1003: {
    id: "1003",
    alias: "Clima spento con finestra aperta",
    trigger: [{ platform: "state", entity_id: "binary_sensor.finestra", from: "off", to: "on" }],
    action: [{ service: "climate.turn_off", entity_id: "climate.soggiorno" }],
    mode: "single",
  },
  1004: {
    id: "1004",
    alias: "Scaldabagno col sole",
    triggers: [{ trigger: "template", value_template: "{{ now().weekday() < 5 }}" }],
    actions: [
      {
        choose: [
          {
            conditions: [{ condition: "template", value_template: "{{ true }}" }],
            sequence: [
              { action: "water_heater.turn_on", target: { entity_id: "water_heater.boiler" } },
            ],
          },
        ],
        default: [{ action: "notify.notify", data: { message: "acqua" } }],
      },
    ],
  },
  1005: {
    id: "1005",
    alias: "Batterie scariche",
    use_blueprint: { path: "batterie.yaml", input: {} },
  },
};
const AREE = { 1001: "soggiorno", 1002: "corridoio", 1003: "soggiorno" };
const SPENTE = ["1003"];

/* Le categorie che chi abita ha dato in Home Assistant, come le manda il
 * ponte (per nome), e a chi le ha date: le altre sono «Senza categoria». */
const CATEGORIE_HA = [
  { id: "c_clima", nome: "Clima e tapparelle", icona: "mdi:snowflake" },
  { id: "c_luci", nome: "Luci", icona: "mdi:lightbulb" },
];
const CATEGORIA_DI = { 1001: "c_clima", 1002: "c_luci", 1003: "c_clima" };
/* Il riassunto in una riga che il ponte scrive per ognuna
 * (`ponte/src/riassunto-delle-automazioni.js`). */
const RIASSUNTI = {
  1004: {
    it: "Quando una condizione diventa vera · 1 azione",
    en: "When a condition becomes true · 1 action",
  },
  1005: { it: "Da blueprint «Batterie»", en: 'From blueprint "Batterie"' },
};

/* Una proposta come la manda la casa (`core/automazioni-proposte.js`). */
const PROPOSTE = [
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
];

/* I gruppi partono chiusi, e si ricordano quelli aperti. Le prove che non
 * guardano i gruppi li trovano gia' aperti tutti, come se chi guarda li
 * avesse aperti una volta; quelle che li guardano partono da `aperti: []`. */
const TUTTI_APERTI = [
  "categoria:c_clima",
  "categoria:c_luci",
  "categoria:-",
  ...["luci", "clima", "tapparelle", "irrigazione", "sicurezza", "avvisi", "energia", "altre"].map(
    (k) => `tipo:${k}`,
  ),
  "stanza:Corridoio",
  "stanza:Soggiorno",
  "stanza:-",
];

async function avvia(
  page,
  testInfo,
  {
    premium = true,
    app = false,
    configurazioni = HA,
    proposte = [],
    rimaste = [],
    amministra = true,
    aperti = TUTTI_APERTI,
  } = {},
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
    async ({
      stati,
      configurazioni,
      aree,
      spente,
      proposte,
      rimaste,
      amministra,
      categorie,
      categoriaDi,
      riassunti,
      aperti,
    }) => {
      const HA = await import("/src/core/automazioni-ha.js");
      localStorage.setItem("cd_automazioni", JSON.stringify(rimaste));
      if (aperti.length)
        localStorage.setItem("dm_automazioni_gruppi_aperti", JSON.stringify(aperti));
      else localStorage.removeItem("dm_automazioni_gruppi_aperti");
      const grezzi = window.eval("_RAW_STATES");
      const metti = (id, stato) => {
        grezzi[id] = { entity_id: id, ...stato };
        window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), [id]: grezzi[id] } };
      };
      for (const [entity, stato] of Object.entries(stati)) metti(entity, stato);
      const casa = {
        config: structuredClone(configurazioni),
        aree: { ...aree },
        comandi: [],
        servizi: [],
        proposte,
        scartate: [],
      };
      window.__CASA__ = casa;
      const entitaDi = (id) => `automation.a${id}`;
      const mettiLAutomazione = (id) => {
        const c = casa.config[id];
        const prima = grezzi[entitaDi(id)];
        metti(entitaDi(id), {
          state: prima?.state || (spente.includes(id) ? "off" : "on"),
          attributes: {
            id,
            friendly_name: c.alias,
            last_triggered: id === "1001" ? new Date(Date.now() - 600_000).toISOString() : null,
          },
        });
      };
      for (const id of Object.keys(casa.config)) mettiLAutomazione(id);
      const statoDi = (id) => grezzi[id] || null;
      const NOMI = { soggiorno: "Soggiorno", corridoio: "Corridoio" };
      const elenco = () =>
        Object.keys(casa.config).map((id) => {
          const config = casa.config[id];
          const s = grezzi[entitaDi(id)];
          const modello = HA.dallaHomeAssistant(config, { statoDi, stati: grezzi });
          return {
            entity_id: entitaDi(id),
            id,
            nome: config.alias,
            attiva: s?.state === "on",
            ultima: Date.parse(s?.attributes?.last_triggered || "") || null,
            area: NOMI[casa.aree[id]] || "",
            areaId: casa.aree[id] || "",
            categoria: HA.categoriaDi(config, statoDi),
            categoriaHa: categoriaDi[id] || null,
            riassunto: riassunti[id] || { it: config.alias, en: config.alias },
            origine: HA.origineDi(config),
            modello,
            modificabile: true,
            config: amministra ? config : null,
          };
        });
      const risposta = (m) => {
        casa.comandi.push(m);
        if (m.type === "ponte/automazioni/stato")
          return {
            premium: true,
            puoScrivere: amministra,
            automazioni: elenco(),
            aree: [
              { id: "corridoio", nome: "Corridoio" },
              { id: "soggiorno", nome: "Soggiorno" },
            ],
            categorie,
          };
        if (m.type === "ponte/automazioni/salva") {
          const id = m.automazione_id || String(2000 + Object.keys(casa.config).length);
          const config = HA.inHomeAssistant(
            { ...m.automazione, id },
            {
              stati: grezzi,
              descrizione: casa.config[id] ? (casa.config[id].description ?? "") : null,
            },
          );
          casa.config[id] = config;
          mettiLAutomazione(id);
          return { id, alias: config.alias };
        }
        if (m.type === "ponte/automazioni/elimina") {
          delete casa.config[m.automazione_id];
          delete grezzi[entitaDi(m.automazione_id)];
          return { id: m.automazione_id };
        }
        if (m.type === "ponte/automazioni/duplica") {
          const id = String(3000 + Object.keys(casa.config).length);
          casa.config[id] = {
            ...casa.config[m.automazione_id],
            id,
            alias: `${casa.config[m.automazione_id].alias} (copia)`,
          };
          mettiLAutomazione(id);
          return { id, alias: casa.config[id].alias };
        }
        if (m.type === "ponte/automazioni/rinomina") {
          if (m.nome) casa.config[m.automazione_id].alias = m.nome;
          if (m.area !== undefined) casa.aree[m.automazione_id] = m.area;
          return { id: m.automazione_id };
        }
        if (m.type === "ponte/automazioni/proposte/scarta") casa.scartate.push(m.proposta);
        return {
          proposte: casa.proposte.filter((p) => !casa.scartate.includes(p.id)),
          giorni: 21,
          abitudiniPronte: true,
        };
      };
      const vero = window.eval("ws");
      window.__FINTO__ = {
        readyState: 1,
        send(grezzo) {
          const m = JSON.parse(grezzo);
          const nostro = String(m.type).startsWith("ponte/automazioni/");
          const servizio = m.type === "call_service" && m.domain === "automation";
          if (!nostro && !servizio) return vero?.send?.(grezzo);
          let result = null;
          if (servizio) {
            casa.servizi.push({ service: m.service, data: m.service_data || m.target || {} });
            const entita = (m.service_data || m.target || {}).entity_id;
            if (m.service === "turn_on" || m.service === "turn_off")
              metti(entita, {
                ...grezzi[entita],
                state: m.service === "turn_on" ? "on" : "off",
              });
          } else result = risposta(m);
          setTimeout(() => {
            const attese = window.eval("pendingWsCallbacks");
            const torna = attese[m.id];
            delete attese[m.id];
            torna?.({ id: m.id, type: "result", success: true, result });
            window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
          }, 10);
        },
      };
      window.eval("ws = window.__FINTO__");
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    {
      stati: STATI,
      configurazioni,
      aree: AREE,
      spente: SPENTE,
      proposte,
      rimaste,
      amministra,
      categorie: CATEGORIE_HA,
      categoriaDi: CATEGORIA_DI,
      riassunti: RIASSUNTI,
      aperti,
    },
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

const comandi = (page, tipo) =>
  page.evaluate((tipo) => window.__CASA__.comandi.filter((m) => m.type === tipo), tipo);
const servizi = (page) => page.evaluate(() => window.__CASA__.servizi);
const configDi = (page, id) => page.evaluate((id) => window.__CASA__.config[id], id);

/* ── il config ───────────────────────────────────────────────────────────── */

test("il config: tutte quelle di Home Assistant per categoria, le etichette, la ricerca e l'interruttore", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { aperti: [] });
  const voce = await apriLaVoce(page);
  await expect(voce.locator(".au-tab-prem")).toHaveText("PREMIUM");
  expect(
    await page.evaluate(
      () => document.querySelector('.ed-tab[data-tab="sez8"]')?.nextElementSibling?.dataset?.tab,
    ),
  ).toBe("automazioni");
  const pagina = page.locator("#ed-body .au-web");
  await expect(pagina.locator(".ha-barra h3")).toContainText("Le automazioni di casa");
  await expect(pagina.locator(".ha-barra h3 small")).toContainText("5, da Home Assistant");
  /* Per categoria: quelle di Home Assistant per nome, «Senza categoria» in fondo. */
  await expect(pagina.locator('.ha-seg [data-au-per="categoria"]')).toHaveClass(/si/);
  await expect(pagina.locator(".aug-titolo")).toHaveText([
    "Clima e tapparelle",
    "Luci",
    "Senza categoria",
  ]);
  await expect(pagina.locator(".aug-conta")).toHaveText(["1/2", "1/1", "2/2"]);
  /* I gruppi partono chiusi (▸): chi vuole li apre. */
  await expect(pagina.locator(".aug-freccia")).toHaveText(["▸", "▸", "▸"]);
  await expect(pagina.locator(".aug.chiuso")).toHaveCount(3);
  await expect(pagina.locator(".ha-riga")).toHaveCount(0);
  await expect(pagina.locator(".aug-testa").first()).toHaveAttribute("aria-expanded", "false");
  /* «Espandi tutto» e «Ritrai tutto», accanto al raggruppa: quello che non
   * farebbe niente e' spento. */
  const espandi = pagina.locator('.ha-barra [data-aug-tutti="apri"]');
  const ritrai = pagina.locator('.ha-barra [data-aug-tutti="chiudi"]');
  await expect(espandi).toHaveAttribute("aria-label", "Espandi tutto");
  await expect(ritrai).toHaveAttribute("aria-label", "Ritrai tutto");
  await expect(ritrai).toBeDisabled();
  await espandi.click();
  await expect(pagina.locator(".ha-riga")).toHaveCount(5);
  await expect(pagina.locator(".aug.chiuso")).toHaveCount(0);
  await expect(espandi).toBeDisabled();
  await expect(ritrai).toBeEnabled();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("dm_automazioni_gruppi_aperti"))),
  ).toEqual(["categoria:c_clima", "categoria:c_luci", "categoria:-"]);
  await ritrai.click();
  await expect(pagina.locator(".ha-riga")).toHaveCount(0);
  await expect(ritrai).toBeDisabled();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("dm_automazioni_gruppi_aperti"))),
  ).toEqual([]);
  /* Un gruppo si apre (▾), e resta aperto anche dopo un ridisegno. */
  await pagina.locator('[data-aug-apri="categoria:c_luci"]').click();
  const luci = pagina.locator('[data-aug="categoria:c_luci"]');
  await expect(luci).not.toHaveClass(/chiuso/);
  await expect(luci.locator(".aug-freccia")).toHaveText("▾");
  await expect(luci.locator(".ha-riga")).toHaveCount(1);
  await expect(pagina.locator(".ha-riga")).toHaveCount(1);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("dm_automazioni_gruppi_aperti"))),
  ).toEqual(["categoria:c_luci"]);
  await pagina.locator('[data-au-per="tipo"]').click();
  await pagina.locator('[data-au-per="categoria"]').click();
  await expect(pagina.locator('[data-aug="categoria:c_luci"]')).not.toHaveClass(/chiuso/);
  await expect(pagina.locator('[data-aug="categoria:c_clima"]')).toHaveClass(/chiuso/);
  await pagina.locator('[data-aug-apri="categoria:c_clima"]').click();
  await pagina.locator('[data-aug-apri="categoria:-"]').click();
  await expect(pagina.locator(".ha-riga")).toHaveCount(5);
  const tapparelle = pagina.locator(".ha-riga", { hasText: "Tapparelle mattina" });
  await expect(tapparelle.locator(".ha-orig.g")).toHaveText("GdAHome");
  await expect(tapparelle.locator(".aug-fr")).toContainText("Alle 07:15");
  await expect(tapparelle.locator(".aug-fr")).toContainText("apri Tapparelle soggiorno");
  await expect(tapparelle.locator(".aug-quando")).toContainText("oggi");
  await expect(
    pagina.locator(".ha-riga", { hasText: "Batterie scariche" }).locator(".ha-orig.b"),
  ).toHaveText("Blueprint");
  /* Una complessa dice cosa fa, non «Avanzata…». */
  await expect(
    pagina.locator(".ha-riga", { hasText: "Scaldabagno" }).locator(".aug-fr"),
  ).toHaveText("Quando una condizione diventa vera · 1 azione");
  await expect(pagina.locator(".ha-tutte")).not.toContainText("Avanzata");
  /* Mai la lingua di Home Assistant: niente «chiama climate.…», niente id. */
  for (const riga of await pagina.locator(".aug-fr").allTextContents())
    expect(riga).not.toMatch(/chiama |[a-z]\.[a-z]|_/);
  await expect(pagina.locator(".ha-riga", { hasText: "Clima spento" })).toHaveClass(/spenta/);
  /* E si richiude (▸): fra gli aperti non c'e' piu'. */
  await pagina.locator('[data-aug-apri="categoria:c_luci"]').click();
  await expect(luci).toHaveClass(/chiuso/);
  await expect(luci.locator(".aug-freccia")).toHaveText("▸");
  await expect(luci.locator(".ha-riga")).toHaveCount(0);
  await expect(pagina.locator(".ha-riga")).toHaveCount(4);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("dm_automazioni_gruppi_aperti"))),
  ).toEqual(["categoria:c_clima", "categoria:-"]);
  /* Per tipo: luci, clima, tapparelle, energia, altre. */
  await pagina.locator('[data-au-per="tipo"]').click();
  await expect(pagina.locator(".aug-titolo")).toHaveText([
    "Luci",
    "Clima",
    "Tapparelle",
    "Energia",
    "Altre",
  ]);
  /* Per stanza, e la ricerca. */
  await pagina.locator('[data-au-per="stanza"]').click();
  await expect(pagina.locator(".aug-titolo").first()).toHaveText("Corridoio");
  await expect(pagina.locator(".aug.chiuso")).toHaveCount(3);
  /* Con una ricerca i gruppi stanno aperti: quello che si cerca non si nasconde. */
  await pagina.locator("[data-au-cerca]").fill("mattina");
  await expect(pagina.locator(".ha-riga")).toHaveCount(1);
  await expect(pagina.locator(".aug.chiuso")).toHaveCount(0);
  /* Con la ricerca i due tasti non servono, e non si vedono. */
  await expect(pagina.locator(".ha-barra [data-aug-tasti]")).toBeHidden();
  await expect(pagina.locator("[data-au-cerca]")).toBeFocused();
  await pagina.locator("[data-au-cerca]").fill("");
  await expect(pagina.locator(".ha-barra [data-aug-tasti]")).toBeVisible();
  await expect(pagina.locator(".ha-riga")).toHaveCount(0);
  await pagina.locator('[data-aug-apri="stanza:Soggiorno"]').click();
  /* L'interruttore la spegne in Home Assistant, senza aprirla. */
  await pagina.locator('[data-au-attiva="automation.a1001"]').click();
  await expect
    .poll(() => servizi(page))
    .toContainEqual({ service: "turn_off", data: { entity_id: "automation.a1001" } });
  await expect(pagina.locator(".ha-riga", { hasText: "Tapparelle mattina" })).toHaveClass(/spenta/);
});

test("dai modelli all'editor: si crea e si salva in Home Assistant", async ({ page }, testInfo) => {
  await avvia(page, testInfo, { configurazioni: {} });
  await apriLaVoce(page);
  const pagina = page.locator("#ed-body .au-web");
  await pagina.locator('[data-au-vai="modelli"]').first().click();
  await expect(pagina.locator(".au-mod")).toHaveCount(8);
  await pagina.locator('[data-au-modello="luce"]').click();
  await expect(pagina.locator('select[data-au-campo="quando.entita.0"]')).toHaveValue(
    "binary_sensor.pir_corridoio",
  );
  await pagina.locator("[data-au-tendina]").click();
  await expect(pagina.locator(".au-tendina [data-au-quando]")).toHaveCount(7);
  await pagina.locator('.au-tendina [data-au-quando="movimento"]').click();
  await pagina.locator('[data-au-campo="soloSe.0.da"]').fill("23:00");
  await pagina.locator('[data-au-campo="soloSe.0.da"]').dispatchEvent("change");
  await pagina.locator('[data-au-campo="soloSe.0.a"]').fill("06:00");
  await pagina.locator('[data-au-campo="soloSe.0.a"]').dispatchEvent("change");
  await pagina.locator('[data-au-testo="nome"]').fill("Luce corridoio di notte");
  await expect(pagina.locator("[data-au-leggi]")).toContainText(
    "quando c'è movimento in Corridoio, solo se di notte (23:00–06:00), accendi Luce corridoio al 30%, aspetta 2 min e spegni Luce corridoio",
  );
  await expect(pagina.locator(".ha-salva-dove")).toContainText(
    "Home Assistant → Impostazioni → Automazioni",
  );
  await pagina.locator("[data-au-salva]").click();
  await expect
    .poll(async () => (await comandi(page, "ponte/automazioni/salva"))[0])
    .toMatchObject({
      automazione_id: "",
      automazione: {
        nome: "Luce corridoio di notte",
        quando: { tipo: "movimento", entita: ["binary_sensor.pir_corridoio"], verso: "si" },
        soloSe: [{ tipo: "notte", da: "23:00", a: "06:00" }],
        allora: [
          { tipo: "accendi", entita: ["light.corridoio"], livello: 30 },
          { tipo: "aspetta", minuti: 2 },
          { tipo: "spegni", entita: ["light.corridoio"] },
        ],
      },
    });
  /* La configurazione vera, scritta come la scrive il ponte. */
  const scritta = await configDi(page, "2000");
  expect(scritta.description).toContain("#gdahome");
  expect(scritta.actions[0]).toEqual({
    action: "light.turn_on",
    target: { entity_id: "light.corridoio" },
    data: { brightness_pct: 30 },
  });
  const ok = pagina.locator(".ha-ok");
  await expect(ok).toContainText("Salvata in Home Assistant ✓ «Luce corridoio di notte»");
  await expect(ok).toContainText("Impostazioni → Automazioni, con l'etichetta GdAHome");
  await expect(ok.locator(".ha-link")).toHaveAttribute("href", "/config/automation/edit/2000");
  await expect(pagina.locator(".ha-riga")).toHaveCount(1);
});

test("una semplice si modifica; una complessa ha il riassunto e Apri in Home Assistant", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await apriLaVoce(page);
  const pagina = page.locator("#ed-body .au-web");
  await pagina.locator('[data-au-apri="automation.a1002"]').click();
  const testa = pagina.locator(".ha-testa");
  await expect(testa.locator('[data-au-testo="nome"]')).toHaveValue("Luce corridoio di notte");
  await expect(testa.locator(".ha-dove")).toContainText("automation.a1002");
  await expect(testa.locator("[data-au-area]")).toHaveValue("corridoio");
  await expect(pagina.locator('select[data-au-campo="quando.entita.0"]')).toHaveValue(
    "binary_sensor.pir_corridoio",
  );
  await testa.locator("[data-au-esegui]").click();
  await expect
    .poll(() => servizi(page))
    .toContainEqual({
      service: "trigger",
      data: { entity_id: "automation.a1002", skip_condition: true },
    });
  await testa.locator('[data-au-testo="nome"]').fill("Luce corridoio piano");
  await pagina.locator("[data-au-salva]").click();
  await expect.poll(async () => (await configDi(page, "1002")).alias).toBe("Luce corridoio piano");
  expect((await configDi(page, "1002")).description).toContain("#gdahome");
  expect((await comandi(page, "ponte/automazioni/salva"))[0].automazione_id).toBe("1002");

  /* La complessa: il riassunto, e il resto in Home Assistant. */
  await pagina.locator('[data-au-apri="automation.a1004"]').click();
  await expect(page.locator("#ed-body .dm-alberatura-titolo-nome")).toHaveText(
    "Scaldabagno col sole",
  );
  await expect(pagina.locator(".ha-riep.q")).toContainText("una condizione scritta a mano");
  await expect(pagina.locator(".ha-riep.q code")).toHaveText("{{ now().weekday() < 5 }}");
  await expect(pagina.locator(".ha-riep.a")).toContainText("sceglie un caso:");
  await expect(pagina.locator(".ha-riep.a")).toContainText("altrimenti → manda una notifica");
  await expect(pagina.locator(".ha-av .ha-apri")).toHaveAttribute(
    "href",
    "/config/automation/edit/1004",
  );
  await expect(pagina.locator('[data-au-salva], [data-au-campo="quando.tipo"]')).toHaveCount(0);
  /* Rinominarla e cambiarle stanza si puo'. */
  await pagina.locator("[data-au-rinomina]").fill("Boiler col sole");
  await pagina.locator("[data-au-rinomina]").dispatchEvent("change");
  await expect.poll(async () => (await configDi(page, "1004")).alias).toBe("Boiler col sole");
  expect((await configDi(page, "1004")).triggers).toEqual(HA[1004].triggers);
  await pagina.locator("[data-au-area]").selectOption("soggiorno");
  await expect
    .poll(async () => (await comandi(page, "ponte/automazioni/rinomina")).at(-1))
    .toMatchObject({ automazione_id: "1004", area: "soggiorno" });
});

test("Elimina chiede, Duplica copia", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await apriLaVoce(page);
  const pagina = page.locator("#ed-body .au-web");
  await pagina.locator('[data-au-apri="automation.a1001"]').click();
  await pagina.locator("[data-au-duplica]").click();
  await expect
    .poll(() => page.evaluate(() => Object.values(window.__CASA__.config).map((c) => c.alias)))
    .toContain("Tapparelle mattina (copia)");
  await pagina.locator("[data-au-elimina]").click();
  const conferma = page.locator(".ha-conferma");
  await expect(conferma.locator("h4")).toHaveText("Eliminare «Tapparelle mattina»?");
  await expect(conferma).toContainText("Si toglie anche da Home Assistant");
  await conferma.locator("[data-au-conferma-no]").click();
  await expect(conferma).toHaveCount(0);
  expect(await configDi(page, "1001")).toBeTruthy();
  await pagina.locator("[data-au-elimina]").click();
  await page.locator("[data-au-conferma-si]").click();
  await expect.poll(() => configDi(page, "1001")).toBeUndefined();
  await expect(pagina.locator(".ha-barra")).toBeVisible();
});

test("il cronotermostato: due temperature e le fasce trascinate, in Home Assistant", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { configurazioni: {} });
  await apriLaVoce(page);
  const pagina = page.locator("#ed-body .au-web");
  await pagina.locator('[data-au-vai="modelli"]').first().click();
  await pagina.locator('[data-au-modello="crono"]').click();
  await expect(pagina.locator('[data-au-barra="feriali"] i')).toHaveCount(48);
  await pagina.locator('[data-au-gradi="inCasa"][data-au-passo="0.5"]').click();
  const barra = pagina.locator('[data-au-barra="festivi"]');
  const box = await barra.boundingBox();
  await page.mouse.click(box.x + 3, box.y + box.height / 2);
  await pagina.locator("[data-au-salva]").click();
  await expect
    .poll(async () => (await comandi(page, "ponte/automazioni/salva"))[0]?.automazione)
    .toMatchObject({
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
    });
  const scritta = await configDi(page, "2000");
  expect(scritta.variables.gdahome_crono.inCasa).toBe(21.5);
  /* E riletta e' di nuovo un cronotermostato, che si apre con le sue barre. */
  await pagina.locator('[data-au-apri="automation.a2000"]').click();
  await expect(pagina.locator('[data-au-barra="festivi"]')).toBeVisible();
});

test("tutta Home Assistant: un evento, un servizio e le Avanzate", async ({ page }, testInfo) => {
  await avvia(page, testInfo, { configurazioni: {} });
  await apriLaVoce(page);
  const pagina = page.locator("#ed-body .au-web");
  await pagina.locator('[data-au-vai="modelli"]').first().click();
  await pagina.locator('[data-au-modello="zero"]').click();
  await pagina.locator("[data-au-tendina]").click();
  await expect(pagina.locator('.au-tendina [data-au-quando="evento"]')).toHaveCount(0);
  await pagina.locator("[data-au-tendina-altro]").click();
  await pagina.locator('.au-tendina [data-au-quando="evento"]').click();
  await pagina.locator('[data-au-testo="quando.evento"]').fill("zha_event");
  await pagina.locator('[data-au-aggiungi="quando.filtroRighe"]').click();
  await pagina.locator('[data-au-testo="quando.filtroRighe.0.0"]').fill("command");
  await pagina.locator('[data-au-testo="quando.filtroRighe.0.1"]').fill("on");
  await pagina.locator('[data-au-aggiungi="allora"]').click();
  await pagina.locator('[data-au-campo="allora.1.tipo"]').selectOption("servizio");
  await pagina.locator('[data-au-testo="allora.1.servizio"]').fill("notify.notify");
  await pagina.locator('[data-au-testo="allora.1.dati"]').fill('{"message":"Tasto"}');
  await expect(pagina.locator('[data-au-campo="modo"]')).toHaveCount(0);
  await pagina.locator("[data-au-avanzate]").click();
  await pagina.locator('[data-au-campo="modo"]').selectOption("ignora");
  await pagina.locator('[data-au-campo="pausa"]').selectOption("5");
  await pagina.locator('[data-au-testo="nome"]').fill("Tasto della sala");
  await pagina.locator("[data-au-salva]").click();
  await expect
    .poll(() => configDi(page, "2000"))
    .toMatchObject({
      alias: "Tasto della sala",
      mode: "single",
      triggers: [{ trigger: "event", event_type: "zha_event", event_data: { command: "on" } }],
    });
  const scritta = await configDi(page, "2000");
  expect(scritta.actions.at(-1)).toEqual({ action: "notify.notify", data: { message: "Tasto" } });
  expect(scritta.conditions[0].value_template).toContain("total_seconds() > 300");
  /* Un servizio che apre la casa non si salva: lo si dice. */
  await pagina.locator('[data-au-apri="automation.a2000"]').click();
  await pagina.locator('[data-au-testo="allora.1.servizio"]').fill("lock.unlock");
  await pagina.locator("[data-au-salva]").click();
  await expect(pagina.locator(".au-errore")).toContainText("Questo servizio la casa non lo chiama");
});

test("le proposte: il blocco, «Crea» che salva in Home Assistant e «No, grazie»", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { proposte: PROPOSTE });
  await apriLaVoce(page);
  const pagina = page.locator("#ed-body .au-web");
  const blocco = pagina.locator(".pro");
  await expect(blocco.locator(".pro-testa h3")).toHaveText("Suggerite per la tua casa ✨");
  await expect(blocco.locator(".pro-carta")).toHaveCount(1);
  await blocco.locator("[data-au-crea]").click();
  await expect(pagina.locator(".pro-etichetta")).toContainText(
    "finché non la salvi in Home Assistant non parte niente",
  );
  await pagina.locator("[data-au-salva]").click();
  await expect
    .poll(async () => (await configDi(page, "2005"))?.actions?.[0]?.event_data?.testo)
    .toBe("Lavatrice ha finito");
  await expect(pagina.locator(".pro")).toHaveCount(0);
});

test("le automazioni della versione di prova si convertono con un tasto", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, {
    configurazioni: {},
    rimaste: [
      {
        id: "a1",
        nome: "Vecchia",
        attiva: true,
        quando: { tipo: "orario", ore: ["07:15"] },
        allora: [{ tipo: "tapparella", entita: "cover.soggiorno", modo: "apri" }],
      },
    ],
  });
  await apriLaVoce(page);
  const pagina = page.locator("#ed-body .au-web");
  await expect(pagina.locator(".ha-converti")).toContainText(
    "Un'automazione della versione di prova è ferma",
  );
  await pagina.locator("[data-au-converti]").click();
  await expect.poll(() => configDi(page, "2000")).toMatchObject({ alias: "Vecchia" });
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("cd_automazioni") || "[]")))
    .toEqual([]);
  await expect(pagina.locator(".ha-converti")).toHaveCount(0);
});

test("chi non amministra Home Assistant le accende e le spegne, e non le modifica", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { amministra: false });
  await apriLaVoce(page);
  const pagina = page.locator("#ed-body .au-web");
  await expect(pagina.locator(".au-nota")).toContainText("chi amministra Home Assistant");
  await expect(pagina.locator(".ha-riga")).toHaveCount(5);
  await expect(pagina.locator("[data-au-apri]")).toHaveCount(0);
  await expect(pagina.locator('[data-au-vai="modelli"]')).toHaveCount(0);
});

/* ── senza Premium ───────────────────────────────────────────────────────── */

test("senza Premium: il config velato, e «Scopri Premium» dice dove si compra", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { premium: false });
  const voce = await apriLaVoce(page);
  await expect(voce).toHaveClass(/au-chiusa/);
  await expect(voce.locator(".au-lucchetto")).toHaveCount(1);
  const velo = page.locator("#ed-body .au-velo");
  await expect(velo.locator(".au-prem")).toHaveText("PREMIUM · IN ARRIVO");
  await expect(velo.locator("h3")).toHaveText("Automazioni con Premium");
  await expect(velo).toContainText(
    "Si acquista solo dalle app GdAHome su App Store e Google Play. Le app sono in arrivo.",
  );
  /* Sotto il velo non si tocca niente. */
  await expect(page.locator("#ed-body .au-sotto")).toHaveAttribute("inert", "");
  await velo.locator("[data-au-scopri]").click();
  const store = page.locator("#au-store");
  await expect(store.locator("h3")).toHaveText("Premium arriva con le app");
  await expect(store).toContainText("Qui in Home Assistant non si paga nulla");
  await expect(store.locator(".neg")).toHaveText([
    /App Store.*in arrivo/i,
    /Google Play.*in arrivo/i,
  ]);
  await store.locator(".ok").click();
  await expect(store).toHaveCount(0);
});

/* ── la sezione della dashboard ──────────────────────────────────────────── */

const linguette = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("nav.tabs .tab[data-tab]")].map((t) => t.dataset.tab),
  );

test("la sezione della dashboard: la linguetta prima di Config, le tessere, i gruppi per categoria e il foglio", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { aperti: [] });
  await expect
    .poll(async () => (await linguette(page)).slice(-2))
    .toEqual(["automazioni", "config"]);
  await page.locator('nav.tabs .tab[data-tab="automazioni"]').click();
  const sezione = page.locator("#page-automazioni-casa");
  await expect(sezione).toHaveClass(/active/);
  await expect(sezione.locator(".dm-page-mast-title")).toHaveText("Automazioni");
  await expect(sezione.locator(".dm-page-mast-sub")).toHaveText(
    "Tutte quelle di casa · da Home Assistant",
  );
  await expect(sezione.locator("[data-auc-attive] b")).toHaveText("4");
  await expect(sezione.locator("[data-auc-spente] b")).toHaveText("1");
  /* I gruppi sono le categorie di Home Assistant, «Senza categoria» in fondo. */
  await expect(sezione.locator('[data-auc-per="categoria"]')).toHaveClass(/si/);
  await expect(sezione.locator(".aug-titolo")).toHaveText([
    "Clima e tapparelle",
    "Luci",
    "Senza categoria",
  ]);
  /* Raggruppate: i gruppi partono chiusi, e chi vuole li apre. */
  await expect(sezione.locator(".aug-freccia")).toHaveText(["▸", "▸", "▸"]);
  await expect(sezione.locator("[data-auc-carta]")).toHaveCount(0);
  /* «Espandi tutto» e «Ritrai tutto» nella barra dei filtri, accanto al
   * raggruppa e sulla stessa riga anche sul telefono. */
  const espandi = sezione.locator('.ad-filtri [data-aug-tutti="apri"]');
  const ritrai = sezione.locator('.ad-filtri [data-aug-tutti="chiudi"]');
  await expect(ritrai).toBeDisabled();
  const riga = await sezione
    .locator(".ad-seg-riga")
    .evaluate((n) =>
      [n.querySelector(".ad-seg"), ...n.querySelectorAll(".aug-tutto")].map(
        (x) => x.getBoundingClientRect().top + x.getBoundingClientRect().height / 2,
      ),
    );
  expect(Math.max(...riga) - Math.min(...riga)).toBeLessThan(4);
  if (testInfo.project.name !== "desktop")
    await expect(espandi.locator(".aug-tutto-t")).toBeHidden();
  await espandi.click();
  await expect(sezione.locator(".aug-freccia")).toHaveText(["▾", "▾", "▾"]);
  await expect(sezione.locator("[data-auc-carta]")).toHaveCount(5);
  await expect(espandi).toBeDisabled();
  await ritrai.click();
  await expect(sezione.locator("[data-auc-carta]")).toHaveCount(0);
  for (const g of ["categoria:c_clima", "categoria:c_luci", "categoria:-"])
    await sezione.locator(`[data-aug-apri="${g}"]`).click();
  await expect(sezione.locator("[data-auc-carta]")).toHaveCount(5);
  await expect(espandi).toBeDisabled();
  /* «＋ Nuova» sta nella barra dei filtri. */
  await expect(sezione.locator(".ad-filtri [data-auc-nuova]")).toBeVisible();
  const carta = sezione.locator('[data-auc-carta="automation.a1001"]');
  await expect(carta.locator(".aug-nome")).toHaveText("Tapparelle mattina");
  await expect(carta.locator(".aug-fr")).toContainText("Alle 07:15");
  /* Una riga sola: il nome e la riga in parole stanno accanto all'interruttore. */
  const altezza = await carta.evaluate((n) => n.getBoundingClientRect().height);
  expect(altezza).toBeLessThan(testInfo.project.name === "desktop" ? 64 : 80);
  await expect(sezione.locator('[data-auc-carta="automation.a1004"] .aug-fr')).toHaveText(
    "Quando una condizione diventa vera · 1 azione",
  );
  await expect(sezione.locator('[data-auc-carta="automation.a1003"]')).toHaveClass(/spenta/);
  /* L'interruttore della riga la spegne in Home Assistant. */
  await carta.locator("[data-auc-led]").click();
  await expect
    .poll(() => servizi(page))
    .toContainEqual({ service: "turn_off", data: { entity_id: "automation.a1001" } });
  await expect(sezione.locator('[data-auc-carta="automation.a1001"]')).toHaveClass(/spenta/);
  /* Un gruppo si chiude come in Home Assistant. */
  await sezione.locator('[data-aug-apri="categoria:-"]').click();
  await expect(sezione.locator('[data-aug="categoria:-"] .aug-freccia')).toHaveText("▸");
  await expect(sezione.locator("[data-auc-carta]")).toHaveCount(3);
  await sezione.locator('[data-aug-apri="categoria:-"]').click();
  await expect(sezione.locator("[data-auc-carta]")).toHaveCount(5);
  /* Per tipo, e per stanza. */
  await sezione.locator('[data-auc-per="tipo"]').click();
  await expect(sezione.locator(".aug-titolo").first()).toHaveText("Luci");
  await sezione.locator('[data-auc-per="stanza"]').click();
  await expect(sezione.locator(".aug-titolo").first()).toHaveText("Corridoio");
  await sezione.locator('[data-aug-apri="stanza:Corridoio"]').click();
  /* Il foglio: in sola lettura, con «Esegui ora» e «Modifica nel config ›». */
  await sezione.locator('[data-auc-carta="automation.a1002"]').click();
  const foglio = page.locator("#auc-foglio .ad-foglio");
  await expect(foglio.locator("h4")).toHaveText("Luce corridoio di notte");
  await expect(foglio.locator(".riga.q")).toContainText("c'è movimento in Corridoio");
  await expect(foglio.locator(".riga.s")).toContainText("di notte");
  await expect(foglio.locator(".riga.a")).toContainText("accendi Luce corridoio al 20%");
  await foglio.locator("[data-auc-esegui]").click();
  await expect
    .poll(() => servizi(page))
    .toContainEqual({
      service: "trigger",
      data: { entity_id: "automation.a1002", skip_condition: true },
    });
  await foglio.locator("[data-auc-modifica]").click();
  await expect(page.locator("#auc-foglio")).toHaveCount(0);
  await expect(page.locator('#ed-body .au-web [data-au-testo="nome"]')).toHaveValue(
    "Luce corridoio di notte",
  );
});

test("la sezione della dashboard senza Premium: velata, e la finestra dello store", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { premium: false });
  await page.locator('nav.tabs .tab[data-tab="automazioni"]').click();
  const sezione = page.locator("#page-automazioni-casa");
  const carta = sezione.locator(".ad-chiusa .carta");
  await expect(carta.locator(".tag")).toHaveText("PREMIUM · IN ARRIVO");
  await expect(carta.locator("h3")).toHaveText("Automazioni");
  await expect(carta.locator("li")).toHaveText([
    "Tutte le automazioni di Home Assistant, a gruppi",
    "Le accendi e le spegni con un tocco",
    "Le crei e le modifichi in tre passi",
    "Proposte pensate per la tua casa",
  ]);
  await expect(sezione.locator(".ad-chiusa .sotto")).toHaveAttribute("inert", "");
  await carta.locator("[data-auc-scopri]").click();
  await expect(page.locator("#au-store h3")).toHaveText("Premium arriva con le app");
  expect(await servizi(page)).toEqual([]);
});

/* ── nell'app ────────────────────────────────────────────────────────────── */

test("nell'app: niente linguetta e niente voce, la pagina del menu con «＋ Nuova» nei filtri e il foglio", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { app: true, aperti: [] });
  expect(await linguette(page)).not.toContain("automazioni");
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
  await expect(pagina.locator(".dm-page-mast-sub")).toHaveText("Tutte quelle di casa");
  await expect(pagina.locator(".ad-cfg")).toHaveCount(0);
  /* Anche nell'app partono raggruppate: chiuse, finche' non le si apre. */
  await expect(pagina.locator(".aug.chiuso")).toHaveCount(3);
  await expect(pagina.locator("[data-auc-carta]")).toHaveCount(0);
  await pagina.locator('.ad-filtri [data-aug-tutti="apri"]').click();
  await expect(pagina.locator("[data-auc-carta]")).toHaveCount(5);
  /* «＋ Nuova» sta nella barra dei filtri, non galleggia sopra la pagina. */
  const nuova = pagina.locator(".ad-filtri [data-auc-nuova]");
  await expect(nuova).toBeVisible();
  await expect(page.locator("#auc-nuova")).toHaveCount(0);
  /* Il foglio porta «✏️ Modifica» e le tre cose sotto. */
  await pagina.locator('[data-auc-carta="automation.a1002"]').click();
  const foglio = page.locator("#auc-foglio .ad-foglio");
  await expect(foglio.locator("[data-auc-modifica]")).toHaveText("✏️ Modifica");
  await expect(foglio.locator(".op-mod button")).toHaveText([
    "Duplica",
    "Stanza e nome",
    "Elimina",
  ]);
  await foglio.locator("[data-auc-modifica]").click();
  await expect(pagina.locator('.au-app [data-au-testo="nome"]')).toHaveValue(
    "Luce corridoio di notte",
  );
  await expect(nuova).toHaveCount(0);
  await pagina.locator('.au-indietro[data-au-vai="lista"]').click();
  await expect(pagina.locator("[data-auc-carta]")).toHaveCount(5);
  await expect(nuova).toBeVisible();
  /* «＋ Nuova»: i modelli, nella stessa pagina. */
  await nuova.click();
  await expect(pagina.locator(".au-mod")).toHaveCount(8);
  await page.evaluate(() => window.gdahomeTornaDalleAutomazioni());
  await expect(page.locator("#page-automazioni")).toHaveCount(0);
});
