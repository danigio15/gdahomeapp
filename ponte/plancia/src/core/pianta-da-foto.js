/* La pianta dalla foto di una planimetria: muri, stanze, porte e finestre.
 *
 * Per la «Casa 3D»: chi non ha il disegno tecnico ha quasi sempre la
 * planimetria catastale, in PDF o in una foto fatta col telefono. Da li' si
 * ricava la casa, tutto sul dispositivo: la foto non va da nessuna parte.
 *
 * Il modulo e' puro: lavora su un'immagine come la da' una canvas
 * ({ width, height, data } con quattro byte per pixel) e torna numeri.
 *
 *   1. raddrizzare: si prova qualche grado a destra e a sinistra e si tiene
 *      l'angolo in cui le righe scure sono piu' "a colonna" (i muri sono dritti);
 *   2. inchiostro: un pixel e' scuro se lo e' rispetto a quello che ha intorno
 *      (la luce di una foto non e' mai uniforme);
 *   3. la griglia: celle da 3 cm, piena se e' piena d'inchiostro;
 *   4. i muri: si tolgono le cose sottili (scritte, quote, archi delle porte,
 *      le due righe delle finestre) e i pezzetti; resta quello che e' spesso;
 *   5. le stanze: dove si e' lontani dai muri piu' di 45 cm c'e' il "cuore" di
 *      una stanza; da li' ognuna si allarga finche' incontra le altre;
 *   6. porte e finestre: dove due stanze si toccano in un varco stretto. Se di
 *      la' c'e' il fuori e' una finestra, altrimenti una porta.
 */

export const PASSO = 0.03;

/** Quanti gradi e' storta: l'angolo che rende piu' netti i profili delle righe e delle colonne. */
export function stimaInclinazione(im) {
  const { width: w, height: h } = im,
    k = Math.max(1, Math.round(Math.max(w, h) / 500));
  const ink = inchiostro(im),
    pts = [];
  // un campione a caso (un reticolo regolare premierebbe proprio lo zero)
  let seme = 7;
  const caso = () => (seme = (seme * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < w * h; i++)
    if (ink[i] && caso() < 1 / (k * k)) pts.push((i % w) - w / 2, ((i / w) | 0) - h / 2);
  let meglio = 0,
    punteggio = -1;
  for (let a = -5; a <= 5.0001; a += 0.1) {
    const r = (a * Math.PI) / 180,
      c = Math.cos(r),
      s = Math.sin(r),
      righe = new Map(),
      colonne = new Map();
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i] * c - pts[i + 1] * s,
        y = pts[i] * s + pts[i + 1] * c;
      const ry = Math.round(y / 2),
        rx = Math.round(x / 2);
      righe.set(ry, (righe.get(ry) || 0) + 1);
      colonne.set(rx, (colonne.get(rx) || 0) + 1);
    }
    let p = 0;
    for (const v of righe.values()) p += v * v;
    for (const v of colonne.values()) p += v * v;
    if (p > punteggio) {
      punteggio = p;
      meglio = a;
    }
  }
  return meglio;
}

/* ── la foto di sbieco ──────────────────────────────────────────────────
 *
 * «Guarda attentamente la foto della planimetria: non c'entra nulla con
 * quella che hai fatto.» Una pianta fotografata col telefono non e' mai
 * davanti: il foglio e' un trapezio, i muri di sopra e di sotto non sono
 * paralleli e girare la foto non basta. Qui si cercano le righe lunghe dei
 * muri pieni (la trasformata di Hough sui loro bordi), si dividono nelle due
 * famiglie (quasi orizzontali e quasi verticali), si trova il punto dove
 * ogni famiglia converge e da li' la trasformazione che le rende di nuovo
 * parallele e dritte. */

/* Il bordo dei muri pieni: i pixel del nucleo con un vicino fuori. */
function bordiDeiMuri(im) {
  const { width: w, height: h, data } = im;
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++)
    g[i] = 0.3 * data[i * 4] + 0.59 * data[i * 4 + 1] + 0.11 * data[i * 4 + 2];
  const nucleo = nucleoDeiMuri(g, w, h, Math.max(2, Math.round(Math.max(w, h) / 230)));
  const punti = [];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!nucleo[i]) continue;
      if (!nucleo[i - 1] || !nucleo[i + 1] || !nucleo[i - w] || !nucleo[i + w]) punti.push(x, y);
    }
  return punti;
}

/* Gli autovettori di una matrice 3x3 simmetrica (Jacobi): quello del valore
 * piu' piccolo. */
function minimoAutovettore(m) {
  const a = m.map((r) => r.slice()),
    v = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  for (let giro = 0; giro < 60; giro++) {
    let p = 0,
      q = 1;
    for (const [i, j] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ])
      if (Math.abs(a[i][j]) > Math.abs(a[p][q])) ((p = i), (q = j));
    if (Math.abs(a[p][q]) < 1e-15) break;
    const t = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]),
      c = Math.cos(t),
      s = Math.sin(t);
    for (let k = 0; k < 3; k++) {
      const akp = a[k][p],
        akq = a[k][q];
      a[k][p] = c * akp - s * akq;
      a[k][q] = s * akp + c * akq;
    }
    for (let k = 0; k < 3; k++) {
      const apk = a[p][k],
        aqk = a[q][k];
      a[p][k] = c * apk - s * aqk;
      a[q][k] = s * apk + c * aqk;
    }
    for (let k = 0; k < 3; k++) {
      const vkp = v[k][p],
        vkq = v[k][q];
      v[k][p] = c * vkp - s * vkq;
      v[k][q] = s * vkp + c * vkq;
    }
  }
  let k = 0;
  for (let i = 1; i < 3; i++) if (a[i][i] < a[k][k]) k = i;
  return [v[0][k], v[1][k], v[2][k]];
}

const croce = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

function per3(m, v) {
  return [0, 1, 2].map((i) => m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2]);
}
function prodotto(a, b) {
  return [0, 1, 2].map((i) =>
    [0, 1, 2].map((j) => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]),
  );
}
function inversa(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h,
    B = -(d * i - f * g),
    C = d * h - e * g,
    det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ];
}

/**
 * Le righe dei muri e la trasformazione che le raddrizza, o `null` se la
 * foto e' gia' davanti (o se le righe non bastano per dirlo).
 *
 * Torna `{ T, righe }`: T porta un punto della foto (x, y, 1) nel punto
 * raddrizzato, in pixel; righe sono quelle trovate (per le prove).
 */
export function prospettiva(im) {
  const { width: w, height: h } = im;
  let punti = bordiDeiMuri(im);
  /* abbastanza bordi, non troppi */
  const quanti = punti.length / 2;
  if (quanti < 200) return null;
  const salto = Math.max(1, Math.round(quanti / 60000));
  const cx = w / 2,
    cy = h / 2,
    sc = Math.max(w, h) / 2;
  const passoA = 0.2,
    largo = 16,
    nA = Math.round((2 * largo) / passoA) + 1,
    rMax = Math.ceil(Math.hypot(w, h) / 2),
    nR = 2 * rMax + 1;
  const famiglie = [];
  for (const base of [90, 0]) {
    /* base 90: la normale in verticale, righe orizzontali */
    const acc = new Int32Array(nA * nR),
      cs = [],
      sn = [];
    for (let a = 0; a < nA; a++) {
      const t = ((base - largo + a * passoA) * Math.PI) / 180;
      cs.push(Math.cos(t));
      sn.push(Math.sin(t));
    }
    for (let p = 0; p < punti.length; p += 2 * salto) {
      const x = punti[p] - cx,
        y = punti[p + 1] - cy;
      for (let a = 0; a < nA; a++) acc[a * nR + Math.round(x * cs[a] + y * sn[a]) + rMax]++;
    }
    const minimo = Math.max(30, Math.round((Math.max(w, h) * 0.07) / salto));
    const righe = [];
    for (let giro = 0; giro < 14; giro++) {
      let m = 0,
        dove = -1;
      for (let i = 0; i < acc.length; i++)
        if (acc[i] > m) {
          m = acc[i];
          dove = i;
        }
      if (m < minimo) break;
      const a = Math.floor(dove / nR),
        r = (dove % nR) - rMax;
      righe.push({ t: base - largo + a * passoA, r, voti: m });
      /* via i vicini: la stessa riga, l'altra faccia dello stesso muro */
      for (let da = -15; da <= 15; da++)
        for (let dr = -12; dr <= 12; dr++) {
          const aa = a + da,
            rr = r + dr + rMax;
          if (aa >= 0 && aa < nA && rr >= 0 && rr < nR) acc[aa * nR + rr] = 0;
        }
    }
    famiglie.push(righe);
  }
  const [oriz, vert] = famiglie;
  if (oriz.length < 2 || vert.length < 2) return null;
  /* il punto dove converge ogni famiglia, in coordinate col centro in mezzo */
  const fuga = (righe) => {
    const M = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    for (const { t, r, voti } of righe) {
      const a = (t * Math.PI) / 180,
        l = [Math.cos(a), Math.sin(a), -r / sc];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[i][j] += voti * l[i] * l[j];
    }
    return minimoAutovettore(M);
  };
  const v1 = fuga(oriz),
    v2 = fuga(vert);
  const linf = croce(v1, v2);
  if (Math.abs(linf[2]) < 1e-9) return null;
  const H1 = [
    [1, 0, 0],
    [0, 1, 0],
    [linf[0] / linf[2], linf[1] / linf[2], 1],
  ];
  /* dopo H1 le due famiglie sono parallele: le direzioni vanno sugli assi */
  const d1 = per3(H1, v1),
    d2 = per3(H1, v2);
  let a1 = [d1[0], d1[1]],
    a2 = [d2[0], d2[1]];
  const n1 = Math.hypot(...a1),
    n2 = Math.hypot(...a2);
  if (!n1 || !n2) return null;
  a1 = a1.map((v) => v / n1);
  a2 = a2.map((v) => v / n2);
  if (a1[0] < 0) a1 = a1.map((v) => -v);
  if (a2[1] < 0) a2 = a2.map((v) => -v);
  const B = inversa([
    [a1[0], a2[0], 0],
    [a1[1], a2[1], 0],
    [0, 0, 1],
  ]);
  if (!B) return null;
  const N = [
    [1 / sc, 0, -cx / sc],
    [0, 1 / sc, -cy / sc],
    [0, 0, 1],
  ];
  let T = prodotto(B, prodotto(H1, N));
  /* gia' davanti: niente da fare */
  const ang = (x, y) => {
    const p = per3(T, [x, y, 1]);
    return [p[0] / p[2], p[1] / p[2]];
  };
  const angoli = [ang(0, 0), ang(w, 0), ang(w, h), ang(0, h)];
  for (const [x, y] of [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ])
    if (per3(T, [x, y, 1])[2] <= 0) return null;
  const xs = angoli.map((p) => p[0]),
    ys = angoli.map((p) => p[1]);
  const bw = Math.max(...xs) - Math.min(...xs),
    bh = Math.max(...ys) - Math.min(...ys);
  const k = Math.max(w, h) / Math.max(bw, bh);
  const S = [
    [k, 0, -Math.min(...xs) * k],
    [0, k, -Math.min(...ys) * k],
    [0, 0, 1],
  ];
  T = prodotto(S, T);
  /* quanto si sposta un angolo: sotto un pixel e mezzo, la foto e' davanti */
  let sposta = 0;
  const ow = Math.round(bw * k),
    oh = Math.round(bh * k);
  const scala = Math.max(w, h) / Math.max(ow, oh);
  void scala;
  for (const [x, y] of [
    [w * 0.25, h * 0.25],
    [w * 0.75, h * 0.25],
    [w * 0.75, h * 0.75],
    [w * 0.25, h * 0.75],
  ]) {
    const p = per3(T, [x, y, 1]);
    sposta = Math.max(sposta, Math.hypot(p[0] / p[2] - x * (ow / w), p[1] / p[2] - y * (oh / h)));
  }
  /* troppo storta per crederci: le righe erano sbagliate */
  if (ow < w * 0.5 || oh < h * 0.5 || ow > w * 2 || oh > h * 2) return null;
  return { T, larghezza: ow, altezza: oh, sposta, righe: { oriz, vert } };
}

