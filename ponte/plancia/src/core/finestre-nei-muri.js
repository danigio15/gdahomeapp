/**
 * Le finestre nei muri di una pianta a righe (un disegno CAD).
 *
 * Nel disegno una finestra e' un tratto di muro dove il riempimento cambia:
 * fra due righette di traverso (gli stipiti) corrono 1-3 righe sottili lungo
 * il muro (il vetro), di solito con un trattino in mezzo; il muro attorno ha
 * un altro inchiostro (il tratteggio, il pieno, o solo le due righe dei
 * bordi). La chiusura della griglia ha riempito anche il vano della finestra,
 * che oggi e' «muro» come il resto: qui si ritrova guardando l'inchiostro
 * grezzo sotto il muro.
 *
 * Il criterio, per ogni tratto dritto di muro (orizzontale o verticale):
 *
 *   1. posizione per posizione lungo il tratto si campiona l'inchiostro
 *      attraverso lo spessore del muro (la «fascia», che segue il muro e non
 *      si sposta per un numero o un trattino appiccicato al muro);
 *   2. le posizioni piene di traverso (una riga attraverso tutto lo spessore)
 *      spezzano il tratto in segmenti: fra due stipiti sta il vano, il
 *      trattino in mezzo lo taglia in due meta' che si riuniscono se hanno lo
 *      stesso inchiostro;
 *   3. un segmento e' un candidato se e' lungo 0,4-3,2 m, sta fra due
 *      stipiti, ha nel cuore dello spessore almeno una riga che corre lungo
 *      quasi tutto il segmento e ha un inchiostro costante (righe nette, non
 *      una scritta);
 *   4. un candidato e' una finestra se il suo inchiostro e' nettamente
 *      diverso da quello del muro. Il muro di riferimento e' l'inchiostro
 *      piu' diffuso fuori dai candidati (un tratto di muro fra due finestre
 *      e' un candidato anche lui, e confrontato con le finestre sembrerebbe
 *      «diverso»; una vetrata troppo lunga per essere candidata non deve
 *      contare come muro): quello del tratto stesso e quello dei muri dello
 *      stesso spessore di tutta la pianta, e la finestra deve essere diversa
 *      da tutti e due quelli che ci sono.
 *
 * Una porta non c'entra: il suo varco non e' muro, e il tratto si ferma li'.
 * Un tramezzo a doppia riga senza finestre ha lo stesso inchiostro per tutta
 * la lunghezza: niente segmento diverso dal resto.
 */

/* Il muro «normale» e' spesso fino a 70 cm e almeno 9 cm; piu' spesso e' un
 * incrocio, un angolo o una scritta appiccicata. */
const SPESSORE_MAX_M = 0.7,
  SPESSORE_MIN_M = 0.09,
  VANO_MIN_M = 0.4,
  VANO_MAX_M = 3.2;
/* La distanza fra due profili di inchiostro: la somma, cella per cella dello
 * spessore, della differenza fra le parti di posizioni inchiostrate. Una
 * finestra cambia il profilo di almeno una riga in un tramezzo sottile e di
 * due righe e mezza in un muro spesso (lo spessore diviso 7, fra i due);
 * sotto il 60% di quel cambio e' lo stesso inchiostro. */
const CAMBIO_MINIMO = 1,
  CAMBIO_MASSIMO = 2.5;
function soglieDiInchiostro(tN) {
  const cambio = Math.max(CAMBIO_MINIMO, Math.min(CAMBIO_MASSIMO, tN / 7));
  return { cambio, stesso: cambio * 0.6 };
}
/* Quante posizioni di muro servono per fare da riferimento. */
const RIFERIMENTO_MINIMO = 6,
  RIFERIMENTO_GLOBALE_MINIMO = 20;

/**
 * @param {Uint8Array} riga l'inchiostro sottile per cella, anche sotto i muri
 * @param {Uint8Array} muro le celle di muro chiuso
 * @param {number} W
 * @param {number} H
 * @param {number} passo il lato della cella in metri
 * @returns {{ vetro: Uint8Array, finestre: Array<{x0:number,y0:number,x1:number,y1:number,oriz:boolean,largo:number}> }}
 */
