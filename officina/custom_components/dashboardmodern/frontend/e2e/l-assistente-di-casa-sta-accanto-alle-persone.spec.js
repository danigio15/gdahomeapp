/* L'assistente di casa sta accanto alle persone (#175).
 *
 * Sul documento vero: la casa e' vuota da due ore e due luci sono rimaste
 * accese. La card a destra delle persone lo dice come un messaggio della
 * casa, col tasto che le spegne; «Più tardi» rimanda, ✕ scarta e se lo
 * ricorda per tutta la casa, «vedi tutti» apre l'elenco con «Chiedi alla
 * casa». E in Config › Persone la si spegne.
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
    lights: [
      { entity: "light.sala", name: "Sala" },
      { entity: "light.cucina", name: "Cucina" },
    ],
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

const PERSONE = [
  { id: "persona-1", name: "Persona 1", entity: "person.persona_1" },
  { id: "persona-2", name: "Persona 2", entity: "person.persona_2" },
];

async function boot(page, testInfo, { larghezza = 1366 } = {}) {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: larghezza, height: 900 });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate((persone) => {
    window.localStorage.setItem("cd_people", JSON.stringify(persone));
    const stati = eval("_RAW_STATES");
    const dueOreFa = new Date(Date.now() - 2 * 3600_000).toISOString();
    for (const p of persone)
      stati[p.entity] = {
        entity_id: p.entity,
        state: "not_home",
        last_changed: dueOreFa,
        attributes: { friendly_name: p.name },
      };
    for (const id of ["light.sala", "light.cucina"])
      stati[id] = { entity_id: id, state: "on", attributes: { friendly_name: id } };
    window.__comandi = [];
    window.dmCallHaService = (dominio, servizio, dati) => {
      const chi = [].concat(dati?.entity_id || []).join(",");
      window.__comandi.push(`${dominio}.${servizio} ${chi}`);
      return Promise.resolve(true);
    };
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, PERSONE);
  await expect(page.locator("#dm-people .dm-person-card")).toHaveCount(2);
}

const card = (page) => page.locator("#dm-people .dm-assistente");

test("la casa vuota con le luci accese: la card lo dice e le spegne", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await expect(card(page)).toBeVisible();
  await expect(card(page)).toContainText("Assistente di casa");
  await expect(card(page).locator(".dm-ass-messaggio")).toContainText(
    "Non c'è nessuno in casa, ma 2 luci sono accese",
  );
  await expect(card(page).locator(".dm-ass-conto")).toHaveText("1 cosa da fare");

  /* Accanto alle persone, alla stessa altezza: e' il buco del #175. */
  const persona = await page.locator("#dm-people .dm-person-card").first().boundingBox();
  const lei = await card(page).boundingBox();
  expect(lei.x).toBeGreaterThan(persona.x + persona.width - 1);
  expect(Math.abs(lei.y - persona.y)).toBeLessThan(4);
  expect(Math.abs(lei.height - persona.height)).toBeLessThan(4);

  await card(page).locator('[data-ass-fa="azione"]').click();
  expect(await page.evaluate(() => window.__comandi)).toEqual([
    "light.turn_off light.sala,light.cucina",
  ]);
  /* Fatto: finche' la cosa resta vera non si ripropone. */
  await expect(card(page)).toContainText("In casa è tutto in ordine.");
  const memoria = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_assistente")));
  expect(memoria.memoria.tipi["vuota-luci"].si).toBe(1);
});

