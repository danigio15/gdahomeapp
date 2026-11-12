/* Il motivo della chiusura arriva dall'altra parte del filo (#407).
 *
 * «Si connette e si disconnette continuamente»: nel registro dell'add-on, ogni
 * secondo, «il filo col centralino e' caduto — centralino: filo chiuso». Il
 * centralino chiudeva dicendo perche' — «questa casa si e' ricollegata», una
 * casa doppia — ma la presa che riceveva la chiusura buttava il motivo: la
 * casa doppia (`chiamata.js`) cerca quella parola e non la vedeva mai.
 *
 * Qui due prese vere, una da centralino e una da ponte, collegate da un filo
 * finto: quello che una scrive, l'altra lo legge.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { Presa } from "../src/presa.js";

class FiloFinto extends EventEmitter {
  constructor() {
    super();
    this.altro = null;
  }
  write(pezzo) {
    const altro = this.altro;
    setImmediate(() => altro.emit("data", Buffer.from(pezzo)));
    return true;
  }
  end() {
    const altro = this.altro;
    setImmediate(() => {
      this.emit("close");
      altro.emit("close");
    });
  }
  destroy() {
    this.end();
  }
  setTimeout() {}
  setNoDelay() {}
}

function dueCapi() {
  const a = new FiloFinto();
  const b = new FiloFinto();
  a.altro = b;
  b.altro = a;
  return [a, b];
}

test("chi riceve la chiusura sa perche' l'altro ha chiuso", async () => {
  const [lato, altroLato] = dueCapi();
  let motivo = null;
  const centralino = new Presa(lato);
  new Presa(altroLato, { daCliente: true, onChiusa: (m) => (motivo = m) });
  centralino.chiudi(1000, "questa casa si e' ricollegata");
  for (let i = 0; i < 50 && motivo === null; i++) await new Promise((r) => setTimeout(r, 5));
  assert.equal(motivo, "questa casa si e' ricollegata");
});

test("una chiusura senza motivo resta senza motivo", async () => {
  const [lato, altroLato] = dueCapi();
  let motivo = null;
  const ponte = new Presa(lato, { daCliente: true });
  new Presa(altroLato, { onChiusa: (m) => (motivo = m) });
  ponte.chiudi(1000, "");
  for (let i = 0; i < 50 && motivo === null; i++) await new Promise((r) => setTimeout(r, 5));
  assert.equal(motivo, "");
});
