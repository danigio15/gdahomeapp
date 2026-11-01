/* La focale della foto, letta dall'EXIF: un JPEG finto con dentro l'EXIF
 * di un telefono, in tutti e due gli ordini dei byte. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  FOCALE_DI_SERIE,
  focaleDallaFoto,
  focaleInPixel,
} from "../src/core/la-focale-della-foto.js";

/* Un JPEG ridotto all'osso: SOI, APP0 (JFIF) vuoto, APP1 con l'EXIF, SOS. */
function jpegConExif({ little = true, f35 = 23, focale = [54, 10], marca = "samsung" } = {}) {
  const voci0 = [];
  const vociExif = [];
  const coda = []; // i valori lunghi, dopo le tabelle
  const u16 = (v) => (little ? [v & 255, v >> 8] : [v >> 8, v & 255]);
  const u32 = (v) =>
    little
      ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]
      : [(v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255];
  /* la tabella 0 ha 2 voci (marca, puntatore all'EXIF), quella EXIF 2 voci */
  const ifd0 = 8,
    ifd0Fine = ifd0 + 2 + 2 * 12 + 4,
    ifdExif = ifd0Fine,
    ifdExifFine = ifdExif + 2 + 2 * 12 + 4;
  let libero = ifdExifFine;
  const marcaBytes = [...Buffer.from(marca + "\0", "latin1")];
  const marcaDove = libero;
  libero += marcaBytes.length;
  const focaleDove = libero;
  libero += 8;
  voci0.push(...u16(0x010f), ...u16(2), ...u32(marcaBytes.length), ...u32(marcaDove));
  voci0.push(...u16(0x8769), ...u16(4), ...u32(1), ...u32(ifdExif));
  vociExif.push(...u16(0x920a), ...u16(5), ...u32(1), ...u32(focaleDove));
  vociExif.push(...u16(0xa405), ...u16(3), ...u32(1), ...u16(f35), 0, 0);
  coda.push(...marcaBytes, ...u32(focale[0]), ...u32(focale[1]));
  const tiff = [
    ...(little ? [0x49, 0x49] : [0x4d, 0x4d]),
    ...u16(42),
    ...u32(ifd0),
    ...u16(2),
    ...voci0,
    ...u32(0),
    ...u16(2),
    ...vociExif,
    ...u32(0),
    ...coda,
  ];
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = (n) => [(n >> 8) & 255, n & 255];
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe0,
    ...len(16),
    0x4a,
    0x46,
    0x49,
    0x46,
    0,
    1,
    1,
    0,
    0,
    1,
    0,
    1,
    0,
    0,
    0xff,
    0xe1,
    ...len(app1.length + 2),
    ...app1,
    0xff,
    0xda,
    0,
    2,
    0,
  ]);
}

test("la focale si legge dall'EXIF, in tutti e due gli ordini dei byte", () => {
  for (const little of [true, false]) {
    const f = focaleDallaFoto(jpegConExif({ little }));
    assert.deepEqual(f, { f35: 23, focale: 5.4, marca: "samsung", modello: "" }, String(little));
  }
  /* anche passando il buffer nudo, e un ArrayBuffer piu' grande del JPEG */
  const b = jpegConExif();
  assert.equal(focaleDallaFoto(b.buffer).f35, 23);
  const largo = new Uint8Array(b.length + 100);
  largo.set(b, 50);
  assert.equal(focaleDallaFoto(largo.subarray(50, 50 + b.length)).f35, 23);
});

test("senza EXIF, o con un file che non e' un JPEG, non si inventa niente", () => {
  assert.equal(focaleDallaFoto(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])), null);
  assert.equal(focaleDallaFoto(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2, 0])), null);
  assert.equal(focaleDallaFoto(new Uint8Array(2)), null);
  assert.equal(focaleDallaFoto(null), null);
  /* un EXIF troncato a meta' non fa saltare niente */
  const b = jpegConExif();
  for (const n of [24, 40, 60, 80]) assert.doesNotThrow(() => focaleDallaFoto(b.subarray(0, n)));
  /* valori assurdi si scartano */
  assert.equal(focaleDallaFoto(jpegConExif({ f35: 0, focale: [0, 10] })).f35, null);
});

test("la focale in pixel: dal lato lungo e dai mm equivalenti, o 25 mm di serie", () => {
  /* Galaxy Z Fold8, 23 mm, foto 4000×2252: circa 2660 pixel */
  assert.equal(Math.round(focaleInPixel({ w: 4000, h: 2252, f35: 23 })), 2658);
  assert.equal(
    Math.round(focaleInPixel({ w: 2252, h: 4000, f35: 23 })),
    2658,
    "anche in verticale",
  );
  assert.equal(
    Math.round(focaleInPixel({ w: 3000, h: 4000 })),
    Math.round((FOCALE_DI_SERIE * 5000) / 43.27),
  );
  assert.equal(focaleInPixel({ w: 0, h: 0, f35: 23 }), 0);
  assert.equal(focaleInPixel(), 0);
});
