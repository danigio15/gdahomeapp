/* Il server Proxmox nella pagina MiniPC, per intero.
 *
 * Dal campo: «proxmox non lo aggiunge correttamente: o lo aggiungi come
 * macchina e mi fai vedere tutti i dati, o lo aggiungi come nodi», e «mi devi
 * far vedere più cose per il nodo principale, anche aggiornamenti da fare».
 *
 * La casa e' quella delle foto: Proxmox VE 4.0.2 di HACS, il nodo «pve», la VM
 * di Home Assistant, due container, due dischi NVMe, uno storage; e nella
 * scheda delle macchine le sette righe prese una volta, fra cui le tre morte
 * dell'integrazione di prima («pve_cloudflared · non risponde») e una
 * «Macchina nuova» scritta a mano.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { DISPOSITIVI, ENTITA, MORTE, stati } from "../tests/fixtures/proxmox-pve.js";

const ADESSO = Date.parse("2026-10-25T11:05:00Z");

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

/* Le righe che la scheda aveva gia': le sette prese da Home Assistant. */
const RIGHE = [
  { entity: "binary_sensor.pve_cloudflared", name: "pve_cloudflared", famiglia: "macchine" },
  { entity: "binary_sensor.pve_homeassistant", name: "pve_homeassistant", famiglia: "macchine" },
  {
    entity: "binary_sensor.lxc_cloudflared_101_status",
    name: "LXC cloudflared (101)",
    famiglia: "macchine",
  },
  {
    entity: "binary_sensor.lxc_docker_frigate_102_status",
    name: "LXC docker-frigate (102)",
    famiglia: "macchine",
  },
  {
    entity: "binary_sensor.qemu_homeassistant_100_status",
    name: "QEMU homeassistant (100)",
    famiglia: "macchine",
  },
  { entity: "binary_sensor.nas_online", name: "Macchina nuova", famiglia: "macchine" },
];

function statiConLaCasa() {
  const tutti = {
    ...stati(ADESSO),
    "light.salotto": { state: "off", attributes: { friendly_name: "Salotto" } },
    "binary_sensor.nas_online": {
      state: "on",
      attributes: { device_class: "connectivity", friendly_name: "NAS" },
    },
  };
  return Object.fromEntries(
    Object.entries(tutti).map(([entity_id, s]) => [entity_id, { entity_id, ...s }]),
  );
}

/* Di chi sono: tutto Proxmox, anche le righe morte; il NAS e' del ping. */
function piattaforme() {
  const fuori = { "binary_sensor.nas_online": "ping" };
  for (const righe of Object.values(ENTITA))
    for (const r of righe) fuori[r.entity_id] = "proxmoxve";
  for (const morta of MORTE) fuori[morta] = "proxmoxve";
  return fuori;
}

async function registroFinto(page) {
  await page.addInitScript(
    ({ dispositivi, entita, piattaforme }) => {
      window.__CHIAMATE = [];
      class PonteFinto extends EventTarget {
        readyState = 1;
        onopen = null;
        onmessage = null;
        onclose = null;
        constructor() {
          super();
          queueMicrotask(() => {
            this.onopen?.({});
            this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
          });
        }
        send(grezzo) {
          const messaggio = JSON.parse(grezzo);
          if (messaggio.type === "auth") return;
          let risultato = null;
          if (messaggio.type === "dashboardmodern/integrations/catalog") {
            if (Array.isArray(messaggio.entity_ids))
              risultato = {
                entities: messaggio.entity_ids
                  .filter((entity) => piattaforme[entity])
                  .map((entity) => ({ entity_id: entity, platform: piattaforme[entity] })),
              };
            else if (Array.isArray(messaggio.device_ids))
              risultato = {
                entities: messaggio.device_ids.flatMap((id) => entita[id] || []),
              };
            else
              risultato = {
                integrations: [
                  {
                    domain: "proxmoxve",
                    name: "Proxmox VE",
                    custom: true,
                    devices: 7,
                    entries: [],
                  },
                  { domain: "ping", name: "Ping (ICMP)", custom: false, devices: 1, entries: [] },
                ],
                devices: dispositivi,
                entities: [],
              };
          } else if (messaggio.type === "call_service") {
            window.__CHIAMATE.push([messaggio.domain, messaggio.service, messaggio.service_data]);
            risultato = {};
          }
          queueMicrotask(() =>
            this.onmessage?.({
              data: JSON.stringify({
                id: messaggio.id,
                type: "result",
                success: true,
                result: risultato,
              }),
            }),
          );
        }
        close() {
          this.readyState = 3;
          this.onclose?.({});
        }
      }
      window.__DASHBOARDMODERN_BRIDGE_WS__ = PonteFinto;
      window.WebSocket = PonteFinto;
    },
    { dispositivi: DISPOSITIVI, entita: ENTITA, piattaforme: piattaforme() },
  );
}

async function avvia(page, testInfo, tema = "light") {
  test.setTimeout(150_000);
  await page.clock.install({ time: ADESSO });
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await registroFinto(page);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await expect(page.locator("#cd-boot-overlay")).toHaveCount(0, { timeout: 30_000 });
  await page.evaluate(
    ({ stati, righe, tema }) => {
      document.documentElement.setAttribute("data-theme", tema);
      localStorage.setItem("cd_macchine", JSON.stringify({ integrazioni: ["proxmoxve"], righe }));
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
      const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
      if (raw) Object.assign(raw, stati);
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      window.renderHomeWidgets?.();
    },
    { stati: statiConLaCasa(), righe: RIGHE, tema },
  );
  await page.evaluate(() => document.querySelector('.tab[data-tab="server"]')?.click());
}

