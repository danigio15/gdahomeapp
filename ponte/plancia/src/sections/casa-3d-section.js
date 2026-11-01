/* «Casa 3D»: la plancia con la casa vera, in tre dimensioni (vedi `core/casa-3d.js`).
 *
 * Quando il config della plancia la accende (`cd_casa3d.attiva`) e la casa e'
 * Premium, una tela copre la plancia classica come fanno il pannello a muro e
 * il Colpo d'occhio: in cima il nome della casa, i piani da toccare e l'ora;
 * a sinistra i piani con le luci accese, al centro la casa in 3D, a destra i
 * dispositivi del piano aperto con il loro stato e i comandi rapidi.
 *
 *   · Da fuori la villa col giardino, o il palazzo con la mia casa al suo
 *     piano; toccato un piano, si entra.
 *   · Dentro, ogni dispositivo dice lo stato vero e un tocco fa quello che ci
 *     si aspetta: la luce si accende, la tapparella sale, la telecamera apre
 *     il video dal vivo col motore della plancia.
 *   · Chi amministra «arreda»: mobili, pavimenti, pareti, dispositivi da
 *     collegare alle entita'. Si salva nel config, come il resto.
 *
 * three si scarica solo qui, e solo quando la casa si apre davvero: chi non
 * ha la Casa 3D non lo paga. I comandi passano dalla presa di chi e' entrato,
 * e un'entita' messa in sola lettura resta da guardare.
 */
import {
  CHIAVE_CASA3D,
  DISPOSITIVI_3D,
  azioneDelTocco,
  casa3dPulita,
  contaCollegati,
  statoDelDispositivo,
} from "../core/casa-3d.js";
import { apriIlMenu, premiumDellaCasa, premiumRicordato } from "./plancia-a-muro-section.js";
import { CHIAVE_RISERVATE, telecamereVisibili } from "../core/telecamere-riservate.js";
import { normalizePeople } from "../core/person-model.js";
import { puoConfigurare } from "./la-config-e-di-chi-la-amministra-section.js";
import { currentProfile } from "./config-persistence-section.js";
import {
  allStates,
  chiamaServizio,
  clean,
  doc,
  english,
  esc,
  installStyle,
  lexicalGlobal,
  locale,
  readJson,
  root,
  scriviSeCambia,
  senzaCadere,
  siComanda,
  stanzaDiHomeAssistant,
  t,
  writeJsonIfChanged,
} from "./shared.js";
import { daiVendor } from "../core/cartella-della-plancia.js";

const KEY = "__DASHBOARDMODERN_CASA_3D__";
const ID = "dm-casa3d";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  premium: null,
  chiedendo: false,
  chiestaIl: 0,
  timer: 0,
  scena: null,
  caricando: false,
  firma: "",
  vista: "esterno",
  arreda: false,
  finestra: null,
  avviso: 0,
  videoAperto: false,
  nascosta: false,
  guasto: "",
});

/** La casa del config, pulita. */
export function casa3dDiQui() {
  return casa3dPulita(readJson(CHIAVE_CASA3D, null));
}

/* Le telecamere che adesso si possono guardare: le riservate, con qualcuno in
 * casa (o non si sa), no — la stessa regola della plancia principale. */
function telecamereGuardabili(casa, states) {
  const tutte = [];
  for (const p of casa.piani)
    for (const d of p.dispositivi)
      if (d.k === "telecamera" && d.entity) tutte.push({ entity: d.entity });
  for (const d of casa.esterno.telecamere) if (d.entity) tutte.push({ entity: d.entity });
  const visibili = telecamereVisibili(tutte, {
    config: readJson(CHIAVE_RISERVATE, {}),
    persone: normalizePeople(readJson("cd_people", [])),
    states,
  });
  return new Set(visibili.map((c) => c.entity));
}

/* Se questa e' la plancia principale: la sua configurazione sta nel profilo
 * «primary» (vedi config-persistence-section.js). */
function eLaPrincipale() {
  try {
    return currentProfile() === "primary";
  } catch (_errore) {
    return false;
  }
}

/* ── le parole ────────────────────────────────────────────────────────── */

const lingua = () => locale() || "it";
const italiano = () => !english();

function nomeDelDispositivo(d, states) {
  const D = DISPOSITIVI_3D[d.k];
  return (
    d.nome ||
    clean(states?.[d.entity]?.attributes?.friendly_name) ||
    (D ? (italiano() ? D.nome[0] : D.nome[1]) : d.k)
  );
}

const pianiDallAlto = (casa) => casa.piani.slice().sort((a, b) => b.livello - a.livello);

function luciDelPiano(p, states) {
  const luci = p.dispositivi.filter((d) => d.k === "luce" && d.entity);
  const accese = luci.filter(
    (d) => statoDelDispositivo("luce", states[d.entity], italiano()).attivo,
  );
  return { tutte: luci.length, accese: accese.length };
}

function temperaturaDelPiano(p, states) {
  const valori = p.dispositivi
    .filter((d) => d.k === "termometro" && d.entity)
    .map((d) => Number(states[d.entity]?.state))
    .filter(Number.isFinite);
  if (!valori.length) return null;
  return valori.reduce((a, b) => a + b, 0) / valori.length;
}

const gradi = (v) =>
  `${Number(v).toLocaleString(lingua(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}°`;

/* ── i pezzi della pagina ─────────────────────────────────────────────── */

