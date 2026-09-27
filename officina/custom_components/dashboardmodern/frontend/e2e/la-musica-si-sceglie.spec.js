/* Scegliere cosa suonare, sulla plancia vera.
 *
 * «Con Sonos e Music Assistant, dalla plancia non si riesce a scegliere cosa
 * suonare.» La scheda Musica sapeva la pausa, il brano avanti, il volume e la
 * sorgente: tutte cose che si fanno a qualcosa che qualcun altro ha fatto
 * partire. Per accendere la musica si prendeva un altro telefono.
 *
 * Il nucleo si prova senza browser. Qui si pretende quello che si vede e si
 * tocca: il tasto sulla card, la finestra che si apre sulla libreria del
 * lettore, la cartella in cui si entra, il filo per risalire, e il brano che
 * parte davvero — cioe' il «play_media» che arriva a Home Assistant con
 * dentro quello che si e' toccato.
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

const LETTORI = [{ id: "mp1", entity: "media_player.sonos", nome: "Salotto" }];

/* Quello che dichiara un Sonos con Music Assistant dietro: pausa, volume,
 * muto, brano avanti e indietro, sorgente, «play_media», «browse_media» e la
 * coda. E' la somma delle bandiere, ed e' lei a decidere quali tasti la card
 * disegna. */
const SA_SONOS =
  1 + 2 + 4 + 8 + 16 + 32 + 128 + 256 + 1024 + 2048 + 4096 + 16384 + 131072 + 524288 + 2097152;

/* Un televisore: accende, spegne, cambia sorgente, alza il volume. Di libreria
 * niente, e quindi il tasto per sfogliare non deve comparire. */
const SA_TV = 128 + 256 + 2048 + 4;

const stati = (bandiere) => ({
  "media_player.sonos": {
    state: "playing",
    attributes: {
      friendly_name: "Sonos Salotto",
      media_title: "So What",
      media_artist: "Miles Davis",
      supported_features: bandiere,
      volume_level: 0.3,
    },
  },
});

/* La libreria finta, nella forma in cui risponde Home Assistant. La radice ha
 * due cartelle; dentro «Playlist» c'e' una playlist che si apre E si suona, e
 * un brano che si suona soltanto. */
const LIBRERIA = {
  "": {
    media_content_id: "library://",
    media_content_type: "",
    media_class: "directory",
    title: "Libreria",
    can_expand: true,
    can_play: false,
    not_shown: 0,
    children: [
      {
        media_content_id: "library://playlist",
        media_content_type: "playlist",
        media_class: "directory",
        title: "Playlist",
        can_expand: true,
        can_play: false,
      },
      {
        media_content_id: "library://artist",
        media_content_type: "artist",
        media_class: "artist",
        title: "Artisti",
        can_expand: true,
        can_play: false,
      },
      /* Ne' si apre ne' si suona: nell'elenco non ci deve entrare. */
      {
        media_content_id: "library://vuoto",
        title: "Niente da fare",
        can_expand: false,
        can_play: false,
      },
    ],
  },
  "library://playlist": {
    media_content_id: "library://playlist",
    media_content_type: "playlist",
    media_class: "directory",
    title: "Playlist",
    can_expand: true,
    can_play: false,
    not_shown: 12,
    children: [
      {
        media_content_id: "library://playlist/serata",
        media_content_type: "playlist",
        media_class: "playlist",
        title: "Serata",
        can_expand: true,
        can_play: true,
      },
      {
        media_content_id: "library://track/so-what",
        media_content_type: "track",
        media_class: "track",
        title: "So What",
        can_expand: false,
        can_play: true,
      },
    ],
  },
};

async function fingiHomeAssistant(page) {
  await page.addInitScript((libreria) => {
    window.__SERVIZI__ = [];
    window.__SFOGLIATE__ = [];
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
        if (messaggio.type === "media_player/browse_media") {
          window.__SFOGLIATE__.push(messaggio);
          const cartella = libreria[messaggio.media_content_id || ""];
          if (!cartella)
            return this.manda({
              id: messaggio.id,
              type: "result",
              success: false,
              error: { code: "not_found", message: "Media not found." },
            });
          return this.manda({ id: messaggio.id, type: "result", success: true, result: cartella });
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
  }, LIBRERIA);
}

async function apriLaMusica(page, testInfo, bandiere) {
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
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
    { s: stati(bandiere), lettori: LETTORI },
  );
  const voce = page.locator('.tab[data-tab="media"]');
  await expect(voce).toBeVisible();
  await voce.click();
  const card = page.locator('#page-media [data-dm-mp-card="media_player.sonos"]');
  await expect(card).toBeVisible();
  return card;
}

