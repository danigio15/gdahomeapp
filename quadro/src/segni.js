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
 * ─── Una cartella per installatore ───────────────────────────────────────
 *
 * Prima la cartella era una sola per tutto il quadro, e chi scriveva per
 * primo vinceva: una casa qualunque, di un installatore qualunque, poteva
 * mandare l'icona e le note di «Mosquitto 6.5.2» — basta dire di averlo — e
 * quella roba compariva nella pagina di **tutti** gli altri installatori.
 *
 * Adesso ogni installatore ha la sua (`segni/<inst_…>/`): le sue case ci
 * scrivono, la sua pagina ci legge, e quello che manda una casa di Bianchi a
 * Rossi non arriva. Si perde un po' di risparmio — la stessa icona sta una
 * volta per installatore invece che una volta sola — e si guadagna che
 * nessuno scrive nella pagina di un altro.
 *
 * ─── Chi le puo' vedere ──────────────────────────────────────────────────
 *
 * Chiunque ne sappia il segno e l'installatore: l'indirizzo e'
 * `/segno/<inst_…>/<segno>`. Come per il marchio di un installatore: sedici
 * cifre esadecimali non si indovinano, e quello che si scopre indovinandole e'
 * l'icona di Mosquitto.
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

/**
 * Il segno di un aggiornamento, rifatto qui.
 *
 * **La stessa riga** di `ilSegnoDi` in `ponte/src/segni.js`. Due copie di
 * quattro righe sono meglio di un pacchetto condiviso fra due macchine che si
 * aggiornano in momenti diversi — ma due copie si scollano, e allora una prova
 * per parte pianta lo stesso valore noto: se una delle due cambia, cadono
 * tutt'e due.
 *
 * E qui serve per una ragione precisa, che nella casa non c'e': **non ci si
 * fida del segno che arriva**. Vedi `metti`.
 */
export function ilSegnoDi(nome, a) {
  const chi = `${String(nome ?? "").trim()}\n${String(a ?? "").trim()}`;
  if (chi.length < 2) return "";
  return createHash("sha256").update(chi, "utf8").digest("hex").slice(0, 16);
}

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

/* Quanto dura un «quell'icona non esiste».
 *
 * Il no e' una risposta comoda — la casa smette di mandare, il quadro smette
 * di chiedere — e proprio per questo e' quella che costa di piu' quando e'
 * sbagliata: nessuno la rimette mai in discussione. E una l'abbiamo avuta
 * sbagliata per un pezzo. Il ponte rispondeva «non esiste» a ogni icona che
 * stesse dentro Home Assistant — Frigate, il Core, il sistema operativo, il
 * firmware del minipc — e qui quel no si scriveva per sempre. Sistemare il
 * ponte non sarebbe bastato: la cartella se li era gia' segnati, e quelle
 * icone non sarebbero arrivate mai.
 *
 * Quindi un no scade. Richiederlo costa una riga di rapporto e una domanda
 * che la casa si fa in memoria: per un firmware che un'icona non ce l'ha
 * davvero, il no torna uguale e non viaggia niente. Due ore e' poco per
 * pesare e abbastanza perche' una casa appena aggiornata si veda le sue
 * icone nel giro di un pomeriggio, senza che nessuno vada a cancellare
 * niente a mano. */
export const UN_NO_DURA = 2 * 60 * 60 * 1000;

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

/* Com'e' fatta la matricola di un installatore: la stessa di `CHI_VALIDO`. */
const DI_CHI = /^inst_[0-9a-f]{16}$/;

export class Segni {
  /* `di` e' l'installatore di cui e' questa cartella. Senza, e' la cartella
   * di una volta, quella di tutti: la usano le prove dei pezzi, e il quadro
   * la svuota all'accensione (`sgombraLaVecchia`). */
  constructor({ cartella = "./dati", adesso = () => Date.now(), di = "" } = {}) {
    if (di && !DI_CHI.test(String(di))) throw new Error("questo non e' un installatore");
    this.cartella = di ? join(cartella, "segni", di) : join(cartella, "segni");
    this.adesso = adesso;
  }

  /* I file della cartella di tutti, rimasti dalle versioni di prima: non li
   * legge piu' nessuno, e una roba che si e' deciso di non mostrare non la si
   * tiene sul disco. Le sottocartelle — quelle degli installatori — restano. */
  sgombraLaVecchia() {
    let andati = 0;
    try {
      for (const una of readdirSync(this.cartella, { withFileTypes: true })) {
        if (!una.isFile()) continue;
        rmSync(join(this.cartella, una.name), { force: true });
        andati += 1;
      }
    } catch (_nonCE) {
      /* Niente cartella, niente da sgombrare. */
    }
    return andati;
  }

