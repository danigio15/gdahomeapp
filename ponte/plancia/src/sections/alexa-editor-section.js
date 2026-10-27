/* «🔊 Alexa», una sezione del Config tutta sua, con due schede: «Notifiche»
 * e «Avvisi personalizzati».
 *
 * «Notifiche verso Alexa?» Le notifiche vanno ai telefoni; qui si sceglie se
 * le dicono anche gli Echo di casa, quali Echo, quali famiglie di notifiche,
 * quando stare zitti e come parlare. La regola sta in `core/alexa-annunci.js`,
 * e a far parlare gli Echo e' il ponte (`notifiche.js`, `_dilloAdAlexa`),
 * con Home Assistant e l'integrazione Alexa Media Player.
 *
 * Senza quell'integrazione gli Echo in Home Assistant non ci sono: la scheda
 * lo dice, e spiega dove si installa, invece di offrire una scelta vuota. Il
 * tasto «Prova» chiede al ponte una frase sugli Echo scelti — lo fa solo chi
 * amministra, e il ponte risponde solo «fatto» o no.
 *
 * Il vestito e' quello della scheda «A muro» (`mu-ed-*`): righe con il testo
 * a sinistra e il comando a destra, interruttori e scelte a pastiglia.
 */
import {
  ALTOPARLANTI_AL_PIU,
  AVVISI_AL_PIU,
  CATEGORIE_ALEXA,
  CHIAVE_ALEXA,
  FRASE_AL_PIU,
  altoparlantiAlexa,
  avvisoPulito,
  normalizzaAlexa,
} from "../core/alexa-annunci.js";
import { ensureTitoloDellaSezione, riordinaLeLinguette } from "./alberatura-del-config-section.js";
import {
  allStates,
  chiediAHomeAssistant,
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  t,
  wrapFunction,
  writeJsonIfChanged,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_ALEXA_EDITOR__";
const state = (root[KEY] ||= {
  installed: false,
  provando: false,
  esito: "",
  scritto: "",
  bozza: null,
  erroreAvviso: "",
});

export const ALEXA_EDITOR_TAB = "alexa";
/* La seconda scheda della sezione: gli avvisi personalizzati. */
export const ALEXA_AVVISI_TAB = "alexa_avvisi";
const LE_SCHEDE = [ALEXA_EDITOR_TAB, ALEXA_AVVISI_TAB];

/* Come si chiamano le famiglie di notifiche, in italiano e in inglese: una
 * tabella che l'estrattore delle traduzioni legge (`SECTION_TABLES`). */
const NOMI_DELLE_FAMIGLIE = Object.freeze({
  urgenti: [
    "Urgenti: antifurto, allarmi, campanello, blackout",
    "Urgent: alarm, sensors, doorbell, blackout",
  ],
  sicurezza: ["Sicurezza: inserimenti, aperture, movimento", "Security: arming, openings, motion"],
  casa: ["Casa: elettrodomestici, frigo, pioggia, animali", "Home: appliances, fridge, rain, pets"],
  persone: ["Persone: chi arriva", "People: who arrives"],
  personalizzate: ["Le tue notifiche personalizzate", "Your custom notifications"],
  homeassistant: ["Dalle automazioni di Home Assistant", "From Home Assistant automations"],
});

/* I giorni, dal lunedi': il numero e' quello di `Date.getDay()`. */
const GIORNI = Object.freeze({
  1: ["lun", "Mon"],
  2: ["mar", "Tue"],
  3: ["mer", "Wed"],
  4: ["gio", "Thu"],
  5: ["ven", "Fri"],
  6: ["sab", "Sat"],
  0: ["dom", "Sun"],
});
const ORDINE_DEI_GIORNI = [1, 2, 3, 4, 5, 6, 0];

/* Come si confronta lo stato della cosa scelta con quello scritto. */
const CONDIZIONI = Object.freeze({
  uguale: ["è", "is"],
  diverso: ["non è", "is not"],
  sopra: ["sopra", "above"],
  sotto: ["sotto", "below"],
});

const nomeDellaFamiglia = (voce) => {
  const [it, en] = NOMI_DELLE_FAMIGLIE[voce.id] || [voce.it, voce.en];
  return t(it, en);
};

const schedaAttiva = () => clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);

