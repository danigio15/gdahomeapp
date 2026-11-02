/* La pianta della casa dalle foto delle stanze.
 *
 * «Sviluppa la possibilita' di creare la planimetria in base alle foto che
 * si fanno delle stanze»: chi non ha una planimetria fotografa ogni stanza,
 * e da li' vengono le misure, la pianta, gli arredi.
 *
 * Le misure. In una foto non c'e' la scala, ma ci sono cose di misura nota:
 * un forno da incasso e' largo 60 cm, una lavastoviglie 60, un WC 37, un
 * condizionatore 85. Con la focale dell'obiettivo (dall'EXIF, o quella di un
 * telefono) un forno largo 437 pixel sta a f·0,60/437 metri: la distanza
 * della parete che si guarda. A quella distanza la foto inquadra una
 * larghezza nota (W·d/f): la parete. Chi fotografa sta dalla parte opposta,
 * dalla porta: la profondita' della stanza e' quella distanza piu' un passo.
 * Due foto, una verso una parete e una verso quella di fianco, danno
 * larghezza e profondita' tutte e due dirette. Senza cose note restano le
 * misure di serie del tipo di stanza, da correggere a mano.
 *
 * Tutto puro: numeri in ingresso, numeri in uscita. La pianta (le stanze
 * disposte, la griglia dei muri) sta sotto. */

import { focaleInPixel } from "./la-focale-della-foto.js";
import { CELLA } from "./casa-3d.js";
import { PASSO } from "./pianta-da-foto.js";

const clean = (v) => String(v ?? "").trim();
const elenco = (v) => (Array.isArray(v) ? v : []);
const tra = (v, min, max) => Math.min(max, Math.max(min, v));
const decimo = (v) => Math.round(v * 10) / 10;

/* ── le misure ─────────────────────────────────────────────────────────── */

/** Le cose di misura nota che stanno contro la parete: larghezza in metri e
 * quanto fidarsi (un forno da incasso e' sempre 60; un divano varia). Le
 * classi sono quelle del riconoscitore (Objects365), in minuscolo. */
export const MISURE_NOTE = Object.freeze({
  oven: { l: 0.6, peso: 1, nome: ["forno", "oven"] },
  dishwasher: { l: 0.6, peso: 1, nome: ["lavastoviglie", "dishwasher"] },
  "washing machine/drying machine": { l: 0.6, peso: 1, nome: ["lavatrice", "washing machine"] },
  microwave: { l: 0.5, peso: 0.5, nome: ["microonde", "microwave"] },
  refrigerator: { l: 0.7, peso: 0.4, nome: ["frigorifero", "fridge"] },
  toilet: { l: 0.37, peso: 0.7, nome: ["WC", "toilet"] },
  bathtub: { l: 1.7, peso: 0.3, nome: ["vasca", "bathtub"] },
  nightstand: { l: 0.5, peso: 0.5, nome: ["comodino", "nightstand"] },
  "air conditioner": { l: 0.85, peso: 0.8, nome: ["condizionatore", "air conditioner"] },
  piano: { l: 1.5, peso: 0.5, nome: ["pianoforte", "piano"] },
  couch: { l: 2.2, peso: 0.25, nome: ["divano", "sofa"] },
  bed: { l: 1.7, peso: 0.2, nome: ["letto", "bed"] },
});

/** Le misure di serie, per tipo di stanza: `[larghezza, profondita']`. */
export const MISURE_DI_SERIE = Object.freeze({
  giorno: [4.5, 4.0],
  cucina: [3.6, 3.4],
  camera: [3.8, 3.6],
  bagno: [2.2, 2.6],
  studio: [3.2, 3.0],
  corridoio: [1.6, 3.2],
});

/** Il tipo di una stanza dal suo nome: giorno, cucina, camera, bagno,
 * studio, corridoio. */