const foto = (testInfo, nome) =>
  process.env.DM_FOTO ? `${process.env.DM_FOTO}/${nome}-${testInfo.project.name}.png` : null;

/* Il pezzo della pagina, a pagina allungata quanto serve. */
async function fotoDelPezzo(page, pezzo, dove) {
  if (!dove) return;
  const prima = page.viewportSize();
  const box0 = await pezzo.boundingBox();
  const alta = Math.ceil(box0.y + box0.height + 200);
  await page.setViewportSize({ width: prima.width, height: Math.max(prima.height, alta) });
  await page.waitForTimeout(400);
  const box = await pezzo.boundingBox();
  await page.screenshot({ path: dove, clip: box, animations: "disabled" });
  await page.setViewportSize(prima);
}

for (const tema of ["light", "dark"]) {
  test(`il nodo pve con tutti i suoi dati, gli aggiornamenti, le VM e i container (${tema})`, async ({
    page,
  }, testInfo) => {
    await avvia(page, testInfo, tema);
    const nodo = page.locator("#page-server .dm-px-nodo");
    await expect(nodo).toBeVisible({ timeout: 20_000 });
    await expect(nodo).toContainText("pve");
    await expect(nodo).toContainText("Intel(R) N100");
    /* I numeri del nodo, come nelle foto del pannello di Home Assistant. */
    await expect(nodo).toContainText("14,6%");
    await expect(nodo).toContainText("61%");
    await expect(nodo).toContainText("33,3%");
    await expect(nodo.locator(".dm-px-cifra", { hasText: /VM/ })).toContainText("1");
    await expect(nodo.locator(".dm-px-cifra", { hasText: /Container/ })).toContainText("2");
    await expect(nodo.locator(".dm-px-cifra", { hasText: /Acceso da|Up for/ })).toContainText("21");
    /* Gli aggiornamenti da fare, coi pacchetti a un tocco. */
    const agg = nodo.locator(".dm-px-agg");
    await expect(agg).toHaveAttribute("data-ci", "true");
    await expect(agg).toContainText("118");
    await agg.locator("[data-dm-px-elenco]").click();
    await expect(agg.locator(".dm-px-pacchetti li")).toHaveCount(6);
    await expect(agg).toContainText("pve-manager 8.4.14");
    /* I dischi e lo storage. */
    await expect(nodo.locator(".dm-px-dischi li")).toHaveCount(2);
    await expect(nodo.locator(".dm-px-dischi")).toContainText("41 °C");
    await expect(nodo.locator(".dm-px-storage")).toContainText("local-lvm");
    /* Le VM e i container sotto il nodo, coi loro numeri. */
    const guest = page.locator("#page-server .dm-px-guest");
    await expect(guest).toHaveCount(3);
    await expect(guest.first()).toContainText("homeassistant");
    await expect(
      page.locator("#page-server .dm-px-guest", { hasText: "docker-frigate" }),
    ).toContainText("92,4%");
    /* Le fasce delle macchine non ripetono Proxmox, e le righe morte se ne
     * vanno: resta solo la macchina scritta a mano. */
    const righe = page.locator("#page-server .dm-macchina");
    await expect(righe).toHaveCount(1);
    await expect(righe.first()).toContainText("Macchina nuova");
    await fotoDelPezzo(page, page.locator("#dm-proxmox"), foto(testInfo, `proxmox-${tema}`));
  });
}

test("i tasti premono i pulsanti dell'integrazione, e spegnere chiede prima", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  await expect(page.locator("#page-server .dm-px-nodo")).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => {
    window.__PREMUTI = [];
    window.dmCallHaService = (dominio, servizio, dati) =>
      window.__PREMUTI.push([dominio, servizio, dati?.entity_id]);
  });
  const frigate = page.locator("#page-server .dm-px-guest", { hasText: "docker-frigate" });
  /* Si dice di no alla domanda: non parte niente. */
  page.once("dialog", (d) => d.dismiss());
  await frigate.locator("[data-dm-px-premi]", { hasText: /Spegni|Shut down/ }).click();
  expect(await page.evaluate(() => window.__PREMUTI)).toEqual([]);
  /* Riavviare non chiede. */
  await page
    .locator("#page-server .dm-px-guest", { hasText: "cloudflared" })
    .locator("[data-dm-px-premi]", { hasText: /Riavvia|Reboot/ })
    .click();
  expect(await page.evaluate(() => window.__PREMUTI)).toEqual([
    ["button", "press", "button.lxc_cloudflared_101_reboot"],
  ]);
  /* Spegnere il nodo, detto di si'. */
  page.once("dialog", (d) => d.accept());
  await page
    .locator("#page-server .dm-px-nodo [data-dm-px-premi]", { hasText: /Spegni|Shut down/ })
    .click();
  expect((await page.evaluate(() => window.__PREMUTI)).at(-1)).toEqual([
    "button",
    "press",
    "button.node_pve_shutdown",
  ]);
});
