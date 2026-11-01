/* «Crea la tua casa»: dalla procedura guidata al piano salvato.
 *
 * Una casa finta di due stanze (muri disegnati a mano su una griglia da 3 cm,
 * una porta fra le due, una finestra), riconosciuta come dalla foto; poi i
 * nomi dalle aree di Home Assistant, una foto con un divano e un punto luce
 * segnato, un sensore aggiunto senza foto. Il piano che esce deve riaprirsi
 * uguale, con le stanze giuste e i dispositivi dentro la loro stanza. */

import assert from "node:assert/strict";
import test from "node:test";
import { CELLA, casa3dPulita, espandiGriglia } from "../src/core/casa-3d.js";
import { riconosciDaFoto } from "../src/core/pianta-da-foto.js";
import {
  aggiungiPiano,
  areeDaiRegistri,
  entitaUsate,
  oggettiDaCoco,
  pavimentoDalColore,
  pianoDaRiconoscimento,
  pianoDelLivello,
  posaDallaFoto,
  riprendiIlPiano,
} from "../src/core/crea-casa.js";

/* 8×5 m dentro una griglia di 10×7 m: muri da 30 cm fuori, 12 cm dentro a 4 m
 * con una porta da 90 cm, una finestra da 1,2 m in basso a destra. */
function casaFinta() {
  const P = 0.03,
    W = Math.round(10 / P),
    H = Math.round(7 / P);
  const muro = new Uint8Array(W * H),
    barriera = new Uint8Array(W * H);
  const c = (m) => Math.round(m / P);
  const pieno = (x0, y0, x1, y1, dove = muro) => {
    for (let y = c(y0); y < c(y1); y++) for (let x = c(x0); x < c(x1); x++) dove[y * W + x] = 1;
  };
  pieno(1, 1, 9, 1.3);
  pieno(1, 1, 1.3, 6);
  pieno(8.7, 1, 9, 6);
  pieno(1, 5.7, 6.4, 6);
  pieno(7.6, 5.7, 9, 6);
  pieno(4.94, 1.3, 5.06, 3.0);
  pieno(4.94, 3.9, 5.06, 5.7);
  for (let i = 0; i < W * H; i++) barriera[i] = muro[i];
  pieno(6.4, 5.82, 7.6, 5.88, barriera); // le righe della finestra
  return riconosciDaFoto({ W, H, muro, barriera });
}

test("dalla casa riconosciuta al piano: la griglia compressa si riapre e le stanze hanno nome e area", () => {
  const casa = casaFinta();
  assert.equal(casa.stanze.length, 2, "due stanze");
  const [a, b] = casa.stanze;
  const piano = pianoDaRiconoscimento({
    casa,
    nomi: { [a.id]: "Salone", [b.id]: "Camera" },
    aree: { [a.id]: "soggiorno", [b.id]: "camera_da_letto" },
    livello: 0,
  });
  assert.equal(piano.k, "terra");
  assert.equal(piano.nome, "Piano terra");
  assert.equal(piano.passo, 0.05);
  /* ritagliata sulla casa: 8 m piu' mezzo metro per parte, a 5 cm */
  assert.ok(Math.abs(piano.W - 180) <= 2, `larghezza ${piano.W}`);
  assert.ok(Math.abs(piano.H - 120) <= 2, `profondita' ${piano.H}`);
  const t = espandiGriglia(piano.griglia, piano.W * piano.H);
  const valori = new Set(t);
  assert.ok(
    valori.has(a.id) && valori.has(b.id) && valori.has(CELLA.muro) && valori.has(CELLA.fuori),
  );
  assert.ok(piano.griglia.length < (piano.W * piano.H) / 4, "compressa");
  assert.deepEqual(
    piano.stanze.map((s) => [s.nome, s.area]),
    [
      ["Salone", "soggiorno"],
      ["Camera", "camera_da_letto"],
    ],
  );
  assert.ok(
    piano.aperture.some((x) => x.tipo === "porta"),
    "la porta",
  );
  assert.ok(
    piano.aperture.some((x) => x.tipo === "finestra"),
    "la finestra",
  );
  for (const x of piano.aperture)
    assert.ok(x.x > 0 && x.x < 9 && x.y > 0 && x.y < 6, "in metri, nella casa ritagliata");
  /* e passa intero dalla casa pulita */
  const pulita = casa3dPulita({ attiva: true, piani: [piano] });
  assert.equal(pulita.attiva, true);
  assert.equal(pulita.piani[0].stanze[0].area, "soggiorno");
  assert.equal(pulita.piani[0].aperture.length, piano.aperture.length);
});