function testataMarkup(casa, admin) {
  const nome = clean(root.__HASS__?.config?.location_name) || t("Casa", "Home");
  const p = casa.piani.find((x) => x.k === state.vista);
  const sotto = p
    ? `${p.nome} · ${t("tocca «Esterno» per tornare fuori", "tap «Outside» to step back out")}`
    : casa.tipo === "palazzo"
      ? t("La casa in 3D · il palazzo", "Home in 3D · the building")
      : t("La casa in 3D · la villa", "Home in 3D · the house");
  const pillola = (k, testo) =>
    `<button type="button" class="c3-pillola" data-c3s="vista" data-c3s-k="${esc(k)}" aria-pressed="${state.vista === k}">${esc(testo)}</button>`;
  const adesso = new Date().toLocaleTimeString(lingua(), { hour: "2-digit", minute: "2-digit" });
  return `<div class="c3-testa">
      <button type="button" class="c3-menu" data-c3s="menu" aria-label="${esc(t("Apri il menu", "Open menu"))}"><span></span><span></span><span></span></button>
      <div class="c3-testa-testo">
        <h1>${esc(p ? p.nome : nome)}</h1>
        <p>${esc(sotto)}</p>
      </div>
      <div class="c3-pillole">${pillola("esterno", `${casa.tipo === "palazzo" ? "🏢" : "🏡"} ${t("Esterno", "Outside")}`)}${pianiDallAlto(
        casa,
      )
        .map((x) => pillola(x.k, x.nome))
        .join("")}</div>
      <span class="c3-spazio"></span>
      ${
        admin && casa.piani.length
          ? `<button type="button" class="c3-tasto" data-c3s="arreda" aria-pressed="${state.arreda}">🎨 ${esc(t("Arreda", "Furnish"))}</button>
             <button type="button" class="c3-tasto" data-c3s="crea">🏗️ ${esc(t("Crea / modifica la casa", "Create / edit the house"))}</button>`
          : ""
      }
      <span class="c3-ora">${esc(adesso)}</span>
      ${
        admin
          ? `<button type="button" class="c3-config" data-c3s="config" aria-label="${esc(t("Config", "Config"))}">⚙</button>`
          : ""
      }
    </div>`;
}

/* La casa che non c'e' ancora: chi amministra la crea da qui, gli altri
 * sanno che cosa aspettano. */
function casaDaCreareMarkup(admin) {
  return `<div class="c3-da-creare">
      <span aria-hidden="true">🏗️</span>
      <h2>${esc(t("La tua casa non c'è ancora", "Your home isn't here yet"))}</h2>
      <p>${esc(
        admin
          ? t(
              "Creala dalla planimetria e dalle foto delle stanze: poi qui vedrai piani, arredi e dispositivi col loro stato.",
              "Create it from the floor plan and room photos: then you'll see floors, furniture and devices with their state here.",
            )
          : t(
              "Chi amministra la casa deve ancora crearla. Appena è pronta compare qui.",
              "Whoever manages the home still has to create it. It will appear here as soon as it's ready.",
            ),
      )}</p>
      ${admin ? `<button type="button" class="c3-tasto c3-tasto-grande" data-c3s="crea">🏗️ ${esc(t("Crea la tua casa", "Create your home"))}</button>` : ""}
    </div>`;
}

function sinistraMarkup(casa, states, admin) {
  const righe = pianiDallAlto(casa)
    .map((p) => {
      const luci = luciDelPiano(p, states);
      const temp = temperaturaDelPiano(p, states);
      const locali = p.stanze.filter((s) => !s.fuori).length;
      const dettagli = [`${locali} ${t("locali", "rooms")}`];
      if (luci.tutte) dettagli.push(`💡 ${luci.accese}`);
      if (temp !== null) dettagli.push(`🌡 ${gradi(temp)}`);
      return `<button type="button" class="c3-piano" data-c3s="vista" data-c3s-k="${esc(p.k)}" aria-pressed="${state.vista === p.k}">
          <span class="c3-bollo" aria-hidden="true">${p.livello < 0 ? "🚗" : p.livello === 0 ? "🛋️" : "🛏️"}</span>
          <span class="c3-piano-testo"><b>${esc(p.nome)}</b><small>${esc(dettagli.join(" · "))}</small></span>
          <span class="c3-freccia" aria-hidden="true">›</span>
        </button>`;
    })
    .join("");
  let luciAccese = 0,
    luciTutte = 0,
    aperte = 0,
    movimento = 0,
    allarmi = 0;
  for (const p of casa.piani) {
    const l = luciDelPiano(p, states);
    luciAccese += l.accese;
    luciTutte += l.tutte;
    for (const d of p.dispositivi) {
      if (!d.entity) continue;
      const st = statoDelDispositivo(d.k, states[d.entity], italiano());
      if ((d.k === "finestra" || d.k === "porta") && st.attivo) aperte += 1;
      if ((d.k === "movimento" || d.k === "presenza") && st.attivo) movimento += 1;
      if ((d.k === "fumo" || d.k === "acqua") && st.attivo) allarmi += 1;
    }
  }
  const tutta = [
    luciTutte
      ? `💡 ${luciAccese === 1 ? t(`1 luce accesa su ${luciTutte}`, `1 of ${luciTutte} lights on`) : t(`${luciAccese} luci accese su ${luciTutte}`, `${luciAccese} of ${luciTutte} lights on`)}`
      : "",
    `🪟 ${aperte === 1 ? t("1 finestra o porta aperta", "1 window or door open") : aperte ? t(`${aperte} finestre o porte aperte`, `${aperte} windows or doors open`) : t("Finestre e porte chiuse", "Windows and doors closed")}`,
    movimento
      ? `🚶 ${movimento === 1 ? t("Movimento in 1 punto", "Motion in 1 spot") : t(`Movimento in ${movimento} punti`, `Motion in ${movimento} spots`)}`
      : "",
    allarmi ? `🚨 ${t(`${allarmi} allarmi`, `${allarmi} alarms`)}` : "",
  ].filter(Boolean);
  const conto = contaCollegati(casa);
  const daCollegare =
    admin && conto.mancano
      ? `<p class="c3-nota">${esc(t(`${conto.mancano} dispositivi da collegare: «Arreda» → Dispositivi.`, `${conto.mancano} devices to link: «Furnish» → Devices.`))}</p>`
      : "";
  return `<section class="c3-scheda">
      <h2>${casa.tipo === "palazzo" ? "🏢" : "🏡"} <b>${esc(casa.tipo === "palazzo" ? t("La tua casa", "Your home") : t("La villa", "The house"))}</b></h2>
      ${casa.tipo === "palazzo" ? `<p class="c3-nota">${esc(t(`Palazzo di ${casa.esterno.pianiPalazzo} piani`, `${casa.esterno.pianiPalazzo}-storey building`))}</p>` : ""}
      ${righe}
    </section>
    <section class="c3-scheda">
      <h2>🛡️ <b>${esc(t("Tutta la casa", "Whole house"))}</b></h2>
      <ul class="c3-tutta">${tutta.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
      ${daCollegare}
    </section>`;
}

