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
  /* Non basta arrivare ai muri: le stanze devono esserci (DM_DWG_STANZE, il
   * minimo atteso per quel piano). */
  const trovati = await crea.locator(".c3c-pannello").innerText();
  const stanze = Number(/Trovati (\d+) ambienti/.exec(trovati)?.[1] || 0);
  expect(stanze).toBeGreaterThanOrEqual(Number(process.env.DM_DWG_STANZE || 3));
  await fotoDiretta(page, testInfo, "crea-dwg-muri");
  await crea.locator('[data-c3c="avanti"]').click();
  await fotoDiretta(page, testInfo, "crea-dwg-stanze");
});

/* «Ho provato a caricare un file pdf del catasto e quello non lo prende»: un
 * PDF vettoriale come quello del catasto (A4, muri a doppia riga, «Scala
 * 1:200» scritto sul foglio, la cornice, le scritte delle stanze). Si
 * pretende che la scala si legga da sola e che escano le cinque stanze. */
function catastoSvg() {
  const mm = (m) => m * 5; // 1:200, in millimetri sul foglio
  const ox = 45,
    oy = 70;
  const linee = [];
  const riga = (x0, y0, x1, y1) =>
    linee.push(
      `<line x1="${ox + mm(x0)}" y1="${oy + mm(y0)}" x2="${ox + mm(x1)}" y2="${oy + mm(y1)}"/>`,
    );
  const muro = (x0, y0, x1, y1, s, varchi = []) => {
    const orizz = y0 === y1;
    let pezzi = [[orizz ? x0 : y0, orizz ? x1 : y1]];
    for (const [v0, v1] of varchi)
      pezzi = pezzi.flatMap(([a, b]) =>
        v1 <= a || v0 >= b
          ? [[a, b]]
          : [...(v0 > a ? [[a, v0]] : []), ...(v1 < b ? [[v1, b]] : [])],
      );
    for (const [a, b] of pezzi)
      if (orizz) {
        riga(a, y0 - s / 2, b, y0 - s / 2);
        riga(a, y0 + s / 2, b, y0 + s / 2);
        riga(a, y0 - s / 2, a, y0 + s / 2);
        riga(b, y0 - s / 2, b, y0 + s / 2);
      } else {
        riga(x0 - s / 2, a, x0 - s / 2, b);
        riga(x0 + s / 2, a, x0 + s / 2, b);
        riga(x0 - s / 2, a, x0 + s / 2, a);
        riga(x0 - s / 2, b, x0 + s / 2, b);
      }
  };
  const vetro = (x0, y0, x1, y1) => {
    for (const k of [-0.08, 0.08])
      y0 === y1 ? riga(x0, y0 + k, x1, y0 + k) : riga(x0 + k, y0, x0 + k, y1);
  };
  muro(0, 0, 12, 0, 0.3, [
    [2, 3.4],
    [8.5, 9.7],
  ]);
  muro(12, 0, 12, 10, 0.3, [[6.2, 7.4]]);
  muro(0, 10, 12, 10, 0.3, [
    [4.3, 5.3],
    [8.5, 9.7],
  ]);
  muro(0, 0, 0, 10, 0.3, [
    [2, 3.4],
    [7.5, 8.3],
  ]);
  vetro(2, 0, 3.4, 0);
  vetro(8.5, 0, 9.7, 0);
  vetro(12, 6.2, 12, 7.4);
  vetro(8.5, 10, 9.7, 10);
  vetro(0, 2, 0, 3.4);
  vetro(0, 7.5, 0, 8.3);
  muro(7, 0, 7, 6, 0.12, [[1.5, 2.4]]);
  muro(7, 4, 12, 4, 0.12, [[7.8, 8.6]]);
  muro(7, 6, 7, 10, 0.12, [[7.5, 8.3]]);
  muro(0, 6, 7, 6, 0.12, [[4.6, 5.4]]);
  muro(3, 6, 3, 10, 0.12, [[7.6, 8.4]]);
  const scritta = (x, y, s) =>
    `<text x="${ox + mm(x)}" y="${oy + mm(y)}" font-size="2.2" font-family="Arial">${s}</text>`;
  return `<!doctype html><html><head><style>@page{size:A4;margin:0}body{margin:0}</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297">
<rect x="8" y="8" width="194" height="281" fill="none" stroke="#000" stroke-width="0.4"/>
<text x="14" y="20" font-size="4" font-family="Arial">Catasto dei Fabbricati - Situazione al 01/11/2026</text>
<text x="14" y="28" font-size="3" font-family="Arial">Planimetria di u.i.u. in Comune di Esempio - Via delle Prove civ. 1</text>
<text x="150" y="40" font-size="3.5" font-family="Arial">Scala 1:200</text>
<text x="80" y="62" font-size="3" font-family="Arial">PIANO TERRA</text>
<g stroke="#000" stroke-width="0.18" fill="none">${linee.join("")}</g>
${scritta(2.2, 3, "SOGGIORNO")}${scritta(8.6, 2, "CUCINA")}${scritta(8.6, 7, "CAMERA")}${scritta(0.6, 8, "BAGNO")}${scritta(4.2, 8.5, "DIS.")}
<text x="14" y="280" font-size="2.5" font-family="Arial">Ultima planimetria in atti - Data presentazione: 01/11/2026</text>
</svg></body></html>`;
}

