/* Il ponte si aggiorna da se'.
 *
 * Un add-on **locale** — quello che sta in `/addons/gdahome`, installato
 * copiandoci i file dentro — non ha nessun negozio dietro: Home Assistant
 * guarda il `config.yaml` che trova in quella cartella, e la versione che
 * legge li' e' l'unica che conosce. Su GitHub puo' esserci una versione
 * nuova per settimane: se nessuno porta quei file dentro `/addons/gdahome`,
 * in Home Assistant non compare mai nessun «Aggiorna». Non e' un difetto
 * del negozio, e' che il negozio non c'e'.
 *
 * Finora quei file li portava dentro un comando da battere nel terminale, con
 * un gettone di GitHub da incollare ogni volta. Chi non ha un computer — cioe'
 * la persona per cui questa app e' fatta — resta indietro di una versione a
 * ogni giro, e l'unica cosa che gli tocca fare e' la sola che non sa fare.
 *
 * Allora lo fa il ponte: guarda l'ultima **release** pubblicata, la scarica, la
 * mette dentro `/addons/gdahome` e chiede al Supervisor di ricostruirsi. E' un
 * bottone nella console — solo per chi amministra — e non serve altro: da
 * quando la repository e' pubblica, la release e il pacchetto li legge
 * chiunque senza presentarsi — e la casella
 * del gettone nella scheda dell'add-on non c'e' piu', perche' una casella che
 * tutti devono lasciare vuota prima o poi qualcuno la riempie. Chi si tiene una
 * copia privata di questo add-on il gettone glielo passa dall'ambiente,
 * `PONTE_GETTONE`.
 *
 * Le cose che rendono questo sicuro:
 *
 * 0. **Si porta dentro solo una release, e solo piu' nuova.** Non il ramo
 *    `main` — che e' il lavoro di tutti i giorni, a meta' — ma il tag
 *    dell'ultima release, `vX.Y.Z.W`. Una versione uguale o piu' vecchia di
 *    quella che gira non entra: tornare indietro non si fa da un bottone. Il
 *    manifesto dentro il pacchetto deve dire la stessa versione del tag. Se il
 *    pacchetto ha una firma e il ponte conosce la chiave di chi pubblica
 *    (`provenienza.js`), la firma deve tornare.
 * 1. **Si apre il pacchetto da se', e solo la cartella `ponte/`.** Ogni voce
 *    dell'archivio si guarda prima di scriverla: niente percorsi assoluti,
 *    niente `..`, niente collegamenti. Quello che non e' un file o una
 *    cartella non entra.
 * 2. **Non si tocca niente finche' non c'e' tutto.** Si scarica in un posto
 *    di passaggio, si controlla che dentro ci sia un ponte vero (il manifesto,
 *    il programma, la plancia), e solo dopo si scambia la cartella. Se la rete
 *    cade a meta', in `/addons/gdahome` c'e' ancora quello di prima.
 * 3. **Lo scambio lascia sempre un add-on valido.** Il Supervisor riconosce un
 *    add-on dalla presenza del `config.yaml`: la copia nuova si mette senza
 *    manifesto, si toglie la vecchia, si sposta la nuova al suo posto e il
 *    manifesto si rimette per ultimo. La finestra in cui in `/addons` non c'e'
 *    un ponte valido e' lunga due spostamenti dentro lo stesso disco.
 * 4. **Il programma che gira non e' quello sul disco.** L'add-on gira da
 *    un'immagine costruita a partire da quella cartella, quindi cambiarla non
 *    fa cadere niente: cade — e torna su nuovo — solo quando il Supervisor
 *    ricostruisce.
 */

import { existsSync, promises as fs } from "node:fs";
import { dirname, join, posix } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { gunzip } from "node:zlib";

import { CHIAVE_DI_CHI_PUBBLICA, firmaBuona, improntaDi } from "./provenienza.js";

const apriIlGzip = promisify(gunzip);

/* Dove si guarda, se non si dice altro. La repository dell'app: il ponte sta
 * dentro `ponte/`, e la versione e' quella del suo manifesto. */
const REPOSITORY = "danigio15/gdahomeapp";

/* Com'e' fatto il nome di una release: `v` e da due a quattro numeri. */
const TAG_BUONO = /^v(\d{1,6}(?:\.\d{1,6}){1,3})$/;

/* I due file che una release puo' portarsi dietro, oltre al pacchetto che
 * GitHub fa da se': il pacchetto fatto da chi pubblica — che non cambia di un
 * byte, e per questo si puo' firmare — e la sua firma. */
