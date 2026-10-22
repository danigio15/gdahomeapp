/* I mini video del movimento: cinque secondi prima e cinque dopo.
 *
 * «Per le telecamere si riesce a fare un mini video, tipo cinque secondi prima
 * del rilevamento e cinque secondi dopo?» E «devi ipotizzarlo per tutte, ed
 * eventualmente mettere un'opzione che attiva o meno questa funzione».
 *
 * Per tutte vuol dire senza il flusso video: non tutte le telecamere lo danno,
 * e Home Assistant registra il «prima» solo da quelle che ce l'hanno
 * precaricato. Ogni telecamera invece da' la sua istantanea
 * (`camera_proxy`), e il mini video e' fatto di quelle: per ogni telecamera
 * accesa il ponte ne tiene in memoria gli ultimi cinque secondi, due al
 * secondo, e al movimento ci aggiunge i cinque secondi che vengono dopo. Il
 * telefono li riproduce in fila: e' un video a scatti, ma c'e' su ogni
 * telecamera e non chiede niente a nessuno.
 *
 * **L'opzione** e' nella notifica «Movimento davanti alle telecamere»
 * dell'app, spenta di serie: si tengono in memoria solo le telecamere di chi
 * l'ha accesa (`sorveglia`), e solo quelle che quel telefono puo' vedere.
 * Spenta da tutti, il ponte non chiede piu' niente a nessuna telecamera.
 *
 * **Le regole** (le promesse delle telecamere sono in `commissioni.js`):
 *   - **il ponte non sa aprirli.** Ogni video si chiude (AES-256-GCM) con una
 *     chiave nuova, fatta per lui; la chiave va solo dentro la notifica, che
 *     e' cifrata per il telefono (`spinta.js`), e il ponte la dimentica appena
 *     il video e' scritto. Sul disco, in `/data/filmati`, restano byte che
 *     senza quella notifica nessuno legge — nemmeno il ponte, nemmeno chi
 *     apre la cartella (che e' comunque 0700, i file 0600);
 *   - in memoria resta solo il «prima» che serve, cinque secondi e mezzo, e
 *     solo delle telecamere sorvegliate; niente va nei registri ne' al
 *     centralino;
 *   - li chiede il telefono sul suo filo, con un utente entrato e attivo, col
 *     numero e la chiave della notifica, e il video si da' solo se la
 *     telecamera e' una che quell'utente puo' vedere (`notifiche.js`);
 *   - durano tre giorni, e al piu' se ne tengono duecento: poi si cancellano.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Quanto prima del movimento, quanto dopo, e ogni quanto un fotogramma. */
export const PRIMA = 5000;
export const DOPO = 5000;
export const OGNI = 500;
/* La larghezza chiesta: abbastanza per un telefono, leggera per il filo. */
export const LARGHEZZA = 640;
/* Un fotogramma piu' pesante di cosi' e' una telecamera che non rimpicciolisce:
 * si salta, invece di riempire la memoria. */
const FOTOGRAMMA_MASSIMO = 400 * 1024;
/* Un video intero, in byte prima del base64: sotto i 4 MB del filo. */
const PESO_MASSIMO = 2 * 1024 * 1024;
const VITA = 3 * 24 * 3600 * 1000;
const AL_PIU = 200;
/* Quanto aspetta chi chiede un video che si sta ancora registrando. */
const ASPETTA_AL_PIU = DOPO + 4000;

/* L'id e' l'ora del movimento e un pezzo a caso: «1761121500000-a1b2c3d4e5f6».
 * Dal nome si sa quanto e' vecchio senza aprirlo. */
const ID_BUONO = /^\d{10,16}-[a-z0-9]{4,24}$/;
/* La chiave: 32 byte in base64url. */
const CHIAVE_BUONA = /^[A-Za-z0-9_-]{43}$/;
const CAMERA_BUONA = /^camera\.[a-z0-9_]+$/;

const dorme = (ms) => new Promise((fatto) => setTimeout(fatto, ms));

export function idBuono(id) {
  return typeof id === "string" && ID_BUONO.test(id);
}

export function chiaveBuona(chiave) {
  return typeof chiave === "string" && CHIAVE_BUONA.test(chiave);
}

