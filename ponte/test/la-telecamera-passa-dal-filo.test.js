/* Le telecamere dentro l'app passano dal filo: `ponte/http` → Supervisor →
 * `/api/camera_proxy/...`. Qui c'e' una casa finta vera, su una porta vera,
 * con una telecamera che risponde con un JPEG e con un MJPEG che non finisce,
 * e il ponte vero in mezzo.
 *
 * Quello che si prova sono le quattro promesse scritte in `commissioni.js`:
 *
 *  1. un fotogramma solo a chi e' entrato: una persona di Home Assistant,
 *     attiva adesso. Chi non si sa chi sia, chi e' stato tolto, chi e' stato
 *     spento — e la casa che non sa dire chi c'e' — no;
 *  2. il ponte non tiene niente: non scrive, non ricorda, non mette nei
 *     registri ne' i byte ne' il gettone dell'indirizzo;
 *  3. le plance riservate restano riservate, anche per l'immagine `image.*`;
 *  4. nessun lasciapassare lungo: dal telefono le vie delle telecamere non si
 *     fanno firmare, e dentro Home Assistant una firma vale dieci minuti.
 *
 * E in fondo il 501 del flusso MJPEG, che viene solo dopo tutto questo.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Casa } from "../src/casa.js";
import { Commissioni, TIPO } from "../src/commissioni.js";
import { Cucitura } from "../src/cucitura.js";
import { FIRMA_MASSIMA_S, passaLaDogana, perLaVia } from "../src/dogana.js";
import { Plance } from "../src/plance.js";
import { Configurazione } from "../src/configurazione.js";
import { UtentiDiCasa } from "../src/utenti.js";

const ZITTO = { info() {}, attenzione() {}, errore() {} };
const SEGNO = "il-segno-del-supervisor";
const GETTONE = "gettone-della-telecamera-da-non-scrivere";
const LEI = "a".repeat(32);
const LUI = "b".repeat(32);
const TOLTO = "c".repeat(32);
const SPENTO = "d".repeat(32);
const ADMIN = "e".repeat(32);

/* Un JPEG piccolo ma vero: comincia con FF D8 e finisce con FF D9. Il numero
 * dentro cambia a ogni scatto, per vedere che nessuno ricorda il vecchio. */
const MARCA = "istantanea-di-prova-nessuno-dentro";
const jpeg = (n) =>
  Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.from(`${MARCA}-${n}`),
    Buffer.from([0xff, 0xd9]),
  ]);

async function casaConTelecamere() {
  const viste = [];
  const flussiAperti = new Set();
  let scatti = 0;
  const server = createServer((richiesta, risposta) => {
    const url = new URL(richiesta.url || "/", "http://casa");
    viste.push({ percorso: url.pathname, segno: richiesta.headers.authorization || "" });
    if (richiesta.headers.authorization !== `Bearer ${SEGNO}`) {
      risposta.writeHead(401);
      risposta.end("401");
      return;
    }
    if (url.pathname.startsWith("/core/api/camera_proxy_stream/")) {
      /* Un MJPEG: un fotogramma ogni tanto, e la risposta non finisce mai. */
      risposta.writeHead(200, { "content-type": "multipart/x-mixed-replace;boundary=frame" });
      const manda = () =>
        risposta.write(
          Buffer.concat([
            Buffer.from("--frame\r\nContent-Type: image/jpeg\r\n\r\n"),
            jpeg(0),
            Buffer.from("\r\n"),
          ]),
        );
      manda();
      const ogni = setInterval(manda, 50);
      flussiAperti.add(ogni);
      risposta.on("close", () => {
        clearInterval(ogni);
        flussiAperti.delete(ogni);
      });
      return;
    }
    if (url.pathname.includes("/camera.rotta")) {
      /* Una telecamera che chiude la porta in faccia: il ponte lo scrive nei
       * registri, ed e' li' che si guarda che il gettone non ci finisca. */
      richiesta.socket.destroy();
      return;
    }
    if (
      url.pathname.startsWith("/core/api/camera_proxy/") ||
      url.pathname.startsWith("/core/api/image_proxy/")
    ) {
      scatti += 1;
      const corpo = jpeg(scatti);
      risposta.writeHead(200, { "content-type": "image/jpeg", "content-length": corpo.length });
      risposta.end(corpo);
      return;
    }
    risposta.writeHead(404);
    risposta.end();
  });
  await new Promise((pronto) => server.listen(0, "127.0.0.1", pronto));
  const { port } = server.address();
  return {
    indirizzo: `http://127.0.0.1:${port}/core`,
    viste,
    async spegni() {
      for (const ogni of flussiAperti) clearInterval(ogni);
      server.closeAllConnections();
      await new Promise((fatto) => server.close(fatto));
    },
  };
}

