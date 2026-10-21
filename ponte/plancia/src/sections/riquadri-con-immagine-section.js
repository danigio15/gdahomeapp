/* I riquadri con l'immagine: il vestito, la scelta, e i Dispositivi.
 *
 * «Riquadri con l'immagine.» Un riquadro della plancia puo' portare una foto
 * di casa, o un disegno da riquadro, che lo riempie tutto. Le regole stanno
 * nel nucleo (`core/immagine-del-riquadro.js`): cosa si puo' salvare, come si
 * posa l'immagine, la forma del riquadro. Qui c'e' quello che tocca la
 * pagina, ed e' di tutti quelli che hanno un riquadro con l'immagine:
 *
 * - il foglio di stile del riquadro (`.dm-rq`): il velo scuro in fondo con il
 *   nome e lo stato in bianco, l'alone del colore della sezione da acceso,
 *   l'immagine in grigio e piu' scura da spento, i comandi in vetro;
 * - il blocco «Immagine» degli editor: «Carica una foto», «Scegli dai
 *   disegni», l'inquadratura e «Togli immagine». Lo usano la scheda A muro,
 *   le Prese e i Dispositivi; chi lo mette nella sua scheda ascolta
 *   `dm-rqi-cambia` e salva dove sa lui;
 * - i Dispositivi della Home: il guscio vendorizzato disegna le loro card, e
 *   non si riscrive. Si aspetta che le disegni, e a quelle che hanno
 *   un'immagine si cambia il vestito, tenendo gli `id` che il guscio aggiorna.
 *
 * Le riquadri della Home in cima (le tessere) restano come sono: sono numeri
 * da leggere, non cose da accendere. */
