/* «Gli importi dei costi energia non coincidono con il riquadro sotto.»
 *
 * La casella «Costo Reale» e il blocco «Come si divide il costo reale» stanno
 * attaccati, e dicevano due cifre diverse per la stessa spesa: stessi
 * kilowattora, soldi diversi. Non era un conto sbagliato — erano due conti.
 *
 * La casella faceva una STIMA (i kWh del mese per la media pesata delle
 * fasce); il blocco fa il CONTO ESATTO, perche' le ore le ha chieste al
 * Recorder e sa in che fascia sono passate. A scrivere la casella erano in
 * due, e solo una delle due sapeva chiedere il conto esatto: vinceva chi
 * passava per ultima.
 *
 * Questa prova tiene fermo che chiedono tutte e due, allo stesso registro.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const leggi = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), "utf8");

test("il registro del conto esatto sta dove lo vedono tutti e due", () => {
  /* In «shared.js» e non nella sezione delle fasce: quella non si puo'
   * importare — usa l'Energia, e l'Energia importerebbe lei — quindi chi sa il
   * conto si presenta invece di farsi chiamare. */
  const condiviso = leggi("sections/shared.js");
  assert.match(condiviso, /export function registraIlContoDelleFasce\(/);
  assert.match(condiviso, /export function ilContoEsattoDelleFasce\(/);
  /* Un conto senza euro validi non e' un conto: chi chiede torna alla stima
   * invece di scrivere «NaN €». */
  assert.match(condiviso, /Number\.isFinite\(Number\(conto\.euro\)\)/);
});

test("la sezione dell'Energia preferisce il conto esatto alla sua stima", () => {
  const energia = leggi("sections/energy-section.js");
  assert.match(energia, /ilContoEsattoDelleFasce,/);
  assert.match(energia, /const aFasce = ilContoEsattoDelleFasce\(\);/);
  assert.match(
    energia,
    /const costoDiRete = aFasce \? Math\.max\(0, Number\(aFasce\.euro\) \|\| 0\) : money\.realCost;/,
  );
  assert.match(energia, /setText\("ed-fin-costo", `\$\{formatNumber\(costoDiRete, 2\)\} €`\)/);
  /* E il risparmio segue il costo: con la stima sopra e il conto vero sotto,
   * diceva di aver risparmiato meno di quanto aveva risparmiato. */
  assert.match(
    energia,
    /const risparmiato = Math\.max\(0, money\.withoutSolar - costoDiRete\);/,
  );
  assert.match(energia, /setText\("ed-fin-risp", `\$\{formatNumber\(risparmiato, 2\)\} €`\)/);
});

test("chi sa il conto lo lascia anche nel registro condiviso", () => {
  const rifinitura = leggi("sections/energy-report-polish-section.js");
  assert.match(rifinitura, /registraIlContoDelleFasce,/);
  assert.match(rifinitura, /registraIlContoDelleFasce\(lettore\);/);
  /* La rifinitura continua a preferirlo per conto suo: le due strade restano
   * due, ma adesso portano allo stesso numero. */
  assert.match(rifinitura, /const aFasce = state\.contoAFasce\?\.\(\) \|\| null;/);
});
