/* Ricordati di salvare: un'entita' inserita e non salvata non si perde in
 * silenzio.
 *
 * «Se ho inserito in una sezione una entita' da qualche parte e cambio
 * sezione, mi deve ricordare di salvare.» Nel Config ogni scheda ridisegna il
 * corpo da capo: cambiare linguetta, o chiudere la finestra, buttava via
 * quello che si era scritto senza dirlo a nessuno.
 *
 * Qui si tiene a mente una cosa sola — in quale scheda c'e' un'entita'
 * scritta e non ancora salvata — e la si chiede prima di uscirne, con tre
 * risposte: salvare e andare, andare senza salvare, restare.
 *
 * ── Perche' solo le entita' ───────────────────────────────────────────────
 *
 * Diverse schede scrivono da se' mentre si tocca (un interruttore, un colore,
 * un numero): chiedere di salvare anche li' vorrebbe dire un avviso a ogni
 * linguetta, e un avviso che suona sempre non lo legge piu' nessuno. Un'entita'
 * scritta in un campo, invece, resta nel campo finche' non si preme «Salva».
 *
 * ── Perche' in cattura ────────────────────────────────────────────────────
 *
 * Le linguette del guscio hanno l'`onclick` scritto nel bottone, e le insegne
 * delle famiglie hanno il loro ascoltatore: fermando il tocco sul documento,
 * in cattura, nessuno dei due parte finche' non si e' risposto. */