/* Il simbolo del comando rapido di un dispositivo. */
function segnoDelComando(azione) {
  if (!azione?.service) return "";
  if (azione.service === "open_cover") return "▲";
  if (azione.service === "close_cover") return "▼";
  if (azione.service === "stop_cover") return "■";
  return "⏻";
}

function elencoMarkup(casa, states, guardabili) {
  const p = casa.piani.find((x) => x.k === state.vista);
  const righe = [];
  const riga = (d, dove, segnoPiano) => {
    const D = DISPOSITIVI_3D[d.k];
    if (!D) return "";
    const st = d.entity ? statoDelDispositivo(d.k, states[d.entity], italiano()) : null;
    const testo = !d.entity
      ? t("da collegare", "not linked")
      : st.testo.replace(D.icona, "").trim() ||
        (st.attivo ? t("attivo", "active") : t("a riposo", "idle"));
    let comando = "";
    if (d.k === "telecamera" && d.entity) {
      comando = guardabili.has(d.entity)
        ? `<button type="button" class="c3-comando" data-c3s="guarda" data-c3s-e="${esc(d.entity)}" aria-label="${esc(t("Guarda dal vivo", "Watch live"))}">▶</button>`
        : `<span class="c3-chiuso" title="${esc(t("Riservata", "Private"))}">🔒</span>`;
    } else if (d.entity) {
      const azione = azioneDelTocco(d.k, d.entity, states[d.entity]);
      if (azione?.service && siComanda(d.entity))
        comando = `<button type="button" class="c3-comando" data-c3s="comanda" data-c3s-k="${esc(d.k)}" data-c3s-e="${esc(d.entity)}" data-acceso="${Boolean(st?.attivo)}" aria-label="${esc(t("Comanda", "Toggle"))}">${segnoDelComando(azione)}</button>`;
    }
    return `<li class="c3-disp" data-tono="${esc(st?.tono || "spento")}" data-attivo="${Boolean(st?.attivo)}">
        <span class="c3-disp-ic" aria-hidden="true">${D.icona}</span>
        <span class="c3-disp-testo"><b>${esc(nomeDelDispositivo(d, states))}</b><small>${esc(dove ? `${dove} · ${testo}` : testo)}</small></span>
        ${segnoPiano || comando}
      </li>`;
  };
  if (p) {
    const nomeStanza = new Map(p.stanze.map((s) => [s.id, s.nome]));
    const ordinati = p.dispositivi
      .slice()
      .sort((a, b) =>
        clean(nomeStanza.get(a.stanza)).localeCompare(clean(nomeStanza.get(b.stanza))),
      );
    for (const d of ordinati) righe.push(riga(d, nomeStanza.get(d.stanza) || ""));
  } else for (const d of casa.esterno.telecamere) righe.push(riga(d, t("Esterno", "Outside")));
  const titolo = p
    ? `${t("Dispositivi", "Devices")} · ${p.nome}`
    : t("Telecamere fuori", "Outdoor cameras");
  return `<section class="c3-scheda c3-scheda-elenco">
      <h2>⚡ <b>${esc(titolo)}</b></h2>
      ${
        righe.length
          ? `<ul class="c3-elenco-righe">${righe.join("")}</ul>`
          : `<p class="c3-nota">${esc(
              p
                ? t(
                    "Nessun dispositivo in questo piano: si mettono con «Arreda».",
                    "No devices on this floor: place them with «Furnish».",
                  )
                : t(
                    "Tocca un piano per vedere i suoi dispositivi.",
                    "Tap a floor to see its devices.",
                  ),
            )}</p>`
      }
    </section>`;
}

/* ── la finestra del video ────────────────────────────────────────────── */

function finestraMarkup(casa, states) {
  const f = state.finestra;
  if (f?.tipo !== "telecamera") return "";
  const d = [...casa.piani.flatMap((p) => p.dispositivi), ...casa.esterno.telecamere].find(
    (x) => x.entity === f.entity,
  );
  const nome = d
    ? nomeDelDispositivo(d, states)
    : clean(states?.[f.entity]?.attributes?.friendly_name) || t("Telecamera", "Camera");
  return `<div class="c3-velo" data-c3s="velo">
      <section class="c3-finestra" role="dialog" aria-modal="true">
        <div class="c3-finestra-testa"><h3>📹 ${esc(nome)}</h3>
          <button type="button" class="c3-chiudi" data-c3s="chiudi" aria-label="${esc(t("Chiudi", "Close"))}">✕</button></div>
        <div class="c3-video" data-c3-video="${esc(f.entity)}"></div>
      </section>
    </div>`;
}

/* Il video lo mette il motore delle telecamere della plancia, lo stesso del
 * Colpo d'occhio (`dmCamOpen`): WebRTC, HLS, MJPEG o istantanee. */
