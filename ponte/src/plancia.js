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

import { NOME, vestiDiGdahome } from "./marchio.js";
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
  leggi(percorso, quale = null) {
    const pezzi = String(percorso || "")
      .split("?")[0]
      .split("/");
    /* ["", "dashboardmodern_static", <impronta o cartella fissa>, …] */
    if (pezzi.length < 4 || pezzi[0] !== "" || `/${pezzi[1]}` !== BASE) return questoNo();
    let relativi;
    if (FISSE.has(pezzi[2])) relativi = pezzi.slice(2);
    else if (pezzi[2] === this.impronta && CON_IMPRONTA.includes(pezzi[3]))
      relativi = pezzi.slice(3);
    else return questoNo();
    if (relativi.length < 2 || !relativi.every((uno) => PEZZO_BUONO.test(uno) && uno !== ".."))
      return questoNo();

    const tipo = TIPI[extname(relativi[relativi.length - 1]).toLowerCase()];
    if (!tipo) return questoNo();

    const dove = resolve(this.cartella, ...relativi);
    if (!dove.startsWith(this.cartella + sep)) return questoNo();
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
        relativi.join("/"),
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
