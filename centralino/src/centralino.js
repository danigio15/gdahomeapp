/* Il centralino: la cosa che fa incontrare un telefono e la sua casa.
 *
 *      il telefono                                    la casa
 *           │                                            │
 *           │  wss://…/telefono/casa_9f3a…               │  wss://…/casa
 *           └──────────────►  ┌──────────────┐  ◄────────┘
 *                             │  centralino  │   (chiama lei, sempre)
 *                             └──────────────┘
 *
 * **La casa chiama fuori.** E' tutto il punto. Non c'e' nessuna porta da
 * aprire sul router, nessun indirizzo pubblico da avere, nessuna VPN da
 * installare: la casa apre lei un filo verso qui e lo tiene aperto, e i
 * telefoni arrivano da questa parte.
 *
 * Su quel filo solo ci stanno tutti i telefoni di quella casa, uno per canale.
 *
 * ─── Quello che il centralino NON fa, ed e' la parte importante ───────────
 *
 * Non verifica niente che sia un segreto. Non sa se un codice di abbinamento
 * e' giusto — instrada sulla sua *impronta*, e il codice non lo vede mai. Non
 * sa se il segno di un telefono e' buono: lo passa alla casa, che lo verifica
 * lei. Non guarda dentro ai messaggi: sono byte, e li sposta.
 *
 * L'unica cosa che difende e' che una casa non possa spacciarsi per un'altra —
 * perche' se ci riuscisse raccoglierebbe i segni dei telefoni che bussano — e
 * per quello c'e' `case.js`.
 *
 * ─── La licenza ───────────────────────────────────────────────────────────
 *
 * Entrare da fuori casa e' gdahome Premium (`docs/LICENZE.md`). La casa dice
 * al centralino il suo gettone — appena entrata, e ogni volta che il quadro
 * gliene da' uno nuovo — con `{"t": "licenza", "tipo": "licenza", "gettone":
 * "…"}` sul suo filo; il centralino lo verifica con la chiave pubblica di
 * `chiave-licenze.js` e si ricorda fino a quando vale. Un telefono che bussa a
 * `/telefono/<casa>` di una casa senza un gettone gdahome valido si chiude con
 * `4402` e `premium-richiesto` — o con `4426` e `aggiorna-add-on`, se la casa
 * la licenza non l'ha mai detta: il suo add-on e' di prima, e li' Premium non
 * si puo' nemmeno comprare.
 *
 * Chi compra Premium fuori casa ha la casa chiusa proprio da qui: la sua
 * ricevuta la porta `POST /licenza/<casa>` (`portaLaRicevuta`), che la gira
 * alla casa sul suo filo e aspetta la risposta.
 *
 * Non cambia niente di quello che il centralino vede: il gettone e' una firma
 * del quadro, non un segreto, e i messaggi restano byte che si spostano.
 * L'abbinamento (`/abbinamento/…`) resta aperto a tutti. E con la chiave
 * vuota — com'e' di serie — il controllo e' spento: entrano tutti, come ieri.
 *
 * Quanto si fa sul serio lo dice `MODO_LICENZE` (`modo-delle-licenze.js`):
 * `spento`, `registra` — si verifica e si conta, ma entrano tutti — e
 * `impone`. Scrivere la chiave non basta piu' a chiudere: serve `impone`.
 *
 * ─── La porta dell'abbinamento non e' una porta di servizio ────────────────
 *
 * Da `/abbinamento/<impronta>` si arriva alla casa senza passare dalla
 * licenza, e deve restare cosi': chi inquadra il QR fuori casa si deve poter
 * abbinare. Ma il ponte, su quella porta, accetta anche la stretta di un
 * telefono gia' abbinato — non sa da quale porta sia entrato se non per
 * l'abbinamento — e un'impronta tenuta viva apposta (quella della casa di
 * prova vive sette giorni) sarebbe un fuori casa senza licenza.
 *
 * Quindi su quella porta: un canale vive al massimo qualche minuto — una
 * stretta di mano ne dura meno di uno — sempre; e con `impone` la prima
 * parola deve essere quella di chi si abbina (`abbina`, in chiaro come tutta
 * la stretta), le case di prova hanno un tetto per indirizzo e per giorno, e
 * gli abbinamenti insieme su una casa sono pochi. L'app vera su quella porta
 * non fa altro che abbinarsi, e nessuno di questi tetti la tocca.
 */

import { CASA_VALIDA } from "./case.js";
import { CHIAVE_PUBBLICA_LICENZE } from "./chiave-licenze.js";
import { valeFino, verificaGettone } from "./gettone.js";
import { ilModoDelleLicenze } from "./modo-delle-licenze.js";
import { CHIUSURA } from "./presa.js";

/* Quanti telefoni insieme puo' avere una casa. Oltre non e' una famiglia. */
const TELEFONI_PER_CASA = 20;

/* Quanto vive l'attesa di un abbinamento: la stessa finestra del codice. */
const ABBINAMENTO_VIVE = 6 * 60 * 1000;

/* Quanto puo' vivere, al massimo, l'attesa di una casa di prova: il codice
 * che una casa fa per chi rivede l'app, e che vale fino a sette giorni e per
 * piu' telefoni (`ponte/src/casa-di-prova.js`). La casa dice quanto le
 * manca; oltre questo tetto non si crede a nessuno. */
const PROVA_VIVE_AL_MASSIMO = 7 * 24 * 60 * 60 * 1000;

/* Quanto puo' restare aperto un canale entrato dalla porta dell'abbinamento.
 * La stretta di chi si abbina dura qualche secondo — il ponte aspetta quindici
 * secondi la prima parola e quindici la conferma, e poi chiude lui il canale
 * con «abbinato» — e il codice di tutti i giorni vive sei minuti. Dieci
 * bastano a tutto quello che e' un abbinamento, e a niente di quello che non
 * lo e'. Vale sempre: un'app vera non ci arriva nemmeno vicino. */
export const VITA_DEL_CANALE_DI_ABBINAMENTO = 10 * 60 * 1000;

/* Quante case di prova possono essere aperte insieme, in tutto. Le case di
 * prova sono quelle di chi rivede l'app per i negozi: una o due al mondo.
 * Il tetto e' per la memoria, e vale sempre. */
export const PROVE_IN_TUTTO = 1000;

/* E con `impone`: quante insieme da case collegate dallo stesso indirizzo, e
 * quante impronte nuove di prova una casa puo' aprire in un giorno. Una casa
 * vera ne fa una ogni tanto, dalla console; la stessa ridetta dopo una
 * caduta del filo non e' nuova. */
export const PROVE_PER_INDIRIZZO = 3;
export const PROVE_NUOVE_PER_CASA_AL_GIORNO = 10;
const GIORNO = 24 * 60 * 60 * 1000;

/* E quanti canali insieme dalla porta dell'abbinamento, per casa: insieme,
 * non in tutto. Col codice di prova entrano quanti telefoni servono, uno
 * dopo l'altro. */
export const ABBINAMENTI_INSIEME_PER_CASA = 5;

