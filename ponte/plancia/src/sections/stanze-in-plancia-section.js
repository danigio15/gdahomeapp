/* Le stanze in plancia (#493).
 *
 * «Have the option to display a block on the home screen — like a widget or a
 * quick action — showing the rooms or areas of the house (such as the garden,
 * garage, etc.). It should also be possible to choose which rooms or areas
 * appear on the home screen.»
 *
 * Le stanze la plancia le ha già tutte: la loro pagina, le loro entità, la loro
 * icona. Quello che non aveva è il pezzo di casa da cui si guardano senza
 * aprire niente — una fila di stanze in plancia, con dentro la temperatura e
 * cosa c'è acceso, e il tocco che porta dentro la stanza.
 *
 * Il blocco non c'è finché nessuno sceglie una stanza: una plancia non deve
 * riempirsi da sola di roba che nessuno ha chiesto. Chi ne sceglie una lo vede
 * comparire, e da lì in poi si sposta con gli altri blocchi — le persone, le
 * tessere, le azioni rapide — perché è un blocco come loro.
 *
 * Si spegne anche da qui. «Nelle stanze della home dove compare la lucina
 * quando sono accese le luci, si può spegnere tutto senza entrare nella
 * stanza?» — l'ha chiesto il cliente di un installatore, al primo minuto, e
 * arrivava da Fibaro. Adesso sì: la luce, la presa e il clima accesi sono tasti
 * in fondo alla card, e il tocco chiede prima di spegnere, come nella pagina
 * Stanze. Il resto della card porta dentro, come prima.
 *
 * Chi decide sta nel modulo puro `core/stanze-in-plancia.js`; qui c'è la mano
 * che disegna, il tocco che porta nella stanza e quello che spegne.
 */
import { eAcceso } from "../core/stato-acceso.js";
import { oggettoWidget } from "../core/oggetti-widget.js";
import {
  PASTIGLIE_DELLA_STANZA,
  QUANTO_DURA_LA_DOMANDA,
  QUANTO_DURA_L_ANNULLA,
} from "../core/le-stanze-per-piano.js";
import {
  FONDO_DELLA_CARTA,
  GRANA_DELLA_CARTA,
  OMBRA_DELLA_CARTA,
  tokenDellaCarta,
} from "../core/le-vesti-della-carta.js";
import { CHIAVE_STANZE_IN_PLANCIA, stanzeInPlancia } from "../core/stanze-in-plancia.js";
import {
  allStates,
  clean,
  doc,
  esc,
  formatNumber,
  iconGlyphHtml,
  installStyle,
  readJson,
  root,
  t,
} from "./shared.js";
import {
  apriLaStanza,
  cosaSiSpegne,
  cosaSiSpegneAParole,
  parolaDelFatto,
  roomPages,
  spegnereDaFuori,
  vivo,
} from "./rooms-page-section.js";

const KEY = "__DASHBOARDMODERN_STANZE_IN_PLANCIA__";
const STYLE_ID = "dm-stanze-plancia-style";
export const BLOCCO_ID = "dm-stanze-home";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  firma: "",
  /* La domanda aperta su una card e l'annulla che resta dopo. Stanno nello
   * stato e non nel documento: il blocco si ridisegna al primo cambio di stato
   * — cioè proprio quando la luce si spegne — e un «Annulla» appeso al
   * documento sparirebbe nell'istante in cui serve. */
  chiesta: null,
  annulla: null,
  sveglia: 0,
});

/* Chiedere, spegnere e rimettere sono quelli della pagina Stanze: la regola è
 * una, e qui c'è solo il posto dove si vede. */
const velo = spegnereDaFuori(state, () => ridisegnaStanzeInPlancia());

export function stanzeScelte() {
  const scritto = readJson(CHIAVE_STANZE_IN_PLANCIA, []);
  return Array.isArray(scritto) ? scritto : [];
}

/* Il disegno della stanza, dal catalogo di casa: è lo stesso che la stanza
 * porta nella sua pagina e nel Clima, e prenderne un altro qui vorrebbe dire
 * la stessa stanza con due facce.
 *
 * Il ripiego non e' il token. Qui si tornava a mani vuote quando il motore non
 * rispondeva, e chi chiamava scriveva al suo posto `pagina.icon`: una stanza
 * con l'icona scelta dal catalogo mdi si ritrovava «mdi:sofa» stampato come
 * parola dentro la card. Il ripiego adesso e' un simbolo, ed e' `iconGlyphHtml`
 * a sceglierlo — la stessa regola di tutta la plancia, scritta una volta. */
