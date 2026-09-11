/* Il ponte si aggiorna da se'.
 *
 * Un add-on **locale** — quello che sta in `/addons/ponte`, installato
 * copiandoci i file dentro — non ha nessun negozio dietro: Home Assistant
 * guarda il `config.yaml` che trova in quella cartella, e la versione che
 * legge li' e' l'unica che conosce. Su GitHub puo' esserci una versione
 * nuova per settimane: se nessuno porta quei file dentro `/addons/ponte`,
 * in Home Assistant non compare mai nessun «Aggiorna». Non e' un difetto
 * del negozio, e' che il negozio non c'e'.
 *
 * Finora quei file li portava dentro un comando da battere nel terminale, con
 * un gettone di GitHub da incollare ogni volta. Chi non ha un computer — cioe'
 * la persona per cui questa app e' fatta — resta indietro di una versione a
 * ogni giro, e l'unica cosa che gli tocca fare e' la sola che non sa fare.
 *
 * Allora lo fa il ponte: guarda la versione pubblicata, la scarica, la mette
 * dentro `/addons/ponte` e chiede al Supervisor di ricostruirsi. Il gettone si
 * scrive **una volta** nella scheda dell'add-on, dove Home Assistant lo tiene
 * nascosto; da li' in poi e' un bottone nella console.
 *
 * Le tre cose che rendono questo sicuro:
 *
 * 1. **Non si tocca niente finche' non c'e' tutto.** Si scarica in un posto
 *    di passaggio, si controlla che dentro ci sia un ponte vero (il manifesto,
 *    il programma, la plancia), e solo dopo si scambia la cartella. Se la rete
 *    cade a meta', in `/addons/ponte` c'e' ancora quello di prima.
 * 2. **Lo scambio lascia sempre un add-on valido.** Il Supervisor riconosce un
 *    add-on dalla presenza del `config.yaml`: la copia nuova si mette senza
 *    manifesto, si toglie la vecchia, si sposta la nuova al suo posto e il
 *    manifesto si rimette per ultimo. La finestra in cui in `/addons` non c'e'
 *    un ponte valido e' lunga due spostamenti dentro lo stesso disco.
 * 3. **Il programma che gira non e' quello sul disco.** L'add-on gira da
 *    un'immagine costruita a partire da quella cartella, quindi cambiarla non
 *    fa cadere niente: cade — e torna su nuovo — solo quando il Supervisor
 *    ricostruisce.
 */

