/* La plancia lascia al telefono la fotografia che l'auto legge.
 *
 * In macchina non si tiene aperto un filo verso casa. Il servizio di Android
 * Auto vive nello stesso processo dell'app, ma l'app può essere chiusa: chi
 * sale in macchina accende Android Auto, non gdahome. Aprire da lì un secondo
 * collegamento vorrebbe dire una seconda copia delle chiavi — due posti che
 * sanno entrare in casa, e il giorno che si scostano nessuno sa quale ha
 * ragione. Così la plancia, che gli stati ce li ha già in mano, ne scrive
 * poche righe, e l'auto legge quelle.
 *
 * ── Chi parla, e solo quando c'è qualcuno che ascolta ────────────────────
 *
 * Il canale è `gdahomeAuto`, e lo installa l'app quando apre il riquadro. Nel
 * browser non c'è, dentro Home Assistant non c'è, e su un'app più vecchia di
 * questa non c'è: lì questa sezione non fa **niente** — non legge le tessere,
 * non conta le persone, non accende nessun timer. È la ragione per cui il
 * canale è suo e non quello delle pagine (`gdahomeDice`): un'app vecchia che
 * ricevesse di là una fotografia la scambierebbe per il nome di una pagina, e
 * il menu resterebbe senza voce accesa.
 *
 * ── Si guarda ogni tanto, si manda quando cambia ─────────────────────────
 *
 * Gli stati arrivano a mazzetti più volte al secondo. Scrivere un file sul
 * telefono a ogni mazzetto vorrebbe dire scrivere sul disco tutto il giorno
 * per ridire la stessa cosa: si guarda ogni mezzo minuto e si manda solo
 * quando la firma cambia. Ma ogni tanto si rimanda anche uguale, perché la
 * fotografia porta il momento in cui è stata scattata e in auto invecchia: una
 * casa ferma di notte, senza questa rimandata, si presenterebbe in macchina
 * come «vecchia» pur essendo giusta.
 *
 * Quello che si manda non è una configurazione nuova: il fotovoltaico è quello
 * della tessera Energia, le persone sono quelle della sezione Persone, le
 * azioni sono le azioni rapide. Una seconda scelta per l'auto sarebbe una
 * seconda verità sulla stessa casa.
 */
import {
  firmaDellaFoto,
  ilTastoDelComando,
  laFotoPerLAuto,
  leRicetteDeiDispositivi,
  leRicettePerLAuto,
} from "../core/la-foto-per-lauto.js";
import { datiPerEntita, servizioPerEntita } from "./azioni-servizio-giusto-section.js";
import { normalizePeople } from "../core/person-model.js";
import { carteDalleRighe, modelliDelleTessere } from "./home-widgets-section.js";
import { allStates, clean, doc, readJson, root, t } from "./shared.js";

const KEY = "__DASHBOARDMODERN_FOTO_IN_AUTO__";
const state = (root[KEY] ||= { installed: false, timer: 0, firma: "", quando: 0 });

/* Ogni quanto si guarda se è cambiato qualcosa. Mezzo minuto: in auto si
 * guarda il fotovoltaico e chi c'è in casa, e nessuna delle due è una cosa che
 * si segue al secondo. */
const OGNI_MS = 30_000;

/* Ogni quanto si rimanda comunque, anche identica. Dieci minuti: l'auto
 * considera vecchia una fotografia di mezz'ora, e tre rimandate dentro quella
 * mezz'ora vogliono dire che basta perderne due — la galleria, un tunnel, il
 * telefono fermo — perché in macchina si legga lo stesso la verità. */
const RINFRESCA_MS = 10 * 60_000;

/** Il canale dell'app, se questa pagina sta dentro l'app. */
function ilCanale() {
  const canale = root.gdahomeAuto;
  return typeof canale?.postMessage === "function" ? canale : null;
}

/* La tessera dell'Energia fra tutte quelle della Home.
 *
 * Con due contatori le tessere sono due — `energia`, `energia_zona_notte` — e
 * in auto ne entra una: la prima, che è quella dell'impianto principale. Tre
 * misure sono già il massimo che si legge a colpo d'occhio; sei, divise fra
 * due impianti, sarebbero una tabella. */
