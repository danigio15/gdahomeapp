/* La riga per cercare, in cima alla configurazione.
 *
 * «Implementa una funzione cerca che possa cercare all'interno di tutto il
 * config quella parola, così da velocizzare le modifiche e le
 * configurazioni.»
 *
 * Le schede sono venti e ognuna si disegna solo quando la si apre: per sapere
 * dove sta scritto un sensore bisognava aprirle tutte. Qui si scrive la parola
 * una volta e si vede subito ogni posto in cui compare — la scheda, la riga, il
 * campo e cosa c'e' scritto. Un tocco sul risultato apre quella scheda.
 *
 * Non si cerca nel disegno: si cerca nel magazzino, che e' JSON e si cammina
 * (vedi `core/cerca-nel-config.js`). Cercare aprendo le schede vorrebbe dire
 * ridisegnarle tutte, e un modulo aperto a meta' perde quello che si stava
 * scrivendo dentro.
 */
import { cercaNelConfig } from "../core/cerca-nel-config.js";
import { cercaFraLeCaselle, leCaselleDelConfig } from "../core/le-caselle-del-config.js";
import { isRetiredEditorSlot } from "../core/editor-slots.js";
import { SECTION_KEYS } from "../core/migrations.js";
import { CONFIG_KEYS } from "./config-persistence-section.js";
import {
  activeLocale,
  clean,
  doc,
  esc,
  installStyle,
  onEditorRedraw,
  readJson,
  root,
  t,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_CERCA_CONFIG__";
const state = (root[KEY] ||= { installed: false, parola: "", aperta: false, raccolte: null });

const BARRA = "dm-cerca-config";
const STILE = "dm-cerca-config-style";

/* Dove si va a mettere le mani, casella per casella.
 *
 * Il nome della scheda non si scrive qui: si legge dalla linguetta, che ce
 * l'ha gia' nella lingua giusta. Qui c'e' solo la corrispondenza fra la
 * casella del magazzino e la linguetta che la governa. Una casella che non
 * compare in questa tabella si trova lo stesso — il risultato esce col nome
 * della casella e senza salto — perche' non trovare e' peggio che non saper
 * saltare. */
const SCHEDA_DELLA_CASELLA = Object.freeze({
  cd_stanze: "stanze",
  cd_stanze_entita: "stanze",
  cd_floors: "stanze",
  cd_luci: "luci",
  cd_luci_rooms: "luci",
  cd_luci_order: "luci",
  cd_appliances: "appliances",
  cd_lavatrice_programmi: "appliances",
  cd_loads: "sez1",
  cd_energy_model: "sez1",
  cd_flow_nodes: "sez1",
  cd_subloads_extra: "sez1",
  cd_subload_groups: "sez1",
  cd_gruppi_extra: "sez1",
  cd_costo_kwh: "sez1",
  cd_fasce_kwh: "sez1",
  cd_prezzo_immissione: "sez1",
  cd_ev_cars: "sez2",
  cd_ev_visual: "sez2",
  cd_solari: "sez3",
  cd_solare_scelto: "sez3",
  cd_cameras: "sez4",
  cd_centrali: "sez4",
  cd_centrale_scelta: "sez4",
  cd_antifurto_modi: "sez4",
  cd_security_doors: "doors",
  cd_clima_units: "sez9",
  cd_termico_caldo: "sez9",
  cd_clima_rapido: "sez9",
  cd_clima_rapido_unita: "sez9",
  cd_caldaia: "sez9",
  cd_scaldabagni: "sez9",
  cd_impianti_termici: "sez9",
  cd_quick_actions: "sez8",
  cd_tapparelle: "tapp",
  cd_tapparelle_soglia: "tapp",
  cd_umidita_soglia: "tapp",
  cd_piscina: "pool",
  cd_irrigazione: "irr",
  cd_avvisi_custom: "avvisi",
  cd_avvisi_icone: "avvisi",
  cd_avvisi_names_extra: "avvisi",
  cd_stati_invertiti: "avvisi",
  cd_allerte: "allerte",
  cd_animali: "animali",
  cd_robot: "robot",
  cd_prese: "prese",
  cd_people: "people",
  cd_todo: "todo",
  cd_ups: "ups",
  cd_calendari: "agenda",
  cd_rifiuti: "rifiuti",
  cd_varchi: "varchi",
  cd_macchine: "sez6",
  cd_media_player: "media",
  cd_sezioni_mie: "mie",
  cd_entita_mie: "entita",
  cd_widgets: "sez0",
  cd_home_blocchi: "sez0",
  cd_barra_casa: "sez0",
  cd_evidenza: "sez0",
  cd_meteo_entita_proprie: "sez0",
  cd_radar_meteo: "sez0",
  cd_sections: "visib",
  cd_section_names: "visib",
  cd_branding: "visib",
});

/* Le sezioni dentro `dm_dashboard_state`, e la scheda che le governa.
 *
 * Quasi tutta la configurazione non sta piu' nelle caselle vecchie: sta nel
 * magazzino dei moduli, tutta insieme, sotto `sections`. Li' la scheda non si
 * ricava dal nome della casella — e' sempre la stessa — ma dal nome della
 * sezione in cui si e' finiti camminando. */
const SCHEDA_DELLA_SEZIONE = Object.freeze({
  rooms: "stanze",
  lights: "luci",
  appliances: "appliances",
  loads: "sez1",
  energy: "sez1",
  energyLoads: "sez1",
  ev: "sez2",
  cameras: "sez4",
  climate: "sez9",
  covers: "tapp",
  pool: "pool",
  irrigation: "irr",
  robots: "robot",
  sockets: "prese",
});

/* Le caselle vecchie che il magazzino dei moduli rispecchia.
 *
 * Le sezioni stanno in tutti e due i posti: in `dm_dashboard_state`, che e' la
 * fonte, e nella casella storica che il guscio continua a scrivere. Leggerle
 * tutte e due vorrebbe dire ogni elettrodomestico due volte nell'elenco dei
 * risultati. Si tiene la fonte. */
const RISPECCHIATE = new Set(Object.values(SECTION_KEYS));

/* Il magazzino, letto una volta per ricerca. */
function magazzino() {
  const fuori = {};
  const canonico = readJson("dm_dashboard_state", null);
  if (canonico) fuori.dm_dashboard_state = canonico;
  for (const chiave of CONFIG_KEYS) {
    if (chiave === "dm_dashboard_state") continue;
    if (canonico && RISPECCHIATE.has(chiave)) continue;
    const valore = readJson(chiave, null);
    if (valore !== null && valore !== undefined) fuori[chiave] = valore;
  }
  return fuori;
}

/* Le entita' mappate a mano non abitano tutte nella stessa scheda.
 *
 * `cd_entity_overrides` — e la sua gemella `entityOverrides` nel magazzino —
 * tengono la mappatura di TUTTA la plancia: `dm.energy_*`, `dm.ev_*`,
 * `dm.security_*`, `dm.server_*`. Erano in tabella come «MiniPC», che e' la
 * scheda dove si mappano a mano le macchine in piu' — giusto per
 * `dm.server_*` e sbagliato per tutti gli altri.
 *
 * Dal campo, cercando «ventola»: il risultato usciva «MiniPC ·
 * dm.energy_interruttore_ventola_inverter», e un tocco portava nella scheda
 * del MiniPC, dove di ventole non se ne parla. Chi cerca dove mettere
 * l'entita' della ventola e finisce nel MiniPC conclude — giustamente — che
 * quella casella non c'e'.
 *
 * La scheda di una casella mappata la dice la CASELLA, non il cassetto in cui
 * sta: `dm.energy_*` e' Energia, `dm.ev_*` sono i Veicoli.
 *
 * L'ordine qui sotto non e' inventato: e' quello delle fisarmoniche che il
 * guscio disegna in `editorRenderSezioni`, che le apre una per scheda — la
 * prima e' Home in `sez0`, la seconda Energia in `sez1`, e via cosi'. E' una
 * domanda diversa da quella di `core/editor-slots.js`, che dice quale SEZIONE
 * della plancia possiede una casella: le due risposte coincidono quasi
 * sempre, e dove non coincidono ha ragione questa, perche' qui si sta dicendo
 * dove si va a scrivere, non chi legge.
 *
 * Due assenze sono volute. La `dm.lavatrice_*` sta nella fisarmonica che
 * sarebbe `sez5`, e una linguetta `sez5` non esiste in nessuna lingua: quelle
 * caselle si aprono dal popup della lavatrice, non da una scheda. Le caselle
 * in pensione (`isRetiredEditorSlot`) stanno in una fisarmonica che il guscio
 * disegna e poi nasconde: chi ce le ha mappate le trova ancora scritte, ma il
 * salto porterebbe davanti a una riga invisibile.
 *
 * Quando la famiglia non si riconosce non si indovina: il risultato esce
 * senza salto. Un salto nella scheda sbagliata e' peggio di nessun salto —
 * manda a cercare dove non c'e' niente, ed e' esattamente il danno da cui si
 * viene. */
const SCHEDA_DELLO_SLOT = Object.freeze({
  "dm.home_": "sez0",
  "dm.energy_": "sez1",
  "dm.ev_": "sez2",
  "dm.boiler_": "sez3",
  "dm.security_": "sez4",
  "dm.server_": "sez6",
});

const CASSETTI_DELLE_MAPPATURE = new Set(["cd_entity_overrides", "entityOverrides"]);

/* La casella mappata sta nel NOME del campo, non nella strada.
 *
 * La ricerca scende fino alla foglia: per `{ "dm.energy_x": "switch.y" }` la
 * strada finisce sul cassetto e il nome della casella esce in `campo`. Si
 * guarda prima li', e la coda della strada resta come seconda possibilita'
 * per il giorno in cui un valore mappato fosse a sua volta un oggetto. */
function schedaDiUnaCasellaMappata(esito) {
  const casella = [clean(esito?.campo), clean(esito?.percorso?.at?.(-1))].find((una) =>
    una.startsWith("dm."),
  );
  if (!casella || isRetiredEditorSlot(casella)) return "";
  return Object.entries(SCHEDA_DELLO_SLOT).find(([inizio]) => casella.startsWith(inizio))?.[1] || "";
}

/* Quale scheda apre questo risultato.
 *
 * Dal magazzino dei moduli la dice la sezione in cui si e' finiti — il pezzo
 * di strada subito dopo `sections` — e dalle caselle vecchie la dice la
 * tabella qui sopra. Se nessuno dei due la sa, il risultato esce lo stesso
 * senza salto: non trovare e' peggio che non saper saltare.
 *
 * Esce di qui perche' e' l'unica regola di questo pezzo che si puo' sbagliare
 * in silenzio: un salto nel posto sbagliato si vede solo aprendo la scheda. */
export function schedaDelRisultato(esito) {
  if (esito.chiave === "dm_dashboard_state") {
    const dopo = esito.percorso?.indexOf?.("sections");
    const sezione = dopo >= 0 ? clean(esito.percorso[dopo + 1]) : "";
    /* Il cassetto delle mappature sta dentro il magazzino come gli altri, ma
     * la sua scheda la dice la casella. */
    if (CASSETTI_DELLE_MAPPATURE.has(sezione)) return schedaDiUnaCasellaMappata(esito);
    return SCHEDA_DELLA_SEZIONE[sezione] || "";
  }
  if (CASSETTI_DELLE_MAPPATURE.has(esito.chiave)) return schedaDiUnaCasellaMappata(esito);
  return SCHEDA_DELLA_CASELLA[esito.chiave] || "";
}

/** Il nome della scheda come lo legge chi guarda: sta scritto sulla linguetta. */
function nomeDellaScheda(scheda) {
  const linguetta = scheda && doc?.querySelector?.(`.ed-tab[data-tab="${CSS.escape(scheda)}"]`);
  return clean(linguetta?.textContent) || "";
}

function linguette() {
  return doc?.querySelector?.(".ed-tab")?.parentElement || null;
}

function installaLoStile() {
  installStyle(
    STILE,
    `
    /* Dentro il corpo e appiccicata in cima, non sopra di lui: una riga in piu'
       fra le linguette e il corpo rubava altezza al modale, e su un telefono
       spingeva fuori dallo schermo le linguette interne delle schede. */
    .${BARRA}{position:sticky!important;top:0!important;z-index:3!important;display:grid!important;gap:8px!important;margin:-8px -4px 8px!important;padding:10px 12px!important;border-bottom:1px solid var(--divider-color,#e2e8f0)!important;background:var(--card-background-color,#fff)!important}
    .${BARRA}-riga{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:8px!important;align-items:center!important}
    .${BARRA}-in{width:100%!important;min-height:42px!important;box-sizing:border-box!important;padding:9px 12px!important;border:1px solid var(--divider-color,#dbe4ee)!important;border-radius:12px!important;background:var(--secondary-background-color,#f8fafc)!important;color:inherit!important;font:inherit!important}
    .${BARRA}-via{min-height:42px!important;padding:0 14px!important;border:0!important;border-radius:12px!important;background:#94a3b8!important;color:#fff!important;font-weight:800!important;cursor:pointer!important}
    .${BARRA}-esiti{display:grid!important;gap:6px!important;max-height:44dvh!important;overflow-y:auto!important}
    /* Un display con l'important vince sull'attributo hidden: nascondere si
       dice qui, o l'elenco resta in pagina anche quando nessuno cerca. */
    .${BARRA} [hidden]{display:none!important}
    .${BARRA}-vuoto{padding:6px 2px!important;font-size:12.5px!important;color:var(--secondary-text-color,#64748b)!important}
    .${BARRA}-esito{display:grid!important;gap:2px!important;width:100%!important;padding:9px 12px!important;border:1px solid var(--divider-color,#e2e8f0)!important;border-radius:12px!important;background:var(--secondary-background-color,#f8fafc)!important;color:inherit!important;font:inherit!important;text-align:left!important;cursor:pointer!important}
    .${BARRA}-esito[data-salta="no"]{cursor:default!important}
    .${BARRA}-dove{font-size:11px!important;font-weight:800!important;letter-spacing:.02em!important;color:var(--secondary-text-color,#64748b)!important}
    .${BARRA}-testo{font-size:13.5px!important;font-weight:750!important;overflow-wrap:anywhere!important}
    .${BARRA}-testo mark{padding:0 1px!important;border-radius:3px!important;background:#fde68a!important;color:#0f172a!important}
    /* Il secondo gruppo si vede che e' un'altra risposta: sopra c'e' quello
       che e' scritto, qui c'e' dove si scrive. */
    .${BARRA}-titolo{margin:8px 2px 0!important;font-size:11px!important;font-weight:900!important;letter-spacing:.06em!important;text-transform:uppercase!important;color:var(--secondary-text-color,#64748b)!important}
    .${BARRA}-casella{border-style:dashed!important;background:transparent!important}
    /* La riga accesa dopo il salto: venti caselle uguali, e questa e' quella. */
    .${BARRA}-accesa{outline:2px solid #f59e0b!important;outline-offset:2px!important;border-radius:10px!important}
    html[data-theme="dark"] .${BARRA}{background:var(--card-background-color,#111827)!important}
    `,
  );
}

/* Due nomi sono lo stesso nome se lo sono togliendo i disegnini e gli
 * accenti: la linguetta dice «Home» e la fisarmonica «🏠 Home». */
const senzaFronzoli = (valore) =>
  clean(valore)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "")
    .toLowerCase();