import {
  GRUPPI_DISEGNI,
  cercaDisegni,
  disegnoDaRiquadro,
} from "../core/disegni-da-riquadro.js";
import {
  ZOOM_MASSIMO,
  ZOOM_MINIMO,
  chiaveDelDisegno,
  finestraVisibile,
  fondoMarkup,
  fuocoDallaFinestra,
  immaginePulita,
  riquadroConImmagineMarkup,
  srcDaMostrare,
  stileInLinea,
} from "../core/immagine-del-riquadro.js";
import {
  CHIAVE_DELLE_IMMAGINI,
  PAGINE_CON_IMMAGINI,
  SUPERFICI_DA_VESTIRE,
  conLImmagineSciolta,
  idDellaCard,
  immaginiSciolte,
  nomeDellaVoce,
  superficieConImmagine,
  voceDellaCard,
} from "../core/superfici-con-immagine.js";
import { storeImage } from "./media-picker-section.js";
import {
  activeLocale,
  clean,
  dashboardStore,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  section,
  t,
  tr,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_RIQUADRI_CON_IMMAGINE__";
const state = (root[KEY] ||= { installed: false, blocchi: new Map(), misure: new Map() });

export const EVENTO_IMMAGINE = "dm-rqi-cambia";
export const CARTELLA_DEI_RIQUADRI = "riquadri";
/* Il lato lungo di una foto caricata: un riquadro a muro largo trecento punti
 * su uno schermo denso ne mostra seicento; milleduecento lasciano lo zoom. */
export const LATO_MASSIMO = 1200;
const QUALITA = 0.85;

/* ── il foglio di stile ──────────────────────────────────────────────────── */

/* Il velo e' quello delle prove (`riquadri-immagine`): scuro al 90% sul fondo,
 * dove stanno il nome e lo stato, e un filo in cima per l'interruttore. Cosi'
 * il bianco si legge sulla foto piu' chiara — una neve, un cielo — senza
 * dover misurare la foto. */
const STILE = `
.dm-rq{position:relative;isolation:isolate;overflow:hidden;container-type:inline-size;box-sizing:border-box;
  border-radius:22px;background:#0b1220;color:#fff;text-align:left;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.08),0 1px 1px rgba(15,23,42,.06),0 14px 28px -18px rgba(15,23,42,.6);
  transition:box-shadow .25s ease}
button.dm-rq{border:0;padding:0;margin:0;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.dm-rq>.dm-rq-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2;margin:0;padding:0;border:0;max-width:none;
  pointer-events:none;user-select:none;-webkit-user-drag:none;transition:filter .35s ease,transform .35s ease}
.dm-rq:not(.on):not(.is-on)>.dm-rq-img{filter:grayscale(.75) brightness(.8) contrast(.95)}
.dm-rq:is(.on,.is-on)>.dm-rq-img{filter:saturate(1.1) brightness(1.04)}
.dm-rq::before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;pointer-events:none;opacity:1;
  background:linear-gradient(to top,rgba(4,9,20,.9) 0%,rgba(4,9,20,.74) 24%,rgba(4,9,20,.3) 44%,rgba(4,9,20,0) 60%),
             linear-gradient(to bottom,rgba(4,9,20,.42) 0%,rgba(4,9,20,0) 26%)}
.dm-rq::after{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .3s ease;
  background:radial-gradient(120% 55% at 50% 112%,color-mix(in srgb,var(--acc,#0ea5e9) 55%,transparent),transparent 70%);mix-blend-mode:screen}
.dm-rq:is(.on,.is-on)::after{opacity:1}
.dm-rq:is(.on,.is-on){box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--acc,#0ea5e9) 90%,#fff),0 0 0 4px color-mix(in srgb,var(--acc,#0ea5e9) 22%,transparent),0 18px 38px -12px color-mix(in srgb,var(--acc,#0ea5e9) 75%,transparent)}
.dm-rq .dm-rq-alto{position:absolute;z-index:1;top:clamp(7px,4.4cqi,14px);left:clamp(7px,4.4cqi,14px);right:clamp(7px,4.4cqi,14px);display:flex;align-items:center;gap:8px;min-height:0}
.dm-rq .dm-rq-basso{position:absolute;z-index:1;left:clamp(10px,6cqi,18px);right:clamp(8px,5.5cqi,16px);bottom:clamp(9px,5.2cqi,14px);display:block;min-width:0}
.dm-rq .dm-rq-nome{font-family:Oswald,Inter,system-ui,sans-serif;font-weight:500;font-size:clamp(15px,9.4cqi,30px);line-height:1.06;letter-spacing:.005em;color:#fff;
  text-shadow:0 1px 2px rgba(0,0,0,.45);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;text-transform:none;margin:0}
.dm-rq .dm-rq-stato{margin-top:clamp(3px,2cqi,6px);display:flex;align-items:center;gap:6px;min-width:0;font-size:clamp(9.5px,4.7cqi,12px);font-weight:800;letter-spacing:.08em;text-transform:uppercase;
  color:rgba(255,255,255,.8);white-space:nowrap;overflow:hidden;text-shadow:0 1px 2px rgba(0,0,0,.5)}
.dm-rq .dm-rq-stato>span{overflow:hidden;text-overflow:ellipsis;min-width:0;color:inherit;font:inherit;letter-spacing:inherit;text-transform:inherit}
.dm-rq .dm-rq-stato>span:empty{display:none}
.dm-rq .dm-rq-stato>.dm-rq-val:not(:empty)::before{content:"· "}
.dm-rq .dm-rq-stato>i{flex:none;width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.45)}
.dm-rq:is(.on,.is-on) .dm-rq-stato{color:color-mix(in srgb,var(--acc,#0ea5e9) 45%,#fff)}
.dm-rq:is(.on,.is-on) .dm-rq-stato>i{background:color-mix(in srgb,var(--acc,#0ea5e9) 60%,#fff);box-shadow:0 0 0 3px color-mix(in srgb,var(--acc,#0ea5e9) 35%,transparent),0 0 10px var(--acc,#0ea5e9)}
/* I comandi in vetro: si leggono su qualunque foto. */
.dm-rq .dm-rq-int{margin:0 0 0 auto;flex:none;box-sizing:border-box;display:flex;align-items:center;justify-content:flex-start;padding:3px;
  width:clamp(34px,19.5cqi,54px);height:clamp(21px,11.9cqi,32px);border:0;border-radius:999px;cursor:pointer;
  background:rgba(15,23,42,.42);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.3);transition:background .2s ease}
.dm-rq .dm-rq-int>i{display:block;height:100%;aspect-ratio:1;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.35)}
.dm-rq .dm-rq-int.on,.dm-rq.is-on .dm-rq-int[data-dm-lucip-toggle],.dm-rq.on .dm-rq-int.dm-rq-segue{justify-content:flex-end;background:var(--acc,#0ea5e9);box-shadow:inset 0 0 0 1px rgba(255,255,255,.35),0 0 14px color-mix(in srgb,var(--acc,#0ea5e9) 70%,transparent)}
.dm-rq .dm-rq-int svg{display:none}
.dm-rq .dm-rq-tasto{margin:0 0 0 auto;flex:none;display:inline-flex;align-items:center;gap:6px;height:clamp(23px,13.5cqi,36px);padding:0 clamp(9px,6cqi,18px);border:0;border-radius:999px;cursor:pointer;
  font:inherit;font-size:clamp(10.5px,5.6cqi,15px);font-weight:800;color:#fff;white-space:nowrap;
  background:rgba(15,23,42,.42);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc,#0ea5e9) 70%,rgba(255,255,255,.4))}
.dm-rq .dm-rq-tasto>b{width:8px;height:8px;border-radius:50%;background:var(--acc,#0ea5e9);box-shadow:0 0 8px var(--acc,#0ea5e9)}
.dm-rq .dm-rq-foto{flex:none;display:grid;place-items:center;width:clamp(20px,10cqi,26px);height:clamp(20px,10cqi,26px);border-radius:8px;
  background:rgba(15,23,42,.42);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)}
.dm-rq:focus-visible{outline:3px solid color-mix(in srgb,var(--acc,#0ea5e9) 70%,#fff);outline-offset:2px}
/* Piu' tasti in vetro: ON e OFF, ▲ ■ ▼, il meno e il piu' del clima. Alti
 * almeno quanto un dito anche nel riquadro piu' piccolo. */
.dm-rq .dm-rq-due{margin:0 0 0 auto;flex:none;display:flex;gap:clamp(4px,2.4cqi,8px)}
.dm-rq .dm-rq-dt{flex:none;box-sizing:border-box;display:inline-grid;place-items:center;min-width:clamp(34px,17cqi,62px);height:clamp(30px,14cqi,44px);padding:0 clamp(6px,3.4cqi,12px);
  border:0;border-radius:999px;cursor:pointer;font:inherit;font-size:clamp(11px,5.2cqi,15px);font-weight:900;letter-spacing:.06em;color:#fff;white-space:nowrap;
  background:rgba(15,23,42,.46);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.32);transition:background .2s ease,transform .1s ease}
.dm-rq .dm-rq-dt:active{transform:scale(.95)}
.dm-rq .dm-rq-alto>.dm-rq-acceso{margin-left:auto}
.dm-rq .dm-rq-dt:disabled{opacity:.4;cursor:default}
.dm-rq .dm-rq-dt.si,.dm-rq .dm-rq-dt-on.si{background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#1f2937;box-shadow:0 0 16px -2px #f59e0bcc}
.dm-rq .dm-rq-dt-off.si{background:rgba(255,255,255,.34);color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.6)}
.dm-rq .dm-rq-dt.dm-rq-acceso.si{background:var(--acc,#0ea5e9);color:#fff;box-shadow:0 0 14px color-mix(in srgb,var(--acc,#0ea5e9) 70%,transparent)}
.dm-rq .dm-rq-dt.premuto{outline:2px solid #fff;outline-offset:2px}
/* La fila dei comandi sul velo, sotto lo stato: il modo, il meno, i gradi, il
 * piu'; la barra della luminosita'. */
.dm-rq .dm-rq-comandi{margin-top:clamp(5px,3cqi,10px);display:flex;flex-wrap:wrap;align-items:center;gap:clamp(4px,2.4cqi,8px);min-width:0}
.dm-rq .dm-rq-gradi{margin-left:auto;display:inline-flex;align-items:center;gap:clamp(4px,2.4cqi,8px)}
.dm-rq .dm-rq-gradi>b{min-width:2.6em;text-align:center;font-family:Oswald,Inter,sans-serif;font-weight:500;font-size:clamp(17px,9cqi,30px);line-height:1;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5)}
.dm-rq .dm-rq-estremo{flex:1 1 100%;display:flex;align-items:center;gap:8px;min-width:0}
.dm-rq .dm-rq-estremo>i{font-style:normal;font-size:clamp(10px,4.6cqi,12px);font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:color-mix(in srgb,var(--est,#fff) 55%,#fff)}
.dm-rq .dm-rq-modo{min-width:0;letter-spacing:.02em}
.dm-rq .dm-rq-barra{flex:1 1 100%;min-width:0}
/* Una lettura (un sensore che dice un numero): il numero grande sul velo,
 * l'immagine sempre a colori — «spento» non vuol dire niente per una
 * batteria al 76 %. */
.dm-rq.dm-rq-lettura:not(.on):not(.is-on)>.dm-rq-img{filter:saturate(1.05)}
.dm-rq.dm-rq-lettura .dm-rq-stato{font-family:Oswald,Inter,sans-serif;font-weight:500;font-size:clamp(17px,10cqi,34px);letter-spacing:.01em;text-transform:none;color:#fff}
.dm-rq.dm-rq-lettura .dm-rq-stato>i{display:none}
/* L'immagine di fondo di una card che non e' un riquadro con l'immagine (le
 * card del guscio, le strisce del mixer): la foto sotto, un velo scuro sopra,
 * e la card con tutti i suoi comandi al suo posto, in chiaro. */
.dm-rq-fondo{position:relative;isolation:isolate;overflow:hidden}
.dm-rq-fondo>.dm-rq-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2;margin:0;padding:0;border:0;max-width:none;pointer-events:none;user-select:none;-webkit-user-drag:none}
.dm-rq-fondo>.dm-rq-velo{position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;
  background:linear-gradient(to top,rgba(4,9,20,.86) 0%,rgba(4,9,20,.58) 42%,rgba(4,9,20,.3) 100%)}
/* Il testo si fa bianco; i tasti tengono il loro vestito (e il loro stato,
 * acceso o spento), col vetro dietro perche' si stacchino dalla foto. */
.dm-rq-fondo{color:#fff}
.dm-rq-fondo :where(div,span,b,strong,label,p,h1,h2,h3,h4,em,output):not(button *,button,select *,input,[class*="pill"],[class*="pill"] *,[class*="badge"] *,[class*="chip"] *,[class*="flag"],[class*="tag"]){color:#fff!important;text-shadow:0 1px 2px rgba(0,0,0,.45)}
.dm-rq-fondo :where(button){-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
/* Le tessere della Home sono un <button>, e la regola qui sopra lascia
 * stare quello che sta dentro i bottoni: il nome e il numero restavano nei
 * colori della tessera chiara, quasi neri sul disegno (#287: «c'è poco
 * contrasto, e sui dispositivi sono troppo piccole»). Qui: bianchi, con
 * un'ombra che li stacca, un velo scuro anche in alto dove sta il nome, e la
 * riga sotto un poco piu' grande e piena. */
#dm-widgets .dm-tile.dm-rq-fondo :where(.dm-tile-label,.dm-tile-value,.dm-tile-value *,.dm-tile-val,.dm-tile-unit,.dm-tile-misura,.dm-tile-testo,.dm-tile-caption,.dm-tile-caption *,.dm-tile-sotto,.dm-tile-sotto *,.dm-tile-scroll,.dm-tile-scroll *){color:#fff!important;-webkit-text-fill-color:#fff;opacity:1!important;text-shadow:0 1px 3px rgba(0,0,0,.7),0 0 1px rgba(0,0,0,.6)}
#dm-widgets .dm-tile.dm-rq-fondo :is(.dm-tile-scroll,.dm-tile-caption,.dm-tile-sotto){font-size:max(13px,1em);font-weight:700}
#dm-widgets .dm-tile.dm-rq-fondo>.dm-rq-velo{background:linear-gradient(to bottom,rgba(4,9,20,.62) 0%,rgba(4,9,20,.42) 45%,rgba(4,9,20,.82) 100%)}
/* Lo stesso guaio sulle card della Temperatura con la foto della stanza
 * (#294: «i dati che mostra sono troppo scuri e non si capiscono»): il foglio
 * della Temperatura scrive nome, gradi e umidita' coi colori della card chiara
 * e con un selettore piu' forte di quello qui sopra. Qui vincono: bianchi. */
#temp-grid .temp-card.dm-rq-fondo :where(.cp-name,.cp-temp-current,.cp-temp-current-lbl,.cp-temp-target .lbl,.cp-temp-target .val,.dm-temp-fuori-nota){color:#fff!important;-webkit-text-fill-color:#fff;opacity:1!important;text-shadow:0 1px 3px rgba(0,0,0,.7),0 0 1px rgba(0,0,0,.6)}
#temp-grid .temp-card.dm-rq-fondo .cp-temp-current::after{color:rgba(255,255,255,.8)!important}
#temp-grid .temp-card.dm-rq-fondo>.dm-rq-velo{background:linear-gradient(to bottom,rgba(4,9,20,.62) 0%,rgba(4,9,20,.48) 45%,rgba(4,9,20,.84) 100%)}

/* La vasca con la sua foto: il disegno della piscina lascia il posto alla
 * foto, e restano le scritte dello stato. */
.dm-pool-stage.dm-rq-fondo>:is(.dm-pool-sky,.dm-pool-sun,.dm-pool-hedge,.dm-pool-plant,.dm-pool-deck,.dm-pool-lounger,.dm-pool-parasol,.dm-pool-basin){visibility:hidden}

/* I Dispositivi della Home: la card del guscio col vestito nuovo. */
html body .dev-card.dm-rq{padding:0;border:0;aspect-ratio:1;background:#0b1220}
html body .dev-card.dm-rq.on,html body.dark-theme .dev-card.dm-rq.on{background:#0b1220;border:0}
html body .dev-card.dm-rq .dm-rq-stato .dev-st{font-size:inherit;letter-spacing:inherit;color:inherit;font-weight:inherit}
html body .dev-card.dm-rq .dm-rq-stato .dev-val{font:inherit;color:inherit;margin:0}
/* Lo stato e la lettura su due righe: in una sola la wallbox diceva
 * «IN FUNZI… · 4,20 KW · 7…», e non si leggeva ne' l'uno ne' l'altra. */
html body .dev-card.dm-rq .dm-rq-stato{flex-wrap:wrap;row-gap:2px}
html body .dev-card.dm-rq .dm-rq-stato>.dev-val{flex:1 0 100%;padding-left:13px;text-transform:none;letter-spacing:.02em}
html body .dev-card.dm-rq .dm-rq-stato>.dev-val::before{content:none}

/* I Dispositivi SENZA immagine, accesi, col tema scuro.
 *
 * Il guscio veste la card accesa d'azzurro chiaro (#e0f2fe → #bae6fd), e la
 * versione notturna l'ha scritta sotto «body.dark-theme»: una classe che
 * nessuno mette piu', perche' il tema scuro della plancia e'
 * «html[data-theme="dark"]». Cosi' la card accesa restava azzurro chiaro
 * anche al buio, col nome in «var(--text)» — quasi bianco — sopra: «Luce
 * scale» non si leggeva. Qui la card accesa al buio fa come le altre card
 * accese della plancia (le luci, le prese): il fondo scuro della carta con
 * l'alone del colore della sezione, il bordo acceso, il testo chiaro. Col tema
 * chiaro non cambia niente: queste righe vivono solo sotto l'attributo. */
html[data-theme="dark"] .dev-card.on:not(.dm-rq){border-color:color-mix(in srgb,#0ea5e9 60%,transparent);
  background:radial-gradient(120% 90% at 100% 0%,color-mix(in srgb,#0ea5e9 26%,transparent) 0%,transparent 62%),linear-gradient(150deg,color-mix(in srgb,#0ea5e9 16%,var(--card-bg,#141e34)),var(--card-bg,#141e34) 62%);
  box-shadow:0 0 0 1px color-mix(in srgb,#0ea5e9 22%,transparent),0 14px 30px -16px color-mix(in srgb,#0ea5e9 60%,transparent)}
html[data-theme="dark"] .dev-card.on:not(.dm-rq) .dev-nm,html[data-theme="dark"] .dev-card.on:not(.dm-rq) .dev-val{color:var(--text,#e6edf7)}
html[data-theme="dark"] .dev-card.on:not(.dm-rq) .dev-st{color:#7dd3fc}
html[data-theme="dark"] .dev-card.on:not(.dm-rq) .dev-pwr{background:rgba(14,165,233,.2);color:#7dd3fc;box-shadow:inset 0 0 0 1px rgba(125,211,252,.35)}

/* Le prese con l'immagine: larghe come le altre card della griglia, e alte
 * abbastanza per la foto. Non portano la classe della card delle luci: il suo
 * vestito (il bordo, il fondo, la striscia in basso) e' suo, e qui se ne
 * mette un altro. */
.dm-rq.dm-lucip-rq{display:block;width:100%;aspect-ratio:16/9;min-height:150px}
.dm-rq.dm-lucip-rq[data-dm-lucip-available="false"]{opacity:.55}
/* ── il blocco «Immagine» degli editor ── */
.dm-rqi{--rqi-bordo:var(--divider-color,#dbe4ee);--rqi-carta:var(--card-bg,var(--card-background-color,#fff));--rqi-testo:var(--text,var(--primary-text-color,#0f172a));--rqi-tenue:var(--text-dim,var(--secondary-text-color,#64748b));
  grid-column:1/-1;min-width:0;max-width:100%;display:grid;gap:12px;margin:10px 0 4px;padding:14px;border-radius:18px;border:1px solid var(--rqi-bordo);color:var(--rqi-testo);
  background:linear-gradient(180deg,color-mix(in srgb,var(--rqi-carta) 96%,#0ea5e9),var(--rqi-carta));text-align:left}
.dm-rqi *{box-sizing:border-box}
.dm-rqi-testa{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dm-rqi-testa h3{margin:0;font-family:Oswald,Inter,sans-serif;font-weight:700;font-size:18px;letter-spacing:.04em;text-transform:uppercase}
.dm-rqi-testa small{margin-left:auto;font-size:12px;color:var(--rqi-tenue);font-weight:600}
.dm-rqi-due{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:10px}
.dm-rqi>*,.dm-rqi-crop>*,.dm-rqi-due>*{min-width:0}
.dm-rqi-big{display:flex;align-items:center;gap:12px;width:100%;padding:11px 13px;border-radius:14px;border:1px solid var(--rqi-bordo);background:var(--rqi-carta);color:inherit;font:inherit;text-align:left;cursor:pointer;
  box-shadow:0 6px 14px -12px rgba(15,23,42,.5)}
.dm-rqi-big:hover,.dm-rqi-big:focus-within,.dm-rqi-big[aria-expanded="true"]{border-color:#0ea5e9;box-shadow:0 0 0 3px rgba(14,165,233,.15)}
.dm-rqi-big>.dm-rqi-ic{flex:none;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,#0ea5e9 14%,var(--rqi-carta));color:#0369a1}
.dm-rqi-big>.dm-rqi-ic.viola{background:color-mix(in srgb,#8b5cf6 14%,var(--rqi-carta));color:#6d28d9}
.dm-rqi-big b{display:block;font-size:14px;font-weight:800}
.dm-rqi-big small{display:block;margin-top:2px;font-size:11.5px;font-weight:600;color:var(--rqi-tenue)}
.dm-rqi-big input[type=file]{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.dm-rqi-big{position:relative}
.dm-rqi-stato{display:block;font-size:12px;font-weight:700;color:var(--rqi-tenue)}
.dm-rqi-stato:empty{display:none}
.dm-rqi-stato[data-tipo="errore"]{color:#b91c1c}
.dm-rqi-sub{font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--rqi-tenue);margin:2px 2px 0}
.dm-rqi-cerca{width:100%;height:38px;padding:0 12px;border-radius:12px;border:1px solid var(--rqi-bordo);background:var(--rqi-carta);color:inherit;font:inherit;font-size:13.5px}
.dm-rqi-griglia{display:grid;gap:10px}
.dm-rqi-pollici{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(86px,100%),1fr));gap:8px}
.dm-rqi-pollice{position:relative;aspect-ratio:1;padding:0;border:0;border-radius:12px;overflow:hidden;cursor:pointer;background:#0b1220;box-shadow:inset 0 0 0 1px rgba(15,23,42,.1)}
.dm-rqi-pollice img{display:block;width:100%;height:100%;object-fit:cover}
.dm-rqi-pollice span{position:absolute;left:0;right:0;bottom:0;padding:12px 6px 5px;font-size:10.5px;font-weight:800;color:#fff;text-align:left;
  background:linear-gradient(to top,rgba(4,9,20,.85),transparent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-rqi-pollice.si{box-shadow:0 0 0 3px #0ea5e9}
.dm-rqi-pollice:focus-visible{outline:3px solid #0ea5e9;outline-offset:2px}
.dm-rqi-vuoto{font-size:12.5px;color:var(--rqi-tenue);font-weight:600;padding:6px 2px}
.dm-rqi-crop{display:grid;grid-template-columns:minmax(0,1fr) 190px;gap:14px;align-items:start}
@media (max-width:640px){.dm-rqi-crop{grid-template-columns:minmax(0,1fr)}}
.dm-rqi-tela{position:relative;width:100%;max-height:300px;margin:0 auto;border-radius:14px;overflow:hidden;background:#0b1220;touch-action:none;cursor:grab;user-select:none}
.dm-rqi-tela:active{cursor:grabbing}
.dm-rqi-tela:focus-visible{outline:3px solid #0ea5e9;outline-offset:2px}
.dm-rqi-tela>img{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none;-webkit-user-drag:none}
.dm-rqi-cornice{position:absolute;border-radius:12px;box-shadow:0 0 0 2px #fff,0 0 0 9999px rgba(2,6,23,.58);pointer-events:none;
  background:linear-gradient(90deg,transparent calc(33.3% - .5px),rgba(255,255,255,.35) calc(33.3% - .5px) calc(33.3% + .5px),transparent 0 calc(66.6% - .5px),rgba(255,255,255,.35) calc(66.6% - .5px) calc(66.6% + .5px),transparent 0),
             linear-gradient(180deg,transparent calc(33.3% - .5px),rgba(255,255,255,.35) calc(33.3% - .5px) calc(33.3% + .5px),transparent 0 calc(66.6% - .5px),rgba(255,255,255,.35) calc(66.6% - .5px) calc(66.6% + .5px),transparent 0)}
.dm-rqi-mano{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);padding:5px 10px;border-radius:10px;background:rgba(15,23,42,.6);color:#fff;font-size:11.5px;font-weight:700;white-space:nowrap;pointer-events:none}
.dm-rqi-lato{display:grid;gap:10px;align-content:start}
.dm-rqi-seg{display:flex;gap:3px;padding:3px;border-radius:11px;background:color-mix(in srgb,var(--rqi-testo) 7%,var(--rqi-carta))}
.dm-rqi-seg button{flex:1;padding:7px 4px;border:0;border-radius:9px;background:none;color:var(--rqi-tenue);font:inherit;font-size:12px;font-weight:800;cursor:pointer}
.dm-rqi-seg button.si{background:var(--rqi-carta);color:var(--rqi-testo);box-shadow:0 1px 3px rgba(15,23,42,.15)}
.dm-rqi-zoom{display:grid;gap:6px}
.dm-rqi-zoom span{display:flex;justify-content:space-between;font-size:11px;font-weight:800;color:var(--rqi-tenue);text-transform:uppercase;letter-spacing:.06em}
.dm-rqi-zoom b{color:var(--rqi-testo)}
.dm-rqi-zoom input{width:100%;accent-color:#0ea5e9}
.dm-rqi-anteprima{display:grid;justify-items:center}
.dm-rqi-anteprima .dm-rq{width:100%;max-width:190px;border-radius:18px}
.dm-rqi-mini{font-size:11.5px;line-height:1.45;color:var(--rqi-tenue);font-weight:600}
.dm-rqi-azioni{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dm-rqi-togli{height:36px;padding:0 14px;border-radius:12px;border:1.5px solid #fecaca;background:#fff5f5;color:#b91c1c;font:inherit;font-size:13px;font-weight:800;cursor:pointer}
.dm-rqi-nota{display:flex;gap:12px;align-items:flex-start;padding:11px 13px;border-radius:14px;background:color-mix(in srgb,#22c55e 10%,var(--rqi-carta));border:1px solid color-mix(in srgb,#22c55e 35%,transparent);color:inherit}
.dm-rqi-nota>.dm-rqi-ic{flex:none;width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:color-mix(in srgb,#22c55e 22%,var(--rqi-carta));color:#15803d}
.dm-rqi-nota b{display:block;font-size:13px;font-weight:800}
.dm-rqi-nota small{display:block;margin-top:2px;font-size:11.5px;line-height:1.45;font-weight:600;color:var(--rqi-tenue)}

/* La scheda dei Dispositivi nella Home del Config. */
.dm-rq-dispositivi{margin-top:18px}
.dm-rq-dispositivi .dm-rq-riga{align-items:center}
.dm-rq-dispositivi .dm-rq-pollicino{flex:none;width:40px;height:40px;border-radius:10px;overflow:hidden;display:grid;place-items:center;font-size:20px;background:color-mix(in srgb,var(--text,#0f172a) 6%,transparent)}
.dm-rq-dispositivi .dm-rq-pollicino img{width:100%;height:100%;object-fit:cover;display:block}
.dm-rq-dispositivi .dm-rq-apri{flex:none;height:34px;padding:0 12px;border-radius:11px;border:1px solid var(--divider-color,#dbe4ee);background:var(--card-bg,#fff);color:inherit;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer}
.dm-rq-dispositivi .dm-rq-apri[aria-expanded="true"]{border-color:#0ea5e9;color:#0369a1}
.dm-rq-card-pannello .dm-rq-sub-titolo{margin:16px 2px 6px;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:var(--text-dim,#64748b)}
`;

/* ── il blocco «Immagine» ────────────────────────────────────────────────── */

const ICONA_FOTO = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="3"/><circle cx="12" cy="13" r="3.6"/><path d="M8 6l1.6-2.4h4.8L16 6"/></svg>`;
const ICONA_TAVOLOZZA = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.6-1.6-1.8-1.6-3.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4-4-7-9-7Z"/><circle cx="7.5" cy="11" r="1.3" fill="currentColor"/><circle cx="10.5" cy="7" r="1.3" fill="currentColor"/><circle cx="15" cy="7.5" r="1.3" fill="currentColor"/></svg>`;
const ICONA_CASA = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/></svg>`;

/* Quello che il blocco ricorda fra un disegno e l'altro della scheda: la
 * scelta dei disegni aperta, la ricerca, la forma dell'inquadratura. La
 * scheda si rifa' spesso — chi salva la ridisegna — e senza questo ogni
 * ridisegno chiuderebbe la scelta sotto il dito. */
function statoDel(chiave) {
  let s = state.blocchi.get(chiave);
  if (!s) {
    s = { disegni: false, cerca: "", forma: 1, messaggio: "", tipo: "" };
    state.blocchi.set(chiave, s);
  }
  return s;
}

const nomeDelDisegno = (voce) =>
  activeLocale() === "it" ? voce?.nome?.it || "" : tr(voce?.nome?.en || "");

/* Le misure vere di un'immagine: i disegni sono quadrati; le foto si sanno
 * quando il browser le ha aperte (vedi `ricordaLaMisura`), e fino ad allora
 * si fa finta che siano 4:3, la forma di quasi tutti i telefoni. */
function misureDi(immagine) {
  if (chiaveDelDisegno(immagine)) return { larghezza: 240, altezza: 240 };
  return state.misure.get(immagine?.src) || { larghezza: 4, altezza: 3 };
}

const percentuale = (n) => `${(n * 100).toFixed(2)}%`;

function cornice(immagine, forma) {
  const f = finestraVisibile(misureDi(immagine), forma, immagine);
  return `left:${percentuale(f.x)};top:${percentuale(f.y)};width:${percentuale(f.w)};height:${percentuale(f.h)}`;
}

function grigliaDeiDisegni(chiave, scelta) {
  const s = statoDel(chiave);
  const lingua = activeLocale();
  const trovati = cercaDisegni(s.cerca, lingua);
  if (!trovati.length)
    return `<div class="dm-rqi-vuoto">${esc(t("Nessun disegno con questo nome.", "No drawing by that name."))}</div>`;
  const pollice = (voce) =>
    `<button type="button" class="dm-rqi-pollice${voce.chiave === scelta ? " si" : ""}" data-dm-rqi-scegli="${esc(voce.chiave)}" aria-pressed="${voce.chiave === scelta}" title="${esc(nomeDelDisegno(voce))}"><img src="${esc(srcDaMostrare({ src: `disegno:${voce.chiave}` }))}" alt="" loading="lazy" decoding="async"><span>${esc(nomeDelDisegno(voce))}</span></button>`;
  const noti = new Set(GRUPPI_DISEGNI.map((g) => g.chiave));
  const gruppi = [
    ...GRUPPI_DISEGNI.map((g) => ({
      nome: lingua === "it" ? g.nome.it : tr(g.nome.en),
      voci: trovati.filter((d) => d.gruppo === g.chiave),
    })),
    { nome: t("Altri", "Others"), voci: trovati.filter((d) => !noti.has(d.gruppo)) },
  ].filter((g) => g.voci.length);
  return gruppi
    .map(
      (g) =>
        `<div class="dm-rqi-gruppo"><div class="dm-rqi-sub">${esc(g.nome)}</div><div class="dm-rqi-pollici">${g.voci.map(pollice).join("")}</div></div>`,
    )
    .join("");
}

/* Come il riquadro parla nell'anteprima: quello che dira' sul tablet, se chi
 * ospita il blocco lo sa (`anteprima`), o un «Acceso» con l'interruttore. */
const ANTEPRIMA_DI_SERIE = () => ({
  stato: t("Acceso", "On"),
  acceso: true,
  destra: `<span class="dm-rq-int on" aria-hidden="true"><i></i></span>`,
  comandi: "",
  classi: "",
});

function corpoDelBlocco(chiave, immagine, { nome, accento, anteprima = null }) {
  const come = anteprima && typeof anteprima === "object" ? anteprima : ANTEPRIMA_DI_SERIE();
  const s = statoDel(chiave);
  const pulita = immaginePulita(immagine);
  const scelta = chiaveDelDisegno(pulita);
  const forma = s.forma === 1.5 ? 1.5 : 1;
  const zoom = Math.round((pulita?.zoom || 1) * 100);
  const inquadratura = pulita
    ? `<div class="dm-rqi-sub">${esc(scelta ? t("Inquadratura · il disegno", "Framing · the drawing") : t("Inquadratura · la tua foto", "Framing · your photo"))}</div>
    <div class="dm-rqi-crop">
      <div class="dm-rqi-tela" data-dm-rqi-tela tabindex="0" role="slider" aria-label="${esc(t("Dove guardare", "Where to look"))}" aria-valuetext="${pulita.fuoco[0]}% ${pulita.fuoco[1]}%" style="aspect-ratio:${misureDi(pulita).larghezza}/${misureDi(pulita).altezza}">
        <img src="${esc(srcDaMostrare(pulita))}" alt="" draggable="false" data-dm-rqi-misura="${esc(pulita.src)}">
        <div class="dm-rqi-cornice" data-dm-rqi-cornice style="${cornice(pulita, forma)}"></div>
        <span class="dm-rqi-mano">✥ ${esc(t("Trascina per spostare", "Drag to move"))}</span>
      </div>
      <div class="dm-rqi-lato">
        <div class="dm-rqi-sub">${esc(t("Forma", "Shape"))}</div>
        <div class="dm-rqi-seg" role="group"><button type="button" class="${forma === 1 ? "si" : ""}" data-dm-rqi-forma="1" aria-pressed="${forma === 1}">${esc(t("Home 1:1", "Home 1:1"))}</button><button type="button" class="${forma === 1.5 ? "si" : ""}" data-dm-rqi-forma="1.5" aria-pressed="${forma === 1.5}">${esc(t("Muro 3:2", "Wall 3:2"))}</button></div>
        <label class="dm-rqi-zoom"><span>${esc(t("Zoom", "Zoom"))} <b data-dm-rqi-zoom-letto>${zoom}%</b></span><input type="range" min="${ZOOM_MINIMO * 100}" max="${ZOOM_MASSIMO * 100}" step="5" value="${zoom}" data-dm-rqi-zoom aria-label="${esc(t("Zoom", "Zoom"))}"></label>
        <div class="dm-rqi-anteprima" data-dm-rqi-anteprima inert>${riquadroConImmagineMarkup({
          immagine: pulita,
          nome: nome || t("Riquadro", "Tile"),
          stato: String(come.stato ?? ""),
          acceso: Boolean(come.acceso),
          accento: come.accento || accento,
          destra: String(come.destra || ""),
          comandi: String(come.comandi || ""),
          classi: String(come.classi || ""),
          stile: `aspect-ratio:${forma}`,
        })}</div>
        <div class="dm-rqi-mini">${esc(t("Si salva solo dove guardare e lo zoom: la foto resta intera, e ogni forma di riquadro la taglia da lì.", "Only where to look and the zoom are saved: the photo stays whole, and each tile shape crops it from there."))}</div>
      </div>
    </div>
    <div class="dm-rqi-azioni"><button type="button" class="dm-rqi-togli" data-dm-rqi-togli>✕ ${esc(t("Togli immagine", "Remove image"))}</button><span class="dm-rqi-mini">${esc(t("Torna il disegno di sempre.", "The usual drawing comes back."))}</span></div>`
    : "";
  return `<div class="dm-rqi-testa"><h3>${esc(t("Immagine", "Image"))}</h3><small>${esc(t("Riempie il riquadro al posto del disegno", "Fills the tile instead of the drawing"))}</small></div>
    <div class="dm-rqi-due">
      <label class="dm-rqi-big"><span class="dm-rqi-ic">${ICONA_FOTO}</span><span><b>${esc(t("Carica una foto", "Upload a photo"))}</b><small>${esc(t("Dal telefono o dal computer · JPG, PNG, HEIC", "From the phone or the computer · JPG, PNG, HEIC"))}</small></span><input type="file" accept="image/*" data-dm-rqi-carica></label>
      <button type="button" class="dm-rqi-big" data-dm-rqi-disegni aria-expanded="${s.disegni}"><span class="dm-rqi-ic viola">${ICONA_TAVOLOZZA}</span><span><b>${esc(t("Scegli dai disegni", "Choose from the drawings"))}</b><small>${esc(t("Le illustrazioni della plancia", "The dashboard's illustrations"))}</small></span></button>
    </div>
    <output class="dm-rqi-stato" data-dm-rqi-stato data-tipo="${esc(s.tipo)}">${esc(s.messaggio)}</output>
    ${
      s.disegni
        ? `<div class="dm-rqi-scelta"><input type="search" class="dm-rqi-cerca" data-dm-rqi-cerca value="${esc(s.cerca)}" placeholder="${esc(t("Cerca un disegno…", "Search a drawing…"))}" aria-label="${esc(t("Cerca un disegno…", "Search a drawing…"))}" autocomplete="off"><div class="dm-rqi-griglia" data-dm-rqi-griglia>${grigliaDeiDisegni(chiave, scelta)}</div></div>`
        : ""
    }
    ${inquadratura}
    <div class="dm-rqi-nota"><span class="dm-rqi-ic">${ICONA_CASA}</span><span><b>${esc(t("Resta in casa, nell'add-on", "It stays at home, in the add-on"))}</b><small>${esc(t("La foto si salva nell'add-on GdAHome, con le altre foto della plancia. Prima di partire il telefono la riduce a 1200 px; non passa da nessun server esterno.", "The photo is saved in the GdAHome add-on, with the dashboard's other photos. Before it leaves, the phone shrinks it to 1200 px; it goes through no outside server."))}</small></span></div>`;
}

/**
 * Il blocco «Immagine» di un riquadro, da mettere nella scheda che lo
 * configura. `chiave` dice di chi e' (una scheda puo' averne piu' d'uno):
 * torna nell'evento `dm-rqi-cambia`, con l'immagine nuova (o `null`).
 */
export function bloccoImmagineMarkup({
  chiave,
  immagine,
  nome = "",
  accento = "#0ea5e9",
  anteprima = null,
}) {
  const pulita = immaginePulita(immagine);
  const come = anteprima && typeof anteprima === "object" ? anteprima : null;
  return `<section class="dm-rqi" data-dm-rqi="${esc(chiave)}" data-dm-rqi-nome="${esc(nome)}" data-dm-rqi-accento="${esc(accento)}"${come ? ` data-dm-rqi-come="${esc(JSON.stringify(come))}"` : ""} data-dm-rqi-valore="${esc(JSON.stringify(pulita))}">${corpoDelBlocco(chiave, pulita, { nome, accento, anteprima: come })}</section>`;
}

function anteprimaDel(blocco) {
  try {
    return JSON.parse(blocco?.dataset?.dmRqiCome || "null");
  } catch (_errore) {
    return null;
  }
}

function valoreDel(blocco) {
  try {
    return immaginePulita(JSON.parse(blocco?.dataset?.dmRqiValore || "null"));
  } catch (_errore) {
    return null;
  }
}

function ridipingi(blocco) {
  if (!blocco) return;
  blocco.innerHTML = corpoDelBlocco(blocco.dataset.dmRqi, valoreDel(blocco), {
    nome: blocco.dataset.dmRqiNome || "",
    accento: blocco.dataset.dmRqiAccento || "#0ea5e9",
    anteprima: anteprimaDel(blocco),
  });
}

/* L'immagine scelta: si scrive nel blocco, si dice a chi lo ospita, e il
 * blocco si rifa'. Chi lo ospita salva; il blocco non sa dove. */
function scegli(blocco, immagine, { ridisegna = true } = {}) {
  const pulita = immaginePulita(immagine);
  blocco.dataset.dmRqiValore = JSON.stringify(pulita);
  if (ridisegna) ridipingi(blocco);
  blocco.dispatchEvent(
    new CustomEvent(EVENTO_IMMAGINE, {
      bubbles: true,
      detail: { chiave: blocco.dataset.dmRqi, immagine: pulita },
    }),
  );
}

function diciNelBlocco(blocco, messaggio, tipo = "") {
  const s = statoDel(blocco.dataset.dmRqi);
  s.messaggio = messaggio;
  s.tipo = tipo;
  const uscita = blocco.querySelector("[data-dm-rqi-stato]");
  if (uscita) {
    uscita.textContent = messaggio;
    uscita.dataset.tipo = tipo;
  }
}

/* Mentre si trascina o si muove lo zoom, si aggiornano la cornice e
 * l'anteprima e basta: rifare il blocco sotto il dito lo farebbe saltare. */
function aggiornaLaVista(blocco, immagine) {
  const s = statoDel(blocco.dataset.dmRqi);
  const forma = s.forma === 1.5 ? 1.5 : 1;
  const c = blocco.querySelector("[data-dm-rqi-cornice]");
  if (c) c.setAttribute("style", cornice(immagine, forma));
  const tela = blocco.querySelector("[data-dm-rqi-tela]");
  tela?.setAttribute("aria-valuetext", `${immagine.fuoco[0]}% ${immagine.fuoco[1]}%`);
  const img = blocco.querySelector("[data-dm-rqi-anteprima] .dm-rq-img");
  if (img) img.setAttribute("style", stileInLinea(immagine));
  const letto = blocco.querySelector("[data-dm-rqi-zoom-letto]");
  if (letto) letto.textContent = `${Math.round(immagine.zoom * 100)}%`;
}

/* ── la foto che parte dal telefono ──────────────────────────────────────── */

/* Si riduce prima di partire: una foto del telefono pesa cinque megabyte, un
 * riquadro ne mostra qualche centinaio di punti. WebP all'85%, o JPEG dove il
 * browser non sa scrivere WebP (Safari vecchi): il ponte accetta tutti e due. */
async function apriLaFoto(file) {
  if (typeof root.createImageBitmap === "function") {
    try {
      const bitmap = await root.createImageBitmap(file);
      return { sorgente: bitmap, w: bitmap.width, h: bitmap.height, chiudi: () => bitmap.close?.() };
    } catch (_errore) {
      /* Qualche formato il browser lo apre solo come <img>: si riprova. */
    }
  }
  const url = root.URL.createObjectURL(file);
  try {
    const img = await new Promise((fatto, rotto) => {
      const nuova = new root.Image();
      nuova.onload = () => fatto(nuova);
      nuova.onerror = () => rotto(new Error("decode"));
      nuova.src = url;
    });
    return {
      sorgente: img,
      w: img.naturalWidth,
      h: img.naturalHeight,
      chiudi: () => root.URL.revokeObjectURL(url),
    };
  } catch (errore) {
    root.URL.revokeObjectURL(url);
    throw errore;
  }
}

const comeBlob = (tela, tipo) =>
  new Promise((fatto) => {
    try {
      tela.toBlob((blob) => fatto(blob), tipo, QUALITA);
    } catch (_errore) {
      fatto(null);
    }
  });

export async function riduciLaFoto(file, lato = LATO_MASSIMO) {
  const aperta = await apriLaFoto(file);
  try {
    if (!aperta.w || !aperta.h) throw new Error("decode");
    const scala = Math.min(1, lato / Math.max(aperta.w, aperta.h));
    const w = Math.max(1, Math.round(aperta.w * scala));
    const h = Math.max(1, Math.round(aperta.h * scala));
    const tela = doc.createElement("canvas");
    tela.width = w;
    tela.height = h;
    const ctx = tela.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(aperta.sorgente, 0, 0, w, h);
    let blob = await comeBlob(tela, "image/webp");
    let suffisso = ".webp";
    if (!blob || blob.type !== "image/webp") {
      blob = await comeBlob(tela, "image/jpeg");
      suffisso = ".jpg";
    }
    if (!blob) throw new Error("encode");
    const radice =
      clean(file?.name)
        .replace(/\.[^.]*$/, "")
        .slice(0, 60) || "riquadro";
    return { blob, nome: `${radice}${suffisso}`, larghezza: w, altezza: h };
  } finally {
    aperta.chiudi();
  }
}

async function caricaNelBlocco(blocco, file) {
  diciNelBlocco(blocco, t("Riduco e carico la foto…", "Shrinking and uploading the photo…"));
  try {
    const ridotta = await riduciLaFoto(file);
    const src = await storeImage(ridotta.blob, ridotta.nome, { cartella: CARTELLA_DEI_RIQUADRI });
    const immagine = immaginePulita({ src, fuoco: [50, 50], zoom: 1 });
    if (!immagine) throw new Error(t("indirizzo non valido", "invalid address"));
    state.misure.set(immagine.src, { larghezza: ridotta.larghezza, altezza: ridotta.altezza });
    statoDel(blocco.dataset.dmRqi).disegni = false;
    diciNelBlocco(blocco, "");
    scegli(blocco, immagine);
  } catch (errore) {
    diciNelBlocco(
      blocco,
      `${t("Caricamento non riuscito", "Upload failed")} (${clean(errore?.message) || "?"})`,
      "errore",
    );
  }
}

/* ── i gesti del blocco ──────────────────────────────────────────────────── */

function bloccoDi(evento) {
  return evento.target?.closest?.("[data-dm-rqi]") || null;
}

function onClick(evento) {
  const blocco = bloccoDi(evento);
  if (!blocco) return;
  const chiave = blocco.dataset.dmRqi;
  const s = statoDel(chiave);
  const bersaglio = evento.target.closest(
    "[data-dm-rqi-disegni],[data-dm-rqi-scegli],[data-dm-rqi-forma],[data-dm-rqi-togli]",
  );
  if (!bersaglio) return;
  evento.preventDefault();
  evento.stopPropagation();
  const d = bersaglio.dataset;
  if (d.dmRqiDisegni !== undefined) {
    s.disegni = !s.disegni;
    ridipingi(blocco);
    if (s.disegni) blocco.querySelector("[data-dm-rqi-cerca]")?.focus?.({ preventScroll: true });
    return;
  }
  if (d.dmRqiScegli) {
    const voce = disegnoDaRiquadro(d.dmRqiScegli);
    if (!voce) return;
    diciNelBlocco(blocco, "");
    scegli(blocco, { src: `disegno:${voce.chiave}`, fuoco: voce.fuoco, zoom: 1 });
    return;
  }
  if (d.dmRqiForma) {
    s.forma = Number(d.dmRqiForma) === 1.5 ? 1.5 : 1;
    ridipingi(blocco);
    return;
  }
  if (d.dmRqiTogli !== undefined) {
    diciNelBlocco(blocco, "");
    scegli(blocco, null);
  }
}

function onInput(evento) {
  const blocco = bloccoDi(evento);
  if (!blocco) return;
  const campo = evento.target;
  if (campo.matches?.("[data-dm-rqi-cerca]")) {
    statoDel(blocco.dataset.dmRqi).cerca = campo.value;
    const griglia = blocco.querySelector("[data-dm-rqi-griglia]");
    if (griglia)
      griglia.innerHTML = grigliaDeiDisegni(
        blocco.dataset.dmRqi,
        chiaveDelDisegno(valoreDel(blocco)),
      );
    evento.stopPropagation();
    return;
  }
  if (campo.matches?.("[data-dm-rqi-zoom]")) {
    const ora = valoreDel(blocco);
    if (!ora) return;
    const nuova = immaginePulita({ ...ora, zoom: Number(campo.value) / 100 });
    blocco.dataset.dmRqiValore = JSON.stringify(nuova);
    aggiornaLaVista(blocco, nuova);
    evento.stopPropagation();
  }
}

function onChange(evento) {
  const blocco = bloccoDi(evento);
  if (!blocco) return;
  const campo = evento.target;
  if (campo.matches?.("[data-dm-rqi-carica]")) {
    evento.stopPropagation();
    const file = campo.files?.[0];
    campo.value = "";
    if (file) caricaNelBlocco(blocco, file);
    return;
  }
  if (campo.matches?.("[data-dm-rqi-zoom]")) {
    evento.stopPropagation();
    const ora = valoreDel(blocco);
    if (ora) scegli(blocco, { ...ora, zoom: Number(campo.value) / 100 }, { ridisegna: false });
    return;
  }
  if (campo.matches?.("[data-dm-rqi-cerca]")) evento.stopPropagation();
}

/* Trascinare la cornice: dove la si lascia, li' si guarda. Un tocco fuori
 * dalla cornice ce la porta sopra, col centro sotto il dito. */
function onPointerDown(evento) {
  const tela = evento.target?.closest?.("[data-dm-rqi-tela]");
  if (!tela || evento.button > 0) return;
  const blocco = tela.closest("[data-dm-rqi]");
  const immagine = valoreDel(blocco);
  if (!blocco || !immagine) return;
  evento.preventDefault();
  const forma = statoDel(blocco.dataset.dmRqi).forma === 1.5 ? 1.5 : 1;
  const misure = misureDi(immagine);
  const rett = tela.getBoundingClientRect();
  if (!rett.width || !rett.height) return;
  let f = finestraVisibile(misure, forma, immagine);
  const px = (evento.clientX - rett.left) / rett.width;
  const py = (evento.clientY - rett.top) / rett.height;
  let ora = immagine;
  const dentro = px >= f.x && px <= f.x + f.w && py >= f.y && py <= f.y + f.h;
  if (!dentro) {
    const fuoco = fuocoDallaFinestra(misure, forma, immagine, px - f.w / 2, py - f.h / 2);
    ora = immaginePulita({ ...immagine, fuoco });
    f = finestraVisibile(misure, forma, ora);
    aggiornaLaVista(blocco, ora);
  }
  const inizio = { x: evento.clientX, y: evento.clientY, fx: f.x, fy: f.y };
  try {
    tela.setPointerCapture?.(evento.pointerId);
  } catch (_errore) {}
  const muovi = (e) => {
    const fuoco = fuocoDallaFinestra(
      misure,
      forma,
      ora,
      inizio.fx + (e.clientX - inizio.x) / rett.width,
      inizio.fy + (e.clientY - inizio.y) / rett.height,
    );
    ora = immaginePulita({ ...ora, fuoco });
    blocco.dataset.dmRqiValore = JSON.stringify(ora);
    aggiornaLaVista(blocco, ora);
  };
  const lascia = () => {
    tela.removeEventListener("pointermove", muovi);
    tela.removeEventListener("pointerup", lascia);
    tela.removeEventListener("pointercancel", lascia);
    scegli(blocco, ora, { ridisegna: false });
  };
  tela.addEventListener("pointermove", muovi);
  tela.addEventListener("pointerup", lascia);
  tela.addEventListener("pointercancel", lascia);
}

/* Con la tastiera: le frecce spostano il fuoco di due punti alla volta. */
const FRECCE = Object.freeze({
  ArrowLeft: [-2, 0],
  ArrowRight: [2, 0],
  ArrowUp: [0, -2],
  ArrowDown: [0, 2],
});
function onKeyDown(evento) {
  const tela = evento.target?.closest?.("[data-dm-rqi-tela]");
  const passo = FRECCE[evento.key];
  if (!tela || !passo) return;
  const blocco = tela.closest("[data-dm-rqi]");
  const ora = valoreDel(blocco);
  if (!ora) return;
  evento.preventDefault();
  const nuova = immaginePulita({
    ...ora,
    fuoco: [ora.fuoco[0] + passo[0], ora.fuoco[1] + passo[1]],
  });
  aggiornaLaVista(blocco, nuova);
  scegli(blocco, nuova, { ridisegna: false });
}

/* La misura vera di una foto, appena il browser l'ha aperta: la cornice
 * dipende dalla forma della foto, e una foto verticale non e' una 4:3. */
function ricordaLaMisura(evento) {
  const img = evento.target;
  if (!img?.matches?.("img[data-dm-rqi-misura]")) return;
  const src = img.dataset.dmRqiMisura;
  if (!src || chiaveDelDisegno({ src }) || !img.naturalWidth) return;
  const prima = state.misure.get(src);
  if (prima?.larghezza === img.naturalWidth && prima?.altezza === img.naturalHeight) return;
  state.misure.set(src, { larghezza: img.naturalWidth, altezza: img.naturalHeight });
  ridipingi(img.closest("[data-dm-rqi]"));
}

/* La foto salvata che il browser non riesce a mostrare: lo si dice, invece
 * di lasciare il «?» di Safari in mezzo alla cornice (#285). */
function fotoCheNonSiVede(evento) {
  const img = evento.target;
  if (!img?.matches?.("img[data-dm-rqi-misura]")) return;
  const src = img.dataset.dmRqiMisura;
  if (!src || chiaveDelDisegno({ src })) return;
  const blocco = img.closest("[data-dm-rqi]");
  if (!blocco) return;
  diciNelBlocco(
    blocco,
    t(
      "La foto è salvata, ma il browser non riesce ad aprirla. Riprova a caricarla; se resta così, riavvia Home Assistant.",
      "The photo is saved, but the browser cannot open it. Try uploading it again; if it stays like this, restart Home Assistant.",
    ),
    "errore",
  );
}

/* ── i Dispositivi della Home ────────────────────────────────────────────── */

/* Il colore della sezione Dispositivi: l'azzurro che la card accesa ha
 * sempre avuto. */
const ACCENTO_DEI_DISPOSITIVI = "#0ea5e9";

function dispositivi() {
  try {
    const letti = root.getDevices?.();
    if (Array.isArray(letti)) return letti;
  } catch (_errore) {}
  const salvati = readJson("cd_devices", []);
  return Array.isArray(salvati) ? salvati : [];
}

/**
 * Il vestito di una card dei Dispositivi con l'immagine.
 *
 * Il guscio la riscrive quando rifa' la griglia, e la aggiorna per `id`
 * (`dev-st-N`, `dev-val-N`) e con la classe `on`: il vestito nuovo tiene gli
 * stessi `id` e la stessa card, quindi l'aggiornamento del guscio continua a
 * funzionare senza sapere niente. Il tasto dell'interruttore e' il suo, con il
 * suo `onclick`: cambia solo la forma.
 */
export function vestiLaCardDelDispositivo(card, dispositivo, indice) {
  const immagine = immaginePulita(dispositivo?.immagine);
  if (!card || !immagine) return false;
  if (card.dataset.dmRqVestita === JSON.stringify(immagine)) return false;
  const tasto = card.querySelector(".dev-pwr");
  const stato = card.querySelector(`#dev-st-${indice}`)?.textContent || "—";
  const valore = card.querySelector(`#dev-val-${indice}`)?.textContent || "";
  card.classList.add("dm-rq");
  card.style.setProperty("--acc", ACCENTO_DEI_DISPOSITIVI);
  card.dataset.dmRqVestita = JSON.stringify(immagine);
  const markup = riquadroConImmagineMarkup({
    immagine,
    nome: clean(dispositivo?.name),
    stato,
    acceso: card.classList.contains("on"),
    accento: ACCENTO_DEI_DISPOSITIVI,
  });
  /* Dal riquadro si prende solo l'interno: la card resta quella del guscio. */
  const scatola = doc.createElement("div");
  scatola.innerHTML = markup;
  const fatto = scatola.firstElementChild;
  if (!fatto) return false;
  card.replaceChildren(...fatto.childNodes);
  const statoNodo = card.querySelector(".dm-rq-stato>span");
  if (statoNodo) {
    statoNodo.id = `dev-st-${indice}`;
    statoNodo.classList.add("dev-st");
    const val = doc.createElement("span");
    val.id = `dev-val-${indice}`;
    val.className = "dev-val dm-rq-val";
    val.textContent = valore;
    statoNodo.after(val);
  }
  if (tasto) {
    tasto.className = "dev-pwr dm-rq-int dm-rq-segue";
    tasto.replaceChildren(doc.createElement("i"));
    tasto.setAttribute("aria-label", clean(dispositivo?.name));
    card.querySelector(".dm-rq-alto")?.append(tasto);
  }
  return true;
}

