/* I segni degli aggiornamenti: l'icona vera, e le note intere.
 *
 * ─── Cos'e' un segno ─────────────────────────────────────────────────────
 *
 * Sedici cifre esadecimali ricavate dal **nome** di un aggiornamento e dalla
 * **versione a cui va**. Le fa la casa (`ponte/src/segni.js`) e le rifa'
 * uguali chiunque abbia quelle due cose, ed e' il punto: due case che
 * aspettano lo stesso aggiornamento di Mosquitto fanno lo stesso segno, e qui
 * dentro l'icona sta **una volta sola** invece che quaranta.
 *
 * Non c'e' dentro niente di quella casa. Il nome e la versione stanno gia' nel
 * rapporto; l'entita' — `update.camera_di_marco_termostato`, che direbbe chi
 * ci abita e in quale stanza — non passa di qui e non ci entra.
 *
 * ─── Perche' le manda la casa, e non le prende il quadro ─────────────────
 *
 * Perche' e' la stessa regola di tutto il resto. La pagina del cruscotto
 * mandava il browser di chi installa a prendersi l'icona su
 * `brands.home-assistant.io`, e c'erano due guai in uno: quel browser andava a
 * farsi vedere da una macchina che non e' la sua, e quello che trovava era
 * sbagliato — il logo di HACS al posto di quello dell'applicazione, o niente
 * del tutto per un firmware.
 *
 * L'icona giusta ce l'ha **la casa**: gliela da' il suo Supervisor per gli
 * add-on, e i marchi di Home Assistant per le integrazioni. E' esattamente
 * quello che il ponte fa gia' per l'app sul telefono. Qui arriva da li', e da
 * qui la serve il quadro, dal suo indirizzo.
 *
 * ─── Chi le puo' vedere ──────────────────────────────────────────────────
 *
 * Chiunque ne sappia il segno, e l'indirizzo e' `/segno/<segno>`. Come per il
 * marchio di un installatore: sedici cifre esadecimali non si indovinano, e
 * quello che si scopre indovinandole e' l'icona di Mosquitto.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Com'e' fatto un segno. La stessa forma che fa la casa. */
export const SEGNO_VALIDO = /^[0-9a-f]{16}$/;

/** Piu' di cosi' non e' l'icona di un'applicazione. */
export const QUANTO_GROSSA = 64 * 1024;

/** E le note: un CHANGELOG intero non ci sta, e non serve. */
export const NOTE_AL_MASSIMO = 8 * 1024;

/* Quanti segni si tengono. Oltre, si buttano i piu' vecchi.
 *
 * Non e' prudenza: un segno vive quanto una versione di un'applicazione, e le
 * versioni passano. Senza un tetto questa cartella crescerebbe per sempre di
 * icone di aggiornamenti fatti l'anno scorso, che nessuno chiedera' mai piu'. */
export const QUANTI_SE_NE_TENGONO = 500;

const LE_RAZZE = [
  { coda: "png", mime: "image/png", segno: [0x89, 0x50, 0x4e, 0x47] },
  { coda: "jpg", mime: "image/jpeg", segno: [0xff, 0xd8, 0xff] },
  { coda: "webp", mime: "image/webp", segno: [0x52, 0x49, 0x46, 0x46] },
];

const IL_TIPO = Object.fromEntries(LE_RAZZE.map((una) => [una.coda, una.mime]));
IL_TIPO.svg = "image/svg+xml";

/** Il tipo da servire, da una coda. */
export const ilTipoDi = (coda) => IL_TIPO[String(coda || "").toLowerCase()] || "";

/**
 * Che immagine e' questa, guardando come comincia.
 *
 * Il controllo lo fa gia' la casa prima di mandarla. Rifarlo qui non e'
 * diffidenza verso quella casa: e' che fra le due macchine c'e' una rete, e un
 * controllo da una parte sola non e' un controllo. Questi byte finiscono in
 * una pagina che apre chi installa.
 */
export function cheRazzaE(byte) {
  if (!Buffer.isBuffer(byte) || byte.length < 4 || byte.length > QUANTO_GROSSA) return "";
  for (const una of LE_RAZZE) {
    if (una.segno.every((quanto, dove) => byte[dove] === quanto)) return una.coda;
  }
  const testa = byte.subarray(0, 512).toString("utf8").trimStart();
  if (/^<(\?xml|!--|svg)[\s>]/i.test(testa) && /<svg[\s>]/i.test(testa)) return "svg";
  return "";
}

export class Segni {
  constructor({ cartella = "./dati", adesso = () => Date.now() } = {}) {
    this.cartella = join(cartella, "segni");
    this.adesso = adesso;
  }

  /** Dove sta l'icona di questo segno, se c'e'. */
  _dove(segno) {
    if (!SEGNO_VALIDO.test(String(segno ?? ""))) return null;
    try {
      for (const nome of readdirSync(this.cartella)) {
        if (nome.startsWith(`${segno}.`)) return join(this.cartella, nome);
      }
    } catch (_nonCE) {
      /* La cartella non c'e' ancora: nessun segno. */
    }
    return null;
  }

