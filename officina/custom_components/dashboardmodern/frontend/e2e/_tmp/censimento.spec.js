import { test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { bootNamespacedDashboard } from "../helpers/namespaced-dashboard.js";

const OUT = process.env.CENSIMENTO_OUT || "/tmp/censimento.json";

const seed = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "r1", name: "Salone", icon: "mdi:sofa", temp: "sensor.t_salone", hum: "sensor.h_salone", floor: "Piano terra" },
      { id: "r2", name: "Cucina", icon: "mdi:countertop", floor: "Piano terra" },
      { id: "r3", name: "Camera", icon: "mdi:bed", floor: "Primo piano" },
    ],
    cameras: [{ id: "c1", name: "Ingresso", entity: "camera.ingresso", room: "Salone" }],
    appliances: [
      { id: "a1", name: "Lavatrice", entity: "sensor.lavatrice", visual_key: "washer", room: "Cucina", energy: "sensor.e1" },
      { id: "a2", name: "Forno", entity: "sensor.forno", visual_key: "oven", room: "Cucina" },
    ],
    loads: [{ id: "l1", name: "Pompa", entity: "sensor.p_pompa" }],
    lights: [],
    climate: [{ id: "cl1", name: "Clima salone", entity: "climate.salone", room: "Salone", type: "clima" }],
    ev: [],
    covers: [{ id: "cv1", name: "Tapparella salone", entity: "cover.salone", room: "Salone" }],
    prese: [{ name: "TV", entity: "switch.tv", room: "Salone" }],
    pool: {},
    irrigation: { zones: [{ id: "z1", name: "Prato", entity: "switch.prato" }] },
    energy: { grid_power: "sensor.rete", solar_power: "sensor.fv" },
    entityOverrides: {},
    quick_actions: [
      { name: "Luci salone", entity: "light.salone", icon: "mdi:lightbulb", group: "Luci" },
      { name: "Cancello", entity: "switch.cancello", icon: "mdi:gate", group: "Esterni" },
    ],
  },
  visibility: {
    home: true, temp: true, tapparelle: true, piscina: true, irrigazione: true, ev: true,
    energy: true, appliances: true, clima: true, security: true, stanze: true, luci: true, prese: true,
  },
};

const STATES = {
  "sensor.t_salone": { state: "21.5", attributes: { unit_of_measurement: "°C", device_class: "temperature" } },
  "sensor.h_salone": { state: "48", attributes: { unit_of_measurement: "%", device_class: "humidity" } },
  "sensor.lavatrice": { state: "0", attributes: {} },
  "sensor.forno": { state: "0", attributes: {} },
  "sensor.e1": { state: "3", attributes: { unit_of_measurement: "kWh", device_class: "energy" } },
  "sensor.p_pompa": { state: "120", attributes: { unit_of_measurement: "W", device_class: "power" } },
  "climate.salone": { state: "heat", attributes: { temperature: 21, current_temperature: 20 } },
  "cover.salone": { state: "open", attributes: { current_position: 100, supported_features: 15 } },
  "switch.tv": { state: "on", attributes: {} },
  "switch.prato": { state: "off", attributes: {} },
  "light.salone": { state: "on", attributes: {} },
  "switch.cancello": { state: "off", attributes: {} },
  "camera.ingresso": { state: "idle", attributes: {} },
  "sensor.rete": { state: "800", attributes: { unit_of_measurement: "W", device_class: "power" } },
  "sensor.fv": { state: "1500", attributes: { unit_of_measurement: "W", device_class: "power" } },
  "weather.casa": { state: "sunny", attributes: { temperature: 24 } },
};

async function raccogli(page, dove) {
  return page.evaluate((luogo) => {
    const EMOJI = /\p{Extended_Pictographic}/gu;
    const visibile = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      const s = getComputedStyle(el);
      return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05;
    };
    const chi = (el) => {
      const parti = [];
      for (let n = el; n && n !== document.body && parti.length < 4; n = n.parentElement) {
        const c = [...n.classList].slice(0, 2).join(".");
        parti.unshift(n.id ? `#${n.id}` : `${n.tagName.toLowerCase()}${c ? "." + c : ""}`);
        if (n.id) break;
      }
      return parti.join(" > ");
    };
    const trovate = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const testo = t.nodeValue || "";
      const e = testo.match(EMOJI);
      if (!e) continue;
      const el = t.parentElement;
      if (!visibile(el) || el.closest("script,style,title")) continue;
      const contesto = (el.closest("button,article,li,.tab,[class*=card],[class*=tile],[class*=row]") || el).innerText
        ?.replace(/\s+/g, " ")
        .slice(0, 70);
      trovate.push({ dove: luogo, emoji: [...new Set(e)].join(""), elemento: chi(el), contesto });
    }
    return trovate;
  }, dove);
}

test("censimento delle emoji a schermo", async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seed);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.evaluate((s) => {
    const raw = eval("_RAW_STATES");
    for (const [id, v] of Object.entries(s)) {
      raw[id] = { entity_id: id, ...v, attributes: { friendly_name: id, ...v.attributes } };
      STATES[id] = raw[id];
    }
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATES);
  await page.waitForTimeout(2500);
  const tutte = [];
  const tabs = await page.evaluate(() =>
    [...document.querySelectorAll("nav.bottom-nav-bar .tab")].map((t) => ({
      id: t.dataset.tab,
      nome: t.innerText.trim(),
    })),
  );
  for (const tab of tabs) {
    await page.evaluate((id) => {
      const t = document.querySelector(`nav.bottom-nav-bar .tab[data-tab="${id}"]`);
      t?.click();
    }, tab.id);
    await page.waitForTimeout(1500);
    tutte.push(...(await raccogli(page, `Pagina: ${tab.nome || tab.id}`)));
  }
  /* Il Config: ogni linguetta. */
  const schede = await page.evaluate(async () => {
    window.apriConfigEntita?.();
    await new Promise((r) => setTimeout(r, 1200));
    return [...document.querySelectorAll("#editor-modal [data-ed-tab],#editor-modal .ed-tab")]
      .map((b) => ({ id: b.dataset.edTab || b.getAttribute("onclick")?.match(/editorSwitch\('([^']+)'/)?.[1], nome: b.innerText.trim() }))
      .filter((b) => b.id);
  });
  for (const scheda of schede) {
    await page.evaluate((id) => window.editorSwitch?.(id), scheda.id);
    await page.waitForTimeout(900);
    tutte.push(...(await raccogli(page, `Config: ${scheda.nome || scheda.id}`)));
  }
  writeFileSync(OUT, JSON.stringify({ tabs, schede, tutte }, null, 1));
});