const stessoNome = (uno, altro) => {
  const a = senzaFronzoli(uno);
  const b = senzaFronzoli(altro);
  return Boolean(a) && a === b;
};

/* Le caselle del guscio, chieste al guscio.
 *
 * `CD_SLOTS` e' un `const` dentro il copione del guscio e da fuori non
 * esiste — `globalThis.CD_SLOTS` e' `undefined`, provato. Ma
 * `editorRenderSezioni()` si', ed e' una funzione pura che torna il disegno
 * di TUTTE le fisarmoniche in una volta, con le etichette vere: quelle di
 * casa e quelle che la persona si e' rinominata. Si chiede a lei e si legge
 * il risultato in un contenitore staccato, senza toccare la pagina.
 *
 * Centoventi righe di HTML non si rifanno a ogni lettera battuta: si tengono
 * finche' il Config non si ridisegna, che e' anche quando le etichette
 * possono essere cambiate. */
function mietiDalGuscio() {
  if (state.raccolte) return state.raccolte;
  let disegno = "";
  try {
    disegno = String(root.editorRenderSezioni?.() || "");
  } catch (_errore) {
    return [];
  }
  if (!disegno || !doc?.createElement) return [];
  const staccato = doc.createElement("div");
  staccato.innerHTML = disegno;
  const fuori = [];
  for (const fisarmonica of staccato.querySelectorAll("details.ed-acc")) {
    /* Il titolo e' il primo pezzo di testo del sommario: dopo c'e' «12
     * entita'», che e' un conto e non un nome. */
    const dove = clean(fisarmonica.querySelector("summary")?.firstChild?.textContent);
    for (const slot of fisarmonica.querySelectorAll(".ed-slot")) {
      const ref = clean(slot.querySelector("input[data-ref]")?.dataset?.ref);
      const nome = clean(
        slot.querySelector(".wz-lbl-edit")?.getAttribute?.("value") ||
          slot.querySelector(".ed-slot-lbl")?.textContent,
      );
      if (ref && nome) fuori.push({ ref, nome, dove });
    }
  }
  state.raccolte = fuori;
  return fuori;
}