function stanzaNellaGriglia(piano, d) {
  const t = espandiGriglia(piano.griglia, piano.W * piano.H);
  const x = Math.floor(d.x / piano.passo),
    y = Math.floor(d.y / piano.passo);
  /* nella stanza, o a una cella dal suo bordo */
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) if (t[(y + dy) * piano.W + x + dx] === d.stanza) return true;
  return false;
}

test("arredi e dispositivi dalle foto, e quelli aggiunti a mano, stanno nella loro stanza con la loro entita'", () => {
  const casa = casaFinta();
  const [a, b] = casa.stanze;
  const piano = pianoDaRiconoscimento({
    casa,
    nomi: { [a.id]: "Salone", [b.id]: "Camera" },
    foto: {
      [a.id]: [
        {
          verso: "N",
          w: 1000,
          h: 750,
          pavimento: "#c19a6b",
          pareti: "#f4f1ea",
          oggetti: [
            { k: "divano", box: [300, 450, 400, 250], colore: "#556677" },
            { k: "razzo", box: [0, 0, 10, 10] },
          ],
          dispositivi: [
            { k: "luce", box: [480, 40, 60, 40], entity: "light.salone" },
            { k: "telecamera", box: [900, 20, 50, 40], entity: "non valida" },
          ],
        },
      ],
    },
    dispositivi: [
      { k: "fumo", stanza: b.id, entity: "binary_sensor.fumo_camera" },
      { k: "finestra", stanza: b.id, entity: "binary_sensor.finestra_camera" },
      { k: "presa", stanza: 99, entity: "switch.da_nessuna_parte" },
    ],
  });
  assert.equal(piano.arredi.length, 1, "il razzo non e' un arredo");
  assert.equal(piano.arredi[0].k, "divano");
  assert.equal(piano.arredi[0].tinta, "#556677");
  assert.ok(stanzaNellaGriglia(piano, piano.arredi[0]));
  assert.equal(piano.dispositivi.length, 4, "quello di una stanza che non c'e' non entra");
  const luce = piano.dispositivi.find((d) => d.k === "luce");
  assert.equal(luce.entity, "light.salone");
  assert.equal(luce.da, "foto");
  assert.equal(luce.stanza, a.id);
  assert.ok(luce.h > 2.5, "al soffitto");
  assert.equal(
    piano.dispositivi.find((d) => d.k === "telecamera").entity,
    "",
    "un'entita' scritta male non si tiene",
  );
  const fumo = piano.dispositivi.find((d) => d.k === "fumo");
  assert.equal(fumo.entity, "binary_sensor.fumo_camera");
  assert.equal(fumo.da, "mano");
  for (const d of piano.dispositivi)
    assert.ok(stanzaNellaGriglia(piano, d), `${d.k} fuori dalla sua stanza (${d.x}, ${d.y})`);
  /* il sensore della finestra va sulla finestra della camera */
  const fin = piano.dispositivi.find((d) => d.k === "finestra");
  const vano = piano.aperture.find((x) => x.tipo === "finestra");
  assert.ok(Math.hypot(fin.x - vano.x, fin.y - vano.y) < 0.5, "sulla finestra");
  /* i colori della foto: un marrone caldo e' parquet */
  assert.deepEqual(piano.stanze[0].pavimento, { tipo: "listoni", colore: "#c19a6b" });
  assert.equal(piano.stanze[0].pareti, "#f4f1ea");
  assert.equal(piano.stanze[1].pavimento, null);
  /* e la casa pulita li tiene */
  const pulita = casa3dPulita({ attiva: true, piani: [piano] });
  assert.equal(pulita.piani[0].dispositivi.length, 4);
  assert.deepEqual(entitaUsate(pulita).sort(), [
    "binary_sensor.finestra_camera",
    "binary_sensor.fumo_camera",
    "light.salone",
  ]);
});

/* «Dare la possibilita' di modificare di nuovo la planimetria»: un piano
 * salvato torna nella procedura con le stesse stanze, i nomi, le aree, i
 * colori, gli arredi e i dispositivi; salvato di nuovo e' lo stesso piano. */
