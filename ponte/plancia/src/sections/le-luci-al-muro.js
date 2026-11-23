/* Le luci di casa sul tablet a muro: la scena a tutto schermo sul riposo e la
 * fascia coi tocchi in fondo alla prima pagina.
 *
 * Il disegno e' quello del riquadro in Home (`la-scena-delle-luci.js`), con
 * le luci nello stato vero: quando l'albero vero si accende, si accende
 * quello disegnato. Quando mostrarla, e quando il tablet si sveglia per
 * guardarla, lo decide `core/le-luci-al-muro.js`; qui ci sono il markup, il
 * giro che mette la scena nei suoi contenitori e il foglio di stile.
 *
 * ── Leggera, per i tablet economici ───────────────────────────────────────
 *
 * Il pannello si ridisegna rattoppando il suo markup: i contenitori della
 * scena (`data-mu-luci-scena`) restano quelli che sono (`scenaDaTenere`), e
 * la scena dentro si fa una volta per misura e per fase del cielo. Ai cambi
 * di stato cambiano solo le classi delle parti accese, e la cascata la fa il
 * CSS. Niente giro di fotogrammi: si muovono solo il fumo del camino e i
 * fiocchi, in livelli che il browser sposta senza ridipingere; il luccichio
 * delle lampadine, che ridipinge, c'e' solo nel momento dell'accensione. Con
 * la pagina nascosta e con «riduci animazioni» e' tutto fermo.
 */
import { chiamateDelleLuci, festePulite, luciAccese } from "../core/feste.js";
import {
  chiamateDelTocco,
  cieloDellaScena,
  coseDellaScena,
  etichetteDellaScena,
} from "../core/scena-delle-luci.js";
import { paroleDelleLuci } from "./feste-section.js";
import { cssDellaScena, mettiLaScena } from "./la-scena-delle-luci.js";
import { clean, doc, esc, t } from "./shared.js";

const nomeDellaLuce = (luce, states) =>
  clean(luce?.nome) ||
  clean(states?.[luce?.entity]?.attributes?.friendly_name) ||
  String(luce?.entity || "")
    .split(".")[1]
    ?.replace(/_/g, " ") ||
  "";

const nomiDiCasa = (config, states) =>
  Object.fromEntries(
    config.luci.map((l) => [l.entity, clean(states?.[l.entity]?.attributes?.friendly_name)]),
  );

const accesaOra = (states) => (e) => clean(states?.[e]?.state) === "on";

/* ── il riposo ──────────────────────────────────────────────────────────── */

/** Il contenitore della scena a tutto schermo, dietro l'orologio. */
export const scenaSulRiposo = () =>
  `<div class="mu-luci-scena mu-luci-tutto" data-mu-luci-scena="riposo" aria-hidden="true"></div>`;

/* La tela della neve che cade sul riposo: la fa girare `feste-al-muro.js`,
 * col suo giro, e il pannello la tiene com'e' nel ridisegno (`teleDaTenere`). */
export const neveSulRiposo = () =>
  `<canvas class="mu-feste-moto mu-feste-neve" data-mu-feste="neve" aria-hidden="true"></canvas>`;

/**
 * «Spegni tutte» sul riposo: piccolo, in un angolo, solo se qualcosa e'
 * acceso. Il suo tocco spegne senza svegliare il pannello.
 */
export function luciQuiete(config, states, deriva = { x: 0, y: 0 }) {
  if (!luciAccese(config, (e) => states?.[e]).accese) return "";
  const parola = t("Spegni tutte", "Turn all off");
  return `<button type="button" class="mu-luci-quiete" data-mu-fa="luci-quiete" style="--dx:${Number(deriva.x || 0).toFixed(3)};--dy:${Number(deriva.y || 0).toFixed(3)}" aria-label="${esc(parola)}"><i aria-hidden="true"></i><span>${esc(parola)}</span></button>`;
}

/** La riga che compare nel momento dell'accensione, al posto dell'orologio. */
export const annuncioDelleLuci = () =>
  `<div class="mu-luci-annuncio" aria-hidden="true"><span class="mu-feste-cap mu-feste-oro">${esc(
    t("Si accendono le luci", "The lights are coming on"),
  )}</span></div>`;

/* ── la fascia sulla plancia sveglia ────────────────────────────────────── */

