/* I piani della casa (#17).
 *
 * «Home assistant non mi interessa, mi interessa gestire in maniera puntuale i
 *  piani nella dashboard.»
 *
 * Qui si prova la parte che non tocca né il documento né il deposito: entrano i
 * piani salvati, le stanze e i segni, ed escono i piani salvati, le stanze e i
 * segni. Il giro al deposito lo fa la sezione.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  NOME_GIA_PRESO,
  NOME_VUOTO,
  PIANO_SCONOSCIUTO,
  QUANTI_PIANI,
  SEGNO_DI_SERIE,
  TROPPI_PIANI,
  aggiungiIlPiano,
  cancellaIlPiano,
  iPianiDellaCasa,
  nomiDeiPiani,
  ordinaLeStanzePerPiano,
  rinominaIlPiano,
  segnaIlPiano,
  segnoDelPiano,
  spostaIlPiano,
  stanzeSenzaPiano,
  stessoOrdine,
} from "../src/core/i-piani-della-casa.js";

const PIANI = ["Piano terra", "Primo piano"];
const STANZE = [
  { id: "room_a", name: "Cucina", floor: "Piano terra" },
  { id: "room_b", name: "Salone", floor: "Piano terra" },
  { id: "room_c", name: "Bagno", floor: "Piano terra" },
  { id: "room_d", name: "Camera", floor: "Primo piano" },
  { id: "room_e", name: "Bagno", floor: "Primo piano" },
  { id: "room_f", name: "Studio" },
];

/* ── l'elenco ───────────────────────────────────────────────────────────── */

test("i piani escono nell'ordine dichiarato, con dentro le loro stanze", () => {
  const piani = iPianiDellaCasa(PIANI, STANZE, {});
  assert.deepEqual(
    piani.map((piano) => [piano.nome, piano.stanze.length]),
    [
      ["Piano terra", 3],
      ["Primo piano", 2],
    ],
  );
  /* Lo Studio non sta in nessun piano: sta di là, e si chiede a parte. */
  assert.deepEqual(
    stanzeSenzaPiano(STANZE).map((stanza) => stanza.name),
    ["Studio"],
  );
});

test("un piano scritto solo addosso a una stanza va in fondo, non in ordine alfabetico", () => {
  /* Un alfabeto metterebbe la Mansarda prima del Piano terra, che è il
   * contrario di come si sale le scale. Chi non è dichiarato è arrivato dopo,
   * e in fondo ci sta. */
  const stanze = [...STANZE, { id: "room_g", name: "Soffitta", floor: "Mansarda" }];
  const piani = iPianiDellaCasa(PIANI, stanze, {});
  assert.deepEqual(
    piani.map((piano) => piano.nome),
    ["Piano terra", "Primo piano", "Mansarda"],
  );
  assert.deepEqual(
    piani.map((piano) => piano.dichiarato),
    [true, true, false],
  );
});

test("un piano dichiarato e rimasto vuoto resta nell'elenco", () => {
  /* È stato creato: sparire sarebbe sembrare cancellato, e chi l'ha appena
   * fatto penserebbe che il tasto non funzioni. */
  const piani = iPianiDellaCasa([...PIANI, "Mansarda"], STANZE, {});
  assert.equal(piani.at(-1).nome, "Mansarda");
  assert.equal(piani.at(-1).stanze.length, 0);
});

test("i nomi si ripuliscono: niente vuoti, niente doppioni", () => {
  assert.deepEqual(nomiDeiPiani(["  Piano terra ", "", "Piano terra", null, "Primo piano"]), [
    "Piano terra",
    "Primo piano",
  ]);
  assert.deepEqual(nomiDeiPiani(null), []);
});

/* ── il segno ───────────────────────────────────────────────────────────── */

test("un piano senza icona scelta porta quella di serie, e lo dichiara", () => {
  const piani = iPianiDellaCasa(PIANI, STANZE, { "Primo piano": "🪜" });
  assert.deepEqual(
    piani.map((piano) => [piano.segno, piano.suo]),
    [
      [SEGNO_DI_SERIE, false],
      ["🪜", true],
    ],
  );
  assert.equal(segnoDelPiano({}, "Boh"), SEGNO_DI_SERIE);
});

