/* L'auto che va a benzina, nella pagina Auto (#208).
 *
 * «Ho la mia auto che ha i sensori di livello carburante, odometro, autonomia
 * e portiere: e' possibile scegliere a monte se visualizzare un'auto elettrica
 * o classica con i sensori disponibili?» E dal campo: «anche lo stato dei
 * finestrini e la pressione dei pneumatici».
 *
 * Tre cose, e nessuna rifa' quello che la pagina Auto sa gia' fare.
 *
 * La prima e' la scelta «a monte»: nella scheda dell'auto, sotto il nome, una
 * tendina dice se il motore e' elettrico, termico o ibrido. Vale per QUELLA
 * vettura — in un garage possono starci tutte e due — e la salva la stessa
 * mano che salva il resto della scheda.
 *
 * La seconda sono le caselle: carburante, motore, portiere, finestrini,
 * allarme, batteria di servizio, olio, temperatura esterna, ultimo viaggio,
 * carburante consumato, pneumatici. Sono `dm.ev_*` come tutte le altre della
 * pagina Auto, e si aggiungono all'elenco che il guscio gia' disegna: entrano
 * nel profilo per la stessa strada, con la stessa lente e lo stesso cestino.
 *
 * La terza e' il quadro. Con un'auto termica la pagina non mostra piu' la
 * ricarica — batteria, wallbox, sessione, target — che per lei non vuol dire
 * niente, e al loro posto c'e' il serbatoio, con intorno le cose che uno
 * guarda di un'auto ferma in garage: se e' chiusa, se il motore gira, quanto
 * puo' fare. Un'ibrida tiene tutti e due i quadri, perche' li ha tutti e due.
 */
import { CAPACITA_DI_SERIE } from "../core/il-tempo-della-ricarica.js";
import { AUTO_DALL_ALTO } from "../core/auto-dallalto.js";
import {
  CASELLE_DELL_AUTO,
  CASELLE_TERMICHE,
  RIFERIMENTI_DELL_AUTO,
  RIFERIMENTI_IN_BLOCCO,
  RIFERIMENTI_TERMICI,
  RUOTE,
  casellaDellAuto,
  comeStannoLeGomme,
  cosaFaLAuto,
  energiaDiOggi,
  istanteDetto,
  laSettimana,
  letturaTermica,
  senzaParentesi,
  temperatureDellAuto,
} from "../core/auto-termica.js";
import {
  CAPACITA_DI_CASA_KEY,
  MEZZO_DI_CASA_KEY,
  MOTORE_DI_CASA_KEY,
  TIPI_MOTORE,
  VEHICLE_CAPACITY_FIELD,
  VEHICLE_KEY_FIELD,
  CASELLA_DELLA_CAPACITA,
  capacitaDellaBatteria,
  kilowattoraDalloStato,
  mezzoInUso,
  motoreDellaVettura,
  siRicarica,
  tipoMotore,
  updateVehicle,
} from "../core/vehicle-model.js";
import {
  activeVehicle,
  bozzaAperta,
  editedVehicle,
  liveState,
  profiles,
  salvaAuto,
  vehicleBatteryEntity,
  vehiclePlugged,
} from "./ev-section.js";
import { registraTitoloDiPagina, renderPageMastheads } from "./page-masthead-section.js";
import {
  allStates,
  clean,
  disegnoDiCasa,
  doc,
  esc,
  formatNumber,
  installStyle,
  lexicalGlobal,
  locale,
  onEditorRedraw,
  readJson,
  root,
  t,
  wrapFunction,
  writeJsonIfChanged,
  senzaCadere,
} from "./shared.js";

const KEY = "__DASHBOARDMODERN_AUTO_TERMICA__";
const state = (root[KEY] ||= {
  installed: false,
  frame: 0,
  firma: "",
  /* La capacita' scritta mentre la vettura non esiste ancora: si tiene qui
   * finche' non c'e' un profilo a cui attaccarla. Vedi `scriviLaCapacita`. */
  capacitaInBozza: "",
  autoPrimaDellaBozza: null,
  /* «Altri dati» aperto o chiuso: il blocco si ridisegna a ogni cambio di
   * stato, e chi l'ha aperto non deve vederselo richiudere sotto le dita. */
  altriAperti: false,
  testa: "",
});

const ARC_RADIUS = 50;
const ARC_LENGTH = 2 * Math.PI * ARC_RADIUS;

/* ── di che motore parla la pagina (#326) ─────────────────────────────── */

/* «Rientrando nella configurazione il Motore risulta Elettrica», e insieme la
 * batteria e la SESSIONE RICARICA che restavano in pagina su un'auto a
 * benzina: un guasto solo, visto da tre parti. Il tipo di motore lo leggeva e
 * lo scriveva soltanto il tasto «Salva auto», e quel tasto salva un PROFILO —
 * che chi ha una macchina sola non ha, perche' le caselle `dm.ev_*` le compila
 * nella mappatura generale della plancia. La scelta non aveva dove andare.
 *
 * Adesso la casa ce l'ha: la vettura se ne ha una, la plancia altrimenti. E
 * non si aspetta piu' nessun tasto — la tendina scrive appena la si muove,
 * cosi' nessun salvataggio puo' portarsela via. */
export function motoreDiCasa() {
  return tipoMotore(readJson(MOTORE_DI_CASA_KEY, ""));
}

/** La capacita' scritta per la plancia, o `null` se non c'e'. */
export function capacitaDiCasa() {
  return capacitaDellaBatteria({ [VEHICLE_CAPACITY_FIELD]: readJson(CAPACITA_DI_CASA_KEY, "") });
}

export function motoreInPagina() {
  return motoreDellaVettura(activeVehicle(), motoreDiCasa());
}

/* E che mezzo e' (#75): la moto in uso, o quella dichiarata dalla plancia da
 * chi profili non ne ha. Sta qui accanto al motore perche' e' la stessa
 * domanda fatta sull'altro asse, e perche' chi la chiede — il titolo della
 * pagina, poco piu' sotto — le vuole tutte e due insieme. */
export function mezzoInPagina() {
  return mezzoInUso(activeVehicle(), readJson(MEZZO_DI_CASA_KEY, ""));
}

/* ── le parole ────────────────────────────────────────────────────────── */

/* L'intestazione della pagina dice di che veicolo parla: «Carica · Autonomia ·
 * Wallbox» sopra un serbatoio sarebbe una bugia, e «Portiere» sopra una moto
 * pure (#75).
 *
 * Un'auto elettrica non ha titolo suo: tiene quello che il guscio le ha dato,
 * che dice gia' la cosa giusta. Una moto elettrica invece SI', perche' quel
 * titolo dice «Auto» e di lei non e' vero. */
export function titoloDellaPagina(tipo = motoreInPagina(), mezzo = mezzoInPagina()) {
  const moto = mezzo === "moto";
  if (tipo === "termica")
    return moto
      ? {
          title: t("Moto", "Motorcycle"),
          subtitle: t("Carburante · Autonomia · Motore", "Fuel · Range · Engine"),
        }
      : {
          title: t("Auto", "Car"),
          subtitle: t("Carburante · Autonomia · Portiere", "Fuel · Range · Doors"),
        };
  if (tipo === "ibrida")
    return {
      title: moto ? t("Moto ibrida", "Hybrid motorcycle") : t("Auto ibrida", "Hybrid car"),
      subtitle: t("Carica · Carburante · Autonomia", "Charge · Fuel · Range"),
    };
  return moto
    ? {
        title: t("Moto", "Motorcycle"),
        subtitle: t("Carica · Autonomia · Wallbox", "Charge · Range · Wallbox"),
      }
    : null;
}

export function nomeDelMotore(tipo) {
  if (tipo === "termica") return t("Termica (benzina, diesel, GPL)", "Combustion (petrol, diesel, LPG)");
  if (tipo === "ibrida") return t("Ibrida plug-in", "Plug-in hybrid");
  return t("Elettrica", "Electric");
}

/* L'etichetta di ogni casella, come compare nella scheda. Il riferimento e'
 * la chiave, cosi' chi la rinomina dalla scheda la ritrova con il suo nome. */
export function etichettaDellaCasella(ref) {
  switch (ref) {
    case "dm.ev_carburante":
      return t("Livello carburante (%)", "Fuel level (%)");
    case "dm.ev_motore":
      return t("Motore (acceso/spento)", "Engine (running/off)");
    case "dm.ev_portiere":
      return t("Portiere (bloccate/aperte)", "Doors (locked/open)");
    case "dm.ev_finestrini":
      return t("Finestrini (aperti/chiusi)", "Windows (open/closed)");
    case "dm.ev_bagagliaio":
      return t("Bagagliaio (chiuso/aperto)", "Boot (closed/open)");
    case "dm.ev_cofano":
      return t("Cofano motore (chiuso/aperto)", "Bonnet (closed/open)");
    case "dm.ev_posizione":
      return t("Posizione (device_tracker)", "Location (device_tracker)");
    case "dm.ev_allarme":
      return t("Allarme dell'auto", "Car alarm");
    case "dm.ev_batteria_servizio":
      return t("Batteria di servizio 12 V (% o V)", "Service battery 12 V (% or V)");
    case "dm.ev_temperatura_olio":
      return t("Temperatura olio", "Oil temperature");
    case "dm.ev_temperatura_esterna":
      return t("Temperatura esterna", "Outside temperature");
    case "dm.ev_ultimo_viaggio":
      return t("Ultimo viaggio (km)", "Last trip (km)");
    case "dm.ev_carburante_totale":
      return t("Carburante consumato in totale (L)", "Total fuel used (L)");
    case "dm.ev_pneumatici":
      return t("Pressione pneumatici", "Tyre pressure");
    case "dm.ev_pneumatico_ant_sx":
      return `${t("Pressione pneumatici", "Tyre pressure")} — ${parolaDellaRuota("antSx")}`;
    case "dm.ev_pneumatico_ant_dx":
      return `${t("Pressione pneumatici", "Tyre pressure")} — ${parolaDellaRuota("antDx")}`;
    case "dm.ev_pneumatico_post_sx":
      return `${t("Pressione pneumatici", "Tyre pressure")} — ${parolaDellaRuota("postSx")}`;
    case "dm.ev_pneumatico_post_dx":
      return `${t("Pressione pneumatici", "Tyre pressure")} — ${parolaDellaRuota("postDx")}`;
    default: {
      /* I dati dell'auto connessa portano l'etichetta con se': una tabella
       * sola per la scheda, la pagina e la finestra in Home. */
      const voce = casellaDellAuto(ref);
      return voce ? t(voce.it, voce.en) : clean(ref);
    }
  }
}

/* Il nome che una lettura ha ricevuto in configurazione (#326).
 *
 * «Le etichette possono essere modificabili? Nel mio caso tutto quello che
 * inizia con TUCSON.» Rinominarle si poteva gia': ogni casella della scheda
 * Auto ha la sua riga con la scritta modificabile — «Tocca per rinominare
 * l'etichetta» — e quello che ci si scrive finisce in `cd_slot_labels`,
 * viaggia con la configurazione condivisa e si ritrova su ogni dispositivo.
 * Solo che non arrivava fin qui: la pagina stampava le sue parole di serie e
 * il nome scelto restava a decorare l'editor. Rinominare non cambiava niente
 * dove si guarda, che dal di fuori e' come non poter rinominare.
 *
 * Adesso il nome scritto vince, e vale per la casella, per il quadretto delle
 * gomme e per il titolo dello storico che si apre toccandola: un nome dato
 * una volta vale ovunque quella lettura compaia. */
export function etichettaScelta(ref, predefinita) {
  const scelte = readJson("cd_slot_labels", {});
  const suo = scelte && typeof scelte === "object" ? clean(scelte[clean(ref)]) : "";
  return suo || predefinita;
}

/* Come si chiama ogni ruota, guardando l'auto dall'alto con il muso in su. */
export function parolaDellaRuota(ruota) {
  if (ruota === "antSx") return t("Anteriore sinistro", "Front left");
  if (ruota === "antDx") return t("Anteriore destro", "Front right");
  if (ruota === "postSx") return t("Posteriore sinistro", "Rear left");
  return t("Posteriore destro", "Rear right");
}

