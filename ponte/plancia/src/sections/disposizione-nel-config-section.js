/* La disposizione nel Config (#379).
 *
 * Le cose della disposizione che stanno nella scheda Impostazioni del Config
 * (le sezioni si spostano nell'anteprima della loro scheda, vedi
 * `anteprima-della-plancia-section.js`; sulla plancia non c'e' nessuna matita):
 *
 * - l'«Ordine navbar», che aveva solo le frecce ▲▼: adesso ogni riga ha la sua
 *   maniglia e si trascina, col dito, col mouse o dalle frecce della
 *   tastiera. L'ordine si scrive nella stessa casella delle frecce,
 *   `cd_navbar_order`, e Config resta l'ultima;
 * - le «Disposizioni salvate»: le pagine cambiate nell'anteprima, ognuna col suo
 *   «Ripristina», e uno per tutte. Senza, una pagina nascosta per sbaglio si
 *   poteva rimettere solo tornando su quella pagina — e un riquadro nascosto,
 *   da fuori della modifica, non si vede;
 * - i «Disegni salvati»: i disegni (il solare, il flusso dell'energia, le
 *   macchine, il prato) a cui nell'anteprima si sono spostati i pezzi, uno per ogni
 *   disegno e per ogni schermo — computer o telefono — col suo «Ripristina».
 */
import { CHIAVE_DISPOSIZIONE, pagineCambiate, senzaLaPagina } from "../core/disposizione.js";
import { CHIAVE_DISEGNI, disegniPuliti, senzaIlDisegno } from "../core/posizioni-nei-disegni.js";
import {
  etichettaDellaVariante,
  nomeDelDisegno,
  ridisegnaIDisegni,
} from "./disegni-che-si-spostano-section.js";
import { spostaNellaLista } from "./trascina-per-riordinare.js";
import { doc, esc, installStyle, onEditorRedraw, readJson, root, t, writeJsonIfChanged } from "./shared.js";

const state = { installed: false };

const CONFIG = "config";

/* ── l'ordine della barra ───────────────────────────────────────────────── */

function laChiaveDellaRiga(riga, chiavi) {
  const scritta = riga.getAttribute("data-section-key");
  if (scritta) return scritta;
  const i = Number.parseInt(riga.querySelector("[data-i]")?.getAttribute("data-i") ?? "", 10);
  return Number.isInteger(i) ? chiavi[i] : null;
}

function chiaviDellaBarra() {
  try {
    const chiavi = root.cdNavKeys?.();
    if (Array.isArray(chiavi)) return chiavi.map(String);
  } catch (_errore) {}
  return [...doc.querySelectorAll(".tab[data-tab]")].map((voce) => voce.dataset.tab);
}

/** Le righe dell'«Ordine navbar» messe in un elenco che si trascina. Le
 * frecce restano: chi le usa da anni le ritrova dove erano. */
function lOrdineSiTrascina(corpo) {
  if (corpo.querySelector("[data-dm-ordine-barra]")) return corpo.querySelector("[data-dm-ordine-barra]");
  const righe = [...corpo.querySelectorAll('[onclick="edNavMove(this)"]')]
    .map((freccia) => freccia.closest(".ed-row"))
    .filter((riga, i, tutte) => riga && tutte.indexOf(riga) === i);
  if (righe.length < 2) return null;
  const chiavi = chiaviDellaBarra();
  const elenco = doc.createElement("div");
  elenco.className = "dm-ordine-barra";
  elenco.setAttribute("data-dm-ordine-barra", "");
  elenco.setAttribute("data-dm-riordina", "");
  righe[0].before(elenco);
  for (const riga of righe) {
    const chiave = laChiaveDellaRiga(riga, chiavi);
    elenco.append(riga);
    /* Config non si sposta: chi applica l'ordine la rimette in fondo. */
    if (!chiave || chiave === CONFIG) continue;
    riga.setAttribute("data-dm-riordina-riga", chiave);
    const nome = riga.querySelector(".ed-row-new")?.textContent?.trim() || chiave;
    const maniglia = doc.createElement("button");
    maniglia.type = "button";
    maniglia.className = "dm-ordine-barra-maniglia";
    maniglia.setAttribute("data-dm-maniglia", "");
    maniglia.setAttribute("aria-label", `${nome}: ${t("trascina, o usa le frecce su e giù", "drag, or use the up and down arrows")}`);
    maniglia.title = t("Trascina per spostare", "Drag to move");
    maniglia.textContent = "⠿";
    riga.prepend(maniglia);
  }
  return elenco;
}

