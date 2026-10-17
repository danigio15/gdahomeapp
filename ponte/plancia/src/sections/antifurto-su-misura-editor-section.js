/* I tasti d'inserimento per chi una centrale non ce l'ha (#413).
 *
 * «Possibilita' di configurare i comandi di inserimento e modalita' sia nel
 * comando da lanciare che nel nome icona. Utilizzando un dispositivo tramite
 * esphome non ho il classico control_panel_alarm.»
 *
 * La fila della Sicurezza la disegna la centrale: `supported_features` dice
 * quali inserimenti accetta, e i tasti chiamano i servizi di
 * `alarm_control_panel`. Chi l'antifurto se l'e' fatto con ESPHome quell'entita'
 * non ce l'ha — ha uno script che inserisce, un `input_select` con le modalita',
 * un paio di `switch` — e la fila restava quella finta di ripiego, con due tasti
 * che chiamavano servizi inesistenti.
 *
 * Qui i tasti li scrive chi ha la casa: un nome, un'icona del catalogo, l'entita'
 * da chiamare e — se serve — dove leggere se quella modalita' e' inserita adesso.
 * Il blocco sta sotto la casella della centrale, nella scheda Sicurezza, accanto
 * a quello delle modalita' da mostrare; la regola di cosa fanno sta in
 * `core/antifurto-su-misura.js`, qui c'e' solo il modo di dirla.
 */