test("il PDF del catasto: la scala dal foglio e le stanze", async ({ page, browser }, testInfo) => {
  const altra = await browser.newPage();
  await altra.setContent(catastoSvg());
  const pdf = await altra.pdf({ format: "A4", printBackground: true });
  await altra.close();
  const crea = await apriLaProcedura(page, testInfo);
  await crea.locator('[data-c3c-file="pianta"]').setInputFiles({
    name: "planimetria-catastale.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await expect(crea.locator(".c3c-pannello")).toContainText("Trovati 5 ambienti", {
    timeout: 120_000,
  });
  await fotoDiretta(page, testInfo, "crea-pdf-catasto");
});

/* «Non è lavorabile così: tutta la parte di sopra bloccata e un piccolo
 * riquadro sotto che scorre». Sul Fold aperto (e su un telefono) scorre tutta
 * la pagina: il disegno resta grande e il pannello si legge fino in fondo. */
test("sul Fold aperto scorre tutta la pagina, non una striscia", async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "la misura del Fold la mette la prova");
  const altra = await browser.newPage();
  await altra.setContent(catastoSvg());
  const pdf = await altra.pdf({ format: "A4", printBackground: true });
  await altra.close();
  await page.setViewportSize({ width: 884, height: 660 });
  const crea = await apriLaProcedura(page, testInfo);
  await crea.locator('[data-c3c-file="pianta"]').setInputFiles({
    name: "planimetria-catastale.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await expect(crea.locator(".c3c-pannello")).toContainText("Trovati 5 ambienti", {
    timeout: 120_000,
  });
  const misure = await crea.evaluate((el) => ({
    scorre: el.scrollHeight > el.clientHeight + 40,
    palco: el.querySelector(".c3c-palco").getBoundingClientRect().height,
    pannelloScorreDaSe: (() => {
      const p = el.querySelector(".c3c-pannello");
      return p.scrollHeight > p.clientHeight + 4;
    })(),
  }));
  expect(misure.scorre).toBe(true);
  expect(misure.palco).toBeGreaterThanOrEqual(280);
  expect(misure.pannelloScorreDaSe).toBe(false);
  const avanti = crea.locator('[data-c3c="avanti"]');
  await avanti.scrollIntoViewIfNeeded();
  await expect(avanti).toBeInViewport();
  await fotoDiretta(page, testInfo, "crea-fold-in-fondo");
});

/* «Questo DWG non si legge», dal telefono: il disegno era buono, era il
 * lettore (11 MB) che non arrivava. Ora i due guasti si dicono diversi, e
 * sotto l'avviso c'e' la causa vera, da fotografare. */
