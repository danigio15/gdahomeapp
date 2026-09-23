/* Una casa, e i telefoni che la stanno guardando.
 *
 * Tutto quello che riguarda una casa sta qui dentro: il filo che lei tiene
 * aperto verso il centralino, e un canale per ogni telefono. Due case non si
 * vedono, non si aspettano e non si rallentano.
 *
 * ─── Dormire ─────────────────────────────────────────────────────────────
 *
 * I fili si accettano con `acceptWebSocket`, non con `accept`. La differenza
 * e' tutta la ragione per cui questa cosa e' gratis: cosi' li tiene aperti
 * Cloudflare, e **questo oggetto smette di esistere** finche' non arriva un
 * messaggio. Una casa ferma di notte non costa niente. Il prezzo e' che fra un
 * messaggio e l'altro non si puo' ricordare niente a memoria: quello che serve
 * si scrive addosso al filo — `serializeAttachment` — o nel proprio archivio.
 * Ogni variabile d'istanza qui dentro sarebbe un difetto che si vede solo
 * dopo, quando la casa e' rimasta zitta abbastanza a lungo.
 *
 * ─── Il colpetto a cui si risponde nel sonno ─────────────────────────────
 *
 * La casa manda un colpetto ogni mezzo minuto — le serve per accorgersi dei
 * fili che muoiono senza cadere, vedi `ponte/src/chiamata.js`. Se a
 * rispondergli fosse `webSocketMessage` sveglierebbe questo oggetto due volte
 * al minuto, per sempre, e una casa ferma di notte smetterebbe di costare
 * niente.
 *
 * `setWebSocketAutoResponse` risponde al posto nostro: e' Cloudflare a
 * riconoscere quel messaggio esatto e a rimandare la risposta, senza che
 * l'oggetto si svegli. Il filo resta caldo, il router di casa tiene la sua
 * riga, e qui non gira niente.
 *
 * ─── Chi e' un filo ──────────────────────────────────────────────────────
 *
 * Le targhette dicono chi e': `casa` per il filo della casa, `telefono` e
 * `c<numero>` per i telefoni. Servono anche a instradare, che e' l'unica cosa
 * che questo oggetto fa davvero: un messaggio con dentro `c: 5` va al filo con
 * la targhetta `c5`, senza che nessuno abbia guardato cosa c'e' scritto.
 *
 * ─── La casa vera e quella che bussa ──────────────────────────────────────
 *
 * Un filo `casa` appena arrivato non e' ancora la casa: e' qualcuno che dice
 * di esserlo. Lo diventa col `sono-io`, che porta il segreto. Fino a quel
 * momento non tocca niente — la casa vera, se c'e', resta dov'e', e i telefoni
 * continuano a passare da lei — e se non si presenta entro poco viene chiuso.
 * Le targhette di un filo non si cambiano dopo averlo accettato, quindi «e'
 * entrata» sta addosso al filo (`entrata` nel suo allegato), e i telefoni si
 * mandano solo a quella che lo porta.
 */

import { impronta, stessaImpronta } from "./segreti.js";
import { quelCodice, quelFreno } from "./dove.js";
import { CASA_VALIDA, IMPRONTA_VALIDA } from "./nomi.js";
import {
  ALLEGATO_MASSIMO,
  GitHub,
  GitHubNonRisponde,
  RichiestaSbagliata,
  Segnalazioni,
} from "./segnalazioni.js";

/* Un corpo piu' grande di cosi' non e' una segnalazione. */
const CORPO_MASSIMO = 64 * 1024;

/* Quanti telefoni insieme puo' avere una casa. Oltre non e' una famiglia. */
const TELEFONI_PER_CASA = 20;

/* Quello che puo' mandare un telefono in un messaggio solo, e quanto puo'
 * pesare la busta in cui arriva alla casa.
 *
 * Il messaggio del telefono va alla casa dentro una busta JSON, e dentro una
 * stringa JSON ogni virgoletta diventa due caratteri e un carattere di
 * controllo sei. Il ponte chiude il filo oltre il megabyte: una busta troppo
 * grossa avrebbe staccato la casa, e con lei tutti gli altri telefoni. I
 * pezzi del ponte sono da 512 KB; 600 KB lasciano il margine. */
export const MESSAGGIO_DEL_TELEFONO = 600 * 1024;
const BUSTA_MASSIMA = 1024 * 1024;

