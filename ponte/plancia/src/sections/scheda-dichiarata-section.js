/* La scheda dichiarata: una forma sola per quattro schede (#74).
 *
 * «Va cambiata per tutte quelle che hanno questa cosa. Le sezioni si devono
 *  comportare tutte alla stessa maniera.»
 *
 * Varchi, Batterie, Presenza e Macchine avevano lo stesso difetto e lo stesso
 * disegno: un elenco che si autocompilava, un cestino che escludeva invece di
 * cancellare, e sotto la lista degli esclusi. Rifarle quattro volte nella
 * forma nuova avrebbe voluto dire quattro copie della stessa scheda — cioe'
 * quattro schede che fra sei mesi non si comportano piu' alla stessa maniera,
 * che e' esattamente come ci siamo arrivati la prima volta.
 *
 * Qui c'e' la scheda, una volta sola. Chi la usa porta quello che e' davvero
 * suo: dove si salva, come si chiamano le cose, quali disegni offre, e cosa
 * propone il tasto d'importazione. Il resto — la riga con la matita e il
 * cestino, la pastiglia dell'entita', il nome, la striscia dei disegni, il
 * «＋ Aggiungi», il salva, la migrazione alla prima apertura — e' la stessa
 * per tutte e quattro, e si legge in un posto solo.
 *
 * ── Cosa NON sta qui ──────────────────────────────────────────────────────
 *
 * Il verdetto su come sta una riga — aperto, scarico, acceso — resta di chi
 * la chiama: e' l'unica cosa che le quattro sezioni dicono davvero in modo
 * diverso, e portarla qui dentro avrebbe voluto dire un `if` sul nome della
 * sezione, che e' il modo in cui una cosa condivisa torna a essere quattro.
 */
import {
  conLaRiga,
  conLeRighe,
  righeDichiarate,
  senzaLaRiga,
} from "../core/elenco-dichiarato.js";
import {
  clean,
  disegnoDiCasa,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  t,
  writeJsonIfChanged,
} from "./shared.js";

/* ── il disegno ───────────────────────────────────────────────────────────── */

function strisciaMarkup(scheda, indice, scelto) {
  const { nome, disegni, parole } = scheda;
  return `<label class="ed-slot dm-dich-campo"><span class="ed-slot-lbl">${esc(t("Icona", "Icon"))}</span>
    <div class="dm-dich-icone">${disegni
      .map(
        (chiave) =>
          `<button type="button" class="dm-dich-ico${chiave === scelto ? " dm-on" : ""}"
            data-dm-dich-icona="${esc(chiave)}" data-dm-dich-riga="${indice}"
            aria-pressed="${chiave === scelto}" aria-label="${esc(chiave)}">${disegnoDiCasa(chiave, { misura: 34 })}</button>`,
      )
      .join("")}</div>
    <small>${esc(
      parole.aiutoIcona ||
        t(
          "Il disegno che esce nella pagina e nella tessera. Sono quelli del catalogo di gdahome: uguali su ogni telefono.",
          "The drawing that shows on the page and on the tile. They are gdahome's own: the same on every phone.",
        ),
    )}</small>
    <input type="hidden" data-dm-dich-campo="icon" data-dm-dich-riga="${indice}" value="${esc(scelto)}" data-dm-dich-sezione="${esc(nome)}">
  </label>`;
}

function corpoMarkup(scheda, riga, indice) {
  const { nome, parole } = scheda;
  const id = `dm-dich-${nome}-${indice}`;
  return `<div class="dm-dich-corpo">
    <label class="ed-slot dm-dich-campo"><span class="ed-slot-lbl">${esc(parole.etichettaEntita)}</span>
      <span class="ed-form-row"><input id="${id}-entity" class="ed-input mono" data-dm-dich-campo="entity"
        data-dm-dich-riga="${indice}" value="${esc(riga.entity)}" placeholder="${esc(parole.segnaposto)}"
        autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker"
        data-dm-dich-pick="${id}-entity" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span>
      <small>${esc(parole.aiutoEntita)}</small></label>
    <label class="ed-slot dm-dich-campo"><span class="ed-slot-lbl">${esc(t("Nome", "Name"))}</span>
      <span class="ed-form-row"><input id="${id}-name" class="ed-input" data-dm-dich-campo="name"
        data-dm-dich-riga="${indice}" value="${esc(riga.name)}" placeholder="${esc(parole.segnapostoNome)}"></span>
      <small>${esc(parole.aiutoNome)}</small></label>
    ${strisciaMarkup(scheda, indice, riga.icon || scheda.ripiego)}
    ${scheda.campiInPiu ? scheda.campiInPiu(riga, indice) : ""}
    <button type="button" class="ed-save-btn" data-dm-dich-salva="${indice}">💾 ${esc(parole.salva)}</button>
  </div>`;
}

