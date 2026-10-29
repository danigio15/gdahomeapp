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

/* RDS e m2o hanno un logo che non arriva (un sito che non c'e' piu'): deve
 * restare il 📻, non un quadratino bianco. */
const svg = (dentro) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${dentro}</svg>`;
/* Loghi disegnati come loghi (scritte, non bollini), per vedere nelle foto
 * che il logo prende il posto della sigla. */
const LOGHI = {
  deejay: svg(
    `<rect width="64" height="64" fill="#fff"/><text x="32" y="38" font-size="15" font-family="Arial Black,Arial" font-weight="900" font-style="italic" fill="#111" text-anchor="middle">DEEJAY</text><rect x="10" y="43" width="44" height="4" fill="#e30613"/>`,
  ),
  rtl: svg(
    `<rect width="64" height="64" fill="#0b1d4d"/><text x="32" y="33" font-size="22" font-family="Arial Black,Arial" font-weight="900" fill="#fff" text-anchor="middle">RTL</text><text x="32" y="52" font-size="15" font-family="Arial" font-weight="700" fill="#ffd200" text-anchor="middle">102.5</text>`,
  ),
  virgin: svg(
    `<rect width="64" height="64" fill="#fff"/><circle cx="32" cy="32" r="28" fill="#e10a0a"/><text x="32" y="39" font-size="17" font-family="Georgia,serif" font-style="italic" font-weight="700" fill="#fff" text-anchor="middle">Virgin</text>`,
  ),
  rdsvero: svg(
    `<rect width="64" height="64" fill="#fff"/><path d="M8 14 L60 10 L54 54 L4 54 Z" fill="#e2412b"/><text x="31" y="40" font-size="24" font-family="Arial Black,Arial" font-weight="900" fill="#fff" text-anchor="middle">RDS</text><text x="30" y="50" font-size="5.2" font-family="Arial" font-weight="700" fill="#fff" text-anchor="middle">100% GRANDI SUCCESSI</text>`,
  ),
  kiss: svg(
    `<rect width="64" height="64" fill="#fff"/><text x="32" y="30" font-size="17" font-family="Arial Black,Arial" font-weight="900" fill="#e6007e" text-anchor="middle">KISS</text><text x="32" y="50" font-size="17" font-family="Arial Black,Arial" font-weight="900" fill="#e6007e" text-anchor="middle">KISS</text>`,
  ),
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
  "media-source://radio_browser/country/IT": {
    title: "Italia",
    children: [
      stazione("it1", "RTL 102.5 Best", "rtl"),
      stazione("it2", "RTL 102.5", "rtl"),
      stazione("it3", "Radio DEEJAY", "deejay"),
      stazione("it4", "Virgin Radio", "virgin"),
      stazione("it5", "Radio Kiss Kiss", "kiss"),
      stazione("it6", "RDS 100% Grandi Successi", "rdsvero"),
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

async function boot(
  page,
  testInfo,
  { tema = "light", preferite = [], stati = STATI, echoScelti = null } = {},
) {
  test.setTimeout(120_000);
  await page.route("https://radio.example/**", (route) => {
    const chiave = route.request().url().split("/").pop().replace(".svg", "");
    if (!LOGHI[chiave]) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: "image/svg+xml", body: LOGHI[chiave] });
  });
  await fingiHomeAssistant(page);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.evaluate(
    ({ s, lettori, preferite, tema, echoScelti }) => {
      document.documentElement.setAttribute("data-theme", tema);
      if (echoScelti)
        window.localStorage.setItem("dm_alexa_musica_echo", JSON.stringify(echoScelti));
      window.__HASS__ = { states: s };
      window.hass = { ...(window.hass || {}), states: s };
      window._RAW_STATES = s;
      window.localStorage.setItem("cd_media_player", JSON.stringify(lettori));
      window.localStorage.setItem("cd_radio", JSON.stringify({ preferite }));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
    },
    { s: stati, lettori: LETTORI, preferite, tema, echoScelti },
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

test("i loghi che non arrivano lasciano il 📻, quelli che arrivano si vedono", async ({
  page,
}, testInfo) => {
  await boot(page, testInfo);
  await page.evaluate(() => globalThis.apriConfigEntita?.());
  await page.locator('.ed-tab[data-tab="media_radio"]').click();
  const scheda = page.locator("[data-dm-radio-ed]");
  await expect(scheda.locator(".dm-radio-ed-trovata")).toHaveCount(6, { timeout: 20_000 });
  const logo = (uuid) =>
    scheda.locator(
      `[data-dm-radio-aggiungi="media-source://radio_browser/${uuid}"] .dm-radio-ed-logo`,
    );
  await expect(logo("a1")).toHaveAttribute("style", /background-image/);
  await expect(logo("a3")).toHaveAttribute("style", /background-image/);
  await page.waitForTimeout(400);
  for (const morta of ["a2", "a6"]) {
    await expect(logo(morta)).not.toHaveAttribute("style", /background-image/);
    expect(await logo(morta).evaluate((el) => getComputedStyle(el).fontSize)).not.toBe("0px");
  }
  await scheda.locator(".dm-radio-ed-trovate").screenshot({
    path: testInfo.outputPath("radio-loghi-che-mancano.png"),
  });
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

test("gli Echo della radio sono quelli scelti in Alexa › Musica", async ({ page }, testInfo) => {
  const stati = {
    ...STATI,
    "media_player.echo_sala": {
      entity_id: "media_player.echo_sala",
      state: "idle",
      attributes: { friendly_name: "Echo Sala", last_called: false },
    },
  };
  await boot(page, testInfo, {
    preferite: PREFERITE,
    stati,
    echoScelti: ["media_player.echo_cucina"],
  });
  await page.locator('.tab[data-tab="media"]').click();
  const radio = page.locator("#page-media [data-dm-radio]");
  await expect(radio).toBeVisible();
  // Il lettore della Musica c'e' sempre; degli Echo solo quello scelto.
  await expect(radio.locator('[data-dm-radio-dove="media_player.sonos"]')).toHaveCount(1);
  await expect(radio.locator('[data-dm-radio-dove="media_player.echo_cucina"]')).toHaveCount(1);
  await expect(radio.locator('[data-dm-radio-dove="media_player.echo_sala"]')).toHaveCount(0);
  await radio.screenshot({ path: testInfo.outputPath("radio-echo-scelti.png") });
});

test("senza una scelta in Alexa › Musica, la radio offre tutti gli Echo", async ({
  page,
}, testInfo) => {
  const stati = {
    ...STATI,
    "media_player.echo_sala": {
      entity_id: "media_player.echo_sala",
      state: "idle",
      attributes: { friendly_name: "Echo Sala", last_called: false },
    },
  };
  await boot(page, testInfo, { preferite: PREFERITE, stati });
  await page.locator('.tab[data-tab="media"]').click();
  const radio = page.locator("#page-media [data-dm-radio]");
  await expect(radio).toBeVisible();
  await expect(radio.locator('[data-dm-radio-dove="media_player.echo_cucina"]')).toHaveCount(1);
  await expect(radio.locator('[data-dm-radio-dove="media_player.echo_sala"]')).toHaveCount(1);
});

test("le radio pronte dal menu: sull'Echo per nome, sul Sonos da Radio Browser", async ({
  page,
}, testInfo) => {
  /* «Io farei un menu a tendina per le radio, gia' preimpostate, senza andare
   * in config a metterle»: nessuna preferita, e il menu c'e' lo stesso. */
  await boot(page, testInfo, { preferite: [] });
  await page.locator('.tab[data-tab="media"]').click();
  const radio = page.locator("#page-media [data-dm-radio]");
  await expect(radio).toBeVisible();
  const apri = radio.locator("[data-dm-radio-tendina]");
  await expect(apri).toBeVisible();
  await page.waitForTimeout(300);
  await radio.screenshot({ path: testInfo.outputPath("radio-pronte.png") });
  await apri.click();
  const pronta = (nome) => radio.locator(".dm-radio-pr", { hasText: nome }).first();
  await expect(radio.locator(".dm-radio-pr")).toHaveCount(20);
  await expect(pronta("RTL 102.5")).toBeVisible();
  /* «Continua a non vedersi le icone delle stazioni radio»: dove Radio
   * Browser ha la radio col suo logo, il logo vero prende il posto del
   * bollino; dove non ce l'ha, resta il bollino con la sigla. */
  const sigla = (nome) => pronta(nome).locator(".dm-radio-pr-sigla");
  await expect(sigla("RTL 102.5")).toHaveAttribute("style", /background-image/);
  await expect(sigla("Radio Deejay")).toHaveAttribute("style", /background-image/);
  await expect(sigla("Radio 105")).not.toHaveAttribute("style", /background-image/);
  await expect(sigla("Radio 105")).toHaveText("105");
  await page.waitForTimeout(300);
  await radio.screenshot({ path: testInfo.outputPath("radio-pronte-aperta.png") });

  /* Sul Sonos: la stessa radio, presa fra quelle italiane di Radio Browser. */
  await pronta("RTL 102.5").click();
  await expect
    .poll(() => page.evaluate(() => window.__SERVIZI__.at(-1)?.service_data))
    .toMatchObject({
      entity_id: "media_player.sonos",
      media_content_id: "media-source://radio_browser/it2",
    });
  /* Scelta la radio, l'elenco si richiude. */
  await expect(radio.locator(".dm-radio-pr")).toHaveCount(0);

  /* Sull'Echo: per nome, a TuneIn. */
  await radio.locator('[data-dm-radio-dove="media_player.echo_cucina"]').click();
  await radio.locator("[data-dm-radio-tendina]").click();
  await pronta("Radio Deejay").click();
  await expect
    .poll(() => page.evaluate(() => window.__SERVIZI__.at(-1)?.service_data))
    .toMatchObject({
      entity_id: "media_player.echo_cucina",
      media_content_id: "Radio Deejay",
      media_content_type: "TUNEIN",
    });
  await expect(radio).toContainText("Radio Deejay · Echo Cucina");
  await radio.screenshot({ path: testInfo.outputPath("radio-pronte-echo.png") });
});

/* #347: «nelle impostazioni ho visto che posso richiamare brani o playlist:
 * sarebbe possibile avere tale box nella sua sezione?». Scelto un Echo, la
 * radio della pagina Musica ha «Cerca e ascolta», coi preferiti di Alexa. */
test("Cerca e ascolta: un brano o una playlist sull'Echo scelto", async ({ page }, testInfo) => {
  await boot(page, testInfo, { preferite: PREFERITE.slice(0, 2) });
  await page.evaluate(() => {
    localStorage.setItem(
      "cd_alexa",
      JSON.stringify({ musica: [{ servizio: "SPOTIFY", cosa: "Top 50 Italia" }] }),
    );
  });
  await page.locator('.tab[data-tab="media"]').evaluate((n) => n.click());
  const radio = page.locator("#page-media [data-dm-radio]");
  await expect(radio).toBeVisible();
  /* Sul Sonos un brano per nome non si cerca: il riquadro non c'e'. */
  await radio.locator('[data-dm-radio-dove="media_player.sonos"]').click();
  await expect(radio.locator("[data-dm-radio-cerca]")).toHaveCount(0);

  await radio.locator('[data-dm-radio-dove="media_player.echo_cucina"]').click();
  const cerca = radio.locator("[data-dm-radio-cerca]");
  await expect(cerca).toBeVisible();
  await cerca.locator('[data-dm-radio-servizio="SPOTIFY"]').click();
  await cerca.locator("[data-dm-radio-cosa]").fill("Vasco Rossi Albachiara");
  await cerca.locator("[data-dm-radio-cosa]").press("Enter");
  await expect
    .poll(() => page.evaluate(() => window.__SERVIZI__.at(-1)?.service_data))
    .toMatchObject({
      entity_id: ["media_player.echo_cucina"],
      media_content_id: "Vasco Rossi Albachiara",
      media_content_type: "SPOTIFY",
    });
  await expect(radio).toContainText("Vasco Rossi Albachiara · Echo Cucina");

  /* Un preferito di Alexa › Musica, con un tocco. */
  await radio.locator('[data-dm-radio-preferito="0"]').click();
  await expect
    .poll(() => page.evaluate(() => window.__SERVIZI__.at(-1)?.service_data))
    .toMatchObject({ media_content_id: "Top 50 Italia", media_content_type: "SPOTIFY" });
  await page.waitForTimeout(300);
  await radio.screenshot({ path: testInfo.outputPath("radio-cerca-e-ascolta.png") });
});
