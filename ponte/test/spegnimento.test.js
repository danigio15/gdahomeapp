/* Le prove dello spegnimento programmato del clima: il conto alla rovescia
 * che sta nel ponte al posto dell'integrazione.
 *
 * Quello che si prova davvero: che una scadenza si scrive sul disco e torna
 * dopo un riavvio; che allo scadere si chiama `homeassistant.turn_off`, che
 * sceglie il dominio da se'; che una scadenza gia' passata al riavvio si
 * esegue subito; che chi spegne a mano si porta via il timer; e che dal
 * filo la plancia riceve le stesse tre risposte dell'integrazione.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Commissioni } from "../src/commissioni.js";
import { MAX_TIMER, Spegnimento } from "../src/spegnimento.js";

const ZITTO = { info() {}, attenzione() {}, errore() {} };

/* Un orologio e dei timer finti: il tempo passa quando lo si dice. */
function banco() {
  let ora = 1_700_000_000_000;
  const appesi = new Map();
  let prossimo = 1;
  const programma = (fra, cosa) => {
    const segno = prossimo++;
    appesi.set(segno, { quando: ora + fra, cosa });
    return segno;
  };
  const annulla = (segno) => appesi.delete(segno);
  const avanza = (ms) => {
    ora += ms;
    for (const [segno, voce] of [...appesi].sort((a, b) => a[1].quando - b[1].quando)) {
      if (voce.quando > ora) continue;
      appesi.delete(segno);
      voce.cosa();
    }
  };
  return { adesso: () => ora, programma, annulla, avanza, appesi };
}

/* Una casa finta: si ricorda i servizi chiamati e consegna gli eventi. */
function casaFinta() {
  const chiamate = [];
  let ascoltatore = null;
  return {
    chiamate,
    async chiedi(comando) {
      chiamate.push(comando);
      return {};
    },
    async ascolta(_tipo, onEvento) {
      ascoltatore = onEvento;
      return async () => {
        ascoltatore = null;
      };
    },
    manda(evento) {
      ascoltatore?.(evento);
    },
    get ascolta_attivo() {
      return Boolean(ascoltatore);
    },
  };
}

function cartellaDiProva() {
  const cartella = mkdtempSync(join(tmpdir(), "spegnimento-"));
  return { cartella, pulisci: () => rmSync(cartella, { recursive: true, force: true }) };
}

test("programma, scade, e spegne con homeassistant.turn_off", async () => {
  const { cartella, pulisci } = cartellaDiProva();
  try {
    const b = banco();
    const casa = casaFinta();
    const timer = new Spegnimento({ casa, cartella, registro: ZITTO, ...b });
    const scadenza = timer.programma("climate.camera", 30);
    assert.equal(scadenza, b.adesso() + 30 * 60_000);
    assert.deepEqual(timer.scadenze(), { "climate.camera": scadenza });
    b.avanza(29 * 60_000);
    assert.equal(casa.chiamate.length, 0);
    b.avanza(60_000);
    await new Promise((ok) => setImmediate(ok));
    assert.deepEqual(casa.chiamate, [
      {
        type: "call_service",
        domain: "homeassistant",
        service: "turn_off",
        service_data: { entity_id: "climate.camera" },
      },
    ]);
    assert.deepEqual(timer.scadenze(), {});
  } finally {
    pulisci();
  }
});

test("la scadenza sta sul disco e torna dopo un riavvio; se e' passata si esegue subito", async () => {
  const { cartella, pulisci } = cartellaDiProva();
  try {
    const b = banco();
    const primaCasa = casaFinta();
    const prima = new Spegnimento({ casa: primaCasa, cartella, registro: ZITTO, ...b });
    const scadenza = prima.programma("switch.stufa", 120);
    prima.chiudi();
    const scritto = JSON.parse(readFileSync(join(cartella, "spegnimenti.json"), "utf8"));
    assert.deepEqual(scritto, { scadenze: { "switch.stufa": scadenza } });

    /* Il riavvio arriva tre ore dopo: la scadenza e' passata mentre l'add-on
     * era spento, e si esegue subito — meglio in ritardo che mai. */
    b.avanza(3 * 60 * 60_000);
    const dopoCasa = casaFinta();
    const dopo = new Spegnimento({ casa: dopoCasa, cartella, registro: ZITTO, ...b });
    dopo.carica();
    b.avanza(0);
    await new Promise((ok) => setImmediate(ok));
    assert.equal(dopoCasa.chiamate.length, 1);
    assert.equal(dopoCasa.chiamate[0].service_data.entity_id, "switch.stufa");
    assert.deepEqual(dopo.scadenze(), {});
  } finally {
    pulisci();
  }
});

