/* La scena delle luci di Natale: cosa c'e', dove sta, e che ora del giorno e'.
 *
 * Il riquadro delle luci in Home non e' una fila di tessere: e' un paesaggio
 * d'inverno dove ogni luce e' la cosa vera — l'abete coi festoni, il presepe
 * nella capanna, la casa con le lucine sulla grondaia e sul balcone, le
 * candele alla finestra, la stella cometa, una catena di lucine in giardino.
 * Qui ci sono solo i conti che lo decidono, senza DOM:
 *
 *  - QUALI COSE: dalle luci configurate, col loro tipo (`tipoDellaLuce` in
 *    `core/feste.js`). Nella scena compare solo quello che c'e': senza un
 *    presepe niente capanna, con il solo albero il solo albero;
 *  - DOVE: una fila in piedi sulla neve, centrata nello spazio che resta
 *    accanto ai comandi, che si stringe (e poco poco si accavalla) quando lo
 *    spazio e' poco;
 *  - CHE CIELO: l'altezza del sole di `sun.sun` (o l'ora, senza) e i colori
 *    del cielo del riposo del tablet (`core/il-riposo-vivo.js`): la scena non
 *    se ne inventa altri. Di mattina e' chiaro, al tramonto arancio, di notte
 *    blu con la luna nella sua fase e le stelle. Sotto il cielo, i colori
 *    delle cose (la neve, il legno, i muri) passano dal giorno alla notte con
 *    la stessa altezza del sole.
 *
 * ── Piu' luci dello stesso tipo ───────────────────────────────────────────
 *
 * Un albero resta un albero anche con due prese: i suoi festoni si dividono
 * fra le luci, a turno, e ognuna accende i suoi. Lo stesso la casa (la
 * grondaia, la tenda, la ringhiera; le finestre una per una) e il presepe (la
 * capanna, la lanterna). Le ghirlande, che sono catene qualunque, stanno in
 * due posti — una a destra, una a sinistra — e oltre la seconda si dividono
 * i due. Toccare una cosa nella scena accende o spegne tutte le sue luci.
 */
import { TIPI_DELLE_LUCI, tipoDellaLuce } from "./feste.js";
import {
  chiarezza,
  coloriDelCielo,
  mescola,
  scenaDelCielo,
  tempoDelCielo,
} from "./il-riposo-vivo.js";

const clamp = (valore, minimo, massimo) => Math.max(minimo, Math.min(massimo, valore));
const tondo = (valore, cifre = 1) => Math.round(valore * 10 ** cifre) / 10 ** cifre;

/* ── il cielo ───────────────────────────────────────────────────────────── */

/**
 * Il momento della giornata della scena: `alba`, `giorno`, `tramonto`,
 * `sera` o `notte`. Il giorno comincia quando il sole e' a otto gradi; la
 * sera e' l'ora blu dopo il tramonto, finche' il sole non e' dodici gradi
 * sotto l'orizzonte; prima dell'alba e' ancora notte fino a sei gradi sotto.
 */
export function faseDelCielo(altezza, mattina) {
  if (altezza >= 8) return "giorno";
  if (mattina) return altezza >= -6 ? "alba" : "notte";
  if (altezza >= -5) return "tramonto";
  if (altezza >= -12) return "sera";
  return "notte";
}

/* Il blu della notte della scena. Il cielo del riposo di notte e' quasi nero —
 * giusto per un tablet al buio in camera — ma qui accanto alle lucine serve
 * un blu che si legga: la notte fonda ne prende un poco. */
const BLU_DELLA_NOTTE = ["#081333", "#14244f", "#2a3566"];

/* I colori delle cose, a tre ore del giorno. Fra l'una e l'altra si mescola
 * con l'altezza del sole; il crepuscolo di sera tira all'arancio e al
 * lilla, quello del mattino al rosa. */
