/* La scheda «Luci di Natale» del config: quali sono, cosa sono, e quando si
 * accendono.
 *
 * L'albero su una presa smart, il presepe, le lucine sul balcone: qui si
 * scelgono (fino a otto), ognuna col suo TIPO — albero, presepe, balcone,
 * finestra, stella, ghirlanda — che dice cosa disegna il riquadro in Home,
 * dove ogni luce e' la cosa vera in una scena d'inverno. In cima alla scheda
 * c'e' quella stessa scena, piccola e dal vivo: si vede cosa si sta
 * configurando, e toccando l'albero l'albero si accende davvero. Poi si dice
 * quando si accendono — al tramonto o a un'ora — quando si spengono e in
 * quali giorni; l'orario lo esegue il ponte (`ponte/src/le-luci-di-natale.js`),
 * che gira anche quando nessuno ha la plancia aperta.
 *
 * ── Una scheda che c'e' tutto l'anno ──────────────────────────────────────
 *
 * L'albero si monta prima delle feste: la scheda c'e' sempre, e con lei il
 * riquadro in Home e l'orario, che qui si possono spegnere. Quello che la
 * plancia fa da sola nei giorni di festa non la riguarda: per questo nei
 * testi qui dentro non c'e' una data, ne' una parola su quello. La scheda
 * parla delle luci e basta.
 *
 * ── Si salva a ogni scelta ────────────────────────────────────────────────
 *
 * Non c'e' un tasto «Salva»: ogni scelta e' una risposta (al tramonto o a
 * un'ora, quali giorni), e si scrive appena la si da' — come l'interruttore
 * della Home nei testi della sicurezza. Solo la riga di una luce che si sta
 * aggiungendo o modificando ha il suo «Salva», perche' li' si scrive e si puo'
 * sbagliare l'entita'.
 *
 * ── Lo stato non rifa' la scheda ──────────────────────────────────────────
 *
 * Il disegno della scheda dipende solo dalla configurazione: gli interruttori
 * delle luci e l'anteprima seguono gli stati di casa cambiando un attributo e
 * qualche classe (`seguiGliStati`), cosi' un'accensione non rifa' la scena e
 * non porta via niente a chi sta scrivendo.
 */
