/* Le tre funzioni della serratura, dal popup della Home (#34).
 *
 * «Per chi ha serrature smart vorrei si potesse già dal popup del widget in
 * prima pagina scegliere tra le 3 funzioni disponibili della serratura:
 * sblocco senza apertura, sblocco completo (con apertura), blocco.»
 *
 * Le prime due il modello le sapeva già — sono `lock.unlock` e `lock.open`, e
 * la pagina Aperture le disegna tutte e due — ma il popup ne mostrava una
 * sola, quindi le altre si facevano solo andando nella sezione. La terza non
 * esisteva affatto: la plancia sapeva aprire e sbloccare e non sapeva
 * CHIUDERE, che su una serratura è metà comando.
 *
 * Qui si pretende quello che parte premendo, che è la parte che conta: tre
 * servizi diversi di Home Assistant, e quello giusto sotto ogni parola.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Una Nuki: dichiara `LockEntityFeature.OPEN`, quindi sa anche scattare. */
const NUKI = {
  "lock.portone": {
    state: "locked",
    attributes: { friendly_name: "Portone", supported_features: 1 },
  },
};
/* Configurata coi due gesti di apertura: è il caso del segnalatore. */
const PORTE = [
  { id: "d1", name: "Portone", entity: "lock.portone", icon: "🚪", gesto: "entrambi" },
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [], cameras: [], appliances: [], loads: [], lights: [], climate: [],
    ev: [], covers: [], pool: {}, irrigation: { zones: [] }, energy: {}, entityOverrides: {},
  },
  visibility: { home: true, porte: true },
};

async function avvia(page, testInfo, porte = PORTE) {
  test.setTimeout(120_000);
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    ({ s, porte }) => {
      Object.assign(eval("_RAW_STATES"), s);
      localStorage.setItem("cd_security_doors", JSON.stringify(porte));
      /* La conferma si spegne: qui si prova il comando, non la finestra che
       * chiede «sei sicuro», che ha già le sue prove. */
      localStorage.setItem("cd_porte_conferma", "false");
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { s: NUKI, porte },
  );
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  await page.waitForTimeout(700);
  await page.locator('#dm-widgets .dm-tile[data-dm-widget="porte"]').evaluate((n) => n.click());
  const finestra = page.locator("#dm-widget-popup");
  await expect(finestra).toBeVisible();
  return finestra;
}

const ascolta = (page) =>
  page.evaluate(() => {
    window.__chiamate = [];
    for (const nome of ["dmCallHaService", "callService"]) {
      const vero = window[nome];
      if (typeof vero !== "function") continue;
      window[nome] = (...argomenti) => {
        window.__chiamate.push(argomenti);
        return vero.apply(window, argomenti);
      };
    }
  });

test("il popup offre i tre gesti, col nome di quello che fanno", async ({ page }, testInfo) => {
  const finestra = await avvia(page, testInfo);
  const gesti = await finestra
    .locator("[data-dm-door-gesto]")
    .evaluateAll((nodi) => nodi.map((n) => [n.dataset.dmDoorGesto, n.textContent.trim()]));
  /* L'ordine è quello del modello: prima quello che si può disfare (#387), il
   * blocco in fondo. */
  expect(gesti).toEqual([
    ["sblocca", "Sblocca"],
    ["apri", "Apri"],
    ["blocca", "Blocca"],
  ]);
});

test("ogni tasto chiama il servizio suo, e sono tre servizi diversi", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const finestra = await avvia(page, testInfo);
  await ascolta(page);

  for (const [gesto, servizio] of [
    ["sblocca", "unlock"],
    ["apri", "open"],
    ["blocca", "lock"],
  ]) {
    await finestra.locator(`[data-dm-door-gesto="${gesto}"]`).evaluate((n) => n.click());
    /* Dopo un comando la porta resta «occupata» quattro secondi — serve a non
     * far partire due aperture con un doppio tocco — e premere il gesto dopo
     * prima di allora non fa niente. Qui si aspetta quella finestra invece di
     * accorciarla nel codice: e' una protezione, non un intralcio. */
    await page.waitForTimeout(4300);
    const chiamata = await page.evaluate(
      (s) => window.__chiamate.find((c) => c[1] === s) ?? null,
      servizio,
    );
    expect(chiamata, `«${gesto}» non ha chiamato lock.${servizio}`).not.toBeNull();
    expect(chiamata[0]).toBe("lock");
    expect(JSON.stringify(chiamata[2])).toContain("lock.portone");
  }
});

test("il PIN protegge l'apertura, non la chiusura", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const finestra = await avvia(page, testInfo, [{ ...PORTE[0], pin: "1234" }]);
  await ascolta(page);

  /* Chiudere non chiede il codice: chiudere la propria porta non è mai il
   * verso pericoloso, e l'attrito finirebbe col farla lasciare aperta. */
  await finestra.locator('[data-dm-door-gesto="blocca"]').evaluate((n) => n.click());
  await page.waitForTimeout(300);
  await expect(page.locator("#dm-door-keypad.show, #dm-door-keypad[style*='flex']")).toHaveCount(0);
  const chiusa = await page.evaluate(() => window.__chiamate.find((c) => c[1] === "lock"));
  expect(chiusa).toBeTruthy();

  /* Aprire sì: il tastierino compare e niente parte finché non si digita.
   * Si aspetta che la porta non sia più occupata dal blocco di sopra. */
  await page.waitForTimeout(4300);
  await page.evaluate(() => (window.__chiamate = []));
  await finestra.locator('[data-dm-door-gesto="apri"]').evaluate((n) => n.click());
  await page.waitForTimeout(400);
  const dopo = await page.evaluate(() => ({
    tastierino: Boolean(document.getElementById("dm-door-keypad")),
    partite: window.__chiamate.length,
  }));
  expect(dopo.tastierino).toBe(true);
  expect(dopo.partite).toBe(0);
});
