/* La telecamera senza `entity_picture` chiede lo stesso il suo fotogramma (#516).
 *
 * «Entrando nella sezione sicurezza ed aprendo il popup della telecamera la
 * live funziona, mentre nella visuale a 4 camere non mi visualizza la live ma
 * solo un'immagine ferma» — e poi, sulla 1.4.28, «adesso dice nessun segnale!».
 *
 * Il popup passa dal video, e il video l'entita' la chiama per nome. Il muro
 * leggeva soltanto `entity_picture`, che per una telecamera in cloud — Arlo,
 * Ring — resta vuoto finche' l'integrazione un'immagine non ce l'ha in mano:
 * senza quel campo il muro non chiedeva NIENTE, e la tessera restava il suo
 * fondo scuro. La porta pero' e' la stessa che si usa con la foto, e accetta
 * il nome dell'entita': manca solo il gettone, e lo mette la firma del socket.
 *
 * L'altra meta' e' il cartello: il muro scriveva NESSUN SEGNALE anche quando
 * gli stati non erano ancora arrivati, cioe' quando di quelle telecamere non
 * sapeva niente.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  PORTA_ISTANTANEA,
  percorsoDelFlusso,
  percorsoDellIstantanea,
} from "../src/core/telecamera-dal-vivo.js";

const sorgente = await readFile(
  new URL("../src/sections/live-ui-section.js", import.meta.url),
  "utf8",
);

test("il percorso dell'istantanea e' la porta di sempre, chiamata per nome", () => {
  assert.equal(percorsoDellIstantanea("camera.arlo_giardino"), `${PORTA_ISTANTANEA}camera.arlo_giardino`);
  /* Un nome con caratteri da citare non rompe l'indirizzo. */
  assert.equal(percorsoDellIstantanea("camera.a b"), `${PORTA_ISTANTANEA}camera.a%20b`);
  assert.equal(percorsoDellIstantanea(""), "");
  assert.equal(percorsoDellIstantanea(null), "");
  /* Istantanea e flusso restano due porte diverse: una firma vale per il
   * percorso firmato, non per l'altro. */
  assert.notEqual(percorsoDellIstantanea("camera.x"), percorsoDelFlusso("camera.x"));
});

/* Un socket finto che firma quello che gli si chiede, e conta le domande. */
function conSocketCheFirma(callback) {
  const precedenti = {
    ws: globalThis.ws,
    pending: globalThis.pendingWsCallbacks,
    msgId: globalThis.msgId,
    states: globalThis.STATES,
    raw: globalThis._RAW_STATES,
    location: globalThis.location,
  };
  const chieste = [];
  globalThis.msgId = 1;
  globalThis.pendingWsCallbacks = {};
  globalThis.ws = {
    readyState: 1,
    send(grezzo) {
      const messaggio = JSON.parse(grezzo);
      chieste.push(messaggio);
      const rispondi = globalThis.pendingWsCallbacks[messaggio.id];
      if (rispondi) rispondi({ result: { path: `${messaggio.path}?authSig=FIRMA` } });
    },
  };
  return Promise.resolve(callback(chieste)).finally(() => {
    for (const [nome, valore] of [
      ["ws", precedenti.ws],
      ["pendingWsCallbacks", precedenti.pending],
      ["msgId", precedenti.msgId],
      ["STATES", precedenti.states],
      ["_RAW_STATES", precedenti.raw],
      ["location", precedenti.location],
    ]) {
      if (valore === undefined) delete globalThis[nome];
      else globalThis[nome] = valore;
    }
  });
}

function immagineFinta() {
  return { dataset: {}, src: "", onload: null, onerror: null };
}

test("senza foto pubblicata, il fotogramma si chiede lo stesso — firmato", async () => {
  const { loadCameraFrame } = await import(
    `../src/sections/live-ui-section.js?fix=${Date.now()}-senza-foto`
  );
  await conSocketCheFirma(async (chieste) => {
    /* Una Arlo appena riavviata: lo stato c'e', la foto no. */
    globalThis.STATES = { "camera.arlo": { state: "idle", attributes: {} } };
    globalThis._RAW_STATES = globalThis.STATES;
    const immagine = immagineFinta();
    const registro = new Map();
    const esito = await loadCameraFrame({ entity: "camera.arlo" }, immagine, registro);
    assert.equal(esito, true, "un fotogramma si e' chiesto");
    assert.ok(
      immagine.src.includes(`${PORTA_ISTANTANEA}camera.arlo`),
      `l'indirizzo doveva essere la porta delle istantanee, era ${immagine.src}`,
    );
    assert.match(immagine.src, /authSig=FIRMA/, "e doveva portarsi dietro la firma");
    assert.notEqual(
      immagine.dataset.dmCameraState,
      "unavailable",
      "una telecamera a cui si e' chiesto il fotogramma non e' «nessun segnale»",
    );
    assert.deepEqual(
      chieste.map((messaggio) => [messaggio.type, messaggio.path]),
      [["auth/sign_path", `${PORTA_ISTANTANEA}camera.arlo`]],
      "si firma il percorso dell'istantanea, e una volta sola",
    );

    /* Il giro dopo del cronometro non torna a disturbare il socket. */
    await loadCameraFrame({ entity: "camera.arlo" }, immagine, registro);
    assert.equal(chieste.length, 1, "la firma si tiene finche' vale");
  });
});

test("con la foto pubblicata non si chiede nessuna firma", async () => {
  const { loadCameraFrame } = await import(
    `../src/sections/live-ui-section.js?fix=${Date.now()}-con-foto`
  );
  await conSocketCheFirma(async (chieste) => {
    globalThis.STATES = {
      "camera.ingresso": {
        state: "idle",
        attributes: { entity_picture: "/api/camera_proxy/camera.ingresso?token=abc" },
      },
    };
    globalThis._RAW_STATES = globalThis.STATES;
    const immagine = immagineFinta();
    await loadCameraFrame({ entity: "camera.ingresso" }, immagine, new Map());
    assert.match(immagine.src, /token=abc/, "la foto di Home Assistant si usa com'e'");
    assert.equal(chieste.length, 0, "chi ha gia' il gettone non chiede una firma");
  });
});

test("al flusso si passa la foto vera, mai quella che ci siamo firmati", () => {
  const corpo = sorgente.slice(sorgente.indexOf("export async function loadCameraFrame"));
  assert.match(
    corpo,
    /avviaIlFlusso\(camera, image, picture, registry\)/,
    "una firma vale per il percorso firmato: quella dell'istantanea non apre il flusso",
  );
});

test("il muro non dice «nessun segnale» a chi non ha ancora gli stati", async () => {
  const { cameraOffline } = await import(
    `../src/sections/security-showcase-section.js?fix=${Date.now()}`
  );
  /* Prima che gli stati arrivino non si sa niente di nessuno. */
  assert.equal(cameraOffline("camera.arlo", {}), false);
  assert.equal(cameraOffline("camera.arlo", null), false);
  /* A mappa piena la regola di sempre: chi dice «non disponibile» e' spento, e
   * chi non c'e' dentro non c'e'. */
  const stati = {
    "camera.arlo": { state: "idle" },
    "camera.spenta": { state: "unavailable" },
  };
  assert.equal(cameraOffline("camera.arlo", stati), false);
  assert.equal(cameraOffline("camera.spenta", stati), true);
  assert.equal(cameraOffline("camera.mai_vista", stati), true);
});
