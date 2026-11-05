/* Il disegno in modifica sta sopra le barre (#379).
 *
 * Sul telefono, entrando con ✏️, due barre galleggiano sul fondo dello
 * schermo: quella della disposizione (Annulla, Ripristina, Salva) e la riga del
 * disegno (quale disegno si sta cambiando, «Ripristina il disegno»). Un
 * disegno che ci finiva sotto restava mezzo coperto — l'etichetta dello
 * scaldabagno e le due misure in basso si prendevano a fatica. Entrando, la
 * pagina scorre quanto basta perche' il disegno stia sopra le barre; se e'
 * piu' alto dello spazio, la sua cima va in cima, e il resto si raggiunge
 * scorrendo.
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
  visibility: { home: true, boiler: true },
};

const CONF = {
  cd_impianti_termici: { solare: false, scaldabagno: true, caldaia: true, stufa: true },
  cd_scaldabagni: [
    {
      name: "Scaldabagno",
      interruttore: "switch.sb",
      temperatura: "sensor.sb_t",
      potenza: "sensor.sb_w",
      energia: "sensor.sb_kwh",
    },
  ],
  cd_caldaia: [
    {
      id: "k",
      name: "Caldaia",
      stato: "sensor.k_stato",
      mandata: "sensor.k_mandata",
      ritorno: "sensor.k_ritorno",
    },
  ],
  cd_stufe: [{ name: "Stufa", clima: "climate.stufa", fumi: "sensor.s_fumi" }],
};

/* Dove sta il disegno rispetto alla prima barra dal basso. */
const misura = (page) =>
  page.evaluate(() => {
    const strato = [...document.querySelectorAll("[data-dm-disegno-strato]")].find(
      (s) => s.getBoundingClientRect().height > 0,
    );
    const r = strato.getBoundingClientRect();
    const tetto = Math.min(
      ...[...document.querySelectorAll("[data-dm-disp-barra],body > [data-dm-disegno-testa]")]
        .map((b) => b.getBoundingClientRect())
        .filter((b) => b.height > 0)
        .map((b) => b.top),
    );
    return { sopra: r.top, sotto: r.bottom, alto: r.height, tetto };
  });

for (const tipo of ["scaldabagno", "caldaia", "stufa"])
  test(`${tipo}: entrando in modifica il disegno sta sopra le barre`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "il telefono");
    test.setTimeout(120_000);
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
    await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
    await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
    await page.evaluate((conf) => {
      for (const [k, v] of Object.entries(conf)) localStorage.setItem(k, JSON.stringify(v));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    }, CONF);
    await page
      .locator('.tab[data-tab="boiler"]')
      .first()
      .evaluate((b) => b.click());
    await page
      .locator(".dm-it-tab", { hasText: new RegExp(tipo, "i") })
      .first()
      .click();
    const scena = page.locator(`.dm-it-scena[data-dm-it-scena="${tipo}"]`);
    await expect(scena).toBeVisible({ timeout: 20_000 });
    /* Il disegno parte basso, sotto dove arriveranno le barre. */
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => window.dmDisposizione.entraInModifica());
    await expect(page.locator(`[data-dm-disegno-strato="${tipo}"]`)).toBeAttached();
    await expect
      .poll(async () => {
        const m = await misura(page);
        return m.alto <= m.tetto - 24
          ? m.sotto <= m.tetto && m.sopra >= 0
          : m.sopra >= 0 && m.sopra < 40;
      })
      .toBe(true);
    /* Fuori dalla modifica la pagina non si muove da sola. */
    await page.locator('[data-dm-disp-azione="annulla"]').click();
    await expect(page.locator("html")).not.toHaveAttribute("data-dm-modifica", /./);
  });