test("il segno si mette e si toglie", () => {
  const con = segnaIlPiano({}, "Piano terra", "🏠");
  assert.deepEqual(con, { "Piano terra": "🏠" });
  assert.deepEqual(segnaIlPiano(con, "Piano terra", ""), {});
  /* Senza un piano non si scrive niente invece di scrivere sotto la chiave
   * vuota. */
  assert.deepEqual(segnaIlPiano(con, "", "🏠"), con);
});

/* ── l'ordine ───────────────────────────────────────────────────────────── */

test("un piano sale e scende di un posto", () => {
  assert.deepEqual(spostaIlPiano(PIANI, "Primo piano", -1), ["Primo piano", "Piano terra"]);
  assert.deepEqual(spostaIlPiano(PIANI, "Piano terra", 1), ["Primo piano", "Piano terra"]);
});

test("fuori dai bordi non succede niente, e non è un errore", () => {
  /* È il tasto ▲ del primo della fila: va disattivato, ma se qualcuno ci
   * arriva lo stesso non deve rompere l'elenco. */
  assert.deepEqual(spostaIlPiano(PIANI, "Piano terra", -1), PIANI);
  assert.deepEqual(spostaIlPiano(PIANI, "Primo piano", 1), PIANI);
  assert.deepEqual(spostaIlPiano(PIANI, "Mansarda", -1), PIANI);
});

/* ── nascere, cambiare nome, morire ─────────────────────────────────────── */

test("un piano nuovo va in fondo: una casa si costruisce dal basso", () => {
  assert.deepEqual(aggiungiIlPiano(PIANI, "Mansarda").piani, [...PIANI, "Mansarda"]);
  assert.equal(aggiungiIlPiano(PIANI, "  ").errore, NOME_VUOTO);
  assert.equal(aggiungiIlPiano(PIANI, "Primo piano").errore, NOME_GIA_PRESO);
  const troppi = Array.from({ length: QUANTI_PIANI }, (_, indice) => `P${indice}`);
  assert.equal(aggiungiIlPiano(troppi, "Uno di troppo").errore, TROPPI_PIANI);
});

test("rinominare un piano si porta dietro le sue stanze e il suo segno", () => {
  /* Senza questo, le stanze resterebbero su un piano che non esiste più e il
   * segno appeso a un nome morto: è la ragione per cui la rinomina restituisce
   * tutte e tre le cose insieme. */
  const esito = rinominaIlPiano(PIANI, STANZE, { "Primo piano": "🪜" }, "Primo piano", "Piano 1");
  assert.deepEqual(esito.piani, ["Piano terra", "Piano 1"]);
  assert.deepEqual(esito.segni, { "Piano 1": "🪜" });
  assert.equal(esito.quante, 2);
  assert.deepEqual(
    esito.stanze.filter((stanza) => stanza.floor === "Piano 1").map((stanza) => stanza.name),
    ["Camera", "Bagno"],
  );
  assert.equal(esito.stanze.some((stanza) => stanza.floor === "Primo piano"), false);
});

test("due piani con lo stesso nome sarebbero un piano solo: si rifiuta invece di fondere", () => {
  /* Fondere due piani sposta delle stanze, e nessuno l'ha chiesto. */
  assert.equal(rinominaIlPiano(PIANI, STANZE, {}, "Primo piano", "Piano terra").errore, NOME_GIA_PRESO);
  assert.equal(rinominaIlPiano(PIANI, STANZE, {}, "Primo piano", "").errore, NOME_VUOTO);
  assert.equal(rinominaIlPiano(PIANI, STANZE, {}, "Mansarda", "Sottotetto").errore, PIANO_SCONOSCIUTO);
});

test("cambiare le maiuscole allo stesso nome si può: è la correzione che stai facendo", () => {
  const esito = rinominaIlPiano(PIANI, STANZE, {}, "Primo piano", "Primo Piano");
  assert.deepEqual(esito.piani, ["Piano terra", "Primo Piano"]);
  assert.equal(esito.quante, 2);
});

