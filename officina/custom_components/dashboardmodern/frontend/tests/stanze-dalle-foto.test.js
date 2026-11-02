/* La pianta dalle foto delle stanze: le misure dalle cose di misura nota,
 * la disposizione, le porte e le finestre, la griglia che il riconoscitore
 * legge come una casa intera. */
import assert from "node:assert/strict";
import test from "node:test";
import { riconosciDaFoto } from "../src/core/pianta-da-foto.js";
import {
  MISURA_MASSIMA,
  MISURA_MINIMA,
  MISURE_DI_SERIE,
  disponiLeStanze,
  distanzaDellaParete,
  finestreDelleStanze,
  grigliaDalleStanze,
  misureDallaFoto,
  misureDellaStanza,
  porteFraLeStanze,
  stanzeRitrovate,
  tipoDellaStanza,
} from "../src/core/stanze-dalle-foto.js";

/* La cucina di Marco, 4000×2252 a 23 mm: il forno (60 cm) largo 437 pixel,
 * il microonde 413, un forno visto due volte (anche con la colonna). */
const cucina = {
  w: 4000,
  h: 2252,
  f35: 23,
  visti: [
    { class: "Oven", bbox: [2138, 1600, 437, 396], score: 0.74 },
    { class: "Oven", bbox: [2133, 1193, 443, 806], score: 0.47 },
    { class: "Microwave", bbox: [2136, 1199, 413, 307], score: 0.63 },
    { class: "Stool", bbox: [540, 1891, 351, 361], score: 0.79 },
    { class: "Bottle", bbox: [1386, 1431, 99, 307], score: 0.87 },
    { class: "Chair", bbox: [0, 1772, 291, 479], score: 0.65 },
  ],
};

test("la distanza della parete dal forno: 60 cm larghi 437 pixel a 23 mm sono 3,6 metri", () => {
  const d = distanzaDellaParete(cucina.visti, cucina);
  assert.equal(Math.round(d.distanza * 10) / 10, 3.6);
  assert.deepEqual(d.riferimenti, ["oven", "microwave"], "sgabelli e bottiglie non contano");
  /* senza EXIF vale la focale di serie (25 mm): un filo piu' lontano */
  const senza = distanzaDellaParete(cucina.visti, { w: 4000, h: 2252 });
  assert.ok(senza.distanza > d.distanza && senza.distanza < d.distanza * 1.15, senza.distanza);
  /* tagliato dal bordo non vale; senza niente di noto, null */
  assert.equal(
    distanzaDellaParete([{ class: "Oven", bbox: [0, 100, 437, 396], score: 0.9 }], cucina),
    null,
  );
  assert.equal(
    distanzaDellaParete([{ class: "Bottle", bbox: [10, 10, 50, 100], score: 0.9 }], cucina),
    null,
  );
  assert.equal(distanzaDellaParete(cucina.visti, { w: 0, h: 0 }), null);
});

test("le misure della stanza: dalla foto verso nord larghezza diretta e profondita' dalla distanza", () => {
  const m = misureDallaFoto(cucina.visti, cucina);
  assert.deepEqual(m, { parete: 5.5, distanza: 3.6, riferimenti: ["oven", "microwave"] });
  const s = misureDellaStanza([{ verso: "N", ...cucina }], "cucina");
  assert.deepEqual(s, {
    larghezza: 5.5,
    profondita: 4.2,
    da: "foto",
    riferimenti: ["oven", "microwave"],
  });
  /* guardando a est la stessa parete e' la profondita' */
  const e = misureDellaStanza([{ verso: "E", ...cucina }], "cucina");
  assert.equal(e.profondita, 5.5);
  assert.equal(e.larghezza, 4.2);
  /* due foto: la diretta vince sull'indiretta, le dirette si mediano */
  const due = misureDellaStanza(
    [
      { verso: "N", ...cucina },
      { verso: "E", ...cucina },
    ],
    "cucina",
  );
  assert.deepEqual([due.larghezza, due.profondita], [5.5, 5.5]);
  /* senza cose note: le misure di serie del tipo */
  const serie = misureDellaStanza([{ verso: "N", w: 100, h: 100, visti: [] }], "bagno");
  assert.deepEqual(
    [serie.larghezza, serie.profondita, serie.da],
    [...MISURE_DI_SERIE.bagno, "serie"],
  );
  assert.equal(misureDellaStanza([], "boh").larghezza, MISURE_DI_SERIE.giorno[0]);
});

