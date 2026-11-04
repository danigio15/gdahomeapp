/* Le tessere della Home si spostano trascinando (#379).
 *
 * «Sarebbe carino se le tessere si potessero spostare con drag & drop.» Nel
 * Config › Widget ogni riga ha la maniglia «⠿»: si prende col mouse o col dito
 * e si porta dove si vuole, le altre righe fanno posto, Esc annulla, e dalla
 * tastiera la maniglia si muove con le frecce. L'ordine si salva dove lo
 * salvavano le frecce ▲▼: in `cd_widgets.order`.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

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
  },
  visibility: { home: true },
};

async function apriLeTessere(page) {
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
    try {
      editorSwitch("todo");
    } catch (_errore) {}
  });
  await expect
    .poll(() => page.locator("#ed-body .dm-widget-pref [data-dm-maniglia]").count(), { timeout: 20_000 })
    .toBeGreaterThan(4);
}

const ordine = (page) =>
  page.evaluate(() => [...document.querySelectorAll("#ed-body .dm-widget-pref")].map((r) => r.dataset.widgetKey));

/* L'ordine salvato, letto dalla memoria della plancia e non dal disegno. */
const ordineSalvato = (page) =>
  page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("cd_widgets") || "{}").order || [];
    } catch (_errore) {
      return [];
    }
  });

async function prepara(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await apriLeTessere(page);
}

async function centroDi(page, selettore) {
  const box = await page.locator(selettore).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test("col mouse: la quarta tessera presa dalla maniglia va in cima, e l'ordine resta", async ({
  page,
}, testInfo) => {
  await prepara(page, testInfo);
  const prima = await ordine(page);
  const presa = prima[3];
  const da = await centroDi(page, `#ed-body .dm-widget-pref[data-widget-key="${presa}"] [data-dm-maniglia]`);
  const cima = await centroDi(page, `#ed-body .dm-widget-pref[data-widget-key="${prima[0]}"]`);

  await page.mouse.move(da.x, da.y);
  await page.mouse.down();
  await page.mouse.move(da.x, da.y - 10, { steps: 3 });
  await page.mouse.move(da.x, cima.y - 20, { steps: 12 });
  /* Durante il trascinamento la riga presa si vede presa, e le altre fanno posto. */
  await expect(page.locator(`#ed-body .dm-widget-pref[data-widget-key="${presa}"]`)).toHaveAttribute(
    "data-dm-presa",
    "true",
  );
  const spostate = await page.evaluate(
    () =>
      [...document.querySelectorAll('#ed-body .dm-widget-pref[data-dm-fa-posto="true"]')].filter((r) =>
        /translateY\(\d/.test(r.style.transform),
      ).length,
  );
  expect(spostate).toBe(3);
  await page.mouse.up();

  const atteso = [presa, ...prima.filter((k) => k !== presa)];
  await expect.poll(() => ordine(page)).toEqual(atteso);
  expect(await ordineSalvato(page)).toEqual(atteso);

  /* Riaperto il Config, l'ordine e' quello salvato. */
  await page.evaluate(() => editorSwitch("sez0"));
  await apriLeTessere(page);
  expect(await ordine(page)).toEqual(atteso);
});

test("col dito: la prima tessera trascinata giu' di due posti", async ({ page }, testInfo) => {
  await prepara(page, testInfo);
  const prima = await ordine(page);
  const presa = prima[0];
  const da = await centroDi(page, `#ed-body .dm-widget-pref[data-widget-key="${presa}"] [data-dm-maniglia]`);
  const terza = await centroDi(page, `#ed-body .dm-widget-pref[data-widget-key="${prima[2]}"]`);

  /* Il dito vero di Chromium: i Touch del protocollo diventano Pointer Events
   * di tipo «touch», come su un telefono. */
  const cdp = await page.context().newCDPSession(page);
  const tocca = (type, x, y) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x: Math.round(x), y: Math.round(y) }],
    });
  await tocca("touchStart", da.x, da.y);
  for (let passo = 1; passo <= 10; passo += 1)
    await tocca("touchMove", da.x, da.y + ((terza.y + 8 - da.y) * passo) / 10);
  await tocca("touchEnd", 0, 0);

  const atteso = [prima[1], prima[2], presa, ...prima.slice(3)];
  await expect.poll(() => ordine(page)).toEqual(atteso);
  expect(await ordineSalvato(page)).toEqual(atteso);
});

test("Esc durante il trascinamento rimette tutto com'era, e non salva", async ({ page }, testInfo) => {
  await prepara(page, testInfo);
  const prima = await ordine(page);
  const salvatoPrima = await ordineSalvato(page);
  const da = await centroDi(page, `#ed-body .dm-widget-pref[data-widget-key="${prima[4]}"] [data-dm-maniglia]`);
  await page.mouse.move(da.x, da.y);
  await page.mouse.down();
  await page.mouse.move(da.x, da.y - 120, { steps: 10 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await ordine(page)).toEqual(prima);
  expect(await ordineSalvato(page)).toEqual(salvatoPrima);
  const trasformate = await page.evaluate(
    () => [...document.querySelectorAll("#ed-body .dm-widget-pref")].filter((r) => r.style.transform).length,
  );
  expect(trasformate).toBe(0);
  /* E la configurazione resta aperta: Esc ha annullato il trascinamento, non
   * chiuso la finestra. */
  await expect(page.locator("#editor-modal")).toHaveClass(/show/);
});

test("dalla tastiera: la maniglia scende con la freccia giu' e resta col fuoco", async ({
  page,
}, testInfo) => {
  await prepara(page, testInfo);
  const prima = await ordine(page);
  await page.locator(`#ed-body .dm-widget-pref[data-widget-key="${prima[1]}"] [data-dm-maniglia]`).focus();
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => ordine(page)).toEqual([prima[0], prima[2], prima[1], ...prima.slice(3)]);
  await page.keyboard.press("ArrowDown");
  await expect
    .poll(() => ordine(page))
    .toEqual([prima[0], prima[2], prima[3], prima[1], ...prima.slice(4)]);
  const conIlFuoco = await page.evaluate(
    () => document.activeElement?.closest?.("[data-widget-key]")?.dataset?.widgetKey,
  );
  expect(conIlFuoco).toBe(prima[1]);
  /* Le frecce ▲▼ di prima ci sono ancora. */
  await expect(page.locator("#ed-body .dm-widget-pref [data-widget-up]").first()).toBeAttached();
});
