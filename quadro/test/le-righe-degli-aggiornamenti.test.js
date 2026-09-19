/* Come il quadro disegna un aggiornamento: il segno, e cosa cambia.
 *
 * Queste due righe prendono roba che arriva da una casa — il nome di un
 * aggiornamento, il marchio di chi lo porta, le note della versione, un
 * indirizzo — e la mettono dentro l'HTML di questa pagina. E' l'unico posto
 * del quadro dove del testo di fuori diventa disegno, ed e' esattamente il
 * posto dove si sbaglia.
 *
 * Il ponte quei campi se li controlla gia'. Non basta: fra il ponte e questa
 * pagina c'e' una rete, e un controllo solo da una parte della rete non e' un
 * controllo. Qui si prova quello di **questa** parte.
 *
 * Le funzioni stanno dentro un `<script>` di una pagina, quindi nessuno le
 * puo' importare. Si prende il pezzo di sorgente fra due segni fissi e lo si
 * compila: e' lo stesso programma che gira nel browser, non una copia.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const PAGINA = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");

const DA = "const testo = (cosa) =>";
const A = "const spia = (stato) =>";

function iPezzi() {
  const da = PAGINA.indexOf(DA);
  const a = PAGINA.indexOf(A);
  assert.ok(da > 0 && a > da, "i segni per ritagliare il programma non ci sono piu'");
  return new Function(`${PAGINA.slice(da, a)}; return { ilSegnoDi, cosaCambia, unaRiga };`)();
}

test("il marchio si ricontrolla qui, non solo nel ponte", () => {
  const { ilSegnoDi } = iPezzi();
  /* Questa parola finisce dentro un indirizzo, e chi lo compone e' questa
   * pagina: una barra o due punti la porterebbero da un'altra parte. */
  for (const storto of [
    "../../altro",
    "zha/icon.png",
    "https://altrove.invalid/x",
    'x" onload="alert(1)',
    "ZHA",
  ]) {
    const disegnato = ilSegnoDi({ nome: "Switch", marchio: storto });
    assert.ok(!disegnato.includes("<img"), `«${storto}» non deve diventare un'immagine`);
    assert.ok(!disegnato.includes(storto), `«${storto}» non deve finire nella pagina`);
  }
});

test("un marchio buono diventa un'immagine dai marchi di Home Assistant, e nient'altro", () => {
  const { ilSegnoDi } = iPezzi();
  const disegnato = ilSegnoDi({ nome: "Switch casa", marchio: "shelly" });
  assert.match(disegnato, /src="https:\/\/brands\.home-assistant\.io\/shelly\/icon\.png"/);
  /* E sotto c'e' l'iniziale: una casa senza internet, o un marchio che non
   * esiste, finiscono sulla lettera invece che su un quadratino rotto. */
  assert.match(disegnato, />S</);
  assert.match(disegnato, /onerror="this\.remove\(\)"/);
});

test("la roba nostra porta il bollo del quadro, che non si scarica da nessuna parte", () => {
  const { ilSegnoDi } = iPezzi();
  const disegnato = ilSegnoDi({ nome: "gdahome", nostra: true, marchio: "hassio" });
  assert.match(disegnato, /class="bollo"/);
  assert.ok(!disegnato.includes("<img"), "il nostro segno non va a chiedere niente fuori");
});

test("cosa cambia si disegna come testo, non come programma", () => {
  const { cosaCambia } = iPezzi();
  const disegnato = cosaCambia({
    cosaCambia: '<img src=x onerror="alert(1)"> & <b>grassetto</b>',
  });
  assert.ok(!disegnato.includes("<img"), "un tag dalle note non deve diventare un tag");
  assert.ok(!disegnato.includes("<b>"), "nemmeno uno innocuo: qui dentro non si fida di niente");
  assert.match(disegnato, /&lt;img/);
  assert.match(disegnato, /&amp;/);
});

test("l'indirizzo delle note diventa un collegamento solo se e' https", () => {
  const { cosaCambia } = iPezzi();
  for (const storto of [
    "javascript:alert(1)",
    "http://example.invalid/note",
    'https://example.invalid/" onmouseover="alert(1)',
    "data:text/html,<script>",
  ]) {
    const disegnato = cosaCambia({ cosaCambia: "qualcosa", note: storto });
    assert.ok(!disegnato.includes("<a "), `«${storto}» non deve diventare un collegamento`);
  }
  const buono = cosaCambia({ cosaCambia: "qualcosa", note: "https://example.invalid/note" });
  assert.match(buono, /<a href="https:\/\/example\.invalid\/note"/);
  /* Si apre fuori, e senza portarsi dietro questa pagina. */
  assert.match(buono, /rel="noopener noreferrer"/);
});

test("chi non ha niente da dire non occupa una riga vuota", () => {
  const { cosaCambia } = iPezzi();
  assert.equal(cosaCambia({}), "");
  assert.equal(cosaCambia({ cosaCambia: "   ", note: "" }), "");
});

test("la riga e' una sola, e la usano tutt'e due le schermate", () => {
  /* Prima erano due disegni per la stessa cosa — righe nella scheda di una
   * casa, pastigline nella flotta — e nella flotta non si vedeva ne' il logo
   * ne' cosa cambiava. Due disegni per una cosa sola vuol dire che uno resta
   * indietro, ed era sempre lo stesso. */
  const quante = [...PAGINA.matchAll(/(?<!function )unaRiga\(uno/g)].length;
  assert.equal(quante, 2, "le due schermate non disegnano piu' la stessa riga");
  const { unaRiga } = iPezzi();
  const disegnata = unaRiga(
    { nome: "Shelly", da: "1.2.0", a: "1.3.0", marchio: "shelly", cosaCambia: "Risolve il buio." },
    { fare: '<button type="button" class="tasto">Installa</button>' },
  );
  assert.match(disegnata, /Shelly/);
  assert.match(disegnata, /1\.2\.0 → 1\.3\.0/);
  assert.match(disegnata, /Risolve il buio\./);
  assert.match(disegnata, /Installa/);
});
