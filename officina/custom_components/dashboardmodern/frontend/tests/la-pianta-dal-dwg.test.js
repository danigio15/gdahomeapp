/* La planimetria da un DWG: dai pezzi che LibreDWG legge ai piani.
 *
 * «Non c'è la possibilità di inserire DWG»: un disegno d'architetto ha i
 * piani uno accanto all'altro, le quote, gli arredi, una cornice; qui si
 * pretende che i piani escano separati, coi loro nomi, la scala giusta e le
 * scritte delle stanze, e che quote e arredi restino fuori.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  eNomeDiStanza,
  metriPerUnita,
  nomeDaScritta,
  pezziDelDisegno,
  pianiDelDisegno,
  ruoloDelloStrato,
  scrittaPulita,
  spazioDelModello,
} from "../src/core/pianta-da-dwg.js";

const MODELLO = "1F";
const linea = (x0, y0, x1, y1, layer = "MURI") => ({
  type: "LINE",
  layer,
  ownerBlockRecordSoftId: MODELLO,
  startPoint: { x: x0, y: y0 },
  endPoint: { x: x1, y: y1 },
});
const scritta = (text, x, y) => ({
  type: "MTEXT",
  layer: "TESTI",
  ownerBlockRecordSoftId: MODELLO,
  text,
  insertionPoint: { x, y },
});

/* Un piano in millimetri: un rettangolo con un tramezzo e qualche tratto. */
function piano(ox, oy, w = 12000, h = 10000) {
  const e = [
    linea(ox, oy, ox + w, oy),
    linea(ox + w, oy, ox + w, oy + h),
    linea(ox + w, oy + h, ox, oy + h),
    linea(ox, oy + h, ox, oy),
    linea(ox + w / 2, oy, ox + w / 2, oy + h),
  ];
  for (let i = 1; i < 10; i++)
    e.push(linea(ox + 300, oy + i * 900, ox + 1200, oy + i * 900, "PROIEZIONE"));
  e.push({
    type: "HATCH",
    layer: "CAMPITURE TOMPAGNI",
    ownerBlockRecordSoftId: MODELLO,
    solidFill: 1,
    boundaryPaths: [
      {
        vertices: [
          { x: ox, y: oy },
          { x: ox + w, y: oy },
          { x: ox + w, y: oy + 300 },
          { x: ox, y: oy + 300 },
        ],
      },
    ],
  });
  return e;
}

function disegno() {
  return {
    header: { INSUNITS: 4 },
    tables: {
      BLOCK_RECORD: {
        entries: [
          { name: "*Model_Space", handle: MODELLO },
          { name: "*Paper_Space", handle: "D2" },
        ],
      },
    },
    entities: [
      ...piano(0, 0),
      ...piano(15000, 0),
      scritta("{\\fArial|b1;CUCINA}", 3000, 5000),
      scritta("Soggiorno", 9000, 5000),
      scritta("CAMERA", 18000, 5000),
      scritta("PIANTA PIANO TERRA", 0, -2000),
      scritta("PIANTA PIANO PRIMO", 15000, -2000),
      scritta("12,40 mq", 4000, 4000),
      /* La cornice che racchiude tutto: grande ma fatta di pochi tratti. */
      linea(-3000, -4000, 30000, -4000, "CORNICE"),
      linea(30000, -4000, 30000, 13000, "CORNICE"),
      linea(30000, 13000, -3000, 13000, "CORNICE"),
      linea(-3000, 13000, -3000, -4000, "CORNICE"),
      /* Quote e arredi non sono muri. */
      { type: "DIMENSION", layer: "QUOTE", ownerBlockRecordSoftId: MODELLO },
      linea(1000, 1000, 2000, 2000, "ARREDI"),
      linea(1000, 1000, 2000, 2000, "QUOTE"),
      /* Un tratto nel foglio di stampa non c'entra. */
      { ...linea(0, 0, 99999, 99999), ownerBlockRecordSoftId: "D2" },
    ],
  };
}

test("lo spazio del modello e' quello del disegno, non dei fogli", () => {
  assert.equal(spazioDelModello(disegno()), MODELLO);
  assert.equal(spazioDelModello({}), null);
});

