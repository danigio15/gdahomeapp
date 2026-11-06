/* L'anteprima modificabile del Config (#379).
 *
 * «In ogni sezione del config un'anteprima, e in quell'anteprima si spostano a
 * piacimento le cose; quando si salvano vanno nella plancia modificate.»
 *
 * Nella scheda Widget le tessere vere della Home si trascinano col mouse e col
 * dito (tenendo premuto), l'occhio le nasconde, niente si scrive finche' non si
 * preme Salva — e allora la Home cambia. Lo stesso riquadro c'e' per i blocchi
 * della Home e per l'ordine delle stanze.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [
      { id: "r", name: "Salone", icon: "mdi:sofa", temp: "sensor.t" },
      { id: "k", name: "Cucina", icon: "mdi:stove", temp: "sensor.t2" },
      { id: "b", name: "Bagno", icon: "mdi:shower" },
    ],
    cameras: [],
    appliances: [
      {
        id: "a1",
        name: "Lavatrice",
        type: "washer",
        icon: "mdi:washing-machine",
        energy: "sensor.e1",
        power: "sensor.p1",
      },
    ],
    loads: [],
    lights: [{ id: "l1", name: "Lampadario", entity: "light.salone", room_id: "r" }],
    climate: [],
    ev: [],
    covers: [{ id: "c", name: "Tapparella", entity: "cover.t1" }],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, temp: true, tapparelle: true, appliances: true, luci: true },
};

const STATI = [
  {
    entity_id: "cover.t1",
    state: "open",
    attributes: { current_position: 100, supported_features: 15 },
  },
  {
    entity_id: "sensor.t",
    state: "21.4",
    attributes: { unit_of_measurement: "°C", device_class: "temperature" },
  },
  {
    entity_id: "sensor.t2",
    state: "22.1",
    attributes: { unit_of_measurement: "°C", device_class: "temperature" },
  },
  { entity_id: "light.salone", state: "on", attributes: { brightness: 200 } },
  {
    entity_id: "sensor.e1",
    state: "5",
    attributes: {
      unit_of_measurement: "kWh",
      device_class: "energy",
      state_class: "total_increasing",
    },
  },
  {
    entity_id: "sensor.p1",
    state: "820",
    attributes: { unit_of_measurement: "W", device_class: "power" },
  },
];

async function prepara(page, testInfo, scheda) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((stati) => {
    const raw = eval("_RAW_STATES");
    for (const s of stati) raw[s.entity_id] = s;
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);
  await expect
    .poll(() => page.locator("#dm-widgets .dm-tile").count(), { timeout: 20_000 })
    .toBeGreaterThan(2);
  await page.evaluate((tab) => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    editorSwitch(tab);
  }, scheda);
}

const voci = (page, id) =>
  page.evaluate(
    (quale) =>
      [...document.querySelectorAll(`[data-dm-anteprima="${quale}"] .dm-ant-voce`)].map(
        (v) => v.dataset.dmRiordinaRiga,
      ),
    id,
  );
/* Le tessere vere dell'anteprima: quelle che la Home ha adesso (le altre sono
 * riquadri attenuati, «compare quando ha qualcosa da dire»). */
const vere = (page) =>
  page.evaluate(() =>
    [
      ...document.querySelectorAll(
        '[data-dm-anteprima="home"] .dm-ant-voce[data-segnaposto="false"]',
      ),
    ].map((v) => v.dataset.dmRiordinaRiga),
  );
const salvato = (page, chiave, campo) =>
  page.evaluate(
    ([k, c]) => {
      const valore = JSON.parse(localStorage.getItem(k) || "null");
      return c ? valore?.[c] || [] : valore;
    },
    [chiave, campo],
  );
const tessereInHome = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("#dm-widgets .dm-tile")].map((t) => t.dataset.dmWidget),
  );

async function trascinaColMouse(page, id, da, a) {
  /* Sul telefono l'anteprima dei blocchi sta sotto la piega: il mouse fuori
   * dallo schermo non prende niente. Si porta la voce in mezzo, prima. */
  await page
    .locator(`[data-dm-anteprima="${id}"] .dm-ant-voce`)
    .nth(da)
    .evaluate((el) => el.scrollIntoView({ block: "center" }));
  const sorgente = await page
    .locator(`[data-dm-anteprima="${id}"] .dm-ant-voce`)
    .nth(da)
    .boundingBox();
  const arrivo = await page
    .locator(`[data-dm-anteprima="${id}"] .dm-ant-voce`)
    .nth(a)
    .boundingBox();
  const x0 = sorgente.x + sorgente.width / 2;
  const y0 = sorgente.y + sorgente.height / 2;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x0 + 6, y0 + 6, { steps: 2 });
  await page.mouse.move(arrivo.x + arrivo.width / 2, arrivo.y + arrivo.height / 2, { steps: 14 });
  await page.waitForTimeout(250);
  await page.mouse.up();
}