export const IL_PACCO = "gdahome.tar.gz";
export const LA_FIRMA = "gdahome.tar.gz.firma";

/* Quanto puo' pesare il pacchetto aperto. La repository intera sta sotto i
 * cento megabyte; oltre non e' un aggiornamento. */
const APERTO_AL_MASSIMO = 512 * 1024 * 1024;

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

/* ─── Il pacchetto, aperto a mano ─────────────────────────────────────────
 *
 * Prima lo apriva `tar`, che scrive dove gli dice l'archivio: un percorso
 * assoluto, un `..`, un collegamento che punta fuori — e un file finisce dove
 * non doveva. Il formato e' semplice (blocchi da 512 byte, un'intestazione e
 * il contenuto), e leggerlo qui vuol dire poter guardare ogni voce **prima**
 * di scriverla. */

const testoDi = (blocco, da, quanto) => {
  const pezzo = blocco.subarray(da, da + quanto);
  const fine = pezzo.indexOf(0);
  return pezzo.subarray(0, fine === -1 ? pezzo.length : fine).toString("utf8");
};

const numeroDi = (blocco, da, quanto) => {
  if (blocco[da] & 0x80) throw new Error("il pacchetto ha una voce troppo grande");
  const scritto = testoDi(blocco, da, quanto).trim();
  if (!scritto) return 0;
  if (!/^[0-7]+$/.test(scritto)) throw new Error("il pacchetto ha un'intestazione storta");
  return Number.parseInt(scritto, 8);
};

/* I campi `path` e `linkpath` di un'intestazione pax: `<lunghezza> chiave=valore\n`. */
function campiPax(corpo) {
  const campi = {};
  const testo = corpo.toString("utf8");
  let dove = 0;
  while (dove < testo.length) {
    const spazio = testo.indexOf(" ", dove);
    if (spazio === -1) break;
    const lungo = Number.parseInt(testo.slice(dove, spazio), 10);
    if (!Number.isFinite(lungo) || lungo <= 0) break;
    const riga = testo.slice(spazio + 1, dove + lungo - 1);
    const uguale = riga.indexOf("=");
    if (uguale > 0) campi[riga.slice(0, uguale)] = riga.slice(uguale + 1);
    dove += lungo;
  }
  return campi;
}

/**
 * Le voci di un archivio tar, lette senza scrivere niente.
 *
 * Torna `[{nome, tipo, collegamento, modo, corpo}]`. `tipo` e' la lettera del
 * formato: `0` un file, `5` una cartella, `1` e `2` i collegamenti.
 */
export function leVociDelPacco(tar) {
  const voci = [];
  let dove = 0;
  let pax = {};
  let lungo = null;
  while (dove + 512 <= tar.length) {
    const testa = tar.subarray(dove, dove + 512);
    if (testa.every((byte) => byte === 0)) break;
    /* La somma di controllo: un'intestazione che non torna e' un pacchetto
     * rovinato, e da un pacchetto rovinato non si scrive niente. */
    const detta = numeroDi(testa, 148, 8);
    let somma = 0;
    for (let i = 0; i < 512; i += 1) somma += i >= 148 && i < 156 ? 0x20 : testa[i];
    if (somma !== detta) throw new Error("il pacchetto e' rovinato");
    const quanto = numeroDi(testa, 124, 12);
    const tipo = String.fromCharCode(testa[156] || 0x30);
    const inizio = dove + 512;
    const corpo = tar.subarray(inizio, inizio + quanto);
    if (corpo.length !== quanto) throw new Error("il pacchetto e' tronco");
    dove = inizio + Math.ceil(quanto / 512) * 512;
    if (tipo === "x") {
      pax = campiPax(corpo);
      continue;
    }
    if (tipo === "g") continue;
    if (tipo === "L") {
      lungo = testoDi(corpo, 0, corpo.length);
      continue;
    }
    const ustar = testoDi(testa, 257, 6) === "ustar";
    const prefisso = ustar ? testoDi(testa, 345, 155) : "";
    const breve = testoDi(testa, 0, 100);
    const nome = pax.path ?? lungo ?? (prefisso ? `${prefisso}/${breve}` : breve);
    voci.push({
      nome,
      tipo: tipo === "\0" ? "0" : tipo,
      collegamento: pax.linkpath ?? testoDi(testa, 157, 100),
      modo: numeroDi(testa, 100, 8),
      corpo,
    });
    pax = {};
    lungo = null;
  }
  return voci;
}

