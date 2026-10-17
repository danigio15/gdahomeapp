import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* «La stessa cosa dobbiamo pensarla anche su webapp e su Home Assistant, cosi'
 * da poter pianificare il viaggio da pc.»
 *
 * La pagina gdanav parla con la casa coi comandi `ponte/viaggi/*`: qui la casa
 * e' finta, e risponde come `ponte/src/viaggi.js`. Si guarda che la voce ci
 * sia col logo, che i viaggi si vedano, che una meta si cerchi e si scelga,
 * che si dica quando partire e che il viaggio parta per la casa col giusto
 * contenuto. E che senza Premium non si scriva niente.
 *
 * Con `DM_FOTO=<cartella>` lascia le fotografie della pagina.
 */

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
  visibility: { home: true },
};

const DOMANI = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

async function apri(page, testInfo, { sbloccato = true, larga = 1440 } = {}) {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: larga, height: 1000 });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate(
    ({ sbloccato, domani }) => {
      const stati = window.eval("_RAW_STATES");
      stati["climate.auto"] = {
        entity_id: "climate.auto",
        state: "off",
        attributes: { friendly_name: "Clima auto" },
      };
      stati["cover.garage"] = {
        entity_id: "cover.garage",
        state: "closed",
        attributes: { friendly_name: "Garage" },
      };
      window.__VIAGGI__ = [
        {
          id: "v_1",
          tipo: "una",
          nome: "",
          da: null,
          tappe: [{ nome: "Caserta · Piazza Dante", lat: 41.07, lon: 14.33 }],
          quando: { modo: "arrivo", ora: "09:00", giorno: domani, giorni: [] },
          avviso: { acceso: true, minuti: 10 },
          prepara: { clima: { entity: "climate.auto", minuti: 10 }, garage: null },
          stima: { durataS: 2880, km: 41.3, fonte: "traffico" },
          prossima: {
            partenza: Date.parse(`${domani}T08:12`),
            arrivo: Date.parse(`${domani}T09:00`),
          },
        },
        {
          id: "v_2",
          tipo: "settimana",
          nome: "Casa – Lavoro",
          da: null,
          tappe: [{ nome: "Lavoro", lat: 40.86, lon: 14.28 }],
          quando: { modo: "arrivo", ora: "08:30", giorno: null, giorni: [1, 2, 3, 4, 5] },
          avviso: { acceso: true, minuti: 10 },
          prepara: { clima: null, garage: null },
          stima: { durataS: 1860, km: 12.4, fonte: "strada" },
          prossima: null,
        },
      ];
      window.__SALVATI__ = [];
      const vero = window.eval("ws");
      const finto = {
        readyState: 1,
        send(grezzo) {
          const m = JSON.parse(grezzo);
          if (!String(m.type).startsWith("ponte/viaggi/")) return vero?.send?.(grezzo);
          const rispondi = (success, result, error) =>
            setTimeout(() => {
              const attese = window.eval("pendingWsCallbacks");
              const torna = attese[m.id];
              delete attese[m.id];
              torna?.({ id: m.id, type: "result", success, result, error });
            }, 15);
          if (m.type === "ponte/viaggi/elenco")
            return rispondi(true, { sbloccato, viaggi: window.__VIAGGI__ });
          if (!sbloccato)
            return rispondi(false, null, {
              code: "premium-richiesto",
              message: "premium-richiesto",
            });
          if (m.type === "ponte/viaggi/cerca" && m.testo === "guasto")
            return rispondi(true, { posti: [], guasto: true });
          if (m.type === "ponte/viaggi/cerca" && m.testo === "xqzzyw")
            return rispondi(true, { posti: [] });
          if (m.type === "ponte/viaggi/cerca")
            return rispondi(true, {
              posti: [
                { nome: "Salerno · Lungomare Trieste", lat: 40.677, lon: 14.756 },
                { nome: "Salerno · Stazione", lat: 40.675, lon: 14.772 },
              ],
            });
          if (m.type === "ponte/viaggi/strada")
            return rispondi(true, {
              stima: { durataS: 3120, km: 55.2, fonte: "strada" },
              linea: [
                [14.26, 40.85],
                [14.4, 40.78],
                [14.6, 40.72],
                [14.756, 40.677],
              ],
              da: { nome: "Casa", lat: 40.85, lon: 14.26 },
            });
          if (m.type === "ponte/viaggi/salva") {
            window.__SALVATI__.push(m.viaggio);
            const nuovo = { ...m.viaggio, id: m.viaggio.id || "v_3", prossima: null };
            window.__VIAGGI__ = [...window.__VIAGGI__.filter((v) => v.id !== nuovo.id), nuovo];
            return rispondi(true, { viaggio: nuovo });
          }
          return rispondi(false, null, { code: "unknown_command", message: "?" });
        },
      };
      window.__FINTO__ = finto;
      window.eval("ws = window.__FINTO__");
    },
    { sbloccato, domani: DOMANI },
  );
  const voce = page.locator('nav.tabs .tab[data-tab="gdanav"]');
  await expect(voce).toBeVisible();
  await voce.click();
  return page.locator("#dm-gn");
}

