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

/** La griglia dei muri da 3 cm, dall'inchiostro e dalla scala (metri per pixel). */
export function grigliaDeiMuri(ink, w, h, mpp) {
  const lato = PASSO / mpp,
    W = Math.floor(w / lato),
    H = Math.floor(h / lato),
    muro = new Uint8Array(W * H),
    riga = new Uint8Array(W * H);
  for (let cy = 0; cy < H; cy++)
    for (let cx = 0; cx < W; cx++) {
      let n = 0,
        s = 0;
      for (let y = Math.floor(cy * lato); y < Math.floor((cy + 1) * lato); y++)
        for (let x = Math.floor(cx * lato); x < Math.floor((cx + 1) * lato); x++) {
          n++;
          s += ink[y * w + x];
        }
      muro[cy * W + cx] = n && s / n > 0.5 ? 1 : 0;
      riga[cy * W + cx] = s > 0 ? 1 : 0; // anche un filo d'inchiostro: le righe delle finestre
    }
  // quello scuro che tocca il bordo e' il tavolo sotto il foglio, non un muro
  const fondo = new Uint8Array(W * H),
    coda = [];
  for (let x = 0; x < W; x++)
    for (const y of [0, H - 1])
      if (muro[y * W + x]) {
        fondo[y * W + x] = 1;
        coda.push(y * W + x);
      }
  for (let y = 0; y < H; y++)
    for (const x of [0, W - 1])
      if (muro[y * W + x] && !fondo[y * W + x]) {
        fondo[y * W + x] = 1;
        coda.push(y * W + x);
      }
  while (coda.length) {
    const i = coda.pop(),
      x = i % W;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W])
      if (j >= 0 && j < W * H && muro[j] && !fondo[j]) {
        fondo[j] = 1;
        coda.push(j);
      }
  }
  for (let i = 0; i < W * H; i++) if (fondo[i]) muro[i] = 0;
  // via le cose sottili: si consuma di una cella e si ricresce
  const erosa = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      erosa[i] =
        muro[i] &&
        muro[i - 1] &&
        muro[i + 1] &&
        muro[i - W] &&
        muro[i + W] &&
        muro[i - W - 1] &&
        muro[i - W + 1] &&
        muro[i + W - 1] &&
        muro[i + W + 1]
          ? 1
          : 0;
    }
  const pulita = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (
        erosa[i] ||
        erosa[i - 1] ||
        erosa[i + 1] ||
        erosa[i - W] ||
        erosa[i + W] ||
        erosa[i - W - 1] ||
        erosa[i - W + 1] ||
        erosa[i + W - 1] ||
        erosa[i + W + 1]
      )
        pulita[i] = 1;
    }
  // via i pezzetti (meno di 0,04 m²: lettere grosse, segni delle quote)
  const visto = new Uint8Array(W * H),
    minimo = 0.04 / (PASSO * PASSO);
  for (let i = 0; i < W * H; i++) {
    if (!pulita[i] || visto[i]) continue;
    const pezzo = [i];
    visto[i] = 1;
    for (let k = 0; k < pezzo.length; k++) {
      const c = pezzo[k],
        x = c % W;
      for (const j of [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c - W, c + W])
        if (j >= 0 && j < W * H && pulita[j] && !visto[j]) {
          visto[j] = 1;
          pezzo.push(j);
        }
    }
    if (pezzo.length < minimo) for (const c of pezzo) pulita[c] = 0;
  }
  /* la barriera: muri piu' le righe sottili lunghe (le finestre, le soglie).
   * Le scritte no: sono pezzetti corti. Serve solo a capire dov'e' il fuori,
   * non diventa muro nel 3D. */
  const barriera = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (pulita[i] || (riga[i] && !fondoDi(i))) barriera[i] = 1;
  const vista2 = new Uint8Array(W * H),
    corto = 0.5 / PASSO;
  for (let i = 0; i < W * H; i++) {
    if (!barriera[i] || pulita[i] || vista2[i]) continue;
    const pezzo = [i];
    vista2[i] = 1;
    let x0 = W,
      x1 = 0,
      y0 = H,
      y1 = 0,
      tocca = false;
    for (let k = 0; k < pezzo.length; k++) {
      const c = pezzo[k],
        x = c % W,
        y = (c / W) | 0;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      for (const j of [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c - W, c + W])
        if (j >= 0 && j < W * H && barriera[j]) {
          if (pulita[j]) tocca = true;
          else if (!vista2[j]) {
            vista2[j] = 1;
            pezzo.push(j);
          }
        }
    }
    // tengo le righe che toccano un muro (finestre, soglie); via scritte e quote volanti
    if (!tocca || Math.max(x1 - x0, y1 - y0) < 6) for (const c of pezzo) barriera[c] = 0;
  }
  // le righe si ispessiscono di una cella: una riga storta lascia passaggi in diagonale
  const spessa = barriera.slice();
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (barriera[i] && !pulita[i])
        for (const j of [i - 1, i + 1, i - W, i + W, i - W - 1, i - W + 1, i + W - 1, i + W + 1])
          spessa[j] = 1;
    }
  barriera.set(spessa);
  function fondoDi(i) {
    return fondo[i];
  }
  return { W, H, muro: pulita, barriera };
}

/** Dai muri alla casa, nella stessa forma che esce dal DWG (importa.js). */
export function riconosciDaFoto({ W, H, muro, barriera }, { fuori = new Set() } = {}) {
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
    const finestra = verso0;
    for (let p = p0; p <= p1; p++)
      for (let q = orizz ? x0 : y0; q <= (orizz ? x1 : y1); q++) {
        const i = orizz ? p * W + q : q * W + p;
        if (!muro[i]) segna.push(i);
      }
    const portafinestra = finestra && gr.largo >= 1.2;
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
