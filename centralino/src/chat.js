/* La chat dell'assistenza: la buca delle lettere fra una casa e chi risponde.
 *
 * Due sportelli e nient'altro. Da una parte una casa — anonima, riconosciuta
 * da un segreto che si e' fabbricata da sola — che scrive e legge il proprio
 * filo. Dall'altra la console, che con una chiave sola vede tutte le linee e
 * risponde.
 *
 * Quello che questo pezzo NON fa e' la parte importante: non sa chi sia
 * nessuno, non tiene indirizzi, non guarda dentro le case. Sa solo che la
 * linea `casa_9f3a…` ha scritto «non mi si vede la temperatura» alle 14:02.
 *
 * **Da dove viene.** E' il porto del centralino della chat della dashboard,
 * che e' un Worker a parte con un database suo. Le vie sono le stesse, i
 * limiti sono gli stessi, l'impronta del segreto e' la stessa — SHA-256 in
 * esadecimale — quindi il ponte non si accorge di aver cambiato indirizzo, e
 * un giorno le due chat si potranno ricongiungere qui senza riabbinare niente.
 *
 * **Perche' si sposta.** Perche' su Cloudflare i messaggi si contano, e una
 * chat e' fatta di letture: la finestra chiede «c'e' qualcosa di nuovo?» ogni
 * cinque minuti, per ogni casa che l'ha aperta almeno una volta. Qui invece
 * non li conta nessuno.
 *
 * **L'archivio.** SQLite, quello che Node si porta dentro: le due letture che
 * si fanno davvero — «i messaggi di questa linea dopo il numero N» e «quali
 * linee hanno parlato per ultime» — sono due righe di SQL con un indice
 * dietro, e sono le stesse che c'erano sul Worker. Le case qui si chiamano
 * «linee» perche' `case` e' una parola riservata di SQL, e perche' a un
 * centralino e' quello che sono.
 */

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { Freno } from "./freno.js";
import { daChi } from "./indirizzo.js";
import { impronta, stessoSegreto } from "./segreti.js";
import { tagliaBene } from "./testo.js";
import { corpoDi } from "./sportello.js";

export const LIMITI = Object.freeze({
  /* Un messaggio piu' lungo di cosi' non e' una domanda, e' un incollaggio. */
  testo: 4000,
  nome: 60,
  etichetta: 40,
  /* Chi ne scrive piu' di venti in un'ora non sta chiedendo aiuto. */
  alOra: 20,
  /* Quante linee possono NASCERE in un'ora, in tutto il centralino. Il limite
   * dei venti messaggi vale per una linea che esiste gia': chi si fabbrica un
   * identificativo nuovo a ogni richiesta prenderebbe sempre il ramo «linea
   * assente», dove quel limite non viene nemmeno guardato. */
  nuoveAllOra: 60,
  /* E quante da uno stesso indirizzo: il tetto di sopra e' di tutti, e chi
   * lo riempisse da solo chiuderebbe la porta a chi chiede aiuto davvero.
   * Una casa vera apre una linea sola, una volta. */
  nuovePerIndirizzo: 5,
  /* Una chat di assistenza non e' un archivio: oltre questi, i piu' vecchi se
   * ne vanno. */
  storia: 200,
  /* Quanti ne torna una lettura, al massimo. */
  pagina: 100,
  /* Una linea ferma da sei mesi si cancella, conversazione compresa. */
  silenzio: 180 * 24 * 60 * 60 * 1000,
});

const ORA = 60 * 60 * 1000;

