/**
 * Gli archi delle porte di una planimetria disegnata (CAD, catasto): un quarto
 * di cerchio di raggio 60-130 cm col centro sul cardine, su un capo del varco
 * nel muro, spesso con l'anta (la riga dritta dal cardine, lunga quanto il
 * raggio, perpendicolare al muro).
 *
 * Lavora sulla griglia da 3 cm di pianta-da-foto.js: `riga` (l'inchiostro
 * sottile) e `muro` (i muri chiusi). L'arco e' inchiostro sottile, ma non basta
 * guardare fuori dai muri: la chiusura (allarga e stringi di 20 cm) riempie lo
 * spazio fra l'arco e il muro quando sono a meno di 40 cm, e l'arco finisce
 * dentro un blocco di muro finto. Qui si parte da tutto l'inchiostro, dentro e
 * fuori i muri, e si tolgono le corse dritte lunghe: le righe dei muri a
 * doppia riga, le finestre, i gradini della scala, le quote, il contorno dei
 * balconi, l'anta stessa. Resta quello che curva o e' corto: gli archi, le
 * scritte, i tratteggi. Fra questi l'arco si riconosce col cerchio: quasi
 * tutte le celle del pezzo stanno a distanza ≈ raggio da un centro che sta
 * su uno spigolo del riquadro, e coprono un quarto di giro. Poi la conferma
 * col muro: allo spigolo-cerniera c'e' muro vicino, il capo dell'arco tocca il
 * muro, e fra i due, lungo il muro, c'e' il varco.
 */

/* Il raggio di un arco di porta, e il riquadro di un pezzo che puo' esserlo
 * (un arco mangiato in parte dal muro e' piu' piccolo del suo raggio). */
const RAGGIO_MIN = 0.55,
  RAGGIO_MAX = 1.35,
  PEZZO_MIN = 0.36,
  PEZZO_MAX = 1.45;
/* Una corsa dritta d'inchiostro oltre i 60 cm e' una riga (muro, finestra,
 * quota, anta), non un arco: l'arco curva, e la sua corsa piu' lunga, vicino
 * alla tangente, resta sotto. */
const CORSA_RIGA = 0.6;
/* Quanto il muro puo' stare lontano dalla cerniera e dal capo dell'arco: la
 * griglia e la chiusura spostano i bordi di qualche cella. */
const VICINO_AL_MURO = 0.12;
/* Lo spessore massimo del muro in cui aprire la porta. */
const SPESSORE_MAX = 0.7;

/* Le operazioni sulla griglia, copiate da pianta-da-foto.js: «c'e' inchiostro
 * in un quadrato di lato 2r+1 attorno?» (allarga), con l'immagine integrale. */
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

/* I pezzi collegati di una griglia, coi loro riquadri; qui due celle si
 * toccano anche a una cella di distanza (vicinato 5x5), perche' un arco di
 * una cella di spessore, a 3 cm per cella, ha buchi. */
function pezziDi(g, W, H, tolleranza = 0) {
  const id = new Int32Array(W * H).fill(-1),
    pezzi = [],
    r = tolleranza + 1;
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
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W) continue;
          const j = yy * W + xx;
          if (g[j] && id[j] < 0) {
            id[j] = k;
            celle.push(j);
          }
        }
      }
    }
    pezzi.push({ celle, x0, x1, y0, y1 });
  }
  return { id, pezzi };
}

/* L'inchiostro sottile senza le corse dritte: una cella resta se la sua corsa
 * d'inchiostro, in orizzontale e in verticale, e' piu' corta di «lunga». */
function senzaCorse(riga, W, H, lunga) {
  const out = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = riga[i] ? 1 : 0;
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      if (!riga[y * W + x]) {
        x++;
        continue;
      }
      let e = x;
      while (e < W && riga[y * W + e]) e++;
      if (e - x >= lunga) for (let q = x; q < e; q++) out[y * W + q] = 0;
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
      if (e - y >= lunga) for (let q = y; q < e; q++) out[q * W + x] = 0;
      y = e;
    }
  }
  return out;
}

/* Il cerchio dei minimi quadrati (Kåsa) per delle celle: centro e raggio.
 * Null se le celle sono in fila (nessun cerchio). */
