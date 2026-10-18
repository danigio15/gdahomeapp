/* Le soste di ricarica di un viaggio in auto elettrica (`soste.js`).
 *
 * Quello che deve restare vero: un viaggio corto non si ferma; uno lungo si
 * ferma alla colonnina rapida piu' avanti che si raggiunge, mai sotto il 10%,
 * e riparte con l'80%; alla meta si arriva con la carica minima scelta; le
 * colonnine troppo lente o lontane dalla strada non contano; senza colonnine
 * la sosta si dice a chilometro.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  autoPulita,
  calcolaLeSoste,
  chilometriDellaLinea,
  CONSUMO_DI_SERIE,
  MAI_SOTTO,
  minutiDiRicarica,
  puntoAlKm,
  sullaLinea,
} from "../src/soste.js";

/* Da Napoli a Milano, una linea dritta riscalata sugli 788 km di strada. */
const NAPOLI = [14.25, 40.85];
const MILANO = [9.19, 45.46];
const LINEA = Array.from({ length: 41 }, (_v, i) => [
  NAPOLI[0] + ((MILANO[0] - NAPOLI[0]) * i) / 40,
  NAPOLI[1] + ((MILANO[1] - NAPOLI[1]) * i) / 40,
]);
const KM = 788;
const PROGRESSIVI = chilometriDellaLinea(LINEA, KM);

/* Una colonnina al chilometro tale della strada. */
function colonnina(km, kw, nome, scostoKm = 0.3) {
  const [lon, lat] = puntoAlKm(LINEA, PROGRESSIVI, km);
  return { km, scostoKm, kw, nome, operatore: `Operatore ${nome}`, lat, lon };
}

const COLONNINE = [
  colonnina(120, 150, "Prima"),
  colonnina(268, 300, "Area di servizio Ovest"),
  colonnina(280, 50, "Lenta"),
  colonnina(285, 350, "Fuori strada", 5),
  colonnina(528, 350, "Area di servizio Nord"),
  colonnina(700, 150, "Quasi arrivati"),
];

/* La Leapmotor di prova: 70 kWh, 17 kWh ogni 100 km, partenza all'80%. */
const AUTO = { batteria: 80, kwh: 70, consumo: 17, minimaArrivo: 15, kwColonnine: 100 };

test("un viaggio lungo: due soste alle rapide piu' avanti, ripartendo con l'80%", () => {
  const conto = calcolaLeSoste({ kmTotali: KM, auto: AUTO, colonnine: COLONNINE, linea: LINEA });
  assert.equal(conto.soste.length, 2);
  const [prima, seconda] = conto.soste;
  assert.equal(prima.nome, "Area di servizio Ovest");
  assert.equal(prima.operatore, "Operatore Area di servizio Ovest");
  assert.equal(prima.km, 268);
  assert.equal(prima.kw, 300);
  assert.deepEqual([prima.da, prima.a], [15, 80]);
  /* 45,5 kWh a 150 kW (l'auto di cui non si sa la potenza), piu' 4 minuti. */
  assert.equal(prima.min, 22);
  assert.equal(seconda.nome, "Area di servizio Nord");
  assert.equal(seconda.km, 528);
  assert.deepEqual([seconda.da, seconda.a], [17, 80]);
  assert.equal(conto.arrivo, 17);
  assert.equal(conto.ricaricaMin, prima.min + seconda.min);
  for (const sosta of conto.soste) {
    assert.ok(sosta.da >= MAI_SOTTO, "mai sotto il 10% a una colonnina");
    assert.ok(Number.isFinite(sosta.lat) && Number.isFinite(sosta.lon));
  }
});

test("un viaggio corto non si ferma", () => {
  const conto = calcolaLeSoste({
    kmTotali: 41.3,
    auto: { ...AUTO, batteria: 62 },
    colonnine: COLONNINE,
  });
  assert.deepEqual(conto.soste, []);
  assert.equal(conto.arrivo, 52);
  assert.equal(conto.ricaricaMin, 0);
});

test("la carica minima all'arrivo: si arriva con almeno quella", () => {
  for (const minimaArrivo of [10, 15, 20, 30]) {
    const conto = calcolaLeSoste({
      kmTotali: KM,
      auto: { ...AUTO, minimaArrivo },
      colonnine: COLONNINE,
      linea: LINEA,
    });
    assert.ok(conto.arrivo >= minimaArrivo, `${minimaArrivo}%: arriva col ${conto.arrivo}%`);
    for (const sosta of conto.soste) assert.ok(sosta.da >= MAI_SOTTO);
  }
  /* Col 30% alla meta l'ultima sosta non basta piu': se ne aggiunge una. */
  const prudente = calcolaLeSoste({
    kmTotali: KM,
    auto: { ...AUTO, minimaArrivo: 30 },
    colonnine: COLONNINE,
    linea: LINEA,
  });
  assert.equal(prudente.soste.length, 3);
});

