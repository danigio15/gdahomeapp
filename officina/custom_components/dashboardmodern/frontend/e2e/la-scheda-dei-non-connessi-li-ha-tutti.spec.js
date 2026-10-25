/* La scheda «Dispositivi non connessi» della configurazione.
 *
 * «I dispositivi non connessi non escono tutti, non c'è possibilità di
 * inserimento e di ricerca, inoltre mi devi mettere che dispositivo è.»
 *
 * Qui si pretende, sulla pagina vera: che ci siano anche i dispositivi che la
 * plancia non mostra, che ogni riga dica il tipo e marca e modello, che la
 * ricerca filtri (anche fra quelli tolti dall'avviso, che col campanello si
 * rimettono).
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const PRESE = [{ id: "p1", name: "Pompa piscina", entity: "switch.pompa", room: "Giardino" }];
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

const prima = new Date(Date.now() - 23 * 60 * 1000).toISOString();
const muto = (nome, attributi = {}) => ({
  state: "unavailable",
  attributes: { friendly_name: nome, ...attributi },
  last_changed: prima,
});

const STATI = {
  "switch.pompa": muto("Pompa piscina"),
  /* Nessuna di queste sta nella configurazione della plancia. */
  "climate.camera_da_letto": muto("Camera da Letto"),
  "climate.cucina": muto("Cucina"),
  "binary_sensor.finestra_bagno": muto("Finestra bagno", { device_class: "window" }),
  "sensor.finestra_bagno_batteria": muto("Finestra bagno batteria", { device_class: "battery" }),
  "camera.cancello": muto("Cancello"),
  "switch.presa_cantina": muto("Presa cantina"),
  "light.salotto": { state: "on", attributes: { friendly_name: "Salotto" } },
  "input_boolean.vacanze": muto("Vacanze"),
};
const REGISTRI = {
  di: {
    "switch.pompa": "d-pompa",
    "climate.camera_da_letto": "d-clima1",
    "climate.cucina": "d-clima2",
    "binary_sensor.finestra_bagno": "d-finestra",
    "sensor.finestra_bagno_batteria": "d-finestra",
    "camera.cancello": "d-cam",
    "switch.presa_cantina": "d-presa",
    "light.salotto": "d-luce",
  },
  nomi: {
    "d-pompa": "Pompa piscina",
    "d-clima1": "Camera da Letto",
    "d-clima2": "Cucina",
    "d-finestra": "Finestra bagno",
    "d-cam": "Cancello",
    "d-presa": "Presa cantina",
    "d-luce": "Salotto",
  },
  modelli: {
    "d-pompa": "Shelly Plus 1PM",
    "d-clima1": "Daikin FTXM25R",
    "d-clima2": "Daikin FTXM35R",
    "d-finestra": "Aqara Door and Window Sensor",
    "d-cam": "Hikvision DS-2CD2143G2-I",
    "d-presa": "Shelly Plug S",
  },
};

async function apri(page, testInfo, { stati = STATI, registri = REGISTRI } = {}) {
  test.setTimeout(120_000);
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await page.addInitScript((registri) => {
    if (registri)
      localStorage.setItem("dm_dispositivi_di_home_assistant", JSON.stringify(registri));
  }, registri);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true);
  await page.evaluate(
    ({ s, prese }) => {
      Object.assign(eval("_RAW_STATES"), s);
      localStorage.setItem("cd_prese", JSON.stringify(prese));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { s: stati, prese: PRESE },
  );
  await page.locator("#setup-wizard").evaluateAll((n) => n.forEach((x) => x.remove()));
  /* L'anagrafe dei dispositivi la lascia chi ha i registri (il pannello, il
   * ponte): qui la si scrive dopo l'avvio, e la plancia la rilegge da sola. */
  await page.evaluate((registri) => {
    if (registri)
      localStorage.setItem("dm_dispositivi_di_home_assistant", JSON.stringify(registri));
  }, registri);
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    if (!document.getElementById("editor-modal")?.classList.contains("show")) apriConfigEntita();
  });
  await expect(page.locator('#editor-modal .ed-tab[data-tab="scollegati"]')).toHaveCount(1, {
    timeout: 15_000,
  });
  await page.evaluate(() => window.editorSwitch?.("scollegati"));
  await expect(page.locator("#ed-body .dm-scollegati-list").first()).toBeVisible({
    timeout: 15_000,
  });
}

const righe = (page) => page.locator("#ed-body .dm-scollegati-riga:visible");

