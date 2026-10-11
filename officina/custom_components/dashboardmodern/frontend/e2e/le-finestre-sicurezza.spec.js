/* Le finestre del gruppo «sicurezza», sulla Home vera.
 *
 * «Analizza tutti i widget e proponimi miglioramenti… Le approvo tutte.» Ogni
 * tessera apriva la stessa finestra generica; queste otto adesso hanno la
 * loro: l'antifurto con i modi a schede, le telecamere col fotogramma grande,
 * i varchi aperti in cima con da quanto, le stanze occupate, i rilevatori del
 * fumo per tipo, le sonde con la valvola, chi non risponde dal piu' lungo, le
 * batterie da cambiare prima delle altre.
 *
 * Con `FOTO_FINESTRE=<cartella>` fotografa ogni finestra (sul telefono) intera.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const PRESE = [
  { id: "p1", name: "Pompa piscina", entity: "switch.pompa", room: "Giardino" },
  { id: "p2", name: "Luci vialetto", entity: "switch.vialetto", room: "Giardino" },
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: [{ id: "r1", name: "Giardino", icon: "🌳", metadata: {} }],
    cameras: [
      { id: "cam1", name: "Giardino", entity: "camera.giardino" },
      { id: "cam2", name: "Ingresso", entity: "camera.ingresso" },
      { id: "cam3", name: "Box auto", entity: "camera.box" },
    ],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: { "dm.security_centrale_allarme": "alarm_control_panel.casa" },
    prese: PRESE,
  },
  visibility: { home: true, security: true, prese: true },
};

const MINUTO = 60000;

function stati(adesso) {
  const fa = (minuti) => new Date(adesso - minuti * MINUTO).toISOString();
  const voce = (entity_id, state, attributes, minuti = 30) => [
    entity_id,
    { entity_id, state, attributes, last_changed: fa(minuti), last_updated: fa(minuti) },
  ];
  const foto = (entity) => ({
    friendly_name: entity,
    entity_picture: `/api/camera_proxy/${entity}?token=prova`,
  });
  return Object.fromEntries([
    voce(
      "alarm_control_panel.casa",
      "armed_home",
      { friendly_name: "Centrale", supported_features: 15, code_format: "number" },
      95,
    ),
    voce(
      "binary_sensor.porta_ingresso",
      "on",
      { friendly_name: "Porta ingresso", device_class: "door" },
      12,
    ),
    voce(
      "binary_sensor.finestra_cucina",
      "on",
      { friendly_name: "Finestra cucina", device_class: "window" },
      47,
    ),
    voce("binary_sensor.portafinestra_salone", "off", {
      friendly_name: "Portafinestra salone",
      device_class: "door",
    }),
    voce("binary_sensor.finestra_bagno", "off", {
      friendly_name: "Finestra bagno",
      device_class: "window",
    }),
    voce("binary_sensor.finestra_studio", "off", {
      friendly_name: "Finestra studio",
      device_class: "window",
    }),
    voce(
      "binary_sensor.porta_cantina",
      "unavailable",
      { friendly_name: "Porta cantina", device_class: "door" },
      180,
    ),
    voce(
      "binary_sensor.presenza_salone",
      "on",
      { friendly_name: "Salone", device_class: "occupancy" },
      60,
    ),
    voce(
      "binary_sensor.movimento_cucina",
      "on",
      { friendly_name: "Cucina", device_class: "motion" },
      1,
    ),
    voce(
      "binary_sensor.movimento_corridoio",
      "off",
      { friendly_name: "Corridoio", device_class: "motion" },
      14,
    ),
    voce(
      "binary_sensor.movimento_camera",
      "off",
      { friendly_name: "Camera da letto", device_class: "motion" },
      180,
    ),
    voce("binary_sensor.fumo_cucina", "off", {
      friendly_name: "Fumo cucina",
      device_class: "smoke",
      battery_level: 14,
    }),
    voce("binary_sensor.fumo_salone", "off", {
      friendly_name: "Fumo salone",
      device_class: "smoke",
      battery_level: 78,
    }),
    voce("binary_sensor.gas_cucina", "off", { friendly_name: "Gas cucina", device_class: "gas" }),
    voce("binary_sensor.co_caldaia", "off", {
      friendly_name: "Monossido caldaia",
      device_class: "carbon_monoxide",
    }),
    voce("binary_sensor.perdita_lavatrice", "off", {
      friendly_name: "Perdita lavatrice",
      device_class: "moisture",
      battery_level: 82,
    }),
    voce("binary_sensor.perdita_lavastoviglie", "off", {
      friendly_name: "Perdita lavastoviglie",
      device_class: "moisture",
    }),
    voce("binary_sensor.perdita_bagno", "off", {
      friendly_name: "Perdita bagno",
      device_class: "moisture",
    }),
    voce("valve.acqua_generale", "open", {
      friendly_name: "Valvola generale",
      device_class: "water",
    }),
    voce("sensor.porta_ingresso_batteria", "8", {
      friendly_name: "Sensore porta ingresso Batteria",
      device_class: "battery",
      unit_of_measurement: "%",
    }),
    voce("sensor.termostato_batteria", "41", {
      friendly_name: "Termostato Batteria",
      device_class: "battery",
      unit_of_measurement: "%",
    }),
    voce("sensor.telecomando_batteria", "56", {
      friendly_name: "Telecomando TV Battery",
      device_class: "battery",
      unit_of_measurement: "%",
    }),
    voce("sensor.serratura_batteria", "90", {
      friendly_name: "Serratura Batteria",
      device_class: "battery",
      unit_of_measurement: "%",
    }),
    voce("sensor.valvola_bagno_batteria", "100", {
      friendly_name: "Valvola bagno Batteria",
      device_class: "battery",
      unit_of_measurement: "%",
    }),
    voce("switch.pompa", "unavailable", { friendly_name: "Pompa piscina" }, 130),
    voce("switch.vialetto", "unavailable", { friendly_name: "Luci vialetto" }, 20),
    voce("camera.giardino", "idle", foto("camera.giardino")),
    voce("camera.ingresso", "idle", foto("camera.ingresso")),
    voce("camera.box", "idle", foto("camera.box")),
    voce(
      "binary_sensor.giardino_persona",
      "off",
      { friendly_name: "Persona giardino", device_class: "occupancy" },
      11,
    ),
  ]);
}

/* Un fotogramma qualunque, servito al posto del proxy di Home Assistant. */
const FOTOGRAMMA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><rect width="640" height="400" fill="#8fa6bd"/><rect y="250" width="640" height="150" fill="#5f7350"/><circle cx="438" cy="110" r="62" fill="#3f5a2e"/></svg>`;

async function avvia(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("**/api/camera_proxy/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/svg+xml", body: FOTOGRAMMA }),
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.waitForFunction(() => window.__DASHBOARDMODERN_RUNTIME_ROOT__?.ready === true, null, {
    timeout: 60000,
  });
  await page.evaluate(
    ({ s, prese }) => {
      Object.assign(eval("_RAW_STATES"), s);
      localStorage.setItem("cd_prese", JSON.stringify(prese));
      localStorage.setItem(
        "cd_rilevamenti",
        JSON.stringify({ "camera.giardino": { persona: "binary_sensor.giardino_persona" } }),
      );
      window.applyStates?.();
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
    },
    { s: stati(Date.now()), prese: PRESE },
  );
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.waitForTimeout(900);
}

async function apri(page, chiave) {
  const finestra = page.locator("#dm-widget-popup");
  if (await finestra.isVisible()) {
    await page.locator("#dm-widget-popup [data-dm-widget-close]").first().click();
    await expect(finestra).toBeHidden();
  }
  const tessera = page.locator(`#dm-widgets .dm-tile[data-dm-widget="${chiave}"]`);
  await expect(tessera).toBeVisible();
  await tessera.evaluate((nodo) => nodo.click());
  await expect(finestra).toHaveAttribute("data-dm-popup-of", chiave);
  await expect(finestra.locator(`.dm-f-${chiave}`)).toBeVisible();
  return finestra;
}

