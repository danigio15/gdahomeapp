/* La scheda «A muro» del config: dove una plancia diventa un pannello per un
 * tablet fisso.
 *
 * Sta sotto «Plancia», accanto alle Azioni. Si sceglie da quale plancia
 * prendere le cose (di solito la principale), le pagine del tablet — fino a
 * quattro, ognuna Stanza, Scene o Ingresso — e le funzioni a muro: verso,
 * tema, riposo, notte, avvisi, risveglio, blocco col PIN.
 *
 * Con gdahome Base la scheda si vede, chiusa: dice cosa farebbe e come si
 * apre. Quello che c'era scritto resta, e torna buono il giorno che la casa e'
 * Premium. */
import {
  CHIAVE_MURO,
  MINUTI_DI_RIPOSO,
  PAGINE_AL_MASSIMO,
  POSTI,
  comandiProposti,
  eUnaScena,
  muroPulito,
  nuovaPagina,
} from "../core/plancia-a-muro.js";
import { oggettoWidget } from "../core/oggetti-widget.js";
import { ensureTitoloDellaSezione, riordinaLeLinguette } from "./alberatura-del-config-section.js";
import { bridgeRequest, currentProfile } from "./config-persistence-section.js";
import { fonteDelMuro, premiumDellaCasa } from "./plancia-a-muro-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  senzaCadere,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_PLANCIA_A_MURO_EDITOR__";
const state = (root[KEY] ||= {
  installed: false,
  bozza: null,
  fonte: null,
  premium: null,
  plance: null,
  chiedendo: false,
});

export const MURO_EDITOR_TAB = "muro";

const schedaAttiva = () => clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
const bozza = () => (state.bozza ||= muroPulito(readJson(CHIAVE_MURO, null)));
const disegno = (chiave, misura, dove) =>
  oggettoWidget(chiave, "", `muro-ed-${dove}`).replace(
    'class="dm-oggetto"',
    `class="dm-oggetto" style="width:${misura}px;height:${misura}px"`,
  );

/* Quello che serve alla scheda e si chiede al ponte: la licenza, la fonte, le
 * plance della casa. Si chiede una volta per apertura. */
async function chiediAlPonte() {
  if (state.chiedendo) return;
  state.chiedendo = true;
  try {
    state.premium = await premiumDellaCasa({ forza: true });
    state.fonte = await fonteDelMuro(bozza(), { forza: true });
    try {
      const elenco = await bridgeRequest("ponte/plance/elenco", {});
      state.plance = Array.isArray(elenco?.plance) ? elenco.plance : null;
    } catch (_errore) {
      state.plance = null;
    }
  } finally {
    state.chiedendo = false;
    ridisegna();
  }
}

const interruttore = (via, acceso, etichetta) =>
  `<button type="button" class="mu-ed-int" role="switch" aria-checked="${acceso}" data-mu-ed-alterna="${esc(via)}" aria-label="${esc(etichetta)}"><i></i></button>`;
const scelte = (via, valore, voci) =>
  `<span class="mu-ed-seg">${voci
    .map(
      ([v, testo]) =>
        `<button type="button" class="${String(v) === String(valore) ? "si" : ""}" data-mu-ed-metti="${esc(via)}" data-mu-ed-valore="${esc(v)}">${esc(testo)}</button>`,
    )
    .join("")}</span>`;
const tendina = (via, valore, voci, vuota = "") =>
  `<select class="ed-input mu-ed-sel" data-mu-ed-campo="${esc(via)}">${
    vuota !== null ? `<option value="">${esc(vuota || "—")}</option>` : ""
  }${voci
    .map(
      ([v, testo]) =>
        `<option value="${esc(v)}"${String(v) === String(valore) ? " selected" : ""}>${esc(testo)}</option>`,
    )
    .join(
      "",
    )}${valore && !voci.some(([v]) => String(v) === String(valore)) ? `<option value="${esc(valore)}" selected>${esc(valore)}</option>` : ""}</select>`;
const campo = (via, valore, segnaposto = "", tipo = "text") =>
  `<input class="ed-input${tipo === "text" ? " mono" : ""} mu-ed-campo" type="${tipo}" data-mu-ed-campo="${esc(via)}" value="${esc(valore)}" placeholder="${esc(segnaposto)}" autocomplete="off" spellcheck="false"${tipo === "password" ? ' inputmode="numeric"' : ""}>`;