/** La foto raddrizzata con la trasformazione di `prospettiva`. */
export function raddrizza(im, { T, larghezza, altezza }) {
  const { width: w, height: h, data } = im;
  const I = inversa(T);
  const out = new Uint8ClampedArray(larghezza * altezza * 4);
  for (let y = 0; y < altezza; y++)
    for (let x = 0; x < larghezza; x++) {
      const zz = I[2][0] * x + I[2][1] * y + I[2][2],
        sx = (I[0][0] * x + I[0][1] * y + I[0][2]) / zz,
        sy = (I[1][0] * x + I[1][1] * y + I[1][2]) / zz;
      const o = (y * larghezza + x) * 4;
      const x0 = Math.floor(sx),
        y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) {
        out[o] = 59;
        out[o + 1] = 58;
        out[o + 2] = 55;
        out[o + 3] = 255;
        continue;
      }
      const fx = sx - x0,
        fy = sy - y0;
      for (let c = 0; c < 3; c++) {
        const i = (y0 * w + x0) * 4 + c;
        out[o + c] =
          data[i] * (1 - fx) * (1 - fy) +
          data[i + 4] * fx * (1 - fy) +
          data[i + w * 4] * (1 - fx) * fy +
          data[i + w * 4 + 4] * fx * fy;
      }
      out[o + 3] = 255;
    }
  return { data: out, width: larghezza, height: altezza };
}

/** L'inchiostro: 1 dove il pixel e' scuro rispetto ai dintorni (media su una finestra di 31 px). */
export function inchiostro(im) {
  const { width: w, height: h, data } = im,
    g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++)
    g[i] = 0.3 * data[i * 4] + 0.59 * data[i * 4 + 1] + 0.11 * data[i * 4 + 2];
  // immagine integrale per la media locale
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let riga = 0;
    for (let x = 0; x < w; x++) {
      riga += g[y * w + x];
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + riga;
    }
  }
  // il tavolo sotto il foglio: lo scuro che tocca il bordo della foto.
  /* Scuro largo, non una riga: la media di un quadratino attorno. Una quota o
   * il contorno del tetto che arrivano al bordo sono righe sottili, e da li'
   * il tavolo arrivava fino ai muri grigi della casa e li cancellava. */
  const rf = Math.max(2, Math.round(Math.max(w, h) / 400));
  const scuroLargo = (i) => {
    const x = i % w,
      y = (i - x) / w;
    const x0 = Math.max(0, x - rf),
      x1 = Math.min(w, x + rf + 1),
      y0 = Math.max(0, y - rf),
      y1 = Math.min(h, y + rf + 1);
    const m =
      (I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0]) /
      ((x1 - x0) * (y1 - y0));
    return g[i] < 130 && m < 130;
  };
  const fondo = new Uint8Array(w * h),
    pila = [];
  for (let x = 0; x < w; x++)
    for (const y of [0, h - 1]) {
      const i = y * w + x;
      if (scuroLargo(i) && !fondo[i]) {
        fondo[i] = 1;
        pila.push(i);
      }
    }
  for (let y = 0; y < h; y++)
    for (const x of [0, w - 1]) {
      const i = y * w + x;
      if (scuroLargo(i) && !fondo[i]) {
        fondo[i] = 1;
        pila.push(i);
      }
    }
  while (pila.length) {
    const i = pila.pop(),
      x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w])
      if (j >= 0 && j < w * h && !fondo[j] && scuroLargo(j)) {
        fondo[j] = 1;
        pila.push(j);
      }
  }
  /* La finestra del confronto cresce con la foto: in una foto grande un muro
   * campito di grigio e' largo trenta pixel, e con una finestra piccola il
   * suo grigio si confrontava con se stesso — restavano solo i bordi. */
  const R = Math.max(31, Math.round(Math.max(w, h) / 30)),
    out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - R),
        x1 = Math.min(w, x + R + 1),
        y0 = Math.max(0, y - R),
        y1 = Math.min(h, y + R + 1);
      const m =
        (I[y1 * (w + 1) + x1] -
          I[y0 * (w + 1) + x1] -
          I[y1 * (w + 1) + x0] +
          I[y0 * (w + 1) + x0]) /
        ((x1 - x0) * (y1 - y0));
      const v = g[y * w + x],
        i = y * w + x;
      out[i] = !fondo[i] && (v < 95 || v < m - 30) ? 1 : 0;
    }
  return out;
}

/**
 * I muri pieni di una pianta (campiti di grigio o di nero), e solo loro.
 *
 * «Guarda attentamente la foto della planimetria: non c'entra nulla con
 * quella che hai fatto.» Nelle piante dell'architetto e del catasto i muri
 * sono pieni e tutto il resto — quote, scritte, sanitari, scale, il
 * contorno del tetto, l'albero — e' fatto di righe sottili. L'inchiostro
 * le prende tutte, e chiudendole venivano stanze finte fuori casa. Qui si
 * guarda la media su un quadrato di 18 cm: dentro un muro resta scura,
 * su una riga sottile (anche nera) si schiarisce col bianco attorno.
 *
 * Torna `{ ink, metri }`: l'inchiostro dei soli muri (riallargati al loro
 * spessore) e quanti m² di muro pieno ci sono. Con pochi m² la pianta non ha
 * muri pieni (un disegno a doppia riga) e si usa `inchiostro`.
 */
export function muriPieni(im, mpp) {
  const { width: w, height: h, data } = im;
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++)
    g[i] = 0.3 * data[i * 4] + 0.59 * data[i * 4 + 1] + 0.11 * data[i * 4 + 2];
  /* un quadrato di 13 cm: ci sta dentro anche un tramezzo da 15 */
  const r = Math.max(2, Math.round(0.06 / (mpp || 0.01)));
  const carta = cartaDi(g);
  const nucleo = nucleoDeiMuri(g, w, h, r, carta);
  let n = 0,
    pieno = 0;
  for (let i = 0; i < w * h; i++)
    if (nucleo[i]) {
      n++;
      if (g[i] < carta * 0.8) pieno++;
    }
  /* il muro intero: lo scuro a non piu' di r dal nucleo */
  const J = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let riga = 0;
    for (let x = 0; x < w; x++) {
      riga += nucleo[y * w + x];
      J[(y + 1) * (w + 1) + x + 1] = J[y * (w + 1) + x + 1] + riga;
    }
  }
  const ink = new Uint8Array(w * h),
    linee = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (g[i] >= carta * 0.85) continue;
      const x0 = Math.max(0, x - r),
        x1 = Math.min(w, x + r + 1),
        y0 = Math.max(0, y - r),
        y1 = Math.min(h, y + r + 1);
      if (
        J[y1 * (w + 1) + x1] - J[y0 * (w + 1) + x1] - J[y1 * (w + 1) + x0] + J[y0 * (w + 1) + x0] >
        0
      )
        ink[i] = 1;
      /* le righe sottili: il vetro delle finestre, i tramezzi a doppia riga,
       * i gradini delle scale */
      else if (g[i] < carta * 0.75) linee[i] = 1;
    }
  /* Pieno davvero: dentro il muro quasi tutto e' scuro. Due righe vicine
   * (il catasto a doppia riga) fanno scura la media ma in mezzo c'e' bianco. */
  const riempito = n ? pieno / n : 0;
  return { ink, linee, metri: riempito >= 0.62 ? n * (mpp || 0.01) ** 2 : 0, riempito };
}

/* la carta: il chiaro che c'e' di piu' */
function cartaDi(g) {
  const campione = [];
  const passo = Math.max(1, Math.floor(g.length / 20000));
  for (let i = 0; i < g.length; i += passo) campione.push(g[i]);
  campione.sort((a, b) => a - b);
  return campione[Math.floor(campione.length * 0.7)] || 255;
}

/* Il cuore dei muri pieni: dove la media su un quadrato di lato 2r+1 e'
 * scura e quasi nessun pixel e' chiaro. Dentro un muro campito di grigio non
 * c'e' bianco; in un mucchio di righe (i sanitari, le scale, le piastrelle,
 * una scritta, l'albero) la media e' scura uguale, ma fra una riga e l'altra
 * c'e' la carta. */
function nucleoDeiMuri(g, w, h, r, carta = cartaDi(g)) {
  const I = new Float64Array((w + 1) * (h + 1)),
    K = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let riga = 0,
      chiari = 0;
    for (let x = 0; x < w; x++) {
      riga += g[y * w + x];
      chiari += g[y * w + x] >= carta * 0.85 ? 1 : 0;
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + riga;
      K[(y + 1) * (w + 1) + x + 1] = K[y * (w + 1) + x + 1] + chiari;
    }
  }
  const soglia = carta * 0.72,
    nucleo = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r),
        x1 = Math.min(w, x + r + 1),
        y0 = Math.max(0, y - r),
        y1 = Math.min(h, y + r + 1),
        area = (x1 - x0) * (y1 - y0);
      const a = y1 * (w + 1) + x1,
        b = y0 * (w + 1) + x1,
        c = y1 * (w + 1) + x0,
        d = y0 * (w + 1) + x0;
      if ((I[a] - I[b] - I[c] + I[d]) / area < soglia && (K[a] - K[b] - K[c] + K[d]) / area <= 0.08)
        nucleo[y * w + x] = 1;
    }
  return nucleo;
}

/** I m² di muro pieno oltre i quali la pianta e' «a muri pieni». */
export const MURI_PIENI_MINIMO = 3;

/* Le operazioni sulla griglia: «c'e' inchiostro in un quadrato di lato 2r+1
 * attorno?» (allarga) e «e' tutto pieno?» (stringe), con l'immagine integrale
 * cosi' costano uguale per qualunque r. */
function integrale(g, W, H) {
  const I = new Int32Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let riga = 0;
    for (let x = 0; x < W; x++) {
      riga += g[y * W + x];
      I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + riga;
    }
  }
  return I;
}
function quanti(I, W, H, x, y, r) {
  const x0 = Math.max(0, x - r),
    x1 = Math.min(W, x + r + 1),
    y0 = Math.max(0, y - r),
    y1 = Math.min(H, y + r + 1);
  return {
    n: I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0],
    area: (x1 - x0) * (y1 - y0),
  };
}
function allarga(g, W, H, r) {
  if (r <= 0) return g.slice();
  const I = integrale(g, W, H),
    out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) out[y * W + x] = quanti(I, W, H, x, y, r).n > 0 ? 1 : 0;
  return out;
}
function stringi(g, W, H, r) {
  if (r <= 0) return g.slice();
  const I = integrale(g, W, H),
    out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = quanti(I, W, H, x, y, r);
      out[y * W + x] = q.n === q.area ? 1 : 0;
    }
  return out;
}

/* I pezzi collegati di una griglia, coi loro riquadri. */
function pezziDi(g, W, H) {
  const id = new Int32Array(W * H).fill(-1),
    pezzi = [];
  for (let i = 0; i < W * H; i++) {
    if (!g[i] || id[i] >= 0) continue;
    const k = pezzi.length,
      celle = [i];
    id[i] = k;
    let x0 = W,
      x1 = 0,
      y0 = H,
      y1 = 0;
    for (let t = 0; t < celle.length; t++) {
      const c = celle[t],
        x = c % W,
        y = (c / W) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (const j of [
        x > 0 ? c - 1 : -1,
        x < W - 1 ? c + 1 : -1,
        y > 0 ? c - W : -1,
        y < H - 1 ? c + W : -1,
      ])
        if (j >= 0 && g[j] && id[j] < 0) {
          id[j] = k;
          celle.push(j);
        }
    }
    pezzi.push({ celle, x0, x1, y0, y1 });
  }
  return { id, pezzi };
}

/**
 * La griglia dei muri da 3 cm, dall'inchiostro e dalla scala (metri per pixel).
 *
 * Una planimetria disegna i muri in due modi: pieni (campiti di nero) o, come
 * il catasto, con due righe sottili e il vuoto in mezzo. Qui vanno bene tutti
 * e due:
 *
 *   1. ogni cella sa se ha inchiostro, anche quando e' piu' piccola di un
 *      pixel (una schermata del catasto ha venti pixel per metro);
 *   2. si chiude: lo spazio fra due righe vicine (un muro fino a 40 cm) si
 *      riempie; una porta (dai 60 cm in su) resta aperta;
 *   3. si tolgono le cose sottili (cornice, quote, scritte, archi), tenendo
 *      quello che e' spesso almeno 9 cm;
 *   4. i muri sono la rete della casa: restano i pezzi grandi, non le scritte
 *      dentro le stanze ne' la cornice del foglio;
 *   5. la barriera aggiunge le righe sottili attaccate ai muri (il vetro delle
 *      finestre, le soglie), che servono a capire dov'e' il fuori.
 */
