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

/* Dove tenere la chiave di ADB, cosi' non ne nasce una nuova a ogni comando
 * (e il pannello non richiede di nuovo il permesso sullo schermo). */
export const CARTELLA_DELLA_CHIAVE = "/data/adb";

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
  if (t.includes("device unauthorized") || t.includes("device still authorizing"))
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
  } = {}) {
    this.programma = programma;
    this.avvia = avvia;
    this.chiave = chiave;
    this.registro = registro;
  }

  /* Avvia `adb <argomenti>` e torna { codice, fuori } quando finisce, o lancia
   * ErroreAdb se il programma non c'e' o ci mette troppo. `dentro` e' quello
   * che gli si scrive sullo stdin (per `exec-out`, o un file corto). */
  grezzo(argomenti, { attesa = ATTESE.svelto, dentro = null, binario = false } = {}) {
    return new Promise((risolvi, rifiuta) => {
      let proc;
      const ambiente = { ...process.env };
      /* La chiave di ADB sta nella sua cartella, non in quella di chi avvia
       * l'add-on: cosi' e' una sola, e persiste. */
      if (this.chiave) ambiente.HOME = this.chiave;
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
      if (/connected to|already connected/i.test(detto)) return { ok: true, causa: "" };
      return { ok: false, causa: perche(detto) || "irraggiungibile" };
    } catch (errore) {
      if (errore.causa === "niente_adb") throw errore;
      /* "connection refused" = la 5555 e' chiusa: ADB di rete spento.
       * Il resto (timeout, host irraggiungibile) = non si arriva. */
      const rifiutato = /refus/i.test(errore.uscita || errore.message || "");
      return { ok: false, causa: rifiutato ? "rifiutato" : "irraggiungibile" };
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

  /* L'uscita binaria di un comando root (per `dd` della copia di sicurezza). */
  shellBinaria(indirizzo, comando, opzioni = {}) {
    return this.shell(indirizzo, comando, { ...opzioni, binario: true, root: true });
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
