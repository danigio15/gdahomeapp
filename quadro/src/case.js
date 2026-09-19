/* Le case che questo quadro segue.
 *
 * Di ognuna si tiene poco: l'ultimo rapporto, il giorno in cui e' arrivata la
 * prima, quello in cui il collaudo si e' chiuso, e **quanti rapporti sono
 * arrivati per ogni giorno** — che e' tutto quello che serve per disegnare la
 * striscia dei quattordici giorni.
 *
 * ─── Il nome sta qui, e ci resta ─────────────────────────────────────────
 *
 * «Rossi — via Verdi 12» dalla casa non arriva: lo scrive l'installatore, e
 * **e' l'unica cosa in tutto questo quadro che parli di una persona**. Sta
 * sulla sua macchina perche' con quella persona il contratto ce l'ha lui, e
 * non passa mai per nessun'altra parte: la casa non lo manda, non lo riceve e
 * non lo saprebbe leggere.
 *
 * ─── Il lavoro chiesto, e perche' sta qui ────────────────────────────────
 *
 * Quando l'installatore preme «Installa» su una casa, quel comando **aspetta
 * qui** finche' la casa non passa a prenderselo. Non si va a bussare a nessuno:
 * verso una casa non c'e' nessuna porta, ed e' il pezzo di questo progetto che
 * vale di piu' — la casa manda il rapporto ogni minuto, e nella risposta trova
 * cosa fare.
 *
 * Uno per casa e non una coda. Due aggiornamenti insieme su un impianto solo
 * vogliono dire non sapere quale dei due non e' tornato, ed e' la stessa regola
 * che il cruscotto scrive a chi lo guarda.
 *
 * ─── Perche' i giorni e non le ore ───────────────────────────────────────
 *
 * Tenere ogni rapporto vorrebbe dire novantasei righe al giorno per casa, e
 * su quaranta case quattromila righe al giorno per una striscia di quattordici
 * caselle. Si tiene un numero per giorno — quante ne sono arrivate — e la
 * striscia si ricava da quello: pieno se ne sono arrivate quasi tutte, a meta'
 * se qualcuna, vuoto se nessuna.
 */

import { join } from "node:path";

import { Archivio } from "./archivio.js";
import { collaudoChiuso, ilCollaudo, lePastiglie, loStato } from "./collaudo.js";

const GIORNO = 24 * 60 * 60 * 1000;

/* «Tutte quelle che ci sono, di chiunque siano.» La usa solo chi tiene il
 * quadro, per contarle; non e' un valore di serie da nessuna parte, cosi' una
 * chiamata che vede tutto si riconosce a occhio leggendo. */
export const TUTTE = Symbol("tutte le case, di chiunque");

/** Quanti giorni di storia si tengono. Come la striscia, piu' un po'. */
export const GIORNI_TENUTI = 21;

/** Quanti ne disegna la striscia. */
export const GIORNI_NELLA_STRISCIA = 14;

/* Quale frazione dei rapporti attesi in un giorno basta a chiamarlo pieno.
 * Non il cento per cento: un riavvio di Home Assistant, un aggiornamento, un
 * blackout di dieci minuti sono cose normali, e una striscia che si annerisce
 * a ogni riavvio non si guarda piu'. */
const BASTA_COSI = 0.75;

/* Quanto si tiene da parte un lavoro che nessuno viene a prendere.
 *
 * Una casa che parla manda un rapporto al minuto, quindi se in dieci minuti non
 * e' passata a prenderselo vuol dire che e' spenta, o che non arriva piu' fuori.
 * Tenerglielo li' per giorni vorrebbe dire un aggiornamento che parte da solo
 * la notte che quella casa torna su, quando chi l'ha chiesto se n'e'
 * dimenticato. Scaduto si butta, e se serve ancora si ripreme il tasto. */
export const UN_LAVORO_ASPETTA = 10 * 60 * 1000;

const ilGiorno = (quando) => new Date(quando).toISOString().slice(0, 10);

const testo = (valore, quanto = 120) =>
  String(valore ?? "")
    .trim()
    .slice(0, quanto);

export class CaseSeguite {
  constructor({ cartella = "./dati", adesso = () => Date.now() } = {}) {
    this.adesso = adesso;
    this.archivio = new Archivio(join(cartella, "case.json"), { case: [] });
  }

  get lista() {
    return this.archivio.dati.case;
  }

  quella(casa) {
    return this.lista.find((una) => una.casa === casa) ?? null;
  }

