/* Chi ha montato questo impianto, visto da dentro casa.
 *
 * Una casa abbinata sa due cose del suo installatore: **come si chiama** e, se
 * ce l'ha messo, **che logo ha**. Non le sa perche' gliele abbiamo scritte
 * noi: gliele dice il quadro rispondendo al rapporto, ogni minuto.
 *
 * Servono a una cosa sola, ed e' quella che chiede chi installa per mestiere:
 * la plancia di un suo cliente porta il **suo** nome e il **suo** segno. Chi
 * ci abita, quando ha un problema, chiama lui — e allora e' il suo nome quello
 * che deve avere davanti.
 *
 * ─── Il logo lo scarica il ponte, non il browser ─────────────────────────
 *
 * Il quadro serve quel file a chiunque, senza chiave, e la casa potrebbe
 * lasciarlo prendere direttamente al browser di chi ci abita. Non si fa: ogni
 * volta che qualcuno apre la plancia, quel browser andrebbe a farsi vedere da
 * una macchina che non e' la sua — e chi tiene il quadro si troverebbe in mano
 * gli orari in cui in quella casa si guarda la plancia, senza averli chiesti e
 * senza che nessuno glieli abbia dati.
 *
 * Quindi lo prende il ponte, una volta, e lo tiene in `/data`. Da li' in poi
 * lo serve lui, dalla rete di casa, e da fuori non si vede niente.
 *
 * ─── Cosa si accetta ─────────────────────────────────────────────────────
 *
 * Il quadro dice **una matricola**, non un indirizzo, e l'indirizzo se lo
 * compone questa casa col quadro che ha gia' in configurazione. E' la stessa
 * regola del marchio di un aggiornamento, e per lo stesso motivo: se di li'
 * passasse un indirizzo, sarebbe il quadro a decidere dove va a bussare questa
 * casa.
 *
 * E si guarda **come comincia il file**: un `.png` che dentro e' altro resta
 * altro, e questo finisce dentro la pagina che apre chi ci abita.
 *
 * ─── Le vesti delle plance ───────────────────────────────────────────────
 *
 * Nella stessa risposta, se chi installa le ha scelte dal cruscotto, arrivano
 * le **vesti** di ogni plancia di questa casa: il titolo, che va nel menu
 * laterale e in cima alla home, e la parola del velo, quella che compare col
 * logo mentre la pagina si apre. Plancia per plancia, con la chiave del
 * profilo. Il nome di chi installa da solo non va piu' da nessuna parte: va
 * quello che ha scelto, e dove non ha scelto niente resta com'era.
 *
 * Stanno su disco, e non solo in memoria come il nome: il velo si vede
 * **prima** che parta il primo rapporto, e una casa che si riavvia deve aprire
 * la plancia gia' vestita.
 */

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { cheImmagineE } from "./marchio.js";

/** Come e' fatta la matricola di un installatore. La stessa del quadro. */
export const CHI_VALIDO = /^inst_[0-9a-f]{16}$/;

/** Piu' di cosi' non e' un logo. La stessa misura che il quadro accetta. */
export const QUANTO_GROSSO = 128 * 1024;

/** Quanto si aspetta il quadro per un logo. Non e' roba urgente. */
const ATTESA = 10_000;

/* Ogni quanto si va a riguardare se quel logo e' cambiato. Un logo cambia una
 * volta ogni mai, e la casa parla col quadro ogni minuto: riscaricarlo spesso
 * sarebbe traffico per niente. Un giorno. */
const OGNI_TANTO = 24 * 60 * 60 * 1000;

/** Com'e' fatto il profilo di una plancia. La stessa regola di `plance.js`. */
export const PROFILO_VALIDO = /^[a-z0-9][a-z0-9-]{0,40}$/;

/* Quanto puo' essere lungo un nome scelto, e quante plance si vestono al
 * massimo: le stesse misure delle plance (`TITOLO_MASSIMO`, `QUANTE_AL_MASSIMO`). */
const UN_NOME_AL_MASSIMO = 40;
const VESTI_AL_MASSIMO = 8;
const LE_VESTI = "vesti.json";

/* Un nome che finisce in una pagina: via i segni che li' vogliono dire
 * qualcosa. Lo stesso che fa `marchio.js` col nome, rifatto qui perche' fra
 * il quadro e questa casa c'e' una rete, e un controllo da una parte sola non
 * e' un controllo. */