function disegnoDellaStanza(icona) {
  return iconGlyphHtml(icona, { size: 34, kind: "room", fallback: "🛋️" });
}

const numero = (entity, states) => {
  const grezzo = clean(states?.[clean(entity)]?.state).replace(",", ".");
  const valore = Number.parseFloat(grezzo);
  return Number.isFinite(valore) ? valore : null;
};

/**
 * Cosa dice la card di una stanza: i gradi, l'umidità, e quante cose accese.
 *
 * Le cose accese si contano su quello che la stanza ha davvero dentro — le
 * stesse voci che la sua pagina elenca — e non su un elenco parallelo: due
 * conti della stessa cosa diventano due conti diversi al primo blocco nuovo.
 */
/* Che disegno porta ogni genere di cosa, nel conto per tipo (#546).
 *
 * «Small icons should appear on the card to indicate the status or count of
 * lights (on/off), climate control, power outlets, alerts, doors, windows and
 * temperature.» Il conto unico — «3 accese» — non distingue una luce da un
 * condizionatore, ed e' proprio la distinzione che serve a decidere se valga
 * la pena entrare nella stanza.
 *
 * I disegni sono quelli di casa, gli stessi delle tessere e della fascia sotto
 * il meteo: un blocco della stanza e la tessera che lo racconta devono avere
 * la stessa faccia. Le emoji che la pagina Stanze usa per i titoli dei blocchi
 * qui non entrano — sarebbero un secondo alfabeto per la stessa cosa. */
const OGGETTO_DEL_BLOCCO = Object.freeze({
  luci: "luci",
  clima: "clima",
  prese: "prese",
  coperture: "tapparelle",
  elettrodomestici: "elettrodomestici",
  media: "media",
  telecamere: "telecamere",
  carichi: "energia",
  robot: "robot",
  irrigazione: "irrigazione",
  altro: "evidenza",
});

export function riassuntoDellaStanza(pagina, states = allStates()) {
  const gradi = numero(pagina?.temp, states);
  const umidita = numero(pagina?.hum, states);
  let accese = 0;
  /* Il conto per genere, nell'ordine in cui i blocchi stanno nella stanza: e'
   * l'ordine che la pagina della stanza mostra gia', e due ordini diversi per
   * la stessa casa sono due cose da tenere a mente. */
  const perTipo = [];
  for (const blocco of pagina?.blocchi || []) {
    const chiave = clean(blocco?.key);
    let quante = 0;
    for (const voce of blocco?.voci || []) {
      /* «Acceso» non vuol dire `on` e basta: una cassa che suona dice
       * `playing`, un condizionatore che scalda dice `heat`, un robot al
       * lavoro dice `cleaning`. Contando la sola parola `on` si contavano gli
       * interruttori, e una stanza con la musica accesa e il termosifone che
       * va risultava spenta. Le parole stanno in un posto solo. */
      const entity = clean(voce?.entity || voce?.entity_id);
      if (entity && eAcceso(states?.[entity])) quante += 1;
    }
    if (!quante) continue;
    accese += quante;
    perTipo.push({ chiave, oggetto: OGGETTO_DEL_BLOCCO[chiave] || "evidenza", quante });
  }
  return { gradi, umidita, accese, perTipo, quante: Number(pagina?.count) || 0 };
}

/* ── i tasti che spengono ────────────────────────────────────────────────── */

/* I generi che si spengono dalla card, e in quell'ordine: quelli che la pagina
 * Stanze dichiara `spegni` — la luce, la presa, il clima. La regola è una per
 * i due posti, così la stessa lampadina fa la stessa cosa in Home e
 * nell'elenco delle stanze. */
const SI_SPENGONO = PASTIGLIE_DELLA_STANZA.filter((voce) => voce.comanda === "spegni").map(
  (voce) => voce.chiave,
);

/**
 * I tasti di una stanza: per ogni genere che si spegne, quante cose spegne
 * adesso.
 *
 * Il numero è quello di `cosaSiSpegne` — le cose che il tocco spegne davvero —
 * e non il conto per genere della card: una luce accesa che non risponde, o
 * che chi ha la casa ha chiuso col lucchetto, si conta fra le accese ma un
 * comando non la raggiunge. Un tasto che dice «2» e ne spegne una è una
 * promessa non mantenuta.
 */
export function tastiDellaStanza(pagina, states = allStates()) {
  return SI_SPENGONO.map((chiave) => ({
    chiave,
    quante: cosaSiSpegne(pagina, chiave, states).length,
  })).filter((tasto) => tasto.quante > 0);
}

