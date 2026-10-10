/* Cosa c'e' davvero nel locale caldaia (#253).
 *
 * La sezione si chiamava «Solare termico» e disegnava una cosa sola: pannello,
 * pompa, accumulo. Ma l'acqua calda in casa la fanno tre macchine diverse, e
 * quasi nessuno ne ha una sola:
 *
 *   - il SOLARE TERMICO, che scalda col sole e si guarda per sapere se
 *     conviene far girare la pompa;
 *   - lo SCALDABAGNO elettrico, che scalda con una resistenza che si paga e si
 *     guarda per sapere quando ci sara' l'acqua calda;
 *   - la CALDAIA, che scalda a gas e serve anche i termosifoni, quindi si
 *     guarda la mandata, il ritorno e la pressione del circuito.
 *
 * Chi ha il fotovoltaico e lo scaldabagno non ha il solare termico, e la
 * sezione gli mostrava un pannello che non ha. Chi ha solare e caldaia insieme
 * — che e' il caso piu' comune — ne vedeva una sola.
 *
 * Qui c'e' solo la scelta: quali dei tre ci sono, e quale si sta guardando. La
 * regola sta fuori dal disegno perche' la stessa risposta serve alla pagina,
 * alla scheda di configurazione e alla barra di navigazione, e tre copie della
 * stessa domanda sono tre occasioni di rispondere diverso.
 *
 * Poi e' arrivata la quarta, la STUFA A PELLET (#183). L'acqua calda non la
 * fa: scalda la stanza in cui sta. Ma e' una macchina del caldo di casa come
 * le altre, e col serbatoio del pellet in comune con la caldaia; il suo
 * modello sta in fondo a questo file.
 */

import {
  caselleDi,
  corrente,
  elencoConCorrente,
  entitaDiTutte,
  nomeProgressivo,
  normalizzaVoce,
  overridesPerScelto,
} from "./piu-di-uno.js";
import { passoDellUnita, scalaDellUnita } from "./scala-clima.js";

/** La chiave in cui vive la scelta. */
export const CHIAVE_IMPIANTI = "cd_impianti_termici";

/* L'ordine e' quello in cui si presentano le linguette, e non e' alfabetico:
 * e' l'ordine in cui il calore arriva in casa — prima quello che e' gratis,
 * poi quello che si paga a corrente, poi quello che si paga a gas.
 *
 * La stufa a pellet viene per ultima (#183), e non per anzianita': e' l'unica
 * delle quattro che non porta il calore in giro per la casa con l'acqua. Lo fa
 * nella stanza in cui sta, a sacchi comprati uno per volta — dopo il gas, nella
 * stessa fila, c'e' il fuoco che si vede. In coda, poi, non sposta nessuno:
 * chi aveva gia' scelto le sue tre linguette le ritrova nello stesso posto. */
export const TIPI_TERMICI = Object.freeze(["solare", "scaldabagno", "caldaia", "stufa"]);

export const ETICHETTE_TERMICHE = Object.freeze({
  solare: ["Solare termico", "Solar thermal"],
  scaldabagno: ["Scaldabagno", "Water heater"],
  caldaia: ["Caldaia", "Boiler"],
  stufa: ["Stufa a pellet", "Pellet stove"],
});

/* Come si chiama la sezione, adesso che non e' piu' una macchina sola.
 *
 * «La sezione non si deve chiamare piu' Solare termico ma Gestione termica»:
 * ha ragione — il nome vecchio era quello di uno dei tre impianti, e chi ha
 * solo la caldaia si trovava la sua macchina dentro una voce che parlava di
 * pannelli solari. */
/* Il titolo della pagina segue quello che si sta guardando quando c'e' una
 * macchina sola: senza linguette, il titolo e' l'unica cosa che dice cosa si
 * sta guardando. Con due o tre lo dicono le linguette, e allora il titolo
 * torna a essere il nome della sezione — che sta qui sotto la stessa chiave
 * `sezione`, insieme ai casi che ricopre, invece che sciolto per conto suo:
 * l'estrattore riconosce le tabelle di coppie, e una coppia sciolta gli
 * passava davanti senza che nessuno se ne accorgesse. */
export const TITOLI_TERMICI = Object.freeze({
  sezione: ["Gestione termica", "Thermal management"],
  solare: ["Impianto solare termico", "Solar thermal plant"],
  scaldabagno: ["Scaldabagno elettrico", "Electric water heater"],
  caldaia: ["Caldaia", "Boiler"],
  stufa: ["Stufa a pellet", "Pellet stove"],
});

/* La briciola della sezione dice quali macchine ricopre, e da quando c'e' la
 * stufa (#183) sono quattro: lasciarla a tre voleva dire, a chi ha caldaia e
 * stufa, un sottotitolo che nomina due macchine che non ha e tace quella che
 * sta guardando. */
export const BRICIOLE_TERMICHE = Object.freeze({
  sezione: ["Solare · Scaldabagno · Caldaia · Stufa", "Solar · Water heater · Boiler · Stove"],
  solare: [
    "Circuito primario · Boiler · Ricircolo sanitario",
    "Primary loop · Tank · Recirculation",
  ],
  scaldabagno: ["Acqua calda · Resistenza · Consumo", "Hot water · Element · Consumption"],
  caldaia: ["Mandata · Ritorno · Pressione", "Flow · Return · Pressure"],
  stufa: ["Fiamma · Potenza · Pellet", "Flame · Power · Pellet"],
});

/* Come si chiama la sezione, adesso che non e' piu' una macchina sola.
 *
 * «La sezione non si deve chiamare piu' Solare termico ma Gestione termica»:
 * ha ragione — il nome vecchio era quello di uno dei tre impianti, e chi ha
 * solo la caldaia si trovava la sua macchina dentro una voce che parlava di
 * pannelli solari. */
export const NOME_SEZIONE = TITOLI_TERMICI.sezione;
export const BRICIOLA_SEZIONE = BRICIOLE_TERMICHE.sezione;

const clean = (value) => String(value ?? "").trim();

const vero = (valore) => valore === true || valore === "true" || valore === 1 || valore === "1";

/**
 * La scelta salvata, ripulita.
 *
 * `null` non e' «nessuno»: e' «non ha ancora scelto nessuno», e le due cose
 * vanno distinte — la prima e' una pagina vuota voluta, la seconda e' una
 * plancia che sta per essere aggiornata e non deve perdere quello che vede.
 */
export function normalizzaScelta(stored) {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
  const scelta = {};
  let almenoUna = false;
  for (const tipo of TIPI_TERMICI) {
    const acceso = vero(stored[tipo]);
    scelta[tipo] = acceso;
    if (acceso) almenoUna = true;
  }
  /* Una scelta salvata con tutto spento e' una scelta: chi ha tolto ogni
   * spunta vuole la sezione vuota, e riempirgliela sarebbe disobbedire. Si
   * distingue dal «non ha mai scelto» perche' l'oggetto in memoria c'e'. */
  return { ...scelta, vuota: !almenoUna };
}

/**
 * Quali impianti ha questa casa, in ordine di linguetta.
 *
 * `indizi` dice cosa risulta gia' configurato — le caselle del solare mappate,
 * un elenco di scaldabagni, le caselle della caldaia — e serve solo a chi non
 * ha ancora scelto: la sezione esiste da prima di questa domanda, e chi ci
 * arriva con l'impianto solare gia' mappato deve continuare a vederlo senza
 * dover andare a mettere una spunta che ieri non c'era.
 */
export function impiantiScelti(stored, indizi = {}) {
  const scelta = normalizzaScelta(stored);
  if (scelta) return TIPI_TERMICI.filter((tipo) => scelta[tipo]);
  const dedotti = TIPI_TERMICI.filter((tipo) => Boolean(indizi[tipo]));
  /* Nessuna scelta e nessun indizio: la sezione mostra il solare, che e'
   * quello che ha sempre mostrato. Non e' un ripiego neutro — e' il
   * comportamento di prima, che nessun aggiornamento deve cambiare da solo. */
  return dedotti.length ? dedotti : ["solare"];
}

/**
 * Quale linguetta e' aperta.
 *
 * La richiesta vale solo se quell'impianto c'e': chi toglie la caldaia mentre
 * la sta guardando non deve restare su una linguetta che non esiste piu'.
 */
export function tabAttiva(scelti, richiesta) {
  const elenco = Array.isArray(scelti) ? scelti.filter(Boolean) : [];
  if (!elenco.length) return "";
  const voluta = clean(richiesta);
  return elenco.includes(voluta) ? voluta : elenco[0];
}

/** Le linguette si mostrano solo quando c'e' da scegliere. */
export function servonoLinguette(scelti) {
  return Array.isArray(scelti) && scelti.length > 1;
}

/* ── la caldaia ────────────────────────────────────────────────────────────
 *
 * Le sue caselle stanno in una chiave sua e non fra quelle del solare: sono
 * un'altra macchina, e mescolarle vorrebbe dire una scheda in cui meta' dei
 * campi non riguarda chi la sta compilando. */
export const CHIAVE_CALDAIA = "cd_caldaia";