function configurazione() {
  return normalizzaAlexa(readJson(CHIAVE_ALEXA, null));
}

function salva(cambio) {
  const pulita = normalizzaAlexa({ ...configurazione(), ...cambio });
  writeJsonIfChanged(CHIAVE_ALEXA, pulita);
  try {
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  } catch (_error) {}
  return pulita;
}

const interruttore = (acceso, dato, etichetta) =>
  `<button type="button" class="mu-ed-int" role="switch" aria-checked="${acceso}" aria-label="${esc(etichetta)}" ${dato}><i></i></button>`;

/* `corta`: a destra c'e' solo un interruttore, che resta sulla riga anche
 * sul telefono invece di andare a capo sotto il testo. */
const riga = (
  titolo,
  sotto,
  destra,
  corta = false,
) => `<div class="mu-ed-riga${corta ? " dm-alexa-corta" : ""}">
    <div class="mu-ed-testo"><b>${titolo}</b>${sotto ? `<small>${sotto}</small>` : ""}</div>
    ${destra ? `<div class="mu-ed-dx">${destra}</div>` : ""}
  </div>`;

function echoMarkup(config, echo) {
  if (!echo.length)
    return `<div class="mu-ed-riga"><div class="mu-ed-testo"><b>${esc(t("Nessun Echo in Home Assistant", "No Echo in Home Assistant"))}</b><small class="mu-ed-avviso">${esc(
      t(
        "Installa l'integrazione «Alexa Media Player» da HACS e accedi con il tuo account Amazon: gli Echo compaiono qui da soli.",
        "Install the «Alexa Media Player» integration from HACS and sign in with your Amazon account: the Echos show up here by themselves.",
      ),
    )}</small></div></div>`;
  return `<div class="mu-ed-riga"><div class="mu-ed-testo"><b>${esc(t("Quali Echo", "Which Echos"))}</b><small>${esc(
    t("Tocca un Echo per sceglierlo.", "Tap an Echo to choose it."),
  )}</small><div class="dm-alexa-echo">${echo
    .slice(0, ALTOPARLANTI_AL_PIU * 2)
    .map((uno) => {
      const scelto = config.altoparlanti.includes(uno.entita);
      return `<button type="button" class="dm-alexa-pastiglia" aria-pressed="${scelto}" data-dm-alexa-echo="${esc(uno.entita)}">🔊 ${esc(uno.nome)}${uno.spento ? ` <small>${esc(t("spento", "offline"))}</small>` : ""}</button>`;
    })
    .join("")}</div></div></div>`;
}

/* ─── Gli avvisi personalizzati ───────────────────────────────────────
 *
 * Una riga per avviso — la frase, quando, un interruttore e la matita — e
 * sotto, aperto, quello che si sta scrivendo. Lo scritto sta in una bozza
 * (`state.bozza`) finche' non si preme «Salva»: chiudere senza salvare non
 * cambia niente. */
const nomeDi = (entita) => clean(allStates()?.[entita]?.attributes?.friendly_name) || entita;

function giorniDetti(giorni) {
  if (giorni.length === 7) return t("tutti i giorni", "every day");
  if (!giorni.length) return t("nessun giorno", "no day");
  return ORDINE_DEI_GIORNI.filter((g) => giorni.includes(g))
    .map((g) => t(...GIORNI[g]))
    .join(" ");
}

function quandoDetto(avviso) {
  if (avviso.quando === "orario") return `🕒 ${avviso.ora} · ${giorniDetti(avviso.giorni)}`;
  if (!avviso.entita) return t("Scegli cosa guardare", "Choose what to watch");
  const [it, en] = CONDIZIONI[avviso.condizione] || CONDIZIONI.uguale;
  const per = avviso.per
    ? ` · ${t("da almeno", "for at least")} ${avviso.per} ${t("min", "min")}`
    : "";
  return `⚡ ${nomeDi(avviso.entita)} ${t(it, en)} «${avviso.valore}»${per}`;
}

