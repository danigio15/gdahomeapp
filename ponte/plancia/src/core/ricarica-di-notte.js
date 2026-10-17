/* La ricarica di notte: l'auto carica nella fascia che costa meno.
 *
 * «Ho una fascia oraria F3 dalle 23 alle 5 dove la corrente la pago 0,13:
 * quando l'auto e' collegata a quell'ora deve attivarsi la modalita' fast e
 * dopo tale orario si deve fermare. Una cosa semplice da gestire sulla
 * plancia.»
 *
 * La fa la casa, non la plancia. Una plancia chiusa — il telefono in tasca,
 * il tablet spento — non puo' accorgersi che sono le undici: per questo la
 * regola gira nell'add-on (`ponte/src/ricarica-di-notte.js`), che e' sempre
 * acceso, e la plancia la configura e la racconta e basta. Le due meta' si
 * parlano attraverso questo file, che importano tutte e due: la regola scritta
 * due volte sarebbe due regole il giorno che una delle due cambia.
 *
 * Qui non c'e' DOM, non c'e' un filo e non c'e' un orologio: entrano le
 * impostazioni, quello che la casa sa dell'auto e l'istante; escono la
 * decisione e la memoria della notte. E' tutto quello che serve per provarla
 * senza un'auto in garage.
 *
 * ── Le regole, come le ha chieste chi la usa ─────────────────────────────
 *
 *  - all'inizio della fascia, o quando l'auto si collega dentro la fascia, o
 *    quando l'add-on si accende dentro la fascia: se quel giorno e' fra quelli
 *    scelti, l'auto e' collegata e la batteria e' sotto la soglia scelta (al
 *    100% parte sempre; una batteria che non si sa leggere non ferma niente),
 *    evcc passa alla modalita' della fascia e si ricorda quella di prima;
 *  - si ferma alla prima delle due: la batteria arriva al limite che evcc ha
 *    impostato, oppure finisce la fascia. Allora evcc va su «Poi» — spento,
 *    com'era prima, o solare;
 *  - se durante la notte qualcuno cambia modalita' a mano, ha ragione lui: la
 *    notte si chiude li', e alla fine non si tocca niente;
 *  - se l'auto si stacca, la notte finisce e si rimette «Poi».
 *
 * Il giorno che conta e' quello in cui la fascia COMINCIA: «il venerdi'» vuol
 * dire la notte fra venerdi' e sabato, che e' come lo dice chiunque.
 */

import { codiceDellaRicarica } from "./stato-della-ricarica.js";
import {
  fasciaDelleOre,
  minutiDellOra,
  nomeDellaFascia,
  normalizzaLeFasce,
  oraDeiMinuti,
} from "./fasce-della-tariffa.js";

const pulito = (valore) => String(valore ?? "").trim();

const MINUTO = 60_000;
const ORA = 60 * MINUTO;

/* Dove stanno le impostazioni: nella configurazione della plancia, che viaggia
 * fra i dispositivi e che il ponte legge dalla plancia principale. */
export const CHIAVE_RICARICA_NOTTE = "cd_ricarica_notte";

/* Le due modalita' che si possono chiedere alla fascia, e le tre che si
 * possono lasciare dopo. «pv» e' il nome storico del solare: evcc oggi lo
 * chiama «smart», e quale dei due esista lo dice evcc (`modoPerEvcc`). */
/* In fascia si carica in Fast, e basta. C'era anche il Min+Sole, ma evcc
 * l'ha tolto (evcc-io/evcc#32490): «minisolar non esiste piu'». Chi l'aveva
 * scelto torna alla veloce. */
export const MODI_IN_FASCIA = Object.freeze(["now"]);
export const MODI_DOPO = Object.freeze(["off", "prima", "pv"]);

export const IMPOSTAZIONI_DI_SERIE = Object.freeze({
  attiva: false,
  da: "23:00",
  a: "05:00",
  inFascia: "now",
  poi: "off",
  giorni: Object.freeze([true, true, true, true, true, true, true]),
  sotto: 100,
});