  /** Dove sta l'**icona** di questo segno, se c'e'. */
  _dove(segno) {
    if (!SEGNO_VALIDO.test(String(segno ?? ""))) return null;
    try {
      for (const nome of readdirSync(this.cartella)) {
        /* La coda conta. Prima bastava che il nome cominciasse col segno, e
         * sotto quel segno ci stanno anche `.note`, `.senza-logo`,
         * `.senza-note`: il file delle note passava per un'icona, e un segno
         * che aveva solo le note risultava completo. */
        if (!nome.startsWith(`${segno}.`)) continue;
        if (ilTipoDi(nome.slice(nome.lastIndexOf(".") + 1))) return join(this.cartella, nome);
      }
    } catch (_nonCE) {
      /* La cartella non c'e' ancora: nessun segno. */
    }
    return null;
  }

  /* Di un segno ci sono **due** cose, e vanno tenute separate.
   *
   * Prima qui c'era un `||`: bastava una delle due per dire «ce l'ho tutto».
   * Arrivavano le note e l'icona no — succede, e' uno scarico che va storto —
   * e da quel momento il segno risultava completo: `quelliCheMancano` non lo
   * chiedeva piu', e quell'icona non sarebbe arrivata mai piu'. Un `&&` da
   * solo ribalta il guasto: un firmware un'icona non ce l'ha proprio, e la si
   * richiederebbe per sempre.
   *
   * Servono tutt'e tre gli stati, allora: ce l'ho, non ce l'ho, **non
   * esiste**. Il terzo lo dice la casa — lei sola lo sa — e qui si segna in
   * un file che dice **quando** l'ha detto: un no scade, vedi `UN_NO_DURA`. */
  _hoIlLogo(segno) {
    return Boolean(this._dove(segno)) || this._ilNoVale(`${segno}.senza-logo`);
  }

  /* Un «non esiste» ancora buono: scritto, e non da troppo tempo.
   *
   * La data sta **dentro** il file e non e' quella del file. Ogni rapporto
   * che nomina un segno gliela rinfresca (`_visto`, per la potatura), quindi
   * la data del file dice quando l'ha nominato l'ultima casa — non quando il
   * no e' stato detto — e un no cosi' non scadrebbe mai.
   *
   * Un file vuoto vale come scaduto: sono i no scritti prima che questa data
   * ci fosse, ed e' esattamente quella la roba da richiedere una volta. Se il
   * no e' vero torna uguale, col suo orario, e non se ne parla per due ore. */
  _ilNoVale(nome) {
    let scritto = "";
    try {
      scritto = readFileSync(join(this.cartella, nome), "utf8");
    } catch (_nonCE) {
      return false;
    }
    const quando = Number(scritto.trim());
    if (!Number.isFinite(quando) || quando <= 0) return false;
    return this.adesso() - quando < UN_NO_DURA;
  }

  _hoLeNote(segno) {
    return (
      existsSync(join(this.cartella, `${segno}.note`)) ||
      existsSync(join(this.cartella, `${segno}.senza-note`))
    );
  }

