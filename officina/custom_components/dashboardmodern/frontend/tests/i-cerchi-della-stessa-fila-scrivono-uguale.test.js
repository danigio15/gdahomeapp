/* «Perché il locale tecnico sembra avere una dimensione dei caratteri
 * differente rispetto agli altri.»
 *
 * Energia › Giornaliera sul telefono: «0,2 kWh» del locale tecnico grande il
 * doppio di «65,5 kWh» della wallbox accanto. Il foglio dava ai numeri dei
 * carichi 18 punti in un cerchio da 96; non ci stavano mai, e ognuno si
 * stringeva per conto suo. Il nome «LOCALE TECNICO» va su due righe, il suo
 * numero scende fin sul bordo, la corda li' fa zero — e zero era anche la
 * risposta di una pagina chiusa: quel numero non veniva misurato, restava
 * fuori dal conto dei vicini, e si vedeva ai 18 del foglio.
 *
 * Qui si tengono ferme le due regole nuove: la misura la decide il cerchio,
 * mai la lunghezza del testo; e quando un numero fuori misura obbliga a
 * stringere, si stringe tutta la fascia insieme. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  misureDelCarico,
  stessaMisuraPerFascia,
  stringiIlNumero,
} from "../src/sections/energy-flow-section.js";

test("la misura delle scritte viene dal lato del cerchio", () => {
  /* Il cerchio largo del computer tiene le misure di sempre. */
  assert.deepEqual({ ...misureDelCarico(130) }, { numero: 20, nome: 11.5, icona: 26, disegno: 28 });
  /* Il tablet, e il telefono: il numero che prima era 18 e non ci stava. */
  assert.deepEqual({ ...misureDelCarico(104) }, { numero: 16, nome: 10.5, icona: 23, disegno: 23 });
  assert.deepEqual({ ...misureDelCarico(96) }, { numero: 15, nome: 9.5, icona: 21, disegno: 21 });
});

test("un cerchio piu' grande non scrive mai piu' piccolo", () => {
  let prima = misureDelCarico(40);
  for (let lato = 41; lato <= 200; lato += 1) {
    const adesso = misureDelCarico(lato);
    for (const chiave of ["numero", "nome", "icona", "disegno"])
      assert.ok(adesso[chiave] >= prima[chiave], `${chiave} a ${lato}`);
    prima = adesso;
  }
  /* E ai due capi c'e' un pavimento e un tetto: 11 punti si leggono ancora
   * da un metro, 20 sono quelli di sempre sul computer. */
  assert.equal(misureDelCarico(40).numero, 11);
  assert.equal(misureDelCarico(400).numero, 20);
  /* Un lato che non c'e' vale il cerchio largo, non zero. */
  assert.deepEqual(misureDelCarico(0), misureDelCarico(130));
  assert.deepEqual(misureDelCarico(undefined), misureDelCarico(130));
});

/* ── Il palco finto ──────────────────────────────────────────────────────
 *
 * Quello che serve alla misura e niente altro: una vista, i cerchi dentro, e
 * in ogni cerchio un numero con la sua scatola. Le misure sono quelle lette
 * dal browser vero sul telefono da 390: cerchio da 96, scatola del numero
 * larga 60. */
function stile() {
  return {
    valori: {},
    setProperty(nome, valore) {
      this.valori[nome] = valore;
    },
    removeProperty(nome) {
      delete this.valori[nome];
    },
    getPropertyValue(nome) {
      return this.valori[nome] || "";
    },
  };
}

function cerchio(vista, { carico = true, sotto = 30, largo = 50, testo = "65,5 kWh" } = {}) {
  const bolla = {
    offsetWidth: 96,
    classList: { contains: (classe) => carico && classe === "n-load" },
    closest: (selettore) => (selettore.includes("view-") ? vista : null),
    querySelector: () => ({ offsetHeight: 10 }),
    getBoundingClientRect: () => ({ top: 0, height: 96, width: 96 }),
  };
  const numero = {
    textContent: testo,
    scrollWidth: largo,
    clientWidth: 60,
    style: stile(),
    closest: (selettore) =>
      selettore === ".node" || (carico && selettore === ".n-load") ? bolla : null,
    /* La riga del numero: «sotto» e' quanto scende sotto il centro. */
    getBoundingClientRect: () => ({ top: 48 + sotto - 16, bottom: 48 + sotto, height: 16 }),
  };
  return numero;
}

