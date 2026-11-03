/* Lo storico del clima, messo da parte dalla casa (`storico-del-clima.js`).
 *
 * Quello che deve restare vero: alla prima accensione si recuperano i giorni
 * chiusi che la storia ha ancora, e si scrivono in `/data`; al giro dopo non
 * si richiede niente di gia' scritto; un giorno senza storia si ricorda come
 * vuoto e non si scrive; se la casa non risponde non si segna niente; i
 * giorni troppo vecchi se ne vanno e quelli oltre i sessanta perdono le ore;
 * alla plancia si risponde solo a chi ha un nome, coi giorni chiesti.
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  COMANDO_DELLO_STORICO,
  FILE_DELLO_STORICO,
  GIORNI_DA_RECUPERARE,
  StoricoDelClima,
} from "../src/storico-del-clima.js";
import { Commissioni } from "../src/commissioni.js";
import { CONTO_DEL_RIASSUNTO, chiaveDelGiorno } from "../plancia/src/core/storico-del-clima.js";

const H = 3_600_000;
/* Martedi' 3 novembre 2026, a mezzogiorno, nell'ora della casa. */
const ADESSO = new Date(2026, 10, 3, 12).getTime();
const giornoFa = (n) => new Date(2026, 10, 3 - n).getTime();

const CONFIGURAZIONE = {
  leggi: () => ({
    snapshot: {
      values: {
        cd_clima_units: JSON.stringify([
          { entity: "climate.sala", type: "termo", name: "Sala" },
          { entity: "climate.split", type: "clima", name: "Split" },
        ]),
        cd_caldaia: JSON.stringify({ name: "Caldaia", stato: "switch.caldaia" }),
      },
    },
  }),
};

/* Una casa che ha la storia degli ultimi `tiene` giorni: ogni giorno la sala
 * chiede dalle 6 alle 8 e la caldaia lavora uguale. */
function casaFinta({ tiene = 10, muta = false } = {}) {
  const domande = [];
  const limite = giornoFa(tiene);
  return {
    domande,
    async chiedi(comando) {
      domande.push(comando);
      if (muta) throw new Error("Home Assistant non ha risposto in tempo");
      const [entity] = comando.entity_ids;
      const da = Math.max(Date.parse(comando.start_time), limite);
      const a = Date.parse(comando.end_time);
      const righe = [];
      for (let g = new Date(da).setHours(0, 0, 0, 0); g < a; g += 24 * H) {
        if (g < limite) continue;
        if (entity === "climate.sala") {
          righe.push({
            s: "heat",
            a: { hvac_action: "idle", current_temperature: 18, temperature: 17 },
            lu: g / 1000,
          });
          righe.push({
            s: "heat",
            a: { hvac_action: "heating", current_temperature: 18, temperature: 21 },
            lu: (g + 6 * H) / 1000,
          });
          righe.push({
            s: "heat",
            a: { hvac_action: "idle", current_temperature: 21, temperature: 21 },
            lu: (g + 8 * H) / 1000,
          });
        }
        if (entity === "switch.caldaia") {
          righe.push({ s: "off", a: {}, lu: g / 1000 });
          righe.push({ s: "on", a: {}, lu: (g + 6 * H) / 1000 });
          righe.push({ s: "off", a: {}, lu: (g + 8 * H) / 1000 });
        }
      }
      return { [entity]: righe.filter((r) => r.lu * 1000 >= da && r.lu * 1000 < a) };
    },
  };
}

const nuovo = (opzioni = {}) =>
  new StoricoDelClima({
    cartella: mkdtempSync(join(tmpdir(), "storico-clima-")),
    configurazione: CONFIGURAZIONE,
    adesso: () => ADESSO,
    ogni: () => null,
    fra: () => null,
    ...opzioni,
  });

test("alla prima accensione si recuperano i giorni che la storia ha ancora", async () => {
  const casa = casaFinta({ tiene: 10 });
  const storico = nuovo({ casa });
  assert.equal(storico.giorniDaRiassumere().length, GIORNI_DA_RECUPERARE);
  const esito = await storico.battito();
  assert.equal(esito.scritti, 10, "i dieci giorni chiusi che la storia ha");
  const ieri = storico.giorni[chiaveDelGiorno(giornoFa(1))];
  assert.equal(ieri.caldo.fonte, "storia");
  assert.equal(ieri.caldo.stanze["climate.sala"].r, 120);
  assert.equal(ieri.caldo.generatori["switch.caldaia"].ms, 120);
  assert.equal(ieri.caldo.generatori["switch.caldaia"].acc, 1);
  assert.equal(ieri.freddo, undefined, "lo split non ha storia: il Raffrescamento non c'e'");
  assert.equal(storico.giorni[chiaveDelGiorno(ADESSO)], undefined, "oggi non e' chiuso");
  /* Sul disco, dove sopravvive a un riavvio. */
  const suDisco = JSON.parse(readFileSync(storico.archivio.percorso, "utf8"));
  assert.equal(Object.keys(suDisco.giorni).length, 10);
  assert.ok(storico.archivio.percorso.endsWith(FILE_DELLO_STORICO));
  /* La storia si chiede a pezzi, una domanda per entita' e per pezzo. */
  assert.ok(
    casa.domande.every(
      (d) => d.type === "history/history_during_period" && d.no_attributes === false,
    ),
  );

  /* Al giro dopo non si richiede niente: i dieci ci sono, gli altri venti
   * erano vuoti. */
  const prima = casa.domande.length;
  assert.deepEqual(await storico.battito(), { scritti: 0 });
  assert.equal(casa.domande.length, prima);

  /* Dopo un riavvio i giorni scritti restano, e i vuoti si riprovano. */
  const riacceso = new StoricoDelClima({
    cartella: join(storico.archivio.percorso, ".."),
    configurazione: CONFIGURAZIONE,
    casa,
    adesso: () => ADESSO,
    ogni: () => null,
    fra: () => null,
  });
  assert.equal(Object.keys(riacceso.giorni).length, 10);
  assert.equal(riacceso.giorniDaRiassumere().length, GIORNI_DA_RECUPERARE - 10);
});

