/* La Salute (#227) con Strava dentro (#344): «una sezione salute che importa
 * i dati da una app della persona: peso, passi, frequenza cardiaca,
 * pressione, sonno», e Strava nella sua linguetta. I sensori sono quelli che
 * Home Assistant ha davvero — Health Connect dal telefono di Marco, Withings
 * di Giulia, l'integrazione Strava di HACS (`helpers/salute-finto.js`,
 * `helpers/strava-finto.js`); il Recorder e' finto solo nel filo. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { passiDellaSettimana, pesoDelMese, statiSalute } from "./helpers/salute-finto.js";
import { settimaneDellaBici, settimaneDellaCorsa, statiStrava } from "./helpers/strava-finto.js";

const ADESSO = Date.parse("2026-10-29T10:00:00Z");

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

const lista = (stati) => Object.entries(stati).map(([entity_id, s]) => ({ entity_id, ...s }));

async function boot(
  page,
  testInfo,
  { tema = "light", corpo = true, strava = true, salute = null } = {},
) {
  await page.clock.setFixedTime(ADESSO);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  const stati = lista({ ...(corpo ? statiSalute() : {}), ...(strava ? statiStrava() : {}) });
  await page.addInitScript(
    ({ stati, storico, salute }) => {
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
    {
      stati,
      salute,
      storico: {
        "sensor.stats_all_run_distance": settimaneDellaCorsa(ADESSO),
        "sensor.stats_all_ride_distance": settimaneDellaBici(ADESSO),
        "sensor.pixel_8_steps": passiDellaSettimana(ADESSO),
        "sensor.pixel_8_weight": pesoDelMese(ADESSO),
      },
    },
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60_000,
  });
  await expect(page.locator("#cd-boot-overlay")).toHaveCount(0, { timeout: 30_000 });
  await page.evaluate(
    ({ stati, tema, salute }) => {
      document.documentElement.setAttribute("data-theme", tema);
      if (salute) localStorage.setItem("cd_salute", JSON.stringify(salute));
      for (const s of stati) {
        _RAW_STATES[s.entity_id] = structuredClone(s);
        STATES[s.entity_id] = structuredClone(s);
      }
      window.render?.();
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
    },
    { stati, tema, salute },
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
  process.env.DM_FOTO ? `${process.env.DM_FOTO}/${nome}-${testInfo.project.name}.png` : null;

async function apriLaSalute(page) {
  const voce = page.locator('.tab[data-tab="salute"]');
  await expect(voce).toHaveCount(1, { timeout: 20_000 });
  await voce.evaluate((n) => n.click());
  await expect(page.locator("#page-salute .dm-salute")).toBeVisible({ timeout: 20_000 });
}

for (const tema of ["light", "dark"]) {
  test(`Il corpo: i passi con l'obiettivo, i sette giorni, le misure, il peso del mese (${tema})`, async ({
    page,
  }, testInfo) => {
    await boot(page, testInfo, { tema, salute: { nomi: { "Pixel 8": "Marco" } } });
    await apriLaSalute(page);
    const pagina = page.locator("#page-salute");
    await expect(pagina.locator(".dm-salute-viste button")).toHaveCount(2);
    await expect(pagina.locator('[data-dm-salute-chi="Pixel 8"]')).toHaveText("Marco");
    await expect(pagina.locator(".dm-salute-eroe-num")).toHaveText("7.842");
    await expect(pagina.locator(".dm-salute-eroe-anello")).toContainText("78%");
    await expect(pagina.locator(".dm-salute-giorno")).toHaveCount(7, { timeout: 10_000 });
    for (const misura of ["battito", "pressione", "peso", "sonno", "ossigeno", "calorie"])
      await expect(pagina.locator(`[data-dm-salute-misura="${misura}"]`)).toHaveCount(1);
    await expect(pagina.locator('[data-dm-salute-misura="pressione"]')).toContainText("124/81");
    await expect(
      pagina.locator('[data-dm-salute-misura="pressione"] .dm-salute-fascia'),
    ).toHaveText("Ottimale");
    await expect(pagina.locator('[data-dm-salute-misura="sonno"]')).toContainText("7 h 32");
    await expect(pagina.locator('[data-dm-salute-misura="peso"] .dm-salute-linea svg')).toHaveCount(
      1,
      { timeout: 10_000 },
    );
    const chieste = await page.evaluate(() =>
      window.__salute.domande.map((d) => `${d.statistic_ids[0]}:${d.period}`),
    );
    expect(chieste).toEqual(
      expect.arrayContaining(["sensor.pixel_8_steps:day", "sensor.pixel_8_weight:day"]),
    );
    await fotoDellaPagina(page, foto(testInfo, `salute-corpo-${tema}`));
    /* Giulia: la bilancia e il misuratore Withings, la pressione alta. */
    await pagina.locator('[data-dm-salute-chi="Giulia"]').click();
    await expect(pagina.locator(".dm-salute-eroe")).toHaveCount(0);
    await expect(
      pagina.locator('[data-dm-salute-misura="pressione"] .dm-salute-fascia'),
    ).toHaveText("Alta");
    await expect(pagina.locator('[data-dm-salute-misura="peso"]')).toContainText(
      "Massa grassa: 24,8%",
    );
    await fotoDellaPagina(page, foto(testInfo, `salute-giulia-${tema}`));
  });
}

