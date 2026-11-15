/* La plancia che si ricollega a raffica.
 *
 * «Con questi ultimi aggiornamenti c'e' qualche rallentamento dell'add-on? Il
 * processore sta alto e le entita' rispondono dopo tempo.» Un tablet a muro
 * sempre acceso, e piu' telefoni. Ogni presa nuova della plancia, al suo
 * `auth_ok`, rifa' un avvio intero: i quattro registri, `get_states` completo
 * e la sottoscrizione agli stati. Dalla 1.19.3 la sezione che la ricollega
 * (`connection-recovery-section.js`) cambiava:
 *
 *  - una presa aperta e muta ogni venticinque secondi, per sempre: in mezz'ora
 *    61 prese (la 1.19.2: una);
 *  - una presa collegata a ogni `ping` che non tornava in otto secondi: con
 *    una casa lenta e la pagina che prende il fuoco ogni mezzo minuto, 60
 *    avvii interi in mezz'ora (la 1.19.2: uno).
 *
 * Qui gira la sezione vera, con un orologio finto e un runtime finto che fa
 * quello che fa il guscio. Si conta. E si guarda che quello per cui quelle
 * regole sono nate resti: una presa morta si cambia ancora (lo prova anche
 * `connection-recovery-ripresa.test.js`). */
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
function succede(tipo, evento = {}) {
  for (const fn of ascolti.get(tipo) || []) fn({ type: tipo, ...evento });
}
const ascolta = (tipo, fn) => {
  if (!ascolti.has(tipo)) ascolti.set(tipo, []);
  ascolti.get(tipo).push(fn);
};
globalThis.document = {
  readyState: "complete",
  visibilityState: "visible",
  getElementById: (id) => (id === "live-dot" ? pallino : null),
  addEventListener: (tipo, fn) => ascolta(`doc:${tipo}`, fn),
};
globalThis.addEventListener = (tipo, fn) => ascolta(tipo, fn);
globalThis.WebSocket = { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 };

/* ─── Dall'altra parte ───────────────────────────────────────────────────── */

/* Come risponde la casa: quanto ci mette a dire `auth_ok` (Infinity: mai) e
 * a rimandare il `pong`. Lo cambia ogni prova. */
const casa = { authMs: 100, pongMs: 50 };
const prese = [];
/* Gli avvii interi: ognuno e' un `get_states` e una sottoscrizione. */
let avvii = 0;
class PresaFinta {
  constructor() {
    this.readyState = 0;
    this.ping = 0;
    prese.push(this);
    setTimeout(() => {
      if (this.readyState !== 0) return;
      this.readyState = 1;
      if (Number.isFinite(casa.authMs))
        setTimeout(() => {
          if (this.readyState === 1) this.onmessage?.({ data: '{"type":"auth_ok"}' });
        }, casa.authMs);
    }, 200);
  }
  send(testo) {
    const detto = JSON.parse(testo);
    if (detto.type !== "ping") return;
    this.ping += 1;
    setTimeout(() => {
      if (this.readyState === 1)
        this.onmessage?.({ data: JSON.stringify({ id: detto.id, type: "pong" }) });
    }, casa.pongMs);
  }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    setTimeout(() => this.onclose?.({ code: 1000 }), 0);
  }
  /* Uno `state_changed`, o qualunque altra cosa che la casa manda. */
  parla() {
    this.onmessage?.({ data: '{"type":"event"}' });
  }
}

globalThis.msgId = 1;
function connect() {
  const presa = new PresaFinta();
  globalThis.ws = presa;
  presa.onmessage = (evento) => {
    const detto = JSON.parse(evento.data);
    if (detto.type === "auth_ok") {
      pallino.classList.add("connected");
      avvii += 1;
      globalThis.msgId += 2;
    }
  };
  presa.onclose = () => {
    pallino.classList.remove("connected");
    globalThis.setTimeout(globalThis.connect, 5000);
  };
}
globalThis.connect = connect;
connect();

const recupero = await import("../src/sections/connection-recovery-section.js");
const {
  attesaDellaMuta,
  PROBE_TIMEOUT_MS,
  STALE_OPEN_MAX_MS,
  STALE_OPEN_MS,
  PROBE_MIN_GAP_MS,
} = recupero;

