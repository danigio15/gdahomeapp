/* Il lavoro che il quadro chiede, e come va a finire.
 *
 * Sono **due verbi**, e nessun altro: installare un aggiornamento che questa
 * casa ha gia' in attesa, e riavviare Home Assistant. Per un anno il primo e'
 * stato disegnato e non costruito — nel cruscotto c'era il tasto «Installa su
 * N case» e non era agganciato a niente — e il secondo stava solo nei
 * documenti. Adesso ci sono tutt'e due, e passano dalla stessa strada.
 *
 * ─── Da dove arriva il comando ───────────────────────────────────────────
 *
 * **Dalla risposta a un rapporto**, e non da una porta aperta.
 *
 * E' la differenza fra un impianto che si lascia guardare e uno che si lascia
 * entrare. Una porta aperta verso il quadro vorrebbe dire una casa che accetta
 * connessioni da fuori, un buco nel router, un indirizzo da difendere e
 * qualcosa da tenere aggiornato per sempre. Qui non si apre niente: la casa
 * bussa lei, ogni minuto, e nella risposta trova — qualche volta — una riga
 * che dice cosa fare. Chi non bussa non riceve niente, e chi stacca il codice
 * smette di bussare.
 *
 * Il ritardo e' quello del rapporto, un minuto, e va bene cosi': un
 * aggiornamento non e' un interruttore della luce.
 *
 * ─── I due interruttori ──────────────────────────────────────────────────
 *
 * Mandare i numeri e lasciarsi aggiornare sono **due permessi**, e il secondo
 * e' spento di serie. Chi lo accende lo accende apposta, nella casella
 * «Casa · Lascia che chi ti ha fatto l'impianto aggiorni da lontano».
 *
 * Il controllo vero sta qui, in casa, e non nel quadro: il quadro il comando
 * non lo manda nemmeno, se il rapporto gli ha detto che la manutenzione e'
 * chiusa — ma quello e' garbo, non sicurezza. Se lo mandasse lo stesso, qui
 * si risponde di no.
 *
 * ─── Cosa si accetta, e come si chiama quello che si installa ────────────
 *
 * Due verbi, `installa` e `riavvia`, e niente altro: non e' un canale per
 * comandi, sono quei due comandi li'. Il riavvio e' di Home Assistant tutto —
 * `homeassistant.restart`, lo stesso che si preme da Impostazioni — e non ha
 * niente da nominare. Serve il giorno che un'integrazione si impunta e chi ci
 * abita non c'e': prima si telefonava a casa per far premere un tasto.
 *
 * E si nomina per **nome e salto di versione** — «Shelly Plus», da `1.2.0` a
 * `1.3.0` — non per entita'. Non e' un giro storto: l'entita' nel rapporto non
 * ci va, perche' `update.camera_di_marco_termostato` direbbe chi abita in
 * questa casa e in quale stanza dorme. Il quadro nomina quello che ha visto, e
 * qui si ritrova a chi corrisponde.
 *
 * Ha anche un effetto che vale da solo: se nel frattempo quella versione e'
 * gia' stata installata, o ne e' uscita un'altra, il salto non torna piu' e il
 * comando **non si esegue**. Un tasto premuto ieri non installa una cosa
 * diversa oggi.
 */

/* Dopo quanto un lavoro che non finisce si smette di chiamare «in corso».
 *
 * Un add-on grosso ci mette minuti, Home Assistant Core anche di piu', e un
 * riavvio in mezzo fa perdere il filo. Un'ora e' larga apposta: quello che si
 * vuole evitare non e' un'attesa lunga, e' una riga che resta «in corso» per
 * sempre e che nessuno sa piu' se guardare o no. */
export const TROPPO_TEMPO = 60 * 60 * 1000;

/* Dopo quanto un riavvio si puo' dire fatto.
 *
 * Home Assistant non dice «sono tornato»: si spegne, il filo cade, e a un
 * certo punto risponde di nuovo. Un elenco degli aggiornamenti letto **dopo**
 * questo tempo e' la prova che e' tornato — letto prima potrebbe essere la
 * risposta di uno che non si e' ancora spento. */
export const UN_RIAVVIO_CI_METTE = 45 * 1000;

/** Quanto lunga puo' essere una stringa che arriva dal quadro. */
const LUNGHEZZA_MASSIMA = 120;

