/* Il flusso dell'energia, grande, in Home (#460).
 *
 * «Vorrei una card da esporre in primo piano del fotovoltaico e non il
 * semplice widget.» Qui si prova la parte che decide: quali nodi ci sono,
 * quali frecce corrono e in che verso, quanto sono grosse, dove sta ogni nodo
 * e da dove a dove passa una freccia. I numeri sono quelli di `lettureDiCasa`:
 * rete positiva = prelievo, batteria positiva = scarica.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  BLOCCO_DEL_FLUSSO,
  CHIAVE_FLUSSO_IN_HOME,
  SOGLIA_DEL_FLUSSO_W,
  ilFlussoDiCasa,
  ilFlussoSiVede,
  postiDelFlusso,
  sceltaDelFlusso,
  stradaFra,
} from "../src/core/il-flusso-in-home.js";
import { BLOCCHI_DELLA_HOME } from "../src/core/ordine-dei-blocchi.js";
import { CONFIG_KEYS } from "../src/core/chiavi-di-configurazione.js";

const attive = (modello) =>
  modello.archi
    .filter((arco) => arco.attivo)
    .map((arco) => `${arco.da}>${arco.a}`)
    .sort();
const nodo = (modello, k) => modello.nodi.find((voce) => voce.k === k);

test("spento di serie, acceso solo con un «si»; e la scelta viaggia col config", () => {
  assert.equal(ilFlussoSiVede(null), false);
  assert.equal(ilFlussoSiVede(""), false);
  assert.equal(ilFlussoSiVede("no"), false);
  assert.equal(ilFlussoSiVede(true), false);
  assert.equal(ilFlussoSiVede("si"), true);
  assert.equal(ilFlussoSiVede(" SI "), true);
  assert.equal(sceltaDelFlusso(true), "si");
  assert.equal(sceltaDelFlusso(false), null);
  assert.ok(CONFIG_KEYS.includes(CHIAVE_FLUSSO_IN_HOME));
  assert.ok(BLOCCHI_DELLA_HOME.includes(BLOCCO_DEL_FLUSSO));
});

test("mezzogiorno: FV 3,2 kW, casa 1,1 kW, batteria al 64% in carica, rete in immissione", () => {
  /* 3200 = 1100 in casa + 1500 in batteria + 600 alla rete */
  const m = ilFlussoDiCasa({ solare: 3200, rete: -600, batteria: -1500, casa: 1100, soc: 64 });
  assert.equal(m.vuoto, false);
  assert.deepEqual(
    m.nodi.map((n) => n.k),
    ["solare", "rete", "casa", "batteria"],
  );
  assert.deepEqual(attive(m), ["solare>batteria", "solare>casa", "solare>rete"]);
  assert.equal(m.archi.find((a) => a.da === "solare" && a.a === "casa").watt, 1100);
  assert.equal(m.archi.find((a) => a.a === "batteria").watt, 1500);
  assert.equal(m.archi.find((a) => a.a === "rete").watt, 600);
  assert.equal(nodo(m, "batteria").soc, 64);
  assert.equal(nodo(m, "batteria").verso, "carica");
  assert.equal(nodo(m, "rete").verso, "immette");
  assert.equal(nodo(m, "solare").verso, "produce");
  /* Piu' passa, piu' la freccia e' grossa e i puntini corrono. */
  const grossa = m.archi.find((a) => a.a === "batteria");
  const fina = m.archi.find((a) => a.a === "rete");
  assert.ok(grossa.larghezza > fina.larghezza);
  assert.ok(grossa.durata < fina.durata);
});

test("di notte: la rete alimenta la casa e carica la batteria", () => {
  const m = ilFlussoDiCasa({ solare: 0, rete: 2400, batteria: -1800, casa: 600, soc: 20 });
  assert.deepEqual(attive(m), ["rete>batteria", "rete>casa"]);
  assert.equal(nodo(m, "rete").verso, "preleva");
  assert.equal(nodo(m, "solare").verso, "fermo");
});

test("la batteria scarica in casa, e quello che avanza va in rete", () => {
  const m = ilFlussoDiCasa({ solare: 0, rete: -300, batteria: 1000, casa: 700 });
  assert.deepEqual(attive(m), ["batteria>casa", "batteria>rete"]);
  /* rete e batteria hanno una strada sola: qui la percorre la batteria */
  const strada = m.archi.filter((a) => a.id === "batteria-rete");
  assert.equal(strada.length, 1);
  assert.equal(strada[0].da, "batteria");
  assert.equal(nodo(m, "batteria").verso, "scarica");
});