const riga = (titolo, nota, destra) =>
  `<div class="mu-ed-riga"><div class="mu-ed-testo"><b>${esc(titolo)}</b>${nota ? `<small>${esc(nota)}</small>` : ""}</div><div class="mu-ed-dx">${destra}</div></div>`;

const nomeDi = (id) =>
  clean(
    [
      ...(state.fonte?.luci || []),
      ...(state.fonte?.clima || []),
      ...(state.fonte?.tapparelle || []),
    ].find((d) => d.entity === id)?.name,
  ) ||
  clean(allStates()?.[id]?.attributes?.friendly_name) ||
  id;
const entitaDel = (dominio) =>
  Object.keys(allStates() || {})
    .filter((id) => id.startsWith(`${dominio}.`))
    .sort();

/* Le voci della tendina di un posto: tutto quello che il tablet sa comandare. */
function vociDeiComandi() {
  const f = state.fonte || {};
  return [
    ...(f.luci || []).map((d) => [`luce|${d.entity}`, `💡 ${nomeDi(d.entity)}`]),
    ...(f.clima || []).map((d) => [`clima|${d.entity}`, `🌡️ ${nomeDi(d.entity)}`]),
    ...(f.tapparelle || []).map((d) => [`tapparella|${d.entity}`, `🪟 ${nomeDi(d.entity)}`]),
    ...(f.azioni || []).filter(eUnaScena).map((a) => [`azione|${a.name}`, `⚡ ${a.name}`]),
  ];
}
const chiaveDel = (c) => (c ? `${c.tipo}|${c.tipo === "azione" ? c.azione : c.entita}` : "");

const MODELLI = () => [
  ["stanza", t("Stanza", "Room")],
  ["scene", t("Scene", "Scenes")],
  ["ingresso", t("Ingresso", "Entrance")],
];

