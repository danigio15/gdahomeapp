/* La stanza aperta e' una tavola di comandi (#160).
 *
 * «Non trovo utile questa sezione così com'è… è l'unica parte che uso ancora
 * della mia plancia vecchia.» La stanza era un elenco diviso per tipo, e per
 * comandare quasi tutto bisognava andarsene. Adesso e' una tavola: la testata
 * con la stanza, le sue misure e la scena, e sotto le tessere — due per riga
 * sul telefono, quattro sul computer — ognuna col suo comando addosso.
 *
 * Qui si pretende quello che la tavola promette, sulla plancia vera: la forma
 * della griglia al telefono e al computer, che la luce si accenda e si regoli
 * dalla sua tessera, che la tapparella salga e scenda, che il clima salga di
 * un grado, e che chi preferisce le righe se le rimetta dal Config.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SCATTI = process.env.DM_SCATTI_STANZE || "";

const seme = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        name: "Salone",
        icon: "mdi:sofa",
        floor: "Piano terra",
        temp: "sensor.t_salone",
        hum: "sensor.h_salone",
      },
      { name: "Cucina", icon: "mdi:countertop", floor: "Piano terra" },
    ],
    cameras: [],
    appliances: [],
    loads: [],
    climate: [
      { name: "Clima salone", entity: "climate.salone", room: "Salone", type: "clima" },
      {
        name: "Termostato zona giorno",
        entity: "climate.termostato",
        room: "Salone",
        type: "termo",
      },
    ],
    ev: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
    covers: [{ name: "Tapparella salone", entity: "cover.tapp_salone", room: "Salone" }],
    prese: [
      { name: "TV salotto", entity: "switch.tv_salotto", room: "Salone", power: "sensor.tv_w" },
      { name: "Firestick", entity: "switch.firestick", room: "Salone" },
    ],
  },
  visibility: { home: true, stanze: true },
};

const LUCI = {
  "light.faretti": "Faretti salone",
  "light.strip": "Strip TV",
  "light.lettura": "Lampada lettura",
};
const STANZE_LUCI = {
  "light.faretti": "Salone",
  "light.strip": "Salone",
  "light.lettura": "Salone",
};

const stati = {
  "sensor.t_salone": { state: "22.4", attributes: {} },
  "sensor.h_salone": { state: "46", attributes: {} },
  "sensor.tv_w": { state: "86", attributes: { unit_of_measurement: "W" } },
  "light.faretti": {
    state: "on",
    attributes: {
      brightness: 191,
      supported_color_modes: ["brightness"],
      color_mode: "brightness",
    },
  },
  "light.strip": {
    state: "on",
    attributes: {
      brightness: 219,
      supported_color_modes: ["hs"],
      color_mode: "hs",
      hs_color: [280, 70],
      rgb_color: [190, 90, 240],
    },
  },
  "light.lettura": {
    state: "off",
    attributes: { supported_color_modes: ["brightness"] },
  },
  "cover.tapp_salone": {
    state: "open",
    attributes: { current_position: 100, supported_features: 15 },
  },
  "climate.salone": {
    state: "cool",
    attributes: {
      friendly_name: "Clima salone",
      current_temperature: 25.4,
      temperature: 24,
      hvac_modes: ["off", "cool", "heat"],
      supported_features: 1,
    },
  },
  "climate.termostato": {
    state: "heat",
    attributes: {
      friendly_name: "Termostato zona giorno",
      current_temperature: 22.4,
      temperature: 21,
      hvac_modes: ["off", "heat"],
      supported_features: 1,
    },
  },
  "switch.tv_salotto": { state: "on", attributes: {} },
  "switch.firestick": { state: "on", attributes: {} },
  "media_player.salone": {
    state: "playing",
    attributes: {
      friendly_name: "Salone",
      media_title: "Nuvole bianche",
      media_artist: "Ludovico Einaudi",
      supported_features: 84421,
    },
  },
};

const EMOJI = /\p{Extended_Pictographic}/u;

async function apriIlSalone(page, testInfo) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.evaluate(
    ({ s, luci, stanze }) => {
      /* Gli stati vanno dove li legge il guscio — il suo `STATES` sta sopra
       * `_RAW_STATES` — e dove li legge la plancia. */
      const grezzi = window.eval("_RAW_STATES");
      Object.assign(grezzi, s);
      window.__HASS__ = { states: s };
      window.__DM_CHIAMATE__ = [];
      const registra = (domain, service, data) =>
        window.__DM_CHIAMATE__.push({ domain, service, data });
      window.cdCallServiceJson = registra;
      window.dmCallHaService = async (domain, service, data) => registra(domain, service, data);
      /* Il meno e il piu' del clima e i tasti della tapparella parlano al
       * filo del guscio: al suo posto uno che si ricorda cosa gli si dice. */
      window.eval(`ws = { readyState: 1, send(m) {
        const c = JSON.parse(m);
        window.__DM_CHIAMATE__.push({ domain: c.domain, service: c.service, data: c.service_data || c.target });
      }, close() {} }`);
      window.localStorage.setItem("cd_luci", JSON.stringify(luci));
      window.localStorage.setItem("cd_luci_rooms", JSON.stringify(stanze));
      window.localStorage.setItem(
        "cd_media_player",
        JSON.stringify([
          { id: "mp1", entity: "media_player.salone", name: "Salone", room_id: "room-salone" },
        ]),
      );
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
    },
    { s: stati, luci: LUCI, stanze: STANZE_LUCI },
  );
  await page.locator('.tab[data-tab="stanze"]').first().click();
  await expect(page.locator("#page-stanze")).toHaveClass(/active/);
  await page.locator('#page-stanze .dm-stanze-tessera[data-dm-stanza="room-salone"]').click();
  await expect(page.locator("#page-stanze .dm-stanze-tavola")).toHaveCount(1);
}

