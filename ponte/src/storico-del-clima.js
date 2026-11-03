/* Lo storico del clima, messo da parte dalla casa.
 *
 * «Recupera anche dati storici altrimenti non ha senso.» Il report del clima
 * conta il tempo dalla storia di Home Assistant, e la storia di Home
 * Assistant di solito dura dieci giorni: a novembre il luglio scorso non
 * c'era piu'. Il ponte gira sempre, anche a plance chiuse, e quindi puo' fare
 * quello che la plancia non puo': ogni ora guarda se c'e' un giorno chiuso
 * che non ha ancora riassunto e, finche' la storia ce l'ha, lo riassume e lo
 * mette in `/data/clima-storico.json`. Alla prima accensione recupera tutti i
 * giorni che la storia ha ancora, e rifa' quelli fatti con un conto di prima
 * (`CONTO_DEL_RIASSUNTO`) finche' la storia li ha.
 *
 * Il conto e' quello della plancia (`plancia/src/core/storico-del-clima.js`,
 * `riassuntoDelGiorno`): una regola sola, cosi' il giorno messo da parte dice
 * quello che il report avrebbe detto quel giorno. Per ogni giorno, per il
 * Riscaldamento e per il Raffrescamento: le stanze (minuti di richiesta, di
 * accensione, di comfort; temperatura, obiettivo e valvola medi col loro
 * peso; la richiesta ora per ora), le caldaie (minuti e accensioni) e la
 * stima dell'impianto. Tre anni di giorni, sessanta di ore: oltre, il giorno
 * resta e le sue ore no (`potaLArchivio`).
 *
 * Le unita' e le caldaie le legge dalla configurazione della plancia
 * principale, come la ricarica di notte; gli attributi di adesso (per
 * riconoscere un termostato a coppia) dallo specchio della casa che le
 * notifiche tengono gia'.
 *
 * Alla plancia si risponde con un comando solo, in sola lettura,
 * `ponte/clima/storico` con `da` e `a` (due giorni, «2026-07-01»): i giorni
 * in mezzo. Lo chiede solo chi sul filo ha un nome.
 */

import { join } from "node:path";

import { Archivio } from "./archivio.js";
import { PROFILO_PRINCIPALE } from "./configurazione.js";
import { risolutoreDalla } from "./ricarica-di-notte.js";
import { IMPIANTI_DEL_CLIMA, righeDellaStoria } from "../plancia/src/core/report-del-clima.js";
import { conIlConsumoTrovato } from "../plancia/src/core/consumo-trovato-del-clima.js";
import {
  CONTO_DEL_RIASSUNTO,
  caldaieDallaConfigurazione,
  chiaveDelGiorno,
  contoDelGiorno,
  giorniFra,
  potaLArchivio,
  riassuntoDelGiorno,
  unitaDallaConfigurazione,
} from "../plancia/src/core/storico-del-clima.js";

/* Ogni quanto si guarda: un giorno si chiude a mezzanotte, e un'ora dopo e'
 * gia' al sicuro. La prima volta un minuto dopo l'accensione, quando la casa
 * ha avuto il tempo di rispondere. */
const BATTITO = 60 * 60_000;
const PRIMA_VOLTA = 60_000;

/* Quanti giorni indietro si prova a recuperare: la storia di serie ne tiene
 * dieci, e chi l'ha allungata ne avra' di piu'. Oltre i trenta la domanda
 * pesa troppo sul Recorder per una volta sola. */
export const GIORNI_DA_RECUPERARE = 30;

/* La storia si chiede a pezzi di tre giorni: un termostato che scrive ogni
 * minuto, con gli attributi, in trenta giorni sono decine di migliaia di
 * righe, e un Recorder su una scheda SD non le manda in un minuto. */
export const GIORNI_PER_DOMANDA = 3;
const ATTESA_DELLA_STORIA = 60_000;

export const COMANDO_DELLO_STORICO = "ponte/clima/storico";
export const FILE_DELLO_STORICO = "clima-storico.json";

const pulito = (valore) => String(valore ?? "").trim();
const CHIAVE = /^\d{4}-\d{2}-\d{2}$/;