/* Chi bussa alla porta dell'abbinamento e non si abbina. 1008 e' «non per la
 * rete, per la politica». L'app vera non lo vede mai: da li' si abbina e
 * basta. */
export const SOLO_PER_ABBINARSI = Object.freeze({
  codice: 1008,
  motivo: "da qui ci si abbina e basta",
});

/* Un messaggio piu' lungo di cosi' non e' un comando a Home Assistant. */
export const MESSAGGIO_MASSIMO = 1024 * 1024;

/* Quello che puo' mandare un telefono, in un messaggio solo.
 *
 * Meno di quello della casa, e apposta: il messaggio del telefono non arriva
 * alla casa cosi' com'e', arriva **dentro una busta** — `{"c":…,"t":"d","m":…}`
 * — e dentro una stringa JSON ogni virgoletta diventa due caratteri, e un
 * carattere di controllo sei. Un messaggio da un megabyte poteva diventare una
 * busta da sei, e il ponte, che oltre il megabyte chiude il filo, avrebbe
 * chiuso **quello della casa**: un telefono solo staccava tutti gli altri.
 *
 * Il ponte spezza quello che manda in pezzi da 512 KB; 600 KB lasciano il
 * margine per la busta. E la busta si misura lo stesso, prima di partire:
 * quella che non ci sta chiude il telefono, non la casa. */
export const MESSAGGIO_DEL_TELEFONO = 600 * 1024;
const BUSTA_MASSIMA = MESSAGGIO_MASSIMO;

/* Quanto aspetta una casa appena arrivata prima di presentarsi, e un telefono
 * prima di dire la prima parola. Tutti e due parlano subito — la casa manda il
 * `sono-io` appena il filo e' aperto, il telefono la sua meta' della stretta —
 * quindi chi resta zitto cosi' a lungo non e' lento: occupa un posto. */
export const ATTESA_DELLA_PRESENTAZIONE = 15_000;
export const ATTESA_DELLA_PRIMA_PAROLA = 15_000;

/* Quanti fili aperti in tutto, e da uno stesso indirizzo. Il secondo e'
 * largo — dietro lo stesso indirizzo di un operatore mobile possono esserci
 * molti telefoni — ma non infinito. */
export const PRESE_IN_TUTTO = 10_000;
export const PRESE_PER_INDIRIZZO = 200;

/* Quanto puo' restare in coda, non ancora partito, verso un filo solo. Chi
 * non legge — un telefono che si e' fermato senza chiudere — farebbe
 * crescere la coda nella memoria del centralino finche' c'e' memoria. */
export const CODA_MASSIMA = 8 * 1024 * 1024;

/* «Non posso ora, riprova»: il ponte lo legge come una caduta qualunque e
 * ribussa con calma, invece di smettere per sempre come davanti a un no. */
const RIPROVA_PIU_TARDI = 1013;
/* «Questo tipo di dati non lo accetto»: un telefono manda testo, sempre. */
const DATI_NON_ACCETTATI = 1003;

/* Il telefono di una casa senza gdahome Premium. Il codice e il motivo sono
 * quelli del contratto (`docs/LICENZE.md`): l'app li riconosce e porta alla
 * pagina Premium invece di ribussare. I codici da 4000 in su sono delle
 * applicazioni, e 4402 ricorda il 402 di HTTP, «serve pagare». */
export const PREMIUM_RICHIESTO = Object.freeze({ codice: 4402, motivo: "premium-richiesto" });

/* Il telefono di una casa col suo add-on di prima delle licenze. Non serve
 * pagare, serve aggiornare: quella casa una licenza non la puo' tenere, e una
 * ricevuta non avrebbe dove arrivare. 4426 ricorda il 426 di HTTP, «Upgrade
 * Required». L'app lo riconosce, dice di aggiornare l'add-on in Home
 * Assistant, e a quella casa non vende niente. */
export const ADDON_DA_AGGIORNARE = Object.freeze({ codice: 4426, motivo: "aggiorna-add-on" });

/* Quanto aspetta una ricevuta la risposta della casa. La casa la porta al
 * quadro, e il quadro la chiede ad Apple o a Google: di solito due secondi,
 * con un negozio lento anche venti. */
export const ATTESA_DELLA_RICEVUTA = 60_000;

/* Quante ricevute insieme per una casa. Una famiglia che compra non ne manda
 * piu' di una; il tetto e' per chi bussa a ripetizione. */
const RICEVUTE_IN_VOLO = 3;

/* Ogni quanto il centralino manda un colpetto alle case, per accorgersi di
 * quelle che se ne sono andate senza dire niente — una casa dietro un router
 * che si riavvia non chiude un bel niente, resta li' aperta e muta. */
const BATTITO = 45_000;
const SILENZIO_MASSIMO = 150_000;

export class Centralino {
  constructor({
    case: case_,
    registro,
    adesso = () => Date.now(),
    attesaDellaPresentazione = ATTESA_DELLA_PRESENTAZIONE,
    attesaDellaPrimaParola = ATTESA_DELLA_PRIMA_PAROLA,
    preseInTutto = PRESE_IN_TUTTO,
    presePerIndirizzo = PRESE_PER_INDIRIZZO,
    codaMassima = CODA_MASSIMA,
    /* La chiave con cui si verificano i gettoni delle licenze. Vuota vuol
     * dire controllo spento. Si passa solo nelle prove. */
    chiaveLicenze = CHIAVE_PUBBLICA_LICENZE,
    /* `spento`, `registra` o `impone` (`modo-delle-licenze.js`). `index.js`
     * lo passa sempre, da `MODO_LICENZE`. Chi non lo passa — le prove, e chi
     * accende la classe da se' — ha il comportamento di prima: con la chiave
     * si impone, senza no. */
    modoLicenze = undefined,
    /* Le licenze tolte, chieste al quadro (`revoche.js`). Senza, decide solo
     * il gettone. */
    revoche = null,
    vitaDelCanaleDiAbbinamento = VITA_DEL_CANALE_DI_ABBINAMENTO,
    attesaDellaRicevuta = ATTESA_DELLA_RICEVUTA,
    /* Le notifiche delle case verso i loro telefoni (`spinte.js`). Senza, le
     * buste che le case mandano si lasciano cadere. */
    spinte = null,
  } = {}) {
    this.case = case_;
    this.spinte = spinte;
    this.chiaveLicenze = String(chiaveLicenze || "");
    this.revoche = revoche;
    this.vitaDelCanaleDiAbbinamento = vitaDelCanaleDiAbbinamento;
    /** Fino a quando una casa e' gdahome Premium, per identificativo.
     *
     * Sta qui e non sulla casa collegata: una casa che cade e si riaggancia
     * ridice il suo gettone appena rientra, ma fra la caduta e il rientro un
     * telefono non deve sentirsi dire «premium richiesto» — si sentirebbe
     * dire «casa non collegata», che e' la verita'. In memoria e basta: dopo
     * un riavvio del centralino ogni casa lo ridice rientrando. */
    this.premiumFino = new Map();
    /** E di quale licenza era il gettone, per le licenze tolte. */
    this.licenzaDi = new Map();
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.modoLicenze =
      modoLicenze === undefined
        ? this.chiaveLicenze
          ? "impone"
          : "spento"
        : ilModoDelleLicenze(modoLicenze, { chiave: this.chiaveLicenze, registro: this.registro });
    /** I conti di chi resterebbe fuori, o e' rimasto fuori: dall'accensione,
     * per `/salute`. Con `registra` sono quelli che `impone` avrebbe chiuso. */
    this.conti = {
      telefoniSenzaLicenza: 0,
      nonAbbinamenti: 0,
      abbinamentiDiTroppo: 0,
      proveRifiutate: 0,
    };
    /** Le impronte di prova che ogni casa ha aperto nell'ultimo giorno, con
     * quando: per il tetto di `PROVE_NUOVE_PER_CASA_AL_GIORNO`. */
    this.proveDelGiorno = new Map();
    this.adesso = adesso;
    this.attesaDellaPresentazione = attesaDellaPresentazione;
    this.attesaDellaPrimaParola = attesaDellaPrimaParola;
    this.preseInTutto = preseInTutto;
    this.presePerIndirizzo = presePerIndirizzo;
    this.codaMassima = codaMassima;
    this.attesaDellaRicevuta = attesaDellaRicevuta;

    /** Quanti fili aperti, in tutto e per indirizzo. */
    this.prese = 0;
    this.presePer = new Map();

    /** Le case collegate adesso, per identificativo. */
    this.collegate = new Map();
    /** Le attese di abbinamento vive, per impronta del codice: quelle del
     * codice di tutti i giorni, e quelle delle case di prova (`prova: true`). */
    this.abbinamenti = new Map();

    this._battito = setInterval(() => this._giroDiControllo(), BATTITO);
    this._battito.unref?.();
  }