/* Quanti tentativi sbagliati prima di chiudere la porta, e per quanto.
 *
 * Serve da quando la chiave della console la puo' **scegliere** una persona, e
 * una chiave scelta da una persona si prova. Senza un freno, provarle da fuori
 * costa solo il tempo che ci mette la macchina a rispondere — qualche migliaio
 * al minuto, e una parola che uno si ricorda cade in mezz'ora. Con il freno ne
 * passano dieci ogni quarto d'ora, e non cade piu' niente.
 *
 * Si conta per indirizzo, e in piu' c'e' un tetto in tutto. Il conto per
 * indirizzo da solo non ferma chi prova da mille indirizzi — dieci a testa
 * sono diecimila all'ora. Il tetto in tutto e' largo apposta: chi lo riempie
 * chiude fuori per un po' anche chi risponde, ed e' il prezzo di non lasciar
 * provare all'infinito. Chi ha la macchina in mano la riapre riavviando. */
const SBAGLI_PRIMA_DI_CHIUDERE = 10;
const QUANTO_RESTA_CHIUSA = 15 * 60 * 1000;
export const SBAGLI_IN_TUTTO_ALL_ORA = 200;

/* Quanto deve essere lunga la chiave della console perche' la console si
 * apra. Quella che fa la macchina e' di quarantotto caratteri; una scelta a
 * mano deve arrivare almeno a trentadue. */
export const CHIAVE_MINIMA = 32;

export const LINEA_VALIDA = /^casa_[0-9a-f]{32}$/;

