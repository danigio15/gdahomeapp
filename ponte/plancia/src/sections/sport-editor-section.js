/* La scheda Sport nel Config: Casa › Sport.
 *
 * Qui si sceglie cosa segue la casa, fino a otto cose, nell'ordine in cui la
 * pagina e la finestra della Home le mostrano:
 *
 *   · una squadra di calcio: prima il campionato, poi la squadra dall'elenco
 *     che il ponte chiede alla fonte (`ponte/sport/squadre`). Le partite sono
 *     quelle di tutte le sue competizioni, coppe comprese;
 *   · la Formula 1 e la MotoGP, ognuna col suo pilota del cuore, scelto dalla
 *     classifica di quest'anno: nella pagina e' in evidenza.
 *
 * Ogni gesto e' gia' una scelta e si salva subito, come l'ordine dei blocchi
 * del Meteo. Sopra, la fascia «Sezione visibile», come in ogni scheda.
 */
import {
  CAMPIONATI,
  CHIAVE_SPORT,
  QUANTI_AL_MASSIMO,
  chiaveDelSeguito,
  normalizzaSport,
  spostaIlSeguito,
} from "../core/lo-sport.js";
import { oggettoWidget } from "../core/oggetti-widget.js";
import { SPORT_TAB, configurazioneDelloSport, nomeDelTipo, renderSport, risultatiDelloSport } from "./sport-section.js";
import {
  chiediAHomeAssistant,
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  root,
  senzaCadere,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_SPORT_EDITOR__";
const state = (root[KEY] ||= {
  installed: false,
  /* La squadra che si sta aggiungendo: il campionato scelto e le sue squadre. */
  nuova: { aperta: false, campionato: "ita.1", squadre: {}, caricando: "", guasto: "" },
});

export const SPORT_EDITOR_TAB = SPORT_TAB;

function schedaAttiva() {
  return clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
}

export function salvaLoSport(config) {
  writeJsonIfChanged(CHIAVE_SPORT, normalizzaSport(config));
  try {
    root.render?.();
  } catch (_errore) {}
  try {
    renderSport();
  } catch (_errore) {}
}

/* ── le squadre di un campionato, dal ponte ───────────────────────────── */

async function caricaLeSquadre(campionato) {
  const nuova = state.nuova;
  if (nuova.squadre[campionato] || nuova.caricando === campionato) return;
  nuova.caricando = campionato;
  nuova.guasto = "";
  try {
    const risposta = await chiediAHomeAssistant({ type: "ponte/sport/squadre", campionato }, 20_000);
    nuova.squadre[campionato] = Array.isArray(risposta?.squadre) ? risposta.squadre : [];
  } catch (errore) {
    const codice = clean(errore?.code || errore?.message);
    nuova.guasto = /unknown_command|not permitted/i.test(codice) ? "senza-ponte" : "non-risponde";
  } finally {
    if (nuova.caricando === campionato) nuova.caricando = "";
    ridisegna();
  }
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function gruppoMarkup(chiave, disegno, titolo, corpo, accanto = "") {
  return `<article class="ed-row dm-todo-ed-row dm-allerte-ed-fonte dm-sport-ed-gruppo" data-open="true" data-dm-sport-gruppo="${chiave}">
      <div class="dm-allerte-ed-testa"><span class="dm-sport-ed-ic" aria-hidden="true">${oggettoWidget(
        disegno,
        "",
        `sport-ed-${chiave}`,
      )}</span><strong>${esc(titolo)}</strong>${accanto}</div>
      <div class="dm-todo-ed-body">${corpo}</div>
    </article>`;
}

function pilotiPer(tipo) {
  const vista = risultatiDelloSport();
  const r = vista.risultati.find((x) => x?.tipo === tipo && !x.errore);
  return r?.piloti || [];
}

function sceltaDelPreferito(seguito, indice) {
  const piloti = pilotiPer(seguito.tipo);
  const opzioni = [`<option value="">${esc(t("Nessuno", "None"))}</option>`]
    .concat(
      piloti.map(
        (p) =>
          `<option value="${esc(p.id)}"${p.id === seguito.preferito ? " selected" : ""}>${esc(
            `${p.posizione}. ${p.nome}${seguito.tipo === "f1" ? ` · ${p.scuderia}` : ` · ${p.moto}`}`,
          )}</option>`,
      ),
    )
    .join("");
  const dentro = piloti.length || !seguito.preferito ? "" : `<option value="${esc(seguito.preferito)}" selected>${esc(seguito.preferito)}</option>`;
  return `<label class="ed-slot dm-sport-ed-campo"><span class="ed-slot-lbl">${esc(
    seguito.tipo === "f1" ? t("Pilota del cuore", "Favourite driver") : t("Pilota del cuore", "Favourite rider"),
  )}</span><select class="ed-in" data-dm-sport-preferito="${indice}">${opzioni}${dentro}</select></label>`;
}

function seguitoMarkup(seguito, indice, quanti) {
  const disegno = seguito.tipo === "calcio" ? "sport" : seguito.tipo;
  const nome = seguito.tipo === "calcio" ? seguito.nome || t("Squadra", "Team") : nomeDelTipo(seguito.tipo);
  const sotto =
    seguito.tipo === "calcio"
      ? `${CAMPIONATI[seguito.campionato] || ""} · ${t("tutte le competizioni", "all competitions")}`
      : t("Prossimo gran premio, ultima gara, classifiche", "Next grand prix, last race, standings");
  return `<div class="dm-sport-ed-voce" data-dm-sport-voce="${esc(chiaveDelSeguito(seguito))}">
      <div class="dm-sport-ed-frecce">
        <button type="button" class="ed-del" data-dm-sport-su="${indice}" ${indice === 0 ? "disabled" : ""}
          aria-label="${esc(t("Sposta su", "Move up"))}">▲</button>
        <button type="button" class="ed-del" data-dm-sport-giu="${indice}" ${indice === quanti - 1 ? "disabled" : ""}
          aria-label="${esc(t("Sposta giù", "Move down"))}">▼</button>
      </div>
      <span class="dm-sport-ed-ic" aria-hidden="true">${oggettoWidget(disegno, "", `sport-ed-v-${indice}`)}</span>
      <div class="dm-sport-ed-nome"><strong>${esc(nome)}</strong><small>${esc(sotto)}</small></div>
      <button type="button" class="ed-del dm-sport-ed-togli" data-dm-sport-togli="${indice}" aria-label="${esc(
        t("Togli", "Remove"),
      )}">🗑️</button>
      ${seguito.tipo === "calcio" ? "" : `<div class="dm-sport-ed-sotto">${sceltaDelPreferito(seguito, indice)}</div>`}
    </div>`;
}

function aggiungiMarkup(config) {
  const pieno = config.seguiti.length >= QUANTI_AL_MASSIMO;
  const ce = (tipo) => config.seguiti.some((s) => s.tipo === tipo);
  const nuova = state.nuova;
  const tasti = `<div class="dm-sport-ed-tasti">
      <button type="button" class="ed-add-btn" data-dm-sport-nuova ${pieno ? "disabled" : ""}>⚽ ${esc(t("Squadra di calcio", "Football team"))}</button>
      <button type="button" class="ed-add-btn" data-dm-sport-aggiungi="f1" ${pieno || ce("f1") ? "disabled" : ""}>🏁 Formula 1</button>
      <button type="button" class="ed-add-btn" data-dm-sport-aggiungi="motogp" ${pieno || ce("motogp") ? "disabled" : ""}>🏍️ MotoGP</button>
    </div>`;
  if (!nuova.aperta || pieno) return tasti;
  const campionati = Object.entries(CAMPIONATI)
    .map(([id, nome]) => `<option value="${esc(id)}"${id === nuova.campionato ? " selected" : ""}>${esc(nome)}</option>`)
    .join("");
  const squadre = nuova.squadre[nuova.campionato];
  const gia = new Set(config.seguiti.filter((s) => s.tipo === "calcio").map((s) => s.squadra));
  let scelta = "";
  if (squadre?.length)
    scelta = `<label class="ed-slot dm-sport-ed-campo"><span class="ed-slot-lbl">${esc(t("Squadra", "Team"))}</span>
      <select class="ed-in" data-dm-sport-squadra><option value="">${esc(t("Scegli la squadra…", "Choose the team…"))}</option>${squadre
        .filter((s) => !gia.has(s.id))
        .map((s) => `<option value="${esc(s.id)}" data-nome="${esc(s.nome)}">${esc(s.nome)}</option>`)
        .join("")}</select></label>`;
  else if (nuova.guasto)
    scelta = `<p class="dm-sport-ed-nota">${esc(
      nuova.guasto === "senza-ponte"
        ? t("Le squadre arrivano dall'add-on GdAHome, che da qui non si raggiunge.", "Teams come from the GdAHome add-on, which cannot be reached from here.")
        : t("Le squadre adesso non arrivano: riprova fra poco.", "Teams are not coming in right now: try again shortly."),
    )}</p>`;
  else scelta = `<p class="dm-sport-ed-nota">${esc(t("Arrivano le squadre…", "Fetching teams…"))}</p>`;
  return `${tasti}<div class="dm-sport-ed-nuova">
      <label class="ed-slot dm-sport-ed-campo"><span class="ed-slot-lbl">${esc(t("Campionato", "League"))}</span>
        <select class="ed-in" data-dm-sport-campionato>${campionati}</select></label>
      ${scelta}
      <p class="dm-sport-ed-nota">${esc(
        t(
          "Della squadra si vedono le partite di tutte le competizioni: campionato, coppe ed Europa.",
          "All of the team's competitions are shown: league, cups and Europe.",
        ),
      )}</p>
    </div>`;
}

function fasciaMarkup() {
  try {
    return root.cdSecToggleHtml?.(SPORT_TAB) || "";
  } catch (_errore) {
    return "";
  }
}

function corpoMarkup() {
  const config = configurazioneDelloSport();
  const voci = config.seguiti.map((s, i) => seguitoMarkup(s, i, config.seguiti.length)).join("");
  return `${fasciaMarkup()}<div class="dm-sport-ed">
    <div class="ed-intro">${esc(
      t(
        "La pagina Sport: la tua squadra di calcio, la Formula 1 e la MotoGP, con i risultati, le prossime partite e gare e le classifiche. In Home la tessera dice la cosa che conta adesso: la partita in corso, quella di oggi, l'ultimo podio. I risultati li chiede l'add-on alle fonti pubbliche, solo per chi è entrato.",
        "The Sports page: your football team, Formula 1 and MotoGP, with results, upcoming matches and races, and standings. On Home the tile shows what matters now: the match being played, today's match, the last podium. Results are fetched by the add-on from public sources, only for signed-in users.",
      ),
    )}</div>
    <div class="ed-list dm-todo-ed-list">
      ${gruppoMarkup(
        "seguiti",
        "sport",
        t("Cosa segui", "What you follow"),
        voci
          ? `<div class="dm-sport-ed-voci">${voci}</div>`
          : `<p class="dm-sport-ed-nota">${esc(t("Ancora niente: aggiungi una squadra o un campionato qui sotto.", "Nothing yet: add a team or a championship below."))}</p>`,
        `<span class="dm-sport-ed-conto">${config.seguiti.length}/${QUANTI_AL_MASSIMO}</span>`,
      )}
      ${gruppoMarkup("aggiungi", "f1", t("Aggiungi", "Add"), aggiungiMarkup(config))}
    </div></div>`;
}

function sezioneNascosta() {
  try {
    return root.cdCfg?.("cd_sections")?.[SPORT_TAB] === false;
  } catch (_errore) {
    return false;
  }
}

export function ensureSportEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== SPORT_EDITOR_TAB) return false;
  const piloti = ["f1", "motogp"].map((tipo) => pilotiPer(tipo).length).join(",");
  const firma = `${JSON.stringify(configurazioneDelloSport())}|${sezioneNascosta()}|${JSON.stringify({
    ...state.nuova,
    squadre: Object.keys(state.nuova.squadre),
  })}|${piloti}`;
  if (body.dataset.dmSportEditor === firma && body.querySelector(".dm-sport-ed")) return true;
  body.dataset.dmSportEditor = firma;
  body.innerHTML = corpoMarkup();
  body.dataset.renderer = "sport";
  if (state.nuova.aperta) caricaLeSquadre(state.nuova.campionato);
  return true;
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmSportEditor;
  ensureSportEditor();
}

