/* Le prove delle case seguite, e soprattutto della striscia.
 *
 * La striscia e' la parte che ha gia' sbagliato una volta: una casa accesa
 * stamattina si vedeva con due settimane di rosso dietro, perche' i giorni in
 * cui non esisteva venivano giudicati come giorni muti. Un cruscotto che
 * mostra un guasto che non c'e' e' peggio di uno che non mostra niente:
 * insegna a non fidarsi delle sue strisce.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CaseSeguite } from "../src/case.js";

const UNA = "casa_a3f19c74e05b2d8890fa4c1e6b73d052";
const CHI = "inst_0123456789abcdef";
const GIORNO = 24 * 60 * 60 * 1000;
const MINUTO = 60 * 1000;

function banco(quando) {
  const cartella = mkdtempSync(join(tmpdir(), "quadro-case-"));
  let ora = quando;
  const case_ = new CaseSeguite({ cartella, adesso: () => ora });
  return {
    case: case_,
    vai: (quanto) => {
      ora += quanto;
    },
    get ora() {
      return ora;
    },
    chiudi: () => rmSync(cartella, { recursive: true, force: true }),
  };
}

const carta = (b) => ({ quando: new Date(b.ora).toISOString(), ogni: 15 });

test("una casa accesa oggi non ha due settimane di rosso dietro", () => {
  const b = banco(Date.parse("2026-09-18T09:00:00Z"));
  try {
    b.case.deposita(UNA, carta(b));
    const striscia = b.case.vestita(b.case.quella(UNA)).giorni;
    assert.equal(striscia.length, 14);
    /* Tredici giorni in cui questa casa non c'era: non si giudicano. */
    assert.equal(striscia.slice(0, 13), " ".repeat(13));
    /* E l'unico giudicato e' oggi, che e' pieno: un rapporto e' esattamente
     * quello che ci si aspettava nei quindici minuti da quando e' accesa. */
    assert.equal(striscia[13], "P");
  } finally {
    b.chiudi();
  }
});

test("il giorno in corso si giudica su quanto e' passato, non su ventiquattro ore", () => {
  const b = banco(Date.parse("2026-09-18T00:05:00Z"));
  try {
    b.case.deposita(UNA, carta(b));
    b.vai(3 * 60 * MINUTO);
    /* Tre ore dopo, e nessun altro rapporto: dodici saltate su dodici. */
    assert.equal(b.case.vestita(b.case.quella(UNA)).giorni.at(-1), "M");
  } finally {
    b.chiudi();
  }
});

test("un giorno senza nessun rapporto e' vuoto, e si vede", () => {
  /* Si parte a mezzanotte in punto, e non e' pignoleria: una giornata piena e'
   * un **giorno di calendario** pieno. Partendo da mezzogiorno, le novantasei
   * rapporti stanno a cavallo di due giorni e non ne riempiono nessuno — sono
   * quarantotto di qua e quarantotto di la', e la striscia dice giustamente
   * «a meta'» due volte. */
  const b = banco(Date.parse("2026-09-15T00:00:00Z"));
  try {
    for (let i = 0; i < 96; i += 1) {
      b.case.deposita(UNA, carta(b));
      b.vai(15 * MINUTO);
    }
    /* Poi due giorni di silenzio, e un rapporto il terzo. */
    b.vai(2 * GIORNO);
    b.case.deposita(UNA, carta(b));
    const striscia = b.case.vestita(b.case.quella(UNA)).giorni;
    assert.equal(striscia.slice(-4), "PVVP", "pieno, due muti, e quello appena tornato");
  } finally {
    b.chiudi();
  }
});

test("le case si ordinano per quello che chiedono, non per come sono arrivate", () => {
  const b = banco(Date.parse("2026-09-18T09:00:00Z"));
  try {
    const aPosto = "casa_11111111111111111111111111111111";
    const muta = "casa_22222222222222222222222222222222";
    b.case.deposita(muta, carta(b), CHI);
    b.case.rinomina(muta, "La muta", CHI);
    b.vai(3 * 60 * MINUTO);
    b.case.deposita(aPosto, { ...carta(b), telefoni: { abbinati: 1, visti7gg: 1 } }, CHI);
    b.case.rinomina(aPosto, "Quella a posto", CHI);
    const elenco = b.case.elenco(CHI);
    assert.equal(elenco[0].casa, muta, "chi non parla sta in cima");
    assert.equal(elenco[0].stato.chiave, "muta");
  } finally {
    b.chiudi();
  }
});

test("una casa senza nome si mostra con la matricola, non con una riga vuota", () => {
  const b = banco(Date.parse("2026-09-18T09:00:00Z"));
  try {
    b.case.deposita(UNA, carta(b));
    const vestita = b.case.vestita(b.case.quella(UNA));
    assert.equal(vestita.senzaNome, true);
    assert.match(vestita.nome, /^casa_a3f19c74…$/);
  } finally {
    b.chiudi();
  }
});

test("i giorni vecchi si buttano: la storia non cresce per sempre", () => {
  const b = banco(Date.parse("2026-08-01T09:00:00Z"));
  try {
    for (let i = 0; i < 40; i += 1) {
      b.case.deposita(UNA, carta(b));
      b.vai(GIORNO);
    }
    assert.ok(Object.keys(b.case.quella(UNA).giorni).length <= 22);
  } finally {
    b.chiudi();
  }
});