function leTessere(states) {
  try {
    return modelliDelleTessere(states) || [];
  } catch (_errore) {
    return [];
  }
}

/* Una tessera per chiave. Col suffisso quando c'è: due contatori vogliono dire
 * `energia` ed `energia_zona_notte`, e in auto ne entra la prima. */
function laTessera(tessere, chiave) {
  const quale = new RegExp(`^${chiave}(_|$)`);
  return (tessere || []).find((tessera) => quale.test(clean(tessera?.key))) || null;
}

function lEnergia(tessere) {
  const tessera = laTessera(tessere, "energia");
  if (!tessera) return null;
  let carte = [];
  try {
    carte = carteDalleRighe(tessera) || [];
  } catch (_errore) {
    carte = [];
  }
  return {
    nome: clean(tessera.label),
    valore: clean(tessera.value),
    righe: carte.map((carta) => ({ nome: clean(carta?.etichetta), valore: clean(carta?.valore) })),
  };
}

/* ── I dispositivi che vanno in auto ─────────────────────────────────────
 *
 * Arrivano dalle tessere della Home, e non da una configurazione nuova: le
 * porte sono quelle di Sicurezza, i varchi quelli dei Varchi, le luci e le
 * prese quelle delle loro tessere. Chi le ha nascoste in Home le ha nascoste
 * anche qui, perché i modelli arrivano già scremati.
 *
 * Quali entrano e in che ordine lo decide il nucleo. Qui si fa l'altra metà:
 * si legge com'è messa ognuna adesso e si scrive la parola nella lingua di chi
 * guarda — «Aperto», «Accesa» — che è la stessa cosa che fanno le tessere, e
 * dove la tessera l'ha già scritta si prende la sua invece di rifarla. */
const E_APERTO = /^(on|open|opened|unlocked)$/;

function comEMessa(entity, states) {
  return E_APERTO.test(clean(states?.[clean(entity)]?.state).toLowerCase());
}

/* Le quattro tessere che parlano di cose che si aprono e si accendono, col
 * genere che il nucleo si aspetta e il campo in cui ognuna tiene le sue righe.
 * Le porte le tengono in `doors` e non in `rows`, che è come nasce quella
 * tessera: qui si legge dove sono, non si cambia come sono fatte. */
const DA_DOVE = Object.freeze([
  { chiave: "porte", genere: "porta", campo: "doors" },
  { chiave: "varchi", genere: "varco", campo: "rows" },
  { chiave: "luci", genere: "luce", campo: "rows" },
  { chiave: "prese", genere: "presa", campo: "rows" },
]);

function laParola(genere, acceso, riga) {
  /* Quella della tessera, quando ce l'ha: è già tradotta, ed è la stessa che
   * si legge in casa. Due parole diverse per lo stesso stato, una in macchina
   * e una sul divano, sono due stati per chi le legge. */
  const sua = clean(riga?.value);
  if (sua) return sua;
  if (genere === "porta" || genere === "varco") {
    return acceso ? t("Aperto", "Open") : t("Chiuso", "Closed");
  }
  return acceso ? t("Accesa", "On") : t("Spenta", "Off");
}

/** I dispositivi di casa, come li vede l'auto: nome, genere, stato, parola. */
export function iDispositiviDiCasa(tessere, states) {
  const fuori = [];
  for (const { chiave, genere, campo } of DA_DOVE) {
    const tessera = laTessera(tessere, chiave);
    const righe = Array.isArray(tessera?.[campo]) ? tessera[campo] : [];
    for (const riga of righe) {
      const entity = clean(riga?.entity);
      if (!entity) continue;
      /* `on` la tessera ce l'ha quasi sempre, ed è già il conto giusto per
       * quella sezione — un varco socchiuso, una tapparella a metà. Dove non
       * c'è si guarda lo stato grezzo, che è l'unica cosa che resta. */
      const acceso = typeof riga?.on === "boolean" ? riga.on : comEMessa(entity, states);
      fuori.push({
        entity,
        nome: clean(riga?.name),
        genere,
        acceso,
        stato: laParola(genere, acceso, riga),
        /* «Si vede ma non si comanda»: la stessa scelta che in Home spegne
           l'interruttore sulla riga. Dove la tessera non si pronuncia, si
           lascia decidere al nucleo. */
        comando: riga?.comando,
      });
    }
  }
  return fuori;
}

