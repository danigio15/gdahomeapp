/* Il disegno del solare termico: dove sta ogni cosa, nelle unita' del
 * disegno, e dove va quando l'utente la sposta.
 *
 * Le due disposizioni (orizzontale sul computer, in piedi sul telefono) sono
 * quelle disegnate a mano in `sections/solar-thermal-design-section.js`, e
 * stanno qui perche' le posizioni scelte (`cd_disegni`, vedi
 * `core/posizioni-nei-disegni.js`) si possano mettere sopra senza un browser.
 *
 * La regola che conta: senza una scelta il disegno e' quello di sempre — lo
 * stesso oggetto, non una copia — e nessun tubo si ridisegna. Con una scelta
 * si ridisegnano solo i tubi che toccano un pezzo spostato; gli altri restano
 * le curve fatte a mano.
 */

import { tuboOrtogonale, firmaDellePosizioni } from "./posizioni-nei-disegni.js";

export const DISEGNO_DEL_SOLARE = "solare";

/* Both layouts, in drawing units. Pipe runs start and end under a piece of
 * hardware, and they run in the direction the water goes, so the light in
 * them travels the right way. */
export const LANDSCAPE = Object.freeze({
  name: "landscape",
  w: 1100,
  h: 430,
  panel: { x: 110, y: 110, w: 270, h: 150, s: 40, d: 18 },
  tank: { cx: 700, top: 66, w: 150, h: 300 },
  sun: [320, 70, 150],
  tap: [1040, 120],
  routes: {
    "flow-sol-hot": "M 378 116 C 470 116, 520 116, 560 130 C 600 144, 608 168, 625 168",
    "flow-sol-cold": "M 625 330 C 560 330, 520 372, 440 372 L 250 372 C 170 372, 140 350, 130 300",
    "flow-ricircolo":
      "M 775 120 L 1000 120 C 1030 120, 1040 130, 1040 160 L 1040 320 C 1040 350, 1030 360, 1000 360 L 775 360",
  },
  leaders: {
    collector: [330, 66, 300, 122],
    alto: [818, 180, 739, 140],
    basso: [818, 294, 739, 318],
  },
});

export const PORTRAIT = Object.freeze({
  name: "portrait",
  w: 400,
  h: 600,
  panel: { x: 24, y: 64, w: 196, h: 112, s: 24, d: 12 },
  tank: { cx: 222, top: 262, w: 104, h: 168 },
  sun: [170, 40, 90],
  tap: null,
  routes: {
    "flow-sol-hot":
      "M 216 70 C 300 70, 352 76, 352 130 L 352 196 C 352 222, 340 236, 300 236 L 250 236 C 234 236, 226 246, 224 262",
    "flow-sol-cold":
      "M 200 420 C 190 452, 170 458, 140 458 L 60 458 C 30 458, 18 440, 18 410 L 18 230 C 18 210, 26 202, 38 198",
    "flow-ricircolo":
      "M 270 300 L 340 300 C 364 300, 374 310, 374 334 L 374 396 C 374 420, 364 430, 340 430 L 270 430",
  },
  leaders: {
    collector: [254, 34, 196, 74],
    alto: [156, 291, 197, 300],
    basso: [156, 375, 197, 396],
  },
});

/* Where the HTML pieces sit, in drawing units: [x, y] of the anchor. Pumps and
 * the valve are centred on their point; chips hang from their top-left. */
export const PLACES = Object.freeze({
  landscape: {
    pump: [400, 372],
    valve: [520, 120],
    rpump: [1040, 250],
    collectorHit: [110, 110, 288, 190],
    /* The safety valve, on the tank's left wall near the top: the right
     * wall carries the hot water line and the «Accumulo alto» chip. */
    tankNode: [625, 76],
    chipCollector: [285, 12],
    chipAlto: [818, 152],
    chipBasso: [818, 266],
    delta: [470, 236],
    press: [792, 10],
    power: [942, 10],
    tapTag: [1012, 120],
  },
  portrait: {
    pump: [92, 458],
    valve: [352, 150],
    rpump: [374, 366],
    collectorHit: [24, 64, 208, 136],
    /* Upright, the left wall has the probe chips: the right wall, above the
     * recirculation line. */
    tankNode: [274, 264],
    chipCollector: [254, 6],
    chipAlto: [28, 268],
    chipBasso: [28, 352],
    delta: [80, 24],
    press: [16, 500],
    power: [206, 500],
    tapTag: [0, 0],
  },
});