function paginaMarkup(p, i, tutte) {
  const f = state.fonte || {};
  const via = `pagine.${i}`;
  let dentro = "";
  if (p.modello === "stanza") {
    const comandi = p.scelti ? p.comandi : comandiProposti(f, p.stanza);
    dentro = `${riga(
      t("Stanza", "Room"),
      t("Il nome compare in alto sul tablet", "The name shows at the top of the tablet"),
      tendina(
        `${via}.stanza`,
        p.stanza,
        (f.stanze || []).map((s) => [s.name, s.name]),
        t("Scegli una stanza", "Choose a room"),
      ),
    )}
    ${riga(
      t("I comandi seguono la stanza", "Controls follow the room"),
      t(
        "Accesa, una luce aggiunta alla stanza nella plancia di origine compare da sola. Spenta, i sei posti si scelgono qui.",
        "On, a light added to the room in the source dashboard shows up by itself. Off, the six slots are chosen here.",
      ),
      interruttore(
        `${via}.segue`,
        !p.scelti,
        t("I comandi seguono la stanza", "Controls follow the room"),
      ),
    )}
    <div class="mu-ed-posti">${Array.from({ length: POSTI }, (_, k) => {
      const c = comandi[k];
      return `<div class="mu-ed-posto"><span class="mu-ed-num">${k + 1}</span>${
        p.scelti
          ? `<span class="mu-ed-frecce"><button type="button" data-mu-ed-posto-su="${i}.${k}" aria-label="▲">▲</button><button type="button" data-mu-ed-posto-giu="${i}.${k}" aria-label="▼">▼</button></span>${tendina(`${via}.comandi.${k}`, chiaveDel(c), vociDeiComandi(), t("Posto libero", "Empty slot"))}`
          : `<span class="mu-ed-proposto">${c ? esc(c.tipo === "azione" ? `⚡ ${c.azione}` : nomeDi(c.entita)) : esc(t("Posto libero", "Empty slot"))}</span>`
      }</div>`;
    }).join("")}</div>
    <div class="mu-ed-sotto-titolo">${esc(t("La riga in alto", "The top row"))}</div>
    ${riga(t("Temperatura e umidità della stanza", "Room temperature and humidity"), "", interruttore(`${via}.riga.clima`, p.riga.clima, "clima"))}
    ${riga(t("Stato dell'antifurto", "Alarm state"), "", interruttore(`${via}.riga.antifurto`, p.riga.antifurto, "antifurto"))}
    ${riga(t("Chi è in casa", "Who is home"), "", interruttore(`${via}.riga.persone`, p.riga.persone, "persone"))}
    ${riga(t("Meteo", "Weather"), "", interruttore(`${via}.riga.meteo`, p.riga.meteo, "meteo"))}`;
  } else if (p.modello === "scene") {
    const azioni = (f.azioni || []).filter(eUnaScena).map((a) => [a.name, a.name]);
    dentro = `<div class="mu-ed-nota">${esc(
      t(
        "Si scelgono fra le Azioni della plancia di origine: quello che fa ognuna si cambia lì. Qui si sceglie il nome che si legge sul tablet e la riga sotto.",
        "They come from the source dashboard's Actions: what each one does is changed there. Here you choose the name shown on the tablet and the line below.",
      ),
    )}</div>
    <div class="mu-ed-posti">${Array.from({ length: POSTI }, (_, k) => {
      const s = p.scene[k];
      return `<div class="mu-ed-posto"><span class="mu-ed-num">${k + 1}</span>${tendina(`${via}.scene.${k}.azione`, s?.azione || "", azioni, t("Posto libero", "Empty slot"))}${s ? `${campo(`${via}.scene.${k}.nome`, s.nome, t("Nome sul tablet", "Name on the tablet"))}${campo(`${via}.scene.${k}.sotto`, s.sotto, t("Riga sotto", "Line below"))}` : ""}</div>`;
    }).join("")}</div>`;
  } else {
    const ing = p.ingresso;
    const centrali = [...new Set([...(f.centrali || []), ...entitaDel("alarm_control_panel")])].map(
      (id) => [id, nomeDi(id)],
    );
    const azioni = (f.azioni || []).filter(eUnaScena).map((a) => [a.name, a.name]);
    const apribili = ["button", "lock", "cover", "switch", "script", "input_button"]
      .flatMap(entitaDel)
      .map((id) => [id, `${nomeDi(id)} · ${id}`]);
    dentro = `${riga(t("Centrale dell'antifurto", "Alarm panel"), t("I modi sono quelli che la centrale accetta", "The modes are the ones the panel accepts"), tendina(`${via}.ingresso.centrale`, ing.centrale, centrali))}
    ${riga(t("Avvisa se restano finestre aperte", "Warn about open windows"), "", interruttore(`${via}.ingresso.finestre`, ing.finestre, "finestre"))}
    ${riga(
      t("Telecamera", "Camera"),
      t("Il video del citofono", "The intercom video"),
      tendina(
        `${via}.ingresso.telecamera`,
        ing.telecamera,
        entitaDel("camera").map((id) => [id, nomeDi(id)]),
      ),
    )}
    ${riga(t("Tasto grande", "Big button"), t("Per esempio: apri cancello", "For example: open the gate"), tendina(`${via}.ingresso.apri`, ing.apri, apribili))}
    ${riga(t("Secondo tasto", "Second button"), t("Per esempio: apri porta", "For example: open the door"), tendina(`${via}.ingresso.apri2`, ing.apri2, apribili))}
    ${riga(t("Esco", "Leaving"), t("L'azione del tasto in basso quando l'antifurto è spento", "The bottom button's action when the alarm is off"), tendina(`${via}.ingresso.esco`, ing.esco, azioni))}
    ${riga(t("Rientro", "I'm home"), t("Al posto di «Esco» quando l'antifurto è inserito", "Instead of «Leaving» when the alarm is armed"), tendina(`${via}.ingresso.rientro`, ing.rientro, azioni))}
    ${riga(t("Chiedi conferma prima di «Esco» e «Rientro»", "Confirm before «Leaving» and «I'm home»"), "", interruttore(`${via}.confermaUscita`, p.confermaUscita, "conferma"))}
    ${riga(t("Chi è in casa", "Who is home"), "", interruttore(`${via}.ingresso.persone`, ing.persone, "persone"))}`;
  }
  return `<div class="mu-ed-pagina" data-mu-ed-pagina="${i}">
    <div class="mu-ed-pagina-testa">${disegno({ stanza: "stanze", scene: "azioni", ingresso: "sicurezza" }[p.modello], 24, `pag-${i}`)}<b>${esc(t("Pagina", "Page"))} ${i + 1}</b>
      <span class="mu-ed-frecce"><button type="button" data-mu-ed-pagina-su="${i}"${i === 0 ? " disabled" : ""} aria-label="▲">▲</button><button type="button" data-mu-ed-pagina-giu="${i}"${i === tutte - 1 ? " disabled" : ""} aria-label="▼">▼</button></span>
      <button type="button" class="ed-del" data-mu-ed-togli="${i}" aria-label="${esc(t("Togli la pagina", "Remove page"))}">🗑️</button></div>
    ${riga(t("Modello", "Template"), "", scelte(`${via}.modello`, p.modello, MODELLI()))}
    ${riga(t("Nome della linguetta", "Tab name"), t("Vuoto: il nome della stanza o del modello", "Empty: the room or template name"), campo(`${via}.titolo`, p.titolo, ""))}
    ${dentro}</div>`;
}

