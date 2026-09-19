/* La voce «Cruscotto» nella barra laterale di chi installa.
 *
 * Chi monta gdahome in quaranta case un Home Assistant ce l'ha **suo**, e da
 * li' vuole arrivare ai suoi impianti senza aprire un altro posto. Questo file
 * e' la riga che lo dice a Home Assistant.
 *
 * ─── Perche' lo dice il ponte e non l'integrazione ────────────────────────
 *
 * Perche' l'interruttore sta nella scheda dell'add-on — `installatore` — e
 * l'indirizzo del quadro sta scritto nel ponte (`QUADRO_DI_DIFETTO`).
 * L'integrazione nessuna delle due cose la sa, e non parla ne' col Supervisor
 * ne' con l'add-on. Chiederle di scoprirlo vorrebbe dire o un secondo
 * interruttore nelle sue opzioni, o un canale nuovo verso il Supervisor: nel
 * primo caso due posti da tenere d'accordo, nel secondo una dipendenza che si
 * rompe dove il Supervisor non c'e'.
 *
 * Cosi' invece la catena e' corta e ha un capo solo: chi amministra accende
 * l'interruttore, il ponte lo legge e lo dice, l'integrazione appende la voce.
 *
 * ─── E perche' si riprova ─────────────────────────────────────────────────
 *
 * All'accensione dell'add-on Home Assistant sta spesso ancora partendo, e
 * l'integrazione i suoi comandi non li ha ancora registrati: la prima volta
 * torna «comando sconosciuto». Aspettare qui vorrebbe dire tenere giu' il
 * ponte per una voce di menu; non riprovare vorrebbe dire una voce che compare
 * solo al riavvio dopo, cioe' un installatore che accende l'interruttore, non
 * vede niente e pensa che sia rotto.
 */

/** Il comando dell'integrazione. */
export const COMANDO = "dashboardmodern/cruscotto/set";

/** Quanto si aspetta fra un tentativo e l'altro, in millisecondi. */
export const ATTESE = [20_000, 60_000, 300_000];

/* L'attesa fra un tentativo e l'altro.
 *
 * `unref` e' voluto: un ritentativo in coda non deve tenere sveglio l'add-on
 * che si sta spegnendo. Costa pero' che sotto le prove il giro finisca prima
 * della promessa — «Promise resolution is still pending but the event loop has
 * already resolved» — e per questo si puo' sostituire dal di fuori invece di
 * togliere dal codice vero una cosa che al codice vero serve. */
const ASPETTA = (quanto) =>
  new Promise((ok) => {
    const giro = setTimeout(ok, quanto);
    giro.unref?.();
  });

export class VoceDelCruscotto {
  constructor({ casa, installatore = false, dove = "", registro, aspetta = ASPETTA } = {}) {
    this.casa = casa;
    this.installatore = Boolean(installatore);
    this.dove = String(dove || "");
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.aspetta = aspetta;
    this._fermo = false;
  }

  /**
   * Lo dice una volta. Torna `{fatto, perche}`.
   *
   * Spegnere l'interruttore si dice **lo stesso**, e non e' uno spreco: e'
   * l'unico modo perche' la voce sparisca subito invece che al riavvio dopo.
   */
  async dillo() {
    if (!this.casa?.chiedi) return { fatto: false, perche: "non c'e' nessuno a cui dirlo" };
    try {
      const detto = await this.casa.chiedi({
        type: COMANDO,
        installatore: this.installatore,
        dove: this.installatore ? this.dove : "",
      });
      if (detto?.success === false) {
        return { fatto: false, perche: detto?.error?.message || "l'integrazione ha detto di no" };
      }
      return { fatto: true, perche: "" };
    } catch (errore) {
      return { fatto: false, perche: errore?.message || String(errore) };
    }
  }

  /**
   * Lo dice, e se non attecchisce riprova con calma.
   *
   * Non si aspetta il suo esito per accendere il ponte: una voce di menu non
   * vale il ritardo di tutto il resto.
   */
  async dilloConCalma(attese = ATTESE) {
    let esito = await this.dillo();
    if (esito.fatto) {
      this.registro.info(
        this.installatore
          ? "la voce «Cruscotto» e' nella barra laterale di Home Assistant"
          : "la voce «Cruscotto» non c'e', come chiede la scheda",
      );
      return esito;
    }
    for (const quanto of attese) {
      if (this._fermo) return esito;
      await this.aspetta(quanto);
      if (this._fermo) return esito;
      esito = await this.dillo();
      if (esito.fatto) {
        this.registro.info("la voce «Cruscotto» c'e', al secondo tentativo");
        return esito;
      }
    }
    /* Detto una volta sola, e senza allarmare: un add-on installato senza
     * l'integrazione e' un caso che esiste, e li' questo comando non
     * risponde mai. Non e' un guasto del ponte, e non deve sembrarlo. */
    this.registro.attenzione(
      `non sono riuscito a mettere la voce «Cruscotto» nella barra laterale: ${esito.perche}`,
    );
    return esito;
  }

  ferma() {
    this._fermo = true;
  }
}
