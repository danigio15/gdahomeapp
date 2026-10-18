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
  AREE_AL_MASSIMO,
  CANALI_PER_GRUPPO,
  CHIAVE_MURO,
  COMANDI_DELL_INGRESSO_AL_MASSIMO,
  LETTURE_DELL_INGRESSO_AL_MASSIMO,
  COLORI_DELLE_PAGINE,
  GRUPPI_AL_MASSIMO,
  PRESET_AL_MASSIMO,
  PULSANTI_AL_MASSIMO,
  coloreDelGruppo,
  GRIGLIE,
  MINUTI_DI_RIPOSO,
  PAGINE_AL_MASSIMO,
  MODELLI_ELENCO,
  ambientiDellaFonte,
  comandiDellaPagina,
  ALTRE_MISURE_AL_MASSIMO,
  energiaDellaPagina,
  entitaDelMeteoDelMuro,
  LETTORI_AL_MASSIMO,
  lettoriDellaPagina,
  postiDellaPagina,
  telecamereDellaFonte,
  comandiProposti,
  comandoPulito,
  eUnaScena,
  tipoDellEntita,
  muroPulito,
  nomeDellaPersonaDelMuro,
  nuovaPagina,
  eNotteAllOra,
  notteDellaGiornata,
  PASSAGGI_DI_ESEMPIO,
  SECONDI_PER_ABBASSARE,
  giornataDellaLuce,
} from "../core/plancia-a-muro.js";
import { CHIAVI_OGGETTI, oggettoWidget } from "../core/oggetti-widget.js";
import { ensureTitoloDellaSezione, riordinaLeLinguette } from "./alberatura-del-config-section.js";
import { bridgeRequest, currentProfile } from "./config-persistence-section.js";
import {
  EVENTO_PREVISIONI,
  anteprimaDellaPagina,
  facciaDelPosto,
  fonteDelMuro,
  premiumDellaCasa,
} from "./plancia-a-muro-section.js";
import {
  DOMINI_DEL_CAMPANELLO,
  opzioniDelCampanello,
  tipoDelCampanello,
} from "../core/il-campanello-a-muro.js";
import { suonaIlCampanello } from "./il-suono-del-campanello.js";
import { EVENTO_IMMAGINE, bloccoImmagineMarkup } from "./riquadri-con-immagine-section.js";
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
  /* Quale pagina e' aperta nel config: una alla volta, le altre stanno
   * chiuse in una riga. */
  aperta: 0,
  /* «Altre impostazioni» aperte o chiuse. */
  altro: false,
});

export const MURO_EDITOR_TAB = "muro";

const schedaAttiva = () => clean(doc?.querySelector?.(".ed-tab.active")?.dataset?.tab);
const bozza = () => (state.bozza ||= muroPulito(readJson(CHIAVE_MURO, null)));
const salvato = () => muroPulito(readJson(CHIAVE_MURO, null));
/* La bozza e' diversa da quello che il tablet legge? */
const bozzaSporca = () =>
  Boolean(state.bozza) && JSON.stringify(muroPulito(state.bozza)) !== JSON.stringify(salvato());
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
/* «Il sensore sta: In casa / Fuori.» «Devi far decidere se e' esterno o
 * interno»: la parola accanto al numero la sceglie chi configura, e non la
 * indovina il tablet dalla stanza. Si vede quando un sensore c'e' da scegliere:
 * con «Da un sensore», o nella riga «Temperatura sul riposo». */
const dovesta = (m) =>
  riga(
    t("Il sensore sta", "The sensor is"),
    t("Cosa scrivere accanto al numero", "What to write next to the number"),
    scelte("riposo.dove", m.riposo.dove || "casa", [
      ["casa", t("In casa", "Indoors")],
      ["fuori", t("Fuori", "Outside")],
    ]),
  );
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

/* Il campanello: quale entita' lo dice. «Cosa si aspetta di entita'?» La
 * risposta sta scritta sotto il campo, e la ricerca propone per primi gli
 * eventi del citofono e i sensori che si chiamano campanello. Un'entita' che
 * non sa fare da campanello (un sensore qualunque) lo dice subito, invece di
 * lasciare il tablet muto il giorno che suonano. */
function rigaDelCampanello(via, ing) {
  const id = clean(ing.campanello);
  const avviso =
    id && !tipoDelCampanello(id)
      ? `<small class="mu-ed-avviso" data-mu-ed-campanello-avviso><b>${esc(id)}</b> ${esc(
          t(
            "non può fare da campanello: scegli un evento (event.*) o un sensore che si accende (binary_sensor.*).",
            "cannot act as a doorbell: pick an event (event.*) or a sensor that turns on (binary_sensor.*).",
          ),
        )}</small>`
      : "";
  return `<div class="mu-ed-riga" data-mu-ed-campanello><div class="mu-ed-testo"><b>${esc(t("Campanello", "Doorbell"))}</b><small>${esc(
    t(
      "Quando suona, il pannello si sveglia e apre il citofono da solo",
      "When it rings, the panel wakes up and opens the intercom by itself",
    ),
  )}</small><small class="mu-ed-aiuto" data-mu-ed-campanello-aiuto>${esc(
    t(
      "Un evento del citofono (event.*), o un sensore che si accende quando suona (binary_sensor). Vanno anche un button o un interruttore.",
      "An intercom event (event.*), or a sensor that turns on when it rings (binary_sensor). A button or a switch work too.",
    ),
  )}</small>${avviso}</div><div class="mu-ed-dx">${cerca(`${via}.ingresso.campanello`, ing.campanello, { domini: DOMINI_DEL_CAMPANELLO.join(","), segnaposto: "event.campanello" })}</div></div>`;
}

/* Come suona il campanello sul tablet (`core/il-campanello-a-muro.js`): il
 * suono con la sua prova, il volume, lo schermo che si accende e che resta
 * acceso, e «Parla» per chi ha un citofono con l'audio nei due versi. */
const SUONI = () => [
  ["dindon", t("Din don", "Ding dong")],
  ["classico", t("Campanello classico", "Classic bell")],
  ["ding", t("Ding", "Ding")],
  ["nessuno", t("Nessuno", "None")],
];

function campanelloMarkup(i, via, ing) {
  const o = opzioniDelCampanello(ing);
  return `${riga(
    t("Suono", "Sound"),
    t(
      "Il suono che fa il tablet quando suona il campanello. Nessuno: solo lo schermo.",
      "The sound the tablet makes when the doorbell rings. None: just the screen.",
    ),
    `<span class="mu-ed-suono">${tendina(`${via}.ingresso.suono`, o.suono, SUONI(), null)}<button type="button" class="mu-ed-prova" data-mu-ed-prova="${i}"${o.suono === "nessuno" ? " disabled" : ""}>▶ ${esc(t("Prova", "Test"))}</button></span>`,
  )}
    ${riga(
      t("Volume", "Volume"),
      t(
        "Solo per il campanello: non cambia il volume del tablet.",
        "Only for the doorbell: it does not change the tablet's volume.",
      ),
      `<span class="mu-ed-volume"><input type="range" min="0" max="100" step="5" data-mu-ed-campo="${esc(`${via}.ingresso.volume`)}" value="${o.volume}" aria-label="${esc(t("Volume", "Volume"))}"><b data-mu-ed-volume>${o.volume}%</b></span>`,
    )}
    ${riga(
      t("Accendi lo schermo quando suona", "Turn the screen on when it rings"),
      t(
        "Anche a schermo spento: si accende al massimo e il citofono prende tutto lo schermo, come una chiamata.",
        "Even with the screen off: it turns on at full brightness and the intercom takes the whole screen, like a call.",
      ),
      interruttore(`${via}.ingresso.accendiSchermo`, o.accendiSchermo, "accendi"),
    )}
    ${riga(
      t("Tieni lo schermo acceso (di notte al minimo)", "Keep the screen on (dimmed at night)"),
      t(
        "Il tablet non si spegne mai; nella fascia di notte resta acceso al minimo.",
        "The tablet never turns off; during the night hours it stays on at minimum brightness.",
      ),
      interruttore(`${via}.ingresso.tieniAcceso`, o.tieniAcceso, "acceso"),
    )}
    ${riga(
      t("Parla con il citofono (se lo supporta)", "Talk through the intercom (if supported)"),
      t(
        "Il tasto «Parla» c'è solo se il campanello ha l'audio nei due versi.",
        "The «Talk» button only works if the doorbell has two-way audio.",
      ),
      interruttore(`${via}.ingresso.parla`, o.parla, "parla"),
    )}`;
}

const nomeDi = (id) =>
  clean(
    [
      ...(state.fonte?.luci || []),
      ...(state.fonte?.clima || []),
      ...(state.fonte?.tapparelle || []),
    ].find((d) => d.entity === id)?.name,
  ) ||
  /* Una persona col nome della scheda Persone, come sul tablet. */
  nomeDellaPersonaDelMuro(id, state.fonte || {}, allStates() || {}) ||
  clean(allStates()?.[id]?.attributes?.friendly_name) ||
  id;

/* Un campo entita' come quelli del resto del config: la casella e la lente
 * che apre la ricerca della plancia (`wzPickEntity`), con i suoi suggerimenti
 * per dominio. «Ricerca entita' non omogenea con il config: usare la stessa
 * modalita'.» La tendina di prima elencava tutto in ordine alfabetico. */
let campiCerca = 0;
function cerca(via, valore, { domini = "", segnaposto = "" } = {}) {
  const id = `mu-ed-cerca-${campiCerca++}`;
  /* `data-entity-input` e `data-entity-target` sono il patto dei campi
   * entita' del config: con quelli la casella e il bottone diventano la riga
   * «Scegli entità ›» con «Modifica» ed «Elimina», uguale alle altre schede
   * (`editor-slots-section.js`). Il tocco lo apre questa scheda. */
  return `<span class="ed-form-row mu-ed-cerca"><input id="${id}" class="ed-input mono mu-ed-campo" data-mu-ed-campo="${esc(via)}" data-entity-input="true" data-domain="${esc(domini)}" value="${esc(valore)}" placeholder="${esc(segnaposto || t("Entità", "Entity"))}" autocomplete="off" spellcheck="false"><button type="button" class="dm-entity-picker" data-entity-target="${id}" data-mu-ed-pick="${id}" aria-label="${esc(t("Scegli entità", "Choose entity"))}">🔍</button></span>`;
}

/* Le azioni della plancia di origine che il tablet sa far partire. */
const azioniUsabili = () =>
  (state.fonte?.azioni || []).filter(eUnaScena).map((a) => [a.name, `⚡ ${a.name}`]);

/* I disegni che una card puo' portare: quelli di casa, gli stessi delle
 * tessere in Home. Vuoto vuol dire «quello che le somiglia». */
const DISEGNI = () => [
  ["", t("Automatico", "Automatic")],
  ...CHIAVI_OGGETTI.filter((k) => !/^pioggia/.test(k)).map((k) => [
    k,
    k.charAt(0).toUpperCase() + k.slice(1),
  ]),
];

/* I domini che un posto propone per primi nella ricerca: tutto quello che il
 * tablet sa comandare o mostrare. La ricerca trova lo stesso anche il resto. */
const DOMINI_DEI_POSTI =
  "light,switch,climate,cover,fan,lock,scene,script,button,input_button,input_boolean,media_player,vacuum,sensor,binary_sensor";

/**
 * Un posto: cosa c'e' dentro — un'entita' qualunque o un'azione della plancia
 * — e come si presenta: il nome, la riga sotto, il disegno.
 *
 * «Devi dare la possibilita' di personalizzare le 6 card e scegliere a
 * piacimento cosa inserire, non solo quelle che hai inserito tu.»
 */
/* I domini che i tasti del riquadro ON e OFF propongono per primi: quello che
 * si preme, si avvia o si accende (`servizioDelTasto` nel nucleo). */
const DOMINI_DEI_DUE_TASTI =
  "button,input_button,switch,input_boolean,light,script,scene,automation,remote,fan";
/* E lo stato: chi dice acceso o spento. */
const DOMINI_DELLO_STATO =
  "binary_sensor,switch,input_boolean,light,sensor,fan,remote,media_player,device_tracker";

/* I tipi che un posto della griglia puo' essere. «Entita' o azione» e' quello
 * di sempre: il tipo lo decide l'entita' scelta. «Due tasti» e' il riquadro
 * con ON e OFF, ognuno con la sua entita'. Le Scene non lo hanno: le loro
 * tessere sono un tocco solo. */
const TIPI_DEL_POSTO = () => [
  ["", t("Entità o azione", "Entity or action")],
  ["duetasti", t("Due tasti: ON e OFF", "Two buttons: ON and OFF")],
];

/* Un riquadro dei due tasti a meta': scelto il tipo, o scritto il tasto ON,
 * ma senza ancora il tasto OFF. Il nucleo lo butterebbe (un riquadro senza OFF
 * non e' un riquadro dei due tasti), e il posto nella bozza resta libero;
 * quello che si e' scritto si tiene qui finche' non e' completo, per posto. */
const dueTastiInCorso = () => (state.dueTasti ||= {});

/* Il corpo di un posto dei due tasti: il nome, i due tasti, lo stato e il
 * disegno, nell'ordine del riquadro. */
function dueTastiMarkup(via, c) {
  const nomeOn = c.entita ? nomeDi(c.entita) : "";
  return `<label class="mu-ed-voce"><span>${esc(t("Nome", "Name"))}</span>${campo(`${via}.nome`, c.nome || "", nomeOn)}</label>
      <div class="mu-ed-coppia">
        <label class="mu-ed-voce" data-entity-field><span class="ed-slot-lbl">${esc(t("Tasto ON", "ON button"))}</span>${cerca(`${via}.entita`, c.entita || "", { domini: DOMINI_DEI_DUE_TASTI })}</label>
        <label class="mu-ed-voce" data-entity-field><span class="ed-slot-lbl">${esc(t("Tasto OFF", "OFF button"))}</span>${cerca(`${via}.entitaOff`, c.entitaOff || "", { domini: DOMINI_DEI_DUE_TASTI })}</label>
      </div>
      <label class="mu-ed-voce" data-entity-field><span class="ed-slot-lbl">${esc(t("Stato da (facoltativo)", "State from (optional)"))}</span>${cerca(`${via}.stato`, c.stato || "", { domini: DOMINI_DELLO_STATO, segnaposto: t("Acceso quando è acceso", "On when it's on") })}</label>
      <small class="mu-ed-aiuto">${esc(
        t(
          "Vanno bene pulsanti, interruttori, script, scene e automazioni: il tasto ON li accende o li preme, il tasto OFF fa lo stesso con la sua entità. Se le due entità sono interruttori e lo stato è vuoto, si guarda quello del tasto ON.",
          "Buttons, switches, scripts, scenes and automations all work: the ON button turns on or presses its entity, the OFF button does the same with its own. If both entities are switches and the state is empty, the ON button's state is used.",
        ),
      )}</small>
      <label class="mu-ed-voce"><span data-mu-ed-icona>${esc(t("Icona", "Icon"))}</span>${tendina(`${via}.disegno`, c.disegno || "", DISEGNI(), null)}</label>
      ${immagineDelPosto(via, { ...c, tipo: "duetasti" })}`;
}

/* «Riquadri con l'immagine»: il blocco «Immagine» sotto «Disegno», per ogni
 * posto che c'e' — «lo devi aggiungere a tutti». La luce, i due tasti, il
 * clima e il termostato, la tapparella e il cancello, un sensore, una scena:
 * sul tablet ognuno porta l'immagine coi suoi comandi in vetro sopra
 * (`cardDelPosto` nel muro). L'anteprima del blocco dice quello che dira' il
 * tablet (`facciaDelPosto`): «76 %» per la batteria, ON e OFF per i due tasti. */