/* Cosa si guarda di una caldaia, e in che ordine.
 *
 * Mandata e ritorno prima di tutto: la differenza fra i due dice se
 * l'impianto sta cedendo calore o sta girando a vuoto, ed e' la ragione per
 * cui si apre questa pagina. La pressione subito dopo, perche' e' l'unica
 * cosa che ogni tanto va rabboccata a mano. */
/* Il gruppo delle caselle che ha solo chi brucia pellet o legna (#346): la
 * scheda le raccoglie sotto un titolo loro, e chi ha una caldaia a gas non se
 * le trova in mezzo alle sue. */
export const GRUPPO_PELLET = "pellet";

export const CASELLE_CALDAIA = Object.freeze([
  { campo: "stato", tipo: "acceso" },
  { campo: "fiamma", tipo: "acceso" },
  /* L'interruttore che la accende e la spegne (#274).
   *
   * «Non permette accensione/spegnimento della caldaia»: la pagina leggeva e
   * basta. Lo stato dice se la macchina lavora, ma non la comanda — sono due
   * entita' diverse, e chi ha un `switch` sulla caldaia lo vuole sotto le dita
   * dove la guarda invece che in un'altra pagina. */
  { campo: "interruttore", tipo: "acceso" },
  /* Le elettrovalvole di riciclo (#274).
   *
   * «Non mostra le elettrovalvole di riciclo»: sono quelle che smistano
   * l'acqua fra il riscaldamento e il sanitario, e da come stanno si capisce
   * dove sta andando il calore — che e' meta' di quello che si viene a
   * guardare su questa pagina. Due, perche' due sono in un impianto normale. */
  { campo: "valvola", tipo: "acceso" },
  { campo: "valvola2", tipo: "acceso" },
  { campo: "mandata", tipo: "gradi" },
  { campo: "ritorno", tipo: "gradi" },
  { campo: "acquaCalda", tipo: "gradi" },
  { campo: "pressione", tipo: "bar" },
  { campo: "modulazione", tipo: "percento" },
  /* Quello che una caldaia a pellet o a legna ha in piu' (#346).
   *
   * «Nella sezione caldaia vorrei inserire: temperatura caldaia, temperatura
   * alta e bassa del boiler, temperatura fumi, comando ventilatore fumi,
   * ossigeno residuo, livello riempimento pellet, temperatura mandata
   * calcolata» — da chi ha una Froling PE15 letta con «Froling Connect».
   *
   * Non e' un'altra macchina: e' la stessa caldaia, che invece del gas brucia
   * pellet, e quindi ha una combustione da guardare — i fumi, l'ossigeno che
   * avanza, il ventilatore che tira — e un serbatoio che si svuota. Le
   * caselle stanno in coda a quelle di prima, nell'ordine in cui le ha
   * chieste: chi ha una caldaia a gas non se le trova in mezzo alle sue, e
   * chi ne ha una a pellet non perde niente di quello che aveva gia'.
   *
   * Ognuna e' facoltativa come tutte le altre: quello che non e' mappato non
   * si disegna. Il ventilatore dei fumi e' l'unico che non sa cos'e' finche'
   * non lo si legge — su una Froling e' una percentuale di comando, ma c'e'
   * chi ce l'ha come interruttore — e a dirlo e' la lettura, non chi
   * configura. */
  { campo: "temperaturaCaldaia", tipo: "gradi", gruppo: GRUPPO_PELLET },
  { campo: "boilerAlto", tipo: "gradi", gruppo: GRUPPO_PELLET },
  { campo: "boilerBasso", tipo: "gradi", gruppo: GRUPPO_PELLET },
  { campo: "fumi", tipo: "gradi", gruppo: GRUPPO_PELLET },
  { campo: "ventilatoreFumi", tipo: "percento", gruppo: GRUPPO_PELLET },
  { campo: "ossigeno", tipo: "percento", gruppo: GRUPPO_PELLET },
  { campo: "pellet", tipo: "percento", gruppo: GRUPPO_PELLET },
  /* Il secondo serbatoio (#182).
   *
   * «Potresti aggiungere ancora una lettura pellet in %? Ce n'e' una ma la
   * utilizzo gia'. Attualmente ho messo la seconda lettura pellet nella
   * cartella ossigeno.» La casella dell'ossigeno faceva da serbatoio, e la
   * scena la scriveva come ossigeno: un numero giusto sotto il nome sbagliato.
   *
   * Sta subito dopo il primo perche' e' la stessa domanda — quanto pellet
   * resta — fatta a un altro serbatoio: stessa lettura in percentuale o in
   * chili, stessa soglia sotto cui si ordina. La chiave del primo resta
   * `pellet`: chi ne ha uno solo non ha niente da migrare. */
  { campo: "pellet2", tipo: "percento", gruppo: GRUPPO_PELLET },
  { campo: "mandataCalcolata", tipo: "gradi", gruppo: GRUPPO_PELLET },
]);

/* Le parole con cui una caldaia dice che lavora e che riposa.
 *
 * La prima riga di ognuna e' quella di un binary_sensor, di un interruttore o
 * di un climate: on e off, heat e idle. Le altre sono di una caldaia a pellet
 * (#346): una centralina Lambdatronic racconta il suo ciclo per fasi, e
 * «Froling Connect» le passa a Home Assistant come stato, nella lingua
 * dell'account — quindi in inglese, in tedesco o in italiano.
 *
 * Le fasi in cui il fuoco c'e' o lo si sta facendo — preparazione,
 * preriscaldamento, accensione, riscaldamento, mantenimento, fine combustione
 * — sono una caldaia che lavora; standby, caldaia spenta e fuoco spento sono
 * una caldaia che riposa. Un guasto o un autotest non sono ne' l'una ne'
 * l'altra cosa e restano quello che sono: la scena scrive la parola com'e'
 * invece di decidere per conto suo.
 *
 * Fonte: le voci di stato della Lambdatronic 3200 / SP 3000 (Heizen,
 * Anheizen, Zuendung, Vorwaermen, Vorbereitung, Feuererhaltung, Ausbrand,
 * Kessel Aus, Feuer Aus) e le stesse voci come le dicono l'app e il portale.
 * Spazi, trattini e sottolineature non contano: «Burn out», «burn_out» e
 * «Kessel-Aus» sono la stessa parola. */
const PAROLE_ACCESE = [
  "on|true|1|heat|heating|burning|flame|dhw|attiva|attivo",
  /* Froling, in inglese. */
  "ignition|preheating|preparation|fire (?:maintenance|preservation)|burn ?out",
  /* Froling, in tedesco. */
  "heizen|anheizen|z(?:u|ue|\u00fc)ndung|vorw(?:a|ae|\u00e4)rmen|vorbereitung",
  "feuererhaltung|ausbrand",
  /* Froling, in italiano. */
  "riscaldamento|accensione|preriscaldamento|preparazione|mantenimento(?: fuoco)?",
  "fine combustione|combustione finale",
];
const PAROLE_SPENTE = [
  "off|false|0|idle|stand ?by|none|ferma|fermo",
  /* Froling: caldaia spenta, fuoco spento. */
  "boiler off|fire off|kessel aus|feuer aus|aus",
  "caldaia spenta|fuoco spento|spenta|spento|riposo|a riposo",
];
const ACCESI = new RegExp(`^(?:${PAROLE_ACCESE.join("|")})$`, "i");
const SPENTI = new RegExp(`^(?:${PAROLE_SPENTE.join("|")})$`, "i");

/** Acceso, spento, o non lo sappiamo. */
export function accesoCaldaia(state) {
  /* Una fase scritta con l'underscore o col trattino e' la stessa fase: si
   * pareggia la scrittura prima di riconoscerla, invece di elencare tre volte
   * la stessa parola. */
  const valore = clean(state).replace(/[\s_-]+/g, " ");
  if (ACCESI.test(valore)) return true;
  if (SPENTI.test(valore)) return false;
  return null;
}

const numero = (valore) => {
  if (valore === null || valore === undefined || valore === "") return null;
  const dato = Number(valore);
  return Number.isFinite(dato) ? dato : null;
};

const unitaDi = (stato) => clean(stato?.attributes?.unit_of_measurement).toLowerCase();

/* I domini che dicono acceso e spento e basta: un numero letto da uno di
 * questi non e' una percentuale. */
const DOMINI_INTERRUTTORE = new Set(["switch", "binary_sensor", "input_boolean", "light"]);

/**
 * Il ventilatore dei fumi: un comando in percentuale, o un interruttore (#346).
 *
 * Su una caldaia a pellet e' quasi sempre una percentuale — quanto tira
 * l'aspiratore — ma c'e' chi ce l'ha come `switch`, e chi come `fan`, che dice
 * tutte e due le cose. A chi configura non si chiede di saperlo: lo dicono il
 * dominio e l'unita' di misura al momento della lettura.
 *
 * Un numero con un'unita' che non e' la percentuale — i giri al minuto, per
 * dire — vale solo come acceso o spento: scriverlo con un «%» accanto sarebbe
 * inventarsi una misura che nessuno ha dato. Non mappato non e' un
 * ventilatore fermo: e' `null`.
 */