export const VIA_DELLA_CASA = "/casa/messaggi";
export const VIA_DELLA_CONSOLE = "/console/conversazioni";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS linee (
  id            TEXT    PRIMARY KEY,
  segreto       TEXT    NOT NULL,
  nome          TEXT    NOT NULL DEFAULT '',
  versione      TEXT    NOT NULL DEFAULT '',
  ha            TEXT    NOT NULL DEFAULT '',
  lingua        TEXT    NOT NULL DEFAULT '',
  aperta_il     INTEGER NOT NULL,
  vista_il      INTEGER NOT NULL,
  letto_casa    INTEGER NOT NULL DEFAULT 0,
  letto_console INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS messaggi (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  linea      TEXT    NOT NULL,
  da         TEXT    NOT NULL,
  testo      TEXT    NOT NULL,
  scritto_il INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS messaggi_per_linea ON messaggi (linea, id);
CREATE INDEX IF NOT EXISTS linee_per_visita ON linee (vista_il DESC);
`;

/* Il taglio non spezza un emoji: `slice` conta le unita' UTF-16, e mezza
 * coppia scritta come UTF-8 diventa il rombo col punto di domanda — nel JSON
 * che parte e nell'archivio che lo conserva. Sta in `testo.js` insieme al
 * perche'. */
const testoPulito = (valore, massimo) =>
  typeof valore === "string" ? tagliaBene(valore.trim(), massimo) : "";

/* ─── L'archivio ─────────────────────────────────────────────────────────── */

export class ArchivioDellaChat {
  constructor(percorso, { adesso = () => Date.now() } = {}) {
    if (percorso !== ":memory:") {
      try {
        mkdirSync(dirname(percorso), { recursive: true });
      } catch (_errore) {
        /* C'e' gia'. */
      }
    }
    this.adesso = adesso;
    this.db = new DatabaseSync(percorso);
    /* Con WAL una lettura non aspetta una scrittura: la console che sfoglia e
     * una casa che scrive non si mettono in fila. */
    if (percorso !== ":memory:") this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec(SCHEMA);
  }

  /* Riconoscere una linea. Torna `null` se il segreto non e' quello,
   * `"assente"` se la linea non c'e' ancora, `"aperta"` se e' sua. */
  riconosci(id, segreto) {
    const esistente = this.db.prepare("SELECT segreto FROM linee WHERE id = ?").get(id);
    if (!esistente) return "assente";
    return stessoSegreto(esistente.segreto, impronta(segreto)) ? "aperta" : null;
  }

  /* Una linea nasce **solo con un messaggio**, mai con una lettura. Se
   * nascesse leggendo, chiunque potrebbe fabbricarne un milione con un milione
   * di GET senza aver mai detto niente. */
  apriLaLinea(id, segreto, note) {
    const adesso = this.adesso();
    this.db
      .prepare(
        `INSERT INTO linee (id, segreto, nome, versione, ha, lingua, aperta_il, vista_il)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, impronta(segreto), note.nome, note.versione, note.ha, note.lingua, adesso, adesso);
  }

  /* Le tre note si riscrivono a ogni giro: la plancia si aggiorna, e una
   * conversazione che dice «1.4.2» quando la casa e' alla 1.4.5 fa perdere
   * tempo a tutti e due. Il nome si riscrive solo se e' stato dato: un campo
   * lasciato vuoto non cancella quello di ieri. */
  aggiornaLeNote(id, note) {
    this.db
      .prepare(
        `UPDATE linee SET vista_il = ?, versione = ?, ha = ?, lingua = ?,
           nome = CASE WHEN ? <> '' THEN ? ELSE nome END
         WHERE id = ?`,
      )
      .run(this.adesso(), note.versione, note.ha, note.lingua, note.nome, note.nome, id);
  }

  troppeLineeNuove() {
    const riga = this.db
      .prepare("SELECT COUNT(*) AS quante FROM linee WHERE aperta_il > ?")
      .get(this.adesso() - ORA);
    return Number(riga?.quante || 0) >= LIMITI.nuoveAllOra;
  }

  troppiMessaggi(id) {
    const riga = this.db
      .prepare(
        "SELECT COUNT(*) AS quanti FROM messaggi WHERE linea = ? AND da = 'casa' AND scritto_il > ?",
      )
      .get(id, this.adesso() - ORA);
    return Number(riga?.quanti || 0) >= LIMITI.alOra;
  }

  /* La storia si accorcia da sola, e si accorcia qui invece che in un giro
   * notturno: il momento in cui una conversazione diventa troppo lunga e' il
   * momento in cui le si aggiunge una riga. */
  _sfoltisci(id) {
    this.db
      .prepare(
        `DELETE FROM messaggi WHERE linea = ? AND id NOT IN (
           SELECT id FROM messaggi WHERE linea = ? ORDER BY id DESC LIMIT ?
         )`,
      )
      .run(id, id, LIMITI.storia);
  }

  /* Scrivere una riga, e solo se la linea c'e' ancora.
   *
   * Il controllo sta DENTRO l'inserimento, e non e' pignoleria: fra un «la
   * linea esiste?» e un «scrivi» staccati ci sta una cancellazione — chi
   * risponde butta via la conversazione nell'istante in cui la casa sta
   * scrivendo — e quel messaggio resterebbe in archivio legato a una linea che
   * non esiste piu', senza che nessuna lettura lo raggiunga mai. Parole di una
   * persona, conservate per sempre in un servizio che promette il contrario.
   *
   * `INSERT … SELECT … WHERE EXISTS` e' un'istruzione sola: o la linea c'e' nel
   * momento in cui si scrive, o non si scrive niente. */
  scrivi(id, da, testo) {
    const adesso = this.adesso();
    const messo = this.db
      .prepare(
        `INSERT INTO messaggi (linea, da, testo, scritto_il)
         SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM linee WHERE id = ?)
         RETURNING id`,
      )
      .get(id, da, testo, adesso, id);
    if (!messo) return null;
    this._sfoltisci(id);
    return { id: Number(messo.id || 0), da, testo, scritto_il: adesso };
  }

  messaggiDopo(id, dopo) {
    return this.db
      .prepare(
        "SELECT id, da, testo, scritto_il FROM messaggi WHERE linea = ? AND id > ? ORDER BY id LIMIT ?",
      )
      .all(id, dopo, LIMITI.pagina)
      .map((riga) => ({ ...riga }));
  }

  /* Cancellare vuol dire cancellare: la linea sparisce dal centralino, non
   * solo dallo schermo di chi l'ha chiesto. */
  cancella(id) {
    this.db.exec("BEGIN");
    try {
      this.db.prepare("DELETE FROM messaggi WHERE linea = ?").run(id);
      this.db.prepare("DELETE FROM linee WHERE id = ?").run(id);
      this.db.exec("COMMIT");
    } catch (errore) {
      this.db.exec("ROLLBACK");
      throw errore;
    }
  }

  /* L'elenco: una riga per linea, con l'ultima cosa detta e quante non lette.
   * Il testo intero non serve a decidere quale aprire, il primo pezzo si'. */
  conversazioni() {
    return this.db
      .prepare(
        `SELECT l.id, l.nome, l.versione, l.ha, l.lingua, l.aperta_il, l.vista_il,
                l.letto_console,
                (SELECT COUNT(*) FROM messaggi m
                  WHERE m.linea = l.id AND m.da = 'casa' AND m.id > l.letto_console) AS non_letti,
                (SELECT m.testo FROM messaggi m
                  WHERE m.linea = l.id ORDER BY m.id DESC LIMIT 1) AS ultimo,
                (SELECT m.scritto_il FROM messaggi m
                  WHERE m.linea = l.id ORDER BY m.id DESC LIMIT 1) AS ultimo_il
           FROM linee l
          ORDER BY ultimo_il DESC NULLS LAST
          LIMIT ?`,
      )
      .all(LIMITI.pagina)
      .map((riga) => ({ ...riga, ultimo: testoPulito(riga.ultimo, 160) }));
  }

  esiste(id) {
    return Boolean(this.db.prepare("SELECT id FROM linee WHERE id = ?").get(id));
  }

  /* Due segnalibri sullo stesso filo, uno per sportello. */
  segnalibro(id, quale, fino) {
    if (!fino) return;
    const colonna = quale === "console" ? "letto_console" : "letto_casa";
    this.db.prepare(`UPDATE linee SET ${colonna} = MAX(${colonna}, ?) WHERE id = ?`).run(fino, id);
  }

  /* Le linee che non parlano da sei mesi se ne vanno, e con loro tutto quello
   * che avevano detto. Tenere per sempre le parole di chi non torna piu' non
   * serve a nessuno dei due. */
  potatura() {
    const limite = this.adesso() - LIMITI.silenzio;
    const quante = Number(
      this.db.prepare("SELECT COUNT(*) AS q FROM linee WHERE vista_il < ?").get(limite)?.q || 0,
    );
    this.db.exec("BEGIN");
    try {
      this.db
        .prepare("DELETE FROM messaggi WHERE linea IN (SELECT id FROM linee WHERE vista_il < ?)")
        .run(limite);
      this.db.prepare("DELETE FROM linee WHERE vista_il < ?").run(limite);
      /* E i messaggi che non appartengono piu' a nessuna linea: `scrivi` non
       * ne fabbrica, ma un archivio portato da altrove potrebbe averne. */
      this.db.prepare("DELETE FROM messaggi WHERE linea NOT IN (SELECT id FROM linee)").run();
      this.db.exec("COMMIT");
    } catch (errore) {
      this.db.exec("ROLLBACK");
      throw errore;
    }
    return quante;
  }

  quanteLinee() {
    return Number(this.db.prepare("SELECT COUNT(*) AS q FROM linee").get()?.q || 0);
  }

  chiudi() {
    try {
      this.db.close();
    } catch (_errore) {
      /* Gia' chiuso. */
    }
  }
}