export function siVedeLImmagine(c) {
  return Boolean(c && c.tipo && c.tipo !== "vuoto");
}
const ACCENTO_DEL_POSTO = Object.freeze({ luce: "#f59e0b", azione: "#8b5cf6", tapparella: "#22c55e" });
function immagineDelPosto(via, c, lista = "comandi") {
  if (!siVedeLImmagine(c)) return "";
  const anteprima = facciaDelPosto(c, { scena: lista === "scene", fonte: state.fonte || {} });
  return bloccoImmagineMarkup({
    chiave: via,
    immagine: c.immagine,
    nome: clean(c.nome) || c.azione || nomeDi(c.entita),
    accento: anteprima?.accento || ACCENTO_DEL_POSTO[c.tipo] || "#f59e0b",
    anteprima,
  });
}

function postoMarkup(i, lista, k, c, posti = 6) {
  const via = `pagine.${i}.${lista}.${k}`;
  const inCorso = lista === "comandi" ? dueTastiInCorso()[via] : null;
  const due = c?.tipo === "duetasti" || Boolean(inCorso);
  const pieno = c && c.tipo !== "vuoto";
  const azioni = azioniUsabili();
  const descrizione = due
    ? `${clean(inCorso?.nome || c?.nome) || nomeDi(inCorso?.entita || c?.entita || "") || t("Due tasti", "Two buttons")} · ON / OFF`
    : !pieno
      ? t("Posto libero", "Empty slot")
      : c.azione
        ? `⚡ ${c.azione}`
        : `${nomeDi(c.entita)} · ${c.entita}`;
  const tipo =
    lista === "comandi"
      ? `<label class="mu-ed-voce"><span>${esc(t("Tipo", "Type"))}</span>${tendina(`${via}.tipo`, due ? "duetasti" : "", TIPI_DEL_POSTO(), null)}</label>`
      : "";
  return `<div class="mu-ed-posto${pieno || due ? " pieno" : ""}" data-mu-ed-posto="${esc(via)}">
    <div class="mu-ed-posto-testa"><span class="mu-ed-num">${k + 1}</span>
      <span class="mu-ed-frecce"><button type="button" data-mu-ed-posto-su="${i}.${k}" data-mu-ed-lista="${lista}"${k === 0 ? " disabled" : ""} aria-label="▲">▲</button><button type="button" data-mu-ed-posto-giu="${i}.${k}" data-mu-ed-lista="${lista}"${k === posti - 1 ? " disabled" : ""} aria-label="▼">▼</button></span>
      <b class="mu-ed-cosa">${esc(descrizione)}</b>
      ${pieno || due ? `<button type="button" class="mu-ed-svuota" data-mu-ed-svuota="${esc(via)}" aria-label="${esc(t("Svuota il posto", "Clear the slot"))}">✕</button>` : ""}</div>
    <div class="mu-ed-posto-corpo">
      ${tipo}${
        due
          ? dueTastiMarkup(via, inCorso || c)
          : `<label class="mu-ed-voce" data-entity-field><span class="ed-slot-lbl">${esc(t("Entità", "Entity"))}</span>${cerca(`${via}.entita`, c?.entita || "", { domini: DOMINI_DEI_POSTI })}</label>
      ${
        azioni.length
          ? `<label class="mu-ed-voce"><span>${esc(t("oppure un'azione", "or an action"))}</span>${tendina(`${via}.azione`, c?.azione || "", azioni, t("Nessuna", "None"))}</label>`
          : ""
      }
      ${
        pieno
          ? `<label class="mu-ed-voce"><span>${esc(t("Nome sul tablet", "Name on the tablet"))}</span>${campo(`${via}.nome`, c.nome || "", c.azione || nomeDi(c.entita))}</label>
      <label class="mu-ed-voce"><span>${esc(t("Riga sotto", "Line below"))}</span>${campo(`${via}.sotto`, c.sotto || "", t("Facoltativa", "Optional"))}</label>
      <label class="mu-ed-voce"><span>${esc(c.immagine ? t("Disegno (se non c'è immagine)", "Drawing (when there is no image)") : t("Disegno", "Drawing"))}</span>${tendina(`${via}.disegno`, c.disegno || "", DISEGNI(), null)}</label>
      ${immagineDelPosto(via, c, lista)}`
          : ""
      }`
      }
    </div></div>`;
}

function postiMarkup(i, lista, posti, quanti = 6) {
  return `<div class="mu-ed-posti">${Array.from({ length: quanti }, (_, k) =>
    postoMarkup(i, lista, k, posti[k], quanti),
  ).join("")}</div>`;
}

const MODELLI = () => [
  ["stanza", t("Stanza", "Room")],
  ["scene", t("Scene", "Scenes")],
  ["ingresso", t("Ingresso", "Entrance")],
  ["personale", t("Personalizzata", "Custom")],
  ["luci", t("Tutte le luci", "All lights")],
  ["clima", t("Clima", "Climate")],
  ["tapparelle", t("Tutte le tapparelle", "All blinds")],
  ["ambienti", t("Ambienti", "Rooms")],
  ["telecamere", t("Telecamere", "Cameras")],
  ["energia", t("Energia", "Energy")],
  ["musica", t("Musica", "Music")],
  ["meteo", t("Meteo", "Weather")],
  ["mixer", t("Mixer audio", "Audio mixer")],
  ["telecamera", t("Telecamera con comandi", "Camera with controls")],
  ["comandi", t("Comandi di regia", "Control buttons")],
];
const DISEGNO_DI_SERIE = {
  stanza: "stanze",
  scene: "azioni",
  ingresso: "sicurezza",
  personale: "widget",
  luci: "luci",
  clima: "clima",
  tapparelle: "tapparelle",
  ambienti: "temperatura",
  telecamere: "telecamere",
  energia: "energia",
  musica: "media",
  meteo: "meteo",
  mixer: "media",
  telecamera: "telecamere",
  comandi: "azioni",
};
const NOME_DEL_MODELLO = (modello) => MODELLI().find(([v]) => v === modello)?.[1] || "";

/* Cosa mette da sola una pagina elenco, detto prima di salvarla. */
function elencoMarkup(p, i) {
  const comandi = comandiDellaPagina(p, state.fonte || {});
  const spiega = {
    luci: t(
      "Si riempie da sola con tutte le luci della plancia di origine: una luce aggiunta là compare anche qui.",
      "It fills itself with every light of the source dashboard: a light added there shows up here too.",
    ),
    tapparelle: t(
      "Si riempie da sola con tutte le tapparelle della plancia di origine: su, stop e giù per ognuna.",
      "It fills itself with every blind of the source dashboard: up, stop and down for each one.",
    ),
    clima: t(
      "Si riempie da sola con il clima della plancia di origine, diviso nelle due linguette Freddo e Caldo come nella sezione Clima: i condizionatori nel freddo, termosifoni e termostati nel caldo, le pompe di calore in tutte e due.",
      "It fills itself with the source dashboard's climate, split into the Cooling and Heating tabs like the Climate section: air conditioners in cooling, radiators and thermostats in heating, heat pumps in both.",
    ),
  }[p.modello];
  const nomi = (
    p.modello === "clima"
      ? [
          ...comandiDellaPagina(p, state.fonte || {}, "freddo"),
          ...comandiDellaPagina(p, state.fonte || {}, "caldo"),
        ]
      : comandi
  )
    .map((c) => nomeDi(c.entita))
    .filter((n, k, tutti) => tutti.indexOf(n) === k);
  return `<div class="mu-ed-nota">${esc(spiega)}</div>
    ${
      p.modello === "clima"
        ? riga(
            t("Si apre su", "Opens on"),
            "",
            scelte(`pagine.${i}.zona`, p.zona, [
              ["freddo", `❄️ ${t("Freddo", "Cooling")}`],
              ["caldo", `🔥 ${t("Caldo", "Heating")}`],
            ]),
          )
        : ""
    }
    ${
      p.modello === "clima"
        ? riga(
            t("Il tasto ⏻ accende con", "The ⏻ button turns on with"),
            t(
              "Il comando rapido della plancia: modalità, gradi e ventola scelti per ogni stanza nella scheda Clima. Premuto di nuovo, spegne.",
              "The dashboard quick command: mode, degrees and fan chosen for each room in the Climate tab. Pressed again, it turns off.",
            ),
            scelte(`pagine.${i}.accensione`, p.accensione, [
              ["rapido", `⚡ ${t("Comando rapido", "Quick command")}`],
              ["ultima", t("Ultima modalità", "Last mode")],
            ]),
          )
        : ""
    }
    <div class="mu-ed-riga"><div class="mu-ed-testo"><b>${nomi.length} ${esc(t("sul tablet", "on the tablet"))}</b><small>${esc(nomi.slice(0, 8).join(", ") + (nomi.length > 8 ? ` +${nomi.length - 8}` : "") || t("Per ora nessuna", "None yet"))}</small></div></div>`;
}

/* Gli elenchi dell'Ingresso: le partizioni, le altre letture, gli altri
 * comandi. Un campo per voce, ognuno con ▲ ▼ (lo toglie il suo «Elimina»),
 * e uno vuoto in fondo per aggiungerne un'altra. */
const ELENCHI_DELL_INGRESSO = ["aree", "letture", "comandi"];

/* Le voci di un elenco come le vede chi configura: per le partizioni, una
 * pagina di prima che aveva la sola «Centrale» la mostra come prima voce. */
function valoriDellElenco(p, chiave) {
  const ing = p?.ingresso || {};
  const voci = Array.isArray(ing[chiave]) ? ing[chiave].slice() : [];
  if (chiave === "aree" && !voci.length && clean(ing.centrale)) return [clean(ing.centrale)];
  return voci;
}

function elencoDiEntita(i, chiave, valori, { domini, massimo, segnaposto }) {
  const via = `pagine.${i}.ingresso.${chiave}`;
  const campi = Math.min(valori.length + 1, massimo);
  return `<span class="mu-ed-lettori mu-ed-elenco" data-mu-ed-elenco="${esc(chiave)}">${Array.from(
    { length: campi },
    (_, k) => {
      const pieno = Boolean(valori[k]);
      return `<span class="mu-ed-elenco-voce">${cerca(`${via}.${k}`, valori[k] || "", { domini, segnaposto: pieno ? "" : segnaposto })}${
        pieno
          ? `<span class="mu-ed-frecce"><button type="button" data-mu-ed-sposta="${esc(via)}" data-mu-ed-da="${k}" data-mu-ed-verso="-1"${k === 0 ? " disabled" : ""} aria-label="▲">▲</button><button type="button" data-mu-ed-sposta="${esc(via)}" data-mu-ed-da="${k}" data-mu-ed-verso="1"${k === valori.length - 1 ? " disabled" : ""} aria-label="▼">▼</button></span>`
          : ""
      }</span>`;
    },
  ).join("")}</span>`;
}

/* Cambiare un elenco dell'Ingresso: si parte da quello che si vede, si
 * cambia, e si riscrive tutto. Scrivere le partizioni toglie la vecchia
 * «Centrale»: da li' in poi decide l'elenco, e vuoto vuol dire tutte. */
function cambiaElenco(via, cambia) {
  const [, n, , chiave] = via.split(".");
  if (!ELENCHI_DELL_INGRESSO.includes(chiave)) return false;
  const m = structuredClone(bozza());
  const p = m.pagine[Number(n)];
  if (!p?.ingresso) return false;
  p.ingresso[chiave] = cambia(valoriDellElenco(p, chiave)).map(clean).filter(Boolean);
  if (chiave === "aree") p.ingresso.centrale = "";
  state.bozza = muroPulito(m);
  return true;
}

