/* Le notifiche: il centralino le porta a Firebase, e non le legge.
 *
 * Una casa che vuole avvisare un telefono — l'antifurto, il campanello, la
 * lavatrice che ha finito — chiude la notifica con la chiave di quel telefono
 * (`ponte/src/spinta.js`) e la manda qui sul suo filo. Il centralino la gira
 * a Firebase Cloud Messaging, che la consegna sul telefono anche con l'app
 * chiusa: su Android come dati che l'app apre da se', sull'iPhone con una
 * frase sempre uguale — «gdahome: nuova notifica» — perche' Apple una frase
 * la vuole.
 *
 * ─── Cosa sa il centralino ────────────────────────────────────────────────
 *
 * Per ogni casa, il **gettone di Firebase** di ogni suo telefono che le
 * notifiche le vuole: l'indirizzo a cui consegnare. Nient'altro. Il contenuto
 * e' una busta che non si apre senza la chiave del telefono, e quella chiave
 * qui non e' mai passata.
 *
 * I gettoni stanno in `spinte.json`, nella cartella dei dati, chiuso a 600
 * come il resto: non aprono niente, ma sono indirizzi di telefoni, e non si
 * lasciano in giro. La casa ne dice l'elenco intero ogni volta che cambia —
 * un telefono staccato esce da li' — e un gettone che Firebase dice di non
 * conoscere si toglie qui e si dice alla casa.
 *
 * ─── La chiave di Firebase ────────────────────────────────────────────────
 *
 * Per parlare con Firebase serve il conto di servizio del progetto: un JSON
 * con una chiave privata. Arriva a questa macchina dal bottone «Il tramite»
 * (`.github/workflows/il-tramite.yml`), cifrato per lei, e systemd lo passa al
 * servizio come credenziale (`accendi.sh`). Qui si legge una volta,
 * all'accensione, e **non si scrive da nessuna parte**: non nel registro, non
 * in `/salute`, non negli errori. Nemmeno il gettone d'accesso che se ne
 * ricava, che vale un'ora.
 *
 * Senza chiave le notifiche sono spente, e lo si dice all'accensione: le case
 * continuano a mandarle, e qui si lasciano cadere.
 */

import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Archivio } from "./archivio.js";
import { CASA_VALIDA } from "./case.js";
import { Freno } from "./freno.js";

const MINUTO = 60 * 1000;

/* Gli unici due indirizzi a cui va la chiave, e la notifica. Il primo e'
 * scritto qui e non preso dal JSON del conto (`token_uri`): un JSON con un
 * altro indirizzo dentro manderebbe una firma valida a chi non deve. */
export const DOVE_SI_CHIEDE_L_ACCESSO = "https://oauth2.googleapis.com/token";
export const DOVE_SI_MANDA = "https://fcm.googleapis.com/v1/projects";
const PERMESSO = "https://www.googleapis.com/auth/firebase.messaging";

/* Quanti telefoni per casa: gli stessi del filo (`centralino.js`). */
export const GETTONI_PER_CASA = 20;

/* Quante notifiche per casa, all'ora e al minuto. Il ponte ne manda al piu'
 * trenta all'ora per telefono; una casa che va oltre questi numeri ha
 * qualcosa che non va, e Firebase non e' il posto dove scoprirlo. */
export const SPINTE_PER_CASA_ALL_ORA = 300;
export const SPINTE_PER_CASA_AL_MINUTO = 30;
export const SPINTE_IN_TUTTO_ALL_ORA = 200_000;

/* La frase che vede chi non ha la chiave: Apple, e l'iPhone prima che l'app
 * apra la busta. */
export const FRASE_DI_RISERVA = Object.freeze({ titolo: "gdahome", testo: "nuova notifica" });

const TELEFONO_BUONO = /^dm_[0-9a-f]{16}$/;
const GETTONE_BUONO = /^[A-Za-z0-9_:\-.]{20,4096}$/;
const BUSTA_BUONA = /^[A-Za-z0-9+/]+=*$/;
export const BUSTA_MASSIMA = 3500;

/* La chiave di Firebase, letta dal file che systemd passa al servizio — o da
 * un percorso detto a mano. `null` se non c'e' o non e' una chiave: nel
 * registro va il perche', mai il contenuto. */
export function leggiLaChiaveDiFirebase({
  percorso = "",
  cartellaDelleCredenziali = process.env.CREDENTIALS_DIRECTORY || "",
  registro = null,
} = {}) {
  const dove =
    percorso || (cartellaDelleCredenziali ? join(cartellaDelleCredenziali, "firebase-invio") : "");
  if (!dove) return null;
  let testo;
  try {
    testo = readFileSync(dove, "utf8");
  } catch (_errore) {
    return null;
  }
  if (!testo.trim() || testo.trim() === "{}") return null;
  return chiaveDiFirebaseDa(testo, { registro });
}