/* Le cose accese che non hanno un tasto, a parole: «Tapparelle · Musica ·
 * Robot». Stanno sotto i gradi come la didascalia delle tessere, e sono parole
 * perché qui non si toccano — un disegno accanto ai tasti sembrerebbe un tasto
 * anche lui. Il quanto lo dicono i tasti e la stanza; qui basta il cosa.
 *
 * Sono i nomi delle sezioni, gli stessi del menu e delle tessere: chi legge
 * «Musica» sa già dove andare a cercarla, e sono parole che la plancia sa già
 * dire in tutte le sue lingue.
 *
 * Ci finiscono anche le luci, le prese e il clima accesi che non si possono
 * spegnere da qui: una luce col lucchetto non ha un tasto, ma resta accesa, e
 * la card lo deve dire. */
const NOME_DEL_GENERE = Object.freeze({
  luci: () => t("Luci", "Lights"),
  prese: () => t("Prese", "Sockets"),
  clima: () => t("Clima", "Climate"),
  coperture: () => t("Tapparelle", "Shutters"),
  elettrodomestici: () => t("Elettrodomestici", "Appliances"),
  media: () => t("Musica", "Music"),
  telecamere: () => t("Telecamere", "Cameras"),
  carichi: () => t("Carichi", "Loads"),
  robot: () => t("Robot", "Robots"),
  irrigazione: () => t("Irrigazione", "Irrigation"),
  altro: () => t("Altro", "Other"),
});

export function didascaliaDellaStanza(perTipo, tasti = []) {
  if (!perTipo.length) return t("Tutto spento", "All off");
  const conTasto = new Set(tasti.map((tasto) => tasto.chiave));
  const nomi = perTipo
    .filter((voce) => !conTasto.has(voce.chiave))
    .map((voce) => (NOME_DEL_GENERE[voce.chiave] || NOME_DEL_GENERE.altro)());
  /* Due blocchi dello stesso genere — «altro» e un genere che non conosciamo —
   * non scrivono due volte la stessa parola. */
  return [...new Set(nomi)].join(" · ");
}

/* Quanto resta alla domanda o all'annulla, per la riga che si accorcia sotto
 * il tasto: la durata intera e quanto ne è già passato. Il blocco si
 * ridisegna a ogni cambio di stato della casa, e senza il «già passato» la
 * riga ripartirebbe da capo ogni volta che un sensore cambia, mentre il tempo
 * vero va avanti. */
function tempoCheResta(momento, durata) {
  const passato = Math.max(0, Math.min(durata, durata - (Number(momento.fino) - Date.now())));
  return `--dm-dura:${durata}ms;--dm-gia:-${Math.round(passato)}ms`;
}

function tastoMarkup(pagina, tasto) {
  const parola = `${t("Spegni", "Turn off")} ${cosaSiSpegneAParole(tasto.chiave, tasto.quante)}`;
  return `<button type="button" class="dm-stanza-plancia-tasto" data-dm-stanza-plancia-spegni="${esc(tasto.chiave)}"
      title="${esc(parola)}" aria-label="${esc(parola)}"><span class="dm-stanza-plancia-tasto-ic" aria-hidden="true">${oggettoWidget(
        OGGETTO_DEL_BLOCCO[tasto.chiave] || "evidenza",
        "",
        `stanza-${pagina.id}-${tasto.chiave}`,
      )}</span><b>${esc(String(tasto.quante))}</b></button>`;
}

/* La zona dei comandi, in fondo alla card: i tasti; oppure, al loro posto, la
 * domanda; oppure quello che si è fatto, col modo di tornare indietro. Un
 * posto solo per tutti e tre: la card non cambia forma sotto il dito, e la
 * stanza su cui si sta rispondendo resta scritta sopra. */