test("rinominare un piano che esiste solo addosso a una stanza lo dichiara", () => {
  const stanze = [...STANZE, { id: "room_g", name: "Soffitta", floor: "Mansarda" }];
  const esito = rinominaIlPiano(PIANI, stanze, {}, "Mansarda", "Sottotetto");
  assert.deepEqual(esito.piani, [...PIANI, "Sottotetto"]);
  assert.equal(esito.stanze.at(-1).floor, "Sottotetto");
});

test("cancellare un piano lascia le sue stanze senza piano, e dice quante sono", () => {
  /* Cancellare un piano vuol dire «questo piano non esiste», non «queste
   * stanze non esistono»: chi tocca un cestino in fondo a un elenco di piani
   * non si aspetta di perdere il salone. */
  const esito = cancellaIlPiano(PIANI, STANZE, { "Piano terra": "🏠" }, "Piano terra");
  assert.deepEqual(esito.piani, ["Primo piano"]);
  assert.deepEqual(esito.segni, {});
  assert.equal(esito.quante, 3);
  assert.equal(esito.stanze.length, STANZE.length);
  assert.deepEqual(
    stanzeSenzaPiano(esito.stanze).map((stanza) => stanza.name),
    ["Cucina", "Salone", "Bagno", "Studio"],
  );
  /* La casella se ne va del tutto: una stanza con `floor: ""` e una senza
   * devono essere la stessa cosa per chi legge. */
  assert.equal("floor" in esito.stanze[0], false);
});

test("le stanze che non erano sue non si toccano", () => {
  const esito = cancellaIlPiano(PIANI, STANZE, {}, "Piano terra");
  const camera = esito.stanze.find((stanza) => stanza.name === "Camera");
  assert.equal(camera.floor, "Primo piano");
  assert.equal(camera, STANZE[3], "la stanza è proprio la stessa, non una copia");
});

/* ── l'ordine salvato ───────────────────────────────────────────────────── */

test("le stanze si rimettono in fila per piano, e dentro il piano restano come stavano", () => {
  /* Serve perché la scheda del Config e la pagina Stanze raccontino la stessa
   * cosa, e per una ragione meno visibile: le frecce ▲▼ di ogni stanza il
   * guscio le numera dalla posizione nel DOCUMENTO. Raggruppare le righe a
   * schermo senza toccare l'elenco salvato vorrebbe dire una matita che apre
   * la stanza sbagliata. */
  const sparse = [STANZE[0], STANZE[3], STANZE[1], STANZE[5], STANZE[4], STANZE[2]];
  const messe = ordinaLeStanzePerPiano(sparse, PIANI);
  assert.deepEqual(
    messe.map((stanza) => `${stanza.name}/${stanza.floor || "—"}`),
    [
      "Cucina/Piano terra",
      "Salone/Piano terra",
      "Bagno/Piano terra",
      "Camera/Primo piano",
      "Bagno/Primo piano",
      "Studio/—",
    ],
  );
  /* Le stanze sono proprio le stesse, non delle copie: chi confronta gli
   * ordini lo fa per identità. */
  assert.equal(messe[0], STANZE[0]);
});

test("rifare l'ordine su un elenco già in ordine non cambia niente", () => {
  /* È la condizione perché chi salva solo quando cambia non salvi mai due
   * volte — e quindi non si riscriva la configurazione a ogni apertura. */
  const messe = ordinaLeStanzePerPiano(STANZE, PIANI);
  assert.equal(stessoOrdine(messe, ordinaLeStanzePerPiano(messe, PIANI)), true);
  assert.equal(stessoOrdine(STANZE, messe), true);
});

test("un piano che l'elenco non dichiara va in fondo, ma prima di chi non ne ha", () => {
  const stanze = [{ name: "Soffitta", floor: "Mansarda" }, ...STANZE];
  const messe = ordinaLeStanzePerPiano(stanze, PIANI);
  assert.deepEqual(
    messe.map((stanza) => stanza.name),
    ["Cucina", "Salone", "Bagno", "Camera", "Bagno", "Soffitta", "Studio"],
  );
});

test("due elenchi diversi non sono lo stesso ordine", () => {
  assert.equal(stessoOrdine(STANZE, STANZE.slice(1)), false);
  assert.equal(stessoOrdine(STANZE, [...STANZE].reverse()), false);
  assert.equal(stessoOrdine(null, null), true);
});