export function tipoDellaStanza(nome) {
  const n = clean(nome).toLowerCase();
  if (/ingress|corrid|disimpegn|antibagn|hall|entrance|lobby/.test(n)) return "corridoio";
  if (/bagn|bath|wc|toilet|servizi|lavanderia|laundry/.test(n)) return "bagno";
  if (/cucin|kitchen|cottura|pranzo|dining/.test(n)) return "cucina";
  if (/camer|letto|bed|notte|ospiti|guest|nursery/.test(n)) return "camera";
  if (/studio|ufficio|office|study/.test(n)) return "studio";
  return "giorno";
}

/** Quanto puo' essere larga o profonda una stanza: da un disimpegno a un
 * open space. Gli stessi limiti valgono nel campo delle misure. */
export const MISURA_MINIMA = 1.5,
  MISURA_MASSIMA = 15;
/* il passo indietro di chi fotografa: dalla porta, dalla parete di fronte */
const DALLA_PARETE_OPPOSTA = 0.6;

const box = (b) => {
  const [x, y, w, h] = elenco(b).map(Number);
  return [x, y, w, h].every(Number.isFinite) && w > 0 && h > 0 ? [x, y, w, h] : null;
};
const sovrapposti = (a, b) => {
  const x0 = Math.max(a[0], b[0]),
    y0 = Math.max(a[1], b[1]);
  const x1 = Math.min(a[0] + a[2], b[0] + b[2]),
    y1 = Math.min(a[1] + a[3], b[1] + b[3]);
  return (Math.max(0, x1 - x0) * Math.max(0, y1 - y0)) / Math.min(a[2] * a[3], b[2] * b[3]);
};

function medianaPesata(valori) {
  const v = valori.filter((x) => x.peso > 0 && Number.isFinite(x.d)).sort((a, b) => a.d - b.d);
  const tot = v.reduce((s, x) => s + x.peso, 0);
  if (!tot) return null;
  let acc = 0;
  for (const x of v) {
    acc += x.peso;
    if (acc >= tot / 2) return x.d;
  }
  return v[v.length - 1].d;
}

/** La distanza della parete che si guarda, dalle cose di misura nota viste
 * nella foto: `{ distanza, f, riferimenti, peso }` o null. `visti` sono i
 * riquadri grezzi del riconoscitore (`{ class, bbox, score }`). */
export function distanzaDellaParete(visti, { w, h, f35 = null } = {}) {
  const W = Number(w) || 0,
    H = Number(h) || 0;
  const f = focaleInPixel({ w: W, h: H, f35 });
  if (!(f > 0)) return null;
  const buoni = [];
  for (const d of elenco(visti)) {
    const classe = clean(d?.class).toLowerCase(),
      nota = MISURE_NOTE[classe],
      b = box(d?.bbox),
      score = Number(d?.score) || 0;
    if (!nota || !b || score < 0.4) continue;
    /* tagliato dal bordo: la larghezza non e' tutta */
    if (b[0] <= 2 || b[0] + b[2] >= W - 2) continue;
    /* uno sproposito (un terzo di foto per un forno) non e' un forno */
    if (b[2] > W * 0.6) continue;
    buoni.push({ classe, b, score, nota });
  }
  /* la stessa cosa vista due volte (la foto intera e un ritaglio) conta una */
  buoni.sort((a, b) => b.score - a.score);
  const unici = [];
  for (const x of buoni)
    if (!unici.some((u) => u.classe === x.classe && sovrapposti(u.b, x.b) > 0.6)) unici.push(x);
  const stime = unici.map((x) => ({
    d: (f * x.nota.l) / x.b[2],
    peso: x.nota.peso * x.score,
    classe: x.classe,
  }));
  const distanza = medianaPesata(stime);
  if (distanza === null) return null;
  return {
    distanza: tra(distanza, 1, 12),
    f,
    riferimenti: [...new Set(stime.map((s) => s.classe))],
    peso: stime.reduce((s, x) => s + x.peso, 0),
  };
}

/** Le misure che una foto dice della stanza: `{ parete, distanza, riferimenti }`
 * (la larghezza della parete di fronte e la sua distanza, in metri), o null
 * senza cose di misura nota. */
