/* La ricarica di notte, come la vede chi apre la plancia.
 *
 * «Ho una fascia oraria F3 dalle 23 alle 5 dove la corrente la pago 0,13:
 * quando l'auto è collegata a quell'ora deve attivarsi la modalità fast e dopo
 * tale orario si deve fermare. Una cosa semplice da gestire sulla plancia.»
 *
 * La notte la fa la casa (`ponte/src/ricarica-di-notte.js`), e le sue regole
 * si provano nel ponte. Qui si guarda la plancia: la carta sotto la console di
 * evcc, che scrive le scelte nella configurazione; il prezzo preso dalle
 * impostazioni — la F3, poi la tariffa unica, poi «Imposta»; il racconto di
 * quello che la casa dice; e la riga sul widget Auto della Home.
 *
 * La casa qui e' finta, e risponde a `ponte/ricarica-notte/stato` come il
 * ponte. L'orologio e' fermo a venerdi' 16 ottobre 2026, alle 21:30.
 *
 * Con `DM_FOTO=<cartella>` lascia le fotografie, chiare e scure.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const MAPPA = {
  "dm.ev_modalita_ricarica_evcc": "select.evcc_garage_mode",
  "dm.ev_batteria_auto": "sensor.evcc_garage_vehicle_soc",
  "dm.ev_target_soc": "number.evcc_garage_limit_soc",
  "dm.ev_cavo_collegato": "binary_sensor.evcc_garage_connected",
};

const STATI = {
  "select.evcc_garage_mode": {
    state: "pv",
    attributes: { options: ["off", "pv", "minpv", "now"] },
  },
  "sensor.evcc_garage_vehicle_soc": { state: "42", attributes: { unit_of_measurement: "%" } },
  "number.evcc_garage_limit_soc": { state: "80", attributes: { unit_of_measurement: "%" } },
  "binary_sensor.evcc_garage_connected": { state: "on", attributes: {} },
};

const PROFILI = [{ id: "auto1", uid: "auto-1", name: "La macchina", ov: { ...MAPPA } }];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: PROFILI,
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: { ...MAPPA },
  },
  visibility: { home: true, ev: true },
};

const TRE_FASCE = {
  quante: 3,
  voci: [
    { dalle: 480, prezzo: 0.31 },
    { dalle: 1140, prezzo: 0.24 },
    { dalle: 1380, prezzo: 0.13 },
  ],
  festivi: -1,
};

/* Venerdi' 16 ottobre 2026, alle 21:30 della casa. */
const ADESSO = new Date(2026, 9, 16, 21, 30, 0);
const alle = (giorno, ore, minuti = 0) => new Date(2026, 9, giorno, ore, minuti, 0).getTime();

async function avvia(
  page,
  testInfo,
  { impostazioni = null, fasce = TRE_FASCE, costo = null } = {},
) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  /* L'orologio si ferma dopo l'avvio: il velo di caricamento aspetta che il
   * tempo passi, e con l'orologio fermo da subito non se ne andrebbe mai. */
  await page.clock.setFixedTime(ADESSO);
  await page.evaluate(
    ({ mappa, profili, stati, impostazioni, fasce, costo }) => {
      localStorage.setItem("cd_entity_overrides", JSON.stringify(mappa));
      localStorage.setItem("cd_ev_cars", JSON.stringify(profili));
      localStorage.setItem("cd_ev_car_active", "0");
      if (impostazioni) localStorage.setItem("cd_ricarica_notte", JSON.stringify(impostazioni));
      else localStorage.removeItem("cd_ricarica_notte");
      if (fasce) localStorage.setItem("cd_fasce_kwh", JSON.stringify(fasce));
      else localStorage.removeItem("cd_fasce_kwh");
      if (costo) localStorage.setItem("cd_costo_kwh", JSON.stringify(costo));
      else localStorage.removeItem("cd_costo_kwh");
      window.cdApplyCanonicalOverrides?.(mappa);
      const precedente = window.resolveEntity;
      window.resolveEntity = (rif) => mappa[rif] || precedente?.(rif) || rif;
      const grezzi = eval("_RAW_STATES");
      for (const [entity, stato] of Object.entries(stati))
        grezzi[entity] = { entity_id: entity, ...stato };
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...grezzi } };
      /* La casa finta: risponde alla domanda della notte con quello che la
       * prova le mette in mano, e il resto lo lascia passare. */
      window.__NOTTE__ = { attiva: false, sessione: null, esito: null, notteChiusa: false };
      window.__CHIESTE__ = 0;
      const vero = window.eval("ws");
      const finto = {
        readyState: 1,
        send(grezzo) {
          const m = JSON.parse(grezzo);
          if (m.type !== "ponte/ricarica-notte/stato") return vero?.send?.(grezzo);
          window.__CHIESTE__ += 1;
          setTimeout(() => {
            const attese = window.eval("pendingWsCallbacks");
            const torna = attese[m.id];
            delete attese[m.id];
            torna?.({ id: m.id, type: "result", success: true, result: window.__NOTTE__ });
          }, 10);
        },
      };
      window.__FINTO__ = finto;
      window.eval("ws = window.__FINTO__");
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { mappa: MAPPA, profili: PROFILI, stati: STATI, impostazioni, fasce, costo },
  );
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
}

