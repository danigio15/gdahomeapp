/* Una casa finta per le prove della disposizione (#379): un'auto elettrica
 * in carica e sei luci in due stanze. */
export const SEME = {
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

export async function pontefinto(page) {
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

export async function lAuto(page) {
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

export const SEME_LUCI = {
  ...SEME,
  sections: {
    ...SEME.sections,
    rooms: [
      { name: "Cucina", icon: "🍳" },
      { name: "Sala", icon: "🛋️" },
    ],
    lights: Array.from({ length: 6 }, (_v, i) => ({
      entity: `light.luce_${i}`,
      name: `Luce ${i}`,
      room: i < 3 ? "Cucina" : "Sala",
    })),
  },
  visibility: { home: true, luci: true },
};
export const STATI_LUCI = Object.fromEntries(
  Array.from({ length: 6 }, (_v, i) => [
    `light.luce_${i}`,
    { state: i % 2 ? "off" : "on", attributes: { friendly_name: `Luce ${i}` } },
  ]),
);