  /* ─── I conti che si leggono dalla gestione ──────────────────────────
   *
   * Sono quattro, e vanno letti insieme perche' due contano **impianti** e due
   * contano **persone davanti a uno schermo**. Tenerli separati non e' un
   * vezzo: «140» accanto a un nome sbagliato e' un numero che decide dei
   * prezzi e delle scelte, e per un po' e' stato letto per quello che non era.
   *
   *   · [quanteInstallate]  quanti hanno installato l'add-on. E' un totale.
   *   · [quanteCase]        quanti ce l'hanno **acceso e collegato adesso**.
   *   · [quanteAppAperte]   quanti stanno guardando dall'app.
   *   · [quantiDalWeb]      quanti stanno guardando dal browser.
   *
   * I primi due sono impianti, gli altri due schermi, e uno stesso impianto
   * puo' avere tre schermi aperti o nessuno. */

  /* Quanti impianti hanno installato gdahome. Non e' un conto di adesso: e' il
   * registro delle case, cioe' ogni add-on che si e' presentato almeno una
   * volta e non e' stato zitto per sei mesi di fila (`case.js`, `potatura`).
   * E' l'unica cosa che somigli a «quante installazioni ci sono in giro», e
   * somiglia abbastanza: il filo verso il tramite lo apre ogni ponte da solo,
   * senza che nessuno configuri niente.
   *
   * Restano fuori — e vanno detti, perche' sono i casi in cui il numero e'
   * piu' piccolo del vero — chi ha spento `da_fuori_casa` e chi si e' messo un
   * tramite suo. */
  quanteInstallate() {
    return this.case?.quante?.() ?? 0;
  }

  /* E quanti di quegli impianti stanno funzionando **adesso**: il ponte ha il
   * filo aperto verso qui, quindi l'add-on gira e la casa vede internet.
   *
   * E' il numero piu' onesto che questa macchina possa dare su «installato e
   * funzionante», e ha un limite da dire: che Home Assistant risponda al ponte
   * qui non si sa. Quello lo sa il quadro, che riceve i rapporti. */
  quanteCase() {
    return this.collegate.size;
  }

  /* Quanti fili sono aperti adesso, in tutto.
   *
   * Si chiamava `quantiTelefoni`, e non erano telefoni: e' il numero di CANALI
   * aperti in questo istante. Lo stesso telefono con l'app aperta e una scheda
   * del browser ne tiene due, e ci finiscono dentro anche i fili di chi si sta
   * abbinando, che un telefono abbinato non lo e' ancora. Chi leggeva
   * «22 telefoni collegati» capiva «l'app e' su 22 telefoni», che e' un'altra
   * cosa e non e' vera.
   *
   * Resta perche' e' il totale — app + browser + abbinamenti in corso — e
   * perche' e' la somma che si confronta col tetto dei fili. Sulla pagina non
   * ci va piu': «collegamenti aperti» non diceva niente a nessuno. */
  quantiCollegamenti() {
    let quanti = 0;
    for (const casa of this.collegate.values()) quanti += casa.canali.size;
    return quanti;
  }

  /* Quanti stanno guardando dall'app, e quanti dal browser.
   *
   * Prima c'era un conto solo, e contava i fili entrati da `/telefono/<casa>`
   * — cioe' chi e' gia' abbinato, **qualunque cosa avesse in mano**. Si
   * chiamava «app aperte» e dentro c'era anche ogni scheda di browser: due
   * numeri diversi chiesti allo stesso conto.
   *
   * Adesso la differenza la dice chi apre il filo (`che`, in `server.js`), e i
   * due conti sono due. Gli abbinamenti in corso non stanno in nessuno dei
   * due: chi si sta abbinando non sta ancora guardando niente.
   *
   * Sono conti di **adesso**: quante persone hanno l'app aperta in questo
   * istante, non quante l'hanno installata. */
  quanteAppAperte() {
    return this._quantiCosi("app");
  }

  quantiDalWeb() {
    return this._quantiCosi("web");
  }

  /* Quante delle case collegate adesso sanno dire la loro licenza.
   *
   * E' il numero da guardare **prima** di scrivere la chiave delle licenze su
   * questa macchina, ed e' l'unico che dice se si puo'. Qui il controllo si
   * accende insieme alla chiave, e da quel momento una casa senza un gettone
   * valido si vede chiudere i telefoni che arrivano da fuori. Una casa con
   * l'add-on vecchio un gettone non ce l'ha e non sa nemmeno di doverlo
   * chiedere: si chiuderebbe fuori da sola, pagante o no.
   *
   * Finche' questo numero e' sotto `quanteCase()`, accendere qui vuol dire
   * togliere l'accesso da fuori a quella differenza di case. Vale zero
   * finche' nessuno ha l'add-on nuovo, ed e' giusto cosi': zero e' la
   * risposta vera, e dice di aspettare. */
  quantePronteAllaLicenza() {
    let quante = 0;
    for (const casa of this.collegate.values()) if (casa.dicelaLicenza) quante += 1;
    return quante;
  }

  /* Quante delle case collegate adesso dicono la licenza e non hanno un
   * gettone buono: quelle che con `impone` si sentono dire «serve Premium».
   * A licenze spente non lo sa nessuno — i gettoni non si guardano — e allora
   * `null`, che non e' zero. */
  quanteSenzaPremium() {
    if (this.modoLicenze === "spento") return null;
    let quante = 0;
    for (const casa of this.collegate.values())
      if (casa.dicelaLicenza && !this.ePremium(casa.id)) quante += 1;
    return quante;
  }

