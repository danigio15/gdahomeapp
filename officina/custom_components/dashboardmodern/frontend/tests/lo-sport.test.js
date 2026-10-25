/* Lo sport, la parte che si prova a tavolino.
 *
 * I risultati sono quelli che il ponte manderebbe davvero: le risposte vere
 * delle fonti di un sabato di fine ottobre 2026 (`ponte/test/sport/`), messe
 * in forma dallo stesso `ponte/src/sport.js`. Qui si tiene ferma la parte che
 * decide guardandoli: la configurazione, la forma della squadra, la partita
 * da mettere in grande, la classifica attorno alla squadra, la prossima
 * sessione, e cosa dire nella tessera della Home.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  CAMPIONATI,
  CHIAVE_SPORT,
  domandaDelleScelte,
  formaRecente,
  fraQuantoSiRichiede,
  giornoDi,
  inEvidenza,
  latiDellaPartita,
  nomeBreveDelGp,
  normalizzaSport,
  partitaInGrande,
  prossimaSessione,
  quantoManca,
  quotaDelPrimo,
  rigaDelPreferito,
  righeAttorno,
  spostaIlSeguito,
} from "../src/core/lo-sport.js";
import {
  CAMPIONATI as CAMPIONATI_DEL_PONTE,
  calcioDaEspn,
  f1DaJolpica,
  motoDaPulselive,
} from "../../../../../ponte/src/sport.js";

const campione = (nome) =>
  JSON.parse(
    readFileSync(new URL(`../../../../../ponte/test/sport/${nome}.json`, import.meta.url)),
  );
const SABATO = Date.UTC(2026, 9, 24, 20, 0, 0);

const inter = calcioDaEspn({
  id: "110",
  campionato: "ita.1",
  giocate: campione("calcio-inter-tutte"),
  prossime: campione("calcio-inter-tutte-prossime"),
  classifica: campione("calcio-serie-a-classifica"),
});
const f1 = f1DaJolpica({
  gara: campione("f1-ultima-gara"),
  sprint: campione("f1-sprint"),
  calendario: campione("f1-calendario"),
  piloti: campione("f1-piloti"),
  costruttori: campione("f1-costruttori"),
  adesso: SABATO,
});
const sessioni = campione("moto-sessioni");
const moto = motoDaPulselive({
  eventi: campione("moto-eventi"),
  eventoGara: campione("moto-eventi").find((e) => e.country?.iso === "AU" && !e.test),
  tipo: "SPR",
  gara: campione("moto-sprint"),
  campionato: campione("moto-classifica"),
  adesso: SABATO,
});

test("la chiave e i campionati sono gli stessi del ponte", () => {
  assert.equal(CHIAVE_SPORT, "cd_sport");
  assert.deepEqual(CAMPIONATI, CAMPIONATI_DEL_PONTE);
  assert.ok(sessioni.length > 0);
});

test("la configurazione: solo squadre vere, niente doppioni, al massimo otto", () => {
  const c = normalizzaSport({
    seguiti: [
      { tipo: "calcio", campionato: "ita.1", squadra: "110", nome: "Internazionale" },
      { tipo: "calcio", campionato: "ita.1", squadra: "110" },
      { tipo: "calcio", campionato: "xxx", squadra: "1" },
      { tipo: "calcio", campionato: "ita.1", squadra: "1/../2" },
      { tipo: "f1", preferito: "leclerc" },
      { tipo: "f1" },
      { tipo: "motogp" },
      { tipo: "tennis" },
      null,
    ],
  });
  assert.deepEqual(c.seguiti, [
    { tipo: "calcio", campionato: "ita.1", squadra: "110", nome: "Internazionale" },
    { tipo: "f1", preferito: "leclerc" },
    { tipo: "motogp", preferito: "" },
  ]);
  assert.deepEqual(normalizzaSport(null), { seguiti: [] });
  const tante = normalizzaSport({
    seguiti: Array.from({ length: 12 }, (_, i) => ({
      tipo: "calcio",
      campionato: "ita.1",
      squadra: String(100 + i),
    })),
  });
  assert.equal(tante.seguiti.length, 8);
});

test("al ponte vanno solo le scelte, non i nomi ne' il pilota del cuore", () => {
  assert.deepEqual(
    domandaDelleScelte({
      seguiti: [
        { tipo: "calcio", campionato: "ita.1", squadra: "110", nome: "Internazionale" },
        { tipo: "f1", preferito: "leclerc" },
      ],
    }),
    [{ tipo: "calcio", campionato: "ita.1", squadra: "110" }, { tipo: "f1" }],
  );
});

test("spostare una cosa seguita", () => {
  assert.deepEqual(spostaIlSeguito(["a", "b", "c"], 2, -1), ["a", "c", "b"]);
  assert.deepEqual(spostaIlSeguito(["a", "b", "c"], 0, -1), ["a", "b", "c"]);
});

test("calcio: la forma recente, dalla piu' vecchia alla piu' fresca", () => {
  const forma = formaRecente(inter);
  assert.equal(forma.length, 5);
  assert.ok(forma.every((e) => ["V", "N", "P"].includes(e)));
  assert.equal(forma.at(-1), inter.ultime[0].esito);
});

test("calcio: in grande la prossima partita, e chi e' la squadra seguita", () => {
  const grande = partitaInGrande(inter);
  assert.equal(grande.perche, "prossima");
  const lati = latiDellaPartita(grande.partita, "110");
  assert.equal(lati.mia.id, "110");
  assert.equal(lati.loro.breve, "Fiorentina");
  assert.equal(lati.inCasa, true);
  assert.equal(partitaInGrande({ ...inter, dalVivo: inter.prossime[0] }).perche, "dal-vivo");
  assert.equal(partitaInGrande({ ...inter, prossime: [] }).perche, "ultima");
  assert.equal(partitaInGrande({}), null);
});

test("calcio: la classifica attorno alla squadra, coi salti", () => {
  const prima = righeAttorno(inter.classifica, "110");
  assert.deepEqual(
    prima.map((r) => r.posizione),
    [1, 2, 3],
  );
  assert.equal(prima[0].mia, true);
  const decima = inter.classifica[9];
  const righe = righeAttorno(inter.classifica, decima.id);
  assert.deepEqual(
    righe.map((r) => (r.salto ? "…" : r.posizione)),
    [1, 2, 3, "…", 9, 10, 11],
  );
  assert.equal(righe.find((r) => r.mia).id, decima.id);
});

test("F1: la prossima sessione e il nome breve del gran premio", () => {
  const s = prossimaSessione(f1, SABATO);
  assert.ok(s);
  assert.ok(Date.parse(s.quando) + 2 * 3600_000 > SABATO);
  assert.equal(nomeBreveDelGp("Singapore Grand Prix"), "Singapore");
  assert.equal(nomeBreveDelGp("Grand Prix of Malaysia"), "Malaysia");
  assert.equal(nomeBreveDelGp("Gran Premio d'Italia"), "Italia");
});

test("F1 e MotoGP: il pilota del cuore e le barre delle classifiche", () => {
  const leclerc = rigaDelPreferito(f1.piloti, "leclerc");
  assert.equal(leclerc?.cognome, "Leclerc");
  assert.equal(rigaDelPreferito(f1.piloti, ""), null);
  const barre = quotaDelPrimo(f1.piloti);
  assert.equal(barre[0].quota, 1);
  assert.ok(barre.at(-1).quota < 1);
  assert.equal(rigaDelPreferito(moto.piloti, moto.piloti[2].id).posizione, 3);
});

test("oggi, domani, e quanto manca", () => {
  const adesso = new Date(2026, 9, 24, 21, 0).getTime();
  assert.equal(giornoDi(new Date(2026, 9, 24, 23, 0).toISOString(), adesso).quale, "oggi");
  assert.equal(giornoDi(new Date(2026, 9, 25, 0, 30).toISOString(), adesso).quale, "domani");
  assert.equal(giornoDi(new Date(2026, 9, 28, 18, 0).toISOString(), adesso).giorni, 4);
  assert.deepEqual(quantoManca(new Date(adesso + (26 * 60 + 5) * 60_000).toISOString(), adesso), {
    giorni: 1,
    ore: 2,
    minuti: 5,
  });
  assert.equal(quantoManca(new Date(adesso - 1).toISOString(), adesso), null);
});

test("si richiede ogni minuto con una partita vicina, ogni quarto d'ora se no", () => {
  const domaniMattina = Date.parse(inter.prossime[0].quando) - 60 * 60_000;
  assert.equal(fraQuantoSiRichiede([inter], domaniMattina), 60_000);
  assert.equal(fraQuantoSiRichiede([inter], SABATO), 15 * 60_000);
  assert.equal(fraQuantoSiRichiede([{ ...inter, dalVivo: inter.prossime[0] }], SABATO), 60_000);
});

test("la Home: prima la partita in corso, poi quello che c'e' oggi, poi il risultato fresco", () => {
  const dalVivo = inEvidenza([f1, { ...inter, dalVivo: inter.prossime[0] }], SABATO);
  assert.equal(dalVivo.cosa, "dal-vivo");
  /* Sabato sera alle 22: fra un'ora le qualifiche di Austin, che vengono
   * prima della sprint di MotoGP finita stamattina. */
  const sera = inEvidenza([inter, f1, moto], SABATO);
  assert.equal(sera.tipo, "f1");
  assert.equal(sera.cosa, "prossima");
  assert.equal(sera.sessione.sigla, "Q");
  /* Senza la F1, la sprint di oggi e' il risultato piu' fresco. */
  const senzaF1 = inEvidenza([inter, moto], SABATO);
  assert.equal(senzaF1.tipo, "motogp");
  assert.equal(senzaF1.cosa, "ultima");
  /* Domenica a mezzogiorno: la partita dell'Inter e' oggi. */
  const domenica = inEvidenza([f1, inter], Date.parse(inter.prossime[0].quando) - 2 * 3600_000);
  assert.equal(domenica.tipo, "calcio");
  assert.equal(domenica.cosa, "prossima");
  assert.equal(inEvidenza([{ tipo: "f1", errore: "non-risponde" }], SABATO), null);
  assert.equal(inEvidenza([], SABATO), null);
});
