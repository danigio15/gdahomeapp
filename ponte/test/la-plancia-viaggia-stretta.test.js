/* «In Home Assistant la plancia ci mette tantissimo a caricare, dall'app si
 * apre subito.»
 *
 * Da un video di un tablet di casa: Home Assistant ci mette i suoi quattro
 * secondi ad accendersi, e poi la testata di gdahome resta a «Caricamento…»
 * dal quinto al quindicesimo secondo. Dieci secondi di schermo fermo.
 *
 * Il motivo, letto e misurato. Sul filo del telefono i moduli della plancia
 * viaggiano a pacchi e compressi — e' tutto in `commissioni.js`, ed e' il
 * lavoro che aveva tolto i sei secondi dell'apertura da fuori casa. Dentro
 * Home Assistant invece la pagina li chiede uno per uno all'ingress, e
 * l'ingress li serviva **in chiaro**: i trecentosessantotto file che la pagina
 * chiede all'apertura sono nove megabyte e mezzo cosi', e tre compressi. Il
 * sessantotto per cento di roba che non doveva viaggiare.
 *
 * E non bastava comprimerli e basta: sempre misurato, leggerli tutti tiene
 * fermo il filo di Node per novantaquattro millesimi, leggerli e stringerli
 * per trecentodieci. Node ha un filo solo, e quel tempo non e' distribuito:
 * e' una fila. Per questo si stringe una volta e ci si tiene il risultato —
 * nell'indirizzo c'e' l'impronta del contenuto, quindi finche' l'add-on e'
 * acceso quei file non cambiano.
 *
 * Misurato dopo: 2,95 MB invece di 9,34, il primo browser dopo l'avvio paga
 * duecentoquarantacinque millesimi una volta sola, e dal secondo in poi
 * rispondere costa tre millesimi in tutto.
 *
 * Queste prove tengono le tre cose che possono tornare indietro: che si
 * stringa, che si stringa **una volta sola**, e che non si stringa a chi non
 * sa aprirlo.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import { BASE, Plancia } from "../src/plancia.js";

/* Un modulo lungo abbastanza da valere la pena di stringerlo, e ripetitivo
 * abbastanza che stringerlo si veda. Sotto i 512 byte non si comprime, ed e'
 * giusto cosi': l'intestazione costa quanto il risparmio. */
const UN_MODULO = `export const cose = ${JSON.stringify(
  Array.from({ length: 400 }, (_, i) => `una cosa che si ripete, la numero ${i}`),
)};\n`;

function planciaFinta({ installatore = null } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "plancia-stretta-"));
  mkdirSync(join(cartella, "legacy"), { recursive: true });
  mkdirSync(join(cartella, "src", "core"), { recursive: true });
  mkdirSync(join(cartella, "avatars"), { recursive: true });
  writeFileSync(join(cartella, "legacy", "dashboard.html"), "<!DOCTYPE html><html></html>");
  writeFileSync(join(cartella, "src", "core", "cose.js"), UN_MODULO);
  writeFileSync(join(cartella, "legacy", "dashboard-runtime-it.js"), UN_MODULO);
  writeFileSync(join(cartella, "legacy", "minuscolo.js"), "export const a = 1;\n");
  /* Un png finto, ma con la firma vera: quello che conta e' l'estensione, che
   * decide il tipo, che decide se si stringe. */
  writeFileSync(join(cartella, "avatars", "uno.png"), Buffer.alloc(4096, 7));
  const plancia = new Plancia({ cartella, installatore });
  return { plancia, cartella, via: (dentro) => `${BASE}/${plancia.impronta}/${dentro}` };
}

