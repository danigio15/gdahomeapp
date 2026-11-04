/* I pezzi del solare termico si spostano dentro il disegno (#379).
 *
 * «Vedi come poter spostare le cose anche nei disegni, tipo i tubi nel solare
 * termico.» Con ✏️ ogni pezzo del disegno ha la sua maniglia: il collettore,
 * l'accumulo, la pompa si trascinano (col mouse o dalla tastiera), i tubi che
 * li toccano si ridisegnano mentre si muovono e l'acqua continua a correrci
 * dentro. Salva scrive `cd_disegni`, una scelta per il computer e una per il
 * telefono; Annulla ed Esc non scrivono niente; «↺ Ripristina il disegno»
 * rimette i tubi fatti a mano, gli stessi di prima.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

test.use({ timezoneId: "Europe/Rome", locale: "it-IT" });

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

const STATI = {
  "sensor.st_pannello": { state: "82.9", attributes: { unit_of_measurement: "°C" } },
  "sensor.st_alto": { state: "74.1", attributes: { unit_of_measurement: "°C" } },
  "sensor.st_basso": { state: "48.3", attributes: { unit_of_measurement: "°C" } },
  "sensor.st_delta": { state: "34.6", attributes: { unit_of_measurement: "°C" } },
  "sensor.st_pressione": { state: "2.4", attributes: { unit_of_measurement: "bar" } },
  "sensor.st_potenza": { state: "0", attributes: { unit_of_measurement: "W" } },
  "binary_sensor.st_pompa": { state: "on", attributes: {} },
  "switch.st_pompa": { state: "on", attributes: {} },
  "switch.st_ctrl": { state: "on", attributes: {} },
  "switch.st_chiave": { state: "on", attributes: {} },
};

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

/* I tubi fatti a mano (core/il-disegno-del-solare.js). */
const A_MANO = {
  computer: {
    "flow-sol-hot": "M 378 116 C 470 116, 520 116, 560 130 C 600 144, 608 168, 625 168",
    "flow-sol-cold": "M 625 330 C 560 330, 520 372, 440 372 L 250 372 C 170 372, 140 350, 130 300",
  },
  telefono: {
    "flow-sol-cold":
      "M 200 420 C 190 452, 170 458, 140 458 L 60 458 C 30 458, 18 440, 18 410 L 18 230 C 18 210, 26 202, 38 198",
  },
};

async function scrivi(page) {
  await page.evaluate((valori) => {
    const grezzi = eval("_RAW_STATES");
    for (const [id, voce] of Object.entries(valori))
      grezzi[id] = { entity_id: id, state: voce.state, attributes: voce.attributes };
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    try {
      window.render?.();
    } catch (_e) {}
  }, STATI);
}

async function apri(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.evaluate(() => document.querySelector('.tab[data-tab="boiler"]')?.click());
  await scrivi(page);
  await expect(page.locator("#page-boiler .dm-st-scene")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#page-boiler .dmx-hot .dmx-dots").first()).toBeAttached();
}

const tubo = (page, id) => page.locator(`#${id}`).getAttribute("d");
const trasla = (page, arte) =>
  page.locator(`#page-boiler [data-dm-st-art="${arte}"]`).getAttribute("transform");
const salvata = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("cd_disegni") || "{}"));

async function entra(page) {
  await page.locator("#page-boiler [data-dm-disp-tasto]").click();
  await expect(page.locator("html")).toHaveAttribute("data-dm-modifica", "boiler");
  await expect(page.locator("[data-dm-disegno-strato='solare']")).toBeAttached();
}

/* Un pezzo preso dalla sua maniglia e portato di (dx, dy) pixel, a passi. */
async function trascina(page, nodo, dx, dy, { durante } = {}) {
  const maniglia = page.locator(`[data-dm-disegno-nodo="${nodo}"]`);
  await expect(maniglia).toBeVisible();
  const box = await maniglia.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i += 1) await page.mouse.move(x + (dx * i) / 10, y + (dy * i) / 10);
  if (durante) await durante();
  await page.mouse.up();
}

