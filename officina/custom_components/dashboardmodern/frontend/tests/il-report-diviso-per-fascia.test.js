/* «Fai un report fatto bene, suddiviso sulle 3 fasce, che mostra andamento e
 * costi» (#72, seconda metà).
 *
 * Quando le fasce sono nate avevo scritto che sul periodo potevano dare solo
 * una stima, perché «la plancia sa quanti kWh sono passati, non in che ore».
 * Era una limitazione mia, non una limitazione vera: il Report chiede già a
 * Home Assistant le statistiche ORA PER ORA — è così che disegna l'andamento
 * giornaliero — e se i kilowattora arrivano già divisi per ora, ogni ora si
 * mette nella sua fascia e il conto è esatto.
 *
 * Qui si tiene fermo quello, e la riga che lo qualifica: esatto per le ore che
 * ci sono, stimato per quelle che il Recorder ha buttato, e detto quale è
 * quale invece di spacciare tutto per un conto.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  giornoDi,
  kwhPerOra,
  reportDelleFasce,
} from "../src/core/il-report-delle-fasce.js";

const FASCE = {
  quante: 3,
  voci: [
    { dalle: "08:00", prezzo: 0.35 },
    { dalle: "19:00", prezzo: 0.28 },
    { dalle: "23:00", prezzo: 0.2 },
  ],
  festivi: 2,
};

/* Un mercoledì. Le righe del Recorder portano `sum`, che è un totale che sale:
 * i kWh di un'ora sono la differenza con l'ora prima. */
const MERCOLEDI = new Date("2026-09-23T00:00:00").getTime();
const ora = (h, somma) => ({ start: new Date(MERCOLEDI + h * 3600000).toISOString(), sum: somma });

/* Due nella notte (F3), tre di giorno (F1), quattro di sera (F2). */
const GIORNATA = [
  ora(0, 100), ora(1, 101), ora(2, 102),
  ora(9, 102), ora(10, 105),
  ora(20, 105), ora(21, 109),
];

/* ── le ore ─────────────────────────────────────────────────────────────── */

test("i kWh di un'ora sono la differenza con l'ora prima", () => {
  const ore = kwhPerOra([ora(0, 100), ora(1, 101.5), ora(2, 104)]);
  assert.deepEqual(
    ore.map((o) => o.kwh),
    [1.5, 2.5],
  );
  /* La prima riga non ha un'ora prima: è il paletto da cui si comincia a
   * misurare, non un'ora persa. */
  assert.equal(ore.length, 2);
});

test("un contatore azzerato non toglie kWh alla fascia in cui succede", () => {
  /* Una differenza negativa vuol dire contatore sostituito o statistiche
   * ripartite: contarla in negativo regalerebbe kilowattora. */
  const ore = kwhPerOra([ora(0, 900), ora(1, 5), ora(2, 7)]);
  assert.deepEqual(
    ore.map((o) => o.kwh),
    [2],
  );
  /* E quello che non è una riga non diventa un'ora. */
  assert.deepEqual(kwhPerOra(null), []);
  assert.deepEqual(kwhPerOra([{ sum: 3 }, { start: "boh", sum: 4 }]), []);
});

test("le righe arrivano in qualunque ordine e il conto non cambia", () => {
  const dritte = kwhPerOra([ora(0, 100), ora(1, 101), ora(2, 103)]);
  const storte = kwhPerOra([ora(2, 103), ora(0, 100), ora(1, 101)]);
  assert.deepEqual(storte, dritte);
});

test("le righe già contate si usano come sono, prima riga compresa", () => {
  /* È la forma che arriva davvero alla sezione: `statisticsWithGrowth` non
   * restituisce le somme grezze, restituisce righe con `change`, cioè i kWh di
   * quel secchiello, contati da `recorderBucketConsumptions` — che sa
   * distinguere una limatura del Recorder da un contatore ripartito da zero.
   *
   * Quel conto è migliore di qualunque sottrazione fatta qui, e la prima riga
   * non si butta: il suo riferimento è l'ora prima del periodo, chiesta
   * apposta da chi ha fatto la domanda. */
  const cresciuta = (h, quanti) => ({ ...ora(h, 0), change: quanti });
  const ore = kwhPerOra([cresciuta(0, 1.5), cresciuta(1, 2), cresciuta(2, 0)]);
  assert.deepEqual(
    ore.map((o) => o.kwh),
    [1.5, 2],
  );
  /* Un'ora senza consumo non è un'ora da mettere in una fascia. */
  assert.equal(ore.length, 2);
});

