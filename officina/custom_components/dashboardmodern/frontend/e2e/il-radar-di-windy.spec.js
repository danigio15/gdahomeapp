/* Il radar pioggia con Windy, in un riquadro.
 *
 * «Vorrei il radar di Windy.» Windy non ha tessere: ha una mappa da mettere
 * dentro una pagina. Qui: scelto dalla tendina il radar e' un riquadro con
 * la pagina di Windy centrata sul posto, col sandbox e senza referrer; un
 * collegamento di windy.com incollato nella casella dell'indirizzo si legge
 * invece di dare errore; e chi torna a RainViewer ritrova le sue tessere.
 *
 * La rete qui non c'e': la pagina di Windy la risponde la prova, e quello che
 * si guarda e' l'indirizzo che la plancia chiede, non cosa Windy disegna.
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
  visibility: { home: true },
};

async function boot(page, testInfo, radar) {
  test.setTimeout(testInfo.project.name === "webkit-ipad" ? 120_000 : 75_000);
  const chieste = [];
  await page.route("https://**", (route) => {
    const url = route.request().url();
    if (url.startsWith("https://embed.windy.com/")) {
      chieste.push(url);
      return route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!doctype html><title>prova</title><body style='background:#123'>",
      });
    }
    return route.fulfill({ status: 200, body: "" });
  });
  await page.addInitScript((configurazione) => {
    /* La configurazione del radar si semina finche' la scheda non ne scrive
     * una: dopo vale quella scritta, com'e' nella plancia vera. */
    const leggi = Storage.prototype.getItem;
    const scrivi = Storage.prototype.setItem;
    let scritta = null;
    Storage.prototype.getItem = function (chiave) {
      if (String(chiave).endsWith("cd_radar_meteo"))
        return scritta ?? JSON.stringify(configurazione);
      return leggi.call(this, chiave);
    };
    Storage.prototype.setItem = function (chiave, valore) {
      if (String(chiave).endsWith("cd_radar_meteo")) scritta = String(valore);
      return scrivi.call(this, chiave, valore);
    };
  }, radar);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  return chieste;
}

async function apriLePrevisioni(page) {
  await page.evaluate(() => {
    const modale = document.getElementById("weather-modal");
    modale?.classList.add("show");
    if (modale && !modale.querySelector("#weather-forecast-list")) {
      const elenco = document.createElement("div");
      elenco.id = "weather-forecast-list";
      modale.append(elenco);
    }
  });
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("dashboardmodern:editor-rendered", { detail: {} }));
  });
}

async function apriLaSchedaMeteo(page) {
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await expect(page.locator('.ed-tab[data-tab="meteo"]')).toHaveCount(1, { timeout: 15_000 });
  await page.evaluate(() => window.editorSwitch?.("meteo"));
}

test("scelto Windy, il radar e' un riquadro con la pagina di Windy centrata sul posto", async ({
  page,
}, testInfo) => {
  const chieste = await boot(page, testInfo, { servizio: "windy", lat: "45.46", lon: "9.19" });
  await apriLePrevisioni(page);
  const blocco = page.locator("#weather-modal .dm-radar-blocco");
  await expect(blocco).toHaveAttribute("data-dm-modo", "windy", { timeout: 15_000 });
  const cornice = blocco.locator("iframe.dm-radar-windy");
  await expect(cornice).toHaveCount(1);
  const src = await cornice.getAttribute("src");
  const url = new URL(src);
  expect(url.origin).toBe("https://embed.windy.com");
  expect(url.pathname).toBe("/embed.html");
  expect(url.searchParams.get("lat")).toBe("45.4600");
  expect(url.searchParams.get("lon")).toBe("9.1900");
  expect(url.searchParams.get("overlay")).toBe("radar");
  expect(url.searchParams.get("metricRain")).toBe("mm");
  expect(Number(url.searchParams.get("zoom"))).toBeGreaterThanOrEqual(6);
  expect(Number(url.searchParams.get("zoom"))).toBeLessThanOrEqual(10);
  /* Niente della plancia nell'indirizzo: solo i parametri della mappa. */
  expect([...url.searchParams.keys()].sort()).toEqual(
    [
      "lat",
      "level",
      "location",
      "lon",
      "metricRain",
      "metricTemp",
      "metricWind",
      "overlay",
      "product",
      "type",
      "zoom",
    ].sort(),
  );
  await expect(cornice).toHaveAttribute("sandbox", "allow-scripts allow-same-origin");
  await expect(cornice).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(cornice).toHaveAttribute("loading", "lazy");
  /* Le nostre legenda e mirino non stanno sopra quelli di Windy. */
  await expect(blocco.locator(".dm-radar-legenda")).toBeHidden();
  await expect(blocco.locator(".dm-radar-mirino")).toBeHidden();
  await expect(blocco.locator(".dm-radar-nota")).toContainText("Windy");
  /* E la pagina chiesta a Windy e' quella, senza referrer. */
  await expect.poll(() => chieste.length).toBeGreaterThan(0);
  expect(chieste[0]).toBe(src);
});