function paginaMarkup(p, i, tutte) {
  const f = state.fonte || {};
  const via = `pagine.${i}`;
  let dentro = "";
  if (p.modello === "stanza") {
    const quanti = postiDellaPagina(p);
    const comandi = p.scelti ? p.comandi : comandiProposti(f, p.stanza, quanti);
    dentro = `${riga(
      t("Stanza", "Room"),
      t(
        "Da qui la pagina prende la temperatura e i comandi proposti",
        "The page takes its temperature and suggested controls from here",
      ),
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
        "Accesa, una luce aggiunta alla stanza nella plancia di origine compare da sola. Spenta, i posti si scelgono qui: qualunque entità o azione, col nome e il disegno che vuoi.",
        "On, a light added to the room in the source dashboard shows up by itself. Off, the slots are chosen here: any entity or action, with the name and drawing you want.",
      ),
      interruttore(
        `${via}.segue`,
        !p.scelti,
        t("I comandi seguono la stanza", "Controls follow the room"),
      ),
    )}
    ${
      p.scelti
        ? postiMarkup(i, "comandi", comandi, quanti)
        : `<div class="mu-ed-posti">${Array.from({ length: quanti }, (_, k) => {
            const c = comandi[k];
            return `<div class="mu-ed-posto"><div class="mu-ed-posto-testa"><span class="mu-ed-num">${k + 1}</span><span class="mu-ed-proposto">${c ? esc(c.azione ? `⚡ ${c.azione}` : nomeDi(c.entita)) : esc(t("Posto libero", "Empty slot"))}</span></div></div>`;
          }).join("")}</div>`
    }
    <div class="mu-ed-sotto-titolo">${esc(t("La riga in alto", "The top row"))}</div>
    ${riga(t("Temperatura e umidità della stanza", "Room temperature and humidity"), "", interruttore(`${via}.riga.clima`, p.riga.clima, "clima"))}
    ${riga(t("Stato dell'antifurto", "Alarm state"), "", interruttore(`${via}.riga.antifurto`, p.riga.antifurto, "antifurto"))}
    ${riga(t("Chi è in casa", "Who is home"), "", interruttore(`${via}.riga.persone`, p.riga.persone, "persone"))}
    ${riga(t("Meteo", "Weather"), "", interruttore(`${via}.riga.meteo`, p.riga.meteo, "meteo"))}`;
  } else if (p.modello === "ambienti") {
    const ambienti = ambientiDellaFonte(f);
    dentro = `<div class="mu-ed-nota">${esc(
      t(
        "Una tessera per stanza, con la temperatura, l'umidità e quante luci sono accese, dal vivo. Le stanze e le loro sonde sono quelle della plancia di origine.",
        "One tile per room, with temperature, humidity and how many lights are on, live. Rooms and their sensors come from the source dashboard.",
      ),
    )}</div><div class="mu-ed-riga"><div class="mu-ed-testo"><b>${ambienti.length} ${esc(t("sul tablet", "on the tablet"))}</b><small>${esc(ambienti.map((a) => a.stanza.name).join(", ") || t("Nessuna stanza con sonde o luci", "No room with sensors or lights"))}</small></div></div>`;
  } else if (p.modello === "telecamere") {
    const telecamere = telecamereDellaFonte(f);
    dentro = `<div class="mu-ed-nota">${esc(
      t(
        "Le telecamere della plancia di origine, tutte insieme; un tocco ne apre una a tutto schermo.",
        "The source dashboard's cameras, all together; a tap opens one full screen.",
      ),
    )}</div><div class="mu-ed-riga"><div class="mu-ed-testo"><b>${telecamere.length} ${esc(t("sul tablet", "on the tablet"))}</b><small>${esc(telecamere.map((k) => k.nome || nomeDi(k.entita)).join(", ") || t("Per ora nessuna", "None yet"))}</small></div></div>`;
  } else if (p.modello === "energia") {
    const sue = energiaDellaPagina({}, f);
    const misura = (chiave, titolo, nota, domini = "sensor") =>
      riga(
        titolo,
        sue[chiave] && !p.energia[chiave]
          ? `${nota} · ${t("dalla plancia", "from the dashboard")}: ${nomeDi(sue[chiave])}`
          : nota,
        cerca(`${via}.energia.${chiave}`, p.energia[chiave], {
          domini,
          segnaposto: sue[chiave] || t("Entità", "Entity"),
        }),
      );
    /* La rete e la potenza della batteria: un sensore col segno, o due. Il
     * modo si legge da quello che c'e' scritto (qui o nella plancia), e si
     * cambia col bottone: scegliendo l'altro si svuota il primo. */
    const due = (chiavi, [a, b]) => {
      const da = chiavi.some((c) => p.energia[c]) ? p.energia : sue;
      return Boolean(da[a] || da[b]);
    };
    const reteDue =
      state.reteDue?.[via] ?? due(["rete", "prelievo", "immissione"], ["prelievo", "immissione"]);
    const batteriaDue =
      state.batteriaDue?.[via] ??
      due(["potenzaBatteria", "carica", "scarica"], ["carica", "scarica"]);
    const modo = (chi, acceso) =>
      `<span class="mu-ed-seg">${[
        [false, t("Uno col segno", "One, signed")],
        [true, t("Due sensori", "Two sensors")],
      ]
        .map(
          ([v, testo]) =>
            `<button type="button" class="${v === acceso ? "si" : ""}" data-mu-ed-modo-energia="${esc(chi)}" data-mu-ed-via="${esc(via)}" data-mu-ed-valore="${v}">${esc(testo)}</button>`,
        )
        .join("")}</span>`;
    dentro = `<div class="mu-ed-nota">${esc(
      t(
        "Numeri grandi, dal vivo. Vuoti, si prendono dalla sezione Energia della plancia di origine, col verso che ha lì.",
        "Big live numbers. Left empty, they come from the source dashboard's Energy section, with its direction.",
      ),
    )}</div>
    ${misura("casa", t("Consumo della casa", "House consumption"), t("Potenza, in W o kW", "Power, in W or kW"))}
    ${misura("solare", t("Produzione solare", "Solar production"), t("Potenza, in W o kW", "Power, in W or kW"))}
    ${riga(t("Rete: come la misuri", "Grid: how you measure it"), t("Un sensore col segno, o due separati", "One signed sensor, or two separate ones"), modo("rete", reteDue))}
    ${
      reteDue
        ? `${misura("prelievo", t("Prelievo dalla rete", "Drawn from the grid"), t("Potenza presa dalla rete", "Power taken from the grid"))}
    ${misura("immissione", t("Immissione in rete", "Fed into the grid"), t("Potenza ceduta alla rete", "Power fed into the grid"))}`
        : misura(
            "rete",
            t("Scambio con la rete", "Grid exchange"),
            t("Positivo si preleva, negativo si cede", "Positive is drawn, negative is fed in"),
          )
    }
    ${misura("batteria", t("Batteria: carica", "Battery: charge"), t("In %", "In %"))}
    ${riga(t("Batteria: potenza", "Battery: power"), t("Un sensore col segno, o due separati", "One signed sensor, or two separate ones"), modo("batteria", batteriaDue))}
    ${
      batteriaDue
        ? `${misura("carica", t("Potenza in carica", "Charging power"), t("Quanto entra nella batteria", "What goes into the battery"))}
    ${misura("scarica", t("Potenza in scarica", "Discharging power"), t("Quanto esce dalla batteria", "What comes out of the battery"))}`
        : misura(
            "potenzaBatteria",
            t("Potenza della batteria", "Battery power"),
            t("Positivo si scarica, negativo si carica", "Positive discharges, negative charges"),
          )
    }
    ${riga(
      t("Inverti il segno", "Flip the sign"),
      t(
        "Se il tuo inverter li scrive al contrario: la rete positiva quando cede, la batteria positiva quando carica",
        "If your inverter writes them the other way round: grid positive when feeding in, battery positive when charging",
      ),
      `<span class="mu-ed-versi">${esc(t("Rete", "Grid"))} ${interruttore(`${via}.energia.invertiRete`, p.energia.invertiRete === true, "inverti-rete")} ${esc(t("Batteria", "Battery"))} ${interruttore(`${via}.energia.invertiBatteria`, p.energia.invertiBatteria === true, "inverti-batteria")}</span>`,
    )}
    ${riga(
      t("Altre misure", "More readings"),
      t(
        "Fino a 8 in più: una presa, la pompa di calore, l'auto in carica, i kWh di oggi",
        "Up to 8 more: a socket, the heat pump, the car charging, today's kWh",
      ),
      `<span class="mu-ed-lettori">${Array.from(
        { length: Math.min((p.energia.altre || []).length + 1, ALTRE_MISURE_AL_MASSIMO) },
        (_, k) =>
          cerca(`${via}.energia.altre.${k}`, (p.energia.altre || [])[k] || "", {
            domini: "sensor",
          }),
      ).join("")}</span>`,
    )}`;
  } else if (p.modello === "musica") {
    const sue = lettoriDellaPagina({}, f);
    /* Un campo per lettore scelto, e uno vuoto per aggiungerne un altro. */
    const campi = Math.min(p.lettori.length + 1, LETTORI_AL_MASSIMO);
    dentro = `<div class="mu-ed-nota">${esc(
      t(
        "Il lettore che suona in grande, con la copertina, i tasti, il volume e le sorgenti; accanto gli altri, ognuno col suo play. Un tocco su un lettore lo porta in grande.",
        "The player that's playing, big, with cover, buttons, volume and sources; beside it the others, each with its own play. A tap on a player brings it up big.",
      ),
    )}</div>
    ${riga(
      t("Lettori", "Players"),
      p.lettori.length
        ? t("Quelli scelti qui, in quest'ordine", "The ones chosen here, in this order")
        : `${t("Vuoto: quelli della sezione Musica della plancia", "Empty: the ones from the dashboard's Music section")}${sue.length ? ` — ${sue.map((l) => l.nome || nomeDi(l.entita)).join(", ")}` : ""}`,
      `<span class="mu-ed-lettori">${Array.from({ length: campi }, (_, k) =>
        cerca(`${via}.lettori.${k}`, p.lettori[k] || "", { domini: "media_player" }),
      ).join("")}</span>`,
    )}`;
  } else if (p.modello === "meteo") {
    /* Il meteo della pagina e' quello del tablet: in alto, sul riposo e qui
     * lo stesso. Si sceglie una volta sola, in «Altre impostazioni». */
    const id = entitaDelMeteoDelMuro(bozza(), f, allStates() || {});
    dentro = `<div class="mu-ed-nota">${esc(
      t(
        "Il meteo a tutta pagina: com'è adesso in grande, con percepita, umidità, vento e pressione, poi le prossime ore e i prossimi giorni. Usa lo stesso meteo che il tablet mostra in alto e sul riposo.",
        "Full-page weather: what it's like now, big, with feels-like, humidity, wind and pressure, then the coming hours and days. It uses the same weather the tablet shows at the top and on the rest screen.",
      ),
    )}</div><div class="mu-ed-riga" data-mu-ed-meteo="${esc(id)}"><div class="mu-ed-testo"><b>${esc(id ? nomeDi(id) : t("Nessun meteo", "No weather"))}</b><small>${esc(
      id
        ? `${id} · ${t("si cambia in Altre impostazioni › Meteo", "change it in More settings › Weather")}`
        : t(
            "Scegli l'entità meteo in Altre impostazioni › Meteo, o aggiungi un'integrazione meteo in Home Assistant",
            "Choose the weather entity in More settings › Weather, or add a weather integration in Home Assistant",
          ),
    )}</small></div></div>`;
  } else if (p.modello === "mixer") {
    dentro = mixerMarkup(p, i);
  } else if (p.modello === "telecamera") {
    dentro = telecameraMarkup(p, i);
  } else if (p.modello === "comandi") {
    dentro = comandiMarkup(p, i);
  } else if (p.modello === "personale") {
    dentro = `<div class="mu-ed-nota">${esc(
      t(
        "Posti tutti tuoi: in ognuno un'entità qualunque di Home Assistant — una luce, una presa, una serratura, un sensore — o un'azione della plancia, col nome e il disegno che vuoi.",
        "Slots of your own: in each one any Home Assistant entity — a light, a socket, a lock, a sensor — or a dashboard action, with the name and drawing you want.",
      ),
    )}</div>${postiMarkup(i, "comandi", p.comandi, postiDellaPagina(p))}`;
  } else if (MODELLI_ELENCO.includes(p.modello)) {
    dentro = elencoMarkup(p, i);
  } else if (p.modello === "scene") {
    dentro = `<div class="mu-ed-nota">${esc(
      t(
        "Tasti grandi: un'azione della plancia o un'entità qualunque (una scena, uno script, un tasto). Per ognuno il nome sul tablet, la riga sotto e il disegno.",
        "Big buttons: a dashboard action or any entity (a scene, a script, a button). For each one the name on the tablet, the line below and the drawing.",
      ),
    )}</div>${postiMarkup(i, "scene", p.scene, postiDellaPagina(p))}`;
  } else {
    const ing = p.ingresso;
    const azioni = (f.azioni || []).filter(eUnaScena).map((a) => [a.name, a.name]);
    /* Le aree della sezione Sicurezza, col loro nome, per dire cosa vuol
     * dire «vuoto». */
    const sue = (f.aree || []).map(
      (a, k) => clean(a.nome) || nomeDi(a.entita) || `${t("Area", "Area")} ${k + 1}`,
    );
    const scelte = valoriDellElenco(p, "aree");
    dentro = `<div class="mu-ed-sotto-titolo">${esc(t("Antifurto", "Alarm"))}</div>
    ${riga(
      t("Partizioni dell'antifurto", "Alarm partitions"),
      scelte.length
        ? t(
            "Quelle scelte qui, in quest'ordine: ognuna col suo stato e i suoi tasti, quelli che la sua centrale accetta",
            "The ones chosen here, in this order: each with its state and its buttons, the ones its panel accepts",
          )
        : `${t("Vuoto: tutte quelle della sezione Sicurezza della plancia", "Empty: all the ones from the dashboard's Security section")}${sue.length ? ` — ${sue.join(", ")}` : ""}`,
      elencoDiEntita(i, "aree", scelte, {
        domini: "alarm_control_panel",
        massimo: AREE_AL_MASSIMO,
        segnaposto: t("Aggiungi una partizione", "Add a partition"),
      }),
    )}
    ${riga(t("Avvisa se restano finestre aperte", "Warn about open windows"), t("Gli ingressi dichiarati nella sezione Sicurezza", "The entries declared in the Security section"), interruttore(`${via}.ingresso.finestre`, ing.finestre, "finestre"))}
    ${riga(
      t("Altre letture", "Other readings"),
      t(
        "Sotto l'antifurto, ognuna col suo valore: porte e finestre (binary_sensor), sensori, serrature, tapparelle. Due o più porte o finestre diventano un conto solo, «Finestre aperte: 2»; un tocco le elenca.",
        "Under the alarm, each with its value: doors and windows (binary_sensor), sensors, locks, blinds. Two or more doors or windows become a single count, «Open windows: 2»; a tap lists them.",
      ),
      elencoDiEntita(i, "letture", ing.letture, {
        domini:
          "binary_sensor,sensor,lock,cover,number,input_number,input_boolean,switch,input_select,select",
        massimo: LETTURE_DELL_INGRESSO_AL_MASSIMO,
        segnaposto: t("Aggiungi una lettura", "Add a reading"),
      }),
    )}
    ${riga(
      t("Altri comandi", "Other commands"),
      t(
        "Tasti accanto alle letture: serrature (chiude e apre), script, button, scene, switch, tapparelle. Un telecomando si accende e si spegne; scritto remote.nome:comando manda quel comando.",
        "Buttons next to the readings: locks (lock and unlock), scripts, buttons, scenes, switches, blinds. A remote turns on and off; written remote.name:command it sends that command.",
      ),
      elencoDiEntita(i, "comandi", ing.comandi, {
        domini:
          "lock,script,button,input_button,scene,switch,input_boolean,remote,cover,automation",
        massimo: COMANDI_DELL_INGRESSO_AL_MASSIMO,
        segnaposto: t("Aggiungi un comando", "Add a command"),
      }),
    )}
    <div class="mu-ed-sotto-titolo">${esc(t("Citofono / telecamera", "Intercom / camera"))}</div>
    ${riga(t("Telecamera", "Camera"), t("Il video del citofono", "The intercom video"), cerca(`${via}.ingresso.telecamera`, ing.telecamera, { domini: "camera" }))}
    ${rigaDelCampanello(via, ing)}
    ${campanelloMarkup(i, via, ing)}
    ${riga(t("Tasto grande", "Big button"), t("Per esempio: apri cancello", "For example: open the gate"), cerca(`${via}.ingresso.apri`, ing.apri, { domini: "button,lock,cover,switch,script,input_button" }))}
    ${riga(t("Nome del tasto grande", "Big button name"), t("Vuoto: il nome dell'entità", "Empty: the entity name"), campo(`${via}.ingresso.nomeApri`, ing.nomeApri, ing.apri ? nomeDi(ing.apri) : t("Cancello", "Gate")))}
    ${riga(t("Secondo tasto", "Second button"), t("Per esempio: apri porta", "For example: open the door"), cerca(`${via}.ingresso.apri2`, ing.apri2, { domini: "button,lock,cover,switch,script,input_button" }))}
    ${riga(t("Nome del secondo tasto", "Second button name"), t("Vuoto: il nome dell'entità", "Empty: the entity name"), campo(`${via}.ingresso.nomeApri2`, ing.nomeApri2, ing.apri2 ? nomeDi(ing.apri2) : t("Portoncino", "Front door")))}
    <div class="mu-ed-sotto-titolo">${esc(t("Uscita e chi c'è", "Leaving and who is home"))}</div>
    ${riga(t("Esco", "Leaving"), t("L'azione del tasto in basso quando l'antifurto è spento", "The bottom button's action when the alarm is off"), tendina(`${via}.ingresso.esco`, ing.esco, azioni))}
    ${riga(t("Rientro", "I'm home"), t("Al posto di «Esco» quando l'antifurto è inserito", "Instead of «Leaving» when the alarm is armed"), tendina(`${via}.ingresso.rientro`, ing.rientro, azioni))}
    ${riga(t("Chiedi conferma prima di «Esco» e «Rientro»", "Confirm before «Leaving» and «I'm home»"), "", interruttore(`${via}.confermaUscita`, p.confermaUscita, "conferma"))}
    ${riga(t("Chi è in casa", "Who is home"), "", interruttore(`${via}.ingresso.persone`, ing.persone, "persone"))}`;
  }
  const nomeDiSerie = (p.modello === "stanza" && clean(p.stanza)) || NOME_DEL_MODELLO(p.modello);
  const aperta = state.aperta === i;
  /* Una riga per pagina: il disegno, il nome, il tipo. Un tocco la apre. */
  const testa = `<div class="mu-ed-pagina-testa">
      <button type="button" class="mu-ed-apri" data-mu-ed-apri="${i}" aria-expanded="${aperta}">${disegno(clean(p.disegno) || DISEGNO_DI_SERIE[p.modello], 26, `pag-${i}`)}<span class="mu-ed-apri-tx"><b>${esc(clean(p.titolo) || nomeDiSerie)}</b><small>${esc(t("Pagina", "Page"))} ${i + 1} · ${esc(NOME_DEL_MODELLO(p.modello))}</small></span><span class="mu-ed-freccia" aria-hidden="true">${aperta ? "▾" : "▸"}</span></button>
      <span class="mu-ed-frecce"><button type="button" data-mu-ed-pagina-su="${i}"${i === 0 ? " disabled" : ""} aria-label="▲">▲</button><button type="button" data-mu-ed-pagina-giu="${i}"${i === tutte - 1 ? " disabled" : ""} aria-label="▼">▼</button></span>
      ${tutte < PAGINE_AL_MASSIMO ? `<button type="button" class="mu-ed-copia" data-mu-ed-copia="${i}" aria-label="${esc(t("Duplica la pagina", "Duplicate page"))}" title="${esc(t("Duplica", "Duplicate"))}">⧉</button>` : ""}
      <button type="button" class="mu-ed-svuota" data-mu-ed-togli="${i}" aria-label="${esc(t("Togli la pagina", "Remove page"))}">🗑</button></div>`;
  if (!aperta) return `<div class="mu-ed-pagina chiusa" data-mu-ed-pagina="${i}">${testa}</div>`;
  return `<div class="mu-ed-pagina" data-mu-ed-pagina="${i}">${testa}
    ${riga(t("Nome sul tablet", "Name on the tablet"), t("Si legge sulla linguetta in alto", "Shown on the tab at the top"), campo(`${via}.titolo`, p.titolo, nomeDiSerie))}
    ${riga(t("Icona", "Icon"), "", tendina(`${via}.disegno`, p.disegno, DISEGNI(), null))}
    ${riga(t("Tipo di pagina", "Page type"), "", tendina(`${via}.modello`, p.modello, MODELLI(), null))}
    ${
      SENZA_GRIGLIA.includes(p.modello)
        ? ""
        : riga(
            t("Griglia", "Grid"),
            MODELLI_ELENCO.includes(p.modello) ||
              p.modello === "ambienti" ||
              p.modello === "telecamere"
              ? t(
                  "Quante card a schermo; le altre scorrono",
                  "How many cards on screen; the rest scroll",
                )
              : t(
                  "Quanti posti, e quanto grandi. In verticale colonne e righe si scambiano",
                  "How many slots, and how big. In portrait columns and rows swap",
                ),
            scelte(`${via}.griglia`, p.griglia, GRIGLIE_SCRITTE()),
          )
    }
    ${riga(t("Colore", "Colour"), t("Della linguetta e del titolo", "Of the tab and the title"), colori(`${via}.colore`, p.colore))}
    <div class="mu-ed-anteprima-box"><div class="mu-ed-sotto-titolo">${esc(t("Anteprima dal vivo", "Live preview"))}</div><div class="mu-ed-anteprima" data-mu-ed-anteprima="${i}"></div></div>
    ${dentro}</div>`;
}

