/* I modelli 3D della Casa 3D (#440): il file sale a pezzi, si controlla
 * intero, riscende a pezzi; quello che non e' un modello, o che vuole
 * qualcosa da fuori, resta fuori. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Casa } from "../src/casa.js";
import { Commissioni } from "../src/commissioni.js";
import {
  MODELLO_MASSIMO,
  ModelloRifiutato,
  Modelli3D,
  PEZZO_IN_SALITA,
  formatoDelModello,
} from "../src/modelli-3d.js";

const CHI = "c0ffee00c0ffee00c0ffee00c0ffee00";
const ZITTO = { info() {}, attenzione() {}, errore() {} };

/* Un GLB a mano: un triangolo, e quello che la prova vuole aggiungere al JSON. */
function glb(extra = {}, { versione = 2 } = {}) {
  const bin = Buffer.from(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer);
  const json = {
    asset: { version: "2.0" },
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
    ],
    bufferViews: [{ buffer: 0, byteLength: bin.length }],
    buffers: [{ byteLength: bin.length }],
    ...extra,
  };
  let testo = Buffer.from(JSON.stringify(json));
  testo = Buffer.concat([testo, Buffer.alloc((4 - (testo.length % 4)) % 4, 0x20)]);
  const pezzo = (tipo, b) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(b.length, 0);
    h.writeUInt32LE(tipo, 4);
    return Buffer.concat([h, b]);
  };
  const corpo = Buffer.concat([pezzo(0x4e4f534a, testo), pezzo(0x004e4942, bin)]);
  const testa = Buffer.alloc(12);
  testa.write("glTF", 0, "latin1");
  testa.writeUInt32LE(versione, 4);
  testa.writeUInt32LE(12 + corpo.length, 8);
  return Buffer.concat([testa, corpo]);
}

const OBJ = Buffer.from("# casa\no muro\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n");

function rifiuto(fai) {
  try {
    fai();
  } catch (errore) {
    assert.ok(errore instanceof ModelloRifiutato, String(errore));
    return errore.codice;
  }
  assert.fail("doveva dire di no");
}

test("il formato si legge dal contenuto, non dal nome", () => {
  assert.equal(formatoDelModello(glb()), "glb");
  assert.equal(formatoDelModello(OBJ), "obj");
  const gltf = Buffer.from(
    JSON.stringify({
      asset: { version: "2.0" },
      buffers: [{ uri: "data:application/octet-stream;base64,AAAA", byteLength: 3 }],
    }),
  );
  assert.equal(formatoDelModello(gltf), "gltf");
  /* una pagina, un archivio, un eseguibile, un glTF 1, un GLB troncato */
  assert.equal(
    rifiuto(() => formatoDelModello(Buffer.from("<html><script>x</script>"))),
    "sconosciuto",
  );
  assert.equal(
    rifiuto(() => formatoDelModello(Buffer.from("PK\x03\x04\0\0zip", "latin1"))),
    "sconosciuto",
  );
  assert.equal(
    rifiuto(() => formatoDelModello(Buffer.from("MZ\x90\0\x03\0\0\0", "latin1"))),
    "sconosciuto",
  );
  assert.equal(
    rifiuto(() => formatoDelModello(glb({}, { versione: 1 }))),
    "versione",
  );
  assert.equal(
    rifiuto(() => formatoDelModello(glb().subarray(0, 40))),
    "rotto",
  );
  assert.equal(
    rifiuto(() => formatoDelModello(Buffer.from("ciao, sono un testo"))),
    "sconosciuto",
  );
});