export function grigliaDeiMuri(
  ink,
  w,
  h,
  mpp,
  { vetri = null, porte = null, disegno = false } = {},
) {
  const lato = PASSO / mpp,
    W = Math.max(1, Math.floor(w / lato)),
    H = Math.max(1, Math.floor(h / lato)),
    riga = new Uint8Array(W * H);
  /* 1. L'inchiostro di ogni cella: i pixel che le cadono dentro, o quello
   *    sotto il suo centro se la cella e' piu' piccola di un pixel. */
  for (let cy = 0; cy < H; cy++)
    for (let cx = 0; cx < W; cx++) {
      const x0 = Math.floor(cx * lato),
        y0 = Math.floor(cy * lato),
        x1 = Math.max(x0 + 1, Math.floor((cx + 1) * lato)),
        y1 = Math.max(y0 + 1, Math.floor((cy + 1) * lato));
      let c = 0;
      for (let y = y0; y < y1 && y < h && !c; y++)
        for (let x = x0; x < x1 && x < w; x++)
          if (ink[y * w + x]) {
            c = 1;
            break;
          }
      riga[cy * W + cx] = c;
    }
  /* Gli infissi, quando il disegno li da' a parte (lo strato del DWG), nelle
   * stesse celle. */
  const celleDi = (px) => {
    const celle = new Uint8Array(W * H);
    if (!px) return celle;
    for (let cy = 0; cy < H; cy++)
      for (let cx = 0; cx < W; cx++) {
        const x0 = Math.floor(cx * lato),
          y0 = Math.floor(cy * lato),
          x1 = Math.max(x0 + 1, Math.floor((cx + 1) * lato)),
          y1 = Math.max(y0 + 1, Math.floor((cy + 1) * lato));
        let c = 0;
        for (let y = y0; y < y1 && y < h && !c; y++)
          for (let x = x0; x < x1 && x < w; x++)
            if (px[y * w + x]) {
              c = 1;
              break;
            }
        celle[cy * W + cx] = c;
      }
    return celle;
  };
  const celleVetri = celleDi(vetri),
    cellePorte = celleDi(porte);
  /* Lo scuro che tocca il bordo e' il tavolo sotto il foglio, non un muro.
   * Scuro largo (15 cm pieni), non una riga: una quota che arriva al bordo
   * della foto e tocca i muri portava via tutta la casa. */
  const largo = allarga(stringi(riga, W, H, 2), W, H, 2);
  const fondo = new Uint8Array(W * H),
    coda = [];
  const semina = (i) => {
    if (largo[i] && riga[i] && !fondo[i]) {
      fondo[i] = 1;
      coda.push(i);
    }
  };
  for (let x = 0; x < W; x++) {
    semina(x);
    semina((H - 1) * W + x);
  }
  for (let y = 0; y < H; y++) {
    semina(y * W);
    semina(y * W + W - 1);
  }
  while (coda.length) {
    const i = coda.pop(),
      x = i % W;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W])
      if (j >= 0 && j < W * H) semina(j);
  }
  for (let i = 0; i < W * H; i++) if (fondo[i]) riga[i] = 0;
  /* 2. La chiusura: si allarga e si stringe di 20 cm. Una riga sottile dopo
   *    la chiusura resta sottile; due righe vicine diventano un muro pieno. */
  const r = Math.max(1, Math.round(0.2 / PASSO));
  const chiusa = stringi(allarga(riga, W, H, r), W, H, r);
  for (let i = 0; i < W * H; i++) if (riga[i]) chiusa[i] = 1;
  /* 3. Via le cose sottili: si consuma di una cella e si ricresce. */
  const spessi = allarga(stringi(chiusa, W, H, 1), W, H, 1);
  for (let i = 0; i < W * H; i++) spessi[i] = spessi[i] && chiusa[i] ? 1 : 0;
  /* 4. Muri e scritte, chiusi, si somigliano: una parola diventa una barra
   *    spessa. La differenza sta nell'inchiostro di partenza: lungo un muro,
   *    anche a doppia riga, l'inchiostro corre senza interruzioni; in una
   *    scritta si spezza a ogni lettera (e a bassa risoluzione le lettere si
   *    toccano, quindi non basta guardare i pezzi). Si tiene un pezzo se la
   *    sua corsa piu' lunga, lungo il suo asse, ne copre almeno meta'. Fuori
   *    anche la cornice del foglio (larga quanto il foglio) e i pezzetti
   *    sotto i 40 cm. */
  /* La corsa d'inchiostro senza interruzioni, in orizzontale e in verticale,
   * per ogni cella: lungo un muro corre per tutto il muro, in una scritta si
   * spezza a ogni lettera. */
  const corsaO = new Int32Array(W * H),
    corsaV = new Int32Array(W * H);
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      if (!riga[y * W + x]) {
        x++;
        continue;
      }
      let e = x;
      while (e < W && riga[y * W + e]) e++;
      for (let q = x; q < e; q++) corsaO[y * W + q] = e - x;
      x = e;
    }
  }
  for (let x = 0; x < W; x++) {
    let y = 0;
    while (y < H) {
      if (!riga[y * W + x]) {
        y++;
        continue;
      }
      let e = y;
      while (e < H && riga[e * W + x]) e++;
      for (let q = y; q < e; q++) corsaV[q * W + x] = e - y;
      y = e;
    }
  }
  /* Cella per cella: resta muro solo vicino (entro la chiusura) a inchiostro
   *    che corre dritto per almeno 45 cm, come le righe di un muro anche
   *    corto; le lettere sono piu' corte. Cosi' cade anche una scritta che la
   *    chiusura ha attaccato a un muro vicino. */
  /* E il pezzo d'inchiostro della corsa deve essere lungo almeno 70 cm in
   * quella direzione: la gamba di una lettera alta 45 cm corre quanto basta,
   * ma la lettera finisce li'; la riga di un muro continua nel resto della
   * casa. */
  const corsaMuro = Math.round(0.45 / PASSO),
    pezzoMuro = Math.round(0.7 / PASSO);
  const sostegno = new Uint8Array(W * H);
  const tracce = pezziDi(riga, W, H);
  {
    for (let i = 0; i < W * H; i++) {
      const p = tracce.id[i] >= 0 ? tracce.pezzi[tracce.id[i]] : null;
      if (!p) continue;
      if (
        (corsaO[i] >= corsaMuro && p.x1 - p.x0 + 1 >= pezzoMuro) ||
        (corsaV[i] >= corsaMuro && p.y1 - p.y0 + 1 >= pezzoMuro)
      )
        sostegno[i] = 1;
    }
  }
  const vicino = allarga(sostegno, W, H, r + 2);
  for (let i = 0; i < W * H; i++) if (!vicino[i]) spessi[i] = 0;
  /* Quanta parte di un pezzo sta nel cuore del suo riquadro, lontano dai
   * bordi: un anello vuoto (la cornice) quasi niente, una casa coi tramezzi
   * parecchio. */
  const cuore = (p) => {
    const mx = (p.x1 - p.x0) * 0.12,
      my = (p.y1 - p.y0) * 0.12;
    let n = 0;
    for (const c of p.celle) {
      const x = c % W,
        y = (c / W) | 0;
      if (x > p.x0 + mx && x < p.x1 - mx && y > p.y0 + my && y < p.y1 - my) n++;
    }
    return n / p.celle.length;
  };
  const { pezzi } = pezziDi(spessi, W, H);
  const muro = new Uint8Array(W * H),
    minimo = 0.4 / PASSO,
    metro = 1 / PASSO;
  /* La cornice del foglio: larga quasi quanto l'immagine, un anello vuoto
   * (niente nel cuore del suo riquadro) e con dentro altro di lungo almeno
   * un metro. Una casa ritagliata stretta e' larga quanto l'immagine anche
   * lei, ma ha i tramezzi; un contorno disegnato senza stanze non ha niente
   * dentro. */
  const grande = (p) => p.x1 - p.x0 + 1 >= W * 0.85 || p.y1 - p.y0 + 1 >= H * 0.85;
  const qualcosaDentro = (p) =>
    pezzi.some(
      (q) =>
        q !== p &&
        Math.max(q.x1 - q.x0, q.y1 - q.y0) + 1 >= metro &&
        q.x0 > p.x0 &&
        q.x1 < p.x1 &&
        q.y0 > p.y0 &&
        q.y1 < p.y1,
    );
  for (const p of pezzi) {
    const lw = p.x1 - p.x0 + 1,
      lh = p.y1 - p.y0 + 1,
      estensione = Math.max(lw, lh);
    if (estensione < minimo) continue;
    if (!disegno && grande(p) && cuore(p) < 0.03 && qualcosaDentro(p)) continue;
    const corsa = lw >= lh ? corsaO : corsaV;
    let riga0 = 0;
    for (const c of p.celle) if (corsa[c] > riga0) riga0 = corsa[c];
    if (riga0 < Math.min(estensione * 0.5, metro)) continue;
    for (const c of p.celle) muro[c] = 1;
  }
  /* 4a. La casa e' la rete di muri piu' grande. Restano i pezzi a non piu'
   *     di 1,3 m da lei (separati al piu' da una porta), di passo in passo:
   *     cadono le intestazioni del foglio, la cornice, le scritte fuori. E un
   *     pezzo corto (sotto i 3 m) che non si appoggia a nessun altro muro e'
   *     una scritta: in una foto sfocata le lettere si toccano e sembrano una
   *     riga, ma un muro vero si appoggia sempre a un altro. */
  {
    /* Un disegno (DWG, «Disegnala qui») ha solo muri: niente intestazioni,
     * cornici o scritte da togliere, e un pezzo fra due finestre larghe e'
     * muro anche se sta da solo. */
    const rete = disegno ? { pezzi: [] } : pezziDi(muro, W, H);
    if (rete.pezzi.length > 1) {
      /* La rete piu' grande che non sia un anello vuoto: la cornice del
       * foglio e' un rettangolo lunghissimo senza niente dentro, la casa ha
       * i tramezzi in mezzo. */
      let maggiore = -1;
      rete.pezzi.forEach((p, k) => {
        if (cuore(p) < 0.03) return;
        if (maggiore < 0 || p.celle.length > rete.pezzi[maggiore].celle.length) maggiore = k;
      });
      if (maggiore < 0)
        rete.pezzi.forEach((p, k) => {
          if (maggiore < 0 || p.celle.length > rete.pezzi[maggiore].celle.length) maggiore = k;
        });
      const tenuti = new Uint8Array(rete.pezzi.length);
      tenuti[maggiore] = 1;
      const porta = Math.round(1.3 / PASSO);
      /* Una finestra larga piu' di una porta separa due pezzi dello stesso
       * muro, ma le righe del vetro li tengono uniti: l'inchiostro (righe e
       * infissi) che tocca un pezzo tenuto tiene anche gli altri pezzi che
       * tocca. */
      const unito = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) unito[i] = riga[i] || celleVetri[i] ? 1 : 0;
      const legami = pezziDi(unito, W, H);
      const tocca = (p) => {
        const ids = new Set();
        for (const c of p.celle) {
          const x = c % W;
          for (const j of [c, x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c - W, c + W])
            if (j >= 0 && j < W * H && legami.id[j] >= 0) ids.add(legami.id[j]);
        }
        return ids;
      };
      const toccati = rete.pezzi.map(tocca);
      for (let giro = 0; giro < 6; giro++) {
        const dentro = new Uint8Array(W * H),
          legatiDentro = new Set();
        rete.pezzi.forEach((p, k) => {
          if (!tenuti[k]) return;
          for (const c of p.celle) dentro[c] = 1;
          for (const t of toccati[k]) legatiDentro.add(t);
        });
        const vicino = allarga(dentro, W, H, porta);
        let nuovi = 0;
        rete.pezzi.forEach((p, k) => {
          if (tenuti[k]) return;
          if (p.celle.some((c) => vicino[c]) || [...toccati[k]].some((t) => legatiDentro.has(t))) {
            tenuti[k] = 1;
            nuovi++;
          }
        });
        if (!nuovi) break;
      }
      /* chi si appoggia a chi: un altro pezzo entro due celle */
      const appoggio = new Uint8Array(rete.pezzi.length);
      for (let i = 0; i < W * H; i++) {
        const a = rete.id[i];
        if (a < 0) continue;
        const x = i % W,
          y = (i / W) | 0;
        for (let dy = -2; dy <= 2 && !appoggio[a]; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const xx = x + dx,
              yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            const b = rete.id[yy * W + xx];
            if (b >= 0 && b !== a) {
              appoggio[a] = 1;
              break;
            }
          }
      }
      /* Un pezzo di muro fra due porte sta in fila con lo stesso muro: oltre
       * il varco (fino a 1,3 m), lungo il suo asse, c'e' un muro che corre
       * nella stessa direzione. Una scritta in una stanza, oltre, trova al
       * massimo la faccia di un muro di traverso, che in quella direzione e'
       * solo spesso. */
      const inFila = (p) => {
        const lw = p.x1 - p.x0 + 1,
          lh = p.y1 - p.y0 + 1,
          oriz = lw >= lh;
        const passo = oriz ? 1 : W,
          largo = oriz ? W : 1;
        const da = oriz ? p.y0 : p.x0,
          a = oriz ? p.y1 : p.x1;
        const corre = (i, d) => {
          let n = 0;
          for (let j = i; n < 200 && j >= 0 && j < W * H && muro[j]; j += d) n++;
          return n;
        };
        for (const verso of [-1, 1]) {
          let buone = 0;
          for (let t = da; t <= a; t++) {
            /* dal bordo del pezzo, lungo l'asse, attraverso il vuoto */
            let i = oriz ? t * W + (verso < 0 ? p.x0 : p.x1) : (verso < 0 ? p.y0 : p.y1) * W + t;
            while (i >= 0 && i < W * H && muro[i]) i += verso * passo;
            let k = 0;
            while (k <= porta && i >= 0 && i < W * H && !muro[i]) ((i += verso * passo), k++);
            if (k > porta || i < 0 || i >= W * H) continue;
            const lungo = corre(i, verso * passo),
              spesso = corre(i, largo) + corre(i, -largo) - 1;
            if (lungo > spesso) buone++;
          }
          if (buone * 2 >= a - da + 1) return true;
        }
        return false;
      };
      const tre = Math.round(3 / PASSO);
      rete.pezzi.forEach((p, k) => {
        const corto = Math.max(p.x1 - p.x0, p.y1 - p.y0) + 1 < tre;
        if (!tenuti[k] || (k !== maggiore && corto && !appoggio[k] && !inFila(p)))
          for (const c of p.celle) muro[c] = 0;
      });
    }
  }
  /* 4b. Le finestre: un tratto di muro piu' sottile dei due tratti dello
   *     stesso muro che ha ai lati, allineati, lungo fra 40 cm e 3,2 m. E' il
   *     vano col vetro (le righe vicine che la chiusura ha riempito). Esce dal
   *     muro e va nella barriera, dove diventa una finestra. Un tramezzo non
   *     c'entra: finisce contro muri di traverso, che non sono «lo stesso muro». */
  const spessoreMax = Math.round(0.7 / PASSO),
    vanoMin = Math.round(0.4 / PASSO),
    vanoMax = Math.round(3.2 / PASSO);
  const tO = new Int32Array(W * H),
    tV = new Int32Array(W * H);
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      if (!muro[y * W + x]) {
        x++;
        continue;
      }
      let e = x;
      while (e < W && muro[y * W + e]) e++;
      for (let q = x; q < e; q++) tO[y * W + q] = e - x;
      x = e;
    }
  }
  for (let x = 0; x < W; x++) {
    let y = 0;
    while (y < H) {
      if (!muro[y * W + x]) {
        y++;
        continue;
      }
      let e = y;
      while (e < H && muro[e * W + x]) e++;
      for (let q = y; q < e; q++) tV[q * W + x] = e - y;
      y = e;
    }
  }
  const vetro = new Uint8Array(W * H);
  /* lungo le righe: muri orizzontali, lo spessore e' tV */
  const cercaVani = (lungo, corto, n, m, at) => {
    for (let a = 0; a < n; a++) {
      /* I tratti di muro della riga, uniti se fra loro c'e' un buco di al
       * piu' 3 celle: le righe del vetro, chiuse, non sempre toccano il muro. */
      const tratti = [];
      let b = 0;
      while (b < m) {
        if (!muro[at(a, b)]) {
          b++;
          continue;
        }
        let e = b;
        while (e < m && muro[at(a, e)]) e++;
        const ultimo = tratti[tratti.length - 1];
        if (ultimo && b - ultimo.e <= 3) (ultimo.pezzi.push([b, e]), (ultimo.e = e));
        else tratti.push({ e, pezzi: [[b, e]] });
        b = e;
      }
      for (const t of tratti) {
        /* le celle del tratto in fila, coi loro spessori */
        const celle = [];
        for (const [p0, p1] of t.pezzi) for (let q = p0; q < p1; q++) celle.push(q);
        let k = 0;
        while (k < celle.length) {
          const sp = corto[at(a, celle[k])];
          let f = k;
          while (f < celle.length && Math.abs(corto[at(a, celle[f])] - sp) <= 1) f++;
          const lungoVano = celle[f - 1] - celle[k] + 1;
          if (lungoVano >= vanoMin && lungoVano <= vanoMax && k > 0 && f < celle.length) {
            const prima = corto[at(a, celle[k - 1])],
              dopo = corto[at(a, celle[f])];
            const ok = (v, c) =>
              v <= spessoreMax && v - sp >= 2 && v * 0.85 >= sp && lungo[at(a, c)] >= v;
            if (ok(prima, celle[k - 1]) && ok(dopo, celle[f]))
              for (let q = k; q < f; q++) vetro[at(a, celle[q])] = 1;
          }
          k = f;
        }
      }
    }
  };
  if (vetri) {
    /* Il disegno dice da se' dove sono gli infissi (lo strato del DWG): non
     * si indovina dallo spessore, che in un disegno vero cambia anche fra
     * due tratti di muro pieno. */
    const largo = allarga(celleVetri, W, H, 2);
    for (let i = 0; i < W * H; i++) vetro[i] = largo[i] && !muro[i] ? 1 : 0;
  } else {
    cercaVani(tO, tV, H, W, (y, x) => y * W + x);
    cercaVani(tV, tO, W, H, (x, y) => y * W + x);
  }
  for (let i = 0; i < W * H; i++) if (vetro[i]) muro[i] = 0;
  /* 5. La barriera: i muri piu' le righe sottili che li toccano e sono lunghe
   *    almeno 18 cm. Le scritte volanti no. Non diventa muro nel 3D. */
  const barriera = muro.slice();
  for (let i = 0; i < W * H; i++) if (vetro[i]) barriera[i] = 1;
  const resto = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (riga[i] && !muro[i]) resto[i] = 1;
  const altri = pezziDi(resto, W, H);
  for (const p of altri.pezzi) {
    if (Math.max(p.x1 - p.x0, p.y1 - p.y0) < 6) continue;
    let tocca = false;
    for (const c of p.celle) {
      const x = c % W;
      for (const j of [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c - W, c + W])
        if (j >= 0 && j < W * H && muro[j]) {
          tocca = true;
          break;
        }
      if (tocca) break;
    }
    if (tocca)
      for (const c of p.celle) {
        barriera[c] = 1;
        vetro[c] = 1;
      }
  }
  /* 6. Le soglie: una porta e' un varco fra due tratti dello stesso muro,
   *    allineati, largo fino a 1,3 m. Il catasto non disegna la soglia, e
   *    senza il fuori entrava dal portone e si prendeva tutta la casa. Qui il
   *    varco si chiude nella barriera (non nel muro: nel 3D resta una porta),
   *    e la porta si ritrova dove due stanze, o una stanza e il fuori, si
   *    toccano. Il muro deve continuare dritto per 20 cm da tutti e due i
   *    lati, cosi' due muri che si incontrano ad angolo non si chiudono.
   *    Oppure: un tramezzo che finisce a meno di 1,3 m da un muro di
   *    traverso. Quel varco e' la porta (nel DWG la porta e' su un altro
   *    strato; sul catasto non c'e'), e senza chiuderlo due stanze diventano
   *    una. «Finisce» vuol dire che dietro corre per piu' di quanto e'
   *    spesso: la faccia di un muro di fianco non e' una fine. */
  const varco = Math.round(1.3 / PASSO),
    tratto = Math.round(0.2 / PASSO);
  const soglie = new Uint8Array(W * H);
  const dritto = (i, passo) => {
    for (let k = 0; k < tratto; k++) {
      const j = i + passo * k;
      if (j < 0 || j >= W * H || !muro[j]) return false;
    }
    return true;
  };
  /* quanto corre il muro da i, a passi di «passo», fino a «fino» celle */
  const corre = (i, passo, fino) => {
    let n = 0;
    for (let j = i; n < fino && j >= 0 && j < W * H && muro[j]; j += passo) n++;
    return n;
  };
  const lontano = 2 * spessoreMax;
  /* la fine di un muro che corre lungo «passo»: dietro e' lungo almeno 20 cm
   * e piu' di quanto e' spesso di traverso («largo») */
  const fine = (i, passo, largo) => {
    const dietro = corre(i, passo, lontano);
    if (dietro < tratto) return false;
    const spesso = corre(i, largo, lontano) + corre(i, -largo, lontano) - 1;
    return spesso <= spessoreMax && spesso < dietro;
  };
  const chiudi = (a, b, passo, largo) => {
    if (dritto(a, -passo) && dritto(b, passo)) return true;
    return (
      (fine(a, -passo, largo) && corre(b, passo, 2) >= 2) ||
      (fine(b, passo, largo) && corre(a, -passo, 2) >= 2)
    );
  };

  /* Un varco piu' largo di una porta (un basculante, un portone, una
   * vetrata) si chiude solo se il disegno ci mette dentro qualcosa: la riga
   * della porta o del vetro, nello stesso muro e fino a 4 m. Allargata un
   * poco, perche' la riga sta in una fila sola dello spessore del muro. */
  const varcoLargo = Math.round(4 / PASSO);
  const segnato = allarga(
    celleVetri.map((v, i) => (v || cellePorte[i] ? 1 : 0)),
    W,
    H,
    Math.max(1, Math.round(0.2 / PASSO)),
  );
  const fino = (i, passo, k) => {
    for (let q = 0; q < k; q++) if (segnato[i + passo * q]) return true;
    return false;
  };
  const apri = (a, b, passo, largo, k) =>
    k <= varco
      ? chiudi(a, b, passo, largo)
      : dritto(a, -passo) && dritto(b, passo) && fino(a + passo, passo, k);
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (!muro[i - 1] || muro[i]) continue;
      let e = x;
      while (e < W && !muro[y * W + e] && e - x <= varcoLargo) e++;
      if (e >= W || e - x > varcoLargo || !muro[y * W + e]) continue;
      if (!apri(i - 1, y * W + e, 1, W, e - x)) continue;
      for (let q = x; q < e; q++) soglie[y * W + q] = 1;
    }
  for (let x = 1; x < W - 1; x++)
    for (let y = 1; y < H - 1; y++) {
      const i = y * W + x;
      if (!muro[i - W] || muro[i]) continue;
      let e = y;
      while (e < H && !muro[e * W + x] && e - y <= varcoLargo) e++;
      if (e >= H || e - y > varcoLargo || !muro[e * W + x]) continue;
      if (!apri(i - W, e * W + x, W, 1, e - y)) continue;
      for (let q = y; q < e; q++) soglie[q * W + x] = 1;
    }
  for (let i = 0; i < W * H; i++) if (soglie[i]) barriera[i] = 1;
  /* Le righe si ispessiscono di una cella: una riga storta lascia passaggi
   * in diagonale. */
  const spessa = barriera.slice();
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (barriera[i] && !muro[i])
        for (const j of [i - 1, i + 1, i - W, i + W, i - W - 1, i - W + 1, i + W - 1, i + W + 1])
          spessa[j] = 1;
    }
  /* vetro: dove la barriera e' inchiostro sottile (il vetro, le righe di una
   * finestra), e non una soglia vuota: verso il fuori, un varco col vetro e'
   * una finestra, uno senza niente e' una porta. */
  return { W, H, muro, barriera: spessa, vetro };
}

