/* L'immagine di un riquadro: una foto di casa, o un disegno da riquadro.
 *
 * «Riquadri con l'immagine»: un riquadro della plancia — un posto «A muro»,
 * un dispositivo della Home, una presa — puo' portare un'immagine che lo
 * riempie tutto, al posto del dischetto col disegno. Sotto, in fondo, un velo
 * scuro con il nome e lo stato in bianco: si leggono su qualunque foto. Acceso,
 * l'immagine piena e un alone del colore della sezione; spento, la stessa
 * immagine in grigio e piu' scura.
 *
 * In configurazione si scrive cosi':
 *
 *     immagine: { src, fuoco: [x%, y%], zoom }
 *
 * - `src` e' l'indirizzo di una foto caricata dalla plancia — la serve il
 *   ponte (`/dashboardmodern_static/www/…`) o Home Assistant (`/local/…`),
 *   comunque dalla stessa casa — oppure `disegno:<chiave>`, un disegno del
 *   catalogo (`disegni-da-riquadro.js`);
 * - `fuoco` e' dove guardare: il punto della foto che resta fermo quando un
 *   riquadro la taglia. Si salva solo quello, non il taglio: la foto resta
 *   intera, e ogni forma di riquadro (quadrato in Home, 3:2 a muro) la taglia
 *   da li';
 * - `zoom` e' quanto avvicinarsi, da 1 a 3.
 *
 * Questo file non tocca la pagina: pulisce quello che arriva dalla
 * configurazione e calcola come si disegna. Tutto si prova senza browser. */

import { disegnoDaRiquadro } from "./disegni-da-riquadro.js";

/* Le cartelle da cui una foto puo' arrivare. Un indirizzo intero
 * (`https://…`) no: la foto di un riquadro resta in casa, e un riquadro che
 * chiama un server esterno a ogni giro della plancia direbbe a quel server
 * quando la casa e' accesa. Niente `data:` scritti a mano, niente `..`. */
export const CARTELLE_DELLE_FOTO = Object.freeze(["/dashboardmodern_static/www/", "/local/"]);
export const PREFISSO_DEL_DISEGNO = "disegno:";
export const ZOOM_MINIMO = 1;
export const ZOOM_MASSIMO = 3;
const LUNGHEZZA_MASSIMA = 300;
const PEZZO = /^[A-Za-z0-9_\-.@+~]+$/;
const SUFFISSI = /\.(png|jpe?g|webp|gif|avif|bmp)$/i;

/** L'indirizzo pulito, o "" se non e' uno che un riquadro puo' mostrare. */
export function srcPulito(valore) {
  const src = String(valore ?? "").trim();
  if (!src || src.length > LUNGHEZZA_MASSIMA) return "";
  if (src.startsWith(PREFISSO_DEL_DISEGNO)) {
    const chiave = src.slice(PREFISSO_DEL_DISEGNO.length);
    return disegnoDaRiquadro(chiave) ? `${PREFISSO_DEL_DISEGNO}${chiave}` : "";
  }
  const cartella = CARTELLE_DELLE_FOTO.find((c) => src.startsWith(c));
  if (!cartella) return "";
  const pezzi = src.slice(cartella.length).split("/");
  if (!pezzi.length || !pezzi.every((p) => p && p !== "." && p !== ".." && PEZZO.test(p)))
    return "";
  return SUFFISSI.test(pezzi[pezzi.length - 1]) ? src : "";
}

/** La chiave del disegno, se l'immagine e' un disegno del catalogo. */
export function chiaveDelDisegno(immagine) {
  const src = String(immagine?.src ?? "");
  return src.startsWith(PREFISSO_DEL_DISEGNO) ? src.slice(PREFISSO_DEL_DISEGNO.length) : "";
}

const tra = (numero, minimo, massimo) => Math.min(massimo, Math.max(minimo, numero));
const numeroOppure = (valore, ripiego) => {
  /* `Number(null)` e `Number("")` fanno zero: qui vuoto vuol dire «non detto». */
  if (valore === null || valore === undefined || valore === "") return ripiego;
  const n = Number(valore);
  return Number.isFinite(n) ? n : ripiego;
};
const decimo = (n) => Math.round(n * 10) / 10;
const centesimo = (n) => Math.round(n * 100) / 100;

