/* «Ci vogliono caratteristiche particolari del tablet per far girare l'app
 * del 3D?» — la Casa 3D si apre su ogni dispositivo.
 *
 * Un tablet col solo WebGL 1 (il motore del 3D vuole il 2) apriva la casa e
 * restava lo sfondo con «La casa in 3D non si apre». Adesso la casa si apre
 * in pianta: i piani visti dall'alto, coi dispositivi da toccare come nel 3D,
 * senza scaricare il motore. E chi ha il 3D puo' scegliere la pianta, piu'
 * leggera, e tornare indietro; la scelta resta a quel dispositivo.
 *
 * La villa finta e gli stati sono gli stessi di `la-casa-3d.spec.js`.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { casa3dPulita, comprimiGriglia } from "../src/core/casa-3d.js";

/* La scena e' WebGL: nel browser senza schermo la disegna SwiftShader. */
test.describe.configure({ mode: "serial" });
test.use({
  launchOptions: {
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  },
});

const ADESSO = Date.parse("2026-10-25T12:30:00Z");

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
  },
  visibility: { home: true },
};

const W = 240;
const H = 180;
function griglia() {
  const t = new Int16Array(W * H).fill(-2);
  const set = (x0, y0, x1, y1, v) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) t[y * W + x] = v;
  };
  set(0, 0, W, H, -3);
  set(6, 6, 140, 174, 1);
  set(142, 6, 234, 90, 2);
  set(142, 92, 234, 174, 3);
  set(140, 40, 142, 58, -5);
  set(140, 120, 142, 138, -5);
  set(60, 174, 80, 180, -5);
  set(20, 174, 44, 180, -4);
  set(170, 0, 194, 6, -4);
  set(234, 120, 240, 144, -4);
  set(60, 0, 100, 6, -4);
  return comprimiGriglia(t);
}

const piano = (k, nome, livello, nomi, pre) => ({
  k,
  nome,
  livello,
  W,
  H,
  passo: 0.05,
  griglia: griglia(),
  stanze: [
    { id: 1, nome: nomi[0] },
    { id: 2, nome: nomi[1] },
    { id: 3, nome: nomi[2], pavimento: { tipo: "spina", colore: "#c19a6b" }, pareti: "#b7c4ae" },
  ],
  aperture: [
    { tipo: "porta", x: 7.05, y: 2.45, largo: 0.9, orizz: false, verso: 0, stanza: 1 },
    { tipo: "porta", x: 7.05, y: 6.45, largo: 0.9, orizz: false, verso: 0, stanza: 1 },
    { tipo: "porta", x: 3.5, y: 8.85, largo: 1.0, orizz: true, verso: 1, stanza: 1 },
    { tipo: "finestra", x: 1.6, y: 8.85, largo: 1.2, orizz: true, verso: 1, stanza: 1 },
    { tipo: "finestra", x: 9.1, y: 0.15, largo: 1.2, orizz: true, verso: -1, stanza: 2 },
    { tipo: "finestra", x: 11.85, y: 6.6, largo: 1.2, orizz: false, verso: 1, stanza: 3 },
    {
      tipo: "finestra",
      x: 4.0,
      y: 0.15,
      largo: 2.0,
      orizz: true,
      verso: -1,
      stanza: 1,
      portafinestra: true,
    },
  ],
  arredi: [
    { k: "angolare", stanza: 1, x: 3.5, y: 5.2, rot: 0 },
    { k: "tappeto", stanza: 1, x: 3.5, y: 3.6, rot: 0, sotto: true },
    { k: "tv", stanza: 1, x: 3.5, y: 1.2, rot: Math.PI },
    { k: "pranzo6", stanza: 1, x: 5.4, y: 7.5, rot: 0 },
    { k: "cucina", stanza: 2, x: 9.6, y: 0.65, rot: 0 },
    { k: "tondo4", stanza: 2, x: 9.6, y: 2.8, rot: 0 },
    { k: "matrimoniale", stanza: 3, x: 9.6, y: 6.9, rot: Math.PI / 2 },
    { k: "armadio", stanza: 3, x: 9.6, y: 8.3, rot: Math.PI },
  ],
  dispositivi: [
    { k: "luce", stanza: 1, x: 3.5, y: 4.2, entity: `light.${pre}soggiorno` },
    { k: "luce", stanza: 2, x: 9.6, y: 2.2, entity: `light.${pre}cucina` },
    { k: "luce", stanza: 3, x: 9.6, y: 6.6, entity: `light.${pre}camera` },
    ...(pre
      ? []
      : [
          {
            k: "telecamera",
            stanza: 1,
            x: 0.4,
            y: 0.4,
            rot: Math.atan2(3, 4),
            entity: "camera.soggiorno",
          },
          {
            k: "movimento",
            stanza: 1,
            x: 6.85,
            y: 0.4,
            rot: Math.atan2(-3, 4),
            entity: "binary_sensor.movimento_soggiorno",
          },
          {
            k: "termometro",
            stanza: 1,
            x: 0.35,
            y: 4.5,
            rot: Math.PI / 2,
            entity: "sensor.temp_soggiorno",
          },
          {
            k: "finestra",
            stanza: 2,
            x: 9.6,
            y: 0.35,
            rot: 0,
            entity: "binary_sensor.finestra_cucina",
          },
          {
            k: "tapparella",
            stanza: 3,
            x: 11.6,
            y: 6.0,
            rot: -Math.PI / 2,
            entity: "cover.camera",
          },
          { k: "clima", stanza: 3, x: 11.6, y: 5.2, rot: -Math.PI / 2, entity: "climate.camera" },
          /* gli elettrodomestici della cucina, contro il muro di fondo */
          {
            k: "lavastoviglie",
            stanza: 2,
            x: 8.2,
            y: 0.3,
            h: 0,
            rot: 0,
            entity: "sensor.lavastoviglie_potenza",
          },
          {
            k: "asciugatrice",
            stanza: 2,
            x: 11.2,
            y: 0.3,
            h: 0,
            rot: 0,
            entity: "sensor.asciugatrice_stato",
          },
        ]),
  ],
});

