/* «Continua a chiedere il codice da web.»
 *
 * Dal telefono «Apri nel browser» apre il browser del sistema, a cui l'app
 * non puo' consegnare la chiave; e la chiave nell'indirizzo non ci va. Ci va
 * un biglietto: l'app lo chiede con la chiave, il browser lo cambia con la
 * chiave, una volta sola ed entro un minuto (`src/biglietti.js`). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { alzaIlQuadro } from "../src/index.js";
import { BIGLIETTI_PER_UNO, BIGLIETTO_DURA, Biglietti } from "../src/biglietti.js";

const QUI = dirname(fileURLToPath(import.meta.url));
const CRUSCOTTO = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");
const CHIAVE_DEL_GESTORE = "una-chiave-lunga-abbastanza-per-il-gestore";

async function banco() {
  const cartella = mkdtempSync(join(tmpdir(), "biglietto-"));
  const acceso = await alzaIlQuadro({
    porta: 0,
    cartella,
    livello: "errore",
    chiaveDelGestore: CHIAVE_DEL_GESTORE,
  });
  const dove = `http://127.0.0.1:${acceso.porta}`;
  const gestore = (via, opzioni = {}) =>
    fetch(`${dove}/gestore${via}`, {
      ...opzioni,
      headers: {
        authorization: `Bearer ${CHIAVE_DEL_GESTORE}`,
        "content-type": "application/json",
        ...(opzioni.headers || {}),
      },
    });
  const rossi = await (
    await gestore("/installatori", {
      method: "POST",
      body: JSON.stringify({ nome: "Impianti Rossi" }),
    })
  ).json();
  const retro = (via, opzioni = {}, chiave = rossi.chiave) =>
    fetch(`${dove}/console${via}`, {
      ...opzioni,
      headers: {
        authorization: `Bearer ${chiave}`,
        "content-type": "application/json",
        ...(opzioni.headers || {}),
      },
    });
  /* Come bussa il browser: senza nessuna chiave. */
  const entra = (corpo) =>
    fetch(`${dove}/console/entra`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
    });
  return {
    rossi,
    gestore,
    retro,
    entra,
    async chiudi() {
      await acceso.spegni();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

test("l'app chiede un biglietto con la chiave, e il browser lo cambia con la chiave una volta sola", async () => {
  const b = await banco();
  try {
    const staccato = await b.retro("/biglietto", { method: "POST" });
    assert.equal(staccato.status, 200);
    const { biglietto, scade } = await staccato.json();
    assert.match(biglietto, /^[0-9a-f]{32}$/, "un biglietto e' una cosa a caso, lunga");
    assert.ok(scade > Date.now() && scade <= Date.now() + BIGLIETTO_DURA, "vale un minuto");

    const prima = await b.entra({ biglietto });
    assert.equal(prima.status, 200);
    assert.deepEqual(await prima.json(), { chiave: b.rossi.chiave });

    /* Letto, e' carta straccia: in cronologia resta quella. */
    const seconda = await b.entra({ biglietto });
    assert.equal(seconda.status, 410);
    assert.equal((await seconda.json()).errore, "questo biglietto non vale piu'");

    /* E un biglietto inventato, o niente, non apre. */
    assert.equal((await b.entra({ biglietto: "0".repeat(32) })).status, 410);
    assert.equal((await b.entra({})).status, 410);
    assert.equal((await b.entra("non json")).status, 410);
  } finally {
    await b.chiudi();
  }
});

test("senza una chiave buona non si stacca nessun biglietto", async () => {
  const b = await banco();
  try {
    const senza = await b.retro("/biglietto", { method: "POST" }, "non-e-una-chiave");
    assert.equal(senza.status, 401);
  } finally {
    await b.chiudi();
  }
});

test("un installatore tolto nel frattempo non entra col biglietto", async () => {
  const b = await banco();
  try {
    const { biglietto } = await (await b.retro("/biglietto", { method: "POST" })).json();
    assert.equal(
      (await b.gestore(`/installatore/${b.rossi.chi}`, { method: "DELETE" })).status,
      200,
    );
    assert.equal((await b.entra({ biglietto })).status, 410);
  } finally {
    await b.chiudi();
  }
});

test("un biglietto dura un minuto, e uno stesso installatore non ne accumula", () => {
  let ora = 1_000_000;
  let conto = 0;
  const biglietti = new Biglietti({ adesso: () => ora, nuovo: () => `b${(conto += 1)}` });
  const { biglietto, scade } = biglietti.stacca("rossi", "la-chiave");
  assert.equal(scade, ora + BIGLIETTO_DURA);
  ora += BIGLIETTO_DURA - 1;
  assert.deepEqual(biglietti.riscatta(biglietto), { chi: "rossi", chiave: "la-chiave" });
  /* Una volta sola. */
  assert.equal(biglietti.riscatta(biglietto), null);

  const tardi = biglietti.stacca("rossi", "la-chiave").biglietto;
  ora += BIGLIETTO_DURA;
  assert.equal(biglietti.riscatta(tardi), null, "allo scoccare del minuto non vale piu'");
  assert.equal(biglietti.quanti, 0, "e non resta in giro");

  /* Il tetto: oltre, se ne va il piu' vecchio, e quelli degli altri restano. */
  const altrui = biglietti.stacca("bianchi", "altra-chiave").biglietto;
  const suoi = [];
  for (let i = 0; i < BIGLIETTI_PER_UNO + 2; i += 1)
    suoi.push(biglietti.stacca("rossi", "la-chiave").biglietto);
  assert.equal(biglietti.quanti, BIGLIETTI_PER_UNO + 1);
  assert.equal(biglietti.riscatta(suoi[0]), null, "il primo e' andato");
  assert.equal(biglietti.riscatta(suoi[1]), null, "e il secondo");
  assert.notEqual(biglietti.riscatta(suoi[suoi.length - 1]), null, "l'ultimo c'e'");
  assert.notEqual(biglietti.riscatta(altrui), null, "quello di un altro non si tocca");
  assert.equal(biglietti.riscatta(undefined), null);
});

test("il cruscotto riscatta il biglietto dall'indirizzo, e lo toglie prima di tutto", () => {
  assert.match(CRUSCOTTO, /new URLSearchParams\(location\.search\)\.get\("biglietto"\)/);
  assert.match(
    CRUSCOTTO,
    /history\.replaceState\(null, "", location\.pathname \+ location\.hash\)/,
  );
  assert.match(CRUSCOTTO, /async function entraColBiglietto\(biglietto\)/);
  assert.match(CRUSCOTTO, /fetch\("entra", \{\s*method: "POST"/);
  /* Con un biglietto la pagina non parte chiedendo la chiave: aspetta la risposta. */
  assert.match(CRUSCOTTO, /\} else \{\s*void apri\(\);\s*\}/);
  assert.match(CRUSCOTTO, /if \(BIGLIETTO\) void entraColBiglietto\(BIGLIETTO\);/);
  /* E la chiave che arriva si tratta come una consegnata: quella battuta resta padrona. */
  const riscatto = CRUSCOTTO.slice(CRUSCOTTO.indexOf("async function entraColBiglietto"));
  assert.match(riscatto, /consegnata = arrivata;\s*if \(!chiave\) \{/);
});