/**
 * La griglia dei muri di una pianta a muri pieni (l'architetto, una foto del
 * progetto): i muri sono gia' puliti (`muriPieni`), e le righe sottili
 * (`linee`) dicono il resto.
 *
 *   1. muro: le celle col muro pieno, senza i pezzetti sotto i 40 cm (il
 *      lavello, il frigo disegnati scuri);
 *   2. tramezzi: due righe lunghe e parallele a 6-40 cm l'una dall'altra,
 *      attaccate a un muro, sono un muro sottile (il bagno, l'antibagno);
 *   3. varchi: fra due tratti di muro, nella loro fila e fino a 4 m, se nel
 *      varco ci sono le righe del vetro e' una finestra; se e' vuoto e
 *      largo fino a 1,3 m e' una porta;
 *   4. scale: almeno quattro righe parallele, lunghe e a passo regolare
 *      (i gradini).
 */
export function grigliaDaMuriPieni(ink, linee, w, h, mpp) {
  const lato = PASSO / mpp,
    W = Math.max(1, Math.floor(w / lato)),
    H = Math.max(1, Math.floor(h / lato)),
    N = W * H;
  const celleDi = (px, quota) => {
    const celle = new Uint8Array(N);
    for (let cy = 0; cy < H; cy++)
      for (let cx = 0; cx < W; cx++) {
        const x0 = Math.floor(cx * lato),
          y0 = Math.floor(cy * lato),
          x1 = Math.max(x0 + 1, Math.floor((cx + 1) * lato)),
          y1 = Math.max(y0 + 1, Math.floor((cy + 1) * lato));
        let c = 0,
          n = 0;
        for (let y = y0; y < y1 && y < h; y++)
          for (let x = x0; x < x1 && x < w; x++) {
            n++;
            if (px[y * w + x]) c++;
          }
        celle[cy * W + cx] = n && c / n >= quota ? 1 : 0;
      }
    return celle;
  };
  let muro = celleDi(ink, 0.5);
  /* i buchini dentro il muro (un riflesso, la grana della foto) */
  muro = stringi(allarga(muro, W, H, 1), W, H, 1);
  const riga = celleDi(linee, 0.01);
  for (let i = 0; i < N; i++) if (muro[i]) riga[i] = 0;
  /* I muri pieni veri, per dire dove si appoggia un tramezzo: i pezzi di
   * almeno 60 cm (non le lettere in grassetto di una scritta). */
  const appoggi = new Uint8Array(N);
  for (const p of pezziDi(muro, W, H).pezzi)
    if (Math.max(p.x1 - p.x0, p.y1 - p.y0) + 1 >= 0.6 / PASSO)
      for (const c of p.celle) appoggi[c] = 1;
  const vicinoAgliAppoggi = allarga(appoggi, W, H, Math.round(0.3 / PASSO));
  /* Un tramezzo va da un muro all'altro: almeno un capo tocca un muro vero.
   * Il riquadro di una scritta in mezzo alla stanza, due quote parallele
   * sotto il disegno, no. */
  const appoggiato = (p) => {
    const oriz = p.x1 - p.x0 >= p.y1 - p.y0;
    const capo = (da, a) =>
      p.celle.some((c) => {
        const t = oriz ? c % W : (c / W) | 0;
        return t >= da && t <= a && vicinoAgliAppoggi[c];
      });
    return oriz
      ? capo(p.x0, p.x0 + 2) || capo(p.x1 - 2, p.x1)
      : capo(p.y0, p.y0 + 2) || capo(p.y1 - 2, p.y1);
  };
  /* Una fascia sottile fra due tratti di muro piu' spessi di lei, nella
   * stessa fila, e' il vetro di una finestra, non un tramezzo. */
  const vetroNelMuro = (p) => {
    const oriz = p.x1 - p.x0 >= p.y1 - p.y0;
    const banda = oriz ? p.y1 - p.y0 + 1 : p.x1 - p.x0 + 1,
      mezzo = oriz ? (p.y0 + p.y1) >> 1 : (p.x0 + p.x1) >> 1;
    let accanto = 0;
    for (const [da, aa] of oriz
      ? [
          [p.x0 - 12, p.x0 - 1],
          [p.x1 + 1, p.x1 + 12],
        ]
      : [
          [p.y0 - 12, p.y0 - 1],
          [p.y1 + 1, p.y1 + 12],
        ])
      for (let t = Math.max(0, da); t <= aa && t < (oriz ? W : H); t++) {
        const i = oriz ? mezzo * W + t : t * W + mezzo;
        if (!muro[i]) continue;
        const passo = oriz ? W : 1;
        let n = 1;
        for (let j = i - passo; j >= 0 && muro[j] && n < 40; j -= passo) n++;
        for (let j = i + passo; j < N && muro[j] && n < 40; j += passo) n++;
        /* un muro di traverso (lungo piu' di 70 cm di qua e di la') non
         * e' lo stesso muro: e' quello dove il tramezzo si appoggia */
        if (n <= Math.round(0.7 / PASSO)) accanto = Math.max(accanto, n);
      }
    return accanto > banda + 1;
  };
  /* Un tramezzo pieno a meta': una fascia scura lunga (90 cm e oltre) e
   * sottile (9-40 cm), un po' muro campito e un po' righe. A pezzi i suoi
   * tratti pieni sembravano un lavello e se ne andavano. */
  const pieno = new Uint8Array(N);
  {
    const scuro = new Uint8Array(N);
    for (let i = 0; i < N; i++) scuro[i] = muro[i] || riga[i] ? 1 : 0;
    const lunga = Math.round(0.9 / PASSO),
      sMin = 3,
      sMax = Math.round(0.21 / PASSO);
    for (const oriz of [true, false]) {
      const n = oriz ? H : W,
        m = oriz ? W : H,
        at = oriz ? (a, b) => a * W + b : (a, b) => b * W + a;
      const run = new Int32Array(N);
      for (let a = 0; a < n; a++) {
        let b = 0;
        while (b < m) {
          if (!scuro[at(a, b)]) {
            b++;
            continue;
          }
          let e = b;
          while (e < m && scuro[at(a, e)]) e++;
          for (let q = b; q < e; q++) run[at(a, q)] = e - b;
          b = e;
        }
      }
      /* di traverso: quanto e' spessa la fascia lunga */
      for (let b = 0; b < m; b++) {
        let a = 0;
        while (a < n) {
          if (run[at(a, b)] < lunga) {
            a++;
            continue;
          }
          let e = a;
          while (e < n && run[at(e, b)] >= lunga) e++;
          if (e - a >= sMin && e - a <= sMax) for (let q = a; q < e; q++) pieno[at(q, b)] = 1;
          a = e;
        }
      }
    }
    for (let i = 0; i < N; i++) if (muro[i]) pieno[i] = 0;
    /* Pieno a meta' davvero: lungo la fascia ci sono tratti di muro campito.
     * Una quota con sopra i numeri, il vetro di una finestra, sono solo
     * righe. */
    const oltre = Math.round(0.5 / PASSO);
    for (const p of pezziDi(pieno, W, H).pezzi) {
      /* il riquadro allungato di mezzo metro: i tratti campiti stanno in
       * fila coi pezzi a righe */
      const oriz = p.x1 - p.x0 >= p.y1 - p.y0,
        x0 = Math.max(0, p.x0 - (oriz ? oltre : 0)),
        x1 = Math.min(W - 1, p.x1 + (oriz ? oltre : 0)),
        y0 = Math.max(0, p.y0 - (oriz ? 0 : oltre)),
        y1 = Math.min(H - 1, p.y1 + (oriz ? 0 : oltre));
      let m = 0,
        a = 0;
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          a++;
          if (muro[y * W + x]) m++;
        }
      const fuori = vetroNelMuro(p) ? Infinity : 0;
      if (m < a * 0.2 || fuori > m * 0.3 || !appoggiato(p)) for (const c of p.celle) pieno[c] = 0;
    }
  }
  /* le corse delle righe, in orizzontale e in verticale (con un buco di una
   * cella: una riga fotografata non e' mai perfetta) */
  const corsa = (lungo) => {
    const out = new Int32Array(N);
    const n = lungo ? H : W,
      m = lungo ? W : H,
      at = lungo ? (a, b) => a * W + b : (a, b) => b * W + a;
    for (let a = 0; a < n; a++) {
      let b = 0;
      while (b < m) {
        const vicino = (q) =>
          riga[at(a, q)] || (a > 0 && riga[at(a - 1, q)]) || (a < n - 1 && riga[at(a + 1, q)]);
        if (!riga[at(a, b)]) {
          b++;
          continue;
        }
        let e = b,
          buco = 0;
        while (e < m && (vicino(e) || (buco < 2 && e + 1 < m && vicino(e + 1)))) {
          buco = vicino(e) ? 0 : buco + 1;
          e++;
        }
        for (let q = b; q < e; q++) if (riga[at(a, q)]) out[at(a, q)] = e - b;
        b = e;
      }
    }
    return out;
  };
  const corsaO = corsa(true),
    corsaV = corsa(false);
  /* 2. i tramezzi a doppia riga */
  const tramezzo = new Uint8Array(N);
  const lungaT = Math.round(0.9 / PASSO),
    dMin = 2,
    dMax = Math.round(0.4 / PASSO);
  const cercaDoppie = (oriz) => {
    const c = oriz ? corsaO : corsaV,
      passo = oriz ? W : 1;
    for (let i = 0; i < N; i++) {
      if (c[i] < lungaT) continue;
      /* una riga spessa (9 cm e oltre): le due righe del tramezzo cosi'
       * vicine che nella griglia si toccano */
      if (i + 2 * passo < N && c[i + passo] >= lungaT && c[i + 2 * passo] >= lungaT) {
        for (let q = 0; q <= 2; q++) tramezzo[i + q * passo] = 1;
        continue;
      }
      for (let d = dMin; d <= dMax; d++) {
        const j = i + d * passo;
        if (j >= N) break;
        if (c[j] < lungaT) continue;
        /* in mezzo nessun muro e nessuna altra riga lunga: due righe, non un
         * pettine (le piastrelle, i gradini) */
        let pulito = true;
        for (let q = 1; q < d && pulito; q++) if (muro[i + q * passo]) pulito = false;
        if (!pulito) break;
        for (let q = 0; q <= d; q++) tramezzo[i + q * passo] = 1;
        break;
      }
    }
  };
  cercaDoppie(true);
  cercaDoppie(false);
  {
    const { pezzi } = pezziDi(tramezzo, W, H);
    for (const p of pezzi) {
      const lungo = Math.max(p.x1 - p.x0, p.y1 - p.y0) + 1,
        spesso = Math.min(p.x1 - p.x0, p.y1 - p.y0) + 1;
      /* un tramezzo e' lungo e sottile e si appoggia a un muro */
      if (lungo < lungaT || spesso > dMax + 2 || !appoggiato(p) || vetroNelMuro(p))
        for (const c of p.celle) tramezzo[c] = 0;
    }
  }
  /* 4. le scale: righe parallele lunghe almeno 60 cm a passo di 20-40 cm */
  const scale = [];
  const gradino = Math.round(0.6 / PASSO),
    pMin = Math.round(0.18 / PASSO),
    pMax = Math.round(0.4 / PASSO);
  const segnaScale = new Uint8Array(N);
  for (const oriz of [true, false]) {
    const c = oriz ? corsaO : corsaV;
    /* le righe lunghe, una per fila, coi loro capi */
    const n = oriz ? H : W,
      m = oriz ? W : H,
      at = oriz ? (a, b) => a * W + b : (a, b) => b * W + a;
    const file = [];
    for (let a = 0; a < n; a++) {
      const tratti = [];
      let b = 0;
      while (b < m) {
        if (c[at(a, b)] >= gradino && c[at(a, b)] < Math.round(2.2 / PASSO)) {
          let e = b;
          while (e < m && (c[at(a, e)] >= gradino || (e + 1 < m && c[at(a, e + 1)] >= gradino)))
            e++;
          tratti.push([b, e]);
          b = e;
        } else b++;
      }
      file.push(tratti);
    }
    /* una fila per riga: le file vicine sono la stessa riga, spessa */
    const centri = [];
    for (let a = 0; a < n; a++)
      for (const [b, e] of file[a]) {
        const ultimo = centri.find(
          (q) => a - q.a1 <= 1 && Math.min(e, q.e) - Math.max(b, q.b) > (e - b) * 0.6,
        );
        if (ultimo)
          ((ultimo.a1 = a), (ultimo.b = Math.min(ultimo.b, b)), (ultimo.e = Math.max(ultimo.e, e)));
        else centri.push({ a0: a, a1: a, b, e });
      }
    centri.sort((p, q) => p.a0 - q.a0);
    /* catene di righe a passo regolare che si sovrappongono */
    const usata = new Set();
    for (let k = 0; k < centri.length; k++) {
      if (usata.has(k)) continue;
      const catena = [k];
      let ultimo = centri[k];
      for (let j = k + 1; j < centri.length; j++) {
        const q = centri[j],
          dist = (q.a0 + q.a1) / 2 - (ultimo.a0 + ultimo.a1) / 2;
        if (dist < pMin) continue;
        if (dist > pMax) break;
        const sovrapposti = Math.min(q.e, ultimo.e) - Math.max(q.b, ultimo.b);
        if (sovrapposti < Math.min(q.e - q.b, ultimo.e - ultimo.b) * 0.7) continue;
        catena.push(j);
        ultimo = q;
      }
      if (catena.length < 5) continue;
      for (const j of catena) usata.add(j);
      const pezzi = catena.map((j) => centri[j]);
      const passi = pezzi
        .slice(1)
        .map((q, i) => (q.a0 + q.a1) / 2 - (pezzi[i].a0 + pezzi[i].a1) / 2);
      const medio = passi.reduce((a, b) => a + b, 0) / passi.length;
      /* regolare: i gradini sono tutti uguali (le piastrelle pure, ma
       * vanno in tutte e due le direzioni: si guarda sotto) */
      if (passi.some((p) => Math.abs(p - medio) > Math.max(2, medio * 0.3))) continue;
      const b = Math.min(...pezzi.map((q) => q.b)),
        e = Math.max(...pezzi.map((q) => q.e)),
        a0 = pezzi[0].a0,
        a1 = pezzi[pezzi.length - 1].a1;
      /* una scala sta fra due muri: i gradini vanno da un muro all'altro.
       * Le righe di una scritta, di un riquadro, dell'albero no. */
      const toccaMuro = (q, capo) => {
        for (let a = q.a0; a <= q.a1; a++)
          for (let d = 0; d <= Math.round(0.25 / PASSO); d++) {
            const bb = capo ? q.e + d : q.b - d;
            if (bb >= 0 && bb < m && muro[at(a, bb)]) return true;
          }
        return false;
      };
      const fraMuri = pezzi.filter((q) => toccaMuro(q, false) && toccaMuro(q, true)).length;
      if (fraMuri < pezzi.length * 0.7) continue;
      scale.push(
        oriz
          ? { x0: b, x1: e, y0: a0, y1: a1, oriz: false, gradini: pezzi.length, passo: medio }
          : { x0: a0, x1: a1, y0: b, y1: e, oriz: true, gradini: pezzi.length, passo: medio },
      );
    }
  }
  /* Le piastrelle sono un reticolo: righe a passo regolare in tutte e due
   * le direzioni nello stesso posto. Una scala ha i gradini in una sola. */
  const tutte = scale.filter(
    (s) =>
      !scale.some(
        (t) =>
          t !== s &&
          t.oriz !== s.oriz &&
          Math.min(s.x1, t.x1) - Math.max(s.x0, t.x0) > 0 &&
          Math.min(s.y1, t.y1) - Math.max(s.y0, t.y0) > 0,
      ),
  );
  /* la stessa scala trovata piu' volte: si tiene la piu' grande */
  const vere = [];
  for (const s of [...tutte].sort(
    (a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0),
  )) {
    const sopra = vere.some(
      (t) =>
        Math.min(s.x1, t.x1) - Math.max(s.x0, t.x0) > 0 &&
        Math.min(s.y1, t.y1) - Math.max(s.y0, t.y0) > 0,
    );
    if (!sopra) vere.push(s);
  }
  for (const s of vere)
    for (let y = s.y0; y <= s.y1; y++) for (let x = s.x0; x <= s.x1; x++) segnaScale[y * W + x] = 1;
  for (let i = 0; i < N; i++) if ((tramezzo[i] || pieno[i]) && !segnaScale[i]) muro[i] = 1;
  /* via i pezzetti sotto gli 80 cm (il lavello, il frigo, un simbolo
   * disegnati scuri) e lo scuro che tocca il bordo della foto (il tavolo
   * sotto il foglio) */
  {
    const { pezzi } = pezziDi(muro, W, H),
      minimo = 0.8 / PASSO;
    for (const p of pezzi)
      if (
        Math.max(p.x1 - p.x0, p.y1 - p.y0) + 1 < minimo ||
        p.x0 === 0 ||
        p.y0 === 0 ||
        p.x1 === W - 1 ||
        p.y1 === H - 1
      )
        for (const c of p.celle) muro[c] = 0;
    /* La casa e' la rete di muri piu' grande, saltando i vani delle
     * finestre (fino a 1,6 m): i pezzi lontani da lei (l'albero, il
     * cartiglio, le quote sotto il disegno) se ne vanno. */
    const unita = pezziDi(allarga(muro, W, H, Math.round(0.8 / PASSO)), W, H);
    if (unita.pezzi.length > 1) {
      let k = 0;
      unita.pezzi.forEach((p, i) => {
        if (p.celle.length > unita.pezzi[k].celle.length) k = i;
      });
      for (let i = 0; i < N; i++) if (muro[i] && unita.id[i] !== k) muro[i] = 0;
    }
  }
  /* 3. i varchi nella fila di un muro */
  const vetro = new Uint8Array(N),
    soglie = new Uint8Array(N);
  const spessoreMax = Math.round(0.7 / PASSO),
    varco = Math.round(1.3 / PASSO),
    varcoLargo = Math.round(4 / PASSO),
    vetroMax = Math.round(3 / PASSO),
    varcoUnLato = Math.round(1.0 / PASSO),
    tratto = Math.round(0.2 / PASSO);
  const corre = (i, passo, fino) => {
    let n = 0;
    for (let j = i; n < fino && j >= 0 && j < N && muro[j]; j += passo) n++;
    return n;
  };
  /* il muro in a corre lungo «passo» (indietro) ed e' sottile di traverso */
  const nellaFila = (a, passo, largo) => {
    if (corre(a, -passo, tratto) < tratto) return false;
    const spesso = corre(a, largo, spessoreMax + 1) + corre(a, -largo, spessoreMax + 1) - 1;
    return spesso <= spessoreMax;
  };
  const varchi = (oriz) => {
    const passo = oriz ? 1 : W,
      largo = oriz ? W : 1,
      n = oriz ? H : W,
      m = oriz ? W : H,
      at = oriz ? (a, b) => a * W + b : (a, b) => b * W + a;
    for (let a = 1; a < n - 1; a++)
      for (let b = 1; b < m - 1; b++) {
        const i = at(a, b);
        if (!muro[i - passo] || muro[i]) continue;
        let e = b;
        while (e < m && !muro[at(a, e)] && e - b <= varcoLargo) e++;
        if (e >= m || e - b > varcoLargo) continue;
        const k = e - b,
          j = at(a, e);
        const fa = nellaFila(i - passo, passo, largo),
          fb = nellaFila(j, -passo, largo);
        if (!fa && !fb) continue;
        /* il vetro: righe nel varco che corrono lungo la fila (non quelle di
         * traverso, come le piastrelle di un'entrata) */
        const lungoLa = oriz ? corsaO : corsaV;
        let righe = 0;
        for (let q = b; q < e; q++) {
          const c = at(a, q);
          if (
            [c, c - largo, c + largo, c - 2 * largo, c + 2 * largo].some(
              (z) => riga[z] && lungoLa[z] >= k * 0.5,
            )
          )
            righe++;
        }
        if (fa && fb && k <= vetroMax && righe >= k * 0.5)
          for (let q = b; q < e; q++) vetro[at(a, q)] = 1;
        else if (k <= (fa && fb ? varco : varcoUnLato))
          for (let q = b; q < e; q++) soglie[at(a, q)] = 1;
      }
  };
  varchi(true);
  varchi(false);
  /* ai piedi e in cima a una scala non c'e' ne' porta ne' finestra */
  {
    const vicino = allarga(segnaScale, W, H, Math.round(0.3 / PASSO));
    for (let i = 0; i < N; i++) if (vicino[i]) vetro[i] = soglie[i] = 0;
  }
  /* Un varco e' tutto vetro o tutto soglia: le righe del vetro stanno in
   * poche file dello spessore del muro, le altre file erano «vuote». */
  {
    const unione = new Uint8Array(N);
    for (let i = 0; i < N; i++) unione[i] = vetro[i] || soglie[i] ? 1 : 0;
    for (const p of pezziDi(unione, W, H).pezzi) {
      const n = p.celle.filter((c) => vetro[c]).length,
        tutto = n >= p.celle.length * 0.2;
      for (const c of p.celle) {
        vetro[c] = tutto ? 1 : 0;
        soglie[c] = tutto ? 0 : 1;
      }
    }
  }
  const barriera = muro.slice();
  for (let i = 0; i < N; i++) if (vetro[i] || soglie[i]) barriera[i] = 1;
  return {
    W,
    H,
    muro,
    barriera,
    vetro,
    pieni: true,
    scale: vere.map((s) => ({
      x0: s.x0 * PASSO,
      x1: (s.x1 + 1) * PASSO,
      y0: s.y0 * PASSO,
      y1: (s.y1 + 1) * PASSO,
      oriz: s.oriz,
      gradini: s.gradini,
    })),
  };
}

