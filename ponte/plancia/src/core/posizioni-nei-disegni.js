/* Le posizioni dentro i disegni: dove l'utente ha messo i pezzi di un disegno.
 *
 * «Vedi come poter spostare le cose anche nei disegni, tipo i tubi nel solare
 * termico, i cerchi nel flusso energetico.» La disposizione delle sezioni
 * (`cd_disposizione`) sposta i riquadri e le voci degli elenchi; dentro un
 * disegno non c'e' un ordine, c'e' un posto: il collettore sta qui, la pompa
 * li'. Questa e' la seconda casella, `cd_disegni`:
 *
 *     { "<disegno>:computer": { "<nodo>": { x, y } }, "<disegno>:telefono": {…} }
 *
 * x e y sono in percento del disegno (0–100), il punto e' il centro del nodo.
 * Il computer e il telefono hanno due disegni diversi (orizzontale e in
 * piedi), quindi due scelte: spostare la pompa sul telefono non la sposta sul
 * computer.
 *
 * Qui ci sono solo i conti — la pulizia di quello che arriva da fuori, la
 * griglia, l'allineamento con gli altri pezzi, la tastiera, un posto libero
 * quando un pezzo cade sopra un altro, e i tubi che si ridisegnano fra due
 * pezzi spostati — cosi' si provano senza un browser. Senza scelta il disegno
 * e' quello di sempre, e nessuno lo ridisegna.
 */

export const CHIAVE_DISEGNI = "cd_disegni";

/** Le due varianti di ogni disegno: il computer (orizzontale) e il telefono. */
export const VARIANTI = Object.freeze(["computer", "telefono"]);

/** La griglia: un pezzo lasciato andare si ferma ogni 2,5 % del disegno. */
export const PASSO = 2.5;

/** Il passo fine della tastiera (con Maiusc), per gli ultimi ritocchi. */
export const PASSO_FINE = 0.5;

const ID_BUONO = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const MASSIMO_NODI = 64;
const MASSIMO_DISEGNI = 64;

const tra = (n, a, b) => Math.min(b, Math.max(a, n));
const tre = (n) => Math.round(n * 1000) / 1000;
const oggetto = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);

/* ── la casella ─────────────────────────────────────────────────────────── */

/** Un punto letto da fuori: due numeri dentro il disegno, o niente. */
export function puntoPulito(punto) {
  const p = oggetto(punto);
  if (!p) return null;
  const x = typeof p.x === "number" ? p.x : Number.NaN;
  const y = typeof p.y === "number" ? p.y : Number.NaN;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: tre(tra(x, 0, 100)), y: tre(tra(y, 0, 100)) };
}

/** I nodi di una variante, rimessi in forma. */
export function posizioniPulite(mappa) {
  const uscita = {};
  let quanti = 0;
  for (const [nodo, punto] of Object.entries(oggetto(mappa) || {})) {
    if (quanti >= MASSIMO_NODI) break;
    if (!ID_BUONO.test(nodo)) continue;
    const p = puntoPulito(punto);
    if (!p) continue;
    uscita[nodo] = p;
    quanti += 1;
  }
  return uscita;
}

/** La casella di un disegno in una variante: `solare:computer`. Ogni
 * variante e' una casella a se', cosi' fra due dispositivi si fondono una per
 * una (vedi `CHIAVI_A_CASELLE`): il telefono che sposta la pompa del suo
 * disegno non rimette com'era il disegno del computer. */
export function casellaDel(disegno, variante) {
  return `${disegno}:${variante}`;
}

function casellaBuona(casella) {
  const [disegno, variante, resto] = String(casella).split(":");
  return resto === undefined && ID_BUONO.test(disegno || "") && VARIANTI.includes(variante);
}

/** Tutta la casella, rimessa in forma: le varianti che non esistono e le
 * scelte vuote non restano. */
