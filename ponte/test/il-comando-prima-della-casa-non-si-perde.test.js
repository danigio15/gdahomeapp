/* Un comando toccato mentre la plancia dentro Home Assistant si ricollega.
 *
 * «Le luci centrali non le spegne.» La presa della pagina e' aperta appena il
 * browser la apre, ma il filo verso Home Assistant la cucitura lo apre dopo —
 * e su una casa lenta ci vogliono secondi. Il runtime della plancia guarda solo
 * che la presa sia aperta (`dmCallHaService`), e un tocco in quell'attimo
 * arrivava alla cucitura senza filo: lei chiudeva tutto, il comando si perdeva
 * e la plancia ripartiva da capo. Adesso il comando aspetta il filo, e parte. */
import { test } from "node:test";
import assert from "node:assert/strict";

import { Cucitura } from "../src/cucitura.js";

function preparati() {
  const allaPagina = [];
  const chiusure = [];
  const allaCasa = [];
  let apri;
  const presa = {
    manda(testo) {
      allaPagina.push(JSON.parse(testo));
    },
    chiudi(codice, perche) {
      chiusure.push({ codice, perche });
    },
  };
  const cucitura = new Cucitura({
    presa,
    casa: {
      apriIlFilo: () =>
        new Promise((fatto) => {
          apri = () =>
            fatto({
              manda: (testo) => {
                allaCasa.push(JSON.parse(testo));
                return true;
              },
              chiudi() {},
            });
        }),
    },
    registro: { info() {}, attenzione() {}, errore() {} },
    chiGuarda: "a".repeat(32),
    utenti: { amministratoreSubito: () => true, amministratore: async () => true },
  });
  return { cucitura, allaPagina, allaCasa, chiusure, apri: () => apri() };
}

const SPEGNI = {
  id: 41,
  type: "call_service",
  domain: "light",
  service: "toggle",
  service_data: { entity_id: "light.led_centrali" },
};

test("un comando arrivato prima del filo con la casa parte quando il filo c'e'", async () => {
  const { cucitura, allaPagina, allaCasa, chiusure, apri } = preparati();
  const avviata = cucitura.avvia();
  await new Promise((fatto) => setImmediate(fatto));
  cucitura._dallaPagina(JSON.stringify(SPEGNI));
  assert.equal(chiusure.length, 0, "la pagina non si chiude");
  assert.equal(cucitura.chiusa, false);
  assert.deepEqual(allaCasa, [], "prima del filo non parte niente");
  apri();
  await avviata;
  assert.equal(allaPagina[0].type, "auth_ok");
  assert.deepEqual(allaCasa, [SPEGNI], "e poi parte, com'era");
  /* Quelli dopo passano dritti. */
  cucitura._dallaPagina(JSON.stringify({ ...SPEGNI, id: 42 }));
  assert.equal(allaCasa.at(-1).id, 42);
});

test("prima del filo se ne tengono pochi: una raffica chiude come sempre", async () => {
  const { cucitura, chiusure } = preparati();
  void cucitura.avvia();
  await new Promise((fatto) => setImmediate(fatto));
  for (let i = 0; i < 80 && !cucitura.chiusa; i += 1)
    cucitura._dallaPagina(JSON.stringify({ ...SPEGNI, id: i + 1 }));
  assert.equal(cucitura.chiusa, true);
  assert.equal(chiusure[0].codice, 1008);
});
