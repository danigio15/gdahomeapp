/* Le telecamere nell'app non restano nere.
 *
 * «Nell'app le telecamere sono tutte nere, a casa e fuori; nel browser di
 * Home Assistant si vedono.» La finestra delle telecamere chiedeva i
 * fotogrammi a ogni ridisegno della Home — cioe' a ogni cambio di stato, piu'
 * volte al secondo in una casa vera — e ogni volta metteva nell'immagine un
 * indirizzo nuovo: un indirizzo nuovo interrompe quello che si stava
 * scaricando. Nell'app una foto passa dal servitore, dal filo, dal ponte e dal
 * Supervisor e ci mette secondi: nessuna arrivava mai in fondo, e l'immagine
 * restava «in arrivo», cioe' a opacita' zero, cioe' nera.
 *
 * Qui: un'istantanea in viaggio non si interrompe e non si richiede; arriva
 * intera e si posa tutta insieme; la plancia ospitata non manda il gettone
 * finto come `Bearer`; e un no della casa resta un no.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const FOTO = "/api/camera_proxy/camera.cancello?token=abc";

function immagineFinta() {
  const assegnati = [];
  const immagine = { dataset: {}, onload: null, onerror: null, assegnati };
  let src = "";
  Object.defineProperty(immagine, "src", {
    get: () => src,
    set: (valore) => {
      src = valore;
      assegnati.push(valore);
    },
  });
  return immagine;
}

/* Una casa lenta: ogni fotogramma arriva solo quando la prova lo dice. */
function conUnaCasaLenta(callback, { stato = 200 } = {}) {
  const prima = {
    fetch: globalThis.fetch,
    states: globalThis.STATES,
    raw: globalThis._RAW_STATES,
    create: globalThis.URL.createObjectURL,
    revoke: globalThis.URL.revokeObjectURL,
    token: globalThis.DASHBOARDMODERN_AUTH_TOKEN,
  };
  const chieste = [];
  let blob = 0;
  globalThis.fetch = (url, opzioni = {}) =>
    new Promise((rispondi) => {
      chieste.push({
        url: String(url),
        opzioni,
        arriva: () =>
          rispondi({
            ok: stato >= 200 && stato < 300,
            status: stato,
            blob: async () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])]),
          }),
      });
    });
  globalThis.URL.createObjectURL = () => `blob:plancia/${(blob += 1)}`;
  globalThis.URL.revokeObjectURL = () => {};
  globalThis.STATES = {
    "camera.cancello": { state: "idle", attributes: { entity_picture: FOTO } },
  };
  globalThis._RAW_STATES = globalThis.STATES;
  /* La plancia ospitata: nell'app e nel pannello di Home Assistant. */
  globalThis.DASHBOARDMODERN_AUTH_TOKEN = "__dashboardmodern_hosted__";
  return Promise.resolve(callback(chieste)).finally(() => {
    globalThis.fetch = prima.fetch;
    globalThis.URL.createObjectURL = prima.create;
    globalThis.URL.revokeObjectURL = prima.revoke;
    for (const [nome, valore] of [
      ["STATES", prima.states],
      ["_RAW_STATES", prima.raw],
      ["DASHBOARDMODERN_AUTH_TOKEN", prima.token],
    ]) {
      if (valore === undefined) delete globalThis[nome];
      else globalThis[nome] = valore;
    }
  });
}

const aspetta = () => new Promise((fatto) => setTimeout(fatto, 0));