test("le somme grezze restano la strada quando `change` non c'è", () => {
  /* La forma si riconosce dalle righe, non da un parametro: basta che una sola
   * riga non porti `change` perché il conto torni alle differenze — mescolare
   * le due letture sulla stessa serie darebbe numeri che non sono né gli uni
   * né gli altri. */
  const meta = [ora(0, 100), { ...ora(1, 101), change: 7 }, ora(2, 103)];
  assert.deepEqual(
    kwhPerOra(meta).map((o) => o.kwh),
    [1, 2],
  );
});

test("il giorno di un'ora è quello della casa, non quello di Greenwich", () => {
  assert.equal(giornoDi(new Date("2026-09-23T23:30:00").getTime()), "2026-09-23");
  assert.equal(giornoDi(new Date("2026-01-05T00:10:00").getTime()), "2026-01-05");
  assert.equal(giornoDi(NaN), "");
});

/* ── il conto vero ──────────────────────────────────────────────────────── */

test("ogni ora finisce nella sua fascia, e il conto è esatto", () => {
  const r = reportDelleFasce(GIORNATA, FASCE, { prezzoUnico: 0.3, totale: 9 });
  assert.deepEqual(
    r.fasce.map((f) => [f.kwh, Number(f.euro.toFixed(2))]),
    [
      [3, 1.05],
      [4, 1.12],
      [2, 0.4],
    ],
  );
  assert.equal(r.kwh, 9);
  assert.equal(Number(r.euro.toFixed(2)), 2.57);
  /* Tutte le ore del periodo ci sono: niente stima. */
  assert.equal(r.tuttoMisurato, true);
  assert.equal(r.stimato.kwh, 0);
  assert.equal(r.misurato.kwh, 9);
});

test("la riga che risponde alla domanda vera: le fasce mi convengono?", () => {
  const r = reportDelleFasce(GIORNATA, FASCE, { prezzoUnico: 0.3, totale: 9 });
  assert.equal(Number(r.unico.euro.toFixed(2)), 2.7);
  assert.equal(Number(r.risparmio.toFixed(2)), 0.13);
  /* Senza un prezzo unico scritto non c'è confronto da fare, e chi disegna
   * non scrive la riga invece di confrontare con zero. */
  const senza = reportDelleFasce(GIORNATA, FASCE, { prezzoUnico: 0, totale: 9 });
  assert.equal(senza.unico, null);
  assert.equal(senza.risparmio, null);
});

test("l'andamento è giorno per giorno, diviso in tre", () => {
  const dopo = new Date("2026-09-24T00:00:00").getTime();
  const righe = [
    ...GIORNATA,
    { start: new Date(dopo + 9 * 3600000).toISOString(), sum: 109 },
    { start: new Date(dopo + 10 * 3600000).toISOString(), sum: 111 },
  ];
  const r = reportDelleFasce(righe, FASCE, { prezzoUnico: 0.3, totale: 11 });
  assert.deepEqual(
    r.giorni.map((g) => [g.giorno, g.per]),
    [
      ["2026-09-23", [3, 4, 2]],
      ["2026-09-24", [2, 0, 0]],
    ],
  );
});

test("il fine settimana finisce dove dice la regola, non dove dice l'ora", () => {
  const sabato = new Date("2026-09-26T00:00:00").getTime();
  const righe = [
    { start: new Date(sabato + 9 * 3600000).toISOString(), sum: 0 },
    { start: new Date(sabato + 10 * 3600000).toISOString(), sum: 4 },
  ];
  /* Le dieci di sabato mattina sarebbero F1: in Italia il weekend sta in F3. */
  const r = reportDelleFasce(righe, FASCE, { prezzoUnico: 0.3, totale: 4 });
  assert.deepEqual(r.fasce.map((f) => f.kwh), [0, 0, 4]);
  assert.equal(Number(r.euro.toFixed(2)), 0.8);
  /* (Gli euro si confrontano sempre arrotondati: 9 × 0,30 in virgola mobile
   * fa 2,6999999999999997, e una prova che pretende 2,7 esatto prova la
   * virgola mobile invece del conto.) */
});

/* ── quando il conto non si può fare per intero ─────────────────────────── */

test("i kWh che le ore non spiegano si pagano alla media, e si dichiarano", () => {
  /* Il Recorder tiene il passo orario per un pugno di giorni: più indietro
   * restano i totali del giorno, e quei kilowattora esistono nel totale del
   * periodo ma non si sa in che ora siano passati. */
  const r = reportDelleFasce(GIORNATA, FASCE, { prezzoUnico: 0.3, totale: 29 });
  assert.equal(r.misurato.kwh, 9);
  assert.equal(r.stimato.kwh, 20);
  assert.equal(r.tuttoMisurato, false);
  /* La parte stimata si paga alla media pesata sulle ore, che è la stima che
   * non favorisce nessuna ipotesi — e il prezzo è dichiarato, così chi legge
   * sa con che cosa è stata fatta. */
  assert.ok(r.stimato.prezzo > 0.2 && r.stimato.prezzo < 0.35);
  assert.equal(
    Number(r.euro.toFixed(4)),
    Number((r.misurato.euro + r.stimato.euro).toFixed(4)),
  );
  assert.equal(r.kwh, 29);
});

