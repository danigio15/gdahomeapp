/* «La lavastoviglie è in funzione ma la card indica spenta» (#27, #20).
 *
 * > La lavastoviglie è in funzione ma la card indica spenta. Ho provato a
 * > riavviare ma nulla. Integrata con Home Connect. (#27)
 *
 * > Una volta integrati tutti gli elettrodomestici Samsung tramite
 * > associazione SmartThings non mostrano nessun dato: risultano sempre spenti
 * > anche quando non lo sono. Su schermata classica Home Assistant tutto
 * > funziona correttamente. (#20)
 *
 * «Su Home Assistant tutto funziona» è la frase che indirizza: le entità ci
 * sono e gli stati arrivano. È la plancia che non li legge.
 *
 * Home Connect non pubblica la parola: pubblica il suo indirizzo dentro il
 * protocollo Bosch — `BSH.Common.EnumType.OperationState.Run`. Il vocabolario
 * quella parola ce l'ha, `run` sta fra quelle che lavorano da sempre, ma
 * cercava la riga intera; e la riga intera non è una parola, è un percorso che
 * finisce con la parola. Così una macchina che dice chiarissimo «Run» cadeva
 * in fondo alla scala e usciva SPENTA.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { letturaDelloStato } from "../src/core/appliance-view-model.js";

test("Home Connect scrive lo stato per esteso, e adesso si legge", () => {
  assert.equal(letturaDelloStato("BSH.Common.EnumType.OperationState.Run"), "running");
  assert.equal(letturaDelloStato("BSH.Common.EnumType.OperationState.Ready"), "off");
  assert.equal(letturaDelloStato("BSH.Common.EnumType.OperationState.Finished"), "off");
  assert.equal(letturaDelloStato("BSH.Common.EnumType.OperationState.DelayedStart"), "standby");
  assert.equal(letturaDelloStato("BSH.Common.EnumType.OperationState.Pause"), "standby");
  /* «Chiede qualcosa» non è «spenta»: lo sportello, il brillantante, l'acqua. */
  assert.equal(letturaDelloStato("BSH.Common.EnumType.OperationState.ActionRequired"), "standby");
});

test("la parola nuda continua a valere: non si è rotto niente", () => {
  assert.equal(letturaDelloStato("running"), "running");
  assert.equal(letturaDelloStato("rinse"), "running");
  assert.equal(letturaDelloStato("finished"), "off");
  assert.equal(letturaDelloStato("paused"), "standby");
  assert.equal(letturaDelloStato(""), "");
  assert.equal(letturaDelloStato("qualcosa che nessuno dice"), "");
});

test("si guarda l'ultimo pezzo, non una parola qualunque dentro l'indirizzo", () => {
  /* `…OperationState.Ready` finisce con «Ready» e deve dire pronto. Cercando
   * una parola conosciuta DENTRO tutto l'indirizzo, «OperationState» e «Ready»
   * litigherebbero nella stessa riga e vincerebbe la prima scritta. */
  assert.equal(letturaDelloStato("BSH.Common.EnumType.OperationState.Ready"), "off");
  /* E un indirizzo che finisce con una parola sconosciuta non decide niente:
   * decidono i watt, com'è sempre stato. */
  assert.equal(letturaDelloStato("BSH.Common.EnumType.OperationState.Bohvattelapesca"), "");
  /* Un punto alla fine non è un ultimo pezzo. */
  assert.equal(letturaDelloStato("qualcosa."), "");
});

test("vale per chiunque scriva così, non solo per Bosch", () => {
  /* SmartThings ha i suoi nomi lunghi, e il conto è lo stesso. */
  assert.equal(letturaDelloStato("samsungce.washerOperatingState.wash"), "running");
  assert.equal(letturaDelloStato("main.machineState.stop"), "off");
});
