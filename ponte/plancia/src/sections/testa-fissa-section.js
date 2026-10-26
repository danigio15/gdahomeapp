/* La parte in alto che resta ferma mentre il resto scorre (#521).
 *
 * «Valutare se mettere un'opzione che tiene fissa tutta la parte iniziale, e
 * se uno scorre verso il basso vede il resto.»
 *
 * La parte iniziale e' l'intestazione: l'hamburger, il nome della casa, il
 * meteo e l'ora quando sta li'. E' la riga che si guarda per sapere che ore
 * sono e che tempo fa, ed e' anche la riga da cui si esce dalla plancia —
 * scorrendo in fondo a una Home lunga se ne va, e per tornarci si risale tutto.
 *
 * Non e' pero' una cosa da dare a tutti: su un telefono quella striscia e' un
 * quinto dello schermo, e tenerla ferma vuol dire leggere il resto da una
 * feritoia. Per questo e' un interruttore, sta spento, e sta accanto al modo
 * chiosco: sono la stessa famiglia di scelte — come si vede la plancia SU
 * QUESTO VETRO, non come e' configurata la casa. Il tablet appeso al muro la
 * vuole ferma, il telefono no, e sincronizzarla renderebbe impossibile averle
 * tutt'e due.
 *
 * Si tiene ferma con `position:sticky`, non con `fixed`: sticky resta dentro il
 * flusso — la pagina sotto non ci va a finire dietro e non serve compensare
 * l'altezza a mano, che e' il modo in cui queste cose si rompono al primo
 * schermo di dimensione diversa.
 */
