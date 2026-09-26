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
 * ─── L'inventario, per l'editor ─────────────────────────────────────────
 *
 * Dalla 1.5.9.14 con lo scatto arriva anche **cosa c'e'** in casa — le
 * entita' con le loro capacita', i dispositivi, le stanze — perche' l'editor
 * vero della plancia, aperto dal cruscotto, deve poter scegliere una presa
 * dall'elenco e metterla in una stanza. Uno per casa, non per plancia. Mai
 * gli stati: la casa li toglie prima di partire (`ponte/src/inventario.js`)
 * e qui si ritolgono con lo stesso setaccio, che ne e' una copia identica.
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
import { eUnInventario, inventarioSenzaDati } from "./inventario.js";

/** Il nome di un profilo, come lo scrive il ponte. */
export const PROFILO_BUONO = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Quanto pesa al massimo una configurazione, in byte: come nel ponte. */
export const PLANCIA_MASSIMA = 8 * 1024 * 1024;

/** Quante plance si tengono per casa: come nel ponte. */
export const PROFILI_AL_MASSIMO = 8;

/* Quanto pesa, al massimo, tutto quello che si tiene di una casa: gli scatti,
 * le configurazioni in attesa, l'inventario. Senza, otto plance da otto MiB
 * l'una facevano sessantaquattro MiB per casa, su disco e in memoria. Una
 * plancia vera sta nelle decine di KiB: questo tetto non lo tocca nessuno che
 * non lo stia cercando. */
export const UNA_CASA_AL_MASSIMO = 16 * 1024 * 1024;

/* Quanti archivi di casa si tengono aperti in memoria. Oltre, se ne chiude il
 * meno usato: e' tutto su disco, e riaprirlo costa una lettura. */
export const APERTI_AL_MASSIMO = 32;

const CASA_BUONA = /^casa_[0-9a-f]{32}$/;

/* Un indirizzo di flusso, o un gettone: copia di `ponte/src/plancia-da-lontano.js`,
 * e dev'essere la stessa — la casa ricontrolla per conto suo, e due setacci
 * diversi vorrebbero dire un rifiuto che uno dei due non spiega. */
