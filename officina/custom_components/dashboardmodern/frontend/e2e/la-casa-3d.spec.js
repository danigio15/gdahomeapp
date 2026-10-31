/* «Casa 3D»: la casa in tre dimensioni, dentro la plancia vera.
 *
 * Una villa finta a due piani coi nomi generici: soggiorno, cucina, camera;
 * luci, una telecamera dentro e una fuori, movimento, una finestra aperta, una
 * tapparella, il clima. Si pretende che la casa si apra nella plancia, che il
 * motore 3D arrivi solo quando la casa c'e' (chi non ha la Casa 3D non lo
 * scarica), e che un tocco su una luce arrivi a Home Assistant.
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
    "climate.camera": s("climate.camera", "heat", {
      current_temperature: 20.5,
      friendly_name: "Clima camera",
    }),
  };
}

async function boot(page, testInfo, { tema = "light", notte = false, casa = CASA } = {}) {
  test.setTimeout(480_000);
  await page.addInitScript(() => {
    window.__GDAHOME_PREMIUM__ = true;
  });
  await page.clock.install({ time: ADESSO });
  const motore = [];
  page.on("request", (r) => {
    if (r.url().includes("three.module.min.js")) motore.push(r.url());
  });
  await page.addInitScript(() => {
    window.__CHIAMATE = [];
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
  await expect(page.locator("#dm-casa3d canvas")).toHaveCount(1, { timeout: 60_000 });
  expect(motore.length).toBeGreaterThan(0);
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

test("la casa si apre nella plancia: esterno, i piani, i dispositivi coi loro stati", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  const casa = page.locator("#dm-casa3d");
  await expect(casa.locator('[data-c3s="vista"][data-c3s-k="esterno"]').first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(casa.locator(".c3-piano")).toHaveCount(2);
  /* Fuori si vedono le telecamere di fuori; il riepilogo conta quel che c'e'. */
  await expect(casa.locator(".c3-disp").filter({ hasText: "Ingresso" })).toHaveCount(1);
  await expect(casa.locator(".c3-tutta")).toContainText("1 finestra o porta aperta");
  await expect(casa.locator(".c3-tutta")).toContainText("Movimento in 1 punto");
  await scatta(page, testInfo, "casa3d-esterno");

  await vai(page, "terra");
  await expect(casa.locator('[data-c3s="vista"][data-c3s-k="terra"]').first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(casa.locator(".c3-disp").filter({ hasText: "Finestra cucina" })).toHaveCount(1);
  await scatta(page, testInfo, "casa3d-piano-terra");

  /* Un tocco sulla luce della cucina arriva a Home Assistant. */
  const riga = casa.locator(".c3-disp").filter({ hasText: "Luce cucina" });
  await riga.locator('[data-c3s="comanda"]').click();
  await expect(casa.locator(".c3-avviso")).toContainText("Comando inviato");
  await expect
    .poll(() => page.evaluate(() => window.__CHIAMATE.map((c) => c.join(" "))), { timeout: 20_000 })
    .toContain("light toggle light.cucina");
});

test("di notte, al buio", async ({ page }, testInfo) => {
  await boot(page, testInfo, { tema: "dark", notte: true });
  const casa = page.locator("#dm-casa3d");
  await scatta(page, testInfo, "casa3d-esterno-notte");
  await vai(page, "terra");
  await scatta(page, testInfo, "casa3d-piano-terra-notte");
});

test("chi amministra arreda", async ({ page }, testInfo) => {
  await boot(page, testInfo);
  const casa = page.locator("#dm-casa3d");
  await vai(page, "terra");
  await casa.locator('[data-c3s="arreda"]').click();
  await expect(casa.locator(".c3-arreda-posto")).toBeVisible();
  await scatta(page, testInfo, "casa3d-arreda");
});

/* «Avevo selezionato 3D ma quando faccio Aggiungi va la classica»: una
 * plancia Casa 3D appena nata, senza casa, resta Casa 3D. Al posto della
 * casa l'invito a crearla, e il motore 3D non si scarica per niente. */
