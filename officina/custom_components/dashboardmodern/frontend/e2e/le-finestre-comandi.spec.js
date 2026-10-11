/* Le finestre del gruppo «comandi», dentro un browser vero.
 *
 * Le prove a tavolino (`tests/le-finestre-comandi.test.js`) dicono che il
 * disegno e' giusto. Qui si guarda che toccando la tessera in Home si apra la
 * finestra nuova e non quella generica — niente «Le misure», niente «Lo
 * stato» —, che i tasti ci siano, e che il garage aperto non stia sotto la
 * scritta «Tutto chiuso».
 *
 * Con `FOTO_FINESTRE=<cartella>` ogni prova fotografa la sua finestra:
 * servono a confrontarla con la bozza approvata.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const STANZE = [
  { id: "room-salone", name: "Salone" },
  { id: "room-studio", name: "Studio" },
  { id: "room-cucina", name: "Cucina" },
];

const FINESTRE = [
  { name: "Cucina", entity: "cover.cucina", contact: "binary_sensor.finestra_cucina" },
  { name: "Bagno", contact: "binary_sensor.finestra_bagno" },
  { name: "Salone", entity: "cover.salone", contact: "binary_sensor.finestra_salone" },
  { name: "Studio", entity: "cover.studio" },
  { name: "Camera da letto", entity: "cover.camera", tendaSole: "cover.camera_sole" },
];

const ROBOT = [
  { id: "rb1", name: "Roborock piano terra", entity: "vacuum.terra", room: "room-cucina" },
  { id: "rb2", name: "Roomba piano primo", entity: "vacuum.primo" },
  { id: "rb3", name: "Tagliaerba", entity: "lawn_mower.prato" },
];

const SEME = {
  schema_version: 4,
  sections: {
    rooms: STANZE,
    cameras: [],
    appliances: [],
    loads: [],
    lights: [],
    climate: [],
    ev: [],
    covers: FINESTRE,
    pool: {},
    irrigation: { zones: [] },
    robots: ROBOT,
    energy: {},
    entityOverrides: {},
  },
  visibility: {
    home: true,
    tapparelle: true,
    security: true,
    citofono: true,
    robot: true,
  },
};

const PRESE = [
  {
    name: "TV Salotto",
    entity: "switch.tv_salotto",
    room_id: "room-salone",
    power: "sensor.tv_w",
    icon: "📺",
  },
  { name: "Firestick", entity: "switch.firestick", room_id: "room-salone", icon: "📦" },
  { name: "Stufetta bagno", entity: "switch.stufetta" },
  { name: "Presa giardino", entity: "switch.giardino" },
];

const PORTE = [
  { id: "portone", name: "Portone", entity: "lock.portone", icon: "🚪" },
  { id: "cancello", name: "Cancello", entity: "switch.cancello", icon: "🚧" },
  { id: "garage", name: "Garage", entity: "cover.garage", icon: "🚗" },
  { id: "pedonale", name: "Pedonale", entity: "button.pedonale", icon: "🚶" },
];

const LETTORI = [
  { id: "mp1", entity: "media_player.salotto", nome: "Salotto" },
  { id: "mp2", entity: "media_player.cucina", nome: "Cucina", icona: "📻" },
  { id: "mp3", entity: "media_player.tv_camera", nome: "TV camera", icona: "📺" },
];

const CITOFONO = {
  citofoni: [
    {
      id: "cancello",
      nome: "Cancello",
      apri: "button.cancello",
      campanello: "binary_sensor.citofono_ding",
    },
  ],
  cassette: [
    {
      id: "cassetta",
      nome: "Cassetta",
      posta: "binary_sensor.vallhorn_motion",
      ritiro: "sensor.vallhorn_illuminance",
    },
  ],
};

const fa = (minuti) => new Date(Date.now() - minuti * 60000).toISOString();

const stato = (entity_id, state, attributes = {}, minuti = 30) => ({
  entity_id,
  state,
  last_changed: fa(minuti),
  last_updated: fa(minuti),
  attributes: { friendly_name: entity_id, ...attributes },
});

const STATI = () =>
  Object.fromEntries(
    [
      stato("binary_sensor.finestra_cucina", "on", { device_class: "window" }, 25),
      stato("binary_sensor.finestra_bagno", "on", { device_class: "window" }, 12),
      stato("binary_sensor.finestra_salone", "off", { device_class: "window" }),
      stato("cover.cucina", "open", { current_position: 60, supported_features: 15 }),
      stato("cover.salone", "open", { current_position: 100, supported_features: 15 }),
      stato("cover.studio", "open", { current_position: 100, supported_features: 15 }),
      stato("cover.camera", "closed", { current_position: 0, supported_features: 15 }),
      stato("cover.camera_sole", "closed", { current_position: 0, supported_features: 15 }),
      stato("switch.tv_salotto", "on"),
      stato("sensor.tv_w", "92", { unit_of_measurement: "W", device_class: "power" }),
      stato("switch.firestick", "off"),
      stato("switch.stufetta", "off", {}, 120),
      stato("switch.giardino", "unavailable", {}, 60 * 20),
      stato("lock.portone", "locked", {}, 60 * 14),
      stato("switch.cancello", "off"),
      stato("cover.garage", "open", { device_class: "garage" }, 12),
      stato("button.pedonale", fa(200)),
      stato("media_player.salotto", "playing", {
        media_title: "So What",
        media_artist: "Miles Davis",
        media_album_name: "Kind of Blue",
        app_name: "Spotify",
        media_duration: 562,
        media_position: 143,
        media_position_updated_at: new Date().toISOString(),
        supported_features: 84469,
        volume_level: 0.3,
      }),
      stato("media_player.cucina", "paused", { source: "Radio Deejay", supported_features: 84469 }),
      stato("media_player.tv_camera", "off", { supported_features: 84469 }),
      stato("button.cancello", "unknown"),
      stato("binary_sensor.citofono_ding", "off", { device_class: "occupancy" }, 60 * 20),
      stato("binary_sensor.vallhorn_motion", "off", { device_class: "motion" }, 30),
      stato(
        "sensor.vallhorn_illuminance",
        "0",
        { device_class: "illuminance", unit_of_measurement: "lx" },
        60 * 22,
      ),
      stato(
        "vacuum.terra",
        "cleaning",
        { battery_level: 76, fan_speed: "Turbo", supported_features: 13436 },
        18,
      ),
      stato("vacuum.primo", "docked", { battery_level: 100, supported_features: 13436 }),
      stato("lawn_mower.prato", "docked", { battery_level: 15, supported_features: 7 }),
    ].map((voce) => [voce.entity_id, voce]),
  );

async function avvia(page, testInfo) {
  test.setTimeout(150_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate(
    async ({ stati, finestre, prese, porte, lettori, citofono }) => {
      window.localStorage.setItem("cd_tapparelle", JSON.stringify(finestre));
      window.localStorage.setItem("cd_prese", JSON.stringify(prese));
      window.localStorage.setItem("cd_security_doors", JSON.stringify(porte));
      window.localStorage.setItem("cd_media_player", JSON.stringify(lettori));
      window.__comandi = [];
      window.dmCallHaService = (dominio, servizio, dati) => {
        window.__comandi.push(`${dominio}.${servizio} ${[dati?.entity_id].flat().join(",")}`);
        return Promise.resolve(true);
      };
      window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...stati } };
      const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
      if (raw) Object.assign(raw, stati);
      const shared = await import("/src/sections/shared.js");
      shared.writeJsonIfChanged("cd_citofono", citofono);
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
      window.renderHomeWidgets?.();
    },
    {
      stati: STATI(),
      finestre: FINESTRE,
      prese: PRESE,
      porte: PORTE,
      lettori: LETTORI,
      citofono: CITOFONO,
    },
  );
}

async function apri(page, chiave) {
  const tessera = page.locator(`#dm-widgets .dm-tile[data-dm-widget="${chiave}"]`).first();
  await expect(tessera).toBeVisible({ timeout: 20_000 });
  await tessera.click();
  const finestra = page.locator(`#dm-widget-popup [data-dm-widget-detail="${chiave}"]`);
  await expect(finestra).toBeVisible({ timeout: 10_000 });
  /* La finestra e' quella nuova: niente verdetto e niente caselle generiche. */
  await expect(finestra.locator(".dm-w-body")).not.toContainText("Le misure");
  await expect(finestra.locator(".dm-w-body")).not.toContainText("Lo stato");
  return finestra;
}