function corpoMarkup() {
  const m = bozza();
  const premium = state.premium === true;
  const plance = state.plance?.length ? state.plance : [{ profilo: "primary", titolo: "gdahome" }];
  const qui = currentProfile();
  const altre = plance.filter((p) => p.profilo !== qui || p.profilo === m.fonte);
  const contenuto = `
  <div class="ed-intro">${esc(
    t(
      "Questa plancia diventa un pannello per un tablet a muro: una schermata sola, comandi grandi, niente menu. Le cose che mostra — stanze, luci, clima, antifurto, azioni — le prende da un'altra plancia della casa: qui si sceglie solo cosa mostrare e come si comporta. Il pannello compare chiudendo il config; per tornare alla plancia si tiene premuto l'orologio per due secondi.",
      "This dashboard becomes a panel for a wall tablet: one screen, big controls, no menus. What it shows — rooms, lights, climate, alarm, actions — comes from another dashboard of the house: here you only choose what to show and how it behaves. The panel appears when the config is closed; to get back to the dashboard, hold the clock for two seconds.",
    ),
  )} <span class="mu-ed-premium">PREMIUM</span></div>
  <div class="mu-ed-blocco">
    ${riga(t("Usa questa plancia a muro", "Use this dashboard on the wall"), t("Vale su ogni tablet che apre questa plancia", "Applies to every tablet that opens this dashboard"), interruttore("attiva", m.attiva, "attiva"))}
    ${riga(
      t("Prende le cose da", "Takes things from"),
      t(
        "Le stanze, le luci, le azioni e l'antifurto arrivano da qui",
        "Rooms, lights, actions and the alarm come from here",
      ),
      tendina(
        "fonte",
        m.fonte,
        altre.map((p) => [
          p.profilo,
          p.profilo === "primary" ? `${p.titolo} (${t("principale", "main")})` : p.titolo,
        ]),
        null,
      ),
    )}
  </div>
  <div class="ed-sec-title">${esc(t("Le pagine di questo tablet", "This tablet's pages"))}</div>
  ${
    state.fonte
      ? m.pagine.map((p, i) => paginaMarkup(p, i, m.pagine.length)).join("") ||
        `<div class="mu-ed-nota">${esc(t("Ancora nessuna pagina: aggiungine una qui sotto.", "No pages yet: add one below."))}</div>`
      : `<div class="mu-ed-nota">${esc(t("Leggo la plancia di origine…", "Reading the source dashboard…"))}</div>`
  }
  ${
    m.pagine.length < PAGINE_AL_MASSIMO
      ? `<div class="mu-ed-aggiungi"><span>＋ ${esc(t("Aggiungi una pagina", "Add a page"))}</span>${MODELLI()
          .map(
            ([v, testo]) =>
              `<button type="button" class="ed-btn-add" data-mu-ed-nuova="${v}">${esc(testo)}</button>`,
          )
          .join("")}</div>`
      : ""
  }
  <div class="ed-sec-title">${esc(t("Funzioni a muro", "Wall features"))}</div>
  <div class="mu-ed-blocco">
    ${riga(
      t("Orientamento", "Orientation"),
      t("Automatico segue come è montato il tablet", "Automatic follows how the tablet is mounted"),
      scelte("orientamento", m.orientamento, [
        ["auto", t("Automatico", "Automatic")],
        ["orizzontale", t("Orizzontale", "Landscape")],
        ["verticale", t("Verticale", "Portrait")],
      ]),
    )}
    ${riga(
      t("Tema", "Theme"),
      t(
        "Con l'orario: chiaro di giorno, scuro la sera",
        "By the clock: light by day, dark in the evening",
      ),
      scelte("tema", m.tema, [
        ["plancia", t("Come la plancia", "Like the dashboard")],
        ["scuro", t("Scuro", "Dark")],
        ["chiaro", t("Chiaro", "Light")],
        ["orario", t("Con l'orario", "By the clock")],
      ]),
    )}
    ${riga(
      t("Riposo", "Rest"),
      t(
        "Dopo un po' senza tocchi resta l'orologio",
        "After a while without touches only the clock stays",
      ),
      `${tendina(
        "riposo.minuti",
        m.riposo.minuti,
        MINUTI_DI_RIPOSO.map((n) => [n, `${n} min`]),
        null,
      )}${interruttore("riposo.attivo", m.riposo.attivo, "riposo")}`,
    )}
    ${riga(t("Di notte schermo nero", "Black screen at night"), t("Nella fascia scelta il riposo spegne anche l'orologio", "In the chosen hours rest turns off the clock too"), `${campo("notte.da", m.notte.da, "23:00", "time")}${campo("notte.a", m.notte.a, "06:30", "time")}${interruttore("notte.attiva", m.notte.attiva, "notte")}`)}
    ${riga(t("Avvisi sul riposo", "Alerts while resting"), t("Gli avvisi personalizzati accesi e l'antifurto che suona compaiono anche a schermo spento", "Active custom alerts and a triggered alarm show even on the rest screen"), interruttore("avvisi", m.avvisi, "avvisi"))}
    ${riga(
      t("Si sveglia da solo", "Wakes up by itself"),
      t(
        "Quando questo sensore si accende (per esempio una presenza)",
        "When this sensor turns on (for example a presence sensor)",
      ),
      `${tendina(
        "risveglio.entita",
        m.risveglio.entita,
        entitaDel("binary_sensor").map((id) => [id, nomeDi(id)]),
      )}${interruttore("risveglio.attivo", m.risveglio.attivo, "risveglio")}`,
    )}
    ${riga(t("Blocca il tablet", "Lock the tablet"), t("Per uscire dal pannello serve il PIN, da 4 a 8 cifre", "Leaving the panel needs the PIN, 4 to 8 digits"), `${campo("blocco.pin", m.blocco.pin, "PIN", "password")}${interruttore("blocco.attivo", m.blocco.attivo, "blocco")}`)}
    ${riga(t("Antifurto e serrature chiedono il codice", "Alarm and locks ask for the code"), t("Sempre, quando la centrale ne ha uno", "Always, when the panel has one"), `<span class="mu-ed-int fermo" aria-checked="true"><i></i></span>`)}
  </div>
  <button type="button" class="ed-save-btn" data-mu-ed-salva>💾 ${esc(t("Salva", "Save"))}</button>`;
  if (premium || state.premium === null)
    return `<div class="mu-ed">${state.premium === null ? `<div class="mu-ed-nota">${esc(t("Controllo la licenza…", "Checking the licence…"))}</div>` : ""}${contenuto}</div>`;
  return `<div class="mu-ed mu-ed-chiuso"><div class="mu-ed-dietro" aria-hidden="true">${contenuto}</div>
    <div class="mu-ed-lucchetto">${disegno("evidenza", 44, "lucchetto")}
      <b>${esc(t("La plancia a muro è Premium", "The wall dashboard is Premium"))}</b>
      <p>${esc(
        t(
          "Con gdahome Base questa plancia resta una plancia normale. Con Premium diventa un pannello per un tablet a muro: Stanza, Scene o Ingresso, in orizzontale e in verticale. Premium si attiva dall'app gdahome.",
          "With gdahome Base this dashboard stays a normal dashboard. With Premium it becomes a panel for a wall tablet: Room, Scenes or Entrance, landscape and portrait. Premium is turned on from the gdahome app.",
        ),
      )}</p></div></div>`;
}

