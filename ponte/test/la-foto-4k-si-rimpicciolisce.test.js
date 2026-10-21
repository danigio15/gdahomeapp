/* La foto di una telecamera 4K si rimpicciolisce in casa.
 *
 * Dal campo: «le immagini nelle notifiche continuano a non uscire, su iPhone
 * e su Android». Tante integrazioni di Home Assistant ignorano la larghezza
 * chiesta e mandano l'istantanea intera a ogni misura: uno o due mega, oltre
 * i 300 KB che il centralino tiene. Adesso la foto la stringe il ponte. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Notifiche } from "../src/notifiche.js";
import { misureDelJpeg, rimpicciolisci } from "../src/rimpicciolisci.js";
import { FOTO_CHIARA_MASSIMA, FOTO_MASSIMA } from "../src/spinta.js";

const ciSonoIProgrammi = spawnSync("cjpeg", ["-version"]).error === undefined;

/* Una foto 4K vera, piena di dettagli (rumore): un JPEG di qualche mega. */
function fotoQuattroK() {
  const larga = 3840,
    alta = 2160;
  const testa = Buffer.from(`P6\n${larga} ${alta}\n255\n`);
  const punti = Buffer.alloc(larga * alta * 3);
  let s = 12345;
  for (let i = 0; i < punti.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    /* Un poco di forma e un poco di rumore, come una telecamera di notte. */
    punti[i] = ((i / 3) % larga) / 16 + (s % 96);
  }
  const fuori = spawnSync("cjpeg", ["-quality", "92"], {
    input: Buffer.concat([testa, punti]),
    maxBuffer: 64 << 20,
  });
  return fuori.stdout;
}

test("le misure si leggono dall'intestazione del JPEG", () => {
  /* SOI, un APP0 corto, SOF0 con 2160 x 3840. */
  const jpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x08, 0x70, 0x0f,
    0x00, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);
  assert.deepEqual(misureDelJpeg(jpeg), { larga: 3840, alta: 2160 });
  assert.equal(misureDelJpeg(Buffer.from("non una foto")), null);
});

test("il tetto della foto lascia posto alla busta", () => {
  assert.equal(FOTO_CHIARA_MASSIMA + 1 + 12 + 16, FOTO_MASSIMA);
});

test(
  "una foto 4K di qualche mega esce sotto il tetto, larga al piu' 1280",
  { skip: !ciSonoIProgrammi },
  async () => {
    const grande = fotoQuattroK();
    assert.ok(grande.length > FOTO_MASSIMA, `la prova vuole una foto grande (${grande.length})`);
    const piccola = await rimpicciolisci(grande, { massimo: FOTO_CHIARA_MASSIMA });
    assert.ok(piccola, "doveva rimpicciolirsi");
    assert.ok(piccola.length <= FOTO_CHIARA_MASSIMA, `${piccola.length}`);
    assert.ok(misureDelJpeg(piccola).larga <= 1280);
  },
);

test("senza i programmi non si rompe niente: null", async () => {
  const avvia = () => {
    throw Object.assign(new Error("spawn djpeg ENOENT"), { code: "ENOENT" });
  };
  const jpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x08, 0x70, 0x0f, 0x00, 0x03, 0, 0, 0, 0,
  ]);
  assert.equal(await rimpicciolisci(jpeg, { massimo: 1000, avvia }), null);
});

test("Home Assistant che ignora la larghezza: la notifica parte con la foto rimpicciolita", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "foto-4k-"));
  const enorme = Buffer.alloc(2 * 1024 * 1024, 7);
  const chieste = [];
  const notifiche = new Notifiche({
    cartella,
    casa: {
      chiedi: async () => [],
      ascolta: async () => () => {},
      immagine: async (percorso) => {
        chieste.push(percorso);
        return enorme;
      },
    },
    rimpicciolisci: async (byte, { massimo }) =>
      byte === enorme ? Buffer.alloc(massimo - 10, 1) : null,
    registro: { info() {}, debug() {}, errore() {}, attenzione() {} },
    adesso: () => 1_000_000,
  });
  try {
    const byte = await notifiche._laFoto({ tipo: "movimento" }, "camera.ingresso");
    assert.ok(byte);
    assert.ok(byte.length <= FOTO_CHIARA_MASSIMA);
    /* Alla prima misura: niente altre richieste a Home Assistant. */
    assert.deepEqual(chieste, ["camera_proxy/camera.ingresso?width=1280"]);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});
