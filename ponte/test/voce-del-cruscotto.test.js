/* La voce «Cruscotto» detta a Home Assistant.
 *
 * Il rischio vero di questo pezzo non e' che non funzioni: e' che non funzioni
 * **la prima volta** e nessuno se ne accorga. All'accensione dell'add-on Home
 * Assistant sta spesso ancora partendo, l'integrazione i suoi comandi non li
 * ha registrati, e il primo tentativo torna «comando sconosciuto». Se ci si
 * fermasse li', l'installatore accende l'interruttore, non vede niente, e
 * conclude che e' rotto.
 *
 * L'altra meta' e' lo spegnimento: si deve dire **anche** quando l'interruttore
 * e' spento, se no la voce resta appesa fino al riavvio dopo — cioe' una voce
 * che porta a un posto che non si vuole piu' mostrare.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { COMANDO, VoceDelCruscotto } from "../src/voce-del-cruscotto.js";

const DOVE = "https://quadro.gdahome.org/console/";

/* Una casa finta: registra cosa le si chiede, e risponde come le si dice. */
function casaFinta(risposte) {
  const chieste = [];
  return {
    chieste,
    chiedi: async (comando) => {
      chieste.push(comando);
      const risposta = risposte.shift();
      if (risposta instanceof Error) throw risposta;
      return risposta ?? { success: true };
    },
  };
}

const zitto = { info() {}, attenzione() {}, errore() {} };

/* L'attesa delle prove: un timer **senza** `unref`, se no il giro delle prove
 * si chiude mentre la promessa e' ancora in mano a nessuno. Quello vero
 * l'`unref` ce l'ha apposta, e non si tocca per far contente le prove. */
const aspettaDavvero = (quanto) => new Promise((ok) => setTimeout(ok, quanto));

test("acceso, lo dice con l'indirizzo del quadro", async () => {
  const casa = casaFinta([{ success: true, result: { mostrata: true } }]);
  const voce = new VoceDelCruscotto({
    casa,
    installatore: true,
    dove: DOVE,
    registro: zitto,
    aspetta: aspettaDavvero,
  });

  assert.equal((await voce.dillo()).fatto, true);
  assert.deepEqual(casa.chieste, [{ type: COMANDO, installatore: true, dove: DOVE }]);
});

test("spento, lo dice lo stesso — se no la voce resta appesa", async () => {
  const casa = casaFinta([{ success: true }]);
  const voce = new VoceDelCruscotto({
    casa,
    installatore: false,
    dove: DOVE,
    registro: zitto,
    aspetta: aspettaDavvero,
  });

  assert.equal((await voce.dillo()).fatto, true);
  assert.equal(casa.chieste.length, 1, "spegnere si dice, non si tace");
  assert.equal(casa.chieste[0].installatore, false);
  assert.equal(casa.chieste[0].dove, "", "spento non si manda nessun indirizzo");
});

test("un «no» dell'integrazione non si scambia per un si'", async () => {
  const casa = casaFinta([{ success: false, error: { message: "unknown command" } }]);
  const voce = new VoceDelCruscotto({
    casa,
    installatore: true,
    dove: DOVE,
    registro: zitto,
    aspetta: aspettaDavvero,
  });

  const esito = await voce.dillo();
  assert.equal(esito.fatto, false);
  assert.match(esito.perche, /unknown command/);
});

test("un filo che cade non fa cadere il ponte", async () => {
  const casa = casaFinta([new Error("il filo e' chiuso")]);
  const voce = new VoceDelCruscotto({
    casa,
    installatore: true,
    dove: DOVE,
    registro: zitto,
    aspetta: aspettaDavvero,
  });

  const esito = await voce.dillo();
  assert.equal(esito.fatto, false);
  assert.match(esito.perche, /il filo e' chiuso/);
});

test("se la prima volta l'integrazione non c'era ancora, si riprova", async () => {
  /* E' il caso che capita davvero a ogni accensione. */
  const casa = casaFinta([
    { success: false, error: { message: "unknown command" } },
    { success: true },
  ]);
  const voce = new VoceDelCruscotto({
    casa,
    installatore: true,
    dove: DOVE,
    registro: zitto,
    aspetta: aspettaDavvero,
  });

  const esito = await voce.dilloConCalma([1]);
  assert.equal(esito.fatto, true);
  assert.equal(casa.chieste.length, 2);
});

test("non si riprova per sempre, e alla fine lo dice una volta sola", async () => {
  const no = () => ({ success: false, error: { message: "unknown command" } });
  const casa = casaFinta([no(), no(), no()]);
  const detto = [];
  const voce = new VoceDelCruscotto({
    casa,
    installatore: true,
    dove: DOVE,
    registro: { ...zitto, attenzione: (t) => detto.push(t) },
    aspetta: aspettaDavvero,
  });

  const esito = await voce.dilloConCalma([1, 1]);
  assert.equal(esito.fatto, false);
  assert.equal(casa.chieste.length, 3, "il primo piu' due ritenativi, e basta");
  assert.equal(detto.length, 1, "un add-on senza l'integrazione non deve gridare");
});

test("fermarlo interrompe i tentativi: il ponte si abbassa e non resta niente dietro", async () => {
  const no = () => ({ success: false, error: { message: "unknown command" } });
  const casa = casaFinta([no(), no(), no()]);
  const voce = new VoceDelCruscotto({
    casa,
    installatore: true,
    dove: DOVE,
    registro: zitto,
    aspetta: aspettaDavvero,
  });

  const giro = voce.dilloConCalma([20, 20]);
  voce.ferma();
  await giro;
  assert.equal(casa.chieste.length, 1, "dopo il primo non ci ha piu' provato");
});

test("senza nessuno a cui dirlo non si schianta", async () => {
  const voce = new VoceDelCruscotto({
    casa: null,
    installatore: true,
    dove: DOVE,
    registro: zitto,
  });
  assert.equal((await voce.dillo()).fatto, false);
});
