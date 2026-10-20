/* La nuova pagina Auto, accesa dall'interruttore di prova.
 *
 * «Mi piace la suddivisione dei dati come c ma falla più bella», con i tre modi
 * di evcc piu' il «sempre», la ricarica di notte, la percentuale scelta
 * libera, il logo e il modello, piu' auto, lo storico di un mese o di un
 * periodo, il tema chiaro. Qui la casa ha tre auto — due elettriche e una a
 * benzina — e un mese di ricariche nelle statistiche del Recorder.
 *
 * Senza l'interruttore la pagina e' quella di sempre: anche questo si prova.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

test.use({ timezoneId: "Europe/Rome", locale: "it-IT" });

/* Un SUV di profilo, disegnato: nessuna foto vera, nessuna targa. */
const FOTO =
  "data:image/svg+xml;base64," +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="560" viewBox="0 0 1200 560">
      <defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8edf3"/><stop offset="1" stop-color="#9aa7b8"/></linearGradient>
      <linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f2a3a"/><stop offset="1" stop-color="#3b4a60"/></linearGradient></defs>
      <path d="M140 400 C140 330 170 300 250 290 L380 210 C420 186 470 178 540 178 L760 178 C830 178 880 196 930 236 L1000 290 C1060 300 1080 330 1080 400 L1080 420 L140 420 Z" fill="url(#c)"/>
      <path d="M400 222 C430 204 470 198 540 198 L640 198 L640 290 L320 290 Z" fill="url(#v)"/>
      <path d="M660 198 L760 198 C820 198 860 214 900 246 L940 290 L660 290 Z" fill="url(#v)"/>
      <rect x="150" y="380" width="920" height="16" rx="8" fill="#6b7686"/>
      <circle cx="320" cy="420" r="70" fill="#1d232c"/><circle cx="320" cy="420" r="40" fill="#8d97a5"/>
      <circle cx="900" cy="420" r="70" fill="#1d232c"/><circle cx="900" cy="420" r="40" fill="#8d97a5"/>
    </svg>`,
  ).toString("base64");

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
  visibility: { home: true, ev: true },
};

const s = (entity_id, state, unit = "", extra = {}) => ({
  entity_id,
  state: String(state),
  attributes: {
    friendly_name: entity_id.split(".")[1].replace(/_/g, " "),
    ...(unit ? { unit_of_measurement: unit, state_class: "measurement" } : {}),
    ...extra,
  },
});

const STATI = [
  /* la BYD, in carica */
  s("sensor.byd_batteria", "68", "%", { device_class: "battery" }),
  s("sensor.byd_autonomia", "262", "km", { device_class: "distance" }),
  s("sensor.byd_consumo_medio", "16", "kWh/100 km"),
  s("sensor.byd_temperatura_batteria", "21", "°C", { device_class: "temperature" }),
  s("sensor.byd_temperatura_interna", "24", "°C", { device_class: "temperature" }),
  s("sensor.byd_energia_oggi_guida", "4.2", "kWh"),
  s("sensor.byd_energia_oggi_clima", "0.8", "kWh"),
  s("sensor.byd_energia_oggi_altro", "0.3", "kWh"),
  s("sensor.byd_km_7_giorni", "411", "km"),
  s("sensor.byd_energia_7_giorni", "57", "kWh"),
  s("sensor.byd_marcia", "parcheggio"),
  s("binary_sensor.byd_freno", "on"),
  s("sensor.byd_aggiornata", "2026-10-20T19:28:00+00:00", "", { device_class: "timestamp" }),
  s("sensor.byd_gomma_as", "2.3", "bar"),
  s("sensor.byd_gomma_ad", "2.3", "bar"),
  s("sensor.byd_gomma_ps", "2.3", "bar"),
  s("sensor.byd_gomma_pd", "2.0", "bar"),
  s("lock.byd_serratura", "locked"),
  s("binary_sensor.byd_finestrini", "off", "", { device_class: "window" }),
  s("binary_sensor.byd_bagagliaio", "off", "", { device_class: "opening" }),
  s("device_tracker.byd", "home"),
  s("sensor.byd_odometro", "18240", "km", { state_class: "total_increasing" }),
  s("number.byd_limite", "80", "%", { min: 20, max: 100, step: 1 }),
  /* la wallbox e evcc */
  s("sensor.wallbox_potenza", "3700", "W", { device_class: "power" }),
  s("sensor.wallbox_stato", "C"),
  s("sensor.wallbox_sessione", "3.4", "kWh"),
  s("sensor.wallbox_sole_sessione", "42", "%"),
  s("sensor.wallbox_energia_oggi", "6.1", "kWh", { state_class: "total_increasing" }),
  s("sensor.rete_prelevata_oggi", "9.2", "kWh", { state_class: "total_increasing" }),
  s("select.evcc_modo", "smart", "", { options: ["off", "smart", "now"] }),
  s("select.evcc_sempre", "on", "", { options: ["off", "on", "once"] }),
  /* la Tesla, collegata e piena */
  s("sensor.tesla_batteria", "91", "%", { device_class: "battery" }),
  s("sensor.tesla_autonomia", "402", "km"),
  s("binary_sensor.tesla_cavo", "on", "", { device_class: "plug" }),
  /* la Panda a benzina */
  s("sensor.panda_carburante", "40", "%"),
  s("sensor.panda_autonomia", "310", "km"),
  s("sensor.panda_odometro", "48210", "km"),
  s("lock.panda_portiere", "locked"),
  s("binary_sensor.panda_motore", "off"),
  s("sensor.panda_gomma_as", "2.2", "bar"),
  s("sensor.panda_gomma_ad", "2.2", "bar"),
  s("sensor.panda_gomma_ps", "2.1", "bar"),
  s("sensor.panda_gomma_pd", "2.1", "bar"),
];

const BYD = {
  "dm.ev_batteria_auto": "sensor.byd_batteria",
  "dm.ev_autonomia": "sensor.byd_autonomia",
  "dm.ev_consumo_medio": "sensor.byd_consumo_medio",
  "dm.ev_temperatura_batteria": "sensor.byd_temperatura_batteria",
  "dm.ev_temperatura_interna": "sensor.byd_temperatura_interna",
  "dm.ev_energia_oggi_guida": "sensor.byd_energia_oggi_guida",
  "dm.ev_energia_oggi_clima": "sensor.byd_energia_oggi_clima",
  "dm.ev_energia_oggi_altro": "sensor.byd_energia_oggi_altro",
  "dm.ev_km_7_giorni": "sensor.byd_km_7_giorni",
  "dm.ev_energia_7_giorni": "sensor.byd_energia_7_giorni",
  "dm.ev_marcia": "sensor.byd_marcia",
  "dm.ev_freno_stazionamento": "binary_sensor.byd_freno",
  "dm.ev_ultimo_aggiornamento": "sensor.byd_aggiornata",
  "dm.ev_pneumatico_ant_sx": "sensor.byd_gomma_as",
  "dm.ev_pneumatico_ant_dx": "sensor.byd_gomma_ad",
  "dm.ev_pneumatico_post_sx": "sensor.byd_gomma_ps",
  "dm.ev_pneumatico_post_dx": "sensor.byd_gomma_pd",
  "dm.ev_portiere": "lock.byd_serratura",
  "dm.ev_finestrini": "binary_sensor.byd_finestrini",
  "dm.ev_bagagliaio": "binary_sensor.byd_bagagliaio",
  "dm.ev_posizione": "device_tracker.byd",
  "dm.ev_odometro": "sensor.byd_odometro",
  "dm.ev_target_soc": "number.byd_limite",
  "dm.ev_potenza_wallbox": "sensor.wallbox_potenza",
  "dm.ev_stato_ricarica": "sensor.wallbox_stato",
  "dm.ev_energia_sessione": "sensor.wallbox_sessione",
  "dm.ev_percentuale_solare_sessione": "sensor.wallbox_sole_sessione",
  "dm.ev_energia_wallbox_oggi": "sensor.wallbox_energia_oggi",
  "dm.ev_modalita_ricarica_evcc": "select.evcc_modo",
  "dm.ev_ricarica_sempre_evcc": "select.evcc_sempre",
};
const CASA = { "dm.energy_energia_prelevata_oggi": "sensor.rete_prelevata_oggi" };

const AUTO = [
  {
    uid: "auto-1",
    name: "SUV di casa",
    brand: "BYD",
    model: "Atto 3",
    tipo: "",
    kwh: "60",
    img: FOTO,
    ov: BYD,
  },
  {
    uid: "auto-2",
    name: "Seconda",
    brand: "Tesla",
    model: "Model Y",
    tipo: "",
    img: FOTO,
    ov: {
      "dm.ev_batteria_auto": "sensor.tesla_batteria",
      "dm.ev_autonomia": "sensor.tesla_autonomia",
      "dm.ev_cavo_collegato": "binary_sensor.tesla_cavo",
    },
  },
  {
    uid: "auto-3",
    name: "Utilitaria",
    brand: "Fiat",
    model: "Panda",
    tipo: "termica",
    img: FOTO,
    ov: {
      "dm.ev_carburante": "sensor.panda_carburante",
      "dm.ev_autonomia": "sensor.panda_autonomia",
      "dm.ev_odometro": "sensor.panda_odometro",
      "dm.ev_portiere": "lock.panda_portiere",
      "dm.ev_motore": "binary_sensor.panda_motore",
      "dm.ev_pneumatico_ant_sx": "sensor.panda_gomma_as",
      "dm.ev_pneumatico_ant_dx": "sensor.panda_gomma_ad",
      "dm.ev_pneumatico_post_sx": "sensor.panda_gomma_ps",
      "dm.ev_pneumatico_post_dx": "sensor.panda_gomma_pd",
    },
  },
];

/* Le ricariche del mese, ora per ora: di giorno col sole, di notte dalla rete. */
function storicoFinto() {
  /* [giorno, ora d'inizio, ore, kWh l'ora, sole?] */
  return [
    [2, 11, 3, 2.4, true],
    [4, 23, 5, 3.6, false],
    [7, 12, 4, 2.6, true],
    [8, 10, 2, 3.2, true],
    [11, 22, 6, 3.7, false],
    [13, 11, 4, 2.2, true],
    [15, 23, 6, 3.6, false],
    [17, 12, 3, 3.1, true],
    [19, 11, 5, 3.2, true],
    [20, 13, 2, 3.0, true],
    [20, 19, 1, 0.6, false],
  ];
}

async function avvia(page, testInfo, { tema = "dark", nuova = true, attiva = "0" } = {}) {
  test.setTimeout(120_000);
  await page.clock.setFixedTime(new Date("2026-10-20T21:40:00+02:00"));
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(
    ({ elenco, ricariche }) => {
      const ORA = 3_600_000;
      /* kWh dell'auto e della rete nell'ora che comincia a `t`. */
      const auto = new Map();
      const rete = new Map();
      for (const [giorno, ora, quante, kwh, sole] of ricariche)
        for (let i = 0; i < quante; i += 1) {
          const t = new Date(2026, 9, giorno, ora + i).getTime();
          auto.set(t, kwh);
          rete.set(t, sole ? Math.max(0, kwh * 0.25 - 0.2) : kwh + 0.3);
        }
      function righe(id, inizio, fine, passo) {
        const fuori = [];
        let somma = 1000;
        const dt = passo === "day" ? 24 * ORA : ORA;
        for (let t = inizio; t < fine; t += dt) {
          if (id.includes("wallbox")) somma += auto.get(t) || 0;
          else if (id.includes("rete")) somma += (rete.get(t) || 0) + 0.25;
          else if (id.includes("odometro"))
            somma += [0, 42, 18, 0, 63, 12, 7, 0, 120, 31][new Date(t).getDate() % 10];
          fuori.push({ start: t, end: t + dt, sum: somma, state: somma });
        }
        return fuori;
      }
      class PonteFinto extends EventTarget {
        static OPEN = 1;
        readyState = 1;
        onopen = null;
        onmessage = null;
        onclose = null;
        constructor() {
          super();
          queueMicrotask(() => {
            this.onopen?.({});
            this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
          });
        }
        send(grezzo) {
          const messaggio = JSON.parse(grezzo);
          if (messaggio.type === "auth") return;
          let risultato = null;
          if (messaggio.type === "get_states") risultato = elenco;
          else if (messaggio.type === "frontend/get_user_data") risultato = { value: null };
          else if (messaggio.type === "call_service") {
            window.__chiamate = [...(window.__chiamate || []), messaggio];
            risultato = {};
          } else if (messaggio.type === "recorder/statistics_during_period") {
            const inizio = Math.floor(new Date(messaggio.start_time).getTime() / ORA) * ORA;
            const fine = new Date(messaggio.end_time).getTime();
            const inizioGiusto =
              messaggio.period === "day"
                ? new Date(new Date(inizio).setHours(0, 0, 0, 0)).getTime()
                : inizio;
            risultato = Object.fromEntries(
              messaggio.statistic_ids.map((id) => [
                id,
                righe(id, inizioGiusto, fine, messaggio.period),
              ]),
            );
          }
          queueMicrotask(() =>
            this.onmessage?.({
              data: JSON.stringify({
                id: messaggio.id,
                type: "result",
                success: true,
                result: risultato,
              }),
            }),
          );
        }
        close() {}
      }
      window.__DASHBOARDMODERN_BRIDGE_WS__ = PonteFinto;
      window.WebSocket = PonteFinto;
    },
    { elenco: STATI, ricariche: storicoFinto() },
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction((primo) => Boolean(eval("_RAW_STATES")[primo]), STATI[0].entity_id);
  await page.waitForFunction(() => Boolean(window.cdEvApplyCar?.__dmEvSection), null, {
    timeout: 30_000,
  });
  await page.evaluate(
    ({ mappa, auto, tema, nuova, attiva }) => {
      document.documentElement.setAttribute("data-theme", tema);
      localStorage.setItem("cd_entity_overrides", JSON.stringify(mappa));
      window.cdApplyCanonicalOverrides?.(mappa);
      localStorage.setItem("cd_ev_cars", JSON.stringify(auto));
      localStorage.setItem("cd_ev_car_active", attiva);
      localStorage.setItem("cd_costo_kwh", "0.24");
      localStorage.setItem(
        "cd_fasce_kwh",
        JSON.stringify({
          quante: 3,
          voci: [
            { dalle: "08:00", prezzo: 0.29 },
            { dalle: "19:00", prezzo: 0.24 },
            { dalle: "23:00", prezzo: 0.13 },
          ],
          festivi: 2,
        }),
      );
      localStorage.setItem(
        "cd_ricarica_notte",
        JSON.stringify({
          attiva: true,
          da: "23:00",
          a: "05:00",
          poi: "prima",
          giorni: [true, true, true, true, true, false, false],
          sotto: 80,
        }),
      );
      localStorage.setItem("dm_rn_aperta", "1");
      if (nuova) localStorage.setItem("cd_auto_nuova", "1");
      window.cdEvApplyCar(Number(attiva));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { mappa: { ...BYD, ...CASA }, auto: AUTO, tema, nuova, attiva },
  );
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.locator('.tab[data-tab="ev"]').first().click();
  await expect(page.locator("#page-ev")).toHaveClass(/active/);
  await page.waitForTimeout(900);
}

async function foto(page, nome) {
  if (!process.env.DM_FOTO) return;
  await page.evaluate(() => {
    for (const nodo of document.body.querySelectorAll("*")) {
      if (nodo.closest("#page-ev")) continue;
      if (getComputedStyle(nodo).position === "fixed") nodo.style.visibility = "hidden";
    }
    window.scrollTo(0, 0);
    /* Anche il contenitore che scorre sul telefono torna in cima. */
    for (const nodo of document.querySelectorAll("*")) if (nodo.scrollTop) nodo.scrollTop = 0;
  });
  await page.waitForTimeout(500);
  /* Sul telefono la pagina scorre in un contenitore suo, e una foto «intera»
   * del documento ne vede solo il primo schermo: lo schermo si allunga quanto
   * la pagina Auto, il tempo della foto. */
  const prima = page.viewportSize();
  const alta = await page.evaluate(() => {
    const pagina = document.getElementById("page-ev");
    return Math.ceil(
      pagina.getBoundingClientRect().top + window.scrollY + pagina.scrollHeight + 40,
    );
  });
  if (alta > prima.height) await page.setViewportSize({ width: prima.width, height: alta });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${process.env.DM_FOTO}/${nome}.png`, fullPage: true });
  await page.setViewportSize(prima);
}

