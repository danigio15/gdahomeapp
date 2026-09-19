/* Le prove di come sta la casa: cosa non risponde, le batterie, il backup.
 *
 * Quello che si prova davvero: che `unavailable` e `unknown` non sono la
 * stessa cosa — contarli insieme vorrebbe dire una spia rossa a ogni riavvio
 * di Home Assistant; che una batteria sparita si conta una volta sola e non
 * due; che cinque entita' di un termostato che se ne va fanno **una riga**,
 * perche' se no il quadro mostra lo stesso guasto cinque volte; che **un
 * dispositivo e' un dispositivo** e non un aiutante o un'automazione; e che «backup
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

/* I registri di una casa qualunque: due dispositivi veri, e basta. Tutto
 * quello che negli stati non compare qui dentro — aiutanti, automazioni,
 * sensori template — un dispositivo non ce l'ha. */
const REGISTRI = {
  dispositivi: [
    { id: "d1", name: "Presa garage" },
    { id: "d2", name: "Sonda cantina" },
  ],
  entita: [
    { entity_id: "sensor.uno", device_id: "d1" },
    { entity_id: "sensor.due", device_id: "d1" },
    { entity_id: "sensor.tre", device_id: "d2" },
    { entity_id: "light.cucina", device_id: "d2" },
  ],
};

test("chi non risponde si conta; chi non ha ancora detto niente no", () => {
  const conto = leEntita(
    [
      stato("light.cucina", "on"),
      stato("sensor.uno", "unavailable"),
      /* `unknown` e' un sensore appena riavviato che aspetta la prima misura:
       * normalissimo, e non e' un dispositivo sparito. */
      stato("sensor.due", "unknown"),
      stato("sensor.tre", "unavailable"),
    ],
    { registri: REGISTRI },
  );
  assert.equal(conto.totali, 4);
  assert.equal(conto.giu, 2);
});

test("un aiutante che non risponde non e' un dispositivo non collegato", () => {
  /* Il guasto, come si vedeva in una casa vera: centottanta «dispositivi non
   * collegati» in una casa che ne ha una quarantina — aiutanti, automazioni,
   * sensori template, roba che un dispositivo non ce l'ha e non lo deve
   * avere. Un numero cosi' non e' impreciso, e' inservibile. */
  const conto = leEntita(
    [
      stato("sensor.uno", "unavailable"),
      stato("input_boolean.avvio_ritardato", "unavailable", {
        friendly_name: "Avvio Ritardato Conteggio Elettrodomestici",
      }),
      stato("automation.elettrodomestici_1", "unavailable", {
        friendly_name: "Automazioni Elettrodomestici 1",
      }),
      stato("sensor.package_elettrodomestici", "unavailable", {
        friendly_name: "Aggiornamento package elettrodomestici",
      }),
    ],
    { registri: REGISTRI },
  );
  assert.equal(conto.dispositivi, 1, "sono finite dentro cose che dispositivi non sono");
  assert.equal(conto.giu, 1);
  assert.deepEqual(conto.nomi, ["Presa garage"]);
  assert.ok(!JSON.stringify(conto).includes("Elettrodomestici"));
});

test("senza i registri non si indovina: non si risponde", () => {
  /* Ripiegare sul nome dell'entita' e' proprio quello che ha prodotto le
   * centottanta righe. Tre `null`, che il quadro disegna «questa casa non lo
   * dice» — grigio, e non fa suonare niente. */
  const conto = leEntita([stato("sensor.uno", "unavailable")]);
  assert.equal(conto.totali, null);
  assert.equal(conto.giu, null);
  assert.equal(conto.dispositivi, null);
  assert.deepEqual(conto.nomi, []);
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

const tanti = (quanti) => ({
  dispositivi: Array.from({ length: quanti }, (_, i) => ({ id: `d${i}`, name: `Sonda ${i}` })),
  entita: Array.from({ length: quanti }, (_, i) => ({
    entity_id: `sensor.n${i}`,
    device_id: `d${i}`,
  })),
});

test("i nomi sono in ordine: due rapporti uguali non devono sembrare diversi", () => {
  const registri = {
    dispositivi: [
      { id: "z", name: "zeta" },
      { id: "a", name: "alfa" },
      { id: "m", name: "mu" },
    ],
    entita: [
      { entity_id: "sensor.zeta", device_id: "z" },
      { entity_id: "sensor.alfa", device_id: "a" },
      { entity_id: "sensor.mu", device_id: "m" },
    ],
  };
  const stati = [
    stato("sensor.zeta", "unavailable"),
    stato("sensor.alfa", "unavailable"),
    stato("sensor.mu", "unavailable"),
  ];
  const una = leEntita(stati, { registri });
  const altra = leEntita([...stati].reverse(), { registri });
  assert.deepEqual(una.nomi, altra.nomi);
  assert.deepEqual(una.nomi, ["alfa", "mu", "zeta"]);
});

test("i nomi hanno un tetto, e quanti sono davvero si sa lo stesso", () => {
  const stati = Array.from({ length: 40 }, (_, i) => stato(`sensor.n${i}`, "unavailable"));
  const conto = leEntita(stati, { quante: 12, registri: tanti(40) });
  assert.equal(conto.giu, 40);
  /* `dispositivi` e' il numero vero, `nomi` quelli che si mandano: e' da
   * questa differenza che la console scrive «e altri ventotto» invece di far
   * credere che siano dodici. */
  assert.equal(conto.dispositivi, 40);
  assert.equal(conto.nomi.length, 12);
});

test("un dispositivo senza nome cade sull'entita', invece di sparire", () => {
  /* Il dispositivo c'e' — sta nel registro — e solo il suo nome e' vuoto: qui
   * il ripiego ci sta, perche' la domanda «e' un dispositivo?» ha gia' avuto
   * risposta si'. */
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
  assert.equal(
    leEntita(stati, {
      registri: {
        dispositivi: [{ id: "d1", name: "Serratura" }],
        entita: [
          { entity_id: "sensor.una", device_id: "d1" },
          { entity_id: "sensor.altra", device_id: "d1" },
        ],
      },
    }).giu,
    1,
  );
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

test("niente stati, niente guai: si risponde «non lo so» invece di cadere", () => {
  /* Senza registri la domanda non si puo' fare, e la risposta e' `null` — non
   * zero. Zero vorrebbe dire «ho guardato e non ce n'e' nessuno», che e' una
   * cosa diversa e non e' vera. */
  assert.deepEqual(leEntita(null), { totali: null, giu: null, dispositivi: null, nomi: [] });
  assert.deepEqual(
    leEntita(null, { registri: REGISTRI }),
    { totali: 0, giu: 0, dispositivi: 0, nomi: [] },
    "coi registri e senza stati la risposta e' zero, non «non lo so»",
  );
  /* Registri storti: non e' un guaio da far cadere, e' un rapporto senza i
   * nomi dei dispositivi. */
  assert.deepEqual(iNomi(null, { dispositivi: "boh", entita: 7 }), []);
  assert.deepEqual(leBatterie(undefined), { scariche: 0, piuBassa: null });
  assert.deepEqual(ilBackup("non un elenco"), { giorniFa: null });
});