function parolaDellePortiere(codice) {
  if (codice === "bloccate") return t("Portiere bloccate", "Doors locked");
  if (codice === "sbloccate") return t("Portiere sbloccate", "Doors unlocked");
  if (codice === "aperte") return t("Portiere aperte", "Doors open");
  return t("Portiere chiuse", "Doors closed");
}

function parolaDellAllarme(codice) {
  if (codice === "scattato") return t("Allarme scattato", "Alarm triggered");
  if (codice === "inserito") return t("Allarme inserito", "Alarm armed");
  return t("Allarme disinserito", "Alarm disarmed");
}

/* ── le caselle nella scheda ──────────────────────────────────────────── */

/* Le caselle entrano nell'elenco del guscio, che e' `const` nel suo script:
 * si raggiunge con l'eval indiretto e si allunga. Da li' in poi il guscio le
 * disegna, le salva col profilo e le rilegge come tutte le altre — e il
 * modulo delle caselle mette loro la lente e il cestino. */
export function mettiLeCaselle() {
  const slots = lexicalGlobal("CD_SLOTS");
  if (!slots || typeof slots !== "object") return false;
  const sezione = Object.values(slots).find(
    (voce) => Array.isArray(voce?.slots) && voce.slots.some((slot) => slot?.ref === "dm.ev_batteria_auto"),
  );
  if (!sezione) return false;
  /* La scheda si chiama «Veicoli», non «Auto elettrica»: da qui passano anche
   * le vetture a benzina e le moto (#75), e una scheda che si chiama «Auto»
   * mentre dentro ci sta una moto dice il falso a chi la apre. */
  if (/auto elettrica|electric|^.?\s*auto$|^.?\s*car$/i.test(String(sezione.label || "")))
    sezione.label = `🚗 ${t("Veicoli", "Vehicles")}`;
  let aggiunte = 0;
  const aggiungi = (voce) => {
    if (sezione.slots.some((slot) => slot?.ref === voce.ref)) return;
    sezione.slots.push({ ref: voce.ref, lbl: etichettaDellaCasella(voce.ref) });
    aggiunte += 1;
  };
  for (const voce of CASELLE_TERMICHE) aggiungi(voce);
  /* Dopo quelle termiche, i dati dell'auto connessa: sono le caselle che
   * GdAAuto riempie da sola, e chi ha un'altra integrazione le sceglie qui a
   * mano, una per una. */
  for (const voce of CASELLE_DELL_AUTO) aggiungi(voce);
  const refs = lexicalGlobal("CD_SLOT_REFS");
  if (refs && typeof refs.add === "function")
    for (const ref of [...RIFERIMENTI_TERMICI, ...RIFERIMENTI_DELL_AUTO]) refs.add(ref);
  return aggiunte > 0;
}

/* La linguetta della configurazione si chiama «Auto», non «EV» (#326).
 *
 * «Nel menu di configurazione l'etichetta dell'auto e' piu' corretto che sia
 * "Auto" e non "EV".» Ha ragione, e per due motivi: «EV» e' una sigla inglese
 * che meta' di chi apre la plancia non riconosce, e da quella scheda passano
 * anche le auto a benzina — chiamarla «EV» dice il falso da quando esiste
 * questo modulo. La pagina si chiama gia' «Auto» nella barra in basso e il
 * titolo della sezione pure: mancava solo qui.
 *
 * La linguetta la scrive il documento vendorizzato, e su schermo stretto
 * un'altra rifinitura le spezza disegno e parola in due caselle: si riscrive
 * la parola dove c'e' la casella, la linguetta intera dove non c'e', o si
 * porterebbe via il disegno. E' la stessa mano della sezione solare. */
export function rinominaLaLinguettaDellAuto() {
  const nome = t("Veicoli", "Vehicles");
  let fatto = false;
  const parola = doc?.querySelector?.('.ed-tab[data-tab="sez2"] .dm-beta4-tab-label');
  if (parola && clean(parola.textContent) !== nome) {
    parola.textContent = nome;
    fatto = true;
  }
  const nuda = doc?.querySelector?.('.ed-tab[data-tab="sez2"]:not(:has(.dm-beta4-tab-label))');
  if (nuda && !clean(nuda.textContent).includes(nome)) {
    nuda.textContent = `🚗 ${nome}`;
    fatto = true;
  }
  return fatto;
}

/* ── la tendina del motore, nella scheda dell'auto ────────────────────── */

function tendina() {
  return doc?.querySelector?.("#ed-body select[data-ev-tipo]") || null;
}

/* Di chi parla la scheda, adesso.
 *
 * Lo chiede anche la scelta Auto / Moto (#75), che e' l'altra domanda che si
 * fa sulla stessa riga: la risposta e' una sola e sta scritta dove e' stata
 * scritta la prima volta, invece di essere ricopiata.
 *
 * Tre casi, ed e' la stessa domanda che si fa il resto della scheda: la bozza
 * del «＋» non e' nessuna vettura; con dei profili e' quello aperto con la
 * matita (o quello in uso); senza nessun profilo e' la plancia, che il motore
 * lo dichiara per conto suo perche' non c'e' nessuna vettura a cui
 * appenderlo. */
export function diChiParlaLaScheda() {
  if (bozzaAperta()) return { chiave: "bozza", auto: null, casa: false };
  const auto = editedVehicle();
  if (auto) return { chiave: clean(auto[VEHICLE_KEY_FIELD]) || "senza-uid", auto, casa: false };
  return { chiave: "casa", auto: null, casa: true };
}

/* La tendina dice dell'auto aperta: alla matita si riallinea, al «＋» torna
 * elettrica. Una scelta fatta e non ancora salvata non si riscrive sotto le
 * dita: si riallinea solo quando cambia l'auto di cui si parla. */
function sincronizzaTendina() {
  const select = tendina();
  if (!select) return false;
  const { chiave, auto, casa } = diChiParlaLaScheda();
  if (select.dataset.dmPer === chiave) return true;
  select.dataset.dmPer = chiave;
  select.value = casa ? motoreDiCasa() : tipoMotore(auto?.tipo);
  return true;
}

/* Muovere la tendina SCRIVE (#326).
 *
 * «Rientrando nella configurazione il Motore risulta Elettrica.» Il tipo lo
 * leggeva soltanto «Salva auto», nel momento in cui salva un PROFILO: chi
 * preme il tasto verde «Salva sezione» in fondo — quello che si preme dopo
 * aver mappato le entita' — salvava le caselle e buttava via la scelta, e chi
 * un profilo non ce l'ha non aveva nemmeno dove metterla. Una tendina che
 * scrive appena la si muove non ha questo problema per nessuna delle due
 * strade, e non ne apre altre: la bozza resta l'unica che aspetta il tasto,
 * perche' l'auto di cui parla non esiste ancora. */
export function scriviIlMotore(valore) {
  const tipo = tipoMotore(valore);
  const { auto, casa } = diChiParlaLaScheda();
  if (casa) {
    writeJsonIfChanged(MOTORE_DI_CASA_KEY, tipo);
  } else if (auto) {
    const uid = clean(auto[VEHICLE_KEY_FIELD]);
    if (!uid) return false;
    if (tipoMotore(auto.tipo) !== tipo) salvaAuto(updateVehicle(profiles(), uid, { tipo }));
  } else {
    /* La bozza: nessuna vettura dietro, e la scelta se la prende «Salva la
     * nuova auto» leggendo la tendina, com'e' sempre stato. */
    return false;
  }
  renderAutoTermica();
  return true;
}

export function ensureTendinaMotore() {
  const nome = doc?.getElementById?.("ed-evcar-name");
  const riga = nome?.parentElement;
  if (!riga) return false;
  let casella = doc.querySelector("#ed-body [data-ev-tipo-riga]");
  if (!casella) {
    casella = doc.createElement("label");
    casella.className = "ed-slot dm-termica-tipo";
    casella.dataset.evTipoRiga = "true";
    casella.innerHTML = `<span class="ed-slot-lbl">${esc(t("Motore", "Engine"))}</span>
      <select class="ed-input" data-ev-tipo>${TIPI_MOTORE.map(
        (tipo) =>
          `<option value="${tipo === "elettrica" ? "" : esc(tipo)}">${esc(nomeDelMotore(tipo))}</option>`,
      ).join("")}</select>
      <small>${esc(
        t(
          "Termica: la pagina mostra il serbatoio, le portiere e il motore al posto della ricarica. Ibrida: tutti e due. Le caselle del carburante stanno qui sotto, fra le entità dell'auto.",
          "Combustion: the page shows the tank, the doors and the engine instead of charging. Hybrid: both. The fuel fields are below, among the car's entities.",
        ),
      )}</small>`;
    riga.after(casella);
  }
  sincronizzaTendina();
  ensureCasellaCapacita(casella);
  return true;
}

/* ── la capacita' della batteria ──────────────────────────────────────── */

/* «Sezione EV non calcola il tempo di fine.»
 *
 * Il conto del tempo che manca ha bisogno di due cose: quanta potenza passa
 * nel cavo — quella la dice la colonnina — e quanti kilowattora tiene la
 * batteria, che non la dice nessuno. Il guscio ne assumeva settanta per tutte
 * le auto del mondo: su una batteria da quaranta il tempo usciva quasi
 * doppio, su una da cento quasi meta'.
 *
 * La casella sta qui, accanto alla tendina del motore, e non e' un caso: sono
 * le due cose che si sanno della VETTURA e non delle sue entita', si scrivono
 * nello stesso posto e si salvano per la stessa strada. Si vede solo per le
 * auto che si ricaricano — a una a benzina la batteria di trazione non
 * interessa — e lasciarla vuota non rompe niente: restano i settanta di
 * prima, detti invece che nascosti. */
function ensureCasellaCapacita(dopo) {
  const { auto, casa } = diChiParlaLaScheda();
  const visibile = casa || !auto || siRicarica(auto);
  let casella = doc.querySelector("#ed-body [data-ev-kwh-riga]");
  if (!visibile) {
    casella?.remove();
    return false;
  }
  if (!casella) {
    casella = doc.createElement("label");
    casella.className = "ed-slot dm-termica-kwh";
    casella.dataset.evKwhRiga = "true";
    casella.innerHTML = `<span class="ed-slot-lbl">${esc(
      t("Capacità della batteria (kWh)", "Battery capacity (kWh)"),
    )}</span>
      <input class="ed-input" type="number" min="1" max="300" step="0.1" inputmode="decimal"
        data-ev-kwh placeholder="${esc(String(CAPACITA_DI_SERIE))}" autocomplete="off">
      <small>${esc(
        t(
          "Serve solo a dire quanto manca alla fine della carica: dalla percentuale che manca e dalla potenza della colonnina. Lasciandola vuota si contano 70 kWh, che è quello che la plancia ha sempre assunto — con una batteria diversa il tempo esce sbagliato in proporzione.",
          "It is only used to say how long is left to charge: from the missing percentage and the charger's power. Left empty it counts 70 kWh, which is what the dashboard has always assumed — with a different battery the time comes out wrong in proportion.",
        ),
      )}</small>`;
    dopo.after(casella);
  }
  sincronizzaCapacita(casella);
  return true;
}

/* Come la tendina: si riallinea solo quando cambia l'auto di cui si parla, o
 * un campo che si sta scrivendo si cancellerebbe sotto le dita. */
function sincronizzaCapacita(casella) {
  const campo = casella?.querySelector("[data-ev-kwh]");
  if (!campo) return false;
  const { chiave, auto, casa } = diChiParlaLaScheda();
  if (campo.dataset.dmPer === chiave) return true;
  campo.dataset.dmPer = chiave;
  /* Senza vettura la casella non e' muta: legge quella della plancia, che e'
   * il posto in cui la scrive chi non ha profili. */
  campo.value = auto
    ? clean(auto[VEHICLE_CAPACITY_FIELD])
    : clean(readJson(CAPACITA_DI_CASA_KEY, ""));
  return true;
}