test("un glTF che va a prendere qualcosa fuori, o compresso, si rifiuta", () => {
  const fuori = {
    buffers: [{ byteLength: 36 }, { uri: "https://esempio.it/casa.bin", byteLength: 8 }],
  };
  assert.equal(
    rifiuto(() => formatoDelModello(glb(fuori))),
    "esterno",
  );
  const accanto = { images: [{ uri: "texture.png" }] };
  assert.equal(
    rifiuto(() => formatoDelModello(glb(accanto))),
    "esterno",
  );
  const fileLocale = { images: [{ uri: "file:///etc/passwd" }] };
  assert.equal(
    rifiuto(() => formatoDelModello(glb(fileLocale))),
    "esterno",
  );
  const draco = { extensionsRequired: ["KHR_draco_mesh_compression"] };
  assert.equal(
    rifiuto(() => formatoDelModello(glb(draco))),
    "compresso",
  );
  const ignota = { extensionsRequired: ["VENDOR_qualcosa"] };
  assert.equal(
    rifiuto(() => formatoDelModello(glb(ignota))),
    "estensione",
  );
  /* dentro il pacchetto si': un'immagine nei byte del GLB, o in data: */
  const dentro = {
    images: [{ bufferView: 0, mimeType: "image/png" }, { uri: "data:image/png;base64,AA==" }],
  };
  assert.equal(formatoDelModello(glb(dentro)), "glb");
});

