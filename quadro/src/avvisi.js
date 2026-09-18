/* Quando una casa tace, e quando vale la pena dirlo.
 *
 * Fin qui il quadro andava guardato: un impianto che smette di parlare alle tre
 * di notte si scopriva la mattina dopo, aprendo la pagina. Questo pezzo e'
 * quello che lo fa lavorare mentre nessuno guarda.
 *
 * ─── La parte difficile non e' accorgersene ──────────────────────────────
 *
 * Accorgersi che una casa non parla e' una sottrazione. La parte difficile e'
 * **tacere**: un avviso che squilla a ogni riavvio di Home Assistant si
 * silenzia in una settimana, e da quel momento non avvisa piu' di niente. Un
 * cruscotto che mostra un guasto che non c'e' e' peggio di uno che non mostra
 * niente — e un messaggio che lo fa e' peggio ancora, perche' arriva addosso.
 *
 * Percio' qui ci sono quattro regole che servono tutte a **non** mandare
 * niente, e una sola che manda.
 *
 * ─── 1. Due ore, non quarantacinque minuti ───────────────────────────────
 *
 * La pagina chiama «muta» una casa che ha saltato tre cartoline
 * (`collaudo.js`, `MUTA_DOPO`): tre quarti d'ora. Va benissimo per un colore su
 * uno schermo che si sta gia' guardando, ed e' troppo poco per interrompere
 * qualcuno — un riavvio di Home Assistant, un aggiornamento, un router che si
 * riaccende ci stanno tutti dentro.
 *
 * Sono due soglie diverse perche' servono a due cose diverse: **il colore e'
 * per chi guarda, il messaggio e' per chi non sta guardando.** Chi apre la
 * pagina vede rosso prima di ricevere niente, ed e' giusto cosi'.
 *
 * ─── 2. Una volta sola ───────────────────────────────────────────────────
 *
 * Una casa muta da tre giorni e' **una** notizia, non una ogni giro. Si segna
 * quando la si e' detta, e non se ne parla piu' finche' non torna.
 *
 * ─── 3. Se tacciono in tanti insieme, non e' colpa loro ──────────────────
 *
 * Otto case su dodici che smettono nello stesso quarto d'ora non sono otto
 * guasti: e' un guasto. Un temporale su una provincia, un operatore giu', una
 * versione di gdahome che rompe qualcosa. Otto messaggi in quel momento sono la
 * cosa meno utile che si possa fare a qualcuno, e uno che dice «sono tante
 * insieme, guarda prima piu' in grande» e' un consiglio vero.
 *
 * ─── 4. Se siamo stati via noi, non e' colpa di nessuno ──────────────────
 *
 * E' la regola che nessuno scrive e che poi si paga. Se questo quadro e' stato
 * fermo tre ore — riavvio, aggiornamento, macchina spenta — al ritorno **tutte**
 * le case sembrano mute, perche' nessuno era in ascolto. Mandare quaranta
 * messaggi per un guasto nostro e' il modo piu' rapido di far disattivare gli
 * avvisi a tutti quanti.
 *
 * Quindi il giro si ricorda quando e' passato l'ultima volta. Se il buco e'
 * piu' grande del silenzio che cerca, questo giro non dice niente: riparte da
 * capo e guarda dal prossimo.
 */

const MINUTO = 60 * 1000;

/** Da quanti minuti di silenzio vale la pena mandare un messaggio. */
export const TACE_DOPO = 120;

/** Sotto questo numero di case insieme non e' un guasto piu' grande: sono loro. */
export const INSIEME_BASTA = 3;

/** E devono essere almeno questa frazione di quelle che uno segue. */
export const INSIEME_FRAZIONE = 0.25;

/* Le date qui arrivano in due forme e tutte e due sono legittime: la cartolina
 * porta un `quando` scritto in ISO dalla casa, mentre `vistaIl` e `avvisataIl`
 * li scrive questo server come numeri. `Date.parse` di un numero non e' una
 * data, ed e' il genere di sbaglio che passa le prove col dato di una forma
 * sola e poi dice «da chissa' quando» in un messaggio vero. */
const quandoE = (cosa) => (typeof cosa === "number" ? cosa : Date.parse(String(cosa ?? "")));

const minutiDa = (quando, adesso) => {
  const quanto = adesso - quandoE(quando);
  return Number.isFinite(quanto) ? Math.round(quanto / MINUTO) : null;
};

/** Da quanto non parla, in parole. */
export function quantoTace(minuti) {
  if (minuti === null) return "da chissà quando";
  if (minuti < 60) return `da ${minuti} minuti`;
  const ore = Math.round(minuti / 60);
  if (ore < 24) return `da ${ore} ${ore === 1 ? "ora" : "ore"}`;
  const giorni = Math.round(ore / 24);
  return `da ${giorni} ${giorni === 1 ? "giorno" : "giorni"}`;
}

