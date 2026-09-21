/* «Possibilità di inserire prezzi diversi per fasce diverse, tipo 2 fasce
 * impostabile con orario o anche 3 fasce con la possibilità di scegliere se 2
 * o 3 fasce impostabili» (#72).
 *
 * Il kWh aveva un prezzo solo. Per chi ha un contratto a fasce quel numero è
 * una media inventata: la lavastoviglie delle undici di sera costa un terzo in
 * meno di quella delle quattro del pomeriggio, e una plancia che dice lo
 * stesso euro in tutte e due le ore sta dicendo il falso proprio nel momento
 * in cui uno la guarda per decidere.
 *
 * La riga che conta è la differenza fra ADESSO e un PERIODO: il prezzo di
 * adesso è esatto — si guarda l'ora — e quello di un mese no, perché la
 * plancia sa quanti kWh sono passati e non in che ore. Qui si tiene fermo che
 * le due risposte restino due, e che nessuna delle due venga spacciata per
 * l'altra.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  CHIAVE_FASCE,
  ORARI_DI_SERIE,
  QUANTE_FASCE,
  fasciaInVigore,
  leFasceValgono,
  minutiDellOra,
  normalizzaLeFasce,
  oraDeiMinuti,
  prezzoDellaFascia,
  prezzoMedioDelleFasce,
} from "../src/core/fasce-della-tariffa.js";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

/* Le tre fasce come le scrive la bolletta italiana: F1 di giorno, F2 la sera,
 * F3 la notte — e il fine settimana tutto in F3. */
const TRE = {
  quante: 3,
  voci: [
    { dalle: "08:00", prezzo: "0,35" },
    { dalle: "19:00", prezzo: 0.28 },
    { dalle: "23:00", prezzo: "0.20" },
  ],
  festivi: 2,
};

const mercoledi = (ora) => new Date(`2026-09-23T${ora}:00`);
const sabato = (ora) => new Date(`2026-09-26T${ora}:00`);

/* ── le ore ─────────────────────────────────────────────────────────────── */

test("un'ora si legge e si riscrive, e quello che non è un'ora non lo diventa", () => {
  assert.equal(minutiDellOra("08:30"), 510);
  assert.equal(minutiDellOra("0:00"), 0);
  assert.equal(minutiDellOra("23"), 1380);
  assert.equal(oraDeiMinuti(510), "08:30");
  assert.equal(oraDeiMinuti(0), "00:00");
  for (const storta of ["", "24:00", "8:60", "-1", "otto", null, undefined])
    assert.equal(minutiDellOra(storta), null, `«${storta}» non è un'ora`);
});

/* ── la configurazione ──────────────────────────────────────────────────── */

test("di serie le fasce sono spente: chi non le apre non si accorge di niente", () => {
  const spente = normalizzaLeFasce(null);
  assert.equal(spente.quante, 0);
  assert.deepEqual(spente.voci, []);
  assert.equal(leFasceValgono(spente), false);
  /* E se sono spente il prezzo è quello di sempre, qualunque ora sia. */
  assert.equal(prezzoDellaFascia(spente, 0.25, mercoledi("03")), 0.25);
  assert.equal(prezzoMedioDelleFasce(spente, 0.25), 0.25);
  /* Due o tre, e niente altro: «quattro» non è una scelta offerta. */
  assert.deepEqual(QUANTE_FASCE, [0, 2, 3]);
  assert.equal(normalizzaLeFasce({ quante: 4 }).quante, 0);
  assert.equal(normalizzaLeFasce({ quante: 2 }).voci.length, 2);
});

test("le fasce escono in ordine di ora, comunque siano state scritte", () => {
  const alla_rovescia = normalizzaLeFasce({
    quante: 3,
    voci: [
      { dalle: "23:00", prezzo: 0.2 },
      { dalle: "08:00", prezzo: 0.35 },
      { dalle: "19:00", prezzo: 0.28 },
    ],
  });
  assert.deepEqual(
    alla_rovescia.voci.map((voce) => [oraDeiMinuti(voce.dalle), voce.prezzo]),
    [
      ["08:00", 0.35],
      ["19:00", 0.28],
      ["23:00", 0.2],
    ],
  );
  /* Due fasce alla stessa ora sono una fascia sola scritta due volte: la
   * seconda si sposta di un minuto invece di sparire, così chi ha sbagliato
   * una casella la ritrova e la corregge. */
  const doppie = normalizzaLeFasce({
    quante: 2,
    voci: [{ dalle: "08:00" }, { dalle: "08:00" }],
  });
  assert.equal(oraDeiMinuti(doppie.voci[0].dalle), "08:00");
  assert.equal(oraDeiMinuti(doppie.voci[1].dalle), "08:01");
});