/* Quanto aspetta una casa appena arrivata prima di presentarsi, e un telefono
 * prima di dire la prima parola. Tutti e due parlano subito: chi resta zitto
 * cosi' a lungo non e' lento, occupa un posto. */
export const ATTESA = 15_000;

/* Quanti fili possono bussare come «casa» senza essersi ancora presentati.
 * Oltre, se ne va il piu' vecchio: la casa vera si presenta in un attimo. */
const IN_ATTESA_MASSIME = 8;

/* Una casa che non si fa vedere da sei mesi se ne va, e con lei quello che
 * questo oggetto teneva — l'impronta, le segnalazioni. L'ora dell'ultima
 * visita si scrive al piu' una volta al giorno: scrivere costa. */
export const SILENZIO_MASSIMO = 180 * 24 * 60 * 60 * 1000;
const VISITA_SUL_DISCO = 24 * 60 * 60 * 1000;

/* Quante case nuove all'ora, da un indirizzo e in tutto; quante scritture
 * verso GitHub all'ora, da un indirizzo e in tutto. I conti in tutto li
 * tiene un oggetto solo, il freno: da dentro una casa le altre non si
 * vedono. Si cambiano dalle variabili del Worker. */
const CASE_NUOVE_PER_INDIRIZZO = 20;
const CASE_NUOVE_IN_TUTTO = 500;
const SCRITTURE_PER_INDIRIZZO = 90;
const SCRITTURE_IN_TUTTO = 600;

/* Il tetto delle scritture in tutto vale solo per le case giovani: chi
 * volesse riempirlo lo farebbe con case nuove, che costano poco, e non deve
 * poter fermare quelle che scrivono da mesi. Una casa nata da piu' di una
 * settimana — o da prima che si tenesse la data — ha solo il suo limite e
 * quello della sua rete. */
const CASA_ANZIANA = 7 * 24 * 60 * 60 * 1000;

/* «Non per la rete, per la politica»: chi lo riceve lo legge come definitivo e
 * smette di riprovare, invece di girare a vuoto per sempre. */
const PER_REGOLA = 1008;
const NORMALE = 1000;
/* «Solo testo», «troppo grande», «riprova piu' tardi». L'ultimo il ponte lo
 * legge come una caduta qualunque, e ribussa con calma. */
const SOLO_TESTO = 1003;
const TROPPO_GRANDE = 1009;
const RIPROVA_PIU_TARDI = 1013;

const suoDi = (presa) => {
  try {
    return presa.deserializeAttachment() ?? {};
  } catch (_errore) {
    return {};
  }
};

const chiudi = (presa, codice, perche) => {
  try {
    presa.close(codice, perche);
  } catch (_errore) {
    /* Gia' chiusa. */
  }
};

const pesoInByte = (testo) =>
  testo.length * 3 <= BUSTA_MASSIMA ? testo.length : new TextEncoder().encode(testo).length;

const numeroDa = (testo, difetto) => {
  const numero = Number(testo);
  return testo !== undefined && testo !== "" && Number.isFinite(numero) && numero >= 0
    ? numero
    : difetto;
};

/* Il colpetto: uguale all'andata e al ritorno, e scritto qui una volta sola —
 * la coppia della risposta automatica confronta il testo **esatto**, quindi
 * fabbricarlo con `JSON.stringify` in due posti sarebbe un modo elegante di
 * romperlo il giorno che uno dei due mette uno spazio. */
const COLPETTO = '{"t":"battito"}';

export class Casa {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  /* ─── Chi arriva ──────────────────────────────────────────────────────── */

  async fetch(richiesta) {
    /* Le segnalazioni arrivano in HTTP, dal ponte: non aprono
     * nessun filo, chiedono e ricevono una risposta. */
    if (richiesta.headers.get("Upgrade") !== "websocket") return this._http(richiesta);

    const via = new URL(richiesta.url).pathname;
    const da = richiesta.headers.get("cf-connecting-ip") || "?";
    const [alClient, mia] = Object.values(new WebSocketPair());

    const laCasa = /^\/casa\/([A-Za-z0-9_]+)$/.exec(via);
    if (laCasa) await this._accogliLaCasa(mia, laCasa[1], da);
    else
      await this._accogliUnTelefono(
        mia,
        da,
        via.startsWith("/abbinamento/") ? "abbinamento" : "telefono",
      );

    return new Response(null, { status: 101, webSocket: alClient });
  }

