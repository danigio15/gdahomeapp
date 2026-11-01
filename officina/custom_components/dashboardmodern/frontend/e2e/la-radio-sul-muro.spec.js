/* «In Musica fa uscire anche la radio»: sulla pagina Musica della plancia a
 * muro, accanto a «Scegli», il tasto 📻 Radio apre le stesse radio della
 * pagina Musica — le preferite, poi le italiane pronte — e le fa suonare sul
 * lettore in grande: sull'Echo per nome (TuneIn), sugli altri da Radio
 * Browser. */
import { expect, test } from "@playwright/test";
import { RADIO_PRONTE } from "../src/core/radio.js";
import { apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const STATI = {
  "media_player.sonos_salotto": {
    entity_id: "media_player.sonos_salotto",
    state: "idle",
    attributes: {
      friendly_name: "Sonos Salotto",
      supported_features: 1 + 4 + 8 + 512 + 4096 + 131072,
    },
  },
  "media_player.echo_cucina": {
    entity_id: "media_player.echo_cucina",
    state: "idle",
    attributes: {
      friendly_name: "Echo Cucina",
      last_called: false,
      supported_features: 1 + 4 + 512,
    },
  },
};

const ITALIANE = {
  title: "Italia",
  children: [
    {
      title: "RTL 102.5",
      media_content_id: "media-source://radio_browser/it2",
      media_content_type: "audio/mpeg",
      media_class: "music",
      can_play: true,
      can_expand: false,
      thumbnail: "",
    },
  ],
};

async function fingiHomeAssistant(page) {
  await page.addInitScript((italiane) => {
    window.__SERVIZI_WS__ = [];
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
        if (m.type === "media_source/browse_media" && /country\/IT$/.test(m.media_content_id || ""))
          return this.manda({ id: m.id, type: "result", success: true, result: italiane });
        if (m.type === "call_service") {
          window.__SERVIZI_WS__.push(m);
          return this.manda({ id: m.id, type: "result", success: true, result: {} });
        }
        return this.manda({ id: m.id, type: "result", success: true, result: [] });
      }
      close() {}
    }
    window.WebSocket = PresaFinta;
  }, ITALIANE);
}

/* Le chiamate le raccoglie l'aiuto del muro (`casa-a-muro.js`). */
const suonati = (page) =>
  page.evaluate(() =>
    (window.__SERVIZI__ || []).filter((m) => m.service === "play_media").map((m) => m.data),
  );

test("sul muro, la pagina Musica ha la radio: sull'Echo e sul Sonos", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await fingiHomeAssistant(page);
  await apriLaCasaAMuro(page, testInfo, {
    muro: { attiva: true, pagine: [{ id: "m1", modello: "musica" }] },
    stati: STATI,
    caselle: {
      cd_media_player: [
        { id: "mp1", entity: "media_player.sonos_salotto", nome: "Salotto" },
        { id: "mp2", entity: "media_player.echo_cucina", nome: "Cucina" },
      ],
    },
  });
  const muro = page.locator("#dm-muro");
  await expect(muro).toBeVisible();
  const radio = muro.locator('[data-mu-fa="mp-radio"]');
  await expect(radio).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath("muro-musica.png") });

  /* Il Sonos in grande: la radio la cerca fra quelle di Radio Browser. */
  await radio.click();
  const finestra = muro.locator(".mu-fin-radio");
  await expect(finestra).toBeVisible();
  /* le radio pronte, tutte (nessuna preferita in questa casa) */
  await expect(finestra.locator(".mu-radio-st")).toHaveCount(RADIO_PRONTE.length);
  await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath("muro-radio.png") });
  await finestra.locator('.mu-radio-st[data-mu-radio="RTL 102.5"]').click();
  await expect(finestra).toHaveCount(0);
  await expect
    .poll(async () => (await suonati(page)).at(-1))
    .toMatchObject({
      entity_id: "media_player.sonos_salotto",
      media_content_id: "media-source://radio_browser/it2",
    });

  /* L'Echo in grande: per nome, a TuneIn. */
  await muro.locator('[data-mu-fa="mp-scegli"][data-mu-entita="media_player.echo_cucina"]').click();
  await muro.locator('[data-mu-fa="mp-radio"][data-mu-entita="media_player.echo_cucina"]').click();
  await muro.locator('.mu-radio-st[data-mu-radio="Radio Deejay"]').click();
  await expect
    .poll(async () => (await suonati(page)).at(-1))
    .toMatchObject({
      entity_id: "media_player.echo_cucina",
      media_content_id: "Radio Deejay",
      media_content_type: "TUNEIN",
    });

  /* Sul pannello piccolo la finestra resta leggibile. */
  await page.setViewportSize({ width: 800, height: 480 });
  await muro.locator('[data-mu-fa="mp-radio"]').first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath("muro-radio-4-pollici.png") });
});