/**
 * Scrive la capacita' dove appartiene. Vuoto vuol dire «non la so».
 *
 * Sulla vettura aperta, se c'e'. Senza vettura sulla plancia: la casella si
 * vede anche li' — chi ha una macchina sola e le sue mappature non ha nessun
 * profilo da aprire — e prima si rifiutava di salvare, quindi si ripuliva da
 * sola e il tempo di fine carica restava sui settanta assunti.
 */
export function scriviLaCapacita(valore) {
  const { auto, casa } = diChiParlaLaScheda();
  const scritto = clean(valore).replace(",", ".");
  const numero = Number(scritto);
  /* Un numero che non sta in piedi non si salva e non cancella quello che
   * c'era: chi sta ancora scrivendo «4» di «48» non deve perdere niente. */
  const nuovo = scritto === "" ? "" : Number.isFinite(numero) && numero > 0 ? scritto : null;
  if (nuovo === null) return false;
  if (!casa && !auto) {
    /* La bozza: una vettura che non esiste ancora.
     *
     * Qui si finiva nel ramo «di casa», perche' guardava solo `auto`: la
     * capacita' della macchina che stai creando veniva scritta nella casella
     * della PLANCIA — quella che vale per tutte — e la vettura nuova nasceva
     * senza. Con due auto in casa, il numero della seconda diventava il
     * ripiego della prima.
     *
     * Si tiene da parte, e si attacca al profilo appena quel profilo c'e':
     * `posaLaCapacitaDellaBozza` lo fa al primo disegno dopo il salvataggio.
     * E' la stessa strada del motore, che alla bozza non scrive e aspetta. */
    state.capacitaInBozza = nuovo;
    /* E con lui le vetture che c'erano in questo momento: servono a
     * riconoscere, dopo, se la bozza si e' davvero fatta profilo o se e' stata
     * abbandonata aprendo un'auto che c'era gia'. Senza, il numero finiva su
     * quella. */
    state.autoPrimaDellaBozza = new Set(
      profiles()
        .map((voce) => clean(voce?.[VEHICLE_KEY_FIELD]))
        .filter(Boolean),
    );
    return true;
  }
  if (!auto) {
    writeJsonIfChanged(CAPACITA_DI_CASA_KEY, nuovo);
    return true;
  }
  const uid = clean(auto[VEHICLE_KEY_FIELD]);
  if (!uid) return false;
  if (clean(auto[VEHICLE_CAPACITY_FIELD]) === nuovo) return true;
  salvaAuto(updateVehicle(profiles(), uid, { [VEHICLE_CAPACITY_FIELD]: nuovo }));
  return true;
}

/**
 * Quanti kilowattora tiene la batteria dell'auto in uso.
 *
 * La vettura se l'ha dichiarata, altrimenti quella della plancia, altrimenti i
 * settanta di serie — che restano l'assunzione di sempre, detta invece che
 * nascosta.
 *
 * Fra lo scritto e i settanta c'e' quella che l'auto dice di se': il sensore
 * della capacita' (`dm.ev_capacita_batteria`, che GdAAuto riempie). Lo
 * scritto vince — chi l'ha battuto sa qualcosa — ma una casella vuota non
 * vuol dire piu' «settanta» quando l'auto lo sa.
 */
export function capacitaDellAutoInUso() {
  const auto = activeVehicle();
  return (
    capacitaDellaBatteria(auto || {}) ??
    (auto ? null : capacitaDiCasa()) ??
    capacitaDalSensore() ??
    capacitaDiCasa() ??
    CAPACITA_DI_SERIE
  );
}

/* La capacita' che dice il sensore dell'auto in uso, dalla mappatura viva. */
function capacitaDalSensore() {
  let entita = "";
  try {
    entita = clean(root.resolveEntity?.(CASELLA_DELLA_CAPACITA));
  } catch (_error) {
    entita = "";
  }
  if (!entita || entita === CASELLA_DELLA_CAPACITA) return null;
  return kilowattoraDalloStato(allStates()?.[entita]);
}

/* ── il quadro nella pagina ───────────────────────────────────────────── */

/* «Nella sezione Auto riesci a fare qualcosa di piu' bello con tutti sti dati,
 * cosi' non si capisce niente.» Sotto la foto c'era una griglia di diciotto
 * tessere uguali, con etichette lunghe in maiuscolo: il consumo accanto alla
 * marcia, l'energia di oggi in tre caselle, «1045 min». Adesso la pagina e'
 * fatta di blocchi, e ogni blocco risponde a una domanda:
 *
 *  - com'e' l'auto adesso — accanto all'anello della batteria: l'autonomia in
 *    grande, le pillole di quello che sta facendo (parcheggiata, in marcia
 *    con la sua marcia, il freno, le portiere) e, in piccolo, quando ha
 *    mandato i dati;
 *  - la ricarica — le righe accanto all'anello, solo col cavo attaccato, con
 *    la potenza e il tempo che l'auto dichiara quando la colonnina tace;
 *  - quanto ha usato oggi — una barra sola divisa in guida, clima e resto;
 *  - la settimana — chilometri, energia e consumo, letti insieme;
 *  - le temperature — batteria, abitacolo, fuori, olio;
 *  - le gomme — l'auto vista dall'alto con le quattro pressioni dove stanno;
 *  - e «Altri dati», chiuso, con tutto quello che non sta in un blocco:
 *    niente di configurato si perde.
 *
 * Le etichette sono corte e in minuscolo, i numeri grandi e l'unita' piccola.
 * Un blocco senza dati non si disegna. */

function arco(percentuale) {
  const valore = Number.isFinite(percentuale) ? Math.max(0, Math.min(100, percentuale)) : 0;
  const pieno = (valore / 100) * ARC_LENGTH;
  return `${pieno.toFixed(1)} ${(ARC_LENGTH - pieno).toFixed(1)}`;
}

function pillola(glifo, testo, tono) {
  return `<span class="dm-termica-pillola" data-tono="${esc(tono)}"><i aria-hidden="true">${glifo}</i>${esc(testo)}</span>`;
}

/* Quante cifre dopo la virgola: nessuna per i numeri interi e per quelli
 * grandi, una per gli altri. */
const cifreDi = (valore) => (Number.isInteger(valore) || Math.abs(valore) >= 100 ? 0 : 1);

/* Il numero grande e la sua unita' piccola accanto. */
function numeroConUnita(valore, unita, cifre = cifreDi(valore)) {
  return `${esc(formatNumber(valore, cifre))}${unita ? `<small>${esc(unita)}</small>` : ""}`;
}

/* Gli attributi che aprono lo storico di una lettura, toccandola. */
const storico = (ref, nome) => `data-dm-storico="${esc(ref)}" data-dm-nome="${esc(nome)}"`;

function misura(glifo, etichetta, valore, unita, ref, cifre = 0) {
  if (valore === null || valore === undefined) return "";
  const nome = etichettaScelta(ref, etichetta);
  return `<button type="button" class="dm-termica-misura" data-dm-storico="${esc(ref)}" data-dm-nome="${esc(nome)}">
    <i aria-hidden="true">${glifo}</i>
    <span class="dm-termica-misura-testo"><small>${esc(nome)}</small><b>${esc(formatNumber(valore, cifre))}<em>${esc(unita)}</em></b></span>
  </button>`;
}

/* La testata di una carta: il disegno del catalogo di casa e il titolo. */
function testaDellaCarta(disegno, titolo, accanto = "") {
  return `<div class="dm-auto-carta-testa">
      <span class="dm-auto-carta-ico" aria-hidden="true">${disegnoDiCasa(disegno, { misura: 24 })}</span>
      <span class="dm-auto-carta-titolo">${esc(titolo)}</span>${accanto}
    </div>`;
}

/* ── le gomme ─────────────────────────────────────────────────────────── */

/* Le quattro ruote come stanno sull'auto: due davanti, due dietro.
 *
 * «E' possibile inserire un solo pneumatico, spero al prossimo rilascio sia
 * possibile inserirne 4» (#319). Chi ne ha mappata una sola vede la casella di
 * sempre, identica; chi ne ha mappate due o piu' vede l'auto dall'alto con le
 * pressioni accanto alle ruote, e quelle che non ha mappato restano vuote
 * invece di sparire — una gomma che manca si vede meglio di una che non c'e'.
 *
 * L'auto dall'alto e' quella della finestra dell'auto in Home e di gdanav:
 * un'immagine sola per tutta la casa. Ogni pressione ha il colore di come sta
 * (`comeStannoLeGomme`): verde a posto, ambra bassa, alta o in avviso. */
/* Sulla carta le ruote si chiamano corte — «Ant. sx» — perche' stanno
 * accanto al disegno e il disegno dice gia' quale sono. Un nome dato a mano
 * vince anche qui. */
export function parolaCortaDellaRuota(ruota) {
  if (ruota === "antSx") return t("Ant. sx", "Front L");
  if (ruota === "antDx") return t("Ant. dx", "Front R");
  if (ruota === "postSx") return t("Post. sx", "Rear L");
  return t("Post. dx", "Rear R");
}

function gomma(voce) {
  const nome = etichettaScelta(voce?.ref, parolaCortaDellaRuota(voce?.ruota));
  if (!voce) return "";
  const tono = esc(voce.tono || "");
  if (voce.pressione !== null)
    return `<button type="button" class="dm-termica-gomma" data-dm-storico="${esc(voce.ref)}" data-dm-nome="${esc(nome)}" data-ruota="${esc(voce.ruota)}" data-tono="${tono}" title="${esc(nome)}">
      <small>${esc(nome)}</small><b>${esc(formatNumber(voce.pressione, 1))}<em>${esc(voce.unita ? ` ${voce.unita}` : "")}</em></b>
    </button>`;
  return `<span class="dm-termica-gomma" data-ruota="${esc(voce.ruota)}" data-tono="${voce.avviso ? "attento" : "bene"}" title="${esc(nome)}">
    <small>${esc(nome)}</small><b>${esc(voce.avviso ? t("Da controllare", "Check it") : "OK")}</b>
  </span>`;
}

function gommeMarkup(lettura, mezzo = "auto") {
  const { ruote, verdetto } = comeStannoLeGomme(lettura);
  const riepilogo = lettura.pneumatici;
  /* Il verdetto e' una didascalia, non una tessera: «Pneumatici a posto» sotto
   * le ruote. Un riepilogo con un numero — un sensore solo, la pressione di
   * tutte — resta una misura da toccare. */
  const didascalia = verdetto
    ? pillola(
        "🛞",
        verdetto === "attento"
          ? t("Pneumatici da controllare", "Check the tyres")
          : t("Pneumatici a posto", "Tyres fine"),
        verdetto === "attento" ? "attento" : "bene",
      )
    : "";
  const riassunto =
    riepilogo && riepilogo.pressione !== null
      ? misura("🛞", t("Pneumatici", "Tyres"), riepilogo.pressione, ` ${riepilogo.unita}`, "dm.ev_pneumatici", 1)
      : "";
  if (!ruote.length) return { riassunto, didascalia, quadretto: "" };
  const perRuota = new Map(ruote.map((voce) => [voce.ruota, voce]));
  const cella = (ruota) => {
    const voce = perRuota.get(ruota);
    /* Anche la ruota non mappata porta il nome che le e' stato dato: il posto
     * vuoto e' quello di QUELLA gomma, e chiamarla in due modi a seconda che
     * il sensore ci sia o no la farebbe sembrare un'altra. */
    const posto = RUOTE.find((riga) => riga.ruota === ruota);
    return voce
      ? gomma(voce)
      : `<span class="dm-termica-gomma" data-vuota="true" data-ruota="${esc(ruota)}"><small>${esc(etichettaScelta(posto?.ref, parolaCortaDellaRuota(ruota)))}</small><b>—</b></span>`;
  };
  /* Una moto non ha quattro ruote ne' un tetto da guardare dall'alto: le sue
   * gomme stanno in fila, senza disegno. */
  const disegno =
    mezzo === "moto"
      ? ""
      : `<img class="dm-termica-gomme-auto" src="${AUTO_DALL_ALTO}" alt="" aria-hidden="true">`;
  const quadretto = `<div class="dm-termica-gomme-quadro" data-mezzo="${esc(mezzo)}">
        ${cella("antSx")}${cella("antDx")}${cella("postSx")}${cella("postDx")}
        ${disegno}
      </div>`;
  return { riassunto, didascalia, quadretto };
}

