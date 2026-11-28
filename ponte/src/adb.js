/* ADB: parlare coi pannelli a muro sulla rete di casa.
 *
 * I Sonoff NSPanel Pro, e gli altri pannelli Android, si comandano via ADB
 * sulla porta 5555. L'add-on ci arriva dalla rete di casa (`da-casa.js` dice
 * qual e'), senza che l'utente tocchi un computer: trova i pannelli, li
 * guarda, ci copia GdAHome OS, lo installa.
 *
 * Qui c'e' solo il «come si parla»: un comando `adb` avviato con un tempo
 * massimo, l'output raccolto, l'errore riconosciuto. Il «cosa si fa» —
 * verifica, copia di sicurezza, installazione — sta in `pannelli.js`, che
 * usa questi mattoni.
 *
 * `adb` e' nell'immagine dell'add-on (`android-tools`, vedi Dockerfile). La
 * sua chiave — quella con cui il pannello lo riconosce — vive in `/data/adb`,
 * cosi' un pannello sbloccato una volta resta sbloccato per questo add-on
 * anche dopo un riavvio del contenitore. Senza `adb` (sul banco, o un add-on
 * vecchio) ogni comando torna un errore chiaro, e `pannelli.js` lo dice nella
 * console invece di non partire.
 *
 * Il programma si inietta (`avvia = spawn`): le prove non chiamano un vero
 * `adb`, gli danno un finto che risponde quello che serve a provare.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { createServer } from "node:net";
import { createGunzip, createGzip } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* Dove tenere la chiave di ADB, cosi' non ne nasce una nuova a ogni comando
 * (e il pannello non richiede di nuovo il permesso sullo schermo). */
export const CARTELLA_DELLA_CHIAVE = "/data/adb";

/* La porta del server di adb dell'add-on: non la 5037 di serie, che con
 * `host_network` e' quella di tutta la macchina (vedi `_ambiente`). */
export const PORTA_DEL_SERVER = 5137;

/* Il file dove va una copia: com'e', o compresso al volo (gzip) se
 * `comprimi`. Si usa come uno stream scrivibile qualunque; `end(fatto)`
 * chiama `fatto` quando il file su disco e' chiuso. L'impronta la fa chi
 * scrive, sui dati com'erano: la compressione non la cambia. */
export function apriIlFile(dove, comprimi) {
  const file = createWriteStream(dove);
  if (!comprimi) return file;
  const gz = createGzip({ level: 6 });
  gz.pipe(file);
  file.on("error", (e) => gz.emit("error", e));
  const chiudi = gz.end.bind(gz);
  gz.end = (fatto) => {
    file.once("finish", () => fatto?.());
    chiudi();
    return gz;
  };
  /* Node chiude da se' lo stream compresso quando ha finito: in quel momento
   * il file su disco sta ancora scrivendo gli ultimi byte, e non va toccato.
   * Lo si chiude solo per un errore, o se si interrompe prima della fine. */
  const distruggi = gz.destroy.bind(gz);
  gz.destroy = (e) => {
    if (e || !gz.writableEnded) file.destroy();
    return distruggi(e);
  };
  return gz;
}

/* L'ultima riga d'errore del registro del server di adb (/tmp/adb.<uid>.log),
 * o "": e' li' che adb scrive perche' non e' partito. */
export function rigaDelRegistroDelServer(cartella = tmpdir()) {
  try {
    const registri = readdirSync(cartella).filter((f) => /^adb\..*\.log$/.test(f));
    for (const nome of registri) {
      const righe = readFileSync(join(cartella, nome), "utf8").trim().split("\n");
      const male = righe.reverse().find((r) => / [FE] adb\s*:/.test(r));
      if (male) return male.replace(/^.*? [FE] adb\s*:\s*\S+\s*/, "").trim();
    }
  } catch (_e) {
    /* Nessun registro. */
  }
  return "";
}

/* Il tempo massimo di un comando, secondo cosa fa. Una shell risponde
 * subito; una copia di sicurezza di due giga no. */
export const ATTESE = Object.freeze({
  svelto: 15_000,
  shell: 60_000,
  push: 10 * 60_000,
  pull: 30 * 60_000,
  install: 5 * 60_000,
});

/* Gli errori che si riconoscono a parole, per dirli bene nella console invece
 * del verbale di `adb`. */
