/* La ricarica di notte, fatta dalla casa.
 *
 * «Quando l'auto e' collegata a quell'ora deve attivarsi la modalita' fast e
 * dopo tale orario si deve fermare.» Chi lo chiede ha la plancia sul telefono
 * e il telefono in tasca: alle undici di sera nessuna pagina e' aperta, e una
 * regola scritta nella pagina non scatterebbe mai. Per questo sta qui, nel
 * ponte, che gira finche' gira Home Assistant.
 *
 * Le regole non stanno in questo file: stanno in
 * `plancia/src/core/ricarica-di-notte.js`, che la plancia importa per
 * raccontarle e il ponte per eseguirle — una sola regola, due lettori. Qui ci
 * sono le tre cose che la plancia non puo' fare:
 *
 *  - **guardare l'orologio** ogni mezzo minuto, anche a pagine chiuse;
 *  - **cambiare la modalita' di evcc** con `select.select_option`, sul filo
 *    del ponte;
 *  - **ricordarsi la notte sul disco** (`/data/ricarica-notte.json`): la
 *    modalita' di prima, quando e' partita, con che batteria e quanti kWh. Un
 *    riavvio dell'add-on alle due di notte non deve lasciare l'auto in «Veloce»
 *    fino a mezzogiorno, ne' rimettere «Spento» a una macchina che qualcuno ha
 *    messo a mano su «Solare».
 *
 * Le impostazioni le legge dalla configurazione della plancia principale
 * (`cd_ricarica_notte`), che viaggia gia' fra i dispositivi: niente comandi
 * per scriverle, e quindi niente porta in piu' da difendere. Gli stati delle
 * entita' non li chiede a Home Assistant: li ha gia' la sentinella delle
 * notifiche, che tiene la casa allo specchio (`sentinella.js`). Chiedere
 * `get_states` ogni trenta secondi vorrebbe dire scaricare tutta la casa
 * ogni trenta secondi; cosi' non costa niente.
 *
 * Alla plancia si risponde con un comando solo, in sola lettura,
 * `ponte/ricarica-notte/stato`: cosa sta facendo, e com'e' andata l'ultima
 * notte. Lo puo' chiedere solo chi sul filo ha un nome — un utente di Home
 * Assistant, dall'app o dalla plancia — e nessuno lo puo' usare per
 * comandare niente.
 */

import { join } from "node:path";

import { Archivio } from "./archivio.js";
import { PROFILO_PRINCIPALE } from "./configurazione.js";
import {
  CHIAVE_RICARICA_NOTTE,
  ESITO_VALE,
  entitaDellaRicarica,
  fasciaDi,
  impostazioniPulite,
  laNotte,
  letturaDellAuto,
  memoriaPulita,
  prezzoDellaNotte,
  prossimaFascia,
} from "../plancia/src/core/ricarica-di-notte.js";

/* Ogni quanto si guarda l'orologio. La fascia comincia a un minuto preciso, e
 * mezzo minuto di ritardo su sei ore di ricarica non si vede. */
const BATTITO = 30_000;

/* Dopo un comando che Home Assistant non ha preso si riprova, ma non a ogni
 * battito: un evcc spento per tutta la notte riempirebbe il registro. */
const RIPROVA_DOPO = 2 * 60_000;

export const COMANDO_DELLO_STATO = "ponte/ricarica-notte/stato";

function leggiJson(valore) {
  if (typeof valore !== "string") return valore ?? null;
  try {
    return JSON.parse(valore);
  } catch (_errore) {
    return valore;
  }
}

const oggetto = (valore) =>
  valore && typeof valore === "object" && !Array.isArray(valore) ? valore : {};

/**
 * Chi traduce le caselle della plancia nelle entita' vere, a partire dalla
 * configurazione salvata. E' la stessa mappa che la plancia usa per
 * disegnare: le caselle di casa (`cd_entity_overrides`, e la loro copia nel
 * modello canonico), e per quello che manca le caselle delle auto, la prima
 * che ce l'ha.
 */
export function risolutoreDalla(valori) {
  const v = oggetto(valori);
  const stato = oggetto(leggiJson(v.dm_dashboard_state));
  const sezioni = oggetto(stato.sections);
  const mappa = {
    ...oggetto(sezioni.entityOverrides),
    ...oggetto(leggiJson(v.cd_entity_overrides)),
  };
  const auto = leggiJson(v.cd_ev_cars);
  const elenco =
    Array.isArray(auto) && auto.length ? auto : Array.isArray(sezioni.ev) ? sezioni.ev : [];
  return (rif) => {
    if (typeof mappa[rif] === "string" && mappa[rif]) return mappa[rif];
    for (const una of elenco) {
      const sue = oggetto(una?.ov || una?.overrides);
      if (typeof sue[rif] === "string" && sue[rif]) return sue[rif];
    }
    return "";
  };
}

export class RicaricaDiNotte {
  constructor({
    cartella = "",
    casa = null,
    configurazione = null,
    /* Lo stato di un'entita', dallo specchio della casa: `(id) => { state,
     * attributes }`. */
    stati = () => null,
    registro = null,
    adesso = () => Date.now(),
    ogni = (quanto, cosa) => setInterval(cosa, quanto),
    smetti = (segno) => clearInterval(segno),
  } = {}) {
    this._suDisco = Boolean(cartella);
    this.archivio = new Archivio(cartella ? join(cartella, "ricarica-notte.json") : "", {});
    this.casa = casa;
    this.configurazione = configurazione;
    this.stati = stati;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this._ogni = ogni;
    this._smetti = smetti;
    this._battito = null;
    this._inCorso = false;
    this._riprovaDopo = 0;
  }

  get memoria() {
    return memoriaPulita(this.archivio.dati);
  }