/* Un nome dentro il pacchetto va bene se resta dentro: niente radice, niente
 * `..`, niente barre rovesciate o caratteri di controllo. */
function nomeBuono(nome) {
  if (typeof nome !== "string" || !nome || nome.length > 1024) return false;
  if (nome.startsWith("/") || nome.includes("\\") || /[\u0000-\u001f]/.test(nome)) return false;
  return !nome.split("/").some((pezzo) => pezzo === "..");
}

/**
 * Il pacchetto di una release, guardato da cima a fondo prima di aprirlo.
 *
 * Solleva se qualcosa non va; se va, torna la cartella di testa, le voci di
 * `ponte/` e la versione che dice il suo manifesto.
 *
 * @param {Buffer} tar l'archivio gia' scompresso
 */
export function guardaIlPacco(tar) {
  const voci = leVociDelPacco(tar);
  if (!voci.length) throw new Error("il pacchetto e' vuoto");
  const teste = new Set();
  for (const voce of voci) {
    if (!nomeBuono(voce.nome)) throw new Error(`il pacchetto ha un percorso storto: ${voce.nome}`);
    teste.add(voce.nome.split("/")[0]);
  }
  /* Un pacchetto di GitHub ha dentro una cartella sola, col nome del commit
   * attaccato. */
  if (teste.size !== 1) throw new Error("il pacchetto non ha la forma che dovrebbe avere");
  const [testa] = teste;
  const dentro = `${testa}/ponte/`;
  const delPonte = [];
  for (const voce of voci) {
    if (!voce.nome.startsWith(dentro) && voce.nome !== `${testa}/ponte`) continue;
    /* Dentro il ponte ci sono file e cartelle, e basta. Un collegamento —
     * simbolico o no — puo' puntare fuori dalla cartella, e dentro questo
     * add-on non ne serve nessuno. */
    if (voce.tipo !== "0" && voce.tipo !== "5" && voce.tipo !== "7") {
      throw new Error(`nel ponte c'e' qualcosa che non e' un file: ${voce.nome}`);
    }
    delPonte.push(voce);
  }
  const manifesto = delPonte.find((voce) => voce.nome === `${dentro}config.yaml`);
  if (!manifesto) throw new Error("nel pacchetto manca ponte/config.yaml");
  return {
    testa,
    voci: delPonte,
    versione: versioneNelManifesto(manifesto.corpo.toString("utf8")),
  };
}

/* Apre un pacchetto `.tar.gz` gia' scaricato, e ne scrive **solo** la
 * cartella del ponte dentro `dove`. */
async function apriIlPonte(archivio, dove) {
  const tar = await apriIlGzip(await fs.readFile(archivio), {
    maxOutputLength: APERTO_AL_MASSIMO,
  });
  const { voci } = guardaIlPacco(tar);
  const radice = posix.normalize(`${dove.replace(/\\/g, "/")}/`);
  for (const voce of voci) {
    const destinazione = posix.normalize(posix.join(radice, voce.nome));
    if (!destinazione.startsWith(radice)) throw new Error(`percorso storto: ${voce.nome}`);
    if (voce.tipo === "5") {
      await fs.mkdir(destinazione, { recursive: true });
      continue;
    }
    await fs.mkdir(dirname(destinazione), { recursive: true });
    /* I permessi di un file sono quelli che dice il pacchetto, ma senza i bit
     * speciali: un file del ponte si legge, e al massimo si esegue. */
    await fs.writeFile(destinazione, voce.corpo, { mode: (voce.modo & 0o755) | 0o600 });
  }
}

