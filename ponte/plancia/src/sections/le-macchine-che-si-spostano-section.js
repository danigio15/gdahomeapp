/* Spostare i pezzi dentro le scene delle macchine.
 *
 * «Vedi come poter spostare le cose anche nei disegni.» Dopo il solare termico
 * e il flusso dell'energia, le altre scene con dei pezzi e dei tubi fra loro:
 * lo scaldabagno, la caldaia, la stufa a pellet (la pagina della gestione
 * termica) e il gruppo di continuita'. Nell'anteprima del Config ogni pezzo ha la sua maniglia
 * (`disegni-che-si-spostano-section.js`), e i tubi e i cavi che toccano un
 * pezzo spostato si rifanno; gli altri restano quelli disegnati a mano.
 *
 * Le scene mettono i pezzi in percento del palco con `left`/`top` scritti in
 * linea, e il telefono ne sposta qualcuno con un `!important` del foglio: una
 * scelta dell'utente si scrive in linea con `important`, che vince su tutti e
 * due, e se ne va rimettendo lo stile di serie. Senza una scelta qui non si
 * tocca niente: ne' uno stile, ne' un tubo.
 *
 * I pezzi si chiamano col loro nome (`data-dm-pezzo`), i tubi col loro
 * (`data-dm-tubo`; `data-dm-contro` e' la cometa che corre al contrario).
 */