function rigaMarkup(scheda, riga, indice, letta, aperta) {
  const { parole } = scheda;
  const stato = riga.entity ? scheda.statoDellaRiga(letta) : "muta";
  const sotto = riga.entity
    ? `${riga.entity}${letta && scheda.didascalia(letta) ? ` · ${scheda.didascalia(letta)}` : ""}`
    : t("nessuna entità", "no entity");
  const accanto = riga.entity && scheda.accanto ? scheda.accanto(letta) : "";
  return `<article class="ed-row dm-dich-riga" data-dm-dich-stato="${esc(stato)}"
    data-dm-dich-indice="${indice}" data-open="${aperta}">
    <div class="dm-dich-testa">
      <span class="dm-dich-ic" aria-hidden="true">${disegnoDiCasa(riga.icon, { misura: 34, ripiego: scheda.ripiego })}</span>
      <span class="ed-row-main dm-dich-testo">
        <strong class="ed-row-new">${esc(riga.name || parole.senzaNome)}</strong>
        <small class="ed-row-old mono">${esc(sotto)}</small>
        ${riga.entity ? "" : `<small class="dm-dich-muta">${esc(parole.muta)}</small>`}
      </span>
      ${accanto ? `<b class="dm-dich-val">${esc(accanto)}</b>` : ""}
      <button type="button" class="ed-del dm-dich-edit" data-dm-dich-apri="${indice}"
        aria-label="${esc(t("Modifica", "Edit"))}">✏️</button>
      <button type="button" class="ed-del" data-dm-dich-elimina="${indice}"
        aria-label="${esc(t("Elimina", "Remove"))}">🗑️</button>
    </div>
    ${aperta ? corpoMarkup(scheda, riga, indice) : ""}
  </article>`;
}

/* ── la scheda ────────────────────────────────────────────────────────────── */