function onRiordina(event) {
  const elenco = event.target;
  if (!elenco?.hasAttribute?.("data-dm-ordine-barra")) return;
  const { da, a } = event.detail || {};
  const mobili = [...elenco.children]
    .filter((riga) => riga.hasAttribute("data-dm-riordina-riga"))
    .map((riga) => riga.getAttribute("data-dm-riordina-riga"));
  if (!Number.isInteger(da) || !Number.isInteger(a) || !mobili[da]) return;
  const nuove = spostaNellaLista(mobili, da, a);
  /* Le voci che l'elenco non ha (Config, le sezioni nate dopo) restano in
   * coda come le mette chi applica l'ordine. */
  const resto = chiaviDellaBarra().filter((chiave) => !nuove.includes(chiave) && chiave !== CONFIG);
  writeJsonIfChanged("cd_navbar_order", [...nuove, ...resto, CONFIG]);
  try {
    root.cdApplyNavOrder?.();
  } catch (_errore) {}
  const chiave = mobili[da];
  try {
    root.editorSwitch?.("visib");
  } catch (_errore) {}
  /* Dopo il ridisegno il fuoco torna sulla maniglia di chi si e' spostato,
   * cosi' dalla tastiera si continua a premere la freccia. */
  root.queueMicrotask?.(() => {
    sistema();
    const css = root.CSS?.escape ? root.CSS.escape(chiave) : chiave;
    doc.querySelector(`[data-dm-ordine-barra] > [data-dm-riordina-riga="${css}"] [data-dm-maniglia]`)?.focus?.();
  });
}

/* ── le disposizioni salvate ────────────────────────────────────────────── */

function nomeDellaPagina(pagina) {
  const css = root.CSS?.escape ? root.CSS.escape(pagina) : pagina;
  const voce = doc.querySelector(`.tab[data-tab="${css}"]`);
  return voce?.querySelector(".text")?.textContent?.trim() || voce?.textContent?.trim() || pagina;
}

function markupDelleSalvate() {
  const pagine = pagineCambiate(readJson(CHIAVE_DISPOSIZIONE, {}));
  const righe = pagine
    .map(
      ({ pagina, elenchi, nascosti }) => `<div class="ed-row dm-disp-salvata" data-dm-disp-salvata="${esc(pagina)}">
        <div class="ed-row-main"><div class="ed-row-new">${esc(nomeDellaPagina(pagina))}</div>
        <div class="dm-disp-salvata-cosa">${t("Elenchi cambiati", "Changed lists")}: ${elenchi}${
          nascosti ? ` · ${t("Riquadri nascosti", "Hidden blocks")}: ${nascosti}` : ""
        }</div></div>
        <button type="button" class="ed-btn-add dm-disp-salvata-tasto" data-dm-disp-ripristina="${esc(pagina)}">↺ ${t("Ripristina", "Reset")}</button>
      </div>`,
    )
    .join("");
  return `<div class="ed-intro" style="margin-top:18px;"><b>${t("Disposizioni salvate", "Saved layouts")}</b>: ${t(
    "le pagine cambiate nell'anteprima della loro scheda — l'ordine dei riquadri e quelli nascosti. «Ripristina» la rimette com'era.",
    "the pages changed in their tab's preview — the order of the blocks and the hidden ones. «Reset» puts it back as it was.",
  )}</div>${
    righe
      ? `${righe}${
          pagine.length > 1
            ? `<button type="button" class="ed-btn-add dm-disp-salvata-tutte" data-dm-disp-ripristina-tutte>↺ ${t("Ripristina tutte", "Reset all")}</button>`
            : ""
        }`
      : `<div class="dm-disp-salvata-vuota">${t("Nessuna pagina cambiata: sono tutte come di serie.", "No page changed: they are all as they came.")}</div>`
  }`;
}

