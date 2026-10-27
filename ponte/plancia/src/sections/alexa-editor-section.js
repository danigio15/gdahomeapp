/* «🔊 Alexa», una sezione del Config tutta sua, con tre schede: «Notifiche»,
 * «Avvisi personalizzati» e «Musica».
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
 * «🎵 Musica» sposta sugli Echo la musica che suona gia' in casa, o fa
 * suonare quello che si sceglie (`core/alexa-musica.js`). Qui il ponte non
 * c'entra: e' la plancia a chiedere `media_player.play_media` a Home
 * Assistant, come fanno i tasti della pagina dei lettori.
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
import {
  CERCA_AL_PIU,
  PREFERITI_AL_PIU,
  SERVIZI_MUSICA,
  SERVIZIO_DI_SERIE,
  chiamataPerSuonare,
  chiamataSulLettore,
  chiamatePerSpostare,
  cosaPulita,
  echoPuliti,
  musicaCheSuona,
  musicaSugliEcho,
  preferitoPulito,
  servizioPulito,
} from "../core/alexa-musica.js";
import { ensureTitoloDellaSezione, riordinaLeLinguette } from "./alberatura-del-config-section.js";
import {
  allStates,
  chiamaServizio,
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
  /* La scheda «Musica»: gli Echo su cui suonare (null = quelli delle
   * notifiche), il servizio, quello che si sta scrivendo, l'ultima risposta. */
  musica: { echo: null, servizio: SERVIZIO_DI_SERIE, cosa: "", esito: "" },
  vivo: "",
});

export const ALEXA_EDITOR_TAB = "alexa";
/* La seconda scheda della sezione: gli avvisi personalizzati. */
export const ALEXA_AVVISI_TAB = "alexa_avvisi";
/* La terza: la musica sugli Echo. */
export const ALEXA_MUSICA_TAB = "alexa_musica";
const LE_SCHEDE = [ALEXA_EDITOR_TAB, ALEXA_AVVISI_TAB, ALEXA_MUSICA_TAB];

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

/* ─── La musica sugli Echo ────────────────────────────────────────────
 *
 * In cima gli Echo su cui suonare; poi quello che suona in casa adesso, con
 * il tasto per spostarlo; poi quello che suona sugli Echo, con pausa e stop;
 * in fondo la ricerca e i preferiti. Le due parti «adesso» cambiano da sole
 * (`aggiornaDalVivo`): si riscrive solo il loro riquadro, e la ricerca che si
 * sta scrivendo resta dov'e'. */
/* Disegnati e non emoji: «⏸» e «⏹» senza il carattere a colori diventano
 * due quadratini uguali. */
const SEGNI_DEI_TASTI = Object.freeze({
  pausa: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="3.8" height="14" rx="1.2" fill="currentColor"/><rect x="13.7" y="5" width="3.8" height="14" rx="1.2" fill="currentColor"/></svg>`,
  suona: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.2-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6Z" fill="currentColor"/></svg>`,
  successivo: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6.3v11.4a.9.9 0 0 0 1.4.75l8.3-5.7a.9.9 0 0 0 0-1.5L6.4 5.55A.9.9 0 0 0 5 6.3Z" fill="currentColor"/><rect x="16.4" y="5.2" width="2.8" height="13.6" rx="1.1" fill="currentColor"/></svg>`,
  ferma: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.2" fill="currentColor"/></svg>`,
});

const NOMI_DEI_TASTI = Object.freeze({
  pausa: ["Pausa", "Pause"],
  suona: ["Riprendi", "Resume"],
  successivo: ["Avanti", "Next"],
  ferma: ["Ferma", "Stop"],
});

/* Come si dice il servizio: i nomi dei marchi restano quelli, TuneIn si
 * spiega perche' non tutti sanno che e' la radio. */
const nomeDelServizio = (id) =>
  id === "TUNEIN"
    ? t("Radio (TuneIn)", "Radio (TuneIn)")
    : SERVIZI_MUSICA.find((uno) => uno.id === id)?.nome || id;

/* Una copertina dentro «url()»: le virgolette e le parentesi si codificano,
 * perche' sono le sole cose che uscirebbero dal loro posto. */
