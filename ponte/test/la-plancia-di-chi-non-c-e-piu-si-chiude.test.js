/* La plancia aperta dentro Home Assistant da un utente che poi viene tolto o
 * spento si chiude, come il filo di un suo telefono. Prima restava cucita e
 * continuava a ricevere la casa col gettone del Supervisor. */
import { test } from "node:test";
import assert from "node:assert/strict";

import { Cucitura } from "../src/cucitura.js";

const MARIO = "a".repeat(32);
const LUCIA = "b".repeat(32);

function preparati(chiGuarda) {
  const chiusure = [];
  const presa = {
    manda() {},
    chiudi(codice, perche) {
      chiusure.push({ codice, perche });
    },
  };
  const ascoltatori = new Set();
  const utenti = {
    quandoCambia(ascolta) {
      ascoltatori.add(ascolta);
      return () => ascoltatori.delete(ascolta);
    },
    amministratoreSubito: () => false,
  };
  const cucitura = new Cucitura({
    presa,
    casa: { apriIlFilo: async () => ({ manda: () => true, chiudi() {} }) },
    registro: { info() {}, attenzione() {}, errore() {} },
    chiGuarda,
    utenti,
  });
  const cambia = (elenco) => [...ascoltatori].forEach((ascolta) => ascolta(elenco));
  return { cucitura, chiusure, cambia, ascoltatori };
}

test("un utente tolto o spento: la sua plancia si chiude", () => {
  for (const elenco of [
    [{ id: LUCIA, attivo: true }],
    [
      { id: MARIO, attivo: false },
      { id: LUCIA, attivo: true },
    ],
  ]) {
    const { cucitura, chiusure, cambia, ascoltatori } = preparati(MARIO);
    cambia([{ id: MARIO, attivo: true }]);
    assert.equal(chiusure.length, 0, "finche' c'e' resta aperta");
    cambia(elenco);
    assert.equal(cucitura.chiusa, true);
    assert.equal(chiusure[0].codice, 1008);
    assert.equal(ascoltatori.size, 0, "e smette di ascoltare");
  }
});

test("un elenco vuoto non chiude niente, e chiudendo si smette di ascoltare", () => {
  const { cucitura, chiusure, cambia, ascoltatori } = preparati(MARIO);
  cambia([]);
  assert.equal(chiusure.length, 0);
  cucitura.chiudi(1000, "la pagina se n'e' andata");
  assert.equal(ascoltatori.size, 0);
});

test("una pagina che manda migliaia di messaggi di fila si chiude", async () => {
  const { cucitura, chiusure } = preparati(MARIO);
  await cucitura.avvia();
  /* Una plancia vera, all'avvio, passa. */
  for (let i = 0; i < 100; i += 1) cucitura._dallaPagina(JSON.stringify({ id: i, type: "ping" }));
  assert.equal(cucitura.chiusa, false);
  for (let i = 0; i < 700 && !cucitura.chiusa; i += 1)
    cucitura._dallaPagina(JSON.stringify({ id: i, type: "ping" }));
  assert.equal(cucitura.chiusa, true);
  assert.equal(chiusure[0].codice, 1008);
});
