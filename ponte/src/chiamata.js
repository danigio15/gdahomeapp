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
 */

import { Canale } from "./canale.js";

const SECONDO = 1000;

/* Oltre questa non si aspetta di piu' fra un tentativo e l'altro. */
const ATTESA_MASSIMA = 60 * SECONDO;

/* Quanto si aspetta che il centralino risponda alla presentazione. */
const ATTESA_DELLA_PRESENTAZIONE = 20 * SECONDO;

export class Chiamata {
  constructor({
    dove,
    identita,
    portiere,
    registro,
    Presa = globalThis.WebSocket,
    attesaMassima = ATTESA_MASSIMA,
  }) {
    this.dove = String(dove || "").replace(/\/+$/, "");
    this.identita = identita;
    this.portiere = portiere;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.Presa = Presa;
    this.attesaMassima = attesaMassima;

    this.presa = null;
    this.dentro = false;
    this.canali = new Map();
    this.rifiutata = null;

    this._spentaApposta = false;
    this._tentativi = 0;
    this._riprova = null;
    this._impronta = null;
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
      presa = new this.Presa(`${this.dove}/casa`);
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

    presa.addEventListener("close", () => {
      clearTimeout(scadenza);
      if (this.dentro) this.registro.attenzione("il filo col centralino e' caduto");
      this._caduta("filo chiuso");
    });

    presa.addEventListener("error", () => {
      /* `error` arriva sempre insieme a `close`, che e' dove si decide. */
    });
  }

  _laRisposta(detto) {
    if (detto.t === "bene") {
      this.dentro = true;
      this.rifiutata = null;
      this._tentativi = 0;
      this.registro.info(`il centralino ci conosce: ${this.identita.casa}`);
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
    this._buttaGiuITelefoni();
    this._chiudiLaPresa();
  }
}