function vestiIDispositivi() {
  const elenco = dispositivi();
  elenco.forEach((d, i) => {
    const card = doc?.getElementById?.(`dev-card-${i}`);
    if (!card) return;
    if (immaginePulita(d?.immagine)) vestiLaCardDelDispositivo(card, d, i);
  });
}

/* ── la scheda dei Dispositivi nel Config ────────────────────────────────── */

const SCHEDA_HOME = "sez0";
const schedaAperta = () => clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
const chiaveDelDispositivo = (i) => `dispositivo-${i}`;

function pollicino(d) {
  const immagine = immaginePulita(d?.immagine);
  if (immagine) return `<img src="${esc(srcDaMostrare(immagine))}" alt="" style="${esc(stileInLinea(immagine))}">`;
  return esc(clean(d?.icon) || "🔌");
}

function pannelloDeiDispositivi() {
  const elenco = dispositivi();
  if (!elenco.length) return "";
  const aperto = state.dispositivoAperto ?? -1;
  return `<div class="ed-sec-title">🖼️ ${esc(t("Immagini dei Dispositivi", "Device images"))}</div>
    <div class="ed-intro">${esc(t("Un dispositivo della Home può avere una foto o un disegno che riempie il suo riquadro. Nome e stato restano sul velo scuro in fondo, in bianco.", "A Home device can have a photo or a drawing that fills its tile. Name and state stay on the dark veil at the bottom, in white."))}</div>
    <div class="ed-list">${elenco
      .map((d, i) => {
        const nome = clean(d?.name) || `#${i + 1}`;
        const immagine = immaginePulita(d?.immagine);
        return `<div class="ed-row dm-rq-riga" data-dm-rq-dispositivo="${i}">
        <span class="dm-rq-pollicino" aria-hidden="true">${pollicino(d)}</span>
        <span class="ed-row-main"><strong class="ed-row-new">${esc(nome)}</strong><small class="ed-row-old">${esc(immagine ? (chiaveDelDisegno(immagine) ? t("Disegno", "Drawing") : t("Foto", "Photo")) : t("Senza immagine", "No image"))}</small></span>
        <button type="button" class="dm-rq-apri" data-dm-rq-apri="${i}" aria-expanded="${aperto === i}">🖼️ ${esc(t("Immagine", "Image"))}</button>
      </div>${aperto === i ? bloccoImmagineMarkup({ chiave: chiaveDelDispositivo(i), immagine, nome, accento: ACCENTO_DEI_DISPOSITIVI }) : ""}`;
      })
      .join("")}</div>`;
}

function firmaDelPannello() {
  return `${state.dispositivoAperto ?? -1}|${JSON.stringify(dispositivi().map((d) => [d?.name, d?.icon, d?.immagine]))}`;
}

export function ensurePannelloDeiDispositivi(body = doc?.getElementById?.("ed-body")) {
  if (!body) return false;
  let pannello = body.querySelector(":scope > [data-dm-rq-dispositivi]");
  if (schedaAperta() !== SCHEDA_HOME || !dispositivi().length) {
    pannello?.remove();
    return false;
  }
  const firma = firmaDelPannello();
  if (pannello && pannello.dataset.dmFirma === firma && body.lastElementChild === pannello)
    return true;
  if (!pannello) {
    pannello = doc.createElement("div");
    pannello.className = "dm-rq-dispositivi";
    pannello.dataset.dmRqDispositivi = "true";
  }
  if (pannello.dataset.dmFirma !== firma) {
    pannello.dataset.dmFirma = firma;
    pannello.innerHTML = pannelloDeiDispositivi();
  }
  if (body.lastElementChild !== pannello) body.append(pannello);
  return true;
}

function onClickDelPannello(evento) {
  const tasto = evento.target?.closest?.("[data-dm-rq-dispositivi] [data-dm-rq-apri]");
  if (!tasto) return;
  evento.preventDefault();
  const i = Number(tasto.dataset.dmRqApri);
  state.dispositivoAperto = state.dispositivoAperto === i ? -1 : i;
  ensurePannelloDeiDispositivi();
}

/* L'immagine scelta nel blocco di un dispositivo: si scrive nel suo
 * `cd_devices`, la griglia della Home si rifa', e il pannello si aggiorna
 * senza chiudere il blocco aperto. */
function onCambiaDispositivo(evento) {
  const chiave = String(evento.detail?.chiave || "");
  const m = /^dispositivo-(\d+)$/.exec(chiave);
  if (!m) return;
  const i = Number(m[1]);
  const elenco = dispositivi().map((d) => ({ ...d }));
  if (!elenco[i]) return;
  const immagine = immaginePulita(evento.detail?.immagine);
  if (immagine) elenco[i].immagine = immagine;
  else delete elenco[i].immagine;
  writeJsonIfChanged("cd_devices", elenco);
  root.buildDeviceCards?.();
  const riga = doc?.querySelector?.(`[data-dm-rq-dispositivo="${i}"] .dm-rq-pollicino`);
  if (riga) riga.innerHTML = pollicino(elenco[i]);
  const pannello = doc?.querySelector?.("[data-dm-rq-dispositivi]");
  if (pannello) pannello.dataset.dmFirma = firmaDelPannello();
}

/* ── le card del guscio: luci, clima, tapparelle, telecamere, stanze, azioni ──
 *
 * «Lo devi aggiungere a tutti.» Le card che il guscio e le sue sezioni
 * disegnano da se' non si riscrivono: hanno i loro comandi — la levetta, il
 * cursore della luminosita', ▲ ■ ▼, il meno e il piu' — e i loro
 * aggiornamenti per `id`. A quelle con un'immagine si mette sotto il fondo
 * (`fondoMarkup`: la foto e il velo scuro) e la classe `dm-rq-fondo`, che fa
 * il testo bianco e lascia ogni tasto dov'e' e com'e'. Quali card e di chi
 * sono lo dice l'elenco del nucleo (`core/superfici-con-immagine.js`): una
 * card nuova lo prende aggiungendo una riga li'. */

/* Il nome di una card che non e' la voce di un elenco: quello che dice a chi
 * legge (`aria-label`), o la sua prima scritta. */
function nomeDellaCard(card, ripiego) {
  const detto = clean(card.getAttribute?.("aria-label"));
  if (detto) return detto;
  const scritta = card.querySelector?.(
    "[class*='label'],[class*='name'],[class*='nome'],[class*='titolo'],strong,b",
  );
  return clean(scritta?.textContent).slice(0, 40) || ripiego;
}

/* Le voci di una superficie, dove stanno scritte. Quelle «mappa» sono le card
 * che la pagina ha adesso, ognuna con la sua chiave. */
function vociDi(superficie) {
  if (superficie.forma === "mappa") {
    const mappa = immaginiSciolte(readJson(CHIAVE_DELLE_IMMAGINI, {}));
    const viste = new Map();
    for (const card of doc?.querySelectorAll?.(superficie.selettore) || []) {
      if (card.closest("#dm-muro")) continue;
      const id = idDellaCard(superficie, card);
      if (!id || viste.has(id)) continue;
      viste.set(id, {
        chiave: id,
        name: nomeDellaCard(card, id),
        immagine: mappa[`${superficie.chiave}:${id}`] || null,
      });
    }
    return [...viste.values()];
  }
  if (superficie.sezione) {
    const voci = section(superficie.sezione, []);
    return Array.isArray(voci) ? voci : [];
  }
  if (superficie.chiave === "dispositivi") return dispositivi();
  if (superficie.forma === "righe") {
    const righe = readJson(superficie.casella, {})?.righe;
    return Array.isArray(righe) ? righe : [];
  }
  const voci = readJson(superficie.casella, []);
  return Array.isArray(voci) ? voci : [];
}

function vestiUnaCard(superficie, card, voce) {
  const immagine = immaginePulita(voce?.immagine);
  const dove = (superficie.dentro && card.querySelector(superficie.dentro)) || card;
  const firma = immagine ? JSON.stringify(immagine) : "";
  const posata = dove.querySelector(":scope > .dm-rq-img");
  if ((dove.dataset.dmRqFondo || "") === firma && Boolean(posata) === Boolean(immagine)) return false;
  dove.querySelectorAll(":scope > .dm-rq-img, :scope > .dm-rq-velo").forEach((n) => n.remove());
  if (!immagine) {
    dove.classList.remove("dm-rq-fondo");
    delete dove.dataset.dmRqFondo;
    return true;
  }
  dove.classList.add("dm-rq-fondo");
  dove.dataset.dmRqFondo = firma;
  dove.insertAdjacentHTML("afterbegin", fondoMarkup(immagine));
  return true;
}

/** Veste ogni card della pagina che ha un'immagine; toglie il vestito a chi
 * non l'ha piu'. Restituisce quante card ha toccato. */
export function vestiLeCardDellaPlancia(radice = doc) {
  if (!radice?.querySelectorAll) return 0;
  let toccate = 0;
  for (const superficie of SUPERFICI_DA_VESTIRE) {
    const card = [...radice.querySelectorAll(superficie.selettore)];
    if (!card.length) continue;
    const voci =
      superficie.forma === "mappa" ? readJson(CHIAVE_DELLE_IMMAGINI, {}) : vociDi(superficie);
    card.forEach((c, indice) => {
      /* Una card del muro o una gia' col vestito proprio non si tocca. */
      if (c.closest("#dm-muro") || c.classList.contains("dm-rq")) return;
      if (vestiUnaCard(superficie, c, voceDellaCard(superficie, voci, c, indice))) toccate += 1;
    });
  }
  return toccate;
}

/* Il guscio rifa' le card quando vuole: si guardano le pagine dove stanno
 * (`PAGINE_CON_IMMAGINI`, non tutto il documento), e dopo ogni giro di cambi
 * — uno per fotogramma — si rivestono. I nostri cambi non rimettono in moto
 * niente: una card gia' vestita come deve resta com'e'. Una pagina che non
 * c'e' ancora si prende al prossimo giro di installazione. */
function guardaLaPlancia() {
  if (!root.MutationObserver || !doc?.getElementById) return;
  let inAttesa = false;
  const giro = () => {
    inAttesa = false;
    try {
      vestiLeCardDellaPlancia();
    } catch (_errore) {}
  };
  state.osservatore ||= new root.MutationObserver(() => {
    if (inAttesa) return;
    inAttesa = true;
    (root.requestAnimationFrame || root.setTimeout)(giro);
  });
  const guardate = (state.pagineGuardate ||= new Set());
  for (const id of PAGINE_CON_IMMAGINI) {
    const pagina = doc.getElementById(id);
    if (!pagina || guardate.has(pagina)) continue;
    guardate.add(pagina);
    state.osservatore.observe(pagina, { childList: true, subtree: true });
  }
  giro();
}

/* ── la scheda «Immagini dei riquadri» nel Config ────────────────────────
 *
 * Nella Home del config, sotto i Dispositivi: per ogni superficie le sue
 * voci, ognuna col suo «🖼️ Immagine» che apre il blocco. L'immagine si scrive
 * addosso alla voce, dove la voce sta gia'. */
const chiaveDellaCard = (superficie, k) => `card:${superficie}:${k}`;

function pannelloDelleCard() {
  const gruppi = SUPERFICI_DA_VESTIRE.map((superficie) => ({ superficie, voci: vociDi(superficie) }))
    .filter((g) => g.voci.length);
  if (!gruppi.length) return "";
  const aperta = state.cardAperta || "";
  const lingua = activeLocale();
  return `<div class="ed-sec-title">🖼️ ${esc(t("Immagini dei riquadri", "Tile images"))}</div>
    <div class="ed-intro">${esc(t("Ogni card della plancia può avere una foto o un disegno che la riempie: le luci, il clima, le tapparelle, le telecamere, le stanze, le azioni rapide. I comandi restano sopra, in chiaro; a muro la stessa immagine si vede nelle pagine che si riempiono da sole.", "Every dashboard card can have a photo or a drawing that fills it: lights, climate, blinds, cameras, rooms, quick actions. The controls stay on top, readable; on the wall the same image shows on the pages that fill themselves."))}</div>
    ${gruppi
      .map(
        ({ superficie, voci }) => `<div class="dm-rq-sub-titolo">${esc(lingua === "it" ? superficie.nome.it : tr(superficie.nome.en))}</div>
    <div class="ed-list">${voci
      .map((voce, k) => {
        const chiave = chiaveDellaCard(superficie.chiave, k);
        const nome = nomeDellaVoce(voce, `#${k + 1}`);
        const immagine = immaginePulita(voce?.immagine);
        return `<div class="ed-row dm-rq-riga" data-dm-rq-card="${esc(chiave)}">
        <span class="dm-rq-pollicino" aria-hidden="true">${pollicino({ ...voce, icon: voce?.icon || "🖼️" })}</span>
        <span class="ed-row-main"><strong class="ed-row-new">${esc(nome)}</strong><small class="ed-row-old">${esc(immagine ? (chiaveDelDisegno(immagine) ? t("Disegno", "Drawing") : t("Foto", "Photo")) : t("Senza immagine", "No image"))}</small></span>
        <button type="button" class="dm-rq-apri" data-dm-rq-apri-card="${esc(chiave)}" aria-expanded="${aperta === chiave}">🖼️ ${esc(t("Immagine", "Image"))}</button>
      </div>${aperta === chiave ? bloccoImmagineMarkup({ chiave, immagine, nome, accento: ACCENTO_DEI_DISPOSITIVI, anteprima: { stato: "", acceso: false, destra: "", comandi: "", classi: "dm-rq-lettura" } }) : ""}`;
      })
      .join("")}</div>`,
      )
      .join("")}`;
}