test("senza casa la plancia resta Casa 3D e invita a crearla", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => {
    window.__GDAHOME_PREMIUM__ = true;
  });
  const motore = [];
  page.on("request", (r) => {
    if (r.url().includes("three.module.min.js")) motore.push(r.url());
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60_000,
  });
  await page.evaluate(() => {
    localStorage.setItem("cd_casa3d", JSON.stringify({ attiva: true, piani: [] }));
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
  });
  const casa = page.locator("#dm-casa3d");
  await expect(casa.locator(".c3-da-creare h2")).toHaveText("La tua casa non c'è ancora", {
    timeout: 30_000,
  });
  await expect(casa.locator("canvas")).toHaveCount(0);
  await expect(casa.locator('[data-c3s="arreda"]')).toHaveCount(0);
  expect(motore).toEqual([]);
  const dove = foto(testInfo, "casa3d-da-creare");
  if (dove) await page.screenshot({ path: dove });
  await casa.locator('.c3-da-creare [data-c3s="crea"]').click();
  await expect(page.locator("#dm-c3c")).toBeVisible({ timeout: 20_000 });
});

/* La procedura «Crea la tua casa» aperta su una plancia Casa 3D vuota. */
async function apriLaProcedura(page, testInfo) {
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    window.__GDAHOME_PREMIUM__ = true;
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60_000,
  });
  await page.evaluate(() => {
    localStorage.setItem("cd_casa3d", JSON.stringify({ attiva: true, piani: [] }));
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
  });
  await page.locator('#dm-casa3d .c3-da-creare [data-c3s="crea"]').click({ timeout: 30_000 });
  const crea = page.locator("#dm-c3c");
  await expect(crea).toBeVisible({ timeout: 20_000 });
  return crea;
}

const fotoDiretta = async (page, testInfo, nome) => {
  const dove = foto(testInfo, nome);
  if (dove) await page.screenshot({ path: dove });
};

/* «Manca la possibilità di crearla direttamente sulla plancia se non ho
 * nulla da caricare»: le misure del piano, un contorno di muri in scala, e
 * le stanze si dividono col «Muro dritto». */
test("senza planimetria la casa si disegna qui", async ({ page }, testInfo) => {
  const crea = await apriLaProcedura(page, testInfo);
  const fai = crea.locator('[data-c3c="amano"]');
  await expect(fai).toBeDisabled();
  await crea.locator('[data-c3c-mano="w"]').fill("12");
  await crea.locator('[data-c3c-mano="h"]').fill("10");
  await expect(fai).toBeEnabled();
  await fotoDiretta(page, testInfo, "crea-a-mano-misure");
  await fai.click();
  await expect(crea.locator('[data-c3c-strumento="dritto"]')).toHaveClass(/si/, {
    timeout: 30_000,
  });
  await expect(crea.locator(".c3c-pannello")).toContainText("Trovati 1 ambienti");
  /* Un muro dritto a meta': le stanze diventano due. */
  const tela = crea.locator(".c3c-tela");
  const b = await tela.boundingBox();
  await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.52, b.y + b.height * 0.5, { steps: 4 });
  await page.mouse.move(b.x + b.width * 0.51, b.y + b.height * 0.9, { steps: 4 });
  await page.mouse.up();
  await expect(crea.locator(".c3c-pannello")).toContainText("Trovati 2 ambienti", {
    timeout: 20_000,
  });
  await fotoDiretta(page, testInfo, "crea-a-mano-muri");
});

/* Il DWG vero si prova solo col file a portata di mano (DM_DWG=percorso):
 * le planimetrie vere non stanno nella repository. */
test("un DWG coi piani affiancati: si sceglie il piano, scala e nomi dal disegno", async ({
  page,
}, testInfo) => {
  test.skip(!process.env.DM_DWG, "serve DM_DWG col percorso di un file .dwg");
  const crea = await apriLaProcedura(page, testInfo);
  await crea.locator('[data-c3c-file="dwg"]').setInputFiles(process.env.DM_DWG);
  const piani = crea.locator(".c3c-dwg-piano");
  await expect(piani.first()).toBeVisible({ timeout: 120_000 });
  await fotoDiretta(page, testInfo, "crea-dwg-piani");
  await piani.nth(Number(process.env.DM_DWG_PIANO || 1)).click();
  await expect(crea.locator('[data-c3c-strumento="dritto"]')).toBeVisible({ timeout: 60_000 });
  await fotoDiretta(page, testInfo, "crea-dwg-muri");
  await crea.locator('[data-c3c="avanti"]').click();
  await fotoDiretta(page, testInfo, "crea-dwg-stanze");
});
