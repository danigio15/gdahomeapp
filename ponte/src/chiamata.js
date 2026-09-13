/* La chiamata: il filo che il ponte apre verso il centralino, e tiene aperto.
 *
 * E' il verso girato. Il ponte non aspetta piu' che qualcuno lo trovi: va lui,
 * e resta li'. Chi installa l'add-on non apre nessuna porta, non ha bisogno di
 * un indirizzo pubblico, e non installa niente.
 *
 * Su questo filo solo passano tutti i telefoni di questa casa, uno per canale.
 * Ognuno si presenta al ponte come una presa qualunque — vedi `canale.js` — e
 * per il resto del ponte non c'e' nessuna differenza fra un telefono arrivato
 * da qui e uno arrivato dalla porta di casa.
 *
 * ─── Un rifiuto non e' una caduta ─────────────────────────────────────────
 *
 * Un filo cade in continuazione: la rete di casa, il centralino che si
 * riavvia, il router notturno. Si ribussa, con l'attesa che raddoppia, per
 * sempre. Ma se il centralino dice **«non ti riconosco»** quello non e' una
 * caduta: e' una risposta, non passera' col tempo, e ribussare all'infinito
 * vorrebbe dire nascondere un guasto che va invece scritto e guardato.
 *
 * ─── Il battito, e perche' senza non funzionava ───────────────────────────
 *
 * Un filo che cade lo si sente: arriva una chiusura, e si ribussa. Un filo che
 * **muore senza cadere** no. Fra questa casa e il centralino c'e' un router, e
 * un router tiene le sue corrispondenze finche' passa qualcosa: dopo qualche
 * minuto di silenzio quella riga sparisce dalla sua tabella, i pacchetti non
 * tornano piu' indietro, e nessuno dei due capi riceve niente da cui
 * accorgersene. Il ponte resta convinto d'essere collegato, il centralino
 * scrive in un buco, e da fuori casa l'app non entra piu' — finche' qualcuno
 * non va a riavviare l'add-on.
 *
 * Percio' si batte. Ogni mezzo minuto parte un colpetto e si aspetta la
 * risposta; se non arriva entro un minuto e mezzo, quel filo e' morto anche se
 * sembra aperto, e lo si chiude per ribussare. Deve farlo **questo** lato: e'
 * quello dietro il router, ed e' l'unico che possa richiamare. E costa niente
 * anche al centralino sulla nuvola, che risponde da solo senza svegliarsi —
 * vedi `nuvola/src/casa.js`.
 *
 * Con un centralino vecchio, che ai colpetti non risponde, non si butta giu'
 * niente: si scrive una volta che quel filo non si puo' sorvegliare, e si va
 * avanti come prima. Un ponte aggiornato accanto a un centralino da
 * aggiornare deve funzionare come funzionava, non peggio.
 */

import { Canale } from "./canale.js";
import { Chiamante } from "./chiamante.js";

const SECONDO = 1000;

/* Oltre questa non si aspetta di piu' fra un tentativo e l'altro. */
const ATTESA_MASSIMA = 60 * SECONDO;

/* Quanto si aspetta che il centralino risponda alla presentazione. */
const ATTESA_DELLA_PRESENTAZIONE = 20 * SECONDO;

/* Ogni quanto parte un colpetto, e dopo quanto silenzio il filo si considera
 * morto. Il secondo e' il triplo del primo: due colpetti persi capitano, tre
 * di fila no. */
const BATTITO = 30 * SECONDO;
const SILENZIO_MASSIMO = 90 * SECONDO;

export class Chiamata {
  constructor({
    dove,
    identita,
    portiere,
    registro,
    Presa = Chiamante,
    attesaMassima = ATTESA_MASSIMA,
    battito = BATTITO,
    silenzioMassimo = SILENZIO_MASSIMO,
  }) {
    this.dove = String(dove || "").replace(/\/+$/, "");
    this.identita = identita;
    this.portiere = portiere;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.Presa = Presa;
    this.attesaMassima = attesaMassima;
    this.battito = battito;
    this.silenzioMassimo = silenzioMassimo;

    this.presa = null;
    this.dentro = false;
    this.canali = new Map();
    this.rifiutata = null;
    /* Perche' l'ultimo tentativo non e' andato, **a parole**.
     *
     * Non e' un lusso da programmatori: e' la riga che dice se il nome non si
     * risolve, se la porta e' chiusa, se il certificato non va o se dall'altra
     * parte ha risposto qualcosa che non e' un WebSocket. Sono quattro guasti
     * con quattro rimedi diversi, e per un pomeriggio sono arrivati tutti con
     * la stessa parola — «filo chiuso» — che non ne distingue nessuno.
     *
     * La legge la console, e la scrive in cima. */
    this.perche = "";

    this._spentaApposta = false;
    this._tentativi = 0;
    this._riprova = null;
    this._impronta = null;
    this._battito = null;
    this._vistoIl = 0;
    /* `null` finche' non si sa: diventa vero al primo colpetto tornato
     * indietro, falso quando si e' aspettato abbastanza da poterlo dire. */
    this._rispondeAiColpetti = null;
  }