async function fotografa(page, finestra, chiave, testInfo) {
  const cartella = process.env.FOTO_FINESTRE;
  if (!cartella || testInfo.project.name !== "mobile") return;
  await page.setViewportSize({ width: 390, height: 2200 });
  await page.waitForTimeout(600);
  await finestra.screenshot({ path: `${cartella}/fatta-${chiave}.png` });
  await page.setViewportSize({ width: 390, height: 844 });
}

test("Finestre e tapparelle: due numeri separati, tasti per tutte e una scheda per stanza", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  const finestra = await apri(page, "tapparelle");
  await expect(finestra.locator(".dm-f-tapparelle-eroe").first()).toContainText("Finestre aperte");
  await expect(finestra.locator(".dm-f-tapparelle-eroe").first()).toContainText("2");
  await expect(finestra.locator(".dm-f-tapparelle-eroe").nth(1)).toContainText("Tapparelle su");
  await expect(finestra.locator(".dm-f-tapparelle-tutte button")).toHaveCount(3);
  await expect(finestra.locator(".dm-f-tapparelle-stanza").first()).toContainText("Cucina");
  await expect(finestra.locator(".dm-f-tapparelle-stanza").first()).toContainText("60% su");
  await fotografa(page, finestra, "tapparelle", testInfo);
  await finestra.locator('[data-dm-w-cover="cover.cucina"][data-svc="close_cover"]').click();
  await expect
    .poll(() => page.evaluate(() => window.__comandi))
    .toContain("cover.close_cover cover.cucina");
});

