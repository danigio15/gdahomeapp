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
        it: "A questo serve il cruscotto installatore: è la console web di chi installa, ospitata da gdahome. Chi installa non deve mantenere nessun server.",
        en: "That is what the installer dashboard is for: the web console for whoever installs, hosted by gdahome. Installers run nothing of their own.",
      },
    ],
  },
  {
    scena: "dopo-la-consegna",
    dopo: 0.6,
    pezzi: [
      {
        it: "Dopo la consegna, in quella casa non ci torni più. Il cliente cambia il Wi-Fi, una presa Zigbee smette di rispondere, Home Assistant non viene aggiornato, il backup non viene eseguito da mesi.",
        en: "After handover you never go back to that home. The Wi-Fi changes, a Zigbee plug stops answering, Home Assistant is never updated, the backup hasn't run in months.",
      },
      {
        it: "Te ne accorgi solo quando ti chiama il cliente.",
        en: "You find out when the customer calls.",
      },
      {
        it: "Cioè quando il problema è già diventato un reclamo.",
        en: "That is, when the problem has already become a complaint.",
      },
    ],
  },
  {
    scena: "una-domanda-sola",
    dopo: 0.6,
    pezzi: [
      {
        it: "Il cruscotto risponde a una domanda sola: quell'impianto, adesso, come sta?",
        en: "The dashboard answers one question: that system, right now — how is it?",
      },
      {
        it: "Gli stati sono tre, e ognuno ha una forma, una parola e un colore: in ordine, da verificare, offline.",
        en: "There are three states, each with a shape, a word and a colour: in order, to check, offline.",
      },
      {
        it: "Lo stato offline viene prima di tutti: di un impianto che non comunica non sappiamo nulla, nemmeno che stia bene.",
        en: "Offline comes before everything: of a system that isn't reporting we know nothing — not even that it's fine.",
      },
    ],
  },
  {
    scena: "come-entra-una-casa",
    dopo: 0.6,
    pezzi: [
      {
        it: "Per collegare un impianto apri Abbinamento e premi Genera codice: esce un codice che vale un giorno e un solo impianto.",
        en: "To connect a system, open Pairing and press Generate code: you get a code that lasts one day and works for one system.",
      },
      {
        it: "In casa del cliente il codice si inserisce nella configurazione dell'add-on gdahome, nella casella «Il codice di chi ti ha fatto l'impianto». Può farlo anche il cliente.",
        en: "At the customer's home the code goes into the gdahome add-on's configuration, in the field «The code of whoever installed your home». The customer can do it themselves.",
      },
      {
        it: "Entro un minuto l'impianto compare nel cruscotto, e da quel momento il codice non funziona più su nessun altro.",
        en: "Within a minute the system shows up on the dashboard, and from then on the code works for no other.",
      },
      {
        it: "Chi intercettasse il codice non potrebbe entrare in casa: non apre nessun accesso, permette soltanto di inviare dati di stato.",
        en: "Intercepting the code gets nobody into the home: it opens no access, it only allows status data to be sent.",
      },
    ],
  },
  {
    scena: "l-elenco",
    dopo: 0.6,
    pezzi: [
      {
        it: "Il cruscotto si apre sull'anello: tutti gli impianti in un cerchio, colorato in proporzione a come stanno, e sotto i tre numeri: offline, da verificare, in ordine.",
        en: "The dashboard opens on the ring: every system in one circle, coloured in proportion to how they are, with the three counts below: offline, to check, in order.",
      },
      {
        it: "Poi le case da verificare adesso, una carta per ciascuna, con scritto cosa non va.",
        en: "Then the homes to check right now, one card each, saying what's wrong.",
      },
      {
        it: "E in fondo tutti gli impianti, una mattonella per casa: lo stato, da quanto non comunica, e la linea degli ultimi quattordici giorni.",
        en: "And at the bottom every system, one tile per home: its state, how long since it last reported, and the line of the last fourteen days.",
      },
    ],
  },
  {
    scena: "i-dieci-controlli",
    dopo: 0.6,
    pezzi: [
      {
        it: "Per ogni impianto il cruscotto esegue dieci controlli, tutti i giorni: la plancia, i telefoni, il collegamento da fuori casa, i collegamenti, gli aggiornamenti, gli add-on, la rete, la macchina, il backup e le batterie.",
        en: "For every system the dashboard runs ten checks, every day: the dashboard, the phones, access from outside, connections, updates, add-ons, network, machine, backup and batteries.",
      },
      {
        it: "Ogni controllo porta il nome di ciò che verifica: «I collegamenti», non «Sono tutti collegati».",
        en: "Each check is named after what it verifies: «Connections», not «Everything is connected».",
      },
      {
        it: "Il risultato è verde, rosso, oppure — ed è importante — «non comunicato»: il dato non è arrivato, che non è la stessa cosa di un guasto.",
        en: "The result is green, red, or — and this matters — «not reported»: the data didn't arrive, which is not the same as a fault.",
      },
    ],
  },
  {
    scena: "dentro-una-casa",
    dopo: 0.6,
    pezzi: [
      {
        it: "Un impianto si apre in un foglio. In cima, cosa non va, la matricola, quando è stato abbinato, l'ultimo rapporto e i telefoni collegati.",
        en: "A system opens in a sheet. At the top, what's wrong, the serial, when it was paired, the last report and the connected phones.",
      },
      {
        it: "Poi i capitoli: da fare, con i controlli e gli aggiornamenti; lo stato dell'impianto, con macchina, rete, add-on, gli ultimi quattordici giorni e i dispositivi; e i dettagli tecnici, con le versioni e il rapporto completo.",
        en: "Then the chapters: to do, with the checks and the updates; the system's state, with machine, network, add-ons, the last fourteen days and the devices; and the technical details, with versions and the full report.",
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
        it: "La vita del disco: una memoria eMMC sopporta un numero limitato di scritture. Seguirne il consumo permette di sostituirla prima che si guasti.",
        en: "Disk life: an eMMC memory takes a limited number of writes. Following how much is used up lets you replace it before it fails.",
      },
      {
        it: "La temperatura, con la soglia a settantacinque gradi: oltre, l'impianto non si guasta, ma rallenta.",
        en: "Temperature, with the threshold at seventy-five degrees: above it the system doesn't break, it slows down.",
      },
      {
        it: "Un add-on fermo non è un add-on spento: il cruscotto segnala solo quelli con l'avvio automatico.",
        en: "A stopped add-on isn't a switched-off add-on: the dashboard only flags the ones set to start automatically.",
      },
      {
        it: "E quando un dato non c'è, il cruscotto lo lascia vuoto invece di stimarlo.",
        en: "And when a number isn't there, the dashboard leaves it blank instead of guessing.",
      },
    ],
  },
  {
    scena: "gli-aggiornamenti",
    dopo: 0.6,
    pezzi: [
      {
        it: "Sapere che un impianto è da aggiornare e non poter intervenire serve a poco. Qui vedi quali impianti aggiornare, da quale versione a quale, e il pulsante per farlo.",
        en: "Knowing a system needs updating and not being able to act is of little use. Here you see which systems to update, from which version to which, and the button to do it.",
      },
      {
        it: "Il backup viene eseguito prima, sempre. Un impianto per volta: per questo non c'è un «installa tutti». E ciò che non si installa in automatico non ha nessun pulsante.",
        en: "Backup runs first, always. One system at a time: that's why there is no «install all». And what can't install itself gets no button.",
      },
    ],
  },
  {
    scena: "vedere-e-toccare",
    dopo: 0.6,
    pezzi: [
      {
        it: "Leggere i dati e intervenire sono due permessi distinti, e il secondo non è compreso nel primo.",
        en: "Reading the data and acting on it are two separate permissions, and the second isn't included in the first.",
      },
      {
        it: "La manutenzione da remoto è un secondo interruttore, disattivato di serie: lo attiva il cliente, dalle opzioni dell'add-on.",
        en: "Remote maintenance is a second switch, off by default: the customer turns it on, from the add-on's options.",
      },
      {
        it: "E ogni comando inviato dal cruscotto resta scritto per esteso nel registro dell'add-on.",
        en: "And every command the dashboard sends stays written out in full in the add-on's log.",
      },
    ],
  },
  {
    scena: "cosa-non-puo-fare",
    dopo: 0.6,
    pezzi: [
      {
        it: "E adesso la parte più importante: cosa il cruscotto non può fare.",
        en: "And now the part that matters most: what the dashboard cannot do.",
      },
      {
        it: "Non apre la plancia del cliente.",
        en: "It doesn't open the customer's dashboard.",
      },
      {
        it: "Non vede entità, stanze o persone.",
        en: "It sees no entities, rooms or people.",
      },
      {
        it: "Può fare tre sole cose, ognuna dove il cliente l'ha permessa: avviare un aggiornamento già in attesa, riavviare Home Assistant e, con un terzo permesso a parte, configurare la plancia, senza vederla. Nient'altro.",
        en: "It can do three things only, each where the customer allowed it: start an update already waiting, restart Home Assistant and, with a third separate permission, configure the dashboard, without seeing it. Nothing else.",
      },
      {
        it: "Come un elettricista che sostituisce un interruttore senza entrare nella vita di chi abita la casa.",
        en: "Like an electrician replacing a switch without stepping into the lives of the people who live there.",
      },
      {
        it: "Per accedere a un impianto serve un abbinamento, e lo concede il cliente.",
        en: "Getting into a system takes a pairing, and the customer is the one who grants it.",
      },
    ],
  },
  {
    scena: "numeri-non-nomi",
    dopo: 0.6,
    pezzi: [
      {
        it: "Quello che ogni impianto invia, in tempo reale, sono numeri e versioni.",
        en: "What every system sends, in real time, is numbers and versions.",
      },
      {
        it: "Restano fuori i nomi delle stanze, i nomi delle persone, gli stati dei sensori, il nome della rete Wi-Fi, l'indirizzo pubblico e le telecamere.",
        en: "Room names, people's names, sensor states, the Wi-Fi name, the public address and the cameras stay out.",
      },
      {
        it: "Il cruscotto sa cosa c'è nell'impianto, non chi abita la casa.",
        en: "The dashboard knows what's in the box, not who lives in the home.",
      },
    ],
  },
  {
    scena: "chiusura",
    dopo: 0.6,
    pezzi: [
      {
        it: "Il cruscotto è uno solo, ospitato da gdahome. All'installatore basta una chiave per aprire la pagina.",
        en: "There is one dashboard, hosted by gdahome. The installer needs only a key to open the page.",
      },
      {
        it: "Nessun server, nessun dominio, niente da mantenere.",
        en: "No server, no domain, nothing to keep running.",
      },
    ],
  },
];