const pulito = (valore, quanto = LUNGHEZZA_MASSIMA) =>
  String(valore ?? "")
    .trim()
    .slice(0, quanto);

/* Come si scrive un lavoro perche' si legga in una riga sola, nel quadro e
 * nella console dell'add-on. */
const comeSiChiama = (comando) =>
  comando.cosa === "riavvia"
    ? "riavvio di Home Assistant"
    : `${comando.nome} ${comando.da} → ${comando.a}`.replace(/\s+/g, " ").trim();

export class Lavori {
  /**
   * @param {object} opzioni
   * @param {object} opzioni.aggiornamenti chi sa installare
   * @param {() => boolean} opzioni.aperta se la manutenzione e' aperta
   */
  constructor({ aggiornamenti, registro = null, aperta = () => false, adesso = () => Date.now() }) {
    this.aggiornamenti = aggiornamenti;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.aperta = aperta;
    this.adesso = adesso;
    /* L'ultimo lavoro, e uno solo.
     *
     * Non una coda: due aggiornamenti insieme su una casa sola vogliono dire
     * non sapere quale dei due non e' tornato, ed e' la stessa regola che il
     * cruscotto scrive a chi lo guarda. */
    this._lavoro = null;
  }

  /**
   * Fa quello che il quadro ha chiesto.
   *
   * Non solleva mai: un comando storto, una manutenzione chiusa o un
   * aggiornamento che non c'e' piu' sono **risposte**, e vanno a finire nel
   * rapporto del minuto dopo — dove le legge chi ha premuto il tasto, e dove
   * le rilegge chi ci abita.
   *
   * @param {object} detto quello che il quadro ha messo nella risposta
   */
  async fai(detto) {
    const comando = {
      id: pulito(detto?.id, 60),
      cosa: pulito(detto?.cosa, 20),
      nome: pulito(detto?.nome),
      da: pulito(detto?.da, 40),
      a: pulito(detto?.a, 40),
    };
    const riavvio = comando.cosa === "riavvia";
    if (!comando.id || (comando.cosa !== "installa" && !riavvio) || (!riavvio && !comando.nome)) {
      this.registro.attenzione(`il quadro ha chiesto qualcosa che non si capisce: ${comando.cosa}`);
      return;
    }
    /* Gia' fatto: la risposta a un rapporto puo' ripetersi — la casa riprova,
     * il quadro non ha fatto in tempo a segnarselo — e un tasto premuto una
     * volta non deve installare due volte. */
    if (this._lavoro?.id === comando.id) return;

    if (!this.aperta()) {
      /* Il quadro non dovrebbe nemmeno averlo mandato. Se lo manda lo stesso,
       * qui si dice di no e si scrive perche': una casa che rifiuta in
       * silenzio e' una casa che sembra rotta. */
      this.registro.attenzione(
        `il quadro ha chiesto di ${riavvio ? "riavviare" : "installare qualcosa"}, e la manutenzione e' chiusa: non si fa`,
      );
      this._segna(comando, "non riuscito", "la manutenzione di questa casa e' chiusa");
      return;
    }

    if (riavvio) {
      /* Il filo cade di sicuro: e' Home Assistant che si spegne, e il ponte
       * con lui. `riavvia` lo sa e non aspetta una risposta che non arriva.
       * «In corso» finche' la casa non risponde di nuovo: vedi `stato`. */
      try {
        await this.aggiornamenti.riavvia();
        this._segna(comando, "in corso", "", true);
        this.registro.info(
          "il quadro ha chiesto di riavviare Home Assistant: il filo cade, e torna da solo",
        );
      } catch (errore) {
        this._segna(comando, "non riuscito", String(errore?.message || errore));
        this.registro.attenzione(`il riavvio non e' partito: ${errore?.message || errore}`);
      }
      return;
    }

    let fila = [];
    try {
      fila = await this.aggiornamenti.elenco({ forza: true });
    } catch (errore) {
      this._segna(comando, "non riuscito", `non si e' potuto leggere cosa c'e' da fare`);
      this.registro.attenzione(`il lavoro non parte: ${errore?.message || errore}`);
      return;
    }

    const quale = fila.find(
      (uno) => uno.nome === comando.nome && uno.da === comando.da && uno.a === comando.a,
    );
    if (!quale) {
      /* Il salto non torna piu': o e' gia' stato installato, o ne e' uscita
       * un'altra versione. In tutt'e due i casi il tasto premuto prima non
       * vale per quello che c'e' adesso. */
      this._segna(comando, "non riuscito", "quel salto di versione qui non c'e' piu'");
      this.registro.info(`il quadro ha chiesto «${comeSiChiama(comando)}», che qui non c'e' piu'`);
      return;
    }

    try {
      const andata = await this.aggiornamenti.installa(quale.entita);
      this._segna(comando, "in corso", "", quale.stacca === true);
      this.registro.info(
        `il quadro ha chiesto di installare «${comeSiChiama(comando)}»${
          andata?.gia ? ", che era gia' partito" : ""
        }${quale.stacca ? ": il filo cade, e torna da solo" : ""}`,
      );
    } catch (errore) {
      this._segna(comando, "non riuscito", String(errore?.message || errore));
      this.registro.attenzione(`il lavoro non e' partito: ${errore?.message || errore}`);
    }
  }