export function chiaveDiFirebaseDa(testo, { registro = null } = {}) {
  let detto;
  try {
    detto = JSON.parse(testo);
  } catch (_errore) {
    registro?.attenzione?.("la chiave di Firebase non e' un JSON: le notifiche restano spente");
    return null;
  }
  const buona =
    detto &&
    typeof detto === "object" &&
    typeof detto.project_id === "string" &&
    /^[a-z0-9-]{3,64}$/.test(detto.project_id) &&
    typeof detto.client_email === "string" &&
    detto.client_email.includes("@") &&
    typeof detto.private_key === "string" &&
    detto.private_key.includes("PRIVATE KEY");
  if (!buona) {
    registro?.attenzione?.(
      "la chiave di Firebase non e' un conto di servizio: le notifiche restano spente",
    );
    return null;
  }
  return Object.freeze({
    progetto: detto.project_id,
    email: detto.client_email,
    privata: detto.private_key,
  });
}

const base64url = (cosa) =>
  Buffer.from(typeof cosa === "string" ? cosa : JSON.stringify(cosa)).toString("base64url");

/* Chi parla con Firebase: si fa dare un gettone d'accesso firmando con la
 * chiave del conto, e lo tiene finche' vale. */
export class PostinoDiFirebase {
  constructor({
    chiave,
    fetch: prendi = globalThis.fetch,
    adesso = () => Date.now(),
    /* Solo per le prove: dove stanno i due indirizzi di Google. */
    accesso = DOVE_SI_CHIEDE_L_ACCESSO,
    invio = DOVE_SI_MANDA,
  }) {
    this.chiave = chiave;
    this.prendi = prendi;
    this.adesso = adesso;
    this.accesso = accesso;
    this.invio = invio;
    this._accesso = null;
    this._accessoFino = 0;
    this._inVolo = null;
  }

  _firma() {
    const ora = Math.floor(this.adesso() / 1000);
    const dentro = `${base64url({ alg: "RS256", typ: "JWT" })}.${base64url({
      iss: this.chiave.email,
      scope: PERMESSO,
      aud: DOVE_SI_CHIEDE_L_ACCESSO,
      iat: ora,
      exp: ora + 3600,
    })}`;
    const firma = createSign("RSA-SHA256").update(dentro).sign(this.chiave.privata);
    return `${dentro}.${firma.toString("base64url")}`;
  }

  async _gettoneDAccesso() {
    if (this._accesso && this._accessoFino > this.adesso() + MINUTO) return this._accesso;
    if (this._inVolo) return this._inVolo;
    this._inVolo = (async () => {
      const risposta = await this.prendi(this.accesso, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: this._firma(),
        }).toString(),
        signal: AbortSignal.timeout(15_000),
      });
      if (!risposta.ok) throw new Error(`Google non da' l'accesso (${risposta.status})`);
      const detto = await risposta.json();
      if (typeof detto?.access_token !== "string") throw new Error("Google non da' l'accesso");
      this._accesso = detto.access_token;
      this._accessoFino = this.adesso() + Math.max(60, Number(detto.expires_in) || 3600) * 1000;
      return this._accesso;
    })();
    try {
      return await this._inVolo;
    } finally {
      this._inVolo = null;
    }
  }

  /* Il messaggio, com'e' fatto per Firebase. Android riceve solo dati — la
   * busta — e l'app la apre e mostra la notifica da se'; l'iPhone riceve in
   * piu' la frase di riserva, e `mutable-content` per l'estensione che un
   * giorno la aprira' prima di mostrarla. Le urgenti sull'iPhone sono
   * «sensibili al tempo»: passano la concentrazione. */
  messaggio({ gettone, telefono, busta, urgente }) {
    return {
      message: {
        token: gettone,
        data: { g: "1", d: telefono, b: busta },
        android: { priority: "high", ttl: urgente ? "300s" : "3600s" },
        apns: {
          headers: {
            "apns-priority": "10",
            "apns-push-type": "alert",
            "apns-expiration": String(Math.floor(this.adesso() / 1000) + (urgente ? 300 : 3600)),
          },
          payload: {
            aps: {
              alert: { title: FRASE_DI_RISERVA.titolo, body: FRASE_DI_RISERVA.testo },
              sound: "default",
              "mutable-content": 1,
              "interruption-level": urgente ? "time-sensitive" : "active",
            },
          },
        },
      },
    };
  }

  /* Torna `"partita"`, `"morta"` (il gettone non vale piu') o `"errore"`. */
  async manda(spinta, { ancora = true } = {}) {
    const accesso = await this._gettoneDAccesso();
    const risposta = await this.prendi(`${this.invio}/${this.chiave.progetto}/messages:send`, {
      method: "POST",
      headers: { authorization: `Bearer ${accesso}`, "content-type": "application/json" },
      body: JSON.stringify(this.messaggio(spinta)),
      signal: AbortSignal.timeout(15_000),
    });
    if (risposta.ok) return "partita";
    if (risposta.status === 401 && ancora) {
      this._accesso = null;
      return this.manda(spinta, { ancora: false });
    }
    let detto = null;
    try {
      detto = await risposta.json();
    } catch (_errore) {
      /* Una risposta che non e' JSON non dice di piu'. */
    }
    const codici = [
      detto?.error?.status,
      ...(Array.isArray(detto?.error?.details)
        ? detto.error.details.map((uno) => uno?.errorCode)
        : []),
    ];
    if (risposta.status === 404 || codici.includes("UNREGISTERED")) return "morta";
    if (
      risposta.status === 400 &&
      codici.includes("INVALID_ARGUMENT") &&
      /token/i.test(String(detto?.error?.message || ""))
    )
      return "morta";
    return "errore";
  }
}

