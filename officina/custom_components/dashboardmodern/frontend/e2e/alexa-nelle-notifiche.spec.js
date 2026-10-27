/* «🔊 Alexa»: una sezione del Config tutta sua, con le schede «Notifiche» e
 * «Avvisi personalizzati».
 *
 * Gli Echo sono quelli di Alexa Media Player, riconosciuti da `last_called`;
 * un lettore qualunque non compare. Le scelte si salvano in `cd_alexa`, e
 * senza Echo il riquadro spiega dove si installa l'integrazione.
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

const ECHO = {
  "media_player.echo_cucina": {
    entity_id: "media_player.echo_cucina",
    state: "idle",
    attributes: { friendly_name: "Echo Cucina", last_called: false },
  },
  "media_player.echo_camera": {
    entity_id: "media_player.echo_camera",
    state: "unavailable",
    attributes: { friendly_name: "Echo Camera", last_called: true },
  },
  "cover.garage": {
    entity_id: "cover.garage",
    state: "open",
    attributes: { friendly_name: "Garage" },
  },
  "media_player.tv_sala": {
    entity_id: "media_player.tv_sala",
    state: "off",
    attributes: { friendly_name: "TV Sala" },
  },
};

async function conStati(page, valori) {
  await page.evaluate((valori) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...valori } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, valori);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, valori);
}

async function apriAvvisi(page, scheda = "alexa") {
  await page.evaluate(() => globalThis.apriConfigEntita?.());
  await page.locator(`.ed-tab[data-tab="${scheda}"]`).click();
}

test("gli Echo si scelgono nella scheda Avvisi e la scelta si salva", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await conStati(page, ECHO);
  await apriAvvisi(page);

  const blocco = page.locator("[data-dm-alexa-ed]");
  await expect(blocco).toHaveCount(1, { timeout: 20_000 });
  await expect(blocco.locator("[data-dm-alexa-echo]")).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath("alexa-sezione.png") });
  await expect(blocco).toContainText("Echo Cucina");
  await expect(blocco).not.toContainText("TV Sala");

  await blocco.locator("[data-dm-alexa-attivo]").click();
  await page.locator("[data-dm-alexa-echo='media_player.echo_cucina']").click();
  await page.locator("[data-dm-alexa-categoria='casa']").click();
  const salvata = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_alexa")));
  expect(salvata.attivo).toBe(true);
  expect(salvata.altoparlanti).toEqual(["media_player.echo_cucina"]);
  expect(salvata.categorie).toEqual(["urgenti", "casa"]);

  await expect(page.locator("[data-dm-alexa-prova]")).toBeEnabled();
  await expect(page.locator(".ed-tab.active")).toContainText("Notifiche");
  // La sezione e' sua: la famiglia «Alexa» fra quelle in alto, non dentro
  // gli Avvisi.
  await expect(page.locator('[data-dm-famiglia="alexa"]')).toHaveCount(1);
  await expect(page.locator(".dm-alberatura-titolo, #ed-body h2").first()).toContainText("Alexa");
  await page.screenshot({
    path: testInfo.outputPath("alexa-nelle-notifiche.png"),
    fullPage: false,
  });
  await page.locator("[data-dm-alexa-prova]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("alexa-in-fondo.png") });
});

test("senza Echo il riquadro dice dove si installa Alexa Media Player", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await apriAvvisi(page);
  const blocco = page.locator("[data-dm-alexa-ed]");
  await expect(blocco).toHaveCount(1, { timeout: 20_000 });
  await expect(blocco).toContainText("Alexa Media Player");
  await expect(blocco.locator("[data-dm-alexa-prova]")).toHaveCount(0);
});

test("gli avvisi personalizzati: uno a orario e uno sul garage", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() =>
    localStorage.setItem(
      "cd_alexa",
      JSON.stringify({ attivo: true, altoparlanti: ["media_player.echo_cucina"] }),
    ),
  );
  await conStati(page, ECHO);
  await apriAvvisi(page, "alexa_avvisi");
  const blocco = page.locator("[data-dm-alexa-avvisi]");
  await expect(blocco).toHaveCount(1, { timeout: 20_000 });

  // A un orario, dal lunedi' al venerdi'.
  await blocco.locator("[data-dm-av-nuovo]").click();
  await page.locator("[data-dm-av-frase]").fill("È ora di andare a scuola");
  await page.locator("[data-dm-av-ora]").fill("07:30");
  await page.locator("[data-dm-av-giorno='6']").click();
  await page.locator("[data-dm-av-giorno='0']").click();
  await page.locator("[data-dm-av-salva]").click();

  // Quando il garage resta aperto 10 minuti.
  await blocco.locator("[data-dm-av-nuovo]").click();
  await page.locator("[data-dm-av-frase]").fill("Il garage è aperto");
  await page.locator("[data-dm-av-quando='stato']").click();
  // Il campo lo veste il selettore della plancia («Scegli entità»): si
  // scrive come fa lui, nel campo, con un «change».
  await page.evaluate(() => {
    const campo = document.querySelector("[data-dm-av-entita]");
    campo.value = "cover.garage";
    campo.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.locator("[data-dm-av-valore]").fill("open");
  await page.locator("[data-dm-av-per]").fill("10");
  await expect(page.locator("[data-dm-av-bozza]")).toContainText("open");
  await page.locator("[data-dm-av-salva]").click();

  const salvata = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_alexa")));
  expect(salvata.avvisi).toHaveLength(2);
  expect(salvata.avvisi[0]).toMatchObject({
    frase: "È ora di andare a scuola",
    quando: "orario",
    ora: "07:30",
    giorni: [1, 2, 3, 4, 5],
  });
  expect(salvata.avvisi[1]).toMatchObject({
    quando: "stato",
    entita: "cover.garage",
    condizione: "uguale",
    valore: "open",
    per: 10,
  });
  await expect(blocco).toContainText("Garage è «open» · da almeno 10 min");

  await blocco.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("avvisi-elenco.png") });
  // E com'e' quando se ne scrive uno.
  await blocco.locator("[data-dm-av-apri]").last().click();
  await page.locator("[data-dm-av-bozza]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("avvisi-bozza.png") });
});

/* «🎵 Musica»: spostare sugli Echo quello che suona in casa, o suonare
 * quello che si sceglie. Si guarda cosa arriva a Home Assistant. */
