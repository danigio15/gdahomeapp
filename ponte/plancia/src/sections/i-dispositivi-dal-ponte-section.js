/* L'anagrafe chiesta al ponte, una volta per caricamento.
 *
 * «Non devi mettere le entita' ma i dispositivi non connessi, cosi' come li
 * mostri nel cruscotto installatore.»
 *
 * Quella regola c'e' — sta in `core/chi-non-risponde.js`, ed e' la stessa che
 * usa il ponte — ma per lavorare vuole due mappe: di chi e' ogni entita', e
 * come si chiama quel qualcuno. Le mappe vengono dai registri di Home
 * Assistant, che chi disegna non ha; chiederli dal disegno e' costata la #553,
 * quindi la regola di casa e' «non si chiede: si ricorda», e a lasciarli
 * scritti e' chi ce li ha gia'.
 *
 * Dentro Home Assistant funziona: li lascia il pannello (`panel.js`), che i
 * registri li riceve insieme a tutto il resto.
 *
 * ─── Nell'app non li lasciava nessuno ────────────────────────────────────
 *
 * Li' il pannello non c'e'. L'unico che poteva averli era il guscio storico,
 * che li carica **solo quando ha girato il rilevamento automatico** — e il
 * nome del dispositivo non lo tiene affatto: `WIZ.devNames` nel guscio non
 * esiste, sono zero occorrenze. Quindi sul telefono, a caricamento pulito,
 * l'avviso tornava a contare le entita': quattro «Child lock» al posto di
 * niente, che e' esattamente il caso che aveva fatto nascere la regola.
 *
 * Il ponte pero' i registri ce li ha, e li ha gia' in mano: li legge per il
 * rapporto al quadro, ed e' da li' che il cruscotto dell'installatore sa dire
 * «Asciugatrice». Glieli si chiedono, una volta, e li si lascia scritti per
 * chi disegna.
 *
 * ─── Una volta, e solo dove il ponte c'e' ────────────────────────────────
 *
 * Una volta per caricamento: le mappe restano scritte fra un caricamento e
 * l'altro, e il ponte le tiene da parte cinque minuti per conto suo — un
 * secondo giro sarebbe la stessa risposta.
 *
 * E solo dove la plancia e' ospitata dal ponte. Dentro Home Assistant quel
 * comando non esiste e la risposta e' «non conosco»: ed e' quella giusta,
 * perche' li' le mappe ce le ha gia' messe il pannello. Chiederlo lo stesso
 * vorrebbe dire un errore nel registro a ogni apertura, per una cosa che non
 * manca.
 *
 * Se non risponde — un ponte vecchio che quel comando non lo sa, il filo che
 * cade — non succede niente: chi disegna torna a contare le entita', come
 * faceva prima che questo file esistesse. Un avviso piu' grossolano e' meglio
 * di una plancia che non si apre.
 */
import {
  iDispositiviRicordati,
  nonSiSaNiente,
  ricordaIDispositivi,
} from "../core/i-dispositivi-di-home-assistant.js";
import { clean, doc, root } from "./shared.js";

const KEY = "__DASHBOARDMODERN_DISPOSITIVI_DAL_PONTE__";
/** Dove sta il conto delle prove, per chi le deve guardare. */
export const CHIAVE_DELLO_STATO = KEY;
const state = (root[KEY] ||= { installed: false, fatto: false, prove: 0 });

/** Il comando: e' del ponte, e dentro Home Assistant non esiste. */
export const IL_COMANDO = "ponte/registri";

/* Quanto si aspetta la risposta. I registri di una casa grande sono migliaia
 * di righe e il ponte puo' doverli chiedere a Home Assistant sul momento:
 * otto secondi sono quello che si da' alle altre domande pesanti. */
const ATTESA = 8000;

/* Quante volte si prova, e ogni quanto.
 *
 * Perche' piu' di una: la prima volta il filo verso il ponte puo' non essere
 * ancora aperto, e una domanda che parte prima e' una domanda persa. Nel
 * collaudo e' successo esattamente cosi' — la sezione si era installata, la
 * domanda era «gia' fatta», e sul filo non era passato niente.
 *
 * Perche' non all'infinito: se il ponte quel comando non lo sa, non lo sapra'
 * nemmeno fra dieci secondi, e chi disegna sa gia' cavarsela senza. Tre prove
 * a tre secondi coprono l'avvio di una casa lenta e finiscono li'. */
const QUANTE_PROVE = 3;
const RIPROVA_FRA = 3000;

/** Se questa plancia la serve il ponte. */
export function ilPonteCE() {
  return Boolean(root.__DASHBOARDMODERN_HOSTED__);
}

/** Se la presa verso il ponte e' aperta adesso. */
export function ilFiloCE() {
  const presa = lessicale("ws");
  return Boolean(presa && presa.readyState === 1 && lessicale("pendingWsCallbacks"));
}