test("se il lettore dei DWG non arriva lo dice, con la causa sotto", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "basta una misura");
  await page.route("**/libredwg/**", (via) => via.abort("connectionrefused"));
  const crea = await apriLaProcedura(page, testInfo);
  await crea.locator('[data-c3c-file="dwg"]').setInputFiles({
    name: "pianta.dwg",
    mimeType: "application/acad",
    buffer: Buffer.from("AC1032 non importa"),
  });
  await expect(crea).toContainText("Il lettore dei DWG non si è scaricato", { timeout: 30_000 });
  await expect(crea.locator(".c3c-dettaglio")).not.toBeEmpty();
  await expect(crea).not.toContainText("Prova a salvarlo da AutoCAD");
});

/* Come lo da' l'app sul telefono: il motore col tipo che il suo servitore
 * conosceva («application/octet-stream», non «application/wasm») e, la prima
 * volta, un ponte che non risponde in tempo. Il lettore deve partire lo
 * stesso: una seconda richiesta, e poi via. E la cache del browser fuori:
 * era li' che il lettore di prima si perdeva. */
test("il lettore dei DWG parte anche col tipo dell'app e un primo 503", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "basta una misura");
  const chieste = [];
  await page.route("**/libredwg/wasm/libredwg-web.wasm", async (via) => {
    chieste.push(via.request().headers());
    if (chieste.length === 1)
      return via.fulfill({
        status: 503,
        contentType: "text/plain",
        body: "il ponte non ha risposto",
      });
    const vera = await via.fetch();
    return via.fulfill({
      status: 200,
      contentType: "application/octet-stream",
      body: await vera.body(),
    });
  });
  const crea = await apriLaProcedura(page, testInfo);
  await crea.locator('[data-c3c-file="dwg"]').setInputFiles({
    name: "pianta.dwg",
    mimeType: "application/acad",
    buffer: Buffer.from("AC1032 non importa"),
  });
  /* Il motore c'e': quello che non si legge adesso e' il disegno finto. */
  await expect(crea).toContainText(
    /Questo DWG non si legge|Nel disegno non ho trovato una pianta/,
    {
      timeout: 60_000,
    },
  );
  await expect(crea).not.toContainText("Il lettore dei DWG non si è scaricato");
  expect(chieste.length).toBe(2);
  expect(chieste.every((h) => !h["if-none-match"])).toBe(true);
});

test("se il motore dei DWG risponde di no, sotto c'e' il codice", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "basta una misura");
  let quante = 0;
  await page.route("**/libredwg/wasm/libredwg-web.wasm", (via) => {
    quante++;
    return via.fulfill({ status: 404, contentType: "text/plain", body: "qui non c'è niente" });
  });
  const crea = await apriLaProcedura(page, testInfo);
  await crea.locator('[data-c3c-file="dwg"]').setInputFiles({
    name: "pianta.dwg",
    mimeType: "application/acad",
    buffer: Buffer.from("AC1032 non importa"),
  });
  await expect(crea).toContainText("Il lettore dei DWG non si è scaricato", { timeout: 30_000 });
  await expect(crea.locator(".c3c-dettaglio")).toContainText("HTTP 404 qui non c'è niente");
  /* Un no non si richiede. */
  expect(quante).toBe(1);
});

/* «La navbar qua non deve esserci proprio»: nell'app la barra stava a meta'
 * sopra la casa, col fondo della pagina tagliato dietro. Sulla casa la barra
 * non c'e' — ne' la maniglia, ne' il tasto della voce. */
test("sulla casa la barra delle sezioni non c'e'", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "e' il telefono");
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
  const casa = page.locator("#dm-casa3d");
  await expect(casa.locator(".c3-da-creare h2")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("nav.tabs.bottom-nav-bar")).toBeHidden();
  await expect(page.locator(".dm-assist-tasto")).toBeHidden();
  await expect(page.locator(".bottom-nav-handle")).toBeHidden();
  await page.waitForTimeout(800);
  const dove = foto(testInfo, "casa3d-senza-la-barra");
  if (dove) await page.screenshot({ path: dove });
});

/* La visura della planimetria scaricata dal catasto: una scansione (la
 * «Scala 1:200» sta nell'immagine), con due piante e i contorni delle altre
 * unita' sullo stesso foglio. Il file e' di una persona vera: non sta nel
 * repo, si passa con DM_PDF. */