const QUINDICI = () => 15;

test("un numero sceso fin sul bordo si misura, non si scambia per una pagina chiusa", () => {
  const vista = {};
  /* Il nome su due righe spinge il numero sotto: la sua riga finisce a 48
   * punti dal centro, dove il cerchio (48 meno il bordo) e' gia' finito. */
  const tecnico = cerchio(vista, { sotto: 48, largo: 46, testo: "0,2 kWh" });
  assert.equal(stringiIlNumero(tecnico, QUINDICI), true);
  /* Prima tornava `false` senza firmarsi e senza dire la sua misura: restava
   * fuori dal conto dei vicini, alla misura piena del foglio. */
  assert.equal(tecnico.__dmMisuraSua, 9.3);
  assert.equal(stringiIlNumero(tecnico, QUINDICI), false, "misurato una volta");
  /* Una pagina chiusa invece resta da guardare: niente scatola, niente
   * firma. */
  const chiusa = cerchio(vista, { sotto: 48 });
  chiusa.clientWidth = 0;
  assert.equal(stringiIlNumero(chiusa, QUINDICI), false);
  assert.equal(chiusa.__dmStretta, undefined);
});

test("la fila dei carichi scrive con una misura sola, e i cerchioni con la loro", () => {
  const vista = {};
  const wallbox = cerchio(vista, { testo: "65,5 kWh", largo: 52 });
  const cucina = cerchio(vista, { testo: "25,7 kWh", largo: 51 });
  const tecnico = cerchio(vista, { testo: "0,2 kWh", sotto: 48, largo: 46 });
  const solare = cerchio(vista, { carico: false, testo: "4,20 kW", largo: 53 });
  const rete = cerchio(vista, { carico: false, testo: "0 W", largo: 23 });
  const nodi = [wallbox, cucina, tecnico, solare, rete];
  for (const nodo of nodi) stringiIlNumero(nodo, QUINDICI);
  stessaMisuraPerFascia(nodi);
  const misura = (nodo) => nodo.style.getPropertyValue("font-size") || "15px";
  /* Nessun carico da solo: se uno deve stringere, stringono tutti. */
  assert.deepEqual(new Set([wallbox, cucina, tecnico].map(misura)), new Set(["9.3px"]));
  /* I cerchioni sono un'altra fascia: «0 W» accanto a «4,20 kW» si scrive
   * uguale, e i carichi sotto non li tirano giu'. */
  assert.equal(misura(solare), misura(rete));
  assert.equal(misura(solare), "15px");
});

test("quando ci stanno tutti, nessuno si tocca", () => {
  const vista = {};
  const nodi = [
    cerchio(vista, { testo: "65,5 kWh", largo: 52 }),
    cerchio(vista, { testo: "0,2 kWh", largo: 46 }),
    cerchio(vista, { testo: "3,3 kWh", largo: 45 }),
  ];
  for (const nodo of nodi) assert.equal(stringiIlNumero(nodo, QUINDICI), false);
  assert.equal(stessaMisuraPerFascia(nodi), 0);
  for (const nodo of nodi) assert.equal(nodo.style.getPropertyValue("font-size"), "");
});

test("un numero che cambia cerchio, o nome sopra, si rimisura", () => {
  const vista = {};
  const numero = cerchio(vista, { testo: "0,2 kWh", largo: 46 });
  assert.equal(stringiIlNumero(numero, QUINDICI), false);
  assert.equal(stringiIlNumero(numero, QUINDICI), false);
  /* Lo stesso testo, ma il nome sopra e' passato da una riga a due: il
   * numero e' sceso, e la firma di prima non vale piu'. */
  const bolla = numero.closest(".node");
  bolla.querySelector = () => ({ offsetHeight: 21 });
  numero.getBoundingClientRect = () => ({ top: 80, bottom: 96, height: 16 });
  assert.equal(stringiIlNumero(numero, QUINDICI), true);
});
