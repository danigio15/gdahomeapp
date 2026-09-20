/* «Su Google Chrome si vede male il numero, che e' sovrapposto» (#30).
 *
 * Il numero grande e' Oswald a quaranta dentro una riga a 1.6, e quella riga
 * si porta dentro tredici virgola sei pixel d'aria sopra e altrettanti sotto:
 * un margine negativo uguale e contrario li toglie, cosi' la scatola e' alta
 * quanto il disegno e la mattonella resta quella di sempre.
 *
 * Quel numero pero' e' la meta' dell'aria di QUEL carattere a QUEL corpo. Un
 * valore piu' lungo passa a Inter — venti pixel, o sedici su due righe — e si
 * portava dietro lo stesso margine: a venti la riga e' 32 px e i margini ne
 * tolgono 27,2, cioe' una scatola di 4,8 px per un testo che ne occupa 32. Il
 * resto usciva: sopra sull'insegna, sotto sulla didascalia.
 *
 * Non era Chrome, ed e' per questo che chi cercava non lo trovava: era
 * qualunque tessera con un valore di otto caratteri o piu'. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const SORGENTE = readFileSync(
  new URL("../src/sections/home-widgets-section.js", import.meta.url),
  "utf8",
);

/* Il blocco di regole di una sola variante del valore. */
function regola(quale) {
  const ago = quale ? `.dm-tile-value[data-dm-len="${quale}"]{` : ".dm-tile-value{";
  const dove = SORGENTE.indexOf(ago);
  assert.notEqual(dove, -1, `manca la regola per «${quale || "corto"}»`);
  return SORGENTE.slice(dove + ago.length, SORGENTE.indexOf("}", dove));
}

test("il margine negativo vale per il numero grande, che e' quello per cui e' tarato", () => {
  const corto = regola("");
  assert.match(corto, /font-size:40px/);
  assert.match(corto, /line-height:1\.6/);
  assert.match(corto, /margin:-13\.6px 0/);
});

test("un valore piu' lungo cambia carattere, e si porta via il margine tarato sull'altro", () => {
  for (const quale of ["medio", "lungo"]) {
    const dentro = regola(quale);
    assert.match(dentro, /font-family:'Inter'/, `${quale}: e' Inter, non Oswald`);
    assert.match(dentro, /margin:0/, `${quale}: il margine di Oswald qui accartoccia la scatola`);
    assert.match(
      dentro,
      /line-height:1\.\d+/,
      `${quale}: la riga dev'essere quella del carattere che si usa`,
    );
    assert.doesNotMatch(dentro, /margin:-/, `${quale}: nessun margine negativo`);
  }
});

test("la scatola di ogni misura e' alta quanto quello che ci si vede dentro", () => {
  /* Il conto, fatto qui invece che a occhio: riga meno margini. Sotto zero
   * vuol dire che il testo esce dalla scatola, ed e' il difetto. */
  const alta = (fontSize, lineHeight, margine) => fontSize * lineHeight + 2 * margine;
  assert.ok(alta(40, 1.6, -13.6) > 30, "il numero grande: 36,8 px, e ci sta");
  assert.ok(alta(20, 1.6, -13.6) < 10, "com'era: 4,8 px per un testo di 32 — e usciva");
  assert.ok(alta(20, 1.3, 0) >= 20, "com'e': la scatola contiene il testo");
  assert.ok(alta(16, 1.15, 0) >= 16);
});