function copertina(foto, onde) {
  const url = clean(foto).replace(/["'()\\\s]/g, (carattere) => encodeURIComponent(carattere));
  return `<span class="dm-alexa-arte" aria-hidden="true"${url ? ` style="background-image:url('${url}')"` : ""}>${onde ? "📻" : "🎵"}</span>`;
}

function echoDellaMusica(config, stati) {
  const scelti = state.musica.echo ?? config.altoparlanti;
  return echoPuliti(scelti, stati);
}

function dalVivoMarkup(stati, su) {
  const inCasa = musicaCheSuona(stati);
  const sugliEcho = musicaSugliEcho(stati);
  const sotto = (uno) =>
    [uno.radio ? uno.canale || "" : uno.artista, uno.nome, uno.app]
      .filter(Boolean)
      .map(esc)
      .join(" · ");
  const righeInCasa = inCasa.length
    ? inCasa
        .map(
          (uno) => `<div class="mu-ed-riga dm-alexa-brano">
        ${copertina(uno.foto, uno.radio)}
        <div class="mu-ed-testo"><b>${esc(uno.titolo || uno.canale)}</b><small>${sotto(uno)}${
          uno.stato === "paused" ? ` · ${esc(t("in pausa", "paused"))}` : ""
        }</small></div>
        <div class="mu-ed-dx"><button type="button" class="mu-ed-prova" data-dm-mu-sposta="${esc(uno.entita)}"${
          su.length ? "" : " disabled"
        }>🔊 ${esc(t("Sugli Echo", "To the Echos"))}</button></div>
      </div>`,
        )
        .join("")
    : `<div class="mu-ed-riga"><div class="mu-ed-testo"><small>${esc(
        t(
          "Niente suona in casa adesso. Quando un lettore suona, compare qui.",
          "Nothing is playing at home right now. When a player plays, it shows up here.",
        ),
      )}</small></div></div>`;
  const tasti = (uno) =>
    (uno.stato === "playing" ? ["pausa", "successivo", "ferma"] : ["suona", "ferma"])
      .map(
        (comando) =>
          `<button type="button" class="dm-alexa-tasto" data-dm-mu-tasto="${comando}" data-dm-mu-echo-di="${esc(uno.entita)}" aria-label="${esc(
            t(...NOMI_DEI_TASTI[comando]),
          )}">${SEGNI_DEI_TASTI[comando]}</button>`,
      )
      .join("");
  const righeSugliEcho = sugliEcho
    .map(
      (uno) => `<div class="mu-ed-riga dm-alexa-brano">
        ${copertina(uno.foto, uno.radio)}
        <div class="mu-ed-testo"><b>${esc(uno.titolo || uno.canale)}</b><small>🔊 ${sotto(uno)}</small></div>
        <div class="mu-ed-dx dm-alexa-comandi">${tasti(uno)}</div>
      </div>`,
    )
    .join("");
  return `<div class="mu-ed-blocco">
      ${riga(
        esc(t("Suona in casa adesso", "Playing at home now")),
        esc(
          t(
            "Un tocco e la stessa musica passa sugli Echo scelti: gli Echo la cercano per titolo e artista, il lettore di prima va in pausa.",
            "One tap and the same music moves to the chosen Echos: the Echos look it up by title and artist, the previous player pauses.",
          ),
        ),
        "",
      )}
      ${righeInCasa}
    </div>
    ${
      sugliEcho.length
        ? `<div class="mu-ed-blocco">${riga(esc(t("Sugli Echo adesso", "On the Echos now")), "", "")}${righeSugliEcho}</div>`
        : ""
    }`;
}

function corpoDellaMusica() {
  const config = configurazione();
  const stati = allStates() || {};
  const echo = altoparlantiAlexa(stati);
  if (!echo.length)
    return `<div class="mu-ed dm-alexa-ed" data-dm-alexa-ed><div class="mu-ed-blocco">${echoMarkup(config, echo)}</div></div>`;
  const su = echoDellaMusica(config, stati);
  const musica = state.musica;
  const vivo = dalVivoMarkup(stati, su);
  state.vivo = vivo;
  const preferiti = config.musica
    .map(
      (uno, indice) => `<span class="dm-alexa-preferito">
        <button type="button" class="dm-alexa-pastiglia" data-dm-mu-preferito="${indice}"${su.length ? "" : " disabled"}>▶ ${esc(uno.cosa)} <small>${esc(nomeDelServizio(uno.servizio))}</small></button>
        <button type="button" class="dm-alexa-via-piccolo" data-dm-mu-togli="${indice}" aria-label="${esc(t("Togli dai preferiti", "Remove from favourites"))}">✕</button>
      </span>`,
    )
    .join("");
  const giaTenuto = config.musica.some(
    (uno) =>
      uno.servizio === musica.servizio &&
      uno.cosa.toLowerCase() === cosaPulita(musica.cosa).toLowerCase(),
  );
  return `<div class="mu-ed dm-alexa-ed" data-dm-alexa-ed>
    <div class="mu-ed-blocco">
      <div class="mu-ed-riga"><div class="mu-ed-testo"><b>${esc(t("Su quali Echo", "On which Echos"))}</b><small>${esc(
        t(
          "Tocca un Echo per sceglierlo. Più Echo suonano la stessa musica, ognuno per conto suo: per averla insieme usa un gruppo di altoparlanti dell'app Alexa.",
          "Tap an Echo to choose it. Several Echos play the same music, each on its own: to have it in sync use a speaker group from the Alexa app.",
        ),
      )}</small><div class="dm-alexa-echo">${echo
        .map(
          (uno) =>
            `<button type="button" class="dm-alexa-pastiglia" aria-pressed="${su.includes(uno.entita)}" data-dm-mu-echo="${esc(uno.entita)}">🔊 ${esc(uno.nome)}${uno.spento ? ` <small>${esc(t("spento", "offline"))}</small>` : ""}</button>`,
        )
        .join("")}</div></div></div>
    </div>
    <div data-dm-mu-vivo>${vivo}</div>
    <div class="mu-ed-blocco">
      ${riga(
        esc(t("Scegli cosa ascoltare", "Choose what to play")),
        esc(
          t(
            "Un artista, un brano, un album, una playlist o una radio. Il servizio deve essere collegato agli Echo nell'app Alexa.",
            "An artist, a song, an album, a playlist or a radio station. The service must be linked to the Echos in the Alexa app.",
          ),
        ),
        "",
      )}
      <div class="mu-ed-riga dm-alexa-bozza">
        <div class="dm-alexa-echo dm-alexa-servizi">${SERVIZI_MUSICA.map(
          (uno) =>
            `<button type="button" class="dm-alexa-pastiglia" aria-pressed="${musica.servizio === uno.id}" data-dm-mu-servizio="${uno.id}">${esc(nomeDelServizio(uno.id))}</button>`,
        ).join("")}</div>
        <div class="dm-alexa-cerca">
          <input class="ed-input" data-dm-mu-cosa value="${esc(musica.cosa)}" maxlength="${CERCA_AL_PIU}" enterkeyhint="go" placeholder="${esc(
            musica.servizio === "TUNEIN"
              ? t("Radio Deejay", "BBC Radio 2")
              : t("Vasco Rossi, Albachiara, Top 50 Italia…", "Coldplay, Yellow, Today's Top Hits…"),
          )}">
          <button type="button" class="mu-ed-prova" data-dm-mu-suona${su.length ? "" : " disabled"}>▶ ${esc(t("Suona", "Play"))}</button>
          <button type="button" class="dm-alexa-tasto" data-dm-mu-tieni${
            giaTenuto || config.musica.length >= PREFERITI_AL_PIU ? " disabled" : ""
          } aria-label="${esc(t("Tieni nei preferiti", "Keep in favourites"))}">☆</button>
        </div>
        ${musica.esito ? `<small class="dm-alexa-esito">${esc(musica.esito)}</small>` : ""}
      </div>
      ${
        preferiti
          ? `<div class="mu-ed-riga"><div class="mu-ed-testo"><b>${esc(t("Preferiti", "Favourites"))}</b><div class="dm-alexa-echo">${preferiti}</div></div></div>`
          : ""
      }
    </div>
  </div>`;
}

/* Le parti «adesso» si rinfrescano da sole mentre la scheda e' aperta: un
 * brano finisce, un altro comincia, e la scheda lo deve dire senza che si
 * tocchi niente. Lo dice Home Assistant, con lo stato che cambia: nessun
 * timer. */
function aggiornaDalVivo() {
  if (schedaAttiva() !== ALEXA_MUSICA_TAB) return;
  const scatola = doc?.querySelector?.("#ed-body [data-dm-mu-vivo]");
  if (!scatola) return;
  const stati = allStates() || {};
  const vivo = dalVivoMarkup(stati, echoDellaMusica(configurazione(), stati));
  if (vivo === state.vivo) return;
  state.vivo = vivo;
  scatola.innerHTML = vivo;
}

function suonaSugliEcho(chiamate, detto) {
  if (!chiamate.length) return;
  let andate = true;
  for (const chiamata of chiamate) andate = chiamaServizio(chiamata) && andate;
  state.musica.esito = andate
    ? detto
    : t("Manca il collegamento a Home Assistant.", "No connection to Home Assistant.");
  root.navigator?.vibrate?.(8);
}

/* I tasti della scheda «Musica». Torna vero se il tasto era suo. */
function suLaMusica(d, config, evento) {
  const musica = state.musica;
  const stati = allStates() || {};
  const su = echoDellaMusica(config, stati);
  const fatto = () => {
    evento.preventDefault();
    ridisegna();
    return true;
  };
  if ("dmMuEcho" in d) {
    const entita = clean(d.dmMuEcho);
    musica.echo = su.includes(entita) ? su.filter((uno) => uno !== entita) : [...su, entita];
    return fatto();
  }
  if ("dmMuServizio" in d) {
    musica.servizio = servizioPulito(d.dmMuServizio);
    return fatto();
  }
  if ("dmMuSposta" in d) {
    const lettura = musicaCheSuona(stati).find((uno) => uno.entita === d.dmMuSposta);
    suonaSugliEcho(
      chiamatePerSpostare(lettura, su, stati),
      t(
        "✓ Passata sugli Echo: tra un attimo la senti.",
        "✓ Moved to the Echos: you will hear it in a moment.",
      ),
    );
    return fatto();
  }
  if ("dmMuTasto" in d) {
    const chiamata = chiamataSulLettore(d.dmMuEchoDi, d.dmMuTasto);
    if (chiamata) chiamaServizio(chiamata);
    evento.preventDefault();
    return true;
  }
  if ("dmMuSuona" in d) {
    const chiamata = chiamataPerSuonare(
      { echo: su, servizio: musica.servizio, cosa: musica.cosa },
      stati,
    );
    if (!chiamata) {
      musica.esito = t("Scrivi cosa vuoi ascoltare.", "Write what you want to play.");
      return fatto();
    }
    suonaSugliEcho(
      [chiamata],
      t(
        "✓ Chiesto agli Echo: tra un attimo la senti.",
        "✓ Asked the Echos: you will hear it in a moment.",
      ),
    );
    return fatto();
  }
  if ("dmMuPreferito" in d) {
    const uno = config.musica[Number(d.dmMuPreferito)];
    const chiamata = uno && chiamataPerSuonare({ echo: su, ...uno }, stati);
    if (chiamata)
      suonaSugliEcho(
        [chiamata],
        t(
          "✓ Chiesto agli Echo: tra un attimo la senti.",
          "✓ Asked the Echos: you will hear it in a moment.",
        ),
      );
    return fatto();
  }
  if ("dmMuTieni" in d) {
    const uno = preferitoPulito({ servizio: musica.servizio, cosa: musica.cosa });
    if (uno) {
      salva({ musica: [...config.musica, uno] });
      root.edToast?.(t("☆ Nei preferiti", "☆ In favourites"));
    }
    return fatto();
  }
  if ("dmMuTogli" in d) {
    const indice = Number(d.dmMuTogli);
    salva({ musica: config.musica.filter((_uno, posto) => posto !== indice) });
    return fatto();
  }
  return false;
}

function corpoMarkup() {
  if (schedaAttiva() === ALEXA_AVVISI_TAB) return corpoDegliAvvisi();
  if (schedaAttiva() === ALEXA_MUSICA_TAB) return corpoDellaMusica();
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
      state.musica.esito = "";
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

/* Le tre linguette della sezione Alexa: le notifiche dette dagli Echo, gli
 * avvisi scritti da chi amministra e la musica. L'albero le mette nella famiglia «Alexa»
 * (`core/alberatura-del-config.js`). */
export function ensureAlexaEditorTab() {
  const linguette = doc?.querySelector(".ed-tab")?.parentElement;
  if (!linguette) return false;
  let fatte = false;
  for (const [id, nome] of [
    [ALEXA_EDITOR_TAB, `🔔 ${t("Notifiche", "Notifications")}`],
    [ALEXA_AVVISI_TAB, `📝 ${t("Avvisi personalizzati", "Custom announcements")}`],
    [ALEXA_MUSICA_TAB, `🎵 ${t("Musica", "Music")}`],
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
  if (suLaMusica(d, config, evento)) return;
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
  if (campo?.matches?.("#ed-body [data-dm-mu-cosa]")) {
    state.musica.cosa = String(campo.value || "").slice(0, CERCA_AL_PIU);
    return;
  }
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

/* Invio nel campo della musica vale come «Suona». */
function onKeydown(evento) {
  if (evento.key !== "Enter" || !evento.target?.matches?.("#ed-body [data-dm-mu-cosa]")) return;
  const tasto = doc?.querySelector?.("#ed-body [data-dm-mu-suona]");
  if (!tasto || tasto.disabled) return;
  evento.preventDefault();
  state.musica.cosa = String(evento.target.value || "").slice(0, CERCA_AL_PIU);
  tasto.click();
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
    #ed-body .dm-alexa-brano{flex-wrap:wrap;gap:10px 12px}
    #ed-body .dm-alexa-brano .mu-ed-testo{flex:1 1 150px;min-width:0}
    #ed-body .dm-alexa-brano .mu-ed-dx{margin-left:auto}
    #ed-body .dm-alexa-brano .mu-ed-testo b,#ed-body .dm-alexa-brano .mu-ed-testo small{
      display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #ed-body .dm-alexa-arte{flex:none;width:46px;height:46px;border-radius:10px;display:grid;place-items:center;
      font-size:20px;background:color-mix(in srgb,#0ea5e9 14%,transparent) center/cover no-repeat;
      box-shadow:inset 0 0 0 1px var(--divider-color,#dbe4ee)}
    #ed-body .dm-alexa-arte[style]{font-size:0}
    #ed-body .dm-alexa-comandi{display:flex;gap:6px;flex-wrap:nowrap}
    #ed-body .dm-alexa-comandi .dm-alexa-tasto{display:grid;place-items:center;width:40px;height:36px;padding:0}
    #ed-body .dm-alexa-comandi svg{width:17px;height:17px}
    #ed-body .dm-alexa-cerca{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    #ed-body .dm-alexa-cerca .ed-input{margin:0;flex:1 1 220px;min-width:0}
    #ed-body .dm-alexa-cerca .mu-ed-prova,#ed-body .dm-alexa-cerca .dm-alexa-tasto{flex:none}
    #ed-body .dm-alexa-servizi{margin-top:0}
    #ed-body .dm-alexa-esito{font-size:12px;font-weight:750;color:var(--text-dim,#64748b)}
    #ed-body .dm-alexa-preferito{display:inline-flex;align-items:center;gap:2px}
    #ed-body .dm-alexa-via-piccolo{border:0;background:none;color:var(--text-dim,#64748b);cursor:pointer;
      font:inherit;font-size:12px;padding:6px}
    #ed-body button[disabled]{opacity:.5;cursor:default}
    `,
  );
  doc.addEventListener("click", onClick);
  doc.addEventListener("change", onChange);
  doc.addEventListener("input", onInput);
  doc.addEventListener("keydown", onKeydown);
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
  for (const evento of ["dashboardmodern:state-changed", "dashboardmodern:states-ready"])
    root.addEventListener?.(evento, aggiornaDalVivo);
  ensureAlexaEditorTab();
  ensureAlexaEditor();
  return true;
}