function unNome(testo) {
  return String(testo ?? "")
    .replace(/[<>"'&]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, UN_NOME_AL_MASSIMO);
}

/**
 * Le vesti come le manda il quadro, ripulite: `{profilo: {titolo, velo}}`.
 *
 * Quello che non e' un profilo, o non ha ne' titolo ne' velo, non entra. Le
 * chiavi tornano in ordine, cosi' due mappe uguali si scrivono uguali e
 * «e' cambiato qualcosa?» si chiede confrontando due stringhe.
 */
export function vestiPulite(grezze) {
  const pulite = {};
  if (!grezze || typeof grezze !== "object" || Array.isArray(grezze)) return pulite;
  for (const profilo of Object.keys(grezze).sort()) {
    const una = grezze[profilo];
    if (!PROFILO_VALIDO.test(profilo) || !una || typeof una !== "object") continue;
    const titolo = unNome(una.titolo);
    const velo = unNome(una.velo);
    if (!titolo && !velo) continue;
    /* `nuova`: una plancia che ancora non c'e', e che la casa deve creare.
     * Vedi `Plance.vesti`. */
    pulite[profilo] = { titolo, velo, ...(una.nuova === true ? { nuova: true } : {}) };
    if (Object.keys(pulite).length >= VESTI_AL_MASSIMO) break;
  }
  return pulite;
}

/* Che immagine e' questa, guardando come comincia: sta in `marchio.js`, che
 * e' chi la serve, e si riprende da li'. Una regola sola per chi la accetta e
 * per chi la serve. */
export { cheImmagineE };

export class Installatore {
  constructor({
    cartella = "/data",
    quadro = "",
    registro = null,
    prendi = globalThis.fetch,
    adesso = () => Date.now(),
    ogniTanto = OGNI_TANTO,
  } = {}) {
    this.cartella = join(cartella, "installatore");
    this.quadro = String(quadro || "").replace(/\/+$/, "");
    this.registro = registro ?? { debug() {}, info() {}, attenzione() {}, errore() {} };
    this.prendi = prendi;
    this.adesso = adesso;
    this.ogniTanto = ogniTanto;
    this._nome = "";
    this._chi = "";
    this._logo = null;
    this._tipo = "";
    this._presoIl = 0;
    this._riletto = false;
    /* Le vesti delle plance, e se le si e' gia' lette dal disco. */
    this._vesti = {};
    this._vestiLette = false;
    /* Chi va avvisato quando le vesti cambiano: le plance, che devono
     * mettersi il titolo scelto nel menu laterale. Si monta dopo, perche'
     * quelle nascono piu' tardi. */
    this.alVestire = null;
  }

  /** Come si chiama, o vuoto: non c'e' nessun installatore, o non l'ha detto. */
  get nome() {
    return this._nome;
  }

  /** Le vesti di tutte le plance, com'erano nell'ultima risposta buona. */
  get vesti() {
    this._leVestiDalDisco();
    return { ...this._vesti };
  }

  /**
   * Quello che la plancia deve indossare, o `null`.
   *
   * Un caso solo per chi disegna: `null` vuol dire «questa casa porta il nostro
   * marchio», che e' il caso di quasi tutte. Col profilo, porta anche le
   * vesti scelte per **quella** plancia: `titolo` e `velo`, vuoti se chi
   * installa non ha scelto niente.
   */
  vestito(profilo = "") {
    /* Prima si legge quello che sta gia' sul disco — il logo e le vesti — e
     * solo dopo si decide se c'e' qualcosa da indossare: dopo un riavvio il
     * nome arriva col primo rapporto, ma il logo e i nomi scelti ci sono
     * gia', e la plancia deve uscire vestita al primo colpo. */
    this._dalDisco();
    this._leVestiDalDisco();
    const sue = this._vesti[String(profilo || "")] || null;
    if (!this._nome && !this._logo && !sue) return null;
    return {
      nome: this._nome,
      logo: this._logo,
      tipo: this._tipo,
      titolo: sue?.titolo || "",
      velo: sue?.velo || "",
    };
  }

  /**
   * Il quadro ha risposto: ecco chi segue questa casa.
   *
   * Si chiama a ogni rapporto, cioe' ogni minuto: quasi sempre non cambia
   * niente e non si fa niente. Non solleva mai — un logo che non si scarica e'
   * una plancia col nostro marchio, e va molto meglio di una casa che non
   * parte.
   *
   * @param {object} detto `di` (il nome) e `marchio` (la matricola), come li
   *   manda il quadro
   */
  async dice(detto) {
    const nome = String(detto?.di ?? "")
      .trim()
      .slice(0, 80);
    const chi = String(detto?.marchio ?? "").trim();
    const buono = CHI_VALIDO.test(chi) ? chi : "";
    if (nome !== this._nome) {
      this._nome = nome;
      this.registro.info(
        nome ? `questa casa la segue ${nome}` : "questa casa non la segue piu' nessuno",
      );
    }
    /* Le vesti delle plance: quello che chi installa ha scelto per ognuna.
     * Assenti vuol dire «niente di scelto», e allora si tolgono: una risposta
     * buona che non le porta **e'** il modo in cui il quadro dice che non ci
     * sono piu'. */
    this._leVestiDalDisco();
    const vesti = vestiPulite(detto?.vesti);
    if (JSON.stringify(vesti) !== JSON.stringify(this._vesti)) {
      this._vesti = vesti;
      this._scriviLeVesti();
      const quante = Object.keys(vesti).length;
      this.registro.info(
        quante
          ? `le plance si vestono come dice chi le segue (${quante})`
          : "le plance tornano coi loro nomi",
      );
      try {
        this.alVestire?.({ ...vesti });
      } catch (errore) {
        this.registro.attenzione(`le plance non hanno preso le vesti: ${errore?.message}`);
      }
    }
    if (buono !== this._chi) {
      this._chi = buono;
      this._presoIl = 0;
      if (!buono) this.dimentica();
    }
    if (!this._chi) return;
    this._dalDisco();
    if (this._logo && this.adesso() - this._presoIl < this.ogniTanto) return;
    await this._vaiAPrenderlo();
  }

  /** Via il logo: quell'installatore non ce l'ha, o non c'e' piu'. */
  dimentica() {
    this._logo = null;
    this._tipo = "";
    this._presoIl = 0;
    /* L'SVG si butta anche se non si accetta piu': un ponte di ieri puo'
     * averne lasciato uno in `/data`. */
    for (const coda of ["png", "jpg", "webp", "svg"]) {
      rmSync(join(this.cartella, `marchio.${coda}`), { force: true });
    }
  }

  /** Via le vesti: nessuna scelta per nessuna plancia. */
  svesti() {
    this._vesti = {};
    this._vestiLette = true;
    rmSync(join(this.cartella, LE_VESTI), { force: true });
  }

  /* Le vesti che stanno gia' sul disco, lette una volta per accensione: dopo
   * un riavvio il velo deve dire la parola giusta al primo colpo, senza
   * aspettare che il quadro risponda. */
  _leVestiDalDisco() {
    if (this._vestiLette) return;
    this._vestiLette = true;
    try {
      this._vesti = vestiPulite(JSON.parse(readFileSync(join(this.cartella, LE_VESTI), "utf8")));
    } catch (_nonCE) {
      this._vesti = {};
    }
  }

  _scriviLeVesti() {
    try {
      if (Object.keys(this._vesti).length === 0) {
        rmSync(join(this.cartella, LE_VESTI), { force: true });
        return;
      }
      mkdirSync(this.cartella, { recursive: true });
      writeFileSync(join(this.cartella, LE_VESTI), JSON.stringify(this._vesti));
    } catch (errore) {
      this.registro.attenzione(
        `le vesti delle plance non si scrivono: ${errore?.message || errore}`,
      );
    }
  }

  /* Il logo che c'e' gia' sul disco, letto una volta per accensione: dopo un
   * riavvio la plancia deve essere vestita al primo colpo, senza aspettare che
   * il quadro risponda. */
  _dalDisco() {
    if (this._riletto || this._logo) return;
    this._riletto = true;
    let nomi = [];
    try {
      nomi = readdirSync(this.cartella);
    } catch (_nonCE) {
      return;
    }
    for (const nome of nomi) {
      try {
        const byte = readFileSync(join(this.cartella, nome));
        const razza = cheImmagineE(byte);
        if (!razza) continue;
        this._logo = byte;
        this._tipo = razza.tipo;
        return;
      } catch (_errore) {
        /* Un file storto in `/data` non e' un guaio da mostrare: e' un logo
         * che non c'e', e la plancia porta il nostro. */
      }
    }
  }

  async _vaiAPrenderlo() {
    if (!this.quadro) return;
    try {
      const risposta = await this.prendi(`${this.quadro}/marchio/${this._chi}`, {
        signal: AbortSignal.timeout(ATTESA),
      });
      if (!risposta.ok) {
        /* Un `404` e' una risposta: quell'installatore il logo l'ha tolto. */
        if (risposta.status === 404) this.dimentica();
        this._presoIl = this.adesso();
        return;
      }
      const byte = Buffer.from(await risposta.arrayBuffer());
      const razza = cheImmagineE(byte);
      if (!razza) {
        this.registro.attenzione("il quadro ha mandato un marchio che non e' un'immagine");
        this._presoIl = this.adesso();
        return;
      }
      this.dimentica();
      mkdirSync(this.cartella, { recursive: true });
      writeFileSync(join(this.cartella, `marchio.${razza.coda}`), byte);
      this._logo = byte;
      this._tipo = razza.tipo;
      this._presoIl = this.adesso();
      this.registro.info(`preso il marchio di ${this._nome || "chi segue questa casa"}`);
    } catch (errore) {
      /* Il quadro spento, la rete giu': si riprova al giro dopo, e intanto la
       * plancia porta il marchio che aveva. */
      this.registro.debug(`il marchio non si scarica: ${errore?.message || errore}`);
      this._presoIl = this.adesso();
    }
  }
}
