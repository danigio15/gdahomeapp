/* La finestra del widget «Messaggio» (vedi `../finestre-dei-widget.js`).
 *
 * «Una card nella Home per inviare messaggi istantanei.» Si sceglie a chi —
 * gli Echo di casa, i telefoni di famiglia, o tutti e due —, si scrive o si
 * tocca una frase pronta, e «Invia».
 *
 * Il messaggio lo manda il ponte (`ponte/messaggio/manda`), e solo per chi
 * e' entrato: qui partono la frase e le scelte, e torna quanti l'hanno
 * avuto. Le regole stanno in `core/messaggio-di-casa.js`.
 *
 * Le scelte (a chi, quali Echo, quali persone) restano su questo schermo:
 * chi scrive dalla cucina scrive sempre alla stessa gente.
 */
import { registraFinestra } from "../finestre-dei-widget.js";
import { allStates, chiediAHomeAssistant, clean, doc, esc, readJson, root, t } from "../shared.js";
import { altoparlantiAlexa, normalizzaAlexa, CHIAVE_ALEXA } from "../../core/alexa-annunci.js";
import {
  MESSAGGIO_AL_PIU,
  MESSAGGIO_CHI,
  MESSAGGIO_MANDA,
  testoPulito,
} from "../../core/messaggio-di-casa.js";

const P = ":is(#dm-widget-popup,#dm-casa-popup,#dm-qa-popup)";
const KEY = "__DASHBOARDMODERN_MESSAGGIO__";
const SCELTE = "dm_messaggio_scelte";
/* Chi puo' ricevere si chiede al ponte ogni dieci minuti, non a ogni giro. */
const OGNI = 10 * 60_000;

/* Le frasi pronte: un tocco e sono nel campo. Una tabella che l'estrattore
 * delle traduzioni legge (`SECTION_TABLES`). */
const FRASI_PRONTE = Object.freeze([
  ["🍝 A tavola!", "🍝 Dinner's ready!"],
  ["🚗 Sto arrivando", "🚗 On my way"],
  ["🏠 Sono a casa", "🏠 I'm home"],
  ["🛒 Serve qualcosa?", "🛒 Need anything?"],
  ["📞 Chiamami", "📞 Call me"],
]);

/* Quello che si dice a chi ha mandato: quanti Echo e quanti telefoni. */
function esitoDelMessaggio({ telefoni = 0, echo = 0 } = {}) {
  const pezzi = [];
  if (echo) pezzi.push(echo === 1 ? t("1 Echo", "1 Echo") : `${echo} Echo`);
  if (telefoni)
    pezzi.push(
      telefoni === 1 ? t("1 telefono", "1 phone") : `${telefoni} ${t("telefoni", "phones")}`,
    );
  if (!pezzi.length)
    return t(
      "Non l'ha ricevuto nessuno: i telefoni scelti hanno spento le notifiche o non hanno l'app.",
      "Nobody received it: the chosen phones have notifications off or no app.",
    );
  return `${t("✓ Inviato a", "✓ Sent to")} ${pezzi.join(` ${t("e", "and")} `)}`;
}

const state = (root[KEY] ||= {
  installato: false,
  persone: null,
  chiestoIl: 0,
  chiedendo: false,
  testo: "",
  invio: false,
  esito: "",
  scelte: null,
});

function leScelte() {
  if (state.scelte) return state.scelte;
  let salvate = null;
  try {
    salvate = JSON.parse(root.localStorage?.getItem(SCELTE) || "null");
  } catch (_errore) {
    salvate = null;
  }
  state.scelte = {
    echoAcceso: salvate?.echoAcceso !== false,
    telefoniAcceso: salvate?.telefoniAcceso !== false,
    echo: Array.isArray(salvate?.echo) ? salvate.echo.map(String) : null,
    persone: Array.isArray(salvate?.persone) ? salvate.persone.map(String) : [],
  };
  return state.scelte;
}

function salvaLeScelte() {
  try {
    root.localStorage?.setItem(SCELTE, JSON.stringify(state.scelte));
  } catch (_errore) {
    /* Senza memoria le scelte valgono finche' la pagina e' aperta. */
  }
}

