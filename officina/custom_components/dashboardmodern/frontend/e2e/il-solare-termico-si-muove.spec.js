/* Il solare termico si muove, anche a movimento ridotto.
 *
 * «Il solare termico e' statico.» Su molti desktop il movimento ridotto e'
 * acceso senza che chi guarda lo sappia, e il ramo della sezione spegneva lo
 * stato: il flusso nei tubi e la pompa. Qui, sulla pagina vera: con la pompa
 * accesa l'acqua corre — anche a movimento ridotto, piu' piano — e la girante
 * gira al passo del ΔT; con la pompa spenta i tubi sono grigi e fermi; col
 * boiler in potenza la pagina lo sa dal modello; e nella «plancia leggera»
 * dell'app, che ferma ogni animazione dopo un giro, lo stato continua.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const MAPPA = {
  "dm.boiler_sonda_temperatura_1": "sensor.st_pannello",
  "dm.boiler_sonda_temperatura_2": "sensor.st_basso",
  "dm.boiler_sonda_temperatura_3": "sensor.st_alto",
  "dm.boiler_delta_temperatura": "sensor.st_delta",
  "dm.boiler_pressione_acqua": "sensor.st_pressione",
  "dm.boiler_potenza_resistenza_boiler": "sensor.st_potenza",
  "dm.boiler_stato_pompa_solare": "binary_sensor.st_pompa",
  "dm.boiler_pompa_solare": "switch.st_pompa",
  "dm.boiler_interruttore_solare_termico": "switch.st_ctrl",
  "dm.boiler_chiave_solare": "switch.st_chiave",
};

const stati = ({ pompa = true, potenza = 0, delta = "34.6", pannello = "82.9" } = {}) => ({
  "sensor.st_pannello": { state: pannello, attributes: { unit_of_measurement: "°C" } },
  "sensor.st_alto": { state: "74.1", attributes: { unit_of_measurement: "°C" } },
  "sensor.st_basso": { state: "48.3", attributes: { unit_of_measurement: "°C" } },
  "sensor.st_delta": { state: delta, attributes: { unit_of_measurement: "°C" } },
  "sensor.st_pressione": { state: "2.4", attributes: { unit_of_measurement: "bar" } },
  "sensor.st_potenza": { state: String(potenza), attributes: { unit_of_measurement: "W" } },
  "binary_sensor.st_pompa": { state: pompa ? "on" : "off", attributes: {} },
  "switch.st_pompa": { state: pompa ? "on" : "off", attributes: {} },
  "switch.st_ctrl": { state: "on", attributes: {} },
  "switch.st_chiave": { state: "on", attributes: {} },
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
    entityOverrides: MAPPA,
  },
  visibility: { home: true, boiler: true },
};

async function scrivi(page, letture) {
  await page.evaluate((valori) => {
    const grezzi = eval("_RAW_STATES");
    for (const [id, voce] of Object.entries(valori))
      grezzi[id] = { entity_id: id, state: voce.state, attributes: voce.attributes };
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    try {
      window.render?.();
    } catch (_e) {}
  }, letture);
}

async function apri(page, testInfo, letture = stati()) {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.evaluate(() => document.querySelector('.tab[data-tab="boiler"]')?.click());
  await scrivi(page, letture);
  await expect(page.locator("#page-boiler .dm-st-scene")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#page-boiler .dmx-hot .dmx-dots").first()).toBeAttached();
}

/* Le animazioni di un elemento che stanno girando davvero. */
const inCorsa = (locator) =>
  locator.evaluate((nodo) =>
    nodo
      .getAnimations()
      .filter((a) => a.playState === "running")
      .map((a) => a.animationName),
  );

test("a movimento ridotto il flusso e la pompa girano lo stesso, piu' piano", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await apri(page, testInfo);
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
    true,
  );
  await expect.poll(() => inCorsa(page.locator("#flow-sol-hot"))).toContain("dmStFlow");
  await expect
    .poll(() => inCorsa(page.locator("#page-boiler .dmx-hot .dmx-dots").first()))
    .toContain("dmxRun25");
  await expect
    .poll(() => inCorsa(page.locator("#syn-p-solare .dm-st-rotor")))
    .toContain("spinAnim");
  /* Piu' piano: la girante a un quarto del passo. */
  const girante = await page
    .locator("#syn-p-solare .dm-st-rotor")
    .evaluate((n) => getComputedStyle(n).animationDuration);
  expect(Number.parseFloat(girante)).toBeCloseTo(4 * (4 / 12), 2);
  /* La decorazione invece si ferma. */
  expect(await inCorsa(page.locator("#page-boiler .dmx-sweep"))).toEqual([]);
});

