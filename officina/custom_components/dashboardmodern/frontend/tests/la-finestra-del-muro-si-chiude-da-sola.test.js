/* La finestra del citofono si chiude da sola.
 *
 * Dal campo: «metterci un timeout di tipo 5 minuti massimi, che la pagina
 * popup che si apre con il video e i pulsanti "parla", "cancellino" si chiude
 * da sola. Altrimenti rimane aperto quel popup e non rispetta piu' lo
 * screensaver impostato, e nemmeno il movimento di un sensore che ritorna
 * sulla home». Il riposo non arriva sopra una finestra aperta: una finestra
 * che nessuno tocca da cinque minuti si chiude, e da li' il riposo torna.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { FINESTRA_SOLA_MS, finestraDaChiudere } from "../src/core/il-campanello-a-muro.js";

const MINUTO = 60_000;

test("cinque minuti, non di piu'", () => {
  assert.equal(FINESTRA_SOLA_MS, 5 * MINUTO);
});

test("il citofono si chiude cinque minuti dopo lo squillo, se nessuno lo tocca", () => {
  const suonato = 1_000_000;
  const f = { tipo: "citofono", suonato, aperta: suonato };
  assert.equal(finestraDaChiudere(f, 0, suonato + 4 * MINUTO), false);
  assert.equal(finestraDaChiudere(f, 0, suonato + 5 * MINUTO), true);
});

test("un tocco sul citofono lo tiene aperto altri cinque minuti", () => {
  const suonato = 1_000_000;
  const f = { tipo: "citofono", suonato, aperta: suonato };
  const toccato = suonato + 4 * MINUTO;
  assert.equal(finestraDaChiudere(f, toccato, suonato + 6 * MINUTO), false);
  assert.equal(finestraDaChiudere(f, toccato, toccato + 5 * MINUTO), true);
});

test("vale per ogni finestra, dall'ora in cui si e' aperta", () => {
  const aperta = 2_000_000;
  const f = { tipo: "entita", aperta };
  /* Un tocco vecchio, di prima che si aprisse, non conta. */
  assert.equal(finestraDaChiudere(f, aperta - 10 * MINUTO, aperta + 4 * MINUTO), false);
  assert.equal(finestraDaChiudere(f, aperta - 10 * MINUTO, aperta + 5 * MINUTO), true);
  assert.equal(finestraDaChiudere(null, 0, aperta + 60 * MINUTO), false);
});

test("il pannello la chiude nel suo battito, e conta solo il dito", async () => {
  const sorgente = await readFile(
    new URL("../src/sections/plancia-a-muro-section.js", import.meta.url),
    "utf8",
  );
  const battito = sorgente.slice(sorgente.indexOf("function battito()"));
  assert.match(
    battito.slice(0, 900),
    /finestraDaChiudere\(state\.finestra, state\.toccatoDalDito, Date\.now\(\)\)\)\s*chiudiFinestra\(\)/,
  );
  assert.match(sorgente, /state\.finestra = \{ \.\.\.f, aperta: Date\.now\(\) \}/);
});
