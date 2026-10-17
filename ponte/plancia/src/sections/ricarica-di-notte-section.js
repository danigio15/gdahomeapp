/* La carta «Ricarica di notte», nella pagina Auto.
 *
 * «Una cosa semplice da gestire sulla plancia.» Qui si sceglie e si guarda; a
 * fare e' la casa (`ponte/src/ricarica-di-notte.js`), che gira anche quando
 * nessuna pagina e' aperta. Le regole sono una sola, in
 * `core/ricarica-di-notte.js`, e le leggono tutte e due: la carta racconta
 * esattamente quello che la casa fara'.
 *
 * Le impostazioni stanno in `cd_ricarica_notte`, una casella della
 * configurazione come le altre: viaggia fra i dispositivi e il ponte la legge
 * dalla plancia principale. Non c'e' un comando per scriverle, e quindi
 * nemmeno una porta in piu' da difendere. Quello che la casa sta facendo — la
 * notte in corso, l'esito di stanotte — lo si chiede al ponte con
 * `ponte/ricarica-notte/stato`, in sola lettura.
 *
 * La carta compare solo dove c'e' evcc: senza l'entita' della modalita' non
 * c'e' niente da comandare, e una carta che non comanda niente e' peggio di
 * nessuna. Sul widget Auto della Home la stessa notte si dice in una riga
 * (`laPastigliaDellaNotte`).
 */
import { evccPresence } from "../core/ev-console.js";
import {
  CHIAVE_RICARICA_NOTTE,
  entitaDellaRicarica,
  fasciaDi,
  impostazioniPulite,
  letturaDellAuto,
  prezzoDellaNotte,
  prossimaFascia,
  saFareMinPiuSole,
} from "../core/ricarica-di-notte.js";
import { CHIAVE_FASCE, minutiDellOra } from "../core/fasce-della-tariffa.js";
import {
  allStates,
  chiediAHomeAssistant,
  clean,
  doc,
  esc,
  formatNumber,
  installStyle,
  locale,
  planciaVisibile,
  readJson,
  root,
  t,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_RICARICA_NOTTE__";
const STILE = "dm-rn-style";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  giro: 0,
  /* L'ultima risposta della casa, e se la casa non c'e'. */
  ponte: null,
  assente: false,
  chiedendo: false,
  chiestoIl: 0,
});

/* Ogni quanto si richiede alla casa com'e' la notte. Un minuto: la carta non
 * deve rincorrere niente, e una richiesta al minuto non pesa a nessuno. */
const OGNI = 60_000;

/* ── cosa si sa ──────────────────────────────────────────────────────────── */

export function leImpostazioni() {
  return impostazioniPulite(readJson(CHIAVE_RICARICA_NOTTE, null));
}

function risolvi(rif) {
  try {
    return clean(root.resolveEntity?.(rif));
  } catch (_errore) {
    return "";
  }
}

/** L'auto adesso, letta dagli stati che la plancia ha gia'. */
function laLettura() {
  return letturaDellAuto(entitaDellaRicarica(risolvi), allStates());
}

/** Il costo unico, scritto nella casella o in quella di questo dispositivo. */
function costoScritto() {
  let costo = null;
  try {
    costo = root.cdCfg?.("cd_costo_kwh");
  } catch (_errore) {
    costo = null;
  }
  if (costo === undefined || costo === null || costo === "") {
    try {
      costo = root.localStorage?.getItem?.("cd_costo_kwh");
    } catch (_errore) {
      costo = null;
    }
  }
  return costo;
}

export function ilPrezzo(imp = leImpostazioni()) {
  let fasce = null;
  try {
    fasce = root.localStorage?.getItem?.(CHIAVE_FASCE);
  } catch (_errore) {
    fasce = null;
  }
  return prezzoDellaNotte({ fasce, costo: costoScritto(), stati: allStates(), da: imp.da });
}

/* ── le parole ───────────────────────────────────────────────────────────── */

