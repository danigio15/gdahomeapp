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
} from "../core/la-foto-per-lauto.js";
import { normalizePeople } from "../core/person-model.js";
import { carteDalleRighe, modelliDelleTessere } from "./home-widgets-section.js";
import { allStates, clean, doc, readJson, root } from "./shared.js";

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
function laTesseraDellEnergia(states) {
  let tessere = [];
  try {
    tessere = modelliDelleTessere(states) || [];
  } catch (_errore) {
    return null;
  }
  return tessere.find((tessera) => /^energia(_|$)/.test(clean(tessera?.key))) || null;
}

function lEnergia(states) {
  const tessera = laTesseraDellEnergia(states);
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

/** La fotografia di adesso, o `null` se non c'è niente da mandare. */
export function fotografaLaCasa(adesso = Date.now()) {
  const states = allStates();
  return laFotoPerLAuto({
    energia: lEnergia(states),
    persone: normalizePeople(readJson("cd_people", [])),
    states,
    azioni: lElencoDelleAzioni(),
    adesso,
  });
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
  const foto = fotografaLaCasa(adesso);
  if (!foto) return false;
  const firma = firmaDellaFoto(foto);
  if (firma === state.firma && adesso - state.quando < RINFRESCA_MS) return false;
  try {
    canale.postMessage(JSON.stringify(foto));
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