import { cannaFumaria, latiFra, soffioFra, tuboOrtogonale } from "../core/posizioni-nei-disegni.js";
import { posizioniInUso, registraIlDisegno } from "./disegni-che-si-spostano-section.js";
import { doc, root, senzaCadere, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_MACCHINE_CHE_SI_SPOSTANO__";
const state = (root[KEY] ||= { installed: false, ups: 0 });

/* Il foglio dei tubi: 1000 × 600, stirato sul palco. */
const LARGO = 1000;
const ALTO = 600;
/* Un tubo parte un poco dentro il corpo del pezzo: il pezzo gli sta sopra, e
 * fra i due non resta una fessura. */
const DENTRO = 6;

/* Le scene termiche cambiano disposizione sotto i 1100 pixel (il tablet in
 * piedi prende quella del telefono): li' comincia il disegno del telefono.
 * L'UPS si stringe sotto gli 820, e sotto i 520 si alza in colonna — una
 * colonna non ha posti da scegliere, e li' non si sposta niente. */
const TELEFONO_TERMICO = "(max-width: 1100px)";
const TELEFONO_UPS = "(max-width: 820px)";
const COLONNA_UPS = "(max-width: 520px)";

const combacia = (query) => Boolean(root.matchMedia?.(query)?.matches);

/* ── i pezzi e i tubi di ogni scena ─────────────────────────────────────── */

/* `corpo` e' la parte disegnata del pezzo, quella da cui escono i tubi; le
 * misure (`cede`) si scostano quando ci si lascia sopra un pezzo. */
const SCALDABAGNO = Object.freeze({
  id: "scaldabagno",
  nome: () => t("Scaldabagno", "Water heater"),
  pezzi: {
    serbatoio: { nome: () => t("Scaldabagno", "Water heater"), corpo: ".dm-it-tank" },
    acqua: { nome: () => t("Acqua adesso", "Water now"), cede: true },
    obiettivo: { nome: () => t("Obiettivo", "Target"), cede: true },
    consumo: { nome: () => t("Consumo", "Power"), cede: true },
    oggi: { nome: () => t("Oggi", "Today"), cede: true },
    resistenza: { nome: () => t("Resistenza accesa", "Element on"), cede: true },
  },
  tubi: [
    /* L'acqua calda esce dal fianco del serbatoio e sale verso la casa; la
     * fredda arriva da sotto ed entra dall'altro fianco. */
    { nome: "caldo", da: { pezzo: "serbatoio", lato: "e", di: -0.3 }, a: { punto: [700, 58], guarda: "s" } },
    { nome: "freddo", da: { pezzo: "serbatoio", lato: "w", di: 0.35 }, a: { punto: [340, 552], guarda: "n" } },
  ],
});

const CALDAIA = Object.freeze({
  id: "caldaia",
  nome: () => t("Caldaia", "Boiler"),
  pezzi: {
    caldaia: { nome: () => t("Caldaia", "Boiler"), corpo: ".dm-it-caldaia" },
    impianto: { nome: () => t("Impianto", "Circuit"), corpo: ".dm-it-radiatore,.dm-it-accumulo" },
    valvola1: { nome: () => t("Elettrovalvola", "Solenoid valve") },
    valvola2: { nome: () => t("Elettrovalvola 2", "Solenoid valve 2") },
    pellet: { nome: () => t("Pellet", "Pellet") },
    mandata: { nome: () => t("Mandata", "Flow"), cede: true },
    ritorno: { nome: () => t("Ritorno", "Return"), cede: true },
    pressione: { nome: () => t("Pressione", "Pressure"), cede: true },
    acquacalda: { nome: () => t("Acqua calda", "Hot water"), cede: true },
    corpo: { nome: () => t("Corpo caldaia", "Boiler body"), cede: true },
    calcolata: { nome: () => t("Calcolata", "Calculated"), cede: true },
    salto: { nome: () => t("Salto", "Delta"), cede: true },
    fuoco: { nome: () => t("Fumi", "Flue gas"), cede: true },
  },
  tubi: [
    /* Mandata e ritorno fra la caldaia e l'impianto, dal lato in cui si
     * guardano: la mandata in alto, il ritorno piu' in basso. */
    {
      nome: "mandata",
      corsia: 0,
      da: { pezzo: "caldaia", di: -0.05 },
      a: { pezzo: "impianto", di: -0.15 },
    },
    {
      nome: "ritorno",
      corsia: 1,
      da: { pezzo: "caldaia", di: 0.4 },
      a: { pezzo: "impianto", di: 0.15 },
    },
  ],
});

const STUFA = Object.freeze({
  id: "stufa",
  nome: () => t("Stufa a pellet", "Pellet stove"),
  pezzi: {
    stufa: { nome: () => t("Stufa a pellet", "Pellet stove"), corpo: ".dm-it-stufa" },
    pellet: { nome: () => t("Pellet", "Pellet") },
    fumi: { nome: () => t("Fumi", "Flue gas"), cede: true },
    stanza: { nome: () => t("Stanza", "Room"), corpo: ".dm-it-plate", cede: true },
  },
  tubi: [
    { nome: "canna", pezzi: ["stufa"], forma: (ctx) => cannaFumaria(ctx.centro("stufa")) },
    {
      /* L'aria calda esce dalla griglia, in alto sul corpo, e arriva dietro la
       * targhetta della stanza. */
      nome: "aria",
      pezzi: ["stufa", "stanza"],
      forma: (ctx) =>
        soffioFra([ctx.centro("stufa")[0], ctx.porta("stufa", "e", -0.22)[1]], ctx.centro("stanza")),
    },
  ],
});

const UPS_PEZZI = Object.freeze({
  rete: { nome: () => t("Rete elettrica", "Mains power"), corpo: ".dm-ups-traliccio" },
  scatola: { nome: () => t("UPS", "UPS"), corpo: ".dm-ups-box" },
  casa: { nome: () => t("Sotto protezione", "Protected load"), corpo: ".dm-ups-casa" },
  carico: { nome: () => t("Carico", "Load"), cede: true },
  autonomia: { nome: () => t("Autonomia residua", "Runtime left"), cede: true },
  tensione: { nome: () => t("Tensione", "Voltage"), cede: true },
  potenza: { nome: () => t("Potenza", "Power"), cede: true },
  temperatura: { nome: () => t("Temperatura", "Temperature"), cede: true },
  verdetto: { nome: () => t("Stato", "State"), cede: true },
});

const UPS_TUBI = Object.freeze([
  { nome: "rete", da: { pezzo: "rete" }, a: { pezzo: "scatola" } },
  { nome: "uscita", da: { pezzo: "scatola" }, a: { pezzo: "casa" } },
]);

const TERMICHE = Object.freeze({ scaldabagno: SCALDABAGNO, caldaia: CALDAIA, stufa: STUFA });

/* ── dove sta un pezzo ──────────────────────────────────────────────────── */

const pezziDi = (scena) =>
  [...(scena?.querySelectorAll?.("[data-dm-pezzo]") || [])].filter(
    (el) => el.closest(".dm-it-scena,.dm-ups-scena") === scena,
  );

function visibile(el) {
  const r = el?.getBoundingClientRect?.();
  return Boolean(r && (r.width > 0 || r.height > 0));
}

/* Il centro di un pezzo, in percento della scena: il pezzo e' centrato sul
 * suo punto (`translate(-50%, -50%)`), quindi e' il centro della sua scatola. */
function centroMisurato(el, box) {
  const r = el.getBoundingClientRect();
  const giro = (v) => Math.round(v * 100) / 100;
  return {
    x: giro(((r.left + r.width / 2 - box.left) / box.width) * 100),
    y: giro(((r.top + r.height / 2 - box.top) / box.height) * 100),
  };
}

/* Dove sta ogni pezzo di serie: quelli spostati si rimettono un attimo al loro
 * posto per misurarli, e tornano dove li ha messi l'utente. */
function laSerie(scena) {
  const box = scena.getBoundingClientRect();
  const spostati = pezziDi(scena).filter((el) => el.hasAttribute("data-dm-serie"));
  const adesso = spostati.map((el) => [el, el.getAttribute("style") || ""]);
  for (const [el] of adesso) el.setAttribute("style", el.getAttribute("data-dm-serie"));
  const serie = new Map();
  for (const el of pezziDi(scena))
    if (visibile(el)) serie.set(el.getAttribute("data-dm-pezzo"), centroMisurato(el, box));
  for (const [el, stile] of adesso) el.setAttribute("style", stile);
  return serie;
}

/* ── posare una scena ───────────────────────────────────────────────────── */

function mettiIlPezzo(el, punto) {
  if (!el.hasAttribute("data-dm-serie"))
    el.setAttribute("data-dm-serie", el.getAttribute("style") || "");
  el.style.setProperty("left", `${punto.x}%`, "important");
  el.style.setProperty("top", `${punto.y}%`, "important");
}

function rimettiIlPezzo(el) {
  if (!el.hasAttribute("data-dm-serie")) return;
  el.setAttribute("style", el.getAttribute("data-dm-serie"));
  el.removeAttribute("data-dm-serie");
}

/* I conti dei tubi per una scena posata: centri e porte nelle unita' del
 * foglio. Le porte si contano dal centro del pezzo (dove l'utente l'ha messo)
 * e dalla forma del suo corpo, cosi' non dipendono da dove la pagina lo sta
 * ancora portando. */
function contoDellaScena(scena, disegno, P) {
  const box = scena.getBoundingClientRect();
  const elementi = new Map(pezziDi(scena).map((el) => [el.getAttribute("data-dm-pezzo"), el]));
  const percento = (id) => {
    if (P[id]) return P[id];
    const el = elementi.get(id);
    if (!el) return null;
    return centroMisurato(el, box);
  };
  const centroPx = (id) => {
    const p = percento(id) || { x: 50, y: 50 };
    return [(p.x * box.width) / 100, (p.y * box.height) / 100];
  };
  const inFoglio = ([x, y]) => [(x / box.width) * LARGO, (y / box.height) * ALTO];
  const porta = (id, lato, di = 0) => {
    const el = elementi.get(id);
    const [cx, cy] = centroPx(id);
    if (!el) return inFoglio([cx, cy]);
    const r = el.getBoundingClientRect();
    const selettore = disegno.pezzi[id]?.corpo;
    const corpo = (selettore && el.querySelector(selettore)) || el;
    const c = corpo.getBoundingClientRect();
    /* Il corpo rispetto al centro del pezzo. */
    const mx = r.left + r.width / 2;
    const my = r.top + r.height / 2;
    const sinistra = c.left - mx;
    const destra = c.right - mx;
    const sopra = c.top - my;
    const sotto = c.bottom - my;
    const meta = (a, b, f) => (a + b) / 2 + (b - a) * f;
    let x = cx + meta(sinistra, destra, 0);
    let y = cy + meta(sopra, sotto, 0);
    if (lato === "e" || lato === "w") {
      x = cx + (lato === "e" ? destra - DENTRO : sinistra + DENTRO);
      y = cy + meta(sopra, sotto, di);
    } else {
      y = cy + (lato === "s" ? sotto - DENTRO : sopra + DENTRO);
      x = cx + meta(sinistra, destra, di);
    }
    return inFoglio([x, y]);
  };
  return {
    centro: (id) => inFoglio(centroPx(id)),
    centroPx,
    porta,
    ha: (id) => elementi.has(id),
  };
}

/* La forma di un tubo fra due porte (o fra una porta e un punto fisso del
 * foglio), a tratti diritti e angoli tondi. */
function formaDelTubo(tubo, ctx, contro) {
  if (tubo.forma) return tubo.forma(ctx);
  const { da, a } = tubo;
  let latoDa = da.lato;
  let latoA = a.guarda;
  if (!latoDa || (!a.punto && !latoA)) {
    const [l1, l2] = latiFra(ctx.centroPx(da.pezzo), a.punto ? null : ctx.centroPx(a.pezzo));
    latoDa ||= l1;
    latoA ||= l2;
  }
  const A = { p: ctx.porta(da.pezzo, latoDa, da.di || 0), verso: latoDa };
  const B = a.punto ? { p: a.punto, verso: latoA } : { p: ctx.porta(a.pezzo, latoA, a.di || 0), verso: latoA };
  const tappe = [A, ...gradino(A, B, tubo.corsia), B];
  return tuboOrtogonale(contro ? [...tappe].reverse() : tappe, { raggio: 22, uscita: 18 });
}

/* Due tubi fra gli stessi due pezzi (mandata e ritorno) piegano a gradino nello
 * stesso tratto: con la piega nello stesso punto il secondo correrebbe sopra
 * il primo. Ognuno ha la sua corsia, e la piega si scosta dalla parte che non
 * li fa incrociare (quella del tubo che sale prima). */
const CORSIA = 40;

function gradino(A, B, corsia) {
  if (corsia == null) return [];
  const orizzontale = A.verso === "e" || A.verso === "w";
  const lungo = orizzontale ? 0 : 1;
  const largo = 1 - lungo;
  const du = B.p[lungo] - A.p[lungo];
  const dv = B.p[largo] - A.p[largo];
  if (Math.abs(dv) < 1) return [];
  const verso = -Math.sign(du * dv) || 1;
  const p = [0, 0];
  p[lungo] = (A.p[lungo] + B.p[lungo]) / 2 + verso * (corsia - 0.5) * CORSIA;
  p[largo] = (A.p[largo] + B.p[largo]) / 2;
  return [{ p, asse: orizzontale ? "v" : "h" }];
}

const pezziDelTubo = (tubo) => tubo.pezzi || [tubo.da?.pezzo, tubo.a?.pezzo].filter(Boolean);

/** Mette una scena com'e' scelta adesso: i pezzi spostati al loro posto, i
 * tubi che li toccano rifatti. Senza una scelta tutto torna di serie. */
function posa(disegno, scena, variante) {
  if (!scena) return;
  const P = posizioniInUso(disegno.id, variante);
  for (const el of pezziDi(scena)) {
    const punto = P[el.getAttribute("data-dm-pezzo")];
    if (punto) mettiIlPezzo(el, punto);
    else rimettiIlPezzo(el);
  }
  const tubi = [...scena.querySelectorAll("[data-dm-tubo]")];
  if (!tubi.length) return;
  let ctx = null;
  for (const tubo of disegno.tubi) {
    const strade = tubi.filter((el) => el.getAttribute("data-dm-tubo") === tubo.nome);
    if (!strade.length) continue;
    const pezzi = pezziDelTubo(tubo);
    const tocca = pezzi.some((id) => P[id]);
    for (const strada of strade) {
      if (!tocca) {
        if (strada.hasAttribute("data-dm-serie")) {
          strada.setAttribute("d", strada.getAttribute("data-dm-serie"));
          strada.removeAttribute("data-dm-serie");
        }
        continue;
      }
      ctx ||= contoDellaScena(scena, disegno, P);
      if (!pezzi.every((id) => ctx.ha(id))) continue;
      const d = formaDelTubo(tubo, ctx, strada.hasAttribute("data-dm-contro"));
      if (!d) continue;
      if (!strada.hasAttribute("data-dm-serie"))
        strada.setAttribute("data-dm-serie", strada.getAttribute("d") || "");
      if (strada.getAttribute("d") !== d) strada.setAttribute("d", d);
    }
  }
}

/* ── iscrivere le scene ─────────────────────────────────────────────────── */

function nodiDi(disegno, scena) {
  if (!scena) return [];
  const serie = laSerie(scena);
  return pezziDi(scena)
    .filter(visibile)
    .map((el) => {
      const id = el.getAttribute("data-dm-pezzo");
      const voce = disegno.pezzi[id] || {};
      return {
        id,
        nome: voce.nome?.() || id,
        centro: serie.get(id),
        cede: Boolean(voce.cede),
        pezzi: () => [el],
      };
    })
    .filter((nodo) => nodo.centro);
}

const varianteTermica = () => (combacia(TELEFONO_TERMICO) ? "telefono" : "computer");

function scenaTermica(tipo) {
  const scena = doc?.querySelector?.(
    `#page-boiler .dm-it-stage:not([hidden]) > .dm-it-scena[data-dm-it-scena="${tipo}"]`,
  );
  return scena && visibile(scena) ? scena : null;
}

function iscriviLeTermiche() {
  for (const [tipo, disegno] of Object.entries(TERMICHE))
    registraIlDisegno({
      id: disegno.id,
      pagina: "boiler",
      nome: disegno.nome,
      scatola: () => scenaTermica(tipo),
      variante: varianteTermica,
      nodi: () => nodiDi(disegno, scenaTermica(tipo)),
      ridisegna: () => posa(disegno, scenaTermica(tipo), varianteTermica()),
    });
}

/** Dopo che la pagina della gestione termica ha riscritto la sua scena: la
 * scelta dell'utente, e le maniglie se si sta modificando. */
export function dopoLaScenaTermica(tipo) {
  const disegno = TERMICHE[tipo];
  if (!disegno) return;
  posa(disegno, scenaTermica(tipo), varianteTermica());
  /* Iscriversi di nuovo rifa' le maniglie sulla scena nuova. */
  iscriviLeTermiche();
}

/* L'UPS: una scena per ogni gruppo, ognuna col suo disegno (`ups`, `ups-2`…). */
const idDellUps = (indice) => (indice ? `ups-${indice + 1}` : "ups");
const varianteUps = () => (combacia(TELEFONO_UPS) ? "telefono" : "computer");

function scenaUps(indice) {
  if (combacia(COLONNA_UPS)) return null;
  const scena = doc?.querySelectorAll?.("#page-ups .dm-ups-stage > .dm-ups-scena")?.[indice];
  return scena && visibile(scena) ? scena : null;
}

function disegnoUps(indice) {
  return { id: idDellUps(indice), pezzi: UPS_PEZZI, tubi: UPS_TUBI };
}

function iscriviGliUps(quanti) {
  for (let indice = 0; indice < quanti; indice += 1) {
    const disegno = disegnoUps(indice);
    registraIlDisegno({
      id: disegno.id,
      pagina: "ups",
      nome: () =>
        quanti > 1 ? `${t("UPS", "UPS")} ${indice + 1}` : t("UPS", "UPS"),
      scatola: () => scenaUps(indice),
      variante: varianteUps,
      nodi: () => nodiDi(disegno, scenaUps(indice)),
      ridisegna: () => posa(disegno, scenaUps(indice), varianteUps()),
    });
  }
}

/** Dopo che la pagina dell'UPS ha riscritto le sue scene. */
export function dopoLeSceneUps() {
  const quante = doc?.querySelectorAll?.("#page-ups .dm-ups-stage > .dm-ups-scena")?.length || 0;
  state.ups = Math.max(state.ups, quante);
  for (let indice = 0; indice < quante; indice += 1)
    posa(disegnoUps(indice), scenaUps(indice), varianteUps());
  iscriviGliUps(quante);
}

/* Lo schermo che passa dal computer al telefono (o il telefono che si gira)
 * cambia disegno: si posa quello dell'altra variante. */
function quandoCambiaLoSchermo() {
  for (const [tipo, disegno] of Object.entries(TERMICHE))
    posa(disegno, scenaTermica(tipo), varianteTermica());
  for (let indice = 0; indice < state.ups; indice += 1)
    posa(disegnoUps(indice), scenaUps(indice), varianteUps());
}

export function installMacchineCheSiSpostano() {
  if (!doc || state.installed) return;
  state.installed = true;
  iscriviLeTermiche();
  for (const query of [TELEFONO_TERMICO, TELEFONO_UPS, COLONNA_UPS]) {
    const lista = root.matchMedia?.(query);
    lista?.addEventListener?.("change", quandoCambiaLoSchermo);
  }
}

/* Per le prove. */
root.dmMacchine = { posa: quandoCambiaLoSchermo };

senzaCadere(installMacchineCheSiSpostano);
