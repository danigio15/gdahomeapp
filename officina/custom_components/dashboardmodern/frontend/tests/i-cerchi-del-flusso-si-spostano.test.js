/* I cerchi del Flusso energetico si spostano (#379).
 *
 * «Vedi come poter spostare le cose anche nei disegni, tipo i cerchi nel
 * Flusso energetico.» Il modello della scena prende le scelte salvate in
 * `cd_disegni` («energia:computer», «energia:telefono») e mette ogni carico
 * dove l'ha lasciato l'utente, con la linea da Casa ridisegnata dal bordo al
 * bordo. Senza scelta e' lo stesso oggetto: il disegno di oggi, pixel per
 * pixel.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CERCHI_PRINCIPALI,
  DISEGNO_DELL_ENERGIA,
  conLePosizioni,
  flowStageModel,
  lineaFraCerchi,
  nodoDelCarico,
} from "../src/core/energy-flow-topology.js";
import { curvaFraCerchi, posizioniPulite } from "../src/core/posizioni-nei-disegni.js";

const CARICHI = [
  { id: "frigo", name: "Frigo", icon: "🧊", power_entity: "sensor.frigo_w", order: 0 },
  { id: "clima", name: "Clima", icon: "❄️", power_entity: "sensor.clima_w", order: 1 },
  { id: "lavatrice", name: "Lavatrice", icon: "🧺", power_entity: "sensor.lava_w", order: 2 },
];
const STATI = {
  "sensor.frigo_w": { state: "90", attributes: { unit_of_measurement: "W" } },
  "sensor.clima_w": { state: "750", attributes: { unit_of_measurement: "W" } },
  "sensor.lava_w": { state: "420", attributes: { unit_of_measurement: "W" } },
};
const modello = () => flowStageModel({ loads: CARICHI, states: STATI });

test("il disegno dell'energia ha un nome e i suoi quattro cerchi", () => {
  assert.equal(DISEGNO_DELL_ENERGIA, "energia");
  assert.deepEqual([...CERCHI_PRINCIPALI], ["solare", "rete", "batteria", "casa"]);
  assert.equal(nodoDelCarico("frigo"), "carico:frigo");
});

test("senza scelta il modello e' lo stesso oggetto, pixel per pixel", () => {
  const m = modello();
  assert.ok(m.nodes.length === 3);
  assert.equal(conLePosizioni(m), m);
  assert.equal(conLePosizioni(m, {}), m);
  assert.equal(conLePosizioni(m, { computer: {}, telefono: {} }), m);
  /* Una scelta solo del telefono non tocca il disegno del computer. */
  const soloTelefono = conLePosizioni(m, { telefono: { "carico:frigo": { x: 30, y: 60 } } });
  for (const [i, node] of soloTelefono.nodes.entries())
    assert.equal(node.desktop, m.nodes[i].desktop);
});

test("un carico spostato sta dove l'ha lasciato, e la sua linea parte dal bordo di Casa", () => {
  const m = modello();
  const misure = { desktop: { larghezza: 1000, altezza: 550 } };
  const spostato = conLePosizioni(m, { computer: { "carico:frigo": { x: 30, y: 60 } } }, misure);
  const frigo = spostato.nodes.find((n) => n.id === "frigo");
  assert.equal(frigo.desktop.left, 30);
  assert.equal(frigo.desktop.top, 60);
  assert.notEqual(frigo.desktop.path, m.nodes.find((n) => n.id === "frigo").desktop.path);
  assert.match(frigo.desktop.path, /^M [\d.-]+ [\d.-]+ C /);
  /* Gli altri restano gli stessi oggetti: le loro linee non si riscrivono. */
  for (const id of ["clima", "lavatrice"])
    assert.equal(
      spostato.nodes.find((n) => n.id === id),
      m.nodes.find((n) => n.id === id),
    );
  /* Il telefono resta com'era. */
  assert.equal(frigo.mobile, m.nodes.find((n) => n.id === "frigo").mobile);
});

