/* Le zone sul prato dell'irrigazione si spostano (#379).
 *
 * «Vedi come poter spostare le cose anche nei disegni.» Con ✏️ sulla pagina
 * Irrigazione ogni irrigatore ha la sua maniglia: si mette dove sta davvero in
 * giardino, e l'acqua gli va dietro. La scelta sta in `cd_disegni`
 * («irrigazione:computer» o «irrigazione:telefono») col nome della valvola
 * della zona, cosi' riordinare le zone nel Config non le mescola. Senza
 * scelta il prato e' quello di sempre.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

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
  visibility: { home: true, irrigazione: true },
};

const ZONE = [
  { name: "Prato fronte", entity: "switch.irr_prato", mins: 12 },
  { name: "Siepe", entity: "switch.irr_siepe", mins: 8 },
  { name: "Orto", entity: "valve.irr_orto", mins: 15 },
];

async function apri(page, testInfo, zone = ZONE) {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await mostraLeZone(page, zone);
}

async function mostraLeZone(page, zone) {
  await page.evaluate((zone) => {
    localStorage.setItem("cd_irrigazione", JSON.stringify({ zones: zone, time: "06:30" }));
    const raw = eval("_RAW_STATES");
    for (const z of zone) raw[z.entity] = { entity_id: z.entity, state: "off", attributes: {} };
    document.querySelectorAll(".page").forEach((n) => n.classList.remove("active"));
    document.getElementById("page-irrigazione")?.classList.add("active");
    window.renderIrrigazione();
  }, zone);
  await expect(page.locator("#page-irrigazione [data-dm-lawn] .dm-zone")).toHaveCount(zone.length);
}

const zona = (page, valvola) =>
  page.locator(`#page-irrigazione .dm-zone[data-dm-pezzo="zona:${valvola}"]`);
const posto = (loc) =>
  loc.evaluate((n) => ({
    x: getComputedStyle(n).getPropertyValue("--zx").trim(),
    y: getComputedStyle(n).getPropertyValue("--zy").trim(),
  }));
const salvata = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("cd_disegni") || "{}"));

async function entra(page) {
  await page.evaluate(() => window.dmDisposizione.entraInModifica());
  await expect(page.locator("html")).toHaveAttribute("data-dm-modifica", "irrigazione");
  await expect(page.locator("[data-dm-disegno-strato='irrigazione']")).toBeAttached();
}

async function trascina(page, nodo, dx, dy) {
  const maniglia = page.locator(`[data-dm-disegno-nodo="${nodo}"]`);
  await maniglia.scrollIntoViewIfNeeded();
  const box = await maniglia.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i += 1) await page.mouse.move(x + (dx * i) / 10, y + (dy * i) / 10);
  await page.mouse.up();
}

test("senza scelta il prato e' quello di sempre", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "il computer");
  await apri(page, testInfo);
  /* Le zone dove le mette il prato: dietro la prima e la seconda, davanti la terza. */
  expect(await posto(zona(page, "switch.irr_prato"))).toEqual({ x: "34.00%", y: "40.00%" });
  expect(await posto(zona(page, "valve.irr_orto"))).toEqual({ x: "50.00%", y: "76.00%" });
  await expect(page.locator("#page-irrigazione [data-dm-serie]")).toHaveCount(0);
  await expect(page.locator("#page-irrigazione [data-dm-lawn]")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  expect(await salvata(page)).toEqual({});
});

test("una zona si sposta, si salva, e resta sua anche riordinando le zone", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "il computer");
  await apri(page, testInfo);
  await entra(page);
  /* Una maniglia per zona, e il prato si fa trovare dalla tastiera. */
  await expect(
    page.locator("[data-dm-disegno-strato='irrigazione'] [data-dm-disegno-nodo]"),
  ).toHaveCount(3);
  await expect(page.locator("#page-irrigazione [data-dm-lawn]")).not.toHaveAttribute(
    "aria-hidden",
    /.*/,
  );

  const prima = await posto(zona(page, "valve.irr_orto"));
  await trascina(page, "zona:valve.irr_orto", 360, -40);
  const dopo = await posto(zona(page, "valve.irr_orto"));
  expect(parseFloat(dopo.x)).toBeGreaterThan(parseFloat(prima.x) + 10);

  await page.locator('[data-dm-disp-azione="salva"]').click();
  await expect(page.locator("html")).not.toHaveAttribute("data-dm-modifica", /.*/);
  const tutta = await salvata(page);
  expect(Object.keys(tutta)).toEqual(["irrigazione:computer"]);
  expect(Object.keys(tutta["irrigazione:computer"])).toEqual(["zona:valve.irr_orto"]);
  await expect(page.locator("#page-irrigazione [data-dm-lawn]")).toHaveAttribute(
    "aria-hidden",
    "true",
  );

  /* L'orto passa primo nell'elenco: il prato si rifa', e l'orto resta dove
   * l'ha messo l'utente; le altre zone tornano dove le mette il prato. */
  await mostraLeZone(page, [ZONE[2], ZONE[0], ZONE[1]]);
  const riordinato = await posto(zona(page, "valve.irr_orto"));
  expect(parseFloat(riordinato.x)).toBeCloseTo(
    tutta["irrigazione:computer"]["zona:valve.irr_orto"].x,
    1,
  );
  expect(parseFloat(riordinato.y)).toBeCloseTo(
    tutta["irrigazione:computer"]["zona:valve.irr_orto"].y,
    1,
  );
  await expect(page.locator("#page-irrigazione [data-dm-serie]")).toHaveCount(1);
});

test("Annulla rimette il prato com'era", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "il computer");
  await apri(page, testInfo);
  const prima = await posto(zona(page, "switch.irr_siepe"));
  await entra(page);
  await trascina(page, "zona:switch.irr_siepe", -200, 60);
  expect(await posto(zona(page, "switch.irr_siepe"))).not.toEqual(prima);
  await page.locator('[data-dm-disp-azione="annulla"]').click();
  expect(await posto(zona(page, "switch.irr_siepe"))).toEqual(prima);
  await expect(page.locator("#page-irrigazione [data-dm-serie]")).toHaveCount(0);
  expect(await salvata(page)).toEqual({});
});

test("sul telefono il prato ha il suo disegno", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "il telefono");
  await apri(page, testInfo);
  await entra(page);
  await trascina(page, "zona:switch.irr_prato", 60, 50);
  await page.locator('[data-dm-disp-azione="salva"]').click();
  expect(Object.keys(await salvata(page))).toEqual(["irrigazione:telefono"]);
});