function perche(uscita) {
  const t = String(uscita || "").toLowerCase();
  /* Il server di adb non parte (per esempio non riesce a creare la cartella
   * della sua chiave): ogni comando fallisce cosi', su qualunque indirizzo.
   * Va prima di «cannot connect», che e' anche dentro «cannot connect to
   * daemon» e lo farebbe sembrare un pannello che non risponde. */
  if (
    t.includes("cannot connect to daemon") ||
    t.includes("failed to start daemon") ||
    t.includes("server didn't ack") ||
    t.includes("cannot mkdir")
  )
    return "demone";
  /* Il pannello ha risposto e chiede il permesso: sullo schermo c'e'
   * «Consentire il debug USB?». */
  if (
    t.includes("device unauthorized") ||
    t.includes("device still authorizing") ||
    t.includes("failed to authenticate")
  )
    return "non_autorizzato";
  if (
    t.includes("failed to connect") ||
    t.includes("cannot connect") ||
    t.includes("connection refused")
  )
    return "non_raggiungibile";
  if (t.includes("device offline")) return "offline";
  if (t.includes("no such file") || t.includes("not found")) return "manca";
  if (t.includes("not enough space") || t.includes("no space left")) return "spazio";
  if (t.includes("read-only")) return "sola_lettura";
  return "";
}

export class ErroreAdb extends Error {
  constructor(messaggio, { causa = "", uscita = "" } = {}) {
    super(messaggio);
    this.name = "ErroreAdb";
    this.causa = causa || perche(uscita) || perche(messaggio);
    this.uscita = uscita;
  }
}

export class Adb {
  /* `programma`: il nome dell'eseguibile (`adb`), o un percorso. `avvia`: chi
   * lo lancia, `spawn` vero o un finto nelle prove. `chiave`: dove tenere la
   * chiave di ADB (si puo' spegnere con `null`, per le prove). */
  constructor({
    programma = "adb",
    avvia = spawn,
    chiave = CARTELLA_DELLA_CHIAVE,
    registro = null,
    fermoDellaCopia = 90_000,
    portaDelServer = PORTA_DEL_SERVER,
  } = {}) {
    this.programma = programma;
    this.avvia = avvia;
    this.chiave = chiave;
    this.registro = registro;
    /* Dopo quanto silenzio una copia e' «ferma». */
    this.fermoDellaCopia = fermoDellaCopia;
    this.portaDelServer = portaDelServer;
  }

  /* Avvia `adb <argomenti>` e torna { codice, fuori } quando finisce, o lancia
   * ErroreAdb se il programma non c'e' o ci mette troppo. `dentro` e' quello
   * che gli si scrive sullo stdin (per `exec-out`, o un file corto). */
  /* La cartella della chiave deve esistere prima che adb parta: se manca, il
   * server di adb si ferma su «Cannot mkdir …/.android» e non parte, e ogni
   * comando — su qualunque pannello — fallisce. E' successo: la ricerca non
   * trovava niente e un pannello con la 5555 aperta «non rispondeva». */
  _preparaLaChiave() {
    if (!this.chiave || this._chiavePronta) return;
    try {
      mkdirSync(join(this.chiave, ".android"), { recursive: true });
      this._chiavePronta = true;
    } catch (_e) {
      /* Se non si puo' creare, adb lo dira' da se' («demone»), e la console
       * lo mostra invece di un «non risponde». */
    }
  }

  /* L'ambiente di ogni adb: la chiave nella sua cartella, e il server su una
   * porta **sua**. Con `host_network` la porta di serie (5037) e' quella della
   * macchina: un altro adb di casa (l'add-on «Android Debug Bridge», per
   * esempio) la occupa, e il nostro server non parte piu' («ADB server didn't
   * ACK»). Su una porta propria non si incontrano. */
  _ambiente() {
    const ambiente = { ...process.env };
    if (this.chiave) ambiente.HOME = this.chiave;
    if (this.portaDelServer) ambiente.ANDROID_ADB_SERVER_PORT = String(this.portaDelServer);
    return ambiente;
  }

