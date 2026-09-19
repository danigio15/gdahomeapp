/* Le prove di come sta la casa: cosa non risponde, le batterie, il backup.
 *
 * Quello che si prova davvero: che `unavailable` e `unknown` non sono la
 * stessa cosa — contarli insieme vorrebbe dire una spia rossa a ogni riavvio
 * di Home Assistant; che una batteria sparita si conta una volta sola e non
 * due; che cinque entita' di un termostato che se ne va fanno **una riga**,
 * perche' se no il quadro mostra lo stesso guasto cinque volte; che senza
 * registri si risponde lo stesso invece di rispondere vuoto; e che «backup
 * mai riuscito» e «nessuna entita' del backup» arrivano tutt'e due a `null`,
 * che e' una perdita accettabile perche' la risposta all'installatore e' la
 * stessa.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { iNomi, ilBackup, leBatterie, leEntita } from "../src/salute.js";

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
  assert.equal(conto.giu, 2);
});

test("cinque entita' di un dispositivo che se ne va fanno una riga sola", () => {
  /* E' il motivo per cui si raggruppa: un termostato porta giu' la
   * temperatura, l'umidita' e la batteria, e tre righe uguali non sono tre
   * guasti. */
  const registri = {
    dispositivi: [{ id: "d1", name: "Termostato Netatmo", name_by_user: "Termostato soggiorno" }],
    entita: [
      { entity_id: "sensor.term_temperatura", device_id: "d1" },
      { entity_id: "sensor.term_umidita", device_id: "d1" },
      { entity_id: "sensor.term_batteria", device_id: "d1" },
    ],
  };
  const conto = leEntita(
    [
      stato("sensor.term_temperatura", "unavailable"),
      stato("sensor.term_umidita", "unavailable"),
      stato("sensor.term_batteria", "unavailable"),
      stato("light.cucina", "on"),
    ],
    { registri },
  );
  /* Il conto delle entita' resta tre — sono tre — e i dispositivi uno. */
  assert.equal(conto.giu, 3);
  assert.equal(conto.dispositivi, 1);
  /* E il nome e' quello che ha messo chi ci abita, non quello di fabbrica:
   * «Termostato soggiorno» lo trovi, «Termostato Netatmo» ce ne sono tre. */
  assert.deepEqual(conto.nomi, ["Termostato soggiorno"]);
});

test("senza registri si risponde lo stesso, coi nomi delle entita'", () => {
  /* Un Home Assistant che non da' i registri non deve far sparire il
   * riquadro: una riga per entita' e' peggio di una per dispositivo, ed e'
   * molto meglio di niente. */
  const conto = leEntita([
    stato("sensor.pompa_calore", "unavailable"),
    stato("switch.presa_garage", "unavailable", { friendly_name: "Presa del garage" }),
  ]);
  assert.equal(conto.dispositivi, 2);
  /* Chi dichiara `friendly_name` lo usa; chi non lo dichiara da' la coda del
   * suo identificativo, che almeno si legge. */
  assert.deepEqual(conto.nomi, ["pompa calore", "Presa del garage"]);
});

test("solo quelli che non rispondono: di chi funziona non esce nemmeno il nome", () => {
  const registri = {
    dispositivi: [
      { id: "d1", name: "Serratura ingresso" },
      { id: "d2", name: "Telefono di Laura" },
    ],
    entita: [
      { entity_id: "lock.ingresso", device_id: "d1" },
      { entity_id: "device_tracker.laura", device_id: "d2" },
    ],
  };
  const conto = leEntita(
    [stato("lock.ingresso", "unavailable"), stato("device_tracker.laura", "home")],
    { registri },
  );
  assert.deepEqual(conto.nomi, ["Serratura ingresso"]);
  assert.ok(!JSON.stringify(conto).includes("Laura"));
});

test("i nomi sono in ordine: due rapporti uguali non devono sembrare diversi", () => {
  const stati = [
    stato("sensor.zeta", "unavailable"),
    stato("sensor.alfa", "unavailable"),
    stato("sensor.mu", "unavailable"),
  ];
  const una = leEntita(stati);
  const altra = leEntita([...stati].reverse());
  assert.deepEqual(una.nomi, altra.nomi);
  assert.deepEqual(una.nomi, ["alfa", "mu", "zeta"]);
});

test("i nomi hanno un tetto, e quanti sono davvero si sa lo stesso", () => {
  const stati = Array.from({ length: 40 }, (_, i) => stato(`sensor.n${i}`, "unavailable"));
  const conto = leEntita(stati, { quante: 12 });
  assert.equal(conto.giu, 40);
  /* `dispositivi` e' il numero vero, `nomi` quelli che si mandano: e' da
   * questa differenza che la console scrive «e altri ventotto» invece di far
   * credere che siano dodici. */
  assert.equal(conto.dispositivi, 40);
  assert.equal(conto.nomi.length, 12);
});

test("un dispositivo senza nome cade sull'entita', invece di sparire", () => {
  const registri = {
    dispositivi: [{ id: "d1", name: "", name_by_user: null }],
    entita: [{ entity_id: "sensor.uno", device_id: "d1" }],
  };
  const nomi = iNomi(
    [stato("sensor.uno", "unavailable", { friendly_name: "Sonda cantina" })],
    registri,
  );
  assert.deepEqual(nomi, ["Sonda cantina"]);
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
  assert.equal(leEntita(stati).giu, 1);
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
  assert.deepEqual(leEntita(null), { totali: 0, giu: 0, dispositivi: 0, nomi: [] });
  /* Registri storti: non e' un guaio da far cadere, e' un rapporto senza i
   * nomi dei dispositivi. */
  assert.deepEqual(iNomi(null, { dispositivi: "boh", entita: 7 }), []);
  assert.deepEqual(leBatterie(undefined), { scariche: 0, piuBassa: null });
  assert.deepEqual(ilBackup("non un elenco"), { giorniFa: null });
});
