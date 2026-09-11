/* Il portiere: chi apre la porta, e da quel momento in poi si parla cifrato.
 *
 * Sta fra la presa nuda — un socket vero, o un canale del centralino — e il
 * ponte. Fa la stretta di mano in chiaro, ricava la chiave, e da li' in poi
 * consegna al ponte una presa che cifra e decifra da sola. Il ponte non sa che
 * esista: continua a vedere una presa qualunque.
 *
 * ─── La stretta di mano ───────────────────────────────────────────────────
 *
 * Un messaggio per parte, in chiaro. E' l'unico pezzo che il centralino vede,
 * e non c'e' niente dentro che gli serva.
 *
 *   telefono → casa   {v:1, chi:"dm_…", apertura:"…", mia:"…", gzip:true, mucchio:true}
 *   telefono → casa   {v:1, abbina:true, apertura:"…", mia:"…", gzip:true}  un telefono nuovo
 *   casa → telefono   {v:1, pronto:true, mia:"…", gzip:true, mucchio:true}
 *   casa → telefono   {v:1, no:"…"}                          e basta
 *   casa → telefono   {v:1, no:"…", riabbina:true}           questo telefono non c'e' piu'
 *
 * `mia` e' una chiave pubblica effimera: vive quanto il collegamento. `chi` e'
 * l'identificativo del telefono, che non e' un segreto — serve solo a sapere
 * quale chiave del filo tirare fuori. `gzip: true` dice «so aprire una busta
 * compressa»: chi manda comprime solo se l'altro l'ha detto, e chi non lo
 * dice — un'app vecchia, l'app nel browser — riceve tutto com'era. E' scritto
 * in `cifra.js`.
 *
 * Dopo, ogni messaggio e' una busta.
 */

import { Busta, BustaGuasta, chiaveDiSessione, coppiaEffimera, VERSIONE } from "./cifra.js";
import { CodiceSbagliato, TroppiTentativi } from "./abbinamento.js";
import { TroppiDispositivi } from "./dispositivi.js";

const CHIUSA_PER_REGOLA = 1008;

/* ─── I messaggi grandi ────────────────────────────────────────────────────
 *
 * La prima cosa che chiede un telefono e' `get_states`: **tutta la casa in un
 * messaggio solo**, che su una casa vera sono due o tre megabyte. Dal
 * centralino non passa: le funzioni sulla nuvola hanno un tetto di un
 * megabyte per messaggio, e non e' un'impostazione — e' come sono fatte.
 *
 * Quindi le buste grandi si spezzano. Un pezzo comincia con `|`, l'ultimo no:
 * chi riceve accumula finche' non arriva quello senza. Il segno sta **fuori**
 * dalla busta, quindi chi sta in mezzo puo' al massimo rovinare
 * l'impacchettamento — e allora la busta non si apre, che e' esattamente
 * quello che deve succedere.
 *
 * Il `|` va bene come segno perche' in base64 non c'e': una busta intera non
 * comincera' mai con quello. */
const PEZZO = 512 * 1024;

/* Oltre questo, chi manda non sta mandando la casa: sta riempiendo la nostra
 * memoria. */
const INTERO_MASSIMO = 16 * 1024 * 1024;

export class Portiere {
  constructor({ ponte, dispositivi, abbinamento, registro, chiamata, ritorno }) {
    this.ponte = ponte;
    this.dispositivi = dispositivi;
    this.abbinamento = abbinamento;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.chiamata = chiamata;
    this.ritorno = ritorno;
  }

  accogli(presa, { da = "?" } = {}) {
    presa.onMessaggio = (testo) => this._laPrimaParola(presa, testo, da);
    presa.onChiusa = () => {};
  }

