/* Le ultime 24 ore di un contatto o di un rilevatore (#269).
 *
 * Qui si prova la parte pura del foglio: dallo storico del Recorder ai tratti,
 * alle aperture, ai conti delle tre caselle, alle ore e alla quiete della
 * notte. Le ore si scrivono in ora locale, come le legge chi guarda: la prova
 * costruisce gli istanti con `new Date(anno, mese, giorno, ora, minuto)`, cosi'
 * vale in qualunque fuso giri.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ATTIVO,
  MUTO,
  RIPOSO,
  accensioni,
  contiDelMovimento,
  contiDelVarco,
  eDiSera,
  elencoDegliEventi,
  famigliaDelSensore,
  finestraDelleUltime24,
  finestraDiIeri,
  letturaDelloStato,
  mezzanotteDi,
  orario,
  pezziDellaDurata,
  quieteDellaNotte,
  rilevazioniPerOra,
  silenzi,
  tacche,
  tratti,
  ultimeRilevazioni,
} from "../src/core/ultime-rilevazioni.js";

const MIN = 60_000;
/* Oggi alle 18:30, un giorno qualunque. */
const oggi = (ora, minuto = 0) => new Date(2026, 9, 14, ora, minuto).getTime();
const ieri = (ora, minuto = 0) => new Date(2026, 9, 13, ora, minuto).getTime();
const ADESSO = oggi(18, 30);
const FINESTRA = finestraDelleUltime24(ADESSO);

/* Una porta: chiusa all'inizio, aperta e chiusa qualche volta, muta un
 * quarto d'ora di notte. */
function storicoDellaPorta() {
  return [
    { state: "off", time: FINESTRA.start },
    { state: "on", time: ieri(19, 5) },
    { state: "off", time: ieri(19, 6) },
    { state: "on", time: ieri(21, 40) },
    { state: "off", time: ieri(21, 41) },
    { state: "unavailable", time: oggi(3, 10) },
    { state: "off", time: oggi(3, 24) },
    { state: "on", time: oggi(7, 42) },
    { state: "off", time: oggi(7, 45) },
    { state: "on", time: oggi(17, 2) },
    { state: "off", time: oggi(17, 9) },
    { state: "on", time: oggi(18, 16) },
    { state: "off", time: oggi(18, 18) },
  ];
}

test("lo stato grezzo si legge acceso, a riposo o muto, anche girato", () => {
  assert.equal(letturaDelloStato("on"), ATTIVO);
  assert.equal(letturaDelloStato("open"), ATTIVO);
  assert.equal(letturaDelloStato("off"), RIPOSO);
  assert.equal(letturaDelloStato("closed"), RIPOSO);
  assert.equal(letturaDelloStato("unavailable"), MUTO);
  assert.equal(letturaDelloStato("unknown"), MUTO);
  assert.equal(letturaDelloStato(undefined), MUTO);
  assert.equal(letturaDelloStato("on", { invertito: true }), RIPOSO);
  assert.equal(letturaDelloStato("off", { invertito: true }), ATTIVO);
});

test("la famiglia la dice chi apre il foglio, poi la classe", () => {
  assert.equal(famigliaDelSensore({ classe: "door" }), "varco");
  assert.equal(famigliaDelSensore({ classe: "garage_door" }), "varco");
  assert.equal(famigliaDelSensore({ classe: "occupancy" }), "movimento");
  assert.equal(famigliaDelSensore({ classe: "motion" }), "movimento");
  assert.equal(famigliaDelSensore({ classe: "opening", origine: "movimento" }), "movimento");
  assert.equal(famigliaDelSensore({ classe: "temperature" }), "");
});

test("i tratti coprono il periodo, cuciti e tagliati ai capi", () => {
  const elenco = tratti(storicoDellaPorta(), FINESTRA);
  assert.equal(elenco[0].da, FINESTRA.start);
  assert.equal(elenco[elenco.length - 1].a, FINESTRA.end);
  for (let i = 1; i < elenco.length; i++) {
    assert.equal(elenco[i].da, elenco[i - 1].a, "nessun buco fra due tratti");
    assert.notEqual(elenco[i].stato, elenco[i - 1].stato, "due tratti uguali di fila si cuciono");
  }
  assert.deepEqual(silenzi(elenco), [{ da: oggi(3, 10), a: oggi(3, 24) }]);
});

test("prima della prima riga non si sa niente, e non si disegna", () => {
  const elenco = tratti([{ state: "on", time: oggi(12, 0) }], FINESTRA);
  assert.equal(elenco.length, 1);
  assert.equal(elenco[0].da, oggi(12, 0));
  assert.equal(elenco[0].stato, ATTIVO);
});