test("Home: la tessera trascinata nell'anteprima resta in bozza, e con Applica la Home cambia", async ({
  page,
}, testInfo) => {
  await prepara(page, testInfo, "todo");
  const prima = await voci(page, "home");
  const reali = await vere(page);
  expect(reali.length).toBeGreaterThan(2);
  /* Tutte le tessere che si possono ordinare ci sono, anche quelle che adesso
   * non hanno niente da dire. */
  expect(prima.length).toBeGreaterThan(reali.length);
  const ordinePrima = await salvato(page, "cd_widgets", "order");
  const presa = reali[reali.length - 1];
  const daQui = prima.indexOf(presa);

  await trascinaColMouse(page, "home", daQui, 0);
  await expect.poll(async () => (await voci(page, "home"))[0]).toBe(presa);
  const anteprima = page.locator('[data-dm-anteprima="home"]');
  await expect(anteprima.locator(".dm-ant-stato")).toContainText(/1 modifica non salvata/i);
  /* In bozza: niente e' stato scritto, e la Home e' com'era. */
  expect(await salvato(page, "cd_widgets", "order")).toEqual(ordinePrima);
  expect((await tessereInHome(page))[0]).not.toBe(presa);

  await anteprima.locator('[data-dm-ant-azione="salva"]').click();
  await expect(anteprima.locator(".dm-ant-stato")).toBeEmpty();
  await expect.poll(async () => (await tessereInHome(page))[0]).toBe(presa);
  /* Nell'ordine salvato la tessera presa viene prima di tutte quelle che la
   * Home mostra; quelle che compaiono quando servono tengono il loro posto. */
  const salvatoDopo = await salvato(page, "cd_widgets", "order");
  expect(salvatoDopo.filter((chiave) => reali.includes(chiave))[0]).toBe(presa);
});

test("il salvataggio della scheda scrive anche la bozza dell'anteprima ancora aperta", async ({
  page,
}, testInfo) => {
  await prepara(page, testInfo, "todo");
  const prima = await voci(page, "home");
  const reali = await vere(page);
  const presa = reali[reali.length - 1];
  await trascinaColMouse(page, "home", prima.indexOf(presa), 0);
  await expect.poll(async () => (await voci(page, "home"))[0]).toBe(presa);
  /* Nel Config si salva in un posto solo: in fondo alla scheda. */
  await page.locator("#ed-body [data-dm-save-all]").click();
  await expect.poll(async () => (await tessereInHome(page))[0]).toBe(presa);
  const salvatoDopo = await salvato(page, "cd_widgets", "order");
  expect(salvatoDopo.filter((chiave) => reali.includes(chiave))[0]).toBe(presa);
  await expect(page.locator('[data-dm-anteprima="home"] .dm-ant-stato')).toBeEmpty();
});

test("Home: col dito si tiene premuto e si trascina; un dito che scorre subito non sposta niente", async ({
  page,
}, testInfo) => {
  await prepara(page, testInfo, "todo");
  const prima = await voci(page, "home");
  const sorgente = await page
    .locator('[data-dm-anteprima="home"] .dm-ant-voce')
    .nth(0)
    .boundingBox();
  const arrivo = await page.locator('[data-dm-anteprima="home"] .dm-ant-voce').nth(2).boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const tocca = (type, x, y) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x: Math.round(x), y: Math.round(y) }],
    });
  const x0 = sorgente.x + sorgente.width / 2;
  const y0 = sorgente.y + sorgente.height / 2;
  const x1 = arrivo.x + arrivo.width / 2;
  const y1 = arrivo.y + arrivo.height / 2;

  /* Uno scorrimento: il dito parte e si muove subito. */
  await tocca("touchStart", x0, y0);
  for (let p = 1; p <= 6; p += 1)
    await tocca("touchMove", x0 + ((x1 - x0) * p) / 6, y0 + ((y1 - y0) * p) / 6);
  await tocca("touchEnd", 0, 0);
  await page.waitForTimeout(200);
  expect(await voci(page, "home")).toEqual(prima);

  /* Tenendo premuto un attimo, invece, si prende. */
  await tocca("touchStart", x0, y0);
  await page.waitForTimeout(450);
  for (let p = 1; p <= 10; p += 1)
    await tocca("touchMove", x0 + ((x1 - x0) * p) / 10, y0 + ((y1 - y0) * p) / 10);
  await page.waitForTimeout(250);
  await tocca("touchEnd", 0, 0);
  await expect.poll(async () => (await voci(page, "home")).indexOf(prima[0])).toBe(2);
  await expect(page.locator('[data-dm-anteprima="home"] .dm-ant-stato')).toContainText(
    /non salvat/i,
  );
});

