/* «Casa 3D»: le scritte dei dispositivi non si coprono piu'.
 *
 * «Le scritte dei dispositivi nella Casa 3D sono troppe e si sovrappongono.»
 * Quando due scritte si toccano sullo schermo resta piena quella piu' vicina
 * alla telecamera, l'altra diventa un pallino; il tasto «Nomi» sceglie fra
 * tutte, solo quelle dei dispositivi accesi, e nessuna. Qui si prova la
 * regola, che e' aritmetica sui rettangoli dello schermo.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CHIAVE_NOMI_CASA3D,
  LATO_DEL_PALLINO,
  MODI_DEI_NOMI,
  NOMI_DI_SERIE,
  STACCO,
  chiPrendeLaScritta,
  modoDeiNomi,
  modoDopo,
} from "../src/core/le-scritte-della-casa-3d.js";

/* Una scritta di 80×22 appoggiata in (x, y), lontana `distanza`. */
const voce = (x, y, distanza, altro = {}) => ({ x, y, w: 80, h: 22, distanza, ...altro });

/* I rettangoli sullo schermo di quello che esce, pieni e pallini. */
function rettangoli(voci, esiti) {
  return voci.map((v, i) => {
    const e = esiti[i];
    if (e.piena) return { x0: v.x - v.w / 2, x1: v.x + v.w / 2, y0: v.y - v.h, y1: v.y };
    const x = v.x + e.dx;
    const y = v.y + e.dy;
    return {
      x0: x - LATO_DEL_PALLINO / 2,
      x1: x + LATO_DEL_PALLINO / 2,
      y0: y - LATO_DEL_PALLINO,
      y1: y,
    };
  });
}
const siToccano = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

test("la scelta si pulisce, e di serie sono «Tutti»", () => {
  assert.deepEqual([...MODI_DEI_NOMI], ["tutti", "accesi", "nessuno"]);
  assert.equal(NOMI_DI_SERIE, "tutti");
  assert.equal(modoDeiNomi(null), "tutti");
  assert.equal(modoDeiNomi(""), "tutti");
  assert.equal(modoDeiNomi("boh"), "tutti");
  assert.equal(modoDeiNomi(" Accesi "), "accesi");
  assert.equal(modoDeiNomi("nessuno"), "nessuno");
  /* La scelta e' di questo dispositivo: una casella del browser, non del config. */
  assert.match(CHIAVE_NOMI_CASA3D, /^dm_/);
});

test("il tasto gira le tre scelte in tondo", () => {
  assert.equal(modoDopo("tutti"), "accesi");
  assert.equal(modoDopo("accesi"), "nessuno");
  assert.equal(modoDopo("nessuno"), "tutti");
  assert.equal(modoDopo("sporco"), "accesi");
});

test("due scritte lontane restano piene tutte e due", () => {
  const voci = [voce(100, 100, 5), voce(300, 100, 6)];
  const esiti = chiPrendeLaScritta(voci);
  assert.deepEqual(
    esiti.map((e) => e.piena),
    [true, true],
  );
});

test("due scritte che si toccano: resta piena la piu' vicina alla telecamera", () => {
  /* La lontana arriva prima nell'elenco: non conta chi arriva prima, conta
   * chi sta davanti. */
  const voci = [voce(100, 100, 12), voce(130, 108, 4)];
  const esiti = chiPrendeLaScritta(voci);
  assert.equal(esiti[0].piena, false);
  assert.equal(esiti[1].piena, true);
  /* e il pallino non finisce sotto la scritta piena */
  const [a, b] = rettangoli(voci, esiti);
  assert.equal(siToccano(a, b), false);
});

test("tre luci nello stesso punto: una scritta e due pallini, nessuno coperto", () => {
  const voci = [voce(200, 200, 8), voce(200, 200, 7), voce(200, 200, 9)];
  const esiti = chiPrendeLaScritta(voci);
  assert.deepEqual(
    esiti.map((e) => e.piena),
    [false, true, false],
  );
  const r = rettangoli(voci, esiti);
  for (let i = 0; i < r.length; i++)
    for (let j = i + 1; j < r.length; j++)
      assert.equal(siToccano(r[i], r[j]), false, `${i} e ${j}`);
});

test("«Solo accesi»: piene le scritte di chi e' acceso, pallini gli altri", () => {
  const voci = [
    voce(100, 100, 3, { acceso: true }),
    voce(400, 100, 3, { acceso: false }),
    /* un acceso lontano vince su uno spento vicino: e' quello che si vuole leggere */
    voce(700, 100, 20, { acceso: true }),
    voce(720, 104, 2, { acceso: false }),
  ];
  const esiti = chiPrendeLaScritta(voci, { modo: "accesi" });
  assert.deepEqual(
    esiti.map((e) => e.piena),
    [true, false, true, false],
  );
  const r = rettangoli(voci, esiti);
  assert.equal(siToccano(r[2], r[3]), false);
});

