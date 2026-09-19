/* Le prove dell'avviso quando una casa tace.
 *
 * Quello che si prova davvero e' il contrario di quello che sembra: non che
 * l'avviso parta — quello lo farebbe anche una riga che manda sempre — ma che
 * **stia zitto** nei quattro casi in cui deve.
 *
 *  1. una casa offline da tre giorni e' una notizia, non una al giorno;
 *  2. otto case su dodici insieme sono un guasto, non otto;
 *  3. se il quadro e' stato fermo, il silenzio e' il nostro e non il loro;
 *  4. se la consegna non riesce, la casa resta da avvisare — se no un indirizzo
 *     sbagliato per mezz'ora si mangia per sempre gli avvisi di quella mezz'ora.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chiTace, cosaDire, siamoStatiViaNoi, TACE_DOPO } from "../src/avvisi.js";
import { CaseSeguite } from "../src/case.js";
import { Giro } from "../src/giro.js";
import { Installatori } from "../src/installatori.js";

const ORA = Date.parse("2026-09-18T14:00:00Z");
const MINUTO = 60 * 1000;

const unaCasa = (nome, minutiFa, avvisataIl = null) => ({
  casa: `casa_${String(nome).padEnd(32, "0").slice(0, 32)}`,
  nome,
  avvisataIl,
  carta: { quando: new Date(ORA - minutiFa * MINUTO).toISOString() },
});

/* ─── Le regole, senza niente acceso ───────────────────────────────────── */

test("sotto le due ore non si dice niente: un riavvio non e' un guasto", () => {
  /* La pagina chiama «offline» una casa dopo tre quarti d'ora, e va bene per un
   * colore. Un messaggio che arriva addosso a qualcuno vuole piu' pazienza:
   * un riavvio di Home Assistant, un aggiornamento e un router che si riaccende
   * ci stanno tutti dentro. */
  const { offline } = chiTace([unaCasa("Rossi", 100)], { adesso: ORA });
  assert.equal(offline.length, 0);
  assert.equal(chiTace([unaCasa("Rossi", TACE_DOPO + 1)], { adesso: ORA }).offline.length, 1);
});

test("una casa offline da tre giorni e' una notizia sola", () => {
  const gia = unaCasa("Rossi", 3 * 24 * 60, ORA - 3 * 24 * 60 * MINUTO);
  assert.equal(chiTace([gia], { adesso: ORA }).offline.length, 0, "l'ha ridetto");
});

test("quando torna a parlare lo si dice, e ci si dimentica", () => {
  /* Senza questo messaggio qualcuno prende la macchina per una casa che si e'
   * rimessa a posto da sola mentre lui era in strada. */
  const tornata = unaCasa("Rossi", 2, ORA - 5 * 60 * MINUTO);
  const { offline, tornate } = chiTace([tornata], { adesso: ORA });
  assert.equal(offline.length, 0);
  assert.equal(tornate.length, 1);
  assert.match(cosaDire({ offline, tornate, quante: 1 })[0].testo, /ha ripreso a parlare/);
});

test("otto case su dodici insieme sono un guasto, e si manda un messaggio solo", () => {
  const tante = [];
  for (let n = 0; n < 8; n += 1) tante.push(unaCasa(`giu${n}`, 200));
  for (let n = 0; n < 4; n += 1) tante.push(unaCasa(`su${n}`, 5));

  const detti = cosaDire({ ...chiTace(tante, { adesso: ORA }), quante: 12 });
  assert.equal(detti.length, 1, "ne ha mandati otto");
  assert.equal(detti[0].tipo, "insieme");
  assert.equal(detti[0].case.length, 8, "il messaggio non le nomina tutte");
  assert.match(detti[0].testo, /non è colpa loro/);
});

test("due case su venti restano due notizie: non tutto insieme e' un guasto grande", () => {
  const tante = [unaCasa("giu1", 200), unaCasa("giu2", 200)];
  for (let n = 0; n < 18; n += 1) tante.push(unaCasa(`su${n}`, 5));
  const detti = cosaDire({ ...chiTace(tante, { adesso: ORA }), quante: 20 });
  assert.equal(detti.length, 2);
  assert.ok(detti.every((uno) => uno.tipo === "offline"));
});