/* ── la regia: i campi del mixer, della telecamera e dei comandi ─────────
 *
 * Come i posti delle altre pagine: una riga per voce, la lente per
 * l'entita', il nome e il resto solo quando l'entita' c'e'. In fondo a ogni
 * elenco una riga vuota: scriverci dentro aggiunge una voce. */
const DA_PREMERE = "button,input_button,script,scene";
const togli = (via, etichetta) =>
  `<button type="button" class="mu-ed-svuota" data-mu-ed-togli-voce="${esc(via)}" aria-label="${esc(etichetta)}">✕</button>`;
const voce = (etichetta, dentro, entitaQui = false) =>
  `<label class="mu-ed-voce"${entitaQui ? " data-entity-field" : ""}><span${entitaQui ? ' class="ed-slot-lbl"' : ""}>${esc(etichetta)}</span>${dentro}</label>`;

/* Le righe di un canale: dentro un gruppo o il volume totale. Un sensore e'
 * uno strumento (si guarda), un telecomando ha ▲ / ▼ col loro comando; un
 * canale che si muove puo' avere un sensore che legge il livello vero. */
const DOMINI_DEL_CANALE = "media_player,number,input_number,sensor,remote";
const DOMINI_DEL_MUTO = "switch,input_boolean,remote,button,input_button,script";
const telecomando = (id) => String(id || "").startsWith("remote.");
/* Il blocco «Immagine» di una voce della regia — un canale, un comando, la
 * telecamera — che sul tablet tiene la sua forma e prende l'immagine come
 * fondo: l'anteprima e' il riquadro col nome, senza un «Acceso» che li' non
 * c'e'. */
const ANTEPRIMA_DEL_FONDO = Object.freeze({ stato: "", acceso: false, destra: "", comandi: "", classi: "dm-rq-lettura" });
const bloccoDellaVoce = (via, voce, nome, accento = "#22c55e") =>
  bloccoImmagineMarkup({ chiave: via, immagine: voce?.immagine, nome, accento, anteprima: ANTEPRIMA_DEL_FONDO });

function canaleMarkup(via, c, k, { togliVia = "" } = {}) {
  const pieno = Boolean(c?.entita);
  const sensore = String(c?.entita || "").startsWith("sensor.");
  const conComandi = pieno && (telecomando(c.entita) || telecomando(c.muto));
  const comando = (chiave, etichetta, ripiego) =>
    voce(etichetta, campo(`${via}.${chiave}`, c[chiave] || "", ripiego));
  return `<div class="mu-ed-posto${pieno ? " pieno" : ""}">
    <div class="mu-ed-posto-testa"><span class="mu-ed-num">${k + 1}</span><b class="mu-ed-cosa">${esc(pieno ? `${nomeDi(c.entita)} · ${c.entita}` : t("Nuovo canale", "New channel"))}</b>${pieno && togliVia ? togli(togliVia, t("Togli il canale", "Remove the channel")) : ""}</div>
    <div class="mu-ed-posto-corpo">
      ${voce(t("Livello", "Level"), cerca(`${via}.entita`, c?.entita || "", { domini: DOMINI_DEL_CANALE }), true)}
      ${
        pieno
          ? `${voce(t("Nome sul tablet", "Name on the tablet"), campo(`${via}.nome`, c.nome || "", nomeDi(c.entita)))}
      ${
        telecomando(c.entita)
          ? `<div class="mu-ed-comandi" data-mu-ed-comandi>${comando("suComando", t("Comando ▲", "▲ command"), "volume_up")}${comando("giuComando", t("Comando ▼", "▼ command"), "volume_down")}</div>`
          : ""
      }
      ${sensore ? "" : voce(t("Livello letto (facoltativo)", "Read level (optional)"), cerca(`${via}.letto`, c.letto || "", { domini: "sensor", segnaposto: t("Un sensore col livello", "A sensor with the level") }), true)}
      ${sensore || c.letto ? `<div class="mu-ed-comandi">${voce(t("Scala: da", "Scale: from"), campo(`${via}.min`, c.min ?? "", t("Automatica", "Automatic"), "number"))}${voce(t("Scala: a", "Scale: to"), campo(`${via}.max`, c.max ?? "", t("Automatica", "Automatic"), "number"))}</div>` : ""}
      ${voce(t("Muto (facoltativo)", "Mute (optional)"), cerca(`${via}.muto`, c.muto || "", { domini: DOMINI_DEL_MUTO, segnaposto: t("Acceso = muto", "On = muted") }), true)}
      ${
        conComandi
          ? `<div class="mu-ed-comandi">${comando("mutoComando", t("Comando del muto", "Mute command"), "mute")}${comando("dispositivo", t("Dispositivo (facoltativo)", "Device (optional)"), "")}</div>`
          : ""
      }
      ${bloccoDellaVoce(via, c, clean(c.nome) || nomeDi(c.entita))}`
          : ""
      }
    </div></div>`;
}

function mixerMarkup(p, i) {
  const via = `pagine.${i}.mixer`;
  const gruppi = p.mixer.gruppi;
  const blocchi = gruppi
    .map((g, gi) => {
      const canali = Array.from(
        { length: Math.min(g.canali.length + 1, CANALI_PER_GRUPPO) },
        (_, k) =>
          canaleMarkup(`${via}.gruppi.${gi}.canali.${k}`, g.canali[k], k, {
            togliVia: `${via}.gruppi.${gi}.canali.${k}`,
          }),
      ).join("");
      return `<div class="mu-ed-gruppo" style="--c:${coloreDelGruppo(g, gi)}">
      <div class="mu-ed-posto-testa"><span class="mu-ed-num">${gi + 1}</span><b class="mu-ed-cosa">${esc(g.nome || `${t("Gruppo", "Group")} ${gi + 1}`)}</b>${togli(`${via}.gruppi.${gi}`, t("Togli il gruppo", "Remove the group"))}</div>
      ${riga(t("Nome del gruppo", "Group name"), "", campo(`${via}.gruppi.${gi}.nome`, g.nome, t("Per esempio: Microfoni", "For example: Microphones")))}
      ${riga(t("Colore", "Colour"), "", colori(`${via}.gruppi.${gi}.colore`, g.colore))}
      <div class="mu-ed-posti">${canali}</div></div>`;
    })
    .join("");
  return `<div class="mu-ed-nota">${esc(
    t(
      "Ogni canale è un cursore in piedi col suo muto: il volume di un lettore, o un numero (number, input_number) come i dB di un mixer. Un sensore (sensor) diventa uno strumento che si guarda; un telecomando (remote) ha ▲ / ▼ e il muto, ognuno col suo comando (remote.send_command). Il muto è quello del lettore, un interruttore (acceso vuol dire muto), un telecomando o un tasto da premere.",
      "Each channel is an upright fader with its mute: a player's volume, or a number (number, input_number) like a mixer's dB. A sensor becomes a meter you look at; a remote gets ▲ / ▼ and mute, each with its own command (remote.send_command). Mute is the player's own, a switch (on means muted), a remote or a button to press.",
    ),
  )}</div>${blocchi}
  ${gruppi.length < GRUPPI_AL_MASSIMO ? `<button type="button" class="ed-btn-add mu-ed-piu" data-mu-ed-aggiungi-voce="${via}.gruppi">＋ ${esc(t("Aggiungi un gruppo", "Add a group"))}</button>` : ""}
  <div class="mu-ed-sotto-titolo">${esc(t("Volume totale", "Master volume"))}</div>
  <div class="mu-ed-posti">${canaleMarkup(`${via}.master`, p.mixer.master, 0)}</div>`;
}

/* Un tasto da premere che e' un telecomando porta accanto il comando da
 * mandare: il campo compare quando si sceglie un remote. */
const DA_PREMERE_O_TELECOMANDO = `${DA_PREMERE},remote`;
const campoComando = (via, valore, ripiego = "") =>
  `<span class="mu-ed-comando">${campo(via, valore, ripiego || t("Comando", "Command"))}</span>`;

function telecameraMarkup(p, i) {
  const via = `pagine.${i}.telecamera`;
  const tc = p.telecamera;
  const tasto = (chiave, titolo, domini = DA_PREMERE_O_TELECOMANDO) =>
    riga(
      titolo,
      "",
      `${cerca(`${via}.${chiave}`, tc[chiave], { domini })}${telecomando(tc[chiave]) ? campoComando(`${via}.${chiave}Comando`, tc[`${chiave}Comando`] || "") : ""}`,
    );
  const preset = Array.from(
    { length: Math.min(tc.preset.length + 1, PRESET_AL_MASSIMO) },
    (_, k) => {
      const v = tc.preset[k];
      const pieno = Boolean(v?.entita);
      return `<div class="mu-ed-posto${pieno ? " pieno" : ""}"><div class="mu-ed-posto-testa"><span class="mu-ed-num">${k + 1}</span><b class="mu-ed-cosa">${esc(pieno ? v.nome || nomeDi(v.entita) : t("Nuovo preset", "New preset"))}</b>${pieno ? togli(`${via}.preset.${k}`, t("Togli il preset", "Remove the preset")) : ""}</div>
      <div class="mu-ed-posto-corpo">${voce(t("Entità", "Entity"), cerca(`${via}.preset.${k}.entita`, v?.entita || "", { domini: DA_PREMERE_O_TELECOMANDO }), true)}${pieno && telecomando(v.entita) ? voce(t("Comando", "Command"), campo(`${via}.preset.${k}.comando`, v.comando || "", `preset_${k + 1}`)) : ""}${pieno ? voce(t("Nome sul tablet", "Name on the tablet"), campo(`${via}.preset.${k}.nome`, v.nome || "", t("Per esempio: Preset 1", "For example: Preset 1"))) : ""}</div></div>`;
    },
  ).join("");
  const conTelecomando =
    ["su", "giu", "sinistra", "destra", "stop", "zoomPiu", "zoomMeno"].some((k) =>
      telecomando(tc[k]),
    ) || tc.preset.some((x) => telecomando(x.entita));
  return `<div class="mu-ed-nota">${esc(
    t(
      "L'immagine dal vivo a sinistra, le frecce e lo zoom a destra, i preset sotto. Ogni tasto preme un'entità che c'è già in Home Assistant: un tasto (button) della telecamera, uno script con onvif.ptz, o un telecomando (remote) col comando da mandare. Un tasto senza entità resta spento.",
      "The live picture on the left, arrows and zoom on the right, presets below. Each button presses an entity already in Home Assistant: a camera button, a script with onvif.ptz, or a remote with the command to send. A button without an entity stays off.",
    ),
  )}</div>
  ${riga(t("Telecamera", "Camera"), "", cerca(`${via}.entita`, tc.entita, { domini: "camera" }))}
  ${bloccoDellaVoce(via, tc, tc.entita ? nomeDi(tc.entita) : t("Telecamera", "Camera"), "#0ea5e9")}
  ${tasto("su", t("Su", "Up"))}
  ${tasto("giu", t("Giù", "Down"))}
  ${tasto("sinistra", t("Sinistra", "Left"))}
  ${tasto("destra", t("Destra", "Right"))}
  ${tasto("stop", t("Stop", "Stop"))}
  ${riga(t("Zoom", "Zoom"), t("Un numero: diventa un cursore", "A number: it becomes a fader"), cerca(`${via}.zoom`, tc.zoom, { domini: "number,input_number" }))}
  ${tasto("zoomPiu", t("Zoom avanti", "Zoom in"))}
  ${tasto("zoomMeno", t("Zoom indietro", "Zoom out"))}
  ${conTelecomando ? riga(t("Dispositivo del telecomando", "Remote device"), t("Facoltativo: il «device» di remote.send_command", "Optional: the «device» of remote.send_command"), campo(`${via}.dispositivo`, tc.dispositivo || "", "")) : ""}
  <div class="mu-ed-sotto-titolo">${esc(t("Preset", "Presets"))}</div>
  <div class="mu-ed-posti">${preset}</div>`;
}

