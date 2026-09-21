/* Un'azione rapida chiama il servizio che quell'entita' sa eseguire.
 *
 * «Ho l'entita' button.ingresso_apri_la_porta e l'ho messa in azioni con il
 * "toggle" nella speranza che in home quando lo premo mi apre il portone ma
 * non lo fa e non capisco se e' un problema di integrazione o sono nella
 * sezione errata.» La sezione era quella giusta: e' la plancia che chiedeva a
 * Home Assistant una cosa che non esiste.
 *
 * Il guscio sceglie il servizio da una riga sola: script e scene ricevono
 * `turn_on`, tutto il resto `toggle`, preso dal dominio dell'entita'. Per una
 * luce o una presa e' corretto, ma `toggle` non e' un servizio universale:
 *
 *   - un `button` ha soltanto `press` — e' un pulsante, non ha due stati da
 *     scambiare, ed e' esattamente il caso del portone;
 *   - un `input_button` lo stesso;
 *   - una `scene` non si scambia, si accende: `scene.turn_on`;
 *   - una `lock` ha `lock` e `unlock`, e quale delle due dipende da com'e'
 *     messa adesso.
 *
 * Chiamare `button.toggle` non da' errore a schermo: Home Assistant risponde
 * che quel servizio non c'e', il messaggio resta nella console e il portone
 * non si muove. Da fuori sembra un tasto rotto.
 *
 * Qui si corregge solo la scelta del servizio, e solo dove `toggle` e' la
 * risposta sbagliata. Tutto il resto — i gruppi di luci, le azioni
 * predefinite, la richiesta di conferma, la vibrazione — resta al guscio, che
 * lo fa gia' bene: questo modulo gli passa davanti soltanto per i domini che
 * conosce, e per tutti gli altri lo lascia lavorare.
 *
 * E un caso in piu', che non e' una parola ma una finestra: un menu a tendina
 * (`select`, `input_select`) non si accende e non si preme, ha delle voci.
 * «Nell'azione rapida scena, se si sceglie un'entita' select, mi devi aprire
 * un popup dove poter selezionare quelle presenti nell'entita'.» Il tasto le
 * mostra tutte e fa scegliere — o mette direttamente quella fissata
 * nell'editor, per chi vuole un tasto secco. Il popup sta qui sotto.
 *
 * Quella finestra non e' piu' solo delle azioni rapide. «Sviluppa la stessa
 * cosa ovunque»: un menu a tendina si sceglie dalla sua riga nella stanza,
 * dalla sua riga in una sezione propria e da quella fra le proprie entita', e
 * tutte e tre aprono questa. La porta si chiama `apriIlMenu`, e chi la apre
 * senza un'azione dietro — chi chiama con `azione` nullo — vuole dire «solo
 * l'elenco»: niente conferma da chiedere, niente icona da mettere in testa.
 *
 * Sta ancora qui, e non in un modulo suo, per una ragione che si vede dieci
 * righe piu' in basso: la finestra chiama il servizio per il filo del guscio —
 * il suo socket e il suo contatore dei messaggi — ed e' la stessa strada che
 * prende l'azione rapida. Separarle vorrebbe dire o portarsi dietro quella
 * strada in due posti, o farne prendere una seconda alla finestra.
 */
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  lexicalGlobal,
  root,
  t,
  writeIconGlyph,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_AZIONI_SERVIZIO__";
const state = (root[KEY] ||= { installed: false, listeners: false });

/* Cosa sa eseguire ogni dominio, quando l'utente chiede «premi questo».
 *
 * Solo i domini in cui `toggle` e' davvero sbagliato: dove il guscio ha
 * ragione non c'e' niente da correggere, e una tabella piu' lunga sarebbe
 * soltanto piu' roba che puo' invecchiare male. */
