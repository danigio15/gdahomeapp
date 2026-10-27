/* La musica sugli Echo: la parte che decide.
 *
 * «In Alexa dai la possibilita' di trasmettere anche la musica presente.»
 * Si sposta sugli Echo quello che suona in casa, o si suona quello che si
 * sceglie; qui si guarda cosa arriva a Home Assistant, e che non ci arrivi
 * niente di strano.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { normalizzaAlexa } from "../src/core/alexa-annunci.js";
import {
  PREFERITI_AL_PIU,
  chiamataPerSuonare,
  chiamataSulLettore,
  chiamatePerSpostare,
  cosaPulita,
  echoPuliti,
  musicaCheSuona,
  musicaSugliEcho,
  preferitiPuliti,
  richiestaDaSpostare,
  servizioPulito,
} from "../src/core/alexa-musica.js";

const echo = (entity_id, altro = {}) => ({
  entity_id,
  state: "idle",
  attributes: { friendly_name: entity_id.split(".")[1], last_called: false, ...altro },
});

const lettore = (entity_id, state, attributes) => ({
  entity_id,
  state,
  attributes: { friendly_name: entity_id.split(".")[1], ...attributes },
});

const CASA = {
  "media_player.echo_cucina": echo("media_player.echo_cucina"),
  "media_player.echo_sala": echo("media_player.echo_sala"),
  "media_player.sonos": lettore("media_player.sonos", "playing", {
    media_title: "Albachiara",
    media_artist: "Vasco Rossi",
    app_name: "Spotify",
    entity_picture: "/api/media_player_proxy/media_player.sonos?token=x",
  }),
  "media_player.radio": lettore("media_player.radio", "paused", {
    media_title: "Il programma del mattino",
    media_channel: "Radio Deejay",
    media_content_type: "channel",
  }),
  "media_player.tv": lettore("media_player.tv", "playing", { app_name: "Netflix" }),
  "media_player.spenta": lettore("media_player.spenta", "off", { media_title: "Vecchio" }),
};

test("si sposta solo quello che suona fuori dagli Echo e ha un titolo", () => {
  const musica = musicaCheSuona(CASA);
  assert.deepEqual(
    musica.map((uno) => uno.entita),
    ["media_player.sonos", "media_player.radio"],
  );
  assert.equal(musica[0].servizio, "SPOTIFY");
  assert.equal(musica[1].radio, true);
});

test("gli Echo che suonano si vedono a parte", () => {
  const casa = {
    ...CASA,
    "media_player.echo_sala": echo("media_player.echo_sala", { media_title: "Yellow" }),
  };
  casa["media_player.echo_sala"].state = "playing";
  assert.deepEqual(
    musicaSugliEcho(casa).map((uno) => uno.entita),
    ["media_player.echo_sala"],
  );
});

test("spostare: gli Echo cercano titolo e artista, il lettore di prima va in pausa", () => {
  const [sonos] = musicaCheSuona(CASA);
  assert.deepEqual(chiamatePerSpostare(sonos, ["media_player.echo_cucina"], CASA), [
    {
      domain: "media_player",
      service: "play_media",
      data: {
        entity_id: ["media_player.echo_cucina"],
        media_content_id: "Albachiara Vasco Rossi",
        media_content_type: "SPOTIFY",
      },
    },
    { domain: "media_player", service: "media_pause", data: { entity_id: "media_player.sonos" } },
  ]);
});

test("una radio riparte da TuneIn, e se era in pausa non si mette in pausa niente", () => {
  const radio = musicaCheSuona(CASA)[1];
  assert.deepEqual(richiestaDaSpostare(radio), { servizio: "TUNEIN", cosa: "Radio Deejay" });
  const chiamate = chiamatePerSpostare(radio, ["media_player.echo_sala"], CASA);
  assert.equal(chiamate.length, 1);
  assert.equal(chiamate[0].data.media_content_type, "TUNEIN");
});

test("una cosa scelta suona dal servizio scelto sugli Echo scelti", () => {
  assert.deepEqual(
    chiamataPerSuonare(
      { echo: ["media_player.echo_sala"], servizio: "apple_music", cosa: "  Top 50   Italia " },
      CASA,
    ),
    {
      domain: "media_player",
      service: "play_media",
      data: {
        entity_id: ["media_player.echo_sala"],
        media_content_id: "Top 50 Italia",
        media_content_type: "APPLE_MUSIC",
      },
    },
  );
});

test("a Home Assistant non arriva niente di strano", () => {
  /* Solo Echo veri: un lettore qualsiasi, o un nome inventato, restano fuori. */
  assert.deepEqual(
    echoPuliti(["media_player.sonos", "light.sala", "media_player.echo_sala"], CASA),
    ["media_player.echo_sala"],
  );
  assert.equal(chiamataPerSuonare({ echo: ["media_player.sonos"], cosa: "x" }, CASA), null);
  assert.equal(chiamataPerSuonare({ echo: ["media_player.echo_sala"], cosa: "   " }, CASA), null);
  /* Un servizio che non si conosce torna Amazon Music. */
  assert.equal(servizioPulito("rm -rf"), "AMAZON_MUSIC");
  /* La frase: una riga, corta, senza caratteri di controllo ne' segni. */
  assert.equal(cosaPulita("a\nb<script>{c}"), "a b script c");
  assert.equal(cosaPulita("x".repeat(500)).length, 120);
  /* I tasti: solo quelli dell'elenco, solo su un lettore. */
  assert.equal(chiamataSulLettore("media_player.echo_sala", "spegni_tutto"), null);
  assert.equal(chiamataSulLettore("script.qualcosa", "pausa"), null);
  assert.deepEqual(chiamataSulLettore("media_player.echo_sala", "ferma"), {
    domain: "media_player",
    service: "media_stop",
    data: { entity_id: "media_player.echo_sala" },
  });
});

test("i preferiti stanno nella scelta di Alexa, puliti e senza doppioni", () => {
  const molti = Array.from({ length: 20 }, (_, i) => ({ servizio: "SPOTIFY", cosa: `Lista ${i}` }));
  assert.equal(preferitiPuliti(molti).length, PREFERITI_AL_PIU);
  assert.deepEqual(
    preferitiPuliti([
      { servizio: "spotify", cosa: "Vasco" },
      { servizio: "SPOTIFY", cosa: "vasco" },
      { servizio: "TUNEIN", cosa: "" },
      null,
    ]),
    [{ servizio: "SPOTIFY", cosa: "Vasco" }],
  );
  assert.deepEqual(normalizzaAlexa(undefined).musica, []);
  assert.deepEqual(
    normalizzaAlexa({ musica: [{ servizio: "TUNEIN", cosa: "Radio Deejay" }] }).musica,
    [{ servizio: "TUNEIN", cosa: "Radio Deejay" }],
  );
});