export function ensureMuroEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== MURO_EDITOR_TAB) {
    if (schedaAttiva() !== MURO_EDITOR_TAB) {
      state.bozza = null;
      state.fonte = null;
      state.premium = null;
    }
    return false;
  }
  if (state.fonte === null && state.premium === null && !state.chiedendo) chiediAlPonte();
  const firma = JSON.stringify([
    bozza(),
    Boolean(state.fonte),
    state.premium,
    state.plance?.length,
  ]);
  if (body.dataset.dmMuroEditor === firma && body.querySelector(".mu-ed")) return true;
  body.dataset.dmMuroEditor = firma;
  body.innerHTML = corpoMarkup();
  body.dataset.renderer = MURO_EDITOR_TAB;
  /* Il titolo della scheda lo mette l'alberatura quando il guscio ridisegna;
   * questa scheda si riscrive anche da sola (la risposta del ponte, un tasto
   * premuto), e il titolo si rimette qui. */
  ensureTitoloDellaSezione();
  return true;
}

function ridisegna() {
  const body = doc?.getElementById("ed-body");
  if (body) delete body.dataset.dmMuroEditor;
  ensureMuroEditor();
}

/* ── scrivere nella bozza ────────────────────────────────────────────────── */

function metti(via, valore) {
  const m = structuredClone(bozza());
  const pezzi = via.split(".");
  /* Le scorciatoie che non sono un campo e basta. */
  if (pezzi[0] === "pagine") {
    const i = Number(pezzi[1]);
    const p = m.pagine[i];
    if (!p) return;
    if (pezzi[2] === "segue") {
      p.scelti = !valore;
      if (p.scelti && !p.comandi.length) p.comandi = comandiProposti(state.fonte || {}, p.stanza);
      state.bozza = muroPulito(m);
      return;
    }
    if (pezzi[2] === "comandi") {
      const k = Number(pezzi[3]);
      const [tipo, ...resto] = String(valore || "").split("|");
      const dove = resto.join("|");
      const comandi = Array.from({ length: POSTI }, (_, n) => p.comandi[n] || null);
      comandi[k] = tipo
        ? tipo === "azione"
          ? { tipo, azione: dove }
          : { tipo, entita: dove }
        : null;
      /* I posti vuoti in mezzo restano vuoti sul tablet: si tengono come
       * comandi spenti, e la normalizzazione li toglie in coda. */
      p.comandi = comandi.filter(Boolean);
      p.scelti = true;
      state.bozza = muroPulito(m);
      return;
    }
    if (pezzi[2] === "scene") {
      const k = Number(pezzi[3]);
      const scene = Array.from({ length: POSTI }, (_, n) => p.scene[n] || null);
      if (pezzi[4] === "azione") scene[k] = valore ? { ...(scene[k] || {}), azione: valore } : null;
      else if (scene[k]) scene[k] = { ...scene[k], [pezzi[4]]: valore };
      p.scene = scene.filter(Boolean);
      state.bozza = muroPulito(m);
      return;
    }
    if (pezzi[2] === "modello" && p.modello !== valore) {
      m.pagine[i] = { ...nuovaPagina(valore, state.fonte || {}, i), id: p.id, titolo: p.titolo };
      state.bozza = muroPulito(m);
      return;
    }
  }
  let dove = m;
  for (const pezzo of pezzi.slice(0, -1)) dove = dove?.[Number.isInteger(+pezzo) ? +pezzo : pezzo];
  if (!dove) return;
  const ultimo = pezzi.at(-1);
  dove[ultimo] = typeof dove[ultimo] === "number" ? Number(valore) : valore;
  /* Un sensore scelto per il risveglio lo accende; il PIN scritto, il blocco. */
  if (via === "risveglio.entita" && valore) m.risveglio.attivo = true;
  if (via === "fonte") state.fonte = null;
  state.bozza = muroPulito(m);
  if (via === "fonte") chiediAlPonte();
}

