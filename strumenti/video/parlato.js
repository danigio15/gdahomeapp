/* Il parlato del film del quadro: quello che si sente, scena per scena.
 *
 * Sta qui e non dentro `quadro.js` per la ragione per cui in un film il
 * copione e la scenografia sono due mestieri: le parole si riscrivono dieci
 * volte, e riscriverle in mezzo al markup vuol dire rileggersi il markup dieci
 * volte. Qui invece si legge come si legge un copione — nome della scena, e
 * quello che si dice — e chi lo cambia vede subito quanto dura.
 *
 * **Le due lingue stanno accanto**, `it` e `en`, come `t("…", "…")` nelle
 * scene: sono lo stesso film con le parole che cambiano, e una traduzione che
 * sta in un dizionario da un'altra parte e' una traduzione che si dimentica.
 *
 * ─── Come si lega al film ────────────────────────────────────────────────
 *
 * Ogni scena qui dentro si chiama **come la scena del film** (`scena(...)` in
 * `quadro.js`): e' quello il legame, e `voce.mjs` si lamenta se un nome non
 * torna. I pezzi di una scena si dicono in fila, con un respiro in mezzo, e il
 * primo comincia dopo `dopo` secondi dall'inizio della scena.
 *
 * **La scena aspetta la voce.** La durata scritta in `quadro.js` e' il minimo —
 * il tempo che vuole quello che si vede — e se qui dentro si dice di piu', la
 * scena si allunga fino a quando la voce ha finito. Quindi allungare una frase
 * allunga il film, e non lascia mai una voce che continua mentre lo schermo e'
 * gia' cambiato.
 *
 * Il conto lo fa `voce.mjs`, che lo scrive in `parlato-tempi.json`: li' dentro
 * c'e' quanto dura ogni scena e a che secondo comincia ogni pezzo, ed e' da
 * quei numeri che `quadro.js` fa partire le didascalie. Per vederli senza
 * toccare niente: `node strumenti/video/voce.mjs --misura`.
 *
 * **Un pezzo per didascalia**, dove si puo': le didascalie di questo film sono
 * la voce scritta, e una che arriva mentre la voce sta dicendo un'altra cosa
 * si legge come una frase a parte. Dove una scena ha tre righe che compaiono
 * una per volta — i passi dell'abbinamento, le tre cose che il quadro non fa —
 * i pezzi sono tre apposta, uno per riga.
 */

/* ── Le parole che non si leggono come sono scritte ───────────────────────
 *
 * Quello che dice la voce esce da qui, e qui sopra le frasi sono scritte come
 * si scrivono — e' un copione, lo legge una persona. Una parola pero' non
 * sempre si **dice** come si scrive: chi fa i suoni legge con le regole
 * dell'italiano, e su una parola che italiana non e' sbaglia.
 *
 * «Offline» era il caso: letto all'italiana usciva spezzato in due, «of
 * lain». Scritto «offlain» torna una parola sola.
 *
 * La regola per aggiungerne una e' la stessa che ha trovato questa: si
 * sintetizza la frase, la si fa riascoltare a un programma che trascrive, e si
 * guarda cosa ha capito. Senza quella prova si mette una storpiatura al posto
 * di un'altra — provate e scartate, in questo copione, «zigbì» per Zigbee e
 * «bàckup» per backup: si capivano **meno** di come erano scritte.
 *
 * Vale solo per l'italiano: in inglese quelle parole sono a casa loro.
 */
export const COME_SI_DICE = {
  it: [["offline", "offlain"]],
  en: [],
};

/** Quanto respiro fra un pezzo e il prossimo, dentro la stessa scena. */
export const RESPIRO = 0.45;

/** Quanto si lascia in fondo a una scena, dopo l'ultima parola. */
export const CODA = 0.7;

