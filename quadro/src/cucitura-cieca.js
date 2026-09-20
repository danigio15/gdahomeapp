/* La cucitura cieca: la plancia crede di parlare con Home Assistant, e parla
 * col quadro, che di Home Assistant non sa niente.
 *
 * E' il gemello di `ponte/src/cucitura.js`, con una differenza che e' tutto:
 * quella gira i comandi alla casa, questa **non ha una casa da chiamare**. Ha
 * quello che la casa le ha mandato — lo scatto della plancia e l'inventario,
 * cioe' cosa c'e' in casa senza cosa succede (`inventario.js`) — e risponde
 * con quello. Di tutto il resto dice di no, per nome: un comando a un
 * dispositivo, un flusso di telecamera, la storia di un sensore, una foto.
 * Non passa niente, perche' non c'e' nessun posto dove passare.
 *
 * ─── Chi entra ──────────────────────────────────────────────────────────
 *
 * Il primo messaggio dev'essere quello con cui la pagina si presenta a Home
 * Assistant, `{type: "auth", access_token}`, e il segno e' il codice del
 * cruscotto: glielo mette il WebSocket che le premesse le hanno dato
 * (`plancia-servita.js`). Da li' si sa chi e' — un installatore — e si
 * guarda se questa casa e' sua e se lascia configurare la plancia da lontano:
 * le stesse due domande delle vie HTTP del cruscotto. Chi non passa si sente
 * dire `auth_invalid`, che la pagina sa leggere, e il filo si chiude.
 *
 * ─── Salvare ────────────────────────────────────────────────────────────
 *
 * Un `dashboardmodern/config/set` diventa quello che era gia' un PUT dal
 * cruscotto: un lavoro «configura» in coda per la casa, e i valori messi da
 * parte perche' passi a ritirarli (`plance.js`). Alla pagina si risponde
 * «salvato» con una revisione che e' la sua: quella vera la conia la casa
 * quando applica, e torna qui col prossimo scatto. Il primo salvataggio
 * dice alla casa su quale revisione e' stato scritto, cosi' una plancia
 * cambiata in casa nel frattempo non viene coperta; quelli dopo no — chi ha
 * l'editor aperto sta scrivendo sopra il proprio, e la casa ha gia' visto
 * la revisione che lui ha visto.
 */

import { costruisciIlCatalogo, DISPOSITIVI_MASSIMI, ENTITA_MASSIME } from "./catalogo.js";
import { haFlussi, PLANCIA_MASSIMA } from "./plance.js";

/* Quanto si aspetta il codice, prima di chiudere un filo che non si e'
 * presentato. */
export const ASPETTA_LA_CHIAVE = 15000;

const VUOTO = Object.freeze({ stati: [], entita: [], dispositivi: [], stanze: [], piani: [] });

const si = (id, result) => ({ id, type: "result", success: true, result });
const no = (id, code, message) => ({
  id,
  type: "result",
  success: false,
  error: { code, message },
});

const intero = (valore) => {
  const numero = Number(valore);
  return Number.isFinite(numero) && numero >= 0 ? Math.floor(numero) : 0;
};

function leggi(testo) {
  try {
    const detto = JSON.parse(testo);
    return detto && typeof detto === "object" ? detto : null;
  } catch (_errore) {
    return null;
  }
}

export class CucituraCieca {
  constructor({
    presa,
    casa,
    profilo,
    scatti,
    case: case_,
    /* Chi ha questa chiave: `installatori.riconosci`. */
    riconosci,
    congelato = () => false,
    registro = { info() {}, attenzione() {}, errore() {} },
    adesso = () => Date.now(),
    aspettaLaChiave = ASPETTA_LA_CHIAVE,
    da = "?",
  }) {
    this.presa = presa;
    this.casa = casa;
    this.profilo = profilo;
    this.scatti = scatti;
    this.case = case_;
    this.riconosci = riconosci;
    this.congelato = congelato;
    this.registro = registro;
    this.adesso = adesso;
    this.da = da;
    this.chi = null;
    this.chiusa = false;
    /* Quello che questa pagina ha scritto per ultimo, con la revisione che
     * le e' stata detta: finche' da casa non torna uno scatto piu' nuovo, e'
     * quello che le si rilegge. Senza, la pagina rileggerebbe la plancia di
     * prima con una revisione piu' bassa della sua, e la crederebbe un
     * conflitto. */
    this._scritta = null;
    presa.onMessaggio = (testo) => this._dallaPagina(testo);
    presa.onChiusa = () => this._laPaginaSeNEAndata();
    this._orologio = setTimeout(() => {
      if (!this.chi) this._fuori("il codice del cruscotto non e' arrivato");
    }, aspettaLaChiave);
    this._orologio.unref?.();
  }

  _manda(cosa) {
    if (this.chiusa) return;
    this.presa.manda(JSON.stringify(cosa));
  }