/**
 * L'immagine come la si salva, o `null`.
 *
 * Un `src` che non e' di casa o un disegno che il catalogo non conosce vuol
 * dire niente immagine: il riquadro torna quello di sempre, col suo disegno,
 * invece di mostrare un buco. I numeri si tengono dentro i loro confini:
 * il fuoco fra 0 e 100, lo zoom fra 1 e 3.
 */
export function immaginePulita(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const src = srcPulito(input.src);
  if (!src) return null;
  const disegno = disegnoDaRiquadro(chiaveDelDisegno({ src }));
  const [x0, y0] = disegno?.fuoco || [50, 50];
  const fuoco = Array.isArray(input.fuoco) ? input.fuoco : [];
  return {
    src,
    fuoco: [
      decimo(tra(numeroOppure(fuoco[0], x0), 0, 100)),
      decimo(tra(numeroOppure(fuoco[1], y0), 0, 100)),
    ],
    zoom: centesimo(tra(numeroOppure(input.zoom, 1), ZOOM_MINIMO, ZOOM_MASSIMO)),
  };
}

/** Le immagini uguali non si riscrivono: la configurazione non cambia per niente. */
export function stessaImmagine(a, b) {
  const pa = immaginePulita(a);
  const pb = immaginePulita(b);
  if (!pa || !pb) return pa === pb;
  return (
    pa.src === pb.src &&
    pa.zoom === pb.zoom &&
    pa.fuoco[0] === pb.fuoco[0] &&
    pa.fuoco[1] === pb.fuoco[1]
  );
}

/* Un disegno si mostra come una foto: un'immagine con l'SVG dentro. Cosi' il
 * taglio, il fuoco e lo zoom sono gli stessi della foto, e gli `id` delle sue
 * sfumature restano dentro l'immagine invece di incontrare quelli di un altro
 * disegno nella stessa pagina. */