test("chi spegne a mano si porta via il timer; unknown e unavailable no", async () => {
  const { cartella, pulisci } = cartellaDiProva();
  try {
    const b = banco();
    const casa = casaFinta();
    const timer = new Spegnimento({ casa, cartella, registro: ZITTO, ...b });
    timer.programma("climate.salone", 60);
    await new Promise((ok) => setImmediate(ok));
    assert.equal(casa.ascolta_attivo, true);
    casa.manda({ data: { entity_id: "climate.salone", new_state: { state: "unavailable" } } });
    assert.deepEqual(Object.keys(timer.scadenze()), ["climate.salone"]);
    casa.manda({ data: { entity_id: "climate.altra", new_state: { state: "off" } } });
    assert.deepEqual(Object.keys(timer.scadenze()), ["climate.salone"]);
    casa.manda({ data: { entity_id: "climate.salone", new_state: { state: "off" } } });
    assert.deepEqual(timer.scadenze(), {});
    /* Senza timer non si sta piu' in ascolto. */
    await new Promise((ok) => setImmediate(ok));
    assert.equal(casa.ascolta_attivo, false);
    b.avanza(2 * 60 * 60_000);
    await new Promise((ok) => setImmediate(ok));
    assert.equal(casa.chiamate.length, 0);
  } finally {
    pulisci();
  }
});

test("zero minuti toglie, i minuti si tengono fra 1 e 720, e il fondo e' cento", () => {
  const { cartella, pulisci } = cartellaDiProva();
  try {
    const b = banco();
    const timer = new Spegnimento({ casa: casaFinta(), cartella, registro: ZITTO, ...b });
    assert.equal(timer.programma("climate.a", 5000) - b.adesso(), 720 * 60_000);
    assert.equal(timer.programma("climate.a", 0), null);
    assert.deepEqual(timer.scadenze(), {});
    for (let i = 0; i < MAX_TIMER; i += 1) timer.programma(`climate.u${i}`, 10 + i);
    assert.equal(Object.keys(timer.scadenze()).length, MAX_TIMER);
    timer.programma("climate.ultima", 10);
    const rimaste = timer.scadenze();
    assert.equal(Object.keys(rimaste).length, MAX_TIMER);
    /* Ha ceduto la piu' lontana: u99, che scadeva fra 109 minuti. */
    assert.equal(rimaste["climate.u99"], undefined);
    assert.ok(rimaste["climate.ultima"]);
  } finally {
    pulisci();
  }
});

test("dal filo: list, set e clear rispondono come l'integrazione", async () => {
  const { cartella, pulisci } = cartellaDiProva();
  try {
    const b = banco();
    const spegnimento = new Spegnimento({ casa: casaFinta(), cartella, registro: ZITTO, ...b });
    const commissioni = new Commissioni({ casa: casaFinta(), registro: ZITTO, spegnimento });
    for (const tipo of [
      "dashboardmodern/clima/timer/list",
      "dashboardmodern/clima/timer/set",
      "dashboardmodern/clima/timer/clear",
    ])
      assert.equal(commissioni.riconosce({ type: tipo }), true);

    const vuoto = await commissioni.rispondi({ id: 1, type: "dashboardmodern/clima/timer/list" });
    assert.deepEqual(vuoto, { id: 1, type: "result", success: true, result: { scadenze: {} } });

    const messo = await commissioni.rispondi({
      id: 2,
      type: "dashboardmodern/clima/timer/set",
      entity_id: "climate.camera",
      minuti: 45,
    });
    assert.equal(messo.success, true);
    assert.equal(messo.result.entity_id, "climate.camera");
    assert.equal(messo.result.scadenza, b.adesso() + 45 * 60_000);

    const elenco = await commissioni.rispondi({ id: 3, type: "dashboardmodern/clima/timer/list" });
    assert.deepEqual(elenco.result.scadenze, { "climate.camera": messo.result.scadenza });

    const storto = await commissioni.rispondi({
      id: 4,
      type: "dashboardmodern/clima/timer/set",
      entity_id: "climate.camera",
      minuti: 9999,
    });
    assert.equal(storto.success, false);
    assert.equal(storto.error.code, "invalid_format");

    const tolto = await commissioni.rispondi({
      id: 5,
      type: "dashboardmodern/clima/timer/clear",
      entity_id: "climate.camera",
    });
    assert.deepEqual(tolto.result, { removed: true });
    assert.deepEqual(spegnimento.scadenze(), {});

    /* Senza il modulo la commissione non si riconosce: va in Home Assistant,
     * come prima. */
    const senza = new Commissioni({ casa: casaFinta(), registro: ZITTO });
    assert.equal(senza.riconosce({ type: "dashboardmodern/clima/timer/list" }), false);
  } finally {
    pulisci();
  }
});
