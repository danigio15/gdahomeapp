/* La Casa 3D col modello di chi abita (#440), dentro la plancia vera.
 *
 * Una casetta GLB fatta a mano (`tests/casetta-glb.js`) sta in un ponte finto
 * che la da' a pezzi, come quello vero. Si pretende che la casa si apra col
 * modello al posto di quella generata, coi dispositivi sopra e il loro stato;
 * che chi amministra metta un punto luce toccando il modello; e che la
 * finestra «Il tuo modello 3D» legga un file, lo misuri e lo carichi a pezzi.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { casettaGlb } from "../tests/casetta-glb.js";

test.describe.configure({ mode: "serial" });
test.use({
  launchOptions: {
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  },
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
  },
  visibility: { home: true },
};

const GLB = casettaGlb({ scala: 100 });
const ID = "0123456789abcdef";
const CASA = {
  attiva: true,
  tipo: "villa",
  piani: [],
  modello: {
    id: ID,
    formato: "glb",
    nome: "casetta.glb",
    peso: GLB.length,
    impronta: "ab".repeat(16),
    unita: "cm",
    su: "y",
    rot: 0,
    scala: 1,
    triangoli: 128,
    attivo: true,
    /* nelle coordinate del file, che e' in centimetri */
    dispositivi: [
      { k: "luce", x: 300, y: 285, z: 350, entity: "light.salone" },
      { k: "luce", x: 800, y: 285, z: 350, entity: "light.camera" },
      { k: "movimento", x: 30, y: 250, z: 30, entity: "binary_sensor.movimento_salone" },
      { k: "termometro", x: 25, y: 160, z: 450, entity: "sensor.temp_salone" },
      { k: "tapparella", x: 200, y: 235, z: 706, entity: "cover.salone" },
      { k: "porta", x: 485, y: 150, z: 707, entity: "binary_sensor.porta_ingresso" },
      { k: "telecamera", x: 995, y: 270, z: 705, entity: "camera.ingresso" },
    ],
  },
};

function stati() {
  const s = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });
  return {
    "sun.sun": s("sun.sun", "above_horizon"),
    "light.salone": s("light.salone", "on", { brightness: 220, friendly_name: "Luce salone" }),
    "light.camera": s("light.camera", "off", { friendly_name: "Luce camera" }),
    "light.cucina": s("light.cucina", "off", { friendly_name: "Luce cucina" }),
    "binary_sensor.movimento_salone": s("binary_sensor.movimento_salone", "on", {
      device_class: "motion",
      friendly_name: "Movimento salone",
    }),
    "sensor.temp_salone": s("sensor.temp_salone", "21.4", {
      device_class: "temperature",
      unit_of_measurement: "°C",
      friendly_name: "Temperatura salone",
    }),
    "cover.salone": s("cover.salone", "open", {
      current_position: 60,
      friendly_name: "Tapparella salone",
    }),
    "binary_sensor.porta_ingresso": s("binary_sensor.porta_ingresso", "off", {
      device_class: "door",
      friendly_name: "Porta ingresso",
    }),
    "camera.ingresso": s("camera.ingresso", "idle", { friendly_name: "Cam ingresso" }),
  };
}

async function boot(page, testInfo, casa = CASA) {
  test.setTimeout(480_000);
  await page.addInitScript(() => {
    window.__GDAHOME_PREMIUM__ = true;
    if (!window.__DASHBOARDMODERN_PROFILE__) window.__DASHBOARDMODERN_PROFILE__ = "casa_3d";
  });
  await page.addInitScript((glb64) => {
    window.__CHIAMATE = [];
    window.__MODELLI = { "0123456789abcdef": glb64 };
    window.__PEZZI = [];
    const daB64 = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
    const aB64 = (u) => {
      let s = "";
      for (let i = 0; i < u.length; i += 0x8000)
        s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return btoa(s);
    };
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
        } else if (m.type === "ponte/casa3d/modello/leggi") {
          /* il ponte finto: pezzi da 4 kB, per vedere che si rimettono insieme */
          const tutto = daB64(window.__MODELLI[m.modello]);
          const pezzo = tutto.subarray(m.da, m.da + 4096);
          result = {
            formato: "glb",
            peso: tutto.length,
            da: m.da,
            corpo: aB64(pezzo),
            fine: m.da + pezzo.length >= tutto.length,
          };
        } else if (m.type === "ponte/casa3d/modello/inizia")
          result = { caricamento: "c1", pezzo: 524288 };
        else if (m.type === "ponte/casa3d/modello/pezzo") {
          window.__PEZZI.push(m.data);
          result = { ricevuti: 0 };
        } else if (m.type === "ponte/casa3d/modello/fine") {
          const tutto = window.__PEZZI.map(daB64);
          const n = tutto.reduce((a, b) => a + b.length, 0);
          const u = new Uint8Array(n);
          let da = 0;
          for (const p of tutto) (u.set(p, da), (da += p.length));
          window.__MODELLI["fedcba9876543210"] = aB64(u);
          result = { id: "fedcba9876543210", formato: "glb", peso: n, impronta: "cd".repeat(16) };
        }
        setTimeout(
          () =>
            this.onmessage?.({
              data: JSON.stringify({ id: m.id, type: "result", success: true, result }),
            }),
          5,
        );
      }
      close() {}
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
    window.WebSocket = MockSocket;
  }, GLB.toString("base64"));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60_000,
  });
  await expect(page.locator("#cd-boot-overlay")).toHaveCount(0, { timeout: 30_000 });
  await page.evaluate(
    ({ stati, casa }) => {
      Object.assign(_RAW_STATES, stati);
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
      localStorage.setItem("cd_casa3d", JSON.stringify(casa));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
    },
    { stati: stati(), casa },
  );
  await expect(page.locator("#dm-casa3d .c3m-scena canvas")).toHaveCount(1, { timeout: 90_000 });
}

