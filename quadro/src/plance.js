/* Le plance delle case, com'e' fatta ognuna e cosa le e' stato chiesto.
 *
 * Una casa che ha acceso `quadro_configurazione` manda al cruscotto com'e'
 * fatta la sua plancia — sezioni, stanze, entita', disposizione — e da qui
 * chi installa la puo' riscrivere. Questo file e' il deposito di tutt'e due i
 * versi: gli **scatti**, cioe' la configurazione com'e' arrivata da casa, e le
 * **chieste**, cioe' quella che l'installatore ha scritto e che la casa passa
 * a ritirare al prossimo rapporto.
 *
 * ─── Un file per casa, e non una riga nell'archivio ─────────────────────
 *
 * L'archivio delle case si legge a ogni richiesta e si riscrive a ogni
 * rapporto, cioe' ogni minuto per ogni casa. Una configurazione puo' pesare
 * megabyte: dentro quel JSON vorrebbe dire riscrivere megabyte al minuto per
 * far cambiare una data. Sta in `plance/<casa>.json`, si apre quando serve, e
 * quando una casa non si segue piu' se ne va con lei.
 *
 * ─── Quello che qui non c'e' ────────────────────────────────────────────
 *
 * Nessuna immagine. Gli scatti arrivano gia' passati al setaccio di casa
 * (`ponte/src/plancia-da-lontano.js`), e qui non c'e' nessuna via che apra un
 * flusso: il cruscotto tiene un JSON, e lo restituisce a chi puo' leggerlo.
 */

import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Archivio } from "./archivio.js";

/** Il nome di un profilo, come lo scrive il ponte. */
export const PROFILO_BUONO = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Quanto pesa al massimo una configurazione, in byte: come nel ponte. */
export const PLANCIA_MASSIMA = 8 * 1024 * 1024;

/** Quante plance si tengono per casa: come nel ponte. */
export const PROFILI_AL_MASSIMO = 8;

const CASA_BUONA = /^casa_[0-9a-f]{32}$/;

/* Un indirizzo di flusso, o un gettone: copia di `ponte/src/plancia-da-lontano.js`,
 * e dev'essere la stessa — la casa ricontrolla per conto suo, e due setacci
 * diversi vorrebbero dire un rifiuto che uno dei due non spiega. */
