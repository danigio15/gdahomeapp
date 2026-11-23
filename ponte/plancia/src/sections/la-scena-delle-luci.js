/* Il disegno della scena delle luci di Natale: un paesaggio d'inverno in SVG.
 *
 * Cosa c'e' e dove lo decide `core/scena-delle-luci.js`; qui si disegna. Il
 * disegno e' una stringa, senza DOM e senza stato: lo usano il riquadro in
 * Home (`feste-section.js`) e l'anteprima nella scheda «Luci di Natale»
 * (`luci-di-natale-editor-section.js`), uguale, con un prefisso diverso per
 * gli id dei gradienti, che nello stesso documento non si devono pestare.
 *
 * ── Un disegno che non si rifa' ───────────────────────────────────────────
 *
 * Le plance a muro sono tablet economici. Per questo il disegno si fa una
 * volta (e quando cambia la misura, le luci o la fase del cielo), e poi:
 *
 *  - i COLORI stanno tutti in variabili CSS (`variabiliDellaScena`): col
 *    passare dei minuti il cielo cambia cambiando le variabili;
 *  - lo STATO delle luci e' una classe, `acceso`, su ogni parte che porta
 *    `data-luce` (una o piu' entita'): chi aggiorna mette e toglie la classe
 *    e basta. La cascata delle lampadine che si accendono una dopo l'altra la
 *    fa il CSS, con un ritardo per lampadina (`--i` all'accensione, `--j` allo
 *    spegnimento, che va al contrario e piu' svelto);
 *  - gli ALONI delle lampadine sono gradienti radiali, non filtri di
 *    sfocatura; il luccichio va a scatti (`steps`), pochi ridisegni al
 *    secondo invece di sessanta; il fumo del camino e i fiocchi che cadono
 *    stanno fuori dall'SVG (`sopra`), in livelli che il browser sposta da
 *    solo senza ridipingere niente.
 *
 * Con «riduci animazioni» niente si muove e niente lampeggia: la scena e'
 * un'immagine ferma, con le luci accese piene.
 */
import {
  MISURE_DELLE_COSE,
  disposizioneDellaScena,
  partiDivise,
  variabiliDellaScena,
} from "../core/scena-delle-luci.js";

