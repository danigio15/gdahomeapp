/* Il rapporto: quello che questa casa dice di se' al quadro di chi l'ha
 * installata.
 *
 * Un installatore mette gdahome in quaranta case e poi non ci torna piu'. Il
 * Wi-Fi che cambia, la presa Zigbee che sparisce, Home Assistant fermo a sei
 * mesi fa, il backup che non gira dal giorno dell'installazione: se ne accorge
 * quando squilla il telefono, cioe' quando il cliente e' gia' arrabbiato. Il
 * rapporto e' poche righe di numeri che partono da sole, e gli fanno sapere
 * prima.
 *
 * **E' spenta.** Senza un codice nelle opzioni dell'add-on qui non parte
 * niente e non si apre nessuna connessione: questo file, in una casa
 * qualunque, e' codice che non gira.
 *
 * ─── Cosa c'e' dentro, e cosa non ci deve andare ─────────────────────────
 *
 * Numeri, versioni e nomi di processi. La regola si dice cosi': **cosa c'e'
 * nella scatola, non chi ci abita.** «Mosquitto broker» ed `eth0` sono nomi di
 * prodotti e di schede e non dicono niente di nessuno.
 *
 * Con un'eccezione sola, e dichiarata: **il nome dei dispositivi che in questo
 * momento non rispondono**. Il perche' sta in cima a `salute.js` — una spia
 * che dice «dodici cose sono giu'» e non quali non serve a ripararle, serve a
 * far telefonare — e il prezzo e' scritto nella casella dell'add-on prima che
 * qualcuno incolli il codice: «Luce cucina» dice anche in che stanza sta.
 * Quelli che **funzionano** non escono: di una casa con duecento dispositivi a
 * posto e due giu', il quadro sa due nomi.
 *
 * Fuori restano, e vanno lasciati fuori: i nomi di tutto il resto, i nomi
 * delle stanze, i nomi delle persone, gli stati dei sensori, l'SSID del
 * Wi-Fi, l'indirizzo pubblico, la posizione, le foto, la configurazione della
 * plancia, il contenuto delle segnalazioni.
 *
 * L'indirizzo **sulla rete di casa** invece c'e': `192.168.1.50` non
 * identifica nessuno, e a chi ripara queste macchine serve tutti i giorni —
 * «la scatola ha cambiato indirizzo» e' meta' delle telefonate.
 *
 * ─── Il verso ────────────────────────────────────────────────────────────
 *
 * La casa chiama il quadro, sempre. Il quadro non bussa mai e non potrebbe:
 * una casa di gdahome un indirizzo pubblico non ce l'ha, ed e' tutto il punto
 * del ponte. Nessuna porta da aprire, nessun servizio in ascolto: la stessa
 * forma che ha gia' il filo verso il centralino.
 *
 * ─── Dove non passa ──────────────────────────────────────────────────────
 *
 * Non passa dal centralino di gdahome. Quello instrada e non capisce, e c'e'
 * una prova che controlla che non ci sia niente di leggibile in quello che lo
 * attraversa: farci passare un cruscotto renderebbe falsa quella riga, e
 * farebbe di chi mantiene l'app il custode dei dati di case di altri.
 */

import { gliAddon, gliApparati, laMacchina, laRete } from "./ferro.js";
import { ilSegnoDi } from "./segni.js";
import { ilBackup, leBatterie, leEntita } from "./salute.js";

/* Dove sta il quadro.
 *
 * **Scritto qui, e non in una casella dell'add-on.** E' la stessa scelta gia'
 * fatta per il centralino (`opzioni.js`, `CENTRALINO_DI_DIFETTO`), e per lo
 * stesso motivo: una casella che non va toccata e' una casella che prima o poi
 * qualcuno tocca — scrivendoci qualcosa di storto, o congelando per quella casa
 * un indirizzo che il giorno che cambia non cambia piu'.
 *
 * Il quadro e' uno solo e sta su una macchina di gdahome. Chi installa non
 * accende niente, non compra nessun dominio e non tiene su nessun server: gli
 * si da' un codice, lo incolla, e ha finito.
 *
 * ─── Questo nome deve risolvere prima del rilascio ───────────────────────
 *
 * Una volta uscita una versione dell'add-on, questa riga sta **in ogni casa**:
 * cambiarla dopo vuol dire un'altra versione e aspettare che tutte si
 * aggiornino, e nel frattempo le case vecchie parlano a un indirizzo morto.
 *
 * Non e' una catastrofe — una casa che non trova il quadro non si rompe, rallenta
 * i tentativi e scrive nella sua console **perche'** non ci riesce — ma e' un
 * giro di telefonate che si evita controllando un nome.
 */
export const QUADRO_DI_DIFETTO = "https://quadro.gdahome.org";

/* Quanto e' lunga la chiave con cui un installatore apre il suo cruscotto.
 *
 * Sta qui per riconoscerla quando finisce nella casella sbagliata, e non per
 * usarla: il ponte con quella chiave non ci fa niente. E' `CHIAVE_LUNGA` di
 * `quadro/src/installatori.js`, e una prova tiene che i due numeri non si
 * scollino — se si scollassero, questo controllo smetterebbe di riconoscere
 * proprio la cosa per cui esiste, in silenzio. */
export const CHIAVE_DI_UN_CRUSCOTTO = 32;

/** Ogni quanto parte un rapporto, in minuti, quando non si dice altro. */
export const OGNI_DI_SERIE = 1;