async function apriLaPaginaAuto(page) {
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-ev")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:legacy-ready"));
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  const carta = page.locator("#dm-rn");
  await expect(carta).toBeVisible();
  return carta;
}

/** La casa dice com'e' la notte; la carta si ridisegna alla risposta. */
async function laCasaDice(page, notte) {
  await page.evaluate((notte) => {
    window.__NOTTE__ = notte;
    window.dispatchEvent(new Event("pageshow"));
  }, notte);
}

const salvate = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("cd_ricarica_notte") || "null"));

async function fotografa(page, nome, nodo) {
  const cartella = process.env.DM_FOTO;
  if (!cartella) return;
  for (const tema of ["dark", "light"]) {
    await page.evaluate((tema) => document.documentElement.setAttribute("data-theme", tema), tema);
    await page.waitForTimeout(250);
    await nodo.screenshot({ path: `${cartella}/vero-${nome}-${tema}.png` });
  }
}

test("la carta sta sotto la console di evcc, spenta di serie, e scrive le scelte", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  const carta = await apriLaPaginaAuto(page);
  /* Subito sotto i tasti di evcc che comanda. */
  expect(
    await page.evaluate(() => document.querySelector(".lm-evcc-card")?.nextElementSibling?.id),
  ).toBe("dm-rn");
  await expect(carta.locator(".dm-rn-titolo")).toHaveText("Ricarica di notte");
  await expect(carta.locator('[data-rn="attiva"]')).toHaveAttribute("aria-checked", "false");
  await expect(carta.locator('[data-rn="da"]')).toHaveValue("23:00");
  await expect(carta.locator('[data-rn="a"]')).toHaveValue("05:00");
  await expect(carta.locator('[data-rn="statoTitolo"]')).toHaveText("Spenta: evcc fa come sempre");
  /* Il limite si legge da evcc. */
  await expect(carta.locator('[data-rn="ferma"]')).toHaveText(
    "all'80% (limite di evcc) o alle 05:00",
  );

  await carta.locator('[data-rn="attiva"]').click();
  await expect
    .poll(() => salvate(page))
    .toMatchObject({ attiva: true, inFascia: "now", poi: "off" });
  await carta.locator('[data-rn-scelta="poi"][data-valore="prima"]').click();
  await carta.locator('[data-rn-scelta="inFascia"][data-valore="minpv"]').click();
  /* La domenica no: la notte fra domenica e lunedi'. */
  await carta.locator('[data-rn-giorno="6"]').click();
  await carta.locator('[data-rn="da"]').fill("22:30");
  await carta.locator('[data-rn="da"]').dispatchEvent("change");
  await carta.locator('[data-rn="sotto"]').fill("60");
  await carta.locator('[data-rn="sotto"]').dispatchEvent("change");
  await expect
    .poll(() => salvate(page))
    .toEqual({
      attiva: true,
      da: "22:30",
      a: "05:00",
      inFascia: "minpv",
      poi: "prima",
      giorni: [true, true, true, true, true, true, false],
      sotto: 60,
    });
  await expect(carta.locator('[data-rn="sottoDetto"]')).toHaveText("60%");
  await expect(carta.locator('[data-rn-giorno="6"]')).toHaveAttribute("aria-pressed", "false");
  await expect(carta.locator(".dm-rn-sotto")).toHaveText("Fascia F3 · 0,13 €/kWh · sotto il 60%");
  /* Venerdi' alle 21:30, con l'auto collegata: la carta dice che stanotte parte. */
  await expect(carta.locator('[data-rn="statoTitolo"]')).toHaveText("Stanotte alle 22:30");
  await expect(carta.locator('[data-rn="statoSotto"]')).toHaveText(
    "Auto collegata ✓ — partirà da sola",
  );
});