/* Gli utenti come li dice Home Assistant (`config/auth/list`): lei e lui ci
 * sono, quello spento c'e' ma e' spento, quello tolto non c'e'. */
function utentiDiCasa({ rotta = false } = {}) {
  const elenco = [
    { id: LEI, name: "Persona 1" },
    { id: LUI, name: "Persona 2" },
    { id: SPENTO, name: "Persona 3", is_active: false },
    { id: ADMIN, name: "Persona 4", group_ids: ["system-admin"] },
  ];
  const casa = {
    rotta,
    async chiedi(comando) {
      if (comando?.type !== "config/auth/list") throw new Error("non so");
      if (casa.rotta) throw new Error("Home Assistant non risponde");
      return elenco;
    },
  };
  const utenti = new UtentiDiCasa({ casa, registro: ZITTO, quantoVale: 0 });
  return { utenti, elenco, casa };
}

/* Tutti i file sotto una cartella, con quanto pesano. */
function cosaCeSulDisco(cartella) {
  const trovati = {};
  const giro = (dove) => {
    for (const nome of readdirSync(dove)) {
      const pieno = join(dove, nome);
      if (statSync(pieno).isDirectory()) giro(pieno);
      else trovati[pieno] = readFileSync(pieno);
    }
  };
  giro(cartella);
  return trovati;
}

