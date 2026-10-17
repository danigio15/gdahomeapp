/* Le foto delle notifiche: il centralino le tiene un momento, e non le guarda.
 *
 * Una notifica «elaborata» del movimento o dell'antifurto porta l'istantanea
 * della telecamera. In una spinta non ci sta — Google e Apple portano pochi
 * chilobyte — e allora la casa la chiude con la chiave delle notifiche di quel
 * telefono (la stessa delle buste, `ponte/src/spinta.js`) e la lascia qui sul
 * suo filo: `{t: "foto", n, telefono, dati}`. Qui riceve un identificativo a
 * caso, che va nella notifica; il telefono — l'app su Android, l'estensione
 * sull'iPhone — la chiede con `GET /foto/<id>`, la apre, e la mostra.
 *
 * ─── Cosa sa il centralino ────────────────────────────────────────────────
 *
 * Niente di quello che c'e' nella foto: e' un blocco cifrato che non si apre
 * senza la chiave di quel telefono, e quella chiave qui non e' mai passata.
 * Sa da quale casa viene, per frenarla, e per quale telefono, per non
 * mischiarle. Non la scrive su disco, non la mette nel registro: sta in
 * memoria **dieci minuti**, e si legge **una volta sola** — chi la prende se
 * la porta via. Chi bussa con un identificativo che non c'e' sente un 404, lo
 * stesso di chi arriva tardi.
 *
 * L'identificativo e' di 128 bit a caso: non si indovina, e non dice niente.
 *
 * Succede solo con le notifiche elaborate, e solo se chi le riceve le ha
 * scelte (Impostazioni → Notifiche → «Come le vuoi»): con le semplici la casa
 * non manda nessuna foto.
 */

import { randomBytes } from "node:crypto";

import { CASA_VALIDA } from "./case.js";
import { Freno } from "./freno.js";

const MINUTO = 60 * 1000;

/* Quanto pesa al piu' una foto, gia' cifrata: la casa la rimpicciolisce
 * prima (1280 punti sul lato lungo, sotto i 200 KB), e questo e' il tetto. */
export const FOTO_MASSIMA = 300 * 1024;

/* Quanto vive una foto che nessuno chiede. */
export const VITA_DELLA_FOTO = 10 * MINUTO;

/* Quante per casa: un movimento non ne fa trenta in un'ora, e se succede c'e'
 * qualcosa che non va. */
export const FOTO_PER_CASA_ALL_ORA = 30;
export const FOTO_PER_CASA_AL_MINUTO = 6;

/* Quanta memoria in tutto, fra tutte le case: oltre, le nuove si rifiutano
 * finche' le vecchie non scadono o non vengono prese. */
export const MEMORIA_DELLE_FOTO = 64 * 1024 * 1024;

const TELEFONO_BUONO = /^dm_[0-9a-f]{16}$/;
const BASE64_BUONO = /^[A-Za-z0-9+/]+=*$/;
const ID_BUONO = /^[0-9a-f]{32}$/;

export class FotoDiPassaggio {
  constructor({
    adesso = () => Date.now(),
    vita = VITA_DELLA_FOTO,
    massima = FOTO_MASSIMA,
    memoria = MEMORIA_DELLE_FOTO,
    perCasaAllOra = FOTO_PER_CASA_ALL_ORA,
    perCasaAlMinuto = FOTO_PER_CASA_AL_MINUTO,
  } = {}) {
    this.adesso = adesso;
    this.vita = vita;
    this.massima = massima;
    this.memoria = memoria;
    this.allOra = new Freno({ perChi: perCasaAllOra, adesso });
    this.alMinuto = new Freno({ perChi: perCasaAlMinuto, finestra: MINUTO, adesso });
    /** id → {byte, fino, casa, telefono} */
    this._foto = new Map();
    this._peso = 0;
    this.conti = { lasciate: 0, prese: 0, scadute: 0, rifiutate: 0 };
  }

  get quante() {
    this._pota();
    return this._foto.size;
  }

  /* Una foto di una casa per un suo telefono. Torna `{id}`, o `{perche}`:
   * `rifiutata`, `troppo-grande`, `troppe`. Non solleva mai. */
  lascia(casa, { telefono, dati } = {}) {
    if (!CASA_VALIDA.test(String(casa ?? "")) || !TELEFONO_BUONO.test(String(telefono ?? ""))) {
      this.conti.rifiutate += 1;
      return { perche: "rifiutata" };
    }
    if (typeof dati !== "string" || !dati.length || !BASE64_BUONO.test(dati)) {
      this.conti.rifiutate += 1;
      return { perche: "rifiutata" };
    }
    /* Prima del conto vero, quello a occhio: una stringa base64 pesa quattro
     * terzi dei suoi byte, e non si decodifica un mega per scoprirlo. */
    if (Math.floor((dati.length * 3) / 4) > this.massima + 2) {
      this.conti.rifiutate += 1;
      return { perche: "troppo-grande" };
    }
    const byte = Buffer.from(dati, "base64");
    if (!byte.length || byte.length > this.massima) {
      this.conti.rifiutate += 1;
      return { perche: "troppo-grande" };
    }
    this._pota();
    if (this._peso + byte.length > this.memoria) {
      this.conti.rifiutate += 1;
      return { perche: "troppe" };
    }
    if (!this.alMinuto.cePosto(casa) || !this.allOra.cePosto(casa)) {
      this.conti.rifiutate += 1;
      return { perche: "troppe" };
    }
    this.alMinuto.conta(casa);
    this.allOra.conta(casa);
    const id = randomBytes(16).toString("hex");
    this._foto.set(id, { byte, fino: this.adesso() + this.vita, casa, telefono });
    this._peso += byte.length;
    this.conti.lasciate += 1;
    return { id };
  }

  /* La foto, una volta sola: chi la prende se la porta via. `null` se non
   * c'e', o se e' scaduta. */
  prendi(id) {
    if (!ID_BUONO.test(String(id ?? ""))) return null;
    this._pota();
    const foto = this._foto.get(id);
    if (!foto) return null;
    this._foto.delete(id);
    this._peso -= foto.byte.length;
    this.conti.prese += 1;
    return foto.byte;
  }

  _pota() {
    const ora = this.adesso();
    for (const [id, foto] of this._foto) {
      if (foto.fino > ora) continue;
      this._foto.delete(id);
      this._peso -= foto.byte.length;
      this.conti.scadute += 1;
    }
  }

  /* `GET /foto/<id>`: i byte cifrati, e poi non ci sono piu'. Torna `true` se
   * la via era questa. */
  async forseServe(richiesta, risposta, via) {
    if (!via.startsWith("/foto/")) return false;
    if (richiesta.method !== "GET") {
      risposta.writeHead(405, { allow: "GET", "content-type": "application/json" });
      risposta.end(JSON.stringify({ errore: "solo GET" }));
      return true;
    }
    const byte = this.prendi(via.slice("/foto/".length));
    if (!byte) {
      risposta.writeHead(404, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      risposta.end(JSON.stringify({ errore: "non c'e'" }));
      return true;
    }
    risposta.writeHead(200, {
      "content-type": "application/octet-stream",
      "content-length": byte.length,
      "cache-control": "no-store",
    });
    risposta.end(byte);
    return true;
  }
}
