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
 */

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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

const LE_RAZZE = [
  { tipo: "image/png", coda: "png", segno: [0x89, 0x50, 0x4e, 0x47] },
  { tipo: "image/jpeg", coda: "jpg", segno: [0xff, 0xd8, 0xff] },
  { tipo: "image/webp", coda: "webp", segno: [0x52, 0x49, 0x46, 0x46] },
];

/**
 * Che immagine e' questa, guardando come comincia.
 *
 * Torna `{tipo, coda}` o `null`. E' lo stesso controllo che fa il quadro
 * accettandola, rifatto qui: fra le due macchine c'e' una rete, e un controllo
 * da una parte sola non e' un controllo.
 *
 * @param {Buffer} byte il file com'e' arrivato
 */
export function cheImmagineE(byte) {
  if (!Buffer.isBuffer(byte) || byte.length < 4 || byte.length > QUANTO_GROSSO) return null;
  for (const una of LE_RAZZE) {
    if (una.segno.every((quanto, dove) => byte[dove] === quanto)) return una;
  }
  const testa = byte.subarray(0, 512).toString("utf8").trimStart();
  if (/^<(\?xml|!--|svg)[\s>]/i.test(testa) && /<svg[\s>]/i.test(testa)) {
    return { tipo: "image/svg+xml", coda: "svg" };
  }
  return null;
}

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
    /* Chi va avvisato quando cambia il nome: la voce nella barra laterale, che
     * deve seguirlo. Si monta dopo, perche' quella nasce piu' tardi. */
    this.alCambio = null;
  }

  /** Come si chiama, o vuoto: non c'e' nessun installatore, o non l'ha detto. */
  get nome() {
    return this._nome;
  }

  /**
   * Quello che la plancia deve indossare, o `null`.
   *
   * Un caso solo per chi disegna: `null` vuol dire «questa casa porta il nostro
   * marchio», che e' il caso di quasi tutte.
   */
  vestito() {
    if (!this._nome && !this._logo) return null;
    this._dalDisco();
    return { nome: this._nome, logo: this._logo, tipo: this._tipo };
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
      try {
        this.alCambio?.(nome);
      } catch (errore) {
        this.registro.attenzione(`la voce nella barra non ha preso il nome: ${errore?.message}`);
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

  /** Via tutto: nessun installatore, nessun logo. */
  dimentica() {
    this._logo = null;
    this._tipo = "";
    this._presoIl = 0;
    rmSync(this.cartella, { recursive: true, force: true });
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