  grezzo(argomenti, { attesa = ATTESE.svelto, dentro = null, binario = false } = {}) {
    this._preparaLaChiave();
    return new Promise((risolvi, rifiuta) => {
      let proc;
      const ambiente = this._ambiente();
      try {
        proc = this.avvia(this.programma, argomenti, {
          stdio: ["pipe", "pipe", "pipe"],
          env: ambiente,
        });
      } catch (errore) {
        rifiuta(new ErroreAdb(`adb non si avvia: ${errore.message}`, { causa: "niente_adb" }));
        return;
      }
      let finito = false;
      const pezzi = [];
      const errori = [];
      const scade = setTimeout(() => {
        if (finito) return;
        finito = true;
        try {
          proc.kill?.("SIGKILL");
        } catch (_e) {
          /* Gia' morto. */
        }
        rifiuta(new ErroreAdb(`adb ${argomenti[0] || ""} ci ha messo troppo`, { causa: "tempo" }));
      }, attesa);

      proc.on("error", (errore) => {
        if (finito) return;
        finito = true;
        clearTimeout(scade);
        rifiuta(
          new ErroreAdb(
            errore.code === "ENOENT"
              ? "adb non e' installato in questo add-on"
              : `adb: ${errore.message}`,
            { causa: errore.code === "ENOENT" ? "niente_adb" : "" },
          ),
        );
      });
      proc.stdout?.on?.("data", (p) => pezzi.push(p));
      proc.stderr?.on?.("data", (p) => errori.push(p));
      proc.on("close", (codice) => {
        if (finito) return;
        finito = true;
        clearTimeout(scade);
        const fuoriBin = Buffer.concat(pezzi);
        const err = Buffer.concat(errori).toString("utf8");
        risolvi({
          codice: codice ?? 0,
          fuori: binario ? fuoriBin : fuoriBin.toString("utf8"),
          errore: err,
        });
      });
      if (dentro != null) {
        proc.stdin?.on?.("error", () => {});
        proc.stdin?.end?.(dentro);
      } else {
        proc.stdin?.end?.();
      }
    });
  }

  /* Come `grezzo`, ma lancia ErroreAdb se `adb` esce con codice diverso da
   * zero o scrive un errore riconoscibile. Torna la stringa di stdout. */
  async comando(argomenti, opzioni = {}) {
    const { codice, fuori, errore } = await this.grezzo(argomenti, opzioni);
    const unito = `${fuori}\n${errore}`;
    const causa = perche(unito);
    /* `adb` a volte esce 0 e scrive l'errore su stdout (i vecchi server). */
    if (codice !== 0 || causa) {
      throw new ErroreAdb((errore || fuori || "adb ha risposto male").trim().split("\n")[0], {
        causa,
        uscita: unito,
      });
    }
    return opzioni.binario ? fuori : String(fuori).trim();
  }

  _dev(indirizzo) {
    return indirizzo.includes(":") ? indirizzo : `${indirizzo}:5555`;
  }

  /* Si collega al pannello. Torna true se risponde, false se rifiuta o non
   * c'e'; lancia solo se `adb` stesso manca. */
  async connetti(indirizzo) {
    return (await this.provaCollegamento(indirizzo)).ok;
  }

  /* Come `connetti`, ma dice **perche'** non e' andata, cosi' la console puo'
   * spiegarlo:
   *  - "rifiutato": il pannello risponde ma chiude la 5555 — l'ADB di rete non
   *    e' attivo (succede anche con la modalita' sviluppatore accesa: su certi
   *    firmware l'ADB di rete si accende una volta con un cavo USB);
   *  - "irraggiungibile": nessuna risposta — indirizzo sbagliato, pannello
   *    spento, o l'add-on non arriva a quella rete;
   *  - "" quando e' andata. Lancia solo se `adb` stesso manca. */
  async provaCollegamento(indirizzo) {
    const dev = this._dev(indirizzo);
    try {
      const detto = await this.comando(["connect", dev], { attesa: ATTESE.svelto });
      if (/connected to|already connected/i.test(detto)) {
        /* Collegato non vuol dire autorizzato: al primo incontro il pannello
         * mostra «Consentire il debug USB?» e finche' non si tocca Consenti
         * resta «unauthorized» (o «offline» mentre ci pensa). */
        const stato = await this._statoDopoIlCollegamento(dev);
        if (stato === "unauthorized" || stato === "offline")
          return { ok: false, causa: "non_autorizzato" };
        return { ok: true, causa: "" };
      }
      const causa = perche(detto);
      if (causa === "demone") throw new ErroreAdb(detto, { causa });
      if (causa === "non_autorizzato") return { ok: false, causa };
      if (/refus/i.test(detto)) return { ok: false, causa: "rifiutato" };
      return { ok: false, causa: await this._apertaMaMuta(dev) };
    } catch (errore) {
      /* adb che manca, o il suo server che non parte: non e' il pannello, e
       * non si fa finta che lo sia. Lo dice chi chiama. */
      if (errore.causa === "niente_adb" || errore.causa === "demone") throw errore;
      if (errore.causa === "non_autorizzato") return { ok: false, causa: "non_autorizzato" };
      /* "connection refused" = la 5555 e' chiusa: ADB di rete spento. */
      if (/refus/i.test(errore.uscita || errore.message || ""))
        return { ok: false, causa: "rifiutato" };
      return { ok: false, causa: await this._apertaMaMuta(dev) };
    }
  }