import {
  CASELLA_DELLO_SCATTATO,
  CHIAVE_ANTIFURTO_SCATTATO,
  CHIAVE_ANTIFURTO_SU_MISURA,
  eScattatoAdesso,
  normalizzaModoSuMisura,
  normalizzaScattato,
  sirenaAccesa,
  vuoleUnOpzione,
  zonaDelloScattato,
} from "../core/antifurto-su-misura.js";
import { normalizzaIlCodice } from "../core/codice-a-tastierino.js";
import { casellaDellaCentrale } from "./alarm-modes-editor-section.js";
import { openIconPicker } from "./icon-engine-section.js";
import {
  allStates,
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

const KEY = "__DASHBOARDMODERN_ANTIFURTO_SU_MISURA_EDITOR__";
const STYLE_ID = "dm-antifurto-su-misura-style";
const BLOCK_ID = "dm-antifurto-su-misura";
const state = (root[KEY] ||= { installed: false });

const ICONA_DI_SERIE = "mdi:shield-home";

/* Le righe come stanno scritte, senza toglierne nessuna: una riga appena
 * aggiunta e' vuota, e la normalizzazione — che scarta chi non ha un'entita' —
 * la farebbe sparire prima di poterla compilare. A scartare pensa chi legge per
 * disegnare la fila. */
function grezze() {
  const stored = readJson(CHIAVE_ANTIFURTO_SU_MISURA, []);
  return Array.isArray(stored) ? stored : [];
}

function salva(modi) {
  writeJsonIfChanged(CHIAVE_ANTIFURTO_SU_MISURA, modi);
  try {
    root.renderSecurity?.();
    root.render?.();
  } catch (_error) {}
}

function nomeDi(modo, indice) {
  return clean(modo?.nome) || clean(modo?.entita) || `${t("Tasto", "Button")} ${indice + 1}`;
}

function rigaMarkup(modo, indice) {
  const entita = clean(modo?.entita);
  const buona = Boolean(normalizzaModoSuMisura(modo, indice));
  return `<article class="ed-row dm-suo-row" data-suo-index="${indice}">
    <div class="dm-suo-head">
      <strong class="ed-row-new">${esc(nomeDi(modo, indice))}</strong>
      <button type="button" class="ed-del" data-suo-del aria-label="${esc(t("Elimina", "Remove"))}">🗑️</button>
    </div>
    <label class="ed-slot"><span class="ed-slot-lbl">${esc(t("Nome del tasto", "Button name"))}</span>
      <span class="ed-form-row"><input id="dm-suo-${indice}-nome" class="ed-input" data-suo-field="nome"
        value="${esc(clean(modo?.nome))}" placeholder="${esc(t("Fuori casa", "Away"))}"></span></label>
    <label class="ed-slot"><span class="ed-slot-lbl">${esc(t("Icona", "Icon"))}</span>
      <span class="ed-form-row"><input id="dm-suo-${indice}-icona" class="ed-input" data-suo-field="icona"
        value="${esc(clean(modo?.icona) || ICONA_DI_SERIE)}" maxlength="40"><button type="button"
        class="dm-suo-icona" data-suo-icona="dm-suo-${indice}-icona"
        aria-label="${esc(t("Scegli icona", "Choose icon"))}">🎨</button></span></label>
    <label class="ed-slot"><span class="ed-slot-lbl">${esc(t("Cosa premere", "What to press"))}</span>
      <span class="ed-form-row"><input id="dm-suo-${indice}-entita" class="ed-input mono" data-suo-field="entita"
        value="${esc(entita)}" placeholder="script.inserisci_antifurto" autocomplete="off"
        spellcheck="false"><button type="button" class="dm-entity-picker" data-suo-pick="dm-suo-${indice}-entita"
        aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span>
      <small>${esc(
        t(
          "Lo script, la scena, il pulsante, l'interruttore o l'elenco che inserisce: il servizio giusto lo sceglie la plancia dal dominio dell'entità.",
          "The script, scene, button, switch or select that arms it: the dashboard picks the right service from the entity domain.",
        ),
      )}</small></label>
    ${
      vuoleUnOpzione(entita)
        ? `<label class="ed-slot"><span class="ed-slot-lbl">${esc(t("Quale voce dell'elenco", "Which option"))}</span>
      <span class="ed-form-row"><input id="dm-suo-${indice}-opzione" class="ed-input" data-suo-field="opzione"
        value="${esc(clean(modo?.opzione))}" placeholder="${esc(t("Fuori casa", "Away"))}"></span>
      <small>${esc(t("Scritta come Home Assistant la elenca, lettera per lettera.", "Spelled the way Home Assistant lists it, letter for letter."))}</small></label>`
        : ""
    }
    <label class="ed-slot"><span class="ed-slot-lbl">${esc(t("Dove si legge se è inserito", "Where to read if it is armed"))}</span>
      <span class="ed-form-row"><input id="dm-suo-${indice}-stato" class="ed-input mono" data-suo-field="stato"
        value="${esc(clean(modo?.stato))}" placeholder="${esc(entita || "sensor.antifurto")}" autocomplete="off"
        spellcheck="false"><button type="button" class="dm-entity-picker" data-suo-pick="dm-suo-${indice}-stato"
        aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span></label>
    <label class="ed-slot"><span class="ed-slot-lbl">${esc(t("Il valore che vuol dire «inserito»", "The value that means “armed”"))}</span>
      <span class="ed-form-row"><input id="dm-suo-${indice}-valore" class="ed-input" data-suo-field="valore"
        value="${esc(clean(modo?.valore))}" placeholder="on"></span>
      <small>${esc(
        t(
          "Vuoto vuol dire «on». Senza questo il tasto funziona lo stesso: semplicemente non resta acceso.",
          "Empty means “on”. Without it the button still works: it simply does not stay lit.",
        ),
      )}</small></label>
    <label class="ed-slot"><span class="ed-slot-lbl">${esc(t("PIN (facoltativo)", "PIN (optional)"))}</span>
      <span class="ed-form-row"><input id="dm-suo-${indice}-pin" class="ed-input mono" data-suo-field="pin"
        value="${esc(clean(modo?.pin))}" inputmode="numeric" autocomplete="off" placeholder="1234"></span>
      <small>${esc(
        t(
          "Scritto, il tasto apre il tastierino e parte solo col codice giusto — lo stesso tastierino della centrale. Vuoto, parte al tocco.",
          "When set, the button opens the keypad and only fires with the right code — the same keypad as the panel. Empty, it fires on tap.",
        ),
      )}</small>
      ${
        clean(modo?.pin) && !normalizzaIlCodice(modo?.pin)
          ? `<output class="dm-suo-muto">${esc(t("Il PIN è di 4-8 cifre.", "The PIN is 4-8 digits."))}</output>`
          : ""
      }</label>
    ${
      buona
        ? ""
        : `<output class="dm-suo-muto">${esc(
            t(
              "Finché non scegli cosa premere questo tasto non compare.",
              "Until you pick what to press this button does not appear.",
            ),
          )}</output>`
    }
    <button type="button" class="ed-save-btn" data-suo-save>💾 ${esc(t("Salva il tasto", "Save the button"))}</button>
  </article>`;
}

/* ─── Quando e' scattato ─────────────────────────────────────────────────
 *
 * «Prevedi un'entità per inserire allarme antifurto, ho uno switch che mi
 * controlla se è scattato antifurto.» La riga sta in cima al blocco: e' la
 * prima domanda — se suona, come lo so — e i tasti vengono dopo. */

function scattatoSalvato() {
  const grezzo = readJson(CHIAVE_ANTIFURTO_SCATTATO, {});
  return grezzo && typeof grezzo === "object" && !Array.isArray(grezzo) ? grezzo : {};
}

/* La casella storica, per chi l'aveva mappata nella plancia di prima. */
function casellaStorica() {
  const caselle = readJson("cd_entity_overrides", {}) || {};
  return clean(caselle[CASELLA_DELLO_SCATTATO]);
}

function adessoMarkup(grezzo) {
  const scattato = normalizzaScattato(grezzo, casellaStorica());
  if (!scattato) return "";
  let stati = {};
  try {
    stati = allStates() || {};
  } catch (_error) {
    stati = {};
  }
  const suona = eScattatoAdesso(scattato, stati);
  const pezzi = [
    suona ? t("scattato", "triggered") : t("a riposo", "at rest"),
  ];
  if (suona) {
    const zona = zonaDelloScattato(scattato, stati);
    if (zona) pezzi.push(`${t("zona", "zone")} «${zona}»`);
  }
  if (scattato.sirena)
    pezzi.push(sirenaAccesa(scattato, stati) ? t("sirena accesa", "siren on") : t("sirena spenta", "siren off"));
  return `<output class="dm-scat-adesso${suona ? " is-on" : ""}"><span class="dm-scat-punto"></span>${esc(
    t("Adesso", "Now"),
  )}: ${esc(pezzi.join(" · "))}</output>`;
}

function scattatoMarkup() {
  const salvato = scattatoSalvato();
  const entita = clean(salvato.entita) || casellaStorica();
  const campo = (id, chiave, valore, segnaposto, picker = true) => `<span class="ed-form-row"><input
        id="${id}" class="ed-input mono" data-scat-field="${chiave}" value="${esc(valore)}"
        placeholder="${esc(segnaposto)}" autocomplete="off" spellcheck="false">${
          picker
            ? `<button type="button" class="dm-entity-picker" data-scat-pick="${id}"
        aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button>`
            : ""
        }</span>`;
  return `<section class="dm-scat" id="dm-antifurto-scattato">
    <div class="dm-scat-testa"><span class="dm-scat-titolo">🚨 ${esc(t("Quando è scattato", "When it is triggered"))}</span>
      <span class="dm-scat-nuovo">${esc(t("NUOVO", "NEW"))}</span></div>
    <p class="ed-intro dm-scat-intro">${esc(
      t(
        "L'entità che dice che l'antifurto sta suonando: un interruttore, un sensore o un aiutante. Quando vale «scattato» la Sicurezza, la tessera della Home e il pannello a muro diventano rossi, e la casa manda la notifica urgente.",
        "The entity that says the alarm is going off: a switch, a sensor or a helper. When it reads “triggered” Security, the Home tile and the wall panel turn red, and the house sends the urgent notification.",
      ),
    )}</p>
    <div class="dm-scat-griglia">
      <label class="ed-slot"><span class="ed-slot-lbl">${esc(t("Dove si legge se è scattato", "Where to read if it is triggered"))}</span>
        ${campo("dm-scat-entita", "entita", entita, "switch.antifurto_scattato")}</label>
      <label class="ed-slot"><span class="ed-slot-lbl">${esc(t("Il valore che vuol dire «scattato»", "The value that means “triggered”"))}</span>
        ${campo("dm-scat-valore", "valore", clean(salvato.valore), "on", false)}
        <small>${esc(t("Vuoto vuol dire «on».", "Empty means “on”."))}</small></label>
      <label class="ed-slot"><span class="ed-slot-lbl">${esc(t("Sirena (facoltativa)", "Siren (optional)"))}</span>
        ${campo("dm-scat-sirena", "sirena", clean(salvato.sirena), "switch.sirena")}
        <small>${esc(t("Per il tasto «Spegni sirena» nella notifica e nella Sicurezza.", "For the “Siren off” button in the notification and in Security."))}</small></label>
      <label class="ed-slot"><span class="ed-slot-lbl">${esc(t("Che cosa l'ha fatto scattare (facoltativo)", "What set it off (optional)"))}</span>
        ${campo("dm-scat-zona", "zona", clean(salvato.zona), "sensor.antifurto_zona")}
        <small>${esc(
          t(
            "Un sensore che dice la zona. Vuoto: la casa guarda quale porta, finestra o movimento si è acceso per ultimo.",
            "A sensor that names the zone. Empty: the house looks at which door, window or motion turned on last.",
          ),
        )}</small></label>
    </div>
    ${adessoMarkup({ ...salvato, entita })}
    <button type="button" class="ed-save-btn" data-scat-save>💾 ${esc(t("Salva", "Save"))}</button>
  </section>`;
}

function salvaLoScattato(blocco) {
  const letto = {};
  for (const campo of blocco.querySelectorAll("[data-scat-field]"))
    letto[clean(campo.dataset.scatField)] = clean(campo.value);
  const prima = scattatoSalvato();
  const buono = normalizzaScattato(letto);
  writeJsonIfChanged(CHIAVE_ANTIFURTO_SCATTATO, buono ? { ...buono } : {});
  /* La casella storica dice la stessa cosa, per la plancia di prima e per
   * chi la legge ancora. Si toglie solo se era quella che si e' tolta qui. */
  const caselle = readJson("cd_entity_overrides", {}) || {};
  const prossime = { ...caselle };
  if (buono) prossime[CASELLA_DELLO_SCATTATO] = buono.entita;
  else if (clean(caselle[CASELLA_DELLO_SCATTATO]) === clean(prima.entita))
    delete prossime[CASELLA_DELLO_SCATTATO];
  writeJsonIfChanged("cd_entity_overrides", prossime);
  try {
    root.cdApplyCanonicalOverrides?.(prossime);
    root.renderSecurity?.();
    root.render?.();
  } catch (_error) {}
  return Boolean(buono);
}

function markup(modi) {
  return `${scattatoMarkup()}<div class="ed-slot-lbl dm-suo-titolo">${esc(t("Tasti d'inserimento su misura", "Custom arming buttons"))}</div>
  <p class="ed-intro dm-suo-intro">${esc(
    t(
      "Serve a chi una centrale non ce l'ha: un antifurto fatto con ESPHome, con gli script o con un elenco di modalità. Ogni tasto qui sotto compare nella sezione Sicurezza e nella tessera della Home, accanto a quelli della centrale — e se una centrale non c'è, al posto loro.",
      "For those without a panel: an alarm built with ESPHome, with scripts or with a list of modes. Each button below shows up in the Security section and on the Home tile, next to the panel's own — and when there is no panel, in their place.",
    ),
  )}</p>
  <div class="ed-list dm-suo-list">${
    modi.length
      ? modi.map((modo, indice) => rigaMarkup(modo, indice)).join("")
      : `<div class="ed-empty">${esc(t("Nessun tasto su misura", "No custom button"))}</div>`
  }</div>
  <button type="button" class="ed-btn-add" data-suo-add>＋ ${esc(t("Aggiungi un tasto", "Add a button"))}</button>`;
}

function firmaDelle(modi) {
  return `${JSON.stringify(scattatoSalvato())}#${casellaStorica()}#` + modi
    .map(
      (modo) =>
        `${clean(modo?.nome)}~${clean(modo?.icona)}~${clean(modo?.entita)}~${clean(modo?.opzione)}~${clean(modo?.stato)}~${clean(modo?.valore)}`,
    )
    .join("|");
}

export function ensureAntifurtoSuMisuraBlock() {
  const casella = casellaDellaCentrale();
  let blocco = doc?.getElementById?.(BLOCK_ID);
  if (!casella) {
    blocco?.remove();
    return false;
  }
  const modi = grezze();
  /* Sotto il blocco delle modalita' quando c'e', altrimenti sotto la casella:
   * sono due cose della stessa fila, e vanno lette una dopo l'altra. */
  const sopra = doc?.getElementById?.("dm-alarm-modes") || casella;
  if (!blocco) {
    blocco = doc.createElement("section");
    blocco.id = BLOCK_ID;
    blocco.className = "dm-suo";
    sopra.after(blocco);
  } else if (blocco.previousElementSibling !== sopra) {
    sopra.after(blocco);
  }
  const firma = firmaDelle(modi);
  if (blocco.dataset.firma === firma) return false;
  blocco.dataset.firma = firma;
  blocco.innerHTML = markup(modi);
  return true;
}

function ridisegna() {
  const blocco = doc?.getElementById?.(BLOCK_ID);
  if (blocco) delete blocco.dataset.firma;
  ensureAntifurtoSuMisuraBlock();
}

function leggiRiga(riga, modo) {
  const next = { ...modo };
  for (const campo of riga.querySelectorAll("[data-suo-field]"))
    next[clean(campo.dataset.suoField)] = clean(campo.value);
  return next;
}

/* Tutte le righe dei tasti come sono scritte adesso, salvate. */
function salvaLeRighe(blocco, modi = grezze()) {
  const prossimi = modi.map((voce, quale) => {
    const nodo = blocco.querySelector(`[data-suo-index="${quale}"]`);
    return nodo ? leggiRiga(nodo, voce) : voce;
  });
  salva(prossimi);
  return prossimi;
}

function onClick(event) {
  const blocco = doc?.getElementById?.(BLOCK_ID);
  if (!blocco || !blocco.contains(event.target)) return;

  if (event.target.closest("[data-suo-add]")) {
    event.preventDefault();
    salva([...grezze(), { icona: ICONA_DI_SERIE }]);
    ridisegna();
    return;
  }
  const scat = event.target.closest(".dm-scat");
  if (scat) {
    const cerca = event.target.closest("[data-scat-pick]");
    if (cerca) {
      event.preventDefault();
      const campo = doc.getElementById(clean(cerca.dataset.scatPick));
      if (campo) root.wzPickEntity?.(campo);
      return;
    }
    if (event.target.closest("[data-scat-save]")) {
      event.preventDefault();
      const buono = salvaLoScattato(scat);
      /* Il tasto in fondo alla scheda preme tutti i «salva» nascosti, e questo
       * e' il primo: prima di ridisegnare si salvano anche le righe dei tasti,
       * altrimenti quello appena scritto li' se ne andrebbe col disegno vecchio. */
      salvaLeRighe(blocco);
      ridisegna();
      root.edToast?.(
        buono
          ? t("🚨 Salvato: la casa sa quando suona", "🚨 Saved: the house knows when it goes off")
          : t("🚨 Tolto", "🚨 Removed"),
      );
    }
    return;
  }
  const riga = event.target.closest("[data-suo-index]");
  if (!riga) return;
  const indice = Number(riga.dataset.suoIndex);
  const modi = grezze();
  if (!Number.isInteger(indice) || !modi[indice]) return;

  if (event.target.closest("[data-suo-del]")) {
    event.preventDefault();
    salva(modi.filter((_voce, quale) => quale !== indice));
    ridisegna();
    root.edToast?.(t("🛡️ Tasto eliminato", "🛡️ Button removed"));
    return;
  }
  const icona = event.target.closest("[data-suo-icona]");
  if (icona) {
    event.preventDefault();
    const campo = doc.getElementById(clean(icona.dataset.suoIcona));
    if (campo) openIconPicker(campo, "action");
    return;
  }
  const cerca = event.target.closest("[data-suo-pick]");
  if (cerca) {
    event.preventDefault();
    const campo = doc.getElementById(clean(cerca.dataset.suoPick));
    if (campo) root.wzPickEntity?.(campo);
    return;
  }
  if (event.target.closest("[data-suo-save]")) {
    event.preventDefault();
    /* Si leggono TUTTE le righe, non solo la propria.
     *
     * Il tasto in fondo alla scheda preme i «salva» nascosti uno dopo l'altro,
     * e il primo che salva rifa' il blocco: i tasti che venivano dopo se ne
     * vanno col disegno vecchio, e quello che uno aveva appena scritto nella
     * seconda riga spariva senza dire niente. Leggendole tutte, il primo click
     * salva gia' tutto e ai successivi non resta niente da perdere — e' il modo
     * in cui lo fanno le Persone. */
    const prossimi = salvaLeRighe(blocco, modi);
    ridisegna();
    root.edToast?.(
      normalizzaModoSuMisura(prossimi[indice], indice)
        ? t("🛡️ Tasto salvato", "🛡️ Button saved")
        : t("Scegli cosa deve premere", "Pick what it has to press"),
    );
  }
}

function css() {
  return `
  #${BLOCK_ID}{display:block;margin:10px 0 0}
  #${BLOCK_ID} .dm-suo-titolo{margin:0 0 4px}
  #${BLOCK_ID} .dm-suo-intro{margin:0 0 8px}
  #${BLOCK_ID} .dm-suo-list{display:flex;flex-direction:column;gap:8px}
  #${BLOCK_ID} .dm-suo-row{display:flex;flex-direction:column;gap:6px}
  #${BLOCK_ID} .dm-suo-head{display:flex;align-items:center;gap:8px}
  #${BLOCK_ID} .dm-suo-head .ed-row-new{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
  #${BLOCK_ID} .dm-suo-icona{border:0;background:transparent;font-size:18px;cursor:pointer;line-height:1;padding:0 6px}
  #${BLOCK_ID} .dm-suo-muto{display:block;font-size:11px;opacity:.75}
  #${BLOCK_ID} .dm-scat{margin:0 0 14px;padding:12px 14px;border-radius:16px;border:1px solid color-mix(in srgb,#dc2626 35%,var(--divider-color,#e2e8f0));background:linear-gradient(160deg,color-mix(in srgb,#dc2626 7%,var(--card-bg,#fff)),var(--card-bg,#fff) 70%);display:flex;flex-direction:column;gap:8px}
  #${BLOCK_ID} .dm-scat-testa{display:flex;align-items:center;gap:8px}
  #${BLOCK_ID} .dm-scat-titolo{font-weight:900;font-size:14px}
  #${BLOCK_ID} .dm-scat-nuovo{font-size:9.5px;font-weight:900;letter-spacing:.08em;padding:2px 7px;border-radius:999px;background:#dc2626;color:#fff}
  #${BLOCK_ID} .dm-scat-intro{margin:0}
  #${BLOCK_ID} .dm-scat-griglia{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px 12px}
  #${BLOCK_ID} .dm-scat-adesso{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;padding:8px 10px;border-radius:12px;background:color-mix(in srgb,var(--text,#0f172a) 5%,transparent)}
  #${BLOCK_ID} .dm-scat-adesso.is-on{background:color-mix(in srgb,#dc2626 14%,transparent);color:#b91c1c}
  #${BLOCK_ID} .dm-scat-punto{width:9px;height:9px;border-radius:50%;background:#94a3b8;flex:none}
  #${BLOCK_ID} .dm-scat-adesso.is-on .dm-scat-punto{background:#dc2626;box-shadow:0 0 0 4px color-mix(in srgb,#dc2626 25%,transparent)}
  `;
}

export function installAntifurtoSuMisuraEditorSection() {
  if (!doc || state.installed) return false;
  installStyle(STYLE_ID, css());
  doc.addEventListener("click", onClick);
  /* «Non fa inserire altri tasti oltre al primo» (#431).
   *
   * Aggiungere un tasto salva, salvare rifa' la scheda, e il blocco se ne
   * andava con lei: il secondo «＋» non c'era piu' da premere. I tre annunci
   * qui sotto non parlano di quel ridisegno — nessuno lo annuncia — e il
   * blocco delle modalita', che sta due righe sopra, se l'era gia' risolto per
   * conto suo. Adesso la meccanica e' una sola e la usano tutti e due. */
  tieniIlBloccoNellaScheda("dmAntifurtoSuMisura", ensureAntifurtoSuMisuraBlock);
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, () => root.queueMicrotask?.(ensureAntifurtoSuMisuraBlock));
  state.installed = true;
  return true;
}