  /* La casa che e' entrata davvero, cioe' quella che si e' presentata col
   * segreto giusto. Le altre che bussano come «casa» non contano. */
  _laCasa(tranne = null) {
    return (
      this.state
        .getWebSockets("casa")
        .find(
          (una) =>
            una !== tranne &&
            (una.readyState === undefined || una.readyState === 1) &&
            suoDi(una).entrata === true,
        ) ?? null
    );
  }

  async _accogliLaCasa(presa, atteso, da = "?") {
    /* Chi arriva non butta fuori nessuno: prima si presenta. Una casa sola
     * per identificativo resta la regola — ma il posto lo prende col
     * `sono-io`, non bussando. Se no chiunque conoscesse l'identificativo di
     * una casa, che non e' un segreto, la staccherebbe a ogni tentativo. */
    const ora = Date.now();
    this.state.acceptWebSocket(presa, ["casa"]);
    this._rispondiAiColpetti();
    presa.serializeAttachment({ chi: "casa", atteso, entrata: false, arrivataIl: ora, da });

    const inAttesa = this.state
      .getWebSockets("casa")
      .filter((una) => una !== presa && suoDi(una).entrata !== true)
      .sort((una, altra) => (suoDi(una).arrivataIl || 0) - (suoDi(altra).arrivataIl || 0));
    while (inAttesa.length >= IN_ATTESA_MASSIME) {
      chiudi(inAttesa.shift(), NORMALE, "troppe case in attesa");
    }
    await this._sveglia(ora + ATTESA);
  }

  /* L'allarme di questo oggetto e' uno solo, e serve a due cose: chiudere chi
   * e' rimasto zitto oltre il suo tempo, e mandare via una casa sparita da
   * mesi. Si sposta solo in avanti verso adesso, mai indietro. */
  async _sveglia(quando) {
    const gia = await this.state.storage.getAlarm();
    if (gia === null || gia === undefined || gia > quando) {
      await this.state.storage.setAlarm(quando);
    }
  }

  async alarm() {
    const ora = Date.now();
    let prossima = Infinity;

    for (const presa of this.state.getWebSockets("casa")) {
      const suo = suoDi(presa);
      if (suo.entrata === true) continue;
      const scade = (suo.arrivataIl || 0) + ATTESA;
      if (scade <= ora) chiudi(presa, NORMALE, "non ti sei presentata in tempo");
      else prossima = Math.min(prossima, scade);
    }
    for (const presa of this.state.getWebSockets("telefono")) {
      const suo = suoDi(presa);
      if (suo.parlato !== false) continue;
      const scade = (suo.arrivatoIl || 0) + ATTESA;
      if (scade <= ora) chiudi(presa, NORMALE, "nessuna parola dal telefono");
      else prossima = Math.min(prossima, scade);
    }

    const vista = await this.state.storage.get("vistaIl");
    if (typeof vista === "number") {
      if (ora - vista > SILENZIO_MASSIMO && !this._laCasa()) {
        /* Sparita da sei mesi e nessuno sul filo: si dimentica tutto. Se
         * tornasse, si ripresenta e rinasce, come la prima volta. */
        await this.state.storage.deleteAll();
        await this.state.storage.deleteAlarm?.();
        return;
      }
      prossima = Math.min(prossima, Math.max(vista + SILENZIO_MASSIMO, ora + VISITA_SUL_DISCO));
    }
    if (prossima !== Infinity) await this.state.storage.setAlarm(prossima);
  }

  /* `via` dice alla casa da quale porta e' entrato il telefono, come nel
   * centralino in Node: l'abbinamento si accetta solo da `/abbinamento/…`. */
  async _accogliUnTelefono(presa, da, via = "telefono") {
    /* Prima di scrivere qualunque cosa si guarda se la casa c'e': un telefono
     * che bussa a una casa che non esiste, o che non e' collegata, non lascia
     * niente dietro di se' — nemmeno il numero del canale. */
    const casa = this._laCasa();
    if (!casa) {
      /* Detto com'e': «questa casa adesso non e' collegata». Non e' un
       * rifiuto, e il telefono deve riprovare fra poco invece di arrendersi. */
      presa.accept();
      presa.close(NORMALE, "casa non collegata");
      return;
    }
    if (this.state.getWebSockets("telefono").length >= TELEFONI_PER_CASA) {
      presa.accept();
      presa.close(NORMALE, "troppi telefoni su questa casa");
      return;
    }

    const numero = (await this.state.storage.get("prossimoCanale")) ?? 1;
    await this.state.storage.put("prossimoCanale", numero + 1);

    const ora = Date.now();
    this.state.acceptWebSocket(presa, ["telefono", `c${numero}`]);
    presa.serializeAttachment({ chi: "telefono", numero, arrivatoIl: ora, parlato: false });
    casa.send(JSON.stringify({ c: numero, t: "apri", da, via }));
    await this._sveglia(ora + ATTESA);
  }