  /* Un collegamento non riuscito che non e' un «rifiutato»: o non si arriva
   * all'indirizzo, o la porta c'e' ma il pannello non ha ancora risposto come
   * si deve. adb scrive in tutti e due i casi «failed to connect to …», e la
   * differenza la dice il suo elenco: una porta aperta resta registrata
   * («offline» o «unauthorized»), un indirizzo che non risponde no. E' il caso
   * di un pannello con l'ADB di rete acceso che aspetta il «Consenti». */
  async _apertaMaMuta(dev) {
    const stato = await this.stato(dev);
    return stato === "offline" || stato === "unauthorized" ? "non_autorizzato" : "irraggiungibile";
  }

  /* Lo stato del pannello subito dopo il collegamento: "device",
   * "unauthorized", "offline", o quello che adb risponde. Un «offline» si
   * riguarda per qualche istante: e' il pannello che sta ancora decidendo. */
  async _statoDopoIlCollegamento(dev, { volte = 6, pausa = 500 } = {}) {
    let stato = "";
    for (let i = 0; i < volte; i += 1) {
      stato = await this.stato(dev);
      if (stato !== "offline") return stato;
      await new Promise((fatto) => setTimeout(fatto, pausa));
    }
    return stato;
  }

  /* `adb get-state`: "device" se si puo' lavorare, "unauthorized" se il
   * pannello aspetta il permesso, "offline", o "" se non si sa. */
  async stato(indirizzo) {
    try {
      const detto = await this.comando(["-s", this._dev(indirizzo), "get-state"], {
        attesa: ATTESE.svelto,
      });
      return String(detto).trim().split("\n").pop().trim();
    } catch (errore) {
      if (errore.causa === "non_autorizzato") return "unauthorized";
      if (errore.causa === "offline") return "offline";
      return "";
    }
  }

  /* Fa partire il server di adb una volta sola, prima di una ricerca: cosi'
   * i collegamenti in parallelo non si contendono l'avvio, e se il server non
   * parte lo si sa subito, con la sua ragione, invece di 254 «non risponde». */
  async avviaServer() {
    try {
      await this.comando(["start-server"], { attesa: ATTESE.svelto });
    } catch (prima) {
      if (prima.causa === "niente_adb") throw prima;
      /* Un server rimasto a meta': lo si ferma e si riparte, una volta. */
      await this.comando(["kill-server"], { attesa: ATTESE.svelto }).catch(() => {});
      try {
        await this.comando(["start-server"], { attesa: ATTESE.svelto });
      } catch (errore) {
        /* Il perche' vero sta nel registro del server: la riga d'errore va
         * con l'errore, cosi' la console la mostra. */
        const riga = rigaDelRegistroDelServer();
        if (riga) errore.uscita = `${errore.uscita || ""}\n${riga}`;
        if (!errore.causa) errore.causa = "demone";
        throw errore;
      }
    }
  }

  async stacca(indirizzo) {
    try {
      await this.comando(["disconnect", this._dev(indirizzo)]);
    } catch (_e) {
      /* Gia' staccato. */
    }
  }

  /* Una shell sul pannello. `root`: con `su -c` (il pannello e' sbloccato). */
  shell(indirizzo, comando, { root = false, attesa = ATTESE.shell, binario = false } = {}) {
    const dev = this._dev(indirizzo);
    const riga = root ? `su -c ${scappa(comando)}` : comando;
    return this.comando(["-s", dev, "exec-out", riga], { attesa, binario });
  }

  /* L'uscita binaria di un comando root, tutta in memoria: solo per cose
   * piccole. Una partizione si copia con `copiaInFile`. */
  shellBinaria(indirizzo, comando, opzioni = {}) {
    return this.shell(indirizzo, comando, { ...opzioni, binario: true, root: true });
  }