const foto = (testInfo, nome) =>
  process.env.DM_FOTO ? `${process.env.DM_FOTO}/${nome}-${testInfo.project.name}.png` : null;

async function scatta(page, testInfo, nome) {
  const dove = foto(testInfo, nome);
  if (!dove) return;
  await page.mouse.move(2, 2);
  await expect(page.locator('#dm-casa3d .c3-scena[data-fermo="true"]')).toHaveCount(1, {
    timeout: 60_000,
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: dove });
}

test("la casa si apre col modello, coi dispositivi sopra e il loro stato", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  const casa = page.locator("#dm-casa3d");
  await expect(casa.locator(".c3-testa")).toContainText("il tuo modello");
  await expect(casa.locator(".c3-disp")).toHaveCount(7);
  await expect(casa.locator(".c3-disp").filter({ hasText: "Luce salone" })).toHaveAttribute(
    "data-attivo",
    "true",
  );
  await expect(casa.locator(".c3-chip")).toHaveCount(7);
  await scatta(page, testInfo, "casa3d-modello");
  /* il taglio: si abbassa la lama e si vede dentro */
  await page.locator("#dm-casa3d [data-c3m-taglio]").fill("55");
  await scatta(page, testInfo, "casa3d-modello-taglio");
  /* un tocco sulla luce della camera arriva a Home Assistant */
  await casa
    .locator(".c3-disp")
    .filter({ hasText: "Luce camera" })
    .locator('[data-c3s="comanda"]')
    .click();
  await expect
    .poll(() => page.evaluate(() => window.__CHIAMATE.map((c) => c.join(" "))), { timeout: 20_000 })
    .toContain("light toggle light.camera");
});

test("chi amministra mette un punto luce toccando il modello", async ({ page }, testInfo) => {
  await boot(page, testInfo);
  const casa = page.locator("#dm-casa3d");
  await casa.locator('[data-c3s="arreda"]').click();
  await expect(casa.locator(".c3-arreda-posto")).toBeVisible();
  await casa.locator('[data-c3m-disp="luce"]').click();
  /* sul telefono il pannello sta sotto la casa: si torna su, e si tocca il centro */
  await casa.locator(".c3m-scena canvas").click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem("cd_casa3d")).modello.dispositivi.length,
        ),
      {
        timeout: 20_000,
      },
    )
    .toBe(8);
  const messo = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cd_casa3d")).modello.dispositivi.at(-1),
  );
  expect(messo.k).toBe("luce");
  /* sul tetto della casetta, in centimetri: fra il muro (300) e il colmo (520) */
  expect(messo.y).toBeGreaterThan(250);
  expect(messo.y).toBeLessThan(560);
  await scatta(page, testInfo, "casa3d-modello-arreda");
});

test("la finestra del modello legge un file, lo misura e lo carica a pezzi", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await page.locator('#dm-casa3d [data-c3s="modello"]').click();
  const finestra = page.locator("#dm-casa3d-modello");
  await expect(finestra).toBeVisible();
  await expect(finestra).toContainText("Modello in uso: casetta.glb");
  /* un file che non e' un modello */
  await finestra.locator("[data-c3mm-file]").setInputFiles({
    name: "casa.glb",
    mimeType: "model/gltf-binary",
    buffer: Buffer.from("<html><script>alert(1)</script></html>"),
  });
  await expect(finestra.locator(".c3mm-errore")).toContainText("non è un modello GLB, glTF o OBJ");
  /* la casetta in centimetri: le unita' si indovinano, le misure tornano */
  await finestra.locator("[data-c3mm-file]").setInputFiles({
    name: "casetta-cm.glb",
    mimeType: "model/gltf-binary",
    buffer: GLB,
  });
  await expect(finestra.locator("[data-c3mm-tela] canvas")).toHaveCount(1, { timeout: 30_000 });
  await expect(finestra.locator('[data-c3mm="unita"][data-v="cm"]')).toHaveClass(/si/);
  await expect(finestra).toContainText("10,8 × 7,8 × 5,2 m");
  /* sbagliando l'unita' la casa diventa enorme; il lato lungo la rimette a posto */
  await finestra.locator('[data-c3mm="unita"][data-v="m"]').click();
  await expect(finestra).toContainText("× 520 m");
  await finestra.locator("[data-c3mm-lato]").fill("10,8");
  await finestra.locator("[data-c3mm-lato]").dispatchEvent("change");
  await expect(finestra).toContainText("10,8 × 7,8 × 5,2 m");
  const dove = foto(testInfo, "casa3d-modello-finestra");
  if (dove) {
    await page.waitForTimeout(400);
    await page.screenshot({ path: dove });
  }
  await finestra.locator('[data-c3mm="usa"]').click();
  await expect(finestra).toHaveCount(0, { timeout: 30_000 });
  const salvato = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_casa3d")).modello);
  expect(salvato.id).toBe("fedcba9876543210");
  expect(salvato.unita).toBe("m");
  expect(salvato.scala).toBeCloseTo(0.01, 4);
  expect(salvato.dispositivi).toEqual([]);
  /* la casa si rifa' col modello nuovo */
  await expect(page.locator("#dm-casa3d .c3m-scena canvas")).toHaveCount(1, { timeout: 90_000 });
});
