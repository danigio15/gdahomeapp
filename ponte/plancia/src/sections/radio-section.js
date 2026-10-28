/* La radio: un riquadro in cima alla pagina Musica, e una scheda nel Config.
 *
 * «Voglio una integrazione radio che parte se è configurata la Musica, e la
 * possibilità di integrarla in Alexa.» Il riquadro compare nella pagina
 * Musica — che c'e' solo con dei lettori configurati — con le radio
 * preferite: si sceglie dove suonarle (un lettore di casa o un Echo) e si
 * tocca la radio. Le preferite si scelgono nel Config, Musica › «📻 Radio»,
 * fra le stazioni dell'integrazione Radio Browser di Home Assistant.
 *
 * Le regole stanno in `core/radio.js`: cosa si salva, come si chiede la
 * lista delle stazioni, come si suona su un lettore e come su un Echo.
 * Suonare e' una chiamata a Home Assistant, come i tasti della pagina Musica.
 */
import {
  CHIAVE_RADIO,
  POSTI_RADIO,
  RADIO_AL_PIU,
  RADIO_DEL_PAESE,
  RADIO_PRONTE,
  chiamataDellaRadio,
  chiamataPerFermare,
  domandaDelleRadio,
  filtraLeStazioni,
  normalizzaRadio,
  stazioneDalNome,
  stazionePulita,
  stazioniDellaRisposta,
} from "../core/radio.js";
import { eUnEcho } from "../core/alexa-musica.js";
import { CHIAVE_ALEXA, normalizzaAlexa } from "../core/alexa-annunci.js";
import { lettoriConfigurati } from "../core/media-player.js";
import { CHIAVE_MEDIA, PAGINA_MEDIA } from "./media-player-section.js";
import { ensureTitoloDellaSezione, riordinaLeLinguette } from "./alberatura-del-config-section.js";
import { logoDellaRadioMarkup, mettiILoghiDelleRadio } from "./loghi-delle-radio.js";
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

const KEY = "__DASHBOARDMODERN_RADIO__";
const DOVE = "dm_radio_dove";
const state = (root[KEY] ||= {
  installato: false,
  firma: "",
  esito: "",
  posto: POSTI_RADIO[0],
  risultati: {},
  chiedendo: "",
  guaio: "",
  filtro: "",
  perNome: "",
  scritto: "",
  /* Le radio italiane di Radio Browser, chieste una volta: servono alle radio
   * pronte sui lettori che non sono Echo. */
  delPaese: null,
  paeseChiesto: false,
  /* L'elenco delle radio pronte, aperto o chiuso. */
  tendina: false,
});

export const RADIO_TAB = "media_radio";

const configurazione = () => normalizzaRadio(readJson(CHIAVE_RADIO, null));

/* Le radio della pagina Musica: le preferite della Radio, e anche quelle
 * tenute fra i preferiti di Alexa › Musica con TuneIn — chi le ha salvate
 * li' le cerca qui per cambiarle, e prima qui non c'erano. Quelle di Alexa
 * hanno solo il nome: suonano sugli Echo. */
function leRadioDiCasa() {
  const viste = new Set();
  const tutte = [];
  const tieni = (una) => {
    const chiave = una?.nome?.toLowerCase();
    if (!chiave || viste.has(chiave)) return;
    viste.add(chiave);
    tutte.push(una);
  };
  for (const una of configurazione().preferite) tieni(una);
  for (const uno of normalizzaAlexa(readJson(CHIAVE_ALEXA, null)).musica)
    if (uno.servizio === "TUNEIN") tieni(stazionePulita({ nome: uno.cosa }));
  return tutte;
}

function salva(preferite) {
  writeJsonIfChanged(CHIAVE_RADIO, normalizzaRadio({ preferite }));
  try {
    root.cdMarkDirty?.();
    root.cdSyncPush?.();
  } catch (_errore) {}
}

/* ── dove suonare ─────────────────────────────────────────────────────── */

