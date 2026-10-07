/* La spunta «si vede solo se a casa non c'e' nessuno», telecamera per telecamera (#81).
 *
 * «Pensavo a una possibilita' di mettere un'impostazione aggiuntiva sulle
 *  telecamere. Tipo io ne ho una interna ma vorrei si potesse vedere solo se a
 *  casa non c'e' nessuno per una questione di privacy.»
 *
 * Il blocco sta nella scheda Sicurezza, sotto le telecamere, come quello dei
 * rilevamenti: parla di quelle telecamere, e sta dove sono loro.
 *
 * ── Perche' si spegne quando non c'e' nessuna persona ─────────────────────
 *
 * La regola ha bisogno di sapere chi c'e' in casa, e questo lo sanno le
 * persone della sezione Persone. Senza nemmeno una, la risposta a «c'e'
 * qualcuno?» e' «non lo so» — e davanti a un «non lo so» la telecamera resta
 * nascosta (la ragione sta in `core/telecamere-riservate.js`). Offrire una
 * spunta che, accesa, nasconde la telecamera per sempre sarebbe offrire un
 * guasto: quindi qui non si offre, e si dice perche'.
 *
 * Quello che gia' c'e' scritto non si tocca: chi aveva le persone e poi le
 * toglie non si vede sparire la sua scelta, si vede spiegare cosa manca.
 */
import {
  CHIAVE_RISERVATE,
  conLaRiservata,
  eRiservata,
  normalizzaRiservate,
} from "../core/telecamere-riservate.js";
import { normalizePeople } from "../core/person-model.js";
import { securityCameras } from "./security-showcase-section.js";
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

const KEY = "__DASHBOARDMODERN_TELECAMERE_RISERVATE_EDITOR__";
const STYLE_ID = "dm-cam-privata-style";
const BLOCK_ID = "dm-cam-privata";
const state = (root[KEY] ||= { installed: false });

function scelte() {
  return normalizzaRiservate(readJson(CHIAVE_RISERVATE, {}));
}

function persone() {
  return normalizePeople(readJson("cd_people", []));
}

function salva(prossime) {
  writeJsonIfChanged(CHIAVE_RISERVATE, prossime);
  try {
    root.render?.();
  } catch (_errore) {
    /* Il disegno lo rifara' il giro dopo: qui si e' salvato, ed e' la cosa
     * che non si puo' perdere. */
  }
}

/* Le telecamere di questa casa, con l'entita' pulita: e' quella la chiave con
 * cui la spunta si scrive, perche' e' l'unica cosa che una telecamera ha e non
 * cambia quando le si cambia il nome. */
function telecamere() {
  return securityCameras()
    .map((camera, indice) => ({
      entity: clean(camera?.entity || camera?.camera_entity || camera?.cam),
      name: clean(camera?.name) || `CAM ${indice + 1}`,
    }))
    .filter((camera) => camera.entity);
}

/* ── il disegno ───────────────────────────────────────────────────────── */

const TITOLO = () => t("Telecamere riservate", "Private cameras");

function rigaMarkup(camera, acceso) {
  return `<label class="dm-camp-riga">
    <input type="checkbox" data-dm-camp="${esc(camera.entity)}"${acceso ? " checked" : ""}>
    <span class="dm-camp-testo">
      <b>${esc(camera.name)}</b>
      <small class="mono">${esc(camera.entity)}</small>
    </span>
    <span class="dm-camp-segno" aria-hidden="true">${acceso ? "🔒" : ""}</span>
  </label>`;
}

function markup(camere, cEQualcuno) {
  const acceso = scelte();
  if (!camere.length)
    return `<div class="ed-slot-lbl dm-camp-titolo">${esc(TITOLO())}</div>
    <div class="ed-intro">${esc(
      t(
        "Configura prima una telecamera qui sopra: la riservatezza è sua.",
        "Configure a camera above first: the privacy is its own.",
      ),
    )}</div>`;
  return `<div class="ed-slot-lbl dm-camp-titolo">${esc(TITOLO())}</div>
    <div class="ed-intro">${esc(
      t(
        "Una telecamera dentro casa serve a guardare la casa quando non ci sei. Spunta quelle che vuoi vedere solo a casa vuota: mentre qualcuno è in casa spariscono da tutte le pagine, e il fotogramma non viene nemmeno scaricato. Chi rientra le fa sparire subito, non al prossimo cambio pagina.",
        "A camera inside the house is there to watch the house while you are out. Tick the ones you only want to see when nobody is home: while someone is in, they disappear from every page, and the frame is not even fetched. Whoever comes back makes them vanish at once, not at the next page change.",
      ),
    )}</div>
    ${
      cEQualcuno
        ? ""
        : `<p class="dm-camp-avviso">${esc(
            t(
              "Serve almeno una persona nella sezione Persone: è da lì che si sa se in casa c'è qualcuno. Finché non ce n'è nessuna, una telecamera spuntata resterebbe nascosta sempre — e per questo la spunta è spenta.",
              "At least one person is needed in the People section: that is where “is anybody home” is answered. While there is none, a ticked camera would stay hidden forever — which is why the tick is off.",
            ),
          )}</p>`
    }
    <div class="dm-camp-elenco"${cEQualcuno ? "" : " data-spenta"}>${camere
      .map((camera) => rigaMarkup(camera, eRiservata(camera.entity, acceso)))
      .join("")}</div>`;
}

