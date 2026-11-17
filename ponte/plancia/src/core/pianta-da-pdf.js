/* La planimetria da un PDF vettoriale: i tratti del disegno, non i pixel.
 *
 * «La gente carica i PDF e non vanno»: il progetto di un architetto (una
 * tavola A3 a 1:50) passava per la strada della foto. La pagina si disegnava
 * e se ne cercavano i muri a occhio, con dentro tutto quello che c'e' su una
 * tavola: le quote che attraversano le stanze, il cartiglio, le scritte,
 * le righe a tratto e punto delle altre unita', il tratteggio dei muri. E la
 * scala non si trovava: in molti PDF (quelli passati da un'altra stampante
 * virtuale) le scritte non sono testo ma disegno, e «scala 1:50» non si
 * legge. Si chiedevano i metri, e la casa veniva comunque sballata.
 *
 * Qui il PDF si legge per quello che e': un elenco di tratti, ognuno con il
 * suo spessore, il suo colore, pieno o a filo. Funzioni pure, senza browser:
 * si provano in Node.
 *
 *   1. `tracciatiDellaPagina`: dall'elenco delle operazioni di pdf.js ai
 *      tratti, in punti della pagina (y verso il basso);
 *   2. `piantaDalPdf`: i ruoli dei tratti, dagli indizi che ogni disegno
 *      tecnico ha:
 *      - le scritte disegnate sono macchioline piene in fila (non muri);
 *      - il tratteggio (retino) e' fatto di righe corte, oblique e parallele;
 *        i suoi capi toccano il contorno dei muri: la penna che tocca il
 *        retino e' quella dei muri, qualunque spessore abbia;
 *      - le quote hanno le tacche (o le frecce) in cima: si scartano, con
 *        tutta la loro penna (che di solito disegna anche il cartiglio);
 *      - gli archi delle porte: archi di un quarto di giro, anche tratteggiati;
 *        il loro raggio (una porta e' 70-90 cm) dice la scala quando non e'
 *        scritta;
 *      - le finestre: righe nel varco fra due pezzi di muro in fila;
 *      - i parapetti dei balconi: righe doppie attaccate ai muri, fuori casa;
 *      - un riquadro con le due diagonali e' un vano (ascensore, cavedio);
 *      - la casa e' il gruppo di muri piu' grande: il resto del foglio
 *        (cartiglio, titolo, nord, le altre unita') resta fuori;
 *   3. `tavolaDalPdf`: i muri disegnati puliti su una tela (con le tele delle
 *      finestre, delle porte e dei parapetti a parte), pronta per la stessa
 *      strada del disegno DWG;
 *   4. `stanzeDalPdf`: dopo il riconoscimento, i nomi e i metri quadri scritti
 *      nelle stanze (anche per controllare la scala), i balconi e i vani.
 */

import { scalaScritta } from "./pianta-da-foto.js";
import { leggiLeScritte } from "./scritte-disegnate.js";
import { eNomeDiFuori, eNomeDiStanza, nomeDaScritta } from "./pianta-da-dwg.js";

/** Punti PDF in un millimetro di foglio. */
const MM = 72 / 25.4;
/** Le scale dei disegni di architettura, dalla piu' grande. */
export const SCALE_DI_SERIE = Object.freeze([20, 25, 50, 75, 100, 200, 250, 500]);

/* ── 1. i tratti della pagina ─────────────────────────────────────────── */

const moltiplica = (a, b) => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];

function coloreDa(a) {
  if (typeof a === "string") {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(a);
    return m ? [1, 2, 3].map((k) => parseInt(m[k], 16)).join(",") : "0,0,0";
  }
  if (a && typeof a === "object" && a.length >= 3)
    return [a[0], a[1], a[2]].map((v) => Math.round(Number(v) || 0)).join(",");
  if (a && typeof a === "object" && a[0] !== undefined)
    return [a[0], a[1], a[2]].map((v) => Math.round(Number(v) || 0)).join(",");
  return "0,0,0";
}

/**
 * I tratti di una pagina dall'elenco delle operazioni di pdf.js
 * (`page.getOperatorList()`), in punti della pagina con la y verso il basso.
 *
 * `OPS` sono i codici delle operazioni di pdf.js (`pdfjsLib.OPS`), `vista`
 * la trasformazione della pagina (`page.getViewport({ scale: 1 }).transform`,
 * che sa anche della rotazione).
 *
 * Torna `{ tratti, immagini }`: ogni tratto e' un pezzo di percorso
 * `{ punti, chiuso, curvo, pieno, spessore, colore, tratteggio, percorso }`
 * (`percorso` e' il numero del percorso da cui viene: le lettere fatte di
 * piu' pezzi ne hanno uno solo).
 */
export function tracciatiDellaPagina(
  { fnArray = [], argsArray = [] } = {},
  OPS = {},
  vista = null,
) {
  const base = Array.isArray(vista) && vista.length === 6 ? vista : [1, 0, 0, 1, 0, 0];
  let ctm = [1, 0, 0, 1, 0, 0],
    spessore = 1,
    riempi = "0,0,0",
    filo = "0,0,0",
    tratteggio = false;
  const pila = [],
    tratti = [];
  let pendente = null,
    percorsi = 0,
    immagini = 0;
  const finale = () => moltiplica(base, ctm);
  const dipingi = (pieno) => {
    if (!pendente) return;
    const [codici, numeri] = pendente;
    if (!codici || !numeri) return;
    const m = finale(),
      scala = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
    const tr = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    const pezzi = [];
    let cur = null,
      curvo = false,
      k = 0,
      ultimo = [0, 0];
    const nuovo = (p) => {
      cur = { punti: [p], chiuso: false, curvo: false };
      pezzi.push(cur);
    };
    /* le curve si spezzano in otto tratti: un arco di porta resta un arco */
    const bezier = (p0, p1, p2, p3) => {
      for (let t = 1; t <= 8; t++) {
        const s = t / 8,
          u = 1 - s;
        cur.punti.push([
          u * u * u * p0[0] + 3 * u * u * s * p1[0] + 3 * u * s * s * p2[0] + s * s * s * p3[0],
          u * u * u * p0[1] + 3 * u * u * s * p1[1] + 3 * u * s * s * p2[1] + s * s * s * p3[1],
        ]);
      }
      cur.curvo = curvo = true;
    };
    for (const c of codici) {
      if (c === OPS.moveTo) {
        ultimo = [numeri[k], numeri[k + 1]];
        nuovo(tr(...ultimo));
        k += 2;
      } else if (c === OPS.lineTo) {
        ultimo = [numeri[k], numeri[k + 1]];
        if (!cur) nuovo(tr(...ultimo));
        else cur.punti.push(tr(...ultimo));
        k += 2;
      } else if (c === OPS.curveTo || c === OPS.curveTo2 || c === OPS.curveTo3) {
        let c1, c2, fine;
        if (c === OPS.curveTo) {
          c1 = [numeri[k], numeri[k + 1]];
          c2 = [numeri[k + 2], numeri[k + 3]];
          fine = [numeri[k + 4], numeri[k + 5]];
          k += 6;
        } else if (c === OPS.curveTo2) {
          c1 = ultimo;
          c2 = [numeri[k], numeri[k + 1]];
          fine = [numeri[k + 2], numeri[k + 3]];
          k += 4;
        } else {
          c1 = [numeri[k], numeri[k + 1]];
          fine = [numeri[k + 2], numeri[k + 3]];
          c2 = fine;
          k += 4;
        }
        if (!cur) nuovo(tr(...ultimo));
        bezier(cur.punti[cur.punti.length - 1], tr(...c1), tr(...c2), tr(...fine));
        ultimo = fine;
      } else if (c === OPS.rectangle) {
        const [x, y, w, h] = [numeri[k], numeri[k + 1], numeri[k + 2], numeri[k + 3]];
        k += 4;
        nuovo(tr(x, y));
        cur.punti.push(tr(x + w, y), tr(x + w, y + h), tr(x, y + h), tr(x, y));
        cur.chiuso = true;
        ultimo = [x, y];
        cur = null;
      } else if (c === OPS.closePath) {
        if (cur && cur.punti.length > 1) {
          cur.punti.push(cur.punti[0].slice());
          cur.chiuso = true;
        }
        cur = null;
      }
    }
    void curvo;
    percorsi++;
    for (const p of pezzi) {
      if (p.punti.length < 2) continue;
      const [a, b] = [p.punti[0], p.punti[p.punti.length - 1]];
      if (!p.chiuso && p.punti.length > 2 && Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.05)
        p.chiuso = true;
      tratti.push({
        punti: p.punti,
        chiuso: p.chiuso,
        curvo: p.curvo,
        pieno,
        spessore: pieno ? 0 : Math.max(0.05, spessore * scala),
        colore: pieno ? riempi : filo,
        tratteggio: !pieno && tratteggio,
        percorso: percorsi,
      });
    }
  };
  const PIENI = new Set([OPS.fill, OPS.eoFill].filter((v) => v !== undefined));
  const FILI = new Set([OPS.stroke, OPS.closeStroke].filter((v) => v !== undefined));
  const TUTTI = new Set(
    [OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].filter(
      (v) => v !== undefined,
    ),
  );
  for (let i = 0; i < fnArray.length; i++) {
    const f = fnArray[i],
      a = argsArray[i];
    if (f === OPS.save) pila.push([ctm, spessore, riempi, filo, tratteggio]);
    else if (f === OPS.restore) {
      if (pila.length) [ctm, spessore, riempi, filo, tratteggio] = pila.pop();
    } else if (f === OPS.transform && a?.length === 6) ctm = moltiplica(ctm, a);
    else if (f === OPS.paintFormXObjectBegin) {
      pila.push([ctm, spessore, riempi, filo, tratteggio]);
      if (Array.isArray(a?.[0]) && a[0].length === 6) ctm = moltiplica(ctm, a[0]);
    } else if (f === OPS.paintFormXObjectEnd) {
      if (pila.length) [ctm, spessore, riempi, filo, tratteggio] = pila.pop();
    } else if (f === OPS.setLineWidth) spessore = Number(a?.[0]) || 0;
    else if (f === OPS.setDash) tratteggio = Array.isArray(a?.[0]) && a[0].length > 0;
    else if (f === OPS.setFillRGBColor) riempi = coloreDa(a?.length === 1 ? a[0] : a);
    else if (f === OPS.setStrokeRGBColor) filo = coloreDa(a?.length === 1 ? a[0] : a);
    else if (f === OPS.setFillGray) riempi = coloreDa([a[0] * 255, a[0] * 255, a[0] * 255]);
    else if (f === OPS.setStrokeGray) filo = coloreDa([a[0] * 255, a[0] * 255, a[0] * 255]);
    else if (f === OPS.constructPath) pendente = Array.isArray(a?.[0]) ? a : null;
    else if (PIENI.has(f)) {
      dipingi(true);
      pendente = null;
    } else if (FILI.has(f)) {
      dipingi(false);
      pendente = null;
    } else if (TUTTI.has(f)) {
      dipingi(true);
      dipingi(false);
      pendente = null;
    } else if (f === OPS.endPath) pendente = null;
    else if (
      f === OPS.paintImageXObject ||
      f === OPS.paintInlineImageXObject ||
      f === OPS.paintImageMaskXObject
    )
      immagini++;
  }
  return { tratti, immagini };
}