/* ─── Gli sportelli ──────────────────────────────────────────────────────── */

/* Due chiavi si confrontano per impronta, non per come sono scritte: le
 * impronte sono sempre lunghe uguale, e il confronto non racconta niente —
 * nemmeno quanto e' lunga la chiave vera. */
const stessaChiave = (una, altra) => stessoSegreto(impronta(una), impronta(altra));

/* Le risposte della chat non concedono nessuna origine, e non e' una
 * dimenticanza: da qui passano il ponte — che parla dal server di Home
 * Assistant — e la console, che sta sullo stesso indirizzo. Un browser di
 * un'altra origine non ci arriva mai, quindi non gli si apre la porta. */
function rispondi(risposta, corpo, stato = 200) {
  const testo = JSON.stringify(corpo);
  risposta.writeHead(stato, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(testo),
  });
  risposta.end(testo);
}

const male = (risposta, stato, perche) => rispondi(risposta, { errore: perche }, stato);

function chiaveDellaRichiesta(richiesta) {
  const trovato = /^Bearer\s+(.+)$/i.exec(String(richiesta.headers.authorization || "").trim());
  return trovato ? trovato[1].trim() : "";
}

export class Chat {
  constructor({
    archivio,
    chiaveDellaConsole = "",
    adesso = () => Date.now(),
    /* Le case che il centralino conosce, per non lasciar nascere una linea
     * col nome di una casa a chi non ne ha il segreto. Vedi `_puoNascere`. */
    case: case_ = null,
    /* Se `true`, una linea nasce **solo** col nome e il segreto di una casa
     * che si e' gia' presentata dal filo. Spento di serie: oggi il ponte
     * scrive in chat con un nome e un segreto suoi, diversi da quelli del
     * filo, e con l'interruttore acceso nessuna linea nuova nascerebbe. */
    soloCaseConosciute = false,
    sbagliInTutto = SBAGLI_IN_TUTTO_ALL_ORA,
    nuovePerIndirizzo = LIMITI.nuovePerIndirizzo,
  }) {
    this.archivio = archivio;
    this.chiaveDellaConsole = String(chiaveDellaConsole || "");
    this.adesso = adesso;
    this.case = case_;
    this.soloCaseConosciute = Boolean(soloCaseConosciute);
    /* Chi ha sbagliato, quante volte, e fino a quando resta fuori. Sta in
     * memoria e basta: un riavvio la azzera, ed e' giusto — chi riavvia il
     * tramite e' chi ce l'ha in mano. */
    this._sbagli = new Map();
    this._sbagliInTutto = new Freno({ inTutto: sbagliInTutto, adesso });
    this._lineeNuove = new Freno({ perChi: nuovePerIndirizzo, adesso });
  }