test("il modello sale a pezzi, si controlla intero e riscende a pezzi", () => {
  const cartella = mkdtempSync(join(tmpdir(), "modelli3d-"));
  try {
    const m = new Modelli3D({ cartella });
    /* un OBJ grande quanto basta per tre pezzi */
    const righe = ["# casa grande"];
    for (let quanto = 0; quanto < PEZZO_IN_SALITA * 2.5; quanto += 23)
      righe.push("v 1.2345 2.3456 3.4567");
    righe.push("f 1 2 3");
    const byte = Buffer.from(righe.join("\n"));
    const { caricamento } = m.inizia({ chi: CHI, peso: byte.length });
    let indice = 0;
    for (let da = 0; da < byte.length; da += PEZZO_IN_SALITA)
      m.pezzo({
        chi: CHI,
        caricamento,
        indice: indice++,
        byte: byte.subarray(da, da + PEZZO_IN_SALITA),
      });
    assert.equal(indice, 3);
    const fatto = m.finisci({ chi: CHI, caricamento });
    assert.equal(fatto.formato, "obj");
    assert.equal(fatto.peso, byte.length);
    assert.match(fatto.id, /^[a-f0-9]{16}$/);
    /* il file da parte non c'e' piu': c'e' solo il modello col suo nome */
    assert.deepEqual(readdirSync(cartella), [`${fatto.id}.obj`]);
    const pezzi = [];
    for (let da = 0, fine = false; !fine;) {
      const p = m.leggi(fatto.id, da, 1024 * 1024);
      pezzi.push(p.byte);
      da += p.byte.length;
      fine = p.fine;
    }
    assert.deepEqual(Buffer.concat(pezzi), byte);
    assert.equal(m.leggi("../../etc/passwd"), null);
    assert.equal(m.leggi("0123456789abcdef"), null);
    assert.equal(m.togli(fatto.id), true);
    assert.deepEqual(m.elenco(), []);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("fuori ordine, di un altro, scaduto, troppo grande, pieno: no", () => {
  const cartella = mkdtempSync(join(tmpdir(), "modelli3d-"));
  try {
    let ora = 0;
    const m = new Modelli3D({ cartella, tetto: 1000, quanti: 1, adesso: () => ora });
    assert.equal(
      rifiuto(() => m.inizia({ chi: CHI, peso: MODELLO_MASSIMO + 1 })),
      "grande",
    );
    assert.equal(
      rifiuto(() => m.inizia({ chi: CHI, peso: 2000 })),
      "pieno",
    );
    const { caricamento } = m.inizia({ chi: CHI, peso: OBJ.length });
    assert.equal(
      rifiuto(() => m.pezzo({ chi: CHI, caricamento, indice: 1, byte: OBJ })),
      "ordine",
    );
    assert.equal(
      rifiuto(() => m.pezzo({ chi: "un-altro", caricamento, indice: 0, byte: OBJ })),
      "scaduto",
    );
    ora += 11 * 60 * 1000;
    assert.equal(
      rifiuto(() => m.pezzo({ chi: CHI, caricamento, indice: 0, byte: OBJ })),
      "scaduto",
    );
    /* il caricamento scaduto non lascia niente sul disco */
    assert.deepEqual(readdirSync(cartella), []);
    /* un file che a pezzi arriva intero ma non e' un modello: niente modello */
    const html = Buffer.from("<html><body>ciao</body></html>");
    const c2 = m.inizia({ chi: CHI, peso: html.length }).caricamento;
    m.pezzo({ chi: CHI, caricamento: c2, indice: 0, byte: html });
    assert.equal(
      rifiuto(() => m.finisci({ chi: CHI, caricamento: c2 })),
      "sconosciuto",
    );
    assert.deepEqual(readdirSync(cartella), []);
    /* uno buono, e poi la cartella e' piena (uno al massimo) */
    const c3 = m.inizia({ chi: CHI, peso: OBJ.length }).caricamento;
    m.pezzo({ chi: CHI, caricamento: c3, indice: 0, byte: OBJ });
    m.finisci({ chi: CHI, caricamento: c3 });
    assert.equal(
      rifiuto(() => m.inizia({ chi: CHI, peso: OBJ.length })),
      "pieno",
    );
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("un riavvio a meta' caricamento non lascia avanzi", () => {
  const cartella = mkdtempSync(join(tmpdir(), "modelli3d-"));
  try {
    writeFileSync(join(cartella, ".in-arrivo-vecchio"), "mezzo");
    new Modelli3D({ cartella });
    assert.equal(existsSync(join(cartella, ".in-arrivo-vecchio")), false);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("dal filo: chi e' entrato carica e legge; senza utente, niente", async () => {
  const cartella = mkdtempSync(join(tmpdir(), "modelli3d-"));
  try {
    const con = new Commissioni({
      casa: new Casa({ indirizzo: "http://supervisor/core", segno: "s", plancia: "http://x:8123" }),
      registro: ZITTO,
      modelli3d: new Modelli3D({ cartella }),
    });
    const byte = glb();
    const chiedi = (detto, chi = CHI) => con.rispondi({ id: 1, ...detto }, { chiChiede: chi });
    const senza = await chiedi({ type: "ponte/casa3d/modello/inizia", peso: byte.length }, "");
    assert.equal(senza.success, false);
    assert.equal(senza.error.code, "unauthorized");
    const inizio = await chiedi({ type: "ponte/casa3d/modello/inizia", peso: byte.length });
    assert.equal(inizio.success, true);
    const { caricamento } = inizio.result;
    const pezzo = await chiedi({
      type: "ponte/casa3d/modello/pezzo",
      caricamento,
      indice: 0,
      data: byte.toString("base64"),
    });
    assert.equal(pezzo.result.ricevuti, byte.length);
    const fine = await chiedi({ type: "ponte/casa3d/modello/fine", caricamento });
    assert.equal(fine.result.formato, "glb");
    const letto = await chiedi({
      type: "ponte/casa3d/modello/leggi",
      modello: fine.result.id,
      da: 0,
    });
    assert.equal(letto.result.fine, true);
    assert.deepEqual(Buffer.from(letto.result.corpo, "base64"), byte);
    const daFuori = await chiedi(
      { type: "ponte/casa3d/modello/leggi", modello: fine.result.id },
      "",
    );
    assert.equal(daFuori.error.code, "unauthorized");

    /* un GLB con un indirizzo dentro: il no dice il perche' */
    const cattivo = glb({ images: [{ uri: "http://esempio.it/x.png" }] });
    const c2 = (await chiedi({ type: "ponte/casa3d/modello/inizia", peso: cattivo.length })).result
      .caricamento;
    await chiedi({
      type: "ponte/casa3d/modello/pezzo",
      caricamento: c2,
      indice: 0,
      data: cattivo.toString("base64"),
    });
    const no = await chiedi({ type: "ponte/casa3d/modello/fine", caricamento: c2 });
    assert.equal(no.success, false);
    assert.equal(no.error.code, "invalid_upload");
    assert.equal(no.error.motivo, "esterno");

    const tolto = await chiedi({ type: "ponte/casa3d/modello/togli", modello: fine.result.id });
    assert.equal(tolto.result.tolto, true);
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});
