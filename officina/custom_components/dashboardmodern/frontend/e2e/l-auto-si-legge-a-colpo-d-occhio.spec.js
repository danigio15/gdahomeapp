/* La pagina Auto si legge a colpo d'occhio.
 *
 * «Nella sezione Auto riesci a fare qualcosa di piu' bello con tutti sti dati,
 * cosi' non si capisce niente.» Un'auto elettrica che arriva da GdAAuto porta
 * una ventina di dati, e la pagina li metteva in fila in una griglia di
 * tessere tutte uguali, con etichette lunghe in maiuscolo: il consumo accanto
 * alla marcia, l'energia di oggi divisa in tre caselle, «1045 min».
 *
 * Qui l'auto della casa e' quella della fotografia del campo — un SUV
 * elettrico in carica al 67,8% — e un'auto a benzina accanto: si guarda che
 * ogni dato stia nel suo blocco, e che niente esca dallo schermo.
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
      <ellipse cx="600" cy="470" rx="470" ry="26" fill="#000" opacity=".18"/>
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
    friendly_name: `Auto di casa ${entity_id
      .split(".")[1]
      .replace(/^auto_/, "")
      .replace(/_/g, " ")}`,
    ...(unit ? { unit_of_measurement: unit } : {}),
    ...extra,
  },
});

/* L'elettrica, come la manda GdAAuto. */
function elettrica({ inCarica = true, batteria, tutta = false } = {}) {
  const stati = [
    s("sensor.auto_batteria", batteria ?? (inCarica ? "67.8" : "81"), "%", {
      device_class: "battery",
    }),
    s("sensor.auto_autonomia", inCarica ? "262" : "318", "km", { device_class: "distance" }),
    s("sensor.auto_autonomia_nominale", "294", "km"),
    s("sensor.auto_consumo_medio", "16", "kWh/100 km"),
    s("sensor.auto_temperatura_batteria", "21", "°C", { device_class: "temperature" }),
    s("sensor.auto_temperatura_interna", "24", "°C", { device_class: "temperature" }),
    s("sensor.auto_potenza_ricarica", inCarica ? "1.2" : "0", "kW", { device_class: "power" }),
    s("sensor.auto_tempo_ricarica", inCarica ? "1045" : "0", "min", { device_class: "duration" }),
    s("sensor.auto_energia_oggi_guida", inCarica ? "0.1" : "4.2", "kWh"),
    s("sensor.auto_energia_oggi_clima", inCarica ? "0" : "0.8", "kWh"),
    s("sensor.auto_energia_oggi_altro", inCarica ? "0" : "0.3", "kWh"),
    s("sensor.auto_km_7_giorni", "411", "km"),
    s("sensor.auto_energia_7_giorni", "57", "kWh"),
    s("sensor.auto_marcia", "parcheggio"),
    s("binary_sensor.auto_freno_stazionamento", "on"),
    s("sensor.auto_ultimo_aggiornamento", "2026-10-18T20:00:00+00:00", "", {
      device_class: "timestamp",
    }),
    s("sensor.auto_pneumatico_ant_sx", "2.3", "bar", { device_class: "pressure" }),
    s("sensor.auto_pneumatico_ant_dx", "2.3", "bar", { device_class: "pressure" }),
    s("sensor.auto_pneumatico_post_sx", "2.3", "bar", { device_class: "pressure" }),
    s("sensor.auto_pneumatico_post_dx", inCarica ? "2.3" : "1.7", "bar", {
      device_class: "pressure",
    }),
    s("binary_sensor.auto_pneumatici_allarme", inCarica ? "off" : "on"),
    s("sensor.auto_stato_ricarica", inCarica ? "in_carica" : "non_in_carica"),
    s("binary_sensor.auto_cavo", inCarica ? "on" : "off", "", { device_class: "plug" }),
    s("number.auto_limite", "100", "%", { min: 50, max: 100, step: 5 }),
    s("lock.auto_serratura", "locked"),
    s("sensor.auto_odometro", "18240", "km"),
    /* Come l'auto della foto dal campo: otto stati, non tre. */
    ...(tutta
      ? [
          s("binary_sensor.auto_finestrini", "off", "", { device_class: "window" }),
          s("binary_sensor.auto_bagagliaio", "off", "", { device_class: "opening" }),
          s("binary_sensor.auto_allarme", "on"),
          s("device_tracker.auto", "Lavoro"),
          s("binary_sensor.auto_in_sonno", "on"),
        ]
      : []),
  ];
  const mappa = {
    "dm.ev_batteria_auto": "sensor.auto_batteria",
    "dm.ev_autonomia": "sensor.auto_autonomia",
    "dm.ev_autonomia_nominale": "sensor.auto_autonomia_nominale",
    "dm.ev_consumo_medio": "sensor.auto_consumo_medio",
    "dm.ev_temperatura_batteria": "sensor.auto_temperatura_batteria",
    "dm.ev_temperatura_interna": "sensor.auto_temperatura_interna",
    "dm.ev_potenza_ricarica": "sensor.auto_potenza_ricarica",
    "dm.ev_tempo_ricarica": "sensor.auto_tempo_ricarica",
    "dm.ev_energia_oggi_guida": "sensor.auto_energia_oggi_guida",
    "dm.ev_energia_oggi_clima": "sensor.auto_energia_oggi_clima",
    "dm.ev_energia_oggi_altro": "sensor.auto_energia_oggi_altro",
    "dm.ev_km_7_giorni": "sensor.auto_km_7_giorni",
    "dm.ev_energia_7_giorni": "sensor.auto_energia_7_giorni",
    "dm.ev_marcia": "sensor.auto_marcia",
    "dm.ev_freno_stazionamento": "binary_sensor.auto_freno_stazionamento",
    "dm.ev_ultimo_aggiornamento": "sensor.auto_ultimo_aggiornamento",
    "dm.ev_pneumatico_ant_sx": "sensor.auto_pneumatico_ant_sx",
    "dm.ev_pneumatico_ant_dx": "sensor.auto_pneumatico_ant_dx",
    "dm.ev_pneumatico_post_sx": "sensor.auto_pneumatico_post_sx",
    "dm.ev_pneumatico_post_dx": "sensor.auto_pneumatico_post_dx",
    "dm.ev_pneumatici": "binary_sensor.auto_pneumatici_allarme",
    "dm.ev_stato_ricarica": "sensor.auto_stato_ricarica",
    "dm.ev_cavo_collegato": "binary_sensor.auto_cavo",
    "dm.ev_target_soc": "number.auto_limite",
    "dm.ev_portiere": "lock.auto_serratura",
    "dm.ev_odometro": "sensor.auto_odometro",
    ...(tutta
      ? {
          "dm.ev_finestrini": "binary_sensor.auto_finestrini",
          "dm.ev_bagagliaio": "binary_sensor.auto_bagagliaio",
          "dm.ev_allarme": "binary_sensor.auto_allarme",
          "dm.ev_posizione": "device_tracker.auto",
          "dm.ev_in_sonno": "binary_sensor.auto_in_sonno",
        }
      : {}),
  };
  return {
    stati,
    mappa,
    auto: { uid: "auto-1", name: "Auto di casa", tipo: "", kwh: "67", img: FOTO, ov: mappa },
  };
}