  /** Se di questo segno si ha gia' tutto: l'icona **o** le note. */
  ce(segno) {
    if (!SEGNO_VALIDO.test(String(segno ?? ""))) return false;
    return Boolean(this._dove(segno)) || existsSync(join(this.cartella, `${segno}.note`));
  }

  /**
   * Quello che e' arrivato dentro un rapporto.
   *
   * Torna quanti ne ha presi. Non solleva mai: un'icona storta e' una riga con
   * la lettera, e va molto meglio di un rapporto rifiutato.
   */
  metti(elenco) {
    let presi = 0;
    for (const uno of Array.isArray(elenco) ? elenco : []) {
      const segno = String(uno?.segno ?? "");
      if (!SEGNO_VALIDO.test(segno)) continue;
      try {
        if (typeof uno?.logo === "string" && uno.logo) {
          const byte = Buffer.from(uno.logo, "base64");
          const coda = cheRazzaE(byte);
          if (coda && !this._dove(segno)) {
            mkdirSync(this.cartella, { recursive: true });
            writeFileSync(join(this.cartella, `${segno}.${coda}`), byte);
            presi += 1;
          }
        }
        if (typeof uno?.note === "string" && uno.note.trim()) {
          const via = join(this.cartella, `${segno}.note`);
          if (!existsSync(via)) {
            mkdirSync(this.cartella, { recursive: true });
            writeFileSync(via, uno.note.slice(0, NOTE_AL_MASSIMO), "utf8");
            presi += 1;
          }
        }
      } catch (_errore) {
        /* Un segno che non si scrive non e' un rapporto da rifiutare. */
      }
    }
    if (presi) this.potatura();
    return presi;
  }

  /** L'icona di un segno: `{byte, tipo}` o `null`. */
  leggi(segno) {
    const via = this._dove(segno);
    if (!via) return null;
    try {
      const byte = readFileSync(via);
      const tipo = ilTipoDi(via.slice(via.lastIndexOf(".") + 1));
      return tipo && cheRazzaE(byte) ? { byte, tipo } : null;
    } catch (_errore) {
      return null;
    }
  }

  /** Le note intere di un segno, o stringa vuota. */
  note(segno) {
    if (!SEGNO_VALIDO.test(String(segno ?? ""))) return "";
    try {
      return readFileSync(join(this.cartella, `${segno}.note`), "utf8").slice(0, NOTE_AL_MASSIMO);
    } catch (_errore) {
      return "";
    }
  }

  /**
   * Quali di questi segni non si hanno.
   *
   * E' quello che il quadro risponde alla casa, ed e' il motivo per cui
   * un'icona viaggia una volta sola: la casa manda **solo** quelli che
   * tornano da qui.
   */
  quelliCheMancano(elenco) {
    const manca = [];
    for (const uno of Array.isArray(elenco) ? elenco : []) {
      const segno = String(uno?.segno ?? "");
      if (SEGNO_VALIDO.test(segno) && !this.ce(segno) && !manca.includes(segno)) {
        manca.push(segno);
      }
    }
    return manca;
  }

  /** I piu' vecchi se ne vanno: vedi `QUANTI_SE_NE_TENGONO`. */
  potatura() {
    let nomi;
    try {
      nomi = readdirSync(this.cartella, { withFileTypes: true })
        .filter((una) => una.isFile())
        .map((una) => una.name);
    } catch (_nonCE) {
      return 0;
    }
    /* Il tetto conta i **segni**, non i file: uno puo' avere l'icona e le note,
     * e contarli separati vorrebbe dire buttare meta' di un segno. */
    const quali = [...new Set(nomi.map((nome) => nome.slice(0, nome.indexOf("."))))];
    if (quali.length <= QUANTI_SE_NE_TENGONO) return 0;
    /* Quali se ne vanno: quelli in fondo all'ordine alfabetico, che essendo
     * impronte e' **caso puro**. Ed e' quello che serve: il tetto sta qui
     * perche' la cartella non cresca per sempre, non per indovinare quali
     * icone serviranno ancora. Chi viene buttato e serve ancora se lo
     * riprende al rapporto dopo, perche' `quelliCheMancano` lo ritrova
     * mancante — e quello e' tutto il costo di un errore qui. */
    let andati = 0;
    for (const quale of quali.sort().slice(QUANTI_SE_NE_TENGONO)) {
      for (const nome of nomi.filter((uno) => uno.startsWith(`${quale}.`))) {
        try {
          rmSync(join(this.cartella, nome), { force: true });
          andati += 1;
        } catch (_errore) {
          /* Un file che non si butta si ributta al giro dopo. */
        }
      }
    }
    return andati;
  }
}