test("Casa spostata ridisegna le linee di tutti i carichi, non il loro posto", () => {
  const m = modello();
  const spostato = conLePosizioni(m, { computer: { casa: { x: 40, y: 45 } } });
  for (const node of spostato.nodes) {
    const prima = m.nodes.find((n) => n.id === node.id);
    assert.equal(node.desktop.left, prima.desktop.left);
    assert.equal(node.desktop.top, prima.desktop.top);
    assert.notEqual(node.desktop.path, prima.desktop.path);
  }
});

test("un carico nuovo che cade sopra un cerchio spostato va al posto libero", () => {
  const m = modello();
  const clima = m.nodes.find((n) => n.id === "clima").desktop;
  /* Il frigo messo esattamente dove sta il clima di serie. */
  const spostato = conLePosizioni(
    m,
    { computer: { "carico:frigo": { x: clima.left, y: clima.top } } },
    { desktop: { larghezza: 1000, altezza: 550 } },
  );
  const nuovoClima = spostato.nodes.find((n) => n.id === "clima");
  assert.equal(nuovoClima.nuovo, true);
  assert.ok(
    Math.abs(nuovoClima.desktop.left - clima.left) > 0.5 ||
      Math.abs(nuovoClima.desktop.top - clima.top) > 0.5,
  );
  /* Il frigo, che ha la sua scelta, resta dove l'ha messo l'utente. */
  const frigo = spostato.nodes.find((n) => n.id === "frigo");
  assert.equal(frigo.desktop.left, clima.left);
  assert.equal(frigo.nuovo, undefined);
});

test("la linea fra i cerchi si ferma al bordo vero anche su un palco stirato", () => {
  /* Palco 1000x550 px, disegno 1000x600: le y si stirano. */
  const d = lineaFraCerchi("desktop", { x: 50, y: 50 }, 62, { x: 20, y: 83 }, 45, {
    larghezza: 1000,
    altezza: 550,
  });
  const [x0, y0] = d
    .match(/^M ([\d.-]+) ([\d.-]+)/)
    .slice(1)
    .map(Number);
  /* Il primo punto, riportato in pixel, sta sul bordo di Casa. */
  const px = [x0, (y0 * 550) / 600];
  assert.ok(Math.abs(Math.hypot(px[0] - 500, px[1] - 275) - 62) < 0.6);
});

test("la curva si piega dalla parte di chi la tira, e diritta se non c'e' parte", () => {
  const sopra = curvaFraCerchi([0, 100], 10, [200, 100], 10, { piega: 0.2, verso: [100, 0] });
  const sotto = curvaFraCerchi([0, 100], 10, [200, 100], 10, { piega: 0.2, verso: [100, 200] });
  const yDi = (d) => Number(d.split("C ")[1].split(" ")[1].replace(",", ""));
  assert.ok(yDi(sopra) < 100);
  assert.ok(yDi(sotto) > 100);
  const diritta = curvaFraCerchi([0, 100], 10, [200, 100], 10, { piega: 0.2, verso: [100, 100] });
  assert.equal(yDi(diritta), 100);
  /* La scala porta i punti nelle unita' del disegno. */
  assert.match(curvaFraCerchi([0, 0], 10, [100, 0], 20, { scala: [2, 1] }), /^M 20 0 C /);
});

test("i nomi dei carichi si salvano: «carico:frigo», ma niente di strano", () => {
  assert.deepEqual(
    posizioniPulite({
      "carico:frigo": { x: 30, y: 60 },
      "carico:ev@dm-na": { x: 10, y: 10 },
      "carico:stanza-r1abc": { x: 20, y: 20 },
      batteria: { x: 85, y: 52.5 },
      "<img>": { x: 1, y: 1 },
      ":niente": { x: 1, y: 1 },
      "carico frigo": { x: 1, y: 1 },
    }),
    {
      "carico:frigo": { x: 30, y: 60 },
      "carico:ev@dm-na": { x: 10, y: 10 },
      "carico:stanza-r1abc": { x: 20, y: 20 },
      batteria: { x: 85, y: 52.5 },
    },
  );
});