const n1 = (valore) => String(Math.round(valore * 10) / 10);
const escAttr = (testo) =>
  String(testo ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/* I numeri a caso, sempre gli stessi per lo stesso seme: le stelle e le
 * colline non si spostano a ogni disegno. */
function aCaso(seme) {
  let s = (Math.abs(Math.floor(Number(seme) || 1)) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* I colori delle lampadine: oro, rosso, verde, azzurro, rosa — quelli di una
 * catena vera. La tenda e la grondaia della casa sono calde, tutte uguali. */
const COLORI_DELLE_LAMPADINE = ["#ffd36e", "#ff6b6b", "#7fe3a8", "#7cc6ff", "#ff9ad5"];
const CALDA = "#ffe2a0";

/* ── i pezzi ────────────────────────────────────────────────────────────── */

/** I punti di un festone che pende fra due ganci: una curva, `quante` lampadine. */
function festone(x0, y0, x1, y1, pende, quante, { estremi = false } = {}) {
  const cx = (x0 + x1) / 2;
  const cy = Math.max(y0, y1) + pende * 2 - (Math.abs(y1 - y0) > 0 ? Math.abs(y1 - y0) : 0);
  const punti = [];
  for (let k = 0; k < quante; k += 1) {
    const t = estremi ? (quante === 1 ? 0.5 : k / (quante - 1)) : (k + 0.5) / quante;
    const u = 1 - t;
    punti.push([
      u * u * x0 + 2 * u * t * cx + t * t * x1,
      u * u * y0 + 2 * u * t * cy + t * t * y1,
    ]);
  }
  return { punti, d: `M${n1(x0)} ${n1(y0)}Q${n1(cx)} ${n1(cy)} ${n1(x1)} ${n1(y1)}` };
}

/**
 * Una fila di lampadine. Ognuna e' il vetro spento (sempre) e, sopra, la
 * luce: l'alone, il colore, il riflesso. `inizio` sposta la cascata, cosi'
 * le lampadine di festoni diversi si accendono una dopo l'altra.
 */
function lampadine(
  p,
  punti,
  { r = 3, colori = COLORI_DELLE_LAMPADINE, inizio = 0, totale = 0, alone = 3.1 } = {},
) {
  const tutte = totale || punti.length + inizio;
  return punti
    .map(([x, y], k) => {
      const i = inizio + k;
      const indice = (i * 3 + Math.floor(i / 5)) % colori.length;
      const colore = colori[indice];
      const quale = COLORI_DELLE_LAMPADINE.indexOf(colore);
      const aloneId = quale >= 0 ? `${p}al${quale}` : `${p}alc`;
      const ritardo = -((i * 0.73) % 2.8);
      return `<g class="sc-l" style="--i:${i};--j:${Math.max(0, tutte - i)};--d:${n1(ritardo)}s"><circle class="sc-l0" cx="${n1(x)}" cy="${n1(y)}" r="${n1(r * 0.85)}"/><g class="sc-l1"><circle class="sc-lh" cx="${n1(x)}" cy="${n1(y)}" r="${n1(r * alone)}" fill="url(#${aloneId})"/><circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r)}" fill="${colore}"/><circle cx="${n1(x - r * 0.3)}" cy="${n1(y - r * 0.35)}" r="${n1(r * 0.38)}" fill="#fff" opacity=".75"/></g></g>`;
    })
    .join("");
}

/** Una parte che si accende: porta le sue entita' e la classe `acceso`. */
function parte(entita, accese, dentro, classe = "") {
  const elenco = (Array.isArray(entita) ? entita : [entita]).filter(Boolean);
  const accesa = elenco.some((e) => accese.has(e));
  return `<g class="sc-p${classe ? ` ${classe}` : ""}${accesa ? " acceso" : ""}" data-luce="${escAttr(elenco.join(" "))}">${dentro}</g>`;
}

/** La cosa toccabile: le sue entita', il suo nome per chi non vede. */
function toccabile(chiave, entita, etichetta, dentro, area, dopo = "") {
  const [x, y, w, h] = area;
  return `<g class="sc-cosa" data-feste-cosa="${escAttr(chiave)}" data-feste-entita="${escAttr(entita.join(" "))}" role="button" tabindex="0" aria-label="${escAttr(etichetta)}">${dentro}<rect class="sc-tocco" x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="12"/>${dopo}</g>`;
}

/* Una stella a cinque punte, centrata. */
function stellaACinque(r, dentro = r * 0.42) {
  const punti = [];
  for (let k = 0; k < 10; k += 1) {
    const raggio = k % 2 ? dentro : r;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    punti.push(`${n1(Math.cos(a) * raggio)} ${n1(Math.sin(a) * raggio)}`);
  }
  return `M${punti.join("L")}Z`;
}

/* Una stella a quattro punte lunghe, quella della cometa e dei luccichii. */
function stellaAQuattro(r, vita = r * 0.16) {
  return `M0 ${n1(-r)}L${n1(vita)} ${n1(-vita)}L${n1(r)} 0L${n1(vita)} ${n1(vita)}L0 ${n1(r)}L${n1(-vita)} ${n1(vita)}L${n1(-r)} 0L${n1(-vita)} ${n1(-vita)}Z`;
}

/* La neve che si posa su un bordo: una striscia morbida, piu' spessa in
 * mezzo, con qualche goccia che pende. */
function cumulo(x0, x1, y, spessore = 6, gocce = 0, seme = 1) {
  const caso = aCaso(seme);
  const w = x1 - x0;
  let d = `M${n1(x0)} ${n1(y)}Q${n1(x0 + w * 0.08)} ${n1(y - spessore * 1.05)} ${n1(x0 + w * 0.3)} ${n1(y - spessore)}Q${n1(x0 + w * 0.55)} ${n1(y - spessore * 1.25)} ${n1(x0 + w * 0.78)} ${n1(y - spessore * 0.95)}Q${n1(x1 - w * 0.03)} ${n1(y - spessore * 0.8)} ${n1(x1)} ${n1(y)}`;
  /* Il bordo di sotto: diritto, con le gocce. */
  const passi = Math.max(1, gocce);
  for (let k = passi; k >= 1; k -= 1) {
    const xa = x0 + (w * k) / (passi + 1);
    if (gocce && caso() > 0.25) {
      const giu = spessore * (0.45 + caso() * 0.7);
      d += `L${n1(xa + 3)} ${n1(y)}Q${n1(xa)} ${n1(y + giu * 1.6)} ${n1(xa - 3)} ${n1(y)}`;
    }
  }
  return `${d}Z`;
}

/* ── l'albero ───────────────────────────────────────────────────────────── */

/* I palchi dell'abete, dal basso: [cima, fondo, mezza larghezza]. */
const PALCHI = [
  [-120, -16, 97],
  [-152, -56, 80],
  [-178, -94, 62],
  [-199, -128, 44],
  [-217, -158, 26],
];

function bordoDelPalco(fondo, w, onde) {
  const punti = [];
  for (let k = 0; k <= onde; k += 1) {
    const x = -w + (2 * w * k) / onde;
    punti.push([x, fondo - 6 * (x / w) ** 2]);
  }
  return punti;
}

/* Il bordo di sotto di un palco: i rami che pendono, a onde. */
function ondeDelPalco(bordo, giu = 8) {
  let d = "";
  for (let k = 1; k < bordo.length; k += 1) {
    const [xa, ya] = bordo[k - 1];
    const [xb, yb] = bordo[k];
    d += `Q${n1((xa + xb) / 2)} ${n1((ya + yb) / 2 + giu)} ${n1(xb)} ${n1(yb)}`;
  }
  return d;
}

function palco(cima, fondo, w, p, onde, primo) {
  const bordo = bordoDelPalco(fondo, w, onde);
  const fianco = (lato) => `${n1(lato * w * 0.3)} ${n1(cima + (fondo - cima) * 0.58)}`;
  const d = `M0 ${cima}Q${fianco(-1)} ${n1(bordo[0][0])} ${n1(bordo[0][1])}${ondeDelPalco(bordo)}Q${fianco(1)} 0 ${cima}Z`;
  /* L'ombra che il palco getta su quello di sotto: lo stesso bordo, piu'
   * giu', scuro. Il primo palco la getta sulla neve, e quella c'e' gia'. */
  const sotto = primo
    ? ""
    : `<path d="M${n1(bordo[0][0] + 6)} ${n1(bordo[0][1])}${ondeDelPalco(
        bordo.slice(0).map(([x, y]) => [x * 0.94, y + 7]),
        6,
      )}L${n1(bordo[bordo.length - 1][0] - 6)} ${n1(bordo[0][1])}Z" class="sc-f-abete3" opacity=".5"/>`;
  /* L'ombra a destra: il lato che non vede la luce. */
  const ombra = `M0 ${cima}Q${fianco(1)} ${n1(w)} ${n1(fondo - 6)}Q${n1(w * 0.55)} ${n1(fondo + 5)} ${n1(w * 0.18)} ${n1(fondo + 3)}Q${n1(w * 0.14)} ${n1(cima + (fondo - cima) * 0.5)} 0 ${cima}Z`;
  /* La luce sul lato sinistro, sottile. */
  const luce = `M0 ${cima}Q${fianco(-1)} ${n1(bordo[0][0])} ${n1(bordo[0][1])}Q${n1(-w * 0.72)} ${n1(fondo - 2)} ${n1(-w * 0.55)} ${n1(fondo - 4)}Q${n1(-w * 0.2)} ${n1(cima + (fondo - cima) * 0.62)} 0 ${cima}Z`;
  /* La neve sulle punte dei rami, dal lato della luce. */
  let neve = "";
  for (let k = 0; k < bordo.length - 1; k += 1) {
    const [xa, ya] = bordo[k];
    const [xb, yb] = bordo[k + 1];
    const xm = (xa + xb) / 2;
    if (xm > w * 0.45) continue;
    const ym = (ya + yb) / 2 + 2;
    const largo = (xb - xa) * 0.42;
    neve += `<path d="M${n1(xm - largo)} ${n1(ym)}q${n1(largo)} -5.2 ${n1(largo * 2)} 0q${n1(-largo)} 2.4 ${n1(-largo * 2)} 0z"/>`;
  }
  return `${sotto}<path d="${d}" fill="url(#${p}abete)"/><path d="${ombra}" class="sc-f-abete3" opacity=".5"/><path d="${luce}" class="sc-f-abete1" opacity=".45"/><g class="sc-f-neve" opacity=".92">${neve}</g>`;
}

function albero(p, cosa, accese) {
  const ent = cosa.entita;
  /* I festoni: quattro, uno per palco, che girano attorno all'albero. */
  const giri = [
    [0, -104, -28, 0.9, 13],
    [1, -86, -68, 0.9, 11],
    [2, -66, -106, 0.88, 9],
    [3, -48, -139, 0.84, 7],
  ];
  const chi = partiDivise(ent, giri.length + 1);
  let palchi = "";
  for (let k = 0; k < PALCHI.length; k += 1)
    palchi += palco(...PALCHI[k], p, 8 - Math.min(4, k), k === 0);
  let luci = "";
  let inizio = 0;
  const totale = giri.reduce((t, g) => t + g[4], 0);
  for (const [k, , y, stretta, quante] of giri) {
    const w = PALCHI[k][2] * stretta;
    const { punti, d } = festone(-w, y - 9, w, y + 2, 7, quante);
    luci += parte(
      chi[k],
      accese,
      `<path d="${d}" class="sc-filo"/>${lampadine(p, punti, { r: 3.3, inizio, totale })}`,
    );
    inizio += quante;
  }
  const stella = parte(
    chi[giri.length],
    accese,
    `<g transform="translate(0 -216)"><circle class="sc-alone-stella" r="34" fill="url(#${p}aloneoro)"/><path class="sc-stella-spenta" d="${stellaACinque(13)}"/><g class="sc-l1 sc-stella-accesa" style="--i:${totale}"><path d="${stellaACinque(13)}" fill="url(#${p}oro)"/><path d="${stellaACinque(6)}" fill="#fff8de" opacity=".7"/></g></g>`,
    "sc-stella-albero",
  );
  const tutte = ent;
  const disegno = `${parte(tutte, accese, `<ellipse cx="0" cy="-104" rx="138" ry="124" fill="url(#${p}alone)" class="sc-bagliore"/><ellipse cx="0" cy="2" rx="118" ry="13" fill="url(#${p}caldo)" class="sc-riflesso"/>`)}
    <ellipse cx="6" cy="-1" rx="84" ry="8" class="sc-f-ombra" opacity=".5"/>
    <rect x="-9" y="-22" width="18" height="22" rx="2" class="sc-f-legno"/>
    <rect x="1" y="-22" width="8" height="22" class="sc-f-legno2" opacity=".6"/>
    ${palchi}
    ${luci}
    ${stella}
    <g transform="translate(-52 0)"><rect x="-13" y="-17" width="26" height="17" rx="2" fill="#a3343b"/><rect x="-13" y="-17" width="26" height="17" rx="2" class="sc-f-notte"/><rect x="-2" y="-17" width="4" height="17" fill="#e9c46a"/><rect x="-15" y="-21" width="30" height="5" rx="1.5" fill="#b83c43"/><rect x="-15" y="-21" width="30" height="5" rx="1.5" class="sc-f-notte"/><path d="M0 -21c-6-7-12-3-7 0m7 0c6-7 12-3 7 0" stroke="#e9c46a" stroke-width="1.8" fill="none"/><path d="M-15 -21h30" class="sc-s-neve" stroke-width="2.4" stroke-linecap="round"/></g>
    <g transform="translate(48 0)"><rect x="-10" y="-13" width="20" height="13" rx="2" fill="#2f6b8f"/><rect x="-10" y="-13" width="20" height="13" rx="2" class="sc-f-notte"/><rect x="-1.6" y="-13" width="3.2" height="13" fill="#f0d9a8"/><rect x="-11.5" y="-16" width="23" height="4" rx="1.2" fill="#367aa3"/><rect x="-11.5" y="-16" width="23" height="4" rx="1.2" class="sc-f-notte"/><path d="M-11.5 -16h23" class="sc-s-neve" stroke-width="2" stroke-linecap="round"/></g>`;
  return disegno;
}

/* ── il presepe ─────────────────────────────────────────────────────────── */

/* Le sagome della Natività, disegnate con l'origine ai piedi. Giuseppe in
 * piedi col mantello e il cappuccio, il bastone in mano; Maria in ginocchio
 * col velo, le mani giunte verso la mangiatoia; il Bambino in fasce. Dietro,
 * il bue con le corna e l'asinello con le orecchie lunghe, piu' chiari: sono
 * nell'ombra in fondo alla capanna. */
const GIUSEPPE =
  "M-14 0C-15-14-14-30-12-42C-11-50-10-56-8-61C-8-70-3-77 3-77C9-77 12-71 11-64C11-60 9-57 7-55C10-48 12-36 12-22L13 0Z";
const BRACCIO = "M8-52C4-49-6-46-15-46L-15-42C-6-42 4-43 10-46Z";
const BASTONE = "M-17 1L-19-82Q-19.5-89-13.5-88.5";
const MARIA =
  "M18 0C19-10 18-20 14-27C12-31 11-36 10-40C9-47 4-52-2-52C-8-52-12-47-12-42C-12-39-11-37-9-36L-11-31C-13-25-15-14-16 0Z";
const MANI = "M-9-36L-18-40L-17-34L-10-31Z";
const MANGIATOIA = "M-18-19L18-19L14-28L-14-28Z";
const BAMBINO = "M-10-31c0-3.6 4.4-5 10-5s10 1.4 10 5-4.4 4.4-10 4.4-10-.8-10-4.4Z";
const BUE =
  "M-30-2C-31-14-24-24-10-25C-4-25 0-27 3-31C5-35 10-37 15-35L22-33C26-32 28-28 26-24C24-21 20-21 17-22L12-18C10-14 6-10 0-8L-2-2Z" +
  "M5-35C2-41-4-43-8-41C-4-40-1-38 1-34ZM13-37C14-43 19-46 23-45C19-43 17-40 17-36ZM4-31L-4-30L2-27Z";
const ASINO =
  "M-26-36C-27-39-25-42-22-42L-10-44C-6-45-2-46 1-48L1-62C1-64 4-64 4-62L6-50L9-63C10-65 13-64 12-62L10-48C14-45 16-40 16-34L18-14C19-8 20-4 22 0L6 0C6-8 4-16 2-22C-2-26-6-28-10-30L-21-31C-24-31-26-33-26-36Z";

function presepe(p, cosa, accese, conStella) {
  const ent = cosa.presepe || cosa.entita;
  const [interno, lanterna] = partiDivise(ent, 2);
  /* La paglia del tetto: fasci corti di traverso, sulle due falde. */
  const paglia = Array.from({ length: 16 }, (_, k) => {
    const t = (k + 0.5) / 16;
    const x = -104 + t * 104;
    const y = -82 - t * 60;
    const l = 7 + (k % 3) * 2;
    return `<path d="M${n1(x)} ${n1(y + 1)}l${n1(l * 0.55)} ${n1(l * 0.9)}M${n1(-x)} ${n1(y + 1)}l${n1(-l * 0.55)} ${n1(l * 0.9)}"/>`;
  }).join("");
  const assi = [-56, -36, -16, 4, 24, 44, 64].map((x) => `<path d="M${x} -92V0"/>`).join("");
  const luce = parte(
    interno,
    accese,
    `<path d="M-74 0L-74-88L74-88L74 0Z" fill="url(#${p}interno)" class="sc-calda"/>
     <path d="M-80 2L80 2L124 26L-124 26Z" fill="url(#${p}spiraglio)" class="sc-riflesso"/>
     <g class="sc-raggi-presepe" fill="#fff3cf"><path d="M0-31L-30-88L-17-88ZM0-31L17-88L30-88ZM0-31L-66-84L-62-73ZM0-31L66-84L62-73Z" opacity=".2"/></g>
     <circle cx="0" cy="-30" r="26" fill="url(#${p}aloneoro)" class="sc-calda"/>`,
  );
  const sagome = `<g class="sc-sagome">
      <path d="${BUE}" transform="translate(-50 -8)" class="sc-f-sagoma-dietro"/>
      <path d="${ASINO}" transform="translate(54 -6)" class="sc-f-sagoma-dietro"/>
      <g transform="translate(-30 0)"><path d="${BASTONE}" class="sc-s-sagoma" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="${GIUSEPPE}" class="sc-f-sagoma"/><path d="${BRACCIO}" class="sc-f-sagoma"/></g>
      <g transform="translate(34 0)"><path d="${MARIA}" class="sc-f-sagoma"/><path d="${MANI}" class="sc-f-sagoma"/></g>
      <path d="M-16 0L11-20M16 0L-11-20" class="sc-s-sagoma" stroke-width="2.8"/>
      <path d="${MANGIATOIA}" class="sc-f-legno"/>
      <path d="M-14-28l2.5-4.5 2 4.5 3-5.5 2 5.5 3-4.5 2 4.5 3-5.5 2 5.5 3-4.5 2 4.5 3-5" class="sc-s-paglia" stroke-width="1.7" fill="none"/>
      <g class="sc-bambino"><path d="${BAMBINO}" fill="#f4e7cf"/><circle cx="7.5" cy="-33" r="3.8" fill="#f0d7b8"/><path d="M-8-31h12" stroke="#d9c6a6" stroke-width=".9"/></g>
    </g>`;
  const lanternaAccesa = parte(
    lanterna,
    accese,
    `<circle cx="-62" cy="-67" r="22" fill="url(#${p}aloneoro)" class="sc-calda"/><rect x="-65.5" y="-72" width="7" height="10" rx="1.5" fill="#ffd27a" class="sc-calda"/>`,
  );
  const stellina = conStella
    ? ""
    : parte(
        interno,
        accese,
        `<g transform="translate(0 -166)"><circle r="18" fill="url(#${p}aloneoro)" class="sc-calda"/><path d="${stellaAQuattro(10, 2)}" class="sc-stella-spenta"/><path d="${stellaAQuattro(10, 2)}" fill="url(#${p}oro)" class="sc-l1"/></g>`,
      );
  const ghiaccioli = [-104, -98, -91, 90, 97, 103]
    .map(
      (x, k) =>
        `<path d="M${x - 2} ${n1(-71 - (118 - Math.abs(x)) * 0.62)}l2 ${5 + (k % 3) * 2.5}l2 ${-5 - (k % 3) * 2.5}z"/>`,
    )
    .join("");
  return `
    <ellipse cx="0" cy="-1" rx="112" ry="9" class="sc-f-ombra" opacity=".5"/>
    <path d="M-80 0L-80-92L80-92L80 0Z" class="sc-f-legno2"/>
    <g class="sc-s-legno" stroke-width="1.2" opacity=".45">${assi}</g>
    <path d="M-74 0L-74-88L74-88L74 0Z" class="sc-f-interno" opacity=".86"/>
    ${luce}
    ${sagome}
    <rect x="-86" y="-100" width="12" height="100" rx="2" class="sc-f-legno"/>
    <rect x="74" y="-100" width="12" height="100" rx="2" class="sc-f-legno"/>
    <rect x="80" y="-100" width="6" height="100" class="sc-f-legno2" opacity=".55"/>
    <rect x="-90" y="-99" width="180" height="9" rx="2" class="sc-f-legno"/>
    <rect x="-90" y="-93" width="180" height="3" class="sc-f-legno2" opacity=".6"/>
    <path d="M-62-90V-76" class="sc-s-ferro" stroke-width="1.2"/>
    <path d="M-67-76h10l-1.5 16h-7z" class="sc-f-ferro"/>
    ${lanternaAccesa}
    <path d="M-67-76h10l-1.5 16h-7zM-62-76v16" fill="none" class="sc-s-ferro" stroke-width="1.3"/>
    <path d="M-66-79h8l-4-3z" class="sc-f-ferro"/>
    <path d="M-116-78L0-150L116-78L112-70L0-138L-112-70Z" class="sc-f-paglia"/>
    <path d="M-112-70L0-138L112-70L106-66L0-131L-106-66Z" class="sc-f-legno2" opacity=".75"/>
    <g class="sc-s-legno2" stroke-width="1.2" opacity=".5" fill="none">${paglia}</g>
    <path d="M-122-79Q-60-120 0-160Q60-120 122-79Q125-74 118-72Q60-110 0-148Q-60-110-118-72Q-125-74-122-79Z" class="sc-f-neve"/>
    <path d="M-118-72Q-60-110 0-148Q60-110 118-72L114-71Q60-106 0-143Q-60-106-114-71Z" class="sc-f-neve-ombra" opacity=".5"/>
    <g class="sc-f-neve">${ghiaccioli}</g>
    <path d="M-124 2Q-96-12-70-5Q-50-11-30 0Z" class="sc-f-neve"/>
    <path d="M28 0Q52-9 76-5Q102-13 126 2Z" class="sc-f-neve"/>
    ${stellina}`;
}

/* La cometa: la testa a otto punte, la coda che si allunga in cielo, i
 * luccichii lungo la coda. */
function cometa(p, entita, accese, scala = 1) {
  const scintille = [
    [-30, -16, 3.2],
    [-56, -30, 2.4],
    [-84, -40, 3],
    [-112, -47, 2],
    [-138, -50, 2.4],
  ]
    .map(
      ([x, y, r], k) =>
        `<path d="${stellaAQuattro(r * 1.6)}" transform="translate(${x} ${y})" fill="#fff5d6" class="sc-scintilla" style="--d:-${n1(k * 0.55)}s"/>`,
    )
    .join("");
  return parte(
    entita,
    accese,
    `<g transform="scale(${n1(scala)})"><path class="sc-coda" d="M-4-3C-40-26-96-48-160-54C-100-40-52-20-6 4Z" fill="url(#${p}coda)"/>
     ${scintille}
     <circle r="40" fill="url(#${p}aloneoro)" class="sc-calda"/>
     <path d="${stellaAQuattro(13, 2.4)}" class="sc-stella-spenta"/>
     <g class="sc-l1"><path d="${stellaAQuattro(26, 3)}" fill="#fff6dc"/><path d="${stellaAQuattro(13, 3.2)}" transform="rotate(45)" fill="#fff6dc" opacity=".85"/><circle r="4.4" fill="#fff"/></g></g>`,
    "sc-cometa",
  );
}

/* ── la casa ────────────────────────────────────────────────────────────── */

/* Le finestre della casa: [x, y, larghezza, altezza]. Le prime due al primo
 * piano, la portafinestra del balcone, poi le due di sotto. */
const FINESTRE = [
  [-72, -128, 26, 32],
  [46, -128, 26, 32],
  [-15, -130, 30, 42],
  [-80, -64, 30, 38],
  [50, -64, 30, 38],
];

function finestra(p, [x, y, w, h], k, conCandele) {
  const vetro = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" class="sc-f-vetro"/>`;
  const croce = `<path d="M${x + w / 2} ${y}v${h}M${x} ${y + h * 0.48}h${w}" class="sc-s-legno" stroke-width="2.2"/>`;
  const cornice = `<rect x="${x - 2}" y="${y - 2}" width="${w + 4}" height="${h + 4}" rx="2.5" fill="none" class="sc-s-muro2" stroke-width="2.4"/>`;
  const candele = conCandele
    ? `<g class="sc-candele"><path d="M${x + 3} ${y + h - 2}q${w / 2 - 3} -${h * 0.42} ${w - 6} 0" class="sc-s-sagoma" stroke-width="2" fill="none"/>${[
        0.2, 0.35, 0.5, 0.65, 0.8,
      ]
        .map((t) => {
          const cx = x + w * t;
          const cy = y + h - 2 - Math.sin(Math.PI * t) * h * 0.21;
          return `<rect x="${n1(cx - 1.1)}" y="${n1(cy - 7)}" width="2.2" height="6.5" fill="#f3ead8"/><g class="sc-l1" style="--i:${Math.round(t * 5)}"><circle cx="${n1(cx)}" cy="${n1(cy - 9)}" r="4" fill="url(#${p}alc)"/><ellipse cx="${n1(cx)}" cy="${n1(cy - 8.8)}" rx="1.2" ry="2" fill="#fff1b8"/></g>`;
        })
        .join("")}</g>`
    : "";
  return `${cornice}${vetro}<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="url(#${p}finestra)" class="sc-vetro-acceso"/>${candele}${croce}`;
}

function casa(p, cosa, accese) {
  const balcone = cosa.balcone || [];
  const alla = cosa.finestra || [];
  const [grondaia, tenda, ringhiera] = partiDivise(balcone, 3);
  /* Le finestre: con le candele quando ci sono luci alla finestra, una
   * finestra per luce a turno; senza, le finestre di una casa abitata, calde
   * la sera e spente di giorno. */
  const perFinestra = alla.length ? partiDivise(alla, FINESTRE.length) : [];
  const finestre = FINESTRE.map((f, k) => {
    const disegno = finestra(p, f, k, alla.length > 0);
    return alla.length
      ? parte(perFinestra[k], accese, disegno, "sc-finestra")
      : `<g class="sc-abitata${k === 1 || k === 4 ? " sc-buia" : ""}">${disegno}</g>`;
  });
  const persiane = (x, y, w, h) =>
    `<rect x="${x - 11}" y="${y - 1}" width="9" height="${h + 2}" rx="1" class="sc-f-persiana"/><rect x="${x + w + 2}" y="${y - 1}" width="9" height="${h + 2}" rx="1" class="sc-f-persiana"/><path d="M${x - 10} ${y + 6}h7M${x - 10} ${y + 12}h7M${x - 10} ${y + 18}h7M${x - 10} ${y + 24}h7M${x - 10} ${y + 30}h7M${x + w + 3} ${y + 6}h7M${x + w + 3} ${y + 12}h7M${x + w + 3} ${y + 18}h7M${x + w + 3} ${y + 24}h7M${x + w + 3} ${y + 30}h7" class="sc-s-ombra-scura" stroke-width="1"/>`;
  let luci = "";
  if (balcone.length) {
    /* La grondaia: una fila di lampadine a festoni corti sotto il bordo del
     * tetto, da un capo all'altro. */
    let punti = [];
    let fili = "";
    const ganci = [-116, -78, -39, 0, 39, 78, 116];
    for (let k = 1; k < ganci.length; k += 1) {
      const f = festone(ganci[k - 1], -135, ganci[k], -135, 3.4, 4);
      punti = punti.concat(f.punti);
      fili += `<path d="${f.d}" class="sc-filo"/>`;
    }
    const nGrondaia = punti.length;
    /* La tenda: fili che pendono dalla grondaia, di lunghezze diverse, coi
     * puntini caldi; si accendono a filo a filo dopo la grondaia. */
    let tendaFili = "";
    let tendaPunti = "";
    let tendaSpenta = "";
    const lunghezze = [3, 5, 2, 4, 5, 3, 4, 2, 5, 3, 4, 2, 5, 3, 4, 2, 5, 3, 4, 3];
    for (let k = 0; k < 20; k += 1) {
      const x = -108 + k * 11.4;
      const quanti = lunghezze[k];
      tendaFili += `<path d="M${n1(x)} -133v${quanti * 4.6}" class="sc-filo" stroke-width=".7"/>`;
      const puntini = (colore) =>
        Array.from(
          { length: quanti },
          (_, q) => `<circle cx="${n1(x)}" cy="${n1(-130 + q * 4.6)}" r="1.45" ${colore}/>`,
        ).join("");
      tendaSpenta += puntini('class="sc-f-spenta"');
      tendaPunti += `<g class="sc-l1" style="--i:${nGrondaia + k};--j:${20 - k}">${puntini(`fill="${CALDA}"`)}</g>`;
    }
    const ringhieraF = [
      festone(-72, -107, -24, -107, 4, 7),
      festone(-24, -107, 24, -107, 4, 7),
      festone(24, -107, 72, -107, 4, 7),
    ];
    luci =
      parte(
        grondaia,
        accese,
        `<rect x="-122" y="-138" width="244" height="30" fill="url(#${p}tendaluce)" class="sc-bagliore"/>${fili}${lampadine(p, punti, { r: 2.7, inizio: 0, totale: nGrondaia })}`,
      ) +
      parte(
        tenda,
        accese,
        `<g class="sc-tenda">${tendaFili}<g opacity=".7">${tendaSpenta}</g>${tendaPunti}</g>`,
      ) +
      parte(
        ringhiera,
        accese,
        ringhieraF
          .map(
            (f, k) =>
              `<path d="${f.d}" class="sc-filo"/>${lampadine(p, f.punti, { r: 2.6, inizio: nGrondaia + 20 + k * 7, totale: nGrondaia + 41 })}`,
          )
          .join(""),
      );
  }
  const balaustri = Array.from(
    { length: 19 },
    (_, k) => `<path d="M${-70 + k * 7.8} -106V-86" class="sc-s-ferro" stroke-width="1.6"/>`,
  ).join("");
  const riflesso = parte(
    cosa.entita,
    accese,
    `<ellipse cx="0" cy="4" rx="140" ry="14" fill="url(#${p}caldo)" class="sc-riflesso"/>`,
  );
  return `
    ${riflesso}
    <ellipse cx="8" cy="-1" rx="120" ry="9" class="sc-f-ombra" opacity=".5"/>
    <rect x="-104" y="-150" width="208" height="150" fill="url(#${p}muro)"/>
    <rect x="-104" y="-152" width="208" height="8" class="sc-f-notte" opacity=".22"/>
    <rect x="-108" y="-12" width="216" height="12" class="sc-f-muro2"/>
    ${persiane(-72, -128, 26, 32)}${persiane(46, -128, 26, 32)}${persiane(-80, -64, 30, 38)}${persiane(50, -64, 30, 38)}
    ${finestre.join("")}
    <path d="M-15-60v-0q0-15 15-15t15 15V0h-30z" class="sc-f-porta"/>
    <path d="M-15-60q0-15 15-15t15 15" fill="none" class="sc-s-muro2" stroke-width="3"/>
    <circle cx="9" cy="-28" r="1.6" fill="#e9c46a"/>
    <g transform="translate(0 -44)"><circle r="8.5" fill="none" stroke="#2e6b47" stroke-width="5"/><circle r="8.5" fill="none" class="sc-s-notte" stroke-width="5" opacity=".3"/><circle cx="-4" cy="-6" r="1.3" fill="#ff6b6b"/><circle cx="5" cy="-5" r="1.3" fill="#ffd36e"/><circle cx="7" cy="3" r="1.3" fill="#ff6b6b"/><circle cx="-7" cy="4" r="1.3" fill="#ffd36e"/><path d="M-3 7l3 3 3-3-1 6-2-2-2 2z" fill="#c0333b"/></g>
    <path d="M-26 0h52v-5h-52z" class="sc-f-muro2"/>
    <path d="M-26-5h52" class="sc-s-neve" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M-80-25h30M50-25h30" class="sc-s-neve" stroke-width="3.2" stroke-linecap="round"/>
    <rect x="-76" y="-88" width="152" height="7" rx="1" class="sc-f-muro2"/>
    <rect x="-76" y="-82" width="152" height="4" class="sc-f-notte" opacity=".25"/>
    ${balaustri}
    <path d="M-72-107H72" class="sc-s-ferro" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M-73-109H73" class="sc-s-neve" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M-76-88H76" class="sc-s-neve" stroke-width="2" stroke-linecap="round" opacity=".8"/>
    <path d="M-122-146L-92-200L92-200L122-146Z" class="sc-f-tetto"/>
    <path d="M-128-146L-96-202Q0-213 96-202L128-146Q132-140 124-139Q60-143 0-142Q-60-143-124-139Q-132-140-128-146Z" fill="url(#${p}tettoneve)"/>
    <g class="sc-s-neve-ombra" stroke-width="1.2" opacity=".45"><path d="M-98.9 -188H98.9"/><path d="M-106.6 -174H106.6"/><path d="M-114.3 -160H114.3"/></g>
    <path d="M-124-139Q-60-143 0-142Q60-143 124-139L122-136Q60-139 0-138Q-60-139-122-136Z" class="sc-f-tetto" opacity=".9"/>
    <path d="M-117-138q2 7 4 0M-71-140q1.5 5 3 0M-21-139q1.5 8 3 0M33-140q1.5 5 3 0M85-139q1.5 7 3 0M111-137q1.5 5 3 0" class="sc-s-neve" stroke-width="2.4" stroke-linecap="round"/>
    <g class="sc-abbaino">
      <path d="M-20-168V-190H20V-168Z" class="sc-f-muro"/>
      <path d="M8-190H20V-168H8Z" class="sc-f-muro2" opacity=".7"/>
      <g class="sc-abitata"><rect x="-10" y="-187" width="20" height="17" rx="8" class="sc-f-vetro"/><rect x="-10" y="-187" width="20" height="17" rx="8" fill="url(#${p}finestra)" class="sc-vetro-acceso"/><path d="M0-187v17M-10-176h20" class="sc-s-legno" stroke-width="1.6"/></g>
      <path d="M-27-187L0-206L27-187Q29-183 25-183L0-200L-25-183Q-29-183-27-187Z" class="sc-f-neve"/>
      <path d="M-24-168Q0-174 24-168Q22-164 0-165Q-22-164-24-168Z" class="sc-f-neve"/>
    </g>
    <g class="sc-camino">
      <rect x="56" y="-222" width="20" height="46" class="sc-f-mattone"/>
      <path d="M56-212h20M56-202h20M56-192h20M66-222v10M61-212v10M71-212v10M66-202v10M61-192v10M71-192v10" class="sc-s-ombra-scura" stroke-width=".8"/>
      <rect x="68" y="-222" width="8" height="46" class="sc-f-notte" opacity=".4"/>
      <rect x="53" y="-226" width="26" height="6" rx="1" class="sc-f-mattone"/>
      <path d="M51-226q15-10 30 0q1 4-3 4h-24q-4 0-3-4z" class="sc-f-neve"/>
      <path d="M50-181Q66-188 82-181L80-177H52Z" class="sc-f-neve"/>
    </g>
    ${luci}
    <path d="M-150 3Q-120-14-90-4Q-40-12 0-2Q50-12 96-4Q124-14 150 3Z" class="sc-f-neve"/>`;
}

/* ── la ghirlanda ───────────────────────────────────────────────────────── */

/* Un abete piccolo, tre palchi e la neve sulle punte: regge la ghirlanda. */
function abetino(p, x, h) {
  const palchi = [
    [-12, -h * 0.62, h * 0.36],
    [-h * 0.36, -h * 0.86, h * 0.27],
    [-h * 0.62, -h, h * 0.18],
  ];
  const disegno = palchi
    .map(([yb, yt, w]) => {
      const mezzo = n1((yt + yb) / 2);
      return `<path d="M0 ${n1(yt)}Q${n1(-w * 0.35)} ${mezzo} ${n1(-w)} ${n1(yb)}Q0 ${n1(yb + 6)} ${n1(w)} ${n1(yb)}Q${n1(w * 0.35)} ${mezzo} 0 ${n1(yt)}Z" fill="url(#${p}abete)"/><path d="M${n1(-w * 0.92)} ${n1(yb - 1)}q${n1(w * 0.45)} -5 ${n1(w * 0.9)} -1q${n1(-w * 0.4)} 2.6 ${n1(-w * 0.9)} 1z" class="sc-f-neve"/>`;
    })
    .join("");
  return `<g transform="translate(${x} 0)"><rect x="-3" y="-14" width="6" height="14" class="sc-f-legno2"/>${disegno}</g>`;
}

function ghirlanda(p, cosa, accese) {
  const [prima, seconda] = partiDivise(cosa.entita, 2);
  const alta = festone(-70, -100, 70, -100, 26, 12);
  const bassa = festone(-74, -66, 74, -66, 18, 11);
  return `
    ${parte(cosa.entita, accese, `<ellipse cx="0" cy="3" rx="112" ry="11" fill="url(#${p}caldo)" class="sc-riflesso"/>`)}
    <ellipse cx="0" cy="-1" rx="100" ry="7" class="sc-f-ombra" opacity=".45"/>
    ${abetino(p, -76, 112)}${abetino(p, 76, 112)}
    ${parte(prima, accese, `<path d="${alta.d}" class="sc-filo"/>${lampadine(p, alta.punti, { r: 3.6, totale: 23 })}`)}
    ${parte(seconda, accese, `<path d="${bassa.d}" class="sc-filo"/>${lampadine(p, bassa.punti, { r: 3.3, inizio: 12, totale: 23 })}`)}
    <path d="M-110 3Q-92-10-74-2Q-40-7-14 1Q20-6 70-1Q92-10 110 3Z" class="sc-f-neve"/>`;
}

/* ── lo sfondo ──────────────────────────────────────────────────────────── */

/* La luna nella sua fase: il lembo acceso e il terminatore, un'ellisse. */
export function pathDellaLuna(r, illuminata) {
  const k = Math.max(0, Math.min(1, illuminata));
  const rx = Math.abs(1 - 2 * k) * r;
  return `M0 ${n1(-r)}A${n1(r)} ${n1(r)} 0 0 1 0 ${n1(r)}A${n1(rx)} ${n1(r)} 0 0 ${k > 0.5 ? 1 : 0} 0 ${n1(-r)}Z`;
}

function colline(W, H, terra, seme) {
  const caso = aCaso(seme);
  /* Le montagne lontane, morbide; poi i colli coi loro abeti. Una linea
   * per punti a passo e altezza variabili, lisciata passando per i punti di
   * mezzo: niente onde tutte uguali. */
  const linea = (passoMin, passoMax, base, su) => {
    const punti = [];
    for (let x = -60; x < W + passoMax; x += passoMin + caso() * (passoMax - passoMin))
      punti.push([x, base - caso() * su]);
    let d = `M0 ${H}L${n1(punti[0][0])} ${n1(punti[0][1])}`;
    for (let k = 1; k < punti.length - 1; k += 1) {
      const [x, y] = punti[k];
      const [xn, yn] = punti[k + 1];
      d += `Q${n1(x)} ${n1(y)} ${n1((x + xn) / 2)} ${n1((y + yn) / 2)}`;
    }
    const ultimo = punti[punti.length - 1];
    return { d: `${d}L${n1(ultimo[0])} ${n1(ultimo[1])}L${n1(ultimo[0])} ${H}Z`, punti };
  };
  const monte = linea(150, 280, terra - 62, 64).d;
  const colli = linea(170, 300, terra - 28, 34);
  const colle = colli.d;
  const creste = colli.punti.map(([x, y]) => [x, y + 6]);
  /* Gli abeti lontani sulle creste dei colli: due o quattro per cresta, a
   * due palchi, piantati un poco sotto la linea. */
  let abeti = "";
  for (const [cx, cy] of creste) {
    const quanti = 2 + Math.floor(caso() * 3);
    for (let k = 0; k < quanti; k += 1) {
      const x = cx - 46 + caso() * 92;
      const y = cy + 9 + Math.abs(x - cx) * 0.12;
      const h = 13 + caso() * 13;
      const w = h * 0.34;
      abeti += `<path d="M${n1(x)} ${n1(y - h)}L${n1(x + w * 0.72)} ${n1(y - h * 0.42)}L${n1(x + w * 0.4)} ${n1(y - h * 0.44)}L${n1(x + w)} ${n1(y)}L${n1(x - w)} ${n1(y)}L${n1(x - w * 0.4)} ${n1(y - h * 0.44)}L${n1(x - w * 0.72)} ${n1(y - h * 0.42)}Z"/>`;
    }
  }
  /* Le luci del paese lontano: qualche finestra calda sul fianco dei colli,
   * a grappoli, nella meta' di destra. */
  let paese = "";
  const fianchi = creste.filter(([x]) => x > W * 0.42 && x < W - 20);
  for (const [cx, cy] of fianchi.slice(0, 3)) {
    for (let k = 0; k < 6; k += 1) {
      const x = cx - 22 + caso() * 44;
      const y = cy + 12 + caso() * 12;
      paese += `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(0.8 + caso() * 0.7)}"${k % 3 === 0 ? ` class="sc-tremola" style="--d:-${n1(caso() * 3)}s"` : ""}/>`;
    }
  }
  return { monte, colle, abeti, paese };
}

function nuvola(x, y, s) {
  return `<g transform="translate(${n1(x)} ${n1(y)}) scale(${n1(s)})"><path d="M-46 8Q-48-6-32-6Q-28-22-10-20Q0-32 16-24Q34-28 38-12Q54-10 50 8Z" class="sc-f-nuvola"/><path d="M-46 8Q-20 2 0 6Q24 2 50 8Z" class="sc-f-notte" opacity=".12"/></g>`;
}

function sfondo(p, W, H, terra, cielo, astro, seme) {
  const caso = aCaso(seme);
  let stelle = "";
  const quante = Math.round(W / 14);
  for (let k = 0; k < quante; k += 1) {
    const x = caso() * W;
    const y = caso() * (terra - 80);
    const r = 0.35 + caso() * 1.05;
    stelle += `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r)}" opacity="${n1(0.35 + caso() * 0.65)}"${k % 5 === 0 ? ` class="sc-tremola" style="--d:-${n1(caso() * 4)}s"` : ""}/>`;
  }
  const { monte, colle, abeti, paese } = colline(W, H, terra, seme + 7);
  let astri = "";
  if (cielo.sole) {
    /* Alto a mezzogiorno, appoggiato ai colli al tramonto: mezzo nascosto,
     * come quando sta per andare giu'. */
    const y = 40 + Math.max(0, Math.min(1, (cielo.sole.y - 0.14) / 0.7)) * (terra - 100);
    astri = `<g class="sc-sole" transform="translate(${n1(astro.x)} ${n1(y)})"><circle r="92" fill="url(#${p}sole)"/><circle r="17" fill="#fff8e2" opacity="${n1(1 - (cielo.sole.velato || 0) * 0.6)}"/></g>`;
  } else if (cielo.luna) {
    const l = cielo.luna;
    astri = `<g class="sc-luna" transform="translate(${n1(astro.x)} ${n1(astro.y)})"><circle r="46" fill="url(#${p}luna)"/><circle r="15" fill="#f6efd8" opacity=".1"/><path d="${pathDellaLuna(15, l.illuminata)}"${l.crescente ? "" : ' transform="scale(-1 1)"'} fill="#f6efd8"/></g>`;
  }
  const nuvole = [];
  /* Le nuvole stanno in alto, piccole: sotto ci sono le cose. */
  const posti = [
    [0.56, 34, 0.8],
    [0.84, 22, 0.55],
    [0.38, 52, 0.55],
  ];
  for (let k = 0; k < Math.min(cielo.nuvole, posti.length); k += 1)
    nuvole.push(nuvola(posti[k][0] * W, posti[k][1], posti[k][2]));
  let luccichii = "";
  for (let k = 0; k < Math.round(W / 60); k += 1) {
    const x = caso() * W;
    const y = terra + 8 + caso() * (H - terra - 14);
    luccichii += `<path d="${stellaAQuattro(1.6 + caso() * 1.6)}" transform="translate(${n1(x)} ${n1(y)})" class="sc-luccichio" style="--d:-${n1(caso() * 5)}s"/>`;
  }
  return {
    dietro: `<rect width="${W}" height="${H}" fill="url(#${p}cielo)"/>
      <g class="sc-stelle" fill="#fff">${stelle}</g>
      ${astri}
      ${nuvole.join("")}
      <path d="${monte}" fill="url(#${p}monte)"/>
      <path d="${colle}" class="sc-f-colle"/>
      <g class="sc-f-abete-lontano">${abeti}</g>
      <g class="sc-paese" fill="#ffd27a">${paese}</g>
      <path d="M0 ${n1(terra - 10)}Q${n1(W * 0.25)} ${n1(terra - 22)} ${n1(W * 0.5)} ${n1(terra - 12)}T${W} ${n1(terra - 14)}V${H}H0Z" fill="url(#${p}neve)"/>`,
    davanti: `<path d="M0 ${n1(terra + 26)}Q${n1(W * 0.3)} ${n1(terra + 12)} ${n1(W * 0.62)} ${n1(terra + 24)}T${W} ${n1(terra + 18)}V${H}H0Z" class="sc-f-neve" opacity=".92"/>
      <g fill="#fff">${luccichii}</g>`,
  };
}

/* ── i gradienti ────────────────────────────────────────────────────────── */

function gradienti(p) {
  const stop = (offset, colore, opacita = 1) =>
    `<stop offset="${offset}" style="stop-color:${colore}" stop-opacity="${opacita}"/>`;
  const aloni = COLORI_DELLE_LAMPADINE.map(
    (colore, k) =>
      `<radialGradient id="${p}al${k}">${stop(0, colore, 0.8)}${stop(0.35, colore, 0.32)}${stop(1, colore, 0)}</radialGradient>`,
  ).join("");
  return `<defs>
    <linearGradient id="${p}cielo" x1="0" y1="0" x2="0" y2="1">${stop(0, "var(--sc-c1)")}${stop(0.62, "var(--sc-c2)")}${stop(1, "var(--sc-c3)")}</linearGradient>
    <linearGradient id="${p}neve" x1="0" y1="0" x2="0" y2="1">${stop(0, "var(--sc-neve1)")}${stop(1, "var(--sc-neve2)")}</linearGradient>
    <linearGradient id="${p}abete" x1="0" y1="0" x2="1" y2="0">${stop(0, "var(--sc-abete1)")}${stop(0.55, "var(--sc-abete2)")}${stop(1, "var(--sc-abete3)")}</linearGradient>
    <linearGradient id="${p}muro" x1="0" y1="0" x2="1" y2="0">${stop(0, "var(--sc-muro)")}${stop(0.7, "var(--sc-muro)")}${stop(1, "var(--sc-muro2)")}</linearGradient>
    <linearGradient id="${p}oro" x1="0" y1="0" x2="1" y2="1">${stop(0, "#fff6cf")}${stop(0.5, "#ffd05e")}${stop(1, "#e3962a")}</linearGradient>
    <linearGradient id="${p}monte" x1="0" y1="0" x2="0" y2="1">${stop(0, "var(--sc-monte-neve)")}${stop(0.3, "var(--sc-monte)")}${stop(1, "var(--sc-monte)")}</linearGradient>
    <linearGradient id="${p}tettoneve" x1="0" y1="0" x2="0" y2="1">${stop(0, "var(--sc-neve1)")}${stop(0.55, "var(--sc-neve1)")}${stop(1, "var(--sc-neve-ombra)")}</linearGradient>
    <linearGradient id="${p}finestra" x1="0" y1="0" x2="0" y2="1">${stop(0, "#ffe7a8")}${stop(1, "#ffad4f")}</linearGradient>
    <linearGradient id="${p}tendaluce" x1="0" y1="0" x2="0" y2="1">${stop(0, "#ffd98a", 0.5)}${stop(1, "#ffd98a", 0)}</linearGradient>
    <linearGradient id="${p}coda" x1="0" y1="0" x2="1" y2="0">${stop(0, "#fff3c8", 0)}${stop(0.75, "#fff3c8", 0.55)}${stop(1, "#fffbe8", 0.95)}</linearGradient>
    <radialGradient id="${p}caldo">${stop(0, "#ffc46b", 0.85)}${stop(0.55, "#ff9a3c", 0.3)}${stop(1, "#ff9a3c", 0)}</radialGradient>
    <radialGradient id="${p}alone">${stop(0, "#ffd98a", 0.5)}${stop(0.6, "#ffd98a", 0.14)}${stop(1, "#ffd98a", 0)}</radialGradient>
    <radialGradient id="${p}aloneoro">${stop(0, "#fff3c8", 0.95)}${stop(0.3, "#ffd27a", 0.45)}${stop(1, "#ffb347", 0)}</radialGradient>
    <radialGradient id="${p}alc">${stop(0, CALDA, 0.9)}${stop(0.4, CALDA, 0.35)}${stop(1, CALDA, 0)}</radialGradient>
    <radialGradient id="${p}interno" cx=".5" cy=".7" r=".75">${stop(0, "#ffe2a0")}${stop(0.45, "#ffb85c")}${stop(1, "#d9772e")}</radialGradient>
    <radialGradient id="${p}spiraglio" cx=".5" cy="0" r=".9">${stop(0, "#ffc46b", 0.75)}${stop(1, "#ffc46b", 0)}</radialGradient>
    <radialGradient id="${p}sole">${stop(0, "#fff6d8", 0.9)}${stop(0.18, "#ffe6a8", 0.55)}${stop(1, "#ffd27a", 0)}</radialGradient>
    <radialGradient id="${p}luna">${stop(0, "#fff6dc", 0.28)}${stop(1, "#fff6dc", 0)}</radialGradient>
    ${aloni}
  </defs>`;
}

/* ── la scena ───────────────────────────────────────────────────────────── */

/* Dove sta il camino, nelle coordinate della casa: ci si appoggia il fumo. */
const CAMINO = [66, -230];
/* Dove sta la stella sopra il presepe, nelle coordinate del presepe. */
const SOPRA_IL_PRESEPE = [40, -192];

/**
 * La scena intera.
 *
 * Entra: le `cose` gia' disposte (`disposizioneDellaScena`), il `cielo`
 * (`cieloDellaScena`), la misura (`larghezza` per un'altezza di 300), dove
 * sta l'`astro` (il sole o la luna), le entita' `accese` (un Set), le
 * `etichette` per chi non vede (per chiave della cosa) e un `prefisso` per
 * gli id.
 *
 * Esce `{ svg, sopra }`: il disegno e, a parte, il fumo del camino e i
 * fiocchi, da mettere sopra il disegno nello stesso riquadro.
 */
export function scenaDelleLuci({
  cose = [],
  cielo,
  larghezza = 1200,
  altezza = 300,
  terra = 252,
  astro = { x: larghezza - 60, y: 52 },
  accese = new Set(),
  etichette = {},
  prefisso = "sc",
} = {}) {
  const W = Math.round(larghezza);
  const H = altezza;
  const p = prefisso;
  const { dietro, davanti } = sfondo(p, W, H, terra, cielo, astro, W * 7 + cose.length);
  const disegni = [];
  let sopra = "";
  const stellaDelPresepe = cose.find((c) => c.tipo === "presepe" && c.stella?.length);
  for (const cosa of cose) {
    const s = cosa.scala;
    const misura = MISURE_DELLE_COSE[cosa.tipo];
    const area = [
      -misura.larghezza / 2,
      -misura.altezza - 6,
      misura.larghezza,
      misura.altezza + 14,
    ];
    const etichetta = etichette[cosa.chiave] || cosa.chiave;
    let dentro = "";
    if (cosa.tipo === "albero") dentro = albero(p, cosa, accese);
    else if (cosa.tipo === "presepe")
      dentro = presepe(p, cosa, accese, Boolean(cosa.stella?.length));
    else if (cosa.tipo === "casa") dentro = casa(p, cosa, accese);
    else if (cosa.tipo === "ghirlanda") dentro = ghirlanda(p, cosa, accese);
    else if (cosa.tipo === "stella") {
      disegni.push(
        `<g transform="translate(${n1(cosa.x)} ${n1(terra - 150 * s)}) scale(${s})">${toccabile(cosa.chiave, cosa.entita, etichetta, cometa(p, cosa.entita, accese), [-60, -50, 120, 100])}</g>`,
      );
      continue;
    }
    /* Nella casa con le lucine fuori e le candele alla finestra, le finestre
     * si toccano da sole: accendono le candele, non il balcone. Stanno dopo
     * l'area della casa, cosi' il tocco le trova prima. */
    let dopo = "";
    let entita = cosa.tipo === "presepe" ? cosa.presepe : cosa.entita;
    if (cosa.tipo === "casa" && cosa.finestra?.length && cosa.balcone?.length) {
      entita = cosa.balcone;
      dopo = `<g class="sc-cosa" data-feste-cosa="finestre" data-feste-entita="${escAttr(cosa.finestra.join(" "))}" role="button" tabindex="0" aria-label="${escAttr(etichette.finestre || "finestre")}">${FINESTRE.map(([x, y, w, h]) => `<rect class="sc-tocco" x="${x - 4}" y="${y - 4}" width="${w + 8}" height="${h + 8}" rx="4"/>`).join("")}</g>`;
    }
    disegni.push(
      `<g transform="translate(${n1(cosa.x)} ${terra}) scale(${s})">${toccabile(cosa.chiave, entita, etichetta, dentro, area, dopo)}</g>`,
    );
    if (cosa.tipo === "presepe" && stellaDelPresepe === cosa) {
      const [sx, sy] = SOPRA_IL_PRESEPE;
      disegni.push(
        `<g transform="translate(${n1(cosa.x + sx * s)} ${n1(Math.max(40, terra + sy * s))}) scale(${n1(Math.max(0.7, s))})">${toccabile("stella", cosa.stella, etichette.stella || "stella", cometa(p, cosa.stella, accese), [-60, -50, 120, 100])}</g>`,
      );
    }
    if (cosa.tipo === "casa") {
      const [cx, cy] = CAMINO;
      sopra += `<span class="dm-sc-fumo" style="left:${n1(((cosa.x + cx * s) / W) * 100)}%;top:${n1(((terra + cy * s) / H) * 100)}%;--s:${n1(s)}" aria-hidden="true"><i></i><i></i><i></i></span>`;
    }
  }
  if (cielo.fiocchi) sopra += `<span class="dm-sc-fiocchi" aria-hidden="true"></span>`;
  const stile = Object.entries(variabiliDellaScena(cielo))
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  const svg = `<svg class="dm-sc dm-sc-${cielo.fase}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" style="${stile}" xmlns="http://www.w3.org/2000/svg">${gradienti(p)}${dietro}<g class="sc-cose">${disegni.join("")}</g>${davanti}</svg>`;
  return { svg, sopra };
}

/* ── le icone dei tipi ──────────────────────────────────────────────────── */

/* Le icone dei sei tipi, per la scheda e per gli interruttori in Home:
 * piccole, piene, col colore del testo e un punto d'oro dove sta la luce. */
const ICONE = {
  albero:
    '<path d="M12 2.5 7.6 8.6h2.2L6.4 13.4h2.4L5 18.6h14l-3.8-5.2h2.4l-3.4-4.8h2.2Z" fill="currentColor"/><rect x="10.8" y="18.6" width="2.4" height="3" rx=".6" fill="currentColor"/><circle cx="12" cy="2.6" r="1.6" fill="#f5b942"/><circle cx="10" cy="10.6" r="1" fill="#f5b942"/><circle cx="14.2" cy="13.6" r="1" fill="#f5b942"/><circle cx="9.4" cy="16.4" r="1" fill="#f5b942"/>',
  presepe:
    '<path d="M2.5 11 12 3.5l9.5 7.5-1.2 1.4L12 6 3.7 12.4Z" fill="currentColor"/><path d="M5 11.6V21h14v-9.4l-7-5.4Z" fill="currentColor" opacity=".35"/><path d="M8.4 21v-3.2c0-1.4 1-2.4 2.2-2.4M15.6 21v-4c0-1.2-.8-2.2-2-2.2" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M10 19.2h4l-.6 1.8h-2.8Z" fill="#f5b942"/><circle cx="12" cy="18.2" r="1.3" fill="#f5b942"/>',
  balcone:
    '<path d="M3 10 12 3.5 21 10v1.2H3Z" fill="currentColor"/><path d="M5 11.2h14V21H5Z" fill="currentColor" opacity=".35"/><path d="M5 15h14M7 15v4M10 15v4M14 15v4M17 15v4" stroke="currentColor" stroke-width="1.5"/><circle cx="4.8" cy="12.6" r="1" fill="#f5b942"/><circle cx="8.4" cy="13.1" r="1" fill="#f5b942"/><circle cx="12" cy="13.2" r="1" fill="#f5b942"/><circle cx="15.6" cy="13.1" r="1" fill="#f5b942"/><circle cx="19.2" cy="12.6" r="1" fill="#f5b942"/>',
  finestra:
    '<rect x="4" y="3" width="16" height="18" rx="1.6" fill="currentColor" opacity=".35"/><path d="M4 21V4.6C4 3.7 4.7 3 5.6 3h12.8c.9 0 1.6.7 1.6 1.6V21M12 3v18M4 11.5h16" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="7" y="15" width="2" height="4" fill="currentColor"/><rect x="15" y="15" width="2" height="4" fill="currentColor"/><circle cx="8" cy="13.6" r="1.3" fill="#f5b942"/><circle cx="16" cy="13.6" r="1.3" fill="#f5b942"/>',
  stella:
    '<path d="M15 3.5l1.3 3.6 3.7 1.3-3.7 1.3L15 13.3l-1.3-3.6-3.7-1.3 3.7-1.3Z" fill="#f5b942"/><path d="M12.6 10.4C9 13 5.6 16.2 3 20.5c3.4-3 7.2-5.6 11-7.4Z" fill="currentColor" opacity=".55"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="20" cy="17" r="1" fill="currentColor"/>',
  ghirlanda:
    '<path d="M2.5 6.5Q12 15 21.5 6.5" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M5 9.6l-.6 2.4M9.2 11.8 9 14.3M14.8 11.8l.2 2.5M19 9.6l.6 2.4" stroke="currentColor" stroke-width="1.4"/><circle cx="4.3" cy="13.4" r="1.7" fill="#f5b942"/><circle cx="9" cy="15.8" r="1.7" fill="#ff6b6b"/><circle cx="15" cy="15.8" r="1.7" fill="#7fe3a8"/><circle cx="19.7" cy="13.4" r="1.7" fill="#7cc6ff"/>',
};

/** L'icona di un tipo di luce, in SVG, grande `misura` pixel. */
export function iconaDelTipo(tipo, misura = 22) {
  const dentro = ICONE[tipo] || ICONE.ghirlanda;
  return `<svg class="dm-sc-icona" viewBox="0 0 24 24" width="${misura}" height="${misura}" aria-hidden="true" focusable="false">${dentro}</svg>`;
}

/* ── lo stile ───────────────────────────────────────────────────────────── */

/**
 * Il foglio della scena, uguale per il riquadro e per l'anteprima. `radice`
 * e' il selettore del contenitore (per non toccare niente fuori).
 */
export function cssDellaScena(radice) {
  const r = radice;
  return `
    ${r}{position:relative;overflow:hidden}
    ${r} .dm-sc{position:absolute;inset:0;width:100%;height:100%;display:block}
    ${r} .sc-f-neve{fill:var(--sc-neve1)}
    ${r} .sc-s-neve{stroke:var(--sc-neve1)}
    ${r} .sc-f-neve-ombra{fill:var(--sc-neve-ombra)}
    ${r} .sc-s-neve-ombra{stroke:var(--sc-neve-ombra)}
    ${r} .sc-f-muro{fill:var(--sc-muro)}
    ${r} .sc-f-monte{fill:var(--sc-monte)}
    ${r} .sc-f-colle{fill:var(--sc-colle)}
    ${r} .sc-f-abete-lontano{fill:var(--sc-abete-lontano)}
    ${r} .sc-f-abete1{fill:var(--sc-abete1)}
    ${r} .sc-f-abete3{fill:var(--sc-abete3)}
    ${r} .sc-s-abete2{stroke:var(--sc-abete2)}
    ${r} .sc-f-legno{fill:var(--sc-legno)}
    ${r} .sc-f-legno2{fill:var(--sc-legno2)}
    ${r} .sc-s-legno{stroke:var(--sc-legno)}
    ${r} .sc-s-legno2{stroke:var(--sc-legno2)}
    ${r} .sc-f-paglia{fill:var(--sc-paglia)}
    ${r} .sc-s-paglia{stroke:var(--sc-paglia)}
    ${r} .sc-f-muro2{fill:var(--sc-muro2)}
    ${r} .sc-s-muro2{stroke:var(--sc-muro2)}
    ${r} .sc-f-tetto{fill:var(--sc-tetto)}
    ${r} .sc-f-mattone{fill:var(--sc-mattone)}
    ${r} .sc-f-porta{fill:var(--sc-porta)}
    ${r} .sc-f-persiana{fill:var(--sc-persiana)}
    ${r} .sc-f-ferro{fill:var(--sc-ferro)}
    ${r} .sc-s-ferro{stroke:var(--sc-ferro)}
    ${r} .sc-f-vetro{fill:var(--sc-vetro)}
    ${r} .sc-f-interno{fill:var(--sc-interno)}
    ${r} .sc-f-sagoma{fill:var(--sc-sagoma)}
    ${r} .sc-f-sagoma-dietro{fill:var(--sc-sagoma);opacity:.62}
    ${r} .sc-s-sagoma{stroke:var(--sc-sagoma)}
    ${r} .sc-f-ombra{fill:var(--sc-ombra)}
    ${r} .sc-s-ombra-scura{stroke:var(--sc-ferro);opacity:.35}
    ${r} .sc-f-nuvola{fill:var(--sc-nuvola);opacity:.9}
    ${r} .sc-f-notte{fill:var(--sc-c1);opacity:calc(var(--sc-paese) * .45)}
    ${r} .sc-s-notte{stroke:var(--sc-c1)}
    ${r} .sc-f-spenta{fill:var(--sc-spenta)}
    ${r} .sc-filo{stroke:var(--sc-filo);stroke-width:1.1;fill:none}
    ${r} .sc-stelle{opacity:var(--sc-stelle)}
    ${r} .sc-paese{opacity:var(--sc-paese)}
    ${r} .sc-luccichio{opacity:calc(.25 + var(--sc-stelle) * .55)}
    ${r} .sc-tocco{fill:transparent;cursor:pointer}
    ${r} .sc-cosa{outline:none}
    ${r} .sc-cosa:focus-visible .sc-tocco{stroke:#f5d27a;stroke-width:2;stroke-dasharray:5 4}

    /* Le lampadine: il vetro spento sempre, la luce sopra. */
    ${r} .sc-l0{fill:var(--sc-spenta)}
    ${r} .sc-l1{opacity:0;transition:opacity .22s ease calc(var(--j,0) * 12ms)}
    ${r} .acceso .sc-l1{opacity:1;transition:opacity .3s ease calc(var(--i,0) * 38ms)}
    ${r} .sc-lh{opacity:var(--sc-alone)}

    /* Quello che si accende tutto insieme: gli aloni grandi, la capanna, i
       riflessi sulla neve. Piu' lento delle lampadine, come una luce vera. */
    ${r} .sc-bagliore,${r} .sc-calda,${r} .sc-riflesso,${r} .sc-raggi-presepe,${r} .sc-coda,${r} .sc-scintilla,${r} .sc-alone-stella{opacity:0;transition:opacity .9s ease}
    ${r} .acceso .sc-bagliore{opacity:var(--sc-bagliore)}
    ${r} .acceso .sc-calda{opacity:1}
    ${r} .acceso .sc-riflesso{opacity:var(--sc-riflesso)}
    ${r} .acceso .sc-raggi-presepe{opacity:var(--sc-riflesso)}
    ${r} .acceso .sc-coda{opacity:1}
    ${r} .acceso .sc-scintilla{opacity:.9}
    ${r} .acceso .sc-alone-stella{opacity:1;transition-delay:1.1s}
    ${r} .sc-stella-spenta{fill:var(--sc-spenta)}
    ${r} .sc-stella-albero .sc-l1{transition-delay:0s}
    ${r} .sc-stella-albero.acceso .sc-l1{transition:opacity .5s ease 1.25s}
    ${r} .sc-bambino{opacity:.55;transition:opacity .9s ease}
    ${r} .acceso ~ .sc-sagome .sc-bambino{opacity:1}

    /* Le finestre: quelle di una casa abitata si accendono da sole la sera;
       quelle con le candele quando le candele sono accese. */
    ${r} .sc-vetro-acceso{opacity:0;transition:opacity .9s ease}
    ${r} .sc-abitata .sc-vetro-acceso{opacity:calc(var(--sc-abitata) * .8)}
    ${r} .sc-abitata.sc-buia .sc-vetro-acceso{opacity:calc(var(--sc-abitata) * .25)}
    ${r} .sc-finestra.acceso .sc-vetro-acceso{opacity:calc(.45 + var(--sc-abitata) * .55)}

    /* Il movimento: il luccichio a scatti (pochi ridisegni al secondo), il
       fumo e i fiocchi in livelli a parte, che si spostano senza ridisegno. */
    @media (prefers-reduced-motion:no-preference){
      ${r} .acceso .sc-lh{animation:dm-sc-brilla 2.8s steps(4,end) infinite var(--d,0s)}
      ${r} .sc-tremola{animation:dm-sc-tremola 4s steps(3,end) infinite var(--d,0s)}
      ${r} .sc-luccichio{animation:dm-sc-tremola 5s steps(3,end) infinite var(--d,0s)}
      ${r} .acceso .sc-scintilla{animation:dm-sc-tremola 2.4s steps(3,end) infinite var(--d,0s)}
      ${r} .dm-sc-fumo i{animation:dm-sc-fumo 7s linear infinite}
      ${r} .dm-sc-fumo i:nth-child(2){animation-delay:-2.33s}
      ${r} .dm-sc-fumo i:nth-child(3){animation-delay:-4.66s}
      ${r} .dm-sc-fiocchi{animation:dm-sc-cade 26s linear infinite}
    }
    ${r}.dm-sc-fermo *,${r}.dm-sc-fermo *::before,${r}.dm-sc-fermo *::after{animation-play-state:paused!important}
    @keyframes dm-sc-brilla{0%,100%{opacity:var(--sc-alone)}50%{opacity:calc(var(--sc-alone) * .45)}}
    @keyframes dm-sc-tremola{0%,100%{opacity:1}50%{opacity:.25}}
    @keyframes dm-sc-fumo{0%{transform:translate(-50%,0) scale(.5);opacity:0}15%{opacity:.5}100%{transform:translate(-160%,-420%) scale(1.9);opacity:0}}
    @keyframes dm-sc-cade{from{transform:translateY(-50%)}to{transform:translateY(0)}}
    ${r} .dm-sc-fumo{position:absolute;width:0;height:0;pointer-events:none}
    ${r} .dm-sc-fumo i{position:absolute;left:0;top:0;width:calc(16px * var(--s,1));height:calc(16px * var(--s,1));margin:calc(-8px * var(--s,1)) 0 0;border-radius:50%;
      background:radial-gradient(circle,rgba(220,228,240,.7),rgba(220,228,240,0) 70%);opacity:0;transform:translate(-50%,0) scale(.5)}
    @media (prefers-reduced-motion:reduce){
      ${r} .dm-sc-fumo i:nth-child(1){opacity:.35;transform:translate(-80%,-120%) scale(1.1)}
      ${r} .dm-sc-fumo i:nth-child(2){opacity:.2;transform:translate(-120%,-260%) scale(1.5)}
      ${r} .sc-l1,${r} .sc-bagliore,${r} .sc-calda,${r} .sc-riflesso,${r} .sc-coda,${r} .sc-vetro-acceso{transition:none}
    }
    ${r} .dm-sc-fiocchi{position:absolute;left:0;top:0;width:100%;height:200%;pointer-events:none;opacity:.8;
      background-image:
        radial-gradient(circle at 12% 8%,#fff 0 1.4px,transparent 1.9px),
        radial-gradient(circle at 37% 21%,#fff 0 1px,transparent 1.5px),
        radial-gradient(circle at 63% 4%,#fff 0 1.6px,transparent 2.1px),
        radial-gradient(circle at 84% 17%,#fff 0 1.1px,transparent 1.6px),
        radial-gradient(circle at 23% 33%,#fff 0 1px,transparent 1.5px),
        radial-gradient(circle at 52% 39%,#fff 0 1.3px,transparent 1.8px),
        radial-gradient(circle at 74% 30%,#fff 0 .9px,transparent 1.4px),
        radial-gradient(circle at 93% 44%,#fff 0 1.4px,transparent 1.9px),
        radial-gradient(circle at 6% 46%,#fff 0 1.1px,transparent 1.6px);
      background-size:100% 50%;background-repeat:repeat-y;will-change:transform}
  `;
}

/* ── la scena in un contenitore ─────────────────────────────────────────── */

/* Le parti che si accendono, e le cose che si toccano: la classe e lo stato
 * per chi non vede seguono le entita' accese. */
function seguiLeLuci(contenitore, accese) {
  for (const nodo of contenitore.querySelectorAll("[data-luce]")) {
    const accesa = nodo.dataset.luce.split(" ").some((e) => accese.has(e));
    if (nodo.classList.contains("acceso") !== accesa) nodo.classList.toggle("acceso", accesa);
  }
  for (const nodo of contenitore.querySelectorAll("[data-feste-entita]")) {
    const accesa = nodo.dataset.festeEntita.split(" ").some((e) => accese.has(e));
    nodo.setAttribute("aria-pressed", String(accesa));
    nodo.classList.remove("in-attesa");
  }
}

/**
 * Mette la scena in un contenitore, o la aggiorna.
 *
 * Il disegno si rifa' solo quando cambia qualcosa che si vede nella forma:
 * la misura del contenitore, le cose, lo spazio libero accanto ai comandi,
 * la fase del cielo (`cielo.firma`), le etichette. Il resto — i colori del
 * cielo che passano coi minuti, le luci che si accendono e si spengono — e'
 * un cambio di variabili e di classi sul disegno che c'e'.
 *
 * `da` e `riserva` sono in pixel: lo spazio a sinistra occupato dai comandi
 * e quello a destra lasciato al sole e alla luna. Torna `false` se il
 * contenitore non ha misura (e' nascosto): si riprova al giro dopo.
 */
export function mettiLaScena(
  contenitore,
  {
    cose,
    cielo,
    accese = new Set(),
    etichette = {},
    prefisso = "sc",
    da = 0,
    riserva = 0,
    astro = null,
  },
) {
  const w = contenitore?.clientWidth || 0;
  const h = contenitore?.clientHeight || 0;
  if (!w || !h) return false;
  const k = 300 / h;
  const W = Math.round(w * k);
  const sinistra = Math.round(da * k);
  const destra = W - Math.round(riserva * k);
  const firma = [
    W,
    sinistra,
    destra,
    cielo.firma,
    JSON.stringify(cose.map((c) => [c.tipo, c.entita, c.balcone, c.finestra, c.stella])),
    JSON.stringify(etichette),
  ].join("~");
  const svg = contenitore.querySelector(":scope > svg.dm-sc");
  if (!svg || contenitore.dataset.firmaScena !== firma) {
    const disposte = disposizioneDellaScena(cose, { larghezza: W, da: sinistra, a: destra });
    const { svg: disegno, sopra } = scenaDelleLuci({
      cose: disposte,
      cielo,
      larghezza: W,
      astro: astro || { x: W - Math.max(40, Math.min(64, riserva * k * 0.55)), y: 50 },
      accese,
      etichette,
      prefisso,
    });
    contenitore.innerHTML = disegno + sopra;
    contenitore.dataset.firmaScena = firma;
    seguiLeLuci(contenitore, accese);
    return true;
  }
  for (const [nome, valore] of Object.entries(variabiliDellaScena(cielo)))
    if (svg.style.getPropertyValue(nome) !== valore) svg.style.setProperty(nome, valore);
  seguiLeLuci(contenitore, accese);
  return true;
}
