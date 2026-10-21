/* «Quando fai gli aggiornamenti su GdAHome, tipo di Alexa Media Player, HA ti
 * richiede il riavvio dopo, e su GdAHome non viene proposto.» Il ponte legge
 * le riparazioni di Home Assistant (`ponte/aggiornamenti/riavvio`); la
 * pastiglia in alto resta anche senza niente da installare, dice «Riavvio
 * richiesto», e la sua finestra ha il tasto «Riavvia». */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [],
    appliances: [],
    loads: [],
    lights: [{ id: "l1", name: "Cucina", entity: "light.cucina" }],
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

for (const tema of ["light", "dark"])
  test(`dopo l'aggiornamento la casa propone il riavvio (${tema})`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
    await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
    await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
    await page.evaluate((tema) => {
      document.documentElement.setAttribute("data-theme", tema);
      const stati = eval("_RAW_STATES");
      stati["light.cucina"] = {
        entity_id: "light.cucina",
        state: "off",
        attributes: { friendly_name: "Cucina" },
      };
      window.__CHIESTE__ = [];
      const vero = window.eval("ws");
      window.__FINTO__ = {
        readyState: 1,
        send(grezzo) {
          const m = JSON.parse(grezzo);
          if (!String(m.type).startsWith("ponte/aggiornamenti/")) return vero?.send?.(grezzo);
          window.__CHIESTE__.push(m.type);
          const result =
            m.type === "ponte/aggiornamenti/riavvio"
              ? { serve: true, chi: ["Alexa Media Player"], sappiamo: true }
              : { avviato: true };
          setTimeout(() => {
            const attese = window.eval("pendingWsCallbacks");
            const torna = attese[m.id];
            delete attese[m.id];
            torna?.({ id: m.id, type: "result", success: true, result });
          }, 15);
        },
      };
      window.eval("ws = window.__FINTO__");
      window.confirm = () => true;
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    }, tema);
    await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
    /* La risposta arriva dopo il primo giro: il secondo la disegna. */
    await page.waitForTimeout(400);
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} })),
    );
    const pastiglia = page.locator('#dm-casa-riga [data-dm-casa="aggiornamenti"]');
    await expect(pastiglia).toBeVisible({ timeout: 20_000 });
    await expect(pastiglia).toContainText(/riavvio/i);
    await pastiglia.click();
    const elenco = page.locator("#dm-casa-popup");
    await expect(elenco).toBeVisible();
    const riga = elenco.locator("[data-dm-casa-riavvio]");
    await expect(riga).toContainText("Home Assistant va riavviato");
    await expect(riga).toContainText("Alexa Media Player");
    if (process.env.DM_FOTO)
      await elenco.locator("[data-dm-casa-scheda]").screenshot({
        path: `${process.env.DM_FOTO}/riavvio-${tema}-${testInfo.project.name}.png`,
      });
    await riga.locator("[data-dm-casa-riavvia]").click();
    await expect
      .poll(() => page.evaluate(() => window.__CHIESTE__))
      .toContain("ponte/aggiornamenti/riavvia");
  });