  /** Se di questo segno si ha gia' tutto: l'icona **e** le note. */
  ce(segno) {
    if (!SEGNO_VALIDO.test(String(segno ?? ""))) return false;
    return this._hoIlLogo(segno) && this._hoLeNote(segno);
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
      /* ─── Il segno non si prende per buono: si rifa' ───────────────────
       *
       * Prima si scriveva quello che la casa diceva di essere il segno. Ma un
       * segno e' `sha256(nome + versione)` di roba **pubblica**: chiunque sa
       * che esiste «Mosquitto broker 6.5.2» sa anche che segno fa, senza
       * doverlo indovinare. E questa cartella e' una sola per tutti, e chi
       * scrive per primo vince.
       *
       * Quindi una casa qualunque — una sola, bucata o in malafede, di un
       * installatore qualunque — poteva mandare il segno di un aggiornamento
       * che non ha, con dentro l'immagine che voleva e le note che voleva, e
       * quella roba sarebbe comparsa nella pagina di **tutti** gli altri
       * installatori, sotto il nome di un'applicazione vera.
       *
       * Adesso il segno lo calcola il quadro dal nome e dalla versione che
       * stanno nella riga — che sono le stesse due cose da cui lo fa la casa —
       * e quello che arriva scritto si guarda solo per vedere se combacia. Chi
       * vuole avvelenare l'icona di Mosquitto deve mandare una riga che dice
       * di avere Mosquitto: allora il segno e' il suo, ed e' la stessa cosa
       * che farebbe una casa che Mosquitto ce l'ha davvero. */
      const segno = ilSegnoDi(uno?.nome, uno?.a);
      if (!SEGNO_VALIDO.test(segno)) continue;
      /* Se la casa ne ha scritto uno diverso, quella riga si lascia stare: o
       * e' un ponte che conta in un altro modo — e allora i suoi byte non si
       * sa a cosa appartengano — o e' qualcuno che ci prova. */
      if (uno?.segno !== undefined && String(uno.segno) !== segno) continue;
      try {
        /* Un segno nominato in un rapporto e' un segno **in uso**: lo si
         * segna come visto adesso, cosi' la potatura butta quelli che non
         * servono piu' invece dei primi che le capitano. */
        this._visto(segno);
        if (typeof uno?.logo === "string" && uno.logo) {
          const byte = Buffer.from(uno.logo, "base64");
          const coda = cheRazzaE(byte);
          if (coda && !this._dove(segno)) {
            this._scrivi(`${segno}.${coda}`, byte);
            presi += 1;
          }
        } else if (uno?.senzaLogo === true && !this._hoIlLogo(segno)) {
          /* «Un'icona non ce n'e'»: un file con dentro l'ora in cui e' stato
           * detto. Da qui non si richiede piu', ma non per sempre. */
          this._scrivi(`${segno}.senza-logo`, String(this.adesso()));
          presi += 1;
        }
        if (typeof uno?.leNote === "string" && uno.leNote.trim()) {
          if (!existsSync(join(this.cartella, `${segno}.note`))) {
            this._scrivi(`${segno}.note`, uno.leNote.slice(0, NOTE_AL_MASSIMO));
            presi += 1;
          }
        } else if (uno?.senzaNote === true && !this._hoLeNote(segno)) {
          this._scrivi(`${segno}.senza-note`, Buffer.alloc(0));
          presi += 1;
        }
      } catch (_errore) {
        /* Un segno che non si scrive non e' un rapporto da rifiutare. */
      }
    }
    if (presi) this.potatura();
    return presi;
  }

  _scrivi(nome, roba) {
    mkdirSync(this.cartella, { recursive: true });
    writeFileSync(join(this.cartella, nome), roba, typeof roba === "string" ? "utf8" : undefined);
  }

  /* «Questo segno serve ancora»: si rinfresca la data dei suoi file. E' quello
   * che guarda la potatura. */
  _visto(segno) {
    const quando = new Date(this.adesso());
    let nomi;
    try {
      nomi = readdirSync(this.cartella).filter((nome) => nome.startsWith(`${segno}.`));
    } catch (_nonCE) {
      return;
    }
    for (const nome of nomi) {
      try {
        utimesSync(join(this.cartella, nome), quando, quando);
      } catch (_errore) {
        /* Una data che non si scrive non e' niente: al giro dopo si riprova. */
      }
    }
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
      /* Rifatto qui come in `metti`, e per lo stesso motivo: si chiede quello
       * che manca **di questa riga**, non quello che la casa dice di volerci
       * mandare. */
      const segno = ilSegnoDi(uno?.nome, uno?.a);
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
    /* ─── Quali se ne vanno: i meno usati di recente ─────────────────────
     *
     * Prima era l'ordine alfabetico, che essendo impronte sembrava caso puro.
     * Ma il caso, se e' sempre lo stesso, non e' caso: e' una regola. Un segno
     * che casca oltre il taglio ci casca **tutte le volte**, e allora il giro
     * diventava — arriva, si salva, si butta; il rapporto dopo lo ritrova
     * mancante, lo richiede, la casa lo rimanda, si salva, si butta. Per
     * sempre, ogni minuto, per quella casa. Il tetto non si stabilizzava mai.
     *
     * Adesso conta quando un segno e' stato visto l'ultima volta — e ogni
     * rapporto che lo nomina lo rinfresca (`_visto`). Cosi' quello che serve
     * a una casa viva non se ne va, e quello che se ne va e' quello che
     * nessuno nomina piu': l'icona di una versione che e' passata. */
    const quando = new Map(
      quali.map((quale) => {
        let ultimo = 0;
        for (const nome of nomi.filter((uno) => uno.startsWith(`${quale}.`))) {
          try {
            ultimo = Math.max(ultimo, statSync(join(this.cartella, nome)).mtimeMs);
          } catch (_errore) {
            /* Un file che non si guarda vale zero: se e' l'unico, quel segno
             * e' il primo a andarsene, ed e' giusto cosi'. */
          }
        }
        return [quale, ultimo];
      }),
    );
    let andati = 0;
    const daPiuNuovo = quali.sort((una, altra) => quando.get(altra) - quando.get(una));
    for (const quale of daPiuNuovo.slice(QUANTI_SE_NE_TENGONO)) {
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