const COLORI = Object.freeze({
  giorno: {
    monte: "#a9bfdc",
    monteNeve: "#eef4fb",
    colle: "#d3dfee",
    abeteLontano: "#5d8379",
    neve1: "#ffffff",
    neve2: "#dce7f4",
    neveOmbra: "#b9cbe2",
    abete1: "#3c8a5a",
    abete2: "#26704a",
    abete3: "#16523a",
    legno: "#8d5b37",
    legno2: "#603b22",
    paglia: "#d9b56c",
    muro: "#f0dfc2",
    muro2: "#d8c19d",
    tetto: "#8f4434",
    mattone: "#a3563d",
    porta: "#7b2d2a",
    persiana: "#4f7a64",
    ferro: "#2e3443",
    vetro: "#6f86a8",
    interno: "#3d2a1d",
    sagoma: "#2c1c12",
    filo: "#3a3f4a",
    spenta: "#8a93a3",
    nuvola: "#ffffff",
    ombra: "#9db3d3",
    pannello: "#f5f8fd",
  },
  sera: {
    monte: "#4d4a7c",
    monteNeve: "#b7a4c6",
    colle: "#6e6896",
    abeteLontano: "#2b2b52",
    neve1: "#ead9e3",
    neve2: "#a99cc4",
    neveOmbra: "#8a7fb0",
    abete1: "#2f6a55",
    abete2: "#1f5242",
    abete3: "#123a2f",
    legno: "#6a432c",
    legno2: "#43291b",
    paglia: "#a68a5e",
    muro: "#a8879a",
    muro2: "#83677f",
    tetto: "#5c2c34",
    mattone: "#7a3d3c",
    porta: "#5a2230",
    persiana: "#2f4c4c",
    ferro: "#262338",
    vetro: "#3b3a66",
    interno: "#2a1a16",
    sagoma: "#1f120c",
    filo: "#2b2838",
    spenta: "#5d5878",
    nuvola: "#d2c6e2",
    ombra: "#6f679a",
    pannello: "#231f42",
  },
  alba: {
    monte: "#6d6c9c",
    monteNeve: "#e2c6d2",
    colle: "#9d97bf",
    abeteLontano: "#3c3d63",
    neve1: "#f8e8ec",
    neve2: "#c3bcda",
    neveOmbra: "#a09bc4",
    abete1: "#34735b",
    abete2: "#235c48",
    abete3: "#164233",
    legno: "#76492f",
    legno2: "#4b2e1e",
    paglia: "#b99a68",
    muro: "#c7a8ad",
    muro2: "#a2869a",
    tetto: "#6b3238",
    mattone: "#86453f",
    porta: "#632535",
    persiana: "#3a5856",
    ferro: "#2a2839",
    vetro: "#545b86",
    interno: "#2f1e18",
    sagoma: "#22140d",
    filo: "#2e2b3b",
    spenta: "#6c6886",
    nuvola: "#efe2ee",
    ombra: "#8580b0",
    pannello: "#2a2a52",
  },
  notte: {
    monte: "#17244c",
    monteNeve: "#4a5d93",
    colle: "#22346a",
    abeteLontano: "#0f1b40",
    neve1: "#cdd9ef",
    neve2: "#8597c2",
    neveOmbra: "#6377a8",
    abete1: "#1f5a45",
    abete2: "#144232",
    abete3: "#0b2c21",
    legno: "#4c3122",
    legno2: "#2e1d14",
    paglia: "#6f5b3c",
    muro: "#3d4469",
    muro2: "#2d3355",
    tetto: "#3a2432",
    mattone: "#4a2a30",
    porta: "#4a1d26",
    persiana: "#1e3340",
    ferro: "#151a2d",
    vetro: "#1a2244",
    interno: "#170f0c",
    sagoma: "#120a07",
    filo: "#1c2133",
    spenta: "#3a4362",
    nuvola: "#56658f",
    ombra: "#4e6094",
    pannello: "#0d1838",
  },
});

/* Le cose che non sono colori: quanto si vedono le stelle e le luci del
 * paese lontano, quanto sono accese le finestre di una casa abitata, quanto
 * pesa l'alone delle lampadine. Di giorno le luci accese si vedono lo
 * stesso, ma l'alone e' piccolo: fa luce il sole. */
const MISURE_DELLA_LUCE = Object.freeze({
  giorno: { paese: 0, abitata: 0, alone: 0.45, bagliore: 0.3, riflesso: 0.35 },
  sera: { paese: 0.85, abitata: 0.75, alone: 0.9, bagliore: 0.8, riflesso: 0.8 },
  alba: { paese: 0.5, abitata: 0.5, alone: 0.8, bagliore: 0.7, riflesso: 0.7 },
  notte: { paese: 1, abitata: 0.8, alone: 1, bagliore: 1, riflesso: 1 },
});

