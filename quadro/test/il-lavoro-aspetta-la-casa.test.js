/* Il lavoro che l'installatore chiede, e che la casa passa a prendersi.
 *
 * Verso una casa non c'e' nessuna porta: e' lei che ogni minuto manda il
 * rapporto, e nella risposta trova — qualche volta — cosa fare. Qui si prova
 * il pezzo di quadro che sta in mezzo: dove il comando aspetta, chi lo puo'
 * chiedere, e quando si butta invece di partire il giorno dopo.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CaseSeguite, UN_LAVORO_ASPETTA } from "../src/case.js";

const UNA = "casa_a3f19c74e05b2d8890fa4c1e6b73d052";
const CHI = "inst_0123456789abcdef";
const UN_ALTRO = "inst_fedcba9876543210";

function banco(quando = Date.parse("2026-09-18T09:00:00Z")) {
  const cartella = mkdtempSync(join(tmpdir(), "quadro-lavori-"));
  let ora = quando;
  return {
    case: new CaseSeguite({ cartella, adesso: () => ora }),
    vai: (quanto) => {
      ora += quanto;
    },
    get ora() {
      return ora;
    },
    chiudi: () => rmSync(cartella, { recursive: true, force: true }),
  };
}

const carta = (piu = {}) => ({
  quando: new Date().toISOString(),
  ogni: 1,
  manutenzione: true,
  ...piu,
});

const QUESTO = { nome: "Shelly Plus", da: "1.2.0", a: "1.3.0" };

test("chiesto qui, se lo porta via la casa al primo rapporto", () => {
  const b = banco();
  try {
    b.case.deposita(UNA, carta(), CHI);
    const messo = b.case.chiediUnLavoro(UNA, QUESTO, CHI);
    assert.ok(messo?.id);
    assert.equal(messo.cosa, "installa");

    /* Prima che passi, la console lo fa vedere come «chiesto». */
    assert.equal(b.case.vestita(b.case.quella(UNA)).chiesto.nome, "Shelly Plus");

    const preso = b.case.ilLavoroDa(UNA);
    assert.deepEqual(preso, { id: messo.id, cosa: "installa", ...QUESTO });
    /* E una volta consegnato non si riconsegna: il rapporto dopo non lo
     * rifa' partire. */
    assert.equal(b.case.vestita(b.case.quella(UNA)).chiesto, null);
  } finally {
    b.chiudi();
  }
});

test("una casa che non ha aperto la manutenzione non si fa chiedere niente", () => {
  const b = banco();
  try {
    b.case.deposita(UNA, carta({ manutenzione: false }), CHI);
    assert.equal(b.case.chiediUnLavoro(UNA, QUESTO, CHI), null);
    assert.equal(b.case.ilLavoroDa(UNA), null);
  } finally {
    b.chiudi();
  }
});

test("la casa di un altro non gliela tocca nessuno", () => {
  /* Le matricole si possono scrivere a mano: `di` e' un lucchetto, non un
   * filtro. Stessa regola di `rinomina`. */
  const b = banco();
  try {
    b.case.deposita(UNA, carta(), CHI);
    assert.equal(b.case.chiediUnLavoro(UNA, QUESTO, UN_ALTRO), null);
    assert.equal(b.case.annullaIlLavoro(UNA, UN_ALTRO), false);
  } finally {
    b.chiudi();
  }
});

test("uno per volta: due insieme vorrebbero dire non sapere quale non e' tornato", () => {
  const b = banco();
  try {
    b.case.deposita(UNA, carta(), CHI);
    assert.ok(b.case.chiediUnLavoro(UNA, QUESTO, CHI));
    assert.equal(b.case.chiediUnLavoro(UNA, { nome: "Altro", da: "1", a: "2" }, CHI), null);
  } finally {
    b.chiudi();
  }
});

test("quello che nessuno viene a prendere scade, invece di partire domani", () => {
  /* Una casa che parla manda un rapporto al minuto: dieci minuti di silenzio
   * vogliono dire spenta. Tenerglielo li' vorrebbe dire un aggiornamento che
   * parte da solo la notte che torna su, quando chi l'ha chiesto se n'e'
   * dimenticato. */
  const b = banco();
  try {
    b.case.deposita(UNA, carta(), CHI);
    b.case.chiediUnLavoro(UNA, QUESTO, CHI);
    b.vai(UN_LAVORO_ASPETTA + 1000);
    assert.equal(b.case.ilLavoroDa(UNA), null);
    /* E scaduto non blocca: la stessa cosa si puo' richiedere. */
    assert.ok(b.case.chiediUnLavoro(UNA, QUESTO, CHI));
  } finally {
    b.chiudi();
  }
});

test("quando la casa racconta di averlo preso, il quadro se lo toglie di mezzo", () => {
  /* Da li' in poi lo stato lo racconta lei, nel rapporto: uno solo dei due lo
   * sa per davvero, ed e' quella che lo sta facendo. */
  const b = banco();
  try {
    b.case.deposita(UNA, carta(), CHI);
    const messo = b.case.chiediUnLavoro(UNA, QUESTO, CHI);
    b.case.ilLavoroDa(UNA);
    b.case.deposita(UNA, carta({ lavoro: { id: messo.id, stato: "in corso" } }), CHI);
    assert.equal(b.case.quella(UNA).lavoro, null);
  } finally {
    b.chiudi();
  }
});

test("un lavoro senza nome o senza versione nuova non e' un lavoro", () => {
  const b = banco();
  try {
    b.case.deposita(UNA, carta(), CHI);
    assert.equal(b.case.chiediUnLavoro(UNA, { nome: "", da: "1", a: "2" }, CHI), null);
    assert.equal(b.case.chiediUnLavoro(UNA, { nome: "Shelly", da: "1", a: "" }, CHI), null);
    assert.equal(b.case.chiediUnLavoro(UNA, {}, CHI), null);
  } finally {
    b.chiudi();
  }
});

test("si puo' annullare finche' la casa non e' passata", () => {
  const b = banco();
  try {
    b.case.deposita(UNA, carta(), CHI);
    b.case.chiediUnLavoro(UNA, QUESTO, CHI);
    assert.equal(b.case.annullaIlLavoro(UNA, CHI), true);
    assert.equal(b.case.ilLavoroDa(UNA), null);
    assert.equal(b.case.annullaIlLavoro(UNA, CHI), false);
  } finally {
    b.chiudi();
  }
});

test("una casa che non esiste non si fa chiedere niente", () => {
  const b = banco();
  try {
    assert.equal(b.case.chiediUnLavoro(UNA, QUESTO, CHI), null);
    assert.equal(b.case.ilLavoroDa(UNA), null);
  } finally {
    b.chiudi();
  }
});

test("consegnato una volta, non si riconsegna: se no si rifa' partire ogni minuto", () => {
  /* Il caso vero: una casa se lo porta via e poi non ne parla piu'. Succede
   * quando quello che si installa e' gdahome stesso — il processo che dovrebbe
   * raccontare com'e' andata e' quello che si sta aggiornando — e riofrirlo al
   * rapporto dopo vorrebbe dire un'installazione al minuto. */
  const b = banco();
  try {
    b.case.deposita(UNA, carta(), CHI);
    b.case.chiediUnLavoro(UNA, QUESTO, CHI);
    assert.ok(b.case.ilLavoroDa(UNA));
    assert.equal(b.case.ilLavoroDa(UNA), null);
    b.vai(60 * 1000);
    assert.equal(b.case.ilLavoroDa(UNA), null);
  } finally {
    b.chiudi();
  }
});