/* ── i gesti ──────────────────────────────────────────────────────────── */

function nelCorpo(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== SPORT_EDITOR_TAB || !body.contains(event.target)) return null;
  return body;
}

function onClick(event) {
  if (!nelCorpo(event)) return;
  const config = configurazioneDelloSport();
  const su = event.target.closest("[data-dm-sport-su]");
  const giu = event.target.closest("[data-dm-sport-giu]");
  const togli = event.target.closest("[data-dm-sport-togli]");
  const aggiungi = event.target.closest("[data-dm-sport-aggiungi]");
  if (su || giu) {
    event.preventDefault();
    const indice = Number((su || giu).dataset[su ? "dmSportSu" : "dmSportGiu"]);
    salvaLoSport({ seguiti: spostaIlSeguito(config.seguiti, indice, su ? -1 : 1) });
    ridisegna();
    return;
  }
  if (togli) {
    event.preventDefault();
    const indice = Number(togli.dataset.dmSportTogli);
    salvaLoSport({ seguiti: config.seguiti.filter((_s, i) => i !== indice) });
    ridisegna();
    return;
  }
  if (aggiungi) {
    event.preventDefault();
    salvaLoSport({ seguiti: [...config.seguiti, { tipo: clean(aggiungi.dataset.dmSportAggiungi) }] });
    ridisegna();
    root.edToast?.(t("✅ Aggiunto allo sport", "✅ Added to sports"));
    return;
  }
  if (event.target.closest("[data-dm-sport-nuova]")) {
    event.preventDefault();
    state.nuova.aperta = !state.nuova.aperta;
    ridisegna();
  }
}

