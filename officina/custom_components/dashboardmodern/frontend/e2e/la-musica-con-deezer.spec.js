/* Deezer nella Musica, sulla plancia vera.
 *
 * «Usano Deezer e cartelle locali, e hanno Sonos.» In Home Assistant Deezer
 * arriva da due strade: dai preferiti di Sonos — quello che si salva nell'app
 * di Sonos torna fra i «Favorites» del lettore — e da Music Assistant col
 * fornitore Deezer, che sa anche cercare. Le cartelle locali sono la «Music
 * Library» di Sonos.
 *
 * Qui si pretende quello che si vede e si tocca: le due cartelle di Sonos che
 * prima sparivano (id vuoto), il segno «Deezer» sulle playlist, il «play_media»
 * col preferito giusto; il campo per cercare solo su chi sa cercare, e la
 * ricerca che arriva a Home Assistant; e dal pannello a muro la stessa
 * finestra, sopra il pannello.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";
import { apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

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

/* Sonos: pausa, volume, muto, brani, sorgente, play_media, browse_media,
 * gruppo e coda. Niente ricerca: Sonos da solo non cerca. */
const SA_SONOS =
  1 + 2 + 4 + 8 + 16 + 32 + 128 + 256 + 1024 + 2048 + 4096 + 16384 + 131072 + 524288 + 2097152;
/* Music Assistant: lo stesso, piu' «SEARCH_MEDIA». */
const SA_MUSIC_ASSISTANT = SA_SONOS + 4194304;

const copertina = (nome) =>
  `https://e-cdns-images.dzcdn.net/images/cover/${nome}/250x250-000000-80-0-0.jpg`;

const STATI = {
  "media_player.sonos_salotto": {
    state: "paused",
    attributes: {
      friendly_name: "Sonos Salotto",
      media_title: "Flow",
      media_artist: "Deezer",
      supported_features: SA_SONOS,
      volume_level: 0.28,
      source_list: ["Flow", "Jazz Classics", "Radio Deejay"],
    },
  },
  "media_player.ma_salotto": {
    state: "idle",
    attributes: {
      friendly_name: "Salotto (Music Assistant)",
      supported_features: SA_MUSIC_ASSISTANT,
      volume_level: 0.28,
    },
  },
};

/* L'albero come lo manda Home Assistant: per Sonos la radice ha due cartelle
 * con l'id vuoto; per Music Assistant una cartella per fornitore. La chiave e'
 * «tipo|id», perche' con Sonos l'id da solo non distingue. */
const ALBERO = {
  "media_player.sonos_salotto": {
    "|": {
      title: "Sonos",
      media_content_id: "",
      media_content_type: "root",
      can_expand: true,
      children: [
        {
          title: "Favorites",
          media_class: "directory",
          media_content_id: "",
          media_content_type: "favorites",
          can_expand: true,
          can_play: false,
        },
        {
          title: "Music Library",
          media_class: "directory",
          media_content_id: "",
          media_content_type: "library",
          can_expand: true,
          can_play: false,
        },
      ],
    },
    "favorites|": {
      title: "Favorites",
      media_content_id: "",
      media_content_type: "favorites",
      can_expand: true,
      children: [
        {
          title: "Playlists",
          media_class: "directory",
          media_content_id: "object.container.playlistContainer",
          media_content_type: "favorites_folder",
          can_expand: true,
        },
        {
          title: "Radio",
          media_class: "directory",
          media_content_id: "object.item.audioItem.audioBroadcast",
          media_content_type: "favorites_folder",
          can_expand: true,
        },
      ],
    },
    "favorites_folder|object.container.playlistContainer": {
      title: "Playlists",
      media_content_id: "object.container.playlistContainer",
      media_content_type: "favorites_folder",
      can_expand: true,
      children: [
        ["Flow", "FV:2/12", "flow"],
        ["Jazz Classics", "FV:2/13", "jazz"],
        ["Top Italia", "FV:2/14", "italia"],
        ["Serata a casa", "FV:2/15", "serata"],
      ].map(([title, id, nome]) => ({
        title,
        media_class: "playlist",
        media_content_id: id,
        media_content_type: "favorite_item_id",
        thumbnail: copertina(nome),
        can_play: true,
        can_expand: false,
      })),
    },
    "library|": {
      title: "Music Library",
      media_content_id: "",
      media_content_type: "library",
      can_expand: true,
      children: [
        ["Artisti", "A:ALBUMARTIST", "album_artist"],
        ["Album", "A:ALBUM", "album"],
        ["Cartelle", "S:", "share"],
      ].map(([title, id, tipo]) => ({
        title,
        media_class: "directory",
        media_content_id: id,
        media_content_type: tipo,
        can_expand: true,
      })),
    },
  },
  "media_player.ma_salotto": {
    "|": {
      title: "Music Assistant",
      media_content_id: "",
      media_content_type: "root",
      can_expand: true,
      children: [
        {
          title: "Deezer",
          media_class: "directory",
          media_content_id: "deezer--Ab12",
          media_content_type: "folder",
          can_expand: true,
        },
        {
          title: "Musica di casa",
          media_class: "directory",
          media_content_id: "filesystem_local--Cd34",
          media_content_type: "folder",
          can_expand: true,
        },
      ],
    },
  },
};

