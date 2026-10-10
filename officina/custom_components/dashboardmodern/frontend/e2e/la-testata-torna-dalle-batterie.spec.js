/* «Dalla sezione Batterie premo Home in alto: tornato alla Home l'intestazione
 * e' sparita.» Su iPhone, e solo li'.
 *
 * La fascia della plancia si spegneva con una regola `:has(.page.active…)`, e
 * WebKit non sempre la ricalcola quando la classe passa da una pagina
 * all'altra: la risposta vecchia restava sulla Home. Adesso la regola guarda
 * un segno sul corpo (`data-dm-pagina`) che si riscrive a ogni cambio di
 * pagina. Qui si percorre la strada della segnalazione e si guarda il segno;
 * WebKit vero sta nel progetto `webkit-ipad`. */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [{ entity: "light.salotto", name: "Salotto" }],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, batterie: true },
};

const batteria = (livello, nome) => ({
  state: String(livello),
  attributes: { device_class: "battery", unit_of_measurement: "%", friendly_name: nome },
});

async function avvia(page, testInfo) {
  test.setTimeout(120_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  /* Tre batterie di casa: una scarica, una a metà strada, una piena. Le
   * entità sorvegliate si scrivono dopo l'avvio, come tutte le chiavi del
   * guscio: prima di allora la memoria non ha ancora il prefisso dell'istanza. */
  await page.evaluate(
    ({ stati }) => {
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
      const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
      if (raw) Object.assign(raw, stati);
      /* Le batterie sorvegliate sono un gruppo di avvisi: si dichiarano lì. */
      localStorage.setItem("cd_gruppi_extra", JSON.stringify({ batt: Object.keys(stati) }));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    {
      stati: {
        "sensor.serratura_batteria": batteria(12, "Serratura"),
        "sensor.sonda_batteria": batteria(31, "Sonda"),
        "sensor.telecomando_batteria": batteria(88, "Telecomando"),
      },
    },
  );
}

/* Il Config è una finestra sopra la plancia: finché è aperta copre la barra in
 * basso, e la voce della pagina non si può premere. */

const fascia = (page) => page.locator("body>header:not(.dm-page-mast)");
const segno = (page) => page.evaluate(() => document.body.dataset.dmPagina || "");

test("dalle Batterie, col tasto Home in alto, la fascia torna", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await expect(fascia(page)).toBeVisible();
  await expect.poll(() => segno(page)).toBe("page-home");

  await page.locator('.tab[data-tab="batterie"]').click();
  await expect(page.locator("#page-batterie .dm-batt").first()).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => segno(page)).toBe("page-batterie");
  await expect(fascia(page)).toBeHidden();

  await page.locator("#page-batterie [data-dm-mast-back]").first().click();
  await expect.poll(() => segno(page)).toBe("page-home");
  await expect(fascia(page)).toBeVisible();
  await expect(fascia(page).locator(".header-left-wrap")).toBeVisible();
});

test("la regola della fascia non chiede piu' niente a :has", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  const conHas = await page.evaluate(
    () =>
      [...document.querySelectorAll("style")]
        .map((nodo) => nodo.textContent || "")
        .filter((testo) => /:has\(\.page\.active/.test(testo)).length,
  );
  expect(conHas).toBe(0);
});
