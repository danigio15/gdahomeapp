/* Le telecamere delle plance riservate restano chiuse anche dalle strade di
 * lato: i media di Home Assistant (`media-source://camera/…`), il flusso HLS
 * (`/api/hls/…`) e le risposte REST che portano il gettone della telecamera
 * (`GET /api/states`, `/api/history/…`).
 *
 * Prima di queste prove `media_source/resolve_media` dava a chiunque
 * l'indirizzo firmato del flusso di una telecamera chiusa, `browse_media`
 * sulla cartella delle telecamere le elencava tutte, e `GET /api/states`
 * tornava com'era, col gettone dentro.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Commissioni, TIPO } from "../src/commissioni.js";
import { Configurazione } from "../src/configurazione.js";
import { passaLaDogana, perLaVia, telecamereNominate } from "../src/dogana.js";
import { Plance } from "../src/plance.js";

const ZITTO = { info() {}, attenzione() {}, errore() {} };
const LEI = "a".repeat(32);
const LUI = "b".repeat(32);
const CHIUSE = new Set(["camera.camera_da_letto"]);

const passa = (detto, chi) => passaLaDogana(JSON.stringify(detto), chi).passa.length > 0;

/* ─── I media ────────────────────────────────────────────────────────────── */

test("una telecamera chiusa non si apre dai media: ne' resolve ne' browse", () => {
  const chi = { amministra: false, telecamereChiuse: CHIUSE };
  assert.equal(
    passa(
      {
        id: 1,
        type: "media_source/resolve_media",
        media_content_id: "media-source://camera/camera.camera_da_letto",
      },
      chi,
    ),
    false,
  );
  assert.equal(
    passa(
      {
        id: 2,
        type: "media_source/browse_media",
        media_content_id: "media-source://camera/camera.camera_da_letto",
      },
      chi,
    ),
    false,
  );
  /* Nemmeno passando da un lettore, o mandandola a una TV. */
  assert.equal(
    passa(
      {
        id: 3,
        type: "media_player/browse_media",
        entity_id: "media_player.sala",
        media_content_id: "media-source://camera/camera.camera_da_letto",
      },
      chi,
    ),
    false,
  );
  assert.equal(
    passa(
      {
        id: 4,
        type: "call_service",
        domain: "media_player",
        service: "play_media",
        service_data: {
          entity_id: "media_player.sala",
          media_content_id: "media-source://camera/camera.camera_da_letto",
        },
      },
      chi,
    ),
    false,
  );
  assert.deepEqual(
    [
      ...telecamereNominate({
        type: "media_source/resolve_media",
        media_content_id: "media-source://camera/camera.camera_da_letto",
      }),
    ],
    ["camera.camera_da_letto"],
  );
});

test("la cartella delle telecamere fra i media non si sfoglia a chi ne ha di chiuse", () => {
  const chi = { amministra: false, telecamereChiuse: CHIUSE };
  for (const radice of ["media-source://camera", "media-source://camera/", "MEDIA-SOURCE://camera"])
    assert.equal(
      passa({ id: 1, type: "media_source/browse_media", media_content_id: radice }, chi),
      false,
      radice,
    );
});

test("a un telefono senza utente nessuna telecamera dai media, nemmeno la cartella", () => {
  const chi = { amministra: false, telecamereChiuse: null, senzaTelecamere: true };
  assert.equal(
    passa(
      {
        id: 1,
        type: "media_source/resolve_media",
        media_content_id: "media-source://camera/camera.cancello",
      },
      chi,
    ),
    false,
  );
  assert.equal(
    passa(
      { id: 2, type: "media_source/browse_media", media_content_id: "media-source://camera" },
      chi,
    ),
    false,
  );
});

test("il resto dei media passa come prima: le foto, le telecamere aperte, chi amministra", () => {
  const chi = { amministra: false, telecamereChiuse: CHIUSE };
  /* La radice dei media e le foto di casa: e' quello che la plancia sfoglia. */
  assert.equal(passa({ id: 1, type: "media_source/browse_media" }, chi), true);
  assert.equal(
    passa(
      {
        id: 2,
        type: "media_source/browse_media",
        media_content_id: "media-source://media_source/local/camera.jpg",
      },
      chi,
    ),
    true,
  );
  assert.equal(
    passa(
      {
        id: 3,
        type: "media_source/resolve_media",
        media_content_id: "media-source://media_source/local/foto.jpg",
      },
      { amministra: false, telecamereChiuse: null, senzaTelecamere: true },
    ),
    true,
  );
  /* Una telecamera che non e' chiusa si apre. */
  assert.equal(
    passa(
      {
        id: 4,
        type: "media_source/resolve_media",
        media_content_id: "media-source://camera/camera.cancello",
      },
      chi,
    ),
    true,
  );
  /* Chi non ha niente di chiuso sfoglia anche la cartella delle telecamere. */
  assert.equal(
    passa(
      { id: 5, type: "media_source/browse_media", media_content_id: "media-source://camera" },
      { amministra: false, telecamereChiuse: new Set() },
    ),
    true,
  );
  /* E chi amministra le vede tutte, come in Home Assistant. */
  assert.equal(
    passa(
      { id: 6, type: "media_source/browse_media", media_content_id: "media-source://camera" },
      { amministra: true, telecamereChiuse: CHIUSE },
    ),
    true,
  );
});