/* La foto della finestra intera: la card si allunga quanto il contenuto e si
 * fotografa la pagina, cosi' si vede anche quello che andrebbe scorso. */
async function fotografa(page, chiave, testInfo) {
  const cartella = process.env.FOTO_FINESTRE;
  if (!cartella || testInfo.project.name !== "mobile") return;
  await page.waitForTimeout(600);
  const foglio = await page.addStyleTag({
    content: `#dm-widget-popup{position:absolute!important;inset:0 0 auto 0!important;min-height:100vh;align-items:flex-start!important}
      #dm-widget-popup .dm-widget-detail{max-height:none!important}
      #dm-widget-popup .dm-w-body{overflow:visible!important}`,
  });
  await page.waitForTimeout(300);
  await page
    .locator("#dm-widget-popup .dm-widget-detail")
    .screenshot({ path: `${cartella}/fatta-${chiave}.png`, animations: "disabled" });
  await foglio.evaluate((nodo) => nodo.remove());
}

test("le otto finestre della sicurezza, ognuna col suo disegno", async ({ page }, testInfo) => {
  await avvia(page, testInfo);

  /* L'antifurto: lo stato in grande, i modi a schede col tasto acceso, il
   * disinserimento a parte che dice che chiede il codice, e cosa c'e' aperto. */
  let finestra = await apri(page, "sicurezza");
  await expect(finestra.locator(".dm-f-sicurezza-stato")).toHaveText("Inserito");
  await expect(
    finestra.locator('.dm-f-sicurezza-modo[data-dm-w-alarm="alarm_arm_home"]'),
  ).toHaveAttribute("data-on", "true");
  await expect(finestra.locator(".dm-f-sicurezza-spegni")).toContainText("Chiede il codice");
  await expect(finestra.locator(".dm-f-sicurezza-avviso")).toHaveCount(2);
  await expect(finestra).toContainText("Finestra cucina");
  await expect(finestra).not.toContainText("IN CORSO");
  await fotografa(page, "sicurezza", testInfo);

  /* Le telecamere: il fotogramma grande arriva per la stessa strada di
   * sempre, e le altre stanno in griglia. */
  finestra = await apri(page, "telecamere");
  await expect(finestra.locator(".dm-f-telecamere-big")).toHaveAttribute(
    "data-dm-w-cam",
    "camera.giardino",
  );
  await expect(finestra.locator(".dm-f-telecamere-mini")).toHaveCount(2);
  await expect(finestra.locator(".dm-f-telecamere-big img")).toHaveAttribute(
    "data-dm-camera-state",
    "ready",
    { timeout: 15000 },
  );
  await expect(finestra.locator(".dm-f-telecamere-rileva")).toContainText("Persona");
  await expect(finestra).not.toContainText("Letture");
  await fotografa(page, "telecamere", testInfo);
});