export function costruisciSchedaDichiarata(scheda) {
  const { nome, chiave, tab, parole } = scheda;
  const stato = (root[`__DASHBOARDMODERN_SCHEDA_${nome.toUpperCase()}__`] ||= {
    installed: false,
    aperto: -1,
  });
  const marchio = `dmScheda${nome[0].toUpperCase()}${nome.slice(1)}`;

  const configurazione = () => readJson(chiave, {}) || {};
  const righe = () => righeDichiarate(configurazione());
  const activeTab = () => clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);

  function salva(prossima) {
    writeJsonIfChanged(chiave, prossima);
    scheda.ridisegnaPagina?.();
  }

  function ridisegna() {
    const body = doc?.getElementById("ed-body");
    if (body) delete body.dataset[marchio];
    disegnaScheda();
  }

  /* Quello che il rilevamento proporrebbe, meno quello che c'e' gia'. E' la
   * proposta del tasto in fondo e — la prima volta — e' la migrazione. */
  function daPrendere() {
    const gia = new Set((righe() || []).map((riga) => riga.entity).filter(Boolean));
    return scheda.daImportare(configurazione()).filter((riga) => !gia.has(riga.entity));
  }

  function schedaMarkup() {
    const elenco = righe() || [];
    const lette = scheda.leggi(elenco);
    const mancano = daPrendere();
    return `<div class="ed-intro">${esc(parole.intro)}</div>
    ${scheda.inTesta ? scheda.inTesta() : ""}
    ${
      elenco.length
        ? `<div class="ed-list dm-dich-lista">${elenco
            .map((riga, indice) =>
              rigaMarkup(scheda, riga, indice, lette.get(riga.entity), stato.aperto === indice),
            )
            .join("")}</div>`
        : `<div class="ed-empty">${esc(parole.vuoto)}</div>`
    }
    <button type="button" class="ed-btn-add" data-dm-dich-aggiungi>＋ ${esc(parole.aggiungi)}</button>
    ${
      mancano.length
        ? `<button type="button" class="ed-btn-import" data-dm-dich-prendi>⤓ ${esc(parole.importa(mancano.length))}</button>
          <small class="dm-dich-nota">${esc(parole.notaImporta)}</small>`
        : ""
    }`;
  }

  /* La prima apertura scrive quello che la pagina gia' mostrava: nessuna casa
   * si ritrova la scheda vuota per un aggiornamento. */
  function migraSeServe() {
    if (righeDichiarate(configurazione()) !== null) return false;
    salva(conLeRighe(configurazione(), daPrendere()));
    return true;
  }

  function disegnaScheda() {
    const body = doc?.getElementById("ed-body");
    if (!body || activeTab() !== tab) return false;
    migraSeServe();
    if (body.dataset[marchio] === "true") return false;
    body.dataset[marchio] = "true";
    body.innerHTML = `<div class="dm-dich-scheda" data-dm-dich-sezione="${esc(nome)}">${schedaMarkup()}</div>`;
    return true;
  }

  function disegnaLinguetta() {
    const tabs = doc?.querySelector(".ed-tab")?.parentElement;
    if (!tabs || tabs.querySelector(`.ed-tab[data-tab="${tab}"]`)) return false;
    const linguetta = doc.createElement("button");
    linguetta.className = "ed-tab";
    linguetta.dataset.tab = tab;
    linguetta.textContent = parole.linguetta;
    linguetta.addEventListener("click", () => root.editorSwitch?.(tab));
    const prima = tabs.querySelector('.ed-tab[data-tab="runtime"]');
    if (prima) prima.before(linguetta);
    else tabs.append(linguetta);
    return true;
  }

  /* Quello che la riga aperta ha nelle sue caselle ADESSO, non quello che
   * c'era quando e' stata disegnata: il nome si batte, l'entita' si sceglie
   * dalla lente, e il salvataggio deve prendere l'ultimo stato di tutte e due.
   * L'icona sta in un campo nascosto per la stessa ragione. */
  function bozza(body, indice) {
    const elenco = righe() || [];
    const riga = elenco[indice] || { entity: "", name: "", icon: "" };
    const campo = (quale) =>
      body.querySelector(
        `[data-dm-dich-campo="${quale}"][data-dm-dich-riga="${indice}"]`,
      );
    return {
      entity: clean(campo("entity")?.value ?? riga.entity),
      name: clean(campo("name")?.value ?? riga.name),
      icon: clean(campo("icon")?.value ?? riga.icon) || scheda.ripiego,
    };
  }

  function onClick(event) {
    const body = doc?.getElementById("ed-body");
    if (!body || activeTab() !== tab || !body.contains(event.target)) return;

    const lente = event.target.closest("[data-dm-dich-pick]");
    if (lente) {
      event.preventDefault();
      const campo = body.querySelector(`#${CSS.escape(clean(lente.dataset.dmDichPick))}`);
      if (campo) root.wzPickEntity?.(campo);
      return;
    }

    const icona = event.target.closest("[data-dm-dich-icona]");
    if (icona) {
      event.preventDefault();
      const indice = Number(icona.dataset.dmDichRiga);
      if (!Number.isInteger(indice)) return;
      /* Il disegno si salva insieme a quello che c'e' nelle caselle: se si
       * salvasse da solo, chi ha appena scritto il nome e poi tocca l'icona si
       * vedrebbe tornare il nome di prima al ridisegno. */
      salva(
        conLaRiga(configurazione(), indice, {
          ...bozza(body, indice),
          icon: clean(icona.dataset.dmDichIcona),
        }),
      );
      ridisegna();
      return;
    }

    const apri = event.target.closest("[data-dm-dich-apri]");
    if (apri) {
      event.preventDefault();
      const indice = Number(apri.dataset.dmDichApri);
      /* Chiudendo una riga aperta si tiene quello che c'e' scritto dentro: chi
       * ha battuto il nome e poi tocca la matita non ha detto «butta via», ha
       * detto «ho finito». */
      if (stato.aperto === indice) {
        salva(conLaRiga(configurazione(), indice, bozza(body, indice)));
        stato.aperto = -1;
      } else stato.aperto = indice;
      ridisegna();
      return;
    }

    const elimina = event.target.closest("[data-dm-dich-elimina]");
    if (elimina) {
      event.preventDefault();
      const indice = Number(elimina.dataset.dmDichElimina);
      if (!Number.isInteger(indice)) return;
      salva(senzaLaRiga(configurazione(), indice));
      if (stato.aperto === indice) stato.aperto = -1;
      else if (stato.aperto > indice) stato.aperto -= 1;
      ridisegna();
      return;
    }

    const salvaRiga = event.target.closest("[data-dm-dich-salva]");
    if (salvaRiga) {
      event.preventDefault();
      const indice = Number(salvaRiga.dataset.dmDichSalva);
      if (!Number.isInteger(indice)) return;
      salva(conLaRiga(configurazione(), indice, bozza(body, indice)));
      stato.aperto = -1;
      ridisegna();
      root.edToast?.(parole.salvato);
      return;
    }

    if (event.target.closest("[data-dm-dich-aggiungi]")) {
      event.preventDefault();
      salva(
        conLaRiga(configurazione(), -1, {
          entity: "",
          name: parole.nuovo,
          icon: scheda.ripiego,
        }),
      );
      stato.aperto = (righe() || []).length - 1;
      ridisegna();
      return;
    }

    if (event.target.closest("[data-dm-dich-prendi]")) {
      event.preventDefault();
      const mancano = daPrendere();
      if (!mancano.length) return;
      salva(conLeRighe(configurazione(), mancano));
      ridisegna();
      root.edToast?.(parole.presi(mancano.length));
    }
  }

  function installa() {
    if (!doc || stato.installed) return false;
    stato.installed = true;
    installaStile();
    disegnaLinguetta();
    onEditorRedraw(`__${marchio}`, () => {
      root.queueMicrotask?.(() => {
        disegnaLinguetta();
        disegnaScheda();
      });
    });
    doc.addEventListener("click", onClick);
    scheda.inPiuAllInstallazione?.(doc, { ridisegna, configurazione, salva });
    for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
      root.addEventListener?.(evento, () => {
        root.queueMicrotask?.(() => {
          disegnaLinguetta();
          disegnaScheda();
        });
      });
    return true;
  }

  return { installa, disegnaScheda, disegnaLinguetta, ridisegna, configurazione, righe, salva };
}

