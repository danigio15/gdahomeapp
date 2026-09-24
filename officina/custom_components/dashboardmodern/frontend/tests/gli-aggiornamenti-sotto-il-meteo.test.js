/* «Credo che con aggiornamenti da eseguire il testo dovrebbe essere
 * "Aggiornamenti pendenti" e magari potrebbe accendere in home in alto
 * direttamente magari nella barra sotto il meteo?» (#108)
 *
 * Due cose, e sono la stessa: la tessera esiste solo quando c'è qualcosa da
 * fare — «Aggiornamenti: 0» occuperebbe un posto per dire che non è successo
 * niente — ma si chiamava col nome di una sezione invece che con quello di una
 * notizia. E la notizia si vedeva solo scorrendo fino alla griglia.
 *
 * Adesso la tessera dice «Aggiornamenti pendenti», e la fascia sotto il meteo
 * ha la sua voce, in fondo alle notizie: un aggiornamento è qualcosa che è
 * successo, come una cartuccia agli sgoccioli, ma è l'ultima delle notizie
 * perché si fa con calma. Rossa non diventa mai.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { VOCI_DELLA_BARRA, pastiglieDellaCasa } from "../src/core/come-sta-la-casa.js";

const leggi = (nome) => readFileSync(new URL(`../src/${nome}`, import.meta.url), "utf8");

/* Il modello della tessera in Home, come lo fa `aggiornamentiModel`. */
const MODELLO = {
  key: "aggiornamenti",
  accent: "#d97706",
  icon: "⬆️",
  attiva: true,
  value: "2",
  aggiornamenti: [
    { entity: "update.gdahome", nome: "gdahome", a: "1.6.5", nostra: true },
    { entity: "update.mosquitto", nome: "Mosquitto broker", a: "6.5.1", nostra: false },
  ],
};

test("la fascia ha una voce per gli aggiornamenti, ultima fra le notizie", () => {
  const chiavi = VOCI_DELLA_BARRA.map((voce) => voce.chiave);
  assert.ok(chiavi.includes("aggiornamenti"));
  /* Dopo le stampanti — è successo qualcosa — e prima delle luci, che sono
   * cose rimaste accese e non notizie. */
  assert.ok(chiavi.indexOf("aggiornamenti") > chiavi.indexOf("stampanti"));
  assert.ok(chiavi.indexOf("aggiornamenti") < chiavi.indexOf("luci"));
  assert.equal(
    VOCI_DELLA_BARRA.find((voce) => voce.chiave === "aggiornamenti").tessera,
    "aggiornamenti",
  );
});

test("con qualcosa da fare la pastiglia compare, col conto della tessera", () => {
  const [pastiglia, ...altre] = pastiglieDellaCasa([MODELLO]);
  assert.deepEqual(altre, []);
  assert.equal(pastiglia.chiave, "aggiornamenti");
  assert.equal(pastiglia.id, "aggiornamenti");
  assert.equal(pastiglia.conto, 2);
  assert.equal(pastiglia.tinta, "#d97706");
  assert.equal(pastiglia.icona, "⬆️");
  /* Non è un avviso: un aggiornamento non è un guasto, ed è ambra apposta
   * anche sulla tessera. Due colori diversi per lo stesso fatto sarebbero due
   * fatti. */
  assert.equal(pastiglia.avviso, undefined);
});

test("toccandola si vede cosa aspetta, col nome di ognuno", () => {
  const [pastiglia] = pastiglieDellaCasa([MODELLO]);
  assert.deepEqual(pastiglia.voci, [
    { entity: "update.gdahome", name: "gdahome" },
    { entity: "update.mosquitto", name: "Mosquitto broker" },
  ]);
});

test("niente da fare, niente pastiglia", () => {
  /* La tessera non nasce nemmeno, quindi qui non arriva nessun modello: è il
   * caso normale di una casa aggiornata. E se un modello arrivasse vuoto, la
   * pastiglia non si scrive comunque. */
  assert.deepEqual(pastiglieDellaCasa([]), []);
  assert.deepEqual(pastiglieDellaCasa([{ ...MODELLO, value: "0", aggiornamenti: [] }]), []);
});

test("spenta dalla sua spunta, la pastiglia non c'è", () => {
  const spenta = { voci: { aggiornamenti: false } };
  assert.deepEqual(pastiglieDellaCasa([MODELLO], { barra: spenta }), []);
  /* Di serie invece è accesa, come tutte: una voce che non ha niente da dire
   * non si vede comunque. */
  assert.equal(pastiglieDellaCasa([MODELLO], { barra: {} }).length, 1);
});

test("la parola sotto il numero dice che aspettano, e cambia al singolare", () => {
  const sezione = leggi("sections/come-sta-la-casa-section.js");
  assert.match(sezione, /t\("aggiornamento in attesa", "update pending"\)/);
  assert.match(sezione, /t\("aggiornamenti in attesa", "updates pending"\)/);
  /* E la voce ha il suo nome nella scheda dove si sceglie cosa si vede: senza,
   * la riga della configurazione uscirebbe senza etichetta. */
  assert.match(sezione, /aggiornamenti: t\("Aggiornamenti", "Updates"\)/);
});

test("la tessera si chiama col nome di una notizia, non di una sezione", () => {
  const tessera = leggi("sections/home-widgets-section.js");
  assert.match(tessera, /label: t\("Aggiornamenti pendenti", "Pending updates"\)/);
});