export function letturaVentilatore(entity, stato) {
  const id = clean(entity);
  if (!id) return null;
  const dominio = id.split(".")[0];
  const unita = unitaDi(stato);
  const valore = clean(stato?.state);
  /* Un `fan` porta la velocita' fra gli attributi: il suo stato e' on/off. */
  if (dominio === "fan") {
    const percento = numero(stato?.attributes?.percentage);
    return { entity: id, acceso: accesoCaldaia(valore), percento };
  }
  const dato = DOMINI_INTERRUTTORE.has(dominio) ? null : numero(valore);
  if (dato === null) return { entity: id, acceso: accesoCaldaia(valore), percento: null };
  return { entity: id, acceso: dato > 0, percento: unita === "%" || !unita ? dato : null };
}

/**
 * Il serbatoio del pellet: una percentuale, o dei chili (#346).
 *
 * «Livello riempimento pellet» in percentuale e' quello che il disegno
 * riempie. Ma c'e' chi ha una bilancia sotto il serbatoio, o un'integrazione
 * che parla in chili: allora il numero e' quello e la quota non si inventa —
 * un serbatoio disegnato a meta' sopra una lettura in chili sarebbe
 * un'affermazione, non un dato.
 */
export function letturaPellet(stato) {
  const valore = numero(stato?.state);
  if (unitaDi(stato) === "kg") return { pellet: null, pelletChili: valore };
  return { pellet: valore, pelletChili: null };
}

/* Sotto questa quota il serbatoio va riempito: e' la sola cosa di questa
 * pagina che manda a ordinare qualcosa. */
export const PELLET_SCARSO = 15;

/** Se il pellet sta finendo; `null` quando la quota non si sa. */
export function pelletScarso(percento) {
  const quota = numero(percento);
  return quota === null ? null : quota <= PELLET_SCARSO;
}

/* Cosa c'è all'altro capo del tubo (#274).
 *
 * «Richiesta di visualizzare o radiatore o boiler»: la scena disegnava sempre
 * un radiatore, e chi ha una caldaia che serve solo l'accumulo sanitario ci
 * vedeva un termosifone che non ha. Sono due impianti diversi e si dicono con
 * due disegni diversi; di serie i radiatori, che è il caso comune. */
export const USCITE_CALDAIA = Object.freeze(["radiatori", "boiler"]);

/** La configurazione della caldaia, ripulita. */
export function normalizzaCaldaia(stored) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const fuori = { name: clean(dato.name) };
  for (const { campo } of CASELLE_CALDAIA) fuori[campo] = clean(dato[campo]);
  const uscita = clean(dato.uscita).toLowerCase();
  fuori.uscita = USCITE_CALDAIA.includes(uscita) ? uscita : USCITE_CALDAIA[0];
  return fuori;
}

/* Le caldaie di casa, che possono essere piu' d'una (#281).
 *
 * «Avendo una casa composta da due appartamenti uniti ho due caldaie, una per
 * la zona giorno e una per la zona notte.»
 *
 * La chiave resta la stessa e accetta tutte e due le forme: chi ne aveva una
 * la ritrova dov'era, senza migrazioni e senza perdere niente. Chi ne aggiunge
 * una seconda scrive una lista, e da li' in poi e' una lista.
 */
export function normalizzaCaldaie(stored) {
  const righe = Array.isArray(stored)
    ? stored
    : stored && typeof stored === "object"
      ? [stored]
      : [];
  return (
    righe
      .map((riga, indice) => ({
        ...normalizzaCaldaia(riga),
        id: clean(riga?.id) || `caldaia-${indice + 1}`,
      }))
      /* Una riga senza nemmeno un'entita' non e' una caldaia a meta': e' una
       * riga vuota, e disegnarla vorrebbe dire una macchina che non dice
       * niente. Quella appena aggiunta vive nell'editor finche' non si compila. */
      .filter((riga) => CASELLE_CALDAIA.some(({ campo }) => riga[campo]))
  );
}

/** Le entita' di tutte le caldaie. */
export function entitaDelleCaldaie(stored) {
  return normalizzaCaldaie(stored).flatMap((riga) => entitaDellaCaldaia(riga));
}

/** Le letture di tutte le caldaie, nell'ordine in cui sono scritte. */
export function lettureCaldaie(stored, states = {}, resolve = (value) => value) {
  return normalizzaCaldaie(stored).map((riga) => ({
    ...letturaCaldaia(riga, states, resolve),
    id: riga.id,
  }));
}

/** Le entita' che la caldaia tiene d'occhio. */
export function entitaDellaCaldaia(config) {
  const dato = normalizzaCaldaia(config);
  return CASELLE_CALDAIA.map(({ campo }) => dato[campo]).filter(Boolean);
}

/**
 * La lettura della caldaia: cosa dicono adesso le sue caselle.
 *
 * `salto` e' la differenza fra mandata e ritorno, ed e' la misura che dice se
 * l'impianto sta davvero cedendo calore: due numeri vicini su una caldaia
 * accesa vogliono dire che l'acqua gira senza scaldare niente.
 */
export function letturaCaldaia(config, states = {}, resolve = (value) => value) {
  const dato = normalizzaCaldaia(config);
  const leggi = (riferimento) => {
    const chiave = clean(riferimento);
    if (!chiave) return null;
    let entity = chiave;
    try {
      entity = clean(resolve(chiave)) || chiave;
    } catch (_error) {
      entity = chiave;
    }
    return states?.[entity] || states?.[chiave] || null;
  };
  const mandata = numero(leggi(dato.mandata)?.state);
  const ritorno = numero(leggi(dato.ritorno)?.state);
  const secondoSerbatoio = letturaPellet(leggi(dato.pellet2));
  const statoEntita = leggi(dato.stato);
  const fiammaEntita = leggi(dato.fiamma);
  const fiamma = accesoCaldaia(fiammaEntita?.state);
  const acceso = accesoCaldaia(statoEntita?.state);
  const interruttore = accesoCaldaia(leggi(dato.interruttore)?.state);
  return {
    name: dato.name,
    uscita: dato.uscita,
    /* L'interruttore, per comandarla: l'entita' e il suo stato viaggiano
     * insieme perche' chi disegna il tasto deve sapere tutte e due — quale
     * chiamare e come dipingerlo. */
    interruttore: dato.interruttore,
    interruttoreAcceso: interruttore,
    /* Le elettrovalvole, con dentro solo quelle mappate: una valvola che non
     * c'e' non e' una valvola chiusa. */
    valvole: [
      { entity: dato.valvola, acceso: accesoCaldaia(leggi(dato.valvola)?.state) },
      { entity: dato.valvola2, acceso: accesoCaldaia(leggi(dato.valvola2)?.state) },
    ].filter((voce) => clean(voce.entity)),
    /* Come si chiama quello che sta facendo adesso: e' la lettura che la
     * pagina non diceva quando c'erano le sonde («non mostra lo stato
     * standby/in funzione»). In funzione se brucia o se e' accesa; a riposo se
     * lo sappiamo e non lo e'; niente se nessuno l'ha mappata. */
    inFunzione:
      fiamma === true
        ? true
        : acceso === true
          ? true
          : fiamma === false || acceso === false
            ? false
            : null,
    /* La fiamma accesa e' gia' una caldaia accesa: chi mappa solo il bruciatore
     * non deve mappare anche uno stato per vedere la sua macchina viva. */
    acceso: acceso ?? (fiamma === true ? true : fiamma === false ? null : null),
    fiamma,
    mandata,
    ritorno,
    salto: mandata != null && ritorno != null ? Math.round((mandata - ritorno) * 10) / 10 : null,
    acquaCalda: numero(leggi(dato.acquaCalda)?.state),
    pressione: numero(leggi(dato.pressione)?.state),
    modulazione: numero(leggi(dato.modulazione)?.state),
    /* La parola che lo stato dice adesso, cosi' com'e'.
     *
     * Serve a chi la caldaia la legge da una centralina che parla per fasi e
     * ne dice una che non conosciamo — «Stoerung», «Selbsttest»: la scena la
     * scrive invece di dire che nessuno ha mappato niente. */
    statoTesto: clean(statoEntita?.state),
    /* La caldaia a pellet (#346): il corpo, le due sonde dell'accumulo
     * sanitario, la combustione, il serbatoio e l'obiettivo della centralina.
     * Ognuna c'e' soltanto se e' mappata. */
    temperaturaCaldaia: numero(leggi(dato.temperaturaCaldaia)?.state),
    boilerAlto: numero(leggi(dato.boilerAlto)?.state),
    boilerBasso: numero(leggi(dato.boilerBasso)?.state),
    fumi: numero(leggi(dato.fumi)?.state),
    ventilatore: letturaVentilatore(dato.ventilatoreFumi, leggi(dato.ventilatoreFumi)),
    ossigeno: numero(leggi(dato.ossigeno)?.state),
    ...letturaPellet(leggi(dato.pellet)),
    /* Il secondo serbatoio (#182), letto come il primo: in percentuale
     * riempie il disegno, in chili resta un numero. */
    pellet2: secondoSerbatoio.pellet,
    pellet2Chili: secondoSerbatoio.pelletChili,
    mandataCalcolata: numero(leggi(dato.mandataCalcolata)?.state),
  };
}