test("il tipo di stanza dal nome", () => {
  assert.equal(tipoDellaStanza("Camera da letto"), "camera");
  assert.equal(tipoDellaStanza("Bagno"), "bagno");
  assert.equal(tipoDellaStanza("Antibagno"), "corridoio");
  assert.equal(tipoDellaStanza("Cucina"), "cucina");
  assert.equal(tipoDellaStanza("Sala da pranzo"), "cucina");
  assert.equal(tipoDellaStanza("Studio"), "studio");
  assert.equal(tipoDellaStanza("Soggiorno"), "giorno");
  assert.equal(tipoDellaStanza(""), "giorno");
});

const casa5 = [
  { id: 1, larghezza: 5.5, profondita: 4.3, tipo: "giorno" },
  { id: 2, larghezza: 3.6, profondita: 3.4, tipo: "cucina" },
  { id: 3, larghezza: 3.8, profondita: 3.6, tipo: "camera" },
  { id: 4, larghezza: 2.2, profondita: 2.6, tipo: "bagno" },
  { id: 5, larghezza: 3.2, profondita: 3.0, tipo: "camera" },
];

test("le stanze si dispongono in righe allineate, senza buchi, il giorno per primo", () => {
  const d = disponiLeStanze(casa5);
  assert.equal(d.length, 5);
  const byId = Object.fromEntries(d.map((s) => [s.id, s]));
  assert.deepEqual([byId[1].x, byId[1].y], [0, 0]);
  assert.deepEqual([byId[2].x, byId[2].y], [5.5, 0], "la cucina accanto al giorno");
  assert.equal(byId[2].profondita, 4.3, "stessa profondita' nella riga");
  assert.equal(byId[3].y, 4.3, "la seconda riga sotto la prima");
  /* nessuna sovrapposizione */
  for (const a of d)
    for (const b of d) {
      if (a === b) continue;
      const separati =
        a.x + a.larghezza <= b.x + 1e-9 ||
        b.x + b.larghezza <= a.x + 1e-9 ||
        a.y + a.profondita <= b.y + 1e-9 ||
        b.y + b.profondita <= a.y + 1e-9;
      assert.ok(separati, `${a.id} e ${b.id} si sovrappongono`);
    }
  /* le misure restano quelle dette (la profondita' si allinea alla riga) */
  assert.equal(byId[4].larghezza, 2.2);
  assert.deepEqual(disponiLeStanze([]), []);
  assert.equal(disponiLeStanze([{ id: 9 }])[0].larghezza, 1.5, "mai sotto 1,5 m");
  /* misure non a decimi: i bordi coincidono lo stesso (3,25 → 3,3) */
  const strette = disponiLeStanze([
    { id: 1, larghezza: 2.25, profondita: 3.5, tipo: "giorno" },
    { id: 2, larghezza: 2.25, profondita: 3.5, tipo: "cucina" },
  ]);
  assert.equal(strette[0].x + strette[0].larghezza, strette[1].x);
  assert.equal(porteFraLeStanze(strette).length, 1);
});

test("le porte: ogni stanza si raggiunge dal giorno, cucina e giorno comunicano", () => {
  const d = disponiLeStanze(casa5);
  const porte = porteFraLeStanze(d);
  const coppie = porte.map((p) => p.stanze.slice().sort().join("-"));
  assert.ok(coppie.includes("1-2"), "giorno-cucina");
  assert.ok(coppie.includes("1-3") && coppie.includes("1-5"), "le camere dal giorno");
  assert.ok(coppie.includes("2-4") || coppie.includes("4-5"), "il bagno da chi lo tocca");
  /* un albero: n-1 porte (piu' quella cucina-giorno se non e' gia' nell'albero) */
  assert.ok(porte.length >= 4 && porte.length <= 5, String(porte.length));
  for (const p of porte) assert.equal(p.larghezza, 0.8);
  assert.deepEqual(porteFraLeStanze([d[0]]), []);
});

