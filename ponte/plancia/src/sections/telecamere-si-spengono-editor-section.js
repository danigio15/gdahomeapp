/* L'interruttore che toglie il riquadro delle telecamere da Sicurezza (#113).
 *
 * «Possibilità di togliere la sezione se uno non dispone di telecamere.»
 *
 * Le telecamere non sono una sezione della plancia: stanno dentro Sicurezza,
 * insieme all'allarme e ai varchi. Chi non ne ha una poteva solo spegnere
 * Sicurezza intera — e perdere anche l'allarme e le porte, che con le
 * telecamere non c'entrano niente. Quello che restava era un riquadro CCTV
 * sempre vuoto in cima alla pagina, con dentro l'invito a configurarne una.
 *
 * L'interruttore sta qui, sotto la casella delle telecamere, perché è di
 * quelle che parla: è lo stesso posto dove stanno i rilevamenti e le
 * riservate, e chi cerca qualcosa sulle telecamere guarda lì. La regola di
 * cosa valga «non l'ho mai toccato» sta nel nucleo
 * (`core/le-telecamere-si-vedono.js`), perché a leggerla sono in due — questa
 * scheda e la pagina — e due copie prima o poi dicono due cose.
 *
 * Non spegne le telecamere: spegne il riquadro. Restano configurate, restano
 * nelle stanze dove qualcuno le ha messe, e riaccendendo l'interruttore
 * tornano dov'erano. Un interruttore che cancellasse la configurazione
 * sarebbe una cosa che non si può disfare, e qui non ce n'è nessuna.
 */
import {
  CHIAVE_TELECAMERE_IN_SICUREZZA,
  laSceltaDelleTelecamere,
  leTelecamereSiVedono,
} from "../core/le-telecamere-si-vedono.js";
import { securityCameras } from "./security-showcase-section.js";
import {
  doc,
  esc,
  installStyle,
  readJson,
  root,
  t,
  tieniIlBloccoNellaScheda,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_TELECAMERE_SPENTE_EDITOR__";
const STYLE_ID = "dm-cam-spenta-style";
const BLOCK_ID = "dm-cam-spenta";
const state = (root[KEY] ||= { installed: false });

function siVedono() {
  return leTelecamereSiVedono(readJson(CHIAVE_TELECAMERE_IN_SICUREZZA, null));
}

function salva(mostra) {
  writeJsonIfChanged(CHIAVE_TELECAMERE_IN_SICUREZZA, laSceltaDelleTelecamere(mostra));
  try {
    root.render?.();
  } catch (_errore) {
    /* Il disegno lo rifarà il giro dopo: qui si è salvato, ed è la cosa che
     * non si può perdere. */
  }
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function markup(acceso, quante) {
  return `<label class="dm-cams-riga">
    <input type="checkbox" data-dm-cams${acceso ? " checked" : ""}>
    <span class="dm-cams-testo">
      <b>${esc(t("Mostra le telecamere in Sicurezza", "Show the cameras under Security"))}</b>
      <small>${esc(
        acceso
          ? t(
              "Spegnilo e il riquadro delle telecamere sparisce dalla pagina Sicurezza, senza toccare l'allarme e i varchi. Le telecamere restano configurate: si rivedono riaccendendo qui.",
              "Turn it off and the camera panel disappears from the Security page, leaving the alarm and the openings alone. The cameras stay configured: they come back by turning this on again.",
            )
          : t(
              "Il riquadro delle telecamere adesso non c'è. L'allarme e i varchi restano dove sono, e le telecamere configurate non sono state toccate.",
              "The camera panel is not there now. The alarm and the openings stay where they are, and the configured cameras have not been touched.",
            ),
      )}</small>
    </span>
  </label>
  ${
    !acceso && quante
      ? `<p class="dm-cams-nota">${esc(
          quante === 1
            ? t(
                "C'è 1 telecamera configurata che adesso non si vede qui.",
                "There is 1 configured camera that is not shown here now.",
              )
            : t(
                `Ci sono ${quante} telecamere configurate che adesso non si vedono qui.`,
                `There are ${quante} configured cameras that are not shown here now.`,
              ),
        )}</p>`
      : ""
  }`;
}

function quanteCeNeSono() {
  try {
    return securityCameras().length;
  } catch (_errore) {
    return 0;
  }
}

/* Il blocco va in fondo a quelli delle telecamere: parla del riquadro intero,
 * e un interruttore che spegne tutto quello che gli sta sopra si legge dopo
 * averlo visto. Se i suoi fratelli non ci sono, si attacca alla casella. */
function doveVa() {
  const riservate = doc?.getElementById?.("dm-cam-privata");
  if (riservate) return riservate;
  const rilevamenti = doc?.getElementById?.("dm-rilevamenti");
  if (rilevamenti) return rilevamenti;
  const slot = doc?.querySelector?.('[data-ref="cd_cameras"], [data-editor="cameras"]');
  return slot?.closest?.(".ed-slot") || slot || null;
}

export function ensureTelecamereSpenteBlock() {
  const casella = doveVa();
  let blocco = doc?.getElementById?.(BLOCK_ID);
  if (!casella) {
    blocco?.remove();
    return false;
  }
  if (!blocco) {
    blocco = doc.createElement("section");
    blocco.id = BLOCK_ID;
    blocco.className = "dm-cams";
    casella.after(blocco);
  } else if (blocco.previousElementSibling !== casella) {
    casella.after(blocco);
  }
  const acceso = siVedono();
  const quante = quanteCeNeSono();
  const firma = `${acceso ? "1" : "0"}|${quante}`;
  if (blocco.dataset.firma === firma) return false;
  blocco.dataset.firma = firma;
  blocco.innerHTML = markup(acceso, quante);
  return true;
}

/* ── i gesti ──────────────────────────────────────────────────────────── */

function onCambio(evento) {
  const casella = evento?.target?.closest?.("[data-dm-cams]");
  if (!casella || !doc?.getElementById?.(BLOCK_ID)?.contains(casella)) return;
  salva(casella.checked);
  ensureTelecamereSpenteBlock();
}

function css() {
  return `.dm-cams{display:grid;gap:8px;margin:14px 0 4px}
  .dm-cams-riga{display:flex;align-items:flex-start;gap:11px;padding:11px 12px;min-width:0;
    border:1px solid var(--divider-color,#dbe4ee);border-radius:14px;
    background:var(--card-background-color,#fff);cursor:pointer}
  .dm-cams-riga input{flex:0 0 auto;width:19px;height:19px;margin-top:1px;
    accent-color:var(--primary-color,#0ea5e9)}
  .dm-cams-testo{display:grid;gap:3px;min-width:0;flex:1 1 auto}
  .dm-cams-testo b{font-size:13.5px;font-weight:750}
  .dm-cams-testo small{font-size:11.5px;line-height:1.5;color:var(--secondary-text-color,#64748b)}
  .dm-cams-nota{margin:0;padding:9px 12px;border-radius:12px;font-size:11.5px;line-height:1.5;
    border:1px solid var(--warning-color,#f59e0b);color:var(--text,#0f172a);
    background:color-mix(in srgb,var(--warning-color,#f59e0b) 10%,transparent)}`;
}

export function installTelecamereSpenteEditorSection() {
  if (!doc || state.installed) return false;
  installStyle(STYLE_ID, css());
  doc.addEventListener("change", onCambio, true);
  tieniIlBloccoNellaScheda("dmTelecamereSpente", ensureTelecamereSpenteBlock);
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:persistence-restored"])
    root.addEventListener?.(evento, () => root.queueMicrotask?.(ensureTelecamereSpenteBlock));
  state.installed = true;
  return true;
}