/**
 * I serbatoi della caldaia che dicono qualcosa, nell'ordine delle caselle.
 *
 * Uno, due o nessuno (#182): un serbatoio che nessuno ha mappato — o che in
 * questo momento non risponde — non e' un serbatoio vuoto, e non si disegna.
 * Ognuno porta la sua quota o i suoi chili, e se sta finendo: la soglia e'
 * la stessa per tutti e due, perche' e' la stessa domanda — quando ordinare.
 */
export function serbatoiDellaCaldaia(lettura) {
  return [
    { campo: "pellet", pellet: lettura?.pellet ?? null, chili: lettura?.pelletChili ?? null },
    { campo: "pellet2", pellet: lettura?.pellet2 ?? null, chili: lettura?.pellet2Chili ?? null },
  ]
    .filter((serbatoio) => serbatoio.pellet != null || serbatoio.chili != null)
    .map((serbatoio) => ({ ...serbatoio, scarso: pelletScarso(serbatoio.pellet) === true }));
}

/* La pressione di un impianto domestico sta fra un bar e mezzo e due e mezzo;
 * sotto l'uno il pressostato blocca la caldaia, ed e' la sola cosa di questa
 * pagina che chiede di alzarsi dal divano. */
export const PRESSIONE_MINIMA = 1;
export const PRESSIONE_MASSIMA = 3;

/** Se la pressione chiede attenzione, e in che verso. */
export function verdettoPressione(bar) {
  const valore = numero(bar);
  if (valore === null) return "";
  if (valore < PRESSIONE_MINIMA) return "bassa";
  if (valore > 2.5) return "alta";
  return "buona";
}

/* ── il solare, che può essere più d'uno ───────────────────────────────── */

/* «Solare termico continua ad avere un solo impianto: non è stata aggiunta la
 * possibilità di gestire più impianti.»
 *
 * Era l'ultima macchina rimasta singola. Gli scaldabagni sono una lista da
 * sempre, le caldaie lo sono diventate (#281), e il solare no: le sue tredici
 * caselle sono mappature `dm.boiler_*` dentro `cd_entity_overrides`, e di
 * quelle ce n'è una serie sola.
 *
 * La regola davanti a tutte è la stessa degli impianti dell'energia: NON SI
 * SPOSTA NIENTE. Chi ha un solare solo non ha una lista, non ha un id, non ha
 * niente da migrare — le sue caselle restano dove sono sempre state e questa
 * parte del modulo non si accorge nemmeno di lui. La lista nasce quando si
 * aggiunge il secondo impianto, e da lì in poi contiene tutti e due.
 *
 * Quello che si vede a schermo è sempre l'impianto scritto nelle mappature:
 * scegliere un altro impianto vuol dire scriverci il suo. Nessuno intercetta
 * niente — la scena del guscio, la tessera della Home, la sincronizzazione e
 * il rilevamento automatico continuano a leggere l'unico posto che hanno
 * sempre letto, e leggono l'impianto che si sta guardando.
 */
export const CHIAVE_SOLARI = "cd_solari";
export const CHIAVE_SOLARE_SCELTO = "cd_solare_scelto";

/* Le tredici caselle del solare, in due gruppi, ognuna col suo posto in pagina.
 *
 * «Vedo un sacco di volte entità solare termico da configurare e non riesco a
 * capire cosa va: non si capisce nulla in questa sezione.» Le caselle avevano
 * il nome del dato e non quello del tasto: tre di fila parlavano della pompa
 * — comando, stato, sensore — e chi configurava ci metteva la stessa entità
 * tre volte senza sapere perché. Adesso ognuna dice, sotto, cosa muove nella
 * pagina; stanno in due gruppi — le misure e i tasti — nell'ordine in cui la
 * pagina le mostra.
 *
 * Il «Sensore pompa solare» non c'è più: nessuno lo leggeva. Al suo posto la
 * «Valvola solare (chiave)», che prima era scritta fissa su
 * `valve.chiave_solare_termico` e non si poteva scegliere. */
export const GRUPPI_DEL_SOLARE = Object.freeze([
  { id: "misure", it: "🌡️ Le misure", en: "🌡️ Readings" },
  { id: "tasti", it: "🎛️ I tasti", en: "🎛️ Buttons" },
]);

export const CASELLE_SOLARE = Object.freeze([
  {
    ref: "dm.boiler_sonda_temperatura_1",
    fabbrica: ["Sonda temperatura 1 (°C)"],
    gruppo: "misure",
    it: "Sonda pannello solare (°C)",
    en: "Solar collector probe (°C)",
    aiutoIt: "La temperatura del pannello, nel disegno accanto ai collettori.",
    aiutoEn: "The collector temperature, next to the panels in the drawing.",
  },
  {
    ref: "dm.boiler_sonda_temperatura_3",
    fabbrica: ["Sonda temperatura 3 (°C)"],
    gruppo: "misure",
    it: "Sonda accumulo alto (°C)",
    en: "Tank top probe (°C)",
    aiutoIt: "Il riquadro ALTO accanto all'accumulo.",
    aiutoEn: "The TOP box next to the tank.",
  },
  {
    ref: "dm.boiler_sonda_temperatura_2",
    fabbrica: ["Sonda temperatura 2 (°C)"],
    gruppo: "misure",
    it: "Sonda accumulo basso (°C)",
    en: "Tank bottom probe (°C)",
    aiutoIt: "Il riquadro BASSO accanto all'accumulo.",
    aiutoEn: "The BOTTOM box next to the tank.",
  },
  {
    ref: "dm.boiler_delta_temperatura",
    gruppo: "misure",
    it: "Delta temperatura (°C)",
    en: "Temperature delta (°C)",
    aiutoIt: "Il riquadro ΔT SOLARE: la differenza fra pannello e accumulo.",
    aiutoEn: "The SOLAR ΔT box: the gap between collector and tank.",
  },
  {
    ref: "dm.boiler_pressione_acqua",
    gruppo: "misure",
    it: "Pressione acqua (bar)",
    en: "Water pressure (bar)",
    aiutoIt: "Il riquadro PRESSIONE.",
    aiutoEn: "The PRESSURE box.",
  },
  {
    ref: "dm.boiler_potenza_resistenza_boiler",
    fabbrica: ["Power resistenza boiler (W)"],
    gruppo: "misure",
    it: "Potenza resistenza boiler (W)",
    en: "Boiler heater power (W)",
    aiutoIt: "Il riquadro POTENZA BOILER.",
    aiutoEn: "The BOILER POWER box.",
  },
  {
    ref: "dm.boiler_pompa_solare",
    fabbrica: ["Pompa solare (manuale)"],
    gruppo: "tasti",
    it: "Pompa solare — comando",
    en: "Solar pump — command",
    aiutoIt: "Il tasto POMPA SOL.: toccandolo si accende o si spegne questa entità.",
    aiutoEn: "The SOLAR PUMP button: tapping it switches this entity on or off.",
  },
  {
    ref: "dm.boiler_stato_pompa_solare",
    fabbrica: ["Stato pompa solare"],
    gruppo: "tasti",
    it: "Pompa solare — se gira",
    en: "Solar pump — running",
    aiutoIt:
      "Dice se la pompa sta girando: accende il tasto POMPA SOL. e fa scorrere i tubi nel disegno. Se il comando qui sopra dice già acceso o spento, metti la stessa entità.",
    aiutoEn:
      "Says whether the pump is running: lights the SOLAR PUMP button and makes the pipes flow in the drawing. If the command above already says on or off, use the same entity.",
  },
  {
    ref: "dm.boiler_interruttore_solare_termico",
    fabbrica: ["Interruttore solare termico"],
    gruppo: "tasti",
    it: "Ctrl Solare",
    en: "Solar control",
    aiutoIt: "Il tasto CTRL SOLARE; quando è acceso, nel disegno il pannello si illumina.",
    aiutoEn: "The SOLAR CTRL button; when it is on, the panel lights up in the drawing.",
  },
  {
    ref: "dm.boiler_centralina_solare_termico",
    fabbrica: ["Centralina solare termico"],
    gruppo: "tasti",
    it: "Centralina",
    en: "Controller",
    aiutoIt: "Il tasto CENTRALINA.",
    aiutoEn: "The CONTROLLER button.",
  },
  {
    ref: "dm.boiler_chiave_solare",
    gruppo: "tasti",
    it: "Valvola solare (chiave)",
    en: "Solar valve (key)",
    aiutoIt:
      "Il tasto VALVOLA e la CHIAVE SOLARE nel disegno: aperta o chiusa. Vuota, resta valve.chiave_solare_termico.",
    aiutoEn:
      "The VALVE button and the SOLAR KEY in the drawing: open or closed. Left empty, it stays valve.chiave_solare_termico.",
  },
  {
    ref: "dm.boiler_interruttore_boiler",
    fabbrica: ["Interruttore boiler"],
    gruppo: "tasti",
    it: "Boiler",
    en: "Boiler",
    aiutoIt: "Il tasto BOILER.",
    aiutoEn: "The BOILER button.",
  },
  {
    ref: "dm.boiler_valvola_di_sicurezza",
    gruppo: "tasti",
    it: "Valvola di sicurezza (cover)",
    en: "Safety valve (cover)",
    aiutoIt: "Il tasto V. SICUREZZA: aperta quando la posizione è sopra zero.",
    aiutoEn: "The SAFETY V. button: open when its position is above zero.",
  },
]);