/* ── geometria ────────────────────────────────────────────────────────── */

const lunghezza = (s) => Math.hypot(s[2] - s[0], s[3] - s[1]);
/** L'angolo di un segmento, in gradi fra 0 e 180. */
const angolo = (s) => {
  const a = (Math.atan2(s[3] - s[1], s[2] - s[0]) * 180) / Math.PI;
  return a < 0 ? a + 180 : a >= 180 ? a - 180 : a;
};
/** Obliquo: lontano piu' di 15 gradi dall'orizzontale e dalla verticale. */
const obliquo = (s) => {
  const a = angolo(s) % 90;
  return a > 15 && a < 75;
};
function riquadroDi(punti) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const [x, y] of punti) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}
function distanzaDalSegmento(px, py, s) {
  const dx = s[2] - s[0],
    dy = s[3] - s[1],
    l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - s[0]) * dx + (py - s[1]) * dy) / l2)) : 0;
  return Math.hypot(px - s[0] - t * dx, py - s[1] - t * dy);
}

/* Una griglia di secchi per trovare i segmenti vicini a un punto. */
function secchi(segmenti, lato) {
  const m = new Map();
  segmenti.forEach((s, i) => {
    const x0 = Math.floor(Math.min(s[0], s[2]) / lato),
      x1 = Math.floor(Math.max(s[0], s[2]) / lato),
      y0 = Math.floor(Math.min(s[1], s[3]) / lato),
      y1 = Math.floor(Math.max(s[1], s[3]) / lato);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 4000) return;
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) {
        const k = x * 100003 + y;
        const v = m.get(k);
        if (v) v.push(i);
        else m.set(k, [i]);
      }
  });
  return {
    vicini(x, y, r) {
      const out = new Set();
      for (let gx = Math.floor((x - r) / lato); gx <= Math.floor((x + r) / lato); gx++)
        for (let gy = Math.floor((y - r) / lato); gy <= Math.floor((y + r) / lato); gy++)
          for (const i of m.get(gx * 100003 + gy) || []) out.add(i);
      return out;
    },
  };
}

/* Il cerchio che passa meglio per dei punti (Kasa): centro, raggio, scarto. */
function cerchio(punti) {
  const n = punti.length;
  if (n < 3) return null;
  let mx = 0,
    my = 0;
  for (const [x, y] of punti) {
    mx += x;
    my += y;
  }
  mx /= n;
  my /= n;
  let suu = 0,
    svv = 0,
    suv = 0,
    suuu = 0,
    svvv = 0,
    suvv = 0,
    svuu = 0;
  for (const [x, y] of punti) {
    const u = x - mx,
      v = y - my;
    suu += u * u;
    svv += v * v;
    suv += u * v;
    suuu += u * u * u;
    svvv += v * v * v;
    suvv += u * v * v;
    svuu += v * u * u;
  }
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-9) return null;
  const a = (suuu + suvv) / 2,
    b = (svvv + svuu) / 2;
  const uc = (a * svv - b * suv) / det,
    vc = (b * suu - a * suv) / det;
  const cx = uc + mx,
    cy = vc + my,
    r = Math.sqrt(uc * uc + vc * vc + (suu + svv) / n);
  let e = 0;
  for (const [x, y] of punti) e += (Math.hypot(x - cx, y - cy) - r) ** 2;
  /* quanto giro copre: il complemento del buco piu' grande fra gli angoli */
  const ang = punti.map(([x, y]) => Math.atan2(y - cy, x - cx)).sort((p, q) => p - q);
  let buco = ang[0] + 2 * Math.PI - ang[ang.length - 1];
  for (let i = 1; i < ang.length; i++) buco = Math.max(buco, ang[i] - ang[i - 1]);
  return { cx, cy, r, scarto: Math.sqrt(e / n) / r, giro: ((2 * Math.PI - buco) * 180) / Math.PI };
}

/* ── 2. i ruoli dei tratti ────────────────────────────────────────────── */

const chiaveDi = (t) =>
  `${t.pieno ? "F" : "S"}|${t.pieno ? 0 : Math.round(t.spessore * 100) / 100}|${t.colore}|${t.tratteggio ? "d" : ""}`;
const chiaro = (c) => {
  const [r, g, b] = String(c).split(",").map(Number);
  return 0.3 * r + 0.59 * g + 0.11 * b > 225;
};
const segmentiDi = (t) => {
  const out = [];
  for (let i = 1; i < t.punti.length; i++) {
    const [a, b] = [t.punti[i - 1], t.punti[i]];
    if (a[0] !== b[0] || a[1] !== b[1]) out.push([a[0], a[1], b[0], b[1]]);
  }
  return out;
};

/**
 * Le scritte disegnate (macchioline piene in fila) fra i tratti pieni:
 * l'insieme dei loro indici.
 */
function scritteDisegnate(pieni) {
  const alta = 5 * MM,
    minuscola = 1.2 * MM;
  const cand = pieni
    .map((t, i) => ({ i, r: riquadroDi(t.punti), t }))
    .filter(({ r }) => Math.max(r.x1 - r.x0, r.y1 - r.y0) <= alta);
  /* i pezzi di una lettera hanno lo stesso percorso: la lettera e' la loro unione */
  const lettere = new Map();
  for (const c of cand) {
    const l = lettere.get(c.t.percorso);
    if (l) {
      l.r = {
        x0: Math.min(l.r.x0, c.r.x0),
        y0: Math.min(l.r.y0, c.r.y0),
        x1: Math.max(l.r.x1, c.r.x1),
        y1: Math.max(l.r.y1, c.r.y1),
      };
      l.i.push(c.i);
    } else lettere.set(c.t.percorso, { r: { ...c.r }, i: [c.i] });
  }
  const tutte = [...lettere.values()].filter(
    (l) => Math.max(l.r.x1 - l.r.x0, l.r.y1 - l.r.y0) <= alta,
  );
  const centri = tutte.map((l) => [(l.r.x0 + l.r.x1) / 2, (l.r.y0 + l.r.y1) / 2]);
  const vicine = secchi(
    centri.map(([x, y]) => [x, y, x, y]),
    alta,
  );
  const testo = new Set(),
    segni = [];
  tutte.forEach((l, k) => {
    const h = Math.max(l.r.y1 - l.r.y0, l.r.x1 - l.r.x0);
    if (h < minuscola) {
      segni.push(centri[k]);
      return;
    }
    /* una lettera ha una vicina di misura simile, sulla stessa riga o colonna */
    for (const j of vicine.vicini(centri[k][0], centri[k][1], h * 1.6)) {
      if (j === k) continue;
      const q = tutte[j],
        hq = Math.max(q.r.y1 - q.r.y0, q.r.x1 - q.r.x0);
      if (hq < minuscola * 0.6 || hq > h * 2.5 || h > hq * 2.5) continue;
      const dx = Math.abs(centri[j][0] - centri[k][0]),
        dy = Math.abs(centri[j][1] - centri[k][1]);
      /* accanto, non sopra: la tacca di una quota e' spesso disegnata due
       * volte nello stesso punto, e non per questo e' una scritta */
      if (Math.max(dx, dy) < h * 0.3) continue;
      if (Math.min(dx, dy) <= h * 0.6 && Math.max(dx, dy) <= h * 1.6) {
        for (const i of l.i) testo.add(i);
        return;
      }
    }
  });
  return { testo, segni, lettere: tutte.filter((l) => l.i.some((i) => testo.has(i))) };
}

/**
 * I ruoli dei tratti di una pagina, la scala e la casa.
 *
 * `pagina`: quello che torna `tracciatiDellaPagina` (con `larghezza` e
 * `altezza` della pagina in punti); `scritte`: il testo della pagina
 * `[{ t, x, y, h }]` in punti (y verso il basso), quando il PDF lo ha.
 *
 * Torna `null` se la pagina non ha tratti da disegno tecnico; altrimenti
 * `{ scala, scalaDa, metriPerPunto, muri, sicuro, ... }`. Se i muri non si
 * riconoscono (niente retino ne' campiture) `muri` e' `null` ma la scala,
 * se trovata, c'e' lo stesso: serve alla strada della foto.
 */
