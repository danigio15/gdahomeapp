/* Il lavoro che il quadro chiede, e come va a finire.
 *
 * Sono **tre verbi**, e nessun altro: installare un aggiornamento che questa
 * casa ha gia' in attesa, riavviare Home Assistant, e riscrivere com'e' fatta
 * una plancia. Per un anno il primo e' stato disegnato e non costruito — nel
 * cruscotto c'era il tasto «Installa su N case» e non era agganciato a niente
 * — e il secondo stava solo nei documenti. Adesso ci sono tutti e tre, e
 * passano dalla stessa strada.
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
 * ─── I tre interruttori ──────────────────────────────────────────────────
 *
 * Mandare i numeri e lasciarsi aggiornare sono **due permessi**, e il secondo
 * e' spento di serie. Chi lo accende lo accende apposta, nella casella
 * «Casa · Lascia che chi ti ha fatto l'impianto aggiorni da lontano».
 *
 * Lasciarsi riscrivere la plancia e' un **terzo** permesso, a parte, con la
 * sua casella: installare un aggiornamento gia' in attesa e rimettere mano a
 * com'e' fatta la plancia di casa non sono la stessa fiducia, e un
 * interruttore solo li avrebbe legati per forza.
 *
 * Il controllo vero sta qui, in casa, e non nel quadro: il quadro il comando
 * non lo manda nemmeno, se il rapporto gli ha detto che la manutenzione e'
 * chiusa — ma quello e' garbo, non sicurezza. Se lo mandasse lo stesso, qui
 * si risponde di no. Vale uguale per la configurazione.
 *
 * ─── Cosa si accetta, e come si chiama quello che si installa ────────────
 *
 * Tre verbi, `installa`, `riavvia` e `configura`, e niente altro: non e' un
 * canale per comandi, sono quei tre comandi li'. Il riavvio e' di Home
 * Assistant tutto — `homeassistant.restart`, lo stesso che si preme da
 * Impostazioni — e non ha niente da nominare. Serve il giorno che
 * un'integrazione si impunta e chi ci abita non c'e': prima si telefonava a
 * casa per far premere un tasto. La configurazione nomina il profilo della
 * plancia, e il contenuto se lo va a prendere la casa dal quadro, per
 * identificativo: nella risposta al rapporto passa il nome della cosa da
 * fare, mai la cosa.
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

import { conIFlussiDiCasa, haFlussi, PLANCIA_MASSIMA, quantoPesa } from "./plancia-da-lontano.js";

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
    : comando.cosa === "configura"
      ? `configurazione della plancia «${comando.titolo || comando.nome}»`
      : `${comando.nome} ${comando.da} → ${comando.a}`.replace(/\s+/g, " ").trim();

export class Lavori {
  /**
   * @param {object} opzioni
   * @param {object} opzioni.aggiornamenti chi sa installare
   * @param {() => boolean} opzioni.aperta se la manutenzione e' aperta
   * @param {object|null} opzioni.plancia chi sa configurare la plancia da lontano:
   *   `aperta()` se la casa lo permette, `prendi(profilo, id)` per ritirare
   *   dal cruscotto quello che e' stato scritto, `scrivi(profilo, valori,
   *   opzioni)` per metterlo nella plancia, `titoloDi(profilo)` per chiamarla
   *   col suo nome. Senza, il terzo verbo si rifiuta.
   */
  constructor({
    aggiornamenti,
    registro = null,
    aperta = () => false,
    plancia = null,
    adesso = () => Date.now(),
  }) {
    this.aggiornamenti = aggiornamenti;
    this.plancia = plancia;
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
    const configura = comando.cosa === "configura";
    if (
      !comando.id ||
      (comando.cosa !== "installa" && !riavvio && !configura) ||
      (!riavvio && !comando.nome)
    ) {
      this.registro.attenzione(`il quadro ha chiesto qualcosa che non si capisce: ${comando.cosa}`);
      return;
    }
    /* Gia' fatto: la risposta a un rapporto puo' ripetersi — la casa riprova,
     * il quadro non ha fatto in tempo a segnarselo — e un tasto premuto una
     * volta non deve installare due volte. */
    if (this._lavoro?.id === comando.id) return;
    /* Il terzo verbo ha la sua casella, e non passa dalla manutenzione: il
     * perche' sta in cima a `plancia-da-lontano.js`. */
    if (configura) {
      await this._configura(comando);
      return;
    }
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
  /**
   * Configura la plancia come l'ha scritta l'installatore.
   *
   * Non e' un lavoro «in corso»: si ritira, si controlla, si scrive, e l'esito
   * e' subito quello — fatto o non riuscito — perche' non c'e' nessun Home
   * Assistant da aspettare. I no sono quattro, e si scrivono tutti nel
   * rapporto: la casella chiusa, una configurazione che non si e' potuta
   * ritirare, una che contiene un flusso, una che la plancia rifiuta (vuota
   * dove prima c'era qualcosa, o scritta su una revisione che in casa non c'e'
   * piu').
   */
  async _configura(comando) {
    const profilo = comando.nome;
    comando.titolo = pulito(this.plancia?.titoloDi?.(profilo) ?? "", 40);
    if (!this.plancia || !this.plancia.aperta?.()) {
      this.registro.attenzione(
        `il quadro ha chiesto di configurare la plancia «${profilo}», e questa casa non lo permette: non si fa`,
      );
      this._segna(comando, "non riuscito", "la configurazione da lontano e' chiusa in questa casa");
      return;
    }
    let chiesta = null;
    try {
      chiesta = await this.plancia.prendi(profilo, comando.id);
    } catch (errore) {
      this._segna(
        comando,
        "non riuscito",
        `la configurazione non si e' potuta ritirare dal cruscotto: ${errore?.message || errore}`,
      );
      this.registro.attenzione(
        `la configurazione della plancia non e' arrivata: ${errore?.message || errore}`,
      );
      return;
    }
    const valori = chiesta?.valori;
    if (!valori || typeof valori !== "object" || Array.isArray(valori)) {
      this._segna(comando, "non riuscito", "il cruscotto non aveva nessuna configurazione da dare");
      return;
    }
    if (quantoPesa(valori) > PLANCIA_MASSIMA) {
      this._segna(comando, "non riuscito", "quella configurazione e' troppo grande");
      return;
    }
    /* La regola che tiene in piedi il permesso: da lontano si sceglie quale
     * telecamera va dove, non dove sta il suo flusso. */
    if (haFlussi(valori)) {
      this._segna(
        comando,
        "non riuscito",
        "conteneva un indirizzo di flusso o un gettone, e da lontano quelli non si toccano",
      );
      this.registro.attenzione(
        `la configurazione della plancia «${profilo}» portava un flusso: rifiutata`,
      );
      return;
    }
    /* I flussi che da casa non sono partiti tornano al loro posto: il quadro
     * li ha sempre visti vuoti, e scriverli vuoti vorrebbe dire cancellare
     * l'indirizzo di ogni telecamera al primo salvataggio da lontano. */
    let daScrivere = valori;
    try {
      const correnti = this.plancia.correnti?.(profilo);
      if (correnti) daScrivere = conIFlussiDiCasa(valori, correnti);
    } catch (_errore) {
      daScrivere = valori;
    }
    let esito;
    try {
      esito = this.plancia.scrivi(profilo, daScrivere, {
        expected_revision: chiesta.revisioneAttesa ?? null,
        updated_at: this.adesso(),
      });
    } catch (errore) {
      this._segna(comando, "non riuscito", String(errore?.message || errore));
      return;
    }
    const stato = String(esito?.status || "");
    if (stato === "saved" || stato === "unchanged") {
      this._segna(comando, "fatto", stato === "unchanged" ? "era gia' cosi'" : "");
      this._lavoro.finitoIl = this.adesso();
      this.registro.info(`il quadro ha configurato la plancia «${comando.titolo || profilo}»`);
      return;
    }
    const perche =
      stato === "conflict"
        ? "la plancia e' cambiata in casa nel frattempo: si rilegge e si riprova"
        : stato === "refused-empty"
          ? "una plancia configurata non si svuota da lontano"
          : "la plancia non l'ha accettata";
    this._segna(comando, "non riuscito", perche);
    this.registro.attenzione(
      `la configurazione della plancia «${profilo}» non e' passata: ${perche}`,
    );
  }

  _segna(comando, stato, perche, stacca = false) {
    this._lavoro = {
      id: comando.id,
      cosa: comeSiChiama(comando),
      nome: comando.nome,
      da: comando.da,
      a: comando.a,
      riavvio: comando.cosa === "riavvia",
      configurazione: comando.cosa === "configura",
      stato,
      perche,
      stacca,
      quando: this.adesso(),
    };
  }
}
