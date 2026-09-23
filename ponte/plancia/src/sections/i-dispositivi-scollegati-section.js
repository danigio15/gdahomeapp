/* La scheda «Scollegati» della configurazione.
 *
 * La tessera «Dispositivi non connessi» compare in Home quando qualcosa smette
 * di rispondere (#33), e finché resta muta va benissimo così. Il guaio è
 * quando dice il vero su una cosa che non interessa — «fra i non connessi
 * finiscono dispositivi che funzionano» — perché allora l'avviso si impara a
 * ignorare, e un avviso che si ignora è peggio di nessun avviso.
 *
 * Questa scheda è l'elenco di quella tessera, con un cestino accanto a ogni
 * riga. È l'elenco STESSO: la regola sta in `core/i-dispositivi-scollegati.js`
 * e la legge anche la tessera, perché due elenchi sarebbero due verità e il
 * giorno che si scostano non si saprebbe quale guardare.
 *
 * ── Cosa si può fare qui, e cosa no ─────────────────────────────────────
 *
 * Solo togliere. Non c'è un tasto per aggiungere e non ce ne sarà uno: le
 * righe le mette la plancia, quando un dispositivo smette di rispondere, e una
 * riga scritta a mano sarebbe un avviso che uno si dà da solo.
 *
 * Il cestino non toglie una riga di oggi: toglie quel dispositivo da questa
 * tessera per sempre. Lo si chiede prima di farlo, perché non si torna
 * indietro, e le righe tolte restano scritte in fondo alla scheda — senza
 * cestino, che non c'è più niente da togliere. Una scelta che non si può
 * nemmeno rileggere è una scelta che uno non sa più di avere preso.
 *
 * ── Quando è vuota ──────────────────────────────────────────────────────
 *
 * Quasi sempre, ed è la notizia buona. Ma una scheda vuota si legge come una
 * scheda rotta, quindi lo dice a parole: non c'è niente scollegato, e questo
 * elenco si riempie da solo.
 */
import {
  iDispositiviScollegati,
  mettiDaParte,
  rimettiInElenco,
  TESSERA_SCOLLEGATI,
} from "../core/i-dispositivi-scollegati.js";
import { iDispositiviRicordati } from "../core/i-dispositivi-di-home-assistant.js";
import { entitaConfigurate } from "../core/entita-configurate.js";
import { CONFIG_KEYS } from "./config-persistence-section.js";
import {
  WIDGETS_CONFIG_KEY,
  renderHomeWidgets,
  widgetPreferences,
} from "./home-widgets-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_SCOLLEGATI_EDITOR__";
const state = (root[KEY] ||= { installed: false });

export const SCOLLEGATI_TAB = "scollegati";

const BLOCCO = "dm-scollegati";

function activeTab() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

function nomeDi(states, entity) {
  return clean(states?.[entity]?.attributes?.friendly_name);
}

/** L'elenco, con la stessa regola che legge la tessera della Home. */
export function elenco() {
  const states = allStates() || {};
  let configurate = [];
  try {
    configurate = [...entitaConfigurate(root, CONFIG_KEYS)];
  } catch (_errore) {
    configurate = [];
  }
  /* Le due mappe dei registri: di chi e' un'entita', e come si chiama quel
   * qualcuno. Chi disegna i registri non li ha — li lascia qui chi ce li ha.
   * Senza, l'elenco torna riga per riga come prima. */
  const { di, nomi } = iDispositiviRicordati();
  return iDispositiviScollegati({
    configurate,
    states,
    escluse: widgetPreferences().excluded,
    nomeDi: (entity) => nomeDi(states, entity),
    di,
    nomi,
  });
}

/* Da quanto tace, in parole. Cinque minuti è un riavvio di Home Assistant e
 * passa da solo; due giorni è una presa da andare a premere — ed è la sola
 * cosa che distingue le due, quindi si dice. La tessera lo dice uguale. */
