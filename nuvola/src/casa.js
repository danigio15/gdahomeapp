/* Una casa, e i telefoni che la stanno guardando.
 *
 * Tutto quello che riguarda una casa sta qui dentro: il filo che lei tiene
 * aperto verso il centralino, e un canale per ogni telefono. Due case non si
 * vedono, non si aspettano e non si rallentano.
 *
 * ─── Dormire ─────────────────────────────────────────────────────────────
 *
 * I fili si accettano con `acceptWebSocket`, non con `accept`. La differenza
 * e' tutta la ragione per cui questa cosa e' gratis: cosi' li tiene aperti
 * Cloudflare, e **questo oggetto smette di esistere** finche' non arriva un
 * messaggio. Una casa ferma di notte non costa niente. Il prezzo e' che fra un
 * messaggio e l'altro non si puo' ricordare niente a memoria: quello che serve
 * si scrive addosso al filo — `serializeAttachment` — o nel proprio archivio.
 * Ogni variabile d'istanza qui dentro sarebbe un difetto che si vede solo
 * dopo, quando la casa e' rimasta zitta abbastanza a lungo.
 *
 * ─── Chi e' un filo ──────────────────────────────────────────────────────
 *
 * Le targhette dicono chi e': `casa` per il filo della casa, `telefono` e
 * `c<numero>` per i telefoni. Servono anche a instradare, che e' l'unica cosa
 * che questo oggetto fa davvero: un messaggio con dentro `c: 5` va al filo con
 * la targhetta `c5`, senza che nessuno abbia guardato cosa c'e' scritto.
 */

import { impronta, stessaImpronta } from "./segreti.js";
import { quelCodice } from "./dove.js";
import { CASA_VALIDA, IMPRONTA_VALIDA } from "./nomi.js";

/* Quanti telefoni insieme puo' avere una casa. Oltre non e' una famiglia. */
const TELEFONI_PER_CASA = 20;

/* «Non per la rete, per la politica»: chi lo riceve lo legge come definitivo e
 * smette di riprovare, invece di girare a vuoto per sempre. */
const PER_REGOLA = 1008;
const NORMALE = 1000;

export class Casa {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  /* ─── Chi arriva ──────────────────────────────────────────────────────── */

  async fetch(richiesta) {
    const via = new URL(richiesta.url).pathname;
    const da = richiesta.headers.get("cf-connecting-ip") || "?";
    const [alClient, mia] = Object.values(new WebSocketPair());

    const laCasa = /^\/casa\/([A-Za-z0-9_]+)$/.exec(via);
    if (laCasa) this._accogliLaCasa(mia, laCasa[1]);
    else await this._accogliUnTelefono(mia, da);

    return new Response(null, { status: 101, webSocket: alClient });
  }

  _accogliLaCasa(presa, atteso) {
    /* Una casa sola per identificativo. Chi arriva secondo prende il posto del
     * primo, e non il contrario: il primo puo' essere un filo morto che
     * nessuno ha ancora dichiarato tale, e la casa vera che si riaggancia non
     * deve restare fuori per colpa del proprio fantasma. */
    for (const vecchia of this.state.getWebSockets("casa")) {
      try {
        vecchia.close(NORMALE, "questa casa si e' ricollegata");
      } catch (_errore) {
        /* Gia' chiusa. */
      }
    }
    this.state.acceptWebSocket(presa, ["casa"]);
    presa.serializeAttachment({ chi: "casa", atteso, entrata: false });
  }

  async _accogliUnTelefono(presa, da) {
    const casa = this.state.getWebSockets("casa")[0];
    if (!casa) {
      /* Detto com'e': «questa casa adesso non e' collegata». Non e' un
       * rifiuto, e il telefono deve riprovare fra poco invece di arrendersi. */
      presa.accept();
      presa.close(NORMALE, "casa non collegata");
      return;
    }
    if (this.state.getWebSockets("telefono").length >= TELEFONI_PER_CASA) {
      presa.accept();
      presa.close(NORMALE, "troppi telefoni su questa casa");
      return;
    }

    const numero = (await this.state.storage.get("prossimoCanale")) ?? 1;
    await this.state.storage.put("prossimoCanale", numero + 1);

    this.state.acceptWebSocket(presa, ["telefono", `c${numero}`]);
    presa.serializeAttachment({ chi: "telefono", numero });
    casa.send(JSON.stringify({ c: numero, t: "apri", da }));
  }

  /* ─── Quello che passa ────────────────────────────────────────────────── */