/** Dai muri alla casa, nella stessa forma che esce dal DWG (importa.js). */
export function riconosciDaFoto(
  { W, H, muro, barriera, vetro, pieni = false, scale = [] },
  { fuori = new Set(), squadra = true } = {},
) {
  const N = W * H,
    passo = PASSO,
    ostacolo = barriera || muro;
  // distanza dal muro piu' vicino, in celle
  const dist = new Int32Array(N).fill(1e9),
    coda = new Int32Array(N);
  let t = 0,
    k = 0;
  for (let i = 0; i < N; i++)
    if (ostacolo[i]) {
      dist[i] = 0;
      coda[t++] = i;
    }
  for (let x = 0; x < W; x++)
    for (const y of [0, H - 1]) {
      const i = y * W + x;
      if (dist[i]) {
        dist[i] = 1;
        coda[t++] = i;
      }
    }
  while (k < t) {
    const c = coda[k++],
      x = c % W;
    for (const j of [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c - W, c + W])
      if (j >= 0 && j < N && dist[j] > dist[c] + 1) {
        dist[j] = dist[c] + 1;
        coda[t++] = j;
      }
  }
  const lab = new Int32Array(N);
  let n = 1;
  const cuori = [{ id: 1, celle: 0, bordo: true }];
  /* Una pianta a muri pieni non disegna le soglie: il fuori entrerebbe dal
   * portone e si prenderebbe tutta la casa. Il fuori passa solo dove e'
   * largo (piu' di 65 cm dai muri): una porta, un'entrata fino a 1,3 m lo
   * fermano. */
  const largoFuori = pieni ? Math.round(0.65 / passo) : 0;
  let lontano = null;
  if (largoFuori) {
    lontano = new Int32Array(N).fill(1e9);
    let a = 0,
      b = 0;
    for (let i = 0; i < N; i++)
      if (ostacolo[i]) {
        lontano[i] = 0;
        coda[b++] = i;
      }
    while (a < b) {
      const c = coda[a++],
        x = c % W;
      for (const j of [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c - W, c + W])
        if (j >= 0 && j < N && lontano[j] > lontano[c] + 1) {
          lontano[j] = lontano[c] + 1;
          coda[b++] = j;
        }
    }
  }
  const passaFuori = (i) => !ostacolo[i] && (!lontano || lontano[i] >= largoFuori);
  {
    const pila = [];
    for (let x = 0; x < W; x++)
      for (const y of [0, H - 1]) {
        const i = y * W + x;
        if (passaFuori(i) && !lab[i]) {
          lab[i] = 1;
          pila.push(i);
        }
      }
    for (let y = 0; y < H; y++)
      for (const x of [0, W - 1]) {
        const i = y * W + x;
        if (passaFuori(i) && !lab[i]) {
          lab[i] = 1;
          pila.push(i);
        }
      }
    while (pila.length) {
      const c = pila.pop(),
        x = c % W;
      for (const j of [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c - W, c + W])
        if (j >= 0 && j < N && !lab[j] && passaFuori(j)) {
          lab[j] = 1;
          pila.push(j);
          cuori[0].celle++;
        }
    }
  }
  // i cuori delle stanze: piu' di 50 cm dai muri e dalle righe (le porte fino a 1 m non li uniscono)
  const soglia = Math.round(0.5 / passo);

  for (let i = 0; i < N; i++) {
    if (lab[i] || dist[i] < soglia) continue;
    n++;
    const pezzo = [i];
    lab[i] = n;
    let bordo = false;
    for (let q = 0; q < pezzo.length; q++) {
      const c = pezzo[q],
        x = c % W,
        y = (c / W) | 0;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) bordo = true;
      for (const j of [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c - W, c + W])
        if (j >= 0 && j < N && !lab[j] && dist[j] >= soglia) {
          lab[j] = n;
          pezzo.push(j);
        }
    }
    cuori.push({ id: n, celle: pezzo.length, bordo });
  }
  // il fuori: tutti i cuori che toccano il bordo, piu' quelli che l'utente dice fuori
  const esterno = new Set(cuori.filter((c) => c.bordo || fuori.has(c.id)).map((c) => c.id));
  // ognuno si allarga finche' incontra gli altri (prima i piu' lontani dal muro)
  for (const fase of [0, 1]) {
    t = 0;
    k = 0;
    for (let i = 0; i < N; i++) if (lab[i]) coda[t++] = i;
    while (k < t) {
      const c = coda[k++],
        x = c % W;
      for (const j of [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c - W, c + W])
        if (j >= 0 && j < N && !lab[j] && !muro[j] && (fase === 1 || !ostacolo[j])) {
          lab[j] = lab[c];
          coda[t++] = j;
        }
    }
  }
  /* Il foglio attorno alla casa: in una foto la cornice del foglio non tocca
   * il bordo dell'immagine (c'e' il tavolo, lo schermo) e lo spazio dentro
   * la cornice sembrava una stanza da duemila metri quadri. Una zona che
   * racchiude altre stanze non e' una stanza: e' il fuori. */
  {
    const bx = new Map();
    for (let i = 0; i < N; i++) {
      const l = lab[i];
      if (!l || esterno.has(l)) continue;
      const x = i % W,
        y = (i / W) | 0;
      const b = bx.get(l);
      if (!b) bx.set(l, [x, x, y, y]);
      else {
        if (x < b[0]) b[0] = x;
        if (x > b[1]) b[1] = x;
        if (y < b[2]) b[2] = y;
        if (y > b[3]) b[3] = y;
      }
    }
    const voci = [...bx.entries()];
    for (const [l, b] of voci) {
      let dentro = 0;
      for (const [m2, c] of voci)
        if (m2 !== l && c[0] > b[0] && c[1] < b[1] && c[2] > b[2] && c[3] < b[3]) dentro++;
      if (dentro >= 2) esterno.add(l);
    }
  }
  // unione: due stanze che si toccano su un fronte largo sono la stessa (open space)
  const padre = new Map();
  const radice = (a) => {
    while (padre.has(a)) a = padre.get(a);
    return a;
  };
  const fronti = new Map();
  const aggiungi = (a, b, i) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (!fronti.has(key)) fronti.set(key, []);
    fronti.get(key).push(i);
  };
  for (let y = 0; y < H - 1; y++)
    for (let x = 0; x < W - 1; x++) {
      const i = y * W + x;
      if (muro[i] || !lab[i]) continue;
      for (const j of [i + 1, i + W])
        if (!muro[j] && lab[j] && lab[j] !== lab[i]) aggiungi(lab[i], lab[j], i);
    }
  const gruppi = [];
  for (const [key, celle] of fronti) {
    const [a, b] = key.split("|").map(Number);
    // pezzi connessi del fronte
    const set = new Set(celle),
      fatto = new Set();
    for (const c0 of celle) {
      if (fatto.has(c0)) continue;
      const pezzo = [c0];
      fatto.add(c0);
      for (let q = 0; q < pezzo.length; q++) {
        const c = pezzo[q];
        for (const d of [-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1])
          if (set.has(c + d) && !fatto.has(c + d)) {
            fatto.add(c + d);
            pezzo.push(c + d);
          }
      }
      gruppi.push({ a, b, celle: pezzo });
    }
  }
  for (const gr of gruppi) {
    let x0 = W,
      x1 = 0,
      y0 = H,
      y1 = 0;
    for (const c of gr.celle) {
      const x = c % W,
        y = (c / W) | 0;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    Object.assign(gr, {
      x0,
      x1,
      y0,
      y1,
      orizz: x1 - x0 >= y1 - y0,
      largo: (Math.max(x1 - x0, y1 - y0) + 1) * passo,
    });
    const ea = esterno.has(gr.a),
      eb = esterno.has(gr.b);
    if (gr.largo > 2.6 && ea === eb) {
      const ra = radice(gr.a),
        rb = radice(gr.b);
      if (ra !== rb) padre.set(rb, ra);
      gr.unito = true;
    }
  }
  // la casa: muri -3, fuori -2, stanze 1..n
  const tipo = new Int16Array(N),
    idDi = new Map(),
    stanze = [];
  for (const c of cuori) {
    if (esterno.has(c.id)) continue;
    const r = radice(c.id);
    if (!idDi.has(r)) {
      idDi.set(r, stanze.length + 1);
      stanze.push({ id: stanze.length + 1, nome: `Stanza ${stanze.length + 1}`, cuori: [] });
    }
    stanze[idDi.get(r) - 1].cuori.push(c.id);
  }
  for (let i = 0; i < N; i++)
    tipo[i] = muro[i]
      ? -3
      : !lab[i]
        ? -3
        : esterno.has(lab[i])
          ? -2
          : idDi.get(radice(lab[i])) || -2;
  // stanze minuscole (sotto 1 m²): sono nicchie, vanno alla stanza accanto
  const conta = new Map();
  for (let i = 0; i < N; i++) if (tipo[i] > 0) conta.set(tipo[i], (conta.get(tipo[i]) || 0) + 1);
  for (const s of stanze) if ((conta.get(s.id) || 0) * passo * passo < 1.0) s.via = true;
  // porte e finestre
  const aperture = [];
  const tipoDi = (lbl) => (esterno.has(lbl) ? -2 : idDi.get(radice(lbl)) || -2);
  for (const gr of gruppi) {
    if (gr.unito || gr.largo < 0.5 || gr.largo > 4) continue;
    const ta = tipoDi(gr.a),
      tb = tipoDi(gr.b);
    if (ta === tb) continue;
    const verso0 = ta === -2 || tb === -2;
    // il varco: si cammina di traverso finche' ai due capi c'e' ancora muro
    const segna = [],
      { x0, x1, y0, y1, orizz } = gr;
    const muroIn = (x, y) => x >= 0 && y >= 0 && x < W && y < H && muro[y * W + x];
    /* il muro ai due capi, entro tre celle: lo spigolo di una stanza
     * fotografata si infila un poco nel vano */
    const muroVicino = (x, y, dx, dy) =>
      muroIn(x + dx, y + dy) || muroIn(x + 2 * dx, y + 2 * dy) || muroIn(x + 3 * dx, y + 3 * dy);
    const fianchi = (p) =>
      orizz
        ? muroVicino(x0, p, -1, 0) && muroVicino(x1, p, 1, 0)
        : muroVicino(p, y0, 0, -1) && muroVicino(p, y1, 0, 1);
    const centro = orizz ? Math.round((y0 + y1) / 2) : Math.round((x0 + x1) / 2);
    if (!fianchi(centro)) continue; // non e' un varco in un muro
    let p0 = centro,
      p1 = centro;
    while (fianchi(p0 - 1) && centro - p0 < 20) p0--;
    while (fianchi(p1 + 1) && p1 - centro < 20) p1++;
    /* Verso il fuori e' una finestra se nel varco c'e' il vetro; un varco
     * vuoto e' una porta (il portone). Senza la mappa del vetro (una
     * griglia di prima) vale la regola di prima: verso il fuori, finestra. */
    let conVetro = !vetro;
    for (let p = p0; p <= p1 && !conVetro; p++)
      for (let q = orizz ? x0 : y0; q <= (orizz ? x1 : y1); q++)
        if (vetro[orizz ? p * W + q : q * W + p]) {
          conVetro = true;
          break;
        }
    const finestra = verso0 && conVetro;
    for (let p = p0; p <= p1; p++)
      for (let q = orizz ? x0 : y0; q <= (orizz ? x1 : y1); q++) {
        const i = orizz ? p * W + q : q * W + p;
        if (!muro[i]) segna.push(i);
      }
    /* Una finestra larghissima (1,8 m e oltre) e' una portafinestra: fino a
     * terra, nel 3D. Le finestre di tutti i giorni sono larghe 1,2-1,4 m e
     * restano finestre; la porta verso il balcone la fa gia' crea-casa (una
     * porta verso fuori). */
    const portafinestra = finestra && gr.largo >= 1.8;
    for (const i of segna) tipo[i] = finestra && !portafinestra ? -4 : -5;
    const cx = ((orizz ? (x0 + x1) / 2 : (p0 + p1) / 2) + 0.5) * passo,
      cy = ((orizz ? (p0 + p1) / 2 : (y0 + y1) / 2) + 0.5) * passo;
    // da che parte e' il fuori
    let verso = 0;
    if (finestra) {
      const sopra = orizz
        ? tipo[Math.max(0, p0 - 3) * W + Math.round((x0 + x1) / 2)]
        : tipo[Math.round((y0 + y1) / 2) * W + Math.max(0, p0 - 3)];
      verso = sopra === -2 ? -1 : 1;
    }
    const stanza = ta > 0 ? ta : tb;
    aperture.push({
      tipo: finestra ? "finestra" : "porta",
      cx,
      cy,
      largo: gr.largo,
      orizz,
      verso,
      portafinestra,
      stanza,
    });
  }
  // le nicchie si sciolgono nella stanza accanto
  for (const s of stanze.filter((x) => x.via)) {
    const vicini = new Map();
    for (let i = 0; i < N; i++)
      if (tipo[i] === s.id)
        for (const j of [i - 1, i + 1, i - W, i + W])
          if (tipo[j] > 0 && tipo[j] !== s.id) vicini.set(tipo[j], (vicini.get(tipo[j]) || 0) + 1);
    const dove = [...vicini].sort((a, b) => b[1] - a[1])[0]?.[0] || -3;
    for (let i = 0; i < N; i++) if (tipo[i] === s.id) tipo[i] = dove;
  }
  const vive = stanze.filter((s) => !s.via);
  if (squadra) squadraLaCasa(tipo, W, H, vive);
  // centro, area, riquadro
  for (const s of vive) {
    let sx = 0,
      sy = 0,
      c = 0,
      bx0 = W,
      bx1 = 0,
      by0 = H,
      by1 = 0;
    for (let i = 0; i < N; i++)
      if (tipo[i] === s.id) {
        const xx = i % W,
          yy = (i / W) | 0;
        sx += xx;
        sy += yy;
        c++;
        bx0 = Math.min(bx0, xx);
        bx1 = Math.max(bx1, xx);
        by0 = Math.min(by0, yy);
        by1 = Math.max(by1, yy);
      }
    s.riquadro = { x0: bx0 * passo, x1: bx1 * passo, y0: by0 * passo, y1: by1 * passo };
    s.celle = c;
    s.area = c * passo * passo;
    /* squadrata, una nicchia puo' restare senza celle: non e' una stanza */
    if (!c) continue;
    let cx = Math.round(sx / c),
      cy = Math.round(sy / c);
    if (tipo[cy * W + cx] !== s.id) {
      let m = 1e9;
      for (let i = 0; i < N; i++)
        if (tipo[i] === s.id) {
          const d = ((i % W) - cx) ** 2 + (((i / W) | 0) - cy) ** 2;
          if (d < m) {
            m = d;
            s.sx = (i % W) * passo;
            s.sy = ((i / W) | 0) * passo;
          }
        }
    } else {
      s.sx = cx * passo;
      s.sy = cy * passo;
    }
    s.cx = s.sx;
    s.cy = s.sy;
  }
  // i muri in rettangoli, per sapere dove sta la casa
  const rettangoli = [],
    fatto = new Uint8Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x,
        tt = tipo[i];
      if ((tt !== -3 && tt !== -4) || fatto[i]) continue;
      let w = 1;
      while (x + w < W && tipo[i + w] === tt && !fatto[i + w]) w++;
      let h = 1;
      fuori2: while (y + h < H) {
        for (let q = 0; q < w; q++) {
          const j = (y + h) * W + x + q;
          if (tipo[j] !== tt || fatto[j]) break fuori2;
        }
        h++;
      }
      for (let yy = 0; yy < h; yy++) for (let q = 0; q < w; q++) fatto[(y + yy) * W + x + q] = 1;
      rettangoli.push({ x: x * passo, y: y * passo, w: w * passo, d: h * passo });
    }
  return {
    W,
    H,
    passo,
    tipo,
    stanze: vive.filter((s) => s.celle > 0),
    vuoti: [],
    aperture: aperture.filter(
      (a) => vive.some((s) => s.id === a.stanza && s.celle > 0) || !a.stanza,
    ),
    rettangoli,
    scale: scaleDellaCasa(scale, tipo, W, H, passo, muro),
    larghezza: W * passo,
    profondita: H * passo,
    cuori: cuori.map((c) => ({
      ...c,
      esterno: esterno.has(c.id),
      stanza: idDi.get(radice(c.id)) || 0,
    })),
    lab,
  };
}

