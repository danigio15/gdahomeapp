/* Lo stato delle apparecchiature di rete da un sensore di Home Assistant (#177).
 *
 * «Ho un sistema di ping esterno che per ogni apparecchio mi dà online,
 * latenza, uptime, pacchetti persi, ultima volta visto.» Lo stato arriva in un
 * `sensor.*` che scrive `up` o `down`, e la fascia Rete diceva «Assente» di un
 * access point che rispondeva; fra le altre letture l'indirizzo IP si leggeva
 * «192».
 *
 * Qui si guarda quello che vede chi ha quel sistema: la pagina Server con la
 * fascia Rete, e nel Config la riga con «Lo stato viene da» — l'automatico che
 * capisce `up`, e «Scelgo io» con un attributo e le parole sue, con la prova
 * dal vivo sotto.
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
    lights: [{ entity: "light.salotto", name: "Salotto" }],
    climate: [],
    ev: [],
    covers: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
  },
  visibility: { home: true, server: true },
};

const ADESSO = new Date().toISOString();

const STATI = {
  "light.salotto": { state: "off", attributes: { friendly_name: "Salotto" } },
  /* Il sistema di ping: un sensore per apparecchio, con `up` e `down`. */
  "sensor.ap_sala_stato": { state: "up", attributes: { friendly_name: "Access point sala stato" } },
  "sensor.ap_sala_latenza": {
    state: "3",
    attributes: { friendly_name: "Access point sala Latenza", unit_of_measurement: "ms" },
  },
  "sensor.ap_sala_ip": {
    state: "192.168.1.20",
    attributes: { friendly_name: "Access point sala IP" },
  },
  "sensor.ap_garage_stato": {
    state: "down",
    attributes: { friendly_name: "Access point garage stato" },
  },
  /* Il NAS lo dice in un attributo: lo stato e' il tempo dell'ultimo giro. */
  "sensor.nas_stato": {
    state: ADESSO,
    attributes: { friendly_name: "NAS stato", raggiungibile: "si", ping_ms: 1.8 },
  },
};

const RIGHE = [
  {
    entity: "sensor.ap_sala_stato",
    name: "Access point sala",
    icon: "router",
    famiglia: "rete",
    letture: ["sensor.ap_sala_latenza", "sensor.ap_sala_ip"],
  },
  {
    entity: "sensor.ap_garage_stato",
    name: "Access point garage",
    icon: "router",
    famiglia: "rete",
  },
  { entity: "sensor.nas_stato", name: "NAS", icon: "server", famiglia: "rete" },
];

async function avvia(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(
    ({ stati, righe }) => {
      localStorage.setItem("cd_macchine", JSON.stringify({ integrazioni: [], righe }));
      const conId = Object.fromEntries(
        Object.entries(stati).map(([entity_id, stato]) => [entity_id, { entity_id, ...stato }]),
      );
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...conId } };
      const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
      if (raw) Object.assign(raw, conId);
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      window.renderHomeWidgets?.();
    },
    { stati: STATI, righe: RIGHE },
  );
}

const riga = (page, nome) => page.locator("#page-server .dm-macchina", { hasText: nome }).first();

async function apriLaPaginaServer(page) {
  await page.evaluate(() => document.querySelector('.tab[data-tab="server"]')?.click());
  await expect(page.locator("#page-server .dm-macchina").first()).toBeVisible({ timeout: 20_000 });
}

async function apriLaRigaNelConfig(page, indice) {
  await page.evaluate(() => {
    window.apriConfigEntita?.();
    window.editorSwitch?.("sez6");
  });
  const blocco = page.locator("#dm-macchine-ed");
  await expect(blocco.locator(".dm-dich-riga")).toHaveCount(3, { timeout: 20_000 });
  await blocco.locator(`[data-dm-dich-apri="${indice}"]`).click();
  return blocco;
}

test("un sensor che vale up è Connesso, in automatico", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await apriLaPaginaServer(page);

  const sala = riga(page, "Access point sala");
  await expect(sala).toHaveAttribute("data-stato", "su");
  await expect(sala.locator(".dm-macchina-stato")).toHaveText(/Connesso|Connected/);
  /* `down` resta giu': l'automatico non e' diventato ottimista. */
  await expect(riga(page, "Access point garage")).toHaveAttribute("data-stato", "giu");
  /* La fascia si chiama ancora Rete, e sotto dice chi manca: il garage — e il
   * NAS, che in automatico guarda uno stato che non e' una parola — ma non la
   * sala. */
  const fascia = page.locator("#page-server .dm-macchine-fascia", { hasText: "Access point" });
  await expect(fascia.locator(".dm-macchine-testa strong")).toHaveText(/Rete|Network/i);
  await expect(fascia.locator(".dm-macchine-testa span")).toContainText("Access point garage");
  await expect(fascia.locator(".dm-macchine-testa span")).not.toContainText("Access point sala");
});