  /* `auth_invalid` e non un silenzio: la pagina lo sa leggere, e dice che
   * non e' entrata invece di restare a girare. */
  _fuori(perche) {
    this._manda({ type: "auth_invalid", message: perche });
    this.chiudi(1008, perche);
  }

  _dallaPagina(testo) {
    if (this.chiusa) return;
    const detto = leggi(testo);
    if (!detto) return;
    if (!this.chi) {
      this._entra(detto);
      return;
    }
    let risposta;
    try {
      risposta = this._rispondi(detto);
    } catch (errore) {
      this.registro.errore(`l'editor della plancia e' inciampato: ${errore?.message || errore}`);
      risposta = no(detto.id ?? null, "quadro", "non ha funzionato");
    }
    if (risposta) this._manda(risposta);
  }

  _entra(detto) {
    if (detto.type !== "auth") {
      this._fuori("prima il codice");
      return;
    }
    const chi = this.riconosci(String(detto.access_token || ""));
    if (!chi || this.congelato(chi)) {
      this._fuori("la chiave non va bene");
      return;
    }
    const sua = this.case.quella(this.casa);
    if (!sua || sua.di !== chi) {
      this._fuori("questa casa non la segui tu");
      return;
    }
    if (sua.carta?.configurazione !== true) {
      this._fuori("questo impianto non lascia configurare la plancia da lontano");
      return;
    }
    this.chi = chi;
    clearTimeout(this._orologio);
    this.registro.info(
      `${chi} ha aperto l'editor della plancia «${this.profilo}» di ${this.casa} da ${this.da}`,
    );
    this._manda({ type: "auth_ok", ha_version: "gdahome" });
  }

  _rispondi(detto) {
    const id = detto.id ?? null;
    const tipo = String(detto.type || "");
    const inventario = this.scatti.inventario(this.casa) ?? VUOTO;
    switch (tipo) {
      case "ping":
        return { id, type: "pong" };
      /* Un secondo `auth` si lascia cadere: e' gia' entrata. */
      case "auth":
        return null;
      case "get_states":
        return si(id, inventario.stati);
      case "config/entity_registry/list":
        return si(id, inventario.entita);
      case "config/device_registry/list":
        return si(id, inventario.dispositivi);
      case "config/area_registry/list":
        return si(id, inventario.stanze);
      case "config/floor_registry/list":
        return si(id, inventario.piani);
      /* Ci si abbona, e non arriva mai niente: qui non succede niente. */
      case "subscribe_events":
      case "unsubscribe_events":
      case "frontend/set_user_data":
        return si(id, null);
      case "frontend/get_user_data":
        return si(id, { value: null });
      case "get_config":
        return si(id, this._laCasa());
      case "get_services":
        return si(id, {});
      case "dashboardmodern/config/get":
        return this._configurazione(id, detto);
      case "dashboardmodern/config/set":
        return this._scrivi(id, detto);
      case "dashboardmodern/integrations/catalog":
        return this._catalogo(id, detto, inventario);
      default:
        return no(id, "not_allowed", `da lontano «${tipo}» non si fa`);
    }
  }

  /* Quello che `get_config` dice di una casa che non si vede: la versione, e
   * niente che sia un posto. */
  _laCasa() {
    const carta = this.case.quella(this.casa)?.carta ?? {};
    return {
      version: String(carta.ha ?? ""),
      location_name: "",
      latitude: null,
      longitude: null,
      elevation: 0,
      unit_system: {
        length: "km",
        accumulated_precipitation: "mm",
        mass: "g",
        pressure: "Pa",
        temperature: "°C",
        volume: "L",
        wind_speed: "m/s",
      },
      time_zone: "UTC",
      components: [],
      config_dir: "",
      allowlist_external_dirs: [],
      state: "RUNNING",
      currency: "EUR",
      country: "IT",
      language: "it",
    };
  }

  _profiloGiusto(detto) {
    const chiesto = detto.profile ?? this.profilo;
    return chiesto === this.profilo;
  }

  _configurazione(id, detto) {
    if (!this._profiloGiusto(detto))
      return no(id, "not_allowed", "questo filo e' di un'altra plancia");
    const corrente = this.scatti.scatto(this.casa, this.profilo);
    const scritta =
      this._scritta && (!corrente || corrente.presoIl <= this._scritta.quando)
        ? this._scritta.scatto
        : null;
    const scatto = scritta
      ? scritta
      : corrente
        ? {
            revision: intero(corrente.revisione),
            updated_at: intero(corrente.aggiornataIl) || intero(corrente.presoIl),
            keys_revision: intero(corrente.chiavi),
            writer_generation: intero(corrente.generazione),
            reset: false,
            values: { ...(corrente.valori || {}) },
          }
        : null;
    return si(id, {
      profile: this.profilo,
      requested_profile: null,
      snapshot: scatto,
      recoverable: [],
      profiles: [this.profilo],
    });
  }

