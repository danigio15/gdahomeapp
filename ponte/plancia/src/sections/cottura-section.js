/* La cottura, dentro gli Elettrodomestici (#71).
 *
 * «Mi piacerebbe pilotare la mia friggitrice ad aria della Philips.» La
 * proposta scelta non e' una sezione nuova nella barra: e' una voce «Cottura»
 * accanto a Panoramica, dentro la pagina che gli apparecchi ce li ha gia'. Una
 * friggitrice e' un elettrodomestico, e chi la cerca la cerca li'.
 *
 * La pagina dice, dall'alto:
 *  - «In questo momento»: cosa sta cuocendo e quando e' pronto — «Pronta fra
 *    7 min», e sotto «Friggitrice · Patatine · 180 °C · alle 14:41» — e come
 *    stanno gli altri, «Forno e Piano cottura spenti»;
 *  - la scheda grande di chi cuoce a tempo: l'anello che si svuota (lo stesso
 *    del cambio d'acqua dell'Acquario), il programma, il cassetto, l'ora in cui
 *    e' pronta e quella in cui e' partita, la temperatura col − e il +, e i
 *    tasti Pausa (Riprendi, da ferma), +1 min e Stop;
 *  - «Gli altri in cucina»: il forno, il piano cottura, la cappa, una riga
 *    ciascuno col suo disegno e il suo stato.
 *
 * I tasti ci sono solo se ci sono davvero: un comando si disegna quando e'
 * scritto nella scheda dell'apparecchio e la sua entita' risponde, come i
 * tasti del telecomando della TV. Cosa sia un comando, in che fase ha senso e
 * che servizio chiama lo dice il nucleo, `core/la-cottura.js`; qui si
 * scelgono le parole e si disegna.
 *
 * Quando la cottura e' in corso, o appena finita, in Home c'e' la sua
 * tessera — «Pronta fra 7 min · 180 °C · Patatine», poi «Pronta» in verde — e
 * toccarla porta qui. La fine accende anche la finestra della tessera, con la
 * stessa regola degli avvisi personalizzati: una volta, quando succede, e
 * mai sopra un'altra finestra aperta.
 */
