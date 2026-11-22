/* La scheda «Luci di Natale» del config: quali sono, e quando si accendono.
 *
 * L'albero su una presa smart, il presepe, la striscia sul balcone: qui si
 * scelgono (fino a otto, con un nome e un'icona se si vuole), e si dice
 * quando si accendono — al tramonto o a un'ora — quando si spengono e in quali
 * giorni. In Home compaiono nel loro riquadro con «Spegni tutte»; l'orario lo
 * esegue il ponte (`ponte/src/le-luci-di-natale.js`), che gira anche quando
 * nessuno ha la plancia aperta.
 *
 * ── Una scheda che c'e' solo quando serve ─────────────────────────────────
 *
 * Le feste sono una sorpresa: per tutto l'anno questa linguetta non c'e', e
 * nemmeno la ricerca della configurazione trova la sua casella
 * (`cerca-nel-config-section.js`). Compare da sola quando comincia la festa
 * (`inFesta` in `core/feste.js`) e se ne va da sola quando finisce. Quello che
 * c'era scritto resta, e l'anno dopo l'albero e' ancora li'.
 *
 * Per lo stesso motivo nei testi qui dentro non c'e' una data, ne' una parola
 * su quello che la plancia fa da sola in quei giorni: la scheda parla delle
 * luci e basta.
 *
 * ── Si salva a ogni scelta ────────────────────────────────────────────────
 *
 * Non c'e' un tasto «Salva»: ogni scelta e' una risposta (al tramonto o a
 * un'ora, quali giorni), e si scrive appena la si da' — come l'interruttore
 * della Home nei testi della sicurezza. Solo la riga di una luce che si sta
 * aggiungendo o modificando ha il suo «Salva», perche' li' si scrive e si puo'
 * sbagliare l'entita'.
 */
import {
  CHIAVE_FESTE,
  DOMINI_DELLE_LUCI,
  ICONE_DELLE_LUCI,
  LUCI_AL_MASSIMO,
  eUnaLuceDiNatale,
  festePulite,
  iconaDellaLuce,
  inFesta,
  intervalloDelGiorno,
  luciDaProporre,
  oraDi,
  oraPulita,
} from "../core/feste.js";
import { ensureTitoloDellaSezione, riordinaLeLinguette } from "./alberatura-del-config-section.js";
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

/* ── le righe delle luci ────────────────────────────────────────────────── */

function nomeDellaLuce(luce, states) {
  return (
    clean(luce.nome) ||
    clean(states?.[luce.entity]?.attributes?.friendly_name) ||
    luce.entity.split(".")[1].replace(/_/g, " ")
  );
}

const interruttore = (entity, acceso, etichetta) =>
  `<button type="button" class="fe-ed-int" role="switch" aria-checked="${acceso}" data-fe-alterna="${esc(entity)}" aria-label="${esc(etichetta)}"><i></i></button>`;

function rigaDellaLuce(luce, indice, states) {
  const nome = nomeDellaLuce(luce, states);
  const accesa = clean(states?.[luce.entity]?.state) === "on";
  return `<div class="fe-ed-riga" data-fe-riga="${indice}">
    <span class="fe-ed-ic" aria-hidden="true">${esc(iconaDellaLuce(luce, nome))}</span>
    <span class="fe-ed-nome"><b>${esc(nome)}</b><code>${esc(luce.entity)}</code></span>
    <button type="button" class="fe-ed-mini" data-fe-modifica="${indice}">✏️ ${esc(t("Modifica", "Edit"))}</button>
    <button type="button" class="fe-ed-mini" data-fe-elimina="${indice}">🗑 ${esc(t("Elimina", "Delete"))}</button>
    ${interruttore(luce.entity, accesa, nome)}
  </div>`;
}

