/* I testi della sicurezza: dove si scrivono, e i due posti dove si leggono (#472).
 *
 * «Ho in Home Assistant due sensori che restituiscono una stringa di testo:
 * uno con lo stato del sistema di sicurezza, uno con le anomalie. Vorrei
 * vedere le scritte piccole che scorrono nella Home, e vederle anche nella
 * sezione Sicurezza.»
 *
 * Tre pezzi, e stanno insieme perche' parlano della stessa cosa:
 *
 *  - la SCHEDA, nella configurazione della Sicurezza, sotto i tasti
 *    dell'antifurto: e' li' che chi ha una centrale cerca quello che riguarda
 *    la centrale, e un sensore che dice «zona 3 esclusa» riguarda lei;
 *  - il RIQUADRO in Sicurezza, subito sotto la console dell'allarme: il testo
 *    per intero, sempre, colorato quando dice qualcosa;
 *  - la RIGA in Home, sotto la corsia degli avvisi: piccola, solo quando dice
 *    qualcosa, e scorre se non ci sta.
 *
 * Cosa vuol dire «dice qualcosa» lo decide `core/testi-della-sicurezza.js`,
 * che e' puro e si prova da solo. Qui si legge il deposito, si disegna, e ci
 * si sveglia quando serve.
 *
 * ── Perche' la pagina Sicurezza non sa niente di questo file ──────────────
 *
 * Il riquadro si mette nello scheletro che disegna la vetrina
 * (`security-showcase-section.js`), ma la vetrina non lo importa: si aggancia
 * il suo `renderSecurity` dal di fuori, come fa il blocco del fumo. La vetrina
 * e' importata a sua volta dalla Home dei widget, e questo file prende la
 * corsia degli avvisi dalla Home: farsi importare dalla vetrina voleva dire
 * chiudere un cerchio fra la Home e la Sicurezza per una riga di testo.
 */
