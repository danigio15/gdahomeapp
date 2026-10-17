/* Le colonnine rapide nella casa (`colonnine.js`).
 *
 * Quello che deve restare vero: l'archivio si scarica una volta e poi una
 * volta a settimana, e si tiene su disco; un file rotto o troppo grande non
 * entra e non butta via quello buono; se la rete non risponde non si aspetta
 * e non si richiede a ogni strada; le colonnine si trovano vicino alla
 * strada, e solo li'.
 */

import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";

import {
  apriLArchivio,
  archivioPulito,
  Colonnine,
  indice,
  INDIRIZZO_DELLE_COLONNINE,
  PESO_MASSIMO,
  vicinoAllaLinea,
} from "../src/colonnine.js";

const GIORNO = 24 * 60 * 60_000;

/* Un pezzo d'archivio nel formato dell'app: due rapide sull'A1 vicino a
 * Caserta, una lontana, una riga storta. */
const ARCHIVIO = {
  v: 1,
  generato: "2026-10-12T05:10:58Z",
  evseInOrdine: true,
  q: [
    [81, 28],
    [82, 28],
  ],
  c: [
    [
      41.0,
      14.3,
      "osm-node-1",
      "Area di servizio Est",
      "Operatore A",
      [
        [0, 150, 2],
        [2, 22, 1],
      ],
    ],
    [
      41.2,
      14.2,
      "osm-node-2",
      "Area di servizio Nord",
      "Operatore B",
      [[0, 300, 4]],
      "osm+pun",
      ["IT*ABC*E1"],
    ],
    [41.1, 14.9, "osm-node-3", "Lontana", "", [[0, 100, 1]]],
    ["41", 14, "osm-node-4", "Storta", "", [[0, 50, 1]]],
  ],
};

const gz = (dati) => gzipSync(Buffer.from(JSON.stringify(dati)));

function scaricaFinta(risposte) {
  const chiesti = [];
  const scarica = async (indirizzo) => {
    chiesti.push(indirizzo);
    const prossima = risposte.length > 1 ? risposte.shift() : risposte[0];
    if (prossima instanceof Error) throw prossima;
    if (typeof prossima === "function") return prossima();
    return new Response(prossima, { status: 200 });
  };
  return { chiesti, scarica };
}

function cartella(t) {
  const dove = mkdtempSync(join(tmpdir(), "colonnine-"));
  t.after(() => rmSync(dove, { recursive: true, force: true }));
  return dove;
}

test("l'archivio si legge come quello dell'app, e le righe storte si saltano", () => {
  const letto = apriLArchivio(gz(ARCHIVIO));
  assert.equal(letto.generato, "2026-10-12T05:10:58Z");
  assert.equal(letto.evseInOrdine, true);
  assert.equal(letto.colonnine.length, 3);
  assert.deepEqual(letto.colonnine[0], {
    lat: 41,
    lon: 14.3,
    id: "osm-node-1",
    nome: "Area di servizio Est",
    operatore: "Operatore A",
    kw: 150,
  });
  assert.equal(letto.colonnine[1].kw, 300);
  /* Anche in chiaro, senza gzip. */
  assert.equal(apriLArchivio(Buffer.from(JSON.stringify(ARCHIVIO))).colonnine.length, 3);
  /* Un'altra versione, niente righe buone, un JSON rotto: niente archivio. */
  assert.equal(archivioPulito({ ...ARCHIVIO, v: 2 }), null);
  assert.equal(archivioPulito({ ...ARCHIVIO, c: [["a", "b"]] }), null);
  assert.equal(apriLArchivio(Buffer.from("{non e' json")), null);
  assert.equal(apriLArchivio(Buffer.from([0x1f, 0x8b, 1, 2, 3])), null);
  /* Potenze assurde non contano. */
  const assurda = archivioPulito({ v: 1, c: [[41, 14, "x", "X", "", [[0, 99999, 1]]]] });
  assert.equal(assurda, null);
});