function daQuandoTace(quando) {
  if (!quando) return t("non risponde", "not answering");
  const minuti = Math.max(0, Math.round((Date.now() - quando) / 60000));
  if (minuti < 60) return t(`da ${minuti} min`, `for ${minuti} min`);
  const ore = Math.round(minuti / 60);
  if (ore < 48) return t(`da ${ore} h`, `for ${ore} h`);
  const giorni = Math.round(ore / 24);
  return t(`da ${giorni} giorni`, `for ${giorni} days`);
}

/* Cosa si legge sotto il nome.
 *
 * Di un dispositivo, quante delle sue entita' tacciono: il suo identificativo
 * e' una stringa di trentadue cifre esadecimali che non dice niente a nessuno,
 * mentre «4 entità» dice quanto e' grosso il silenzio. Di un'entita' sciolta —
 * una che un dispositivo non ce l'ha — resta il suo identificativo, che li'
 * e' l'unica cosa che la individua. */
function sottoLaRiga(una) {
  const quante = Array.isArray(una.entita) ? una.entita.length : 1;
  if (!una.dispositivo) return una.entity;
  return quante === 1 ? t("1 entità", "1 entity") : t(`${quante} entità`, `${quante} entities`);
}

function rigaViva(una) {
  /* Il cestino porta con se' tutte le entita' mute di quella riga: mettere da
   * parte un dispositivo e lasciarne fuori una vorrebbe dire ritrovarselo al
   * giro dopo, con dentro quella. */
  const quali = (Array.isArray(una.entita) ? una.entita : [una.entity]).join(" ");
  return `<div class="ed-row ${BLOCCO}-riga">
    <div class="${BLOCCO}-segno" aria-hidden="true">📡</div>
    <div class="ed-row-main ${BLOCCO}-testo">
      <div class="ed-row-new">${esc(una.nome)}</div>
      <div class="ed-row-old mono">${esc(sottoLaRiga(una))} · ${esc(daQuandoTace(una.da))}</div>
    </div>
    <button type="button" class="ed-del ${BLOCCO}-via" data-dm-scollegati-via="${esc(quali)}"
      aria-label="${esc(t("Non avvisarmi più per questo", "Stop warning me about this"))}">🗑️</button>
  </div>`;
}

function rigaMessaDaParte(una) {
  /* Un'entità che Home Assistant non ha più non è un dispositivo silenziato:
   * è configurazione rimasta indietro, e vale la pena dirlo — è il motivo per
   * cui quella riga era finita nell'elenco. */
  const nota = una.cE
    ? t("non avvisa più", "no longer warns")
    : t("non è più in questa casa", "no longer in this house");
  /* Il tasto riporta indietro tutte le entità di quella riga, come il cestino
   * le aveva portate via tutte insieme. */
  const quali = (Array.isArray(una.entita) ? una.entita : [una.entity]).join(" ");
  return `<div class="ed-row ${BLOCCO}-riga ${BLOCCO}-fuori">
    <div class="${BLOCCO}-segno" aria-hidden="true">🔕</div>
    <div class="ed-row-main ${BLOCCO}-testo">
      <div class="ed-row-new">${esc(una.nome)}</div>
      <div class="ed-row-old mono">${esc(sottoLaRiga(una))} · ${esc(nota)}</div>
    </div>
    <button type="button" class="ed-del ${BLOCCO}-torna" data-dm-scollegati-torna="${esc(quali)}"
      aria-label="${esc(t("Avvisami di nuovo per questo", "Warn me about this again"))}">🔔</button>
  </div>`;
}

