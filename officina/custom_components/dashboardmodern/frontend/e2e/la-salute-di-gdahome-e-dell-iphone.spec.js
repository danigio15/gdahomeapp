/* «Ora va tutto con il nuovo aggiornamento, però non vanno nella plancia»
 * (Marco, iPhone). Sullo stesso iPhone scrivono in due: GdAHome, dalle misure
 * di Apple Salute («Marco Steps», «Marco Heart rate»… scritti dal ponte via
 * REST, senza registro delle entita'), e l'app di Home Assistant col
 * contapassi («iPhone di marco Steps», e un sensore con «Health» nel nome).
 * La pagina Salute ne faceva tre persone; adesso e' Marco, una volta, con le
 * misure di GdAHome davanti e i giorni passati del contapassi. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const ADESSO = Date.parse("2026-11-03T14:45:00Z");
const GIORNO = 86_400_000;

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
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true },
};

const sensore = (valore, nome, unita, extra = {}, classe = "measurement") => ({
  state: String(valore),
  attributes: { friendly_name: nome, unit_of_measurement: unita, state_class: classe, ...extra },
  last_changed: "2026-11-03T14:40:00Z",
  last_updated: "2026-11-03T14:40:00Z",
});
const daGdahome = (quando) => ({
  gdahome_persona: "Marco",
  misurato_il: quando,
  attribution: "Dal telefono, con GdAHome",
});

function statiDiMarco() {
  return {
    "sensor.iphone_di_marco_steps": sensore(
      1949,
      "iPhone di marco Steps",
      "steps",
      {},
      "total_increasing",
    ),
    "sensor.iphone_di_marco_health_heart_rate": sensore(
      69,
      "iPhone di marco Health Heart rate",
      "bpm",
    ),
    "sensor.gdahome_1a2b3c4d_passi": sensore(
      2410,
      "Marco Steps",
      "steps",
      daGdahome("2026-11-03T14:41:00Z"),
      "total_increasing",
    ),
    "sensor.gdahome_1a2b3c4d_battito": sensore(
      72,
      "Marco Heart rate",
      "bpm",
      daGdahome("2026-11-03T14:30:00Z"),
    ),
    "sensor.gdahome_1a2b3c4d_battito_riposo": sensore(
      69,
      "Marco Resting heart rate",
      "bpm",
      daGdahome("2026-11-03T06:10:00Z"),
    ),
    "sensor.gdahome_1a2b3c4d_peso": sensore(81.4, "Marco Weight", "kg", {
      ...daGdahome("2026-11-03T07:05:00Z"),
      device_class: "weight",
    }),
    "sensor.gdahome_1a2b3c4d_grasso": sensore(
      19.2,
      "Marco Body fat",
      "%",
      daGdahome("2026-11-03T07:05:00Z"),
    ),
    "sensor.gdahome_1a2b3c4d_sistolica": sensore(
      124,
      "Marco Blood pressure systolic",
      "mmHg",
      daGdahome("2026-11-02T20:10:00Z"),
    ),
    "sensor.gdahome_1a2b3c4d_diastolica": sensore(
      79,
      "Marco Blood pressure diastolic",
      "mmHg",
      daGdahome("2026-11-02T20:10:00Z"),
    ),
  };
}

/* Il contapassi dell'iPhone ha i suoi sette giorni; il sensore di GdAHome e'
 * nato oggi e ha solo oggi. */
function storico() {
  const oggi = new Date(ADESSO);
  oggi.setUTCHours(0, 0, 0, 0);
  const giorni = (valori, campo) =>
    valori.map((v, i) => ({
      start: oggi.getTime() - (valori.length - 1 - i) * GIORNO,
      [campo]: v,
      ...(campo === "change" ? { max: v } : {}),
    }));
  return {
    "sensor.iphone_di_marco_steps": giorni([6120, 7480, 2305, 4940, 4770, 8215, 1949], "change"),
    "sensor.gdahome_1a2b3c4d_passi": giorni([2410], "change"),
    "sensor.gdahome_1a2b3c4d_peso": giorni([81.4], "mean"),
  };
}

const lista = (stati) => Object.entries(stati).map(([entity_id, s]) => ({ entity_id, ...s }));

if (process.env.DM_FOTO) test.use({ deviceScaleFactor: 2 });

