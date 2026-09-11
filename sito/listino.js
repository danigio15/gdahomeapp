/* Il listino del sito.
 *
 * È la copia di `app/lib/schermate/acquisti/catalogo.dart`, che nel progetto
 * è il posto dove stanno i prezzi: li leggono la schermata dell'app, la
 * scheda «Acquisti» della console dell'add-on e `docs/ACQUISTI.md`. Qui ce
 * n'è una quarta copia, ed è l'unica del sito: la sezione dei piani e la
 * schermata Acquisti dentro la plancia dimostrativa leggono tutte e due da
 * qui. Tre posti che dicono tre prezzi diversi è il modo più rapido di
 * perdere la fiducia di chi paga.
 *
 * Quando cambia il catalogo dell'app, cambia anche questo file. Non è
 * generato apposta: un prezzo si scrive guardandolo.
 */

window.LISTINO = {
  /* Quello che non si paga, e non si pagherà. Sta in cima e non in una nota
   * a piè di pagina: chi legge deve vedere per primo cosa **non** deve
   * comprare. */
  sempreGratis: [
    "La plancia intera, con tutte le sue pagine",
    "Comandare la casa da fuori, dal centralino",
    "Più case sullo stesso telefono",
    "L'elenco dei dispositivi, e comandarli",
    "Le segnalazioni e la chat di assistenza",
    "Un dispositivo collegato: un elettrodomestico, un'auto o un robot",
    "Una telecamera nella plancia",
    "L'energia di adesso: quanto produci e quanto consumi",
    "Tre aiutanti, un'automazione, un dispositivo Zigbee",
  ],

  /* Il pacchetto: uno solo, e apre tutto. */
  casaCompleta: {
    titolo: "Casa completa",
    sotto:
      "Toglie tutti i limiti, per sempre e per tutta la casa. Comprende " +
      "anche la precedenza nelle risposte alle segnalazioni.",
    chiave: "casa.completa",
    disegno: "home",
    soldi: "19,99 €",
    quando: "una volta",
    consigliato: true,
  },

  casaCompletaAlMese: {
    titolo: "Casa completa, a mesi",
    sotto: "Le stesse cose, si disdice quando si vuole.",
    chiave: "casa.completa",
    disegno: "agenda",
    soldi: "1,99 €",
    quando: "al mese",
  },

  /* I singoli, per chi vuole una cosa sola. Messi insieme costano 35,94 €,
   * quasi il doppio del pacchetto, ed è voluto: chi ne prende due deve
   * accorgersi da sé che gli conviene l'altro. */
  singoli: [
    {
      titolo: "Dispositivi senza limite",
      sotto: "Elettrodomestici, auto elettriche e robot: quanti ne hai.",
      chiave: "app.dispositivi",
      disegno: "elettrodomestici",
      gratis: "1",
      soldi: "6,99 €",
      quando: "una volta",
    },
    {
      titolo: "Energia completa",
      sotto: "Report, analisi per dispositivo, confronti nel tempo.",
      chiave: "plancia.energia",
      disegno: "energia",
      gratis: "l'energia di adesso",
      soldi: "6,99 €",
      quando: "una volta",
    },
    {
      titolo: "Telecamere senza limite",
      sotto: "Tutte le telecamere di casa nella plancia, non una.",
      chiave: "plancia.telecamere",
      disegno: "telecamere",
      gratis: "1",
      soldi: "4,99 €",
      quando: "una volta",
    },
    {
      titolo: "Zigbee senza limite",
      sotto: "Abbina quanti dispositivi Zigbee vuoi, ZHA o Zigbee2MQTT.",
      chiave: "app.zigbee",
      disegno: "runtime",
      gratis: "1 dispositivo",
      soldi: "6,99 €",
      quando: "una volta",
    },
    {
      titolo: "Automazioni senza limite",
      sotto: "Il mago delle automazioni, senza il tetto di una.",
      chiave: "app.automazioni",
      disegno: "azioni",
      gratis: "1",
      soldi: "6,99 €",
      quando: "una volta",
    },
    {
      titolo: "Aiutanti senza limite",
      sotto: "Interruttori, numeri, testi, orari: quanti ne servono.",
      chiave: "app.aiutanti",
      disegno: "impostazioni",
      gratis: "3",
      soldi: "3,99 €",
      quando: "una volta",
    },
  ],

  /* I modi di avere le stesse cose senza passare da un negozio. */
  senzaNegozio: [
    {
      titolo: "La prova di quattordici giorni",
      sotto:
        "Al primo abbinamento tutto è acceso per due settimane, senza carta " +
        "e senza chiedere niente. Serve a vedere cosa si perde.",
      disegno: "agenda",
    },
    {
      titolo: "Un codice di sblocco",
      sotto:
        "Se hai un codice — da chi ti ha installato la casa, da una fiera, " +
        "da noi — si batte nell'app e vale subito.",
      disegno: "mie",
    },
    {
      titolo: "Chiedere lo sblocco",
      sotto:
        "Se collaudi l'app, se ci aiuti, o se hai un motivo: si chiede " +
        "dall'app e la richiesta arriva a chi può concederlo.",
      disegno: "segnalazioni",
    },
  ],
};