test("ci sono tutti, con il tipo e marca e modello, e la ricerca li filtra", async ({
  page,
}, testInfo) => {
  await apri(page, testInfo);
  const corpo = page.locator("#ed-body");
  for (const nome of [
    "Pompa piscina",
    "Camera da Letto",
    "Cucina",
    "Finestra bagno",
    "Cancello",
    "Presa cantina",
  ])
    await expect(corpo).toContainText(nome);
  await expect(corpo).not.toContainText("Vacanze");
  await expect(corpo).not.toContainText("Salotto");
  await expect(corpo).toContainText("Clima · Daikin FTXM25R");
  await expect(corpo).toContainText("Sensore finestra · Aqara Door and Window Sensor");
  await expect(corpo).toContainText("Telecamera · Hikvision DS-2CD2143G2-I");
  await expect(righe(page)).toHaveCount(6);
  await page.screenshot({ path: testInfo.outputPath("01-tutti.png") });
  if (process.env.DM_FOTO)
    await page.screenshot({
      path: `${process.env.DM_FOTO}/non-connessi-01-tutti-${testInfo.project.name}.png`,
    });

  const cerca = corpo.locator("[data-dm-scollegati-filtro]");
  await cerca.fill("daikin");
  await expect(righe(page)).toHaveCount(2);
  if (process.env.DM_FOTO)
    await page.screenshot({
      path: `${process.env.DM_FOTO}/non-connessi-02-cerca-${testInfo.project.name}.png`,
    });
  /* Anche per tipo: la pompa e' su una presa anche lei. */
  await cerca.fill("presa");
  await expect(righe(page)).toHaveCount(2);
  await cerca.fill("niente di simile");
  await expect(righe(page)).toHaveCount(0);
  await expect(corpo.locator(".dm-scollegati-nessuno")).toBeVisible();
  await cerca.fill("");
  await expect(righe(page)).toHaveCount(6);

  /* Il cestino toglie, e la ricerca trova anche fra quelli tolti, col
   * campanello per rimetterli. */
  page.once("dialog", (d) => d.accept());
  await corpo
    .locator(".dm-scollegati-riga", { hasText: "Presa cantina" })
    .locator("[data-dm-scollegati-via]")
    .click();
  await expect(corpo.locator(".dm-scollegati-fuori", { hasText: "Presa cantina" })).toHaveCount(1);
  await corpo.locator("[data-dm-scollegati-filtro]").fill("cantina");
  await expect(righe(page)).toHaveCount(1);
  await expect(righe(page).locator("[data-dm-scollegati-torna]")).toHaveCount(1);
  if (process.env.DM_FOTO)
    await page.screenshot({
      path: `${process.env.DM_FOTO}/non-connessi-03-tolti-${testInfo.project.name}.png`,
    });
  await righe(page).locator("[data-dm-scollegati-torna]").click();
  await expect(corpo.locator(".dm-scollegati-fuori")).toHaveCount(0);
});

/* «I dispositivi risultano non raggiungibili, in realtà funzionano» (#307).
 * Senza l'anagrafe dei dispositivi l'avviso guarda solo la plancia; il resto
 * che tace sta sotto, «Altre entità ferme», e si cerca e si toglie lo stesso. */
test("senza anagrafe: l'avviso è della plancia, il resto si cerca e si toglie", async ({
  page,
}, testInfo) => {
  await apri(page, testInfo, {
    registri: null,
    stati: {
      "switch.pompa": muto("Pompa piscina"),
      "light.salotto": { state: "on", attributes: { friendly_name: "Salotto" } },
      /* Il sensore secondario fermo di una luce che va benissimo. */
      "sensor.salotto_firmware": muto("Salotto firmware"),
      "sensor.presa_cantina_potenza": muto("Presa cantina potenza", { device_class: "power" }),
      "input_boolean.vacanze": muto("Vacanze"),
    },
  });
  const corpo = page.locator("#ed-body");
  const avviso = corpo.locator(".dm-scollegati-list").first();
  await expect(avviso.locator(".dm-scollegati-riga")).toHaveCount(1);
  await expect(avviso).toContainText("Pompa piscina");
  await expect(corpo).toContainText("Altre entità ferme");
  await expect(corpo).toContainText("Salotto firmware");
  await expect(corpo).toContainText("Presa cantina potenza");
  await expect(corpo).not.toContainText("Vacanze");
  if (process.env.DM_FOTO)
    await page.screenshot({
      path: `${process.env.DM_FOTO}/non-connessi-307-01-altre-${testInfo.project.name}.png`,
    });

  const cerca = corpo.locator("[data-dm-scollegati-filtro]");
  await cerca.fill("firmware");
  await expect(righe(page)).toHaveCount(1);
  if (process.env.DM_FOTO)
    await page.screenshot({
      path: `${process.env.DM_FOTO}/non-connessi-307-02-cerca-${testInfo.project.name}.png`,
    });
  page.once("dialog", (d) => d.accept());
  await righe(page).locator("[data-dm-scollegati-via]").click();
  await expect(corpo.locator(".dm-scollegati-fuori", { hasText: "Salotto firmware" })).toHaveCount(
    1,
  );
  await cerca.fill("");
  if (process.env.DM_FOTO)
    await page.screenshot({
      path: `${process.env.DM_FOTO}/non-connessi-307-03-tolta-${testInfo.project.name}.png`,
    });
});