/* La carta delle gomme: il quadretto, il riassunto e la didascalia. */
function cartaDelleGomme(gomme) {
  if (!gomme.quadretto && !gomme.riassunto && !gomme.didascalia) return "";
  return `<section class="dm-auto-carta dm-termica-gomme" data-carta="gomme">
      ${testaDellaCarta("manometro", t("Pneumatici", "Tyres"))}
      ${gomme.quadretto}
      ${gomme.riassunto ? `<div class="dm-termica-righe">${gomme.riassunto}</div>` : ""}
      ${gomme.didascalia ? `<div class="dm-auto-didascalia">${gomme.didascalia}</div>` : ""}
    </section>`;
}

/* ── le pillole: com'e' l'auto adesso ─────────────────────────────────── */

/* Quello che fa l'auto, con la lettera della marcia in un tondino: «P
 * Parcheggiata», «D In marcia». Il freno di stazionamento e' una pillola a
 * parte, piccola. */
function pillolaDellaMarcia(lettura) {
  const fa = cosaFaLAuto(lettura);
  if (!fa) return "";
  const marcia = lettura.marcia || "";
  const lettera = marcia ? `<b class="dm-auto-marcia">${esc(marcia)}</b>` : "";
  const testo =
    fa === "ferma"
      ? t("Parcheggiata", "Parked")
      : marcia === "R"
        ? t("In retromarcia", "Reversing")
        : marcia === "N"
          ? t("In folle", "In neutral")
          : t("In marcia", "Moving");
  return `<span class="dm-termica-pillola" data-tono="${fa === "marcia" ? "acceso" : "spento"}" data-dm-marcia="${esc(marcia)}">${lettera || `<i aria-hidden="true">🚗</i>`}${esc(testo)}</span>`;
}

/* Le pillole dell'auto ferma in garage: motore, portiere, finestrini,
 * bagagliaio, cofano, allarme, dove sta. Sono le stesse per ogni motore; il
 * motore spento si dice solo su un'auto a carburante, perche' su un'elettrica
 * spenta e' la normalita'. */
function pilloleDellAuto(lettura, tipo) {
  const pillole = [];
  if (lettura.motore === true || (tipo === "termica" && lettura.motore === false))
    pillole.push(
      pillola("🔑", lettura.motore ? t("Motore acceso", "Engine running") : t("Motore spento", "Engine off"), lettura.motore ? "acceso" : "spento"),
    );
  if (lettura.portiere)
    pillole.push(
      pillola("🚪", parolaDellePortiere(lettura.portiere), lettura.portiere === "bloccate" || lettura.portiere === "chiuse" ? "bene" : "attento"),
    );
  if (lettura.finestrini)
    pillole.push(
      pillola("🪟", lettura.finestrini === "aperti" ? t("Finestrini aperti", "Windows open") : t("Finestrini chiusi", "Windows closed"), lettura.finestrini === "aperti" ? "attento" : "bene"),
    );
  /* Bagagliaio e cofano (#326): due aperture come i finestrini, e come loro
   * si leggono a colpo d'occhio — aperto e' la cosa che si vuole sapere. */
  if (lettura.bagagliaio)
    pillole.push(
      pillola(
        "🧳",
        lettura.bagagliaio === "aperti"
          ? t("Bagagliaio aperto", "Boot open")
          : t("Bagagliaio chiuso", "Boot closed"),
        lettura.bagagliaio === "aperti" ? "attento" : "bene",
      ),
    );
  if (lettura.cofano)
    pillole.push(
      pillola(
        "🔧",
        lettura.cofano === "aperti"
          ? t("Cofano aperto", "Bonnet open")
          : t("Cofano chiuso", "Bonnet closed"),
        lettura.cofano === "aperti" ? "attento" : "bene",
      ),
    );
  if (lettura.allarme)
    pillole.push(
      pillola("🚨", parolaDellAllarme(lettura.allarme), lettura.allarme === "scattato" ? "male" : lettura.allarme === "inserito" ? "bene" : "spento"),
    );
  /* Dove sta (#326): una parola, quella che dice il device_tracker. Il tono
   * e' neutro — un'auto fuori casa non e' un problema, e' un fatto. */
  if (lettura.posizione)
    pillole.push(
      pillola(
        "📍",
        lettura.posizione === "casa"
          ? t("A casa", "At home")
          : lettura.posizione === "fuori"
            ? t("Fuori casa", "Away")
            : lettura.posizione,
        lettura.posizione === "casa" ? "bene" : "spento",
      ),
    );
  return pillole;
}

/* Le misure che a zero non dicono niente: un'auto ferma ha velocita' zero,
 * zero kilowatt e zero minuti alla fine di una carica che non c'e'. */
const MOMENTANEE = new Set([
  "dm.ev_velocita",
  "dm.ev_potenza_istantanea",
  "dm.ev_potenza_riscaldatore",
  "dm.ev_potenza_ricarica",
  "dm.ev_tempo_ricarica",
]);

/* Quelli che si comandano: lo stato lo dice gia' un'altra casella. Il clima
 * comandabile vale come «clima acceso» solo quando quella casella manca —
 * GdAAuto non la crea, se il clima si puo' accendere. */
const COMANDI = new Set(["dm.ev_comando_clima", "dm.ev_comando_ricarica"]);

/* Le parole corte delle pillole: la scheda dice «Freno di stazionamento
 * (tirato/rilasciato)» per spiegare che entita' scegliere, la pillola dice
 * quello che si vede. */
function parolaDellaPillola(ref, nomeDi) {
  if (ref === "dm.ev_freno_stazionamento") return etichettaScelta(ref, t("Freno tirato", "Brake on"));
  return nomeDi(ref);
}

/* Quando l'auto ha mandato i dati, in piccolo: conta soprattutto se dorme,
 * perche' i numeri sono di quando si e' addormentata. */
function aggiornataMarkup(lettura, adesso = Date.now()) {
  const quando = lettura?.caselle?.ultimoAggiornamento?.valore;
  if (quando === null || quando === undefined) return "";
  const detto = istanteDetto(quando, { lingua: locale(), adesso });
  if (!detto) return "";
  const oggi = new Date(adesso).toDateString() === new Date(quando).toDateString();
  const testo = oggi ? t(`Aggiornata alle ${detto}`, `Updated at ${detto}`) : t(`Aggiornata il ${detto}`, `Updated on ${detto}`);
  return `<p class="dm-auto-aggiornata"><i aria-hidden="true">🕒</i>${esc(testo)}</p>`;
}

/**
 * I dati dell'auto connessa, per la pagina: le pillole di quello che e'
 * acceso, le carte dei blocchi e le righe degli altri dati.
 *
 * Valgono per qualunque motore: l'energia che resta, il consumo medio, il
 * clima, la ricarica programmata, l'auto che dorme. Le etichette sono quelle
 * della scheda senza la parentesi dell'unita' — l'unita' la scrive il
 * sensore — e un nome dato a mano vince anche qui.
 */
export function datiMarkup(lettura, { tipo = "", aperti = false } = {}) {
  const caselle = lettura?.caselle || {};
  const valore = (campo) => {
    const v = caselle[campo]?.valore;
    return v === undefined ? null : v;
  };
  /* Le tessere il nome scelto lo cercano da se'; le pillole no. */
  const diSerie = (ref) => senzaParentesi(etichettaDellaCasella(ref));
  const nomeDi = (ref) => etichettaScelta(ref, diSerie(ref));
  const pillole = [];
  const altri = [];
  const riga = (glifo, ref, nome, v, unita, cifre = cifreDi(v), segno = "") =>
    altri.push(`<button type="button" class="dm-auto-riga" ${storico(ref, nome)}>
        <i aria-hidden="true">${glifo}</i><span>${esc(nome)}</span><b>${numeroConUnita(v, unita, cifre)}${esc(segno)}</b>
      </button>`);
  for (const voce of CASELLE_DELL_AUTO) {
    const casella = caselle[voce.campo];
    const v = casella ? casella.valore : null;
    if (v === null || v === undefined) continue;
    switch (voce.tipo) {
      case "misura":
      case "gradi": {
        /* Quello che ha un blocco suo si legge li', non due volte. */
        if (RIFERIMENTI_IN_BLOCCO.has(voce.ref)) break;
        if (MOMENTANEE.has(voce.ref) && v === 0) break;
        riga(voce.glifo, voce.ref, nomeDi(voce.ref), v, voce.tipo === "gradi" ? "" : casella.unita || "", cifreDi(v), voce.tipo === "gradi" ? "°" : "");
        break;
      }
      case "acceso": {
        if (COMANDI.has(voce.ref)) break;
        if (v !== true) break;
        if (voce.ref === "dm.ev_ricarica_programmata") {
          const dalle = clean(valore("ricaricaInizio"));
          const alle = clean(valore("ricaricaFine"));
          const orari = dalle && alle ? ` · ${dalle}–${alle}` : dalle ? ` · ${dalle}` : "";
          pillole.push(pillola(voce.glifo, `${nomeDi(voce.ref)}${orari}`, "acceso"));
          break;
        }
        /* L'auto che dorme non e' una cosa accesa: e' una cosa da sapere. Il
         * freno tirato nemmeno: e' come sta un'auto parcheggiata. */
        const tono = ["dm.ev_in_sonno", "dm.ev_freno_stazionamento"].includes(voce.ref) ? "spento" : "acceso";
        pillole.push(pillola(voce.glifo, parolaDellaPillola(voce.ref, nomeDi), tono));
        break;
      }
      default:
        break;
    }
  }
  if (valore("clima") === null && valore("comandoClima") === true)
    pillole.unshift(pillola("❄️", nomeDi("dm.ev_clima"), "acceso"));
  /* Su un'auto che non e' a carburante le letture del quadro termico non
   * hanno un quadro dove stare: la batteria da 12 V, il contachilometri,
   * l'ultimo viaggio. Vanno fra gli altri dati, con la loro unita'. */
  if (tipo !== "termica" && tipo !== "ibrida") {
    if (lettura.batteriaServizio !== null && lettura.batteriaServizio !== undefined)
      riga(
        "🔋",
        "dm.ev_batteria_servizio",
        etichettaScelta("dm.ev_batteria_servizio", t("Batteria 12 V", "12 V battery")),
        lettura.batteriaServizio,
        lettura.batteriaServizioUnita,
        lettura.batteriaServizioUnita === "%" ? 0 : 1,
      );
    if (lettura.odometro !== null && lettura.odometro !== undefined)
      riga("🧭", "dm.ev_odometro", etichettaScelta("dm.ev_odometro", t("Odometro", "Odometer")), lettura.odometro, lettura.odometroUnita, 0);
    if (lettura.ultimoViaggio !== null && lettura.ultimoViaggio !== undefined)
      riga("🧭", "dm.ev_ultimo_viaggio", etichettaScelta("dm.ev_ultimo_viaggio", t("Ultimo viaggio", "Last trip")), lettura.ultimoViaggio, "km", 1);
  }
  const carte = [
    cartaDellEnergia(lettura),
    cartaDellaSettimana(lettura),
    cartaDelleTemperature(lettura),
    cartaDellUltimaRicarica(lettura),
  ].filter(Boolean);
  const altriMarkup = altri.length
    ? `<details class="dm-auto-carta dm-auto-altri" data-carta="altri"${aperti ? " open" : ""}>
        <summary><span class="dm-auto-carta-titolo">${esc(t("Altri dati", "More data"))}</span><small>${esc(String(altri.length))}</small></summary>
        <div class="dm-auto-elenco">${altri.join("")}</div>
      </details>`
    : "";
  return { pillole, carte, altri: altriMarkup };
}

/* ── le carte ─────────────────────────────────────────────────────────── */

/* Un dato grande con la sua parola sotto, che si tocca per lo storico. */
function dato(ref, nome, v, unita, cifre = cifreDi(v), segno = "") {
  const corpo = `<b class="dm-auto-num">${numeroConUnita(v, unita, cifre)}${esc(segno)}</b><span>${esc(nome)}</span>`;
  return ref
    ? `<button type="button" class="dm-auto-dato" ${storico(ref, nome)}>${corpo}</button>`
    : `<div class="dm-auto-dato">${corpo}</div>`;
}