function leggiDalPercorso(via) {
  return via
    .split(".")
    .reduce((dove, pezzo) => dove?.[Number.isInteger(+pezzo) ? +pezzo : pezzo], bozza());
}

function sposta(elenco, da, a) {
  if (a < 0 || a >= elenco.length) return elenco;
  const copia = elenco.slice();
  const [preso] = copia.splice(da, 1);
  copia.splice(a, 0, preso);
  return copia;
}

function onClick(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== MURO_EDITOR_TAB || !body.contains(event.target)) return;
  const el = event.target.closest(
    "[data-mu-ed-alterna],[data-mu-ed-metti],[data-mu-ed-nuova],[data-mu-ed-togli],[data-mu-ed-pagina-su],[data-mu-ed-pagina-giu],[data-mu-ed-posto-su],[data-mu-ed-posto-giu],[data-mu-ed-salva]",
  );
  if (!el || body.querySelector(".mu-ed-chiuso")) return;
  event.preventDefault();
  const d = el.dataset;
  if (d.muEdAlterna) {
    const via = d.muEdAlterna;
    const ora = via.endsWith(".segue")
      ? !leggiDalPercorso(via.replace(/segue$/, "scelti"))
      : leggiDalPercorso(via);
    metti(via, !ora);
  } else if (d.muEdMetti) metti(d.muEdMetti, d.muEdValore);
  else if (d.muEdNuova) {
    const m = structuredClone(bozza());
    m.pagine.push(nuovaPagina(d.muEdNuova, state.fonte || {}, m.pagine.length));
    state.bozza = muroPulito(m);
  } else if (d.muEdTogli !== undefined) {
    const m = structuredClone(bozza());
    m.pagine.splice(Number(d.muEdTogli), 1);
    state.bozza = muroPulito(m);
  } else if (d.muEdPaginaSu !== undefined || d.muEdPaginaGiu !== undefined) {
    const m = structuredClone(bozza());
    const i = Number(d.muEdPaginaSu ?? d.muEdPaginaGiu);
    m.pagine = sposta(m.pagine, i, d.muEdPaginaSu !== undefined ? i - 1 : i + 1);
    state.bozza = muroPulito(m);
  } else if (d.muEdPostoSu !== undefined || d.muEdPostoGiu !== undefined) {
    const [i, k] = String(d.muEdPostoSu ?? d.muEdPostoGiu)
      .split(".")
      .map(Number);
    const m = structuredClone(bozza());
    const p = m.pagine[i];
    p.comandi = sposta(p.comandi, k, d.muEdPostoSu !== undefined ? k - 1 : k + 1);
    state.bozza = muroPulito(m);
  } else if (d.muEdSalva !== undefined) {
    salva();
    return;
  }
  ridisegna();
}