test("da PC: i viaggi si vedono, una meta si cerca e il viaggio parte per la casa", async ({
  page,
}, testInfo) => {
  const pagina = await apri(page, testInfo);
  await expect(page.locator('nav.tabs .tab[data-tab="gdanav"] .text')).toHaveText("gdanav");
  await expect(pagina.locator(".dm-gn-viaggio")).toHaveCount(2);
  await expect(pagina.locator(".dm-gn-viaggio").first()).toContainText("Casa – Caserta");
  await expect(pagina.locator(".dm-gn-viaggio").first()).toContainText("parti alle 8:12");
  await pagina.locator(".dm-gn-viaggio").first().click();
  await expect(pagina.locator(".dm-gn-ora")).toHaveText("8:12");
  if (process.env.DM_FOTO)
    await page.screenshot({ path: `${process.env.DM_FOTO}/gdanav-pc-viaggio.png` });

  await pagina.locator("[data-gn-nuovo]").click();
  await pagina.locator("[data-gn-cerca]").fill("lungomare salerno");
  await pagina.locator("[data-gn-proposta]").first().click();
  await expect(pagina.locator(".dm-gn-mappa svg")).toBeVisible();
  await expect(pagina.locator(".dm-gn-ora")).toBeVisible();
  await pagina.locator('[data-gn-campo="clima"]').selectOption("climate.auto");
  await pagina.locator('[data-gn-campo="garage"]').selectOption("cover.garage");
  if (process.env.DM_FOTO)
    await page.screenshot({ path: `${process.env.DM_FOTO}/gdanav-pc-nuovo.png` });
  await pagina.locator("[data-gn-salva]").click();
  await expect.poll(() => page.evaluate(() => window.__SALVATI__.length)).toBe(1);
  const salvato = await page.evaluate(() => window.__SALVATI__[0]);
  expect(salvato.tipo).toBe("una");
  expect(salvato.tappe[0].nome).toBe("Salerno · Lungomare Trieste");
  expect(salvato.quando).toMatchObject({ modo: "arrivo", ora: "09:00", giorno: DOMANI });
  expect(salvato.prepara).toEqual({
    clima: { entity: "climate.auto", minuti: 10 },
    garage: { entity: "cover.garage" },
  });
  expect(salvato.stima).toMatchObject({ durataS: 3120, fonte: "strada" });
  await expect(pagina.locator(".dm-gn-viaggio")).toHaveCount(3);
});

test("senza gdanav Premium la pagina lo dice, e non si scrive niente", async ({
  page,
}, testInfo) => {
  const pagina = await apri(page, testInfo, { sbloccato: false });
  await expect(pagina.locator(".dm-gn-premium")).toContainText("gdanav Premium");
  await expect(pagina.locator("[data-gn-nuovo]")).toHaveCount(0);
  if (process.env.DM_FOTO)
    await page.screenshot({ path: `${process.env.DM_FOTO}/gdanav-pc-premium.png` });
});

/* «C'è un problema su intestazione: compare e scompare continuamente.» La
 * testata della pagina sta dentro `#dm-gn`, e la pagina si riscriveva a ogni
 * `render` di Home Assistant: la testata spariva e tornava. Qui si fanno
 * arrivare tanti `render` di fila, e la testata resta la stessa, sempre li'. */
test("la testata della pagina gdanav resta ferma mentre la casa cambia", async ({
  page,
}, testInfo) => {
  // Su uno schermo largo: la pagina tiene il contenuto a 1396 px, e la
  // testata va a stare dentro di lui.
  const pagina = await apri(page, testInfo, { larga: 1700 });
  await expect(pagina.locator(".dm-gn-viaggio")).toHaveCount(2);
  const testata = page.locator("#page-gdanav .dm-page-mast");
  await expect(testata).toBeVisible();
  await page.evaluate(() => {
    window.__TESTATA__ = document.querySelector("#page-gdanav .dm-page-mast");
    window.__SPARITA__ = 0;
    new MutationObserver(() => {
      if (!document.querySelector("#page-gdanav .dm-page-mast")) window.__SPARITA__ += 1;
    }).observe(document.getElementById("page-gdanav"), { childList: true, subtree: true });
  });
  for (let i = 0; i < 10; i += 1) {
    await page.evaluate(() => window.eval("typeof render === 'function' && render()"));
    await page.waitForTimeout(60);
  }
  expect(await page.evaluate(() => window.__SPARITA__)).toBe(0);
  expect(
    await page.evaluate(
      () => window.__TESTATA__ === document.querySelector("#page-gdanav .dm-page-mast"),
    ),
  ).toBe(true);
  await expect(pagina.locator(".dm-gn-viaggio")).toHaveCount(2);
});

