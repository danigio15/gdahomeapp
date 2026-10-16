/* «Correggi sti colori che non si leggono i nomi».
 *
 * Nella finestra del widget Luci la scheda di una luce accesa ha il fondo
 * crema, in tutti e due i temi. Il nome pero' prendeva il colore del testo del
 * tema: col tema scuro quasi bianco, «Lampadario Cucina» bianco su giallo
 * chiaro. La riga sotto, marrone, si leggeva; il nome no.
 *
 * Qui si misura il contrasto vero fra il colore del nome e il fondo della
 * scheda — ogni colore del suo sfumato, quelli trasparenti stesi sopra quelli
 * pieni — e deve stare almeno a 4,5, la soglia del testo normale. Col tema
 * scuro e con quello chiaro, sul telefono. La scheda spenta resta com'era.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "room-cucina", name: "Cucina", icon: "🍳", metadata: {} }],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [
      { entity: "light.lampadario", name: "Lampadario Cucina", room_id: "room-cucina" },
      { entity: "light.faretti", name: "Faretti Centrali Salone" },
      { entity: "light.cameretta", name: "Cameretta" },
    ],
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

test.use({ viewport: { width: 412, height: 915 }, hasTouch: true });

async function apriLeLuci(page, testInfo, tema) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate((scelto) => {
    document.documentElement.setAttribute("data-theme", scelto);
    const stati = eval("_RAW_STATES");
    for (const id of ["light.lampadario", "light.faretti", "light.cameretta"])
      stati[id] = {
        entity_id: id,
        state: id === "light.cameretta" ? "off" : "on",
        attributes: { friendly_name: id },
      };
    window.applyStates?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, tema);
  await page.waitForTimeout(1200);
  await page.locator('#dm-widgets .dm-tile[data-dm-widget="luci"]').click();
  await expect(page.locator("#dm-widget-popup")).toBeVisible();
  await expect(page.locator('#dm-widget-popup .dm-w-luce[data-on="true"]').first()).toBeVisible();
}

/* Il contrasto peggiore fra il nome e i colori del fondo della scheda. */
function contrastoPeggiore(page, entita) {
  return page.evaluate((id) => {
    const scheda = document.querySelector(`#dm-widget-popup .dm-w-luce[data-dm-w-light="${id}"]`);
    const nome = scheda.querySelector(".dm-w-luce-nome");
    const leggi = (testo) =>
      [...testo.matchAll(/rgba?\(([^)]+)\)/g)].map((m) => {
        const [r, g, b, a = 1] = m[1]
          .split(/[\s,/]+/)
          .filter(Boolean)
          .map(Number);
        return { r, g, b, a };
      });
    const stile = getComputedStyle(scheda);
    const colori = [...leggi(stile.backgroundImage), ...leggi(stile.backgroundColor)].filter(
      (c) => c.a > 0,
    );
    const pieni = colori.filter((c) => c.a >= 1);
    /* I colori trasparenti dello sfumato si leggono stesi su quelli pieni. */
    const fondi = [...pieni];
    for (const c of colori.filter((x) => x.a < 1))
      for (const sotto of pieni)
        fondi.push({
          r: c.r * c.a + sotto.r * (1 - c.a),
          g: c.g * c.a + sotto.g * (1 - c.a),
          b: c.b * c.a + sotto.b * (1 - c.a),
        });
    const luce = ({ r, g, b }) => {
      const lin = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const testo = leggi(getComputedStyle(nome).color)[0];
    const rapporti = fondi.map((f) => {
      const [chiaro, scuro] = [luce(testo), luce(f)].sort((x, y) => y - x);
      return (chiaro + 0.05) / (scuro + 0.05);
    });
    return {
      fondi: fondi.length,
      peggiore: Math.min(...rapporti),
      colore: getComputedStyle(nome).color,
    };
  }, entita);
}

for (const tema of ["dark", "light"]) {
  test(`col tema ${tema === "dark" ? "scuro" : "chiaro"} il nome della luce accesa si legge`, async ({
    page,
  }, testInfo) => {
    await apriLeLuci(page, testInfo, tema);
    for (const id of ["light.lampadario", "light.faretti"]) {
      const misura = await contrastoPeggiore(page, id);
      expect(misura.fondi, "il fondo della scheda accesa e' uno sfumato").toBeGreaterThan(0);
      expect(
        misura.peggiore,
        `${id}: ${misura.colore} sul crema ha contrasto ${misura.peggiore.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
}

test("col tema scuro la luce spenta resta col testo del tema", async ({ page }, testInfo) => {
  /* Il fondo della spenta e' quello scuro della finestra: il nome chiaro ci
   * sta bene, e non va toccato. */
  await apriLeLuci(page, testInfo, "dark");
  const colori = await page.evaluate(() => ({
    spenta: getComputedStyle(
      document.querySelector(
        '#dm-widget-popup .dm-w-luce[data-dm-w-light="light.cameretta"] .dm-w-luce-nome',
      ),
    ).color,
    tema: getComputedStyle(document.querySelector('#dm-widget-popup .dm-w-luce[data-on="false"]'))
      .color,
  }));
  expect(colori.spenta).toBe(colori.tema);
});