  /* Le licenze, per `/salute`: in che modo si lavora, e chi resterebbe fuori.
   *
   *   · `senza_premium`    collegate adesso, con l'add-on nuovo e senza un
   *                        gettone buono: con `impone`, `4402`;
   *   · `da_aggiornare`    collegate adesso con l'add-on di prima: con
   *                        `impone`, `4426` (e' `case` meno
   *                        `pronte_alla_licenza`);
   *   · `telefoni_senza_licenza`  dall'accensione, i telefoni arrivati a una
   *                        casa senza Premium: chiusi con `impone`, lasciati
   *                        passare con `registra`;
   *   · `non_abbinamenti`, `abbinamenti_di_troppo`, `prove_rifiutate`  la
   *                        porta dell'abbinamento usata per altro, o troppo:
   *                        chiusi con `impone`, contati e basta altrimenti;
   *   · `licenze_tolte`    quante licenze tolte ha detto il quadro, se le
   *                        chiede (`revoche.js`). */
  statoDelleLicenze() {
    const pronte = this.quantePronteAllaLicenza();
    return {
      modo: this.modoLicenze,
      senza_premium: this.quanteSenzaPremium(),
      da_aggiornare: this.quanteCase() - pronte,
      telefoni_senza_licenza: this.conti.telefoniSenzaLicenza,
      non_abbinamenti: this.conti.nonAbbinamenti,
      abbinamenti_di_troppo: this.conti.abbinamentiDiTroppo,
      prove_rifiutate: this.conti.proveRifiutate,
      licenze_tolte: this.revoche?.accese ? this.revoche.quante() : null,
    };
  }

  /* Se i tetti della porta dell'abbinamento chiudono davvero, o contano e
   * basta. */
  get impone() {
    return this.modoLicenze === "impone";
  }

  _quantiCosi(che) {
    let quanti = 0;
    for (const casa of this.collegate.values())
      for (const canale of casa.canali.values())
        if (canale.via === "telefono" && canale.che === che) quanti += 1;
    return quanti;
  }

  /* ─── Quanti fili ────────────────────────────────────────────────────── */

  /* Se c'e' posto per un filo in piu' da questo indirizzo. Si chiede prima
   * di rispondere alla stretta di mano: un filo che non c'e' posto per
   * tenere non si apre nemmeno. */
  cePostoPer(da) {
    if (this.prese >= this.preseInTutto) return false;
    return (this.presePer.get(da) || 0) < this.presePerIndirizzo;
  }

  /* Un filo in piu', e la funzione da chiamare quando se ne va. */
  unaPresaIn(da) {
    this.prese += 1;
    this.presePer.set(da, (this.presePer.get(da) || 0) + 1);
    let andata = false;
    return () => {
      if (andata) return;
      andata = true;
      this.prese -= 1;
      const quante = (this.presePer.get(da) || 1) - 1;
      if (quante > 0) this.presePer.set(da, quante);
      else this.presePer.delete(da);
    };
  }

  /* Mandare, ma non all'infinito: se chi sta dall'altra parte non legge e la
   * coda ha passato la soglia, il filo si chiude invece di crescere. */
  manda(presa, testo) {
    const inCoda = Number(presa?.socket?.writableLength || 0);
    if (inCoda > this.codaMassima) {
      presa.chiudi(RIPROVA_PIU_TARDI, "troppo indietro nel leggere");
      return false;
    }
    return presa.manda(testo);
  }

  /* ─── Una casa si presenta ───────────────────────────────────────────── */

  accogliUnaCasa(presa, { da = "?" } = {}) {
    const casa = new CasaCollegata(this, presa, da);
    casa.avvia();
    return casa;
  }

  /* Il telefono deve dire la prima parola entro poco, e deve dirla in testo.
   * Vale per tutti e due i modi di arrivare — alla propria casa o in
   * abbinamento — e si arma prima di cercare la casa, cosi' anche un canale
   * rifiutato non resta appeso. */
  _sorvegliaIlTelefono(presa) {
    const zitto = setTimeout(() => {
      presa.chiudi(CHIUSURA.normale, "nessuna parola dal telefono");
    }, this.attesaDellaPrimaParola);
    zitto.unref?.();
    return () => clearTimeout(zitto);
  }

  /* ─── Un telefono bussa ──────────────────────────────────────────────── */

  /* Il telefono dice a quale casa vuole nell'indirizzo, e non e' un segreto:
   * l'identificativo serve a instradare, il segno a entrare, e il segno viene
   * dopo — dentro il filo, verso la casa, che e' l'unica che lo puo'
   * verificare. */
  accogliUnTelefono(presa, { casa: idDellaCasa, da = "?", che = "" } = {}) {
    const casa = this.collegate.get(idDellaCasa);
    if (!casa) {
      /* Detto com'e': «questa casa adesso non e' collegata». Non e' un
       * rifiuto, e il telefono deve riprovare fra poco invece di arrendersi. */
      presa.chiudi(CHIUSURA.normale, "casa non collegata");
      return null;
    }
    /* Da fuori casa si entra con gdahome Premium. Dopo «casa non
     * collegata», e non prima: una casa che non c'e' non c'e', Premium o no,
     * e il telefono deve riprovare fra poco invece di arrendersi.
     *
     * E il no dice quale dei due: la casa col suo add-on nuovo ha bisogno di
     * Premium, quella con l'add-on di prima ha bisogno di aggiornarlo — li'
     * Premium non si puo' nemmeno comprare. */
    if (!this.ePremium(idDellaCasa)) {
      /* Con `registra` si conta e si lascia passare: e' il numero da
       * guardare prima di imporre. */
      this.conti.telefoniSenzaLicenza += 1;
      if (this.impone) {
        const no = casa.dicelaLicenza ? PREMIUM_RICHIESTO : ADDON_DA_AGGIORNARE;
        presa.chiudi(no.codice, no.motivo);
        return null;
      }
    }
    return casa.apriUnCanale(presa, da, this._sorvegliaIlTelefono(presa), "telefono", che);
  }

  /* ─── Le licenze ─────────────────────────────────────────────────────── */

  /* Se questa casa e' Premium per il centralino: un gettone buono, non
   * scaduto, di una licenza che il quadro non ha detto tolta. A licenze
   * spente si', sempre. Con `registra` la risposta e' vera ma non chiude
   * niente: chi decide se si entra e' `accogliUnTelefono`, col modo. */
  ePremium(idDellaCasa) {
    if (this.modoLicenze === "spento") return true;
    if (!((this.premiumFino.get(idDellaCasa) || 0) > this.adesso())) return false;
    return !this.revoche?.tolta(this.licenzaDi.get(idDellaCasa));
  }