async function nienteSborda(page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);
  const fuori = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        "#dm-na :is(.dm-na-carta,.dm-na-tessera,.dm-na-ricarica,.dm-na-modo,.dm-na-linguetta)",
      ),
    ]
      .filter((nodo) => nodo.offsetParent !== null)
      .filter((nodo) => nodo.scrollWidth > nodo.clientWidth + 1)
      .map(
        (nodo) => `${nodo.className} ${nodo.textContent.replace(/\s+/g, " ").trim().slice(0, 40)}`,
      ),
  );
  expect(fuori).toEqual([]);
}

const na = (page) => page.locator("#dm-na");

for (const tema of ["dark", "light"])
  test(`la ricarica, col garage e lo storico dei 7 giorni (${tema})`, async ({
    page,
  }, testInfo) => {
    await avvia(page, testInfo, { tema });
    const pagina = na(page);
    await expect(pagina).toBeVisible();
    /* La pagina di oggi non si vede, la testata si'. */
    await expect(page.locator("#page-ev .dm-page-mast")).toBeVisible();
    await expect(page.locator("#page-ev .dm-evv-power")).toBeHidden();
    /* Il garage: tre auto, la BYD scelta. */
    await expect(pagina.locator(".dm-na-garage-auto")).toHaveCount(3);
    await expect(pagina.locator('.dm-na-garage-auto[aria-pressed="true"]')).toContainText(
      "BYD Atto 3",
    );
    await expect(pagina.locator(".dm-na-garage-auto").nth(2)).toContainText("40%");
    /* L'eroe: logo, modello, autonomia, batteria, in carica. */
    await expect(pagina.locator(".dm-na-eroe-nome")).toContainText("BYD Atto 3");
    await expect(pagina.locator(".dm-na-eroe-nome")).toContainText("SUV di casa");
    await expect(pagina.locator(".dm-na-autonomia")).toContainText("262");
    await expect(pagina.locator(".dm-na-stato")).toContainText("In carica · 3,70 kW");
    /* evcc: tre modi, Intelligente acceso, e il «sempre» su Sempre. */
    await expect(pagina.locator(".dm-na-modo")).toHaveText([/Spento/, /Intelligente/, /Fast/]);
    await expect(pagina.locator('.dm-na-modo[aria-pressed="true"]')).toContainText("Intelligente");
    await expect(pagina.locator('[data-na-sempre][aria-pressed="true"]')).toHaveText("Sempre");
    /* La notte e' la carta di sempre, spostata qui. */
    await expect(pagina.locator('[data-na-posto="notte"] #dm-rn')).toBeVisible();
    /* Lo storico: sette colonne, e le ricariche dal Recorder. */
    await expect(pagina.locator(".dm-na-storico .dm-na-colonna")).toHaveCount(7);
    await expect(pagina.locator(".dm-na-ricarica").first()).toContainText("kWh");
    await nienteSborda(page);
    await foto(page, `ricarica-7-${tema}-${testInfo.project.name}`);
  });