/* `fabbrica`: i nomi con cui il guscio stampa la casella, nelle due copie. Si
 * cambiano col nome nuovo solo se sono ancora quelli: chi ha rinominato la
 * casella a mano se la tiene come l'ha chiamata. */

/** La casella del solare, se `ref` è una di loro. */
export function casellaDelSolare(ref) {
  return CASELLE_SOLARE.find((riga) => riga.ref === ref) || null;
}

/* I riferimenti delle tredici caselle, per la regola comune. */
const REFS_SOLARE = Object.freeze(CASELLE_SOLARE.map((riga) => riga.ref));

/** Le mappature `dm.boiler_*` di un elenco di override, ripulite. */
export function caselleSolariDa(overrides) {
  return caselleDi(overrides, REFS_SOLARE);
}

/* L'id del primo impianto non si sceglie: è quello, sempre. È la stessa
 * regola degli impianti dell'energia, e per la stessa ragione — chi c'era
 * prima ha un id senza che nessuno gliel'abbia scritto. */
export const PRIMO_SOLARE = "solare";

/** Un impianto solare, ripulito. */
export function normalizzaSolare(stored, indice = 0) {
  return normalizzaVoce(stored, indice, REFS_SOLARE, PRIMO_SOLARE);
}

/**
 * Gli impianti solari di casa.
 *
 * Con la lista vuota — cioè per chiunque non abbia mai chiesto il secondo —
 * esce un impianto solo, quello scritto nelle mappature: senza id inventati e
 * senza niente da salvare. Appena la lista esiste, l'impianto che si sta
 * guardando è quello che porta le mappature adesso, e gli altri sono suoi
 * fratelli fermi in attesa del proprio turno.
 */
export function impiantiSolari(stored, overrides = {}, scelto = "") {
  return elencoConCorrente(stored, overrides, scelto, REFS_SOLARE, PRIMO_SOLARE);
}

/** L'impianto che si sta guardando. */
export function solareCorrente(lista) {
  return corrente(lista);
}

/** Il nome da mostrare per un impianto, che un nome ce l'ha sempre. */
export function nomeDelSolare(impianto, indice = 0, parole = ["Solare termico", "Solar thermal"]) {
  return nomeProgressivo(impianto, indice, parole[0]);
}

/** Le entità di tutti gli impianti solari. */
export function entitaDeiSolari(lista) {
  return entitaDiTutte(lista);
}

/**
 * Le mappature da scrivere per far vedere un altro impianto.
 *
 * Torna l'oggetto degli override completo, non solo le tredici caselle: le
 * altre mappature — l'auto, il server, l'energia — restano quelle che erano, e
 * quelle del solare che l'impianto scelto non usa se ne vanno, altrimenti la
 * scena mostrerebbe una sonda del vicino.
 */
export function overridesPerSolare(overrides, impianto) {
  return overridesPerScelto(overrides, impianto, REFS_SOLARE);
}

/* ── la stufa a pellet (#183) ─────────────────────────────────────────────
 *
 * «E' possibile inserire una scheda per inserire i dati delle stufe a
 * pellet?»
 *
 * Non e' la caldaia a pellet con un altro nome. La caldaia scalda l'acqua e la
 * manda ai termosifoni, e di lei si guarda la mandata; la stufa sta in
 * soggiorno, scalda l'aria della stanza in cui sta, e di lei si guarda la
 * fiamma dietro il vetro, la potenza a cui brucia, il ventilatore che spinge
 * l'aria calda e il serbatoio che si svuota. Edilkamin, MCZ, Palazzetti, le
 * Micronova di Extraflame, Ravelli e Jolly Mec, le Rika: ognuna arriva in Home
 * Assistant con la sua integrazione e con le sue parole, ma le caselle sono
 * quasi sempre le stesse — un termostato, una fase, un livello di potenza, un
 * ventilatore, un serbatoio.
 *
 * Sta in questo modulo perche' divide con la caldaia il serbatoio — la stessa
 * lettura in percentuale o in chili, la stessa soglia — e la regola con cui si
 * scrive una fase che non si conosce. Le sue caselle invece stanno in una
 * chiave sua, `cd_stufe`, come quelle delle caldaie stanno in `cd_caldaia`:
 * sono un'altra macchina.
 *
 * Qui non c'e' DOM e non si chiama nessun servizio: si legge, e si dice quale
 * servizio chiamare. A chiamarlo e' la pagina. */
export const CHIAVE_STUFE = "cd_stufe";

/* Le caselle di una stufa, tutte facoltative: quello che non e' mappato non si
 * disegna.
 *
 * Il termostato prima di tutto, perche' da solo dice quasi tutto — accesa o
 * spenta, l'obiettivo, la temperatura della stanza e, se li ha, i modi del
 * ventilatore. L'interruttore subito dopo, per chi un termostato non ce l'ha.
 * Poi le letture, nell'ordine in cui si guardano: la fase, la stanza, la
 * potenza, il ventilatore, i fumi, il pellet, e l'allarme per ultimo, che e'
 * l'unica casella che si spera resti muta. */
export const CASELLE_STUFA = Object.freeze([
  { campo: "clima", tipo: "termostato" },
  { campo: "interruttore", tipo: "acceso" },
  { campo: "stato", tipo: "fase" },
  { campo: "temperatura", tipo: "gradi" },
  { campo: "potenza", tipo: "livello" },
  { campo: "ventilatore", tipo: "livello" },
  { campo: "fumi", tipo: "gradi" },
  { campo: "pellet", tipo: "percento" },
  { campo: "allarme", tipo: "allarme" },
]);

/** Una stufa, ripulita. */
export function normalizzaStufa(stored) {
  const dato = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const fuori = { name: clean(dato.name) };
  for (const { campo } of CASELLE_STUFA) fuori[campo] = clean(dato[campo]);
  return fuori;
}

/* Le stufe di casa, che possono essere piu' d'una: una in soggiorno e una in
 * mansarda e' il caso comune. La forma e' quella delle caldaie (#281) — una
 * lista con un id per riga — e anche qui una riga senza nemmeno un'entita' non
 * e' una stufa: e' quella appena aggiunta, che vive nella scheda finche' non
 * la si compila. */
export function normalizzaStufe(stored) {
  const righe = Array.isArray(stored)
    ? stored
    : stored && typeof stored === "object"
      ? [stored]
      : [];
  return righe
    .map((riga, indice) => ({
      ...normalizzaStufa(riga),
      id: clean(riga?.id) || `stufa-${indice + 1}`,
    }))
    .filter((riga) => CASELLE_STUFA.some(({ campo }) => riga[campo]));
}

/** Le entita' che una stufa tiene d'occhio. */
export function entitaDellaStufa(config) {
  const dato = normalizzaStufa(config);
  return CASELLE_STUFA.map(({ campo }) => dato[campo]).filter(Boolean);
}

/** Le entita' di tutte le stufe. */
export function entitaDelleStufe(stored) {
  return normalizzaStufe(stored).flatMap((riga) => entitaDellaStufa(riga));
}

/* Le parole che non dicono niente: non sono una fase, sono un'assenza. */
const MUTE = new Set(["", "unavailable", "unknown", "none", "null"]);

const muto = (stato) => !stato || MUTE.has(clean(stato.state).toLowerCase());

/* Una parola pareggiata prima di guardarla: senza accenti ne' dieresi —
 * «Zündung» e «Zundung» sono la stessa —, senza maiuscole, e con uno spazio al
 * posto di trattini, sottolineature e due punti: `burning_mod` e «Burning
 * mod» sono la stessa fase. La dieresi scritta «ue» resta com'e': per quella
 * ci pensano le regole. */
