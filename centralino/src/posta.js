/* La posta: il modulo «Contatti» del sito, e il postino che lo spedisce.
 *
 * Il sito e' fermo — due pagine servite da Caddy — e il modulo dei contatti e'
 * l'unica cosa della pagina che non e' un file. Caddy lo passa qui, `POST
 * /contatto`, perche' questa e' la macchina che c'e' gia': si guarda cosa e'
 * arrivato, e si spedisce a chi risponde.
 *
 * ─── Perche' una mail, e come ─────────────────────────────────────────────
 *
 * Il quadro, per gli avvisi agli installatori, la posta la evita apposta
 * (`quadro/src/fattorino.js`): tenere in piedi un server di posta che arrivi
 * davvero vuol dire SPF, DKIM e una reputazione da difendere. Qui non si tiene
 * in piedi niente: la lettera si **consegna a un server di posta che esiste
 * gia'** — quello della casella che risponde — presentandosi con utente e
 * password, come farebbe un programma di posta qualunque. La reputazione e'
 * la sua, e la lettera parte da una casella vera.
 *
 * Il protocollo e' SMTP di sottomissione: `EHLO`, `STARTTLS` (o TLS da subito
 * sulla 465), `AUTH`, `MAIL FROM`, `RCPT TO`, `DATA`, `QUIT`. Sono otto righe
 * di conversazione, e scriverle qui vale piu' di una dipendenza: il centralino
 * non ne ha nessuna, e resta cosi'. In chiaro non si parla mai, con una sola
 * eccezione: un server di posta che sta su questa stessa macchina.
 *
 * ─── Quello che il modulo non fa ──────────────────────────────────────────
 *
 * Non conserva niente: il messaggio passa e va. Sulla macchina resta solo un
 * conto per indirizzo di rete, in memoria, per non far spedire cento lettere
 * al minuto a chi ci prova — e si azzera al riavvio. Chi scrive ritrova il
 * proprio indirizzo nel `Reply-To`, cosi' chi risponde risponde a lui.
 *
 * Senza un server di posta configurato il modulo **non fa finta**: risponde
 * che non e' attivo e dice a chi scrive l'indirizzo a cui scrivere.
 */

import { randomBytes } from "node:crypto";
import { connect as apriInChiaro } from "node:net";
import { hostname } from "node:os";
import { connect as apriCifrato } from "node:tls";

import { RichiestaSbagliata } from "./segnalazioni.js";
import { byteDi, json } from "./sportello.js";

export const VIA_DEL_CONTATTO = "/contatto";

/** Quanto puo' essere lungo ognuno dei tre campi. */
export const NOME_MASSIMO = 120;
export const EMAIL_MASSIMA = 200;
export const MESSAGGIO_MASSIMO = 5000;
/** Il corpo intero, contato mentre arriva: i tre campi ci stanno larghi. */
export const CORPO_MASSIMO = 32 * 1024;

/** Quante lettere all'ora puo' mandare uno stesso indirizzo di rete. */
export const LETTERE_ALL_ORA = 5;
export const UN_ORA = 60 * 60 * 1000;

/** Quanto si aspetta il server di posta prima di lasciar perdere. */
export const ATTESA = 20 * 1000;

/* Un indirizzo con una chiocciola e un punto dopo, e senza i caratteri che in
 * un'intestazione vorrebbero dire un'altra cosa. Non e' la grammatica intera
 * degli indirizzi — quella non la applica nessuno — e' quanto basta per non
 * scrivere nel `Reply-To` una cosa che non e' un indirizzo. */