export class Spinte {
  constructor({
    cartella = "./dati",
    chiave = null,
    postino = null,
    registro = null,
    adesso = () => Date.now(),
    fetch: prendi = globalThis.fetch,
    perCasaAllOra = SPINTE_PER_CASA_ALL_ORA,
    perCasaAlMinuto = SPINTE_PER_CASA_AL_MINUTO,
  } = {}) {
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this.postino =
      postino ?? (chiave ? new PostinoDiFirebase({ chiave, fetch: prendi, adesso }) : null);
    this.archivio = new Archivio(join(cartella, "spinte.json"), { case: {} }, { modo: 0o600 });
    if (!this.archivio.dati.case || typeof this.archivio.dati.case !== "object")
      this.archivio.dati.case = {};
    this.allOra = new Freno({ perChi: perCasaAllOra, inTutto: SPINTE_IN_TUTTO_ALL_ORA, adesso });
    this.alMinuto = new Freno({ perChi: perCasaAlMinuto, finestra: MINUTO, adesso });
    this.conti = { partite: 0, morte: 0, frenate: 0, errori: 0 };
    this._dettoLErrore = false;
  }

  get accese() {
    return Boolean(this.postino);
  }

  /* Quanti gettoni in tutto, per `/salute` da dentro. */
  quanti() {
    let quanti = 0;
    for (const telefoni of Object.values(this.archivio.dati.case))
      quanti += Object.keys(telefoni).length;
    return quanti;
  }

  gettoniDi(casa) {
    return { ...(this.archivio.dati.case[casa] || {}) };
  }

  /* L'elenco intero dei gettoni di una casa: quello di prima se ne va. */
  elenco(casa, telefoni) {
    if (!CASA_VALIDA.test(String(casa ?? ""))) return false;
    const nuovi = {};
    for (const uno of Array.isArray(telefoni) ? telefoni : []) {
      if (Object.keys(nuovi).length >= GETTONI_PER_CASA) break;
      if (!TELEFONO_BUONO.test(String(uno?.telefono ?? ""))) continue;
      if (!GETTONE_BUONO.test(String(uno?.gettone ?? ""))) continue;
      nuovi[uno.telefono] = uno.gettone;
    }
    const prima = JSON.stringify(this.archivio.dati.case[casa] || {});
    if (Object.keys(nuovi).length) this.archivio.dati.case[casa] = nuovi;
    else delete this.archivio.dati.case[casa];
    if (prima !== JSON.stringify(nuovi)) this._salva();
    return true;
  }

  _togli(casa, telefono) {
    const telefoni = this.archivio.dati.case[casa];
    if (!telefoni?.[telefono]) return;
    delete telefoni[telefono];
    if (!Object.keys(telefoni).length) delete this.archivio.dati.case[casa];
    this._salva();
  }

  _salva() {
    try {
      this.archivio.salva();
    } catch (_errore) {
      this.registro.errore("i gettoni delle notifiche non si salvano");
    }
  }

  /* Una notifica di una casa per un suo telefono. Torna l'esito, e non
   * solleva mai: una notifica persa non deve far cadere il filo di nessuno. */
  async spingi(casa, { telefono, busta, urgente = false } = {}) {
    if (!this.accese) return "spente";
    if (!CASA_VALIDA.test(String(casa ?? ""))) return "rifiutata";
    if (typeof busta !== "string" || busta.length > BUSTA_MASSIMA || !BUSTA_BUONA.test(busta))
      return "rifiutata";
    const gettone = this.archivio.dati.case[casa]?.[telefono];
    if (!gettone) return "senza-gettone";
    if (!this.alMinuto.cePosto(casa) || !this.allOra.cePosto(casa)) {
      this.conti.frenate += 1;
      return "troppe";
    }
    this.alMinuto.conta(casa);
    this.allOra.conta(casa);
    try {
      const esito = await this.postino.manda({
        gettone,
        telefono,
        busta,
        urgente: urgente === true,
      });
      if (esito === "partita") this.conti.partite += 1;
      if (esito === "morta") {
        this.conti.morte += 1;
        this._togli(casa, telefono);
      }
      if (esito === "errore") this.conti.errori += 1;
      return esito;
    } catch (errore) {
      this.conti.errori += 1;
      /* Il perche' si dice una volta, e senza niente di quello che c'era
       * dentro: ne' il gettone, ne' la chiave, ne' la busta. */
      if (!this._dettoLErrore) {
        this._dettoLErrore = true;
        this.registro.attenzione(
          `Firebase non risponde: ${String(errore?.message || "errore").slice(0, 80)}`,
        );
      }
      return "errore";
    }
  }
}