export function disegniPuliti(tutta) {
  const uscita = {};
  let quanti = 0;
  for (const [casella, posizioni] of Object.entries(oggetto(tutta) || {})) {
    if (quanti >= MASSIMO_DISEGNI * VARIANTI.length) break;
    if (!casellaBuona(casella)) continue;
    const pulite = posizioniPulite(posizioni);
    if (!Object.keys(pulite).length) continue;
    uscita[casella] = pulite;
    quanti += 1;
  }
  return uscita;
}

/** La scelta di un disegno per una variante: vuota se non c'e'. */
export function posizioniDi(tutta, disegno, variante) {
  return posizioniPulite(oggetto(tutta)?.[casellaDel(disegno, variante)]);
}

/** La casella con la scelta di un disegno per una variante; una scelta vuota
 * la toglie. */
export function conLePosizioni(tutta, disegno, variante, posizioni) {
  const uscita = disegniPuliti(tutta);
  const casella = casellaDel(disegno, variante);
  if (!casellaBuona(casella)) return uscita;
  const pulite = posizioniPulite(posizioni);
  if (Object.keys(pulite).length) uscita[casella] = pulite;
  else delete uscita[casella];
  return uscita;
}

/** La casella senza la scelta di un disegno: di una variante, o di tutte. */
export function senzaIlDisegno(tutta, disegno, variante) {
  let uscita = disegniPuliti(tutta);
  for (const v of variante ? [variante] : VARIANTI) uscita = conLePosizioni(uscita, disegno, v, {});
  return uscita;
}

/** Una firma corta delle posizioni: uguale per due scelte uguali, vuota
 * senza scelta. */
export function firmaDellePosizioni(posizioni) {
  return Object.entries(posizioniPulite(posizioni))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([nodo, p]) => `${nodo}:${p.x},${p.y}`)
    .join(";");
}

export function stessePosizioni(a, b) {
  return firmaDellePosizioni(a) === firmaDellePosizioni(b);
}

/* ── spostare un pezzo ──────────────────────────────────────────────────── */

export function allaGriglia(valore, passo = PASSO) {
  return tre(Math.round(valore / passo) * passo);
}

/** Il centro di un pezzo tenuto dentro il disegno. `ingombro` dice quanto il
 * pezzo (con le sue etichette) si allarga intorno al centro, in percento. */
export function limita(punto, ingombro = {}) {
  const s = Math.max(0, ingombro.sinistra || 0);
  const d = Math.max(0, ingombro.destra || 0);
  const su = Math.max(0, ingombro.sopra || 0);
  const giu = Math.max(0, ingombro.sotto || 0);
  const asse = (v, prima, dopo) =>
    prima + dopo >= 100 ? tre((prima + 100 - dopo) / 2) : tre(tra(v, prima, 100 - dopo));
  return { x: asse(punto.x, s, d), y: asse(punto.y, su, giu) };
}

/** Allinea un pezzo agli altri: se il suo centro passa vicino (entro
 * `soglia`) a quello di un altro pezzo, ci si ferma sopra e una guida lo
 * dice; altrimenti si ferma sulla griglia. */
export function allinea(punto, altri = [], { soglia = 1.5, passo = PASSO } = {}) {
  const guide = [];
  const asse = (nome) => {
    let migliore = null;
    for (const altro of altri) {
      const v = altro?.[nome];
      if (typeof v !== "number") continue;
      const distanza = Math.abs(v - punto[nome]);
      if (distanza <= soglia && (!migliore || distanza < migliore.distanza))
        migliore = { valore: v, distanza };
    }
    if (migliore) {
      guide.push({ asse: nome, valore: tre(migliore.valore) });
      return tre(migliore.valore);
    }
    return allaGriglia(punto[nome], passo);
  };
  const x = asse("x");
  const y = asse("y");
  return { x, y, guide };
}

const FRECCE = Object.freeze({
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
});

/** Un pezzo spinto da una freccia: alla riga seguente della griglia, o di un
 * passo fine con Maiusc. Un tasto che non e' una freccia non sposta niente. */
