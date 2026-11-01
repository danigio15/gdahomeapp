/* La ricarica di notte, come la vede chi apre la plancia.
 *
 * «Ho una fascia oraria F3 dalle 23 alle 5 dove la corrente la pago 0,13:
 * quando l'auto è collegata a quell'ora deve attivarsi la modalità fast e dopo
 * tale orario si deve fermare. Una cosa semplice da gestire sulla plancia.»
 *
 * La notte la fa la casa (`ponte/src/ricarica-di-notte.js`), e le sue regole
 * si provano nel ponte. Qui si guarda la plancia: la carta sotto la console di
 * evcc, che scrive le scelte nella configurazione; il prezzo preso dalle
 * impostazioni — la F3, poi la tariffa unica, poi «Prezzo non impostato»; il racconto di
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
    state: "smart",
    attributes: { options: ["off", "smart", "now"] },
  },
  "sensor.evcc_garage_vehicle_soc": { state: "42", attributes: { unit_of_measurement: "%" } },
  "number.evcc_garage_limit_soc": { state: "80", attributes: { unit_of_measurement: "%" } },
  "binary_sensor.evcc_garage_connected": { state: "on", attributes: {} },
};

const PROFILI = [{ id: "auto1", uid: "auto-1", name: "La macchina", kwh: "60", ov: { ...MAPPA } }];

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
  /* Di serie la carta e' chiusa: le prove guardano le opzioni, quindi la si
   * apre con la freccia, come farebbe chi la usa. */
  const freccia = carta.locator('[data-rn="apri"]');
  if ((await freccia.getAttribute("aria-expanded")) !== "true") await freccia.click();
  await expect(carta.locator(".dm-rn-corpo")).toBeVisible();
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
  await expect(carta.locator(".dm-rn-titolo")).toHaveText("Ricarica notturna");
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
  /* Il Min+Sole non c'e': evcc l'ha tolto, e la notte si carica in Fast. */
  await expect(carta.locator('[data-rn-scelta="inFascia"]')).toHaveCount(0);
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
      inFascia: "now",
      poi: "prima",
      giorni: [true, true, true, true, true, true, false],
      sotto: 60,
      kw: 0,
    });
  await expect(carta.locator('[data-rn="sottoDetto"]')).toHaveText("60%");
  await expect(carta.locator('[data-rn-giorno="6"]')).toHaveAttribute("aria-pressed", "false");
  await expect(carta.locator(".dm-rn-sotto")).toHaveText("22:30–05:00 · 0,13 €/kWh · sotto il 60%");
  /* Venerdi' alle 21:30, con l'auto collegata: la carta dice che stanotte parte. */
  await expect(carta.locator('[data-rn="statoTitolo"]')).toHaveText("Stanotte alle 22:30");
  await expect(carta.locator('[data-rn="statoSotto"]')).toHaveText(
    "Auto collegata ✓ — partirà da sola",
  );
});

/* «Se attivo la ricarica notturna mi devi dire se la vettura riesce ad
 * arrivare alla percentuale che ho impostato di ricarica.» Batteria al 42%,
 * limite di evcc all'80%, 60 kWh: servono 22,8 kWh. */
test("dice se l'auto arriva al limite entro la fine della fascia", async ({ page }, testInfo) => {
  await avvia(page, testInfo, {
    impostazioni: { attiva: true, da: "23:00", a: "05:00", kw: 7.4 },
  });
  const carta = await apriLaPaginaAuto(page);
  const riga = carta.locator('[data-rn="arrivaRiga"]');
  /* a 7,4 kW bastano 3 ore e mezza: ci arriva verso le 02:26 */
  await expect(carta.locator('[data-rn="arriva"]')).toContainText("Sì, all'80% verso le 02:");
  await expect(carta.locator('[data-rn="arrivaNota"]')).toContainText("Dal 42% servono 3 h");
  await expect(riga).toHaveAttribute("data-tono", "ok");
  await fotografa(page, "ricarica-notte-ci-arriva", carta);
  /* a 2,3 kW (una presa) in sei ore no */
  await carta.locator('[data-rn="kw"]').fill("2.3");
  await carta.locator('[data-rn="kw"]').dispatchEvent("change");
  await expect.poll(() => salvate(page).then((s) => s.kw)).toBe(2.3);
  await expect(carta.locator('[data-rn="arriva"]')).toContainText("No: alle 05:00 sarà al 62%");
  await expect(riga).toHaveAttribute("data-tono", "attenzione");
  await fotografa(page, "ricarica-notte-non-ci-arriva", carta);
});

