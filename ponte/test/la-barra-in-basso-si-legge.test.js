/* Le scritte della barra in basso non si accavallano.
 *
 * Su un tablet si leggeva cosi':
 *
 *     HOME   ENERGELÆTTRODOMESTIAUTGESTIONE TERMICGA…
 *
 * Cinque voci, e le loro scritte una sopra l'altra. Il motivo: la barra e'
 * larga quanto le serve (`min-width: max-content`), ma quando le voci sono
 * tante lo schermo la taglia; allora le linguette si stringono fino al loro
 * minimo e il testo, che non aveva **nessun** limite, usciva dal suo riquadro
 * e finiva addosso a quello di fianco.
 *
 * Una prova sul foglio di stile e non sulla pagina disegnata, e si sa cosa
 * vale: dice che le regole ci sono, non che il risultato e' bello. Ma la
 * regola che manca e' esattamente quello che e' successo, e questa non la fa
 * sparire di nuovo — in un file di quattromila righe che nessuno rilegge, una
 * riga tolta per sbaglio non si vede finche' qualcuno non apre un tablet.
 *
 * Tutt'e due le lingue: i due fogli sono copie, e una sistemata su una sola
 * vuol dire il guasto che resta per chi ha la plancia in inglese.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const iFogli = ["it", "en"].map((lingua) => [
  lingua,
  readFileSync(
    fileURLToPath(new URL(`../plancia/legacy/dashboard-runtime-${lingua}.css`, import.meta.url)),
    "utf8",
  ),
]);

/* Il blocco di una regola, dal selettore alla graffa che lo chiude. */
function laRegola(foglio, selettore) {
  const dove = foglio.indexOf(`${selettore} {`);
  if (dove < 0) return "";
  const fine = foglio.indexOf("}", dove);
  return fine < 0 ? "" : foglio.slice(dove, fine);
}

test("una scritta lunga si taglia coi puntini invece di uscire dalla sua linguetta", () => {
  for (const [lingua, foglio] of iFogli) {
    const regola = laRegola(foglio, "nav.tabs.bottom-nav-bar .tab .text");
    assert.ok(regola, `in ${lingua} la regola della scritta non c'e' piu'`);
    for (const serve of [
      /overflow:\s*hidden/,
      /text-overflow:\s*ellipsis/,
      /white-space:\s*nowrap/,
      /max-width:/,
    ]) {
      assert.match(regola, serve, `in ${lingua} manca ${serve} sulla scritta`);
    }
  }
});

test("una voce lunga non si prende il posto delle altre", () => {
  for (const [lingua, foglio] of iFogli) {
    const regola = laRegola(foglio, "nav.tabs.bottom-nav-bar .tab");
    assert.match(regola, /max-width:/, `in ${lingua} una linguetta puo' allargarsi quanto vuole`);
    assert.match(
      regola,
      /overflow:\s*hidden/,
      `in ${lingua} una linguetta lascia uscire quello che ha dentro`,
    );
  }
});

test("la barra non esce dallo schermo: quello che non ci sta si raggiunge scorrendo", () => {
  for (const [lingua, foglio] of iFogli) {
    const regola = laRegola(foglio, "nav.tabs.bottom-nav-bar");
    assert.match(
      regola,
      /max-width:\s*calc\(100vw/,
      `in ${lingua} la barra puo' essere piu' larga dello schermo`,
    );
    assert.match(
      regola,
      /overflow-x:\s*auto/,
      `in ${lingua} quello che esce dalla barra non si raggiunge`,
    );
  }
});

/* ─── E su un tablet appeso al muro ───────────────────────────────────────
 *
 * Seconda foto, stesso guasto, altro schermo: le scritte si toccavano fra
 * loro mentre a destra della barra non c'era nessuno. «Secondo te perche' le
 * sezioni non le allarga e scrive in quel modo ravvicinato.»
 *
 * Perche' le regole del tocco sono scritte per un telefono — la linguetta si
 * ferma a 72 punti e le voci si impaccano a sinistra — e un tablet le prende
 * uguali: ha il posto e non lo usa. I puntini qui sopra evitano che le
 * scritte si scrivano una sull'altra; questo blocco evita che stiano strette
 * per niente.
 */

/* Il blocco di una `@media`, dalla sua condizione alla graffa che la chiude.
 * Si contano le graffe: dentro ce ne sono altre. */
function ilBlocco(foglio, condizione) {
  const dove = foglio.indexOf(`@media ${condizione}`);
  if (dove < 0) return "";
  let aperte = 0;
  for (let i = foglio.indexOf("{", dove); i < foglio.length; i += 1) {
    if (foglio[i] === "{") aperte += 1;
    else if (foglio[i] === "}") {
      aperte -= 1;
      if (aperte === 0) return foglio.slice(dove, i + 1);
    }
  }
  return "";
}

const IL_TABLET =
  "(hover: none) and (pointer: coarse) and (min-width: 900px) and (min-height: 600px)";

test("su uno schermo che si tocca ma e' largo, le voci si prendono il posto che c'e'", () => {
  for (const [lingua, foglio] of iFogli) {
    const blocco = ilBlocco(foglio, IL_TABLET);
    assert.ok(blocco, `in ${lingua} il blocco del tablet non c'e' piu'`);
    /* Crescono: la riga si divide fra loro invece di lasciare l'avanzo a
     * destra. Senza il `flex-grow` restano larghe come su un telefono. */
    assert.match(blocco, /flex:\s*1\s+1\s+auto/, `in ${lingua} le linguette non crescono`);
    /* E piu' larghe di quanto puo' essere una voce su un telefono (72). */
    const tetto = blocco.match(/max-width:\s*(\d+)px/);
    assert.ok(tetto, `in ${lingua} il tetto della linguetta non c'e'`);
    assert.ok(
      Number(tetto[1]) > 72,
      `in ${lingua} il tetto e' ancora quello del telefono (${tetto[1]}px)`,
    );
    /* Il tetto c'e' ancora, pero': alzato, non tolto. Una voce lunga non si
     * prende la riga. */
    assert.doesNotMatch(blocco, /max-width:\s*none/, `in ${lingua} il tetto e' stato tolto`);
    /* E la scritta torna leggibile: piu' dei 7 punti del telefono. */
    const scritta = blocco.slice(blocco.indexOf(".tab .text"));
    const quanto = scritta.match(/font-size:\s*(\d+)px/);
    assert.ok(quanto, `in ${lingua} la misura della scritta non c'e'`);
    assert.ok(
      Number(quanto[1]) > 7,
      `in ${lingua} la scritta e' ancora quella del telefono (${quanto[1]}px)`,
    );
  }
});

test("il blocco del tablet viene dopo quello del tocco, se no non vale niente", () => {
  /* Stessa specificita' e tutt'e due `!important`: a decidere e' chi viene
   * dopo. Scritto prima, il telefono rivincerebbe e la foto resterebbe
   * quella. */
  for (const [lingua, foglio] of iFogli) {
    const telefono = foglio.indexOf("@media (max-width: 768px), (orientation: landscape)");
    const tablet = foglio.indexOf(`@media ${IL_TABLET}`);
    assert.ok(telefono >= 0, `in ${lingua} il blocco del telefono non c'e' piu'`);
    assert.ok(tablet > telefono, `in ${lingua} il tablet e' scritto prima del telefono`);
  }
});