const chiamate = (page) => page.evaluate(() => window.__DM_CHIAMATE__);

test("il Salone e' una tavola: la testata e le tessere, due o quattro per riga", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await apriIlSalone(page, testInfo);
  const pagina = page.locator("#page-stanze");

  /* La testata: la stanza, dove sta, quante luci sono accese, le misure, il
   * clima e la scena — tutto sulla stessa card. */
  const testa = pagina.locator(".dm-stanze-testa");
  await expect(testa).toContainText("Salone");
  await expect(testa).toContainText(/piano terra/i);
  await expect(testa).toContainText(/2 luci accese su 3|2 of 3 lights on/);
  await expect(testa.locator('[data-dm-stanza-lettura="sensor.t_salone"]')).toHaveText("22.4°");
  await expect(testa.locator('[data-dm-stanza-lettura="sensor.h_salone"]')).toHaveText("46%");
  await expect(testa.locator("[data-dm-stanza-clima]")).toContainText("24°");
  await expect(testa.locator("[data-dm-stanza-clima]")).toContainText(/Raffresca|Cooling/);
  await expect(testa.locator("[data-dm-stanza-scena='on']")).toBeVisible();
  await expect(testa.locator("[data-dm-stanza-scena='off']")).toBeVisible();

  /* Le tessere: tre luci, la tapparella, due clima, due prese, la musica. */
  const tavola = pagina.locator(".dm-stanze-tavola");
  await expect(tavola.locator(":scope > .dm-stanze-casella")).toHaveCount(9);
  await expect(tavola.locator(".dm-lucip-card")).toHaveCount(5);
  await expect(tavola.locator(".dm-cl-card")).toHaveCount(2);
  await expect(tavola.locator(".dm-stanze-cop .tapp-btn")).toHaveCount(3);
  await expect(
    tavola.locator('[data-dm-stanza-entita="media_player.salone"] [data-dm-mp="centro"]'),
  ).toHaveCount(1);
  /* La presa col wattmetro porta i suoi watt. */
  await expect(tavola.locator('[data-dm-lucip="switch.tv_salotto"]')).toContainText("86 W");

  /* Quante colonne, e quanto e' larga una tessera larga. */
  const forma = await tavola.evaluate((griglia) => {
    const colonne = getComputedStyle(griglia).gridTemplateColumns.split(" ").length;
    const larghezza = (sel) => griglia.querySelector(sel)?.getBoundingClientRect().width || 0;
    const pagina = document.documentElement;
    return {
      colonne,
      luce: larghezza(':scope > .dm-stanze-casella[data-dm-stanza-casella="luci"]'),
      clima: larghezza(':scope > .dm-stanze-casella[data-dm-stanza-casella="clima"]'),
      scorre: pagina.scrollWidth > pagina.clientWidth + 1,
    };
  });
  const telefono = testInfo.project.name === "mobile";
  expect(forma.colonne).toBe(telefono ? 2 : 4);
  /* Il clima prende due posti: largo due tessere piu' lo spazio fra loro. */
  expect(forma.clima).toBeGreaterThan(forma.luce * 1.9);
  expect(forma.scorre, "la pagina non deve scorrere di lato").toBe(false);

  /* Nessuna emoji, da nessuna parte della stanza. */
  expect(await pagina.innerText()).not.toMatch(EMOJI);

  if (SCATTI) {
    /* La pagina scorre dentro la plancia, non nel documento: per la foto
     * intera si allunga lo schermo quanto la stanza. */
    const alta = await page.evaluate(
      () => document.getElementById("page-stanze").getBoundingClientRect().bottom + 160,
    );
    const schermo = page.viewportSize();
    await page.setViewportSize({ width: schermo.width, height: Math.ceil(alta) });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCATTI}/stanze-${telefono ? "telefono" : "computer"}.png` });
    await page.setViewportSize(schermo);
  }
});

test("la luce si accende e si regola dalla sua tessera", async ({ page }, testInfo) => {
  await apriIlSalone(page, testInfo);
  const lettura = page.locator('#page-stanze .dm-stanze-tavola [data-dm-lucip="light.lettura"]');
  await lettura.locator("[data-dm-lucip-toggle]").click();
  await expect
    .poll(async () => (await chiamate(page)).at(-1))
    .toMatchObject({ domain: "light", service: "turn_on", data: { entity_id: "light.lettura" } });

  /* Il cursore in linea: si lascia al 40 e parte la luminosita' giusta. */
  const faretti = page.locator('#page-stanze .dm-stanze-tavola [data-dm-lucip="light.faretti"]');
  const cursore = faretti.locator("[data-dm-lucip-brightness]");
  await expect(cursore).toBeVisible();
  await cursore.fill("40");
  await cursore.dispatchEvent("change");
  await expect
    .poll(async () => {
      const elenco = await chiamate(page);
      return elenco.filter((c) => c.data?.entity_id === "light.faretti").at(-1);
    })
    .toMatchObject({ domain: "light", service: "turn_on", data: { brightness_pct: 40 } });
  /* E si resta nella stanza. */
  await expect(page.locator("#page-stanze")).toHaveClass(/active/);
});

test("la tapparella sale e scende dalla sua tessera, senza uscire dalla stanza", async ({
  page,
}, testInfo) => {
  await apriIlSalone(page, testInfo);
  const tessera = page.locator('#page-stanze .dm-stanze-cop[data-tapp="cover.tapp_salone"]');
  await expect(tessera).toContainText(/Aperta|Open/);
  await tessera.locator('[data-svc="close_cover"]').click();
  await expect
    .poll(async () => (await chiamate(page)).at(-1))
    .toMatchObject({
      domain: "cover",
      service: "close_cover",
      data: { entity_id: "cover.tapp_salone" },
    });
  await tessera.locator('[data-svc="open_cover"]').click();
  await expect
    .poll(async () => (await chiamate(page)).at(-1))
    .toMatchObject({
      domain: "cover",
      service: "open_cover",
      data: { entity_id: "cover.tapp_salone" },
    });
  await expect(page.locator("#page-stanze")).toHaveClass(/active/);

  /* La posizione la dice Home Assistant, e la tessera la segue senza
   * ridisegnarsi. */
  await page.evaluate(() => {
    const grezzi = window.eval("_RAW_STATES");
    grezzi["cover.tapp_salone"] = {
      entity_id: "cover.tapp_salone",
      state: "open",
      attributes: { current_position: 40, supported_features: 15 },
    };
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  });
  await expect(tessera.locator("[data-dm-stanza-cop-stato]")).toHaveText(/40%/);
});

test("il clima sale di un grado dalla sua tessera", async ({ page }, testInfo) => {
  await apriIlSalone(page, testInfo);
  const clima = page.locator(
    '#page-stanze .dm-stanze-tavola .dm-cl-card[data-dm-cl="climate.salone"]',
  );
  await expect(clima.locator("[data-dm-cl-target]")).toHaveText(/24/);
  await clima.locator(".dm-cl-step").nth(1).click();
  await expect
    .poll(async () => (await chiamate(page)).filter((c) => c.domain === "climate").at(-1))
    .toMatchObject({
      service: "set_temperature",
      data: { entity_id: "climate.salone", temperature: 25 },
    });
  await expect(page.locator("#page-stanze")).toHaveClass(/active/);
});

test("chi preferisce le righe le rimette dal Config", async ({ page }, testInfo) => {
  await apriIlSalone(page, testInfo);
  await page.evaluate(() => {
    window.apriConfigEntita?.();
    window.editorSwitch?.("stanze");
  });
  const scelta = page.locator("#dm-stanze-vista");
  await expect(scelta).toBeVisible();
  const tessere = scelta.locator('[data-dm-stanze-vista-scegli="tessere"]');
  const righe = scelta.locator('[data-dm-stanze-vista-scegli="righe"]');
  /* Di serie: le tessere. */
  await expect(tessere).toHaveAttribute("aria-checked", "true");
  await expect(righe).toHaveAttribute("aria-checked", "false");
  expect(await scelta.innerText()).not.toMatch(EMOJI);
  if (SCATTI && testInfo.project.name === "mobile")
    await scelta.screenshot({ path: `${SCATTI}/stanze-config.png` });

  await righe.click();
  await expect(righe).toHaveAttribute("aria-checked", "true");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cd_stanze_vista")))).toBe(
    "righe",
  );

  /* Nella stanza tornano le righe di prima: la scena a parte, i titoli per
   * tipo, e nessuna tavola. */
  /* La finestra del Config si toglie come la toglie il guscio prima di
   * riaprirla. */
  await page.evaluate(() => document.getElementById("editor-modal")?.remove());
  await page.locator('.tab[data-tab="stanze"]').first().click();
  const pagina = page.locator("#page-stanze");
  /* La linguetta riapre l'elenco delle stanze, e dall'elenco si rientra. Per
   * nome: passando dalla scheda Stanze le stanze si sono prese il loro id. */
  await pagina.locator(".dm-stanze-tessera", { hasText: "Salone" }).click();
  await expect(pagina.locator(".dm-stanze-tavola")).toHaveCount(0);
  await expect(pagina.locator(".dm-stanze-h").first()).toBeVisible();
  await expect(pagina.locator(".dm-stanze-scena-kpi")).toHaveCount(1);
  await expect(pagina.locator('[data-dm-lucip="light.faretti"]')).toHaveCount(1);
});