  /* Lancia un comando root sul pannello e ne scrive l'uscita in un file **man
   * mano che arriva**, senza tenerla in memoria: una partizione di sistema e'
   * un giga o due. Torna { byte, md5 } calcolati su quello che e' arrivato.
   * Prima `shellBinaria` raccoglieva tutto in memoria con un minuto di tempo:
   * con una partizione vera l'add-on sarebbe finito senza memoria o a meta'. */
  copiaInFile(
    indirizzo,
    comando,
    dove,
    {
      attesa = ATTESE.pull,
      limite = 0,
      fermo = this.fermoDellaCopia,
      avanzamento = null,
      comprimi = false,
    } = {},
  ) {
    this._preparaLaChiave();
    return new Promise((risolvi, rifiuta) => {
      const ambiente = this._ambiente();
      let proc;
      try {
        proc = this.avvia(
          this.programma,
          ["-s", this._dev(indirizzo), "exec-out", `su -c ${scappa(comando)}`],
          { stdio: ["ignore", "pipe", "pipe"], env: ambiente },
        );
      } catch (errore) {
        rifiuta(new ErroreAdb(`adb non si avvia: ${errore.message}`, { causa: "niente_adb" }));
        return;
      }
      const file = apriIlFile(dove, comprimi);
      const impronta = createHash("md5");
      let byte = 0;
      let finito = false;
      const errori = [];
      const fine = (errore, esito) => {
        if (finito) return;
        finito = true;
        clearTimeout(scade);
        clearInterval(guardia);
        if (errore) {
          try {
            proc.kill?.("SIGKILL");
          } catch (_e) {
            /* Gia' morto. */
          }
          file.destroy();
          rifiuta(errore);
        } else risolvi(esito);
      };
      const scade = setTimeout(
        () => fine(new ErroreAdb("la copia ci ha messo troppo", { causa: "tempo" })),
        attesa,
      );
      /* Il guardiano: se non arriva niente per `fermo` ms, la copia e' ferma e
       * la si chiude subito — chi chiama riprova, o passa al piano B — invece
       * di aspettare la mezz'ora del tempo massimo. */
      let ultimoDato = Date.now();
      const guardia = setInterval(
        () => {
          if (Date.now() - ultimoDato > fermo)
            fine(
              new ErroreAdb(`nessun dato da ${Math.round(fermo / 1000)} secondi`, {
                causa: "fermo",
              }),
            );
        },
        Math.min(5_000, Math.max(50, fermo / 3)),
      );
      let detto = 0;
      proc.on("error", (errore) => fine(new ErroreAdb(`adb: ${errore.message}`)));
      proc.stderr?.on?.("data", (p) => errori.push(p));
      /* `limite`: si scrivono solo i primi `limite` byte, e su quelli si fa
       * l'impronta; quello che arriva dopo (la coda di riempimento) si conta e
       * basta. Su certi pannelli `exec-out` perde la fine dell'uscita quando
       * il comando finisce: la coda e' li' per farsi perdere al posto dei dati. */
      let scritti = 0;
      proc.stdout.on("data", (tutto) => {
        byte += tutto.length;
        ultimoDato = Date.now();
        /* Quanto e' arrivato, ogni mezzo secondo al massimo. */
        if (avanzamento && Date.now() - detto > 500) {
          detto = Date.now();
          avanzamento(Math.min(byte, limite || byte));
        }
        let pezzo = tutto;
        if (limite) {
          const resta = limite - scritti;
          if (resta <= 0) return;
          if (pezzo.length > resta) pezzo = pezzo.subarray(0, resta);
        }
        scritti += pezzo.length;
        impronta.update(pezzo);
        /* Se il disco non tiene il passo, si aspetta: niente in memoria. */
        if (!file.write(pezzo)) {
          proc.stdout.pause();
          file.once("drain", () => proc.stdout.resume());
        }
      });
      file.on("error", (errore) =>
        fine(
          new ErroreAdb(`non riesco a scrivere ${dove}: ${errore.message}`, { causa: "spazio" }),
        ),
      );
      proc.on("close", (codice) => {
        const testo = Buffer.concat(errori).toString("utf8");
        if (codice !== 0)
          return fine(
            new ErroreAdb(testo.trim().split("\n")[0] || `adb e' uscito con ${codice}`, {
              uscita: testo,
            }),
          );
        file.end(() => fine(null, { byte: scritti, ricevuti: byte, md5: impronta.digest("hex") }));
      });
    });
  }