export function misureDallaFoto(visti, { w, h, f35 = null } = {}) {
  const p = distanzaDellaParete(visti, { w, h, f35 });
  if (!p) return null;
  const W = Number(w) || 0;
  /* la parete riempie quasi tutta la foto, quando si fotografa dalla parte
   * opposta: un filo meno della larghezza inquadrata */
  const parete = tra((W * p.distanza) / p.f, MISURA_MINIMA, MISURA_MASSIMA);
  return { parete: decimo(parete), distanza: decimo(p.distanza), riferimenti: p.riferimenti };
}

/** Larghezza e profondita' di una stanza dalle sue foto: ogni foto porta
 * `{ verso, visti, w, h, f35 }`; `verso` e' la parete che si guarda (N, S,
 * E, O: in alto, in basso, a destra, a sinistra nella pianta). Torna
 * `{ larghezza, profondita, da: "foto" | "serie", riferimenti }`. */
export function misureDellaStanza(foto, tipo = "giorno") {
  const dirette = { larghezza: [], profondita: [] },
    indirette = { larghezza: [], profondita: [] },
    riferimenti = new Set();
  for (const F of elenco(foto)) {
    const m = misureDallaFoto(F?.visti, { w: F?.w, h: F?.h, f35: F?.f35 });
    if (!m) continue;
    m.riferimenti.forEach((r) => riferimenti.add(r));
    const verso = ["N", "S", "E", "O"].includes(F?.verso) ? F.verso : "N";
    const lungo = verso === "N" || verso === "S" ? "larghezza" : "profondita";
    const altro = lungo === "larghezza" ? "profondita" : "larghezza";
    dirette[lungo].push(m.parete);
    indirette[altro].push(m.distanza + DALLA_PARETE_OPPOSTA);
  }
  const serie = MISURE_DI_SERIE[tipo] || MISURE_DI_SERIE.giorno;
  const media = (v) => v.reduce((s, x) => s + x, 0) / v.length;
  const scegli = (k, diSerie) => {
    if (dirette[k].length) return [media(dirette[k]), true];
    if (indirette[k].length) return [media(indirette[k]), true];
    return [diSerie, false];
  };
  const [l, lFoto] = scegli("larghezza", serie[0]),
    [p, pFoto] = scegli("profondita", serie[1]);
  return {
    larghezza: decimo(tra(l, MISURA_MINIMA, MISURA_MASSIMA)),
    profondita: decimo(tra(p, MISURA_MINIMA, MISURA_MASSIMA)),
    da: lFoto || pFoto ? "foto" : "serie",
    riferimenti: [...riferimenti],
  };
}

/* ── la pianta ─────────────────────────────────────────────────────────── */

/* L'ordine in cui si dispongono: prima il giorno, che e' il cuore e da cui
 * si passa, poi la cucina attaccata, poi il resto. */
const ORDINE = { giorno: 0, cucina: 1, corridoio: 2, studio: 3, camera: 4, bagno: 5 };

/** Le stanze disposte in una pianta: in ingresso `[{ id, larghezza,
 * profondita, tipo }]` (metri), in uscita gli stessi con `x, y` (metri, dal
 * vertice in alto a sinistra) in righe allineate senza buchi: le stanze di
 * una riga hanno la stessa profondita' (quella piu' grande della riga), cosi'
 * i muri sono dritti e ogni stanza tocca le vicine. Con `perTipo` (di
 * serie) prima il giorno, poi la cucina, poi le altre; senza, l'ordine dato. */