  /**
   * Un rapporto e' arrivata.
   *
   * Una matricola mai vista **nasce qui**, senza nome e in fila «collaudo
   * aperto»: e' il momento in cui una casa entra nel quadro, e chi l'ha
   * installata le da' un nome quando la vede comparire.
   */
  deposita(casa, carta, di = null) {
    const ora = this.adesso();
    let una = this.quella(casa);
    if (!una) {
      una = {
        casa,
        /* Di chi e' questa casa. Lo dice l'invito con cui e' entrata, e da qui
         * non si muove: e' quello che la fa comparire nella pagina di un
         * installatore e non in quella di un altro. */
        di,
        nome: "",
        da: ora,
        collaudataIl: null,
        vistaIl: ora,
        carta: null,
        giorni: {},
        /* Quando si e' mandato l'avviso che questa casa tace. E' il segno di
         * «di questa l'ho gia' detto»: si mette mandando, si toglie quando
         * torna a parlare. Senza, una casa muta da tre giorni sarebbe una
         * notizia a ogni giro invece che una sola volta. */
        avvisataIl: null,
        /* Il lavoro che aspetta di essere consegnato a questa casa, o `null`.
         * Ne sta uno per volta: il perche' e' in cima al file. */
        lavoro: null,
      };
      this.lista.push(una);
    }
    una.vistaIl = ora;
    una.carta = carta;

    /* La casa ha risposto di quel lavoro: da qui in poi lo stato lo racconta
     * lei, nel rapporto, e questo non serve piu'. Uno solo dei due lo puo'
     * sapere per davvero, ed e' quella che lo sta facendo. */
    if (una.lavoro && carta?.lavoro?.id === una.lavoro.id) una.lavoro = null;
    /* E quello che nessuno e' venuto a prendere scade: vedi `UN_LAVORO_ASPETTA`. */
    if (una.lavoro && ora - una.lavoro.chiesto > UN_LAVORO_ASPETTA) una.lavoro = null;
    una.giorni[ilGiorno(ora)] = (una.giorni[ilGiorno(ora)] || 0) + 1;

    /* Il collaudo si chiude una volta sola, il giorno in cui nessuna spunta e'
     * piu' aperta. Non si riapre: quello che si rompe dopo e' salute, non
     * collaudo, ed e' un'altra colonna. */
    if (!una.collaudataIl && collaudoChiuso(carta)) una.collaudataIl = ora;

    this._potaIGiorni(una, ora);
    this.archivio.salva();
    return una;
  }

  /* `di` e' un lucchetto, non un filtro: senza, l'installatore che scrivesse a
   * mano la matricola di una casa di un altro potrebbe rinominargliela. */
  rinomina(casa, nome, di) {
    const una = this.quella(casa);
    if (!una || (di !== TUTTE && una.di !== di)) return false;
    una.nome = String(nome ?? "")
      .trim()
      .slice(0, 80);
    this.archivio.salva();
    return true;
  }

  togli(casa, di) {
    const prima = this.lista.length;
    this.archivio.dati.case = this.lista.filter(
      (una) => !(una.casa === casa && (di === TUTTE || una.di === di)),
    );
    if (this.lista.length !== prima) this.archivio.salva();
    return this.lista.length !== prima;
  }

  /**
   * Quello che la console disegna, gia' deciso.
   *
   * Lo stato e le spunte si calcolano **qui** e non nella pagina: se le regole
   * stessero in tutt'e due i posti, il giorno che una cambia ne cambierebbe una
   * sola, e due schermi direbbero due cose diverse della stessa casa.
   */
  /* `di` non ha un valore di serie **apposta**: chiamarla senza vorrebbe dire
   * l'elenco di tutti, cioe' le case di installatori diversi mescolate in una pagina
   * sola. Chi ne ha davvero bisogno — chi tiene il quadro, per contarle — passa
   * `TUTTE`, e cosi' quella riga si vede leggendo. */
  elenco(di) {
    const ora = this.adesso();
    return this.lista
      .filter((una) => di === TUTTE || una.di === di)
      .map((una) => this.vestita(una, ora))
      .sort((una, altra) => {
        /* Prima quelle che chiedono qualcosa, e fra quelle prima le mute: chi
         * apre questa pagina la mattina vuole trovarsi in cima quello che gli
         * tocca, non l'ordine in cui le ha installate. */
        const peso = { muta: 0, guardare: 1, aperto: 2, posto: 3 };
        const differenza = peso[una.stato.chiave] - peso[altra.stato.chiave];
        if (differenza !== 0) return differenza;
        return (una.nome || una.casa).localeCompare(altra.nome || altra.casa);
      });
  }

