/* L'azione rapida su una porta col PIN chiede il PIN della porta (#32).
 *
 * «Nella sezione apri porte/cancelli ho configurato la mia serratura con il
 *  PIN e funziona da li'. Ma se da azioni rapide faccio nuova azione, toggle
 *  entita', e seleziono la mia serratura, non c'e' modo di inserire il PIN e
 *  non lo richiede al click.»
 *
 * Qui si guarda cosa parte sul filo: niente prima del PIN, niente col PIN
 * sbagliato, il comando giusto col PIN giusto. E chiudere non lo chiede, come
 * nella pagina delle porte.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [],
    lights: [],
    appliances: [],
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

const AZIONI = [
  { type: "entity", name: "Serratura", icon: "🔒", entity: "lock.ingresso" },
  { type: "entity", name: "Cancelletto", icon: "🚪", entity: "switch.cancelletto" },
];

const PORTE = [
  { id: "porta-1", name: "Ingresso", entity: "lock.ingresso", icon: "🔒", pin: "2468" },
  /* Una porta senza PIN: la sua azione rapida resta com'era. */
  { id: "porta-2", name: "Cancelletto", entity: "switch.cancelletto", icon: "🚪" },
];

async function avvia(page, testInfo, statoDellaSerratura = "locked") {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(
    ({ azioni, porte, stato }) => {
      localStorage.setItem("cd_quick_actions", JSON.stringify(azioni));
      localStorage.setItem("cd_security_doors", JSON.stringify(porte));
      const raw = eval("_RAW_STATES");
      raw["lock.ingresso"] = { entity_id: "lock.ingresso", state: stato, attributes: {} };
      raw["switch.cancelletto"] = { entity_id: "switch.cancelletto", state: "off", attributes: {} };
      /* La spia sul prototipo, come nella prova del portone: il socket del
       * banco di prova si rifa' a ogni riconnessione. */
      window.__inviati = [];
      const proto = window.WebSocket?.prototype;
      if (proto && !proto.__dmSpiato) {
        const originale = proto.send;
        proto.send = function (grezzo) {
          try {
            const m = JSON.parse(grezzo);
            if (m?.type === "call_service") window.__inviati.push(`${m.domain}.${m.service}`);
          } catch (_e) {}
          return originale.call(this, grezzo);
        };
        proto.__dmSpiato = true;
      }
      window.buildQuickActions?.();
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { azioni: AZIONI, porte: PORTE, stato: statoDellaSerratura },
  );
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => Boolean(window.qaRun?.__dmServizioGiusto), null, {
    timeout: 15_000,
  });
}

const inviati = (page) => page.evaluate(() => window.__inviati || []);
const digita = async (page, cifre) => {
  for (const cifra of cifre)
    await page.locator(`#dm-door-keypad [data-dm-door-digit="${cifra}"]`).click();
  await page.locator("#dm-door-keypad [data-dm-door-ok]").click();
};

test("la serratura col PIN non si apre senza il PIN della porta", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await page.evaluate(() => window.qaRun(0));
  const tastierino = page.locator("#dm-door-keypad.show");
  await expect(tastierino).toBeVisible({ timeout: 10_000 });
  await expect(tastierino.locator("[data-dm-door-keypad-name]")).toHaveText("Ingresso");
  expect(await inviati(page), "e' partito qualcosa prima del PIN").toEqual([]);

  /* Il PIN sbagliato non apre, e lo si dice sul tastierino. */
  await digita(page, "1111");
  await expect(tastierino.locator("[data-dm-door-keypad-error]")).not.toBeEmpty();
  expect(await inviati(page)).toEqual([]);

  /* Quello giusto apre: lo sblocco, non un toggle. */
  await digita(page, "2468");
  await expect(page.locator("#dm-door-keypad.show")).toHaveCount(0);
  await expect.poll(() => inviati(page), { timeout: 10_000 }).toContain("lock.unlock");
  expect(await inviati(page)).not.toContain("lock.toggle");
});

test("annullare non apre niente", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await page.evaluate(() => window.qaRun(0));
  await expect(page.locator("#dm-door-keypad.show")).toBeVisible({ timeout: 10_000 });
  await page.locator("#dm-door-keypad [data-dm-door-cancel]").click();
  await expect(page.locator("#dm-door-keypad.show")).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(await inviati(page)).toEqual([]);
});

test("chiudere la serratura non chiede il PIN", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo, "unlocked");
  await page.evaluate(() => window.qaRun(0));
  await expect.poll(() => inviati(page), { timeout: 10_000 }).toContain("lock.lock");
  await expect(page.locator("#dm-door-keypad.show")).toHaveCount(0);
});

test("la porta senza PIN fa come prima", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await avvia(page, testInfo);
  await page.evaluate(() => window.qaRun(1));
  await expect.poll(() => inviati(page), { timeout: 10_000 }).toContain("switch.toggle");
  await expect(page.locator("#dm-door-keypad.show")).toHaveCount(0);
});