const ora = (istante) =>
  new Date(istante).toLocaleTimeString(locale(), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

function nomeDelModo(modo) {
  const m = clean(modo).toLowerCase();
  if (m === "off") return t("Spento", "Off");
  if (m === "now" || m === "fast") return t("Veloce", "Fast");
  if (m === "minpv") return t("Min+Sole", "Min+Solar");
  if (m === "pv" || m === "smart") return t("Solare", "Solar");
  return clean(modo);
}

const pct = (n) => `${Math.round(n)}`;

/* «all'80%» e «al 60%», «l'80%» e «il 60%»: in italiano l'articolo si apostrofa
 * davanti ai numeri che si leggono con una vocale — uno, otto, undici, gli
 * ottanta. Le altre lingue non ne hanno bisogno, e per loro la frase porta il
 * numero com'e'. */
const siApostrofa = (testo) => {
  const n = Number(testo);
  return n === 1 || n === 8 || n === 11 || (n >= 80 && n <= 89);
};
const alPercento = (n) => (siApostrofa(n) ? `all'${n}%` : `al ${n}%`);
const ilPercento = (n) => (siApostrofa(n) ? `l'${n}%` : `il ${n}%`);

function siFerma(limiteNumero, fineIstante) {
  const fine = ora(fineIstante);
  if (limiteNumero === null || limiteNumero === undefined)
    return t(`al limite di evcc o alle ${fine}`, `at the evcc limit or at ${fine}`);
  const limite = pct(limiteNumero);
  const alLimite = alPercento(limite);
  return t(
    `${alLimite} (limite di evcc) o alle ${fine}`,
    `at ${limite}% (evcc limit) or at ${fine}`,
  );
}

const stessoGiorno = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

function quandoDetto(prossima, adesso) {
  const alle = ora(prossima.inizio);
  if (stessoGiorno(prossima.inizio, adesso))
    return t(`Stanotte alle ${alle}`, `Tonight at ${alle}`);
  const giorno = new Date(prossima.inizio).toLocaleDateString(locale(), { weekday: "long" });
  return t(`${giorno} alle ${alle}`, `${giorno} at ${alle}`);
}

/**
 * Il racconto della notte: un tono, un titolo e una riga sotto. Puro a parte
 * le parole: entrano le impostazioni, quello che ha detto la casa, l'auto e
 * l'istante.
 */
export function ilRacconto({ imp, ponte, assente, lettura, prezzo, adesso }) {
  if (!imp.attiva)
    return {
      tono: "spenta",
      titolo: t("Spenta: evcc fa come sempre", "Off: evcc works as usual"),
      sotto: "",
    };
  const nessunaCasa = assente
    ? t("Serve l'add-on: è la casa a farla partire", "Needs the add-on: the home starts it")
    : "";
  const sessione = ponte?.sessione;
  if (sessione) {
    const fine = ora(sessione.fine);
    const letto = lettura.limite ?? ponte?.auto?.limite ?? null;
    const limite = letto === null ? "" : pct(letto);
    const alLimite = alPercento(limite);
    const titolo = limite
      ? t(`In carica · fino ${alLimite} o alle ${fine}`, `Charging · until ${limite}% or ${fine}`)
      : t(`In carica · fino alle ${fine}`, `Charging · until ${fine}`);
    const inizio = ora(sessione.inizio);
    const partenza = Number.isFinite(sessione.socInizio) ? pct(sessione.socInizio) : "";
    const alPartenza = alPercento(partenza);
    const pezzi = [
      partenza
        ? t(`Partita alle ${inizio} ${alPartenza}`, `Started at ${inizio} at ${partenza}%`)
        : t(`Partita alle ${inizio}`, `Started at ${inizio}`),
    ];
    const socLetto = lettura.soc ?? ponte?.auto?.soc ?? null;
    if (socLetto !== null) {
      const soc = pct(socLetto);
      pezzi.push(t(`ora ${soc}%`, `now ${soc}%`));
    }
    if (Number.isFinite(sessione.kwh)) {
      pezzi.push(`${formatNumber(sessione.kwh, 1)} kWh`);
      if (prezzo.prezzo) {
        const euro = formatNumber(sessione.kwh * prezzo.prezzo, 2);
        pezzi.push(t(`circa ${euro} €`, `about ${euro} €`));
      }
    }
    return { tono: "carica", titolo, sotto: pezzi.join(" · ") };
  }
  const fascia = fasciaDi(imp, adesso);
  const esito = ponte?.esito;
  if (esito && (!fascia.dentro || ponte?.notteChiusa)) {
    const alle = ora(esito.alle);
    const soc = Number.isFinite(esito.soc) ? pct(esito.soc) : "—";
    const sotto = Number.isFinite(esito.sotto) ? pct(esito.sotto) : "—";
    const alSoc = alPercento(soc);
    const ilSotto = ilPercento(sotto);
    const limite = Number.isFinite(esito.limite) ? pct(esito.limite) : "—";
    if (esito.tipo === "non-parte")
      return {
        tono: "ferma",
        titolo: t("Stanotte non parte", "Not charging tonight"),
        sotto: t(
          `Batteria ${alSoc}: sopra ${ilSotto} scelto`,
          `Battery at ${soc}%: above the ${sotto}% you chose`,
        ),
      };
    if (esito.tipo === "piena")
      return {
        tono: "ferma",
        titolo: t("Già carica", "Already charged"),
        sotto: t(
          `Batteria ${alSoc}: il limite di evcc è ${limite}%`,
          `Battery at ${soc}%: the evcc limit is ${limite}%`,
        ),
      };
    if (esito.tipo === "a-mano") {
      const modo = nomeDelModo(esito.modo);
      return {
        tono: "ferma",
        titolo: t("Cambiata a mano", "Changed by hand"),
        sotto: t(
          `Stanotte non tocco più niente: evcc è su ${modo}`,
          `Nothing else is touched tonight: evcc is on ${modo}`,
        ),
      };
    }
    if (esito.tipo === "finita") {
      const perche =
        esito.motivo === "limite" && Number.isFinite(esito.soc)
          ? t(`${soc}% raggiunto`, `${soc}% reached`)
          : esito.motivo === "staccata"
            ? t("Auto staccata", "Car unplugged")
            : esito.motivo === "spenta"
              ? t("Spenta da te", "Turned off")
              : t("Fine della fascia", "End of the window");
      const pezzi = [];
      if (Number.isFinite(esito.kwh)) {
        const kwh = formatNumber(esito.kwh, 1);
        pezzi.push(t(`Caricati ${kwh} kWh`, `Charged ${kwh} kWh`));
        if (Number.isFinite(esito.costo)) {
          const euro = formatNumber(esito.costo, 2);
          pezzi.push(t(`circa ${euro} €`, `about ${euro} €`));
        }
      }
      if (esito.poi) {
        const modo = nomeDelModo(esito.poi);
        pezzi.push(t(`evcc messo su ${modo}`, `evcc set to ${modo}`));
      }
      return {
        tono: "finita",
        titolo: `${t(`Finita alle ${alle}`, `Finished at ${alle}`)} · ${perche}`,
        sotto: pezzi.join(" · "),
      };
    }
  }
  if (fascia.dentro && !ponte?.notteChiusa && imp.giorni[fascia.giorno]) {
    const fine = ora(fascia.fine);
    if (lettura.collegata === true)
      return { tono: "attesa", titolo: t("Sta per partire", "About to start"), sotto: nessunaCasa };
    return {
      tono: "attesa",
      titolo: t(`Collega l'auto entro le ${fine}`, `Plug in the car by ${fine}`),
      sotto:
        nessunaCasa ||
        t(
          "La fascia è cominciata: parte appena la colleghi",
          "The window has started: it starts as soon as you plug in",
        ),
    };
  }
  const prossima = prossimaFascia(imp, adesso);
  if (!prossima)
    return { tono: "spenta", titolo: t("Nessun giorno scelto", "No days chosen"), sotto: "" };
  const fine = ora(prossima.fine);
  return {
    tono: "attesa",
    titolo: quandoDetto(prossima, adesso),
    sotto:
      nessunaCasa ||
      (lettura.collegata === true
        ? t("Auto collegata ✓ — partirà da sola", "Car plugged in ✓ — it will start by itself")
        : t(`Collega l'auto entro le ${fine}`, `Plug in the car by ${fine}`)),
  };
}

/**
 * La riga della notte sul widget Auto della Home: «🌙 Ricarica notturna · Veloce
 * fino all'80% o alle 05:00» mentre carica, «🌙 Ricarica notturna stanotte alle
 * 23:00» quando aspetta la sua ora. Vuota quando e' spenta, o quando stanotte
 * non c'e'.
 *
 * Il nome e' «Ricarica notturna» e non la fascia della bolletta: «nel popup non deve
 * uscire ricarica F3, inventa un nome differente». «F3» e' una sigla del
 * contratto, che non dice niente a chi guarda l'auto; «notturna» dice quando
 * a colpo d'occhio, e il nome e' uno solo anche per chi la fascia non ce l'ha.
 */
export function laPastigliaDellaNotte(adesso = Date.now()) {
  const imp = leImpostazioni();
  if (!imp.attiva) return "";
  const nome = t("Ricarica notturna", "Night charging");
  const sessione = state.ponte?.sessione;
  if (sessione) {
    const modo = nomeDelModo(sessione.modo);
    const fine = ora(sessione.fine);
    const letto = laLettura().limite ?? state.ponte?.auto?.limite ?? null;
    const limite = letto === null ? "" : pct(letto);
    const alLimite = alPercento(limite);
    const corpo = limite
      ? t(`${modo} fino ${alLimite} o alle ${fine}`, `${modo} until ${limite}% or ${fine}`)
      : t(`${modo} fino alle ${fine}`, `${modo} until ${fine}`);
    return `🌙 ${nome} · ${corpo}`;
  }
  const dentro = fasciaDi(imp, adesso);
  if (dentro.dentro) return "";
  const prossima = prossimaFascia(imp, adesso);
  if (!prossima || !stessoGiorno(prossima.inizio, adesso)) return "";
  const alle = ora(prossima.inizio);
  return `🌙 ${nome} ${t(`stanotte alle ${alle}`, `tonight at ${alle}`)}`;
}

/* ── la casa ─────────────────────────────────────────────────────────────── */

async function chiediAllaCasa(forza = false) {
  /* Spenta, la casa non ha niente da raccontare: non si chiede niente. Chi
   * non usa la ricarica di notte non deve pagarla nemmeno con una domanda. */
  if (state.chiedendo || !leImpostazioni().attiva) return;
  const adesso = Date.now();
  if (!forza && adesso - state.chiestoIl < OGNI - 1000) return;
  state.chiedendo = true;
  state.chiestoIl = adesso;
  try {
    state.ponte = await chiediAHomeAssistant({ type: "ponte/ricarica-notte/stato" }, 8000);
    state.assente = false;
  } catch (errore) {
    const detto = clean(errore?.message);
    /* «Non conosco»: questa plancia non sta dietro all'add-on, e la notte non
     * la fa nessuno. Un filo non ancora aperto invece si riprova presto. */
    state.assente = /non conosco|unknown/i.test(detto);
    if (detto === "socket") state.chiestoIl = adesso - OGNI + 5000;
  } finally {
    state.chiedendo = false;
  }
  scheduleRicaricaDiNotte();
  try {
    root.dispatchEvent?.(new CustomEvent("dashboardmodern:ricarica-notte"));
  } catch (_errore) {}
}

/* ── il disegno ──────────────────────────────────────────────────────────── */

const ICONA_LUNA =
  '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M20.2 14.6A8.4 8.4 0 0 1 9.4 3.8a8.6 8.6 0 1 0 10.8 10.8Z" fill="currentColor"/></svg>';

function giorniDellaSettimana() {
  /* Dal lunedi', con l'iniziale della lingua di chi guarda: L M M G V S D. */
  const lunedi = new Date(2026, 9, 12);
  return Array.from({ length: 7 }, (_v, i) => {
    const d = new Date(lunedi);
    d.setDate(lunedi.getDate() + i);
    return {
      breve: d.toLocaleDateString(locale(), { weekday: "narrow" }),
      lungo: d.toLocaleDateString(locale(), { weekday: "long" }),
    };
  });
}

function segmentato(chiave, voci) {
  return `<div class="dm-rn-seg" role="group" data-rn-gruppo="${chiave}">${voci
    .map(
      ([valore, testo]) =>
        `<button type="button" class="dm-rn-seg-btn" data-rn-scelta="${chiave}" data-valore="${valore}" aria-pressed="false">${esc(testo)}</button>`,
    )
    .join("")}</div>`;
}

function scheletro() {
  const giorni = giorniDellaSettimana();
  return `
  <div class="dm-rn-testa">
    <span class="dm-rn-luna" aria-hidden="true">${ICONA_LUNA}</span>
    <div class="dm-rn-titoli">
      <h3 class="dm-rn-titolo">${esc(t("Ricarica notturna", "Night charging"))}</h3>
      <small class="dm-rn-sotto" data-rn="riassunto"></small>
    </div>
    <button type="button" class="dm-rn-int" role="switch" aria-checked="false" data-rn="attiva"
      aria-label="${esc(t("Ricarica notturna", "Night charging"))}"><span></span></button>
  </div>
  <div class="dm-rn-corpo"><div class="dm-rn-colonna">
  <div class="dm-rn-ore">
    <label class="dm-rn-ora"><small>${esc(t("Dalle", "From"))}</small>${campoOra("da")}</label>
    <span class="dm-rn-freccia" aria-hidden="true">→</span>
    <label class="dm-rn-ora"><small>${esc(t("Alle", "To"))}</small>${campoOra("a")}</label>
  </div>
  <div class="dm-rn-barra" aria-hidden="true">
    <div class="dm-rn-nastro"><i data-rn="tratto1"></i><i data-rn="tratto2"></i><b data-rn="adesso"></b></div>
    <div class="dm-rn-tacche"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>
  </div>
  <div class="dm-rn-riga">
    <span class="dm-rn-nome">${esc(t("In fascia", "In the window"))}</span>
    ${segmentato("inFascia", [
      ["now", t("Veloce", "Fast")],
      ["minpv", t("Min+Sole", "Min+Solar")],
    ])}
  </div>
  <div class="dm-rn-riga dm-rn-riga-alta">
    <div class="dm-rn-coppia"><span class="dm-rn-nome">${esc(t("Si ferma", "Stops"))}</span><b class="dm-rn-valore" data-rn="ferma"></b></div>
    <small class="dm-rn-nota">${esc(
      t(
        "Quello che arriva prima. Il limite lo legge da evcc: se lo cambi lì, cambia anche qui.",
        "Whichever comes first. The limit is read from evcc: change it there and it changes here too.",
      ),
    )}</small>
  </div>
  <div class="dm-rn-riga">
    <span class="dm-rn-nome">${esc(t("Poi", "Then"))}</span>
    ${segmentato("poi", [
      ["off", t("Spento", "Off")],
      ["prima", t("Come prima", "As before")],
      ["pv", t("Solare", "Solar")],
    ])}
  </div>
  </div><div class="dm-rn-colonna">
  <div class="dm-rn-riga dm-rn-prima">
    <span class="dm-rn-nome">${esc(t("Giorni", "Days"))}</span>
    <div class="dm-rn-giorni" role="group">${giorni
      .map(
        (g, i) =>
          `<button type="button" class="dm-rn-giorno" data-rn-giorno="${i}" aria-pressed="true" aria-label="${esc(g.lungo)}" title="${esc(g.lungo)}">${esc(g.breve)}</button>`,
      )
      .join("")}</div>
  </div>
  <div class="dm-rn-riga dm-rn-riga-alta">
    <div class="dm-rn-coppia"><label class="dm-rn-nome" for="dm-rn-sotto">${esc(t("Parte se la batteria è sotto", "Starts if the battery is below"))}</label><b class="dm-rn-valore dm-rn-grande" data-rn="sottoDetto"></b></div>
    <input type="range" id="dm-rn-sotto" class="dm-rn-cursore" min="10" max="100" step="5" data-rn="sotto">
    <small class="dm-rn-nota">${esc(
      t(
        "Al 100% parte sempre. Sopra la soglia stanotte non carica.",
        "At 100% it always starts. Above the threshold it does not charge tonight.",
      ),
    )}</small>
  </div>
  <div class="dm-rn-riga dm-rn-riga-alta dm-rn-senza-linea">
    <span class="dm-rn-nome">${esc(t("Prezzo in fascia", "Price in the window"))}</span>
    <div class="dm-rn-prezzo" data-rn="prezzo"></div>
  </div>
  <div class="dm-rn-stato" data-rn="stato" role="status" aria-live="polite"><i aria-hidden="true"></i><div><b data-rn="statoTitolo"></b><small data-rn="statoSotto"></small></div></div>
  </div></div>`;
}

/* L'ora si scrive a mano, sempre in ventiquattr'ore: «23:00», non «11:00 PM».
 * Il campo orario del browser segue la lingua del sistema, e la stessa fascia
 * si leggeva in due modi sullo stesso telefono. Si accetta anche «23», «2300»
 * e «23.00»; quello che non e' un'ora torna com'era. */
function campoOra(nome) {
  return `<input type="text" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="5" placeholder="hh:mm" data-rn="${nome}">`;
}

/** Quello che si e' scritto nel campo, come ora, o vuoto se non lo e'. */
export function oraScritta(testo) {
  const pulito = clean(testo).replace(".", ":");
  const soloCifre = /^\d{3,4}$/.test(pulito)
    ? `${pulito.slice(0, -2)}:${pulito.slice(-2)}`
    : pulito;
  const minuti = minutiDellOra(soloCifre);
  if (minuti === null) return "";
  return `${String(Math.floor(minuti / 60)).padStart(2, "0")}:${String(minuti % 60).padStart(2, "0")}`;
}

function prezzoMarkup(prezzo) {
  if (prezzo.fonte === "fascia") {
    const fascia = prezzo.fascia;
    return `<div class="dm-rn-prezzo-box" data-tono="ok"><div><b>${esc(formatNumber(prezzo.prezzo, 2))} €/kWh</b><small>${esc(
      t(
        `Dalla fascia ${fascia} in Impostazioni → Energia`,
        `From band ${fascia} in Settings → Energy`,
      ),
    )}</small></div><span aria-hidden="true">✓</span></div>`;
  }
  if (prezzo.fonte === "unica")
    return `<div class="dm-rn-prezzo-box" data-tono="unica"><div><b>${esc(formatNumber(prezzo.prezzo, 2))} €/kWh</b><small>${esc(
      t("Fasce non impostate: uso la tariffa unica", "No time bands set: using the single rate"),
    )}</small></div><span aria-hidden="true">!</span></div>`;
  return `<div class="dm-rn-prezzo-box" data-tono="manca"><div><b>${esc(t("Prezzo non impostato", "Price not set"))}</b><small>${esc(
    t("Inseriscilo per vedere quanto spendi", "Enter it to see what you spend"),
  )}</small></div><button type="button" class="dm-rn-imposta" data-rn="imposta">${esc(t("Imposta", "Set"))}</button></div>`;
}

function riassunto(imp, prezzo) {
  const pezzi = [];
  /* Gli orari e non la sigla della bolletta: «F3» a chi guarda la carta non
   * dice quando carica, «23:00–05:00» si'. Da dove viene il prezzo lo dice gia'
   * il riquadro «Prezzo in fascia». */
  pezzi.push(`${imp.da}–${imp.a}`);
  if (prezzo.prezzo) pezzi.push(`${formatNumber(prezzo.prezzo, 2)} €/kWh`);
  const sotto = imp.sotto;
  const ilSotto = ilPercento(sotto);
  pezzi.push(
    sotto >= 100 ? t("parte sempre", "always starts") : t(`sotto ${ilSotto}`, `below ${sotto}%`),
  );
  return pezzi.join(" · ");
}

const testo = (nodo, valore) => {
  if (nodo && nodo.textContent !== valore) nodo.textContent = valore;
};
const attributo = (nodo, nome, valore) => {
  if (nodo && nodo.getAttribute(nome) !== valore) nodo.setAttribute(nome, valore);
};

function laCarta() {
  const page = doc?.getElementById?.("page-ev");
  if (!page) return null;
  let carta = doc.getElementById("dm-rn");
  const evcc = page.querySelector(".lm-evcc-card");
  if (!carta) {
    if (!evcc) return null;
    carta = doc.createElement("section");
    carta.id = "dm-rn";
    carta.className = "dm-rn";
    carta.setAttribute("aria-label", t("Ricarica notturna", "Night charging"));
    evcc.insertAdjacentElement("afterend", carta);
    carta.addEventListener("click", alTocco);
    carta.addEventListener("change", alCambio);
    carta.addEventListener("input", alCursore);
  }
  const lingua = String(locale());
  if (carta.dataset.lingua !== lingua) {
    carta.dataset.lingua = lingua;
    carta.innerHTML = scheletro();
  }
  return carta;
}

function minutiDi(oraTesto) {
  return minutiDellOra(oraTesto) ?? 0;
}

export function renderRicaricaDiNotte(adesso = Date.now()) {
  const carta = laCarta();
  if (!carta) return false;
  let resolve = (valore) => valore;
  try {
    if (typeof root.resolveEntity === "function") resolve = root.resolveEntity;
  } catch (_errore) {}
  const presente = evccPresence(allStates(), resolve).mode;
  if (presente === carta.hasAttribute("hidden")) {
    if (presente) carta.removeAttribute("hidden");
    else carta.setAttribute("hidden", "hidden");
  }
  if (!presente) return true;
  const imp = leImpostazioni();
  const lettura = laLettura();
  const prezzo = ilPrezzo(imp);
  const q = (nome) => carta.querySelector(`[data-rn="${nome}"]`);
  attributo(carta, "data-attiva", String(imp.attiva));
  attributo(q("attiva"), "aria-checked", String(imp.attiva));
  testo(q("riassunto"), riassunto(imp, prezzo));
  for (const nome of ["da", "a"]) {
    const campo = q(nome);
    if (campo && doc.activeElement !== campo && campo.value !== imp[nome]) campo.value = imp[nome];
  }
  /* Il nastro delle ventiquattr'ore: la fascia, spezzata in due se passa la
   * mezzanotte, e il segno di adesso. */
  const da = minutiDi(imp.da);
  const a = minutiDi(imp.a);
  const pc = (m) => `${((m / 1440) * 100).toFixed(2)}%`;
  const tratti =
    a > da
      ? [[da, a], null]
      : [
          [da, 1440],
          [0, a],
        ];
  [q("tratto1"), q("tratto2")].forEach((nodo, i) => {
    if (!nodo) return;
    const tratto = tratti[i];
    const stile = tratto
      ? `left:${pc(tratto[0])};width:${pc(tratto[1] - tratto[0])}`
      : "display:none";
    attributo(nodo, "style", stile);
  });
  const d = new Date(adesso);
  attributo(q("adesso"), "style", `left:${pc(d.getHours() * 60 + d.getMinutes())}`);
  const opzioni = lettura.opzioni;
  for (const tasto of carta.querySelectorAll("[data-rn-scelta]")) {
    const gruppo = tasto.dataset.rnScelta;
    attributo(tasto, "aria-pressed", String(imp[gruppo] === tasto.dataset.valore));
    if (gruppo === "inFascia" && tasto.dataset.valore === "minpv") {
      /* Un evcc di oggi il Min+Sole non ce l'ha: il tasto non si offre, a
       * meno che non sia gia' la scelta — allora resta, e la casa usa la
       * veloce. */
      const nascosto = !saFareMinPiuSole(opzioni) && imp.inFascia !== "minpv";
      if (tasto.hidden !== nascosto) tasto.hidden = nascosto;
    }
  }
  for (const tasto of carta.querySelectorAll("[data-rn-giorno]"))
    attributo(tasto, "aria-pressed", String(imp.giorni[Number(tasto.dataset.rnGiorno)] === true));
  const fascia = fasciaDi(imp, adesso);
  const fine =
    state.ponte?.sessione?.fine ??
    (fascia.dentro ? fascia.fine : (prossimaFascia(imp, adesso)?.fine ?? fascia.fine));
  testo(q("ferma"), siFerma(lettura.limite ?? state.ponte?.auto?.limite ?? null, fine));
  const cursore = q("sotto");
  if (cursore && doc.activeElement !== cursore && cursore.value !== String(imp.sotto))
    cursore.value = String(imp.sotto);
  pitturaIlCursore(carta, cursore ? Number(cursore.value) : imp.sotto);
  const scatola = q("prezzo");
  const firma = `${prezzo.fonte}|${prezzo.prezzo}|${prezzo.fascia}|${locale()}`;
  if (scatola && scatola.dataset.firma !== firma) {
    scatola.dataset.firma = firma;
    scatola.innerHTML = prezzoMarkup(prezzo);
  }
  const racconto = ilRacconto({
    imp,
    ponte: state.ponte,
    assente: state.assente,
    lettura,
    prezzo,
    adesso,
  });
  attributo(q("stato"), "data-tono", racconto.tono);
  testo(q("statoTitolo"), racconto.titolo);
  testo(q("statoSotto"), racconto.sotto);
  const sotto = q("statoSotto");
  if (sotto && sotto.hidden !== !racconto.sotto) sotto.hidden = !racconto.sotto;
  return true;
}

function pitturaIlCursore(carta, valore) {
  const n = Number.isFinite(valore) ? valore : 100;
  testo(carta.querySelector('[data-rn="sottoDetto"]'), `${n}%`);
  const cursore = carta.querySelector('[data-rn="sotto"]');
  if (cursore) cursore.style.setProperty("--rn-pieno", `${((n - 10) / 90) * 100}%`);
}

/* ── i gesti ─────────────────────────────────────────────────────────────── */

function salva(cambia) {
  const prima = leImpostazioni();
  const dopo = impostazioniPulite({ ...prima, ...cambia(prima) });
  writeJsonIfChanged(CHIAVE_RICARICA_NOTTE, dopo);
  renderRicaricaDiNotte();
  try {
    root.dispatchEvent?.(new CustomEvent("dashboardmodern:ricarica-notte"));
  } catch (_errore) {}
  /* La casa la rilegge al prossimo giro: si richiede com'e' andata appena ha
   * avuto il tempo di riceverla. */
  root.setTimeout?.(() => void chiediAllaCasa(true), 2500);
}

function alTocco(evento) {
  const bersaglio = evento.target;
  if (bersaglio?.closest?.('[data-rn="attiva"]')) {
    salva((imp) => ({ attiva: !imp.attiva }));
    return;
  }
  const scelta = bersaglio?.closest?.("[data-rn-scelta]");
  if (scelta) {
    salva(() => ({ [scelta.dataset.rnScelta]: scelta.dataset.valore }));
    return;
  }
  const giorno = bersaglio?.closest?.("[data-rn-giorno]");
  if (giorno) {
    const i = Number(giorno.dataset.rnGiorno);
    salva((imp) => ({ giorni: imp.giorni.map((acceso, j) => (j === i ? !acceso : acceso)) }));
    return;
  }
  if (bersaglio?.closest?.('[data-rn="imposta"]')) apriLeImpostazioniDellEnergia();
}

function alCambio(evento) {
  const campo = evento.target;
  const nome = campo?.dataset?.rn;
  if (nome === "da" || nome === "a") {
    const scritta = oraScritta(campo.value);
    if (scritta) {
      campo.value = scritta;
      salva(() => ({ [nome]: scritta }));
    } else campo.value = leImpostazioni()[nome];
  } else if (nome === "sotto") salva(() => ({ sotto: Number(campo.value) }));
}

function alCursore(evento) {
  if (evento.target?.dataset?.rn !== "sotto") return;
  const carta = doc.getElementById("dm-rn");
  if (carta) pitturaIlCursore(carta, Number(evento.target.value));
}

/* «Imposta»: la configurazione, sulla scheda dell'energia, alla linguetta
 * delle impostazioni — dove stanno la tariffa unica e le fasce. */
function apriLeImpostazioniDellEnergia() {
  try {
    root.apriConfigEntita?.();
  } catch (_errore) {}
  root.setTimeout?.(() => {
    try {
      root.editorSwitch?.("sez1");
    } catch (_errore) {}
    root.setTimeout?.(
      () => doc?.querySelector?.('.ed-inner-tab[data-energy-tab="settings"]')?.click?.(),
      160,
    );
  }, 160);
}

/* ── l'aggancio ──────────────────────────────────────────────────────────── */

function laPaginaSiVede() {
  return (
    planciaVisibile() && Boolean(doc?.getElementById?.("page-ev")?.classList?.contains("active"))
  );
}

export function scheduleRicaricaDiNotte() {
  if (state.frame) return;
  const run = () => {
    state.frame = 0;
    renderRicaricaDiNotte();
  };
  state.frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 0) || 0;
}