test("la percentuale si sceglie libera e va all'entita'", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  const pagina = na(page);
  await pagina.locator('[data-na-passo="1"]').click();
  await expect(pagina.locator("[data-na-pct]")).toHaveText("85");
  await pagina.locator('[data-na-pct-scelta="90"]').click();
  await expect(pagina.locator("[data-na-pct]")).toHaveText("90");
  const chiamate = await page.evaluate(() =>
    (window.__chiamate || [])
      .filter((c) => c.service_data?.entity_id === "number.byd_limite")
      .map((c) => c.service_data.value),
  );
  expect(chiamate).toEqual([85, 90]);
  /* E il modo di evcc va alla sua entita'. */
  await pagina.locator('[data-na-modo="now"]').click();
  await expect
    .poll(() =>
      page.evaluate(() => (window.__chiamate || []).some((c) => c.service_data?.option === "now")),
    )
    .toBe(true);
});

test("il mese e il periodo dallo storico", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  const pagina = na(page);
  await pagina.locator('[data-na-vista="mese"][data-na-gruppo="storico"]').click();
  await expect(pagina.locator(".dm-na-mese b")).toContainText(/ottobre 2026/i);
  await expect(pagina.locator(".dm-na-storico .dm-na-colonna")).toHaveCount(31);
  /* Dieci ricariche in ottobre fino a oggi (le due di stasera sono una sola? no: un'ora ferma le unisce). */
  await expect(pagina.locator(".dm-na-tutte")).toContainText("(");
  await nienteSborda(page);
  await foto(page, `ricarica-mese-dark-${testInfo.project.name}`);
  await pagina.locator(".dm-na-tutte").click();
  await expect(pagina.locator(".dm-na-ricarica").nth(5)).toBeVisible();
  await pagina.locator('[data-na-mese="-1"]').click();
  await expect(pagina.locator(".dm-na-mese b")).toContainText(/settembre 2026/i);
  await expect(pagina.locator(".dm-na-storico .dm-na-colonna")).toHaveCount(30);
  /* Il periodo si guarda col tema chiaro. */
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await pagina.locator('[data-na-vista="periodo"]').click();
  await pagina.locator("[data-na-dal]").fill("2026-10-05");
  await pagina.locator("[data-na-dal]").dispatchEvent("change");
  await pagina.locator("[data-na-al]").fill("2026-10-18");
  await pagina.locator("[data-na-al]").dispatchEvent("change");
  await expect(pagina.locator(".dm-na-storico .dm-na-colonna")).toHaveCount(14);
  await nienteSborda(page);
  await foto(page, `ricarica-periodo-light-${testInfo.project.name}`);
});

