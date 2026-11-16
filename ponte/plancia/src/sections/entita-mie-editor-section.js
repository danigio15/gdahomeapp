/* Dove si aggiungono le proprie entità a una scheda qualsiasi (#271).
 *
 * «In alcune schede non è possibile inserire entità o sensori personalizzati.
 * Sarebbe carino avere la possibilità d'aggiungere le entità o sensori
 * personalizzati in ogni scheda del progetto, modificando il nome, icona,
 * stanza di destinazione.»
 *
 * Una scheda sola per tutte le pagine, e non una casella in fondo a ognuna:
 * chi ha tre sensori sparsi fra Energia, Sicurezza e MiniPC li vede e li
 * sposta da qui, invece di cercarsi tre schede diverse per ricordarsi cosa
 * aveva messo dove. La pagina è un campo della voce — la tendina in cima —
 * e cambiarla sposta l'entità di sezione.
 *
 * L'elenco delle pagine si legge dalla barra in basso, non da una tabella
 * scritta qui: così porta i nomi che l'utente ha dato alle sue sezioni, le
 * pagine spente non compaiono, e una sezione nuova entra il giorno in cui
 * nasce senza che nessuno se ne ricordi.
 */
import {
  MASSIMO_PER_SEZIONE,
  TIPO_INTERRUTTORE,
  normalizzaVoce,
  servizioDellInterruttore,
} from "../core/entita-mie.js";
import { CHIAVE_ENTITA_MIE, parolaDelNo, ridisegnaEntitaMie } from "./entita-mie-section.js";
import {
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  righeDelDocumento,
  roomOptionsMarkup,
  root,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ENTITA_MIE_EDITOR__";
const state = (root[KEY] ||= { installed: false, aperta: -1 });

export const ENTITA_MIE_EDITOR_TAB = "entita";

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

/* L'editor lavora sulle righe grezze: una voce appena aggiunta non ha ancora
 * un'entità, e la normalizzazione — che le righe senza entità le scarta — la
 * farebbe sparire prima di poterla compilare. */
function voci() {
  const grezzo = readJson(CHIAVE_ENTITA_MIE, []);
  return Array.isArray(grezzo) ? grezzo : [];
}

function salva(lista) {
  writeJsonIfChanged(CHIAVE_ENTITA_MIE, lista);
  ridisegnaEntitaMie();
}

/* ── quali pagine ci sono ─────────────────────────────────────────────── */

/* Le sezioni che si possono scegliere: quelle che hanno una voce nella barra
 * e una pagina dietro. La configurazione non è fra queste — è il posto da cui
 * si sta guardando, e un sensore lì dentro non lo vedrebbe nessuno. */
export function sezioniDisponibili(scope = doc) {
  const viste = new Set();
  const elenco = [];
  for (const scheda of scope?.querySelectorAll?.("nav.tabs .tab[data-tab]") || []) {
    const tab = clean(scheda.dataset.tab);
    if (!tab || tab === "config" || viste.has(tab)) continue;
    if (!scope.getElementById?.(`page-${tab}`)) continue;
    viste.add(tab);
    elenco.push({ tab, nome: clean(scheda.querySelector(".text")?.textContent) || tab });
  }
  return elenco;
}

function sezioniMarkup(scelta, sezioni) {
  const quale = clean(scelta);
  const righe = sezioni.map(
    (sezione) =>
      `<option value="${esc(sezione.tab)}"${sezione.tab === quale ? " selected" : ""}>${esc(
        sezione.nome,
      )}</option>`,
  );
  /* Una pagina scelta e poi sparita — una sezione propria cancellata, una
   * voce della barra spenta — resta nella tendina: toglierla in silenzio
   * riscriverebbe la scelta dell'utente al primo salvataggio. */
  if (quale && !sezioni.some((sezione) => sezione.tab === quale))
    righe.push(`<option value="${esc(quale)}" selected>${esc(quale)}</option>`);
  return [
    `<option value="">— ${esc(t("Scegli la scheda", "Choose the page"))} —</option>`,
    ...righe,
  ].join("");
}

function nomeDellaSezione(tab, sezioni) {
  const quale = clean(tab);
  if (!quale) return t("nessuna scheda", "no page");
  return sezioni.find((sezione) => sezione.tab === quale)?.nome || quale;
}

/* ── il disegno della scheda ──────────────────────────────────────────── */

const eInterruttore = (voce) => clean(voce?.tipo) === TIPO_INTERRUTTORE;

/* La tendina del genere: un'entità che c'è già, o un interruttore fatto a
 * mano (#406). Cambiarla ridisegna la riga coi campi dell'altro genere, e
 * quelli scritti prima restano nella voce: chi torna indietro li ritrova. */
function tipoMarkup(voce) {
  const interruttore = eInterruttore(voce);
  return `<label class="ed-slot dm-mia-ent-campo"><span class="ed-slot-lbl">${esc(
    t("Che cos'è", "What it is"),
  )}</span><span class="ed-form-row"><select class="ed-input" data-mia-ent-campo="tipo"
    data-mia-ent-tipo><option value=""${interruttore ? "" : " selected"}>${esc(
      t("Un'entità di Home Assistant", "A Home Assistant entity"),
    )}</option><option value="${TIPO_INTERRUTTORE}"${interruttore ? " selected" : ""}>${esc(
      t("Un interruttore fatto da te", "A switch you make"),
    )}</option></select></span></label>`;
}

/* Una casella con la lente accanto, per scegliere l'entità dall'elenco. */
function campoEntita(id, campo, valore, etichetta, segnaposto) {
  return `<label class="ed-slot dm-mia-ent-campo"><span class="ed-slot-lbl">${esc(
    etichetta,
  )}</span><span class="ed-form-row"><input id="${id}" class="ed-input mono"
    data-mia-ent-campo="${campo}" value="${esc(clean(valore))}" placeholder="${esc(segnaposto)}"
    autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker"
    data-mia-ent-pick="${id}" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span></label>`;
}

/* Una metà dell'interruttore: il servizio, l'entità che comanda, i dati.
 *
 * Il servizio NON ha la classe `mono` e il suo esempio non comincia con un
 * dominio di quelli che la guardia delle lenti riconosce
 * (`entity-picker-guard-section.js`): «script.turn_on» ha la forma di
 * un'entità, e la casella diventava una tendina di entità in cui un servizio
 * non si poteva scrivere. Il carattere a spaziatura fissa lo dà la sua
 * classe. */
function metaMarkup(voce, id, verso, titolo, spiega) {
  const dati = voce?.[`${verso}_dati`];
  const scritti = dati && typeof dati === "object" ? JSON.stringify(dati) : clean(dati);
  return `<fieldset class="dm-mia-int-meta" data-mia-int-verso="${verso}">
    <legend>${esc(titolo)}</legend>
    <div class="ed-intro dm-mia-int-spiega">${esc(spiega)}</div>
    <label class="ed-slot dm-mia-ent-campo"><span class="ed-slot-lbl">${esc(
      t("Servizio", "Service"),
    )}</span><span class="ed-form-row"><input class="ed-input dm-mia-int-servizio"
      data-mia-ent-campo="${verso}_servizio" value="${esc(clean(voce?.[`${verso}_servizio`]))}"
      placeholder="homeassistant.turn_on"
      autocomplete="off" spellcheck="false"></span></label>
    ${campoEntita(
      `${id}-${verso}`,
      `${verso}_entity`,
      Array.isArray(voce?.[`${verso}_entity`])
        ? voce[`${verso}_entity`].join(", ")
        : voce?.[`${verso}_entity`],
      t("Entità da comandare", "Entity to control"),
      verso === "spegni" ? "script.spegni_pompa" : "script.accendi_pompa",
    )}
    <label class="ed-slot dm-mia-ent-campo"><span class="ed-slot-lbl">${esc(
      t("Dati del servizio (JSON, facoltativo)", "Service data (JSON, optional)"),
    )}</span><span class="ed-form-row"><textarea class="ed-input mono dm-mia-int-dati" rows="2"
      data-mia-ent-campo="${verso}_dati" placeholder='{"brightness_pct": 60}'
      spellcheck="false">${esc(scritti)}</textarea></span></label>
  </fieldset>`;
}

function campiInterruttoreMarkup(voce, id) {
  return `${metaMarkup(
    voce,
    id,
    "accendi",
    t("All'accensione", "When switched on"),
    t(
      "Il servizio di Home Assistant da chiamare, e l'entità su cui. Basta anche solo l'entità: uno script o una scena partono, un'automazione si esegue, un pulsante si preme.",
      "The Home Assistant service to call, and on which entity. The entity alone is enough too: a script or a scene starts, an automation runs, a button is pressed.",
    ),
  )}
    ${metaMarkup(
      voce,
      id,
      "spegni",
      t("Allo spegnimento (facoltativo)", "When switched off (optional)"),
      t(
        "Se lo lasci vuoto, ogni tocco fa l'accensione.",
        "If you leave it empty, every tap does the switch-on.",
      ),
    )}
    <fieldset class="dm-mia-int-meta">
      <legend>${esc(t("Lo stato", "The state"))}</legend>
      <div class="ed-intro dm-mia-int-spiega">${esc(
        t(
          "L'entità che dice se è acceso, e quale valore vuol dire «acceso». Senza entità è un tasto a impulso.",
          "The entity that says whether it is on, and which value means «on». Without an entity it is a push button.",
        ),
      )}</div>
      ${campoEntita(
        id,
        "entity",
        voce?.entity,
        t("Entità che dice lo stato", "Entity that tells the state"),
        "input_boolean.pompa",
      )}
      <label class="ed-slot dm-mia-ent-campo"><span class="ed-slot-lbl">${esc(
        t("Acceso quando vale", "On when it reads"),
      )}</span><span class="ed-form-row"><input class="ed-input mono"
        data-mia-ent-campo="acceso_se" value="${esc(clean(voce?.acceso_se))}" placeholder="on"
        autocomplete="off" spellcheck="false"></span></label>
    </fieldset>`;
}

function campiEntitaMarkup(voce, id) {
  return `${campoEntita(id, "entity", voce?.entity, t("Entità", "Entity"), "sensor.qualcosa")}
      <label class="ed-slot dm-mia-ent-campo"><span class="ed-slot-lbl">${esc(
        t("Stanza", "Room"),
      )}</span><span class="ed-form-row"><select id="${id}-room" class="ed-input"
        data-mia-ent-campo="room_id">${roomOptionsMarkup(
          clean(voce?.room_id),
          t("Nessuna stanza", "No room"),
        )}</select></span></label>`;
}

function rigaMarkup(voce, indice, sezioni, troppe) {
  const aperta = state.aperta === indice;
  const id = `dm-mia-ent-${indice}`;
  const interruttore = eInterruttore(voce);
  const nome =
    clean(voce?.nome) ||
    clean(voce?.entity) ||
    (interruttore ? t("Interruttore nuovo", "New switch") : t("Entità nuova", "New entity"));
  return `<article class="ed-row dm-todo-ed-row dm-mia-ent-riga" data-mia-ent="${indice}" data-open="${aperta}">
    <div class="dm-todo-ed-head">
      <span class="dm-todo-ed-icon" aria-hidden="true">${esc(clean(voce?.icona) || "⭐")}</span>
      <span class="ed-row-main">
        <strong class="ed-row-new">${esc(nome)}</strong>
        <small class="ed-row-old">${
          interruttore ? `${esc(t("Interruttore", "Switch"))} · ` : ""
        }${esc(nomeDellaSezione(voce?.sezione, sezioni))}${
          troppe ? ` · ${esc(t("oltre il limite", "over the limit"))}` : ""
        }</small>
      </span>
      <button type="button" class="ed-del dm-todo-ed-edit" data-mia-ent-edit
        aria-label="${esc(t("Modifica", "Edit"))}">✏️</button>
      <button type="button" class="ed-del dm-todo-ed-del" data-mia-ent-del
        aria-label="${esc(t("Elimina", "Remove"))}">🗑️</button>
    </div>
    <div class="dm-todo-ed-body"${aperta ? "" : " hidden"}>
      ${tipoMarkup(voce)}
      <label class="ed-slot dm-mia-ent-campo"><span class="ed-slot-lbl">${esc(
        t("In quale scheda", "On which page"),
      )}</span><span class="ed-form-row"><select id="${id}-sez" class="ed-input"
        data-mia-ent-campo="sezione">${sezioniMarkup(voce?.sezione, sezioni)}</select></span></label>
      <div class="dm-mia-ent-testa">
        <input class="ed-input dm-mia-ent-icona" data-mia-ent-campo="icona"
          value="${esc(clean(voce?.icona))}" placeholder="⭐"
          aria-label="${esc(t("Icona", "Icon"))}" maxlength="4">
        <input class="ed-input" data-mia-ent-campo="nome" value="${esc(clean(voce?.nome))}"
          placeholder="${esc(t("Nome (facoltativo)", "Name (optional)"))}">
      </div>
      ${interruttore ? campiInterruttoreMarkup(voce, id) : campiEntitaMarkup(voce, id)}
      <button type="button" class="ed-save-btn" data-mia-ent-save>💾 ${esc(
        interruttore ? t("Salva interruttore", "Save switch") : t("Salva entità", "Save entity"),
      )}</button>
    </div>
  </article>`;
}

/* Quante voci ha già ogni scheda: serve a dire quali sono oltre il tetto, e a
 * dirlo sulla riga che ci finisce sopra invece che in fondo alla scheda. */
function oltreIlTetto(lista) {
  const conto = new Map();
  const troppe = new Set();
  lista.forEach((voce, indice) => {
    const sezione = clean(voce?.sezione);
    if (!sezione) return;
    if (eInterruttore(voce)) {
      const pronta = normalizzaVoce(voce, indice).accendi;
      if (!pronta.servizio && !pronta.entity) return;
    } else if (!clean(voce?.entity)) return;
    const quante = (conto.get(sezione) || 0) + 1;
    conto.set(sezione, quante);
    if (quante > MASSIMO_PER_SEZIONE) troppe.add(indice);
  });
  return troppe;
}

function corpoMarkup() {
  const lista = voci();
  const sezioni = sezioniDisponibili();
  const troppe = oltreIlTetto(lista);
  return `<div class="dm-mia-ent-ed">
  <div class="ed-sec-title">⭐ ${esc(t("Le tue entità", "Your own entities"))}</div>
  <div class="ed-intro">${esc(
    t(
      "Alcune schede sono elenchi — Luci, Prese, Telecamere — e lì un'entità in più si è sempre potuta aggiungere. Altre sono fatte di caselle con un ruolo preciso: l'Energia ha una rete e un fotovoltaico, la Sicurezza una centrale, e per un sensore in più non c'era posto. Qui c'è: scegli l'entità, in quale scheda farla comparire, come chiamarla e con che icona. Compare in fondo alla pagina che scegli, e quelle che si accendono si accendono.",
      "Some pages are lists — Lights, Sockets, Cameras — and there you could always add one more entity. Others are made of boxes with a set role: Energy has a grid and a solar array, Security an alarm panel, and there was no place for one more sensor. Here there is: pick the entity, which page it should appear on, what to call it and with which icon. It shows up at the bottom of the page you choose, and the ones that switch, switch.",
    ),
  )}</div>
  <div class="ed-list dm-todo-ed-list">${
    lista.length
      ? lista.map((voce, indice) => rigaMarkup(voce, indice, sezioni, troppe.has(indice))).join("")
      : `<div class="ed-empty">${esc(
          t("Nessuna entità aggiunta.", "No entities added yet."),
        )}</div>`
  }</div>
  ${
    troppe.size
      ? `<div class="dm-mia-ent-pieno">${esc(
          t(
            "Su una scheda ne compaiono al massimo dodici: oltre non è più «qualcosa in più», è un elenco — e per quello c'è «Le tue sezioni».",
            "At most twelve show up on one page: past that it is not «one more thing» any more, it is a list — and for that there is «Your sections».",
          ),
        )}</div>`
      : ""
  }
  <button type="button" class="ed-btn-add" data-mia-ent-add>＋ ${esc(
    t("Aggiungi entità", "Add entity"),
  )}</button>
  <button type="button" class="ed-btn-add" data-mia-ent-add="${TIPO_INTERRUTTORE}">＋ ${esc(
    t("Aggiungi interruttore", "Add switch"),
  )}</button>
  </div>`;
}

export function ensureEntitaMieEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== ENTITA_MIE_EDITOR_TAB) return false;
  const firma = `${JSON.stringify(voci())}|${state.aperta}|${sezioniDisponibili()
    .map((sezione) => sezione.tab)
    .join(",")}`;
  if (body.dataset.dmEntitaMie === firma && body.querySelector(".dm-mia-ent-ed")) return true;
  body.dataset.dmEntitaMie = firma;
  body.innerHTML = corpoMarkup();
  body.dataset.renderer = ENTITA_MIE_EDITOR_TAB;
  return true;
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmEntitaMie;
  ensureEntitaMieEditor();
}