/* I kilowattora con le cifre giuste: «0,1», «4,2», «12,4», «57». */
const cifreKwh = (kwh) => (kwh === 0 ? 0 : kwh >= 100 ? 0 : 1);

/* L'energia di oggi: una barra sola, divisa in guida, clima e resto. */
function cartaDellEnergia(lettura) {
  const energia = energiaDiOggi(lettura);
  if (!energia) return "";
  const nomi = {
    guida: t("Guida", "On the road"),
    clima: t("Clima", "Climate"),
    altro: t("Resto", "The rest"),
  };
  const barra = energia.parti
    .filter((parte) => parte.kwh > 0)
    .map((parte) => `<span data-parte="${esc(parte.parte)}" style="flex-grow:${parte.quota.toFixed(4)}"></span>`)
    .join("");
  const legenda = energia.parti
    .map((parte) => {
      const nome = etichettaScelta(parte.ref, nomi[parte.parte]);
      return `<button type="button" class="dm-auto-voce" data-parte="${esc(parte.parte)}" ${storico(parte.ref, nome)}>
          <i aria-hidden="true"></i><span>${esc(nome)}</span><b>${numeroConUnita(parte.kwh, "kWh", cifreKwh(parte.kwh))}</b>
        </button>`;
    })
    .join("");
  return `<section class="dm-auto-carta" data-carta="energia">
      ${testaDellaCarta("strike", t("Energia di oggi", "Energy today"), `<b class="dm-auto-num dm-auto-totale">${numeroConUnita(energia.totale, "kWh", cifreKwh(energia.totale))}</b>`)}
      <div class="dm-auto-barra" data-vuota="${energia.totale > 0 ? "false" : "true"}" role="img" aria-label="${esc(
        energia.parti.map((parte) => `${nomi[parte.parte]} ${formatNumber(parte.kwh, cifreKwh(parte.kwh))} kWh`).join(", "),
      )}">${barra}</div>
      <div class="dm-auto-legenda">${legenda}</div>
    </section>`;
}

/* Gli ultimi sette giorni: chilometri, energia e consumo, uno accanto
 * all'altro. Il consumo calcolato si dice calcolato. */
function cartaDellaSettimana(lettura) {
  const settimana = laSettimana(lettura);
  if (!settimana) return "";
  const unitaKm = clean(lettura?.caselle?.km7Giorni?.unita) || "km";
  const dati = [
    settimana.km !== null ? dato("dm.ev_km_7_giorni", t("Percorsi", "Driven"), settimana.km, unitaKm, 0) : "",
    settimana.kwh !== null ? dato("dm.ev_energia_7_giorni", t("Energia", "Energy"), settimana.kwh, "kWh", cifreKwh(settimana.kwh)) : "",
    settimana.consumo !== null
      ? dato(
          settimana.calcolato ? "" : "dm.ev_consumo_medio",
          settimana.calcolato
            ? t("Consumo, calcolato", "Consumption, worked out")
            : etichettaScelta("dm.ev_consumo_medio", t("Consumo", "Consumption")),
          settimana.consumo,
          "kWh/100 km",
          1,
        )
      : "",
  ].join("");
  return `<section class="dm-auto-carta" data-carta="settimana">
      ${testaDellaCarta("calendar", t("Ultimi 7 giorni", "Last 7 days"))}
      <div class="dm-auto-dati">${dati}</div>
    </section>`;
}

/* Le temperature dell'auto, insieme. */
function cartaDelleTemperature(lettura) {
  const temperature = temperatureDellAuto(lettura);
  if (!temperature.length) return "";
  const nomi = {
    batteria: t("Batteria", "Battery"),
    abitacolo: t("Abitacolo", "Cabin"),
    esterna: t("Fuori", "Outside"),
    olio: t("Olio", "Oil"),
  };
  const dati = temperature
    .map((voce) => dato(voce.ref, etichettaScelta(voce.ref, nomi[voce.chi]), voce.gradi, "", Number.isInteger(voce.gradi) ? 0 : 1, "°"))
    .join("");
  return `<section class="dm-auto-carta" data-carta="temperature">
      ${testaDellaCarta("thermometer", t("Temperature", "Temperatures"))}
      <div class="dm-auto-dati">${dati}</div>
    </section>`;
}

/* L'ultima ricarica: quanta energia, AC o DC, da quando a quando. */
function cartaDellUltimaRicarica(lettura) {
  const caselle = lettura?.caselle || {};
  const energia = caselle.ultimaRicaricaEnergia?.valore;
  if (energia === null || energia === undefined) return "";
  const tipo = clean(caselle.ultimaRicaricaTipo?.valore).toUpperCase();
  const inizio = caselle.ultimaRicaricaInizio?.valore;
  const fine = caselle.ultimaRicaricaFine?.valore;
  const lingua = locale();
  const dalle = Number.isFinite(inizio) ? istanteDetto(inizio, { lingua }) : "";
  const alle = Number.isFinite(fine) ? istanteDetto(fine, { lingua }) : "";
  const quando = dalle && alle ? `${dalle} – ${alle}` : dalle || alle;
  const nome = etichettaScelta("dm.ev_ultima_ricarica_energia", t("Energia", "Energy"));
  const unita = clean(caselle.ultimaRicaricaEnergia?.unita) || "kWh";
  return `<section class="dm-auto-carta" data-carta="ultima-ricarica">
      ${testaDellaCarta("plug", t("Ultima ricarica", "Last charge"), tipo ? `<span class="dm-auto-sigla">${esc(tipo)}</span>` : "")}
      <div class="dm-auto-dati">${dato("dm.ev_ultima_ricarica_energia", nome, energia, unita, cifreKwh(energia))}</div>
      ${quando ? `<p class="dm-auto-aggiornata">${esc(quando)}</p>` : ""}
    </section>`;
}

/* ── accanto all'anello ───────────────────────────────────────────────── */

/* L'autonomia in grande, con le altre autonomie dell'auto in piccolo sotto:
 * quella di omologazione, quella totale di un'ibrida, quella a carburante. */
function autonomiaMarkup(lettura) {
  if (lettura.autonomia === null || lettura.autonomia === undefined) return "";
  const nome = etichettaScelta("dm.ev_autonomia", t("Autonomia", "Range"));
  const unita = lettura.autonomiaUnita || "km";
  const altre = [
    ["autonomiaNominale", t("omologazione", "rated")],
    ["autonomiaTotale", t("totale", "total")],
    ["autonomiaCarburante", t("a carburante", "on fuel")],
  ]
    .map(([campo, parola]) => {
      const v = lettura?.caselle?.[campo]?.valore;
      return v === null || v === undefined ? "" : `${parola} ${formatNumber(v, 0)} ${clean(lettura.caselle[campo].unita) || unita}`;
    })
    .filter(Boolean)
    .join(" · ");
  return `<button type="button" class="dm-auto-autonomia" ${storico("dm.ev_autonomia", nome)}>
      <small>${esc(nome)}</small>
      <b class="dm-auto-num">${numeroConUnita(lettura.autonomia, unita, 0)}</b>
      ${altre ? `<span>${esc(altre)}</span>` : ""}
    </button>`;
}

/* La testa accanto all'anello: autonomia, pillole, quando ha parlato. */
function testaMarkup(lettura, tipo, pilloleDeiDati) {
  const pillole = [pillolaDellaMarcia(lettura), ...pilloleDellAuto(lettura, tipo), ...pilloleDeiDati].filter(Boolean);
  const autonomia = autonomiaMarkup(lettura);
  const aggiornata = aggiornataMarkup(lettura);
  if (!autonomia && !pillole.length && !aggiornata) return "";
  return `${autonomia}
    ${pillole.length ? `<div class="dm-termica-pillole">${pillole.join("")}</div>` : ""}
    ${aggiornata}`;
}

/* Le righe accanto all'anello parlano di ricarica: si riconoscono dalla
 * classe del valore che il guscio ci scrive, e si segnano una volta. */
function segnaLeRighe(potenza) {
  for (const riga of potenza.querySelectorAll(".dm-evv-row")) {
    if (riga.dataset.dmRiga) continue;
    if (riga.querySelector(".v-ev-pow")) riga.dataset.dmRiga = "potenza";
    else if (riga.querySelector(".v-ev-remain")) riga.dataset.dmRiga = "tempo";
    else if (riga.querySelector(".v-auto-limite")) riga.dataset.dmRiga = "target";
  }
}

/* Il target detto col suo numero: «Autonomia al 100%» invece di «al target»,
 * che e' una parola della configurazione. Senza un numero resta com'era. */
function parolaDelTarget(potenza) {
  const etichetta = potenza.querySelector('.dm-evv-row[data-dm-riga="target"] .dm-evv-row-lbl');
  if (!etichetta) return;
  const n = Number.parseFloat(clean(liveState("dm.ev_target_soc")?.state));
  const pct = Math.round(n);
  const testo = Number.isFinite(n)
    ? t(`Autonomia al ${pct}%`, `Range at ${pct}%`)
    : t("Autonomia al target", "Range at target");
  if (etichetta.textContent !== testo) etichetta.textContent = testo;
}

/* L'anello della batteria e' il primo blocco sotto la foto: ci si mette
 * accanto la testa dell'auto, e le righe della ricarica si spengono quando il
 * cavo e' staccato — «Potenza —» e «Tempo stimato —» sotto un'auto in garage
 * non dicono niente. Solo quando il cavo si sa staccato: con nessuna fonte che
 * lo dica, le righe restano come sono sempre state. */
function accantoAllAnello(page, testa) {
  const potenza = page.querySelector(".dm-evv-power");
  if (!potenza) return;
  segnaLeRighe(potenza);
  parolaDelTarget(potenza);
  /* «Autonomia al target» stava tre volte nella pagina: accanto all'anello,
   * in una tessera sotto la sessione e nella carta del target. La tessera e'
   * il doppione: si spegne finche' la riga accanto all'anello c'e'. */
  const riga = potenza.querySelector('.dm-evv-row[data-dm-riga="target"]');
  const doppia = Boolean(riga && !riga.hidden);
  for (const valore of page.querySelectorAll(".lm-stat-card .v-auto-limite")) {
    const tessera = valore.closest(".lm-stat-card");
    if (tessera && tessera.dataset.dmDoppia !== String(doppia)) tessera.dataset.dmDoppia = String(doppia);
  }
  let ricarica = "";
  try {
    ricarica = vehiclePlugged() === false ? "ferma" : "";
  } catch (_error) {
    ricarica = "";
  }
  if ((potenza.dataset.dmRicarica || "") !== ricarica) {
    if (ricarica) potenza.dataset.dmRicarica = ricarica;
    else delete potenza.dataset.dmRicarica;
  }
  let nodo = potenza.querySelector(".dm-auto-testa");
  const righe = potenza.querySelector(".dm-evv-rows");
  righe?.classList.toggle("dm-auto-con-testa", Boolean(testa));
  if (!testa) {
    nodo?.remove();
    state.testa = "";
    return;
  }
  if (!righe) return;
  if (!nodo) {
    nodo = doc.createElement("div");
    nodo.className = "dm-auto-testa";
    righe.prepend(nodo);
    state.testa = "";
  }
  if (state.testa !== testa) {
    nodo.innerHTML = testa;
    state.testa = testa;
  }
}

/* ── il quadro dell'auto a carburante ─────────────────────────────────── */