const SERVIZI = Object.freeze({
  button: () => "press",
  input_button: () => "press",
  scene: () => "turn_on",
  /* Un menu a tendina non si accende: ha delle voci, e il tasto ne mette una
   * — quella fissata nell'editor (`option`), o quella scelta dal popup. */
  select: () => "select_option",
  input_select: () => "select_option",
  /* La serratura non si scambia con un servizio solo: si chiude o si apre, e
   * quale dei due dipende da com'e' messa adesso. */
  lock: (stato) => (clean(stato).toLowerCase() === "locked" ? "unlock" : "lock"),
  /* Un lettore ce l'ha, `media_player.toggle`, e fa una cosa che nessuno
   * voleva: spegne la cassa. Da un tasto con sopra la copertina del disco che
   * sta girando (#269) ci si aspetta la pausa — e da un lettore spento, che si
   * accenda, perche' mettere in pausa una cassa spenta non da' errore e non fa
   * niente. */
  media_player: (stato) =>
    ["off", "standby", "unavailable", "unknown", ""].includes(clean(stato).toLowerCase())
      ? "turn_on"
      : "media_play_pause",
});

/** Il servizio giusto per questa entita', o "" se `toggle` va gia' bene. */
export function servizioPerEntita(entity, states = {}) {
  const id = clean(entity);
  const dominio = id.includes(".") ? id.split(".")[0].toLowerCase() : "";
  const scelta = SERVIZI[dominio];
  if (!scelta) return "";
  return scelta(states?.[id]?.state) || "";
}

const E_UN_MENU = /^(select|input_select)\./;

/** Quello che il servizio vuole oltre all'entita': la voce, per un menu. */
export function datiPerEntita(entity, azione = null) {
  const id = clean(entity);
  const dominio = id.includes(".") ? id.split(".")[0].toLowerCase() : "";
  const voce = clean(azione?.option);
  if (voce && (dominio === "select" || dominio === "input_select")) return { option: voce };
  return {};
}

/** Le voci di un menu a tendina, e quale c'e' adesso. Puro: si prova. */
export function vociDelMenu(entity, states = {}) {
  const id = clean(entity);
  const stato = states?.[id] || null;
  const voci = Array.isArray(stato?.attributes?.options)
    ? stato.attributes.options.map(clean).filter(Boolean)
    : [];
  return { nome: clean(stato?.attributes?.friendly_name) || id, attuale: clean(stato?.state), voci };
}

/* ── il popup delle voci ────────────────────────────────────────────────
 *
 * La finestra e' una sola e sempre la stessa, come quella della fascia sotto
 * il meteo: nasce al primo menu e da li' in poi si riempie e si mostra. La
 * veste — l'intestazione col disegno, il titolo, il tasto che chiude, il
 * corpo che scorre — e' quella delle altre finestre della plancia, dichiarata
 * nel foglio dei widget per tutte e tre; qui ci sono solo le righe delle
 * voci. Quella di adesso e' segnata: si vede quale c'e' senza toccare. */
const POPUP = "dm-qa-popup";
const STILE_DEL_POPUP = "dm-qa-popup-style";
let aperto = null;

function finestra() {
  let nodo = doc?.getElementById?.(POPUP);
  if (nodo) return nodo;
  if (!doc?.body) return null;
  nodo = doc.createElement("div");
  nodo.id = POPUP;
  nodo.hidden = true;
  nodo.innerHTML = `<article class="dm-widget-detail" data-dm-qa-scheda>
      <header class="dm-w-head">
        <button type="button" class="dm-w-close" data-dm-qa-chiudi aria-label="${esc(t("Chiudi", "Close"))}"><span aria-hidden="true">✕</span> ${esc(t("Chiudi", "Close"))}</button>
        <span class="dm-w-head-ic" aria-hidden="true" data-dm-qa-faccia></span>
        <strong data-dm-qa-titolo></strong>
        <small data-dm-qa-sotto></small>
      </header>
      <div class="dm-w-body dm-qa-voci" data-dm-qa-voci></div>
    </article>`;
  doc.body.append(nodo);
  installStyle(
    STILE_DEL_POPUP,
    `#${POPUP} .dm-qa-voci{display:grid;gap:8px}
    #${POPUP} .dm-qa-voce{display:flex;align-items:center;gap:10px;width:100%;padding:12px 14px;
      border-radius:14px;border:1px solid var(--card-border,#e8edf3);
      background:var(--bg-sculpted,#f8fafc);color:var(--text,#0f172a);
      font:inherit;font-weight:700;font-size:14px;text-align:start;cursor:pointer}
    #${POPUP} .dm-qa-voce:active{transform:scale(.98)}
    #${POPUP} .dm-qa-voce[data-attuale="true"]{border-color:var(--dm-widget-accent,#0ea5e9);
      background:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 12%,var(--card-bg,#fff))}
    #${POPUP} .dm-qa-voce .dm-qa-spunta{margin-inline-start:auto;font-size:13px;color:var(--dm-widget-accent,#0ea5e9)}
    #${POPUP} .dm-qa-vuoto{margin:0;font-size:12.5px;color:var(--text-dim,#64748b)}`,
  );
  doc.addEventListener("click", onClickPopup);
  return nodo;
}

