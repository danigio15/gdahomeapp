/* «Ho delle telecamere configurate ma 2 in particolare non mi hanno mai
 * funzionato in visualizzazione, anche se sulla mia vecchia plancia erano
 * configurate e visibili» (#164).
 *
 * Le due telecamere erano una Ring — `camera.cam_seminterrato_live_view`,
 * guardata con `camera_view: live` — e una Reolink passata da go2rtc con
 * l'indirizzo `rtsp://…/Salone`. La plancia era aperta da dentro Home
 * Assistant, un 2026.9.
 *
 * LA RING. Su un Home Assistant di oggi l'attributo `frontend_stream_type` non
 * c'è più: che la Ring parli WebRTC lo dice soltanto la risposta a
 * `camera/capabilities`. Quattro cose le toglievano il video:
 *
 *   · la tessera «dal vivo» leggeva ancora l'attributo, e non trovava mai una
 *     strada;
 *   · il popup, se la domanda era partita contro un socket ancora in piedi a
 *     metà, per mezzo minuto sceglieva senza — e senza, una Ring finisce
 *     sull'HLS che non ha. E chi apriva mentre la domanda viaggiava non la
 *     aspettava;
 *   · il tempo lungo lo prendeva solo chi si chiama come la sua marca, e questa
 *     nel nome «ring» non ce l'ha: dieci secondi per svegliarsi dall'altra
 *     parte del mondo;
 *   · la fila del guscio sceglieva con i soli attributi, e dopo una caduta le
 *     proponeva di nuovo la strada appena provata.
 *
 * LA REOLINK. Il nome del flusso go2rtc si parla con un socket suo verso
 * `/api/webrtc/ws` dell'estensione. Da dentro Home Assistant quella porta non
 * si raggiunge: la strada cadeva sempre, e intanto — essendo quella scelta —
 * teneva fermi il WebRTC nativo e l'HLS, che lì dentro funzionano. Adesso da
 * dentro il nome non si usa, e la nota dell'indirizzo dice di prendere
 * l'entità dell'integrazione Reolink.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  ATTESE,
  daProvare,
  stradaScelta,
  strategieDellaTelecamera,
} from "../src/core/strategie-telecamera.js";
import { serverIce, tipoDiFlusso } from "../src/core/telecamera-webrtc.js";

const leggi = (percorso) => readFileSync(new URL(percorso, import.meta.url), "utf8");
const strada = (strade, nome) => strade.find((voce) => voce.nome === nome);
const nomi = (strade) => strade.map((voce) => voce.nome);

const RING = {
  entity_id: "camera.cam_seminterrato_live_view",
  state: "idle",
  attributes: { friendly_name: "Cam Seminterrato Live view", supported_features: 2 },
};
const SOLO_WEBRTC = { frontend_stream_types: ["web_rtc"] };
const REOLINK = {
  entity_id: "camera.salone_fluent",
  state: "idle",
  attributes: { friendly_name: "Salone Fluent", supported_features: 2 },
};
const HLS_E_WEBRTC = { frontend_stream_types: ["hls", "web_rtc"] };

/* ── la Ring ─────────────────────────────────────────────────────────── */

test("la Ring prende il WebRTC nativo col tempo della sveglia", () => {
  const strade = strategieDellaTelecamera({ entity: RING.entity_id }, RING, {
    capacita: SOLO_WEBRTC,
  });
  const scelta = stradaScelta(strade);
  assert.equal(scelta.nome, "WebRTC");
  assert.equal(scelta.nativa, true);
  assert.equal(scelta.attesa, ATTESE.HLS_SVEGLIA);
});

test("la tessera dal vivo legge le capacità, non l'attributo che non c'è più", () => {
  /* Oggi negli attributi c'è solo il bit dei flussi: da solo dice «HLS», che
   * per una Ring è la strada sbagliata. La risposta di Home Assistant vince. */
  assert.equal(tipoDiFlusso(RING, SOLO_WEBRTC), "web_rtc");
  assert.equal(tipoDiFlusso(REOLINK, HLS_E_WEBRTC), "web_rtc");
  assert.equal(tipoDiFlusso(REOLINK, { frontend_stream_types: ["hls"] }), "hls");
  /* Una telecamera che Home Assistant dice muta resta muta, anche col bit. */
  assert.equal(tipoDiFlusso(RING, { frontend_stream_types: [] }), "");
  /* Senza risposta: il bit, come nel popup. */
  assert.equal(tipoDiFlusso(RING), "hls");
  /* E l'attributo vecchio, per chi ce l'ha ancora — anche scritto alla
   * vecchia maniera. */
  assert.equal(tipoDiFlusso({ attributes: { frontend_stream_type: "webrtc" } }), "web_rtc");
  assert.equal(tipoDiFlusso(null), "");

  const sezione = leggi("../src/sections/telecamera-webrtc-section.js");
  assert.match(sezione, /const tipo = tipoDiFlusso\(stato, await capacitaInArrivo\(entity\)\);/);
});