  get accesa() {
    return Boolean(this.dove) && !this._spentaApposta;
  }

  avvia() {
    if (!this.dove) {
      this.registro.info("nessun centralino configurato: da fuori casa non si entra");
      return;
    }
    this._spentaApposta = false;
    this._tentativi = 0;
    this._bussa();
  }

  /* La console ha fabbricato un codice: al centralino ne va detta l'impronta,
   * perche' possa instradare chi si presenta con quel codice. Il codice qui
   * dentro non passa, e al centralino non arriva mai. */
  apriLAbbinamento(impronta) {
    this._impronta = impronta;
    if (this.dentro) this._manda({ t: "apri-abbinamento", impronta });
  }

  chiudiLAbbinamento() {
    this._impronta = null;
    if (this.dentro) this._manda({ t: "chiudi-abbinamento" });
  }

  /* ─── Il filo ────────────────────────────────────────────────────────── */

  _bussa() {
    if (this._spentaApposta) return;
    let presa;
    try {
      /* L'identificativo sta **nell'indirizzo**, non solo nel primo messaggio.
       *
       * Al centralino in Node non servirebbe — legge `sono-io` e sa tutto. Ma
       * un centralino fatto di funzioni sulla nuvola deve sapere *prima* di
       * accettare il filo a quale casa consegnarlo, e prima c'e' solo
       * l'indirizzo. Non e' un segreto: serve a instradare, e quello che fa
       * entrare — il segreto — resta dentro il primo messaggio, dove il
       * centralino lo confronta con quello che ha in casa. */
      presa = new this.Presa(`${this.dove}/casa/${this.identita.casa}`);
    } catch (errore) {
      this._caduta(`non riesco ad aprire il filo: ${errore?.message || errore}`);
      return;
    }
    this.presa = presa;

    const scadenza = setTimeout(() => {
      if (this.dentro) return;
      this._chiudiLaPresa();
      this._caduta("il centralino non ha risposto in tempo");
    }, ATTESA_DELLA_PRESENTAZIONE);

    presa.addEventListener("open", () => {
      this._manda({
        t: "sono-io",
        casa: this.identita.casa,
        segreto: this.identita.segreto,
      });
    });

    presa.addEventListener("message", (evento) => {
      const testo = typeof evento.data === "string" ? evento.data : String(evento.data);
      let detto;
      try {
        detto = JSON.parse(testo);
      } catch (_errore) {
        return;
      }
      if (!this.dentro) {
        clearTimeout(scadenza);
        this._laRisposta(detto);
        return;
      }
      this._dalCentralino(detto);
    });

    presa.addEventListener("close", (evento) => {
      clearTimeout(scadenza);
      if (this.dentro) this.registro.attenzione("il filo col centralino e' caduto");
      /* Il motivo vero viaggia con la chiusura — `Chiamante` lo mette li' — e
       * per un pomeriggio l'abbiamo buttato: nel registro finiva «filo
       * chiuso», che di quattro guasti diversi non ne distingue nessuno. */
      this._caduta(evento?.motivo || presa.motivo || "filo chiuso");
    });

    presa.addEventListener("error", () => {
      /* `error` arriva sempre insieme a `close`, che e' dove si decide: il
       * motivo se lo tiene la presa, e la chiusura lo porta. */
    });
  }

  _laRisposta(detto) {
    if (detto.t === "bene") {
      this.dentro = true;
      this.rifiutata = null;
      this.perche = "";
      this._tentativi = 0;
      this.registro.info(`il centralino ci conosce: ${this.identita.casa}`);
      this._cominciaABattere();
      /* Se c'era un codice in attesa quando il filo e' caduto, si rimette:
       * altrimenti chi sta davanti allo schermo col codice in mano vedrebbe
       * l'app dire che non trova niente, senza sapere perche'. */
      if (this._impronta) this._manda({ t: "apri-abbinamento", impronta: this._impronta });
      return;
    }
    if (detto.t === "no") {
      /* Non e' una caduta: non passera' col tempo. */
      this.rifiutata = String(detto.perche || "rifiutata");
      this._spentaApposta = true;
      this.registro.errore(`il centralino ci rifiuta: ${this.rifiutata}`);
      this._chiudiLaPresa();
      this._buttaGiuITelefoni();
      return;
    }
  }

