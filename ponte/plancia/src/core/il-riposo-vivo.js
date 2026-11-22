/* Il riposo vivo del tablet a muro: il cielo di casa e la cornice delle foto.
 *
 * Il riposo di sempre e' l'orologio grande che si sposta piano su un fondo
 * scuro (`riposo()` in `sections/plancia-a-muro-section.js`). Da qui si puo'
 * scegliere altro, con «Stile del riposo» nel config a muro:
 *
 *  - `orologio`: quello di sempre, ed e' quello di serie. Chi non sceglie non
 *    vede cambiare niente;
 *  - `cielo`: «Cielo di casa», un fondo che segue l'ora vera e il meteo vero
 *    — azzurro di giorno, i colori dell'alba e del tramonto, le nuvole se e'
 *    nuvoloso, la pioggia, la neve, la nebbia, e di notte le stelle con la
 *    luna nella sua fase;
 *  - `foto`: «Cornice foto», le foto di casa a tutto schermo, una dopo
 *    l'altra. Le foto stanno nel ponte (`ponte/src/le-foto-del-riposo.js`) e
 *    non escono di casa; senza foto la cornice ripiega sul cielo.
 *
 * Qui ci sono solo i conti: che colore ha il cielo adesso, dov'e' il sole, in
 * che fase e' la luna, quale foto viene dopo. Niente DOM e niente stati letti
 * da soli: il pannello passa quello che sa, e tutto si prova senza browser.
 */

export const STILI_DEL_RIPOSO = Object.freeze(["orologio", "cielo", "foto"]);

/* Ogni quanto cambia la foto, in secondi: mezzo minuto, un minuto, cinque. */
export const SECONDI_PER_FOTO = Object.freeze([30, 60, 300]);

/* Le foto, come le prepara il browser prima di mandarle al ponte: il lato
 * lungo al massimo cosi', in JPEG a questa qualita'. Una foto del telefono
 * da dodici megapixel diventa qualche centinaio di kilobyte, e su un tablet
 * da dieci pollici non si vede la differenza. */
export const LATO_DELLA_FOTO = 1920;
export const QUALITA_DELLA_FOTO = 0.82;
/* La miniatura per l'elenco del config: piccola, che se ne leggono tante. */
export const LATO_DELLA_MINIATURA = 320;

/** Lo stile da disegnare: quello scelto, e la cornice senza foto e' il cielo. */
export function stileDelRiposo(riposo, quanteFoto = 0) {
  const scelto = STILI_DEL_RIPOSO.includes(riposo?.stile) ? riposo.stile : "orologio";
  if (scelto === "foto" && !(Number(quanteFoto) > 0)) return "cielo";
  return scelto;
}

/* ── la luna ────────────────────────────────────────────────────────────── */

/* Una luna nuova vera da cui contare (6 gennaio 2000, 18:14 UTC) e il mese
 * sinodico medio. La luna vera si scosta da quella media di qualche ora: per
 * disegnarla in cielo basta e avanza. */
const LUNA_NUOVA = Date.UTC(2000, 0, 6, 18, 14);
export const MESE_DELLA_LUNA = 29.530588853;
const GIORNO = 86_400_000;

/**
 * La luna di questo momento.
 *
 * `fase` va da 0 a 1: 0 la luna nuova, 0,25 il primo quarto, 0,5 la piena,
 * 0,75 l'ultimo quarto. `illuminata` e' quanto disco si vede acceso, da 0 a 1;
 * `crescente` dice da che parte: crescente la luce sta a destra (da questo
 * emisfero). `nome` e' una chiave, le parole le mette chi la scrive.
 */
export function faseDellaLuna(adesso = new Date()) {
  const quando = adesso instanceof Date ? adesso.getTime() : Number(adesso);
  const giorni = (quando - LUNA_NUOVA) / GIORNO;
  const eta = ((giorni % MESE_DELLA_LUNA) + MESE_DELLA_LUNA) % MESE_DELLA_LUNA;
  const fase = eta / MESE_DELLA_LUNA;
  const illuminata = (1 - Math.cos(2 * Math.PI * fase)) / 2;
  return { eta, fase, illuminata, crescente: fase < 0.5, nome: nomeDellaFase(fase) };
}