/* I lettori della pagina Musica e gli Echo di casa, ognuno una volta. */
function iLettori(stati = allStates() || {}) {
  const visti = new Set();
  const tutti = [];
  for (const riga of lettoriConfigurati(readJson(CHIAVE_MEDIA, []))) {
    if (visti.has(riga.entity)) continue;
    visti.add(riga.entity);
    const stato = stati[riga.entity];
    tutti.push({
      entita: riga.entity,
      nome: riga.nome || clean(stato?.attributes?.friendly_name) || riga.entity,
      echo: eUnEcho({ entity_id: riga.entity, ...stato }),
    });
  }
  /* Gli Echo: quelli scelti in Alexa › Musica, se se ne e' scelto qualcuno
   * («anche se selezioni gli Alexa nella scheda musica te li da' tutti»);
   * senza una scelta, tutti quelli di casa. */
  const scelti = echoScelti();
  for (const stato of Object.values(stati)) {
    if (!eUnEcho(stato) || visti.has(stato.entity_id)) continue;
    if (scelti.size && !scelti.has(stato.entity_id)) continue;
    visti.add(stato.entity_id);
    tutti.push({
      entita: stato.entity_id,
      nome: clean(stato.attributes?.friendly_name) || stato.entity_id,
      echo: true,
    });
  }
  return tutti;
}

/* La scelta degli Echo di Alexa › Musica, su questo schermo
 * (`dm_alexa_musica_echo`, vedi `alexa-editor-section.js`). */
const ECHO_DELLA_MUSICA = "dm_alexa_musica_echo";

function echoScelti() {
  try {
    const scritti = JSON.parse(root.localStorage?.getItem(ECHO_DELLA_MUSICA) || "[]");
    return new Set(Array.isArray(scritti) ? scritti.map(String) : []);
  } catch (_errore) {
    return new Set();
  }
}

function doveSuona(lettori) {
  let scelto = "";
  try {
    scelto = clean(root.localStorage?.getItem(DOVE));
  } catch (_errore) {
    scelto = "";
  }
  return lettori.find((uno) => uno.entita === scelto) || lettori[0] || null;
}

function ricordaDove(entita) {
  try {
    root.localStorage?.setItem(DOVE, entita);
  } catch (_errore) {
    /* Senza memoria vale finche' la pagina e' aperta. */
  }
}

/* Quale preferita suona adesso su quel lettore: lo dice il suo stato. */
function inOnda(stazione, lettore, stati) {
  const stato = stati[lettore?.entita];
  if (!stato || stato.state !== "playing") return false;
  const a = stato.attributes || {};
  if (stazione.id && clean(a.media_content_id) === stazione.id) return true;
  const nome = stazione.nome.toLowerCase();
  return [a.media_title, a.media_channel, a.media_artist].some(
    (valore) => clean(valore).toLowerCase() === nome,
  );
}

/* ── il riquadro nella pagina Musica ──────────────────────────────────── */

function logoMarkup(stazione, classe) {
  return logoDellaRadioMarkup(clean(stazione.logo), classe);
}

