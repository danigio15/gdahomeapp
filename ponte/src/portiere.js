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
 *   telefono → casa   {v:1, chi:"dm_…", apertura:"…", mia:"…", gzip:true, mucchio:true, app:1061100}
 *   telefono → casa   {v:1, abbina:2, apertura:"…", mia:"…", app:1061100}   un telefono nuovo
 *   casa → telefono   {v:1, pronto:true, mia:"…", gzip:true, mucchio:true, da_casa:true}
 *   casa → telefono   {v:1, no:"…"}                          e basta
 *   casa → telefono   {v:1, no:"…", riabbina:true}           non ti conosco
 *   casa → telefono   {v:1, no:"…", motivo:"…"}              l'abbinamento non parte
 *   casa → telefono   {v:1, no:"…", motivo:"premium-richiesto"}  da fuori, con Base
 *   casa → telefono   {v:1, no:"…", motivo:"aggiorna-l-app", minima:N}  app troppo vecchia
 *
 * `mia` e' una chiave pubblica effimera: vive quanto il collegamento. `chi` e'
 * l'identificativo del telefono, che non e' un segreto — serve solo a sapere
 * quale chiave del filo tirare fuori. `gzip: true` dice «so aprire una busta
 * compressa»: chi manda comprime solo se l'altro l'ha detto, e chi non lo
 * dice — un'app vecchia, l'app nel browser — riceve tutto com'era. E' scritto
 * in `cifra.js`.
 *
 * `app` e' il numero di costruzione dell'app (`costruzioneDiQuestApp` in
 * `app/lib/versione.dart`). Le app di prima non lo dicono, e finche' la
 * versione minima e' zero non lo chiede nessuno; sopra zero, chi non lo dice
 * o dice un numero piu' piccolo si ferma con `aggiorna-l-app`. E' scritto in
 * `versione-minima.js`. Un campo in piu' in un oggetto: un ponte di prima lo
 * ignora, un'app di prima non lo manda.
 *
 * Dopo, ogni messaggio e' una busta.
 *
 * ─── L'abbinamento ────────────────────────────────────────────────────────
 *
 * La chiave dell'abbinamento e' fatta con il codice (vedi `cifra.js`), e dopo
 * il `pronto` va cosi':
 *
 *   telefono → casa   busta {t:"conferma", telefono:"…", casa:"…", nome, sistema}
 *   casa → telefono   busta {t:"ecco", segno, chiave, dispositivo, ritorno}
 *   casa → telefono   busta {t:"no", perche:"…", motivo:"…"}
 *   casa → telefono   {v:1, no:"codice sbagliato", motivo:"codice"}   in chiaro
 *
 * La conferma ripete le due chiavi pubbliche, ed e' chiusa con la chiave che
 * viene dal codice: se si apre, dall'altra parte c'e' qualcuno che il codice
 * ce l'ha, e che ha visto le stesse due chiavi. Solo allora esce qualcosa.
 * Se non si apre, il tentativo si conta come un codice sbagliato, e il no
 * va in chiaro — non c'e' una chiave in comune con cui dirlo.
 *
 * `motivo` e' per l'app, che ci deve fare cose diverse: `aggiorna` (un'app
 * di prima, che si abbinava con `abbina: true`), `nessuno` (nessun codice
 * vivo), `tentativi`, `codice`, `telefoni`. Non si fa dipendere un
 * comportamento dal testo di una frase.
 *
 * I codici vivi possono essere due: quello di tutti i giorni, e quello della
 * casa di prova (`casa-di-prova.js`). Il telefono non dice quale ha in mano
 * — il codice non viaggia, e l'app e' la stessa per tutti e due — e allora
 * la casa fa una chiave per ognuno e le prova sulla prima busta: quella che
 * la apre dice quale codice era. Il codice di tutti i giorni si spende; quello
 * di prova no, e il telefono che entra con lui scade con lui.
 *
 * ─── Il telefono staccato ─────────────────────────────────────────────────
 *
 * Il `riabbina` in chiaro non lo firma nessuno: chi sta in mezzo lo potrebbe
 * dire al posto della casa, e l'app — giustamente — lo prende per un intoppo
 * e non per una sentenza. La sentenza vera arriva **dentro il cifrato**:
 * quando la casa ha ancora la chiave del filo di un telefono che e' stato
 * staccato (`dispositivi.chiaveRevocataDi`, se c'e'), stringe la mano con
 * quella e dice `auth_invalid` in una busta. Quella la puo' scrivere solo chi
 * ha la chiave, e l'app ci crede.
 */