test("il passo viene dal ΔT vero, e il boiler in potenza dal modello", async ({
  page,
}, testInfo) => {
  await apri(page, testInfo, stati({ delta: "34.6", potenza: 1800 }));
  const pagina = page.locator("#page-boiler");
  await expect
    .poll(() => pagina.evaluate((n) => n.style.getPropertyValue("--dmx-cycle")))
    .toBe("0.6667s");
  await expect(pagina).toHaveAttribute("data-dmx-boiler", "on");
  await expect
    .poll(() => inCorsa(page.locator("#page-boiler .dmx-element")))
    .toContain("dmxElement");
  /* Il ΔT scende: l'acqua rallenta, senza ricaricare niente. */
  await scrivi(page, stati({ delta: "4", potenza: 0 }));
  await expect
    .poll(() => pagina.evaluate((n) => n.style.getPropertyValue("--dmx-cycle")))
    .toBe("2.0000s");
  await expect(pagina).toHaveAttribute("data-dmx-boiler", "off");
});

test("a pompa spenta i tubi solari sono grigi e fermi", async ({ page }, testInfo) => {
  await apri(page, testInfo, stati({ pompa: false }));
  await expect
    .poll(() => inCorsa(page.locator("#page-boiler .dmx-hot .dmx-dots").first()))
    .toEqual([]);
  const tubo = await page
    .locator("#page-boiler .syn-pipe-inner.dm-st-run-hot")
    .first()
    .evaluate((n) => getComputedStyle(n).stroke);
  expect(tubo).toBe("rgb(213, 219, 227)");
});

test("nella plancia leggera dell'app lo stato continua a girare", async ({ page }, testInfo) => {
  /* Lo stile vero dell'app, dal suo sorgente. */
  const qui = dirname(fileURLToPath(import.meta.url));
  const dart = readFileSync(join(qui, "../../../../../app/lib/plancia/premesse.dart"), "utf8");
  const da = dart.indexOf("static const String stileLeggero =");
  const pezzo = dart.slice(da, dart.indexOf("';", da) + 2);
  const css = [...pezzo.matchAll(/'((?:\\.|[^'\\])*)'/g)]
    .map((m) => m[1])
    .join("")
    .replace(/<\/?style[^>]*>/g, "");
  await apri(page, testInfo);
  await page.addStyleTag({ content: css });
  const conta = (sel) =>
    page
      .locator(sel)
      .first()
      .evaluate((n) => getComputedStyle(n).animationIterationCount);
  expect(await conta("#page-boiler .dmx-hot .dmx-dots")).toBe("infinite");
  expect(await conta("#syn-p-solare .dm-st-rotor")).toBe("infinite");
  expect(await conta("#flow-sol-hot")).toBe("infinite");
  /* La decorazione invece fa un giro e si ferma, com'e' giusto li'. */
  expect(await conta("#page-boiler .dmx-sweep")).toBe("1");
});

/* «Con la pompa spenta dice "Impianto in attesa"»: spenta e' spenta. */
const laScritta = (page) =>
  page
    .locator("#page-boiler .dm-st-live")
    .evaluate((n) => getComputedStyle(n, "::after").content.replace(/^"|"$/g, ""));

test("la pastiglia dice «Impianto spento» a pompa ferma, «Carico solare attivo» a pompa accesa", async ({
  page,
}, testInfo) => {
  await apri(page, testInfo, stati({ pompa: false, delta: "2.1" }));
  await expect.poll(() => laScritta(page)).toBe("Impianto spento");
  await scrivi(page, stati({ pompa: true }));
  await expect.poll(() => laScritta(page)).toBe("Carico solare attivo");
});

/* La valvola di sicurezza sta sul fianco dell'accumulo, non sul coperchio, e
 * non tocca le schede ne' la linea dell'acqua calda. */
test("la valvola di sicurezza sta sul fianco dell'accumulo", async ({ page }, testInfo) => {
  await apri(page, testInfo);
  const box = (sel) =>
    page
      .locator(sel)
      .first()
      .evaluate((n) => {
        const r = n.getBoundingClientRect();
        return { x: r.left, y: r.top, r: r.right, b: r.bottom };
      });
  const valvola = await box("#page-boiler .dm-st-node-tank .sv-wrap");
  const corpo = await box("#page-boiler .dm-st-tank-body");
  const coperchio = await box("#page-boiler .dm-st-tank-cap");
  /* Sotto il coperchio, nella meta' alta del fianco. */
  expect(valvola.y).toBeGreaterThanOrEqual(coperchio.y + (coperchio.b - coperchio.y) / 2 - 2);
  expect(valvola.y).toBeLessThan(corpo.y + (corpo.b - corpo.y) / 2);
  /* Fuori dal corpo, attaccata al fianco. */
  const aSinistra = valvola.r <= corpo.x + 6 && valvola.r >= corpo.x - 6;
  const aDestra = valvola.x >= corpo.r - 6 && valvola.x <= corpo.r + 6;
  expect(aSinistra || aDestra).toBe(true);
  /* Lontana dalle schede. */
  const sovrappone = (a, b) => a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
  for (const sel of [
    '#page-boiler .probe[data-dm-st-probe="alto"]',
    '#page-boiler [data-dm-st-kpi="press"]',
    '#page-boiler [data-dm-st-kpi="power"]',
    "#syn-v-chiave",
  ])
    expect(sovrappone(valvola, await box(sel)), sel).toBe(false);
});