  /* La copia diretta: i dati non passano da adb ma da una connessione di
   * rete normale fra il pannello e l'add-on. adb di Android 8 manda un
   * pacchetto e aspetta la conferma prima del successivo: su un Wi-Fi lento a
   * rispondere (l'86 rispondeva in 2 secondi) la copia andava a 0,3 MB/s. Una
   * connessione TCP tiene in volo molti pacchetti insieme e va alla velocita'
   * del Wi-Fi. adb serve solo a dare il comando.
   *
   * L'add-on apre una porta su `verso` (il suo indirizzo di casa), il pannello
   * ci manda l'uscita del comando con `nc`. Come `copiaInFile`: si tengono i
   * primi `limite` byte, con impronta, avanzamento e guardiano. Se il pannello
   * non si collega entro `attesaDelCollegamento`, causa «diretta»: chi chiama
   * torna ad adb. Torna { byte, ricevuti, md5 }. */
  copiaDiretta(
    indirizzo,
    comando,
    dove,
    {
      verso,
      nc = "nc",
      limite = 0,
      avanzamento = null,
      fermo = this.fermoDellaCopia,
      attesa = ATTESE.pull,
      attesaDelCollegamento = 20_000,
      comprimi = false,
      compressoDalPannello = false,
    } = {},
  ) {
    return new Promise((risolvi, rifiuta) => {
      const server = createServer();
      let proc = null;
      let presa = null;
      let file = null;
      let finito = false;
      let byte = 0;
      let scritti = 0;
      let detto = 0;
      let ultimoDato = Date.now();
      const impronta = createHash("md5");
      const fine = (errore, esito) => {
        if (finito) return;
        finito = true;
        clearTimeout(scade);
        clearTimeout(nessuno);
        clearInterval(guardia);
        try {
          presa?.destroy();
          server.close();
          proc?.kill?.("SIGKILL");
        } catch (_e) {
          /* Gia' chiuso. */
        }
        if (errore) {
          file?.destroy();
          rifiuta(errore);
        } else if (file) file.end(() => risolvi(esito));
        else risolvi(esito);
      };
      const scade = setTimeout(
        () => fine(new ErroreAdb("la copia ci ha messo troppo", { causa: "tempo" })),
        attesa,
      );
      const nessuno = setTimeout(
        () =>
          fine(
            new ErroreAdb("il pannello non si e' collegato per la copia diretta", {
              causa: "diretta",
            }),
          ),
        attesaDelCollegamento,
      );
      const guardia = setInterval(
        () => {
          if (presa && Date.now() - ultimoDato > fermo)
            fine(
              new ErroreAdb(`nessun dato da ${Math.round(fermo / 1000)} secondi`, {
                causa: "fermo",
              }),
            );
        },
        Math.min(5_000, Math.max(50, fermo / 3)),
      );
      server.on("error", (e) =>
        fine(new ErroreAdb(`copia diretta: ${e.message}`, { causa: "diretta" })),
      );
      server.on("connection", (s) => {
        if (presa) return s.destroy();
        presa = s;
        clearTimeout(nessuno);
        ultimoDato = Date.now();
        /* Il pannello comprime prima di spedire (`dd | gzip -1 | nc`): sul
         * filo passano molti meno byte — le partizioni sono per lo piu' vuote
         * — e su un Wi-Fi lento e' tutta la differenza. Il file su Home
         * Assistant e' quello che arriva, gia' .gz; byte e impronta si contano
         * scompattandolo al volo, cosi' la garanzia resta quella di sempre:
         * l'immagine com'era sul pannello. */
        if (compressoDalPannello) {
          file = createWriteStream(dove);
          file.on("error", (e) =>
            fine(new ErroreAdb(`non riesco a scrivere ${dove}: ${e.message}`, { causa: "spazio" })),
          );
          const scompatta = createGunzip();
          scompatta.on("data", (pezzo) => {
            let buono = pezzo;
            if (limite) {
              const resta = limite - scritti;
              if (resta <= 0) return;
              if (buono.length > resta) buono = buono.subarray(0, resta);
            }
            scritti += buono.length;
            impronta.update(buono);
            if (avanzamento && Date.now() - detto > 500) {
              detto = Date.now();
              avanzamento(scritti);
            }
          });
          scompatta.on("end", () =>
            fine(null, { byte: scritti, ricevuti: byte, md5: impronta.digest("hex") }),
          );
          scompatta.on("error", (e) =>
            fine(
              new ErroreAdb(`la copia compressa e' rovinata: ${e.message}`, { causa: "rovinata" }),
            ),
          );
          s.on("data", (tutto) => {
            byte += tutto.length;
            ultimoDato = Date.now();
            scompatta.write(tutto);
            if (!file.write(tutto)) {
              s.pause();
              file.once("drain", () => s.resume());
            }
          });
          s.on("end", () => scompatta.end());
          s.on("error", () => scompatta.end());
          return;
        }
        file = apriIlFile(dove, comprimi);
        file.on("error", (e) =>
          fine(new ErroreAdb(`non riesco a scrivere ${dove}: ${e.message}`, { causa: "spazio" })),
        );
        s.on("data", (tutto) => {
          byte += tutto.length;
          ultimoDato = Date.now();
          let pezzo = tutto;
          if (limite) {
            const resta = limite - scritti;
            if (resta <= 0) return;
            if (pezzo.length > resta) pezzo = pezzo.subarray(0, resta);
          }
          scritti += pezzo.length;
          impronta.update(pezzo);
          if (avanzamento && Date.now() - detto > 500) {
            detto = Date.now();
            avanzamento(scritti);
          }
          if (!file.write(pezzo)) {
            s.pause();
            file.once("drain", () => s.resume());
          }
          /* Arrivato tutto: la coda non serve, si chiude da qui. */
          if (limite && scritti >= limite)
            fine(null, { byte: scritti, ricevuti: byte, md5: impronta.digest("hex") });
        });
        s.on("end", () =>
          fine(null, { byte: scritti, ricevuti: byte, md5: impronta.digest("hex") }),
        );
        s.on("error", () =>
          fine(null, { byte: scritti, ricevuti: byte, md5: impronta.digest("hex") }),
        );
      });
      server.listen(0, "0.0.0.0", () => {
        const porta = server.address().port;
        const riga = `${comando} | ${nc} ${verso} ${porta}`;
        try {
          proc = this.avvia(
            this.programma,
            ["-s", this._dev(indirizzo), "exec-out", `su -c ${scappa(riga)}`],
            { stdio: ["ignore", "ignore", "ignore"], env: this._ambiente() },
          );
          proc.on?.("error", () => {});
        } catch (errore) {
          fine(new ErroreAdb(`adb non si avvia: ${errore.message}`, { causa: "niente_adb" }));
        }
      });
    });
  }