/** Apre il popup con le voci di `entity`: torna `false` se non c'e' una pagina. */
export function apriIlMenu(entity, azione = null) {
  const nodo = finestra();
  if (!nodo) return false;
  const { nome, attuale, voci } = vociDelMenu(entity, allStates());
  aperto = { entity, azione };
  const titolo = nodo.querySelector("[data-dm-qa-titolo]");
  const sotto = nodo.querySelector("[data-dm-qa-sotto]");
  const faccia = nodo.querySelector("[data-dm-qa-faccia]");
  const corpo = nodo.querySelector("[data-dm-qa-voci]");
  if (titolo) titolo.textContent = clean(azione?.name) || nome;
  if (sotto)
    sotto.textContent = voci.length
      ? t("tocca la voce da mettere", "tap the option to set")
      : t("questo menu non dice le sue voci", "this menu does not list its options");
  /* Il disegno, non il suo nome: l'icona di un'azione puo' essere un
   * simbolo scelto a mano («⚡») o un token del catalogo («mdi:home»), e
   * scritto come testo quel token si legge tale e quale sopra il titolo.
   * `writeIconGlyph` sa la differenza, ed e' la stessa strada che prende
   * la fascia sotto il meteo per la faccia della sua finestra. */
  if (faccia) writeIconGlyph(faccia, azione?.icon, { size: 22, fallback: "🎚️" });
  if (corpo)
    corpo.innerHTML = voci.length
      ? voci
          .map(
            (voce) =>
              `<button type="button" class="dm-qa-voce" data-dm-qa-voce="${esc(voce)}" data-attuale="${voce === attuale}">${esc(voce)}${voce === attuale ? '<span class="dm-qa-spunta" aria-hidden="true">✓</span>' : ""}</button>`,
          )
          .join("")
      : `<p class="dm-qa-vuoto">${esc(nome)}</p>`;
  nodo.querySelector("[data-dm-qa-scheda]")?.style?.setProperty(
    "--dm-widget-accent",
    clean(azione?.color) || "#0ea5e9",
  );
  nodo.hidden = false;
  doc.documentElement?.classList?.add("dm-widget-popup-open");
  try {
    root.navigator?.vibrate?.(10);
  } catch (_errore) {}
  return true;
}

export function chiudiIlMenu() {
  aperto = null;
  const nodo = doc?.getElementById?.(POPUP);
  if (nodo) nodo.hidden = true;
  doc?.documentElement?.classList?.remove("dm-widget-popup-open");
}

function onClickPopup(event) {
  const nodo = doc?.getElementById?.(POPUP);
  if (!nodo || nodo.hidden) return;
  if (!event.target?.closest?.(`#${POPUP}`)) return;
  if (event.target.closest("[data-dm-qa-chiudi]") || event.target === nodo) {
    event.preventDefault();
    chiudiIlMenu();
    return;
  }
  const tasto = event.target.closest("[data-dm-qa-voce]");
  if (!tasto || !aperto) return;
  event.preventDefault();
  const { entity, azione } = aperto;
  const voce = clean(tasto.dataset.dmQaVoce);
  chiudiIlMenu();
  if (!voce) return;
  conConferma(azione, () => chiama(entity.split(".")[0], "select_option", entity, { option: voce }));
}

