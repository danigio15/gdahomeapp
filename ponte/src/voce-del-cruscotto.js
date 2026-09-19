/* La voce «Cruscotto installatore» nella barra laterale di chi installa.
 *
 * Chi monta gdahome in quaranta case un Home Assistant ce l'ha **suo**, e da
 * li' vuole arrivare ai suoi impianti senza aprire un altro posto.
 *
 * ─── Perche' la fa il ponte, e non l'integrazione ─────────────────────────
 *
 * Una stesura di questo pezzo la faceva registrare all'integrazione, con un
 * comando WebSocket suo: sembrava il posto giusto, perche' i pannelli della
 * barra laterale li registrano le integrazioni. Era sbagliato, e il motivo non
 * era tecnico: **l'integrazione non arriva piu' nelle case**. La repository da
 * cui si installava non esiste piu', la plancia arriva dall'add-on, e quello
 * che la plancia chiedeva all'integrazione lo fa il ponte. Quel codice non
 * faceva danno — era inerte — e non lo vedeva nessuno.
 *
 * Il ponte invece nella barra laterale ci scrive gia': le Plance le mette li'
 * lui, con `lovelace/dashboards/create`. Una plancia di Lovelace **e'** una
 * voce nella barra laterale, e dentro ci si mette quello che si vuole. Qui ci
 * va una tessera `iframe` col cruscotto vero.
 *
 * ─── Perche' non una copia del cruscotto ──────────────────────────────────
 *
 * Perche' sarebbe un terzo posto dove vivono le stesse regole — cos'e' un
 * impianto muto, quando un collaudo e' chiuso — e tre posti che dicono la
 * stessa cosa prima o poi ne dicono tre diverse. Qui si mostra quello che
 * esiste gia'.
 *
 * ─── E perche' si riprova ─────────────────────────────────────────────────
 *
 * All'accensione dell'add-on Home Assistant sta spesso ancora partendo, e i
 * comandi di Lovelace arrivano a nessuno. Aspettare qui vorrebbe dire tenere
 * giu' il ponte per una voce di menu; non riprovare vorrebbe dire una voce che
 * compare solo al riavvio dopo, cioe' un installatore che accende
 * l'interruttore, non vede niente e pensa che sia rotto. E' lo stesso motivo,
 * e la stessa cura, delle Plance in `plance-in-casa.js`.
 */

/** Dove sta, nella barra laterale. Home Assistant vuole un trattino dentro. */
export const DOVE = "gdahome-cruscotto";

/** Come si chiama, e con che segno. */
export const TITOLO = "Cruscotto installatore";
export const SEGNO = "mdi:gauge";

/** Quanto si aspetta fra un tentativo e l'altro, in millisecondi. */
export const ATTESE = [20_000, 60_000, 300_000];

/* L'attesa fra un tentativo e l'altro.
 *
 * `unref` e' voluto: un ritentativo in coda non deve tenere sveglio l'add-on
 * che si sta spegnendo. Costa pero' che sotto le prove il giro finisca prima
 * della promessa, e per questo si puo' sostituire dal di fuori invece di
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
   * La pagina che sta dentro la voce: una sola, a pagina intera, col cruscotto.
   *
   * `panel: true` e non una griglia: il cruscotto e' una pagina, e dentro una
   * colonna larga quattrocento punti sarebbe illeggibile.
   */
  vista() {
    return {
      views: [
        {
          title: TITOLO,
          panel: true,
          cards: [{ type: "iframe", url: this.dove, aspect_ratio: "100%" }],
        },
      ],
    };
  }

  /** Quella che c'e' gia', se c'e'. */
  async quellaCheCE() {
    const dentro = await this.casa.chiedi({ type: "lovelace/dashboards/list" });
    const elenco = Array.isArray(dentro) ? dentro : [];
    return elenco.find((una) => String(una?.url_path) === DOVE) ?? null;
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
      const sua = await this.quellaCheCE();
      if (!this.installatore) {
        if (sua)
          await this.casa.chiedi({ type: "lovelace/dashboards/delete", dashboard_id: sua.id });
        return { fatto: true, perche: "" };
      }
      if (!this.dove.startsWith("https://")) {
        return { fatto: false, perche: "l'indirizzo del quadro non e' https" };
      }
      if (!sua) {
        await this.casa.chiedi({
          type: "lovelace/dashboards/create",
          url_path: DOVE,
          title: TITOLO,
          icon: SEGNO,
          show_in_sidebar: true,
          /* Solo chi amministra: questa voce porta agli impianti dei clienti
           * di qualcuno, e Home Assistant in casa lo aprono anche i
           * familiari. */
          require_admin: true,
        });
      } else if (String(sua.title || "") !== TITOLO || !sua.require_admin) {
        await this.casa.chiedi({
          type: "lovelace/dashboards/update",
          dashboard_id: sua.id,
          title: TITOLO,
          require_admin: true,
        });
      }
      await this.laVista();
      return { fatto: true, perche: "" };
    } catch (errore) {
      return { fatto: false, perche: errore?.message || String(errore) };
    }
  }

  /**
   * La pagina, scritta **solo se e' cambiata**.
   *
   * Non e' per risparmiare una scrittura: salvare la configurazione di una
   * plancia manda a tutte le pagine aperte di Home Assistant un
   * `lovelace_updated`, e quelle si ridisegnano. Senza questo controllo ogni
   * riavvio dell'add-on farebbe lampeggiare il cruscotto sotto gli occhi di
   * chi lo stava guardando, per riscriverci dentro la stessa cosa.
   */
  async laVista() {
    const voluta = this.vista();
    let dentro = null;
    try {
      dentro = await this.casa.chiedi({ type: "lovelace/config", url_path: DOVE });
    } catch (_errore) {
      dentro = null;
    }
    if (dentro && JSON.stringify(dentro) === JSON.stringify(voluta)) return "c'era";
    await this.casa.chiedi({
      type: "lovelace/config/save",
      url_path: DOVE,
      config: voluta,
    });
    return dentro ? "riscritta" : "scritta";
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
          ? `la voce «${TITOLO}» e' nella barra laterale di Home Assistant`
          : `la voce «${TITOLO}» non c'e', come chiede la scheda`,
      );
      return esito;
    }
    for (const quanto of attese) {
      if (this._fermo) return esito;
      await this.aspetta(quanto);
      if (this._fermo) return esito;
      esito = await this.dillo();
      if (esito.fatto) {
        this.registro.info(`la voce «${TITOLO}» c'e', al secondo tentativo`);
        return esito;
      }
    }
    this.registro.attenzione(
      `non sono riuscito a mettere la voce «${TITOLO}» nella barra laterale: ${esito.perche}`,
    );
    return esito;
  }

  ferma() {
    this._fermo = true;
  }
}