import {
  ORDINE_IMPOSTAZIONI,
  clean,
  doc,
  dopoIGenerali,
  esc,
  NOTA_DI_SCHEDA,
  inserisciInOrdine,
  installStyle,
  onEditorRedraw,
  root,
  t,
  senzaCadere,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_TESTA_FISSA__";
const state = (root[KEY] ||= { installed: false });

const SCHEDA = "visib";
const BLOCCO = "dm-testa-fissa";

/* Resta su questo vetro, come il tema e il chiosco: non viaggia. */
const CASELLA = "dm_testa_fissa";
const ATTRIBUTO = "data-dm-testa-fissa";

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

/** Se la testa deve restare ferma su questo apparecchio. */
export function testaFissaAttiva() {
  try {
    return root.localStorage?.getItem?.(CASELLA) === "1";
  } catch (_errore) {
    return false;
  }
}

/** L'accende o la spegne, e lo scrive addosso al documento. */
export function setTestaFissa(accesa) {
  const vera = Boolean(accesa);
  try {
    root.localStorage?.setItem?.(CASELLA, vera ? "1" : "0");
  } catch (_errore) {}
  applicaTestaFissa();
  return vera;
}

/**
 * Porta la scelta sul documento.
 *
 * L'attributo sta sulla radice e non sull'intestazione: quella la ridisegna il
 * guscio a ogni giro, e una classe scritta su un nodo che viene rifatto e' una
 * classe che sparisce da sola.
 */
export function applicaTestaFissa() {
  const radice = doc?.documentElement;
  if (!radice) return false;
  if (testaFissaAttiva()) {
    radice.setAttribute(ATTRIBUTO, "true");
    misuraIlMargine();
  } else radice.removeAttribute(ATTRIBUTO);
  return true;
}

/* Quanto spazio lascia la card sotto di se': 30 px sul computer, 12 sul
 * telefono, e domani magari un altro numero. Il fondo intorno alla testa
 * ferma deve chiudere proprio quella fessura, ne' meno — si vedrebbe passare
 * quello che scorre — ne' piu' — coprirebbe la riga che viene dopo. */
function misuraIlMargine() {
  const testa = doc?.querySelector?.("body > header, #page-home > header");
  if (!testa) return;
  const margine = Number.parseFloat(root.getComputedStyle?.(testa)?.marginBottom);
  if (Number.isFinite(margine))
    doc.documentElement.style.setProperty("--dm-testa-sotto", `${Math.max(0, margine)}px`);
}

/* Fatto come il chiosco, che e' fatto come tutti gli altri blocchi di questa
 * scheda: etichetta e interruttore in riga, nota sotto. */
function corpoMarkup() {
  const accesa = testaFissaAttiva();
  return `<div class="ed-slot dm-testa" id="${BLOCCO}">
    <div class="dm-testa-riga">
      <span class="ed-slot-lbl">📌 ${esc(t("Intestazione fissa", "Pinned header"))}</span>
      <button type="button" class="dm-testa-int" role="switch"
        aria-checked="${accesa ? "true" : "false"}"
        aria-label="${esc(t("Intestazione fissa", "Pinned header"))}"
        data-dm-testa-int><i></i></button>
    </div>
    <div class="dm-testa-nota">${esc(
      t(
        "La parte in alto — hamburger, nome della casa, meteo — resta ferma e il resto della plancia le scorre sotto. Vale solo su questo apparecchio.",
        "The top strip — hamburger, house name, weather — stays put while the rest of the dashboard scrolls under it. This device only.",
      ),
    )}</div>
  </div>`;
}

/** Ridisegna il blocco se è già a video, senza toccare il resto della scheda. */
function ridipingi() {
  const gia = doc?.getElementById(BLOCCO);
  if (!gia) return false;
  const foglio = doc.createElement("div");
  foglio.innerHTML = corpoMarkup();
  const nuovo = foglio.firstElementChild;
  if (!nuovo) return false;
  nuovo.setAttribute("data-dm-ordine", gia.getAttribute("data-dm-ordine") || "");
  gia.replaceWith(nuovo);
  return true;
}

export function ensureTestaFissa() {
  if (!doc || schedaAttiva() !== SCHEDA) return false;
  const corpo = doc.getElementById("ed-body");
  if (!corpo) return false;
  if (doc.getElementById(BLOCCO)) return true;
  const foglio = doc.createElement("div");
  foglio.innerHTML = corpoMarkup();
  const riga = foglio.firstElementChild;
  if (!riga) return false;
  inserisciInOrdine(corpo, riga, ORDINE_IMPOSTAZIONI.testaFissa, dopoIGenerali);
  return true;
}

function onClick(evento) {
  const interruttore = evento.target?.closest?.("[data-dm-testa-int]");
  if (!interruttore) return;
  evento.preventDefault();
  setTestaFissa(!testaFissaAttiva());
  ridipingi();
}

function installStili() {
  installStyle(
    "dm-testa-fissa-style",
    `
    /* Lo stesso respiro fra un blocco e l'altro che ha la lingua: quattro
       blocchi con quattro distanze diverse si vedono, e sono la prima cosa che
       si vede aprendo questa scheda. */
    #${BLOCCO}{margin-bottom:16px}
    #${BLOCCO} .dm-testa-riga{
      display:flex;align-items:center;justify-content:space-between;gap:12px}
    #${BLOCCO} .dm-testa-riga .ed-slot-lbl{margin:0}
    #${BLOCCO} .dm-testa-nota{margin-top:2px;${NOTA_DI_SCHEDA}}
    #${BLOCCO} .dm-testa-int{
      position:relative;width:38px;height:22px;flex:0 0 auto;padding:0;cursor:pointer;
      border:0;border-radius:999px;background:var(--divider-color,#cbd5e1);transition:background .18s ease}
    #${BLOCCO} .dm-testa-int[aria-checked="true"]{background:var(--success-color,#10b981)}
    #${BLOCCO} .dm-testa-int i{
      position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;
      background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .18s ease}
    #${BLOCCO} .dm-testa-int[aria-checked="true"] i{transform:translateX(16px)}
    #${BLOCCO} .dm-testa-int:focus-visible{
      outline:3px solid color-mix(in srgb,var(--primary-color,#0ea5e9) 40%,transparent);outline-offset:2px}

    /* La testa ferma.
     *
     * Resta la card di sempre — il suo fondo, il suo bordo, la sua ombra — e
     * il fondo della plancia le sta intorno, perche' quello che scorre sotto
     * non si veda passare ai lati e nella fessura sotto di lei. La card non si
     * ridipinge: si mette sotto il suo colore il fondo della plancia, cosi'
     * anche la card «di vetro» del tema scuro resta opaca senza cambiare
     * tinta. Intorno ci pensa un'ombra piena del colore del fondo, larga ai
     * lati e lunga sotto quanto il margine della card («--dm-testa-sotto»,
     * misurato: cambia col vetro). Prima il fondo stava in un «::before»
     * sopra il fondo della card, e la card spariva: restava una striscia
     * piatta col menu e il meteo, senza riquadro.
     *
     * Due genitori e non uno. L'intestazione sta sotto «body», ma chi la mette
     * in fila fra i blocchi della Home la sposta dentro «#page-home»
     * (portaLaTestataInPagina): con il solo «body > header» la testa ferma
     * smetteva di funzionare proprio nella pagina in cui l'utente l'aveva
     * spostata. Si dichiarano tutti e due i posti che la plancia le conosce.
     *
     * Sopra i 560 px di altezza e basta: su uno schermo basso — un telefono
     * coricato, una finestra stretta — una testa ferma alta un quinto lascia
     * per il resto una feritoia, e chi l'ha accesa non voleva quello.
     *
     * Ferma a zero, non sotto la fascia dell'orologio: chi scorre e' il corpo
     * della pagina, e il corpo la fascia l'ha gia' lasciata fuori col suo
     * margine in cima (beta12, #214). Lo zero di una testa ferma e' gia' sotto
     * l'orologio; dire di nuovo «la fascia» la spingeva giu' una seconda
     * volta — nell'app e su iPhone scendeva di un'intera fascia e copriva la
     * riga sotto il meteo, quella di cosa e' acceso. */
    @media (min-height:560px){
      html[${ATTRIBUTO}="true"] body > header,
      html[${ATTRIBUTO}="true"] #page-home > header{
        position:sticky;top:0;z-index:30;
        background-color:var(--bg-sculpted,#f0f4f8);
        background-image:linear-gradient(var(--card-bg,#fff),var(--card-bg,#fff));
        box-shadow:var(--shadow-sculpted,none),
          0 calc(var(--dm-testa-sotto,12px) - 14px) 0 14px var(--bg-sculpted,#f0f4f8)}
      html[data-theme="dark"][${ATTRIBUTO}="true"] body > header,
      html[data-theme="dark"][${ATTRIBUTO}="true"] #page-home > header{
        background-image:linear-gradient(var(--card-glass),var(--card-glass))}
    }
    `,
  );
}

export function installTestaFissa() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStili();
  applicaTestaFissa();
  doc.addEventListener("click", onClick);
  root.addEventListener?.("resize", () => {
    if (testaFissaAttiva()) misuraIlMargine();
  });
  onEditorRedraw("__dmTestaFissa", () => root.queueMicrotask?.(ensureTestaFissa));
  ensureTestaFissa();
  return true;
}

senzaCadere(installTestaFissa);