const CASA = casa3dPulita({
  attiva: true,
  tipo: "villa",
  esterno: {
    tetto: "falde",
    facciata: "#e9d4ae",
    persiane: "#3f6b4e",
    coppi: "#b5532f",
    giardino: true,
    telecamere: [{ k: "telecamera", entity: "camera.ingresso", nome: "Ingresso" }],
  },
  piani: [
    piano("terra", "Piano terra", 0, ["Soggiorno", "Cucina", "Camera"], ""),
    piano("primo", "Primo piano", 1, ["Studio", "Bagno", "Camera ospiti"], "su_"),
  ],
});

function stati(notte) {
  const s = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });
  return {
    "sun.sun": s("sun.sun", notte ? "below_horizon" : "above_horizon"),
    "light.soggiorno": s("light.soggiorno", "on", {
      brightness: 200,
      friendly_name: "Luce soggiorno",
    }),
    "light.cucina": s("light.cucina", "off", { friendly_name: "Luce cucina" }),
    "light.camera": s("light.camera", "on", { friendly_name: "Luce camera" }),
    "light.su_soggiorno": s("light.su_soggiorno", "on", { friendly_name: "Luce studio" }),
    "light.su_cucina": s("light.su_cucina", "off", { friendly_name: "Luce bagno" }),
    "light.su_camera": s("light.su_camera", "off", { friendly_name: "Luce camera ospiti" }),
    "camera.soggiorno": s("camera.soggiorno", "idle", { friendly_name: "Cam soggiorno" }),
    "camera.ingresso": s("camera.ingresso", "idle", { friendly_name: "Cam ingresso" }),
    "binary_sensor.movimento_soggiorno": s("binary_sensor.movimento_soggiorno", "on", {
      device_class: "motion",
      friendly_name: "Movimento soggiorno",
    }),
    "sensor.temp_soggiorno": s("sensor.temp_soggiorno", "21.4", {
      device_class: "temperature",
      unit_of_measurement: "°C",
      friendly_name: "Temperatura soggiorno",
    }),
    "binary_sensor.finestra_cucina": s("binary_sensor.finestra_cucina", "on", {
      device_class: "window",
      friendly_name: "Finestra cucina",
    }),
    "cover.camera": s("cover.camera", "open", {
      current_position: 30,
      friendly_name: "Tapparella camera",
    }),
    "sensor.lavastoviglie_potenza": s("sensor.lavastoviglie_potenza", "1850", {
      device_class: "power",
      unit_of_measurement: "W",
      friendly_name: "Lavastoviglie",
    }),
    "sensor.asciugatrice_stato": s("sensor.asciugatrice_stato", "finished", {
      friendly_name: "Asciugatrice",
    }),
    "climate.camera": s("climate.camera", "heat", {
      current_temperature: 20.5,
      temperature: 22,
      hvac_modes: ["off", "heat", "cool", "auto", "dry", "fan_only"],
      friendly_name: "Clima camera",
    }),
  };
}

