/* Escludere un varco dall'antifurto, dalla pagina Varchi (#136).
 *
 * «Nei varchi che ho inserito, che sono i sensori del mio allarme Risco, sono
 * tutti dei binary sensor che già Home Assistant vede mi dà la possibilità di
 * disabilitare. Possiamo farlo anche qui?»
 *
 * Qui si guarda quello che vede chi ha una centrale: lo scudo sulle carte che
 * hanno un interruttore — scritto, o trovato sulla stessa zona della centrale —,
 * «Esclusa dall'allarme» scritto su quella esclusa, il conto in cima che lo dice
 * a parole, e — la cosa che conta — che premendolo parta il servizio giusto:
 * dopo una domanda sulla carta quando si esclude, subito quando si include, e
 * con cinque secondi per tornare indietro. Niente scudo dove l'interruttore non
 * c'è: un tasto che chiama un servizio che non esiste è un tasto rotto.
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
    lights: [{ entity: "light.salotto", name: "Salotto" }],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, varchi: true },
};

/* Una casa con la centrale: due contatti, e accanto a ognuno l'interruttore che
 * la centrale pubblica per escluderlo. Il bagno è aperto ED escluso — è il caso
 * vero, la finestra che si lascia aperta di notte inserendo l'antifurto. */
const STATI = {
  "light.salotto": {
    entity_id: "light.salotto",
    state: "off",
    attributes: { friendly_name: "Salotto" },
  },
  "binary_sensor.porta_ingresso": {
    entity_id: "binary_sensor.porta_ingresso",
    state: "off",
    attributes: { friendly_name: "Porta ingresso", device_class: "door" },
  },
  "switch.porta_ingresso_bypass": {
    entity_id: "switch.porta_ingresso_bypass",
    state: "off",
    attributes: { friendly_name: "Porta ingresso Bypass" },
  },
  "binary_sensor.finestra_bagno": {
    entity_id: "binary_sensor.finestra_bagno",
    state: "on",
    attributes: { friendly_name: "Finestra bagno", device_class: "window" },
  },
  "switch.finestra_bagno_bypass": {
    entity_id: "switch.finestra_bagno_bypass",
    state: "on",
    attributes: { friendly_name: "Finestra bagno Bypass" },
  },
  "binary_sensor.portone_garage": {
    entity_id: "binary_sensor.portone_garage",
    state: "off",
    attributes: { friendly_name: "Portone garage", device_class: "garage_door" },
  },
};

/* Le righe dichiarate: due col loro interruttore, il garage senza. */
const VARCHI = {
  righe: [
    {
      entity: "binary_sensor.porta_ingresso",
      name: "Porta ingresso",
      icon: "front-door",
      esclusione: "switch.porta_ingresso_bypass",
    },
    {
      entity: "binary_sensor.finestra_bagno",
      name: "Finestra bagno",
      icon: "window",
      esclusione: "switch.finestra_bagno_bypass",
    },
    { entity: "binary_sensor.portone_garage", name: "Portone garage", icon: "garage-door" },
  ],
};

async function avvia(page, testInfo, prima = {}) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(
    ({ stati, varchi, prima }) => {
      localStorage.setItem("cd_varchi", JSON.stringify(varchi));
      for (const [chiave, valore] of Object.entries(prima))
        localStorage.setItem(chiave, JSON.stringify(valore));
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
      const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
      if (raw) Object.assign(raw, stati);
      /* I servizi chiamati si raccolgono invece di partire: qui non c'è nessuna
       * centrale da comandare, e quello che si deve provare è COSA si manda.
       *
       * Si coprono tutti e tre i nomi perché `chiamaServizio` prova quello che
       * trova, in quest'ordine: dentro il pannello c'è `cdCallServiceJson`, la
       * card ha `dmCallHaService`, la plancia aperta da sola il vecchio
       * `callService`. Stubbarne uno solo lascia passare il primo che c'è. */
      window.__SERVIZI__ = [];
      for (const nome of ["cdCallServiceJson", "dmCallHaService", "callService"])
        window[nome] = (domain, service, data) => {
          window.__SERVIZI__.push({ domain, service, data });
          return Promise.resolve();
        };
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      window.renderVarchi?.();
    },
    {
      stati: { ...STATI, ...(prima.__stati || {}) },
      varchi: prima.__varchi || VARCHI,
      prima: prima.__disco || {},
    },
  );
  const voce = page.locator('.tab[data-tab="varchi"]');
  await expect(voce).toBeVisible({ timeout: 20_000 });
  await voce.click();
  await expect(page.locator("#page-varchi")).toHaveClass(/active/);
  return page.locator("#page-varchi");
}

const carta = (pagina, nome) => pagina.locator(".dm-varco", { hasText: nome });

