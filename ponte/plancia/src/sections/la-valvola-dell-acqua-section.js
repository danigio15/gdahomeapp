/* La valvola dell'acqua: dove si sceglie, come si disegna, come si comanda (#495).
 *
 * «Sarebbe comodo avere il tasto per aprire e chiudere la valvola dell'acqua
 * nella tessera allagamenti.»
 *
 * Tre pezzi, e stanno insieme perche' parlano della stessa valvola:
 *
 *  - la SCHEDA, negli Avvisi della configurazione, accanto alle sonde degli
 *    allagamenti: e' li' che chi ha messo le sonde cerca quello che le
 *    riguarda, e la valvola e' la risposta a una sonda bagnata;
 *  - la CARTA della valvola nella finestra degli Allagamenti: com'e' adesso, a
 *    colori, e il tasto che la apre o la chiude;
 *  - la CONFERMA prima di chiudere, e il «In chiusura» subito dopo il tocco.
 *
 * Le regole — cosa si puo' scegliere, come si legge, quale servizio — stanno
 * in `core/la-valvola-dell-acqua.js`, che e' puro e si prova da solo.
 *
 * ── Perche' la conferma e l'attesa stanno in memoria e non nel tasto ──────
 *
 * La finestra si ridisegna di continuo (ogni cambio di stato della casa, e
 * ogni due secondi mentre e' aperta), e il ridisegno ricopia gli attributi dal
 * markup nuovo: un tasto «armato» scritto solo nel documento tornava disarmato
 * al giro dopo, sotto il dito di chi stava per confermare. Qui la conferma e
 * il comando appena mandato si ricordano in memoria, e il markup li legge:
 * ogni ridisegno disegna la stessa cosa che c'e' gia'.
 */
