/* Le icone degli aggiornamenti arrivano dal ponte, anche dentro l'app.
 *
 * Sull'iPhone, nella plancia dell'app, la finestra «Aggiornamenti pendenti»
 * mostrava una lettera per riga — «F», «H», «O», «P» — al posto del segno
 * dell'add-on o dell'integrazione. L'app, nella sua schermata, quelle stesse
 * icone le aveva: stessa domanda al ponte (`ponte/aggiornamenti/logo`), stessi
 * byte.
 *
 * Qui si rifa' la strada della plancia ospitata nell'app, con le due cose che
 * la distinguono dal banco:
 *
 *  - la cucitura dell'app (`app/lib/plancia/cucitura.dart`) lascia cadere quello
 *    che arriva prima del suo `auth_ok`, e l'`auth_ok` lo dice solo quando il
 *    filo verso casa e' su — su un telefono che si riapre, dopo un po';
 *  - un indirizzo `/api/...` letto da un `<img>` non arriva da nessuna parte:
 *    dentro l'app la pagina sta su 127.0.0.1, senza il segno di casa, e i
 *    marchi di fuori non si chiamano. Le immagini dirette si fanno cadere tutte.
 *
 * E le icone devono esserci lo stesso, senza riaprire la finestra.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

/* Un quadratino PNG vero, 1x1: quello che conta e' che il browser lo disegni. */
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const AGGIORNAMENTI = [
  {
    entity_id: "sensor.salone_temperature",
    state: "21.5",
    attributes: { unit_of_measurement: "°C", device_class: "temperature" },
  },
  {
    entity_id: "update.frigate_server",
    state: "on",
    attributes: {
      title: "Frigate Server",
      installed_version: "0.16.1",
      latest_version: "0.16.2",
      /* L'integrazione di Frigate dice la versione nuova ma non la installa:
       * niente bit 1 in `supported_features`, niente tasto. */
      supported_features: 0,
      release_url: "https://github.com/blakeblackshear/frigate/releases",
      entity_picture: "https://brands.home-assistant.io/_/frigate/icon.png",
    },
  },
  {
    entity_id: "update.home_assistant_core_update",
    state: "on",
    attributes: {
      title: "Home Assistant Core",
      installed_version: "2026.10.1",
      latest_version: "2026.10.2",
      supported_features: 23,
      entity_picture: "https://brands.home-assistant.io/homeassistant/icon.png",
    },
  },
  {
    entity_id: "update.home_assistant_operating_system_update",
    state: "on",
    attributes: {
      title: "Home Assistant Operating System",
      installed_version: "16.2",
      latest_version: "16.3",
      supported_features: 23,
      entity_picture: "https://brands.home-assistant.io/homeassistant/icon.png",
    },
  },
  {
    entity_id: "update.proxmox_ve_update",
    state: "on",
    attributes: {
      title: "Proxmox VE",
      installed_version: "3.4.0",
      latest_version: "3.5.0",
      supported_features: 23,
      entity_picture: "/api/hassio/addons/a0d7b954_proxmox/icon",
    },
  },
];