test("un piano salvato si riprende e risalvato resta uguale", () => {
  const casa = casaFinta();
  const [a, b] = casa.stanze;
  const prima = casa3dPulita({
    piani: [
      pianoDaRiconoscimento({
        casa,
        nomi: { [a.id]: "Salone", [b.id]: "Camera" },
        aree: { [a.id]: "soggiorno" },
        foto: {
          [a.id]: [
            {
              verso: "N",
              w: 1000,
              h: 750,
              pavimento: "#c19a6b",
              pareti: "#f4f1ea",
              oggetti: [{ k: "divano", box: [300, 450, 400, 250], colore: "#556677" }],
              dispositivi: [{ k: "luce", box: [480, 40, 60, 40], entity: "light.salone" }],
            },
          ],
        },
        dispositivi: [{ k: "fumo", stanza: b.id, entity: "binary_sensor.fumo_camera" }],
        livello: 1,
      }),
    ],
  }).piani[0];
  const r = riprendiIlPiano(prima);
  assert.ok(r, "si riprende");
  assert.equal(r.casa.stanze.length, 2, "le due stanze di nuovo");
  assert.deepEqual(Object.values(r.nomi).sort(), ["Camera", "Salone"]);
  const salone = Number(Object.keys(r.nomi).find((id) => r.nomi[id] === "Salone"));
  assert.equal(r.aree[salone], "soggiorno");
  assert.equal(r.finiture[salone].pareti, "#f4f1ea");
  assert.equal(r.dispositivi.length, 2);
  assert.ok(r.dispositivi.every((d) => r.casa.stanze.some((s) => s.id === d.stanza)));
  assert.equal(r.arredi.length, 1);
  /* risalvato: stesse stanze, stessi arredi e dispositivi nello stesso posto */
  const dopo = casa3dPulita({
    piani: [
      pianoDaRiconoscimento({
        casa: r.casa,
        nomi: r.nomi,
        aree: r.aree,
        finiture: r.finiture,
        arredi: r.arredi,
        dispositivi: r.dispositivi,
        livello: prima.livello,
      }),
    ],
  }).piani[0];
  assert.equal(dopo.k, prima.k);
  assert.ok(Math.abs(dopo.W - prima.W) <= 2 && Math.abs(dopo.H - prima.H) <= 2, "stessa misura");
  assert.deepEqual(
    dopo.stanze.map((s) => [s.nome, s.area, s.pareti]).sort(),
    prima.stanze.map((s) => [s.nome, s.area, s.pareti]).sort(),
  );
  assert.deepEqual(
    dopo.stanze.find((s) => s.nome === "Salone").pavimento,
    prima.stanze.find((s) => s.nome === "Salone").pavimento,
  );
  assert.equal(prima.stanze.find((s) => s.nome === "Salone").pavimento.tipo, "listoni");
  assert.equal(dopo.aperture.length, prima.aperture.length, "porta e finestra");
  for (const d of prima.dispositivi) {
    const q = dopo.dispositivi.find((x) => x.k === d.k);
    assert.equal(q.entity, d.entity);
    assert.equal(q.da, d.da);
    assert.ok(Math.hypot(q.x - d.x, q.y - d.y) < 0.15, `${d.k} allo stesso posto`);
    assert.ok(stanzaNellaGriglia(dopo, q), `${d.k} nella sua stanza`);
  }
  assert.equal(dopo.arredi.length, 1);
  assert.ok(
    Math.hypot(dopo.arredi[0].x - prima.arredi[0].x, dopo.arredi[0].y - prima.arredi[0].y) < 0.15,
  );
  assert.equal(riprendiIlPiano({ W: 0 }), null);
});

test("la foto si legge lungo la parete che si guarda", () => {
  const stanza = { id: 1, sx: 2, sy: 2, riquadro: { x0: 0, x1: 4, y0: 0, y1: 4 } };
  const foto = { w: 100, h: 100 };
  const sinistra = posaDallaFoto(stanza, { ...foto, verso: "N" }, [0, 80, 10, 20]);
  assert.ok(sinistra.x < 1 && sinistra.y > 3, "a sinistra e vicino a chi scatta");
  const parete = posaDallaFoto(stanza, { ...foto, verso: "E" }, [45, 30, 10, 10], {
    accostato: true,
  });
  assert.ok(parete.x > 3.5 && Math.abs(parete.y - 2) < 0.2, "contro la parete a est");
  const soffitto = posaDallaFoto(stanza, { ...foto, verso: "S" }, [45, 0, 10, 10], {
    mont: "soffitto",
  });
  assert.ok(soffitto.y < 1, "il punto luce in alto nella foto e' vicino a chi scatta");
});

test("una stanza fuori diventa fuori, e le sue porte finestre", () => {
  const casa = casaFinta();
  const [a, b] = casa.stanze;
  const piano = pianoDaRiconoscimento({ casa, fuori: [b.id], nomi: { [a.id]: "Salone" } });
  assert.deepEqual(
    piano.stanze.map((s) => s.id),
    [a.id],
  );
  const t = espandiGriglia(piano.griglia, piano.W * piano.H);
  assert.ok(!new Set(t).has(b.id));
  const porta = piano.aperture.find((x) => x.portafinestra);
  assert.ok(porta, "la porta verso fuori e' una portafinestra");
  assert.equal(porta.tipo, "finestra");
  assert.equal(porta.stanza, a.id);
});