export function disponiLeStanze(stanze, { perTipo = true } = {}) {
  const S = elenco(stanze)
    .map((s, i) => ({
      ...s,
      /* al decimo, come le x che si sommano: i bordi devono coincidere */
      larghezza: decimo(tra(Number(s?.larghezza) || MISURA_MINIMA, MISURA_MINIMA, MISURA_MASSIMA)),
      profondita: decimo(
        tra(Number(s?.profondita) || MISURA_MINIMA, MISURA_MINIMA, MISURA_MASSIMA),
      ),
      tipo: ORDINE[s?.tipo] !== undefined ? s.tipo : "giorno",
      ordine: i,
    }))
    .sort((a, b) => (perTipo ? ORDINE[a.tipo] - ORDINE[b.tipo] : 0) || a.ordine - b.ordine);
  if (!S.length) return [];
  const area = S.reduce((s, x) => s + x.larghezza * x.profondita, 0);
  const larghezzaRiga = Math.max(Math.max(...S.map((s) => s.larghezza)), Math.sqrt(area) * 1.25);
  const righe = [[]];
  for (const s of S) {
    const riga = righe[righe.length - 1],
      occupata = riga.reduce((t, x) => t + x.larghezza, 0);
    if (riga.length && occupata + s.larghezza > larghezzaRiga + 0.01) righe.push([s]);
    else riga.push(s);
  }
  const out = [];
  let y = 0;
  for (const riga of righe) {
    const profondita = decimo(Math.max(...riga.map((s) => s.profondita)));
    let x = 0;
    for (const s of riga) {
      out.push({ ...s, x: decimo(x), y: decimo(y), profondita });
      x += s.larghezza;
    }
    y += profondita;
  }
  return out.sort((a, b) => a.ordine - b.ordine).map(({ ordine, ...s }) => s);
}

/* Due rettangoli in metri: il tratto di muro che hanno in comune,
 * `{ lato: "x" | "y", da, a, pos }` (lungo x a y=pos, o lungo y a x=pos), o
 * null se non si toccano per almeno `minimo` metri. */
function muroInComune(a, b, minimo = 1.2) {
  const eps = 0.02;
  const ax1 = a.x + a.larghezza,
    ay1 = a.y + a.profondita,
    bx1 = b.x + b.larghezza,
    by1 = b.y + b.profondita;
  if (Math.abs(ax1 - b.x) < eps || Math.abs(bx1 - a.x) < eps) {
    const da = Math.max(a.y, b.y),
      fine = Math.min(ay1, by1);
    if (fine - da >= minimo)
      return { lato: "y", da, a: fine, pos: Math.abs(ax1 - b.x) < eps ? ax1 : bx1 };
  }
  if (Math.abs(ay1 - b.y) < eps || Math.abs(by1 - a.y) < eps) {
    const da = Math.max(a.x, b.x),
      fine = Math.min(ax1, bx1);
    if (fine - da >= minimo)
      return { lato: "x", da, a: fine, pos: Math.abs(ay1 - b.y) < eps ? ay1 : by1 };
  }
  return null;
}

/** Le porte fra le stanze disposte: ogni stanza si raggiunge dal giorno (o
 * dalla prima) passando per il minor numero di stanze, e cucina e giorno
 * vicini si aprono l'uno sull'altra. Torna `[{ a, b, lato, pos, da, a: ... }]`:
 * ogni porta e' `{ stanze: [idA, idB], lato, pos, centro, larghezza }`. */
export function porteFraLeStanze(disposte) {
  const S = elenco(disposte);
  if (S.length < 2) return [];
  const vicini = new Map(S.map((s) => [s.id, []]));
  for (let i = 0; i < S.length; i++)
    for (let j = i + 1; j < S.length; j++) {
      const m = muroInComune(S[i], S[j]);
      if (!m) continue;
      vicini.get(S[i].id).push({ id: S[j].id, m });
      vicini.get(S[j].id).push({ id: S[i].id, m });
    }
  const principale =
    S.find((s) => s.tipo === "giorno") || S.find((s) => s.tipo === "corridoio") || S[0];
  /* a ondate dalla principale: prima si passa dal giorno e dai corridoi,
   * poi dalle altre; una camera non si attraversa se c'e' un'altra strada */
  const passaggio = (s) => (s.tipo === "giorno" || s.tipo === "corridoio" ? 0 : 1);
  const diId = new Map(S.map((s) => [s.id, s]));
  const costo = new Map([[principale.id, 0]]);
  const da = new Map();
  const coda = [principale.id];
  while (coda.length) {
    coda.sort((a, b) => costo.get(a) - costo.get(b));
    const id = coda.shift();
    for (const v of vicini.get(id)) {
      const c = costo.get(id) + 1 + passaggio(diId.get(id)) * 2;
      if (costo.has(v.id) && costo.get(v.id) <= c) continue;
      costo.set(v.id, c);
      da.set(v.id, id);
      if (!coda.includes(v.id)) coda.push(v.id);
    }
  }
  const porte = [];
  const apri = (idA, idB) => {
    if (porte.some((p) => p.stanze.includes(idA) && p.stanze.includes(idB))) return;
    const m = vicini.get(idA).find((v) => v.id === idB)?.m;
    if (!m) return;
    porte.push({
      stanze: [idA, idB],
      lato: m.lato,
      pos: m.pos,
      centro: decimo((m.da + m.a) / 2),
      larghezza: 0.8,
    });
  };
  for (const [id, prima] of da) apri(prima, id);
  const giorno = S.filter((s) => s.tipo === "giorno"),
    cucine = S.filter((s) => s.tipo === "cucina");
  for (const g of giorno) for (const c of cucine) if (muroInComune(g, c)) apri(g.id, c.id);
  return porte;
}