/* Quanto si aspetta che evcc dica di aver cambiato modalita', prima di
 * pensare che l'abbia cambiata qualcun altro. Il comando parte, Home Assistant
 * lo gira a evcc, evcc lo applica e lo ripubblica: qualche secondo, a volte
 * un minuto con un evcc lento a ripubblicare. */
export const GRAZIA_DEL_COMANDO = 3 * MINUTO;

/* Quanto vale l'esito di una notte per chi guarda: il racconto di stanotte si
 * legge stamattina, non la settimana dopo. */
export const ESITO_VALE = 18 * ORA;

const ORA_BUONA = /^([01]\d|2[0-3]):[0-5]\d$/;

function leggiJson(valore) {
  if (valore && typeof valore === "object") return valore;
  if (typeof valore !== "string") return null;
  try {
    return JSON.parse(valore);
  } catch (_errore) {
    return null;
  }
}

/**
 * Le impostazioni, ripulite. Entra quello che c'e' scritto nella casella —
 * l'oggetto o il suo JSON — ed esce sempre un oggetto intero: quello che manca
 * o non sta in piedi prende il valore di serie.
 */
export function impostazioniPulite(dato) {
  const letto = leggiJson(dato);
  const d = letto && typeof letto === "object" && !Array.isArray(letto) ? letto : {};
  const ora = (valore, ripiego) => {
    const testo = pulito(valore);
    if (ORA_BUONA.test(testo)) return testo;
    const minuti = minutiDellOra(testo);
    return minuti === null ? ripiego : oraDeiMinuti(minuti);
  };
  const poi = pulito(d.poi).toLowerCase() === "smart" ? "pv" : pulito(d.poi).toLowerCase();
  const giorni =
    Array.isArray(d.giorni) && d.giorni.length === 7
      ? d.giorni.map((g) => g === true)
      : [...IMPOSTAZIONI_DI_SERIE.giorni];
  const sotto = Math.round(Number(d.sotto));
  return {
    attiva: d.attiva === true,
    da: ora(d.da, IMPOSTAZIONI_DI_SERIE.da),
    a: ora(d.a, IMPOSTAZIONI_DI_SERIE.a),
    inFascia: MODI_IN_FASCIA.includes(d.inFascia) ? d.inFascia : IMPOSTAZIONI_DI_SERIE.inFascia,
    poi: MODI_DOPO.includes(poi) ? poi : IMPOSTAZIONI_DI_SERIE.poi,
    giorni,
    /* Fra il 5 e il 100: sotto il 5% non c'e' niente da decidere, e il 100
     * vuol dire «parte sempre». */
    sotto: Number.isFinite(sotto) ? Math.max(5, Math.min(100, sotto)) : IMPOSTAZIONI_DI_SERIE.sotto,
  };
}

/* ── l'orologio della fascia ─────────────────────────────────────────────── */

/** Lunedi' 0, domenica 6: l'ordine dei tasti L M M G V S D. */
export const giornoDellaSettimana = (istante) => (new Date(istante).getDay() + 6) % 7;

