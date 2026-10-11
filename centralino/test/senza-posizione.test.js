/* Le prove delle foto senza posizione: via EXIF, XMP, IPTC e commenti, i
 * punti uguali, l'orientamento salvo. E una foto mandata a una segnalazione
 * arriva su GitHub cosi'. */

import { test } from "node:test";
import assert from "node:assert/strict";

import { exifConLOrientamento, jpegSenzaPosizione } from "../src/senza-posizione.js";
import { Segnalazioni } from "../src/segnalazioni.js";

const ascii = (testo) => [...testo].map((c) => c.charCodeAt(0));
const u16 = (n) => [(n >> 8) & 0xff, n & 0xff];
const segmento = (segno, dentro) => [0xff, segno, ...u16(dentro.length + 2), ...dentro];

/* Un EXIF little-endian come quello di un Android: l'orientamento, e
 * l'elenco del GPS con dentro una posizione. */
function exifDelTelefono(orientamento) {
  const tiff = [];
  const s16 = (n) => tiff.push(n & 0xff, (n >> 8) & 0xff);
  const s32 = (n) => tiff.push(n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff);
  tiff.push(...ascii("II"));
  s16(0x2a);
  s32(8);
  s16(2);
  s16(0x0112);
  s16(3);
  s32(1);
  s16(orientamento);
  s16(0);
  s16(0x8825);
  s16(4);
  s32(1);
  s32(38);
  s32(0);
  tiff.push(...ascii("POSIZIONE-SEGRETA"));
  return [...ascii("Exif"), 0, 0, ...tiff];
}

const punti = [0xff, 0xda, ...u16(4), 1, 2, 9, 9, 9, 9, 0xff, 0xd9];

function jpeg({ orientamento, jfif = true }) {
  return Uint8Array.from([
    0xff,
    0xd8,
    ...(jfif ? segmento(0xe0, [...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]) : []),
    ...segmento(0xe1, exifDelTelefono(orientamento)),
    ...segmento(0xe1, [...ascii("http://ns.adobe.com/xap/1.0/"), 0, ...ascii("POSIZIONE-SEGRETA")]),
    ...segmento(0xed, ascii("Photoshop 3.0 POSIZIONE-SEGRETA")),
    ...segmento(0xfe, ascii("POSIZIONE-SEGRETA")),
    ...segmento(0xe2, ascii("ICC_PROFILE colori")),
    ...segmento(0xdb, new Array(65).fill(1)),
    ...punti,
  ]);
}

const testo = (byte) => String.fromCharCode(...byte);

test("via EXIF, XMP, IPTC e commenti; i colori e i punti restano", () => {
  const prima = jpeg({ orientamento: 1 });
  const dopo = jpegSenzaPosizione(prima);
  assert.ok(!testo(dopo).includes("POSIZIONE-SEGRETA"));
  assert.ok(!testo(dopo).includes("Exif"));
  assert.ok(testo(dopo).includes("JFIF"));
  assert.ok(testo(dopo).includes("ICC_PROFILE"));
  assert.deepEqual([...dopo.subarray(dopo.length - punti.length)], punti);
  /* Quello che e' entrato non si tocca. */
  assert.ok(testo(prima).includes("POSIZIONE-SEGRETA"));
});

test("l'orientamento resta, in un EXIF di una voce sola", () => {
  for (const jfif of [true, false]) {
    const dopo = jpegSenzaPosizione(jpeg({ orientamento: 6, jfif }));
    assert.ok(!testo(dopo).includes("POSIZIONE-SEGRETA"));
    assert.equal(testo(dopo).split("Exif").length, 2);
    const exif = exifConLOrientamento(6);
    const dove = jfif ? 2 + 18 : 2;
    assert.deepEqual([...dopo.subarray(dove, dove + exif.length)], [...exif]);
  }
});

test("una foto pulita, una storta, una che non e' un JPEG: com'erano", () => {
  const pulita = Uint8Array.from([0xff, 0xd8, ...segmento(0xdb, [1, 2, 3]), ...punti]);
  assert.equal(jpegSenzaPosizione(pulita), pulita);
  const storta = jpeg({ orientamento: 6 }).subarray(0, 30);
  assert.equal(jpegSenzaPosizione(storta), storta);
  const corta = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  assert.equal(jpegSenzaPosizione(corta), corta);
  const png = Uint8Array.from(ascii("\x89PNG\r\n\x1a\n"));
  assert.equal(jpegSenzaPosizione(png), png);
  /* Un EXIF che punta fuori dal segmento: la foto resta com'e'. */
  const exifRotto = exifDelTelefono(6);
  exifRotto[10] = 0xff;
  exifRotto[11] = 0xff;
  const rotta = Uint8Array.from([0xff, 0xd8, ...segmento(0xe1, exifRotto), ...punti]);
  assert.equal(jpegSenzaPosizione(rotta), rotta);
});

test("la foto di una segnalazione arriva su GitHub senza posizione", async () => {
  const messi = [];
  const github = {
    pronto: true,
    apriIssue: async () => ({ number: 7, html_url: "u", created_at: "", state: "open" }),
    leggiIssue: async () => ({ number: 7, state: "open", body: "", created_at: "" }),
    commenti: async () => [],
    commenta: async () => ({}),
    mettiFile: async ({ byte }) => {
      messi.push(byte);
      return { url: "https://example.invalid/foto.jpg?raw=true" };
    },
  };
  const dentro = new Map();
  const mie = new Segnalazioni({
    storage: {
      get: async (chiave) => dentro.get(chiave),
      put: async (chiave, valore) => void dentro.set(chiave, valore),
    },
    github,
    casa: "casa_1",
    adesso: () => 1_700_000_000_000,
  });
  const aperta = await mie.crea({ tipo: "problema", titolo: "t", corpo: "c", diagnostica: {} });
  await mie.allega(aperta.numero, {
    nome: "f.jpg",
    tipo: "image/jpeg",
    byte: jpeg({ orientamento: 3 }),
  });
  assert.equal(messi.length, 1);
  assert.ok(!testo(messi[0]).includes("POSIZIONE-SEGRETA"));
  assert.ok(testo(messi[0]).includes("Exif"));
});
