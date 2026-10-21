/* Le bollette dalla posta: il servizio del ponte.
 *
 * «A, usiamo Gmail.» Il ponte legge, nella casella scelta da chi amministra,
 * solo le mail dei fornitori di energia, e ne tira fuori le bollette
 * (`le-bollette-nella-posta.js`). La plancia le mostra nella linguetta
 * Bollette di Energia.
 *
 * La sicurezza, che deve essere sempre forte:
 *
 *  - si entra con la **password per app** di Google, mai con quella vera: si
 *    revoca da sola nell'account Google, e non apre nient'altro che la posta;
 *  - la password si tiene **cifrata** (AES-256-GCM) in `/data`, con una
 *    chiave nata qui e scritta accanto con i permessi del solo processo. Non
 *    torna mai indietro: la plancia sa solo che c'e', e la puo' sostituire o
 *    cancellare. Non passa da nessun server: Gmail e' l'unico posto in cui va;
 *  - collegare, aggiornare e scollegare li fa solo chi amministra
 *    (`SOLO_CHI_AMMINISTRA` in `commissioni.js`); vedere le bollette, chi e'
 *    entrato in casa;
 *  - nei registri non finisce ne' la password ne' il contenuto delle mail:
 *    solo quante se ne sono lette e com'e' andata;
 *  - la posta si apre in sola lettura: nessuna mail viene segnata come letta,
 *    spostata o toccata.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Archivio } from "./archivio.js";
import { FORNITORI, bolletteDaiMessaggi } from "./le-bollette-nella-posta.js";
import { ErroreDellaPosta, Posta } from "./la-posta.js";

const ORA = 60 * 60 * 1000;
/* Ogni sei ore: una bolletta arriva una volta al mese, e Gmail non ama chi
 * bussa spesso. */
export const OGNI = 6 * ORA;
/* Quante mail si leggono per volta, al piu': le ultime. Due anni di bollette
 * mensili sono ventiquattro; il resto e' storia che non serve. */
export const QUANTE_AL_PIU = 40;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Come si dice l'indirizzo a chi guarda: «d•••@gmail.com». */
export function indirizzoNascosto(email) {
  const [nome, dominio] = String(email || "").split("@");
  if (!dominio) return "";
  return `${nome.slice(0, 1)}•••@${dominio}`;
}

/* La ricerca di Gmail per i fornitori scelti, sugli ultimi due anni. */
export function ricercaGmail(fornitori = []) {
  const scelti = FORNITORI.filter((f) => !fornitori.length || fornitori.includes(f.id));
  const da = scelti.flatMap((f) => f.mittenti).map((m) => `from:${m}`);
  return `(${da.join(" OR ")}) newer_than:2y`;
}

export class Bollette {
  constructor({
    cartella = "",
    registro = null,
    adesso = () => Date.now(),
    apriLaPosta = (opzioni) => new Posta(opzioni),
  } = {}) {
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this.apriLaPosta = apriLaPosta;
    this.cartella = cartella;
    this.archivio = new Archivio(
      cartella ? join(cartella, "bollette.json") : "",
      { email: "", segreto: null, fornitori: [], bollette: [], lettoIl: 0, errore: "" },
      { modo: 0o600 },
    );
    this._timer = null;
    this._inCorso = null;
  }

  /* ── la chiave e la password ─────────────────────────────────────────── */

  _chiave() {
    if (this._chiaveInMemoria) return this._chiaveInMemoria;
    const file = this.cartella ? join(this.cartella, "bollette.chiave") : "";
    let chiave = null;
    if (file && existsSync(file)) {
      try {
        chiave = Buffer.from(readFileSync(file, "utf8").trim(), "hex");
      } catch (_errore) {
        chiave = null;
      }
    }
    if (!chiave || chiave.length !== 32) {
      chiave = randomBytes(32);
      if (file) {
        writeFileSync(file, chiave.toString("hex"), { mode: 0o600 });
        try {
          chmodSync(file, 0o600);
        } catch (_errore) {
          /* Su un disco che non ha i permessi di Unix resta com'e'. */
        }
      }
    }
    this._chiaveInMemoria = chiave;
    return chiave;
  }

  _cifra(testo) {
    const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", this._chiave(), iv);
    const dati = Buffer.concat([c.update(String(testo), "utf8"), c.final()]);
    return {
      iv: iv.toString("hex"),
      tag: c.getAuthTag().toString("hex"),
      dati: dati.toString("hex"),
    };
  }

  _decifra(segreto) {
    if (!segreto?.iv) return "";
    try {
      const d = createDecipheriv("aes-256-gcm", this._chiave(), Buffer.from(segreto.iv, "hex"));
      d.setAuthTag(Buffer.from(segreto.tag, "hex"));
      return Buffer.concat([d.update(Buffer.from(segreto.dati, "hex")), d.final()]).toString(
        "utf8",
      );
    } catch (_errore) {
      return "";
    }
  }

  /* ── quello che vede la plancia ──────────────────────────────────────── */

  stato() {
    const d = this.archivio.dati;
    return {
      collegata: Boolean(d.email && d.segreto),
      indirizzo: indirizzoNascosto(d.email),
      fornitori: d.fornitori || [],
      bollette: d.bollette || [],
      lettoIl: d.lettoIl || 0,
      errore: d.errore || "",
      fornitoriNoti: FORNITORI.map(({ id, nome }) => ({ id, nome })),
    };
  }