test("lo stato vivo si cuce in coda allo storico in memoria", () => {
  /* Lo storico e' di dieci minuti fa: la porta si e' aperta dopo. */
  const elenco = tratti([{ state: "off", time: FINESTRA.start }], {
    ...FINESTRA,
    vivo: { state: "on", time: oggi(18, 25) },
  });
  assert.deepEqual(elenco[elenco.length - 1], { da: oggi(18, 25), a: ADESSO, stato: ATTIVO });
  const aperte = accensioni(elenco, { ...FINESTRA, adesso: ADESSO });
  assert.equal(aperte.length, 1);
  assert.equal(aperte[0].inCorso, true);
});

test("i conti della porta: oggi, ieri sera, in tutto, la piu' lunga", () => {
  const analisi = ultimeRilevazioni(storicoDellaPorta(), {
    famiglia: "varco",
    finestra: FINESTRA,
    adesso: ADESSO,
  });
  assert.equal(analisi.eventi.length, 5);
  assert.equal(analisi.conti.volte, 3);
  assert.equal(analisi.conti.prima, 2);
  /* 3 + 7 + 2 minuti dalla mezzanotte. */
  assert.equal(analisi.conti.totale, 12 * MIN);
  assert.equal(analisi.conti.piuLunga.da, oggi(17, 2));
  assert.equal(analisi.conti.piuLunga.durata, 7 * MIN);
  assert.equal(analisi.eventi.every((evento) => !evento.inCorso), true);
  /* L'elenco parte dalla piu' recente, e sa a che gruppo appartiene. */
  assert.equal(analisi.elenco[0].da, oggi(18, 16));
  assert.deepEqual(
    analisi.elenco.map((evento) => evento.gruppo),
    ["oggi", "oggi", "oggi", "prima", "prima"],
  );
  assert.equal(eDiSera(analisi.elenco.filter((evento) => evento.gruppo === "prima")), true);
});

test("una porta gia' aperta all'inizio del periodo non conta come aperta oggi", () => {
  const conti = contiDelVarco(
    accensioni(tratti([{ state: "on", time: FINESTRA.start - 3600_000 }], FINESTRA), FINESTRA),
    { ...FINESTRA, mezzanotte: mezzanotteDi(ADESSO) },
  );
  assert.equal(conti.volte, 0);
  assert.equal(conti.prima, 1);
  /* Ma il tempo aperta dalla mezzanotte c'e' tutto. */
  assert.equal(conti.totale, ADESSO - mezzanotteDi(ADESSO));
});

test("ieri va da mezzanotte a mezzanotte, e la conta tutta", () => {
  const finestra = finestraDiIeri(ADESSO);
  assert.equal(finestra.start, ieri(0, 0));
  assert.equal(finestra.end, oggi(0, 0));
  const analisi = ultimeRilevazioni(
    [
      { state: "off", time: ieri(0, 0) },
      { state: "on", time: ieri(8, 0) },
      { state: "off", time: ieri(8, 30) },
    ],
    { famiglia: "varco", finestra, adesso: ADESSO },
  );
  assert.equal(analisi.conti.volte, 1);
  assert.equal(analisi.conti.prima, 0);
  assert.equal(analisi.conti.totale, 30 * MIN);
  assert.ok(Math.abs(analisi.conti.quota - 30 / 1440) < 0.01);
  assert.equal(analisi.eventi[0].inCorso, false, "ieri e' finito: niente e' in corso");
});

/* Un corridoio: qualche passaggio la sera, notte tranquilla, mattina fitta. */
function storicoDelCorridoio() {
  const righe = [{ state: "off", time: FINESTRA.start }];
  const passa = (da, minuti) => {
    righe.push({ state: "on", time: da });
    righe.push({ state: "off", time: da + minuti * MIN });
  };
  passa(ieri(20, 0), 1);
  passa(ieri(23, 0), 1);
  passa(oggi(6, 52), 2);
  passa(oggi(7, 5), 1);
  passa(oggi(7, 20), 1);
  passa(oggi(7, 40), 1);
  passa(oggi(12, 10), 3);
  passa(oggi(18, 28), 1);
  return righe;
}