/* «Riesci a ottimizzare la plancia a muro su dispositivi da 4 pollici? Non
 * si vede bene.» Sul pannello quadrato da 480 il nome del lettore finiva
 * sotto il tasto «Scegli» e «Radio» e «Gruppo» uscivano dallo schermo. Ora i
 * tasti vanno su una riga loro, solo icone, tutti dentro la carta, e il nome
 * del lettore si legge intero. */
test("sul 4 pollici quadrato la testa del lettore sta tutta nello schermo", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 480, height: 480 });
  await fingiHomeAssistant(page);
  await apriLaCasaAMuro(page, testInfo, {
    muro: { attiva: true, pagine: [{ id: "m1", modello: "musica" }] },
    stati: {
      ...STATI,
      "media_player.sonos_salotto": {
        ...STATI["media_player.sonos_salotto"],
        state: "playing",
        attributes: {
          ...STATI["media_player.sonos_salotto"].attributes,
          supported_features: 1 + 4 + 8 + 16 + 32 + 512 + 2048 + 4096 + 16384 + 131072 + 524288,
          volume_level: 0.21,
          source: "Radio Deejay",
          source_list: ["Radio Deejay", "RTL 102.5", "Playlist cena", "Radio 105"],
          media_title: "Una canzone col titolo lungo",
          media_artist: "Un artista",
          group_members: ["media_player.sonos_salotto"],
        },
      },
      "media_player.sonos_cucina": {
        entity_id: "media_player.sonos_cucina",
        state: "idle",
        attributes: { friendly_name: "Sonos Cucina", supported_features: 1 + 4 + 16384 + 524288 },
      },
    },
    caselle: {
      cd_media_player: [
        { id: "mp1", entity: "media_player.sonos_salotto", nome: "Salotto" },
        { id: "mp3", entity: "media_player.sonos_cucina", nome: "Cucina" },
      ],
    },
  });
  const muro = page.locator("#dm-muro");
  const carta = muro.locator(".mu-mp").first();
  await expect(carta).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: testInfo.outputPath("muro-musica-4-pollici.png") });
  const misure = await carta.evaluate((c) => {
    const r = c.getBoundingClientRect();
    const fuori = [...c.querySelectorAll(".mu-mp-testa button")]
      .map((b) => b.getBoundingClientRect())
      .filter((b) => b.right > r.right + 1 || b.left < r.left - 1 || b.bottom > r.bottom + 1);
    const et = c.querySelector(".mu-mp-dici .mu-et").getBoundingClientRect();
    const sopra = [...c.querySelectorAll(".mu-mp-testa button")]
      .map((b) => b.getBoundingClientRect())
      .filter(
        (b) => b.left < et.right && b.right > et.left && b.top < et.bottom && b.bottom > et.top,
      );
    return {
      fuori: fuori.length,
      sopra: sopra.length,
      righeEt: Math.round(
        et.height / parseFloat(getComputedStyle(c.querySelector(".mu-et")).lineHeight || "16"),
      ),
    };
  });
  expect(misure.fuori, "tasti fuori dalla carta").toBe(0);
  expect(misure.sopra, "tasti sopra il nome del lettore").toBe(0);
  /* Scegli, Radio e Gruppo in colonna, sulla destra */
  const colonna = await carta.evaluate((c) => {
    const b = [...c.querySelectorAll(".mu-mp-lato button")].map((x) => x.getBoundingClientRect());
    const r = c.getBoundingClientRect();
    return {
      n: b.length,
      stessaX: b.every((x) => Math.abs(x.left - b[0].left) < 2),
      aDestra: b.every((x) => x.left > r.left + r.width * 0.7),
    };
  });
  expect(colonna).toEqual({ n: 3, stessaX: true, aDestra: true });
  /* i preferiti del lettore si vedono */
  await expect(carta.locator(".mu-mp-preferiti button").first()).toBeVisible();
  await expect(carta.locator(".mu-mp-preferiti")).toContainText("RTL 102.5");
});