test("«Nessuno»: solo pallini, anche da soli sullo schermo", () => {
  const voci = [voce(100, 100, 3, { acceso: true }), voce(500, 300, 3)];
  const esiti = chiPrendeLaScritta(voci, { modo: "nessuno" });
  assert.deepEqual(
    esiti.map((e) => e.piena),
    [false, false],
  );
  /* un pallino che ha posto resta sul suo dispositivo */
  assert.deepEqual(
    esiti.map((e) => [e.dx, e.dy]),
    [
      [0, 0],
      [0, 0],
    ],
  );
});

test("quello scelto mentre si arreda resta pieno anche lontano, e anche con «Nessuno»", () => {
  const voci = [voce(100, 100, 2), voce(110, 100, 30, { primo: true })];
  for (const modo of MODI_DEI_NOMI) {
    const esiti = chiPrendeLaScritta(voci, { modo });
    assert.equal(esiti[1].piena, true, modo);
    assert.equal(esiti[0].piena, false, modo);
  }
});

test("chi grida (un allarme, un movimento) passa davanti a parita' di scelta", () => {
  const voci = [voce(100, 100, 2), voce(110, 100, 15, { priorita: 1 })];
  const esiti = chiPrendeLaScritta(voci);
  assert.equal(esiti[1].piena, true);
  assert.equal(esiti[0].piena, false);
});

test("lo stesso giro da' la stessa risposta: le scritte non ballano", () => {
  const voci = Array.from({ length: 30 }, (_, i) =>
    voce(100 + (i % 6) * 40, 100 + Math.floor(i / 6) * 15, 10),
  );
  const prima = JSON.stringify(chiPrendeLaScritta(voci));
  for (let k = 0; k < 5; k++) assert.equal(JSON.stringify(chiPrendeLaScritta(voci)), prima);
});

test("una casa piena: le scritte piene non si toccano mai fra loro", () => {
  /* Duecento dispositivi sparsi su un palco da tablet, con le distanze a caso
   * ma sempre le stesse. */
  let seme = 7;
  const caso = () => {
    seme = (seme * 16807) % 2147483647;
    return seme / 2147483647;
  };
  const voci = Array.from({ length: 200 }, () => ({
    x: 20 + caso() * 980,
    y: 30 + caso() * 560,
    w: 50 + caso() * 60,
    h: 22,
    distanza: 3 + caso() * 20,
    acceso: caso() > 0.5,
  }));
  const esiti = chiPrendeLaScritta(voci);
  const piene = rettangoli(voci, esiti).filter((_, i) => esiti[i].piena);
  assert.ok(piene.length > 10, `troppo poche: ${piene.length}`);
  for (let i = 0; i < piene.length; i++)
    for (let j = i + 1; j < piene.length; j++)
      assert.equal(siToccano(piene[i], piene[j]), false, `${i} e ${j}`);
  /* E fra una scritta piena e quella che le cede il posto c'e' l'aria. */
  assert.ok(STACCO > 0);
});

test("leggero: mille dispositivi si sistemano in un attimo", () => {
  const voci = Array.from({ length: 1000 }, (_, i) =>
    voce((i * 37) % 1200, (i * 53) % 800, i % 17),
  );
  const da = performance.now();
  for (let k = 0; k < 10; k++) chiPrendeLaScritta(voci);
  const ognuno = (performance.now() - da) / 10;
  /* Un conto con la griglia; il conto a coppie qui sarebbe mezzo milione di
   * paragoni a ogni giro. Il tetto e' largo, per le macchine lente. */
  assert.ok(ognuno < 60, `${ognuno.toFixed(1)} ms per giro`);
});

test("le voci sporche non fanno cadere niente", () => {
  assert.deepEqual(chiPrendeLaScritta(null), []);
  const esiti = chiPrendeLaScritta([{}, { x: "a", y: null, w: -4 }]);
  assert.equal(esiti.length, 2);
  for (const e of esiti) assert.equal(typeof e.piena, "boolean");
});

test("il nome della stanza non si copre: la scritta del dispositivo gli gira intorno", () => {
  /* «SOGGIORNO · accesa · 56 m²» sta li', e una luce ci cade sopra. */
  const stanza = { x0: 150, y0: 60, x1: 330, y1: 110 };
  const voci = [voce(240, 100, 2), voce(600, 100, 2)];
  const esiti = chiPrendeLaScritta(voci, { ostacoli: [stanza] });
  assert.equal(esiti[0].piena, false);
  assert.equal(esiti[1].piena, true);
  const [pallino] = rettangoli(voci, esiti);
  assert.equal(siToccano(pallino, stanza), false);
  /* un ostacolo sporco non conta */
  assert.equal(chiPrendeLaScritta(voci, { ostacoli: [null, { x0: 5 }] })[0].piena, true);
});
