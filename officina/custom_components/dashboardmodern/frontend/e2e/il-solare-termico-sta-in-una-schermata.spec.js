/* «Mi riesci a rivedere graficamente il solare termico? È troppo grande, non
 * entra nelle pagine e non mi piace.»
 *
 * Il sinottico era un impianto in assonometria alto seicento pixel: su un
 * desktop qualunque per arrivare ai comandi bisognava scorrere. Adesso e'
 * un'illustrazione che si misura sullo schermo, con le letture in targhette
 * di vetro e i comandi in una fila di pillole nella stessa carta. Qui si
 * prova quello che conta: che la pagina intera stia in una schermata, che
 * nessuna targhetta si sovrapponga a un'altra o al boiler, e che la luce nei
 * tubi corra solo quando la pompa gira. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const MAPPA = {
  "dm.boiler_sonda_temperatura_1": "sensor.st_pannello",
  "dm.boiler_sonda_temperatura_2": "sensor.st_basso",
  "dm.boiler_sonda_temperatura_3": "sensor.st_alto",
  "dm.boiler_delta_temperatura": "sensor.st_delta",
  "dm.boiler_pressione_acqua": "sensor.st_pressione",
  "dm.boiler_potenza_resistenza_boiler": "sensor.st_potenza",
  "dm.boiler_stato_pompa_solare": "binary_sensor.st_pompa",
  "dm.boiler_pompa_solare": "switch.st_pompa",
  "dm.boiler_interruttore_solare_termico": "switch.st_ctrl",
  "dm.boiler_chiave_solare": "switch.st_chiave",
  "dm.boiler_centralina_solare_termico": "switch.st_centralina",
  "dm.boiler_interruttore_boiler": "switch.st_boiler",
  "dm.boiler_valvola_di_sicurezza": "cover.st_sicurezza",
  "dm.core_051": "switch.st_ricircolo",
  "dm.core_050": "switch.st_pdc",
  "dm.core_048": "switch.st_boost",
};

const stati = (pompa) => ({
  "sensor.st_pannello": { state: "82.9", attributes: { unit_of_measurement: "°C" } },
  "sensor.st_alto": { state: "74.1", attributes: { unit_of_measurement: "°C" } },
  "sensor.st_basso": { state: "48.3", attributes: { unit_of_measurement: "°C" } },
  "sensor.st_delta": { state: "34.6", attributes: { unit_of_measurement: "°C" } },
  "sensor.st_pressione": { state: "2.4", attributes: { unit_of_measurement: "bar" } },
  "sensor.st_potenza": { state: "0", attributes: { unit_of_measurement: "W" } },
  "binary_sensor.st_pompa": { state: pompa ? "on" : "off", attributes: {} },
  "switch.st_pompa": { state: pompa ? "on" : "off", attributes: {} },
  "switch.st_ctrl": { state: "on", attributes: {} },
  "switch.st_chiave": { state: "on", attributes: {} },
  "switch.st_centralina": { state: "on", attributes: {} },
  "switch.st_boiler": { state: "off", attributes: {} },
  "cover.st_sicurezza": { state: "closed", attributes: { current_position: 0 } },
  "switch.st_ricircolo": { state: "off", attributes: {} },
  "switch.st_pdc": { state: "off", attributes: {} },
  "switch.st_boost": { state: "off", attributes: {} },
});

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
    entityOverrides: MAPPA,
  },
  visibility: { home: true, boiler: true },
};

async function scrivi(page, letture) {
  await page.evaluate((valori) => {
    const grezzi = eval("_RAW_STATES");
    for (const [id, voce] of Object.entries(valori)) {
      grezzi[id] = { entity_id: id, state: voce.state, attributes: voce.attributes };
    }
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    try {
      window.render?.();
    } catch (_errore) {}
  }, letture);
}

async function apri(page, testInfo, pompa) {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(() => document.querySelector('.tab[data-tab="boiler"]')?.click());
  await scrivi(page, stati(pompa));
  await expect(page.locator("#page-boiler .dm-st-scene")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#syn-v-balto")).toHaveText(/74/, { timeout: 15_000 });
}

/* I riquadri di quello che si legge sulla scena, e delle macchine. */
function misura() {
  const visibile = (nodo) => {
    if (!nodo) return false;
    const stile = getComputedStyle(nodo);
    const box = nodo.getBoundingClientRect();
    return stile.display !== "none" && stile.visibility !== "hidden" && box.width > 0;
  };
  const box = (sel) => {
    const nodo = document.querySelector(sel);
    if (!visibile(nodo)) return null;
    const r = nodo.getBoundingClientRect();
    return { sel, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  };
  const etichette = [
    "#syn-p-solare .lbl",
    "#syn-v-chiave .lbl",
    "#syn-p-ricircolo .lbl",
    "#page-boiler .syn-solar-content",
    '#page-boiler .probe[data-dm-st-probe="alto"]',
    '#page-boiler .probe[data-dm-st-probe="basso"]',
    '#page-boiler [data-dm-st-kpi="delta"]',
    '#page-boiler [data-dm-st-kpi="press"]',
    '#page-boiler [data-dm-st-kpi="power"]',
    "#page-boiler .dm-st-live",
  ]
    .map(box)
    .filter(Boolean);
  /* Il corpo del boiler e il suo coperchio, non l'ombra sfumata sul pavimento. */
  const macchine = ["#page-boiler .dm-st-tank-body", "#page-boiler .dm-st-tank-cap"]
    .map(box)
    .filter(Boolean);
  const scena = box("#page-boiler .dm-st-scene");
  const carta = box("#page-boiler .boiler-dashboard");
  const pagina = document.scrollingElement;
  return {
    etichette,
    macchine,
    scena,
    carta,
    alta: innerHeight,
    larga: innerWidth,
    scorre: pagina.scrollHeight > pagina.clientHeight + 1,
  };
}

const siToccano = (a, b) =>
  a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
const dentro = (a, b) =>
  a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1;

test("il solare termico sta in una schermata e niente si accavalla", async ({ page }, testInfo) => {
  await apri(page, testInfo, true);
  const m = await page.evaluate(misura);

  /* Tutte le letture ci sono: pannello, accumulo alto e basso, ΔT,
   * pressione, potenza e lo stato dell'impianto. */
  expect(m.etichette.length).toBe(10);
  /* Niente esce di lato. */
  expect(m.carta.right).toBeLessThanOrEqual(m.larga + 1);
  expect(m.scena.right).toBeLessThanOrEqual(m.carta.right + 1);
  /* Sul desktop la pagina intera — schema, misure e i nove comandi — sta
   * nella schermata senza scorrere. */
  if (testInfo.project.name === "desktop") {
    expect(m.carta.bottom).toBeLessThanOrEqual(m.alta);
    expect(m.scorre).toBe(false);
  }

  /* Ogni targhetta sta dentro la scena, e nessuna ne copre un'altra. */
  for (const etichetta of m.etichette) {
    expect(dentro(etichetta, m.scena), etichetta.sel).toBe(true);
  }
  for (let i = 0; i < m.etichette.length; i += 1) {
    for (let j = i + 1; j < m.etichette.length; j += 1) {
      const [a, b] = [m.etichette[i], m.etichette[j]];
      expect(siToccano(a, b), `${a.sel} / ${b.sel}`).toBe(false);
    }
  }
  /* Nessuna targhetta finisce sopra il boiler disegnato. */
  for (const etichetta of m.etichette) {
    for (const macchina of m.macchine) {
      expect(siToccano(etichetta, macchina), `${etichetta.sel} / ${macchina.sel}`).toBe(false);
    }
  }

  /* Pompa accesa: l'acqua del circuito solare scorre, il ricircolo no. */
  const animazione = (id) =>
    page.locator(`#${id}`).evaluate((nodo) => getComputedStyle(nodo).animationName);
  await expect.poll(() => animazione("flow-sol-hot")).toBe("dmStFlow");
  expect(await animazione("flow-ricircolo")).toBe("none");
  await expect(page.locator("#page-boiler .dm-st-scene .dm-st-live")).toBeVisible();
  /* I comandi sono pillole nella stessa carta, e fanno quello che facevano. */
  await expect(page.locator("#b-c-pompasol")).toHaveAttribute("onclick", /dm\.boiler_pompa_solare/);
  await expect(page.locator("#b-c-boost .lbl")).toHaveText("Boost");
  await page.screenshot({ path: testInfo.outputPath("solare-pompa-accesa.png") });

  /* Pompa ferma: i tubi restano, l'acqua si ferma. */
  await scrivi(page, stati(false));
  await expect.poll(() => animazione("flow-sol-hot")).toBe("none");
  await expect(page.locator("#syn-p-solare")).not.toHaveClass(/active/);
});
