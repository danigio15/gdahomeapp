/* La scheda di una casa si apre accanto all'elenco, non sopra.
 *
 * «Case a sinistra e se clicco mi apre il dettaglio affianco, non il popup:
 * non mi piace il popup.»
 *
 * Il foglio che sale dal basso e' giusto sul telefono. Su uno schermo largo
 * costava due volte: copriva l'elenco da cui eri appena partito — con un velo
 * sfocato sopra — e per passare alla casa dopo toccava chiudere, ritrovare il
 * punto, riaprire.
 *
 * ─── Cosa prova questa prova, e cosa no ──────────────────────────────────
 *
 * Che stia bene non si prova qui: si e' guardato, con la pagina vera aperta
 * in un browser, in tutt'e due le pagine, largo e stretto. Quello che si prova
 * qui e' il **contratto**, che e' la cosa che si rompe da sola: il programma
 * scrive dei nomi di classe, il foglio di stile ne veste altri, e nessuno dei
 * due si lamenta se un giorno non sono piu' gli stessi. Con le mattonelle
 * l'abbiamo gia' pagato — una classe copiata senza la sua regola, e il
 * difetto lo vedeva solo chi apriva la pagina con l'occhio giusto.
 *
 * E che il telefono non sia cambiato: sotto la soglia il foglio resta `fixed`
 * e il velo resta li'. Le due pagine hanno la stessa soglia e mettono le due
 * colonne sulla stessa riga: sono due file diversi, e due numeri uguali
 * scritti in due posti prima o poi diventano diversi.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const PAGINE = {
  "il cruscotto dell'installatore": readFileSync(join(QUI, "..", "console", "index.html"), "utf8"),
  "il cruscotto gdahome": readFileSync(join(QUI, "..", "gestore", "index.html"), "utf8"),
};

/* Il blocco `@media` dell'affiancata, dalla soglia alla sua graffa. */
function laffiancata(pagina) {
  const da = pagina.indexOf("@media (min-width: 62rem) {");
  assert.ok(da >= 0, "la soglia dell'affiancata non c'e' piu'");
  let profondita = 0;
  for (let i = pagina.indexOf("{", da); i < pagina.length; i += 1) {
    if (pagina[i] === "{") profondita += 1;
    else if (pagina[i] === "}") {
      profondita -= 1;
      if (profondita === 0) return pagina.slice(da, i + 1);
    }
  }
  throw new Error("il blocco dell'affiancata non si chiude");
}

/* La regola di un selettore dentro un pezzo di foglio. */
function regola(foglio, selettore) {
  const da = foglio.indexOf(selettore + " {");
  assert.ok(da >= 0, `la regola «${selettore}» non c'e' piu'`);
  return foglio.slice(da, foglio.indexOf("}", da));
}