/* Gli otto nomi, ognuno con la sua fetta di mese attorno al suo punto. */
function nomeDellaFase(fase) {
  const ottavo = Math.round(fase * 8) % 8;
  return [
    "nuova",
    "crescente",
    "primo-quarto",
    "gibbosa-crescente",
    "piena",
    "gibbosa-calante",
    "ultimo-quarto",
    "calante",
  ][ottavo];
}

/* ── il sole ────────────────────────────────────────────────────────────── */

const ORA = 3_600_000;

const tempo = (valore) => {
  if (valore === null || valore === undefined || valore === "") return null;
  const n = valore instanceof Date ? valore.getTime() : Date.parse(String(valore));
  return Number.isFinite(n) ? n : null;
};

/* Lo stesso orario, portato al giorno di `adesso`: `sun.sun` dice la prossima
 * alba e il prossimo tramonto, e dopo il tramonto il prossimo e' domani. Per
 * il cielo di oggi serve quello di oggi, e da un giorno all'altro cambia di
 * un paio di minuti. */
function alGiornoDi(quando, adesso) {
  const oggi = new Date(adesso);
  const d = new Date(quando);
  oggi.setHours(d.getHours(), d.getMinutes(), d.getSeconds(), 0);
  return oggi.getTime();
}

/* La declinazione del sole nel giorno dell'anno, in gradi. */
function declinazione(adesso) {
  const d = new Date(adesso);
  const inizio = new Date(d.getFullYear(), 0, 1);
  const n = Math.floor((d - inizio) / GIORNO) + 1;
  return -23.44 * Math.cos(((2 * Math.PI) / 365) * (n + 10));
}

/* Quante ore d'ora legale ha adesso questo fuso: l'ora del mezzogiorno vero
 * si sposta con lei. */
function oraLegale(adesso) {
  const d = new Date(adesso);
  const gennaio = new Date(d.getFullYear(), 0, 1).getTimezoneOffset();
  const luglio = new Date(d.getFullYear(), 6, 1).getTimezoneOffset();
  return (Math.max(gennaio, luglio) - d.getTimezoneOffset()) / 60;
}

/**
 * L'alba e il tramonto di oggi, in millisecondi.
 *
 * Prima da `sun.sun` di Home Assistant (`next_rising`, `next_setting`), che
 * li sa per la casa vera. Senza, si stimano: la latitudine da `zone.home` (o
 * 45°, il nord Italia, se non c'e'), il mezzogiorno alle dodici col suo
 * spostamento per l'ora legale e — se si sa — per la longitudine. Una stima
 * che sbaglia di una ventina di minuti, e per il colore del cielo basta.
 * `stimate` dice quale delle due strade.
 */
export function oreDelSole(stati = {}, adesso = new Date()) {
  const ora = adesso instanceof Date ? adesso.getTime() : Number(adesso);
  const sole = stati?.["sun.sun"]?.attributes || {};
  const alba = tempo(sole.next_rising);
  const tramonto = tempo(sole.next_setting);
  const casa = stati?.["zone.home"]?.attributes || {};
  const latitudine = Number.isFinite(Number(casa.latitude)) ? Number(casa.latitude) : 45;
  if (alba !== null && tramonto !== null) {
    const a = alGiornoDi(alba, ora);
    const t = alGiornoDi(tramonto, ora);
    if (t > a)
      return { alba: a, tramonto: t, mezzogiorno: (a + t) / 2, latitudine, stimate: false };
  }
  const phi = (latitudine * Math.PI) / 180;
  const delta = (declinazione(ora) * Math.PI) / 180;
  const coseno = Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(delta)));
  const mezzaGiornata = ((Math.acos(coseno) * 180) / Math.PI / 15) * ORA;
  const mezzogiorno = new Date(ora);
  mezzogiorno.setHours(12, 0, 0, 0);
  let noon = mezzogiorno.getTime() + oraLegale(ora) * ORA;
  /* Con la longitudine, il mezzogiorno vero: quello del meridiano del fuso
   * (un'ora ogni quindici gradi) meno quello della casa. */
  const longitudine = Number(casa.longitude);
  if (Number.isFinite(longitudine) && casa.longitude !== "" && casa.longitude !== null) {
    const fuso = -new Date(ora).getTimezoneOffset() / 60 - oraLegale(ora);
    noon += ((fuso * 15 - longitudine) / 15) * ORA;
  }
  return {
    alba: noon - mezzaGiornata,
    tramonto: noon + mezzaGiornata,
    mezzogiorno: noon,
    latitudine,
    stimate: true,
  };
}