/* L'elenco delle azioni rapide, com'è adesso.
 *
 * Si passa al nucleo così com'è, senza tagliarlo e senza scartare niente: il
 * posto di un tasto è il posto in QUESTO elenco, ed è quello che il nucleo
 * scrive nel segno e rilegge quando il comando torna dall'auto. Scremarlo qui
 * vorrebbe dire due conti del posto, e due conti del posto significano premere
 * il tasto accanto. */
function lElencoDelleAzioni() {
  try {
    const dal = root.getQuickActions?.();
    if (Array.isArray(dal)) return dal;
  } catch (_errore) {
    /* Il guscio storico non c'è ancora: il deposito sì, ed è lo stesso
     * elenco. */
  }
  const scritto = readJson("cd_quick_actions", []);
  return Array.isArray(scritto) ? scritto : [];
}

/* Cos'è davvero l'entità di un'azione, e che servizio vuole.
 *
 * Due cose che la plancia sa e il nucleo no: le sostituzioni di entità — chi
 * ha rimappato una luce a mano — e la tabella dei servizi giusti, quella che
 * sa che un `button` si preme e non si accende. Sono le stesse che usa il
 * tasto in Home: se qui se ne facesse una copia, il tasto in macchina e il
 * tasto in casa farebbero due cose diverse sulla stessa azione. */
function comeSiEsegue(states) {
  return (azione) => {
    const scritta = clean(azione?.entity);
    let entita = scritta;
    try {
      entita = clean(root.resolveEntity?.(scritta)) || scritta;
    } catch (_errore) {
      entita = scritta;
    }
    return {
      entita,
      servizio: servizioPerEntita(entita, states),
      dati: datiPerEntita(entita, azione),
    };
  };
}

/* Come si chiama davvero un'entità: chi ha rimappato una luce a mano l'ha
 * rimappata per tutta la plancia, e l'auto non è il posto dove quella scelta
 * si dimentica. È la stessa `resolveEntity` che usa il resto della Home. */
function comeSiChiamaDavvero() {
  return (entita) => {
    const scritta = clean(entita);
    try {
      return { entita: clean(root.resolveEntity?.(scritta)) || scritta };
    } catch (_errore) {
      return { entita: scritta };
    }
  };
}

/* La fotografia e le ricette nascono nella stessa passata.
 *
 * Costruire le tessere della Home costa, e le guardano in tre: il
 * fotovoltaico, i dispositivi e le ricette dei dispositivi. Farlo una volta e
 * portarsi dietro il risultato è la differenza fra una passata e tre, ogni
 * volta che qualcosa in casa cambia. */
function laPassata(adesso) {
  const states = allStates();
  const tessere = leTessere(states);
  const dispositivi = iDispositiviDiCasa(tessere, states);
  const azioni = lElencoDelleAzioni();
  const risolviEntita = comeSiChiamaDavvero();
  const risolvi = comeSiEsegue(states);
  return {
    foto: laFotoPerLAuto({
      dispositivi,
      energia: lEnergia(tessere),
      persone: normalizePeople(readJson("cd_people", [])),
      states,
      azioni,
      risolvi,
      risolviEntita,
      adesso,
    }),
    /* Le ricette dei tasti e quelle dei dispositivi nello stesso elenco: chi
     * le esegue non ha bisogno di sapere cosa c'è dietro. */
    ricette: [
      ...leRicettePerLAuto(azioni, risolvi),
      ...leRicetteDeiDispositivi(dispositivi, risolviEntita),
    ],
  };
}