/* Quello che c'è scritto adesso nella riga, letto dal documento: si salva
 * quello che si vede, non quello che era scritto quando la scheda è stata
 * disegnata. */
function leggiLaRiga(riga) {
  const letto = { ...(voci()[Number(riga.dataset.miaEnt)] || {}) };
  for (const campo of riga.querySelectorAll("[data-mia-ent-campo]"))
    letto[clean(campo.dataset.miaEntCampo)] = clean(campo.value);
  if (!clean(letto.id)) letto.id = `mia-${Date.now().toString(36)}`;
  /* Una voce che è un'entità resta scritta com'era: senza un `tipo` vuoto in
   * più, che non dice niente. */
  if (!clean(letto.tipo)) delete letto.tipo;
  return letto;
}

/* Il primo no che le due metà di un interruttore direbbero al tocco, detto
 * subito al salvataggio: un tasto che non parte va saputo qui, non in pagina.
 * Lo spegnimento vuoto non è un no: vuol dire «ogni tocco accende». */
export function nonSiSalvaPerche(voce) {
  if (!eInterruttore(voce)) return "";
  const pronta = normalizzaVoce(voce);
  const accendi = servizioDellInterruttore(pronta.accendi, "accendi");
  if (!accendi.ok) return accendi.perche;
  if (pronta.spegni.servizio || pronta.spegni.entity || clean(pronta.spegni.dati)) {
    const spegni = servizioDellInterruttore(pronta.spegni, "spegni");
    if (!spegni.ok) return spegni.perche;
  }
  return "";
}