function corpo({ adesso, messiDaParte }) {
  const intro = `<div class="ed-intro">${esc(
    t(
      "I dispositivi che Home Assistant ha in casa e non riesce a raggiungere: un apparecchio ci finisce quando tacciono tutte le sue entità. Aiutanti, automazioni e script non ci sono: non hanno un apparecchio dietro, e se tacciono è configurazione da correggere. Questo elenco lo riempie la plancia da sé: non c'è niente da aggiungere. Il cestino toglie un dispositivo dall'avviso, e il campanello lì sotto ce lo rimette.",
      "The devices Home Assistant has but cannot reach: a device lands here when every one of its entities goes silent. Helpers, automations and scripts are not here: they have no device behind them, and when they go quiet that is configuration to fix. The dashboard fills this list by itself: there is nothing to add. The bin removes a device from the warning, and the bell below puts it back.",
    ),
  )}</div>`;
  const vive = adesso.length
    ? `<div class="ed-list ${BLOCCO}-list">${adesso.map(rigaViva).join("")}</div>`
    : `<div class="${BLOCCO}-vuoto">${esc(
        t(
          "Adesso risponde tutto. Se qualcosa smette di farlo compare qui, e in Home compare la sua tessera.",
          "Everything is answering right now. If something stops, it shows up here, and its card shows up on Home.",
        ),
      )}</div>`;
  const fuori = messiDaParte.length
    ? `<div class="ed-sec-title ${BLOCCO}-titolo">${esc(
        t("Tolti dall'avviso", "Removed from the warning"),
      )}</div>
      <div class="ed-hint">${esc(
        t(
          "Restano scritti qui perché si sappia che ci sono. Col campanello tornano nell'avviso, se sono ancora muti.",
          "They stay written here so you know they exist. The bell puts them back in the warning, if they are still silent.",
        ),
      )}</div>
      <div class="ed-list ${BLOCCO}-list">${messiDaParte.map(rigaMessaDaParte).join("")}</div>`
    : "";
  return `${intro}${vive}${fuori}`;
}

/* La firma di quello che si vede: si ridisegna solo quando cambia davvero.
 * Gli stati arrivano a mazzetti più volte al secondo, e questa scheda è in una
 * finestra aperta — ridisegnarla a ogni mazzetto vorrebbe dire un cestino che
 * scappa da sotto il dito. */
function firmaDi({ adesso, messiDaParte }) {
  return [
    adesso.map((una) => `${una.entity}@${una.da || 0}`).join("~"),
    messiDaParte.map((una) => `${una.entity}:${una.cE ? 1 : 0}`).join("~"),
  ].join("|");
}

export function ensureScollegatiEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || activeTab() !== SCOLLEGATI_TAB) return false;
  const dati = elenco();
  const firma = firmaDi(dati);
  if (body.dataset.dmScollegati === firma && body.querySelector(`.${BLOCCO}-list, .${BLOCCO}-vuoto`))
    return true;
  body.dataset.dmScollegati = firma;
  body.innerHTML = corpo(dati);
  body.dataset.renderer = "scollegati";
  return true;
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmScollegati;
  ensureScollegatiEditor();
}

function salvaLeEscluse(elenco) {
  const stored = readJson(WIDGETS_CONFIG_KEY, {});
  const base = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  writeJsonIfChanged(WIDGETS_CONFIG_KEY, { ...base, excluded: [...new Set(elenco)].sort() });
  try {
    renderHomeWidgets();
  } catch (_errore) {}
}

function onClick(event) {
  const tasto = event.target?.closest?.("[data-dm-scollegati-via]");
  if (!tasto || activeTab() !== SCOLLEGATI_TAB) return;
  event.preventDefault();
  const entita = clean(tasto.dataset.dmScollegatiVia).split(/\s+/).filter(Boolean);
  if (!entita.length) return;
  const nome = clean(tasto.closest(`.${BLOCCO}-riga`)?.querySelector(".ed-row-new")?.textContent);
  /* Si chiede lo stesso, ma la domanda dice il vero: prima prometteva «non si
   * torna indietro», e adesso indietro si torna — col campanello qui sotto. Il
   * senso resta quello, e non è «tolgo la riga»: è «non te lo dico più». */
  const quale = nome || entita[0];
  const domanda = t(
    `Tolgo «${quale}» dall'avviso dei dispositivi non connessi? Resta qui sotto, e da lì si rimette.`,
    `Remove “${quale}” from the disconnected devices warning? It stays below, and can be put back from there.`,
  );
  if (root.confirm && !root.confirm(domanda)) return;
  salvaLeEscluse(mettiDaParte(widgetPreferences().excluded, entita));
  ridisegna();
  root.edToast?.(t("🔕 Non avviso più per questo", "🔕 No longer warning about this"));
}