function leSalvate(corpo, dopo) {
  let blocco = corpo.querySelector("[data-dm-disp-salvate]");
  if (!blocco) {
    blocco = doc.createElement("div");
    blocco.setAttribute("data-dm-disp-salvate", "");
    dopo.after(blocco);
  }
  const html = markupDelleSalvate();
  if (blocco.__dmHtml !== html) {
    blocco.innerHTML = html;
    blocco.__dmHtml = html;
  }
}

/* ── i disegni salvati ──────────────────────────────────────────────────── */

function disegniSalvati() {
  return Object.entries(disegniPuliti(readJson(CHIAVE_DISEGNI, {})))
    .map(([casella, posizioni]) => {
      const [disegno, variante] = casella.split(":");
      return { casella, disegno, variante, pezzi: Object.keys(posizioni).length };
    })
    .sort(
      (a, b) =>
        nomeDelDisegno(a.disegno).localeCompare(nomeDelDisegno(b.disegno)) ||
        a.variante.localeCompare(b.variante),
    );
}

function markupDeiDisegni() {
  const disegni = disegniSalvati();
  const righe = disegni
    .map(
      ({ casella, disegno, variante, pezzi }) => `<div class="ed-row dm-disp-salvata" data-dm-disegno-salvato="${esc(casella)}">
        <div class="ed-row-main"><div class="ed-row-new">${esc(nomeDelDisegno(disegno))}</div>
        <div class="dm-disp-salvata-cosa">${esc(etichettaDellaVariante(variante))} · ${t("Pezzi spostati", "Moved pieces")}: ${pezzi}</div></div>
        <button type="button" class="ed-btn-add dm-disp-salvata-tasto" data-dm-disegno-ripristina-salvato="${esc(casella)}">↺ ${t("Ripristina", "Reset")}</button>
      </div>`,
    )
    .join("");
  return `<div class="ed-intro" style="margin-top:18px;"><b>${t("Disegni salvati", "Saved drawings")}</b>: ${t(
    "i disegni a cui nell'anteprima hai spostato i pezzi, sul computer e sul telefono. «Ripristina» li rimette com'erano.",
    "the drawings whose pieces you moved in the preview, on the computer and on the phone. «Reset» puts them back as they were.",
  )}</div>${
    righe
      ? `${righe}${
          disegni.length > 1
            ? `<button type="button" class="ed-btn-add dm-disp-salvata-tutte" data-dm-disegno-ripristina-tutti>↺ ${t("Ripristina tutti", "Reset all")}</button>`
            : ""
        }`
      : `<div class="dm-disp-salvata-vuota">${t("Nessun disegno cambiato: sono tutti come di serie.", "No drawing changed: they are all as they came.")}</div>`
  }`;
}

function iDisegni(corpo, dopo) {
  let blocco = corpo.querySelector("[data-dm-disegni-salvati]");
  if (!blocco) {
    blocco = doc.createElement("div");
    blocco.setAttribute("data-dm-disegni-salvati", "");
    dopo.after(blocco);
  }
  const html = markupDeiDisegni();
  if (blocco.__dmHtml !== html) {
    blocco.innerHTML = html;
    blocco.__dmHtml = html;
  }
}

function rimettiIlDisegno(casella) {
  let tutta = readJson(CHIAVE_DISEGNI, {});
  const caselle = casella ? [casella] : disegniSalvati().map((d) => d.casella);
  for (const una of caselle) {
    const [disegno, variante] = una.split(":");
    tutta = senzaIlDisegno(tutta, disegno, variante);
  }
  writeJsonIfChanged(CHIAVE_DISEGNI, tutta);
  /* I disegni si rimettono subito, anche quelli delle pagine dietro. */
  try {
    ridisegnaIDisegni();
  } catch (_errore) {}
  sistema();
}