/* Il video chiuso: «gdaf1» + 12 byte di iv + 16 di sigillo + il resto.
 * L'id e' nei dati autenticati: un file rinominato non si apre. */
const INTESTAZIONE = Buffer.from("gdaf1");

function chiudi(id, chiave, video) {
  const iv = randomBytes(12);
  const cifra = createCipheriv("aes-256-gcm", chiave, iv);
  cifra.setAAD(Buffer.from(id));
  const dentro = Buffer.concat([cifra.update(JSON.stringify(video), "utf8"), cifra.final()]);
  return Buffer.concat([INTESTAZIONE, iv, cifra.getAuthTag(), dentro]);
}

function apri(id, chiave, byte) {
  if (!byte.subarray(0, INTESTAZIONE.length).equals(INTESTAZIONE)) return null;
  const da = INTESTAZIONE.length;
  const decifra = createDecipheriv("aes-256-gcm", chiave, byte.subarray(da, da + 12));
  decifra.setAAD(Buffer.from(id));
  decifra.setAuthTag(byte.subarray(da + 12, da + 28));
  const chiaro = Buffer.concat([decifra.update(byte.subarray(da + 28)), decifra.final()]);
  return JSON.parse(chiaro.toString("utf8"));
}

export class Filmati {
  constructor({
    cartella = "/data",
    casa = null,
    registro = null,
    adesso = () => Date.now(),
    aspetta = dorme,
    acaso = () => randomBytes(6).toString("hex"),
  } = {}) {
    this.dove = join(cartella, "filmati");
    this.casa = casa;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {}, debug() {} };
    this.adesso = adesso;
    this.aspetta = aspetta;
    this.acaso = acaso;
    /** camera → { fotogrammi: [{t, byte}], viva, fissa, registrazioni } */
    this._memorie = new Map();
    /** id → Promise che si chiude quando il video e' scritto. */
    this._inCorso = new Map();
  }

  /** Le telecamere da tenere in memoria. Quelle che escono si fermano. */
  sorveglia(telecamere = []) {
    const volute = new Set([...telecamere].filter((c) => CAMERA_BUONA.test(String(c))));
    for (const [camera, memoria] of this._memorie)
      if (!volute.has(camera) && !memoria.registrazioni) {
        memoria.viva = false;
        this._memorie.delete(camera);
      }
    for (const camera of volute) {
      const memoria = this._memorie.get(camera);
      if (!memoria) this._accendi(camera, true);
      else memoria.fissa = true;
    }
  }

  /** Le telecamere tenute in memoria adesso. */
  sorvegliate() {
    return [...this._memorie.entries()].filter(([, m]) => m.fissa).map(([c]) => c);
  }

  ferma() {
    for (const memoria of this._memorie.values()) memoria.viva = false;
    this._memorie.clear();
  }

  _accendi(camera, fissa) {
    const memoria = { fotogrammi: [], viva: true, fissa, registrazioni: 0 };
    this._memorie.set(camera, memoria);
    void this._giro(camera, memoria);
    return memoria;
  }

  /* Il giro di una telecamera: un'istantanea ogni mezzo secondo, mai due
   * insieme. Una telecamera lenta da' meno fotogrammi, non ne accumula. */
  async _giro(camera, memoria) {
    while (memoria.viva) {
      const inizio = this.adesso();
      try {
        const byte = await this.casa?.immagine?.(`camera_proxy/${camera}?width=${LARGHEZZA}`);
        if (byte?.length && byte.length <= FOTOGRAMMA_MASSIMO)
          memoria.fotogrammi.push({ t: this.adesso(), byte });
      } catch (_errore) {
        /* Una istantanea persa e' un fotogramma in meno. */
      }
      /* Si tiene solo il «prima» che serve, finche' nessuno registra. */
      if (!memoria.registrazioni) {
        const da = this.adesso() - PRIMA - OGNI;
        while (memoria.fotogrammi.length && memoria.fotogrammi[0].t < da)
          memoria.fotogrammi.shift();
      }
      if (!memoria.fissa && !memoria.registrazioni) {
        memoria.viva = false;
        if (this._memorie.get(camera) === memoria) this._memorie.delete(camera);
      }
      const passati = this.adesso() - inizio;
      if (memoria.viva) await this.aspetta(Math.max(50, OGNI - passati));
    }
  }

  /**
   * Comincia il video di un movimento: i fotogrammi gia' in memoria dal
   * secondo `PRIMA` e quelli dei `DOPO` che vengono. Torna subito il numero e
   * la chiave, che vanno nella notifica; il video si scrive chiuso quando i
   * secondi dopo sono passati. Una telecamera che non era in memoria registra
   * solo il dopo.
   */
  registra(camera, quando = this.adesso()) {
    if (!CAMERA_BUONA.test(String(camera))) return null;
    const id = `${Math.floor(quando)}-${this.acaso()}`;
    if (!idBuono(id)) return null;
    let chiave = randomBytes(32);
    const perLaNotifica = chiave.toString("base64url");
    let memoria = this._memorie.get(camera);
    if (!memoria) memoria = this._accendi(camera, false);
    memoria.registrazioni += 1;
    const fatto = (async () => {
      try {
        await this.aspetta(Math.max(0, quando + DOPO - this.adesso()));
        let fotogrammi = memoria.fotogrammi.filter(
          (f) => f.t >= quando - PRIMA && f.t <= quando + DOPO,
        );
        /* Il video passa intero sul filo del telefono: se pesa troppo, si
         * tiene un fotogramma si' e uno no finche' ci sta. */
        const peso = (elenco) => elenco.reduce((somma, f) => somma + f.byte.length, 0);
        while (fotogrammi.length > 1 && peso(fotogrammi) > PESO_MASSIMO)
          fotogrammi = fotogrammi.filter((_f, i) => i % 2 === 0);
        if (!fotogrammi.length) return false;
        this._scrivi(id, chiave, {
          v: 1,
          camera,
          quando,
          fotogrammi: fotogrammi.map((f) => ({
            t: f.t - quando,
            jpeg: f.byte.toString("base64"),
          })),
        });
        return true;
      } catch (errore) {
        this.registro.attenzione(`un mini video non si scrive (${errore?.code || "errore"})`);
        return false;
      } finally {
        /* La chiave il ponte non la tiene: da qui in poi ce l'ha solo la
         * notifica. */
        chiave.fill(0);
        chiave = null;
        memoria.registrazioni -= 1;
        this._inCorso.delete(id);
      }
    })();
    this._inCorso.set(id, fatto);
    return { id, chiave: perLaNotifica };
  }

  _scrivi(id, chiave, video) {
    mkdirSync(this.dove, { recursive: true, mode: 0o700 });
    writeFileSync(join(this.dove, `${id}.gdaf`), chiudi(id, chiave, video), { mode: 0o600 });
    this.pulisci();
  }

  /** Il video, con la chiave della notifica: aspetta quello che si sta
   * ancora registrando. Senza la chiave giusta, niente. */
  async leggi(id, chiave) {
    if (!idBuono(id) || !chiaveBuona(chiave)) return null;
    const inCorso = this._inCorso.get(id);
    if (inCorso) await Promise.race([inCorso, this.aspetta(ASPETTA_AL_PIU)]);
    try {
      const byte = readFileSync(join(this.dove, `${id}.gdaf`));
      const video = apri(id, Buffer.from(chiave, "base64url"), byte);
      return video && CAMERA_BUONA.test(String(video.camera)) ? video : null;
    } catch (_errore) {
      return null;
    }
  }

  /** Via quelli piu' vecchi di tre giorni, e oltre i duecento i piu' vecchi. */
  pulisci() {
    let nomi;
    try {
      nomi = readdirSync(this.dove).filter((n) => n.endsWith(".gdaf"));
    } catch (_errore) {
      return;
    }
    const ora = this.adesso();
    const elenco = nomi
      .map((nome) => ({ nome, il: Number(nome.split("-")[0]) || 0 }))
      .sort((a, b) => b.il - a.il);
    elenco.forEach((uno, i) => {
      if (i >= AL_PIU || ora - uno.il > VITA) rmSync(join(this.dove, uno.nome), { force: true });
    });
  }
}