test("dopo una caduta col tempo intero, la fila del guscio non rifà la stessa strada", () => {
  const strade = strategieDellaTelecamera({ entity: RING.entity_id }, RING, {
    capacita: SOLO_WEBRTC,
    appenaCaduta: "WebRTC",
  });
  assert.equal(strada(strade, "WebRTC").salta, "appena-caduta");
  /* Una Ring l'HLS non ce l'ha: si va avanti, al proxy e alle istantanee. */
  assert.equal(strada(strade, "HLS").salta, "senza-flusso-dichiarato");
  assert.deepEqual(nomi(daProvare(strade)), ["MJPEG", "Istantanee"]);

  /* Chi l'HLS ce l'ha, dopo il WebRTC caduto prova quello. */
  const casa = strategieDellaTelecamera({ entity: REOLINK.entity_id }, REOLINK, {
    capacita: HLS_E_WEBRTC,
    appenaCaduta: "WebRTC",
  });
  assert.equal(stradaScelta(casa).nome, "HLS");

  /* Un ricordo di un'altra strada non tocca il WebRTC. */
  const altra = strategieDellaTelecamera({ entity: RING.entity_id }, RING, {
    capacita: SOLO_WEBRTC,
    appenaCaduta: "HLS",
  });
  assert.equal(stradaScelta(altra).nome, "WebRTC");
});

test("l'offerta è quella del lettore di Home Assistant: canale dati, audio, video", () => {
  assert.equal(serverIce({ dataChannel: "dati" }).canaleDati, "dati");
  assert.equal(serverIce({ configuration: { dataChannel: "dati" } }).canaleDati, "dati");
  assert.equal(serverIce(null).canaleDati, "");

  const sezione = leggi("../src/sections/telecamera-webrtc-section.js");
  const offerta = sezione.slice(sezione.indexOf("export async function avviaWebRtcNativo"));
  const canale = offerta.indexOf("pc.createDataChannel(ice.canaleDati)");
  const audio = offerta.indexOf('pc.addTransceiver("audio"');
  const video = offerta.indexOf('pc.addTransceiver("video"');
  const crea = offerta.indexOf("await pc.createOffer()");
  assert.ok(canale > 0 && canale < audio, "il canale dati prima dell'audio");
  assert.ok(audio < video, "l'audio prima del video");
  assert.ok(video < crea, "tutto prima dell'offerta");
});

/* ── la Reolink passata da go2rtc ────────────────────────────────────── */

test("da dentro Home Assistant il nome del flusso go2rtc non ferma le strade che funzionano", () => {
  const cam = { entity: REOLINK.entity_id, stream: "Salone" };
  /* Da fuori il nome si usa, com'era. */
  const fuori = strategieDellaTelecamera(cam, REOLINK, { capacita: HLS_E_WEBRTC });
  assert.equal(stradaScelta(fuori).flusso, "Salone");

  /* Da dentro si va sul WebRTC di Home Assistant. */
  const dentro = strategieDellaTelecamera(cam, REOLINK, {
    capacita: HLS_E_WEBRTC,
    go2rtcRaggiungibile: false,
  });
  const scelta = stradaScelta(dentro);
  assert.equal(scelta.nome, "WebRTC");
  assert.equal(scelta.nativa, true);
  assert.equal(scelta.flusso, undefined);

  /* Chi dichiara solo l'HLS va sull'HLS. */
  const soloHls = strategieDellaTelecamera(cam, REOLINK, {
    capacita: { frontend_stream_types: ["hls"] },
    go2rtcRaggiungibile: false,
  });
  assert.equal(strada(soloHls, "WebRTC").salta, "go2rtc-fuori-portata");
  assert.equal(stradaScelta(soloHls).nome, "HLS");
});

