/* I fornitori di energia dentro GdAHome: «userei le integrazioni in essere su
 * Home Assistant tramite HACS, inglobandole nella nostra». La scheda in
 * Config → Energia → Impostazioni li collega: E.ON con email, password e il
 * codice SMS; ENGIE con l'accesso dal browser e l'indirizzo incollato. Qui
 * il ponte e' finto e risponde come quello vero. */
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
  visibility: { home: true, energy: true },
};

const DISPONIBILI = [
  { id: "eon", nome: "E.ON Energia", modo: "password", cosa: "luce" },
  { id: "engie", nome: "ENGIE", modo: "link", cosa: "luce-gas" },
  { id: "enel", nome: "Enel Energia", pronto: false, perche: "nessuna-integrazione" },
  { id: "octopus", nome: "Octopus Energy", pronto: false },
];
const VUOTO = { collegati: [], disponibili: DISPONIBILI };
const COLLEGATO = {
  disponibili: DISPONIBILI,
  collegati: [
    {
      id: "eon-IT001E12345678",
      fornitore: "eon",
      nome: "E.ON Energia",
      pod: "IT001E••••5678",
      stato: "ok",
      aggiornato: Date.now() - 2 * 3600_000,
    },
    {
      id: "engie-1",
      fornitore: "engie",
      nome: "ENGIE",
      pod: "IT012E••••5432",
      stato: "da-ricollegare",
      aggiornato: Date.now() - 50 * 3600_000,
    },
  ],
};

async function apri(page, testInfo, tema, risposte) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate(
    ({ tema, risposte }) => {
      document.documentElement.setAttribute("data-theme", tema);
      window.__CHIESTE__ = [];
      window.__RISPOSTE__ = risposte;
      const vero = window.eval("ws");
      window.__FINTO__ = {
        readyState: 1,
        send(grezzo) {
          const m = JSON.parse(grezzo);
          if (!String(m.type).startsWith("dashboardmodern/fornitori/")) return vero?.send?.(grezzo);
          window.__CHIESTE__.push({ ...m });
          const r = window.__RISPOSTE__[m.type.split("/").pop()];
          setTimeout(() => {
            const attese = window.eval("pendingWsCallbacks");
            const torna = attese[m.id];
            delete attese[m.id];
            torna?.({ id: m.id, type: "result", success: true, result: r });
          }, 15);
        },
      };
      window.eval("ws = window.__FINTO__");
    },
    { tema, risposte },
  );
  await page.evaluate(() => window.apriConfigEntita?.());
  await page.waitForSelector("#editor-modal", { timeout: 20_000 });
  await page.evaluate(() => window.editorSwitch?.("energy"));
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document
      .querySelector('[data-energy-tab="settings"],[data-energy-panel-tab="settings"]')
      ?.click();
    const pannello = document.querySelector('[data-energy-panel="settings"]');
    if (pannello) pannello.hidden = false;
    window.dispatchEvent(new CustomEvent("dashboardmodern:editor-rendered"));
  });
  const scheda = page.locator("#dm-energia-fornitori");
  await expect(scheda).toBeVisible({ timeout: 20_000 });
  await scheda.scrollIntoViewIfNeeded();
  return scheda;
}

const foto = async (scheda, nome, testInfo) => {
  if (process.env.DM_FOTO)
    await scheda.screenshot({
      path: `${process.env.DM_FOTO}/fornitori-${nome}-${testInfo.project.name}.png`,
    });
};

test("E.ON: si sceglie, email e password, codice SMS, collegato", async ({ page }, testInfo) => {
  const scheda = await apri(page, testInfo, "light", {
    stato: VUOTO,
    collega: { serve: "codice" },
    codice: { stato: COLLEGATO },
  });
  await expect(scheda.locator("[data-dm-forn-scegli]")).toHaveCount(2);
  await expect(scheda.locator(".dm-forn-scheda:disabled")).toHaveCount(2);
  await foto(scheda, "scelta", testInfo);
  await scheda.locator('[data-dm-forn-scegli="eon"]').click();
  await expect(scheda.locator("[data-dm-forn-password]")).toHaveAttribute("type", "password");
  await scheda.locator("[data-dm-forn-email]").fill("casa@example.it");
  await scheda.locator("[data-dm-forn-password]").fill("una-password");
  await foto(scheda, "eon-credenziali", testInfo);
  await scheda.locator("[data-dm-forn-entra]").click();
  await expect(scheda.locator("[data-dm-forn-codice]")).toBeVisible();
  await scheda.locator("[data-dm-forn-codice]").fill("483921");
  await foto(scheda, "eon-codice", testInfo);
  await scheda.locator("[data-dm-forn-conferma]").click();
  await expect(scheda.locator(".dm-forn-riga")).toHaveCount(2);
  await expect(scheda).toContainText("POD IT001E••••5678");
  await expect(scheda).toContainText("da ricollegare");
  await foto(scheda, "collegati", testInfo);
  const chieste = await page.evaluate(() => window.__CHIESTE__.map((m) => m.type.split("/").pop()));
  expect(chieste).toEqual(expect.arrayContaining(["stato", "collega", "codice"]));
});

