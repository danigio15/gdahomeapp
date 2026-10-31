/* Dal campo: con l'app in background e poi di nuovo davanti, l'Energia
 * restava su «la casa non risponde» e i numeri non si aggiornavano. Il filo
 * verso casa si riapre col telefono sveglio: se non e' pronto in tempo l'app
 * risponde cosi' e chiude la presa. Non e' un Recorder lento: si riprova
 * presto, e appena la casa rimanda gli stati si richiedono i totali. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { presaDaRifare } from "../src/sections/energy-section.js";

const qui = dirname(fileURLToPath(import.meta.url));

test("«la casa non risponde» dell'app e' una presa da rifare, come quella caduta", () => {
  assert.equal(presaDaRifare("la casa non risponde"), true);
  assert.equal(presaDaRifare("your home is not answering"), true);
  assert.equal(presaDaRifare("Home Assistant connection lost"), true);
  assert.equal(presaDaRifare("Home Assistant connection timeout"), true);
  // Il Recorder lento e il token sbagliato no: quelli si aspettano al passo di sempre.
  assert.equal(presaDaRifare("Il Recorder di Home Assistant ci ha messo troppo"), false);
  assert.equal(presaDaRifare("Invalid Home Assistant authentication"), false);
  assert.equal(presaDaRifare(""), false);
});

test("le frasi sono proprio quelle che l'app manda", () => {
  const cucitura = readFileSync(join(qui, "..", "..", "..", "..", "..", "app", "lib", "plancia", "cucitura.dart"), "utf8");
  assert.match(cucitura, /it: 'la casa non risponde'/);
  assert.match(cucitura, /en: 'your home is not answering'/);
});

test("gli stati che tornano richiedono subito i totali rimasti su un errore", () => {
  const energia = readFileSync(join(qui, "..", "src", "sections", "energy-section.js"), "utf8");
  const annuncio = energia.indexOf("function annunciaGliStati() {");
  assert.ok(annuncio > 0);
  assert.match(
    energia.slice(annuncio, annuncio + 200),
    /if \(state\.lastError && hasConfiguredEnergy\(\)\) scheduleEnergyRefresh\(true\);/,
  );
  assert.match(energia, /const presaCaduta = presaDaRifare\(state\.lastError\);/);
});