function comandiMarkup(p, i) {
  const via = `pagine.${i}`;
  const voci = Array.from(
    { length: Math.min(p.pulsanti.length + 1, PULSANTI_AL_MASSIMO) },
    (_, k) => {
      const c = p.pulsanti[k];
      const v = `${via}.pulsanti.${k}`;
      const pieno = Boolean(c);
      return `<div class="mu-ed-posto${pieno ? " pieno" : ""}"><div class="mu-ed-posto-testa"><span class="mu-ed-num">${k + 1}</span><b class="mu-ed-cosa">${esc(pieno ? c.nome || nomeDi(c.avvio || c.stop) : t("Nuovo comando", "New command"))}</b>${pieno ? togli(v, t("Togli il comando", "Remove the command")) : ""}</div>
      <div class="mu-ed-posto-corpo">
        ${voce(t("Nome sul tablet", "Name on the tablet"), campo(`${v}.nome`, c?.nome || "", t("Per esempio: Avvio", "For example: Start")))}
        ${voce(t("Avvio", "Start"), cerca(`${v}.avvio`, c?.avvio || "", { domini: `${DA_PREMERE_O_TELECOMANDO},switch,input_boolean` }), true)}
        ${pieno && telecomando(c.avvio) ? voce(t("Comando d'avvio", "Start command"), campo(`${v}.avvioComando`, c.avvioComando || "", t("Vuoto: accende", "Empty: turns on"))) : ""}
        ${
          pieno
            ? `${voce(t("Stop (facoltativo)", "Stop (optional)"), cerca(`${v}.stop`, c.stop || "", { domini: `${DA_PREMERE_O_TELECOMANDO},switch,input_boolean` }), true)}
        ${telecomando(c.stop) ? voce(t("Comando di stop", "Stop command"), campo(`${v}.stopComando`, c.stopComando || "", t("Vuoto: spegne", "Empty: turns off"))) : ""}
        ${telecomando(c.avvio) || telecomando(c.stop) ? voce(t("Dispositivo (facoltativo)", "Device (optional)"), campo(`${v}.dispositivo`, c.dispositivo || "", "")) : ""}
        ${voce(t("Stato (facoltativo)", "State (optional)"), cerca(`${v}.stato`, c.stato || "", { domini: "switch,input_boolean,binary_sensor,script,media_player", segnaposto: t("Acceso quando è acceso", "On when it's on") }), true)}
        ${voce(t("Disegno", "Drawing"), tendina(`${v}.disegno`, c.disegno || "", DISEGNI(), null))}
        ${voce(t("Colore", "Colour"), colori(`${v}.colore`, c.colore))}
        ${bloccoDellaVoce(v, c, c.nome || nomeDi(c.avvio || c.stop), c.colore || "#22c55e")}`
            : ""
        }
      </div></div>`;
    },
  ).join("");
  return `<div class="mu-ed-nota">${esc(
    t(
      "Un comando con il solo avvio è una tessera grande (per esempio «Avvio», «Spegnimento»); con anche lo stop diventa una colonna con i due tasti (per esempio una sala). Acceso lo dice l'entità di stato, o quella dell'avvio quando sa dirlo.",
      "A command with only a start entity is a big tile (for example «Start», «Shutdown»); with a stop too it becomes a column with both buttons (for example a room). On is told by the state entity, or by the start one when it can tell.",
    ),
  )}</div><div class="mu-ed-posti">${voci}</div>
  ${riga(t("Tasto «Ferma tutto»", "«Stop all» button"), t("Vuoto: preme lo stop di ogni comando", "Empty: presses every command's stop"), `${p.fermaTutto.attivo ? cerca(`${via}.fermaTutto.entita`, p.fermaTutto.entita, { domini: DA_PREMERE_O_TELECOMANDO }) : ""}${p.fermaTutto.attivo && telecomando(p.fermaTutto.entita) ? campoComando(`${via}.fermaTutto.comando`, p.fermaTutto.comando || "", t("Vuoto: spegne", "Empty: turns off")) : ""}${interruttore(`${via}.fermaTutto.attivo`, p.fermaTutto.attivo, "ferma-tutto")}`)}`;
}

/* Le pagine che la griglia non la scelgono: l'ingresso ha la sua forma,
 * l'energia le sue quattro tessere. */
const SENZA_GRIGLIA = ["ingresso", "energia", "musica", "meteo", "mixer", "telecamera", "comandi"];
const GRIGLIE_SCRITTE = () =>
  Object.entries(GRIGLIE).map(([n, g]) => [n, `${g.colonne}×${g.righe}`]);

/* Il colore di una pagina: un pallino per ognuno, e «come il tipo». */
function colori(via, valore) {
  const pallini = [["", ""], ...COLORI_DELLE_PAGINE.map((c) => [c, c])];
  return `<span class="mu-ed-colori">${pallini
    .map(
      ([v]) =>
        `<button type="button" class="${String(v) === String(valore || "") ? "si" : ""}${v ? "" : " auto"}" style="${v ? `--c:${v}` : ""}" data-mu-ed-metti="${esc(via)}" data-mu-ed-valore="${esc(v)}" aria-label="${esc(v || t("Come il tipo di pagina", "Like the page type"))}">${v ? "" : "A"}</button>`,
    )
    .join("")}</span>`;
}

/* ── la luminosita' dello schermo (#224) ────────────────────────────────────
 *
 * «Luminosita' dello schermo»: tre livelli, il tempo, il giorno e la notte, e
 * sotto «Chi c'e' vicino», le fonti che la alzano. La prima fonte e' il
 * sensore che prima stava in «Si sveglia da solo» (`risveglio`): lo stesso
 * campo, spostato qui, che sveglia il pannello anche a luminosita' spenta.
 *
 * Cosa ha il tablet lo dice l'app, quando la Config si apre dentro l'app
 * (`capacita?` sul canale dello schermo). Aperta da un altro telefono o da un
 * browser non lo sa nessuno, e le righe lo dicono invece di indovinare. */
function capacitaDelTablet() {
  const detto = root.__GDAHOME_SCHERMO__;
  const capacita = detto && typeof detto === "object" ? detto.capacita : null;
  return capacita && typeof capacita === "object" ? capacita : null;
}

function chiediLeCapacita() {
  if (state.capacitaChieste || capacitaDelTablet()) return;
  state.capacitaChieste = true;
  try {
    root.gdahomeSchermo?.postMessage?.("capacita?");
  } catch (_errore) {}
}

const cursore = (via, valore, minimo, etichetta) =>
  `<span class="mu-ed-volume mu-ed-luce-cursore"><input type="range" min="${minimo}" max="100" step="1" data-mu-ed-campo="${esc(via)}" value="${valore}" aria-label="${esc(etichetta)}"><b data-mu-ed-percento>${valore}%</b></span>`;

/* La giornata d'esempio: la notte vera del sole di casa quando c'e', se no
 * la fascia dell'orario (`notteDellaGiornata`). Le ore sono quelle del tablet
 * che guarda.
 *
 * Il disegno si allunga su tutta la larghezza della scheda e resta alto
 * uguale: il tracciato e' in percentuali (`preserveAspectRatio="none"`, con
 * le linee che non si ingrossano), e le scritte degli assi sono testo vero
 * accanto, che non si stira e resta leggibile dal telefono al monitor. */
function anteprimaDellaGiornata(m) {
  const notte = notteDellaGiornata(m, allStates()?.["sun.sun"]);
  const x = (ora) => ((ora / 24) * 1000).toFixed(1);
  const y = (v) => (100 - v).toFixed(1);
  const fasce = (
    notte.da > notte.a
      ? [
          [0, notte.a],
          [notte.da, 24],
        ]
      : [[notte.da, notte.a]]
  )
    .map(
      ([i, f]) =>
        `<rect class="notte" x="${x(i)}" y="0" width="${(x(f) - x(i)).toFixed(1)}" height="100"/>`,
    )
    .join("");
  const righe = [0, 50, 100]
    .map((v) => `<line x1="0" x2="1000" y1="${y(v)}" y2="${y(v)}"/>`)
    .join("");
  const vicini = PASSAGGI_DI_ESEMPIO.map(
    ([i, f]) =>
      `<rect class="vicino" x="${x(i)}" y="96" width="${(x(f) - x(i)).toFixed(1)}" height="4"/>`,
  ).join("");
  /* A gradini: la luce cambia di colpo (la dissolvenza la fa l'app). */
  let linea = "";
  let prima = null;
  for (const [ora, v] of giornataDellaLuce(m, (ora) => eNotteAllOra(notte, ora))) {
    linea += prima === null ? `M${x(ora)},${y(v)}` : `L${x(ora)},${y(prima)}L${x(ora)},${y(v)}`;
    prima = v;
  }
  const ore = [0, 6, 12, 18, 24]
    .map((o) => `<span style="left:${(o / 24) * 100}%">${String(o).padStart(2, "0")}</span>`)
    .join("");
  return `<div class="mu-ed-giornata" data-mu-ed-giornata data-notte="${notte.da.toFixed(2)}-${notte.a.toFixed(2)}">
    <div class="mu-ed-leg"><span><i class="luce"></i>${esc(t("Luminosità", "Brightness"))}</span><span><i class="vicino"></i>${esc(t("Qualcuno vicino (esempio)", "Someone nearby (example)"))}</span><span><i class="notte"></i>${esc(notte.dalSole ? t("Notte (dal sole)", "Night (from the sun)") : t("Notte (dall'orario)", "Night (from the hours)"))}</span></div>
    <div class="mu-ed-grafico">
      <div class="mu-ed-asse-y" aria-hidden="true"><span>100%</span><span>50%</span><span>0%</span></div>
      <svg viewBox="0 0 1000 100" preserveAspectRatio="none" role="img" aria-label="${esc(t("Anteprima di una giornata", "Preview of a day"))}">${fasce}${righe}${vicini}<path class="luce" d="${linea}"/></svg>
      <div class="mu-ed-ore" aria-hidden="true">${ore}</div>
    </div>
  </div>`;
}

function luceMarkup(m) {
  const l = m.luce;
  const capacita = capacitaDelTablet();
  const sullIPad = capacita?.piattaforma === "ios";
  const senzaLuce = Boolean(capacita) && !capacita.luce;
  const senzaVicino = Boolean(capacita) && !capacita.prossimita;
  const sole = allStates()?.["sun.sun"];
  const notaDelGiorno =
    l.giorno === "stanza"
      ? capacita?.luce
        ? t(
            "Col sensore di luce di questo tablet: è notte quando la stanza è buia",
            "With this tablet's light sensor: it is night when the room is dark",
          )
        : senzaLuce
          ? t(
              "Questo tablet non ha il sensore di luce: vale il sole di casa",
              "This tablet has no light sensor: the home's sun applies",
            )
          : t(
              "Col sensore di luce del tablet, solo nell'app GdAHome su Android. Senza, vale il sole di casa",
              "With the tablet's light sensor, only in the GdAHome app on Android. Without it, the home's sun applies",
            )
      : l.giorno === "orario"
        ? t(
            "Notte nella fascia di «Di notte schermo nero», anche con l'interruttore spento",
            "Night in the hours of “Black screen at night”, even with its switch off",
          )
        : sole
          ? t(
              "Col sole: notte da mezz'ora dopo il tramonto all'alba",
              "By the sun: night from half an hour after sunset to sunrise",
            )
          : t(
              "Home Assistant non ha sun.sun: vale l'orario di «Di notte schermo nero»",
              "Home Assistant has no sun.sun: the hours of “Black screen at night” apply",
            );
  const voci = [
    ["sole", t("Sole di casa", "Home's sun"), false],
    ["stanza", t("Luce della stanza", "Room light"), sullIPad || senzaLuce],
    ["orario", t("Orario", "Hours"), false],
  ];
  const giorno = `<span class="mu-ed-seg">${voci
    .map(
      ([v, testo, spento]) =>
        `<button type="button" class="${v === l.giorno ? "si" : ""}" data-mu-ed-metti="luce.giorno" data-mu-ed-valore="${v}"${spento && v !== l.giorno ? " disabled" : ""}>${esc(testo)}</button>`,
    )
    .join("")}</span>`;
  const livelli = l.attiva
    ? `<div class="mu-ed-sotto-titolo">${esc(t("Quanto è luminoso", "How bright"))}</div>
    ${riga(t("Quando qualcuno è vicino", "When someone is nearby"), t("Al tocco o all'arrivo di qualcuno", "On a touch or when someone arrives"), cursore("luce.vicino", l.vicino, 10, t("Quando qualcuno è vicino", "When someone is nearby")))}
    ${riga(t("A riposo, di giorno", "Resting, by day"), t("Si legge l'orologio, ma non illumina la stanza", "The clock is readable, but it does not light up the room"), cursore("luce.riposo", l.riposo, 0, t("A riposo, di giorno", "Resting, by day")))}
    ${riga(t("Di notte", "At night"), t("0% = schermo nero, come «Di notte schermo nero»", "0% = black screen, like “Black screen at night”"), cursore("luce.notte", l.notte, 0, t("Di notte", "At night")))}
    ${riga(
      t("Abbassa dopo", "Dim after"),
      t("Tempo senza nessuno vicino e senza tocchi", "Time with nobody nearby and no touches"),
      tendina(
        "luce.dopo",
        l.dopo,
        SECONDI_PER_ABBASSARE.map((n) => [n, n < 60 ? `${n} s` : `${n / 60} min`]),
        null,
      ),
    )}
    ${riga(
      t("Giorno e notte da", "Day and night from"),
      notaDelGiorno,
      `${giorno}${l.giorno === "orario" ? `${campo("notte.da", m.notte.da, "23:00", "time")}${campo("notte.a", m.notte.a, "06:30", "time")}` : ""}`,
    )}
    ${sullIPad ? `<div class="mu-ed-nota">${esc(t("Sull'iPad la luce della stanza non si legge: giorno e notte li dice il sole o l'orario.", "On the iPad the room light cannot be read: the sun or the hours tell day from night."))}</div>` : ""}
    <div class="mu-ed-sotto-titolo">${esc(t("Anteprima di una giornata", "Preview of a day"))}</div>
    ${anteprimaDellaGiornata(m)}`
    : "";
  const sensore = m.risveglio.entita;
  const letto = sensore ? allStates()?.[sensore] : null;
  /* Il sensore scelto sta gia' nella casella a destra: qui solo come sta
   * adesso, col nome che gli ha dato Home Assistant, non con l'entita'. */
  const statoDelSensore = letto
    ? `<span class="mu-ed-stato-sensore" data-mu-ed-stato-sensore><i class="${letto.state === "on" ? "on" : ""}"></i>${esc(clean(letto.attributes?.friendly_name) || t("sensore di presenza", "presence sensor"))} · ${esc(letto.state === "on" ? t("rileva", "detecting") : t("nessuno", "nobody"))}</span>`
    : "";
  const notaDelTablet = capacita?.prossimita
    ? t("Questo tablet ce l'ha.", "This tablet has one.")
    : sullIPad
      ? t("Sull'iPad non c'è.", "The iPad does not have one.")
      : senzaVicino
        ? t("Questo tablet non ce l'ha.", "This tablet does not have one.")
        : t("Solo nell'app GdAHome su Android.", "Only in the GdAHome app on Android.");
  return `<div class="mu-ed-luce" data-mu-ed-luce>
    <div class="mu-ed-luce-testa"><span class="mu-ed-luce-ic" aria-hidden="true">☀️</span><div class="mu-ed-testo"><b>${esc(t("Luminosità dello schermo", "Screen brightness"))}</b><small>${esc(t("La comanda il pannello, solo nell'app GdAHome sul tablet", "The panel sets it, only in the GdAHome app on the tablet"))}</small></div>${interruttore("luce.attiva", l.attiva, "luce")}</div>
    ${livelli}
    <div class="mu-ed-sotto-titolo">${esc(t("Chi c'è vicino · basta una fonte", "Who is nearby · one source is enough"))}</div>
    <div class="mu-ed-fonte" data-mu-ed-fonte="presenza">
      <span class="mu-ed-fonte-em" aria-hidden="true">📡</span>
      <div class="mu-ed-testo"><b>${esc(t("Sensore di presenza di casa", "Home presence sensor"))} <span class="mu-ed-chip">${esc(t("CONSIGLIATO", "RECOMMENDED"))}</span></b><small>${esc(t("Un sensore di Home Assistant: mmWave, movimento, occupazione. Quando si accende il pannello si sveglia.", "A Home Assistant sensor: mmWave, motion, occupancy. When it turns on the panel wakes up."))}</small>${statoDelSensore}</div>
      <div class="mu-ed-dx">${cerca("risveglio.entita", sensore, { domini: "binary_sensor" })}${interruttore("risveglio.attivo", m.risveglio.attivo, "risveglio")}</div>
    </div>
    <div class="mu-ed-fonte${senzaVicino ? " assente" : ""}" data-mu-ed-fonte="prossimita">
      <span class="mu-ed-fonte-em" aria-hidden="true">📳</span>
      <div class="mu-ed-testo"><b>${esc(t("Sensore di prossimità del tablet", "Tablet proximity sensor"))}</b><small>${esc(t("Vicino allo schermo, pochi centimetri: utile per la mano che si avvicina. Non tutti i tablet lo hanno.", "Close to the screen, a few centimetres: handy for a hand reaching out. Not every tablet has one."))} ${esc(notaDelTablet)}</small></div>
      <div class="mu-ed-dx">${senzaVicino && !l.prossimita ? `<span class="mu-ed-int fermo" aria-checked="false"><i></i></span>` : interruttore("luce.prossimita", l.prossimita, "prossimita")}</div>
    </div>
    <div class="mu-ed-nota">${esc(t("Anche un tocco sullo schermo vale come «qualcuno vicino».", "A touch on the screen also counts as “someone nearby”."))}</div>
  </div>`;
}