function onChange(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== MURO_EDITOR_TAB || !body.contains(event.target)) return;
  const via = event.target?.dataset?.muEdCampo;
  if (!via) return;
  metti(via, event.target.value);
  /* Il PIN e le scritte si ridisegnano solo quando cambiano la forma: chi sta
   * scrivendo non deve perdere il cursore. */
  if (event.type === "change") ridisegna();
}

export function salva() {
  const m = muroPulito(bozza());
  writeJsonIfChanged(CHIAVE_MURO, m);
  state.bozza = m;
  root.dispatchEvent?.(new CustomEvent("dashboardmodern:muro"));
  root.edToast?.(t("💾 Plancia a muro salvata", "💾 Wall dashboard saved"));
  ridisegna();
  return m;
}

export function ensureMuroEditorTab() {
  const linguette = doc?.querySelector(".ed-tab")?.parentElement;
  if (!linguette || linguette.querySelector(`.ed-tab[data-tab="${MURO_EDITOR_TAB}"]`)) return false;
  const linguetta = doc.createElement("button");
  linguetta.className = "ed-tab";
  linguetta.dataset.tab = MURO_EDITOR_TAB;
  linguetta.textContent = `📟 ${t("A muro", "On the wall")}`;
  linguetta.addEventListener("click", () => root.editorSwitch?.(MURO_EDITOR_TAB));
  const prima = linguette.querySelector('.ed-tab[data-tab="runtime"]');
  if (prima) prima.before(linguetta);
  else linguette.append(linguetta);
  /* La linguetta nasce dopo che l'albero ha messo in fila le altre: la si
   * rimette al suo posto di famiglia, così l'ultima resta l'ultima. */
  riordinaLeLinguette();
  return true;
}