test("il guscio dice perché il nome del flusso non vale, in tutte e due le lingue", () => {
  for (const lingua of ["it", "en"]) {
    const guscio = leggi(`../legacy/dashboard-runtime-${lingua}.js`);
    const motivi = guscio.slice(guscio.indexOf("const _DM_CAM_MOTIVI"));
    const riga = motivi.slice(0, motivi.indexOf("\n"));
    for (const codice of ["go2rtc-fuori-portata", "appena-caduta", "senza-flusso-dichiarato"])
      assert.match(riga, new RegExp(`'${codice}': '`), `${lingua}: manca ${codice}`);
  }
});

test("la fila del guscio sceglie con quello che sa la plancia", () => {
  const moduli = leggi("../legacy/modules-entry.js");
  assert.match(moduli, /strategieDellaTelecamera: strategieDellaTelecameraDiCasa,/);
  const involucro = moduli.slice(moduli.indexOf("function strategieDellaTelecameraDiCasa"));
  const corpo = involucro.slice(0, involucro.indexOf("\n}\n"));
  assert.match(corpo, /capacita: capacitaDellaTelecamera\(entity\),/);
  assert.match(corpo, /go2rtcRaggiungibile: go2rtcRaggiungibile\(\),/);
  assert.match(corpo, /appenaCaduta: stradaAppenaCaduta\(entity\),/);
  /* Quello che passa il guscio vince: lui sa del browser. */
  assert.match(corpo, /appenaCaduta: stradaAppenaCaduta\(entity\),\n\s*\.\.\.opzioni,\n\s*\}\);/);
});