test("la visura del catasto scansionata: scala, scelta della pianta, stanze", async ({
  page,
}, testInfo) => {
  test.skip(!process.env.DM_PDF || testInfo.project.name !== "desktop", "serve DM_PDF");
  const crea = await apriLaProcedura(page, testInfo);
  await crea.locator('[data-c3c-file="pianta"]').setInputFiles(process.env.DM_PDF);
  const piante = crea.locator("[data-c3c-dwg]");
  await expect(piante).toHaveCount(Number(process.env.DM_PDF_PIANTE || 2), { timeout: 60_000 });
  await expect(crea).toContainText("Planimetria del catasto");
  await fotoDiretta(page, testInfo, "crea-visura-scelta");
  await piante.nth(Number(process.env.DM_PDF_PIANTA || 1)).click();
  const trovati = crea.locator(".c3c-pannello");
  await expect(trovati).toContainText(/Trovati \d+ ambienti/, { timeout: 120_000 });
  const n = Number(/Trovati (\d+) ambienti/.exec(await trovati.innerText())[1]);
  expect(n).toBeGreaterThanOrEqual(Number(process.env.DM_PDF_STANZE || 5));
  await fotoDiretta(page, testInfo, "crea-visura-stanze");
});

/* «Adesso non riesco a tornare più indietro»: la Casa 3D accesa sulla plancia
 * principale copriva tutto, e da li' non si usciva. «Torna alla plancia» la
 * toglie per questa volta: tornano la plancia, la barra e il Config. */
test("dalla Casa 3D si torna sempre alla plancia", async ({ page }, testInfo) => {
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
  const casa = page.locator("#dm-casa3d");
  await expect(casa.locator(".c3-da-creare h2")).toBeVisible({ timeout: 30_000 });
  await casa.locator('[data-c3s="esci"]').click();
  await expect(casa).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveClass(/dm-casa3d-acceso/);
  /* E «Apri in 3D» la rimette. */
  await page.evaluate(() => window.__DM_CASA3D_RIDISEGNA__());
  await expect(page.locator("#dm-casa3d .c3-da-creare h2")).toBeVisible({ timeout: 10_000 });
});

/* «L'hamburger deve aprire la barra laterale»: dentro Home Assistant largo la
 * plancia sta in un riquadro che comincia gia' dopo la barra. Il ☰ della Casa
 * 3D apre la barra di Home Assistant e non sposta la casa: spostarla di tutta
 * la barra scopriva la plancia sotto («sovrascrive la dashboard»). */
test("il ☰ della Casa 3D apre la barra di Home Assistant senza scoprire la plancia", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Home Assistant largo");
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
    /* Home Assistant attorno: la barra larga 256 px, e il riquadro della
     * plancia che comincia dove lei finisce. */
    window.__APERTO__ = [];
    const ha = document.createElement("home-assistant");
    ha.attachShadow({ mode: "open" });
    const main = document.createElement("home-assistant-main");
    main.attachShadow({ mode: "open" });
    const barra = document.createElement("ha-sidebar");
    barra.style.cssText = "position:fixed;left:0;top:0;bottom:0;width:256px";
    main.shadowRoot.append(barra);
    ha.shadowRoot.append(main);
    main.addEventListener("hass-toggle-menu", (e) => window.__APERTO__.push(e.detail));
    document.body.appendChild(ha);
    window.documentoDiHomeAssistant = () => document;
    Object.defineProperty(window, "frameElement", {
      configurable: true,
      get: () => ({ getBoundingClientRect: () => ({ left: 256 }) }),
    });
  });
  const casa = page.locator("#dm-casa3d");
  await expect(casa.locator(".c3-da-creare h2")).toBeVisible({ timeout: 30_000 });
  await casa.locator('[data-c3s="menu"]').click();
  await expect.poll(() => page.evaluate(() => window.__APERTO__)).toEqual([{ open: true }]);
  await page.waitForTimeout(400);
  expect(await casa.evaluate((n) => Math.round(n.getBoundingClientRect().left))).toBe(0);
});
