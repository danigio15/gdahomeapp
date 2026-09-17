/* Il pacco: gli stessi file, in una commissione sola.
 *
 * Dentro casa la plancia si apre subito: i file sono su una rete locale, e il
 * giro non si sente. Fuori casa il giro passa dal centralino, e la plancia a
 * freddo ne fa trecentosettantanove — misurato con un browser vero e ottanta
 * millesimi di giro: sei secondi, di cui cinque di andate e ritorni. Non sono
 * i byte, sono i giri.
 *
 * Quello che queste prove tengono fermo:
 *
 *  - **un file nel pacco e' identico a quello che tornerebbe da solo**. Il
 *    pacco non e' una strada nuova, e' la stessa strada fatta una volta: se un
 *    giorno i due modi dessero byte diversi, la plancia servita dall'app non
 *    sarebbe piu' la plancia;
 *  - un pacco non fa cadere niente: un file che non c'e' torna col suo stato
 *    dentro il pacco, e gli altri trentanove tornano;
 *  - il pacco non apre porte nuove. Chi non vede nessuna plancia non vede
 *    nemmeno un pacco, e di qui non passa niente che non sia un file della
 *    plancia;
 *  - il pacco **sta nel telaio**. La presa si ferma a un megabyte, qui e sul
 *    centralino: un pacco che non ci sta e' una plancia che non si apre, ed e'
 *    peggio di una plancia lenta.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import {
  Commissioni,
  eUnaCommissione,
  NIENTE_PER_TE,
  TIPO,
  TIPO_MOLTI,
} from "../src/commissioni.js";
import { Plancia } from "../src/plancia.js";
import { Plance } from "../src/plance.js";

const ZITTO = { info() {}, attenzione() {}, errore() {} };
const IO = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const LEI = "0f9e8d7c6b5a49382716f5e4d3c2b1a0";

/* Il telaio della presa, che e' il vero limite di un pacco. */
const TELAIO = 1024 * 1024;

const plancia = new Plancia();
const con = new Commissioni({ registro: ZITTO, plancia });
const dove = (relativo) => `${plancia.base}/${relativo}`;

/* I moduli che la pagina precarica: e' l'elenco vero, quello che il servitore
 * legge dalla pagina per riempire i pacchi. */