test("un totale più piccolo delle ore lette non fa nascere kWh negativi", () => {
  /* Succede quando il totale del periodo arriva da un'altra strada e taglia
   * più stretto: non si inventa un debito, si dice che è tutto misurato. */
  const r = reportDelleFasce(GIORNATA, FASCE, { prezzoUnico: 0.3, totale: 4 });
  assert.equal(r.stimato.kwh, 0);
  assert.equal(r.kwh, 9);
  /* E senza totale si conta quello che le ore dicono, e basta. */
  assert.equal(reportDelleFasce(GIORNATA, FASCE, { prezzoUnico: 0.3 }).kwh, 9);
});

/* ── quando non c'è niente da dividere ──────────────────────────────────── */

test("senza fasce configurate non c'è report: la pagina resta quella di prima", () => {
  assert.equal(reportDelleFasce(GIORNATA, null, { prezzoUnico: 0.3 }), null);
  assert.equal(reportDelleFasce(GIORNATA, { quante: 0 }, { prezzoUnico: 0.3 }), null);
  /* Fasce accese ma senza nemmeno un prezzo: non c'è niente da dividere. */
  assert.equal(
    reportDelleFasce(GIORNATA, { quante: 2, voci: [{ dalle: "08:00" }, { dalle: "19:00" }] }, {}),
    null,
  );
});

test("una fascia senza prezzo usa quello unico, e lo dice", () => {
  const mezze = {
    quante: 2,
    voci: [{ dalle: "00:00", prezzo: 0.4 }, { dalle: "12:00" }],
  };
  const r = reportDelleFasce(GIORNATA, mezze, { prezzoUnico: 0.25, totale: 9 });
  assert.equal(r.fasce[0].suo, true);
  assert.equal(r.fasce[1].suo, false);
  assert.equal(r.fasce[1].prezzo, 0.25);
});

/* ── il profilo delle ventiquattro ore ──────────────────────────────────── */

test("ogni ora del giorno dice quanto si compra e quanto costa", () => {
  const r = reportDelleFasce(GIORNATA, FASCE, { prezzoUnico: 0.3, totale: 9 });
  /* Sempre tutte e ventiquattro e sempre in ordine: chi disegna il profilo non
   * deve rimettere a posto i buchi. */
  assert.equal(r.ore.length, 24);
  assert.deepEqual(
    r.ore.map((o) => o.ora),
    Array.from({ length: 24 }, (_, indice) => indice),
  );
  /* L'una e le due di notte sono F3, le dieci sono F1, le 21 sono F2. */
  const alle = (ora) => r.ore[ora];
  assert.equal(alle(1).kwh, 1);
  assert.equal(alle(1).fascia, 2);
  assert.equal(Number(alle(1).euro.toFixed(3)), 0.2);
  assert.equal(alle(10).kwh, 3);
  assert.equal(alle(10).fascia, 0);
  assert.equal(Number(alle(10).euro.toFixed(3)), 1.05);
  assert.equal(alle(21).kwh, 4);
  assert.equal(alle(21).fascia, 1);
  /* Un'ora in cui non è passato niente resta a zero, non sparisce. */
  assert.equal(alle(15).kwh, 0);
  assert.equal(alle(15).fascia, 0);

  /* Le ore e le fasce raccontano gli stessi kilowattora. */
  const dalleOre = r.ore.reduce((somma, ora) => somma + ora.kwh, 0);
  assert.equal(Number(dalleOre.toFixed(6)), Number(r.misurato.kwh.toFixed(6)));
});

test("la colonna di un'ora ha un colore solo, ma il prezzo del giorno in cui è passata", () => {
  /* Sabato pomeriggio: l'ora delle 15 è in F1 da calendario, ma quel sabato la
   * regola dei festivi la mette in F3. La colonna resta F1 — una colonna non
   * si può tingere a metà — e gli euro sono quelli veri, cioè F3. */
  const SABATO = new Date("2026-09-26T00:00:00").getTime();
  const sabato = (h, somma) => ({ start: new Date(SABATO + h * 3600000).toISOString(), sum: somma });
  const r = reportDelleFasce([sabato(14, 100), sabato(15, 102)], FASCE, { prezzoUnico: 0.3 });
  assert.equal(r.ore[15].kwh, 2);
  assert.equal(r.ore[15].fascia, 0, "la colonna è quella feriale");
  assert.equal(Number(r.ore[15].euro.toFixed(3)), 0.4, "il prezzo è quello del sabato");
});