function mescolaTavole(a, b, f) {
  const fuori = {};
  for (const chiave of Object.keys(a))
    fuori[chiave] =
      typeof a[chiave] === "number"
        ? tondo(a[chiave] + (b[chiave] - a[chiave]) * clamp(f, 0, 1), 2)
        : mescola(a[chiave], b[chiave], f);
  return fuori;
}

/**
 * I colori delle cose e le misure della luce per l'altezza del sole: dalla
 * notte (dodici gradi sotto) al crepuscolo (tre sotto) al giorno (dieci
 * sopra), mescolati in mezzo.
 */
export function coloriDellaScena(altezza = 30, mattina = true) {
  const crepuscolo = mattina ? "alba" : "sera";
  const tavola = (nome) => ({ ...COLORI[nome], ...MISURE_DELLA_LUCE[nome] });
  if (altezza <= -12) return tavola("notte");
  if (altezza >= 10) return tavola("giorno");
  if (altezza <= -3) return mescolaTavole(tavola("notte"), tavola(crepuscolo), (altezza + 12) / 9);
  return mescolaTavole(tavola(crepuscolo), tavola("giorno"), (altezza + 3) / 13);
}

/**
 * Il cielo della scena adesso: la fase, i tre colori del cielo, i colori
 * delle cose, il sole o la luna, le stelle, le nuvole, e se il cielo e' chiaro
 * (il testo che ci sta sopra allora e' scuro).
 *
 * `stati` sono gli stati di Home Assistant (serve `sun.sun`; senza, si stima
 * dall'ora come fa il riposo), `condizione` il tempo dell'entita' meteo.
 */
export function cieloDellaScena({ stati = {}, condizione = "", adesso = new Date() } = {}) {
  const s = scenaDelCielo({ stati, condizione, adesso });
  /* La mattina d'inverno, appena sorto il sole, e' gia' giorno: il sole sta
   * basso fino a meta' mattina, e un cielo da crepuscolo alle otto e mezza
   * sembra la sera. Le cose e il cielo prendono la luce del giorno presto,
   * da quando il sole spunta; la sera invece il crepuscolo resta lungo,
   * che e' l'ora delle lucine. */
  const luce = s.mattina && s.altezza > -1 ? Math.max(s.altezza, s.altezza * 2.5 + 4) : s.altezza;
  const fase = faseDelCielo(luce, s.mattina);
  const notte = clamp((-s.altezza - 2) / 10, 0, 0.62);
  let base = s.colori;
  if (luce !== s.altezza) {
    const giorno = coloriDelCielo({ altezza: Math.min(25, luce), mattina: true, condizione });
    const f = clamp((s.altezza + 1) / 4, 0, 1);
    base = {
      alto: mescola(s.colori.alto, giorno.alto, f),
      medio: mescola(s.colori.medio, giorno.medio, f),
      basso: mescola(s.colori.basso, giorno.basso, f),
    };
  }
  /* Di giorno col cielo coperto il grigio e' luminoso, grigio-azzurro: un
   * grigio scuro a mezzogiorno sembrerebbe un temporale. */
  const copre = tempoDelCielo(condizione).copre;
  const schiarita = copre * clamp(luce / 10, 0, 1) * 0.5;
  const cielo = {
    alto: mescola(mescola(base.alto, BLU_DELLA_NOTTE[0], notte), "#c3d1e3", schiarita),
    medio: mescola(mescola(base.medio, BLU_DELLA_NOTTE[1], notte), "#d9e2ee", schiarita),
    basso: mescola(mescola(base.basso, BLU_DELLA_NOTTE[2], notte), "#edf1f7", schiarita),
  };
  const colori = coloriDellaScena(luce, s.mattina);
  /* Il testo sta in alto a sinistra: conta la parte alta del cielo. */
  const chiaro = chiarezza(mescola(cielo.alto, cielo.medio, 0.55)) > 0.42;
  const scena = {
    fase,
    altezza: tondo(s.altezza),
    mattina: s.mattina,
    cielo,
    colori,
    chiaro,
    pannelloChiaro: chiarezza(colori.pannello) > 0.5,
    /* Il sole: quanto e' alto sullo schermo, da 0 (in cima) a 1 (in fondo). */
    sole: s.sole ? { y: tondo(s.sole.y, 2), velato: s.sole.velato } : null,
    luna: s.luna
      ? {
          fase: tondo(s.luna.fase, 2),
          illuminata: tondo(s.luna.illuminata, 2),
          crescente: s.luna.crescente,
          velata: s.luna.velata,
        }
      : null,
    stelle: tondo(s.stelle, 2),
    /* Le nuvole: di giorno una in piu' anche col sereno, che un cielo
     * azzurro vuoto sembra finto; di notte solo col cielo coperto, che una
     * nuvola scura sul blu e' una macchia. */
    nuvole:
      fase === "sera" || fase === "notte"
        ? s.copre >= 0.5
          ? Math.min(2, s.nuvole)
          : 0
        : Math.min(3, s.nuvole + (fase === "giorno" ? 1 : 0)),
    /* I fiocchi che cadono: quando nevica davvero, e di sera e di notte, che
     * sono le ore delle lucine. */
    fiocchi: Boolean(s.neve) || fase === "sera" || fase === "notte",
  };
  scena.firma = [
    fase,
    scena.sole ? Math.round(scena.sole.y * 20) : "-",
    scena.luna ? `${Math.round(scena.luna.fase * 30)}` : "-",
    scena.stelle > 0 ? "s" : "-",
    scena.nuvole,
    scena.fiocchi ? "f" : "-",
  ].join("|");
  return scena;
}