test("le finestre sui muri esterni e la porta di casa nel giorno", () => {
  const d = disponiLeStanze(casa5);
  const { finestre, ingresso } = finestreDelleStanze(d);
  assert.equal(finestre.length, 5, "una per stanza: tutte toccano il fuori");
  const diStanza = Object.fromEntries(finestre.map((f) => [f.stanza, f]));
  assert.equal(diStanza[1].larghezza, 1.8, "nel giorno larga");
  assert.equal(diStanza[4].larghezza, 0.7, "in bagno stretta");
  assert.ok(
    ingresso && ingresso.stanza === 1 && ingresso.larghezza === 0.9,
    JSON.stringify(ingresso),
  );
  /* non sopra la finestra */
  if (ingresso.lato === diStanza[1].lato && ingresso.pos === diStanza[1].pos)
    assert.ok(Math.abs(ingresso.centro - diStanza[1].centro) > 1.3);
});

test("dalla griglia il riconoscitore rifa' le cinque stanze, con le loro porte e finestre", () => {
  const d = disponiLeStanze(casa5);
  const g = grigliaDalleStanze(d);
  assert.ok(g.W * g.H < 1200 * 1200);
  const casa = riconosciDaFoto(g);
  assert.equal(casa.stanze.length, 5);
  const ritrovate = stanzeRitrovate(casa, g.centri);
  assert.deepEqual(Object.keys(ritrovate).length, 5);
  assert.equal(
    new Set(Object.values(ritrovate)).size,
    5,
    "ogni stanza disposta e' una stanza diversa",
  );
  assert.ok(Object.values(ritrovate).every((v) => v > 0));
  /* le aree tornano (al netto dei tramezzi) */
  const area = (id) => casa.stanze.find((s) => s.id === ritrovate[id]).area;
  assert.ok(Math.abs(area(1) - 5.5 * 4.3) < 1.5, String(area(1)));
  assert.ok(Math.abs(area(4) - 2.2 * 3.6) < 1.2, String(area(4)));
  const porte = casa.aperture.filter((a) => a.tipo === "porta"),
    finestre = casa.aperture.filter((a) => a.tipo === "finestra");
  assert.ok(porte.length >= 5, `porte: ${porte.length} (4 fra le stanze + l'ingresso)`);
  assert.equal(finestre.length, 5, "una finestra per stanza");
  assert.ok(
    finestre.some((f) => f.largo >= 1.75),
    "quella del giorno e' larga",
  );
  /* l'ingresso da' sul fuori */
  const fuori = (a) => {
    const i = Math.floor(a.cy / casa.passo) * casa.W + Math.floor(a.cx / casa.passo);
    const attorno = [i - 12 * casa.W, i + 12 * casa.W, i - 12, i + 12];
    return attorno.some((j) => casa.tipo[j] === -2);
  };
  assert.ok(porte.some(fuori), "una porta verso il fuori");
  assert.equal(grigliaDalleStanze([]), null);
});

test("una stanza sola: la casa e' quella, con finestra e ingresso", () => {
  const d = disponiLeStanze([{ id: 7, larghezza: 4, profondita: 3, tipo: "studio" }]);
  const g = grigliaDalleStanze(d);
  const casa = riconosciDaFoto(g);
  assert.equal(casa.stanze.length, 1);
  assert.equal(stanzeRitrovate(casa, g.centri)[7], casa.stanze[0].id);
  assert.equal(casa.aperture.filter((a) => a.tipo === "finestra").length, 1);
  assert.equal(casa.aperture.filter((a) => a.tipo === "porta").length, 1);
});

/* Dalla revisione: la porta di casa e' obbligatoria. Prima si sceglieva la
 * finestra della stanza principale e poi si cercava posto per la porta: con
 * un corridoio stretto come principale, o un giorno in mezzo a una riga, la
 * finestra si prendeva l'unico muro esterno e la casa usciva senza porta. */