function zonaDeiComandi(pagina, tasti) {
  const chiesta = state.chiesta;
  if (vivo(chiesta) && chiesta.stanza === pagina.id) {
    const quante = tasti.find((tasto) => tasto.chiave === chiesta.chiave)?.quante || 1;
    const domanda = `${t("Spegni", "Turn off")} ${cosaSiSpegneAParole(chiesta.chiave, quante)}?`;
    /* Il no non ha un tasto, come nella pagina Stanze: la domanda se ne va da
     * sola, e un tocco sul resto della card la chiude subito. Un ✕ accanto
     * rubava a «Spegni il clima?» la metà della riga. */
    return `<span class="dm-stanza-plancia-comandi" data-dm-momento="domanda" style="${tempoCheResta(chiesta, QUANTO_DURA_LA_DOMANDA)}">
      <button type="button" class="dm-stanza-plancia-si" data-dm-stanza-plancia-si="${esc(chiesta.chiave)}">${esc(domanda)}</button>
    </span>`;
  }
  const annulla = state.annulla;
  if (vivo(annulla) && annulla.stanza === pagina.id)
    return `<span class="dm-stanza-plancia-comandi" data-dm-momento="fatto" style="${tempoCheResta(annulla, QUANTO_DURA_L_ANNULLA)}">
      <span class="dm-stanza-plancia-fatto">✓ ${esc(parolaDelFatto(annulla.chiave, annulla.entita?.length || 0))}</span>
      <button type="button" class="dm-stanza-plancia-rimetti" data-dm-stanza-plancia-rimetti>${esc(t("Annulla", "Undo"))}</button>
    </span>`;
  if (!tasti.length) return "";
  return `<span class="dm-stanza-plancia-comandi" data-dm-momento="tasti">${tasti
    .map((tasto) => tastoMarkup(pagina, tasto))
    .join("")}</span>`;
}

/* I gradi grandi come il numero delle tessere, l'umidità piccola accanto. */
function misureMarkup(gradi, umidita) {
  if (gradi === null && umidita === null) return "";
  const grado =
    gradi === null
      ? ""
      : `<b class="dm-stanza-plancia-gradi">${esc(formatNumber(gradi, 1))}</b><i class="dm-stanza-plancia-grado">°</i>`;
  const umido =
    umidita === null ? "" : `<i class="dm-stanza-plancia-umido">${esc(String(Math.round(umidita)))}%</i>`;
  return `<span class="dm-stanza-plancia-misure">${grado}${umido}</span>`;
}

/* La card è una tessera, la stessa lingua dei widget che le stanno sopra: la
 * pastiglia col disegno, il nome in maiuscoletto, il numero grande — qui i
 * gradi — e sotto la didascalia. Prima era un'altra cosa: il disegno e il nome
 * in mezzo, e sotto una fila di pastiglie tutte uguali, quelle che si leggono e
 * quelle che si toccano. In Home era l'unico blocco che parlava un'altra
 * lingua. */
function cardMarkup(pagina, states) {
  const riassunto = riassuntoDellaStanza(pagina, states);
  const tasti = tastiDellaStanza(pagina, states);
  /* La card si accende quando è accesa la luce: è la «lucina» che si guarda da
   * fuori. Il resto acceso lo dicono i tasti e la didascalia; se la card
   * l'accendesse anche un condizionatore, in una casa abitata sarebbero
   * accese quasi tutte — e se gridano tutte non si sente nessuna. */
  const luce = riassunto.perTipo.some((voce) => voce.chiave === "luci");
  const didascalia = didascaliaDellaStanza(riassunto.perTipo, tasti);
  const disegno = disegnoDellaStanza(pagina.icon);
  return `<article class="dm-stanza-plancia" role="button" tabindex="0" data-dm-stanza-plancia="${esc(pagina.id)}"
      data-accesa="${luce}" aria-label="${esc(pagina.name)}">
    <span class="dm-stanza-plancia-cima">
      <span class="dm-stanza-plancia-ic" aria-hidden="true">${disegno}</span>
      <span class="dm-stanza-plancia-nome">${esc(pagina.name)}</span>
    </span>
    ${misureMarkup(riassunto.gradi, riassunto.umidita)}
    ${didascalia ? `<small class="dm-stanza-plancia-didascalia">${esc(didascalia)}</small>` : ""}
    ${zonaDeiComandi(pagina, tasti)}
  </article>`;
}

/* «E' nato un blocco»: l'avviso per chi mette i blocchi in fila.
 *
 * Il blocco nasce in fondo alla pagina, perche' `append` non conosce l'ordine
 * che chi ha la casa si e' scelto. Chi quell'ordine lo applica gira sugli
 * eventi di stato, e quando questo blocco nasce quel giro e' gia' passato: il
 * disegno sta dentro un requestAnimationFrame, la messa in fila no. Cosi' la
 * prima stanza spuntata compariva in coda alla Home — sotto i dispositivi,
 * anche a chi le stanze le aveva messe in cima — e ci restava fino al cambio
 * di stato seguente, che rimetteva tutto a posto per caso.
 *
 * Si avvisa invece di chiamare: e' la sezione che ordina a conoscere questa,
 * e chiamarla da qui sarebbe un anello fra due moduli. */
function avvisaCheENato() {
  try {
    root.dispatchEvent?.(
      new CustomEvent("dashboardmodern:blocco-nuovo", { detail: { id: BLOCCO_ID } }),
    );
  } catch (_errore) {}
}