/** Gli Echo di casa, e quelli scelti (di serie: quelli delle notifiche, o tutti). */
export function gliEcho(states = allStates() || {}) {
  const tutti = altoparlantiAlexa(states);
  const ci = new Set(tutti.map((uno) => uno.entita));
  const scelte = leScelte();
  let scelti = (scelte.echo || []).filter((uno) => ci.has(uno));
  if (!scelte.echo) {
    const delleNotifiche = normalizzaAlexa(readJson(CHIAVE_ALEXA, null)).altoparlanti;
    scelti = delleNotifiche.filter((uno) => ci.has(uno));
    if (!scelti.length) scelti = tutti.filter((uno) => !uno.spento).map((uno) => uno.entita);
  }
  return { tutti, scelti };
}

/* Chi puo' ricevere sui telefoni: lo sa il ponte. Senza ponte, o senza
 * nessuno con l'app, la parte dei telefoni non c'e'. */
export function chiPuoRicevere(ridisegna = () => {}) {
  const ora = Date.now();
  if (!state.chiedendo && ora - state.chiestoIl > OGNI) {
    state.chiedendo = true;
    state.chiestoIl = ora;
    chiediAHomeAssistant({ type: MESSAGGIO_CHI }, 8000)
      .then((risposta) => {
        state.persone = Array.isArray(risposta?.persone)
          ? risposta.persone
              .map((uno) => ({ id: clean(uno?.id), nome: clean(uno?.nome) }))
              .filter((uno) => uno.id)
          : [];
      })
      .catch(() => {
        state.persone = null;
      })
      .finally(() => {
        state.chiedendo = false;
        ridisegna();
      });
  }
  return state.persone;
}

const pastiglia = (acceso, dato, testo, extra = "") =>
  `<button type="button" class="dm-msg-pa" aria-pressed="${acceso}" ${dato}${extra}>${testo}</button>`;

function corpo() {
  const scelte = leScelte();
  const { tutti, scelti } = gliEcho();
  const persone = state.persone || [];
  const ciSonoEcho = tutti.length > 0;
  const ciSonoTelefoni = persone.length > 0;
  const echoAcceso = ciSonoEcho && scelte.echoAcceso;
  const telefoniAcceso = ciSonoTelefoni && scelte.telefoniAcceso;
  const aChi = [
    ciSonoEcho
      ? pastiglia(
          echoAcceso,
          'data-dm-msg-dest="echo"',
          `🔊 ${esc(t("Echo di casa", "Home Echos"))}`,
        )
      : "",
    ciSonoTelefoni
      ? pastiglia(
          telefoniAcceso,
          'data-dm-msg-dest="telefoni"',
          `📱 ${esc(t("Telefoni", "Phones"))}`,
        )
      : "",
  ].join("");
  const quali = echoAcceso
    ? `<div class="dm-msg-riga"><span>${esc(t("Quali Echo", "Which Echos"))}</span><div class="dm-msg-fila">${tutti
        .map((uno) =>
          pastiglia(
            scelti.includes(uno.entita),
            `data-dm-msg-echo="${esc(uno.entita)}"`,
            `${esc(uno.nome)}${uno.spento ? ` <small>${esc(t("spento", "offline"))}</small>` : ""}`,
          ),
        )
        .join("")}</div></div>`
    : "";
  const tuttiITelefoni = !scelte.persone.some((id) => persone.some((uno) => uno.id === id));
  const chi = telefoniAcceso
    ? `<div class="dm-msg-riga"><span>${esc(t("A chi", "To whom"))}</span><div class="dm-msg-fila">${pastiglia(
        tuttiITelefoni,
        'data-dm-msg-tutti=""',
        esc(t("Tutti", "Everyone")),
      )}${persone
        .map((uno) =>
          pastiglia(
            !tuttiITelefoni && scelte.persone.includes(uno.id),
            `data-dm-msg-persona="${esc(uno.id)}"`,
            esc(uno.nome),
          ),
        )
        .join("")}</div></div>`
    : "";
  const nessuno = !echoAcceso && !telefoniAcceso;
  const pronte = FRASI_PRONTE.map(
    ([it, en], indice) =>
      `<button type="button" class="dm-msg-pronta" data-dm-msg-pronta="${indice}">${esc(t(it, en))}</button>`,
  ).join("");
  return `<div class="dm-msg-a">${aChi}</div>
    ${quali}${chi}
    <div class="dm-msg-pronte">${pronte}</div>
    <div class="dm-msg-scrivi">
      <textarea class="dm-msg-testo" data-dm-msg-testo rows="2" maxlength="${MESSAGGIO_AL_PIU}" placeholder="${esc(
        t("Scrivi un messaggio…", "Write a message…"),
      )}">${esc(state.testo)}</textarea>
      <button type="button" class="dm-msg-invia" data-dm-msg-invia${
        nessuno || state.invio ? " disabled" : ""
      } aria-label="${esc(t("Invia", "Send"))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.4 11.1 19 4.6c.8-.4 1.6.4 1.2 1.2l-6.5 14.6c-.4.9-1.7.8-1.9-.2l-1.2-5.6-5.6-1.2c-1-.2-1.1-1.5-.2-1.9Z" fill="currentColor"/></svg><b>${esc(
        state.invio ? t("Invio…", "Sending…") : t("Invia", "Send"),
      )}</b></button>
    </div>
    ${
      nessuno
        ? `<small class="dm-msg-esito">${esc(t("Scegli a chi mandarlo.", "Choose who to send it to."))}</small>`
        : state.esito
          ? `<small class="dm-msg-esito">${esc(state.esito)}</small>`
          : ""
    }`;
}

