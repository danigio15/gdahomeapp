/* La guida dentro il Config: il manuale che si apre accanto alla scheda.
 *
 * «Pensa a come creare direttamente dal config delle plance un manuale
 * interattivo che spiega come fare le configurazioni e tutto.»
 *
 * Una riga sotto la ricerca, con due tasti:
 *
 *  - «📖 Come si configura» apre il foglio della guida per la scheda che si sta
 *    guardando: a cosa serve, i passi uno per volta, i consigli. Ogni passo che
 *    nomina un campo ha «👉 Mostrami»: la scheda scorre fin lì e il campo si
 *    accende, con il numero del passo accanto. Cambiando scheda, il foglio
 *    segue: è sempre la guida di quella aperta;
 *  - «🧭 Da dove comincio» apre il percorso per una casa nuova: le schede
 *    nell'ordine giusto, ognuna con «Vai» e con la spunta «Fatto», che resta
 *    su questo apparecchio e serve solo a chi configura per ricordarsi a che
 *    punto è.
 *
 * Il foglio non copre la scheda: sul telefono sta nella metà bassa, sul
 * computer di lato. Si legge la guida e si vede il campo nello stesso momento,
 * che è il motivo per cui sta qui e non in un PDF.
 *
 * I testi non stanno qui: stanno nel manuale, e li porta
 * `core/guida-del-config-testi.js` (vedi `core/guida-del-config.js`).
 */