test("Prese: accese in alto con i watt, la presa che non risponde in fondo", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  const finestra = await apri(page, "prese");
  await expect(finestra.locator(".dm-f-prese-eroe")).toContainText("1");
  await expect(finestra.locator(".dm-f-prese-eroe")).toContainText("92 W");
  await expect(finestra.locator(".dm-f-prese-presa").first()).toContainText("TV Salotto");
  await expect(finestra.locator(".dm-f-prese-presa").last()).toContainText("Presa giardino");
  await expect(finestra.locator(".dm-f-prese-presa").last()).toContainText("Non risponde");
  await expect(finestra.locator("[data-dm-w-light]")).toHaveCount(3);
  await fotografa(page, finestra, "prese", testInfo);
});

test("Apri porte: il garage aperto in cima, e non c'e' scritto «Tutto chiuso»", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  const finestra = await apri(page, "porte");
  await expect(finestra.locator(".dm-f-porte-avviso")).toContainText("Garage");
  await expect(finestra).not.toContainText("Tutto chiuso");
  await expect(finestra.locator(".dm-f-porte-porta")).toHaveCount(4);
  await expect(
    finestra.locator('[data-dm-door="portone"][data-dm-door-gesto="sblocca"]'),
  ).toContainText("Sblocca");
  await expect(finestra.locator(".dm-f-storia")).toContainText("Garage");
  await fotografa(page, finestra, "porte", testInfo);
  /* Il garage aperto si chiude da qui, senza conferma: chiudere non e' il
   * verso pericoloso. */
  await finestra.locator(".dm-f-porte-porta", { hasText: "Garage" }).getByRole("button").click();
  await expect
    .poll(() => page.evaluate(() => window.__comandi))
    .toContain("cover.close_cover cover.garage");
});

test("Musica: in cima quello che suona, coi tasti; le altre casse in righe", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  const finestra = await apri(page, "media");
  await expect(finestra.locator(".dm-f-media-eroe")).toContainText("So What");
  await expect(finestra.locator(".dm-f-media-eroe")).toContainText("Salotto · Spotify");
  await expect(finestra.locator(".dm-f-media-eroe [data-dm-mp]")).toHaveCount(3);
  await expect(finestra.locator(".dm-f-media-cassa")).toHaveCount(2);
  await expect(finestra).not.toContainText("media_player.");
  await fotografa(page, finestra, "media", testInfo);
});

test("Citofono e posta: c'è posta, «L'ho presa» e il cancello con due tocchi", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  const finestra = await apri(page, "citofono");
  await expect(finestra.locator(".dm-f-citofono-eroe").first()).toContainText("C'è posta");
  await expect(finestra.locator("[data-dm-cassetta-presa]")).toBeVisible();
  const cancello = finestra.locator(".dm-f-citofono-apri");
  await expect(cancello).toContainText("Apri il cancello");
  await fotografa(page, finestra, "citofono", testInfo);
  /* Il primo tocco arma, il secondo apre. */
  await cancello.click();
  await expect(cancello).toHaveAttribute("data-dm-w-armato", "true");
  await expect.poll(() => page.evaluate(() => window.__comandi.length)).toBe(0);
});

test("Robot: quello al lavoro in cima con Pausa e Alla base, gli altri con Avvia", async ({
  page,
}, testInfo) => {
  await avvia(page, testInfo);
  const finestra = await apri(page, "robot");
  await expect(finestra.locator(".dm-f-robot-eroe")).toContainText("Roborock piano terra");
  await expect(finestra.locator(".dm-f-robot-eroe")).toContainText("76%");
  await expect(finestra.locator(".dm-f-robot-eroe button")).toHaveCount(2);
  await expect(finestra.locator(".dm-f-robot-robot")).toHaveCount(2);
  await expect(finestra.locator(".dm-f-robot-avvia")).toHaveCount(2);
  await fotografa(page, finestra, "robot", testInfo);
});