/**
 * La fascia delle luci, in fondo alla prima pagina: la scena coi suoi tocchi
 * (l'albero, la capanna, la casa), a sinistra quante sono accese e fino a
 * quando, a destra «Spegni tutte» o «Accendi tutte».
 */
export function fasciaDelleLuci({
  config,
  states = {},
  adesso = new Date(),
  condizione = "",
  compatto = false,
} = {}) {
  const c = config || festePulite(null);
  const { accese, titolo, orario } = paroleDelleLuci(c, states, adesso);
  const cielo = cieloDellaScena({ stati: states, condizione, adesso });
  const verso = accese ? "turn_off" : "turn_on";
  const parola = accese ? t("Spegni tutte", "Turn all off") : t("Accendi tutte", "Turn all on");
  const nome = t("Luci di Natale", "Christmas lights");
  return `<section class="mu-carta mu-luci-fascia${cielo.chiaro ? " testo-scuro" : ""}${compatto ? " stretta" : ""}" data-mu-luci aria-label="${esc(nome)}">
    <div class="mu-luci-scena" data-mu-luci-scena="fascia"></div>
    <div class="mu-luci-testo">
      ${compatto ? "" : `<div class="mu-luci-cap">${esc(nome)}</div>`}
      <div class="mu-luci-titolo" aria-live="polite">${esc(titolo)}</div>
      ${compatto ? "" : `<div class="mu-luci-orario">${orario}</div>`}
    </div>
    <button type="button" class="mu-luci-tutte${accese ? " spegni" : ""}" data-mu-fa="luci-tutte" data-mu-verso="${verso}">${esc(parola)}</button>
  </section>`;
}

/* ── i tocchi ───────────────────────────────────────────────────────────── */

/**
 * Le chiamate per un tocco sulle luci del pannello, o `null` se il tocco non
 * e' loro: «Spegni tutte» del riposo, «Spegni/Accendi tutte» della fascia,
 * una cosa della scena nella fascia.
 */
export function chiamateDelToccoAlMuro(bersaglio, config, states = {}) {
  const c = config || festePulite(null);
  if (!bersaglio) return null;
  const fa = bersaglio.dataset?.muFa;
  if (fa === "luci-quiete") return chiamateDelleLuci(c, false);
  if (fa === "luci-tutte") return chiamateDelleLuci(c, bersaglio.dataset.muVerso === "turn_on");
  const entita = clean(bersaglio.dataset?.festeEntita).split(" ").filter(Boolean);
  if (entita.length) return chiamateDelTocco(entita, accesaOra(states));
  return null;
}

/** Nel ridisegno del pannello, i contenitori della scena restano col loro disegno. */
export function scenaDaTenere(vecchio, nuovo) {
  const quale = vecchio?.dataset?.muLuciScena;
  return Boolean(quale) && quale === nuovo?.dataset?.muLuciScena;
}

/* ── il giro ────────────────────────────────────────────────────────────── */

/* Con la pagina nascosta la scena si ferma: il fumo e i fiocchi non girano
 * per nessuno. Un orecchio solo, messo la prima volta che serve. */
let orecchio = false;
function fermaQuandoNonSiVede() {
  if (orecchio || !doc?.addEventListener) return;
  orecchio = true;
  doc.addEventListener("visibilitychange", () => {
    for (const scena of doc.querySelectorAll("[data-mu-luci-scena]"))
      scena.classList.toggle("dm-sc-fermo", Boolean(doc.hidden));
  });
}

/* A tutto schermo le cose stanno basse, in fila al centro: sopra resta il
 * cielo per l'orologio. In unita' della scena, alta 300. */
const TERRA_DEL_RIPOSO = 258;
const CIMA_DEL_RIPOSO = 174;
/* Sullo schermo quadrato (o in piedi) l'orologio prende piu' altezza: le
 * cose scendono ancora un poco. */
const TERRA_DEL_RIPOSO_ALTO = 268;
const CIMA_DEL_RIPOSO_ALTO = 204;

/**
 * Dopo ogni disegno del pannello: mette (o aggiorna) la scena in ogni suo
 * contenitore. Torna `false` se non ce n'e'.
 */