const FLUSSO = /\b(?:rtsps?|rtmps?|srt|webrtc|mjpe?g):\/\//i;
const FLUSSO_HTTP =
  /\bhttps?:\/\/[^\s"'<>]*(?:\.m3u8|\/mjpe?g|\/api\/(?:stream|ws|webrtc|frame)|\/stream\.)/i;
const GETTONE = /(?:^|[?&#;])(?:access_token|auth_sig|authsig|auth|token|signature)=/i;
const eUnFlusso = (valore) =>
  typeof valore === "string" &&
  (FLUSSO.test(valore) || FLUSSO_HTTP.test(valore) || GETTONE.test(valore));

/* Dentro una plancia i valori sono testi JSON: il setaccio ci guarda dentro,
 * o un «rtsp://» in mezzo a un elenco passerebbe. */
function dentro(testo) {
  if (typeof testo !== "string") return undefined;
  const pulito = testo.trim();
  if (!pulito.startsWith("{") && !pulito.startsWith("[")) return undefined;
  try {
    const letto = JSON.parse(pulito);
    return letto && typeof letto === "object" ? letto : undefined;
  } catch (_errore) {
    return undefined;
  }
}

/** Se dentro questi valori, a qualunque profondita', c'e' un flusso. */
export function haFlussi(valori) {
  if (typeof valori === "string") {
    /* Prima si guarda se e' un testo JSON: un flusso in mezzo a un elenco
     * e' un flusso di quell'elemento, non dell'elenco intero. */
    const suo = dentro(valori);
    return suo ? haFlussi(suo) : eUnFlusso(valori);
  }
  if (Array.isArray(valori)) return valori.some((uno) => haFlussi(uno));
  if (valori && typeof valori === "object")
    return Object.values(valori).some((uno) => haFlussi(uno));
  return false;
}

/** Gli stessi valori senza i flussi: al loro posto una stringa vuota. */
export function senzaFlussi(valori) {
  if (typeof valori === "string") {
    const suo = dentro(valori);
    if (suo) return haFlussi(suo) ? JSON.stringify(senzaFlussi(suo)) : valori;
    return eUnFlusso(valori) ? "" : valori;
  }
  if (Array.isArray(valori)) return valori.map((uno) => senzaFlussi(uno));
  if (valori && typeof valori === "object") {
    return Object.fromEntries(
      Object.entries(valori).map(([chiave, uno]) => [chiave, senzaFlussi(uno)]),
    );
  }
  return valori;
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
    /* Gli archivi aperti, uno per casa: si aprono al primo uso, e restano
     * finche' non sono fra i meno usati (`APERTI_AL_MASSIMO`). La mappa tiene
     * l'ordine d'uso: chi si usa torna in fondo, chi e' in cima se ne va. */
    this._aperti = new Map();
    /* Le plance di cui il cruscotto vuole uno scatto **adesso**, anche se
     * la revisione e' la stessa: chi apre l'editor vuole com'e' fatta la
     * plancia oggi, e l'inventario di oggi. In memoria: se il quadro si
     * riavvia la richiesta si perde, e chi ha l'editor aperto la rifa'. */
    this._daRinfrescare = new Map();
  }

  _dove(casa) {
    return join(this.cartella, `${casa}.json`);
  }

  _archivio(casa) {
    if (!CASA_BUONA.test(casa)) throw new Error("questa non e' una matricola");
    let suo = this._aperti.get(casa);
    if (suo) {
      this._aperti.delete(casa);
    } else {
      suo = new Archivio(this._dove(casa), { scatti: {}, chieste: {}, inventario: null });
      if (!suo.dati.scatti || typeof suo.dati.scatti !== "object") suo.dati.scatti = {};
      if (!suo.dati.chieste || typeof suo.dati.chieste !== "object") suo.dati.chieste = {};
      while (this._aperti.size >= APERTI_AL_MASSIMO) {
        this._aperti.delete(this._aperti.keys().next().value);
      }
    }
    this._aperti.set(casa, suo);
    return suo;
  }

  /* Quanto pesa l'archivio di una casa, com'e' adesso in memoria. */
  _quantoPesa(suo) {
    try {
      return Buffer.byteLength(JSON.stringify(suo.dati));
    } catch (_errore) {
      return Infinity;
    }
  }

  /* Tenta un cambio: se l'archivio di questa casa passerebbe il tetto, lo si
   * rimette com'era e si dice di no. */
  _staDentro(suo, cambia) {
    const prima = structuredClone(suo.dati);
    cambia();
    if (this._quantoPesa(suo) <= UNA_CASA_AL_MASSIMO) return true;
    suo.dati = prima;
    return false;
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
  prendi(
    casa,
    {
      profilo,
      titolo = "",
      revisione = 0,
      chiavi = 0,
      generazione = 0,
      aggiornataIl = 0,
      valori,
      inventario = null,
    } = {},
  ) {
    if (!PROFILO_BUONO.test(String(profilo ?? ""))) return null;
    if (!valori || typeof valori !== "object" || Array.isArray(valori)) return null;
    const suo = this._archivio(casa);
    /* Al massimo tante quante ne puo' avere una casa: un profilo in piu' di
     * una casa che ne ha gia' otto non e' una plancia, e' un errore. */
    if (!suo.dati.scatti[profilo] && Object.keys(suo.dati.scatti).length >= PROFILI_AL_MASSIMO) {
      return null;
    }
    const scatto = {
      profilo,
      titolo: testo(titolo, 40),
      revisione: intero(revisione),
      /* I tre numeri della generazione dello scatto, per l'editor: senza,
       * alla prima apertura riscriverebbe la plancia per «aggiornarla». */
      chiavi: intero(chiavi),
      generazione: intero(generazione),
      aggiornataIl: intero(aggiornataIl),
      presoIl: this.adesso(),
      /* La casa li toglie prima di partire; qui si ritoglie quello che fosse
       * passato lo stesso. All'installatore un flusso non si fa vedere. */
      valori: senzaFlussi(valori),
    };
    /* Uno scatto che fa passare alla casa il suo tetto non si prende. */
    if (!this._staDentro(suo, () => (suo.dati.scatti[profilo] = scatto))) return null;
    /* L'inventario: ripassato dal setaccio, e tenuto uno per casa. Se questo
     * scatto non lo porta resta quello di prima. */
    if (eUnInventario(inventario)) {
      const nuovo = { ...inventarioSenzaDati(inventario), presoIl: this.adesso() };
      /* Un inventario che non ci sta si lascia fuori, e lo scatto resta. */
      this._staDentro(suo, () => (suo.dati.inventario = nuovo));
    }
    this._daRinfrescare.get(casa)?.delete(profilo);
    suo.salva();
    return this.scatto(casa, profilo);
  }

  /** L'inventario di una casa, com'e' arrivato l'ultima volta, o `null`. */
  inventario(casa) {
    if (!this._cE(casa)) return null;
    const suo = this._archivio(casa);
    return eUnInventario(suo.dati.inventario) ? suo.dati.inventario : null;
  }

  /**
   * Il cruscotto vuole lo scatto di questa plancia adesso, e l'inventario con
   * lui: la casa lo manda al passaggio dopo anche se la revisione non e'
   * cambiata. Si toglie quando lo scatto arriva.
   */
  rinfresca(casa, profilo) {
    if (!CASA_BUONA.test(casa) || !PROFILO_BUONO.test(String(profilo ?? ""))) return false;
    if (!this._daRinfrescare.has(casa)) this._daRinfrescare.set(casa, new Set());
    this._daRinfrescare.get(casa).add(profilo);
    return true;
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
    const volute = this._daRinfrescare.get(casa) ?? new Set();
    return elenco
      .filter((una) => una && PROFILO_BUONO.test(String(una.profilo ?? "")))
      .slice(0, PROFILI_AL_MASSIMO)
      .filter(
        (una) =>
          volute.has(una.profilo) ||
          !scatti.has(una.profilo) ||
          scatti.get(una.profilo) !== intero(una.revisione),
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
    const chiesta = {
      id: testo(id, 60),
      profilo,
      valori,
      revisioneAttesa: revisioneAttesa === null ? null : intero(revisioneAttesa),
      chiestaIl: this.adesso(),
    };
    if (!this._staDentro(suo, () => (suo.dati.chieste[profilo] = chiesta))) return null;
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
    this._daRinfrescare.delete(casa);
    if (!CASA_BUONA.test(casa)) return false;
    const dove = this._dove(casa);
    if (!existsSync(dove)) return false;
    rmSync(dove, { force: true });
    return true;
  }
}