test("se la casa non risponde non si segna niente, e al giro dopo si riprova", async () => {
  const storico = nuovo({ casa: casaFinta({ muta: true }) });
  assert.deepEqual(await storico.battito(), { scritti: 0 });
  assert.equal(storico.giorniDaRiassumere().length, GIORNI_DA_RECUPERARE);
});

test("i giorni troppo vecchi se ne vanno, e quelli oltre i sessanta perdono le ore", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "storico-clima-"));
  const vecchio = (o) => ({
    caldo: {
      fonte: "storia",
      stanze: { "climate.sala": { r: 60, o } },
      generatori: {},
      stima: { ms: 60, o },
    },
  });
  writeFileSync(
    join(cartella, FILE_DELLO_STORICO),
    JSON.stringify({
      versione: 1,
      giorni: {
        [chiaveDelGiorno(giornoFa(80))]: vecchio([60]),
        [chiaveDelGiorno(giornoFa(1200))]: vecchio([60]),
      },
    }),
  );
  const storico = new StoricoDelClima({
    cartella,
    configurazione: CONFIGURAZIONE,
    casa: casaFinta({ tiene: 2 }),
    adesso: () => ADESSO,
    ogni: () => null,
    fra: () => null,
  });
  await storico.battito();
  const giorni = storico.giorni;
  assert.equal(giorni[chiaveDelGiorno(giornoFa(1200))], undefined);
  assert.equal(giorni[chiaveDelGiorno(giornoFa(80))].caldo.stanze["climate.sala"].o, null);
  assert.equal(giorni[chiaveDelGiorno(giornoFa(80))].caldo.stanze["climate.sala"].r, 60);
  assert.equal(giorni[chiaveDelGiorno(giornoFa(1))].caldo.stanze["climate.sala"].o.length, 24);
});

test("alla plancia si risponde solo a chi ha un nome, coi giorni chiesti", async () => {
  const storico = nuovo({ casa: casaFinta({ tiene: 5 }) });
  await storico.battito();
  const da = chiaveDelGiorno(giornoFa(3));
  const a = chiaveDelGiorno(giornoFa(2));
  const chiesto = { id: 7, type: COMANDO_DELLO_STORICO, da, a };
  assert.equal(storico.rispondi(chiesto).error.code, "unauthorized");
  const risposta = storico.rispondi(chiesto, { utente: "anna" });
  assert.equal(risposta.success, true);
  assert.deepEqual(Object.keys(risposta.result.giorni).sort(), [da, a]);
  assert.equal(risposta.result.primo, chiaveDelGiorno(giornoFa(5)));
  assert.equal(risposta.result.ultimo, chiaveDelGiorno(giornoFa(1)));
  assert.equal(
    storico.rispondi({ ...chiesto, da: "ieri" }, { utente: "anna" }).error.code,
    "invalid_format",
  );

  /* E passa dalle commissioni del ponte, come la ricarica di notte. */
  const commissioni = new Commissioni({ storicoDelClima: storico });
  const dalPonte = await commissioni.rispondi(chiesto, { chiChiede: "anna" });
  assert.equal(dalPonte.success, true);
  assert.deepEqual(Object.keys(dalPonte.result.giorni).sort(), [da, a]);
});

/* «Continua a non funzionare, i dati storici non mi da il valore.» Uno split
 * che non dice `hvac_action` ma pubblica i suoi watt sul suo dispositivo: il
 * ponte li trova dai registri e mette da parte le ore vere. */