import {
  Busta,
  BustaGuasta,
  chiaveDiSessione,
  coppiaEffimera,
  VERSIONE,
  VERSIONE_DELL_ABBINAMENTO,
} from "./cifra.js";
import { CodiceSbagliato, TroppiTentativi } from "./abbinamento.js";
import { TELEFONI_DI_PROVA } from "./casa-di-prova.js";
import { TroppiDispositivi } from "./dispositivi.js";
import { impronta, stessoSegreto } from "./segreti.js";

const CHIUSA_PER_REGOLA = 1008;

/* ─── I messaggi grandi ────────────────────────────────────────────────────
 *
 * La prima cosa che chiede un telefono e' `get_states`: **tutta la casa in un
 * messaggio solo**, che su una casa vera sono due o tre megabyte. Dal
 * centralino non passa: non lascia passare piu' di un megabyte per messaggio
 * (`MESSAGGIO_MASSIMO` in `centralino/src/centralino.js`).
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

/* Finche' non si e' aperta almeno una busta, dall'altra parte potrebbe
 * esserci chiunque: nessuno ha ancora dimostrato di avere la chiave. A
 * chiunque si concede poco — un megabyte basta e avanza per le prime parole
 * di un telefono vero — e i sedici solo a chi ha aperto la porta. */
const INTERO_PRIMA_DI_FIDARSI = 1024 * 1024;

/* Quanto si aspetta la prima parola, e poi la conferma di chi si abbina.
 * Una stretta di mano che non finisce tiene occupata una presa per niente. */
const ATTESA_DELLA_STRETTA = 15 * 1000;

/* Le parole dell'abbinamento che l'app deve riconoscere: vedi sopra. */
const MOTIVO = Object.freeze({
  /* Da fuori casa, con gdahome Base: vedi `_soloInCasa`. */
  premium: "premium-richiesto",
  /* L'app e' piu' vecchia della versione minima: vedi `versione-minima.js`. */
  vecchia: "aggiorna-l-app",
  aggiorna: "aggiorna",
  nessuno: "nessuno",
  tentativi: "tentativi",
  codice: "codice",
  telefoni: "telefoni",
});

export class Portiere {
  constructor({
    ponte,
    dispositivi,
    abbinamento,
    registro,
    chiamata,
    ritorno,
    attesaDellaStretta = ATTESA_DELLA_STRETTA,
    /* Se questa casa sta nei limiti di gdahome Base (`licenze.js`,
     * `limitata`). Una funzione, perche' cambia mentre il ponte gira; di
     * serie no, che e' come stanno le licenze finche' la chiave e' vuota. */
    soloInCasa = () => false,
    /* La versione minima dell'app (`versione-minima.js`). Di serie nessuna:
     * entrano tutti, come prima. */
    versioneMinima = null,
    /* Il codice della casa di prova (`casa-di-prova.js`), se c'e'. Di serie
     * nessuno: si entra solo col codice di tutti i giorni. */
    casaDiProva = null,
  }) {
    this.casaDiProva = casaDiProva;
    this.soloInCasa = soloInCasa;
    this.versioneMinima = versioneMinima;
    this.ponte = ponte;
    this.dispositivi = dispositivi;
    this.abbinamento = abbinamento;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.chiamata = chiamata;
    this.ritorno = ritorno;
    this.attesaDellaStretta = attesaDellaStretta;
  }

