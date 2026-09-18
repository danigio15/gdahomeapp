/* «Sistema la parte alta dove c'è lingua modo kiosk etc perché come grafica
 *  non è allineata con il resto del config.»
 *
 * In cima alle ⚙️ Impostazioni ci sono quattro blocchi che i moduli aggiungono
 * alla scheda del guscio: la lingua, il modo chiosco, l'intestazione fissa e
 * Assist. Erano scritti in due modi diversi.
 *
 * La lingua e Assist erano `ed-slot`, come tutto il resto della Config:
 * etichetta in cima — la stessa `ed-slot-lbl` delle altre — nota sotto, e il
 * comando in fondo. Il chiosco e l'intestazione no: una riga nuda dentro un
 * `ed-form`, con un carattere più piccolo, il disegno a sinistra e
 * l'interruttore in fondo a destra. Riga per riga non si nota; tutte insieme,
 * che è come si vede quella scheda, si vedono quattro blocchi scritti da
 * quattro persone.
 *
 * E le note avevano quattro voci: 11,5 punti da una parte, 12 dall'altra, due
 * variabili diverse per lo stesso grigio. Adesso la voce sta in un posto solo
 * — `NOTA_DI_SCHEDA` in `shared.js` — e chi la usa non la può far scivolare.
 *
 * Questa prova guarda i sorgenti e non un browser perché la regola è una
 * regola di scrittura: quale forma hanno quei quattro blocchi. Quello che si
 * vede l'ho guardato con un browser vero, una volta, prima di scriverla.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const QUI = dirname(fileURLToPath(import.meta.url));
const SEZIONI = join(QUI, "..", "src", "sections");
const sorgente = (nome) => readFileSync(join(SEZIONI, nome), "utf8");

/* I quattro blocchi in cima alle Impostazioni, e come si riconosce il loro
 * pezzo di disegno. */
const I_QUATTRO = [
  ["lingua-section.js", "dm-lingua"],
  ["modo-chiosco-section.js", "dm-chiosco"],
  ["testa-fissa-section.js", "dm-testa"],
  ["assist-editor-section.js", "dm-assist-ed"],
];

test("tutti e quattro sono «ed-slot», con l'etichetta di tutti", () => {
  for (const [file, classe] of I_QUATTRO) {
    const testo = sorgente(file);
    assert.match(
      testo,
      new RegExp(`class="ed-slot ${classe}`),
      `${file}: il blocco non è un ed-slot come gli altri`,
    );
    assert.match(
      testo,
      /class="ed-slot-lbl"/,
      `${file}: l'etichetta non è quella di tutti`,
    );
  }
});

test("nessuno dei quattro si è più scritto la voce della nota", () => {
  /* La voce sta in un posto solo. Un blocco che se la riscrive — anche uguale
   * — è un blocco che domani sarà diverso, e non se ne accorgerà nessuno
   * finché non si riapre quella scheda. */
  for (const [file] of I_QUATTRO) {
    const testo = sorgente(file);
    if (!/-nota\{/.test(testo)) continue;
    assert.match(
      testo,
      /\$\{NOTA_DI_SCHEDA\}/,
      `${file}: la nota si è riscritta la voce invece di prenderla da shared`,
    );
    assert.doesNotMatch(
      testo,
      /-nota\{[^}]*font-size:\s*\d/,
      `${file}: la nota si è scritta una misura sua`,
    );
  }
  /* E la voce esiste davvero, una sola. */
  const condiviso = sorgente("shared.js");
  assert.match(condiviso, /export const NOTA_DI_SCHEDA = "font-size:11\.5px;/);
});

test("il chiosco e l'intestazione non hanno più una riga tutta loro", () => {
  /* Erano `ed-form` con dentro glifo, testo e interruttore in tre colonne:
   * l'unica riga di quella scheda fatta così. */
  for (const file of ["modo-chiosco-section.js", "testa-fissa-section.js"]) {
    const testo = sorgente(file);
    assert.doesNotMatch(testo, /class="ed-form /, `${file}: è ancora un ed-form`);
    assert.doesNotMatch(testo, /-glifo"/, `${file}: ha ancora il disegno per conto suo`);
    /* L'interruttore è rimasto dov'era — è lo stesso — e sta in riga con
     * l'etichetta, dove finisce la riga: come la tendina della lingua. */
    assert.match(testo, /role="switch"/, `${file}: l'interruttore è sparito`);
    assert.match(
      testo,
      /display:flex;align-items:center;justify-content:space-between/,
      `${file}: l'etichetta e l'interruttore non stanno più sulla stessa riga`,
    );
  }
});

test("e i quattro blocchi hanno lo stesso respiro", () => {
  /* Sedici punti fra un blocco e l'altro: quello che aveva già la lingua.
   * Quattro distanze diverse sono la prima cosa che si vede. */
  for (const file of ["lingua-section.js", "modo-chiosco-section.js", "testa-fissa-section.js"])
    assert.match(
      sorgente(file),
      /margin-bottom:16px/,
      `${file}: sta attaccato al blocco dopo`,
    );
});