/* Il pavimento e' un minuto, e prima erano cinque.
 *
 * Il ragionamento di allora era che una casa che parla spesso scalda una
 * macchina per niente. Regge sul traffico e non regge su quello che il quadro
 * serve a fare: un impianto che si ferma alle 9:02 con quindici minuti di
 * passo si sa alle 9:15, e in quel quarto d'ora il cliente ha gia' telefonato
 * — cioe' e' successo esattamente quello che il quadro doveva evitare.
 *
 * Il conto del traffico, fatto: un rapporto e' qualche riga di numeri, e
 * quaranta case al minuto sono quaranta richieste al minuto. Una macchina da
 * due lire le regge senza accorgersene; quello che non reggerebbe sarebbe un
 * rapporto che porta dietro mezza casa, e questo non lo fa.
 *
 * Sotto il minuto non si scende lo stesso: la finestra piu' corta che serva a
 * qualcuno e' il minuto, e trenta secondi raddoppierebbero tutto per una
 * differenza che nessuno userebbe. */
const OGNI_AL_MINIMO = 1;
const OGNI_AL_MASSIMO = 24 * 60;

/** Quanto si aspetta il quadro prima di lasciar perdere. */
const ATTESA = 10_000;

/* Quanto si tiene aperto il filo verso il quadro prima di riaprirlo.
 *
 * Un po' piu' di quanto il quadro lo tiene (cinquanta secondi): a chiudere
 * dev'essere lui, con una risposta. Se scadesse prima questa parte, ogni giro
 * finirebbe con una richiesta annullata — che nel registro si legge come un
 * errore, e non lo e'. */
const IL_FILO_DURA = 70_000;

/* Quanto si aspetta dopo un filo caduto, e fin dove si rallenta.
 *
 * Il filo e' un **di piu'**: se cade non si perde niente, perche' il rapporto
 * al minuto porta il lavoro come ha sempre fatto. Quindi si riprova piano —
 * un quadro spento non deve trovarsi una casa che bussa ogni secondo — e si
 * riparte da capo appena una risposta torna. */
const IL_FILO_RIPROVA = 5_000;
const IL_FILO_RALLENTA_FINO_A = 12;

/* Quanto passa **almeno** fra l'inizio di un giro di filo e l'inizio del
 * successivo.
 *
 * E' un paracadute, e serve: a tenere aperta la richiesta e' il quadro, e
 * questa casa non ha modo di sapere se davvero lo sta facendo. Un quadro che
 * rispondesse nell'istante — uno vecchio, uno dietro un proxy che chiude le
 * richieste ferme, uno che riconsegna sempre lo stesso lavoro — farebbe girare
 * questa casa a vuoto quanto ne e' capace il processore.
 *
 * Sta **all'ingresso** del giro e non in uno dei rami di uscita, e la
 * differenza non e' di stile: i modi di rientrare sono tre — a mani vuote, col
 * rapporto che parte dopo un lavoro, e la riapertura dopo una caduta — e un
 * pavimento messo su due di quei tre lascia aperta la strada che gira. C'era,
 * e girava: con un quadro che riconsegnava lo stesso lavoro, lavoro → rapporto
 * → filo → lavoro senza mai fermarsi un istante.
 *
 * Con un secondo, il caso peggiore e' una richiesta al secondo: si nota nel
 * registro e non fa male a nessuno. Quando il quadro fa il suo mestiere questa
 * riga non si accorge nemmeno di esistere. */
const IL_FILO_ALMENO = 1_000;

/* Quanto si tengono da parte i registri di Home Assistant.
 *
 * Servono a dare un nome ai dispositivi che non rispondono, e cambiano quando
 * qualcuno aggiunge o ribattezza un apparecchio — cioe' quasi mai. Il rapporto
 * parte ogni minuto: richiederli ogni volta vorrebbe dire duemila righe di
 * registro al minuto per due nomi che sono gli stessi di un'ora fa.
 *
 * Cinque minuti e' il ritardo massimo con cui un dispositivo appena
 * ribattezzato si vede col nome nuovo, e nessuno ribattezza una presa
 * guardando il cronometro. */
const REGISTRI_DURANO = 5 * 60 * 1000;

/* Quanto si aspetta prima del primo rapporto.
 *
 * Erano trenta secondi, ed erano dimensionati su un passo da un quarto d'ora:
 * li' un primo rapporto incompleto restava sullo schermo quindici minuti, e
 * valeva la pena aspettare che Home Assistant finisse di partire.
 *
 * Adesso il passo e' un minuto, e quei trenta secondi costano piu' di quello
 * che comprano. Il momento in cui contano davvero e' l'unico in cui qualcuno
 * sta guardando: si incolla il codice, si salva, l'add-on riparte — e per
 * mezzo minuto non succede niente. Chi guarda non vede «sto aspettando», vede
 * che non funziona, e va a rifare il giro da capo.
 *
 * Il rischio che restava lo copre gia' `compila`: quello che non si sa resta
 * **fuori** dal foglio invece di diventare uno zero. Un rapporto mandato
 * troppo presto ha meno righe, non righe sbagliate — e un minuto dopo ne ha
 * tutte. Due secondi bastano a non correre dietro alla propria accensione. */
const PRIMA_ASPETTA = 2_000;

/* Quando il quadro non risponde si rallenta invece di insistere: un quadro
 * spento per un giorno non deve prendersi una richiesta ogni quindici minuti
 * da quaranta case. Si raddoppia fino a un tetto, e al primo «va bene» si
 * torna al passo normale. */
const RALLENTA_FINO_A = 8;

export class CodiceIllegibile extends Error {}

/**
 * Il codice del quadro, come si incolla nella scheda dell'add-on.
 *
 *     K7M2-9XQF-3BHT-R4VN
 *
 * Venti caratteri, e basta. Prima era una riga lunga che portava dentro anche
 * l'indirizzo del quadro e un numero di versione; adesso l'indirizzo sta nel
 * programma, e la versione non serve piu' a nessuno perche' il quadro che fa il
 * codice e quello che risponde sono **la stessa macchina**.
 *
 * Quello che resta e' il codice che il quadro ha generato: si detta al
 * telefono, si copia senza sbagliare, e chi lo incolla non deve sapere niente
 * di indirizzi.
 *
 * I trattini si tengono o si tolgono, e qui non si toccano: a confrontarlo e'
 * il quadro, che li toglie da tutt'e due le parti. Chi ricopia a mano un codice
 * a gruppi di quattro sbaglia meno, e chi lo incolla da un messaggio se li
 * porta dietro.
 */