function bozzaMarkup(bozza, echo) {
  const pastiglia = (scelto, dato, testo) =>
    `<button type="button" class="dm-alexa-pastiglia" aria-pressed="${scelto}" ${dato}>${testo}</button>`;
  const adesso = bozza.entita ? clean(allStates()?.[bozza.entita]?.state) : "";
  const quando =
    bozza.quando === "orario"
      ? `<div class="dm-alexa-campo">
          <span>${esc(t("Ora", "Time"))}</span>
          <input type="time" class="ed-input dm-alexa-ora" data-dm-av-ora value="${esc(bozza.ora)}">
        </div>
        <div class="dm-alexa-echo">${ORDINE_DEI_GIORNI.map((g) =>
          pastiglia(bozza.giorni.includes(g), `data-dm-av-giorno="${g}"`, esc(t(...GIORNI[g]))),
        ).join("")}</div>`
      : `<div class="dm-alexa-campo">
          <span>${esc(t("Cosa guardare", "What to watch"))}</span>
          <span class="ed-form-row dm-editor-entity-row">
            <input id="dm-av-entita" class="ed-input mono" data-dm-av-entita value="${esc(bozza.entita)}" placeholder="cover.garage" autocomplete="off" spellcheck="false">
            <button type="button" class="dm-entity-picker" data-dm-av-pick="dm-av-entita" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button>
          </span>
          ${adesso ? `<small>${esc(t("Adesso", "Now"))}: ${esc(adesso)}</small>` : ""}
        </div>
        <div class="dm-alexa-campi">
          <select class="ed-input" data-dm-av-condizione>${Object.entries(CONDIZIONI)
            .map(
              ([id, [it, en]]) =>
                `<option value="${id}"${bozza.condizione === id ? " selected" : ""}>${esc(t(it, en))}</option>`,
            )
            .join("")}</select>
          <input class="ed-input" data-dm-av-valore value="${esc(bozza.valore)}" placeholder="open / on / 25" maxlength="60">
          <label class="dm-alexa-per">${esc(t("da almeno", "for at least"))}
            <input type="number" class="ed-input" data-dm-av-per min="0" max="1440" value="${esc(String(bozza.per))}"> ${esc(t("min", "min"))}
          </label>
        </div>`;
  return `<div class="mu-ed-riga dm-alexa-bozza" data-dm-av-bozza>
    <div class="dm-alexa-campo">
      <span>${esc(t("Cosa dice", "What it says"))}</span>
      <input class="ed-input" data-dm-av-frase value="${esc(bozza.frase)}" maxlength="${FRASE_AL_PIU}" placeholder="${esc(t("È ora di andare a scuola", "Time to go to school"))}">
    </div>
    <div class="mu-ed-seg">${[
      ["orario", t("A un orario", "At a time")],
      ["stato", t("Quando cambia qualcosa", "When something changes")],
    ]
      .map(
        ([id, nome]) =>
          `<button type="button" class="${bozza.quando === id ? "si" : ""}" data-dm-av-quando="${id}">${esc(nome)}</button>`,
      )
      .join("")}</div>
    ${quando}
    ${
      echo.length
        ? `<div class="dm-alexa-campo"><span>${esc(
            t(
              "Su quali Echo (nessuno = quelli scelti sopra)",
              "On which Echos (none = the ones chosen above)",
            ),
          )}</span><div class="dm-alexa-echo">${echo
            .map((uno) =>
              pastiglia(
                bozza.altoparlanti.includes(uno.entita),
                `data-dm-av-echo="${esc(uno.entita)}"`,
                `🔊 ${esc(uno.nome)}`,
              ),
            )
            .join("")}</div></div>`
        : ""
    }
    ${state.erroreAvviso ? `<small class="mu-ed-avviso">${esc(state.erroreAvviso)}</small>` : ""}
    <div class="dm-alexa-tasti">
      <button type="button" class="mu-ed-prova" data-dm-av-salva>💾 ${esc(t("Salva", "Save"))}</button>
      <button type="button" class="mu-ed-prova" data-dm-av-prova${state.provando ? " disabled" : ""}>▶ ${esc(t("Prova", "Test"))}</button>
      <button type="button" class="dm-alexa-tasto" data-dm-av-annulla>${esc(t("Annulla", "Cancel"))}</button>
      ${
        bozza.esiste
          ? `<button type="button" class="dm-alexa-tasto dm-alexa-via" data-dm-av-elimina>🗑 ${esc(t("Elimina", "Delete"))}</button>`
          : ""
      }
    </div>
  </div>`;
}

