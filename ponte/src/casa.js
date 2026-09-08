/* La casa: il filo fra il ponte e Home Assistant.
 *
 * Un add-on non bussa a Home Assistant dalla porta di casa: passa dal
 * Supervisor, che gli mette davanti `http://supervisor/core` e gli da' un
 * segno — `SUPERVISOR_TOKEN` — che vale finche' l'add-on gira.
 *
 * Quel segno e' l'unica cosa davvero potente che questo add-on tiene in mano,
 * e non esce da questo file. L'app non lo vede, non lo riceve e non lo puo'
 * chiedere: e' esattamente il motivo per cui il ponte esiste invece di far
 * arrivare il telefono dritto a Home Assistant con un segno lungo incollato a
 * mano.
 */

import { Chiamante } from "./chiamante.js";

const CASA_DI_DIFETTO = "http://supervisor/core";
const SUPERVISOR_DI_DIFETTO = "http://supervisor";

/* Dove stanno i file della plancia quando il Supervisor non lo dice: e' il
 * nome che il contenitore di Home Assistant ha sulla rete fra gli add-on. */
const PLANCIA_DI_DIFETTO = "http://homeassistant:8123";

/* Ogni quanto si torna a chiedere al Supervisor dove sta Home Assistant. Non
 * si sposta mai, ma un riavvio puo' cambiargli la porta. */
const QUANTO_DURA_LA_PLANCIA = 5 * 60 * 1000;

/* Quanto puo' essere grande un messaggio che arriva da Home Assistant.
 *
 * Il difetto della presa e' un megabyte, e per un telefono che manda comandi
 * e' larghissimo. Da questa parte no: la prima cosa che il telefono chiede e'
 * `get_states`, cioe' **tutta la casa in un messaggio solo**, e su una casa
 * vera sono facilmente due o tre megabyte. Con il limite di prima quel
 * messaggio faceva chiudere il filo, e quello che si vedeva era «il filo si e'
 * interrotto» ogni tre secondi, senza nessuna spiegazione da nessuna parte.
 *
 * Qui dall'altra parte c'e' Home Assistant, non uno sconosciuto: il limite
 * serve a non finire la memoria, non a difendersi. */
const DA_HOME_ASSISTANT = 32 * 1024 * 1024;

/* Quanto si aspetta che Home Assistant risponda alla stretta di mano. Oltre,
 * il telefono ha una risposta invece di restare appeso. */
const ATTESA_DELLA_STRETTA = 15_000;

export class Casa {
  constructor({
    indirizzo = process.env.PONTE_CASA || CASA_DI_DIFETTO,
    segno = process.env.SUPERVISOR_TOKEN || "",
    supervisor = process.env.PONTE_SUPERVISOR || SUPERVISOR_DI_DIFETTO,
    /* Dove stanno i file della plancia, detto a mano. Serve fuori dal
     * Supervisor — sul banco, o su un computer di prova — e nelle prove. */
    plancia = process.env.PONTE_PLANCIA || "",
    Presa = Chiamante,
    fetch: prendi = globalThis.fetch,
    adesso = () => Date.now(),
  } = {}) {
    this.indirizzo = String(indirizzo).replace(/\/+$/, "");
    this.segno = String(segno);
    this.supervisor = String(supervisor).replace(/\/+$/, "");
    this.plancia = String(plancia).replace(/\/+$/, "");
    this.Presa = Presa;
    this.prendi = prendi;
    this.adesso = adesso;
    this._plancia = "";
    this._planciaChiestaIl = 0;
  }

  get indirizzoDelFilo() {
    return `${this.indirizzo.replace(/^http/, "ws")}/websocket`;
  }

  /* Home Assistant c'e' e risponde? Serve alla console, per dire all'utente
   * se il ponte e' davvero in piedi o solo acceso. */
  async saluta() {
    try {
      const risposta = await this.prendi(`${this.indirizzo}/api/`, {
        headers: { authorization: `Bearer ${this.segno}` },
      });
      if (!risposta.ok)
        return { viva: false, perche: `Home Assistant risponde ${risposta.status}` };
      return { viva: true };
    } catch (errore) {
      return { viva: false, perche: String(errore?.message || errore) };
    }
  }

