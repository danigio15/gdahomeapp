/* «Restano solo il meteo e il pallino verde.» iPhone, dentro l'app: dalla
 * Home all'Energia e indietro, poi Sport, Salute e Batterie con la barra in
 * basso, tornando ogni volta alla Home. Dopo le Batterie la prima fila della
 * testata — il menu, il nome della casa — e con lei il fondo della testata e
 * l'ora non si vedono piu', e non tornano.
 *
 * Le misure erano sempre giuste: larga, alta, al suo posto. Per questo ogni
 * prova che guardava le misure passava. Quello che mancava era il disegno:
 * nella Home la testata era l'unica cosa dipinta «in flusso», senza una
 * posizione ne' uno strato suo, e WebKit, al ritorno da una pagina corta come
 * le Batterie, rimetteva sopra di lei il fondale fisso con le sue macchie
 * (`.animated-mesh-bg`). Restavano proprio i due pezzi che uno strato ce
 * l'hanno — il meteo e il pallino che pulsa.
 *
 * Qui si rifa' la strada del video come la fa l'app: l'ingranaggio spento dal
 * foglio dell'app (`app/lib/plancia/premesse.dart`), la fascia dell'orologio,
 * il telefono a 390 per 844 col dito, gli stati che arrivano di continuo. A
 * ogni ritorno si guarda che la prima fila abbia le sue misure, che a mostrarla
 * non sia lo stile in linea «spenta», e che tutto quello che la testata dipinge
 * stia in uno strato sopra il fondale. Gira anche su WebKit, nel giro «La
 * testata su Safari». */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [{ id: "l1", name: "Cucina", entity: "light.cucina" }],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: { grid: { power: "sensor.rete_w" } },
    entityOverrides: { "dm.home_meteo": "weather.casa" },
  },
  visibility: { home: true, energy: true, batterie: true },
};

const batteria = (livello, nome) => ({
  state: String(livello),
  attributes: { device_class: "battery", unit_of_measurement: "%", friendly_name: nome },
});
const misura = (valore, nome, unita, classe = "measurement") => ({
  state: String(valore),
  attributes: {
    friendly_name: nome,
    unit_of_measurement: unita,
    state_class: classe,
    gdahome_persona: "Ada",
    misurato_il: "2026-11-23T20:20:00Z",
  },
  last_changed: "2026-11-23T20:20:00Z",
  last_updated: "2026-11-23T20:20:00Z",
});
const STATI = {
  "light.cucina": { state: "on", attributes: { friendly_name: "Cucina" } },
  "sensor.rete_w": { state: "350", attributes: { unit_of_measurement: "W" } },
  "weather.casa": {
    state: "clear-night",
    attributes: { friendly_name: "Casa", temperature: 11.1, humidity: 87, wind_speed: 10.8 },
  },
  "sensor.porta_batteria": batteria(100, "Porta ingresso"),
  "sensor.sonda_batteria": batteria(12, "Sonda"),
  "sensor.gdahome_1a2b3c4d_passi": misura(1544, "Ada Steps", "steps", "total_increasing"),
  "sensor.gdahome_1a2b3c4d_battito": misura(90, "Ada Heart rate", "bpm"),
};

async function avvia(page, testInfo) {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page
    .waitForFunction(
      () => {
        const velo = document.getElementById("cd-boot-overlay");
        return !velo || !velo.getClientRects().length || getComputedStyle(velo).opacity === "0";
      },
      null,
      { timeout: 30_000 },
    )
    .catch(() => {});
  await page.evaluate((stati) => {
    /* Quello che l'app mette in fondo alla pagina: l'ingranaggio spento (la
     * Config si apre dal menu dell'app) e la fascia dell'orologio. */
    const app = document.createElement("style");
    app.id = "gdahome-config-fuori";
    app.textContent = "html body header .dm-editor-entry{display:none!important}";
    const misure = document.createElement("style");
    misure.id = "gdahome-misure";
    misure.textContent =
      ":root{--gdahome-alto:59px;--gdahome-basso:0px}html body{padding-top:var(--gdahome-alto)!important}";
    document.body.append(app, misure);
    /* Lo sport seguito e le batterie sorvegliate: le voci della barra. */
    localStorage.setItem("cd_sport", JSON.stringify({ seguiti: [{ tipo: "f1", preferito: "" }] }));
    localStorage.setItem(
      "cd_gruppi_extra",
      JSON.stringify({ batt: ["sensor.porta_batteria", "sensor.sonda_batteria"] }),
    );
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    /* E gli stati che non smettono di arrivare, come da una casa vera. */
    window.__dmProvaStati = setInterval(
      () => window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} })),
      300,
    );
  }, STATI);
}