import { clean, doc, esc, installStyle, root, senzaCadere, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_RICORDATI_DI_SALVARE__";
const state = (root[KEY] ||= {
  installed: false,
  sporca: "",
  nome: "",
  lascia: false,
});

/* Le stesse schede che il piede del salvataggio lascia senza bottone: li'
 * non c'e' niente da salvare a mano. */
const SENZA_SALVA = new Set(["runtime", "visib", "export", "rileva", "backup", "scollegati"]);

/* Quello che porta fuori dalla scheda. */
const USCITE = [
  ".ed-tab",
  "[data-dm-famiglia]",
  "[data-dm-famiglia-tutte]",
  ".ed-head-close[onclick*='remove']",
].join(",");

/* Quello che salva: il piede comune e i salvataggi delle singole sezioni. */
const SALVATAGGI = [
  "[data-dm-save-all]",
  ".ed-save-btn",
  "[data-energy-save]",
  "[data-report-save]",
  "[data-dm-loads-save]",
  "[onclick*='edSaveSezione']",
  "[onclick*='edSecSave']",
].join(",");

const DIALOGO = "dm-ricordati-di-salvare";

/** Un valore che ha la forma di un'entita' di Home Assistant: `dominio.oggetto`. */
export function sembraUnEntita(valore) {
  return /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/i.test(clean(valore));
}

function corpo() {
  return doc?.getElementById?.("ed-body") || null;
}

function schedaAttiva() {
  return doc?.querySelector?.(".ed-tab.active") || null;
}

function nomeDellaScheda(bottone) {
  return clean(bottone?.textContent).replace(/^[^\p{L}\p{N}]+/u, "") || "";
}

/** C'e' un'entita' inserita e non salvata? Torna la scheda, o "". */
export function schedaDaSalvare() {
  return state.sporca;
}

export function dimenticaLeModifiche() {
  state.sporca = "";
  state.nome = "";
}

function campoDiRicerca(campo) {
  if (campo.type === "search") return true;
  const segni = `${campo.className || ""} ${campo.id || ""} ${campo.getAttribute?.("role") || ""}`;
  return /search|cerca|filtr|filter|combobox/i.test(segni);
}

function onModifica(evento) {
  const campo = evento.target;
  if (!campo?.matches?.("input,select,textarea")) return;
  const dentro = corpo();
  if (!dentro || !dentro.contains(campo)) return;
  if (campo.type === "hidden" || campoDiRicerca(campo)) return;
  if (!sembraUnEntita(campo.value)) return;
  const scheda = schedaAttiva();
  const chiave = clean(scheda?.dataset?.tab);
  if (!chiave || SENZA_SALVA.has(chiave)) return;
  state.sporca = chiave;
  state.nome = nomeDellaScheda(scheda);
}

function premiSalva() {
  const dentro = corpo();
  if (!dentro) return false;
  const piede = dentro.querySelector("[data-dm-save-all]");
  if (piede) {
    piede.click();
    return true;
  }
  const bottoni = [...dentro.querySelectorAll(SALVATAGGI)];
  for (const bottone of bottoni) {
    try {
      bottone.click();
    } catch (_error) {}
  }
  return bottoni.length > 0;
}

function chiudiIlDialogo() {
  doc?.getElementById?.(DIALOGO)?.remove();
}

/* Si rifa' il tocco che era stato fermato, lasciandolo passare. */
function prosegui(bersaglio) {
  dimenticaLeModifiche();
  chiudiIlDialogo();
  if (!bersaglio?.isConnected) return;
  state.lascia = true;
  try {
    bersaglio.click();
  } finally {
    state.lascia = false;
  }
}

function mostraIlDialogo(bersaglio) {
  chiudiIlDialogo();
  const nome = state.nome;
  const scatola = doc.createElement("div");
  scatola.id = DIALOGO;
  scatola.className = "dm-rds-velo";
  scatola.setAttribute("role", "alertdialog");
  scatola.setAttribute("aria-modal", "true");
  scatola.innerHTML = `<div class="dm-rds-card">
    <div class="dm-rds-titolo">💾 ${esc(t("Non hai salvato", "You haven't saved"))}</div>
    ${nome ? `<div class="dm-rds-scheda">${esc(nome)}</div>` : ""}
    <div class="dm-rds-testo">${esc(
      t(
        "Hai inserito delle entità in questa sezione senza salvarle. Se esci adesso, andranno perse.",
        "You entered entities in this section without saving them. If you leave now, they will be lost.",
      ),
    )}</div>
    <div class="dm-rds-bottoni">
      <button type="button" class="dm-rds-salva" data-dm-rds="salva">💾 ${esc(
        t("Salva e continua", "Save and continue"),
      )}</button>
      <button type="button" class="dm-rds-esci" data-dm-rds="esci">${esc(
        t("Esci senza salvare", "Leave without saving"),
      )}</button>
      <button type="button" class="dm-rds-resta" data-dm-rds="resta">${esc(
        t("Resta qui", "Stay here"),
      )}</button>
    </div>
  </div>`;
  scatola.addEventListener("click", (evento) => {
    evento.stopPropagation();
    const scelta = evento.target?.closest?.("[data-dm-rds]")?.dataset?.dmRds;
    if (!scelta && evento.target !== scatola) return;
    if (scelta === "salva") {
      try {
        premiSalva();
      } catch (_error) {}
      prosegui(bersaglio);
      return;
    }
    if (scelta === "esci") {
      prosegui(bersaglio);
      return;
    }
    chiudiIlDialogo();
  });
  (doc.getElementById("editor-modal") || doc.body).append(scatola);
  scatola.querySelector("[data-dm-rds='salva']")?.focus?.();
}

function onTocco(evento) {
  const bersaglio = evento.target;
  if (bersaglio?.closest?.(`#${DIALOGO}`)) return;
  if (bersaglio?.closest?.(SALVATAGGI)) {
    /* Il salvataggio parte dopo di noi: la scheda si considera salvata. */
    if (corpo()?.contains(bersaglio)) dimenticaLeModifiche();
    return;
  }
  if (state.lascia || !state.sporca) return;
  const uscita = bersaglio?.closest?.(USCITE);
  if (!uscita) return;
  /* Ritoccare la scheda dove si e' non porta da nessuna parte. */
  if (uscita.matches(".ed-tab") && clean(uscita.dataset.tab) === state.sporca) return;
  /* La finestra e' stata riaperta da capo: quello che c'era non c'e' piu'. */
  if (!corpo()) {
    dimenticaLeModifiche();
    return;
  }
  evento.preventDefault();
  evento.stopImmediatePropagation();
  mostraIlDialogo(uscita);
}

function installStili() {
  installStyle(
    "dm-ricordati-di-salvare-style",
    `
.dm-rds-velo{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.55)}
.dm-rds-card{width:min(420px,100%);background:var(--surface-2,#1c1f26);color:var(--text,#fff);border:1px solid var(--divider-color,rgba(255,255,255,.12));border-radius:18px;padding:18px;box-shadow:0 18px 48px rgba(0,0,0,.45)}
.dm-rds-titolo{font-weight:800;font-size:16px;margin-bottom:8px}
.dm-rds-scheda{font-weight:700;font-size:13px;opacity:.75;margin-bottom:6px}
.dm-rds-testo{font-size:14px;line-height:1.45;opacity:.9;margin-bottom:16px}
.dm-rds-bottoni{display:flex;flex-direction:column;gap:8px}
.dm-rds-bottoni button{width:100%;padding:12px 14px;border-radius:12px;border:none;font-weight:700;font-size:14px;cursor:pointer}
.dm-rds-salva{background:var(--accent,#3b82f6);color:#fff}
.dm-rds-esci{background:rgba(239,68,68,.16);color:#f87171}
.dm-rds-resta{background:var(--surface-3,rgba(255,255,255,.08));color:var(--text,#fff)}
`,
  );
}

export function installRicordatiDiSalvare() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStili();
  doc.addEventListener("input", onModifica, true);
  doc.addEventListener("change", onModifica, true);
  doc.addEventListener("click", onTocco, true);
  return true;
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installRicordatiDiSalvare, { once: true });
} else {
  senzaCadere(installRicordatiDiSalvare);
}
