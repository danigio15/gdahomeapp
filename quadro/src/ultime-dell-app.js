/* L'ultima versione dell'app pubblicata, negozio per negozio.
 *
 * «Ipotizza una notifica: quando è disponibile la nuova versione sugli store,
 * avvisare di aggiornare l'app.» Il negozio non dice a nessuno, da solo, che
 * una build e' uscita: Apple la libera quando la revisione finisce, Google
 * quando il rilascio graduale arriva a tutti, e il numero di costruzione non
 * lo dice nessuna delle due a chi non ha le chiavi dello sviluppatore. Quindi
 * lo scrive chi tiene il quadro, nella Gestione › Abbonamenti, **quando la
 * versione e' davvero nel negozio**: e' anche il momento in cui decide che si
 * avvisano i telefoni.
 *
 *     GET /v1/app/ultime   →   {"ultime": "<pezzo>.<firma>"}
 *
 * firmato come l'elenco delle licenze tolte: base64url del JSON
 * `{v: 1, tipo: "ultime", emesso, apple: {costruzione, versione}, google: …}`,
 * un punto, la firma Ed25519 con la chiave delle licenze. Le case lo
 * chiedono (`ponte/src/ultime-dell-app.js`) e lo verificano con la stessa
 * pubblica dei gettoni: chi sta in mezzo non puo' far arrivare a nessuno
 * «aggiorna l'app» per una versione che non c'e'.
 */

import { Archivio } from "./archivio.js";
import { join } from "node:path";

/** I negozi che si avvisano. */
export const NEGOZI_DELL_APP = Object.freeze(["apple", "google"]);

/* «1.18.8», «1.18.8+1» — quello che si legge nel negozio. */
const VERSIONE = /^\d{1,4}(\.\d{1,4}){0,3}([+-][0-9A-Za-z.]{1,16})?$/;

/** Una costruzione da 1 in su, o `null`. */
export function costruzioneBuona(detta) {
  const numero =
    typeof detta === "string" && /^\d{1,10}$/.test(detta.trim()) ? Number(detta) : detta;
  return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
}

/** Una versione come si scrive, o `null`. */
export function versioneBuona(detta) {
  const testo = typeof detta === "string" ? detta.trim() : "";
  return VERSIONE.test(testo) ? testo : null;
}

export class UltimeDellApp {
  constructor({ cartella = "./dati", adesso = () => Date.now() } = {}) {
    this.adesso = adesso;
    this._archivio = new Archivio(join(String(cartella), "ultime-dell-app.json"), {});
  }

  /** Quello che c'e': `{apple: {costruzione, versione, il} | null, google: …}`. */
  tutte() {
    const fuori = {};
    for (const negozio of NEGOZI_DELL_APP) {
      const una = this._archivio.dati[negozio];
      const costruzione = costruzioneBuona(una?.costruzione);
      fuori[negozio] = costruzione
        ? {
            costruzione,
            versione: versioneBuona(una?.versione) || "",
            il: Number.isFinite(una?.il) ? una.il : null,
          }
        : null;
    }
    return fuori;
  }

  /**
   * Scrive l'ultima di un negozio. `costruzione` vuota o zero la toglie: da
   * li' in poi per quel negozio non si avvisa nessuno.
   *
   * Solleva `Error` con `.codice` se il negozio o i numeri non vanno.
   */
  imposta(negozio, { costruzione, versione } = {}) {
    if (!NEGOZI_DELL_APP.includes(negozio))
      throw Object.assign(new Error("negozio"), { codice: "negozio-non-valido" });
    if (
      costruzione === 0 ||
      costruzione === "" ||
      costruzione === null ||
      costruzione === undefined
    ) {
      delete this._archivio.dati[negozio];
      this._archivio.salva();
      return this.tutte();
    }
    const numero = costruzioneBuona(costruzione);
    if (!numero)
      throw Object.assign(new Error("costruzione"), { codice: "costruzione-non-valida" });
    const scritta = versione === undefined || versione === "" ? "" : versioneBuona(versione);
    if (scritta === null)
      throw Object.assign(new Error("versione"), { codice: "versione-non-valida" });
    this._archivio.dati[negozio] = { costruzione: numero, versione: scritta, il: this.adesso() };
    this._archivio.salva();
    return this.tutte();
  }

  /** Il corpo da firmare per le case. */
  daFirmare(ora = this.adesso()) {
    const tutte = this.tutte();
    const corpo = { v: 1, tipo: "ultime", emesso: ora };
    for (const negozio of NEGOZI_DELL_APP)
      if (tutte[negozio])
        corpo[negozio] = {
          costruzione: tutte[negozio].costruzione,
          versione: tutte[negozio].versione,
        };
    return corpo;
  }
}
