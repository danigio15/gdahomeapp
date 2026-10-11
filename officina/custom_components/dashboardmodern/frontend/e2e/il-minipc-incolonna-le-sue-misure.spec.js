/* «Sui widget il mini pc non incolonna bene le scritte.»
 *
 * La tessera del MiniPC legge dieci caselle — CPU, RAM, disco, temperatura,
 * potenza, download, upload, ping, internet, rete raggiungibile — e le mette
 * tutte nel suo modello. Aprendola, in finestra non se ne vedeva NESSUNA delle
 * otto che sono numeri: c'era il verdetto in cima, le due che sono
 * acceso/spento come pastiglie, e basta. RAM e disco si leggevano soltanto
 * perche' la tessera se li porta appiccicati al numero grande, tutti su una
 * riga: «37% RAM 68% · Disco 54%». Cioe' esattamente «non incolonnate».
 *
 * Il motivo era un elenco: `CHIAVI_A_CARTE` dice quali tessere disegnano le
 * loro letture come caselle — glifo, numero, nome, una accanto all'altra — e
 * sono diciannove. Il MiniPC non c'era, e le sue righe hanno la stessa forma
 * di quelle di tutti gli altri.
 *
 * Questa prova guarda la finestra, non l'elenco: chiede che le misure ci siano
 * e che ognuna abbia il suo nome accanto al suo numero.
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
    entityOverrides: {
      "dm.server_cpu": "sensor.cpu",
      "dm.server_ram": "sensor.ram",
      "dm.server_disco": "sensor.disco",
      "dm.server_temperatura_cpu": "sensor.tcpu",
      "dm.server_potenza_raspberry_server": "sensor.watt",
      "dm.server_speedtest_download": "sensor.giu",
      "dm.server_speedtest_upload": "sensor.su",
    },
  },
  visibility: { home: true, server: true },
};

const stato = (id, valore, unita, nome) => ({
  entity_id: id,
  state: String(valore),
  attributes: { friendly_name: nome, ...(unita ? { unit_of_measurement: unita } : {}) },
});

const STATI = {
  "sensor.cpu": stato("sensor.cpu", 37, "%", "CPU"),
  "sensor.ram": stato("sensor.ram", 68, "%", "RAM"),
  "sensor.disco": stato("sensor.disco", 54, "%", "Disco"),
  "sensor.tcpu": stato("sensor.tcpu", 61.4, "°C", "Temperatura CPU"),
  "sensor.watt": stato("sensor.watt", 12.6, "W", "Potenza"),
  "sensor.giu": stato("sensor.giu", 214.7, "Mbit/s", "Download"),
  "sensor.su": stato("sensor.su", 96.3, "Mbit/s", "Upload"),
};

test("la finestra del MiniPC mette le sue letture in colonna, una per casella", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((x) => x.remove()));
  await page.evaluate((stati) => {
    const grezzi = eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    for (const [id, voce] of Object.entries(stati)) {
      if (grezzi) grezzi[id] = voce;
      if (typeof STATES !== "undefined") STATES[id] = voce;
    }
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);

  const tessera = page.locator('#dm-widgets .dm-tile[data-dm-widget="minipc"]').first();
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  await tessera.evaluate((nodo) => nodo.click());

  const finestra = page.locator('[data-dm-widget-detail="minipc"]').first();
  await expect(finestra).toBeVisible();

  /* La finestra adesso e' quella disegnata per il MiniPC (vedi
   * `finestre/sistema.js`): non piu' sette caselle uguali, ma ogni lettura al
   * suo posto — la CPU nell'anello, temperatura e consumo accanto, RAM e disco
   * come barre, la rete in caselle. Quello che questa prova chiedeva resta:
   * ogni lettura c'e', col suo valore, e le caselle stanno in colonna. */
  await expect(finestra.locator(".dm-f-pc-anello")).toContainText("37%");
  await expect(finestra.locator(".dm-f-pc-dx")).toContainText("61,4 °C");
  await expect(finestra.locator(".dm-f-pc-dx")).toContainText("13 W");
  await expect(finestra.locator(".dm-f-pc-quota").filter({ hasText: "RAM" })).toContainText("68%");
  await expect(finestra.locator(".dm-f-pc-quota").filter({ hasText: "Disco" })).toContainText(
    "54%",
  );
  const caselle = finestra.locator(".dm-f-pc-cas");
  await expect(caselle).toHaveCount(2);
  await expect(caselle.first()).toContainText("214,7");
  await expect(caselle.nth(1)).toContainText("96");

  /* E sono incolonnate davvero: le due caselle della rete cominciano alla
   * stessa altezza, una accanto all'altra. Una riga sola di testo — il difetto
   * segnalato — non lo fa. */
  const riquadri = await caselle.evaluateAll((nodi) =>
    nodi.map((n) => {
      const r = n.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top) };
    }),
  );
  expect(riquadri[0].y).toBe(riquadri[1].y);
  expect(riquadri[1].x).toBeGreaterThan(riquadri[0].x);
});