  /* Il gettone che la casa ha detto. Buono: ci si ricorda fino a quando vale.
   * Vuoto o storto: la casa non e' (piu') Premium, e chi era gia' entrato da
   * fuori esce — un telefono non resta dentro per il solo fatto d'essere
   * entrato prima. Torna se la casa e' Premium adesso. */
  laLicenzaDi(casa, gettone) {
    /* Che la casa il gettone lo dica si segna **sempre**, anche a controllo
     * spento, e prima di guardarlo: e' l'unico modo di sapere quante case
     * hanno gia' l'add-on che le licenze le conosce. Un add-on vecchio questo
     * messaggio non lo manda affatto — e il giorno in cui si scrive la chiave
     * qui, quelle case si chiuderebbero fuori da sole. Prima di accendere si
     * guarda `quantePronteAllaLicenza` contro `quanteCase`. */
    if (casa) casa.dicelaLicenza = true;
    if (this.modoLicenze === "spento" || !casa?.id) return true;
    const detto = verificaGettone(String(gettone ?? ""), {
      chiave: this.chiaveLicenze,
      sog: casa.id,
      app: "gdahome",
      adesso: this.adesso(),
    });
    /* Un gettone buono di una licenza tolta non vale piu': il quadro l'ha
     * detto prima che il gettone scadesse da se' (`revoche.js`). */
    if (detto && !this.revoche?.tolta(detto.lic)) {
      this.premiumFino.set(casa.id, valeFino(detto));
      if (typeof detto.lic === "string") this.licenzaDi.set(casa.id, detto.lic);
      else this.licenzaDi.delete(casa.id);
      return true;
    }
    this.premiumFino.delete(casa.id);
    this.licenzaDi.delete(casa.id);
    if (this.impone) casa.chiudiITelefoni(PREMIUM_RICHIESTO.codice, PREMIUM_RICHIESTO.motivo);
    return false;
  }

  /* ─── La ricevuta di chi compra fuori casa ────────────────────────────── */

  /* Una ricevuta del negozio, portata alla casa sul suo filo.
   *
   * Chi compra Premium fuori casa lo compra proprio perche' da fuori la sua
   * casa non si apre: il telefono non ha un canale su cui mandare la ricevuta.
   * La consegna qui (`POST /licenza/<casa>`, vedi `ricevute.js`), e il
   * centralino la gira alla casa cosi' com'e' e aspetta la risposta. Dentro
   * non guarda: la ricevuta e' firmata dal telefono con la chiave del filo,
   * che conoscono solo lui e la casa, e la firma la controlla la casa. Poi la
   * casa la porta al quadro, e se il quadro dice si' ha un gettone nuovo: lo
   * dice qui come sempre, e la sua risposta torna al telefono.
   *
   * Torna sempre `{stato, corpo}`, da scrivere cosi' com'e' nella risposta. */
  async portaLaRicevuta(idDellaCasa, corpo) {
    const casa = this.collegate.get(idDellaCasa);
    if (!casa) return { stato: 503, corpo: { errore: "casa-non-collegata" } };
    /* Un add-on di prima non saprebbe cosa farne: non la si manda, e si dice
     * subito quello che serve, invece di aspettare un minuto per niente. */
    if (!casa.dicelaLicenza) return { stato: 426, corpo: { errore: ADDON_DA_AGGIORNARE.motivo } };
    return casa.chiediLaRicevuta(corpo);
  }

  /* Un telefono che si sta abbinando non sa ancora a quale casa va: sa solo il
   * codice. Instrada sull'**impronta** del codice, che la casa ha registrato
   * quando la console lo ha fabbricato — cosi' il codice qui non passa mai. */
  accogliUnAbbinamento(presa, { impronta, da = "?" } = {}) {
    const attesa = this.abbinamenti.get(impronta);
    if (!attesa || attesa.scadeIl <= this.adesso()) {
      this.abbinamenti.delete(impronta);
      presa.chiudi(CHIUSURA.normale, "nessun abbinamento in corso");
      return null;
    }
    const casa = this.collegate.get(attesa.casa);
    if (!casa) {
      presa.chiudi(CHIUSURA.normale, "casa non collegata");
      return null;
    }
    /* Tanti abbinamenti insieme su una casa sola non sono una famiglia che
     * inquadra un QR: sono un fuori casa che passa dalla porta sbagliata. */
    if (casa.quantiInAbbinamento() >= ABBINAMENTI_INSIEME_PER_CASA) {
      this.conti.abbinamentiDiTroppo += 1;
      if (this.impone) {
        presa.chiudi(RIPROVA_PIU_TARDI, "troppi abbinamenti insieme: riprova fra poco");
        return null;
      }
    }
    return casa.apriUnCanale(presa, da, this._sorvegliaIlTelefono(presa), "abbinamento");
  }

  /* ─── Manutenzione ───────────────────────────────────────────────────── */

  _giroDiControllo() {
    const ora = this.adesso();
    for (const [impronta, attesa] of [...this.abbinamenti]) {
      if (attesa.scadeIl <= ora) this.abbinamenti.delete(impronta);
    }
    for (const [id, impronte] of [...this.proveDelGiorno]) {
      for (const [impronta, quando] of [...impronte])
        if (ora - quando > GIORNO) impronte.delete(impronta);
      if (!impronte.size) this.proveDelGiorno.delete(id);
    }
    for (const casa of [...this.collegate.values()]) {
      if (ora - casa.vistaIl > SILENZIO_MASSIMO) {
        casa.chiudi("nessun segno di vita");
        continue;
      }
      /* Un gettone puo' scadere mentre un telefono e' gia' dentro. Le nuove
       * connessioni vengono fermate da accogliUnTelefono, ma senza questo
       * controllo il canale gia' aperto resterebbe vivo fino alla sua chiusura.
       * L'abbinamento invece non si tocca: resta libero anche per una casa Base.
       * Lo stesso per una licenza che il quadro dice tolta. */
      if (this.impone && casa.dicelaLicenza && !this.ePremium(casa.id)) {
        casa.chiudiITelefoni(PREMIUM_RICHIESTO.codice, PREMIUM_RICHIESTO.motivo);
      }
      casa.presa.ping();
    }
  }

  chiudiTutto() {
    clearInterval(this._battito);
    this.revoche?.ferma?.();
    for (const casa of [...this.collegate.values()]) casa.chiudi("il centralino si spegne");
  }
}

/* ─── Una casa, dalla parte del centralino ───────────────────────────────── */

class CasaCollegata {
  constructor(centralino, presa, da) {
    this.centralino = centralino;
    this.presa = presa;
    this.da = da;
    this.id = null;
    this.canali = new Map();
    this.prossimoCanale = 1;
    this.vistaIl = centralino.adesso();
    this.chiusa = false;
    this._attesa = null;
    /* Se questa casa ha mai detto la sua licenza su questo filo. Non e' «e'
     * Premium»: e' «il suo add-on sa che le licenze esistono». Vedi
     * `quantePronteAllaLicenza`. */
    this.dicelaLicenza = false;
    /* Le ricevute girate alla casa che aspettano la sua risposta, per numero. */
    this._ricevute = new Map();
    this._prossimaRicevuta = 1;
  }

  get entrata() {
    return this.id !== null;
  }