import {
  CHIAVE_FESTE,
  DOMINI_DELLE_LUCI,
  LUCI_AL_MASSIMO,
  TIPI_DELLE_LUCI,
  eUnaLuceDiNatale,
  festePulite,
  intervalloDelGiorno,
  luciDaProporre,
  oraDi,
  oraPulita,
  tipoDellaLuce,
} from "../core/feste.js";
import {
  chiamateDelTocco,
  cieloDellaScena,
  coseDellaScena,
  etichetteDellaScena,
} from "../core/scena-delle-luci.js";
import { ensureTitoloDellaSezione, riordinaLeLinguette } from "./alberatura-del-config-section.js";
import { entitaDelMeteo } from "./la-card-del-meteo-section.js";
import { cssDellaScena, iconaDelTipo, mettiLaScena } from "./la-scena-delle-luci.js";
import {
  allStates,
  chiamaServizio,
  clean,
  doc,
  esc,
  installStyle,
  locale,
  onEditorRedraw,
  readJson,
  root,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_LUCI_DI_NATALE_EDITOR__";
const state = (root[KEY] ||= {
  installed: false,
  /* La riga aperta: l'indice di una luce, «nuova», o niente. */
  modifica: null,
  errore: "",
  /* Il fotogramma in cui si riprova l'anteprima, se la finestra non aveva
   * ancora misura. */
  riprova: 0,
});

export const LUCI_DI_NATALE_TAB = "feste";

const schedaAttiva = () => clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
const salvate = () => festePulite(readJson(CHIAVE_FESTE, null));

/* Gli scarti sul tramonto che si offrono: da mezz'ora prima a un'ora dopo. */
const SCARTI = [-30, -15, 0, 15, 30, 60];

function parolaDelloScarto(minuti) {
  if (!minuti) return t("all'ora del tramonto", "at sunset");
  const quanti = Math.abs(minuti);
  return minuti < 0
    ? t(`${quanti} min prima`, `${quanti} min before`)
    : t(`${quanti} min dopo`, `${quanti} min after`);
}

const oggiAlle = (ora) => t(`oggi alle ${ora}`, `today at ${ora}`);
/* Senza `sun.sun` il tramonto non si sa: vale l'ora scritta, e si dice quale. */
const senzaSole = (ora) =>
  t(
    `Il sole di Home Assistant (sun.sun) non c'è: si accendono alle ${ora}.`,
    `Home Assistant's sun (sun.sun) is missing: they switch on at ${ora}.`,
  );

/* I giorni della settimana come li scrive la lingua di chi guarda, da lunedi'
 * a domenica: «L M M G V S D». Il numero e' quello di `Date#getDay`. */
function giorniDellaSettimana() {
  return [1, 2, 3, 4, 5, 6, 0].map((giorno) => {
    /* Il 5 gennaio 2025 era una domenica: da li' si conta. */
    const data = new Date(2025, 0, 5 + giorno);
    return {
      giorno,
      breve: data.toLocaleDateString(locale(), { weekday: "narrow" }),
      lungo: data.toLocaleDateString(locale(), { weekday: "long" }),
    };
  });
}

/* ── i tipi ─────────────────────────────────────────────────────────────── */

/* Come si chiama ogni tipo, nella lingua di chi guarda. */
function nomeDelTipo(tipo) {
  return (
    {
      albero: t("Albero", "Tree"),
      presepe: t("Presepe", "Nativity"),
      balcone: t("Balcone", "Balcony"),
      finestra: t("Finestra", "Window"),
      stella: t("Stella", "Star"),
      ghirlanda: t("Ghirlanda", "String lights"),
    }[tipo] || tipo
  );
}

/* ── le righe delle luci ────────────────────────────────────────────────── */

function nomeDiCasa(entity, states) {
  return clean(states?.[entity]?.attributes?.friendly_name);
}

function nomeDellaLuce(luce, states) {
  return (
    clean(luce.nome) ||
    nomeDiCasa(luce.entity, states) ||
    luce.entity.split(".")[1].replace(/_/g, " ")
  );
}

/* L'interruttore della luce: lo stato lo mette `seguiGliStati`, non il
 * disegno, che cosi' non cambia a ogni accensione. */
const interruttore = (entity, etichetta) =>
  `<button type="button" class="fe-ed-int" role="switch" aria-checked="false" data-fe-alterna="${esc(entity)}" aria-label="${esc(etichetta)}"><i></i></button>`;

function rigaDellaLuce(luce, indice, states) {
  const nome = nomeDellaLuce(luce, states);
  const tipo = tipoDellaLuce(luce, nomeDiCasa(luce.entity, states));
  return `<div class="fe-ed-riga" data-fe-riga="${indice}" data-fe-luce="${esc(luce.entity)}">
    <span class="fe-ed-tipo-ic fe-ed-tipo-${tipo}" aria-hidden="true">${iconaDelTipo(tipo, 24)}</span>
    <span class="fe-ed-nome"><b>${esc(nome)}</b><span class="fe-ed-sotto"><em>${esc(nomeDelTipo(tipo))}</em><code>${esc(luce.entity)}</code></span></span>
    <span class="fe-ed-azioni">
      <button type="button" class="fe-ed-mini" data-fe-modifica="${indice}" aria-label="${esc(t("Modifica", "Edit"))}" title="${esc(t("Modifica", "Edit"))}">✏️</button>
      <button type="button" class="fe-ed-mini" data-fe-elimina="${indice}" aria-label="${esc(t("Elimina", "Delete"))}" title="${esc(t("Elimina", "Delete"))}">🗑</button>
    </span>
    ${interruttore(luce.entity, nome)}
  </div>`;
}

/* La riga che si scrive: il tipo con le sue icone, il nome, l'entita' con la
 * lente. Il tipo proposto e' quello che si indovina dal nome. */
function rigaDaScrivere(luce, indice, states) {
  const id = `fe-ed-entity-${indice}`;
  const tipo = luce ? tipoDellaLuce(luce, nomeDiCasa(luce.entity, states)) : "albero";
  const tipi = TIPI_DELLE_LUCI.map(
    (quale) =>
      `<button type="button" class="fe-ed-tipo${quale === tipo ? " si" : ""}" data-fe-tipo="${quale}" aria-pressed="${quale === tipo}">${iconaDelTipo(quale, 26)}<span>${esc(nomeDelTipo(quale))}</span></button>`,
  ).join("");
  return `<div class="fe-ed-riga fe-ed-scrivi" data-fe-scrivi="${esc(indice)}">
    <div class="fe-ed-voce fe-ed-largo"><span>${esc(t("Che cos'è", "What it is"))}</span>
      <div class="fe-ed-tipi" role="group">${tipi}</div>
      <input type="hidden" data-fe-campo="tipo" value="${esc(tipo)}"></div>
    <label class="fe-ed-voce"><span>${esc(t("Nome", "Name"))}</span>
      <input class="ed-input" data-fe-campo="nome" maxlength="40" value="${esc(luce?.nome || "")}"
        placeholder="${esc(t("Albero", "Tree"))}"></label>
    <label class="fe-ed-voce"><span>${esc(t("Entità", "Entity"))}</span>
      <span class="ed-form-row"><input id="${id}" class="ed-input mono" data-fe-campo="entity"
        data-domain="${DOMINI_DELLE_LUCI.join(",")}" value="${esc(luce?.entity || "")}"
        placeholder="switch.presa_albero" autocomplete="off" spellcheck="false"><button type="button"
        class="dm-entity-picker" data-fe-cerca="${id}" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span></label>
    <output class="dm-todo-ed-error fe-ed-largo" data-fe-errore>${esc(state.errore)}</output>
    <div class="fe-ed-tasti fe-ed-largo">
      <button type="button" class="fe-ed-salva" data-fe-salva>${esc(t("Salva luce", "Save light"))}</button>
      <button type="button" class="fe-ed-mini fe-ed-testo" data-fe-annulla>${esc(t("Annulla", "Cancel"))}</button>
    </div>
  </div>`;
}

/* ── gli orari ──────────────────────────────────────────────────────────── */

function orariMarkup(config, states) {
  const tramonto = states?.["sun.sun"]?.attributes?.next_setting || null;
  const oggi = intervalloDelGiorno(
    { ...config, giorni: [0, 1, 2, 3, 4, 5, 6] },
    new Date(),
    tramonto,
  );
  const alTramonto = config.accendi.tipo === "tramonto";
  const scarti = SCARTI.includes(config.accendi.scarto)
    ? SCARTI
    : [...SCARTI, config.accendi.scarto].sort((a, b) => a - b);
  const quando = alTramonto
    ? `<select class="ed-input fe-ed-sel" data-fe-orario="scarto">${scarti
        .map(
          (minuti) =>
            `<option value="${minuti}"${minuti === config.accendi.scarto ? " selected" : ""}>${esc(parolaDelloScarto(minuti))}</option>`,
        )
        .join("")}</select>${
        oggi && tramonto
          ? `<small class="fe-ed-oggi">${esc(oggiAlle(oraDi(oggi.inizio)))}</small>`
          : ""
      }`
    : `<input class="ed-input fe-ed-ora" type="time" data-fe-orario="accendi" value="${esc(config.accendi.ora)}">`;
  const giorni = giorniDellaSettimana()
    .map(
      ({ giorno, breve, lungo }) =>
        `<button type="button" class="fe-ed-giorno${config.giorni.includes(giorno) ? " si" : ""}" data-fe-giorno="${giorno}" aria-pressed="${config.giorni.includes(giorno)}" aria-label="${esc(lungo)}" title="${esc(lungo)}">${esc(breve)}</button>`,
    )
    .join("");
  return `<div class="fe-ed-orari">
    <div class="fe-ed-colonna">
      <div class="fe-ed-lab">${esc(t("Si accendono", "They switch on"))}</div>
      <span class="fe-ed-seg">
        <button type="button" class="${alTramonto ? "si" : ""}" data-fe-accendi="tramonto">🌇 ${esc(t("Al tramonto", "At sunset"))}</button>
        <button type="button" class="${alTramonto ? "" : "si"}" data-fe-accendi="ora">🕔 ${esc(t("A un'ora", "At a time"))}</button>
      </span>
      <div class="fe-ed-quando">${quando}</div>
      ${alTramonto && !tramonto ? `<small class="fe-ed-nota">${esc(senzaSole(config.accendi.ora))}</small>` : ""}
    </div>
    <div class="fe-ed-colonna">
      <div class="fe-ed-lab">${esc(t("Si spengono", "They switch off"))}</div>
      <div class="fe-ed-quando"><span class="fe-ed-luna" aria-hidden="true">🌙</span>
        <input class="ed-input fe-ed-ora" type="time" data-fe-orario="spegni" value="${esc(config.spegni.ora)}"></div>
    </div>
    <div class="fe-ed-colonna">
      <div class="fe-ed-lab">${esc(t("Nei giorni", "On these days"))}</div>
      <div class="fe-ed-giorni">${giorni}</div>
    </div>
  </div>`;
}

/* ── i due interruttori ─────────────────────────────────────────────────── */

/* Il riquadro in Home e l'orario: tutt'e due di serie accesi, e si spengono
 * qui (a fine stagione, o per chi le luci le comanda solo a mano). */
function interruttoriMarkup(config) {
  const riga = (chiave, acceso, titolo, sotto) =>
    `<label class="fe-ed-interruttore"><span><b>${esc(titolo)}</b><small>${esc(sotto)}</small></span><input type="checkbox" role="switch" data-fe-interruttore="${chiave}"${acceso ? " checked" : ""}><i aria-hidden="true"></i></label>`;
  return `<div class="fe-ed-interruttori">${riga(
    "riquadro",
    config.riquadro,
    t("Riquadro in Home", "Panel on Home"),
    t("Le luci in Home, con «Spegni tutte».", "The lights on Home, with “Turn all off”."),
  )}${riga(
    "automatico",
    config.automatico,
    t("Accensione automatica", "Automatic switching"),
    t(
      "Si accendono e si spengono da sole all'orario qui sotto.",
      "They switch on and off by themselves at the times below.",
    ),
  )}</div>`;
}

/* ── la scheda ──────────────────────────────────────────────────────────── */

/* L'anteprima: la scena del riquadro, piccola. Senza luci, un invito. */
function anteprimaMarkup(config) {
  if (!config.luci.length)
    return `<div class="fe-ed-vuota">${esc(
      t(
        "Aggiungi una luce e qui compare la scena: l'albero, il presepe, la casa con le lucine.",
        "Add a light and the scene appears here: the tree, the nativity, the house with its lights.",
      ),
    )}</div>`;
  return `<div class="fe-ed-anteprima">
    <div class="fe-ed-scena" aria-label="${esc(t("Anteprima del riquadro in Home", "Preview of the Home panel"))}"></div>
    <span class="fe-ed-dal-vivo">${esc(t("Dal vivo · tocca per accendere", "Live · tap to switch on"))}</span>
  </div>`;
}

export function schedaMarkup(config, states = {}) {
  const proposte = luciDaProporre(states, config, 4);
  const piene = config.luci.length >= LUCI_AL_MASSIMO;
  const righe = config.luci.map((luce, i) =>
    state.modifica === i ? rigaDaScrivere(luce, i, states) : rigaDellaLuce(luce, i, states),
  );
  if (state.modifica === "nuova") righe.push(rigaDaScrivere(null, "nuova", states));
  const aggiungi =
    state.modifica === null && !piene
      ? `<button type="button" class="fe-ed-piu" data-fe-aggiungi>＋ ${esc(t("Aggiungi luce", "Add light"))}</button>`
      : "";
  const trovate =
    proposte.length && !piene
      ? `<span class="fe-ed-trovate">${esc(t("Trovate in casa:", "Found at home:"))}</span>${proposte
          .map(
            (p) =>
              `<button type="button" class="fe-ed-mini fe-ed-proposta" data-fe-proposta="${esc(p.entity)}" title="${esc(p.entity)}">${iconaDelTipo(tipoDellaLuce({ entity: p.entity }, p.nome), 16)} ${esc(p.nome)}</button>`,
          )
          .join("")}`
      : "";
  return `<div class="fe-ed">
    <section class="fe-ed-carta fe-ed-testa">
      ${anteprimaMarkup(config)}
      <div class="fe-ed-titolo">${esc(t("Luci di Natale", "Christmas lights"))}</div>
      <p class="fe-ed-intro">${esc(
        t(
          "Ogni luce è una cosa della scena in Home: l'albero, il presepe, le lucine del balcone, le candele alla finestra, la stella, una ghirlanda. Si accendono e si spengono da sole all'orario qui sotto, anche con la plancia chiusa. Fino a otto.",
          "Each light is something in the Home scene: the tree, the nativity, the balcony lights, the window candles, the star, a string of lights. They switch on and off by themselves at the times below, even with the dashboard closed. Up to eight.",
        ),
      )}${
        proposte.length && !piene
          ? ` ${esc(
              t(
                "Fra le entità di casa ne ho trovate alcune che sembrano di Natale: toccale per aggiungerle.",
                "Among your entities I found a few that look like Christmas lights: tap them to add them.",
              ),
            )}`
          : ""
      }</p>
    </section>
    <section class="fe-ed-carta">
      <div class="fe-ed-lab fe-ed-lab-primo">${esc(t("Le luci", "The lights"))}</div>
      ${righe.length ? `<div class="fe-ed-righe">${righe.join("")}</div>` : ""}
      ${aggiungi || trovate ? `<div class="fe-ed-aggiungi">${aggiungi}${trovate}</div>` : ""}
    </section>
    <section class="fe-ed-carta">
      ${interruttoriMarkup(config)}
      ${config.automatico ? orariMarkup(config, states) : ""}
    </section>
  </div>`;
}

export function ensureLuciDiNataleTab() {
  const linguette = doc?.querySelector(".ed-tab")?.parentElement;
  if (!linguette) return false;
  const gia = linguette.querySelector(`.ed-tab[data-tab="${LUCI_DI_NATALE_TAB}"]`);
  if (gia) return false;
  const linguetta = doc.createElement("button");
  linguetta.className = "ed-tab";
  linguetta.dataset.tab = LUCI_DI_NATALE_TAB;
  linguetta.textContent = `🎄 ${t("Luci di Natale", "Christmas lights")}`;
  linguetta.addEventListener("click", () => root.editorSwitch?.(LUCI_DI_NATALE_TAB));
  const prima = linguette.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(linguetta);
  else linguette.append(linguetta);
  riordinaLeLinguette();
  return true;
}

/* Gli stati di casa sulla scheda gia' disegnata: gli interruttori delle luci
 * e l'anteprima. */
function seguiGliStati(body, config, states) {
  for (const int of body.querySelectorAll("[data-fe-alterna]")) {
    const accesa = clean(states?.[int.dataset.feAlterna]?.state) === "on";
    int.setAttribute("aria-checked", String(accesa));
    int.closest(".fe-ed-riga")?.classList.toggle("accesa", accesa);
  }
  const scena = body.querySelector(".fe-ed-scena");
  if (!scena || !config.luci.length) return;
  const nomi = Object.fromEntries(config.luci.map((l) => [l.entity, nomeDiCasa(l.entity, states)]));
  const cose = coseDellaScena(config.luci, nomi);
  const meteo = entitaDelMeteo(states);
  const cielo = cieloDellaScena({
    stati: states,
    condizione: meteo ? states?.[meteo]?.state : "",
  });
  const messa = mettiLaScena(scena, {
    cose,
    cielo,
    accese: new Set(
      config.luci.map((l) => l.entity).filter((e) => clean(states?.[e]?.state) === "on"),
    ),
    etichette: etichetteDellaScena(cose, (e) =>
      nomeDellaLuce(config.luci.find((l) => l.entity === e) || { entity: e }, states),
    ),
    prefisso: "dmle",
    da: 10,
    riserva: 10,
  });
  /* La finestra del config si sta ancora aprendo e l'anteprima non ha misura:
   * ci si riprova al fotogramma dopo, una volta. */
  if (!messa && !state.riprova)
    state.riprova = root.requestAnimationFrame?.(() => {
      state.riprova = 0;
      if (schedaAttiva() === LUCI_DI_NATALE_TAB) ensureLuciDiNataleEditor();
    });
}

export function ensureLuciDiNataleEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== LUCI_DI_NATALE_TAB) {
    if (schedaAttiva() !== LUCI_DI_NATALE_TAB) {
      state.modifica = null;
      state.errore = "";
    }
    return false;
  }
  const states = allStates() || {};
  const config = salvate();
  /* Mentre si scrive una riga non si ridisegna niente: un cambio di stato a
   * meta' parola si porterebbe via quello che c'e' scritto. L'anteprima e
   * gli interruttori seguono lo stesso. */
  if (body.querySelector("[data-fe-scrivi]") && body.dataset.renderer === LUCI_DI_NATALE_TAB) {
    seguiGliStati(body, config, states);
    return true;
  }
  const markup = schedaMarkup(config, states);
  if (body.dataset.dmFesteEditor !== markup || !body.querySelector(".fe-ed")) {
    body.dataset.dmFesteEditor = markup;
    body.innerHTML = markup;
    body.dataset.renderer = LUCI_DI_NATALE_TAB;
  }
  seguiGliStati(body, config, states);
  ensureTitoloDellaSezione();
  return true;
}