function quadroMarkup(lettura, tipo, pillole = [], { conAltro = false } = {}) {
  const carburante = lettura.carburante;
  const serbatoio =
    carburante === null || carburante === undefined
      ? ""
      : `<div class="dm-termica-serbatoio" data-riserva="${carburante <= 10}">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle class="dm-termica-arc-track" cx="60" cy="60" r="${ARC_RADIUS}" fill="none" stroke-width="9"/>
        <circle class="dm-termica-arc" cx="60" cy="60" r="${ARC_RADIUS}" fill="none" stroke-width="9" stroke-linecap="round" stroke-dasharray="${arco(carburante)}"/>
      </svg>
      <b>${esc(formatNumber(carburante, 0))}<i>%</i></b>
      <span>${esc(carburante <= 10 ? t("In riserva", "Reserve") : etichettaScelta("dm.ev_carburante", t("Carburante", "Fuel")))}</span>
    </div>`;
  const righe = [
    misura("🛣️", t("Autonomia", "Range"), lettura.autonomia, ` ${lettura.autonomiaUnita}`, "dm.ev_autonomia"),
    misura("🧭", t("Odometro", "Odometer"), lettura.odometro, ` ${lettura.odometroUnita}`, "dm.ev_odometro"),
    misura("🧭", t("Ultimo viaggio", "Last trip"), lettura.ultimoViaggio, " km", "dm.ev_ultimo_viaggio", 1),
    /* L'unita' e' quella letta dal sensore — percento o volt — e non un «%»
     * scritto qui: «e' a 14 V, mi da' 14%» (#348). I volt vogliono un decimale,
     * perche' fra 12,4 e 12,8 c'e' la differenza fra carica e scarica. */
    misura(
      "🔋",
      t("Batteria 12 V", "12 V battery"),
      lettura.batteriaServizio,
      lettura.batteriaServizioUnita === "%" ? "%" : ` ${lettura.batteriaServizioUnita}`,
      "dm.ev_batteria_servizio",
      lettura.batteriaServizioUnita === "%" ? 0 : 1,
    ),
    misura("⛽", t("Consumato in totale", "Total fuel used"), lettura.carburanteTotale, " L", "dm.ev_carburante_totale"),
  ].join("");
  const aggiornata = tipo === "termica" ? aggiornataMarkup(lettura) : "";
  const vuoto =
    !serbatoio && !righe && !pillole.length && !conAltro
      ? `<div class="dm-termica-vuoto">${esc(t("Nessuna lettura", "No reading"))}</div>`
      : "";
  return `<section class="dm-auto-carta dm-termica-blocco" data-carta="quadro">
      <div class="dm-termica-testa">
        <span class="dm-termica-titolo">${esc(tipo === "ibrida" ? t("Motore termico", "Combustion engine") : t("L'auto", "The car"))}</span>
        <div class="dm-termica-pillole">${pillole.join("")}</div>
      </div>
      <div class="dm-termica-quadro" data-vuoto="${!serbatoio && !righe}">${serbatoio}<div class="dm-termica-righe">${righe}</div></div>
      ${aggiornata}
      ${vuoto}
    </section>`;
}

function dipingi() {
  /* Prima di disegnare: se una capacita' aspettava la sua vettura, adesso
   * potrebbe esserci. */
  posaLaCapacitaDellaBozza();
  const page = doc?.getElementById?.("page-ev");
  const hero = doc?.getElementById?.("lm-hero-card");
  if (!page || !hero) return;
  const auto = activeVehicle();
  const tipo = motoreDellaVettura(auto, motoreDiCasa());
  const motore = tipo || "elettrica";
  if (page.dataset.dmMotore !== motore) {
    page.dataset.dmMotore = motore;
    try {
      renderPageMastheads();
    } catch (_error) {}
  }
  /* La batteria di un'auto a benzina (#326).
   *
   * «Con motore termico la scheda batteria dovrebbe mostrare solo la
   * percentuale di carica — nel mio caso e' la batteria del mild-hybrid — e
   * nulla riguardo la ricarica.» La barra dell'eroe e' esattamente quello:
   * una scritta e una percentuale, senza una parola sul cavo. Spariva perche'
   * stava nello stesso mucchio della sessione e del target, che invece
   * parlano di una spina che quest'auto non ha. Adesso resta, ma solo se una
   * batteria e' davvero mappata: un serbatoio con scritto «Batteria —%»
   * sarebbe peggio del niente di prima. */
  const carica = Number(allStates()?.[clean(vehicleBatteryEntity(auto || {}))]?.state);
  page.dataset.dmBatteria = String(Number.isFinite(carica));
  let blocco = page.querySelector(":scope .dm-termica");
  const lettura = letturaTermica(auto?.ov || auto?.overrides || {}, allStates(), root.resolveEntity);
  const mezzo = mezzoInPagina();
  /* Le gomme non sono del motore.
   *
   * Il quadro termico parla di carburante, olio e scarico, e su un'auto
   * elettrica non si disegna: giusto. Le gomme pero' stavano dentro quel
   * quadro, e sparivano con lui — chi ha un'elettrica compilava le caselle in
   * configurazione e non le vedeva da nessuna parte, e il TPMS ce l'hanno
   * anche loro. Quando il motore non e' termico resta solo la carta delle
   * ruote, che vale per qualunque auto. */
  const gomme = gommeMarkup(lettura, mezzo);
  const elettrica = !tipo;
  /* E i dati dell'auto connessa, che valgono per ogni motore: l'energia che
   * resta, il consumo, il clima, la ricarica programmata. */
  const dati = datiMarkup(lettura, { tipo, aperti: state.altriAperti });
  const conDati = Boolean(dati.carte.length || dati.altri || dati.pillole.length);
  const soloGomme = elettrica && !conDati;
  /* Accanto all'anello: la testa dell'auto, se non e' a carburante — su
   * quella le pillole stanno nel suo quadro, perche' l'anello della
   * ricarica non c'e'. */
  accantoAllAnello(page, tipo === "termica" ? "" : testaMarkup(lettura, tipo, dati.pillole));
  if (elettrica && !conDati && !gomme.quadretto && !gomme.riassunto) {
    if (blocco) blocco.remove();
    state.firma = "";
    return;
  }
  /* Il blocco va DOPO l'anello: prima com'e' l'auto adesso, poi il resto. */
  const potenza = page.querySelector(".dm-evv-power");
  const dopo = potenza && potenza.parentElement === hero.parentElement ? potenza : hero;
  if (blocco && blocco.previousElementSibling !== dopo) dopo.insertAdjacentElement("afterend", blocco);
  /* I nomi scelti stanno nella firma: rinominare una lettura in
   * configurazione e tornare qui deve cambiare quello che si legge, e la
   * lettura in se' non e' cambiata di una virgola. */
  const firma = JSON.stringify([tipo, mezzo, lettura, readJson("cd_slot_labels", {})]);
  if (state.firma === firma && blocco) return;
  state.firma = firma;
  if (!blocco) {
    blocco = doc.createElement("section");
    blocco.className = "dm-termica";
    dopo.insertAdjacentElement("afterend", blocco);
  }
  blocco.dataset.soloGomme = String(soloGomme);
  blocco.dataset.attenzione = String(Boolean(lettura.attenzione));
  const pilloleDelQuadro =
    tipo === "termica"
      ? [pillolaDellaMarcia(lettura), ...pilloleDellAuto(lettura, tipo), ...dati.pillole].filter(Boolean)
      : [];
  /* Le gomme a parte, le altre carte in una colonna loro: da schermo largo
   * l'auto vista dall'alto sta a sinistra e le carte le stanno accanto, su
   * un telefono vengono prima le carte e in fondo le gomme. */
  const cartaGomme = cartaDelleGomme(gomme);
  const altre = dati.carte.join("");
  const carte =
    cartaGomme || altre
      ? `<div class="dm-auto-carte" data-con-gomme="${Boolean(cartaGomme && altre)}">
        ${altre ? `<div class="dm-auto-colonna">${altre}</div>` : ""}${cartaGomme}
      </div>`
      : "";
  blocco.innerHTML = `${!elettrica ? quadroMarkup(lettura, tipo, pilloleDelQuadro, { conAltro: Boolean(carte || dati.altri) }) : ""}
    ${carte}
    ${dati.altri}`;
}

function schedule() {
  if (state.frame) return;
  const giro = () => {
    state.frame = 0;
    try {
      dipingi();
    } catch (error) {
      root.console?.warn?.("[DashboardModern] auto termica", error);
    }
  };
  state.frame = root.requestAnimationFrame?.(giro) || 0;
  if (!state.frame) giro();
}

/* La capacita' tenuta da parte trova la sua vettura.
 *
 * Si chiama a ogni disegno: costa una lettura, e solo quando c'e' davvero
 * qualcosa in attesa. Appena la bozza si e' fatta profilo — `editedVehicle()`
 * risponde e ha un identificativo — il numero ci si posa sopra e la mano si
 * svuota. Se la bozza viene abbandonata senza salvare, il numero se ne va con
 * la scheda: non e' mai stato di nessuno. */
function posaLaCapacitaDellaBozza() {
  const inAttesa = clean(state.capacitaInBozza);
  if (!inAttesa || bozzaAperta()) return;
  const nate = state.autoPrimaDellaBozza;
  state.capacitaInBozza = "";
  state.autoPrimaDellaBozza = null;
  const auto = editedVehicle();
  const uid = clean(auto?.[VEHICLE_KEY_FIELD]);
  if (!uid || clean(auto[VEHICLE_CAPACITY_FIELD])) return;
  /* E dev'essere l'auto NATA dalla bozza, non una qualunque.
   *
   * Chiusa la bozza, `editedVehicle()` risponde con quella che la scheda sta
   * guardando adesso: se la bozza e' stata abbandonata aprendo un'auto che
   * c'era gia', quella. Posarci sopra il numero scritto per un'altra vettura
   * vuol dire cambiare in silenzio la capacita' sbagliata — e senza che
   * nessuno l'abbia chiesto, perche' la bozza non e' mai stata salvata.
   *
   * La bozza si e' fatta profilo solo se questo identificativo prima non
   * c'era. Se c'era, il numero non era di nessuno e se ne va con la scheda. */
  if (nate instanceof Set && nate.has(uid)) return;
  salvaAuto(updateVehicle(profiles(), uid, { [VEHICLE_CAPACITY_FIELD]: inAttesa }));
}

export function renderAutoTermica() {
  state.firma = "";
  schedule();
}

function evVisible() {
  return Boolean(doc?.getElementById("page-ev")?.classList.contains("active"));
}

function onClick(event) {
  /* Ogni lettura della pagina si tocca per vederne lo storico: le misure del
   * quadro, i dati delle carte, le gomme, le righe degli altri dati,
   * l'autonomia accanto all'anello. */
  const misuraToccata = event.target?.closest?.(
    "#page-ev :is(.dm-termica,.dm-auto-testa) [data-dm-storico]",
  );
  if (misuraToccata) {
    event.preventDefault();
    try {
      root.apriStorico?.(event, clean(misuraToccata.dataset.dmStorico), clean(misuraToccata.dataset.dmNome));
    } catch (_error) {}
    return;
  }
  /* La matita e il «＋» cambiano l'auto di cui la scheda parla; la tendina si
   * riallinea un istante dopo, quando il modulo dell'auto ha fatto il suo. */
  if (event.target?.closest?.("[data-ev-edit],[data-ev-add-new]"))
    root.queueMicrotask?.(sincronizzaTendina);
  if (event.target?.closest?.('.dm-vehicle-profile-card,[data-tab="ev"],#ev-car-sel'))
    root.queueMicrotask?.(schedule);
}

/* La scelta del motore si scrive quando si fa, non quando si preme un tasto
 * (#326): e' l'unico modo perche' nessun salvataggio possa portarsela via. */
function onChange(event) {
  const campo = event.target?.closest?.("#ed-body [data-ev-kwh]");
  if (campo) {
    try {
      scriviLaCapacita(campo.value);
    } catch (error) {
      root.console?.warn?.("[DashboardModern] capacità della batteria", error);
    }
    return;
  }
  const select = event.target?.closest?.("#ed-body select[data-ev-tipo]");
  if (!select) return;
  try {
    scriviIlMotore(select.value);
  } catch (error) {
    root.console?.warn?.("[DashboardModern] motore dell'auto", error);
  }
}