  /* Il colpetto e la sua risposta. Si dichiara a ogni casa che arriva perche'
   * questo oggetto si dimentica tutto fra un risveglio e l'altro, e dichiarare
   * due volte la stessa coppia non costa niente. */
  _rispondiAiColpetti() {
    const Coppia = globalThis.WebSocketRequestResponsePair;
    if (typeof Coppia !== "function") return;
    try {
      this.state.setWebSocketAutoResponse(new Coppia(COLPETTO, COLPETTO));
    } catch (_errore) {
      /* Un runtime che non lo sa fare: si risponde svegliandosi, sotto. */
    }
  }

  /* ─── Quello che passa ────────────────────────────────────────────────── */

  async webSocketMessage(presa, messaggio) {
    const suo = suoDi(presa);

    if (suo.chi === "telefono") {
      if (suo.parlato === false) presa.serializeAttachment({ ...suo, parlato: true });
      /* Il telefono parla in testo, sempre: un telaio binario non e' suo. */
      if (typeof messaggio !== "string") {
        chiudi(presa, SOLO_TESTO, "solo testo");
        return;
      }
      if (messaggio.length > MESSAGGIO_DEL_TELEFONO) {
        chiudi(presa, TROPPO_GRANDE, "messaggio troppo grande");
        return;
      }
      /* Byte, e si spostano. Qui dentro non si guarda mai. */
      const casa = this._laCasa();
      if (!casa) return;
      const busta = JSON.stringify({ c: suo.numero, t: "d", m: messaggio });
      if (pesoInByte(busta) > BUSTA_MASSIMA) {
        chiudi(presa, TROPPO_GRANDE, "messaggio troppo grande");
        return;
      }
      casa.send(busta);
      return;
    }
    if (suo.chi !== "casa") return;
    if (typeof messaggio !== "string") return;

    /* Il ripiego, per un runtime che non sa rispondere da solo: si risponde
     * qui, svegliandosi. Meglio svegliarsi che lasciar morire il filo. */
    if (messaggio === COLPETTO) {
      presa.send(COLPETTO);
      return;
    }

    let detto;
    try {
      detto = JSON.parse(messaggio);
    } catch (_errore) {
      this._rifiuta(presa, "non ho capito");
      return;
    }
    if (!detto || typeof detto !== "object") {
      this._rifiuta(presa, "non ho capito");
      return;
    }

    if (!suo.entrata) {
      await this._siPresenta(presa, suo, detto);
      return;
    }

    switch (detto.t) {
      case "apri-abbinamento":
        await this._apriUnAbbinamento(suo, detto.impronta);
        return;
      case "chiudi-abbinamento":
        await this._chiudiGliAbbinamenti();
        return;
      case "d":
        this._versoIlTelefono(detto.c, detto.m);
        return;
      case "chiudi":
        this._chiudiIlCanale(detto.c, "la casa ha chiuso");
        return;
      default:
        /* Roba che non si conosce si lascia perdere: una casa piu' nuova del
         * centralino puo' dire cose che qui non si sanno ancora, e non e' un
         * motivo per buttarla fuori. */
        return;
    }
  }

