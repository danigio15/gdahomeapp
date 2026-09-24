/* «Possibilità di togliere la sezione se uno non dispone di telecamere» (#113).
 *
 * Le telecamere non sono una sezione della plancia: stanno dentro Sicurezza,
 * insieme all'allarme e ai varchi. Chi non ne ha una poteva solo spegnere
 * Sicurezza intera — e perdere anche l'allarme e le porte, che con le
 * telecamere non c'entrano niente. Quello che restava era un riquadro CCTV
 * sempre vuoto in cima alla pagina, con dentro l'invito a configurarne una.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  CHIAVE_TELECAMERE_IN_SICUREZZA,
  laSceltaDelleTelecamere,
  leTelecamereSiVedono,
} from "../src/core/le-telecamere-si-vedono.js";
import { CONFIG_KEYS } from "../src/core/chiavi-di-configurazione.js";

const leggi = (quale) => readFileSync(new URL(quale, import.meta.url), "utf8");

test("chi non l'ha mai toccato le vede, come prima", () => {
  /* Una casa che si aggiorna non deve vedere sparire niente: la chiave non
   * c'è ancora, e la risposta a «non c'è scritto» deve essere quella di
   * prima. */
  for (const scritto of [null, undefined, {}, "", 0, { mostra: true }])
    assert.equal(leTelecamereSiVedono(scritto), true, `${JSON.stringify(scritto)} deve mostrare`);
});

test("si spegne solo scrivendolo, e quello è l'unico modo", () => {
  assert.equal(leTelecamereSiVedono({ mostra: false }), false);
  assert.equal(leTelecamereSiVedono(false), false);
  /* Un valore che non conosciamo — una versione futura, una chiave rimasta a
   * mezzo — mostra: nascondere una cosa che c'è è il guasto peggiore dei due,
   * perché chi se la vede sparire non sa nemmeno cosa cercare. */
  assert.equal(leTelecamereSiVedono({ mostra: "boh" }), true);
  assert.equal(leTelecamereSiVedono("false"), true);
});

test("quello che si scrive è sempre la stessa forma", () => {
  assert.deepEqual(laSceltaDelleTelecamere(false), { mostra: false });
  assert.deepEqual(laSceltaDelleTelecamere(true), { mostra: true });
  /* E una chiamata senza argomento non spegne niente per distrazione. */
  assert.deepEqual(laSceltaDelleTelecamere(), { mostra: true });
});

test("la scelta viaggia con la configurazione, non resta su un vetro solo", () => {
  /* Chi telecamere non ne ha non le vuole vedere né sul tablet in cucina né
   * sul telefono: senza questa riga l'interruttore andrebbe rispento su ogni
   * schermo, cioè sembrerebbe non funzionare. */
  assert.ok(CONFIG_KEYS.includes(CHIAVE_TELECAMERE_IN_SICUREZZA));
});

test("la pagina Sicurezza nasconde il riquadro e la sua pastiglia, e nient'altro", () => {
  const pagina = leggi("../src/sections/security-showcase-section.js");
  assert.match(pagina, /leTelecamereSiVedono\(readJson\(CHIAVE_TELECAMERE_IN_SICUREZZA, null\)\)/);
  assert.match(pagina, /\.dm-sec-cctv"\);\s*\n\s*if \(cctv\) cctv\.hidden = !siVedono;/);
  assert.match(pagina, /\[data-dm-cctv-pill\]"\);\s*\n\s*if \(pastiglia\) pastiglia\.hidden = !siVedono;/);
  /* L'allarme e i varchi non si toccano: sono l'altra metà di quella pagina,
   * ed è per non perderli che questo interruttore esiste. */
  assert.doesNotMatch(pagina, /dm-sec-alarm"\)?\.hidden/);
});

test("l'interruttore non cancella le telecamere: le lascia dove sono", () => {
  const scheda = leggi("../src/sections/telecamere-si-spengono-editor-section.js");
  /* Scrive una chiave sola, e non tocca l'elenco delle telecamere. */
  assert.match(scheda, /writeJsonIfChanged\(CHIAVE_TELECAMERE_IN_SICUREZZA/);
  assert.doesNotMatch(scheda, /writeJson\w*\(\s*"cd_cameras"/);
  /* E lo dice: spento, conta quante ne restano configurate. */
  assert.match(scheda, /configured cameras that are not shown here now/);
});