for (const [chi, pagina] of Object.entries(PAGINE)) {
  test(`${chi}: il programma scrive i due posti che il foglio veste`, () => {
    /* Il difetto per nome: se qualcuno rinomina il contenitore nel programma
     * e non nel foglio, la pagina torna a una colonna sola e nessuno se ne
     * accorge finche' non la apre. */
    assert.match(pagina, /class="colonna-elenco"/, "l'elenco non ha piu' il suo contenitore");
    assert.match(
      pagina,
      /class="scheda-vuota"/,
      "manca il posto della scheda quando non se n'e' aperta nessuna",
    );

    const foglio = laffiancata(pagina);
    assert.match(regola(foglio, "#dove > .colonna-elenco"), /grid-column: 1;/);
    assert.match(
      regola(foglio, "#dove > .scheda-vuota,\n        #dove > .foglio"),
      /grid-column: 2;/,
    );
  });

  test(`${chi}: l'elenco e la scheda stanno sulla stessa riga`, () => {
    /* Su due righe diverse la scheda finirebbe sotto l'elenco, che e' quasi
     * quello che c'era prima. La riga e' numerata apposta: fra l'anello e
     * l'elenco ci possono stare altre cose, e contando le righe basterebbe
     * che ne comparisse una per spostarne una sola delle due. */
    const foglio = laffiancata(pagina);
    const riga = (selettore) => /grid-row: (\d+);/.exec(regola(foglio, selettore))?.[1];
    const elenco = riga("#dove > .colonna-elenco");
    const scheda = riga("#dove > .scheda-vuota,\n        #dove > .foglio");
    assert.ok(elenco, "l'elenco non ha una riga sua");
    assert.equal(scheda, elenco, "la scheda non sta sulla riga dell'elenco");
  });

  test(`${chi}: l'elenco sta in squadra con quello che ha sopra`, () => {
    /* Il difetto per nome, ed era mio: alla colonna che scorre avevo dato un
     * respiro di cinque pixel per lato, perche' l'ombra e il sollevamento di
     * una riga non si tagliassero sul bordo. Ripreso col margine negativo il
     * contenuto tornava a posto, ma la colonna cominciava cinque pixel prima
     * di tutto il resto — il riquadro in cima a 126, l'elenco a 121 — e si
     * vedeva. Il respiro adesso sta solo sopra e sotto, e questa prova e' la
     * sola cosa che se ne accorge se qualcuno lo rimette di lato. */
    const foglio = laffiancata(pagina);
    const colonna = regola(foglio, "#dove > .colonna-elenco");
    for (const quale of ["padding", "margin"]) {
      const scritto = new RegExp(`\\n\\s*${quale}: ([^;]+);`).exec(colonna)?.[1];
      assert.ok(scritto, `alla colonna manca «${quale}»`);
      const pezzi = scritto.trim().split(/\s+/);
      assert.equal(pezzi.length, 2, `«${quale}: ${scritto}» non e' «sopra-sotto destra-sinistra»`);
      assert.equal(pezzi[1], "0", `«${quale}» sposta la colonna di lato: ${scritto}`);
    }

    /* E il titolo in cima non porta il suo stacco: le due colonne devono
     * cominciare alla stessa altezza, e con lo stacco la prima riga
     * dell'elenco restava sessanta pixel piu' in basso della scheda. */
    assert.match(regola(foglio, "#dove > .colonna-elenco > .voce"), /margin-top: 0;/);
  });

  test(`${chi}: dentro la scheda c'e' un bordo sinistro solo`, () => {
    /* Il difetto per nome: la testata e i tasti rientravano di venti, il
     * corpo di sedici, e il titolo di un capitolo si riprendeva i quattro
     * mancanti col suo margine. Risultato: il nome della casa e i titoli a
     * venti, le carte che quei titoli intitolano a sedici. Quattro pixel.
     * Col foglio che saliva dal basso, largo quanto un telefono, non li
     * notava nessuno; da quando la scheda sta accanto a un elenco allineato,
     * si vedono — ed e' da li' che e' arrivata la segnalazione.
     *
     * Non serve un browser per accorgersene: e' un numero scritto tre volte
     * nello stesso foglio, e le tre volte devono dire la stessa cosa. */
    const dilato = (selettore) => {
      const scritto = /\n\s*padding: ([^;]+);/.exec(regola(pagina, selettore))?.[1];
      assert.ok(scritto, `a «${selettore}» manca il padding`);
      const pezzi = scritto.trim().split(/\s+/);
      /* «sopra destra-sinistra sotto» o «sopra destra sotto sinistra». */
      return pezzi.length === 4 ? [pezzi[1], pezzi[3]] : [pezzi[1], pezzi[1]];
    };
    const tutti = [
      ...dilato("      .foglio-testa"),
      ...dilato("      .foglio-corpo"),
      ...dilato("      .foglio-tasti"),
    ];
    assert.equal(
      new Set(tutti).size,
      1,
      `la scheda rientra di misure diverse: ${[...new Set(tutti)].join(", ")}`,
    );

    /* E il titolo di un capitolo non si riprende niente di lato. */
    assert.match(regola(pagina, "      .capitolo"), /margin: \d+px 0 \d+px;/);
  });

  test(`${chi}: accanto non c'e' piu' il velo`, () => {
    assert.match(regola(laffiancata(pagina), "#dove > .velo"), /display: none;/);
  });

  test(`${chi}: sul telefono resta il foglio che sale`, () => {
    /* La soglia e' larga: sotto, la pagina e' quella di prima, e questa prova
     * e' la sola cosa che se ne accorge se qualcuno tocca il foglio di base
     * credendo di toccare l'affiancata. */
    const fuori = pagina.replace(laffiancata(pagina), "");
    assert.match(regola(fuori, "      .foglio"), /position: fixed;/);
    assert.match(regola(fuori, "      .velo"), /position: fixed;/);
    assert.match(regola(fuori, "      .scheda-vuota"), /display: none;/);
  });
}

test("le due pagine hanno la stessa soglia e la stessa riga", () => {
  const [una, altra] = Object.values(PAGINE).map(laffiancata);
  const riga = (foglio) => /#dove > \.colonna-elenco \{[^}]*grid-row: (\d+);/.exec(foglio)?.[1];
  assert.equal(riga(una), riga(altra), "le due pagine mettono l'elenco su due righe diverse");
  const attacco = (foglio) => /#dove > \.colonna-elenco \{[^}]*top: (\d+px);/.exec(foglio)?.[1];
  assert.equal(attacco(una), attacco(altra), "l'elenco si attacca a due altezze diverse");
});