export function leggiIlCodice(scritto) {
  const testo = String(scritto ?? "").trim();
  if (!testo) return null;

  /* Chi ha in mano la riga vecchia — `quadro|2|https://…|CHIAVE` — non merita
   * un «codice non valido»: merita di sapere che adesso ci va solo il pezzo
   * finale. */
  if (testo.includes("|")) {
    throw new CodiceIllegibile(
      "qui adesso ci va solo il codice, senza indirizzo: e' l'ultimo pezzo di quella riga",
    );
  }
  if (/^https?:/i.test(testo)) {
    throw new CodiceIllegibile("qui ci va il codice del quadro, non un indirizzo");
  }

  const nudo = testo.replace(/-/g, "").toUpperCase();
  if (nudo.length < 8) {
    throw new CodiceIllegibile("questo codice e' troppo corto per essere un codice del quadro");
  }
  if (!/^[A-Z0-9]+$/.test(nudo)) {
    throw new CodiceIllegibile(
      "in questo codice ci sono caratteri che un codice del quadro non ha",
    );
  }
  /* La chiave di un cruscotto, finita nella casella sbagliata.
   *
   * Nella scheda dell'add-on ci sono due caselle che vogliono una stringa a
   * caso, e da fuori si somigliano: il codice di abbinamento che da'
   * l'installatore, e la chiave con cui l'installatore apre il proprio
   * cruscotto. Scambiarle e' successo alla prima persona che ci ha provato.
   *
   * Prima di questo controllo lo scambio dava un `403 questa chiave non apre
   * niente`, a ogni giro, per sempre — perche' quella stringa un invito non lo
   * sara' mai. Un guasto che non dice niente di utile e non smette e' il
   * peggiore da riconoscere: sembra rotto il quadro, non la casella.
   *
   * I due pero' si distinguono: un invito e' `codiceNuovo(16)`, una chiave di
   * installatore e' `codiceNuovo(32)`. Sedici contro trentadue, e la macchina
   * il conto lo sa fare. */
  if (nudo.length === CHIAVE_DI_UN_CRUSCOTTO) {
    throw new CodiceIllegibile(
      "questa e' lunga come la chiave di un cruscotto, non come un codice di " +
        "abbinamento: la chiave va nella casella «Il codice che apre il tuo " +
        "cruscotto», e qui ci va il codice a gruppi di quattro che ti ha dato " +
        "chi ti ha fatto l'impianto",
    );
  }

  /* L'indirizzo si puo' spostare da fuori, e qui non c'e' niente da difendere:
   * il quadro e' di gdahome, e una casa che ne guardasse un altro semplicemente
   * non comparirebbe nel suo — come una casa senza codice. Serve alle prove, e
   * a chi si rifa' gdahome per se'. */
  const dove = String(process.env.PONTE_QUADRO_DOVE || QUADRO_DI_DIFETTO).replace(/\/+$/, "");

  return { dove, chiave: testo };
}

/** Ogni quanto, tenuto dentro i limiti. */
export function ogniQuanto(detto, difetto = OGNI_DI_SERIE) {
  const quanti = Number(detto);
  if (!Number.isFinite(quanti)) return difetto;
  return Math.min(OGNI_AL_MASSIMO, Math.max(OGNI_AL_MINIMO, Math.round(quanti)));
}

/**
 * Il foglio, da quello che il ponte sa gia'.
 *
 * Nessuna rete qui dentro, e nessun orologio che non sia quello che gli si
 * passa: si prova tutto senza Home Assistant, senza Supervisor e senza nessun
 * quadro acceso, che e' il motivo per cui questa funzione sta da sola.
 *
 * Quello che arriva `null` o mancante resta fuori dal foglio invece di
 * diventare uno zero: **zero e' un'informazione, e dirla quando non si sa e'
 * una bugia.** Una casa senza System Monitor non ha la CPU allo zero per
 * cento; non ce l'ha, e il quadro lo dice con quelle parole.
 */
export function compila({
  casa,
  ogni = OGNI_DI_SERIE,
  versioni = {},
  macchina = null,
  rete = null,
  apparati = null,
  addon = null,
  aggiornamenti = null,
  manutenzione = false,
  lavoro = null,
  plance = null,
  telefoni = null,
  fuori = null,
  entita = null,
  batterie = null,
  backup = null,
  registro = null,
  adesso = () => Date.now(),
} = {}) {
  const foglio = {
    casa: String(casa ?? ""),
    quando: new Date(adesso()).toISOString(),
    ogni: ogniQuanto(ogni),
    ponte: String(versioni.ponte ?? ""),
    plancia: String(versioni.plancia ?? ""),
    ha: String(versioni.ha ?? ""),
    supervisor: String(versioni.supervisor ?? ""),
    sistema: String(versioni.sistema ?? ""),
    /* Sempre, anche quando e' `false`: e' il secondo interruttore, e il quadro
     * deve poter scrivere «questa casa non ha aperto la manutenzione». Una
     * chiave che manca vorrebbe dire «non lo dice», che e' un'altra cosa. */
    manutenzione: manutenzione === true,
  };
  /* Le parti che possono mancare si aggiungono solo se ci sono. Un Supervisor
   * che non ha risposto lascia il rapporto senza `macchina`, e il quadro lo
   * sa leggere: «questa casa non lo dice» e' una risposta, `0` no. */
  const forse = {
    macchina,
    rete,
    addon,
    aggiornamenti,
    lavoro,
    plance,
    telefoni,
    fuori,
    entita,
    batterie,
    backup,
    registro,
  };
  for (const [nome, cosa] of Object.entries(forse)) {
    if (cosa !== null && cosa !== undefined) foglio[nome] = cosa;
  }
  /* Gli apparati di rete stanno dentro `rete`, dove li cerca chi legge: sono
   * la stessa domanda — «questa casa e' collegata?» — vista da un'altra
   * parte. */
  if (foglio.rete && apparati) foglio.rete = { ...foglio.rete, sorvegliate: apparati };
  return foglio;
}

