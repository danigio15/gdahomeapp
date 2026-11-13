/* Un telefono che manda tanti `auth` di fila, prima che il primo abbia avuto
 * risposta: ognuno apriva un filo suo verso Home Assistant, e del ponte
 * restava tenuto solo l'ultimo — gli altri aperti, senza nessuno. Adesso
 * l'autenticazione e' una alla volta: quelli che arrivano mentre la prima
 * aspetta la casa si lasciano cadere.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Ponte } from "../src/ponte.js";

const ZITTO = { info() {}, attenzione() {}, errore() {} };
const SEGNO = "il-segno-del-telefono";

/* Una presa finta: tiene quello che il ponte le manda. */
function unaPresa() {
  const mandati = [];
  return {
    mandati,
    chiusa: false,
    manda(testo) {
      mandati.push(JSON.parse(testo));
    },
    ping() {},
    chiudi() {
      this.chiusa = true;
    },
  };
}

test("cento `auth` insieme aprono un filo solo verso la casa", async () => {
  const fili = [];
  let lascia;
  const finche = new Promise((via) => {
    lascia = via;
  });
  const casa = {
    async apriIlFilo() {
      const filo = { chiuso: false, manda: () => true, chiudi: () => (filo.chiuso = true) };
      fili.push(filo);
      /* La casa ci mette un po' a rispondere: e' qui che arrivano gli altri. */
      await finche;
      return filo;
    },
  };
  const dispositivi = {
    riconosci: (segno) => (segno === SEGNO ? { id: "telefono", nome: "telefono" } : null),
  };
  const ponte = new Ponte({ casa, dispositivi, registro: ZITTO });
  const presa = unaPresa();
  const collegamento = ponte.accogli(presa, { da: "prova" });
  try {
    for (let volta = 0; volta < 100; volta += 1)
      presa.onMessaggio(JSON.stringify({ type: "auth", access_token: SEGNO }));
    lascia();
    await new Promise((fatto) => setTimeout(fatto, 20));
    assert.equal(fili.length, 1);
    assert.equal(presa.mandati.filter((uno) => uno.type === "auth_ok").length, 1);
    assert.equal(collegamento.filo, fili[0]);
    assert.equal(fili[0].chiuso, false);
  } finally {
    ponte.chiudiTutto();
  }
});
