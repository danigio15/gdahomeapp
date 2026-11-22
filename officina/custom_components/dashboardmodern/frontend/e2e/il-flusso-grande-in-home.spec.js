/* Il flusso dell'energia, grande, in Home (#460).
 *
 * «Vorrei una card da esporre in primo piano del fotovoltaico e non il
 * semplice widget, si può fare?» Si accende dalla scheda Home del Config, e
 * compare in primo piano col sole, la rete, la batteria e la casa: i numeri
 * sono quelli della tessera Energia, le frecce corrono nel verso giusto, e un
 * tocco apre l'Energia. Una casa senza batteria non vede una batteria.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seme = (batteria = true) => ({
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
    energy: {
      solar: { power: "sensor.fv_w" },
      grid: { power: "sensor.rete_w" },
      ...(batteria ? { battery: { power: "sensor.batt_w", soc: "sensor.batt_soc" } } : {}),
      house: { power: "sensor.casa_w" },
      metadata: { semantics_version: 3 },
    },
    entityOverrides: {},
  },
  visibility: { home: true, energy: true },
});

async function numeri(page, valori) {
  await page.evaluate((valori) => {
    const scrivi = (id, valore, unita = "W") => {
      _RAW_STATES[id] = {
        entity_id: id,
        state: String(valore),
        attributes: { unit_of_measurement: unita },
      };
      STATES[id] = _RAW_STATES[id];
    };
    scrivi("sensor.fv_w", valori.fv);
    scrivi("sensor.rete_w", valori.rete);
    scrivi("sensor.batt_w", valori.batt);
    scrivi("sensor.batt_soc", valori.soc, "%");
    scrivi("sensor.casa_w", valori.casa);
    window.render?.();
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed", { detail: {} }));
  }, valori);
}

async function avvia(page, testInfo, batteria = true) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 150_000 : 90_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme(batteria));
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
}

/* Le frecce che corrono, come «da>a». */
const frecce = (page) =>
  page
    .locator("#dm-flusso-home .dm-fh-puntini[data-si='true']")
    .evaluateAll((nodi) => nodi.map((n) => n.dataset.capi).sort());

test("si accende dal Config, va in primo piano e dice dove va l'energia", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  /* FV 3,2 kW, casa 1,1 kW, batteria al 64% in carica, rete in immissione. */
  await numeri(page, { fv: 3200, casa: 1100, batt: -1500, soc: 64, rete: -600 });
  /* Spento di serie: la Home e' quella di sempre. */
  await expect(page.locator("#dm-flusso-home")).toHaveCount(0);

  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await page.locator('.ed-tab[data-tab="sez0"]').first().click();
  const casella = page.locator("#ed-body [data-dm-flusso-home-acceso]");
  await expect(casella).toHaveCount(1, { timeout: 15_000 });
  await page.locator("#ed-body .dm-blocco-flusso .dm-blocco-switch").click();
  await expect(casella).toBeChecked();
  await page.locator("#editor-modal .ed-head-close").first().click();
  await expect(page.locator("#editor-modal.show")).toHaveCount(0);

  const blocco = page.locator("#dm-flusso-home");
  await expect(blocco).toBeVisible({ timeout: 15_000 });
  await expect(blocco.locator(".dm-fh-nodo")).toHaveCount(4);
  await expect(blocco.locator('.dm-fh-nodo[data-k="batteria"] [data-fh-valore]')).toHaveText("64%");
  await expect(blocco.locator('.dm-fh-nodo[data-k="batteria"] [data-fh-verso]')).toContainText(
    "in carica",
  );
  await expect(blocco.locator('.dm-fh-nodo[data-k="rete"] [data-fh-verso]')).toHaveText(
    "immissione",
  );
  await expect.poll(() => frecce(page)).toEqual(["solare>batteria", "solare>casa", "solare>rete"]);
  /* Prima delle tessere: «in primo piano». */
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          [...document.getElementById("page-home").children].find((n) =>
            ["dm-flusso-home", "dm-people", "dm-widgets", "dev-title"].includes(n.id),
          )?.id,
      ),
    )
    .toBe("dm-flusso-home");
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("cd_home_flusso") || "null")),
  ).toBe("si");

  /* Di notte la rete alimenta la casa e carica la batteria: le frecce girano. */
  await numeri(page, { fv: 0, casa: 600, batt: -1800, soc: 20, rete: 2400 });
  await expect.poll(() => frecce(page)).toEqual(["rete>batteria", "rete>casa"]);

  /* Un tocco apre l'Energia. */
  await blocco.locator("[data-dm-flusso-home]").click();
  await expect(page.locator("#page-energy")).toHaveClass(/active/);
});

test("senza batteria la batteria non c'e'", async ({ page }, testInfo) => {
  await avvia(page, testInfo, false);
  await page.evaluate(() => localStorage.setItem("cd_home_flusso", JSON.stringify("si")));
  await numeri(page, { fv: 1500, casa: 1700, batt: 0, soc: 0, rete: 200 });
  const blocco = page.locator("#dm-flusso-home");
  await expect(blocco).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(() => blocco.locator(".dm-fh-nodo").evaluateAll((nodi) => nodi.map((n) => n.dataset.k)))
    .toEqual(["solare", "rete", "casa"]);
});