const EMAIL_BUONA = /^[^\s@<>,;"()]+@[^\s@<>,;"()]+\.[^\s@<>,;"()]+$/;

export const emailBuona = (detta) => {
  const email = String(detta ?? "").trim();
  return email.length <= EMAIL_MASSIMA && EMAIL_BUONA.test(email);
};

/* ─── La lettera ─────────────────────────────────────────────────────────── */

/* Una riga d'intestazione non contiene ritorni a capo: chi ne mette uno nel
 * nome sta provando ad aggiungere un'intestazione sua — un `Bcc:` — e la
 * perde qui. */
const unaRiga = (testo) =>
  String(testo ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .trim();

const soloAscii = (testo) => /^[\x20-\x7e]*$/.test(testo);

/** RFC 2047: un pezzo d'intestazione con lettere fuori dall'ASCII si dichiara. */
export const parolaCodificata = (testo) =>
  soloAscii(testo) ? testo : `=?UTF-8?B?${Buffer.from(testo, "utf8").toString("base64")}?=`;

const nomeInTesta = (nome) =>
  soloAscii(nome) ? `"${nome.replace(/["\\]/g, "\\$&")}"` : parolaCodificata(nome);

/* Il corpo in base64, a righe di 76: cosi' la lettera passa uguale da server
 * che parlano solo ASCII, e nessuna riga puo' cominciare con un punto. */
const aRighe = (base64) => base64.replace(/.{76}/g, "$&\r\n");

/* RFC 5322 vuole il fuso come numero: «GMT» e' la forma vecchia. */
const dataDellaLettera = (quando) => quando.toUTCString().replace(/GMT$/, "+0000");

/**
 * La lettera, pronta per `DATA`: intestazioni e corpo, con i ritorni a capo
 * del protocollo. Il mittente e' la casella che spedisce; chi ha scritto sta
 * nel `Reply-To`, cosi' «Rispondi» risponde a lui.
 */
export function laLettera({
  nome,
  email,
  messaggio,
  lingua = "it",
  da,
  a,
  sito = "",
  quando = new Date(),
  caso = randomBytes(12).toString("hex"),
}) {
  const chi = unaRiga(nome);
  const dove = unaRiga(email);
  const oggetto = sito ? `Dal sito ${sito}: ${chi}` : `Dal sito: ${chi}`;
  const dominio = String(da).split("@")[1] || "centralino";
  const corpo = [
    `Nome: ${chi}`,
    `Email: ${dove}`,
    `Lingua della pagina: ${lingua}`,
    `Quando: ${quando.toISOString()}`,
    "",
    "----",
    "",
    String(messaggio ?? "")
      .replace(/\r\n?/g, "\n")
      .trim(),
    "",
  ].join("\n");
  const mittente = nomeInTesta(sito ? `${sito}, il modulo dei contatti` : "Il modulo dei contatti");
  const testo = `${[
    `From: ${mittente} <${da}>`,
    `To: <${a}>`,
    `Reply-To: ${nomeInTesta(chi)} <${dove}>`,
    `Subject: ${parolaCodificata(oggetto)}`,
    `Date: ${dataDellaLettera(quando)}`,
    `Message-ID: <${caso}@${dominio}>`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    aRighe(Buffer.from(corpo, "utf8").toString("base64")),
  ].join("\r\n")}\r\n`;
  return { mittente: da, destinatario: a, oggetto, testo };
}

/* ─── Il postino ─────────────────────────────────────────────────────────── */

export class PostaNonParte extends Error {}

/* Chi sta sulla stessa macchina puo' parlare in chiaro: e' l'unico caso. */
const QUESTA_MACCHINA = new Set(["127.0.0.1", "::1", "localhost"]);

/* La conversazione con il server di posta: una riga alla volta, e una
 * risposta e' finita quando la sua ultima riga ha uno spazio dopo il codice
 * (`250 ok`) invece del trattino (`250-STARTTLS`). */
class Filo {
  constructor(attesa) {
    this.attesa = attesa;
    this.presa = null;
    this.resto = "";
    this.righe = [];
    this.pronte = [];
    this.inAttesa = [];
    this.guasto = null;
  }

  attacca(presa) {
    this.presa = presa;
    presa.setTimeout(this.attesa, () =>
      this._muore(new PostaNonParte("il server di posta non risponde")),
    );
    presa.on("data", (pezzo) => this._arriva(pezzo));
    presa.on("error", (errore) =>
      this._muore(new PostaNonParte(`il server di posta: ${errore.message}`)),
    );
    presa.on("close", () => this._muore(new PostaNonParte("il server di posta ha chiuso")));
  }

  /* Prima di cifrare: la presa in chiaro diventa il trasporto di quella
   * cifrata, e quello che ci passa sopra non e' piu' roba da leggere qui. */
  stacca() {
    for (const evento of ["data", "error", "close"]) this.presa.removeAllListeners(evento);
    this.presa.setTimeout(0);
  }

  _arriva(pezzo) {
    this.resto += pezzo.toString("utf8");
    let fine;
    while ((fine = this.resto.indexOf("\n")) !== -1) {
      const riga = this.resto.slice(0, fine).replace(/\r$/, "");
      this.resto = this.resto.slice(fine + 1);
      const testa = /^(\d{3})(?:([ -])(.*))?$/.exec(riga);
      if (!testa) continue;
      this.righe.push(testa[3] || "");
      if (testa[2] !== "-") {
        const risposta = { codice: Number(testa[1]), righe: this.righe };
        this.righe = [];
        const chi = this.inAttesa.shift();
        if (chi) chi.ok(risposta);
        else this.pronte.push(risposta);
      }
    }
  }

  _muore(errore) {
    if (this.guasto) return;
    this.guasto = errore;
    for (const chi of this.inAttesa.splice(0)) chi.no(errore);
    this.presa?.destroy();
  }

  attendi() {
    if (this.pronte.length) return Promise.resolve(this.pronte.shift());
    if (this.guasto) return Promise.reject(this.guasto);
    return new Promise((ok, no) => this.inAttesa.push({ ok, no }));
  }

  /* `nome` e' quello che finisce nell'errore al posto della riga intera: una
   * riga di `AUTH` porta la password, e in un registro non ci va. */
  async di(riga, attesi, nome = riga.split(" ")[0]) {
    if (this.guasto) throw this.guasto;
    this.presa.write(`${riga}\r\n`);
    return this._controlla(await this.attendi(), attesi, nome);
  }

  async saluto() {
    return this._controlla(await this.attendi(), [220], "il saluto");
  }

  _controlla(risposta, attesi, nome) {
    if (!attesi.includes(risposta.codice)) {
      throw new PostaNonParte(
        `il server di posta ha risposto ${risposta.codice} a ${nome}: ${risposta.righe
          .join(" ")
          .slice(0, 200)}`,
      );
    }
    return risposta.righe;
  }

  cifra(opzioni) {
    return new Promise((ok, no) => {
      const inChiaro = this.presa;
      this.stacca();
      const cifrata = apriCifrato({ socket: inChiaro, ...opzioni }, () => {
        this.attacca(cifrata);
        ok();
      });
      cifrata.once("error", (errore) => {
        this._muore(new PostaNonParte(`TLS col server di posta: ${errore.message}`));
        no(this.guasto);
      });
    });
  }

  chiudi() {
    this.presa?.end();
    this.presa?.destroy();
  }
}

export class Postino {
  constructor({
    server = "",
    porta = 587,
    utente = "",
    password = "",
    /* `starttls` (587), `tls` (465) o `nessuna`. Non detta, si ricava dalla
     * porta. `nessuna` vale solo verso questa stessa macchina: un server di
     * posta su internet in chiaro e' una password che viaggia in chiaro. */
    sicurezza = "",
    miChiamo = "",
    /* Solo per le prove: un certificato di cui fidarsi al posto di quelli del
     * sistema. */
    ca = undefined,
    attesa = ATTESA,
  } = {}) {
    this.server = String(server ?? "").trim();
    this.porta = Number(porta) || 587;
    this.utente = String(utente ?? "");
    this.password = String(password ?? "");
    this.sicurezza = String(sicurezza || (this.porta === 465 ? "tls" : "starttls")).toLowerCase();
    if (!["starttls", "tls", "nessuna"].includes(this.sicurezza)) {
      throw new PostaNonParte(`non so cosa sia la sicurezza «${this.sicurezza}»`);
    }
    if (this.sicurezza === "nessuna" && !QUESTA_MACCHINA.has(this.server)) {
      throw new PostaNonParte("in chiaro si parla solo con un server di posta su questa macchina");
    }
    this.miChiamo = miChiamo || hostname() || "centralino";
    this.ca = ca;
    this.attesa = attesa;
  }

  get pronto() {
    return Boolean(this.server);
  }

  _apri() {
    return new Promise((ok, no) => {
      const filo = new Filo(this.attesa);
      const arrivato = () => {
        filo.attacca(presa);
        ok(filo);
      };
      const presa =
        this.sicurezza === "tls"
          ? apriCifrato({ host: this.server, port: this.porta, ca: this.ca }, arrivato)
          : apriInChiaro({ host: this.server, port: this.porta }, arrivato);
      presa.once("error", (errore) =>
        no(new PostaNonParte(`non raggiungo il server di posta: ${errore.message}`)),
      );
    });
  }

  async _presentati(filo, servizi) {
    const modi = servizi
      .filter((riga) => /^AUTH[ =]/i.test(riga))
      .flatMap((riga) => riga.slice(5).trim().split(/\s+/))
      .map((modo) => modo.toUpperCase());
    if (modi.includes("PLAIN") || modi.length === 0) {
      const chiave = Buffer.from(`\0${this.utente}\0${this.password}`, "utf8").toString("base64");
      await filo.di(`AUTH PLAIN ${chiave}`, [235], "AUTH");
      return;
    }
    if (modi.includes("LOGIN")) {
      await filo.di("AUTH LOGIN", [334]);
      await filo.di(Buffer.from(this.utente, "utf8").toString("base64"), [334], "AUTH LOGIN");
      await filo.di(Buffer.from(this.password, "utf8").toString("base64"), [235], "AUTH LOGIN");
      return;
    }
    throw new PostaNonParte(
      `il server di posta vuole un modo di entrare che non so: ${modi.join(" ")}`,
    );
  }

  /**
   * Consegna la lettera al server di posta. Torna quando il server l'ha
   * **accettata** — il `250` dopo `DATA` — e solleva `PostaNonParte` per
   * qualunque altra cosa: chi chiama non deve dire «partita» se non lo e'.
   */
  async manda(lettera) {
    if (!this.pronto) throw new PostaNonParte("nessun server di posta");
    const filo = await this._apri();
    try {
      await filo.saluto();
      let servizi = await filo.di(`EHLO ${this.miChiamo}`, [250]);
      if (this.sicurezza === "starttls") {
        if (!servizi.some((riga) => /^STARTTLS\b/i.test(riga))) {
          throw new PostaNonParte(
            "il server di posta non offre STARTTLS, e in chiaro non si parla",
          );
        }
        await filo.di("STARTTLS", [220]);
        /* `host` e non `servername`: e' il nome con cui si verifica il
         * certificato, e Node lo manda come SNI da solo quando e' un nome e
         * non un indirizzo. */
        await filo.cifra({ host: this.server, ca: this.ca });
        servizi = await filo.di(`EHLO ${this.miChiamo}`, [250]);
      }
      if (this.utente) await this._presentati(filo, servizi);
      await filo.di(`MAIL FROM:<${lettera.mittente}>`, [250]);
      await filo.di(`RCPT TO:<${lettera.destinatario}>`, [250, 251]);
      await filo.di("DATA", [354]);
      /* Una riga che comincia col punto si raddoppia, se no il server la
       * legge come la fine. Il corpo e' base64 e non puo' cominciare cosi',
       * ma la regola si applica a tutto: costa una riga e non si sbaglia. */
      const testo = lettera.testo.replace(/^\./gm, "..");
      await filo.di(`${testo}.`, [250], "il testo");
      try {
        await filo.di("QUIT", [221]);
      } catch (_errore) {
        /* La lettera e' gia' accettata: un saluto storto non la ritira. */
      }
    } finally {
      filo.chiudi();
    }
  }
}

/* ─── La porta ───────────────────────────────────────────────────────────── */

/* Da chi arriva la richiesta. Davanti c'e' Caddy, sulla stessa macchina, che
 * scrive l'indirizzo vero in `x-forwarded-for`: quella riga si crede solo se
 * a portarla e' stata la macchina stessa, se no la scriverebbe chi vuole. */
const DA_QUI = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export function daChi(richiesta) {
  const diretto = richiesta.socket?.remoteAddress || "?";
  const passato = String(richiesta.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return DA_QUI.has(diretto) && passato ? passato : diretto;
}

/* Le parole della pagina che si vede mandando il modulo **senza**
 * JavaScript: il modulo e' un modulo, e parte lo stesso. */
const PAROLE = {
  it: {
    bene: "Il messaggio è partito.",
    beneSotto: "Rispondiamo all'indirizzo che hai scritto.",
    male: "Il messaggio non è partito.",
    scrivi: "Puoi scrivere direttamente a",
    torna: "Torna al sito",
    perche: {
      manca_il_nome: "Manca il nome.",
      email_sbagliata: "L'indirizzo email non sembra un indirizzo.",
      manca_il_messaggio: "Manca il messaggio.",
      troppo_lungo: "Il messaggio è troppo lungo.",
      troppo_spesso: "Hai scritto poco fa: aspetta un po' prima di mandare un altro messaggio.",
      posta_spenta: "Il modulo non è attivo in questo momento.",
      posta: "Il server di posta non ha accettato la lettera. Riprova fra poco.",
    },
  },
  en: {
    bene: "Your message is on its way.",
    beneSotto: "We answer at the address you wrote.",
    male: "Your message did not go out.",
    scrivi: "You can write directly to",
    torna: "Back to the site",
    perche: {
      manca_il_nome: "The name is missing.",
      email_sbagliata: "The email address does not look like an address.",
      manca_il_messaggio: "The message is missing.",
      troppo_lungo: "The message is too long.",
      troppo_spesso: "You wrote a moment ago: wait a little before sending another message.",
      posta_spenta: "The form is not active right now.",
      posta: "The mail server did not accept the letter. Try again shortly.",
    },
  },
};

const scappa = (testo) =>
  String(testo ?? "").replace(
    /[&<>"']/g,
    (uno) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[uno],
  );

/** La pagina dell'esito, per chi ha mandato il modulo senza JavaScript. */
export function paginaDellEsito({ lingua = "it", stato = 200, detto = {}, scrivi = "" } = {}) {
  const parole = PAROLE[lingua] || PAROLE.it;
  const bene = stato === 200;
  const perche = bene ? "" : parole.perche[detto.errore] || "";
  const indirizzo = scrivi && !bene ? scrivi : "";
  return `<!doctype html>
<html lang="${lingua}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>gdahome</title>
<meta name="robots" content="noindex" />
<style>
  body{margin:0;padding:32px 20px;background:#f0f4f8;color:#0f172a;display:flex;justify-content:center;
    font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  main{width:100%;max-width:34rem;background:#fff;border:1px solid #eef2f7;border-radius:20px;padding:28px 24px}
  h1{margin:0 0 10px;font-size:1.45rem;letter-spacing:-.01em}
  p{margin:0 0 14px}
  a{color:#075985}
</style>
</head>
<body>
<main>
  <h1>${scappa(bene ? parole.bene : parole.male)}</h1>
  <p>${scappa(bene ? parole.beneSotto : perche)}</p>
  ${indirizzo ? `<p>${scappa(parole.scrivi)} <a href="mailto:${scappa(indirizzo)}">${scappa(indirizzo)}</a>.</p>` : ""}
  <p><a href="/#contatti">${scappa(parole.torna)}</a></p>
</main>
</body>
</html>
`;
}

export class Contatti {
  constructor({
    postino = null,
    /* La casella che spedisce e quella che riceve. */
    da = "",
    a = "",
    /* Come si chiama il sito, per l'oggetto della lettera. */
    sito = "",
    lettereAllOra = LETTERE_ALL_ORA,
    adesso = () => Date.now(),
    registro = null,
  } = {}) {
    this.postino = postino;
    this.da = String(da ?? "").trim();
    this.a = String(a ?? "").trim();
    this.sito = sito;
    this.lettereAllOra = lettereAllOra;
    this.adesso = adesso;
    this.registro = registro;
    this.conti = new Map();
  }

  /* Se il modulo e' acceso. `/salute` lo dice: senza, la porta risponde lo
   * stesso e dice che non e' configurata invece di far finta di aver spedito. */
  get pronto() {
    return Boolean(this.postino?.pronto && emailBuona(this.da) && emailBuona(this.a));
  }

  /* Torna `true` se la via era sua — risposta gia' mandata — e `false` se non
   * la riguarda, cosi' chi chiama prova le altre porte. */
  async forseServe(richiesta, risposta, via) {
    if (via !== VIA_DEL_CONTATTO) return false;
    await this._servi(richiesta, risposta);
    return true;
  }

  /* Un indirizzo alla volta, cinque all'ora. Il conto sta in memoria e si
   * pota quando cresce: chi ha smesso di scrivere da un'ora non si ricorda. */
  _concedi(chi) {
    const ora = this.adesso();
    const quando = (this.conti.get(chi) || []).filter((una) => ora - una < UN_ORA);
    if (quando.length >= this.lettereAllOra) {
      this.conti.set(chi, quando);
      return false;
    }
    quando.push(ora);
    this.conti.set(chi, quando);
    if (this.conti.size > 5000) {
      for (const [altro, volte] of this.conti) {
        if (!volte.some((una) => ora - una < UN_ORA)) this.conti.delete(altro);
      }
    }
    return true;
  }

  async _servi(richiesta, risposta) {
    if (richiesta.method !== "POST") {
      risposta.writeHead(405, {
        allow: "POST",
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      });
      risposta.end(JSON.stringify({ errore: "solo_post" }));
      return;
    }

    const tipo = String(richiesta.headers["content-type"] || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const daModulo = tipo === "application/x-www-form-urlencoded";
    if (!daModulo && tipo !== "application/json") {
      json(risposta, { errore: "tipo_sbagliato" }, 415);
      return;
    }

    let campi;
    try {
      const testo = (await byteDi(richiesta, CORPO_MASSIMO)).toString("utf8");
      if (daModulo) {
        campi = Object.fromEntries(new URLSearchParams(testo));
      } else {
        const letto = testo.trim() ? JSON.parse(testo) : {};
        campi = letto && typeof letto === "object" ? letto : {};
      }
    } catch (errore) {
      if (errore instanceof RichiestaSbagliata) {
        json(risposta, { errore: errore.codice, spiegazione: errore.message }, errore.stato);
        return;
      }
      json(risposta, { errore: "non_json", spiegazione: "Il corpo non e' JSON." }, 400);
      return;
    }

    const lingua = campi.lingua === "en" ? "en" : "it";
    const rispondi = (stato, detto) => {
      if (!daModulo) {
        json(risposta, detto, stato);
        return;
      }
      const pagina = paginaDellEsito({ lingua, stato, detto, scrivi: this.a });
      risposta.writeHead(stato, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "content-length": Buffer.byteLength(pagina),
      });
      risposta.end(pagina);
    };

    /* La trappola: un campo che una persona non vede e non riempie. Chi lo
     * riempie e' un programma, e a un programma si risponde «partito» e non
     * si spedisce niente: dirgli di no gli insegna a fare meglio. */
    if (String(campi.sito ?? "").trim()) {
      this.registro?.attenzione?.("il modulo dei contatti: la trappola era piena, buttato");
      rispondi(200, { inviato: true });
      return;
    }

    const nome = unaRiga(campi.nome);
    const email = String(campi.email ?? "").trim();
    const messaggio = String(campi.messaggio ?? "")
      .replace(/\r\n?/g, "\n")
      .trim();
    if (!nome) {
      rispondi(400, { errore: "manca_il_nome", spiegazione: "Manca il nome." });
      return;
    }
    if (nome.length > NOME_MASSIMO || messaggio.length > MESSAGGIO_MASSIMO) {
      rispondi(400, { errore: "troppo_lungo", spiegazione: "Il messaggio e' troppo lungo." });
      return;
    }
    if (!emailBuona(email)) {
      rispondi(400, { errore: "email_sbagliata", spiegazione: "L'indirizzo non e' un indirizzo." });
      return;
    }
    if (!messaggio) {
      rispondi(400, { errore: "manca_il_messaggio", spiegazione: "Manca il messaggio." });
      return;
    }
    if (!this.pronto) {
      rispondi(503, {
        errore: "posta_spenta",
        spiegazione: "Il modulo non e' configurato.",
        ...(this.a ? { scrivi: this.a } : {}),
      });
      return;
    }
    if (!this._concedi(daChi(richiesta))) {
      rispondi(429, { errore: "troppo_spesso", spiegazione: "Troppe lettere in un'ora." });
      return;
    }

    try {
      await this.postino.manda(
        laLettera({ nome, email, messaggio, lingua, da: this.da, a: this.a, sito: this.sito }),
      );
    } catch (errore) {
      this.registro?.errore?.(
        `il modulo dei contatti: la lettera non e' partita: ${errore?.message || errore}`,
      );
      rispondi(502, { errore: "posta", spiegazione: "La lettera non e' partita.", scrivi: this.a });
      return;
    }
    this.registro?.info?.("il modulo dei contatti: una lettera partita");
    rispondi(200, { inviato: true });
  }
}