function host(pagina) {
  let nodo = doc?.getElementById?.(BLOCCO_ID);
  if (nodo) return nodo;
  if (!pagina) return null;
  nodo = doc.createElement("section");
  nodo.id = BLOCCO_ID;
  nodo.className = "dm-stanze-plancia";
  pagina.append(nodo);
  avvisaCheENato();
  return nodo;
}

export function renderStanzeInPlancia() {
  const pagina = doc?.getElementById?.("page-home");
  if (!pagina) return false;
  let pagine = [];
  try {
    pagine = stanzeInPlancia(stanzeScelte(), roomPages());
  } catch (_errore) {
    pagine = [];
  }
  const nodo = doc.getElementById(BLOCCO_ID);
  if (!pagine.length) {
    /* Nessuna stanza scelta: il blocco non c'è. Lasciarlo vuoto vorrebbe dire
     * un titolo che annuncia il nulla, che è peggio di niente. */
    nodo?.remove();
    return false;
  }
  const states = allStates();
  const firma = [
    ...pagine.map((voce) => {
      const riassunto = riassuntoDellaStanza(voce, states);
      return [
        voce.id,
        voce.name,
        voce.icon,
        riassunto.gradi,
        riassunto.umidita,
        /* Il conto per genere, non solo il totale: una luce che si spegne
         * mentre si accende un condizionatore lascia il totale a due, e la
         * card sarebbe rimasta a dire «luce» fino al cambio dopo. */
        riassunto.perTipo.map((tipo) => `${tipo.chiave}:${tipo.quante}`).join(","),
        /* E i tasti, che contano quello che si spegne davvero: una luce che
         * smette di rispondere non cambia il conto degli accesi, ma toglie un
         * uno dal suo tasto. */
        tastiDellaStanza(voce, states)
          .map((tasto) => `${tasto.chiave}:${tasto.quante}`)
          .join(","),
      ].join("|");
    }),
    /* La domanda e l'annulla nascono e muoiono senza che cambi nessuno stato
     * della casa: senza di loro nella firma, il tocco non si vedrebbe. */
    [state.chiesta?.stanza, state.chiesta?.chiave, state.annulla?.stanza, state.annulla?.chiave]
      .map((voce) => voce || "")
      .join("~"),
  ].join("§");
  const casa = host(pagina);
  if (!casa) return false;
  if (state.firma === firma && casa.querySelector("[data-dm-stanza-plancia]")) return true;
  state.firma = firma;
  /* Il titolo porta il disegno di casa, non il divano di sistema: e' l'unico
   * posto del blocco che era rimasto a un'emoji, e su due telefoni diversi
   * aveva due facce. */
  casa.innerHTML = `<div class="section-title"><span class="dm-stanze-plancia-titolo-ic" aria-hidden="true">${oggettoWidget("stanze", "", "stanze-titolo")}</span>${esc(t("Stanze", "Rooms"))}</div>
    <div class="dm-stanze-plancia-griglia">${pagine
      .map((voce) => cardMarkup(voce, states))
      .join("")}</div>`;
  return true;
}

/* Il tocco: i tasti prima della card che li contiene. Senza uscire qui, ogni
 * tocco su un tasto porterebbe anche dentro la stanza. */
function onClick(evento) {
  const card = evento.target?.closest?.("[data-dm-stanza-plancia]");
  if (!card) return;
  const stanza = card.getAttribute("data-dm-stanza-plancia") || "";
  const spegni = evento.target.closest("[data-dm-stanza-plancia-spegni]");
  const si = evento.target.closest("[data-dm-stanza-plancia-si]");
  const rimetti = evento.target.closest("[data-dm-stanza-plancia-rimetti]");
  if (spegni || si || rimetti) {
    evento.preventDefault();
    evento.stopPropagation();
    if (spegni) velo.chiedi(stanza, spegni.getAttribute("data-dm-stanza-plancia-spegni") || "");
    else if (si) velo.spegni(stanza, si.getAttribute("data-dm-stanza-plancia-si") || "");
    else velo.rimetti();
    return;
  }
  evento.preventDefault();
  /* Con la domanda aperta, il tocco sul resto della card è un no: chi ha
   * toccato la lampadina per sbaglio si aspetta che la domanda sparisca, non
   * di finire dentro la stanza. */
  if (vivo(state.chiesta) && state.chiesta.stanza === stanza) {
    velo.lascia();
    return;
  }
  apriLaStanza(card.getAttribute("data-dm-stanza-plancia") || "");
}