function disegna() {
  return `<div class="dm-msg" data-dm-msg>${corpo()}</div>`;
}

function ridisegna() {
  const scatola = doc?.querySelector?.(`${P} [data-dm-msg]`);
  if (!scatola) return;
  const fuoco = doc.activeElement?.matches?.("[data-dm-msg-testo]");
  scatola.innerHTML = corpo();
  if (fuoco) {
    const campo = scatola.querySelector("[data-dm-msg-testo]");
    campo?.focus?.();
    campo?.setSelectionRange?.(campo.value.length, campo.value.length);
  }
}

async function invia() {
  const scelte = leScelte();
  const testo = testoPulito(state.testo);
  if (!testo) {
    state.esito = t("Scrivi cosa vuoi dire.", "Write what you want to say.");
    ridisegna();
    return;
  }
  const { tutti, scelti } = gliEcho();
  const persone = state.persone || [];
  const echo = tutti.length && scelte.echoAcceso ? scelti : [];
  const telefoni = persone.length > 0 && scelte.telefoniAcceso;
  if (!echo.length && !telefoni) {
    state.esito = t("Scegli a chi mandarlo.", "Choose who to send it to.");
    ridisegna();
    return;
  }
  state.invio = true;
  state.esito = "";
  ridisegna();
  try {
    const risposta = await chiediAHomeAssistant(
      {
        type: MESSAGGIO_MANDA,
        testo,
        echo,
        telefoni,
        persone: scelte.persone.filter((id) => persone.some((uno) => uno.id === id)),
      },
      15000,
    );
    state.esito = esitoDelMessaggio(risposta || {});
    state.testo = "";
    root.navigator?.vibrate?.(10);
  } catch (errore) {
    const codice = clean(errore?.code);
    state.esito =
      codice === "rate_limited"
        ? t("Troppi messaggi: aspetta un minuto.", "Too many messages: wait a minute.")
        : codice === "unauthorized"
          ? t("I messaggi li manda chi è entrato.", "Only signed-in users can send messages.")
          : t("Non è partito: il ponte non risponde.", "Not sent: the bridge is not answering.");
  } finally {
    state.invio = false;
    ridisegna();
  }
}

function suUnTasto(evento) {
  const tasto = evento.target?.closest?.("[data-dm-msg] button");
  if (!tasto) return;
  const d = tasto.dataset;
  const scelte = leScelte();
  if ("dmMsgInvia" in d) {
    evento.preventDefault();
    if (!state.invio) void invia();
    return;
  }
  if ("dmMsgDest" in d) {
    if (d.dmMsgDest === "echo") scelte.echoAcceso = !scelte.echoAcceso;
    else scelte.telefoniAcceso = !scelte.telefoniAcceso;
  } else if ("dmMsgEcho" in d) {
    const { scelti } = gliEcho();
    const entita = clean(d.dmMsgEcho);
    scelte.echo = scelti.includes(entita)
      ? scelti.filter((uno) => uno !== entita)
      : [...scelti, entita];
  } else if ("dmMsgTutti" in d) scelte.persone = [];
  else if ("dmMsgPersona" in d) {
    const id = clean(d.dmMsgPersona);
    scelte.persone = scelte.persone.includes(id)
      ? scelte.persone.filter((uno) => uno !== id)
      : [...scelte.persone, id];
  } else if ("dmMsgPronta" in d) {
    const frase = FRASI_PRONTE[Number(d.dmMsgPronta)];
    if (frase) state.testo = t(frase[0], frase[1]);
  } else return;
  evento.preventDefault();
  evento.stopPropagation();
  state.esito = "";
  salvaLeScelte();
  ridisegna();
}