/* Tutte le righe della scheda come sono adesso nel documento.
 *
 * Il tasto «Salva sezione» in fondo alla configurazione preme il salvataggio
 * di ogni riga una dopo l'altra: il primo scrive e ridisegna, e il ridisegno
 * stacca gli altri bottoni dal documento. Chi scrive per primo, quindi, scrive
 * per tutti — vedi `righeDelDocumento`. */
function righeDalDocumento(body) {
  /* Un interruttore che non partirebbe resta com'era scritto: chi scrive per
   * tutti non deve far passare dalla porta di servizio quello che il suo tasto
   * ha rifiutato (#406). */
  const siTiene = (bozza) => !nonSiSalvaPerche(bozza);
  return righeDelDocumento(body, "data-mia-ent", voci(), (riga) => leggiLaRiga(riga), siTiene);
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== ENTITA_MIE_EDITOR_TAB || !body.contains(event.target)) return;

  const aggiungi = event.target.closest("[data-mia-ent-add]");
  if (aggiungi) {
    event.preventDefault();
    const interruttore = clean(aggiungi.dataset.miaEntAdd) === TIPO_INTERRUTTORE;
    const lista = voci().slice();
    /* La scheda che si sta guardando è quella più probabile: chi apre la
     * configurazione dalla Sicurezza sta aggiungendo un sensore alla
     * Sicurezza. Resta una tendina, e si cambia. */
    const dove = clean(doc?.querySelector?.(".page.active")?.id).replace(/^page-/, "");
    const sezione = dove && dove !== "config" ? dove : "";
    lista.push(
      interruttore
        ? {
            id: `mia-${Date.now().toString(36)}`,
            tipo: TIPO_INTERRUTTORE,
            entity: "",
            nome: "",
            icona: "🔘",
            sezione,
            acceso_se: "on",
            accendi_servizio: "",
            accendi_entity: "",
            accendi_dati: "",
            spegni_servizio: "",
            spegni_entity: "",
            spegni_dati: "",
          }
        : {
            id: `mia-${Date.now().toString(36)}`,
            entity: "",
            nome: "",
            icona: "⭐",
            sezione,
            room_id: "",
          },
    );
    state.aperta = lista.length - 1;
    salva(lista);
    ridisegna();
    return;
  }

  const riga = event.target.closest("[data-mia-ent]");
  if (!riga) return;
  const indice = Number(riga.dataset.miaEnt);

  const pick = event.target.closest("[data-mia-ent-pick]");
  if (pick) {
    event.preventDefault();
    const input = body.querySelector(`#${CSS.escape(clean(pick.dataset.miaEntPick))}`);
    if (input) root.wzPickEntity?.(input);
    return;
  }

  if (event.target.closest("[data-mia-ent-edit]")) {
    event.preventDefault();
    state.aperta = state.aperta === indice ? -1 : indice;
    ridisegna();
    return;
  }

  if (event.target.closest("[data-mia-ent-del]")) {
    event.preventDefault();
    const lista = voci().slice();
    lista.splice(indice, 1);
    state.aperta = -1;
    salva(lista);
    ridisegna();
    return;
  }

  if (event.target.closest("[data-mia-ent-save]")) {
    event.preventDefault();
    const letta = leggiLaRiga(riga);
    const no = nonSiSalvaPerche(letta);
    if (no) {
      root.edToast?.(`⚠️ ${parolaDelNo(no)}`);
      return;
    }
    const lista = righeDalDocumento(body);
    lista[indice] = letta;
    salva(lista);
    ridisegna();
    root.edToast?.(
      eInterruttore(letta)
        ? t("💾 Interruttore salvato", "💾 Switch saved")
        : t("💾 Entità salvata", "💾 Entity saved"),
    );
  }
}