function riquadroMarkup() {
  const stati = allStates() || {};
  const preferite = leRadioDiCasa();
  const lettori = iLettori(stati);
  const dove = doveSuona(lettori);
  const testa = `<div class="dm-radio-testa">
      <span class="dm-radio-ic" aria-hidden="true">📻</span>
      <div><b>${esc(t("Radio", "Radio"))}</b><small>${esc(
        preferite.length
          ? `${preferite.length} ${t("preferite", "favourites")}`
          : `${RADIO_PRONTE.length} ${t("radio pronte da ascoltare", "stations ready to play")}`,
      )}</small></div>
    </div>`;
  const lettoriMarkup = lettori
    .map(
      (uno) =>
        `<button type="button" class="dm-radio-pa" aria-pressed="${uno.entita === dove?.entita}" data-dm-radio-dove="${esc(uno.entita)}">${uno.echo ? "🔊" : "🎵"} ${esc(uno.nome)}</button>`,
    )
    .join("");
  const stazioni = preferite
    .map((una, indice) => {
      const suona = dove && chiamataDellaRadio(una, dove.entita, { echo: dove.echo });
      const onda = dove && inOnda(una, dove, stati);
      return `<button type="button" class="dm-radio-st${onda ? " in-onda" : ""}" data-dm-radio-suona="${indice}"${
        suona ? "" : ` aria-disabled="true"`
      }>
        ${logoMarkup(una, "dm-radio-logo")}
        <b>${esc(una.nome)}</b>
        <small>${esc(
          onda
            ? t("In onda", "On air")
            : una.id
              ? t("Tocca per ascoltare", "Tap to listen")
              : t("Solo sugli Echo", "Echos only"),
        )}</small>
      </button>`;
    })
    .join("");
  /* Le radio pronte: un tasto che si apre in una griglia di tessere, ognuna
   * col suo bollino. Si ascoltano subito, senza averle scelte nel Config. */
  const aperte = state.tendina === true;
  if (aperte) chiediLeRadioDelPaese();
  const pronte = `<div class="dm-radio-pronte${aperte ? " aperte" : ""}">
      <button type="button" class="dm-radio-pronte-apri" data-dm-radio-tendina aria-expanded="${aperte}"${dove ? "" : " disabled"}>
        <span class="dm-radio-pronte-ic" aria-hidden="true">🇮🇹</span>
        <span class="dm-radio-pronte-tx"><b>${esc(t("Radio italiane", "Italian stations"))}</b><small>${esc(
          aperte
            ? t("Tocca una radio per ascoltarla", "Tap a station to listen")
            : `${RADIO_PRONTE.length} ${t("pronte · tocca per scegliere", "ready · tap to choose")}`,
        )}</small></span>
        <i aria-hidden="true">${aperte ? "▴" : "▾"}</i>
      </button>
      ${
        aperte
          ? `<div class="dm-radio-pronte-elenco">${RADIO_PRONTE.map((una, indice) => {
              const onda = dove && inOnda(una, dove, stati);
              /* Il logo vero, se Radio Browser ne ha uno per questa radio: si
               * mette solo quando arriva, e fino ad allora — o se non c'e' —
               * resta il bollino con la sigla. */
              const logo = stazioneDalNome(state.delPaese || [], una.nome)?.logo || "";
              return `<button type="button" class="dm-radio-pr${onda ? " in-onda" : ""}" data-dm-radio-pronta="${indice}" style="--pr:${esc(una.colore)}">
                ${logoDellaRadioMarkup(logo, "dm-radio-pr-sigla", { dentro: esc(una.sigla) })}
                <b>${esc(una.nome)}</b>
                ${onda ? `<i class="dm-radio-pr-onda" role="img" aria-label="${esc(t("In onda", "On air"))}"></i>` : ""}
              </button>`;
            }).join("")}</div>`
          : ""
      }
    </div>`;
  return `${testa}
    <div class="dm-radio-dove"><span>${esc(t("Suona su", "Play on"))}</span><div class="dm-radio-fila">${lettoriMarkup}</div></div>
    ${pronte}
    ${
      stazioni
        ? `<div class="dm-radio-griglia">${stazioni}</div>`
        : `<p class="dm-radio-vuoto">${esc(
            t(
              "Le tue preferite, coi loghi, si scelgono in Config › Musica › 📻 Radio.",
              "Your favourites, with their logos, are chosen in Config › Media › 📻 Radio.",
            ),
          )}</p>`
    }
    <div class="dm-radio-piede">
      <button type="button" class="dm-radio-ferma" data-dm-radio-ferma${dove ? "" : " disabled"}>⏹ ${esc(t("Ferma", "Stop"))}</button>
      ${state.esito ? `<small>${esc(state.esito)}</small>` : ""}
    </div>`;
}

/** Il riquadro, in cima alla pagina Musica; solo se la pagina c'e'. */
export function ridisegnaLaRadio() {
  const pagina = doc?.getElementById?.(PAGINA_MEDIA);
  if (!pagina) return false;
  let riquadro = pagina.querySelector("[data-dm-radio]");
  if (!riquadro) {
    riquadro = doc.createElement("section");
    riquadro.className = "dm-radio";
    riquadro.dataset.dmRadio = "";
    pagina.prepend(riquadro);
  }
  const markup = riquadroMarkup();
  if (markup === state.firma && riquadro.firstChild) return true;
  state.firma = markup;
  riquadro.innerHTML = markup;
  mettiILoghiDelleRadio(riquadro);
  return true;
}