test("i conti del movimento: quante oggi, la prima, l'ora piu' fitta", () => {
  const analisi = ultimeRilevazioni(storicoDelCorridoio(), {
    famiglia: "movimento",
    finestra: FINESTRA,
    adesso: ADESSO,
  });
  assert.equal(analisi.conti.volte, 6);
  assert.equal(analisi.conti.prima, 2);
  assert.equal(analisi.conti.primo.da, oggi(6, 52));
  assert.equal(analisi.conti.fitta.da, oggi(7, 0));
  assert.equal(analisi.conti.fitta.a, oggi(8, 0));
  assert.equal(analisi.conti.fitta.conto, 3);
  /* La quiete della notte: dall'ultimo movimento della sera al primo del
   * mattino. */
  assert.deepEqual(analisi.quiete, { da: ieri(23, 1), a: oggi(6, 52) });
});

test("le ore sono quelle dell'orologio, tagliate ai capi del periodo", () => {
  const ore = rilevazioniPerOra(
    [
      { da: oggi(7, 5), a: oggi(7, 6) },
      { da: oggi(7, 59), a: oggi(8, 1) },
      { da: oggi(18, 20), a: oggi(18, 21) },
    ],
    FINESTRA,
  );
  assert.equal(ore[0].da, FINESTRA.start);
  assert.equal(ore[0].a, ieri(19, 0));
  assert.equal(ore[ore.length - 1].a, FINESTRA.end);
  assert.equal(ore.reduce((somma, ora) => somma + ora.conto, 0), 3);
  assert.equal(ore.find((ora) => ora.da === oggi(7, 0)).conto, 2);
  /* 18:30 → 18:30: la mezz'ora di ieri, 23 ore piene, la mezz'ora di oggi. */
  assert.equal(ore.length, 25);
});

test("una pausa breve di notte non e' una quiete", () => {
  const movimenti = [
    { da: oggi(1, 0), a: oggi(1, 1) },
    { da: oggi(1, 30), a: oggi(1, 31) },
    { da: oggi(2, 0), a: oggi(2, 1) },
  ];
  const quiete = quieteDellaNotte(movimenti, {
    start: oggi(0, 30),
    end: oggi(2, 30),
    mezzanotte: oggi(0, 0),
  });
  assert.equal(quiete, null);
});

test("il conto del movimento non conta chi era gia' acceso all'inizio", () => {
  const conti = contiDelMovimento(
    [
      { da: FINESTRA.start, a: FINESTRA.start + MIN, daPrima: true },
      { da: oggi(9, 0), a: oggi(9, 1) },
    ],
    { ...FINESTRA, mezzanotte: mezzanotteDi(ADESSO) },
  );
  assert.equal(conti.volte, 1);
  assert.equal(conti.prima, 0);
});

test("le tacche cadono ogni sei ore, lontane dai capi", () => {
  assert.deepEqual(tacche(FINESTRA.start, FINESTRA.end), [
    oggi(0, 0),
    oggi(6, 0),
    oggi(12, 0),
  ]);
  const ieriTutto = finestraDiIeri(ADESSO);
  assert.deepEqual(tacche(ieriTutto.start, ieriTutto.end), [ieri(6, 0), ieri(12, 0), ieri(18, 0)]);
});

test("l'elenco dice il gruppo, e la sera e' sera solo se lo e' tutta", () => {
  const elenco = elencoDegliEventi(
    [
      { da: ieri(15, 0), a: ieri(15, 1) },
      { da: oggi(9, 0), a: oggi(9, 1) },
    ],
    { mezzanotte: mezzanotteDi(ADESSO) },
  );
  assert.deepEqual(
    elenco.map((evento) => evento.gruppo),
    ["oggi", "prima"],
  );
  assert.equal(eDiSera(elenco.filter((evento) => evento.gruppo === "prima")), false);
});

test("un periodo senza righe e' vuoto, e non inventa una porta chiusa", () => {
  const analisi = ultimeRilevazioni([], { famiglia: "varco", finestra: FINESTRA, adesso: ADESSO });
  assert.equal(analisi.vuoto, true);
  assert.equal(analisi.eventi.length, 0);
});

test("le durate in pezzi, e l'orario a ventiquattro ore", () => {
  assert.deepEqual(pezziDellaDurata(7 * MIN), {
    giorni: 0,
    ore: 0,
    minuti: 7,
    breve: false,
    totaleMinuti: 7,
  });
  assert.equal(pezziDellaDurata(20_000).breve, true);
  assert.equal(pezziDellaDurata(80 * MIN).ore, 1);
  assert.equal(pezziDellaDurata(80 * MIN).minuti, 20);
  assert.equal(orario(oggi(7, 5)), "07:05");
  assert.equal(orario(oggi(18, 30)), "18:30");
});