test("dalla libreria del lettore si sceglie, si entra e si fa partire", async ({
  page,
}, testInfo) => {
  const card = await apriLaMusica(page, testInfo, SA_SONOS);

  const sfoglia = card.locator('[data-dm-mp="sfoglia"]');
  await expect(sfoglia).toHaveCount(1);
  await sfoglia.click();

  const finestra = page.locator("#dm-sf-popup");
  await expect(finestra).toBeVisible();
  /* La radice prende il nome che le da' Home Assistant, e la domanda parte
   * senza «media_content_id»: mandarlo vuoto vorrebbe dire «quel contenuto non
   * esiste». */
  await expect(finestra.locator(".dm-sf-dove > strong")).toHaveText("Libreria");
  expect(await page.evaluate(() => window.__SFOGLIATE__[0])).not.toHaveProperty("media_content_id");

  /* Tre figli, due usabili: quello che non si apre e non si suona non e' una
   * riga su cui si puo' fare qualcosa. */
  await expect(finestra.locator(".dm-sf-voce")).toHaveCount(2);
  await expect(finestra.locator(".dm-sf-nome")).toHaveText(["Playlist", "Artisti"]);

  // Si entra nella cartella.
  await finestra.locator(".dm-sf-riga").first().click();
  await expect(finestra.locator(".dm-sf-dove > strong")).toHaveText("Playlist");
  /* Dodici lasciate fuori da Home Assistant: dirlo e' meglio che far credere
   * che la cartella contenga solo questo. */
  await expect(finestra.locator(".dm-sf-nota")).toContainText("12");

  /* Una playlist si apre E si suona: il triangolo accanto e' il solo modo di
   * farla partire intera senza entrarci. Un brano, che si suona e non si apre,
   * parte toccando la riga. */
  await expect(finestra.locator('.dm-sf-voce:has-text("Serata") .dm-sf-tasto')).toHaveCount(2);
  await expect(
    finestra.locator('.dm-sf-voce:has-text("So What") [data-dm-sf="suona"]'),
  ).toHaveCount(1);

  // Il filo per risalire c'e', e riporta alla radice.
  await expect(finestra.locator(".dm-sf-filo > button")).toHaveCount(2);

  // La coda non chiude la finestra: chi mette in coda ne mette tre.
  await finestra.locator('.dm-sf-voce:has-text("Serata") .dm-sf-coda').click();
  await expect(finestra).toBeVisible();
  expect(await page.evaluate(() => window.__SERVIZI__.at(-1))).toMatchObject({
    domain: "media_player",
    service: "play_media",
    service_data: {
      entity_id: "media_player.sonos",
      media_content_id: "library://playlist/serata",
      media_content_type: "playlist",
      enqueue: "add",
    },
  });

  // E il brano parte, e la finestra si chiude perche' la commissione e' finita.
  await finestra.locator('.dm-sf-voce:has-text("So What") .dm-sf-riga').click();
  await expect(finestra).toBeHidden();
  expect(await page.evaluate(() => window.__SERVIZI__.at(-1))).toMatchObject({
    domain: "media_player",
    service: "play_media",
    service_data: {
      entity_id: "media_player.sonos",
      media_content_id: "library://track/so-what",
      media_content_type: "track",
    },
  });
  /* Senza coda, quando non gliel'hanno chiesta. */
  expect(
    await page.evaluate(() => window.__SERVIZI__.at(-1)?.service_data?.enqueue),
  ).toBeUndefined();
});

test("un lettore senza libreria non offre il tasto", async ({ page }, testInfo) => {
  /* Un televisore accende, spegne e cambia sorgente. Un tasto che apre una
   * finestra vuota e' un tasto rotto, e questa scheda i tasti rotti non li
   * disegna: e' la regola scritta nella sua testa. */
  const card = await apriLaMusica(page, testInfo, SA_TV);
  await expect(card.locator('[data-dm-mp="sfoglia"]')).toHaveCount(0);
});