test("un modulo esce stretto a chi sa aprirlo, e intero a chi non sa", () => {
  const { plancia, cartella, via } = planciaFinta();
  try {
    const dove = via("src/core/cose.js");
    const intero = plancia.daServire(dove, { accetta: "" });
    const stretto = plancia.daServire(dove, { accetta: "gzip, deflate, br" });

    assert.equal(intero.stato, 200);
    assert.equal(intero.codifica, undefined, "senza gzip non si stringe niente");

    assert.equal(stretto.stato, 200);
    assert.equal(stretto.codifica, "gzip");
    assert.ok(
      stretto.corpo.length < intero.corpo.length / 2,
      `stringerlo deve valere la pena: ${stretto.corpo.length} contro ${intero.corpo.length}`,
    );
    /* E quello che arriva deve essere **lo stesso file**, non un altro. */
    assert.deepEqual(gunzipSync(stretto.corpo), intero.corpo);
    /* Il tipo non cambia: cambia come viaggia, non cos'e'. */
    assert.equal(stretto.tipo, intero.tipo);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("un «gzip;q=0» e' un no, e si rispetta", () => {
  /* E' il modo con cui un browser in difficolta' chiede di essere lasciato in
   * pace. Cercare la parola «gzip» e basta lo avrebbe ignorato. */
  const { plancia, cartella, via } = planciaFinta();
  try {
    const dove = via("src/core/cose.js");
    for (const detto of ["gzip;q=0", "deflate, gzip;q=0.0", "gzip ; q = 0 , br"]) {
      assert.equal(plancia.daServire(dove, { accetta: detto }).codifica, undefined, detto);
    }
    for (const detto of ["gzip", "gzip;q=1.0", "br, gzip;q=0.8"]) {
      assert.equal(plancia.daServire(dove, { accetta: detto }).codifica, "gzip", detto);
    }
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("un'immagine non si stringe, e non occupa memoria", () => {
  /* Un png e' gia' compresso: ripassarci sopra costa filo e non toglie un
   * byte. Ed e' anche il motivo per cui il tetto della memoria non si
   * raggiunge mai: i sette megabyte di ritratti e loghi non entrano. */
  const { plancia, cartella, via } = planciaFinta();
  try {
    const letto = plancia.daServire(via("../avatars/uno.png").replace("../", ""), {
      accetta: "gzip",
    });
    const png = plancia.daServire(`${BASE}/avatars/uno.png`, { accetta: "gzip" });
    assert.equal(png.stato, 200);
    assert.equal(png.codifica, undefined, "un png non si stringe");
    assert.equal(plancia.quantoAMente, 0, "e non si tiene a mente");
    assert.equal(letto.stato, 404, "l'impronta non copre le cartelle fisse");
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("un file minuscolo si manda com'e'", () => {
  const { plancia, cartella, via } = planciaFinta();
  try {
    const letto = plancia.daServire(via("legacy/minuscolo.js"), { accetta: "gzip" });
    assert.equal(letto.stato, 200);
    assert.equal(letto.codifica, undefined);
    assert.equal(plancia.quantoAMente, 0);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("si stringe una volta sola: dalla seconda domanda risponde la memoria", () => {
  const { plancia, cartella, via } = planciaFinta();
  try {
    const dove = via("src/core/cose.js");
    const primo = plancia.daServire(dove, { accetta: "gzip" });
    const tenuto = plancia.quantoAMente;
    assert.ok(tenuto > 0, "il primo giro deve lasciare qualcosa a mente");

    const secondo = plancia.daServire(dove, { accetta: "gzip" });
    assert.ok(secondo.corpo === primo.corpo, "la seconda volta e' lo stesso identico corpo");
    assert.equal(plancia.quantoAMente, tenuto, "e non si ricorda due volte la stessa cosa");

    /* E chi la vuole dimenticare puo'. */
    plancia.dimentica();
    assert.equal(plancia.quantoAMente, 0);
    const terzo = plancia.daServire(dove, { accetta: "gzip" });
    assert.deepEqual(terzo.corpo, primo.corpo, "riletto dal disco dice la stessa cosa");
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("il runtime si ricorda per installatore, non una volta per tutti", () => {
  /* E' l'unico file stretto che cambia con chi ha montato l'impianto: dentro
   * c'e' il nome scritto accanto al logo. L'installatore si abbina e si toglie
   * mentre il ponte gira — per questo `Plancia` riceve una funzione e non un
   * oggetto — e una memoria che non lo guardasse servirebbe il nome di ieri. */
  let chi = { nome: "Rossi Impianti" };
  const { plancia, cartella, via } = planciaFinta({ installatore: () => chi });
  try {
    const dove = via("legacy/dashboard-runtime-it.js");
    const conRossi = plancia.daServire(dove, { accetta: "gzip" });
    const dopoRossi = plancia.quantoAMente;
    assert.ok(dopoRossi > 0, "il primo giro deve lasciare qualcosa a mente");

    /* Ancora Rossi: non si ricorda due volte la stessa cosa. */
    plancia.daServire(dove, { accetta: "gzip" });
    assert.equal(plancia.quantoAMente, dopoRossi);

    chi = { nome: "Bianchi Elettro" };
    const conBianchi = plancia.daServire(dove, { accetta: "gzip" });
    assert.ok(
      plancia.quantoAMente > dopoRossi,
      "cambiato l'installatore, deve nascere una seconda voce a mente",
    );
    /* Questo modulo finto non porta il nome, quindi i due corpi escono uguali:
     * la prova non e' sul contenuto, e' che la memoria si accorga del cambio
     * invece di rispondere con la voce di prima senza guardare chi chiede. */
    assert.deepEqual(gunzipSync(conBianchi.corpo), gunzipSync(conRossi.corpo));
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("le due porte servono la plancia dallo stesso posto", () => {
  /* Le porte sono due — quella dell'app e quella dell'ingress di Home
   * Assistant — e servono gli stessi file. Erano due copie della stessa
   * risposta, ed e' cosi' che la compressione e' finita su una sola: il filo
   * del telefono la aveva, l'ingress no. */
  const sorgente = readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  const chiamate = (sorgente.match(/serviLaPlancia\(\{[^}]*\}\);/g) || []).length;
  assert.equal(chiamate, 2, "le due porte devono chiamare lo stesso aiutante, e nessun'altra");
  const scritte = (sorgente.match(/function serviLaPlancia\(/g) || []).length;
  assert.equal(scritte, 1, "e l'aiutante deve essere scritto una volta sola");
  assert.doesNotMatch(
    sorgente,
    /plancia\.leggi\(via\)/,
    "nessuna porta deve tornare a leggere per conto suo",
  );
  /* Chi sta in mezzo deve sapere che la risposta cambia con quello che il
   * browser sa aprire, o un giorno serve il corpo stretto a chi non lo apre. */
  assert.match(sorgente, /vary:\s*"accept-encoding"/);
  assert.match(sorgente, /"content-encoding":\s*letto\.codifica/);
});

test("la tessera fa le sue due domande insieme, non in fila", () => {
  /* Dov'e' l'add-on e una sessione per entrarci sono due giri sul filo verso
   * il Supervisore, e non si servono a vicenda. In fila si aspettava la somma
   * dei due invece del piu' lento, e sono i primi due giri di un'attesa che
   * dal tablet si vede tutta come schermo fermo. */
  const carta = readFileSync(new URL("../carta/plancia.js", import.meta.url), "utf8");
  assert.match(carta, /Promise\.all\(\[this\._doveSta\(slug\), this\._laSessione\(\)\]\)/);
  /* E prima delle due, la domanda che non costa niente: c'e' un add-on da
   * aprire? Senza, si chiederebbe una sessione d'ingresso per nessuno. */
  assert.match(carta, /const slug = this\._ilSlug\(\);\s*\n\s*const \[dove\] = await Promise\.all/);
  assert.doesNotMatch(
    carta,
    /const dove = await this\._doveSta\(\);\s*\n\s*await this\._laSessione\(\);/,
    "sono tornate in fila",
  );
});