function firmaDelleCard() {
  return `${state.cardAperta || ""}|${JSON.stringify(
    SUPERFICI_DA_VESTIRE.map((s) => vociDi(s).map((v) => [nomeDellaVoce(v), v?.immagine])),
  )}`;
}

export function ensurePannelloDelleCard(body = doc?.getElementById?.("ed-body")) {
  if (!body) return false;
  let pannello = body.querySelector(":scope > [data-dm-rq-card-pannello]");
  if (schedaAperta() !== SCHEDA_HOME) {
    pannello?.remove();
    return false;
  }
  const firma = firmaDelleCard();
  if (!pannello) {
    pannello = doc.createElement("div");
    pannello.className = "dm-rq-dispositivi dm-rq-card-pannello";
    pannello.dataset.dmRqCardPannello = "true";
  }
  if (pannello.dataset.dmFirma !== firma) {
    pannello.dataset.dmFirma = firma;
    pannello.innerHTML = pannelloDelleCard();
  }
  if (!pannello.innerHTML.trim()) {
    pannello.remove();
    return false;
  }
  if (body.lastElementChild !== pannello) body.append(pannello);
  return true;
}

function onClickDelleCard(evento) {
  const tasto = evento.target?.closest?.("[data-dm-rq-card-pannello] [data-dm-rq-apri-card]");
  if (!tasto) return;
  evento.preventDefault();
  const chiave = tasto.dataset.dmRqApriCard;
  state.cardAperta = state.cardAperta === chiave ? "" : chiave;
  ensurePannelloDelleCard();
}

