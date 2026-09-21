/* Il blocco «Come si divide il costo reale», disegnato (#72, seconda metà).
 *
 * Qui si prova la parte del blocco che non tocca niente: entrano il report, la
 * configurazione e il mese, esce il markup. Il giro alla rete — le ore del mese
 * chieste al Recorder — sta nella sezione e si prova nel browser.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  nomeDellaFascia,
  orarioDellaFascia,
  tintaDellaFascia,
} from "../src/core/fasce-della-tariffa.js";
import {
  ilBloccoDelleFasce,
  ilProfiloDelleOre,
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

test("il blu è la fascia che costa meno, con due fasce come con tre", () => {
  /* La scala va dalla più cara alla più economica. Con due fasce si prendono i
   * due estremi invece dei primi due, così «il blu è la notte» vale in tutti e
   * due i casi invece di dipendere da quante sono. */
  assert.equal(tintaDellaFascia(3, 0), "#f97316");
  assert.equal(tintaDellaFascia(3, 2), "#1d4ed8");
  assert.equal(tintaDellaFascia(2, 0), "#f97316");
  assert.equal(tintaDellaFascia(2, 1), "#1d4ed8");
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
  assert.ok(markup.includes("background:#1d4ed8"));
  /* E non l'azzurro della linea del consumo, che nell'andamento giornaliero
   * sta accanto a queste colonne: due pallini identici per due cose diverse
   * sono il modo più rapido di far leggere un grafico al contrario. */
  assert.ok(!markup.includes("#0ea5e9"));
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

/* ── le colonne dell'andamento giornaliero ──────────────────────────────── */

test("ogni giorno del mese finisce nella sua colonna, divisa per fascia", async () => {
  const polish = await import("../src/sections/energy-report-polish-section.js");
  polish.registraIlContoAFasce(() => ({
    euro: 3,
    kwh: 10,
    report: {
      fasce: [
        { indice: 0, dalle: 480 },
        { indice: 1, dalle: 1140 },
        { indice: 2, dalle: 1380 },
      ],
      giorni: [
        { giorno: "2026-09-01", per: [2, 1, 0.5], kwh: 3.5 },
        { giorno: "2026-09-14", per: [1, 0, 2], kwh: 3 },
        /* Il 5 ottobre non è il 5 settembre: la chiave del giorno va guardata
         * tutta, non solo le ultime due cifre. */
        { giorno: "2026-10-05", per: [9, 9, 9], kwh: 27 },
        { giorno: "2025-09-05", per: [7, 7, 7], kwh: 21 },
      ],
    },
  }));

  const serie = polish.barreDelleFasce(30, 9, 2026);
  assert.deepEqual(
    serie.map((s) => [s.label, s.type, s.stack, s.backgroundColor]),
    [
      ["F1", "bar", "rete", "#f97316"],
      ["F2", "bar", "rete", "#8b5cf6"],
      ["F3", "bar", "rete", "#1d4ed8"],
    ],
  );
  assert.equal(serie[0].data.length, 30);
  assert.equal(serie[0].data[0], 2);
  assert.equal(serie[2].data[0], 0.5);
  assert.equal(serie[0].data[13], 1);
  assert.equal(serie[2].data[13], 2);
  /* Né il 5 ottobre né il 5 settembre dell'anno prima gonfiano la colonna 5. */
  assert.equal(serie[0].data[4], 0);
  /* L'orario viaggia con la serie: «F2» da solo, nel riquadro che si apre
   * passando sopra una colonna, non dice niente. */
  assert.equal(serie[1].dmOrario, "19:00–23:00");

  /* Senza un conto a fasce in mano non ci sono colonne da aggiungere, e il
   * grafico resta quello di sempre. */
  polish.registraIlContoAFasce(null);
  assert.deepEqual(polish.barreDelleFasce(30, 9, 2026), []);
});

/* ── il profilo delle ventiquattro ore ──────────────────────────────────── */

const SAGOMA = [
  0.6, 0.5, 0.45, 0.4, 0.4, 0.5, 0.9, 1.6, 2.1, 1.7, 1.3, 1.5, 1.9, 1.4, 1.1, 1.0, 1.2, 1.8, 2.6,
  3.4, 3.1, 2.2, 1.5, 0.9,
];

function profiloDiUnaGiornata(sagoma = SAGOMA) {
  const fasciaDi = (ora) => (ora >= 8 && ora < 19 ? 0 : ora >= 19 && ora < 23 ? 1 : 2);
  const prezzo = [0.35, 0.28, 0.2];
  return {
    ore: sagoma.map((kwh, ora) => ({
      ora,
      kwh,
      euro: kwh * prezzo[fasciaDi(ora)],
      fascia: fasciaDi(ora),
    })),
  };
}

test("il profilo ha una colonna per ogni ora, colorata come la sua fascia", () => {
  const markup = ilProfiloDelleOre(profiloDiUnaGiornata(), TRE);
  assert.equal(markup.match(/dm-profilo-colonna/g).length, 24);
  /* La più alta è al 100%, e nessuna scende sotto i due punti: un'ora in cui
   * hai comprato pochissimo deve restare visibile, altrimenti non si distingue
   * da un'ora in cui non hai comprato niente. */
  assert.ok(markup.includes("height:100%"));
  assert.ok(!/height:0%/.test(markup));
  /* Le tre fasce ci sono tutte e tre, e ognuna col suo colore. */
  for (const tinta of ["#f97316", "#8b5cf6", "#1d4ed8"])
    assert.ok(markup.includes(`background:${tinta}`), `manca ${tinta}`);
});

test("il profilo dice l'ora in cui compri di più, con la sua fascia e la sua spesa", () => {
  const markup = ilProfiloDelleOre(profiloDiUnaGiornata(), TRE);
  /* Il picco della sagoma è alle 19: 3,4 kWh in F2 a 0,28 €/kWh. */
  assert.ok(markup.includes("19:00 · F2 · 3,4 kWh · 0,95 €"), markup.slice(-400));
});

test("senza ore comprate non c'è niente da disegnare", () => {
  /* Una casa che in tutto il mese non ha preso niente dalla rete — o un mese
   * di cui il Recorder non ha più nessuna ora — non merita ventiquattro
   * colonne vuote: il riquadro non si scrive proprio. */
  assert.equal(ilProfiloDelleOre(profiloDiUnaGiornata(SAGOMA.map(() => 0)), TRE), "");
  assert.equal(ilProfiloDelleOre({ ore: [] }, TRE), "");
  assert.equal(ilProfiloDelleOre(null, TRE), "");
});
