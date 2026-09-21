/* La plancia: i file di DashboardModern, dentro l'add-on.
 *
 * In Home Assistant non c'e' e non deve esserci nessuna integrazione: la
 * plancia — la pagina, i moduli, i caratteri, i ritratti — sta qui, in
 * `ponte/plancia/`, e il ponte la serve al telefono sul filo. Il telefono la tiene sul disco e la
 * ricarica solo quando cambia.
 *
 * Come fa a sapere che e' cambiata: dal percorso. I file si servono sotto
 * `/dashboardmodern_static/<impronta>/…`, e l'impronta e' un'impronta del
 * contenuto: aggiornare la plancia cambia l'impronta, cambia i percorsi, e il
 * telefono si ritrova con dei file nuovi da chiedere senza che nessuno gli
 * dica niente. E' lo stesso meccanismo dell'integrazione, che per questo la
 * pagina gia' capisce.
 *
 * Due cartelle stanno fuori dall'impronta, `avatars/` e `brands/`: sono
 * trecento immagini che non cambiano da una versione all'altra, e la pagina
 * le chiede con un percorso assoluto senza impronta.
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { dipendeDaChi, firmaDelVestito, NOME, vestiDiGdahome } from "./marchio.js";
import { guardaLaPlancia, inDueParole } from "./provenienza.js";

export const BASE = "/dashboardmodern_static";

const TIPI = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  /* Le licenze dei ritratti e dei loghi delle auto, che stanno nella cartella
   * delle immagini che coprono. Una licenza che si distribuisce ma non si puo'
   * aprire non serve a niente. Gli altri file della plancia che non sono roba
   * da browser — `legacy/SOURCE.md`, le toppe in `legacy/patches/` — restano
   * fuori: nessuno li chiede a un indirizzo, e il sigillo li guarda lo stesso
   * (`provenienza.js`), che e' un'altra domanda. */
  ".txt": "text/plain; charset=utf-8",
});

/* Quello che concorre all'impronta: la pagina e i moduli. */
const CON_IMPRONTA = ["legacy", "src"];

/* Quello che sta fuori dall'impronta, e si serve com'e'. */
const FISSE = new Set(["avatars", "brands"]);

/* Un pezzo di percorso e' fatto di lettere, numeri e pochi segni. */
const PEZZO_BUONO = /^[A-Za-z0-9_\-.@+~]+$/;

/* ── Quello che si stringe, e quello che si tiene a mente ────────────────
 *
 * Misurato sulla plancia vera, i trecentosessantotto file che la pagina chiede
 * all'apertura: **nove megabyte e mezzo** serviti com'erano, **tre** se
 * compressi. Il sessantotto per cento di roba che non doveva viaggiare.
 *
 * Il telefono quel conto lo aveva gia': sul filo i moduli viaggiano a pacchi e
 * compressi (`commissioni.js`). Dentro Home Assistant invece la pagina li
 * chiede uno per uno all'ingress, e li chiedeva in chiaro.
 *
 * Comprimerli a ogni richiesta pero' e' peggio del male: sempre misurato,
 * novantaquattro millesimi di filo fermo per leggerli tutti, trecentodieci per
 * leggerli e stringerli. Node ha un filo solo: quel tempo non e' distribuito,
 * e' una fila. Per questo si stringe **una volta** e ci si tiene il risultato:
 * nell'indirizzo c'e' l'impronta del contenuto, quindi finche' l'add-on e'
 * acceso quei file non cambiano, e leggerli due volte e' leggere due volte la
 * stessa cosa. */

/* Cosa conviene stringere. Un png, un webp, un woff2 sono gia' compressi:
 * ripassarci sopra costa filo e non toglie un byte. */
const DA_STRINGERE = /^(?:text\/|application\/(?:javascript|json)|image\/svg)/i;

/* Sotto questa misura non si stringe: l'intestazione che dice «e' compresso»
 * e' lunga quanto il risparmio. */
const ALMENO = 512;

/* Sei e' il compromesso di sempre. Nove toglie un altro due per cento e costa
 * il doppio del tempo, e qui il tempo e' il filo di tutta la casa. */
const QUANTO_STRETTO = 6;

/* Quanto si tiene a mente. I tre megabyte compressi che servono all'apertura
 * ci stanno con l'abbondanza; oltre il tetto non si ricorda piu' niente di
 * nuovo, e si continua a servire leggendo dal disco. Meglio una plancia lenta
 * che un add-on che si mangia la memoria di casa. */