/* Quella a benzina: serbatoio, portiere, motore, le gomme. */
function termica() {
  const stati = [
    s("sensor.panda_carburante", "54", "%"),
    s("sensor.panda_autonomia", "610", "km", { device_class: "distance" }),
    s("sensor.panda_odometro", "48210", "km"),
    s("lock.panda_portiere", "locked"),
    s("binary_sensor.panda_motore", "off"),
    s("binary_sensor.panda_finestrini", "off"),
    s("sensor.panda_batteria_12v", "12.6", "V", { device_class: "voltage" }),
    s("sensor.panda_esterna", "14", "°C", { device_class: "temperature" }),
    s("sensor.panda_ultimo_viaggio", "23.4", "km"),
    s("sensor.panda_gomma_as", "2.2", "bar"),
    s("sensor.panda_gomma_ad", "2.2", "bar"),
    s("sensor.panda_gomma_ps", "2.1", "bar"),
    s("sensor.panda_gomma_pd", "2.1", "bar"),
    s("device_tracker.panda", "home"),
  ];
  const mappa = {
    "dm.ev_carburante": "sensor.panda_carburante",
    "dm.ev_autonomia": "sensor.panda_autonomia",
    "dm.ev_odometro": "sensor.panda_odometro",
    "dm.ev_portiere": "lock.panda_portiere",
    "dm.ev_motore": "binary_sensor.panda_motore",
    "dm.ev_finestrini": "binary_sensor.panda_finestrini",
    "dm.ev_batteria_servizio": "sensor.panda_batteria_12v",
    "dm.ev_temperatura_esterna": "sensor.panda_esterna",
    "dm.ev_ultimo_viaggio": "sensor.panda_ultimo_viaggio",
    "dm.ev_pneumatico_ant_sx": "sensor.panda_gomma_as",
    "dm.ev_pneumatico_ant_dx": "sensor.panda_gomma_ad",
    "dm.ev_pneumatico_post_sx": "sensor.panda_gomma_ps",
    "dm.ev_pneumatico_post_dx": "sensor.panda_gomma_pd",
    "dm.ev_posizione": "device_tracker.panda",
  };
  return {
    stati,
    mappa,
    auto: { uid: "auto-2", name: "Utilitaria", tipo: "termica", img: FOTO, ov: mappa },
  };
}