/* «Il pianificatore non trova indirizzi, la mappa non ha nulla.» La ricerca
 * che non risponde lo dice, quella che non trova lo dice in un altro modo, e
 * sotto la strada c'e' la cartina — col fondo di Esri, come il radar: il server
 * dei volontari di OpenStreetMap risponde «403 Access blocked». */
test("la ricerca dice cosa succede, e sotto la strada c'e' la cartina", async ({
  page,
}, testInfo) => {
  const tessere = [];
  const pagina = await apri(page, testInfo);
  const bloccate = [];
  await page.route("https://tile.openstreetmap.org/**", (route) => {
    bloccate.push(route.request().url());
    route.fulfill({ status: 403, body: "Access blocked" });
  });
  await page.route("https://server.arcgisonline.com/**", (route) => {
    tessere.push(route.request().url());
    const [z, x, y] = route.request().url().split("/").slice(-3);
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eef2e6"/><path d="M0 ${(Number(x) * 37) % 256} L256 ${(Number(y) * 53) % 256}" stroke="#fff" stroke-width="9"/><path d="M${(Number(y) * 29) % 256} 0 L${(Number(x) * 71) % 256} 256" stroke="#f8d38a" stroke-width="6"/><rect x="${(Number(x) * 13) % 200}" y="${(Number(y) * 17) % 200}" width="46" height="30" fill="#cfe3c4"/><text x="8" y="250" font-size="9" fill="#94a3b8">${z}</text></svg>`,
    });
  });
  await pagina.locator("[data-gn-nuovo]").click();
  const campo = pagina.locator("[data-gn-cerca]");

  await campo.fill("guasto");
  await expect(pagina.locator('[data-gn-ricerca="guasto"]')).toContainText(/non risponde/);
  await campo.fill("xqzzyw");
  await expect(pagina.locator('[data-gn-ricerca="vuota"]')).toContainText(/Nessun posto/);

  await campo.fill("lungomare salerno");
  await pagina.locator("[data-gn-proposta]").first().click();
  await expect(pagina.locator(".dm-gn-mappa svg image").first()).toBeAttached();
  await expect.poll(() => tessere.length).toBeGreaterThan(1);
  expect(
    tessere.every((u) =>
      /^https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Street_Map\/MapServer\/tile\/\d+\/\d+\/\d+$/.test(
        u,
      ),
    ),
  ).toBe(true);
  await expect(pagina.locator(".dm-gn-mappa path")).toHaveCount(2);
  await expect(pagina.locator(".dm-gn-osm")).toHaveText("© Esri");
  expect(bloccate).toEqual([]);
  if (process.env.DM_FOTO) {
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${process.env.DM_FOTO}/gdanav-pc-cartina.png` });
  }
});

/* Nell'app la voce non c'e': i viaggi si pianificano dentro il navigatore
 * («Pianifica i viaggi» nel menu laterale e la scheda sulla mappa). Nel
 * browser di Home Assistant resta. */
test("nell'app la voce gdanav non c'e', nel browser si'", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.addInitScript(() => {
    /* Il segno con cui l'app serve la plancia (`premesse.dart`). */
    document.addEventListener("DOMContentLoaded", () => {
      const foglio = document.createElement("style");
      foglio.id = "gdahome-config-fuori";
      document.head.append(foglio);
    });
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await expect(page.locator('nav.tabs .tab[data-tab="home"]')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready")));
  await page.waitForTimeout(400);
  await expect(page.locator('nav.tabs .tab[data-tab="gdanav"]')).toHaveCount(0);

  /* Nel browser, la stessa plancia senza il segno dell'app: la voce c'e'. */
  const browser = await page.context().newPage();
  await browser.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(browser, "dashboard.html", testInfo, SEME);
  await browser.waitForFunction(
    () => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true,
    null,
    {
      timeout: 60000,
    },
  );
  const voce = browser.locator('nav.tabs .tab[data-tab="gdanav"]');
  await expect(voce).toHaveCount(1);
  await expect(voce.locator(".text")).toHaveText("gdanav");
});