test("una casella vuota non diventa una fascia a zero euro", () => {
  /* Lo zero non vince, come per la tariffa unica: il salvataggio non lo scrive
   * mai apposta, e una fascia a zero farebbe sembrare gratis un'ora di
   * corrente. La fascia resta, il prezzo cade su quello unico. */
  const monca = normalizzaLeFasce({
    quante: 2,
    voci: [{ dalle: "08:00", prezzo: "" }, { dalle: "19:00", prezzo: "0" }],
  });
  assert.equal(monca.voci[0].prezzo, null);
  assert.equal(monca.voci[1].prezzo, null);
  assert.equal(leFasceValgono(monca), false);
  assert.equal(prezzoDellaFascia(monca, 0.25, mercoledi("10")), 0.25);

  /* E una sola riempita basta a far valere le fasce: l'altra ora resta al
   * prezzo di sempre. */
  const mezza = normalizzaLeFasce({
    quante: 2,
    voci: [{ dalle: "08:00", prezzo: 0.4 }, { dalle: "19:00" }],
  });
  assert.equal(leFasceValgono(mezza), true);
  assert.equal(prezzoDellaFascia(mezza, 0.25, mercoledi("10")), 0.4);
  assert.equal(prezzoDellaFascia(mezza, 0.25, mercoledi("20")), 0.25);
});

test("le ore di serie sono quelle che stanno in bolletta", () => {
  assert.deepEqual(ORARI_DI_SERIE[2], ["08:00", "19:00"]);
  assert.deepEqual(ORARI_DI_SERIE[3], ["08:00", "19:00", "23:00"]);
  /* Una fascia senza ora non nasce a mezzanotte per caso: prende la sua. */
  const vuote = normalizzaLeFasce({ quante: 3, voci: [{}, {}, {}] });
  assert.deepEqual(
    vuote.voci.map((voce) => oraDeiMinuti(voce.dalle)),
    ["08:00", "19:00", "23:00"],
  );
});

/* ── quale vale adesso ──────────────────────────────────────────────────── */

test("vale l'ultima fascia già cominciata, e prima della prima c'è la notte", () => {
  const tre = normalizzaLeFasce(TRE);
  assert.equal(fasciaInVigore(tre, mercoledi("10")), 0);
  assert.equal(fasciaInVigore(tre, mercoledi("19")), 1);
  assert.equal(fasciaInVigore(tre, mercoledi("22:59")), 1);
  assert.equal(fasciaInVigore(tre, mercoledi("23")), 2);
  /* Le due di notte sono ancora la fascia della sera prima: fra le due c'è la
   * mezzanotte, e la fascia che comincia alle 23 finisce alle 8. */
  assert.equal(fasciaInVigore(tre, mercoledi("02")), 2);
  assert.equal(fasciaInVigore(tre, mercoledi("07:59")), 2);
  assert.equal(prezzoDellaFascia(tre, 0.25, mercoledi("02")), 0.2);
  assert.equal(prezzoDellaFascia(tre, 0.25, mercoledi("10")), 0.35);
});

test("sabato e domenica l'ora non conta, quando la regola c'è", () => {
  const tre = normalizzaLeFasce(TRE);
  /* Le dieci di sabato mattina sarebbero F1: in Italia il weekend sta tutto
   * in F3, e senza questa regola il sabato verrebbe contato come mercoledì. */
  assert.equal(fasciaInVigore(tre, sabato("10")), 2);
  assert.equal(prezzoDellaFascia(tre, 0.25, sabato("10")), 0.2);
  /* Senza la regola, invece, il sabato è un giorno come gli altri. */
  const senza = normalizzaLeFasce({ ...TRE, festivi: -1 });
  assert.equal(senza.festivi, -1);
  assert.equal(fasciaInVigore(senza, sabato("10")), 0);
  /* E una regola che punta a una fascia che non esiste non vale. */
  assert.equal(normalizzaLeFasce({ ...TRE, quante: 2, festivi: 2 }).festivi, -1);
});

/* ── il periodo ─────────────────────────────────────────────────────────── */

