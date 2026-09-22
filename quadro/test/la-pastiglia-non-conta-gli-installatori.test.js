/* «Cruscotto gestore in alto porta installatori 1 ma in realtà sono 2.»
 *
 * Sullo scatto: la testata dice «2 installatori · 3 impianti», l'elenco sotto
 * dice «Gli installatori — 2», e in mezzo la linguetta dice «Installatori 1».
 *
 * Il numero non era sbagliato, era un altro numero: la pastiglia contava gli
 * installatori AL LIMITE. Ma una pastiglia appoggiata alla parola
 * «Installatori» si legge in un modo solo, e quel conto quella schermata lo
 * dice già due volte — nel titolone e nella casella «al limite».
 *
 * La regola sta già scritta nel cruscotto, che è la pagina gemella: la
 * linguetta di una raccolta («Impianti») non porta pastiglia, le portano le
 * linguette che chiedono di fare qualcosa («Aggiornamenti», «Abbinamento»).
 * Questa prova la tiene ferma da tutte e due le parti, perché una regola che
 * vale in una pagina sola è un'abitudine, non una regola.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const qua = (...pezzi) => readFileSync(join(QUI, "..", ...pezzi), "utf8");

/* La riga della linguetta, come la scrivono tutt'e due le pagine:
   ["quale", "Parola", quanti]. */
function pastiglia(sorgente, quale) {
  const riga = new RegExp(`\\["${quale}",\\s*"[^"]+",\\s*([^\\]]+)\\]`).exec(sorgente);
  assert.ok(riga, `la linguetta «${quale}» non c'è più`);
  return riga[1].trim();
}

test("la linguetta «Installatori» non porta un numero addosso", () => {
  assert.equal(pastiglia(qua("gestore", "index.html"), "installatori"), "0");
});

test("e non conta più quelli al limite", () => {
  /* Il difetto per nome: se qualcuno rimette lì `alLimite`, la pagina torna a
   * dire «Installatori 1» a chi ne ha due. */
  assert.equal(
    /\["installatori",\s*"Installatori",\s*alLimite\]/.test(qua("gestore", "index.html")),
    false,
  );
});

test("«Impianti» nel cruscotto non la porta nemmeno lei", () => {
  /* L'altra metà della regola. Se un giorno questa cade, cade insieme a lei
   * il motivo per cui il gestore fa come fa. */
  assert.equal(pastiglia(qua("console", "index.html"), "case"), "0");
});

test("le linguette che chiedono qualcosa la pastiglia ce l'hanno", () => {
  /* Perché la regola non è «niente pastiglie»: è «la pastiglia dice che c'è
   * qualcosa da fare». Senza questa prova, toglierle tutte passerebbe. */
  const console = qua("console", "index.html");
  assert.notEqual(pastiglia(console, "aggiornamenti"), "0");
  assert.notEqual(pastiglia(console, "abbina"), "0");
});

test("il conto degli installatori al limite non si è perso per strada", () => {
  /* Sta dove si legge per quello che è: nel titolone della scheda e nella
   * casella sotto l'anello. */
  const gestore = qua("gestore", "index.html");
  assert.match(gestore, /installatore al limite|installatori al limite/);
  assert.match(gestore, /al limite<\/|>al limite/);
});