export function finestreNeiMuri(riga, muro, W, H, passo) {
  const vetro = new Uint8Array(W * H),
    finestre = [];
  if (!W || !H || !passo) return { vetro, finestre };
  const soglie = {
    spessoreMax: Math.round(SPESSORE_MAX_M / passo),
    spessoreMin: Math.max(2, Math.round(SPESSORE_MIN_M / passo)),
    vanoMin: Math.round(VANO_MIN_M / passo),
    vanoMax: Math.round(VANO_MAX_M / passo),
  };
  /* i muri orizzontali corrono lungo x, quelli verticali lungo y */
  const versi = [
    { at: (p, o) => o * W + p, nA: W, nC: H, oriz: true },
    { at: (p, o) => p * W + o, nA: H, nC: W, oriz: false },
  ];
  /* i candidati di tutti i tratti, e i segmenti di muro per spessore */
  const candidati = [],
    muriPerSpessore = new Map();
  for (const verso of versi)
    for (const tratto of tratti(muro, verso.at, verso.nA, verso.nC, soglie)) {
      const esito = candidatiDelTratto(riga, verso, tratto, soglie);
      if (!esito) continue;
      for (const c of esito.candidati) candidati.push({ ...c, verso, tratto: esito });
      if (!muriPerSpessore.has(esito.tN)) muriPerSpessore.set(esito.tN, []);
      muriPerSpessore.get(esito.tN).push(...esito.muri);
    }
  const globali = new Map();
  for (const [tN, muri] of muriPerSpessore)
    globali.set(tN, riferimento(muri, tN, RIFERIMENTO_GLOBALE_MINIMO));
  for (const c of candidati) {
    const { tratto, verso } = c,
      tN = tratto.tN,
      { cambio } = soglieDiInchiostro(tN),
      locale = riferimento(tratto.muri, tN, RIFERIMENTO_MINIMO),
      globale = globali.get(tN);
    if (!locale && !globale) continue;
    if (locale && distanza(c.profilo, locale) < cambio) continue;
    if (globale && distanza(c.profilo, globale) < cambio) continue;
    /* la finestra, stipiti compresi */
    const posizioni = tratto.posizioni,
      p0 = posizioni[c.a - 1].p,
      p1 = posizioni[c.b + 1].p;
    let c0 = verso.nC,
      c1 = 0;
    for (let i = c.a - 1; i <= c.b + 1; i++) {
      const q = posizioni[i];
      if (q.c0 < c0) c0 = q.c0;
      if (q.c0 + tN - 1 > c1) c1 = q.c0 + tN - 1;
      for (let o = 0; o < tN && q.c0 + o < verso.nC; o++) {
        const j = verso.at(q.p, q.c0 + o);
        if (muro[j]) vetro[j] = 1;
      }
    }
    c1 = Math.min(c1, verso.nC - 1);
    const largo = (p1 - p0 + 1) * passo;
    finestre.push(
      verso.oriz
        ? { x0: p0, y0: c0, x1: p1, y1: c1, oriz: true, largo }
        : { x0: c0, y0: p0, x1: c1, y1: p1, oriz: false, largo },
    );
  }
  finestre.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  return { vetro, finestre };
}

/* Le corse di muro attraverso lo spessore, alla posizione p lungo il tratto:
 * ognuna e' [c0, c1) sull'asse di traverso. */
function corseDiTraverso(muro, at, p, nC) {
  const corse = [];
  let o = 0;
  while (o < nC) {
    if (!muro[at(p, o)]) {
      o++;
      continue;
    }
    let e = o;
    while (e < nC && muro[at(p, e)]) e++;
    corse.push({ c0: o, c1: e });
    o = e;
  }
  return corse;
}

/* I tratti dritti di muro: catene di corse di traverso, posizione dopo
 * posizione. La fascia di una catena segue il muro (una corsa che sta dove
 * sta la fascia, a meno di due celle di scarto per i bordi storti); una
 * corsa piu' larga che contiene la fascia (un numero o un trattino
 * appiccicato, l'incrocio con un tramezzo corto) si attraversa senza
 * spostarla, al piu' per lo spessore di un muro e fino al triplo della
 * fascia: un angolo o un tramezzo lungo chiudono il tratto. */