function ridisegna({ forza = false } = {}) {
  const body = doc?.getElementById("ed-body");
  if (forza && body) delete body.dataset.dmFesteEditor;
  if (forza && body?.querySelector("[data-fe-scrivi]") && state.modifica === null)
    body.innerHTML = "";
  ensureLuciDiNataleEditor();
}

function salva(config, parola = t("💾 Luci di Natale salvate", "💾 Christmas lights saved")) {
  const pulita = festePulite(config);
  writeJsonIfChanged(CHIAVE_FESTE, pulita);
  root.dispatchEvent?.(
    new CustomEvent("dashboardmodern:store-user-write", { detail: { key: CHIAVE_FESTE } }),
  );
  root.edToast?.(parola);
  return pulita;
}

/* ── i tocchi ───────────────────────────────────────────────────────────── */

function letturaDellaRiga(riga) {
  const campo = (nome) => clean(riga.querySelector(`[data-fe-campo="${nome}"]`)?.value);
  return { entity: campo("entity").toLowerCase(), nome: campo("nome"), tipo: campo("tipo") };
}

function salvaLaRiga(riga) {
  const letta = letturaDellaRiga(riga);
  const config = salvate();
  const indice = riga.dataset.feScrivi === "nuova" ? null : Number(riga.dataset.feScrivi);
  const errore = (testo) => {
    state.errore = testo;
    const posto = riga.querySelector("[data-fe-errore]");
    if (posto) posto.textContent = testo;
  };
  if (!eUnaLuceDiNatale(letta.entity)) {
    const sbagliata = letta.entity || "—";
    errore(
      t(
        `«${sbagliata}» non è una luce: serve una light, uno switch o un input_boolean.`,
        `“${sbagliata}” is not a light: a light, a switch or an input_boolean is needed.`,
      ),
    );
    return;
  }
  if (config.luci.some((altra, i) => altra.entity === letta.entity && i !== indice)) {
    errore(t("Questa luce c'è già.", "This light is already there."));
    return;
  }
  /* L'icona scelta un tempo resta: la scheda non la chiede piu', ma non la
   * butta via. */
  const prima = indice === null ? null : config.luci[indice];
  const luce = { entity: letta.entity, nome: letta.nome, tipo: letta.tipo };
  if (prima?.icona) luce.icona = prima.icona;
  const luci = [...config.luci];
  if (indice === null) luci.push(luce);
  else luci[indice] = luce;
  state.modifica = null;
  state.errore = "";
  salva({ ...config, luci });
  ridisegna({ forza: true });
}

