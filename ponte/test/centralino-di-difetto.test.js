/* Il centralino di difetto sta scritto in due file, e devono dire la stessa
 * cosa.
 *
 * Uno finisce dentro l'add-on, l'altro dentro l'app. Se divergessero, i
 * telefoni andrebbero a cercare le case in un posto e le case starebbero ad
 * aspettare in un altro — e non lo direbbe nessuno: da fuori casa l'app
 * direbbe soltanto «non trovo la casa», che manda a cercare il guasto nella
 * rete, nel router, nel telefono. Il guasto sarebbe qui.
 *
 * E' il tipo di difetto che non si trova provando, perche' in casa funziona
 * tutto: si trova in stazione, dopo una settimana, per caso.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { comEScritto } from "../../strumenti/centralino.mjs";
import { CENTRALINO_DI_DIFETTO } from "../src/opzioni.js";

test("il ponte e l'app puntano allo stesso centralino", () => {
  const { ponte, app } = comEScritto();
  assert.equal(ponte, app, "si rimettono a posto con: node strumenti/centralino.mjs <indirizzo>");
});

test("quello che legge il ponte e' quello scritto nel file", () => {
  /* Che la riga si legga a occhio non basta: deve essere anche quella che il
   * codice usa davvero. */
  assert.equal(comEScritto().ponte, CENTRALINO_DI_DIFETTO);
});
