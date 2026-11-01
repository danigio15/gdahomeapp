/* Le piante di un foglio del catasto, e la sua scala quando non e' scritta.
 *
 * «Verifica che con questo PDF non riesce a fare la planimetria»: la visura
 * della planimetria che si scarica dal catasto. Tre cose la rompevano.
 *
 * - E' una **scansione**: il testo che il PDF sa dire e' solo l'intestazione
 *   («Data presentazione…») e il piede («Formato di acquisizione: A3…»); la
 *   «Scala 1:200» sta dentro l'immagine, girata, e non si legge. La scala
 *   pero' si sa lo stesso: le planimetrie del catasto sono a 1:200, e il
 *   piede dice da che foglio a che foglio sono state ridotte (A3 su A4).
 * - Sullo stesso foglio ci sono **piu' piante** (piano primo e secondo) e
 *   l'estratto di mappa: il riconoscimento ne teneva una e buttava l'altra,
 *   senza dire niente.
 * - Attorno alla casa ci sono i contorni sottili delle **altre unita'**, e
 *   uno chiudeva una «stanza» di 120 m² attaccata alla casa.
 *
 * Qui le piante si trovano dai muri spessi — quelli della unita' sono pieni e
 * neri, le scritte e i contorni delle altre unita' sono righe sottili — e ogni
 * pianta si ritaglia da sola, con un po' di margine: le altre unita' restano
 * fuori, e chi ha piu' piani sceglie quale fare. Funzioni pure, senza
 * browser: si provano in Node. */

/* I lati lunghi dei fogli della serie A, in millimetri. */
const LATO_A = Object.freeze({ 0: 1189, 1: 841, 2: 594, 3: 420, 4: 297, 5: 210 });

/** La scala di una planimetria del catasto. */
export const SCALA_DEL_CATASTO = 200;

/**
 * La scala di un foglio del catasto dal suo testo, quando la «Scala 1:200»
 * non si legge: 0 se il testo non e' quello del catasto.
 *
 * Torna il denominatore **sul foglio stampato**: una planimetria a 1:200
 * acquisita in A3 e stampata in A4 sul foglio e' a 1:282,8.
 */
export function scalaDelCatasto(testo) {
  const t = String(testo || "").replace(/\s+/g, " ");
  const acquisita = /formato\s+di\s+acquisizione\s*:?\s*A\s*([0-5])/i.exec(t);
  const stampata = /formato\s+(?:di\s+)?stampa(?:\s+richiesto)?\s*:?\s*A\s*([0-5])/i.exec(t);
  const delCatasto = /catasto|planimetria\s+in\s+atti/i.test(t);
  if (!acquisita && !delCatasto) return 0;
  if (!acquisita || !stampata) return SCALA_DEL_CATASTO;
  const da = LATO_A[acquisita[1]],
    a = LATO_A[stampata[1]];
  return da && a ? (SCALA_DEL_CATASTO * da) / a : SCALA_DEL_CATASTO;
}

/**
 * Le piante sul foglio: i gruppi di muri spessi grandi quanto una casa.
 *
 * `ink` e' l'inchiostro (`inchiostro` in pianta-da-foto.js), `mpp` i metri
 * per pixel. Torna `[{x0, y0, x1, y1, larghezza, profondita}]` in pixel e
 * metri, dalla piu' in alto alla piu' in basso (e da sinistra a destra).
 */