/* La casella a cui un risultato appartiene, con lo stesso nome che le da'
 * l'elenco delle caselle.
 *
 * Serve a non dire due volte la stessa cosa: se «Interruttore ventola» e' gia'
 * uscito fra i valori — perche' ci si e' scritto dentro — non ha senso
 * ripeterlo sotto «dove si configura». Le mappature a mano si riconoscono dal
 * nome del campo, che e' il `dm.*`; il modello energia dall'ultimo pezzo di
 * strada piu' il campo, che e' esattamente come si chiamano li' dentro. */
function laCasellaDelRisultato(esito) {
  const campo = clean(esito?.campo);
  if (campo.startsWith("dm.")) return campo;
  const strada = esito?.percorso;
  if (!Array.isArray(strada)) return "";
  const dopo = strada.indexOf("energy");
  if (dopo < 0 || !campo) return "";
  const gruppo = clean(strada[strada.length - 1]);
  return gruppo && gruppo !== "energy" ? `${gruppo}.${campo}` : "";
}

/* Aprire la casella, non soltanto la sua scheda.
 *
 * Una scheda sola non basta piu' da quando Energia ha quattro maschere dentro:
 * chi cerca la ventola e finisce su FLUSSI ED ENTITA' ha fatto meta' strada e
 * non lo sa. Si apre la scheda, poi la maschera — che adesso dice come si
 * chiama — e poi si accende la riga, che e' l'unico modo di dire «e' questa»
 * a chi ha davanti venti caselle uguali.
 *
 * I tre passi sono sfalsati perche' ognuno aspetta che il precedente abbia
 * ridisegnato: il guscio riscrive il corpo, e cercare dentro quello di prima
 * non trova niente. */
