/* Gli Echo di Alexa Devices, l'integrazione che Home Assistant ha di suo (#376).
 *
 * «C'è modo di far parlare gli Echo con l'integrazione Alexa Devices? Non ho
 * Alexa Media Player e non vorrei metterla.» Alexa Devices non da' lettori ma
 * due entita' di notifica per Echo, «parla» e «annuncio», che si chiamano con
 * `notify.send_message`. Qui si tiene fermo come si riconoscono, come si
 * mettono insieme quelle di uno stesso Echo e che chiamate partono.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  avvisoPulito,
  chiamateAlexa,
  echoDiAlexaDevices,
  echoPerLeNotifiche,
  entitaDegliEcho,
  normalizzaAlexa,
  voceDiAlexaDevices,
} from "../src/core/alexa-annunci.js";
import { messaggioPulito } from "../src/core/messaggio-di-casa.js";

const notifica = (entity_id, friendly_name, state = "unknown") => ({
  entity_id,
  state,
  attributes: { friendly_name },
});

const STATI = {
  "notify.echo_dot_cucina_speak": notifica("notify.echo_dot_cucina_speak", "Echo Dot Cucina Speak"),
  "notify.echo_dot_cucina_announce": notifica(
    "notify.echo_dot_cucina_announce",
    "Echo Dot Cucina Announce",
  ),
  /* Un Home Assistant in italiano: l'id fatto nella sua lingua. */
  "notify.echo_studio_parla": notifica("notify.echo_studio_parla", "Echo Studio Parla"),
  "notify.echo_studio_annuncia": notifica(
    "notify.echo_studio_annuncia",
    "Echo Studio Annuncia",
    "unavailable",
  ),
  /* Un id rinominato a mano: si riconosce dal nome che si legge. */
  "notify.bagno": notifica("notify.bagno", "Echo bagno Speak"),
  /* Notifiche che con gli Echo non c'entrano. */
  "notify.persistent": notifica("notify.persistent", "Notifica persistente"),
  "notify.telegram_famiglia": notifica("notify.telegram_famiglia", "Telegram famiglia"),
  "media_player.echo_salotto": {
    entity_id: "media_player.echo_salotto",
    state: "idle",
    attributes: { friendly_name: "Echo salotto", last_called: false },
  },
};

test("una notifica di Alexa Devices si riconosce dall'id o dal nome, le altre no", () => {
  assert.deepEqual(voceDiAlexaDevices(STATI["notify.echo_dot_cucina_speak"]), {
    voce: "parla",
    base: "echo_dot_cucina",
    nome: "Echo Dot Cucina",
  });
  assert.equal(voceDiAlexaDevices(STATI["notify.echo_studio_annuncia"]).voce, "annuncio");
  assert.equal(voceDiAlexaDevices(STATI["notify.bagno"]).nome, "Echo bagno");
  assert.equal(voceDiAlexaDevices(STATI["notify.persistent"]), null);
  assert.equal(voceDiAlexaDevices(STATI["notify.telegram_famiglia"]), null);
  assert.equal(voceDiAlexaDevices(STATI["media_player.echo_salotto"]), null);
  assert.equal(voceDiAlexaDevices(null), null);
});

test("le due voci di uno stesso Echo stanno insieme, e si sa se e' spento", () => {
  const echo = echoDiAlexaDevices(STATI);
  assert.deepEqual(
    echo.map((uno) => [uno.nome, uno.entita, uno.voci, uno.spento, uno.fonte]),
    [
      ["Echo bagno", "notify.bagno", { parla: "notify.bagno", annuncio: "" }, false, "devices"],
      [
        "Echo Dot Cucina",
        "notify.echo_dot_cucina_speak",
        { parla: "notify.echo_dot_cucina_speak", annuncio: "notify.echo_dot_cucina_announce" },
        false,
        "devices",
      ],
      [
        "Echo Studio",
        "notify.echo_studio_parla",
        { parla: "notify.echo_studio_parla", annuncio: "notify.echo_studio_annuncia" },
        false,
        "devices",
      ],
    ],
  );
  assert.deepEqual(echoDiAlexaDevices(null), []);
});

test("fra gli Echo delle notifiche ci sono quelli di tutte e due le integrazioni", () => {
  const echo = echoPerLeNotifiche(STATI);
  assert.deepEqual(
    echo.map((uno) => [uno.nome, uno.fonte]),
    [
      ["Echo bagno", "devices"],
      ["Echo Dot Cucina", "devices"],
      ["Echo salotto", "amp"],
      ["Echo Studio", "devices"],
    ],
  );
  const veri = entitaDegliEcho(echo);
  assert.ok(veri.has("notify.echo_dot_cucina_announce"));
  assert.ok(veri.has("media_player.echo_salotto"));
  assert.ok(!veri.has("notify.telegram_famiglia"));
});

test("la scelta salvata tiene le entita' di Alexa Devices, e quella di prima resta com'era", () => {
  const prima = { attivo: true, altoparlanti: ["media_player.echo_salotto"], modo: "voce" };
  assert.deepEqual(normalizzaAlexa(prima).altoparlanti, ["media_player.echo_salotto"]);
  assert.equal(normalizzaAlexa(prima).modo, "voce");
  const conDevices = normalizzaAlexa({
    attivo: true,
    altoparlanti: ["media_player.echo_salotto", "notify.echo_dot_cucina_announce", "light.no"],
  });
  assert.deepEqual(conDevices.altoparlanti, [
    "media_player.echo_salotto",
    "notify.echo_dot_cucina_announce",
  ]);
  const avviso = avvisoPulito({ frase: "A tavola", altoparlanti: ["notify.echo_studio_parla"] });
  assert.deepEqual(avviso.altoparlanti, ["notify.echo_studio_parla"]);
  assert.deepEqual(
    messaggioPulito({ testo: "Ciao", echo: ["notify.echo_studio_parla", "sensor.x"] }).echo,
    ["notify.echo_studio_parla"],
  );
});

test("parte una chiamata per integrazione: alexa_media ai lettori, send_message alle notifiche", () => {
  const conf = normalizzaAlexa({
    attivo: true,
    modo: "annuncio",
    altoparlanti: [
      "media_player.echo_salotto",
      "notify.echo_dot_cucina_announce",
      "notify.echo_studio_parla",
    ],
  });
  assert.deepEqual(chiamateAlexa(conf, "La lavatrice ha finito"), [
    {
      type: "call_service",
      domain: "notify",
      service: "alexa_media",
      service_data: {
        message: "La lavatrice ha finito",
        target: ["media_player.echo_salotto"],
        data: { type: "announce" },
      },
    },
    {
      type: "call_service",
      domain: "notify",
      service: "send_message",
      service_data: {
        entity_id: ["notify.echo_dot_cucina_announce", "notify.echo_studio_parla"],
        message: "La lavatrice ha finito",
      },
    },
  ]);
  /* Solo Alexa Devices: niente alexa_media, che senza AMP non esiste. */
  const soloDevices = chiamateAlexa(conf, "Ciao", ["notify.echo_studio_parla"]);
  assert.equal(soloDevices.length, 1);
  assert.equal(soloDevices[0].service, "send_message");
  assert.deepEqual(chiamateAlexa(conf, "Ciao", []), []);
});