function pareggia(testo) {
  return clean(testo)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/* Le fasi di una stufa, e come le dice la pagina.
 *
 * Il ciclo e' lo stesso per tutte le marche: si accende — pulizia, carico del
 * pellet, la candeletta, la fiamma che si stabilizza —, lavora a una potenza,
 * ogni tanto pulisce il braciere, rallenta quando la stanza e' quasi calda, si
 * spegne raffreddandosi e resta in attesa o spenta. Le parole invece sono di
 * chi ha scritto l'integrazione, nella lingua dell'account: Micronova dice
 * «Lavoro» e «Pulizia braciere», MCZ «Power 3» e «Cleaning hot», Palazzetti
 * manda la chiave del suo stato — `burning_mod`, `cool_fluid` — e Rika parla
 * tedesco.
 *
 * Qui stanno le otto fasi che la pagina sa disegnare. Una parola che non si
 * riconosce non viene fatta entrare a forza in una di queste: resta la parola
 * che e', e la pagina la scrive cosi' — come fa la caldaia con «Stoerung». */
export const FASI_STUFA = Object.freeze({
  accensione: ["Accensione", "Ignition"],
  lavoro: ["Lavoro", "Working"],
  modulazione: ["Modulazione", "Modulating"],
  pulizia: ["Pulizia braciere", "Brazier cleaning"],
  spegnimento: ["Spegnimento", "Shutting down"],
  attesa: ["In attesa", "Standby"],
  spenta: ["Spenta", "Off"],
  allarme: ["In allarme", "In alarm"],
});

/* Come si riconoscono, in italiano, in inglese e in tedesco, nell'ordine in
 * cui si guardano.
 *
 * L'ordine e' la regola. Un allarme prima di tutto: «Allarme pellet esaurito»
 * contiene «pellet», ma e' un allarme, e chi lo legge come una fase qualunque
 * lo perde. Poi lo spegnimento, perche' «pulizia finale» e «final cleaning»
 * sono la stufa che si spegne e non quella che pulisce il braciere mentre
 * lavora; poi la pulizia, che di giorno interrompe il lavoro; poi
 * l'accensione, la modulazione e il lavoro, e per ultime l'attesa e la stufa
 * spenta, che sono le parole piu' corte e quindi le piu' facili da trovare
 * dentro un'altra.
 *
 * Un avviso di manutenzione — «Cleaning warning», «Wartung» — non e' una fase
 * ne' un allarme: e' un promemoria, e resta la parola che e'. */
const FASI_RICONOSCIUTE = Object.freeze([
  [
    "allarme",
    new RegExp(
      [
        "\\b(?:allarm[ei]|alarm[es]?|alarma|error[ei]?|err|st(?:o|oe)rung|guast[oi]|fault|failure",
        "|failed|blocc(?:o|ata|ato)|blocked|lock ?out|pellet (?:esaurit[oa]|finit[oa]|finished|empty",
        "|leer)|(?:firewood|legna) (?:esaurit[oa]|finit[oa]|finished)|no pellets?",
        "|(?:mancata|fallita) accensione|ignition fail\\w*|door open|porta aperta|t(?:u|ue)r offen",
        "|troppo alt[ao]|surriscald\\w*|(?:temp|temperature|temperatura) (?:too )?high)\\b|fehler",
        "|^(?:a|al|e|er|err) ?\\d{1,3}$",
      ].join(""),
    ),
  ],
  [null, /\b(?:warning|avviso|wartung|manutenzione|maintenance)\b/],
  [
    "spegnimento",
    new RegExp(
      [
        "\\b(?:spegniment\\w*|raffreddament\\w*|shut ?down|shutting down|switch(?:ing)? off",
        "|turning off|extinguish\\w*|cool(?:ing)?(?: ?down)?|cool fluid|fire stop|final clean\\w*",
        "|pulizia finale|fine combustione|burn ?out|ausbrand|abschalt\\w*|abk(?:u|ue)hl\\w*",
        "|ausk(?:u|ue)hl\\w*|erl(?:o|oe)sch\\w*|nachlauf)\\b",
      ].join(""),
    ),
  ],
  ["pulizia", /\b(?:pulizia|pulitura|clean\w*)\b|reinigung/],
  [
    "accensione",
    new RegExp(
      [
        "\\b(?:accension\\w*|avvio|partenza|preriscald\\w*|preparazion\\w*",
        "|carica(?:mento)? pellet|carico pellet|fiamma presente|attesa fiamma|stabilizz\\w*",
        "|controllo fiamma|ignit\\w*|start\\w*|preheat\\w*|pre heat\\w*|fuel\\w*|load\\w*",
        "|heat ?up|ign test|test fire|fire present|flame (?:light|present)|stabili[sz]\\w*",
        "|check\\w*|anheiz\\w*|vorheiz\\w*|vorw(?:a|ae)rm\\w*|vorbereit\\w*)\\b",
        "|z(?:u|ue)nd|anz(?:u|ue)nd",
      ].join(""),
    ),
  ],
  ["modulazione", /\b(?:modula\w*|burning mod|regelbetrieb|reduziert\w*)\b/],
  [
    "lavoro",
    new RegExp(
      [
        "\\b(?:lavoro|in funzione|funzionament\\w*|riscaldament\\w*|work\\w*|heat|heating",
        "|burn\\w*|running|power ?\\d|potenza ?\\d|p ?\\d|heizen|heizbetrieb|betrieb|brennt",
        "|leistung ?\\d|stufe ?\\d|accesa|acceso|on)\\b",
      ].join(""),
    ),
  ],
  [
    "attesa",
    /\b(?:stand ?by|attesa|in attesa|pronta|pronto|ready|bereit|idle|wait\w*|pausa|pause|sleep|ruhe\w*)\b/,
  ],
  ["spenta", /\b(?:spent[ao]|off|aus|ausgeschaltet|stop\w*|ferm[ao]|false|disattivat[ao])\b|^0$/],
]);

/**
 * La fase di una stufa dalla parola che scrive, o `null` se non la sappiamo.
 *
 * `null` non e' «spenta»: e' una parola che non conosciamo, e la pagina la
 * scrive com'e'. Le parole di sempre — on e off, heat e idle — valgono anche
 * qui, attraverso le stesse della caldaia.
 */
export function faseStufa(testo) {
  const parola = pareggia(testo);
  if (MUTE.has(parola)) return null;
  for (const [fase, regola] of FASI_RICONOSCIUTE) if (regola.test(parola)) return fase;
  const acceso = accesoCaldaia(testo);
  return acceso === true ? "lavoro" : acceso === false ? "spenta" : null;
}

/* Le fasi in cui dietro il vetro c'e' il fuoco. Nello spegnimento resta la
 * brace, che la pagina disegna a parte: una fiamma che danza sopra una stufa
 * che si sta spegnendo direbbe il contrario di quello che succede. */
const FASI_COL_FUOCO = new Set(["accensione", "lavoro", "modulazione", "pulizia"]);

/* La fase che il termostato lascia capire, per chi non ha mappato quella della
 * stufa: `hvac_action` dice se sta scaldando, e il modo se e' spenta. */
function faseDalTermostato(stato) {
  if (muto(stato)) return null;
  const azione = clean(stato.attributes?.hvac_action).toLowerCase();
  if (azione === "heating") return "lavoro";
  if (azione === "preheating") return "accensione";
  if (azione === "idle") return "attesa";
  if (azione === "off" || clean(stato.state).toLowerCase() === "off") return "spenta";
  return null;
}

/* Cosa si puo' accendere e spegnere: un termostato, un interruttore, un
 * ventilatore. Un `binary_sensor` messo nella casella sbagliata si legge, ma
 * non diventa un tasto che non comanda niente. */
const DOMINI_COMANDABILI = new Set(["climate", "switch", "input_boolean", "light", "fan"]);

/* Quanti pallini al massimo: oltre dieci non e' piu' un livello a scatti, e'
 * una scala, e si scrive il numero. */
const PALLINI_MASSIMI = 10;

const arrotonda = (valore) => Math.round(valore * 1000) / 1000;

/* Quale pallino e' acceso per un livello numerico: dal valore quando i
 * pallini contano il valore, dal posto nella scala negli altri casi. */
function pallinoDelNumero({ min, passo, quanti, contaDalValore }, valore) {
  if (valore === null || valore === undefined || !quanti) return null;
  return contaDalValore ? Math.round(valore) : Math.round((valore - min) / passo) + 1;
}

/* Quanti pallini e quale e' acceso, per un livello che va per scelte. */
function conLeScelte(livello) {
  const quanti = livello.opzioni.length;
  const indice = livello.opzioni.indexOf(livello.valore);
  return {
    ...livello,
    quanti: quanti >= 2 && quanti <= PALLINI_MASSIMI ? quanti : null,
    livello: indice >= 0 ? indice + 1 : null,
  };
}

/**
 * Il livello di una cosa che si regola a scatti: la potenza a cui brucia, la
 * velocita' del ventilatore.
 *
 * Ogni integrazione lo pubblica a modo suo. C'e' chi lo da' come `number` da
 * 1 a 5, chi come `select` con «P1»…«P5» o «Power 1»…«Power 5»; il ventilatore
 * e' spesso un `fan` con la percentuale o coi suoi preset. A chi configura non
 * si chiede quale sia: lo dicono il dominio e gli attributi al momento della
 * lettura, come per il ventilatore dei fumi della caldaia. Un `sensor` si
 * legge e basta: e' un livello che si guarda, non uno che si comanda.
 *
 * `null` quando non e' mappato: un livello che non c'e' non e' un livello a
 * zero.
 */
export function livelloDa(entity, stato) {
  const id = clean(entity);
  if (!id) return null;
  const dominio = id.split(".")[0];
  const attributi = stato?.attributes || {};
  const disponibile = !muto(stato);
  const base = { entity: id, dominio, disponibile };
  if (dominio === "number" || dominio === "input_number") {
    const min = numero(attributi.min) ?? 1;
    const max = numero(attributi.max) ?? 5;
    const passo = numero(attributi.step) > 0 ? numero(attributi.step) : 1;
    const valore = disponibile ? numero(stato.state) : null;
    /* I pallini contano dal valore quando il passo e' uno e la scala parte da
     * zero o da uno — 3 su 5 accende tre pallini, e lo zero non ne accende
     * nessuno —, e dal posto nella scala negli altri casi. */
    const contaDalValore = passo === 1 && min >= 0 && min <= 1 && max <= PALLINI_MASSIMI;
    const posti = Math.round((max - min) / passo) + 1;
    const quanti = contaDalValore ? max : posti >= 2 && posti <= PALLINI_MASSIMI ? posti : null;
    const numerico = { ...base, modo: "numero", valore, min, max, passo, quanti, contaDalValore };
    return { ...numerico, livello: pallinoDelNumero(numerico, valore) };
  }
  if (dominio === "select" || dominio === "input_select") {
    const opzioni = (Array.isArray(attributi.options) ? attributi.options : [])
      .map(clean)
      .filter(Boolean);
    const valore = disponibile ? clean(stato.state) : null;
    return conLeScelte({ ...base, modo: "scelta", valore, opzioni });
  }
  if (dominio === "fan") {
    const acceso = disponibile ? accesoCaldaia(stato.state) : null;
    const percento = numero(attributi.percentage);
    const passo =
      numero(attributi.percentage_step) > 0
        ? numero(attributi.percentage_step)
        : numero(attributi.speed_count) > 0
          ? 100 / numero(attributi.speed_count)
          : null;
    if (percento !== null || passo !== null) {
      const scatto = passo ?? 20;
      const quanti = Math.round(100 / scatto);
      /* Un ventilatore spento spesso non ha percentuale: e' a zero, non ignoto. */
      const valore = disponibile ? (acceso === false ? 0 : percento) : null;
      return {
        ...base,
        modo: "percento",
        valore,
        min: 0,
        max: 100,
        passo: scatto,
        acceso,
        quanti: quanti >= 2 && quanti <= PALLINI_MASSIMI ? quanti : null,
        livello: valore === null ? null : Math.round(valore / scatto),
      };
    }
    const preset = (Array.isArray(attributi.preset_modes) ? attributi.preset_modes : [])
      .map(clean)
      .filter(Boolean);
    if (preset.length)
      return conLeScelte({
        ...base,
        modo: "preset",
        valore: disponibile ? clean(attributi.preset_mode) || null : null,
        opzioni: preset,
        acceso,
      });
    return { ...base, modo: "interruttore", valore: null, acceso, quanti: null, livello: null };
  }
  /* Un sensore, o qualunque altra cosa che si legge soltanto. */
  const valore = disponibile ? (numero(stato.state) ?? clean(stato.state)) : null;
  return { ...base, modo: "lettura", valore, quanti: null, livello: null };
}

/**
 * Il ventilatore dai modi del termostato, per chi non ha un'entita' sua.
 *
 * Molte stufe arrivano con un solo `climate`, e la velocita' dell'aria sta li'
 * dentro: `fan_modes` e `fan_mode`. Senza modi non c'e' niente da regolare.
 */
export function livelloDaiModi(entity, stato) {
  const id = clean(entity);
  const modi = stato?.attributes?.fan_modes;
  if (!id || !Array.isArray(modi)) return null;
  const opzioni = modi.map(clean).filter(Boolean);
  if (!opzioni.length) return null;
  const disponibile = !muto(stato);
  return conLeScelte({
    entity: id,
    dominio: "climate",
    disponibile,
    modo: "modi",
    valore: disponibile ? clean(stato.attributes?.fan_mode) || null : null,
    opzioni,
  });
}

/**
 * Lo stesso livello con un altro valore: quello appena chiesto, che Home
 * Assistant non ha ancora confermato. I pallini si ricontano con la regola
 * della lettura, cosi' la pagina mostra subito il passo fatto.
 */
export function livelloConValore(livello, valore) {
  if (!livello) return livello;
  if (livello.modo === "numero")
    return { ...livello, valore, livello: pallinoDelNumero(livello, valore) };
  if (livello.modo === "percento")
    return {
      ...livello,
      valore,
      acceso: valore > 0,
      livello: valore === null ? null : Math.round(valore / livello.passo),
    };
  if (livello.modo === "scelta" || livello.modo === "preset" || livello.modo === "modi")
    return conLeScelte({ ...livello, valore });
  if (livello.modo === "interruttore") return { ...livello, acceso: valore === "on" };
  return livello;
}

/**
 * Il valore che viene dopo, un passo su (`verso` positivo) o giu'.
 *
 * Mai fuori dalla scala che l'entita' dichiara — `min`, `max`, le opzioni —
 * e mai un comando che non cambia niente: in cima e in fondo si torna `null`,
 * e la pagina lo sa prima di premere. Da un valore che non si sa non si fa un
 * passo, tranne che per le scelte: un «+» da nessuna parte e' la prima.
 */
export function prossimoLivello(livello, verso) {
  const direzione = Math.sign(Number(verso) || 0);
  if (!livello || !direzione || livello.disponibile === false) return null;
  if (livello.modo === "numero") {
    const { valore, min, max, passo } = livello;
    if (valore === null || valore === undefined) return null;
    const grezzo = min + Math.round((valore + direzione * passo - min) / passo) * passo;
    const prossimo = arrotonda(Math.min(max, Math.max(min, grezzo)));
    return prossimo === valore ? null : prossimo;
  }
  if (livello.modo === "percento") {
    const valore = livello.valore ?? 0;
    const grezzo = Math.round((valore + direzione * livello.passo) / livello.passo) * livello.passo;
    const prossimo = Math.round(Math.min(100, Math.max(0, grezzo)));
    return prossimo === Math.round(valore) ? null : prossimo;
  }
  if (livello.modo === "scelta" || livello.modo === "preset" || livello.modo === "modi") {
    const opzioni = livello.opzioni || [];
    if (!opzioni.length) return null;
    const indice = opzioni.indexOf(livello.valore);
    if (indice < 0) return direzione > 0 ? opzioni[0] : null;
    const prossimo = Math.min(opzioni.length - 1, Math.max(0, indice + direzione));
    return prossimo === indice ? null : opzioni[prossimo];
  }
  if (livello.modo === "interruttore") {
    if (direzione > 0) return livello.acceso === true ? null : "on";
    return livello.acceso === false ? null : "off";
  }
  return null;
}

/** Il servizio che porta il livello un passo piu' su o piu' giu', o `null`. */
export function comandoLivello(livello, verso) {
  const prossimo = prossimoLivello(livello, verso);
  if (prossimo === null) return null;
  const entity_id = livello.entity;
  if (livello.modo === "numero")
    return { domain: livello.dominio, service: "set_value", data: { entity_id, value: prossimo } };
  if (livello.modo === "scelta")
    return {
      domain: livello.dominio,
      service: "select_option",
      data: { entity_id, option: prossimo },
    };
  if (livello.modo === "percento")
    return { domain: "fan", service: "set_percentage", data: { entity_id, percentage: prossimo } };
  if (livello.modo === "preset")
    return {
      domain: "fan",
      service: "set_preset_mode",
      data: { entity_id, preset_mode: prossimo },
    };
  if (livello.modo === "modi")
    return { domain: "climate", service: "set_fan_mode", data: { entity_id, fan_mode: prossimo } };
  if (livello.modo === "interruttore")
    return {
      domain: livello.dominio,
      service: prossimo === "on" ? "turn_on" : "turn_off",
      data: { entity_id },
    };
  return null;
}

/* Il passo dell'obiettivo quando la stufa non lo dichiara: mezzo grado, come
 * fa la scheda del termostato di Home Assistant con i gradi Celsius. Un grado
 * intero sarebbe troppo per una stanza sola — fra venti e ventuno c'e' la
 * differenza fra un maglione e l'altro. */
const PASSO_STUFA = 0.5;

/**
 * L'obiettivo un passo piu' su o piu' giu', dentro la scala della stufa.
 *
 * Passo e scala sono quelli che il termostato dichiara — `target_temp_step`,
 * `min_temp`, `max_temp` — e la griglia parte dal minimo, come sulla barra
 * del Clima: su una scala che comincia a 7 col mezzo grado i gradi buoni sono
 * 7, 7,5, 8. In cima e in fondo `null`: un tasto che non cambia niente non
 * manda niente.
 */
export function prossimoObiettivo(lettura, verso) {
  const direzione = Math.sign(Number(verso) || 0);
  const ora = numero(lettura?.obiettivo);
  if (!direzione || ora === null || !Array.isArray(lettura?.scala)) return null;
  const [min, max] = lettura.scala;
  const passo = numero(lettura.passoObiettivo) > 0 ? numero(lettura.passoObiettivo) : PASSO_STUFA;
  const grezzo = min + Math.round((ora + direzione * passo - min) / passo) * passo;
  const prossimo = arrotonda(Math.min(max, Math.max(min, grezzo)));
  return prossimo === ora ? null : prossimo;
}

/** Il servizio che sposta l'obiettivo, o `null`. */
export function comandoObiettivo(lettura, verso) {
  const temperatura = prossimoObiettivo(lettura, verso);
  if (temperatura === null || !clean(lettura?.clima)) return null;
  return {
    domain: "climate",
    service: "set_temperature",
    data: { entity_id: clean(lettura.clima), temperature: temperatura },
  };
}

/**
 * Il servizio che accende o spegne la stufa.
 *
 * Col termostato si cambia il modo, che e' quello che fa la stufa vera: si
 * accende in `heat` — o nel primo modo che dichiara, se `heat` non ce l'ha — e
 * si spegne in `off`. Senza termostato si chiama l'interruttore, e si chiama
 * per quello che si vuole e non con un «inverti»: una stufa che ci mette un
 * quarto d'ora ad accendersi non deve finire spenta perche' lo stato letto era
 * vecchio di un secondo.
 */
export function comandoAccensione(lettura, accendi) {
  const clima = clean(lettura?.clima);
  if (clima) {
    const modi = (Array.isArray(lettura.modiClima) ? lettura.modiClima : [])
      .map(clean)
      .filter(Boolean);
    const modo = accendi
      ? modi.includes("heat")
        ? "heat"
        : modi.find((voce) => voce !== "off") || "heat"
      : "off";
    return {
      domain: "climate",
      service: "set_hvac_mode",
      data: { entity_id: clima, hvac_mode: modo },
    };
  }
  const interruttore = clean(lettura?.interruttore);
  const dominio = interruttore.split(".")[0];
  if (!interruttore || !DOMINI_COMANDABILI.has(dominio)) return null;
  return {
    domain: dominio,
    service: accendi ? "turn_on" : "turn_off",
    data: { entity_id: interruttore },
  };
}

/* Le parole con cui un sensore d'allarme dice che va tutto bene. Sono tante
 * perche' ognuno lo dice a modo suo, e nessuna di loro deve diventare una
 * fascia rossa: un allarme finto insegna a non guardare quelli veri. */
const NESSUN_ALLARME = new RegExp(
  [
    "^(?:|0|ok|okay|none|no|nessun[oa]?|nessun allarme|nessun errore|no alarms?|no errors?",
    "|no faults?|keine?|kein alarm|keine st(?:o|oe)rung|kein fehler|normale?|off|false",
    "|unknown|unavailable|null|assente|tutto ok|all ok)$",
  ].join(""),
);

/**
 * L'allarme della stufa: se c'e', e con che parole.
 *
 * Un `binary_sensor` dice acceso o spento, e acceso e' l'allarme. Un sensore
 * di testo dice la sua parola — «Mancata accensione», «A01», «Pellet
 * esaurito» — e quella parola e' proprio quello che si deve leggere nella
 * fascia rossa. Un codice zero, o un «nessun allarme», non e' un allarme.
 */
export function allarmeDellaStufa(entity, stato) {
  const id = clean(entity);
  if (!id) return null;
  const valore = clean(stato?.state);
  if (DOMINI_INTERRUTTORE.has(id.split(".")[0]))
    return { entity: id, attivo: accesoCaldaia(valore) === true, testo: "" };
  if (NESSUN_ALLARME.test(pareggia(valore))) return { entity: id, attivo: false, testo: "" };
  return { entity: id, attivo: true, testo: valore };
}

/**
 * Il serbatoio della stufa: come quello della caldaia, oppure un avviso.
 *
 * Una percentuale o dei chili si leggono come il serbatoio della caldaia, con
 * la stessa soglia. Ma molte stufe non sanno quanto pellet resta: hanno un
 * sensore nel serbatoio che scatta quando sta finendo, e lo passano come
 * `binary_sensor`. Acceso vuol dire «pellet in esaurimento», e la quota non si
 * inventa — si sa solo se sta finendo o no.
 */
export function pelletDellaStufa(entity, stato) {
  const id = clean(entity);
  if (!id) return { pellet: null, pelletChili: null, pelletScarso: null, pelletAvviso: false };
  if (DOMINI_INTERRUTTORE.has(id.split(".")[0]))
    return {
      pellet: null,
      pelletChili: null,
      pelletScarso: accesoCaldaia(stato?.state),
      pelletAvviso: true,
    };
  const { pellet, pelletChili } = letturaPellet(stato);
  return { pellet, pelletChili, pelletScarso: pelletScarso(pellet), pelletAvviso: false };
}

/**
 * La lettura di una stufa: cosa dicono adesso le sue caselle.
 *
 * La fase arriva dalla parola che la stufa scrive, se qualcuno l'ha mappata;
 * altrimenti da quello che il termostato lascia capire. Se la parola c'e' ma
 * non la conosciamo, la fase resta `null` e la parola viaggia in `statoTesto`:
 * la pagina la scrive com'e'.
 */
export function letturaStufa(config, states = {}, resolve = (value) => value) {
  const dato = normalizzaStufa(config);
  const leggi = (riferimento) => {
    const chiave = clean(riferimento);
    if (!chiave) return null;
    let entity = chiave;
    try {
      entity = clean(resolve(chiave)) || chiave;
    } catch (_error) {
      entity = chiave;
    }
    return states?.[entity] || states?.[chiave] || null;
  };
  const clima = leggi(dato.clima);
  const attributi = clima?.attributes || {};
  const climaVivo = Boolean(dato.clima) && !muto(clima);
  const statoEntita = leggi(dato.stato);
  const statoTesto = muto(statoEntita) ? "" : clean(statoEntita.state);
  const fase = statoTesto ? faseStufa(statoTesto) : faseDalTermostato(clima);

  /* Accesa vuol dire comandata accesa: il modo del termostato, o
   * l'interruttore. Chi ha mappato solo la fase la legge da li' — una stufa
   * che lavora o si sta spegnendo e' accesa, una in allarme non si sa. */
  const interruttore = leggi(dato.interruttore);
  const acceso = climaVivo
    ? clean(clima.state).toLowerCase() !== "off"
    : dato.interruttore && !muto(interruttore)
      ? accesoCaldaia(interruttore.state)
      : fase === "spenta"
        ? false
        : fase && fase !== "allarme"
          ? true
          : null;

  const allarmeEntita = allarmeDellaStufa(dato.allarme, leggi(dato.allarme));
  return {
    name: dato.name,
    clima: dato.clima,
    interruttore: dato.interruttore,
    /* L'entita' che accende e spegne: il termostato se c'e', l'interruttore
     * se no. Viaggia con la lettura perche' chi disegna il tasto deve sapere
     * quale chiamare. */
    comando:
      dato.clima ||
      (DOMINI_COMANDABILI.has(dato.interruttore.split(".")[0]) ? dato.interruttore : ""),
    modiClima: Array.isArray(attributi.hvac_modes) ? attributi.hvac_modes.map(clean) : [],
    acceso,
    fase,
    statoTesto,
    /* Il fuoco dietro il vetro: c'e' nelle fasi in cui la stufa brucia, e
     * quando la fase non si sa lo dice l'acceso — come l'oblo' della caldaia
     * per chi ha mappato solo lo stato. Nello spegnimento resta la brace. */
    brucia: fase ? FASI_COL_FUOCO.has(fase) : acceso === true,
    brace: fase === "spegnimento",
    temperatura:
      numero(leggi(dato.temperatura)?.state) ??
      (climaVivo ? numero(attributi.current_temperature) : null),
    obiettivo: climaVivo ? numero(attributi.temperature) : null,
    scala: scalaDellUnita(attributi),
    passoObiettivo: passoDellUnita(attributi, PASSO_STUFA),
    potenza: livelloDa(dato.potenza, leggi(dato.potenza)),
    /* Il ventilatore e' la sua entita' se c'e'; altrimenti i modi del
     * termostato, se ne ha. */
    ventilatore: dato.ventilatore
      ? livelloDa(dato.ventilatore, leggi(dato.ventilatore))
      : livelloDaiModi(dato.clima, clima),
    fumi: numero(leggi(dato.fumi)?.state),
    ...pelletDellaStufa(dato.pellet, leggi(dato.pellet)),
    /* L'allarme e' quello del suo sensore, o la fase quando la fase e' un
     * allarme: «Allarme pellet esaurito» scritto come stato e' un allarme anche
     * se nessuno ha mappato la casella apposta. */
    allarme: {
      attivo: allarmeEntita?.attivo === true || fase === "allarme",
      testo:
        (allarmeEntita?.attivo && allarmeEntita.testo) || (fase === "allarme" ? statoTesto : ""),
    },
  };
}

/** Le letture di tutte le stufe, nell'ordine in cui sono scritte. */
export function lettureStufe(stored, states = {}, resolve = (value) => value) {
  return normalizzaStufe(stored).map((riga) => ({
    ...letturaStufa(riga, states, resolve),
    id: riga.id,
  }));
}