function laCasellaInPagina(id) {
  const nome = clean(id);
  if (nome.startsWith("dm.")) return doc?.querySelector?.(`input[data-ref="${CSS.escape(nome)}"]`);
  const punto = nome.indexOf(".");
  if (punto < 0) return null;
  return doc?.getElementById?.(`dm-energy-${nome.slice(0, punto)}-${nome.slice(punto + 1)}`);
}

function accendiLaCasella(id) {
  const campo = laCasellaInPagina(id);
  const riga = campo?.closest?.(".ed-slot") || campo;
  if (!riga) return;
  riga.scrollIntoView?.({ block: "center", behavior: "smooth" });
  riga.classList?.add?.(`${BARRA}-accesa`);
  root.setTimeout?.(() => riga.classList?.remove?.(`${BARRA}-accesa`), 2400);
}

function apriLaCasella(una) {
  try {
    root.editorSwitch?.(una.scheda);
  } catch (_errore) {}
  root.setTimeout?.(() => {
    if (una.pannello)
      doc?.querySelector?.(`.ed-inner-tab[data-energy-tab="${una.pannello}"]`)?.click?.();
    root.setTimeout?.(() => accendiLaCasella(una.id), 160);
  }, 160);
}

/* La parola, evidenziata dentro il risultato: si vede subito perche' quella
 * riga e' uscita.
 *
 * Qui non si puo' usare `esc`, che prima di tutto TAGLIA gli spazi ai bordi:
 * i bordi di questi tre pezzi stanno in mezzo a una frase, e «Potenza ventola»
 * spezzato in «Potenza » e «ventola» tornava «Potenzaventola». Non si vedeva
 * finche' si cercavano solo entita', che spazi non ne hanno; si e' visto il
 * giorno che si sono cercati i nomi delle caselle, che sono parole vere. */