const RISULTATI = {
  version: 1,
  result: [
    {
      title: "So What",
      media_class: "track",
      media_content_id: "deezer://track/3135556",
      media_content_type: "track",
      thumbnail: copertina("kind-of-blue"),
      can_play: true,
    },
    {
      title: "Kind of Blue",
      media_class: "album",
      media_content_id: "deezer://album/302127",
      media_content_type: "album",
      thumbnail: copertina("kind-of-blue"),
      can_play: true,
      can_expand: true,
    },
    {
      title: "Miles Davis",
      media_class: "artist",
      media_content_id: "deezer://artist/1879",
      media_content_type: "artist",
      thumbnail: copertina("miles"),
      can_expand: true,
    },
    {
      title: "Blue in Green",
      media_class: "track",
      media_content_id: "deezer://track/3135558",
      media_content_type: "track",
      thumbnail: copertina("kind-of-blue"),
      can_play: true,
    },
  ],
};

/* Le copertine di Deezer, disegnate qui: niente rete nelle prove. */
const COLORI = ["#a238ff", "#ef5466", "#22c55e", "#0ea5e9", "#f59e0b"];
async function copertineFinte(page) {
  await page.route("https://e-cdns-images.dzcdn.net/**", (route) => {
    const nome = route.request().url().split("/cover/")[1]?.split("/")[0] || "x";
    const i = [...nome].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORI.length;
    const j = (i + 2) % COLORI.length;
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="250" height="250"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${COLORI[i]}"/><stop offset="1" stop-color="${COLORI[j]}"/></linearGradient></defs><rect width="250" height="250" fill="url(#g)"/><circle cx="125" cy="125" r="46" fill="#fff" opacity=".22"/></svg>`,
    });
  });
}

async function fingiHomeAssistant(page) {
  await page.addInitScript(
    ({ albero, risultati }) => {
      window.__SERVIZI_WS__ = [];
      window.__DOMANDE__ = [];
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
          const m = JSON.parse(payload);
          if (m.type === "auth") return this.manda({ type: "auth_ok", ha_version: "test" });
          if (m.type === "media_player/browse_media") {
            window.__DOMANDE__.push(m);
            const chiave = `${m.media_content_type || ""}|${m.media_content_id || ""}`;
            const cartella = albero[m.entity_id]?.[chiave];
            if (!cartella)
              return this.manda({
                id: m.id,
                type: "result",
                success: false,
                error: { code: "not_found", message: "Media not found." },
              });
            return this.manda({ id: m.id, type: "result", success: true, result: cartella });
          }
          if (m.type === "media_player/search_media") {
            window.__DOMANDE__.push(m);
            return this.manda({ id: m.id, type: "result", success: true, result: risultati });
          }
          if (m.type === "call_service") {
            window.__SERVIZI_WS__.push(m);
            return this.manda({ id: m.id, type: "result", success: true, result: {} });
          }
          return this.manda({ id: m.id, type: "result", success: true, result: [] });
        }
        close() {}
      }
      window.WebSocket = PresaFinta;
    },
    { albero: ALBERO, risultati: RISULTATI },
  );
}