/* `orologio: false` lascia il tempo vero: l'ora finta fa comodo alle foto
 * (sempre le 12:30, sempre lo stesso sole), ma col suo `requestAnimationFrame`
 * finto il volo della scena e il disegno della plancia a volte si fermano a
 * meta'. Le prove che toccano e aspettano una risposta non ne hanno bisogno. */
async function boot(
  page,
  testInfo,
  {
    tema = "light",
    notte = false,
    casa = CASA,
    orologio = true,
    senzaWebgl2 = false,
    gpu = "",
  } = {},
) {
  test.setTimeout(480_000);
  /* Il nome della grafica che il browser dice (il Teclast P25T: PowerVR GE8300). */
  if (gpu)
    await page.addInitScript((nome) => {
      for (const Classe of [WebGLRenderingContext, WebGL2RenderingContext]) {
        const prima = Classe.prototype.getParameter;
        Classe.prototype.getParameter = function (p) {
          return p === 0x9246 ? nome : prima.call(this, p);
        };
      }
    }, gpu);
  /* Un tablet col solo WebGL 1: il browser non da' il contesto WebGL 2. */
  if (senzaWebgl2)
    await page.addInitScript(() => {
      const prima = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (tipo, ...resto) {
        if (tipo === "webgl2") return null;
        return prima.call(this, tipo, ...resto);
      };
    });
  await page.addInitScript(() => {
    window.__GDAHOME_PREMIUM__ = true;
  });
  if (orologio) await page.clock.install({ time: ADESSO });
  const motore = [];
  page.on("request", (r) => {
    if (r.url().includes("three.module.min.js")) motore.push(r.url());
  });
  await page.addInitScript(() => {
    window.__CHIAMATE = [];
    window.__DATI = [];
    class MockSocket extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      onopen = null;
      onmessage = null;
      constructor() {
        super();
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(raw) {
        const m = JSON.parse(raw);
        if (m.type === "auth") return;
        let result = null;
        if (m.type === "get_states") result = [];
        else if (m.type === "frontend/get_user_data") result = { value: null };
        else if (m.type === "call_service") {
          window.__CHIAMATE.push([
            m.domain,
            m.service,
            m.service_data?.entity_id || m.target?.entity_id,
          ]);
          window.__DATI.push({ domain: m.domain, service: m.service, data: m.service_data || {} });
          result = {};
        }
        setTimeout(
          () =>
            this.onmessage?.({
              data: JSON.stringify({ id: m.id, type: "result", success: true, result }),
            }),
          10,
        );
      }
      close() {}
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
    window.WebSocket = MockSocket;
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60_000,
  });
  await expect(page.locator("#cd-boot-overlay")).toHaveCount(0, { timeout: 30_000 });
  /* Senza la casa il motore 3D non si e' mosso. */
  expect(motore).toEqual([]);
  await page.evaluate(
    ({ stati, casa, tema }) => {
      document.documentElement.setAttribute("data-theme", tema);
      Object.assign(_RAW_STATES, stati);
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
      localStorage.setItem("cd_casa3d", JSON.stringify(casa));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
    },
    { stati: stati(notte), casa, tema },
  );
  return motore;
}

const foto = (testInfo, nome) =>
  process.env.DM_FOTO ? `${process.env.DM_FOTO}/${nome}-${testInfo.project.name}.png` : null;

/* La vista vola verso il piano scelto: si aspetta che la scena dica di essere
 * arrivata. Qui la disegna il processore, piano; su un telefono e' un attimo. */
const ferma = (page) =>
  expect(page.locator('#dm-casa3d .c3-scena[data-fermo="true"]')).toHaveCount(1, {
    timeout: 120_000,
  });

async function vai(page, k) {
  await page.evaluate(() => {
    const palco = document.querySelector("#dm-casa3d .c3-scena");
    if (palco) palco.dataset.fermo = "false";
  });
  await page.locator(`#dm-casa3d [data-c3s="vista"][data-c3s-k="${k}"]`).first().click();
  await ferma(page);
}

async function scatta(page, testInfo, nome) {
  const dove = foto(testInfo, nome);
  if (!dove) return;
  await page.mouse.move(2, 2);
  await ferma(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: dove });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.__DASHBOARDMODERN_PROFILE__) window.__DASHBOARDMODERN_PROFILE__ = "casa_3d";
  });
});