function installStyles() {
  installStyle(
    "dm-auto-termica-style",
    `
    /* Con un'auto termica la ricarica non si disegna: potenza e tempo alla
       colonnina, sessione, statistiche del wallbox, target, evcc e la
       pastiglia sulla foto parlano di un cavo che quest'auto non ha. */
    #page-ev[data-dm-motore="termica"] .dm-evv-rows,
    #page-ev[data-dm-motore="termica"] .lm-kpi-row,
    #page-ev[data-dm-motore="termica"] .lm-session-card,
    #page-ev[data-dm-motore="termica"] .lm-stats-grid,
    #page-ev[data-dm-motore="termica"] .lm-target-card,
    #page-ev[data-dm-motore="termica"] .lm-evcc-card,
    #page-ev[data-dm-motore="termica"] #lm-charge-badge{display:none!important}
    /* La batteria resta, e dice solo quanto e' carica (#326): su una
       mild-hybrid quella percentuale e' una lettura come le altre, e nessuna
       delle parole intorno parla piu' di ricarica. Senza una batteria mappata
       non c'e' niente da dire, e il blocco non si disegna affatto. */
    #page-ev[data-dm-motore="termica"][data-dm-batteria="false"] .dm-evv-power,
    #page-ev[data-dm-motore="termica"][data-dm-batteria="false"] .lm-batt-section{display:none!important}
    #page-ev[data-dm-motore="termica"] .dm-evv-power{justify-content:center}

    /* I blocchi della pagina Auto: carte come le altre della pagina, numeri in
       Oswald grandi con l'unita' piccola, etichette corte in minuscolo. */
    #page-ev .dm-termica{display:grid;gap:14px;margin:0;min-width:0}
    #page-ev .dm-auto-carta{
      display:grid;gap:12px;align-content:start;min-width:0;padding:16px;
      border-radius:var(--evv-r-s,18px);border:1px solid var(--card-border,rgba(148,163,184,.18));
      background:var(--evv-surface,var(--card-bg,#fff));color:var(--text,#0f172a);
      box-shadow:var(--evv-shadow-s,0 8px 30px rgba(0,0,0,.06))}
    #page-ev .dm-termica[data-attenzione="true"] .dm-termica-gomme,
    #page-ev .dm-termica[data-attenzione="true"] .dm-termica-blocco{
      box-shadow:0 0 0 1px rgba(245,158,11,.45),0 14px 34px -16px rgba(245,158,11,.55)}
    /* Le carte: le gomme, che sono alte, a sinistra; le altre accanto, due
       per riga, e quella che resta sola prende tutta la riga. Su un telefono
       una colonna sola, con le gomme in fondo. */
    #page-ev .dm-auto-carte{display:grid;gap:14px;min-width:0}
    #page-ev .dm-auto-colonna{
      display:grid;gap:14px;align-content:start;min-width:0;
      grid-template-columns:repeat(auto-fit,minmax(max(min(100%,250px),calc((100% - 14px) / 2)),1fr))}
    #page-ev .dm-auto-colonna>:last-child:nth-child(odd){grid-column:1/-1}
    @media (min-width:700px){
      #page-ev .dm-auto-carte[data-con-gomme="true"]{grid-template-columns:minmax(min(280px,100%),.85fr) minmax(0,2fr);align-items:start}
      #page-ev .dm-auto-carte[data-con-gomme="true"]>.dm-termica-gomme{order:-1}
    }
    #page-ev .dm-auto-carta-testa{display:flex;align-items:center;gap:9px;min-width:0}
    #page-ev .dm-auto-carta-ico{display:grid;place-items:center;width:28px;height:28px;flex:0 0 28px}
    #page-ev .dm-auto-carta-ico svg{width:28px;height:28px}
    #page-ev .dm-auto-carta-titolo{
      font-size:13px;font-weight:800;letter-spacing:.01em;color:var(--text,#0f172a);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
    #page-ev .dm-auto-carta-testa>.dm-auto-totale,#page-ev .dm-auto-carta-testa>.dm-auto-sigla{margin-left:auto}
    #page-ev .dm-auto-num{
      font-family:'Oswald',sans-serif;font-weight:600;font-size:26px;line-height:1;letter-spacing:-.01em;
      font-variant-numeric:tabular-nums;color:var(--text,#0f172a);white-space:nowrap}
    #page-ev .dm-auto-num small{
      font-family:'Inter',sans-serif;font-size:11.5px;font-weight:700;letter-spacing:0;
      margin-left:3px;color:var(--text-dim,#64748b)}
    #page-ev .dm-auto-totale{font-size:22px}
    #page-ev .dm-auto-sigla{
      padding:3px 9px;border-radius:999px;font-size:11px;font-weight:900;letter-spacing:.06em;
      background:rgba(14,165,233,.14);color:#0369a1}

    /* I dati uno accanto all'altro: tre per riga finche' ci stanno. */
    #page-ev .dm-auto-dati{display:grid;grid-template-columns:repeat(auto-fit,minmax(84px,1fr));gap:8px}
    #page-ev .dm-auto-dato{
      display:grid;gap:6px;align-content:start;min-width:0;padding:10px 11px;border-radius:14px;
      border:0;background:var(--surface-2,#f8fafc);font:inherit;text-align:left;color:inherit}
    #page-ev button.dm-auto-dato{cursor:pointer}
    #page-ev .dm-auto-dato>span{font-size:11.5px;font-weight:600;color:var(--text-dim,#64748b);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #page-ev .dm-auto-dato .dm-auto-num{font-size:24px;white-space:normal}
    #page-ev .dm-auto-dato .dm-auto-num small{display:inline-block;white-space:nowrap}

    /* L'energia di oggi: una barra sola, tre colori. */
    #page-ev .dm-auto-barra{
      display:flex;gap:2px;height:12px;border-radius:999px;overflow:hidden;
      background:var(--surface-2,#eef2f6)}
    #page-ev .dm-auto-barra>span{min-width:6px;flex-basis:0}
    #page-ev [data-parte="guida"]{--parte:#16a34a}
    #page-ev [data-parte="clima"]{--parte:#0ea5e9}
    #page-ev [data-parte="altro"]{--parte:#f59e0b}
    #page-ev .dm-auto-barra>span{background:var(--parte)}
    #page-ev .dm-auto-legenda{display:grid;grid-template-columns:repeat(auto-fit,minmax(84px,1fr));gap:6px}
    #page-ev .dm-auto-voce{
      display:grid;grid-template-columns:auto 1fr;align-items:center;column-gap:6px;row-gap:2px;
      padding:4px 2px;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;min-width:0}
    #page-ev .dm-auto-voce i{width:9px;height:9px;border-radius:3px;background:var(--parte)}
    #page-ev .dm-auto-voce span{font-size:11.5px;font-weight:600;color:var(--text-dim,#64748b);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #page-ev .dm-auto-voce b{grid-column:1/-1;font-family:'Oswald',sans-serif;font-size:17px;font-weight:600;
      font-variant-numeric:tabular-nums;white-space:nowrap}
    #page-ev .dm-auto-voce b small{font-family:'Inter',sans-serif;font-size:10.5px;font-weight:700;
      margin-left:2px;color:var(--text-dim,#64748b)}

    /* Le pillole: quello che l'auto sta facendo, e come sta. */
    #page-ev .dm-termica-pillole{display:flex;flex-wrap:wrap;gap:6px;min-width:0}
    #page-ev .dm-termica-pillola{
      display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;max-width:100%;
      font-size:11.5px;font-weight:700;background:var(--surface-3,#f1f5f9);color:var(--text,#0f172a)}
    #page-ev .dm-termica-pillola i{font-style:normal}
    #page-ev .dm-termica-pillola[data-tono="acceso"]{background:#dcfce7;color:#166534}
    #page-ev .dm-termica-pillola[data-tono="bene"]{background:#dcfce7;color:#166534}
    #page-ev .dm-termica-pillola[data-tono="attento"]{background:#fef3c7;color:#b45309}
    #page-ev .dm-termica-pillola[data-tono="male"]{background:#fee2e2;color:#b91c1c}
    #page-ev .dm-termica-pillola[data-tono="spento"]{color:var(--text-dim,#64748b)}
    /* La lettera della marcia in un tondino, come sul cruscotto. */
    #page-ev .dm-auto-marcia{
      display:inline-grid;place-items:center;width:18px;height:18px;margin-left:-5px;border-radius:50%;
      font-family:'Oswald',sans-serif;font-size:11.5px;font-weight:700;line-height:1;
      background:var(--text,#0f172a);color:var(--card-bg,#fff)}
    #page-ev .dm-termica-pillola[data-tono="acceso"] .dm-auto-marcia{background:#166534;color:#dcfce7}
    #page-ev .dm-auto-aggiornata{
      display:flex;align-items:center;gap:6px;margin:0;font-size:11.5px;font-weight:600;
      color:var(--text-dim,#64748b)}
    #page-ev .dm-auto-aggiornata i{font-style:normal;font-size:12px;opacity:.8}

    /* Accanto all'anello: l'autonomia in grande, poi le pillole. */
    #page-ev .dm-auto-testa{display:grid;gap:10px;min-width:0;padding-bottom:12px;
      border-bottom:1px solid color-mix(in srgb,var(--text-dim,#64748b) 18%,transparent)}
    #page-ev .dm-auto-testa:last-child{padding-bottom:0;border-bottom:0}
    #page-ev .dm-auto-autonomia{
      display:grid;justify-items:start;gap:4px;padding:0;border:0;background:none;font:inherit;
      color:inherit;text-align:left;cursor:pointer;min-width:0}
    #page-ev .dm-auto-autonomia>small{font-size:11.5px;font-weight:600;color:var(--text-dim,#64748b)}
    #page-ev .dm-auto-autonomia .dm-auto-num{font-size:34px}
    #page-ev .dm-auto-autonomia .dm-auto-num small{font-size:14px}
    #page-ev .dm-auto-autonomia>span{font-size:11.5px;font-weight:600;color:var(--text-dim,#64748b)}
    #page-ev .lm-stat-card[data-dm-doppia="true"]{display:none!important}
    #page-ev .dm-evv-power[data-dm-ricarica="ferma"] .dm-evv-row[data-dm-riga="potenza"],
    #page-ev .dm-evv-power[data-dm-ricarica="ferma"] .dm-evv-row[data-dm-riga="tempo"]{display:none!important}
    /* La prima riga della ricarica resta verde anche con la testa sopra. */
    #page-ev.dm-evv .dm-auto-testa+.dm-evv-row .dm-evv-row-val{color:var(--evv-green-deep,#15803d)}
    [data-theme="dark"] #page-ev.dm-evv .dm-auto-testa+.dm-evv-row .dm-evv-row-val{color:#4ade80}
    #page-ev .dm-evv-power>.dm-evv-gauge{align-self:center}
    /* Da schermo largo la testa e le righe della ricarica stanno affiancate:
       a sinistra com'e' l'auto, a destra come sta caricando. */
    @media (min-width:860px){
      #page-ev .dm-evv-rows.dm-auto-con-testa{
        grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:28px;align-items:center}
      #page-ev .dm-auto-con-testa>.dm-auto-testa{
        grid-column:1;grid-row:1/span 3;align-self:center;padding:0 28px 0 0;border-bottom:0;
        border-right:1px solid color-mix(in srgb,var(--text-dim,#64748b) 18%,transparent)}
      #page-ev .dm-auto-con-testa>.dm-evv-row{grid-column:2}
      #page-ev .dm-evv-power[data-dm-ricarica="ferma"] .dm-auto-con-testa>.dm-evv-row{grid-row:1/span 3;align-self:center}
    }

    /* Il quadro dell'auto a carburante: il serbatoio e le sue misure. */
    #page-ev .dm-termica-testa{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    #page-ev .dm-termica-titolo{font-size:13px;font-weight:800;letter-spacing:.01em;color:var(--text,#0f172a)}
    #page-ev .dm-termica-quadro{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center}
    #page-ev .dm-termica-quadro[data-vuoto="true"]{display:none}
    #page-ev .dm-termica-serbatoio{
      position:relative;width:140px;height:140px;display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:2px;text-align:center}
    #page-ev .dm-termica-serbatoio svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
    #page-ev .dm-termica-arc-track{stroke:var(--surface-3,#e2e8f0)}
    #page-ev .dm-termica-arc{stroke:#f59e0b;transition:stroke-dasharray .8s cubic-bezier(.16,1,.3,1)}
    #page-ev .dm-termica-serbatoio[data-riserva="true"] .dm-termica-arc{stroke:#ef4444}
    #page-ev .dm-termica-serbatoio b{
      position:relative;font-family:'Oswald',sans-serif;font-size:34px;font-weight:500;line-height:1;
      color:var(--text,#0f172a);font-variant-numeric:tabular-nums}
    #page-ev .dm-termica-serbatoio b i{font-style:normal;font-size:.5em;margin-left:1px;opacity:.75}
    #page-ev .dm-termica-serbatoio span{
      position:relative;font-size:11px;font-weight:700;color:var(--text-dim,#64748b)}
    #page-ev .dm-termica-serbatoio[data-riserva="true"] span{color:#dc2626}
    #page-ev .dm-termica-righe{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;min-width:0}
    #page-ev .dm-termica-misura{
      display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:14px;text-align:left;
      border:0;background:var(--surface-2,#f8fafc);cursor:pointer;
      font:inherit;color:var(--text,#0f172a);min-width:0}
    #page-ev .dm-termica-misura i{font-style:normal;font-size:16px;flex:0 0 auto}
    #page-ev .dm-termica-misura-testo{display:grid;gap:3px;min-width:0}
    #page-ev .dm-termica-misura small{
      font-size:11.5px;font-weight:600;color:var(--text-dim,#64748b);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #page-ev .dm-termica-misura b{font-family:'Oswald',sans-serif;font-size:21px;font-weight:600;line-height:1.05;
      font-variant-numeric:tabular-nums;white-space:nowrap}
    #page-ev .dm-termica-misura b em{font-family:'Inter',sans-serif;font-style:normal;font-size:11.5px;font-weight:700;
      color:var(--text-dim,#64748b)}

    /* Le gomme: l'auto vista dall'alto, una pressione accanto a ogni ruota. */
    #page-ev .dm-termica-gomme-quadro{
      display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);
      grid-template-areas:"as auto ad" "ps auto pd";gap:10px 12px;align-items:center}
    #page-ev .dm-termica-gomme-auto{
      grid-area:auto;height:148px;width:auto;justify-self:center;
      filter:drop-shadow(0 6px 10px rgba(6,14,22,.28))}
    #page-ev .dm-termica-gomma[data-ruota="antSx"]{grid-area:as}
    #page-ev .dm-termica-gomma[data-ruota="antDx"]{grid-area:ad}
    #page-ev .dm-termica-gomma[data-ruota="postSx"]{grid-area:ps}
    #page-ev .dm-termica-gomma[data-ruota="postDx"]{grid-area:pd}
    #page-ev .dm-termica-gomma[data-ruota$="Sx"]{text-align:right;justify-items:end}
    #page-ev .dm-termica-gomme-quadro[data-mezzo="moto"]{
      grid-template-columns:repeat(2,minmax(0,1fr));grid-template-areas:"as ad" "ps pd"}
    #page-ev .dm-termica-gomme-quadro[data-mezzo="moto"] .dm-termica-gomma{text-align:left;justify-items:start}
    #page-ev .dm-termica-gomma{
      display:grid;gap:4px;padding:8px 10px;border-radius:14px;min-width:0;
      border:0;background:var(--surface-2,#f8fafc);font:inherit;color:var(--text,#0f172a)}
    #page-ev button.dm-termica-gomma{cursor:pointer}
    #page-ev .dm-termica-gomma small{
      font-size:11px;font-weight:600;color:var(--text-dim,#64748b);max-width:100%;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #page-ev .dm-termica-gomma b{
      font-family:'Oswald',sans-serif;font-size:22px;font-weight:600;line-height:1;
      font-variant-numeric:tabular-nums;white-space:nowrap}
    #page-ev .dm-termica-gomma b em{font-family:'Inter',sans-serif;font-style:normal;font-size:11px;font-weight:700;
      color:var(--text-dim,#64748b)}
    #page-ev .dm-termica-gomma[data-tono="bene"] b{color:#15803d}
    #page-ev .dm-termica-gomma:is([data-tono="bassa"],[data-tono="alta"],[data-tono="avviso"],[data-tono="attento"]){
      background:#fef3c7;color:#b45309;box-shadow:inset 0 0 0 1px rgba(245,158,11,.5)}
    #page-ev .dm-termica-gomma:is([data-tono="bassa"],[data-tono="alta"],[data-tono="avviso"],[data-tono="attento"]) :is(b,small,em){color:#b45309}
    #page-ev span.dm-termica-gomma[data-tono="bene"] b{font-size:15px}
    #page-ev span.dm-termica-gomma[data-tono="attento"] b{font-size:14px;white-space:normal}
    #page-ev .dm-termica-gomma[data-vuota="true"]{background:transparent;box-shadow:inset 0 0 0 1px var(--card-border,#e2e8f0)}
    #page-ev .dm-termica-gomma[data-vuota="true"] b{color:var(--text-dim,#94a3b8)}
    #page-ev .dm-auto-didascalia{display:flex;justify-content:center}

    /* Altri dati: chiuso, una riga per lettura. */
    #page-ev details.dm-auto-altri{padding:0!important;gap:0;margin:0!important}
    #page-ev .dm-auto-altri>summary{
      display:flex;align-items:center;gap:8px;padding:14px 16px!important;margin:0!important;cursor:pointer;list-style:none}
    #page-ev .dm-auto-altri>summary::-webkit-details-marker{display:none}
    #page-ev .dm-auto-altri>summary::after{
      content:"";margin-left:auto;width:8px;height:8px;border-right:2px solid var(--text-dim,#64748b);
      border-bottom:2px solid var(--text-dim,#64748b);transform:rotate(45deg) translate(-2px,-2px);transition:transform .2s ease}
    #page-ev .dm-auto-altri[open]>summary::after{transform:rotate(-135deg) translate(-2px,-2px)}
    #page-ev .dm-auto-altri>summary small{
      padding:1px 8px;border-radius:999px;font-size:11px;font-weight:800;
      background:var(--surface-2,#f1f5f9);color:var(--text-dim,#64748b)}
    #page-ev .dm-auto-elenco{
      display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr));gap:0 18px;padding:0 16px 10px}
    #page-ev .dm-auto-riga{
      display:flex;align-items:center;gap:10px;padding:10px 0;min-width:0;border:0;
      border-top:1px solid color-mix(in srgb,var(--text-dim,#64748b) 16%,transparent);
      background:none;font:inherit;color:inherit;text-align:left;cursor:pointer}
    #page-ev .dm-auto-riga i{font-style:normal;font-size:15px;flex:0 0 auto}
    #page-ev .dm-auto-riga span{flex:1;min-width:0;font-size:12.5px;font-weight:600;color:var(--text-dim,#64748b);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #page-ev .dm-auto-riga b{font-family:'Oswald',sans-serif;font-size:17px;font-weight:600;white-space:nowrap;
      font-variant-numeric:tabular-nums}
    #page-ev .dm-auto-riga b small{font-family:'Inter',sans-serif;font-size:11px;font-weight:700;margin-left:3px;
      color:var(--text-dim,#64748b)}
    #page-ev .dm-termica-vuoto{font-size:12px;font-weight:700;color:var(--text-dim,#64748b);text-align:center;padding:6px}

    /* Al buio i colori delle pillole e delle gomme si scuriscono. */
    [data-theme="dark"] #page-ev .dm-auto-carta{border-color:rgba(148,163,184,.14)}
    [data-theme="dark"] #page-ev :is(.dm-auto-dato,.dm-termica-misura,.dm-termica-gomma){background:rgba(148,163,184,.08)}
    [data-theme="dark"] #page-ev .dm-auto-barra{background:rgba(148,163,184,.14)}
    [data-theme="dark"] #page-ev .dm-termica-pillola{background:rgba(148,163,184,.14);color:#e2e8f0}
    [data-theme="dark"] #page-ev .dm-termica-pillola:is([data-tono="acceso"],[data-tono="bene"]){background:rgba(34,197,94,.16);color:#86efac}
    [data-theme="dark"] #page-ev .dm-termica-pillola[data-tono="attento"]{background:rgba(245,158,11,.18);color:#fcd34d}
    [data-theme="dark"] #page-ev .dm-termica-pillola[data-tono="male"]{background:rgba(239,68,68,.2);color:#fca5a5}
    [data-theme="dark"] #page-ev .dm-termica-pillola[data-tono="spento"]{color:#94a3b8}
    [data-theme="dark"] #page-ev .dm-auto-marcia{background:#e2e8f0;color:#0f172a}
    [data-theme="dark"] #page-ev .dm-termica-pillola[data-tono="acceso"] .dm-auto-marcia{background:#86efac;color:#052e16}
    [data-theme="dark"] #page-ev .dm-termica-gomma[data-tono="bene"] b{color:#4ade80}
    [data-theme="dark"] #page-ev .dm-termica-gomma:is([data-tono="bassa"],[data-tono="alta"],[data-tono="avviso"],[data-tono="attento"]){
      background:rgba(245,158,11,.16);box-shadow:inset 0 0 0 1px rgba(245,158,11,.45)}
    [data-theme="dark"] #page-ev .dm-termica-gomma:is([data-tono="bassa"],[data-tono="alta"],[data-tono="avviso"],[data-tono="attento"]) :is(b,small,em){color:#fcd34d}
    [data-theme="dark"] #page-ev .dm-auto-sigla{background:rgba(56,189,248,.16);color:#7dd3fc}
    [data-theme="dark"] #page-ev .dm-auto-altri>summary small{background:rgba(148,163,184,.14)}

    #ed-body .dm-termica-tipo{display:block;margin:0 0 10px}
    #ed-body .dm-termica-tipo small{
      display:block;margin:4px 2px 0;font-size:11px;line-height:1.45;color:var(--text-dim,#64748b)}

    @media (max-width:640px){
      #page-ev .dm-termica-quadro{grid-template-columns:1fr;justify-items:center}
      #page-ev .dm-termica-righe{width:100%}
      #page-ev .dm-auto-carta{padding:14px}
      #page-ev .dm-auto-autonomia .dm-auto-num{font-size:30px}
      #page-ev .dm-termica-gomme-auto{height:124px}
      #page-ev .dm-termica-gomma{padding:7px 8px}
      #page-ev .dm-termica-gomma b{font-size:19px}
    }
    `,
  );
}