import { execFile } from "node:child_process";
import { existsSync, promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/* Dove si guarda, se non si dice altro. La repository dell'app: il ponte sta
 * dentro `ponte/`, e la versione e' quella del suo manifesto. */
const REPOSITORY = "danigio15/gdahomeapp";
const RAMO = "main";

/* Quanto si tiene in tasca la risposta di GitHub. La console la chiede a ogni
 * giro di pagina: senza questa, dieci secondi di console sarebbero una
 * richiesta a GitHub ogni dieci secondi, per una cosa che cambia una volta al
 * giorno. */
const QUANTO_DURA = 10 * 60 * 1000;

const ATTESA = 20000;
/* Scaricare trentacinque megabyte da un telefono sotto casa non e' immediato. */
const ATTESA_DEL_PACCHETTO = 5 * 60 * 1000;

/* I file che un ponte vero ha addosso. Se dentro il pacchetto non ci sono
 * tutti, quello che e' arrivato non e' un ponte e in `/addons` non ci va. */
const QUELLO_CHE_CI_VUOLE = Object.freeze([
  "config.yaml",
  "Dockerfile",
  "run.sh",
  "src/index.js",
  "plancia/ORIGINE.json",
]);

const eseguibile = (comando, argomenti) =>
  new Promise((bene, male) => {
    execFile(comando, argomenti, { maxBuffer: 1 << 24 }, (errore, _fuori, errori) => {
      if (errore) {
        male(new Error(`${comando} si e' lamentato: ${String(errori || errore.message).trim()}`));
        return;
      }
      bene();
    });
  });

/* Gli attrezzi con cui si tocca il disco, tutti in un posto.
 *
 * Stanno raccolti qui — e non sparsi dentro i metodi — perche' e' la parte che
 * nelle prove non si puo' far girare davvero: una prova che scambia
 * `/addons/ponte` sul computer di chi la lancia e' una prova che non si puo'
 * lanciare. Nelle prove ne arriva un'altra copia, che scrive su un foglio.
 */
export const ATTREZZI = Object.freeze({
  esiste: (dove) => existsSync(dove),
  leggi: (dove) => fs.readFile(dove, "utf8"),
  scrivi: (dove, dati) => fs.writeFile(dove, dati),
  cartella: (dove) => fs.mkdir(dove, { recursive: true }),
  togli: (dove) => fs.rm(dove, { recursive: true, force: true }),
  sposta: (da, a) => fs.rename(da, a),
  elenca: (dove) => fs.readdir(dove),
  copia: (da, a) => fs.cp(da, a, { recursive: true }),
  /* `tar` c'e' dentro l'immagine (busybox) e legge il gzip da se'. Scompattare
   * un tar in JavaScript senza dipendenze si potrebbe, ma sarebbe codice
   * nostro su un formato che non decidiamo noi — e questo add-on non ha
   * dipendenze proprio per non avere codice di nessun altro sotto i piedi. */
  scompatta: (archivio, dentro) => eseguibile("tar", ["-xzf", archivio, "-C", dentro]),
});

/* Da «0.15.0» a qualcosa che si possa confrontare.
 *
 * Non si confrontano come parole: «0.9.0» e' piu' piccolo di «0.10.0», ma
 * come testo viene dopo. Le parti che non sono numeri si buttano — una
 * versione con la lettera dentro non e' roba che si aggiorna da sola.
 */
export function pezziDellaVersione(versione) {
  return String(versione || "")
    .trim()
    .split(".")
    .map((pezzo) => Number.parseInt(pezzo, 10))
    .map((numero) => (Number.isFinite(numero) ? numero : 0));
}

/* `-1` se la prima e' piu' vecchia, `0` se sono la stessa, `1` se e' piu'
 * nuova. Una versione vuota non si confronta con niente: torna `null`, e chi
 * chiama non dice ne' «aggiornato» ne' «da aggiornare», perche' non lo sa. */
export function confrontaLeVersioni(una, altra) {
  if (!String(una || "").trim() || !String(altra || "").trim()) return null;
  const qui = pezziDellaVersione(una);
  const la = pezziDellaVersione(altra);
  const quante = Math.max(qui.length, la.length);
  for (let indice = 0; indice < quante; indice += 1) {
    const a = qui[indice] ?? 0;
    const b = la[indice] ?? 0;
    if (a !== b) return a < b ? -1 : 1;
  }
  return 0;
}

/* La versione scritta in un manifesto di add-on. */
export function versioneNelManifesto(manifesto) {
  return /^version:\s*"?([^"\n]+)"?/m.exec(String(manifesto || ""))?.[1]?.trim() || "";
}

export class Aggiornamento {
  constructor({
    mia = "",
    repository = process.env.PONTE_REPOSITORY || REPOSITORY,
    ramo = process.env.PONTE_RAMO || RAMO,
    gettone = "",
    /* La cartella degli add-on locali, che il Supervisor monta qui quando il
     * manifesto chiede `addons:rw`. Fuori dal Supervisor non c'e', e allora
     * non si aggiorna niente: lo si dice, invece di provarci. */
    addon = process.env.PONTE_ADDONS || "/addons",
    nome = "ponte",
    passaggio = process.env.PONTE_PASSAGGIO || join(tmpdir(), "ponte-nuovo"),
    supervisor = process.env.PONTE_SUPERVISOR || "http://supervisor",
    segno = process.env.SUPERVISOR_TOKEN || "",
    fetch: prendi = globalThis.fetch,
    attrezzi = ATTREZZI,
    registro,
    adesso = () => Date.now(),
    quantoDura = QUANTO_DURA,
  } = {}) {
    this.mia = String(mia || "");
    this.repository = String(repository);
    this.ramo = String(ramo);
    this.gettone = String(gettone || "");
    this.addon = String(addon);
    this.nome = String(nome);
    this.passaggio = String(passaggio);
    this.supervisor = String(supervisor).replace(/\/+$/, "");
    this.segno = String(segno);
    this.prendi = prendi;
    this.attrezzi = attrezzi;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this.quantoDura = quantoDura;

    this._nuova = null;
    this._chiestoIl = 0;
    this._errore = null;
    this._staPortando = false;
  }

  /* Dove sta la cartella dell'add-on, quella che Home Assistant guarda. */
  get dove() {
    return join(this.addon, this.nome);
  }

  /* Se questo ponte e' un add-on locale che si puo' aggiornare da qui.
   *
   * Chi l'ha installato da un archivio di add-on non ha bisogno di niente di
   * tutto questo — li' l'aggiornamento arriva dal negozio come per ogni altro
   * add-on — e chi lo fa girare da una copia della repository non ha nessuna
   * cartella da scambiare. In tutti e due i casi il bottone non si mostra
   * nemmeno: un bottone che non puo' funzionare e' peggio di nessun bottone.
   */
  locale() {
    return this.attrezzi.esiste(this.dove) && this.attrezzi.esiste(join(this.dove, "config.yaml"));
  }