function avvisiMarkup(config, echo) {
  const righe = config.avvisi
    .map((avviso) => {
      if (state.bozza?.id === avviso.id) return bozzaMarkup(state.bozza, echo);
      return `<div class="mu-ed-riga dm-alexa-corta">
        <div class="mu-ed-testo"><b>${esc(avviso.frase)}</b><small>${esc(quandoDetto(avviso))}</small></div>
        <div class="mu-ed-dx">
          <button type="button" class="dm-alexa-tasto" data-dm-av-apri="${esc(avviso.id)}" aria-label="${esc(t("Modifica", "Edit"))}">✏️</button>
          ${interruttore(avviso.attivo, `data-dm-av-attivo="${esc(avviso.id)}"`, avviso.frase)}
        </div>
      </div>`;
    })
    .join("");
  const nuova = state.bozza && !state.bozza.esiste ? bozzaMarkup(state.bozza, echo) : "";
  return `${riga(
    esc(t("Avvisi personalizzati", "Custom announcements")),
    esc(
      t(
        "Frasi tue che gli Echo dicono a un orario o quando cambia qualcosa in casa. Quelli a orario si dicono anche di notte.",
        "Your own sentences the Echos say at a time or when something changes at home. Timed ones are said at night too.",
      ),
    ),
    config.avvisi.length < AVVISI_AL_PIU && !state.bozza
      ? `<button type="button" class="mu-ed-prova" data-dm-av-nuovo>＋ ${esc(t("Nuovo avviso", "New announcement"))}</button>`
      : "",
  )}${righe}${nuova}`;
}

/* La scheda degli avvisi personalizzati. Con Alexa spenta gli avvisi si
 * scrivono lo stesso, ma lo si dice: non li direbbe nessuno. */
function corpoDegliAvvisi() {
  const config = configurazione();
  const echo = altoparlantiAlexa(allStates() || {});
  const spenta =
    !config.attivo || !config.altoparlanti.length
      ? `<div class="mu-ed-blocco"><div class="mu-ed-riga"><div class="mu-ed-testo"><b>${esc(
          t("Alexa non parla ancora", "Alexa is not speaking yet"),
        )}</b><small class="mu-ed-avviso">${esc(
          t(
            "Accendila e scegli gli Echo nella scheda «Notifiche»: senza, gli avvisi non si sentono.",
            "Turn it on and choose the Echos in the «Notifications» tab: otherwise the announcements are not heard.",
          ),
        )}</small></div></div></div>`
      : "";
  return `<div class="mu-ed dm-alexa-ed" data-dm-alexa-ed>
    ${spenta}
    <div class="mu-ed-blocco" data-dm-alexa-avvisi>
      ${avvisiMarkup(config, echo)}
    </div>
  </div>`;
}

