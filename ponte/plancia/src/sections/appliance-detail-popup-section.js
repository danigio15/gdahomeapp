/* Il popup dell'elettrodomestico, rivestito da progetto.
 *
 * «Quando clicco su un elettrodomestico si apre questo popup orrendo: crealo
 * piu' bello, stile widget, che ti fa anche l'analisi.» Il guscio elencava
 * OGNI entita' del dispositivo con lo slug sotto il nome e il valore a
 * destra: tredici righe da leggere per capire se il condizionatore stava
 * lavorando. Qui la finestra parla come i popup dei widget: il verdetto e la
 * frase in cima, le letture a caselle sotto «Le misure», gli acceso/spento a
 * pillole sotto «Lo stato», e sotto «Comandi» i tasti veri — interruttori e
 * script. Ogni casella resta cliccabile e apre lo storico, come prima.
 *
 * Il guscio disegna la sua lista e questo modulo la riveste subito dopo:
 * stessa finestra, stesso apri e chiudi, nessun secondo padrone.
 */
import { deviceEntityGroups } from "../core/appliance-device-binding.js";
import { faseInParole } from "../core/appliance-program.js";
import { pick } from "../core/i18n.js";
/* Il verbo con cui si preme un comando a parte lo sa gia' il robot (#306), e
 * per un elettrodomestico (#338) e' lo stesso: un tasto si preme, uno script si
 * accende, un'automazione si fa partire, un interruttore si inverte, una
 * tendina sceglie. Un secondo elenco vorrebbe dire due modi di sbagliare il
 * verbo sullo stesso dominio. */
