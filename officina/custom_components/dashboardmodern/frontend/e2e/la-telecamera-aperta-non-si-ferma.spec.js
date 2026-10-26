/* La telecamera aperta non si ferma quando qualcosa cambia in casa.
 *
 * «Le telecamere non si aprono piu' a schermo intero, si bloccano.» Il Colpo
 * d'occhio si ridisegna a ogni stato che cambia, anche quando e' spento, e
 * spento si toglie di mezzo chiudendo il suo video: ma il motore delle
 * telecamere e' uno solo, e quella chiusura fermava la telecamera aperta
 * dalla plancia. Al primo sensore che si muoveva il video restava fermo, nel
 * riquadro e a schermo intero.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    cameras: [{ id: "cam1", name: "Ingresso", entity: "camera.ingresso" }],
    appliances: [],
    loads: [],
    climate: [],
    ev: [],
    covers: [],
    lights: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
  },
  visibility: {},
};

test("una telecamera aperta resta aperta mentre gli stati della casa cambiano", async ({
  page,
}, testInfo) => {
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_SECTION_RUNTIME__?.installed, null, {
    timeout: 60000,
  });
  const esito = await page.evaluate(async () => {
    const stati = eval("_RAW_STATES");
    stati["camera.ingresso"] = {
      entity_id: "camera.ingresso",
      state: "idle",
      attributes: { friendly_name: "Ingresso" },
    };
    window.applyStates?.();
    const riquadro = document.createElement("div");
    document.body.append(riquadro);
    void window.dmCamOpen(
      { id: "cam1", name: "Ingresso", entity: "camera.ingresso" },
      "Ingresso",
      riquadro,
    );
    await new Promise((ok) => setTimeout(ok, 300));
    const prima = eval("_dmCurrentCam")?.entity ?? null;
    /* Un sensore qualunque cambia, piu' volte. */
    for (let i = 0; i < 3; i += 1) {
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
      await new Promise((ok) => setTimeout(ok, 150));
    }
    return { prima, dopo: eval("_dmCurrentCam")?.entity ?? null };
  });
  expect(esito.prima).toBe("camera.ingresso");
  expect(esito.dopo).toBe("camera.ingresso");
});