test("i nodi senza sensore non ci sono", () => {
  /* niente batteria e niente auto */
  const m = ilFlussoDiCasa({ solare: 1500, rete: 200, batteria: null, casa: 1700, soc: null });
  assert.deepEqual(
    m.nodi.map((n) => n.k),
    ["solare", "rete", "casa"],
  );
  assert.ok(m.archi.every((a) => a.da !== "batteria" && a.a !== "batteria"));
  /* senza sole: niente sole, e nemmeno le sue frecce */
  const senzaSole = ilFlussoDiCasa({ rete: 500, casa: 500 });
  assert.deepEqual(
    senzaSole.nodi.map((n) => n.k),
    ["rete", "casa"],
  );
  assert.deepEqual(attive(senzaSole), ["rete>casa"]);
  /* la batteria c'e' anche col solo stato di carica */
  assert.ok(nodo(ilFlussoDiCasa({ rete: 100, soc: 80 }), "batteria"));
});

test("senza nessuna sorgente il blocco non ha niente da disegnare", () => {
  assert.equal(ilFlussoDiCasa({}).vuoto, true);
  assert.equal(ilFlussoDiCasa({ casa: 900 }).vuoto, true);
  assert.deepEqual(ilFlussoDiCasa(null).nodi, []);
});

test("l'auto c'e' solo quando il flusso dell'Energia ha la sua wallbox", () => {
  const letture = { solare: 4000, rete: 0, casa: 3600 };
  assert.equal(nodo(ilFlussoDiCasa(letture), "auto"), undefined);
  assert.equal(nodo(ilFlussoDiCasa(letture, { auto: { watt: null } }), "auto"), undefined);
  const m = ilFlussoDiCasa(letture, { auto: { watt: 2300, soc: 55 } });
  assert.equal(nodo(m, "auto").verso, "carica");
  assert.equal(nodo(m, "auto").soc, 55);
  assert.ok(attive(m).includes("casa>auto"));
  /* ferma: la freccia c'e', smorta */
  const ferma = ilFlussoDiCasa(letture, { auto: { watt: 0 } });
  const arco = ferma.archi.find((a) => a.a === "auto");
  assert.equal(arco.attivo, false);
  assert.equal(arco.sempre, true);
});

test("il rumore non accende le frecce, e i raggi verso casa restano smorti", () => {
  const m = ilFlussoDiCasa({ solare: SOGLIA_DEL_FLUSSO_W - 1, rete: 3, batteria: 0, casa: 12 });
  assert.deepEqual(attive(m), []);
  assert.deepEqual(
    m.archi
      .filter((a) => a.sempre)
      .map((a) => a.id)
      .sort(),
    ["batteria-casa", "casa-rete", "casa-solare"],
  );
  assert.ok(m.archi.filter((a) => !a.attivo).every((a) => a.durata === 0));
});

test("i posti: una croce con la casa nel mezzo, e solo le file che servono", () => {
  const tutti = postiDelFlusso([
    { k: "solare" },
    { k: "rete" },
    { k: "casa" },
    { k: "batteria" },
    { k: "auto" },
  ]);
  assert.equal(tutti.file, 3);
  assert.deepEqual(tutti.posti.casa, { x: 50, y: 50 });
  assert.ok(tutti.posti.solare.y < tutti.posti.casa.y);
  assert.ok(tutti.posti.auto.y > tutti.posti.casa.y);
  assert.ok(tutti.posti.rete.x < tutti.posti.casa.x && tutti.posti.batteria.x > tutti.posti.casa.x);
  /* senza sole e senza auto, una fila sola: niente buchi in alto */
  const piatto = postiDelFlusso([{ k: "rete" }, { k: "casa" }]);
  assert.equal(piatto.file, 1);
  assert.equal(piatto.posti.casa.y, 50);
  assert.equal(piatto.posti.solare, undefined);
});

test("le strade partono e arrivano sul bordo dei cerchi, nel verso della freccia", () => {
  const a = { x: 100, y: 100 };
  const b = { x: 100, y: 300 };
  assert.equal(stradaFra(a, b, { r: 20 }), "M 100 120 L 100 280");
  assert.equal(stradaFra(b, a, { r: 20 }), "M 100 280 L 100 120");
  /* dal sole verso la rete: prima in orizzontale */
  const gomito = stradaFra({ x: 300, y: 50 }, { x: 60, y: 200 }, { r: 10, gomito: true });
  assert.match(gomito, /^M 290 50 Q 60 50 60 190$/);
  /* fra rete e batteria l'arco passa sopra */
  const arco = stradaFra({ x: 60, y: 200 }, { x: 540, y: 200 }, { r: 10, arco: true });
  const cy = arco.split(" ")[5];
  assert.ok(Number(cy) < 200);
  /* la casa e' piu' grande: ogni capo il suo raggio */
  assert.equal(stradaFra(a, b, { rDa: 20, rA: 40 }), "M 100 120 L 100 260");
  assert.equal(stradaFra(null, b), "");
});
