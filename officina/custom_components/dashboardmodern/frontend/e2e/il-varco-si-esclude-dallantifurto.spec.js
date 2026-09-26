/* Escludere un varco dall'antifurto, dalla pagina Varchi (#136).
 *
 * «Nei varchi che ho inserito, che sono i sensori del mio allarme Risco, sono
 * tutti dei binary sensor che già Home Assistant vede mi dà la possibilità di
 * disabilitare. Possiamo farlo anche qui?»
 *
 * Qui si guarda quello che vede chi ha una centrale: lo scudo sulle carte a cui
 * ha scritto l'interruttore, sbarrato su quella esclusa, il conto in cima che lo
 * dice a parole, e — la cosa che conta — che premendolo parta il servizio giusto.
 * Niente scudo dove l'interruttore non c'è: un tasto che chiama un servizio che
 * non esiste è un tasto rotto.
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

async function avvia(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(
    ({ stati, varchi }) => {
      localStorage.setItem("cd_varchi", JSON.stringify(varchi));
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
    { stati: STATI, varchi: VARCHI },
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
  /* L'esclusione parla alla centrale, non all'infisso: aperta è aperta. */
  await expect(bagno).toHaveAttribute("data-varco", "aperto");
  await expect(bagno.locator(".dm-varco-stato")).toHaveText(/aperto/i);

  const ingresso = carta(pagina, "Porta ingresso");
  await expect(ingresso.locator("[data-dm-varco-scudo]")).toHaveAttribute("aria-pressed", "false");
  await expect(ingresso).toHaveAttribute("data-escluso", "false");
});

test("il conto in cima dice quante sono escluse", async ({ page }, testInfo) => {
  const pagina = await avvia(page, testInfo);
  /* Sta accanto ai chiusi perché è la cosa che chi sta per inserire l'antifurto
   * deve sapere PRIMA di inserirlo. */
  await expect(pagina.locator(".dm-varchi-testa strong")).toHaveText(/1 aperto/i);
  await expect(pagina.locator(".dm-varchi-sotto")).toContainText("1 escluso");
});

test("premendo lo scudo parte il servizio giusto, non un toggle", async ({ page }, testInfo) => {
  const pagina = await avvia(page, testInfo);

  /* Sorvegliata → si accende l'interruttore, e la si esclude. */
  await carta(pagina, "Porta ingresso").locator("[data-dm-varco-scudo]").click();
  await expect
    .poll(() => page.evaluate(() => window.__SERVIZI__), { timeout: 10_000 })
    .toEqual([
      {
        domain: "switch",
        service: "turn_on",
        data: { entity_id: "switch.porta_ingresso_bypass" },
      },
    ]);

  /* Esclusa → si spegne, e torna sorvegliata. Mai `toggle`: su uno stato letto
   * male farebbe il contrario di quello che chi preme si aspetta. */
  await carta(pagina, "Finestra bagno").locator("[data-dm-varco-scudo]").click();
  await expect
    .poll(() => page.evaluate(() => window.__SERVIZI__.at(-1)), { timeout: 10_000 })
    .toEqual({
      domain: "switch",
      service: "turn_off",
      data: { entity_id: "switch.finestra_bagno_bypass" },
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