/* Le scale trovate nella pianta, al loro posto nella casa: il centro, la
 * stanza e il verso. Sale verso il capo chiuso da un muro (si parte dal lato
 * aperto); senza muro a nessuno dei due capi, verso l'alto del disegno. */
function scaleDellaCasa(scale, tipo, W, H, passo, muro) {
  const fuori = [];
  for (const s of scale || []) {
    const x0 = Math.round(s.x0 / passo),
      x1 = Math.round(s.x1 / passo) - 1,
      y0 = Math.round(s.y0 / passo),
      y1 = Math.round(s.y1 / passo) - 1;
    const cx = Math.round((x0 + x1) / 2),
      cy = Math.round((y0 + y1) / 2);
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
    /* la stanza: quella che ha piu' celle sotto la scala */
    const conta = new Map();
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const t = tipo[y * W + x];
        if (t > 0) conta.set(t, (conta.get(t) || 0) + 1);
      }
    const stanza = [...conta].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!stanza) continue;
    /* quanto muro c'e' oltre i due capi, nella fascia della scala */
    const muroOltre = (verso) => {
      let n = 0;
      for (let d = 1; d <= 6; d++)
        if (s.oriz)
          for (let y = y0; y <= y1; y++) {
            const x = verso < 0 ? x0 - d : x1 + d;
            if (x >= 0 && x < W && muro[y * W + x]) n++;
          }
        else
          for (let x = x0; x <= x1; x++) {
            const y = verso < 0 ? y0 - d : y1 + d;
            if (y >= 0 && y < H && muro[y * W + x]) n++;
          }
      return n;
    };
    const prima = muroOltre(-1),
      dopo = muroOltre(1);
    /* rot 0: sale verso y piu' piccole (l'alto del disegno) */
    const rot = s.oriz ? (dopo > prima ? -Math.PI / 2 : Math.PI / 2) : dopo > prima ? Math.PI : 0;
    fuori.push({
      x: ((x0 + x1 + 1) / 2) * passo,
      y: ((y0 + y1 + 1) / 2) * passo,
      lungo: (s.oriz ? x1 - x0 + 1 : y1 - y0 + 1) * passo,
      largo: (s.oriz ? y1 - y0 + 1 : x1 - x0 + 1) * passo,
      rot,
      gradini: s.gradini,
      stanza,
    });
  }
  return fuori;
}