import { applianceArtwork } from "../core/appliance-artwork.js";
import { createApplianceViewModel } from "../core/appliance-view-model.js";
import { formatPowerLabel } from "../core/appliance-card-view-model.js";
import { getDeviceDisplayName } from "../core/device-model.js";
import {
  laCucina,
  letturaDellaCottura,
  minutiCheMancano,
  minutiESecondi,
  orologio,
  tipoDellaCucina,
} from "../core/la-cottura.js";
import { segnoHtml } from "../core/segni-del-catalogo.js";
import {
  activeLocale,
  allStates,
  chiamaServizio,
  clean,
  doc,
  esc,
  installStyle,
  locale,
  readJson,
  root,
  section,
  siComanda,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_COTTURA__";
const state = (root[KEY] ||= {
  installed: false,
  /* La memoria di ogni cottura: serve a dire «pronta» a una friggitrice che,
   * finito, torna in standby senza dirlo. Vive quanto la pagina. */
  memorie: new Map(),
  orologio: 0,
  premuti: new Map(),
});

/** L'evento con cui chi sta fuori chiede di aprire la Cottura. */
export const EVENTO_COTTURA = "dashboardmodern:cottura-requested";

/** La chiave della tessera in Home. */
export const TESSERA_COTTURA = "cottura";

/* ── i dati ───────────────────────────────────────────────────────────── */

function apparecchi() {
  const elenco = section("appliances", readJson("cd_appliances", []));
  return Array.isArray(elenco) ? elenco : [];
}

function stanze() {
  const elenco = section("rooms", readJson("cd_stanze", []));
  return Array.isArray(elenco) ? elenco : [];
}

/** Se in casa c'e' almeno un apparecchio della cucina. */
export function ceLaCucina() {
  return apparecchi().some(
    (apparecchio) => apparecchio?.enabled !== false && tipoDellaCucina(apparecchio),
  );
}

/**
 * La cucina adesso: una voce per apparecchio, con la sua lettura, e chi va
 * nella scheda grande. La memoria delle fini si aggiorna qui, ed e' l'unico
 * posto: la pagina e la tessera leggono la stessa cucina.
 */
export function vistaDellaCucina(states = allStates(), adesso = Date.now()) {
  const luoghi = stanze();
  const voci = apparecchi()
    .map((apparecchio, indice) => ({ apparecchio, indice }))
    .filter(({ apparecchio }) => apparecchio?.enabled !== false && tipoDellaCucina(apparecchio))
    .map(({ apparecchio, indice }) => {
      const chiave = clean(apparecchio.id) || `cucina-${indice}`;
      const modello = createApplianceViewModel(apparecchio, states, [], activeLocale(), {
        now: adesso,
      });
      const lettura = letturaDellaCottura(apparecchio, states, {
        adesso,
        modo: modello.mode,
        memoria: state.memorie.get(chiave) || null,
      });
      state.memorie.set(chiave, lettura.memoria);
      const stanza = luoghi.find(
        (voce) => clean(voce?.id) === clean(apparecchio.room_id) && clean(voce?.name),
      );
      return {
        chiave,
        indice,
        apparecchio,
        lettura,
        nome: getDeviceDisplayName(apparecchio, states, activeLocale()),
        stanza: clean(stanza?.name),
        watt: modello.watts,
      };
    });
  return { voci, ...laCucina(voci), adesso };
}

/* ── le parole ────────────────────────────────────────────────────────── */

const suo = (lettura, femminile, maschile) => (lettura?.femminile ? femminile : maschile);

function parolaDellaFase(lettura) {
  if (lettura.fase === "cottura")
    return lettura.aTempo
      ? t("In cottura", "Cooking")
      : suo(lettura, t("Accesa", "On"), t("Acceso", "On"));
  if (lettura.fase === "preriscaldamento") return t("Preriscaldamento", "Preheating");
  if (lettura.fase === "pausa") return t("In pausa", "Paused");
  if (lettura.fase === "attesa") return t("Da avviare", "Ready to start");
  if (lettura.fase === "pronta") return suo(lettura, t("Pronta", "Ready"), t("Pronto", "Ready"));
  return suo(lettura, t("Spenta", "Off"), t("Spento", "Off"));
}

/** «7 min», «1 h 20 min», «meno di un minuto». */
export function durataInParole(secondi) {
  if (secondi == null) return "";
  if (secondi < 60) return t("meno di un minuto", "under a minute");
  const minuti = minutiCheMancano(secondi);
  if (minuti < 60) return t(`${minuti} min`, `${minuti} min`);
  const ore = Math.floor(minuti / 60);
  const resto = minuti % 60;
  return resto ? t(`${ore} h ${resto} min`, `${ore} h ${resto} min`) : t(`${ore} h`, `${ore} h`);
}

function prontaFra(lettura) {
  const durata = durataInParole(lettura.rimasti);
  return suo(
    lettura,
    t(`Pronta fra ${durata}`, `Ready in ${durata}`),
    t(`Pronto fra ${durata}`, `Ready in ${durata}`),
  );
}

function gradiInParole(gradi) {
  return gradi ? `${Math.round(gradi.valore)} ${gradi.unita}` : "";
}

function elenco(nomi) {
  try {
    return new Intl.ListFormat(locale(), { type: "conjunction" }).format(nomi);
  } catch (_errore) {
    return nomi.join(", ");
  }
}

/* Come stanno gli altri, in una riga: quelli accesi per nome, e se sono
 * tutti spenti si dice anche quello — «Forno e Piano cottura spenti» — che e'
 * la risposta a «ho lasciato acceso qualcosa?». */
function gliAltriInParole(altri) {
  if (!altri.length) return "";
  const accesi = altri.filter((voce) => voce.lettura.fase !== "spenta");
  if (accesi.length) {
    const nomi = elenco(accesi.map((voce) => voce.nome));
    return t(`In funzione anche: ${nomi}`, `Also on: ${nomi}`);
  }
  const nomi = elenco(altri.map((voce) => voce.nome));
  if (altri.length > 1) return t(`${nomi} spenti`, `${nomi} off`);
  return suo(
    altri[0].lettura,
    t(`${nomi} spenta`, `${nomi} off`),
    t(`${nomi} spento`, `${nomi} off`),
  );
}

/* Il quando della riga sotto la risposta grande. */
function quandoInParole(lettura) {
  if ((lettura.fase === "cottura" || lettura.fase === "preriscaldamento") && lettura.prontaAlle) {
    const ora = orologio(lettura.prontaAlle);
    return t(`alle ${ora}`, `at ${ora}`);
  }
  if (lettura.fase === "pausa" && lettura.rimasti != null) {
    const mancano = minutiESecondi(lettura.rimasti);
    return t(`mancano ${mancano}`, `${mancano} left`);
  }
  if (lettura.fase === "pronta" && lettura.finitaAlle) {
    const ora = orologio(lettura.finitaAlle);
    return t(`fine alle ${ora}`, `done at ${ora}`);
  }
  return "";
}

function rigaDiChiCuoce(voce) {
  const { lettura } = voce;
  return [voce.nome, lettura.programma, gradiInParole(lettura.gradi), quandoInParole(lettura)]
    .filter(Boolean)
    .join(" · ");
}

/* ── la risposta grande ───────────────────────────────────────────────── */

function testaMarkup(vista) {
  const prima = vista.prima;
  const lettura = prima?.lettura;
  const altri = vista.voci.filter((voce) => voce !== prima);
  let grande = t("Niente sul fuoco", "Nothing cooking");
  if (lettura) {
    grande =
      (lettura.fase === "cottura" || lettura.fase === "preriscaldamento") && lettura.rimasti != null
        ? prontaFra(lettura)
        : parolaDellaFase(lettura);
  }
  const nomi = prima ? rigaDiChiCuoce(prima) : "";
  const sotto = gliAltriInParole(prima ? altri : vista.voci);
  return `<div class="dm-cot-testa" data-fase="${esc(lettura?.fase || "spenta")}" data-dm-cot-testa>
    <small>${esc(t("In questo momento", "Right now"))}</small>
    <strong data-dm-cot-vivo="grande">${esc(grande)}</strong>
    ${nomi ? `<span class="dm-cot-nomi" data-dm-cot-vivo="nomi">${esc(nomi)}</span>` : ""}
    ${sotto ? `<span class="dm-cot-sotto">${esc(sotto)}</span>` : ""}
  </div>`;
}

/* ── la scheda grande ─────────────────────────────────────────────────── */

const MENO = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 12h12"/></svg>`;
const PIU = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>`;

function anelloMarkup(lettura) {
  if (lettura.fase === "pronta")
    return `<div class="dm-ring dm-cot-ring" data-fase="pronta" style="--pct:100">
      <span class="dm-ring-core"><b class="dm-cot-fatto">${segnoHtml("check", { misura: 30 })}</b><i>${esc(parolaDellaFase(lettura))}</i></span>
    </div>`;
  if (lettura.rimasti == null) return "";
  const pieno = lettura.frazione == null ? 100 : Math.round(lettura.frazione * 1000) / 10;
  const sotto =
    lettura.totali != null
      ? (() => {
          const minuti = Math.round(lettura.totali / 60);
          return t(`di ${minuti} min`, `of ${minuti} min`);
        })()
      : t("rimangono", "left");
  return `<div class="dm-ring dm-cot-ring" data-fase="${esc(lettura.fase)}" style="--pct:${pieno}" data-dm-cot-vivo="anello" role="timer" aria-label="${esc(minutiESecondi(lettura.rimasti))}">
    <span class="dm-ring-core"><b data-dm-cot-vivo="resto">${esc(minutiESecondi(lettura.rimasti))}</b><i>${esc(sotto)}</i></span>
  </div>`;
}

function notaMarkup(voce) {
  const { lettura } = voce;
  let nota = "";
  if ((lettura.fase === "cottura" || lettura.fase === "preriscaldamento") && lettura.prontaAlle) {
    const ora = orologio(lettura.prontaAlle);
    const pronta = suo(
      lettura,
      t(`Pronta alle ${ora}`, `Ready at ${ora}`),
      t(`Pronto alle ${ora}`, `Ready at ${ora}`),
    );
    let avviata = "";
    if (lettura.avviataAlle) {
      const partita = orologio(lettura.avviataAlle);
      avviata = suo(
        lettura,
        t(`avviata alle ${partita}`, `started at ${partita}`),
        t(`avviato alle ${partita}`, `started at ${partita}`),
      );
    }
    nota = [pronta, avviata].filter(Boolean).join(" · ");
  } else if (lettura.fase === "pausa")
    nota = t("Il tempo è fermo finché non riprende", "The timer is stopped until it resumes");
  else if (lettura.fase === "attesa")
    nota = t(
      "Tempo e gradi scelti: manca solo l'avvio",
      "Time and temperature set: it only needs starting",
    );
  else if (lettura.fase === "pronta") {
    const ora = lettura.finitaAlle ? orologio(lettura.finitaAlle) : "";
    const apri =
      lettura.tipo === "air-fryer" && lettura.cassetto === false
        ? t("apri il cassetto", "open the drawer")
        : "";
    nota = [ora ? t(`Fine alle ${ora}`, `Done at ${ora}`) : "", apri].filter(Boolean).join(" · ");
  } else
    nota = t(
      "I comandi compaiono quando parte una cottura",
      "The controls show up when cooking starts",
    );
  return nota ? `<p class="dm-pool-note dm-cot-nota" data-dm-cot-vivo="nota">${esc(nota)}</p>` : "";
}

function pastiglieMarkup(lettura) {
  const pastiglie = [];
  if (lettura.programma)
    pastiglie.push(
      `<span class="dm-pool-badge dm-cot-chip" data-dm-cot-programma>${esc(lettura.programma)}</span>`,
    );
  if (lettura.haCassetto && lettura.cassetto !== null) {
    const cassetto = lettura.tipo === "air-fryer";
    const parola = lettura.cassetto
      ? cassetto
        ? t("Cassetto aperto", "Drawer open")
        : t("Porta aperta", "Door open")
      : cassetto
        ? t("Cassetto chiuso", "Drawer closed")
        : t("Porta chiusa", "Door closed");
    pastiglie.push(
      `<span class="dm-pool-badge dm-cot-chip" data-aperto="${lettura.cassetto}" data-dm-cot-cassetto>${esc(parola)}</span>`,
    );
  }
  return pastiglie.length ? `<div class="dm-cot-chips">${pastiglie.join("")}</div>` : "";
}

function tastoMarkup(voce, chiave, classe, segno, parola, etichetta = parola) {
  if (!voce.lettura.comandi[chiave]) return "";
  return `<button type="button" class="${classe}" data-dm-cot-comando="${esc(chiave)}" data-dm-cot-id="${esc(voce.chiave)}" aria-label="${esc(etichetta)}">${segno}${parola ? ` <span>${esc(parola)}</span>` : ""}</button>`;
}

function temperaturaMarkup(voce) {
  const { lettura } = voce;
  if (!lettura.gradi) return "";
  const meno = tastoMarkup(voce, "meno_caldo", "dm-cl-step", MENO, "", t("Meno caldo", "Cooler"));
  const piu = tastoMarkup(voce, "piu_caldo", "dm-cl-step", PIU, "", t("Più caldo", "Hotter"));
  const dentro = lettura.dentro
    ? (() => {
        const gradi = gradiInParole(lettura.dentro);
        return `<small class="dm-cot-dentro">${esc(t(`dentro ${gradi}`, `inside ${gradi}`))}</small>`;
      })()
    : "";
  return `<div class="dm-cot-temp">
    <span class="dm-cot-temp-l">${segnoHtml("thermometer")} ${esc(t("Temperatura", "Temperature"))}${dentro}</span>
    <div class="dm-cot-step">${meno}<b data-dm-cot-gradi>${esc(String(Math.round(lettura.gradi.valore)))}<i>${esc(lettura.gradi.unita)}</i></b>${piu}</div>
  </div>`;
}

function azioniMarkup(voce) {
  const tasti = [
    tastoMarkup(voce, "pausa", "dm-btn dm-ghost", segnoHtml("pause"), t("Pausa", "Pause")),
    tastoMarkup(voce, "riprendi", "dm-btn dm-ghost", segnoHtml("play"), t("Riprendi", "Resume")),
    tastoMarkup(
      voce,
      "piu_un_minuto",
      "dm-btn dm-ghost",
      segnoHtml("timer"),
      t("+1 min", "+1 min"),
    ),
    tastoMarkup(voce, "stop", "dm-btn dm-warn", segnoHtml("stop"), t("Stop", "Stop")),
  ].filter(Boolean);
  if (!tasti.length) return "";
  return `<div class="dm-pool-actions dm-cot-azioni" style="--dm-cot-tasti:${tasti.length}">${tasti.join("")}</div>`;
}

function sottotitolo(voce) {
  const marca =
    clean(voce.apparecchio.integration_name) ||
    [voce.apparecchio.device_manufacturer, voce.apparecchio.device_model]
      .map(clean)
      .filter(Boolean)
      .join(" ");
  return [marca, voce.stanza].filter(Boolean).join(" · ");
}

function schedaMarkup(voce) {
  const { lettura } = voce;
  const sotto = sottotitolo(voce);
  const anello = anelloMarkup(lettura);
  return `<article class="dm-pool-card dm-cot-card" data-fase="${esc(lettura.fase)}" data-dm-cot-scheda="${esc(voce.chiave)}">
    <div class="dm-pool-card-head">
      <span class="dm-pool-card-title">${segnoHtml(lettura.tipo || "air-fryer")}<span class="dm-cot-tit"><span data-dm-no-i18n>${esc(voce.nome)}</span>${sotto ? `<small data-dm-no-i18n>${esc(sotto)}</small>` : ""}</span></span>
      <span class="dm-pool-badge dm-cot-fase" data-fase="${esc(lettura.fase)}">${esc(parolaDellaFase(lettura))}</span>
    </div>
    <div class="dm-cot-corpo${anello ? "" : " dm-cot-senza-anello"}">
      ${anello}
      <div class="dm-cot-destra">
        <div class="dm-cot-art">${applianceArtwork(lettura.tipo, anello ? 64 : 84)}</div>
        ${pastiglieMarkup(lettura)}
        ${notaMarkup(voce)}
      </div>
    </div>
    ${temperaturaMarkup(voce)}
    ${azioniMarkup(voce)}
  </article>`;
}

/* ── gli altri in cucina ──────────────────────────────────────────────── */

function rigaDegliAltri(voce) {
  const { lettura } = voce;
  const accanto = [];
  const misura = lettura.dentro || (lettura.fase === "spenta" ? null : lettura.gradi) || null;
  if (lettura.fase === "spenta" && lettura.gradi) {
    const gradi = gradiInParole(lettura.gradi);
    accanto.push(t(`dentro ${gradi}`, `inside ${gradi}`));
  } else if (misura) accanto.push(gradiInParole(misura));
  if (lettura.programma) accanto.push(lettura.programma);
  if (lettura.fase !== "spenta" && voce.watt != null && voce.watt >= 1)
    accanto.push(formatPowerLabel(voce.watt));
  if (voce.stanza) accanto.push(voce.stanza);
  return `<div class="dm-cot-altro" data-fase="${esc(lettura.fase)}" data-dm-cot-altro="${esc(voce.chiave)}">
    <span class="dm-cot-altro-ic" aria-hidden="true">${applianceArtwork(lettura.tipo, 38)}</span>
    <span class="dm-cot-altro-testo"><strong data-dm-no-i18n>${esc(voce.nome)}</strong>${accanto.length ? `<small>${esc(accanto.join(" · "))}</small>` : ""}</span>
    <b class="dm-cot-altro-stato">${esc(parolaDellaFase(lettura))}</b>
  </div>`;
}

function altriMarkup(altri) {
  if (!altri.length) return "";
  const accesi = altri.filter((voce) => voce.lettura.fase !== "spenta").length;
  const pastiglia = accesi
    ? t(`${accesi} in funzione`, `${accesi} on`)
    : altri.length > 1
      ? t("Spenti", "Off")
      : parolaDellaFase(altri[0].lettura);
  return `<article class="dm-pool-card dm-cot-altri">
    <div class="dm-pool-card-head">
      <span class="dm-pool-card-title">${segnoHtml("flame")}${esc(t("Gli altri in cucina", "The rest of the kitchen"))}</span>
      <span class="dm-pool-badge"${accesi ? ' data-on="true"' : ""}>${esc(pastiglia)}</span>
    </div>
    ${altri.map(rigaDegliAltri).join("")}
  </article>`;
}

/** La pagina della Cottura, per chi la mette dentro gli Elettrodomestici. */
export function paginaDellaCottura(vista = vistaDellaCucina()) {
  if (!vista.voci.length)
    return `<div class="dm-cot-vuoto"><strong>${esc(t("Niente in cucina", "Nothing in the kitchen"))}</strong><span>${esc(
      t(
        "La cottura compare quando fra gli elettrodomestici c'è una friggitrice, un forno, un microonde, un piano cottura o una cappa.",
        "Cooking shows up once the appliances include an air fryer, an oven, a microwave, a cooktop or a hood.",
      ),
    )}</span></div>`;
  return `${testaMarkup(vista)}
    <div class="dm-pool-cards dm-cot-schede">${vista.grandi.map(schedaMarkup).join("")}${altriMarkup(vista.altri)}</div>`;
}

/* ── lo scrivere senza strappi ────────────────────────────────────────── */

/* Il conto alla rovescia cambia ogni secondo, e riscrivere la pagina ogni
 * secondo vuol dire rifare i tasti ogni secondo: un dito che preme proprio in
 * quel momento preme un tasto che non c'e' piu'. Quindi si confronta la forma
 * senza le parti vive — l'anello, i minuti, la nota, la risposta grande — e se
 * la forma e' la stessa si travasano solo quelle. */
const VIVO = /<([a-z]+)([^>]*?)data-dm-cot-vivo="([a-z]+)"([^>]*)>[\s\S]*?<\/\1>/g;
const forma = (markup) =>
  String(markup).replace(VIVO, (_tutto, tag, _prima, nome) => `<${tag} vivo="${nome}"/>`);

export function scriviLaCottura(dove, markup) {
  if (!dove) return false;
  const sagoma = forma(markup);
  if (dove.__dmCotMarkup === markup) return false;
  if (dove.__dmCotForma === sagoma && dove.firstElementChild) {
    const nuovo = doc.createElement("div");
    nuovo.innerHTML = markup;
    const vecchi = dove.querySelectorAll("[data-dm-cot-vivo]");
    const freschi = nuovo.querySelectorAll("[data-dm-cot-vivo]");
    if (vecchi.length === freschi.length) {
      freschi.forEach((fresco, posto) => {
        const vecchio = vecchi[posto];
        for (const nome of ["style", "aria-label", "data-fase"]) {
          const valore = fresco.getAttribute(nome);
          if (valore !== null && vecchio.getAttribute(nome) !== valore)
            vecchio.setAttribute(nome, valore);
        }
        if (!fresco.querySelector("[data-dm-cot-vivo]") && vecchio.innerHTML !== fresco.innerHTML)
          vecchio.innerHTML = fresco.innerHTML;
      });
      dove.__dmCotMarkup = markup;
      return true;
    }
  }
  dove.innerHTML = markup;
  dove.__dmCotMarkup = markup;
  dove.__dmCotForma = sagoma;
  return true;
}

/* ── i tasti ──────────────────────────────────────────────────────────── */

function chiama(azione) {
  /* La strada della scheda per prima, come la pausa della lettiera degli
   * Animali: e' quella che la card e il ponte conoscono. */
  if (typeof root.dmCallHaService === "function") {
    try {
      root
        .dmCallHaService(azione.dominio, azione.servizio, azione.dati)
        ?.catch?.((errore) => root.console?.warn?.("[DashboardModern] cottura", errore));
    } catch (_errore) {}
    return;
  }
  chiamaServizio({ domain: azione.dominio, service: azione.servizio, data: azione.dati });
}

function premi(evento) {
  const tasto = evento.target?.closest?.("[data-dm-cot-comando]");
  if (!tasto || tasto.disabled) return;
  evento.preventDefault();
  evento.stopPropagation();
  const vista = vistaDellaCucina();
  const voce = vista.voci.find((uno) => uno.chiave === clean(tasto.dataset.dmCotId));
  const azione = voce?.lettura.comandi[clean(tasto.dataset.dmCotComando)];
  if (!azione) return;
  /* Un comando su un'entita' protetta non parte, come ovunque nella plancia. */
  const entita = clean(azione.dati?.entity_id);
  if (entita && azione.dominio === entita.split(".")[0] && !siComanda(entita)) return;
  tasto.disabled = true;
  root.setTimeout?.(() => {
    tasto.disabled = false;
  }, 1200);
  chiama(azione);
}

/* ── la tessera in Home ───────────────────────────────────────────────── */

/**
 * La tessera della cottura, o `null` quando non c'e' niente da dire.
 *
 * C'e' finche' qualcosa cuoce, e' in pausa o aspetta l'avvio, e per un po'
 * dopo la fine; spenta, la cucina in Home non occupa posto.
 */
export function tesseraDellaCottura(vista = vistaDellaCucina()) {
  const voce = vista.prima;
  if (!voce) return null;
  const { lettura } = voce;
  if (lettura.fase === "pronta" && !lettura.fresca) return null;
  const pronta = lettura.fase === "pronta";
  const conta =
    (lettura.fase === "cottura" || lettura.fase === "preriscaldamento") && lettura.rimasti != null;
  const gradi = gradiInParole(lettura.gradi);
  let valore = parolaDellaFase(lettura);
  if (conta) {
    const minuti = minutiCheMancano(lettura.rimasti);
    valore =
      minuti < 60
        ? t(`${minuti} min`, `${minuti} min`)
        : minutiESecondi(lettura.rimasti).replace(/:\d\d$/, "");
  }
  const quando = quandoInParole(lettura);
  const racconto = conta
    ? [prontaFra(lettura), gradi, lettura.programma]
    : pronta
      ? [lettura.programma, quando]
      : [parolaDellaFase(lettura), gradi, lettura.programma, quando];
  const righe = [];
  if (lettura.programma)
    righe.push({
      name: t("Programma", "Program"),
      glyph: segnoHtml(lettura.tipo || "air-fryer"),
      value: lettura.programma,
      tono: "quiete",
    });
  if (lettura.gradi)
    righe.push({
      name: t("Temperatura", "Temperature"),
      glyph: segnoHtml("thermometer"),
      value: gradi,
      tono: "quiete",
    });
  if (lettura.rimasti != null && !pronta)
    righe.push({
      name: t("Rimangono", "Remaining"),
      glyph: segnoHtml("timer"),
      value: minutiESecondi(lettura.rimasti),
      tono: "quiete",
    });
  return {
    key: TESSERA_COTTURA,
    accent: pronta ? "#16a34a" : lettura.fase === "pausa" ? "#f59e0b" : "#ea580c",
    icon: "air-fryer",
    label: voce.nome,
    value: valore,
    caption: racconto.filter(Boolean).join(" · "),
    ring: pronta ? 100 : lettura.frazione == null ? null : Math.round((1 - lettura.frazione) * 100),
    attiva: true,
    alert: false,
    /* La fine e' una notizia: la finestra della tessera si apre da sola, con
     * la regola degli avvisi personalizzati (vedi home-widgets). */
    avviso: pronta,
    rows: righe,
  };
}

/* ── il ticchettio ────────────────────────────────────────────────────── */

/* Mentre si guarda una cottura in corso, l'anello scende da solo: una volta al
 * secondo, e solo la Cottura, e solo se la si sta guardando. */
function ticchetta() {
  const dove = doc?.querySelector?.("#page-appliances-main.active [data-dm-cottura]");
  const visibile = Boolean(dove && dove.offsetParent !== null && doc.visibilityState !== "hidden");
  if (!visibile) return fermaLOrologio();
  const vista = vistaDellaCucina();
  scriviLaCottura(dove, paginaDellaCottura(vista));
  if (
    !vista.voci.some(
      (voce) => voce.lettura.fase === "cottura" || voce.lettura.fase === "preriscaldamento",
    )
  )
    fermaLOrologio();
}

function fermaLOrologio() {
  if (state.orologio) root.clearInterval?.(state.orologio);
  state.orologio = 0;
}

/** Fa partire il ticchettio, se c'e' da contare. */
export function avviaLOrologio() {
  if (state.orologio || typeof root.setInterval !== "function") return;
  state.orologio = root.setInterval(ticchetta, 1000);
}

/* ── il foglio ────────────────────────────────────────────────────────── */

function installStyles() {
  installStyle(
    "dm-cottura-section-style",
    `
    .dm-cot{display:grid;gap:14px;padding:0 0 24px;min-width:0}
    .dm-cot-vuoto{display:grid;gap:6px;padding:22px 18px;text-align:center;border:1px dashed var(--divider-color,#dbe4ee);border-radius:18px;background:var(--card-bg,#fff)}
    .dm-cot-vuoto strong{font-size:14px;font-weight:900}
    .dm-cot-vuoto span{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}

    /* La risposta grande, come quella dell'Acquario e dei Varchi. */
    .dm-cot-testa{display:grid;gap:4px;min-width:0;padding:20px 22px;border-radius:22px;border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff);box-shadow:var(--shadow-glass,0 8px 30px rgba(0,0,0,.06))}
    .dm-cot-testa small{font-size:10.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim,#64748b)}
    .dm-cot-testa strong{font-size:30px;font-weight:900;line-height:1.08;color:var(--text,#0f172a);overflow-wrap:anywhere}
    .dm-cot-testa[data-fase="cottura"] strong,.dm-cot-testa[data-fase="preriscaldamento"] strong{color:#c2410c}
    .dm-cot-testa[data-fase="pausa"] strong,.dm-cot-testa[data-fase="attesa"] strong{color:#b45309}
    .dm-cot-testa[data-fase="pronta"] strong{color:#15803d}
    .dm-cot-nomi{font-size:13px;font-weight:800;color:var(--text,#0f172a);overflow-wrap:anywhere}
    .dm-cot-sotto{font-size:12px;font-weight:700;color:var(--text-dim,#64748b);overflow-wrap:anywhere}

    .dm-cot-schede{align-items:start}
    .dm-cot-card,.dm-cot-altri{min-width:0}
    .dm-cot .dm-pool-card-title{min-width:0}
    .dm-cot .dm-pool-card-title>.dm-segno{flex:0 0 auto}
    .dm-cot-tit{display:grid;gap:1px;min-width:0}
    .dm-cot-tit>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dm-cot-tit small{font-size:10.5px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:var(--text-dim,#64748b);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dm-cot .dm-pool-badge{white-space:nowrap}
    .dm-cot-fase[data-fase="cottura"],.dm-cot-fase[data-fase="preriscaldamento"]{background:rgba(234,88,12,.14);color:#c2410c}
    .dm-cot-fase[data-fase="pausa"],.dm-cot-fase[data-fase="attesa"]{background:rgba(245,158,11,.16);color:#b45309}
    .dm-cot-fase[data-fase="pronta"]{background:rgba(22,163,74,.14);color:#15803d}

    /* L'anello del cambio d'acqua, arancio, che si svuota col tempo. */
    .dm-cot .dm-cot-ring{width:132px;height:132px;background:conic-gradient(from -90deg,#f97316 0 calc(var(--pct,0) * 1%),var(--surface-3,#e2e8f0) 0)}
    .dm-cot .dm-cot-ring[data-fase="pausa"],.dm-cot .dm-cot-ring[data-fase="attesa"]{background:conic-gradient(from -90deg,#f59e0b 0 calc(var(--pct,0) * 1%),var(--surface-3,#e2e8f0) 0)}
    .dm-cot .dm-cot-ring[data-fase="pronta"]{background:conic-gradient(from -90deg,#22c55e 0 calc(var(--pct,0) * 1%),var(--surface-3,#e2e8f0) 0)}
    .dm-cot .dm-cot-ring .dm-ring-core{width:104px;height:104px}
    .dm-cot .dm-cot-ring .dm-ring-core b{font-size:30px;font-variant-numeric:tabular-nums}
    .dm-cot-fatto{display:grid;place-items:center;color:#16a34a}
    .dm-cot .dm-cot-corpo{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:16px;min-width:0}
    .dm-cot .dm-cot-corpo.dm-cot-senza-anello{grid-template-columns:minmax(0,1fr)}
    .dm-cot-destra{display:grid;gap:8px;justify-items:start;min-width:0}
    .dm-cot-art .dm-appliance-art{display:block;line-height:0}
    .dm-cot-chips{display:flex;flex-wrap:wrap;gap:6px;min-width:0}
    .dm-cot-chip{max-width:100%;overflow:hidden;text-overflow:ellipsis}
    .dm-cot-chip[data-aperto="true"]{background:rgba(245,158,11,.16);color:#b45309}
    .dm-cot-nota{overflow-wrap:anywhere}

    .dm-cot-temp{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0;padding:10px 12px;border-radius:16px;background:var(--surface-2,#f1f5f9);
      --dm-cl-line:var(--card-border,#e6ecf3);--dm-cl-soft:var(--card-bg,#fff);--dm-cl-sunk:var(--surface-3,#eef2f8);--dm-cl-dim:var(--text-dim,#64748b);--dm-cl-text:var(--text,#0f172a)}
    .dm-cot-temp-l{display:inline-flex;flex-wrap:wrap;align-items:center;gap:4px 6px;min-width:0;font-size:12.5px;font-weight:850;color:var(--text,#0f172a)}
    .dm-cot-dentro{flex:1 0 100%;font-size:11px;font-weight:700;color:var(--text-dim,#64748b)}
    .dm-cot-step{display:flex;align-items:center;gap:10px;flex:0 0 auto}
    .dm-cot-step b{font-family:Oswald,Inter,sans-serif;font-size:26px;font-weight:700;color:#c2410c;min-width:58px;text-align:center}
    .dm-cot-step b i{font-style:normal;font-size:14px;margin-left:2px;color:var(--text-dim,#64748b)}
    /* Arancio finche' scalda; ferma o finita, la temperatura e' un numero come gli altri. */
    .dm-cot-card:not([data-fase="cottura"]):not([data-fase="preriscaldamento"]) .dm-cot-step b{color:var(--text,#0f172a)}

    .dm-cot .dm-cot-azioni{grid-template-columns:repeat(var(--dm-cot-tasti,3),minmax(0,1fr))}
    .dm-cot .dm-cot-azioni .dm-btn{min-width:0;padding:9px 8px;white-space:nowrap}
    .dm-cot .dm-cot-azioni .dm-btn>span{overflow:hidden;text-overflow:ellipsis}

    .dm-cot-altri{align-content:start}
    .dm-cot-altro{display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:12px;padding:10px 12px;border-radius:16px;border:1px solid var(--card-border,#e2e8f0);background:var(--surface-2,#f8fafc)}
    .dm-cot-altro[data-fase="spenta"] .dm-cot-altro-ic{opacity:.82}
    .dm-cot-altro:not([data-fase="spenta"]){border-color:rgba(234,88,12,.32);background:color-mix(in srgb,#f97316 6%,var(--card-bg,#fff))}
    .dm-cot-altro-ic{display:grid;place-items:center;width:44px;height:44px}
    .dm-cot-altro-ic .dm-appliance-art{line-height:0}
    .dm-cot-altro-testo{display:grid;gap:2px;min-width:0}
    .dm-cot-altro-testo strong{font-size:14px;font-weight:900;color:var(--text,#0f172a);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dm-cot-altro-testo small{font-size:11px;font-weight:700;color:var(--text-dim,#64748b);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dm-cot-altro-stato{font-size:12.5px;font-weight:900;color:var(--text-dim,#64748b);white-space:nowrap}
    .dm-cot-altro:not([data-fase="spenta"]) .dm-cot-altro-stato{color:#c2410c}

    @media(max-width:520px){
      .dm-cot-testa{padding:16px 18px}
      .dm-cot-testa strong{font-size:26px}
      .dm-cot .dm-cot-ring{width:116px;height:116px}
      .dm-cot .dm-cot-ring .dm-ring-core{width:92px;height:92px}
      .dm-cot .dm-cot-ring .dm-ring-core b{font-size:26px}
      .dm-cot .dm-cot-corpo{gap:12px}
      .dm-cot-step{gap:6px}
      .dm-cot-step b{font-size:24px;min-width:50px}
      .dm-cot .dm-cot-azioni .dm-btn{font-size:12.5px;padding:9px 6px}
    }
    html[data-theme="dark"] .dm-cot-testa[data-fase="cottura"] strong,html[data-theme="dark"] .dm-cot-testa[data-fase="preriscaldamento"] strong{color:#fb923c}
    html[data-theme="dark"] .dm-cot-testa[data-fase="pronta"] strong{color:#4ade80}
    html[data-theme="dark"] .dm-cot-card[data-fase="cottura"] .dm-cot-step b,html[data-theme="dark"] .dm-cot-card[data-fase="preriscaldamento"] .dm-cot-step b{color:#fb923c}
    html[data-theme="dark"] .dm-cot-fase[data-fase="cottura"],html[data-theme="dark"] .dm-cot-fase[data-fase="preriscaldamento"]{background:rgba(249,115,22,.2);color:#fdba74}
    html[data-theme="dark"] .dm-cot-fase[data-fase="pronta"]{background:rgba(34,197,94,.18);color:#86efac}
    `,
  );
}

export function installCottura() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  /* In cattura, come i tasti degli altri apparecchi: il tocco su un tasto
   * della scheda non deve arrivare a chi sta sotto. */
  doc.addEventListener("click", premi, true);
  doc.addEventListener?.("visibilitychange", () => {
    if (doc.visibilityState === "visible") ticchetta();
  });
  return true;
}