function sulRiquadro(evento) {
  const tasto = evento.target?.closest?.("[data-dm-radio] button");
  if (!tasto) return false;
  const d = tasto.dataset;
  const lettori = iLettori();
  if ("dmRadioDove" in d) {
    ricordaDove(clean(d.dmRadioDove));
    state.esito = "";
  } else if ("dmRadioSuona" in d) {
    const una = leRadioDiCasa()[Number(d.dmRadioSuona)];
    const dove = doveSuona(lettori);
    const chiamata = una && dove && chiamataDellaRadio(una, dove.entita, { echo: dove.echo });
    if (!chiamata)
      state.esito = t(
        "Questa radio si ascolta solo sugli Echo: scegli un Echo.",
        "This station plays on the Echos only: choose an Echo.",
      );
    else {
      chiamaServizio(chiamata);
      root.navigator?.vibrate?.(8);
      state.esito = `▶ ${una.nome} · ${dove.nome}`;
    }
  } else if ("dmRadioTendina" in d) {
    state.tendina = !state.tendina;
  } else if ("dmRadioPronta" in d) {
    const una = RADIO_PRONTE[Number(d.dmRadioPronta)];
    state.tendina = false;
    if (una) suonaUnaPronta(una.nome);
  } else if ("dmRadioFerma" in d) {
    const dove = doveSuona(lettori);
    const chiamata = dove && chiamataPerFermare(dove.entita);
    if (chiamata) chiamaServizio(chiamata);
    state.esito = "";
  } else return false;
  evento.preventDefault();
  state.firma = "";
  ridisegnaLaRadio();
  return true;
}

/* Le radio italiane di Radio Browser, una volta sola: servono a suonare le
 * pronte sui lettori che non sono Echo, e ai loro loghi. Senza
 * l'integrazione la risposta non arriva, e restano i bollini. */
function chiediLeRadioDelPaese() {
  if (state.delPaese || state.paeseChiesto) return;
  state.paeseChiesto = true;
  chiediAHomeAssistant(domandaDelleRadio(RADIO_DEL_PAESE), 15000)
    .then((risposta) => {
      state.delPaese = stazioniDellaRisposta(risposta);
      state.firma = "";
      ridisegnaLaRadio();
    })
    .catch(() => {
      /* Niente Radio Browser: i bollini bastano. */
    });
}

/* Una radio pronta, scelta dal menu: sull'Echo per nome, a TuneIn; su un
 * altro lettore la stessa radio presa fra quelle italiane di Radio Browser. */
async function suonaUnaPronta(nome) {
  const dove = doveSuona(iLettori());
  if (!dove || !nome) return;
  let stazione = { nome };
  if (!dove.echo) {
    try {
      if (!state.delPaese)
        state.delPaese = stazioniDellaRisposta(
          await chiediAHomeAssistant(domandaDelleRadio(RADIO_DEL_PAESE), 15000),
        );
    } catch (_errore) {
      state.delPaese = null;
    }
    stazione = stazioneDalNome(state.delPaese || [], nome);
  }
  const chiamata = stazione && chiamataDellaRadio(stazione, dove.entita, { echo: dove.echo });
  if (chiamata) {
    chiamaServizio(chiamata);
    root.navigator?.vibrate?.(8);
    state.esito = `▶ ${nome} · ${dove.nome}`;
  } else
    state.esito = state.delPaese
      ? t(
          "Questa radio su questo lettore non la trovo: prova un Echo, o aggiungila dal Config.",
          "Can't find this station for this player: try an Echo, or add it from the Config.",
        )
      : t(
          "Per i lettori che non sono Echo serve l'integrazione Radio Browser di Home Assistant.",
          "Players that aren't Echos need Home Assistant's Radio Browser integration.",
        );
  state.firma = "";
  ridisegnaLaRadio();
}

/* ── la scheda nel Config: Musica › 📻 Radio ──────────────────────────── */

const schedaAttiva = () => clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);

async function chiediLeRadio(posto) {
  if (state.chiedendo === posto || state.risultati[posto]) return;
  state.chiedendo = posto;
  state.guaio = "";
  try {
    const risposta = await chiediAHomeAssistant(domandaDelleRadio(posto), 15000);
    state.risultati[posto] = stazioniDellaRisposta(risposta);
  } catch (errore) {
    state.guaio = clean(errore?.message) || "errore";
  } finally {
    state.chiedendo = "";
    ridisegnaLaScheda();
  }
}

function riga(titolo, sotto, destra = "") {
  return `<div class="mu-ed-riga"><div class="mu-ed-testo"><b>${titolo}</b>${sotto ? `<small>${sotto}</small>` : ""}</div>${
    destra ? `<div class="mu-ed-dx">${destra}</div>` : ""
  }</div>`;
}

