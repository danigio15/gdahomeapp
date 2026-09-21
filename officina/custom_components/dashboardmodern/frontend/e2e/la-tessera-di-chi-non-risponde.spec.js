/* La tessera che compare quando qualcosa non risponde, sulla Home vera (#33).
 *
 * «Ho dei comandi domotici in giardino che ogni tanto, causa segnale wifi non
 * sufficiente, vanno in offline: avere l'avviso mi allerta di ripristinarli
 * per evitare che la pompa ad esempio resti ferma troppo a lungo.»
 *
 * Il modello si prova senza browser; qui si pretende la cosa che la
 * segnalazione chiede davvero e che un modello non può dimostrare: che la
 * tessera NON ci sia finché va tutto bene, che compaia da sola quando qualcosa
 * tace, e che se ne vada quando torna.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const PRESE = [
  { id: "p1", name: "Pompa piscina", entity: "switch.pompa", room: "Giardino" },
  { id: "p2", name: "Luci vialetto", entity: "switch.vialetto", room: "Giardino" },
];
const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "r1", name: "Giardino", icon: "🌳", metadata: {} }],
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
    prese: PRESE,
  },
  visibility: { home: true, prese: true },
};

const tuttoBene = {
  "switch.pompa": { state: "on", attributes: { friendly_name: "Pompa piscina" } },
  "switch.vialetto": { state: "off", attributes: { friendly_name: "Luci vialetto" } },
};

async function avvia(page, testInfo) {
  test.setTimeout(120_000);
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    ({ s, prese }) => {
      Object.assign(eval("_RAW_STATES"), s);
      localStorage.setItem("cd_prese", JSON.stringify(prese));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { s: tuttoBene, prese: PRESE },
  );
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.waitForTimeout(700);
}

const scrivi = (page, stati) =>
  page.evaluate((s) => {
    Object.assign(eval("_RAW_STATES"), s);
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  }, stati);

const tessera = (page) => page.locator('#dm-widgets [data-dm-widget="nonrisponde"]');

test("finché risponde tutto la tessera non c'è, e compare quando qualcosa tace", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  /* Non una tessera verde che dice «tutto a posto»: quella diventa invisibile
   * in una settimana, e il giorno che serve nessuno la guarda. */
  await expect(tessera(page)).toHaveCount(0);

  /* La presa del giardino perde il wifi. */
  await scrivi(page, {
    "switch.pompa": { state: "unavailable", attributes: { friendly_name: "Pompa piscina" } },
  });
  await expect(tessera(page)).toHaveCount(1);
  await expect(tessera(page)).toContainText("Pompa piscina");

  /* E quando torna, la tessera se ne va da sola. */
  await scrivi(page, {
    "switch.pompa": { state: "on", attributes: { friendly_name: "Pompa piscina" } },
  });
  await expect(tessera(page)).toHaveCount(0);
});

test("dice quante e quali, e la finestra le elenca", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await scrivi(page, {
    "switch.pompa": { state: "unavailable", attributes: { friendly_name: "Pompa piscina" } },
    "switch.vialetto": { state: "unavailable", attributes: { friendly_name: "Luci vialetto" } },
  });
  await expect(tessera(page)).toContainText("2");

  await tessera(page).evaluate((n) => n.click());
  const finestra = page.locator("#dm-widget-popup");
  await expect(finestra).toBeVisible();
  await expect(finestra).toHaveAttribute("data-dm-popup-of", "nonrisponde");
  for (const nome of ["Pompa piscina", "Luci vialetto"]) await expect(finestra).toContainText(nome);
});

test("un'entità che non ha ancora un valore non è un guasto", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  /* `unknown` è normalissima nei primi secondi dopo un riavvio di Home
   * Assistant: contarla vorrebbe dire una tessera rossa a ogni riavvio, cioè
   * un avviso che si impara a ignorare. */
  await scrivi(page, {
    "switch.pompa": { state: "unknown", attributes: { friendly_name: "Pompa piscina" } },
  });
  await expect(tessera(page)).toHaveCount(0);
});