test("la porta di casa c'e' sempre: anche col corridoio per principale, o col giorno in mezzo", () => {
  const senzaSoggiorno = disponiLeStanze([
    { id: 1, larghezza: 3.6, profondita: 3.4, tipo: "cucina" },
    { id: 2, larghezza: 1.8, profondita: 3.2, tipo: "corridoio" },
    { id: 3, larghezza: 3.2, profondita: 3.6, tipo: "camera" },
    { id: 4, larghezza: 3.2, profondita: 3.6, tipo: "camera" },
    { id: 5, larghezza: 3, profondita: 3, tipo: "bagno" },
  ]);
  const a = finestreDelleStanze(senzaSoggiorno);
  assert.ok(a.ingresso, "la porta sul corridoio");
  assert.equal(a.ingresso.stanza, 2);
  /* la finestra del corridoio si stringe per lasciarle il posto, o cede */
  const fc = a.finestre.find((f) => f.stanza === 2);
  if (fc && fc.lato === a.ingresso.lato && fc.pos === a.ingresso.pos)
    assert.ok(Math.abs(fc.centro - a.ingresso.centro) >= fc.larghezza / 2 + 0.45 + 0.3 - 0.01);
  const aMano = disponiLeStanze(
    [
      { id: 1, larghezza: 3.8, profondita: 3.6, tipo: "camera" },
      { id: 2, larghezza: 2.4, profondita: 3.6, tipo: "giorno" },
      { id: 3, larghezza: 3.8, profondita: 3.6, tipo: "camera" },
      { id: 4, larghezza: 5, profondita: 3, tipo: "cucina" },
      { id: 5, larghezza: 5, profondita: 3, tipo: "bagno" },
    ],
    { perTipo: false },
  );
  const b = finestreDelleStanze(aMano);
  assert.ok(b.ingresso && b.ingresso.stanza === 2, JSON.stringify(b.ingresso));
  for (const d of [senzaSoggiorno, aMano]) {
    const g = grigliaDalleStanze(d),
      casa = riconosciDaFoto(g);
    assert.equal(casa.stanze.length, 5);
    const fuori = (ap) => {
      const i = Math.floor(ap.cy / casa.passo) * casa.W + Math.floor(ap.cx / casa.passo);
      return [i - 12 * casa.W, i + 12 * casa.W, i - 12, i + 12].some((j) => casa.tipo[j] === -2);
    };
    assert.equal(casa.aperture.filter((ap) => ap.tipo === "porta" && fuori(ap)).length, 1);
  }
});

test("centocinquanta case a caso: tutte con la porta di casa, e il riconoscitore le ritrova", () => {
  let seme = 7;
  const caso = () => {
    seme = (seme * 1103515245 + 12345) % 2147483648;
    return seme / 2147483648;
  };
  const tipi = ["giorno", "cucina", "camera", "bagno", "studio", "corridoio"];
  for (let k = 0; k < 150; k++) {
    const n = 1 + Math.floor(caso() * 8);
    const stanze = Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      larghezza: Math.round((MISURA_MINIMA + caso() * 7.5) * 10) / 10,
      profondita: Math.round((MISURA_MINIMA + caso() * 7.5) * 10) / 10,
      tipo: tipi[Math.floor(caso() * tipi.length)],
    }));
    const d = disponiLeStanze(stanze, { perTipo: caso() < 0.5 });
    const { ingresso } = finestreDelleStanze(d);
    assert.ok(ingresso, `caso ${k}: senza porta di casa ${JSON.stringify(stanze)}`);
    /* ogni stanza si raggiunge: n-1 porte almeno, nessuna stanza isolata */
    const porte = porteFraLeStanze(d);
    if (n > 1) {
      const raggiunte = new Set([d[0].id]);
      let cresce = true;
      while (cresce) {
        cresce = false;
        for (const p of porte)
          if (raggiunte.has(p.stanze[0]) !== raggiunte.has(p.stanze[1])) {
            p.stanze.forEach((id) => raggiunte.add(id));
            cresce = true;
          }
      }
      assert.equal(raggiunte.size, n, `caso ${k}: stanze isolate ${JSON.stringify(stanze)}`);
    }
    if (k % 5 === 0) {
      const g = grigliaDalleStanze(d),
        casa = riconosciDaFoto(g),
        rit = stanzeRitrovate(casa, g.centri);
      assert.equal(new Set(Object.values(rit)).size, n, `caso ${k}: ${JSON.stringify(rit)}`);
      assert.ok(
        Object.values(rit).every((v) => v > 0),
        `caso ${k}`,
      );
    }
  }
  assert.ok(MISURA_MASSIMA >= 12, "un open space ci sta");
});