import {
  eLaParola,
  guida3dDi,
  guidaDi,
  paroleDelPasso,
  percorsoPer,
} from "../core/guida-del-config.js";
import {
  activeLocale,
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  root,
  senzaCadere,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_GUIDA_CONFIG__";
const state = (root[KEY] ||= {
  installed: false,
  aperta: "", // "", "scheda" o "percorso"
  passo: -1,
  nonTrovato: -1,
  contesto: "config", // "config" o "3d", la procedura «Crea la tua casa»
  passo3d: -1,
});

const RIGA = "dm-guida-riga";
const FOGLIO = "dm-guida-foglio";
const LUCE = "dm-guida-luce";
const SEGNO = "dm-guida-segno";
const STILE = "dm-guida-config-style";
const MEMORIA = "dm-guida-fatte";

const linguetteDelConfig = () =>
  [...(doc?.querySelectorAll?.("#editor-modal .ed-tab") || [])].map((una) => clean(una.dataset?.tab));

const schedaAperta = () =>
  clean(doc?.querySelector?.("#editor-modal .ed-tab.active")?.dataset?.tab) || "visib";

const nomeDellaScheda = (scheda) => {
  const linguetta = doc?.querySelector?.(`#editor-modal .ed-tab[data-tab="${scheda}"]`);
  const etichetta = linguetta?.querySelector?.(".dm-beta4-tab-label")?.textContent;
  return clean(etichetta || linguetta?.textContent || scheda);
};

/* La spunta «Fatto» del percorso: una comodità di chi configura, su questo
 * apparecchio. Senza memoria (finestra privata, anteprima) la guida funziona
 * lo stesso, e la spunta semplicemente non resta. */
function fatte() {
  try {
    const lette = JSON.parse(root.localStorage?.getItem(MEMORIA) || "[]");
    return new Set(Array.isArray(lette) ? lette.map(clean) : []);
  } catch (_errore) {
    return new Set();
  }
}

function segnaFatta(scheda, si) {
  const insieme = fatte();
  if (si) insieme.add(scheda);
  else insieme.delete(scheda);
  try {
    root.localStorage?.setItem(MEMORIA, JSON.stringify([...insieme]));
  } catch (_errore) {
    /* Senza memoria la spunta non resta: pazienza. */
  }
}

/* ── Dove si e': il Config o la procedura della Casa 3D ─────────────────── */

const PROCEDURA_3D = "dm-c3c";
const statoDella3D = () => root.__DASHBOARDMODERN_CASA3D_CREA__?.S || null;
const passo3dAperto = () => {
  const passo = Number(statoDella3D()?.passo);
  return Number.isInteger(passo) ? passo : 0;
};

function guidaCorrente() {
  if (state.contesto === "3d") return guida3dDi(passo3dAperto());
  return guidaDi(schedaAperta());
}

function corpoCorrente() {
  if (state.contesto === "3d") return doc.getElementById(PROCEDURA_3D);
  return doc.getElementById("ed-body");
}

/* ── Accendere il campo ─────────────────────────────────────────────────── */

function spegniLaLuce() {
  doc?.querySelectorAll?.(`.${LUCE}`).forEach((una) => una.classList.remove(LUCE));
  doc?.querySelectorAll?.(`.${SEGNO}`).forEach((uno) => uno.remove());
}

/* Il campo che il passo nomina: nel corpo della scheda, l'elemento più piccolo
 * che comincia con quella parola. Il più piccolo, perché la parola sta anche
 * dentro tutti i contenitori che lo contengono, e accendere la scheda intera
 * non mostra niente. Se il campo sta in una fisarmonica chiusa, la si apre. */
export function trovaIlCampo(corpo, parole) {
  if (!corpo || !parole?.length) return null;
  for (const parola of parole) {
    let migliore = null;
    let area = Infinity;
    for (const uno of corpo.querySelectorAll("*")) {
      if (uno.closest?.(`.${FOGLIO}`)) continue;
      const testo = uno.textContent || uno.value || uno.placeholder || "";
      if (!eLaParola(testo, parola) && !eLaParola(uno.placeholder || "", parola)) continue;
      const nascosto = uno.closest?.("details:not([open])");
      if (nascosto && nascosto.querySelector("summary") && !nascosto.querySelector("summary").contains(uno))
        nascosto.open = true;
      const r = uno.getBoundingClientRect?.();
      const quanto = r ? Math.max(1, r.width * r.height) : Infinity;
      if (!r || (r.width === 0 && r.height === 0)) continue;
      if (quanto < area) {
        area = quanto;
        migliore = uno;
      }
    }
    if (migliore) {
      /* Un'etichetta da sola dice poco: si accende la riga che la contiene,
       * se è una riga piccola (un campo, un interruttore, un tasto). */
      const riga = migliore.closest?.("button, label, summary, .ed-slot, .dm-entity-picker, .ed-row, .ed-field");
      return riga && riga !== corpo ? riga : migliore;
    }
  }
  return null;
}

function accendi(campo, numero) {
  spegniLaLuce();
  if (!campo) return false;
  campo.classList.add(LUCE);
  /* In alto, non al centro: sul telefono la metà bassa è della guida. */
  campo.scrollIntoView?.({ block: "start", inline: "nearest" });
  const segno = doc.createElement("span");
  segno.className = SEGNO;
  segno.textContent = String(numero);
  segno.setAttribute("aria-hidden", "true");
  const sopra = campo.offsetParent || campo.parentElement;
  if (sopra && root.getComputedStyle?.(sopra)?.position === "static") sopra.style.position = "relative";
  campo.after?.(segno);
  return true;
}

/* ── Il foglio ──────────────────────────────────────────────────────────── */

function chiudi() {
  state.aperta = "";
  state.passo = -1;
  spegniLaLuce();
  doc?.getElementById?.(FOGLIO)?.remove();
  doc?.getElementById?.("editor-modal")?.classList?.remove("dm-guida-con-foglio");
  doc?.documentElement?.classList?.remove("dm-guida-aperta");
}

function htmlDellaScheda(scheda) {
  const in3d = state.contesto === "3d";
  const guida = guidaCorrente();
  const nome = in3d
    ? esc(`${passo3dAperto() + 1}. ${guida?.titolo || ""}`)
    : esc(nomeDellaScheda(scheda));
  const avvisoLingua =
    activeLocale() !== "it"
      ? `<p class="dm-guida-nota">${esc(t("", "This guide is written in Italian for now."))}</p>`
      : "";
  if (!guida) {
    return `<div class="dm-guida-testa"><b>📖 ${nome}</b><button type="button" data-guida="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button></div>
      <p>${esc(t("Per questa scheda la guida non c'è ancora. Il manuale d'uso, capitolo 27, spiega tutte le altre.", "There is no guide for this tab yet. Chapter 27 of the user manual explains all the others."))}</p>
      <button type="button" class="dm-guida-btn" data-guida="percorso">🧭 ${esc(t("Da dove comincio", "Where do I start"))}</button>`;
  }
  const passi = guida.passi
    .map((passo, i) => {
      const mostrabile = paroleDelPasso(passo).length > 0;
      const attivo = i === state.passo ? " dm-guida-attivo" : "";
      return `<li class="dm-guida-passo${attivo}" data-indice="${i}">
        <span class="dm-guida-num">${i + 1}</span>
        <span class="dm-guida-testo">${passo.html}</span>
        ${i === state.nonTrovato ? `<em class="dm-guida-nota">${esc(t("Questo campo compare dopo il passo prima (per esempio dopo «＋ Aggiungi»).", "This field appears after the previous step (for example after «＋ Add»)."))}</em>` : ""}
        ${mostrabile ? `<button type="button" class="dm-guida-mostra" data-guida="mostra" data-indice="${i}">👉 ${esc(t("Mostrami", "Show me"))}</button>` : ""}
      </li>`;
    })
    .join("");
  const consigli = guida.consigli.length
    ? `<details class="dm-guida-consigli"><summary>💡 ${esc(t("Consigli", "Tips"))} (${guida.consigli.length})</summary><ul>${guida.consigli
        .map((uno) => `<li>${uno}</li>`)
        .join("")}</ul></details>`
    : "";
  const campi = guida.campi.length
    ? `<details class="dm-guida-campi"><summary>🔎 ${esc(t("Cosa trovi in questa scheda", "What is in this tab"))} (${guida.campi.length})</summary><ul>${guida.campi
        .map((uno) => `<li>${uno}</li>`)
        .join("")}</ul></details>`
    : "";
  const totale = guida.passi.length;
  const naviga = totale
    ? `<div class="dm-guida-naviga">
        <button type="button" data-guida="indietro" ${state.passo <= 0 ? "disabled" : ""}>◀ ${esc(t("Indietro", "Back"))}</button>
        <span>${state.passo >= 0 ? esc(t(`Passo ${state.passo + 1} di ${totale}`, `Step ${state.passo + 1} of ${totale}`)) : esc(t(`${totale} passi`, `${totale} steps`))}</span>
        <button type="button" data-guida="avanti" ${state.passo >= totale - 1 ? "disabled" : ""}>${state.passo < 0 ? esc(t("Comincia", "Start")) : esc(t("Avanti", "Next"))} ▶</button>
      </div>`
    : "";
  return `<div class="dm-guida-testa"><b>📖 ${in3d ? esc(t("Come si fa", "How to do it")) : esc(t("Come si configura", "How to set up"))}: ${nome}</b><button type="button" data-guida="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button></div>
    ${avvisoLingua}
    <p class="dm-guida-scopo">${guida.scopo}</p>
    ${naviga}
    <ol class="dm-guida-passi">${passi}</ol>
    ${campi}${consigli}
    ${in3d ? "" : `<button type="button" class="dm-guida-btn dm-guida-tenue" data-guida="percorso">🧭 ${esc(t("Da dove comincio", "Where do I start"))}</button>`}`;
}

function htmlDelPercorso() {
  const gia = fatte();
  const passi = percorsoPer(linguetteDelConfig());
  const quante = passi.filter((uno) => gia.has(uno.scheda)).length;
  const righe = passi
    .map(
      (uno, i) => `<li class="dm-guida-tappa${gia.has(uno.scheda) ? " dm-guida-fatta" : ""}">
        <span class="dm-guida-num">${gia.has(uno.scheda) ? "✓" : i + 1}</span>
        <span class="dm-guida-testo"><b>${esc(nomeDellaScheda(uno.scheda))}</b><br>${esc(t(uno.it, uno.en))}</span>
        <span class="dm-guida-tasti">
          <button type="button" class="dm-guida-mostra" data-guida="vai" data-scheda="${esc(uno.scheda)}">${esc(t("Vai", "Go"))} ›</button>
          <label class="dm-guida-spunta"><input type="checkbox" data-guida="fatta" data-scheda="${esc(uno.scheda)}" ${gia.has(uno.scheda) ? "checked" : ""}> ${esc(t("Fatto", "Done"))}</label>
        </span>
      </li>`,
    )
    .join("");
  return `<div class="dm-guida-testa"><b>🧭 ${esc(t("Da dove comincio", "Where do I start"))}</b><button type="button" data-guida="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button></div>
    <p class="dm-guida-scopo">${esc(t("L'ordine consigliato per configurare una casa nuova. «Vai» apre la scheda con la sua guida; «Fatto» ti ricorda a che punto sei (resta su questo apparecchio).", "The recommended order to set up a new home. «Go» opens the tab with its guide; «Done» reminds you where you are (kept on this device)."))}</p>
    <div class="dm-guida-barra"><span style="width:${passi.length ? Math.round((quante / passi.length) * 100) : 0}%"></span></div>
    <p class="dm-guida-nota">${esc(t(`${quante} di ${passi.length} fatte`, `${quante} of ${passi.length} done`))}</p>
    <ol class="dm-guida-passi">${righe}</ol>`;
}

function disegna() {
  const guscio =
    state.contesto === "3d"
      ? doc?.getElementById?.(PROCEDURA_3D)
      : doc?.querySelector?.("#editor-modal .ed-shell");
  if (!guscio || !state.aperta) {
    doc?.getElementById?.(FOGLIO)?.remove();
    return;
  }
  let foglio = doc.getElementById(FOGLIO);
  if (!foglio) {
    foglio = doc.createElement("aside");
    foglio.id = FOGLIO;
    foglio.className = FOGLIO;
    foglio.setAttribute("role", "dialog");
    foglio.setAttribute("aria-label", t("Guida della configurazione", "Configuration guide"));
    foglio.addEventListener("click", alTocco);
    foglio.addEventListener("change", alTocco);
    /* Alla pagina, non alla finestra del Config: dentro quella «fisso» vuol
     * dire fisso a lei, e il foglio scorrerebbe via con la scheda. */
    doc.body.append(foglio);
  }
  foglio.classList.toggle("dm-guida-3d", state.contesto === "3d");
  /* Sul telefono il foglio sta nella metà bassa: chi gli sta sotto deve poter
   * scorrere più su, se no i tasti in fondo («Avanti», «Salva») restano
   * coperti. Il posto in più lo dà questa classe, e solo mentre è aperto. */
  doc.documentElement.classList.add("dm-guida-aperta");
  foglio.innerHTML = state.aperta === "percorso" ? htmlDelPercorso() : htmlDellaScheda(schedaAperta());
  if (state.contesto === "config") doc.getElementById("editor-modal")?.classList.add("dm-guida-con-foglio");
}

function mostraIlPasso(indice) {
  const guida = guidaCorrente();
  if (!guida) return;
  state.passo = Math.max(0, Math.min(indice, guida.passi.length - 1));
  state.nonTrovato = -1;
  disegna();
  const corpo = corpoCorrente();
  const parole = paroleDelPasso(guida.passi[state.passo]);
  const campo = trovaIlCampo(corpo, parole);
  /* Un passo che non nomina nessun campo («Scegli la stanza.») non ha niente
   * da mostrare, e non e' un campo che manca. */
  state.nonTrovato = accendi(campo, state.passo + 1) || !parole.length ? -1 : state.passo;
  if (state.nonTrovato >= 0) {
    spegniLaLuce();
    disegna();
  }
  doc.querySelector(`#${FOGLIO} .dm-guida-attivo`)?.scrollIntoView?.({ block: "nearest" });
}

function alTocco(evento) {
  const tasto = evento.target?.closest?.("[data-guida]");
  if (!tasto) return;
  const cosa = tasto.dataset.guida;
  if (evento.type === "change" && cosa !== "fatta") return;
  if (evento.type === "click" && cosa === "fatta") return;
  if (cosa === "chiudi") return chiudi();
  if (cosa === "percorso") {
    state.aperta = "percorso";
    spegniLaLuce();
    return disegna();
  }
  if (cosa === "mostra") return mostraIlPasso(Number(tasto.dataset.indice) || 0);
  if (cosa === "avanti") return mostraIlPasso(state.passo + 1);
  if (cosa === "indietro") return mostraIlPasso(state.passo - 1);
  if (cosa === "fatta") {
    segnaFatta(clean(tasto.dataset.scheda), tasto.checked);
    return disegna();
  }
  if (cosa === "vai") {
    const scheda = clean(tasto.dataset.scheda);
    state.aperta = "scheda";
    state.passo = -1;
    spegniLaLuce();
    if (typeof root.editorSwitch === "function") root.editorSwitch(scheda);
    else doc.querySelector(`#editor-modal .ed-tab[data-tab="${scheda}"]`)?.click?.();
    return disegna();
  }
}

/* ── La riga dei due tasti, sotto la ricerca ────────────────────────────── */

export function ensureRigaDellaGuida() {
  const strisce = doc?.querySelector?.("#editor-modal .ed-tabs");
  const guscio = strisce?.parentElement;
  if (!strisce || !guscio) return false;
  installaLoStile();
  let riga = guscio.querySelector(`.${RIGA}`);
  if (!riga) {
    riga = doc.createElement("div");
    riga.className = RIGA;
    riga.innerHTML = `<button type="button" data-apri="scheda">📖 ${esc(t("Come si configura questa scheda", "How to set up this tab"))}</button><button type="button" data-apri="percorso">🧭 ${esc(t("Da dove comincio", "Where do I start"))}</button>`;
    riga.addEventListener("click", (evento) => {
      const quale = evento.target?.closest?.("[data-apri]")?.dataset?.apri;
      if (!quale) return;
      if (state.aperta === quale && state.contesto === "config") return chiudi();
      state.contesto = "config";
      state.aperta = quale;
      state.passo = -1;
      spegniLaLuce();
      disegna();
    });
  }
  /* Dentro il blocco della ricerca, in fondo: il guscio è una griglia, e un
   * figlio in più suo si prenderebbe una casella e spingerebbe la scheda
   * fuori dallo schermo. La ricerca ha già la sua riga a tutta larghezza. */
  const ricerca = guscio.querySelector(":scope > .dm-cerca-config");
  if (ricerca) {
    if (riga.parentElement !== ricerca || ricerca.lastElementChild !== riga) ricerca.append(riga);
  } else if (riga.parentElement !== guscio.querySelector(".ed-head")) {
    guscio.querySelector(".ed-head")?.after?.(riga);
  }
  return true;
}

/* ── Il tasto dentro «Crea la tua casa» ─────────────────────────────────── */

/* La procedura della Casa 3D si disegna da sé, a tutto schermo, e cambia
 * passo riscrivendo il suo corpo: la testata resta. Il tasto sta lì, accanto
 * alla ✕, e la guida segue il passo guardando la barra dei passi. */
export function ensureTastoDella3D() {
  const procedura = doc?.getElementById?.(PROCEDURA_3D);
  if (!procedura) {
    if (state.contesto === "3d") {
      chiudi();
      state.contesto = "config";
    }
    return false;
  }
  installaLoStile();
  const testa = procedura.querySelector(".c3c-testa");
  if (testa && !testa.querySelector(".dm-guida-3d-tasto")) {
    const tasto = doc.createElement("button");
    tasto.type = "button";
    tasto.className = "dm-guida-3d-tasto";
    tasto.textContent = `📖 ${t("Come si fa", "How to do it")}`;
    tasto.addEventListener("click", () => {
      if (state.aperta && state.contesto === "3d") return chiudi();
      state.contesto = "3d";
      state.aperta = "scheda";
      state.passo = -1;
      state.passo3d = passo3dAperto();
      spegniLaLuce();
      disegna();
    });
    const chiudiLaProcedura = testa.querySelector(".c3c-chiudi");
    if (chiudiLaProcedura) chiudiLaProcedura.before(tasto);
    else testa.append(tasto);
  }
  const barra = procedura.querySelector(".c3c-passi");
  if (barra && !barra.__dmGuidaGuarda && root.MutationObserver) {
    barra.__dmGuidaGuarda = new root.MutationObserver(() => {
      if (state.contesto !== "3d" || !state.aperta) return;
      const ora = passo3dAperto();
      if (ora === state.passo3d) return;
      state.passo3d = ora;
      state.passo = -1;
      spegniLaLuce();
      disegna();
    });
    barra.__dmGuidaGuarda.observe(barra, { childList: true, subtree: true });
  }
  return true;
}

function installaLoStile() {
  installStyle(
    STILE,
    `
.${RIGA}{display:flex;gap:8px;flex-wrap:wrap;padding:6px 0 2px}
.${RIGA} button{flex:1 1 auto;border:1px solid rgba(124,58,237,.35);background:rgba(124,58,237,.08);color:#6d28d9;border-radius:999px;padding:7px 12px;font:600 13px/1.2 inherit;cursor:pointer}
.${FOGLIO}{position:fixed;z-index:2147483300;background:var(--card-bg,#fff);color:var(--text,#0f172a);box-shadow:0 -6px 28px rgba(15,23,42,.28);overflow:auto;font-size:14px;line-height:1.45;
  left:0;right:0;bottom:0;max-height:46vh;border-radius:18px 18px 0 0;padding:12px 16px 18px}
.dm-guida-3d-tasto{border:1px solid rgba(124,58,237,.35);background:rgba(124,58,237,.1);color:#6d28d9;border-radius:999px;padding:8px 14px;font:600 13px/1.2 inherit;cursor:pointer;white-space:nowrap;margin-left:8px}
@media (max-width:899px){html.dm-guida-aperta #ed-body,html.dm-guida-aperta #dm-c3c .c3c-pagina{padding-bottom:50vh !important}}
@media (min-width:900px){.${FOGLIO}.dm-guida-3d{left:16px;right:auto;top:auto;bottom:16px;width:380px;max-height:70vh;border-radius:18px;box-shadow:0 8px 30px rgba(15,23,42,.35)}}
@media (min-width:900px){.${FOGLIO}{left:auto;top:0;bottom:0;width:380px;max-height:none;border-radius:0;box-shadow:-6px 0 28px rgba(15,23,42,.22)}
  #editor-modal.dm-guida-con-foglio .ed-shell{margin-right:380px}}
.dm-guida-testa{display:flex;align-items:center;justify-content:space-between;gap:8px;position:sticky;top:-12px;background:inherit;padding:4px 0 6px;font-size:15px}
.dm-guida-testa button{border:0;background:rgba(15,23,42,.06);border-radius:50%;width:30px;height:30px;cursor:pointer;color:inherit}
.dm-guida-scopo{margin:4px 0 10px;color:var(--text-secondary,#475569)}
.dm-guida-nota{font-size:12px;color:var(--text-secondary,#64748b);margin:2px 0 8px}
.dm-guida-passi{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.dm-guida-passo,.dm-guida-tappa{display:flex;gap:10px;align-items:flex-start;padding:8px;border-radius:12px;background:rgba(15,23,42,.04)}
.dm-guida-attivo{background:rgba(225,29,72,.08);outline:2px solid rgba(225,29,72,.5)}
.dm-guida-num{flex:none;width:24px;height:24px;border-radius:50%;background:#e11d48;color:#fff;font:700 13px/24px inherit;text-align:center}
.dm-guida-fatta .dm-guida-num{background:#16a34a}
.dm-guida-testo{flex:1;min-width:0}
.dm-guida-passo .dm-guida-nota{display:block;flex-basis:100%;margin:2px 0 0 34px}
.dm-guida-passo{flex-wrap:wrap}
.dm-guida-tasti{display:flex;flex-direction:column;gap:4px;align-items:flex-end}
.dm-guida-mostra,.dm-guida-btn{border:0;background:#7c3aed;color:#fff;border-radius:999px;padding:5px 10px;font:600 12px/1.2 inherit;cursor:pointer;white-space:nowrap}
.dm-guida-btn{margin-top:12px;padding:8px 14px}
.dm-guida-tenue{background:rgba(124,58,237,.12);color:#6d28d9}
.dm-guida-spunta{font-size:12px;white-space:nowrap}
.dm-guida-naviga{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 10px;font-size:13px}
.dm-guida-naviga button{border:1px solid rgba(15,23,42,.15);background:transparent;border-radius:999px;padding:5px 10px;cursor:pointer;color:inherit}
.dm-guida-naviga button:disabled{opacity:.35;cursor:default}
.dm-guida-consigli,.dm-guida-campi{margin-top:10px}
.dm-guida-consigli summary,.dm-guida-campi summary{cursor:pointer;font-weight:600}
.dm-guida-barra{height:8px;border-radius:99px;background:rgba(15,23,42,.08);overflow:hidden}
.dm-guida-barra span{display:block;height:100%;background:#16a34a}
.${LUCE}{scroll-margin-top:190px;outline:3px solid #e11d48 !important;outline-offset:3px;border-radius:8px;animation:dmGuidaPulsa 1.2s ease-in-out 3}
.${SEGNO}{position:relative;display:inline-block;margin-left:6px;width:22px;height:22px;border-radius:50%;background:#e11d48;color:#fff;font:700 12px/22px system-ui,sans-serif;text-align:center;vertical-align:middle;box-shadow:0 1px 4px rgba(0,0,0,.35)}
@keyframes dmGuidaPulsa{0%,100%{outline-color:#e11d48}50%{outline-color:rgba(225,29,72,.25)}}
`,
  );
}

export function installGuidaDelConfigSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installaLoStile();
  ensureRigaDellaGuida();
  /* La procedura della Casa 3D arriva e se ne va come figlia della pagina:
   * basta guardare i figli diretti, senza scendere. */
  if (root.MutationObserver && doc.body) {
    new root.MutationObserver(() => senzaCadere(ensureTastoDella3D, "guida-3d")).observe(doc.body, {
      childList: true,
    });
  }
  /* A ogni giro del Config — una scheda nuova, un salvataggio — la riga si
   * rimette al suo posto e il foglio, se è aperto, diventa la guida della
   * scheda di adesso. */
  onEditorRedraw("__dmGuidaDelConfig", () => {
    ensureRigaDellaGuida();
    if (state.contesto === "3d") return;
    if (!doc.getElementById("editor-modal")) {
      chiudi();
      return;
    }
    if (state.aperta === "scheda") {
      state.passo = -1;
      spegniLaLuce();
    }
    if (state.aperta) disegna();
  });
  return true;
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installGuidaDelConfigSection, { once: true });
} else {
  senzaCadere(installGuidaDelConfigSection);
}