export function installAutoTermica() {
  if (!doc || state.installed) return false;
  state.installed = true;
  installStyles();
  registraTitoloDiPagina("page-ev", () => titoloDellaPagina());
  mettiLeCaselle();
  doc.addEventListener("click", onClick);
  doc.addEventListener("change", onChange);
  /* «toggle» non risale il documento: si ascolta mentre scende. */
  doc.addEventListener(
    "toggle",
    (event) => {
      const tendina = event.target;
      if (tendina?.classList?.contains?.("dm-auto-altri")) state.altriAperti = Boolean(tendina.open);
    },
    true,
  );
  wrapFunction("apriConfigEntita", "__dmAutoTermica", () => {
    mettiLeCaselle();
    rinominaLaLinguettaDellAuto();
    ensureTendinaMotore();
  });
  onEditorRedraw("__dmAutoTermica", () => {
    root.queueMicrotask?.(() => {
      rinominaLaLinguettaDellAuto();
      ensureTendinaMotore();
    });
  });
  /* Il cambio d'auto passa da qui: dopo, il quadro e' di un'altra vettura. */
  wrapFunction("cdEvApplyCar", "__dmAutoTermica", () => root.queueMicrotask?.(renderAutoTermica));
  for (const evento of [
    "dashboardmodern:legacy-ready",
    "dashboardmodern:runtime-ready",
    "dashboardmodern:persistence-restored",
    "dashboardmodern:editor-rendered",
  ])
    root.addEventListener?.(evento, () => {
      mettiLeCaselle();
      root.queueMicrotask?.(() => {
        rinominaLaLinguettaDellAuto();
        ensureTendinaMotore();
      });
      renderAutoTermica();
    });
  root.addEventListener?.("dashboardmodern:state-changed", () => {
    if (evVisible()) schedule();
  });
  rinominaLaLinguettaDellAuto();
  ensureTendinaMotore();
  schedule();
  return true;
}

senzaCadere(installAutoTermica);