/* Gli attrezzi con cui si tocca il disco, tutti in un posto.
 *
 * Stanno raccolti qui — e non sparsi dentro i metodi — perche' e' la parte che
 * nelle prove non si puo' far girare davvero: una prova che scambia
 * `/addons/gdahome` sul computer di chi la lancia e' una prova che non si puo'
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
  /* Si apre qui, e non con `tar`: vedi `apriIlPonte`. */
  scompatta: (archivio, dentro) => apriIlPonte(archivio, dentro),
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
    gettone = "",
    /* La chiave pubblica di chi pubblica: se c'e', il pacchetto deve essere
     * firmato con la sua gemella. Vuota, la firma non si controlla — e la
     * console lo dice. */
    chiave = CHIAVE_DI_CHI_PUBBLICA,
    /* La cartella degli add-on locali, che il Supervisor monta qui quando il
     * manifesto chiede `addons:rw`. Fuori dal Supervisor non c'e', e allora
     * non si aggiorna niente: lo si dice, invece di provarci. */
    addon = process.env.PONTE_ADDONS || "/addons",
    nome = "gdahome",
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
    this.chiave = String(chiave || "");
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
    this._rilascio = null;
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

  /* L'ultima release pubblicata. Si chiede la sua scheda, non il pacchetto:
   * qualche riga di risposta invece di trentacinque megabyte. */
  async laNuova({ dariccapo = false } = {}) {
    if (!dariccapo && this._nuova && this.adesso() - this._chiestoIl < this.quantoDura) {
      return this._nuova;
    }
    if (typeof this.prendi !== "function") return "";
    const dove = `https://api.github.com/repos/${this.repository}/releases/latest`;
    try {
      const risposta = await this.prendi(dove, {
        headers: this._intestazioni("application/vnd.github+json"),
        signal: AbortSignal.timeout(ATTESA),
      });
      if (!risposta.ok) {
        /* Un «404» non si mostra a nessuno: e' un numero, e chi legge la
         * console si merita una riga.
         *
         * Vuol dire che non c'e' nessuna release pubblicata. Ma GitHub risponde
         * «non trovata» anche a chi chiede una repository privata senza
         * permessi — e' voluto, cosi' non scopre nemmeno che esiste — e chi si
         * tiene una copia sua, privata, di questo add-on finisce qui: la riga
         * gli dice che gli serve un gettone. */
        const male =
          risposta.status === 404
            ? "non trovo nessuna release pubblicata" +
              (this.gettone
                ? ""
                : " (se la repository e' una copia tua ed e' privata, serve un gettone)")
            : `GitHub ha risposto ${risposta.status}`;
        this._errore = male;
        this.registro.attenzione(`non riesco a sapere se c'e' una versione nuova: ${male}`);
        return this._nuova || "";
      }
      const scheda = await risposta.json();
      const tag = String(scheda?.tag_name || "");
      const versione = TAG_BUONO.exec(tag)?.[1] || "";
      if (!versione || scheda?.draft === true || scheda?.prerelease === true) {
        this._errore = "l'ultima release non ha un nome di versione che conosco";
        return this._nuova || "";
      }
      this._nuova = versione;
      this._rilascio = {
        tag,
        versione,
        allegati: Array.isArray(scheda?.assets) ? scheda.assets : [],
      };
      this._chiestoIl = this.adesso();
      this._errore = null;
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
      /* Se il pacchetto si controlla con una firma. `false` vuol dire che il
       * ponte non conosce la chiave di chi pubblica: si fida di GitHub e basta. */
      firma: Boolean(this.chiave),
      staPortando: this._staPortando,
      guaio: this._errore,
    };
  }

  /* Scarica la versione pubblicata e la mette dentro `/addons/gdahome`.
   *
   * Torna la versione portata dentro. Non ricostruisce niente: quella e' la
   * mossa dopo, e la fa chi ha chiamato quando ha finito di rispondere a chi
   * sta guardando la console — perche' la ricostruzione ammazza questo stesso
   * programma, e una risposta mai arrivata sembra un guasto.
   */
  async porta() {
    if (!this.locale()) {
      throw new Error(
        "questo ponte non e' un add-on locale: la cartella /addons/gdahome non c'e', e non c'e' niente da scambiare",
      );
    }
    if (this._staPortando) {
      throw new Error("sto gia' portando dentro la versione nuova");
    }
    this._staPortando = true;
    const attrezzi = this.attrezzi;
    const archivio = `${this.passaggio}.tar.gz`;
    try {
      /* Quale release, e se e' davvero piu' nuova di questa. Si richiede
       * adesso: una risposta di dieci minuti fa puo' essere quella di prima. */
      const nuova = await this.laNuova({ dariccapo: true });
      const rilascio = this._rilascio;
      if (!nuova || !rilascio || rilascio.versione !== nuova) {
        throw new Error("non so qual e' l'ultima versione pubblicata");
      }
      const confronto = confrontaLeVersioni(this.mia, nuova);
      if (confronto === null || confronto >= 0) {
        throw new Error(
          `la versione pubblicata (${nuova}) non e' piu' nuova di questa (${this.mia || "?"}): non si torna indietro`,
        );
      }

      await attrezzi.togli(this.passaggio);
      await attrezzi.togli(archivio);
      await attrezzi.cartella(this.passaggio);

      const byte = await this._ilPacco(rilascio);
      await this._laFirma(rilascio, byte);

      /* Tutto il pacchetto si guarda **prima** di scriverne un byte: i nomi,
       * i tipi, e che il manifesto dica la versione del tag. */
      let tar;
      try {
        tar = await apriIlGzip(byte, { maxOutputLength: APERTO_AL_MASSIMO });
      } catch (_errore) {
        throw new Error("il pacchetto non si apre");
      }
      const guardato = guardaIlPacco(tar);
      if (guardato.versione !== nuova) {
        throw new Error(
          `il pacchetto dice ${guardato.versione || "nessuna versione"}, la release ${nuova}: non lo metto dentro`,
        );
      }

      await attrezzi.scrivi(archivio, byte);
      await attrezzi.scompatta(archivio, this.passaggio);

      const dentro = (await attrezzi.elenca(this.passaggio)).filter(
        (uno) => !String(uno).startsWith("."),
      );
      if (dentro.length !== 1 || dentro[0] !== guardato.testa) {
        throw new Error("il pacchetto non ha la forma che dovrebbe avere");
      }
      const arrivato = join(this.passaggio, dentro[0], "ponte");
      for (const file of QUELLO_CHE_CI_VUOLE) {
        if (!attrezzi.esiste(join(arrivato, file))) {
          throw new Error(`nel pacchetto manca ${file}: non lo metto dentro`);
        }
      }
      const versione = versioneNelManifesto(await attrezzi.leggi(join(arrivato, "config.yaml")));
      if (versione !== nuova) {
        throw new Error("il ponte arrivato non dice la versione che doveva dire");
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

  /* L'allegato di una release con quel nome, se c'e' e se sta su GitHub. */
  _allegato(rilascio, nome) {
    const trovato = rilascio.allegati.find((uno) => uno?.name === nome);
    const dove = String(trovato?.browser_download_url || "");
    try {
      const url = new URL(dove);
      if (url.protocol !== "https:" || url.hostname !== "github.com") return "";
    } catch (_errore) {
      return "";
    }
    return dove;
  }

  async _scarica(dove, accetta, attesa) {
    const risposta = await this.prendi(dove, {
      headers: this._intestazioni(accetta),
      signal: AbortSignal.timeout(attesa),
    });
    if (!risposta.ok) {
      throw new Error(`GitHub non da' il pacchetto (${risposta.status})`);
    }
    return Buffer.from(await risposta.arrayBuffer());
  }

  /* Il pacchetto della release: quello che chi pubblica ci ha messo, se c'e',
   * se no quello che GitHub fa dal tag. Mai dal ramo. */
  async _ilPacco(rilascio) {
    const suo = this._allegato(rilascio, IL_PACCO);
    if (suo) return this._scarica(suo, "application/octet-stream", ATTESA_DEL_PACCHETTO);
    const dal = `https://api.github.com/repos/${this.repository}/tarball/${encodeURIComponent(rilascio.tag)}`;
    return this._scarica(dal, "application/vnd.github+json", ATTESA_DEL_PACCHETTO);
  }

  /* La firma, se il ponte conosce la chiave di chi pubblica.
   *
   * Con la chiave: la release deve portarsi dietro il suo pacchetto e la sua
   * firma, e la firma deve tornare sull'impronta di quei byte. Senza chiave
   * non c'e' niente con cui controllare, e si va avanti fidandosi di GitHub —
   * com'era prima — scrivendolo nel registro. */
  async _laFirma(rilascio, byte) {
    if (!this.chiave) {
      this.registro.attenzione(
        "l'aggiornamento non ha una firma da controllare: questo ponte non conosce la chiave di chi pubblica",
      );
      return;
    }
    const doveLaFirma = this._allegato(rilascio, LA_FIRMA);
    if (!doveLaFirma || !this._allegato(rilascio, IL_PACCO)) {
      throw new Error("la release non e' firmata: non la metto dentro");
    }
    const firma = (await this._scarica(doveLaFirma, "application/octet-stream", ATTESA))
      .toString("utf8")
      .trim();
    if (!firmaBuona(improntaDi(byte), firma, this.chiave)) {
      throw new Error("la firma del pacchetto non torna: non lo metto dentro");
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
        "il Supervisor non mi lascia ricostruire da qui: apri «gdahome» in Home Assistant e premi «Ricostruisci»",
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