  _laPrimaParola(presa, testo, da) {
    let detto;
    try {
      detto = JSON.parse(testo);
    } catch (_errore) {
      this._no(presa, "non ho capito");
      return;
    }
    if (!detto || typeof detto !== "object" || detto.v !== VERSIONE) {
      this._no(presa, "non parliamo la stessa lingua");
      return;
    }
    if (typeof detto.mia !== "string" || typeof detto.apertura !== "string") {
      this._no(presa, "stretta di mano incompleta");
      return;
    }

    const mia = coppiaEffimera();
    const apertura = Buffer.from(detto.apertura, "base64");
    if (apertura.length !== 16) {
      this._no(presa, "apertura sbagliata");
      return;
    }

    /* Un telefono nuovo: nessuna chiave del filo, ancora. Quella la ricevera'
     * dentro questa stessa conversazione. */
    if (detto.abbina === true) {
      this._apriPerAbbinare(presa, { detto, mia, apertura, da });
      return;
    }

    const chiave = this.dispositivi.chiaveDi(String(detto.chi ?? ""));
    if (!chiave) {
      /* Detto senza dire *perche'*: un telefono che non c'e' e uno abbinato
       * prima delle chiavi sono la stessa cosa da fuori, e in tutti e due i
       * casi si riabbina. Dire quale dei due sarebbe dire a chi bussa a caso
       * quali identificativi esistono.
       *
       * `riabbina` invece va detto, ed e' una bandierina e non una frase
       * apposta: il telefono ci deve *fare* qualcosa — smettere di riprovare e
       * mandare l'utente a rifare l'abbinamento — e far dipendere quel
       * comportamento dal testo di un messaggio vuol dire romperlo il giorno
       * che qualcuno riscrive la frase. */
      this._no(presa, "riabbina questo telefono", { riabbina: true });
      return;
    }

    let chiaveDiQuestoFilo;
    try {
      chiaveDiQuestoFilo = chiaveDiSessione({
        miaPrivata: mia.privata,
        suaPubblica: detto.mia,
        delTelefono: Buffer.from(detto.mia, "base64"),
        dellaCasa: mia.pubblica,
        apertura,
        chiaveDelFilo: chiave,
      });
    } catch (_errore) {
      this._no(presa, "stretta di mano sbagliata");
      return;
    }

    presa.manda(JSON.stringify(this._pronto(mia)));
    /* Da qui in poi il ponte vede una presa qualunque, e non sa niente di
     * tutto questo. */
    this.ponte.accogli(
      new PresaCifrata(presa, chiaveDiQuestoFilo, { comprime: detto.gzip === true }),
      /* `mucchio: true` dice «so spacchettare un mucchio di eventi». Come il
       * gzip: chi non lo dice riceve un messaggio per evento, come prima. */
      { da, mucchio: detto.mucchio === true },
    );
  }

  /* La risposta a chi ha stretto la mano: la mia chiave effimera, e che qui
   * il gzip si sa aprire. */
  _pronto(mia) {
    return {
      v: VERSIONE,
      pronto: true,
      mia: mia.pubblica.toString("base64"),
      gzip: true,
      /* Che di qua gli eventi si sanno raggruppare. Al telefono serve per
       * dirlo in diagnostica: quanti messaggi sono arrivati, e in quante
       * buste — che passando dal centralino e' il numero che si paga. */
      mucchio: true,
    };
  }

  /* ─── L'abbinamento, dentro il cifrato ───────────────────────────────── */

  _apriPerAbbinare(presa, { detto, mia, apertura, da }) {
    let chiaveDiQuestoFilo;
    try {
      chiaveDiQuestoFilo = chiaveDiSessione({
        miaPrivata: mia.privata,
        suaPubblica: detto.mia,
        delTelefono: Buffer.from(detto.mia, "base64"),
        dellaCasa: mia.pubblica,
        apertura,
      });
    } catch (_errore) {
      this._no(presa, "stretta di mano sbagliata");
      return;
    }

    presa.manda(JSON.stringify(this._pronto(mia)));

    const cifrata = new PresaCifrata(presa, chiaveDiQuestoFilo, { comprime: detto.gzip === true });
    /* `_ilCodice` aspetta il Supervisor, quindi torna una promessa: se
     * scoppiasse, nessuno la guarderebbe e Node butterebbe giu' il ponte per
     * un errore non gestito. Chi ha chiesto un abbinamento merita un no, non
     * un add-on che si riavvia. */
    cifrata.onMessaggio = (dentro) => {
      this._ilCodice(cifrata, dentro, da).catch((errore) => {
        this.registro.errore(`abbinamento andato storto: ${errore?.message || errore}`);
        cifrata.chiudi(1011, "");
      });
    };
    cifrata.onChiusa = () => {};
  }