/** Il disegno del computer e quello del telefono. */
export const VARIANTE_DEL_LAYOUT = Object.freeze({ landscape: "computer", portrait: "telefono" });

/* ── i pezzi che si spostano ──────────────────────────────────────────────
 *
 * Ogni pezzo ha un centro (dove sta la sua maniglia) e si porta dietro le
 * sue cose: il disegno, le etichette, le linee che le legano. */

/** Il centro di ogni pezzo, nelle unita' del disegno. */
export const CENTRI = Object.freeze({
  landscape: Object.freeze({
    collettore: [254, 205],
    accumulo: [700, 216],
    pompa: [400, 372],
    valvola: [520, 120],
    ricircolo: [1040, 250],
    rubinetto: [1040, 120],
  }),
  portrait: Object.freeze({
    collettore: [128, 132],
    accumulo: [222, 346],
    pompa: [92, 458],
    valvola: [352, 150],
    ricircolo: [374, 366],
  }),
});

/** Chi porta cosa: i gruppi del disegno (`data-dm-st-art`) e i posti dei
 * pezzi HTML (`PLACES`). */
export const ARTE_DEL_NODO = Object.freeze({
  collector: "collettore",
  "lead-collector": "collettore",
  tank: "accumulo",
  "lead-alto": "accumulo",
  "lead-basso": "accumulo",
  tap: "rubinetto",
});

export const POSTI_DEL_NODO = Object.freeze({
  pump: "pompa",
  valve: "valvola",
  rpump: "ricircolo",
  collectorHit: "collettore",
  chipCollector: "collettore",
  tankNode: "accumulo",
  chipAlto: "accumulo",
  chipBasso: "accumulo",
  tapTag: "rubinetto",
});

/** Le porte dei pezzi: dove il tubo esce (o entra) e verso dove guarda. Sono
 * gli estremi dei tubi disegnati a mano. */
export const PORTE = Object.freeze({
  landscape: Object.freeze({
    collettore: { caldo: { p: [378, 116], verso: "e" }, freddo: { p: [130, 300], verso: "s" } },
    accumulo: {
      caldo: { p: [625, 168], verso: "w" },
      freddo: { p: [625, 330], verso: "w" },
      mandata: { p: [775, 120], verso: "e" },
      ritorno: { p: [775, 360], verso: "e" },
    },
    pompa: { asse: "h" },
    valvola: { asse: "h" },
    ricircolo: { asse: "v" },
    rubinetto: { entra: "w", esce: "s" },
  }),
  portrait: Object.freeze({
    collettore: { caldo: { p: [216, 70], verso: "e" }, freddo: { p: [38, 198], verso: "s" } },
    accumulo: {
      caldo: { p: [224, 262], verso: "n" },
      freddo: { p: [200, 420], verso: "s" },
      mandata: { p: [270, 300], verso: "e" },
      ritorno: { p: [270, 430], verso: "e" },
    },
    pompa: { asse: "h" },
    valvola: { asse: "v" },
    ricircolo: { asse: "v" },
  }),
});

/** Le tappe di ogni tubo, nel verso dell'acqua: [pezzo, porta] o [pezzo] per
 * un pezzo che il tubo attraversa. */