/** Scrive l'immagine addosso alla voce, dove la voce sta. */
export async function mettiLImmagineAllaVoce(chiaveSuperficie, indice, immagine) {
  const superficie = superficieConImmagine(chiaveSuperficie);
  if (!superficie || superficie.propria) return false;
  const voci = vociDi(superficie);
  const voce = voci[indice];
  if (!voce) return false;
  const pulita = immaginePulita(immagine);
  if (superficie.forma === "mappa") {
    writeJsonIfChanged(
      CHIAVE_DELLE_IMMAGINI,
      conLImmagineSciolta(readJson(CHIAVE_DELLE_IMMAGINI, {}), superficie.chiave, voce.chiave, pulita),
    );
  } else if (superficie.sezione) {
    const store = dashboardStore();
    if (!store?.updateItem || !voce.id) return false;
    await store.updateItem(superficie.sezione, voce.id, { immagine: pulita });
  } else {
    const nuove = voci.map((v) => ({ ...v }));
    if (pulita) nuove[indice].immagine = pulita;
    else delete nuove[indice].immagine;
    if (superficie.forma === "righe")
      writeJsonIfChanged(superficie.casella, { ...readJson(superficie.casella, {}), righe: nuove });
    else writeJsonIfChanged(superficie.casella, nuove);
    if (superficie.chiave === "azioni") root.buildQuickActions?.();
  }
  vestiLeCardDellaPlancia();
  return true;
}

