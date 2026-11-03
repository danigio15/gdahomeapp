/* Gli Echo di Alexa Devices nel Config «🔊 Alexa» (#376).
 *
 * «C'è modo di far parlare gli Echo con l'integrazione Alexa Devices? Non ho
 * Alexa Media Player e non vorrei metterla.» Senza Alexa Media Player, gli
 * Echo di Alexa Devices — due entita' di notifica ciascuno, «parla» e
 * «annuncio» — compaiono da soli, si scelgono, e per ognuno si sceglie se
 * parla o annuncia. La prova parte con l'entita' scelta, e la chiamata che il
 * ponte ne fa e' `notify.send_message` su quella entita'.
 */
import { expect, test } from "@playwright/test";
import { chiamateAlexa, normalizzaAlexa } from "../src/core/alexa-annunci.js";
import { bootNamespacedDashboard } from "./helpers/namespaced-dashboard.js";

const SEME = {
  schema_version: 4,
  sections: { rooms: [], lights: [], appliances: [], loads: [], covers: [] },
  visibility: { home: true },
};

const notifica = (entity_id, friendly_name) => ({
  entity_id,
  state: "unknown",
  attributes: { friendly_name },
});

const STATI = {
  "notify.echo_dot_cucina_speak": notifica("notify.echo_dot_cucina_speak", "Echo Dot Cucina Speak"),
  "notify.echo_dot_cucina_announce": notifica(
    "notify.echo_dot_cucina_announce",
    "Echo Dot Cucina Announce",
  ),
  "notify.echo_show_sala_speak": notifica("notify.echo_show_sala_speak", "Echo Show Sala Speak"),
  "notify.echo_show_sala_announce": notifica(
    "notify.echo_show_sala_announce",
    "Echo Show Sala Announce",
  ),
  "notify.telegram": notifica("notify.telegram", "Telegram"),
};

test("senza Alexa Media Player gli Echo di Alexa Devices si scelgono, e parlano o annunciano", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://**", (route) => route.fulfill({ status: 200, body: "" }));
  /* Un ponte finto che risponde alla prova e si segna cosa gli arriva. */
  await page.addInitScript(() => {
    class PonteFinto extends EventTarget {
      static OPEN = 1;
      readyState = 1;
      onopen = null;
      onmessage = null;
      constructor() {
        super();
        queueMicrotask(() => {
          this.onopen?.({});
          this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
        });
      }
      send(grezzo) {
        const messaggio = JSON.parse(grezzo);
        if (messaggio.type === "auth") return;
        let risultato = null;
        if (messaggio.type === "get_states") risultato = [];
        else if (messaggio.type === "ponte/alexa/prova") {
          (window.__prove ||= []).push(messaggio);
          risultato = { fatto: true };
        }
        queueMicrotask(() =>
          this.onmessage?.({
            data: JSON.stringify({
              id: messaggio.id,
              type: "result",
              success: true,
              result: risultato,
            }),
          }),
        );
      }
      close() {}
    }
    window.__DASHBOARDMODERN_BRIDGE_WS__ = PonteFinto;
    window.WebSocket = PonteFinto;
  });
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, SEME);
  await page.locator("#setup-wizard").evaluateAll((nodi) => nodi.forEach((n) => n.remove()));
  await page.evaluate((valori) => {
    window.__HASS__ = { states: { ...(window.__HASS__?.states || {}), ...valori } };
    const raw = window.eval("typeof _RAW_STATES !== 'undefined' ? _RAW_STATES : null");
    if (raw) Object.assign(raw, valori);
    window.dispatchEvent(new CustomEvent("dashboardmodern:states-ready", { detail: {} }));
  }, STATI);
  await page.evaluate(() => globalThis.apriConfigEntita?.());
  await page.locator('.ed-tab[data-tab="alexa"]').click();

  const blocco = page.locator("[data-dm-alexa-ed]");
  await expect(blocco).toHaveCount(1, { timeout: 20_000 });
  /* Due Echo, uno per coppia di entita'; Telegram no. */
  const echo = blocco.locator("[data-dm-alexa-echo]");
  await expect(echo).toHaveCount(2);
  await expect(blocco).toContainText("Echo Dot Cucina");
  await expect(blocco).toContainText("Alexa Devices");
  await expect(blocco).not.toContainText("Telegram");
  /* «Annuncio o voce» e' di Alexa Media Player: qui non c'e'. */
  await expect(blocco.locator("[data-dm-alexa-modo]")).toHaveCount(0);

  await blocco.locator("[data-dm-alexa-attivo]").click();
  await page.locator("[data-dm-alexa-echo='notify.echo_dot_cucina_speak']").click();
  await page.locator("[data-dm-alexa-echo='notify.echo_show_sala_speak']").click();
  let salvata = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_alexa")));
  expect(salvata.altoparlanti).toEqual([
    "notify.echo_dot_cucina_speak",
    "notify.echo_show_sala_speak",
  ]);

  /* La Sala annuncia: al suo posto, fra gli scelti, la sua entita' d'annuncio. */
  await page.locator("[data-dm-alexa-voce='notify.echo_show_sala_announce']").click();
  salvata = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_alexa")));
  expect(salvata.altoparlanti).toEqual([
    "notify.echo_dot_cucina_speak",
    "notify.echo_show_sala_announce",
  ]);
  await expect(page.locator("[data-dm-alexa-echo='notify.echo_show_sala_speak']")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator(".dm-alexa-voci").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("alexa-devices-scelta.png") });

  /* La prova parte con le entita' scelte, e il ponte ne fa send_message. */
  await page.locator("[data-dm-alexa-prova]").click();
  await expect
    .poll(() => page.evaluate(() => (window.__prove || []).length), { timeout: 10_000 })
    .toBe(1);
  const [prova] = await page.evaluate(() => window.__prove);
  expect(prova.altoparlanti).toEqual(salvata.altoparlanti);
  expect(chiamateAlexa(normalizzaAlexa(salvata), "Prova", prova.altoparlanti)).toEqual([
    {
      type: "call_service",
      domain: "notify",
      service: "send_message",
      service_data: {
        entity_id: ["notify.echo_dot_cucina_speak", "notify.echo_show_sala_announce"],
        message: "Prova",
      },
    },
  ]);
  await expect(blocco).toContainText(/Inviato|Sent/);
  await page.locator("[data-dm-alexa-prova]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("alexa-devices-prova.png") });

  /* Toccato di nuovo, l'Echo della Sala esce tutto, qualunque voce avesse. */
  await page.locator("[data-dm-alexa-echo='notify.echo_show_sala_speak']").click();
  salvata = await page.evaluate(() => JSON.parse(localStorage.getItem("cd_alexa")));
  expect(salvata.altoparlanti).toEqual(["notify.echo_dot_cucina_speak"]);
});
