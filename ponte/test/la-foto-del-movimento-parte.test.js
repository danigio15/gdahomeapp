/* La foto di un movimento parte anche da una telecamera grande.
 *
 * Dal campo, su iPhone: «Movimento · Ingresso» col riquadro dell'ora e niente
 * foto. Home Assistant non porta la foto alla larghezza chiesta: la dimezza
 * finche' resta piu' larga di quella, e da una telecamera 4K anche «640» passa
 * i 300 KB che il centralino tiene. Si scende fino a 320; un errore non ferma i
 * tentativi; e quando la foto non c'e' il registro dice perche'. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { LARGHEZZE_DELLA_FOTO, Notifiche } from "../src/notifiche.js";
import { FOTO_MASSIMA } from "../src/spinta.js";

function conUnaCasa(immagine) {
  const cartella = mkdtempSync(join(tmpdir(), "foto-movimento-"));
  const chieste = [];
  const detto = [];
  const notifiche = new Notifiche({
    cartella,
    casa: {
      chiedi: async () => [],
      ascolta: async () => () => {},
      immagine: async (percorso) => {
        chieste.push(percorso);
        return immagine(Number(/width=(\d+)/.exec(percorso)?.[1]));
      },
    },
    registro: { info() {}, debug() {}, errore() {}, attenzione: (riga) => detto.push(riga) },
    adesso: () => 1_000_000,
  });
  return {
    notifiche,
    chieste,
    detto,
    via: () => rmSync(cartella, { recursive: true, force: true }),
  };
}

/* Una telecamera 4K come la dimezza Home Assistant: la larghezza piu' piccola
 * fra 3840, 1920, 960, 480… che resta >= quella chiesta. */
const quattroK = (chiesta) => {
  let larga = 3840;
  while (larga / 2 >= chiesta) larga /= 2;
  /* Una foto nitida di telecamera: un byte ogni punto e mezzo. */
  return Buffer.alloc(Math.round((larga * larga * 9) / 16 / 1.5), 1);
};

test("le larghezze scendono fino a 320", () => {
  assert.deepEqual([...LARGHEZZE_DELLA_FOTO], [1280, 640, 320]);
});

test("da una telecamera 4K la foto parte alla misura piccola", async () => {
  const { notifiche, chieste, detto, via } = conUnaCasa(quattroK);
  try {
    const byte = await notifiche._laFoto({ tipo: "movimento" }, "camera.ingresso");
    assert.ok(byte, "la foto doveva esserci");
    assert.ok(byte.length <= FOTO_MASSIMA);
    assert.deepEqual(chieste, [
      "camera_proxy/camera.ingresso?width=1280",
      "camera_proxy/camera.ingresso?width=640",
      "camera_proxy/camera.ingresso?width=320",
    ]);
    assert.deepEqual(detto, []);
  } finally {
    via();
  }
});

test("una telecamera lenta alla prima misura non ferma le altre", async () => {
  const { notifiche, detto, via } = conUnaCasa((larga) => {
    if (larga === 1280) throw new Error("The operation was aborted due to timeout");
    return Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]);
  });
  try {
    const byte = await notifiche._laFoto({ tipo: "movimento" }, "camera.ingresso");
    assert.ok(byte, "la foto da 640 doveva esserci");
    assert.deepEqual(detto, []);
  } finally {
    via();
  }
});

test("quando la foto non parte, il registro dice perche'", async () => {
  const { notifiche, detto, via } = conUnaCasa(() => Buffer.alloc(FOTO_MASSIMA + 1, 1));
  try {
    assert.equal(await notifiche._laFoto({ tipo: "movimento" }, "camera.ingresso"), null);
    assert.equal(detto.length, 1);
    assert.match(detto[0], /camera\.ingresso/);
    assert.match(detto[0], /a 320 pesa \d+ KB/);
  } finally {
    via();
  }
});
