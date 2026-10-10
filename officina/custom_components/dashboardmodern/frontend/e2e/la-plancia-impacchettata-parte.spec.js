/* La plancia impacchettata parte, nel browser.
 *
 * «Velocizza il caricamento delle plance, sia su Home Assistant che su gdahome
 * app.» Il ponte serve la pagina coi moduli del pacchetto al posto dei
 * sorgenti sciolti (`ponte/src/pacco-della-plancia.js`). Qui la pagina si
 * riscrive con la stessa funzione del ponte, e si guarda che parta davvero:
 * dal pacchetto, senza chiedere nessun modulo sciolto, coi cataloghi delle
 * lingue raggiungibili e hls.js preso solo quando serve. */
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { ilPaccoDi, laPaginaImpacchettata } from "../../../../../ponte/src/pacco-della-plancia.js";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { SEME_A_MURO } from "./helpers/casa-a-muro.js";

const PLANCIA = fileURLToPath(new URL("../../../../../ponte/plancia/", import.meta.url));

test("la plancia impacchettata parte dal pacchetto, senza moduli sciolti", async ({
  page,
}, testInfo) => {
  const { pacco, perche } = ilPaccoDi(PLANCIA);
  expect(pacco, `il pacchetto ${perche}`).toBeTruthy();
  await page.route(/\/legacy\/dashboard\.html(\?.*)?$/, async (route) => {
    const html = readFileSync(`${PLANCIA}legacy/dashboard.html`, "utf8");
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: laPaginaImpacchettata(html, pacco.file),
    });
  });
  await page.route(/\/vendor\/hls\.min\.js$/, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "window.Hls=class{static isSupported(){return true}}",
    }),
  );
  const chieste = [];
  page.on("request", (richiesta) => chieste.push(new URL(richiesta.url()).pathname));

  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME_A_MURO);

  expect(await page.evaluate(() => window.__DASHBOARDMODERN_IMPACCHETTATA__)).toBe(true);
  const sciolti = chieste.filter((via) => via.startsWith("/src/") && !via.startsWith("/src/i18n/"));
  expect(sciolti).toEqual([]);
  expect(chieste.filter((via) => via.startsWith("/pacco/")).length).toBeGreaterThan(0);

  /* I cataloghi stanno fuori dal pacchetto: si raggiungono lo stesso. */
  const tedesco = await page.evaluate(async () => {
    const modulo = await import(`${window.__DASHBOARDMODERN_CATALOGHI__}de.js`);
    return Object.keys(modulo.default || modulo.catalog || {}).length;
  });
  expect(tedesco).toBeGreaterThan(100);

  /* hls.js non parte con la plancia: arriva quando una telecamera lo chiede. */
  expect(chieste.some((via) => via.endsWith("/hls.min.js"))).toBe(false);
  expect(
    await page.evaluate(async () => typeof (await window.__DM_CARICA_HLS__())?.isSupported),
  ).toBe("function");
  expect(chieste.some((via) => via.endsWith("/hls.min.js"))).toBe(true);
});
