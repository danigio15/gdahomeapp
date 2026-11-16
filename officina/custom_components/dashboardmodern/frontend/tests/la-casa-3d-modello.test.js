/* La Casa 3D col modello di chi abita (#440): «caricare la pianta 3D fatta
 * da un altro programma e usare quella grafica».
 *
 * Una casetta GLB fatta a mano (`casetta-glb.js`), letta dal vero caricatore
 * di three; le misure raddrizzate (centimetri, Z in alto, il verso); un
 * dispositivo messo toccando il modello che resta attaccato anche se la scala
 * cambia; e i file che restano fuori: non modelli, troppo grandi, con
 * indirizzi esterni, compressi. */
import assert from "node:assert/strict";
import test from "node:test";

import * as THREE from "../legacy/vendor/three.module.min.js";
import * as caricatori from "../legacy/vendor/three-caricatori.module.min.js";
import { casettaGlb, casettaObj, glb, glbDiPezzi } from "./casetta-glb.js";
import {
  casa3dPulita,
  casaDelModello,
  contaCollegati,
  modelloPulito,
  usaIlModello,
} from "../src/core/casa-3d.js";
import {
  TRIANGOLI_PER_I_PICCOLI,
  controllaIlModello,
  formatoDelFile,
  posaDelModello,
  puntoDelFile,
  puntoNelMondo,
  troppoPerQuestoDispositivo,
  unitaProbabili,
} from "../src/core/modello-3d.js";
import { caricaLaForma, posaLaForma } from "../src/sections/casa-3d/scena-modello.js";
import {
  PEZZO_IN_SALITA,
  caricaIlModello,
  scaricaIlModello,
} from "../src/sections/casa-3d/modello-dal-ponte.js";

const vicino = (a, b, eps = 1e-3) =>
  assert.ok(Math.abs(a - b) < eps, `${a} non e' ${b}`);

test("la casetta GLB si riconosce dal contenuto e si conta", () => {
  const esito = controllaIlModello(casettaGlb());
  assert.equal(esito.ok, true);
  assert.equal(esito.formato, "glb");
  assert.equal(esito.triangoli, 128);
  assert.deepEqual(esito.confini.max.map((v) => Math.round(v * 10) / 10), [10.4, 5.2, 7.4]);
  assert.equal(controllaIlModello(casettaObj()).formato, "obj");
  assert.equal(formatoDelFile(new TextEncoder().encode("<html><script>alert(1)</script>")), "");
});

test("quello che non e' un modello, o e' troppo, resta fuori col suo perche'", () => {
  const no = (dati, opzioni) => controllaIlModello(dati, opzioni).errore;
  assert.equal(no(new Uint8Array()), "vuoto");
  assert.equal(no(Buffer.from("PK\x03\x04 un archivio", "latin1")), "sconosciuto");
  assert.equal(no(Buffer.from("\x89PNG\r\n\x1a\n........", "latin1")), "sconosciuto");
  assert.equal(no(Buffer.from("<svg onload='x'></svg>")), "sconosciuto");
  assert.equal(no(casettaGlb(), { massimo: 1000 }), "grande");
  assert.equal(no(casettaGlb().subarray(0, 100)), "rotto");
  /* rimanda fuori: un indirizzo, un file accanto */
  const esterno = casettaGlb({ json: { images: [{ uri: "https://esempio.it/muro.jpg" }] } });
  assert.equal(no(esterno), "esterno");
  const accanto = glb({ asset: { version: "2.0" }, buffers: [{ uri: "casa.bin", byteLength: 8 }] });
  assert.equal(no(accanto), "esterno");
  assert.equal(no(casettaGlb({ json: { extensionsRequired: ["KHR_draco_mesh_compression"] } })), "compresso");
  assert.equal(no(casettaGlb({ json: { extensionsRequired: ["ACME_segreto"] } })), "estensione");
  assert.equal(no(glb({ asset: { version: "1.0" } })), "versione");
  assert.equal(no(glb({ asset: { version: "2.0" } })), "senza-facce");
  /* quattro milioni di triangoli dichiarati: non si prova nemmeno */
  const enorme = glb({
    asset: { version: "2.0" },
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ count: 15_000_000, type: "VEC3", componentType: 5126 }],
    buffers: [{ byteLength: 4 }],
  }, Buffer.alloc(4));
  assert.equal(no(enorme), "pesante");
});