test("Home: l'occhio nasconde in bozza, Annulla torna indietro, Ripristina propone l'ordine di partenza", async ({
  page,
}, testInfo) => {
  await prepara(page, testInfo, "todo");
  const anteprima = page.locator('[data-dm-anteprima="home"]');
  const scelta = (await vere(page))[1];
  await anteprima.locator(`[data-dm-ant-occhio="${scelta}"]`).click();
  await expect(anteprima.locator(`[data-dm-riordina-riga="${scelta}"]`)).toHaveAttribute(
    "data-spenta",
    "true",
  );
  expect(await salvato(page, "cd_widgets", "hidden")).not.toContain(scelta);
  await anteprima.locator('[data-dm-ant-azione="annulla"]').click();
  await expect(anteprima.locator(`[data-dm-riordina-riga="${scelta}"]`)).toHaveAttribute(
    "data-spenta",
    "false",
  );
  await expect(anteprima.locator(".dm-ant-stato")).toBeEmpty();

  /* Nascosta e salvata: in Home sparisce. */
  await anteprima.locator(`[data-dm-ant-occhio="${scelta}"]`).click();
  await anteprima.locator('[data-dm-ant-azione="salva"]').click();
  await expect.poll(() => tessereInHome(page)).not.toContain(scelta);
  /* Ripristina la riaccende, in bozza. */
  await anteprima.locator('[data-dm-ant-azione="ripristina"]').click();
  await expect(anteprima.locator(`[data-dm-riordina-riga="${scelta}"]`)).toHaveAttribute(
    "data-spenta",
    "false",
  );
  await expect(anteprima.locator(".dm-ant-stato")).toContainText(/non salvat/i);
});

test("Home: «Telefono / Tablet / Computer» cambia la larghezza dell'anteprima, non la scelta", async ({
  page,
}, testInfo) => {
  await prepara(page, testInfo, "todo");
  const anteprima = page.locator('[data-dm-anteprima="home"]');
  await anteprima.locator('[data-dm-ant-dispositivo="telefono"]').click();
  await expect(anteprima.locator(".dm-ant-fondo")).toHaveAttribute("data-dispositivo", "telefono");
  const largo = await anteprima
    .locator(".dm-ant-griglia")
    .evaluate((g) => g.getBoundingClientRect().width);
  expect(largo).toBeLessThanOrEqual(391);
  await expect(anteprima.locator(".dm-ant-stato")).toBeEmpty();
});

test("Home: dalla tastiera la tessera con il fuoco si sposta con le frecce", async ({
  page,
}, testInfo) => {
  await prepara(page, testInfo, "todo");
  const prima = await voci(page, "home");
  await page.locator(`[data-dm-anteprima="home"] [data-dm-riordina-riga="${prima[0]}"]`).focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => voci(page, "home")).toEqual([prima[1], prima[0], ...prima.slice(2)]);
  const conIlFuoco = await page.evaluate(() => document.activeElement?.dataset?.dmRiordinaRiga);
  expect(conIlFuoco).toBe(prima[0]);
});

test("i blocchi della Home: si trascinano nell'anteprima e con Salva cambia l'ordine salvato", async ({
  page,
}, testInfo) => {
  await prepara(page, testInfo, "sez0");
  await expect.poll(() => voci(page, "home-blocchi").then((v) => v.length)).toBeGreaterThan(2);
  const prima = await voci(page, "home-blocchi");
  const da = prima.indexOf("widget");
  const a = prima.indexOf("persone");
  await trascinaColMouse(page, "home-blocchi", da, a);
  await expect.poll(async () => (await voci(page, "home-blocchi")).indexOf("widget")).toBe(a);
  await page.locator('[data-dm-anteprima="home-blocchi"] [data-dm-ant-azione="salva"]').click();
  await expect
    .poll(async () => {
      const fila = (await salvato(page, "cd_home_blocchi")) || [];
      return fila.indexOf("widget") < fila.indexOf("persone");
    })
    .toBe(true);
});

test("le stanze: si trascinano nell'anteprima e con Salva cambia il loro ordine", async ({
  page,
}, testInfo) => {
  await prepara(page, testInfo, "stanze");
  await expect.poll(() => voci(page, "stanze")).toEqual(["r", "k", "b"]);
  await trascinaColMouse(page, "stanze", 2, 0);
  await expect.poll(() => voci(page, "stanze")).toEqual(["b", "r", "k"]);
  await page.locator('[data-dm-anteprima="stanze"] [data-dm-ant-azione="salva"]').click();
  await expect
    .poll(async () => ((await salvato(page, "cd_stanze")) || []).map((stanza) => stanza.id))
    .toEqual(["b", "r", "k"]);
});