export function spingi(punto, tasto, { fine = false, passo = PASSO } = {}) {
  const verso = FRECCE[tasto];
  if (!verso) return null;
  const muovi = (v, s) => {
    if (!s) return v;
    if (fine) return tre(v + s * PASSO_FINE);
    const prossima = s > 0 ? Math.floor(v / passo + 1e-6) + 1 : Math.ceil(v / passo - 1e-6) - 1;
    return tre(prossima * passo);
  };
  return { x: tra(muovi(punto.x, verso[0]), 0, 100), y: tra(muovi(punto.y, verso[1]), 0, 100) };
}

/** Il rettangolo che un pezzo occupa, dal suo centro e dal suo ingombro. */
export function rettangolo(punto, ingombro = {}) {
  return {
    x0: punto.x - (ingombro.sinistra || 0),
    x1: punto.x + (ingombro.destra || 0),
    y0: punto.y - (ingombro.sopra || 0),
    y1: punto.y + (ingombro.sotto || 0),
  };
}

export function siToccano(a, b) {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/** Un posto dove il pezzo non sta sopra un altro: quello chiesto, se e'
 * libero; se no il punto libero della griglia piu' vicino, dentro il disegno.
 * Se non ce n'e' nessuno resta dove e' stato lasciato. */
export function postoLibero(punto, ingombro, occupati = [], { passo = PASSO, giri = 16 } = {}) {
  const libero = (p) => !occupati.some((r) => siToccano(rettangolo(p, ingombro), r));
  const dentro = limita(punto, ingombro);
  if (libero(dentro)) return dentro;
  let migliore = null;
  for (let giro = 1; giro <= giri; giro += 1) {
    for (let i = -giro; i <= giro; i += 1) {
      for (const [dx, dy] of [
        [i, -giro],
        [i, giro],
        [-giro, i],
        [giro, i],
      ]) {
        const p = limita(
          {
            x: allaGriglia(dentro.x + dx * passo, passo),
            y: allaGriglia(dentro.y + dy * passo, passo),
          },
          ingombro,
        );
        if (!libero(p)) continue;
        const distanza = Math.hypot(p.x - punto.x, p.y - punto.y);
        if (!migliore || distanza < migliore.distanza) migliore = { p, distanza };
      }
    }
    if (migliore) return migliore.p;
  }
  return dentro;
}

/* ── i tubi ─────────────────────────────────────────────────────────────── *
 *
 * Fra due pezzi spostati un tubo non si puo' tenere disegnato a mano: si
 * ridisegna. Si passa da una porta all'altra (una porta e' un punto e il
 * verso in cui il tubo esce dal pezzo: e, w, n, s), attraverso i pezzi che il
 * tubo attraversa (una pompa, una valvola: un punto e l'asse, h o v), con
 * tratti diritti e angoli arrotondati. Le unita' sono quelle del disegno.
 */

const VERSI = Object.freeze({ e: [1, 0], w: [-1, 0], n: [0, -1], s: [0, 1] });
const orizzontale = (verso) => verso === "e" || verso === "w";
const uno = (n) => {
  const r = Math.round(n * 10) / 10;
  return Object.is(r, -0) ? "0" : String(r);
};

function avanti(p, verso, quanto) {
  const [vx, vy] = VERSI[verso];
  return [p[0] + vx * quanto, p[1] + vy * quanto];
}

/* Gli angoli fra P' (uscito da P verso `esce`) e Q' (davanti a Q, che guarda
 * verso `guarda`: il tubo ci arriva nel verso opposto). */
function angoli(P, esce, Q, guarda) {
  const [ex, ey] = VERSI[esce];
  const [gx, gy] = VERSI[guarda];
  if (orizzontale(esce) && orizzontale(guarda)) {
    if (Math.abs(P[1] - Q[1]) < 0.05) return [];
    const davanti = (Q[0] - P[0]) * ex > 0 && (Q[0] - P[0]) * -gx > 0;
    if (davanti) {
      const m = (P[0] + Q[0]) / 2;
      return [
        [m, P[1]],
        [m, Q[1]],
      ];
    }
    const m = (P[1] + Q[1]) / 2;
    return [
      [P[0], m],
      [Q[0], m],
    ];
  }
  if (!orizzontale(esce) && !orizzontale(guarda)) {
    if (Math.abs(P[0] - Q[0]) < 0.05) return [];
    const davanti = (Q[1] - P[1]) * ey > 0 && (Q[1] - P[1]) * -gy > 0;
    if (davanti) {
      const m = (P[1] + Q[1]) / 2;
      return [
        [P[0], m],
        [Q[0], m],
      ];
    }
    const m = (P[0] + Q[0]) / 2;
    return [
      [m, P[1]],
      [m, Q[1]],
    ];
  }
  if (orizzontale(esce)) {
    const C = [Q[0], P[1]];
    if ((C[0] - P[0]) * ex >= 0 && (Q[1] - C[1]) * -gy >= 0) return [C];
    return [[P[0], Q[1]]];
  }
  const C = [P[0], Q[1]];
  if ((C[1] - P[1]) * ey >= 0 && (Q[0] - C[0]) * -gx >= 0) return [C];
  return [[Q[0], P[1]]];
}

function senzaDoppioni(punti) {
  const uscita = [];
  for (const p of punti) {
    const prima = uscita[uscita.length - 1];
    if (prima && Math.abs(prima[0] - p[0]) < 0.05 && Math.abs(prima[1] - p[1]) < 0.05) continue;
    uscita.push(p);
  }
  /* I punti in fila sulla stessa retta non sono angoli. */
  for (let i = uscita.length - 2; i >= 1; i -= 1) {
    const [a, b, c] = [uscita[i - 1], uscita[i], uscita[i + 1]];
    const croce = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    const punto = (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]);
    if (Math.abs(croce) < 0.01 && punto >= 0) uscita.splice(i, 1);
  }
  return uscita;
}