function accendiIlVideo(sopra, casa, states) {
  const posto = sopra.querySelector("[data-c3-video]");
  if (!posto) return;
  const apri = lexicalGlobal("dmCamOpen");
  if (typeof apri !== "function") {
    posto.innerHTML = `<p class="c3-nota">${esc(t("Il video non si apre da qui.", "The video cannot open here."))}</p>`;
    return;
  }
  const entity = posto.dataset.c3Video;
  const d = [...casa.piani.flatMap((p) => p.dispositivi), ...casa.esterno.telecamere].find(
    (x) => x.entity === entity,
  );
  const nome = d ? nomeDelDispositivo(d, states) : entity;
  try {
    apri({ entity, name: nome }, nome, posto);
    state.videoAperto = true;
  } catch (errore) {
    root.console?.warn?.("[DashboardModern] casa 3d, video", errore);
  }
}

/* Chiude solo il video aperto da qui: il motore e' uno, e chiuderlo a ogni
 * ridisegno fermerebbe quello aperto dalla plancia. */
function chiudiIlVideo() {
  if (!state.videoAperto) return;
  state.videoAperto = false;
  try {
    lexicalGlobal("dmCamCleanup")?.();
  } catch (_errore) {}
}

/* ── Premium ──────────────────────────────────────────────────────────────
 *
 * Come la plancia a muro e il Colpo d'occhio: la Casa 3D si accende solo se il
 * ponte dice che la casa e' Premium. La risposta vale mezz'ora; nel frattempo
 * vale quello che il dispositivo ha saputo l'ultima volta. */
const MEZZ_ORA = 30 * 60 * 1000;

function eCasaPremium() {
  if (state.premium === null && premiumRicordato() === true) state.premium = true;
  if (state.premium === null || Date.now() - (state.chiestaIl || 0) > MEZZ_ORA) chiediLaLicenza();
  return state.premium === true;
}

function chiediLaLicenza() {
  if (state.chiedendo) return;
  state.chiedendo = true;
  state.chiestaIl = Date.now();
  premiumDellaCasa()
    .then((premium) => {
      const prima = state.premium;
      state.premium = premium === true;
      if (prima !== state.premium) ridisegna();
    })
    .catch(() => {})
    .finally(() => {
      state.chiedendo = false;
    });
}

/* ── la scena ─────────────────────────────────────────────────────────── */

/* Le aree di Home Assistant delle entita', per proporre quelle della stanza. */
function areeDelleEntita(states) {
  const aree = {};
  for (const id of Object.keys(states || {})) {
    const nome = stanzaDiHomeAssistant(id);
    if (nome) aree[id] = nome;
  }
  return aree;
}

function nomeDellArea(id) {
  return clean(lexicalGlobal("WIZ")?.areaNames?.[id]);
}

/* three.js si carica solo quando si apre la casa: non sta nel pacco e non si
 * precarica con la plancia (sono 600 KB che chi non ha la Casa 3D non deve
 * scaricare). Servita dal ponte la cartella si ricava dal nostro indirizzo,
 * come per il riconoscimento delle foto: impacchettati, i moduli stanno in
 * `pacco/` e un percorso relativo sbaglierebbe piano. */
const TRE = (() => {
  const servita = daiVendor(String(import.meta.url || ""), "three.module.min.js", null);
  if (servita) return servita;
  try {
    return new URL("../../legacy/vendor/three.module.min.js", import.meta.url).href;
  } catch (_errore) {
    return "../../legacy/vendor/three.module.min.js";
  }
})();

async function avviaLaScena(admin) {
  state.caricando = true;
  state.guasto = "";
  try {
    const [THREE, { creaScena }] = await Promise.all([import(TRE), import("./casa-3d/scena.js")]);
    const nodo = doc.getElementById(ID);
    const posto = nodo?.querySelector(".c3-posto");
    if (!posto) return;
    const casa = casa3dDiQui();
    if (!casa.attiva) return;
    const states = allStates() || {};
    state.scena = creaScena(THREE, {
      contenitore: posto,
      casa,
      stati: () => allStates() || {},
      italiano: italiano(),
      admin,
      aree: admin ? areeDelleEntita(states) : {},
      nomeArea: nomeDellArea,
      pannello: nodo.querySelector(".c3-arreda-posto"),
      quandoTocchi: alToccoDellaScena,
      quandoSalvi: salvaLaCasa,
      quandoCambiVista: (vista) => {
        if (state.vista === vista) return;
        state.vista = vista;
        ridisegna();
      },
    });
    state.firma = JSON.stringify(casa);
    if (state.vista !== "esterno" && !state.scena.apri(state.vista)) state.vista = "esterno";
    if (state.arreda) state.scena.arreda(true);
  } catch (errore) {
    state.guasto = String(errore?.message || errore);
    root.console?.warn?.("[DashboardModern] casa 3d", errore);
  } finally {
    state.caricando = false;
    ridisegna();
  }
}

function spegniLaScena() {
  try {
    state.scena?.distruggi();
  } catch (_errore) {}
  state.scena = null;
  state.firma = "";
}

/* Quello che la scena ha cambiato torna nel config. La firma si aggiorna
 * prima di scrivere: la casa scritta e' gia' quella in scena, non si rifa'. */
function salvaLaCasa(nuova) {
  const pulita = casa3dPulita(nuova);
  state.firma = JSON.stringify(pulita);
  try {
    writeJsonIfChanged(CHIAVE_CASA3D, pulita);
  } catch (_errore) {
    avviso(t("⚠️ Non salvato", "⚠️ Not saved"), "male");
  }
}

function alToccoDellaScena(azione) {
  if (!azione) return;
  vibra();
  if (azione.pagina === "telecamera") return guarda(azione.entity);
  if (azione.pagina === "scollegato") {
    avviso(
      puoConfigurare()
        ? t("Da collegare: «Arreda» → Dispositivi", "Not linked: «Furnish» → Devices")
        : t("Non ancora collegato", "Not linked yet"),
      "male",
    );
    return;
  }
  if (azione.pagina === "entita") {
    const st = allStates()?.[azione.entity];
    const nome = clean(st?.attributes?.friendly_name) || t("Dispositivo", "Device");
    avviso(`${nome}: ${clean(st?.state) || "—"}`);
    return;
  }
  if (azione.domain) comanda(azione);
}

