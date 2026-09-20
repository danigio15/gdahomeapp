/* «Su iPad i nomi delle sezioni si accavallano».
 *
 * E si accavallavano davvero: «STANZE» finiva dentro «TEMPERATURA», e in una
 * casa con le sezioni dal nome lungo — «ELETTRODOMESTICI», «GESTIONE TERMICA»
 * — la barra diventava una riga di lettere una sopra l'altra, illeggibile.
 *
 * Il guasto è la somma di due regole giuste prese da sole. Il foglio del tocco
 * (`legacy/dashboard-runtime-it.css`, il blocco «hover:none e pointer:coarse»,
 * che su un tablet vale) tiene ogni pastiglia dentro `max-width:72px`: giusto,
 * perché lì il nome è scritto in sette punti. Il blocco del tablet, in
 * `navigation-section.js`, riporta il nome a **dodici** punti, perché su uno
 * schermo tenuto a mezzo metro sette punti non si leggono: giusto anche
 * quello. Insieme fanno un nome da centotrenta punti dentro una pastiglia da
 * settantadue, e quello che avanza finisce sopra la pastiglia di fianco.
 *
 * La toppa è togliere il tetto dove il nome cresce. Questa prova tiene ferme
 * le due cose insieme — il nome grande **e** il tetto tolto — perché separate
 * sono due righe innocenti, e chi un giorno togliesse la seconda rimetterebbe
 * esattamente questo difetto senza che niente si rompa.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const BARRA = readFileSync(
  new URL("../src/sections/navigation-section.js", import.meta.url),
  "utf8",
);

/** Il blocco del tablet: quello che rifà le misure su uno schermo grande. */
function ilBloccoDelTablet() {
  const dove = BARRA.indexOf("@media(min-width:768px) and (min-height:600px)");
  assert.ok(dove > 0, "il blocco del tablet non c'è più: è cambiata la misura?");
  /* Fino alla chiusura del blocco: si conta la parentesi graffa, perché
     dentro ce ne sono altre. */
  let profondo = 0;
  for (let i = BARRA.indexOf("{", dove); i < BARRA.length; i += 1) {
    if (BARRA[i] === "{") profondo += 1;
    if (BARRA[i] === "}") {
      profondo -= 1;
      if (profondo === 0) return BARRA.slice(dove, i + 1);
    }
  }
  throw new Error("il blocco del tablet non si chiude");
}

test("sul tablet il nome della sezione è scritto grande", () => {
  const blocco = ilBloccoDelTablet();
  assert.match(
    blocco,
    /nav\.tabs\.bottom-nav-bar \.tab \.text\{font-size:12px!important/,
    "il nome della sezione non è più scritto in dodici punti",
  );
});

test("e allora la sua pastiglia non ha più un tetto", () => {
  const blocco = ilBloccoDelTablet();
  assert.match(
    blocco,
    /nav\.tabs\.bottom-nav-bar \.tab\{max-width:none!important\}/,
    "il tetto di 72px del foglio del tocco torna a tagliare un nome da 130",
  );
  /* E il nome non va a capo: una pastiglia che si allarga quanto serve lo
     tiene su una riga, e una riga in più farebbe la barra più alta di quanto
     la pagina le ha lasciato. */
  assert.match(
    blocco,
    /nav\.tabs\.bottom-nav-bar \.tab \.text\{white-space:nowrap!important\}/,
    "senza «nowrap» un nome lungo va a capo e alza la barra",
  );
});

test("il tetto che si toglie qui è quello che mette il foglio del tocco", () => {
  /* Se un giorno quel tetto sparisse di là, questa riga non servirebbe più —
   * e questa prova è il posto dove leggerlo. */
  const tocco = readFileSync(
    new URL("../legacy/dashboard-runtime-it.css", import.meta.url),
    "utf8",
  );
  assert.match(
    tocco,
    /max-width: 72px !important/,
    "il foglio del tocco non mette più un tetto: la regola del tablet si può togliere",
  );
});

test("il min-width resta: è quanto deve essere grande una cosa da premere", () => {
  const blocco = ilBloccoDelTablet();
  assert.doesNotMatch(
    blocco,
    /\.tab\{[^}]*min-width:0/,
    "togliendo anche il minimo, una sezione dal nome corto diventa un bersaglio piccolo",
  );
});