/** La spezzata di un tubo: dalla prima porta all'ultima, attraverso i pezzi
 * in mezzo. Ogni tappa e' `{ p: [x, y], verso }` (una porta: il verso in cui
 * il tubo esce dal pezzo, o in cui guarda la porta d'arrivo),
 * `{ p: [x, y], asse: "h" | "v" }` (un pezzo che il tubo attraversa) o
 * `{ p: [x, y], entra, esce }` (un pezzo dove il tubo gira: il lato da cui
 * entra e il verso in cui esce). */
export function spezzataDelTubo(tappe, { uscita = 14 } = {}) {
  if (!Array.isArray(tappe) || tappe.length < 2) return [];
  /* Il verso in cui il tubo attraversa un pezzo: verso la tappa dopo. */
  const porte = tappe.map((tappa, i) => {
    if (tappa.verso) return { p: tappa.p, verso: tappa.verso, stacco: tappa.stacco ?? uscita };
    /* Un pezzo dove il tubo gira (il rubinetto in cima al ricircolo). */
    if (tappa.entra && tappa.esce)
      return { p: tappa.p, entra: tappa.entra, esce: tappa.esce, stacco: 0 };
    const prima = tappe[i - 1]?.p || tappa.p;
    const dopo = tappe[i + 1]?.p || tappa.p;
    const h = tappa.asse !== "v";
    const segno = h ? Math.sign(dopo[0] - prima[0]) || 1 : Math.sign(dopo[1] - prima[1]) || 1;
    const va = h ? (segno > 0 ? "e" : "w") : segno > 0 ? "s" : "n";
    const da = { e: "w", w: "e", n: "s", s: "n" }[va];
    return { p: tappa.p, entra: da, esce: va, stacco: 0 };
  });
  const punti = [];
  for (let i = 0; i < porte.length - 1; i += 1) {
    const A = porte[i];
    const B = porte[i + 1];
    const esce = A.verso || A.esce;
    const guarda = B.verso || B.entra;
    const P = avanti(A.p, esce, A.stacco);
    const Q = avanti(B.p, guarda, B.stacco);
    punti.push(A.p, P, ...angoli(P, esce, Q, guarda), Q);
    if (i === porte.length - 2) punti.push(B.p);
  }
  return senzaDoppioni(punti);
}