function firmaDelle(camere, cEQualcuno) {
  const acceso = scelte();
  return `${cEQualcuno ? "1" : "0"}|${camere
    .map((camera) => `${camera.entity}:${camera.name}:${acceso[camera.entity] ? 1 : 0}`)
    .join("|")}`;
}

/* La casella delle telecamere: il blocco va sotto quella, perche' e' di quelle
 * telecamere che parla. Sotto il blocco dei rilevamenti, che sta gia' li'. */
function casellaDelleTelecamere() {
  const rilevamenti = doc?.getElementById?.("dm-rilevamenti");
  if (rilevamenti) return rilevamenti;
  const slot = doc?.querySelector?.('[data-ref="cd_cameras"], [data-editor="cameras"]');
  return slot?.closest?.(".ed-slot") || slot || null;
}

export function ensureTelecamereRiservateBlock() {
  const casella = casellaDelleTelecamere();
  let blocco = doc?.getElementById?.(BLOCK_ID);
  if (!casella) {
    blocco?.remove();
    return false;
  }
  const camere = telecamere();
  const cEQualcuno = persone().length > 0;
  if (!blocco) {
    blocco = doc.createElement("section");
    blocco.id = BLOCK_ID;
    blocco.className = "dm-camp";
    casella.after(blocco);
  } else if (blocco.previousElementSibling !== casella) {
    casella.after(blocco);
  }
  const firma = firmaDelle(camere, cEQualcuno);
  if (blocco.dataset.firma === firma) return false;
  blocco.dataset.firma = firma;
  blocco.innerHTML = markup(camere, cEQualcuno);
  return true;
}

/* ── i gesti ──────────────────────────────────────────────────────────── */

function onCambio(evento) {
  const casella = evento?.target?.closest?.("[data-dm-camp]");
  if (!casella || !doc?.getElementById?.(BLOCK_ID)?.contains(casella)) return;
  const entity = clean(casella.dataset.dmCamp);
  if (!entity) return;
  /* Senza persone la spunta non si puo' accendere: la si rimette com'era e si
   * lascia parlare l'avviso che sta li' sopra. */
  if (casella.checked && !persone().length) {
    casella.checked = false;
    return;
  }
  salva(conLaRiservata(scelte(), entity, casella.checked));
  ensureTelecamereRiservateBlock();
}

function css() {
  return `.dm-camp{display:grid;gap:8px;margin:14px 0 4px}
  .dm-camp-titolo{margin:0}
  .dm-camp-avviso{margin:0;padding:10px 12px;border-radius:12px;font-size:12px;line-height:1.5;
    border:1px solid var(--warning-color,#f59e0b);color:var(--text,#0f172a);
    background:color-mix(in srgb,var(--warning-color,#f59e0b) 10%,transparent)}
  .dm-camp-elenco{display:grid;gap:8px}
  .dm-camp-elenco[data-spenta]{opacity:.55;pointer-events:none}
  .dm-camp-riga{display:flex;align-items:center;gap:11px;padding:10px 12px;min-width:0;
    border:1px solid var(--divider-color,#dbe4ee);border-radius:14px;
    background:var(--card-background-color,#fff);cursor:pointer}
  .dm-camp-riga input{flex:0 0 auto;width:19px;height:19px;accent-color:var(--primary-color,#0ea5e9)}
  .dm-camp-testo{display:grid;gap:2px;min-width:0;flex:1 1 auto}
  .dm-camp-testo b{font-size:13.5px;font-weight:750;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .dm-camp-testo small{font-size:10.5px;font-family:ui-monospace,Menlo,monospace;
    color:var(--secondary-text-color,#64748b);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .dm-camp-segno{flex:0 0 auto;font-size:14px}`;
}

export function installTelecamereRiservateEditorSection() {
  if (!doc || state.installed) return false;
  installStyle(STYLE_ID, css());
  doc.addEventListener("change", onCambio, true);
  tieniIlBloccoNellaScheda("dmTelecamereRiservate", ensureTelecamereRiservateBlock);
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:persistence-restored"])
    root.addEventListener?.(evento, () =>
      root.queueMicrotask?.(ensureTelecamereRiservateBlock),
    );
  state.installed = true;
  return true;
}