  async _siPresenta(presa, suo, detto) {
    if (detto.t !== "sono-io") {
      this._rifiuta(presa, "prima bisogna presentarsi");
      return;
    }
    /* L'identificativo dell'indirizzo e quello del messaggio devono essere lo
     * stesso. Se non lo fossero, una casa potrebbe farsi consegnare l'oggetto
     * di un'altra e poi presentarsi con il proprio nome, e quello che si
     * ritroverebbe in mano sarebbero i telefoni dell'altra. */
    if (!CASA_VALIDA.test(String(detto.casa ?? "")) || detto.casa !== suo.atteso) {
      this._rifiuta(presa, "non ti riconosco");
      return;
    }

    if (typeof detto.segreto !== "string" || detto.segreto.length < 32) {
      this._rifiuta(presa, "non ti riconosco");
      return;
    }

    const sua = await impronta(detto.segreto);
    const conosciuta = await this.state.storage.get("impronta");
    if (conosciuta === undefined) {
      /* La prima casa che si presenta con questo identificativo se lo prende.
       * Sono centoventotto bit di caso scelti dal ponte: nessuno li indovina,
       * e nessuno li registra da qualche parte prima.
       *
       * Ma di case nuove ne nascono poche all'ora: ognuna e' un oggetto con
       * dentro qualcosa, per sei mesi. Oltre il conto non si dice «no» — il
       * ponte smetterebbe per sempre — si chiude come una caduta, e lui
       * ribussa piu' tardi. */
      const avanti = await this._frenoConcede("casa", suo.da, {
        perChi: numeroDa(this.env?.CASE_NUOVE_PER_INDIRIZZO, CASE_NUOVE_PER_INDIRIZZO),
        inTutto: numeroDa(this.env?.CASE_NUOVE_IN_TUTTO, CASE_NUOVE_IN_TUTTO),
      });
      if (!avanti) {
        chiudi(presa, RIPROVA_PIU_TARDI, "troppe case nuove: riprova piu' tardi");
        return;
      }
      await this.state.storage.put({ impronta: sua, natoIl: Date.now() });
    } else if (!stessaImpronta(conosciuta, sua)) {
      this._rifiuta(presa, "non ti riconosco");
      return;
    }

    /* Una casa sola per identificativo. Chi arriva secondo prende il posto del
     * primo, e non il contrario: il primo puo' essere un filo morto che
     * nessuno ha ancora dichiarato tale, e la casa vera che si riaggancia non
     * deve restare fuori per colpa del proprio fantasma. Ma il posto si
     * prende **adesso**, a segreto verificato, e non quando si bussa. */
    for (const vecchia of this.state.getWebSockets("casa")) {
      const sua = suoDi(vecchia);
      if (vecchia !== presa && sua.entrata === true) {
        /* Prima si toglie il segno, poi si chiude: fra le due cose il filo
         * vecchio non deve piu' ricevere niente. */
        try {
          vecchia.serializeAttachment({ ...sua, entrata: false, sostituita: true });
        } catch (_errore) {
          /* Gia' chiusa. */
        }
        chiudi(vecchia, NORMALE, "questa casa si e' ricollegata");
      }
    }

    presa.serializeAttachment({ ...suo, entrata: true });
    presa.send(JSON.stringify({ t: "bene" }));

    const ora = Date.now();
    const vista = await this.state.storage.get("vistaIl");
    if (typeof vista !== "number" || ora - vista > VISITA_SUL_DISCO) {
      await this.state.storage.put("vistaIl", ora);
      await this._sveglia(ora + SILENZIO_MASSIMO);
    }
  }

  /* Chiede al freno — un oggetto solo, per tutto il centralino — se c'e'
   * ancora posto. Senza freno configurato, o se il freno non risponde, si
   * lascia passare: e' un limite di velocita', e non deve diventare il motivo
   * per cui le case non entrano. */
  async _frenoConcede(cosa, chi, { perChi, inTutto }) {
    if (!this.env?.FRENO) return true;
    try {
      const risposta = await quelFreno(this.env).fetch("https://centralino/concedi", {
        method: "POST",
        body: JSON.stringify({ cosa, chi: String(chi || "?"), perChi, inTutto }),
      });
      const { si } = await risposta.json();
      return si !== false;
    } catch (errore) {
      console.error(`il freno non risponde: ${errore?.stack || errore}`);
      return true;
    }
  }

  /* ─── Gli abbinamenti ─────────────────────────────────────────────────── */

  async _apriUnAbbinamento(suo, impronta) {
    if (typeof impronta !== "string" || !IMPRONTA_VALIDA.test(impronta)) return;
    await this._chiudiGliAbbinamenti();
    const risposta = await quelCodice(this.env, impronta).fetch("https://centralino/apri", {
      method: "POST",
      body: JSON.stringify({ casa: suo.atteso }),
    });
    /* Il codice dice di no quando quell'impronta e' gia' di un'altra casa, e
     * ancora viva: allora qui non si segna niente, e non si chiude quello
     * che non e' nostro. */
    if (risposta?.status === 409) return;
    await this.state.storage.put("abbinamento", impronta);
  }