test("i pezzi: muri e campiture si', quote, arredi e fogli di stampa no", () => {
  const p = pezziDelDisegno(disegno());
  assert.equal(p.piene.length, 2);
  assert.ok(p.linee.every((l) => l.flat().every((v) => v < 99999)));
  assert.ok(!p.linee.some((l) => l[0][0] === 1000 && l[1][0] === 2000));
  assert.ok(p.scritte.some((s) => s.t === "CUCINA"));
});

test("le scritte di MTEXT si puliscono dai codici di formato", () => {
  assert.equal(scrittaPulita("{\\fArial|b1;CUCINA}"), "CUCINA");
  assert.equal(scrittaPulita("SALA\\PD'ATTESA"), "SALA D'ATTESA");
});

test("due piani affiancati escono separati, coi loro nomi e la scala", () => {
  const piani = pianiDelDisegno(pezziDelDisegno(disegno()), { insunits: 4 });
  assert.equal(piani.length, 2);
  assert.deepEqual(
    piani.map((p) => p.nome),
    ["PIANTA PIANO TERRA", "PIANTA PIANO PRIMO"],
  );
  for (const p of piani) {
    assert.equal(p.metriPerUnita, 0.001);
    assert.ok(Math.abs(p.larghezzaMetri - 12) < 0.01);
    assert.ok(Math.abs(p.profonditaMetri - 10) < 0.01);
  }
  assert.deepEqual(piani[0].scritte.map((s) => s.t).sort(), ["12,40 mq", "CUCINA", "Soggiorno"]);
  assert.deepEqual(
    piani[1].scritte.map((s) => s.t),
    ["CAMERA"],
  );
});

test("la scala: l'unita' dichiarata se fa una casa, altrimenti quella che la fa", () => {
  assert.equal(metriPerUnita(12000, 4), 0.001);
  assert.equal(metriPerUnita(1200, 5), 0.01);
  /* Un disegno in metri che dichiara i millimetri. */
  assert.equal(metriPerUnita(14, 4), 1);
  assert.equal(metriPerUnita(14000, 0), 0.001);
});

test("i nomi delle stanze: le scritte giuste, scritte bene", () => {
  assert.ok(eNomeDiStanza("CUCINA"));
  assert.ok(eNomeDiStanza("wc personale"));
  assert.ok(!eNomeDiStanza("12,40 mq"));
  assert.ok(!eNomeDiStanza("h 2,70"));
  assert.ok(!eNomeDiStanza("x"));
  assert.equal(nomeDaScritta("SALA D'ATTESA"), "Sala d'attesa");
});

test("gli strati: muri, infissi, cose che muri non sono, e quelli che non dicono niente", () => {
  for (const n of ["SEZIONE", "CAMPITURE TOMPAGNI", "MURI", "A-WALL", "muratura"])
    assert.equal(ruoloDelloStrato(n), "muro", n);
  for (const n of ["INFISSI", "finestre", "A-GLAZ"])
    assert.equal(ruoloDelloStrato(n), "infisso", n);
  /* le scale, le viste sotto e sopra il taglio, le porte aperte, lo strato 0 */
  for (const n of ["VISTA", "VISTA 2 PROIEZIONE", "PORTE", "QUOTE", "0", "SCALE", "ascensore"])
    assert.equal(ruoloDelloStrato(n), "altro", n);
  /* «SANATORIA_DIFFORMI» nel disegno vero tiene proprio dei tramezzi */
  assert.equal(ruoloDelloStrato("SANATORIA_DIFFORMI"), "forse");
});

test("le linee sanno il loro strato; con pochi muri nominati si disegna tutto", () => {
  const piani = pianiDelDisegno(pezziDelDisegno(disegno()), { insunits: 4 });
  assert.ok(piani[0].linee.some((l) => l.strato === "MURI"));
  /* cinque linee sullo strato MURI sono poche per fidarsi dei nomi */
  assert.equal(piani[0].soloMuri, false);
  const tanti = disegno();
  for (let i = 0; i < 6; i++) tanti.entities.push(linea(100 + i * 900, 200, 100 + i * 900, 9800));
  assert.equal(pianiDelDisegno(pezziDelDisegno(tanti), { insunits: 4 })[0].soloMuri, true);
});
