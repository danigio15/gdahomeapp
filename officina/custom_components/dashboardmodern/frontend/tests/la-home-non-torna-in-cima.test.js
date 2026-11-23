/* «Scorro la Home verso il basso e la pagina torna su da sola: non riesco a
 * scorrere» — tablet Android in orizzontale, dentro l'app.
 *
 * Il guardiano della testata (`weather-in-masthead-section.js`) a ogni stato
 * che arriva controlla la prima fila — il menu, il nome, l'ingranaggio — e se
 * la trova storta la fa rifare spegnendo e riaccendendo la testata. Dentro
 * l'app l'ingranaggio e' spento apposta dal foglio dell'app: non si disegna,
 * quindi e' «largo zero», quindi la fila era storta sempre. A ogni stato la
 * testata spariva per il tempo di una misura, e una Home che scorre di poco
 * tornava in cima sotto il dito.
 *
 * Due cose da difendere: un pezzo che non si disegna non e' una fila storta;
 * e quando la fila si rifa' davvero, la pagina resta dov'era.
 */
import assert from "node:assert/strict";
import test from "node:test";

/* ─── Una pagina finta, con lo scorrimento che si comporta come il browser ── */

const SCHERMO = 1000;
const TESTATA = 230;
const RESTO = 1200;

let testataSpenta = false;
const finestra = { x: 0, y: 0 };
const altezza = () => (testataSpenta ? 0 : TESTATA) + RESTO;
/* Il browser, a ogni misura: lo scorrimento non va oltre il fondo. */
const misura = () => {
  finestra.y = Math.max(0, Math.min(finestra.y, altezza() - SCHERMO));
};

const scorre = {
  get scrollTop() {
    return finestra.y;
  },
  set scrollTop(valore) {
    finestra.y = valore;
    misura();
  },
};

globalThis.document = {
  scrollingElement: scorre,
  body: { scrollTop: 0 },
  querySelector: (sel) => (sel === ".page.active" ? { id: "page-home" } : null),
};
Object.defineProperty(globalThis, "scrollX", { get: () => finestra.x, configurable: true });
Object.defineProperty(globalThis, "scrollY", { get: () => finestra.y, configurable: true });
globalThis.scrollTo = ({ left = 0, top = 0 } = {}) => {
  finestra.x = left;
  finestra.y = top;
  misura();
};

const riquadro = (larga, alta, top = 0) => ({
  width: larga,
  height: alta,
  top,
  bottom: top + alta,
  left: 0,
  right: larga,
});

/* Un pezzo della prima fila: disegnato (con il suo riquadro, anche largo
 * zero) o spento dal foglio (nessun riquadro). */
const pezzo = (r, disegnato = true) => ({
  getBoundingClientRect: () => r,
  getClientRects: () => (disegnato ? [r] : []),
});

function testata({ ingranaggio, sinistra = pezzo(riquadro(300, 60, 20)) } = {}) {
  const stile = new Map();
  return {
    getBoundingClientRect: () => riquadro(1400, TESTATA),
    querySelector: (sel) => (sel.includes(".header-left-wrap") ? sinistra : null),
    querySelectorAll: () => [sinistra, pezzo(riquadro(200, 30, 30)), ingranaggio],
    style: {
      getPropertyValue: (nome) => stile.get(nome)?.[0] || "",
      getPropertyPriority: (nome) => stile.get(nome)?.[1] || "",
      setProperty(nome, valore, peso = "") {
        stile.set(nome, [valore, peso]);
        if (nome === "display") testataSpenta = valore === "none";
      },
      removeProperty(nome) {
        stile.delete(nome);
        if (nome === "display") testataSpenta = false;
      },
    },
    get offsetWidth() {
      misura();
      return testataSpenta ? 0 : 1400;
    },
  };
}

const { primaFilaStorta, rifaiLaFila } =
  await import("../src/sections/weather-in-masthead-section.js");

test("l'ingranaggio spento dall'app non rende storta la fila", () => {
  /* Dentro l'app: `header .dm-editor-entry{display:none!important}`. */
  const spento = pezzo(riquadro(0, 0), false);
  assert.equal(primaFilaStorta(testata({ ingranaggio: spento })), false);
  /* E con la fila a posto il guardiano non tocca la testata. */
  finestra.y = 250;
  assert.equal(rifaiLaFila(testata({ ingranaggio: spento })), false);
  assert.equal(finestra.y, 250);
});

test("il blocco largo zero di Safari e' ancora una fila storta", () => {
  /* Il difetto per cui il guardiano esiste (#228): il blocco c'e', si
   * disegna, ma e' largo zero. Ha un riquadro, e conta. */
  const ingranaggio = pezzo(riquadro(44, 44, 20));
  const largoZero = pezzo(riquadro(0, 60, 20));
  assert.equal(primaFilaStorta(testata({ ingranaggio, sinistra: largoZero })), true);
});

test("rifare la fila non riporta la pagina in cima", () => {
  /* La Home scorre di poco: 430 pixel in tutto. Senza la testata, per il
   * tempo di una misura, ne restano duecento: il browser riporta su. */
  finestra.y = 380;
  const ingranaggio = pezzo(riquadro(44, 44, 20));
  assert.equal(rifaiLaFila(testata({ ingranaggio }), { sempre: true }), true);
  assert.equal(testataSpenta, false);
  assert.equal(finestra.y, 380);
});