export function installRicaricaDiNotteSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyle(STILE, stile());
  for (const nome of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "pageshow",
    "dashboardmodern:locale-changed",
  ])
    root.addEventListener?.(nome, () => {
      scheduleRicaricaDiNotte();
      /* Chi torna sulla plancia — la scheda che riemerge, l'app riaperta —
       * deve trovare la notte di adesso, non quella di un minuto fa. */
      void chiediAllaCasa(nome === "pageshow");
    });
  root.addEventListener?.("dashboardmodern:state-changed", () => {
    if (laPaginaSiVede()) scheduleRicaricaDiNotte();
  });
  doc.addEventListener(
    "click",
    (evento) => {
      if (evento.target?.closest?.('[data-tab="ev"],[data-page="ev"]')) {
        root.setTimeout?.(scheduleRicaricaDiNotte, 0);
        void chiediAllaCasa(true);
      }
    },
    true,
  );
  /* Una volta al minuto: la carta se si vede, e la casa se la notte e'
   * accesa — la riga sul widget della Home la vuole sapere anche da li'. */
  state.giro = root.setInterval?.(() => {
    if (!planciaVisibile()) return;
    void chiediAllaCasa();
    if (laPaginaSiVede()) scheduleRicaricaDiNotte();
  }, OGNI);
  renderRicaricaDiNotte();
  root.setTimeout?.(() => void chiediAllaCasa(true), 1500);
}