  _valori() {
    try {
      return this.configurazione?.leggi?.(PROFILO_PRINCIPALE)?.snapshot?.values || {};
    } catch (_errore) {
      return {};
    }
  }

  /** Tutto quello che serve per decidere, letto adesso. */
  situazione() {
    const valori = this._valori();
    const impostazioni = impostazioniPulite(valori[CHIAVE_RICARICA_NOTTE]);
    const entita = entitaDellaRicarica(risolutoreDalla(valori));
    const stati = (id) => this.stati(id);
    const auto = letturaDellAuto(entita, stati);
    const prezzo = prezzoDellaNotte({
      fasce: valori.cd_fasce_kwh,
      costo: valori.cd_costo_kwh,
      stati,
      da: impostazioni.da,
    });
    return { impostazioni, entita, auto, prezzo };
  }

  _salva(memoria) {
    this.archivio.dati = memoria;
    if (!this._suDisco) return;
    try {
      this.archivio.salva();
    } catch (errore) {
      this.registro.attenzione(`ricarica di notte non scritta: ${errore?.message || errore}`);
    }
  }

  /* ── l'orologio ───────────────────────────────────────────────────── */

  parti() {
    if (this._battito) return;
    this._battito = this._ogni(BATTITO, () => {
      this.battito().catch((errore) =>
        this.registro.attenzione(`ricarica di notte: ${errore?.message || errore}`),
      );
    });
    this._battito?.unref?.();
  }

  ferma() {
    if (this._battito) this._smetti(this._battito);
    this._battito = null;
  }

  /* Un giro: si legge, si decide, e se c'e' da cambiare modalita' si cambia.
   * La memoria nuova si scrive solo se il comando e' andato: altrimenti al
   * giro dopo si ridecide da capo, come se questo non ci fosse stato. */
  async battito() {
    if (this._inCorso) return null;
    const ora = this.adesso();
    if (ora < this._riprovaDopo) return null;
    this._inCorso = true;
    try {
      const { impostazioni, entita, auto, prezzo } = this.situazione();
      const prima = this.memoria;
      /* Spenta e senza niente in corso: non c'e' niente da guardare. */
      if (!impostazioni.attiva && !prima.sessione) return null;
      const deciso = laNotte({
        impostazioni,
        memoria: prima,
        auto,
        adesso: ora,
        prezzo: prezzo.prezzo,
      });
      if (deciso.comando && entita.modo) {
        try {
          await this.casa?.chiedi?.({
            type: "call_service",
            domain: entita.modo.split(".")[0],
            service: "select_option",
            service_data: { entity_id: entita.modo, option: deciso.comando.modo },
          });
        } catch (errore) {
          this._riprovaDopo = ora + RIPROVA_DOPO;
          this.registro.attenzione(
            `ricarica di notte: ${entita.modo} non passa a «${deciso.comando.modo}» (${errore?.message || errore})`,
          );
          return deciso;
        }
        this.registro.info(
          `ricarica di notte: ${entita.modo} su «${deciso.comando.modo}» (${deciso.perche})`,
        );
      } else if (deciso.perche === "a-mano") {
        this.registro.info(
          "ricarica di notte: modalita' cambiata a mano, stanotte non si tocca piu' niente",
        );
      }
      if (JSON.stringify(deciso.memoria) !== JSON.stringify(prima)) this._salva(deciso.memoria);
      return deciso;
    } finally {
      this._inCorso = false;
    }
  }

  /* ── quello che si dice alla plancia ──────────────────────────────── */

  stato() {
    const ora = this.adesso();
    const { impostazioni, entita, auto, prezzo } = this.situazione();
    const memoria = this.memoria;
    const fascia = fasciaDi(impostazioni, ora);
    const esito =
      memoria.esito && ora - Number(memoria.esito.alle || 0) < ESITO_VALE ? memoria.esito : null;
    return {
      attiva: impostazioni.attiva,
      impostazioni,
      sessione: memoria.sessione
        ? {
            inizio: memoria.sessione.inizio,
            fine: memoria.sessione.fine,
            modo: memoria.sessione.modoMesso,
            socInizio: memoria.sessione.socInizio,
            kwh: memoria.sessione.kwhNoti
              ? Math.round(memoria.sessione.caricati * 100) / 100
              : null,
          }
        : null,
      esito,
      notteChiusa: memoria.chiusa === fascia.notte,
      fascia: {
        dentro: fascia.dentro,
        inizio: fascia.inizio,
        fine: fascia.fine,
        notte: fascia.notte,
      },
      prossima: prossimaFascia(impostazioni, ora),
      auto,
      evcc: Boolean(entita.modo),
      prezzo,
      adesso: ora,
    };
  }

  riconosce(tipo) {
    return tipo === COMANDO_DELLO_STATO;
  }

  /* `utente`: chi sta dall'altra parte, gia' riconosciuto dal ponte. Senza un
   * nome non si risponde: e' un comando della plancia, e la plancia la apre
   * qualcuno che Home Assistant conosce. */
  rispondi(detto, { utente = "" } = {}) {
    const id = detto?.id ?? null;
    if (!String(utente || "").trim())
      return {
        id,
        type: "result",
        success: false,
        error: { code: "unauthorized", message: "la ricarica di notte la vede chi e' entrato" },
      };
    if (detto?.type !== COMANDO_DELLO_STATO)
      return {
        id,
        type: "result",
        success: false,
        error: { code: "unknown_command", message: `non conosco ${detto?.type}` },
      };
    try {
      return { id, type: "result", success: true, result: this.stato() };
    } catch (errore) {
      this.registro.errore(`ricarica di notte: ${errore?.message || errore}`);
      return {
        id,
        type: "result",
        success: false,
        error: { code: "ponte_ricarica", message: "non ha funzionato" },
      };
    }
  }
}