  avvia() {
    this.presa.onMessaggio = (testo) => this._dallaCasa(testo);
    this.presa.onChiusa = () => this._finita();
    /* Una casa che non si presenta non e' una casa: e' un filo che occupa un
     * posto. La casa vera il `sono-io` lo manda appena aperto. */
    this._attesa = setTimeout(() => {
      if (!this.entrata && !this.chiusa) this.chiudi("non ti sei presentata in tempo");
    }, this.centralino.attesaDellaPresentazione);
    this._attesa.unref?.();
  }

  _manda(testo) {
    return this.centralino.manda(this.presa, testo);
  }

  _dallaCasa(testo) {
    if (this.chiusa) return;
    this.vistaIl = this.centralino.adesso();

    let detto;
    try {
      detto = JSON.parse(testo);
    } catch (_errore) {
      this._rifiuta("non ho capito");
      return;
    }
    if (!detto || typeof detto !== "object") {
      this._rifiuta("non ho capito");
      return;
    }

    if (!this.entrata) {
      this._siPresenta(detto);
      return;
    }

    switch (detto.t) {
      case "battito":
        /* Il colpetto della casa, rimandato indietro. Non serve a questo
         * centralino — lui le case le pinga per conto suo — ma serve a lei:
         * e' cosi' che si accorge di un filo morto senza chiusura, e quel
         * filo e' dietro il suo router, non dietro il nostro. */
        this._manda(testo);
        return;
      case "apri-abbinamento":
        this._apriUnAbbinamento(detto.impronta);
        return;
      case "chiudi-abbinamento":
        this._chiudiGliAbbinamenti();
        return;
      /* La casa di prova: un'attesa che vive fino a sette giorni e che un
       * telefono che entra non chiude. Sta accanto a quella di tutti i
       * giorni, e nessuna delle due spegne l'altra. */
      case "apri-prova":
        this._apriUnaProva(detto.impronta, detto.vale);
        return;
      case "chiudi-prova":
        this._chiudiLeProve();
        return;
      case "d":
        this._versoIlTelefono(detto.c, detto.m);
        return;
      case "chiudi":
        this._chiudiIlCanale(detto.c, "la casa ha chiuso");
        return;
      case "licenza":
        this.centralino.laLicenzaDi(this, detto.gettone);
        return;
      case "ricevuta":
        this._laRispostaAllaRicevuta(detto);
        return;
      /* Le notifiche (`spinte.js`): l'elenco dei gettoni dei telefoni di
       * questa casa, e una busta chiusa per uno di loro. Dentro la busta non
       * si guarda: si porta a Firebase. */
      case "spinta-elenco":
        this.centralino.spinte?.elenco(this.id, detto.telefoni);
        return;
      case "spinta":
        void this._unaSpinta(detto);
        return;
      default:
        /* Il contratto chiama il campo `tipo`: una casa scritta leggendo solo
         * quello manda `tipo` e basta, e va capita lo stesso. */
        if (detto.tipo === "licenza") this.centralino.laLicenzaDi(this, detto.gettone);
        /* Roba che non si conosce si lascia perdere: una casa piu' nuova del
         * centralino puo' dire cose che qui non si sanno ancora, e non e' un
         * motivo per buttarla fuori. */
        return;
    }
  }

  _siPresenta(detto) {
    if (detto.t !== "sono-io") {
      this._rifiuta("prima bisogna presentarsi");
      return;
    }
    const esito = this.centralino.case.esito(detto.casa, detto.segreto, { da: this.da });
    if (esito === "troppe") {
      /* Non un no: troppe case nuove in quest'ora, da qui o in tutto. Non si
       * dice «no» — il ponte smetterebbe per sempre — si chiude come una
       * caduta, e lui ribussa con calma piu' tardi. */
      this.centralino.registro.attenzione(`troppe case nuove: ${this.da} aspetta`);
      this.chiusa = true;
      clearTimeout(this._attesa);
      this.presa.chiudi(RIPROVA_PIU_TARDI, "troppe case nuove: riprova piu' tardi");
      return;
    }
    if (esito !== "entra") {
      this.centralino.registro.attenzione(`casa rifiutata da ${this.da}`);
      this._rifiuta("non ti riconosco");
      return;
    }
    clearTimeout(this._attesa);

    /* Una casa sola per identificativo. Chi arriva secondo prende il posto del
     * primo, e non il contrario: il primo puo' essere un filo morto che
     * nessuno ha ancora dichiarato tale, e la casa vera che si riaggancia non
     * deve restare fuori per colpa del proprio fantasma. */
    const gia = this.centralino.collegate.get(detto.casa);
    if (gia && gia !== this) gia.chiudi("questa casa si e' ricollegata");

    this.id = detto.casa;
    this.centralino.collegate.set(this.id, this);
    /* Il gettone puo' arrivare anche dentro la presentazione, e l'add-on
     * nuovo ce lo mette sempre, anche vuoto: cosi' da qui si sa fin dal primo
     * istante che quella casa le licenze le conosce, e un telefono che bussa
     * nel millisecondo prima del messaggio a parte non si sente dire
     * «aggiorna l'add-on» per sbaglio. Se non c'e' affatto, non si dimentica
     * quello di prima: la casa lo ridice appena entrata. */
    if (typeof detto.gettone === "string") {
      this.centralino.laLicenzaDi(this, detto.gettone);
    }
    this._manda(JSON.stringify({ t: "bene" }));
    this.centralino.registro.info(`casa collegata da ${this.da}`);
  }

  /* Rifiutare **dicendolo**.
   *
   * Chiudere e basta sarebbe la cosa peggiore: il ponte vedrebbe un filo
   * caduto, che e' quello che succede mille volte al giorno per colpa della
   * rete, e ribusserebbe all'infinito senza capire. Un rifiuto e' un'altra
   * cosa da una caduta — non passera' col tempo — e va detto, cosi' chi lo
   * riceve puo' smettere e scriverlo nel proprio registro invece di girare a
   * vuoto per sempre. */
  _rifiuta(perche) {
    this.presa.manda(JSON.stringify({ t: "no", perche }));
    if (this.chiusa) return;
    this.chiusa = true;
    clearTimeout(this._attesa);
    this._staccaDalCentralino();
    /* 1008 e' «non per la rete, per la politica»: il ponte lo legge come
     * definitivo anche se il messaggio andasse perso. */
    this.presa.chiudi(1008, perche);
  }

  _apriUnAbbinamento(impronta) {
    if (!this._sePuoPrenderla(impronta)) return;
    this._chiudiGliAbbinamenti();
    this.centralino.abbinamenti.set(impronta, {
      casa: this.id,
      scadeIl: this.centralino.adesso() + ABBINAMENTO_VIVE,
    });
  }

  /* La casa di prova. `vale` e' quanto le manca, in millisecondi, e non
   * l'ora in cui scade: l'orologio di una casa puo' essere indietro o
   * avanti, ma la differenza la misura giusta. Una alla volta per casa, come
   * il codice di tutti i giorni, e con un tetto. */
  _apriUnaProva(impronta, vale) {
    const quanto = Math.min(Number(vale) || 0, PROVA_VIVE_AL_MASSIMO);
    if (!(quanto > 0) || !this._sePuoPrenderla(impronta)) return;
    if (!this._cePostoPerUnaProva(impronta)) return;
    this._chiudiLeProve();
    this.centralino.abbinamenti.set(impronta, {
      casa: this.id,
      scadeIl: this.centralino.adesso() + quanto,
      prova: true,
    });
  }