  /* Da dove bussa davvero: la regola e' quella di tutte le porte, in
   * `indirizzo.js`. Prima qui si credeva a `x-forwarded-for` chiunque lo
   * portasse, e bastava scriverci un indirizzo nuovo a ogni tentativo per
   * non essere mai contati. */
  _daDove(richiesta) {
    return daChi(richiesta);
  }

  _chiusaPer(da) {
    if (!this._sbagliInTutto.cePosto()) return QUANTO_RESTA_CHIUSA;
    const segnato = this._sbagli.get(da);
    if (!segnato) return 0;
    const quanto = segnato.chiusaFino - this.adesso();
    return quanto > 0 ? quanto : 0;
  }

  /* Se una linea nuova puo' nascere con questo nome e questo segreto.
   *
   * Il nome di una linea e' quello che la casa si da'. Se e' il nome di una
   * casa che il centralino conosce dal filo, la linea nasce solo col segreto
   * di quella casa: se no chi conosce l'identificativo di una casa — che non
   * e' un segreto, viaggia negli indirizzi — potrebbe aprire lui la linea a
   * suo nome, e chi risponde crederebbe di parlare con lei. */
  _puoNascere(id, segreto) {
    if (!this.case) return !this.soloCaseConosciute;
    if (this.case.quella?.(id)) return this.case.verifica(id, segreto);
    return !this.soloCaseConosciute;
  }

  _unoSbagliato(da) {
    const ora = this.adesso();
    /* Una pulita ai vecchi, cosi' la memoria non cresce all'infinito con gli
     * indirizzi di chi ha provato una volta sei mesi fa. */
    if (this._sbagli.size > 1000) {
      for (const [chi, quando] of this._sbagli) {
        if (quando.chiusaFino < ora) this._sbagli.delete(chi);
      }
    }
    const segnato = this._sbagli.get(da) ?? { quanti: 0, chiusaFino: 0 };
    segnato.quanti += 1;
    if (segnato.quanti >= SBAGLI_PRIMA_DI_CHIUDERE) {
      segnato.quanti = 0;
      segnato.chiusaFino = ora + QUANTO_RESTA_CHIUSA;
    }
    this._sbagli.set(da, segnato);
    this._sbagliInTutto.conta();
  }