  /* Il verso opposto della copia diretta: un file dall'add-on al pannello, su
   * una connessione di rete normale invece che con `adb push` — che su
   * Android 8 aspetta la conferma di ogni pacchetto e va a meno di 1 MB/s.
   * L'add-on apre una porta e manda il file a chi si collega; il pannello si
   * collega con `nc` e scrive quello che arriva. Davanti a `nc` c'e' uno
   * `sleep`: tiene aperto il suo ingresso, cosi' nessun `nc` se ne va prima
   * di aver ricevuto tutto (alcuni escono quando l'ingresso finisce). Torna
   * { byte } quando l'add-on ha mandato tutto: la misura sul pannello la
   * guarda chi chiama. */
  mandaDiretto(
    indirizzo,
    locale,
    remoto,
    {
      verso,
      nc = "nc",
      avanzamento = null,
      fermo = this.fermoDellaCopia,
      attesa = ATTESE.push,
      attesaDelCollegamento = 20_000,
    } = {},
  ) {
    return new Promise((risolvi, rifiuta) => {
      const server = createServer({ allowHalfOpen: true });
      let proc = null;
      let presa = null;
      let finito = false;
      let mandati = 0;
      let detto = 0;
      let ultimoDato = Date.now();
      const fine = (errore, esito) => {
        if (finito) return;
        finito = true;
        clearTimeout(scade);
        clearTimeout(nessuno);
        clearInterval(guardia);
        try {
          server.close();
        } catch (_e) {
          /* Gia' chiuso. */
        }
        /* Andato tutto: `nc` sul pannello sta finendo di scrivere, e chiudere
         * adesso la sua sessione potrebbe tagliargli la coda. La si chiude
         * dopo, quando chi chiama ha gia' guardato la misura. */
        const chiudi = () => proc?.kill?.("SIGKILL");
        if (errore) {
          chiudi();
          presa?.destroy();
          rifiuta(errore);
        } else {
          setTimeout(chiudi, 30_000).unref?.();
          risolvi(esito);
        }
      };
      const scade = setTimeout(
        () => fine(new ErroreAdb("l'invio ci ha messo troppo", { causa: "tempo" })),
        attesa,
      );
      const nessuno = setTimeout(
        () =>
          fine(
            new ErroreAdb("il pannello non si e' collegato per l'invio diretto", {
              causa: "diretta",
            }),
          ),
        attesaDelCollegamento,
      );
      const guardia = setInterval(
        () => {
          if (presa && Date.now() - ultimoDato > fermo)
            fine(
              new ErroreAdb(`l'invio e' fermo da ${Math.round(fermo / 1000)} secondi`, {
                causa: "fermo",
              }),
            );
        },
        Math.min(5_000, Math.max(50, fermo / 3)),
      );
      server.on("error", (e) =>
        fine(new ErroreAdb(`invio diretto: ${e.message}`, { causa: "diretta" })),
      );
      server.on("connection", (s) => {
        if (presa) return s.destroy();
        presa = s;
        clearTimeout(nessuno);
        ultimoDato = Date.now();
        s.on("data", () => {
          /* Il pannello non manda niente: se manda, si ignora. */
        });
        s.on("error", (e) =>
          fine(new ErroreAdb(`invio diretto: ${e.message}`, { causa: "diretta" })),
        );
        const leggi = createReadStream(locale);
        leggi.on("data", (pezzo) => {
          mandati += pezzo.length;
          ultimoDato = Date.now();
          if (avanzamento && Date.now() - detto > 500) {
            detto = Date.now();
            avanzamento(mandati);
          }
          if (!s.write(pezzo)) {
            leggi.pause();
            s.once("drain", () => leggi.resume());
          }
        });
        leggi.on("error", (e) =>
          fine(new ErroreAdb(`non riesco a leggere ${locale}: ${e.message}`, { causa: "file" })),
        );
        leggi.on("end", () => s.end(() => fine(null, { byte: mandati })));
      });
      server.listen(0, "0.0.0.0", () => {
        const porta = server.address().port;
        const riga = `sleep 900 | ${nc} ${verso} ${porta} > ${scappa(remoto)}`;
        try {
          proc = this.avvia(
            this.programma,
            ["-s", this._dev(indirizzo), "exec-out", `sh -c ${scappa(riga)}`],
            { stdio: ["ignore", "ignore", "ignore"], env: this._ambiente() },
          );
          proc.on?.("error", () => {});
        } catch (errore) {
          fine(new ErroreAdb(`adb non si avvia: ${errore.message}`, { causa: "niente_adb" }));
        }
      });
    });
  }