/* I quattro lati di una stanza, nell'ordine in cui si preferiscono per la
 * porta di casa: basso, sinistra, destra, alto. */
const latiDi = (s) => [
  {
    nome: "basso",
    lungo: s.larghezza,
    lato: "x",
    pos: s.y + s.profondita,
    da: s.x,
    a: s.x + s.larghezza,
  },
  { nome: "sinistra", lungo: s.profondita, lato: "y", pos: s.x, da: s.y, a: s.y + s.profondita },
  {
    nome: "destra",
    lungo: s.profondita,
    lato: "y",
    pos: s.x + s.larghezza,
    da: s.y,
    a: s.y + s.profondita,
  },
  { nome: "alto", lungo: s.larghezza, lato: "x", pos: s.y, da: s.x, a: s.x + s.larghezza },
];
const stessoMuro = (v, l) => v && v.lato === l.lato && Math.abs(v.pos - l.pos) < 0.02;

/** La porta di casa e le finestre. Prima la porta, che e' obbligatoria: sul
 * primo muro esterno libero (almeno 1,4 m) della stanza principale, in basso
 * se si puo'; se la principale non ne ha, sulla prima stanza (per tipo) che
 * tocca il fuori. Poi una finestra per stanza sul muro esterno piu' lungo
 * (larga 1,2 m; 0,7 in bagno; 1,8 nel giorno, o quanto ci sta), lasciando
 * il posto alla porta se e' sullo stesso muro. Torna `{ finestre: [{ stanza,
 * lato, pos, centro, larghezza }], ingresso: {...} | null }`. */
export function finestreDelleStanze(disposte) {
  const S = elenco(disposte);
  if (!S.length) return { finestre: [], ingresso: null };
  const principale =
    S.find((s) => s.tipo === "giorno") || S.find((s) => s.tipo === "corridoio") || S[0];
  const candidate = [
    principale,
    ...S.filter((s) => s !== principale).sort(
      (a, b) => (ORDINE[a.tipo] ?? 9) - (ORDINE[b.tipo] ?? 9),
    ),
  ];
  let ingresso = null;
  for (const p of candidate) {
    for (const l of latiDi(p)) {
      const tratto = trattoLibero(S, p, l);
      if (!tratto || tratto.a - tratto.da < 1.4) continue;
      ingresso = {
        stanza: p.id,
        lato: l.lato,
        pos: l.pos,
        centro: decimo((tratto.da + tratto.a) / 2),
        larghezza: 0.9,
      };
      break;
    }
    if (ingresso) break;
  }
  const finestre = [];
  for (const s of S) {
    const larga = s.tipo === "bagno" ? 0.7 : s.tipo === "giorno" ? 1.8 : 1.2,
      minima = s.tipo === "bagno" ? 0.7 : 1.0;
    /* il lato col tratto libero piu' lungo, al netto della porta di casa */
    const scelte = [];
    for (const l of latiDi(s)) {
      let tratto = trattoLibero(S, s, l);
      if (!tratto) continue;
      if (ingresso && ingresso.stanza === s.id && stessoMuro(ingresso, l)) {
        const prima = { da: tratto.da, a: ingresso.centro - ingresso.larghezza / 2 - 0.3 },
          dopo = { da: ingresso.centro + ingresso.larghezza / 2 + 0.3, a: tratto.a };
        tratto = prima.a - prima.da >= dopo.a - dopo.da ? prima : dopo;
      }
      const disponibile = tratto.a - tratto.da - 0.3;
      if (disponibile >= minima) scelte.push({ l, tratto, disponibile });
    }
    if (!scelte.length) continue;
    scelte.sort((a, b) => b.disponibile - a.disponibile);
    const { l, tratto, disponibile } = scelte[0];
    finestre.push({
      stanza: s.id,
      lato: l.lato,
      pos: l.pos,
      centro: decimo((tratto.da + tratto.a) / 2),
      larghezza: Math.min(larga, decimo(disponibile)),
    });
  }
  return { finestre, ingresso };
}