  /* ── leggere la posta ────────────────────────────────────────────────── */

  async _leggiCon(email, password, fornitori) {
    const posta = this.apriLaPosta({ registro: this.registro });
    try {
      await posta.apri();
      await posta.entra(email, password);
      await posta.apriLaCartella("INBOX");
      const uid = await posta.cerca({ gmail: ricercaGmail(fornitori) });
      const messaggi = await posta.leggi(uid.slice(-QUANTE_AL_PIU));
      return bolletteDaiMessaggi(messaggi).filter(
        (b) => !fornitori.length || !b.fornitore || fornitori.includes(b.fornitore),
      );
    } finally {
      await posta.esci().catch(() => {});
    }
  }

  /* Le parole per chi guarda, non quelle di Gmail. */
  _perche(errore) {
    if (errore instanceof ErroreDellaPosta && errore.codice === "accesso")
      return "accesso-rifiutato";
    if (errore instanceof ErroreDellaPosta && errore.codice === "tempo") return "nessuna-risposta";
    return "rete";
  }

  /**
   * Collega la casella: prova a entrare e a leggere, e solo se riesce la
   * salva. Una password sbagliata non resta scritta da nessuna parte.
   */
  async collega({ email, password, fornitori = [] } = {}) {
    const indirizzo = String(email || "")
      .trim()
      .toLowerCase();
    const segreto = String(password || "").replace(/\s+/g, "");
    if (!EMAIL.test(indirizzo)) return { errore: "email-non-valida" };
    if (segreto.length < 8) return { errore: "password-non-valida" };
    const scelti = (Array.isArray(fornitori) ? fornitori : [])
      .map(String)
      .filter((id) => FORNITORI.some((f) => f.id === id));
    let bollette;
    try {
      bollette = await this._leggiCon(indirizzo, segreto, scelti);
    } catch (errore) {
      this.registro.attenzione?.(`bollette: collegamento non riuscito (${this._perche(errore)})`);
      return { errore: this._perche(errore) };
    }
    Object.assign(this.archivio.dati, {
      email: indirizzo,
      segreto: this._cifra(segreto),
      fornitori: scelti,
      bollette,
      lettoIl: this.adesso(),
      errore: "",
    });
    this.archivio.salva();
    this.registro.info?.(`bollette: casella collegata, ${bollette.length} bollette trovate`);
    return this.stato();
  }

  /** Rilegge adesso, con la casella salvata. */
  async aggiorna() {
    if (this._inCorso) return this._inCorso;
    const d = this.archivio.dati;
    const password = this._decifra(d.segreto);
    if (!d.email || !password) return this.stato();
    this._inCorso = (async () => {
      try {
        const bollette = await this._leggiCon(d.email, password, d.fornitori || []);
        Object.assign(d, { bollette, lettoIl: this.adesso(), errore: "" });
        this.registro.info?.(`bollette: ${bollette.length} bollette lette`);
      } catch (errore) {
        d.errore = this._perche(errore);
        this.registro.attenzione?.(`bollette: lettura non riuscita (${d.errore})`);
      }
      this.archivio.salva();
      return this.stato();
    })();
    try {
      return await this._inCorso;
    } finally {
      this._inCorso = null;
    }
  }

  /** Dimentica tutto: indirizzo, password e bollette. */
  scollega() {
    Object.assign(this.archivio.dati, {
      email: "",
      segreto: null,
      fornitori: [],
      bollette: [],
      lettoIl: 0,
      errore: "",
    });
    this.archivio.salva();
    this.registro.info?.("bollette: casella scollegata");
    return this.stato();
  }

  /* ── il giro ─────────────────────────────────────────────────────────── */

  parti() {
    if (this._timer) return;
    const giro = () => {
      const d = this.archivio.dati;
      if (d.email && d.segreto && this.adesso() - (d.lettoIl || 0) >= OGNI)
        this.aggiorna().catch(() => {});
    };
    this._timer = setInterval(giro, 15 * 60 * 1000);
    this._timer.unref?.();
    setTimeout(giro, 60 * 1000).unref?.();
  }

  ferma() {
    clearInterval(this._timer);
    this._timer = null;
  }

  /* ── le domande della plancia ───────────────────────────────────────── */

  async rispondi(detto) {
    const id = detto?.id ?? null;
    const si = (result) => ({ id, type: "result", success: true, result });
    const no = (code) => ({ id, type: "result", success: false, error: { code, message: code } });
    const esito = (fuori) => (fuori?.errore ? no(fuori.errore) : si(fuori));
    switch (detto?.type) {
      case "ponte/bollette/stato":
        return si(this.stato());
      case "ponte/bollette/collega":
        return esito(
          await this.collega({
            email: detto.email,
            password: detto.password,
            fornitori: detto.fornitori,
          }),
        );
      case "ponte/bollette/aggiorna":
        return esito(await this.aggiorna());
      case "ponte/bollette/scollega":
        return si(this.scollega());
      default:
        return no("unknown_command");
    }
  }
}