test("se il quadro e' stato fermo, il silenzio e' il nostro", () => {
  /* La regola che nessuno scrive e che poi si paga: al ritorno da tre ore di
   * fermo **tutte** le case sembrano offline, perche' nessuno era in ascolto. */
  assert.equal(siamoStatiViaNoi(ORA - 5 * MINUTO, ORA), false, "un giro normale");
  assert.equal(siamoStatiViaNoi(ORA - 5 * 60 * MINUTO, ORA), true, "tre ore di fermo");
  assert.equal(siamoStatiViaNoi(null, ORA), true, "il primo giro dopo l'accensione");
});

/* ─── Il giro, con archivi veri ────────────────────────────────────────── */

function banco({ dove = "https://esempio.it/avvisi", accetta = true } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), "quadro-avvisi-"));
  let ora = ORA;
  const adesso = () => ora;
  const case_ = new CaseSeguite({ cartella, adesso });
  const installatori = new Installatori({ cartella, adesso });
  const { chi } = installatori.fai({ nome: "Impianti Rossi" });
  if (dove) installatori.doveAvvisare(chi, dove);

  const mandati = [];
  const giro = new Giro({
    case: case_,
    installatori,
    fattorino: {
      porta: async (a, detto) => {
        if (!accetta) return false;
        mandati.push(detto);
        return true;
      },
    },
    adesso,
  });

  return {
    case: case_,
    installatori,
    chi,
    giro,
    mandati,
    vai: (quanto) => {
      ora += quanto;
    },
    /* Una casa che ha depositato `minutiFa` minuti fa. */
    deposita: (nome, minutiFa = 0) =>
      case_.deposita(
        `casa_${String(nome).padEnd(32, "0").slice(0, 32)}`,
        { quando: new Date(ora - minutiFa * MINUTO).toISOString(), ogni: 15 },
        chi,
      ),
    chiudi: () => rmSync(cartella, { recursive: true, force: true }),
  };
}

test("il primo giro dopo l'accensione non sveglia nessuno", async () => {
  const b = banco();
  try {
    b.deposita("vecchia", 5 * 60);
    assert.equal(await b.giro.passa(), 0, "ha avvisato al primo giro");
    assert.equal(b.mandati.length, 0);
  } finally {
    b.chiudi();
  }
});

test("al giro dopo, una casa offline si dice una volta e poi non piu'", async () => {
  const b = banco();
  try {
    b.deposita("rossi", 0);
    await b.giro.passa();

    b.vai(5 * 60 * MINUTO);
    /* Cinque ore di buco fra un giro e l'altro sarebbero «siamo stati via
     * noi». Si passa piu' spesso, come fa il giro vero. */
    for (let n = 0; n < 5; n += 1) {
      await b.giro.passa();
      b.vai(60 * MINUTO);
    }
    assert.equal(b.mandati.length, 1, `mandati ${b.mandati.length} invece di uno`);
    assert.match(b.mandati[0].testo, /non parla più/);
  } finally {
    b.chiudi();
  }
});

test("se la consegna non riesce, la casa resta da avvisare", async () => {
  /* Il segno si mette **dopo** la consegna e solo se e' riuscita: scriverlo
   * prima vorrebbe dire che un indirizzo sbagliato per mezz'ora si mangia gli
   * avvisi di quella mezz'ora per sempre. */
  const b = banco({ accetta: false });
  try {
    b.deposita("rossi", 0);
    await b.giro.passa();
    b.vai(3 * 60 * MINUTO);
    await b.giro.passa();

    const una = b.case.quella(`casa_${"rossi".padEnd(32, "0")}`);
    assert.equal(una.avvisataIl, null, "si e' segnata avvisata senza che l'avviso partisse");
  } finally {
    b.chiudi();
  }
});

test("chi non ha detto dove vuole gli avvisi non riceve niente", async () => {
  const b = banco({ dove: "" });
  try {
    b.deposita("rossi", 0);
    await b.giro.passa();
    b.vai(3 * 60 * MINUTO);
    await b.giro.passa();
    assert.equal(b.mandati.length, 0);
  } finally {
    b.chiudi();
  }
});

test("dopo un fermo lungo il giro si rimette in pari senza dire niente", async () => {
  const b = banco();
  try {
    b.deposita("rossi", 0);
    await b.giro.passa();

    /* Il quadro resta fermo sei ore: al ritorno la casa non parla da sei ore,
     * ma il silenzio e' il nostro. */
    b.vai(6 * 60 * MINUTO);
    assert.equal(await b.giro.passa(), 0, "ha avvisato per un fermo suo");

    /* E dal giro dopo riprende a guardare davvero. */
    b.vai(30 * MINUTO);
    await b.giro.passa();
    assert.equal(b.mandati.length, 1);
  } finally {
    b.chiudi();
  }
});