test("un collegamento di windy.com incollato si legge, invece di dare errore", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo, {
    servizio: "modello",
    modello: "https://www.windy.com/-Radar-radar?radar,41.902,12.496,8",
  });
  await apriLePrevisioni(page);
  const blocco = page.locator("#weather-modal .dm-radar-blocco");
  await expect(blocco).toHaveAttribute("data-dm-modo", "windy", { timeout: 15_000 });
  const src = await blocco.locator("iframe.dm-radar-windy").getAttribute("src");
  const url = new URL(src);
  expect(url.origin).toBe("https://embed.windy.com");
  expect(url.searchParams.get("lat")).toBe("41.9020");
  expect(url.searchParams.get("lon")).toBe("12.4960");
  expect(url.searchParams.get("zoom")).toBe("8");
  await expect(blocco.locator(".dm-radar-nota")).not.toContainText(/\{z\}/);

  /* E nella scheda la riga sotto non e' rossa: dice che e' Windy. */
  await apriLaSchedaMeteo(page);
  const esito = page.locator("#ed-body [data-dm-radar-esito]");
  await expect(esito).toHaveAttribute("data-dm-esito", "windy", { timeout: 15_000 });
  await expect(esito).toContainText("Windy");
});

test("Windy si sceglie dalla tendina, e tornando a RainViewer tornano le tessere", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo, { servizio: "rainviewer", lat: "45.46", lon: "9.19" });
  await apriLaSchedaMeteo(page);
  const tendina = page.locator('#ed-body [data-dm-radar-campo="servizio"]');
  await expect(tendina).toHaveCount(1, { timeout: 15_000 });
  await expect(tendina.locator('option[value="windy"]')).toHaveCount(1);
  await expect(page.locator('#ed-body [data-dm-radar-campo="fondo"]')).toBeVisible();

  await tendina.selectOption("windy");
  /* Le caselle delle tessere se ne vanno: con Windy non servono. */
  await expect(page.locator('#ed-body [data-dm-radar-campo="fondo"]')).toBeHidden();
  await expect(page.locator("#ed-body [data-dm-radar-prova]")).toBeHidden();
  await expect(page.locator("#ed-body [data-dm-radar-esito]")).toHaveAttribute(
    "data-dm-esito",
    "windy",
  );
  await apriLePrevisioni(page);
  const blocco = page.locator("#weather-modal .dm-radar-blocco");
  await expect(blocco).toHaveAttribute("data-dm-modo", "windy", { timeout: 15_000 });
  await expect(blocco.locator("iframe.dm-radar-windy")).toHaveAttribute(
    "src",
    /^https:\/\/embed\.windy\.com\/embed\.html\?/,
  );

  await tendina.selectOption("rainviewer");
  await apriLePrevisioni(page);
  await expect(blocco).toHaveAttribute("data-dm-modo", "mappa", { timeout: 15_000 });
  await expect(blocco.locator("iframe")).toHaveCount(0);
  await expect(page.locator('#ed-body [data-dm-radar-campo="fondo"]')).toBeVisible();
});