/* I nomi delle variabili CSS, scritti per intero: chi legge il foglio della
 * scena (`sections/la-scena-delle-luci.js`) li ritrova qui. */
const VARIABILI = Object.freeze({
  monte: "--sc-monte",
  monteNeve: "--sc-monte-neve",
  colle: "--sc-colle",
  abeteLontano: "--sc-abete-lontano",
  neve1: "--sc-neve1",
  neve2: "--sc-neve2",
  neveOmbra: "--sc-neve-ombra",
  abete1: "--sc-abete1",
  abete2: "--sc-abete2",
  abete3: "--sc-abete3",
  legno: "--sc-legno",
  legno2: "--sc-legno2",
  paglia: "--sc-paglia",
  muro: "--sc-muro",
  muro2: "--sc-muro2",
  tetto: "--sc-tetto",
  mattone: "--sc-mattone",
  porta: "--sc-porta",
  persiana: "--sc-persiana",
  ferro: "--sc-ferro",
  vetro: "--sc-vetro",
  interno: "--sc-interno",
  sagoma: "--sc-sagoma",
  filo: "--sc-filo",
  spenta: "--sc-spenta",
  nuvola: "--sc-nuvola",
  ombra: "--sc-ombra",
  pannello: "--sc-pannello",
  paese: "--sc-paese",
  abitata: "--sc-abitata",
  alone: "--sc-alone",
  bagliore: "--sc-bagliore",
  riflesso: "--sc-riflesso",
});

/**
 * Le variabili CSS della scena: i colori del cielo e delle cose, e le misure
 * della luce. La scena le legge tutte da qui, cosi' quando il cielo cambia
 * col passare dei minuti si cambiano le variabili e non si ridisegna niente.
 */
export function variabiliDellaScena(scena) {
  const v = {
    "--sc-c1": scena.cielo.alto,
    "--sc-c2": scena.cielo.medio,
    "--sc-c3": scena.cielo.basso,
    "--sc-stelle": String(scena.stelle),
  };
  for (const [chiave, nome] of Object.entries(VARIABILI)) v[nome] = String(scena.colori[chiave]);
  return v;
}

/* ── i giochi delle lampadine ───────────────────────────────────────────── *
 *
 * «Riesci a fare qualcosa di più animato, tipo le luci sull'albero a
 * intermittenza?» Come le centraline delle luci vere, le lampadine accese
 * girano fra qualche gioco, sempre gli stessi e sempre nello stesso ordine:
 *
 *   · «alterna»: meta' accese e meta' spente, e si scambiano;
 *   · «rincorsa»: un tratto acceso che corre lungo il filo;
 *   · «respiro»: tutte insieme, piano, si abbassano e tornano;
 *   · «scintille»: qua e la', a caso;
 *   · e un momento tutte accese, ferme.
 *
 * Ogni lampadina sta in uno di `GRUPPI_DELLE_LAMPADINE` gruppi (in fila lungo
 * il filo: la rincorsa corre); qui c'e', per ogni gruppo, quanto e' accesa a
 * ogni passo del giro. Il disegno ne fa un'animazione CSS a scatti
 * (`passi(1)`): pochi ridisegni al secondo, come il resto della scena —
 * i tablet a muro sono economici. «Spenta» non e' buia: si vede il vetro. */
