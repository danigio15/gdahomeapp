/* Gli arredi disegnati nella pianta arredata, al loro posto nella casa.
 *
 * «Fai in modo che se la carico così com'è venga riconosciuta tutta, anche
 * gli arredamenti.» Le piante delle agenzie e dei programmi d'arredo in 2D
 * disegnano i mobili visti dall'alto, sempre allo stesso modo: il letto e'
 * un rettangolo bianco grande coi cuscini da una parte, il tavolo ha le
 * sedie attorno, il divano e' lungo e profondo un metro, gli armadi sono
 * strisce bianche contro il muro, la vasca e la doccia sono bianche nel
 * bagno, l'isola della cucina e' di legno con gli sgabelli neri.
 *
 * Qui si cercano solo quelli che si riconoscono con poca incertezza, con
 * soglie strette: meglio pochi arredi giusti che tanti sbagliati. Ognuno
 * esce con le chiavi del catalogo della Casa 3D (casa-3d/arredi-3d.js) e con
 * posto, rotazione e larghezza, come gli arredi delle foto delle stanze: si
 * spostano, si girano e si tolgono come gli altri.
 *
 * Il modulo e' puro: l'immagine come la da' una canvas ({ width, height,
 * data }), la casa riconosciuta (riconosciDaFoto) e i metri per pixel.
 */

import { PASSO } from "./pianta-da-foto.js";

const luce = (d, i) => 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2];
const colore = (d, i) =>
  Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) - Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);

/* Le operazioni sulle mappe (1 = pieno), con l'immagine integrale. */
function integrale(g, w, h) {
  const I = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let r = 0;
    for (let x = 0; x < w; x++) {
      r += g[y * w + x];
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + r;
    }
  }
  return I;
}
function quadrato(g, w, h, r, tutto) {
  const I = integrale(g, w, h),
    out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r),
        x1 = Math.min(w, x + r + 1),
        y0 = Math.max(0, y - r),
        y1 = Math.min(h, y + r + 1);
      const n =
        I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
      out[y * w + x] = tutto ? (n === (x1 - x0) * (y1 - y0) ? 1 : 0) : n > 0 ? 1 : 0;
    }
  return out;
}
const apri = (g, w, h, r) => quadrato(quadrato(g, w, h, r, true), w, h, r, false);
const chiudi = (g, w, h, r) => quadrato(quadrato(g, w, h, r, false), w, h, r, true);

function pezzi(g, w, h) {
  const id = new Int32Array(w * h).fill(-1),
    out = [];
  for (let s = 0; s < w * h; s++) {
    if (!g[s] || id[s] >= 0) continue;
    const p = { n: 0, x0: w, y0: h, x1: 0, y1: 0, celle: [s] };
    id[s] = out.length;
    for (let t = 0; t < p.celle.length; t++) {
      const i = p.celle[t],
        x = i % w,
        y = (i - x) / w;
      if (x < p.x0) p.x0 = x;
      if (x > p.x1) p.x1 = x;
      if (y < p.y0) p.y0 = y;
      if (y > p.y1) p.y1 = y;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w])
        if (j >= 0 && j < w * h && g[j] && id[j] < 0) {
          id[j] = out.length;
          p.celle.push(j);
        }
    }
    p.n = p.celle.length;
    out.push(p);
  }
  return out;
}

/** Il verso del davanti come rotazione della Casa 3D: il modello guarda
 * verso +z, cioe' verso +y nella pianta; (fx, fy) e' dove guarda. */
export const rotDelDavanti = (fx, fy) => Math.round(Math.atan2(fx, fy) * 1e4) / 1e4;

/**
 * Gli arredi della pianta: `[{ k, stanza, x, y, rot, l? }]`, in metri nella
 * casa (le stesse coordinate di `casa.stanze`), coi tipi del catalogo della
 * Casa 3D. `im` e' l'immagine su cui e' stata riconosciuta la casa (stesse
 * misure della pianta pulita), `mpp` i metri per pixel.
 */