  /* I tetti della casa di prova.
   *
   * Quello in tutto vale sempre: e' memoria, e le case di prova vere si
   * contano sulle dita. Gli altri due chiudono solo con `impone`, e prima
   * contano: lo stesso indirizzo con piu' case di prova aperte insieme, e una
   * casa che ne apre di nuove di continuo. La stessa impronta ridetta — il
   * ponte la ridice a ogni filo nuovo — non conta mai come nuova. */
  _cePostoPerUnaProva(impronta) {
    const centralino = this.centralino;
    const ora = centralino.adesso();
    const gia = centralino.abbinamenti.get(impronta);
    const laStessa = gia && gia.casa === this.id && gia.prova;
    let inTutto = 0;
    let daQui = 0;
    for (const attesa of centralino.abbinamenti.values()) {
      if (!attesa.prova || attesa.casa === this.id || attesa.scadeIl <= ora) continue;
      inTutto += 1;
      if (centralino.collegate.get(attesa.casa)?.da === this.da) daQui += 1;
    }
    const rifiuta = (perche, sempre = false) => {
      centralino.conti.proveRifiutate += 1;
      centralino.registro.attenzione(`casa di prova ${perche}: ${this.da}`);
      return !(sempre || centralino.impone);
    };
    if (!laStessa && inTutto >= PROVE_IN_TUTTO) return rifiuta("oltre il tetto in tutto", true);

    const sue = centralino.proveDelGiorno.get(this.id) ?? new Map();
    for (const [una, quando] of [...sue]) if (ora - quando > GIORNO) sue.delete(una);
    const nuova = !sue.has(impronta);
    if (!laStessa && daQui >= PROVE_PER_INDIRIZZO && !rifiuta("oltre il tetto per indirizzo"))
      return false;
    /* Oltre il tetto non si segna piu' niente, nemmeno quando si lascia
     * passare: il conto di una casa non cresce oltre il tetto. */
    if (nuova && sue.size >= PROVE_NUOVE_PER_CASA_AL_GIORNO)
      return rifiuta("oltre il tetto del giorno");
    if (nuova) sue.set(impronta, ora);
    centralino.proveDelGiorno.set(this.id, sue);
    return true;
  }

  /* Un'impronta gia' presa da un'altra casa, ancora collegata e ancora nel
   * suo tempo, resta sua. Chi arriva secondo con la stessa impronta non ha
   * fabbricato lui quel codice — i codici sono ottanta bit di caso — e
   * lasciarglielo riscrivere vorrebbe dire mandare a lui il telefono che si
   * sta abbinando all'altra. */
  _sePuoPrenderla(impronta) {
    if (typeof impronta !== "string" || !/^[0-9a-f]{64}$/.test(impronta)) return false;
    const gia = this.centralino.abbinamenti.get(impronta);
    if (
      gia &&
      gia.casa !== this.id &&
      gia.scadeIl > this.centralino.adesso() &&
      this.centralino.collegate.has(gia.casa)
    ) {
      this.centralino.registro.attenzione(`un'impronta gia' presa da un'altra casa: ${this.da}`);
      return false;
    }
    return true;
  }

  /* Le attese del codice di tutti i giorni: quella della casa di prova
   * resta. Un telefono che si abbina col codice di casa non deve chiudere
   * la porta a chi sta rivedendo l'app. */
  _chiudiGliAbbinamenti() {
    for (const [impronta, attesa] of [...this.centralino.abbinamenti]) {
      if (attesa.casa === this.id && !attesa.prova) this.centralino.abbinamenti.delete(impronta);
    }
  }

  _chiudiLeProve() {
    for (const [impronta, attesa] of [...this.centralino.abbinamenti]) {
      if (attesa.casa === this.id && attesa.prova) this.centralino.abbinamenti.delete(impronta);
    }
  }

  /* ─── Le notifiche ───────────────────────────────────────────────────── */

  /* Una busta per un telefono di questa casa. Se Firebase dice che quel
   * telefono non c'e' piu', il gettone e' gia' stato tolto, e lo si dice alla
   * casa: che lo tolga anche lei, e smetta di mandare. */
  async _unaSpinta(detto) {
    const spinte = this.centralino.spinte;
    if (!spinte || !this.id) return;
    const esito = await spinte.spingi(this.id, {
      telefono: detto.telefono,
      busta: detto.busta,
      urgente: detto.urgente === true,
    });
    if (esito === "morta" && !this.chiusa) {
      this._manda(JSON.stringify({ t: "spinta-morta", telefono: detto.telefono }));
    }
  }

  /* ─── Le ricevute ────────────────────────────────────────────────────── */

  /* Gira alla casa una ricevuta e aspetta la sua risposta: `{stato, corpo}`.
   * Non si aspetta per sempre, e non piu' di qualcuna insieme. */
  chiediLaRicevuta(corpo) {
    if (this.chiusa)
      return Promise.resolve({ stato: 503, corpo: { errore: "casa-non-collegata" } });
    if (this._ricevute.size >= RICEVUTE_IN_VOLO)
      return Promise.resolve({ stato: 429, corpo: { errore: "troppe-ricevute" } });
    const n = this._prossimaRicevuta++;
    return new Promise((fatto) => {
      const scade = setTimeout(() => {
        this._ricevute.delete(n);
        fatto({ stato: 504, corpo: { errore: "la-casa-non-risponde" } });
      }, this.centralino.attesaDellaRicevuta);
      scade.unref?.();
      this._ricevute.set(n, { fatto, scade });
      this._manda(JSON.stringify({ t: "ricevuta", n, corpo }));
    });
  }

  /* La risposta della casa: lo stato come in HTTP, e il corpo cosi' com'e'.
   * Uno stato storto diventa 502 — la casa ha risposto qualcosa che non si
   * capisce — e un corpo che non e' un oggetto diventa vuoto. */
  _laRispostaAllaRicevuta(detto) {
    const attesa = this._ricevute.get(detto.n);
    if (!attesa) return;
    this._ricevute.delete(detto.n);
    clearTimeout(attesa.scade);
    const stato =
      Number.isInteger(detto.stato) && detto.stato >= 200 && detto.stato <= 599 ? detto.stato : 502;
    const corpo =
      detto.corpo && typeof detto.corpo === "object" && !Array.isArray(detto.corpo)
        ? detto.corpo
        : {};
    attesa.fatto({ stato, corpo });
  }

  /* La casa se ne va: chi aspettava la sua risposta la riceve adesso, e dice
   * che la casa non c'e'. */
  _lasciaLeRicevute() {
    for (const { fatto, scade } of this._ricevute.values()) {
      clearTimeout(scade);
      fatto({ stato: 503, corpo: { errore: "casa-non-collegata" } });
    }
    this._ricevute.clear();
  }

  /* ─── I canali ───────────────────────────────────────────────────────── */