async function banco({ rotta = false } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "telecamere-filo-"));
  const ha = await casaConTelecamere();
  const scritto = [];
  const registro = {
    info: (...detto) => scritto.push(detto.join(" ")),
    attenzione: (...detto) => scritto.push(detto.join(" ")),
    errore: (...detto) => scritto.push(detto.join(" ")),
  };
  const plance = new Plance({ cartella, registro });
  const riservata = plance.aggiungi("Riservata");
  plance.chiLaVede(riservata.profilo, [LEI]);
  const configurazione = new Configurazione({ cartella });
  configurazione.scrivi(riservata.profilo, {
    cd_telecamere: '["camera.camera_da_letto","camera.cancello"]',
    cd_scatti: '["image.camera_da_letto_ultimo_scatto"]',
  });
  configurazione.scrivi("primary", {
    cd_telecamere: '["camera.cancello","camera.cortile","camera.rotta"]',
    cd_scatti: '["image.cancello_ultimo_scatto"]',
  });
  const { utenti, casa: elencoDiCasa } = utentiDiCasa({ rotta });
  const con = new Commissioni({
    registro,
    plance,
    configurazione,
    utenti,
    casa: new Casa({ indirizzo: ha.indirizzo, segno: SEGNO }),
  });
  const chiedi = (percorso, chi = {}) =>
    con.rispondi({ id: 1, type: TIPO, metodo: "GET", percorso }, chi);
  return {
    cartella,
    ha,
    con,
    chiedi,
    scritto,
    elencoDiCasa,
    async spegni() {
      await ha.spegni();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

const lei = { chiChiede: LEI, amministra: false };
const lui = { chiChiede: LUI, amministra: false };

/* ─── 1. Solo a chi e' entrato ─────────────────────────────────────────── */

test("chi non si sa chi sia non vede nessuna telecamera, e Home Assistant non lo sa nemmeno", async () => {
  const b = await banco();
  try {
    for (const percorso of [
      "/api/camera_proxy/camera.cancello",
      `/api/camera_proxy/camera.cancello?token=${GETTONE}`,
      "/api/camera_proxy_stream/camera.cancello",
      "/api/image_proxy/image.cancello_ultimo_scatto",
      "/API/camera_proxy/camera.cancello",
    ]) {
      /* Senza nessuno; con «amministra» scritto ma nessun nome; e col
       * permesso di chi amministra ma senza un nome (un telefono abbinato
       * prima che i telefoni si intestassero a qualcuno). */
      for (const chi of [{}, { amministra: true }, { puoAmministrare: true }]) {
        const risposta = await b.chiedi(percorso, chi);
        assert.equal(risposta.success, false, `${percorso} ${JSON.stringify(chi)}`);
        /* Le maiuscole non portano da nessuna parte: di qui passa `/api/`. */
        assert.equal(
          risposta.error.code,
          percorso.startsWith("/API/") ? "not_allowed" : "unauthorized",
        );
      }
    }
    assert.deepEqual(b.ha.viste, [], "a Home Assistant non e' arrivato niente");
  } finally {
    await b.spegni();
  }
});

test("chi e' stato tolto o spento in Home Assistant non vede piu' le telecamere", async () => {
  const b = await banco();
  try {
    for (const chi of [TOLTO, SPENTO]) {
      const risposta = await b.chiedi("/api/camera_proxy/camera.cancello", {
        chiChiede: chi,
        amministra: false,
      });
      assert.equal(risposta.success, false, chi);
      assert.equal(risposta.error.code, "unauthorized");
    }
    assert.deepEqual(b.ha.viste, []);

    /* Lui c'e', e vede. Poi Home Assistant lo spegne: dal giro dopo
     * dell'elenco, con lo stesso filo ancora aperto, non vede piu'. */
    assert.equal((await b.chiedi("/api/camera_proxy/camera.cancello", lui)).success, true);
    const elenco = await b.elencoDiCasa.chiedi({ type: "config/auth/list" });
    elenco.find((uno) => uno.id === LUI).is_active = false;
    const dopo = await b.chiedi("/api/camera_proxy/camera.cancello", lui);
    assert.equal(dopo.success, false);
    assert.equal(dopo.error.code, "unauthorized");
  } finally {
    await b.spegni();
  }
});

test("se Home Assistant non sa dire chi c'e', le telecamere restano chiuse", async () => {
  const b = await banco({ rotta: true });
  try {
    const risposta = await b.chiedi("/api/camera_proxy/camera.cancello", lei);
    assert.equal(risposta.success, false);
    assert.equal(risposta.error.code, "unauthorized");
    assert.deepEqual(b.ha.viste, []);
  } finally {
    await b.spegni();
  }
});

test("a chi c'e' l'istantanea arriva intera, col segno del Supervisor", async () => {
  const b = await banco();
  try {
    const risposta = await b.chiedi("/api/camera_proxy/camera.cancello?dm_t=1", lui);
    assert.equal(risposta.success, true);
    assert.equal(risposta.result.stato, 200);
    assert.equal(risposta.result.tipo, "image/jpeg");
    assert.equal(risposta.result.compresso, undefined, "un JPEG non si ricomprime");
    assert.deepEqual(Buffer.from(risposta.result.corpo, "base64"), jpeg(1));
    const immagine = await b.chiedi("/api/image_proxy/image.cancello_ultimo_scatto", lui);
    assert.deepEqual(Buffer.from(immagine.result.corpo, "base64"), jpeg(2));
    assert.deepEqual(b.ha.viste, [
      { percorso: "/core/api/camera_proxy/camera.cancello", segno: `Bearer ${SEGNO}` },
      { percorso: "/core/api/image_proxy/image.cancello_ultimo_scatto", segno: `Bearer ${SEGNO}` },
    ]);
  } finally {
    await b.spegni();
  }
});

/* ─── 2. Il ponte non tiene niente ─────────────────────────────────────── */

test("il ponte non ricorda, non scrive e non registra le immagini", async () => {
  const b = await banco();
  try {
    const prima = cosaCeSulDisco(b.cartella);
    const uno = await b.chiedi(`/api/camera_proxy/camera.cancello?token=${GETTONE}`, lei);
    const due = await b.chiedi(`/api/camera_proxy/camera.cancello?token=${GETTONE}`, lei);
    /* Due domande, due viaggi fino a Home Assistant, due scatti diversi:
     * nessuna copia tenuta per il giro dopo. */
    assert.equal(b.ha.viste.length, 2);
    assert.deepEqual(Buffer.from(uno.result.corpo, "base64"), jpeg(1));
    assert.deepEqual(Buffer.from(due.result.corpo, "base64"), jpeg(2));
    /* Una che va storta: e' l'unica che finisce nei registri. */
    const rotta = await b.chiedi(`/api/camera_proxy/camera.rotta?token=${GETTONE}`, lei);
    assert.equal(rotta.success, false);
    assert.ok(
      b.scritto.some((riga) => riga.includes("/api/camera_proxy/camera.rotta")),
      "il guasto si racconta",
    );

    /* Sul disco non e' cambiato niente. */
    assert.deepEqual(cosaCeSulDisco(b.cartella), prima);
    for (const [nome, byte] of Object.entries(cosaCeSulDisco(b.cartella)))
      assert.equal(byte.includes(MARCA), false, nome);

    /* E nei registri: ne' i byte, ne' il loro base64, ne' il gettone. */
    const tutto = b.scritto.join("\n");
    assert.equal(tutto.includes(MARCA), false);
    assert.equal(tutto.includes(jpeg(1).toString("base64").slice(0, 12)), false);
    assert.equal(tutto.includes(GETTONE), false, "il gettone della telecamera non si scrive");
  } finally {
    await b.spegni();
  }
});

/* ─── 3. Le plance riservate restano riservate ────────────────────────── */

test("una telecamera di una plancia riservata non si apre a chi quella plancia non la vede", async () => {
  const b = await banco();
  try {
    for (const percorso of [
      "/api/camera_proxy/camera.camera_da_letto",
      "/api/camera_proxy_stream/camera.camera_da_letto",
      "/api/image_proxy/image.camera_da_letto_ultimo_scatto",
    ]) {
      const vietata = await b.chiedi(percorso, lui);
      assert.equal(vietata.success, false, percorso);
      assert.equal(vietata.error.code, "unauthorized", percorso);
    }
    assert.deepEqual(b.ha.viste, [], "a Home Assistant non e' arrivato niente");

    /* Quella che sta anche nella principale la vede. */
    const aperta = await b.chiedi("/api/camera_proxy/camera.cancello", lui);
    assert.deepEqual(Buffer.from(aperta.result.corpo, "base64"), jpeg(1));
    /* Lei la plancia riservata la vede, e vede anche le sue telecamere. */
    assert.equal((await b.chiedi("/api/camera_proxy/camera.camera_da_letto", lei)).success, true);
    assert.equal(
      (await b.chiedi("/api/image_proxy/image.camera_da_letto_ultimo_scatto", lei)).success,
      true,
    );
    /* E chi amministra Home Assistant le vede tutte, come in Home Assistant. */
    const admin = await b.chiedi("/api/camera_proxy/camera.camera_da_letto", {
      chiChiede: ADMIN,
      amministra: true,
      puoAmministrare: true,
    });
    assert.equal(admin.success, true);
  } finally {
    await b.spegni();
  }
});

test("dentro Home Assistant la dogana chiude le telecamere riservate come sul telefono", async () => {
  const b = await banco();
  try {
    const allaPagina = [];
    const allaCasa = [];
    const cucitura = new Cucitura({
      presa: { manda: (testo) => allaPagina.push(JSON.parse(testo)), chiudi() {} },
      casa: {
        apriIlFilo: async () => ({
          manda: (testo) => {
            allaCasa.push(JSON.parse(testo));
            return true;
          },
          chiudi() {},
        }),
      },
      commissioni: b.con,
      registro: ZITTO,
      chiGuarda: LUI,
      utenti: { amministratoreSubito: () => false, amministratore: async () => false },
    });
    await cucitura.avvia();
    cucitura.presa.onMessaggio(
      JSON.stringify({ id: 1, type: "camera/stream", entity_id: "camera.camera_da_letto" }),
    );
    cucitura.presa.onMessaggio(
      JSON.stringify({
        id: 2,
        type: "auth/sign_path",
        path: "/api/image_proxy/image.camera_da_letto_ultimo_scatto",
      }),
    );
    cucitura.presa.onMessaggio(
      JSON.stringify({ id: 3, type: "camera/stream", entity_id: "camera.cancello" }),
    );
    assert.deepEqual(
      allaCasa.map((detto) => detto.id),
      [3],
    );
    assert.deepEqual(
      allaPagina.filter((detto) => detto.success === false).map((detto) => detto.id),
      [1, 2],
    );
  } finally {
    await b.spegni();
  }
});

test("la via REST chiude anche l'immagine `image.*` di una telecamera riservata", () => {
  const chiuse = new Set(["image.camera_da_letto_ultimo_scatto"]);
  assert.ok(
    perLaVia({
      percorso: "/api/image_proxy/image.camera_da_letto_ultimo_scatto",
      telecamereChiuse: chiuse,
    }),
  );
  assert.equal(
    perLaVia({
      percorso: "/api/image_proxy/image.cancello_ultimo_scatto",
      telecamereChiuse: chiuse,
    }),
    null,
  );
});

/* ─── 4. Nessun lasciapassare lungo ────────────────────────────────────── */

test("dal telefono le vie delle telecamere non si fanno firmare da Home Assistant", () => {
  const firma = (id, path, telecamereChiuse = null) =>
    passaLaDogana(JSON.stringify({ id, type: "auth/sign_path", path, expires: 4 * 60 * 60 }), {
      amministra: false,
      telecamereChiuse,
      firmaIlPonte: true,
    });

  for (const path of [
    "/api/camera_proxy/camera.cancello",
    "/api/camera_proxy_stream/camera.cancello",
    "/api/image_proxy/image.cancello_ultimo_scatto",
  ]) {
    const { passa, rifiuti, risposte } = firma(7, path);
    assert.deepEqual(passa, [], "a Home Assistant non si chiede nessuna firma");
    assert.deepEqual(rifiuti, []);
    /* Il percorso torna nudo: senza firma non apre niente da nessuna parte,
     * e nell'app ogni fotogramma ripassa da `ponte/http`. */
    assert.deepEqual(risposte, [{ id: 7, type: "result", success: true, result: { path } }]);
    assert.equal(JSON.stringify(risposte).includes("authSig"), false);
  }

  /* Una telecamera chiusa non ha nemmeno il percorso nudo. */
  const chiusa = firma(
    8,
    "/api/camera_proxy/camera.camera_da_letto",
    new Set(["camera.camera_da_letto"]),
  );
  assert.deepEqual(chiusa.passa, []);
  assert.deepEqual(chiusa.risposte, []);
  assert.equal(chiusa.rifiuti[0].error.code, "unauthorized");

  /* Il calendario, che non e' una telecamera, si firma come prima. */
  const calendario = firma(9, "/api/calendars/calendar.casa");
  assert.equal(calendario.passa.length, 1);
  assert.deepEqual(calendario.risposte, []);
});

test("dentro Home Assistant una firma di una telecamera vale al massimo dieci minuti", () => {
  assert.equal(FIRMA_MASSIMA_S, 600);
  for (const [chiesti, avuti] of [
    [4 * 60 * 60, FIRMA_MASSIMA_S],
    [undefined, FIRMA_MASSIMA_S],
    [0, FIRMA_MASSIMA_S],
    [-5, FIRMA_MASSIMA_S],
    ["mille", FIRMA_MASSIMA_S],
    [30, 30],
  ]) {
    const { passa } = passaLaDogana(
      JSON.stringify({
        id: 1,
        type: "auth/sign_path",
        path: "/api/camera_proxy/camera.cancello",
        expires: chiesti,
      }),
      { amministra: true },
    );
    assert.equal(passa.length, 1);
    assert.equal(JSON.parse(passa[0]).expires, avuti, String(chiesti));
  }
});

/* ─── Il flusso MJPEG ──────────────────────────────────────────────────── */

test("il flusso MJPEG non passa dal filo: 501 subito, e Home Assistant non lo vede", async () => {
  const b = await banco();
  try {
    const partito = Date.now();
    const risposta = await b.chiedi("/api/camera_proxy_stream/camera.cancello", lei);
    assert.ok(Date.now() - partito < 1000, "non si aspetta che il flusso finisca");
    assert.equal(risposta.success, true);
    assert.equal(risposta.result.stato, 501);
    assert.deepEqual(b.ha.viste, [], "a Home Assistant non si e' chiesto il flusso");

    /* E le istantanee non restano in fila dietro di lui. */
    const insieme = await Promise.all(
      Array.from({ length: 9 }, (_, i) =>
        b.chiedi(
          i % 2
            ? "/api/camera_proxy_stream/camera.cortile"
            : `/api/camera_proxy/camera.cortile?dm_t=${i}`,
          lei,
        ),
      ),
    );
    assert.deepEqual(
      insieme.map((r) => r.result.stato),
      [200, 501, 200, 501, 200, 501, 200, 501, 200],
    );
  } finally {
    await b.spegni();
  }
});

test("il 501 viene dopo la dogana: a chi non puo', il flusso si nega e basta", async () => {
  const b = await banco();
  try {
    for (const chi of [{}, { chiChiede: TOLTO }, lui]) {
      const risposta = await b.chiedi("/api/camera_proxy_stream/camera.camera_da_letto", chi);
      assert.equal(risposta.success, false, JSON.stringify(chi));
      assert.equal(risposta.error.code, "unauthorized");
    }
  } finally {
    await b.spegni();
  }
});
