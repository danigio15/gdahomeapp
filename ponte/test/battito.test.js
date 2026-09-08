/* Il filo col centralino, quando muore senza cadere.
 *
 * E' il guasto che si vede in casa e non nelle prove: fra il ponte e il
 * centralino c'e' un router, e un router tiene la sua corrispondenza finche'
 * passa qualcosa. Dopo qualche minuto di silenzio quella riga sparisce, i
 * pacchetti non tornano piu' indietro, e **nessuno dei due capi riceve una
 * chiusura**: il ponte resta convinto d'essere collegato e da fuori casa
 * l'app non entra piu'.
 *
 * Qui il filo non si chiude: semplicemente smette di rispondere. Il ponte
 * deve accorgersene da solo e richiamare.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Chiamata } from "../src/chiamata.js";

/* Una presa che non chiude niente e non risponde a niente: il filo morto. */
class PresaFinta extends EventTarget {
  static aperte = [];

  constructor(dove) {
    super();
    this.dove = dove;
    this.mandati = [];
    this.chiusa = false;
    /* Le risposte del centralino: chi vuole un centralino muto lascia stare. */
    this.rispondi = null;
    PresaFinta.aperte.push(this);
    queueMicrotask(() => this.dispatchEvent(new Event("open")));
  }

  send(testo) {
    this.mandati.push(testo);
    const risposta = this.rispondi?.(testo);
    if (risposta === undefined || risposta === null) return;
    queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", { data: risposta })));
  }

  close() {
    if (this.chiusa) return;
    this.chiusa = true;
    queueMicrotask(() => this.dispatchEvent(new Event("close")));
  }
}

const identita = { casa: "casa_prova", segreto: "un-segreto" };
const muto = { info() {}, attenzione() {}, errore() {} };

function unCentralinoChe(_ignorato, registro = muto) {
  PresaFinta.aperte = [];
  const chiamata = new Chiamata({
    dove: "wss://centralino.finto",
    identita,
    portiere: { accogli() {} },
    registro,
    Presa: PresaFinta,
    /* Tempi da prova: si aspetta millesimi, non minuti. */
    battito: 10,
    silenzioMassimo: 30,
    attesaMassima: 20,
  });
  chiamata.avvia();
  return chiamata;
}

/* Fa entrare la chiamata. `risponde` decide, colpetto per colpetto, se il
 * centralino risponde: cosi' una prova puo' farlo tacere a meta' strada. */
async function entra(chiamata, risponde) {
  const presa = PresaFinta.aperte.at(-1);
  presa.rispondi = (testo) => {
    const detto = JSON.parse(testo);
    if (detto.t === "sono-io") return JSON.stringify({ t: "bene" });
    if (detto.t === "battito" && risponde()) return testo;
    return null;
  };
  await respira(5);
  assert.equal(chiamata.dentro, true, "doveva essere entrata");
  return presa;
}

const respira = (quanto) => new Promise((r) => setTimeout(r, quanto));

test("un centralino che risponde ai colpetti tiene il filo su", async () => {
  const chiamata = unCentralinoChe();
  const presa = await entra(chiamata, () => true);

  await respira(80);

  assert.equal(chiamata.dentro, true, "il filo doveva restare su");
  assert.equal(presa.chiusa, false, "non c'era niente da chiudere");
  assert.ok(
    presa.mandati.filter((m) => m.includes("battito")).length >= 3,
    "i colpetti dovevano continuare a partire",
  );
  chiamata.spegni();
});

test("un filo che smette di rispondere si chiude, e si richiama", async () => {
  const chiamata = unCentralinoChe();
  /* Prima risponde — cosi' si sa che quel centralino saprebbe farlo — e poi
   * tace, come farebbe un router che ha buttato via la sua riga. Non chiude
   * niente: e' tutto il punto. */
  let risponde = true;
  const primaPresa = await entra(chiamata, () => risponde);
  await respira(30);
  risponde = false;

  await respira(150);

  assert.equal(primaPresa.chiusa, true, "il filo morto doveva essere chiuso");
  assert.ok(PresaFinta.aperte.length > 1, "il ponte doveva ribussare al centralino");
  chiamata.spegni();
});

test("un centralino vecchio, che ai colpetti non risponde mai, non si butta giu'", async () => {
  /* Un ponte aggiornato accanto a un centralino da aggiornare deve funzionare
   * come funzionava, non peggio: scambiare «non sa rispondere» per «e' morto»
   * vorrebbe dire ribussargli addosso per sempre. */
  const detto = [];
  const chiamata = unCentralinoChe(undefined, {
    info() {},
    attenzione(cosa) {
      detto.push(cosa);
    },
    errore() {},
  });
  const presa = await entra(chiamata, () => false);

  await respira(150);

  assert.equal(chiamata.dentro, true, "il filo doveva restare su");
  assert.equal(presa.chiusa, false, "non c'era niente da chiudere");
  assert.equal(PresaFinta.aperte.length, 1, "non si doveva ribussare");
  assert.ok(
    detto.some((riga) => riga.includes("versione vecchia")),
    `doveva dirlo una volta, invece ha detto: ${JSON.stringify(detto)}`,
  );
  chiamata.spegni();
});
