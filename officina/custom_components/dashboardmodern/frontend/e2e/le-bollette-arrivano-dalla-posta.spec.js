/* Le bollette dalla posta: «A, usiamo Gmail». Il ponte legge le mail del
 * fornitore e la linguetta Bollette le mostra anche senza nessun sensore; in
 * Config → Energia → Impostazioni c'e' la scheda per collegare la casella.
 * Qui il ponte e' finto e risponde come quello vero. */
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

const giorno = (a, m, g) => new Date(a, m - 1, g, 12).getTime();
const bolletta = (numero, importo, emessa, dal, al, kwh, scadenza, pagata = null) => ({
  fornitore: "enel",
  nomeFornitore: "Enel Energia",
  numero,
  importo,
  emessa,
  scadenza,
  periodo: { dal, al },
  consumo: { valore: kwh, unita: "kwh" },
  pagata,
  data: emessa,
});
const COLLEGATA = {
  collegata: true,
  indirizzo: "c•••@gmail.com",
  fornitori: ["enel"],
  lettoIl: Date.now() - 2 * 60 * 60 * 1000,
  errore: "",
  fornitoriNoti: [
    { id: "enel", nome: "Enel Energia" },
    { id: "eon", nome: "E.ON Energia" },
    { id: "edison", nome: "Edison Energia" },
  ],
  bollette: [
    bolletta(
      "0123456789",
      52,
      giorno(2026, 10, 15),
      giorno(2026, 8, 1),
      giorno(2026, 9, 30),
      412,
      giorno(2026, 11, 5),
    ),
    bolletta(
      "0123456700",
      68.4,
      giorno(2026, 8, 14),
      giorno(2026, 6, 1),
      giorno(2026, 7, 31),
      538,
      giorno(2026, 9, 4),
      true,
    ),
    bolletta(
      "0123456600",
      91.15,
      giorno(2026, 6, 13),
      giorno(2026, 4, 1),
      giorno(2026, 5, 31),
      702,
      giorno(2026, 7, 3),
      true,
    ),
  ],
};
const SCOLLEGATA = { ...COLLEGATA, collegata: false, indirizzo: "", bollette: [], lettoIl: 0 };

async function avvia(page, testInfo, { tema = "light", posta = COLLEGATA } = {}) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate(
    ({ tema, posta }) => {
      document.documentElement.setAttribute("data-theme", tema);
      window.__CHIESTE__ = [];
      window.__POSTA__ = posta;
      const vero = window.eval("ws");
      window.__FINTO__ = {
        readyState: 1,
        send(grezzo) {
          const m = JSON.parse(grezzo);
          if (!String(m.type).startsWith("ponte/bollette/")) return vero?.send?.(grezzo);
          window.__CHIESTE__.push({ ...m });
          setTimeout(() => {
            const attese = window.eval("pendingWsCallbacks");
            const torna = attese[m.id];
            delete attese[m.id];
            torna?.({ id: m.id, type: "result", success: true, result: window.__POSTA__ });
          }, 15);
        },
      };
      window.eval("ws = window.__FINTO__");
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { tema, posta },
  );
}

for (const tema of ["light", "dark"])
  test(`la linguetta Bollette con le bollette dalla posta (${tema})`, async ({
    page,
  }, testInfo) => {
    await avvia(page, testInfo, { tema });
    await page.locator('.tab[data-tab="energy"]').click();
    const linguetta = page.locator('#page-energy [data-dm-energia-vista="bollette"]');
    await expect(linguetta).toBeVisible({ timeout: 20_000 });
    await linguetta.click();
    const vista = page.locator("#view-bollette");
    await expect(vista.locator(".dm-bol-cifra strong")).toHaveText(/52,00\s€/);
    await expect(vista).toContainText("Enel Energia");
    await expect(vista).toContainText("5 novembre 2026");
    await expect(vista.locator(".dm-bol-voce")).toHaveCount(3);
    await expect(vista.locator(".dm-bol-voce").nth(1)).toContainText("68,40 €");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    if (process.env.DM_FOTO)
      await vista.screenshot({
        path: `${process.env.DM_FOTO}/posta-${tema}-${testInfo.project.name}.png`,
      });
  });

async function apriLeImpostazioniDellEnergia(page) {
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
}

test("la scheda di Gmail: si collega, e la password non resta nel campo", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "una misura sola basta");
  await avvia(page, testInfo, { posta: SCOLLEGATA });
  await apriLeImpostazioniDellEnergia(page);
  const scheda = page.locator("#dm-energia-posta");
  await expect(scheda).toBeVisible({ timeout: 20_000 });
  await scheda.scrollIntoViewIfNeeded();
  await expect(scheda.locator("[data-dm-posta-password]")).toHaveAttribute("type", "password");
  if (process.env.DM_FOTO)
    await scheda.screenshot({ path: `${process.env.DM_FOTO}/gmail-da-collegare.png` });
  await scheda.locator("[data-dm-posta-email]").fill("casa@gmail.com");
  await scheda.locator("[data-dm-posta-password]").fill("abcd efgh ijkl mnop");
  await page.evaluate((posta) => (window.__POSTA__ = posta), COLLEGATA);
  await scheda.locator("[data-dm-posta-collega]").click();
  await expect(scheda).toContainText("c•••@gmail.com");
  await expect(scheda).toContainText("3 bollette");
  const chiesta = await page.evaluate(() =>
    window.__CHIESTE__.find((m) => m.type === "ponte/bollette/collega"),
  );
  expect(chiesta).toMatchObject({ email: "casa@gmail.com", fornitori: ["enel"] });
  if (process.env.DM_FOTO)
    await scheda.screenshot({ path: `${process.env.DM_FOTO}/gmail-collegata.png` });
});