test("viaggi e stato dell'auto", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  const pagina = na(page);
  await pagina.locator('[data-na-linguetta="viaggi"]').click();
  await expect(pagina.locator(".dm-na-storico .dm-na-colonna")).toHaveCount(7);
  await expect(pagina).toContainText("Energia di oggi");
  await nienteSborda(page);
  await foto(page, `viaggi-dark-${testInfo.project.name}`);
  await pagina.locator('[data-na-linguetta="stato"]').click();
  await expect(pagina.locator(".dm-na-ruota")).toHaveCount(4);
  /* La posteriore destra sta 0,3 bar sotto le altre: da controllare. */
  await expect(pagina.locator('.dm-na-ruota[data-tono="bassa"]')).toHaveCount(1);
  await expect(pagina.locator('[data-na-linguetta="stato"] em')).toHaveText("attenzione");
  await nienteSborda(page);
  await foto(page, `stato-dark-${testInfo.project.name}`);
});

test("l'auto a benzina non ha la ricarica", async ({ page }, testInfo) => {
  await avvia(page, testInfo, { tema: "light" });
  const pagina = na(page);
  await pagina.locator('[data-na-auto="2"]').click();
  await expect(pagina.locator(".dm-na-eroe-nome")).toContainText("Fiat Panda");
  await expect(pagina.locator('[data-na-linguetta="ricarica"]')).toHaveCount(0);
  await expect(pagina.locator(".dm-na-batteria[data-tipo='carburante']")).toContainText("40");
  await nienteSborda(page);
  await foto(page, `panda-light-${testInfo.project.name}`);
});

test("senza l'interruttore la pagina e' quella di oggi", async ({ page }, testInfo) => {
  await avvia(page, testInfo, { nuova: false });
  await expect(page.locator("#dm-na")).toHaveCount(0);
  await expect(page.locator("#page-ev .dm-evv-power")).toBeVisible();
});
