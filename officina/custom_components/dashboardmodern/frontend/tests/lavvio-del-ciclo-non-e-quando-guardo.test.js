/* «I dati ultimo ciclo non vengono indicati o sono errati» (#65).
 *
 * «Ho notato che tutti gli elettrodomestici evidenziano "avvio" solo con l'ora
 *  in cui apro la scheda elettrodomestici: se apro la scheda dopo 10 minuti
 *  che un elettrodomestico e' gia' in funzione mi indica che e' appena
 *  iniziato il ciclo.»
 *
 * Il contatore apriva il ciclo con l'istante in cui vedeva «in funzione» per
 * la prima volta. Quando stava gia' guardando quell'istante E' l'avvio; quando
 * nessuno guardava — browser chiuso, plancia appena aperta — non lo e': e'
 * l'ora in cui si e' cominciato a guardare.
 *
 * Adesso sono tre risposte: la casa lo dice (un interruttore di attivita'),
 * lo si e' visto partire, oppure non si sa — e nell'ultimo caso la scheda
 * scrive «da prima di» e «almeno», invece di far passare una supposizione per
 * una misura. */
import assert from "node:assert/strict";
import test from "node:test";

import { createCycleTracker } from "../src/core/appliance-cycle-tracker.js";
import { formatStartLabel, lastCycleInfo } from "../src/core/appliance-card-view-model.js";

function deposito() {
  const dentro = new Map();
  return {
    getItem: (k) => (dentro.has(k) ? dentro.get(k) : null),
    setItem: (k, v) => dentro.set(k, String(v)),
    removeItem: (k) => dentro.delete(k),
  };
}

const MINUTO = 60 * 1000;

test("visto partire: l'avvio e' quando l'ho visto, e non e' incerto", () => {
  let adesso = Date.parse("2026-09-20T10:00:00Z");
  const cicli = createCycleTracker({ storage: deposito(), now: () => adesso });

  /* Prima lo si guarda spento: il contatore c'era. */
  cicli.update([{ id: "lavatrice", mode: "off", watts: 0 }]);
  adesso += MINUTO;
  cicli.update([{ id: "lavatrice", mode: "running", watts: 2000 }]);

  const attivo = cicli.record("lavatrice").active;
  assert.equal(attivo.startMs, adesso, "e' partita sotto gli occhi: l'avvio e' adesso");
  assert.equal(attivo.avvioIncerto, undefined);
});

test("trovato gia' in funzione: l'avvio si segna come supposizione", () => {
  let adesso = Date.parse("2026-09-20T10:00:00Z");
  const cicli = createCycleTracker({ storage: deposito(), now: () => adesso });

  /* La plancia si apre adesso, e la lavatrice sta gia' andando da dieci
   * minuti: di quei dieci minuti il contatore non sa niente. */
  cicli.update([{ id: "lavatrice", mode: "running", watts: 2000 }]);
  const attivo = cicli.record("lavatrice").active;
  assert.equal(attivo.startMs, adesso);
  assert.equal(attivo.avvioIncerto, true, "e' un «non dopo», e va detto");

  /* E resta detto anche a ciclo chiuso: quella durata e' un «almeno».
   * Si campiona per davvero, un giro ogni pochi minuti come fa la raffica
   * degli stati: un salto di un'ora senza campioni il contatore lo chiude
   * dove ha smesso di guardare, ed e' un'altra regola (#363). */
  for (let giro = 0; giro < 18; giro += 1) {
    adesso += 4 * MINUTO;
    cicli.update([{ id: "lavatrice", mode: "running", watts: 2000 }]);
  }
  adesso += MINUTO;
  cicli.update([{ id: "lavatrice", mode: "off", watts: 0 }]);
  const chiuso = cicli.record("lavatrice").last;
  assert.equal(chiuso.avvioIncerto, true);
  assert.equal(chiuso.durationMinutes, 73);
});

test("se la casa dice da quando, quello vince: niente supposizioni", () => {
  const adesso = Date.parse("2026-09-20T10:00:00Z");
  const cicli = createCycleTracker({ storage: deposito(), now: () => adesso });
  const partita = adesso - 40 * MINUTO;

  cicli.update([{ id: "lavatrice", mode: "running", watts: 2000, iniziatoIl: partita }]);
  const attivo = cicli.record("lavatrice").active;
  assert.equal(attivo.startMs, partita, "l'ora dell'interruttore di attivita'");
  assert.equal(attivo.avvioIncerto, undefined, "la casa lo sa: non c'e' niente da supporre");
});

test("un avvio impossibile non si prende: nel futuro, o di ieri l'altro", () => {
  const adesso = Date.parse("2026-09-20T10:00:00Z");
  const cicli = createCycleTracker({ storage: deposito(), now: () => adesso });

  cicli.update([{ id: "a", mode: "running", watts: 10, iniziatoIl: adesso + MINUTO }]);
  assert.equal(cicli.record("a").active.startMs, adesso, "nessun ciclo comincia domani");

  cicli.update([
    { id: "b", mode: "running", watts: 10, iniziatoIl: adesso - 3 * 24 * 60 * MINUTO },
  ]);
  assert.equal(
    cicli.record("b").active.startMs,
    adesso,
    "un interruttore acceso da tre giorni non e' il ciclo di adesso",
  );
});

test("la scheda lo scrive: «da prima di», e la durata «almeno»", () => {
  const adesso = Date.parse("2026-09-20T12:10:00Z");
  const avvio = Date.parse("2026-09-20T11:00:00Z");

  /* Senza incertezza, la riga di sempre. */
  const certa = formatStartLabel(avvio, adesso, "it");
  assert.match(certa, /^oggi \d{2}:\d{2}$/);
  assert.equal(formatStartLabel(avvio, adesso, "it", true), `da prima di ${certa}`);
  assert.equal(
    formatStartLabel(avvio, adesso, "en", true),
    `from before ${formatStartLabel(avvio, adesso, "en")}`,
  );

  const riassunto = lastCycleInfo(
    {},
    {},
    {
      now: adesso,
      locale: "it",
      running: false,
      record: { last: { startMs: avvio, endMs: adesso, avvioIncerto: true } },
    },
  );
  assert.equal(riassunto.avvioIncerto, true);
  assert.match(riassunto.startLabel, /^da prima di /);
  assert.match(riassunto.durationLabel, /^almeno /);
});