function corpoMarkup() {
  if (schedaAttiva() === ALEXA_AVVISI_TAB) return corpoDegliAvvisi();
  const config = configurazione();
  const echo = altoparlantiAlexa(allStates() || {});
  const dis = config.attivo ? "" : " dm-alexa-spento";
  return `<div class="mu-ed dm-alexa-ed" data-dm-alexa-ed>
    <div class="mu-ed-blocco">
      ${riga(
        esc(t("Fai dire le notifiche agli Echo", "Have the Echos say the notifications")),
        esc(
          t(
            "Le notifiche arrivano ai telefoni; così le dicono anche gli Echo di casa, per chi è in casa con le mani occupate. Vale per tutta la casa.",
            "Notifications reach the phones; this way the Echos at home say them too, for whoever is home with their hands full. It applies to the whole home.",
          ),
        ),
        interruttore(config.attivo, "data-dm-alexa-attivo", t("Acceso", "On")),
        true,
      )}
    </div>
    <div class="mu-ed-blocco${dis}">
      ${echoMarkup(config, echo)}
    </div>
    <div class="mu-ed-blocco${dis}">
      ${CATEGORIE_ALEXA.map((voce) =>
        riga(
          esc(nomeDellaFamiglia(voce)),
          "",
          interruttore(
            config.categorie.includes(voce.id),
            `data-dm-alexa-categoria="${esc(voce.id)}"`,
            nomeDellaFamiglia(voce),
          ),
          true,
        ),
      ).join("")}
    </div>
    <div class="mu-ed-blocco${dis}">
      ${riga(
        esc(t("Di notte zitti", "Quiet at night")),
        esc(t("Le urgenti si dicono lo stesso.", "Urgent ones are said anyway.")),
        interruttore(
          Boolean(config.silenzio),
          "data-dm-alexa-notte",
          t("Di notte zitti", "Quiet at night"),
        ),
        true,
      )}
      ${
        config.silenzio
          ? `<div class="mu-ed-riga dm-alexa-ore">
              <label>${esc(t("Dalle", "From"))} <input type="time" class="ed-input" data-dm-alexa-da value="${esc(config.silenzio.da)}"></label>
              <label>${esc(t("alle", "to"))} <input type="time" class="ed-input" data-dm-alexa-a value="${esc(config.silenzio.a)}"></label>
            </div>`
          : ""
      }
      ${riga(
        esc(t("Come lo dice", "How it says it")),
        esc(
          t(
            "Annuncio: prima il suono, poi la voce. Voce: solo la voce.",
            "Announcement: a chime, then the voice. Voice: the voice only.",
          ),
        ),
        `<div class="mu-ed-seg">${[
          ["annuncio", t("Annuncio", "Announcement")],
          ["voce", t("Voce", "Voice")],
        ]
          .map(
            ([id, nome]) =>
              `<button type="button" class="${config.modo === id ? "si" : ""}" data-dm-alexa-modo="${id}">${esc(nome)}</button>`,
          )
          .join("")}</div>`,
      )}
      ${
        echo.length
          ? riga(
              esc(t("Prova", "Test")),
              state.esito
                ? esc(state.esito)
                : esc(t("Una frase sugli Echo scelti.", "A sentence on the chosen Echos.")),
              `<button type="button" class="mu-ed-prova" data-dm-alexa-prova${state.provando || !config.altoparlanti.length ? " disabled" : ""}>▶ ${esc(t("Prova", "Test"))}</button>`,
            )
          : ""
      }
    </div>
  </div>`;
}

export function ensureAlexaEditor() {
  const corpo = doc?.getElementById?.("ed-body");
  const scheda = schedaAttiva();
  if (!corpo || !LE_SCHEDE.includes(scheda)) {
    if (!LE_SCHEDE.includes(scheda)) {
      state.esito = "";
      state.bozza = null;
    }
    return false;
  }
  if (scheda !== ALEXA_AVVISI_TAB) state.bozza = null;
  /* Si riscrive solo se e' cambiato qualcosa: ogni giro del guscio passa di
   * qui, e un corpo riscritto a vuoto perde il fuoco dell'orario. */
  const markup = corpoMarkup();
  if (state.scritto === markup && corpo.querySelector("[data-dm-alexa-ed]")) return true;
  state.scritto = markup;
  corpo.innerHTML = markup;
  corpo.dataset.renderer = scheda;
  ensureTitoloDellaSezione();
  return true;
}

/* Le due linguette della sezione Alexa: le notifiche dette dagli Echo, e gli
 * avvisi scritti da chi amministra. L'albero le mette nella famiglia «Alexa»
 * (`core/alberatura-del-config.js`). */