  async _ilCodice(cifrata, testo, da) {
    let detto;
    try {
      detto = JSON.parse(testo);
    } catch (_errore) {
      cifrata.chiudi(CHIUSA_PER_REGOLA, "non ho capito");
      return;
    }

    try {
      this.abbinamento.consuma(detto?.codice);
    } catch (errore) {
      if (errore instanceof TroppiTentativi) {
        this.registro.attenzione(`troppi tentativi di abbinamento da ${da}`);
        cifrata.manda(JSON.stringify({ t: "no", perche: "troppi tentativi: riprova piu' tardi" }));
      } else if (errore instanceof CodiceSbagliato) {
        this.registro.attenzione(`codice di abbinamento sbagliato da ${da}`);
        cifrata.manda(JSON.stringify({ t: "no", perche: errore.message }));
      } else {
        cifrata.manda(JSON.stringify({ t: "no", perche: "non ha funzionato" }));
      }
      cifrata.chiudi(CHIUSA_PER_REGOLA, "codice rifiutato");
      return;
    }

    let abbinato;
    try {
      abbinato = this.dispositivi.abbina({ nome: detto?.nome, sistema: detto?.sistema });
    } catch (errore) {
      const perche = errore instanceof TroppiDispositivi ? errore.message : "non ha funzionato";
      cifrata.manda(JSON.stringify({ t: "no", perche }));
      cifrata.chiudi(1000, "abbinato");
      return;
    }

    const { dispositivo, segno, chiave } = abbinato;
    this.chiamata?.chiudiLAbbinamento();
    this.registro.info(`abbinato «${dispositivo.nome}» dal centralino`);
    /* Dove tornare. Chi si e' abbinato inquadrando un quadretto non ha
     * battuto nessun indirizzo, e senza questo non saprebbe dove ribussare
     * domani. Se il
     * Supervisor non risponde si va avanti lo stesso, con quello che c'e': un
     * abbinamento non si fa fallire per un indirizzo mancante. */
    const ritorno = (await this.ritorno?.cosaDire()) ?? null;
    cifrata.manda(JSON.stringify({ t: "ecco", segno, chiave, dispositivo, ritorno }));
    /* Un filo di abbinamento serve a una cosa sola e poi si chiude. Il
     * telefono ritorna dalla porta normale, col segno appena avuto. */
    cifrata.chiudi(1000, "abbinato");
  }

  _no(presa, perche, altro = {}) {
    presa.manda(JSON.stringify({ v: VERSIONE, no: perche, ...altro }));
    presa.chiudi(CHIUSA_PER_REGOLA, perche);
  }
}

/* ─── La presa che cifra ─────────────────────────────────────────────────── */

/* Si comporta come una presa qualunque: `manda`, `ping`, `chiudi`,
 * `onMessaggio`, `onChiusa`. Sotto, ogni messaggio e' una busta.
 *
 * Una busta che non si apre chiude il filo, e non e' severita' inutile: su un
 * canale che passa da un terzo, un messaggio che non si apre o e' rotto o e'
 * stato toccato, e in tutti e due i casi andare avanti sarebbe peggio.
 */
export class PresaCifrata {
  constructor(sotto, chiave, { comprime = false } = {}) {
    this.sotto = sotto;
    this.busta = new Busta(chiave, { io: "casa", comprime });
    this.viva = true;
    this._pezzi = "";
    this.onMessaggio = () => {};
    this.onChiusa = () => {};
    this.onPong = () => {};

    sotto.onMessaggio = (testo) => this._arrivata(testo);
    sotto.onChiusa = () => this._finita();
    sotto.onPong = () => {
      try {
        this.onPong();
      } catch (_errore) {
        /* Chi ascolta ha sbagliato. */
      }
    };
  }

  manda(testo) {
    if (!this.viva) return false;
    const busta = this.busta.chiudi(testo);
    if (busta.length <= PEZZO) return this.sotto.manda(busta);

    for (let da = 0; da < busta.length; da += PEZZO) {
      const pezzo = busta.slice(da, da + PEZZO);
      const ultimo = da + PEZZO >= busta.length;
      if (!this.sotto.manda(ultimo ? pezzo : `|${pezzo}`)) return false;
    }
    return true;
  }

  ping() {
    this.sotto.ping?.();
  }

  chiudi(codice, motivo) {
    if (!this.viva) return;
    this.viva = false;
    this.sotto.chiudi(codice, motivo);
    this._avvisa();
  }

  _arrivata(testo) {
    if (!this.viva) return;

    if (typeof testo === "string" && testo.startsWith("|")) {
      this._pezzi += testo.slice(1);
      if (this._pezzi.length > INTERO_MASSIMO) {
        this._pezzi = "";
        this.chiudi(CHIUSA_PER_REGOLA, "messaggio troppo grande");
      }
      return;
    }

    const intero = this._pezzi ? this._pezzi + testo : testo;
    this._pezzi = "";

    let dentro;
    try {
      dentro = this.busta.apri(intero);
    } catch (errore) {
      if (!(errore instanceof BustaGuasta)) throw errore;
      this.chiudi(CHIUSA_PER_REGOLA, "busta guasta");
      return;
    }
    try {
      this.onMessaggio(dentro);
    } catch (_errore) {
      this.chiudi(1011, "");
    }
  }

  _finita() {
    if (!this.viva) return;
    this.viva = false;
    this._avvisa();
  }

  _avvisa() {
    try {
      this.onChiusa();
    } catch (_errore) {
      /* Chi ascolta ha sbagliato: non e' un motivo per far cadere altro. */
    }
  }
}