async function boot(page, testInfo, tema) {
  await page.clock.setFixedTime(ADESSO);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  const stati = lista(statiDiMarco());
  await page.addInitScript(
    ({ stati, storico }) => {
      window.__salute = { domande: [] };
      class MockSocket extends EventTarget {
        static OPEN = 1;
        readyState = MockSocket.OPEN;
        onopen = null;
        onmessage = null;
        onclose = null;
        onerror = null;
        constructor() {
          super();
          queueMicrotask(() => {
            this.onopen?.({});
            this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
          });
        }
        send(raw) {
          const message = JSON.parse(raw);
          if (message.type === "auth") return;
          let result = null;
          if (message.type === "get_states") result = stati;
          else if (message.type === "frontend/get_user_data") result = { value: null };
          else if (message.type === "recorder/statistics_during_period") {
            window.__salute.domande.push(message);
            result = {};
            for (const id of message.statistic_ids || []) result[id] = storico[id] || [];
          }
          setTimeout(() => {
            this.onmessage?.({
              data: JSON.stringify({ id: message.id, type: "result", success: true, result }),
            });
          }, 10);
        }
        close() {}
      }
      window.__DASHBOARDMODERN_BRIDGE_WS__ = MockSocket;
      window.WebSocket = MockSocket;
    },
    { stati, storico: storico() },
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60_000,
  });
  await expect(page.locator("#cd-boot-overlay")).toHaveCount(0, { timeout: 30_000 });
  await page.evaluate(
    ({ stati, tema }) => {
      document.documentElement.setAttribute("data-theme", tema);
      for (const s of stati) {
        _RAW_STATES[s.entity_id] = structuredClone(s);
        STATES[s.entity_id] = structuredClone(s);
      }
      window.render?.();
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
    },
    { stati, tema },
  );
}

async function fotoDellaPagina(page, dove) {
  if (!dove) return;
  const prima = page.viewportSize();
  const alta = await page.evaluate(() => {
    const pagina = document.getElementById("page-salute");
    const sopra = pagina.getBoundingClientRect().top + window.scrollY;
    return Math.ceil(sopra + pagina.scrollHeight + 140);
  });
  await page.setViewportSize({ width: prima.width, height: Math.max(prima.height, alta) });
  await page.waitForTimeout(400);
  await page.screenshot({ path: dove, animations: "disabled" });
  await page.setViewportSize(prima);
}

const foto = (testInfo, nome) =>
  process.env.DM_FOTO
    ? `${process.env.DM_FOTO}/${nome}-${testInfo.project.name === "mobile" ? "telefono" : "computer"}.png`
    : null;

for (const tema of ["light", "dark"]) {
  test(`Marco e il suo iPhone: una persona, le misure di GdAHome, i giorni del contapassi (${tema})`, async ({
    page,
  }, testInfo) => {
    await boot(page, testInfo, tema);
    const voce = page.locator('.tab[data-tab="salute"]');
    await expect(voce).toHaveCount(1, { timeout: 20_000 });
    await voce.evaluate((n) => n.click());
    const pagina = page.locator("#page-salute");
    await expect(pagina.locator(".dm-salute")).toBeVisible({ timeout: 20_000 });
    /* Una persona sola: niente linguette delle persone. */
    await expect(pagina.locator(".dm-salute-persone")).toHaveCount(0);
    await expect(pagina.locator(".dm-salute-eroe-num")).toHaveText("2.410");
    /* I sette giorni: i passati dal contapassi, oggi da GdAHome. */
    await expect(pagina.locator(".dm-salute-giorno")).toHaveCount(7, { timeout: 10_000 });
    await expect(pagina.locator(".dm-salute-giorno.ora")).toHaveAttribute("title", /2\.410/);
    for (const misura of ["battito", "pressione", "peso"])
      await expect(pagina.locator(`[data-dm-salute-misura="${misura}"]`)).toHaveCount(1);
    await expect(pagina.locator('[data-dm-salute-misura="battito"]')).toContainText("72");
    await expect(pagina.locator('[data-dm-salute-misura="battito"]')).toContainText("69");
    await expect(pagina.locator('[data-dm-salute-misura="pressione"]')).toContainText("124/79");
    await expect(pagina.locator('[data-dm-salute-misura="peso"]')).toContainText("81,4");
    await expect(pagina.locator('[data-dm-salute-misura="peso"]')).toContainText("19,2");
    const chieste = await page.evaluate(() =>
      window.__salute.domande.map((d) => d.statistic_ids[0]),
    );
    expect(chieste).toEqual(
      expect.arrayContaining(["sensor.gdahome_1a2b3c4d_passi", "sensor.iphone_di_marco_steps"]),
    );
    await fotoDellaPagina(
      page,
      foto(testInfo, `salute-marco-${tema === "light" ? "chiaro" : "scuro"}`),
    );
  });
}