/** Il `d` di una spezzata con gli angoli arrotondati. */
export function percorsoArrotondato(punti, raggio = 16) {
  if (!punti.length) return "";
  let d = `M ${uno(punti[0][0])} ${uno(punti[0][1])}`;
  for (let i = 1; i < punti.length - 1; i += 1) {
    const [a, b, c] = [punti[i - 1], punti[i], punti[i + 1]];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const r = Math.min(raggio, l1 / 2, l2 / 2);
    if (r < 0.5) {
      d += ` L ${uno(b[0])} ${uno(b[1])}`;
      continue;
    }
    const p = [b[0] - ((b[0] - a[0]) / l1) * r, b[1] - ((b[1] - a[1]) / l1) * r];
    const q = [b[0] + ((c[0] - b[0]) / l2) * r, b[1] + ((c[1] - b[1]) / l2) * r];
    d += ` L ${uno(p[0])} ${uno(p[1])} Q ${uno(b[0])} ${uno(b[1])}, ${uno(q[0])} ${uno(q[1])}`;
  }
  const ultimo = punti[punti.length - 1];
  return `${d} L ${uno(ultimo[0])} ${uno(ultimo[1])}`;
}

/** Un tubo a tratti diritti, orizzontali e verticali, con gli angoli tondi. */
export function tuboOrtogonale(tappe, { raggio = 16, uscita = 14 } = {}) {
  return percorsoArrotondato(spezzataDelTubo(tappe, { uscita }), raggio);
}

/* Il disegno isometrico ha gli assi a 30°: si fa il conto in quegli assi
 * (u verso destra in basso, v verso sinistra in basso) e si torna sul foglio. */
const C30 = Math.cos(Math.PI / 6);
const S30 = Math.sin(Math.PI / 6);
const versoIsometrico = Object.freeze({ e: "e", w: "w", n: "n", s: "s" });
const alFoglio = ([u, v]) => [(u - v) * C30, (u + v) * S30];
const dalFoglio = ([x, y]) => [x / (2 * C30) + y / (2 * S30), -x / (2 * C30) + y / (2 * S30)];

/** Un tubo per un disegno isometrico: i versi sono quelli degli assi del
 * disegno (e/w lungo u, n/s lungo v), gli angoli tondi sul foglio. */
export function tuboIsometrico(tappe, { raggio = 16, uscita = 14 } = {}) {
  const nelPiano = (tappe || []).map((tappa) => ({
    ...tappa,
    p: dalFoglio(tappa.p),
    ...(tappa.verso ? { verso: versoIsometrico[tappa.verso] } : {}),
  }));
  return percorsoArrotondato(spezzataDelTubo(nelPiano, { uscita }).map(alFoglio), raggio);
}

/** Una curva morbida fra due cerchi, dal bordo dell'uno al bordo dell'altro
 * (i cerchi del flusso dell'energia). Due cerchi che si toccano non hanno
 * curva fra loro. */
export function curvaFraCerchi(a, ra, b, rb, { piega = 0.12 } = {}) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const distanza = Math.hypot(dx, dy);
  if (!(distanza > ra + rb)) return "";
  const ux = dx / distanza;
  const uy = dy / distanza;
  const s = [a[0] + ux * ra, a[1] + uy * ra];
  const e = [b[0] - ux * rb, b[1] - uy * rb];
  const l = distanza - ra - rb;
  const n = [-uy * piega * l, ux * piega * l];
  const c1 = [s[0] + (e[0] - s[0]) / 3 + n[0], s[1] + (e[1] - s[1]) / 3 + n[1]];
  const c2 = [s[0] + ((e[0] - s[0]) * 2) / 3 + n[0], s[1] + ((e[1] - s[1]) * 2) / 3 + n[1]];
  return `M ${uno(s[0])} ${uno(s[1])} C ${uno(c1[0])} ${uno(c1[1])}, ${uno(c2[0])} ${uno(c2[1])}, ${uno(e[0])} ${uno(e[1])}`;
}