async function avvia(page, testInfo, { stati, mappa, auto }, tema = "dark") {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 150_000 : 90_000);
  await page.clock.setFixedTime(new Date("2026-10-18T22:10:00+02:00"));
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript((elenco) => {
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
        else if (messaggio.type === "call_service") risultato = {};
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
  }, stati);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction((primo) => Boolean(eval("_RAW_STATES")[primo]), stati[0].entity_id);
  await page.waitForFunction(() => Boolean(window.cdEvApplyCar?.__dmEvSection), null, {
    timeout: 30_000,
  });
  await page.evaluate(
    ({ mappa, auto, tema }) => {
      document.documentElement.setAttribute("data-theme", tema);
      localStorage.setItem("cd_entity_overrides", JSON.stringify(mappa));
      window.cdApplyCanonicalOverrides?.(mappa);
      localStorage.setItem("cd_ev_cars", JSON.stringify([auto]));
      localStorage.setItem("cd_ev_car_active", "0");
      window.cdEvApplyCar(0);
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { mappa, auto, tema },
  );
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.locator('.tab[data-tab="ev"]').first().click();
  await expect(page.locator("#page-ev")).toHaveClass(/active/);
  await page.waitForTimeout(900);
}

/* Una foto di tutta la pagina Auto, quando la si chiede (DM_FOTO=cartella). */
async function foto(page, nome) {
  if (!process.env.DM_FOTO) return;
  /* La barra in basso e i pulsanti che galleggiano stanno fermi sullo
   * schermo: in una foto di tutta la pagina finirebbero in mezzo ai blocchi. */
  await page.evaluate(() => {
    for (const nodo of document.body.querySelectorAll("*")) {
      if (nodo.closest("#page-ev")) continue;
      if (getComputedStyle(nodo).position === "fixed") nodo.style.visibility = "hidden";
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${process.env.DM_FOTO}/${nome}.png`, fullPage: true });
}

/* Niente esce dallo schermo e niente si taglia: la pagina non scorre di
 * lato, e ogni carta tiene dentro quello che scrive. */
async function nienteSborda(page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);
  const fuori = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        "#page-ev :is(.dm-auto-carta,.dm-auto-testa,.dm-auto-dato,.dm-termica-gomma,.dm-termica-misura,.dm-evv-power)",
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

const testo = (locator) => locator.evaluate((nodo) => nodo.textContent.replace(/\s+/g, " ").trim());

test.describe("la pagina Auto in blocchi", () => {
  test("l'elettrica in carica: anello, ricarica, energia, settimana, temperature, gomme", async ({
    page,
  }, testInfo) => {
    await avvia(page, testInfo, elettrica());
    const anello = page.locator("#page-ev .dm-evv-power");
    /* Accanto all'anello: l'autonomia grande, la marcia, il freno, l'ora. */
    const testa = anello.locator(".dm-auto-testa");
    await expect(testa.locator(".dm-auto-autonomia")).toContainText("262");
    await expect(testa.locator(".dm-auto-autonomia")).toContainText("omologazione 294 km");
    await expect(testa.locator('[data-dm-marcia="P"]')).toContainText("Parcheggiata");
    await expect(testa).toContainText("Freno tirato");
    await expect(testa.locator(".dm-auto-aggiornata")).toContainText("Aggiornata alle 22:00");
    /* La ricarica: la potenza e il tempo che dice l'auto, in ore e minuti. */
    await expect(anello.locator(".dm-evv-row-val.v-ev-pow")).toHaveText("1,20 kW");
    const tempo = anello.locator(".dm-evv-row-val.v-ev-remain");
    await expect(tempo).toContainText("17 h 25 min");
    await expect(tempo.locator(".dm-ev-fine")).toHaveText("fine domani alle 15:35");
    await expect(anello.locator('[data-dm-riga="target"] .dm-evv-row-lbl')).toHaveText(
      "Autonomia al 100%",
    );
    /* «1045 min» non si legge da nessuna parte. */
    expect(await testo(page.locator("#page-ev"))).not.toMatch(/1[.,]?045\s*min/);

    const blocco = page.locator("#page-ev .dm-termica");
    await expect(blocco.locator('[data-carta="energia"] .dm-auto-totale')).toContainText("0,1");
    await expect(blocco.locator('[data-carta="energia"] .dm-auto-voce')).toHaveCount(3);
    await expect(blocco.locator('[data-carta="settimana"] .dm-auto-dato')).toHaveCount(3);
    await expect(blocco.locator('[data-carta="settimana"]')).toContainText("411");
    await expect(blocco.locator('[data-carta="temperature"] .dm-auto-dato')).toHaveCount(2);
    const gomme = blocco.locator('[data-carta="gomme"]');
    await expect(gomme.locator(".dm-termica-gomma")).toHaveCount(4);
    await expect(gomme.locator('.dm-termica-gomma[data-tono="bene"]')).toHaveCount(4);
    await expect(gomme.locator(".dm-termica-gomme-auto")).toHaveCount(1);
    await expect(gomme.locator(".dm-auto-didascalia")).toContainText("Pneumatici a posto");
    /* Le vecchie tessere uguali non ci sono piu', e niente sta due volte. */
    await expect(blocco.locator(".dm-termica-griglia")).toHaveCount(0);
    await expect(blocco.locator(".dm-auto-altri .dm-auto-riga")).toHaveCount(1);
    await nienteSborda(page);
  });

  test("l'elettrica ferma: niente righe della ricarica, e la gomma bassa si vede", async ({
    page,
  }, testInfo) => {
    await avvia(page, testInfo, elettrica({ inCarica: false }));
    const anello = page.locator("#page-ev .dm-evv-power");
    await expect(anello).toHaveAttribute("data-dm-ricarica", "ferma");
    await expect(anello.locator('[data-dm-riga="potenza"]')).toBeHidden();
    await expect(anello.locator('[data-dm-riga="tempo"]')).toBeHidden();
    await expect(anello.locator('[data-dm-riga="target"]')).toBeVisible();
    const gomme = page.locator('#page-ev [data-carta="gomme"]');
    await expect(gomme.locator('.dm-termica-gomma[data-ruota="postDx"]')).toHaveAttribute(
      "data-tono",
      "bassa",
    );
    await expect(gomme.locator(".dm-auto-didascalia")).toContainText("da controllare");
    await expect(page.locator('#page-ev [data-carta="energia"] .dm-auto-totale')).toContainText(
      "5,3",
    );
    await nienteSborda(page);
  });

  test("l'auto a benzina: il serbatoio, le pillole, le gomme, niente ricarica", async ({
    page,
  }, testInfo) => {
    await avvia(page, testInfo, termica());
    const blocco = page.locator("#page-ev .dm-termica");
    await expect(blocco.locator(".dm-termica-serbatoio")).toContainText("54");
    await expect(
      blocco.locator('.dm-termica-misura[data-dm-storico="dm.ev_autonomia"]'),
    ).toContainText("610");
    await expect(blocco.locator(".dm-termica-pillole")).toContainText("Portiere bloccate");
    await expect(blocco.locator('[data-carta="temperature"]')).toContainText("14°");
    await expect(blocco.locator('[data-carta="gomme"] .dm-termica-gomma')).toHaveCount(4);
    /* Nessun blocco dell'elettrica su un'auto a benzina. */
    await expect(blocco.locator('[data-carta="energia"]')).toHaveCount(0);
    await expect(page.locator("#page-ev .dm-evv-rows")).toBeHidden();
    await nienteSborda(page);
  });
});

test.describe("l'anello e le righe accanto", () => {
  for (const [schermo, misure] of [
    ["telefono", { width: 390, height: 844 }],
    ["tablet", { width: 1280, height: 800 }],
  ]) {
    test(`${schermo}: la percentuale sta nel cerchio, e l'autonomia al target sta sotto l'autonomia`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "una volta basta");
      await page.setViewportSize(misure);
      /* «Riesci a sistemarlo meglio, la percentuale batteria non entra nel
       * cerchio»: il guscio scriveva «86.6%» in trentaquattro punti. */
      await avvia(page, testInfo, elettrica({ inCarica: false, batteria: "86.6" }), "light");
      const anello = page.locator("#page-ev .dm-evv-power");
      const soc = anello.locator(".dm-evv-gauge .dm-auto-soc");
      await expect(soc).toHaveText("87%");
      const dentro = await anello.evaluate((potenza) => {
        const cerchio = potenza.querySelector(".dm-evv-gauge").getBoundingClientRect();
        const numero = potenza.querySelector(".dm-auto-soc").getBoundingClientRect();
        /* Il vuoto dentro l'anello: il cerchio meno il suo spessore. */
        const spessore = (cerchio.width * 9) / 120;
        const raggio = cerchio.width / 2 - spessore;
        const cx = cerchio.left + cerchio.width / 2;
        const cy = cerchio.top + cerchio.height / 2;
        return [
          [numero.left, numero.top],
          [numero.right, numero.top],
          [numero.left, numero.bottom],
          [numero.right, numero.bottom],
        ].every(([x, y]) => Math.hypot(x - cx, y - cy) <= raggio);
      });
      expect(dentro).toBe(true);
      /* Il target si legge subito sotto l'autonomia, prima delle pillole. */
      const sopra = await anello.evaluate((potenza) => {
        const y = (sel) => potenza.querySelector(sel).getBoundingClientRect().top;
        return {
          autonomia: y(".dm-auto-autonomia"),
          target: y('.dm-evv-row[data-dm-riga="target"]'),
          aggiornata: y(".dm-auto-aggiornata"),
        };
      });
      expect(sopra.target).toBeGreaterThan(sopra.autonomia);
      expect(sopra.target).toBeLessThan(sopra.aggiornata);
      await nienteSborda(page);
    });
  }
});

/* L'auto della foto dal campo: ferma, all'86,6%, con tutti i suoi stati. */
const comeQuellaDelCampo = () => elettrica({ inCarica: false, batteria: "86.6", tutta: true });

const DIMENSIONI = {
  tablet: { width: 1280, height: 800 },
  fold: { width: 2000, height: 1500 },
  telefono: { width: 390, height: 844 },
  foldAperto: { width: 900, height: 1100 },
};

test.describe("le foto della pagina Auto", () => {
  test.skip(() => !process.env.DM_FOTO, "solo quando si chiedono le foto");
  for (const [nome, dati, schermo, tema] of [
    ["ev-carica-1280-scuro", () => elettrica(), "tablet", "dark"],
    ["ev-carica-1280-chiaro", () => elettrica(), "tablet", "light"],
    ["ev-carica-390-scuro", () => elettrica(), "telefono", "dark"],
    ["ev-carica-2000-scuro", () => elettrica(), "fold", "dark"],
    ["ev-ferma-1280-scuro", () => elettrica({ inCarica: false }), "tablet", "dark"],
    ["ev-ferma-390-chiaro", () => comeQuellaDelCampo(), "telefono", "light"],
    ["ev-ferma-390-scuro", () => comeQuellaDelCampo(), "telefono", "dark"],
    ["ev-ferma-900-chiaro", () => comeQuellaDelCampo(), "foldAperto", "light"],
    ["ev-ferma-1280-chiaro", () => comeQuellaDelCampo(), "tablet", "light"],
    ["termica-1280-scuro", () => termica(), "tablet", "dark"],
    ["termica-390-chiaro", () => termica(), "telefono", "light"],
  ])
    test(nome, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "le foto si fanno una volta");
      await page.setViewportSize(DIMENSIONI[schermo]);
      await avvia(page, testInfo, dati(), tema);
      await foto(page, `${process.env.DM_PREFISSO || ""}${nome}`);
    });
});
