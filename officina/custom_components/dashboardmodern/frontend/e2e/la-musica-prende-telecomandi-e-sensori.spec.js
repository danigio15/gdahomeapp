/* «I remote. e i sensor. li aggiungi nel config, ma non compaiono.»
 *
 * Nella sezione Musica, sotto il lettore, ci sono «Telecomando», «Altri
 * comandi» e «Altre letture». Un sensore fra le letture si vedeva; un
 * `remote.*` no: fra i comandi l'elenco lo lasciava cadere, e come
 * telecomando compariva solo per le TV di cui la plancia conosce le frecce.
 *
 * Sul telefono, nella scheda Musica: la lettura col suo numero, il
 * telecomando scelto come tasto acceso/spento, e il comando di un
 * telecomando (`remote.ampli:volume_up`) che parte con `remote.send_command`.
 */
import { expect, test } from "@playwright/test";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const seme = {
  schema_version: 4,
  sections: {
    rooms: [{ name: "Sala", icon: "🛋️" }],
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

const LETTORI = [
  {
    id: "mp1",
    entity: "media_player.sala",
    nome: "Sala",
    telecomando: "remote.amplificatore",
    comandi: ["remote.amplificatore:volume_up", "switch.sala_loudness"],
    letture: ["sensor.uscita_sala_livello"],
  },
];

const STATI = {
  "media_player.sala": {
    state: "playing",
    attributes: {
      friendly_name: "Sala",
      media_title: "Brano di prova",
      supported_features: 1 + 4 + 8 + 16384,
      volume_level: 0.4,
    },
  },
  "remote.amplificatore": { state: "off", attributes: { friendly_name: "Amplificatore" } },
  "switch.sala_loudness": { state: "on", attributes: { friendly_name: "Sala Loudness" } },
  "sensor.uscita_sala_livello": {
    state: "-18.5",
    attributes: { friendly_name: "Uscita sala", unit_of_measurement: "dB" },
  },
};

async function fingiHomeAssistant(page) {
  await page.addInitScript(() => {
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
        if (messaggio.type === "call_service") window.__SERVIZI__.push(messaggio);
        return this.manda({ id: messaggio.id, type: "result", success: true, result: [] });
      }
      close() {}
    }
    window.WebSocket = PresaFinta;
  });
}

test("la scheda Musica mostra il sensore, il telecomando e il suo comando", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
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
    { s: STATI, lettori: LETTORI },
  );
  await page.locator('.tab[data-tab="media"]').click();
  const card = page.locator('#page-media [data-dm-mp-card="media_player.sala"]');
  await expect(card).toBeVisible();
  const lettura = card.locator('[data-dm-mp-lettura="sensor.uscita_sala_livello"]');
  await expect(lettura).toContainText("Uscita sala");
  await expect(lettura).toContainText("-18,5 dB");
  const telecomando = card.locator('[data-dm-mp-cmd="remote.amplificatore"]');
  await expect(telecomando).toContainText("Amplificatore");
  await expect(telecomando).toHaveAttribute("aria-pressed", "false");
  const comando = card.locator('[data-dm-mp-cmd="remote.amplificatore:volume_up"]');
  await expect(comando).toContainText("volume_up");
  await expect(card.locator('[data-dm-mp-cmd="switch.sala_loudness"]')).toBeVisible();
  if (process.env.DM_FOTO)
    await page.screenshot({ path: `${process.env.DM_FOTO}/musica-telefono.png`, fullPage: false });
  await comando.click();
  await telecomando.click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__SERVIZI__.map((m) => ({
          domain: m.domain,
          service: m.service,
          data: m.service_data,
        })),
      ),
    )
    .toEqual([
      {
        domain: "remote",
        service: "send_command",
        data: { entity_id: "remote.amplificatore", command: "volume_up" },
      },
      { domain: "remote", service: "toggle", data: { entity_id: "remote.amplificatore" } },
    ]);
});