/* Il genere cambiato dalla tendina: si tiene quello che è scritto nella riga
 * e la si ridisegna coi campi dell'altro genere. */
function onChange(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== ENTITA_MIE_EDITOR_TAB || !body.contains(event.target)) return;
  if (!event.target.closest("[data-mia-ent-tipo]")) return;
  const riga = event.target.closest("[data-mia-ent]");
  if (!riga) return;
  const indice = Number(riga.dataset.miaEnt);
  const lista = righeDalDocumento(body);
  const letta = leggiLaRiga(riga);
  if (eInterruttore(letta)) {
    letta.room_id = "";
    if (!clean(letta.acceso_se)) letta.acceso_se = "on";
  }
  lista[indice] = letta;
  state.aperta = indice;
  salva(lista);
  ridisegna();
}

export function ensureEntitaMieTab() {
  const linguette = doc?.querySelector(".ed-tab")?.parentElement;
  if (!linguette || linguette.querySelector(`.ed-tab[data-tab="${ENTITA_MIE_EDITOR_TAB}"]`))
    return false;
  const linguetta = doc.createElement("button");
  linguetta.className = "ed-tab";
  linguetta.dataset.tab = ENTITA_MIE_EDITOR_TAB;
  linguetta.textContent = `⭐ ${t("Le tue entità", "Your own entities")}`;
  linguetta.addEventListener("click", () => root.editorSwitch?.(ENTITA_MIE_EDITOR_TAB));
  /* Accanto a «Le tue sezioni», che è la sua parente stretta: una è
   * un'entità in più su una pagina che c'è, l'altra è una pagina nuova. */
  const vicina =
    linguette.querySelector('.ed-tab[data-tab="mie"]')?.nextSibling ||
    linguette.querySelector('.ed-tab[data-tab="runtime"]');
  if (vicina) linguette.insertBefore(linguetta, vicina);
  else linguette.append(linguetta);
  return true;
}