/** La fotografia di adesso, o `null` se non c'è niente da mandare. */
export function fotografaLaCasa(adesso = Date.now()) {
  return laPassata(adesso).foto;
}

/**
 * Guarda, e manda se serve. Torna `true` se ha mandato.
 *
 * Il nome della casa non lo mette la plancia: la plancia sa di essere una
 * plancia, non sa di quale delle case dell'app è. Lo scrive chi scrive il file
 * (`app/lib/auto/`), che quella risposta ce l'ha.
 */
export function laFotoVaInAuto(adesso = Date.now()) {
  const canale = ilCanale();
  if (!canale) return false;
  /* Con l'app da un'altra parte non si guarda niente: costruire le tessere
   * della Home per nessuno e' lavoro buttato, e la fotografia si rifa' appena
   * la plancia torna sotto gli occhi. In macchina, intanto, si legge quella di
   * prima — e se e' troppo vecchia l'auto lo dice invece di spacciarla per
   * adesso. */
  if (doc?.hidden === true) return false;
  const { foto, ricette } = laPassata(adesso);
  if (!foto) return false;
  const firma = firmaDellaFoto(foto);
  if (firma === state.firma && adesso - state.quando < RINFRESCA_MS) return false;
  try {
    /* Le ricette viaggiano accanto alla fotografia, non dentro: nel file che
     * legge l'auto ci vanno i nomi, e nomi e basta. Chi scrive il file le
     * rilegge campo per campo e le mette da un'altra parte — è quella
     * rilettura che le tiene fuori, non un ricordarsene. */
    canale.postMessage(JSON.stringify({ ...foto, ricette }));
  } catch (_errore) {
    /* Il canale c'è ma non ha preso: si riproverà al giro dopo, e intanto la
     * firma resta quella di prima — così il prossimo tentativo riparte da
     * capo invece di credere di aver già mandato. */
    return false;
  }
  state.firma = firma;
  state.quando = adesso;
  return true;
}

/**
 * Preme il tasto che l'auto ha chiesto. Torna `true` se l'ha premuto.
 *
 * Chi chiama è l'app, con dentro il segno che l'auto ha lasciato scritto. Il
 * confronto con l'elenco di adesso lo fa il nucleo: se qualcuno ha riordinato
 * le azioni rapide da quando la fotografia è partita, non si preme niente —
 * un tasto che fa un'altra cosa è peggio di un tasto che non fa niente, e in
 * macchina nessuno guarda se è partito quello giusto.
 */
export function premiPerLAuto(id) {
  const tasto = ilTastoDelComando(id, lElencoDelleAzioni());
  if (!tasto) return false;
  try {
    /* È lo stesso tasto della Home, premuto dalla stessa funzione: la conferma
     * che un'azione può chiedere, e i servizi che chiama, restano quelli. */
    root.qaRun?.(tasto.posto);
  } catch (_errore) {
    return false;
  }
  return true;
}

export function installLaFotoVaInAuto() {
  /* Fuori dall'app non c'è niente da installare: nessun timer, nessuna
   * lettura delle tessere. */
  if (state.installed || !ilCanale()) return false;
  state.installed = true;
  /* La porta con un nome, per chi sta fuori dai moduli: l'app che vuole una
   * fotografia fresca prima di chiudere — chi sale in macchina l'app la chiude
   * — e la prova che la pretende sulla pagina vera invece di aspettare il
   * battito. C'è solo dentro l'app: dove non c'è il canale, non c'è nemmeno
   * questa. */
  root.gdahomeFotoInAuto = { adesso: laFotoVaInAuto, foto: fotografaLaCasa, premi: premiPerLAuto };
  laFotoVaInAuto();
  state.timer = root.setInterval?.(() => laFotoVaInAuto(), OGNI_MS) || 0;
  for (const evento of ["dashboardmodern:legacy-ready", "dashboardmodern:persistence-restored"])
    root.addEventListener?.(evento, () => root.queueMicrotask?.(() => laFotoVaInAuto()));
  return true;
}
