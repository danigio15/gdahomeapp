/* Regalare gdahome Premium a una casa, dalla Gestione (1.10.0).
 *
 * «Come regalo le licenze dalla Gestione?» La risposta di ieri era: incolla
 * la matricola della casa. Ma la matricola non si vedeva da nessuna parte —
 * la scheda dell'impianto la tagliava a tredici lettere, e la console
 * dell'add-on non la mostrava. Adesso:
 *
 *   - la casa si sceglie da un elenco, con tutte le case degli installatori,
 *     ognuna col suo nome e con chi la segue;
 *   - per una casa che non e' di nessun installatore resta la casella della
 *     matricola, e la matricola si copia dalla console dell'add-on;
 *   - la scheda dell'impianto la mostra intera, con «Copia».
 *
 * Questa prova tiene ferme le tre cose, e l'avviso delle licenze spente col
 * comando che sul quadro c'e' davvero.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const GESTORE = readFileSync(join(QUI, "..", "gestore", "index.html"), "utf8");
const CONSOLE_HTML = readFileSync(join(QUI, "..", "..", "ponte", "console", "index.html"), "utf8");
const CONSOLE_JS = readFileSync(join(QUI, "..", "..", "ponte", "console", "console.js"), "utf8");

test("la casa si sceglie da un elenco di tutte le case degli installatori", () => {
  assert.match(
    GESTORE,
    /<select id="regalo-scelta">\$\{\/\* già HTML \*\/ leCaseDaRegalare\(\)\}<\/select>/,
  );
  /* L'elenco si fa dalle case che il quadro ha gia' in mano, installatore per
   * installatore: nome della casa e nome di chi la segue. */
  assert.match(GESTORE, /function leCaseConosciute\(\)/);
  assert.match(GESTORE, /for \(const uno of INSTALLATORI\)/);
  assert.match(GESTORE, /LE_CASE_DI\.get\(uno\.chi\)\?\.case/);
  assert.match(GESTORE, /\$\{testo\(una\.nome\)\} · \$\{testo\(una\.di\)\}<\/option>/);
});

test("per una casa fuori elenco resta la matricola, e una sola delle due vince", () => {
  assert.match(GESTORE, /<label for="regalo-casa">Oppure la matricola di un'altra casa<\/label>/);
  assert.match(GESTORE, /const casa = scelta \|\| scritta;/);
  /* Toccarne una svuota l'altra: non si regala alla casa sbagliata perche' ne
   * erano rimaste due. */
  assert.match(
    GESTORE,
    /id === "regalo-scelta" \? "regalo-casa" : id === "regalo-casa" \? "regalo-scelta"/,
  );
  /* E il modulo non si svuota da solo al rinfresco di ogni minuto. */
  assert.match(GESTORE, /let IL_REGALO = \{\};/);
  assert.match(GESTORE, /if \(id in IL_REGALO\) campo\.value = IL_REGALO\[id\];/);
});

test("la scheda dell'impianto mostra la matricola intera, con «Copia»", () => {
  assert.match(
    GESTORE,
    /<span class="mono matricola-valore">\$\{testo\(String\(c\.casa \|\| casa\.casa\)\)\}<\/span>/,
  );
  assert.match(
    GESTORE,
    /<button type="button" class="tasto copia" data-copia="\$\{testo\(String\(c\.casa \|\| casa\.casa\)\)\}">Copia<\/button>/,
  );
  /* Niente piu' matricola tagliata: tagliata non si incolla da nessuna parte. */
  assert.doesNotMatch(GESTORE, /String\(c\.casa \|\| casa\.casa\)\)\.slice\(0, 13\)/);
});

test("l'avviso delle licenze spente dice il comando che sul quadro c'e'", () => {
  assert.match(GESTORE, /node le-licenze\.mjs chiave/);
  /* `strumenti/` sul quadro non c'e': rimandarci voleva dire mandare a vuoto. */
  assert.doesNotMatch(
    GESTORE,
    /Si fabbrica con <span class="mono">node strumenti\/chiave-licenze\.mjs/,
  );
});

test("la console dell'add-on mostra la matricola della casa, da copiare, nelle due lingue", () => {
  assert.match(CONSOLE_HTML, /<code class="codice piccolo" id="licenza-casa"><\/code>/);
  assert.match(CONSOLE_HTML, /data-en="This home's serial number"/);
  assert.match(CONSOLE_HTML, /id="copia-matricola"[^>]*data-en="Copy"/);
  /* La dice il ponte, nello stesso stato che legge l'app. */
  assert.match(CONSOLE_JS, /var matricola = String\(stato\.casa \|\| ""\);/);
  assert.match(CONSOLE_JS, /trova\("licenza-casa"\)\.textContent = matricola;/);
  /* Dentro il telaio di Home Assistant gli appunti possono mancare: allora si
   * seleziona, e si copia a mano. */
  assert.match(CONSOLE_JS, /appunti\.writeText\(testo\)\.then\(fatto, aMano\)/);
});