test("il vero caricatore di three legge la casetta, e i rifiuti arrivano prima di lui", async () => {
  const forma = await caricaLaForma(THREE, caricatori, casettaGlb());
  assert.equal(forma.formato, "glb");
  let maglie = 0;
  forma.radice.traverse((o) => (maglie += o.isMesh ? 1 : 0));
  assert.equal(maglie, 11);
  const obj = await caricaLaForma(THREE, caricatori, casettaObj());
  assert.equal(obj.formato, "obj");
  await assert.rejects(
    caricaLaForma(THREE, caricatori, casettaGlb({ json: { images: [{ uri: "http://x/y.png" }] } })),
    (errore) => errore.motivo === "esterno",
  );
});

test("la scala: in centimetri, con Z in alto, girata — sempre la stessa casa", () => {
  const misure = (dati, imp) => posaDelModello(controllaIlModello(dati).confini, imp).misure.map((v) => Math.round(v * 100) / 100);
  const giusta = misure(casettaGlb(), {});
  assert.deepEqual(giusta, [10.8, 5.2, 7.8]);
  const inCm = casettaGlb({ scala: 100 });
  assert.equal(unitaProbabili(Math.max(...controllaIlModello(inCm).confini.max)), "cm");
  assert.equal(unitaProbabili(10.4), "m");
  assert.equal(unitaProbabili(10400 * 10), "mm");
  assert.deepEqual(misure(inCm, { unita: "cm" }), giusta);
  assert.deepEqual(misure(casettaGlb({ zSu: true }), { su: "z" }), giusta);
  assert.deepEqual(misure(casettaGlb(), { rot: 90 }), [7.8, 5.2, 10.8]);
  assert.deepEqual(misure(casettaGlb(), { scala: 2 }), [21.6, 10.4, 15.6]);
  /* in mezzo al prato, coi piedi a terra */
  const posa = posaDelModello(controllaIlModello(inCm).confini, { unita: "cm" });
  vicino(posa.confini.min[1], 0);
  vicino(posa.confini.min[0] + posa.confini.max[0], 0);
});

test("un dispositivo messo toccando il modello resta attaccato, anche cambiando la scala", async () => {
  const forma = await caricaLaForma(THREE, caricatori, casettaGlb({ scala: 100 }));
  const gruppo = new THREE.Group();
  gruppo.add(forma.radice);
  const posa = posaLaForma(THREE, gruppo, forma.confini, { unita: "cm" });
  /* un raggio dall'alto, sul colmo del tetto */
  const raggio = new THREE.Raycaster(new THREE.Vector3(0, 50, 0), new THREE.Vector3(0, -1, 0));
  const colpo = raggio.intersectObject(gruppo, true)[0];
  assert.ok(colpo, "il raggio non tocca la casetta");
  vicino(colpo.point.y, 5.2, 0.02);
  const dove = puntoDelFile(posa.matrice, colpo.point.toArray());
  /* nel file e' in centimetri: il colmo sta a 520 */
  vicino(dove.y, 520, 1);
  const torna = puntoNelMondo(posa.matrice, dove);
  for (let i = 0; i < 3; i++) vicino(torna[i], colpo.point.toArray()[i], 1e-3);
  /* lo stesso punto del file, con la scala doppia, sta ancora sul colmo */
  const doppia = posaLaForma(THREE, gruppo, forma.confini, { unita: "cm", scala: 2 });
  vicino(puntoNelMondo(doppia.matrice, dove)[1], 10.4, 0.05);
});