  async _chiudiGliAbbinamenti() {
    const vecchia = await this.state.storage.get("abbinamento");
    if (!vecchia) return;
    await this.state.storage.delete("abbinamento");
    await quelCodice(this.env, vecchia).fetch("https://centralino/chiudi", {
      method: "POST",
    });
  }

  /* ─── I canali ────────────────────────────────────────────────────────── */

  _versoIlTelefono(numero, messaggio) {
    if (typeof numero !== "number" || typeof messaggio !== "string") return;
    const telefono = this.state.getWebSockets(`c${numero}`)[0];
    if (telefono) telefono.send(messaggio);
  }

  _chiudiIlCanale(numero, perche) {
    if (typeof numero !== "number") return;
    const telefono = this.state.getWebSockets(`c${numero}`)[0];
    if (telefono) telefono.close(NORMALE, perche);
  }

  /* ─── Quando qualcuno se ne va ────────────────────────────────────────── */

  async webSocketClose(presa) {
    await this._finita(presa);
  }

  async webSocketError(presa) {
    await this._finita(presa);
  }

  async _finita(presa) {
    const suo = suoDi(presa);

    if (suo.chi === "telefono") {
      const casa = this._laCasa();
      if (casa) casa.send(JSON.stringify({ c: suo.numero, t: "chiudi" }));
      return;
    }
    if (suo.chi !== "casa") return;
    /* Se ne va una che bussava senza essersi presentata: non era la casa, e
     * i telefoni non c'entrano. Se ne va una vecchia mentre quella nuova e'
     * gia' entrata: nemmeno. */
    if (suo.entrata !== true) return;
    if (this._laCasa(presa)) return;

    /* I telefoni non restano appesi a una casa che non c'e' piu': meglio che
     * si accorgano subito e ribussino, invece di parlare nel vuoto. */
    for (const telefono of this.state.getWebSockets("telefono")) {
      try {
        telefono.close(NORMALE, "la casa si e' scollegata");
      } catch (_errore) {
        /* Gia' chiusa. */
      }
    }
    await this._chiudiGliAbbinamenti();
  }

  /* ─── Le segnalazioni ─────────────────────────────────────────────────── */