function tratti(muro, at, nA, nC, { spessoreMax, spessoreMin }) {
  const fatti = [];
  let aperte = [];
  for (let p = 0; p < nA; p++) {
    const prese = new Set(),
      prossime = [];
    for (const corsa of corseDiTraverso(muro, at, p, nC)) {
      const t = corsa.c1 - corsa.c0;
      if (t < spessoreMin) continue;
      let meglio = null,
        comeFascia = false,
        sovrapposto = 0;
      for (const catena of aperte) {
        if (prese.has(catena)) continue;
        const f = catena.fascia,
          tf = f.c1 - f.c0,
          s = Math.min(corsa.c1, f.c1) - Math.max(corsa.c0, f.c0);
        if (s <= 0) continue;
        const stessa = Math.abs(corsa.c0 - f.c0) <= 2 && Math.abs(corsa.c1 - f.c1) <= 2,
          contiene = s >= 0.9 * tf && t <= 3 * tf && catena.anomale < spessoreMax;
        if ((stessa || contiene) && s > sovrapposto) {
          sovrapposto = s;
          meglio = catena;
          comeFascia = stessa;
        }
      }
      if (meglio) {
        prese.add(meglio);
        if (comeFascia) {
          meglio.fascia = corsa;
          meglio.anomale = 0;
        } else meglio.anomale++;
        meglio.posizioni.push({ p, c0: meglio.fascia.c0, c1: meglio.fascia.c1, t });
        prossime.push(meglio);
      } else if (t <= spessoreMax) {
        prossime.push({
          fascia: corsa,
          anomale: 0,
          posizioni: [{ p, c0: corsa.c0, c1: corsa.c1, t }],
        });
      }
    }
    for (const catena of aperte) if (!prese.has(catena)) fatti.push(catena.posizioni);
    aperte = prossime;
  }
  for (const catena of aperte) fatti.push(catena.posizioni);
  return fatti;
}

function mediana(valori) {
  const v = valori.slice().sort((a, b) => a - b);
  return v.length ? v[v.length >> 1] : 0;
}

/* Il profilo di un gruppo di posizioni: per ogni offset attraverso lo
 * spessore, la parte di posizioni che ci ha inchiostro. */
function profilo(campioni, tN) {
  const f = new Float64Array(tN);
  if (!campioni.length) return f;
  for (const s of campioni) for (let o = 0; o < tN; o++) f[o] += s[o];
  for (let o = 0; o < tN; o++) f[o] /= campioni.length;
  return f;
}

function distanza(fa, fb) {
  let d = 0;
  for (let o = 0; o < fa.length; o++) d += Math.abs(fa[o] - fb[o]);
  return d;
}

/* Il muro di riferimento da un mucchio di segmenti di muro: l'inchiostro
 * piu' diffuso. I segmenti, dal piu' lungo, si raccolgono in famiglie dallo
 * stesso inchiostro; vince la famiglia con piu' posizioni, se ne ha
 * abbastanza. Cosi' una vetrata lunga (non candidata, ma neanche muro) non
 * sporca il profilo del muro. */
function riferimento(segmenti, tN, minimo) {
  const { stesso } = soglieDiInchiostro(tN),
    famiglie = [];
  for (const seg of segmenti.slice().sort((a, b) => b.campioni.length - a.campioni.length)) {
    const fam = famiglie.find((f) => distanza(f.seme, seg.profilo) <= stesso);
    if (fam) fam.segmenti.push(seg);
    else famiglie.push({ seme: seg.profilo, segmenti: [seg] });
  }
  let meglio = null,
    n = 0;
  for (const fam of famiglie) {
    const k = fam.segmenti.reduce((a, s) => a + s.campioni.length, 0);
    if (k > n) {
      n = k;
      meglio = fam;
    }
  }
  if (!meglio || n < minimo) return null;
  return profilo(
    meglio.segmenti.flatMap((s) => s.campioni),
    tN,
  );
}

/* I candidati di un tratto (i segmenti fra due stipiti che somigliano a una
 * finestra), col loro profilo, e i segmenti del resto del tratto che sono
 * muro. */