test("fra le altre letture l'indirizzo IP si legge intero", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await apriLaPaginaServer(page);
  const ip = riga(page, "Access point sala").locator(".dm-macchina-lettura", { hasText: "IP" });
  await expect(ip.locator("dd")).toHaveText("192.168.1.20");
  const latenza = riga(page, "Access point sala").locator(".dm-macchina-lettura", {
    hasText: /Latenza/,
  });
  await expect(latenza.locator("dd")).toHaveText("3 ms");
});

test("Scelgo io: un attributo, le parole sue, e la prova dal vivo", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  await apriLaPaginaServer(page);
  /* Il NAS scrive nello stato un orario: per l'automatico e' giu'. */
  await expect(riga(page, "NAS")).toHaveAttribute("data-stato", "giu");

  const blocco = await apriLaRigaNelConfig(page, 2);
  await blocco.locator('[data-dm-macchina-stato-modo="mio"]').click();
  await expect(blocco.locator('[data-dm-macchina-stato-modo="mio"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  /* Cosa guardare: l'attributo, dal menu. */
  await blocco.locator("[data-dm-macchina-stato-attributo]").selectOption("raggiungibile");
  const prova = blocco.locator("[data-dm-macchina-stato-prova]");
  await expect(prova).toContainText("raggiungibile");
  await expect(prova).toContainText("si");
  /* «si» non e' fra le parole di partenza: per ora e' assente. */
  await expect(prova).toHaveAttribute("data-dm-macchina-stato-prova", "giu");

  /* Si aggiunge la parola del suo sistema, e la prova cambia sotto gli occhi. */
  await blocco.locator("[data-dm-macchina-stato-nuova]").fill("Si");
  await blocco.locator("[data-dm-macchina-stato-aggiungi]").click();
  await expect(blocco.locator('[data-dm-macchina-stato-via="si"]')).toBeVisible();
  await expect(prova).toHaveAttribute("data-dm-macchina-stato-prova", "su");
  await expect(prova.locator("b")).toHaveText(/In linea|Online/);

  /* Una parola si toglie con la sua croce. */
  await blocco.locator('[data-dm-macchina-stato-via="on"]').click();
  await expect(blocco.locator('[data-dm-macchina-stato-via="on"]')).toHaveCount(0);

  /* Se vale altro: non risponde. */
  await blocco.locator('[data-dm-macchina-stato-altrimenti="muto"]').click();

  const salvata = await page.evaluate(
    () => JSON.parse(localStorage.getItem("cd_macchine") || "{}").righe[2].stato,
  );
  expect(salvata).toEqual({
    modo: "mio",
    attributo: "raggiungibile",
    inLinea: ["online", "up", "si"],
    altrimenti: "muto",
  });

  /* La didascalia della riga nel Config segue la stessa regola. */
  await expect(blocco.locator(".dm-dich-riga").nth(2).locator(".ed-row-old")).toContainText(
    /· (su|up)$/,
  );

  /* E la pagina dice Connesso. */
  await page.evaluate(() => document.getElementById("editor-modal")?.remove());
  await apriLaPaginaServer(page);
  await expect(riga(page, "NAS")).toHaveAttribute("data-stato", "su");
  await expect(riga(page, "NAS").locator(".dm-macchina-stato")).toHaveText(/Connesso|Connected/);
});

test("Automatico resta il predefinito, e l'aiuto dice dei sensor", async ({ page }, testInfo) => {
  await avvia(page, testInfo);
  const blocco = await apriLaRigaNelConfig(page, 0);
  await expect(blocco.locator('[data-dm-macchina-stato-modo="auto"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(blocco.locator("[data-dm-macchina-stato-attributo]")).toHaveCount(0);
  await expect(blocco.locator("[data-dm-macchina-stato-prova]")).toHaveAttribute(
    "data-dm-macchina-stato-prova",
    "su",
  );
  await expect(blocco.locator(".dm-dich-corpo")).toContainText("sensor.*");
  await expect(blocco.locator(".dm-dich-corpo")).toContainText(/unavailable/);
  /* Nessuna regola scritta per chi non ha toccato niente. */
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("cd_macchine") || "{}").righe[0]),
  ).not.toHaveProperty("stato");
});
