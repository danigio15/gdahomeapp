/* Riaprire l'app e trovare il pallino rosso.
 *
 * «Con l'ultimo aggiornamento quando riapro l'app resta il puntino rosso, devo
 * fare refresh della plancia.» Il pallino in cima, accanto al nome della casa,
 * e' verde quando la presa del runtime ha avuto `auth_ok` e rosso quando si e'
 * chiusa. Dentro l'app la presa va al servitore del telefono, che la cuce sul
 * filo con la casa (`app/lib/plancia/cucitura.dart`): `auth_ok` arriva solo
 * quando quel filo c'e'.
 *
 * Qui gira la sezione vera, con un documento finto, un orologio finto e un
 * runtime finto che fa quello che fa il guscio: apre una presa, accende il
 * pallino a `auth_ok`, lo spegne alla chiusura. Si prova quello che succede
 * dopo una sospensione, nell'ordine in cui succede su un telefono.
 *
 * File a parte, e non dentro `connection-recovery.test.js`: la sezione si
 * installa da sola quando trova il documento, e il documento qui c'e' da
 * prima dell'import. */
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

/** Fa passare [ms] millisecondi, eseguendo i timer nell'ordine in cui scadono. */
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
    add: (nome) => classes(nome, true),
    remove: (nome) => classes(nome, false),
    contains: (nome) => classi.has(nome),
  },
};
function classes(nome, accesa) {
  if (accesa) classi.add(nome);
  else classi.delete(nome);
}
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

/* ─── Il runtime ─────────────────────────────────────────────────────────── */

const prese = [];
class PresaFinta {
  constructor() {
    this.readyState = 0;
    this.mandati = [];
    prese.push(this);
  }
  send(testo) {
    this.mandati.push(JSON.parse(testo));
  }
  close() {
    this.readyState = 3;
  }
  /* Il servitore del telefono ha accettato la presa. */
  apri() {
    this.readyState = 1;
    return this;
  }
  /* La cucitura ha trovato il filo: `auth_ok`. */
  entra() {
    this.apri();
    this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
    return this;
  }
  /* Dall'altra parte qualcosa risponde. */
  risponde(cosa) {
    this.onmessage?.({ data: JSON.stringify(cosa) });
  }
  /* La presa si chiude, come la chiude la cucitura quando cade il filo. */
  cade() {
    this.readyState = 3;
    this.onclose?.({ code: 1001 });
  }
}

/* Come il guscio: `connect()` e' una dichiarazione globale, apre una presa,
 * accende il pallino a `auth_ok` e alla chiusura lo spegne e riprova fra
 * cinque secondi. */
function connect() {
  const presa = new PresaFinta();
  globalThis.ws = presa;
  presa.onmessage = (evento) => {
    const detto = JSON.parse(evento.data);
    if (detto.type === "auth_ok") pallino.classList.add("connected");
  };
  presa.onclose = () => {
    pallino.classList.remove("connected");
    globalThis.setTimeout(globalThis.connect, 5000);
  };
}
globalThis.connect = connect;
connect(); // l'avvio del guscio, prima delle sezioni
prese[0].entra();

const recupero = await import("../src/sections/connection-recovery-section.js");
const { EVENTO_DEL_FILO, FILO_GRACE_MS, PROBE_TIMEOUT_MS, STALE_OPEN_MS } = recupero;

const ultima = () => prese.at(-1);
const verde = () => classi.has("connected");

test.after(() => {
  Date.now = veroDateNow;
});

test("dopo una caduta, una presa aperta e muta non tiene il pallino rosso per sempre", () => {
  assert.equal(verde(), true);
  // L'app torna davanti: il filo si rifa', e la cucitura chiude la presa.
  prese[0].cade();
  assert.equal(verde(), false);
  passano(2000);
  const muta = ultima();
  assert.notEqual(muta, prese[0], "si riprova");
  // La presa si apre verso il servitore, ma dall'altra parte la cucitura non
  // c'e' piu' (il telefono sospeso si e' ripreso la sua presa): niente
  // `auth_ok`, e nessuna chiusura.
  muta.apri();
  const quante = prese.length;
  passano(STALE_OPEN_MS + 35_000);
  assert.ok(prese.length > quante, "una presa muta si cambia");
  assert.equal(muta.__dmSuperseded, true);
  ultima().entra();
  assert.equal(verde(), true, "e il pallino torna verde senza ricaricare");
  passano(60_000);
});

test("quando l'app dice che il filo c'e', la plancia si ricollega subito", () => {
  assert.equal(verde(), true);
  ultima().cade();
  assert.equal(verde(), false);
  const quante = prese.length;
  // Il filo e' tornato: l'app lo dice alla pagina (`plancia_vera.dart`).
  succede(EVENTO_DEL_FILO);
  assert.equal(prese.length, quante + 1, "subito, senza aspettare il turno");
  ultima().entra();
  assert.equal(verde(), true);
  // E una presa aperta che non dice `auth_ok` nemmeno col filo pronto si
  // cambia dopo un attimo, invece di aspettare la scadenza lunga.
  ultima().cade();
  passano(2000);
  const muta = ultima().apri();
  const dopo = prese.length;
  succede(EVENTO_DEL_FILO);
  passano(FILO_GRACE_MS + 10);
  assert.equal(prese.length, dopo + 1);
  assert.equal(muta.__dmSuperseded, true);
  ultima().entra();
  assert.equal(verde(), true);
  passano(60_000);
});

test("una caduta fa ripartire l'attesa da capo, anche con la scala gia' lunga", () => {
  assert.equal(verde(), true);
  ultima().cade();
  // Un giro di tentativi andati a vuoto: la scala sale a 4, 8, 16, 30 s.
  for (let giro = 0; giro < 5; giro += 1) {
    passano(30_000);
    const presa = ultima();
    if (presa.readyState === 0) presa.cade();
  }
  // Poi la casa torna: si entra, e il timer della scala resta armato.
  passano(30_000);
  ultima().entra();
  assert.equal(verde(), true);
  // E il filo si rifa' un'altra volta subito dopo (la strada di casa,
  // l'orologio che chiede lo stato): la presa si chiude di nuovo.
  passano(500);
  ultima().cade();
  const quante = prese.length;
  // Due tentativi restano ad almeno quattro secondi l'uno dall'altro
  // (`MIN_GAP_MS`): in pochi secondi, non al prossimo gradino della scala.
  passano(6500);
  assert.equal(prese.length, quante + 1, "in pochi secondi, non dopo trenta");
  ultima().entra();
  passano(60_000);
});

test("al rientro una presa che sembra collegata si prova, e se non risponde si rifa'", () => {
  assert.equal(verde(), true);
  const viva = ultima();
  succede("doc:visibilitychange");
  const ping = viva.mandati.find((uno) => uno.type === "ping");
  assert.ok(ping, "si manda un ping");
  // Viva: risponde, e non si tocca niente.
  viva.risponde({ id: ping.id, type: "pong" });
  const quante = prese.length;
  passano(PROBE_TIMEOUT_MS + 1000);
  assert.equal(prese.length, quante);
  assert.equal(verde(), true);

  // Morta: non risponde. Il pallino si spegne e la presa si rifa'.
  succede(EVENTO_DEL_FILO);
  assert.ok(viva.mandati.filter((uno) => uno.type === "ping").length >= 2);
  passano(PROBE_TIMEOUT_MS + 10);
  assert.equal(verde(), false, "il pallino dice com'e' davvero");
  assert.equal(prese.length, quante + 1);
  assert.equal(viva.__dmSuperseded, true);
  ultima().entra();
  assert.equal(verde(), true);
});