  /* Quale `nc` c'e' sul pannello, o "" se non c'e'. */
  async ncSulPannello(indirizzo) {
    const detto = await this.shell(
      indirizzo,
      "command -v nc 2>/dev/null || { toybox nc --help >/dev/null 2>&1 && echo 'toybox nc'; }",
      { root: true, attesa: ATTESE.svelto },
    ).catch(() => "");
    const riga = String(detto).trim().split("\n").pop().trim();
    return /(^|\/)nc$|^toybox nc$/.test(riga) ? riga : "";
  }

  /* Scarica un file dal pannello col protocollo di adb, che conta i byte: il
   * piano B della copia di sicurezza quando `exec-out` perde dei pezzi. */
  pull(indirizzo, daRemoto, aLocale) {
    return this.comando(["-s", this._dev(indirizzo), "pull", daRemoto, aLocale], {
      attesa: ATTESE.pull,
    });
  }

  push(indirizzo, daLocale, aRemoto) {
    return this.comando(["-s", this._dev(indirizzo), "push", daLocale, aRemoto], {
      attesa: ATTESE.push,
    });
  }

  install(indirizzo, apkLocale, { sostituisci = true, permessi = false } = {}) {
    const a = ["-s", this._dev(indirizzo), "install"];
    if (sostituisci) a.push("-r");
    if (permessi) a.push("-g");
    a.push(apkLocale);
    return this.comando(a, { attesa: ATTESE.install });
  }

  /* Cosa ha risposto `id -u` come root: "0" se sbloccato. "" se non si sa. */
  async root(indirizzo) {
    try {
      const u = await this.shell(indirizzo, "id -u", { root: true, attesa: ATTESE.svelto });
      return u.trim();
    } catch (_e) {
      return "";
    }
  }

  getprop(indirizzo, nome) {
    return this.shell(indirizzo, `getprop ${nome}`, { root: false, attesa: ATTESE.svelto });
  }
}

/* Mette una stringa fra apici per darla a `su -c` in sicurezza: nessuna
 * stringa che arriva da fuori finisce nuda in una shell. */
export function scappa(testo) {
  return `'${String(testo).replace(/'/g, `'\\''`)}'`;
}

/* C'e' un `adb` usabile? Una domanda sola, per dirlo nella console. */
export async function adbCE(adb) {
  try {
    await adb.comando(["version"], { attesa: ATTESE.svelto });
    return true;
  } catch (errore) {
    if (errore.causa === "niente_adb") return false;
    /* Un altro errore (ma `adb` c'e'): per la console basta che ci sia. */
    return true;
  }
}