test("la linguetta Strava: la settimana, le dodici settimane, la bici coi record", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await apriLaSalute(page);
  const pagina = page.locator("#page-salute");
  await pagina.locator('[data-dm-salute-vista="strava"]').click();
  await expect(pagina.locator(".dm-strava-eroe-km")).toContainText("31,6 km");
  await expect(pagina.locator(".dm-strava-barra")).toHaveCount(12, { timeout: 10_000 });
  const prima = pagina.locator(".dm-strava-att").first();
  await expect(prima).toHaveAttribute("href", "https://www.strava.com/activities/16234567890");
  await expect(prima).toHaveAttribute("target", "_blank");
  await fotoDellaPagina(page, foto(testInfo, "salute-strava-corsa"));
  await pagina.locator('[data-dm-strava-sport="ride"]').click();
  await expect(pagina.locator(".dm-strava-eroe-km")).toContainText("86,3 km");
  await expect(pagina.locator(".dm-strava-record")).toContainText("184,2 km");
  await expect(pagina.locator(".dm-strava-barra")).toHaveCount(12, { timeout: 10_000 });
  await fotoDellaPagina(page, foto(testInfo, "salute-strava-bici"));
});

test("in Home: la tessera Salute coi passi e la sua finestra col corpo e Strava", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo, { salute: { nomi: { "Pixel 8": "Marco" } } });
  await page.locator('.tab[data-tab="home"]').evaluate((n) => n.click());
  const tessera = page.locator('#dm-widgets .dm-tile[data-dm-widget="salute"]');
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  await expect(tessera).toContainText("7.842");
  const doveTessera = foto(testInfo, "salute-tessera");
  if (doveTessera)
    await page.locator("#dm-widgets").screenshot({ path: doveTessera, animations: "disabled" });
  await tessera.click();
  const finestra = page.locator("#dm-widget-popup");
  await expect(finestra.locator(".dm-salute-finestra .dm-salute-eroe")).toHaveCount(1);
  await expect(finestra.locator(".dm-salute-finestra .dm-strava-att")).toHaveCount(3);
  const doveFinestra = foto(testInfo, "salute-finestra");
  if (doveFinestra) {
    await page.waitForTimeout(300);
    await finestra.screenshot({ path: doveFinestra, animations: "disabled" });
  }
});

test("solo Strava: la pagina si apre su Strava, senza linguette", async ({ page }, testInfo) => {
  await boot(page, testInfo, { corpo: false });
  await apriLaSalute(page);
  const pagina = page.locator("#page-salute");
  await expect(pagina.locator(".dm-salute-viste")).toHaveCount(0);
  await expect(pagina.locator(".dm-strava-eroe-km")).toContainText("31,6 km");
});

test("senza misure e senza Strava non c'e' ne' la voce ne' la tessera", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo, { corpo: false, strava: false });
  await page.waitForTimeout(800);
  await expect(page.locator('.tab[data-tab="salute"]:visible')).toHaveCount(0);
  await expect(page.locator('#dm-widgets .dm-tile[data-dm-widget="salute"]')).toHaveCount(0);
});

test("la scheda Salute del Config: il nome, l'obiettivo, una misura tolta, l'interruttore", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await expect(page.locator('.tab[data-tab="salute"]')).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => window.apriConfigEntita?.());
  await page.evaluate(() => window.editorSwitch?.("salute"));
  const corpo = page.locator("#ed-body .dm-salute-ed");
  await expect(corpo).toBeVisible({ timeout: 20_000 });
  const dove = foto(testInfo, "salute-config");
  if (dove) await page.locator("#ed-body").screenshot({ path: dove, animations: "disabled" });
  await corpo.locator('[data-dm-salute-nome="Pixel 8"]').fill("Marco");
  await corpo.locator('[data-dm-salute-nome="Pixel 8"]').dispatchEvent("change");
  await corpo.locator("[data-dm-salute-obiettivo]").fill("8000");
  await corpo.locator("[data-dm-salute-obiettivo]").dispatchEvent("change");
  await corpo.locator('[data-dm-salute-scelta="sonno"]').selectOption("-");
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("cd_salute") || "{}")))
    .toMatchObject({ obiettivoPassi: 8000, nomi: { "Pixel 8": "Marco" }, scelte: { sonno: "-" } });
  await page.locator('#ed-body [data-key="salute"]').click();
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("cd_sections") || "{}").salute))
    .toBe(false);
  await expect(page.locator('.tab[data-tab="salute"]')).toBeHidden({ timeout: 10_000 });
});