test("lo split senza hvac_action: le ore dai watt del suo dispositivo", async () => {
  const domande = [];
  const casa = {
    async chiedi(comando) {
      domande.push(comando);
      const [entity] = comando.entity_ids;
      const da = Math.max(Date.parse(comando.start_time), giornoFa(2));
      const a = Date.parse(comando.end_time);
      const righe = [];
      for (let g = new Date(da).setHours(0, 0, 0, 0); g < a; g += 24 * H) {
        if (entity === "climate.split") {
          righe.push({ s: "off", a: { current_temperature: 27 }, lu: g / 1000 });
          righe.push({
            s: "cool",
            a: { current_temperature: 27, temperature: 28 },
            lu: (g + 13 * H) / 1000,
          });
          righe.push({ s: "off", a: { current_temperature: 26 }, lu: (g + 19 * H) / 1000 });
        }
        if (entity === "sensor.split_power") {
          righe.push({ s: "4", a: { unit_of_measurement: "W" }, lu: g / 1000 });
          righe.push({ s: "850", a: { unit_of_measurement: "W" }, lu: (g + 14 * H) / 1000 });
          righe.push({ s: "5", a: { unit_of_measurement: "W" }, lu: (g + 17 * H) / 1000 });
        }
      }
      return { [entity]: righe.filter((r) => r.lu * 1000 >= da && r.lu * 1000 < a) };
    },
  };
  const registri = {
    async leMappe() {
      return {
        di: {
          "climate.split": "dev-split",
          "sensor.split_power": "dev-split",
          "sensor.lavatrice_power": "dev-lavatrice",
        },
        nomi: {},
      };
    },
  };
  const STATI = {
    "sensor.split_power": {
      state: "4",
      attributes: { unit_of_measurement: "W", device_class: "power", state_class: "measurement" },
    },
    "sensor.lavatrice_power": {
      state: "0",
      attributes: { unit_of_measurement: "W", device_class: "power", state_class: "measurement" },
    },
  };
  const storico = nuovo({ casa, registri, stati: (id) => STATI[id] || null });
  const esito = await storico.battito();
  assert.equal(esito.scritti, 2);
  const chieste = new Set(domande.map((d) => d.entity_ids[0]));
  assert.ok(chieste.has("sensor.split_power"), "i watt dello split si chiedono");
  assert.ok(!chieste.has("sensor.lavatrice_power"), "quelli di un altro dispositivo no");
  const ieri = storico.giorni[chiaveDelGiorno(giornoFa(1))];
  /* Senza i watt la stanza (27) sotto l'obiettivo (28) non chiederebbe
   * niente; coi watt sono tre ore vere, e si dice da dove vengono. */
  assert.equal(ieri.freddo.stanze["climate.split"].r, 180);
  assert.equal(ieri.freddo.stanze["climate.split"].sv, "dispositivo");
  assert.ok(ieri.freddo.stanze["climate.split"].kwh > 2.5);
});

test("i giorni fatti col conto della 1.18.9.1 si rifanno finche' la storia li ha, gli altri restano", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "storico-clima-"));
  /* L'archivio come lo lasciava la 1.18.9.1: niente `conto`, e per lo
   * split un'ora inventata confrontando la stanza con l'obiettivo. */
  const vecchio = (r) => ({
    caldo: {
      fonte: "storia",
      stanze: {
        "climate.sala": { r, a: r, n: 1440, o: [], t: null, ob: [], v: null, vd: null, s: false },
      },
      generatori: {},
      stima: { ms: r, acc: 1, o: [] },
    },
  });
  writeFileSync(
    join(cartella, FILE_DELLO_STORICO),
    JSON.stringify({
      versione: 1,
      giorni: {
        [chiaveDelGiorno(giornoFa(2))]: vecchio(999),
        /* Questo la storia non l'ha piu': resta com'era. */
        [chiaveDelGiorno(giornoFa(20))]: vecchio(555),
      },
    }),
  );
  const casa = casaFinta({ tiene: 10 });
  const storico = new StoricoDelClima({
    cartella,
    configurazione: CONFIGURAZIONE,
    casa,
    adesso: () => ADESSO,
    ogni: () => null,
    fra: () => null,
  });
  const daFare = storico.giorniDaRiassumere().map((g) => g.chiave);
  assert.ok(daFare.includes(chiaveDelGiorno(giornoFa(2))), "il giorno vecchio si rifa'");
  assert.ok(daFare.includes(chiaveDelGiorno(giornoFa(20))), "anche questo, se la storia l'ha");
  await storico.battito();
  const rifatto = storico.giorni[chiaveDelGiorno(giornoFa(2))];
  assert.equal(rifatto.caldo.stanze["climate.sala"].r, 120, "il conto nuovo");
  assert.equal(rifatto.caldo.conto, CONTO_DEL_RIASSUNTO);
  const rimasto = storico.giorni[chiaveDelGiorno(giornoFa(20))];
  assert.equal(rimasto.caldo.stanze["climate.sala"].r, 555, "senza storia non si butta");
  assert.equal(rimasto.caldo.conto, undefined, "e resta segnato col conto di prima");
  /* Al giro dopo niente da rifare: quello vecchio senza storia non si
   * richiede a ogni ora. */
  const prima = casa.domande.length;
  assert.deepEqual(await storico.battito(), { scritti: 0 });
  assert.equal(casa.domande.length, prima);
});