test("si scarica alla prima richiesta, si tiene su disco, e si rifa' dopo una settimana", async (t) => {
  const dove = cartella(t);
  let ora = Date.UTC(2026, 9, 16, 7);
  const { chiesti, scarica } = scaricaFinta([gz(ARCHIVIO)]);
  const colonnine = new Colonnine({ cartella: dove, scarica, adesso: () => ora });
  const archivio = await colonnine.pronto();
  assert.equal(archivio.colonnine.length, 3);
  assert.deepEqual(chiesti, [INDIRIZZO_DELLE_COLONNINE]);
  assert.ok(readdirSync(dove).includes("colonnine-rapide.json.gz"));
  assert.ok(!readdirSync(dove).some((f) => f.endsWith(".parziale")));
  /* Il giorno dopo: si usa quello che c'e'. */
  ora += GIORNO;
  await colonnine.pronto();
  assert.equal(chiesti.length, 1);
  /* Riacceso l'add-on: si legge dal disco, senza scaricare. */
  const riacceso = new Colonnine({ cartella: dove, scarica, adesso: () => ora });
  assert.equal((await riacceso.pronto()).colonnine.length, 3);
  assert.equal(chiesti.length, 1);
  /* Dopo una settimana si riscarica, ma intanto si usa quello di prima. */
  ora += 7 * GIORNO;
  assert.equal((await riacceso.pronto()).colonnine.length, 3);
  await riacceso._inCorso;
  assert.equal(chiesti.length, 2);
});

test("un archivio rotto o troppo grande non entra, e non butta quello buono", async (t) => {
  const dove = cartella(t);
  let ora = Date.UTC(2026, 9, 16, 7);
  const troppo = Buffer.alloc(PESO_MASSIMO + 1, 0x20);
  const { chiesti, scarica } = scaricaFinta([
    Buffer.from("niente di buono"),
    troppo,
    () =>
      new Response("x", { status: 200, headers: { "content-length": String(PESO_MASSIMO * 4) } }),
    gz(ARCHIVIO),
    gz({ v: 1, c: [] }),
  ]);
  const colonnine = new Colonnine({ cartella: dove, scarica, adesso: () => ora });
  assert.equal(await colonnine.pronto(), null, "rotto");
  /* Non si richiede a ogni strada: si riprova fra un'ora. */
  assert.equal(await colonnine.pronto(), null);
  assert.equal(chiesti.length, 1);
  ora += 61 * 60_000;
  assert.equal(await colonnine.pronto(), null, "troppo grande");
  ora += 61 * 60_000;
  assert.equal(await colonnine.pronto(), null, "troppo grande a dirlo");
  ora += 61 * 60_000;
  assert.equal((await colonnine.pronto()).colonnine.length, 3);
  /* Una settimana dopo arriva un archivio vuoto: si tiene il buono. */
  ora += 8 * GIORNO;
  await colonnine.pronto();
  await colonnine._inCorso;
  assert.equal(chiesti.length, 5);
  assert.equal((await colonnine.pronto()).colonnine.length, 3);
  const riacceso = new Colonnine({ cartella: dove, scarica, adesso: () => ora });
  assert.equal((await riacceso.pronto()).colonnine.length, 3, "su disco resta il buono");
});

test("se la rete non risponde non si aspetta: si torna senza archivio", async () => {
  const colonnine = new Colonnine({
    scarica: () => new Promise(() => {}),
    adesso: () => Date.UTC(2026, 9, 16, 7),
  });
  const prima = Date.now();
  assert.equal(await colonnine.pronto({ attesaMs: 50 }), null);
  assert.ok(Date.now() - prima < 2000);
  const giu = new Colonnine({ scarica: scaricaFinta([new Error("rete")]).scarica });
  assert.deepEqual(
    await giu.lungo([
      [14, 41],
      [14.1, 41.1],
    ]),
    { colonnine: [], archivio: false },
  );
});

test("le colonnine vicino alla strada, in ordine di strada, e solo quelle", () => {
  const { colonnine } = archivioPulito(ARCHIVIO);
  /* Una strada dritta da sud a nord che passa per 14.25 di longitudine. */
  const linea = [
    [14.25, 40.9],
    [14.25, 41.05],
    [14.25, 41.3],
  ];
  const trovate = vicinoAllaLinea(indice(colonnine), linea, { kmTotali: 50, corridoioKm: 6 });
  assert.deepEqual(
    trovate.map((c) => c.nome),
    ["Area di servizio Est", "Area di servizio Nord"],
  );
  assert.ok(trovate[0].km < trovate[1].km);
  assert.ok(trovate.every((c) => c.scostoKm <= 6));
  /* Col corridoio stretto restano fuori: sono a 4 km dalla strada. */
  assert.deepEqual(vicinoAllaLinea(indice(colonnine), linea, { corridoioKm: 2 }), []);
  assert.deepEqual(vicinoAllaLinea(indice(colonnine), [], {}), []);
});