export function pianteNelFoglio(ink, w, h, mpp) {
  if (!ink || !(mpp > 0) || w < 10 || h < 10) return [];
  /* Spesso: tutto un quadrato di 16 cm di inchiostro. Un muro vero (20–50
   * cm) lo e'; le righe delle altre unita', le quote e le lettere no. */
  const r = Math.max(1, Math.round(0.08 / mpp)),
    pieno = (2 * r + 1) ** 2;
  const I = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let riga = 0;
    for (let x = 0; x < w; x++) {
      riga += ink[y * w + x] ? 1 : 0;
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + riga;
    }
  }
  const quadrato = (x0, y0, x1, y1) =>
    I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
  /* Celle da 25 cm: una cella e' spessa se ci cade un pixel spesso. */
  const c = Math.max(2, Math.round(0.25 / mpp)),
    CW = Math.ceil(w / c),
    CH = Math.ceil(h / c),
    spessa = new Uint8Array(CW * CH);
  for (let y = r; y < h - r; y++)
    for (let x = r; x < w - r; x++)
      if (ink[y * w + x] && quadrato(x - r, y - r, x + r + 1, y + r + 1) === pieno)
        spessa[Math.floor(y / c) * CW + Math.floor(x / c)] = 1;
  /* I muri della stessa pianta sono a meno di un metro l'uno dall'altro
   * (una porta, una finestra): si uniscono allargandoli di un metro. */
  const d = Math.max(1, Math.round(1 / (c * mpp))),
    vicina = new Uint8Array(CW * CH);
  for (let y = 0; y < CH; y++)
    for (let x = 0; x < CW; x++) {
      if (!spessa[y * CW + x]) continue;
      for (let dy = -d; dy <= d; dy++) {
        const Y = y + dy;
        if (Y < 0 || Y >= CH) continue;
        for (let dx = -d; dx <= d; dx++) {
          const X = x + dx;
          if (X >= 0 && X < CW) vicina[Y * CW + X] = 1;
        }
      }
    }
  const visto = new Uint8Array(CW * CH),
    piante = [];
  for (let s = 0; s < CW * CH; s++) {
    if (!vicina[s] || visto[s]) continue;
    const pila = [s];
    visto[s] = 1;
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -1,
      y1 = -1,
      celle = 0;
    while (pila.length) {
      const k = pila.pop(),
        x = k % CW,
        y = (k - x) / CW;
      if (spessa[k]) {
        celle++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      for (const j of [x > 0 ? k - 1 : -1, x < CW - 1 ? k + 1 : -1, k - CW, k + CW])
        if (j >= 0 && j < CW * CH && vicina[j] && !visto[j]) {
          visto[j] = 1;
          pila.push(j);
        }
    }
    if (x1 < 0) continue;
    const larghezza = (x1 - x0 + 1) * c * mpp,
      profondita = (y1 - y0 + 1) * c * mpp;
    /* Grande quanto una casa (da 3 a 60 m per lato), e con muri lunghi
     * almeno quanto il giro di una stanza: la barra nera del margine, un
     * timbro, una scritta in grassetto non lo sono. */
    if (Math.min(larghezza, profondita) < 3 || Math.max(larghezza, profondita) > 60) continue;
    if (celle * c * mpp < 2 * (larghezza + profondita) * 0.6) continue;
    piante.push({
      x0: x0 * c,
      y0: y0 * c,
      x1: Math.min(w, (x1 + 1) * c),
      y1: Math.min(h, (y1 + 1) * c),
      larghezza,
      profondita,
    });
  }
  return piante.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
}

/**
 * Il riquadro da ritagliare attorno a una pianta: un metro di margine, dentro
 * il foglio. Il margine tiene le finestre e i balconi che sporgono; oltre, le
 * altre unita' restano fuori.
 */
export function riquadroDellaPianta(pianta, w, h, mpp) {
  const m = Math.round(1 / mpp);
  const x0 = Math.max(0, pianta.x0 - m),
    y0 = Math.max(0, pianta.y0 - m),
    x1 = Math.min(w, pianta.x1 + m),
    y1 = Math.min(h, pianta.y1 + m);
  return { x0, y0, larghezza: x1 - x0, altezza: y1 - y0 };
}

/* Il bianco attorno al ritaglio, in pixel. Le righe delle altre unita'
 * arrivano fino al taglio: senza questo bianco toccherebbero il bordo, e
 * l'inchiostro le prende per il tavolo sotto il foglio — e con loro i muri
 * della casa a cui sono attaccate. */
export const BIANCO_ATTORNO = 12;