async function apriLaMusica(page, testInfo, lettori) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  await copertineFinte(page);
  await fingiHomeAssistant(page);
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, seme);
  await page.evaluate(
    ({ s, lettori }) => {
      window.__HASS__ = { states: s };
      window.hass = { ...(window.hass || {}), states: s };
      window._RAW_STATES = s;
      window.localStorage.setItem("cd_media_player", JSON.stringify(lettori));
      window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready"));
      window.dispatchEvent(new CustomEvent("dashboardmodern:state-changed"));
    },
    { s: STATI, lettori },
  );
  await page.locator('.tab[data-tab="media"]').click();
}

const foto = async (page, nome) => {
  if (!process.env.DM_FOTO) return;
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${process.env.DM_FOTO}/${nome}.png` });
};

const suonati = (page) =>
  page.evaluate(() =>
    window.__SERVIZI_WS__
      .filter((m) => m.service === "play_media")
      .map((m) => m.service_data || m.data),
  );

test.describe("Deezer nella Musica", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("con Sonos: i preferiti con le playlist di Deezer e la libreria di casa", async ({
    page,
  }, testInfo) => {
    await apriLaMusica(page, testInfo, [
      { id: "mp1", entity: "media_player.sonos_salotto", nome: "Salotto" },
    ]);
    const card = page.locator('#page-media [data-dm-mp-card="media_player.sonos_salotto"]');
    await expect(card).toBeVisible();
    await card.locator('[data-dm-mp="sfoglia"]').click();
    const finestra = page.locator("#dm-sf-popup");
    await expect(finestra).toBeVisible();
    /* Le due cartelle di Sonos ci sono, anche con l'id vuoto. */
    await expect(finestra.locator(".dm-sf-nome")).toHaveText([
      "Preferiti di Sonos",
      "Libreria e cartelle di casa",
    ]);
    /* Sonos da solo non cerca: il campo non c'e'. */
    await expect(finestra.locator("[data-dm-sf-cerca]")).toHaveCount(0);

    await finestra.locator(".dm-sf-riga", { hasText: "Preferiti di Sonos" }).click();
    await finestra.locator(".dm-sf-riga", { hasText: "Playlists" }).click();
    await expect(finestra.locator(".dm-sf-deezer")).toHaveCount(4);
    await foto(page, "deezer-sonos-preferiti");
    expect(
      await page.evaluate(() =>
        window.__DOMANDE__.map((d) => [d.media_content_type ?? null, d.media_content_id ?? null]),
      ),
    ).toEqual([
      [null, null],
      ["favorites", ""],
      ["favorites_folder", "object.container.playlistContainer"],
    ]);

    await finestra.locator(".dm-sf-riga", { hasText: "Jazz Classics" }).click();
    await expect(finestra).toBeHidden();
    await expect
      .poll(() => suonati(page))
      .toEqual([
        {
          entity_id: "media_player.sonos_salotto",
          media_content_id: "FV:2/13",
          media_content_type: "favorite_item_id",
        },
      ]);

    /* E le cartelle di casa, dalla libreria di Sonos. */
    await card.locator('[data-dm-mp="sfoglia"]').click();
    await finestra.locator(".dm-sf-riga", { hasText: "Libreria e cartelle" }).click();
    await expect(finestra.locator(".dm-sf-nome")).toHaveText(["Artisti", "Album", "Cartelle"]);
    await foto(page, "deezer-sonos-libreria");
  });

  test("con Music Assistant: si cerca dentro Deezer e si fa partire", async ({
    page,
  }, testInfo) => {
    await apriLaMusica(page, testInfo, [
      { id: "mp2", entity: "media_player.ma_salotto", nome: "Salotto" },
    ]);
    const card = page.locator('#page-media [data-dm-mp-card="media_player.ma_salotto"]');
    await expect(card).toBeVisible();
    await card.locator('[data-dm-mp="sfoglia"]').click();
    const finestra = page.locator("#dm-sf-popup");
    await expect(
      finestra.locator(".dm-sf-riga", { hasText: "Deezer" }).locator(".dm-sf-deezer"),
    ).toBeVisible();
    const campo = finestra.locator("[data-dm-sf-cerca] input");
    await expect(campo).toBeVisible();
    await foto(page, "deezer-music-assistant-radice");

    await campo.fill("miles davis");
    await campo.press("Enter");
    await expect(finestra.locator(".dm-sf-nome")).toHaveText([
      /Kind of Blue/,
      /Miles Davis/,
      /So What/,
      /Blue in Green/,
    ]);
    await expect(finestra.locator(".dm-sf-deezer")).toHaveCount(4);
    /* Il testo resta nel campo, e il filo dice cosa si e' cercato. */
    await expect(campo).toHaveValue("miles davis");
    await expect(finestra.locator(".dm-sf-dove strong")).toHaveText("«miles davis»");
    await foto(page, "deezer-music-assistant-ricerca");
    expect(
      await page.evaluate(() =>
        window.__DOMANDE__.filter((d) => d.type === "media_player/search_media"),
      ),
    ).toEqual([
      expect.objectContaining({
        type: "media_player/search_media",
        entity_id: "media_player.ma_salotto",
        search_query: "miles davis",
      }),
    ]);

    await finestra.locator(".dm-sf-riga", { hasText: "So What" }).click();
    await expect
      .poll(() => suonati(page))
      .toEqual([
        {
          entity_id: "media_player.ma_salotto",
          media_content_id: "deezer://track/3135556",
          media_content_type: "track",
        },
      ]);
  });
});

test("dal pannello a muro: «Scegli» apre la stessa finestra, sopra il pannello", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await copertineFinte(page);
  await fingiHomeAssistant(page);
  await apriLaCasaAMuro(page, testInfo, {
    muro: { attiva: true, pagine: [{ id: "m1", modello: "musica" }] },
    stati: STATI,
    caselle: {
      cd_media_player: [{ id: "mp1", entity: "media_player.sonos_salotto", nome: "Salotto" }],
    },
  });
  await copertineFinte(page);
  const muro = page.locator("#dm-muro");
  await expect(muro).toBeVisible();
  const scegli = muro.locator('[data-mu-fa="mp-scegli-musica"]');
  await expect(scegli).toBeVisible();
  await foto(page, "deezer-muro-scegli");
  await scegli.click();
  const finestra = page.locator("#dm-sf-popup");
  await expect(finestra).toBeVisible();
  await finestra.locator(".dm-sf-riga", { hasText: "Preferiti di Sonos" }).click();
  await finestra.locator(".dm-sf-riga", { hasText: "Playlists" }).click();
  await expect(finestra.locator(".dm-sf-deezer")).toHaveCount(4);
  await foto(page, "deezer-muro-finestra");
  /* Sopra il pannello davvero: il tocco arriva alla finestra, non al muro. */
  await finestra.locator(".dm-sf-riga", { hasText: "Flow" }).click();
  await expect(finestra).toBeHidden();
  await expect(muro).toBeVisible();
  /* Sul pannello piccolo il tasto resta, col solo disegno. */
  await page.setViewportSize({ width: 800, height: 480 });
  await expect(scegli).toBeVisible();
  await foto(page, "deezer-muro-4-pollici");
});