const seme = {
  schema_version: 4,
  sections: {
    rooms: [
      {
        id: "room-salone",
        name: "Salone",
        icon: "mdi:sofa",
        temp: "sensor.salone_temperature",
      },
    ],
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
  visibility: { home: true, temperature: true, temp: true },
};

/* La plancia come la ospita l'app: ogni presa e' una cucitura, che dice
 * `auth_ok` quando il filo e' su e fino ad allora butta quello che riceve. */
async function avviaComeNellApp(page, testInfo, { filoSuDopo = 300, primoNo = false } = {}) {
  const diretti = [];
  page.on("request", (richiesta) => {
    const url = richiesta.url();
    if (/brands\.home-assistant\.io|\/api\/hassio\//.test(url)) diretti.push(url);
  });
  await page.route("https://**", (route) => route.abort());
  await page.route(/\/api\/hassio\//, (route) => route.abort());
  await page.addInitScript(
    ({ stati, png, filoSuDopo, primoNo }) => {
      /* La plancia dell'app (`premesse.dart`) e quella del ponte lo dicono. */
      window.__GDAHOME__ = true;
      window.__dmLoghiChiesti = [];
      window.__dmLoghiCaduti = 0;
      let giaRisposto = new Set();
      class Cucitura {
        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;
        readyState = 0;
        onopen = null;
        onmessage = null;
        onclose = null;
        onerror = null;
        dentro = false;

        constructor() {
          /* La presa si apre subito: il servitore e' sullo stesso telefono. */
          setTimeout(() => {
            this.readyState = 1;
            this.onopen?.({});
          }, 1);
          /* Il filo verso casa arriva dopo. */
          setTimeout(() => {
            if (this.readyState !== 1) return;
            this.dentro = true;
            this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
          }, filoSuDopo);
        }

        rispondi(id, result, ok = true, error = null) {
          setTimeout(() => {
            if (this.readyState !== 1) return;
            this.onmessage?.({
              data: JSON.stringify(
                ok
                  ? { id, type: "result", success: true, result }
                  : { id, type: "result", success: false, error },
              ),
            });
          }, 20);
        }

        send(raw) {
          const message = JSON.parse(raw);
          /* `Cucitura.dallaPagina`: `if (!_dentro ...) return;` */
          if (!this.dentro) {
            if (message.type === "ponte/aggiornamenti/logo") window.__dmLoghiCaduti += 1;
            return;
          }
          if (message.type === "auth") return;
          if (message.type === "get_states") return this.rispondi(message.id, stati);
          if (message.type === "frontend/get_user_data")
            return this.rispondi(message.id, { value: null });
          if (message.type === "ponte/aggiornamenti/logo") {
            window.__dmLoghiChiesti.push(message.entity_id);
            if (primoNo && !giaRisposto.has(message.entity_id)) {
              giaRisposto.add(message.entity_id);
              return this.rispondi(message.id, null, false, {
                code: "ponte_http",
                message: "il filo e' caduto",
              });
            }
            return this.rispondi(message.id, { stato: 200, tipo: "image/png", corpo: png });
          }
          return this.rispondi(message.id, null);
        }

        close() {
          this.readyState = 3;
          this.onclose?.({});
        }
      }
      window.__DASHBOARDMODERN_HOSTED__ = true;
      window.__DASHBOARDMODERN_BRIDGE_WS__ = Cucitura;
      window.WebSocket = Cucitura;
    },
    { stati: AGGIORNAMENTI, png: PNG, filoSuDopo, primoNo },
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page
    .locator("#setup-wizard")
    .evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  await expect(page.locator('#dm-widgets [data-dm-widget="aggiornamenti"]')).toHaveCount(1, {
    timeout: 20_000,
  });
  return diretti;
}

const righe = (page) => page.locator("#dm-widget-popup .dm-w-agg");
const icone = (page) => page.locator("#dm-widget-popup .dm-w-agg-img");

async function disegnate(page) {
  return page
    .locator("#dm-widget-popup .dm-w-agg-img")
    .evaluateAll((nodi) => nodi.filter((nodo) => nodo.complete && nodo.naturalWidth > 0).length);
}

test("dentro l'app le icone arrivano anche se il filo si alza dopo la finestra", async ({
  page,
}, testInfo) => {
  const diretti = await avviaComeNellApp(page, testInfo, { filoSuDopo: 400 });
  await page.locator('#dm-widgets [data-dm-widget="aggiornamenti"]').click();
  await expect(righe(page)).toHaveCount(4);
  await expect(icone(page)).toHaveCount(4, { timeout: 15_000 });
  await expect.poll(() => disegnate(page)).toBe(4);
  await expect(page.locator("#dm-widget-popup .dm-w-agg-iniziale")).toHaveCount(0);
  /* Le domande partite prima della porta sono state buttate, e rimandate. */
  expect(await page.evaluate(() => window.__dmLoghiCaduti)).toBeGreaterThan(0);
  /* Tutti i segni dal ponte, come `data:`: nessun indirizzo diretto, ne' di
   * casa ne' dei marchi di fuori. */
  const sorgenti = await icone(page).evaluateAll((nodi) => nodi.map((nodo) => nodo.src));
  expect(sorgenti.every((src) => src.startsWith("data:image/png;base64,"))).toBe(true);
  expect(diretti).toEqual([]);
});

test("un'icona che non e' arrivata si richiede, e si vede senza riaprire", async ({
  page,
}, testInfo) => {
  await avviaComeNellApp(page, testInfo, { filoSuDopo: 5, primoNo: true });
  await page.locator('#dm-widgets [data-dm-widget="aggiornamenti"]').click();
  await expect(righe(page)).toHaveCount(4);
  await expect(icone(page)).toHaveCount(4, { timeout: 20_000 });
  await expect.poll(() => disegnate(page)).toBe(4);
});

test("aperta per nome, con la tessera tolta dalla Home, le icone arrivano lo stesso", async ({
  page,
}, testInfo) => {
  await avviaComeNellApp(page, testInfo, { filoSuDopo: 5 });
  /* Tolta dalla scheda Widget: in Home non c'e', ma per nome si apre lo
   * stesso (un'azione rapida, l'assistente di casa). */
  await page.evaluate(() => {
    localStorage.setItem("cd_widgets", JSON.stringify({ hidden: ["aggiornamenti"] }));
    window.dmApriTessera("aggiornamenti");
  });
  await expect(page.locator('#dm-widgets [data-dm-widget="aggiornamenti"]')).toHaveCount(0);
  await expect(righe(page)).toHaveCount(4);
  await expect(icone(page)).toHaveCount(4, { timeout: 15_000 });
});

test("Frigate Server non ha il tasto Installa: Home Assistant dice che non si installa", async ({
  page,
}, testInfo) => {
  await avviaComeNellApp(page, testInfo, { filoSuDopo: 5 });
  await page.locator('#dm-widgets [data-dm-widget="aggiornamenti"]').click();
  await expect(righe(page)).toHaveCount(4);
  const frigate = page.locator('#dm-widget-popup [data-dm-w-agg="update.frigate_server"]');
  await expect(frigate.locator("[data-dm-w-update]")).toHaveCount(0);
  await expect(frigate.locator(".dm-w-agg-note")).toHaveCount(1);
  await expect(page.locator("#dm-widget-popup [data-dm-w-update]")).toHaveCount(3);
});