const datiDelDisegno = new Map();
export function srcDaMostrare(immagine) {
  const chiave = chiaveDelDisegno(immagine);
  if (!chiave) return String(immagine?.src ?? "");
  if (datiDelDisegno.has(chiave)) return datiDelDisegno.get(chiave);
  const disegno = disegnoDaRiquadro(chiave);
  const dati = disegno
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(disegno.svg().replace(/>\s+</g, "><"))}`
    : "";
  datiDelDisegno.set(chiave, dati);
  return dati;
}

/**
 * Come si posa l'immagine nel riquadro: il punto del fuoco e lo zoom, come
 * proprieta' CSS. `object-fit: cover` lo mette il foglio di stile; qui ci sono
 * solo i numeri che cambiano da un riquadro all'altro.
 *
 * Lo zoom si fa con `scale` attorno al fuoco: il punto che si e' scelto resta
 * dov'e' mentre il resto si allarga, che e' esattamente cosa vuol dire
 * «avvicinarsi a quella cosa».
 */
export function stileDellImmagine(immagine) {
  const pulita = immaginePulita(immagine);
  if (!pulita) return { objectPosition: "50% 50%", transformOrigin: "50% 50%", transform: "" };
  const [x, y] = pulita.fuoco;
  const punto = `${x}% ${y}%`;
  return {
    objectPosition: punto,
    transformOrigin: punto,
    transform: pulita.zoom === 1 ? "" : `scale(${pulita.zoom})`,
  };
}

/** Lo stesso, scritto per l'attributo `style`. */
export function stileInLinea(immagine) {
  const s = stileDellImmagine(immagine);
  return `object-position:${s.objectPosition};transform-origin:${s.transformOrigin}${s.transform ? `;transform:${s.transform}` : ""}`;
}

/**
 * Quale parte della foto si vede in un riquadro di questa forma.
 *
 * `misure` sono la larghezza e l'altezza vere della foto, `forma` il rapporto
 * del riquadro (1 quadrato, 1.5 il 3:2 a muro). Restituisce la finestra in
 * frazioni della foto: `{x, y, w, h}`, fra 0 e 1. E' la cornice che l'editor
 * disegna sopra la foto intera.
 *
 * Con `object-fit: cover` la foto riempie il riquadro e se ne vede la parte
 * `wf × hf`; `object-position` la sposta, e il punto al fuoco della foto
 * finisce al fuoco del riquadro. Lo zoom stringe la finestra attorno a quello
 * stesso punto: x' = fx · (1 − wf/z).
 */
export function finestraVisibile(misure, forma, immagine) {
  const larghezza = Number(misure?.larghezza) || 1;
  const altezza = Number(misure?.altezza) || 1;
  const rapporto = larghezza / altezza;
  const voluta = Number(forma) > 0 ? Number(forma) : 1;
  const pulita = immaginePulita(immagine) || { fuoco: [50, 50], zoom: 1 };
  const z = pulita.zoom;
  const wf = rapporto > voluta ? voluta / rapporto : 1;
  const hf = rapporto > voluta ? 1 : rapporto / voluta;
  const w = wf / z;
  const h = hf / z;
  const fx = pulita.fuoco[0] / 100;
  const fy = pulita.fuoco[1] / 100;
  return { x: fx * (1 - w), y: fy * (1 - h), w, h };
}

/**
 * Il fuoco che mette la finestra in quel punto: l'inverso di
 * `finestraVisibile`, per quando si trascina la cornice. Una finestra che
 * prende tutta la larghezza non ha dove andare: li' il fuoco resta com'era.
 */
export function fuocoDallaFinestra(misure, forma, immagine, sinistra, alto) {
  const pulita = immaginePulita(immagine);
  if (!pulita) return null;
  const { w, h } = finestraVisibile(misure, forma, pulita);
  const asse = (posizione, lato, prima) =>
    lato >= 0.999 ? prima : decimo(tra((tra(posizione, 0, 1 - lato) / (1 - lato)) * 100, 0, 100));
  return [
    asse(Number(sinistra) || 0, w, pulita.fuoco[0]),
    asse(Number(alto) || 0, h, pulita.fuoco[1]),
  ];
}

const scappa = (valore) =>
  String(valore ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** L'immagine dentro il riquadro, gia' posata. "" se non ce n'e' una buona. */
export function immagineMarkup(immagine, classe = "dm-rq-img") {
  const pulita = immaginePulita(immagine);
  if (!pulita) return "";
  return `<img class="${scappa(classe)}" src="${scappa(srcDaMostrare(pulita))}" alt="" draggable="false" decoding="async" style="${scappa(stileInLinea(pulita))}">`;
}

/* Il segno della foto caricata, in alto a sinistra: dice che quella non e' un
 * disegno della plancia ma una foto di casa. */
const SEGNO_DELLA_FOTO = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 5l1.5-2h5L16 5"/></svg>`;

export function segnoDellaFoto(immagine) {
  const pulita = immaginePulita(immagine);
  return pulita && !chiaveDelDisegno(pulita)
    ? `<span class="dm-rq-foto">${SEGNO_DELLA_FOTO}</span>`
    : "";
}

/**
 * Il riquadro intero con l'immagine: la stessa forma per tutti quelli che ne
 * hanno una. `destra` e' il comando in alto a destra (l'interruttore, il tasto
 * «Apri») gia' scritto da chi chiama, `attributi` quello che serve al tocco.
 * Il nome e lo stato si scappano qui.
 */
export function riquadroConImmagineMarkup({
  immagine,
  nome = "",
  stato = "",
  acceso = false,
  accento = "#0ea5e9",
  destra = "",
  attributi = "",
  classi = "",
  tag = "div",
  extraStato = "",
  stile = "",
  attributiStato = "",
} = {}) {
  const fondo = immagineMarkup(immagine);
  if (!fondo) return "";
  const etichetta = tag === "button" ? ' type="button"' : "";
  return `<${tag}${etichetta} class="dm-rq ${acceso ? "on" : ""} ${scappa(classi)}" style="--acc:${scappa(accento)}${stile ? `;${scappa(stile)}` : ""}" ${attributi}>${fondo}
    <div class="dm-rq-alto">${segnoDellaFoto(immagine)}${destra}</div>
    <div class="dm-rq-basso"><div class="dm-rq-nome">${scappa(nome)}</div><div class="dm-rq-stato"><i aria-hidden="true"></i><span${attributiStato ? ` ${attributiStato}` : ""}>${scappa(stato)}</span>${extraStato}</div></div></${tag}>`;
}
