/* La radio di casa: le preferite e su quale lettore suonarle.
 *
 * Si guarda cosa si salva, cosa si chiede a Home Assistant e cosa gli
 * arriva quando si tocca una radio: l'id della stazione per un lettore di
 * casa, il nome a TuneIn per un Echo — e niente di strano.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CHIAVE_RADIO,
  RADIO_AL_PIU,
  chiamataDellaRadio,
  chiamataPerFermare,
  domandaDelleRadio,
  filtraLeStazioni,
  normalizzaRadio,
  stazioniDellaRisposta,
} from "../src/core/radio.js";

const DEEJAY = {
  nome: "Radio Deejay",
  id: "media-source://radio_browser/96062a7b-0601-11e8-ae97-52543be04c81",
  tipo: "audio/mpeg",
  logo: "https://www.deejay.it/favicon.png",
};

test("la casella e' della casa, e di serie non ci sono radio", () => {
  assert.equal(CHIAVE_RADIO, "cd_radio");
  assert.deepEqual(normalizzaRadio(undefined), { preferite: [] });
  assert.deepEqual(normalizzaRadio("non json"), { preferite: [] });
});

test("le preferite si salvano pulite, senza doppioni, al piu' 24", () => {
  const molte = Array.from({ length: 40 }, (_, i) => ({ nome: `Radio ${i}` }));
  assert.equal(normalizzaRadio({ preferite: molte }).preferite.length, RADIO_AL_PIU);
  const pulite = normalizzaRadio({
    preferite: [
      DEEJAY,
      { ...DEEJAY, nome: "Doppione" },
      { nome: "  Radio   Italia  " },
      { nome: "radio italia" },
      { nome: "" },
      { nome: "Strana", id: "javascript:alert(1)", logo: "javascript:alert(1)", tipo: "x y" },
    ],
  }).preferite;
  assert.deepEqual(pulite, [
    DEEJAY,
    { nome: "Radio Italia", id: "", tipo: "", logo: "" },
    { nome: "Strana", id: "", tipo: "", logo: "" },
  ]);
});

test("le stazioni si chiedono a Home Assistant, non ad altri", () => {
  assert.deepEqual(domandaDelleRadio("local"), {
    type: "media_source/browse_media",
    media_content_id: "media-source://radio_browser/local",
  });
  const risposta = {
    children: [
      {
        title: "Radio Deejay",
        media_content_id: DEEJAY.id,
        media_content_type: "audio/mpeg",
        thumbnail: DEEJAY.logo,
        can_play: true,
      },
      {
        title: "Italia",
        media_content_id: "media-source://radio_browser/country/IT",
        can_play: false,
      },
    ],
  };
  assert.deepEqual(stazioniDellaRisposta(risposta), [DEEJAY]);
  assert.deepEqual(filtraLeStazioni([DEEJAY, { ...DEEJAY, nome: "Radio Città Futura" }], "citta"), [
    { ...DEEJAY, nome: "Radio Città Futura" },
  ]);
});

test("su un lettore di casa suona l'id, su un Echo il nome a TuneIn", () => {
  assert.deepEqual(chiamataDellaRadio(DEEJAY, "media_player.sonos"), {
    domain: "media_player",
    service: "play_media",
    data: {
      entity_id: "media_player.sonos",
      media_content_id: DEEJAY.id,
      media_content_type: "audio/mpeg",
    },
  });
  assert.deepEqual(chiamataDellaRadio(DEEJAY, "media_player.echo_cucina", { echo: true }), {
    domain: "media_player",
    service: "play_media",
    data: {
      entity_id: "media_player.echo_cucina",
      media_content_id: "Radio Deejay",
      media_content_type: "TUNEIN",
    },
  });
  /* Una radio scritta solo per nome si sente solo sugli Echo. */
  assert.equal(chiamataDellaRadio({ nome: "Radio Italia" }, "media_player.sonos"), null);
  assert.ok(chiamataDellaRadio({ nome: "Radio Italia" }, "media_player.echo", { echo: true }));
  /* Solo lettori: nient'altro arriva a Home Assistant. */
  assert.equal(chiamataDellaRadio(DEEJAY, "script.qualcosa"), null);
  assert.equal(chiamataPerFermare("light.sala"), null);
  assert.deepEqual(chiamataPerFermare("media_player.sonos"), {
    domain: "media_player",
    service: "media_stop",
    data: { entity_id: "media_player.sonos" },
  });
});