/* ─── Il flusso HLS ──────────────────────────────────────────────────────── */

test("il flusso HLS non dice di quale telecamera e': a chi ne ha di chiuse non si apre", () => {
  const via = "/api/hls/gettone-del-flusso/master_playlist.m3u8";
  assert.notEqual(
    perLaVia({ metodo: "GET", percorso: via, amministra: false, telecamereChiuse: CHIUSE }),
    null,
  );
  /* Chi non ne ha di chiuse, e chi amministra, il flusso lo prendono. */
  assert.equal(
    perLaVia({ metodo: "GET", percorso: via, amministra: false, telecamereChiuse: new Set() }),
    null,
  );
  assert.equal(
    perLaVia({ metodo: "GET", percorso: via, amministra: true, telecamereChiuse: CHIUSE }),
    null,
  );
});

/* ─── I gettoni nelle risposte REST ──────────────────────────────────────── */

const STATI = [
  {
    entity_id: "camera.camera_da_letto",
    state: "idle",
    attributes: {
      access_token: "gettone-della-camera-da-letto",
      entity_picture:
        "/api/camera_proxy/camera.camera_da_letto?token=gettone-della-camera-da-letto",
    },
  },
  {
    entity_id: "camera.cancello",
    state: "idle",
    attributes: {
      access_token: "gettone-del-cancello",
      entity_picture: "/api/camera_proxy/camera.cancello?token=gettone-del-cancello",
    },
  },
  { entity_id: "light.sala", state: "on", attributes: {} },
];

/* Una casa con una plancia riservata a lei, con la camera da letto dentro; la
 * principale ha il cancello. Home Assistant risponde con gli stati di sopra. */
function casaConUnaPlanciaRiservata() {
  const cartella = mkdtempSync(join(tmpdir(), "telecamere-riservate-"));
  const plance = new Plance({ cartella, registro: ZITTO });
  const riservata = plance.aggiungi("Riservata");
  plance.chiLaVede(riservata.profilo, [LEI]);
  const configurazione = new Configurazione({ cartella });
  configurazione.scrivi(riservata.profilo, { cd_telecamere: '["camera.camera_da_letto"]' });
  configurazione.scrivi("primary", { cd_telecamere: '["camera.cancello"]' });
  const chieste = [];
  const commissioni = new Commissioni({
    casa: { indirizzo: "http://casa.invalid/core", segno: "segno" },
    registro: ZITTO,
    plance,
    configurazione,
    scarica: async ({ url }) => {
      chieste.push(url);
      return {
        stato: 200,
        tipo: "application/json",
        corpo: Buffer.from(JSON.stringify(STATI)),
      };
    },
  });
  return { commissioni, chieste, spegni: () => rmSync(cartella, { recursive: true, force: true }) };
}

const corpoDi = (risposta) => {
  assert.equal(risposta.success, true, JSON.stringify(risposta));
  assert.equal(risposta.result.compresso, undefined);
  return Buffer.from(risposta.result.corpo, "base64").toString("utf8");
};

for (const percorso of [
  "/api/states",
  "/api/history/period?filter_entity_id=camera.camera_da_letto",
]) {
  test(`GET ${percorso.split("?")[0]}: il gettone di una telecamera chiusa non esce`, async () => {
    const { commissioni, spegni } = casaConUnaPlanciaRiservata();
    try {
      const risposta = await commissioni.rispondi(
        { id: 1, type: TIPO, metodo: "GET", percorso, senzaGzip: true },
        { chiChiede: LUI, amministra: false, puoAmministrare: false },
      );
      const corpo = corpoDi(risposta);
      assert.equal(corpo.includes("gettone-della-camera-da-letto"), false);
      /* Quella che vede resta com'era, e lo stato della chiusa c'e' ancora. */
      assert.equal(corpo.includes("gettone-del-cancello"), true);
      assert.equal(corpo.includes("camera.camera_da_letto"), true);
    } finally {
      spegni();
    }
  });
}

test("REST: senza un utente nessun gettone; a chi la vede, e a chi amministra, tutti", async () => {
  const { commissioni, spegni } = casaConUnaPlanciaRiservata();
  try {
    const chiedi = (chi) =>
      commissioni
        .rispondi(
          { id: 1, type: TIPO, metodo: "GET", percorso: "/api/states", senzaGzip: true },
          chi,
        )
        .then(corpoDi);
    const senzaUtente = await chiedi({ chiChiede: "", puoAmministrare: false });
    assert.equal(senzaUtente.includes("gettone-"), false);
    assert.equal(senzaUtente.includes("light.sala"), true);

    const lei = await chiedi({ chiChiede: LEI, amministra: false, puoAmministrare: false });
    assert.equal(lei.includes("gettone-della-camera-da-letto"), true);

    const chiAmministra = await chiedi({ chiChiede: LUI, amministra: true, puoAmministrare: true });
    assert.equal(chiAmministra.includes("gettone-della-camera-da-letto"), true);
  } finally {
    spegni();
  }
});