test("senza scelta il disegno e' quello fatto a mano, e niente lo ridisegna", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "il computer");
  await apri(page, testInfo);
  expect(await tubo(page, "flow-sol-hot")).toBe(A_MANO.computer["flow-sol-hot"]);
  expect(await tubo(page, "flow-sol-cold")).toBe(A_MANO.computer["flow-sol-cold"]);
  expect(await trasla(page, "collector")).toBeNull();
  expect(await trasla(page, "tank")).toBeNull();
  await expect(page.locator("#dm-st-posizioni")).toHaveCount(0);
});

test("sul computer il collettore si trascina, i tubi lo seguono, Salva lo tiene", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "il computer");
  await apri(page, testInfo);
  await entra(page);
  await expect(page.locator(".dm-dis-variante").first()).toContainText("computer");
  /* Dentro il disegno non c'e' un elenco da riordinare: solo le maniglie. */
  await expect(page.locator("#page-boiler .dm-st-plant [data-dm-disp-voce]")).toHaveCount(0);
  for (const nodo of ["collettore", "accumulo", "pompa", "valvola"])
    await expect(page.locator(`[data-dm-disegno-nodo="${nodo}"]`)).toBeVisible();
  /* «Niente da spostare» non si dice sopra un disegno con le maniglie. */
  await expect(page.locator(".dm-disp-conta")).not.toContainText("niente da spostare");

  let guide = 0;
  await trascina(page, "collettore", 60, 40, {
    durante: async () => {
      await expect(page.locator("html")).toHaveAttribute(
        "data-dm-disegno-trascinando",
        "collettore",
      );
      guide = await page.locator(".dm-dis-guida").count();
    },
  });
  expect(guide).toBeGreaterThanOrEqual(0);
  await expect.poll(() => trasla(page, "collector")).toMatch(/^translate\(/);
  await expect.poll(() => tubo(page, "flow-sol-hot")).not.toBe(A_MANO.computer["flow-sol-hot"]);
  await expect.poll(() => tubo(page, "flow-sol-cold")).not.toBe(A_MANO.computer["flow-sol-cold"]);
  /* L'acqua corre nel tubo nuovo: la corrente ha la stessa strada del tubo. */
  const caldo = await tubo(page, "flow-sol-hot");
  expect(await page.locator("#page-boiler .dmx-hot .dmx-dots").first().getAttribute("d")).toBe(
    caldo,
  );
  await expect
    .poll(() =>
      page
        .locator("#page-boiler .dmx-hot .dmx-dots")
        .first()
        .evaluate((n) => n.getAnimations().filter((a) => a.playState === "running").length),
    )
    .toBeGreaterThan(0);
  await expect(page.locator(".dm-disp-conta")).toContainText("1 modifica");
  /* Niente si e' scritto prima di Salva. */
  expect(await salvata(page)).toEqual({});

  await page.locator('[data-dm-disp-azione="salva"]').click();
  await expect(page.locator("html")).not.toHaveAttribute("data-dm-modifica", /./);
  const scritta = await salvata(page);
  expect(Object.keys(scritta)).toEqual(["solare:computer"]);
  expect(scritta["solare:computer"].collettore).toBeTruthy();
  const trasformazione = await trasla(page, "collector");
  expect(trasformazione).toMatch(/^translate\(/);
  await expect(page.locator("[data-dm-disegno-strato]")).toHaveCount(0);

  /* Ricaricando resta. */
  await page.reload();
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.evaluate(() => document.querySelector('.tab[data-tab="boiler"]')?.click());
  await scrivi(page);
  await expect(page.locator("#page-boiler .dm-st-scene")).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => trasla(page, "collector")).toBe(trasformazione);
  await expect.poll(() => tubo(page, "flow-sol-hot")).toBe(caldo);
  await expect(page.locator("#dm-st-posizioni")).toHaveCount(1);
});