function comanda(azione) {
  const entity = clean(azione?.data?.entity_id);
  if (!siComanda(entity)) {
    avviso(t("Solo da guardare", "View only"), "male");
    return;
  }
  if (!chiamaServizio(azione)) {
    avviso(t("⚠️ Non connesso", "⚠️ Not connected"), "male");
    return;
  }
  avviso(t("Comando inviato", "Command sent"));
}

function guarda(entity) {
  const casa = casa3dDiQui();
  if (!telecamereGuardabili(casa, allStates() || {}).has(entity)) {
    avviso(
      t("Telecamera riservata: non si vede adesso", "Private camera: not viewable now"),
      "male",
    );
    return;
  }
  apriFinestra({ tipo: "telecamera", entity });
}

/* ── il disegno ───────────────────────────────────────────────────────── */

function tela() {
  let nodo = doc.getElementById(ID);
  if (!nodo) {
    nodo = doc.createElement("div");
    nodo.id = ID;
    nodo.innerHTML = `<div class="c3-pagina">
        <div class="c3-testa-posto"></div>
        <div class="c3-corpo">
          <aside class="c3-sinistra"></aside>
          <div class="c3-palco"><div class="c3-posto"></div><div class="c3-attesa"></div></div>
          <aside class="c3-destra"><div class="c3-elenco"></div><div class="c3-arreda-posto" hidden></div></aside>
        </div>
      </div><div class="c3-sopra"></div><div class="c3-avviso" role="status" aria-live="polite"></div>`;
    doc.body.appendChild(nodo);
    nodo.addEventListener("click", alClic);
  }
  return nodo;
}

function togliLaTela() {
  chiudiIlVideo();
  spegniLaScena();
  state.finestra = null;
  if (state.timer) root.clearInterval?.(state.timer);
  state.timer = 0;
  doc?.getElementById(ID)?.remove();
  doc?.documentElement?.classList?.remove("dm-casa3d-acceso");
}

function disegna() {
  if (!doc?.body) return;
  const casa = casa3dDiQui();
  /* La Casa 3D e' una plancia a se': nasce dalla console come «Casa 3D», e
   * non prende mai il posto della plancia principale. «Ho attivato la
   * plancia 3D per sbaglio sulla plancia che uso normale e adesso non mi fa
   * piu' tornare indietro»: chi l'aveva accesa li' ritrova la sua plancia. */
  if (!casa.attiva || state.nascosta || !eCasaPremium() || eLaPrincipale()) {
    togliLaTela();
    return;
  }
  const states = allStates() || {};
  let admin = false;
  try {
    admin = puoConfigurare();
  } catch (_errore) {}
  if (!admin && state.arreda) {
    state.arreda = false;
    state.scena?.arreda(false);
  }
  if (!casa.piani.some((p) => p.k === state.vista)) state.vista = "esterno";
  const nodo = tela();
  doc.documentElement.classList.add("dm-casa3d-acceso");
  nodo.dataset.tema = doc.documentElement.getAttribute("data-theme") || "light";
  nodo.dataset.arreda = String(state.arreda);
  scriviSeCambia(nodo.querySelector(".c3-testa-posto"), testataMarkup(casa, admin));
  /* Una plancia Casa 3D appena nata non ha ancora la casa: niente scena,
   * niente schede, e al posto della casa l'invito a crearla. */
  const vuota = !casa.piani.length;
  scriviSeCambia(
    nodo.querySelector(".c3-sinistra"),
    vuota ? "" : sinistraMarkup(casa, states, admin),
  );
  const guardabili = telecamereGuardabili(casa, states);
  scriviSeCambia(
    nodo.querySelector(".c3-elenco"),
    vuota ? "" : elencoMarkup(casa, states, guardabili),
  );
  /* La scena: si costruisce una volta, si rifa' solo se la casa e' cambiata
   * da un'altra parte (la procedura «Crea», un altro dispositivo). */
  const firma = JSON.stringify(casa);
  if (state.scena && state.firma !== firma) spegniLaScena();
  if (state.scena) state.scena.aggiornaStati(states);
  else if (!vuota && !state.caricando && !state.guasto) avviaLaScena(admin);
  scriviSeCambia(
    nodo.querySelector(".c3-attesa"),
    state.scena
      ? ""
      : vuota
        ? casaDaCreareMarkup(admin)
        : `<p>${esc(state.guasto ? t("La casa in 3D non si apre su questo dispositivo.", "The 3D house cannot open on this device.") : t("Arriva la casa…", "Loading the house…"))}</p>`,
  );
  /* Il video vivo non si ridisegna finche' resta aperto; una telecamera che
   * smette di potersi guardare si chiude subito. */
  const sopra = nodo.querySelector(".c3-sopra");
  const video = sopra.querySelector("[data-c3-video]");
  if (video && guardabili.has(video.dataset.c3Video)) {
    avviaIlBattito();
    return;
  }
  if (video) {
    chiudiIlVideo();
    state.finestra = null;
  }
  if (scriviSeCambia(sopra, finestraMarkup(casa, states))) accendiIlVideo(sopra, casa, states);
  avviaIlBattito();
}