  /* Dove stanno i file della plancia.
   *
   * Il Supervisor inoltra soltanto `/api/`: i file statici — quelli di
   * DashboardModern sotto `/dashboardmodern_static/` — vanno chiesti a Home
   * Assistant direttamente, sulla rete fra i contenitori. L'indirizzo lo dice
   * il Supervisor stesso, in `/core/info`: l'indirizzo, la porta e se c'e' il
   * TLS. Se non risponde si prova col nome che il contenitore di Home
   * Assistant ha su quella rete. Un guasto qui non blocca niente: al peggio la
   * plancia non arriva, e il filo continua a funzionare. */
  async doveStaLaPlancia() {
    if (this.plancia) return this.plancia;
    const ora = this.adesso();
    if (this._plancia && ora - this._planciaChiestaIl < QUANTO_DURA_LA_PLANCIA) {
      return this._plancia;
    }
    let trovata = "";
    if (this.segno && typeof this.prendi === "function") {
      try {
        const risposta = await this.prendi(`${this.supervisor}/core/info`, {
          headers: { authorization: `Bearer ${this.segno}` },
          signal: AbortSignal.timeout(5000),
        });
        if (risposta.ok) {
          const dati = (await risposta.json())?.data;
          const indirizzo = String(dati?.ip_address || "").trim();
          const porta = Number(dati?.port);
          if (indirizzo && Number.isInteger(porta) && porta > 0) {
            trovata = `${dati?.ssl ? "https" : "http"}://${indirizzo}:${porta}`;
          }
        }
      } catch (_errore) {
        /* Si va col nome. */
      }
    }
    this._plancia = trovata || PLANCIA_DI_DIFETTO;
    this._planciaChiestaIl = ora;
    return this._plancia;
  }

  /* Apre un filo e lo restituisce gia' autenticato.
   *
   * La promessa si scioglie quando Home Assistant ha detto `auth_ok`, non
   * quando il socket si e' aperto: fra le due cose c'e' la stretta di mano, e
   * un filo aperto ma non autenticato non serve a niente. */
  apriIlFilo({ onMessaggio, onChiusa } = {}) {
    return new Promise((riuscito, fallito) => {
      let presa;
      try {
        presa = new this.Presa(this.indirizzoDelFilo, {
          messaggioMassimo: DA_HOME_ASSISTANT,
        });
      } catch (errore) {
        fallito(new CasaIrraggiungibile(String(errore?.message || errore)));
        return;
      }

      let autenticato = false;
      const scadenza = setTimeout(() => {
        if (autenticato) return;
        try {
          presa.close();
        } catch (_errore) {
          /* Gia' chiusa. */
        }
        fallito(new CasaIrraggiungibile("Home Assistant non ha risposto in tempo"));
      }, ATTESA_DELLA_STRETTA);

      const filo = new Filo(presa);

      presa.addEventListener("message", (evento) => {
        const testo = typeof evento.data === "string" ? evento.data : String(evento.data);
        if (autenticato) {
          onMessaggio?.(testo);
          return;
        }
        let detto;
        try {
          detto = JSON.parse(testo);
        } catch (_errore) {
          return;
        }
        if (detto?.type === "auth_required") {
          presa.send(JSON.stringify({ type: "auth", access_token: this.segno }));
          return;
        }
        if (detto?.type === "auth_ok") {
          autenticato = true;
          clearTimeout(scadenza);
          riuscito(filo);
          return;
        }
        if (detto?.type === "auth_invalid") {
          clearTimeout(scadenza);
          try {
            presa.close();
          } catch (_errore) {
            /* Gia' chiusa. */
          }
          /* Se succede, e' un guasto dell'add-on, non del telefono: vuol dire
           * che il segno del Supervisor non vale piu'. Il telefono si vedra'
           * arrivare un rifiuto, ma nel registro ci finisce la verita'. */
          fallito(new CasaIrraggiungibile("Home Assistant ha rifiutato il segno del ponte"));
        }
      });

      presa.addEventListener("close", (evento) => {
        clearTimeout(scadenza);
        filo.viva = false;
        /* Il perche', quando si sa. Senza, chi legge il registro vede un filo
         * caduto e non ha modo di distinguere la rete da un messaggio troppo
         * grande — e sono due guasti che si aggiustano in modi opposti. */
        const perche = evento?.motivo ? `: ${evento.motivo}` : "";
        if (!autenticato)
          fallito(new CasaIrraggiungibile(`il filo si e' chiuso durante la stretta${perche}`));
        else onChiusa?.(perche);
      });

      presa.addEventListener("error", () => {
        /* `error` arriva sempre insieme a `close`, che e' dove si decide. */
      });
    });
  }
}

export class Filo {
  constructor(presa) {
    this.presa = presa;
    this.viva = true;
  }

  manda(testo) {
    if (!this.viva) return false;
    try {
      this.presa.send(testo);
      return true;
    } catch (_errore) {
      this.viva = false;
      return false;
    }
  }

  chiudi() {
    this.viva = false;
    try {
      this.presa.close();
    } catch (_errore) {
      /* Gia' chiusa. */
    }
  }
}

export class CasaIrraggiungibile extends Error {}