function corpoMarkup() {
  const m = bozza();
  const premium = state.premium === true;
  const plance = state.plance?.length ? state.plance : [{ profilo: "primary", titolo: "GdAHome" }];
  const qui = currentProfile();
  /* Tutte le plance, questa compresa. «Quel flag che sceglievo da dove
   * prendere i dati facendo la plancia nuova non c'e' piu'»: l'elenco lasciava
   * fuori la plancia in cui si e', e con due plance ne restava una sola — la
   * riga spariva e il pannello restava legato alla principale. */
  const altre = plance;
  const sporca = bozzaSporca();
  const contenuto = `
  ${sporca ? `<div class="mu-ed-sporca" role="status">● ${esc(t("Modifiche non salvate: il tablet le vede dopo «Salva».", "Unsaved changes: the tablet sees them after «Save»."))}</div>` : ""}
  <div class="ed-intro">${esc(
    t(
      "Il pannello del tablet a muro. Scegli le pagine — le linguette in alto — e cosa c'è in ognuna. Sul tablet, tenendo premuto l'orologio per due secondi si torna qui.",
      "The wall tablet's panel. Choose the pages — the tabs at the top — and what each one holds. On the tablet, holding the clock for two seconds brings you back here.",
    ),
  )} <span class="mu-ed-premium">PREMIUM</span></div>
  <div class="mu-ed-blocco">
    ${riga(t("Usa questa plancia a muro", "Use this dashboard on the wall"), t("Vale su ogni tablet che apre questa plancia", "Applies to every tablet that opens this dashboard"), interruttore("attiva", m.attiva, "attiva"))}
    ${
      altre.length > 1
        ? riga(
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
                p.profilo === qui
                  ? `${p.titolo} (${t("questa plancia", "this dashboard")})`
                  : p.profilo === "primary"
                    ? `${p.titolo} (${t("principale", "main")})`
                    : p.titolo,
              ]),
              null,
            ),
          )
        : ""
    }
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
  <button type="button" class="mu-ed-altro" data-mu-ed-altro aria-expanded="${state.altro}"><span>⚙️ ${esc(t("Altre impostazioni", "More settings"))}</span><small>${esc(t("Orientamento, tema, meteo, riposo, notte, luminosità, PIN", "Orientation, theme, weather, rest, night, brightness, PIN"))}</small><span class="mu-ed-freccia" aria-hidden="true">${state.altro ? "▾" : "▸"}</span></button>
  ${
    state.altro
      ? `<div class="mu-ed-blocco">
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
      t("Menu di lato", "Side menu"),
      t(
        "Le pagine in una colonna di tasti grandi a sinistra, come sui pannelli di regia. Solo in orizzontale: in verticale e sugli schermi piccoli restano le linguette in alto",
        "The pages in a column of big buttons on the left, like on control-room panels. Landscape only: in portrait and on small screens the tabs at the top stay",
      ),
      interruttore("menuDiLato", m.menuDiLato, "menu-di-lato"),
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
      t("Meteo", "Weather"),
      t(
        "In alto e sul riposo. Vuoto: il primo che Home Assistant ha",
        "At the top and on the rest screen. Empty: the first one Home Assistant has",
      ),
      cerca("meteo", m.meteo, { domini: "weather" }),
    )}
    ${
      /* «Il meteo lo possiamo scegliere, ma la temperatura no.» Accanto al
       * disegno del meteo, in alto e sul riposo, la temperatura del meteo
       * (fuori) o quella di un sensore in casa. Il sensore e' lo stesso campo
       * della riga «Temperatura sul riposo» (`riposo.sensore`): scelto «da
       * un sensore», sale qui e la riga sotto non si ripete; due caselle per
       * la stessa «temperatura in casa» potevano dire due numeri diversi. Il
       * segnaposto parla di temperatura, e la ricerca propone per primi i
       * sensori di temperatura (`fieldHints`). */
      riga(
        t("Temperatura mostrata", "Temperature shown"),
        m.temperatura === "casa"
          ? t(
              "Quella del sensore scelto, in alto e sul riposo, con il tempo del meteo accanto. Vuoto: quella della stanza della prima pagina",
              "The chosen sensor's, at the top and on the rest screen, with the weather beside it. Empty: the one of the first page's room",
            )
          : t(
              "Quella di fuori, del meteo scelto qui sopra",
              "The outdoor one, from the weather chosen above",
            ),
        `${scelte("temperatura", m.temperatura, [
          ["meteo", t("Dal meteo", "From the weather")],
          ["casa", t("Da un sensore", "From a sensor")],
        ])}${
          m.temperatura === "casa"
            ? cerca("riposo.sensore", m.riposo.sensore, {
                domini: "sensor",
                segnaposto: t("Sensore della temperatura", "Temperature sensor"),
              })
            : ""
        }`,
      )
    }
    ${m.temperatura === "casa" ? dovesta(m) : ""}
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
    ${riga(t("Al riposo torna alla prima pagina", "On rest go back to the first page"), t("Spento, il tablet resta sulla pagina dov'era", "Off, the tablet stays on the page it was on"), interruttore("riposo.torna", m.riposo.torna, "torna"))}
    ${m.temperatura === "casa" ? "" : riga(t("Temperatura sul riposo", "Temperature on the rest screen"), t("Vuoto: quella della stanza della prima pagina", "Empty: the one of the first page's room"), cerca("riposo.sensore", m.riposo.sensore, { domini: "sensor", segnaposto: t("Sensore della temperatura", "Temperature sensor") }))}${m.temperatura === "casa" ? "" : dovesta(m)}
    ${riga(t("Di notte schermo nero", "Black screen at night"), t("Nella fascia scelta il riposo spegne anche l'orologio", "In the chosen hours rest turns off the clock too"), `${campo("notte.da", m.notte.da, "23:00", "time")}${campo("notte.a", m.notte.a, "06:30", "time")}${interruttore("notte.attiva", m.notte.attiva, "notte")}`)}
    ${luceMarkup(m)}
    ${riga(t("Avvisi sul riposo", "Alerts while resting"), t("Gli avvisi personalizzati accesi e l'antifurto che suona compaiono anche a schermo spento", "Active custom alerts and a triggered alarm show even on the rest screen"), interruttore("avvisi", m.avvisi, "avvisi"))}
    ${riga(t("Avvisi a tutto schermo", "Full-screen alerts"), t("Quando un avviso si accende o l'antifurto suona, il pannello si sveglia e lo mostra grande finché qualcuno tocca «Ho visto»", "When an alert turns on or the alarm goes off, the panel wakes up and shows it big until someone taps “Got it”"), interruttore("avvisiGrandi", m.avvisiGrandi, "avvisi-grandi"))}
    ${riga(
      t("Batteria del tablet", "Tablet battery"),
      t(
        "Sul riposo: quanto è carica e se è attaccata alla corrente",
        "On the rest screen: how charged it is and whether it is plugged in",
      ),
      interruttore("batteria.attiva", m.batteria.attiva, "batteria"),
    )}
    ${
      m.batteria.attiva
        ? `${riga(
            t("Livello della batteria", "Battery level"),
            t(
              "Per esempio il sensore della batteria dell'app di Home Assistant. Vuoto: quella che dà il browser del tablet",
              "For example the battery sensor of the Home Assistant app. Empty: the one the tablet's browser gives",
            ),
            cerca("batteria.livello", m.batteria.livello, { domini: "sensor" }),
          )}
    ${riga(
      t("In carica", "Charging"),
      t(
        "Facoltativo: il sensore «in carica» o lo stato della batteria",
        "Optional: the “is charging” sensor or the battery state",
      ),
      cerca("batteria.carica", m.batteria.carica, { domini: "binary_sensor,sensor" }),
    )}`
        : ""
    }
    ${riga(t("Blocca il tablet", "Lock the tablet"), t("Per uscire dal pannello serve il PIN, da 4 a 8 cifre", "Leaving the panel needs the PIN, 4 to 8 digits"), `${campo("blocco.pin", m.blocco.pin, "PIN", "password")}${interruttore("blocco.attivo", m.blocco.attivo, "blocco")}`)}
    ${riga(t("Antifurto e serrature chiedono il codice", "Alarm and locks ask for the code"), t("Sempre, quando la centrale ne ha uno", "Always, when the panel has one"), `<span class="mu-ed-int fermo" aria-checked="true"><i></i></span>`)}
  </div>`
      : ""
  }
  <button type="button" class="ed-save-btn" data-mu-ed-salva>💾 ${esc(t("Salva", "Save"))}</button>`;
  if (premium || state.premium === null)
    return `<div class="mu-ed">${state.premium === null ? `<div class="mu-ed-nota">${esc(t("Controllo la licenza…", "Checking the licence…"))}</div>` : ""}${contenuto}</div>`;
  return `<div class="mu-ed mu-ed-chiuso"><div class="mu-ed-dietro" aria-hidden="true">${contenuto}</div>
    <div class="mu-ed-lucchetto">${disegno("evidenza", 44, "lucchetto")}
      <b>${esc(t("La plancia a muro è Premium", "The wall dashboard is Premium"))}</b>
      <p>${esc(
        t(
          "Con GdAHome Base questa plancia resta una plancia normale. Con Premium diventa un pannello per un tablet a muro: Stanza, Scene o Ingresso, in orizzontale e in verticale. Premium si attiva dall'app GdAHome.",
          "With GdAHome Base this dashboard stays a normal dashboard. With Premium it becomes a panel for a wall tablet: Room, Scenes or Entrance, landscape and portrait. Premium is turned on from the GdAHome app.",
        ),
      )}</p></div></div>`;
}

export function ensureMuroEditor() {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== MURO_EDITOR_TAB) {
    if (schedaAttiva() !== MURO_EDITOR_TAB) {
      /* «Ho cambiato scheda e ho perso tutto.» Una bozza con modifiche resta
       * finche' il config e' aperto, e torna quando si torna qui; una bozza
       * uguale al salvato si rilegge, cosi' segue chi salva da un altro
       * telefono. Il config chiuso la butta: si riapre da quello salvato. */
      if (!bozzaSporca() || !doc?.getElementById("editor-modal")) state.bozza = null;
      state.fonte = null;
      state.premium = null;
    }
    return false;
  }
  if (state.fonte === null && state.premium === null && !state.chiedendo) chiediAlPonte();
  chiediLeCapacita();
  const firma = JSON.stringify([
    bozza(),
    Boolean(state.fonte),
    state.premium,
    state.plance?.length,
    state.aperta,
    state.altro,
    state.dueTasti || {},
  ]);
  if (body.dataset.dmMuroEditor === firma && body.querySelector(".mu-ed")) {
    rinfrescaLAnteprima();
    return true;
  }
  body.dataset.dmMuroEditor = firma;
  body.innerHTML = corpoMarkup();
  body.dataset.renderer = MURO_EDITOR_TAB;
  rinfrescaLAnteprima();
  /* Il titolo della scheda lo mette l'alberatura quando il guscio ridisegna;
   * questa scheda si riscrive anche da sola (la risposta del ponte, un tasto
   * premuto), e il titolo si rimette qui. */
  ensureTitoloDellaSezione();
  return true;
}

/* L'anteprima della pagina aperta: il disegno del tablet, rimpicciolito alla
 * larghezza della scheda. Si rifà a ogni modifica della bozza e a ogni cambio
 * di stato della casa, senza ridisegnare i campi sotto le dita. */
function rinfrescaLAnteprima() {
  const posto = doc?.querySelector?.("#ed-body [data-mu-ed-anteprima]");
  if (!posto || !state.fonte) return;
  const m = bozza();
  const i = Number(posto.dataset.muEdAnteprima);
  const verticale = m.orientamento === "verticale";
  const larghezza = verticale ? 800 : 1280;
  const tema =
    m.tema === "chiaro"
      ? "light"
      : m.tema === "scuro"
        ? "dark"
        : doc.documentElement.getAttribute("data-theme") === "light"
          ? "light"
          : "dark";
  const dentro = anteprimaDellaPagina(m, i, state.fonte);
  const scritto = `${tema}|${verticale}|${dentro}`;
  if (posto.dataset.scritto !== scritto) {
    posto.dataset.scritto = scritto;
    posto.innerHTML = `<div class="mu-anteprima" data-tema="${tema}" data-verso="${verticale ? "verticale" : "orizzontale"}" aria-hidden="true">${dentro}</div>`;
  }
  const zoom = Math.min(1, (posto.clientWidth || larghezza / 2) / larghezza);
  const tela = posto.firstElementChild;
  if (tela) tela.style.zoom = String(zoom);
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
    if (pezzi[2] === "ingresso" && ELENCHI_DELL_INGRESSO.includes(pezzi[3]) && pezzi.length === 5) {
      const k = Number(pezzi[4]);
      cambiaElenco(via, (voci) => {
        voci[k] = clean(valore);
        return voci;
      });
      return;
    }
    if (pezzi[2] === "segue") {
      p.scelti = !valore;
      if (p.scelti && !p.comandi.length) p.comandi = comandiProposti(state.fonte || {}, p.stanza);
      state.bozza = muroPulito(m);
      return;
    }
    if (pezzi[2] === "comandi" || pezzi[2] === "scene") {
      /* Un posto: l'entita' o l'azione che ci va dentro, poi il suo aspetto.
       * Le due scelte si escludono: scrivere un'entita' toglie l'azione e
       * viceversa, e svuotarle lascia il posto libero dov'e'. */
      const lista = pezzi[2];
      const k = Number(pezzi[3]);
      const campo = pezzi[4];
      const posti = Array.from(
        { length: postiDellaPagina(p) },
        (_, n) => p[lista][n] || { tipo: "vuoto" },
      );
      const ora = posti[k];
      const scritto = clean(valore);
      const chiave = `pagine.${i}.${lista}.${k}`;
      const inCorso = dueTastiInCorso();
      /* Il tipo del posto: «Due tasti» prende quello che c'era — l'entita'
       * diventa il tasto ON, il nome e il disegno restano — e aspetta il tasto
       * OFF; «Entita' o azione» torna alla card di sempre col solo tasto ON. */
      if (lista === "comandi" && campo === "tipo") {
        const prima = inCorso[chiave] || ora;
        delete inCorso[chiave];
        const aspettoDiPrima = {
          nome: prima.nome || "",
          sotto: prima.sotto || "",
          disegno: prima.disegno || "",
          ...(prima.immagine ? { immagine: prima.immagine } : {}),
        };
        if (valore === "duetasti") {
          const bozzaDelPosto = {
            ...aspettoDiPrima,
            tipo: "duetasti",
            entita: prima.entita || "",
            entitaOff: prima.entitaOff || "",
            stato: prima.stato || "",
          };
          const pulito = comandoPulito(bozzaDelPosto);
          if (pulito) posti[k] = pulito;
          else {
            inCorso[chiave] = bozzaDelPosto;
            posti[k] = { tipo: "vuoto" };
          }
        } else if (prima.tipo === "duetasti")
          posti[k] = prima.entita
            ? { ...aspettoDiPrima, tipo: tipoDellEntita(prima.entita), entita: prima.entita }
            : { tipo: "vuoto" };
        p[lista] = posti;
        p.scelti = true;
        state.bozza = muroPulito(m);
        return;
      }
      /* Un campo di un posto dei due tasti: si scrive nella sua bozza, e il
       * posto prende il riquadro appena ha tutti e due i tasti. */
      if (
        lista === "comandi" &&
        campo !== "svuota" &&
        (inCorso[chiave] || ora.tipo === "duetasti")
      ) {
        const scrittoQui = { ...(inCorso[chiave] || ora), tipo: "duetasti", [campo]: valore };
        const pulito = comandoPulito(scrittoQui);
        if (pulito) {
          delete inCorso[chiave];
          posti[k] = pulito;
        } else {
          inCorso[chiave] = scrittoQui;
          posti[k] = { tipo: "vuoto" };
        }
        p[lista] = posti;
        p.scelti = true;
        state.bozza = muroPulito(m);
        return;
      }
      if (campo === "svuota") delete inCorso[chiave];
      /* Il nome scritto a mano era di quello che c'era prima: con un'altra
       * entita' o un'altra azione nel posto, il nome torna il suo — quello
       * della scheda Persone per una persona, non quello di chi c'era. */
      const cambiato =
        (campo === "entita" && scritto !== clean(ora.entita)) ||
        (campo === "azione" && scritto !== clean(ora.azione));
      const aspetto = {
        nome: cambiato ? "" : ora.nome || "",
        sotto: ora.sotto || "",
        disegno: ora.disegno || "",
        /* L'immagine e' del posto, non dell'entita': chi cambia la luce del
         * terrazzo con un'altra tiene la foto del terrazzo. */
        ...(ora.immagine ? { immagine: ora.immagine } : {}),
      };
      if (campo === "entita")
        posti[k] = scritto
          ? {
              ...aspetto,
              tipo: lista === "scene" ? "entita" : tipoDellEntita(scritto),
              entita: scritto,
            }
          : ora.azione
            ? ora
            : { tipo: "vuoto" };
      else if (campo === "azione")
        posti[k] = scritto
          ? { ...aspetto, tipo: "azione", azione: scritto }
          : ora.entita
            ? ora
            : { tipo: "vuoto" };
      else if (campo === "svuota") posti[k] = { tipo: "vuoto" };
      else if (ora.tipo !== "vuoto") posti[k] = { ...ora, [campo]: valore };
      p[lista] = posti;
      if (lista === "comandi") p.scelti = true;
      state.bozza = muroPulito(m);
      return;
    }
    if (pezzi[2] === "griglia") {
      p.griglia = Number(valore);
      /* Una stanza che segue i suoi comandi li ripropone per la griglia
       * nuova; quelli scelti a mano restano, fin dove ci stanno. */
      state.bozza = muroPulito(m);
      return;
    }
    if (pezzi[2] === "modello" && p.modello !== valore) {
      m.pagine[i] = {
        ...nuovaPagina(valore, state.fonte || {}, i),
        id: p.id,
        titolo: p.titolo,
        disegno: p.disegno,
        colore: p.colore,
      };
      state.bozza = muroPulito(m);
      return;
    }
  }
  let dove = m;
  /* Nella regia una voce nuova nasce scrivendoci dentro: il canale, il
   * preset o il comando della riga vuota in fondo all'elenco. */
  const crea = REGIA.test(via);
  pezzi.slice(0, -1).forEach((pezzo, n) => {
    const chiave = Number.isInteger(+pezzo) ? +pezzo : pezzo;
    if (crea && dove && dove[chiave] == null)
      dove[chiave] = Number.isInteger(+pezzi[n + 1]) ? [] : {};
    dove = dove?.[chiave];
  });
  if (!dove) return;
  const ultimo = pezzi.at(-1);
  /* Un numero svuotato resta vuoto (la scala «automatica»), non diventa zero. */
  dove[ultimo] =
    typeof dove[ultimo] === "number" && String(valore).trim() !== "" ? Number(valore) : valore;
  /* Un sensore scelto per il risveglio lo accende; il PIN scritto, il blocco. */
  if (via === "risveglio.entita" && valore) m.risveglio.attivo = true;
  if (via === "fonte") state.fonte = null;
  state.bozza = muroPulito(m);
  if (via === "fonte") chiediAlPonte();
}