function stili() {
  installStyle(
    "dm-muro-editor-style",
    `
#ed-body .mu-ed{display:block}
#ed-body .mu-ed-premium{display:inline-block;margin-left:6px;font-size:9.5px;font-weight:900;letter-spacing:.08em;padding:2px 7px;border-radius:6px;color:#b45309;border:1px solid #f59e0b88;background:#f59e0b18}
#ed-body .mu-ed-blocco,#ed-body .mu-ed-pagina{border:1px solid var(--divider-color,#dbe4ee);border-radius:14px;padding:12px;margin:0 0 14px;background:color-mix(in srgb,var(--text,#0f172a) 2%,transparent)}
#ed-body .mu-ed-riga{display:flex;align-items:center;gap:12px;padding:10px 12px;margin-top:8px;border-radius:12px;background:var(--card-background-color,var(--card-bg,#fff));border:1px solid var(--divider-color,#dbe4ee)}
#ed-body .mu-ed-testo{flex:1;min-width:0}
#ed-body .mu-ed-testo b{display:block;font-size:13px}
#ed-body .mu-ed-testo small{display:block;margin-top:2px;font-size:11.5px;line-height:1.4;color:var(--text-dim,#64748b)}
#ed-body .mu-ed-dx{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
#ed-body .mu-ed-dx .ed-input{margin:0;width:auto;min-width:150px;max-width:260px}
#ed-body .mu-ed-dx input[type="time"]{min-width:0;width:110px}
#ed-body .mu-ed-dx input[type="password"]{min-width:0;width:120px}
#ed-body .mu-ed-int{position:relative;width:42px;height:24px;flex:0 0 auto;padding:0;border:0;border-radius:999px;background:var(--divider-color,#cbd5e1);cursor:pointer}
#ed-body .mu-ed-int[aria-checked="true"]{background:#0ea5e9}
#ed-body .mu-ed-int.fermo{opacity:.5;cursor:default}
#ed-body .mu-ed-int i{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .18s ease}
#ed-body .mu-ed-int[aria-checked="true"] i{transform:translateX(18px)}
#ed-body .mu-ed-seg{display:inline-flex;flex-wrap:wrap;gap:4px;padding:4px;border-radius:12px;border:1px solid var(--divider-color,#dbe4ee)}
#ed-body .mu-ed-seg button{border:0;padding:8px 12px;border-radius:9px;background:none;color:var(--text-dim,#64748b);font-weight:800;font-size:12.5px;cursor:pointer}
#ed-body .mu-ed-seg button.si{background:color-mix(in srgb,#0ea5e9 18%,transparent);color:#0369a1;box-shadow:inset 0 0 0 1px #0ea5e999}
html[data-theme="dark"] #ed-body .mu-ed-seg button.si{color:#7dd3fc}
#ed-body .mu-ed-pagina-testa{display:flex;align-items:center;gap:10px;font-size:14px}
#ed-body .mu-ed-pagina-testa .ed-del{margin-left:6px}
#ed-body .mu-ed-frecce{display:inline-flex;gap:4px;margin-left:auto}
#ed-body .mu-ed-posto .mu-ed-frecce{margin-left:0}
#ed-body .mu-ed-frecce button{width:28px;height:28px;border-radius:50%;border:1px solid var(--divider-color,#dbe4ee);background:none;color:var(--text-dim,#64748b);font-size:10px;cursor:pointer}
#ed-body .mu-ed-frecce button[disabled]{opacity:.35;cursor:default}
#ed-body .mu-ed-posti{display:grid;gap:8px;margin-top:10px}
#ed-body .mu-ed-posto{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;border-radius:12px;border:1px solid var(--divider-color,#dbe4ee);background:var(--card-background-color,var(--card-bg,#fff))}
#ed-body .mu-ed-posto .ed-input{margin:0;flex:1 1 180px;min-width:0}
#ed-body .mu-ed-num{width:24px;height:24px;border-radius:7px;display:grid;place-items:center;font-weight:900;font-size:11px;color:var(--text-dim,#64748b);background:color-mix(in srgb,var(--text,#0f172a) 8%,transparent)}
#ed-body .mu-ed-proposto{font-weight:700;font-size:13px}
#ed-body .mu-ed-sotto-titolo{margin:16px 2px 0;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim,#64748b)}
#ed-body .mu-ed-nota{padding:10px 12px;margin:8px 0;border-radius:10px;font-size:12px;line-height:1.5;color:var(--text-dim,#64748b);background:color-mix(in srgb,#0ea5e9 8%,transparent)}
#ed-body .mu-ed-aggiungi{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 16px;font-weight:800;font-size:13px}
#ed-body .mu-ed-aggiungi .ed-btn-add{width:auto;margin:0;padding:10px 16px}
#ed-body .mu-ed-chiuso{position:relative;min-height:420px}
#ed-body .mu-ed-dietro{filter:blur(2px);opacity:.4;pointer-events:none;max-height:520px;overflow:hidden}
#ed-body .mu-ed-lucchetto{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:24px}
#ed-body .mu-ed-lucchetto b{font-family:Oswald,Inter,sans-serif;font-weight:500;font-size:26px;text-transform:uppercase}
#ed-body .mu-ed-lucchetto p{max-width:520px;font-size:14px;line-height:1.55;color:var(--text-dim,#64748b)}
`,
  );
}

export function installPlanciaAMuroEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  stili();
  doc.addEventListener("click", onClick);
  doc.addEventListener("change", onChange);
  doc.addEventListener("input", (event) => {
    if (
      event.target?.type === "password" ||
      event.target?.dataset?.muEdCampo?.includes(".nome") ||
      event.target?.dataset?.muEdCampo?.includes(".sotto") ||
      event.target?.dataset?.muEdCampo?.endsWith(".titolo")
    )
      onChange(event);
  });
  const ancora = () =>
    root.queueMicrotask?.(() => {
      ensureMuroEditorTab();
      ensureMuroEditor();
    });
  wrapFunction("apriConfigEntita", "__dmMuroEditor", () => {
    ensureMuroEditorTab();
    ensureMuroEditor();
  });
  onEditorRedraw("__dmMuroEditor", ancora);
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, ancora);
  ensureMuroEditorTab();
  ensureMuroEditor();
  return true;
}

senzaCadere(installPlanciaAMuroEditor);