  /* La versione pubblicata. Si chiede il solo manifesto, non il pacchetto:
   * sono due righe di risposta invece di trentacinque megabyte. */
  async laNuova({ dariccapo = false } = {}) {
    if (!dariccapo && this._nuova && this.adesso() - this._chiestoIl < this.quantoDura) {
      return this._nuova;
    }
    if (typeof this.prendi !== "function") return "";
    const dove =
      `https://api.github.com/repos/${this.repository}/contents/ponte/config.yaml` +
      `?ref=${encodeURIComponent(this.ramo)}`;
    try {
      const risposta = await this.prendi(dove, {
        headers: this._intestazioni("application/vnd.github.raw"),
        signal: AbortSignal.timeout(ATTESA),
      });
      if (!risposta.ok) {
        /* Su una repository privata senza gettone GitHub risponde «non
         * trovata», non «non autorizzato»: e' voluto, cosi' chi non ha i
         * permessi non scopre nemmeno che esiste. Da qui dentro pero'
         * sappiamo qual e' delle due, e chi legge la console si merita la
         * riga giusta invece di «404». */
        const male =
          risposta.status === 404 && !this.gettone
            ? "la repository non risponde senza gettone: scrivilo nella scheda dell'add-on"
            : `GitHub ha risposto ${risposta.status}`;
        this._errore = male;
        this.registro.attenzione(`non riesco a sapere se c'e' una versione nuova: ${male}`);
        return this._nuova || "";
      }
      const versione = versioneNelManifesto(await risposta.text());
      this._nuova = versione;
      this._chiestoIl = this.adesso();
      this._errore = versione ? null : "il manifesto pubblicato non dice nessuna versione";
      return versione;
    } catch (errore) {
      this._errore = String(errore?.message || errore);
      this.registro.attenzione(`non riesco a sapere se c'e' una versione nuova: ${this._errore}`);
      return this._nuova || "";
    }
  }

  /* Quello che la console mostra: le due versioni, e cosa si puo' fare. */
  async stato({ dariccapo = false } = {}) {
    const locale = this.locale();
    const nuova = locale ? await this.laNuova({ dariccapo }) : "";
    const confronto = confrontaLeVersioni(this.mia, nuova);
    return {
      mia: this.mia,
      nuova,
      /* `null` vuol dire «non lo so»: manca una delle due versioni, e
       * dirlo e' meglio che indovinare. */
      cE: confronto === null ? null : confronto < 0,
      locale,
      gettone: Boolean(this.gettone),
      staPortando: this._staPortando,
      guaio: this._errore,
    };
  }

  /* Scarica la versione pubblicata e la mette dentro `/addons/ponte`.
   *
   * Torna la versione portata dentro. Non ricostruisce niente: quella e' la
   * mossa dopo, e la fa chi ha chiamato quando ha finito di rispondere a chi
   * sta guardando la console — perche' la ricostruzione ammazza questo stesso
   * programma, e una risposta mai arrivata sembra un guasto.
   */
  async porta() {
    if (!this.locale()) {
      throw new Error(
        "questo ponte non e' un add-on locale: la cartella /addons/ponte non c'e', e non c'e' niente da scambiare",
      );
    }
    if (this._staPortando) {
      throw new Error("sto gia' portando dentro la versione nuova");
    }
    this._staPortando = true;
    const attrezzi = this.attrezzi;
    const archivio = `${this.passaggio}.tar.gz`;
    try {
      await attrezzi.togli(this.passaggio);
      await attrezzi.togli(archivio);
      await attrezzi.cartella(this.passaggio);

      const pacchetto =
        `https://api.github.com/repos/${this.repository}/tarball/` + encodeURIComponent(this.ramo);
      const risposta = await this.prendi(pacchetto, {
        headers: this._intestazioni("application/vnd.github+json"),
        signal: AbortSignal.timeout(ATTESA_DEL_PACCHETTO),
      });
      if (!risposta.ok) {
        throw new Error(`GitHub non da' il pacchetto (${risposta.status})`);
      }
      await attrezzi.scrivi(archivio, Buffer.from(await risposta.arrayBuffer()));
      await attrezzi.scompatta(archivio, this.passaggio);

      /* Un pacchetto di GitHub ha dentro una cartella sola, col nome del
       * commit attaccato: non lo si indovina, si guarda. */
      const dentro = (await attrezzi.elenca(this.passaggio)).filter(
        (uno) => !String(uno).startsWith("."),
      );
      if (dentro.length !== 1) {
        throw new Error("il pacchetto non ha la forma che dovrebbe avere");
      }
      const arrivato = join(this.passaggio, dentro[0], "ponte");
      for (const file of QUELLO_CHE_CI_VUOLE) {
        if (!attrezzi.esiste(join(arrivato, file))) {
          throw new Error(`nel pacchetto manca ${file}: non lo metto dentro`);
        }
      }
      const versione = versioneNelManifesto(await attrezzi.leggi(join(arrivato, "config.yaml")));
      if (!versione) {
        throw new Error("il ponte arrivato non dice che versione e'");
      }

      await this._scambia(arrivato);
      this.registro.info(`la versione ${versione} e' dentro /addons/${this.nome}`);
      this._nuova = versione;
      this._chiestoIl = this.adesso();
      this._errore = null;
      return versione;
    } finally {
      this._staPortando = false;
      await attrezzi.togli(archivio).catch(() => {});
      await attrezzi.togli(this.passaggio).catch(() => {});
    }
  }

