/* «I tasti on/off in automazioni non funzionano» (#552).
 *
 * Nella sezione che uno si fa da sé, un'automazione aveva una levetta — con
 * tanto di stato acceso e spento — che al tocco la faceva PARTIRE. Far partire
 * non cambia lo stato che la levetta mostra, quindi la levetta scattava e
 * tornava indietro: sembrava che non succedesse niente.
 *
 * Chiesto a chi ha segnalato quale dei due gesti volesse, la risposta è stata
 * la seconda: «abilitarla o disabilitarla, perché a volte le attivo io e a
 * volte si attivano da sole quando inserisco l'allarme». Prima ancora, nella
 * #504, qualcun altro voleva proprio farle partire — e prima di quella
 * correzione il tocco le disabilitava di nascosto.
 *
 * Hanno ragione tutti e due: un'automazione ha due gesti, e nessuno dei due è
 * l'altro. Adesso ha due comandi — la levetta che abilita e il tasto ▶ che fa
 * partire — e questa prova tiene fermi tutti e due, perché correggerne uno
 * rompendo l'altro è già successo una volta.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  comandoCheAbilita,
  comandoDelDispositivo,
  siPuoAbilitare,
} from "../src/core/comandi-accanto.js";
import { letturaDellaVoce } from "../src/core/sezioni-mie.js";

const SEZIONE = readFileSync(
  new URL("../src/sections/sezioni-mie-section.js", import.meta.url),
  "utf8",
);

test("un'automazione si abilita con un verbo e si fa partire con un altro", () => {
  const entity = "automation.luci_di_sera";
  /* La levetta: `toggle` la abilita o la disabilita, ed è lo stato che Home
   * Assistant le vede addosso. */
  assert.deepEqual(comandoCheAbilita({ entity }), {
    domain: "automation",
    service: "toggle",
    data: { entity_id: entity },
  });
  /* Il tasto: `trigger` la fa partire adesso e non tocca quello stato. È il
   * verbo della #504, e resta quello. */
  assert.deepEqual(comandoDelDispositivo({ entity }), {
    domain: "automation",
    service: "trigger",
    data: { entity_id: entity },
  });
});

test("il secondo verbo ce l'ha solo chi ha due gesti", () => {
  /* Una luce si accende e basta: darle un tasto «fai partire» accanto alla
   * levetta vorrebbe dire due comandi per la stessa cosa. */
  assert.equal(siPuoAbilitare("automation.sera"), true);
  for (const entity of [
    "light.salotto",
    "switch.presa",
    "script.buonanotte",
    "scene.cinema",
    "fan.camera",
    "",
  ]) {
    assert.equal(siPuoAbilitare(entity), false, entity);
    assert.equal(comandoCheAbilita({ entity }), null, entity);
  }
});

test("la riga dice che quell'entità ha due gesti, e chi disegna la legge", () => {
  const stati = {
    "automation.sera": { state: "on", attributes: { friendly_name: "Luci di sera" } },
    "light.salotto": { state: "off", attributes: { friendly_name: "Salotto" } },
  };
  const automazione = letturaDellaVoce({ id: "a", entity: "automation.sera" }, stati);
  assert.equal(automazione.comandabile, true);
  assert.equal(automazione.avviabile, true);
  /* Abilitata vuol dire «on»: è lo stato che la levetta mostra. */
  assert.equal(automazione.acceso, true);

  const luce = letturaDellaVoce({ id: "l", entity: "light.salotto" }, stati);
  assert.equal(luce.comandabile, true);
  assert.equal(luce.avviabile, false);
});

test("la levetta chiede il verbo che abilita, prima di quello di sempre", () => {
  /* Il difetto era qui: la levetta chiedeva il verbo del TASTO. L'ordine è la
   * correzione, e va tenuto fermo — invertirlo rimette la levetta a far
   * partire. */
  const dentro = SEZIONE.slice(SEZIONE.indexOf("function onClick("));
  assert.match(dentro, /comandoCheAbilita\(\{ entity \}\) \|\|\s*\n?\s*comandoDelDispositivo\(/);
});

test("il tasto «fai partire» si legge prima della levetta", () => {
  /* Stanno nella stessa casella, e un tocco sul tasto è dentro la casella:
   * chiedere prima la levetta lo farebbe passare per un tocco sulla levetta,
   * cioè il difetto di partenza all'incontrario. */
  const dentro = SEZIONE.slice(SEZIONE.indexOf("function onClick("));
  assert.ok(
    dentro.indexOf("data-dm-mia-parti") < dentro.indexOf("data-dm-mia-tocca"),
    "il tasto va cercato per primo",
  );
});

test("i figli della riga restano quattro, o la tessera si allunga", () => {
  /* La griglia della voce ha quattro colonne. Il tasto nuovo sta dentro la
   * casella di coda insieme alla levetta: un quinto figlio andrebbe a capo e
   * porterebbe con sé l'altezza della tessera — l'opposto di «più piccole»
   * (#515). */
  assert.match(SEZIONE, /<span class="dm-mia-coda">\$\{codaMarkup\(riga\)\}<\/span>/);
  assert.match(SEZIONE, /\.dm-mia-coda\{display:flex/);
  /* E la colonna di coda si misura su quello che contiene, non su 46px fissi:
   * col tasto accanto alla levetta quella misura non basta più. */
  assert.doesNotMatch(SEZIONE, /grid-template-columns:38px minmax\(0,1fr\) auto 46px/);
  assert.doesNotMatch(SEZIONE, /grid-template-columns:44px minmax\(0,1fr\) auto 52px/);
});
