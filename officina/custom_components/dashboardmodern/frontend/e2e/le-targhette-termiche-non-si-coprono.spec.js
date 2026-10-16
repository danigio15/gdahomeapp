import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* «verifica gli allineamenti»: sul tablet in piedi il quadro dei comandi della
 * stufa copriva la targhetta della stanza, e i due serbatoi della caldaia
 * quella dell'acqua calda. Le posizioni sono in percentuale e i pezzi in
 * pixel: stringendo il palco si venivano addosso. Qui la stessa casa — una
 * caldaia con due serbatoi e l'acqua calda, una stufa coi suoi comandi — si
 * guarda dal telefono al computer, e nessun pezzo della scena deve stare
 * sopra un altro. */
const RENDER = process.env.RENDER_DIR || "";
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
  visibility: { home: true },
};
const s = (id, state, attributes = {}) => [id, { entity_id: id, state, attributes }];
const STATI = Object.fromEntries([
  s("sensor.k_stato", "off"),
  s("sensor.k_corpo", "33", { unit_of_measurement: "°C" }),
  s("sensor.k_mandata", "22", { unit_of_measurement: "°C" }),
  s("sensor.k_acqua", "60", { unit_of_measurement: "°C" }),
  s("sensor.k_alto", "60", { unit_of_measurement: "°C" }),
  s("sensor.k_p1", "33", { unit_of_measurement: "%" }),
  s("sensor.k_p2", "85", { unit_of_measurement: "%" }),
  s("climate.stufa", "off", {
    temperature: 20,
    current_temperature: 21.5,
    hvac_modes: ["off", "heat"],
  }),
  s("sensor.s_temp", "21.5", { unit_of_measurement: "°C" }),
  s("sensor.s_fumi", "30", { unit_of_measurement: "°C" }),
  s("number.s_pot", "3", { min: 1, max: 5, step: 1 }),
  s("number.s_vent", "3", { min: 1, max: 5, step: 1 }),
]);
const CALDAIA = [
  {
    id: "k",
    name: "Klover",
    stato: "sensor.k_stato",
    mandata: "sensor.k_mandata",
    uscita: "boiler",
    temperaturaCaldaia: "sensor.k_corpo",
    acquaCalda: "sensor.k_acqua",
    boilerAlto: "sensor.k_alto",
    pellet: "sensor.k_p1",
    pellet2: "sensor.k_p2",
  },
];
const STUFE = [
  {
    name: "Stufa Piazzetta",
    clima: "climate.stufa",
    temperatura: "sensor.s_temp",
    fumi: "sensor.s_fumi",
    potenza: "number.s_pot",
    ventilatore: "number.s_vent",
  },
  { name: "Stufa alloggio", clima: "climate.stufa" },
];

async function sovrapposti(page) {
  return page.evaluate(() => {
    const scena = document.querySelector(".dm-it-stage:not([hidden])");
    const pezzi = [
      ...scena.querySelectorAll(
        ".dm-it-plate, .dm-it-pellet, .dm-it-nome, .dm-it-stufa-pannello, .dm-it-sonde, .dm-it-caldaia, .dm-it-stufa, .dm-it-fuoco, .dm-it-comandi-caldaia, .dm-it-allarme",
      ),
    ].filter((n) => n.getClientRects().length && getComputedStyle(n).visibility !== "hidden");
    const r = pezzi.map((n) => ({ n, b: n.getBoundingClientRect() }));
    const fuori = [];
    for (let i = 0; i < r.length; i++)
      for (let j = i + 1; j < r.length; j++) {
        const a = r[i],
          c = r[j];
        if (a.n.contains(c.n) || c.n.contains(a.n)) continue;
        if (a.n.closest(".dm-it-nodo") === c.n.closest(".dm-it-nodo")) continue;
        const x = Math.min(a.b.right, c.b.right) - Math.max(a.b.left, c.b.left);
        const y = Math.min(a.b.bottom, c.b.bottom) - Math.max(a.b.top, c.b.top);
        if (x > 2 && y > 2)
          fuori.push(
            `${a.n.className} (${a.n.textContent.trim().slice(0, 18)}) × ${c.n.className} (${c.n.textContent.trim().slice(0, 18)})`,
          );
      }
    return fuori;
  });
}

for (const largo of [390, 744, 820, 1024, 1280]) {
  test(`gestione termica a ${largo} pixel: nessun pezzo ne copre un altro`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: largo, height: 1100 });
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
    await page.evaluate(
      ({ stati, caldaie, stufe }) => {
        Object.assign(eval("_RAW_STATES"), stati);
        localStorage.setItem(
          "cd_impianti_termici",
          JSON.stringify({ solare: false, scaldabagno: false, caldaia: true, stufa: true }),
        );
        localStorage.setItem("cd_caldaia", JSON.stringify(caldaie));
        localStorage.setItem("cd_stufe", JSON.stringify(stufe));
        document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
        document.getElementById("page-boiler")?.classList.add("active");
        window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      },
      { stati: STATI, caldaie: CALDAIA, stufe: STUFE },
    );
    await page.waitForTimeout(600);
    for (const quale of ["caldaia", "stufa"]) {
      await page
        .locator(".dm-it-tab", { hasText: quale === "caldaia" ? /caldaia/i : /stufa/i })
        .first()
        .click();
      await page.waitForTimeout(500);
      const palco = page.locator(".dm-it-stage:not([hidden])");
      if (RENDER) await palco.screenshot({ path: `${RENDER}/${quale}-${largo}.png` });
      expect(await sovrapposti(page), `${quale} a ${largo} pixel`).toEqual([]);
    }
  });
}