  async webSocketMessage(presa, messaggio) {
    const suo = presa.deserializeAttachment() ?? {};
    if (typeof messaggio !== "string") return;

    if (suo.chi === "telefono") {
      /* Byte, e si spostano. Qui dentro non si guarda mai. */
      const casa = this.state.getWebSockets("casa")[0];
      if (casa) casa.send(JSON.stringify({ c: suo.numero, t: "d", m: messaggio }));
      return;
    }
    if (suo.chi !== "casa") return;

    let detto;
    try {
      detto = JSON.parse(messaggio);
    } catch (_errore) {
      this._rifiuta(presa, "non ho capito");
      return;
    }
    if (!detto || typeof detto !== "object") {
      this._rifiuta(presa, "non ho capito");
      return;
    }

    if (!suo.entrata) {
      await this._siPresenta(presa, suo, detto);
      return;
    }

    switch (detto.t) {
      case "apri-abbinamento":
        await this._apriUnAbbinamento(suo, detto.impronta);
        return;
      case "chiudi-abbinamento":
        await this._chiudiGliAbbinamenti();
        return;
      case "d":
        this._versoIlTelefono(detto.c, detto.m);
        return;
      case "chiudi":
        this._chiudiIlCanale(detto.c, "la casa ha chiuso");
        return;
      default:
        /* Roba che non si conosce si lascia perdere: una casa piu' nuova del
         * centralino puo' dire cose che qui non si sanno ancora, e non e' un
         * motivo per buttarla fuori. */
        return;
    }
  }

  async _siPresenta(presa, suo, detto) {
    if (detto.t !== "sono-io") {
      this._rifiuta(presa, "prima bisogna presentarsi");
      return;
    }
    /* L'identificativo dell'indirizzo e quello del messaggio devono essere lo
     * stesso. Se non lo fossero, una casa potrebbe farsi consegnare l'oggetto
     * di un'altra e poi presentarsi con il proprio nome, e quello che si
     * ritroverebbe in mano sarebbero i telefoni dell'altra. */
    if (!CASA_VALIDA.test(String(detto.casa ?? "")) || detto.casa !== suo.atteso) {
      this._rifiuta(presa, "non ti riconosco");
      return;
    }

    const sua = await impronta(detto.segreto);
    const conosciuta = await this.state.storage.get("impronta");
    if (conosciuta === undefined) {
      /* La prima casa che si presenta con questo identificativo se lo prende.
       * Sono centoventotto bit di caso scelti dal ponte: nessuno li indovina,
       * e nessuno li registra da qualche parte prima. */
      await this.state.storage.put("impronta", sua);
    } else if (!stessaImpronta(conosciuta, sua)) {
      this._rifiuta(presa, "non ti riconosco");
      return;
    }

    presa.serializeAttachment({ ...suo, entrata: true });
    presa.send(JSON.stringify({ t: "bene" }));
  }

  /* ─── Gli abbinamenti ─────────────────────────────────────────────────── */

  async _apriUnAbbinamento(suo, impronta) {
    if (typeof impronta !== "string" || !IMPRONTA_VALIDA.test(impronta)) return;
    await this._chiudiGliAbbinamenti();
    await this.state.storage.put("abbinamento", impronta);
    await quelCodice(this.env, impronta).fetch("https://centralino/apri", {
      method: "POST",
      body: JSON.stringify({ casa: suo.atteso }),
    });
  }

  async _chiudiGliAbbinamenti() {
    const vecchia = await this.state.storage.get("abbinamento");
    if (!vecchia) return;
    await this.state.storage.delete("abbinamento");
    await quelCodice(this.env, vecchia).fetch("https://centralino/chiudi", {
      method: "POST",
    });
  }

  /* ─── I canali ────────────────────────────────────────────────────────── */

  _versoIlTelefono(numero, messaggio) {
    if (typeof numero !== "number" || typeof messaggio !== "string") return;
    const telefono = this.state.getWebSockets(`c${numero}`)[0];
    if (telefono) telefono.send(messaggio);
  }

  _chiudiIlCanale(numero, perche) {
    if (typeof numero !== "number") return;
    const telefono = this.state.getWebSockets(`c${numero}`)[0];
    if (telefono) telefono.close(NORMALE, perche);
  }

  /* ─── Quando qualcuno se ne va ────────────────────────────────────────── */

  async webSocketClose(presa) {
    await this._finita(presa);
  }

  async webSocketError(presa) {
    await this._finita(presa);
  }

  async _finita(presa) {
    const suo = presa.deserializeAttachment() ?? {};

    if (suo.chi === "telefono") {
      const casa = this.state.getWebSockets("casa")[0];
      if (casa) casa.send(JSON.stringify({ c: suo.numero, t: "chiudi" }));
      return;
    }
    if (suo.chi !== "casa") return;

    /* I telefoni non restano appesi a una casa che non c'e' piu': meglio che
     * si accorgano subito e ribussino, invece di parlare nel vuoto. */
    for (const telefono of this.state.getWebSockets("telefono")) {
      try {
        telefono.close(NORMALE, "la casa si e' scollegata");
      } catch (_errore) {
        /* Gia' chiusa. */
      }
    }
    await this._chiudiGliAbbinamenti();
  }

  /* Rifiutare **dicendolo**.
   *
   * Chiudere e basta sarebbe la cosa peggiore: il ponte vedrebbe un filo
   * caduto, che e' quello che succede mille volte al giorno per colpa della
   * rete, e ribusserebbe all'infinito senza capire. Un rifiuto e' un'altra
   * cosa da una caduta — non passera' col tempo — e va detto, cosi' chi lo
   * riceve puo' smettere e scriverlo nel proprio registro. */
  _rifiuta(presa, perche) {
    try {
      presa.send(JSON.stringify({ t: "no", perche }));
      presa.close(PER_REGOLA, perche);
    } catch (_errore) {
      /* Gia' chiusa. */
    }
  }
}