export function animaLeLuciAlMuro(
  nodo,
  { feste = null, states = {}, condizione = "", adesso = new Date(), momento = false } = {},
) {
  const contenitori = [...(nodo?.querySelectorAll?.("[data-mu-luci-scena]") || [])];
  if (!contenitori.length) return false;
  const config = festePulite(feste);
  const cose = coseDellaScena(config.luci, nomiDiCasa(config, states));
  const cielo = cieloDellaScena({ stati: states, condizione, adesso });
  const accese = new Set(config.luci.map((l) => l.entity).filter(accesaOra(states)));
  const etichette = etichetteDellaScena(cose, (e) =>
    nomeDellaLuce(config.luci.find((l) => l.entity === e) || { entity: e }, states),
  );
  fermaQuandoNonSiVede();
  const fermo = Boolean(doc?.hidden);
  for (const contenitore of contenitori) {
    const w = contenitore.clientWidth || 0;
    if (contenitore.dataset.muLuciScena === "riposo") {
      const alto = w < (contenitore.clientHeight || 0) * 1.25;
      mettiLaScena(contenitore, {
        cose,
        cielo,
        accese,
        etichette,
        prefisso: "mulr",
        da: w * 0.14,
        riserva: w * 0.06,
        terra: alto ? TERRA_DEL_RIPOSO_ALTO : TERRA_DEL_RIPOSO,
        cima: alto ? CIMA_DEL_RIPOSO_ALTO : CIMA_DEL_RIPOSO,
      });
    } else {
      /* Nella fascia la scena sta fra le parole e il tasto; la luna, se c'e'
       * posto, appena prima del tasto. */
      const fascia = contenitore.parentElement;
      const testo = fascia?.querySelector(".mu-luci-testo");
      const tasto = fascia?.querySelector(".mu-luci-tutte");
      const da = testo ? testo.offsetLeft + testo.offsetWidth + 4 : 0;
      const destra = tasto ? w - tasto.offsetLeft + 8 : 0;
      const stretta = fascia?.classList.contains("stretta");
      const k = contenitore.clientHeight ? 300 / contenitore.clientHeight : 1;
      mettiLaScena(contenitore, {
        cose,
        cielo,
        accese,
        etichette,
        prefisso: "mulf",
        da,
        riserva: destra + (stretta ? 0 : 56),
        astro: stretta ? { x: -400, y: -400 } : { x: (w - destra - 30) * k, y: 70 },
      });
    }
    contenitore.classList.toggle("dm-sc-fermo", fermo);
    contenitore.classList.toggle("mu-luci-brilla", Boolean(momento));
  }
  return true;
}

/* ── stile ──────────────────────────────────────────────────────────────── */

