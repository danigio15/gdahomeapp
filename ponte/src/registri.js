/* I due registri di Home Assistant, letti una volta e tenuti da parte.
 *
 * Sono l'anagrafe della casa: quali dispositivi ci sono, come si chiamano, e
 * di chi e' ogni entita'. Il ponte li legge gia' per il rapporto — e' da li'
 * che il cruscotto di chi installa sa dire «Asciugatrice» invece di
 * «lock.asciugatrice_child_lock» — e adesso servono anche alla plancia.
 *
 * ─── Perche' la plancia non se li prende da sola ─────────────────────────
 *
 * Perche' si e' gia' provato, ed e' costata la #553:
 * `config/entity_registry/list` e' la risposta piu' pesante che Home Assistant
 * sappia dare, e rifarla a ogni giro di disegno buttava giu' la linea. La
 * regola nata li' e' «non si chiede: si ricorda», e chi ha i registri li lascia
 * scritti per chi verra' dopo.
 *
 * Dentro Home Assistant a lasciarli e' il pannello, che li ha per conto suo.
 * **Nell'app no**: li' l'unico che poteva averli era il guscio vecchio, e il
 * guscio li carica solo quando ha girato il rilevamento automatico — e il nome
 * del dispositivo non lo tiene affatto. Quindi sul telefono, a caricamento
 * pulito, l'avviso dei non connessi tornava a contare le entita' invece dei
 * dispositivi: la cosa che dal campo era stata chiesta due volte.
 *
 * Questo modulo chiude quel buco dalla parte giusta. I registri ce li ha gia'
 * il ponte, li ha gia' in mano, e glieli puo' passare senza che nessuno chieda
 * niente a Home Assistant una seconda volta.
 *
 * ─── Cinque minuti ───────────────────────────────────────────────────────
 *
 * Cambiano quando qualcuno aggiunge o ribattezza un apparecchio, cioe' quasi
 * mai, e chi li chiede lo fa spesso: il rapporto ogni minuto, e una plancia a
 * ogni caricamento. Cinque minuti e' il ritardo massimo con cui un dispositivo
 * appena ribattezzato si vede col nome nuovo, e nessuno ribattezza una presa
 * guardando il cronometro.
 *
 * ─── Cosa esce di qui ────────────────────────────────────────────────────
 *
 * Nomi di dispositivi e di entita', e di chi e' ognuna. **Nessuno stato**: che
 * cosa sta facendo quella presa adesso non e' roba di questo file, e non lo
 * diventa. E' la stessa riga che il rapporto tiene da sempre.
 */

const pulito = (valore) => (typeof valore === "string" ? valore.trim() : "");

/** Quanto si tengono da parte. Vedi l'intestazione. */
export const REGISTRI_DURANO = 5 * 60 * 1000;

/* I registri arrivano a elenco dal socket. Un dizionario lo accetta lo stesso:
 * costa una riga, e chi chiama non deve sapere che forma avevano. */
function elenco(valore) {
  if (Array.isArray(valore)) return valore;
  if (valore && typeof valore === "object") return Object.values(valore);
  return [];
}

/**
 * Le due mappe piatte che servono a chi disegna.
 *
 * `di` dice a chi appartiene un'entita', `nomi` come si chiama quel qualcuno.
 * Due e non una sola con dentro tutto: un dispositivo ha molte entita', e
 * ripetere il suo nome accanto a ognuna vorrebbe dire scrivere «Leapmotor B10»
 * quaranta volte.
 *
 * E' la stessa forma — e le stesse regole — di
 * `plancia/src/core/i-dispositivi-di-home-assistant.js`, che le legge: il nome
 * scritto da chi abita vince su quello di fabbrica, e un'entita' senza
 * dispositivo resta fuori perche' «non lo so» deve restare vuoto.
 */
export function leDueMappe({ dispositivi, entita } = {}) {
  const nomi = {};
  for (const dispositivo of elenco(dispositivi)) {
    const id = pulito(dispositivo?.id) || pulito(dispositivo?.device_id);
    if (!id) continue;
    const nome = pulito(dispositivo?.name_by_user) || pulito(dispositivo?.name);
    if (nome) nomi[id] = nome;
  }
  const di = {};
  for (const voce of elenco(entita)) {
    const id = pulito(voce?.entity_id);
    const suo = pulito(voce?.device_id);
    if (id && suo) di[id] = suo;
  }
  return { di, nomi };
}

/**
 * I registri di questa casa, uno solo per tutti quelli che li vogliono.
 *
 * Uno solo e non uno per chi chiede: due copie vorrebbero dire due letture
 * pesanti invece di una, e due momenti diversi in cui la casa si e' guardata.
 */
export class Registri {
  constructor({ casa, registro = null, adesso = () => Date.now() } = {}) {
    this.casa = casa;
    this.registro = registro;
    this.adesso = adesso;
    this._tenuti = null;
    this._lettiIl = 0;
    /* Una lettura per volta: il rapporto e una plancia che si apre nello
     * stesso istante sono due domande alla stessa cosa, e la seconda aspetta
     * la prima invece di aprirne un'altra. */
    this._inCorso = null;
  }

  /**
   * I due registri grezzi, come li da' Home Assistant.
   *
   * Uno dei due che non risponde li butta tutti e due: senza quello delle
   * entita' non si sa di chi e' un'entita', senza quello dei dispositivi non si
   * sa come si chiama un dispositivo, e mezza risposta darebbe nomi a meta'.
   * Chi chiama sa cavarsela senza, con i nomi delle entita'.
   */
  async chiedi() {
    const ora = this.adesso();
    if (this._tenuti && ora - this._lettiIl < REGISTRI_DURANO) return this._tenuti;
    if (this._inCorso) return this._inCorso;
    this._inCorso = (async () => {
      const [dispositivi, entita] = await Promise.all([
        this.casa.chiedi({ type: "config/device_registry/list" }),
        this.casa.chiedi({ type: "config/entity_registry/list" }),
      ]);
      this._tenuti = { dispositivi, entita };
      this._lettiIl = this.adesso();
      return this._tenuti;
    })();
    try {
      return await this._inCorso;
    } finally {
      this._inCorso = null;
    }
  }

  /** Le due mappe, per chi disegna. Vuote quando i registri non rispondono. */
  async leMappe() {
    try {
      return leDueMappe(await this.chiedi());
    } catch (errore) {
      this.registro?.debug?.(`i registri non si leggono: ${errore?.message || errore}`);
      return { di: {}, nomi: {} };
    }
  }

  /** Butta quello che c'e' da parte: la prossima domanda torna a chiedere. */
  dimentica() {
    this._tenuti = null;
    this._lettiIl = 0;
  }
}