test("lo scudo c'è solo dove l'interruttore c'è", async ({ page }, testInfo) => {
  const pagina = await avvia(page, testInfo);

  await expect(carta(pagina, "Porta ingresso").locator("[data-dm-varco-scudo]")).toHaveCount(1);
  await expect(carta(pagina, "Finestra bagno").locator("[data-dm-varco-scudo]")).toHaveCount(1);
  /* Il garage non ha nessun interruttore scritto: niente scudo, e la carta resta
   * quella di prima. */
  await expect(carta(pagina, "Portone garage").locator("[data-dm-varco-scudo]")).toHaveCount(0);
});

test("la finestra esclusa si vede esclusa, e resta aperta", async ({ page }, testInfo) => {
  const pagina = await avvia(page, testInfo);

  const bagno = carta(pagina, "Finestra bagno");
  await expect(bagno.locator("[data-dm-varco-scudo]")).toHaveAttribute("aria-pressed", "true");
  await expect(bagno).toHaveAttribute("data-escluso", "true");
  /* Detto a parole, non solo col tratteggio: e il tasto dice cosa fa. */
  await expect(bagno.locator(".dm-varco-esclusa")).toHaveText(/esclusa dall'allarme/i);
  await expect(bagno.locator("[data-dm-varco-scudo]")).toHaveText(/includi/i);
  /* L'esclusione parla alla centrale, non all'infisso: aperta è aperta. */
  await expect(bagno).toHaveAttribute("data-varco", "aperto");
  await expect(bagno.locator(".dm-varco-stato")).toHaveText(/aperto/i);

  const ingresso = carta(pagina, "Porta ingresso");
  await expect(ingresso.locator("[data-dm-varco-scudo]")).toHaveAttribute("aria-pressed", "false");
  await expect(ingresso).toHaveAttribute("data-escluso", "false");
  await expect(ingresso.locator(".dm-varco-esclusa")).toHaveCount(0);
  await expect(ingresso.locator("[data-dm-varco-scudo]")).toHaveText(/escludi/i);
});

test("il conto in cima dice quante sono escluse", async ({ page }, testInfo) => {
  const pagina = await avvia(page, testInfo);
  /* Sta accanto ai chiusi perché è la cosa che chi sta per inserire l'antifurto
   * deve sapere PRIMA di inserirlo. */
  await expect(pagina.locator(".dm-varchi-testa strong")).toHaveText(/1 aperto/i);
  await expect(pagina.locator(".dm-varchi-sotto")).toContainText("1 escluso");
});

const servizi = (page) => page.evaluate(() => window.__SERVIZI__);

test("escludere chiede sulla carta, e lascia cinque secondi per tornare indietro", async ({
  page,
}, testInfo) => {
  const pagina = await avvia(page, testInfo);
  const ingresso = carta(pagina, "Porta ingresso");

  /* Il primo tocco chiede e basta: niente parte finché non si risponde. */
  await ingresso.locator("[data-dm-varco-scudo]").click();
  const domanda = ingresso.locator('[data-dm-varco-velo="chiesta"]');
  await expect(domanda).toBeVisible();
  await expect(domanda).toContainText(/escludere dall'allarme\?/i);
  expect(await servizi(page)).toEqual([]);

  /* Il sì: si accende l'interruttore, mai un `toggle`. */
  await domanda.locator("[data-dm-varco-conferma]").click();
  await expect
    .poll(() => servizi(page), { timeout: 10_000 })
    .toEqual([
      {
        domain: "switch",
        service: "turn_on",
        data: { entity_id: "switch.porta_ingresso_bypass" },
      },
    ]);

  /* E l'annulla, sulla stessa carta: rimette sotto sorveglianza quello che si
   * era appena escluso. */
  const annulla = ingresso.locator('[data-dm-varco-velo="annulla"]');
  await expect(annulla).toBeVisible();
  await annulla.locator("[data-dm-varco-annulla]").click();
  await expect
    .poll(() => page.evaluate(() => window.__SERVIZI__.at(-1)), { timeout: 10_000 })
    .toEqual({
      domain: "switch",
      service: "turn_off",
      data: { entity_id: "switch.porta_ingresso_bypass" },
    });
  await expect(annulla).toHaveCount(0);
});

test("un tocco sul velo fuori dal tasto è un no", async ({ page }, testInfo) => {
  const pagina = await avvia(page, testInfo);
  const ingresso = carta(pagina, "Porta ingresso");
  await ingresso.locator("[data-dm-varco-scudo]").click();
  const domanda = ingresso.locator('[data-dm-varco-velo="chiesta"]');
  await domanda.locator("span").first().click();
  await expect(domanda).toHaveCount(0);
  expect(await servizi(page)).toEqual([]);
});

test("includere si fa subito: rende la casa più sicura, non meno", async ({ page }, testInfo) => {
  const pagina = await avvia(page, testInfo);
  const bagno = carta(pagina, "Finestra bagno");
  await bagno.locator("[data-dm-varco-scudo]").click();
  await expect
    .poll(() => servizi(page), { timeout: 10_000 })
    .toEqual([
      {
        domain: "switch",
        service: "turn_off",
        data: { entity_id: "switch.finestra_bagno_bypass" },
      },
    ]);
  await expect(bagno.locator("[data-dm-varco-velo]")).toHaveCount(0);
});

test("quando la centrale dice di no, la carta lo scrive", async ({ page }, testInfo) => {
  /* Molte centrali non accettano un'esclusione ad antifurto inserito. Home
   * Assistant lo rimanda come errore, e prima si perdeva in silenzio. */
  const pagina = await avvia(page, testInfo);
  await page.evaluate(() => {
    window.dmCallHaService = () => Promise.reject(new Error("Zone cannot be bypassed while armed"));
  });
  const ingresso = carta(pagina, "Porta ingresso");
  await ingresso.locator("[data-dm-varco-scudo]").click();
  await ingresso.locator("[data-dm-varco-conferma]").click();
  await expect(ingresso.locator(".dm-varco-errore")).toContainText(
    "Zone cannot be bypassed while armed",
  );
  /* E l'annulla non resta: non c'è niente da annullare. */
  await expect(ingresso.locator('[data-dm-varco-velo="annulla"]')).toHaveCount(0);
});

test("col lucchetto lo stato si vede, e il tasto non c'è", async ({ page }, testInfo) => {
  const pagina = await avvia(page, testInfo, {
    __disco: { cd_solo_lettura: { "switch.finestra_bagno_bypass": true } },
  });
  const bagno = carta(pagina, "Finestra bagno");
  await expect(bagno.locator(".dm-varco-esclusa")).toBeVisible();
  await expect(bagno.locator("[data-dm-varco-scudo]")).toHaveCount(0);
  await expect(bagno.locator("[data-dm-varco-bloccato]")).toContainText(/solo lettura/i);
});

test("l'interruttore sulla stessa zona della centrale si trova da solo", async ({
  page,
}, testInfo) => {
  /* La zona Risco rinominata: il contatto si chiama «Cantina», l'interruttore
   * ha l'identificativo dell'integrazione. Nessuno l'ha scritto nella riga: lo
   * dice il registro, che la plancia si ricorda. */
  const pagina = await avvia(page, testInfo, {
    __stati: {
      "binary_sensor.cantina": {
        entity_id: "binary_sensor.cantina",
        state: "off",
        attributes: { friendly_name: "Cantina", device_class: "door" },
      },
      "switch.zona_7_bypass": {
        entity_id: "switch.zona_7_bypass",
        state: "off",
        attributes: { friendly_name: "Zona 7 Bypass" },
      },
    },
    __varchi: {
      righe: [...VARCHI.righe, { entity: "binary_sensor.cantina", name: "Cantina", icon: "door" }],
    },
    __disco: {
      dm_dispositivi_di_home_assistant: {
        di: { "binary_sensor.cantina": "zona7", "switch.zona_7_bypass": "zona7" },
        nomi: { zona7: "Zona 7" },
      },
    },
  });
  const cantina = carta(pagina, "Cantina");
  /* La mappa si rilegge dal disco di rado: si ridisegna finché non la si vede. */
  await expect
    .poll(
      async () => {
        await page.evaluate(() =>
          window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} })),
        );
        return cantina.locator("[data-dm-varco-scudo]").count();
      },
      { timeout: 10_000 },
    )
    .toBe(1);
  await cantina.locator("[data-dm-varco-scudo]").click();
  await cantina.locator("[data-dm-varco-conferma]").click();
  await expect
    .poll(() => page.evaluate(() => window.__SERVIZI__.at(-1)), { timeout: 10_000 })
    .toEqual({
      domain: "switch",
      service: "turn_on",
      data: { entity_id: "switch.zona_7_bypass" },
    });
});

