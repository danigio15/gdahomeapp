/* Le prove di come sta la casa: cosa non risponde, le batterie, il backup.
 *
 * Quello che si prova davvero: che `unavailable` e `unknown` non sono la
 * stessa cosa — contarli insieme vorrebbe dire una spia rossa a ogni riavvio
 * di Home Assistant; che una batteria sparita si conta una volta sola e non
 * due; che le impronte sono stabili e **non riportano indietro il nome**,
 * perche' quello e' tutto il motivo per cui esistono; e che «backup mai
 * riuscito» e «nessuna entita' del backup» arrivano tutt'e due a `null`, che
 * e' una perdita accettabile perche' la risposta all'installatore e' la
 * stessa.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { ilBackup, impronta, leBatterie, leEntita } from "../src/salute.js";

const stato = (entity_id, state, attributes = {}) => ({ entity_id, state, attributes });

const batteria = (entity_id, quanto) =>
  stato(entity_id, String(quanto), { device_class: "battery", unit_of_measurement: "%" });

test("chi non risponde si conta; chi non ha ancora detto niente no", () => {
  const conto = leEntita([
    stato("light.cucina", "on"),
    stato("sensor.uno", "unavailable"),
    /* `unknown` e' un sensore appena riavviato che aspetta la prima misura:
     * normalissimo, e non e' un dispositivo sparito. */
    stato("sensor.due", "unknown"),
    stato("sensor.tre", "unavailable"),
  ]);
  assert.equal(conto.totali, 4);
  assert.equal(conto.sparite, 2);
});

test("l'impronta non riporta indietro il nome, e cambia da casa a casa", () => {
  const nome = "binary_sensor.camera_di_marco_finestra";
  const qui = impronta("sale-di-questa-casa", nome);
  assert.equal(qui.length, 4);
  assert.match(qui, /^[0-9a-f]{4}$/);
  /* Nell'impronta non c'e' niente del nome: e' tutto il punto. */
  assert.ok(!qui.includes("marco"));
  assert.ok(!nome.includes(qui));
  /* E senza il sale la stessa entita' darebbe le stesse quattro cifre in
   * tutte le case del mondo, che si girano in un pomeriggio con un elenco di
   * nomi plausibili. */
  assert.notEqual(qui, impronta("un'altra casa", nome));
});

test("le impronte sono in ordine: due cartoline uguali non devono sembrare diverse", () => {
  const stati = [
    stato("sensor.zeta", "unavailable"),
    stato("sensor.alfa", "unavailable"),
    stato("sensor.mu", "unavailable"),
  ];
  const una = leEntita(stati, { sale: "s" });
  const altra = leEntita([...stati].reverse(), { sale: "s" });
  assert.deepEqual(una.impronte, altra.impronte);
  assert.deepEqual(una.impronte, [...una.impronte].sort());
});

test("le impronte hanno un tetto: quaranta sparite si vedono dal numero", () => {
  const stati = Array.from({ length: 40 }, (_, i) => stato(`sensor.n${i}`, "unavailable"));
  const conto = leEntita(stati, { sale: "s", quante: 12 });
  assert.equal(conto.sparite, 40);
  assert.equal(conto.impronte.length, 12);
});

test("e' una batteria quella che lo dichiara, non quella che si chiama cosi'", () => {
  const conto = leBatterie([
    batteria("sensor.serratura_batteria", 12),
    /* Si chiama «batteria» e misura gradi: e' la temperatura del box
     * batterie del fotovoltaico, e fra le cariche non ci va. */
    stato("sensor.temperatura_batterie", "31", {
      device_class: "temperature",
      unit_of_measurement: "°C",
    }),
    batteria("sensor.sensore_porta_batteria", 87),
  ]);
  assert.equal(conto.scariche, 1);
  assert.equal(conto.piuBassa, 12);
});

test("una batteria sparita non e' una batteria scarica: la conta gia' l'altra spia", () => {
  const stati = [
    { ...batteria("sensor.una", 5), state: "unavailable" },
    batteria("sensor.altra", 90),
  ];
  assert.deepEqual(leBatterie(stati), { scariche: 0, piuBassa: 90 });
  assert.equal(leEntita(stati).sparite, 1);
});

test("nessuna batteria in casa non e' «sono tutte al cento»", () => {
  assert.deepEqual(leBatterie([stato("light.cucina", "on")]), { scariche: 0, piuBassa: null });
});

test("una carica fuori dallo zero-cento non e' una carica", () => {
  const conto = leBatterie([batteria("sensor.matta", 4200), batteria("sensor.buona", 44)]);
  assert.equal(conto.piuBassa, 44);
});

test("il backup: i giorni si contano per difetto, e si tiene il piu' recente", () => {
  const adesso = Date.parse("2026-09-18T09:00:00Z");
  const conto = ilBackup(
    [
      stato("sensor.backup_last_successful_automatic_backup", "2026-09-16T03:00:00Z"),
      stato("sensor.backup_last_attempted_automatic_backup", "2026-09-17T03:00:00Z"),
    ],
    { adesso: () => adesso },
  );
  /* Un giorno e sei ore: e' «ieri», non «l'altro ieri». */
  assert.equal(conto.giorniFa, 1);
});

test("senza entita' del backup, e con un backup mai riuscito, la risposta e' la stessa", () => {
  assert.deepEqual(ilBackup([]), { giorniFa: null });
  assert.deepEqual(ilBackup([stato("sensor.backup_last_successful_automatic_backup", "unknown")]), {
    giorniFa: null,
  });
});

test("niente stati, niente guai: si risponde zero invece di cadere", () => {
  assert.deepEqual(leEntita(null), { totali: 0, sparite: 0, impronte: [] });
  assert.deepEqual(leBatterie(undefined), { scariche: 0, piuBassa: null });
  assert.deepEqual(ilBackup("non un elenco"), { giorniFa: null });
});