  /* `via` dice alla casa da quale porta e' entrato il telefono: da
   * `/telefono/<casa>` arriva chi e' gia' abbinato, da `/abbinamento/<impronta>`
   * chi si sta abbinando. La casa lo usa per accettare la stretta
   * dell'abbinamento solo dalla seconda. */
  apriUnCanale(presaDelTelefono, da, haParlato = () => {}, via = "telefono", che = "") {
    if (this.canali.size >= TELEFONI_PER_CASA) {
      haParlato();
      presaDelTelefono.chiudi(CHIUSURA.normale, "troppi telefoni su questa casa");
      return null;
    }
    const numero = this.prossimoCanale++;
    /* `via` si tiene anche qui, non solo mandato alla casa: e' l'unico modo di
     * distinguere poi un'app aperta da un abbinamento in corso.
     *
     * E `che` dice cos'e' quello che sta all'altro capo — `"app"` o `"web"` —
     * per poterli contare separati. Alla casa non serve e non si manda: lei
     * parla col telefono allo stesso modo in tutti e due i casi, e un dato in
     * piu' sul filo sarebbe un dato in piu' senza motivo. */
    const canale = { numero, presa: presaDelTelefono, da, via, che };
    this.canali.set(numero, canale);

    /* La porta dell'abbinamento serve a una stretta di mano, e una stretta di
     * mano dura secondi: un canale entrato da li' non vive oltre
     * `VITA_DEL_CANALE_DI_ABBINAMENTO`. */
    let vita = null;
    if (via === "abbinamento") {
      vita = setTimeout(() => {
        presaDelTelefono.chiudi(CHIUSURA.normale, "l'abbinamento dura poco");
      }, this.centralino.vitaDelCanaleDiAbbinamento);
      vita.unref?.();
    }
    let primaParola = true;

    presaDelTelefono.onMessaggio = (testo, eraTesto = typeof testo === "string") => {
      haParlato();
      if (this.chiusa) return;
      /* Il telefono parla in testo, sempre: un telaio binario non e' suo. */
      if (!eraTesto || typeof testo !== "string") {
        presaDelTelefono.chiudi(DATI_NON_ACCETTATI, "solo testo");
        return;
      }
      if (primaParola) {
        primaParola = false;
        if (via === "abbinamento" && !this._eUnAbbinamento(testo)) {
          this.centralino.conti.nonAbbinamenti += 1;
          if (this.centralino.impone) {
            this.centralino.registro.attenzione(
              `dalla porta dell'abbinamento senza abbinarsi: ${da}`,
            );
            presaDelTelefono.chiudi(SOLO_PER_ABBINARSI.codice, SOLO_PER_ABBINARSI.motivo);
            return;
          }
        }
      }
      const busta = JSON.stringify({ c: numero, t: "d", m: testo });
      if (Buffer.byteLength(busta) > BUSTA_MASSIMA) {
        presaDelTelefono.chiudi(CHIUSURA.troppoGrande, "messaggio troppo grande");
        return;
      }
      this._manda(busta);
    };
    presaDelTelefono.onChiusa = () => {
      haParlato();
      clearTimeout(vita);
      if (!this.canali.delete(numero)) return;
      if (!this.chiusa) this._manda(JSON.stringify({ c: numero, t: "chiudi" }));
    };

    this._manda(JSON.stringify({ c: numero, t: "apri", da, via }));
    return canale;
  }

  /* Se la prima parola di un telefono e' quella di chi si abbina.
   *
   * La stretta di mano e' in chiaro — la chiave del filo si fa proprio li' —
   * e chi si abbina lo dice con `abbina` (`ponte/src/portiere.js`: la stessa
   * regola con cui il ponte la manda all'abbinamento). Qui si guarda quel
   * campo e nient'altro, e solo nella prima parola della porta
   * dell'abbinamento: il resto restano byte che si spostano. */
  _eUnAbbinamento(testo) {
    if (testo.length > 64 * 1024) return false;
    try {
      const detto = JSON.parse(testo);
      return (
        Boolean(detto) &&
        typeof detto === "object" &&
        detto.abbina != null &&
        detto.abbina !== false
      );
    } catch (_errore) {
      return false;
    }
  }

  /* Quanti canali entrati dalla porta dell'abbinamento sono aperti adesso. */
  quantiInAbbinamento() {
    let quanti = 0;
    for (const canale of this.canali.values()) if (canale.via === "abbinamento") quanti += 1;
    return quanti;
  }

  /* Chiude i telefoni entrati da fuori, non quelli che si stanno abbinando:
   * l'abbinamento resta aperto a tutti. */
  chiudiITelefoni(codice, perche) {
    for (const [numero, canale] of [...this.canali]) {
      if (canale.via !== "telefono") continue;
      this.canali.delete(numero);
      canale.presa.chiudi(codice, perche);
      if (!this.chiusa) this._manda(JSON.stringify({ c: numero, t: "chiudi" }));
    }
  }

  _versoIlTelefono(numero, messaggio) {
    const canale = this.canali.get(numero);
    if (!canale || typeof messaggio !== "string") return;
    this.centralino.manda(canale.presa, messaggio);
  }

  _chiudiIlCanale(numero, perche) {
    const canale = this.canali.get(numero);
    if (!canale) return;
    this.canali.delete(numero);
    canale.presa.chiudi(CHIUSURA.normale, perche);
  }

  /* ─── Fine ───────────────────────────────────────────────────────────── */

  chiudi(perche = "") {
    if (this.chiusa) return;
    this.chiusa = true;
    clearTimeout(this._attesa);
    /* I telefoni non restano appesi a una casa che non c'e' piu': meglio che
     * si accorgano subito e ribussino, invece di parlare nel vuoto. */
    for (const canale of [...this.canali.values()]) {
      canale.presa.chiudi(CHIUSURA.normale, "la casa si e' scollegata");
    }
    this.canali.clear();
    this._staccaDalCentralino();
    this.presa.chiudi(CHIUSURA.normale, perche);
  }

  _finita() {
    clearTimeout(this._attesa);
    if (this.chiusa) return;
    this.chiusa = true;
    for (const canale of [...this.canali.values()]) {
      canale.presa.chiudi(CHIUSURA.normale, "la casa si e' scollegata");
    }
    this.canali.clear();
    this._staccaDalCentralino();
  }

  _staccaDalCentralino() {
    this._lasciaLeRicevute();
    if (!this.id) return;
    /* Le attese se ne vanno con la casa: quando si ricollega le ridice lei.
     * Ma solo se questo filo e' ancora quello della casa. Un filo vecchio che
     * si chiude dopo che la casa si e' gia' ricollegata — il suo fantasma —
     * non deve portarsi via quello che la casa vera ha appena detto: per un
     * abbinamento sarebbero cinque minuti, per una casa di prova giorni. */
    if (
      !this.centralino.collegate.has(this.id) ||
      this.centralino.collegate.get(this.id) === this
    ) {
      this._chiudiGliAbbinamenti();
      this._chiudiLeProve();
    }
    if (this.centralino.collegate.get(this.id) === this) {
      this.centralino.collegate.delete(this.id);
    }
  }
}