function cerchioDi(celle, W) {
  const n = celle.length;
  if (n < 5) return null;
  let mx = 0,
    my = 0;
  for (const c of celle) {
    mx += c % W;
    my += (c / W) | 0;
  }
  mx /= n;
  my /= n;
  /* coordinate centrate: la soluzione di  u·(x-mx) + v·(y-my) = (r²-...)  */
  let suu = 0,
    svv = 0,
    suv = 0,
    suuu = 0,
    svvv = 0,
    suvv = 0,
    svuu = 0;
  for (const c of celle) {
    const u = (c % W) - mx,
      v = ((c / W) | 0) - my;
    suu += u * u;
    svv += v * v;
    suv += u * v;
    suuu += u * u * u;
    svvv += v * v * v;
    suvv += u * v * v;
    svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-6) return null;
  const b1 = (suuu + suvv) / 2,
    b2 = (svvv + svuu) / 2;
  const uc = (b1 * svv - b2 * suv) / det,
    vc = (b2 * suu - b1 * suv) / det;
  const raggio = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n);
  return { cx: uc + mx, cy: vc + my, raggio };
}

/* Quante celle stanno a distanza ≈ raggio dal centro (entro «tolleranza»), e
 * quali. */
function sulCerchio(celle, W, cerchio, tolleranza) {
  const dentro = [];
  for (const c of celle) {
    const dx = (c % W) - cerchio.cx,
      dy = ((c / W) | 0) - cerchio.cy;
    if (Math.abs(Math.sqrt(dx * dx + dy * dy) - cerchio.raggio) <= tolleranza) dentro.push(c);
  }
  return dentro;
}

/* L'arco che le celle di un pezzo disegnano: cerchio adattato due volte (la
 * seconda senza le celle fuori: i resti dell'anta, la scritta accanto), poi
 * il quarto di giro. Torna null se non e' un arco di porta. */
function arcoDi(celle, W, rMin, rMax) {
  let cerchio = cerchioDi(celle, W);
  if (!cerchio) return null;
  const vicine = sulCerchio(celle, W, cerchio, 3);
  if (vicine.length < celle.length * 0.5) return null;
  cerchio = cerchioDi(vicine, W) || cerchio;
  if (cerchio.raggio < rMin || cerchio.raggio > rMax) return null;
  const sull = sulCerchio(celle, W, cerchio, 1.6);
  /* quasi tutte le celle sull'arco: una scritta o un tratteggio no */
  if (sull.length < celle.length * 0.72) return null;
  /* e l'arco deve essere pieno: almeno 2/3 delle celle che un giro di
   * quarto di cerchio di quel raggio avrebbe (lunghezza ≈ π r / 2) */
  if (sull.length < (Math.PI * cerchio.raggio) / 2 / 1.5) return null;
  /* Il quarto di giro: le celle stanno in un solo quadrante attorno al centro
   * (il segno di dx e dy) e coprono almeno 50° in 6 fasce da 15°. */
  const quadranti = [0, 0, 0, 0],
    angoli = [];
  for (const c of sull) {
    const dx = (c % W) - cerchio.cx,
      dy = ((c / W) | 0) - cerchio.cy;
    quadranti[(dx >= 0 ? 0 : 1) + (dy >= 0 ? 0 : 2)]++;
    angoli.push(Math.atan2(dy, dx));
  }
  let q = 0;
  for (let k = 1; k < 4; k++) if (quadranti[k] > quadranti[q]) q = k;
  if (quadranti[q] < sull.length * 0.85) return null;
  const sx = q & 1 ? -1 : 1,
    sy = q & 2 ? -1 : 1;
  const fasce = new Uint8Array(6);
  let aMin = 10,
    aMax = -10;
  for (const a of angoli) {
    /* l'angolo dentro il quadrante, 0..90° */
    let g = (Math.abs(a) * 180) / Math.PI;
    if (g > 90) g = 180 - g;
    if (g < aMin) aMin = g;
    if (g > aMax) aMax = g;
    fasce[Math.min(5, (g / 15) | 0)] = 1;
  }
  let piene = 0;
  for (const f of fasce) piene += f;
  if (aMax - aMin < 50 || piene < 4) return null;
  return { cerchio, sx, sy, celle: sull, angolo: [aMin, aMax] };
}

