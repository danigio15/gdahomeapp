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
  // il tavolo sotto il foglio: lo scuro che tocca il bordo della foto
  const fondo = new Uint8Array(w * h),
    pila = [];
  for (let x = 0; x < w; x++)
    for (const y of [0, h - 1]) {
      const i = y * w + x;
      if (g[i] < 130 && !fondo[i]) {
        fondo[i] = 1;
        pila.push(i);
      }
    }
  for (let y = 0; y < h; y++)
    for (const x of [0, w - 1]) {
      const i = y * w + x;
      if (g[i] < 130 && !fondo[i]) {
        fondo[i] = 1;
        pila.push(i);
      }
    }
  while (pila.length) {
    const i = pila.pop(),
      x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w])
      if (j >= 0 && j < w * h && !fondo[j] && g[j] < 130) {
        fondo[j] = 1;
        pila.push(j);
      }
  }
  const R = 31,
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
export function grigliaDeiMuri(ink, w, h, mpp) {
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
  /* Lo scuro che tocca il bordo e' il tavolo sotto il foglio, non un muro. */
  const fondo = new Uint8Array(W * H),
    coda = [];
  const semina = (i) => {
    if (riga[i] && !fondo[i]) {
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
  {
    const tracce = pezziDi(riga, W, H);
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
    if (grande(p) && cuore(p) < 0.03 && qualcosaDentro(p)) continue;
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
    const rete = pezziDi(muro, W, H);
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
      for (let giro = 0; giro < 6; giro++) {
        const dentro = new Uint8Array(W * H);
        rete.pezzi.forEach((p, k) => {
          if (tenuti[k]) for (const c of p.celle) dentro[c] = 1;
        });
        const vicino = allarga(dentro, W, H, porta);
        let nuovi = 0;
        rete.pezzi.forEach((p, k) => {
          if (tenuti[k]) return;
          if (p.celle.some((c) => vicino[c])) {
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
      const tre = Math.round(3 / PASSO);
      rete.pezzi.forEach((p, k) => {
        const corto = Math.max(p.x1 - p.x0, p.y1 - p.y0) + 1 < tre;
        if (!tenuti[k] || (k !== maggiore && corto && !appoggio[k]))
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
  cercaVani(tO, tV, H, W, (y, x) => y * W + x);
  cercaVani(tV, tO, W, H, (x, y) => y * W + x);
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
   *    lati, cosi' due muri che si incontrano ad angolo non si chiudono. */
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
  for (let y = 0; y < H; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (!muro[i - 1] || muro[i]) continue;
      let e = x;
      while (e < W && !muro[y * W + e] && e - x <= varco) e++;
      if (e >= W || e - x > varco || !muro[y * W + e]) continue;
      if (x - tratto < 0 || e + tratto > W) continue;
      if (!dritto(i - 1, -1) || !dritto(y * W + e, 1)) continue;
      for (let q = x; q < e; q++) soglie[y * W + q] = 1;
    }
  for (let x = 0; x < W; x++)
    for (let y = 1; y < H - 1; y++) {
      const i = y * W + x;
      if (!muro[i - W] || muro[i]) continue;
      let e = y;
      while (e < H && !muro[e * W + x] && e - y <= varco) e++;
      if (e >= H || e - y > varco || !muro[e * W + x]) continue;
      if (y - tratto < 0 || e + tratto > H) continue;
      if (!dritto(i - W, -W) || !dritto(e * W + x, W)) continue;
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

/** Dai muri alla casa, nella stessa forma che esce dal DWG (importa.js). */
export function riconosciDaFoto({ W, H, muro, barriera, vetro }, { fuori = new Set() } = {}) {
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
  {
    const pila = [];
    for (let x = 0; x < W; x++)
      for (const y of [0, H - 1]) {
        const i = y * W + x;
        if (!ostacolo[i] && !lab[i]) {
          lab[i] = 1;
          pila.push(i);
        }
      }
    for (let y = 0; y < H; y++)
      for (const x of [0, W - 1]) {
        const i = y * W + x;
        if (!ostacolo[i] && !lab[i]) {
          lab[i] = 1;
          pila.push(i);
        }
      }
    while (pila.length) {
      const c = pila.pop(),
        x = c % W;
      for (const j of [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c - W, c + W])
        if (j >= 0 && j < N && !lab[j] && !ostacolo[j]) {
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
    if (gr.unito || gr.largo < 0.5 || gr.largo > 3.2) continue;
    const ta = tipoDi(gr.a),
      tb = tipoDi(gr.b);
    if (ta === tb) continue;
    const verso0 = ta === -2 || tb === -2;
    // il varco: si cammina di traverso finche' ai due capi c'e' ancora muro
    const segna = [],
      { x0, x1, y0, y1, orizz } = gr;
    const muroIn = (x, y) => x >= 0 && y >= 0 && x < W && y < H && muro[y * W + x];
    const fianchi = (p) =>
      orizz
        ? (muroIn(x0 - 1, p) || muroIn(x0 - 2, p)) && (muroIn(x1 + 1, p) || muroIn(x1 + 2, p))
        : (muroIn(p, y0 - 1) || muroIn(p, y0 - 2)) && (muroIn(p, y1 + 1) || muroIn(p, y1 + 2));
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
    stanze: vive,
    vuoti: [],
    aperture: aperture.filter((a) => vive.some((s) => s.id === a.stanza) || !a.stanza),
    rettangoli,
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