import {
  ATTESA_MASSIMA_MS,
  CHIAVE_VALVOLA_ACQUA,
  acquaCheScorre,
  attesaArrivata,
  attesaValida,
  comandoDellaValvola,
  normalizzaValvolaDellAcqua,
  puoEssereLaValvola,
  statoDellaValvola,
} from "../core/la-valvola-dell-acqua.js";
import { SENZA_TESSERA } from "../core/fuori-dai-widget.js";
import {
  allStates,
  chiamaServizio,
  clean,
  doc,
  esc,
  installStyle,
  readJson,
  root,
  siComanda,
  t,
  tieniIlBloccoNellaScheda,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_VALVOLA_ACQUA__";
const STYLE_ID = "dm-valvola-acqua-style";
const BLOCK_ID = "dm-valvola-acqua";

/* Quanto resta armato il tasto: abbastanza per leggere la domanda e
 * rispondere, non tanto da trovarlo ancora armato tornando dopo un minuto. */
const ARMATO_PER_MS = 8000;

const state = (root[KEY] ||= {
  installed: false,
  /* Il comando appena mandato, per entita': `{ verso, da }`. */
  attese: {},
  /* Il tasto che aspetta la conferma: `{ entity, verso, fino }`. */
  armata: null,
  sveglia: 0,
});

/** La valvola scelta, ripulita. */
export function valvolaScelta() {
  return normalizzaValvolaDellAcqua(readJson(CHIAVE_VALVOLA_ACQUA, {}));
}

/** I comandi appena mandati e ancora da aspettare: li legge chi fa il modello. */
export function attesePerLeValvole(adesso = Date.now()) {
  for (const [entity, attesa] of Object.entries(state.attese))
    if (!attesaValida(attesa, adesso)) delete state.attese[entity];
  return state.attese;
}

function armataPer(entity, adesso = Date.now()) {
  const armata = state.armata;
  if (!armata || armata.entity !== entity) return null;
  if (adesso >= armata.fino) {
    state.armata = null;
    return null;
  }
  return armata;
}

/* ── le parole ──────────────────────────────────────────────────────────── */

/** Lo stato in una parola: «Aperta», «In chiusura»… */
export function parolaDelloStato(stato) {
  switch (stato) {
    case "aperta":
      return t("Aperta", "Open");
    case "chiusa":
      return t("Chiusa", "Closed");
    case "in-apertura":
      return t("In apertura…", "Opening…");
    case "in-chiusura":
      return t("In chiusura…", "Closing…");
    default:
      return t("Non risponde", "Not answering");
  }
}

/** La riga sotto la tessera: «Acqua aperta», «Acqua chiusa». */
export function rigaDellaTessera(valvola) {
  if (!valvola) return "";
  switch (valvola.stato) {
    case "aperta":
      return t("Acqua aperta", "Water on");
    case "chiusa":
      return t("Acqua chiusa", "Water off");
    case "in-apertura":
      return t("Acqua in apertura…", "Water turning on…");
    case "in-chiusura":
      return t("Acqua in chiusura…", "Water turning off…");
    default:
      return t("Valvola: non risponde", "Valve: not answering");
  }
}

/* ── il disegno ─────────────────────────────────────────────────────────── */

/* La valvola a sfera, col suo manico: lungo il tubo quando e' aperta, di
 * traverso quando e' chiusa, a meta' strada quando si sta muovendo. E' il
 * segno che chi ha in mano una valvola vera riconosce senza leggere. */
function disegnoDellaValvola(stato) {
  const angolo =
    stato === "chiusa" ? -90 : stato === "in-chiusura" || stato === "in-apertura" ? -45 : 0;
  return `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M2.5 14h4.5M17 14h4.5M2.5 18.5h4.5M17 18.5h4.5"/>
    <path d="M7 12.5h10v7.5H7z"/>
    <path d="M12 12.5V9"/>
    <g transform="rotate(${angolo} 12 8.5)"><path d="M12 8.5h7.5" stroke-width="2.6"/></g>
  </svg>`;
}

const tasto = (fa, entity, testo, classe = "") =>
  `<button type="button" class="dm-valv-tasto${classe ? ` ${classe}` : ""}" data-dm-valvola-fa="${fa}" data-dm-valvola="${esc(entity)}">${esc(testo)}</button>`;

/**
 * La carta di una valvola: il disegno, il nome, lo stato a colori e il tasto.
 *
 * `perdita` dice se in casa c'e' acqua dove non deve: allora il tasto che
 * chiude diventa «Chiudi l'acqua», rosso e largo, e riaprire chiede conferma
 * anche lui — riaprire con una sonda ancora bagnata e' un gesto da fare
 * apposta.
 */
export function cartaDellaValvola(valvola, { perdita = false, adesso = Date.now() } = {}) {
  const entity = clean(valvola?.entity);
  if (!entity) return "";
  const stato = valvola.stato || "muta";
  const armata = armataPer(entity, adesso);
  const muove = stato === "in-chiusura" || stato === "in-apertura";
  let comandi = "";
  if (armata) {
    const chiude = armata.verso === "chiusura";
    comandi = `<div class="dm-valv-conferma" role="group" aria-label="${esc(t("Conferma", "Confirm"))}">
        <p>${esc(
          chiude
            ? t(
                "Chiudere l'acqua? In casa non arriva più acqua finché non la riapri.",
                "Turn the water off? No water reaches the house until you turn it back on.",
              )
            : t(
                "Una sonda è ancora bagnata. Riaprire l'acqua lo stesso?",
                "A probe is still wet. Turn the water back on anyway?",
              ),
        )}</p>
        <div class="dm-valv-scelte">${tasto("annulla", entity, t("Annulla", "Cancel"), "dm-valv-annulla")}${tasto(
          chiude ? "conferma-chiudi" : "conferma-apri",
          entity,
          chiude ? t("Sì, chiudi", "Yes, turn off") : t("Sì, riapri", "Yes, turn on"),
          chiude ? "dm-valv-rosso" : "",
        )}</div>
      </div>`;
  } else if (acquaCheScorre(stato) && stato !== "in-apertura") {
    comandi = perdita
      ? tasto(
          "chiudi",
          entity,
          t("Chiudi l'acqua", "Turn water off"),
          "dm-valv-rosso dm-valv-largo",
        )
      : tasto("chiudi", entity, t("Chiudi", "Close"));
  } else if (stato === "chiusa") {
    comandi = tasto("apri", entity, t("Apri", "Open"));
  }
  const nota =
    perdita && stato === "chiusa"
      ? `<small class="dm-valv-nota">${esc(t("L'acqua è ferma.", "The water is off."))}</small>`
      : "";
  return `<div class="dm-valv" data-dm-valvola-card="${esc(entity)}" data-stato="${esc(stato)}" data-perdita="${perdita ? "true" : "false"}" data-armata="${armata ? "true" : "false"}" data-muove="${muove ? "true" : "false"}">
      <span class="dm-valv-ic">${disegnoDellaValvola(stato)}</span>
      <div class="dm-valv-nome"><b>${esc(valvola.name || entity)}</b><span class="dm-valv-stato"><i aria-hidden="true"></i>${esc(parolaDelloStato(stato))}</span>${nota}</div>
      ${comandi}
    </div>`;
}

/* Riscrive al loro posto le carte che si vedono: dopo un tocco, quando scade
 * la conferma o quando arriva lo stato nuovo. La finestra si ridisegnera' per
 * conto suo, e trovera' la stessa cosa. */
function riscriviLeCarteInVista() {
  const carte = doc?.querySelectorAll?.("[data-dm-valvola-card]") || [];
  if (!carte.length) return 0;
  const states = allStates();
  const scelta = valvolaScelta();
  const adesso = Date.now();
  let riscritte = 0;
  for (const carta of carte) {
    const entity = clean(carta.dataset.dmValvolaCard);
    const inverti = entity === scelta.entity ? scelta.inverti : false;
    const valvola = {
      entity,
      name: clean(carta.querySelector(".dm-valv-nome b")?.textContent) || entity,
      stato: statoDellaValvola(entity, states[entity], {
        inverti,
        attesa: attesePerLeValvole(adesso)[entity] || null,
        adesso,
      }),
    };
    const nuova = cartaDellaValvola(valvola, {
      perdita: carta.dataset.perdita === "true",
      adesso,
    });
    const stampo = doc.createElement("template");
    stampo.innerHTML = nuova.trim();
    const fresca = stampo.content.firstElementChild;
    if (fresca && fresca.outerHTML !== carta.outerHTML) {
      carta.replaceWith(fresca);
      riscritte += 1;
    }
  }
  return riscritte;
}

/* Una sveglia sola: quando scade la conferma, o quando un'attesa smette di
 * valere. Nessun giro fisso — la finestra chiusa non costa niente. */
function svegliamiPiuTardi() {
  if (state.sveglia) root.clearTimeout?.(state.sveglia);
  state.sveglia = 0;
  const adesso = Date.now();
  const scadenze = [
    state.armata?.fino,
    ...Object.values(attesePerLeValvole(adesso)).map((attesa) => attesa.da + ATTESA_MASSIMA_MS),
  ].filter((quando) => Number.isFinite(quando) && quando > adesso);
  if (!scadenze.length) return;
  state.sveglia =
    root.setTimeout?.(
      () => {
        state.sveglia = 0;
        riscriviLeCarteInVista();
        svegliamiPiuTardi();
      },
      Math.min(...scadenze) - adesso + 50,
    ) || 0;
}

/* ── i comandi ──────────────────────────────────────────────────────────── */

function invertitaQuesta(entity) {
  const scelta = valvolaScelta();
  return entity === scelta.entity ? scelta.inverti : false;
}

function manda(entity, verso) {
  const comando = comandoDellaValvola(entity, verso === "chiusura" ? "chiudi" : "apri", {
    inverti: invertitaQuesta(entity),
  });
  if (!comando) return false;
  state.attese[entity] = { verso, da: Date.now() };
  chiamaServizio(comando);
  return true;
}

function onClick(event) {
  const bottone = event.target?.closest?.("[data-dm-valvola-fa]");
  if (bottone) {
    event.preventDefault();
    const entity = clean(bottone.dataset.dmValvola);
    const fa = clean(bottone.dataset.dmValvolaFa);
    /* L'ultimo cancello: una valvola messa fra le cose da guardare e basta non
     * si comanda, nemmeno da un tasto rimasto da un disegno di prima. */
    if (!entity || !siComanda(entity)) return;
    const perdita = bottone.closest("[data-dm-valvola-card]")?.dataset.perdita === "true";
    if (fa === "chiudi")
      state.armata = { entity, verso: "chiusura", fino: Date.now() + ARMATO_PER_MS };
    else if (fa === "apri") {
      /* Riaprire chiede conferma solo con una sonda bagnata: a casa asciutta
       * e' il gesto di tutte le mattine dopo una notte a valvola chiusa. */
      if (perdita) state.armata = { entity, verso: "apertura", fino: Date.now() + ARMATO_PER_MS };
      else manda(entity, "apertura");
    } else if (fa === "annulla") state.armata = null;
    else if (fa === "conferma-chiudi" || fa === "conferma-apri") {
      state.armata = null;
      manda(entity, fa === "conferma-chiudi" ? "chiusura" : "apertura");
    }
    riscriviLeCarteInVista();
    svegliamiPiuTardi();
    return;
  }
  onClickDellaScheda(event);
}

/* Lo stato vero e' arrivato: l'attesa si dimentica, e la carta dice quello
 * che dice Home Assistant. */
function onCambioDiStato(event) {
  const ids = [event?.detail?.entity_ids, event?.detail?.entity_id].flat().filter(Boolean);
  const attese = attesePerLeValvole();
  const toccate = Object.keys(attese).filter((entity) => !ids.length || ids.includes(entity));
  if (!toccate.length) return;
  const states = allStates();
  for (const entity of toccate) {
    const vero = statoDellaValvola(entity, states[entity], { inverti: invertitaQuesta(entity) });
    if (attesaArrivata(attese[entity], vero)) delete attese[entity];
  }
  riscriviLeCarteInVista();
}

/* ── la scheda nella configurazione ─────────────────────────────────────── */

/* Com'e' adesso l'entita' scritta nella casella, prima di salvarla: chi
 * sceglie un rele' vuole vedere subito se «acceso» e' davvero «aperta». */
export function rigaDiAdesso(entity, inverti, states = allStates()) {
  const id = clean(entity);
  if (!id) return "";
  if (!puoEssereLaValvola(id))
    return t(
      "Serve una valvola (valve.*), un interruttore (switch.*) o un input_boolean.",
      "A valve (valve.*), a switch (switch.*) or an input_boolean is needed.",
    );
  const stato = states?.[id];
  if (!stato)
    return t("Questa entità non c'è in Home Assistant.", "This entity is not in Home Assistant.");
  return `${t("Adesso", "Right now")}: ${parolaDelloStato(statoDellaValvola(id, stato, { inverti }))}`;
}

/** La scheda: l'entita', il nome, la spunta dei rele' e il tasto. */
export function schedaDellaValvolaMarkup(scelta, states = {}) {
  const rele = scelta.entity && !scelta.entity.startsWith("valve.");
  return `<div class="ed-sec-title">🚰 ${esc(t("Valvola dell'acqua", "Water valve"))}</div>
    <p class="ed-intro dm-vacq-intro">${esc(
      t(
        "Facoltativa. La valvola generale dell'acqua, o il relè che la comanda: nella tessera Allagamenti compare il suo stato con il tasto per aprirla e chiuderla, e quando una sonda è bagnata il tasto «Chiudi l'acqua» è il primo che si vede. Chiudere chiede sempre una conferma.",
        "Optional. The main water valve, or the relay that drives it: the Floods tile shows its state with the button to open and close it, and when a probe is wet the “Turn water off” button is the first thing you see. Closing always asks for confirmation.",
      ),
    )}</p>
    <div class="ed-slot dm-vacq-riga">
      <span class="dm-vacq-lbl">${esc(t("Entità", "Entity"))}</span>
      <span class="ed-form-row"><input id="dm-vacq-entity" class="ed-input mono" data-vacq-entity value="${esc(
        scelta.entity,
      )}" placeholder="valve.acqua_generale" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-vacq-pick aria-label="${esc(
        t("Scegli entità", "Choose entity"),
      )}">🔍</button></span>
      <span class="dm-vacq-lbl dm-vacq-lbl-piccola">${esc(t("Nome (facoltativo)", "Name (optional)"))}</span>
      <span class="ed-form-row"><input class="ed-input" data-vacq-nome maxlength="40" value="${esc(
        scelta.nome,
      )}" placeholder="${esc(t("Acqua di casa", "House water"))}" aria-label="${esc(t("Nome", "Name"))}"></span>
      <small class="dm-vacq-adesso" data-vacq-adesso>${esc(rigaDiAdesso(scelta.entity, scelta.inverti, states))}</small>
    </div>
    <label class="dm-vacq-inverti" data-vacq-inverti-riga${rele ? "" : " hidden"}>
      <input type="checkbox" data-vacq-inverti${scelta.inverti ? " checked" : ""}>
      <span class="dm-vacq-inverti-testo">
        <b>${esc(t("Acceso vuol dire chiusa", "On means closed"))}</b>
        <small>${esc(
          t(
            "Per i relè che chiudono l'acqua quando si accendono (valvola normalmente aperta). Su una valvola valve.* non serve.",
            "For relays that turn the water off when switched on (normally open valve). Not needed on a valve.* entity.",
          ),
        )}</small>
      </span>
    </label>
    <output class="dm-todo-ed-error" data-vacq-error></output>
    <button type="button" class="ed-save-btn" data-vacq-salva>💾 ${esc(t("Salva valvola", "Save valve"))}</button>`;
}

/* Dopo le sonde degli allagamenti, che sono quello di cui la valvola e' la
 * risposta. Senza sonde, dopo l'ultima fisarmonica dei gruppi. La scheda degli
 * Avvisi si riconosce dalla tendina dei gruppi, come fa chi disegna le sonde. */
function doveVaLaScheda() {
  const corpo = doc?.getElementById?.("ed-body");
  if (!corpo || !doc.getElementById("ed-avv-grp")) return null;
  const sonde = corpo.querySelector("[data-dm-flood-acc]");
  if (sonde) return sonde;
  const gruppi = [...corpo.querySelectorAll("details.ed-acc")];
  return gruppi[gruppi.length - 1] || null;
}

export function ensureSchedaDellaValvola() {
  const sopra = doveVaLaScheda();
  let blocco = doc?.getElementById?.(BLOCK_ID);
  if (!sopra) {
    blocco?.remove();
    return false;
  }
  if (!blocco) {
    blocco = doc.createElement("section");
    blocco.id = BLOCK_ID;
    blocco.className = "dm-vacq";
    /* La valvola non entra ne' esce dalla tessera con l'interruttore «Nel
     * widget»: compare nella finestra perche' e' stata scelta qui. */
    blocco.setAttribute(SENZA_TESSERA, "");
    sopra.after(blocco);
  } else if (blocco.previousElementSibling !== sopra) {
    sopra.after(blocco);
  }
  const scelta = valvolaScelta();
  const firma = JSON.stringify(scelta);
  /* Si rifa' solo quando cambia quello che e' salvato: rifare il markup a ogni
   * passaggio strapperebbe la casella da sotto le dita di chi sta scrivendo. */
  if (blocco.dataset.firma !== firma) {
    blocco.dataset.firma = firma;
    blocco.innerHTML = schedaDellaValvolaMarkup(scelta, allStates());
    return true;
  }
  aggiornaLAdesso(blocco);
  return false;
}

function aggiornaLAdesso(blocco) {
  const entity = clean(blocco.querySelector("[data-vacq-entity]")?.value);
  const inverti = blocco.querySelector("[data-vacq-inverti]")?.checked === true;
  const campo = blocco.querySelector("[data-vacq-adesso]");
  const testo = rigaDiAdesso(entity, inverti);
  if (campo && campo.textContent !== testo) campo.textContent = testo;
  const riga = blocco.querySelector("[data-vacq-inverti-riga]");
  const rele = Boolean(entity) && !entity.startsWith("valve.");
  if (riga && riga.hidden === rele) riga.hidden = !rele;
}

function onClickDellaScheda(event) {
  const blocco = doc?.getElementById?.(BLOCK_ID);
  if (!blocco || !blocco.contains(event.target)) return;
  if (event.target.closest("[data-vacq-pick]")) {
    event.preventDefault();
    const campo = doc.getElementById("dm-vacq-entity");
    if (campo) root.wzPickEntity?.(campo);
    return;
  }
  if (!event.target.closest("[data-vacq-salva]")) return;
  event.preventDefault();
  const errore = blocco.querySelector("[data-vacq-error]");
  const entity = clean(blocco.querySelector("[data-vacq-entity]")?.value);
  /* Una casella vuota toglie la valvola, ed e' il modo di toglierla. Una
   * casella con qualcosa che una valvola non e' si ferma qui, con la parola
   * che dice cosa serve: salvarla vorrebbe dire una valvola che sparisce in
   * silenzio alla prima lettura. */
  if (entity && !puoEssereLaValvola(entity)) {
    if (errore)
      errore.textContent = t(
        `«${entity}» non è una valvola: serve valve.*, switch.* o input_boolean.*.`,
        `“${entity}” is not a valve: valve.*, switch.* or input_boolean.* is needed.`,
      );
    return;
  }
  if (errore) errore.textContent = "";
  const scelta = normalizzaValvolaDellAcqua({
    entity,
    nome: blocco.querySelector("[data-vacq-nome]")?.value,
    inverti: blocco.querySelector("[data-vacq-inverti]")?.checked === true,
  });
  writeJsonIfChanged(
    CHIAVE_VALVOLA_ACQUA,
    scelta.entity
      ? {
          entity: scelta.entity,
          ...(scelta.nome ? { nome: scelta.nome } : {}),
          ...(scelta.inverti ? { inverti: true } : {}),
        }
      : {},
  );
  ensureSchedaDellaValvola();
  root.edToast?.(t("💾 Valvola salvata", "💾 Valve saved"));
}

function onScrittura(event) {
  const blocco = doc?.getElementById?.(BLOCK_ID);
  if (!blocco || !blocco.contains(event.target)) return;
  if (event.target.closest?.("[data-vacq-entity],[data-vacq-inverti]")) aggiornaLAdesso(blocco);
}

/* ── giro ──────────────────────────────────────────────────────────────── */

export function installValvolaDellAcqua() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyle(STYLE_ID, css());
  doc.addEventListener("click", onClick);
  doc.addEventListener("change", onScrittura, true);
  doc.addEventListener("input", onScrittura, true);
  tieniIlBloccoNellaScheda("dmValvolaAcqua", ensureSchedaDellaValvola);
  root.addEventListener?.("dashboardmodern:state-changed", onCambioDiStato);
  return true;
}