  /* `abbina: false` dice che da questa porta non ci si abbina: serve alle
   * strade dove un abbinamento non ha niente da fare (il filo di un telefono
   * gia' abbinato, passando dal centralino). Di difetto si', perche' in casa
   * l'abbinamento passa proprio da qui. */
  /* `daCasa` dice se la presa arriva dalla rete di casa (`da-casa.js`): va
   * nel `pronto`, e con gdahome Base l'app chiude il filo che arriva da
   * fuori. Dal centralino non si e' mai in casa. */
  accogli(presa, { da = "?", abbina = true, daCasa = !String(da).startsWith("centralino") } = {}) {
    const timer = this._aTempo(presa, "la stretta di mano non e' arrivata");
    presa.onMessaggio = (testo) => {
      clearTimeout(timer);
      /* La prima parola si ascolta una volta sola: quello che arriva dopo, se
       * la stretta non e' andata, non e' affare di nessuno. */
      presa.onMessaggio = () => {};
      this._laPrimaParola(presa, testo, { da, abbina, daCasa });
    };
    presa.onChiusa = () => clearTimeout(timer);
  }

  /* Chiude la presa se entro l'attesa non succede niente. Torna il timer, da
   * spegnere quando la cosa aspettata arriva. */
  _aTempo(presa, perche) {
    const timer = setTimeout(() => {
      try {
        presa.chiudi(CHIUSA_PER_REGOLA, perche);
      } catch (_errore) {
        /* Gia' chiusa. */
      }
    }, this.attesaDellaStretta);
    timer.unref?.();
    return timer;
  }

