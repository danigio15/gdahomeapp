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
 * Due casi, e sono di razza diversa.
 *
 * **Il nome.** «gdahome» si scrive attaccato e si dice lettera per lettera:
 * *gi di a home*. Letto come una parola diventava «gdaòme» in italiano e
 * «gidahoum» in inglese — cioe' il nome del prodotto, detto sbagliato, due
 * volte in quattro minuti. Si scrive come si dice, e in inglese con i nomi
 * inglesi delle lettere, che per G e D suonano uguale e per la A no.
 *
 * **Le parole che italiane non sono.** «Offline» letto all'italiana usciva
 * spezzato in due, «of lain»; scritto «offlain» torna una parola sola. Questo
 * vale solo per l'italiano: in inglese quelle parole sono a casa loro.
 *
 * La regola per aggiungerne una e' quella che ha trovato queste: si sintetizza
 * la frase, la si fa riascoltare a un programma che trascrive, e si guarda cosa
 * ha capito. Senza quella prova si mette una storpiatura al posto di un'altra —
 * provate e scartate, in questo copione, «zigbì» per Zigbee e «bàckup» per
 * backup: si capivano **meno** di come erano scritte.
 */
export const COME_SI_DICE = {
  it: [
    ["gdahome", "gi di a home"],
    ["offline", "offlain"],
  ],
  en: [["gdahome", "gee dee ah home"]],
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
        it: "Un installatore mette gdahome in quaranta case. Dopo la consegna, come fa a sapere come stanno?",
        en: "An installer puts gdahome in forty homes. After handover — right now — how are they doing?",
      },
      {
        it: "A questo serve il quadro: è la console web dell'installatore, ospitata da gdahome. Chi installa non deve mantenere nessun server.",
        en: "The panel answers that question. It is the dashboard of whoever installs them, and it runs on a gdahome machine: installers run nothing of their own.",
      },
    ],
  },
  {
    scena: "dopo-la-consegna",
    dopo: 0.6,
    pezzi: [
      {
        it: "Dopo la consegna, in quella casa non ci torni più. Il cliente cambia il Wi-Fi, una presa Zigbee smette di rispondere, Home Assistant non viene aggiornato, il backup non viene eseguito da mesi.",
        en: "After handover you never go back to that home. The Wi-Fi changes, a Zigbee plug disappears, Home Assistant falls behind, the backup hasn't run in months.",
      },
      {
        it: "Te ne accorgi solo quando ti chiama il cliente.",
        en: "You find out when the phone rings.",
      },
      {
        it: "Cioè quando il problema è già diventato un reclamo.",
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
        it: "Gli stati sono tre, e ognuno ha una forma, una parola e un colore.",
        en: "Three states, and each carries a shape, a word and a colour.",
      },
      {
        it: "Lo stato offline viene prima di tutti: di un impianto che non comunica non sappiamo nulla, nemmeno che stia bene.",
        en: "Offline beats everything: a home that isn't talking tells you nothing — not even that it's fine.",
      },
    ],
  },
  {
    scena: "come-entra-una-casa",
    dopo: 0.6,
    pezzi: [
      {
        it: "Per collegare un impianto premi Abbina: il quadro genera un codice valido un giorno.",
        en: "To bring a home in, press Pair: out comes a code that lives one day.",
      },
      {
        it: "Il codice si incolla nell'add-on, in casa del cliente, che può farlo anche da solo.",
        en: "It goes into the add-on's field at the customer's home, and they can do it themselves.",
      },
      {
        it: "Al primo collegamento il codice si lega a quell'impianto, e non funziona più su nessun altro.",
        en: "The first report binds it to that home, and it's no use to any other.",
      },
      {
        it: "Chi intercettasse il codice non potrebbe entrare in casa: non apre nessun accesso, permette soltanto di inviare dati di stato.",
        en: "Intercepting it opens nothing: it isn't a door, it's permission to drop off rows of numbers.",
      },
    ],
  },
  {
    scena: "l-elenco",
    dopo: 0.6,
    pezzi: [
      {
        it: "Il quadro si apre sul dato che conta: quanti impianti richiedono un intervento adesso.",
        en: "The panel opens on the number that matters: how many homes need something from you now.",
      },
      {
        it: "Ogni riga è un impianto: lo stato, da quanto non comunica, gli avvisi attivi, e l'andamento degli ultimi quattordici giorni.",
        en: "Each row is a home: its state, how long it's been quiet, the warnings lit, and the strip of the last fourteen days.",
      },
    ],
  },
  {
    scena: "i-dieci-controlli",
    dopo: 0.6,
    pezzi: [
      {
        it: "Per ogni impianto il quadro esegue dieci controlli, tutti i giorni.",
        en: "For every home, ten checks, looked at every day.",
      },
      {
        it: "Ogni controllo porta il nome di ciò che verifica: «I collegamenti», non «Sono tutti collegati».",
        en: "Each one is just a name: «Connections», not «Everything is connected».",
      },
      {
        it: "Il risultato è verde, rosso, oppure — ed è importante — «questa casa non lo dice».",
        en: "Green, red, or — and this matters — this home doesn't say.",
      },
    ],
  },
  {
    scena: "dentro-una-casa",
    dopo: 0.6,
    pezzi: [
      {
        it: "La scheda di un impianto mostra la macchina: il modello, la CPU, il disco e la temperatura. Poi le interfacce di rete, una per una, e gli add-on installati.",
        en: "Inside one home: the machine, with its board, the CPU, the disk and the temperature. The network, card by card. The add-ons, one by one.",
      },
      {
        it: "E l'elenco dei dispositivi che non rispondono, con i loro nomi.",
        en: "And the devices that don't answer, by name.",
      },
    ],
  },
  {
    scena: "tre-righe-che-contano",
    dopo: 0.6,
    pezzi: [
      {
        it: "La vita del disco: una memoria eMMC sopporta un numero limitato di scritture. Seguirne il consumo permette di sostituirla prima che si guasti.",
        en: "Disk life: an eMMC has a number of writes and then it's done. Watching it climb means replacing it when you choose.",
      },
      {
        it: "La tacca dei settantacinque gradi: oltre questa temperatura l'impianto non si guasta, ma rallenta.",
        en: "The mark at seventy-five degrees: above it the home doesn't break, it gets slow.",
      },
      {
        it: "Un add-on fermo non è un add-on spento: il quadro segnala solo quelli impostati per avviarsi da soli.",
        en: "And a stopped add-on isn't a switched-off one: only what starts on boot and is down counts.",
      },
      {
        it: "E quando un dato non c'è, il quadro lo lascia vuoto invece di stimarlo.",
        en: "Where a number isn't there, nothing is made up.",
      },
    ],
  },
  {
    scena: "gli-aggiornamenti",
    dopo: 0.6,
    pezzi: [
      {
        it: "Sapere che un impianto è da aggiornare e non poter intervenire serve a poco. Qui vedi quali impianti aggiornare, da quale versione a quale, e il pulsante per farlo.",
        en: "Seeing a home fall behind and being unable to act is half a job. Here is who's behind, from which version to which, and the button to install.",
      },
      {
        it: "Il backup viene eseguito prima, sempre. Un impianto per volta. E ciò che non si installa in automatico non ha nessun pulsante.",
        en: "Backup comes first, always. One at a time. And what cannot install itself gets no button.",
      },
    ],
  },
  {
    scena: "vedere-e-toccare",
    dopo: 0.6,
    pezzi: [
      {
        it: "Leggere i dati e intervenire sono due permessi distinti, e il secondo non è compreso nel primo.",
        en: "Seeing and touching are two permissions, and the second doesn't come free with the first.",
      },
      {
        it: "La manutenzione da remoto è un secondo interruttore, disattivato di serie: lo attiva il cliente, dalle opzioni dell'add-on.",
        en: "Maintenance is a second switch, off out of the box: it's turned on by whoever lives in that home, from the add-on's options.",
      },
      {
        it: "E ogni comando inviato dal quadro resta scritto per esteso nel registro dell'add-on.",
        en: "And whatever the panel asked of it is readable word for word, in the add-on's console.",
      },
    ],
  },
  {
    scena: "quando-una-casa-tace",
    dopo: 0.6,
    pezzi: [
      {
        it: "Quando un impianto smette di comunicare, il quadro invia una notifica dove la leggi davvero: Telegram, Slack o il tuo gestionale.",
        en: "When a home stops talking, the panel posts to an address of yours: Telegram, Slack, your own back office.",
      },
      {
        it: "La parte difficile non è accorgersene, è evitare gli avvisi inutili. Il quadro aspetta due ore, avvisa una volta sola, e se a fermarsi è stato lui non avvisa affatto.",
        en: "The hard part isn't noticing: it's staying quiet. It waits two hours, says it once, and wakes nobody when the outage was its own.",
      },
    ],
  },
  {
    scena: "cosa-non-puo-fare",
    dopo: 0.6,
    pezzi: [
      {
        it: "E adesso la parte più importante: cosa il quadro non può fare.",
        en: "And now the part that comes before all the rest: what the panel cannot do.",
      },
      {
        it: "Non apre la plancia del cliente.",
        en: "It doesn't open the dashboard.",
      },
      {
        it: "Non vede entità, stanze o persone.",
        en: "It sees no entities, rooms or people.",
      },
      {
        it: "Non esegue nessuna operazione oltre l'aggiornamento, e solo sugli impianti che l'hanno consentito.",
        en: "It touches nothing beyond its one verb, and only where that home opened maintenance.",
      },
      {
        it: "Come un elettricista che sostituisce un interruttore senza entrare nella vita di chi abita la casa.",
        en: "An electrician replaces a switch without reading the residents' mail.",
      },
      {
        it: "Per accedere a un impianto serve un abbinamento, e lo concede il cliente.",
        en: "Getting into a home takes a pairing, and that is given by whoever lives there.",
      },
    ],
  },
  {
    scena: "numeri-non-nomi",
    dopo: 0.6,
    pezzi: [
      {
        it: "Quello che ogni impianto invia, ogni quindici minuti, sono numeri e versioni.",
        en: "What a home sends, every fifteen minutes, is numbers and versions.",
      },
      {
        it: "Restano fuori i nomi delle stanze, i nomi delle persone, gli stati dei sensori, il nome della rete Wi-Fi, l'indirizzo pubblico e le telecamere.",
        en: "Left out are room names, people's names, sensor states, the Wi-Fi name, the public address, cameras.",
      },
      {
        it: "Il quadro sa cosa c'è nell'impianto, non chi abita la casa.",
        en: "What's in the box, not who lives in it.",
      },
    ],
  },
  {
    scena: "chiusura",
    dopo: 0.6,
    pezzi: [
      {
        it: "Il quadro è uno solo, ospitato da gdahome. All'installatore basta una chiave per aprire la pagina.",
        en: "There is one panel, and it runs on a gdahome machine. The installer is handed a key and opens a page.",
      },
      {
        it: "Nessun server, nessun dominio, niente da mantenere.",
        en: "No server, no domain, nothing to keep running.",
      },
    ],
  },
];