import {
  comandiDelDispositivo as comandiScelti,
  comandoDelDispositivo as servizioDelComando,
  elencoComandi,
} from "../core/comandi-accanto.js";
import {
  elencoLetture,
  lettureDelDispositivo as lettureScelte,
} from "../core/letture-accanto.js";
import { soloQuelleViste } from "../core/le-voci-nascoste.js";
import {
  applianceModelForIndex,
  buildCardMarkup,
  cardLabels,
} from "./appliance-showcase-section.js";
import { entitaDelDispositivo } from "./appliance-integration-section.js";
import {
  activeLocale,
  allStates,
  chiediAHomeAssistant,
  clean,
  doc,
  esc,
  installStyle,
  root,
  t,
  senzaCadere,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_APPLIANCE_DETAIL_POPUP__";
const state = (root[KEY] ||= { installed: false, aperto: null });

const STATI_MUTI = /^(unknown|unavailable|none|)$/i;
const DOMINI_INTERRUTTORE = /^(switch|light|input_boolean|fan)\./;
const DOMINI_AZIONE = /^(script|scene|button)\./;

/* Le entita' dell'apparecchio, comprese quelle scritte nelle caselle proprie.
 *
 * La finestra leggeva soltanto la lista `entities`: chi aveva messo
 * l'interruttore nella sua casella — «Entita' comando» dell'editor, che e'
 * dove il campo si compila — non vedeva ne' la pillola acceso/spento ne' il
 * tasto. «Scompare il pulsante per comandare lo switch»: non era sparito, non
 * era mai arrivato. Le caselle proprie entrano per prime, senza doppioni. */
const CASELLE_PROPRIE = Object.freeze([
  "control_entity",
  "switch_entity",
  "switch",
  "light",
  "fan",
  "power_entity",
  "temperature_entity",
]);

function entita(appliance) {
  const viste = new Set();
  const elenco = [];
  const aggiungi = (voce) => {
    const id = clean(typeof voce === "string" ? voce : voce?.entity || voce?.entity_id);
    if (!id || !id.includes(".") || viste.has(id)) return;
    viste.add(id);
    elenco.push(id);
  };
  for (const casella of CASELLE_PROPRIE) aggiungi(appliance?.[casella]);
  for (const voce of appliance?.entities || []) aggiungi(voce);
  return elenco;
}

function nomeDi(states, entity) {
  return (
    clean(states?.[entity]?.attributes?.friendly_name) ||
    entity.split(".")[1]?.replaceAll("_", " ") ||
    entity
  );
}

/* Il glifo della casella, indovinato da entita' e unita': sono letture di
 * elettrodomestici, e nessuna porta un'icona scritta da qualche parte.
 * L'energia in kWh usciva con la batteria (🔋) addosso — «non ha senso il
 * simbolo batteria» — che qui non c'entra niente: e' consumo contato, non
 * carica. Il grafico dice quello che e': una quantita' che si accumula. */
function glifoDellaLettura(entity, unit) {
  /* L'unita' comanda: c'e' chi chiama il sensore di potenza «w_kwh_frigo»,
   * e a leggere solo il nome i watt uscirebbero vestiti da energia. */
  const unita = clean(unit).toLowerCase();
  if (unita === "w" || unita === "kw") return "⚡";
  if (unita === "kwh" || unita === "wh") return "📊";
  const token = `${entity} ${unit}`.toLowerCase();
  if (/temperatur|°/.test(token)) return "🌡️";
  if (/umidit|humidity/.test(token)) return "💧";
  if (/kwh|energy|energia/.test(token)) return "📊";
  if (/\bw\b|watt|power|potenza/.test(token)) return "⚡";
  if (/corrente|current|\ba\b/.test(token)) return "🔌";
  if (/volt|tension/.test(token)) return "🎚️";
  /* Le letture delle integrazioni: «39 min» col grafico addosso non diceva
   * che era un tempo, e «3» non diceva che erano cicli. */
  if (/^(s|min|h|d)$/.test(unita) || /durat|time|tempo/.test(token)) return "⏱️";
  if (/cicl|cycle|count|conteggio/.test(token)) return "🔁";
  if (/€|eur|costo|cost|price|prezzo/.test(token)) return "💶";
  if (/^(l|m³|m3)$/.test(unita) || /acqua|water/.test(token)) return "💧";
  if (/rpm|giri|spin/.test(token)) return "🌀";
  return "📈";
}

/* Una casella: il glifo nel suo tondo, la parola sopra e il numero grande.
 * La parola andava sotto, in maiuscoletto da otto pixel e tagliata a meta'
 * («ENERGY_OGGI_LAVA…»): adesso si legge, e va a capo se serve. */
function casellaDiLettura(glifo, valore, nome) {
  return `<span class="dm-apde-casella-ic" aria-hidden="true">${glifo}</span><span class="dm-apde-casella-nome">${esc(nome)}</span>${numeroGrande(valore)}`;
}

/* Il numero grande e l'unita' piccola accanto: «6,30» si legge da lontano,
 * «kWh» serve solo a chi lo cerca. */
function numeroGrande(valore) {
  const detto = numeroInParole(clean(valore));
  const pezzi = /^(-?[\d.,]+)\s*(.*)$/.exec(detto);
  if (!pezzi) return `<b class="dm-apde-numero-grande">${esc(detto)}</b>`;
  return `<b class="dm-apde-numero-grande">${esc(pezzi[1])}${pezzi[2] ? `<small>${esc(pezzi[2])}</small>` : ""}</b>`;
}

/* Il genere di una lettura, dal suo glifo: da' il colore alla casella. */
const GENERI_DEI_GLIFI = new Map([
  ["⚡", "potenza"],
  ["📊", "energia"],
  ["⏱️", "tempo"],
  ["🔁", "cicli"],
  ["🌡️", "caldo"],
  ["💧", "acqua"],
  ["🌀", "giri"],
  ["💶", "costo"],
]);
const genereDelGlifo = (glifo) => GENERI_DEI_GLIFI.get(glifo) || "altro";

/* Il segno di un comando, a sinistra della sua riga. */
function segnoDelComando(voce, parole) {
  const kind = voce.control?.kind;
  const nome = `${parole} ${voce.entity}`.toLowerCase();
  if (kind === "toggle") return { glifo: "⏻", genere: "accensione" };
  if (kind === "press") return { glifo: "▶", genere: "azione" };
  if (kind === "number")
    return /fine|end|partenza|start|delay|ritard|timer/.test(nome)
      ? { glifo: "⏰", genere: "tempo" }
      : { glifo: "🎚️", genere: "numero" };
  if (/programm|course|program|ciclo/.test(nome)) return { glifo: "🧺", genere: "programma" };
  return { glifo: "▶", genere: "azione" };
}

/* Il marchio come lo conosce chi l'ha comprato: le integrazioni scrivono la
 * ragione sociale («LGE», «BSH Hausgeräte GmbH»). */
const MARCHI = new Map([
  ["lge", "LG"],
  ["lgelectronics", "LG"],
  ["bshhausgerategmbh", "Bosch Siemens"],
  ["bshhausgeratemgbh", "Bosch Siemens"],
  ["samsungelectronics", "Samsung"],
  ["haier", "Haier"],
]);
function marchioInParole(marchio) {
  const detto = clean(marchio);
  const chiave = detto
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll(/[^a-z]/g, "");
  return MARCHI.get(chiave) || detto;
}
/* Il modello senza la sigla del protocollo: «(DEVICE_WASHER)» lo dice
 * ThinQ a se stesso, non a chi guarda. */
function modelloInParole(modello) {
  return clean(modello)
    .replace(/\s*\((?:DEVICE_)?[A-Z_]+\)\s*$/, "")
    .trim();
}

/* L'ordine delle caselle: prima la corrente, poi l'energia, poi i tempi. Chi
 * apre la finestra di una lavatrice in funzione guarda quelle, nell'ordine. */
const ORDINE_DEI_GLIFI = ["⚡", "📊", "⏱️", "🔁", "🌡️", "💧", "🌀", "💶", "🔌", "🎚️"];
const postoDelGlifo = (glifo) => {
  const posto = ORDINE_DEI_GLIFI.indexOf(glifo);
  return posto === -1 ? ORDINE_DEI_GLIFI.length : posto;
};

/* Le parole delle integrazioni, in italiano.
 *
 * «Non si capisce nulla»: la finestra di una lavatrice LG diceva «Total
 * time», «Delayed end», «Operation», «Power», e lo stato «spinning». Sono i
 * nomi che le integrazioni pubblicano in inglese anche in una casa italiana.
 * Qui le parole che tornano in ThinQ, SmartThings, Home Connect e hOn; una
 * che non c'e' resta la sua, ripulita. La chiave e' il nome nudo: minuscolo,
 * senza spazi ne' trattini. */
const PAROLE_DELLE_VOCI = new Map(
  [
    [["totaltime", "totaltimes"], "Durata totale", "Total time"],
    [["remaintime", "remainingtime", "timeremaining", "remaining"], "Tempo rimanente", "Time remaining"],
    [["runningtime", "runtime", "elapsedtime"], "Tempo di funzionamento", "Running time"],
    [["delayedend", "delayend", "reserveend", "relativehourtostop", "finishin"], "Fine programmata", "Delayed end"],
    [["delayedstart", "delaystart", "reservestart", "relativehourtostart", "startin"], "Partenza ritardata", "Delayed start"],
    [["operation", "operationmode", "washeroperation", "dryeroperation"], "Comando", "Operation"],
    [["power", "powerswitch", "onoff"], "Accensione", "Power"],
    [["remotestart", "remotecontrol", "remotecontrolenabled", "remotestartenabled"], "Avvio remoto", "Remote start"],
    [["currentstatus", "runstate", "operationstate", "machinestate", "status", "state"], "Stato attuale", "Current status"],
    [["cycles", "cyclecount", "washcycles", "cycle"], "Cicli", "Cycles"],
    [["energy", "energyconsumption"], "Energia", "Energy"],
    [["error", "errorcode", "errorstate"], "Errore", "Error"],
    [["childlock", "childlocked"], "Blocco bambini", "Child lock"],
    [["doorlock", "doorlocked"], "Blocco oblò", "Door lock"],
    [["door", "dooropen", "doorstate"], "Oblò", "Door"],
    [["spinspeed", "spin", "spinlevel"], "Centrifuga", "Spin"],
    [["watertemp", "watertemperature", "temperature", "temp"], "Temperatura", "Temperature"],
    [["course", "currentcourse", "program", "programme", "washcourse"], "Programma", "Program"],
    [["detergent", "detergentlevel", "autodetergent"], "Detersivo", "Detergent"],
    [["softener", "softenerlevel", "autosoftener"], "Ammorbidente", "Softener"],
    [["rinsecount", "rinse"], "Risciacqui", "Rinses"],
    [["prewash"], "Prelavaggio", "Pre-wash"],
    [["steam"], "Vapore", "Steam"],
    [["drylevel", "drymode"], "Asciugatura", "Drying"],
  ].flatMap(([chiavi, it, en]) => chiavi.map((chiave) => [chiave, { it, en }])),
);

/* E le scelte dei menu: «start» e' un verbo, e sotto il pollice va detto
 * come un verbo. Una scelta che e' una fase («spinning») la dice il
 * vocabolario delle fasi. */
const PAROLE_DELLE_SCELTE = new Map(
  [
    [["start"], "Avvia", "Start"],
    [["stop"], "Ferma", "Stop"],
    [["pause"], "Metti in pausa", "Pause"],
    [["resume"], "Riprendi", "Resume"],
    [["poweroff", "turnoff", "off"], "Spegni", "Switch off"],
    [["poweron", "turnon", "on"], "Accendi", "Switch on"],
    [["wakeup"], "Risveglia", "Wake up"],
    [["cancel"], "Annulla", "Cancel"],
  ].flatMap(([chiavi, it, en]) => chiavi.map((chiave) => [chiave, { it, en }])),
);

const nudoDi = (testo) => clean(testo).toLowerCase().replaceAll(/[\s_\-.]+/g, "");
const conLaMaiuscola = (testo) => (testo ? testo.charAt(0).toUpperCase() + testo.slice(1) : testo);

/* Il nome di una voce del dispositivo, in parole: prima il vocabolario delle
 * integrazioni, poi le sue parole senza il nome dell'apparecchio. */
function nomeDellaVoce(nome, tokenElettrodomestico) {
  const via = new Set(tokenElettrodomestico);
  const pezzi = clean(nome)
    .replaceAll(/[_\-.]+/g, " ")
    .split(/\s+/)
    .filter((pezzo) => pezzo && !via.has(pezzo.toLowerCase()));
  const riga = PAROLE_DELLE_VOCI.get(nudoDi(pezzi.join("")));
  if (riga) return pick(riga.it, riga.en, activeLocale());
  return conLaMaiuscola(nomeInParole(nome, tokenElettrodomestico));
}

/** Una scelta di un menu, in parole. */
export function sceltaInParole(opzione) {
  const riga = PAROLE_DELLE_SCELTE.get(nudoDi(opzione));
  if (riga) return pick(riga.it, riga.en, activeLocale());
  return faseInParole(opzione, activeLocale())?.label || clean(opzione).replaceAll("_", " ");
}

/* Il valore di uno stato, in parole: la fase nel vocabolario delle fasi, una
 * data come la si dice («8 set, 01:40») e non come la scrive Home Assistant
 * («2026-09-08T01:40:51.764Z»). */
const DATA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
export function statoInParole(grezzo, giaDetto) {
  const valore = clean(grezzo);
  if (DATA_ISO.test(valore)) {
    const quando = new Date(valore);
    if (!Number.isNaN(quando.getTime()))
      return quando.toLocaleString(activeLocale(), {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
  }
  if (/^(on|off)$/i.test(valore)) return giaDetto;
  const fase = faseInParole(valore, activeLocale());
  return fase?.label || giaDetto;
}

/* Un numero come si scrive qui: «6,30 kWh» in italiano, non «6.30 kWh». */
function numeroInParole(testo) {
  let virgola = ".";
  try {
    virgola = (1.5).toLocaleString(activeLocale()).charAt(1) || ".";
  } catch (_errore) {}
  if (virgola === ".") return String(testo);
  return String(testo).replace(/^(-?\d+)\.(\d+)/, `$1${virgola}$2`);
}

/* Il nome della casella, in parole.
 *
 * I sensori arrivano spesso col friendly name uguale allo slug —
 * «w_kwh_frigo», «energy_oggi_frigo» — e la casella li stampava tali e
 * quali: «si capisce poco cosi'». Una lettura pero' si riconosce da unita' e
 * indizi nel nome: qui diventa la SUA parola — Potenza, Energia oggi,
 * Energia del mese, Contatore totale — e quando due letture cadrebbero sulla
 * stessa parola la seconda tiene le sue, ripulite: underscore in spazi e il
 * nome dell'elettrodomestico tolto di mezzo, perche' in quella finestra c'e'
 * scritto gia' in cima di chi si parla. */
function nomeDellaLettura(entity, nome, unit, tokenElettrodomestico, usate) {
  const token = `${entity} ${nome} ${unit}`.toLowerCase();
  const unita = clean(unit).toLowerCase();
  /* L'unita' comanda sul nome: «w_kwh_frigo» con unita' W e' potenza, non
   * energia, per quanto il suo slug giuri il contrario. */
  const kwh = unita === "kwh" || unita === "wh" || (!unita && /kwh/.test(token));
  let parola = "";
  if (unita === "w" || unita === "kw") parola = t("Potenza", "Power");
  else if (kwh && /oggi|today|daily|giorn/.test(token)) parola = t("Energia oggi", "Energy today");
  else if (kwh && /mese|month/.test(token)) parola = t("Energia del mese", "Energy this month");
  else if (kwh && /anno|year|annual/.test(token))
    parola = t("Energia dell'anno", "Energy this year");
  else if (kwh && /total|lifetime|somma/.test(token)) parola = t("Contatore totale", "Total meter");
  else if (kwh) parola = t("Energia", "Energy");
  else if (/temperatur|°/.test(token)) parola = t("Temperatura", "Temperature");
  else if (/umidit|humidity/.test(token)) parola = t("Umidità", "Humidity");
  else if (unita === "a") parola = t("Corrente", "Current");
  else if (unita === "v") parola = t("Tensione", "Voltage");
  if (parola && !usate.has(parola)) {
    usate.add(parola);
    return parola;
  }
  /* Niente parola canonica (o gia' presa): le sue, ripulite e tradotte. */
  return nomeDellaVoce(nome, tokenElettrodomestico);
}

/* Lo slug in parole: underscore e trattini in spazi, e il nome
 * dell'elettrodomestico tolto — la finestra dice gia' in cima di chi parla. */
function nomeInParole(nome, tokenElettrodomestico) {
  const via = new Set(tokenElettrodomestico);
  const tutte = clean(nome)
    .replaceAll(/[_\-.]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const pulito = tutte
    .filter((pezzo) => !via.has(pezzo.toLowerCase()))
    .join(" ")
    .trim();
  if (pulito) return pulito;
  /* Non e' rimasto niente perche' l'entita' si chiama come l'apparecchio: e'
   * l'interruttore principale, quello che hOn e Home Connect battezzano col
   * nome della macchina. Home Assistant ci mette davanti anche il nome del
   * dispositivo, e la finestra scriveva «Lavatrice Lavatrice». Si dice una
   * volta sola. */
  const senzaDoppioni = tutte.filter(
    (pezzo, i) => i === 0 || pezzo.toLowerCase() !== tutte[i - 1].toLowerCase(),
  );
  return senzaDoppioni.join(" ") || clean(nome);
}

/* Le parole del nome dell'elettrodomestico, per toglierle dalle etichette. */
function tokenDi(appliance) {
  const nome = clean(root.cdApplianceDisplayName?.(appliance)) || clean(appliance?.name) || "";
  return nome.toLowerCase().split(/\s+/).filter(Boolean);
}

/* Le quattro famiglie della finestra, da un giro solo sulle entita'. */
function famiglie(appliance) {
  const states = allStates();
  const token = tokenDi(appliance);
  const usate = new Set();
  const misure = [];
  const pillole = [];
  const comandi = [];
  /* «Senza tasto Accendi/Spegni»: l'interruttore resta in lettura — la
   * pillola dice acceso o spento — ma il tasto non si offre, o il frigo
   * protetto dalla card restava spegnibile dalla sua finestra. */
  const senzaTasto = appliance?.switch_disabled === true;
  for (const entity of entita(appliance)) {
    const stato = states?.[entity];
    const grezzo = clean(stato?.state);
    const nome = nomeDi(states, entity);
    if (DOMINI_AZIONE.test(entity)) {
      comandi.push({ entity, nome: nomeInParole(nome, token), azione: true, acceso: false });
      continue;
    }
    if (DOMINI_INTERRUTTORE.test(entity)) {
      const acceso = grezzo.toLowerCase() === "on";
      const parole = nomeInParole(nome, token);
      pillole.push({
        entity,
        nome: parole,
        acceso,
        valore: acceso ? t("Acceso", "On") : t("Spento", "Off"),
      });
      if (!senzaTasto) comandi.push({ entity, nome: parole, azione: false, acceso });
      continue;
    }
    if (STATI_MUTI.test(grezzo)) continue;
    const numero = Number.parseFloat(grezzo.replace(",", "."));
    if (Number.isFinite(numero)) {
      const unit = clean(stato?.attributes?.unit_of_measurement);
      misure.push({
        entity,
        nome: nomeDellaLettura(entity, nome, unit, token, usate),
        glifo: glifoDellaLettura(entity, unit),
        valore: `${grezzo}${unit ? ` ${unit}` : ""}`,
      });
      continue;
    }
    const acceso = /^(on|open|aperto|running|cleaning|heat|cool)$/i.test(grezzo);
    pillole.push({ entity, nome: nomeInParole(nome, token), acceso, valore: grezzo });
  }
  /* E si toglie quello che chi possiede l'apparecchio ha detto di non voler
   * vedere (#512). Si filtra qui, in fondo, e non entrata per entrata: cosi'
   * la stessa entita' sparisce da tutte e tre le file — la misura, la pillola
   * e il tasto — invece che da quella in cui e' capitato di ricordarsene. */
  const viste = (elenco) => soloQuelleViste(elenco, appliance);
  return {
    misure: viste(misure).slice(0, 12),
    pillole: viste(pillole).slice(0, 12),
    comandi: viste(comandi),
  };
}

/* I tasti della card, dentro la finestra.
 *
 * Nella sezione li ascolta il guscio della vetrina, che qui non c'e': la
 * card sarebbe identica e morta. Sono due, e fanno quello che fanno di la'. */
function agganciaLaCard(vetrina, model) {
  const card = vetrina.querySelector(".dm-ap-card");
  if (!card) return;
  /* Dentro la finestra la card non porta da nessuna parte: e' gia' aperta. */
  card.removeAttribute("role");
  card.removeAttribute("tabindex");
  card.setAttribute("aria-hidden", "false");
  vetrina.querySelector("[data-dm-power-toggle]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const entity = clean(model?.action?.entity);
    if (entity) root.cdApplEntTog?.(entity, event.currentTarget);
  });
  vetrina.querySelector("[data-dm-history]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const nodo = event.currentTarget;
    apriStorico(event, clean(nodo.dataset.dmHistory), clean(nodo.dataset.dmHistoryName));
  });
}

function apriStorico(event, entity, nome) {
  try {
    root.apriStorico?.(event, entity, nome);
  } catch (_errore) {}
}

function riveste(indice) {
  const lista = doc?.getElementById?.("details-list");
  const appliance = root.getAppliances?.()?.[indice];
  if (!lista || !appliance) return false;
  state.aperto = indice;

  lista.replaceChildren();
  lista.dataset.dmApdeOwner = "moduli";

  /* In cima, la stessa card della sezione.
   *
   * «Il popup widget e' bruttissimo, lo devi ridisegnare con le informazioni
   * del singolo elettrodomestico in funzione, riportando la stessa card della
   * sezione.» Non una seconda versione che somiglia a quella e col tempo
   * diverge: proprio quella, disegnata dalla stessa funzione con lo stesso
   * modello. Il ritratto che si muove, la fase, l'anello, i watt, l'ultimo
   * ciclo — e sotto, quello che sulla card non ci stava. */
  const model = applianceModelForIndex(indice);
  if (model) {
    const vetrina = doc.createElement("div");
    vetrina.className = "dm-appl-shell dm-apde-vetrina";
    vetrina.dataset.view = "grid";
    vetrina.innerHTML = buildCardMarkup(model, cardLabels());
    agganciaLaCard(vetrina, model);
    lista.append(vetrina);
  }

  const titoletto = (parole) => {
    const nodo = doc.createElement("h4");
    nodo.className = "dm-apde-titoletto";
    nodo.textContent = parole;
    return nodo;
  };

  const collegato =
    Boolean(clean(appliance.device_id)) || Boolean(appliance.device_entities?.length);
  if (collegato) {
    try {
      vesteIntegrazione(lista, appliance, mostrateDallaCard(appliance, model), titoletto);
    } catch (errore) {
      root.console?.warn?.("[DashboardModern] dettaglio integrazione", errore);
    }
    return true;
  }

  /* Chi non ha un'integrazione tiene i blocchi di sempre: la card in cima
   * racconta lo stato, e qui sotto restano le sue entita' una per una. */
  const { misure, pillole, comandi } = famiglie(appliance);
  if (misure.length) {
    lista.append(titoletto(t("Le misure", "The readings")));
    const griglia = doc.createElement("div");
    griglia.className = "dm-apde-caselle";
    for (const misura of misure) {
      const casella = doc.createElement("button");
      casella.type = "button";
      casella.className = "dm-apde-casella hist-clickable";
      casella.innerHTML = casellaDiLettura(misura.glifo, numeroInParole(misura.valore), misura.nome);
      casella.addEventListener("click", (event) => apriStorico(event, misura.entity, misura.nome));
      griglia.append(casella);
    }
    lista.append(griglia);
  }

  if (pillole.length) {
    lista.append(titoletto(t("Lo stato", "The state")));
    const fila = doc.createElement("div");
    fila.className = "dm-apde-pillole";
    for (const pillola of pillole) {
      const nodo = doc.createElement("button");
      nodo.type = "button";
      nodo.className = "dm-apde-pillola";
      nodo.dataset.acceso = pillola.acceso ? "true" : "false";
      nodo.innerHTML = `${esc(pillola.nome)} <b>${esc(pillola.valore)}</b>`;
      nodo.addEventListener("click", (event) => apriStorico(event, pillola.entity, pillola.nome));
      fila.append(nodo);
    }
    lista.append(fila);
  }

  if (comandi.length) {
    lista.append(titoletto(t("Comandi", "Controls")));
    for (const comando of comandi) {
      const riga = doc.createElement("div");
      riga.className = "dm-apde-comando";
      riga.dataset.dmApdeEntity = comando.entity;
      const nome = doc.createElement("span");
      nome.className = "dm-apde-comando-nome";
      nome.textContent = comando.nome;
      const tasto = doc.createElement("button");
      tasto.type = "button";
      tasto.className = `dm-apde-tasto${comando.acceso ? " on" : ""}`;
      tasto.textContent = comando.azione ? "▶" : comando.acceso ? "OFF" : "ON";
      tasto.setAttribute(
        "aria-label",
        comando.azione ? `${t("Esegui", "Run")} ${comando.nome}` : comando.nome,
      );
      tasto.addEventListener("click", (event) => {
        event.stopPropagation();
        /* La strada e' quella del guscio: domain.turn_on/turn_off, che per
         * gli script e' «esegui». */
        root.cdApplEntTog?.(comando.entity, comando.azione ? null : tasto);
      });
      riga.append(nome, tasto);
      lista.append(riga);
    }
  }
  aggiungiAltreLetture(lista, appliance, titoletto);
  /* Gli altri comandi stanno accanto a quelli di sempre (#338): sono comandi
   * anche loro, e chi apre la finestra per far partire l'asciugatrice li cerca
   * dove ci sono i tasti. */
  aggiungiAltriComandi(lista, appliance, titoletto);
  return true;
}

/* Quello che la card in cima disegna gia': non si ripete sotto.
 *
 * Sono le caselle dei ruoli piu' le entita' da cui vengono la fase, i gradi,
 * i giri e il programma — cioe' la striscia del programma. */
function mostrateDallaCard(appliance, model) {
  const viste = new Set();
  const aggiungi = (voce) => {
    const id = clean(voce);
    if (id.includes(".")) viste.add(id);
  };
  /* E l'ultimo ciclo: la card lo racconta gia' — avvio, durata, consumo,
   * costo — e ripeterlo in caselle sotto erano quattro numeri uguali due
   * volte nella stessa finestra. */
  for (const casella of [
    "control_entity",
    "power_entity",
    "remaining_entity",
    "temperature_entity",
    "temperature_entity_2",
    "state_entity",
    "last_start_entity",
    "last_duration_entity",
    "last_energy_entity",
    "last_cost_entity",
  ])
    aggiungi(appliance?.[casella]);
  for (const chip of model?.program?.chips || []) aggiungi(chip.entity);
  aggiungi(model?.program?.phase?.entity);
  for (const id of model?.program?.considerate || []) aggiungi(id);
  return [...viste];
}

/* Tutte le entita' del dispositivo, per chi arriva da un'integrazione.
 *
 * «Ogni elettrodomestico avra' sicuramente tutte le sue informazioni.» La
 * parte curata qui sopra legge le caselle della card; questa legge il
 * dispositivo intero — dal catalogo se e' gia' arrivato, altrimenti dalla
 * memoria presa al momento del collegamento — e lo divide in quattro: lo
 * stato, le letture, i comandi con i loro tasti veri (interruttori, menu,
 * numeri, pulsanti) e in fondo la diagnostica, chiusa, perche' la potenza
 * del Wi-Fi non e' una notizia sulla lavatrice. Quello che la parte curata
 * mostra gia' non si ripete. */
function comanda(payload) {
  return chiediAHomeAssistant({ type: "call_service", ...payload }).catch((error) =>
    root.console?.warn?.("[DashboardModern] comando integrazione", error),
  );
}

/* ── gli altri comandi dell'apparecchio (#338) ─────────────────────────────
 *
 * «Sto provando ad integrare l'asciugatrice con hOn. Non ha un'entita'
 * comando, ma da documentazione posso far partire il comando con
 * `hon.start_program` e `program: rapid_30`. Come posso integrare questo nella
 * sezione dell'asciugatrice?»
 *
 * La finestra sapeva premere solo quello che il dispositivo pubblica come
 * entita' comandabile. Una chiamata di servizio con i suoi parametri non lo e'
 * — ma avvolta in uno script diventa `script.asciugatrice_rapido_30`, che lo
 * e'. Chi configura sceglie quelle entita' nella scheda dell'apparecchio; qui
 * si disegnano, con lo stesso verbo che usa il robot, perche' le regole
 * stanno in un posto solo (`core/comandi-extra.js`).
 */
function apparecchioDeiComandi(appliance) {
  return {
    entity: clean(appliance?.control_entity || appliance?.state_entity || appliance?.power_entity),
    /* Il nome serve a non ripeterlo davanti a ogni comando: un apparecchio
     * comandato solo da script un'entita' sua non ce l'ha, e il suo nome e'
     * quello che gli ha dato chi l'ha configurato. */
    name: clean(appliance?.name),
    comandi: appliance?.comandi,
  };
}

/* Il servizio come lo vuole il ponte: bersaglio da una parte, parametri
 * dall'altra. Il verbo lo sceglie il vocabolario, non questa funzione. */
function eseguiComando(comando) {
  if (!comando) return;
  const { entity_id: bersaglio, ...resto } = comando.data || {};
  comanda({
    domain: comando.domain,
    service: comando.service,
    target: { entity_id: bersaglio },
    ...(Object.keys(resto).length ? { service_data: resto } : {}),
  });
}

function tastoDelComandoExtra(voce) {
  if (voce.genere === "tendina") {
    const menu = doc.createElement("select");
    menu.className = "dm-apde-menu";
    menu.setAttribute("aria-label", voce.name);
    const opzioni = voce.opzioni.length ? voce.opzioni : voce.scelta ? [voce.scelta] : [];
    for (const opzione of opzioni) {
      const riga = doc.createElement("option");
      riga.value = opzione;
      riga.textContent = sceltaInParole(opzione);
      riga.selected = opzione === voce.scelta;
      menu.append(riga);
    }
    menu.disabled = !voce.available || !opzioni.length;
    menu.addEventListener("change", () => eseguiComando(servizioDelComando(voce, menu.value)));
    return menu;
  }
  const tasto = doc.createElement("button");
  tasto.type = "button";
  const interruttore = voce.genere === "interruttore";
  tasto.className = `dm-apde-tasto${interruttore && voce.acceso ? " on" : ""}`;
  tasto.textContent = interruttore ? (voce.acceso ? "OFF" : "ON") : "▶";
  tasto.disabled = !voce.available;
  if (interruttore) tasto.setAttribute("aria-pressed", String(voce.acceso === true));
  tasto.setAttribute(
    "aria-label",
    interruttore ? voce.name : `${t("Esegui", "Run")} ${voce.name}`,
  );
  tasto.addEventListener("click", (event) => {
    event.stopPropagation();
    eseguiComando(servizioDelComando(voce));
  });
  return tasto;
}

/* Le altre letture dell'apparecchio (#471).
 *
 * «Se su ogni elettrodomestico si potesse aggiungere un'entità dandole un nome:
 * io nell'asciugatrice monitoro temperatura aria e umidità residua.» Le sceglie
 * la scheda dell'apparecchio, le disegna questa riga, e a dire come si chiamano
 * e con che unità si scrivono è lo stesso vocabolario del robot e dei lettori
 * (`core/letture-accanto.js`): un secondo modo di scrivere «34 °C» sarebbe
 * un secondo modo di sbagliarlo.
 *
 * Stanno sopra i comandi: si guardano, non si toccano, e chi apre la finestra
 * legge prima di premere. */
function aggiungiAltreLetture(lista, appliance, titoletto) {
  /* Anche una lettura scelta a mano si puo' non voler vedere (#512): l'elenco
   * di cio' che si nasconde vale per tutta la finestra, non per le sole voci
   * che ci sono arrivate dall'integrazione. */
  const voci = soloQuelleViste(
    lettureScelte(
      { ...apparecchioDeiComandi(appliance), letture: appliance?.letture },
      allStates(),
    ),
    appliance,
  );
  if (!voci.length) return false;
  lista.append(titoletto(t("Altre letture", "Other readings")));
  const griglia = doc.createElement("div");
  griglia.className = "dm-apde-caselle";
  for (const voce of voci) {
    const casella = doc.createElement("button");
    casella.type = "button";
    casella.className = "dm-apde-casella hist-clickable";
    casella.dataset.dmApdeEntity = voce.entity;
    const unit = clean(allStates()?.[voce.entity]?.attributes?.unit_of_measurement);
    casella.innerHTML = casellaDiLettura(
      glifoDellaLettura(voce.entity, unit),
      numeroInParole(voce.testo),
      voce.name,
    );
    casella.addEventListener("click", (event) => apriStorico(event, voce.entity, voce.name));
    griglia.append(casella);
  }
  lista.append(griglia);
  return true;
}

function aggiungiAltriComandi(lista, appliance, titoletto) {
  const voci = soloQuelleViste(
    comandiScelti(apparecchioDeiComandi(appliance), allStates()),
    appliance,
  );
  if (!voci.length) return false;
  lista.append(titoletto(t("Altri comandi", "Other commands")));
  for (const voce of voci) {
    const riga = doc.createElement("div");
    riga.className = "dm-apde-comando dm-apde-comando-extra";
    riga.dataset.dmApdeEntity = voce.entity;
    const etichetta = doc.createElement("span");
    etichetta.className = "dm-apde-comando-nome";
    etichetta.textContent = voce.name;
    riga.append(etichetta, tastoDelComandoExtra(voce));
    lista.append(riga);
  }
  return true;
}

function tastoDelComando(voce) {
  const controllo = voce.control;
  if (!controllo) return null;
  const [domain] = voce.entity.split(".");
  if (controllo.kind === "select") {
    /* Poche scelte corte: tasti, uno accanto all'altro, e quello attivo
     * colorato. Un menu a tendina che nasconde «Avvia» dietro una freccia
     * e' un passo in piu' per la cosa che si e' venuti a fare. */
    const parole = controllo.options.map((opzione) => sceltaInParole(opzione));
    if (
      controllo.options.length >= 2 &&
      controllo.options.length <= 4 &&
      parole.every((parola) => parola.length <= 12)
    ) {
      const scelte = doc.createElement("div");
      scelte.className = "dm-apde-scelte";
      scelte.setAttribute("role", "group");
      scelte.setAttribute("aria-label", voce.name);
      const tasti = controllo.options.map((opzione, i) => {
        const tasto = doc.createElement("button");
        tasto.type = "button";
        tasto.className = "dm-apde-scelta";
        tasto.textContent = parole[i];
        tasto.setAttribute("aria-pressed", opzione === controllo.current ? "true" : "false");
        tasto.addEventListener("click", (event) => {
          event.stopPropagation();
          for (const altro of tasti) altro.setAttribute("aria-pressed", "false");
          tasto.setAttribute("aria-pressed", "true");
          comanda({
            domain: "select",
            service: "select_option",
            target: { entity_id: voce.entity },
            service_data: { option: opzione },
          });
        });
        return tasto;
      });
      scelte.append(...tasti);
      return scelte;
    }
    const menu = doc.createElement("select");
    menu.className = "dm-apde-menu";
    menu.setAttribute("aria-label", voce.name);
    for (const opzione of controllo.options) {
      const riga = doc.createElement("option");
      riga.value = opzione;
      riga.textContent = sceltaInParole(opzione);
      riga.selected = opzione === controllo.current;
      menu.append(riga);
    }
    menu.addEventListener("change", () =>
      comanda({
        domain: "select",
        service: "select_option",
        target: { entity_id: voce.entity },
        service_data: { option: menu.value },
      }),
    );
    return menu;
  }
  if (controllo.kind === "number") {
    /* Il meno, il numero con la sua unita', il piu': «Fine programmata 0 h»
     * si regola col pollice, senza tastiera. */
    const passo = Number(controllo.step) > 0 ? Number(controllo.step) : 1;
    const minimo = Number.isFinite(Number(controllo.min)) ? Number(controllo.min) : -Infinity;
    const massimo = Number.isFinite(Number(controllo.max)) ? Number(controllo.max) : Infinity;
    const ora = Number.parseFloat(clean(controllo.current).replace(",", "."));
    const unitaDelPasso = clean(allStates()?.[voce.entity]?.attributes?.unit_of_measurement);
    if (Number.isFinite(ora) && Number.isFinite(minimo) && Number.isFinite(massimo)) {
      const passi = doc.createElement("div");
      passi.className = "dm-apde-passi";
      passi.setAttribute("role", "group");
      passi.setAttribute("aria-label", voce.name);
      let valore = ora;
      const meno = doc.createElement("button");
      const piu = doc.createElement("button");
      const mostra = doc.createElement("span");
      mostra.className = "dm-apde-passi-valore";
      const decimali = String(passo).includes(".") ? String(passo).split(".")[1].length : 0;
      const disegna = () => {
        mostra.innerHTML = `${esc(numeroInParole(valore.toFixed(decimali)))}${
          unitaDelPasso ? `<small>${esc(unitaDelPasso)}</small>` : ""
        }`;
        meno.disabled = valore - passo < minimo - 1e-9;
        piu.disabled = valore + passo > massimo + 1e-9;
      };
      for (const [tasto, segno, verso] of [
        [meno, "−", -1],
        [piu, "+", 1],
      ]) {
        tasto.type = "button";
        tasto.className = "dm-apde-passo";
        tasto.textContent = segno;
        tasto.setAttribute("aria-label", `${segno} ${voce.name}`);
        tasto.addEventListener("click", (event) => {
          event.stopPropagation();
          valore = Math.min(massimo, Math.max(minimo, valore + verso * passo));
          disegna();
          comanda({
            domain: "number",
            service: "set_value",
            target: { entity_id: voce.entity },
            service_data: { value: valore },
          });
        });
      }
      disegna();
      passi.append(meno, mostra, piu);
      return passi;
    }
    const campo = doc.createElement("input");
    campo.type = "number";
    campo.className = "dm-apde-numero";
    campo.setAttribute("aria-label", voce.name);
    if (controllo.min != null) campo.min = controllo.min;
    if (controllo.max != null) campo.max = controllo.max;
    if (controllo.step != null) campo.step = controllo.step;
    campo.value = controllo.current;
    /* «Delayed end 0»: zero cosa? L'unita' accanto al numero lo dice. */
    const unita = clean(allStates()?.[voce.entity]?.attributes?.unit_of_measurement);
    campo.addEventListener("change", () => {
      const valore = Number(campo.value);
      if (!Number.isFinite(valore)) return;
      comanda({
        domain: "number",
        service: "set_value",
        target: { entity_id: voce.entity },
        service_data: { value: valore },
      });
    });
    if (!unita) return campo;
    const scatola = doc.createElement("span");
    scatola.className = "dm-apde-numero-box";
    const parola = doc.createElement("em");
    parola.textContent = unita;
    scatola.append(campo, parola);
    return scatola;
  }
  const tasto = doc.createElement("button");
  tasto.type = "button";
  if (controllo.kind === "press") {
    tasto.className = "dm-apde-tasto";
    tasto.textContent = "▶";
    tasto.setAttribute("aria-label", `${t("Esegui", "Run")} ${voce.name}`);
    tasto.addEventListener("click", (event) => {
      event.stopPropagation();
      comanda({ domain, service: "press", target: { entity_id: voce.entity } });
    });
    return tasto;
  }
  /* Un interruttore vero, che dice com'e'.
   *
   * Il tasto scriveva l'azione — «ON» su una cosa spenta, «OFF» su una
   * accesa — e accanto a «Power» un «ON» si legge come «e' acceso»: «non si
   * capisce nulla». Adesso c'e' la levetta, che a destra e colorata vuol dire
   * acceso, e la parola dello stato accanto. */
  tasto.className = "dm-apde-interruttore";
  tasto.setAttribute("role", "switch");
  tasto.setAttribute("aria-label", voce.name);
  const disegna = (acceso) => {
    tasto.dataset.acceso = acceso ? "true" : "false";
    tasto.setAttribute("aria-checked", acceso ? "true" : "false");
    tasto.innerHTML = `<span class="dm-apde-interruttore-parola">${esc(
      acceso ? t("Acceso", "On") : t("Spento", "Off"),
    )}</span><span class="dm-apde-interruttore-binario" aria-hidden="true"><i></i></span>`;
  };
  disegna(Boolean(controllo.on));
  tasto.addEventListener("click", (event) => {
    event.stopPropagation();
    const acceso = tasto.dataset.acceso === "true";
    disegna(!acceso);
    comanda({ domain, service: acceso ? "turn_off" : "turn_on", target: { entity_id: voce.entity } });
  });
  return tasto;
}

function vesteIntegrazione(lista, appliance, giaMostrate, titoletto) {
  const deviceId = clean(appliance?.device_id);
  const memoria = Array.isArray(appliance?.device_entities) ? appliance.device_entities : [];
  if (!deviceId && !memoria.length) return;
  const catalogo = deviceId ? entitaDelDispositivo(deviceId) : null;
  const delDispositivo = catalogo || memoria.map((entity_id) => ({ entity_id: clean(entity_id) }));
  /* Le caselle scritte fuori dal dispositivo — la presa smart, i sensori
   * fatti in casa — sono dell'apparecchio quanto le altre: se non entrassero
   * qui sparirebbero dalla finestra appena si collega un'integrazione. */
  const gia = new Set(delDispositivo.map((voce) => clean(voce.entity_id)));
  const records = [
    ...delDispositivo,
    ...entita(appliance)
      .filter((id) => !gia.has(id))
      .map((entity_id) => ({ entity_id })),
  ];
  const gruppi = deviceEntityGroups(records, allStates(), {
    mapped: giaMostrate,
    locale: activeLocale(),
    readOnly: false,
  });
  const nuove = (voci) => voci.filter((voce) => !voce.mapped);
  const stato = soloQuelleViste(nuove(gruppi.state), appliance);
  /* Un'entita' scelta come «altro comando» (#338) esce di li' e basta: e' la
   * stessa entita', e disegnarla due volte — una fra i comandi del dispositivo
   * e una fra quelli scelti — sarebbe la stessa cosa detta due volte, con due
   * tasti che si contraddicono a vicenda mentre lo stato cambia. */
  const scelti = new Set(elencoComandi(appliance?.comandi));
  /* E quello vale uguale per una lettura scelta a mano (#471): «Altre letture»
   * qui sotto la disegna gia', ed e' li' che chi l'ha scelta se l'aspetta.
   * Lasciandola anche fra le letture del dispositivo, la stessa misura usciva
   * due volte nella stessa finestra, a due caselle di distanza — e chi legge
   * due caselle uguali pensa che siano due sonde. */
  const scelteDaLeggere = new Set(elencoLetture(appliance?.letture));
  /* E si toglie quello che si e' scelto di non vedere (#512): un dispositivo
   * moderno pubblica anche il numero di serie e tre diagnostiche, e chi le
   * nasconde le vuole nascoste in ogni fila di questa finestra. */
  const viste = (elenco) => soloQuelleViste(elenco, appliance);
  const letture = viste(nuove(gruppi.readings)).filter(
    (voce) => !scelteDaLeggere.has(voce.entity),
  );
  const comandi = viste(gruppi.controls).filter(
    (voce) => !scelti.has(voce.entity) && (!voce.mapped || voce.control?.kind !== "toggle"),
  );
  const diagnostica = viste(gruppi.diagnostics).filter((voce) => !scelti.has(voce.entity));
  if (
    !stato.length &&
    !letture.length &&
    !comandi.length &&
    !diagnostica.length &&
    !scelti.size &&
    !scelteDaLeggere.size
  )
    return;

  const statiOra = allStates();
  const token = tokenDi(appliance);

  /* La testa: con chi e' collegata, e cos'e'. */
  const testa = doc.createElement("section");
  testa.className = "dm-apde-integrazione";
  testa.dataset.dmApdeSource = catalogo ? "catalogo" : "memoria";
  const nome = clean(appliance.integration_name) || clean(appliance.integration);
  /* «LGE Y_V8_Y___W.B32QEUK (DEVICE_WASHER)»: il marchio come lo conosce
   * chi l'ha comprato, e il modello senza la sigla del protocollo. */
  const marchio = marchioInParole(appliance.device_manufacturer);
  const modello = modelloInParole(appliance.device_model);
  testa.innerHTML = `<span class="dm-apde-integrazione-ic" aria-hidden="true">🔗</span><span class="dm-apde-integrazione-testo"><strong>${esc(
    nome
      ? `${pick("Collegata a", "Connected to", activeLocale())} ${nome}`
      : t("Dall'integrazione", "From the integration"),
  )}</strong>${
    marchio || modello
      ? `<span>${marchio ? `<b>${esc(marchio)}</b>` : ""}${marchio && modello ? " · " : ""}${modello ? `<code>${esc(modello)}</code>` : ""}</span>`
      : ""
  }</span><i class="dm-apde-integrazione-punto" aria-hidden="true"></i>`;
  lista.append(testa);

  /* Lo stato: la fase in grande, come si legge sull'oblo'; il resto in
   * piccolo sotto. «Stato attuale spinning» in una pillola grigia non lo
   * guardava nessuno. */
  if (stato.length) {
    const conFase = stato.map((voce) => {
      const grezzo = clean(statiOra?.[voce.entity]?.state);
      const fase = /^(on|off)$/i.test(grezzo) ? null : faseInParole(grezzo, activeLocale());
      return { voce, fase: fase && fase.glifo !== "•" ? fase : null };
    });
    const principale = conFase.find((una) => una.fase);
    if (principale) {
      const banda = doc.createElement("button");
      banda.type = "button";
      banda.className = "dm-apde-fase hist-clickable";
      banda.dataset.dmApdeEntity = principale.voce.entity;
      const parole = nomeDellaVoce(principale.voce.name, token);
      banda.innerHTML = `<span class="dm-apde-fase-ic" aria-hidden="true">${esc(principale.fase.glifo)}</span><span class="dm-apde-fase-testo"><small>${esc(parole)}</small><strong>${esc(principale.fase.label)}</strong></span>`;
      banda.addEventListener("click", (event) =>
        apriStorico(event, principale.voce.entity, parole),
      );
      lista.append(banda);
    }
    const altre = conFase.filter((una) => una !== principale).map((una) => una.voce);
    if (altre.length) {
      const fila = doc.createElement("div");
      fila.className = "dm-apde-pillole";
      for (const voce of altre) {
        const nodo = doc.createElement("button");
        nodo.type = "button";
        nodo.className = "dm-apde-pillola";
        nodo.dataset.acceso = voce.on ? "true" : "false";
        nodo.dataset.dmApdeEntity = voce.entity;
        const parole = nomeDellaVoce(voce.name, token);
        const valore = statoInParole(statiOra?.[voce.entity]?.state, voce.value);
        nodo.innerHTML = `<span>${esc(parole)}</span> <b>${esc(valore)}</b>`;
        nodo.addEventListener("click", (event) => apriStorico(event, voce.entity, parole));
        fila.append(nodo);
      }
      lista.append(fila);
    }
  }

  /* Le letture: l'energia tutta in un riquadro — oggi, il mese, il totale
   * uno accanto all'altro, che e' come si confrontano — e le altre in
   * caselle col colore del loro genere: il tempo, i cicli, l'acqua. */
  if (letture.length) {
    lista.append(titoletto(t("Le letture del dispositivo", "The device readings")));
    const usate = new Set();
    const caselle = letture
      .map((voce) => {
        const unit = clean(statiOra?.[voce.entity]?.attributes?.unit_of_measurement);
        return { voce, unit, glifo: glifoDellaLettura(voce.entity, unit) };
      })
      .sort((a, b) => postoDelGlifo(a.glifo) - postoDelGlifo(b.glifo))
      .map((una) => ({
        ...una,
        parole: nomeDellaLettura(una.voce.entity, una.voce.name, una.unit, token, usate),
      }));
    /* Nell'ordine in cui si confrontano: oggi, il mese, l'anno, il totale. */
    const periodo = (parole) => {
      const detto = parole.toLowerCase();
      if (/oggi|today/.test(detto)) return 0;
      if (/mese|month/.test(detto)) return 1;
      if (/anno|year/.test(detto)) return 2;
      return 3;
    };
    const energia = caselle
      .filter((una) => una.glifo === "📊")
      .sort((a, b) => periodo(a.parole) - periodo(b.parole));
    const resto = energia.length >= 2 ? caselle.filter((una) => una.glifo !== "📊") : caselle;
    if (energia.length >= 2) {
      const riquadro = doc.createElement("div");
      riquadro.className = "dm-apde-energia";
      riquadro.innerHTML = `<div class="dm-apde-energia-testa"><span aria-hidden="true">⚡</span>${esc(
        t("Energia", "Energy"),
      )}</div>`;
      const colonne = doc.createElement("div");
      colonne.className = "dm-apde-energia-colonne";
      for (const { voce, parole } of energia) {
        const colonna = doc.createElement("button");
        colonna.type = "button";
        colonna.className = "dm-apde-energia-colonna hist-clickable";
        colonna.dataset.dmApdeEntity = voce.entity;
        const breve =
          conLaMaiuscola(parole.replace(/^(energia|energy)\s*/i, "")) || t("Totale", "Total");
        colonna.innerHTML = `<span>${esc(breve)}</span>${numeroGrande(voce.value)}`;
        colonna.addEventListener("click", (event) => apriStorico(event, voce.entity, parole));
        colonne.append(colonna);
      }
      riquadro.append(colonne);
      lista.append(riquadro);
    }
    if (resto.length) {
      const griglia = doc.createElement("div");
      griglia.className = "dm-apde-caselle";
      for (const { voce, glifo, parole } of resto) {
        const casella = doc.createElement("button");
        casella.type = "button";
        casella.className = "dm-apde-casella hist-clickable";
        casella.dataset.dmApdeEntity = voce.entity;
        casella.dataset.genere = genereDelGlifo(glifo);
        casella.innerHTML = casellaDiLettura(glifo, voce.value, parole);
        casella.addEventListener("click", (event) => apriStorico(event, voce.entity, parole));
        griglia.append(casella);
      }
      lista.append(griglia);
    }
  }

  /* I comandi: un elenco solo, come le impostazioni del telefono — una riga
   * per comando, il suo segno a sinistra e il comando vero a destra. */
  const rigaDiComando = (voce) => {
    const riga = doc.createElement("div");
    riga.className = "dm-apde-comando";
    riga.dataset.dmApdeEntity = voce.entity;
    const parole = nomeDellaVoce(voce.name, token);
    const segno = segnoDelComando(voce, parole);
    riga.dataset.genere = segno.genere;
    const icona = doc.createElement("span");
    icona.className = "dm-apde-comando-ic";
    icona.setAttribute("aria-hidden", "true");
    icona.textContent = segno.glifo;
    const etichetta = doc.createElement("span");
    etichetta.className = "dm-apde-comando-nome";
    etichetta.textContent = parole;
    riga.append(icona, etichetta);
    const tasto = tastoDelComando(voce);
    if (tasto) riga.append(tasto);
    if (voce.control?.kind === "select" && tasto?.classList?.contains("dm-apde-scelte"))
      riga.dataset.largo = "true";
    return riga;
  };
  if (comandi.length) {
    lista.append(titoletto(t("I comandi del dispositivo", "The device controls")));
    const gruppo = doc.createElement("div");
    gruppo.className = "dm-apde-gruppo";
    for (const voce of comandi) gruppo.append(rigaDiComando(voce));
    lista.append(gruppo);
  }
  aggiungiAltreLetture(lista, appliance, titoletto);
  /* Quelli scelti a mano stanno subito sotto (#338), prima della diagnostica:
   * sono i tasti per cui la finestra si apre, non un dettaglio. */
  aggiungiAltriComandi(lista, appliance, titoletto);
  if (diagnostica.length) {
    const cassetto = doc.createElement("details");
    cassetto.className = "dm-apde-diagnostica";
    const sommario = doc.createElement("summary");
    sommario.textContent = `${t("Diagnostica", "Diagnostics")} · ${diagnostica.length}`;
    cassetto.append(sommario);
    for (const voce of diagnostica) {
      if (voce.control) {
        cassetto.append(rigaDiComando(voce));
        continue;
      }
      const riga = doc.createElement("button");
      riga.type = "button";
      riga.className = "dm-apde-pillola";
      riga.dataset.acceso = voce.on ? "true" : "false";
      riga.dataset.dmApdeEntity = voce.entity;
      const parole = nomeDellaVoce(voce.name, token);
      const valore = statoInParole(statiOra?.[voce.entity]?.state, numeroInParole(voce.value));
      riga.innerHTML = `<span>${esc(parole)}</span> <b>${esc(valore)}</b>`;
      riga.addEventListener("click", (event) => apriStorico(event, voce.entity, parole));
      cassetto.append(riga);
    }
    lista.append(cassetto);
  }
}

/* Il catalogo arriva dopo la finestra: se e' ancora aperta, si riveste. */
function alCatalogo() {
  if (state.aperto == null) return;
  const modal = doc?.getElementById?.("details-modal");
  if (!modal?.classList?.contains("show")) return;
  try {
    riveste(state.aperto);
  } catch (_errore) {}
}

function aggancia() {
  const originale = root.apriApplianceDetail;
  if (typeof originale !== "function" || originale.__dmApdeVestito) return false;
  function vestito(indice, ...resto) {
    const esito = originale.call(this, indice, ...resto);
    try {
      riveste(Number(indice));
    } catch (_errore) {}
    return esito;
  }
  Object.assign(vestito, originale);
  vestito.__dmApdeVestito = true;
  vestito.__dmPrevious = originale;
  root.apriApplianceDetail = vestito;
  return true;
}

function css() {
  return `
    /* La colonna si DICHIARA stringibile, e non e' un dettaglio.
     *
     * «Tutti i popup e sezioni e card, qualsiasi cosa, deve avere adattamento
     * schermo: non puo' essere tagliata.» Sulla lavastoviglie il nome del
     * comando e il suo menu uscivano dal bordo destro, e la finestra li
     * TAGLIAVA invece di farli scorrere — «.modal-card» ha «overflow-x:hidden»,
     * che e' giusto (una finestra che scorre di lato e' peggio) ma vuol dire
     * che quello che non ci sta non si vede e basta.
     *
     * La causa: una griglia senza colonne dichiarate ne fa una implicita
     * «auto», e una traccia «auto» si allarga fino al contenuto piu' largo
     * invece di fermarsi al contenitore. Misurato a 430 px: la lista era 403 px
     * dentro uno spazio da 384, e venti elementi finivano fuori — a 320 px ne
     * restavano fuori 114. Con «minmax(0,1fr)» la traccia puo' stringersi e la
     * lista torna larga esattamente quanto la finestra, a ogni misura provata
     * (320, 360, 390, 430). */
    #details-list[data-dm-apde-owner="moduli"]{
      display:grid;grid-template-columns:minmax(0,1fr);gap:0}
    #details-list .dm-apde-racconto{
      display:grid;gap:10px;margin:0 0 16px;padding:14px 15px 13px;border-radius:16px;
      border:1px solid color-mix(in srgb,var(--dm-verdetto,#10b981) 24%,transparent);
      background:linear-gradient(160deg,
        color-mix(in srgb,var(--dm-verdetto,#10b981) 11%,var(--card-bg,#fff)),
        var(--card-bg,#fff) 72%)}
    #details-list .dm-apde-racconto[data-dm-verdetto="bene"]{--dm-verdetto:#10b981}
    #details-list .dm-apde-racconto[data-dm-verdetto="corso"]{--dm-verdetto:#f59e0b}
    #details-list .dm-apde-verdetto{
      justify-self:start;display:inline-flex;align-items:center;gap:6px;
      padding:4px 10px;border-radius:999px;font-size:10px;font-weight:900;
      letter-spacing:1.6px;text-transform:uppercase;
      background:color-mix(in srgb,var(--dm-verdetto,#10b981) 16%,transparent);
      color:color-mix(in srgb,var(--dm-verdetto,#10b981) 80%,#0f172a)}
    #details-list .dm-apde-verdetto::before{
      content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
    #details-list .dm-apde-frase{margin:0;font-size:14.5px;font-weight:700;line-height:1.45;color:var(--text,#0f172a)}
    #details-list .dm-apde-titoletto{
      margin:20px 2px 10px;font-size:13px;font-weight:800;letter-spacing:0;
      text-transform:none;color:var(--text,#0f172a)}
    #details-list .dm-apde-caselle{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    /* La casella: il colore del suo genere, il glifo nel suo tondo, la
       parola intera e il numero grande con l'unita' piccola. */
    #details-list .dm-apde-casella{
      --g:#64748b;
      display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:10px 9px;
      padding:13px 13px 14px;border-radius:18px;text-align:left;cursor:pointer;
      border:1px solid color-mix(in srgb,var(--g) 20%,var(--card-border,#e2e8f0));
      background:linear-gradient(155deg,color-mix(in srgb,var(--g) 13%,var(--card-bg,#fff)),var(--card-bg,#fff) 72%);
      color:inherit;font:inherit;transition:transform .15s}
    #details-list .dm-apde-casella:active{transform:scale(.98)}
    #details-list .dm-apde-casella[data-genere="potenza"]{--g:#f97316}
    #details-list .dm-apde-casella[data-genere="energia"]{--g:#f59e0b}
    #details-list .dm-apde-casella[data-genere="tempo"]{--g:#8b5cf6}
    #details-list .dm-apde-casella[data-genere="cicli"]{--g:#14b8a6}
    #details-list .dm-apde-casella[data-genere="caldo"]{--g:#ef4444}
    #details-list .dm-apde-casella[data-genere="acqua"]{--g:#0ea5e9}
    #details-list .dm-apde-casella[data-genere="giri"]{--g:#6366f1}
    #details-list .dm-apde-casella[data-genere="costo"]{--g:#10b981}
    #details-list .dm-apde-casella-ic{
      display:grid;place-items:center;width:32px;height:32px;border-radius:11px;
      font-size:16px;line-height:1;background:color-mix(in srgb,var(--g,#64748b) 18%,transparent)}
    #details-list .dm-apde-casella-nome{
      min-width:0;font-size:12px;font-weight:700;line-height:1.2;color:var(--text-dim,#64748b);
      display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere}
    #details-list .dm-apde-casella .dm-apde-numero-grande{grid-column:1 / -1}
    #details-list .dm-apde-numero-grande{
      display:block;font-family:'Oswald',system-ui,sans-serif;font-weight:500;font-size:28px;line-height:1;
      color:var(--text,#0f172a);font-variant-numeric:tabular-nums;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #details-list .dm-apde-numero-grande small{
      margin-left:4px;font-family:inherit;font-size:13px;font-weight:600;color:var(--text-dim,#64748b)}
    /* L'energia: un riquadro solo, le colonne una accanto all'altra. */
    #details-list .dm-apde-energia{
      margin:0 0 10px;padding:14px 14px 6px;border-radius:20px;
      border:1px solid color-mix(in srgb,#f59e0b 26%,var(--card-border,#e2e8f0));
      background:linear-gradient(150deg,color-mix(in srgb,#f59e0b 16%,var(--card-bg,#fff)),var(--card-bg,#fff) 75%)}
    #details-list .dm-apde-energia-testa{
      display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;color:color-mix(in srgb,#f59e0b 70%,#422006)}
    #details-list .dm-apde-energia-testa span{
      display:grid;place-items:center;width:28px;height:28px;border-radius:10px;
      background:color-mix(in srgb,#f59e0b 22%,transparent);font-size:14px}
    #details-list .dm-apde-energia-colonne{
      display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:0}
    #details-list .dm-apde-energia-colonna{
      display:grid;gap:6px;padding:12px 4px 10px;text-align:left;cursor:pointer;
      border:0;border-top:1px solid color-mix(in srgb,#f59e0b 18%,transparent);
      background:none;color:inherit;font:inherit}
    #details-list .dm-apde-energia-colonna>span{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}
    #details-list .dm-apde-energia-colonna .dm-apde-numero-grande{font-size:24px}
    /* La fase: in grande, col suo glifo, come sull'oblo'. */
    #details-list .dm-apde-fase{
      display:flex;align-items:center;gap:13px;width:100%;margin:12px 0 8px;padding:14px 16px;
      border-radius:20px;cursor:pointer;text-align:left;font:inherit;color:inherit;
      border:1px solid color-mix(in srgb,#0ea5e9 28%,var(--card-border,#e2e8f0));
      background:linear-gradient(120deg,color-mix(in srgb,#0ea5e9 16%,var(--card-bg,#fff)),
        color-mix(in srgb,#6366f1 8%,var(--card-bg,#fff)))}
    #details-list .dm-apde-fase-ic{
      display:grid;place-items:center;width:46px;height:46px;border-radius:15px;flex:0 0 auto;
      font-size:24px;background:var(--card-bg,#fff);box-shadow:0 4px 14px color-mix(in srgb,#0ea5e9 22%,transparent)}
    #details-list .dm-apde-fase-testo{display:grid;gap:2px;min-width:0}
    #details-list .dm-apde-fase-testo small{font-size:12px;font-weight:700;color:var(--text-dim,#64748b)}
    #details-list .dm-apde-fase-testo strong{
      font-family:'Oswald',system-ui,sans-serif;font-weight:500;font-size:26px;line-height:1.05;color:var(--text,#0f172a)}
    #details-list .dm-apde-pillole{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 4px}
    #details-list .dm-apde-pillola{
      display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border-radius:999px;
      font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;
      border:1px solid var(--card-border,#e2e8f0);
      background:var(--surface-2,#f8fafc);color:var(--text-dim,#64748b)}
    #details-list .dm-apde-pillola::before{
      content:"";width:5px;height:5px;border-radius:50%;background:currentColor}
    #details-list .dm-apde-pillola[data-acceso="true"]{
      border-color:color-mix(in srgb,#10b981 34%,transparent);
      background:color-mix(in srgb,#10b981 12%,transparent);
      color:color-mix(in srgb,#10b981 76%,#0f172a)}
    #details-list .dm-apde-pillola b{font-weight:900;color:inherit}
    /* E la riga va a capo invece di stringere il comando fino a non usarlo:
       su uno schermo stretto un menu largo quaranta pixel non si tocca. */
    #details-list .dm-apde-comando{
      display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;
      margin:0 0 8px;padding:10px 12px;border-radius:14px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff)}
    /* I comandi del dispositivo: un elenco solo, le righe divise da un filo. */
    #details-list .dm-apde-gruppo{
      border-radius:20px;overflow:hidden;
      border:1px solid var(--card-border,#e2e8f0);background:var(--card-bg,#fff)}
    #details-list .dm-apde-gruppo>.dm-apde-comando{
      --g:#0ea5e9;margin:0;padding:12px 14px;border:0;border-radius:0;
      border-top:1px solid var(--card-border,#eef2f7);min-height:60px}
    #details-list .dm-apde-gruppo>.dm-apde-comando:first-child{border-top:0}
    #details-list .dm-apde-comando[data-genere="accensione"]{--g:#10b981}
    #details-list .dm-apde-comando[data-genere="tempo"]{--g:#8b5cf6}
    #details-list .dm-apde-comando[data-genere="programma"]{--g:#f59e0b}
    #details-list .dm-apde-comando-ic{
      display:grid;place-items:center;width:34px;height:34px;border-radius:11px;flex:0 0 auto;
      font-size:16px;font-weight:900;color:var(--g,#0ea5e9);
      background:color-mix(in srgb,var(--g,#0ea5e9) 15%,transparent)}
    #details-list .dm-apde-comando>.dm-apde-comando-nome{flex:1 1 0;min-width:min-content;white-space:normal;line-height:1.2}
    #details-list .dm-apde-comando[data-largo="true"]>.dm-apde-scelte{flex:1 1 100%}
    /* Le scelte: tasti uno accanto all'altro, quello attivo colorato. */
    #details-list .dm-apde-scelte{
      display:flex;gap:4px;padding:4px;border-radius:14px;background:var(--surface-2,#f1f5f9)}
    #details-list .dm-apde-scelta{
      flex:1 1 auto;min-width:0;height:36px;padding:0 6px;border:0;border-radius:10px;cursor:pointer;
      font:inherit;font-size:12px;font-weight:800;color:var(--text-dim,#64748b);background:transparent;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .15s,color .15s}
    #details-list .dm-apde-scelta[aria-pressed="true"]{
      background:var(--card-bg,#fff);color:#0284c7;box-shadow:0 1px 4px rgba(15,23,42,.14)}
    /* Il meno e il piu', col numero e la sua unita' in mezzo. */
    #details-list .dm-apde-passi{
      display:inline-flex;align-items:center;gap:4px;padding:4px;border-radius:14px;
      background:var(--surface-2,#f1f5f9)}
    #details-list .dm-apde-passo{
      width:34px;height:34px;border:0;border-radius:10px;cursor:pointer;font:inherit;
      font-size:18px;font-weight:800;color:var(--text,#0f172a);background:var(--card-bg,#fff);
      box-shadow:0 1px 3px rgba(15,23,42,.12)}
    #details-list .dm-apde-passo:disabled{opacity:.35;cursor:not-allowed}
    #details-list .dm-apde-passi-valore{
      min-width:48px;text-align:center;font-family:'Oswald',system-ui,sans-serif;font-size:20px;
      font-weight:500;color:var(--text,#0f172a);font-variant-numeric:tabular-nums}
    #details-list .dm-apde-passi-valore small{margin-left:3px;font-family:inherit;font-size:12px;color:var(--text-dim,#64748b)}
    #details-list .dm-apde-comando-nome{
      min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      font-size:13.5px;font-weight:800;color:var(--text,#0f172a)}
    #details-list .dm-apde-tasto{
      flex:0 0 auto;min-width:48px;height:32px;border:0;border-radius:10px;cursor:pointer;
      font-size:12px;font-weight:900;background:rgba(14,165,233,.14);color:#0284c7}
    #details-list .dm-apde-tasto.on{background:#0ea5e9;color:#fff}
    /* L'interruttore: la parola dello stato e la levetta. */
    #details-list .dm-apde-interruttore{
      flex:0 0 auto;display:inline-flex;align-items:center;gap:9px;padding:0;border:0;
      background:none;cursor:pointer;font:inherit;color:var(--text-dim,#64748b)}
    #details-list .dm-apde-interruttore-parola{font-size:12px;font-weight:800}
    #details-list .dm-apde-interruttore-binario{
      position:relative;display:block;width:46px;height:28px;border-radius:999px;
      background:var(--card-border,#cbd5e1);transition:background .2s}
    #details-list .dm-apde-interruttore-binario i{
      position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;
      background:#fff;box-shadow:0 1px 3px rgba(15,23,42,.3);transition:transform .2s}
    #details-list .dm-apde-interruttore[data-acceso="true"]{color:#059669}
    #details-list .dm-apde-interruttore[data-acceso="true"] .dm-apde-interruttore-binario{background:#10b981}
    #details-list .dm-apde-interruttore[data-acceso="true"] .dm-apde-interruttore-binario i{transform:translateX(18px)}
    #details-list .dm-apde-numero-box{
      flex:1 1 120px;max-width:220px;display:inline-flex;align-items:center;gap:6px}
    #details-list .dm-apde-numero-box .dm-apde-numero{flex:1 1 auto;max-width:none}
    #details-list .dm-apde-numero-box em{
      font-style:normal;font-size:12px;font-weight:800;color:var(--text-dim,#64748b)}
    /* Gli altri comandi (#338): un tasto che non si puo' premere lo dice, e
       la riga si stacca appena dalle altre per farsi riconoscere. */
    #details-list .dm-apde-tasto[disabled]{opacity:.45;cursor:not-allowed}
    #details-list .dm-apde-comando-extra{
      border-color:color-mix(in srgb,#0ea5e9 32%,var(--card-border,#e2e8f0))}
    #details-list .dm-apde-vetrina{display:block;gap:0;padding:0;margin:0 0 4px}
    #details-list .dm-apde-vetrina .appl-wide-card.dm-ap-card{cursor:default;box-shadow:none;transform:none!important}
    #details-list .dm-apde-vetrina .appl-wide-card.dm-ap-card:hover{transform:none;box-shadow:none}
    /* La testa: con chi e' collegata, il marchio e il modello, e il punto
       verde di chi e' in linea. */
    #details-list .dm-apde-integrazione{
      display:flex;align-items:center;gap:11px;margin:18px 0 0;padding:10px 14px 10px 10px;
      border-radius:16px;border:1px solid var(--card-border,#e2e8f0);background:var(--surface-2,#f8fafc)}
    #details-list .dm-apde-integrazione-ic{
      display:grid;place-items:center;width:34px;height:34px;border-radius:11px;flex:0 0 auto;
      font-size:15px;background:var(--card-bg,#fff);box-shadow:0 1px 3px rgba(15,23,42,.1)}
    #details-list .dm-apde-integrazione-testo{display:grid;gap:2px;min-width:0;flex:1 1 auto}
    #details-list .dm-apde-integrazione strong{font-size:13px;font-weight:800;color:var(--text,#0f172a)}
    #details-list .dm-apde-integrazione-testo>span{
      font-size:11.5px;font-weight:600;color:var(--text-dim,#64748b);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #details-list .dm-apde-integrazione-testo b{font-weight:800;color:var(--text,#0f172a)}
    #details-list .dm-apde-integrazione code{font:inherit;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px}
    #details-list .dm-apde-integrazione-punto{
      width:9px;height:9px;border-radius:50%;flex:0 0 auto;background:#10b981;
      box-shadow:0 0 0 4px color-mix(in srgb,#10b981 20%,transparent)}
    #details-list .dm-apde-menu,#details-list .dm-apde-numero{
      flex:1 1 140px;min-width:0;max-width:220px;height:32px;padding:0 8px;border-radius:10px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--surface-2,#f8fafc);
      color:var(--text,#0f172a);font:inherit;font-size:12px;font-weight:700}
    #details-list .dm-apde-numero{flex-basis:96px;text-align:right;font-variant-numeric:tabular-nums}
    #details-list .dm-apde-diagnostica{
      margin:14px 0 0;padding:0 12px 6px;border-radius:14px;
      border:1px solid var(--card-border,#e2e8f0);background:var(--surface-2,#f8fafc)}
    #details-list .dm-apde-diagnostica>summary{
      padding:10px 0;cursor:pointer;list-style:none;font-size:9.5px;font-weight:900;
      letter-spacing:1.7px;text-transform:uppercase;color:var(--text-dim,#94a3b8)}
    #details-list .dm-apde-diagnostica>summary::-webkit-details-marker{display:none}
    #details-list .dm-apde-diagnostica>.dm-apde-pillola{margin:0 6px 6px 0}
    #details-list .dm-apde-diagnostica>.dm-apde-comando{margin:0 0 6px}
    @media(max-width:420px){#details-list .dm-apde-caselle{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
}

export function installApplianceDetailPopupSection() {
  if (!doc || state.installed) return;
  state.installed = true;
  installStyle("dm-appliance-detail-popup-style", css());
  aggancia();
  for (const eventName of ["dashboardmodern:legacy-ready", "dashboardmodern:runtime-ready"]) {
    root.addEventListener?.(eventName, aggancia);
  }
  root.addEventListener?.("dashboardmodern:integrations-catalog", alCatalogo);
}

if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", installApplianceDetailPopupSection, { once: true });
} else {
  senzaCadere(installApplianceDetailPopupSection);
}