function onChange(event) {
  if (!nelCorpo(event)) return;
  const config = configurazioneDelloSport();
  const campionato = event.target.closest("[data-dm-sport-campionato]");
  if (campionato) {
    state.nuova.campionato = Object.hasOwn(CAMPIONATI, campionato.value) ? campionato.value : "ita.1";
    ridisegna();
    return;
  }
  const squadra = event.target.closest("[data-dm-sport-squadra]");
  if (squadra && /^\d{1,7}$/.test(squadra.value)) {
    const nome = clean(squadra.selectedOptions?.[0]?.dataset?.nome);
    salvaLoSport({
      seguiti: [...config.seguiti, { tipo: "calcio", campionato: state.nuova.campionato, squadra: squadra.value, nome }],
    });
    state.nuova.aperta = false;
    ridisegna();
    root.edToast?.(t("✅ Squadra aggiunta", "✅ Team added"));
    return;
  }
  const preferito = event.target.closest("[data-dm-sport-preferito]");
  if (preferito) {
    const indice = Number(preferito.dataset.dmSportPreferito);
    salvaLoSport({
      seguiti: config.seguiti.map((s, i) => (i === indice ? { ...s, preferito: clean(preferito.value) } : s)),
    });
    ridisegna();
  }
}

export function ensureSportEditorTab() {
  const linguette = doc?.querySelector(".ed-tab")?.parentElement;
  if (!linguette || linguette.querySelector(`.ed-tab[data-tab="${SPORT_EDITOR_TAB}"]`)) return false;
  const linguetta = doc.createElement("button");
  linguetta.className = "ed-tab";
  linguetta.dataset.tab = SPORT_EDITOR_TAB;
  linguetta.textContent = `⚽ ${t("Sport", "Sports")}`;
  linguetta.addEventListener("click", () => root.editorSwitch?.(SPORT_EDITOR_TAB));
  const prima = linguette.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(linguetta);
  else linguette.append(linguetta);
  return true;
}