const segno = (page) => page.evaluate(() => document.body.dataset.dmPagina || "");

/* La voce si preme come la preme un dito; se la barra la tiene fuori vista
 * (le voci sono tante e la barra scorre) la si porta in vista prima. */
async function vaiA(page, voce) {
  await page.evaluate((nome) => {
    const tasto = document.querySelector(`.tab[data-tab="${nome}"]`);
    tasto?.scrollIntoView({ block: "nearest", inline: "center" });
    tasto?.click();
  }, voce);
  await expect.poll(() => segno(page)).toBe(`page-${voce}`);
}

/* Com'e' la testata adesso: le misure della prima fila, e chi dei suoi pezzi
 * si dipinge in flusso — cioe' senza uno strato suo fra lui e il corpo. */
function laTestata(page) {
  return page.evaluate(() => {
    const testata = document.querySelector("body>header:not(.dm-page-mast)");
    const strato = (nodo) => {
      for (let x = nodo; x && x !== document.body; x = x.parentElement) {
        const s = getComputedStyle(x);
        if (s.position !== "static" && s.zIndex !== "auto") return true;
        if (s.transform !== "none" || s.isolation === "isolate" || Number(s.opacity) < 1)
          return true;
      }
      return false;
    };
    const fila = {};
    for (const [nome, sel] of Object.entries({
      sinistra: ":scope > .header-left-wrap",
      menu: ".ha-menu-btn",
      nome: ".brand-text h1",
      riquadro: ".dm-testata-riga",
      ora: ".dm-orologio-ora",
    })) {
      const nodo = testata?.querySelector(sel);
      if (!nodo) {
        fila[nome] = { manca: true };
        continue;
      }
      const r = nodo.getBoundingClientRect();
      fila[nome] = {
        largo: Math.round(r.width),
        alto: Math.round(r.height),
        y: Math.round(r.top),
        inStrato: strato(nodo),
      };
    }
    const fondale = document.querySelector(".animated-mesh-bg");
    return {
      fila,
      testataInStrato: Boolean(testata && strato(testata)),
      zTestata: testata ? getComputedStyle(testata).zIndex : "",
      zFondale: fondale ? getComputedStyle(fondale).zIndex : "",
      inLinea: testata?.style.getPropertyValue("display") || "",
      display: testata ? getComputedStyle(testata).display : "",
      cima: Math.round(parseFloat(getComputedStyle(document.body).paddingTop) || 0),
    };
  });
}

async function guardaLaTestata(page, passo, testInfo) {
  await page.waitForTimeout(600);
  const com = await laTestata(page);
  console.log(`[testata] ${testInfo.project.name} ${passo}: ${JSON.stringify(com)}`);
  if (process.env.DM_FOTO)
    await page.screenshot({
      path: `${process.env.DM_FOTO}/dipinta-${testInfo.project.name}-${passo}.png`,
    });
  expect(com.display, `${passo}: la testata e' accesa`).toBe("flex");
  expect(com.inLinea, `${passo}: nessuno stile in linea la tiene spenta`).not.toBe("none");
  expect(com.testataInStrato, `${passo}: la testata ha uno strato suo`).toBe(true);
  expect(Number(com.zTestata), `${passo}: la testata sta sopra il fondale`).toBeGreaterThan(
    Number(com.zFondale || -1),
  );
  for (const pezzo of ["sinistra", "menu", "nome", "riquadro", "ora"]) {
    const misure = com.fila[pezzo];
    expect(misure.manca, `${passo}: ${pezzo} c'e'`).toBeUndefined();
    expect(misure.largo, `${passo}: ${pezzo} ha una larghezza`).toBeGreaterThan(8);
    expect(misure.alto, `${passo}: ${pezzo} ha un'altezza`).toBeGreaterThan(8);
    expect(misure.y, `${passo}: ${pezzo} sta sotto la fascia`).toBeGreaterThanOrEqual(com.cima - 1);
    expect(misure.inStrato, `${passo}: ${pezzo} non si dipinge in flusso`).toBe(true);
  }
}

test("la strada del video: Energia, Sport, Salute e Batterie, e la testata resta dipinta", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await expect.poll(() => segno(page)).toBe("page-home");
  await guardaLaTestata(page, "0-avvio", testInfo);
  let passo = 1;
  for (const voce of ["energy", "sport", "salute", "batterie", "sport", "batterie"]) {
    await vaiA(page, voce);
    await page.waitForTimeout(500);
    await vaiA(page, "home");
    await guardaLaTestata(page, `${passo++}-da-${voce}`, testInfo);
  }
  /* E ferma sulla Home, con gli stati che continuano ad arrivare. */
  await page.waitForTimeout(2_000);
  await guardaLaTestata(page, `${passo}-ferma`, testInfo);
});