export class StoricoDelClima {
  constructor({
    cartella = "",
    casa = null,
    configurazione = null,
    /* Lo stato di un'entita', dallo specchio della casa: `{ state, attributes }`. */
    stati = () => null,
    /* I registri di Home Assistant (`registri.js`): di che dispositivo e'
     * ogni entita'. Senza, i watt si prendono solo dalla scheda. */
    registri = null,
    registro = null,
    adesso = () => Date.now(),
    ogni = (quanto, cosa) => setInterval(cosa, quanto),
    fra = (quanto, cosa) => setTimeout(cosa, quanto),
    smetti = (segno) => {
      clearInterval(segno);
      clearTimeout(segno);
    },
  } = {}) {
    this._suDisco = Boolean(cartella);
    this.archivio = new Archivio(cartella ? join(cartella, FILE_DELLO_STORICO) : "", {
      versione: 1,
      giorni: {},
    });
    this.casa = casa;
    this.configurazione = configurazione;
    this.stati = stati;
    this.registri = registri;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this._ogni = ogni;
    this._fra = fra;
    this._smetti = smetti;
    this._battito = null;
    this._primo = null;
    this._inCorso = false;
    /* I giorni che la storia non aveva: non si richiedono a ogni ora. Si
     * dimenticano a un riavvio, che e' quando una storia allungata potrebbe
     * averli. */
    this._vuoti = new Set();
  }

  get giorni() {
    const dati = this.archivio.dati;
    if (!dati.giorni || typeof dati.giorni !== "object" || Array.isArray(dati.giorni))
      dati.giorni = {};
    return dati.giorni;
  }

  _valori() {
    try {
      return this.configurazione?.leggi?.(PROFILO_PRINCIPALE)?.snapshot?.values || {};
    } catch (_errore) {
      return {};
    }
  }

  /**
   * Le unita' col consumo trovato sul loro dispositivo, per quelle che nella
   * scheda non l'hanno: uno split che non dice `hvac_action` racconta le sue
   * ore coi watt, e quel giorno resta nell'archivio cosi'.
   */
  async conIlConsumo(unita) {
    if (!this.registri?.leMappe) return unita;
    let di = {};
    try {
      di = (await this.registri.leMappe())?.di || {};
    } catch (_errore) {
      return unita;
    }
    return conIlConsumoTrovato(unita, { di, stato: (id) => this.stati(id) });
  }

  /** Le unita' e le caldaie, lette adesso dalla configurazione. */
  impianto() {
    const valori = this._valori();
    const risolutore = risolutoreDalla(valori);
    const risolvi = (rif) => risolutore(rif) || rif;
    const unita = unitaDallaConfigurazione(valori, {
      risolvi,
      attributiDi: (id) => this.stati(id)?.attributes || null,
    });
    const generatori = caldaieDallaConfigurazione(valori, { risolvi });
    return { unita, generatori };
  }

  _salva() {
    if (!this._suDisco) return;
    try {
      this.archivio.salva();
    } catch (errore) {
      this.registro.attenzione(`storico del clima non scritto: ${errore?.message || errore}`);
    }
  }

  /* ── l'orologio ───────────────────────────────────────────────────── */

  parti() {
    if (this._battito) return;
    const giro = () =>
      this.battito().catch((errore) =>
        this.registro.attenzione(`storico del clima: ${errore?.message || errore}`),
      );
    this._primo = this._fra(PRIMA_VOLTA, giro);
    this._primo?.unref?.();
    this._battito = this._ogni(BATTITO, giro);
    this._battito?.unref?.();
  }

  ferma() {
    if (this._primo) this._smetti(this._primo);
    if (this._battito) this._smetti(this._battito);
    this._primo = null;
    this._battito = null;
  }

  /** I giorni chiusi degli ultimi trenta che non sono ancora nell'archivio,
   * o che ci sono col conto di prima (`CONTO_DEL_RIASSUNTO`): quelli si
   * rifanno, `rifai` vero. */
  giorniDaRiassumere() {
    const oggi = new Date(this.adesso());
    const fuori = [];
    for (let indietro = GIORNI_DA_RECUPERARE; indietro >= 1; indietro -= 1) {
      const inizio = new Date(
        oggi.getFullYear(),
        oggi.getMonth(),
        oggi.getDate() - indietro,
      ).getTime();
      const fine = new Date(
        oggi.getFullYear(),
        oggi.getMonth(),
        oggi.getDate() - indietro + 1,
      ).getTime();
      const chiave = chiaveDelGiorno(inizio);
      if (this._vuoti.has(chiave)) continue;
      const gia = this.giorni[chiave];
      if (gia && contoDelGiorno(gia) >= CONTO_DEL_RIASSUNTO) continue;
      fuori.push({ chiave, inizio, fine, chiuso: true, rifai: Boolean(gia) });
    }
    return fuori;
  }