test("le colonnine troppo lente o lontane dalla strada non contano", () => {
  /* Da 100 kW: la Lenta (50) e la Fuori strada (5 km) restano fuori. */
  const nomi = (conto) => conto.soste.map((s) => s.nome);
  const da100 = calcolaLeSoste({ kmTotali: KM, auto: AUTO, colonnine: COLONNINE, linea: LINEA });
  assert.ok(!nomi(da100).includes("Lenta"));
  assert.ok(!nomi(da100).includes("Fuori strada"));
  /* Da 50 kW la Lenta, piu' avanti, si raggiunge: e' lei la prima. */
  const da50 = calcolaLeSoste({
    kmTotali: KM,
    auto: { ...AUTO, kwColonnine: 50 },
    colonnine: COLONNINE,
    linea: LINEA,
  });
  assert.equal(nomi(da50)[0], "Lenta");
  assert.ok(da50.soste[0].min > da100.soste[0].min, "a 50 kW ci vuole di piu'");
  /* Da 150 kW quella da 300 resta, la Prima da 150 anche. */
  const da150 = calcolaLeSoste({
    kmTotali: KM,
    auto: { ...AUTO, kwColonnine: 150 },
    colonnine: COLONNINE,
    linea: LINEA,
  });
  assert.equal(nomi(da150)[0], "Area di servizio Ovest");
});

test("mai sotto il 10%: la piu' avanti, ma non oltre", () => {
  /* Con l'80% il 10% cade al km 288: quella al 285 si', quella al 300 no. */
  const conto = calcolaLeSoste({
    kmTotali: 400,
    auto: AUTO,
    colonnine: [colonnina(285, 150, "Al limite"), colonnina(300, 150, "Troppo in la'")],
    linea: LINEA,
  });
  assert.equal(conto.soste[0].nome, "Al limite");
  assert.equal(conto.soste[0].da, 11);
});

test("senza archivio le soste si dicono a chilometro, senza nome", () => {
  const conto = calcolaLeSoste({ kmTotali: KM, auto: AUTO, colonnine: [], linea: LINEA });
  assert.equal(conto.soste.length, 2);
  const [prima, seconda] = conto.soste;
  assert.equal(prima.nome, "");
  assert.equal(prima.kw, 0);
  assert.equal(prima.km, 268);
  assert.equal(prima.da, 15);
  /* Si conta una colonnina della potenza scelta: 45,5 kWh a 100 kW. */
  assert.equal(prima.min, 31);
  assert.equal(seconda.km, 535);
  /* Sulla cartina stanno sulla strada. */
  const dove = sullaLinea(LINEA, PROGRESSIVI, prima.lat, prima.lon);
  assert.ok(dove.scostoKm < 0.1);
  assert.ok(Math.abs(dove.km - 268) < 1);
  assert.ok(conto.arrivo >= 15);
});

test("l'auto si ripulisce: senza carica di partenza niente conti, il resto ha un ripiego", () => {
  assert.equal(autoPulita(null), null);
  assert.equal(autoPulita({ kwh: 70 }), null);
  assert.equal(autoPulita({ batteria: 140 }), null);
  assert.equal(autoPulita({ batteria: "abc" }), null);
  assert.equal(autoPulita({ batteria: true }), null);
  const pulita = autoPulita({
    batteria: "62",
    kwh: -3,
    consumo: 900,
    kwMax: "tanti",
    minimaArrivo: 12,
    kwColonnine: 75,
  });
  assert.deepEqual(pulita, {
    batteria: 62,
    kwh: 70,
    consumo: CONSUMO_DI_SERIE,
    kwMax: null,
    minimaArrivo: 15,
    kwColonnine: 100,
  });
  /* Coi nomi del contratto delle sorelle (GdAAuto), quello che l'auto
   * misura vale piu' di quello che la pagina ha stimato. */
  const misurata = autoPulita({
    batteria: 62,
    kwh: 70,
    consumo: 17,
    capacita_kwh: 67.1,
    consumo_medio_kwh100: 15.8,
  });
  assert.equal(misurata.kwh, 67.1);
  assert.equal(misurata.consumo, 15.8);
  /* Ma un numero che non sta in piedi non vince su niente. */
  const storta = autoPulita({
    batteria: 62,
    kwh: 52,
    consumo: 16,
    capacita_kwh: 1,
    consumo_medio_kwh100: 400,
  });
  assert.equal(storta.kwh, 52);
  assert.equal(storta.consumo, 16);
  assert.equal(calcolaLeSoste({ kmTotali: -5, auto: AUTO }), null);
  assert.equal(calcolaLeSoste({ kmTotali: KM, auto: { batteria: null } }), null);
});

test("la ricarica: la potenza piu' bassa fra colonnina e auto, e lenta oltre l'80%", () => {
  /* 45,5 kWh: a 300 kW con un'auto da 100 kW passano 100 kW. */
  assert.equal(minutiDiRicarica(15, 80, 70, 300, 100), 27 + 4);
  assert.equal(minutiDiRicarica(15, 80, 70, 50), 55 + 4);
  /* Dall'80 al 100 a un terzo della potenza. */
  assert.equal(minutiDiRicarica(80, 100, 70, 150), 17 + 4);
});

test("un'auto che parte scarica si ferma subito, e il conto finisce", () => {
  const conto = calcolaLeSoste({ kmTotali: 300, auto: { ...AUTO, batteria: 5 }, linea: LINEA });
  assert.equal(conto.soste[0].km, 0);
  assert.equal(conto.soste[0].da, 5);
  assert.ok(conto.soste.length <= 3);
  assert.ok(conto.arrivo >= 15);
});