  _dalCentralino(detto) {
    /* Qualunque cosa arrivi e' un segno di vita: un filo con dei telefoni
     * sopra e' vivo per definizione, e non c'e' motivo di guardare solo i
     * colpetti. */
    this._vistoIl = Date.now();

    if (detto.t === "battito") {
      this._rispondeAiColpetti = true;
      return;
    }

    const numero = detto.c;
    if (typeof numero !== "number") return;

    switch (detto.t) {
      case "apri": {
        const canale = new Canale(numero, this);
        this.canali.set(numero, canale);
        this.portiere.accogli(canale, { da: `centralino ${detto.da ?? ""}`.trim() });
        return;
      }
      case "d": {
        const canale = this.canali.get(numero);
        if (!canale || typeof detto.m !== "string") return;
        try {
          canale.onMessaggio(detto.m);
        } catch (_errore) {
          /* Chi ascolta ha sbagliato: si chiude quel canale, non il filo. */
          this.chiudiIlCanale(numero);
        }
        return;
      }
      case "chiudi": {
        const canale = this.canali.get(numero);
        if (!canale) return;
        this.canali.delete(numero);
        canale.finita();
        return;
      }
      default:
        return;
    }
  }

  /* ─── Il battito ─────────────────────────────────────────────────────── */

  _cominciaABattere() {
    this._smettiDiBattere();
    this._vistoIl = Date.now();
    this._rispondeAiColpetti = null;
    this._battito = setInterval(() => this._colpetto(), this.battito);
    this._battito.unref?.();
  }

  _colpetto() {
    if (!this.dentro) return;
    const zitto = Date.now() - this._vistoIl > this.silenzioMassimo;

    /* Prima di poter dire che un filo e' morto bisogna sapere che quel
     * centralino saprebbe rispondere. Uno vecchio non risponde mai, e
     * scambiarlo per un filo morto vorrebbe dire ribussargli addosso per
     * sempre — cioe' rompere quello che prima funzionava. */
    if (this._rispondeAiColpetti === null) {
      if (!zitto) {
        this._manda({ t: "battito" });
        return;
      }
      this._rispondeAiColpetti = false;
      this.registro.attenzione(
        "il centralino non risponde ai colpetti: e' una versione vecchia, " +
          "e un filo morto senza chiusura non si potra' vedere",
      );
      return;
    }
    if (!this._rispondeAiColpetti) return;

    if (zitto) {
      /* Sembra aperto e non lo e'. Si chiude di mano nostra: la chiusura fa
       * partire la ribussata, che e' l'unica cosa che rimette in piedi la
       * strada di fuori casa. */
      this.registro.attenzione("centralino: nessuna risposta ai colpetti, richiamo");
      this._chiudiLaPresa();
      this._caduta("il filo era morto senza dirlo");
      return;
    }
    this._manda({ t: "battito" });
  }

  _smettiDiBattere() {
    if (!this._battito) return;
    clearInterval(this._battito);
    this._battito = null;
  }

  /* ─── I canali, visti da dentro ──────────────────────────────────────── */

  mandaSulCanale(numero, testo) {
    if (!this.dentro) return false;
    return this._manda({ c: numero, t: "d", m: testo });
  }

  chiudiIlCanale(numero) {
    if (!this.canali.delete(numero)) return;
    if (this.dentro) this._manda({ c: numero, t: "chiudi" });
  }

  quantiCanali() {
    return this.canali.size;
  }

  /* ─── Quando cade ────────────────────────────────────────────────────── */

  _caduta(perche) {
    this.dentro = false;
    this.perche = String(perche || "");
    this._smettiDiBattere();
    this._chiudiLaPresa();
    this._buttaGiuITelefoni();
    if (this._spentaApposta) return;

    /* Attesa che raddoppia, con un pizzico di caso: se il centralino si
     * riavvia, tutte le case del mondo ribussano insieme, e la seconda ondata
     * lo tira giu' di nuovo. */
    const quanto = Math.min(this.attesaMassima, SECONDO * 2 ** Math.min(this._tentativi, 6));
    this._tentativi += 1;
    const conCaso = Math.floor(quanto / 2 + Math.random() * (quanto / 2));

    if (this._tentativi === 1) this.registro.attenzione(`centralino: ${perche}`);
    clearTimeout(this._riprova);
    this._riprova = setTimeout(() => this._bussa(), conCaso);
    this._riprova.unref?.();
  }

  _buttaGiuITelefoni() {
    for (const canale of [...this.canali.values()]) canale.finita();
    this.canali.clear();
  }

  _manda(cosa) {
    try {
      this.presa?.send(JSON.stringify(cosa));
      return true;
    } catch (_errore) {
      return false;
    }
  }

  _chiudiLaPresa() {
    try {
      this.presa?.close();
    } catch (_errore) {
      /* Gia' chiusa. */
    }
    this.presa = null;
  }

  spegni() {
    this._spentaApposta = true;
    this.dentro = false;
    clearTimeout(this._riprova);
    this._riprova = null;
    this._smettiDiBattere();
    this._buttaGiuITelefoni();
    this._chiudiLaPresa();
  }
}
