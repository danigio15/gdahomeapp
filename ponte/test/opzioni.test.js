/* Le prove di come si leggono le opzioni della scheda dell'add-on.
 *
 * Qui dentro c'e' una regola che decide **chi vede cosa**, e prima non era
 * provata da niente: il cruscotto dell'installatore e la gestione del quadro
 * esistono solo se c'e' la loro chiave. Un interruttore acceso senza chiave
 * non e' una porta chiusa — non e' una porta.
 *
 * Si prova leggendo un `options.json` vero da una cartella vera, perche' e'
 * quello che fa il Supervisor: le variabili d'ambiente sono per il banco, e
 * provare solo quelle vorrebbe dire provare la strada che in casa di nessuno
 * viene percorsa.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { leggiLeOpzioni } from "../src/opzioni.js";

/* Una cartella con dentro l'`options.json` che ci si scrive, come la scrive il
 * Supervisor. */
function scheda(t, cosa) {
  const cartella = mkdtempSync(join(tmpdir(), "opzioni-"));
  t.after(() => rmSync(cartella, { recursive: true, force: true }));
  writeFileSync(join(cartella, "options.json"), JSON.stringify(cosa));
  return leggiLeOpzioni(cartella);
}

test("una scheda vuota non accende niente di tutto questo", (t) => {
  const o = scheda(t, {});
  assert.equal(o.installatore, false);
  assert.equal(o.gestore, false);
  assert.equal(o.chiaveDelCruscotto, "");
  assert.equal(o.chiaveDellaGestione, "");
});

test("l'interruttore dell'installatore, senza il codice, non apre niente", (t) => {
  /* E' il caso che ha fatto cambiare la regola: acceso per curiosita', o
   * acceso in casa di un cliente. Prima compariva comunque una sezione nella
   * console e una voce nella barra laterale — porte che non si aprivano, ma
   * che si vedevano. */
  const o = scheda(t, { installatore: true });
  assert.equal(o.installatore, false, "senza codice non e' acceso, qualunque cosa dica la casella");
});

test("il codice dell'installatore, senza l'interruttore, nemmeno", (t) => {
  /* L'altra meta': chi incolla un codice e non accende non ha chiesto niente.
   * Servono tutt'e due, e in nessun ordine una sola basta. */
  const o = scheda(t, { chiave_cruscotto: "K7M2-9XQF-3BHT-R4VN" });
  assert.equal(o.installatore, false);
  assert.equal(o.chiaveDelCruscotto, "K7M2-9XQF-3BHT-R4VN", "il codice si legge lo stesso");
});

test("interruttore e codice insieme: adesso si', e il codice arriva a chi lo usa", (t) => {
  const o = scheda(t, { installatore: true, chiave_cruscotto: "K7M2-9XQF-3BHT-R4VN" });
  assert.equal(o.installatore, true);
  assert.equal(o.chiaveDelCruscotto, "K7M2-9XQF-3BHT-R4VN");
});

test("la gestione non ha nessun interruttore: la chiave e' l'interruttore", (t) => {
  /* `gestore: true` e' quello che si ritrova scritto chi aggiorna da una
   * versione in cui la casella c'era. Non deve contare piu' niente: era un
   * interruttore su case che non c'entravano, ed e' il motivo per cui e'
   * stato tolto. */
  assert.equal(scheda(t, { gestore: true }).gestore, false, "la casella vecchia non conta piu'");
  assert.equal(scheda(t, { chiave_gestione: "GG-1234-ABCD-5678" }).gestore, true);
});

test("uno spazio incollato per sbaglio non fa fallire una chiave", (t) => {
  /* Queste si copiano da un messaggio o da una mail, e uno spazio in fondo e'
   * il modo piu' comune di ritrovarsi una chiave «scritta» che non apre
   * niente. Meglio toglierlo qui che spiegarlo al telefono. */
  const o = scheda(t, {
    installatore: true,
    chiave_cruscotto: "  K7M2-9XQF-3BHT-R4VN\n",
    chiave_gestione: " GG-1234-ABCD-5678 ",
  });
  assert.equal(o.installatore, true);
  assert.equal(o.chiaveDelCruscotto, "K7M2-9XQF-3BHT-R4VN");
  assert.equal(o.chiaveDellaGestione, "GG-1234-ABCD-5678");
  assert.equal(o.gestore, true);
});

test("una chiave fatta di soli spazi e' una chiave vuota", (t) => {
  const o = scheda(t, { installatore: true, chiave_cruscotto: "   ", chiave_gestione: "\t\n" });
  assert.equal(o.installatore, false);
  assert.equal(o.gestore, false);
});