test("scelto un fornitore si torna all'elenco, dall'alto o da Annulla", async ({
  page,
}, testInfo) => {
  /* «Dopo aver cliccato su un fornitore non mi fa tornare indietro.» */
  const scheda = await apri(page, testInfo, "light", { stato: VUOTO, annulla: {} });
  await scheda.locator('[data-dm-forn-scegli="eon"]').click();
  const indietro = scheda.locator(".dm-forn-indietro");
  await expect(indietro).toBeVisible();
  await expect(scheda.locator("[data-dm-forn-entra]")).toBeVisible();
  await indietro.click();
  await expect(scheda.locator("[data-dm-forn-scegli]")).toHaveCount(2);
  await scheda.locator('[data-dm-forn-scegli="eon"]').click();
  await scheda.locator(".dm-forn-tasti [data-dm-forn-annulla]").click();
  await expect(scheda.locator("[data-dm-forn-scegli]")).toHaveCount(2);
});

test("ENGIE: accesso dal browser e indirizzo incollato", async ({ page }, testInfo) => {
  const scheda = await apri(page, testInfo, "dark", {
    stato: VUOTO,
    inizia: { link: "https://login.engie.it/authorize?client_id=…" },
    incolla: { stato: COLLEGATO },
  });
  await scheda.locator('[data-dm-forn-scegli="engie"]').click();
  await expect(scheda.locator(".dm-forn-link")).toHaveAttribute("href", /login\.engie\.it/);
  await foto(scheda, "engie-incolla", testInfo);
  await scheda
    .locator("[data-dm-forn-incolla]")
    .fill("https://login.engie.it/android/it.engie.appengie/callback?code=abc&state=xyz");
  await scheda.locator("[data-dm-forn-incolla-ok]").click();
  await expect(scheda.locator(".dm-forn-riga")).toHaveCount(2);
  await foto(scheda, "collegati-scuro", testInfo);
});

test("E.ON col controllo «non sei un robot»: si passa dal browser", async ({ page }, testInfo) => {
  const scheda = await apri(page, testInfo, "light", {
    stato: VUOTO,
    collega: {
      serve: "incolla",
      link: "https://auth.eon-energia.com/authorize?client_id=…",
      perche: "captcha",
    },
  });
  await scheda.locator('[data-dm-forn-scegli="eon"]').click();
  await scheda.locator("[data-dm-forn-email]").fill("casa@example.it");
  await scheda.locator("[data-dm-forn-password]").fill("una-password");
  await scheda.locator("[data-dm-forn-entra]").click();
  await expect(scheda.locator(".dm-forn-link")).toHaveAttribute("href", /auth\.eon-energia\.com/);
  await expect(scheda).toContainText("F12");
  await expect(scheda).toContainText("non essere un robot");
  await foto(scheda, "eon-incolla", testInfo);
});

test("chi non amministra non vede la scheda", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate(() => {
    const vero = window.eval("ws");
    window.__FINTO__ = {
      readyState: 1,
      send(grezzo) {
        const m = JSON.parse(grezzo);
        if (!String(m.type).startsWith("dashboardmodern/fornitori/")) return vero?.send?.(grezzo);
        setTimeout(() => {
          const attese = window.eval("pendingWsCallbacks");
          const torna = attese[m.id];
          delete attese[m.id];
          torna?.({
            id: m.id,
            type: "result",
            success: false,
            error: { code: "unauthorized", message: "questo lo fa solo chi amministra la casa" },
          });
        }, 15);
      },
    };
    window.eval("ws = window.__FINTO__");
  });
  await page.evaluate(() => window.apriConfigEntita?.());
  await page.waitForSelector("#editor-modal", { timeout: 20_000 });
  await page.evaluate(() => window.editorSwitch?.("energy"));
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const pannello = document.querySelector('[data-energy-panel="settings"]');
    if (pannello) pannello.hidden = false;
    window.dispatchEvent(new CustomEvent("dashboardmodern:editor-rendered"));
  });
  await page.waitForTimeout(1200);
  await expect(page.locator("#dm-energia-fornitori")).toHaveCount(0);
});