function installStyles() {
  installStyle(
    "dm-sport-editor-style",
    `
      #ed-body .dm-sport-ed-gruppo{display:block}
      #ed-body .dm-sport-ed-ic{display:inline-flex;width:28px;height:28px;flex:0 0 auto}
      #ed-body .dm-sport-ed-ic svg{width:28px;height:28px}
      #ed-body .dm-sport-ed-conto{font-size:10px;font-weight:900;letter-spacing:.6px;padding:3px 8px;border-radius:999px;
        margin-left:auto;color:#047857;background:color-mix(in srgb,#10b981 14%,transparent)}
      #ed-body .dm-sport-ed-voci{display:grid;gap:8px}
      #ed-body .dm-sport-ed-voce{display:grid;grid-template-columns:auto auto minmax(0,1fr) auto;align-items:center;gap:12px;
        padding:10px 12px;border-radius:14px;border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff)}
      #ed-body .dm-sport-ed-nome{display:grid;min-width:0}
      #ed-body .dm-sport-ed-nome strong{font-size:13.5px;font-weight:900;color:var(--text,#0f172a)}
      #ed-body .dm-sport-ed-nome small{font-size:10.5px;font-weight:700;color:var(--text-dim,#64748b)}
      #ed-body .dm-sport-ed-sotto{grid-column:3/-1}
      #ed-body .dm-sport-ed-frecce{display:flex;gap:4px}
      #ed-body .dm-sport-ed-frecce .ed-del[disabled]{opacity:.25;cursor:default}
      #ed-body .dm-sport-ed-tasti{display:flex;flex-wrap:wrap;gap:8px}
      #ed-body .dm-sport-ed-tasti .ed-add-btn{flex:1 1 160px}
      #ed-body .dm-sport-ed-tasti .ed-add-btn[disabled]{opacity:.4;cursor:default}
      #ed-body .dm-sport-ed-nuova{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px;padding:12px;
        border-radius:14px;background:var(--surface-2,#f8fafc);border:1px dashed var(--card-border,#e2e8f0)}
      #ed-body .dm-sport-ed-nuova .dm-sport-ed-nota{grid-column:1/-1}
      #ed-body .dm-sport-ed-campo{display:grid;gap:4px;margin:0}
      #ed-body .dm-sport-ed-nota{font-size:11.5px;font-weight:700;line-height:1.45;color:var(--text-dim,#64748b);margin:2px}
      @media(max-width:760px){
        #ed-body .dm-sport-ed-nuova{grid-template-columns:minmax(0,1fr)}
        #ed-body .dm-sport-ed-voce{grid-template-columns:auto minmax(0,1fr) auto}
        #ed-body .dm-sport-ed-voce .dm-sport-ed-ic{display:none}
        #ed-body .dm-sport-ed-sotto{grid-column:1/-1}
      }
    `,
  );
}

export function installSportEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  doc.addEventListener("click", onClick);
  doc.addEventListener("change", onChange);
  wrapFunction("apriConfigEntita", "__dmSportEditor", () => {
    ensureSportEditorTab();
    ensureSportEditor();
  });
  ensureSportEditorTab();
  onEditorRedraw("__dmSportEditor", () => {
    root.queueMicrotask?.(() => {
      ensureSportEditorTab();
      ensureSportEditor();
    });
  });
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, () => {
      root.queueMicrotask?.(() => {
        ensureSportEditorTab();
        ensureSportEditor();
      });
    });
  ensureSportEditor();
  return true;
}

senzaCadere(installSportEditor);