/**
 * Da dove viene ogni numero.
 *
 * E' l'unico posto che lo sa, ed e' fatto apposta: `compila` non conosce
 * nessuno, `salute.js` e `ferro.js` leggono e basta, e il postino porta senza
 * guardare dentro. Qui si mettono insieme, e se un giorno un numero cambia
 * sorgente si cambia una riga sola.
 *
 * Torna **una funzione**, non un foglio: il postino la chiama a ogni giro, e
 * cosi' ogni rapporto e' di adesso invece che di quando il ponte si e'
 * acceso.
 *
 * Quello che non risponde non ferma niente. Una casa senza Supervisor manda
 * un rapporto senza la macchina; una con Home Assistant giu' la manda senza
 * le entita'. **Mezza rapporto e' un'informazione — anzi, quel giorno e' la
 * piu' importante che ci sia.**
 */
export function fabbricaIlRapporto({
  identita,
  casa,
  ferro,
  aggiornamenti = null,
  /* Chi sa prendere l'icona vera di un aggiornamento e le sue note intere.
   * Senza, il rapporto esce come prima: un marchio e basta. */
  segni = null,
  /* Quali segni il quadro ha detto di non avere, l'ultima volta che ha
   * risposto. Una funzione e non un elenco: il valore cambia a ogni giro, e
   * chi fabbrica il rapporto si costruisce una volta sola. */
  segniChiesti = () => [],
  lavori = null,
  manutenzione = false,
  plance = null,
  configurazione = null,
  dispositivi = null,
  chiamata = null,
  versioni = {},
  ogni = OGNI_DI_SERIE,
  apparatiScelti = () => [],
  registro,
  adesso = () => Date.now(),
}) {
  const zitto = registro ?? { debug() {}, info() {}, attenzione() {}, errore() {} };

  /* Ognuna di queste va per conto suo: una che cade lascia fuori il suo pezzo
   * e non porta via le altre. */
  const forse = async (che, cosa) => {
    try {
      return await cosa();
    } catch (errore) {
      zitto.debug(`il rapporto resta senza ${che}: ${errore?.message || errore}`);
      return null;
    }
  };

  /* I due registri, tenuti da parte per cinque minuti. Stanno qui e non in una
   * classe perche' li vuole un pezzo solo del rapporto, e una classe in piu'
   * per due `Map` e' una classe in piu' da tenere a mente.
   *
   * Uno dei due che non risponde li butta tutti e due: senza quello delle
   * entita' non si sa di chi e' un'entita', senza quello dei dispositivi non
   * si sa come si chiama un dispositivo, e mezza risposta darebbe nomi a
   * meta'. `iNomi` sa gia' cavarsela senza, con i nomi delle entita'. */
  let registri = null;
  let registriLettiIl = 0;
  const iRegistri = async () => {
    const ora = adesso();
    if (registri && ora - registriLettiIl < REGISTRI_DURANO) return registri;
    const [dispositivi, entita] = await Promise.all([
      casa.chiedi({ type: "config/device_registry/list" }),
      casa.chiedi({ type: "config/entity_registry/list" }),
    ]);
    registri = { dispositivi, entita };
    registriLettiIl = adesso();
    return registri;
  };

  return async () => {
    const [detto, stati, daFare, registriOra] = await Promise.all([
      forse("il ferro", () => ferro.chiedi()),
      forse("le entita'", () => casa.chiedi({ type: "get_states" })),
      aggiornamenti ? forse("gli aggiornamenti", () => aggiornamenti.elenco()) : null,
      forse("i registri", iRegistri),
    ]);
    const quelli = Array.isArray(stati) ? stati : null;

    /* I marchi si chiedono **dopo** l'elenco, perche' e' l'elenco che dice di
     * quali. Uno per aggiornamento che aspetta, e in una casa normale sono
     * due o tre; la risposta se la tiene `Aggiornamenti` finche' l'elenco non
     * si muove, quindi il minuto dopo non si richiede niente.
     *
     * Uno che non risponde lascia il suo senza marchio e non porta via gli
     * altri: `Promise.all` su `forse` non solleva mai. */
    const marchi = new Map(
      daFare
        ? await Promise.all(
            daFare.map(async (uno) => [
              uno.entita,
              (await forse("un marchio", () => aggiornamenti.marchioDi(uno.entita))) ?? "",
            ]),
          )
        : [],
    );

    /* E le icone e le note che il quadro ha detto di non avere. Solo quelle:
     * il perche' sta in cima a `segni.js`. Uno che non arriva lascia il suo
     * senza icona e non porta via gli altri. */
    const iSegni =
      segni && daFare
        ? ((await forse("i segni", () => segni.quelliCheMancano(segniChiesti(), daFare))) ??
          new Map())
        : new Map();

    return compila({
      casa: identita.casa,
      ogni,
      adesso,
      versioni: {
        ...versioni,
        ha: detto?.core?.version ?? versioni.ha ?? "",
        supervisor: detto?.supervisor?.version ?? "",
        sistema: detto?.os?.version
          ? `Home Assistant OS ${detto.os.version}`
          : (detto?.host?.operating_system ?? ""),
      },
      macchina: detto
        ? laMacchina({ os: detto.os, host: detto.host, stati: quelli ?? [], adesso })
        : null,
      rete: detto?.network
        ? laRete({ network: detto.network, filoSu: chiamata?.accesa === true })
        : null,
      apparati: quelli ? gliApparati(quelli, { scelte: apparatiScelti() }) : null,
      addon: detto ? gliAddon({ addons: detto.addons }) : null,
      aggiornamenti: daFare ? iConti(daFare, marchi, iSegni) : null,
      /* Il secondo interruttore, detto al quadro.
       *
       * Serve a lui per sapere se il tasto lo puo' far vedere: chi guarda una
       * casa chiusa deve leggere «questa casa non ha aperto la manutenzione»
       * invece di premere un tasto che non fa niente. Il **no** vero pero' non
       * sta qui — sta in `lavori.js`, in casa: un quadro che mandasse il
       * comando lo stesso si sentirebbe rispondere di no da questa parte. */
      manutenzione: manutenzione === true,
      /* L'ultimo lavoro chiesto dal quadro, e com'e' andata. `null` quando non
       * ne e' mai stato chiesto nessuno. */
      lavoro: lavori ? lavori.stato(daFare) : null,
      plance: plance ? lePlance(plance, configurazione) : null,
      telefoni: dispositivi ? iTelefoni(dispositivi, adesso) : null,
      fuori: chiamata ? { acceso: Boolean(chiamata.dove), filo: chiamata.accesa === true } : null,
      entita: quelli ? leEntita(quelli, { registri: registriOra }) : null,
      batterie: quelli ? leBatterie(quelli) : null,
      backup: quelli ? ilBackup(quelli, { adesso }) : null,
    });
  };
}