const IL_TETTO = 8 * 1024 * 1024;

/* Chi chiede dice cosa sa aprire. Si guarda solo «gzip», e si rispetta il «non
 * lo voglio» scritto come `gzip;q=0`, che e' il modo con cui un browser in
 * difficolta' chiede di essere lasciato in pace. */
function accettaStretto(accetta) {
  const detto = String(accetta || "").toLowerCase();
  if (!detto.includes("gzip")) return false;
  return !/gzip\s*;\s*q\s*=\s*0(?:\.0+)?(?:\s|,|$)/.test(detto);
}

export class Plancia {
  constructor({
    cartella = process.env.PONTE_PLANCIA_CARTELLA ||
      fileURLToPath(new URL("../plancia", import.meta.url)),
    installatore = null,
  } = {}) {
    this.cartella = resolve(cartella);
    /* Chi segue questa casa, quando c'e': una funzione, e non un oggetto,
     * perche' la risposta cambia mentre il ponte gira — un installatore si
     * abbina e si toglie — e un oggetto passato all'accensione resterebbe
     * quello di allora. Vuota vuol dire «il marchio e' il nostro», che e' il
     * caso di quasi tutte le case. */
    this.installatore = installatore;
    this._impronta = null;
    this._provenienza = null;
    /* Quello che si e' gia' letto, vestito e stretto. Le chiavi sono percorsi
     * che portano l'impronta dentro: una voce di ieri non puo' rispondere per
     * un file di oggi, perche' di oggi cambia il percorso. */
    this._aMente = new Map();
    this._quantoAMente = 0;
  }

  /** Quanto si sta tenendo a mente, in byte. Serve alla diagnostica. */
  get quantoAMente() {
    return this._quantoAMente;
  }

  /** Dimentica tutto: la prossima domanda si rilegge dal disco. */
  dimentica() {
    this._aMente.clear();
    this._quantoAMente = 0;
  }

  /* C'e' una plancia da servire? Basta che ci sia la pagina. */
  get cE() {
    return existsSync(join(this.cartella, "legacy", "dashboard.html"));
  }

  /* Da dove viene questa plancia, e se qualcuno l'ha toccata.
   *
   * Si guarda una volta e ci si tiene la risposta: sono ottocento file da
   * leggere, e la risposta non cambia mentre il ponte e' acceso — se cambiano
   * i file, cambiano al prossimo aggiornamento, e l'add-on si riavvia. */
  get provenienza() {
    if (!this._provenienza) this._provenienza = guardaLaPlancia(this.cartella);
    return this._provenienza;
  }

  /* Il verdetto in una riga, per il registro all'avvio. */
  get provenienzaInDueParole() {
    return inDueParole(this.provenienza);
  }

  /* L'impronta del contenuto: si calcola una volta, alla prima domanda. */
  get impronta() {
    if (this._impronta) return this._impronta;
    const somma = createHash("sha256");
    let quanti = 0;
    for (const cartella of CON_IMPRONTA) {
      for (const relativo of this._iFile(join(this.cartella, cartella), cartella)) {
        somma.update(relativo);
        somma.update("\0");
        somma.update(readFileSync(join(this.cartella, relativo)));
        somma.update("\0");
        quanti += 1;
      }
    }
    this._impronta = somma.digest("hex").slice(0, 16);
    this._quanti = quanti;
    return this._impronta;
  }

  get base() {
    return `${BASE}/${this.impronta}`;
  }

  /* Le pagine che ci sono davvero: `dashboard.html`, `dashboard-en.html`. */
  varianti() {
    try {
      return readdirSync(join(this.cartella, "legacy"))
        .filter((nome) => /^dashboard.*\.html$/.test(nome))
        .sort();
    } catch (_errore) {
      return [];
    }
  }

  /* Da dove viene, per chi vuole saperlo: lo scrive lo script che la porta. */
  origine() {
    try {
      const letto = JSON.parse(readFileSync(join(this.cartella, "ORIGINE.json"), "utf8"));
      return letto && typeof letto === "object" ? letto : {};
    } catch (_errore) {
      return {};
    }
  }