test("su un periodo è una media pesata sulle ore, non il prezzo di adesso", () => {
  const tre = normalizzaLeFasce(TRE);
  /* Feriale: 11 ore a 0,35 (8→19), 4 a 0,28 (19→23), 9 a 0,20 (23→8). */
  const feriale = (11 * 0.35 + 4 * 0.28 + 9 * 0.2) / 24;
  /* E il fine settimana entra per quello che è, due giorni su sette: senza,
   * chi ha la regola dei festivi si troverebbe una media da giorni feriali
   * spacciata per media della settimana. */
  const attesa = (feriale * 5 + 0.2 * 2) / 7;
  assert.ok(Math.abs(prezzoMedioDelleFasce(tre, 0.25) - attesa) < 1e-9);
  /* Ed è diversa dal prezzo di una qualunque delle ore: è il punto. */
  for (const ora of ["10", "20", "02"])
    assert.notEqual(prezzoMedioDelleFasce(tre, 0.25), prezzoDellaFascia(tre, 0.25, mercoledi(ora)));

  /* Senza regola dei festivi, la media è quella del giorno feriale. */
  const senza = normalizzaLeFasce({ ...TRE, festivi: -1 });
  assert.ok(Math.abs(prezzoMedioDelleFasce(senza, 0.25) - feriale) < 1e-9);
});

test("una fascia senza prezzo pesa col prezzo unico, non con zero", () => {
  const mezza = normalizzaLeFasce({
    quante: 2,
    voci: [{ dalle: "00:00", prezzo: 0.4 }, { dalle: "12:00" }],
  });
  /* Dodici ore a 0,40 e dodici al prezzo di sempre. Contarla zero vorrebbe
   * dire dimezzare la bolletta per una casella lasciata vuota. */
  assert.ok(Math.abs(prezzoMedioDelleFasce(mezza, 0.2) - 0.3) < 1e-9);
});

/* ── chi le usa ─────────────────────────────────────────────────────────── */

test("il ciclo usa l'ora, il Report usa la media: due domande, due risposte", () => {
  /* Un ciclo è successo a un'ora precisa, e il conto giusto è il prezzo di
   * quell'ora: è la differenza fra dire «la lavastoviglie di stanotte è
   * costata 0,20» e dire «0,26», che è poi il motivo per cui uno la fa
   * partire di notte. */
  const ciclo = leggi("sections/appliance-showcase-section.js");
  assert.match(ciclo, /prezzoDellaFascia\(normalizzaLeFasce\(readJson\(CHIAVE_FASCE, \{\}\)\)/);
  assert.ok(!ciclo.includes("prezzoMedioDelleFasce"), "il ciclo non fa medie");
  /* E senza prezzo unico non inventa niente: il costo del ciclo non si mostra. */
  assert.match(ciclo, /if \(unico === null\) return null;/);

  /* Il Report parla di mesi e di anni: lì è la media pesata, e viene dallo
   * stesso modulo di quella della sezione Energia — due medie sulla stessa
   * bolletta sarebbero due bollette. */
  for (const nome of ["sections/energy-section.js", "sections/energy-report-polish-section.js"]) {
    const fonte = leggi(nome);
    assert.match(fonte, /prezzoMedioDelleFasce\(normalizzaLeFasce\(readJson\(CHIAVE_FASCE, \{\}\)\)/);
    assert.ok(!fonte.includes("prezzoDellaFascia("), `${nome} non usa l'ora per un periodo`);
  }

  /* Le fasce valgono sull'acquisto e non sulla vendita: quello che si vende si
   * vende allo stesso prezzo a qualunque ora. */
  assert.match(
    leggi("sections/energy-report-polish-section.js"),
    /if \(key !== "cd_costo_kwh"\) return unico;/,
  );
});

test("la configurazione viaggia con la casa, e la scheda ha le caselle", () => {
  /* Un contratto è della casa, non del telefono da cui è stato scritto. */
  assert.equal(CHIAVE_FASCE, "cd_fasce_kwh");
  assert.match(leggi("core/chiavi-di-configurazione.js"), /"cd_fasce_kwh",/);

  const scheda = leggi("sections/beta22-load-slots-hotfix-section.js");
  for (const casella of [
    "data-dm-fasce-quante",
    "data-dm-fascia-dalle",
    "data-dm-fascia-prezzo",
    "data-dm-fasce-festivi",
  ])
    assert.ok(scheda.includes(casella), `manca la casella «${casella}»`);
  /* Si salvano col tasto dei costi, che è la stessa domanda: un tasto «salva»
   * che ne salvasse metà sarebbe peggio di due tasti. */
  assert.match(leggi("sections/energy-report-polish-section.js"), /salvaLeFasceDellaScheda\(\);/);
});