/* ── il foglio, uno per tutte ─────────────────────────────────────────────── */

let stileMesso = false;

export function installaStile() {
  if (stileMesso) return false;
  stileMesso = true;
  installStyle(
    "dm-scheda-dichiarata-style",
    `
    #ed-body .dm-dich-scheda{display:grid!important;gap:12px!important}
    #ed-body .dm-dich-lista{display:grid!important;gap:8px!important}
    #ed-body .dm-dich-riga{
      display:block!important;padding:0!important;overflow:hidden!important;
      border-left:4px solid var(--dm-dich,#94a3b8)!important}
    #ed-body .dm-dich-riga[data-dm-dich-stato="male"]{--dm-dich:#dc2626}
    #ed-body .dm-dich-riga[data-dm-dich-stato="bene"]{--dm-dich:#16a34a}
    #ed-body .dm-dich-riga[data-dm-dich-stato="attiva"]{--dm-dich:#2563eb}
    #ed-body .dm-dich-riga[data-dm-dich-stato="muta"]{--dm-dich:#94a3b8}
    #ed-body .dm-dich-riga[data-open="true"]{border-color:#7dd3fc!important}
    #ed-body .dm-dich-testa{display:flex!important;align-items:center!important;gap:10px!important;padding:10px 12px!important}
    /* La riga che non si vede da nessuna parte lo dice con tre righe di testo:
       l'icona va in cima, non a meta' del discorso. */
    #ed-body .dm-dich-testa:has(.dm-dich-muta){align-items:flex-start!important}
    #ed-body .dm-dich-ic{
      display:grid!important;place-items:center!important;flex:0 0 34px!important;
      width:34px!important;height:34px!important;line-height:0!important}
    #ed-body .dm-dich-ic svg{display:block!important;width:34px!important;height:34px!important}
    #ed-body .dm-dich-testo{display:grid!important;gap:3px!important;min-width:0!important}
    #ed-body .dm-dich-testo .ed-row-new{line-height:1.25!important}
    #ed-body .dm-dich-testo .ed-row-old{opacity:.72!important;font-size:11.5px!important;line-height:1.3!important}
    #ed-body .dm-dich-val{flex:0 0 auto!important;font-size:13px!important;font-weight:900!important}
    #ed-body .dm-dich-muta{
      display:block!important;margin-top:3px!important;font-size:11px!important;line-height:1.35!important;
      font-weight:700!important;white-space:normal!important;color:var(--warning-color,#b45309)!important}
    #ed-body .dm-dich-corpo{
      display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:8px!important;
      padding:2px 12px 12px!important;border-top:1px solid var(--card-border,#dbe4ee)!important}
    #ed-body .dm-dich-campo{display:grid!important;gap:4px!important;margin:0!important}
    #ed-body .dm-dich-campo .ed-form-row{display:flex!important;gap:8px!important;min-width:0!important}
    #ed-body .dm-dich-campo .ed-form-row>input{flex:1 1 auto!important;min-width:0!important}
    /* La striscia dei disegni scorre: tredici non ci stanno su un telefono, e
       mandarli a capo farebbe una parete di icone alta quanto la scheda. */
    #ed-body .dm-dich-icone{display:flex!important;gap:7px!important;overflow-x:auto!important;padding:3px 1px 5px!important}
    #ed-body .dm-dich-ico{
      flex:0 0 auto!important;padding:4px!important;line-height:0!important;cursor:pointer!important;
      border:1px solid var(--card-border,#dbe4ee)!important;border-radius:12px!important;
      background:var(--card-bg,#fff)!important}
    #ed-body .dm-dich-ico svg{display:block!important;width:34px!important;height:34px!important}
    #ed-body .dm-dich-ico.dm-on{
      border-color:var(--primary-color,#0ea5e9)!important;
      box-shadow:0 0 0 2px color-mix(in srgb,var(--primary-color,#0ea5e9) 25%,transparent)!important}
    #ed-body .dm-dich-scheda .ed-btn-import{
      display:block!important;width:100%!important;margin-top:8px!important;padding:11px!important;
      border:1px dashed var(--card-border,#dbe4ee)!important;border-radius:12px!important;
      background:transparent!important;color:var(--text-dim,#64748b)!important;font-weight:800!important;
      font-size:11.5px!important;letter-spacing:.4px!important;text-transform:uppercase!important;
      cursor:pointer!important;font-family:inherit!important}
    #ed-body .dm-dich-nota{
      display:block!important;margin-top:7px!important;font-size:11px!important;line-height:1.5!important;
      color:var(--text-dim,#64748b)!important}
    #ed-body .dm-dich-piu{
      border:1px solid var(--card-border,#dbe4ee)!important;border-radius:12px!important;
      padding:9px 11px!important;background:var(--bg-sculpted,#eef2f7)!important}
    #ed-body .dm-dich-piu>summary{font-size:11.5px!important;font-weight:800!important;color:var(--text-dim,#64748b)!important;cursor:pointer!important}
    #ed-body .dm-dich-piu[open]{display:grid!important;gap:8px!important}
    #ed-body .dm-dich-piu>small{display:block!important;font-size:11px!important;line-height:1.5!important;color:var(--text-dim,#64748b)!important;margin:6px 0 2px!important}
    `,
  );
  return true;
}