function ridisegna() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      disegna();
    } catch (errore) {
      root.console?.warn?.("[DashboardModern] casa 3d", errore);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

/* L'ora in cima, ogni mezzo minuto; niente quando nessuno guarda. */
function avviaIlBattito() {
  if (state.timer) return;
  state.timer =
    root.setInterval?.(() => {
      if (!doc?.getElementById(ID)) {
        root.clearInterval?.(state.timer);
        state.timer = 0;
        return;
      }
      if (doc.hidden || doc.getElementById("editor-modal")) return;
      ridisegna();
    }, 30000) || 0;
}

/* ── i gesti ──────────────────────────────────────────────────────────── */

function vibra(quanto = 10) {
  try {
    root.navigator?.vibrate?.(quanto);
  } catch (_errore) {}
}

function avviso(testo, tipo = "bene") {
  const el = doc?.getElementById(ID)?.querySelector(".c3-avviso");
  if (!el) return;
  el.textContent = testo;
  el.dataset.tipo = tipo;
  el.classList.add("visto");
  root.clearTimeout?.(state.avviso);
  state.avviso = root.setTimeout?.(() => el.classList.remove("visto"), 2200);
}

function apriFinestra(finestra) {
  if (state.finestra?.tipo === "telecamera") chiudiIlVideo();
  state.finestra = finestra;
  ridisegna();
}

function chiudi() {
  if (state.finestra?.tipo === "telecamera") chiudiIlVideo();
  state.finestra = null;
  ridisegna();
}

function alClic(evento) {
  const el = evento.target?.closest?.("[data-c3s]");
  if (!el) return;
  const cosa = el.dataset.c3s;
  if (cosa === "velo") {
    if (evento.target === el) chiudi();
    return;
  }
  if (cosa === "chiudi") return chiudi();
  /* Il ⚙ di chi amministra: il Config di questa plancia, sulla scheda Casa 3D
   * — come il «Colpo d'occhio». Il Config sta sopra, e la casa si fa da parte
   * finche' e' aperto. */
  if (cosa === "config") {
    try {
      root.apriConfigEntita?.();
      root.setTimeout?.(() => root.editorSwitch?.("casa3d"), 50);
    } catch (_errore) {}
    return;
  }
  if (cosa === "menu") {
    apriIlMenu({
      idTela: ID,
      tasto: '[data-c3s="menu"]',
      rimisura: () => state.scena?.ridimensiona(),
    });
    return;
  }
  if (cosa === "vista") {
    const k = clean(el.dataset.c3sK) || "esterno";
    vibra(6);
    state.vista = k;
    if (state.scena && !state.scena.apri(k)) state.vista = "esterno";
    return ridisegna();
  }
  if (cosa === "arreda") {
    state.arreda = !state.arreda;
    state.scena?.arreda(state.arreda);
    vibra(6);
    return ridisegna();
  }
  if (cosa === "crea") {
    const crea = root.__DM_CASA3D_CREA__;
    if (typeof crea === "function") {
      try {
        crea();
      } catch (errore) {
        root.console?.warn?.("[DashboardModern] casa 3d, crea", errore);
      }
    } else
      avviso(
        t(
          "La procedura per creare la casa non c'è ancora",
          "The house wizard is not available yet",
        ),
        "male",
      );
    return;
  }
  if (cosa === "guarda") return guarda(clean(el.dataset.c3sE));
  if (cosa === "comanda") {
    const entity = clean(el.dataset.c3sE);
    const azione = azioneDelTocco(clean(el.dataset.c3sK), entity, allStates()?.[entity]);
    vibra();
    if (azione?.domain) comanda(azione);
  }
}

/** Rimette la Casa 3D (se il config la accende). */
export function apriCasa3D() {
  state.nascosta = false;
  ridisegna();
}

/** Toglie la Casa 3D finche' non la si riapre: si torna alla plancia classica. */
export function chiudiCasa3D() {
  state.nascosta = true;
  togliLaTela();
}

/* ── il foglio ────────────────────────────────────────────────────────── */

function installaLoStile() {
  const C3 = `#${ID}`;
  installStyle(
    "dm-casa3d-style",
    `
    html.dm-casa3d-acceso:not(:has(#editor-modal)),html.dm-casa3d-acceso:not(:has(#editor-modal)) body{overflow:hidden!important}
    html:has(#editor-modal) #${ID}{display:none!important}
    /* Sulla casa la barra delle sezioni non c'e'.
     *
     * La casa e' un foglio che copre tutto, come il muro: si esce col ☰. Nel
     * browser la barra ci finiva sotto e non si vedeva; nell'app sul telefono
     * invece restava a meta' sopra, col fondo della pagina tagliato dietro
     * («la navbar qua non deve esserci proprio»). Adesso se ne va — lei, la
     * maniglia che la richiama e il tasto della voce — finche' la casa e'
     * aperta, dappertutto. */
    html.dm-casa3d-acceso nav.tabs.bottom-nav-bar,
    html.dm-casa3d-acceso .bottom-nav-handle,
    html.dm-casa3d-acceso .dm-assist-tasto{display:none!important}
    ${C3}{--c3-bg:#eef2f7;--c3-card:#fff;--c3-bordo:#e2e8f0;--c3-testo:#0a0e17;--c3-fioco:#64748b;--c3-morbido:#f8fafc;--c3-accento:#0ea5e9;
      --c3-ombra:0 1px 2px rgba(15,23,42,.04),0 4px 12px rgba(15,23,42,.06);
      position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:var(--c3-bg);color:var(--c3-testo);
      font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
    ${C3}[data-tema="dark"]{--c3-bg:#0b1120;--c3-card:#111827;--c3-bordo:#1f2a44;--c3-testo:#e5e7eb;--c3-fioco:#94a3b8;--c3-morbido:#0f172a;
      --c3-ombra:0 1px 2px rgba(0,0,0,.3),0 6px 16px rgba(0,0,0,.35)}
    ${C3} *{box-sizing:border-box}
    :where(${C3}) button{font:inherit;color:inherit}
    ${C3} .c3-pagina{display:flex;flex-direction:column;gap:14px;height:100%;padding:16px}
    ${C3}[data-mu-sotto-il-menu]{z-index:4!important}
    ${C3}[data-mu-accanto-al-menu]{right:0}

    ${C3} .c3-testa{display:flex;align-items:center;gap:14px;padding:14px 18px;border-radius:24px;background:var(--c3-card);
      border:1px solid var(--c3-bordo);box-shadow:var(--c3-ombra)}
    ${C3} .c3-menu{display:flex;flex-direction:column;justify-content:center;gap:5px;flex:0 0 auto;width:46px;height:46px;padding:0 13px;
      border-radius:14px;border:1px solid var(--c3-bordo);background:var(--c3-morbido);cursor:pointer}
    ${C3} .c3-menu span{display:block;height:3px;border-radius:3px;background:var(--c3-testo)}
    ${C3} .c3-testa-testo{min-width:0;flex:0 1 auto}
    ${C3} .c3-testa-testo h1{margin:0;font-family:'Oswald',system-ui,sans-serif;font-size:24px;font-weight:700;letter-spacing:1px;
      text-transform:uppercase;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    ${C3} .c3-testa-testo p{margin:3px 0 0;font-size:11.5px;font-weight:700;color:var(--c3-fioco);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    ${C3} .c3-pillole{display:flex;gap:4px;padding:4px;border-radius:999px;background:var(--c3-morbido);border:1px solid var(--c3-bordo);
      overflow-x:auto;scrollbar-width:none;flex:0 1 auto;min-width:0}
    ${C3} .c3-pillola{flex:0 0 auto;padding:8px 14px;border:0;border-radius:999px;background:none;cursor:pointer;font-size:12.5px;font-weight:800;
      color:var(--c3-fioco);white-space:nowrap}
    ${C3} .c3-pillola[aria-pressed="true"]{background:color-mix(in srgb,var(--c3-accento) 16%,transparent);color:var(--c3-accento)}
    ${C3} .c3-spazio{flex:1}
    ${C3} .c3-tasto{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;padding:10px 16px;border-radius:999px;cursor:pointer;
      font-size:13px;font-weight:800;border:1px solid var(--c3-bordo);background:var(--c3-morbido);white-space:nowrap}
    ${C3} .c3-tasto[aria-pressed="true"]{background:var(--c3-accento);border-color:transparent;color:#fff}
    ${C3} .c3-config{display:grid;place-items:center;flex:0 0 auto;width:46px;height:46px;border-radius:14px;cursor:pointer;font-size:20px;
      border:1px solid var(--c3-bordo);background:var(--c3-morbido);color:var(--c3-testo)}
    ${C3} .c3-ora{flex:0 0 auto;padding:6px 10px;border-radius:999px;font-family:'Oswald',system-ui,sans-serif;font-size:13px;font-weight:700;
      letter-spacing:1px;background:var(--c3-morbido);border:1px solid var(--c3-bordo)}

    ${C3} .c3-corpo{flex:1;min-height:0;display:grid;grid-template-columns:270px minmax(0,1fr) 330px;gap:14px}
    ${C3} .c3-sinistra,${C3} .c3-destra{display:flex;flex-direction:column;gap:14px;min-height:0;overflow-y:auto;scrollbar-width:thin}
    ${C3} .c3-scheda{padding:16px;border-radius:22px;background:var(--c3-card);border:1px solid var(--c3-bordo);box-shadow:var(--c3-ombra)}
    ${C3} .c3-scheda h2{display:flex;align-items:center;gap:8px;margin:0 0 12px;font-family:'Oswald',system-ui,sans-serif;font-size:15px;font-weight:500;
      letter-spacing:.06em;text-transform:uppercase;color:var(--c3-fioco)}
    ${C3} .c3-scheda h2 b{color:var(--c3-testo);font-weight:500}
    ${C3} .c3-nota{margin:0 0 10px;font-size:12px;color:var(--c3-fioco);line-height:1.45}
    ${C3} .c3-piano{display:flex;align-items:center;gap:12px;width:100%;margin-bottom:8px;padding:11px 12px;border-radius:16px;cursor:pointer;text-align:left;
      background:var(--c3-morbido);border:1px solid var(--c3-bordo);transition:background .25s,border-color .25s}
    ${C3} .c3-piano[aria-pressed="true"]{background:color-mix(in srgb,var(--c3-accento) 14%,transparent);border-color:color-mix(in srgb,var(--c3-accento) 60%,transparent)}
    ${C3} .c3-bollo{display:grid;place-items:center;flex:0 0 auto;width:40px;height:40px;border-radius:50%;font-size:19px;
      background:color-mix(in srgb,var(--c3-accento) 16%,transparent)}
    ${C3} .c3-piano-testo{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
    ${C3} .c3-piano-testo b{font-size:14px}
    ${C3} .c3-piano-testo small{font-size:11.5px;color:var(--c3-fioco)}
    ${C3} .c3-freccia{font-size:18px;color:var(--c3-fioco)}
    ${C3} .c3-tutta{margin:0 0 6px;padding:0;list-style:none;font-size:12.5px;line-height:1.9}

    ${C3} .c3-palco{position:relative;min-height:0;border-radius:24px;overflow:hidden;border:1px solid var(--c3-bordo);box-shadow:var(--c3-ombra);
      background:radial-gradient(ellipse at 50% 40%,#1b2b4f,#0d1528 75%)}
    ${C3} .c3-posto{position:absolute;inset:0;border-radius:inherit}
    ${C3} .c3-attesa{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;color:#cbd5e1;font-size:13px;font-weight:700}
    ${C3} .c3-attesa:empty{display:none}
    ${C3} .c3-da-creare{pointer-events:auto;display:grid;justify-items:center;gap:10px;max-width:420px;padding:24px;text-align:center}
    ${C3} .c3-da-creare>span{font-size:44px}
    ${C3} .c3-da-creare h2{margin:0;font-size:20px;color:inherit}
    ${C3} .c3-da-creare p{margin:0;font-weight:500;line-height:1.45}
    ${C3} .c3-da-creare .c3-tasto-grande{padding:12px 20px;font-size:15px;background:#0ea5e9;border-color:#0ea5e9;color:#fff}

    ${C3} .c3-elenco-righe{display:grid;gap:8px;margin:0;padding:0;list-style:none}
    ${C3} .c3-disp{--c:100,116,139;display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:14px;background:var(--c3-morbido);
      border:1px solid var(--c3-bordo)}
    ${C3} .c3-disp[data-tono="luce"]{--c:245,158,11}
    ${C3} .c3-disp[data-tono="movimento"]{--c:124,58,237}
    ${C3} .c3-disp[data-tono="allarme"]{--c:239,68,68}
    ${C3} .c3-disp[data-tono="telecamera"]{--c:14,165,233}
    ${C3} .c3-disp[data-tono="clima"]{--c:234,88,12}
    ${C3} .c3-disp[data-tono="ok"]{--c:22,163,74}
    ${C3} .c3-disp[data-tono="lavora"]{--c:16,185,129}
    ${C3} .c3-disp[data-attivo="true"]{background:rgba(var(--c),.12);border-color:rgba(var(--c),.45)}
    ${C3} .c3-disp-ic{display:grid;place-items:center;flex:0 0 auto;width:34px;height:34px;border-radius:50%;font-size:16px;background:rgba(var(--c),.16)}
    ${C3} .c3-disp-testo{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
    ${C3} .c3-disp-testo b{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    ${C3} .c3-disp-testo small{font-size:11px;color:var(--c3-fioco);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    ${C3} .c3-comando{display:grid;place-items:center;flex:0 0 auto;width:38px;height:38px;border-radius:50%;cursor:pointer;font-size:15px;font-weight:800;
      border:1px solid var(--c3-bordo);background:var(--c3-card)}
    ${C3} .c3-comando[data-acceso="true"]{background:rgb(var(--c));border-color:transparent;color:#fff}
    ${C3} .c3-chiuso{flex:0 0 auto;font-size:15px}
    ${C3}[data-arreda="true"] .c3-elenco{display:none}
    ${C3} .c3-arreda-posto{padding:16px;border-radius:22px;background:var(--c3-card);border:1px solid var(--c3-bordo);box-shadow:var(--c3-ombra)}
    ${C3} .c3-arreda-posto[hidden]{display:none}

    ${C3} .c3-velo{position:fixed;inset:0;z-index:8;display:flex;align-items:center;justify-content:center;padding:20px;
      background:rgba(15,23,42,.65);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
    ${C3} .c3-finestra{display:flex;flex-direction:column;width:100%;max-width:900px;max-height:88vh;overflow:hidden;border-radius:26px;
      background:var(--c3-card);box-shadow:0 30px 80px rgba(0,0,0,.4)}
    ${C3} .c3-finestra-testa{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 20px;border-bottom:1px solid var(--c3-bordo)}
    ${C3} .c3-finestra-testa h3{margin:0;font-family:'Oswald',system-ui,sans-serif;font-size:18px;font-weight:700;letter-spacing:.8px;text-transform:uppercase}
    ${C3} .c3-chiudi{display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:50%;cursor:pointer;font-weight:800;
      color:var(--c3-fioco);background:var(--c3-morbido)}
    ${C3} .c3-video{min-height:220px;padding:12px}

    ${C3} .c3-avviso{position:fixed;bottom:30px;left:50%;z-index:9;transform:translateX(-50%) translateY(20px);padding:13px 22px;border-radius:999px;
      font-size:14px;font-weight:800;white-space:nowrap;color:#fff;background:#059669;box-shadow:0 12px 32px rgba(0,0,0,.3);
      opacity:0;pointer-events:none;transition:all .4s cubic-bezier(.165,.84,.44,1)}
    ${C3} .c3-avviso[data-tipo="male"]{background:#dc2626}
    ${C3} .c3-avviso.visto{opacity:1;transform:translateX(-50%) translateY(0)}

    @media(max-width:1100px){
      ${C3} .c3-corpo{grid-template-columns:230px minmax(0,1fr) 290px}
      ${C3} .c3-tasto{padding:9px 12px;font-size:12px}
    }
    @media(max-width:860px){
      ${C3}{overflow-y:auto;-webkit-overflow-scrolling:touch}
      ${C3} .c3-pagina{height:auto;min-height:100%;padding:10px 10px calc(16px + var(--dm-fondo-di-sistema,0px));gap:10px}
      ${C3} .c3-testa{flex-wrap:wrap;gap:10px;padding:12px 14px;border-radius:20px}
      ${C3} .c3-testa-testo{flex:1 1 calc(100% - 70px)}
      ${C3} .c3-testa-testo h1{font-size:19px}
      ${C3} .c3-pillole{order:5;flex:1 1 100%}
      ${C3} .c3-spazio{display:none}
      ${C3} .c3-corpo{display:flex;flex-direction:column;gap:10px}
      ${C3} .c3-palco{order:-1;height:62vh;min-height:340px;border-radius:20px}
      ${C3} .c3-sinistra,${C3} .c3-destra{overflow:visible}
    }
    `,
  );
}

export function installCasa3D() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installaLoStile();
  /* La procedura, dopo aver salvato, ridisegna la casa da qui. */
  root.__DM_CASA3D_RIDISEGNA__ = apriCasa3D;
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, ridisegna);
  root.addEventListener?.("storage", ridisegna);
  /* Chiudere il Config rimette la pagina: il Config si apre sopra di lei. */
  for (const nome of ["render", "chiudiEditor", "closeEditor"]) {
    const prima = root[nome];
    if (typeof prima !== "function" || prima.__dmCasa3d) continue;
    const avvolta = function (...args) {
      const esito = prima.apply(this, args);
      ridisegna();
      return esito;
    };
    avvolta.__dmCasa3d = true;
    avvolta.__dmPrevious = prima;
    root[nome] = avvolta;
  }
  doc.addEventListener?.("keydown", (evento) => {
    if (evento.key === "Escape" && state.finestra) chiudi();
  });
  ridisegna();
  return true;
}

senzaCadere(installCasa3D);