test("il prezzo: la F3, poi la tariffa unica, poi «Imposta»", async ({ page }, testInfo) => {
  await avvia(page, testInfo, { impostazioni: { attiva: true } });
  const carta = await apriLaPaginaAuto(page);
  const prezzo = carta.locator('[data-rn="prezzo"]');
  await expect(prezzo.locator(".dm-rn-prezzo-box")).toHaveAttribute("data-tono", "ok");
  await expect(prezzo).toContainText("0,13 €/kWh");
  await expect(prezzo).toContainText("Dalla fascia F3 in Impostazioni → Energia");

  await page.evaluate(() => {
    localStorage.removeItem("cd_fasce_kwh");
    localStorage.setItem("cd_costo_kwh", "0.22");
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await expect(prezzo.locator(".dm-rn-prezzo-box")).toHaveAttribute("data-tono", "unica");
  await expect(prezzo).toContainText("0,22 €/kWh");
  await expect(prezzo).toContainText("Fasce non impostate: uso la tariffa unica");

  await page.evaluate(() => {
    localStorage.removeItem("cd_costo_kwh");
    window.cdCfg = () => null;
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await expect(prezzo.locator(".dm-rn-prezzo-box")).toHaveAttribute("data-tono", "manca");
  await expect(prezzo).toContainText("Prezzo non impostato");
  await expect(prezzo.locator('[data-rn="imposta"]')).toHaveText("Imposta");
  /* «Imposta» apre la configurazione, sull'energia. */
  await prezzo.locator('[data-rn="imposta"]').click();
  await expect(page.locator("#editor-modal")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#editor-modal .ed-tab[data-tab="sez1"]')).toHaveClass(/active/, {
    timeout: 10_000,
  });
});

test("racconta quello che dice la casa: in carica, finita, stanotte non parte", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { impostazioni: { attiva: true, sotto: 60 } });
  const carta = await apriLaPaginaAuto(page);
  const titolo = carta.locator('[data-rn="statoTitolo"]');
  const sotto = carta.locator('[data-rn="statoSotto"]');

  await laCasaDice(page, {
    attiva: true,
    sessione: { inizio: alle(16, 23), fine: alle(17, 5), modo: "now", socInizio: 42, kwh: 6.8 },
    esito: null,
    notteChiusa: false,
  });
  await expect(titolo).toHaveText("In carica · fino all'80% o alle 05:00");
  await expect(sotto).toHaveText("Partita alle 23:00 al 42% · ora 42% · 6,8 kWh · circa 0,88 €");
  await expect(carta.locator('[data-rn="stato"]')).toHaveAttribute("data-tono", "carica");
  await fotografa(page, "carta-in-carica", carta);

  await laCasaDice(page, {
    attiva: true,
    sessione: null,
    esito: {
      tipo: "finita",
      motivo: "limite",
      alle: alle(16, 3, 40),
      soc: 80,
      kwh: 11.2,
      costo: 1.46,
      poi: "off",
    },
    notteChiusa: false,
  });
  await expect(titolo).toHaveText("Finita alle 03:40 · 80% raggiunto");
  await expect(sotto).toHaveText("Caricati 11,2 kWh · circa 1,46 € · evcc messo su Spento");

  await laCasaDice(page, {
    attiva: true,
    sessione: null,
    esito: { tipo: "non-parte", alle: alle(16, 23), soc: 82, sotto: 60 },
    notteChiusa: true,
  });
  await expect(titolo).toHaveText("Stanotte non parte");
  await expect(sotto).toHaveText("Batteria all'82%: sopra il 60% scelto");
});

test("sul widget Auto della Home: la riga della notte, e niente se e' spenta", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { impostazioni: { attiva: true } });
  const tessera = page.locator('#dm-widgets .dm-tile[data-dm-widget="ev"]');
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  const riga = tessera.locator("[data-dm-tile-sotto]");
  await expect(riga).toHaveText("🌙 F3 stanotte alle 23:00", { timeout: 15_000 });

  await laCasaDice(page, {
    attiva: true,
    sessione: { inizio: alle(16, 23), fine: alle(17, 5), modo: "now", socInizio: 42, kwh: 1 },
    esito: null,
    notteChiusa: false,
  });
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} })),
  );
  await expect(riga).toHaveText("🌙 F3 · Veloce fino all'80% o alle 05:00", { timeout: 15_000 });
  await fotografa(page, "widget-home", tessera);
  await tessera.click();
  const pastiglia = page.locator("#dm-widget-popup .dm-f-evcc-notte");
  await expect(pastiglia).toHaveText("🌙 F3 · Veloce fino all'80% o alle 05:00");
  await fotografa(page, "widget-finestra", page.locator("#dm-widget-popup .dm-f-ev"));
  await page.keyboard.press("Escape");

  /* Spenta: niente riga. */
  await page.evaluate(() => {
    localStorage.setItem("cd_ricarica_notte", JSON.stringify({ attiva: false }));
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await expect(riga).toBeHidden({ timeout: 15_000 });
});

test("senza evcc la carta non c'e'", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await page.evaluate(() => {
    delete eval("_RAW_STATES")["select.evcc_garage_mode"];
    const precedente = window.resolveEntity;
    window.resolveEntity = (rif) =>
      rif === "dm.ev_modalita_ricarica_evcc" ? rif : precedente(rif);
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-ev")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await expect(page.locator("#dm-rn")).toBeHidden();
});