/* Quanto e' lungo l'indirizzo delle note che si accetta. Non e' una misura
 * di sicurezza, e' un tetto: un `release_url` di diecimila caratteri e' un
 * rapporto che diventa grande per niente. */
const INDIRIZZO_MASSIMO = 300;

/* L'indirizzo delle note lunghe, se e' un indirizzo da far vedere.
 *
 * Arriva da un attributo dell'entita', cioe' da fuori, e nel quadro diventa un
 * collegamento su cui chi ha montato l'impianto clicca. Percio' passa solo
 * `https://`: `javascript:` in un `href` e' un programma, e `http://` e'
 * l'unica cosa che nel 2026 non si manda a cliccare a nessuno. Quello che non
 * passa diventa stringa vuota, e nel quadro il collegamento non c'e' — le note
 * brevi si leggono lo stesso. */
function lIndirizzoDelleNote(dove) {
  const quale = String(dove ?? "").trim();
  if (quale.length > INDIRIZZO_MASSIMO) return "";
  return /^https:\/\/[^\s"'<>]+$/i.test(quale) ? quale : "";
}

/* Quanti aggiornamenti aspettano, e di che razza. Le voci arrivano gia' fatte
 * da `aggiornamentiDaFare`, che e' lo stesso elenco che vede chi apre l'app:
 * chi guarda il quadro e chi guarda la casa non devono contare due numeri
 * diversi.
 *
 * `marchi` e' entita' → parola, e l'entita' si usa **qui** per pescare il
 * marchio giusto: nel foglio che parte non ci va, e non e' una dimenticanza.
 * `update.camera_di_marco_firmware` direbbe cosa c'e' in questa casa e in
 * quale stanza, e non e' quello che il quadro deve sapere per far vedere che
 * c'e' una versione nuova. */
function iConti(daFare, marchi = new Map(), segni = new Map()) {
  const elenco = Array.isArray(daFare) ? daFare : [];
  const suo = (uno) => /home.?assistant/i.test(String(uno.nome ?? ""));
  return {
    quanti: elenco.length,
    ha: elenco.some(suo),
    gdahome: elenco.some((uno) => uno.nostra === true),
    /* Quello che non si installa da se' e' un firmware: si porta col
     * cacciavite, e vederlo contato a parte dice all'installatore se gli
     * conviene mettersi in macchina. */
    firmware: elenco.filter((uno) => uno.installabile !== true).length,
    addon: elenco.filter((uno) => uno.installabile === true && !uno.nostra && !suo(uno)).length,
    elenco: elenco.map((uno) => {
      /* Il segno di questo aggiornamento: l'impronta di quello che nella riga
       * c'e' gia' — il nome e la versione — e nient'altro. Serve al quadro per
       * due cose: chiedere l'icona e le note che non ha, e ritrovarle quando
       * arrivano. L'entita' non passa di qui, e il perche' sta in cima a
       * `segni.js`.
       *
       * Questa riga mancava, ed e' quella che teneva spenta tutta la
       * faccenda: `iConti` prendeva i segni come terzo argomento — glieli
       * passavamo — ma la firma ne dichiarava due e la riga non ne emetteva
       * nessuno. Il quadro non vedeva mai un segno, quindi non ne chiedeva
       * mai uno, quindi non arrivava mai un'icona. Tutto il lavoro girava a
       * vuoto, e le prove guardavano i pezzi invece del giro intero. */
      const segno = ilSegnoDi(uno.nome, uno.a);
      return {
        nome: String(uno.nome ?? ""),
        da: String(uno.da ?? ""),
        a: String(uno.a ?? ""),
        nostra: uno.nostra === true,
        installabile: uno.installabile === true,
        stacca: uno.stacca === true,
        segno,
        /* E, se il quadro l'aveva chiesta, l'icona o le note — o il fatto che
         * non esistono. */
        ...(segni.get(segno) ?? {}),
        /* Il marchio: una parola, non un indirizzo. Il perche' sta su
         * `marchioDi`, in `aggiornamenti.js`. */
        marchio: String(marchi.get(uno.entita) ?? ""),
        /* Cosa cambia, con le parole di chi l'ha scritto: e' il
         * `release_summary` dell'entita', che Home Assistant taglia gia' a 255
         * caratteri. Sono le stesse righe che l'app fa leggere prima di premere
         * «Installa», e sono la differenza fra un tasto premuto sapendo cosa fa
         * e uno premuto al buio. Quelle lunghe stanno all'indirizzo qui sotto,
         * e per leggerle serve il filo con la casa — che il quadro non ha. */
        cosaCambia: String(uno.dettagli ?? ""),
        note: lIndirizzoDelleNote(uno.note),
      };
    }),
  };
}

/* Quante plance ci sono, e quante hanno qualcosa dentro. Una plancia vuota e'
 * un impianto lasciato a meta', ed e' uno dei dieci controlli del quadro. */
function lePlance(plance, configurazione) {
  const elenco = typeof plance.elenco === "function" ? plance.elenco() : [];
  if (!configurazione) return { quante: elenco.length, configurate: 0 };
  const configurate = elenco.filter((una) => {
    try {
      const dentro = configurazione.leggi(una.profilo);
      return Boolean(dentro && Object.keys(dentro).length);
    } catch (_errore) {
      return false;
    }
  }).length;
  return { quante: elenco.length, configurate };
}

/* Quanti telefoni sono abbinati, e quanti si sono fatti vedere in una
 * settimana. Il secondo numero conta piu' del primo: e' quello che dice se
 * l'app in quella casa la usa qualcuno o se e' stata provata una volta e
 * basta. */
function iTelefoni(dispositivi, adesso) {
  const elenco = typeof dispositivi.elenco === "function" ? dispositivi.elenco() : [];
  const settimana = adesso() - 7 * 24 * 60 * 60 * 1000;
  return {
    abbinati: elenco.length,
    visti7gg: elenco.filter((uno) => Number(uno.vistoIl || 0) >= settimana).length,
  };
}

/**
 * Il postino: l'orologio, e un tentativo che se fallisce rallenta.
 *
 * Non sa cosa ci sia in un rapporto: gliela fabbrica `fabbrica`, e lui la
 * porta. Cosi' questa classe si prova con una funzione che torna `{}` e una
 * `fetch` finta, senza montare mezzo ponte.
 */
/**
 * Perche' non e' arrivata, detto a qualcuno.
 *
 * `fetch` di Node, quando qualcosa va storto sotto, alza sempre lo stesso
 * «fetch failed» e mette la ragione vera in `cause`. Quel messaggio finisce
 * nella scheda che legge **chi abita la casa**, e «fetch failed» non gli dice
 * niente e non gli fa fare niente: non sa se e' rotta la sua rete, se il quadro
 * e' spento, o se ha incollato un codice sbagliato.
 *
 * Qui si traducono i pochi casi che capitano davvero. Gli altri passano come
 * sono — inventare una frase per un errore che non si conosce vuol dire mandare
 * qualcuno a cercare la cosa sbagliata.
 */
export function perchePreciso(errore) {
  const codice = errore?.cause?.code || "";
  const sotto = errore?.cause?.message || "";

  if (codice === "ENOTFOUND" || codice === "EAI_AGAIN") {
    return "l'indirizzo del quadro non si trova: o non c'e' rete, o quel quadro non e' ancora acceso";
  }
  if (codice === "ECONNREFUSED") return "il quadro c'e' ma non risponde su quella porta";
  if (codice === "ECONNRESET") return "la connessione col quadro e' caduta a meta'";
  if (codice === "CERT_HAS_EXPIRED") return "il certificato del quadro e' scaduto";
  if (codice === "DEPTH_ZERO_SELF_SIGNED_CERT" || codice === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
    return "il certificato del quadro non e' firmato da nessuno di conosciuto";
  }
  if (errore?.name === "TimeoutError" || codice === "UND_ERR_CONNECT_TIMEOUT") {
    return "il quadro non ha risposto in tempo";
  }

  /* Meglio la ragione sotto che il «fetch failed» che la nasconde. */
  return sotto || String(errore?.message || errore);
}

export class Postino {
  constructor({
    dove = "",
    chiave = "",
    casa = "",
    ogni = OGNI_DI_SERIE,
    fabbrica,
    fai = null,
    installatore = null,
    fetch: prendi = globalThis.fetch,
    registro,
    adesso = () => Date.now(),
    primaAspetta = PRIMA_ASPETTA,
  } = {}) {
    this.dove = String(dove || "").replace(/\/+$/, "");
    this.chiave = String(chiave || "");
    this.casa = String(casa || "");
    this.ogni = ogniQuanto(ogni);
    this.fabbrica = fabbrica;
    /* Cosa fare quando il quadro, rispondendo, chiede qualcosa.
     *
     * E' l'unica strada per cui un comando entra in questa casa, e passa
     * **dentro una risposta**: la casa bussa, e qualche volta chi apre le dice
     * qualcosa. Non c'e' nessuna porta aperta verso il quadro, nessun buco nel
     * router, niente da difendere. Chi non bussa non riceve niente.
     *
     * Vuoto e' il caso normale finche' la manutenzione non e' aperta: il
     * postino allora quella riga della risposta non la guarda nemmeno. */
    this.fai = fai;
    /* Chi tiene il nome e il marchio di chi segue questa casa. Il quadro li
     * dice rispondendo, e da li' la plancia prende la sua faccia. */
    this.installatore = installatore;
    this.prendi = prendi;
    this.registro = registro ?? { debug() {}, info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this.primaAspetta = primaAspetta;

    this._orologio = null;
    this._quanteVoltePerNiente = 0;
    /* L'ultimo rapporto spedito, in chiaro, e com'e' andata. Sono le due cose
     * che la console dell'add-on fa leggere a chi ci abita: non «manda dei
     * dati», ma **questi** dati, parola per parola. */
    this._ultima = null;
    this._ultimoEsito = null;
    /* Il nome dell'installatore, come lo dice il quadro rispondendo. In memoria e
     * basta: dopo un riavvio si riempie al primo rapporto. */
    this._chi = "";

    /* ─── Il filo tenuto aperto ────────────────────────────────────────
     *
     * Dopo ogni rapporto questa casa lascia una richiesta al quadro che **non
     * si chiude**: se qualcuno preme «Installa» lo sente nell'istante, invece
     * di aspettare il rapporto del minuto dopo. Fra il tasto e
     * l'installazione che parte passa un giro di rete.
     *
     * Non sostituisce niente: il rapporto al minuto continua, e porta il
     * lavoro come ha sempre fatto. Se il filo non si puo' tenere — un proxy
     * che taglia le richieste lunghe, il quadro spento — si perde la fretta e
     * non si perde il comando.
     *
     * E resta una casa che **bussa**: qui non si apre nessuna porta, non c'e'
     * niente in ascolto e niente da difendere. E' la stessa regola del
     * rapporto, tenuta piu' a lungo. */
    this._filo = null;
    this._quanteVolteIlFiloCade = 0;
    this._fermato = false;
    /* Quando e' cominciato l'ultimo giro, e l'orologio che ne aspetta uno
     * nuovo: insieme sono il pavimento di `IL_FILO_ALMENO`. */
    this._filoDa = 0;
    this._filoDopo = null;
    /* Quali icone e quali note il quadro ha detto di non avere, l'ultima volta
     * che ha risposto. Chi fabbrica il rapporto lo legge al giro dopo. Vive
     * col processo: un ponte che si riavvia non manda niente finche' il quadro
     * non ridice cosa gli manca, che e' quello che si vuole. */
    this._segniChiesti = [];
  }

  /** I segni che il quadro ha detto di non avere. Lo legge chi fabbrica. */
  get segniChiesti() {
    return this._segniChiesti;
  }

  /** Se questa casa manda qualcosa a qualcuno. */
  get acceso() {
    return Boolean(this.dove && this.chiave && this.casa);
  }

  get ultima() {
    return this._ultima;
  }

  /** Il nome dell'installatore che riceve, come l'ha detto il quadro. */
  get chi() {
    return this._chi || "";
  }

  get ultimoEsito() {
    return this._ultimoEsito;
  }

  parti() {
    if (!this.acceso || this._orologio) return;
    this._fermato = false;
    this.registro.info(`il rapporto va a ${this.dove}, ogni ${this.ogni} minuti`);
    const giro = () => {
      void this.manda();
      this._riarma();
    };
    this._orologio = setTimeout(giro, this.primaAspetta);
    this._orologio.unref?.();
  }

  ferma() {
    if (this._orologio) clearTimeout(this._orologio);
    this._orologio = null;
    this._fermato = true;
    if (this._filoDopo) clearTimeout(this._filoDopo);
    this._filoDopo = null;
    /* Il filo si taglia da qui: una richiesta tenuta aperta non finisce da
     * sola, e senza questo il ponte non si spegnerebbe piu'. */
    if (this._filo) {
      const quello = this._filo;
      this._filo = null;
      try {
        quello.abort();
      } catch (_errore) {
        /* Gia' chiuso: e' quello che si voleva. */
      }
    }
  }

  _riarma() {
    if (!this._orologio) return;
    const quanto =
      this.ogni * 60 * 1000 * Math.min(RALLENTA_FINO_A, 2 ** this._quanteVoltePerNiente);
    this._orologio = setTimeout(() => {
      void this.manda();
      this._riarma();
    }, quanto);
    this._orologio.unref?.();
  }

  /** Un rapporto, adesso. Torna `true` se e' arrivata. */
  async manda() {
    if (!this.acceso) return false;
    let foglio;
    try {
      foglio = await this.fabbrica();
    } catch (errore) {
      /* Un rapporto che non si riesce a compilare non e' un guasto del
       * quadro: si dice e si riprova al giro dopo, senza rallentare. */
      this._ultimoEsito = {
        andata: false,
        quando: this.adesso(),
        perche: String(errore?.message || errore),
      };
      this.registro.attenzione(
        `il rapporto non si e' potuta compilare: ${errore?.message || errore}`,
      );
      return false;
    }
    this._ultima = foglio;

    try {
      const risposta = await this.prendi(`${this.dove}/rapporto`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          /* La chiave in testa e non nel corpo: cosi' non finisce dentro
           * quello che la console fa leggere a chi ci abita. */
          authorization: `Bearer ${this.chiave}`,
          "x-casa": this.casa,
        },
        body: JSON.stringify(foglio),
        signal: AbortSignal.timeout(ATTESA),
      });
      if (!risposta.ok) {
        this._perNiente(`il quadro ha risposto ${risposta.status}`);
        return false;
      }
      if (this._quanteVoltePerNiente) {
        this.registro.info("il quadro risponde di nuovo");
        this._quanteVoltePerNiente = 0;
      }

      /* Di chi e' il quadro che ha ricevuto.
       *
       * Arriva **nella risposta** e non nel codice incollato, perche' nel
       * codice c'e' solo un codice: la casa non ha altro modo di saperlo. Serve
       * a una cosa sola — la scheda in questa console, dove chi ci abita legge
       * a chi vanno i suoi numeri. «Impianti Rossi» gli dice qualcosa, un
       * indirizzo no.
       *
       * Sta in memoria e non su disco: dopo un riavvio la scheda mostra
       * l'indirizzo finche' non parte il primo rapporto, che e' un quarto
       * d'ora. Scriverlo in `/data` per un quarto d'ora di comodo vorrebbe dire
       * un file in piu' da tenere buono per sempre. */
      let detto = null;
      try {
        detto = await risposta.json();
        if (typeof detto?.di === "string") this._chi = detto.di.slice(0, 80);
        /* Quali icone e quali note gli mancano. Al giro dopo partono quelle, e
         * nessun'altra: il perche' sta in cima a `segni.js`.
         *
         * E se **non** ne chiede piu' — cioe' se `manca` non c'e' — l'elenco si
         * svuota. Prima si teneva quello di prima, e voleva dire rimandare le
         * stesse icone ogni minuto per sempre: arrivate, salvate, e rimandate
         * al giro dopo perche' nessuno aveva detto «basta». Una risposta buona
         * che non chiede niente **e'** quel «basta». */
        this._segniChiesti = Array.isArray(detto?.manca)
          ? detto.manca
              .filter((uno) => typeof uno === "string" && /^[0-9a-f]{16}$/.test(uno))
              .slice(0, 40)
          : [];
      } catch (_errore) {
        /* Una risposta che non e' JSON non e' un guasto: il rapporto e'
         * arrivata, ed e' quello che conta. Il nome resta quello di prima. */
      }

      this._ultimoEsito = { andata: true, quando: this.adesso(), perche: "" };

      /* E qui, se c'e', quello che il quadro ha chiesto.
       *
       * Dopo aver segnato che il rapporto e' arrivata, e non prima: un lavoro
       * che non parte non deve far sembrare caduto un rapporto che invece e'
       * arrivata. Si aspetta che finisca perche' quello che fa — far partire
       * un'installazione — ci mette poco: chi installa non aspetta la fine, e
       * `installa` torna appena Home Assistant ha preso il comando.
       *
       * Quello che va storto lo scrive `Lavori` nel suo stato, e si legge nel
       * rapporto del minuto dopo. Qui non si rompe niente. */
      /* Chi segue questa casa, e con che segno. Prima del lavoro: e' roba da
       * disegnare, non da far succedere, e un'installazione che parte non deve
       * lasciare la plancia vestita di ieri. */
      if (this.installatore && detto) {
        try {
          await this.installatore.dice(detto);
        } catch (errore) {
          this.registro.debug(`il marchio di chi segue questa casa: ${errore?.message || errore}`);
        }
      }

      if (this.fai && detto?.fai) {
        try {
          await this.fai(detto.fai);
        } catch (errore) {
          this.registro.attenzione(`il lavoro chiesto dal quadro non e' partito: ${errore}`);
        }
      }
      /* E si torna in linea. Non si aspetta: il filo dura un minuto, e questa
       * funzione deve tornare a chi l'ha chiamata. */
      void this._restaInLinea();
      return true;
    } catch (errore) {
      this._perNiente(perchePreciso(errore));
      return false;
    }
  }

  /**
   * Resta in linea col quadro, e riparti appena ti risponde.
   *
   * Una richiesta per volta: se ce n'e' gia' una aperta non se ne apre una
   * seconda. Chi chiama non aspetta — questo giro vive per conto suo, accanto
   * all'orologio del rapporto.
   *
   * Il giro e' sempre lo stesso: si chiede, si aspetta. Se torna un lavoro lo
   * si fa e si manda **subito** un rapporto — se no chi ha premuto il tasto
   * vedrebbe partire l'installazione e poi un minuto di niente — e quel
   * rapporto riapre il filo da se'. Se torna a mani vuote si riapre e basta.
   */
  async _restaInLinea() {
    if (!this.acceso || this._fermato || this._filo || this._filoDopo) return;
    /* Il pavimento, all'ingresso: vedi `IL_FILO_ALMENO`. */
    const passato = this.adesso() - this._filoDa;
    if (passato < IL_FILO_ALMENO) {
      this._filoDopo = setTimeout(() => {
        this._filoDopo = null;
        void this._restaInLinea();
      }, IL_FILO_ALMENO - passato);
      this._filoDopo.unref?.();
      return;
    }
    this._filoDa = this.adesso();
    const taglia = new AbortController();
    this._filo = taglia;
    /* Un orologio nostro, e non solo `AbortSignal.timeout`: serve poterlo
     * fermare quando la risposta arriva prima, se no resterebbe acceso a
     * tenere in piedi il processo. */
    const orologio = setTimeout(() => taglia.abort(), IL_FILO_DURA);
    orologio.unref?.();
    let detto = null;
    try {
      const risposta = await this.prendi(`${this.dove}/attesa`, {
        headers: {
          authorization: `Bearer ${this.chiave}`,
          "x-casa": this.casa,
        },
        signal: taglia.signal,
      });
      if (!risposta.ok) throw new Error(`il quadro ha risposto ${risposta.status}`);
      detto = await risposta.json().catch(() => ({}));
      this._quanteVolteIlFiloCade = 0;
    } catch (errore) {
      /* Il filo e' un di piu': se cade non si dice niente ad alta voce — il
       * rapporto al minuto continua a funzionare — e si riprova piano. */
      this.registro.debug(`il filo col quadro: ${errore?.message || errore}`);
      clearTimeout(orologio);
      this._filo = null;
      this._riapriIlFilo();
      return;
    }
    clearTimeout(orologio);
    this._filo = null;
    if (this._fermato) return;

    if (this.fai && detto?.fai) {
      try {
        await this.fai(detto.fai);
      } catch (errore) {
        this.registro.attenzione(`il lavoro chiesto dal quadro non e' partito: ${errore}`);
      }
      /* Un rapporto adesso, che dice com'e' andata **e** riapre il filo. Senza,
       * chi ha premuto il tasto resterebbe a guardare uno schermo fermo per un
       * minuto buono, con l'installazione gia' partita. */
      void this.manda();
      return;
    }
    void this._restaInLinea();
  }

  _riapriIlFilo() {
    if (!this.acceso || this._fermato) return;
    this._quanteVolteIlFiloCade = Math.min(
      IL_FILO_RALLENTA_FINO_A,
      this._quanteVolteIlFiloCade + 1,
    );
    const quanto = IL_FILO_RIPROVA * 2 ** (this._quanteVolteIlFiloCade - 1);
    const orologio = setTimeout(() => void this._restaInLinea(), quanto);
    orologio.unref?.();
  }

  _perNiente(perche) {
    this._ultimoEsito = { andata: false, quando: this.adesso(), perche };
    /* Detto una volta, non a ogni giro: un quadro spento per un giorno
     * riempirebbe il registro dell'add-on di novantasei righe uguali, e un
     * registro che si ripete e' un registro che non si legge piu'. */
    if (!this._quanteVoltePerNiente) this.registro.attenzione(`il rapporto non arriva: ${perche}`);
    this._quanteVoltePerNiente += 1;
  }
}