/* «Non mi deve far impostare a me il valore: deve considerare il massimo
 * impostato su evcc; se non c'e' evcc, allora si mette a mano.» Con evcc che
 * dice 16 A su una fase il campo non c'e': la potenza e' 3,7 kW. */
test("la potenza della wallbox la prende dal massimo di evcc", async ({ page }, testInfo) => {
  await avvia(page, testInfo, {
    impostazioni: { attiva: true, da: "23:00", a: "05:00", kw: 7.4 },
  });
  const carta = await apriLaPaginaAuto(page);
  await expect(carta.locator('[data-rn="kw"]')).toBeVisible();
  await page.evaluate(() => {
    const stati = eval("_RAW_STATES");
    stati["number.evcc_garage_max_current"] = {
      state: "16",
      attributes: { unit_of_measurement: "A" },
    };
    stati["select.evcc_garage_phases_configured"] = { state: "1", attributes: {} };
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  await expect(carta.locator('[data-rn="kw"]')).toBeHidden();
  await expect(carta.locator('[data-rn="kwEvcc"]')).toHaveText("3,7 kW · evcc (16 A)");
  /* a 3,7 kW in sei ore, dal 42%, non ci arriva: si ferma al 75% */
  await expect(carta.locator('[data-rn="arriva"]')).toContainText("No: alle 05:00 sarà al 75%");
  await expect(carta.locator('[data-rn="arrivaNota"]')).toContainText("a 3,7 kW");
  await fotografa(page, "ricarica-notte-potenza-evcc", carta);
});

test("il prezzo: la F3, poi la tariffa unica, poi «Prezzo non impostato» senza rimandi", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo, { impostazioni: { attiva: true } });
  const carta = await apriLaPaginaAuto(page);
  const prezzo = carta.locator('[data-rn="prezzo"]');
  await expect(prezzo.locator(".dm-rn-prezzo-box")).toHaveAttribute("data-tono", "ok");
  await expect(prezzo).toContainText("0,13 €/kWh");
  await expect(prezzo).toContainText("Dalla fascia F3");
  await expect(prezzo).not.toContainText("Impostazioni");

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
  /* Nessun «Imposta» che porti al Config: la carta lo dice e basta. */
  await expect(prezzo.locator('[data-rn="imposta"]')).toHaveCount(0);
  await expect(prezzo.locator("button")).toHaveCount(0);
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
  await expect(riga).toHaveText("🌙 Ricarica notturna stanotte alle 23:00", { timeout: 15_000 });

  await laCasaDice(page, {
    attiva: true,
    sessione: { inizio: alle(16, 23), fine: alle(17, 5), modo: "now", socInizio: 42, kwh: 1 },
    esito: null,
    notteChiusa: false,
  });
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} })),
  );
  await expect(riga).toHaveText("🌙 Ricarica notturna · Fast fino all'80% o alle 05:00", {
    timeout: 15_000,
  });
  await fotografa(page, "widget-home", tessera);
  await tessera.click();
  const pastiglia = page.locator("#dm-widget-popup .dm-f-evcc-notte");
  await expect(pastiglia).toHaveText("🌙 Ricarica notturna · Fast fino all'80% o alle 05:00");
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

test("la carta e' chiusa di serie: freccia per aprirla, si apre da sola quando la accendi", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await page.evaluate(() => {
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-ev")?.classList.add("active");
    window.dispatchEvent(new CustomEvent("dashboardmodern:legacy-ready"));
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  });
  const carta = page.locator("#dm-rn");
  await expect(carta).toBeVisible();
  const corpo = carta.locator(".dm-rn-corpo");
  const freccia = carta.locator('[data-rn="apri"]');
  await expect(corpo).toBeHidden();
  await expect(freccia).toHaveAttribute("aria-expanded", "false");
  await freccia.click();
  await expect(corpo).toBeVisible();
  await freccia.click();
  await expect(corpo).toBeHidden();
  /* Accesa: si apre da sola. */
  await carta.locator('[data-rn="attiva"]').click();
  await expect(corpo).toBeVisible();
  /* Chiusa e accesa: sotto il titolo la riga dello stato. */
  await freccia.click();
  await expect(corpo).toBeHidden();
  await expect(carta.locator('[data-rn="statino"]')).toBeVisible();
  await expect(carta.locator('[data-rn="statino"]')).not.toHaveText("");
});