function iModuliDellaPagina(quanti) {
  const pagina = plancia.leggi(dove("legacy/dashboard.html")).corpo.toString("utf8");
  const fuori = [];
  for (const riga of pagina.match(/rel="modulepreload"\s+href="[^"]+"/g) || []) {
    const quale = riga.match(/href="([^"]+)"/)[1];
    if (!quale.startsWith("../")) continue;
    fuori.push(dove(quale.replace(/^\.\.\//, "")));
    if (fuori.length >= quanti) break;
  }
  return fuori;
}

test("un file nel pacco e' identico a quello che torna da solo", async (t) => {
  if (!plancia.cE) return t.skip("senza plancia non c'e' niente da impacchettare");
  const quali = iModuliDellaPagina(12);
  assert.equal(quali.length, 12, "la pagina precarica dei moduli");

  const pacco = await con.rispondi({ id: 1, type: TIPO_MOLTI, percorsi: quali });
  assert.equal(pacco.success, true);
  assert.deepEqual(Object.keys(pacco.result.file), quali);

  for (const quale of quali) {
    const solo = await con.rispondi({ id: 2, type: TIPO, percorso: quale });
    assert.deepEqual(pacco.result.file[quale], solo.result, quale);
  }
});

test("e si apre: dentro c'e' un modulo, non byte qualunque", async (t) => {
  if (!plancia.cE) return t.skip("senza plancia non c'e' niente da impacchettare");
  const quali = iModuliDellaPagina(3);
  const pacco = await con.rispondi({ id: 1, type: TIPO_MOLTI, percorsi: quali });
  for (const quale of quali) {
    const uno = pacco.result.file[quale];
    assert.equal(uno.stato, 200, quale);
    const byte = Buffer.from(uno.corpo, "base64");
    const testo = (uno.compresso === "gzip" ? gunzipSync(byte) : byte).toString("utf8");
    assert.match(testo, /\b(import|export|function|const)\b/, quale);
  }
});

test("senza gzip vale per tutto il pacco, come per un file solo", async (t) => {
  if (!plancia.cE) return t.skip("senza plancia non c'e' niente da impacchettare");
  const quali = iModuliDellaPagina(4);
  const pacco = await con.rispondi({ id: 1, type: TIPO_MOLTI, percorsi: quali, senzaGzip: true });
  for (const quale of quali) {
    assert.equal(pacco.result.file[quale].compresso, undefined, quale);
    assert.match(Buffer.from(pacco.result.file[quale].corpo, "base64").toString("utf8"), /\S/);
  }
});

test("un file che non c'e' torna col suo stato, e gli altri tornano", async (t) => {
  if (!plancia.cE) return t.skip("senza plancia non c'e' niente da impacchettare");
  const buoni = iModuliDellaPagina(2);
  const pacco = await con.rispondi({
    id: 1,
    type: TIPO_MOLTI,
    percorsi: [buoni[0], dove("src/core/questo-non-esiste.js"), buoni[1]],
  });
  assert.equal(pacco.success, true);
  assert.equal(pacco.result.file[buoni[0]].stato, 200);
  assert.equal(pacco.result.file[buoni[1]].stato, 200);
  assert.equal(pacco.result.file[dove("src/core/questo-non-esiste.js")].stato, 404);
});

test("un percorso chiesto due volte si serve una volta", async (t) => {
  if (!plancia.cE) return t.skip("senza plancia non c'e' niente da impacchettare");
  const [uno] = iModuliDellaPagina(1);
  const pacco = await con.rispondi({ id: 1, type: TIPO_MOLTI, percorsi: [uno, uno, uno] });
  assert.deepEqual(Object.keys(pacco.result.file), [uno]);
});

test("un pacco vuoto, o che non e' un elenco, non e' un pacco", async () => {
  for (const percorsi of [undefined, null, [], "/x", {}, 3]) {
    const detto = await con.rispondi({ id: 1, type: TIPO_MOLTI, percorsi });
    assert.equal(detto.success, false, String(percorsi));
    assert.equal(detto.error.code, "not_allowed");
  }
});

test("quaranta file per pacco, e non quarantuno", async (t) => {
  if (!plancia.cE) return t.skip("senza plancia non c'e' niente da impacchettare");
  const quaranta = iModuliDellaPagina(41);
  assert.equal(quaranta.length, 41, "la pagina ne precarica piu' di quaranta");

  const troppi = await con.rispondi({ id: 1, type: TIPO_MOLTI, percorsi: quaranta });
  assert.equal(troppi.success, false);
  assert.match(troppi.error.message, /40/);

  const giusti = await con.rispondi({
    id: 2,
    type: TIPO_MOLTI,
    percorsi: quaranta.slice(0, 40),
  });
  assert.equal(giusti.success, true);
});

test("nel pacco vanno solo i file della plancia", async () => {
  /* Il pacco e' fatto per l'elenco che scrive la pagina, e quell'elenco e'
   * fatto di moduli. Una chiamata a Home Assistant dentro un pacco terrebbe
   * fermi gli altri trentanove ad aspettare, e non e' quello che serve. */
  for (const quale of ["/api/states", "/local/foto.jpg", "/dashboardmodern_staticX/x.js", "x.js"]) {
    const detto = await con.rispondi({ id: 1, type: TIPO_MOLTI, percorsi: [quale] });
    assert.equal(detto.success, false, quale);
    assert.equal(detto.error.code, "not_allowed", quale);
  }
});

test("il pacco si ferma quando e' pieno, e resta dentro il telaio", async (t) => {
  if (!plancia.cE) return t.skip("senza plancia non c'e' niente da impacchettare");
  /* I due runtime sono i file piu' grossi della plancia: centosettantasei
   * kilobyte compressi ognuno. Con dieci moduli dietro, il pacco si riempie
   * prima di arrivare in fondo — e quello che torna deve stare nel telaio. */
  const grossi = [dove("legacy/dashboard-runtime-it.js"), dove("legacy/dashboard-runtime-en.js")];
  const percorsi = [...grossi, ...iModuliDellaPagina(38)];
  const pacco = await con.rispondi({ id: 1, type: TIPO_MOLTI, percorsi });
  assert.equal(pacco.success, true);

  const quanti = Object.keys(pacco.result.file).length;
  assert.ok(quanti >= 2, `dentro ci sta almeno il primo: ${quanti}`);
  assert.ok(quanti < percorsi.length, `si e' fermato prima della fine: ${quanti}`);

  /* Il pacco viaggia come JSON dentro una busta cifrata: quello che si misura
   * e' il JSON, che e' la cosa che il telaio deve portare. */
  const quanto = Buffer.byteLength(JSON.stringify(pacco), "utf8");
  assert.ok(quanto < TELAIO, `il pacco sta nel telaio: ${quanto} byte`);

  /* E quelli rimasti fuori non ci sono: chi li ha chiesti li richiede. */
  for (const quale of percorsi.slice(quanti)) {
    assert.equal(pacco.result.file[quale], undefined, quale);
  }
});

test("anche un pacco pieno di file piccoli sta nel telaio", async (t) => {
  if (!plancia.cE) return t.skip("senza plancia non c'e' niente da impacchettare");
  const pacco = await con.rispondi({
    id: 1,
    type: TIPO_MOLTI,
    percorsi: iModuliDellaPagina(40),
  });
  const quanto = Buffer.byteLength(JSON.stringify(pacco), "utf8");
  assert.ok(quanto < TELAIO, `${quanto} byte`);
});

test("chi non vede nessuna plancia non vede nemmeno un pacco", async (t) => {
  if (!plancia.cE) return t.skip("senza plancia non c'e' niente da impacchettare");
  const cartella = mkdtempSync(join(tmpdir(), "pacco-"));
  try {
    const plance = new Plance({ cartella, registro: ZITTO });
    plance.chiLaVede("primary", [LEI]);
    const solaDiLei = new Commissioni({ registro: ZITTO, plancia, plance });

    const quali = iModuliDellaPagina(3);
    const suo = await solaDiLei.rispondi(
      { id: 1, type: TIPO_MOLTI, percorsi: quali },
      { chiChiede: LEI },
    );
    assert.equal(suo.success, true, "a lei si'");
    const mio = await solaDiLei.rispondi(
      { id: 2, type: TIPO_MOLTI, percorsi: quali },
      { chiChiede: IO },
    );
    assert.equal(mio.success, false, "a me no");
    assert.equal(mio.error.code, NIENTE_PER_TE);
    assert.equal(mio.id, 2, "e il no porta il numero della domanda");
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("il filo riconosce un pacco senza aprire il messaggio", () => {
  /* La prima cosa che il ponte fa di ogni messaggio e' guardare, senza
   * aprirlo, se e' roba sua: un filtro sbagliato qui vuol dire un pacco che
   * finisce in Home Assistant, che non sa cosa sia. */
  assert.equal(
    eUnaCommissione(JSON.stringify({ id: 1, type: TIPO_MOLTI, percorsi: ["/x"] })),
    true,
  );
});