function installStyles() {
  installStyle(
    "dm-entita-mie-editor",
    `
      #ed-body .dm-mia-ent-testa{display:grid;grid-template-columns:64px minmax(0,1fr);gap:8px;margin:10px 0}
      #ed-body .dm-mia-ent-icona{text-align:center;font-size:18px}
      #ed-body .dm-mia-ent-campo{margin:0 0 10px}
      #ed-body .dm-mia-ent-pieno{margin:10px 2px 0;opacity:.75}
      #ed-body .dm-mia-int-meta{
        margin:0 0 12px;padding:10px 12px 2px;border:1px solid var(--card-border,#e2e8f0);
        border-radius:14px}
      #ed-body .dm-mia-int-meta legend{padding:0 6px;font-weight:800;font-size:13px}
      #ed-body .dm-mia-int-spiega{margin:0 0 10px;font-size:12px}
      #ed-body .dm-mia-int-servizio{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
      #ed-body .dm-mia-int-dati{min-height:44px;resize:vertical;width:100%;font-size:12px}
      /* Nome e scheda incolonnati, come nelle altre liste della
         configurazione: affiancati, il nome di una pagina lunga finiva
         sempre coi puntini. */
      #ed-body .dm-mia-ent-riga .ed-row-main{display:block;min-width:0}
      #ed-body .dm-mia-ent-riga .ed-row-new,
      #ed-body .dm-mia-ent-riga .ed-row-old{display:block;overflow:hidden;text-overflow:ellipsis}
      #ed-body .dm-mia-ent-riga .ed-row-old{margin-top:3px;color:var(--text-dim,#64748b)}
      @media(max-width:560px){
        #ed-body .dm-mia-ent-testa{grid-template-columns:52px minmax(0,1fr);gap:6px}
      }
    `,
  );
}

export function installEntitaMieEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  doc.addEventListener("change", onChange);
  /* La linguetta si mette appena il pannello nasce, non al primo ridisegno:
   * chi apre la configurazione e chiede subito questa scheda la troverebbe
   * altrimenti assente. */
  wrapFunction("apriConfigEntita", "__dmEntitaMieEditor", () => {
    ensureEntitaMieTab();
    ensureEntitaMieEditor();
  });
  ensureEntitaMieTab();
  onEditorRedraw("__dmEntitaMieEditor", () => {
    root.queueMicrotask?.(() => {
      ensureEntitaMieTab();
      ensureEntitaMieEditor();
    });
  });
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => {
        ensureEntitaMieTab();
        ensureEntitaMieEditor();
      });
    });
  ensureEntitaMieEditor();
  return true;
}