/* Il tratto piu' lungo di un lato di `s` che non tocca altre stanze. */
function trattoLibero(S, s, l) {
  const coperti = [];
  for (const o of S) {
    if (o === s) continue;
    const lungoIlLato =
      l.lato === "x"
        ? Math.abs(o.y - l.pos) < 0.02 || Math.abs(o.y + o.profondita - l.pos) < 0.02
        : Math.abs(o.x - l.pos) < 0.02 || Math.abs(o.x + o.larghezza - l.pos) < 0.02;
    if (!lungoIlLato) continue;
    const da = Math.max(l.da, l.lato === "x" ? o.x : o.y),
      a = Math.min(l.a, l.lato === "x" ? o.x + o.larghezza : o.y + o.profondita);
    if (a > da) coperti.push([da, a]);
  }
  coperti.sort((p, q) => p[0] - q[0]);
  let meglio = null,
    da = l.da;
  for (const [c0, c1] of coperti) {
    if (c0 - da > (meglio ? meglio.a - meglio.da : 0)) meglio = { da, a: c0 };
    da = Math.max(da, c1);
  }
  if (l.a - da > (meglio ? meglio.a - meglio.da : 0)) meglio = { da, a: l.a };
  return meglio && meglio.a - meglio.da > 0 ? meglio : null;
}

/* ── la griglia ────────────────────────────────────────────────────────── */

export const MURO_ESTERNO = 0.3,
  MURO_INTERNO = 0.12,
  MARGINE = 1.0;

/** La griglia dei muri dalle stanze disposte, come la vuole
 * `riconosciDaFoto`: `{ W, H, muro, barriera, vetro, pieni, passo }` a
 * celle di PASSO metri, piu' `origine` (dove sta il metro zero della pianta
 * nella griglia, in metri) e, per ritrovare le stanze dopo il riconoscimento,
 * `centri: [{ id, cx, cy }]` in celle.
 *
 * I rettangoli sono le stanze al netto: i tramezzi (12 cm) stanno a cavallo
 * del confine fra due stanze, il muro esterno (30 cm) cresce fuori, attorno
 * alla casa, cosi' le misure dette restano quelle. Le porte sono varchi nel
 * muro con la soglia (`barriera` resta: tiene separate le stanze, poi il
 * varco diventa una porta), le finestre varchi col `vetro`. Attorno un
 * margine di fuori, perche' il riconoscitore ci entri dal bordo. */
