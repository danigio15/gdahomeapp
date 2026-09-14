/* Perche' il filo col centralino non si apre, **a parole**.
 *
 * Questa prova nasce da un pomeriggio perso. Una casa non entrava da fuori, e
 * nel registro dell'add-on c'era una riga sola:
 *
 *     ! centralino: filo chiuso
 *
 * «Filo chiuso» e' vero per quattro guasti diversi — il nome che non si
 * risolve, la porta chiusa, un certificato che non va, una risposta che non e'
 * un WebSocket — e quei quattro guasti hanno quattro rimedi diversi. Il motivo
 * vero il filo lo sapeva: `Chiamante` lo mette dentro la chiusura. Chi la
 * ascoltava lo buttava via e scriveva quella parola.
 *
 * Qui si guarda che non lo butti piu': nel registro, e nello stato che legge
 * la console — perche' «sto chiamando…» per un'ora non e' un'informazione, e'
 * un'attesa.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Chiamata } from "../src/chiamata.js";

const QUI = dirname(fileURLToPath(import.meta.url));

/* Una presa fatta come `Chiamante`: chiama chi ascolta con un oggetto, non con
 * un `Event`, ed e' li' dentro che viaggia il motivo. */
class PresaCheCade {
  static aperte = [];

  constructor(dove) {
    this.dove = dove;
    this.motivo = "";
    this._ascolta = { open: [], message: [], close: [], error: [] };
    PresaCheCade.aperte.push(this);
  }

  addEventListener(quale, chi) {
    this._ascolta[quale].push(chi);
  }

  send() {}
  close() {}

  /* Il filo muore, e dice perche' — come fa quello vero. */
  cade(motivo) {
    this.motivo = motivo;
    for (const chi of this._ascolta.error) chi({ message: motivo });
    for (const chi of this._ascolta.close) chi({ motivo });
  }

  /* E il filo che muore senza dire niente: il caso in cui la parola di prima
   * resta l'unica cosa che si puo' scrivere. */
  cadeMuta() {
    for (const chi of this._ascolta.close) chi({});
  }
}

const identita = { casa: "casa_prova", segreto: "un-segreto" };

function unaChiamata(dette) {
  PresaCheCade.aperte = [];
  const chiamata = new Chiamata({
    dove: "wss://centralino.finto",
    identita,
    portiere: { accogli() {} },
    registro: {
      info() {},
      attenzione: (testo) => dette.push(testo),
      errore: (testo) => dette.push(testo),
    },
    Presa: PresaCheCade,
    attesaMassima: 20,
  });
  chiamata.avvia();
  return chiamata;
}

test("il registro dice il motivo vero, non «filo chiuso»", () => {
  const dette = [];
  const chiamata = unaChiamata(dette);
  try {
    PresaCheCade.aperte.at(-1).cade("getaddrinfo ENOTFOUND tramite.gdahome.org");
    assert.deepEqual(dette, ["centralino: getaddrinfo ENOTFOUND tramite.gdahome.org"]);
  } finally {
    chiamata.spegni();
  }
});

test("e lo stato lo tiene, per chi guarda la console", () => {
  const dette = [];
  const chiamata = unaChiamata(dette);
  try {
    PresaCheCade.aperte.at(-1).cade("ha risposto 404");
    assert.equal(chiamata.perche, "ha risposto 404");
    assert.equal(chiamata.dentro, false);
  } finally {
    chiamata.spegni();
  }
});

test("quando entra, il motivo di prima non resta scritto", () => {
  /* Un guasto passato che resta a schermo dopo che e' passato e' peggio di
   * nessun guasto: manda a cercare una cosa che non c'e' piu'. */
  const dette = [];
  const chiamata = unaChiamata(dette);
  try {
    PresaCheCade.aperte.at(-1).cade("ha risposto 502");
    assert.equal(chiamata.perche, "ha risposto 502");
    /* Il giro dopo il centralino risponde «bene». */
    chiamata._laRisposta({ t: "bene" });
    assert.equal(chiamata.dentro, true);
    assert.equal(chiamata.perche, "");
  } finally {
    chiamata.spegni();
  }
});

test("un filo che muore zitto resta «filo chiuso»", () => {
  const dette = [];
  const chiamata = unaChiamata(dette);
  try {
    PresaCheCade.aperte.at(-1).cadeMuta();
    assert.deepEqual(dette, ["centralino: filo chiuso"]);
  } finally {
    chiamata.spegni();
  }
});

test("il motivo arriva fino alla pagina: nello stato, e nella riga che si legge", () => {
  /* Le due punte del filo fra il ponte e chi guarda. Senza la prima, lo stato
   * non lo porta; senza la seconda, la pagina non lo scrive. */
  const server = readFileSync(join(QUI, "..", "src", "server.js"), "utf8");
  assert.match(
    server,
    /perche: chiamata\?\.perche \|\| "",/,
    "lo stato non porta il motivo alla console",
  );
  const console_ = readFileSync(join(QUI, "..", "console", "console.js"), "utf8");
  /* La riga si dice in due lingue — `due(italiano, inglese)` — e il motivo
     dev'essere attaccato a tutte e due: una traduzione che dimentica di
     aggiungerlo scriverebbe «The last attempt:» e poi il punto. */
  for (const [quale, come] of [
    ["italiano", /" L'ultimo tentativo: ", " The last attempt: "\) \+\s*\n?\s*centralino\.perche/],
    [
      "inglese",
      /due\(\s*\n?\s*" L'ultimo tentativo: ",\s*\n?\s*" The last attempt: ",?\s*\n?\s*\)/,
    ],
  ])
    assert.match(
      console_,
      come,
      `la console non scrive il motivo dell'ultimo tentativo in ${quale}`,
    );
});

test("un guasto di chi legge non si traveste da caduta di rete", async () => {
  /* L'altra meta' della stessa cecita', e quella che e' costata di piu'.
   *
   * Dentro la presa c'era un `catch` vuoto: se chi legge un messaggio
   * inciampava — un disco che non si scrive, un archivio rotto — il filo si
   * chiudeva **senza motivo** e l'errore sparivano. Dall'altra parte si vedeva
   * una caduta come tutte le altre, si ribussava dopo un minuto, e in nessuno
   * dei due registri c'era una riga. Adesso il guasto esce da due parti: a chi
   * ospita, e dentro il motivo della chiusura. */
  const { accetta } = await import("../src/presa.js");
  const sorgente = readFileSync(join(QUI, "..", "src", "presa.js"), "utf8");
  assert.doesNotMatch(
    sorgente,
    /catch \(_errore\) \{\n\s*this\.chiudi\(CHIUSURA\.guasto, ""\);/,
    "la presa richiude il filo senza dire perche'",
  );
  assert.match(sorgente, /this\.onGuasto\(errore\)/, "la presa non avvisa chi la ospita");
  assert.match(
    sorgente,
    /this\.chiudi\(CHIUSURA\.guasto, detto\)/,
    "la chiusura non porta il motivo",
  );
  assert.equal(typeof accetta, "function");

  /* E il centralino lo scrive davvero: tutte e tre le porte del filo. */
  const server = readFileSync(join(QUI, "..", "..", "centralino", "src", "server.js"), "utf8");
  for (const chi of ["una casa", "un telefono", "un abbinamento"]) {
    assert.ok(
      server.includes(`onGuasto: ilGuasto("${chi}")`),
      `«${chi}» puo' ancora inciampare in silenzio`,
    );
  }
});