  /* Lo scambio, quello che non deve lasciare macerie.
   *
   * Il manifesto si mette per ultimo: finche' non c'e', per il Supervisor
   * quella cartella non e' un add-on, e due add-on con lo stesso nome dentro
   * `/addons` sarebbero un guaio peggiore di un aggiornamento mancato.
   */
  async _scambia(arrivato) {
    const attrezzi = this.attrezzi;
    const acanto = `${this.dove}.nuova`;
    await attrezzi.togli(acanto);
    await attrezzi.copia(arrivato, acanto);
    /* Il manifesto si sposta di fianco: torna al suo posto a scambio fatto. */
    await attrezzi.sposta(join(acanto, "config.yaml"), join(acanto, "config.yaml.arrivato"));
    await attrezzi.togli(this.dove);
    await attrezzi.sposta(acanto, this.dove);
    await attrezzi.sposta(join(this.dove, "config.yaml.arrivato"), join(this.dove, "config.yaml"));
  }

  /* «Supervisor, rileggi la cartella e ricostruiscimi.»
   *
   * Da qui in poi questo programma e' morto e non lo sa: il Supervisor ferma
   * l'add-on, lo ricostruisce dalla cartella nuova e lo riaccende. Chi ha
   * chiamato deve aver gia' risposto.
   *
   * Se il Supervisor dice no — il permesso che manca, una versione che quella
   * via non ce l'ha — non e' la fine: i file nuovi sono dentro, e in Home
   * Assistant il tasto «Ricostruisci» sulla pagina dell'add-on fa la stessa
   * cosa. Lo diciamo, invece di lasciare credere che sia andato tutto bene.
   */
  async rifalla() {
    if (!this.segno || typeof this.prendi !== "function") {
      return { chiesto: false, perche: "senza il segno del Supervisor non posso chiedere niente" };
    }
    /* Prima rileggere il negozio, se no il Supervisor ricostruisce da quello
     * che credeva ci fosse. Le due vie sono la nuova e quella di prima: le
     * versioni vecchie del Supervisor conoscono solo la seconda. */
    for (const via of ["/store/reload", "/addons/reload"]) {
      if (await this._bussa(via)) break;
    }
    if (await this._bussa("/addons/self/rebuild")) {
      return { chiesto: true };
    }
    return {
      chiesto: false,
      perche:
        "il Supervisor non mi lascia ricostruire da qui: apri «Il ponte» in Home Assistant e premi «Ricostruisci»",
    };
  }

  async _bussa(via) {
    try {
      const risposta = await this.prendi(`${this.supervisor}${via}`, {
        method: "POST",
        headers: { authorization: `Bearer ${this.segno}` },
        signal: AbortSignal.timeout(ATTESA),
      });
      if (!risposta.ok) {
        this.registro.attenzione(`il Supervisor ha risposto ${risposta.status} su ${via}`);
        return false;
      }
      return true;
    } catch (errore) {
      /* La ricostruzione ci porta via la rete sotto i piedi: una chiamata
       * interrotta a `rebuild` vuol dire che sta succedendo, non che e'
       * andata male. */
      this.registro.info(`${via}: ${errore?.message || errore}`);
      return via.endsWith("/rebuild");
    }
  }

  _intestazioni(accetta) {
    const intestazioni = {
      accept: accetta,
      "user-agent": "ponte-di-dashboardmodern",
      "x-github-api-version": "2022-11-28",
    };
    if (this.gettone) intestazioni.authorization = `Bearer ${this.gettone}`;
    return intestazioni;
  }
}