/** Il foglio delle luci del pannello: `muro` e' il selettore del pannello. */
export function stileDelleLuciAlMuro(muro) {
  const scena = `${muro} .mu-luci-scena`;
  return `
${cssDellaScena(scena)}
/* Sul muro le lampadine non luccicano (ridipingerebbero lo schermo intero
   di continuo), tranne nel momento dell'accensione. */
${scena}:not(.mu-luci-brilla) .sc-lh,${scena}:not(.mu-luci-brilla) .sc-tremola,${scena}:not(.mu-luci-brilla) .sc-luccichio{animation:none!important}
${scena}.mu-luci-tutto{position:absolute;inset:0;z-index:0;pointer-events:none}
/* Le nuvole, grandi come sono a tutto schermo o in una fascia bassa,
   pesano: sul muro si fanno piu' leggere. */
${scena} .sc-f-nuvola{opacity:.85}
${scena}.mu-luci-tutto .sc-tocco{cursor:default}
/* Sul riposo la neve la fa la tela sopra (\`neveSulRiposo\`), per tutto lo
   schermo: quella della scena farebbe doppio. */
${scena}.mu-luci-tutto .dm-sc-fiocchi{display:none}
${muro} .mu-feste-neve{z-index:2}
/* Sopra le foto: gli auguri in oro sopra l'ora, come nella scena. */
${muro} .mu-cornice-feste{margin:0 0 6px;filter:drop-shadow(0 1px 10px rgba(0,0,0,.55))}
${muro}[data-compatto="1"] .mu-cornice-feste{font-size:11px;letter-spacing:5px}
/* Sul pannello piccolo la cornice ha l'ora e la data in basso per tutta la
   larghezza: «Spegni tutte» sale nell'angolo in alto. */
${muro}[data-compatto="1"] .mu-cornice-festa .mu-luci-quiete{top:4.5%;bottom:auto}
/* Il riposo con le luci: l'orologio sul cielo, un velo appena sotto perche'
   si legga anche di giorno. */
${muro} .mu-feste-luci::before{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;
  background:linear-gradient(180deg,rgba(3,8,22,.3) 0%,rgba(3,8,22,.12) 38%,rgba(3,8,22,0) 56%)}
${muro} .mu-riposo.mu-feste-luci .mu-feste-blocco{z-index:2;top:6%;transition:filter 1.2s ease}
${muro} .mu-riposo.mu-feste-luci .mu-feste-ora{font-size:min(156px,19.5vh,14vw);margin-top:8px}
${muro} .mu-riposo.mu-feste-luci .mu-feste-data{margin-top:8px}
${muro} .mu-riposo.mu-feste-luci .mu-feste-pastiglie{margin-top:16px}
${muro} .mu-riposo.mu-feste-luci .mu-feste-pastiglia{background:rgba(6,14,36,.34)}
${muro} .mu-luci-quiete{position:absolute;z-index:3;right:3.2%;bottom:4.5%;display:inline-flex;align-items:center;gap:9px;
  min-height:44px;padding:0 16px 0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.2);
  background:rgba(6,14,36,.42);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
  color:rgba(255,255,255,.86);font:600 14px Inter,system-ui,sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent;
  transform:translate(calc(var(--dx,0) * -10px),calc(var(--dy,0) * -8px));transition:opacity .6s ease}
${muro} .mu-luci-quiete i{position:relative;width:18px;height:18px;border-radius:50%;border:2px solid currentColor;border-top-color:transparent}
${muro} .mu-luci-quiete i::after{content:"";position:absolute;left:50%;top:-5px;width:2px;height:9px;margin-left:-1px;border-radius:2px;background:currentColor}
${muro} .mu-luci-quiete.in-attesa{opacity:.5}
${muro} .mu-luci-annuncio{position:absolute;z-index:2;left:0;right:0;top:12%;display:flex;justify-content:center;
  opacity:0;transition:opacity 1.2s ease;pointer-events:none}
${muro} .mu-luci-annuncio .mu-feste-cap{font-size:18px;letter-spacing:9px;filter:drop-shadow(0 2px 14px rgba(0,0,0,.55))}
/* Il momento dell'accensione: l'orologio si fa da parte, si guardano le luci. */
${muro} .mu-riposo.mu-luci-momento .mu-feste-blocco{filter:opacity(0)}
${muro} .mu-luci-momento .mu-luci-annuncio{opacity:1;transition-delay:.4s}
${muro} .mu-luci-momento .mu-luci-quiete{opacity:0;pointer-events:none}
${muro} .mu-luci-momento::before{opacity:.4}
/* Sul pannello piccolo la pastiglia delle luci lascia il posto: la scena e
   il suo «Spegni tutte» dicono gia' che sono accese. */
${muro}[data-compatto="1"] .mu-feste-luci [data-mu-pastiglia-luci]{display:none}
${muro}[data-compatto="1"] .mu-riposo.mu-feste-luci .mu-feste-cap{font-size:11px;letter-spacing:5px}
${muro}[data-compatto="1"] .mu-riposo.mu-feste-luci .mu-feste-ora{font-size:68px;margin-top:4px}
${muro}[data-compatto="1"] .mu-riposo.mu-feste-luci .mu-feste-data{font-size:14px;margin-top:6px}
${muro}[data-compatto="1"] .mu-riposo.mu-feste-luci .mu-feste-pastiglie{margin-top:10px;gap:6px}
${muro}[data-compatto="1"] .mu-riposo.mu-feste-luci .mu-feste-pastiglia{font-size:12px;padding:6px 10px;gap:6px}
${muro}[data-compatto="1"] .mu-luci-quiete{min-height:40px;font-size:13px;padding:0 12px 0 10px}
${muro}[data-compatto="1"] .mu-luci-annuncio .mu-feste-cap{font-size:13px;letter-spacing:5px}

/* La fascia in fondo alla prima pagina: dopo le righe della pagina, alta
   quanto basta per toccare l'albero col dito. */
${muro} .mu-pagina.mu-con-luci>.mu-luci-fascia{grid-row-start:-1}
${muro} .mu-con-lato.mu-con-luci>.mu-luci-fascia{grid-column:2}
${muro} .mu-luci-fascia{height:104px;display:flex;align-items:center;gap:16px;padding:0 18px 0 26px;
  color:#fff;background:#0d1838;isolation:isolate;-webkit-tap-highlight-color:transparent}
${muro} .mu-luci-fascia::before{content:none}
${muro} .mu-luci-fascia>.mu-luci-scena{position:absolute;inset:0;z-index:0}
${muro} .mu-luci-fascia>.mu-luci-scena::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(90deg,rgba(5,11,32,.78) 0,rgba(5,11,32,.5) 200px,rgba(5,11,32,0) 340px)}
${muro} .mu-luci-fascia.testo-scuro>.mu-luci-scena::after{
  background:linear-gradient(90deg,rgba(247,250,255,.88) 0,rgba(247,250,255,.55) 200px,rgba(247,250,255,0) 340px)}
${muro} .mu-luci-fascia .sc-cosa{transition:transform .2s ease;transform-box:fill-box;transform-origin:50% 100%}
${muro} .mu-luci-fascia .sc-cosa.toccata{transform:scale(.96)}
${muro} .mu-luci-testo{position:relative;z-index:1;width:236px;flex:none;pointer-events:none}
${muro} .mu-luci-cap{width:max-content;font:700 11px Inter,system-ui,sans-serif;letter-spacing:.32em;text-transform:uppercase;
  background:linear-gradient(180deg,#fff7d6 0%,#f5d27a 45%,#c9952e 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
${muro} .mu-luci-titolo{margin-top:4px;font:700 26px/1.1 Inter,system-ui,sans-serif;letter-spacing:-.4px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 2px 14px rgba(0,0,0,.35)}
${muro} .mu-luci-orario{margin-top:4px;font:500 13px/1.35 Inter,system-ui,sans-serif;color:#d3def2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${muro} .mu-luci-orario b{color:#ffdf9e}
${muro} .mu-luci-tutte{position:relative;z-index:1;margin-left:auto;flex:none;height:48px;padding:0 20px;border-radius:15px;
  border:1px solid transparent;font:700 15px Inter,system-ui,sans-serif;cursor:pointer;
  background:linear-gradient(180deg,#ffe6ae,#eeb054);color:#3a2408;
  box-shadow:0 10px 24px rgba(240,182,90,.3),inset 0 1px 0 rgba(255,255,255,.65)}
${muro} .mu-luci-tutte.spegni{background:rgba(10,20,45,.66);color:#fff;border-color:rgba(255,255,255,.24);box-shadow:none;
  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
${muro} .mu-luci-tutte.in-attesa{opacity:.6}
${muro} .mu-luci-tutte:active{transform:scale(.97)}
${muro} .mu-luci-fascia.testo-scuro{color:#12213d}
${muro} .mu-luci-fascia.testo-scuro .mu-luci-cap{background:none;color:#946210}
${muro} .mu-luci-fascia.testo-scuro .mu-luci-titolo{text-shadow:none}
${muro} .mu-luci-fascia.testo-scuro .mu-luci-orario{color:#3a4864}
${muro} .mu-luci-fascia.testo-scuro .mu-luci-orario b{color:#875400}
${muro} .mu-luci-fascia.testo-scuro .mu-luci-tutte.spegni{background:rgba(255,255,255,.84);color:#14233f;border-color:rgba(20,40,80,.16)}
${muro}[data-compatto="1"] .mu-luci-fascia{height:72px;gap:8px;padding:0 8px 0 12px;border-radius:16px}
${muro}[data-compatto="1"] .mu-luci-testo{width:78px}
${muro}[data-compatto="1"] .mu-luci-titolo{font-size:15px;white-space:normal;line-height:1.1}
${muro}[data-compatto="1"] .mu-luci-tutte{height:40px;padding:0 10px;border-radius:12px;font-size:12.5px;max-width:96px;white-space:normal;line-height:1.1}
${muro}[data-compatto="1"] .mu-luci-fascia>.mu-luci-scena::after{background:linear-gradient(90deg,rgba(5,11,32,.7) 0,rgba(5,11,32,0) 110px)}
${muro}[data-compatto="1"] .mu-luci-fascia.testo-scuro>.mu-luci-scena::after{background:linear-gradient(90deg,rgba(247,250,255,.86) 0,rgba(247,250,255,0) 110px)}
@media (prefers-reduced-motion:reduce){
  ${muro} .mu-feste-luci .mu-feste-blocco,${muro} .mu-luci-annuncio,${muro} .mu-luci-quiete,${muro} .mu-luci-fascia .sc-cosa{transition:none}}
`;
}