/**
 * Quanto e' alto il sole, in gradi: dall'attributo `elevation` di `sun.sun`
 * quando c'e', se no dalle ore del sole. Sotto zero e' sotto l'orizzonte.
 */
export function altezzaDelSole(stati = {}, adesso = new Date(), ore = oreDelSole(stati, adesso)) {
  const detta = Number(stati?.["sun.sun"]?.attributes?.elevation);
  if (stati?.["sun.sun"]?.attributes?.elevation !== undefined && Number.isFinite(detta))
    return detta;
  const ora = adesso instanceof Date ? adesso.getTime() : Number(adesso);
  const { alba, tramonto, latitudine } = ore;
  const massima = Math.max(10, 90 - Math.abs(latitudine - declinazione(ora)));
  if (ora >= alba && ora <= tramonto)
    return massima * Math.sin((Math.PI * (ora - alba)) / (tramonto - alba));
  /* Fuori dal giorno il sole scende di circa un grado ogni cinque minuti
   * vicino all'orizzonte: abbastanza per il crepuscolo, e poi si ferma. */
  const distanza = ora < alba ? alba - ora : ora - tramonto;
  const dallAltra = ora < alba ? ora + GIORNO - tramonto : alba + GIORNO - ora;
  return -Math.min(30, Math.min(distanza, dallAltra) / (5 * 60_000));
}

/** Che momento del giorno e': `notte`, `alba`, `giorno` o `tramonto`. */
export function momentoDelGiorno(altezza, mattina) {
  if (altezza < -6) return "notte";
  if (altezza < 8) return mattina ? "alba" : "tramonto";
  return "giorno";
}

/* ── i colori ───────────────────────────────────────────────────────────── */