/* ── stile ─────────────────────────────────────────────────────────────── */

/* Dove stanno le carte: le finestre della Home. */
const P = ":is(#dm-widget-popup,#dm-casa-popup,#dm-qa-popup)";

function css() {
  return `
    /* La carta della valvola. Il colore dice lo stato prima della parola:
       l'azzurro dell'acqua quando passa, l'ardesia quando e' ferma, l'ambra
       mentre il motore gira. Rosso solo con una perdita e l'acqua ancora
       aperta: e' l'unico caso in cui c'e' da fare qualcosa adesso. */
    ${P} .dm-valv{--valv:#0284c7;display:flex;align-items:center;flex-wrap:wrap;gap:10px 12px;padding:13px;
      border-radius:20px;min-width:0;background:var(--card-bg,#fff);
      border:1px solid color-mix(in srgb,var(--valv) 38%,transparent);
      box-shadow:0 12px 24px -22px color-mix(in srgb,var(--valv) 90%,transparent)}
    ${P} .dm-valv[data-stato="chiusa"]{--valv:#475569}
    ${P} .dm-valv[data-muove="true"]{--valv:#d97706}
    ${P} .dm-valv[data-stato="muta"]{--valv:#94a3b8;border-style:dashed;box-shadow:none}
    ${P} .dm-valv[data-perdita="true"]:is([data-stato="aperta"],[data-stato="in-apertura"]){--valv:#dc2626;
      background:color-mix(in srgb,#dc2626 7%,var(--card-bg,#fff))}
    ${P} .dm-valv[data-perdita="true"][data-stato="chiusa"]{--valv:#16a34a}
    ${P} .dm-valv-ic{flex:none;width:46px;height:46px;border-radius:15px;display:grid;place-items:center;
      color:var(--valv);background:color-mix(in srgb,var(--valv) 13%,var(--card-bg,#fff))}
    ${P} .dm-valv-ic svg{width:28px;height:28px;display:block}
    ${P} .dm-valv-nome{flex:1 1 140px;min-width:0}
    ${P} .dm-valv-nome b{display:block;font-size:14.5px;font-weight:850;overflow-wrap:anywhere}
    ${P} .dm-valv-stato{display:inline-flex;align-items:center;gap:6px;margin-top:3px;padding:3px 9px 3px 7px;
      border-radius:999px;font-size:11.5px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;
      color:var(--valv);background:color-mix(in srgb,var(--valv) 12%,transparent)}
    ${P} .dm-valv-stato i{width:8px;height:8px;border-radius:50%;background:var(--valv)}
    ${P} .dm-valv[data-muove="true"] .dm-valv-stato i{animation:dm-valv-pulsa 1.1s ease-in-out infinite alternate}
    @keyframes dm-valv-pulsa{from{opacity:1}to{opacity:.25}}
    ${P} .dm-valv-nota{display:block;margin-top:4px;font-size:12px;font-weight:750;color:var(--text-dim,#64748b)}
    ${P} .dm-valv-tasto{flex:none;font:inherit;cursor:pointer;padding:10px 16px;border-radius:14px;border:0;
      background:#0f172a;color:#fff;font-size:13px;font-weight:850;min-height:42px}
    ${P} .dm-valv-tasto:focus-visible{outline:2px solid var(--valv);outline-offset:2px}
    ${P} .dm-valv-tasto.dm-valv-rosso{background:#dc2626;color:#fff}
    /* Con una perdita il tasto prende la riga intera: e' la cosa da fare. */
    ${P} .dm-valv-tasto.dm-valv-largo{flex:1 1 100%;min-height:52px;font-size:16px;font-weight:900;border-radius:16px;
      box-shadow:0 14px 26px -16px rgba(220,38,38,.95)}
    ${P} .dm-valv-conferma{flex:1 1 100%;display:grid;gap:9px;padding:11px 12px;border-radius:15px;
      background:color-mix(in srgb,#dc2626 8%,var(--card-bg,#fff));border:1px solid color-mix(in srgb,#dc2626 35%,transparent)}
    ${P} .dm-valv-conferma p{margin:0;font-size:13px;font-weight:750;line-height:1.4}
    ${P} .dm-valv-scelte{display:grid;grid-template-columns:1fr 1.4fr;gap:8px}
    ${P} .dm-valv-scelte .dm-valv-tasto{width:100%}
    ${P} .dm-valv-tasto.dm-valv-annulla{background:transparent;color:inherit;border:1px solid var(--card-border,#cbd5e1)}
    html[data-theme="dark"] ${P} .dm-valv-tasto:not(.dm-valv-rosso):not(.dm-valv-annulla){background:#f8fafc;color:#0f172a}
    html[data-theme="dark"] ${P} .dm-valv[data-stato="chiusa"]:not([data-perdita="true"]){--valv:#94a3b8}
    @media (prefers-reduced-motion:reduce){${P} .dm-valv[data-muove="true"] .dm-valv-stato i{animation:none}}

    /* La scheda nella configurazione. */
    #ed-body .dm-vacq{display:grid;gap:8px;margin:14px 0 4px}
    #ed-body .dm-vacq-intro{margin:0}
    #ed-body .dm-vacq-riga{display:grid;gap:6px}
    #ed-body .dm-vacq-lbl{display:block;margin:0 2px;font-size:12.5px;font-weight:800;color:var(--text,#0f172a)}
    #ed-body .dm-vacq-lbl-piccola{font-size:11px;letter-spacing:.04em;text-transform:uppercase;
      color:var(--text-dim,#64748b)}
    #ed-body .dm-vacq-adesso{font-size:11.5px;font-weight:700;line-height:1.45;
      color:var(--secondary-text-color,#64748b);overflow-wrap:anywhere}
    #ed-body .dm-vacq-adesso:empty{display:none}
    #ed-body .dm-vacq-inverti{display:flex;align-items:flex-start;gap:11px;padding:11px 12px;min-width:0;
      border:1px solid var(--divider-color,#dbe4ee);border-radius:14px;
      background:var(--card-background-color,#fff);cursor:pointer}
    #ed-body .dm-vacq-inverti[hidden]{display:none}
    #ed-body .dm-vacq-inverti input{flex:0 0 auto;width:19px;height:19px;margin-top:1px;
      accent-color:var(--primary-color,#0ea5e9)}
    #ed-body .dm-vacq-inverti-testo{display:grid;gap:3px;min-width:0;flex:1 1 auto}
    #ed-body .dm-vacq-inverti-testo b{font-size:13.5px;font-weight:750}
    #ed-body .dm-vacq-inverti-testo small{font-size:11.5px;line-height:1.5;color:var(--secondary-text-color,#64748b)}
  `;
}
