/* Nell'app gdahome su iPhone la testata non finisce sotto l'orologio.
 *
 * Dal campo, con la foto: sulla pagina Luci il menu, il nome della pagina e
 * l'ora stavano sotto l'orologio e la batteria del telefono. L'app la fascia
 * la sa da Flutter e la scrive in `--gdahome-alto`, col corpo della pagina che
 * la scansa; ma su un iPhone si accende anche la regola del chiosco, che e'
 * piu' pesante e prendeva solo `env(safe-area-inset-top)` e la misura dal
 * documento in cima — zero tutt'e due dentro l'app. Vinceva lo zero.
 *
 * Qui il chiosco si accende a mano e la fascia dell'app si scrive come la
 * scrive l'app: in fondo al corpo, con il suo foglio.
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
  visibility: { home: true, energy: true },
};

const FASCIA = 59;

test("la testata comincia sotto la fascia che dice l'app, anche col chiosco di iPhone", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate((alto) => {
    document.documentElement.setAttribute("data-dm-ios-kiosk", "true");
    const foglio = document.createElement("style");
    foglio.id = "gdahome-misure";
    foglio.textContent = `:root{--gdahome-alto:${alto}px;--gdahome-basso:0px}html body{padding-top:var(--gdahome-alto)!important}`;
    document.body.appendChild(foglio);
  }, FASCIA);

  for (const pagina of ["home", "luci"]) {
    await page.evaluate(
      (quale) => document.querySelector(`[data-tab="${quale}"]`)?.click(),
      pagina,
    );
    await expect
      .poll(() =>
        page.evaluate(() => {
          const testata =
            document.querySelector(".page.active header") ||
            document.querySelector("body > header");
          return testata ? Math.round(testata.getBoundingClientRect().top) : null;
        }),
      )
      .toBeGreaterThanOrEqual(FASCIA);
  }
});
