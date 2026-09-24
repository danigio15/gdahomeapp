/* «Manca il toggle per aggiungere la sezione nei widget» (#114).
 *
 * Non mancava: sta in Configurazione → Widget, nell'elenco delle tessere, con
 * le frecce per l'ordine e l'interruttore per accenderla. Mancava il cartello.
 * Chi è dentro la scheda di una sezione e pensa «voglio vederla in Home» non
 * ha nessun segno che l'interruttore stia in un'altra linguetta, e chi ha
 * scritto la segnalazione è chi ha scritto la plancia: se non l'ha trovato
 * lui, non lo trova nessuno.
 *
 * ── Una porta in più, non una seconda verità ────────────────────────────
 *
 * L'interruttore è LO STESSO: si scrive nella stessa chiave (`cd_widgets`,
 * campo `hidden`) che legge l'elenco del Widget, e la Home si ridisegna
 * uguale. Non c'è nessuno stato nuovo da tenere allineato — due interruttori
 * che scrivono due cose sarebbero il modo di avere una tessera accesa da una
 * parte e spenta dall'altra.
 *
 * ── Perché solo il MiniPC, per adesso ───────────────────────────────────
 *
 * Perché per mettere questa riga in ogni scheda bisogna sapere quale tessera
 * appartiene a quale scheda, e quel legame oggi non è scritto da nessuna
 * parte: la scheda si chiama `sez6`, la sezione si chiama `server` e la
 * tessera si chiama `minipc`. Inventare qui una tabella di venti coppie
 * vorrebbe dire un secondo posto che dice a cosa appartiene una tessera, e
 * quel posto si scosta dal primo il giorno che qualcuno ne aggiunge una senza
 * saperlo. Il legame va dichiarato dove le sezioni si dichiarano, ed è un
 * lavoro suo: qui c'è la riga, nella scheda da cui la segnalazione è partita.
 */
import {
  WIDGETS_CONFIG_KEY,
  renderHomeWidgets,
  widgetPreferences,
} from "./home-widgets-section.js";
import { oggettoWidget } from "../core/oggetti-widget.js";
import {
  clean,
  doc,
  esc,
  installStyle,
  readJson,
  root,
  t,
  tieniIlBloccoNellaScheda,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_TESSERA_DALLA_SCHEDA__";
const STYLE_ID = "dm-tessera-scheda-style";
const BLOCK_ID = "dm-tessera-scheda";
const state = (root[KEY] ||= { installed: false });

/* La scheda da cui è partita la segnalazione, e la tessera che le corrisponde.
 * Una coppia sola: il perché sta in cima. */
const SCHEDA = "sez6";
const TESSERA = "minipc";

function schedaAperta() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab) === SCHEDA;
}

function siVede() {
  return !new Set(widgetPreferences().hidden).has(TESSERA);
}

/* Si riscrive SOLO `hidden`, e quello che c'era resta: `cd_widgets` porta
 * anche l'ordine, le esclusioni per entità e la modalità compatta, e un
 * interruttore non deve azzerarle. È la stessa scrittura parziale che fa
 * l'elenco del Widget. */
function salva(mostra) {
  const nascoste = new Set(widgetPreferences().hidden);
  if (mostra) nascoste.delete(TESSERA);
  else nascoste.add(TESSERA);
  const stored = readJson(WIDGETS_CONFIG_KEY, {});
  const base = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  writeJsonIfChanged(WIDGETS_CONFIG_KEY, { ...base, hidden: [...nascoste] });
  try {
    renderHomeWidgets();
  } catch (_errore) {
    /* La Home si rifarà al giro dopo: qui si è salvato, ed è la cosa che non
     * si può perdere. */
  }
}

function markup(acceso) {
  return `<label class="dm-tessc-riga">
    <span class="dm-tessc-ic" aria-hidden="true">${oggettoWidget(TESSERA, "🖥️", "tessc-minipc")}</span>
    <span class="dm-tessc-testo">
      <b>${esc(t("Si vede in Home", "Shown on Home"))}</b>
      <small>${esc(
        t(
          "È lo stesso interruttore dell'elenco in Configurazione → Widget, dove si sceglie anche in che ordine stanno le tessere.",
          "It is the same switch as the list under Settings → Widgets, where you also choose the order of the tiles.",
        ),
      )}</small>
    </span>
    <input type="checkbox" data-dm-tessc${acceso ? " checked" : ""}>
  </label>`;
}

export function ensureTesseraDallaScheda() {
  const corpo = doc?.getElementById?.("ed-body");
  let blocco = doc?.getElementById?.(BLOCK_ID);
  if (!corpo || !schedaAperta()) {
    blocco?.remove();
    return false;
  }
  if (!blocco) {
    blocco = doc.createElement("section");
    blocco.id = BLOCK_ID;
    blocco.className = "dm-tessc";
    corpo.append(blocco);
  } else if (blocco.parentElement !== corpo || blocco.nextElementSibling) {
    corpo.append(blocco);
  }
  const acceso = siVede();
  const firma = acceso ? "1" : "0";
  if (blocco.dataset.firma === firma) return false;
  blocco.dataset.firma = firma;
  blocco.innerHTML = markup(acceso);
  return true;
}

function onCambio(evento) {
  const casella = evento?.target?.closest?.("[data-dm-tessc]");
  if (!casella || !doc?.getElementById?.(BLOCK_ID)?.contains(casella)) return;
  salva(casella.checked);
  ensureTesseraDallaScheda();
}

function css() {
  return `.dm-tessc{display:grid;gap:8px;margin:16px 0 4px}
  .dm-tessc-riga{display:flex;align-items:center;gap:11px;padding:11px 12px;min-width:0;
    border:1px solid var(--divider-color,#dbe4ee);border-radius:14px;
    background:var(--card-background-color,#fff);cursor:pointer}
  .dm-tessc-ic{flex:0 0 auto;display:inline-grid;place-items:center;width:26px;height:26px}
  .dm-tessc-ic svg{width:26px;height:26px}
  .dm-tessc-testo{display:grid;gap:3px;min-width:0;flex:1 1 auto}
  .dm-tessc-testo b{font-size:13.5px;font-weight:750}
  .dm-tessc-testo small{font-size:11.5px;line-height:1.5;color:var(--secondary-text-color,#64748b)}
  .dm-tessc-riga input{flex:0 0 auto;width:19px;height:19px;accent-color:var(--primary-color,#0ea5e9)}`;
}

export function installTesseraDallaSchedaSection() {
  if (!doc || state.installed) return false;
  installStyle(STYLE_ID, css());
  doc.addEventListener("change", onCambio, true);
  tieniIlBloccoNellaScheda("dmTesseraDallaScheda", ensureTesseraDallaScheda);
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:persistence-restored"])
    root.addEventListener?.(evento, () => root.queueMicrotask?.(ensureTesseraDallaScheda));
  state.installed = true;
  return true;
}