/* ── la casa in squadra ─────────────────────────────────────────────────
 *
 * «Perfeziona la mappa dal caricamento PDF e foto, non puo' uscire cosi':
 * metti le cose piu' definite.» Dalla foto le stanze escono coi bordi a
 * dente di sega e i muri a macchie. Una casa e' fatta di rettangoli: ogni
 * stanza diventa i pochi rettangoli piu' grandi che la riempiono, i bordi
 * vicini di stanze diverse si allineano sulla stessa riga (lo stesso muro),
 * e i muri restano solo attorno alle stanze, spessi al piu' 30 cm verso fuori:
 * le macchie lontane (quote, scritte, l'albero) se ne vanno. */

/* Il rettangolo piu' grande tutto dentro `m` (istogramma per righe). */
function rettangoloMassimo(m, W, H) {
  const alto = new Int32Array(W);
  let meglio = { area: 0, x0: 0, y0: 0, x1: -1, y1: -1 };
  const pila = new Int32Array(W + 1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) alto[x] = m[y * W + x] ? alto[x] + 1 : 0;
    let cima = 0;
    for (let x = 0; x <= W; x++) {
      const h = x < W ? alto[x] : 0;
      while (cima > 0 && alto[pila[cima - 1]] >= h) {
        const hh = alto[pila[--cima]];
        const sinistra = cima > 0 ? pila[cima - 1] + 1 : 0;
        const area = hh * (x - sinistra);
        if (area > meglio.area) meglio = { area, x0: sinistra, x1: x - 1, y0: y - hh + 1, y1: y };
      }
      pila[cima++] = x;
    }
  }
  return meglio;
}