const REGIA = /^pagine\.\d+\.(mixer|telecamera|pulsanti|fermaTutto)\./;

/* Togliere una voce di un elenco della regia, o aggiungerne una vuota. */
function togliVoce(via) {
  const pezzi = via.split(".");
  const indice = Number(pezzi.pop());
  const m = structuredClone(bozza());
  const elenco = pezzi.reduce(
    (dove, pezzo) => dove?.[Number.isInteger(+pezzo) ? +pezzo : pezzo],
    m,
  );
  if (!Array.isArray(elenco) || !Number.isInteger(indice)) return;
  elenco.splice(indice, 1);
  state.bozza = muroPulito(m);
}
function aggiungiVoce(via) {
  const m = structuredClone(bozza());
  const elenco = via
    .split(".")
    .reduce((dove, pezzo) => dove?.[Number.isInteger(+pezzo) ? +pezzo : pezzo], m);
  if (!Array.isArray(elenco)) return;
  elenco.push({ nome: "", colore: "", canali: [] });
  state.bozza = muroPulito(m);
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
  /* «▶ Prova»: il suono scelto, una volta, al volume scelto. */
  const prova = event.target.closest("[data-mu-ed-prova]");
  if (prova) {
    event.preventDefault();
    const o = opzioniDelCampanello(bozza().pagine?.[Number(prova.dataset.muEdProva)]?.ingresso);
    suonaIlCampanello(o.suono, o.volume, { ripeti: false });
    return;
  }
  const modo = event.target.closest("[data-mu-ed-modo-energia]");
  if (modo) {
    /* Un sensore col segno o due: cambiando modo si svuotano le caselle
     * dell'altro, che altrimenti continuerebbero a valere. */
    event.preventDefault();
    const { muEdModoEnergia: chi, muEdVia: via, muEdValore: valore } = modo.dataset;
    const due = valore === "true";
    const chiave = chi === "rete" ? "reteDue" : "batteriaDue";
    state[chiave] = { ...(state[chiave] || {}), [via]: due };
    const togli =
      chi === "rete"
        ? due
          ? ["rete"]
          : ["prelievo", "immissione"]
        : due
          ? ["potenzaBatteria"]
          : ["carica", "scarica"];
    for (const k of togli) metti(`${via}.energia.${k}`, "");
    ridisegna();
    return;
  }
  const el = event.target.closest(
    "[data-mu-ed-alterna],[data-mu-ed-metti],[data-mu-ed-nuova],[data-mu-ed-togli],[data-mu-ed-pagina-su],[data-mu-ed-pagina-giu],[data-mu-ed-posto-su],[data-mu-ed-posto-giu],[data-mu-ed-salva],[data-mu-ed-pick],[data-mu-ed-svuota],[data-mu-ed-apri],[data-mu-ed-altro],[data-mu-ed-copia],[data-mu-ed-togli-voce],[data-mu-ed-aggiungi-voce],[data-mu-ed-sposta]",
  );
  if (!el || body.querySelector(".mu-ed-chiuso")) return;
  event.preventDefault();
  const d = el.dataset;
  if (d.muEdPick) {
    /* La ricerca del config: scrive nella casella e manda «change», che qui
     * sotto passa per `onChange` come una scrittura a mano. */
    const casella = doc.getElementById(d.muEdPick);
    if (casella) root.wzPickEntity?.(casella);
    return;
  }
  if (d.muEdApri !== undefined) {
    const i = Number(d.muEdApri);
    state.aperta = state.aperta === i ? -1 : i;
    ridisegna();
    return;
  }
  if (d.muEdAltro !== undefined) {
    state.altro = !state.altro;
    ridisegna();
    return;
  }
  if (d.muEdSvuota) {
    metti(`${d.muEdSvuota}.svuota`, "");
    ridisegna();
    return;
  }
  if (d.muEdSposta) {
    const da = Number(d.muEdDa);
    cambiaElenco(`${d.muEdSposta}.0`, (voci) => sposta(voci, da, da + Number(d.muEdVerso)));
    ridisegna();
    return;
  }
  if (d.muEdTogliVoce) {
    togliVoce(d.muEdTogliVoce);
    ridisegna();
    return;
  }
  if (d.muEdAggiungiVoce) {
    aggiungiVoce(d.muEdAggiungiVoce);
    ridisegna();
    return;
  }
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
    state.aperta = state.bozza.pagine.length - 1;
  } else if (d.muEdCopia !== undefined) {
    /* Una pagina uguale, subito dopo: si cambia la stanza e si e' fatto. */
    const m = structuredClone(bozza());
    const i = Number(d.muEdCopia);
    const copia = structuredClone(m.pagine[i]);
    if (!copia || m.pagine.length >= PAGINE_AL_MASSIMO) return;
    copia.id = nuovaPagina(copia.modello, {}, i + 1).id;
    copia.titolo = copia.titolo ? `${copia.titolo} 2`.slice(0, 32) : "";
    m.pagine.splice(i + 1, 0, copia);
    state.dueTasti = {};
    state.bozza = muroPulito(m);
    state.aperta = i + 1;
  } else if (d.muEdTogli !== undefined) {
    const m = structuredClone(bozza());
    m.pagine.splice(Number(d.muEdTogli), 1);
    state.dueTasti = {};
    state.bozza = muroPulito(m);
    state.aperta = -1;
  } else if (d.muEdPaginaSu !== undefined || d.muEdPaginaGiu !== undefined) {
    const m = structuredClone(bozza());
    const i = Number(d.muEdPaginaSu ?? d.muEdPaginaGiu);
    const verso = d.muEdPaginaSu !== undefined ? i - 1 : i + 1;
    m.pagine = sposta(m.pagine, i, verso);
    state.dueTasti = {};
    if (state.aperta === i) state.aperta = verso;
    state.bozza = muroPulito(m);
  } else if (d.muEdPostoSu !== undefined || d.muEdPostoGiu !== undefined) {
    const [i, k] = String(d.muEdPostoSu ?? d.muEdPostoGiu)
      .split(".")
      .map(Number);
    const m = structuredClone(bozza());
    const p = m.pagine[i];
    const lista = d.muEdLista === "scene" ? "scene" : "comandi";
    /* I due tasti ancora a meta' stanno per posto: spostando i posti non
     * saprebbero piu' di chi sono, e si lasciano. */
    state.dueTasti = {};
    /* Anche i posti vuoti si spostano: «il quinto lo voglio libero». */
    const posti = Array.from(
      { length: postiDellaPagina(p) },
      (_, n) => p[lista][n] || { tipo: "vuoto" },
    );
    p[lista] = sposta(posti, k, d.muEdPostoSu !== undefined ? k - 1 : k + 1);
    if (lista === "comandi") p.scelti = true;
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
  /* Le scritte — nomi, righe sotto, il PIN — si salvano lettera per lettera e
   * non ridisegnano la scheda quando si lasciano. Ridisegnarla li' rifaceva i
   * tasti proprio sotto il dito: si scriveva un nome, si toccava «svuota» o
   * una freccia, e il tocco finiva su un tasto che non c'era piu'. */
  if (event.type === "change" && !SCRITTE.test(via)) ridisegna();
  else dopoUnaScritta();
}
const SCRITTE =
  /(\.nome|\.sotto|\.titolo|\.nomeApri2?|^blocco\.pin|Comando|\.comando|\.dispositivo|\.min|\.max)$/;

/* Le voci che portano un'immagine: i posti e le scene, i comandi della regia,
 * i canali del mixer e il volume totale, la telecamera con i comandi. */
const VIE_CON_IMMAGINE =
  /^pagine\.\d+\.((comandi|scene|pulsanti)\.\d+|mixer\.(master|gruppi\.\d+\.canali\.\d+)|telecamera)$/;

/* L'immagine scelta nel blocco di un posto: la chiave del blocco e' la via
 * del posto. Si scrive nella bozza come una scritta — il blocco si e' gia'
 * rifatto da se', e ridisegnare la scheda chiuderebbe la scelta dei disegni
 * sotto il dito — e l'anteprima del tablet la mostra subito. */
function onImmagine(event) {
  const body = doc?.getElementById("ed-body");
  if (!body || schedaAttiva() !== MURO_EDITOR_TAB || !body.contains(event.target)) return;
  const via = String(event.detail?.chiave || "");
  if (!VIE_CON_IMMAGINE.test(via)) return;
  metti(`${via}.immagine`, event.detail?.immagine || null);
  dopoUnaScritta();
  /* Il nome accanto al «Disegno» dice «se non c'e' immagine» solo quando
   * un'immagine c'e': quella riga si aggiorna senza rifare la scheda. */
  const voce = body.querySelector(`[data-mu-ed-campo="${via}.disegno"]`)?.closest(".mu-ed-voce");
  const scritta = voce?.querySelector(":scope > span:not([data-mu-ed-icona])");
  if (scritta)
    scritta.textContent = event.detail?.immagine
      ? t("Disegno (se non c'è immagine)", "Drawing (when there is no image)")
      : t("Disegno", "Drawing");
}

/* Le scritte non ridisegnano la scheda, ma l'anteprima e l'avviso «non
 * salvate» si': sono fuori dai campi, e non rubano il tocco a nessuno. */