function toccaLAnteprima(cosa) {
  const entita = clean(cosa.dataset.festeEntita).split(" ").filter(Boolean);
  const states = allStates() || {};
  for (const chiamata of chiamateDelTocco(entita, (e) => clean(states?.[e]?.state) === "on"))
    chiamaServizio(chiamata);
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== LUCI_DI_NATALE_TAB || !body.contains(event.target)) return;
  const cosa = event.target.closest?.(".fe-ed-scena [data-feste-entita]");
  if (cosa) {
    event.preventDefault();
    toccaLAnteprima(cosa);
    return;
  }
  const bersaglio = event.target.closest?.(
    "[data-fe-alterna],[data-fe-modifica],[data-fe-elimina],[data-fe-aggiungi],[data-fe-proposta],[data-fe-cerca],[data-fe-tipo],[data-fe-salva],[data-fe-annulla],[data-fe-accendi],[data-fe-giorno]",
  );
  if (!bersaglio) return;
  event.preventDefault();
  const d = bersaglio.dataset;
  const config = salvate();
  if (d.feAlterna) {
    const acceso = bersaglio.getAttribute("aria-checked") === "true";
    chiamaServizio({
      domain: d.feAlterna.split(".")[0],
      service: acceso ? "turn_off" : "turn_on",
      data: { entity_id: d.feAlterna },
    });
    bersaglio.setAttribute("aria-checked", String(!acceso));
    return;
  }
  if (d.feModifica !== undefined) {
    state.modifica = Number(d.feModifica);
    state.errore = "";
    return ridisegna({ forza: true });
  }
  if (d.feElimina !== undefined) {
    const luci = config.luci.filter((_, i) => i !== Number(d.feElimina));
    salva({ ...config, luci }, t("🗑 Luce tolta", "🗑 Light removed"));
    state.modifica = null;
    return ridisegna({ forza: true });
  }
  if (d.feAggiungi !== undefined) {
    state.modifica = "nuova";
    state.errore = "";
    return ridisegna({ forza: true });
  }
  if (d.feProposta) {
    /* Una luce trovata in casa entra col tipo che il suo nome suggerisce. */
    const nome = clean(allStates()?.[d.feProposta]?.attributes?.friendly_name);
    const tipo = tipoDellaLuce({ entity: d.feProposta }, nome);
    salva({
      ...config,
      luci: [
        ...config.luci,
        nome ? { entity: d.feProposta, nome, tipo } : { entity: d.feProposta, tipo },
      ],
    });
    return ridisegna({ forza: true });
  }
  if (d.feCerca) {
    const campo = doc.getElementById(clean(d.feCerca));
    if (campo) root.wzPickEntity?.(campo);
    return;
  }
  if (d.feTipo) {
    const riga = bersaglio.closest("[data-fe-scrivi]");
    const campo = riga?.querySelector('[data-fe-campo="tipo"]');
    if (campo) campo.value = d.feTipo;
    for (const tasto of riga?.querySelectorAll("[data-fe-tipo]") || []) {
      tasto.classList.toggle("si", tasto === bersaglio);
      tasto.setAttribute("aria-pressed", String(tasto === bersaglio));
    }
    return;
  }
  if (d.feSalva !== undefined) return salvaLaRiga(bersaglio.closest("[data-fe-scrivi]"));
  if (d.feAnnulla !== undefined) {
    state.modifica = null;
    state.errore = "";
    return ridisegna({ forza: true });
  }
  if (d.feAccendi) {
    salva({ ...config, accendi: { ...config.accendi, tipo: d.feAccendi } });
    return ridisegna({ forza: true });
  }
  if (d.feGiorno !== undefined) {
    const giorno = Number(d.feGiorno);
    const giorni = config.giorni.includes(giorno)
      ? config.giorni.filter((g) => g !== giorno)
      : [...config.giorni, giorno];
    salva({ ...config, giorni });
    return ridisegna({ forza: true });
  }
}

