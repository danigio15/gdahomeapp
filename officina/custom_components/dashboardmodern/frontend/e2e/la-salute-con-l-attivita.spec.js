/* «Salute continua a non prendere i dati» (Marco, iPhone con Apple Watch,
 * 4 novembre alle 07:53). In Salute c'erano distanza, piani, l'anello
 * Attivita' (Movimento, Esercizio, In piedi) e le calorie a riposo; nella
 * plancia solo passi, battito e calorie. Ora arrivano tutte: la strada sotto
 * i passi, l'anello in una scheda coi suoi colori. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const ADESSO = Date.parse("2026-11-04T06:53:00Z");
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

const sensore = (valore, nome, unita, quando, classe = "measurement", extra = {}) => ({
  state: String(valore),
  attributes: {
    friendly_name: nome,
    unit_of_measurement: unita,
    state_class: classe,
    gdahome_persona: "Marco",
    misurato_il: quando,
    attribution: "Dal telefono, con GdAHome",
    ...extra,
  },
  last_changed: quando,
  last_updated: quando,
});

/* I numeri degli screenshot di Salute delle 07:53. */
function statiDiMarco() {
  const r = "sensor.gdahome_1a2b3c4d_";
  const ora = "2026-11-04T06:51:00Z";
  return {
    [`${r}passi`]: sensore(278, "Marco Steps", "steps", ora, "total_increasing"),
    [`${r}distanza`]: sensore(
      0.19,
      "Marco Walking running distance",
      "km",
      ora,
      "total_increasing",
      {
        device_class: "distance",
      },
    ),
    [`${r}piani`]: sensore(6, "Marco Flights climbed", "floors", ora, "total_increasing"),
    [`${r}battito`]: sensore(84, "Marco Heart rate", "bpm", "2026-11-04T06:44:00Z"),
    [`${r}battito_riposo`]: sensore(69, "Marco Resting heart rate", "bpm", "2026-11-03T22:10:00Z"),
    [`${r}calorie`]: sensore(
      4.6,
      "Marco Active calories burned",
      "kcal",
      "2026-11-04T06:26:00Z",
      "total_increasing",
    ),
    [`${r}calorie_riposo`]: sensore(
      678,
      "Marco Basal energy burned",
      "kcal",
      "2026-11-04T06:46:00Z",
      "total_increasing",
    ),
    [`${r}esercizio`]: sensore(0, "Marco Exercise time", "min", ora, "total_increasing", {
      device_class: "duration",
    }),
    [`${r}in_piedi`]: sensore(
      1,
      "Marco Stand hours",
      "h",
      "2026-11-04T06:24:00Z",
      "total_increasing",
    ),
  };
}

function storico() {
  const oggi = new Date(ADESSO);
  oggi.setUTCHours(0, 0, 0, 0);
  return {
    "sensor.gdahome_1a2b3c4d_passi": [8120, 5480, 4305, 4940, 6770, 2215, 278].map((v, i, a) => ({
      start: oggi.getTime() - (a.length - 1 - i) * GIORNO,
      change: v,
      max: v,
    })),
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
  test(`L'anello Attività e la strada di oggi arrivano nella pagina (${tema})`, async ({
    page,
  }, testInfo) => {
    await boot(page, testInfo, tema);
    const voce = page.locator('.tab[data-tab="salute"]');
    await expect(voce).toHaveCount(1, { timeout: 20_000 });
    await voce.evaluate((n) => n.click());
    const pagina = page.locator("#page-salute");
    await expect(pagina.locator(".dm-salute")).toBeVisible({ timeout: 20_000 });
    await expect(pagina.locator(".dm-salute-eroe-num")).toHaveText("278");
    /* La strada sotto i passi. */
    const strada = pagina.locator(".dm-salute-eroe-strada");
    await expect(strada).toContainText("0,19 km");
    await expect(strada).toContainText("6 piani");
    /* L'anello: Movimento, Esercizio, In piedi; sotto le calorie a riposo. */
    const anello = pagina.locator('[data-dm-salute-misura="attivita"]');
    await expect(anello).toHaveCount(1);
    await expect(anello.locator(".dm-salute-anello-voce")).toHaveText([
      /Movimento\s*4\s*kcal/,
      /Esercizio\s*0\s*min/,
      /In piedi\s*1\s*h/,
    ]);
    await expect(anello).toContainText("A riposo: 678 kcal");
    await expect(anello).toContainText("totale 682 kcal");
    /* Niente scheda Calorie a parte: sta nell'anello. */
    await expect(pagina.locator('[data-dm-salute-misura="calorie"]')).toHaveCount(0);
    await expect(pagina.locator('[data-dm-salute-misura="battito"]')).toContainText("84");
    await expect(pagina.locator('[data-dm-salute-misura="battito"]')).toContainText(/alle \d\d:44/);
    /* Il testo in fondo vale anche per chi ha l'iPhone. */
    await expect(pagina.locator(".dm-salute-fonte")).toContainText("Apple Salute o Health Connect");
    await fotoDellaPagina(
      page,
      foto(testInfo, `salute-attivita-${tema === "light" ? "chiaro" : "scuro"}`),
    );
  });
}