const daEsa = (esa) => {
  const s = String(esa).replace("#", "");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const aEsa = (rgb) =>
  `#${rgb
    .map((c) =>
      Math.round(Math.max(0, Math.min(255, c)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
/** Fra due colori, alla frazione `f`. */
export function mescola(a, b, f) {
  const x = daEsa(a);
  const y = daEsa(b);
  const k = Math.max(0, Math.min(1, f));
  return aEsa(x.map((c, i) => c + (y[i] - c) * k));
}
/** Quanto e' chiaro un colore, da 0 a 1 (luminanza percepita). */
export function chiarezza(esa) {
  const [r, g, b] = daEsa(esa);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/* Il cielo sereno all'altezza del sole: alto, a meta', vicino all'orizzonte.
 * Al mattino l'orizzonte va al rosa, la sera all'arancio. */
const CIELO_DEL_MATTINO = [
  [-18, ["#03060f", "#070d1f", "#0d1730"]],
  [-10, ["#060c22", "#111c40", "#232c55"]],
  [-5, ["#121d48", "#3a3f78", "#8c6b93"]],
  [-1, ["#26407e", "#8e7bb0", "#f2a59a"]],
  [3, ["#3a63a8", "#a7b6dc", "#fbc9a0"]],
  [10, ["#3d7cc9", "#82b1e6", "#d7e7f5"]],
  [25, ["#2f7fd6", "#67a9ec", "#bfdcf6"]],
  [60, ["#2a78d0", "#5ea3ea", "#b5d8f7"]],
];
const CIELO_DELLA_SERA = [
  [-18, ["#03060f", "#070d1f", "#0d1730"]],
  [-10, ["#070b22", "#171a42", "#2e2550"]],
  [-5, ["#16184a", "#4a3570", "#b5566a"]],
  [-1, ["#2b3474", "#b2577a", "#f9894f"]],
  [3, ["#3c5da0", "#d78a7f", "#ffb565"]],
  [10, ["#3b78c2", "#8db2df", "#f3d4a6"]],
  [25, ["#2f7fd6", "#67a9ec", "#bfdcf6"]],
  [60, ["#2a78d0", "#5ea3ea", "#b5d8f7"]],
];

function sereno(altezza, mattina) {
  const tappe = mattina ? CIELO_DEL_MATTINO : CIELO_DELLA_SERA;
  if (altezza <= tappe[0][0]) return tappe[0][1];
  for (let i = 1; i < tappe.length; i += 1) {
    const [h, colori] = tappe[i];
    if (altezza <= h) {
      const [h0, prima] = tappe[i - 1];
      const f = (altezza - h0) / (h - h0);
      return prima.map((c, k) => mescola(c, colori[k], f));
    }
  }
  return tappe[tappe.length - 1][1];
}

/* Quanto copre ogni tempo di Home Assistant, da 0 (sereno) a 1 (tutto
 * grigio), e cosa ci cade dentro. Un tempo che non si conosce e' sereno: il
 * cielo non deve inventarsi la pioggia. */
const IL_TEMPO = Object.freeze({
  sunny: { copre: 0 },
  "clear-night": { copre: 0 },
  partlycloudy: { copre: 0.35, nuvole: 3 },
  cloudy: { copre: 0.8, nuvole: 6 },
  windy: { copre: 0.3, nuvole: 3, vento: true },
  "windy-variant": { copre: 0.55, nuvole: 4, vento: true },
  fog: { copre: 0.7, nebbia: 1, nuvole: 1 },
  rainy: { copre: 0.85, nuvole: 5, pioggia: 1 },
  pouring: { copre: 0.95, nuvole: 6, pioggia: 2 },
  lightning: { copre: 0.9, nuvole: 6 },
  "lightning-rainy": { copre: 0.95, nuvole: 6, pioggia: 2 },
  snowy: { copre: 0.8, nuvole: 5, neve: 1 },
  "snowy-rainy": { copre: 0.85, nuvole: 5, neve: 1, pioggia: 1 },
  hail: { copre: 0.85, nuvole: 5, pioggia: 1 },
  exceptional: { copre: 0.6, nuvole: 4 },
});

/** Il tempo di Home Assistant letto per il cielo. */
export function tempoDelCielo(condizione) {
  const t = IL_TEMPO[String(condizione || "").trim()] || IL_TEMPO.sunny;
  return {
    copre: t.copre,
    nuvole: t.nuvole || 0,
    pioggia: t.pioggia || 0,
    neve: t.neve || 0,
    nebbia: t.nebbia || 0,
    vento: Boolean(t.vento),
  };
}

/**
 * I tre colori del cielo — in alto, a meta', all'orizzonte — per l'altezza
 * del sole e il tempo. Coperto, i colori vanno verso un grigio della stessa
 * luce; con la pioggia un poco piu' scuro.
 */
export function coloriDelCielo({ altezza = 30, mattina = true, condizione = "sunny" } = {}) {
  const [alto, medio, basso] = sereno(altezza, mattina);
  const tempo = tempoDelCielo(condizione);
  const scuro = tempo.pioggia ? 0.18 + 0.1 * tempo.pioggia : 0;
  const grigio = (c) => {
    const l = chiarezza(c) * (1 - scuro);
    const g = Math.round(l * 255);
    /* Il grigio del cielo non e' neutro: tira un poco all'azzurro. */
    return aEsa([g * 0.94, g * 0.98, Math.min(255, g * 1.06 + 4)]);
  };
  const quanto = tempo.copre * 0.78;
  const coperto = (c) => mescola(c, grigio(c), quanto);
  return { alto: coperto(alto), medio: coperto(medio), basso: coperto(basso) };
}

/**
 * Tutto quello che serve per disegnare il cielo di casa adesso.
 *
 * `stati` sono gli stati di Home Assistant (servono `sun.sun` e, se c'e',
 * `zone.home`), `condizione` il tempo del meteo del tablet. Torna i colori,
 * dove sta il sole o la luna (in frazioni dello schermo), quante stelle,
 * quante nuvole, se piove o nevica, e una firma: due scene con la stessa
 * firma si disegnano uguali, e il fondo si rifa' solo quando cambia.
 */
export function scenaDelCielo({ stati = {}, condizione = "", adesso = new Date() } = {}) {
  const ora = adesso instanceof Date ? adesso : new Date(adesso);
  const ore = oreDelSole(stati, ora);
  const altezza = altezzaDelSole(stati, ora, ore);
  const mattina = ora.getTime() < ore.mezzogiorno;
  const fase = momentoDelGiorno(altezza, mattina);
  const tempo = tempoDelCielo(condizione);
  const colori = coloriDelCielo({ altezza, mattina, condizione });
  /* Il sole va da sinistra a destra con la giornata, e sale quanto e' alto.
   * Al centro, in alto, ci sono l'ora e la data: il sole e la luna ci passano
   * di lato, a sinistra nella prima meta' e a destra nella seconda, che un
   * disco bianco dietro un'ora bianca non si legge. Dietro le nuvole fitte
   * il sole non si vede. */
  const giornata = (ora.getTime() - ore.alba) / (ore.tramonto - ore.alba);
  const sole =
    altezza > -4 && tempo.copre < 0.75
      ? {
          x: diLato(giornata),
          y: 0.84 - 0.7 * Math.max(0, Math.min(1, altezza / 45)),
          velato: tempo.copre,
        }
      : null;
  /* La luna, di notte e al crepuscolo: da est a ovest lungo la notte. */
  const luna = faseDellaLuna(ora);
  const notte = altezza < -2;
  const lungoLaNotte = (() => {
    const t = ora.getTime();
    const inizio = t >= ore.tramonto ? ore.tramonto : ore.tramonto - GIORNO;
    const fine = inizio + GIORNO - (ore.tramonto - ore.alba);
    return Math.max(0, Math.min(1, (t - inizio) / Math.max(1, fine - inizio)));
  })();
  const vedeLaLuna = notte && luna.illuminata > 0.03 && tempo.copre < 0.9;
  const stelle = notte ? Math.max(0, Math.min(1, (-altezza - 4) / 8)) * (1 - tempo.copre) : 0;
  const scena = {
    fase,
    altezza,
    mattina,
    colori,
    sole,
    luna: vedeLaLuna
      ? {
          x: diLato(lungoLaNotte),
          y: 0.3 - 0.16 * Math.sin(Math.PI * lungoLaNotte),
          fase: luna.fase,
          illuminata: luna.illuminata,
          crescente: luna.crescente,
          nome: luna.nome,
          velata: tempo.copre,
        }
      : null,
    stelle,
    nuvole: tempo.nuvole,
    pioggia: tempo.pioggia,
    neve: tempo.neve,
    nebbia: tempo.nebbia,
    vento: tempo.vento,
    copre: tempo.copre,
    stimate: ore.stimate,
  };
  scena.firma = firmaDelCielo(scena);
  return scena;
}

/* Da 0 a 1 lungo il giorno (o la notte), il posto sullo schermo: da 0,08 a
 * 0,2 nella prima meta', da 0,8 a 0,92 nella seconda. */
function diLato(quanto) {
  const t = Math.max(0, Math.min(1, quanto));
  return t < 0.5 ? 0.08 + 0.24 * t : 0.8 + 0.24 * (t - 0.5);
}

/* La firma: il fondo si ridipinge quando il sole si e' spostato di un grado
 * o il tempo e' cambiato, non a ogni giro del pannello. */
function firmaDelCielo(s) {
  const posto = (p) => (p ? `${Math.round(p.x * 50)},${Math.round(p.y * 50)}` : "-");
  return [
    s.fase,
    Math.round(s.altezza),
    s.colori.alto,
    s.colori.basso,
    posto(s.sole),
    posto(s.luna),
    s.luna ? Math.round(s.luna.fase * 60) : "-",
    Math.round(s.stelle * 10),
    s.nuvole,
    s.pioggia,
    s.neve,
    s.nebbia,
  ].join("|");
}

/** Quanti fotogrammi al secondo servono per quello che si muove: la pioggia e
 * la neve qualcuno di piu', le nuvole e la nebbia pochissimi, il cielo fermo
 * nessuno. */
export function fotogrammiDelCielo(scena) {
  if (!scena) return 0;
  if (scena.pioggia || scena.neve) return 12;
  if (scena.nuvole || scena.nebbia || scena.stelle > 0.2) return 5;
  return 0;
}

/* ── le foto ────────────────────────────────────────────────────────────── */

/* I numeri a caso, sempre gli stessi per lo stesso seme. */
function aCaso(seme) {
  let s = (Math.abs(Math.floor(Number(seme) || 1)) % 2147483646) + 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* Un numero da una parola: lo stesso nome, lo stesso numero. */
function impronta(testo) {
  let h = 2166136261;
  for (const c of String(testo)) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/**
 * L'ordine in cui passano le foto: mescolate, ma sempre allo stesso modo per
 * lo stesso giro. Ogni foto passa una volta prima che una passi di nuovo, e
 * un giro nuovo ha un ordine nuovo.
 */
export function ordineDelleFoto(nomi = [], giro = 0) {
  const elenco = [...new Set((Array.isArray(nomi) ? nomi : []).map(String))].sort();
  const caso = aCaso(impronta(elenco.join("|")) + Number(giro) * 7919);
  for (let i = elenco.length - 1; i > 0; i -= 1) {
    const j = Math.floor(caso() * (i + 1));
    [elenco[i], elenco[j]] = [elenco[j], elenco[i]];
  }
  return elenco;
}

/**
 * La foto che viene dopo `attuale`, e a che giro siamo.
 *
 * Torna `{ nome, giro }`, o `null` senza foto. Una foto sola resta quella. A
 * fine giro se ne comincia un altro, e la prima del giro nuovo non e' mai
 * l'ultima di quello prima: due volte di fila la stessa foto sembrerebbe un
 * tablet fermo.
 */
export function fotoSuccessiva(nomi = [], attuale = "", giro = 0) {
  const ordine = ordineDelleFoto(nomi, giro);
  if (!ordine.length) return null;
  if (ordine.length === 1) return { nome: ordine[0], giro };
  const qui = ordine.indexOf(String(attuale));
  if (qui < 0) return { nome: ordine[0], giro };
  if (qui < ordine.length - 1) return { nome: ordine[qui + 1], giro };
  const dopo = ordineDelleFoto(nomi, giro + 1);
  const prima = dopo[0] === ordine[qui] ? dopo[1] : dopo[0];
  return { nome: prima, giro: giro + 1 };
}

/**
 * Il movimento lento di una foto (il «Ken Burns»): da dove parte e dove
 * arriva, in scala e spostamento percentuale. Sempre lo stesso per la stessa
 * foto, e diverso da una foto all'altra: chi avvicina, chi allontana, chi va
 * a destra.
 */
export function movimentoDellaFoto(nome = "") {
  const caso = aCaso(impronta(nome) || 1);
  const avvicina = caso() < 0.6;
  const piccola = 1.02 + caso() * 0.03;
  const grande = 1.1 + caso() * 0.06;
  /* Lo spostamento resta dentro quello che la scala lascia libero: una foto
   * ingrandita del 4% si puo' spostare di meno del 2% per lato, se no si
   * vede il bordo. */
  const sposta = (scala) => (caso() * 2 - 1) * (scala - 1) * 45;
  const sda = avvicina ? piccola : grande;
  const sa = avvicina ? grande : piccola;
  const da = { scala: sda, x: sposta(sda), y: sposta(sda) };
  const a = { scala: sa, x: sposta(sa), y: sposta(sa) };
  const fisso = (n) => Math.round(n * 1000) / 1000;
  return {
    da: { scala: fisso(da.scala), x: fisso(da.x), y: fisso(da.y) },
    a: { scala: fisso(a.scala), x: fisso(a.x), y: fisso(a.y) },
  };
}

/**
 * La misura a cui si rimpicciolisce una foto: il lato lungo al massimo
 * `lato`, le proporzioni come sono, e mai piu' grande dell'originale.
 */
export function misuraRidotta(larghezza, altezza, lato = LATO_DELLA_FOTO) {
  const w = Math.max(1, Math.round(Number(larghezza) || 1));
  const h = Math.max(1, Math.round(Number(altezza) || 1));
  const lungo = Math.max(w, h);
  if (lungo <= lato) return { larghezza: w, altezza: h };
  const k = lato / lungo;
  return { larghezza: Math.max(1, Math.round(w * k)), altezza: Math.max(1, Math.round(h * k)) };
}

/** I secondi fra una foto e l'altra, puliti: quelli dell'elenco o un minuto. */
export function secondiPerFoto(valore) {
  const n = Number(valore);
  return SECONDI_PER_FOTO.includes(n) ? n : 60;
}

/**
 * Il riposo di notte: `nero` come sempre, `minimo` con «Anche di notte, al
 * minimo», `giorno` quando non e' notte.
 */
export function riposoDiNotte({ notte = false, alMinimo = false } = {}) {
  if (!notte) return "giorno";
  return alMinimo ? "minimo" : "nero";
}