function schedaMarkup() {
  const { preferite } = configurazione();
  const echo = Object.values(allStates() || {}).some(eUnEcho);
  const tenute = new Set(preferite.map((una) => una.id).filter(Boolean));
  const piene = preferite.length >= RADIO_AL_PIU;
  const elenco = preferite.length
    ? preferite
        .map(
          (una, indice) => `<div class="mu-ed-riga dm-radio-ed-st">
          ${logoMarkup(una, "dm-radio-ed-logo")}
          <div class="mu-ed-testo"><b>${esc(una.nome)}</b><small>${esc(
            una.id
              ? t("Lettori di casa ed Echo", "Home players and Echos")
              : t("Solo sugli Echo (TuneIn)", "Echos only (TuneIn)"),
          )}</small></div>
          <div class="mu-ed-dx"><button type="button" class="dm-radio-ed-via" data-dm-radio-togli="${indice}" aria-label="${esc(
            t("Togli", "Remove"),
          )}">✕</button></div>
        </div>`,
        )
        .join("")
    : riga(
        esc(t("Nessuna radio preferita", "No favourite station")),
        esc(
          t(
            "Scegline qui sotto: compaiono nella pagina Musica.",
            "Pick some below: they show up on the Media page.",
          ),
        ),
      );
  const posti = [
    ["local", t("Vicino a te", "Near you")],
    ["popular", t("Più ascoltate", "Most listened")],
  ];
  const trovate = state.risultati[state.posto];
  let risultati;
  if (state.guaio)
    risultati = riga(
      esc(t("Le radio di Home Assistant non rispondono", "Home Assistant radio is not answering")),
      esc(
        t(
          "Aggiungi l'integrazione «Radio Browser» in Home Assistant (Impostazioni › Dispositivi e servizi › Aggiungi integrazione): è gratuita e porta migliaia di radio.",
          "Add the «Radio Browser» integration in Home Assistant (Settings › Devices & services › Add integration): it is free and brings thousands of stations.",
        ),
      ),
    );
  else if (!trovate) risultati = riga(esc(t("Cerco le radio…", "Looking for stations…")), "");
  else {
    const filtrate = filtraLeStazioni(trovate, state.filtro);
    risultati = filtrate.length
      ? `<div class="dm-radio-ed-trovate">${filtrate
          .slice(0, 60)
          .map((una) => {
            const gia = tenute.has(una.id);
            return `<button type="button" class="dm-radio-ed-trovata" data-dm-radio-aggiungi="${esc(una.id)}"${
              gia || piene ? " disabled" : ""
            }>${logoMarkup(una, "dm-radio-ed-logo")}<span>${esc(una.nome)}</span><i>${gia ? "✓" : "＋"}</i></button>`;
          })
          .join("")}</div>`
      : riga(esc(t("Nessuna radio con questo nome", "No station with this name")), "");
  }
  return `<div class="mu-ed dm-radio-ed" data-dm-radio-ed>
    <div class="mu-ed-blocco">
      ${riga(
        esc(t("Le radio preferite", "Favourite stations")),
        esc(
          t(
            "Compaiono in cima alla pagina Musica: si ascoltano su un lettore di casa o sugli Echo.",
            "They show at the top of the Media page: play them on a home player or on the Echos.",
          ),
        ),
      )}
      ${elenco}
    </div>
    <div class="mu-ed-blocco">
      ${riga(
        esc(t("Aggiungi una radio", "Add a station")),
        esc(
          t(
            "Dalle radio di Home Assistant (Radio Browser).",
            "From Home Assistant radio (Radio Browser).",
          ),
        ),
      )}
      <div class="mu-ed-riga dm-radio-ed-cerca">
        <div class="mu-ed-seg">${posti
          .map(
            ([id, nome]) =>
              `<button type="button" class="${state.posto === id ? "si" : ""}" data-dm-radio-posto="${id}">${esc(nome)}</button>`,
          )
          .join("")}</div>
        <input class="ed-input" data-dm-radio-filtro value="${esc(state.filtro)}" placeholder="${esc(
          t("Filtra per nome…", "Filter by name…"),
        )}" autocomplete="off">
      </div>
      ${risultati}
    </div>
    ${
      echo
        ? `<div class="mu-ed-blocco">
      ${riga(
        esc(t("Solo per gli Echo", "For the Echos only")),
        esc(
          t(
            "Una radio che non c'è nell'elenco: scrivi il nome come lo diresti ad Alexa, gli Echo la cercano su TuneIn.",
            "A station not in the list: write the name as you would say it to Alexa, the Echos look it up on TuneIn.",
          ),
        ),
      )}
      <div class="mu-ed-riga dm-radio-ed-cerca">
        <input class="ed-input" data-dm-radio-nome value="${esc(state.perNome)}" maxlength="80" placeholder="Radio Deejay">
        <button type="button" class="mu-ed-prova" data-dm-radio-per-nome${piene ? " disabled" : ""}>＋ ${esc(t("Aggiungi", "Add"))}</button>
      </div>
    </div>`
        : ""
    }
  </div>`;
}

