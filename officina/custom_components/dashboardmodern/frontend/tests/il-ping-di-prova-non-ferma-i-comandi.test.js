/* Le luci accese che non si spengono piu', dentro Home Assistant.
 *
 * «Sembra che non vadano piu' i comandi alle luci: le vede accese ma non
 * riesce ne' ad accenderle ne' a spegnerle. Questo da HA; dalla app va.»
 *
 * Dalla 1.19.3 la plancia prova la sua presa con un `ping` al rientro
 * (`connection-recovery-section.js`, `verificaLaPresa`): al `focus`, al
 * `pageshow`, a `dashboardmodern:legacy-ready`. Il `ping` partiva con un
 * numero suo, 1 900 000 000 e qualcosa, fuori dal contatore del runtime
 * (`msgId`). Home Assistant pero' vuole i numeri di una presa sempre in
 * salita, e a ogni messaggio con un numero non piu' grande dell'ultimo
 * risponde `id_reuse` e non fa niente. Dopo quel `ping` ogni `call_service`
 * del runtime — 57, 58, 59 — era «gia' usato»: gli stati continuavano ad
 * arrivare, sulla sottoscrizione fatta prima, e i comandi no.
 *
 * Nell'app non si vedeva: il servitore del telefono rinumera i messaggi
 * (`app/lib/plancia/`). Dentro Home Assistant, servita dall'add-on, no: la
 * cucitura del ponte gira i numeri della pagina com'e' (`ponte/src/cucitura.js`,
 * «Niente rinumerazione»), e la presa e' una presa vera del browser — non il
 * ponte del pannello dell'integrazione, l'unico che la prova saltava.
 *
 * Qui gira la sezione vera contro una Home Assistant finta che applica la
 * stessa regola sui numeri. */
import assert from "node:assert/strict";
import test from "node:test";

/* ─── L'orologio ─────────────────────────────────────────────────────────── */

let adesso = 1_800_000_000_000;
let prossimo = 1;
const timer = new Map();
const veroDateNow = Date.now;
Date.now = () => adesso;
globalThis.setTimeout = (fn, ms = 0, ...args) => {
  const id = prossimo++;
  timer.set(id, { fn, quando: adesso + Math.max(0, Number(ms) || 0), args });
  return id;
};
globalThis.clearTimeout = (id) => {
  timer.delete(id);
};
function passano(ms) {
  const fine = adesso + ms;
  for (;;) {
    let primo = null;
    for (const [id, voce] of timer) {
      if (voce.quando <= fine && (!primo || voce.quando < primo[1].quando)) primo = [id, voce];
    }
    if (!primo) break;
    timer.delete(primo[0]);
    adesso = primo[1].quando;
    primo[1].fn(...primo[1].args);
  }
  adesso = fine;
}

/* ─── Il documento ───────────────────────────────────────────────────────── */

const classi = new Set();
const pallino = {
  classList: {
    add: (nome) => classi.add(nome),
    remove: (nome) => classi.delete(nome),
    contains: (nome) => classi.has(nome),
  },
};
const ascolti = new Map();
function ascolta(tipo, fn) {
  if (!ascolti.has(tipo)) ascolti.set(tipo, []);
  ascolti.get(tipo).push(fn);
}
function succede(tipo, evento = {}) {
  for (const fn of ascolti.get(tipo) || []) fn({ type: tipo, ...evento });
}
globalThis.document = {
  readyState: "complete",
  visibilityState: "visible",
  getElementById: (id) => (id === "live-dot" ? pallino : null),
  addEventListener: (tipo, fn) => ascolta(`doc:${tipo}`, fn),
};
globalThis.addEventListener = (tipo, fn) => ascolta(tipo, fn);
globalThis.WebSocket = { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 };

/* ─── Home Assistant, con la sua regola sui numeri ───────────────────────── */

/* Come `homeassistant/components/websocket_api/connection.py`: un numero che
 * non sale e' «gia' usato», e il messaggio non si esegue. */