/* Le cose dell'anteprima si accendono anche dalla tastiera. */
function onKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const cosa = event.target?.closest?.("#ed-body .fe-ed-scena [data-feste-entita]");
  if (!cosa) return;
  event.preventDefault();
  toccaLAnteprima(cosa);
}

function onChange(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== LUCI_DI_NATALE_TAB || !body.contains(event.target)) return;
  const interruttore = event.target.closest?.("[data-fe-interruttore]");
  if (interruttore) {
    const quale = interruttore.dataset.feInterruttore;
    if (quale === "riquadro" || quale === "automatico") {
      salva({ ...salvate(), [quale]: Boolean(interruttore.checked) });
      ridisegna({ forza: true });
    }
    return;
  }
  const campo = event.target.closest?.("[data-fe-orario]");
  if (!campo) return;
  const config = salvate();
  const quale = campo.dataset.feOrario;
  if (quale === "scarto")
    salva({ ...config, accendi: { ...config.accendi, scarto: Number(campo.value) } });
  else if (quale === "accendi" && oraPulita(campo.value))
    salva({ ...config, accendi: { ...config.accendi, ora: oraPulita(campo.value) } });
  else if (quale === "spegni" && oraPulita(campo.value))
    salva({ ...config, spegni: { ora: oraPulita(campo.value) } });
  else return;
  ridisegna({ forza: true });
}