test("dalla tastiera; Esc due volte esce senza scrivere niente", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "il computer");
  await apri(page, testInfo);
  await entra(page);
  const pompa = page.locator("#syn-p-solare");
  const prima = await pompa.boundingBox();
  await page.locator('[data-dm-disegno-nodo="pompa"]').focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  await expect.poll(async () => (await pompa.boundingBox()).x).toBeGreaterThan(prima.x + 20);
  await expect.poll(() => tubo(page, "flow-sol-cold")).not.toBe(A_MANO.computer["flow-sol-cold"]);
  /* Il fuoco resta sulla maniglia, per la freccia seguente. */
  await expect(page.locator('[data-dm-disegno-nodo="pompa"]')).toBeFocused();
  await expect(page.locator(".dm-disp-conta")).toContainText("1 modifica");
  await page.keyboard.press("Escape");
  await expect(page.locator("html")).toHaveAttribute("data-dm-modifica", "boiler");
  await page.keyboard.press("Escape");
  await expect(page.locator("html")).not.toHaveAttribute("data-dm-modifica", /./);
  expect(await salvata(page)).toEqual({});
  await expect.poll(() => tubo(page, "flow-sol-cold")).toBe(A_MANO.computer["flow-sol-cold"]);
  await expect.poll(async () => (await pompa.boundingBox()).x).toBeLessThan(prima.x + 2);
});

test("Annulla rimette tutto; «↺ Ripristina il disegno» rimette i tubi fatti a mano", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "il computer");
  await apri(page, testInfo);
  /* Una scelta che arriva da un altro dispositivo. */
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_disegni",
      JSON.stringify({ "solare:computer": { accumulo: { x: 70, y: 50 } } }),
    );
    window.dispatchEvent(new CustomEvent("dashboardmodern:config-synced"));
  });
  await expect.poll(() => trasla(page, "tank")).toMatch(/^translate\(/);
  const spostato = await tubo(page, "flow-sol-hot");
  expect(spostato).not.toBe(A_MANO.computer["flow-sol-hot"]);

  /* Annulla: lo spostamento della modifica se ne va, quello salvato resta. */
  await entra(page);
  await trascina(page, "pompa", -80, 0);
  await expect.poll(() => tubo(page, "flow-sol-cold")).not.toBe(await tubo(page, "flow-sol-hot"));
  await page.locator('[data-dm-disp-azione="annulla"]').click();
  await expect(page.locator("html")).not.toHaveAttribute("data-dm-modifica", /./);
  expect(await tubo(page, "flow-sol-hot")).toBe(spostato);
  expect(Object.keys((await salvata(page))["solare:computer"])).toEqual(["accumulo"]);

  /* ↺ Ripristina il disegno, e Salva: i tubi tornano quelli di prima, lettera per lettera. */
  await entra(page);
  await page.locator(".dm-dis-testa [data-dm-disegno-ripristina]").click();
  await expect.poll(() => tubo(page, "flow-sol-hot")).toBe(A_MANO.computer["flow-sol-hot"]);
  expect(await tubo(page, "flow-sol-cold")).toBe(A_MANO.computer["flow-sol-cold"]);
  expect(await trasla(page, "tank")).toBeNull();
  await expect(page.locator(".dm-disp-conta")).toContainText("1 modifica");
  await page.locator('[data-dm-disp-azione="salva"]').click();
  expect(await salvata(page)).toEqual({});
  await expect(page.locator("#dm-st-posizioni")).toHaveCount(0);
});

test("sul telefono la scelta e' del telefono: il computer resta com'era", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "il telefono");
  await apri(page, testInfo);
  expect(await tubo(page, "flow-sol-cold")).toBe(A_MANO.telefono["flow-sol-cold"]);
  await page.locator("#page-boiler [data-dm-disp-tasto]").scrollIntoViewIfNeeded();
  await entra(page);
  await expect(page.locator(".dm-dis-variante").first()).toContainText("telefono");
  await page.locator('[data-dm-disegno-nodo="pompa"]').scrollIntoViewIfNeeded();
  await trascina(page, "pompa", 60, -30);
  await expect.poll(() => tubo(page, "flow-sol-cold")).not.toBe(A_MANO.telefono["flow-sol-cold"]);
  await page.locator('[data-dm-disp-azione="salva"]').click();
  const scritta = await salvata(page);
  expect(Object.keys(scritta)).toEqual(["solare:telefono"]);
  expect(scritta["solare:telefono"].pompa).toBeTruthy();
});