/* La riga che si scrive: l'entita' con la lente, il nome, l'icona. */
function rigaDaScrivere(luce, indice) {
  const id = `fe-ed-entity-${indice}`;
  const icone = ICONE_DELLE_LUCI.map(
    (icona) =>
      `<button type="button" class="fe-ed-glifo${clean(luce?.icona) === icona ? " si" : ""}" data-fe-icona="${esc(icona)}" aria-label="${esc(icona)}">${esc(icona)}</button>`,
  ).join("");
  return `<div class="fe-ed-riga fe-ed-scrivi" data-fe-scrivi="${esc(indice)}">
    <label class="fe-ed-voce fe-ed-largo"><span>${esc(t("Entità", "Entity"))}</span>
      <span class="ed-form-row"><input id="${id}" class="ed-input mono" data-fe-campo="entity"
        data-domain="${DOMINI_DELLE_LUCI.join(",")}" value="${esc(luce?.entity || "")}"
        placeholder="switch.presa_albero" autocomplete="off" spellcheck="false"><button type="button"
        class="dm-entity-picker" data-fe-cerca="${id}" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span></label>
    <label class="fe-ed-voce"><span>${esc(t("Nome (facoltativo)", "Name (optional)"))}</span>
      <input class="ed-input" data-fe-campo="nome" maxlength="40" value="${esc(luce?.nome || "")}"
        placeholder="${esc(t("Albero", "Tree"))}"></label>
    <label class="fe-ed-voce"><span>${esc(t("Icona (facoltativa)", "Icon (optional)"))}</span>
      <input class="ed-input fe-ed-icona" data-fe-campo="icona" maxlength="8" value="${esc(luce?.icona || "")}"
        placeholder="🎄"></label>
    <div class="fe-ed-glifi fe-ed-largo">${icone}</div>
    <output class="dm-todo-ed-error fe-ed-largo" data-fe-errore>${esc(state.errore)}</output>
    <div class="fe-ed-tasti fe-ed-largo">
      <button type="button" class="fe-ed-salva" data-fe-salva>💾 ${esc(t("Salva luce", "Save light"))}</button>
      <button type="button" class="fe-ed-mini" data-fe-annulla>${esc(t("Annulla", "Cancel"))}</button>
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

/* ── la scheda ──────────────────────────────────────────────────────────── */

export function schedaMarkup(config, states = {}) {
  const proposte = luciDaProporre(states, config, 4);
  const piene = config.luci.length >= LUCI_AL_MASSIMO;
  const righe = config.luci.map((luce, i) =>
    state.modifica === i ? rigaDaScrivere(luce, i) : rigaDellaLuce(luce, i, states),
  );
  if (state.modifica === "nuova") righe.push(rigaDaScrivere(null, "nuova"));
  const aggiungi =
    state.modifica === null && !piene
      ? `<button type="button" class="fe-ed-piu" data-fe-aggiungi>＋ ${esc(t("Aggiungi luce", "Add light"))}</button>`
      : "";
  const trovate =
    proposte.length && !piene
      ? `<span class="fe-ed-trovate">${esc(t("Trovate in casa:", "Found at home:"))}</span>${proposte
          .map(
            (p) =>
              `<button type="button" class="fe-ed-mini" data-fe-proposta="${esc(p.entity)}" title="${esc(p.entity)}">💡 ${esc(p.nome)}</button>`,
          )
          .join("")}`
      : "";
  return `<div class="fe-ed">
    <section class="fe-ed-carta">
      <div class="fe-ed-titolo">✨ ${esc(t("Luci di Natale", "Christmas lights"))}</div>
      <p class="fe-ed-intro">${esc(
        t(
          "L'albero, il presepe, le luci del balcone: compaiono in Home con «Spegni tutte», e si accendono e si spengono da sole all'orario qui sotto, anche con la plancia chiusa. Fino a otto, ognuna con un nome e un'icona se vuoi.",
          "The tree, the nativity scene, the balcony lights: they show up on Home with “Turn all off”, and switch on and off by themselves at the times below, even with the dashboard closed. Up to eight, each with a name and an icon if you like.",
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
      ${righe.length ? `<div class="fe-ed-righe">${righe.join("")}</div>` : ""}
      ${aggiungi || trovate ? `<div class="fe-ed-aggiungi">${aggiungi}${trovate}</div>` : ""}
      ${orariMarkup(config, states)}
    </section>
  </div>`;
}

export function ensureLuciDiNataleTab() {
  const linguette = doc?.querySelector(".ed-tab")?.parentElement;
  if (!linguette) return false;
  const gia = linguette.querySelector(`.ed-tab[data-tab="${LUCI_DI_NATALE_TAB}"]`);
  /* Fuori dalle feste la linguetta non c'e'. Se c'era (il config aperto a
   * cavallo della mezzanotte del 7 gennaio) se ne va. */
  if (!inFesta(new Date())) {
    gia?.remove();
    return false;
  }
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

export function ensureLuciDiNataleEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== LUCI_DI_NATALE_TAB) {
    if (schedaAttiva() !== LUCI_DI_NATALE_TAB) {
      state.modifica = null;
      state.errore = "";
    }
    return false;
  }
  if (!inFesta(new Date())) return false;
  const states = allStates() || {};
  const config = salvate();
  const markup = schedaMarkup(config, states);
  /* Mentre si scrive una riga non si ridisegna niente: un cambio di stato a
   * meta' parola si porterebbe via quello che c'e' scritto. */
  if (body.querySelector("[data-fe-scrivi]") && body.dataset.renderer === LUCI_DI_NATALE_TAB)
    return true;
  if (body.dataset.dmFesteEditor !== markup || !body.querySelector(".fe-ed")) {
    body.dataset.dmFesteEditor = markup;
    body.innerHTML = markup;
    body.dataset.renderer = LUCI_DI_NATALE_TAB;
  }
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
  return { entity: campo("entity").toLowerCase(), nome: campo("nome"), icona: campo("icona") };
}

function salvaLaRiga(riga) {
  const luce = letturaDellaRiga(riga);
  const config = salvate();
  const indice = riga.dataset.feScrivi === "nuova" ? null : Number(riga.dataset.feScrivi);
  const errore = (testo) => {
    state.errore = testo;
    const posto = riga.querySelector("[data-fe-errore]");
    if (posto) posto.textContent = testo;
  };
  if (!eUnaLuceDiNatale(luce.entity)) {
    const sbagliata = luce.entity || "—";
    errore(
      t(
        `«${sbagliata}» non è una luce: serve una light, uno switch o un input_boolean.`,
        `“${sbagliata}” is not a light: a light, a switch or an input_boolean is needed.`,
      ),
    );
    return;
  }
  if (config.luci.some((altra, i) => altra.entity === luce.entity && i !== indice)) {
    errore(t("Questa luce c'è già.", "This light is already there."));
    return;
  }
  const luci = [...config.luci];
  if (indice === null) luci.push(luce);
  else luci[indice] = luce;
  state.modifica = null;
  state.errore = "";
  salva({ ...config, luci });
  ridisegna({ forza: true });
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== LUCI_DI_NATALE_TAB || !body.contains(event.target)) return;
  const bersaglio = event.target.closest?.(
    "[data-fe-alterna],[data-fe-modifica],[data-fe-elimina],[data-fe-aggiungi],[data-fe-proposta],[data-fe-cerca],[data-fe-icona],[data-fe-salva],[data-fe-annulla],[data-fe-accendi],[data-fe-giorno]",
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
    const nome = clean(allStates()?.[d.feProposta]?.attributes?.friendly_name);
    salva({
      ...config,
      luci: [...config.luci, nome ? { entity: d.feProposta, nome } : { entity: d.feProposta }],
    });
    return ridisegna({ forza: true });
  }
  if (d.feCerca) {
    const campo = doc.getElementById(clean(d.feCerca));
    if (campo) root.wzPickEntity?.(campo);
    return;
  }
  if (d.feIcona) {
    const riga = bersaglio.closest("[data-fe-scrivi]");
    const campo = riga?.querySelector('[data-fe-campo="icona"]');
    if (campo) campo.value = d.feIcona;
    for (const glifo of riga?.querySelectorAll("[data-fe-icona]") || [])
      glifo.classList.toggle("si", glifo === bersaglio);
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

function onChange(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== LUCI_DI_NATALE_TAB || !body.contains(event.target)) return;
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
#ed-body .fe-ed-carta{border:1px solid var(--divider-color,#e5eaf2);border-radius:18px;padding:20px 22px;margin:0 0 16px;background:var(--card-background-color,var(--card-bg,#fff))}
#ed-body .fe-ed-titolo{font-size:19px;font-weight:600;display:flex;align-items:center;gap:10px}
#ed-body .fe-ed-intro{color:var(--text-dim,#5b6476);font-size:13.5px;line-height:1.55;margin:8px 0 16px}
#ed-body .fe-ed-righe{display:grid;gap:10px}
#ed-body .fe-ed-riga{display:flex;align-items:center;gap:12px;flex-wrap:wrap;border:1px solid var(--divider-color,#e8edf4);border-radius:14px;padding:12px 14px;background:color-mix(in srgb,var(--text,#0f172a) 2%,transparent)}
#ed-body .fe-ed-ic{flex:none;width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-size:21px;background:color-mix(in srgb,#f5d27a 22%,transparent)}
#ed-body .fe-ed-nome{flex:1 1 160px;min-width:0;display:grid}
#ed-body .fe-ed-nome b{font-size:14.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#ed-body .fe-ed-nome code{font-size:12px;color:var(--text-dim,#64748b);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#ed-body .fe-ed-mini{flex:none;padding:7px 12px;border-radius:999px;border:1px solid var(--divider-color,#e2e8f0);background:var(--card-background-color,#fff);color:var(--text,#475569);font-weight:600;font-size:12.5px;cursor:pointer;white-space:nowrap}
#ed-body .fe-ed-int{position:relative;flex:none;width:44px;height:26px;padding:0;border:0;border-radius:999px;background:var(--divider-color,#cbd5e1);cursor:pointer}
#ed-body .fe-ed-int[aria-checked="true"]{background:#22c55e}
#ed-body .fe-ed-int i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .18s ease}
#ed-body .fe-ed-int[aria-checked="true"] i{transform:translateX(18px)}
#ed-body .fe-ed-scrivi{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px 14px;align-items:end}
#ed-body .fe-ed-largo{grid-column:1/-1}
#ed-body .fe-ed-voce{display:grid;gap:5px;min-width:0}
#ed-body .fe-ed-voce>span:first-child{font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-dim,#64748b)}
#ed-body .fe-ed-voce .ed-input{margin:0;width:100%;max-width:none}
#ed-body .fe-ed-icona{font-size:18px}
#ed-body .fe-ed-glifi{display:flex;flex-wrap:wrap;gap:6px}
#ed-body .fe-ed-glifo{width:36px;height:36px;border-radius:10px;border:1px solid var(--divider-color,#e2e8f0);background:var(--card-background-color,#fff);font-size:18px;cursor:pointer;padding:0}
#ed-body .fe-ed-glifo.si{border-color:#c9952e;box-shadow:0 0 0 3px rgba(201,149,46,.18)}
#ed-body .fe-ed-tasti{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
#ed-body .fe-ed-salva{padding:9px 16px;border:0;border-radius:999px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-weight:800;font-size:13px;cursor:pointer}
#ed-body .fe-ed-aggiungi{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px}
#ed-body .fe-ed-piu{padding:8px 14px;border-radius:999px;border:1px solid #0f172a;background:#0f172a;color:#fff;font-weight:700;font-size:13px;cursor:pointer}
html[data-theme="dark"] #ed-body .fe-ed-piu{background:#f8fafc;border-color:#f8fafc;color:#0f172a}
#ed-body .fe-ed-trovate{color:var(--text-dim,#64748b);font-size:13px}
#ed-body .fe-ed-orari{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:8px}
#ed-body .fe-ed-colonna{display:grid;gap:8px;align-content:start;min-width:0}
#ed-body .fe-ed-lab{font-size:11.5px;font-weight:700;letter-spacing:1.2px;color:var(--text-dim,#64748b);text-transform:uppercase;margin-top:12px}
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
#ed-body .fe-ed-giorno{width:36px;height:36px;border-radius:50%;border:1px solid var(--divider-color,#e2e8f0);background:var(--card-background-color,#fff);color:var(--text-dim,#64748b);font-weight:800;font-size:13px;cursor:pointer;text-transform:uppercase}
#ed-body .fe-ed-giorno.si{background:#0f172a;border-color:#0f172a;color:#fff}
html[data-theme="dark"] #ed-body .fe-ed-giorno.si{background:#f5d27a;border-color:#f5d27a;color:#1f1300}
/* Sul telefono la riga di una luce sta su due piani: in alto l'icona, il nome
 * e l'interruttore, sotto Modifica ed Elimina. */
@media (max-width:600px){
  #ed-body .fe-ed-carta{padding:16px 14px}
  #ed-body .fe-ed-mini{padding:6px 10px}
  #ed-body .fe-ed-riga:not(.fe-ed-scrivi){row-gap:8px}
  #ed-body .fe-ed-riga:not(.fe-ed-scrivi) .fe-ed-nome{flex:1 1 0}
  #ed-body .fe-ed-riga:not(.fe-ed-scrivi) .fe-ed-int{order:1}
  #ed-body .fe-ed-riga:not(.fe-ed-scrivi) .fe-ed-mini{order:2}
  #ed-body .fe-ed-riga:not(.fe-ed-scrivi) [data-fe-modifica]{margin-left:54px}
  #ed-body .fe-ed-giorni{gap:4px}
  #ed-body .fe-ed-giorno{width:32px;height:32px}}
`,
  );
}

export function installLuciDiNataleEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  stili();
  doc.addEventListener("click", onClick);
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
   * interruttori seguono, se nessuno sta scrivendo. */
  root.addEventListener?.("dashboardmodern:state-changed", () => {
    if (schedaAttiva() === LUCI_DI_NATALE_TAB) ensureLuciDiNataleEditor();
  });
  ensureLuciDiNataleTab();
  ensureLuciDiNataleEditor();
  return true;
}