import {
  CHIAVE_TESTI_SICUREZZA,
  QUANTI_TESTI,
  ceQualcheTesto,
  entitaDeiTesti,
  letturaDeiTesti,
  letturaDelTesto,
  normalizzaTestiDellaSicurezza,
  testiPerLaHome,
} from "../core/testi-della-sicurezza.js";
import { disegnoDelCatalogo } from "../core/catalogo-disegni.js";
import { SENZA_TESSERA } from "../core/fuori-dai-widget.js";
import { durataDellaDeriva, spazioDaPercorrere } from "../core/la-fascia-deriva.js";
import { prossimoCambioDelDaQuando, quantoTempoInParole } from "../core/da-quanto.js";
import { casellaDellaCentrale } from "./alarm-modes-editor-section.js";
import { corsiaDegliAvvisi } from "./come-sta-la-casa-section.js";
import {
  allStates,
  clean,
  doc,
  esc,
  ilCambioTocca,
  installStyle,
  paginaVisibile,
  quandoSiCambiaPagina,
  readJson,
  root,
  t,
  tieniIlBloccoNellaScheda,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_TESTI_SICUREZZA__";
const STYLE_ID = "dm-testi-sicurezza-style";
const BLOCK_ID = "dm-testi-sicurezza";
const HOME_ID = "dm-sic-testi";
const state = (root[KEY] ||= { installed: false, frame: 0, sveglia: 0 });

function configurazione() {
  return normalizzaTestiDellaSicurezza(readJson(CHIAVE_TESTI_SICUREZZA, {}));
}

/* ── le parole ──────────────────────────────────────────────────────────── */

/* «Cambiato 5 minuti fa». Il numero resta fuori dalla frase da tradurre, come
 * vuole `quantoTempoInParole`: «Cambiato» e «fa» sono due parole fisse, e
 * «appena adesso» si regge da solo — «cambiato appena adesso fa» no. */
export function daQuantoECambiato(da, adesso = Date.now()) {
  if (!Number.isFinite(da)) return "";
  const minuti = Math.max(0, (adesso - da) / 60000);
  const quanto = quantoTempoInParole(minuti);
  return minuti >= 1
    ? `${t("Cambiato", "Changed")} ${quanto} ${t("fa", "ago")}`
    : `${t("Cambiato", "Changed")} ${quanto}`;
}

/* Il disegno davanti al testo: l'avviso quando dice qualcosa, lo scudo quando
 * e' tranquillo. Sono due nomi del catalogo di casa, non due emoji: un'emoji
 * cambia faccia da un telefono all'altro (#74). */
function disegnoDelTesto(lettura, misura) {
  return disegnoDelCatalogo(lettura.stato === "avviso" ? "warning" : "security", misura);
}

/* ── il riquadro in Sicurezza ───────────────────────────────────────────── */

/**
 * Il riquadro dei testi nella pagina Sicurezza: una riga per testo, con
 * l'etichetta, la frase per intero e da quanto e' cosi'.
 *
 * Per intero vuol dire che va a capo: qui non si scorre, perche' qui si e'
 * entrati apposta per leggere. Un sensore che non risponde lo dice con le sue
 * parole e resta smorto — «non disponibile» non e' «tutto bene», e colorarlo
 * di verde o lasciarlo vuoto sarebbe la bugia tranquillizzante che la pagina
 * evita gia' per le zone e gli ingressi.
 */
export function riquadroDeiTesti(letture, adesso = Date.now()) {
  if (!letture?.length) return "";
  const righe = letture
    .map((lettura) => {
      const frase =
        lettura.stato === "muto" ? t("Non disponibile", "Unavailable") : lettura.testo || "—";
      const quando = lettura.stato === "muto" ? "" : daQuantoECambiato(lettura.da, adesso);
      return `<div class="dm-sec-testo" data-stato="${esc(lettura.stato)}" title="${esc(lettura.entity)}">
        <span class="dm-sec-testo-ic" aria-hidden="true">${disegnoDelTesto(lettura, 22)}</span>
        <div class="dm-sec-testo-corpo">
          <div class="dm-sec-testo-cap"><strong>${esc(lettura.etichetta)}</strong>${
            quando ? `<span>${esc(quando)}</span>` : ""
          }</div>
          <p class="dm-sec-testo-frase">${esc(frase)}</p>
        </div>
      </div>`;
    })
    .join("");
  return `<div class="dm-sec-testi-righe">${righe}</div>`;
}

/* Il posto: subito sotto la console dell'allarme, che e' la prima cosa della
 * pagina e quella di cui questi testi parlano. Si sceglie solo quando il
 * riquadro nasce — dopo, se chi ha riordinato la pagina (#379) l'ha portato
 * altrove, resta dove l'ha messo lui. Senza console (la centrale non c'e', o
 * il guscio l'ha nascosta) si va sotto la testata. */
function riquadroInPagina(shell) {
  const gia = shell.querySelector(":scope > [data-dm-sec-testi]");
  if (gia) return gia;
  const riquadro = doc.createElement("section");
  riquadro.className = "dm-sec-testi";
  riquadro.dataset.dmSecTesti = "true";
  const sopra =
    shell.querySelector(":scope > #alarm-stage") || shell.querySelector(":scope > .dm-sec-mast");
  if (sopra) sopra.after(riquadro);
  else shell.prepend(riquadro);
  return riquadro;
}

/** Mette i testi nella pagina Sicurezza, se ce ne sono. */
export function disegnaITestiInSicurezza(config = configurazione(), states = allStates()) {
  const shell = doc?.querySelector?.("#page-security .dm-sec-shell");
  if (!shell) return [];
  if (!ceQualcheTesto(config)) {
    shell.querySelector(":scope > [data-dm-sec-testi]")?.remove();
    return [];
  }
  const letture = letturaDeiTesti(config, states);
  const riquadro = riquadroInPagina(shell);
  const markup = riquadroDeiTesti(letture);
  if (riquadro.innerHTML !== markup) riquadro.innerHTML = markup;
  return letture;
}

/* Il «cambiato 5 minuti fa» lo fa l'orologio, non lo stato: finche' il
 * sensore non si muove niente ridisegna, e su una plancia al muro il «5
 * minuti» resterebbe li' per ore. Una sveglia sola, al minuto in cui la
 * scritta cambia davvero, e solo mentre la pagina e' davanti a qualcuno —
 * come fanno i Varchi. */
function svegliamiQuandoCambia(letture) {
  if (state.sveglia) {
    root.clearTimeout?.(state.sveglia);
    state.sveglia = 0;
  }
  if (!paginaVisibile("page-security")) return;
  const fra = prossimoCambioDelDaQuando(
    letture.filter((lettura) => lettura.stato !== "muto"),
    Date.now(),
  );
  if (fra == null) return;
  state.sveglia =
    root.setTimeout?.(
      () => {
        state.sveglia = 0;
        schedule();
      },
      Math.max(1000, fra + 250),
    ) || 0;
}

/* ── la riga in Home ────────────────────────────────────────────────────── */

/**
 * Una riga della Home: il disegno, l'etichetta e il testo, su una riga sola.
 *
 * Il testo sta in una finestra che lo ritaglia, e dentro la finestra su un
 * nastro: quando non ci sta e' il nastro a muoversi, non la finestra. Il
 * testo per intero sta anche nel titolo, per chi ci passa sopra col
 * puntatore — e per chi ha chiesto meno animazioni, che il nastro fermo lo
 * vede tagliato dai puntini.
 */
export function rigaDelTestoInHome(lettura) {
  return `<button type="button" class="dm-sic-testo" data-entity="${esc(lettura.entity)}"
    title="${esc(`${lettura.etichetta}: ${lettura.testo}`)}">
    <span class="dm-sic-testo-ic" aria-hidden="true">${disegnoDelTesto(lettura, 15)}</span>
    <b class="dm-sic-testo-cap">${esc(lettura.etichetta)}</b>
    <span class="dm-sic-testo-finestra"><span class="dm-sic-testo-nastro">${esc(
      lettura.testo,
    )}</span></span>
  </button>`;
}

/* Il posto in Home: subito sotto la corsia degli avvisi, che e' sotto il
 * meteo e sopra le pastiglie di stato del guscio.
 *
 * Non dentro la corsia: la corsia e' una riga sola, con l'avviso fermo a
 * sinistra e la fascia che deriva accanto, e una frase lunga in mezzo a loro
 * li stringerebbe tutti e due. E non sotto le pastiglie del guscio: quello e'
 * il punto da cui l'ordine dei blocchi riparte a impaginare la Home, e una
 * riga infilata li' finirebbe spinta in fondo al primo riordino. */
function contenitoreInHome() {
  const corsia = corsiaDegliAvvisi();
  if (!corsia) return null;
  let contenitore = doc.getElementById(HOME_ID);
  if (!contenitore) {
    contenitore = doc.createElement("div");
    contenitore.id = HOME_ID;
    contenitore.className = "dm-sic-testi";
  }
  if (contenitore.previousElementSibling !== corsia) corsia.after(contenitore);
  return contenitore;
}

/* La strada del nastro, misurata a disegno finito: le stesse due funzioni
 * della fascia e dell'avviso di sovraccarico, cosi' le tre cose che derivano
 * in cima alla Home vanno alla stessa velocita' — venticinque pixel al
 * secondo, il passo con cui si legge una parola mentre passa. Senza strada non
 * si accende niente: una frase che ci sta tutta resta ferma. */
function tieniIlTestoInMovimento(finestra) {
  if (!finestra) return false;
  const strada = spazioDaPercorrere({
    scrollWidth: finestra.scrollWidth,
    clientWidth: finestra.clientWidth,
  });
  if (!strada) {
    delete finestra.dataset.dmDeriva;
    finestra.style.removeProperty("--dm-sic-strada");
    finestra.style.removeProperty("--dm-sic-durata");
    return false;
  }
  finestra.style.setProperty("--dm-sic-strada", `${strada}px`);
  finestra.style.setProperty("--dm-sic-durata", `${durataDellaDeriva(strada)}s`);
  finestra.dataset.dmDeriva = "true";
  return true;
}

/** Disegna le righe in Home: solo quelle che dicono qualcosa. */
export function disegnaITestiInHome(config = configurazione(), states = allStates()) {
  const gia = doc?.getElementById?.(HOME_ID);
  /* La Home che nessuno guarda non si tocca: le misure del nastro, su una
   * pagina nascosta, sarebbero tutte zero. Ci si ripassa al cambio di pagina. */
  if (!paginaVisibile("page-home")) return false;
  const letture = testiPerLaHome(config, states);
  if (!letture.length) {
    gia?.remove();
    return false;
  }
  const contenitore = contenitoreInHome();
  if (!contenitore) return false;
  const markup = letture.map(rigaDelTestoInHome).join("");
  const firma = letture
    .map((lettura) => `${lettura.entity}~${lettura.etichetta}~${lettura.testo}`)
    .join("|");
  if (contenitore.dataset.firma !== firma) {
    contenitore.dataset.firma = firma;
    contenitore.innerHTML = markup;
  }
  for (const finestra of contenitore.querySelectorAll(".dm-sic-testo-finestra"))
    tieniIlTestoInMovimento(finestra);
  return true;
}

/* Il tocco porta in Sicurezza, dove c'e' il testo per intero e l'antifurto
 * accanto. Si preme la voce vera della barra, che e' il gesto che il guscio
 * conosce; se la Sicurezza e' spenta la voce e' nascosta, e il tocco non porta
 * da nessuna parte — meglio che aprire una pagina che uno ha deciso di non
 * avere. */
function apriLaSicurezza() {
  const voce = doc?.querySelector?.('.tab[data-tab="security"]');
  if (!voce || voce.style?.display === "none") return false;
  voce.click();
  return true;
}

/* ── la scheda nella configurazione ─────────────────────────────────────── */

/* Com'e' adesso l'entita' scritta nella casella: serve a scegliere quella
 * giusta senza uscire dalla configurazione. Si legge quello che c'e' scritto
 * nella casella, non quello salvato — chi ha appena scelto un'entita' vuole
 * vedere che cosa dice lei, prima di salvarla. */
function rigaDiAdesso(entity, states = allStates()) {
  const id = clean(entity);
  if (!id) return "";
  const stato = states?.[id];
  if (!stato)
    return t("Questa entità non c'è in Home Assistant.", "This entity is not in Home Assistant.");
  const lettura = letturaDelTesto({ entity: id }, stato);
  if (lettura.stato === "muto") return t("Adesso non risponde.", "It is not answering right now.");
  const frase = lettura.testo || "—";
  return lettura.stato === "neutro"
    ? `${t("Adesso", "Right now")}: «${frase}» · ${t("tranquillo, in Home non compare", "all quiet, not shown on Home")}`
    : `${t("Adesso", "Right now")}: «${frase}»`;
}

/** La scheda: due righe da riempire, l'interruttore della Home e il tasto.
 *
 * Le due righe non usano `ed-slot-lbl` per il titolo: il foglio del guscio
 * appende una matita a ogni etichetta di quella classe, e la matita direbbe
 * «questo nome si puo' ribattezzare» di un titolo che e' solo un numero. */
export function schedaDeiTestiMarkup(config, states = {}) {
  const righe = [];
  for (let indice = 0; indice < QUANTI_TESTI; indice += 1) {
    const riga = config.righe[indice] || { entity: "", etichetta: "" };
    const id = `dm-tsic-entity-${indice}`;
    const esempio =
      indice === 0
        ? { entity: "sensor.stato_allarme", etichetta: t("Stato allarme", "Alarm status") }
        : { entity: "sensor.anomalie", etichetta: t("Anomalie", "Faults") };
    righe.push(`<div class="ed-slot dm-tsic-riga" data-tsic-riga="${indice}">
      <span class="dm-tsic-lbl">${esc(t("Testo", "Text"))} ${indice + 1}</span>
      <span class="ed-form-row"><input id="${id}" class="ed-input mono" data-tsic-entity value="${esc(
        riga.entity,
      )}" placeholder="${esc(esempio.entity)}" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-tsic-pick="${id}" aria-label="${esc(
        t("Scegli entità", "Choose entity"),
      )}">🔍</button></span>
      <span class="dm-tsic-lbl dm-tsic-lbl-piccola">${esc(
        t("Etichetta (facoltativa)", "Label (optional)"),
      )}</span>
      <span class="ed-form-row"><input class="ed-input" data-tsic-etichetta maxlength="40" value="${esc(
        riga.etichetta,
      )}" placeholder="${esc(esempio.etichetta)}" aria-label="${esc(t("Etichetta", "Label"))}"></span>
      <small class="dm-tsic-adesso" data-tsic-adesso>${esc(rigaDiAdesso(riga.entity, states))}</small>
    </div>`);
  }
  return `<div class="ed-sec-title">🛡️ ${esc(t("Testi della sicurezza", "Security texts"))}</div>
    <p class="ed-intro dm-tsic-intro">${esc(
      t(
        "Fino a due entità il cui stato è un testo — un sensore con lo stato dell'impianto, uno con le anomalie, un input_text. La pagina Sicurezza li mostra per intero sotto l'antifurto, e si colorano quando dicono qualcosa. In Home compaiono piccoli, e scorrono se non ci stanno, solo quando non sono tranquilli: «OK», «Normale» o «Nessuna anomalia» non si vedono. L'etichetta è facoltativa: senza, si usa il nome dell'entità.",
        "Up to two entities whose state is a text — a sensor with the system status, one with the faults, an input_text. The Security page shows them in full under the alarm, coloured when they have something to say. On Home they appear small, scrolling when they do not fit, only when they are not quiet: “OK”, “Normal” or “No faults” are not shown. The label is optional: without one, the entity's name is used.",
      ),
    )}</p>
    <div class="dm-tsic-righe">${righe.join("")}</div>
    <label class="dm-tsic-home">
      <input type="checkbox" data-tsic-home${config.home ? " checked" : ""}>
      <span class="dm-tsic-home-testo">
        <b>${esc(t("Mostra in Home", "Show on Home"))}</b>
        <small>${esc(
          t(
            "Una riga piccola sotto il meteo per ogni testo che dice qualcosa. Toccandola si apre la Sicurezza.",
            "A small line under the weather for each text that has something to say. Tapping it opens Security.",
          ),
        )}</small>
      </span>
    </label>
    <output class="dm-todo-ed-error" data-tsic-error></output>
    <button type="button" class="ed-save-btn" data-tsic-salva>💾 ${esc(
      t("Salva testi", "Save texts"),
    )}</button>`;
}

/* Sotto i tasti su misura dell'antifurto quando ci sono, se no sotto la scelta
 * delle modalita', se no sotto la casella della centrale: e' la fila delle
 * cose dell'antifurto, e questi testi ne sono l'ultima. Si guarda la casella
 * della centrale per sapere di essere nella scheda giusta, come fanno i due
 * blocchi sopra: chi si fida della linguetta accesa arriva un giro prima. */
function doveVaLaScheda() {
  const casella = casellaDellaCentrale();
  if (!casella) return null;
  return (
    doc.getElementById("dm-antifurto-su-misura") || doc.getElementById("dm-alarm-modes") || casella
  );
}

function firmaDellaScheda(config) {
  return JSON.stringify(config);
}

export function ensureSchedaDeiTesti() {
  const sopra = doveVaLaScheda();
  let blocco = doc?.getElementById?.(BLOCK_ID);
  if (!sopra) {
    blocco?.remove();
    return false;
  }
  if (!blocco) {
    blocco = doc.createElement("section");
    blocco.id = BLOCK_ID;
    blocco.className = "dm-tsic";
    /* Le caselle di questa scheda non hanno una tessera loro in Home: la loro
     * riga in Home e' questa, e si accende con l'interruttore qui sotto.
     * Senza il segno, la casella prenderebbe l'interruttore «Nel widget» che
     * hanno tutte, e prometterebbe di togliere dalla Home una cosa che con le
     * tessere non c'entra. */
    blocco.setAttribute(SENZA_TESSERA, "");
    sopra.after(blocco);
  } else if (blocco.previousElementSibling !== sopra) {
    sopra.after(blocco);
  }
  const config = configurazione();
  const firma = firmaDellaScheda(config);
  /* Si rifa' solo quando cambia quello che e' salvato: rifare il markup a ogni
   * passaggio strapperebbe la casella da sotto le dita di chi sta scrivendo.
   * Quello che si muove da solo — cosa dice adesso l'entita' — si riscrive al
   * suo posto, riga per riga. */
  if (blocco.dataset.firma !== firma) {
    blocco.dataset.firma = firma;
    blocco.innerHTML = schedaDeiTestiMarkup(config, allStates());
    return true;
  }
  aggiornaLAdesso(blocco);
  return false;
}

function aggiornaLAdesso(blocco) {
  const states = allStates();
  for (const riga of blocco.querySelectorAll("[data-tsic-riga]")) {
    const campo = riga.querySelector("[data-tsic-adesso]");
    const testo = rigaDiAdesso(riga.querySelector("[data-tsic-entity]")?.value, states);
    if (campo && campo.textContent !== testo) campo.textContent = testo;
  }
}

/* Le righe come sono scritte nelle caselle, e se sono scritte bene.
 *
 * Una casella vuota toglie la riga, e va bene: e' il modo di smettere di
 * vedere un testo. Una casella con qualcosa che non e' un'entita' invece si
 * ferma qui, con la parola che dice cosa serve — salvarla vorrebbe dire che la
 * riga sparisce in silenzio alla prima lettura, e chi l'ha scritta non
 * capirebbe perche'. */
function righeDellaScheda(blocco) {
  const righe = [];
  for (const riga of blocco.querySelectorAll("[data-tsic-riga]")) {
    const entity = clean(riga.querySelector("[data-tsic-entity]")?.value);
    const etichetta = clean(riga.querySelector("[data-tsic-etichetta]")?.value);
    if (!entity) continue;
    if (!/^[a-z0-9_]+\.[a-z0-9_]+$/i.test(entity)) return { errore: entity };
    righe.push({ entity, etichetta });
  }
  return { righe };
}

function salva(config) {
  writeJsonIfChanged(CHIAVE_TESTI_SICUREZZA, {
    righe: config.righe.map(({ entity, etichetta }) =>
      etichetta ? { entity, etichetta } : { entity },
    ),
    home: config.home,
  });
  /* La pagina Sicurezza e la Home si rifanno subito: chi ha appena scelto il
   * sensore vuole vederlo, non scoprirlo al prossimo cambio di stato. */
  try {
    root.renderSecurity?.();
  } catch (_errore) {}
  schedule();
}

function onClick(event) {
  const testo = event.target?.closest?.(`#${HOME_ID} .dm-sic-testo`);
  if (testo) {
    event.preventDefault();
    apriLaSicurezza();
    return;
  }
  const blocco = doc?.getElementById?.(BLOCK_ID);
  if (!blocco || !blocco.contains(event.target)) return;
  const cerca = event.target.closest("[data-tsic-pick]");
  if (cerca) {
    event.preventDefault();
    const campo = doc.getElementById(clean(cerca.dataset.tsicPick));
    if (campo) root.wzPickEntity?.(campo);
    return;
  }
  if (!event.target.closest("[data-tsic-salva]")) return;
  event.preventDefault();
  const errore = blocco.querySelector("[data-tsic-error]");
  const { righe, errore: sbagliata } = righeDellaScheda(blocco);
  if (sbagliata) {
    if (errore)
      errore.textContent = t(
        `«${sbagliata}» non è un'entità: serve qualcosa come sensor.anomalie.`,
        `“${sbagliata}” is not an entity: something like sensor.faults is needed.`,
      );
    return;
  }
  if (errore) errore.textContent = "";
  const home = blocco.querySelector("[data-tsic-home]")?.checked !== false;
  salva(normalizzaTestiDellaSicurezza({ righe, home }));
  ensureSchedaDeiTesti();
  root.edToast?.(t("💾 Testi salvati", "💾 Texts saved"));
}

/* L'interruttore della Home si applica da solo, come quello delle telecamere:
 * e' una risposta a una domanda, non un numero da rileggere. Salva soltanto
 * lui — le caselle accanto, se qualcuno le sta ancora scrivendo, restano
 * quelle salvate finche' non si preme «Salva» — e la scheda non si rifa': la
 * casella spuntata e' gia' quella giusta, e rifare il markup porterebbe via
 * quello che c'e' scritto e non ancora salvato. */
function onCambio(event) {
  const blocco = doc?.getElementById?.(BLOCK_ID);
  if (!blocco || !blocco.contains(event.target)) return;
  const casella = event.target.closest?.("[data-tsic-home]");
  if (casella) {
    const config = { ...configurazione(), home: casella.checked };
    salva(config);
    blocco.dataset.firma = firmaDellaScheda(normalizzaTestiDellaSicurezza(config));
    return;
  }
  if (event.target.closest?.("[data-tsic-entity]")) aggiornaLAdesso(blocco);
}

/* ── giro ──────────────────────────────────────────────────────────────── */

function repaint() {
  state.frame = 0;
  const config = configurazione();
  const states = allStates();
  const letture = disegnaITestiInSicurezza(config, states);
  svegliamiQuandoCambia(letture);
  disegnaITestiInHome(config, states);
}

function schedule() {
  if (state.frame) return;
  state.frame = root.requestAnimationFrame?.(repaint) || root.setTimeout?.(repaint, 0) || 0;
}

export function installTestiDellaSicurezza() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyle(STYLE_ID, css());
  doc.addEventListener("click", onClick);
  doc.addEventListener("change", onCambio, true);
  doc.addEventListener("input", onCambio, true);
  tieniIlBloccoNellaScheda("dmTestiSicurezza", ensureSchedaDeiTesti);
  /* La vetrina rifa' lo scheletro della Sicurezza quando vuole lei: ci si
   * aggancia al suo `renderSecurity`, come il blocco del fumo, cosi' il
   * riquadro si rimette al suo posto a ogni giro. */
  const agganciaLaVetrina = () => wrapFunction("renderSecurity", "__dmTestiSicurezza", schedule);
  agganciaLaVetrina();
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:config-reset",
  ])
    root.addEventListener?.(evento, () => {
      agganciaLaVetrina();
      schedule();
    });
  /* Un cambio di stato conta solo se tocca uno dei due sensori: in una casa
   * vera ne arrivano di continuo, e chi non ha configurato niente non deve
   * pagare nemmeno la lettura del deposito piu' di una volta per giro. */
  root.addEventListener?.("dashboardmodern:state-changed", (event) => {
    const config = configurazione();
    if (!ceQualcheTesto(config) && !doc.getElementById(HOME_ID)) return;
    if (ilCambioTocca(event, entitaDeiTesti(config))) schedule();
  });
  /* Al cambio di pagina, perche' la Home nascosta non si misura e la
   * Sicurezza nascosta non tiene sveglie; e quando la finestra cambia
   * larghezza, perche' una frase che ci stava puo' smettere di starci. */
  quandoSiCambiaPagina(schedule);
  root.addEventListener?.("resize", schedule, { passive: true });
  schedule();
  return true;
}