test("«Più tardi» rimanda a domani, ✕ scarta e se lo ricorda", async ({ page }, testInfo) => {
  await boot(page, testInfo);
  await card(page).locator('[data-ass-fa="tardi"]').click();
  const scelte = card(page).locator('[data-ass-fa="rimanda"]');
  await expect(scelte).toHaveText(["Fra 1 h", "Stasera", "Domani"]);
  await scelte.filter({ hasText: "Domani" }).click();
  await expect(card(page)).toContainText("In casa è tutto in ordine.");
  let salvato = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_assistente")));
  const [id, voce] = Object.entries(salvato.memoria.istanze)[0];
  expect(id).toBe("vuota-luci:light.cucina,light.sala");
  expect(voce.fino).toBeGreaterThan(Date.now() + 6 * 3600_000);
  /* Rimandare non e' scartare: il tipo non perde peso. */
  expect(salvato.memoria.tipi["vuota-luci"]).toBeUndefined();

  /* Si dimentica il rinvio e si scarta con ✕. */
  await page.evaluate(() => {
    localStorage.removeItem("cd_assistente");
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await expect(card(page).locator(".dm-ass-messaggio")).toBeVisible();
  await card(page).locator('[data-ass-fa="no"]').click();
  await expect(card(page)).toContainText("In casa è tutto in ordine.");
  salvato = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_assistente")));
  expect(salvato.memoria.tipi["vuota-luci"].no).toBe(1);
});

test("«vedi tutti» apre l'elenco con «Chiedi alla casa»", async ({ page }, testInfo) => {
  await boot(page, testInfo);
  await card(page).locator('.dm-ass-tasti [data-ass-fa="apri"]').click();
  const foglio = page.locator("#dm-ass-velo .dm-ass-foglio");
  await expect(foglio).toBeVisible();
  await expect(foglio.locator(".dm-ass-riga")).toHaveCount(1);
  await expect(foglio.locator(".dm-ass-riga").first()).toHaveAttribute("data-urgenza", "oggi");
  await expect(foglio.locator("[data-ass-testo]")).toHaveAttribute(
    "placeholder",
    "Chiedi alla casa…",
  );
  /* Con la conversazione vuota, le domande da provare. */
  await expect(foglio.locator(".dm-ass-prova .dm-ass-chip").first()).toBeVisible();
  /* Una domanda che la casa non sa, senza Home Assistant collegata: non resta
   * appesa, la casa lo dice e propone cosa chiedere. */
  await foglio.locator("[data-ass-testo]").fill("Raccontami una barzelletta");
  await foglio.locator(".dm-ass-manda").click();
  await expect(foglio.locator('.dm-ass-battuta[data-chi="io"]')).toHaveText(
    "Raccontami una barzelletta",
  );
  await expect(foglio.locator('.dm-ass-battuta[data-chi="casa"][data-errore="true"]')).toBeVisible({
    timeout: 25000,
  });
  await expect(foglio.locator("[data-ass-tasti] .dm-ass-chip").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#dm-ass-velo")).toHaveCount(0);
});

test("sul telefono sta sotto le persone, a tutta larghezza", async ({ page }, testInfo) => {
  await boot(page, testInfo, { larghezza: 390 });
  await expect(card(page)).toHaveAttribute("data-posto", "sotto");
  const ultima = await page.locator("#dm-people .dm-person-card").last().boundingBox();
  const lei = await card(page).boundingBox();
  expect(lei.y).toBeGreaterThan(ultima.y + ultima.height - 1);
  const fila = await page.locator("#dm-people .dm-people-fila").boundingBox();
  expect(Math.abs(lei.width - fila.width)).toBeLessThan(2);
});

test("in Config › Persone, «Cosa c'è in casa»: quello che ha capito, e si corregge con un tocco", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await page.evaluate(() => {
    window.__COSE__ = [
      {
        entita: "light.luce_acquario_blu",
        nome: "Luce acquario blu",
        tipo: "luce",
        genere: "acquario",
        perche: "acquario",
        scelta: "auto",
      },
      {
        entita: "light.luci_giardino",
        nome: "Luci giardino",
        tipo: "luce",
        genere: null,
        perche: "automazione",
        scelta: "auto",
      },
      {
        entita: "switch.presa_frigo",
        nome: "Presa frigo garage",
        tipo: "luce",
        genere: "sempre",
        perche: "sempre",
        scelta: "auto",
      },
      {
        entita: "binary_sensor.porta_bagno",
        nome: "Porta bagno",
        tipo: "porta",
        genere: "interna",
        perche: null,
        scelta: "auto",
      },
      {
        entita: "light.cucina",
        nome: "Cucina",
        tipo: "luce",
        genere: null,
        perche: null,
        scelta: "auto",
      },
    ];
    window.__SCELTE__ = [];
    const vero = window.eval("ws");
    window.__FINTO__ = {
      readyState: 1,
      send(grezzo) {
        const m = JSON.parse(grezzo);
        if (!String(m.type).startsWith("ponte/casa-capita/")) return vero?.send?.(grezzo);
        const rispondi = (result) =>
          setTimeout(() => {
            const attese = window.eval("pendingWsCallbacks");
            const torna = attese[m.id];
            delete attese[m.id];
            torna?.({ id: m.id, type: "result", success: true, result });
          }, 15);
        if (m.type === "ponte/casa-capita/elenco") return rispondi({ cose: window.__COSE__ });
        window.__SCELTE__.push(`${m.entita}=${m.scelta}`);
        const voce = window.__COSE__.find((c) => c.entita === m.entita);
        if (voce) voce.scelta = m.scelta;
        return rispondi({ fatto: true });
      },
    };
    window.eval("ws = window.__FINTO__");
  });
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="people"]').click();
  await page.locator("#ed-body [data-person-casa-apri]").click();
  const righe = page.locator("#ed-body .dm-people-casa-riga");
  await expect(righe).toHaveCount(5);
  await expect(righe.first()).toContainText("Luce acquario blu");
  await expect(righe.first()).toContainText("Acquario");
  await expect(righe.nth(1)).toContainText("Ci pensa un'automazione");
  /* «Avvisa» sulla cucina: va al ponte, e la riga lo mostra. */
  await page
    .locator('#ed-body [data-person-casa-entita="light.cucina"][data-person-casa-scelta="avvisa"]')
    .click();
  await expect.poll(() => page.evaluate(() => window.__SCELTE__)).toEqual(["light.cucina=avvisa"]);
  await expect(
    page.locator(
      '#ed-body [data-person-casa-entita="light.cucina"][data-person-casa-scelta="avvisa"]',
    ),
  ).toHaveAttribute("aria-checked", "true");
  if (process.env.DM_FOTO) {
    await page.locator("#ed-body .dm-people-casa").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${process.env.DM_FOTO}/cosa-c-e-in-casa.png` });
  }
});

test("in Config › Persone si spegne, e si regola", async ({ page }, testInfo) => {
  await boot(page, testInfo);
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="people"]').click();
  const scelte = page.locator("#ed-body [data-person-accanto]");
  await expect(scelte).toHaveText(["Assistente di casa", "Niente"]);
  /* Le regolazioni: di cosa parla, quanto, e da che ora e' notte. */
  await page.locator('#ed-body [data-person-ass-categoria="comfort"]').click();
  await page.locator('#ed-body [data-person-ass-sensibilita="poco"]').click();
  await page.locator("#ed-body [data-person-ass-notte]").selectOption("21");
  const opzioni = await page.evaluate(
    () => JSON.parse(localStorage.getItem("cd_assistente")).opzioni,
  );
  expect(opzioni.categorie.comfort).toBe(false);
  expect(opzioni.sensibilita).toBe("poco");
  expect(opzioni.notteDalle).toBe(21);

  await scelte.filter({ hasText: "Niente" }).click();
  await expect(page.locator("#ed-body [data-person-assistente]")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("cd_people_accanto"))).toBe(
    JSON.stringify({ mostra: "niente" }),
  );
  await expect(card(page)).toHaveCount(0);
});

/* «Chiedi alla casa…» capisce le domande prima di Assist.
 *
 * «Che temperatura è presente in casa», all'agente di serie di Home
 * Assistant, tornava «non conosco nessuna area chiamata è presente in casa».
 * Qui la risponde la casa, con i termometri delle stanze, senza chiedere
 * niente a Home Assistant; e «spegni la luce della cucina» si propone e parte
 * solo col «Sì».
 */
async function bootConLeStanze(page, testInfo) {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, {
    ...SEME,
    sections: {
      ...SEME.sections,
      rooms: [
        { id: "room-sala", name: "Sala", icon: "🛋️", temp: "sensor.temp_sala" },
        { id: "room-camera", name: "Camera", icon: "🛏️", temp: "sensor.temp_camera" },
      ],
    },
  });
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate((persone) => {
    window.localStorage.setItem("cd_people", JSON.stringify(persone));
    const stati = eval("_RAW_STATES");
    const metti = (id, state, attributes) =>
      (stati[id] = { entity_id: id, state, attributes, last_changed: new Date().toISOString() });
    metti("person.persona_1", "home", { friendly_name: "Persona 1" });
    metti("person.persona_2", "not_home", { friendly_name: "Persona 2" });
    metti("light.sala", "on", { friendly_name: "Sala" });
    metti("light.cucina", "on", { friendly_name: "Cucina" });
    metti("sensor.temp_sala", "22", {
      friendly_name: "Temperatura sala",
      device_class: "temperature",
      unit_of_measurement: "°C",
    });
    metti("sensor.temp_camera", "20", {
      friendly_name: "Temperatura camera",
      device_class: "temperature",
      unit_of_measurement: "°C",
    });
    metti("conversation.home_assistant", "unknown", { friendly_name: "Home Assistant" });
    metti("conversation.openai_conversation", "unknown", { friendly_name: "OpenAI" });
    /* Le aree, come le tiene il registro del guscio. */
    window.eval(`
      WIZ.entReg = Object.assign(WIZ.entReg || {}, {
        "light.sala": { a: "sala" },
        "light.cucina": { a: "cucina" },
      });
      WIZ.areaNames = Object.assign(WIZ.areaNames || {}, { sala: "Sala", cucina: "Cucina" });
    `);
    window.__comandi = [];
    window.dmCallHaService = (dominio, servizio, dati) => {
      window.__comandi.push(`${dominio}.${servizio} ${[].concat(dati?.entity_id || []).join(",")}`);
      return Promise.resolve(true);
    };
    /* La presa con Home Assistant raccoglie quello che arriva ad Assist, e
     * risponde come l'agente di serie quando non capisce. */
    window.__CHIESTO__ = [];
    window.eval(`
      ws = {
        readyState: 1,
        send(grezzo) {
          const messaggio = JSON.parse(grezzo);
          if (messaggio.type !== "conversation/process") return;
          window.__CHIESTO__.push(messaggio);
          setTimeout(() => {
            const torna = pendingWsCallbacks[messaggio.id];
            delete pendingWsCallbacks[messaggio.id];
            torna && torna({
              id: messaggio.id,
              success: true,
              result: {
                conversation_id: "filo-1",
                response: {
                  response_type: "error",
                  speech: { plain: { speech: "Mi dispiace, non conosco nessuna area chiamata " + messaggio.text } },
                },
              },
            });
          }, 20);
        },
      };
    `);
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, PERSONE);
  await expect(page.locator("#dm-people .dm-person-card")).toHaveCount(2);
  await expect(card(page)).toBeVisible();
  await card(page).locator('[data-ass-fa="apri"]').first().click();
  const foglio = page.locator("#dm-ass-velo .dm-ass-foglio");
  await expect(foglio).toBeVisible();
  return foglio;
}

async function chiedi(foglio, frase) {
  await foglio.locator("[data-ass-testo]").fill(frase);
  await foglio.locator(".dm-ass-manda").click();
}

const ultimaRisposta = (foglio) => foglio.locator('.dm-ass-battuta[data-chi="casa"]').last();

test("«Che temperatura è presente in casa» la risponde la casa, senza Assist", async ({
  page,
}, testInfo) => {
  const foglio = await bootConLeStanze(page, testInfo);
  await chiedi(foglio, "Che temperatura è presente in casa");
  await expect(ultimaRisposta(foglio)).toHaveText(
    "In casa ci sono in media 21 °C: da 20° in Camera a 22° in Sala.",
  );
  /* E le stanze sotto, da toccare. */
  await foglio.locator("[data-ass-tasti] .dm-ass-chip", { hasText: "Camera" }).click();
  await expect(ultimaRisposta(foglio)).toHaveText("In Camera ci sono 20 °C.");
  await chiedi(foglio, "c'è qualcuno in casa?");
  await expect(ultimaRisposta(foglio)).toContainText("in casa c'è Persona 1");
  await chiedi(foglio, "quante luci sono accese");
  await expect(ultimaRisposta(foglio)).toHaveText("Sono accese 2 luci: Sala e Cucina.");
  expect(await page.evaluate(() => window.__CHIESTO__.length)).toBe(0);
});

test("«spegni la luce della cucina» si propone, e parte solo col «Sì»", async ({
  page,
}, testInfo) => {
  const foglio = await bootConLeStanze(page, testInfo);
  await chiedi(foglio, "spegni la luce della cucina");
  await expect(ultimaRisposta(foglio)).toHaveText("Spengo la luce Cucina?");
  expect(await page.evaluate(() => window.__comandi)).toEqual([]);
  await foglio.locator('[data-ass-tasti] .dm-ass-chip[data-tipo="fai"]').click();
  await expect(ultimaRisposta(foglio)).toHaveText("Fatto: ho spento la luce Cucina.");
  expect(await page.evaluate(() => window.__comandi)).toEqual(["light.turn_off light.cucina"]);
  /* Il tasto non resta: un «Sì» vecchio non riparte. */
  await expect(foglio.locator('.dm-ass-chip[data-tipo="fai"]')).toHaveCount(0);
});

test("le luci si chiamano come nella plancia, non come i dispositivi", async ({
  page,
}, testInfo) => {
  const foglio = await bootConLeStanze(page, testInfo);
  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    const metti = (id, friendly_name) =>
      (stati[id] = {
        entity_id: id,
        state: "on",
        attributes: { friendly_name },
        last_changed: new Date().toISOString(),
      });
    metti("light.shelly_a_0", "Luce Camera switch_0");
    metti("light.shelly_a_1", "Luce Camera switch_1");
    metti("switch.shelly_b_0", "Shelly ingresso switch_0");
    metti("light.led_1", "Led Sala");
    metti("light.led_2", "Led Sala");
    localStorage.setItem(
      "cd_luci",
      JSON.stringify({
        "light.shelly_a_0": "Plafoniera",
        "light.shelly_a_1": "Abat-jour",
        "switch.shelly_b_0": "Applique",
        "light.led_1": "Striscia",
        "light.led_2": "Striscia",
        "light.sala": "Lampadario",
        "light.cucina": "Pensili",
      }),
    );
    localStorage.setItem(
      "cd_luci_rooms",
      JSON.stringify({
        "light.shelly_a_0": "Camera",
        "light.shelly_a_1": "Camera",
        "light.led_1": "Sala",
        "light.led_2": "Sala",
        "light.sala": "Sala",
      }),
    );
  });
  await chiedi(foglio, "Quante luci sono accese?");
  const risposta = ultimaRisposta(foglio);
  await expect(risposta).toContainText("Sono accese 7 luci");
  await expect(risposta).toContainText("2 in Camera");
  await expect(risposta).toContainText("3 in Sala");
  await expect(risposta).not.toContainText("switch_");
  await expect(
    foglio.locator("[data-ass-tasti] .dm-ass-chip", { hasText: "Spegni in Camera" }),
  ).toBeVisible();
  if (process.env.DM_FOTO)
    await page.screenshot({ path: `${process.env.DM_FOTO}/luci-per-nome.png` });
  await foglio.locator("[data-ass-tasti] .dm-ass-chip", { hasText: "Spegni in Camera" }).click();
  await expect(ultimaRisposta(foglio)).toHaveText("Fatto: luci spente in Camera.");
  expect(await page.evaluate(() => window.__comandi)).toEqual([
    "light.turn_off light.shelly_a_0,light.shelly_a_1",
  ]);
});

test("le finestre sono quelle della plancia, anche senza classe in Home Assistant", async ({
  page,
}, testInfo) => {
  const foglio = await bootConLeStanze(page, testInfo);
  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    const metti = (id, state, attributes) =>
      (stati[id] = { entity_id: id, state, attributes, last_changed: new Date().toISOString() });
    /* Contatti senza classe: Home Assistant non dice che sono finestre. */
    metti("binary_sensor.contatto_1", "on", { friendly_name: "Contatto 1" });
    metti("binary_sensor.contatto_2", "off", { friendly_name: "Contatto 2" });
    localStorage.setItem(
      "cd_varchi",
      JSON.stringify({
        righe: [
          { entity: "binary_sensor.contatto_1", name: "Finestra camera", tipo: "finestra" },
          { entity: "binary_sensor.contatto_2", name: "Balcone sala", tipo: "finestra" },
        ],
      }),
    );
    window.eval(`
      WIZ.entReg = Object.assign(WIZ.entReg || {}, {
        "binary_sensor.contatto_1": { a: "camera" },
        "binary_sensor.contatto_2": { a: "sala" },
      });
      WIZ.areaNames = Object.assign(WIZ.areaNames || {}, { camera: "Camera" });
    `);
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  });
  await chiedi(foglio, "La finestra in camera è aperta?");
  await expect(ultimaRisposta(foglio)).toHaveText(
    "C'è 1 finestra aperta in Camera: Finestra camera.",
  );
  await chiedi(foglio, "Ci sono finestre aperte?");
  await expect(ultimaRisposta(foglio)).toHaveText("C'è 1 finestra aperta: Finestra camera.");
  if (process.env.DM_FOTO)
    await page.screenshot({ path: `${process.env.DM_FOTO}/finestre-della-plancia.png` });
});

test("quello che la casa non sa va al modello linguistico; se non capisce, si propone cosa chiedere", async ({
  page,
}, testInfo) => {
  const foglio = await bootConLeStanze(page, testInfo);
  await chiedi(foglio, "raccontami una barzelletta");
  await expect(ultimaRisposta(foglio)).toContainText("Non ho capito bene.");
  const chiesto = await page.evaluate(() => window.__CHIESTO__[0]);
  expect(chiesto.text).toBe("raccontami una barzelletta");
  expect(chiesto.agent_id).toBe("conversation.openai_conversation");
  expect(chiesto.language).toBe("it");
  await expect(foglio.locator("[data-ass-tasti] .dm-ass-chip")).not.toHaveCount(0);
  await foglio.locator("[data-ass-tasti] .dm-ass-chip").first().click();
  await expect(ultimaRisposta(foglio)).toContainText("In casa ci sono in media 21 °C");
});