  /* Quello che il telefono chiede con `ponte/plancia`: dove stanno i file, e
   * come la pagina deve presentarsi. E' la stessa forma che l'integrazione
   * scrive nel suo pannello, cosi' l'app le legge tutte e due allo stesso
   * modo.
   *
   * I file sono **gli stessi per tutte le plance** — una sola plancia sul
   * disco, una sola impronta — e quello che cambia da una all'altra sono tre
   * nomi: il titolo, il cassetto della configurazione e l'istanza. Chi non ne
   * passa nessuno ha la prima, che e' il caso di chiunque non abbia mai
   * aggiunto niente. */
  descrizione(quale = null) {
    const origine = this.origine();
    const vesti = this.vestiDi(quale);
    return {
      base: this.base,
      impronta: this.impronta,
      varianti: this.varianti(),
      titolo: quale?.titolo || NOME,
      istanza: quale?.istanza || NOME,
      profilo: quale?.profilo || "primary",
      primario: quale ? quale.primaria !== false : true,
      /* Le vesti scelte per questa plancia da chi installa: la parola del
       * velo e la scritta della testata. Vuote se non ha scelto niente. Chi
       * serve la pagina — il servitore dell'app — le scrive in testa. */
      velo: vesti?.velo || "",
      testata: vesti?.testata || "",
      file: this._quanti,
      commit: typeof origine.commit === "string" ? origine.commit : "",
      portata_il: typeof origine.portata_il === "string" ? origine.portata_il : "",
    };
  }

  /* Le vesti di una plancia: la parola del velo e la scritta della testata
   * che chi installa ha scelto per **questa**, o `null` se non ha scelto
   * niente. Le legge chi serve la pagina — dentro Home Assistant e nell'app —
   * e le scrive in testa; vedi `premesse.js`. */
  vestiDi(quale) {
    const suo = this.installatore?.(quale?.profilo || "");
    if (!suo) return null;
    /* Quello che si vede, non solo quello che e' stato scelto: senza una
     * scelta la parola del velo e la scritta della testata sono il nome di
     * chi installa. Vanno nella pagina, e non nel runtime, perche' il runtime
     * il browser lo tiene un anno e un installatore si puo' rinominare. */
    const nome = String(suo.nome || "");
    const velo = String(suo.velo || "") || nome;
    const testata = String(suo.titolo || "") || nome;
    if (!velo && !testata) return null;
    return { velo, testata };
  }

  /* Un file, dal percorso come lo chiede il browser.
   *
   * Torna `{stato, tipo, corpo}`, con `stato` 404 quando non c'e' — e non
   * c'e' anche quando l'impronta e' quella di una plancia vecchia: un
   * telefono che chiede file di due versioni diverse insieme finirebbe con
   * una pagina fatta a meta'.
   *
   * Con `quale` — la plancia che si sta servendo, quando chi chiede lo sa —
   * la pagina esce gia' con le sue vesti; senza, con quelle di serie, e ci
   * pensano le premesse. */
  /* L'indirizzo chiesto, tradotto in un file vero: `{relativo, tipo, dove}`,
   * oppure niente se non e' roba nostra.
   *
   * Sta per conto suo perche' a chiederselo sono in due — chi legge e chi
   * serve — e perche' tutti i modi di dire di no stanno qui dentro, in un
   * posto solo. */
  _dove(percorso) {
    const pezzi = String(percorso || "")
      .split("?")[0]
      .split("/");
    /* ["", "dashboardmodern_static", <impronta o cartella fissa>, …] */
    if (pezzi.length < 4 || pezzi[0] !== "" || `/${pezzi[1]}` !== BASE) return null;
    let relativi;
    if (FISSE.has(pezzi[2])) relativi = pezzi.slice(2);
    else if (pezzi[2] === this.impronta && CON_IMPRONTA.includes(pezzi[3]))
      relativi = pezzi.slice(3);
    else return null;
    if (relativi.length < 2 || !relativi.every((uno) => PEZZO_BUONO.test(uno) && uno !== ".."))
      return null;

    const tipo = TIPI[extname(relativi[relativi.length - 1]).toLowerCase()];
    if (!tipo) return null;

    const dove = resolve(this.cartella, ...relativi);
    if (!dove.startsWith(this.cartella + sep)) return null;
    return { relativo: relativi.join("/"), tipo, dove };
  }

