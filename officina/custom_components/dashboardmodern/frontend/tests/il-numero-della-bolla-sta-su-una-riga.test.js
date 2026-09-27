/* «Sistema la batteria perché è su due righe, adatta tutto.»
 *
 * Da quando i watt salgono di scala al migliaio la bolla della batteria dice
 * «▲ 5,10 kW». Misurato in un browser vero, a 430 punti di schermo: quel testo
 * ne vuole 64, e il cerchio da 88 ne lascia settanta scarsi al netto del bordo
 * e del margine. Andava a capo — «kW» da solo sotto il numero — e sotto ancora
 * c'era il per cento della carica: tre righe in un cerchio disegnato per una.
 *
 * Gli altri stavano: «6,01 kW» 48 punti, «1,21 kW» 45, «114 W» 34. Il guasto
 * era della batteria perché la sua è l'unica scritta con la freccia davanti —
 * ma la soluzione non è della batteria: domani arriva «1.234,5 kWh» nella
 * vista del mese, o una casa da un megawatt.
 *
 * Qui si tiene fermo il conto — quanto si stringe, e quando non si stringe
 * affatto — con un nodo finto: è una proporzione, e per una proporzione non
 * serve un browser. Che il testo non vada a capo lo dichiara il foglio, e lo
 * controlla la prova in fondo.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  I_NUMERI_DELLE_BOLLE,
  stringiIlNumero,
} from "../src/sections/energy-flow-section.js";

/* Un nodo finto: quello che serve alla misura e niente altro. Le larghezze
 * sono quelle vere lette dal browser sulla pagina Energia a 430 punti. */
function nodo(testo, { largo, spazio }) {
  const stile = {
    valori: {},
    priorita: {},
    setProperty(nome, valore, priorita) {
      this.valori[nome] = valore;
      this.priorita[nome] = priorita || "";
    },
    removeProperty(nome) {
      delete this.valori[nome];
      delete this.priorita[nome];
    },
    get fontSize() {
      return this.valori["font-size"] || "";
    },
    set fontSize(valore) {
      this.valori["font-size"] = valore;
    },
  };
  return { textContent: testo, scrollWidth: largo, clientWidth: spazio, style: stile };
}

const QUINDICI = () => 15;

test("la batteria non va più a capo: il carattere si stringe quel tanto che basta", () => {
  /* I numeri veri: «▲ 5,10 kW» vuole 75 punti dove ce ne sono 70. */
  const batteria = nodo("▲ 5,10 kW", { largo: 75, spazio: 70 });
  assert.equal(stringiIlNumero(batteria, QUINDICI), true);
  /* 70/75 di 15 punti fa 14, arrotondato al decimo per difetto. */
  assert.equal(batteria.style.fontSize, "14px");
  /* E si scrive «important»: il foglio la misura delle bolle la dichiara così
   * («#view-ist .node span { font-size: 15px !important }», per non far
   * esplodere il cerchio), e una riga in linea senza la stessa forza
   * perderebbe. Misurato in un browser vero: la stretta si scriveva e non si
   * vedeva. */
  assert.equal(batteria.style.priorita["font-size"], "important");
});

test("chi ci sta non si tocca", () => {
  for (const [testo, largo] of [
    ["114 W", 34],
    ["1,21 kW", 45],
    ["6,01 kW", 48],
  ]) {
    const bolla = nodo(testo, { largo, spazio: 70 });
    assert.equal(stringiIlNumero(bolla, QUINDICI), false, testo);
    assert.equal(bolla.style.fontSize, "", testo);
  }
  /* Un punto di tolleranza: i mezzi pixel di un'arrotondatura non sono un
   * testo che non ci sta. */
  const giusto = nodo("6,01 kW", { largo: 71, spazio: 70 });
  assert.equal(stringiIlNumero(giusto, QUINDICI), false);
});

test("sotto il 62% non si scende: meglio che sbordi, che illeggibile", () => {
  /* Un testo lunghissimo in un cerchio piccolo: stringere in proporzione
   * darebbe 3 punti, che da un metro non si legge. */
  const esagerato = nodo("1.234.567,8 kWh", { largo: 350, spazio: 70 });
  assert.equal(stringiIlNumero(esagerato, QUINDICI), true);
  assert.equal(esagerato.style.fontSize, "9.3px");
});