function suUnaParola(evento) {
  if (!evento.target?.matches?.("[data-dm-msg-testo]")) return;
  state.testo = String(evento.target.value || "").slice(0, MESSAGGIO_AL_PIU);
}

/* Invio senza Maiusc manda, come in ogni chat; con Maiusc va a capo. */
function suUnTastoDellaTastiera(evento) {
  if (evento.key !== "Enter" || evento.shiftKey) return;
  if (!evento.target?.matches?.("[data-dm-msg-testo]")) return;
  evento.preventDefault();
  state.testo = String(evento.target.value || "").slice(0, MESSAGGIO_AL_PIU);
  if (!state.invio) void invia();
}

export function installaIlMessaggio() {
  if (!doc || state.installato) return false;
  state.installato = true;
  doc.addEventListener("click", suUnTasto, true);
  doc.addEventListener("input", suUnaParola);
  doc.addEventListener("keydown", suUnTastoDellaTastiera);
  return true;
}

const STILE = `
${P} .dm-msg{display:grid;gap:12px}
${P} .dm-msg-a,${P} .dm-msg-fila,${P} .dm-msg-pronte{display:flex;flex-wrap:wrap;gap:7px}
${P} .dm-msg-riga{display:grid;gap:6px}
${P} .dm-msg-riga>span{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;
  color:var(--text-dim,#64748b)}
${P} .dm-msg-pa{display:inline-flex;align-items:center;gap:6px;padding:8px 13px;border-radius:999px;
  font:inherit;font-size:13px;font-weight:800;cursor:pointer;color:var(--text,#0f172a);
  border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff)}
${P} .dm-msg-pa[aria-pressed="true"]{color:var(--dm-widget-accent,#0ea5e9);
  border-color:var(--dm-widget-accent,#0ea5e9);
  background:color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 12%,var(--card-bg,#fff));
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 60%,transparent)}
${P} .dm-msg-pa small{font-size:10.5px;font-weight:700;color:var(--text-dim,#64748b)}
${P} .dm-msg-a .dm-msg-pa{flex:1 1 0;justify-content:center;padding:11px 13px;border-radius:14px;font-size:14px}
${P} .dm-msg-pronta{padding:7px 11px;border-radius:12px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;
  color:var(--text,#0f172a);border:1px dashed var(--card-border,#cbd5e1);background:transparent}
${P} .dm-msg-pronta:hover{border-style:solid}
${P} .dm-msg-scrivi{display:flex;gap:8px;align-items:stretch}
${P} .dm-msg-testo{flex:1 1 auto;min-width:0;resize:none;padding:11px 13px;border-radius:14px;
  font:inherit;font-size:14px;line-height:1.4;color:var(--text,#0f172a);
  border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff)}
${P} .dm-msg-testo:focus{outline:2px solid color-mix(in srgb,var(--dm-widget-accent,#0ea5e9) 55%,transparent);
  outline-offset:1px}
${P} .dm-msg-invia{flex:none;display:grid;place-items:center;align-content:center;gap:2px;min-width:72px;
  padding:8px 12px;border:0;border-radius:14px;cursor:pointer;color:#fff;
  background:var(--dm-widget-accent,#0ea5e9);font:inherit;font-size:12px;font-weight:800}
${P} .dm-msg-invia svg{width:20px;height:20px}
${P} .dm-msg-invia[disabled]{opacity:.5;cursor:default}
${P} .dm-msg-esito{font-size:12.5px;font-weight:750;color:var(--text-dim,#64748b)}
`;

registraFinestra("messaggio", {
  disegna,
  sottotitolo: (w) => w.caption || "",
  stile: STILE,
});