const FLUSSO = /^\s*(?:rtsps?|rtmps?|srt|webrtc|mjpe?g):\/\//i;
const GETTONE = /(?:^|[?&#;])(?:access_token|auth_sig|authsig|auth|token|signature)=/i;
const eUnFlusso = (valore) =>
  typeof valore === "string" && (FLUSSO.test(valore) || GETTONE.test(valore));

/** Se dentro questi valori, a qualunque profondita', c'e' un flusso. */
export function haFlussi(valori) {
  if (eUnFlusso(valori)) return true;
  if (Array.isArray(valori)) return valori.some((uno) => haFlussi(uno));
  if (valori && typeof valori === "object")
    return Object.values(valori).some((uno) => haFlussi(uno));
  return false;
}

const testo = (valore, quanto = 120) =>
  String(valore ?? "")
    .trim()
    .slice(0, quanto);

const intero = (valore) => {
  const numero = Number(valore);
  return Number.isFinite(numero) && numero >= 0 ? Math.floor(numero) : 0;
};

export class PlanceDelleCase {
  constructor({ cartella = "./dati", adesso = () => Date.now() } = {}) {
    this.cartella = join(cartella, "plance");
    this.adesso = adesso;
    /* Gli archivi aperti, uno per casa: si aprono al primo uso e restano. */
    this._aperti = new Map();
  }

  _dove(casa) {
    return join(this.cartella, `${casa}.json`);
  }

  _archivio(casa) {
    if (!CASA_BUONA.test(casa)) throw new Error("questa non e' una matricola");
    let suo = this._aperti.get(casa);
    if (!suo) {
      suo = new Archivio(this._dove(casa), { scatti: {}, chieste: {} });
      if (!suo.dati.scatti || typeof suo.dati.scatti !== "object") suo.dati.scatti = {};
      if (!suo.dati.chieste || typeof suo.dati.chieste !== "object") suo.dati.chieste = {};
      this._aperti.set(casa, suo);
    }
    return suo;
  }

  /** Se di questa casa c'e' gia' qualcosa su disco, senza aprirlo. */
  _cE(casa) {
    return this._aperti.has(casa) || existsSync(this._dove(casa));
  }

  /**
   * Com'e' fatta una plancia, arrivata da casa.
   *
   * Si tiene l'ultimo scatto per profilo: la storia la tiene la casa, che ne
   * conserva cinque revisioni, e qui ne serve una — quella da far vedere.
   */
  prendi(casa, { profilo, titolo = "", revisione = 0, valori } = {}) {
    if (!PROFILO_BUONO.test(String(profilo ?? ""))) return null;
    if (!valori || typeof valori !== "object" || Array.isArray(valori)) return null;
    const suo = this._archivio(casa);
    /* Al massimo tante quante ne puo' avere una casa: un profilo in piu' di
     * una casa che ne ha gia' otto non e' una plancia, e' un errore. */
    if (!suo.dati.scatti[profilo] && Object.keys(suo.dati.scatti).length >= PROFILI_AL_MASSIMO) {
      return null;
    }
    suo.dati.scatti[profilo] = {
      profilo,
      titolo: testo(titolo, 40),
      revisione: intero(revisione),
      presoIl: this.adesso(),
      valori,
    };
    suo.salva();
    return this.scatto(casa, profilo);
  }

  /** Lo scatto di una plancia, con la richiesta in attesa se c'e'. */
  scatto(casa, profilo) {
    if (!this._cE(casa)) return null;
    const suo = this._archivio(casa);
    const scatto = suo.dati.scatti[profilo];
    if (!scatto) return null;
    return { ...scatto, chiesta: this.chiesta(casa, profilo) };
  }

  /** Di ogni plancia di questa casa: profilo, titolo e revisione — senza i valori. */
  scatti(casa) {
    if (!this._cE(casa)) return [];
    const suo = this._archivio(casa);
    return Object.values(suo.dati.scatti).map(({ profilo, titolo, revisione, presoIl }) => ({
      profilo,
      titolo,
      revisione,
      presoIl,
    }));
  }

  /**
   * Quali plance il cruscotto vuole, guardando cosa la casa dice di avere.
   *
   * Quelle di cui non ha uno scatto, e quelle di cui la casa dichiara una
   * revisione diversa da quella depositata: la casa le manda al giro dopo, e
   * solo quelle. Un elenco vuoto vuol dire «sono a posto».
   */
  quali(casa, elenco) {
    if (!Array.isArray(elenco)) return [];
    const scatti = new Map(this.scatti(casa).map((uno) => [uno.profilo, uno.revisione]));
    return elenco
      .filter((una) => una && PROFILO_BUONO.test(String(una.profilo ?? "")))
      .slice(0, PROFILI_AL_MASSIMO)
      .filter(
        (una) => !scatti.has(una.profilo) || scatti.get(una.profilo) !== intero(una.revisione),
      )
      .map((una) => una.profilo);
  }

  /**
   * Quello che l'installatore vuole scrivere in una plancia. Una per profilo:
   * scriverne un'altra prima che la casa abbia ritirato la prima la sostituisce.
   */
  chiedi(casa, profilo, { id, valori, revisioneAttesa = null } = {}) {
    if (!PROFILO_BUONO.test(String(profilo ?? ""))) return null;
    if (!id || !valori || typeof valori !== "object" || Array.isArray(valori)) return null;
    const suo = this._archivio(casa);
    suo.dati.chieste[profilo] = {
      id: testo(id, 60),
      profilo,
      valori,
      revisioneAttesa: revisioneAttesa === null ? null : intero(revisioneAttesa),
      chiestaIl: this.adesso(),
    };
    suo.salva();
    return this.chiesta(casa, profilo);
  }

  /** La richiesta in attesa su una plancia, senza i valori: quelli li ritira la casa. */
  chiesta(casa, profilo) {
    if (!this._cE(casa)) return null;
    const suo = this._archivio(casa);
    const chiesta = suo.dati.chieste[profilo];
    if (!chiesta) return null;
    const { valori: _valori, ...resto } = chiesta;
    return resto;
  }

  /**
   * La configurazione da consegnare alla casa che passa a ritirarla.
   *
   * Solo se l'`id` e' quello del lavoro che le e' stato consegnato: cosi' una
   * casa non ritira una richiesta scritta dopo, per un lavoro che non le e'
   * ancora stato dato. Si consegna e si toglie: ritirata una volta, com'e'
   * andata lo racconta la casa nel rapporto.
   */
  daConsegnare(casa, profilo, id) {
    if (!this._cE(casa)) return null;
    const suo = this._archivio(casa);
    const chiesta = suo.dati.chieste[profilo];
    if (!chiesta || !id || chiesta.id !== String(id)) return null;
    delete suo.dati.chieste[profilo];
    suo.salva();
    return {
      id: chiesta.id,
      profilo,
      valori: chiesta.valori,
      revisioneAttesa: chiesta.revisioneAttesa,
    };
  }

  /** L'installatore ci ripensa: la richiesta si toglie, se c'e'. */
  dimenticaLaChiesta(casa, profilo) {
    if (!this._cE(casa)) return false;
    const suo = this._archivio(casa);
    if (!suo.dati.chieste[profilo]) return false;
    delete suo.dati.chieste[profilo];
    suo.salva();
    return true;
  }

  /** Una casa che non si segue piu' si porta via le sue plance. */
  butta(casa) {
    this._aperti.delete(casa);
    if (!CASA_BUONA.test(casa)) return false;
    const dove = this._dove(casa);
    if (!existsSync(dove)) return false;
    rmSync(dove, { force: true });
    return true;
  }
}
