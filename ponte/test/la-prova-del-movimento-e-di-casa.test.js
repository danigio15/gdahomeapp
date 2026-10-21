/* «Prova: mandamela adesso» del movimento parla delle telecamere di casa.
 *
 * Dal campo: in «Quali» erano scelte «Balconi» e «Cortile Destro», e la prova
 * arrivava come «Movimento · Ingresso» alle 18:22, senza foto. Era l'esempio
 * fisso, uguale per tutti. Adesso la prova prende la prima telecamera scelta,
 * l'ora di adesso, e la foto di quella telecamera. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { esempioDi, Notifiche } from "../src/notifiche.js";

const ADESSO = new Date(2026, 9, 21, 4, 50, 12).getTime();

function conUnaCasa(stati) {
  const cartella = mkdtempSync(join(tmpdir(), "prova-movimento-"));
  const notifiche = new Notifiche({
    cartella,
    casa: { chiedi: async () => [], ascolta: async () => () => {} },
    registro: { info() {}, debug() {}, errore() {}, attenzione() {} },
    adesso: () => ADESSO,
  });
  notifiche.sentinella.carica(stati);
  return { notifiche, via: () => rmSync(cartella, { recursive: true, force: true }) };
}

const telecamera = (id, nome) => ({
  entity_id: id,
  state: "idle",
  attributes: { friendly_name: nome },
});

test("la prova usa la prima telecamera scelta in «Quali», con l'ora di adesso", () => {
  const { notifiche, via } = conUnaCasa([
    telecamera("camera.balconi", "Balconi"),
    telecamera("camera.cortile_destro", "Cortile Destro"),
  ]);
  try {
    const vero = notifiche._ilMovimentoDiProva(["camera.balconi", "camera.cortile_destro"]);
    assert.equal(vero.camera, "camera.balconi");
    assert.equal(vero.dati.nome, "Balconi");
    assert.equal(vero.dati.ora, "04:50");
    assert.equal(vero.dati.secondi, "04:50:12");
    const esempio = esempioDi("movimento", ADESSO, { movimento: vero.dati });
    assert.match(esempio.parole.it.titolo, /Balconi/);
    assert.doesNotMatch(JSON.stringify(esempio.parole), /Ingresso/);
  } finally {
    via();
  }
});

test("senza scelte vale la prima telecamera di casa; senza telecamere l'esempio", () => {
  const { notifiche, via } = conUnaCasa([telecamera("camera.cortile_destro", "Cortile Destro")]);
  try {
    assert.equal(notifiche._ilMovimentoDiProva([]).camera, "camera.cortile_destro");
    /* Una scelta che la casa non conosce piu' non conta. */
    assert.equal(notifiche._ilMovimentoDiProva(["camera.sparita"]).camera, "camera.cortile_destro");
  } finally {
    via();
  }
  const vuota = conUnaCasa([]);
  try {
    assert.equal(vuota.notifiche._ilMovimentoDiProva([]), null);
    assert.match(esempioDi("movimento", ADESSO).parole.it.titolo, /Ingresso/);
  } finally {
    vuota.via();
  }
});

test("la foto di una prova parte anche se la stessa telecamera ne ha appena mandata una", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "prova-foto-"));
  try {
    const notifiche = new Notifiche({
      cartella,
      casa: {
        chiedi: async () => [],
        ascolta: async () => () => {},
        immagine: async () => Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]),
      },
      registro: { info() {}, debug() {}, errore() {}, attenzione() {} },
      adesso: () => ADESSO,
    });
    assert.ok(await notifiche._laFoto({ tipo: "prova" }, "camera.balconi"));
    assert.ok(await notifiche._laFoto({ tipo: "prova" }, "camera.balconi"));
    /* Il movimento vero invece no: una foto al minuto per telecamera. */
    assert.ok(await notifiche._laFoto({ tipo: "movimento" }, "camera.cortile"));
    assert.equal(await notifiche._laFoto({ tipo: "movimento" }, "camera.cortile"), null);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});