const eseguiti = [];
class PresaVersoHomeAssistant {
  constructor() {
    this.readyState = 0;
    this.ultimoId = 0;
    this.risposte = [];
  }
  send(testo) {
    const detto = JSON.parse(testo);
    let risposta;
    if (!(detto.id > this.ultimoId)) {
      risposta = {
        id: detto.id,
        type: "result",
        success: false,
        error: { code: "id_reuse", message: "Identifier values have to increase." },
      };
    } else {
      this.ultimoId = detto.id;
      if (detto.type === "ping") risposta = { id: detto.id, type: "pong" };
      else {
        if (detto.type === "call_service") eseguiti.push(detto);
        risposta = { id: detto.id, type: "result", success: true, result: null };
      }
    }
    this.risposte.push(risposta);
    this.onmessage?.({ data: JSON.stringify(risposta) });
  }
  close() {
    this.readyState = 3;
  }
  /* La cucitura del ponte: il filo e' su, `auth_ok`. */
  entra() {
    this.readyState = 1;
    this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
  }
}

/* ─── Il runtime ─────────────────────────────────────────────────────────── */

/* Come il guscio: `ws` e `msgId` sono suoi, `connect()` apre la presa, e a
 * `auth_ok` chiede gli stati e si iscrive ai cambi. */
globalThis.msgId = 1;
function connect() {
  const presa = new PresaVersoHomeAssistant();
  globalThis.ws = presa;
  presa.onmessage = (evento) => {
    const detto = JSON.parse(evento.data);
    if (detto.type !== "auth_ok") return;
    pallino.classList.add("connected");
    presa.send(JSON.stringify({ id: globalThis.msgId++, type: "get_states" }));
    presa.send(
      JSON.stringify({ id: globalThis.msgId++, type: "subscribe_events", event_type: "state_changed" }),
    );
  };
  presa.onclose = () => {
    pallino.classList.remove("connected");
    globalThis.setTimeout(globalThis.connect, 5000);
  };
}
globalThis.connect = connect;

/* Il tocco su una luce, come lo fa il guscio. */
function toccaLaLuce(entita) {
  globalThis.ws.send(
    JSON.stringify({
      id: globalThis.msgId++,
      type: "call_service",
      domain: "light",
      service: "toggle",
      target: { entity_id: entita },
    }),
  );
  return globalThis.ws.risposte.at(-1);
}

connect();
await import("../src/sections/connection-recovery-section.js");
globalThis.ws.entra();
succede("dashboardmodern:legacy-ready");

test.after(() => {
  Date.now = veroDateNow;
});

test("dopo il ping di prova il tocco su una luce arriva a Home Assistant", () => {
  assert.equal(pallino.classList.contains("connected"), true);
  const presa = globalThis.ws;

  // Chi guarda la plancia dentro Home Assistant ci clicca: `focus`.
  succede("focus");
  succede("doc:visibilitychange");
  passano(100);

  const risposta = toccaLaLuce("light.cucina");
  assert.equal(risposta.success, true, `il comando e' andato: ${JSON.stringify(risposta)}`);
  assert.deepEqual(
    eseguiti.map((uno) => [uno.domain, uno.service, uno.target.entity_id]),
    [["light", "toggle", "light.cucina"]],
  );
  // E il secondo tocco, quello che la rispegne, anche.
  assert.equal(toccaLaLuce("light.cucina").success, true);
  assert.equal(eseguiti.length, 2);
  // Nessun messaggio della presa e' stato rifiutato per il numero.
  assert.equal(
    presa.risposte.filter((uno) => uno.error?.code === "id_reuse").length,
    0,
    "nessun id_reuse",
  );
  passano(60_000);
  assert.equal(globalThis.ws, presa, "la presa buona non si cambia");
});

test("il ping di prova prende il suo numero dal contatore del runtime", () => {
  const presa = globalThis.ws;
  succede("focus");
  const ping = presa.risposte.findLast((uno) => uno.type === "pong");
  assert.ok(ping, "la presa si prova lo stesso, e risponde");
  assert.ok(ping.id < globalThis.msgId, "il numero del ping e' uno del runtime");
  assert.equal(toccaLaLuce("light.sala").success, true);
  passano(60_000);
});