/* I valori vicini (entro `tolleranza`) diventano uno: la loro media pesata. */
function allinea(valori, tolleranza) {
  const ordinati = [...valori].sort((a, b) => a.v - b.v);
  const mappa = new Map();
  let gruppo = [];
  const chiudi = () => {
    if (!gruppo.length) return;
    const peso = gruppo.reduce((t, g) => t + g.peso, 0);
    const media = Math.round(gruppo.reduce((t, g) => t + g.v * g.peso, 0) / peso);
    for (const g of gruppo) mappa.set(g.v, media);
    gruppo = [];
  };
  for (const o of ordinati) {
    if (gruppo.length && o.v - gruppo[gruppo.length - 1].v > tolleranza) chiudi();
    gruppo.push(o);
  }
  chiudi();
  return mappa;
}

export function squadraLaCasa(tipo, W, H, stanze) {
  const N = W * H;
  const minimo = Math.round(1.2 / (PASSO * PASSO)); // 1,2 m²
  const rett = [];
  for (const s of stanze) {
    const m = new Uint8Array(N);
    let tot = 0;
    for (let i = 0; i < N; i++)
      if (tipo[i] === s.id) {
        m[i] = 1;
        tot++;
      }
    if (!tot) continue;
    for (let k = 0; k < 8; k++) {
      const r = rettangoloMassimo(m, W, H);
      /* i pezzetti (sotto 1,2 m² o un ventesimo della stanza) sono denti, non stanza */
      if (!r.area || r.area < minimo || (k > 0 && r.area < tot * 0.05)) break;
      rett.push({ id: s.id, ...r });
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) m[y * W + x] = 0;
    }
  }
  if (!rett.length) return;
  /* Ogni rettangolo si allarga fino al muro vero (al massimo 60 cm per lato):
   * i sanitari e le scritte avevano mangiato i bordi della stanza. Una
   * striscia si prende se e' quasi tutta libera (niente muro, niente altra
   * stanza). */
  const max = Math.round(0.6 / PASSO);
  const libera = (i, id) =>
    tipo[i] === id || (tipo[i] !== -3 && tipo[i] !== -4 && tipo[i] <= 0 && tipo[i] !== -2);
  const striscia = (r, lato) => {
    let liberi = 0,
      tutti = 0;
    if (lato === "su" || lato === "giu") {
      const y = lato === "su" ? r.y0 - 1 : r.y1 + 1;
      if (y < 0 || y >= H) return false;
      for (let x = r.x0; x <= r.x1; x++, tutti++) if (libera(y * W + x, r.id)) liberi++;
    } else {
      const x = lato === "sx" ? r.x0 - 1 : r.x1 + 1;
      if (x < 0 || x >= W) return false;
      for (let y = r.y0; y <= r.y1; y++, tutti++) if (libera(y * W + x, r.id)) liberi++;
    }
    return liberi >= tutti * 0.8;
  };
  for (const r of rett)
    for (const lato of ["su", "giu", "sx", "dx"])
      for (let k = 0; k < max && striscia(r, lato); k++) {
        if (lato === "su") r.y0--;
        else if (lato === "giu") r.y1++;
        else if (lato === "sx") r.x0--;
        else r.x1++;
      }
  /* I bordi che quasi coincidono diventano la stessa riga (15 cm): i lati
   * sinistri coi sinistri, i destri coi destri — un tramezzo e' fra il destro
   * di una stanza e il sinistro dell'altra, e non deve sparire. */
  const tol = Math.max(2, Math.round(0.15 / PASSO));
  const alto = (r) => r.y1 - r.y0 + 1,
    largo = (r) => r.x1 - r.x0 + 1;
  const x0s = allinea(
    rett.map((r) => ({ v: r.x0, peso: alto(r) })),
    tol,
  );
  const x1s = allinea(
    rett.map((r) => ({ v: r.x1, peso: alto(r) })),
    tol,
  );
  const y0s = allinea(
    rett.map((r) => ({ v: r.y0, peso: largo(r) })),
    tol,
  );
  const y1s = allinea(
    rett.map((r) => ({ v: r.y1, peso: largo(r) })),
    tol,
  );
  const nuovo = new Int16Array(N);
  for (let i = 0; i < N; i++) nuovo[i] = tipo[i] > 0 ? -3 : tipo[i];
  const dipinto = new Uint8Array(N);
  for (const r of rett) {
    const x0 = x0s.get(r.x0),
      x1 = x1s.get(r.x1),
      y0 = y0s.get(r.y0),
      y1 = y1s.get(r.y1);
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
        const i = y * W + x;
        if (dipinto[i]) continue;
        nuovo[i] = r.id;
        dipinto[i] = 1;
      }
  }
  /* i muri: solo attorno alle stanze, fino a 30 cm (distanza a quadretti,
   * cosi' gli spigoli restano spigoli) */
  const fino = Math.max(3, Math.round(0.3 / PASSO));
  const dist = new Int16Array(N).fill(32767);
  const coda = new Int32Array(N);
  let testa = 0,
    fondo = 0;
  for (let i = 0; i < N; i++)
    if (dipinto[i]) {
      dist[i] = 0;
      coda[fondo++] = i;
    }
  while (testa < fondo) {
    const i = coda[testa++],
      d = dist[i];
    if (d >= fino) continue;
    const x = i % W,
      y = (i / W) | 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx,
          yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx;
        if (dist[j] > d + 1) {
          dist[j] = d + 1;
          coda[fondo++] = j;
        }
      }
  }
  /* Fra due stanze vicine (fino a due metri) e' tutto muro: la casa
   * e' una, non scatole staccate. Si chiude l'insieme delle stanze di un metro
   * e quello che resta dentro e non e' stanza e' muro. */
  const rc = Math.round(1 / PASSO);
  const casa = stringi(allarga(dipinto, W, H, rc), W, H, rc);
  for (let i = 0; i < N; i++) {
    if (dipinto[i]) continue;
    const v = nuovo[i];
    if (casa[i]) {
      if (v !== -4 && v !== -5) nuovo[i] = -3;
    } else if (v === -3 || v === -4 || v === -5) nuovo[i] = dist[i] <= fino ? v : -2;
  }
  tipo.set(nuovo);
}

/**
 * La scala scritta sul foglio: «Scala 1:200», «SCALA 1 : 100», «scala 1/500».
 * Torna il denominatore (200), o 0 se non c'e'. Serve al PDF del catasto:
 * col foglio di misura nota e la scala scritta, la casa e' gia' in metri.
 */
export function scalaScritta(testo) {
  const t = String(testo || "").replace(/\s+/g, " ");
  const m =
    /scala\s*(?:di\s*)?1\s*[:/]\s*(\d{2,4})\b/i.exec(t) ||
    /\b1\s*:\s*(50|100|200|250|500)\b/.exec(t);
  const n = m ? Number(m[1]) : 0;
  return n >= 20 && n <= 2000 ? n : 0;
}