/**
 * Siamo stati via noi?
 *
 * `ultimoGiro` e' quando questo controllo e' passato l'ultima volta. Se fra
 * allora e adesso e' passato piu' del silenzio che cerchiamo, il silenzio che
 * vediamo e' il nostro, non il loro.
 *
 * Al primo giro in assoluto (`null`) la risposta e' **si'**: un quadro appena
 * acceso non sa niente di quello che e' successo prima, e la prima cosa che fa
 * non puo' essere svegliare qualcuno per case che magari parlano da sempre.
 */
export function siamoStatiViaNoi(ultimoGiro, adesso, tacePer = TACE_DOPO) {
  if (!ultimoGiro) return true;
  return adesso - ultimoGiro > tacePer * MINUTO;
}

/**
 * Chi tace e chi e' tornato a parlare.
 *
 * Prende le case come stanno nell'archivio — con `avvisataIl` sopra, che e' il
 * segno di «di questa l'ho gia' detto» — e torna due mucchi. Non tocca niente:
 * a scrivere e' chi chiama, dopo aver mandato davvero.
 */
export function chiTace(case_, { tacePer = TACE_DOPO, adesso = Date.now() } = {}) {
  const mute = [];
  const tornate = [];
  for (const una of case_) {
    const zitta = minutiDa(una.carta?.quando ?? una.vistaIl, adesso);
    const tace = zitta !== null && zitta >= tacePer;

    if (tace && !una.avvisataIl) {
      mute.push({ casa: una, minuti: zitta });
      continue;
    }
    /* Tornata a parlare: si dice, e si dimentica. Senza questo messaggio
     * qualcuno prende la macchina per una casa che si e' rimessa a posto da
     * sola mentre lui era in strada. */
    if (!tace && una.avvisataIl) {
      tornate.push({ casa: una, minuti: minutiDa(una.avvisataIl, adesso) });
    }
  }
  return { mute, tornate };
}

/**
 * Cosa dire, in parole, a **un** installatore.
 *
 * Torna un elenco di messaggi gia' scritti — di solito zero o uno. Il testo lo
 * fa qui e non chi lo spedisce, perche' cosi' si puo' provare: un messaggio e'
 * una promessa, e le promesse in questo progetto sono prove.
 */
export function cosaDire({ mute = [], tornate = [], quante = 0 }) {
  const detti = [];

  if (mute.length) {
    const insieme =
      mute.length >= INSIEME_BASTA && quante > 0 && mute.length / quante >= INSIEME_FRAZIONE;

    if (insieme) {
      /* Un messaggio solo, e un consiglio invece di un elenco. Le case si
       * nominano lo stesso — servono a capire se hanno qualcosa in comune — ma
       * la prima riga dice gia' cosa guardare. */
      detti.push({
        tipo: "insieme",
        case: mute.map((uno) => uno.casa.casa),
        testo:
          `${mute.length} impianti su ${quante} hanno smesso di parlare insieme. ` +
          `Quando sono tanti nello stesso momento di solito non è colpa loro: ` +
          `guarda prima se c'è un guasto più grande.\n\n` +
          mute.map((uno) => `· ${ilNome(uno.casa)}`).join("\n"),
      });
    } else {
      for (const uno of mute) {
        detti.push({
          tipo: "muta",
          case: [uno.casa.casa],
          testo:
            `${ilNome(uno.casa)} non parla più ${quantoTace(uno.minuti)}.\n` +
            `L'ultima cartolina è arrivata ${quandoEra(uno.casa)}.`,
        });
      }
    }
  }

  for (const uno of tornate) {
    detti.push({
      tipo: "tornata",
      case: [uno.casa.casa],
      testo: `${ilNome(uno.casa)} ha ripreso a parlare. Era muta ${quantoTace(uno.minuti)}.`,
    });
  }

  return detti;
}

/* Il nome che gli ha dato l'installatore, o la matricola accorciata. Il
 * messaggio va a lui e a nessun altro: e' l'unico posto di tutto il quadro dove
 * quel nome esce, ed esce verso chi l'ha scritto. */
const ilNome = (una) => (una.nome ? `«${una.nome}»` : `La casa ${String(una.casa).slice(0, 13)}…`);

function quandoEra(una) {
  const quando = quandoE(una.carta?.quando ?? una.vistaIl);
  if (!Number.isFinite(quando)) return "chissà quando";
  return new Date(quando).toLocaleString("it-IT", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}