const escSenzaTagliare = (valore) =>
  String(valore ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export function conLaParolaAccesa(testo, parola) {
  const dove = testo.toLowerCase().indexOf(parola.toLowerCase());
  if (dove < 0) return escSenzaTagliare(testo);
  return `${escSenzaTagliare(testo.slice(0, dove))}<mark>${escSenzaTagliare(
    testo.slice(dove, dove + parola.length),
  )}</mark>${escSenzaTagliare(testo.slice(dove + parola.length))}`;
}

function disegnaGliEsiti(contenitore, parola) {
  contenitore.textContent = "";
  if (clean(parola).length < 2) {
    contenitore.innerHTML = `<p class="${BARRA}-vuoto">${esc(
      t(
        "Scrivi almeno due lettere: si cerca in tutte le schede insieme.",
        "Type at least two letters: it searches every tab at once.",
      ),
    )}</p>`;
    return 0;
  }
  const esiti = cercaNelConfig(parola, magazzino());
  /* Le caselle gia' uscite fra i valori non si ripetono: la risposta e' la
   * stessa, e dirla due volte fa sembrare che siano due posti. */
  const dette = new Set(esiti.map(laCasellaDelRisultato).filter(Boolean));
  const caselle = cercaFraLeCaselle(
    parola,
    leCaselleDelConfig(mietiDalGuscio()),
    activeLocale(),
  ).filter((una) => !dette.has(una.id));
  if (!esiti.length && !caselle.length) {
    contenitore.innerHTML = `<p class="${BARRA}-vuoto">${esc(
      t("Nessuna configurazione contiene questa parola.", "No configuration contains this word."),
    )}</p>`;
    return 0;
  }
  for (const esito of esiti.slice(0, 60)) {
    const scheda = schedaDelRisultato(esito);
    const nome = nomeDellaScheda(scheda) || esito.chiave;
    const riga = doc.createElement("button");
    riga.type = "button";
    riga.className = `${BARRA}-esito`;
    riga.dataset.salta = scheda ? "si" : "no";
    /* «sections» e il nome inglese della sezione sono roba del magazzino: chi
     * legge vuole il nome della scheda, che la linguetta dice gia'. */
    const strada = clean(esito.dove)
      .split(" · ")
      .filter(
        (pezzo, indice, tutti) =>
          pezzo &&
          pezzo !== "sections" &&
          !(indice === tutti.indexOf("sections") + 1 && tutti.includes("sections")),
      )
      .join(" · ");
    const dove = [nome, strada, esito.campo].filter(Boolean).join(" · ");
    riga.innerHTML = `<span class="${BARRA}-dove">${esc(dove)}</span><span class="${BARRA}-testo">${conLaParolaAccesa(
      esito.testo,
      clean(parola),
    )}</span>`;
    if (scheda)
      riga.addEventListener("click", () => {
        try {
          root.editorSwitch?.(scheda);
        } catch (_errore) {}
      });
    contenitore.append(riga);
  }
  /* E sotto, la seconda domanda.
   *
   * «Dove l'ho messo» si risponde coi valori, qui sopra. «Dove lo metto» si
   * risponde con le caselle, che esistono anche da vuote — ed e' la domanda
   * di chi sta configurando, cioe' di quasi tutti quelli che aprono questa
   * barra. Finche' c'era solo la prima, una casella mai riempita rispondeva
   * «Nessuna configurazione contiene questa parola», che si legge in un modo
   * solo: quella casella non c'e'. */
  if (caselle.length) {
    const titolo = doc.createElement("p");
    titolo.className = `${BARRA}-titolo`;
    titolo.textContent = t("Dove si configura", "Where it is configured");
    contenitore.append(titolo);
  }
  for (const una of caselle.slice(0, 20)) {
    const nome = nomeDellaScheda(una.scheda);
    const riga = doc.createElement("button");
    riga.type = "button";
    riga.className = `${BARRA}-esito ${BARRA}-casella`;
    riga.dataset.salta = "si";
    riga.dataset.casella = una.id;
    /* «Home · 🏠 Home» non e' una strada, e' una parola detta due volte: la
     * fisarmonica si chiama come la scheda che la contiene, e allora il nome
     * basta una volta. */
    const dove = [nome, stessoNome(nome, una.dove) ? "" : una.dove].filter(Boolean).join(" · ");
    riga.innerHTML = `<span class="${BARRA}-dove">${esc(dove)}</span><span class="${BARRA}-testo">${conLaParolaAccesa(
      t(una.it, una.en),
      clean(parola),
    )}</span>`;
    riga.addEventListener("click", () => apriLaCasella(una));
    contenitore.append(riga);
  }
  return esiti.length + caselle.length;
}

/* La barra sta in cima a tutto, fuori dal corpo della scheda.
 *
 * Cerca nella configurazione INTERA — legge il magazzino, non la scheda
 * aperta — ma stava dentro il corpo, sotto il titolo della sezione: nel posto
 * dove tutto quello che si vede appartiene alla scheda che si sta guardando.
 * Chi la trovava li' leggeva «cerca in questa scheda», che e' il contrario di
 * quello che fa. «Il cerca spostalo in alto a tutto e deve essere trasversale
 * a tutto il config, non solo alla sezione selezionata.»
 *
 * Adesso e' figlia del guscio del Config e si prende una riga sua per tutta la
 * larghezza, sopra le famiglie: sta dove sta quello che vale per tutti. E non
 * la si deve piu' rimettere in cima a ogni cambio di scheda, perche' il guscio
 * riscrive il corpo e la barra non e' piu' li' dentro. */
export function ensureBarraDiRicerca() {
  const strisce = linguette();
  const guscio = strisce?.parentElement || null;
  if (!strisce || !guscio) return false;
  installaLoStile();
  let barra = guscio.querySelector(`:scope > .${BARRA}`);
  if (barra) {
    /* Prima delle famiglie, che sono la riga sotto. */
    const famiglie = guscio.querySelector(":scope > #dm-alberatura-famiglie");
    const dopo = famiglie || strisce;
    if (barra.nextElementSibling !== dopo) dopo.before(barra);
    return false;
  }
  barra = doc.createElement("div");
  barra.className = BARRA;
  const campo = doc.createElement("input");
  campo.type = "search";
  campo.className = `${BARRA}-in`;
  campo.placeholder = t("Cerca in tutta la configurazione…", "Search the whole configuration…");
  campo.setAttribute("aria-label", t("Cerca nella configurazione", "Search the configuration"));
  campo.value = state.parola;
  const via = doc.createElement("button");
  via.type = "button";
  via.className = `${BARRA}-via`;
  via.textContent = t("Pulisci", "Clear");
  via.hidden = !state.parola;
  const riga = doc.createElement("div");
  riga.className = `${BARRA}-riga`;
  riga.append(campo, via);
  const esiti = doc.createElement("div");
  esiti.className = `${BARRA}-esiti`;
  esiti.hidden = !state.parola;
  barra.append(riga, esiti);
  const famiglie = guscio.querySelector(":scope > #dm-alberatura-famiglie");
  (famiglie || strisce).before(barra);

  const ridisegna = () => {
    state.parola = clean(campo.value);
    via.hidden = !state.parola;
    esiti.hidden = !state.parola;
    if (state.parola) disegnaGliEsiti(esiti, state.parola);
  };
  campo.addEventListener("input", ridisegna);
  via.addEventListener("click", () => {
    campo.value = "";
    ridisegna();
    campo.focus();
  });
  if (state.parola) disegnaGliEsiti(esiti, state.parola);
  return true;
}

export function installCercaNelConfigSection() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installaLoStile();
  ensureBarraDiRicerca();
  /* La configurazione nasce quando la si apre, e si ridisegna a ogni cambio di
   * scheda: ci si rimette in coda a quel giro, che e' la strada con cui tutti
   * i moduli stanno dietro al guscio. */
  onEditorRedraw("__dmCercaNelConfig", () => {
    /* Il raccolto delle etichette si butta a ogni ridisegno: e' il momento in
     * cui una rinomina puo' essere appena successa. */
    state.raccolte = null;
    ensureBarraDiRicerca();
  });
  return true;
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installCercaNelConfigSection, { once: true });
} else {
  installCercaNelConfigSection();
}