function onCambiaCard(evento) {
  const m = /^card:([a-z]+):(\d+)$/.exec(String(evento.detail?.chiave || ""));
  if (!m) return;
  mettiLImmagineAllaVoce(m[1], Number(m[2]), evento.detail?.immagine)
    .catch(() => false)
    .finally(() => {
      const pannello = doc?.querySelector?.("[data-dm-rq-card-pannello]");
      const riga = doc?.querySelector?.(`[data-dm-rq-card="${m[0]}"] .dm-rq-pollicino`);
      const voce = vociDi(superficieConImmagine(m[1]))[Number(m[2])];
      if (riga && voce) riga.innerHTML = pollicino({ ...voce, icon: voce.icon || "🖼️" });
      if (pannello) pannello.dataset.dmFirma = firmaDelleCard();
    });
}

export function installRiquadriConImmagine() {
  if (state.installed || !doc) return false;
  state.installed = true;
  installStyle("dm-riquadri-con-immagine-style", STILE);
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("input", onInput, true);
  doc.addEventListener("change", onChange, true);
  doc.addEventListener("pointerdown", onPointerDown, true);
  doc.addEventListener("keydown", onKeyDown, true);
  doc.addEventListener("load", ricordaLaMisura, true);
  doc.addEventListener("error", fotoCheNonSiVede, true);
  doc.addEventListener("click", onClickDelPannello);
  doc.addEventListener(EVENTO_IMMAGINE, onCambiaDispositivo);
  doc.addEventListener("click", onClickDelleCard);
  doc.addEventListener(EVENTO_IMMAGINE, onCambiaCard);
  /* I Dispositivi: dopo che il guscio ha fatto la griglia, e dopo ogni suo
   * aggiornamento (che rimette la classe `on`, e basta). */
  wrapFunction("buildDeviceCards", "__dmRiquadriConImmagine", vestiIDispositivi);
  wrapFunction("updateDeviceCards", "__dmRiquadriConImmagine", vestiIDispositivi);
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:persistence-restored"])
    root.addEventListener?.(evento, () => {
      wrapFunction("buildDeviceCards", "__dmRiquadriConImmagine", vestiIDispositivi);
      wrapFunction("updateDeviceCards", "__dmRiquadriConImmagine", vestiIDispositivi);
      vestiIDispositivi();
      guardaLaPlancia();
    });
  onEditorRedraw("__dmRiquadriConImmagineEditor", () => {
    ensurePannelloDeiDispositivi();
    ensurePannelloDelleCard();
  });
  vestiIDispositivi();
  guardaLaPlancia();
  doc.addEventListener?.("DOMContentLoaded", guardaLaPlancia, { once: true });
  return true;
}