  /* Un giro: i giorni che mancano, la loro storia in una domanda per entita',
   * un riassunto per giorno e per impianto. Un giorno senza niente si ricorda
   * come vuoto e non si scrive. */
  async battito() {
    if (this._inCorso || !this.casa?.chiedi) return null;
    this._inCorso = true;
    try {
      const giorni = this.giorniDaRiassumere();
      if (!giorni.length) return { scritti: 0 };
      const { unita: scritte, generatori } = this.impianto();
      const unita = await this.conIlConsumo(scritte);
      const entita = [
        ...new Set([
          ...unita.map((u) => u.entity),
          ...unita.map((u) => u.valvola).filter(Boolean),
          /* I watt, per i giorni senza `hvac_action`. */
          ...unita.map((u) => u.consumo).filter(Boolean),
          ...generatori.map((g) => g.entity),
        ]),
      ];
      if (!entita.length) return { scritti: 0 };
      let scritti = 0;
      const adesso = this.adesso();
      for (let i = 0; i < giorni.length; i += GIORNI_PER_DOMANDA) {
        const pezzo = giorni.slice(i, i + GIORNI_PER_DOMANDA);
        const storie = await this._storie(entita, pezzo[0].inizio, pezzo.at(-1).fine);
        /* Se la casa non ha risposto a niente non si sa niente: non si
         * segnano vuoti giorni che magari ci sono. */
        if (!storie) continue;
        for (const giorno of pezzo) {
          const riassunti = {};
          for (const impianto of IMPIANTI_DEL_CLIMA) {
            const record = riassuntoDelGiorno({
              impianto,
              unita,
              storie,
              generatori,
              giorno,
              adesso,
            });
            if (record) riassunti[impianto] = record;
          }
          /* Senza storia un giorno col conto di prima resta com'e': meglio
           * quello di niente. Si segna, per non richiederlo a ogni ora. */
          if (!Object.keys(riassunti).length) {
            this._vuoti.add(giorno.chiave);
            continue;
          }
          this.giorni[giorno.chiave] = riassunti;
          scritti += 1;
        }
      }
      if (scritti) {
        this.archivio.dati = {
          versione: 1,
          giorni: potaLArchivio(this.giorni, adesso),
        };
        this._salva();
        this.registro.info(`storico del clima: ${scritti} giorni messi da parte`);
      }
      return { scritti };
    } finally {
      this._inCorso = false;
    }
  }

  /* La storia di tutte le entita' fra due istanti, una domanda per entita':
   * `null` se non e' arrivata nessuna risposta. */
  async _storie(entita, da, a) {
    const storie = {};
    let risposte = 0;
    for (const entity of entita) {
      try {
        const risposta = await this.casa.chiedi(
          {
            type: "history/history_during_period",
            start_time: new Date(da).toISOString(),
            end_time: new Date(a).toISOString(),
            entity_ids: [entity],
            include_start_time_state: true,
            significant_changes_only: false,
            minimal_response: false,
            no_attributes: false,
          },
          { entro: ATTESA_DELLA_STORIA },
        );
        storie[entity] = righeDellaStoria(risposta, entity);
        risposte += 1;
      } catch (errore) {
        this.registro.attenzione(
          `storico del clima: la storia di ${entity} non e' arrivata (${errore?.message || errore})`,
        );
      }
    }
    return risposte ? storie : null;
  }

  /* ── quello che si dice alla plancia ──────────────────────────────── */

  riconosce(tipo) {
    return tipo === COMANDO_DELLO_STORICO;
  }

  /** I giorni fra `da` e `a`, e il primo e l'ultimo che l'archivio ha. */
  storico(da = "", a = "") {
    const chiavi = Object.keys(this.giorni).sort();
    return {
      giorni: giorniFra(this.giorni, da, a),
      primo: chiavi[0] || null,
      ultimo: chiavi.at(-1) || null,
    };
  }

  rispondi(detto, { utente = "" } = {}) {
    const id = detto?.id ?? null;
    if (!pulito(utente))
      return {
        id,
        type: "result",
        success: false,
        error: { code: "unauthorized", message: "lo storico del clima lo vede chi e' entrato" },
      };
    if (detto?.type !== COMANDO_DELLO_STORICO)
      return {
        id,
        type: "result",
        success: false,
        error: { code: "unknown_command", message: `non conosco ${detto?.type}` },
      };
    const da = pulito(detto?.da);
    const a = pulito(detto?.a);
    if ((da && !CHIAVE.test(da)) || (a && !CHIAVE.test(a)))
      return {
        id,
        type: "result",
        success: false,
        error: { code: "invalid_format", message: "i giorni si scrivono AAAA-MM-GG" },
      };
    try {
      return { id, type: "result", success: true, result: this.storico(da, a) };
    } catch (errore) {
      this.registro.errore(`storico del clima: ${errore?.message || errore}`);
      return {
        id,
        type: "result",
        success: false,
        error: { code: "ponte_storico", message: "non ha funzionato" },
      };
    }
  }
}