test("i piani si accumulano, e uno con la stessa chiave si sostituisce", () => {
  const casa = casaFinta();
  const terra = pianoDaRiconoscimento({ casa, livello: 0 });
  const primo = pianoDaRiconoscimento({ casa, livello: 1 });
  const sotto = pianoDaRiconoscimento({ casa, livello: -1 });
  let c = aggiungiPiano({ tipo: "villa" }, terra);
  c = aggiungiPiano(c, primo);
  c = aggiungiPiano(c, sotto);
  assert.deepEqual(
    c.piani.map((p) => p.k),
    ["seminterrato", "terra", "primo"],
  );
  assert.equal(c.tipo, "villa");
  const rifatto = { ...primo, nome: "Primo piano rifatto" };
  c = aggiungiPiano(c, rifatto);
  assert.equal(c.piani.length, 3);
  assert.equal(c.piani.find((p) => p.k === "primo").nome, "Primo piano rifatto");
  assert.deepEqual(pianoDelLivello(1).nome, ["Primo piano", "First floor"]);
  assert.equal(pianoDelLivello(9).k, "piano9");
});

test("quello che vede COCO-SSD diventa arredi e dispositivi", () => {
  const { arredi, dispositivi } = oggettiDaCoco([
    { class: "couch", bbox: [10, 10, 200, 100], score: 0.9 },
    { class: "tv", bbox: [300, 50, 120, 70], score: 0.8 },
    { class: "chair", bbox: [500, 100, 60, 80], score: 0.7 },
    { class: "chair", bbox: [505, 102, 58, 78], score: 0.5 },
    { class: "person", bbox: [0, 0, 50, 50], score: 0.99 },
    { class: "bed", bbox: [0, 0, 50, 50], score: 0.1 },
    { class: "laptop", bbox: [0, 0, 0, 50], score: 0.9 },
  ]);
  assert.deepEqual(
    arredi.map((o) => o.k),
    ["divano", "tv", "poltrona"],
  );
  assert.deepEqual(
    dispositivi.map((o) => o.k),
    ["tv"],
  );
  assert.deepEqual(dispositivi[0].box, [300, 50, 120, 70]);
});

test("le aree e di chi sono le entita', dai registri del guscio o di Home Assistant", () => {
  const { aree, diEntita } = areeDaiRegistri({
    wiz: {
      areaNames: { soggiorno: "Soggiorno" },
      entReg: { "light.a": { a: "soggiorno" }, "light.b": { d: "dev1" } },
      devArea: { dev1: "cucina" },
    },
    hass: {
      areas: { cucina: { area_id: "cucina", name: "Cucina" } },
      entities: { "camera.c": { device_id: "dev2" } },
      devices: { dev2: { area_id: "cucina" } },
    },
  });
  assert.deepEqual(aree, { soggiorno: "Soggiorno", cucina: "Cucina" });
  assert.deepEqual(diEntita, { "light.a": "soggiorno", "light.b": "cucina", "camera.c": "cucina" });
  const ricordate = areeDaiRegistri({ ricordate: { "light.x": "Bagno" } });
  assert.deepEqual(ricordate, { aree: { Bagno: "Bagno" }, diEntita: { "light.x": "Bagno" } });
  assert.equal(pavimentoDalColore("#eeeae3").tipo, "gres60");
  assert.equal(pavimentoDalColore("boh"), null);
});

/* «Devi perfezionare la ricerca delle cose tramite le foto della stanza»:
 * il lavandino del bagno e' un lavabo, e il forno e' un elettrodomestico. */
test("dalle foto: il lavandino del bagno e' un lavabo, il forno un elettrodomestico", () => {
  const sink = { class: "sink", bbox: [100, 300, 200, 150], score: 0.8 };
  assert.deepEqual(
    oggettiDaCoco([sink], { stanza: "Bagno" }).arredi.map((a) => a.k),
    ["lavabo"],
  );
  assert.deepEqual(
    oggettiDaCoco([sink, { class: "toilet", bbox: [400, 300, 150, 200], score: 0.7 }]).arredi.map(
      (a) => a.k,
    ),
    ["lavabo", "wc"],
    "col WC nella foto anche senza il nome",
  );
  assert.deepEqual(
    oggettiDaCoco([sink], { stanza: "Cucina" }).arredi.map((a) => a.k),
    ["cucina"],
  );
  const forno = oggettiDaCoco([{ class: "oven", bbox: [0, 0, 100, 100], score: 0.6 }]);
  assert.deepEqual(
    forno.dispositivi.map((d) => d.k),
    ["forno"],
  );
  /* la stessa cosa vista nella foto intera e in un ritaglio e' una sola */
  const due = oggettiDaCoco([
    { class: "couch", bbox: [100, 200, 600, 300], score: 0.8 },
    { class: "couch", bbox: [120, 210, 560, 280], score: 0.6 },
  ]);
  assert.equal(due.arredi.length, 1);
});
