/* «Prevedi un'entità per inserire allarme antifurto, ho uno switch che mi
 * controlla se è scattato antifurto.»
 *
 * Nel blocco dei tasti su misura c'e' il riquadro «Quando è scattato»: si
 * sceglie l'interruttore, si salva, e da li' la tessera della Home e la
 * Sicurezza diventano rosse quando si accende — con la zona, la sirena e i
 * tasti per spegnere. Si prova sulla scheda vera, col salvataggio vero.
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
    entityOverrides: {},
  },
  visibility: { home: true, security: true },
};

const adesso = () => new Date().toISOString();

async function metti(page, stati) {
  await page.evaluate((stati) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, stati);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, stati);
}

const statiDiCasa = (scattato) => ({
  "switch.antifurto_scattato": {
    entity_id: "switch.antifurto_scattato",
    state: scattato ? "on" : "off",
    last_changed: adesso(),
    attributes: { friendly_name: "Antifurto scattato" },
  },
  "switch.sirena": {
    entity_id: "switch.sirena",
    state: scattato ? "on" : "off",
    last_changed: adesso(),
    attributes: { friendly_name: "Sirena" },
  },
  "binary_sensor.finestra_cucina": {
    entity_id: "binary_sensor.finestra_cucina",
    state: scattato ? "on" : "off",
    last_changed: adesso(),
    attributes: { friendly_name: "Finestra cucina", device_class: "window" },
  },
  "script.inserisci_totale": {
    entity_id: "script.inserisci_totale",
    state: "off",
    attributes: { friendly_name: "Inserisci totale" },
  },
  "script.disinserisci": {
    entity_id: "script.disinserisci",
    state: "off",
    attributes: { friendly_name: "Disinserisci" },
  },
});

async function avvia(page, testInfo, { conTasti = true } = {}) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  if (conTasti)
    await page.evaluate(() => {
      window.localStorage.setItem(
        "cd_antifurto_su_misura",
        JSON.stringify([
          { id: "totale", nome: "Totale", entita: "script.inserisci_totale" },
          { id: "spento", nome: "Disinserito", entita: "script.disinserisci" },
        ]),
      );
    });
  await metti(page, statiDiCasa(false));
}

test("il riquadro «Quando è scattato» salva l'interruttore, e anche la casella storica", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await avvia(page, testInfo);
  await page.evaluate(() => window.apriConfigEntita());
  await page.locator('.ed-tab[data-tab="sez4"]').first().click();

  const riquadro = page.locator("#dm-antifurto-scattato");
  await expect(riquadro).toHaveCount(1, { timeout: 20_000 });
  /* I campi entita' sono pastiglie: l'id da scrivere a mano sta dietro la
   * matita, come in tutte le schede. */
  const scrivi = async (campo, valore) => {
    const casella = riquadro.locator(`[data-scat-field="${campo}"]`);
    if (!(await casella.isVisible()))
      await casella.locator("xpath=ancestor::label[1]").locator(".dm-chip-manual").first().click();
    await casella.fill(valore);
  };
  await scrivi("entita", "switch.antifurto_scattato");
  await scrivi("sirena", "switch.sirena");
  /* Si salva dal tasto in fondo alla scheda, come fa chi usa la plancia. */
  await page.locator("#ed-body [data-dm-save-all]").click();

  const salvato = await page.evaluate(() => ({
    scattato: JSON.parse(window.localStorage.getItem("cd_antifurto_scattato") || "{}"),
    casella: JSON.parse(window.localStorage.getItem("cd_entity_overrides") || "{}")[
      "dm.home_interruttore_antifurto"
    ],
  }));
  expect(salvato.scattato).toMatchObject({
    entita: "switch.antifurto_scattato",
    sirena: "switch.sirena",
  });
  expect(salvato.casella).toBe("switch.antifurto_scattato");
  /* La riga dal vivo dice com'e' adesso. */
  await expect(page.locator("#dm-antifurto-scattato .dm-scat-adesso")).toContainText(
    /a riposo|at rest/,
  );
});

test("scattato: la Sicurezza dice zona e sirena, coi tasti per spegnere", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await avvia(page, testInfo);
  await page.evaluate(() => {
    window.localStorage.setItem(
      "cd_antifurto_scattato",
      JSON.stringify({ entita: "switch.antifurto_scattato", sirena: "switch.sirena" }),
    );
  });
  await metti(page, statiDiCasa(true));
  await page.evaluate(() => document.querySelector('.tab[data-tab="security"]')?.click());
  await page.evaluate(() => window.renderSecurity?.());
  const fascia = page.locator("[data-dm-sec-scattato]");
  await expect(fascia).toHaveCount(1, { timeout: 20_000 });
  await expect(fascia).toContainText("Finestra cucina");
  await expect(fascia).toContainText(/Sirena accesa|Siren on/);
  await expect(fascia.locator("[data-dm-spegni-sirena]")).toHaveCount(1);
  await expect(fascia.locator(".dm-sec-scat-btn")).toHaveCount(2);

  /* Spento lo scattato, la fascia se ne va. */
  await metti(page, statiDiCasa(false));
  await page.evaluate(() => window.renderSecurity?.());
  await expect(page.locator("[data-dm-sec-scattato]")).toHaveCount(0, { timeout: 10_000 });
});
