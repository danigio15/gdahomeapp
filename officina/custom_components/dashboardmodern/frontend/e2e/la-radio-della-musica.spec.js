/* «📻 Radio»: le preferite in cima alla pagina Musica, la scheda nel Config.
 *
 * Home Assistant e' finto: un Sonos configurato nella Musica, un Echo, e
 * l'integrazione Radio Browser che risponde con qualche stazione. Si guarda
 * cosa arriva a Home Assistant quando si tocca una radio: l'id della stazione
 * per il Sonos, il nome a TuneIn per l'Echo.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seme = {
  schema_version: 4,
  sections: {
    rooms: [{ name: "Salotto", icon: "🛋️" }],
    cameras: [],
    appliances: [],
    loads: [],
    climate: [],
    ev: [],
    pool: {},
    irrigation: { zones: [] },
    energy: {},
    entityOverrides: {},
    covers: [],
  },
  visibility: { home: true, media: true },
};

const LETTORI = [{ id: "mp1", entity: "media_player.sonos", nome: "Sonos Salotto" }];

const logo = (colore, lettera) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${colore}"/><text x="32" y="42" font-size="28" font-family="Arial" font-weight="700" fill="#fff" text-anchor="middle">${lettera}</text></svg>`;

const LOGHI = {
  deejay: logo("#111827", "DJ"),
  rds: logo("#dc2626", "RDS"),
  rtl: logo("#2563eb", "RTL"),
  virgin: logo("#e11d48", "V"),
  kiss: logo("#db2777", "K"),
  m2o: logo("#7c3aed", "m2o"),
};

const stazione = (uuid, nome, chiave) => ({
  title: nome,
  media_content_id: `media-source://radio_browser/${uuid}`,
  media_content_type: "audio/mpeg",
  media_class: "music",
  can_play: true,
  can_expand: false,
  thumbnail: `https://radio.example/${chiave}.svg`,
});

const RADIO = {
  "media-source://radio_browser/local": {
    title: "Italia",
    children: [
      stazione("a1", "Radio Deejay", "deejay"),
      stazione("a2", "RDS 100% Grandi Successi", "rds"),
      stazione("a3", "RTL 102.5", "rtl"),
      stazione("a4", "Virgin Radio Italia", "virgin"),
      stazione("a5", "Radio Kiss Kiss", "kiss"),
      stazione("a6", "m2o", "m2o"),
    ],
  },
  "media-source://radio_browser/popular": {
    title: "Popular",
    children: [stazione("p1", "BBC Radio 1", "rtl")],
  },
};

const STATI = {
  "media_player.sonos": {
    entity_id: "media_player.sonos",
    state: "playing",
    attributes: {
      friendly_name: "Sonos Salotto",
      media_title: "Radio Deejay",
      media_content_id: "media-source://radio_browser/a1",
      supported_features: 1 + 4 + 8 + 512 + 4096 + 131072,
      volume_level: 0.3,
    },
  },
  "media_player.echo_cucina": {
    entity_id: "media_player.echo_cucina",
    state: "idle",
    attributes: { friendly_name: "Echo Cucina", last_called: false },
  },
};

async function fingiHomeAssistant(page) {
  await page.addInitScript((radio) => {
    window.__SERVIZI__ = [];
    class PresaFinta extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      constructor() {
        super();
        queueMicrotask(() => {
          this.dispatchEvent(new Event("open"));
          this.onopen?.();
          this.manda({ type: "auth_required", ha_version: "test" });
        });
      }
      manda(valore) {
        const evento = new MessageEvent("message", { data: JSON.stringify(valore) });
        this.dispatchEvent(evento);
        this.onmessage?.(evento);
      }
      send(payload) {
        const messaggio = JSON.parse(payload);
        if (messaggio.type === "auth") return this.manda({ type: "auth_ok", ha_version: "test" });
        if (messaggio.type === "media_source/browse_media") {
          const cartella = radio[messaggio.media_content_id];
          return this.manda(
            cartella
              ? { id: messaggio.id, type: "result", success: true, result: cartella }
              : {
                  id: messaggio.id,
                  type: "result",
                  success: false,
                  error: { code: "not_found", message: "Media not found." },
                },
          );
        }
        if (messaggio.type === "call_service") {
          window.__SERVIZI__.push(messaggio);
          return this.manda({ id: messaggio.id, type: "result", success: true, result: {} });
        }
        return this.manda({ id: messaggio.id, type: "result", success: true, result: [] });
      }
      close() {}
    }
    window.WebSocket = PresaFinta;
  }, RADIO);
}

async function boot(page, testInfo, { tema = "light", preferite = [] } = {}) {
  test.setTimeout(120_000);
  await page.route("https://radio.example/**", (route) => {
    const chiave = route.request().url().split("/").pop().replace(".svg", "");
    return route.fulfill({ status: 200, contentType: "image/svg+xml", body: LOGHI[chiave] || "" });
  });
  await fingiHomeAssistant(page);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.evaluate(
    ({ s, lettori, preferite, tema }) => {
      document.documentElement.setAttribute("data-theme", tema);
      window.__HASS__ = { states: s };
      window.hass = { ...(window.hass || {}), states: s };
      window._RAW_STATES = s;
      window.localStorage.setItem("cd_media_player", JSON.stringify(lettori));
      window.localStorage.setItem("cd_radio", JSON.stringify({ preferite }));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
    },
    { s: STATI, lettori: LETTORI, preferite, tema },
  );
}

const PREFERITE = RADIO["media-source://radio_browser/local"].children.slice(0, 5).map((una) => ({
  nome: una.title,
  id: una.media_content_id,
  tipo: una.media_content_type,
  logo: una.thumbnail,
}));

for (const tema of ["light", "dark"]) {
  test(`la radio nella pagina Musica: sul Sonos e sull'Echo (${tema})`, async ({
    page,
  }, testInfo) => {
    await boot(page, testInfo, { tema, preferite: PREFERITE });
    const voce = page.locator('.tab[data-tab="media"]');
    await expect(voce).toBeVisible();
    await voce.click();
    const radio = page.locator("#page-media [data-dm-radio]");
    await expect(radio).toBeVisible();
    await expect(radio.locator(".dm-radio-st")).toHaveCount(5);
    // Radio Deejay e' quella che il Sonos sta suonando.
    await expect(radio.locator(".dm-radio-st.in-onda")).toContainText("Radio Deejay");
    await page.waitForTimeout(400);
    await page.screenshot({ path: testInfo.outputPath(`radio-pagina-${tema}.png`) });

    await radio.locator('[data-dm-radio-suona="2"]').click();
    expect(await page.evaluate(() => window.__SERVIZI__.at(-1))).toMatchObject({
      domain: "media_player",
      service: "play_media",
      service_data: {
        entity_id: "media_player.sonos",
        media_content_id: "media-source://radio_browser/a3",
        media_content_type: "audio/mpeg",
      },
    });

    // Sull'Echo la radio la cerca TuneIn, per nome.
    await radio.locator('[data-dm-radio-dove="media_player.echo_cucina"]').click();
    await radio.locator('[data-dm-radio-suona="0"]').click();
    expect(await page.evaluate(() => window.__SERVIZI__.at(-1))).toMatchObject({
      service: "play_media",
      service_data: {
        entity_id: "media_player.echo_cucina",
        media_content_id: "Radio Deejay",
        media_content_type: "TUNEIN",
      },
    });
    await page.waitForTimeout(300);
    await radio.screenshot({ path: testInfo.outputPath(`radio-echo-${tema}.png`) });
  });
}

test("nel Config: le radio di Home Assistant, filtrate, fra le preferite", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await page.evaluate(() => globalThis.apriConfigEntita?.());
  await page.locator('.ed-tab[data-tab="media_radio"]').click();
  const scheda = page.locator("[data-dm-radio-ed]");
  await expect(scheda.locator(".dm-radio-ed-trovata")).toHaveCount(6, { timeout: 20_000 });
  await scheda.locator('[data-dm-radio-aggiungi="media-source://radio_browser/a1"]').click();
  await page.locator("[data-dm-radio-filtro]").fill("radio");
  await expect(page.locator("[data-dm-radio-ed] .dm-radio-ed-trovata")).toHaveCount(3);
  await page.locator('[data-dm-radio-aggiungi="media-source://radio_browser/a5"]').click();
  await page.locator("[data-dm-radio-nome]").fill("Radio Italia");
  await page.locator("[data-dm-radio-per-nome]").click();
  const salvate = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_radio")));
  expect(salvate.preferite.map((una) => una.nome)).toEqual([
    "Radio Deejay",
    "Radio Kiss Kiss",
    "Radio Italia",
  ]);
  expect(salvate.preferite[2].id).toBe("");
  await page.locator("[data-dm-radio-filtro]").fill("");
  await page.waitForTimeout(400);
  await page.screenshot({ path: testInfo.outputPath("radio-config.png") });
  await page.locator("[data-dm-radio-ed] .dm-radio-ed-trovate").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("radio-config-cerca.png") });
});

test("Alexa › Musica: la radio si sceglie da un elenco, e torna nella pagina Musica", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo, { tema: "dark" });
  await page.evaluate(() => globalThis.apriConfigEntita?.());
  await page.locator('.ed-tab[data-tab="alexa_musica"]').click();
  const scheda = page.locator("[data-dm-alexa-ed]");
  await expect(scheda.locator(".dm-alexa-suona-su")).toContainText("Scegli almeno un Echo");
  await scheda.locator("[data-dm-mu-echo='media_player.echo_cucina']").click();
  await expect(page.locator(".dm-alexa-suona-su")).toContainText("Echo Cucina");
  await page.locator("[data-dm-mu-servizio='TUNEIN']").click();
  await expect(page.locator(".dm-alexa-stazione")).toHaveCount(6, { timeout: 20_000 });
  await page.locator("[data-dm-mu-cosa]").fill("radio");
  await expect(page.locator(".dm-alexa-stazione")).toHaveCount(3);
  await page.waitForTimeout(400);
  await page.locator("[data-dm-mu-lista]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("alexa-radio-elenco.png") });
  await page.locator('[data-dm-mu-stazione="Radio Kiss Kiss"]').click();
  await expect.poll(() => page.evaluate(() => window.__SERVIZI__.length)).toBeGreaterThan(0);
  const ultima = await page.evaluate(() => window.__SERVIZI__.at(-1));
  expect(ultima).toMatchObject({
    service: "play_media",
    service_data: {
      entity_id: ["media_player.echo_cucina"],
      media_content_id: "Radio Kiss Kiss",
      media_content_type: "TUNEIN",
    },
  });
  // La tiene fra i preferiti di Alexa: compare anche nella pagina Musica.
  await page.locator("[data-dm-mu-tieni]").click();
  await page.evaluate(() => {
    window.chiudiConfigEntita?.();
    document.getElementById("editor-modal")?.classList.remove("open");
  });
  await page.locator('.tab[data-tab="media"]').evaluate((n) => n.click());
  const radio = page.locator("#page-media [data-dm-radio]");
  await expect(radio).toContainText("Radio Kiss Kiss");
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cd_alexa")).musica)).toEqual([
    { servizio: "TUNEIN", cosa: "Radio Kiss Kiss" },
  ]);
});

test("le radio tenute in Alexa › Musica compaiono nella pagina Musica, per cambiarle", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo, { tema: "dark", preferite: PREFERITE.slice(0, 3) });
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_alexa",
      JSON.stringify({ musica: [{ servizio: "TUNEIN", cosa: "Radio Italia" }] }),
    );
    window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
  });
  await page.locator('.tab[data-tab="media"]').evaluate((n) => n.click());
  const radio = page.locator("#page-media [data-dm-radio]");
  await expect(radio.locator(".dm-radio-st")).toHaveCount(4);
  await expect(radio.locator(".dm-radio-st").last()).toContainText("Radio Italia");
  await radio.locator('[data-dm-radio-dove="media_player.echo_cucina"]').click();
  await radio.locator('[data-dm-radio-suona="3"]').click();
  expect(await page.evaluate(() => window.__SERVIZI__.at(-1))).toMatchObject({
    service_data: { entity_id: "media_player.echo_cucina", media_content_id: "Radio Italia" },
  });
  await page.waitForTimeout(300);
  await radio.screenshot({ path: testInfo.outputPath("radio-con-alexa.png") });
});