function candidatiDelTratto(riga, { at, nC }, posizioni, soglie) {
  const { spessoreMax, spessoreMin, vanoMin, vanoMax } = soglie;
  /* un tratto piu' corto di una finestra con gli stipiti non ne contiene */
  if (posizioni.length < vanoMin + 2) return null;
  const tN = mediana(posizioni.filter((q) => q.t <= spessoreMax).map((q) => q.t));
  if (tN < spessoreMin) return null;
  const { stesso } = soglieDiInchiostro(tN);
  /* il cuore dello spessore: fuori dalle due righe dei bordi */
  const bordo = tN >= 8 ? 2 : 1,
    cuore0 = bordo,
    cuore1 = tN - 1 - bordo;
  if (cuore1 < cuore0) return null;
  /* 1. l'inchiostro attraverso la fascia, posizione per posizione */
  const campioni = posizioni.map((q) => {
    const s = new Uint8Array(tN);
    for (let o = 0; o < tN && q.c0 + o < nC; o++) s[o] = riga[at(q.p, q.c0 + o)];
    return s;
  });
  const pieno = campioni.map((s) => {
    let n = 0;
    for (let o = 0; o < tN; o++) n += s[o];
    return n >= 0.8 * tN;
  });
  const cuore = campioni.map((s) => {
    let n = 0;
    for (let o = cuore0; o <= cuore1; o++) n += s[o];
    return n;
  });
  /* 2. i segmenti fra le posizioni piene di traverso (indici in posizioni) */
  const segmenti = [];
  let k = 0;
  while (k < posizioni.length) {
    if (pieno[k]) {
      k++;
      continue;
    }
    let e = k;
    while (e < posizioni.length && !pieno[e]) e++;
    const campioniDi = [];
    for (let i = k; i < e; i++) campioniDi.push(campioni[i]);
    segmenti.push({ a: k, b: e - 1, campioni: campioniDi, profilo: profilo(campioniDi, tN) });
    k = e;
  }
  /* le due meta' di un vano tagliate dal trattino in mezzo: stesso
   * inchiostro, separate da al piu' tre celle piene */
  const uniti = [];
  for (const seg of segmenti) {
    const ultimo = uniti[uniti.length - 1];
    if (ultimo && seg.a - ultimo.b - 1 <= 3 && distanza(ultimo.profilo, seg.profilo) <= stesso) {
      ultimo.b = seg.b;
      ultimo.campioni.push(...seg.campioni);
      ultimo.profilo = profilo(ultimo.campioni, tN);
    } else uniti.push(seg);
  }
  /* 3. i candidati, e il resto e' muro */
  const candidati = [],
    muri = [];
  for (const seg of uniti) {
    if (candidato(seg, posizioni, cuore, cuore0, cuore1, vanoMin, vanoMax)) candidati.push(seg);
    else muri.push(seg);
  }
  return { tN, posizioni, candidati, muri };
}

/* Un segmento somiglia a una finestra? */
function candidato(seg, posizioni, cuore, cuore0, cuore1, vanoMin, vanoMax) {
  const lungo = seg.b - seg.a + 1;
  if (lungo < vanoMin || lungo > vanoMax) return false;
  /* gli stipiti: una riga di traverso da tutte e due le parti, attaccata */
  if (seg.a === 0 || seg.b === posizioni.length - 1) return false;
  if (posizioni[seg.a - 1].p !== posizioni[seg.a].p - 1) return false;
  if (posizioni[seg.b + 1].p !== posizioni[seg.b].p + 1) return false;
  /* almeno una riga nel cuore che corre lungo quasi tutto il segmento */
  let corre = false;
  for (let o = cuore0; o <= cuore1 && !corre; o++) if (seg.profilo[o] >= 0.8) corre = true;
  if (!corre) return false;
  /* righe nette: l'inchiostro nel cuore e' quasi costante (una scritta
   * cambia a ogni lettera); le celle piene (il trattino in mezzo) non
   * contano */
  const valori = [];
  for (let i = seg.a; i <= seg.b; i++) if (cuore[i] <= cuore1 - cuore0) valori.push(cuore[i]);
  const m = mediana(valori);
  let costanti = 0;
  for (const v of valori) if (Math.abs(v - m) <= 1) costanti++;
  return costanti >= 0.8 * valori.length;
}