export const TUBI = Object.freeze({
  landscape: Object.freeze({
    "flow-sol-hot": [["collettore", "caldo"], ["valvola"], ["accumulo", "caldo"]],
    "flow-sol-cold": [["accumulo", "freddo"], ["pompa"], ["collettore", "freddo"]],
    "flow-ricircolo": [
      ["accumulo", "mandata"],
      ["rubinetto"],
      ["ricircolo"],
      ["accumulo", "ritorno"],
    ],
  }),
  portrait: Object.freeze({
    "flow-sol-hot": [["collettore", "caldo"], ["valvola"], ["accumulo", "caldo"]],
    "flow-sol-cold": [["accumulo", "freddo"], ["pompa"], ["collettore", "freddo"]],
    "flow-ricircolo": [["accumulo", "mandata"], ["ricircolo"], ["accumulo", "ritorno"]],
  }),
});

const RAGGIO = Object.freeze({ landscape: 30, portrait: 20 });
const STACCO = Object.freeze({ landscape: 18, portrait: 12 });
const uno = (n) => Math.round(n * 10) / 10 + 0;

/** I pezzi che si spostano in un disegno. */
export function nodiDelLayout(base) {
  return Object.keys(CENTRI[base?.name] || {});
}

/** Il centro di un pezzo in percento del disegno: dove sta di serie. */
export function centroInPercento(base, nodo) {
  const c = CENTRI[base.name]?.[nodo];
  return c ? { x: uno((c[0] / base.w) * 1000) / 10, y: uno((c[1] / base.h) * 1000) / 10 } : null;
}

/** Di quanto si e' spostato ogni pezzo, nelle unita' del disegno: solo
 * quelli spostati davvero. */
export function spostamenti(base, posizioni) {
  const uscita = {};
  for (const [nodo, [cx, cy]] of Object.entries(CENTRI[base?.name] || {})) {
    const q = posizioni?.[nodo];
    if (!q || typeof q.x !== "number" || typeof q.y !== "number") continue;
    const dx = uno((q.x / 100) * base.w - cx);
    const dy = uno((q.y / 100) * base.h - cy);
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    uscita[nodo] = [dx, dy];
  }
  return uscita;
}

const piu = (p, d) => (d ? [uno(p[0] + d[0]), uno(p[1] + d[1])] : p);

function tappeDelTubo(base, id, spostati) {
  const porte = PORTE[base.name];
  return TUBI[base.name][id].map(([nodo, porta]) => {
    const d = spostati[nodo];
    if (porta) {
      const { p, verso } = porte[nodo][porta];
      return { p: piu(p, d), verso, stacco: STACCO[base.name] };
    }
    const p = piu(CENTRI[base.name][nodo], d);
    return { p, ...porte[nodo] };
  });
}

/** Il disegno con le posizioni scelte. Senza scelta (o con i pezzi dove
 * stanno di serie) e' `base` stesso. Altrimenti una copia con:
 *   - `routes`: i tubi che toccano un pezzo spostato, ridisegnati;
 *   - `places`: i posti dei pezzi HTML, spostati coi loro pezzi;
 *   - `spostati`: { pezzo: [dx, dy] }, per spostare il disegno;
 *   - `firma`: uguale per due scelte uguali. */
export function layoutConLePosizioni(base, posizioni) {
  const spostati = spostamenti(base, posizioni);
  if (!Object.keys(spostati).length) return base;
  const routes = { ...base.routes };
  for (const [id, tappe] of Object.entries(TUBI[base.name])) {
    if (!tappe.some(([nodo]) => spostati[nodo])) continue;
    routes[id] = tuboOrtogonale(tappeDelTubo(base, id, spostati), {
      raggio: RAGGIO[base.name],
      uscita: STACCO[base.name],
    });
  }
  const places = {};
  for (const [nome, posto] of Object.entries(PLACES[base.name])) {
    const d = spostati[POSTI_DEL_NODO[nome]];
    places[nome] = d ? [uno(posto[0] + d[0]), uno(posto[1] + d[1]), ...posto.slice(2)] : posto;
  }
  return Object.freeze({
    ...base,
    routes: Object.freeze(routes),
    places: Object.freeze(places),
    spostati: Object.freeze(spostati),
    firma: firmaDellePosizioni(posizioni),
  });
}