export function ensureAlexaEditorTab() {
  const linguette = doc?.querySelector(".ed-tab")?.parentElement;
  if (!linguette) return false;
  let fatte = false;
  for (const [id, nome] of [
    [ALEXA_EDITOR_TAB, `🔔 ${t("Notifiche", "Notifications")}`],
    [ALEXA_AVVISI_TAB, `📝 ${t("Avvisi personalizzati", "Custom announcements")}`],
  ]) {
    if (linguette.querySelector(`.ed-tab[data-tab="${id}"]`)) continue;
    const linguetta = doc.createElement("button");
    linguetta.className = "ed-tab";
    linguetta.dataset.tab = id;
    linguetta.textContent = nome;
    linguetta.addEventListener("click", () => root.editorSwitch?.(id));
    const prima = linguette.querySelector('.ed-tab[data-tab="runtime"]');
    if (prima) prima.before(linguetta);
    else linguette.append(linguetta);
    fatte = true;
  }
  if (fatte) riordinaLeLinguette();
  return fatte;
}

function ridisegna() {
  state.scritto = "";
  ensureAlexaEditor();
}

async function prova({ frase = "", altoparlanti = null } = {}) {
  const config = configurazione();
  const su = altoparlanti?.length ? altoparlanti : config.altoparlanti;
  if (state.provando || !su.length) return;
  state.provando = true;
  state.esito = t("Lo sto dicendo…", "Saying it…");
  ridisegna();
  try {
    await chiediAHomeAssistant(
      {
        type: "ponte/alexa/prova",
        altoparlanti: su,
        modo: config.modo,
        ...(frase ? { frase } : {}),
      },
      15000,
    );
    state.esito = t("✓ Inviato: dovresti sentirlo adesso.", "✓ Sent: you should hear it now.");
  } catch (errore) {
    /* Il ponte dice di no con le sue parole: quelle di chi non amministra si
     * riconoscono, il resto e' un Echo che non risponde. */
    state.esito = /amministra/.test(clean(errore?.message))
      ? t("La prova la fa solo chi amministra la casa.", "Only home admins can run the test.")
      : t(
          "Gli Echo non rispondono: controlla Alexa Media Player in Home Assistant.",
          "The Echos do not answer: check Alexa Media Player in Home Assistant.",
        );
  } finally {
    state.provando = false;
    ridisegna();
  }
}

function onClick(evento) {
  const corpo = doc?.getElementById?.("ed-body");
  if (!corpo || !LE_SCHEDE.includes(schedaAttiva()) || !corpo.contains(evento.target)) return;
  const tasto = evento.target?.closest?.("button");
  if (!tasto) return;
  const config = configurazione();
  const d = tasto.dataset;
  if (suUnAvviso(d, config, evento)) return;
  if ("dmAlexaAttivo" in d) salva({ attivo: !config.attivo });
  else if ("dmAlexaEcho" in d) {
    const entita = clean(d.dmAlexaEcho);
    const altri = config.altoparlanti.filter((uno) => uno !== entita);
    salva({ altoparlanti: config.altoparlanti.includes(entita) ? altri : [...altri, entita] });
  } else if ("dmAlexaCategoria" in d) {
    const id = clean(d.dmAlexaCategoria);
    const altre = config.categorie.filter((una) => una !== id);
    salva({ categorie: config.categorie.includes(id) ? altre : [...altre, id] });
  } else if ("dmAlexaNotte" in d)
    salva({ silenzio: config.silenzio ? null : { da: "23:00", a: "07:00" } });
  else if ("dmAlexaModo" in d) salva({ modo: clean(d.dmAlexaModo) });
  else if ("dmAlexaProva" in d) {
    evento.preventDefault();
    void prova();
    return;
  } else return;
  evento.preventDefault();
  ridisegna();
}

