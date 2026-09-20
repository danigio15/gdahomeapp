/* La scheda di una casa si disegna in un modo solo, in tutt'e due le pagine.
 *
 * La gestione mostra le case di ogni installatore **come le vede lui**: la
 * stessa scheda, in sola lettura. Le due pagine sono due file, ognuno con il
 * suo `<script>`, e nessuno importa niente da nessuno: il programma che
 * disegna la scheda — i controlli, la macchina, la rete, gli add-on, le note
 * di un aggiornamento, l'icona di chi lo porta — sta copiato parola per
 * parola dal cruscotto alla gestione.
 *
 * Due copie sono due copie: il giorno che una cambia, l'altra resta
 * indietro, e nessuno se ne accorge finche' qualcuno non apre la pagina
 * giusta. Questa prova se ne accorge prima: prende le stesse funzioni dalle
 * due pagine e le vuole uguali. Se cambi il cruscotto, copia il pezzo anche
 * di la' — e' il prezzo di non avere un file in piu' da servire, ed e'
 * scritto qui perche' non sembri una svista.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const CRUSCOTTO = readFileSync(join(QUI, "..", "console", "index.html"), "utf8");
const GESTIONE = readFileSync(join(QUI, "..", "gestore", "index.html"), "utf8");

/* Le funzioni e le costanti che devono essere le stesse. */
const LE_STESSE = [
  "const plurale",
  "const cE",
  "function daQuanto",
  "const ilGiorno",
  "const livello",
  "const staLavorando",
  "const eLaStessa",
  "const quantiGiu",
  "function iNomiGiu",
  "const testo",
  "const IL_TITOLO",
  "const IL_PUNTO",
  "const LA_RIGA",
  "const IL_RECINTO",
  "const I_RIENTRI",
  "const I_SEGNI",
  "const SOLO_IL_WEB",
  "function iPezziDi",
  "const iSegniDi",
  "const perCercare",
  "function daQuellaVersione",
  "function ilMarkdown",
  "const comeVa",
  "const IL_BOLLINO",
  "const A_PAROLE",
  "function ilSegnoDi",
  "function cosaCambia",
  "function unaRiga",
  "const spia",
  "function laStriscia",
  "const TINTA_DI",
  "function anellino",
  "function apriGliArchi",
  "function unMetro",
  "function riquadroMuto",
  "function laMacchina",
  "function ilCartello",
  "function laRete",
  "function gliAddon",
];

/* Un pezzo del programma, dalla riga in cui comincia alla riga prima di
 * quella in cui comincia il pezzo dopo.
 *
 * Il programma sta in uno `<script>` formattato da prettier, quindi ogni
 * pezzo di primo livello comincia su una riga con sei spazi davanti e poi una
 * lettera; le righe dentro sono piu' rientrate, e la graffa che chiude sta a
 * sei spazi ma non e' una lettera. Cosi' si prende il pezzo intero, commenti
 * dentro compresi, e non quello prima o dopo. */
function ilPezzo(pagina, quale, nome) {
  const righe = pagina.split("\n");
  const inizio = righe.findIndex(
    (riga) => riga.startsWith(`      ${nome} `) || riga.startsWith(`      ${nome}(`),
  );
  assert.ok(inizio >= 0, `in ${quale} non c'e' piu' «${nome}»`);
  let fine = inizio + 1;
  while (fine < righe.length && !/^ {6}[A-Za-z\/]/.test(righe[fine])) fine += 1;
  return righe.slice(inizio, fine).join("\n").trimEnd();
}

for (const nome of LE_STESSE) {
  test(`«${nome}» e' lo stesso nelle due pagine`, () => {
    assert.equal(
      ilPezzo(GESTIONE, "gestore/index.html", nome),
      ilPezzo(CRUSCOTTO, "console/index.html", nome),
      `«${nome}» e' diverso fra il cruscotto e la gestione: chi ha cambiato l'uno deve copiare anche nell'altro`,
    );
  });
}

test("la gestione chiede le case di ognuno dalla sua via, e le mostra in sola lettura", () => {
  /* La via e' quella del gestore, e la scheda dice che si guarda e basta. */
  assert.match(GESTIONE, /\/installatore\/\$\{encodeURIComponent\(uno\.chi\)\}\/case/);
  assert.match(GESTIONE, /Solo lettura/);
  /* Da qui non parte nessun lavoro: niente tasti che installano o riavviano. */
  assert.doesNotMatch(GESTIONE, /data-installa=|data-riavvia=|data-molla=|data-rinomina=/);
  /* E il totale delle entita' di ogni casa si vede nell'elenco. */
  assert.match(GESTIONE, /<span class="entita"><b>/);
});

test("anche nella gestione le note di un aggiornamento passano dal markdown che scappa tutto", () => {
  /* E' lo stesso pezzo del cruscotto, e qui si compila per essere sicuri che
   * stia in piedi da solo anche di la'. */
  const DA = "const testo = (cosa) =>";
  const A = "/* Come va un controllo";
  const primo = GESTIONE.indexOf(DA);
  const ultimo = GESTIONE.indexOf(A, primo);
  assert.ok(primo >= 0 && ultimo > primo, "nella gestione non c'e' piu' il markdown");
  const { ilMarkdown } = new Function(`${GESTIONE.slice(primo, ultimo)}; return { ilMarkdown };`)();
  const disegnato = ilMarkdown("## 1.2\n\n<script>alert(1)</script> **forte**");
  assert.match(disegnato, /<h4>1\.2<\/h4>/);
  assert.match(disegnato, /&lt;script&gt;/);
  assert.doesNotMatch(disegnato, /<script>/);
});
