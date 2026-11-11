/* Due copie della stessa casa sul centralino (#388, #407).
 *
 * «Da fuori si disconnette continuamente.» Il centralino tiene una casa sola
 * per identificativo, e chi arriva secondo prende il posto del primo. Se la
 * stessa identita' gira su due macchine — un backup di Home Assistant
 * ripristinato altrove — le due si rubano il posto ogni secondo o due, e a ogni
 * scambio i telefoni collegati da fuori cadono.
 *
 * Qui il ponte se ne accorge: tre volte scalzato in poco tempo lascia il posto
 * all'altra copia, non ribussa subito, e lo dice.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Chiamata } from "../src/chiamata.js";

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

  cade(motivo) {
    this.motivo = motivo;
    for (const chi of this._ascolta.close) chi({ motivo });
  }
}

const SCALZATA = "questa casa si e' ricollegata";
const aspetta = (ms) => new Promise((pronto) => setTimeout(pronto, ms));

async function unaPresaNuova(prima) {
  for (let i = 0; i < 100 && PresaCheCade.aperte.length === prima; i++) await aspetta(5);
  assert.ok(PresaCheCade.aperte.length > prima, "il ponte ribussa");
}

function unaChiamata(dette, orologio) {
  PresaCheCade.aperte = [];
  const chiamata = new Chiamata({
    dove: "wss://centralino.finto",
    identita: { casa: "casa_prova", segreto: "un-segreto" },
    portiere: { accogli() {} },
    registro: { info() {}, attenzione() {}, errore: (testo) => dette.push(testo) },
    Presa: PresaCheCade,
    attesaMassima: 20,
    attesaDellaDoppia: 60_000,
    finestraDellaDoppia: 600_000,
    adesso: () => orologio.ora,
  });
  chiamata.avvia();
  return chiamata;
}

test("tre volte scalzata in poco tempo: lascia il posto all'altra copia, e lo dice", async () => {
  const dette = [];
  const orologio = { ora: 1_000_000 };
  const chiamata = unaChiamata(dette, orologio);
  try {
    for (let i = 0; i < 3; i++) {
      const prima = PresaCheCade.aperte.length;
      PresaCheCade.aperte.at(-1).cade(SCALZATA);
      orologio.ora += 2_000;
      if (i < 2) await unaPresaNuova(prima);
    }
    assert.ok(chiamata.doppia, "la console lo deve poter dire");
    assert.equal(chiamata.doppia.volte, 1);
    assert.equal(
      dette.filter((d) => d.includes("un'altra installazione")).length,
      1,
      "detto una volta",
    );
    // Non ribussa subito: l'altra copia resta dentro, e da fuori quella si raggiunge.
    const prima = PresaCheCade.aperte.length;
    await aspetta(150);
    assert.equal(PresaCheCade.aperte.length, prima, "non ribussa prima dell'attesa lunga");
  } finally {
    chiamata.spegni();
  }
});

test("una scalzata ogni tanto (la casa vera che si riaggancia) non e' una copia", async () => {
  const dette = [];
  const orologio = { ora: 1_000_000 };
  const chiamata = unaChiamata(dette, orologio);
  try {
    for (let i = 0; i < 4; i++) {
      const prima = PresaCheCade.aperte.length;
      PresaCheCade.aperte.at(-1).cade(SCALZATA);
      orologio.ora += 11 * 60_000;
      await unaPresaNuova(prima);
    }
    assert.equal(chiamata.doppia, null);
    assert.equal(dette.length, 0);
  } finally {
    chiamata.spegni();
  }
});

test("le altre cadute non contano: un router che ci butta giu' non e' una copia", async () => {
  const dette = [];
  const orologio = { ora: 1_000_000 };
  const chiamata = unaChiamata(dette, orologio);
  try {
    for (let i = 0; i < 4; i++) {
      const prima = PresaCheCade.aperte.length;
      PresaCheCade.aperte.at(-1).cade("read ECONNRESET");
      await unaPresaNuova(prima);
    }
    assert.equal(chiamata.doppia, null);
  } finally {
    chiamata.spegni();
  }
});