const COPERTINA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f59e0b"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><circle cx="50" cy="50" r="26" fill="#111827"/><circle cx="50" cy="50" r="7" fill="#f9fafb"/></svg>`;

const MUSICA = {
  ...ECHO,
  "media_player.echo_sala": {
    entity_id: "media_player.echo_sala",
    state: "playing",
    attributes: {
      friendly_name: "Echo Sala",
      last_called: false,
      media_title: "Radio Deejay",
      media_channel: "Radio Deejay",
      app_name: "TuneIn",
    },
  },
  "media_player.sonos_soggiorno": {
    entity_id: "media_player.sonos_soggiorno",
    state: "playing",
    attributes: {
      friendly_name: "Sonos Soggiorno",
      media_title: "Albachiara",
      media_artist: "Vasco Rossi",
      app_name: "Spotify",
      entity_picture: "/copertina.png",
    },
  },
};

test("la musica: si sposta sugli Echo e si sceglie cosa ascoltare", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("**/copertina.png", (route) =>
    route.fulfill({ status: 200, contentType: "image/svg+xml", body: COPERTINA }),
  );
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_alexa",
      JSON.stringify({
        altoparlanti: ["media_player.echo_cucina"],
        musica: [{ servizio: "TUNEIN", cosa: "Radio Deejay" }],
      }),
    );
    window.__chiamate = [];
    window.cdCallServiceJson = async (domain, service, data) => {
      window.__chiamate.push({ domain, service, data });
    };
  });
  await conStati(page, MUSICA);
  await apriAvvisi(page, "alexa_musica");
  const blocco = page.locator("[data-dm-alexa-ed]");
  await expect(blocco.locator("[data-dm-mu-vivo]")).toHaveCount(1, { timeout: 20_000 });
  await expect(blocco).toContainText("Albachiara");
  // Di serie non suona su nessun Echo: si sceglie.
  await expect(blocco.locator("[data-dm-mu-echo][aria-pressed='true']")).toHaveCount(0);
  await blocco.locator("[data-dm-mu-echo='media_player.echo_cucina']").click();
  await expect(blocco.locator(".dm-alexa-suona-su")).toContainText("Echo Cucina");
  // Gli Echo che suonano non sono «in casa»: stanno sotto, con i loro tasti.
  await expect(blocco.locator("[data-dm-mu-sposta]")).toHaveCount(1);
  await expect(blocco.locator("[data-dm-mu-tasto='pausa']")).toHaveCount(1);
  await blocco.locator("[data-dm-mu-echo]").first().scrollIntoViewIfNeeded();
  await page.evaluate(() =>
    document.querySelector("[data-dm-alexa-ed]")?.scrollIntoView({ block: "start" }),
  );
  await page.screenshot({ path: testInfo.outputPath("alexa-musica.png") });
  await page.locator("[data-dm-mu-vivo]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("alexa-musica-adesso.png") });

  await blocco.locator("[data-dm-mu-sposta='media_player.sonos_soggiorno']").click();
  let chiamate = await page.evaluate(() => window.__chiamate);
  expect(chiamate).toEqual([
    {
      domain: "media_player",
      service: "play_media",
      data: {
        entity_id: ["media_player.echo_cucina"],
        media_content_id: "Albachiara Vasco Rossi",
        media_content_type: "SPOTIFY",
      },
    },
    {
      domain: "media_player",
      service: "media_pause",
      data: { entity_id: "media_player.sonos_soggiorno" },
    },
  ]);

  await page.locator("[data-dm-mu-servizio='SPOTIFY']").click();
  await page.locator("[data-dm-mu-cosa]").fill("Top 50 Italia");
  await page.locator("[data-dm-mu-cosa]").press("Enter");
  chiamate = await page.evaluate(() => window.__chiamate);
  expect(chiamate.at(-1).data).toEqual({
    entity_id: ["media_player.echo_cucina"],
    media_content_id: "Top 50 Italia",
    media_content_type: "SPOTIFY",
  });
  await page.locator("[data-dm-mu-tieni]").click();
  const salvata = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_alexa")));
  expect(salvata.musica).toEqual([
    { servizio: "TUNEIN", cosa: "Radio Deejay" },
    { servizio: "SPOTIFY", cosa: "Top 50 Italia" },
  ]);
  await page.locator("[data-dm-mu-cosa]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("alexa-musica-cerca.png") });
});