/* I tasti degli avvisi personalizzati. Torna vero se il tasto era loro. */
function suUnAvviso(d, config, evento) {
  const bozza = state.bozza;
  const fatto = () => {
    evento.preventDefault();
    ridisegna();
    return true;
  };
  if ("dmAvNuovo" in d) {
    state.erroreAvviso = "";
    state.bozza = {
      ...avvisoPulito({ id: `a_${Date.now().toString(36)}`, frase: "·", ora: "08:00" }),
      frase: "",
      quando: "orario",
      entita: "",
      condizione: "uguale",
      valore: "",
      per: 0,
      esiste: false,
    };
    return fatto();
  }
  if ("dmAvApri" in d) {
    const avviso = config.avvisi.find((uno) => uno.id === d.dmAvApri);
    if (!avviso) return false;
    state.erroreAvviso = "";
    state.bozza = {
      ora: "08:00",
      giorni: [0, 1, 2, 3, 4, 5, 6],
      entita: "",
      condizione: "uguale",
      valore: "",
      per: 0,
      ...avviso,
      altoparlanti: [...avviso.altoparlanti],
      esiste: true,
    };
    return fatto();
  }
  if ("dmAvAttivo" in d) {
    salva({
      avvisi: config.avvisi.map((uno) =>
        uno.id === d.dmAvAttivo ? { ...uno, attivo: !uno.attivo } : uno,
      ),
    });
    return fatto();
  }
  if ("dmAvPick" in d) {
    evento.preventDefault();
    const campo = doc?.getElementById?.(clean(d.dmAvPick));
    if (campo) root.wzPickEntity?.(campo);
    return true;
  }
  if (!bozza) return false;
  if ("dmAvQuando" in d) {
    bozza.quando = d.dmAvQuando === "stato" ? "stato" : "orario";
    return fatto();
  }
  if ("dmAvGiorno" in d) {
    const g = Number(d.dmAvGiorno);
    bozza.giorni = bozza.giorni.includes(g)
      ? bozza.giorni.filter((uno) => uno !== g)
      : [...bozza.giorni, g];
    return fatto();
  }
  if ("dmAvEcho" in d) {
    const entita = clean(d.dmAvEcho);
    bozza.altoparlanti = bozza.altoparlanti.includes(entita)
      ? bozza.altoparlanti.filter((uno) => uno !== entita)
      : [...bozza.altoparlanti, entita];
    return fatto();
  }
  if ("dmAvAnnulla" in d) {
    state.bozza = null;
    return fatto();
  }
  if ("dmAvElimina" in d) {
    salva({ avvisi: config.avvisi.filter((uno) => uno.id !== bozza.id) });
    state.bozza = null;
    return fatto();
  }
  if ("dmAvProva" in d) {
    evento.preventDefault();
    if (bozza.frase.trim())
      void prova({ frase: bozza.frase.trim(), altoparlanti: bozza.altoparlanti });
    return true;
  }
  if ("dmAvSalva" in d) {
    const { esiste: _esiste, ...scritto } = bozza;
    const pulito = avvisoPulito(scritto);
    if (!pulito) state.erroreAvviso = t("Scrivi cosa deve dire.", "Write what it should say.");
    else if (pulito.quando === "stato" && !pulito.entita)
      state.erroreAvviso = t("Scegli cosa guardare.", "Choose what to watch.");
    else if (pulito.quando === "orario" && !pulito.giorni.length)
      state.erroreAvviso = t("Scegli almeno un giorno.", "Choose at least one day.");
    else {
      const altri = config.avvisi.filter((uno) => uno.id !== pulito.id);
      const posto = config.avvisi.findIndex((uno) => uno.id === pulito.id);
      if (posto >= 0) altri.splice(posto, 0, pulito);
      else altri.push(pulito);
      salva({ avvisi: altri });
      state.bozza = null;
      state.erroreAvviso = "";
      root.edToast?.(t("💾 Avviso salvato", "💾 Announcement saved"));
    }
    return fatto();
  }
  return false;
}

/* Quello che si scrive nella bozza resta li', senza ridisegnare: il fuoco
 * resta nel campo. */
function onInput(evento) {
  const bozza = state.bozza;
  const campo = evento.target;
  if (!bozza || !campo?.closest?.("[data-dm-av-bozza]")) return;
  if (campo.matches("[data-dm-av-frase]")) bozza.frase = String(campo.value || "");
  else if (campo.matches("[data-dm-av-ora]")) bozza.ora = clean(campo.value) || bozza.ora;
  else if (campo.matches("[data-dm-av-entita]")) bozza.entita = clean(campo.value);
  else if (campo.matches("[data-dm-av-condizione]")) bozza.condizione = clean(campo.value);
  else if (campo.matches("[data-dm-av-valore]")) bozza.valore = String(campo.value || "");
  else if (campo.matches("[data-dm-av-per]")) bozza.per = Number(campo.value) || 0;
}