export function arrediDallaPianta(im, casa, mpp) {
  if (!im?.data || !casa?.tipo || !(mpp > 0)) return [];
  const { width: w, height: h, data } = im,
    N = w * h,
    { W, H, tipo } = casa,
    lato = PASSO / mpp,
    m = (v) => v / mpp; // metri in pixel
  const cella = (x, y) => {
    const cx = Math.floor(x / lato),
      cy = Math.floor(y / lato);
    return cx < 0 || cy < 0 || cx >= W || cy >= H ? -2 : tipo[cy * W + cx];
  };
  const muroIn = (x, y) => {
    const t = cella(x, y);
    return t === -3 || t === -4 || t === -5;
  };
  /* 1. il pavimento di ogni stanza: il colore piu' comune dentro */
  const stanzaDi = new Int16Array(N);
  const conta = new Map();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        t = cella(x, y);
      stanzaDi[i] = t > 0 ? t : 0;
      if (t <= 0 || (x + y) % 3) continue;
      const q = ((data[i * 4] >> 3) << 10) | ((data[i * 4 + 1] >> 3) << 5) | (data[i * 4 + 2] >> 3);
      let c = conta.get(t);
      if (!c) conta.set(t, (c = new Map()));
      c.set(q, (c.get(q) || 0) + 1);
    }
  const pavimento = new Map();
  for (const [t, c] of conta) {
    let meglio = 0,
      q = 0;
    for (const [k, v] of c)
      if (v > meglio) {
        meglio = v;
        q = k;
      }
    pavimento.set(t, [((q >> 10) << 3) + 4, (((q >> 5) & 31) << 3) + 4, ((q & 31) << 3) + 4]);
  }
  /* 2. le classi dei pixel che non sono pavimento */
  const bianco = new Uint8Array(N),
    legno = new Uint8Array(N),
    nero = new Uint8Array(N),
    grigio = new Uint8Array(N),
    altro = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const t = stanzaDi[i];
    if (!t) continue;
    const p = pavimento.get(t);
    const d =
      Math.abs(data[i * 4] - p[0]) +
      Math.abs(data[i * 4 + 1] - p[1]) +
      Math.abs(data[i * 4 + 2] - p[2]);
    const v = luce(data, i),
      c = colore(data, i);
    if (v >= 232 && c <= 14) bianco[i] = 1;
    else if (d <= 30) continue;
    else if (v < 60) nero[i] = 1;
    else if (c >= 40 && data[i * 4] > data[i * 4 + 2] + 30 && v < 190) legno[i] = 1;
    else if (c <= 14 && v < 200) grigio[i] = 1;
    else if (c >= 10) altro[i] = 1;
  }
  /* i contorni dei mobili bianchi sono righe grigie: chiudendo il bianco ci
   * si passa sopra; aprendo vanno via le righe sole (le fughe, gli archi) */
  const rc = Math.max(1, Math.round(m(0.03))),
    ro = Math.max(1, Math.round(m(0.05)));
  const forma = (p, extra = {}) => {
    const bw = p.x1 - p.x0 + 1,
      bh = p.y1 - p.y0 + 1;
    return {
      ...p,
      bw,
      bh,
      a: Math.min(bw, bh) * mpp,
      b: Math.max(bw, bh) * mpp,
      cx: (p.x0 + p.x1 + 1) / 2,
      cy: (p.y0 + p.y1 + 1) / 2,
      pieno: p.n / (bw * bh),
      oriz: bw >= bh,
      ...extra,
    };
  };
  const forme = (g, chiusa = false, tieni = false) => {
    const a = apri(chiusa ? chiudi(g, w, h, rc) : g, w, h, ro);
    return pezzi(a, w, h).map((p) => {
      const bw = p.x1 - p.x0 + 1,
        bh = p.y1 - p.y0 + 1;
      let st = new Map();
      for (const i of p.celle) st.set(stanzaDi[i], (st.get(stanzaDi[i]) || 0) + 1);
      let stanza = 0,
        piu = 0;
      for (const [k, v] of st)
        if (k && v > piu) {
          piu = v;
          stanza = k;
        }
      return forma(p, { celle: tieni ? p.celle : null, stanza, bw, bh });
    });
  };
  /* I pezzi bianchi di un mobile solo, divisi dalle sue righe (i cuscini
   * del divano, il cuscino del letto, le sedie attaccate al tavolo): quelli
   * che si toccano quasi diventano uno, col riquadro di tutti. */
  const uniti = (lista, d) => {
    const gruppi = lista.map((f) => ({ ...f }));
    let cambiato = true;
    while (cambiato) {
      cambiato = false;
      for (let i = 0; i < gruppi.length && !cambiato; i++)
        for (let j = i + 1; j < gruppi.length; j++) {
          const p = gruppi[i],
            q = gruppi[j];
          if (p.stanza !== q.stanza) continue;
          if (q.x0 > p.x1 + m(d) || p.x0 > q.x1 + m(d) || q.y0 > p.y1 + m(d) || p.y0 > q.y1 + m(d))
            continue;
          const u = forma(
            {
              n: p.n + q.n,
              x0: Math.min(p.x0, q.x0),
              y0: Math.min(p.y0, q.y0),
              x1: Math.max(p.x1, q.x1),
              y1: Math.max(p.y1, q.y1),
            },
            { stanza: p.stanza, parti: (p.parti || 1) + (q.parti || 1) },
          );
          /* un mobile solo e' compatto e non piu' lungo di tre metri: il
           * letto accanto all'armadio restano due */
          if (u.b > 3 || u.pieno < 0.5) continue;
          gruppi[i] = u;
          gruppi.splice(j, 1);
          cambiato = true;
          break;
        }
    }
    return gruppi;
  };
  const bianchi = forme(bianco, true),
    legni = forme(legno),
    neri = forme(nero),
    grigi = forme(grigio),
    altri = forme(altro, true, true),
    grandi = uniti(bianchi, 0.12);
  const tra = (v, a, b) => v >= a && v <= b;
  /* quanto muro c'e' appena fuori da un lato del riquadro (0..1) */
  const muroAccanto = (f, lato, dm = 0.18) => {
    const d = Math.round(m(dm));
    let si = 0,
      tutti = 0;
    const lungo = lato === "su" || lato === "giu" ? f.bw : f.bh;
    for (let t = 0; t < lungo; t += 2) {
      tutti++;
      for (let k = 1; k <= d; k++) {
        const x = lato === "sx" ? f.x0 - k : lato === "dx" ? f.x1 + k : f.x0 + t;
        const y = lato === "su" ? f.y0 - k : lato === "giu" ? f.y1 + k : f.y0 + t;
        if (muroIn(x, y)) {
          si++;
          break;
        }
      }
    }
    return tutti ? si / tutti : 0;
  };
  const versi = { su: [0, -1], giu: [0, 1], sx: [-1, 0], dx: [1, 0] };
  /* il lato lungo contro il muro: il davanti guarda dall'altra parte */
  const controIlMuro = (f, soglia = 0.5) => {
    const lati = f.oriz ? ["su", "giu"] : ["sx", "dx"];
    const [a, b] = lati.map((l) => muroAccanto(f, l));
    if (Math.max(a, b) < soglia) return null;
    const dietro = a >= b ? lati[0] : lati[1];
    return versi[dietro].map((v) => -v);
  };
  /* il lato corto contro il muro (il letto, il wc) */
  const testaAlMuro = (f, soglia = 0.4, dm = 0.18) => {
    const lati = f.oriz ? ["sx", "dx"] : ["su", "giu"];
    const [a, b] = lati.map((l) => muroAccanto(f, l, dm));
    if (Math.max(a, b) < soglia) return null;
    const dietro = a >= b ? lati[0] : lati[1];
    return versi[dietro].map((v) => -v);
  };
  const vicino = (f, g, d) =>
    g.x1 >= f.x0 - m(d) && g.x0 <= f.x1 + m(d) && g.y1 >= f.y0 - m(d) && g.y0 <= f.y1 + m(d);
  const usati = new Set(),
    trovati = [];
  const metti = (k, f, davanti, extra = {}) => {
    if (!f.stanza) return;
    usati.add(f);
    /* i pezzi bianchi che ci stanno dentro sono suoi */
    for (const g of bianchi)
      if (g.cx > f.x0 && g.cx < f.x1 && g.cy > f.y0 && g.cy < f.y1) usati.add(g);
    /* e il pezzo grande che lo contiene e' lui */
    for (const g of grandi)
      if (f.cx > g.x0 && f.cx < g.x1 && f.cy > g.y0 && f.cy < g.y1) usati.add(g);
    trovati.push({
      k,
      stanza: f.stanza,
      x: Math.round(f.cx * mpp * 1000) / 1000,
      y: Math.round(f.cy * mpp * 1000) / 1000,
      rot: rotDelDavanti(davanti[0], davanti[1]),
      ...extra,
    });
  };
  const lungo = (f) => ({ l: Math.round(f.b * 100) / 100 });
  /* le sedie: quadratini bianchi (o neri) da 30-60 cm */
  const sedia = (g) => tra(g.a, 0.25, 0.6) && tra(g.b, 0.3, 0.7) && g.pieno >= 0.5;

  /* il letto: bianco grande e pieno (coi cuscini), la testa contro il muro */
  for (const f of grandi) {
    if (f.pieno < 0.8) continue;
    const doppio = tra(f.a, 1.35, 2.1) && tra(f.b, 1.85, 2.45),
      singolo = tra(f.a, 0.8, 1.25) && tra(f.b, 1.85, 2.3);
    if (!doppio && !singolo) continue;
    const davanti = testaAlMuro(f, 0.4, 0.3);
    if (!davanti) continue;
    metti(doppio ? "matrimoniale" : "singolo", f, davanti);
    /* i comodini: il legno piccolo accanto alla testa */
    for (const g of legni)
      if (!usati.has(g) && tra(g.a, 0.25, 0.65) && tra(g.b, 0.3, 0.7) && vicino(f, g, 0.12))
        metti("comodino", g, davanti);
  }
  /* il tavolo da pranzo: bianco, con almeno due sedie attorno (staccate o
   * attaccate: allora il pezzo e' largo, coi buchi fra una sedia e l'altra),
   * in mezzo alla stanza */
  for (const f of grandi) {
    if (usati.has(f) || !tra(f.a, 0.65, 2.0) || !tra(f.b, 0.9, 3.0)) continue;
    if (["su", "giu", "sx", "dx"].some((l) => muroAccanto(f, l) > 0.3)) continue;
    const sedie = [...bianchi, ...neri].filter(
      (g) =>
        !usati.has(g) &&
        sedia(g) &&
        vicino(f, g, 0.5) &&
        (g.cx < f.x0 || g.cx > f.x1 || g.cy < f.y0 || g.cy > f.y1),
    );
    const attaccate = f.a >= 0.9 && tra(f.pieno, 0.5, 0.9) && (f.parti || 1) >= 3;
    if (f.pieno < 0.5 || (sedie.length < 2 && !attaccate)) continue;
    for (const g of sedie) usati.add(g);
    metti("pranzo6", f, f.oriz ? [0, 1] : [1, 0], lungo(f));
  }
  /* il bagno: vasca, doccia, lavabo, wc e bidet */
  const bagno = [];
  for (const f of bianchi) {
    if (usati.has(f)) continue;
    /* la vasca: bianca, 1,4-1,9 per 0,6-0,9, lungo il muro */
    if (f.pieno >= 0.65 && tra(f.a, 0.45, 0.9) && tra(f.b, 1.35, 1.9)) {
      const d = controIlMuro(f, 0.4);
      if (d) {
        metti("vasca", f, d);
        bagno.push(f.stanza);
      }
      continue;
    }
    /* la doccia: un quadrato bianco 70-120 cm con le diagonali */
    if (f.pieno >= 0.8 && tra(f.a, 0.6, 1.2) && f.a / f.b >= 0.6) {
      let diag = 0,
        tutti = 0;
      for (let t = 0.15; t <= 0.85; t += 0.02) {
        for (const [x, y] of [
          [f.x0 + t * f.bw, f.y0 + t * f.bh],
          [f.x1 - t * f.bw, f.y0 + t * f.bh],
        ]) {
          tutti++;
          const i = Math.round(y) * w + Math.round(x);
          let riga = false;
          for (let d = -2; d <= 2 && !riga; d++) if (luce(data, i + d) < 215) riga = true;
          if (riga) diag++;
        }
      }
      const muri = ["su", "giu", "sx", "dx"].filter((l) => muroAccanto(f, l) >= 0.5);
      if (diag >= tutti * 0.5 && muri.length) {
        const d = versi[muri[0]].map((v) => -v);
        metti("doccia", f, d);
        bagno.push(f.stanza);
      }
    }
  }
  /* il lavabo: bianco piccolo sopra il mobile di legno (o scuro), al muro */
  for (const v of [...legni, ...neri, ...grigi]) {
    if (usati.has(v) || !tra(v.a, 0.35, 0.7) || !tra(v.b, 0.5, 1.6)) continue;
    const dentro = bianchi.find(
      (f) =>
        !usati.has(f) &&
        tra(f.a, 0.2, 0.6) &&
        tra(f.b, 0.25, 0.8) &&
        vicino(v, f, 0) &&
        f.cx > v.x0 &&
        f.cx < v.x1 &&
        f.cy > v.y0 &&
        f.cy < v.y1,
    );
    const d = dentro && controIlMuro(v, 0.5);
    if (!d) continue;
    usati.add(dentro);
    metti("lavabo", v, d, lungo(v));
    bagno.push(v.stanza);
  }
  /* la scrivania: bianca o di legno, lunga, con una sedia davanti */
  for (const f of [...bianchi, ...legni]) {
    if (usati.has(f) || f.pieno < 0.8 || !tra(f.a, 0.45, 0.85) || !tra(f.b, 0.9, 2.0)) continue;
    const sedie = [...neri, ...grigi, ...bianchi].filter(
      (g) =>
        g !== f && !usati.has(g) && tra(g.a, 0.2, 0.7) && tra(g.b, 0.25, 0.75) && vicino(f, g, 0.5),
    );
    if (sedie.length !== 1) continue;
    const s = sedie[0];
    const davanti = f.oriz ? [0, Math.sign(s.cy - f.cy) || 1] : [Math.sign(s.cx - f.cx) || 1, 0];
    usati.add(s);
    metti("scrivania", f, davanti, lungo(f));
  }
  /* l'isola: legno staccato dai muri, con gli sgabelli neri da una parte */
  for (const f of legni) {
    if (usati.has(f) || f.pieno < 0.75 || !tra(f.a, 0.4, 1.2) || !tra(f.b, 0.9, 2.8)) continue;
    if (["su", "giu", "sx", "dx"].some((l) => muroAccanto(f, l) > 0.3)) continue;
    const sgabelli = neri.filter(
      (g) => !usati.has(g) && tra(g.a, 0.2, 0.55) && tra(g.b, 0.2, 0.6) && vicino(f, g, 0.5),
    );
    if (!sgabelli.length) continue;
    const sx = sgabelli.reduce((a, g) => a + g.cx, 0) / sgabelli.length,
      sy = sgabelli.reduce((a, g) => a + g.cy, 0) / sgabelli.length;
    for (const g of sgabelli) usati.add(g);
    metti(
      "isola",
      f,
      f.oriz ? [0, Math.sign(sy - f.cy) || 1] : [Math.sign(sx - f.cx) || 1, 0],
      lungo(f),
    );
  }
  /* wc e bidet: piccoli, bianchi, con la schiena al muro, in un bagno (una
   * stanza dove c'e' gia' una vasca, una doccia, un lavabo, o un altro di
   * loro) */
  const sanitari = bianchi.filter(
    (f) => !usati.has(f) && f.pieno >= 0.55 && tra(f.a, 0.28, 0.5) && tra(f.b, 0.38, 0.75),
  );
  const perStanza = new Map();
  for (const f of sanitari) {
    const d = testaAlMuro(f, 0.5);
    if (!d) continue;
    if (!perStanza.has(f.stanza)) perStanza.set(f.stanza, []);
    perStanza.get(f.stanza).push([f, d]);
  }
  for (const [stanza, sue] of perStanza) {
    if (!bagno.includes(stanza) && sue.length < 2) continue;
    sue.sort((p, q) => p[0].cx + p[0].cy - (q[0].cx + q[0].cy));
    sue.slice(0, 4).forEach(([f, d], i) => metti(i % 2 ? "bidet" : "wc", f, d));
  }
  /* il divano: bianco (o colorato), lungo e profondo quasi un metro, con lo
   * schienale: la riga lungo un lato lungo, a 15-30 cm dal bordo */
  for (const f of grandi) {
    if (usati.has(f) || f.pieno < 0.7 || !tra(f.a, 0.5, 1.1) || !tra(f.b, 1.4, 3.0)) continue;
    const righe = (verso) => {
      let n = 0,
        tot = 0;
      for (let d = Math.round(m(0.1)); d <= Math.round(m(0.3)); d++)
        for (let t = 0.2; t <= 0.8; t += 0.05) {
          const x = f.oriz ? f.x0 + t * f.bw : verso < 0 ? f.x0 + d : f.x1 - d,
            y = f.oriz ? (verso < 0 ? f.y0 + d : f.y1 - d) : f.y0 + t * f.bh;
          tot++;
          if (luce(data, Math.round(y) * w + Math.round(x)) < 215) n++;
        }
      return tot ? n / tot : 0;
    };
    const a = righe(-1),
      b = righe(1);
    let dietro = null;
    if (Math.abs(a - b) >= 0.04) dietro = a > b ? -1 : 1;
    else {
      const d = controIlMuro(f, 0.4);
      if (d) dietro = f.oriz ? -d[1] : -d[0];
    }
    if (!dietro) continue;
    metti("divano", f, f.oriz ? [0, -dietro] : [-dietro, 0], lungo(f));
  }
  /* gli armadi: strisce bianche profonde 50-72 cm, lunghe, al muro */
  for (const f of bianchi) {
    if (usati.has(f) || f.pieno < 0.8 || !tra(f.a, 0.5, 0.72) || !tra(f.b, 0.9, 3.6)) continue;
    const d = controIlMuro(f, 0.6);
    if (d) metti("armadio", f, d, lungo(f));
  }
  /* il camino o la stufa: un blocco grigio contro il muro */
  for (const f of grigi) {
    /* tozzo: una madia grigia lunga e stretta non e' un camino */
    if (
      usati.has(f) ||
      f.pieno < 0.7 ||
      !tra(f.a, 0.45, 1.0) ||
      !tra(f.b, 0.6, 2.0) ||
      f.b > f.a * 2.5
    )
      continue;
    const d = controIlMuro(f, 0.5);
    if (d) metti("camino", f, d, lungo(f));
  }
  /* il piano della cucina: una striscia colorata profonda 50-80 cm lungo il
   * muro (anche a L: si prende il pezzo piu' lungo) */
  for (const f of altri) {
    if (usati.has(f) || !tra(f.a, 0.5, 0.85) || f.b < 1.2 || f.b > 5 || f.pieno < 0.75) continue;
    const d = controIlMuro(f, 0.6);
    if (d) metti("cucina", f, d, lungo(f));
  }
  return trovati;
}