/* La card non è più un <button> — dentro ha dei tasti, e un tasto dentro un
 * tasto non esiste — quindi Invio e spazio sulla card li deve raccogliere
 * qualcuno: aprono la stanza come il dito. Sui tasti dentro ci pensa il
 * browser, che li trasforma in un tocco. */
function onKey(evento) {
  if (evento.key !== "Enter" && evento.key !== " ") return;
  const card = evento.target?.closest?.("[data-dm-stanza-plancia]");
  if (!card || evento.target !== card) return;
  evento.preventDefault();
  apriLaStanza(card.getAttribute("data-dm-stanza-plancia") || "");
}

function schedule() {
  if (state.frame) return;
  state.frame =
    root.requestAnimationFrame?.(() => {
      state.frame = 0;
      try {
        renderStanzeInPlancia();
      } catch (errore) {
        root.console?.warn?.("[DashboardModern] stanze in plancia", errore);
      }
    }) || 0;
}

/** Rifà il blocco adesso: lo chiama la scheda quando si spunta una stanza. */
export function ridisegnaStanzeInPlancia() {
  state.firma = "";
  schedule();
}

/* L'ambra delle cose accese: è quella della tessera Luci, e della pastiglia
 * accesa di ogni tessera. */
const AMBRA = "#f59e0b";