  _scrivi(id, detto) {
    if (!this._profiloGiusto(detto))
      return no(id, "not_allowed", "questo filo e' di un'altra plancia");
    const scatto = detto.snapshot;
    if (
      !scatto ||
      typeof scatto !== "object" ||
      !scatto.values ||
      typeof scatto.values !== "object"
    )
      return no(id, "invalid_format", "manca lo scatto");
    if (detto.reset === true) return no(id, "not_allowed", "da lontano una plancia non si azzera");
    const valori = scatto.values;
    if (Buffer.byteLength(JSON.stringify(valori), "utf8") > PLANCIA_MASSIMA)
      return no(id, "snapshot_too_large", "questa configurazione e' troppo grande");
    /* La regola che tiene in piedi il permesso: da lontano si sceglie quale
     * telecamera va dove, non dove sta il suo flusso. La casa lo ricontrolla
     * per conto suo. */
    if (haFlussi(valori))
      return no(
        id,
        "flussi",
        "dentro c'e' un indirizzo di flusso o un gettone: da lontano non si toccano",
      );
    const corrente = this.scatti.scatto(this.casa, this.profilo);
    const revisioneAttesa = !this._scritta && corrente ? intero(corrente.revisione) : null;
    let messo = this.case.chiediUnLavoro(
      this.casa,
      { cosa: "configura", nome: this.profilo, da: String(revisioneAttesa ?? ""), a: "" },
      this.chi,
    );
    if (!messo) {
      /* Un lavoro c'e' gia'. Se e' il nostro, e la casa non l'ha ancora
       * ritirato, si riscrivono i valori sotto lo stesso: quello che la casa
       * ritirera' e' l'ultimo. Se e' di un altro tipo, o gia' ritirato, si
       * aspetta che la casa dica com'e' andata. */
      const inAttesa = this.scatti.chiesta(this.casa, this.profilo);
      if (!inAttesa)
        return no(
          id,
          "occupata",
          "l'impianto ha ancora un lavoro in corso: riprova fra qualche secondo",
        );
      this.scatti.chiedi(this.casa, this.profilo, {
        id: inAttesa.id,
        valori,
        revisioneAttesa: inAttesa.revisioneAttesa,
      });
      messo = inAttesa;
    } else {
      this.scatti.chiedi(this.casa, this.profilo, { id: messo.id, valori, revisioneAttesa });
    }
    const quando = this.adesso();
    const revisione =
      Math.max(intero(corrente?.revisione), intero(this._scritta?.scatto?.revision)) + 1;
    this._scritta = {
      quando,
      scatto: {
        revision: revisione,
        updated_at: quando,
        keys_revision: intero(scatto.keys_revision),
        writer_generation: intero(scatto.writer_generation),
        reset: false,
        values: { ...valori },
      },
    };
    this.registro.info(
      `${this.chi} ha scritto la plancia «${this.profilo}» di ${this.casa} dall'editor: lavoro ${messo.id}`,
    );
    return si(id, {
      status: "saved",
      profile: this.profilo,
      snapshot: { ...this._scritta.scatto, values: { ...valori } },
      recoverable: [],
    });
  }

  /* Il menu delle integrazioni, dai registri dell'inventario: la stessa
   * funzione pura del ponte, senza una casa a cui chiedere. */
  _catalogo(id, detto, inventario) {
    let deviceIds = null;
    if (detto.device_ids !== undefined) {
      if (
        !Array.isArray(detto.device_ids) ||
        detto.device_ids.length > DISPOSITIVI_MASSIMI ||
        !detto.device_ids.every(
          (uno) => typeof uno === "string" && uno.length > 0 && uno.length <= 64,
        )
      )
        return no(id, "invalid_format", "device_ids non valido");
      deviceIds = detto.device_ids;
    }
    let entityIds = null;
    if (detto.entity_ids !== undefined) {
      if (
        !Array.isArray(detto.entity_ids) ||
        detto.entity_ids.length > ENTITA_MASSIME ||
        !detto.entity_ids.every(
          (uno) => typeof uno === "string" && uno.length >= 3 && uno.length <= 255,
        )
      )
        return no(id, "invalid_format", "entity_ids non valido");
      entityIds = detto.entity_ids;
    }
    return si(
      id,
      costruisciIlCatalogo({
        dispositivi: inventario.dispositivi,
        entita: inventario.entita,
        aree: inventario.stanze,
        voci: [],
        manifesti: [],
        stati: inventario.stati,
        deviceIds,
        entityIds,
      }),
    );
  }

  _laPaginaSeNEAndata() {
    this.chiusa = true;
    clearTimeout(this._orologio);
  }

  chiudi(codice = 1000, perche = "") {
    if (this.chiusa) return;
    this.chiusa = true;
    clearTimeout(this._orologio);
    try {
      this.presa.chiudi(codice, perche);
    } catch (_errore) {
      /* Gia' chiusa. */
    }
  }
}
