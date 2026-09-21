/* Il blocco «Come si divide il costo reale», disegnato (#72, seconda metà).
 *
 * Qui si prova la parte del blocco che non tocca niente: entrano il report, la
 * configurazione e il mese, esce il markup. Il giro alla rete — le ore del mese
 * chieste al Recorder — sta nella sezione e si prova nel browser.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ilBloccoDelleFasce,
  nomeDellaFascia,
  orarioDellaFascia,
  tintaDellaFascia,
} from "../src/sections/il-report-a-fasce-section.js";

const TRE = {
  quante: 3,
  voci: [
    { dalle: 480, prezzo: 0.35 },
    { dalle: 1140, prezzo: 0.28 },
    { dalle: 1380, prezzo: 0.2 },
  ],
  festivi: 2,
};

const REPORT = {
  fasce: [
    { indice: 0, dalle: 480, prezzo: 0.35, suo: true, kwh: 18.4, euro: 6.44, quota: 44.7 },
    { indice: 1, dalle: 1140, prezzo: 0.28, suo: true, kwh: 12.1, euro: 3.388, quota: 29.4 },
    { indice: 2, dalle: 1380, prezzo: 0.2, suo: true, kwh: 10.7, euro: 2.14, quota: 25.9 },
  ],
  giorni: [],
  kwh: 41.2,
  euro: 11.968,
  unico: { prezzo: 0.3, euro: 12.36 },
  risparmio: 0.392,
  misurato: { kwh: 38.1, euro: 11 },
  stimato: { kwh: 3.1, euro: 0.88, prezzo: 0.283 },
  tuttoMisurato: false,
};

const SETTEMBRE = { month: 9, year: 2026 };

test("l'ultima fascia arriva alla prima, non a mezzanotte", () => {
  /* È la fascia che attraversa la mezzanotte, e di solito è quella che dura di
   * più: scriverla «23:00–24:00» sarebbe dire il falso proprio su quella. */
  assert.equal(orarioDellaFascia(TRE, 0), "08:00–19:00");
  assert.equal(orarioDellaFascia(TRE, 1), "19:00–23:00");
  assert.equal(orarioDellaFascia(TRE, 2), "23:00–08:00");
  assert.equal(orarioDellaFascia(TRE, 9), "");
});

test("l'azzurro è la fascia che costa meno, con due fasce come con tre", () => {
  /* La scala va dalla più cara alla più economica. Con due fasce si prendono i
   * due estremi invece dei primi due, così «l'azzurro è la notte» vale in tutti
   * e due i casi invece di dipendere da quante sono. */
  assert.equal(tintaDellaFascia(3, 0), "#f97316");
  assert.equal(tintaDellaFascia(3, 2), "#0ea5e9");
  assert.equal(tintaDellaFascia(2, 0), "#f97316");
  assert.equal(tintaDellaFascia(2, 1), "#0ea5e9");
  assert.equal(nomeDellaFascia(0), "F1");
  assert.equal(nomeDellaFascia(2), "F3");
});

test("il blocco dice quanto, di cosa e con che prezzo, fascia per fascia", () => {
  const markup = ilBloccoDelleFasce(REPORT, TRE, SETTEMBRE);
  for (const pezzo of ["F1", "F2", "F3", "08:00–19:00", "23:00–08:00"])
    assert.ok(markup.includes(pezzo), `manca ${pezzo}`);
  /* Le fette della barra sono larghe quanto la loro quota, e colorate come la
   * pastiglia della loro fascia: la barra e la riga devono raccontare la stessa
   * cosa. */
  assert.ok(markup.includes("width:44.70%"));
  assert.ok(markup.includes("background:#f97316"));
  assert.ok(markup.includes("background:#0ea5e9"));
});

test("una fascia senza il suo prezzo lo dichiara", () => {
  /* Altrimenti sembrerebbe una fascia che costa come le altre per scelta,
   * invece di una casella rimasta vuota. */
  const report = {
    ...REPORT,
    fasce: REPORT.fasce.map((fascia, indice) =>
      indice === 1 ? { ...fascia, suo: false, prezzo: 0.3 } : fascia,
    ),
  };
  const markup = ilBloccoDelleFasce(report, TRE, SETTEMBRE);
  assert.equal(markup.match(/dm-fasce-ripiego/g)?.length, 1);
});

test("la fascia dei festivi lo scrive accanto al suo orario", () => {
  assert.ok(ilBloccoDelleFasce(REPORT, TRE, SETTEMBRE).includes("dm-fasce-festivi"));
  const senza = ilBloccoDelleFasce(REPORT, { ...TRE, festivi: -1 }, SETTEMBRE);
  assert.ok(!senza.includes("dm-fasce-festivi"));
});

test("il confronto con la tariffa unica dice da che parte pende", () => {
  const meglio = ilBloccoDelleFasce(REPORT, TRE, SETTEMBRE);
  assert.ok(meglio.includes('data-verso="meglio"'));

  const peggio = ilBloccoDelleFasce({ ...REPORT, risparmio: -0.4 }, TRE, SETTEMBRE);
  assert.ok(peggio.includes('data-verso="peggio"'));

  const pari = ilBloccoDelleFasce({ ...REPORT, risparmio: 0.001 }, TRE, SETTEMBRE);
  assert.ok(pari.includes('data-verso="pari"'));

  /* Senza un prezzo unico scritto non c'è confronto da fare, e la riga non si
   * scrive invece di confrontare con zero. */
  const nudo = ilBloccoDelleFasce({ ...REPORT, unico: null, risparmio: null }, TRE, SETTEMBRE);
  assert.ok(!nudo.includes("dm-fasce-confronto"));
});

test("il blocco dice quanta parte è misurata e quanta è stimata", () => {
  const inParte = ilBloccoDelleFasce(REPORT, TRE, SETTEMBRE);
  assert.ok(/38[,.]1/.test(inParte), "i kWh misurati");
  assert.ok(/3[,.]1/.test(inParte), "i kWh stimati");

  const tutto = ilBloccoDelleFasce(
    { ...REPORT, tuttoMisurato: true, stimato: { kwh: 0, euro: 0, prezzo: 0.283 } },
    TRE,
    SETTEMBRE,
  );
  assert.ok(tutto.includes("✅"));
  assert.ok(!tutto.includes("ℹ️"));
});

test("senza report non si disegna niente", () => {
  assert.equal(ilBloccoDelleFasce(null, TRE, SETTEMBRE), "");
  assert.equal(ilBloccoDelleFasce(REPORT, { quante: 0, voci: [] }, SETTEMBRE), "");
});