/** «2026-10-16»: la notte si chiama col giorno in cui comincia. */
export function chiaveDelGiorno(istante) {
  const d = new Date(istante);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* Le ore si contano sul calendario e non a millisecondi: la notte del cambio
 * dell'ora dura sette ore o cinque, e «alle 5» resta alle 5. */
function alleOreDel(istante, piuGiorni, ora) {
  const [h, m] = ora.split(":").map(Number);
  const d = new Date(istante);
  d.setDate(d.getDate() + piuGiorni);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

/** Dove comincia e finisce la fascia che comincia nel giorno di `istante`. */
function fasciaCheComincia(imp, istante, piuGiorni) {
  const inizio = alleOreDel(istante, piuGiorni, imp.da);
  /* Dalle 23 alle 5 attraversa la mezzanotte; dalle 13 alle 16 no. Due ore
   * uguali sono un giorno intero, non una fascia vuota. */
  const daMin = minutiDellOra(imp.da);
  const aMin = minutiDellOra(imp.a);
  const fine = alleOreDel(inizio, aMin <= daMin ? 1 : 0, imp.a);
  return {
    inizio,
    fine,
    notte: chiaveDelGiorno(inizio),
    giorno: giornoDellaSettimana(inizio),
  };
}

/**
 * La fascia di adesso: `dentro` se si e' nella fascia, con il suo inizio, la
 * sua fine e la notte a cui appartiene. Fuori, gli stessi numeri dell'ultima
 * cominciata.
 */
export function fasciaDi(dato, adesso) {
  const imp = impostazioniPulite(dato);
  const oggi = fasciaCheComincia(imp, adesso, 0);
  const ieri = fasciaCheComincia(imp, adesso, -1);
  for (const una of [oggi, ieri])
    if (una.inizio <= adesso && adesso < una.fine) return { ...una, dentro: true };
  return { ...(oggi.inizio <= adesso ? oggi : ieri), dentro: false };
}

/** La prossima fascia che comincia, in un giorno scelto: `null` se nessuno lo e'. */
export function prossimaFascia(dato, adesso) {
  const imp = impostazioniPulite(dato);
  for (let i = 0; i <= 8; i += 1) {
    const una = fasciaCheComincia(imp, adesso, i);
    if (una.inizio > adesso && imp.giorni[una.giorno]) return una;
  }
  return null;
}

/* ── le modalita' di evcc ────────────────────────────────────────────────── */

/* Gli stessi nomi detti in due modi: evcc ha rinominato `pv` in `smart`, e la
 * veloce la scrive `now` nell'API e `fast` nella tendina di Home Assistant. */
const SINONIMI = Object.freeze({ pv: "smart", smart: "smart", now: "now", fast: "now" });
const canonico = (modo) => {
  const minuscolo = pulito(modo).toLowerCase();
  return SINONIMI[minuscolo] || minuscolo;
};

/** Se due modalita' sono la stessa, comunque siano scritte. */
export function stessoModo(uno, altro) {
  const a = canonico(uno);
  return Boolean(a) && a === canonico(altro);
}

/**
 * Il nome da mandare a evcc per la modalita' voluta.
 *
 * Si manda il nome che l'entita' ha DICHIARATO nelle sue `options`, con le sue
 * maiuscole: «Fast» e non «now», se la tendina dice «Fast». Chi non dichiara
 * niente riceve il nome dell'API. Il «Min+Sole» che un evcc di oggi non ha piu'
 * diventa la veloce: di notte, senza sole, e' quello che faceva comunque.
 */
export function modoPerEvcc(voluto, opzioni = []) {
  const dichiarate = (Array.isArray(opzioni) ? opzioni : []).map(pulito).filter(Boolean);
  const cerca = (nome) => dichiarate.find((voce) => stessoModo(voce, nome));
  const chiesto = pulito(voluto);
  if (!chiesto) return "";
  if (!dichiarate.length) return chiesto.toLowerCase() === "smart" ? "pv" : chiesto;
  if (chiesto === "minpv") return cerca("minpv") || cerca("now") || "";
  if (chiesto === "pv" || chiesto === "smart") return cerca("smart") || "";
  return cerca(chiesto) || "";
}

/** Se questo evcc sa fare il «Min+Sole»: un evcc di oggi non lo dichiara piu'. */
export function saFareMinPiuSole(opzioni = []) {
  const dichiarate = (Array.isArray(opzioni) ? opzioni : []).map(pulito).filter(Boolean);
  return !dichiarate.length || dichiarate.some((voce) => voce.toLowerCase() === "minpv");
}

/* ── le entita' che servono ──────────────────────────────────────────────── */

/* Le caselle della plancia da cui si parte: le stesse della pagina Auto. */
export const RIFERIMENTI = Object.freeze({
  modo: "dm.ev_modalita_ricarica_evcc",
  soc: Object.freeze(["dm.ev_batteria_auto", "dm.ev_battery", "dm.ev_soc"]),
  limite: "dm.ev_target_soc",
  cavo: "dm.ev_cavo_collegato",
  stato: "dm.ev_stato_ricarica",
  energia: "dm.ev_energia_sessione",
});

const ENTITA = /^[a-z_]+\.[a-z0-9_]+$/;

/**
 * Il prefisso delle entita' di evcc di questo punto di ricarica, ricavato
 * dalla modalita': `select.evcc_garage_mode` → `evcc_garage_`. Vuoto se la
 * modalita' non e' di evcc: allora non si indovina niente.
 */
export function prefissoDiEvcc(modo) {
  const id = pulito(modo);
  const pezzi = /^(?:select|input_select)\.(evcc_[a-z0-9_]*?)(?:charge_)?mode$/.exec(id);
  return pezzi ? pezzi[1] : "";
}

/**
 * Le entita' della ricarica, in ordine di fiducia.
 *
 * Prima quello che chi configura ha scritto nella pagina Auto, poi i fratelli
 * che evcc pubblica accanto alla modalita' — il limite del punto di ricarica,
 * la batteria dell'auto collegata, il cavo, l'energia della sessione — cosi'
 * chi ha collegato solo la modalita' ha lo stesso tutto. Per la batteria e il
 * limite vengono prima quelli di evcc: e' evcc che sa quale auto c'e' attaccata
 * stanotte, e quale limite sta usando davvero.
 *
 * `risolvi(rif)` torna l'entita' scritta in quella casella, o vuoto.
 */
export function entitaDellaRicarica(risolvi, { batteria = "" } = {}) {
  const leggi = (rif) => {
    let detto = "";
    try {
      detto = pulito(risolvi?.(rif));
    } catch (_errore) {
      detto = "";
    }
    return detto && detto !== rif && ENTITA.test(detto) && !detto.startsWith("dm.") ? detto : "";
  };
  const modo = leggi(RIFERIMENTI.modo);
  const p = prefissoDiEvcc(modo);
  const diEvcc = (...nomi) => (p ? nomi.map((nome) => nome.replace("@", p)) : []);
  const limiteScritto = leggi(RIFERIMENTI.limite);
  const soc = [...diEvcc("sensor.@vehicle_soc"), pulito(batteria), ...RIFERIMENTI.soc.map(leggi)];
  const limite = [
    ...(limiteScritto.includes("evcc") ? [limiteScritto] : []),
    ...diEvcc("sensor.@effective_limit_soc", "number.@limit_soc", "select.@limit_soc"),
    limiteScritto,
  ];
  const unici = (elenco) =>
    elenco.filter((id, i, tutti) => id && ENTITA.test(id) && tutti.indexOf(id) === i);
  return {
    modo,
    soc: unici(soc),
    limite: unici(limite),
    cavo: unici([leggi(RIFERIMENTI.cavo), ...diEvcc("binary_sensor.@connected")]),
    stato: unici([leggi(RIFERIMENTI.stato)]),
    energia: unici([
      leggi(RIFERIMENTI.energia),
      ...diEvcc("sensor.@charged_energy", "sensor.@session_energy"),
    ]),
  };
}

/** Tutte le entita' che la regola guarda, in un elenco. */
export function entitaGuardate(entita) {
  if (!entita) return [];
  return [
    entita.modo,
    ...entita.soc,
    ...entita.limite,
    ...entita.cavo,
    ...entita.stato,
    ...entita.energia,
  ].filter(Boolean);
}

const MUTO = /^(unavailable|unknown|none|)$/i;

function percentuale(stato) {
  const testo = pulito(stato?.state).replace("%", "").replace(",", ".");
  if (MUTO.test(testo)) return null;
  const n = Number(testo);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

function kilowattora(stato) {
  const testo = pulito(stato?.state).replace(",", ".");
  if (MUTO.test(testo)) return null;
  const n = Number(testo);
  if (!Number.isFinite(n) || n < 0) return null;
  const unita = pulito(stato?.attributes?.unit_of_measurement).toLowerCase();
  if (unita === "wh") return n / 1000;
  if (unita === "mwh") return n * 1000;
  return n;
}

const ACCESO = /^(on|true|1|home|connected|plugged|collegat[ao]|attaccat[ao]|yes)$/i;
const SPENTO = /^(off|false|0|not_home|disconnected|unplugged|scollegat[ao]|staccat[ao]|no)$/i;

/**
 * Quello che la casa sa dell'auto adesso.
 *
 * `stati(id)` torna lo stato di un'entita' — `{ state, attributes }` — o
 * niente. Esce: la modalita' di evcc e le sue `options`, la batteria, il
 * limite, se l'auto e' collegata e i kWh della sessione. Quello che non si
 * sa e' `null`.
 *
 * «Collegata» vale `true` anche quando nessuna entita' lo puo' dire: chi non ha
 * un sensore del cavo non deve restare senza ricarica, ed evcc senza un'auto
 * attaccata non carica comunque. Se invece le entita' ci sono e tacciono —
 * una wallbox che si sta riconnettendo — e' `null`, e si aspetta.
 */
export function letturaDellAuto(entita, stati) {
  const di = (id) => {
    try {
      return id ? (typeof stati === "function" ? stati(id) : stati?.[id]) || null : null;
    } catch (_errore) {
      return null;
    }
  };
  const primo = (elenco, leggi) => {
    for (const id of elenco || []) {
      const valore = leggi(di(id));
      if (valore !== null && valore !== undefined) return valore;
    }
    return null;
  };
  const modoStato = di(entita?.modo);
  const modo = modoStato && !MUTO.test(pulito(modoStato.state)) ? pulito(modoStato.state) : "";
  const opzioni = Array.isArray(modoStato?.attributes?.options)
    ? modoStato.attributes.options.map(pulito).filter(Boolean)
    : [];
  let collegata = primo(entita?.cavo, (stato) => {
    const s = pulito(stato?.state);
    if (ACCESO.test(s)) return true;
    if (SPENTO.test(s)) return false;
    return null;
  });
  if (collegata === null)
    collegata = primo(entita?.stato, (stato) => {
      const codice = codiceDellaRicarica({ stato: stato?.state });
      if (codice === "A") return false;
      if (codice === "B" || codice === "C") return true;
      return null;
    });
  if (collegata === null) {
    const qualcunoLoDice = [...(entita?.cavo || []), ...(entita?.stato || [])].some((id) => di(id));
    collegata = qualcunoLoDice ? null : true;
  }
  return {
    modo,
    opzioni,
    soc: primo(entita?.soc, percentuale),
    limite: primo(entita?.limite, percentuale),
    collegata,
    kwh: primo(entita?.energia, kilowattora),
  };
}

/* ── il prezzo ───────────────────────────────────────────────────────────── */

const prezzoBuono = (valore) => {
  const n = Number(pulito(valore).replace(",", "."));
  return Number.isFinite(n) && n > 0 && n < 100 ? n : null;
};

/**
 * Il prezzo del kWh nella fascia, e da dove viene.
 *
 * «Il prezzo lo devi recuperare in automatico dal costo impostato in
 * impostazioni nella fascia F3; se non impostato prendi quello della fascia
 * singola; in alternativa dici di inserirlo.»
 *
 * Con tre fasce e' quello della F3, la fascia della notte. Con due, quello
 * della fascia in cui la ricarica comincia. Poi la tariffa unica — un numero,
 * o l'entita' che la dice. Altrimenti `fonte: "nessuno"`, e la plancia chiede
 * di scriverlo.
 */
export function prezzoDellaNotte({
  fasce,
  costo,
  stati = null,
  da = IMPOSTAZIONI_DI_SERIE.da,
} = {}) {
  const config = normalizzaLeFasce(leggiJson(fasce) || {});
  if (config.quante === 3) {
    const f3 = config.voci[2]?.prezzo;
    if (f3) return { prezzo: f3, fonte: "fascia", fascia: nomeDellaFascia(2) };
  } else if (config.quante === 2) {
    const quale = fasciaDelleOre(config, minutiDellOra(da) ?? 0);
    const suo = config.voci[quale]?.prezzo;
    if (suo) return { prezzo: suo, fonte: "fascia", fascia: nomeDellaFascia(quale) };
  }
  const letto = leggiJson(costo);
  const scritto = letto === null ? pulito(costo) : letto;
  let unica = null;
  if (typeof scritto === "number") unica = prezzoBuono(scritto);
  else if (typeof scritto === "string" && ENTITA.test(scritto)) {
    const stato = typeof stati === "function" ? stati(scritto) : stati?.[scritto];
    unica = prezzoBuono(stato?.state);
  } else if (typeof scritto === "string") unica = prezzoBuono(scritto);
  if (unica) return { prezzo: unica, fonte: "unica", fascia: "" };
  return { prezzo: null, fonte: "nessuno", fascia: "" };
}

/* ── la notte ────────────────────────────────────────────────────────────── */

/** La memoria della regola, ripulita: quella sul disco puo' essere di ieri. */
export function memoriaPulita(dato) {
  const d = dato && typeof dato === "object" && !Array.isArray(dato) ? dato : {};
  const s = d.sessione && typeof d.sessione === "object" ? d.sessione : null;
  const numero = (valore) =>
    Number.isFinite(Number(valore)) && valore !== null ? Number(valore) : null;
  return {
    sessione:
      s &&
      Number.isFinite(Number(s.inizio)) &&
      Number.isFinite(Number(s.fine)) &&
      pulito(s.modoMesso)
        ? {
            notte: pulito(s.notte),
            inizio: Number(s.inizio),
            fine: Number(s.fine),
            modoPrima: pulito(s.modoPrima),
            modoMesso: pulito(s.modoMesso),
            messoIl: numero(s.messoIl) ?? Number(s.inizio),
            confermato: s.confermato === true,
            socInizio: numero(s.socInizio),
            kwhLetti: numero(s.kwhLetti),
            caricati: numero(s.caricati) ?? 0,
            kwhNoti: s.kwhNoti === true,
          }
        : null,
    chiusa: pulito(d.chiusa),
    esito: d.esito && typeof d.esito === "object" ? { ...d.esito } : null,
  };
}

const arrotonda = (n, cifre = 2) =>
  n === null || n === undefined ? null : Math.round(n * 10 ** cifre) / 10 ** cifre;

/* I kWh si sommano a pezzi: il contatore della sessione di evcc riparte da
 * zero quando l'auto si stacca, e un conto fatto come «adesso meno all'inizio»
 * diventerebbe negativo proprio nell'ultimo giro. */
function contaIKwh(sessione, kwh) {
  if (kwh === null || kwh === undefined) return sessione;
  const prima = sessione.kwhLetti;
  const piu = prima === null ? 0 : kwh >= prima ? kwh - prima : kwh;
  return { ...sessione, kwhLetti: kwh, caricati: sessione.caricati + piu, kwhNoti: true };
}

/**
 * Cosa fare adesso. Puro: entrano le impostazioni, la memoria della notte,
 * quello che si sa dell'auto, l'istante e il prezzo; escono la memoria nuova
 * e — se c'e' da cambiare modalita' — il comando `{ modo }`, col nome che evcc
 * ha dichiarato.
 *
 * Il ponte scrive la memoria solo se il comando va a buon fine: un comando
 * che Home Assistant rifiuta lascia tutto com'era, e si riprova.
 */
export function laNotte({ impostazioni, memoria, auto = {}, adesso, prezzo = null }) {
  const imp = impostazioniPulite(impostazioni);
  const prima = memoriaPulita(memoria);
  const fascia = fasciaDi(imp, adesso);
  const lettura = {
    modo: pulito(auto.modo),
    opzioni: Array.isArray(auto.opzioni) ? auto.opzioni : [],
    soc: Number.isFinite(auto.soc) ? auto.soc : null,
    limite: Number.isFinite(auto.limite) ? auto.limite : null,
    collegata: auto.collegata === true ? true : auto.collegata === false ? false : null,
    kwh: Number.isFinite(auto.kwh) ? auto.kwh : null,
  };
  const euro = Number.isFinite(prezzo) && prezzo > 0 ? prezzo : null;
  const niente = (perche, nuova = prima) => ({ memoria: nuova, comando: null, perche });

  /* ── una notte gia' cominciata ── */
  if (prima.sessione) {
    const s = contaIKwh(prima.sessione, lettura.kwh);
    const conti = (piu) => ({
      notte: s.notte,
      inizio: s.inizio,
      alle: adesso,
      soc: lettura.soc,
      socInizio: s.socInizio,
      limite: lettura.limite,
      kwh: s.kwhNoti ? arrotonda(s.caricati) : null,
      prezzo: euro,
      costo: s.kwhNoti && euro ? arrotonda(s.caricati * euro) : null,
      ...piu,
    });
    /* Qualcuno ha cambiato modalita' a mano: ha ragione lui. Ma non nei primi
     * istanti, quando evcc dice ancora quella di prima perche' non ha ancora
     * ripubblicato la nostra. */
    if (lettura.modo && !stessoModo(lettura.modo, s.modoMesso)) {
      const inRitardo =
        !s.confermato &&
        adesso - s.messoIl < GRAZIA_DEL_COMANDO &&
        stessoModo(lettura.modo, s.modoPrima);
      if (!inRitardo)
        return niente("a-mano", {
          sessione: null,
          chiusa: s.notte,
          esito: conti({ tipo: "a-mano", modo: lettura.modo }),
        });
      return niente("aspetto-evcc", { ...prima, sessione: s });
    }
    const confermata = lettura.modo ? { ...s, confermato: true } : s;
    const motivo =
      adesso >= s.fine
        ? "orario"
        : lettura.soc !== null && lettura.limite !== null && lettura.soc >= lettura.limite
          ? "limite"
          : lettura.collegata === false
            ? "staccata"
            : !imp.attiva
              ? "spenta"
              : "";
    if (!motivo) return niente("in-corso", { ...prima, sessione: confermata });
    const voluto = imp.poi === "prima" ? s.modoPrima : imp.poi;
    const modo = modoPerEvcc(voluto, lettura.opzioni);
    const comando = modo && !stessoModo(modo, lettura.modo) ? { modo } : null;
    return {
      memoria: {
        sessione: null,
        chiusa: s.notte,
        esito: conti({ tipo: "finita", motivo, poi: modo || lettura.modo }),
      },
      comando,
      perche: motivo,
    };
  }

  /* ── nessuna notte in corso: si comincia? ── */
  if (!imp.attiva) return niente("spenta");
  if (!fascia.dentro) return niente("fuori-fascia");
  if (prima.chiusa === fascia.notte) return niente("notte-chiusa");
  if (!imp.giorni[fascia.giorno]) return niente("giorno-spento");
  if (!lettura.modo) return niente("evcc-muto");
  if (lettura.collegata !== true) return niente("aspetto-l-auto");
  const chiudi = (esito) =>
    niente(esito.tipo, {
      sessione: null,
      chiusa: fascia.notte,
      esito: { notte: fascia.notte, alle: adesso, ...esito },
    });
  if (imp.sotto < 100 && lettura.soc !== null && lettura.soc >= imp.sotto)
    return chiudi({ tipo: "non-parte", soc: lettura.soc, sotto: imp.sotto });
  if (lettura.soc !== null && lettura.limite !== null && lettura.soc >= lettura.limite)
    return chiudi({ tipo: "piena", soc: lettura.soc, limite: lettura.limite });
  const modo = modoPerEvcc(imp.inFascia, lettura.opzioni);
  if (!modo) return niente("evcc-non-sa");
  return {
    memoria: {
      sessione: {
        notte: fascia.notte,
        inizio: adesso,
        fine: fascia.fine,
        modoPrima: lettura.modo,
        modoMesso: modo,
        messoIl: adesso,
        confermato: stessoModo(modo, lettura.modo),
        socInizio: lettura.soc,
        kwhLetti: lettura.kwh,
        caricati: 0,
        kwhNoti: lettura.kwh !== null,
      },
      chiusa: prima.chiusa,
      esito: prima.esito,
    },
    comando: stessoModo(modo, lettura.modo) ? null : { modo },
    perche: "parte",
  };
}