/* ── stile ─────────────────────────────────────────────────────────────── */

function css() {
  return `
    /* Il riquadro in Sicurezza: la stessa carta delle zone qui sotto — stesso
       raggio, stesso bordo — con una riga per testo. Quella che dice qualcosa
       prende l'ambra degli avvisi della plancia, la stessa dell'avviso di
       sovraccarico in Home: si legge come «guarda qui», non come «scappa». */
    .dm-sec-testi{margin:0;padding:12px 14px;border-radius:20px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff)}
    .dm-sec-testi-righe{display:grid;gap:8px}
    .dm-sec-testo{display:flex;align-items:flex-start;gap:11px;padding:10px 12px;border-radius:14px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--surface-2,#f8fafc);min-width:0}
    .dm-sec-testo-ic{flex:0 0 auto;display:grid;place-items:center;width:34px;height:34px;border-radius:11px;
      color:#16a34a;background:color-mix(in srgb,#16a34a 12%,transparent)}
    .dm-sec-testo-ic svg{width:20px;height:20px;display:block}
    .dm-sec-testo-corpo{display:grid;gap:3px;min-width:0;flex:1 1 auto}
    .dm-sec-testo-cap{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
    .dm-sec-testo-cap strong{font-size:11px;font-weight:900;letter-spacing:.7px;text-transform:uppercase}
    .dm-sec-testo-cap span{font-size:11px;font-weight:700;color:var(--secondary-text-color,#94a3b8)}
    /* La frase per intero: va a capo, anche dentro una parola lunga — un
       codice d'errore senza spazi non deve spingere la carta oltre il bordo. */
    .dm-sec-testo-frase{margin:0;font-size:14px;font-weight:700;line-height:1.4;
      overflow-wrap:anywhere;white-space:pre-line}
    .dm-sec-testo[data-stato="avviso"]{
      border-color:color-mix(in srgb,#f59e0b 50%,transparent);
      background:color-mix(in srgb,#f59e0b 12%,var(--card-bg,#fff))}
    .dm-sec-testo[data-stato="avviso"] .dm-sec-testo-ic{
      color:#d97706;background:color-mix(in srgb,#f59e0b 18%,transparent)}
    .dm-sec-testo[data-stato="avviso"] .dm-sec-testo-cap strong,
    .dm-sec-testo[data-stato="avviso"] .dm-sec-testo-frase{color:#b45309}
    .dm-sec-testo[data-stato="muto"]{opacity:.6}
    .dm-sec-testo[data-stato="muto"] .dm-sec-testo-ic{
      color:var(--text-dim,#64748b);background:color-mix(in srgb,var(--text-dim,#64748b) 12%,transparent)}
    html[data-theme="dark"] .dm-sec-testo[data-stato="avviso"] .dm-sec-testo-cap strong,
    html[data-theme="dark"] .dm-sec-testo[data-stato="avviso"] .dm-sec-testo-frase{color:#fcd34d}

    /* Le righe in Home: piccole, una per testo, larghe quanto la pagina. Il
       vestito e' quello della fascia accanto — il bianco, il raggio, l'ombra —
       col filo ambra di chi ha qualcosa da dire. */
    .dm-sic-testi{display:grid;gap:6px;margin:0 0 12px;min-width:0;max-width:100%}
    .dm-casa-fascia:not(:empty) + .dm-sic-testi{margin-top:-8px}
    .dm-sic-testo{
      display:flex;align-items:center;gap:8px;width:100%;min-width:0;margin:0;
      padding:5px 12px 5px 6px;border-radius:14px;cursor:pointer;text-align:left;
      font:inherit;color:var(--text,#0f172a);
      border:1px solid color-mix(in srgb,#f59e0b 45%,transparent);
      background:color-mix(in srgb,#f59e0b 9%,var(--card-bg,#fff));
      box-shadow:0 6px 18px -14px rgba(15,23,42,.28)}
    .dm-sic-testo:active{transform:scale(.99)}
    .dm-sic-testo:focus-visible{outline:2px solid #f59e0b;outline-offset:2px}
    .dm-sic-testo-ic{flex:0 0 auto;display:grid;place-items:center;width:24px;height:24px;border-radius:8px;
      color:#d97706;background:color-mix(in srgb,#f59e0b 18%,transparent)}
    .dm-sic-testo-ic svg{width:15px;height:15px;display:block}
    /* L'etichetta non si stringe per far posto al testo: e' corta per
       costruzione, e senza di lei il testo non dice di che cosa parla. Si
       taglia solo oltre il suo tetto. Il testo invece parte da zero e prende
       quello che resta: partendo dalla sua larghezza intera, nel conto della
       riga schiacciava l'etichetta a «AN…» proprio quando era lungo. */
    .dm-sic-testo-cap{flex:0 0 auto;max-width:38%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      font-size:9.5px;font-weight:900;letter-spacing:.11em;text-transform:uppercase;color:#d97706}
    /* La finestra ritaglia, il nastro si muove. Il nastro e' sempre un blocco
       in linea: su un elemento in linea la larghezza non si misura, e la
       finestra direbbe che ci sta tutto anche quando non e' vero. */
    .dm-sic-testo-finestra{flex:1 1 0;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;
      font-size:12.5px;font-weight:750;line-height:1.3;color:#b45309}
    .dm-sic-testo-nastro{display:inline-block}
    .dm-sic-testo-finestra[data-dm-deriva="true"]{text-overflow:clip}
    .dm-sic-testo-finestra[data-dm-deriva="true"] > .dm-sic-testo-nastro{
      animation:dm-sic-deriva var(--dm-sic-durata,12s) ease-in-out infinite alternate}
    @keyframes dm-sic-deriva{
      from{translate:0}
      to{translate:calc(0px - var(--dm-sic-strada,0px))}}
    /* Chi ci mette il dito o il puntatore sopra comanda lui: si ferma e si
       legge, come la fascia. */
    .dm-sic-testo:hover .dm-sic-testo-nastro,
    .dm-sic-testo:active .dm-sic-testo-nastro,
    .dm-sic-testo:focus-visible .dm-sic-testo-nastro{animation-play-state:paused}
    /* Chi ha chiesto meno animazioni non vede muovere niente: la frase torna
       tagliata dai puntini, e per intero la si legge in Sicurezza, che e'
       dove il tocco porta. */
    @media (prefers-reduced-motion:reduce){
      .dm-sic-testo-finestra[data-dm-deriva="true"]{text-overflow:ellipsis}
      .dm-sic-testo-finestra[data-dm-deriva="true"] > .dm-sic-testo-nastro{display:inline;animation:none}}
    html[data-theme="dark"] .dm-sic-testo{box-shadow:none}
    html[data-theme="dark"] .dm-sic-testo-finestra{color:#fcd34d}
    html[data-theme="dark"] .dm-sic-testo-cap{color:#fbbf24}

    /* La scheda nella configurazione. */
    #ed-body .dm-tsic{display:grid;gap:8px;margin:14px 0 4px}
    #ed-body .dm-tsic-intro{margin:0}
    #ed-body .dm-tsic-righe{display:grid;gap:10px}
    #ed-body .dm-tsic-riga{display:grid;gap:6px}
    #ed-body .dm-tsic-lbl{display:block;margin:0 2px;font-size:12.5px;font-weight:800;
      color:var(--text,#0f172a)}
    #ed-body .dm-tsic-lbl-piccola{font-size:11px;letter-spacing:.04em;text-transform:uppercase;
      color:var(--text-dim,#64748b)}
    #ed-body .dm-tsic-adesso{font-size:11.5px;font-weight:700;line-height:1.45;
      color:var(--secondary-text-color,#64748b);overflow-wrap:anywhere}
    #ed-body .dm-tsic-adesso:empty{display:none}
    #ed-body .dm-tsic-home{display:flex;align-items:flex-start;gap:11px;padding:11px 12px;min-width:0;
      border:1px solid var(--divider-color,#dbe4ee);border-radius:14px;
      background:var(--card-background-color,#fff);cursor:pointer}
    #ed-body .dm-tsic-home input{flex:0 0 auto;width:19px;height:19px;margin-top:1px;
      accent-color:var(--primary-color,#0ea5e9)}
    #ed-body .dm-tsic-home-testo{display:grid;gap:3px;min-width:0;flex:1 1 auto}
    #ed-body .dm-tsic-home-testo b{font-size:13.5px;font-weight:750}
    #ed-body .dm-tsic-home-testo small{font-size:11.5px;line-height:1.5;color:var(--secondary-text-color,#64748b)}
  `;
}
