/* «E ancora telecamere non funzionanti.» Il velo «Connessione WebRTC…» sopra un
 * fotogramma fermo, e la fila che non passa mai alla strada dopo.
 *
 * Il tempo del WebRTC nativo era scritto in due posti che non si parlavano.
 *
 * Il guscio lo chiede alla strategia: `dmCamWebRTC(cam, strada, content,
 * strada.attesa)`, e per la strada nativa la strategia dà dieci secondi a una
 * telecamera di casa e venticinque a una in cloud, che deve prima svegliarsi.
 *
 * Il nostro negoziato — che sostituisce quello del guscio per portarci i TURN
 * di casa — se n'era scritto uno suo: quindici secondi, sempre, per chiunque.
 *
 * E i due numeri contano tutt'e due, perché il guscio aspetta che la nostra
 * funzione TORNI prima di guardare il proprio cronometro:
 *
 *   · a una telecamera di casa, quindici invece di dieci sono cinque secondi di
 *     velo in più prima che la fila passi all'MJPEG o alle istantanee. Chi
 *     guarda li paga tutti;
 *   · a un'Arlo o a una Ring, quindici invece di venticinque vuol dire
 *     interrompere la trattativa dieci secondi prima della fine del tempo che
 *     il guscio le aveva dato: proprio alle telecamere che di tempo hanno
 *     bisogno si toglieva la strada buona.
 *
 * Il tempo adesso è uno solo e lo dice la strategia, che è il posto dove la
 * strada viene scelta.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  ATTESE,
  attesaDelFlusso,
  strategieDellaTelecamera,
} from "../src/core/strategie-telecamera.js";

const SORGENTE = readFileSync(
  new URL("../src/sections/telecamera-webrtc-section.js", import.meta.url),
  "utf8",
);

const NATIVA = { frontend_stream_types: ["web_rtc"] };
/* Una telecamera di casa con go2rtc integrato: Home Assistant le dichiara
 * tutte e due le strade. */
const DI_CASA = { frontend_stream_types: ["hls", "web_rtc"] };
const inCasa = { entity_id: "camera.cameretta", attributes: { friendly_name: "Cam 02 Cameretta" } };
const inCloud = { entity_id: "camera.arlo_giardino", attributes: { friendly_name: "Arlo Giardino" } };

test("il tempo della strada nativa è quello della sveglia, o quello di casa", () => {
  assert.equal(attesaDelFlusso(inCasa), ATTESE.HLS_LOCALE);
  assert.equal(attesaDelFlusso(inCloud), ATTESE.HLS_SVEGLIA);
});

test("ed è lo stesso numero che la strategia mette sulla strada", () => {
  for (const stato of [inCasa, inCloud])
    for (const capacita of [NATIVA, DI_CASA]) {
      const strade = strategieDellaTelecamera({ entity: stato.entity_id }, stato, { capacita });
      const webrtc = strade.find((strada) => strada.nome === "WebRTC");
      assert.ok(webrtc && !webrtc.salta, "la strada nativa deve essere quella scelta");
      assert.equal(webrtc.attesa, attesaDelFlusso(stato, capacita));
    }
});

test("chi sa soltanto il WebRTC nativo ha il tempo della sveglia, anche senza la marca nel nome (#164)", () => {
  /* «camera_image: camera.cam_seminterrato_live_view»: una Ring, e nel nome
   * «ring» non c'è. Aveva dieci secondi, e una Ring prima di rispondere deve
   * svegliarsi dall'altra parte del mondo. Lo dice Home Assistant: WebRTC sì,
   * HLS no — nessun flusso suo, il video lo apre il servizio della marca. */
  const ring = {
    entity_id: "camera.cam_seminterrato_live_view",
    attributes: { friendly_name: "Cam Seminterrato Live view" },
  };
  assert.equal(attesaDelFlusso(ring, NATIVA), ATTESE.HLS_SVEGLIA);
  const webrtc = strategieDellaTelecamera({ entity: ring.entity_id }, ring, {
    capacita: NATIVA,
  }).find((strada) => strada.nome === "WebRTC");
  assert.equal(webrtc.attesa, ATTESE.HLS_SVEGLIA);
  /* La telecamera di casa con go2rtc resta sul tempo di casa: dichiara anche
   * l'HLS, quindi un flusso suo ce l'ha. */
  assert.equal(attesaDelFlusso(inCasa, DI_CASA), ATTESE.HLS_LOCALE);
  /* Senza risposta non si sa, e non si indovina. E l'attributo vecchio non
   * basta: aveva posto per un valore solo, e con go2rtc integrato scriveva
   * `web_rtc` anche per chi l'HLS ce l'ha. */
  assert.equal(attesaDelFlusso(ring), ATTESE.HLS_LOCALE);
  assert.equal(
    attesaDelFlusso({
      ...ring,
      attributes: { ...ring.attributes, frontend_stream_type: "web_rtc" },
    }),
    ATTESE.HLS_LOCALE,
  );
  /* Una risposta storta non è una risposta. */
  assert.equal(attesaDelFlusso(ring, { frontend_stream_types: "web_rtc" }), ATTESE.HLS_LOCALE);
  assert.equal(
    attesaDelFlusso(ring, { frontend_stream_types: new Set(["web_rtc"]) }),
    ATTESE.HLS_SVEGLIA,
  );
});

test("il negoziato del popup chiede quel tempo, non ne tiene uno suo", () => {
  assert.match(
    SORGENTE,
    /const sessione = await avviaWebRtcNativo\(entity, videoEl, \{\s*\n\s*attesa: attesaDelFlusso\(allStates\(\)\?\.\[entity\], capacitaDellaTelecamera\(entity\)\),/,
  );
  /* Con le capacità che la strategia ha usato per scegliere: senza, a una
   * Ring il popup darebbe dieci secondi e la strategia venticinque. */
  assert.match(
    SORGENTE,
    /import \{ capacitaDellaTelecamera, capacitaInArrivo \} from "\.\/telecamera-capacita-section\.js";/,
  );
  /* E il numero non è scritto qui: viene dal modulo che sceglie le strade. */
  assert.match(SORGENTE, /import \{ attesaDelFlusso \} from "\.\.\/core\/strategie-telecamera\.js";/);
  const negoziato = SORGENTE.slice(SORGENTE.indexOf("async function avviaPerIlPopup"));
  assert.ok(
    !/attesa:\s*\d/.test(negoziato),
    "nessun tempo scritto a mano dentro il negoziato del popup",
  );
});