export function grigliaDalleStanze(disposte) {
  const S = elenco(disposte);
  if (!S.length) return null;
  const x0 = Math.min(...S.map((s) => s.x)),
    y0 = Math.min(...S.map((s) => s.y));
  const x1 = Math.max(...S.map((s) => s.x + s.larghezza)),
    y1 = Math.max(...S.map((s) => s.y + s.profondita));
  const ox = MARGINE + MURO_ESTERNO - x0,
    oy = MARGINE + MURO_ESTERNO - y0;
  const W = Math.ceil((x1 + ox + MURO_ESTERNO + MARGINE) / PASSO),
    H = Math.ceil((y1 + oy + MURO_ESTERNO + MARGINE) / PASSO);
  const N = W * H;
  const muro = new Uint8Array(N),
    barriera = new Uint8Array(N),
    vetro = new Uint8Array(N),
    dentro = new Uint8Array(N);
  const c = (m) => Math.round(m / PASSO);
  const riempi = (dove, ax, ay, bx, by, v = 1) => {
    for (let y = Math.max(0, ay); y < Math.min(H, by); y++)
      for (let x = Math.max(0, ax); x < Math.min(W, bx); x++) dove[y * W + x] = v;
  };
  const m = Math.max(1, Math.round(c(MURO_INTERNO) / 2)),
    spE = c(MURO_ESTERNO);
  for (const s of S) {
    const ax = c(s.x + ox),
      ay = c(s.y + oy),
      bx = c(s.x + s.larghezza + ox),
      by = c(s.y + s.profondita + oy);
    riempi(dentro, ax, ay, bx, by);
    /* mezzo tramezzo dentro il proprio confine, su tutti e quattro i lati */
    riempi(muro, ax, ay, bx, ay + m);
    riempi(muro, ax, by - m, bx, by);
    riempi(muro, ax, ay, ax + m, by);
    riempi(muro, bx - m, ay, bx, by);
  }
  /* il muro esterno: le celle di fuori a meno di spE dalla casa */
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (dentro[i]) continue;
      let vicino = false;
      for (let dy = -spE; dy <= spE && !vicino; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -spE; dx <= spE; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < W && dentro[yy * W + xx]) {
            vicino = true;
            break;
          }
        }
      }
      if (vicino) muro[i] = 1;
    }
  barriera.set(muro);
  /* i varchi: porte (soglia: barriera resta) e finestre (vetro) */
  const varco = (v, tipo) => {
    const mezzo = v.larghezza / 2,
      spessore = spE + m + 2;
    let ax, ay, bx, by;
    if (v.lato === "x") {
      ax = c(v.centro - mezzo + ox);
      bx = c(v.centro + mezzo + ox);
      ay = c(v.pos + oy) - spessore;
      by = c(v.pos + oy) + spessore;
    } else {
      ay = c(v.centro - mezzo + oy);
      by = c(v.centro + mezzo + oy);
      ax = c(v.pos + ox) - spessore;
      bx = c(v.pos + ox) + spessore;
    }
    for (let y = Math.max(0, ay); y < Math.min(H, by); y++)
      for (let x = Math.max(0, ax); x < Math.min(W, bx); x++) {
        const i = y * W + x;
        if (!muro[i]) continue;
        muro[i] = 0;
        if (tipo === "vetro") vetro[i] = 1;
      }
  };
  const porte = porteFraLeStanze(S);
  for (const p of porte) varco(p, "soglia");
  const { finestre, ingresso } = finestreDelleStanze(S);
  for (const f of finestre) varco(f, "vetro");
  if (ingresso) varco(ingresso, "soglia");
  const centri = S.map((s) => ({
    id: s.id,
    cx: c(s.x + s.larghezza / 2 + ox),
    cy: c(s.y + s.profondita / 2 + oy),
  }));
  return {
    W,
    H,
    muro,
    barriera,
    vetro,
    /* non «a muri pieni»: quella regola (il fuori entra solo dove e' largo
     * 65 cm) lasciava attorno alla casa un anello di fuori non raggiunto,
     * che con una stanza sola diventava una stanza. Qui le soglie (la
     * barriera) tengono il fuori fuori da sole. */
    pieni: false,
    passo: PASSO,
    origine: { x: ox, y: oy },
    centri,
    porte,
    finestre,
    ingresso,
  };
}

/** Dopo `riconosciDaFoto`: quale stanza riconosciuta (id in `casa.tipo`) sta
 * al centro di ciascuna stanza disposta. Torna la mappa id disposto → id
 * riconosciuto (o null se quel centro non e' in una stanza). */
export function stanzeRitrovate(casa, centri) {
  const out = {};
  for (const { id, cx, cy } of elenco(centri)) {
    const dentro = cx >= 0 && cy >= 0 && cx < casa?.W && cy < casa?.H;
    const v = dentro ? casa.tipo[cy * casa.W + cx] : CELLA.fuori;
    out[id] = v > 0 ? v : null;
  }
  return out;
}