test("un numero corto dopo uno lungo torna grande", () => {
  const bolla = nodo("▲ 5,10 kW", { largo: 75, spazio: 70 });
  stringiIlNumero(bolla, QUINDICI);
  assert.equal(bolla.style.fontSize, "14px");
  /* La batteria si ferma: «0 W». Se la misura restasse quella di prima, la
   * bolla resterebbe rimpicciolita per sempre. */
  bolla.textContent = "0 W";
  bolla.scrollWidth = 22;
  assert.equal(stringiIlNumero(bolla, QUINDICI), false);
  assert.equal(bolla.style.fontSize, "");
});

test("si misura solo quando il testo cambia", () => {
  /* Leggere `scrollWidth` costa un calcolo di impaginazione, e questo giro
   * passa su sette bolle a ogni cambio di stato. */
  const bolla = nodo("▲ 5,10 kW", { largo: 75, spazio: 70 });
  assert.equal(stringiIlNumero(bolla, QUINDICI), true);
  assert.equal(stringiIlNumero(bolla, QUINDICI), false);
  assert.equal(stringiIlNumero(bolla, QUINDICI), false);
});

test("quello che non è un numero, o non ha un carattere, si lascia stare", () => {
  assert.equal(stringiIlNumero(null, QUINDICI), false);
  assert.equal(stringiIlNumero(nodo("   ", { largo: 0, spazio: 70 }), QUINDICI), false);
  /* Senza la misura del foglio non c'è niente da cui stringere. */
  const senzaCarattere = nodo("▲ 5,10 kW", { largo: 75, spazio: 70 });
  assert.equal(stringiIlNumero(senzaCarattere, () => 0), false);
  assert.equal(senzaCarattere.style.fontSize, "");
});

test("una pagina non ancora in vista non si dà per guardata", () => {
  /* La plancia disegna anche le pagine chiuse, e una pagina chiusa non ha
   * larghezze: tutto zero. Ricordarsi «questo testo l'ho già guardato»
   * voleva dire non guardarlo mai più — quando la pagina si apre il testo è
   * lo stesso di prima — e la bolla della batteria restava a due righe fino
   * al primo numero nuovo. È il guasto che si vedeva nel browser vero: il
   * testo su una riga sola, ma largo 66 dove ce n'erano 64. */
  const chiusa = nodo("▲ 5,10 kW", { largo: 0, spazio: 0 });
  assert.equal(stringiIlNumero(chiusa, QUINDICI), false);
  /* Aperta la pagina, lo stesso testo si misura e si stringe. */
  chiusa.scrollWidth = 75;
  chiusa.clientWidth = 70;
  assert.equal(stringiIlNumero(chiusa, QUINDICI), true);
  assert.equal(chiusa.style.fontSize, "14px");
});

test("il foglio dichiara che a capo non si va, e fuori dal cerchio non si esce", () => {
  /* Le due cose vanno insieme: senza `nowrap` la misura non direbbe mai che
   * il testo è più largo — andrebbe a capo e sarebbe largo abbastanza — e
   * senza la misura il `nowrap` da solo lo farebbe uscire dal cerchio. */
  const foglio = readFileSync(
    new URL("../legacy/dashboard-runtime.css", import.meta.url),
    "utf8",
  );
  const regola = foglio.slice(foglio.indexOf("#page-energy .node span"));
  assert.match(regola, /white-space:\s*nowrap/);
  assert.match(regola, /max-width:\s*100%/);
  /* Lo stesso insieme di nodi che misura il modulo: due elenchi diversi
   * vorrebbero dire una bolla dichiarata su una riga e mai misurata. */
  assert.ok(I_NUMERI_DELLE_BOLLE.includes("#page-energy .node span"));
  assert.ok(I_NUMERI_DELLE_BOLLE.includes("#page-energy .dm-flow-value"));
  assert.ok(regola.includes(".dm-flow-value"));

  /* E sta nel foglio che leggono tutt'e due le lingue, non in quello
   * italiano: una regola sola, non una copia da tenere allineata. */
  const italiano = readFileSync(
    new URL("../legacy/dashboard-runtime-it.css", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(italiano, /#page-energy \.node span/);
});