  _laPrimaParola(presa, testo, { da, abbina, daCasa = true }) {
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

    const apertura = Buffer.from(detto.apertura, "base64");
    if (apertura.length !== 16) {
      this._no(presa, "apertura sbagliata");
      return;
    }

    /* ─── L'app troppo vecchia ────────────────────────────────────────────
     *
     * Prima di tutto il resto, abbinamento compreso: un'app che non si puo'
     * piu' usare non si abbina, e non si porta alla pagina Premium — si
     * porta al negozio. Con la minima a zero non si ferma nessuno. Il numero
     * lo dice il telefono e nessuno lo firma: e' un cancello per le app
     * della prova, che non lo sanno dire, non una serratura. */
    if (this.versioneMinima?.troppoVecchia(detto.app)) {
      this._no(
        presa,
        "questa versione di gdahome e' vecchia: aggiornala dal negozio per continuare",
        { motivo: MOTIVO.vecchia, minima: this.versioneMinima.minima },
      );
      return;
    }

    /* Un telefono nuovo: nessuna chiave del filo, ancora. Quella la ricevera'
     * dentro questa stessa conversazione. */
    if (detto.abbina != null && detto.abbina !== false) {
      this._perAbbinare(presa, { detto, apertura, da, abbina });
      return;
    }

    /* ─── Da fuori casa, con gdahome Base ─────────────────────────────────
     *
     * Il collegamento da fuori e' Premium (`docs/LICENZE.md`). Il taglio sta
     * **qui**, e non sul filo col centralino, per una ragione sola: su quel
     * filo passa anche l'abbinamento, e l'abbinamento resta aperto a tutti —
     * chi inquadra il QR stando fuori casa deve poter abbinare il telefono, e
     * poi usarlo in casa. Quindi il filo della casa resta su, i canali si
     * aprono, e un canale arrivato dal centralino si ferma alla prima parola
     * se non e' un abbinamento.
     *
     * Il centralino fa lo stesso da parte sua — chiude con `4402` il telefono
     * di una casa senza gettone — ma questa riga non si fida di lui: un
     * centralino vecchio, o uno di qualcun altro, non lo sa fare. Il no va in
     * chiaro come tutti quelli della stretta di mano: non dice niente che chi
     * sta in mezzo non sappia gia', e all'app serve il `motivo` per portare
     * alla pagina Premium invece di dire «non trovo la casa». */
    if (String(da).startsWith("centralino") && this._soloInCasa()) {
      this._no(presa, "con gdahome Base questa casa si apre solo da casa", {
        motivo: MOTIVO.premium,
      });
      return;
    }

    const chi = String(detto.chi ?? "");
    const chiave = this.dispositivi.chiaveDi(chi);
    if (!chiave) {
      /* Un telefono staccato, di cui la casa ha ancora la chiave: glielo si
       * dice dentro il cifrato, dove l'app ci puo' credere. */
      const revocata = this.dispositivi.chiaveRevocataDi?.(chi);
      if (revocata) {
        this._diCheEStaccato(presa, { detto, apertura, chiave: revocata });
        return;
      }
      /* Detto senza dire *perche'*: un telefono che non c'e' e uno abbinato
       * prima delle chiavi sono la stessa cosa da fuori, e in tutti e due i
       * casi si riabbina. Dire quale dei due sarebbe dire a chi bussa a caso
       * quali identificativi esistono.
       *
       * `riabbina` invece va detto, ed e' una bandierina e non una frase
       * apposta: il telefono ci deve *fare* qualcosa. Ma e' in chiaro, e non
       * lo firma nessuno: l'app lo prende per un avviso, non per una
       * sentenza. La sentenza e' quella qui sopra. */
      this._no(presa, "riabbina questo telefono", { riabbina: true });
      return;
    }

    const mia = coppiaEffimera();
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

    presa.manda(JSON.stringify(this._pronto(mia, { daCasa })));
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
  _pronto(mia, { gzip = true, daCasa } = {}) {
    return {
      v: VERSIONE,
      pronto: true,
      mia: mia.pubblica.toString("base64"),
      ...(gzip ? { gzip: true } : {}),
      /* Che di qua gli eventi si sanno raggruppare. Al telefono serve per
       * dirlo in diagnostica: quanti messaggi sono arrivati, e in quante
       * buste — che passando dal centralino e' il numero che si paga. */
      mucchio: true,
      /* Se questo filo arriva dalla rete di casa. Lo legge l'app: con gdahome
       * Base un filo che arriva da fuori lo chiude lei, anche quando l'ha
       * aperto da un indirizzo che crede di casa (`da-casa.js`). */
      ...(typeof daCasa === "boolean" ? { da_casa: daCasa } : {}),
    };
  }

  /* ─── Il telefono staccato ───────────────────────────────────────────── */

  /* Si stringe la mano con la chiave che il telefono aveva, e dentro la
   * prima busta gli si dice quello che gli direbbe il ponte a un segno che
   * non vale piu'. L'app vecchia e quella nuova lo capiscono allo stesso
   * modo, perche' e' la stessa frase di Home Assistant. */
  _diCheEStaccato(presa, { detto, apertura, chiave }) {
    const mia = coppiaEffimera();
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
    presa.manda(JSON.stringify(this._pronto(mia, { gzip: false })));
    const cifrata = new PresaCifrata(presa, chiaveDiQuestoFilo);
    cifrata.manda(
      JSON.stringify({
        type: "auth_invalid",
        message: "questo telefono e' stato staccato da questa casa: riabbinalo",
      }),
    );
    cifrata.chiudi(CHIUSA_PER_REGOLA, "staccato");
  }

  /* ─── L'abbinamento, dentro il cifrato ───────────────────────────────── */

  _perAbbinare(presa, { detto, apertura, da, abbina }) {
    /* Prima di tutto quello che non costa niente, e che non dice niente a chi
     * bussa oltre a quello che vede gia'. */
    if (!abbina) {
      this._no(presa, "da qui non ci si abbina", { motivo: MOTIVO.nessuno });
      return;
    }
    if (detto.abbina !== VERSIONE_DELL_ABBINAMENTO) {
      /* L'app di prima: `abbina: true`, una stretta di mano non legata al
       * codice. Non la si fa piu', e glielo si dice in modo che lo capisca
       * chi guarda lo schermo. */
      this._no(
        presa,
        "per abbinarsi a questa casa serve una versione piu' nuova dell'app: aggiorna l'app",
        { motivo: MOTIVO.aggiorna },
      );
      return;
    }
    /* I codici vivi: quello di tutti i giorni, e quello della casa di prova.
     * Uno basta. */
    const vivo = this.abbinamento.vivo();
    const prova = this._laProva();
    const codici = [
      ...(vivo ? [{ codice: vivo.codice, prova: false }] : []),
      ...(prova ? [{ codice: prova.codice, prova: true }] : []),
    ];
    if (!codici.length) {
      this._no(presa, "nessun codice di abbinamento e' attivo", { motivo: MOTIVO.nessuno });
      return;
    }
    if (this.abbinamento.bloccato(da)) {
      this.registro.attenzione(`troppi tentativi di abbinamento da ${da}`);
      this._no(presa, "troppi tentativi: riprova piu' tardi", { motivo: MOTIVO.tentativi });
      return;
    }

    /* Una chiave per codice, con la stessa chiave effimera: il `pronto` e'
     * uno solo, e il telefono ricava la sua dal codice che ha. */
    const mia = coppiaEffimera();
    let chiavi;
    try {
      chiavi = codici.map(({ codice }) =>
        chiaveDiSessione({
          miaPrivata: mia.privata,
          suaPubblica: detto.mia,
          delTelefono: Buffer.from(detto.mia, "base64"),
          dellaCasa: mia.pubblica,
          apertura,
          codice,
        }),
      );
    } catch (_errore) {
      this._no(presa, "stretta di mano sbagliata");
      return;
    }

    /* Niente gzip, in nessuno dei due versi: qui passano il segno e la
     * chiave, e una busta che si accorcia secondo quello che c'e' dentro non
     * serve a niente per quattro righe. */
    presa.manda(JSON.stringify(this._pronto(mia, { gzip: false })));

    const pubbliche = {
      telefono: String(detto.mia),
      casa: mia.pubblica.toString("base64"),
    };
    const timer = this._aTempo(presa, "la conferma dell'abbinamento non e' arrivata");
    let sentito = false;
    const cifrata = new PresaCifrata(presa, chiavi[0], {
      /* Le chiavi degli altri codici vivi, da provare sulla prima busta. */
      altre: chiavi.slice(1),
      /* Una busta che non si apre, qui, vuol dire quasi sempre un codice
       * sbagliato: chi l'ha chiusa aveva un altro codice, o nessuno. Si conta
       * come tale, e glielo si dice in chiaro — non c'e' una chiave in
       * comune con cui dirglielo in un altro modo. Non gli si dice altro. */
      onGuasta: () => {
        clearTimeout(timer);
        this.abbinamento.sbagliato(da);
        this.registro.attenzione(`codice di abbinamento sbagliato da ${da}`);
        presa.manda(JSON.stringify({ v: VERSIONE, no: "codice sbagliato", motivo: MOTIVO.codice }));
      },
    });
    /* `_laConferma` aspetta il Supervisor, quindi torna una promessa: se
     * scoppiasse, nessuno la guarderebbe e Node butterebbe giu' il ponte per
     * un errore non gestito. Chi ha chiesto un abbinamento merita un no, non
     * un add-on che si riavvia. */
    cifrata.onMessaggio = (dentro) => {
      if (sentito) return;
      sentito = true;
      clearTimeout(timer);
      /* La chiave che ha aperto la busta dice con quale codice e' arrivato. */
      const usato = codici[cifrata.quale] ?? codici[0];
      this._laConferma(cifrata, dentro, {
        da,
        codice: usato.codice,
        prova: usato.prova,
        pubbliche,
      }).catch((errore) => {
        this.registro.errore(`abbinamento andato storto: ${errore?.message || errore}`);
        cifrata.chiudi(1011, "");
      });
    };
    cifrata.onChiusa = () => clearTimeout(timer);
  }

  async _laConferma(cifrata, testo, { da, codice, prova = false, pubbliche }) {
    let detto;
    try {
      detto = JSON.parse(testo);
    } catch (_errore) {
      cifrata.chiudi(CHIUSA_PER_REGOLA, "non ho capito");
      return;
    }

    /* Le due chiavi pubbliche, come le ha viste il telefono. Sono gia' dentro
     * la chiave — se fossero diverse la busta non si sarebbe aperta — e
     * ripeterle qui lo rende scritto invece che sottinteso. */
    if (
      detto?.t !== "conferma" ||
      detto.telefono !== pubbliche.telefono ||
      detto.casa !== pubbliche.casa
    ) {
      this.abbinamento.sbagliato(da);
      cifrata.manda(
        JSON.stringify({ t: "no", perche: "conferma sbagliata", motivo: MOTIVO.codice }),
      );
      cifrata.chiudi(CHIUSA_PER_REGOLA, "conferma sbagliata");
      return;
    }

    let perChi = "";
    let finoA = null;
    try {
      if (prova) {
        /* Il codice della casa di prova non si spende: vale per piu'
         * telefoni, fino alla sua scadenza. Il telefono si intesta
         * all'utente scelto nella console, e scade col codice. */
        const entra = this._chiEntraDiProva(codice);
        perChi = entra.utente;
        finoA = entra.scadeIl;
      } else {
        /* Il codice e' quello con cui si e' stretta la mano, e il telefono
         * ha appena dimostrato di averlo. `consuma` lo spegne — un codice si
         * usa una volta — e dice **per chi** era: il telefono si intesta a
         * quello li', e da quel momento vede le plance che vede lui. Se nel
         * frattempo la console ne ha fatto un altro, questo non vale piu'. */
        perChi = this.abbinamento.consuma(codice, { da })?.utente || "";
      }
    } catch (errore) {
      if (errore instanceof TroppiTentativi) {
        cifrata.manda(
          JSON.stringify({
            t: "no",
            perche: "troppi tentativi: riprova piu' tardi",
            motivo: MOTIVO.tentativi,
          }),
        );
      } else if (errore instanceof CodiceSbagliato) {
        cifrata.manda(JSON.stringify({ t: "no", perche: "codice scaduto", motivo: MOTIVO.codice }));
      } else if (errore instanceof TroppiDispositivi) {
        cifrata.manda(JSON.stringify({ t: "no", perche: errore.message, motivo: MOTIVO.telefoni }));
      } else {
        cifrata.manda(JSON.stringify({ t: "no", perche: "non ha funzionato" }));
      }
      cifrata.chiudi(CHIUSA_PER_REGOLA, "codice rifiutato");
      return;
    }

    let abbinato;
    try {
      abbinato = this.dispositivi.abbina({
        nome: detto?.nome,
        sistema: detto?.sistema,
        utente: perChi,
        ...(finoA ? { finoA } : {}),
      });
    } catch (errore) {
      const telefoni = errore instanceof TroppiDispositivi;
      cifrata.manda(
        JSON.stringify({
          t: "no",
          perche: telefoni ? errore.message : "non ha funzionato",
          ...(telefoni ? { motivo: MOTIVO.telefoni } : {}),
        }),
      );
      cifrata.chiudi(1000, "abbinato");
      return;
    }

    const { dispositivo, segno, chiave } = abbinato;
    /* Il codice di tutti i giorni e' speso, e la sua attesa al centralino si
     * chiude; quella della casa di prova resta per il prossimo telefono. */
    if (!prova) this.chiamata?.chiudiLAbbinamento();
    this.registro.info(
      prova
        ? `abbinato «${dispositivo.nome}» da ${da}, col codice della casa di prova`
        : `abbinato «${dispositivo.nome}» da ${da}`,
    );
    /* Dove tornare. Chi si e' abbinato inquadrando un QR code non ha
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

  _soloInCasa() {
    try {
      return this.soloInCasa?.() === true;
    } catch (_errore) {
      return false;
    }
  }

  /* Chi entra col codice della casa di prova: l'utente e la scadenza.
   *
   * Si riguarda adesso, e non alla stretta di mano: in mezzo la console puo'
   * averlo revocato, o fatto scadere. E ha un tetto suo di telefoni
   * (`TELEFONI_DI_PROVA`), che non e' quello della casa. */
  _chiEntraDiProva(codice) {
    const ancora = this._laProva();
    if (!ancora || !stessoSegreto(impronta(ancora.codice), impronta(codice))) {
      throw new CodiceSbagliato("codice scaduto");
    }
    if ((this.dispositivi.quantiDiProva?.() ?? 0) >= TELEFONI_DI_PROVA) {
      throw new TroppiDispositivi(
        `con il codice di prova sono gia' entrati ${TELEFONI_DI_PROVA} telefoni`,
      );
    }
    return { utente: ancora.utente, scadeIl: ancora.scadeIl };
  }

  /* Il codice della casa di prova, se ce n'e' uno vivo. Un archivio che non
   * si legge vuol dire nessuno: l'abbinamento di tutti i giorni non deve
   * fermarsi per colpa sua. */
  _laProva() {
    try {
      return this.casaDiProva?.viva() ?? null;
    } catch (_errore) {
      return null;
    }
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
  /* `onGuasta`: chi vuole sapere di una busta che non si apre prima che il
   * filo si chiuda. Serve all'abbinamento, dove una busta cosi' e' un codice
   * sbagliato.
   *
   * `altre`: chiavi in piu' da provare sulla **prima** busta, se quella
   * principale non la apre. Serve ancora all'abbinamento, dove i codici vivi
   * possono essere due e il telefono non dice quale ha. La chiave che apre la
   * prima busta resta per tutto il filo, e `quale` dice qual era: 0 la
   * principale, 1 la prima delle altre, e cosi' via. Dopo la prima busta non
   * si prova piu' niente: un filo ha una chiave sola. */
  constructor(sotto, chiave, { comprime = false, onGuasta = null, altre = [] } = {}) {
    this.sotto = sotto;
    this.busta = new Busta(chiave, { io: "casa", comprime });
    this._altre = altre.map((una) => new Busta(una, { io: "casa", comprime }));
    this.quale = 0;
    this.viva = true;
    this._pezzi = "";
    /* Finche' non se ne e' aperta una, chi sta dall'altra parte non ha ancora
     * dimostrato niente: vedi `INTERO_PRIMA_DI_FIDARSI`. */
    this._fidata = false;
    this._onGuasta = onGuasta;
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
      if (this._pezzi.length > (this._fidata ? INTERO_MASSIMO : INTERO_PRIMA_DI_FIDARSI)) {
        this._pezzi = "";
        this.chiudi(CHIUSA_PER_REGOLA, "messaggio troppo grande");
      }
      return;
    }

    const intero = this._pezzi ? this._pezzi + testo : testo;
    this._pezzi = "";

    let dentro;
    try {
      dentro = this._apri(intero);
    } catch (errore) {
      if (!(errore instanceof BustaGuasta)) throw errore;
      try {
        this._onGuasta?.();
      } catch (_altro) {
        /* Chi ascolta ha sbagliato: si chiude lo stesso. */
      }
      this.chiudi(CHIUSA_PER_REGOLA, "busta guasta");
      return;
    }
    this._fidata = true;
    this._altre = [];
    try {
      this.onMessaggio(dentro);
    } catch (_errore) {
      this.chiudi(1011, "");
    }
  }

  /* Apre con la chiave del filo, e — finche' non se n'e' aperta nessuna —
   * con le altre. Una busta che non si apre si prova con tutte prima di
   * dirla guasta; una busta fuori ordine e' fuori ordine per tutte. */
  _apri(intero) {
    try {
      return this.busta.apri(intero);
    } catch (errore) {
      if (!(errore instanceof BustaGuasta) || this._fidata) throw errore;
      for (let i = 0; i < this._altre.length; i += 1) {
        let dentro;
        try {
          dentro = this._altre[i].apri(intero);
        } catch (altro) {
          if (!(altro instanceof BustaGuasta)) throw altro;
          continue;
        }
        this.busta = this._altre[i];
        this.quale = i + 1;
        return dentro;
      }
      throw errore;
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