export function ridisegnaLaScheda() {
  const corpo = doc?.getElementById?.("ed-body");
  if (!corpo || schedaAttiva() !== RADIO_TAB) return false;
  void chiediLeRadio(state.posto);
  const markup = schedaMarkup();
  if (state.scritto === markup && corpo.querySelector("[data-dm-radio-ed]")) return true;
  state.scritto = markup;
  const fuoco = doc.activeElement?.matches?.("[data-dm-radio-filtro],[data-dm-radio-nome]")
    ? doc.activeElement.matches("[data-dm-radio-filtro]")
      ? "[data-dm-radio-filtro]"
      : "[data-dm-radio-nome]"
    : "";
  corpo.innerHTML = markup;
  corpo.dataset.renderer = RADIO_TAB;
  mettiILoghiDelleRadio(corpo);
  ensureTitoloDellaSezione();
  if (fuoco) {
    const campo = corpo.querySelector(fuoco);
    campo?.focus?.();
    campo?.setSelectionRange?.(campo.value.length, campo.value.length);
  }
  return true;
}

export function ensureRadioTab() {
  const linguette = doc?.querySelector(".ed-tab")?.parentElement;
  if (!linguette || linguette.querySelector(`.ed-tab[data-tab="${RADIO_TAB}"]`)) return false;
  const linguetta = doc.createElement("button");
  linguetta.className = "ed-tab";
  linguetta.dataset.tab = RADIO_TAB;
  linguetta.textContent = `📻 ${t("Radio", "Radio")}`;
  linguetta.addEventListener("click", () => root.editorSwitch?.(RADIO_TAB));
  const dopo = linguette.querySelector('.ed-tab[data-tab="media"]');
  if (dopo) dopo.after(linguetta);
  else linguette.append(linguetta);
  riordinaLeLinguette();
  return true;
}

function sullaScheda(evento) {
  const corpo = doc?.getElementById?.("ed-body");
  if (!corpo || schedaAttiva() !== RADIO_TAB || !corpo.contains(evento.target)) return false;
  const tasto = evento.target?.closest?.("button");
  if (!tasto) return false;
  const d = tasto.dataset;
  const { preferite } = configurazione();
  if ("dmRadioPosto" in d) {
    state.posto = POSTI_RADIO.includes(d.dmRadioPosto) ? d.dmRadioPosto : POSTI_RADIO[0];
    state.guaio = "";
  } else if ("dmRadioAggiungi" in d) {
    const trovata = (state.risultati[state.posto] || []).find(
      (una) => una.id === d.dmRadioAggiungi,
    );
    if (trovata) {
      salva([...preferite, trovata]);
      root.edToast?.(`📻 ${trovata.nome} ${t("fra le preferite", "in favourites")}`);
    }
  } else if ("dmRadioTogli" in d) {
    const indice = Number(d.dmRadioTogli);
    salva(preferite.filter((_una, posto) => posto !== indice));
  } else if ("dmRadioPerNome" in d) {
    const una = stazionePulita({ nome: state.perNome });
    if (una) {
      salva([...preferite, una]);
      state.perNome = "";
    }
  } else return false;
  evento.preventDefault();
  state.scritto = "";
  state.firma = "";
  ridisegnaLaScheda();
  return true;
}

function suUnClic(evento) {
  /* Si apre la pagina Musica: le preferite possono essere cambiate nel
   * Config un momento fa, e nessuno stato di casa e' cambiato per dirlo. */
  if (evento.target?.closest?.(`.tab[data-tab="media"]`)) root.queueMicrotask?.(ridisegnaLaRadio);
  if (sulRiquadro(evento)) return;
  sullaScheda(evento);
}

function suUnaParola(evento) {
  const campo = evento.target;
  if (campo?.matches?.("#ed-body [data-dm-radio-filtro]")) {
    state.filtro = String(campo.value || "").slice(0, 60);
    ridisegnaLaScheda();
  } else if (campo?.matches?.("#ed-body [data-dm-radio-nome]"))
    state.perNome = String(campo.value || "").slice(0, 80);
}