async function scattaPianta(page, testInfo, nome) {
  const dove = foto(testInfo, nome);
  if (!dove) return;
  await page.mouse.move(2, 2);
  await page.waitForTimeout(400);
  await page.screenshot({ path: dove });
}

test("senza WebGL 2 la casa si apre in pianta, e i dispositivi si toccano", async ({
  page,
}, testInfo) => {
  const motore = await boot(page, testInfo, { senzaWebgl2: true, orologio: false });
  const casa = page.locator("#dm-casa3d");
  await expect(casa.locator(".c3-pianta")).toHaveCount(1, { timeout: 60_000 });
  /* niente «non si apre», e il motore del 3D non si scarica nemmeno */
  await expect(casa.locator(".c3-da-creare")).toHaveCount(0);
  expect(motore).toEqual([]);
  await expect(casa.locator(".c3-pianta-nota")).toContainText("WebGL 1");
  /* fuori: i piani da scegliere, e la telecamera di fuori */
  await expect(casa.locator(".c3-pianta-scheda")).toHaveCount(2);
  await expect(casa.locator(".c3-pianta-scheda").filter({ hasText: "Piano terra" })).toContainText(
    "2 accese",
  );
  await expect(casa.locator(".c3-pianta-fuori .c3-pd")).toHaveCount(1);
  await scattaPianta(page, testInfo, "pianta-esterno");

  /* un piano: la pianta, i nomi delle stanze, i dispositivi col loro stato */
  await casa.locator(".c3-pianta-scheda").filter({ hasText: "Piano terra" }).click();
  await expect(casa.locator('[data-c3s="vista"][data-c3s-k="terra"]').first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(casa.locator(".c3-pianta canvas")).toBeVisible();
  await expect(casa.locator(".c3-pianta-nomi")).toContainText("Cucina");
  await expect(casa.locator('.c3-pianta-tasti .c3-pd[data-tono="luce"]')).toHaveCount(2);
  await scattaPianta(page, testInfo, "pianta-piano-terra");

  /* i tasti stanno dentro la pianta */
  const tela = await casa.locator(".c3-pianta canvas").boundingBox();
  for (const b of await casa.locator(".c3-pianta-tasti .c3-pd").all()) {
    const r = await b.boundingBox();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    expect(cx).toBeGreaterThanOrEqual(tela.x - 1);
    expect(cx).toBeLessThanOrEqual(tela.x + tela.width + 1);
    expect(cy).toBeGreaterThanOrEqual(tela.y - 1);
    expect(cy).toBeLessThanOrEqual(tela.y + tela.height + 1);
  }

  /* un tocco sulla luce della cucina arriva a Home Assistant */
  await casa.locator('.c3-pianta-tasti .c3-pd[aria-label^="Luce cucina"]').click();
  await expect(casa.locator(".c3-avviso")).toContainText("Comando inviato");
  await expect
    .poll(() => page.evaluate(() => window.__CHIAMATE.map((c) => c.join(" "))), { timeout: 20_000 })
    .toContain("light toggle light.cucina");
  /* e il clima chiede la modalita' */
  await casa.locator('.c3-pianta-tasti .c3-pd[aria-label^="Clima camera"]').click();
  await expect(casa.locator(".c3-sopra .c3-finestra")).toHaveCount(1);
  /* «Prova il 3D» non c'e': qui il 3D non si puo' */
  await expect(casa.locator('[data-c3s="vista3d"]')).toHaveCount(0);
});

test("col 3D si sceglie la pianta, piu' leggera, e si torna al 3D", async ({ page }, testInfo) => {
  await boot(page, testInfo, { orologio: false });
  const casa = page.locator("#dm-casa3d");
  await expect(casa.locator(".c3-scena canvas")).toHaveCount(1, { timeout: 60_000 });
  await casa.locator('[data-c3s="vistapianta"]').click();
  await expect(casa.locator(".c3-pianta")).toHaveCount(1, { timeout: 30_000 });
  await expect(casa.locator(".c3-scena")).toHaveCount(0);
  /* la scelta resta a questo dispositivo */
  await page.reload();
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60_000,
  });
  await page.evaluate(
    ({ stati, casa }) => {
      Object.assign(_RAW_STATES, stati);
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
      localStorage.setItem("cd_casa3d", JSON.stringify(casa));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
    },
    { stati: stati(false), casa: CASA },
  );
  await expect(casa.locator(".c3-pianta")).toHaveCount(1, { timeout: 60_000 });
  await casa.locator('[data-c3s="vista3d"]').click();
  await expect(casa.locator(".c3-scena canvas")).toHaveCount(1, { timeout: 60_000 });
  await expect(casa.locator(".c3-pianta")).toHaveCount(0);
});