export function piantaDalPdf(pagina, { scritte = [] } = {}) {
  const tratti = pagina?.tratti || [];
  if (tratti.length < 20) return null;
  const pieni = tratti.filter((t) => t.pieno && !chiaro(t.colore));
  const fili = tratti.filter((t) => !t.pieno && !chiaro(t.colore));
  const disegnate = scritteDisegnate(pieni);
  const testoPieno = new Set([...disegnate.testo].map((i) => pieni[i]));
  /* Niente testo, ma lettere disegnate: si leggono (scritte-disegnate.js).
   * Si tengono le righe lette con sicurezza. */
  let lette = false;
  if (!(scritte || []).some((q) => String(q.t || "").trim())) {
    /* le figure piccole, anche i puntini: la virgola di «14,72» */
    const piccole = pieni.filter((t) => {
      const r = riquadroDi(t.punti);
      return Math.max(r.x1 - r.x0, r.y1 - r.y0) <= 5 * MM;
    });
    if (piccole.length >= 30 && piccole.length <= 60000) {
      scritte = leggiLeScritte(
        piccole.map((t) => ({ poligoni: [t.punti], percorso: t.percorso })),
      ).filter((q) => q.sicurezza >= 0.4);
      lette = scritte.length > 0;
    }
  }

  /* i segmenti dei fili, con la loro penna */
  const penne = new Map();
  const segs = [];
  for (const t of fili) {
    const k = chiaveDi(t);
    if (!penne.has(k)) penne.set(k, { k, spessore: t.spessore, tratteggiata: t.tratteggio, n: 0 });
    const p = penne.get(k);
    for (const s of segmentiDi(t)) {
      segs.push({ s, p: k, t, l: lunghezza(s) });
      p.n++;
    }
  }
  if (segs.length < 20) return null;

  /* il retino: righe oblique e parallele, fitte */
  const retino = new Set();
  for (const p of penne.values()) {
    const miei = segs.filter((g) => g.p === p.k);
    if (miei.length < 30) continue;
    const obl = miei.filter((g) => obliquo(g.s));
    if (obl.length < miei.length * 0.5) continue;
    const istogramma = new Map();
    for (const g of obl) {
      const b = Math.round(angolo(g.s) / 5) % 36;
      istogramma.set(b, (istogramma.get(b) || 0) + 1);
    }
    const picchi = [...istogramma].sort((a, b) => b[1] - a[1]);
    const [b0, n0] = picchi[0];
    if (n0 < obl.length * 0.45) continue;
    const vicinoA = (g, b) => {
      const d = Math.abs(Math.round(angolo(g.s) / 5) - b) % 36;
      return Math.min(d, 36 - d) <= 1;
    };
    const b1 = picchi.find(([b, n]) => Math.abs(b - b0) > 3 && n >= obl.length * 0.25)?.[0];
    for (const g of obl) if (vicinoA(g, b0) || (b1 !== undefined && vicinoA(g, b1))) retino.add(g);
  }

  /* le tacche delle quote: i segni pieni minuscoli e i trattini obliqui corti */
  const tacche = [...disegnate.segni];
  /* le tacche vere e proprie (non i puntini delle scritte): servono a
   * dividere una riga di quota nei suoi tratti */
  const taccheVere = [];
  for (const g of segs) {
    if (retino.has(g)) continue;
    if (g.l <= 3 * MM && obliquo(g.s)) {
      const c = [(g.s[0] + g.s[2]) / 2, (g.s[1] + g.s[3]) / 2];
      tacche.push(c);
      taccheVere.push(c);
    }
  }
  for (const t of pieni) {
    if (testoPieno.has(t)) continue;
    const r = riquadroDi(t.punti),
      lato = Math.max(r.x1 - r.x0, r.y1 - r.y0),
      c = [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
    if (lato <= 2 * MM) tacche.push(c);
    if (lato >= 0.7 * MM && lato <= 2.5 * MM) taccheVere.push(c);
  }
  const taccheVicine = secchi(
    tacche.map(([x, y]) => [x, y, x, y]),
    2 * MM,
  );
  const conTacca = (x, y) => {
    for (const i of taccheVicine.vicini(x, y, 1.2 * MM)) {
      const [tx, ty] = tacche[i];
      if (Math.hypot(tx - x, ty - y) <= 1.2 * MM) return true;
    }
    return false;
  };
  /* le penne delle quote: tante righe lunghe con la tacca in cima */
  const quote = new Set();
  for (const p of penne.values()) {
    const lunghi = segs.filter((g) => g.p === p.k && !retino.has(g) && g.l >= 4 * MM);
    if (lunghi.length < 4) continue;
    const segnati = lunghi.filter(
      (g) => conTacca(g.s[0], g.s[1]) || conTacca(g.s[2], g.s[3]),
    ).length;
    if (segnati >= lunghi.length * 0.3) quote.add(p.k);
  }

  /* la penna dei muri: quella che il retino tocca coi suoi capi */
  const contorni = segs.filter((g) => !retino.has(g) && !quote.has(g.p));
  const indice = secchi(
    contorni.map((g) => g.s),
    3 * MM,
  );
  const tocchi = new Map();
  let capi = 0;
  for (const g of retino) {
    for (const [x, y] of [
      [g.s[0], g.s[1]],
      [g.s[2], g.s[3]],
    ]) {
      capi++;
      const viste = new Set();
      for (const i of indice.vicini(x, y, 1.5)) {
        const c = contorni[i],
          tol = Math.max(0.6, c.t.spessore * 0.75 + 0.3);
        if (viste.has(c.p) || distanzaDalSegmento(x, y, c.s) > tol) continue;
        viste.add(c.p);
        tocchi.set(c.p, (tocchi.get(c.p) || 0) + 1);
      }
    }
  }
  /* una penna a trattini (le righe a tratto e punto dei confini) non e' un
   * muro, anche se corre lungo il muro */
  for (const p of penne.values()) {
    const miei = segs.filter((g) => g.p === p.k && !retino.has(g));
    const corti = miei.filter((g) => g.l < 4 * MM).length;
    if (p.tratteggiata || (miei.length >= 10 && corti >= miei.length * 0.6)) tocchi.delete(p.k);
  }
  const migliore = Math.max(0, ...tocchi.values());
  const penneDeiMuri = new Set(
    [...tocchi].filter(([, n]) => n >= Math.max(10, migliore * 0.15, capi * 0.04)).map(([k]) => k),
  );

  /* le campiture piene grandi (muri pieni, quando non c'e' il retino) */
  const campiture = pieni.filter((t) => {
    if (testoPieno.has(t)) return false;
    const r = riquadroDi(t.punti);
    return Math.max(r.x1 - r.x0, r.y1 - r.y0) > 2 * MM;
  });

  /* ── la scala ─────────────────────────────────────────────────────── */
  const testoDellaPagina = (scritte || []).map((s) => s.t).join(" ");
  /* letta dalle lettere disegnate, i due punti possono sembrare un punto:
   * «scala 1.50» */
  const scritta =
    scalaScritta(testoDellaPagina) ||
    (lette ? Number(/scal[ae]\s*1\s*[:.,;]?\s*(\d{2,3})\b/i.exec(testoDellaPagina)?.[1] || 0) : 0);

  /* gli archi delle porte, anche tratteggiati: pezzi corti o curvi che si
   * toccano in cima e girano piano (un trattino dopo l'altro), un quarto di
   * giro */
  const archi = [];
  {
    const delRetino = new Set([...retino].map((g) => g.t));
    const pezzi = fili.filter((t) => {
      const k = chiaveDi(t);
      if (quote.has(k) || penneDeiMuri.has(k) || t.chiuso || delRetino.has(t)) return false;
      const l = segmentiDi(t).reduce((a, s) => a + lunghezza(s), 0);
      if (l < 0.3 * MM) return false;
      return l <= 8 * MM || t.curvo;
    });
    /* la direzione con cui un pezzo arriva a un capo (verso fuori) */
    const verso = (t, fine) => {
      const P = t.punti,
        n = P.length;
      const [a, b] = fine ? [P[Math.max(0, n - 3)], P[n - 1]] : [P[Math.min(n - 1, 2)], P[0]];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    };
    const padre = pezzi.map((_, i) => i);
    const radice = (i) => (padre[i] === i ? i : (padre[i] = radice(padre[i])));
    const tuttiICapi = [];
    pezzi.forEach((t, i) => {
      const a = t.punti[0],
        b = t.punti[t.punti.length - 1];
      tuttiICapi.push([a[0], a[1], a[0], a[1], i, verso(t, false)]);
      tuttiICapi.push([b[0], b[1], b[0], b[1], i, verso(t, true)]);
    });
    const vicini = secchi(tuttiICapi, 3 * MM);
    tuttiICapi.forEach(([x, y, , , i, u]) => {
      for (const j of vicini.vicini(x, y, 1.6 * MM)) {
        const [qx, qy, , , q, v] = tuttiICapi[j];
        if (q === i || Math.hypot(qx - x, qy - y) > 1.6 * MM) continue;
        /* due capi che si guardano: le direzioni quasi opposte (entro 35°) */
        if (u[0] * v[0] + u[1] * v[1] > -Math.cos((35 * Math.PI) / 180)) continue;
        const a = radice(i),
          b = radice(q);
        if (a !== b) padre[a] = b;
      }
    });
    const gruppi = new Map();
    pezzi.forEach((t, i) => {
      const r = radice(i);
      if (!gruppi.has(r)) gruppi.set(r, []);
      gruppi.get(r).push(t);
    });
    for (const g of gruppi.values()) {
      const punti = g.flatMap((t) => t.punti);
      if (punti.length < 5) continue;
      const lungo = g.reduce((a, t) => a + segmentiDi(t).reduce((b, s) => b + lunghezza(s), 0), 0);
      if (lungo < 5 * MM) continue;
      const c = cerchio(punti);
      if (!c || c.scarto > 0.06 || c.giro < 55 || c.giro > 125) continue;
      if (c.r < 4 * MM) continue;
      archi.push({ ...c, pezzi: g });
    }
  }
  const raggi = archi.map((a) => a.r);
  const metri = (pt, S) => (pt / MM / 1000) * S;
  let dalleporte = 0;
  {
    let meglio = -1;
    for (const S of SCALE_DI_SERIE) {
      const ok = raggi.filter((r) => metri(r, S) >= 0.55 && metri(r, S) <= 1.05);
      if (ok.length < 2) continue;
      const mediana = ok.map((r) => metri(r, S)).sort((a, b) => a - b)[ok.length >> 1];
      const punti = ok.length - Math.abs(mediana - 0.8);
      if (punti > meglio) {
        meglio = punti;
        dalleporte = S;
      }
    }
  }

  /* lo spessore dei tramezzi (8-12 cm), dalle righe parallele dei muri */
  let daiTramezzi = 0;
  const segMuri = segs.filter((g) => penneDeiMuri.has(g.p));
  if (segMuri.length >= 6) {
    const istogramma = new Map();
    for (const oriz of [true, false]) {
      const dritti = segMuri
        .filter((g) => (oriz ? Math.abs(g.s[1] - g.s[3]) < 0.3 : Math.abs(g.s[0] - g.s[2]) < 0.3))
        .filter((g) => g.l >= 3 * MM)
        .map((g) =>
          oriz
            ? { q: g.s[1], a: Math.min(g.s[0], g.s[2]), b: Math.max(g.s[0], g.s[2]) }
            : { q: g.s[0], a: Math.min(g.s[1], g.s[3]), b: Math.max(g.s[1], g.s[3]) },
        )
        .sort((p, q) => p.q - q.q);
      for (let i = 0; i < dritti.length; i++)
        for (let j = i + 1; j < dritti.length; j++) {
          const d = dritti[j].q - dritti[i].q;
          if (d > 20 * MM) break;
          if (d < 0.4 * MM) continue;
          const sopra = Math.min(dritti[i].b, dritti[j].b) - Math.max(dritti[i].a, dritti[j].a);
          if (sopra < 3 * MM) continue;
          const b = Math.round(d / (0.1 * MM));
          istogramma.set(b, (istogramma.get(b) || 0) + sopra);
        }
    }
    const tutti = [...istogramma].sort((a, b) => a[0] - b[0]);
    const max = Math.max(0, ...tutti.map(([, v]) => v));
    /* il primo picco forte, dal piu' sottile */
    const picco = tutti.find(([b, v]) => {
      if (v < max * 0.2) return false;
      const vicini = tutti.filter(([q]) => Math.abs(q - b) <= 1);
      return vicini.every(([, w]) => w <= v);
    });
    if (picco) {
      const dmm = picco[0] * 0.1;
      let meglio = Infinity;
      for (const S of SCALE_DI_SERIE) {
        const m = (dmm * S) / 1000;
        const scarto = Math.abs(Math.log(m / 0.1));
        if (m >= 0.07 && m <= 0.15 && scarto < meglio) {
          meglio = scarto;
          daiTramezzi = S;
        }
      }
    }
  }

  /* le quote scritte: il numero («3.38») sopra un tratto di quota fra due
   * tacche dice quanti metri e' lungo quel tratto. E' la misura piu' diretta
   * che il disegno ha: vale anche per un foglio stampato «adattato alla
   * pagina», dove la scala scritta non e' piu' quella vera. */
  let daiQuote = 0,
    coppieDiQuote = 0;
  {
    const numeri = (scritte || [])
      .filter((q) => (q.sicurezza ?? 1) >= 0.55)
      .map((q) => ({ t: String(q.t || "").trim(), q }))
      .filter(({ t }) => /^\d{1,2}[.,]\d{1,2}$/.test(t))
      .map(({ t, q }) => ({
        v: Number(t.replace(",", ".")),
        x: q.x + (q.w || 0) / 2,
        y: q.y - (q.h || 0) / 2,
      }))
      .filter((n) => n.v >= 0.5 && n.v <= 40);
    const rapporti = [];
    if (numeri.length >= 3)
      for (const g of segs) {
        if (!quote.has(g.p) || g.l < 6 * MM || Math.abs(g.s[1] - g.s[3]) > 0.3) continue;
        const y = (g.s[1] + g.s[3]) / 2,
          x0 = Math.min(g.s[0], g.s[2]),
          x1 = Math.max(g.s[0], g.s[2]);
        /* le tacche lungo la riga: i capi dei tratti */
        const capiQ = [x0, x1];
        for (const [tx, ty] of taccheVere)
          if (Math.abs(ty - y) <= 0.45 * MM && tx > x0 + MM && tx < x1 - MM) capiQ.push(tx);
        capiQ.sort((a, b) => a - b);
        for (let i = 1; i < capiQ.length; i++) {
          const a = capiQ[i - 1],
            b = capiQ[i];
          if (b - a < 4 * MM) continue;
          const sopra = numeri.filter(
            (n) =>
              n.x > a + (b - a) * 0.2 && n.x < b - (b - a) * 0.2 && Math.abs(n.y - y) <= 5 * MM,
          );
          if (sopra.length === 1) rapporti.push(sopra[0].v / (b - a));
        }
      }
    if (rapporti.length >= 3) {
      rapporti.sort((a, b) => a - b);
      const mediana = rapporti[rapporti.length >> 1];
      const vicini = rapporti.filter((r) => Math.abs(r / mediana - 1) <= 0.04);
      if (vicini.length >= Math.max(3, rapporti.length * 0.6)) {
        daiQuote = vicini.reduce((a, r) => a + r, 0) / vicini.length;
        coppieDiQuote = vicini.length;
      }
    }
  }

  let scala = 0,
    scalaDa = "";
  /* La scala scritta puo' essere sbagliata (un cartiglio copiato da un'altra
   * tavola) o letta male dalle lettere disegnate: se le porte e i tramezzi
   * dicono tutti e due la stessa cosa, e non e' quella scritta, vale il
   * disegno. Il resto (una stampa «adattata alla pagina») lo correggono poi
   * le aree scritte nelle stanze. */
  const scrittaBuona =
    scritta && !(dalleporte && dalleporte === daiTramezzi && scritta !== dalleporte);
  if (scrittaBuona) [scala, scalaDa] = [scritta, "scritta"];
  else if (dalleporte) [scala, scalaDa] = [dalleporte, "porte"];
  else if (daiTramezzi) [scala, scalaDa] = [daiTramezzi, "muri"];
  let metriPerPunto = scala ? (0.0254 / 72) * scala : 0;
  /* le quote: se confermano (entro il 4%) la scala e' sicura; se dicono
   * altro, valgono loro (anche una scala che non e' di serie) */
  let confermata = false;
  if (daiQuote) {
    const S = daiQuote / (0.0254 / 72);
    if (scala && Math.abs(S / scala - 1) <= 0.04) confermata = true;
    else {
      const diSerie = SCALE_DI_SERIE.find((q) => Math.abs(S / q - 1) <= 0.03);
      scala = diSerie || Math.round(S);
      metriPerPunto = diSerie ? (0.0254 / 72) * diSerie : daiQuote;
      scalaDa = "quote";
      confermata = true;
    }
  }
  const base = {
    scala,
    scalaDa,
    metriPerPunto,
    indizi: {
      scritta,
      porte: dalleporte,
      muri: daiTramezzi,
      archi: archi.length,
      quote: daiQuote ? Math.round(daiQuote / (0.0254 / 72)) : 0,
      coppieDiQuote,
    },
    lettere: disegnate.lettere.length,
    scritteLette: lette ? scritte.length : 0,
    penne: {
      retino: [...new Set([...retino].map((g) => g.p))],
      quote: [...quote],
      muri: [...penneDeiMuri],
    },
  };
  const conMuri = penneDeiMuri.size > 0 || campiture.length >= 4;
  if (!scala || !conMuri) return { ...base, muri: null, sicuro: false };

  /* ── i muri ───────────────────────────────────────────────────────── */
  const m = metriPerPunto;
  let muri = segs.filter((g) => penneDeiMuri.has(g.p)).map((g) => ({ s: g.s, w: g.t.spessore }));
  const tratteggio = [...retino].map((g) => ({ s: g.s, w: g.t.spessore }));
  const piene = penneDeiMuri.size ? [] : campiture.map((t) => t.punti);

  /* i vani: un riquadro con le due diagonali (ascensore, cavedio) */
  const vani = [];
  {
    const diag = muri.filter((g) => obliquo(g.s) && g.s && lunghezza(g.s) * m >= 0.6);
    const via = new Set();
    for (let i = 0; i < diag.length; i++)
      for (let j = i + 1; j < diag.length; j++) {
        const a = diag[i].s,
          b = diag[j].s;
        const la = lunghezza(a),
          lb = lunghezza(b);
        if (la > lb * 1.4 || lb > la * 1.4) continue;
        const ma = [(a[0] + a[2]) / 2, (a[1] + a[3]) / 2],
          mb = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
        if (Math.hypot(ma[0] - mb[0], ma[1] - mb[1]) > Math.min(la, lb) * 0.15) continue;
        const r = riquadroDi([
          [a[0], a[1]],
          [a[2], a[3]],
          [b[0], b[1]],
          [b[2], b[3]],
        ]);
        vani.push(r);
        via.add(diag[i]).add(diag[j]);
      }
    muri = muri.filter((g) => !via.has(g));
  }

  /* una griglia dei muri da 2 cm, in punti, per le domande di vicinanza */
  const passo = 0.02 / m;
  const tuttiIMuri = [...muri, ...tratteggio];
  const rq = riquadroDi(
    tuttiIMuri
      .flatMap((g) => [
        [g.s[0], g.s[1]],
        [g.s[2], g.s[3]],
      ])
      .concat(piene.flat()),
  );
  const ox = rq.x0 - 2 / m,
    oy = rq.y0 - 2 / m;
  const GW = Math.ceil((rq.x1 - rq.x0 + 4 / m) / passo) + 1,
    GH = Math.ceil((rq.y1 - rq.y0 + 4 / m) / passo) + 1;
  if (GW * GH > 30_000_000) return { ...base, muri: null, sicuro: false };
  const griglia = new Uint8Array(GW * GH);
  const tira = (s, r = 0) => {
    const l = lunghezza(s),
      n = Math.max(1, Math.ceil(l / (passo * 0.5)));
    for (let k = 0; k <= n; k++) {
      const x = Math.round((s[0] + ((s[2] - s[0]) * k) / n - ox) / passo),
        y = Math.round((s[1] + ((s[3] - s[1]) * k) / n - oy) / passo);
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const X = x + dx,
            Y = y + dy;
          if (X >= 0 && Y >= 0 && X < GW && Y < GH) griglia[Y * GW + X] = 1;
        }
    }
  };
  for (const g of tuttiIMuri) tira(g.s);
  for (const poli of piene) riempiPoligono(griglia, GW, GH, poli, ox, oy, passo);
  /* chiusa: fra il contorno e il retino non resta bianco */
  const pieno = chiudi(griglia, GW, GH, 2);

  /* la casa: il gruppo di muri piu' grande, uniti fino a un metro */
  const unione = allargaB(pieno, GW, GH, Math.round(0.5 / 0.02));
  const etichetta = new Int32Array(GW * GH).fill(-1);
  const gruppi = [];
  for (let i = 0; i < GW * GH; i++) {
    if (!unione[i] || etichetta[i] >= 0) continue;
    const k = gruppi.length,
      pila = [i];
    etichetta[i] = k;
    let n = 0;
    while (pila.length) {
      const c = pila.pop(),
        x = c % GW;
      if (pieno[c]) n++;
      for (const j of [x > 0 ? c - 1 : -1, x < GW - 1 ? c + 1 : -1, c - GW, c + GW])
        if (j >= 0 && j < GW * GH && unione[j] && etichetta[j] < 0) {
          etichetta[j] = k;
          pila.push(j);
        }
    }
    gruppi.push(n);
  }
  const casa = gruppi.indexOf(Math.max(...gruppi));
  let cx0 = GW,
    cy0 = GH,
    cx1 = -1,
    cy1 = -1;
  for (let i = 0; i < GW * GH; i++)
    if (pieno[i] && etichetta[i] === casa) {
      const x = i % GW,
        y = (i / GW) | 0;
      if (x < cx0) cx0 = x;
      if (x > cx1) cx1 = x;
      if (y < cy0) cy0 = y;
      if (y > cy1) cy1 = y;
    }
  /* fuori dal riquadro della casa i muri non sono della casa; dentro si',
   * anche un pezzo da solo (il muretto fra due finestre larghe) */
  {
    const m30 = Math.round(0.3 / 0.02);
    for (let i = 0; i < GW * GH; i++) {
      if (!pieno[i] || etichetta[i] === casa) continue;
      const x = i % GW,
        y = (i / GW) | 0;
      if (x < cx0 - m30 || x > cx1 + m30 || y < cy0 - m30 || y > cy1 + m30) pieno[i] = 0;
    }
  }
  /* i muri della casa; attorno, tre metri per i balconi (il riquadro vero
   * si fa alla fine, coi parapetti) */
  const deiMuri = {
    x0: ox + cx0 * passo,
    y0: oy + cy0 * passo,
    x1: ox + (cx1 + 1) * passo,
    y1: oy + (cy1 + 1) * passo,
  };
  const largo = 3 / m;
  const dentro = (x, y) =>
    x >= deiMuri.x0 - largo &&
    x <= deiMuri.x1 + largo &&
    y >= deiMuri.y0 - largo &&
    y <= deiMuri.y1 + largo;
  const segDentro = (s) => dentro(s[0], s[1]) && dentro(s[2], s[3]);
  const muroIn = (x, y) => {
    const X = Math.round((x - ox) / passo),
      Y = Math.round((y - oy) / passo);
    return X >= 0 && Y >= 0 && X < GW && Y < GH && pieno[Y * GW + X] === 1;
  };

  /* ── porte, finestre, parapetti ──────────────────────────────────── */
  const altri = segs.filter(
    (g) => !retino.has(g) && !quote.has(g.p) && !penneDeiMuri.has(g.p) && segDentro(g.s) && g.l > 0,
  );
  /* le porte: gli archi vicini a un muro, con raggio da porta. Della porta
   * si segna la soglia: dalla cerniera al capo dell'arco che sta nel muro
   * (l'anta chiusa). L'arco non si segna: entra nella stanza, e vicino a un
   * passaggio largo lo farebbe chiudere come fosse una porta. */
  const porte = [],
    spessori = [],
    sulDisegno = [],
    archiDellePorte = [];
  for (const a of archi) {
    const r = a.r * m;
    if (r < 0.4 || r > 1.3 || !dentro(a.cx, a.cy)) continue;
    const punti = a.pezzi.flatMap((t) => t.punti);
    const ang = punti.map(([x, y]) => Math.atan2(y - a.cy, x - a.cx)).sort((p, q) => p - q);
    let buco = ang[0] + 2 * Math.PI - ang[ang.length - 1],
      dopo = ang[0];
    for (let i = 1; i < ang.length; i++)
      if (ang[i] - ang[i - 1] > buco) {
        buco = ang[i] - ang[i - 1];
        dopo = ang[i];
      }
    const inizio = dopo,
      fine = dopo + (2 * Math.PI - buco);
    let soglia = null;
    for (const t of [inizio, fine]) {
      const ux = Math.cos(t),
        uy = Math.sin(t);
      const ex = a.cx + ux * a.r,
        ey = a.cy + uy * a.r;
      const oltre = [0.04, 0.1, 0.18].some((d) => muroIn(ex + (ux * d) / m, ey + (uy * d) / m));
      const dietro = [0.04, 0.1, 0.18].some((d) =>
        muroIn(a.cx - (ux * d) / m, a.cy - (uy * d) / m),
      );
      if (oltre && dietro) soglia = [a.cx, a.cy, ex, ey];
    }
    if (!soglia) continue;
    sulDisegno.push(soglia);
    /* la soglia in mezzo allo spessore del muro: l'arco parte dallo spigolo
     * dello stipite (la faccia del muro), la porta sta nel muro */
    {
      const l = lunghezza(soglia) || 1,
        ux = (soglia[2] - soglia[0]) / l,
        uy = (soglia[3] - soglia[1]) / l,
        nx = -uy,
        ny = ux;
      /* i due stipiti, 6 cm dentro il muro */
      const capi = [
        [soglia[0] - (ux * 0.06) / m, soglia[1] - (uy * 0.06) / m],
        [soglia[2] + (ux * 0.06) / m, soglia[3] + (uy * 0.06) / m],
      ];
      const fondo = (verso) => {
        let t = 0;
        while (
          t < 0.6 &&
          capi.every(([x, y]) =>
            muroIn(x + (verso * nx * (t + 0.02)) / m, y + (verso * ny * (t + 0.02)) / m),
          )
        )
          t += 0.02;
        return t;
      };
      const sposta = (fondo(1) - fondo(-1)) / 2;
      spessori.push(Math.max(0.08, fondo(1) + fondo(-1)));
      if (sposta) {
        const dx = (nx * sposta) / m,
          dy = (ny * sposta) / m;
        soglia = [soglia[0] + dx, soglia[1] + dy, soglia[2] + dx, soglia[3] + dy];
      }
    }
    porte.push(soglia);
    archiDellePorte.push(a);
  }
  const nellePorte = new Set(
    archiDellePorte.flatMap((a) => a.pezzi.flatMap((t) => segmentiDi(t).map((q) => q.join(",")))),
  );
  const sullaSoglia = (q) =>
    [...porte, ...sulDisegno].some(
      (p) =>
        distanzaDalSegmento(q[0], q[1], p) * m <= 0.08 &&
        distanzaDalSegmento(q[2], q[3], p) * m <= 0.08,
    );

  /* le righe dritte, unite quando stanno in fila (i vetri a piu' ante, le
   * righe spezzate) */
  const righe = unisciInFila(
    altri.filter((g) => !nellePorte.has(g.s.join(",")) && !obliquo(g.s)).map((g) => g.s),
    0.01 / m,
  ).filter((s) => lunghezza(s) * m >= 0.25);

  /* il muro continua oltre il capo, in fila: (x, y) e' il capo, (ux, uy) la
   * direzione verso fuori dalla riga */
  const muroOltre = (x, y, ux, uy) =>
    [0.06, 0.12, 0.2].some((d) => muroIn(x + (ux * d) / m, y + (uy * d) / m)) &&
    [0.3, 0.4].some((d) => muroIn(x + (ux * d) / m, y + (uy * d) / m));
  const vetri = [],
    resto = [];
  for (const s of righe) {
    const l = lunghezza(s),
      ux = (s[2] - s[0]) / l,
      uy = (s[3] - s[1]) / l;
    const mx = (s[0] + s[2]) / 2,
      my = (s[1] + s[3]) / 2;
    if (sullaSoglia(s)) continue;
    if (
      l * m <= 5 &&
      !muroIn(mx, my) &&
      muroOltre(s[2], s[3], ux, uy) &&
      muroOltre(s[0], s[1], -ux, -uy)
    )
      vetri.push(s);
    else resto.push(s);
  }
  /* il fuori: dal bordo, senza passare per i muri, i vetri e le soglie
   * (e coi varchi fino a 90 cm chiusi: un passaggio senza porta disegnata) */
  const chiusoLargo = pieno.slice();
  {
    const segna = (q) => {
      const l = lunghezza(q),
        n = Math.max(1, Math.ceil(l / (passo * 0.5)));
      for (let k = 0; k <= n; k++) {
        const X = Math.round((q[0] + ((q[2] - q[0]) * k) / n - ox) / passo),
          Y = Math.round((q[1] + ((q[3] - q[1]) * k) / n - oy) / passo);
        if (X >= 0 && Y >= 0 && X < GW && Y < GH) chiusoLargo[Y * GW + X] = 1;
      }
    };
    for (const q of [...vetri, ...porte]) segna(q);
  }
  const chiusoFuori = allargaB(chiusoLargo, GW, GH, Math.round(0.45 / 0.02));
  const fuori = new Uint8Array(GW * GH);
  {
    const pila = [];
    const semina = (i) => {
      if (!fuori[i] && !chiusoFuori[i]) {
        fuori[i] = 1;
        pila.push(i);
      }
    };
    for (let x = 0; x < GW; x++) {
      semina(x);
      semina((GH - 1) * GW + x);
    }
    for (let y = 0; y < GH; y++) {
      semina(y * GW);
      semina(y * GW + GW - 1);
    }
    while (pila.length) {
      const c = pila.pop(),
        x = c % GW;
      for (const j of [x > 0 ? c - 1 : -1, x < GW - 1 ? c + 1 : -1, c - GW, c + GW])
        if (j >= 0 && j < GW * GH) semina(j);
    }
  }
  /* fuori casa, o sul suo bordo: entro 70 cm dal fuori */
  const vicinoAlFuori = allargaB(fuori, GW, GH, Math.round(0.75 / 0.02));
  const fuoriCasa = (x, y) => {
    const X = Math.round((x - ox) / passo),
      Y = Math.round((y - oy) / passo);
    return X < 0 || Y < 0 || X >= GW || Y >= GH || vicinoAlFuori[Y * GW + X] === 1;
  };
  /* le ante delle porte: righe doppie anche loro, ma con un capo alla
   * cerniera */
  const anta = (q) =>
    archiDellePorte.some((a) =>
      [
        [q[0], q[1]],
        [q[2], q[3]],
      ].some(([x, y]) => Math.hypot(x - a.cx, y - a.cy) * m <= 0.15),
    );

  /* i parapetti: righe doppie (2-10 cm) di almeno 60 cm, fuori casa,
   * attaccate a un muro o a un altro parapetto */
  const doppie = resto.filter((s) => {
    if (lunghezza(s) * m < 0.6 || anta(s)) return false;
    const mx = (s[0] + s[2]) / 2,
      my = (s[1] + s[3]) / 2;
    if (!fuoriCasa(mx, my)) return false;
    const oriz = Math.abs(s[1] - s[3]) < Math.abs(s[0] - s[2]);
    return resto.some((q) => {
      if (q === s) return false;
      const qo = Math.abs(q[1] - q[3]) < Math.abs(q[0] - q[2]);
      if (qo !== oriz) return false;
      const d = oriz ? Math.abs(q[1] - s[1]) : Math.abs(q[0] - s[0]);
      if (d * m < 0.015 || d * m > 0.1) return false;
      const [a0, a1] = oriz
        ? [Math.min(s[0], s[2]), Math.max(s[0], s[2])]
        : [Math.min(s[1], s[3]), Math.max(s[1], s[3])];
      const [b0, b1] = oriz
        ? [Math.min(q[0], q[2]), Math.max(q[0], q[2])]
        : [Math.min(q[1], q[3]), Math.max(q[1], q[3])];
      return Math.min(a1, b1) - Math.max(a0, b0) >= (a1 - a0) * 0.6;
    });
  });
  /* Una riga doppia tesa fra due muri in fila (tocca il muro a tutti e due
   * i capi) non e' un parapetto: e' il telaio di una portafinestra, che il
   * controllo di prima non ha preso perche' il muro di la' e' sottile. */
  const telaio = (q) => {
    const l = lunghezza(q);
    if (!l || l * m > 4) return false;
    const ux = (q[2] - q[0]) / l,
      uy = (q[3] - q[1]) / l;
    const tocca = (x, y, vx, vy) =>
      [0.03, 0.08, 0.14].some((d) => muroIn(x + (vx * d) / m, y + (vy * d) / m));
    return tocca(q[2], q[3], ux, uy) && tocca(q[0], q[1], -ux, -uy);
  };
  const telai = new Set(doppie.filter(telaio));
  vetri.push(...telai);
  const parapetti = [];
  {
    const presi = new Set(telai);
    const attaccato = (x, y) => {
      for (const d of [0, 0.05, 0.1, 0.15])
        for (const [dx, dy] of [
          [d, 0],
          [-d, 0],
          [0, d],
          [0, -d],
        ])
          if (muroIn(x + dx / m, y + dy / m)) return true;
      return parapetti.some((p) => distanzaDalSegmento(x, y, p) * m <= 0.15);
    };
    let cambiato = true;
    while (cambiato) {
      cambiato = false;
      for (const s of doppie) {
        if (presi.has(s)) continue;
        if (attaccato(s[0], s[1]) || attaccato(s[2], s[3])) {
          presi.add(s);
          parapetti.push(s);
          cambiato = true;
        }
      }
    }
  }

  /* il riquadro: i muri e i parapetti, con un metro attorno */
  const margine = 1 / m;
  const riquadro = { ...deiMuri };
  for (const q of parapetti) {
    riquadro.x0 = Math.min(riquadro.x0, q[0], q[2]);
    riquadro.y0 = Math.min(riquadro.y0, q[1], q[3]);
    riquadro.x1 = Math.max(riquadro.x1, q[0], q[2]);
    riquadro.y1 = Math.max(riquadro.y1, q[1], q[3]);
  }
  riquadro.x0 -= margine;
  riquadro.y0 -= margine;
  riquadro.x1 += margine;
  riquadro.y1 += margine;
  const nelRiquadro = (x, y) =>
    x >= riquadro.x0 && x <= riquadro.x1 && y >= riquadro.y0 && y <= riquadro.y1;
  const segNelRiquadro = (q) => nelRiquadro(q[0], q[1]) && nelRiquadro(q[2], q[3]);

  /* ── le scritte ───────────────────────────────────────────────────── */
  /* il centro di una scritta (x, y sono il capo a sinistra sulla riga di
   * base), e se sta dentro casa: «Altra U.I.» sta fuori, e non da' il nome
   * alla stanza accanto */
  const centro = (q) => [q.x + (q.w || 0) / 2, q.y - (q.h || 0) / 2];
  const dentroCasa = (x, y) => {
    const X = Math.round((x - ox) / passo),
      Y = Math.round((y - oy) / passo);
    return X >= 0 && Y >= 0 && X < GW && Y < GH && !fuori[Y * GW + X];
  };
  const scritteDentro = (scritte || []).filter((q) => nelRiquadro(...centro(q)));
  const nomi = [],
    metriQuadri = [];
  const MQ = /(\d+(?:[.,]\d+)?)\s*(?:mq|m2|m²|m\s*q)\b/i;
  for (const q of scritteDentro) {
    const t = String(q.t || "").trim();
    const [cx, cy] = centro(q);
    const mq = MQ.exec(t);
    if (mq && dentroCasa(cx, cy) && (q.sicurezza ?? 1) >= 0.4)
      metriQuadri.push({ mq: Number(mq[1].replace(",", ".")), x: cx, y: cy });
    /* il nome, senza l'area e senza i segni rimasti attaccati (la tacca di
     * una quota letta come «x») */
    const nome = t
      .replace(/(\d+(?:[.,]\d+)?)\s*(?:mq|m2|m²|m\s*q)\b.*/i, "")
      .split(/\s+/)
      .filter((p, i, tutte) => !(/^[a-z.,:;'-]$/.test(p) && (i === 0 || i === tutte.length - 1)))
      .join(" ")
      .trim();
    if ((q.sicurezza ?? 1) < 0.6 || !eNomeDiStanza(nome)) continue;
    if (!dentroCasa(cx, cy) && !eNomeDiFuori(nome)) continue;
    nomi.push({ t: nomeDaScritta(nome), x: cx, y: cy, grezzo: nome });
  }
  /* nell'ordine in cui si leggono: «Cucina / Soggiorno» */
  nomi.sort((a, b) => a.y - b.y || a.x - b.x);

  return {
    ...base,
    riquadro,
    larghezzaMetri: (riquadro.x1 - riquadro.x0) * m,
    profonditaMetri: (riquadro.y1 - riquadro.y0) * m,
    muri: muri.filter((g) => segNelRiquadro(g.s)),
    tratteggio: tratteggio.filter((g) => segNelRiquadro(g.s)),
    piene: piene.filter((poli) => poli.every(([x, y]) => nelRiquadro(x, y))),
    vetri: vetri.filter(segNelRiquadro),
    porte: porte.filter(segNelRiquadro),
    /* le porte che danno fuori (il portoncino): da una parte della soglia,
     * a mezzo metro, c'e' il fuori. Con lo spessore del loro muro, in metri. */
    portoni: porte
      .map((q, i) => ({ s: q, spessore: spessori[i] }))
      .filter(({ s: q }) => {
        if (!segNelRiquadro(q)) return false;
        const l = lunghezza(q) || 1,
          nx = (-(q[3] - q[1]) / l) * (0.5 / m),
          ny = ((q[2] - q[0]) / l) * (0.5 / m),
          mx = (q[0] + q[2]) / 2,
          my = (q[1] + q[3]) / 2;
        return fuoriCasa(mx + nx, my + ny) || fuoriCasa(mx - nx, my - ny);
      }),
    parapetti,
    vani: vani.filter((v) => nelRiquadro((v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2)),
    nomi,
    metriQuadri,
    /* sicura se scritta, se la dicono le quote, o se due indizi diversi
     * dicono la stessa */
    sicuro: scalaDa === "scritta" || confermata || (dalleporte > 0 && dalleporte === daiTramezzi),
  };
}

/* Le righe dritte in fila (sulla stessa retta, entro `tol`, che si toccano
 * o quasi) diventano una riga sola: i vetri a piu' ante, le righe spezzate. */
function unisciInFila(segmenti, tol) {
  const oriz = [],
    vert = [],
    altri = [];
  for (const s of segmenti) {
    if (Math.abs(s[1] - s[3]) <= tol)
      oriz.push([Math.min(s[0], s[2]), Math.max(s[0], s[2]), (s[1] + s[3]) / 2]);
    else if (Math.abs(s[0] - s[2]) <= tol)
      vert.push([Math.min(s[1], s[3]), Math.max(s[1], s[3]), (s[0] + s[2]) / 2]);
    else altri.push(s);
  }
  const fondi = (lista) => {
    lista.sort((a, c) => a[2] - c[2] || a[0] - c[0]);
    const out = [];
    for (const r of lista) {
      const u = out.find(
        (q) => Math.abs(q[2] - r[2]) <= tol && r[0] <= q[1] + tol && r[1] >= q[0] - tol,
      );
      if (u) {
        u[0] = Math.min(u[0], r[0]);
        u[1] = Math.max(u[1], r[1]);
      } else out.push(r.slice());
    }
    return out;
  };
  return [
    ...fondi(oriz).map(([a, c, y]) => [a, y, c, y]),
    ...fondi(vert).map(([a, c, x]) => [x, a, x, c]),
    ...altri,
  ];
}

/* ── griglie binarie ──────────────────────────────────────────────────── */

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
function somma(I, W, x0, y0, x1, y1) {
  return I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0];
}
function allargaB(g, W, H, r) {
  const I = integrale(g, W, H),
    out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      out[y * W + x] =
        somma(
          I,
          W,
          Math.max(0, x - r),
          Math.max(0, y - r),
          Math.min(W, x + r + 1),
          Math.min(H, y + r + 1),
        ) > 0
          ? 1
          : 0;
  return out;
}
function stringiB(g, W, H, r) {
  const I = integrale(g, W, H),
    out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - r),
        y0 = Math.max(0, y - r),
        x1 = Math.min(W, x + r + 1),
        y1 = Math.min(H, y + r + 1);
      out[y * W + x] = somma(I, W, x0, y0, x1, y1) === (x1 - x0) * (y1 - y0) ? 1 : 0;
    }
  return out;
}
function chiudi(g, W, H, r) {
  const c = stringiB(allargaB(g, W, H, r), W, H, r);
  for (let i = 0; i < W * H; i++) if (g[i]) c[i] = 1;
  return c;
}
function riempiPoligono(g, W, H, poli, ox, oy, passo) {
  if (poli.length < 3) return;
  const P = poli.map(([x, y]) => [(x - ox) / passo, (y - oy) / passo]);
  const r = riquadroDi(P);
  for (let y = Math.max(0, Math.floor(r.y0)); y <= Math.min(H - 1, Math.ceil(r.y1)); y++) {
    const xs = [];
    for (let i = 0; i < P.length; i++) {
      const [a, b] = [P[i], P[(i + 1) % P.length]];
      if ((a[1] <= y + 0.5 && b[1] > y + 0.5) || (b[1] <= y + 0.5 && a[1] > y + 0.5))
        xs.push(a[0] + ((y + 0.5 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let x = Math.max(0, Math.round(xs[k])); x <= Math.min(W - 1, Math.round(xs[k + 1])); x++)
        g[y * W + x] = 1;
  }
}

/* ── 3. la tavola: i muri disegnati puliti ────────────────────────────── */

/**
 * La pianta del PDF disegnata, come la vuole il riconoscimento dei disegni
 * (`grigliaDallaFoto` con `disegno: true`): il lato lungo a `lungo` pixel.
 *
 * Torna `{ im, vetri, porte, parapetti, mpp, etichette, metriQuadri, vani }`:
 * `im` e' un'immagine `{ width, height, data }` (muri neri su bianco), le
 * altre sono mappe di pixel (1 dove c'e' la cosa), `mpp` i metri per pixel,
 * e scritte e vani in pixel della tavola.
 */
export function tavolaDalPdf(piano, lungo = 2400) {
  const { riquadro: r, metriPerPunto: m } = piano;
  const w0 = r.x1 - r.x0,
    h0 = r.y1 - r.y0;
  const k = lungo / Math.max(w0, h0);
  const W = Math.max(8, Math.round(w0 * k)),
    H = Math.max(8, Math.round(h0 * k));
  const muro = new Uint8Array(W * H),
    vetri = new Uint8Array(W * H),
    porte = new Uint8Array(W * H),
    parapetti = new Uint8Array(W * H);
  const X = (x) => (x - r.x0) * k,
    Y = (y) => (y - r.y0) * k;
  const tira = (g, s, larga) => {
    const x0 = X(s[0]),
      y0 = Y(s[1]),
      x1 = X(s[2]),
      y1 = Y(s[3]);
    const l = Math.hypot(x1 - x0, y1 - y0),
      n = Math.max(1, Math.ceil(l * 2)),
      rr = Math.max(0, (larga - 1) / 2);
    for (let q = 0; q <= n; q++) {
      const x = x0 + ((x1 - x0) * q) / n,
        y = y0 + ((y1 - y0) * q) / n;
      for (let yy = Math.floor(y - rr); yy <= Math.ceil(y + rr); yy++)
        for (let xx = Math.floor(x - rr); xx <= Math.ceil(x + rr); xx++)
          if (xx >= 0 && yy >= 0 && xx < W && yy < H && Math.hypot(xx - x, yy - y) <= rr + 0.5)
            g[yy * W + xx] = 1;
    }
  };
  const pxm = k / m; // pixel per metro
  const sottile = Math.max(1.5, 0.02 * pxm);
  for (const g of [...piano.muri, ...piano.tratteggio])
    tira(muro, g.s, Math.max(1, Math.min(g.w * k, sottile)));
  for (const poli of piano.piene) riempiPoligono(muro, W, H, poli, r.x0, r.y0, 1 / k);
  /* il retino coi suoi buchi e il contorno: si chiude fino a 3 cm */
  const chiusa = chiudi(muro, W, H, Math.max(1, Math.round(0.015 * pxm)));
  for (const s of piano.parapetti) {
    tira(chiusa, s, sottile);
    tira(parapetti, s, sottile);
  }
  for (const s of piano.vetri) tira(vetri, s, sottile);
  /* la soglia di ogni porta: una riga sottile da stipite a stipite, che il
   * riconoscimento prende per la soglia (separa le stanze, e li' mette la
   * porta). Sulla mappa delle porte resta intera. */
  for (const s of piano.porte) {
    tira(chiusa, s, 1.5);
    tira(porte, s, sottile);
  }
  const data = new Uint8ClampedArray(W * H * 4).fill(255);
  for (let i = 0; i < W * H; i++)
    if (chiusa[i]) {
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = 0;
    }
  const inPx = (s) => ({ ...s, x: X(s.x), y: Y(s.y) });
  return {
    im: { width: W, height: H, data },
    vetri,
    porte,
    parapetti,
    mpp: m / k,
    etichette: piano.nomi.map((s) => ({ t: s.t, x: X(s.x), y: Y(s.y) })),
    metriQuadri: piano.metriQuadri.map(inPx),
    vani: piano.vani.map((v) => ({ x0: X(v.x0), y0: Y(v.y0), x1: X(v.x1), y1: Y(v.y1) })),
    /* le porte disegnate (per il riconoscimento: un fronte senza soglia e'
     * un passaggio aperto) */
    archi: piano.porte.map((s) => ({ x0: X(s[0]), y0: Y(s[1]), x1: X(s[2]), y1: Y(s[3]) })),
    /* i portoncini (le porte che danno fuori), con lo spessore del muro in
     * pixel: se il riconoscimento non li vede li mette `porteDelDisegno` */
    portoni: (piano.portoni || []).map(({ s, spessore }) => ({
      x0: X(s[0]),
      y0: Y(s[1]),
      x1: X(s[2]),
      y1: Y(s[3]),
      spessore: (spessore / m) * k,
    })),
  };
}

/* ── 4. dopo il riconoscimento ────────────────────────────────────────── */

/**
 * Le porte che il disegno dice (l'arco con la sua soglia), rimesse a posto
 * dopo il riconoscimento:
 *
 *  - una porta presa per finestra (il portoncino, che da' fuori) torna porta;
 *  - un portoncino che il riconoscimento non ha visto (verso fuori la stanza
 *    si allarga nel varco, e il varco non sembra piu' un varco) si mette:
 *    le celle del varco diventano porta, e l'apertura si aggiunge.
 *
 * `tavola`: quella di `tavolaDalPdf` (`archi` e `portoni`, in pixel); `mpp`:
 * i metri per pixel. Torna una casa nuova.
 */
export function porteDelDisegno(casa, tavola, mpp = 0) {
  const archi = tavola?.archi || [],
    portoni = tavola?.portoni || [];
  if ((!archi.length && !portoni.length) || !(mpp > 0) || !casa?.tipo) return casa;
  const { W, H } = casa,
    passo = casa.passo || 0.03;
  const soglie = archi.map((a) => [a.x0 * mpp, a.y0 * mpp, a.x1 * mpp, a.y1 * mpp]);
  const tipo = Int16Array.from(casa.tipo);
  let cambiata = false;
  const aperture = (casa.aperture || []).map((a) => {
    if (a.tipo !== "finestra") return a;
    if (!soglie.some((q) => distanzaDalSegmento(a.cx, a.cy, q) <= 0.3)) return a;
    cambiata = true;
    /* le sue celle: da davanzale a porta */
    const cx = Math.floor(a.cx / passo),
      cy = Math.floor(a.cy / passo);
    const pila = [];
    for (let dy = -3; dy <= 3 && !pila.length; dy++)
      for (let dx = -3; dx <= 3 && !pila.length; dx++) {
        const x = cx + dx,
          y = cy + dy;
        if (x >= 0 && y >= 0 && x < W && y < H && tipo[y * W + x] === -4) pila.push(y * W + x);
      }
    if (pila.length) tipo[pila[0]] = -5;
    while (pila.length) {
      const c = pila.pop(),
        x = c % W;
      for (const j of [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c - W, c + W])
        if (j >= 0 && j < W * H && tipo[j] === -4) {
          tipo[j] = -5;
          pila.push(j);
        }
    }
    return { ...a, tipo: "porta", portafinestra: false };
  });
  for (const p of portoni) {
    const q = [p.x0 * mpp, p.y0 * mpp, p.x1 * mpp, p.y1 * mpp];
    const mx = (q[0] + q[2]) / 2,
      my = (q[1] + q[3]) / 2;
    if (aperture.some((a) => distanzaDalSegmento(a.cx, a.cy, q) <= 0.4)) continue;
    /* il varco: lungo la soglia, per tutto lo spessore del muro */
    const oriz = Math.abs(q[2] - q[0]) >= Math.abs(q[3] - q[1]);
    const mezzo = Math.max(passo, (p.spessore * mpp) / 2);
    const [a0, a1] = oriz
      ? [Math.min(q[0], q[2]), Math.max(q[0], q[2])]
      : [Math.min(q[1], q[3]), Math.max(q[1], q[3])];
    const centro = oriz ? my : mx;
    const stanze = new Map();
    let segnate = 0;
    for (let c = Math.floor(a0 / passo); c <= Math.floor(a1 / passo); c++)
      for (
        let d = Math.floor((centro - mezzo) / passo);
        d <= Math.floor((centro + mezzo) / passo);
        d++
      ) {
        const x = oriz ? c : d,
          y = oriz ? d : c;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const v = tipo[y * W + x];
        if (v === -3) continue;
        if (v > 0) stanze.set(v, (stanze.get(v) || 0) + 1);
        tipo[y * W + x] = -5;
        segnate++;
      }
    if (!segnate) continue;
    /* la stanza della porta: quella nel varco, o la prima che si incontra
     * uscendone */
    let stanza = [...stanze].sort((a, b) => b[1] - a[1])[0]?.[0] || 0;
    for (let r = 1; r <= 20 && !stanza; r++)
      for (const verso of [-1, 1]) {
        const x = Math.floor((oriz ? mx : mx + verso * (mezzo + r * passo)) / passo),
          y = Math.floor((oriz ? my + verso * (mezzo + r * passo) : my) / passo);
        if (x >= 0 && y >= 0 && x < W && y < H && tipo[y * W + x] > 0) stanza = tipo[y * W + x];
      }
    aperture.push({
      tipo: "porta",
      cx: mx,
      cy: my,
      largo: a1 - a0,
      orizz: oriz,
      verso: 0,
      portafinestra: false,
      stanza,
    });
    cambiata = true;
  }
  return cambiata ? { ...casa, tipo, aperture } : casa;
}

/**
 * Le stanze riconosciute che nel disegno sono una sola:
 *
 *  - due stanze che si toccano senza niente in mezzo (ne' muro, ne' soglia,
 *    ne' porta): nel PDF le porte ci sono tutte, e dove non c'e' la porta il
 *    passaggio e' aperto (l'ingresso col disimpegno, la cucina col soggiorno);
 *  - due pezzi dello stesso balcone separati da un pilastro: il riconoscimento
 *    ci mette una porta, ma su un balcone non ci sono porte.
 *
 * `barriera`: le soglie e le righe del riconoscimento (`griglia.barriera`):
 * due stanze che si toccano su una soglia restano due.
 *
 * Torna una casa nuova (la griglia e le stanze riunite).
 */
export function unisciLeStanze(casa, balconi = new Set(), barriera = null) {
  const { W, H } = casa;
  const tipo = Int16Array.from(casa.tipo);
  const N = W * H;
  const padre = new Map();
  const radice = (a) => {
    while (padre.has(a)) a = padre.get(a);
    return a;
  };
  const unisci = (a, b) => {
    const ra = radice(a),
      rb = radice(b);
    if (ra !== rb) padre.set(Math.max(ra, rb), Math.min(ra, rb));
  };
  /* stanze a contatto, lontano (piu' di 10 cm) dalle porte: accanto a una
   * porta le due stanze si toccano sempre un poco */
  const vicinoAPorta = new Uint8Array(N);
  {
    const r = Math.max(2, Math.round(0.1 / (casa.passo || 0.03)));
    for (let i = 0; i < N; i++) {
      if (tipo[i] !== -5 && tipo[i] !== -4) continue;
      const x = i % W,
        y = (i / W) | 0;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const X = x + dx,
            Y = y + dy;
          if (X >= 0 && Y >= 0 && X < W && Y < H) vicinoAPorta[Y * W + X] = 1;
        }
    }
  }
  const contatti = new Map();
  for (let y = 0; y < H - 1; y++)
    for (let x = 0; x < W - 1; x++) {
      const i = y * W + x,
        a = tipo[i];
      if (a <= 0 || barriera?.[i] || vicinoAPorta[i]) continue;
      for (const j of [i + 1, i + W]) {
        const b = tipo[j];
        if (b > 0 && b !== a && !barriera?.[j] && !vicinoAPorta[j]) {
          const k = a < b ? `${a}|${b}` : `${b}|${a}`;
          contatti.set(k, (contatti.get(k) || 0) + 1);
        }
      }
    }
  const minimo = Math.round(0.3 / (casa.passo || 0.03));
  for (const [k, n] of contatti) {
    if (n < minimo) continue;
    const [a, b] = k.split("|").map(Number);
    if (balconi.has(a) !== balconi.has(b)) continue;
    unisci(a, b);
  }
  /* i pezzi di balcone separati da una «porta»: il varco diventa balcone */
  const riempi = [];
  if (balconi.size > 1) {
    const visto = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (tipo[i] !== -5 || visto[i]) continue;
      const pezzo = [i],
        accanto = new Set();
      visto[i] = 1;
      for (let q = 0; q < pezzo.length; q++) {
        const c = pezzo[q],
          x = c % W;
        for (const j of [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c - W, c + W]) {
          if (j < 0 || j >= N) continue;
          if (tipo[j] === -5 && !visto[j]) {
            visto[j] = 1;
            pezzo.push(j);
          } else if (tipo[j] > 0) accanto.add(tipo[j]);
        }
      }
      const b = [...accanto];
      if (b.length >= 2 && b.every((v) => balconi.has(v))) {
        for (const v of b.slice(1)) unisci(b[0], v);
        riempi.push([pezzo, b[0]]);
      }
    }
  }
  if (!padre.size) return casa;
  for (const [pezzo, v] of riempi) for (const c of pezzo) tipo[c] = v;
  for (let i = 0; i < N; i++) if (tipo[i] > 0) tipo[i] = radice(tipo[i]);
  const passo = casa.passo || 0.03;
  const dentroUna = (a) => {
    const x = Math.floor(a.cx / passo),
      y = Math.floor(a.cy / passo);
    return x >= 0 && y >= 0 && x < W && y < H && tipo[y * W + x] > 0;
  };
  const stanze = [];
  for (const s of casa.stanze) {
    const r = radice(s.id);
    const gia = stanze.find((q) => q.id === r);
    if (!gia) stanze.push({ ...s, id: r, cuori: [...(s.cuori || [])] });
    else gia.cuori.push(...(s.cuori || []));
  }
  for (const s of stanze) {
    let n = 0,
      sx = 0,
      sy = 0,
      x0 = W,
      x1 = 0,
      y0 = H,
      y1 = 0;
    for (let i = 0; i < N; i++)
      if (tipo[i] === s.id) {
        const x = i % W,
          y = (i / W) | 0;
        n++;
        sx += x;
        sy += y;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    s.celle = n;
    s.area = n * passo * passo;
    s.riquadro = { x0: x0 * passo, x1: x1 * passo, y0: y0 * passo, y1: y1 * passo };
    if (n) {
      let cx = Math.round(sx / n),
        cy = Math.round(sy / n);
      if (tipo[cy * W + cx] !== s.id) {
        let d = Infinity;
        for (let i = 0; i < N; i++)
          if (tipo[i] === s.id) {
            const q = Math.hypot((i % W) - cx, ((i / W) | 0) - cy);
            if (q < d) {
              d = q;
              [cx, cy] = [i % W, (i / W) | 0];
            }
          }
      }
      s.sx = s.cx = cx * passo;
      s.sy = s.cy = cy * passo;
    }
  }
  const aperture = (casa.aperture || [])
    .filter((a) => !dentroUna(a))
    .map((a) => ({ ...a, stanza: a.stanza > 0 ? radice(a.stanza) : a.stanza }));
  return { ...casa, tipo, stanze: stanze.filter((s) => s.celle > 0), aperture };
}

/**
 * La casa senza i muri dei vani (l'ascensore, il cavedio): un muro che di qua
 * e di la' ha solo un vano e il fuori non e' un muro della casa. Quelli in
 * comune con una stanza restano.
 *
 * `vani`: gli id delle stanze che sono vani. Torna una casa nuova.
 */
export function senzaIMuriDeiVani(casa, vani = new Set()) {
  if (!vani?.size || !casa?.tipo) return casa;
  const { W, H } = casa,
    N = W * H;
  const tipo = Int16Array.from(casa.tipo);
  const lontano = Math.round(0.6 / (casa.passo || 0.03));
  const muro = (t) => t === -3 || t === -4 || t === -5;
  /* i muri (e le loro aperture) entro 60 cm di muro da un insieme di celle */
  const attorno = (parte) => {
    const d = new Int16Array(N).fill(-1);
    let giro = [];
    for (let i = 0; i < N; i++)
      if (parte(casa.tipo[i])) {
        d[i] = 0;
        giro.push(i);
      }
    for (let k = 1; k <= lontano && giro.length; k++) {
      const dopo = [];
      for (const c of giro) {
        const x = c % W;
        for (const j of [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c - W, c + W])
          if (j >= 0 && j < N && d[j] < 0 && muro(casa.tipo[j])) {
            d[j] = k;
            dopo.push(j);
          }
      }
      giro = dopo;
    }
    return d;
  };
  const dellaCasa = attorno((t) => t > 0 && !vani.has(t)),
    deiVani = attorno((t) => t > 0 && vani.has(t));
  for (let i = 0; i < N; i++) if (muro(tipo[i]) && deiVani[i] > 0 && dellaCasa[i] < 0) tipo[i] = -2;
  const passo = casa.passo || 0.03;
  const aperture = (casa.aperture || []).filter((a) => {
    const x = Math.floor(a.cx / passo),
      y = Math.floor(a.cy / passo);
    return !(
      x >= 0 &&
      y >= 0 &&
      x < W &&
      y < H &&
      tipo[y * W + x] === -2 &&
      muro(casa.tipo[y * W + x])
    );
  });
  return { ...casa, tipo, aperture };
}

/**
 * Quello che il PDF dice delle stanze riconosciute (`casa`: quello che torna
 * `riconosciDaFoto`), dalla `tavola` di `tavolaDalPdf`:
 *
 *  - `vani`: gli id delle stanze sotto un riquadro con le diagonali
 *    (ascensore, cavedio): fuori dalla casa;
 *  - `balconi`: le stanze chiuse da un parapetto (o con scritto «balcone»);
 *  - `aree`: per ogni stanza i metri quadri scritti dentro, se ci sono;
 *  - `fattore`: quanto correggere la scala perche' le aree tornino (1 se
 *    tornano entro il 10%, o se le scritte non bastano a dirlo); `confronti`
 *    quante stanze lo dicono.
 *
 * `lato`: i pixel della tavola per cella della griglia.
 */
export function stanzeDalPdf(casa, tavola, lato, nomi = {}) {
  const { W, H, tipo, stanze = [] } = casa || {};
  const vani = new Set(),
    balconi = new Set(),
    aree = {};
  if (!W || !H || !tipo) return { vani, balconi, aree, fattore: 1, confronti: 0 };
  const passo = casa.passo || 0.03;
  const stanzaIn = (px, py) => {
    const cx = Math.floor(px / lato),
      cy = Math.floor(py / lato);
    for (let r = 0; r <= Math.ceil(0.6 / passo); r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx,
            y = cy + dy;
          if (x >= 0 && y >= 0 && x < W && y < H && tipo[y * W + x] > 0) return tipo[y * W + x];
        }
    return 0;
  };
  for (const v of tavola.vani || []) {
    const id = stanzaIn((v.x0 + v.x1) / 2, (v.y0 + v.y1) / 2);
    if (id) vani.add(id);
  }
  /* le celle di ogni stanza, e quante sul bordo toccano un parapetto */
  const celle = new Map(),
    bordo = new Map(),
    sulParapetto = new Map();
  const tw = tavola.im?.width || 0;
  const parapettoVicino = (x, y) => {
    if (!tavola.parapetti || !tw) return false;
    const r = 3;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const px = Math.floor((x + 0.5 + dx) * lato),
          py = Math.floor((y + 0.5 + dy) * lato);
        if (px >= 0 && py >= 0 && px < tw && py * tw + px < tavola.parapetti.length)
          if (tavola.parapetti[py * tw + px]) return true;
      }
    return false;
  };
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const v = tipo[y * W + x];
      if (v <= 0) continue;
      celle.set(v, (celle.get(v) || 0) + 1);
      const i = y * W + x;
      if (tipo[i - 1] !== v || tipo[i + 1] !== v || tipo[i - W] !== v || tipo[i + W] !== v) {
        bordo.set(v, (bordo.get(v) || 0) + 1);
        if (parapettoVicino(x, y)) sulParapetto.set(v, (sulParapetto.get(v) || 0) + 1);
      }
    }
  for (const s of stanze) {
    const b = bordo.get(s.id) || 0;
    if (b && (sulParapetto.get(s.id) || 0) >= b * 0.15) balconi.add(s.id);
    if (eNomeDiFuori(nomi[s.id] || "") && /balcon|terrazz|loggi|balcony|terrace/i.test(nomi[s.id]))
      balconi.add(s.id);
  }
  for (const id of vani) balconi.delete(id);
  /* i metri quadri scritti: uno per stanza */
  const scritte = new Map();
  for (const q of tavola.metriQuadri || []) {
    const id = stanzaIn(q.x, q.y);
    if (!id) continue;
    if (!scritte.has(id)) scritte.set(id, []);
    scritte.get(id).push(q.mq);
  }
  const rapporti = [];
  for (const [id, mq] of scritte) {
    if (mq.length !== 1) continue;
    aree[id] = mq[0];
    const calcolata = (celle.get(id) || 0) * passo * passo;
    if (calcolata > 0.5 && mq[0] > 0.5) rapporti.push(mq[0] / calcolata);
  }
  let fattore = 1;
  if (rapporti.length >= 2) {
    const ord = rapporti.slice().sort((a, b) => a - b);
    const mediana = ord[ord.length >> 1];
    const vicini = ord.filter((r) => Math.abs(r / mediana - 1) <= 0.15).length;
    /* le aree non tornano, e lo dicono quasi tutte allo stesso modo: la
     * scala e' sbagliata di quel tanto (le aree vanno col quadrato) */
    if (Math.abs(mediana - 1) > 0.1 && vicini >= Math.max(2, rapporti.length * 0.6))
      fattore = Math.sqrt(mediana);
  }
  return { vani, balconi, aree, fattore, confronti: rapporti.length };
}