/* ── lo stile ────────────────────────────────────────────────────────────── */

function stile() {
  return `
.dm-rn{
  --rn-bg:var(--evv-surface,var(--card-bg,#fff));
  --rn-box:var(--evv-surface-2,var(--surface-2,#f4f6fb));
  --rn-text:var(--evv-text,var(--text,#0c1420));
  --rn-dim:var(--evv-dim,var(--text-dim,#5b6577));
  --rn-line:color-mix(in srgb,var(--rn-text) 9%,transparent);
  --rn-acc:#5b5bd6;--rn-acc-rgb:91,91,214;--rn-acc-text:#fff;
  --rn-ok:#059669;--rn-warn:#c2410c;--rn-bad:#be123c;--rn-run:#0284c7;
  display:grid;gap:0;padding:18px 18px 16px;border-radius:var(--evv-r,24px);
  background:var(--rn-bg);color:var(--rn-text);
  box-shadow:var(--evv-shadow,0 20px 38px -26px rgba(10,26,44,.55),0 2px 6px -3px rgba(10,26,44,.12));
  font-family:inherit;min-width:0;box-sizing:border-box;width:100%
}
.dm-rn[hidden]{display:none!important}
[data-theme="dark"] .dm-rn{
  --rn-box:#0e1522;--rn-acc:#7b7cf7;--rn-acc-rgb:123,124,247;
  --rn-ok:#34d399;--rn-warn:#fb923c;--rn-bad:#fb7185;--rn-run:#38bdf8;
  --rn-line:rgba(255,255,255,.07)
}
.dm-rn-testa{display:flex;align-items:center;gap:12px;min-width:0}
.dm-rn-luna{flex:0 0 46px;width:46px;height:46px;border-radius:14px;display:grid;place-items:center;
  color:#f5c542;background:rgba(var(--rn-acc-rgb),.14);box-shadow:inset 0 0 0 1px rgba(var(--rn-acc-rgb),.25)}
.dm-rn-titoli{flex:1;min-width:0;display:grid;gap:2px}
.dm-rn-titolo{margin:0!important;font-family:'Oswald',sans-serif!important;font-size:22px!important;font-weight:600!important;
  letter-spacing:-.01em!important;line-height:1.1!important;text-transform:none!important;color:var(--rn-text)!important}
.dm-rn-sotto{font-size:12px;font-weight:700;color:var(--rn-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-rn-int{flex:0 0 auto;position:relative;width:54px;height:32px;border-radius:999px;border:0;padding:0;cursor:pointer;
  background:color-mix(in srgb,var(--rn-text) 18%,transparent);transition:background .25s ease;-webkit-tap-highlight-color:transparent}
.dm-rn-int span{position:absolute;top:3px;left:3px;width:26px;height:26px;border-radius:50%;background:#fff;
  box-shadow:0 2px 6px rgba(0,0,0,.25);transition:transform .25s cubic-bezier(.34,1.4,.5,1)}
.dm-rn-int[aria-checked="true"]{background:linear-gradient(90deg,var(--rn-acc),color-mix(in srgb,var(--rn-acc) 70%,#a5b4fc))}
.dm-rn-int[aria-checked="true"] span{transform:translateX(22px)}
.dm-rn-int:focus-visible,.dm-rn-seg-btn:focus-visible,.dm-rn-giorno:focus-visible,.dm-rn-imposta:focus-visible{outline:2px solid var(--rn-acc);outline-offset:2px}
.dm-rn-ore{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;margin-top:16px}
.dm-rn-ora{display:grid;gap:4px;padding:11px 14px;border-radius:16px;background:var(--rn-box);
  box-shadow:inset 0 0 0 1px var(--rn-line);min-width:0;cursor:pointer}
.dm-rn-ora small{font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--rn-dim)}
.dm-rn .dm-rn-ora input{all:unset;box-sizing:border-box!important;display:block!important;width:100%!important;min-width:0!important;
  height:auto!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;
  background:transparent!important;box-shadow:none!important;outline:none!important;
  font-family:'Oswald',sans-serif!important;font-size:30px!important;font-weight:500!important;line-height:1.15!important;
  letter-spacing:.01em!important;color:var(--rn-text)!important;cursor:text;font-variant-numeric:tabular-nums}
.dm-rn .dm-rn-ora input::placeholder{color:var(--rn-dim);opacity:.6}
.dm-rn-ora:focus-within{box-shadow:inset 0 0 0 2px var(--rn-acc)}
.dm-rn-freccia{color:var(--rn-dim);font-size:18px}
.dm-rn-barra{margin:14px 0 4px}
.dm-rn-nastro{position:relative;height:30px;border-radius:9px;background:var(--rn-box);overflow:hidden;
  box-shadow:inset 0 0 0 1px var(--rn-line)}
.dm-rn-nastro i{position:absolute;top:0;bottom:0;background:linear-gradient(90deg,rgba(var(--rn-acc-rgb),.75),rgba(var(--rn-acc-rgb),.5))}
.dm-rn-nastro b{position:absolute;top:2px;bottom:2px;width:3px;margin-left:-1.5px;border-radius:2px;background:var(--rn-text);
  box-shadow:0 0 0 2px var(--rn-bg)}
.dm-rn[data-attiva="false"] .dm-rn-nastro i{background:color-mix(in srgb,var(--rn-text) 22%,transparent)}
.dm-rn-tacche{display:flex;justify-content:space-between;margin-top:4px;font-size:10px;font-weight:700;color:var(--rn-dim)}
.dm-rn-riga{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 0;
  border-top:1px solid var(--rn-line);min-width:0;flex-wrap:wrap}
.dm-rn-riga-alta{display:grid;gap:8px;justify-content:stretch}
.dm-rn-coppia{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap}
.dm-rn-nome{font-size:13.5px;font-weight:700;color:var(--rn-text)}
.dm-rn-valore{font-size:13.5px;font-weight:700;color:var(--rn-text);text-align:right}
.dm-rn-grande{font-size:16px}
.dm-rn-nota{font-size:11.5px;font-weight:600;line-height:1.4;color:var(--rn-dim)}
.dm-rn-seg{display:inline-flex;gap:2px;padding:3px;border-radius:12px;background:var(--rn-box);box-shadow:inset 0 0 0 1px var(--rn-line);
  flex-wrap:wrap;max-width:100%}
.dm-rn-seg-btn{border:0;background:transparent;color:var(--rn-dim);font:700 13px/1.2 inherit;padding:8px 12px;border-radius:9px;cursor:pointer;
  -webkit-tap-highlight-color:transparent;min-height:34px}
.dm-rn-seg-btn[aria-pressed="true"]{background:var(--rn-acc);color:var(--rn-acc-text);box-shadow:0 6px 14px -8px rgba(var(--rn-acc-rgb),.9)}
.dm-rn-seg-btn[hidden]{display:none}
.dm-rn-giorni{display:flex;gap:6px;flex-wrap:wrap}
.dm-rn-giorno{width:32px;height:32px;border-radius:50%;border:0;cursor:pointer;font:800 12px/1 inherit;
  background:var(--rn-box);color:var(--rn-dim);box-shadow:inset 0 0 0 1px var(--rn-line);-webkit-tap-highlight-color:transparent}
.dm-rn-giorno[aria-pressed="true"]{background:var(--rn-acc);color:var(--rn-acc-text);box-shadow:none}
.dm-rn-cursore{-webkit-appearance:none;appearance:none;width:100%;height:24px;background:transparent;margin:0;cursor:pointer;--rn-pieno:100%}
.dm-rn-cursore::-webkit-slider-runnable-track{height:6px;border-radius:999px;
  background:linear-gradient(90deg,var(--rn-acc) 0 var(--rn-pieno),color-mix(in srgb,var(--rn-text) 14%,transparent) var(--rn-pieno) 100%)}
.dm-rn-cursore::-moz-range-track{height:6px;border-radius:999px;background:color-mix(in srgb,var(--rn-text) 14%,transparent)}
.dm-rn-cursore::-moz-range-progress{height:6px;border-radius:999px;background:var(--rn-acc)}
.dm-rn-cursore::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;margin-top:-8px;border-radius:50%;background:#fff;
  box-shadow:0 2px 8px rgba(0,0,0,.3),0 0 0 1px rgba(0,0,0,.06)}
.dm-rn-cursore::-moz-range-thumb{width:22px;height:22px;border:0;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.3)}
.dm-rn-cursore:focus-visible{outline:2px solid var(--rn-acc);outline-offset:4px;border-radius:6px}
.dm-rn-prezzo-box{display:flex;align-items:center;gap:10px;justify-content:space-between;padding:11px 13px;border-radius:13px;
  background:var(--rn-box);box-shadow:inset 0 0 0 1px var(--rn-tono,var(--rn-line))}
.dm-rn-prezzo-box[data-tono="ok"]{--rn-tono:color-mix(in srgb,var(--rn-ok) 55%,transparent)}
.dm-rn-prezzo-box[data-tono="unica"]{--rn-tono:color-mix(in srgb,var(--rn-warn) 55%,transparent)}
.dm-rn-prezzo-box[data-tono="manca"]{--rn-tono:color-mix(in srgb,var(--rn-bad) 55%,transparent)}
.dm-rn-prezzo-box>div{display:grid;gap:2px;min-width:0}
.dm-rn-prezzo-box b{font-size:14px;font-weight:800}
.dm-rn-prezzo-box small{font-size:11.5px;font-weight:600;color:var(--rn-dim)}
.dm-rn-prezzo-box>span{font-weight:900;color:var(--rn-dim)}
.dm-rn-imposta{flex:0 0 auto;border:0;border-radius:9px;padding:8px 13px;font:800 12.5px/1 inherit;cursor:pointer;
  background:var(--rn-acc);color:var(--rn-acc-text);min-height:34px}
.dm-rn-stato{display:flex;align-items:flex-start;gap:12px;margin-top:12px;padding:13px 15px;border-radius:15px;
  background:color-mix(in srgb,var(--rn-tinta,var(--rn-dim)) 10%,var(--rn-box));
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--rn-tinta,var(--rn-dim)) 40%,transparent)}
.dm-rn-stato>i{flex:0 0 10px;width:10px;height:10px;margin-top:5px;border-radius:50%;background:var(--rn-tinta,var(--rn-dim));
  box-shadow:0 0 0 4px color-mix(in srgb,var(--rn-tinta,var(--rn-dim)) 22%,transparent)}
.dm-rn-stato>div{display:grid;gap:3px;min-width:0}
.dm-rn-stato b{font-size:14.5px;font-weight:800;line-height:1.3}
.dm-rn-stato small{font-size:12px;font-weight:600;line-height:1.4;color:var(--rn-dim)}
.dm-rn-stato[data-tono="carica"]{--rn-tinta:var(--rn-run)}
.dm-rn-stato[data-tono="finita"]{--rn-tinta:var(--rn-ok)}
.dm-rn-stato[data-tono="attesa"]{--rn-tinta:var(--rn-acc)}
.dm-rn-stato[data-tono="carica"]>i{animation:dmRnPulsa 2s ease-in-out infinite}
@keyframes dmRnPulsa{50%{box-shadow:0 0 0 7px color-mix(in srgb,var(--rn-tinta) 10%,transparent)}}
/* Da schermo largo la carta si divide in due colonne: a sinistra la fascia,
   a destra i giorni, la soglia, il prezzo e il racconto. Tutta in fila su un
   monitor diventava una striscia di righe lunghe un metro con le parole ai
   due capi. Si guarda la larghezza della carta, non quella dello schermo. */
.dm-rn{container-type:inline-size}
@container (min-width:780px){
  .dm-rn-corpo{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:34px;align-items:start}
  .dm-rn-prima{border-top:0;margin-top:4px}
}
@media(max-width:420px){
  .dm-rn{padding:16px 14px 14px}
  .dm-rn-ora{padding:9px 11px}
  .dm-rn-ora input{font-size:26px}
  .dm-rn-giorno{width:30px;height:30px}
  .dm-rn-riga:not(.dm-rn-riga-alta){gap:8px}
}
@media (prefers-reduced-motion:reduce){
  .dm-rn *{animation:none!important;transition:none!important}
}
/* La riga della notte sul widget Auto della Home: una pastiglia piccola. */
[data-dm-widget="ev"] .dm-tile-sotto:not([hidden]){
  justify-self:start;align-self:flex-start;max-width:100%;margin-top:3px;padding:2px 8px;border-radius:999px;opacity:1;
  color:#4f46e5;background:rgba(99,102,241,.12);font-size:9.5px;letter-spacing:.02em
}
[data-theme="dark"] [data-dm-widget="ev"] .dm-tile-sotto:not([hidden]){color:#c7d2fe;background:rgba(129,140,248,.2)}
.dm-f-evcc-notte{display:inline-flex;align-items:center;max-width:100%;margin-top:10px;padding:6px 12px;border-radius:999px;
  font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;line-height:1.3;
  color:#4338ca;background:rgba(99,102,241,.12)}
[data-theme="dark"] .dm-f-evcc-notte{color:#c7d2fe;background:rgba(129,140,248,.2)}
`;
}