function stile() {
  installStyle(
    STYLE_ID,
    `
  ${tokenDellaCarta(`#${BLOCCO_ID}`)}
  #${BLOCCO_ID}{display:block;margin-top:18px}
  #${BLOCCO_ID} .section-title{display:flex;align-items:center;gap:8px}
  .dm-stanze-plancia-titolo-ic{display:inline-grid;place-items:center;width:20px;height:20px}
  .dm-stanze-plancia-titolo-ic svg{width:20px;height:20px}
  /* La griglia delle tessere dei widget, con le sue misure. */
  #${BLOCCO_ID} .dm-stanze-plancia-griglia{
    display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(210px,1fr))}

  /* La tessera. Le vesti sono quelle di ogni card della plancia — fondo a
     carta, fili sui bordi, ombra corta e ombra lunga, la grana — e le misure
     quelle delle tessere dei widget, così le due file si leggono come una. */
  .dm-stanza-plancia{
    position:relative;overflow:hidden;display:flex;flex-direction:column;gap:10px;min-width:0;
    padding:15px 16px 16px;border:0;border-radius:22px;cursor:pointer;font:inherit;text-align:left;
    color:var(--text,#0f172a);background:${FONDO_DELLA_CARTA};box-shadow:${OMBRA_DELLA_CARTA};
    transition:transform .18s cubic-bezier(.16,1,.3,1),box-shadow .2s ease,background .45s ease}
  .dm-stanza-plancia::before{${GRANA_DELLA_CARTA}}
  /* Accesa: il velo ambra nell'angolo, il bordo che si scalda e l'ombra lunga
     che prende la tinta. È la lucina, vista da lontano. */
  .dm-stanza-plancia[data-accesa="true"]{
    background:
      radial-gradient(135% 105% at 100% 0%,
        color-mix(in srgb,${AMBRA} var(--dm-velo),transparent),transparent 66%),
      ${FONDO_DELLA_CARTA};
    box-shadow:
      inset 0 1px 0 var(--dm-vetrino),
      inset 0 0 0 1px color-mix(in srgb,${AMBRA} 28%,transparent),
      inset 0 -1px 0 color-mix(in srgb,${AMBRA} 16%,transparent),
      0 1px 1px rgba(15,23,42,.05),
      0 16px 32px -18px color-mix(in srgb,${AMBRA} 60%,rgba(15,23,42,.5))}
  @media(hover:hover){.dm-stanza-plancia:hover{transform:translateY(-2px)}}
  .dm-stanza-plancia:active{transform:translateY(1px) scale(.995)}
  .dm-stanza-plancia:focus-visible{outline:2px solid ${AMBRA};outline-offset:3px}

  /* La prima riga: la pastiglia col disegno della stanza, e il nome. */
  .dm-stanza-plancia-cima{position:relative;display:flex;align-items:center;gap:11px;min-width:0}
  .dm-stanza-plancia-ic{
    flex:0 0 41px;width:41px;height:41px;display:grid;place-items:center;border-radius:15px;font-size:20px;
    background:linear-gradient(158deg,
      color-mix(in srgb,var(--text,#0f172a) 8%,var(--card-bg,#fff)),
      color-mix(in srgb,var(--text,#0f172a) 3%,var(--card-bg,#fff)));
    box-shadow:
      inset 0 1px 0 var(--dm-vetrino),
      inset 0 0 0 1px color-mix(in srgb,var(--text,#0f172a) 7%,transparent),
      inset 0 -3px 6px -4px color-mix(in srgb,var(--text,#0f172a) 30%,transparent),
      0 5px 11px -9px rgba(15,23,42,.8);
    transition:background .5s ease,box-shadow .5s ease}
  .dm-stanza-plancia[data-accesa="true"] .dm-stanza-plancia-ic{
    background:linear-gradient(158deg,
      color-mix(in srgb,${AMBRA} var(--dm-cuscino),var(--card-bg,#fff)),
      color-mix(in srgb,${AMBRA} 9%,var(--card-bg,#fff)));
    box-shadow:
      inset 0 1px 0 var(--dm-vetrino),
      inset 0 0 0 1px color-mix(in srgb,${AMBRA} 32%,transparent),
      inset 0 -3px 7px -4px color-mix(in srgb,${AMBRA} 55%,transparent),
      0 10px 18px -11px color-mix(in srgb,${AMBRA} 90%,transparent)}
  .dm-stanza-plancia-ic svg{width:26px;height:26px;display:block}
  .dm-stanza-plancia-nome{
    flex:1;min-width:0;font-size:9.8px;font-weight:900;letter-spacing:.11em;line-height:1.25;
    text-transform:uppercase;color:var(--text-dim,#64748b);
    display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}

  /* La seconda riga: i gradi come il numero delle tessere, e l'umidità
     accanto senza pesare. Il margine negativo toglie l'aria che Oswald si
     prende dentro la riga, senza tagliargli la testa (vedi le tessere). */
  .dm-stanza-plancia-misure{display:block;min-width:0;line-height:1;white-space:nowrap}
  .dm-stanza-plancia-gradi{
    display:inline-flex;align-items:baseline;margin:-13.6px 0;
    font-family:'Oswald','Inter',sans-serif;font-weight:200;font-size:40px;line-height:1.6;
    letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  .dm-stanza-plancia-grado{
    margin-left:1px;font-style:normal;font-size:17px;font-weight:300;
    font-family:'Oswald','Inter',sans-serif;color:var(--text-dim,#64748b)}
  .dm-stanza-plancia-umido{
    margin-left:9px;font-style:normal;font-size:12px;font-weight:800;
    color:var(--text-dim,#64748b);font-variant-numeric:tabular-nums}
  /* Il resto acceso, a parole. Due righe al massimo: una stanza con sei cose
     accese si capisce lo stesso, e la card non si allunga. */
  .dm-stanza-plancia-didascalia{
    font-size:11px;font-weight:700;line-height:1.35;color:var(--text-dim,#94a3b8);
    display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}

  /* I comandi stanno in fondo: in una fila di card alte uguali, i tasti di
     tutte cadono sulla stessa riga. */
  .dm-stanza-plancia-comandi{display:flex;align-items:center;gap:6px;min-width:0;margin-top:auto}
  /* Il tasto è la pastiglia accesa delle tessere, in ambra: un cuscino col
     disegno della cosa e quante ne spegne. Alto un pollice, perché spegne. */
  .dm-stanza-plancia-tasto{
    flex:1 1 0;max-width:68px;min-width:0;height:44px;padding:0 6px;
    display:inline-flex;align-items:center;justify-content:center;gap:4px;
    border:0;border-radius:14px;cursor:pointer;font:inherit;font-size:13px;font-weight:900;
    font-variant-numeric:tabular-nums;color:#b45309;
    background:linear-gradient(158deg,
      color-mix(in srgb,${AMBRA} 30%,var(--card-bg,#fff)),
      color-mix(in srgb,${AMBRA} 10%,var(--card-bg,#fff)));
    box-shadow:
      inset 0 1px 0 var(--dm-vetrino),
      inset 0 0 0 1px color-mix(in srgb,${AMBRA} 34%,transparent),
      inset 0 -3px 7px -4px color-mix(in srgb,${AMBRA} 60%,transparent),
      0 10px 18px -11px color-mix(in srgb,${AMBRA} 90%,transparent)}
  .dm-stanza-plancia-tasto:active{transform:scale(.96)}
  .dm-stanza-plancia-tasto:focus-visible{outline:2px solid ${AMBRA};outline-offset:2px}
  .dm-stanza-plancia-tasto-ic{display:grid;place-items:center;width:20px;height:20px}
  .dm-stanza-plancia-tasto-ic svg{width:20px;height:20px;display:block}
  /* La domanda al posto dei tasti: un tasto solo, scuro e largo quanto la
     riga. Il no non ha un tasto — la domanda se ne va da sola, e il tocco sul
     resto della card la chiude — come nella pagina Stanze. */
  .dm-stanza-plancia-si,
  .dm-stanza-plancia-rimetti{position:relative;overflow:hidden;height:44px;border:0;border-radius:14px;
    cursor:pointer;font:inherit;font-size:12.5px;font-weight:900;white-space:nowrap}
  .dm-stanza-plancia-si{flex:1 1 auto;min-width:0;padding:0 10px;text-overflow:ellipsis;
    color:#f8fafc;background:#0f172a;box-shadow:0 10px 18px -12px rgba(15,23,42,.9)}
  .dm-stanza-plancia-rimetti{
    flex:0 0 auto;padding:0 14px;color:var(--text,#0f172a);
    background:linear-gradient(158deg,
      color-mix(in srgb,var(--text,#0f172a) 8%,var(--card-bg,#fff)),
      color-mix(in srgb,var(--text,#0f172a) 3%,var(--card-bg,#fff)));
    box-shadow:inset 0 1px 0 var(--dm-vetrino),
      inset 0 0 0 1px color-mix(in srgb,var(--text,#0f172a) 9%,transparent),
      0 5px 11px -9px rgba(15,23,42,.8)}
  /* Il tempo che resta per rispondere, o per tornare indietro: una riga che si
     accorcia sotto la parola. */
  .dm-stanza-plancia-si::after,
  .dm-stanza-plancia-rimetti::after{
    content:"";position:absolute;left:12px;right:12px;bottom:7px;height:2px;border-radius:2px;
    background:currentColor;opacity:.4;transform-origin:left;
    animation:dm-stanza-plancia-resta var(--dm-dura,2000ms) linear var(--dm-gia,0ms) both}
  @keyframes dm-stanza-plancia-resta{from{transform:scaleX(1)}to{transform:scaleX(0)}}
  .dm-stanza-plancia-fatto{flex:1 1 auto;min-width:0;font-size:12px;font-weight:900;
    color:var(--text-dim,#64748b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

  /* Al buio: il numero dei tasti più chiaro, e il sì chiaro su scuro. */
  html[data-theme="dark"] .dm-stanza-plancia-tasto,
  body.dark-theme .dm-stanza-plancia-tasto{color:#fbbf24}
  html[data-theme="dark"] .dm-stanza-plancia-si,
  body.dark-theme .dm-stanza-plancia-si{color:#0f172a;background:#f8fafc}

  /* Sugli schermi stretti scala tutto insieme, come le tessere. */
  @media(max-width:768px){
    .dm-stanza-plancia{padding:13px 13px 15px;gap:9px}
    .dm-stanza-plancia-ic{flex-basis:36px;width:36px;height:36px;border-radius:13px}
    .dm-stanza-plancia-ic svg{width:23px;height:23px}
    .dm-stanza-plancia-cima{gap:9px}
    .dm-stanza-plancia-nome{font-size:9.2px;letter-spacing:.07em}
    .dm-stanza-plancia-gradi{font-size:34px}
    .dm-stanza-plancia-didascalia{font-size:10.5px}
  }

  /* Due colonne sul telefono (#524).
   *
   * «Would it be possible to view the cards in two columns on smartphones? To
   * save space.» Una stanza per riga, su uno schermo da sei pollici, vuol dire
   * scorrere mezza pagina per leggere sei nomi — e il blocco delle stanze
   * serve a dare un colpo d'occhio, non una lista.
   *
   * Non bastava abbassare il minimo della griglia: con auto-fill due colonne
   * ci stanno solo se due minimi piu' il vuoto in mezzo entrano nella pagina,
   * e su un telefono da 390 pixel, tolti i margini, non entravano mai. Qui le
   * colonne si dichiarano: due, e larghe uguali. Tre tasti su mezza colonna si
   * dividono la riga. */
  @media (max-width:560px){
    #${BLOCCO_ID} .dm-stanze-plancia-griglia{grid-template-columns:repeat(2,minmax(0,1fr))}
    .dm-stanza-plancia-comandi{gap:5px}
    .dm-stanza-plancia-tasto{padding:0 4px}
  }
  @media(prefers-reduced-motion:reduce){
    .dm-stanza-plancia,.dm-stanza-plancia-tasto{transition:none}
    .dm-stanza-plancia-si::after,.dm-stanza-plancia-rimetti::after{animation:none}
  }
  `,
  );
}

export function installStanzeInPlancia() {
  if (!doc || state.installed) return false;
  state.installed = true;
  stile();
  doc.addEventListener("click", onClick);
  doc.addEventListener("keydown", onKey);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, schedule);
  schedule();
  return true;
}