function dopoUnaScritta() {
  rinfrescaLAnteprima();
  const avviso = doc?.querySelector?.("#ed-body .mu-ed-sporca");
  if (!avviso && bozzaSporca()) {
    const nuovo = doc.createElement("div");
    nuovo.className = "mu-ed-sporca";
    nuovo.setAttribute("role", "status");
    nuovo.textContent = `● ${t("Modifiche non salvate: il tablet le vede dopo «Salva».", "Unsaved changes: the tablet sees them after «Save».")}`;
    doc.querySelector("#ed-body .mu-ed")?.prepend(nuovo);
  }
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
#ed-body .mu-ed-riga{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:10px 12px;margin-top:8px;border-radius:12px;background:var(--card-background-color,var(--card-bg,#fff));border:1px solid var(--divider-color,#dbe4ee)}
#ed-body .mu-ed-testo{flex:1 1 220px;min-width:0}
#ed-body .mu-ed-testo b{display:block;font-size:13px}
#ed-body .mu-ed-testo small{display:block;margin-top:2px;font-size:11.5px;line-height:1.4;color:var(--text-dim,#64748b)}
#ed-body .mu-ed-testo small.mu-ed-aiuto{margin-top:6px;padding:6px 9px;border-radius:8px;background:color-mix(in srgb,#0ea5e9 9%,transparent);color:var(--text,inherit)}
#ed-body .mu-ed-testo small.mu-ed-avviso{margin-top:6px;padding:6px 9px;border-radius:8px;background:color-mix(in srgb,#f59e0b 14%,transparent);color:var(--text,inherit)}
#ed-body .mu-ed-dx{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;flex:0 1 auto;min-width:0;max-width:100%;margin-left:auto}
#ed-body .mu-ed-dx .ed-input{margin:0;width:auto;min-width:150px;max-width:260px}
#ed-body .mu-ed-dx input[type="time"]{min-width:0;width:110px}
#ed-body .mu-ed-dx input[type="password"]{min-width:0;width:120px}
#ed-body .mu-ed-int{position:relative;width:42px;height:24px;flex:0 0 auto;padding:0;border:0;border-radius:999px;background:var(--divider-color,#cbd5e1);cursor:pointer}
#ed-body .mu-ed-int[aria-checked="true"]{background:#0ea5e9}
#ed-body .mu-ed-int.fermo{opacity:.5;cursor:default}
#ed-body .mu-ed-int i{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .18s ease}
#ed-body .mu-ed-int[aria-checked="true"] i{transform:translateX(18px)}
#ed-body .mu-ed-seg{display:inline-flex;flex-wrap:wrap;gap:4px;padding:4px;border-radius:12px;border:1px solid var(--divider-color,#dbe4ee)}
#ed-body .mu-ed-versi{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700}
#ed-body .mu-ed-seg button{border:0;padding:8px 12px;border-radius:9px;background:none;color:var(--text-dim,#64748b);font-weight:800;font-size:12.5px;cursor:pointer}
#ed-body .mu-ed-seg button.si{background:color-mix(in srgb,#0ea5e9 18%,transparent);color:#0369a1;box-shadow:inset 0 0 0 1px #0ea5e999}
html[data-theme="dark"] #ed-body .mu-ed-seg button.si{color:#7dd3fc}
#ed-body .mu-ed-suono{display:flex;gap:8px;align-items:center}
#ed-body .mu-ed-suono .mu-ed-sel{min-width:190px}
#ed-body .mu-ed-prova{border:1px solid color-mix(in srgb,#0ea5e9 45%,transparent);background:color-mix(in srgb,#0ea5e9 12%,transparent);color:#0369a1;border-radius:10px;padding:8px 12px;font-weight:800;font-size:12.5px;white-space:nowrap;cursor:pointer}
#ed-body .mu-ed-prova[disabled]{opacity:.4;cursor:default}
html[data-theme="dark"] #ed-body .mu-ed-prova{color:#7dd3fc}
#ed-body .mu-ed-volume{display:flex;gap:10px;align-items:center}
#ed-body .mu-ed-volume input{width:190px;accent-color:#0ea5e9}
#ed-body .mu-ed-volume b{font-size:13px;font-variant-numeric:tabular-nums;min-width:40px}
#ed-body .mu-ed-pagina-testa{display:flex;align-items:center;gap:10px;font-size:14px}
#ed-body .mu-ed-pagina.chiusa{padding:8px 12px}
#ed-body .mu-ed-apri{flex:1;min-width:0;display:flex;align-items:center;gap:12px;border:0;background:none;padding:4px 0;text-align:left;color:inherit;cursor:pointer}
#ed-body .mu-ed-apri-tx{display:grid;min-width:0}
#ed-body .mu-ed-apri-tx b{font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#ed-body .mu-ed-apri-tx small{font-size:11.5px;color:var(--text-dim,#64748b)}
#ed-body .mu-ed-freccia{margin-left:auto;font-size:14px;color:var(--text-dim,#64748b)}
#ed-body .mu-ed-altro{display:grid;grid-template-columns:1fr auto;align-items:center;width:100%;margin:6px 0 14px;padding:14px 16px;border-radius:14px;border:1px solid var(--divider-color,#dbe4ee);background:color-mix(in srgb,var(--text,#0f172a) 2%,transparent);color:inherit;text-align:left;cursor:pointer}
#ed-body .mu-ed-altro>span:first-child{font-weight:800;font-size:14px}
#ed-body .mu-ed-altro small{grid-column:1;font-size:11.5px;color:var(--text-dim,#64748b)}
#ed-body .mu-ed-altro .mu-ed-freccia{grid-row:1/span 2;grid-column:2}
#ed-body .mu-ed-pagina-testa .ed-del{margin-left:6px}
#ed-body .mu-ed-frecce{display:inline-flex;gap:4px;margin-left:auto}
#ed-body .mu-ed-posto .mu-ed-frecce{margin-left:0}
#ed-body .mu-ed-frecce button{width:28px;height:28px;border-radius:50%;border:1px solid var(--divider-color,#dbe4ee);background:none;color:var(--text-dim,#64748b);font-size:10px;cursor:pointer}
#ed-body .mu-ed-frecce button[disabled]{opacity:.35;cursor:default}
#ed-body .mu-ed-posti{display:grid;gap:8px;margin-top:10px}
#ed-body .mu-ed-posto{padding:8px 10px;border-radius:12px;border:1px solid var(--divider-color,#dbe4ee);background:var(--card-background-color,var(--card-bg,#fff))}
#ed-body .mu-ed-posto.pieno{border-color:color-mix(in srgb,#0ea5e9 45%,var(--divider-color,#dbe4ee))}
#ed-body .mu-ed-posto-testa{display:flex;align-items:center;gap:8px;min-height:30px}
#ed-body .mu-ed-cosa{flex:1;min-width:0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#ed-body .mu-ed-svuota{margin:0;width:30px;height:30px;border-radius:50%;border:1px solid color-mix(in srgb,#ef4444 40%,transparent);background:color-mix(in srgb,#ef4444 8%,transparent);color:#dc2626;font-weight:900;cursor:pointer}
#ed-body .mu-ed-posto-corpo{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px 12px;margin-top:8px;align-items:start}
#ed-body .mu-ed-posto-corpo:empty{display:none}
#ed-body .mu-ed-voce{display:grid;gap:4px;min-width:0}
#ed-body .mu-ed-coppia{grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px 12px;min-width:0}
#ed-body .mu-ed-aiuto{grid-column:1/-1;display:block;margin-top:-2px;font-size:12px;line-height:1.4;color:var(--text-dim,#9ca3af)}
#ed-body .mu-ed-voce>span{font-size:10.5px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;color:var(--text-dim,#64748b)}
#ed-body .mu-ed-voce .ed-input{margin:0;width:100%;max-width:none;min-width:0}
#ed-body .mu-ed-comandi{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px 12px;min-width:0}
#ed-body .mu-ed-comando{display:block;margin-top:6px}
#ed-body .mu-ed-comando .ed-input{margin:0;width:100%;max-width:none}
#ed-body .mu-ed-cerca{display:flex;gap:6px;align-items:center;min-width:0}
#ed-body .mu-ed-cerca .ed-input{flex:1;min-width:0;margin:0}
#ed-body .mu-ed-dx .mu-ed-cerca{min-width:220px;max-width:340px;flex:1}
#ed-body .mu-ed-num{width:24px;height:24px;border-radius:7px;display:grid;place-items:center;font-weight:900;font-size:11px;color:var(--text-dim,#64748b);background:color-mix(in srgb,var(--text,#0f172a) 8%,transparent)}
#ed-body .mu-ed-proposto{font-weight:700;font-size:13px}
#ed-body .mu-ed-sotto-titolo{margin:16px 2px 0;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim,#64748b)}
#ed-body .mu-ed-nota{padding:10px 12px;margin:8px 0;border-radius:10px;font-size:12px;line-height:1.5;color:var(--text-dim,#64748b);background:color-mix(in srgb,#0ea5e9 8%,transparent)}
#ed-body .mu-ed-aggiungi{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 16px;font-weight:800;font-size:13px}
#ed-body .mu-ed-aggiungi .ed-btn-add{width:auto;margin:0;padding:10px 16px}
#ed-body .mu-ed-chiuso{position:relative;min-height:420px}
#ed-body .mu-ed-sporca{margin:0 0 10px;padding:10px 14px;border-radius:12px;font-size:12.5px;font-weight:800;color:#92400e;background:#fef3c7;border:1px solid #f59e0b88}
html[data-theme="dark"] #ed-body .mu-ed-sporca{color:#fde68a;background:#78350f55}
#ed-body .mu-ed-copia{margin:0;width:30px;height:30px;border-radius:50%;border:1px solid var(--divider-color,#dbe4ee);background:none;color:var(--text-dim,#64748b);font-weight:900;cursor:pointer}
#ed-body .mu-ed-colori{display:inline-flex;flex-wrap:wrap;gap:6px}
#ed-body .mu-ed-colori button{width:28px;height:28px;border-radius:50%;border:2px solid transparent;background:var(--c);cursor:pointer;padding:0;font-size:10px;font-weight:900;color:var(--text-dim,#64748b)}
#ed-body .mu-ed-colori button.auto{background:conic-gradient(#f59e0b,#ef4444,#8b5cf6,#0ea5e9,#10b981,#f59e0b);color:#fff}
#ed-body .mu-ed-colori button.si{border-color:var(--text,#0f172a);box-shadow:0 0 0 2px var(--card-background-color,#fff) inset}
#ed-body .mu-ed-anteprima-box{margin-top:10px}
#ed-body .mu-ed-gruppo{margin-top:12px;padding:10px 12px 12px;border-radius:14px;border:1px solid var(--divider-color,#dbe4ee);border-left:4px solid var(--c);background:color-mix(in srgb,var(--c) 5%,transparent)}
#ed-body .mu-ed-gruppo>.mu-ed-posto-testa .mu-ed-cosa{font-size:14px}
#ed-body .mu-ed-piu{width:auto;margin:12px 0 0;padding:10px 16px}
#ed-body .mu-ed-lettori{display:grid;gap:8px;min-width:240px;flex:1}
#ed-body .mu-ed-elenco-voce{display:flex;align-items:center;gap:6px;min-width:0}
#ed-body .mu-ed-elenco-voce>.mu-ed-cerca{flex:1;min-width:0}
#ed-body .mu-ed-elenco-voce>.mu-ed-frecce{margin-left:0}
#ed-body .mu-ed-anteprima{margin-top:8px;width:100%;max-width:720px;overflow:hidden;border-radius:14px;border:1px solid var(--divider-color,#dbe4ee)}
#ed-body .mu-ed-dietro{filter:blur(2px);opacity:.4;pointer-events:none;max-height:520px;overflow:hidden}
#ed-body .mu-ed-luce{margin-top:8px;padding:12px;border-radius:14px;border:1px solid color-mix(in srgb,#f59e0b 40%,var(--divider-color,#dbe4ee));background:color-mix(in srgb,#f59e0b 5%,transparent)}
#ed-body .mu-ed-luce-testa{display:flex;align-items:center;gap:12px}
#ed-body .mu-ed-luce-testa .mu-ed-testo b{font-size:15px}
#ed-body .mu-ed-luce-ic{flex:none;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;font-size:19px;background:linear-gradient(135deg,#fde68a,#f59e0b)}
#ed-body .mu-ed-luce-cursore{width:280px;max-width:100%}
#ed-body .mu-ed-luce-cursore input{flex:1 1 auto;width:auto;min-width:0;accent-color:#f59e0b}
#ed-body .mu-ed-luce-cursore b{font-family:Oswald,Inter,sans-serif;font-size:16px;color:#b45309;text-align:right}
html[data-theme="dark"] #ed-body .mu-ed-luce-cursore b{color:#fde68a}
#ed-body .mu-ed-luce .mu-ed-seg button[disabled]{opacity:.4;cursor:not-allowed}
#ed-body .mu-ed-fonte{display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px;padding:10px 12px;margin-top:8px;border-radius:12px;background:var(--card-background-color,var(--card-bg,#fff));border:1px solid var(--divider-color,#dbe4ee)}
#ed-body .mu-ed-fonte.assente{opacity:.65}
#ed-body .mu-ed-fonte-em{flex:none;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;font-size:17px;background:color-mix(in srgb,var(--text,#0f172a) 7%,transparent)}
#ed-body .mu-ed-fonte>.mu-ed-testo{flex:1 1 200px}
#ed-body .mu-ed-chip{display:inline-block;margin-left:4px;padding:2px 7px;border-radius:6px;font-size:9.5px;font-weight:900;letter-spacing:.08em;vertical-align:1px;color:#1d4ed8;background:color-mix(in srgb,#3b82f6 14%,transparent)}
html[data-theme="dark"] #ed-body .mu-ed-chip{color:#bfdbfe}
#ed-body .mu-ed-stato-sensore{display:flex;align-items:center;gap:7px;margin-top:5px;font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b);overflow-wrap:anywhere}
#ed-body .mu-ed-stato-sensore i{flex:none;width:8px;height:8px;border-radius:50%;background:#94a3b8}
#ed-body .mu-ed-stato-sensore i.on{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.2)}
#ed-body .mu-ed-giornata{margin-top:8px;padding:10px 12px;border-radius:12px;background:var(--card-background-color,var(--card-bg,#fff));border:1px solid var(--divider-color,#dbe4ee)}
#ed-body .mu-ed-grafico{display:grid;grid-template-columns:auto 1fr;column-gap:8px}
#ed-body .mu-ed-grafico svg{grid-column:2;display:block;width:100%;height:130px;overflow:visible}
#ed-body .mu-ed-asse-y{grid-row:1;display:flex;flex-direction:column;justify-content:space-between;height:142px;margin:-6px 0;line-height:12px;font-size:10.5px;font-weight:700;text-align:right;color:var(--text-dim,#64748b)}
#ed-body .mu-ed-ore{grid-column:2;position:relative;height:18px;margin-top:4px;font-size:10.5px;font-weight:700;color:var(--text-dim,#64748b)}
#ed-body .mu-ed-ore span{position:absolute;top:0;transform:translateX(-50%)}
#ed-body .mu-ed-ore span:first-child{transform:none}
#ed-body .mu-ed-ore span:last-child{transform:translateX(-100%)}
@media (max-width:600px){#ed-body .mu-ed-fonte>.mu-ed-dx{flex:1 1 100%}#ed-body .mu-ed-grafico svg{height:110px}#ed-body .mu-ed-asse-y{height:122px}}
#ed-body .mu-ed-giornata line{stroke:color-mix(in srgb,var(--text,#0f172a) 12%,transparent);vector-effect:non-scaling-stroke}
#ed-body .mu-ed-giornata rect.notte{fill:color-mix(in srgb,#64748b 26%,transparent)}
#ed-body .mu-ed-giornata rect.vicino{fill:#22c55e}
#ed-body .mu-ed-giornata path.luce{fill:none;stroke:#f59e0b;stroke-width:2.5;stroke-linejoin:round;vector-effect:non-scaling-stroke}
#ed-body .mu-ed-leg{display:flex;flex-wrap:wrap;gap:6px 14px;margin-bottom:14px;font-size:11.5px;font-weight:700;color:var(--text-dim,#64748b)}
#ed-body .mu-ed-leg span{display:inline-flex;align-items:center;gap:6px}
#ed-body .mu-ed-leg i{width:10px;height:10px;border-radius:3px}
#ed-body .mu-ed-leg i.luce{background:#f59e0b}
#ed-body .mu-ed-leg i.vicino{background:#22c55e}
#ed-body .mu-ed-leg i.notte{background:color-mix(in srgb,#64748b 45%,transparent)}
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
  doc.addEventListener(EVENTO_IMMAGINE, onImmagine);
  doc.addEventListener("input", (event) => {
    /* Il volume si legge mentre il dito scorre; si scrive al rilascio. */
    if (event.target?.dataset?.muEdCampo?.endsWith(".ingresso.volume")) {
      const scritta = event.target.parentElement?.querySelector?.("[data-mu-ed-volume]");
      if (scritta) scritta.textContent = `${event.target.value}%`;
      return;
    }
    /* Lo stesso per i tre livelli della luminosita'. */
    if (/^luce\.(vicino|riposo|notte)$/.test(event.target?.dataset?.muEdCampo || "")) {
      const scritta = event.target.parentElement?.querySelector?.("[data-mu-ed-percento]");
      if (scritta) scritta.textContent = `${event.target.value}%`;
      return;
    }
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
  /* Anche quando arrivano le previsioni della pagina Meteo: non sono uno
   * stato della casa, e senza questo l'anteprima direbbe «in arrivo». */
  for (const evento of ["dashboardmodern:state-changed", EVENTO_PREVISIONI])
    root.addEventListener?.(evento, () => {
      if (schedaAttiva() === MURO_EDITOR_TAB) rinfrescaLAnteprima();
    });
  root.addEventListener?.("resize", () => {
    if (schedaAttiva() === MURO_EDITOR_TAB) rinfrescaLAnteprima();
  });
  /* L'app ha detto cosa ha il tablet: le righe dei sensori si riscrivono. */
  root.addEventListener?.("gdahome:schermo", (event) => {
    if (event?.detail?.capacita && schedaAttiva() === MURO_EDITOR_TAB && state.altro) ridisegna();
  });
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:editor-rendered"])
    root.addEventListener?.(evento, ancora);
  ensureMuroEditorTab();
  ensureMuroEditor();
  return true;
}

senzaCadere(installPlanciaAMuroEditor);