export const PARLATO = [
  {
    scena: "apertura",
    dopo: 0.8,
    pezzi: [
      {
        it: "Un installatore mette gdahome in quaranta case. Dopo la consegna, come stanno?",
        en: "An installer puts gdahome in forty homes. After handover — right now — how are they doing?",
      },
      {
        it: "Il quadro risponde a questa domanda. È il cruscotto di chi monta gli impianti, e sta su una macchina di gdahome: chi installa non accende niente.",
        en: "The panel answers that question. It is the dashboard of whoever installs them, and it runs on a gdahome machine: installers run nothing of their own.",
      },
    ],
  },
  {
    scena: "dopo-la-consegna",
    dopo: 0.6,
    pezzi: [
      {
        it: "In quella casa, dopo la consegna, non ci torni più. Il Wi-Fi cambia, una presa Zigbee sparisce, Home Assistant resta indietro, il backup non gira da mesi.",
        en: "After handover you never go back to that home. The Wi-Fi changes, a Zigbee plug disappears, Home Assistant falls behind, the backup hasn't run in months.",
      },
      {
        it: "Te ne accorgi quando squilla il telefono.",
        en: "You find out when the phone rings.",
      },
      {
        it: "Cioè quando il cliente è già arrabbiato.",
        en: "That is, when the customer is already angry.",
      },
    ],
  },
  {
    scena: "una-domanda-sola",
    dopo: 0.6,
    pezzi: [
      {
        it: "Il quadro risponde a una domanda sola: quell'impianto, adesso, come sta?",
        en: "The panel answers one question: that system, right now — how is it?",
      },
      {
        it: "Tre stati, e ognuno ha una forma, una parola e un colore.",
        en: "Three states, and each carries a shape, a word and a colour.",
      },
      {
        it: "Offline batte tutto: di una casa che non parla non si sa niente, nemmeno che sta bene.",
        en: "Offline beats everything: a home that isn't talking tells you nothing — not even that it's fine.",
      },
    ],
  },
  {
    scena: "come-entra-una-casa",
    dopo: 0.6,
    pezzi: [
      {
        it: "Per far entrare una casa premi Abbina: esce un codice che vive un giorno.",
        en: "To bring a home in, press Pair: out comes a code that lives one day.",
      },
      {
        it: "Si incolla nella casella dell'add-on, in casa del cliente, e può farlo anche lui.",
        en: "It goes into the add-on's field at the customer's home, and they can do it themselves.",
      },
      {
        it: "Il primo rapporto lo lega a quella casa, e non serve più a nessun'altra.",
        en: "The first report binds it to that home, and it's no use to any other.",
      },
      {
        it: "Chi lo intercettasse non aprirebbe niente: non è una porta, è il permesso di depositare righe di numeri.",
        en: "Intercepting it opens nothing: it isn't a door, it's permission to drop off rows of numbers.",
      },
    ],
  },
  {
    scena: "l-elenco",
    dopo: 0.6,
    pezzi: [
      {
        it: "Il quadro si apre sul numero che conta: quante case ti chiedono qualcosa adesso.",
        en: "The panel opens on the number that matters: how many homes need something from you now.",
      },
      {
        it: "Ogni riga è una casa: lo stato, da quanto non parla, le spie accese, e la striscia degli ultimi quattordici giorni.",
        en: "Each row is a home: its state, how long it's been quiet, the warnings lit, and the strip of the last fourteen days.",
      },
    ],
  },
  {
    scena: "i-dieci-controlli",
    dopo: 0.6,
    pezzi: [
      {
        it: "Per ogni casa, dieci controlli, guardati tutti i giorni.",
        en: "For every home, ten checks, looked at every day.",
      },
      {
        it: "Ognuno è un nome e basta: «I collegamenti», non «Sono collegati tutti».",
        en: "Each one is just a name: «Connections», not «Everything is connected».",
      },
      {
        it: "Verde, rosso, oppure — e conta — questa casa non lo dice.",
        en: "Green, red, or — and this matters — this home doesn't say.",
      },
    ],
  },
  {
    scena: "dentro-una-casa",
    dopo: 0.6,
    pezzi: [
      {
        it: "Dentro una casa: la macchina, con la sua scheda, la CPU, il disco e la temperatura. La rete, scheda per scheda. Gli add-on, uno per uno.",
        en: "Inside one home: the machine, with its board, the CPU, the disk and the temperature. The network, card by card. The add-ons, one by one.",
      },
      {
        it: "E i dispositivi che non rispondono, con i loro nomi.",
        en: "And the devices that don't answer, by name.",
      },
    ],
  },
  {
    scena: "tre-righe-che-contano",
    dopo: 0.6,
    pezzi: [
      {
        it: "La vita del disco: una eMMC ha un numero di scritture e poi finisce. Vederla salire vuol dire cambiare il supporto quando decidi tu.",
        en: "Disk life: an eMMC has a number of writes and then it's done. Watching it climb means replacing it when you choose.",
      },
      {
        it: "La tacca a settantacinque gradi. Sopra, la casa non si rompe: diventa lenta.",
        en: "The mark at seventy-five degrees: above it the home doesn't break, it gets slow.",
      },
      {
        it: "E un add-on fermo non è un add-on spento: conta solo quello che parte all'avvio ed è giù.",
        en: "And a stopped add-on isn't a switched-off one: only what starts on boot and is down counts.",
      },
      {
        it: "Dove un numero non c'è, non si inventa.",
        en: "Where a number isn't there, nothing is made up.",
      },
    ],
  },
  {
    scena: "gli-aggiornamenti",
    dopo: 0.6,
    pezzi: [
      {
        it: "Vedere che una casa è indietro e non poterci fare niente è mezzo lavoro. Qui c'è chi è indietro, da quale versione a quale, e il tasto per installare.",
        en: "Seeing a home fall behind and being unable to act is half a job. Here is who's behind, from which version to which, and the button to install.",
      },
      {
        it: "Il backup viene prima, sempre. Uno per volta. E quello che non si installa da sé non ha un tasto.",
        en: "Backup comes first, always. One at a time. And what cannot install itself gets no button.",
      },
    ],
  },
  {
    scena: "vedere-e-toccare",
    dopo: 0.6,
    pezzi: [
      {
        it: "Vedere e toccare sono due permessi, e il secondo non si dà da sé insieme al primo.",
        en: "Seeing and touching are two permissions, and the second doesn't come free with the first.",
      },
      {
        it: "La manutenzione è un secondo interruttore, spento di serie: lo accende chi abita quella casa, dalle opzioni dell'add-on.",
        en: "Maintenance is a second switch, off out of the box: it's turned on by whoever lives in that home, from the add-on's options.",
      },
      {
        it: "E quello che il quadro le ha chiesto si legge parola per parola, nella console dell'add-on.",
        en: "And whatever the panel asked of it is readable word for word, in the add-on's console.",
      },
    ],
  },
  {
    scena: "quando-una-casa-tace",
    dopo: 0.6,
    pezzi: [
      {
        it: "Quando una casa smette di parlare, il quadro scrive a un indirizzo tuo: Telegram, Slack, il tuo gestionale.",
        en: "When a home stops talking, the panel posts to an address of yours: Telegram, Slack, your own back office.",
      },
      {
        it: "La parte difficile non è accorgersene: è tacere. Aspetta due ore, lo dice una volta sola, e se il fermo è stato suo non sveglia nessuno.",
        en: "The hard part isn't noticing: it's staying quiet. It waits two hours, says it once, and wakes nobody when the outage was its own.",
      },
    ],
  },
  {
    scena: "cosa-non-puo-fare",
    dopo: 0.6,
    pezzi: [
      {
        it: "E adesso la parte che viene prima di tutte: cosa il quadro non può fare.",
        en: "And now the part that comes before all the rest: what the panel cannot do.",
      },
      {
        it: "Non apre la plancia.",
        en: "It doesn't open the dashboard.",
      },
      {
        it: "Non vede entità, stanze né persone.",
        en: "It sees no entities, rooms or people.",
      },
      {
        it: "Non tocca niente oltre il suo unico verbo, e solo dove quella casa ha aperto la manutenzione.",
        en: "It touches nothing beyond its one verb, and only where that home opened maintenance.",
      },
      {
        it: "Un elettricista sostituisce un interruttore senza leggere la posta di chi ci abita.",
        en: "An electrician replaces a switch without reading the residents' mail.",
      },
      {
        it: "Per entrare in una casa serve un abbinamento, e quello lo dà chi ci abita.",
        en: "Getting into a home takes a pairing, and that is given by whoever lives there.",
      },
    ],
  },
  {
    scena: "numeri-non-nomi",
    dopo: 0.6,
    pezzi: [
      {
        it: "Quello che una casa manda, ogni quindici minuti, sono numeri e versioni.",
        en: "What a home sends, every fifteen minutes, is numbers and versions.",
      },
      {
        it: "Restano fuori i nomi delle stanze, quelli delle persone, gli stati dei sensori, il nome del Wi-Fi, l'indirizzo pubblico, le telecamere.",
        en: "Left out are room names, people's names, sensor states, the Wi-Fi name, the public address, cameras.",
      },
      {
        it: "Cosa c'è nella scatola, non chi ci abita.",
        en: "What's in the box, not who lives in it.",
      },
    ],
  },
  {
    scena: "chiusura",
    dopo: 0.6,
    pezzi: [
      {
        it: "Il quadro è uno solo, e sta su una macchina di gdahome. All'installatore si dà una chiave, e apre una pagina.",
        en: "There is one panel, and it runs on a gdahome machine. The installer is handed a key and opens a page.",
      },
      {
        it: "Niente server, niente dominio, niente da tenere su.",
        en: "No server, no domain, nothing to keep running.",
      },
    ],
  },
];