/* La domanda passa dalla presa gia' aperta.
 *
 * La plancia ne ha una sola verso chi la ospita e la tiene aperta; aprirne
 * un'altra per una domanda vorrebbe dire una seconda autenticazione e un
 * secondo motivo per fallire. E' lo stesso giro che fa il selettore delle
 * foto, scritto uguale. */
function chiediAlPonte(messaggio, attesa = ATTESA) {
  return new Promise((risolvi, rifiuta) => {
    const presa = lessicale("ws");
    const appese = lessicale("pendingWsCallbacks");
    if (!presa || presa.readyState !== 1 || !appese) {
      rifiuta(new Error("il filo non c'e'"));
      return;
    }
    let id = 0;
    try {
      id = root.eval("msgId++");
    } catch (_errore) {
      rifiuta(new Error("msgId"));
      return;
    }
    const sveglia = root.setTimeout?.(() => {
      delete appese[id];
      rifiuta(new Error("il ponte non risponde"));
    }, attesa);
    appese[id] = (detto) => {
      root.clearTimeout?.(sveglia);
      if (detto?.success === false) rifiuta(new Error(clean(detto?.error?.code) || "no"));
      else risolvi(detto?.result);
      delete appese[id];
    };
    try {
      presa.send(JSON.stringify({ ...messaggio, id }));
    } catch (errore) {
      root.clearTimeout?.(sveglia);
      delete appese[id];
      rifiuta(errore);
    }
  });
}

/* Le variabili del guscio non stanno su `window`: sono dichiarate con `const`
 * dentro il documento, e da fuori si leggono solo cosi'. */
function lessicale(nome) {
  try {
    return root.eval(nome);
  } catch (_errore) {
    return null;
  }
}

/**
 * Chiede le due mappe al ponte e le lascia scritte.
 *
 * Torna `true` solo quando qualcosa e' davvero cambiato: mappe vuote non si
 * scrivono, e mappe uguali a quelle di ieri non si riscrivono.
 */
export async function chiediIDispositiviAlPonte() {
  if (!ilPonteCE()) return false;
  try {
    const detto = await chiediAlPonte({ type: IL_COMANDO });
    if (!detto || typeof detto !== "object") return false;
    return ricordaIDispositivi({
      di: detto.di && typeof detto.di === "object" ? detto.di : {},
      nomi: detto.nomi && typeof detto.nomi === "object" ? detto.nomi : {},
    });
  } catch (_errore) {
    /* Un ponte vecchio, il filo caduto, Home Assistant che non risponde:
     * niente di tutto questo e' una cosa da dire a chi guarda la plancia. Si
     * torna a contare le entita', che e' come si faceva prima. */
    return false;
  }
}

/* Quando si chiede.
 *
 * Non subito: al primo istante la presa verso il ponte non e' ancora aperta, e
 * una domanda che parte prima e' una domanda persa. Si aspetta il momento in
 * cui il guscio dice di essere pronto — li' il filo c'e' quasi sempre, perche'
 * e' da quel filo che sono arrivati gli stati — e se non c'e' ancora si
 * riprova, poche volte e poi basta.
 *
 * Il segno di «fatto» si mette **dopo**, e solo se e' andata: metterlo prima
 * vuol dire che il primo tentativo a vuoto e' anche l'ultimo. Nel collaudo era
 * cosi', e sul filo non passava niente. */
export async function unGiro() {
  if (state.fatto || state.prove >= QUANTE_PROVE) return;
  state.prove += 1;
  if (!ilFiloCE()) {
    root.setTimeout?.(unGiro, RIPROVA_FRA);
    return;
  }
  const andata = await chiediIDispositiviAlPonte();
  if (andata) {
    state.fatto = true;
    return;
  }
  /* Non e' andata: o il ponte non sa il comando — e allora le prove che
   * restano finiranno subito e senza danno — o il filo e' caduto proprio
   * adesso. Si riprova finche' ne restano. */
  if (state.prove < QUANTE_PROVE) root.setTimeout?.(unGiro, RIPROVA_FRA);
}

function alMomentoGiusto() {
  unGiro().catch(() => {});
}

export function installIDispositiviDalPonte() {
  if (!doc || state.installed) return false;
  state.installed = true;
  if (!ilPonteCE()) return false;
  /* Se le mappe ci sono gia' e sono di questo caricamento non si chiede
   * affatto: il pannello puo' averle lasciate un attimo fa, e una domanda la
   * cui risposta e' gia' sul tavolo e' un giro regalato.
   *
   * Si chiede lo stesso quando ci sono ma sono vecchie? No: sono la stessa
   * cosa. I registri cambiano quando qualcuno aggiunge o ribattezza un
   * apparecchio, e in quel caso chi apre la plancia la volta dopo se le
   * ritrova nuove. */
  if (!nonSiSaNiente(iDispositiviRicordati())) return false;
  for (const quando of ["dashboardmodern:states-ready", "dashboardmodern:legacy-ready"])
    root.addEventListener?.(quando, alMomentoGiusto);
  /* E se quei due fossero gia' passati, si chiede adesso. */
  root.setTimeout?.(alMomentoGiusto, 2500);
  return true;
}

installIDispositiviDalPonte();
