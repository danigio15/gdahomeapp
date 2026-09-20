/* Le parole che il film mette fra virgolette sono quelle che il quadro scrive
 * davvero.
 *
 * Questo film mostra **fotografie della console vera** — le fa
 * `quadro-vero.mjs`, aprendola per davvero — e ci scrive sopra delle
 * didascalie. Quindi ogni volta che una didascalia nomina una cosa che sullo
 * schermo si vede scritta, le due scritte devono essere la stessa: se la
 * fotografia dice «Vita del disco» e la didascalia dice «l'usura del disco»,
 * chi guarda legge due nomi per la stessa riga e si chiede quale sia quello
 * giusto.
 *
 * E' l'errore che sopravvive a ogni rilettura, perche' la didascalia da sola
 * e' scritta bene — anzi, «usura» e' perfino piu' chiaro. Si vede solo
 * guardando il fotogramma, che nessuno guarda.
 *
 * Succede in tutte e due le direzioni, e tutte e due si rompono in silenzio:
 * qualcuno riscrive una didascalia e sceglie un sinonimo; oppure qualcuno
 * cambia un'etichetta nella console, e il film continua a citare quella
 * vecchia — le fotografie si rifanno da sole, le didascalie no.
 *
 * La lista qui sotto e' corta apposta: solo le parole che il film **cita**,
 * non tutte quelle della console. Se una didascalia smette di nominarne una,
 * questa prova lo dice, e la riga va tolta di qui — e' una decisione, non una
 * svista.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
const leggi = (...pezzi) => readFileSync(join(QUI, "..", "..", ...pezzi), "utf8");

/* Dove il quadro le scrive, e come si chiama la cosa nel film. */
const LE_PAROLE = [
  /* Il nome del prodotto: la console lo scrive nel titolo della pagina e in
     testa all'elenco, e nelle fotografie del film si legge. Il film lo ha
     chiamato «il quadro» per mesi — che e' il nome interno, quello delle
     cartelle e delle chiavi — e sullo schermo non c'e' mai stato. */
  ["Cruscotto installatore", ["quadro", "console", "index.html"]],
  ["a posto", ["quadro", "console", "index.html"]],
  ["da guardare", ["quadro", "console", "index.html"]],
  ["Vita del disco", ["quadro", "console", "index.html"]],
  ["Abbina", ["quadro", "console", "index.html"]],
  ["questa casa non lo dice", ["quadro", "src", "controlli.js"]],
  ["I collegamenti", ["quadro", "src", "controlli.js"]],
];

/**
 * Le **didascalie** italiane del film.
 *
 * Solo quelle, e non anche il parlato: e' la didascalia che sta sullo stesso
 * fotogramma della fotografia, e sono quelle due scritte che chi guarda vede
 * una sopra l'altra. Cercando la parola in tutto il film — parlato compreso —
 * una didascalia che ha scelto un sinonimo passerebbe lo stesso, perche' la
 * parola giusta la dice la voce da un'altra parte.
 */
function leDidascalie() {
  const scene = leggi("strumenti", "video", "quadro.js").replace(/\/\*[\s\S]*?\*\//g, "");
  return [...scene.matchAll(/t\(\s*(["'])((?:\\.|(?!\1).)*)\1/g)]
    .map((una) => una[2].replace(/\\(['"])/g, "$1"))
    .join("\n");
}

for (const [parola, dove] of LE_PAROLE) {
  test(`il film e il quadro dicono tutti e due «${parola}»`, () => {
    assert.ok(
      leggi(...dove).includes(parola),
      `«${parola}» non sta piu' in ${dove.join("/")}: se l'etichetta e' cambiata,\n` +
        `      le fotografie del film adesso ne mostrano un'altra, e le didascalie che\n` +
        `      la citano vanno riscritte — le fotografie si rifanno da sole, il testo no.`,
    );
    /* Senza guardare le maiuscole: la console scrive «Vita del disco» come
       titolo di una riga, il film la nomina in mezzo a una frase. */
    assert.ok(
      leDidascalie().toLowerCase().includes(parola.toLowerCase()),
      `nessuna didascalia nomina piu' «${parola}», che pero' si vede nelle fotografie.\n` +
        `      Se la didascalia l'ha sostituita con un sinonimo, chi guarda legge due nomi\n` +
        `      per la stessa cosa. Se invece non la nomina piu' apposta, togli la riga da LE_PAROLE.`,
    );
  });
}