function onChange(evento) {
  onInput(evento);
  /* La lente scrive l'entita' e manda un «change»: si ridisegna per dire lo
   * stato di adesso. */
  if (evento.target?.matches?.("[data-dm-av-entita]")) {
    ridisegna();
    return;
  }
  const corpo = doc?.getElementById?.("ed-body");
  if (!corpo || !LE_SCHEDE.includes(schedaAttiva())) return;
  if (!evento.target?.matches?.("[data-dm-alexa-da], [data-dm-alexa-a]")) return;
  salva({
    silenzio: {
      da: clean(corpo.querySelector("[data-dm-alexa-da]")?.value),
      a: clean(corpo.querySelector("[data-dm-alexa-a]")?.value),
    },
  });
  ridisegna();
}

export function installAlexaEditor() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyle(
    "dm-alexa-editor-style",
    `
    #ed-body .dm-alexa-spento{opacity:.55}
    #ed-body .dm-alexa-echo{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}
    #ed-body .dm-alexa-pastiglia{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;
      font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;color:inherit;
      border:1px solid var(--divider-color,#dbe4ee);background:var(--card-background-color,var(--card-bg,#fff))}
    #ed-body .dm-alexa-pastiglia[aria-pressed="true"]{border-color:#0ea5e9;color:#0369a1;
      background:color-mix(in srgb,#0ea5e9 12%,transparent);box-shadow:inset 0 0 0 1px #0ea5e999}
    html[data-theme="dark"] #ed-body .dm-alexa-pastiglia[aria-pressed="true"]{color:#7dd3fc}
    #ed-body .dm-alexa-pastiglia small{font-size:10.5px;font-weight:700;color:var(--text-dim,#64748b)}
    #ed-body .dm-alexa-ore{gap:10px 18px;font-size:13px;font-weight:750}
    #ed-body .dm-alexa-ore label{display:inline-flex;align-items:center;gap:8px}
    #ed-body .dm-alexa-ore .ed-input{margin:0;width:124px;min-width:0}
    #ed-body .dm-alexa-corta{flex-wrap:nowrap}
    #ed-body .dm-alexa-bozza{display:grid;gap:12px;align-items:stretch}
    #ed-body .dm-alexa-campo{display:grid;gap:5px;font-size:11.5px;font-weight:800;color:var(--text-dim,#64748b)}
    #ed-body .dm-alexa-campo .ed-input{margin:0;color:var(--text,inherit);font-weight:600}
    #ed-body .dm-alexa-campo small{font-weight:700}
    #ed-body .dm-alexa-ora{width:124px}
    #ed-body .dm-alexa-campi{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    #ed-body .dm-alexa-campi .ed-input{margin:0;width:auto;min-width:0;flex:0 1 160px}
    #ed-body .dm-alexa-per{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:750}
    #ed-body .dm-alexa-per .ed-input{width:76px;flex:none}
    #ed-body .dm-alexa-tasti{display:flex;flex-wrap:wrap;gap:8px}
    #ed-body .dm-alexa-tasto{border:1px solid var(--divider-color,#dbe4ee);background:none;color:inherit;
      border-radius:10px;padding:8px 12px;font:inherit;font-weight:800;font-size:12.5px;cursor:pointer}
    #ed-body .dm-alexa-via{color:#dc2626;border-color:color-mix(in srgb,#dc2626 40%,transparent)}
    #ed-body .dm-alexa-corta .mu-ed-testo{flex:1 1 0}
    `,
  );
  doc.addEventListener("click", onClick);
  doc.addEventListener("change", onChange);
  doc.addEventListener("input", onInput);
  const ancora = () =>
    root.queueMicrotask?.(() => {
      ensureAlexaEditorTab();
      ensureAlexaEditor();
    });
  wrapFunction("apriConfigEntita", "__dmAlexaEditor", () => {
    ensureAlexaEditorTab();
    ensureAlexaEditor();
  });
  onEditorRedraw("__dmAlexaEditor", ancora);
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, ancora);
  ensureAlexaEditorTab();
  ensureAlexaEditor();
  return true;
}