  /**
   * Com'e' andata, per il rapporto.
   *
   * Si ricalcola ogni volta dall'elenco di adesso, invece di tenersi uno stato
   * che qualcuno deve ricordarsi di aggiornare: un aggiornamento **sparito
   * dall'elenco e' un aggiornamento fatto**, e non c'e' niente di piu' vero di
   * cosi' che il ponte possa sapere. Home Assistant non dice «ho finito»;
   * dice, al giro dopo, che quella versione non manca piu'.
   *
   * @param {Array} daFare l'elenco di adesso, o `null` se non si e' potuto leggere
   */
  stato(daFare) {
    if (!this._lavoro) return null;
    const lavoro = this._lavoro;
    if (lavoro.stato !== "in corso") return { ...lavoro };
    /* Senza elenco non si giudica: una casa con Home Assistant giu' non ha
     * finito niente, e dire «fatto» sarebbe la bugia piu' comoda. */
    if (!Array.isArray(daFare)) return { ...lavoro };
    /* Un riavvio e' fatto quando Home Assistant risponde di nuovo — e questo
     * elenco e' una risposta sua — passato il tempo che ci mette a spegnersi.
     * Prima di quel tempo potrebbe essere l'ultima risposta di uno che sta
     * ancora chiudendo. */
    if (lavoro.riavvio) {
      if (this.adesso() - lavoro.quando > UN_RIAVVIO_CI_METTE) {
        this._lavoro = { ...lavoro, stato: "fatto", finitoIl: this.adesso() };
        this.registro.info(`fatto: ${lavoro.cosa}`);
        return { ...this._lavoro };
      }
      return { ...lavoro };
    }
    const ancora = daFare.some(
      (uno) => uno.nome === lavoro.nome && uno.da === lavoro.da && uno.a === lavoro.a,
    );
    if (!ancora) {
      this._lavoro = { ...lavoro, stato: "fatto", finitoIl: this.adesso() };
      this.registro.info(`fatto: ${lavoro.cosa}`);
      return { ...this._lavoro };
    }
    if (this.adesso() - lavoro.quando > TROPPO_TEMPO) {
      this._lavoro = {
        ...lavoro,
        stato: "non riuscito",
        perche: "ci ha messo troppo: quella versione manca ancora",
        finitoIl: this.adesso(),
      };
      this.registro.attenzione(`il lavoro non e' arrivato in fondo: ${lavoro.cosa}`);
      return { ...this._lavoro };
    }
    return { ...lavoro };
  }

  /* `stacca` e' l'unica cosa che il quadro non puo' dedurre da solo e che
   * cambia cosa deve leggere chi guarda: gdahome e Home Assistant, mentre si
   * installano, fanno **cadere il filo**. Detto prima e' un'attesa; non detto
   * e' una casa che sembra morta. */
  _segna(comando, stato, perche, stacca = false) {
    this._lavoro = {
      id: comando.id,
      cosa: comeSiChiama(comando),
      nome: comando.nome,
      da: comando.da,
      a: comando.a,
      riavvio: comando.cosa === "riavvia",
      stato,
      perche,
      stacca,
      quando: this.adesso(),
    };
  }
}