  /* La casa si presenta col suo segreto — lo stesso della chiamata — e
   * ottiene le sue issue, e solo le sue. Chi non si e' mai presentato dal
   * filo non ha ancora un'impronta qui, e non entra: prima la casa si
   * collega, poi scrive. */
  async _http(richiesta) {
    const via = new URL(richiesta.url).pathname;
    const pezzi =
      /^\/casa\/([A-Za-z0-9_]+)\/segnalazioni(?:\/(\d+))?(?:\/(risposte|allegati))?$/.exec(via);
    if (!pezzi)
      return rispostaJson({ errore: "non_trovato", spiegazione: "qui non c'e' niente" }, 404);
    const [, casa, numero, coda] = pezzi;

    const segreto = /^Casa (.+)$/.exec(richiesta.headers.get("authorization") || "")?.[1];
    if (!segreto) {
      return rispostaJson(
        { errore: "senza_segreto", spiegazione: "serve il segreto della casa" },
        401,
      );
    }
    const conosciuta = await this.state.storage.get("impronta");
    if (conosciuta === undefined || !stessaImpronta(conosciuta, await impronta(segreto))) {
      return rispostaJson({ errore: "non_ti_riconosco", spiegazione: "non ti riconosco" }, 403);
    }

    const github = new GitHub({
      token: this.env.GITHUB_SEGNALAZIONI,
      repo: this.env.GITHUB_REPO,
      repoAllegati: this.env.GITHUB_REPO_ALLEGATI,
      ramoAllegati: this.env.GITHUB_RAMO_ALLEGATI,
    });
    const nata = await this.state.storage.get("natoIl");
    const anziana = typeof nata !== "number" || Date.now() - nata >= CASA_ANZIANA;
    const segnalazioni = new Segnalazioni({
      storage: this.state.storage,
      github,
      casa,
      chi: richiesta.headers.get("cf-connecting-ip") || "?",
      freno: (chi) =>
        this._frenoConcede("scrittura", chi, {
          perChi: numeroDa(this.env?.SCRITTURE_PER_INDIRIZZO, SCRITTURE_PER_INDIRIZZO),
          inTutto: anziana ? null : numeroDa(this.env?.SCRITTURE_IN_TUTTO, SCRITTURE_IN_TUTTO),
        }),
    });
    const metodo = richiesta.method;
    try {
      if (!numero && !coda && metodo === "GET") {
        return rispostaJson({ segnalazioni: await segnalazioni.elenco() });
      }
      if (!numero && !coda && metodo === "POST") {
        return rispostaJson(await segnalazioni.crea(await corpoDi(richiesta)), 201);
      }
      if (numero && !coda && metodo === "GET") {
        return rispostaJson(await segnalazioni.leggi(Number(numero)));
      }
      if (numero && coda === "risposte" && metodo === "POST") {
        const { testo } = await corpoDi(richiesta);
        return rispostaJson(await segnalazioni.rispondi(Number(numero), testo));
      }
      if (numero && coda === "allegati" && metodo === "POST") {
        return rispostaJson(
          await segnalazioni.allega(Number(numero), await allegatoDi(richiesta)),
          201,
        );
      }
      return rispostaJson({ errore: "non_trovato", spiegazione: "qui non c'e' niente" }, 404);
    } catch (errore) {
      if (errore instanceof RichiestaSbagliata) {
        return rispostaJson({ errore: errore.codice, spiegazione: errore.message }, errore.stato);
      }
      if (errore instanceof GitHubNonRisponde) {
        return rispostaJson(
          {
            errore: "github",
            spiegazione: `GitHub ha risposto ${errore.stato}: ${errore.message}`,
          },
          502,
        );
      }
      /* Il motivo vero va nel registro del Worker, non nella risposta: quello
       * che esce di qui lo legge chiunque bussi. */
      console.error(`le segnalazioni sono inciampate: ${errore?.stack || errore}`);
      return rispostaJson(
        {
          errore: "centralino",
          spiegazione: "Il centralino ha avuto un problema: riprova fra poco.",
        },
        500,
      );
    }
  }

  /* Rifiutare **dicendolo**.
   *
   * Chiudere e basta sarebbe la cosa peggiore: il ponte vedrebbe un filo
   * caduto, che e' quello che succede mille volte al giorno per colpa della
   * rete, e ribusserebbe all'infinito senza capire. Un rifiuto e' un'altra
   * cosa da una caduta — non passera' col tempo — e va detto, cosi' chi lo
   * riceve puo' smettere e scriverlo nel proprio registro. */
  _rifiuta(presa, perche) {
    try {
      presa.send(JSON.stringify({ t: "no", perche }));
      presa.close(PER_REGOLA, perche);
    } catch (_errore) {
      /* Gia' chiusa. */
    }
  }
}

function rispostaJson(corpo, stato = 200) {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/* Un allegato: il file cosi' com'e' nel corpo, il tipo nel `content-type`,
 * il nome in un'intestazione. Niente JSON, niente base64: dieci megabyte
 * passano una volta sola. */
async function allegatoDi(richiesta) {
  const dichiarato = Number(richiesta.headers.get("content-length") || 0);
  if (dichiarato > ALLEGATO_MASSIMO)
    throw new RichiestaSbagliata("troppo_grande", "L'allegato e' troppo grande.", 413);
  const byte = new Uint8Array(await richiesta.arrayBuffer());
  if (byte.length > ALLEGATO_MASSIMO)
    throw new RichiestaSbagliata("troppo_grande", "L'allegato e' troppo grande.", 413);
  return {
    nome: richiesta.headers.get("x-gdahome-nome") || "allegato",
    tipo: (richiesta.headers.get("content-type") || "").split(";")[0].trim(),
    byte,
  };
}

async function corpoDi(richiesta) {
  const testo = await richiesta.text();
  if (testo.length > CORPO_MASSIMO)
    throw new RichiestaSbagliata("troppo_grande", "Il corpo e' troppo grande.", 413);
  if (!testo.trim()) return {};
  try {
    const letto = JSON.parse(testo);
    return letto && typeof letto === "object" ? letto : {};
  } catch (_errore) {
    throw new RichiestaSbagliata("non_json", "Il corpo non e' JSON.", 400);
  }
}