const ultima = () => prese.at(-1);
const verde = () => classi.has("connected");
const MEZZ_ORA = 30 * 60 * 1000;

test.after(() => {
  Date.now = veroDateNow;
});

test("l'attesa di una presa muta raddoppia, fino a cinque minuti", () => {
  assert.equal(attesaDellaMuta(0), STALE_OPEN_MS);
  assert.equal(attesaDellaMuta(1), 2 * STALE_OPEN_MS);
  assert.equal(attesaDellaMuta(2), 4 * STALE_OPEN_MS);
  assert.equal(attesaDellaMuta(40), STALE_OPEN_MAX_MS);
});

test("una casa che non dice mai auth_ok: poche prese, non due al minuto", () => {
  passano(1000);
  assert.equal(verde(), true, "si parte collegati");
  casa.authMs = Infinity;
  ultima().close();
  const prima = prese.length;
  passano(MEZZ_ORA);
  const nuove = prese.length - prima;
  /* La 1.19.4.1: 61 in mezz'ora. Qui 25, 50, 100, 200 secondi e poi ogni
   * cinque minuti. */
  assert.ok(nuove >= 3, `si riprova ancora (${nuove})`);
  assert.ok(nuove <= 12, `ma senza raffica: ${nuove} prese in mezz'ora`);
  assert.equal(prese.filter((una) => una.readyState !== 3).length, 1, "una presa alla volta");

  /* La casa torna: alla prima presa che entra, l'attesa riparte da capo. */
  casa.authMs = 100;
  passano(STALE_OPEN_MAX_MS + 5000);
  assert.equal(verde(), true, "e la plancia rientra da sola");
  casa.authMs = Infinity;
  ultima().close();
  const dopo = prese.length;
  passano(2000 + 200 + STALE_OPEN_MS + 30_000);
  assert.ok(prese.length >= dopo + 2, "la prima muta si cambia di nuovo dopo 25 secondi");
  casa.authMs = 100;
  passano(STALE_OPEN_MAX_MS + 5000);
  assert.equal(verde(), true);
});

test("una casa lenta e il fuoco ogni mezzo minuto: niente avvio intero a ogni ping", () => {
  assert.equal(verde(), true);
  /* La casa e' carica: il `pong` torna in nove secondi, e intanto non arriva
   * nient'altro. */
  casa.pongMs = 9000;
  const prima = avvii;
  for (let t = 0; t < MEZZ_ORA; t += 30_000) {
    passano(30_000);
    succede("focus");
    succede("pageshow");
  }
  const rifatti = avvii - prima;
  /* La 1.19.4.1: 60 avvii in mezz'ora, uno a ogni `ping`. */
  assert.ok(rifatti <= 5, `${rifatti} avvii interi in mezz'ora`);
  assert.equal(verde(), true);
  casa.pongMs = 50;
  passano(60_000);
});

test("una presa che ha appena parlato non si prova, e i ping non si accavallano", () => {
  assert.equal(verde(), true);
  passano(PROBE_MIN_GAP_MS);
  const presa = ultima();
  const ping = presa.ping;
  presa.parla();
  succede("focus");
  assert.equal(presa.ping, ping, "ha appena parlato: e' viva");
  passano(10_000);
  succede("focus");
  assert.equal(presa.ping, ping + 1, "zitta da dieci secondi: si prova");
  passano(1000);
  succede("pageshow");
  succede("focus");
  assert.equal(presa.ping, ping + 1, "un ping ogni trenta secondi al piu'");
  passano(60_000);
});

test("una presa morta si cambia ancora, e alla prima prova", () => {
  assert.equal(verde(), true);
  passano(PROBE_MIN_GAP_MS);
  const morta = ultima();
  casa.pongMs = Infinity;
  const quante = prese.length;
  succede("focus");
  assert.equal(morta.ping >= 1, true);
  passano(PROBE_TIMEOUT_MS + 10);
  assert.equal(morta.__dmSuperseded, true, "data per morta dopo l'attesa di sempre");
  assert.equal(prese.length, quante + 1);
  casa.pongMs = 50;
  passano(5000);
  assert.equal(verde(), true);
});