function rimettiLaPagina(pagina) {
  const pagine = pagina ? [pagina] : pagineCambiate(readJson(CHIAVE_DISPOSIZIONE, {})).map((p) => p.pagina);
  let tutta = readJson(CHIAVE_DISPOSIZIONE, {});
  for (const una of pagine) tutta = senzaLaPagina(tutta, una);
  writeJsonIfChanged(CHIAVE_DISPOSIZIONE, tutta);
  /* La pagina si rimette subito, anche se non e' quella davanti. */
  for (const una of pagine) {
    try {
      root.dmDisposizione?.applicaLaDisposizione?.(doc.getElementById(`page-${una}`));
    } catch (_errore) {}
  }
  sistema();
}

function onClick(event) {
  const disegno = event.target?.closest?.(
    "[data-dm-disegno-ripristina-salvato],[data-dm-disegno-ripristina-tutti]",
  );
  if (disegno?.closest("#ed-body")) {
    event.preventDefault();
    event.stopPropagation();
    rimettiIlDisegno(disegno.getAttribute("data-dm-disegno-ripristina-salvato") || null);
    return;
  }
  const tasto = event.target?.closest?.("[data-dm-disp-ripristina],[data-dm-disp-ripristina-tutte]");
  if (!tasto || !tasto.closest("#ed-body")) return;
  event.preventDefault();
  event.stopPropagation();
  rimettiLaPagina(tasto.getAttribute("data-dm-disp-ripristina") || null);
}

/* ── installare ─────────────────────────────────────────────────────────── */

function sistema() {
  const corpo = doc?.getElementById("ed-body");
  if (!corpo) return;
  const elenco = lOrdineSiTrascina(corpo);
  if (!elenco) return;
  leSalvate(corpo, elenco);
  iDisegni(corpo, corpo.querySelector("[data-dm-disp-salvate]") || elenco);
}

const STILE = `
  .dm-ordine-barra{display:flex;flex-direction:column;gap:inherit}
  .dm-ordine-barra>.ed-row{display:flex}
  .dm-ordine-barra-maniglia{flex:0 0 32px;width:32px;height:40px;margin:-4px 2px -4px -6px;padding:0;border:0;border-radius:10px;
    background:transparent;color:var(--text-dim,#94a3b8);font-size:18px;line-height:1;cursor:grab;
    display:inline-flex;align-items:center;justify-content:center;touch-action:none;user-select:none;-webkit-user-select:none}
  .dm-ordine-barra-maniglia:hover{color:var(--text,#0f172a);background:color-mix(in srgb,var(--text-dim,#94a3b8) 14%,transparent)}
  .dm-ordine-barra-maniglia:focus-visible{outline:2px solid var(--accent,#3b82f6);outline-offset:1px}
  .dm-disp-salvata{align-items:center;gap:10px}
  .dm-disp-salvata-cosa{font-size:12px;color:var(--text-dim,#64748b);margin-top:2px}
  .dm-disp-salvata-tasto{width:auto!important;margin:0!important;padding:8px 14px!important;white-space:nowrap;flex:0 0 auto}
  .dm-disp-salvata-tutte{width:100%;margin-top:8px}
  .dm-disp-salvata-vuota{font-size:13px;color:var(--text-dim,#64748b);padding:6px 2px}
`;

export function installDisposizioneNelConfig() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyle("dm-disposizione-nel-config-style", STILE);
  doc.addEventListener("dm-riordina", onRiordina);
  doc.addEventListener("click", onClick, true);
  const presto = () => onEditorRedraw("__dmDisposizioneNelConfig", sistema);
  presto();
  root.addEventListener?.("dashboardmodern:legacy-ready", presto);
  root.addEventListener?.("storage", (event) => {
    if (event.key === CHIAVE_DISPOSIZIONE || event.key === CHIAVE_DISEGNI) sistema();
  });
}