function stili() {
  installStyle(
    "dm-luci-di-natale-editor-style",
    `
${cssDellaScena("#ed-body .fe-ed-scena")}
#ed-body .fe-ed{display:grid;gap:14px;margin:0 0 16px}
#ed-body .fe-ed-carta{border:1px solid var(--divider-color,#e5eaf2);border-radius:20px;padding:18px 20px;margin:0;background:var(--card-background-color,var(--card-bg,#fff))}
#ed-body .fe-ed-testa{padding:10px 10px 16px}
#ed-body .fe-ed-anteprima{position:relative;border-radius:14px;overflow:hidden;background:#0d1838;box-shadow:0 10px 26px rgba(8,20,40,.18)}
#ed-body .fe-ed-scena{height:clamp(170px,30vw,230px)}
#ed-body .fe-ed-scena .sc-cosa{transition:transform .2s ease;transform-box:fill-box;transform-origin:50% 100%}
#ed-body .fe-ed-scena .sc-cosa:active{transform:scale(.97)}
#ed-body .fe-ed-dal-vivo{position:absolute;left:10px;top:10px;display:inline-flex;align-items:center;gap:6px;padding:5px 10px 5px 8px;border-radius:999px;background:rgba(8,16,40,.55);color:#fff;font-size:11.5px;font-weight:600;letter-spacing:.02em;pointer-events:none}
#ed-body .fe-ed-dal-vivo::before{content:"";width:7px;height:7px;border-radius:50%;background:#7fe3a8;box-shadow:0 0 0 3px rgba(127,227,168,.25)}
#ed-body .fe-ed-vuota{display:grid;place-items:center;min-height:120px;padding:18px;border-radius:14px;text-align:center;font-size:13.5px;line-height:1.5;color:var(--text-dim,#5b6476);background:linear-gradient(180deg,color-mix(in srgb,#2f5ba8 10%,transparent),color-mix(in srgb,#f5d27a 12%,transparent));border:1px dashed var(--divider-color,#d5dde9)}
#ed-body .fe-ed-titolo{margin:16px 8px 0;font-size:20px;font-weight:700;letter-spacing:-.2px}
#ed-body .fe-ed-intro{color:var(--text-dim,#5b6476);font-size:13.5px;line-height:1.55;margin:6px 8px 0}
#ed-body .fe-ed-lab{font-size:11.5px;font-weight:700;letter-spacing:1.2px;color:var(--text-dim,#64748b);text-transform:uppercase;margin-top:12px}
#ed-body .fe-ed-lab-primo{margin:0 0 12px}
#ed-body .fe-ed-righe{display:grid;gap:8px}
#ed-body .fe-ed-riga{display:flex;align-items:center;gap:12px;border:1px solid var(--divider-color,#e8edf4);border-radius:14px;padding:10px 12px;background:color-mix(in srgb,var(--text,#0f172a) 2%,transparent);transition:border-color .25s ease,background .25s ease}
#ed-body .fe-ed-riga.accesa{border-color:color-mix(in srgb,#e3ad4f 55%,transparent);background:color-mix(in srgb,#f5c86a 9%,transparent)}
#ed-body .fe-ed-tipo-ic{flex:none;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;color:#24324f;background:linear-gradient(180deg,#eef3fb,#dfe7f4)}
html[data-theme="dark"] #ed-body .fe-ed-tipo-ic{color:#e6ecf8;background:linear-gradient(180deg,#24314f,#1a2440)}
#ed-body .fe-ed-riga.accesa .fe-ed-tipo-ic{background:linear-gradient(180deg,#fff3d6,#ffe1a1);color:#5a3a06;box-shadow:0 0 18px rgba(245,185,66,.35)}
#ed-body .fe-ed-nome{flex:1 1 auto;min-width:0;display:grid;gap:2px}
#ed-body .fe-ed-nome b{font-size:14.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#ed-body .fe-ed-sotto{display:flex;gap:8px;align-items:baseline;min-width:0;font-size:12px;color:var(--text-dim,#64748b)}
#ed-body .fe-ed-sotto em{font-style:normal;font-weight:600;flex:none}
#ed-body .fe-ed-sotto code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.85}
#ed-body .fe-ed-azioni{display:flex;align-items:center;gap:6px;flex:none}
#ed-body .fe-ed-mini{flex:none;display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:6px 10px;border-radius:999px;border:1px solid var(--divider-color,#e2e8f0);background:var(--card-background-color,#fff);color:var(--text,#475569);font-weight:600;font-size:12.5px;cursor:pointer;white-space:nowrap}
#ed-body .fe-ed-int{position:relative;flex:none;width:46px;height:28px;padding:0;margin-left:4px;border:0;border-radius:999px;background:var(--divider-color,#cbd5e1);cursor:pointer;transition:background .2s ease}
#ed-body .fe-ed-int[aria-checked="true"]{background:#e8a63a}
#ed-body .fe-ed-int i{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .18s ease}
#ed-body .fe-ed-int[aria-checked="true"] i{transform:translateX(18px)}
#ed-body .fe-ed-scrivi{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px 14px;align-items:start;padding:14px}
#ed-body .fe-ed-largo{grid-column:1/-1}
#ed-body .fe-ed-voce{display:grid;gap:6px;min-width:0}
#ed-body .fe-ed-voce>span:first-child{font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-dim,#64748b)}
#ed-body .fe-ed-voce .ed-input{margin:0;width:100%;max-width:none}
#ed-body .fe-ed-tipi{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
#ed-body .fe-ed-tipo{display:grid;justify-items:center;gap:6px;padding:12px 4px 10px;border-radius:14px;border:1px solid var(--divider-color,#e2e8f0);background:var(--card-background-color,#fff);color:var(--text,#24324f);font:inherit;font-size:12px;font-weight:600;cursor:pointer;min-width:0}
#ed-body .fe-ed-tipo span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#ed-body .fe-ed-tipo.si{border-color:#d99a2b;background:color-mix(in srgb,#f5c86a 16%,var(--card-background-color,#fff));box-shadow:0 0 0 3px color-mix(in srgb,#e3ad4f 22%,transparent)}
#ed-body .fe-ed-tasti{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
#ed-body .fe-ed-salva{padding:10px 18px;border:0;border-radius:999px;background:linear-gradient(180deg,#ffe6ae,#eeb054);color:#3a2408;font-weight:800;font-size:13px;cursor:pointer;box-shadow:0 6px 16px rgba(238,176,84,.3)}
#ed-body .fe-ed-testo{border-color:transparent;background:none}
#ed-body .fe-ed-aggiungi{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:12px}
#ed-body .fe-ed-piu{padding:9px 16px;border-radius:999px;border:1px solid #0f172a;background:#0f172a;color:#fff;font-weight:700;font-size:13px;cursor:pointer}
html[data-theme="dark"] #ed-body .fe-ed-piu{background:#f8fafc;border-color:#f8fafc;color:#0f172a}
#ed-body .fe-ed-trovate{color:var(--text-dim,#64748b);font-size:13px;margin-left:4px}
#ed-body .fe-ed-orari{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:6px}
#ed-body .fe-ed-colonna{display:grid;gap:8px;align-content:start;min-width:0}
#ed-body .fe-ed-seg{display:inline-flex;gap:4px;padding:4px;border-radius:12px;background:color-mix(in srgb,var(--text,#0f172a) 6%,transparent);width:max-content;max-width:100%}
#ed-body .fe-ed-seg button{border:0;padding:8px 12px;border-radius:9px;background:none;color:var(--text-dim,#475569);font-weight:600;font-size:12.5px;cursor:pointer;white-space:nowrap}
#ed-body .fe-ed-seg button.si{background:var(--card-background-color,#fff);color:var(--text,#0f172a);box-shadow:0 1px 3px rgba(15,23,42,.12)}
#ed-body .fe-ed-quando{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
#ed-body .fe-ed-quando .ed-input{margin:0;width:auto}
#ed-body .fe-ed-sel{min-width:190px}
#ed-body .fe-ed-ora{width:130px}
#ed-body .fe-ed-oggi{font-size:12.5px;font-weight:600;color:var(--text-dim,#64748b)}
#ed-body .fe-ed-nota{font-size:11.5px;line-height:1.45;color:var(--text-dim,#64748b)}
#ed-body .fe-ed-luna{font-size:18px}
#ed-body .fe-ed-giorni{display:flex;gap:6px;flex-wrap:wrap}
#ed-body .fe-ed-interruttori{display:grid;gap:8px}
#ed-body .fe-ed-interruttore{position:relative;display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--divider-color,#e2e8f0);border-radius:14px;cursor:pointer}
#ed-body .fe-ed-interruttore>span{flex:1 1 auto;display:grid;gap:2px;min-width:0}
#ed-body .fe-ed-interruttore small{color:var(--secondary-text-color,#64748b);font-size:12.5px}
#ed-body .fe-ed-interruttore input{position:absolute;opacity:0;width:1px;height:1px;margin:0}
#ed-body .fe-ed-interruttore i{position:relative;flex:none;width:46px;height:28px;border-radius:999px;background:var(--divider-color,#cbd5e1);transition:background .2s ease}
#ed-body .fe-ed-interruttore i::after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .18s ease}
#ed-body .fe-ed-interruttore input:checked+i{background:#22a06b}
#ed-body .fe-ed-interruttore input:checked+i::after{transform:translateX(18px)}
#ed-body .fe-ed-interruttore input:focus-visible+i{outline:2px solid var(--primary-color,#0ea5e9);outline-offset:2px}
#ed-body .fe-ed-giorno{width:36px;height:36px;border-radius:50%;border:1px solid var(--divider-color,#e2e8f0);background:var(--card-background-color,#fff);color:var(--text-dim,#64748b);font-weight:800;font-size:13px;cursor:pointer;text-transform:uppercase}
#ed-body .fe-ed-giorno.si{background:#0f172a;border-color:#0f172a;color:#fff}
html[data-theme="dark"] #ed-body .fe-ed-giorno.si{background:#f5d27a;border-color:#f5d27a;color:#1f1300}
/* Sul telefono i sei tipi stanno su due file da tre, e la riga di una luce
 * tiene l'icona, il nome e l'interruttore; Modifica ed Elimina restano
 * tasti tondi accanto. */
@media (max-width:600px){
  #ed-body .fe-ed-carta{padding:14px}
  #ed-body .fe-ed-testa{padding:8px 8px 14px}
  #ed-body .fe-ed-tipi{grid-template-columns:repeat(3,minmax(0,1fr))}
  #ed-body .fe-ed-riga:not(.fe-ed-scrivi){flex-wrap:wrap;gap:8px 10px;padding:10px}
  #ed-body .fe-ed-riga:not(.fe-ed-scrivi) .fe-ed-nome{flex:1 1 0}
  #ed-body .fe-ed-azioni{order:2;flex-basis:100%;padding-left:50px}
  #ed-body .fe-ed-tipo-ic{width:40px;height:40px}
  #ed-body .fe-ed-mini{padding:6px 9px}
  #ed-body .fe-ed-azioni{gap:4px}
  #ed-body .fe-ed-giorni{gap:4px}
  #ed-body .fe-ed-giorno{width:32px;height:32px}}
@media (prefers-reduced-motion:reduce){
  #ed-body .fe-ed-int,#ed-body .fe-ed-int i,#ed-body .fe-ed-interruttore i,#ed-body .fe-ed-interruttore i::after,#ed-body .fe-ed-riga{transition:none}}
`,
  );
}

export function installLuciDiNataleEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  stili();
  doc.addEventListener("click", onClick);
  doc.addEventListener("keydown", onKeydown);
  doc.addEventListener("change", onChange);
  const ancora = () =>
    root.queueMicrotask?.(() => {
      ensureLuciDiNataleTab();
      ensureLuciDiNataleEditor();
    });
  wrapFunction("apriConfigEntita", "__dmLuciDiNataleEditor", () => {
    ensureLuciDiNataleTab();
    ensureLuciDiNataleEditor();
  });
  onEditorRedraw("__dmLuciDiNataleEditor", ancora);
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, ancora);
  /* Le luci che si accendono e si spengono mentre la scheda e' aperta: gli
   * interruttori e l'anteprima seguono, anche mentre si scrive. E l'anteprima
   * segue la misura della finestra. */
  for (const evento of ["dashboardmodern:state-changed", "resize"])
    root.addEventListener?.(evento, () => {
      if (schedaAttiva() === LUCI_DI_NATALE_TAB) ensureLuciDiNataleEditor();
    });
  ensureLuciDiNataleTab();
  ensureLuciDiNataleEditor();
  return true;
}