test("la nota dell'indirizzo rtsp:// propone prima l'entità dell'integrazione", () => {
  const nota = leggi("../src/sections/telecamera-rtsp-section.js");
  const uno = nota.indexOf("<b>1.</b>");
  const due = nota.indexOf("<b>2.</b>");
  const tre = nota.indexOf("<b>3.</b>");
  assert.ok(uno > 0 && uno < due && due < tre);
  assert.match(nota.slice(uno, due), /Reolink, Tapo, Hikvision/);
  assert.match(nota.slice(due, tre), /telecamera Generica/);
  assert.match(nota.slice(tre), /go2rtc o Frigate/);
  /* E da dentro Home Assistant il nome del flusso non si scrive da solo. */
  const proponi = nota.slice(nota.indexOf("function proponiIlNome()"));
  assert.match(
    proponi,
    /^function proponiIlNome\(\) \{\n(?:\s*\/?\*.*\n)*\s*if \(!go2rtcRaggiungibile\(\)\) return;/,
  );
});

/* ── la domanda delle capacità ───────────────────────────────────────── */

/* Un socket finto, come quello del guscio: `ws`, `pendingWsCallbacks` e
 * `msgId` sono le variabili che la plancia cerca. */
function socketFinto() {
  const inviate = [];
  globalThis.pendingWsCallbacks = {};
  globalThis.msgId = 1;
  globalThis.ws = {
    readyState: 1,
    send(testo) {
      inviate.push(JSON.parse(testo));
    },
  };
  const rispondi = (tipi) => {
    const ultima = inviate.at(-1);
    globalThis.pendingWsCallbacks[ultima.id]?.({
      success: true,
      result: { frontend_stream_types: tipi },
    });
  };
  const rifiuta = () => {
    const ultima = inviate.at(-1);
    globalThis.pendingWsCallbacks[ultima.id]?.({
      success: false,
      error: { message: "non ancora" },
    });
  };
  return { inviate, rispondi, rifiuta };
}

test("chi apre il popup richiede subito, e chi arriva mentre la domanda viaggia la aspetta", async () => {
  const { capacitaDellaTelecamera, capacitaInArrivo, chiediLeCapacita } =
    await import("../src/sections/telecamera-capacita-section.js");
  const { inviate, rispondi, rifiuta } = socketFinto();
  const entity = "camera.cam_seminterrato_live_view";

  /* La prima domanda cade: il socket stava ancora in piedi a metà. */
  const prima = chiediLeCapacita(entity, Date.now());
  rifiuta();
  assert.equal(await prima, null);
  assert.equal(inviate.length, 1);

  /* I giri di fondo aspettano mezzo minuto… */
  assert.equal(await chiediLeCapacita(entity, Date.now()), null);
  assert.equal(inviate.length, 1);
  /* …e le tessere non ne fanno partire di nuove. */
  assert.equal(await capacitaInArrivo(entity), null);
  assert.equal(inviate.length, 1);

  /* Chi tocca la telecamera invece richiede adesso. */
  const popup = chiediLeCapacita(entity, Date.now(), { forza: true });
  assert.equal(inviate.length, 2);
  assert.deepEqual(inviate[1], { type: "camera/capabilities", entity_id: entity, id: 2 });

  /* Chi arriva mentre viaggia — la tessera, un secondo tocco — non la rifà:
   * aspetta la stessa risposta. */
  const tessera = capacitaInArrivo(entity);
  const secondo = chiediLeCapacita(entity, Date.now(), { forza: true });
  assert.equal(inviate.length, 2);

  rispondi(["web_rtc"]);
  const attese = { frontend_stream_types: ["web_rtc"] };
  assert.deepEqual(await popup, attese);
  assert.deepEqual(await tessera, attese);
  assert.deepEqual(await secondo, attese);
  assert.deepEqual(capacitaDellaTelecamera(entity), attese);

  /* E una risposta vera non si richiede più, nemmeno forzando. */
  assert.deepEqual(await chiediLeCapacita(entity, Date.now(), { forza: true }), attese);
  assert.equal(inviate.length, 2);
});

test("il nome del flusso go2rtc si raggiunge solo da fuori Home Assistant", async () => {
  const { go2rtcRaggiungibile, stradaAppenaCaduta } =
    await import("../src/sections/telecamera-subito-section.js");
  delete globalThis.__DASHBOARDMODERN_HOSTED__;
  delete globalThis.__DASHBOARDMODERN_BRIDGED__;
  assert.equal(go2rtcRaggiungibile(), true);
  globalThis.__DASHBOARDMODERN_HOSTED__ = true;
  assert.equal(go2rtcRaggiungibile(), false);
  delete globalThis.__DASHBOARDMODERN_HOSTED__;
  globalThis.__DASHBOARDMODERN_BRIDGED__ = true;
  assert.equal(go2rtcRaggiungibile(), false);
  delete globalThis.__DASHBOARDMODERN_BRIDGED__;

  /* Il ricordo di una strada appena caduta vale per quella telecamera, e per
   * poco: quanto basta alla fila del guscio che parte subito dopo. */
  const stato = globalThis.__DASHBOARDMODERN_TELECAMERA_SUBITO__;
  const adesso = 1_000_000;
  stato.caduta = { entity: RING.entity_id, nome: "WebRTC", quando: adesso };
  assert.equal(stradaAppenaCaduta(RING.entity_id, adesso + 1_000), "WebRTC");
  assert.equal(stradaAppenaCaduta(REOLINK.entity_id, adesso + 1_000), "");
  assert.equal(stradaAppenaCaduta(RING.entity_id, adesso + 60_000), "");
  stato.caduta = null;
  assert.equal(stradaAppenaCaduta(RING.entity_id, adesso), "");
});

test("il popup ricorda la caduta solo se la strada ha avuto il suo tempo intero", () => {
  const apertura = leggi("../src/sections/telecamera-subito-section.js");
  assert.match(apertura, /await chiediLeCapacita\(entity, Date\.now\(\), \{ forza: true \}\);/);
  assert.match(
    apertura,
    /if \(Number\(corta\.attesa\) >= Number\(intera\?\.attesa \|\| 0\)\)\n\s*state\.caduta = \{ entity, nome: clean\(corta\.nome\), quando: Date\.now\(\) \};/,
  );
  /* E ogni apertura ricomincia da capo: il ricordo si cancella prima di
   * qualunque strada, anche quando il popup non ne prende una sua. */
  const avvolta = apertura.slice(apertura.indexOf("async function avvolta("));
  const cancella = avvolta.indexOf("state.caduta = null;");
  assert.ok(cancella > 0 && cancella < avvolta.indexOf("await chiediLeCapacita("));
  /* E la scelta del popup sa se go2rtc si raggiunge, come quella del guscio. */
  assert.match(apertura, /go2rtcRaggiungibile: go2rtcRaggiungibile\(\),/);
});