test("varchi, presenza, fumo e allagamenti", async ({ page }, testInfo) => {
  await avvia(page, testInfo);

  let finestra = await apri(page, "varchi");
  await expect(finestra.locator(".dm-f-varchi-eroe .dm-f-varchi-num")).toHaveText("2");
  await expect(finestra.locator(".dm-f-varchi-aperto").first()).toContainText("Finestra cucina");
  await expect(finestra.locator(".dm-f-varchi-aperto").first()).toContainText("47 min");
  await expect(finestra.locator(".dm-f-varchi-ch")).toHaveCount(3);
  await expect(finestra.locator(".dm-f-varchi-muto")).toContainText("Porta cantina");
  /* I nomi dei disegni non si stampano mai come parole. */
  await expect(finestra).not.toContainText(/\b(window|door)\b/);
  await fotografa(page, "varchi", testInfo);

  finestra = await apri(page, "presenza");
  await expect(finestra.locator(".dm-f-presenza-riga")).toContainText("2");
  await expect(finestra.locator('.dm-f-presenza-st[data-on="true"]')).toHaveCount(2);
  await expect(finestra).toContainText("Occupato da 1 h");
  await expect(finestra).not.toContainText("Fermo");
  await fotografa(page, "presenza", testInfo);

  finestra = await apri(page, "fumo");
  await expect(finestra.locator(".dm-f-fumo-eroe")).toContainText("Nessun allarme");
  await expect(finestra.locator(".dm-f-fumo-ril")).toHaveCount(4);
  await expect(finestra.locator('.dm-f-fumo-pila[data-bassa="true"]')).toContainText("14%");
  await fotografa(page, "fumo", testInfo);

  finestra = await apri(page, "allagamenti");
  await expect(finestra.locator(".dm-f-allagamenti-eroe")).toContainText("Tutto asciutto");
  await expect(finestra.locator(".dm-f-allagamenti-sd")).toHaveCount(3);
  await expect(finestra.locator(".dm-f-allagamenti-sd").first()).not.toContainText("Perdita");
  await expect(finestra.locator(".dm-f-allagamenti-valvola [data-dm-w-servizio]")).toContainText(
    "Chiudi",
  );
  await fotografa(page, "allagamenti", testInfo);
});

test("chi non risponde e le batterie", async ({ page }, testInfo) => {
  await avvia(page, testInfo);

  let finestra = await apri(page, "nonrisponde");
  await expect(finestra.locator(".dm-f-nonrisponde-eroe .dm-f-nonrisponde-num")).toHaveText("2");
  /* Dalla piu' lunga: la pompa tace da piu' di due ore. */
  await expect(finestra.locator(".dm-f-nonrisponde-dev").first()).toContainText("Pompa piscina");
  await expect(finestra.locator(".dm-f-nonrisponde-dev").first()).toHaveAttribute(
    "data-lungo",
    "true",
  );
  await expect(finestra.locator(".dm-f-nonrisponde-tasto")).toContainText("Riprova a contattarli");
  await fotografa(page, "nonrisponde", testInfo);

  finestra = await apri(page, "batterie");
  await expect(finestra.locator(".dm-f-batterie-pila[data-giu]")).toHaveCount(1);
  await expect(finestra.locator(".dm-f-batterie-pila[data-giu]")).toContainText(
    "Sensore porta ingresso",
  );
  await expect(finestra.locator(".dm-f-batterie-pila[data-giu]")).not.toContainText("Batteria");
  await expect(finestra.locator(".dm-f-batterie-ok > div")).toHaveCount(2);
  await fotografa(page, "batterie", testInfo);
});