  /* Se la console si puo' aprire. Senza chiave lo sportello della casa
   * funziona lo stesso — le case scrivono — ma nessuno puo' leggere: e' il
   * genere di cosa che va detta in `/salute` invece di scoprirla il giorno in
   * cui qualcuno chiede aiuto. */
  get consoleAperta() {
    return this.chiaveDellaConsole.length >= CHIAVE_MINIMA;
  }

  /* Torna `true` se la via era sua — risposta gia' mandata — e `false` se non
   * la riguarda. */
  async forseServe(richiesta, risposta, indirizzo) {
    const via = indirizzo.pathname;
    try {
      if (via === VIA_DELLA_CASA) {
        await this._casa(richiesta, risposta, indirizzo);
        return true;
      }
      if (via === VIA_DELLA_CONSOLE || via.startsWith(`${VIA_DELLA_CONSOLE}/`)) {
        await this._console(richiesta, risposta, indirizzo);
        return true;
      }
      return false;
    } catch (errore) {
      /* Il motivo vero resta nel registro: quello che esce di qui non deve
       * raccontare com'e' fatto l'archivio a chi bussa a caso. */
      if (errore?.codice === "corpo") {
        male(risposta, 400, "corpo illeggibile");
        return true;
      }
      throw errore;
    }
  }

  async _leggiIlCorpo(richiesta) {
    try {
      return await corpoDi(richiesta);
    } catch (_errore) {
      const suo = new Error("corpo illeggibile");
      suo.codice = "corpo";
      throw suo;
    }
  }

  /* ─── Lo sportello della casa ───────────────────────────────────────── */

  async _casa(richiesta, risposta, indirizzo) {
    const id = testoPulito(richiesta.headers["x-casa"], 64);
    if (!LINEA_VALIDA.test(id)) return male(risposta, 400, "linea non valida");
    const segreto = chiaveDellaRichiesta(richiesta);
    if (segreto.length < 32) return male(risposta, 401, "segreto mancante");

    const corpo = richiesta.method === "POST" ? await this._leggiIlCorpo(richiesta) : {};

    const note = {
      nome: testoPulito(corpo?.nome ?? richiesta.headers["x-nome"], LIMITI.nome),
      versione: testoPulito(richiesta.headers["x-versione"], LIMITI.etichetta),
      ha: testoPulito(richiesta.headers["x-ha"], LIMITI.etichetta),
      lingua: testoPulito(richiesta.headers["x-lingua"], 12),
    };

    const stato = this.archivio.riconosci(id, segreto);
    if (stato === null) return male(risposta, 403, "segreto sbagliato");

    if (richiesta.method === "POST") {
      const testo = testoPulito(corpo?.testo, LIMITI.testo);
      if (!testo) return male(risposta, 400, "messaggio vuoto");
      if (stato === "assente") {
        if (!this._puoNascere(id, segreto)) return male(risposta, 403, "segreto sbagliato");
        if (this.archivio.troppeLineeNuove())
          return male(risposta, 429, "troppe conversazioni nuove");
        if (!this._lineeNuove.concedi(daChi(richiesta)))
          return male(risposta, 429, "troppe conversazioni nuove");
        this.archivio.apriLaLinea(id, segreto, note);
      } else {
        if (this.archivio.troppiMessaggi(id))
          return male(risposta, 429, "troppi messaggi in un'ora");
        this.archivio.aggiornaLeNote(id, note);
      }
      const messaggio = this.archivio.scrivi(id, "casa", testo);
      if (!messaggio) return male(risposta, 404, "la conversazione non c'e' piu'");
      /* «Nata adesso» serve dall'altra parte: se la casa aveva gia' una copia
       * della conversazione e la linea e' rinata con questo messaggio, vuol
       * dire che nel frattempo qualcuno l'aveva cancellata — e quella copia
       * parla di un filo che non esiste piu'. */
      return rispondi(risposta, { messaggio, nuova: stato === "assente" });
    }

    /* Da qui in giu' la linea deve esserci gia': non si legge e non si
     * cancella una conversazione che nessuno ha ancora aperto. */
    if (stato === "assente") return rispondi(risposta, { messaggi: [], aperta: false });

    if (richiesta.method === "DELETE") {
      this.archivio.cancella(id);
      return rispondi(risposta, { cancellata: true });
    }

    if (richiesta.method !== "GET") return male(risposta, 405, "metodo non previsto");

    this.archivio.aggiornaLeNote(id, note);
    const dopo = Number(indirizzo.searchParams.get("dopo") || 0) || 0;
    const messaggi = this.archivio.messaggiDopo(id, dopo);
    /* Leggere e' aver letto: chi apre la propria conversazione ha visto quello
     * che c'era, e il pallino si spegne qui invece che con una chiamata in
     * piu'. */
    this.archivio.segnalibro(id, "casa", messaggi.length ? messaggi[messaggi.length - 1].id : 0);
    return rispondi(risposta, { messaggi, aperta: true });
  }