test("la pianta al buio, sul telefono", async ({ page }, testInfo) => {
  await boot(page, testInfo, { senzaWebgl2: true, tema: "dark", notte: true, orologio: false });
  const casa = page.locator("#dm-casa3d");
  await expect(casa.locator(".c3-pianta")).toHaveCount(1, { timeout: 60_000 });
  await casa.locator(".c3-pianta-scheda").filter({ hasText: "Primo piano" }).click();
  await expect(casa.locator(".c3-pianta canvas")).toBeVisible();
  await scattaPianta(page, testInfo, "pianta-buio-primo");
});

test("il Teclast P25T (PowerVR GE8300) apre la casa in 3D, leggero", async ({ page }, testInfo) => {
  /* «Prima si apriva»: sulla grafica debole niente pianta, il 3D leggero. */
  await boot(page, testInfo, { gpu: "PowerVR Rogue GE8300", orologio: false });
  const casa = page.locator("#dm-casa3d");
  await expect(casa.locator(".c3-scena canvas")).toHaveCount(1, { timeout: 60_000 });
  await expect(casa.locator(".c3-pianta")).toHaveCount(0);
  await expect(casa.locator('.c3-scena[data-qualita="semplice"]')).toHaveCount(1);
  await expect(casa.locator('.c3-scena[data-fermo="true"]')).toHaveCount(1, { timeout: 120_000 });
  const dove = foto(testInfo, "3d-leggero-esterno");
  if (dove) await page.screenshot({ path: dove });
  await casa.locator('[data-c3s="vista"][data-c3s-k="terra"]').first().click();
  await page.waitForTimeout(400);
  await expect(casa.locator('.c3-scena[data-fermo="true"]')).toHaveCount(1, { timeout: 120_000 });
  const dentro = foto(testInfo, "3d-leggero-piano-terra");
  if (dentro) await page.screenshot({ path: dentro });
});
