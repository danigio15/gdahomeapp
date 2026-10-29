/* «In Musica fa uscire anche la radio»: sulla pagina Musica della plancia a
 * muro, accanto a «Scegli», il tasto 📻 Radio apre le stesse radio della
 * pagina Musica — le preferite, poi le italiane pronte — e le fa suonare sul
 * lettore in grande: sull'Echo per nome (TuneIn), sugli altri da Radio
 * Browser. */
import { expect, test } from "@playwright/test";
import { apriLaCasaAMuro } from "./helpers/casa-a-muro.js";

const STATI = {
  "media_player.sonos_salotto": {
    entity_id: "media_player.sonos_salotto",
    state: "idle",
    attributes: { friendly_name: "Sonos Salotto", supported_features: 1 + 4 + 8 + 512 + 4096 + 131072 },
  },
  "media_player.echo_cucina": {
    entity_id: "media_player.echo_cucina",
    state: "idle",
    attributes: { friendly_name: "Echo Cucina", last_called: false, supported_features: 1 + 4 + 512 },
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
  await expect(finestra.locator(".mu-radio-st")).toHaveCount(20);
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
