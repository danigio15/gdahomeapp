/* «Il nome del comando associato al tasto esce fuori dal perimetro del tasto
 * stesso: fare come già fatto per il widget, togliere il nome del comando»
 * (#346).
 *
 * Sotto il nome di un tasto d'inserimento su misura c'era l'entita' che lo fa
 * partire («script.inserisci_zone_perimetrali»): lunga, e usciva dal tasto. Il
 * widget della Home la toglieva gia'; ora la Sicurezza fa lo stesso.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const CENTRALE = "alarm_control_panel.casa";

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
    entityOverrides: { "dm.security_centrale_allarme": CENTRALE },
  },
  visibility: { home: true, security: true },
};

test("i tasti su misura nella Sicurezza: il nome, senza l'entità sotto", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((id) => {
    window.localStorage.setItem(
      "cd_antifurto_su_misura",
      JSON.stringify([
        { id: "perimetro", nome: "Perimetro", entita: "script.inserisci_zone_perimetrali" },
        { id: "totale", nome: "Totale", entita: "script.inserisci_tutte_le_zone_di_casa" },
      ]),
    );
    const stati = {
      [id]: {
        entity_id: id,
        state: "disarmed",
        attributes: { friendly_name: "Casa", supported_features: 63 },
      },
      "script.inserisci_zone_perimetrali": {
        entity_id: "script.inserisci_zone_perimetrali",
        state: "off",
        attributes: { friendly_name: "Inserisci perimetro" },
      },
      "script.inserisci_tutte_le_zone_di_casa": {
        entity_id: "script.inserisci_tutte_le_zone_di_casa",
        state: "off",
        attributes: { friendly_name: "Inserisci totale" },
      },
    };
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, CENTRALE);
  await page.evaluate(() => document.querySelector('.tab[data-tab="security"]')?.click());
  await page.evaluate(() => window.renderSecurity?.());

  const tasto = page.locator('.dm-sec-mode[data-mode="perimetro"]');
  await expect(tasto).toHaveCount(1, { timeout: 20_000 });
  await expect(tasto).toContainText("Perimetro");
  await expect(page.locator(".dm-sec-mode", { hasText: "script." })).toHaveCount(0);
  /* «I nomi si devono leggere»: ogni nome intero, dentro il suo tasto. */
  const tagliati = await page.evaluate(() =>
    [...document.querySelectorAll(".dm-sec-mode")]
      .filter((tasto) => tasto.getClientRects().length)
      .filter((tasto) => {
        const nome = tasto.querySelector(".dm-sec-mode-tx");
        const t = tasto.getBoundingClientRect();
        const n = nome.getBoundingClientRect();
        return (
          nome.scrollWidth > nome.clientWidth + 1 || n.left < t.left - 1 || n.right > t.right + 1
        );
      })
      .map((tasto) => tasto.textContent.trim()),
  );
  expect(tagliati).toEqual([]);

  await page.waitForTimeout(500);
  await page.evaluate(() =>
    document.querySelector("#alarm-stage")?.scrollIntoView({ block: "start" }),
  );
  await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath("tasti-su-misura.png") });
});