export const GRUPPI_DELLE_LAMPADINE = 6;
export const PASSO_DEI_GIOCHI_S = 0.35;
export const GIOCHI_DELLE_LUCI = Object.freeze([
  ["alterna", 24],
  ["rincorsa", 24],
  ["respiro", 16],
  ["scintille", 8],
  ["ferme", 8],
]);
export const LUCE_BASSA = 0.16;

/* Un numero a caso, sempre lo stesso per lo stesso gruppo e lo stesso passo. */
const scintilla = (g, t) => {
  const x = Math.sin((g + 1) * 12.9898 + (t + 1) * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Quanto e' accesa (fra `LUCE_BASSA` e 1) una lampadina del gruppo `g` a ogni passo del giro. */
export function programmaDelleLuci(g) {
  const gruppo =
    (((Math.floor(Number(g)) || 0) % GRUPPI_DELLE_LAMPADINE) + GRUPPI_DELLE_LAMPADINE) %
    GRUPPI_DELLE_LAMPADINE;
  const passi = [];
  for (const [gioco, quanti] of GIOCHI_DELLE_LUCI)
    for (let t = 0; t < quanti; t += 1) {
      let luce = 1;
      if (gioco === "alterna") luce = (Math.floor(t / 2) + gruppo) % 2 === 0 ? 1 : LUCE_BASSA;
      else if (gioco === "rincorsa") luce = (((t - gruppo) % 6) + 6) % 6 < 3 ? 1 : LUCE_BASSA;
      else if (gioco === "respiro")
        luce = LUCE_BASSA + (1 - LUCE_BASSA) * (0.5 + 0.5 * Math.cos((2 * Math.PI * t) / 8));
      else if (gioco === "scintille") luce = scintilla(gruppo, t) > 0.45 ? 1 : LUCE_BASSA;
      passi.push(Math.round(luce * 100) / 100);
    }
  return passi;
}

/* ── le cose ────────────────────────────────────────────────────────────── */

/* Quanto e' grande ogni cosa, a scala uno, in unita' della scena (alta 300):
 * la larghezza che occupa nella fila e l'altezza sopra la neve. La stella
 * senza presepe non sta per terra: occupa un posto nella fila, in cielo. */
export const MISURE_DELLE_COSE = Object.freeze({
  albero: { larghezza: 196, altezza: 226 },
  presepe: { larghezza: 224, altezza: 158 },
  casa: { larghezza: 252, altezza: 232 },
  ghirlanda: { larghezza: 232, altezza: 136 },
  stella: { larghezza: 112, altezza: 150 },
});

/** Le luci divise a turno fra `quante` parti: la parte `k` e' della luce `k % n`. */
export function partiDivise(entita, quante) {
  const elenco = Array.isArray(entita) ? entita : [];
  if (!elenco.length) return Array.from({ length: quante }, () => "");
  return Array.from({ length: quante }, (_, k) => elenco[k % elenco.length]);
}

/**
 * Le cose della scena per queste luci, da sinistra a destra.
 *
 * `nomi` sono i nomi di Home Assistant delle entita' (per indovinare il tipo
 * di una luce che non l'ha scelto). Ogni cosa ha `tipo`, una `chiave` unica e
 * le `entita` che la accendono; la casa dice anche quali sono del balcone e
 * quali delle finestre, il presepe quali della sua stella cometa.
 */
export function coseDellaScena(luci = [], nomi = {}) {
  const per = Object.fromEntries(TIPI_DELLE_LUCI.map((tipo) => [tipo, []]));
  for (const luce of Array.isArray(luci) ? luci : []) {
    if (!luce?.entity) continue;
    per[tipoDellaLuce(luce, nomi?.[luce.entity])].push(luce.entity);
  }
  const ghirlande =
    per.ghirlanda.length > 1
      ? [0, 1].map((posto) => per.ghirlanda.filter((_, i) => i % 2 === posto))
      : per.ghirlanda.length
        ? [per.ghirlanda]
        : [];
  const cose = [];
  if (ghirlande[1]) cose.push({ tipo: "ghirlanda", chiave: "ghirlanda-2", entita: ghirlande[1] });
  if (per.albero.length) cose.push({ tipo: "albero", chiave: "albero", entita: per.albero });
  if (per.presepe.length)
    cose.push({
      tipo: "presepe",
      chiave: "presepe",
      entita: [...per.presepe, ...per.stella],
      presepe: per.presepe,
      stella: per.stella,
    });
  else if (per.stella.length) cose.push({ tipo: "stella", chiave: "stella", entita: per.stella });
  if (per.balcone.length || per.finestra.length)
    cose.push({
      tipo: "casa",
      chiave: "casa",
      entita: [...per.balcone, ...per.finestra],
      balcone: per.balcone,
      finestra: per.finestra,
    });
  if (ghirlande[0]) cose.push({ tipo: "ghirlanda", chiave: "ghirlanda", entita: ghirlande[0] });
  return cose;
}

/**
 * Dove sta ogni cosa: la fila centrata fra `da` e `a`, in piedi su `terra`,
 * mai piu' alta di `cima`. Torna le cose con `x` (il centro), `scala` e
 * `larghezza`.
 *
 * Prima si prova con un po' d'aria fra una cosa e l'altra; se la scala
 * scende troppo l'aria si toglie, e se non basta ancora le cose si
 * accavallano di poco — una casa un po' davanti al presepe si legge, un
 * presepe grande come un francobollo no.
 */
export function disposizioneDellaScena(
  cose = [],
  { larghezza = 1200, da = 0, a = larghezza, terra = 252, cima = 14, massima = 1.12 } = {},
) {
  const n = cose.length;
  if (!n) return [];
  const misure = cose.map((cosa) => MISURE_DELLE_COSE[cosa.tipo] || MISURE_DELLE_COSE.ghirlanda);
  const somma = misure.reduce((tot, m) => tot + m.larghezza, 0);
  const spazio = Math.max(1, a - da);
  const alta = Math.max(...misure.map((m) => m.altezza));
  const tetto = Math.min(massima, (terra - cima) / alta);
  const prova = (aria) => Math.min(tetto, spazio / (somma + aria * (n - 1)));
  let aria = 30;
  let scala = prova(aria);
  if (scala < 0.8 && n > 1) {
    aria = 2;
    scala = prova(aria);
  }
  if (scala < 0.64 && n > 1) {
    aria = -(somma * 0.09) / (n - 1);
    scala = prova(aria);
  }
  scala = Math.max(0.4, scala);
  const tutta = (somma + aria * (n - 1)) * scala;
  let x = da + (spazio - tutta) / 2;
  return cose.map((cosa, i) => {
    const l = misure[i].larghezza * scala;
    const posto = { ...cosa, x: tondo(x + l / 2), scala: tondo(scala, 3), larghezza: tondo(l) };
    x += l + aria * scala;
    return posto;
  });
}

/**
 * Le chiamate per un tocco su una cosa della scena: se almeno una delle sue
 * luci e' accesa le spegne tutte, se no le accende tutte. Una chiamata per
 * dominio, come «Accendi tutte».
 */
export function chiamateDelTocco(entita = [], accesa = () => false) {
  const elenco = (Array.isArray(entita) ? entita : []).filter(Boolean);
  const verso = elenco.some((e) => accesa(e)) ? "turn_off" : "turn_on";
  const perDominio = new Map();
  for (const id of elenco) {
    const dominio = id.split(".")[0];
    if (!perDominio.has(dominio)) perDominio.set(dominio, []);
    perDominio.get(dominio).push(id);
  }
  return [...perDominio].map(([domain, entity_id]) => ({
    domain,
    service: verso,
    data: { entity_id },
  }));
}

/**
 * Le parole per chi non vede, una per cosa della scena: i nomi delle sue
 * luci. `nomeDi` da' il nome di un'entita'. La casa con le lucine fuori e le
 * candele dentro ha due cose da toccare: il balcone e le finestre.
 */
export function etichetteDellaScena(cose = [], nomeDi = (e) => e) {
  const di = (entita) => (entita || []).map((e) => nomeDi(e) || e).join(", ");
  const etichette = {};
  for (const cosa of cose) {
    let sue = cosa.entita;
    if (cosa.tipo === "presepe") sue = cosa.presepe;
    else if (cosa.tipo === "casa" && cosa.balcone?.length) sue = cosa.balcone;
    etichette[cosa.chiave] = di(sue);
    if (cosa.tipo === "presepe" && cosa.stella?.length) etichette.stella = di(cosa.stella);
    if (cosa.tipo === "casa" && cosa.finestra?.length) etichette.finestre = di(cosa.finestra);
  }
  return etichette;
}