/* E il campanello: rimette nell'avviso quello che il cestino ne aveva tolto.
 *
 * Senza domanda, al contrario del cestino: questo gesto non toglie niente a
 * nessuno, e se è stato premuto per sbaglio basta il cestino per disfarlo. Una
 * conferma davanti a una cosa che si disfa da sé è una conferma che si impara
 * a premere senza leggerla. */
function onTorna(event) {
  const tasto = event.target?.closest?.("[data-dm-scollegati-torna]");
  if (!tasto || activeTab() !== SCOLLEGATI_TAB) return;
  event.preventDefault();
  const entita = clean(tasto.dataset.dmScollegatiTorna).split(/\s+/).filter(Boolean);
  if (!entita.length) return;
  salvaLeEscluse(rimettiInElenco(widgetPreferences().excluded, entita));
  ridisegna();
  root.edToast?.(t("🔔 Torna nell'avviso", "🔔 Back in the warning"));
}

/* La voce nella barra della configurazione.
 *
 * Le voci sono scritte nel documento vendorizzato e questa non c'è: si
 * aggiunge accanto alle altre, con lo stesso gestore, così si comporta come
 * loro senza che nessuno debba sapere che è arrivata dopo. */
export function ensureScollegatiTab() {
  const linguette = doc?.querySelector(".ed-tab")?.parentElement;
  if (!linguette || linguette.querySelector(`.ed-tab[data-tab="${SCOLLEGATI_TAB}"]`)) return false;
  const linguetta = doc.createElement("button");
  linguetta.className = "ed-tab";
  linguetta.dataset.tab = SCOLLEGATI_TAB;
  linguetta.textContent = `📡 ${t("Dispositivi non connessi", "Disconnected devices")}`;
  linguetta.addEventListener("click", () => root.editorSwitch?.(SCOLLEGATI_TAB));
  const prima = linguette.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(linguetta);
  else linguette.append(linguetta);
  return true;
}

function installStyles() {
  installStyle(
    `${BLOCCO}-style`,
    `
      #ed-body .${BLOCCO}-list{display:grid;gap:8px;margin-bottom:10px}
      #ed-body .${BLOCCO}-riga{display:flex;align-items:center;gap:10px}
      #ed-body .${BLOCCO}-segno{flex:0 0 auto;font-size:17px;line-height:1}
      #ed-body .${BLOCCO}-testo{min-width:0}
      /* L'identificativo va a capo invece di finire in «…»: e' quello che
         serve per riconoscere una presa fra dieci che si chiamano uguale, e
         troncato non serve a niente. */
      #ed-body .${BLOCCO}-testo .ed-row-old{overflow-wrap:anywhere;white-space:normal;text-overflow:clip;overflow:visible}
      #ed-body .${BLOCCO}-via{flex:0 0 auto}
      /* Le righe tolte si vedono che sono spente: sono un promemoria, non
         una cosa su cui si agisce. */
      #ed-body .${BLOCCO}-fuori{opacity:.6}
      #ed-body .${BLOCCO}-titolo{margin-top:14px}
      #ed-body .${BLOCCO}-vuoto{padding:14px;border-radius:14px;border:1px dashed var(--divider-color,#dbe4ee);font-size:12.5px;line-height:1.5;font-weight:600;color:var(--text-dim,#64748b)}
    `,
  );
}

export function installScollegatiSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyles();
  ensureScollegatiTab();
  doc.addEventListener("click", onClick);
  doc.addEventListener("click", onTorna);
  onEditorRedraw("__dmScollegati", () => {
    root.queueMicrotask?.(() => {
      ensureScollegatiTab();
      ensureScollegatiEditor();
    });
  });
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:editor-rendered",
    /* Gli stati sono la fonte di questa scheda: se non si sta dietro a loro,
     * un dispositivo che torna in linea resta scritto finché non si esce e si
     * rientra dalla linguetta. */
    "dashboardmodern:states-ready",
  ])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => {
        ensureScollegatiTab();
        ensureScollegatiEditor();
      });
    });
  ensureScollegatiEditor();
}

export { TESSERA_SCOLLEGATI };