  /* ─── Lo sportello della console ────────────────────────────────────── */

  async _console(richiesta, risposta, indirizzo) {
    const da = this._daDove(richiesta);
    const chiusaPer = this._chiusaPer(da);
    if (chiusaPer) {
      return male(
        risposta,
        429,
        `troppi tentativi: riprova fra ${Math.ceil(chiusaPer / 60000)} minuti`,
      );
    }

    const chiave = chiaveDellaRichiesta(richiesta);
    if (!this.consoleAperta || !stessaChiave(chiave, this.chiaveDellaConsole)) {
      this._unoSbagliato(da);
      return male(risposta, 403, "chiave sbagliata");
    }
    /* Entrato: quello che aveva sbagliato prima non conta piu'. */
    this._sbagli.delete(da);

    const pezzi = indirizzo.pathname.split("/").filter(Boolean);
    const linea = pezzi[2] ? testoPulito(pezzi[2], 64) : "";

    if (!linea) return rispondi(risposta, { conversazioni: this.archivio.conversazioni() });
    if (!LINEA_VALIDA.test(linea)) return male(risposta, 400, "linea non valida");

    if (richiesta.method === "POST") {
      const corpo = await this._leggiIlCorpo(richiesta);
      const testo = testoPulito(corpo?.testo, LIMITI.testo);
      if (!testo) return male(risposta, 400, "messaggio vuoto");
      if (!this.archivio.esiste(linea)) return male(risposta, 404, "linea sconosciuta");
      const messaggio = this.archivio.scrivi(linea, "console", testo);
      if (!messaggio) return male(risposta, 404, "linea sconosciuta");
      return rispondi(risposta, { messaggio });
    }

    /* Su una linea che non c'e' piu' risponde di si' lo stesso, e non 404: chi
     * cancella vuole che non ci sia, e se non c'e' gia' il risultato e'
     * quello. */
    if (richiesta.method === "DELETE") {
      this.archivio.cancella(linea);
      return rispondi(risposta, { cancellata: true });
    }

    if (richiesta.method !== "GET") return male(risposta, 405, "metodo non previsto");

    const dopo = Number(indirizzo.searchParams.get("dopo") || 0) || 0;
    const messaggi = this.archivio.messaggiDopo(linea, dopo);
    this.archivio.segnalibro(
      linea,
      "console",
      messaggi.length ? messaggi[messaggi.length - 1].id : 0,
    );
    return rispondi(risposta, { messaggi });
  }
}