  leggi(percorso, quale = null) {
    const suo = this._dove(percorso);
    if (!suo) return questoNo();
    const { relativo, tipo, dove } = suo;
    try {
      if (!statSync(dove).isFile()) return questoNo();
      /* E qui la plancia prende la faccia di gdahome: il logo, il velo
       * d'avvio, il titolo della pagina.
       *
       * Al momento di servire, e non nella cartella: li' dentro il nome
       * regge chiavi e percorsi, e cambiarlo vorrebbe dire rompere cose che
       * non si vedono subito. Vestirla qui vuol dire che la versione dopo, e
       * quella dell'anno prossimo, arrivano vestite senza che nessuno
       * rifaccia niente. Vedi `marchio.js`. */
      const vestito = vestiDiGdahome(
        relativo,
        readFileSync(dove),
        tipo,
        this.installatore?.(quale?.profilo || ""),
        /* E il numero di versione: la plancia ne dichiara uno suo, scritto
         * quando la si costruisce, che di gdahome non sa niente. Quello buono
         * e' in `ORIGINE.json`, ed e' lo stesso che il ponte mette nel
         * rapporto — un posto solo, e i due non possono divergere. */
        this.provenienza?.versione,
      );
      return { stato: 200, tipo: vestito.tipo, corpo: vestito.corpo };
    } catch (_errore) {
      return questoNo();
    }
  }

  /**
   * Quello che si manda davvero: il corpo gia' vestito, e stretto quando
   * conviene e chi chiede lo accetta.
   *
   * Torna la stessa cosa di `leggi` con una chiave in piu': `codifica` vale
   * `"gzip"` quando il corpo e' compresso, e non c'e' quando e' com'era. Chi
   * risponde deve mettere `content-encoding` **e** `vary: accept-encoding`,
   * o una cache in mezzo alla strada servira' il corpo stretto a chi non sa
   * aprirlo.
   *
   * Chi vuole il file com'e' sul disco continua a chiedere `leggi`: questa e'
   * la porta di chi serve, quella e' la porta di chi guarda.
   */
  daServire(percorso, { quale = null, accetta = "" } = {}) {
    const suo = this._dove(percorso);
    if (!suo) return questoNo();
    /* Un'immagine, un carattere, un file minuscolo: si serve come si e'
     * sempre fatto, senza passare di qui e senza occupare memoria. */
    if (!accettaStretto(accetta) || !DA_STRINGERE.test(suo.tipo)) {
      return this.leggi(percorso, quale);
    }

    const profilo = quale?.profilo || "";
    /* Un file che cambia con l'installatore si ricorda per installatore, e la
     * firma serve perche' l'installatore cambia mentre il ponte gira. */
    const chiave = dipendeDaChi(suo.relativo)
      ? `${suo.relativo}\u0000${firmaDelVestito(this.installatore?.(profilo))}`
      : suo.relativo;

    const gia = this._aMente.get(chiave);
    if (gia) return { stato: 200, tipo: gia.tipo, corpo: gia.corpo, codifica: "gzip" };

    const letto = this.leggi(percorso, quale);
    if (letto.stato !== 200 || letto.corpo.length < ALMENO) return letto;

    let stretto;
    try {
      stretto = gzipSync(letto.corpo, { level: QUANTO_STRETTO });
    } catch (_errore) {
      /* Stringere non e' mai obbligatorio: se va storto si manda com'era. */
      return letto;
    }
    /* E se stringerlo non ha tolto niente, si manda com'era lo stesso: un
     * corpo compresso piu' lungo dell'originale e' lavoro in piu' per tutti
     * e due. */
    if (stretto.length >= letto.corpo.length) return letto;

    if (this._quantoAMente + stretto.length <= IL_TETTO) {
      this._aMente.set(chiave, { tipo: letto.tipo, corpo: stretto });
      this._quantoAMente += stretto.length;
    }
    return { stato: 200, tipo: letto.tipo, corpo: stretto, codifica: "gzip" };
  }

  *_iFile(cartella, relativa) {
    let nomi;
    try {
      nomi = readdirSync(cartella).sort();
    } catch (_errore) {
      return;
    }
    for (const nome of nomi) {
      const intero = join(cartella, nome);
      const relativo = `${relativa}/${nome}`;
      const dati = statSync(intero);
      if (dati.isDirectory()) {
        yield* this._iFile(intero, relativo);
        continue;
      }
      if (dati.isFile() && TIPI[extname(nome).toLowerCase()]) yield relativo;
    }
  }
}

function questoNo() {
  return {
    stato: 404,
    tipo: "text/plain; charset=utf-8",
    corpo: Buffer.from("qui non c'e' niente"),
  };
}
