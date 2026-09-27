/* «Dispositivo, se lo elimina resta ancora.»
 *
 * Dal tablet, sulla rete vera: tolto un SONOFF SNZB-06P — che la sua stessa
 * scheda dice «fa da ponte per gli altri» — e nell'elenco c'era ancora.
 *
 * Non era un guasto del togliere: era un pezzo mai costruito. L'ordine che
 * parte e' quello garbato, `force: false`, e il commento accanto diceva
 * perche': forzare toglie la riga dalla cassetta senza che l'apparecchio lo
 * sappia, e quello resta appeso a cercare un coordinatore che non gli risponde
 * piu'. «Si forza quando il garbato ha gia' fallito, e allora lo si chiede per
 * iscritto — non di nascosto, al primo tocco.»
 *
 * Quel «per iscritto» non esisteva da nessuna parte: cercato `force` in tutto
 * il ponte e in tutta l'app, l'unica occorrenza era quel commento. Il garbato
 * falliva — un ripetitore a corrente l'ordine di andarsene lo ignora spesso —
 * il ponte lo diceva onestamente, e li' finiva: nessuna strada avanti.
 *
 * Adesso la strada c'e', ed e' una seconda domanda: `perForza`. Qui si tiene
 * fermo che di serie non si forza, che forzando parte l'ordine giusto, e che
 * la risposta dice **se** si puo' insistere — perche' su ZHA non si puo', e un
 * tasto che non fa niente e' un tasto rotto.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { comeSiElimina, leStradePerEliminare } from "../src/zigbee.js";

const Z2M = { quale: "zigbee2mqtt", cassetta: "zigbee2mqtt" };
const ZHA = { quale: "zha", cassetta: "" };
const TARGA = "0x0cae5ffffec141a9";

const ilCorpo = (ordine) => JSON.parse(ordine.service_data.payload);

test("di serie non si forza: l'ordine e' quello garbato", () => {
  const ordine = comeSiElimina(Z2M, TARGA);
  assert.equal(ilCorpo(ordine).force, false);
  assert.equal(ilCorpo(ordine).id, TARGA);
  assert.equal(ordine.service_data.topic, "zigbee2mqtt/bridge/request/device/remove");
});

test("chiedendolo per iscritto, l'ordine porta il forza", () => {
  const ordine = comeSiElimina(Z2M, TARGA, { forza: true });
  assert.equal(ilCorpo(ordine).force, true);
  assert.equal(ilCorpo(ordine).id, TARGA);
});

test("forzando si manda una strada sola, non due", () => {
  /* Il garbato ne prova due — il servizio di ZHA e il messaggio — perche' non
   * si sa quale delle due questa casa capisce. Forzando la differenza sta
   * tutta nel campo `force` del messaggio, e mandare anche l'altra vorrebbe
   * dire rischiare che una risponda «fatto» mentre quella che conta non e'
   * partita. */
  const garbate = leStradePerEliminare(Z2M, TARGA);
  const aForza = leStradePerEliminare(Z2M, TARGA, { forza: true });
  assert.ok(garbate.length >= 1);
  assert.equal(aForza.length, 1);
  assert.equal(ilCorpo(aForza[0]).force, true);
});

test("su ZHA forzare non esiste, e la risposta non lo deve promettere", () => {
  /* `force` e' una cosa di Zigbee2MQTT. Su ZHA il garbato e' gia' tutto
   * quello che c'e', e offrire un tasto che non fa niente sarebbe peggio di
   * non offrirlo. */
  assert.deepEqual(comeSiElimina(ZHA, TARGA), { type: "zha/remove", ieee: TARGA });
  assert.equal(comeSiElimina(ZHA, TARGA, { forza: true }).type, "zha/remove");
  /* E infatti la casa senza cassetta non ha proprio una strada forzata. */
  assert.equal(comeSiElimina({ quale: "zigbee2mqtt", cassetta: "" }, TARGA, { forza: true }), null);
});

test("senza targa non si manda niente, nemmeno forzando", () => {
  assert.equal(comeSiElimina(Z2M, "", { forza: true }), null);
  assert.deepEqual(leStradePerEliminare(Z2M, "", { forza: true }), []);
});