function stili() {
  installStyle(
    "dm-radio-style",
    `
    #${PAGINA_MEDIA} .dm-radio{display:grid;gap:12px;margin:0 4px 14px;padding:16px;border-radius:24px;
      background:var(--card-background-color,#fff);border:1px solid var(--card-border,#e2e8f0);
      box-shadow:0 18px 40px -30px rgba(2,6,23,.55)}
    .dm-radio-testa{display:flex;align-items:center;gap:12px}
    .dm-radio-ic{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;font-size:22px;
      background:linear-gradient(135deg,rgba(139,92,246,.18),rgba(236,72,153,.18))}
    .dm-radio-testa b{display:block;font-size:16px;font-weight:850;color:var(--text,#0f172a)}
    .dm-radio-testa small{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}
    .dm-radio-vuoto{margin:0;font-size:13px;line-height:1.45;color:var(--text-dim,#64748b)}
    .dm-radio-dove{display:grid;gap:6px}
    .dm-radio-dove>span{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;
      color:var(--text-dim,#64748b)}
    .dm-radio-pronte{display:grid;gap:10px;border-radius:18px;padding:4px;
      background:linear-gradient(135deg,rgba(0,146,70,.07),rgba(255,255,255,0) 45%,rgba(206,43,55,.07));
      border:1px solid color-mix(in srgb,#8b5cf6 22%,var(--card-border,#e2e8f0))}
    .dm-radio-pronte-apri{display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;border:0;
      border-radius:14px;background:none;font:inherit;text-align:left;cursor:pointer;color:var(--text,#0f172a)}
    .dm-radio-pronte-apri:disabled{opacity:.55;cursor:default}
    .dm-radio-pronte-ic{flex:none;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;
      font-size:20px;background:var(--card-background-color,#fff);box-shadow:0 6px 16px -10px rgba(2,6,23,.5)}
    .dm-radio-pronte-tx{flex:1 1 auto;min-width:0}
    .dm-radio-pronte-tx b{display:block;font-size:15px;font-weight:850}
    .dm-radio-pronte-tx small{display:block;font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}
    .dm-radio-pronte-apri i{flex:none;width:30px;height:30px;border-radius:999px;display:grid;place-items:center;
      font-style:normal;font-size:14px;font-weight:900;color:#7c3aed;
      background:color-mix(in srgb,#8b5cf6 14%,transparent)}
    .dm-radio-pronte-elenco{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;
      padding:0 6px 8px;max-height:min(58vh,520px);overflow:auto}
    @media (min-width:640px){.dm-radio-pronte-elenco{grid-template-columns:repeat(auto-fill,minmax(170px,1fr))}}
    .dm-radio-pr{display:flex;align-items:center;gap:8px;min-width:0;padding:7px 8px 7px 7px;border-radius:14px;
      font:inherit;text-align:left;cursor:pointer;color:var(--text,#0f172a);
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-background-color,#fff);
      transition:transform .12s ease,box-shadow .12s ease}
    .dm-radio-pr:active{transform:scale(.97)}
    .dm-radio-pr-sigla{flex:none;width:36px;height:36px;border-radius:11px;display:grid;place-items:center;
      font-size:12px;font-weight:900;letter-spacing:-.02em;color:#fff;background:var(--pr);
      box-shadow:0 8px 16px -10px var(--pr)}
    .dm-radio-pr-sigla[style]{font-size:0;background:#fff center/contain no-repeat;
      box-shadow:0 0 0 1px var(--card-border,#e2e8f0)}
    .dm-radio-pr b{flex:1 1 auto;min-width:0;font-size:13px;font-weight:800;line-height:1.2;
      overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .dm-radio-pr-onda{flex:none;width:10px;height:10px;border-radius:999px;background:#8b5cf6;
      box-shadow:0 0 0 4px color-mix(in srgb,#8b5cf6 22%,transparent)}
    .dm-radio-pr.in-onda{border-color:#8b5cf6;box-shadow:inset 0 0 0 1px #8b5cf699;
      background:color-mix(in srgb,#8b5cf6 10%,var(--card-background-color,#fff))}
    html[data-theme="dark"] .dm-radio-pronte-apri i{color:#c4b5fd}
    .dm-radio-fila{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
    .dm-radio-fila::-webkit-scrollbar{display:none}
    .dm-radio-pa{flex:none;padding:8px 13px;border-radius:999px;font:inherit;font-size:13px;font-weight:800;
      cursor:pointer;color:var(--text,#0f172a);border:1px solid var(--card-border,#e2e8f0);
      background:var(--card-background-color,#fff);white-space:nowrap}
    .dm-radio-pa[aria-pressed="true"]{color:#7c3aed;border-color:#8b5cf6;
      background:color-mix(in srgb,#8b5cf6 12%,transparent);box-shadow:inset 0 0 0 1px #8b5cf699}
    html[data-theme="dark"] .dm-radio-pa[aria-pressed="true"]{color:#c4b5fd}
    .dm-radio-griglia{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px}
    .dm-radio-st{display:grid;justify-items:center;gap:6px;padding:12px 8px;border-radius:18px;cursor:pointer;
      font:inherit;color:var(--text,#0f172a);text-align:center;
      border:1px solid var(--card-border,#e2e8f0);background:var(--bg-sculpted,#f8fafc)}
    .dm-radio-st b{font-size:13px;font-weight:850;line-height:1.2;max-width:100%;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dm-radio-st small{font-size:11px;font-weight:700;color:var(--text-dim,#64748b)}
    .dm-radio-st[aria-disabled="true"]{opacity:.5}
    .dm-radio-st.in-onda{border-color:#8b5cf6;box-shadow:inset 0 0 0 1px #8b5cf6;
      background:color-mix(in srgb,#8b5cf6 10%,var(--card-background-color,#fff))}
    .dm-radio-st.in-onda small{color:#7c3aed}
    .dm-radio-logo{width:56px;height:56px;border-radius:14px;display:grid;place-items:center;font-size:26px;
      background:#fff center/contain no-repeat;box-shadow:0 0 0 1px var(--card-border,#e2e8f0)}
    .dm-radio-logo[style],.dm-radio-ed-logo[style]{font-size:0}
    .dm-radio-piede{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .dm-radio-piede small{font-size:12.5px;font-weight:750;color:var(--text-dim,#64748b)}
    .dm-radio-ferma{padding:8px 14px;border-radius:12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;
      color:var(--text,#0f172a);border:1px solid var(--card-border,#e2e8f0);background:transparent}
    #ed-body .dm-radio-ed-st{flex-wrap:nowrap;gap:12px}
    #ed-body .dm-radio-ed-st .mu-ed-testo{flex:1 1 0;min-width:0}
    #ed-body .dm-radio-ed-logo{flex:0 0 40px;width:40px;max-width:40px;height:40px;padding:0;margin:0;border:0;
      border-radius:10px;display:grid;place-items:center;
      font-size:20px;background:#fff center/contain no-repeat;box-shadow:0 0 0 1px var(--divider-color,#dbe4ee)}
    #ed-body .dm-radio-ed-logo[style]{font-size:0}
    #ed-body .dm-radio-ed-via{border:0;background:none;cursor:pointer;font:inherit;font-size:14px;padding:8px;
      color:var(--text-dim,#64748b)}
    #ed-body .dm-radio-ed-cerca{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    #ed-body .dm-radio-ed-cerca .ed-input{margin:0;flex:1 1 200px;min-width:0}
    #ed-body .dm-radio-ed-trovate{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px;
      max-height:420px;overflow:auto;padding:2px}
    #ed-body .dm-radio-ed-trovata{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:14px;
      cursor:pointer;font:inherit;text-align:left;color:inherit;
      border:1px solid var(--divider-color,#dbe4ee);background:var(--card-background-color,var(--card-bg,#fff))}
    #ed-body .dm-radio-ed-trovata span{flex:1 1 auto;min-width:0;font-size:13px;font-weight:750;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #ed-body .dm-radio-ed-trovata i{font-style:normal;font-weight:900;color:#7c3aed}
    #ed-body .dm-radio-ed-trovata[disabled]{opacity:.55;cursor:default}
    `,
  );
}

export function installaLaRadio() {
  if (!doc || state.installato) return false;
  state.installato = true;
  stili();
  doc.addEventListener("click", suUnClic);
  doc.addEventListener("input", suUnaParola);
  const tutto = () => {
    ridisegnaLaRadio();
    ensureRadioTab();
    ridisegnaLaScheda();
  };
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:states-ready",
    "dashboardmodern:state-changed",
    "dashboardmodern:editor-rendered",
    "dashboardmodern:persistence-restored",
  ])
    root.addEventListener?.(evento, tutto);
  wrapFunction("apriConfigEntita", "__dmRadio", () => {
    ensureRadioTab();
    ridisegnaLaScheda();
  });
  onEditorRedraw("__dmRadio", () => root.queueMicrotask?.(tutto));
  tutto();
  return true;
}