test("un'istantanea in viaggio non si interrompe, e arriva", async () => {
  const { loadCameraFrame, istantaneaInViaggio } = await import(
    `../src/sections/live-ui-section.js?fix=${Date.now()}-viaggio`
  );
  await conUnaCasaLenta(async (chieste) => {
    const immagine = immagineFinta();
    const registro = new Map();
    const telecamera = { entity: "camera.cancello" };

    const primo = loadCameraFrame(telecamera, immagine, registro);
    await aspetta();
    assert.equal(chieste.length, 1);
    assert.equal(istantaneaInViaggio(immagine), true);
    assert.equal(immagine.dataset.dmCameraState, "loading");

    /* La casa parla: venti ridisegni mentre la foto e' per strada. */
    for (let giro = 0; giro < 20; giro += 1) {
      assert.equal(await loadCameraFrame(telecamera, immagine, registro), true);
    }
    assert.equal(chieste.length, 1, "nessuna nuova domanda mentre la prima viaggia");
    assert.deepEqual(immagine.assegnati, [], "e nessun indirizzo nuovo che la interrompa");

    chieste[0].arriva();
    assert.equal(await primo, true);
    assert.equal(immagine.dataset.dmCameraState, "ready");
    assert.match(immagine.src, /^blob:plancia\//, "la foto si posa intera, gia' scaricata");
    assert.equal(istantaneaInViaggio(immagine), false);

    /* Arrivata quella, la prossima si puo' chiedere. */
    const secondo = loadCameraFrame(telecamera, immagine, registro);
    await aspetta();
    assert.equal(chieste.length, 2);
    assert.equal(immagine.dataset.dmCameraState, "ready", "il fotogramma di prima resta a schermo");
    chieste[1].arriva();
    await secondo;
    assert.equal(immagine.assegnati.length, 2);
  });
});

test("la plancia ospitata non manda il gettone finto, e chiede dalla sua origine", async () => {
  const { loadCameraFrame } = await import(
    `../src/sections/live-ui-section.js?fix=${Date.now()}-ospitata`
  );
  await conUnaCasaLenta(async (chieste) => {
    const immagine = immagineFinta();
    const carica = loadCameraFrame({ entity: "camera.cancello" }, immagine, new Map());
    await aspetta();
    const [domanda] = chieste;
    assert.match(domanda.url, /\/api\/camera_proxy\/camera\.cancello\?token=abc&dm_t=\d+/);
    assert.equal(domanda.opzioni.headers, undefined, "nessun «Bearer __dashboardmodern_hosted__»");
    assert.equal(domanda.opzioni.credentials, "same-origin");
    assert.equal(domanda.opzioni.cache, "no-store");
    domanda.arriva();
    await carica;
  });
});

test("un no della casa resta un no: niente foto, e la prossima volta si richiede", async () => {
  const { loadCameraFrame, istantaneaInViaggio } = await import(
    `../src/sections/live-ui-section.js?fix=${Date.now()}-no`
  );
  await conUnaCasaLenta(
    async (chieste) => {
      const immagine = immagineFinta();
      const carica = loadCameraFrame({ entity: "camera.cancello" }, immagine, new Map());
      await aspetta();
      chieste[0].arriva();
      assert.equal(await carica, false);
      assert.equal(immagine.dataset.dmCameraState, "unavailable");
      assert.deepEqual(immagine.assegnati, [], "un 401 non diventa un'immagine");
      assert.equal(istantaneaInViaggio(immagine), false, "e non resta appeso");
    },
    { stato: 401 },
  );
});

test("la finestra delle telecamere non richiede chi sta viaggiando, ne' chi e' fresco", async () => {
  const sorgente = await readFile(
    new URL("../src/sections/home-widgets-section.js", import.meta.url),
    "utf8",
  );
  const corpo = sorgente.slice(sorgente.indexOf("function aggiornaTelecamere"));
  const fine = corpo.indexOf("\n}\n");
  const funzione = corpo.slice(0, fine);
  assert.match(funzione, /istantaneaInViaggio\(image, adesso\)/);
  assert.match(funzione, /CAMERA_WIDGET_REFRESH_MS - 500/);
  /* E una che la casa ha rifiutato non si richiede a ogni ridisegno. */
  assert.match(funzione, /CAMERA_RIPROVA_MS/);
  assert.match(sorgente, /const CAMERA_RIPROVA_MS = 2000;/);
});

test("una firma di una telecamera si chiede per poco, e si rifa' prima che scada", async () => {
  /* Un indirizzo firmato apre quella telecamera a chi lo ha in mano: il ponte
   * non lo lascia valere piu' di dieci minuti (`FIRMA_MASSIMA_S`), e la
   * plancia non lo tiene oltre. */
  const sorgente = await readFile(
    new URL("../src/sections/live-ui-section.js", import.meta.url),
    "utf8",
  );
  const chiesta = /const FIRMA_CHIESTA_S = ([\d\s*]+);/.exec(sorgente);
  const tenuta = /const FIRMA_DURA_MS = ([\d\s*]+);/.exec(sorgente);
  assert.ok(chiesta && tenuta);
  const secondi = Function(`return ${chiesta[1]}`)();
  const tenutaMs = Function(`return ${tenuta[1]}`)();
  assert.ok(secondi <= 600, `${secondi} secondi`);
  assert.ok(tenutaMs < secondi * 1000, "la firma si rifa' prima che scada");
  assert.match(sorgente, /expires: FIRMA_CHIESTA_S/);
  assert.doesNotMatch(sorgente, /expires: 4 \* 60 \* 60/);
});
