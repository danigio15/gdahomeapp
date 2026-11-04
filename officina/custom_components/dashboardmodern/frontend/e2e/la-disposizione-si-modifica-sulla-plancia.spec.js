/* La disposizione si modifica sulla plancia (#379).
 *
 * «Il discorso drag & drop deve essere ovunque, non solo nei widget.» In testa
 * a ogni pagina c'e' il tasto ✏️: i riquadri e gli elementi degli elenchi si
 * trascinano li' dove sono, l'occhio li nasconde, «Salva» scrive
 * `cd_disposizione` e la pagina resta cosi' anche ricaricandola; «Ripristina»
 * la rimette com'era.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { clickBottomTab } from "./helpers/navigation.js";

test.use({ timezoneId: "Europe/Rome", locale: "it-IT" });

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
    friendly_name: entity_id,
    ...(unit ? { unit_of_measurement: unit } : {}),
    ...extra,
  },
});

const STATI = [
  s("sensor.auto_batteria", "67", "%", { device_class: "battery" }),
  s("sensor.auto_autonomia", "262", "km"),
  s("sensor.auto_potenza_ricarica", "7.2", "kW", { device_class: "power" }),
  s("sensor.auto_stato_ricarica", "in_carica"),
  s("binary_sensor.auto_cavo", "on"),
  s("sensor.auto_odometro", "18240", "km"),
  s("lock.auto_serratura", "locked"),
  s("sensor.auto_temperatura_interna", "21", "°C"),
];
const MAPPA = {
  "dm.ev_batteria_auto": "sensor.auto_batteria",
  "dm.ev_autonomia": "sensor.auto_autonomia",
  "dm.ev_potenza_ricarica": "sensor.auto_potenza_ricarica",
  "dm.ev_stato_ricarica": "sensor.auto_stato_ricarica",
  "dm.ev_cavo_collegato": "binary_sensor.auto_cavo",
  "dm.ev_odometro": "sensor.auto_odometro",
  "dm.ev_portiere": "lock.auto_serratura",
  "dm.ev_temperatura_interna": "sensor.auto_temperatura_interna",
};

async function pontefinto(page) {
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await page.addInitScript((elenco) => {
    class PonteFinto extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      constructor() {
        super();
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(grezzo) {
        const m = JSON.parse(grezzo);
        if (m.type === "auth") return;
        let r = null;
        if (m.type === "get_states") r = elenco;
        else if (m.type === "frontend/get_user_data") r = { value: null };
        else if (m.type === "call_service") r = {};
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({ id: m.id, type: "result", success: true, result: r }),
          }),
        );
      }
      close() {}
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = PonteFinto;
    window.WebSocket = PonteFinto;
  }, STATI);
}

async function lAuto(page) {
  await page.waitForFunction(() => Boolean(window.cdEvApplyCar?.__dmEvSection), null, {
    timeout: 30_000,
  });
  await page.evaluate((mappa) => {
    localStorage.setItem("cd_entity_overrides", JSON.stringify(mappa));
    window.cdApplyCanonicalOverrides?.(mappa);
    localStorage.setItem(
      "cd_ev_cars",
      JSON.stringify([{ uid: "a1", name: "Auto di casa", kwh: "67", ov: mappa }]),
    );
    localStorage.setItem("cd_ev_car_active", "0");
    window.cdEvApplyCar(0);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, MAPPA);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
}

const riquadri = (page) =>
  page.evaluate(() => window.dmDisposizione.elenchi().find((e) => e.chiave === "ev")?.voci || []);

test("sull'Auto i riquadri si trascinano, si salvano e restano dopo aver ricaricato", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await pontefinto(page);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await lAuto(page);
  await clickBottomTab(page, "ev", testInfo);
  await expect(page.locator("#page-ev [data-dm-disp-tasto]")).toBeVisible();
  await expect.poll(() => riquadri(page)).toContain("#lm-hero-card");
  const prima = await riquadri(page);
  expect(prima[0]).toBe("#lm-hero-card");

  await page.locator("#page-ev [data-dm-disp-tasto]").click();
  await expect(page.locator("html")).toHaveAttribute("data-dm-modifica", "ev");
  await expect(page.locator("[data-dm-disp-barra]")).toBeVisible();

  /* Il riquadro in cima, preso dalla sua maniglia col mouse e portato giu'. */
  const maniglia = page.locator("#lm-hero-card [data-dm-disp-ctrl] .dm-disp-maniglia");
  const ultimo = page.locator(`#page-ev [data-dm-disp-voce="${prima.at(-1)}"]`);
  const a = await maniglia.boundingBox();
  const b = await ultimo.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 14; i += 1)
    await page.mouse.move(a.x + a.width / 2, a.y + ((b.y + b.height - a.y) * i) / 14);
  await page.mouse.up();
  await expect.poll(async () => (await riquadri(page)).indexOf("#lm-hero-card")).toBeGreaterThan(0);
  /* E dalla tastiera, fino in fondo. */
  for (let i = 0; i < prima.length; i += 1) {
    await page.locator("#lm-hero-card [data-dm-disp-ctrl] .dm-disp-maniglia").focus();
    await page.keyboard.press("ArrowDown");
  }
  await expect.poll(async () => (await riquadri(page)).at(-1)).toBe("#lm-hero-card");
  await expect(page.locator(".dm-disp-conta")).toContainText("1 modifica");

  /* In modifica un tocco non comanda niente: si nasconde un riquadro. */
  await page.locator(`#page-ev [data-dm-disp-voce="${prima[1]}"] [data-dm-disp-occhio]`).click();
  await expect(page.locator(`#page-ev [data-dm-disp-voce="${prima[1]}"]`)).toHaveAttribute(
    "data-dm-nascosto",
    "",
  );

  await page.locator('[data-dm-disp-azione="salva"]').click();
  await expect(page.locator("html")).not.toHaveAttribute("data-dm-modifica", /./);
  const scritta = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cd_disposizione") || "{}"),
  );
  expect(scritta.ev.ordine.at(-1)).toBe("#lm-hero-card");
  expect(scritta.ev.nascosti).toEqual([prima[1]]);
  await expect(page.locator(`#page-ev [data-dm-nascosto]`).first()).toBeHidden();

  await page.reload();
  await lAuto(page);
  await clickBottomTab(page, "ev", testInfo);
  await expect.poll(async () => (await riquadri(page)).at(-1)).toBe("#lm-hero-card");

  /* Ripristina, Salva: la pagina com'era e niente scritto. */
  await page.locator("#page-ev [data-dm-disp-tasto]").click();
  await page.locator('[data-dm-disp-azione="ripristina"]').click();
  await page.locator('[data-dm-disp-azione="salva"]').click();
  /* Dopo il ricaricamento l'auto mostra anche i riquadri dei dati arrivati
   * nel frattempo: si guarda l'ordine di quelli di prima. */
  await expect
    .poll(async () => (await riquadri(page)).filter((id) => prima.includes(id)))
    .toEqual(prima);
  const dopo = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cd_disposizione") || "{}"),
  );
  expect(dopo.ev).toBeUndefined();
  await expect(page.locator("#page-ev [data-dm-nascosto]")).toHaveCount(0);
});

test("Annulla rimette tutto com'era e non scrive niente", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await pontefinto(page);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await lAuto(page);
  await clickBottomTab(page, "ev", testInfo);
  await expect.poll(() => riquadri(page)).toContain("#lm-hero-card");
  const prima = await riquadri(page);
  await page.locator("#page-ev [data-dm-disp-tasto]").click();
  await page.locator(`#page-ev [data-dm-disp-voce="${prima[0]}"] [data-dm-disp-occhio]`).click();
  await page.locator('[data-dm-disp-azione="annulla"]').click();
  await expect(page.locator("[data-dm-disp-barra]")).toHaveCount(0);
  await expect(page.locator("#page-ev [data-dm-nascosto]")).toHaveCount(0);
  expect(await riquadri(page)).toEqual(prima);
  expect(await page.evaluate(() => localStorage.getItem("cd_disposizione"))).toBeNull();
});