/* La conferma, se l'azione la chiede, e la vibrazione: le stesse del guscio. */
function conConferma(azione, fai) {
  const esegui = () => {
    try {
      root.navigator?.vibrate?.(10);
    } catch (_errore) {}
    fai();
  };
  if (azione?.confirm && typeof root.confermaAzione === "function") {
    root.confermaAzione({
      icon: azione.icon || "⚡",
      title: azione.name,
      message: azione.confirm,
      onConfirm: esegui,
    });
    return;
  }
  esegui();
}

/* La chiamata, per la stessa strada che usa il guscio: il suo socket e il suo
 * contatore dei messaggi. Non si apre un secondo canale per una cosa che ne
 * ha gia' uno. */
function chiama(dominio, servizio, entity, dati = {}) {
  /* La stessa condizione del guscio — «se il socket c'e', manda» — e non una
   * piu' severa: qui si corregge una parola, non si cambia quando la plancia
   * decide di parlare. Un socket chiuso fa fallire l'invio, e il fallimento
   * e' gia' raccolto qui sotto. */
  const socket = lexicalGlobal("ws");
  if (!socket) return false;
  let id = 0;
  try {
    id = root.eval("msgId++");
  } catch (_error) {
    return false;
  }
  try {
    socket.send(
      JSON.stringify({
        id,
        type: "call_service",
        domain: dominio,
        service: servizio,
        service_data: { entity_id: entity, ...dati },
      }),
    );
    return true;
  } catch (_error) {
    return false;
  }
}

/* Il guscio definisce `qaRun` quando gli pare: il suo script puo' arrivare
 * dopo i moduli, e al primo giro qui non c'e' ancora niente da avvolgere.
 * Percio' si riprova a ogni annuncio di avvio, e ci si ferma appena riesce. */
function avvolgi() {
  if (state.installed) return false;
  const originale = root.qaRun;
  if (typeof originale !== "function" || originale.__dmServizioGiusto) return false;

  const nostra = function qaRun(indice) {
    let azione = null;
    try {
      azione = root.getQuickActions?.()?.[indice] || null;
    } catch (_error) {
      azione = null;
    }
    /* Quello che il guscio sa gia' fare resta suo: i gruppi di luci e le
     * azioni predefinite. Gli script e le scene no, non piu' per tipo: sotto
     * «Scena» uno ci mette anche un menu a tendina, e il guscio gli
     * chiederebbe `scene.turn_on`. Si guarda il dominio dell'entita', e dove
     * il guscio ha ragione — uno script vero, una scena vera — gli si
     * ridanno. */
    if (!azione || ["luci_group", "builtin"].includes(azione.type))
      return originale.call(this, indice);

    let entity = clean(azione.entity);
    try {
      entity = clean(root.resolveEntity?.(entity) || entity);
    } catch (_error) {}
    if (!entity.includes(".")) return originale.call(this, indice);

    /* Gli stati si chiedono a chi sa dove stanno: il guscio li tiene in una
     * variabile sua, non su `window`, e cercarli li' voleva dire non trovarli
     * — e una serratura senza stato si sarebbe fatta chiudere invece che
     * aprire. */
    const servizio = servizioPerEntita(entity, allStates());
    // Dove `toggle` e' la risposta giusta non c'e' niente da correggere.
    if (!servizio) return originale.call(this, indice);

    const dati = datiPerEntita(entity, azione);
    /* Un menu a tendina senza una voce fissata: la si sceglie adesso, dal
     * popup, che poi chiama lui il servizio. */
    if (E_UN_MENU.test(entity) && !dati.option) {
      apriIlMenu(entity, azione);
      return undefined;
    }
    conConferma(azione, () => chiama(entity.split(".")[0], servizio, entity, dati));
    return undefined;
  };

  nostra.__dmServizioGiusto = true;
  nostra.__dmPrevious = originale;
  root.qaRun = nostra;
  state.installed = true;
  return true;
}

export function installAzioniServizioGiusto() {
  if (avvolgi()) return true;
  if (state.listeners) return false;
  state.listeners = true;
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
  ])
    root.addEventListener?.(evento, avvolgi);
  root.document?.addEventListener?.("DOMContentLoaded", avvolgi, { once: true });
  return false;
}