export function archiDellePorte(riga, muro, W, H, passo) {
  const celle = new Uint8Array(W * H),
    archi = [];
  if (!W || !H || !riga || riga.length < W * H) return { archi, celle };
  const rMin = RAGGIO_MIN / passo,
    rMax = RAGGIO_MAX / passo,
    pezzoMin = Math.round(PEZZO_MIN / passo),
    pezzoMax = Math.round(PEZZO_MAX / passo),
    corsaRiga = Math.round(CORSA_RIGA / passo),
    vicino = Math.max(2, Math.round(VICINO_AL_MURO / passo)),
    spessoreMax = Math.round(SPESSORE_MAX / passo);
  const muroC = muro && muro.length >= W * H ? muro : new Uint8Array(W * H);
  const M = integrale(muroC, W, H);
  const muroVicino = (x, y, r) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    return quanti(M, W, H, x, y, r).n > 0;
  };
  const muroIn = (x, y) => x >= 0 && y >= 0 && x < W && y < H && muroC[y * W + x] === 1;
  /* 1. l'inchiostro che curva o e' corto */
  const sottile = senzaCorse(riga, W, H, corsaRiga);
  /* 2. i pezzi, con la tolleranza di una cella */
  const { pezzi } = pezziDi(sottile, W, H, 1);
  for (const p of pezzi) {
    const lw = p.x1 - p.x0 + 1,
      lh = p.y1 - p.y0 + 1,
      lato = Math.max(lw, lh);
    if (lato < pezzoMin || lato > pezzoMax * 2) continue;
    /* Il pezzo intero, o le sue due meta' quando e' lungo il doppio di
     * quanto e' alto: una porta a due ante ha due archi affiancati che si
     * toccano in mezzo al varco. */
    let gruppi = [];
    const rapporto = lw / lh;
    if (rapporto >= 1.5 || rapporto <= 1 / 1.5) {
      const oriz = lw > lh,
        meta = oriz ? (p.x0 + p.x1) / 2 : (p.y0 + p.y1) / 2;
      const a = [],
        b = [];
      for (const c of p.celle) ((oriz ? c % W : (c / W) | 0) < meta ? a : b).push(c);
      gruppi.push({ celle: a, oriz, meta }, { celle: b, oriz, meta });
    }
    if (lato <= pezzoMax) {
      const intero = arcoDi(p.celle, W, rMin, rMax);
      if (intero) gruppi = [{ celle: p.celle, meta: null }];
    }
    for (const g of gruppi) {
      const arco = arcoDi(g.celle, W, rMin, rMax);
      if (!arco) continue;
      const { cerchio, sx, sy } = arco;
      const r = Math.round(cerchio.raggio),
        cx = Math.round(cerchio.cx),
        cy = Math.round(cerchio.cy);
      /* 3. il muro: alla cerniera (il centro) ci deve essere muro vicino */
      if (!muroVicino(cx, cy, vicino)) continue;
      /* Il capo dell'arco tocca il muro; nella porta a due ante tocca
       * l'altra anta, in mezzo al varco, dove il pezzo e' stato diviso. */
      const capoSulMuro = (x, y, lungoX) =>
        muroVicino(x, y, vicino) ||
        (g.meta !== null && g.oriz === lungoX && Math.abs((lungoX ? x : y) - g.meta) <= vicino);
      /* I due lati del riquadro che partono dalla cerniera: uno sta sul muro
       * (il capo dell'arco, a distanza raggio, tocca il muro e fra i due c'e'
       * il varco), l'altro e' l'anta (nel vuoto). Si prova tutti e due. */
      let meglio = null;
      for (const lungoX of [true, false]) {
        /* u: lungo il muro, verso il capo dell'arco; v: dentro la stanza */
        const ux = lungoX ? sx : 0,
          uy = lungoX ? 0 : sy,
          vx = lungoX ? 0 : sx,
          vy = lungoX ? sy : 0;
        if (!capoSulMuro(cx + ux * r, cy + uy * r, lungoX)) continue;
        /* Il varco: lungo il lato, dietro la faccia del muro (fuori dal
         * riquadro, dove la chiusura non ha riempito), niente muro. Si
         * guarda il tratto centrale, lontano dagli stipiti. */
        let liberi = 0,
          totale = 0;
        for (let t = vicino + 1; t <= r - vicino - 1; t++) {
          totale++;
          let libero = true;
          for (let k = 1; k <= vicino + 1 && libero; k++)
            if (muroIn(cx + ux * t - vx * k, cy + uy * t - vy * k)) libero = false;
          if (libero) liberi++;
        }
        /* L'anta: inchiostro sottile fuori dai muri lungo l'altro lato (in
         * v). Sotto un muro non conta: li' la riga e' del muro stesso. */
        let anta = 0;
        for (let t = 3; t < r; t++)
          for (let k = -1; k <= 1; k++) {
            const x = cx + vx * t + ux * k,
              y = cy + vy * t + uy * k;
            if (x >= 0 && y >= 0 && x < W && y < H && riga[y * W + x] && !muroC[y * W + x]) {
              anta++;
              break;
            }
          }
        const varco = totale ? liberi / totale : 0,
          conAnta = anta >= r * 0.35;
        /* Va bene se il varco e' libero, oppure se c'e' l'anta: un arco
         * mangiato dalla chiusura (o una porta sotto una scala) ha il varco
         * pieno di muro finto, ma l'anta dice lo stesso dov'e' la stanza. */
        if (varco < 0.6 && !conAnta) continue;
        /* L'anta decide prima del varco: dei due lati, quello con l'anta
         * accanto e' il muro. */
        const punti = (conAnta ? 2 : 0) + varco;
        if (!meglio || punti > meglio.punti) meglio = { ux, uy, vx, vy, punti };
      }
      if (!meglio) continue;
      const { ux, uy, vx, vy } = meglio;
      /* 4. Lo spessore del muro agli stipiti: oltre la cerniera e oltre il
       *    capo dell'arco, lungo il muro, la corsa di muro di traverso che
       *    passa vicino alla faccia (in -v e' dietro, fuori dal riquadro). */
      const sezioni = [];
      for (let s = 1; s <= vicino + 2; s++) {
        for (const d of [-s, r + s]) {
          const px = cx + ux * d,
            py = cy + uy * d;
          let v0 = 0,
            v1 = 0,
            trovata = false;
          for (let v = -vicino; v <= vicino && !trovata; v++) {
            if (!muroIn(px + vx * v, py + vy * v)) continue;
            trovata = true;
            v0 = v;
            while (v0 > -spessoreMax && muroIn(px + vx * (v0 - 1), py + vy * (v0 - 1))) v0--;
            v1 = v;
            while (v1 < vicino && muroIn(px + vx * (v1 + 1), py + vy * (v1 + 1))) v1++;
          }
          if (trovata) sezioni.push([v0, v1]);
        }
      }
      const mediana = (k) => {
        const v = sezioni.map((s) => s[k]).sort((a, b) => a - b);
        return v.length ? v[v.length >> 1] : 0;
      };
      const dietro = Math.min(0, mediana(0)),
        davanti = Math.max(0, mediana(1));
      const dentro = (x, y) => [Math.max(0, Math.min(W - 1, x)), Math.max(0, Math.min(H - 1, y))];
      const [ax0, ay0] = dentro(cx + vx * dietro, cy + vy * dietro),
        [ax1, ay1] = dentro(cx + ux * r + vx * davanti, cy + uy * r + vy * davanti);
      const [bx0, by0] = dentro(cx, cy),
        [bx1, by1] = dentro(cx + sx * r, cy + sy * r);
      archi.push({
        x0: Math.min(bx0, bx1),
        y0: Math.min(by0, by1),
        x1: Math.max(bx0, bx1),
        y1: Math.max(by0, by1),
        raggio: r,
        cerniera: [bx0, by0],
        apertura: {
          x0: Math.min(ax0, ax1),
          y0: Math.min(ay0, ay1),
          x1: Math.max(ax0, ax1),
          y1: Math.max(ay0, ay1),
        },
      });
      /* 5. le celle dell'arco e dell'anta (dove c'e' inchiostro) */
      for (const c of arco.celle) celle[c] = 1;
      for (let t = 1; t <= r; t++)
        for (let k = -1; k <= 1; k++) {
          const x = cx + vx * t + ux * k,
            y = cy + vy * t + uy * k;
          if (x >= 0 && y >= 0 && x < W && y < H && riga[y * W + x] && !muroC[y * W + x])
            celle[y * W + x] = 1;
        }
    }
  }
  return { archi, celle };
}