test("e quando la centrale risponde, la carta lo dice", async ({ page }, testInfo) => {
  /* La prova che chiude il giro. Premere manda il servizio — lo dice la prova
   * qui sopra — ma chi preme guarda la carta: se l'interruttore si accende e la
   * carta resta com'era, da fuori il tasto non ha funzionato. La plancia non
   * finge niente quando si preme (un'esclusione disegnata e non avvenuta, su un
   * antifurto, è la bugia peggiore): aspetta che lo stato torni indietro. */
  const pagina = await avvia(page, testInfo);
  const ingresso = carta(pagina, "Porta ingresso");
  await expect(ingresso).toHaveAttribute("data-escluso", "false");

  await page.evaluate(() => {
    const acceso = {
      entity_id: "switch.porta_ingresso_bypass",
      state: "on",
      attributes: {},
    };
    window.__HASS__.states["switch.porta_ingresso_bypass"] = acceso;
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) raw["switch.porta_ingresso_bypass"] = acceso;
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });

  await expect(ingresso).toHaveAttribute("data-escluso", "true", { timeout: 10_000 });
  await expect(ingresso.locator("[data-dm-varco-scudo]")).toHaveAttribute("aria-pressed", "true");
  /* E il conto in cima si rifà da sé: adesso sono due. */
  await expect(pagina.locator(".dm-varchi-sotto")).toContainText("2 esclusi");
});