  /**
   * L'installatore chiede a una casa di installare qualcosa.
   *
   * Si nomina per **nome e salto di versione**, non per entita': nel rapporto
   * l'entita' non c'e' — `update.camera_di_marco_termostato` direbbe chi abita
   * in quella casa e in quale stanza — e quindi qui non c'e' niente da
   * nominare se non quello che si e' visto. Il vantaggio viene gratis: se nel
   * frattempo quella versione e' gia' stata messa, il salto non torna e in casa
   * non si fa niente.
   *
   * `di` e' un lucchetto e non un filtro, come per `rinomina`: senza, chi
   * scrivesse a mano la matricola di una casa di un altro gliela aggiornerebbe.
   *
   * Torna il lavoro messo in attesa, o `null` se non si e' potuto.
   */
  chiediUnLavoro(casa, { nome, da, a } = {}, di) {
    const una = this.quella(casa);
    if (!una || (di !== TUTTE && una.di !== di)) return null;
    /* La casa deve aver aperto la manutenzione. E' garbo, non sicurezza: il no
     * che conta lo dice la casa, in `lavori.js`, e lo direbbe lo stesso. Ma
     * mettere in coda un comando che si sa gia' che verra' rifiutato vuol dire
     * far aspettare dieci minuti una risposta che e' gia' scritta. */
    if (una.carta?.manutenzione !== true) return null;
    const quale = { nome: testo(nome), da: testo(da, 40), a: testo(a, 40) };
    if (!quale.nome || !quale.a) return null;
    /* Uno per volta. Quello vecchio scaduto pero' non blocca niente: una casa
     * spenta da un'ora non deve impedire di richiedere la stessa cosa. */
    const ora = this.adesso();
    if (una.lavoro && ora - una.lavoro.chiesto <= UN_LAVORO_ASPETTA) return null;
    una.lavoro = {
      /* Un numero che non si ripete, e che serve a una cosa sola: far
       * riconoscere alla casa un comando che ha gia' fatto. La risposta a un
       * rapporto puo' arrivare due volte — la casa riprova, qui non si e' fatto
       * in tempo a segnarselo — e un tasto premuto una volta non deve
       * installare due volte. */
      id: `${ora.toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      cosa: "installa",
      ...quale,
      chiesto: ora,
      mandato: null,
    };
    this.archivio.salva();
    return { ...una.lavoro };
  }

  /**
   * Cosa dare a questa casa, adesso che e' passata.
   *
   * Si chiama rispondendo a un rapporto. Segna il momento in cui e' stato
   * consegnato: da li' in poi lo stato lo racconta la casa.
   */
  ilLavoroDa(casa) {
    const una = this.quella(casa);
    if (!una?.lavoro) return null;
    /* **Una volta sola**, e non «finche' la casa non conferma».
     *
     * Se una casa se lo porta via e poi non ne parla piu' — un ponte vecchio
     * che quella riga non la manda, un'installazione che porta giu' il
     * processo, e gdahome che aggiorna se stesso fa proprio questo — riofrirlo
     * al rapporto dopo vorrebbe dire rifarlo partire ogni minuto. La casa si
     * difende da sola riconoscendo l'`id`, ma quella memoria muore col
     * processo, ed e' il processo che si sta aggiornando.
     *
     * Il costo, detto: se la risposta si perde per strada, quel comando non
     * arriva e non arrivera'. Chi l'ha chiesto ripreme il tasto, e non succede
     * niente di irreparabile. L'altro verso non e' cosi'. */
    if (una.lavoro.mandato) return null;
    const ora = this.adesso();
    if (ora - una.lavoro.chiesto > UN_LAVORO_ASPETTA) {
      una.lavoro = null;
      this.archivio.salva();
      return null;
    }
    una.lavoro.mandato = ora;
    this.archivio.salva();
    const { id, cosa, nome, da, a } = una.lavoro;
    return { id, cosa, nome, da, a };
  }

  /** L'installatore ci ripensa, prima che la casa passi a prenderselo. */
  annullaIlLavoro(casa, di) {
    const una = this.quella(casa);
    if (!una || (di !== TUTTE && una.di !== di) || !una.lavoro) return false;
    una.lavoro = null;
    this.archivio.salva();
    return true;
  }

  /** Segna che di questa si e' parlato, o che non se ne parla piu'. */
  segnaAvvisata(casa, quando) {
    const una = this.quella(casa);
    if (!una) return false;
    una.avvisataIl = quando;
    this.archivio.salva();
    return true;
  }

  /** Quante ne segue uno. E' il numero su cui si misura il suo limite. */
  quante(di) {
    return this.lista.filter((una) => una.di === di).length;
  }

  /**
   * Le case rimaste senza nessuno che le guardi.
   *
   * Quando un installatore si toglie, i suoi impianti **restano**: sono impianti che
   * funzionano in casa di qualcuno, e spegnerne il monitoraggio perche' chi
   * li ha messi ha smesso di pagare punirebbe il cliente per una faccenda che
   * non e' sua. I loro rapporti continuano ad arrivare.
   *
   * Ma restare invisibili sarebbe un'altra cosa: chi tiene il quadro vedrebbe
   * un totale che non torna con la somma degli installatori e non saprebbe perche'.
   * Questo numero e' li' per quello — e per ritrovarli il giorno che lo si
   * riaggiunge.
   */
  orfane(conosciuti = []) {
    const chi = new Set(conosciuti);
    return this.lista.filter((una) => !una.di || !chi.has(una.di)).length;
  }

  vestita(una, ora = this.adesso()) {
    const carta = una.carta;
    return {
      casa: una.casa,
      /* Senza nome si mostra la matricola accorciata: un elenco di righe vuote
       * e' peggio di un elenco di numeri. */
      nome: una.nome || `${una.casa.slice(0, 13)}…`,
      senzaNome: !una.nome,
      da: una.da,
      collaudataIl: una.collaudataIl,
      vistaIl: una.vistaIl,
      giorni: this.striscia(una, ora),
      carta,
      stato: loStato(una, ora),
      collaudo: carta ? ilCollaudo(carta) : null,
      pastiglie: carta ? lePastiglie(carta) : [],
      /* Quello che e' stato chiesto e che questa casa non e' ancora passata a
       * prendere. Sta **fuori** dalla carta apposta: la carta e' quello che la
       * casa ha detto, e questo e' quello che le si sta per dire. Mescolarli
       * vorrebbe dire una pagina che non distingue piu' fra «l'ho chiesto» e
       * «sta succedendo». */
      chiesto: una.lavoro && !una.lavoro.mandato ? { ...una.lavoro } : null,
    };
  }

  /**
   * La striscia dei quattordici giorni, come stringa.
   *
   * `P` giorno pieno, `M` a meta', `V` muta, spazio «non c'era ancora». Una
   * stringa e non un elenco di oggetti perche' cosi' si legge anche nel
   * registro e in una risposta guardata a occhio, e perche' quattordici
   * caratteri sono quattordici caratteri.
   */
  striscia(una, ora = this.adesso()) {
    const ogni = Number(una.carta?.ogni) || 15;
    let fuori = "";
    for (let i = GIORNI_NELLA_STRISCIA - 1; i >= 0; i -= 1) {
      const quando = ora - i * GIORNO;
      const giorno = ilGiorno(quando);
      /* Un giorno in cui questa casa non esisteva non si giudica: era rosso, e
       * una casa accesa ieri sembrava rotta da due settimane. Si confrontano i
       * **giorni**, non gli istanti: una casa accesa ieri alle undici non ha
       * un ieri a meta'. */
      if (giorno < ilGiorno(una.da)) {
        fuori += " ";
        continue;
      }
      /* Quante ne sarebbero potute arrivare **davvero** in questo giorno: non
       * ventiquattro ore sempre, ma il pezzo di giornata in cui questa casa
       * era gia' accesa e non e' ancora finita. Senza, il giorno in cui una
       * casa si accende e quello in corso sono sempre rossi. */
      const inizio = Math.max(Date.parse(`${giorno}T00:00:00Z`), una.da);
      const fine = Math.min(Date.parse(`${giorno}T00:00:00Z`) + GIORNO, ora);
      const attese = Math.max(1, Math.round((fine - inizio) / (ogni * 60 * 1000)));
      const quante = una.giorni[giorno] || 0;
      fuori += quante >= attese * BASTA_COSI ? "P" : quante > 0 ? "M" : "V";
    }
    return fuori;
  }

  _potaIGiorni(una, ora) {
    const limite = ilGiorno(ora - GIORNI_TENUTI * GIORNO);
    for (const giorno of Object.keys(una.giorni)) {
      if (giorno < limite) delete una.giorni[giorno];
    }
  }
}