test("il modello nel config: pulito, acceso, e i suoi dispositivi contati una volta", () => {
  const c = casa3dPulita({
    attiva: true,
    modello: {
      id: "0123456789abcdef",
      formato: "glb",
      nome: "casa.glb",
      unita: "cm",
      su: "z",
      rot: 270,
      scala: 1e9,
      dispositivi: [
        { k: "luce", x: 100, y: 250, z: -30, entity: "light.salone" },
        { k: "razzo", x: 1 },
        { k: "telecamera", x: 0, y: 0, z: 0, entity: "non valida" },
      ],
    },
  });
  assert.equal(c.modello.unita, "cm");
  assert.equal(c.modello.su, "z");
  assert.equal(c.modello.rot, 180);
  assert.equal(c.modello.scala, 1000);
  assert.deepEqual(c.modello.dispositivi.map((d) => [d.k, d.entity, d.z]), [
    ["luce", "light.salone", -30],
    ["telecamera", "", 0],
  ]);
  assert.equal(usaIlModello(c), true);
  assert.equal(modelloPulito({ id: "../../segreti", formato: "glb" }), null);
  assert.equal(modelloPulito({ id: "0123456789abcdef", formato: "fbx" }), null);
  assert.equal(casa3dPulita({}).modello, null);
  const vista = casaDelModello(c, "La mia casa");
  assert.deepEqual(vista.piani.map((p) => [p.k, p.nome, p.dispositivi.length]), [["modello", "La mia casa", 2]]);
  assert.deepEqual(contaCollegati(c), { tutti: 2, collegati: 1, mancano: 1 });
  assert.deepEqual(contaCollegati(vista), { tutti: 2, collegati: 1, mancano: 1 });
  /* spento resta scritto, e la casa generata torna lei */
  assert.equal(usaIlModello(casa3dPulita({ ...c, modello: { ...c.modello, attivo: false } })), false);
});

test("su un tablet piccolo un modello enorme lascia il posto alla casa generata", () => {
  const pesante = { triangoli: TRIANGOLI_PER_I_PICCOLI + 1 };
  assert.equal(troppoPerQuestoDispositivo(pesante, { deviceMemory: 2, hardwareConcurrency: 8 }), true);
  assert.equal(troppoPerQuestoDispositivo(pesante, { deviceMemory: 8, hardwareConcurrency: 8 }), false);
  assert.equal(troppoPerQuestoDispositivo({ triangoli: 1000 }, { deviceMemory: 1 }), false);
});

test("sale a pezzi in ordine, e riscende intero", async () => {
  const byte = new Uint8Array(PEZZO_IN_SALITA * 2 + 1234).map((_v, i) => i % 251);
  const arrivati = [];
  const chiedi = async (m) => {
    if (m.type === "ponte/casa3d/modello/inizia") return { caricamento: "abc" };
    if (m.type === "ponte/casa3d/modello/pezzo") {
      assert.equal(m.indice, arrivati.length);
      arrivati.push(Buffer.from(m.data, "base64"));
      return { ricevuti: 0 };
    }
    if (m.type === "ponte/casa3d/modello/fine")
      return { id: "0123456789abcdef", formato: "glb", peso: byte.length, impronta: "ff".repeat(16) };
    throw new Error(m.type);
  };
  const avanzamenti = [];
  const fatto = await caricaIlModello(byte, { chiedi, profilo: "casa_3d", quandoAvanza: (a, b) => avanzamenti.push([a, b]) });
  assert.equal(arrivati.length, 3);
  assert.ok(arrivati.every((p) => p.length <= PEZZO_IN_SALITA));
  /* confronti coi byte, non con deepEqual: un megabyte diverso fa un diff enorme */
  assert.equal(Buffer.compare(Buffer.concat(arrivati), Buffer.from(byte)), 0);
  assert.deepEqual(avanzamenti.at(-1), [byte.length, byte.length]);
  const tutto = Buffer.from(byte);
  const giu = await scaricaIlModello(fatto, {
    chiedi: async (m) => {
      const pezzo = tutto.subarray(m.da, m.da + 300 * 1024);
      return { peso: tutto.length, da: m.da, corpo: pezzo.toString("base64"), fine: m.da + pezzo.length >= tutto.length };
    },
  });
  assert.equal(Buffer.compare(Buffer.from(giu), Buffer.from(byte)), 0);
  /* il no del ponte arriva col suo motivo */
  await assert.rejects(
    caricaIlModello(byte, {
      chiedi: async () => {
        throw Object.assign(new Error("pieno"), { code: "storage_full" });
      },
    }),
    (errore) => errore.motivo === "pieno",
  );
});

test("le scatole di prova sono quelle che dicono di essere", () => {
  /* la casetta ha 11 pezzi; uno solo, senza tetto, e' una scatola */
  const una = glbDiPezzi([]);
  assert.equal(controllaIlModello(una).errore, "senza-facce");
});
