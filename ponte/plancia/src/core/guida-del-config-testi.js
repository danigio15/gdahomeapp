/* GENERATO da strumenti/guida-dal-manuale.mjs dai capitoli 27 e 28 di
 * docs/MANUALE.md: non si scrive a mano. Si cambia il manuale e si rifà
 * girare lo script. Vedi core/guida-del-config.js. */

/* Le schede dell'editor del Config, per linguetta (capitolo 27). */
export const GUIDE = Object.freeze({
  "visib": {
    "titolo": "Impostazioni",
    "scopo": "È la scheda che si apre per prima. Qui dai il nome alla plancia, scegli la lingua, decidi quali sezioni si vedono e in che ordine stanno nella barra.",
    "campi": [
      "<b>Generali</b>: il nome della dashboard e l'utente amministratore. Si salvano con <b>«💾 Salva generali»</b>.",
      "<b>«🌍 Lingua della plancia»</b>: con «Lingua di Home Assistant» la plancia segue il profilo di chi guarda; scegliendo una lingua la fissi per questa plancia.",
      "<b>«🖥️ Modo chiosco»</b>: la plancia a tutto schermo, sopra la barra laterale di Home Assistant. Vale solo per questa plancia e solo su questo apparecchio; sul telefono è già acceso.",
      "<b>«📌 Intestazione fissa»</b>: la parte alta (menu, nome della casa, meteo) resta ferma mentre il resto scorre. Vale solo su questo apparecchio.",
      "<b>«🗣️ Assist»</b>: aggiunge un tasto che apre l'assistente di Home Assistant, a voce o scrivendo. Puoi far leggere la risposta ad alta voce («Leggi la risposta ad alta voce») e scegliere l'«Assistente» (vuoto = automatico).",
      "<b>«Le sezioni della plancia»</b>: tutte le sezioni divise per famiglia, ognuna con il suo interruttore (visibile o nascosta) e il tasto <b>«Configura»</b> che apre la sua scheda.",
      "<b>«Ordine navbar»</b>: l'elenco delle voci della barra. Si spostano trascinandole da ⠿ o con le frecce ▲ ▼; la matita ✏️ serve a rinominare la voce.",
      "<b>«Disposizioni salvate»</b> e <b>«Disegni salvati»</b>: le pagine e i disegni che hai cambiato nelle anteprime. <b>«Ripristina»</b> li rimette come di serie.",
      "<b>«Rilevamento e manutenzione»</b>: <b>«🪄 Avvia autorilevamento»</b> e <b>«🗑️ Reset totale configurazione»</b>."
    ],
    "passi": [
      {
        "testo": "Nome e amministratore: Scrivi il nome della plancia e scegli l'utente amministratore.",
        "html": "<b>Nome e amministratore</b>: Scrivi il nome della plancia e scegli l'utente amministratore."
      },
      {
        "testo": "Premi «💾 Salva generali».",
        "html": "Premi <b>«💾 Salva generali»</b>."
      },
      {
        "testo": "Mostrare o nascondere una sezione: Scorri fino a «Le sezioni della plancia».",
        "html": "<b>Mostrare o nascondere una sezione</b>: Scorri fino a «Le sezioni della plancia»."
      },
      {
        "testo": "Tocca l'interruttore della sezione: verde = visibile.",
        "html": "Tocca l'interruttore della sezione: verde = visibile."
      },
      {
        "testo": "Per sistemarne il contenuto, premi «Configura» accanto.",
        "html": "Per sistemarne il contenuto, premi <b>«Configura»</b> accanto."
      },
      {
        "testo": "Riordinare la barra: In «Ordine navbar» trascina la voce, oppure usa ▲ ▼.",
        "html": "<b>Riordinare la barra</b>: In «Ordine navbar» trascina la voce, oppure usa ▲ ▼."
      },
      {
        "testo": "Per cambiarle nome tocca ✏️, scrivi il nuovo nome e premi Salva.",
        "html": "Per cambiarle nome tocca ✏️, scrivi il nuovo nome e premi <b>Salva</b>."
      },
      {
        "testo": "Partire con una casa nuova: Premi «🪄 Avvia autorilevamento»: la plancia esamina le entità di Home Assistant e compila da sola luci, clima, stanze, telecamere e collegamenti.",
        "html": "<b>Partire con una casa nuova</b>: Premi <b>«🪄 Avvia autorilevamento»</b>: la plancia esamina le entità di Home Assistant e compila da sola luci, clima, stanze, telecamere e collegamenti."
      },
      {
        "testo": "Controlla e correggi il risultato nelle altre schede.",
        "html": "Controlla e correggi il risultato nelle altre schede."
      }
    ],
    "consigli": [
      "<b>«Reset totale configurazione»</b> cancella tutta la configurazione salvata, su <b>tutti</b> i dispositivi collegati. Prima fai un backup (vedi 27.9).",
      "Modo chiosco e Intestazione fissa valgono solo sull'apparecchio che stai usando: su un altro tablet vanno riaccesi."
    ]
  },
  "sez0": {
    "titolo": "Home",
    "scopo": "Decide com'è fatta la pagina Home: l'ordine dei blocchi, quali stanze si vedono, il meteo e l'antifurto in testa, la riga di «pastiglie» sotto il meteo e le immagini dei riquadri.",
    "campi": [
      "<b>«🏠 Ordine dei blocchi della Home»</b>: un'anteprima con i blocchi «Intestazione e menù», «Intestazione col meteo», «Persone», «Widget», «Azioni rapide», «Stanze», «Dispositivi». Si può guardare come «Telefono», «Tablet» o «Computer».",
      "<b>«Pastiglie di stato»</b>: la riga in cima alla Home (caldaia accesa, antifurto inserito). Compare da sola quando ha qualcosa da dire.",
      "<b>«🛋️ Stanze in plancia»</b>: le stanze da mostrare in Home, con temperatura e numero di cose accese. Nessuna spuntata = nessun blocco stanze.",
      "<b>Il riquadro «🏠 Home»</b>: le entità principali della Home.",
      "Il <b>meteo</b> (un'entità <code>weather</code>). L'interruttore «Usa entità proprie per la stazione meteo», se acceso, ti lascia scegliere sensori tuoi; spento, temperatura, umidità e vento si leggono dall'entità meteo.",
      "L'<b>antifurto</b> (la centrale), con «Modalità da mostrare» (Casa, Fuori, Notte, Vacanza, Parziale: compaiono solo quelle che la centrale accetta).",
      "<b>«🚨 Quando è scattato»</b>: l'entità che dice che l'allarme sta suonando, il valore che vuol dire «scattato» (vuoto = «on»), la «Sirena (facoltativa)» e «Che cosa l'ha fatto scattare (facoltativo)».",
      "<b>«Tasti d'inserimento su misura»</b>: per chi non ha una centrale (antifurto fatto con ESPHome, script o un elenco di modalità).",
      "Accanto a ogni casella c'è <b>«NEL WIDGET»</b>: decide se quel valore compare anche nella tessera della Home.",
      "<b>«🏠 Barra sotto il meteo»</b>: le pastiglie da mostrare (Posta, Rifiuti, Sicurezza, Porte, Finestre, Luci, Temperatura, Pioggia…), l'ora dopo cui si annuncia il ritiro rifiuti di domani, e i sensori: cassetta della posta, temperatura, umidità, intensità della pioggia, pioggia caduta oggi.",
      "<b>«✨ Le tue entità nella fascia»</b>: pastiglie tue (per esempio il livello del serbatoio), anche visibili solo in certe condizioni.",
      "<b>«🖼️ Immagini dei riquadri»</b>: tutte le card della plancia (luci, clima, tapparelle, telecamere, stanze, elettrodomestici, azioni rapide, tessere della Home…). Ognuna può avere una foto o un disegno."
    ],
    "passi": [
      {
        "testo": "Riordinare i blocchi: Nell'anteprima trascina un blocco dove lo vuoi (sul telefono tieni premuto un attimo), oppure usa ▲ ▼.",
        "html": "<b>Riordinare i blocchi</b>: Nell'anteprima trascina un blocco dove lo vuoi (sul telefono tieni premuto un attimo), oppure usa ▲ ▼."
      },
      {
        "testo": "Premi «Applica». «Annulla» scarta, «Ripristina» torna all'ordine di serie.",
        "html": "Premi <b>«Applica»</b>. <b>«Annulla»</b> scarta, <b>«Ripristina»</b> torna all'ordine di serie."
      },
      {
        "testo": "Scegliere le stanze in Home: In «🛋️ Stanze in plancia» spunta le stanze che vuoi vedere.",
        "html": "<b>Scegliere le stanze in Home</b>: In «🛋️ Stanze in plancia» spunta le stanze che vuoi vedere."
      },
      {
        "testo": "Meteo e antifurto: Nel riquadro «🏠 Home» tocca la casella del meteo e scegli l'entità con «Scegli entità».",
        "html": "<b>Meteo e antifurto</b>: Nel riquadro «🏠 Home» tocca la casella del meteo e scegli l'entità con <b>«Scegli entità»</b>."
      },
      {
        "testo": "Fai lo stesso per la centrale d'allarme e togli le modalità che non usi.",
        "html": "Fai lo stesso per la centrale d'allarme e togli le modalità che non usi."
      },
      {
        "testo": "In «🚨 Quando è scattato» scegli dove si legge l'allarme e, se vuoi, la sirena.",
        "html": "In «🚨 Quando è scattato» scegli dove si legge l'allarme e, se vuoi, la sirena."
      },
      {
        "testo": "Senza centrale: «＋ Aggiungi un tasto», dai il nome e l'icona, scegli cosa premere, dove si legge se è inserito e, se vuoi, un PIN (4–8 cifre); poi «Salva il tasto».",
        "html": "Senza centrale: <b>«＋ Aggiungi un tasto»</b>, dai il nome e l'icona, scegli cosa premere, dove si legge se è inserito e, se vuoi, un PIN (4–8 cifre); poi <b>«Salva il tasto»</b>."
      },
      {
        "testo": "Barra sotto il meteo: Spunta le pastiglie che vuoi.",
        "html": "<b>Barra sotto il meteo</b>: Spunta le pastiglie che vuoi."
      },
      {
        "testo": "Scegli i sensori (posta, temperatura, umidità, pioggia) con «Scegli entità».",
        "html": "Scegli i sensori (posta, temperatura, umidità, pioggia) con «Scegli entità»."
      },
      {
        "testo": "Per aggiungerne una tua: «＋ Aggiungi un'entità», scegli l'entità, il nome, il segno e il colore e, se vuoi, quando deve comparire.",
        "html": "Per aggiungerne una tua: <b>«＋ Aggiungi un'entità»</b>, scegli l'entità, il nome, il segno e il colore e, se vuoi, quando deve comparire."
      },
      {
        "testo": "Mettere un'immagine in un riquadro: In «🖼️ Immagini dei riquadri» tocca 🖼️ accanto alla card.",
        "html": "<b>Mettere un'immagine in un riquadro</b>: In «🖼️ Immagini dei riquadri» tocca 🖼️ accanto alla card."
      },
      {
        "testo": "Scegli «Carica una foto» (dal telefono o dal computer) oppure «Scegli dai disegni».",
        "html": "Scegli <b>«Carica una foto»</b> (dal telefono o dal computer) oppure <b>«Scegli dai disegni»</b>."
      },
      {
        "testo": "Sistema l'inquadratura e lo zoom. «Togli immagine» fa tornare il disegno di sempre. Alla fine premi «💾 Salva sezione».",
        "html": "Sistema l'inquadratura e lo zoom. <b>«Togli immagine»</b> fa tornare il disegno di sempre. Alla fine premi <b>«💾 Salva sezione»</b>."
      }
    ],
    "consigli": [
      "I sensori della pioggia scelti qui sono gli stessi che usa l'<b>Irrigazione</b> (27.20) e il <b>Meteo</b> (27.17): si mettono una volta sola.",
      "La foto caricata resta in casa, nell'add-on: non passa da server esterni.",
      "L'ordine *dentro* ogni blocco non si fa qui: le persone nella loro scheda, le tessere in <b>Widget</b>, le azioni rapide in <b>Azioni</b>."
    ]
  },
  "todo": {
    "titolo": "Widget",
    "scopo": "Sceglie quali tessere si vedono nella Home e in che ordine, e prepara le tessere d'avviso che compaiono da sole.",
    "campi": [
      "<b>«Anteprima della Home»</b>: le tessere come le vedi in Home, con i valori di adesso. Si guarda come «Telefono», «Tablet» o «Computer». Si trascinano, e l'occhio le nasconde.",
      "<b>«Compaiono quando servono»</b>: le tessere che non sono in Home adesso ma arrivano da sole (Assistenza, Aggiornamenti, Caldaia, Allerte, Dispositivi non connessi, Stampanti…).",
      "<b>«Tessere compatte»</b>: «Mai», «Auto» (si stringono solo sugli schermi stretti) o «Sempre».",
      "<b>«Avvisi personalizzati a finestra»</b>: quando un avviso personalizzato si accende, la plancia lo apre da sola.",
      "<b>L'elenco di tutte le tessere</b>, con ⠿ e ▲ ▼ per l'ordine. Alcune hanno una scelta in più: Luci e Prese «Solo quando qualcosa è acceso», Elettrodomestici «Solo quando uno è in funzione», Clima e Temperatura «Cosa mostra» (la media o una sola unità/stanza).",
      "<b>«⭐ In evidenza · le tue tessere»</b>: una tessera per un'entità qualsiasi, anche di una sezione che non esiste.",
      "<b>«🔔 Widget di avviso»</b>: i sensori sorvegliati dalle tessere d'avviso (batterie, allagamenti, fumo e gas) e gli avvisi personalizzati."
    ],
    "passi": [
      {
        "testo": "Ordinare e nascondere le tessere: Nell'anteprima trascina la tessera (sul telefono tieni premuto un attimo).",
        "html": "<b>Ordinare e nascondere le tessere</b>: Nell'anteprima trascina la tessera (sul telefono tieni premuto un attimo)."
      },
      {
        "testo": "Tocca l'occhio per nasconderla.",
        "html": "Tocca l'occhio per nasconderla."
      },
      {
        "testo": "Premi «Applica». «Ripristina» torna come di serie.",
        "html": "Premi <b>«Applica»</b>. <b>«Ripristina»</b> torna come di serie."
      },
      {
        "testo": "Aggiungere una tessera «In evidenza»: Premi «＋ Aggiungi entità».",
        "html": "<b>Aggiungere una tessera «In evidenza»</b>: Premi <b>«＋ Aggiungi entità»</b>."
      },
      {
        "testo": "Scegli l'entità, il nome e, se vuoi, l'icona e la stanza.",
        "html": "Scegli l'entità, il nome e, se vuoi, l'icona e la stanza."
      },
      {
        "testo": "Accendi «Tessera a sé in Home» se la vuoi da sola; altrimenti finisce nel riassunto «In evidenza».",
        "html": "Accendi <b>«Tessera a sé in Home»</b> se la vuoi da sola; altrimenti finisce nel riassunto «In evidenza»."
      },
      {
        "testo": "Premi «Salva entità».",
        "html": "Premi <b>«Salva entità»</b>."
      },
      {
        "testo": "Aggiungere un avviso: In «🔔 Widget di avviso» scegli il tipo: «🔋 Batterie (%)», «💧 Allagamenti», «💨 Rilevatori fumo e gas» o «⭐ Personalizzato».",
        "html": "<b>Aggiungere un avviso</b>: In «🔔 Widget di avviso» scegli il tipo: «🔋 Batterie (%)», «💧 Allagamenti», «💨 Rilevatori fumo e gas» o «⭐ Personalizzato»."
      },
      {
        "testo": "Scegli l'entità con «Scegli entità».",
        "html": "Scegli l'entità con «Scegli entità»."
      },
      {
        "testo": "Premi «＋ Aggiungi avviso». Alla fine premi «💾 Salva sezione».",
        "html": "Premi <b>«＋ Aggiungi avviso»</b>. Alla fine premi <b>«💾 Salva sezione»</b>."
      }
    ],
    "consigli": [
      "Porte e finestre non si mettono più qui: le mostra la tessera Finestre, con i sensori delle tapparelle (27.25).",
      "Le tessere d'avviso restano nascoste finché non hanno qualcosa da dire: è normale non vederle."
    ]
  },
  "sez8": {
    "titolo": "Azioni",
    "scopo": "Prepara i tasti rapidi della Home, per esempio «Luci» o «Cancello». Sono anche i comandi proposti in auto e sull'orologio.",
    "campi": [
      "<b>«⚡ Azioni rapide (Home)»</b>: l'elenco delle azioni, con ▲ ▼ per l'ordine, ✏️ per modificare e 🗑️ per togliere. Per alcune puoi scegliere una stanza.",
      "<b>«GRUPPO»</b>: facoltativo. Le azioni con lo stesso gruppo stanno insieme in Home, sotto un titolo che si chiude con un tocco.",
      "<b>Il tipo di azione</b>: «💡 Popup luci — scegli TU le luci», «💡 Popup TUTTE le luci», «🔌 Popup TUTTE le prese», «❄️ Popup Clima», «🛡️ Popup Antifurto», «🧺 Popup Lavatrice», «🔀 Toggle entità», «🔊 Lettore multimediale», «📜 Script», «🎬 Scena»."
    ],
    "passi": [
      {
        "testo": "Scegli il tipo di azione dalla tendina.",
        "html": "Scegli il tipo di azione dalla tendina."
      },
      {
        "testo": "Scrivi il nome e, se vuoi, l'icona.",
        "html": "Scrivi il nome e, se vuoi, l'icona."
      },
      {
        "testo": "Per «Toggle entità», «Script» e «Scena» scegli anche l'entità da comandare. Se è un menu a tendina, scegli quale voce deve mettere.",
        "html": "Per «Toggle entità», «Script» e «Scena» scegli anche l'entità da comandare. Se è un menu a tendina, scegli quale voce deve mettere."
      },
      {
        "testo": "Se vuoi, scrivi un messaggio di conferma (per esempio «Sei sicuro?»).",
        "html": "Se vuoi, scrivi un messaggio di conferma (per esempio «Sei sicuro?»)."
      },
      {
        "testo": "Premi «＋ Aggiungi azione rapida».",
        "html": "Premi <b>«＋ Aggiungi azione rapida»</b>."
      },
      {
        "testo": "Per «Popup luci — scegli TU le luci», dopo aver premuto Aggiungi scegli le luci da una lista con ricerca.",
        "html": "Per «Popup luci — scegli TU le luci», dopo aver premuto Aggiungi scegli le luci da una lista con ricerca."
      },
      {
        "testo": "Premi «💾 Salva sezione».",
        "html": "Premi <b>«💾 Salva sezione»</b>."
      }
    ],
    "consigli": [
      "I popup «pronti» (tutte le luci, clima, antifurto…) non chiedono un'entità: basta il nome, anche facoltativo.",
      "Il messaggio di conferma è utile per le azioni che non si possono annullare, come aprire il cancello."
    ]
  },
  "automazioni": {
    "titolo": "Automazioni",
    "scopo": "Mostra tutte le automazioni di Home Assistant, a gruppi: le crei, le modifichi, le accendi e le spegni. Le esegue Home Assistant, anche con la plancia e l'app chiuse. È una funzione <b>Premium</b>.",
    "campi": [
      "<b>L'interruttore della sezione</b>: mostra o nasconde le Automazioni nella plancia.",
      "<b>«PROSSIMO»</b> e <b>«ULTIME ESEGUITE»</b>: l'automazione che partirà fra poco e quelle appena eseguite.",
      "<b>«Suggerite per la tua casa ✨»</b>: proposte fatte dai tuoi dispositivi (per esempio «avvisami quando la lavastoviglie ha finito»), con il perché. Per vederle tutte, <b>«Vedi tutte»</b>.",
      "<b>«Le automazioni di casa»</b>: l'elenco, raggruppato «Per categoria», «Per tipo» o «Per stanza», con la ricerca 🔍 e il tasto <b>«＋ Nuova»</b>."
    ],
    "passi": [
      {
        "testo": "Per un suggerimento, premi «Crea» se ti va bene, «No, grazie» per scartarlo.",
        "html": "Per un suggerimento, premi <b>«Crea»</b> se ti va bene, <b>«No, grazie»</b> per scartarlo."
      },
      {
        "testo": "Per una nuova automazione premi «＋ Nuova» (vedi il capitolo 14).",
        "html": "Per una nuova automazione premi <b>«＋ Nuova»</b> (vedi il capitolo 14)."
      },
      {
        "testo": "Per accendere, spegnere o modificare un'automazione, aprila dall'elenco.",
        "html": "Per accendere, spegnere o modificare un'automazione, aprila dall'elenco."
      }
    ],
    "consigli": [
      "Le automazioni vivono in Home Assistant: cambiarle qui le cambia anche lì."
    ]
  },
  "muro": {
    "titolo": "A muro",
    "scopo": "Configura il pannello per il tablet appeso al muro: le pagine (le linguette in alto) e cosa c'è in ognuna. È una funzione <b>Premium</b> (vedi anche 8.3).",
    "campi": [
      "<b>«Usa questa plancia a muro»</b>: vale su ogni tablet che apre questa plancia.",
      "<b>«Le pagine di questo tablet»</b>: l'elenco delle pagine.",
      "<b>«＋ Aggiungi una pagina»</b>: i tipi di pagina, fra cui Stanza, Scene, Ingresso, Personalizzata, Tutte le luci, Clima, Tutte le tapparelle, Ambienti, Telecamere, Energia, Musica, Meteo, Mixer audio, Telecamera con comandi, Comandi di regia.",
      "<b>«⚙️ Altre impostazioni»</b>: orientamento, tema, meteo, riposo, notte, luminosità, PIN."
    ],
    "passi": [
      {
        "testo": "Accendi «Usa questa plancia a muro».",
        "html": "Accendi <b>«Usa questa plancia a muro»</b>."
      },
      {
        "testo": "Premi «＋ Aggiungi una pagina» e scegli il tipo.",
        "html": "Premi <b>«＋ Aggiungi una pagina»</b> e scegli il tipo."
      },
      {
        "testo": "Compila la pagina con quello che chiede (stanza, comandi, letture…).",
        "html": "Compila la pagina con quello che chiede (stanza, comandi, letture…)."
      },
      {
        "testo": "Ripeti per ogni pagina che vuoi.",
        "html": "Ripeti per ogni pagina che vuoi."
      },
      {
        "testo": "Apri «⚙️ Altre impostazioni» per orientamento, riposo, notte, luminosità e PIN.",
        "html": "Apri <b>«⚙️ Altre impostazioni»</b> per orientamento, riposo, notte, luminosità e PIN."
      },
      {
        "testo": "Premi «💾 Salva sezione».",
        "html": "Premi <b>«💾 Salva sezione»</b>."
      }
    ],
    "consigli": [
      "Sul tablet, tenendo premuto l'orologio per due secondi si torna a questa scheda."
    ]
  },
  "entita": {
    "titolo": "Le tue entità",
    "scopo": "Aggiunge un'entità in fondo a una sezione che ha caselle fisse, come Energia o Sicurezza, dove non ci sarebbe posto per un sensore in più.",
    "campi": [
      "<b>L'elenco</b> delle entità aggiunte, con il nome e la scheda dove compaiono (per esempio «Cisterna» in Irrigazione). ✏️ per modificare, 🗑️ per togliere.",
      "<b>«＋ Aggiungi entità»</b>."
    ],
    "passi": [
      {
        "testo": "Premi «＋ Aggiungi entità».",
        "html": "Premi <b>«＋ Aggiungi entità»</b>."
      },
      {
        "testo": "Scegli l'entità con «Scegli entità».",
        "html": "Scegli l'entità con «Scegli entità»."
      },
      {
        "testo": "In «In quale scheda» scegli la sezione dove deve comparire.",
        "html": "In <b>«In quale scheda»</b> scegli la sezione dove deve comparire."
      },
      {
        "testo": "Se vuoi, scrivi un nome («Nome (facoltativo)»), scegli l'icona e la stanza.",
        "html": "Se vuoi, scrivi un nome («Nome (facoltativo)»), scegli l'icona e la stanza."
      },
      {
        "testo": "Premi «Salva entità», poi «💾 Salva sezione».",
        "html": "Premi <b>«Salva entità»</b>, poi <b>«💾 Salva sezione»</b>."
      }
    ],
    "consigli": [
      "L'entità compare in fondo alla pagina scelta. Se si può accendere, si accende da lì.",
      "Le schede fatte a elenco (Luci, Prese, Telecamere) non servono questa scheda: lì l'entità si aggiunge direttamente."
    ]
  },
  "mie": {
    "titolo": "Le tue sezioni",
    "scopo": "Crea una sezione nuova, con un titolo e le entità che vuoi tu, per le cose che la plancia non disegna ancora (per esempio un acquario).",
    "campi": [
      "<b>L'elenco delle tue sezioni</b>, ognuna con titolo, icona e numero di entità. ✏️ per modificare, 🗑️ per togliere.",
      "<b>«Mostrala nella barra»</b>: la sezione compare nella barra come le altre.",
      "<b>«Come si vedono le entità»</b>: «A righe» o «Piccole».",
      "<b>«LE ENTITÀ»</b>: le entità della sezione. Per ognuna puoi scegliere gli <b>«Attributi da mostrare»</b>."
    ],
    "passi": [
      {
        "testo": "Premi «＋ Aggiungi sezione».",
        "html": "Premi <b>«＋ Aggiungi sezione»</b>."
      },
      {
        "testo": "Scrivi il titolo e scegli l'icona.",
        "html": "Scrivi il titolo e scegli l'icona."
      },
      {
        "testo": "Premi «＋ Aggiungi entità» e scegli l'entità. Ripeti per ognuna.",
        "html": "Premi <b>«＋ Aggiungi entità»</b> e scegli l'entità. Ripeti per ognuna."
      },
      {
        "testo": "Se vuoi, apri «Attributi da mostrare» e spunta quelli che ti servono.",
        "html": "Se vuoi, apri «Attributi da mostrare» e spunta quelli che ti servono."
      },
      {
        "testo": "Accendi «Mostrala nella barra» e scegli come si vedono le entità.",
        "html": "Accendi <b>«Mostrala nella barra»</b> e scegli come si vedono le entità."
      },
      {
        "testo": "Premi «💾 Salva sezione».",
        "html": "Premi <b>«💾 Salva sezione»</b>."
      }
    ],
    "consigli": [
      "La sezione non toglie niente alle altre. Quando arriverà una sezione fatta apposta, potrai cancellare questa."
    ]
  },
  "backup": {
    "titolo": "Backup",
    "scopo": "Salva in un file tutta la configurazione della plancia (sezioni, stanze, entità, persone, auto…) e la rimette al suo posto quando serve.",
    "campi": [
      "<b>«⬇️ Scarica il backup»</b>: <b>«💾 Scarica il file»</b> (un file JSON) e <b>«📋 Copia negli appunti»</b> (lo stesso contenuto come testo).",
      "<b>«♻️ Ripristina da un backup»</b>: <b>«📁 Scegli il file»</b>, oppure incolla il testo del backup."
    ],
    "passi": [
      {
        "testo": "Fare un backup: Premi «💾 Scarica il file».",
        "html": "<b>Fare un backup</b>: Premi <b>«💾 Scarica il file»</b>."
      },
      {
        "testo": "Conserva il file in un posto sicuro.",
        "html": "Conserva il file in un posto sicuro."
      },
      {
        "testo": "Ripristinare: Premi «📁 Scegli il file» e scegli il backup, oppure incolla il testo.",
        "html": "<b>Ripristinare</b>: Premi <b>«📁 Scegli il file»</b> e scegli il backup, oppure incolla il testo."
      },
      {
        "testo": "Conferma. La plancia rimette la configurazione e si ricarica.",
        "html": "Conferma. La plancia rimette la configurazione e si ricarica."
      }
    ],
    "consigli": [
      "Il ripristino non cancella quello che nel backup non c'è: le voci assenti restano come sono.",
      "Fai un backup prima di un «Reset totale configurazione» o di grandi modifiche."
    ]
  },
  "runtime": {
    "titolo": "Runtime",
    "scopo": "",
    "campi": [],
    "passi": [],
    "consigli": []
  },
  "sez1": {
    "titolo": "Energia",
    "scopo": "Collega i sensori di energia di Home Assistant (casa, rete, fotovoltaico, batteria) alla pagina Energia e alla sua tessera in Home. Qui si mettono anche carichi, report e costi.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b>: l'anteprima della sezione com'è sulla plancia («📱 Telefono» o «🖥️ Computer»). Si apre con <b>«▶ Apri l'anteprima»</b>: si trascinano i riquadri e si nascondono con l'occhio. Telefono e computer hanno ognuno la sua disposizione.",
      "<b>Gli impianti</b>: le linguette in alto (per esempio «Impianto», «Dependance») e <b>«+ Aggiungi impianto»</b>. Ogni impianto ha il suo misuratore, il suo fotovoltaico, la sua batteria e i suoi carichi. Per ognuno: «Nome impianto» e, in Home, <b>«Una tessera sola»</b> (la somma) o <b>«Una per impianto»</b>. L'impianto principale non si può eliminare.",
      "<b>Quattro linguette</b>:",
      "<b>«FLUSSI ED ENTITÀ»</b>: i riquadri «🏠 Casa», «🔌 Rete · prelievo», «🔌 Rete · immissione», «☀️ Fotovoltaico», «🔋 Batteria · carica», «🔋 Batteria · scarica». In ognuno: «Potenza istantanea» (W), «Energia giornaliera», «Energia mensile», «Energia annuale» e «Contatore energia totale» (kWh). Accanto, l'interruttore «NEL WIDGET».",
      "<b>«CARICHI E DISPOSITIVI»</b>: i cerchi sotto la Casa (per esempio una stanza o la cucina) e gli elettrodomestici dentro ciascuno.",
      "<b>«REPORT»</b>: le voci del Report Energia, ognuna con etichetta, icona e contatore per lo storico.",
      "<b>«IMPOSTAZIONI»</b>: il costo dell'energia e le fasce orarie, la soglia di potenza, le bollette e i fornitori di energia.",
      "<b>«⚡ Come leggere la configurazione Energia»</b>: un riassunto che dice da dove la plancia legge giorno, mese, anno e storico."
    ],
    "passi": [
      {
        "testo": "I flussi: Apri la linguetta «FLUSSI ED ENTITÀ».",
        "html": "<b>I flussi</b>: Apri la linguetta <b>«FLUSSI ED ENTITÀ»</b>."
      },
      {
        "testo": "Apri il riquadro «🏠 Casa» e tocca ogni casella per scegliere il sensore con «Scegli entità».",
        "html": "Apri il riquadro «🏠 Casa» e tocca ogni casella per scegliere il sensore con «Scegli entità»."
      },
      {
        "testo": "Fai lo stesso per Rete, Fotovoltaico e Batteria.",
        "html": "Fai lo stesso per Rete, Fotovoltaico e Batteria."
      },
      {
        "testo": "Il titolo di ogni riquadro dice quante caselle hai compilato (per esempio «5/5 configurati»).",
        "html": "Il titolo di ogni riquadro dice quante caselle hai compilato (per esempio «5/5 configurati»)."
      },
      {
        "testo": "Premi «💾 Salva sezione».",
        "html": "Premi <b>«💾 Salva sezione»</b>."
      },
      {
        "testo": "Un secondo impianto: Premi «+ Aggiungi impianto» e dai il nome.",
        "html": "<b>Un secondo impianto</b>: Premi <b>«+ Aggiungi impianto»</b> e dai il nome."
      },
      {
        "testo": "Compila le sue caselle: parte da zero e non tocca il primo.",
        "html": "Compila le sue caselle: parte da zero e non tocca il primo."
      },
      {
        "testo": "Scegli se in Home vuoi una tessera sola o una per impianto.",
        "html": "Scegli se in Home vuoi una tessera sola o una per impianto."
      },
      {
        "testo": "I carichi: Apri «CARICHI E DISPOSITIVI» e premi «Aggiungi carico».",
        "html": "<b>I carichi</b>: Apri <b>«CARICHI E DISPOSITIVI»</b> e premi <b>«Aggiungi carico»</b>."
      },
      {
        "testo": "Dai il nome, l'icona e la stanza, e scegli il sensore di potenza.",
        "html": "Dai il nome, l'icona e la stanza, e scegli il sensore di potenza."
      },
      {
        "testo": "Con «Aggiungi dispositivo» o «Scegli da Elettrodomestici» metti gli apparecchi dentro il carico.",
        "html": "Con <b>«Aggiungi dispositivo»</b> o «Scegli da Elettrodomestici» metti gli apparecchi dentro il carico."
      },
      {
        "testo": "Premi «Salva carichi».",
        "html": "Premi <b>«Salva carichi»</b>."
      }
    ],
    "consigli": [
      "Il <b>«Contatore energia totale»</b> è il sensore che cresce sempre: se c'è, giorno, mese e anno vengono calcolati da lui e i sensori di periodo non vengono letti. In quel caso puoi svuotarli con <b>«Svuota i campi di periodo»</b>.",
      "Lo storico e i mesi precedenti si leggono sempre dal contatore totale.",
      "Una batteria che passa dall'inverter si mette qui, nei riquadri «Batteria · carica» e «Batteria · scarica». La scheda «Batteria di accumulo» (27.12) serve solo per vedere i pacchi uno per uno."
    ]
  },
  "accumulo": {
    "titolo": "Batteria di accumulo",
    "scopo": "Mostra i pacchi della batteria di accumulo e i loro BMS, uno per uno. Si vedono nella linguetta Batterie di Energia e nella tessera Accumulo in Home. È <b>facoltativa</b>.",
    "campi": [
      "<b>L'elenco dei pacchi</b> (all'inizio «Nessun pacco di batterie»).",
      "<b>«＋ Aggiungi pacco»</b>: apre la scheda di un pacco. Dentro: «Tipo di BMS», «Stato di carica (SoC)», «Stato di salute (SoH)», «Tensione», «Corrente», «Potenza», «Temperatura», «Temperatura MOS», «Cicli», «Capacità», «Energia residua» e le celle."
    ],
    "passi": [
      {
        "testo": "Premi «＋ Aggiungi pacco».",
        "html": "Premi <b>«＋ Aggiungi pacco»</b>."
      },
      {
        "testo": "Scegli il tipo di BMS.",
        "html": "Scegli il tipo di BMS."
      },
      {
        "testo": "Scegli l'entità dello stato di carica: è l'entità principale del pacco.",
        "html": "Scegli l'entità dello stato di carica: è l'entità principale del pacco."
      },
      {
        "testo": "Compila le altre caselle che hai (salute, tensione, temperature…).",
        "html": "Compila le altre caselle che hai (salute, tensione, temperature…)."
      },
      {
        "testo": "Premi «Trova le celle» per far cercare le tensioni delle celle.",
        "html": "Premi <b>«Trova le celle»</b> per far cercare le tensioni delle celle."
      },
      {
        "testo": "Se serve, indica il segno della corrente («Positiva in carica» o «Negativa in carica»).",
        "html": "Se serve, indica il segno della corrente («Positiva in carica» o «Negativa in carica»)."
      },
      {
        "testo": "Premi «Salva pacco», poi «💾 Salva sezione».",
        "html": "Premi <b>«Salva pacco»</b>, poi <b>«💾 Salva sezione»</b>."
      }
    ],
    "consigli": [
      "Una batteria che comunica attraverso l'inverter (per esempio una Huawei LUNA2000) non ha un BMS da scegliere: la metti in <b>Energia</b>, linguetta «Flussi ed entità» (27.11)."
    ]
  },
  "sez2": {
    "titolo": "Veicoli",
    "scopo": "Configura le auto e le moto della sezione Auto: batteria o serbatoio, autonomia, ricarica, foto. Qui si collegano anche la colonnina e evcc.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b>: l'anteprima della sezione (vedi 27.11).",
      "<b>L'elenco dei veicoli</b>, con il numero di entità collegate. ✏️ apre il veicolo, 🗑️ lo toglie, l'interruttore lo mostra o lo nasconde nella sezione.",
      "<b>«🔗 Aggiungi da un'integrazione»</b>: scegli il dispositivo (Hyundai, Tesla, Renault, BMW…) e l'auto arriva già compilata.",
      "<b>«🔌 Collega la colonnina»</b>: vale per tutte le auto. Porta potenza, energia, tensione, temperatura e lo stato del cavo.",
      "<b>«☀️ Collega evcc»</b>: modalità di ricarica, limite di carica, sessione e quota di sole.",
      "<b>«＋ Nuovo veicolo»</b>: una scheda vuota da compilare a mano."
    ],
    "passi": [
      {
        "testo": "Da un'integrazione (più semplice): Premi «🔗 Aggiungi da un'integrazione».",
        "html": "<b>Da un'integrazione (più semplice)</b>: Premi <b>«🔗 Aggiungi da un'integrazione»</b>."
      },
      {
        "testo": "Scegli il dispositivo dell'auto.",
        "html": "Scegli il dispositivo dell'auto."
      },
      {
        "testo": "Controlla le caselle compilate e salva.",
        "html": "Controlla le caselle compilate e salva."
      },
      {
        "testo": "A mano: Premi «＋ Nuovo veicolo».",
        "html": "<b>A mano</b>: Premi <b>«＋ Nuovo veicolo»</b>."
      },
      {
        "testo": "Indica se è un'auto o una moto.",
        "html": "Indica se è un'auto o una moto."
      },
      {
        "testo": "Scrivi nome, marca e modello.",
        "html": "Scrivi nome, marca e modello."
      },
      {
        "testo": "Scegli le entità, una casella alla volta.",
        "html": "Scegli le entità, una casella alla volta."
      },
      {
        "testo": "Aggiungi le due foto (anche una sola).",
        "html": "Aggiungi le due foto (anche una sola)."
      },
      {
        "testo": "Premi il tasto di salvataggio («Salva il nuovo veicolo»).",
        "html": "Premi il tasto di salvataggio («Salva il nuovo veicolo»)."
      }
    ],
    "consigli": [
      "Il veicolo da guardare si sceglie dalle linguette della sezione Auto, non da qui.",
      "Colonnina ed evcc si collegano una volta sola e valgono per tutte le auto."
    ]
  },
  "ups": {
    "titolo": "UPS",
    "scopo": "Collega i gruppi di continuità. Con la corrente presente la tessera mostra la carica della batteria; quando la corrente manca mostra i minuti che restano e si accende.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b>: l'anteprima della sezione (vedi 27.11).",
      "<b>Per ogni UPS</b>: «Nome» e le caselle «Stato dell'UPS», «Presenza rete», «Carica della batteria (%)», «Carico (%)», «Autonomia residua», «Tensione di rete (V)», «Potenza assorbita (W)», «Temperatura».",
      "<b>«Il sensore dice il contrario»</b>: da spuntare se «Presenza rete» è acceso quando la corrente <b>non</b> c'è.",
      "<b>«＋ Aggiungi un UPS»</b>."
    ],
    "passi": [
      {
        "testo": "Scrivi il nome dell'UPS.",
        "html": "Scrivi il nome dell'UPS."
      },
      {
        "testo": "Scegli almeno lo «Stato dell'UPS».",
        "html": "Scegli almeno lo <b>«Stato dell'UPS»</b>."
      },
      {
        "testo": "Compila le altre caselle che hai.",
        "html": "Compila le altre caselle che hai."
      },
      {
        "testo": "Se hai un altro UPS, premi «＋ Aggiungi un UPS» e ripeti.",
        "html": "Se hai un altro UPS, premi <b>«＋ Aggiungi un UPS»</b> e ripeti."
      },
      {
        "testo": "Premi «💾 Salva sezione».",
        "html": "Premi <b>«💾 Salva sezione»</b>."
      }
    ],
    "consigli": [
      "Nessuna casella è obbligatoria: con il solo stato dell'UPS (NUT) la tessera sa già dire se c'è corrente.",
      "L'«Autonomia residua» è il numero grande della tessera quando la corrente manca."
    ]
  },
  "sez9": {
    "titolo": "Clima",
    "scopo": "Collega condizionatori, termostati, pompe di calore, deumidificatori, ventilazione e caldaia alla pagina Clima e al popup Clima della Home.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b>: l'anteprima della sezione (vedi 27.11).",
      "<b>«❄️ Unità clima»</b>: l'elenco delle unità, con la stanza. ✏️ per modificare, 🗑️ per togliere.",
      "<b>Il modulo per una nuova unità</b>: il tipo («❄️ Freddo», «🔥 Caldo», «♨️ Pompa di calore»), «Entità clima», la stanza e «Valvola TRV (posizione %)».",
      "<b>«Tasto Clima rapido»</b>: cosa fa il tasto di questa unità nel popup Clima della Home: «Modalità» (Raffrescamento, Riscaldamento, Deumidificazione, Solo ventola), «Temperatura» e «Ventola».",
      "<b>«💧 Deumidificatori»</b>: ognuno ha una card sua.",
      "<b>«🔄 Ventilazione meccanica»</b>: la VMC con le quattro temperature, il bypass, la stagione e i filtri.",
      "<b>«🔥 Entità caldaia (switch — facoltativa)»</b>: l'entità che dice se la caldaia ha il consenso ad accendersi.",
      "<b>«🔥 Stato termico (Caldo)»</b>: caldaia, pompe e altro da mostrare acceso o spento nel popup Caldo.",
      "<b>«Mostra «Caldaia accesa» nella Home»</b> e <b>«Nelle card mostra grande l'ambiente (target sotto)»</b>."
    ],
    "passi": [
      {
        "testo": "Un'unità clima: Scegli il tipo: Freddo, Caldo o Pompa di calore.",
        "html": "<b>Un'unità clima</b>: Scegli il tipo: Freddo, Caldo o Pompa di calore."
      },
      {
        "testo": "Scegli l'«Entità clima» e la stanza.",
        "html": "Scegli l'«Entità clima» e la stanza."
      },
      {
        "testo": "Se hai una valvola termostatica, scegli la sua entità di posizione.",
        "html": "Se hai una valvola termostatica, scegli la sua entità di posizione."
      },
      {
        "testo": "In «Tasto Clima rapido» scegli modalità, temperatura e ventola (vuote = il tasto non le tocca).",
        "html": "In «Tasto Clima rapido» scegli modalità, temperatura e ventola (vuote = il tasto non le tocca)."
      },
      {
        "testo": "Premi «＋ Aggiungi unità clima».",
        "html": "Premi <b>«＋ Aggiungi unità clima»</b>."
      },
      {
        "testo": "Un deumidificatore: Premi «＋ Aggiungi un deumidificatore».",
        "html": "<b>Un deumidificatore</b>: Premi <b>«＋ Aggiungi un deumidificatore»</b>."
      },
      {
        "testo": "Scegli l'entità humidifier (obbligatoria), il nome e la stanza. Le altre caselle si riempiono da sole quando salvi.",
        "html": "Scegli l'entità <code>humidifier</code> (obbligatoria), il nome e la stanza. Le altre caselle si riempiono da sole quando salvi."
      },
      {
        "testo": "La ventilazione (VMC): Premi «＋ Aggiungi una VMC».",
        "html": "<b>La ventilazione (VMC)</b>: Premi <b>«＋ Aggiungi una VMC»</b>."
      },
      {
        "testo": "Scegli le quattro temperature (aria esterna, immissione, ripresa, espulsione) e, se li hai, ventole, bypass, filtri.",
        "html": "Scegli le quattro temperature (aria esterna, immissione, ripresa, espulsione) e, se li hai, ventole, bypass, filtri."
      },
      {
        "testo": "La caldaia: Scegli l'entità caldaia.",
        "html": "<b>La caldaia</b>: Scegli l'entità caldaia."
      },
      {
        "testo": "In «Stato termico» premi «＋ Aggiungi voce» per ogni cosa da vedere accesa o spenta. Alla fine premi «💾 Salva sezione».",
        "html": "In «Stato termico» premi <b>«＋ Aggiungi voce»</b> per ogni cosa da vedere accesa o spenta. Alla fine premi <b>«💾 Salva sezione»</b>."
      }
    ],
    "consigli": [
      "La valvola TRV non serve se l'unità clima comunica già la posizione della valvola.",
      "Senza voci in «Stato termico» il pannello nel popup Caldo non compare."
    ]
  },
  "sez7": {
    "titolo": "Temperatura",
    "scopo": "Associa a ogni stanza il suo sensore di temperatura e, se c'è, di umidità. Sono i numeri della pagina Temperature e delle stanze.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b>: l'anteprima della sezione (vedi 27.11).",
      "<b>L'elenco delle associazioni</b>: stanza, sensore di temperatura e di umidità. ✏️ per modificare, 🗑️ per togliere.",
      "<b>«＋ Aggiungi temperatura»</b>: «Stanza», «Nome temperatura» (facoltativo), «Entità temperatura», «Nome umidità», «Entità umidità» (facoltativa)."
    ],
    "passi": [
      {
        "testo": "Scegli la stanza.",
        "html": "Scegli la stanza."
      },
      {
        "testo": "Scegli l'«Entità temperatura» con «Scegli entità».",
        "html": "Scegli l'«Entità temperatura» con «Scegli entità»."
      },
      {
        "testo": "Se c'è, scegli l'«Entità umidità».",
        "html": "Se c'è, scegli l'«Entità umidità»."
      },
      {
        "testo": "Se vuoi, scrivi un nome.",
        "html": "Se vuoi, scrivi un nome."
      },
      {
        "testo": "Premi «Associa sensori», poi «💾 Salva sezione».",
        "html": "Premi <b>«Associa sensori»</b>, poi <b>«💾 Salva sezione»</b>."
      }
    ],
    "consigli": [
      "La stessa stanza si può scegliere più volte, per esempio per due sensori in punti diversi: dai a ognuno un nome.",
      "L'umidità della stanza serve anche alle Finestre, per consigliare di arieggiare (27.25)."
    ]
  },
  "meteo": {
    "titolo": "Meteo",
    "scopo": "Prepara la pagina Meteo: il tempo di adesso, la tua stazione meteo con le ultime 24 ore, le previsioni e il radar della pioggia.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b>: l'anteprima della sezione (vedi 27.11).",
      "<b>«PREVISIONI»</b>: l'«Entità meteo (weather)». È la stessa del meteo nella testata della Home.",
      "<b>«LA MIA STAZIONE»</b>: dodici caselle, tutte facoltative (temperatura esterna, umidità, percepita, pressione, vento, raffica, direzione, pioggia di oggi, intensità della pioggia, indice UV, radiazione solare, luminosità), e <b>«🪄 Trova i sensori della stazione»</b>.",
      "<b>«RADAR PIOGGIA»</b>: «Nessuno», «Servizio di mappe» (RainViewer) o «Camera di Home Assistant».",
      "<b>«LA PAGINA»</b>: l'ordine dei blocchi («Adesso», «La mia stazione», «Prossime 24 ore», «Prossimi giorni», «Radar pioggia»), con ▲ ▼."
    ],
    "passi": [
      {
        "testo": "Scegli l'entità meteo.",
        "html": "Scegli l'entità meteo."
      },
      {
        "testo": "Premi «🪄 Trova i sensori della stazione», oppure scegli i sensori uno per uno.",
        "html": "Premi <b>«🪄 Trova i sensori della stazione»</b>, oppure scegli i sensori uno per uno."
      },
      {
        "testo": "Scegli la fonte del radar.",
        "html": "Scegli la fonte del radar."
      },
      {
        "testo": "Metti i blocchi della pagina nell'ordine che preferisci.",
        "html": "Metti i blocchi della pagina nell'ordine che preferisci."
      },
      {
        "testo": "Premi «💾 Salva sezione».",
        "html": "Premi <b>«💾 Salva sezione»</b>."
      }
    ],
    "consigli": [
      "Basta l'entità meteo: un blocco senza dati non compare.",
      "Cambiare l'entità meteo qui la cambia anche nella Home. Temperatura, umidità, percepita, vento e pioggia sono gli stessi campi della Home e dell'Irrigazione: si scelgono una volta sola.",
      "Con «Servizio di mappe» il servizio esterno sa quale zona guardi. Se non vuoi, scegli «Nessuno»."
    ]
  },
  "sez3": {
    "titolo": "Gestione termica",
    "scopo": "Disegna il locale caldaia: solare termico, scaldabagno, caldaia e stufa a pellet, con temperature, pompe e comandi.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b>: l'anteprima della sezione (vedi 27.11).",
      "<b>«🔥 Cosa c'è nel locale caldaia»</b>: le caselle da spuntare: «Solare termico», «Scaldabagno», «Caldaia», «Stufa a pellet». Con più d'una, in pagina compaiono le linguette per passare dall'una all'altra.",
      "<b>«🌞 Solare termico»</b>: le caselle divise in gruppi:",
      "<b>«☀️ Pannello»</b>: la temperatura dei pannelli.",
      "<b>«🔁 Circuito»</b>: se la pompa gira, la differenza di temperatura, la pressione.",
      "<b>«🛢️ Accumulo»</b>: le temperature alta e bassa, la potenza.",
      "<b>«🎛️ Comandi»</b>: gli interruttori e le valvole da comandare. Ogni casella ha la stanza e l'interruttore «NEL WIDGET».",
      "<b>«＋ Aggiungi un secondo impianto solare»</b>: per due tetti o due accumuli."
    ],
    "passi": [
      {
        "testo": "Spunta in «Cosa c'è nel locale caldaia» solo quello che hai davvero.",
        "html": "Spunta in «Cosa c'è nel locale caldaia» solo quello che hai davvero."
      },
      {
        "testo": "Apri il riquadro di ognuno e tocca ogni casella per scegliere l'entità.",
        "html": "Apri il riquadro di ognuno e tocca ogni casella per scegliere l'entità."
      },
      {
        "testo": "Se preferisci scrivere il nome dell'entità a mano, usa «Modifica manuale».",
        "html": "Se preferisci scrivere il nome dell'entità a mano, usa <b>«Modifica manuale»</b>."
      },
      {
        "testo": "Accendi «NEL WIDGET» sui valori da mostrare nella tessera della Home.",
        "html": "Accendi «NEL WIDGET» sui valori da mostrare nella tessera della Home."
      },
      {
        "testo": "Premi «💾 Salva sezione».",
        "html": "Premi <b>«💾 Salva sezione»</b>."
      }
    ],
    "consigli": [
      "La pagina mostra solo quello che hai spuntato.",
      "Il sensore che dice se la pompa gira fa scorrere la luce nei tubi del disegno."
    ]
  },
  "pool": {
    "titolo": "Piscina",
    "scopo": "Collega i sensori e i comandi della piscina e gestisce la filtrazione automatica di ogni giorno.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b>: l'anteprima della sezione (vedi 27.11).",
      "<b>I sensori e i comandi</b>: «Temperatura piscina», «pH», «Cloro», «Pompa filtrazione», «Riscaldamento piscina», «Luce piscina».",
      "<b>«Soglie qualità (avvisi) e filtrazione»</b>: i valori minimi e massimi di pH e cloro, le ore di filtrazione, <b>«Ore automatiche (temperatura/2)»</b> e <b>«Filtrazione giornaliera attiva (col tablet acceso)»</b>.",
      "<b>«🏊 Nome della prima vasca»</b>.",
      "<b>«🏊 Altre piscine»</b> con <b>«＋ Aggiungi piscina»</b>."
    ],
    "passi": [
      {
        "testo": "Scegli le entità di temperatura, pH, cloro, pompa, riscaldamento e luce.",
        "html": "Scegli le entità di temperatura, pH, cloro, pompa, riscaldamento e luce."
      },
      {
        "testo": "Scrivi le soglie di pH e cloro: fuori da queste arriva l'avviso.",
        "html": "Scrivi le soglie di pH e cloro: fuori da queste arriva l'avviso."
      },
      {
        "testo": "Per la filtrazione automatica spunta «Ore automatiche» e «Filtrazione giornaliera attiva».",
        "html": "Per la filtrazione automatica spunta «Ore automatiche» e «Filtrazione giornaliera attiva»."
      },
      {
        "testo": "Dai un nome alla vasca.",
        "html": "Dai un nome alla vasca."
      },
      {
        "testo": "Se hai un'altra piscina, premi «＋ Aggiungi piscina» e compila i suoi sensori.",
        "html": "Se hai un'altra piscina, premi <b>«＋ Aggiungi piscina»</b> e compila i suoi sensori."
      },
      {
        "testo": "Premi «💾 Salva sezione».",
        "html": "Premi <b>«💾 Salva sezione»</b>."
      }
    ],
    "consigli": [
      "Con le ore automatiche, le ore di filtrazione sono la temperatura divisa per due, da un minimo di 2 a un massimo di 12.",
      "La filtrazione programmata parte solo se il tablet con la plancia è acceso."
    ]
  },
  "irr": {
    "titolo": "Irrigazione",
    "scopo": "Configura le zone del giardino e il programma: le zone partono una dopo l'altra, ognuna per i suoi minuti, e il giro salta se piove.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b>: l'anteprima della sezione (vedi 27.11).",
      "<b>Le zone</b>: nome, durata in minuti e stanza (per esempio «Prato fronte · 15 min»). ✏️ per modificare, 🗑️ per togliere.",
      "<b>«Valvola della zona»</b> e <b>«＋ Aggiungi zona»</b>.",
      "<b>Meteo e programma</b>: «Sensore probabilità pioggia», «Sensore umidità terreno», «Umidità ideale min (%)» e «max (%)», «Salta il programma se ≥ (%)», «Avvia da solo se &lt; (%)», «Meteo», l'orario di avvio.",
      "<b>«Altri orari di irrigazione»</b>: «Ora», «Durata», «Se sotto (%)», con <b>«+ Aggiungi un orario»</b>.",
      "<b>«Programma attivo (ogni giorno, col tablet acceso)»</b>."
    ],
    "passi": [
      {
        "testo": "Scrivi il nome della zona e i minuti.",
        "html": "Scrivi il nome della zona e i minuti."
      },
      {
        "testo": "Scegli la valvola della zona (un interruttore o una valvola) e la stanza.",
        "html": "Scegli la valvola della zona (un interruttore o una valvola) e la stanza."
      },
      {
        "testo": "Premi «＋ Aggiungi zona». Ripeti per ogni zona; ✏️ la modifica dopo.",
        "html": "Premi <b>«＋ Aggiungi zona»</b>. Ripeti per ogni zona; ✏️ la modifica dopo."
      },
      {
        "testo": "Scegli il sensore di pioggia e, se c'è, quello di umidità del terreno.",
        "html": "Scegli il sensore di pioggia e, se c'è, quello di umidità del terreno."
      },
      {
        "testo": "Scrivi le soglie e l'orario di avvio.",
        "html": "Scrivi le soglie e l'orario di avvio."
      },
      {
        "testo": "Se vuoi più giri al giorno, premi «+ Aggiungi un orario».",
        "html": "Se vuoi più giri al giorno, premi <b>«+ Aggiungi un orario»</b>."
      },
      {
        "testo": "Spunta «Programma attivo».",
        "html": "Spunta <b>«Programma attivo»</b>."
      },
      {
        "testo": "Premi «💾 Salva sezione».",
        "html": "Premi <b>«💾 Salva sezione»</b>."
      }
    ],
    "consigli": [
      "Con il terreno già bagnato il programma salta (e la card lo dice); sotto la soglia bassa parte da solo, una volta al giorno.",
      "I sensori della pioggia della Home (27.2) sono gli stessi che guarda l'Irrigazione.",
      "Il programma funziona solo se il tablet con la plancia è acceso."
    ]
  },
  "piante": {
    "titolo": "Piante",
    "scopo": "Elenca le piante di casa. La pagina Piante dice quali sono da innaffiare, quali aspettano la pioggia e quando toccherà alle altre.",
    "campi": [
      "<b>L'elenco delle piante</b> (all'inizio «Nessuna pianta configurata»).",
      "<b>«＋ Aggiungi pianta»</b>: il nome, il disegno, «Umidità della terra», «Temperatura della terra», «Da innaffiare sotto il (%)», «Troppa acqua sopra il (%)», e «All'aperto: se sta per piovere, aspetta».",
      "La scritta <b>«⚪ Sezione vuota»</b>: la sezione compare solo quando c'è almeno una pianta."
    ],
    "passi": [
      {
        "testo": "Premi «＋ Aggiungi pianta».",
        "html": "Premi <b>«＋ Aggiungi pianta»</b>."
      },
      {
        "testo": "Scrivi il nome e scegli il disegno.",
        "html": "Scrivi il nome e scegli il disegno."
      },
      {
        "testo": "Scegli il sensore di umidità della terra e, se c'è, quello di temperatura.",
        "html": "Scegli il sensore di umidità della terra e, se c'è, quello di temperatura."
      },
      {
        "testo": "Scrivi le due soglie (troppo secca, troppa acqua).",
        "html": "Scrivi le due soglie (troppo secca, troppa acqua)."
      },
      {
        "testo": "Per le piante all'aperto spunta «All'aperto: se sta per piovere, aspetta».",
        "html": "Per le piante all'aperto spunta «All'aperto: se sta per piovere, aspetta»."
      },
      {
        "testo": "Premi «Salva pianta», poi «💾 Salva sezione».",
        "html": "Premi <b>«Salva pianta»</b>, poi <b>«💾 Salva sezione»</b>."
      }
    ],
    "consigli": []
  },
  "contatori": {
    "titolo": "Acqua e gas",
    "scopo": "Collega i contatori di casa: acqua, gas e i sensori dell'impianto. La pagina mostra oggi, ieri e il mese, la pressione e l'acqua che non smette di scorrere.",
    "campi": [
      "<b>L'elenco dei contatori</b>: entità, nome, stanza e valore di adesso. ✏️ per modificare, 🗑️ per togliere.",
      "<b>«＋ Aggiungi contatore»</b>: «Entità del sensore», il nome, il disegno e <b>«Cosa misura»</b> (per esempio contatore acqua, contatore gas, pressione, portata, sale dell'addolcitore). Secondo il tipo compaiono caselle in più: «Prezzo al m³ (€)», «Ideale da (bar)» e «Ideale fino a (bar)», «Da ricomprare sotto»."
    ],
    "passi": [
      {
        "testo": "Premi «＋ Aggiungi contatore».",
        "html": "Premi <b>«＋ Aggiungi contatore»</b>."
      },
      {
        "testo": "Scegli il sensore con «Scegli entità».",
        "html": "Scegli il sensore con «Scegli entità»."
      },
      {
        "testo": "Scegli cosa misura e scrivi un nome.",
        "html": "Scegli cosa misura e scrivi un nome."
      },
      {
        "testo": "Compila le caselle in più (prezzo, forcella della pressione…).",
        "html": "Compila le caselle in più (prezzo, forcella della pressione…)."
      },
      {
        "testo": "Premi «Salva contatore», poi «💾 Salva sezione».",
        "html": "Premi <b>«Salva contatore»</b>, poi <b>«💾 Salva sezione»</b>."
      }
    ],
    "consigli": [
      "Un sensore di portata permette alla pagina di accorgersi dell'acqua che scorre senza fermarsi."
    ]
  },
  "stanze": {
    "titolo": "Stanze",
    "scopo": "Gestisce le stanze e i piani della casa. Le stanze create qui compaiono nelle tendine di luci, clima, elettrodomestici e telecamere.",
    "campi": [
      "<b>«Anteprima: l'ordine delle stanze»</b>: l'ordine usato nella pagina Stanze e in Luci, Tapparelle e Clima.",
      "<b>«✋ Sposta e nascondi»</b>: l'anteprima della sezione (vedi 27.11).",
      "<b>«🏢 I piani della casa»</b>: i piani con le loro stanze. ▲ ▼ per l'ordine, ✏️ per rinominare, 🗑️ per eliminare, <b>«＋ Aggiungi piano»</b>.",
      "<b>«Vista della stanza»</b>: come si presenta una stanza aperta: <b>«Tessere»</b> (ogni cosa col suo comando, in griglia) o <b>«Righe»</b> (l'elenco diviso per tipo).",
      "<b>Le stanze</b>, divise per piano, con ▲ ▼, ✏️ e 🗑️.",
      "<b>«＋ Aggiungi stanza»</b>: icona, nome e piano."
    ],
    "passi": [
      {
        "testo": "Aggiungere una stanza: Scegli l'icona e scrivi il nome della stanza.",
        "html": "<b>Aggiungere una stanza</b>: Scegli l'icona e scrivi il nome della stanza."
      },
      {
        "testo": "Scegli il piano dalla tendina.",
        "html": "Scegli il piano dalla tendina."
      },
      {
        "testo": "Premi «＋ Aggiungi stanza».",
        "html": "Premi <b>«＋ Aggiungi stanza»</b>."
      },
      {
        "testo": "Riordinare le stanze: Nell'anteprima trascina la stanza (sul telefono tieni premuto un attimo).",
        "html": "<b>Riordinare le stanze</b>: Nell'anteprima trascina la stanza (sul telefono tieni premuto un attimo)."
      },
      {
        "testo": "Premi «Applica».",
        "html": "Premi <b>«Applica»</b>."
      },
      {
        "testo": "I piani: Premi «＋ Aggiungi piano» e scrivi il nome.",
        "html": "<b>I piani</b>: Premi <b>«＋ Aggiungi piano»</b> e scrivi il nome."
      },
      {
        "testo": "Metti i piani nell'ordine giusto con ▲ ▼. Alla fine premi «💾 Salva sezione».",
        "html": "Metti i piani nell'ordine giusto con ▲ ▼. Alla fine premi <b>«💾 Salva sezione»</b>."
      }
    ],
    "consigli": [
      "Rinominare un piano si porta dietro le sue stanze. Eliminarlo le lascia senza piano (la plancia lo chiede prima).",
      "L'ordine dei piani vale anche per le scene delle luci e per le tapparelle.",
      "I sensori di temperatura delle stanze si mettono nella scheda Temperatura (27.16)."
    ]
  },
  "luci": {
    "titolo": "Luci",
    "scopo": "Elenca le luci della casa, divise per stanza, per la pagina Luci e il popup delle luci.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b>: l'anteprima della sezione (vedi 27.11).",
      "<b>Le luci, stanza per stanza</b>: nome, entità e le pastiglie che dicono cosa sa fare la luce («RGB», «BIANCO», «DIMMER», «ON/OFF»). Si vedono solo le stanze con almeno una luce.",
      "<b>Per ogni luce</b>: la tendina della stanza, ✏️ che apre tutti i dati della luce, 🗑️ per toglierla.",
      "<b>«＋ Aggiungi luce»</b>: «Entità luce» e «STANZA»."
    ],
    "passi": [
      {
        "testo": "Scegli la luce con «Scegli entità» sotto «Entità luce».",
        "html": "Scegli la luce con <b>«Scegli entità»</b> sotto «Entità luce»."
      },
      {
        "testo": "Scegli la stanza.",
        "html": "Scegli la stanza."
      },
      {
        "testo": "Premi «＋ Aggiungi luce».",
        "html": "Premi <b>«＋ Aggiungi luce»</b>."
      },
      {
        "testo": "Per spostare una luce in un'altra stanza, cambia la tendina sulla sua riga.",
        "html": "Per spostare una luce in un'altra stanza, cambia la tendina sulla sua riga."
      },
      {
        "testo": "Premi «💾 Salva sezione».",
        "html": "Premi <b>«💾 Salva sezione»</b>."
      }
    ],
    "consigli": [
      "Una luce può essere un'entità luce oppure un interruttore: una lampada dietro un relè si aggiunge allo stesso modo.",
      "Le pastiglie (RGB, dimmer…) decidono quali comandi compaiono nel popup."
    ]
  },
  "tapp": {
    "titolo": "Finestre",
    "scopo": "Collega tapparelle, tende e sensori delle finestre. Compaiono nella pagina 🪟 Finestre, divise per piano e stanza.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b>: l'anteprima della sezione (vedi 27.11).",
      "<b>«Chiusa sotto il (%), di serie»</b>: una tapparella ferma a questa percentuale o sotto conta come chiusa (utile per chi lascia uno spiraglio).",
      "<b>«Suggerisci di arieggiare sopra il (%), di serie»</b>: sopra questa umidità la finestra consiglia di aprire. Vuoto = 60, zero = mai.",
      "<b>L'elenco delle finestre</b>, con stanza e piano. ⇄ inverte le percentuali, ✏️ modifica, 🗑️ toglie.",
      "<b>Il modulo per una finestra</b>: «Stanza», «Entità tapparella», «Relè di discesa», «Tenda», «Tenda · relè di discesa», «Tenda da sole», «Tenda da sole · relè di discesa», «Sensore apertura infisso», «Sensore apertura inferriata», «Posizione preferita (%)», le soglie solo per questa finestra e «Percentuali invertite (100% = chiusa)»."
    ],
    "passi": [
      {
        "testo": "Scegli la stanza.",
        "html": "Scegli la stanza."
      },
      {
        "testo": "Scegli l'entità della tapparella: – una tapparella motorizzata con posizione: basta lei; – un relè solo: scegli il relè; – due relè (uno sale, uno scende): il primo in «Entità tapparella», il secondo in «Relè di discesa».",
        "html": "Scegli l'entità della tapparella: – una tapparella motorizzata con posizione: basta lei; – un relè solo: scegli il relè; – due relè (uno sale, uno scende): il primo in «Entità tapparella», il secondo in «Relè di discesa»."
      },
      {
        "testo": "Fai lo stesso per tenda e tenda da sole, se ci sono.",
        "html": "Fai lo stesso per tenda e tenda da sole, se ci sono."
      },
      {
        "testo": "Se c'è, scegli il sensore di apertura dell'infisso o dell'inferriata.",
        "html": "Se c'è, scegli il sensore di apertura dell'infisso o dell'inferriata."
      },
      {
        "testo": "Premi «＋ Aggiungi entità a Finestre».",
        "html": "Premi <b>«＋ Aggiungi entità a Finestre»</b>."
      },
      {
        "testo": "Premi «💾 Salva sezione».",
        "html": "Premi <b>«💾 Salva sezione»</b>."
      }
    ],
    "consigli": [
      "Una finestra che si apre a mano (persiane, scuri, maniglia): lascia vuoti i comandi e metti solo il sensore di apertura. La card la mostra lo stesso.",
      "Senza stanza la finestra non ha un'umidità da guardare e non può consigliare di arieggiare.",
      "Se la tapparella segna 100% quando è chiusa, spunta «Percentuali invertite» (o premi ⇄ sulla sua riga)."
    ]
  },
  "appliances": {
    "titolo": "Elettrodom.",
    "scopo": "Qui metti gli elettrodomestici di casa: lavatrice, lavastoviglie, forno, frigorifero… Lo stato («In funzione», «Standby», «Spento») si capisce dal consumo in Watt. Per questo funziona anche con un elettrodomestico non wifi collegato a una presa smart.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b>: la sezione com'è sulla plancia. Scegli <b>«📱 Telefono»</b> o <b>«🖥️ Computer»</b>, poi <b>«▶ Apri l'anteprima»</b>: trascini i riquadri e nascondi quello che non vuoi con l'occhio.",
      "<b>L'elenco degli elettrodomestici</b>: per ognuno il nome e quante entità ha (per esempio «Lavatrice · 12 entità»). La matita ✏️ lo modifica, il cestino 🗑️ lo toglie.",
      "<b>«🔗 AGGIUNGI DA UN'INTEGRAZIONE»</b>: per hOn, Home Connect, Miele, LG ThinQ, SmartThings o una presa Shelly. Scegli il dispositivo e l'elettrodomestico arriva con tutte le sue entità già al posto giusto.",
      "<b>La compilazione a mano</b>: «STANZA», la casella <b>«Scegli entità»</b>, il tasto <b>«＋ AGGIUNGI QUESTA ENTITÀ»</b> e la soglia di potenza («Sopra questa potenza = In funzione»).",
      "<b>«＋ AGGIUNGI ELETTRODOMESTICO»</b>.",
      "<b>«🟢 SEZIONE VISIBILE IN DASHBOARD — TOCCA PER NASCONDERE»</b>: accende o spegne la sezione nella plancia.",
      "<b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "Da un'integrazione (il modo più semplice): Tocca «🔗 AGGIUNGI DA UN'INTEGRAZIONE».",
        "html": "<b>Da un'integrazione (il modo più semplice)</b>: Tocca <b>«🔗 AGGIUNGI DA UN'INTEGRAZIONE»</b>."
      },
      {
        "testo": "Scegli il dispositivo dall'elenco.",
        "html": "Scegli il dispositivo dall'elenco."
      },
      {
        "testo": "Controlla nome e stanza, poi premi «💾 SALVA SEZIONE».",
        "html": "Controlla nome e stanza, poi premi <b>«💾 SALVA SEZIONE»</b>."
      },
      {
        "testo": "A mano, una entità alla volta: Tocca «＋ AGGIUNGI ELETTRODOMESTICO» e scrivi il nome.",
        "html": "<b>A mano, una entità alla volta</b>: Tocca <b>«＋ AGGIUNGI ELETTRODOMESTICO»</b> e scrivi il nome."
      },
      {
        "testo": "In «STANZA» scegli dove si trova (per esempio «Cucina»).",
        "html": "In «STANZA» scegli dove si trova (per esempio «Cucina»)."
      },
      {
        "testo": "In «Scegli entità» scegli il sensore della potenza (per esempio sensor.forno_potenza) o l'interruttore, poi tocca «＋ AGGIUNGI QUESTA ENTITÀ». Ripeti per le altre entità.",
        "html": "In <b>«Scegli entità»</b> scegli il sensore della potenza (per esempio <code>sensor.forno_potenza</code>) o l'interruttore, poi tocca <b>«＋ AGGIUNGI QUESTA ENTITÀ»</b>. Ripeti per le altre entità."
      },
      {
        "testo": "Imposta la soglia: sopra quel valore l'elettrodomestico è «In funzione».",
        "html": "Imposta la soglia: sopra quel valore l'elettrodomestico è «In funzione»."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      }
    ],
    "consigli": [
      "Per un elettrodomestico non wifi su presa smart imposta circa <b>5 W</b>.",
      "Una soglia troppo bassa (sotto 1 W) fa risultare «In funzione» anche il solo display acceso. ---"
    ]
  },
  "media": {
    "titolo": "Musica",
    "scopo": "Qui scegli i lettori di casa (casse, TV, Chromecast…). Ogni lettore ha una scheda tutta sua nella pagina Musica, con la copertina del brano come sfondo.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b>: anteprima della sezione per <b>«📱 Telefono»</b> e <b>«🖥️ Computer»</b>, da aprire con <b>«▶ Apri l'anteprima»</b>.",
      "<b>L'elenco dei lettori</b> (per esempio «Salone», <code>media_player.salone</code>), con la matita ✏️ per modificare e il cestino 🗑️ per togliere.",
      "<b>«🔗 AGGIUNGI DA UN'INTEGRAZIONE»</b>: per SmartThings, Sonos, Chromecast, AirPlay… Il lettore arriva già fatto: la sua entità, i comandi accanto (l'interruttore di una TV, la tendina della sorgente) e le sue letture.",
      "<b>«＋ AGGIUNGI LETTORE»</b>: per compilarlo a mano, una casella alla volta.",
      "<b>«🟢 SEZIONE VISIBILE IN DASHBOARD — TOCCA PER NASCONDERE»</b> e <b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "Tocca «🔗 AGGIUNGI DA UN'INTEGRAZIONE» e scegli il dispositivo, oppure tocca «＋ AGGIUNGI LETTORE» e scegli l'entità del lettore.",
        "html": "Tocca <b>«🔗 AGGIUNGI DA UN'INTEGRAZIONE»</b> e scegli il dispositivo, oppure tocca <b>«＋ AGGIUNGI LETTORE»</b> e scegli l'entità del lettore."
      },
      {
        "testo": "Dai un nome al lettore (per esempio «Cucina»).",
        "html": "Dai un nome al lettore (per esempio «Cucina»)."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      }
    ],
    "consigli": [
      "I tasti della scheda sono solo quelli che il lettore sa fare davvero: se non ha il brano successivo, quel tasto non c'è.",
      "Puoi mettere un lettore anche fra le <b>Azioni rapide</b> della Home: il tasto prende la copertina come sfondo e mette in pausa o fa ripartire. ---"
    ]
  },
  "media_radio": {
    "titolo": "Radio",
    "scopo": "Qui scegli le radio preferite. Compaiono in cima alla pagina Musica e si ascoltano su un lettore di casa o sugli Echo.",
    "campi": [
      "<b>«Le radio preferite»</b>: quelle già scelte. Se non ce n'è nessuna leggi «Nessuna radio preferita».",
      "<b>«Aggiungi una radio»</b>: le radio di Home Assistant (Radio Browser), con una casella per cercare per nome e due elenchi pronti, <b>«Vicino a te»</b> e <b>«Più ascoltate»</b>.",
      "<b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "In «Aggiungi una radio» apri «Vicino a te» o «Più ascoltate», oppure scrivi il nome della radio.",
        "html": "In «Aggiungi una radio» apri <b>«Vicino a te»</b> o <b>«Più ascoltate»</b>, oppure scrivi il nome della radio."
      },
      {
        "testo": "Tocca la radio che vuoi: passa fra «Le radio preferite».",
        "html": "Tocca la radio che vuoi: passa fra «Le radio preferite»."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      }
    ],
    "consigli": [
      "Se leggi «Nessuna radio con questo nome», prova a scrivere il nome in un altro modo.",
      "Le stesse radio si possono far suonare sugli Echo (scheda Musica della famiglia Alexa). ---"
    ]
  },
  "sport": {
    "titolo": "Sport",
    "scopo": "Qui scegli cosa seguire: la tua squadra di calcio o di hockey, la Formula 1, la MotoGP. La pagina Sport mostra risultati, prossime partite e gare, classifiche. In Home la tessera dice la cosa che conta adesso: la partita in corso, quella di oggi, l'ultimo podio.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b> con <b>«📱 Telefono»</b>, <b>«🖥️ Computer»</b> e <b>«▶ Apri l'anteprima»</b>.",
      "<b>«COSA SEGUI»</b>: l'elenco di quello che segui, con il conto (per esempio «3/8»: se ne possono seguire fino a otto). Le frecce ▲ ▼ cambiano l'ordine, il cestino 🗑️ toglie.",
      "<b>«Pilota del cuore»</b> (per Formula 1 e MotoGP): il pilota da mettere in evidenza, oppure «Nessuno».",
      "<b>«AGGIUNGI»</b>: quattro tasti, <b>«⚽ SQUADRA DI CALCIO»</b>, <b>«🏒 SQUADRA DI HOCKEY»</b>, <b>«🏁 FORMULA 1»</b>, <b>«🏍️ MOTOGP»</b>.",
      "<b>«🟢 SEZIONE VISIBILE IN DASHBOARD — TOCCA PER NASCONDERE»</b> e <b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "Sotto «AGGIUNGI» tocca il tasto che ti interessa, per esempio «⚽ SQUADRA DI CALCIO».",
        "html": "Sotto «AGGIUNGI» tocca il tasto che ti interessa, per esempio <b>«⚽ SQUADRA DI CALCIO»</b>."
      },
      {
        "testo": "Scegli il campionato e poi la squadra.",
        "html": "Scegli il campionato e poi la squadra."
      },
      {
        "testo": "Per Formula 1 o MotoGP scegli, se vuoi, il «Pilota del cuore».",
        "html": "Per Formula 1 o MotoGP scegli, se vuoi, il «Pilota del cuore»."
      },
      {
        "testo": "Con ▲ ▼ metti in alto quello che ti interessa di più.",
        "html": "Con ▲ ▼ metti in alto quello che ti interessa di più."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      }
    ],
    "consigli": [
      "Della squadra si vedono le partite di tutte le competizioni: campionato, coppe ed Europa.",
      "I risultati li chiede l'add-on GdAHome alle fonti pubbliche. Se leggi «Le squadre adesso non arrivano», riprova fra poco. ---"
    ]
  },
  "robot": {
    "titolo": "Robot",
    "scopo": "Qui metti i robot di casa, aspirapolvere e tagliaerba. Ogni robot ha la sua scheda nella sezione Robot: stato, batteria, comandi e mappa.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b> con <b>«📱 Telefono»</b>, <b>«🖥️ Computer»</b> e <b>«▶ Apri l'anteprima»</b>.",
      "<b>L'elenco dei robot</b> (per esempio «Robot piano terra»), con la matita ✏️ e il cestino 🗑️.",
      "<b>«🔗 AGGIUNGI DA UN'INTEGRAZIONE»</b>: per Roborock, Dreame, Ecovacs, Husqvarna… Il robot arriva già fatto: entità, mappe, batteria, programmi e letture.",
      "<b>«＋ AGGIUNGI ROBOT»</b>: per compilarlo a mano.",
      "<b>«🟢 SEZIONE VISIBILE IN DASHBOARD — TOCCA PER NASCONDERE»</b> e <b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "Tocca «🔗 AGGIUNGI DA UN'INTEGRAZIONE» e scegli il dispositivo, oppure tocca «＋ AGGIUNGI ROBOT».",
        "html": "Tocca <b>«🔗 AGGIUNGI DA UN'INTEGRAZIONE»</b> e scegli il dispositivo, oppure tocca <b>«＋ AGGIUNGI ROBOT»</b>."
      },
      {
        "testo": "A mano, scegli l'«Entità del robot»: è quella dell'aspirapolvere (vacuum.…) o del tagliaerba (lawn_mower.…).",
        "html": "A mano, scegli l'«Entità del robot»: è quella dell'aspirapolvere (<code>vacuum.…</code>) o del tagliaerba (<code>lawn_mower.…</code>)."
      },
      {
        "testo": "Dai un nome al robot e premi «💾 SALVA SEZIONE».",
        "html": "Dai un nome al robot e premi <b>«💾 SALVA SEZIONE»</b>."
      }
    ],
    "consigli": [
      "Se l'integrazione dice «non si riconosce nessun robot», il dispositivo scelto non ha un'entità di aspirapolvere o tagliaerba: scegline un altro. ---"
    ]
  },
  "stampanti": {
    "titolo": "Stampanti",
    "scopo": "Della stampante la plancia ti dice due cose: se è pronta e quanto inchiostro le resta. La pagina Stampanti compare da sola appena ne aggiungi una.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b> con <b>«📱 Telefono»</b>, <b>«🖥️ Computer»</b> e <b>«▶ Apri l'anteprima»</b>.",
      "<b>L'elenco delle stampanti</b>: all'inizio «Nessuna stampante».",
      "<b>«＋ AGGIUNGI STAMPANTE»</b>: apre i campi «Entità dello stato», «Cartucce (facoltativo)» e «Pagine stampate (facoltativo)».",
      "<b>«⚪ SEZIONE VUOTA — AGGIUNGI UN'ENTITÀ QUI SOTTO PER MOSTRARLA»</b>: finché non c'è una stampante la sezione non compare.",
      "<b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "Tocca «＋ AGGIUNGI STAMPANTE».",
        "html": "Tocca <b>«＋ AGGIUNGI STAMPANTE»</b>."
      },
      {
        "testo": "In «Entità dello stato» scegli l'entità che dice se la stampante è pronta, in stampa o ferma (la crea l'integrazione della stampante).",
        "html": "In «Entità dello stato» scegli l'entità che dice se la stampante è pronta, in stampa o ferma (la crea l'integrazione della stampante)."
      },
      {
        "testo": "Le cartucce si cercano da sole partendo da quel nome. Se non le trova, aggiungile tu in «Cartucce (facoltativo)».",
        "html": "Le cartucce si cercano da sole partendo da quel nome. Se non le trova, aggiungile tu in «Cartucce (facoltativo)»."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE». ---",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>. ---"
      }
    ],
    "consigli": []
  },
  "animali": {
    "titolo": "Animali",
    "scopo": "Una scheda per ogni animale di casa, con la sua foto e quello che lo riguarda: la ciotola, la lettiera, l'acqua, la porta col microchip, il collare. Anche acquari e terrari, quanti ne hai.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b> con <b>«📱 Telefono»</b>, <b>«🖥️ Computer»</b> e <b>«▶ Apri l'anteprima»</b>.",
      "<b>L'elenco degli animali</b> (per esempio «Micio», «Fido»): per ognuno la tendina della stanza, la matita ✏️ e il cestino 🗑️.",
      "<b>«🔗 AGGIUNGI DA UN'INTEGRAZIONE»</b>: per PetKit, SurePetcare, Tractive, Litter-Robot… La scheda arriva già fatta: livello del cibo, lettiera, filtro dell'acqua, collare.",
      "<b>«＋ AGGIUNGI ANIMALE»</b>, <b>«＋ 🐠 ACQUARIO»</b>, <b>«＋ 🦎 TERRARIO»</b>.",
      "<b>«🟢 SEZIONE VISIBILE IN DASHBOARD — TOCCA PER NASCONDERE»</b> e <b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "Un animale: Tocca «🔗 AGGIUNGI DA UN'INTEGRAZIONE» e scegli il dispositivo, oppure tocca «＋ AGGIUNGI ANIMALE» e riempi le caselle una alla volta.",
        "html": "<b>Un animale</b>: Tocca <b>«🔗 AGGIUNGI DA UN'INTEGRAZIONE»</b> e scegli il dispositivo, oppure tocca <b>«＋ AGGIUNGI ANIMALE»</b> e riempi le caselle una alla volta."
      },
      {
        "testo": "Scrivi il nome e, se vuoi, aggiungi una foto. Senza foto la scheda mostra il disegno del tipo di animale.",
        "html": "Scrivi il nome e, se vuoi, aggiungi una foto. Senza foto la scheda mostra il disegno del tipo di animale."
      },
      {
        "testo": "Scegli la stanza dalla tendina.",
        "html": "Scegli la stanza dalla tendina."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      },
      {
        "testo": "Un acquario o un terrario: Tocca «＋ 🐠 ACQUARIO» o «＋ 🦎 TERRARIO».",
        "html": "<b>Un acquario o un terrario</b>: Tocca <b>«＋ 🐠 ACQUARIO»</b> o <b>«＋ 🦎 TERRARIO»</b>."
      },
      {
        "testo": "Aggiungi le sue entità (temperatura, pH…).",
        "html": "Aggiungi le sue entità (temperatura, pH…)."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      }
    ],
    "consigli": [
      "Nella modifica puoi impostare quando avvisare, per esempio «Avvisa sotto il cibo (%)» o «Avvisa sotto la sabbia (%)». ---"
    ]
  },
  "people": {
    "titolo": "Persone",
    "scopo": "Le persone di casa: dove sono, da quanto tempo, e la batteria del telefono. Ogni persona ha la sua card in cima alla Home, con una foto vera o un avatar. Qui si configura anche l'<b>Assistente di casa</b>.",
    "campi": [
      "<b>L'elenco delle persone</b> (per esempio «Persona 1», <code>person.persona_1</code>): le frecce ▲ ▼ cambiano l'ordine in Home, la matita ✏️ modifica, il cestino 🗑️ cancella. L'interruttore della riga toglie la persona dalla Home senza cancellarla.",
      "<b>«＋ AGGIUNGI PERSONA»</b> e <b>«⤵️ IMPORTA DA HOME ASSISTANT»</b>.",
      "<b>«Accanto alle persone»</b>: cosa mostrare vicino alle card delle persone, per esempio «Assistente di casa» oppure «Niente».",
      "<b>«Di cosa parla»</b>: gli argomenti dell'assistente, cioè «Sicurezza», «Risparmio», «Elettrodomestici», «Comfort», «Promemoria», «Manutenzione».",
      "<b>«Quanto parla»</b>: «Solo l'importante», «Normale», «Proprio tutto».",
      "<b>«La notte comincia alle»</b>: da 18:00 a 23:00.",
      "<b>«DIMENTICA QUELLO CHE HA IMPARATO»</b>: azzera quello che l'assistente ha imparato.",
      "<b>«Cosa c'è in casa»</b> con <b>«GUARDA COSA HA CAPITO ›»</b>.",
      "<b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "Aggiungere le persone: Il modo più veloce: tocca «⤵️ IMPORTA DA HOME ASSISTANT». Arrivano le persone che Home Assistant conosce già.",
        "html": "<b>Aggiungere le persone</b>: Il modo più veloce: tocca <b>«⤵️ IMPORTA DA HOME ASSISTANT»</b>. Arrivano le persone che Home Assistant conosce già."
      },
      {
        "testo": "Per una persona a mano tocca «＋ AGGIUNGI PERSONA».",
        "html": "Per una persona a mano tocca <b>«＋ AGGIUNGI PERSONA»</b>."
      },
      {
        "testo": "In «Entità persona» scegli l'entità person.… (o un device_tracker.…).",
        "html": "In «Entità persona» scegli l'entità <code>person.…</code> (o un <code>device_tracker.…</code>)."
      },
      {
        "testo": "Scrivi il «Nome».",
        "html": "Scrivi il «Nome»."
      },
      {
        "testo": "Scegli una «Foto», oppure un «Avatar (senza foto)», oppure un'emoji. Se lasci tutto vuoto, compaiono le iniziali del nome.",
        "html": "Scegli una «Foto», oppure un «Avatar (senza foto)», oppure un'emoji. Se lasci tutto vuoto, compaiono le iniziali del nome."
      },
      {
        "testo": "Se vuoi, in «Batteria (facoltativa)» scegli il sensore della batteria del telefono.",
        "html": "Se vuoi, in «Batteria (facoltativa)» scegli il sensore della batteria del telefono."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      },
      {
        "testo": "Impostare l'Assistente di casa: In «Accanto alle persone» scegli «Assistente di casa».",
        "html": "<b>Impostare l'Assistente di casa</b>: In «Accanto alle persone» scegli <b>«Assistente di casa»</b>."
      },
      {
        "testo": "In «Di cosa parla» accendi gli argomenti che ti interessano.",
        "html": "In «Di cosa parla» accendi gli argomenti che ti interessano."
      },
      {
        "testo": "In «Quanto parla» scegli quanto spesso deve intervenire.",
        "html": "In «Quanto parla» scegli quanto spesso deve intervenire."
      },
      {
        "testo": "Scegli l'ora in «La notte comincia alle».",
        "html": "Scegli l'ora in «La notte comincia alle»."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      }
    ],
    "consigli": [
      "L'assistente guarda la casa al posto tuo: luci accese con la casa vuota, una finestra aperta col riscaldamento acceso, la pioggia in arrivo, il bucato finito. Impara da quello che scarti.",
      "Se l'assistente sbaglia a capire una luce, una presa o una porta, correggilo da <b>«GUARDA COSA HA CAPITO ›»</b>.",
      "Con una foto l'avatar non si vede: vince la foto.",
      "Sul computer e sul tablet l'assistente sta a destra delle persone, sul telefono sotto. ---"
    ]
  },
  "batterie": {
    "titolo": "Batterie",
    "scopo": "Qui scegli le batterie da tenere d'occhio. La pagina Batterie le mostra dalla più scarica alla più piena, e in cima dice quante sono da cambiare.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b> con <b>«📱 Telefono»</b>, <b>«🖥️ Computer»</b> e <b>«▶ Apri l'anteprima»</b>.",
      "<b>«Da cambiare sotto il (%)»</b>: vale per tutte. Sotto questa percentuale la batteria entra nel conto di quelle da cambiare.",
      "<b>L'elenco delle batterie</b>: per ognuna il nome, l'entità, la tendina della stanza e la percentuale di adesso. Matita ✏️ per modificare, cestino 🗑️ per togliere.",
      "<b>«＋ AGGIUNGI BATTERIA»</b>.",
      "<b>«🟢 SEZIONE VISIBILE IN DASHBOARD — TOCCA PER NASCONDERE»</b> e <b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "Scrivi la percentuale in «Da cambiare sotto il (%)».",
        "html": "Scrivi la percentuale in «Da cambiare sotto il (%)»."
      },
      {
        "testo": "Tocca «＋ AGGIUNGI BATTERIA».",
        "html": "Tocca <b>«＋ AGGIUNGI BATTERIA»</b>."
      },
      {
        "testo": "Scegli l'entità della batteria (deve essere in percentuale), scrivi il nome che vuoi e scegli il disegno.",
        "html": "Scegli l'entità della batteria (deve essere in percentuale), scrivi il nome che vuoi e scegli il disegno."
      },
      {
        "testo": "Scegli la stanza dalla tendina.",
        "html": "Scegli la stanza dalla tendina."
      },
      {
        "testo": "Ripeti per le altre batterie, poi premi «💾 SALVA SEZIONE». ---",
        "html": "Ripeti per le altre batterie, poi premi <b>«💾 SALVA SEZIONE»</b>. ---"
      }
    ],
    "consigli": []
  },
  "salute": {
    "titolo": "Salute",
    "scopo": "La pagina Salute mostra i passi, il battito, la pressione, il peso, il sonno di chi abita la casa, e Strava. Le misure la plancia le trova da sola fra i sensori di Home Assistant. Qui scegli l'obiettivo, i nomi e, se serve, i sensori giusti.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b> con <b>«📱 Telefono»</b>, <b>«🖥️ Computer»</b> e <b>«▶ Apri l'anteprima»</b>.",
      "<b>👟 «OBIETTIVO DEI PASSI»</b>: il campo «Passi al giorno». L'anello della pagina si chiude a questo numero.",
      "<b>👤 «LE PERSONE»</b>: per ogni telefono trovato, il nome da usare (per esempio «Come chiamare «Telefono Persona 1»»).",
      "<b>🩺 «LE MISURE»</b>: una tendina per ogni misura: «Passi», «Battito a riposo», «Battito», «Peso», «Massa grassa», «Pressione massima», «Pressione minima», «Ossigeno», «Sonno», «Calorie a riposo», «Calorie», «Distanza a piedi», «Piani saliti», «Minuti di esercizio», «Ore in piedi». Ogni tendina offre:",
      "<b>«Automatico»</b>: la plancia usa il sensore che ha trovato da sola;",
      "un sensore preciso, scelto dall'elenco di tutti i sensori di casa;",
      "<b>«Nessuno: non mostrare»</b>: la misura non compare. Sotto la tendina leggi cosa ha trovato da sola (per esempio «Trovati da soli: Telefono Persona 1 Steps») oppure «Nessun sensore trovato da solo».",
      "<b>🏃 «STRAVA»</b>: con l'integrazione Strava di HACS in Home Assistant, nella pagina Salute compare anche la linguetta Strava.",
      "<b>«🟢 SEZIONE VISIBILE IN DASHBOARD — TOCCA PER NASCONDERE»</b> e <b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "In «OBIETTIVO DEI PASSI» scrivi i «Passi al giorno» (per esempio 8000).",
        "html": "In «OBIETTIVO DEI PASSI» scrivi i «Passi al giorno» (per esempio 8000)."
      },
      {
        "testo": "In «LE PERSONE» scrivi come chiamare ogni telefono, per esempio il nome della persona.",
        "html": "In «LE PERSONE» scrivi come chiamare ogni telefono, per esempio il nome della persona."
      },
      {
        "testo": "In «LE MISURE» guarda le righe «Trovati da soli»: – se il sensore trovato è giusto, lascia «Automatico»; – se è sbagliato o manca, scegli tu il sensore dalla tendina; – se una misura non ti interessa, scegli «Nessuno: non mostrare».",
        "html": "In «LE MISURE» guarda le righe «Trovati da soli»: – se il sensore trovato è giusto, lascia <b>«Automatico»</b>; – se è sbagliato o manca, scegli tu il sensore dalla tendina; – se una misura non ti interessa, scegli <b>«Nessuno: non mostrare»</b>."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      }
    ],
    "consigli": [
      "L'elenco dei sensori nelle tendine è lunghissimo perché contiene tutti i sensori di casa: scegli solo quello della misura giusta (per esempio, per il peso, il sensore «Weight» del telefono).",
      "Per Strava non c'è niente da fare qui: basta l'integrazione in Home Assistant. ---"
    ]
  },
  "prese": {
    "titolo": "Prese",
    "scopo": "Le prese di casa: la TV del salotto, il Firestick, il modem. Si accendono e si spengono come le luci, ma stanno per conto loro: così «spegni tutte le luci» non spegne il modem.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b> con <b>«📱 Telefono»</b>, <b>«🖥️ Computer»</b> e <b>«▶ Apri l'anteprima»</b>.",
      "<b>«🟢 SEZIONE VISIBILE IN DASHBOARD — TOCCA PER NASCONDERE»</b>.",
      "<b>L'elenco delle prese</b>: icona, nome, entità e stanza (per esempio «TV salotto · 🏠 Soggiorno»), con la matita ✏️ e il cestino 🗑️.",
      "<b>Il modulo «＋ Aggiungi presa»</b>:",
      "<b>«Nome»</b>;",
      "<b>«Entità Home Assistant»</b>: l'interruttore della presa;",
      "<b>«Consumo (facoltativo)»</b>: il wattmetro della presa, se ce l'ha. La card scrive quanto consuma accanto allo stato;",
      "<b>«Icona»</b> e <b>«Stanza»</b> (c'è anche «— Altre zone —»);",
      "<b>«Si vede ma non si comanda»</b>: per le prese da non spegnere (frigo, modem, congelatore). La riga resta, ma il tasto non risponde;",
      "<b>«IMMAGINE»</b>: <b>«Carica una foto»</b> (JPG, PNG, HEIC) oppure <b>«Scegli dai disegni»</b>. La foto riempie il riquadro al posto del disegno.",
      "<b>«＋ AGGIUNGI PRESA»</b> e <b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "Tocca «＋ AGGIUNGI PRESA».",
        "html": "Tocca <b>«＋ AGGIUNGI PRESA»</b>."
      },
      {
        "testo": "Scrivi il «Nome» e scegli l'«Entità Home Assistant» con «Scegli entità».",
        "html": "Scrivi il «Nome» e scegli l'«Entità Home Assistant» con <b>«Scegli entità»</b>."
      },
      {
        "testo": "Se la presa misura il consumo, scegli il sensore in «Consumo (facoltativo)».",
        "html": "Se la presa misura il consumo, scegli il sensore in «Consumo (facoltativo)»."
      },
      {
        "testo": "Scegli «Icona» e «Stanza».",
        "html": "Scegli «Icona» e «Stanza»."
      },
      {
        "testo": "Per il modem o il frigo accendi «Si vede ma non si comanda».",
        "html": "Per il modem o il frigo accendi <b>«Si vede ma non si comanda»</b>."
      },
      {
        "testo": "Se vuoi, metti una foto in «IMMAGINE».",
        "html": "Se vuoi, metti una foto in «IMMAGINE»."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      }
    ],
    "consigli": [
      "La foto resta in casa: si salva nell'add-on GdAHome e non passa da nessun server esterno. Il telefono la riduce a 1200 px prima di mandarla. ---"
    ]
  },
  "sez4": {
    "titolo": "Sicurezza",
    "scopo": "Qui colleghi l'antifurto e le telecamere. La sezione Sicurezza, la tessera della Home e il pannello a muro mostrano lo stato dell'allarme e diventano rossi quando scatta.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b> con <b>«📱 Telefono»</b>, <b>«🖥️ Computer»</b> e <b>«▶ Apri l'anteprima»</b>.",
      "<b>«🛡️ Sicurezza»</b>: la centrale d'allarme (per esempio <code>alarm_control_panel.casa</code>), con la sua stanza e il tasto «Modifica manuale».",
      "<b>«Modalità da mostrare»</b>: i tasti «CASA», «FUORI», «NOTTE», «VACANZA», «PARZIALE». Ci sono solo quelli che la centrale accetta davvero.",
      "<b>«🚨 Quando è scattato»</b>:",
      "<b>«Dove si legge se è scattato»</b>: l'entità che dice che l'antifurto sta suonando (un interruttore, un sensore o un aiutante);",
      "<b>«Il valore che vuol dire «scattato»»</b>: vuoto vuol dire «on»;",
      "<b>«Sirena (facoltativa)»</b>: serve per il tasto «Spegni sirena» nella notifica e nella Sicurezza;",
      "<b>«Che cosa l'ha fatto scattare (facoltativo)»</b>: un sensore che dice la zona;",
      "sotto, lo stato di adesso (per esempio «Adesso: a riposo»).",
      "<b>«Tasti d'inserimento su misura»</b>: per chi non ha una centrale (antifurto fatto con ESPHome, con gli script o con un elenco di modalità). Si aggiungono con <b>«＋ AGGIUNGI UN TASTO»</b>.",
      "<b>«🛡️ Zone e ingressi della centrale»</b>:",
      "<b>«Zone di quest'area»</b>: i sensori di movimento della centrale;",
      "<b>«Ingressi di quest'area»</b>: i contatti di porte e finestre.",
      "<b>«＋ AGGIUNGI UNA SECONDA AREA D'ALLARME»</b>: per una centrale divisa in aree (zona giorno e zona notte, casa e capannone).",
      "<b>«📹 Telecamere»</b>: l'elenco delle telecamere (per esempio «Ingresso», <code>camera.ingresso</code>) e, per ognuna, «Entità telecamera», «INDIRIZZO RTSP (FACOLTATIVO…)», «Video dal vivo nella tessera» e la stanza.",
      "<b>«＋ AGGIUNGI TELECAMERA»</b>, <b>«🟢 SEZIONE VISIBILE IN DASHBOARD — TOCCA PER NASCONDERE»</b> e <b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "La centrale d'allarme: Controlla che in «🛡️ Sicurezza» ci sia la tua centrale. Se non c'è, usa «Modifica manuale» e scegli l'entità.",
        "html": "<b>La centrale d'allarme</b>: Controlla che in «🛡️ Sicurezza» ci sia la tua centrale. Se non c'è, usa «Modifica manuale» e scegli l'entità."
      },
      {
        "testo": "In «Modalità da mostrare» spegni le modalità che non usi. Si nascondono solo dalla sezione: la centrale non cambia, e lo sblocco resta sempre.",
        "html": "In «Modalità da mostrare» spegni le modalità che non usi. Si nascondono solo dalla sezione: la centrale non cambia, e lo sblocco resta sempre."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      },
      {
        "testo": "L'allarme scattato: In «Dove si legge se è scattato» scegli l'entità che dice che l'antifurto suona.",
        "html": "<b>L'allarme scattato</b>: In «Dove si legge se è scattato» scegli l'entità che dice che l'antifurto suona."
      },
      {
        "testo": "Se quell'entità non dice «on» quando scatta, scrivi il valore giusto in «Il valore che vuol dire «scattato»».",
        "html": "Se quell'entità non dice «on» quando scatta, scrivi il valore giusto in «Il valore che vuol dire «scattato»»."
      },
      {
        "testo": "Se vuoi il tasto «Spegni sirena», scegli la «Sirena (facoltativa)».",
        "html": "Se vuoi il tasto «Spegni sirena», scegli la «Sirena (facoltativa)»."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      },
      {
        "testo": "Antifurto senza centrale: In «Tasti d'inserimento su misura» tocca «＋ AGGIUNGI UN TASTO».",
        "html": "<b>Antifurto senza centrale</b>: In «Tasti d'inserimento su misura» tocca <b>«＋ AGGIUNGI UN TASTO»</b>."
      },
      {
        "testo": "Crea un tasto per ogni modo di inserire l'allarme. I tasti compaiono nella sezione Sicurezza e nella tessera della Home.",
        "html": "Crea un tasto per ogni modo di inserire l'allarme. I tasti compaiono nella sezione Sicurezza e nella tessera della Home."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      },
      {
        "testo": "Zone e ingressi: In «Zone di quest'area» accendi i sensori che sono vere zone dell'allarme.",
        "html": "<b>Zone e ingressi</b>: In «Zone di quest'area» accendi i sensori che sono vere zone dell'allarme."
      },
      {
        "testo": "In «Ingressi di quest'area» accendi le porte e le finestre da vedere.",
        "html": "In «Ingressi di quest'area» accendi le porte e le finestre da vedere."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      },
      {
        "testo": "Le telecamere: Tocca «＋ AGGIUNGI TELECAMERA».",
        "html": "<b>Le telecamere</b>: Tocca <b>«＋ AGGIUNGI TELECAMERA»</b>."
      },
      {
        "testo": "In «Entità telecamera» scegli la telecamera con «Scegli entità».",
        "html": "In «Entità telecamera» scegli la telecamera con <b>«Scegli entità»</b>."
      },
      {
        "testo": "Se la telecamera non è in Home Assistant, scrivi l'indirizzo RTSP.",
        "html": "Se la telecamera non è in Home Assistant, scrivi l'indirizzo RTSP."
      },
      {
        "testo": "Accendi «Video dal vivo nella tessera» solo sulle telecamere che vuoi vedere muoversi.",
        "html": "Accendi <b>«Video dal vivo nella tessera»</b> solo sulle telecamere che vuoi vedere muoversi."
      },
      {
        "testo": "Scegli la stanza e premi «💾 SALVA SEZIONE».",
        "html": "Scegli la stanza e premi <b>«💾 SALVA SEZIONE»</b>."
      }
    ],
    "consigli": [
      "Se lasci vuoto «Che cosa l'ha fatto scattare», la casa guarda quale porta, finestra o movimento si è acceso per ultimo.",
      "Se non accendi nessuna zona, la pagina Sicurezza non mostra la parte «Zone».",
      "Gli ingressi hanno lo stesso nome e lo stesso stato che hanno nella scheda Varchi.",
      "«Video dal vivo nella tessera» tiene aperta una connessione mentre guardi la sezione: senza, la tessera mostra un'istantanea ogni quattro secondi. ---"
    ]
  },
  "varchi": {
    "titolo": "Varchi",
    "scopo": "I varchi di casa: porte, finestre, portone, basculante. La pagina Varchi li mostra in quest'ordine: verde chiuso, rosso aperto, e in cima quanti sono aperti adesso.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b> con <b>«📱 Telefono»</b>, <b>«🖥️ Computer»</b> e <b>«▶ Apri l'anteprima»</b>.",
      "<b>L'elenco dei varchi</b>: per ognuno il nome, lo stato di adesso («Chiusa», «Aperta»), l'entità del contatto, la tendina della stanza, la matita ✏️ e il cestino 🗑️.",
      "<b>«＋ AGGIUNGI VARCO»</b>.",
      "<b>«🟢 SEZIONE VISIBILE IN DASHBOARD — TOCCA PER NASCONDERE»</b> e <b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "Tocca «＋ AGGIUNGI VARCO».",
        "html": "Tocca <b>«＋ AGGIUNGI VARCO»</b>."
      },
      {
        "testo": "Scegli l'entità del contatto (per esempio binary_sensor.finestra_cucina).",
        "html": "Scegli l'entità del contatto (per esempio <code>binary_sensor.finestra_cucina</code>)."
      },
      {
        "testo": "Scrivi il nome che vuoi e scegli il disegno.",
        "html": "Scrivi il nome che vuoi e scegli il disegno."
      },
      {
        "testo": "Scegli la stanza dalla tendina.",
        "html": "Scegli la stanza dalla tendina."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      }
    ],
    "consigli": [
      "L'ordine dell'elenco è l'ordine della pagina Varchi.",
      "Gli stessi contatti si possono mostrare fra gli «Ingressi» della scheda Sicurezza. ---"
    ]
  },
  "presenza": {
    "titolo": "Presenza",
    "scopo": "I rilevatori di presenza e di movimento. La pagina Presenza mostra in cima quante stanze hanno qualcuno dentro e, sotto, una card per ogni rilevatore con da quanto tempo è così.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b> con <b>«📱 Telefono»</b>, <b>«🖥️ Computer»</b> e <b>«▶ Apri l'anteprima»</b>.",
      "<b>L'elenco dei rilevatori</b>: nome, entità con lo stato di adesso (per esempio «libero»), tendina della stanza, matita ✏️ e cestino 🗑️.",
      "<b>«＋ AGGIUNGI RILEVATORE»</b>.",
      "<b>«🟢 SEZIONE VISIBILE IN DASHBOARD — TOCCA PER NASCONDERE»</b> e <b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "Tocca «＋ AGGIUNGI RILEVATORE».",
        "html": "Tocca <b>«＋ AGGIUNGI RILEVATORE»</b>."
      },
      {
        "testo": "Scegli l'entità del rilevatore, scrivi il nome che vuoi e scegli il disegno.",
        "html": "Scegli l'entità del rilevatore, scrivi il nome che vuoi e scegli il disegno."
      },
      {
        "testo": "Scegli la stanza: serve a contare quante stanze sono occupate.",
        "html": "Scegli la stanza: serve a contare quante stanze sono occupate."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE». ---",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>. ---"
      }
    ],
    "consigli": []
  },
  "doors": {
    "titolo": "Apri porte/cancelli",
    "scopo": "Le aperture della sezione Sicurezza: portone, porta di casa, cancello, garage. Ogni porta ha la sua card. Il tocco chiede conferma e, se imposti un PIN, il codice.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b> con <b>«📱 Telefono»</b>, <b>«🖥️ Computer»</b> e <b>«▶ Apri l'anteprima»</b>.",
      "<b>L'elenco delle aperture</b>: icona, nome, entità (per esempio <code>lock.portone</code>), tendina della stanza, matita ✏️ e cestino 🗑️.",
      "<b>«＋ AGGIUNGI APERTURA»</b>.",
      "<b>«Chiedi conferma prima di aprire»</b>: l'interruttore della conferma.",
      "<b>«🟢 SEZIONE VISIBILE IN DASHBOARD — TOCCA PER NASCONDERE»</b> e <b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "Tocca «＋ AGGIUNGI APERTURA».",
        "html": "Tocca <b>«＋ AGGIUNGI APERTURA»</b>."
      },
      {
        "testo": "Scegli l'entità della serratura o del cancello e scrivi il nome.",
        "html": "Scegli l'entità della serratura o del cancello e scrivi il nome."
      },
      {
        "testo": "Se vuoi proteggerla, imposta un PIN nella modifica ✏️.",
        "html": "Se vuoi proteggerla, imposta un PIN nella modifica ✏️."
      },
      {
        "testo": "Scegli la stanza.",
        "html": "Scegli la stanza."
      },
      {
        "testo": "Decidi se tenere acceso «Chiedi conferma prima di aprire».",
        "html": "Decidi se tenere acceso <b>«Chiedi conferma prima di aprire»</b>."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      }
    ],
    "consigli": [
      "Spegni la conferma se apri il portone dieci volte al giorno: si apre al primo tocco.",
      "Il PIN non è una conferma: una porta con il PIN continua a chiederlo anche con la conferma spenta. ---"
    ]
  },
  "citofono": {
    "titolo": "Citofono e posta",
    "scopo": "Chi suona alla porta e cosa c'è nella cassetta delle lettere. Del citofono servono il tasto che apre e, se c'è, il campanello. Della cassetta basta un sensore.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b> con <b>«📱 Telefono»</b>, <b>«🖥️ Computer»</b> e <b>«▶ Apri l'anteprima»</b>.",
      "<b>«🔔 Citofono»</b>: all'inizio «Niente, per ora».",
      "<b>«🔗 AGGIUNGI DA UN'INTEGRAZIONE»</b>: per Ring, Doorbird, 2N, un relè su un cancello… Le caselle si compilano da sole: il tasto che apre, il campanello e la telecamera.",
      "<b>«＋ AGGIUNGI CITOFONO»</b>: per compilarlo a mano.",
      "<b>«📬 Cassetta della posta»</b>: all'inizio «Niente, per ora».",
      "<b>«🔗 AGGIUNGI DA UN'INTEGRAZIONE»</b>: per il Vallhorn di IKEA, un contatto Zigbee sullo sportello, un sensore di luce…",
      "<b>«＋ AGGIUNGI CASSETTA»</b>.",
      "<b>«⚪ SEZIONE VUOTA — AGGIUNGI UN'ENTITÀ QUI SOTTO PER MOSTRARLA»</b> e <b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "Il citofono: Tocca «🔗 AGGIUNGI DA UN'INTEGRAZIONE» sotto «🔔 Citofono» e scegli il dispositivo, oppure tocca «＋ AGGIUNGI CITOFONO».",
        "html": "<b>Il citofono</b>: Tocca <b>«🔗 AGGIUNGI DA UN'INTEGRAZIONE»</b> sotto «🔔 Citofono» e scegli il dispositivo, oppure tocca <b>«＋ AGGIUNGI CITOFONO»</b>."
      },
      {
        "testo": "A mano, scegli il tasto che apre (un pulsante, uno script, una serratura, un cancello motorizzato) e, se c'è, il campanello.",
        "html": "A mano, scegli il tasto che apre (un pulsante, uno script, una serratura, un cancello motorizzato) e, se c'è, il campanello."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      },
      {
        "testo": "La cassetta della posta: Tocca «🔗 AGGIUNGI DA UN'INTEGRAZIONE» sotto «📬 Cassetta della posta», oppure «＋ AGGIUNGI CASSETTA».",
        "html": "<b>La cassetta della posta</b>: Tocca <b>«🔗 AGGIUNGI DA UN'INTEGRAZIONE»</b> sotto «📬 Cassetta della posta», oppure <b>«＋ AGGIUNGI CASSETTA»</b>."
      },
      {
        "testo": "Scegli il sensore che dice che è arrivato qualcosa e, se lo hai, quello dello sportello.",
        "html": "Scegli il sensore che dice che è arrivato qualcosa e, se lo hai, quello dello sportello."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      }
    ],
    "consigli": [
      "Con due sensori (arrivo e sportello) la plancia capisce da sola se la posta è ancora dentro.",
      "Con un sensore solo, l'apertura vale come arrivo: quando prendi la posta lo dici tu, col tasto sulla card. ---"
    ]
  },
  "allerte": {
    "titolo": "Allerte",
    "scopo": "La pagina Allerte raccoglie terremoti, avvisi della protezione civile, fulmini, pollini, comfort termico, voli sopra casa, scioperi, treni e qualità dell'aria. Per ognuno scegli il sensore che la sua integrazione ha già portato in Home Assistant. La plancia non chiama nessun servizio: legge quello che c'è.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b> con <b>«📱 Telefono»</b>, <b>«🖥️ Computer»</b> e <b>«▶ Apri l'anteprima»</b>.",
      "<b>Un blocco per ogni fonte</b>, ognuno con le sue caselle <b>«Scegli entità»</b>:",
      "<b>«TERREMOTI»</b>: «Sensore dei terremoti», «Magnitudo (facoltativa)», «Distanza in km (facoltativa)». Va bene l'integrazione INGV Terremoti;",
      "<b>«PROTEZIONE CIVILE»</b>: «Avviso della protezione civile» (Meteoalarm o i bollettini della Protezione Civile, che dicono «gialla», «arancione», «rossa»);",
      "<b>«FULMINI»</b>: «Conteggio dei fulmini» e «Distanza dell'ultimo fulmine (km)», per esempio da Blitzortung;",
      "<b>«POLLINI»</b>: «Pollini di oggi», più «Graminacee», «Erbacce», «Alberi» (facoltativi);",
      "<b>«COMFORT TERMICO»</b>: «Percezione», più «Humidex», «Indice di calore», «Rischio gelo» (facoltativi), per esempio da Thermal Comfort;",
      "<b>«VOLI SOPRA CASA»</b>: «Voli in zona», per esempio da Flightradar24;",
      "<b>«SCIOPERI»</b>: «Sensore degli scioperi»;",
      "<b>«TRENI»</b>: «Treno seguito» e «Stazione preferita (facoltativa)».",
      "<b>🍃 «QUALITÀ DELL'ARIA»</b>: i sensori dell'aria (polveri, CO₂, monossido, composti volatili) li trova Home Assistant da solo. Qui si corregge:",
      "<b>«La misura in copertina»</b> con il tasto <b>«METTI»</b>: il numero grande della tessera;",
      "<b>«Non contare questo sensore»</b> con <b>«TOGLI»</b>: esclude un sensore;",
      "<b>«Aggiungi un sensore che non viene trovato»</b>: scegli il sensore, poi che misura è (PM2.5, PM10, Anidride carbonica…) e premi <b>«AGGIUNGI»</b>;",
      "<b>«I confini di ogni misura»</b>: per ogni sostanza i valori che separano buona, discreta, scarsa e cattiva, e il tasto <b>«Rimetti le norme»</b>.",
      "<b>«⚪ SEZIONE VUOTA — AGGIUNGI UN'ENTITÀ QUI SOTTO PER MOSTRARLA»</b> e <b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "Le allerte: Scegli il blocco che ti interessa, per esempio «FULMINI».",
        "html": "<b>Le allerte</b>: Scegli il blocco che ti interessa, per esempio «FULMINI»."
      },
      {
        "testo": "Nella prima casella tocca «Scegli entità» e scegli il sensore della tua integrazione.",
        "html": "Nella prima casella tocca <b>«Scegli entità»</b> e scegli il sensore della tua integrazione."
      },
      {
        "testo": "Se vuoi, riempi anche le caselle facoltative.",
        "html": "Se vuoi, riempi anche le caselle facoltative."
      },
      {
        "testo": "Ripeti per le altre fonti che hai.",
        "html": "Ripeti per le altre fonti che hai."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      },
      {
        "testo": "La qualità dell'aria: Se vuoi un numero preciso in copertina (per esempio l'indice della tua centralina), sceglilo in «La misura in copertina» e premi «METTI».",
        "html": "<b>La qualità dell'aria</b>: Se vuoi un numero preciso in copertina (per esempio l'indice della tua centralina), sceglilo in «La misura in copertina» e premi <b>«METTI»</b>."
      },
      {
        "testo": "Se un sensore non deve contare (per esempio quello esterno), sceglilo in «Non contare questo sensore» e premi «TOGLI».",
        "html": "Se un sensore non deve contare (per esempio quello esterno), sceglilo in «Non contare questo sensore» e premi <b>«TOGLI»</b>."
      },
      {
        "testo": "Se un sensore fatto in casa non viene trovato, sceglilo in «Aggiungi un sensore che non viene trovato», indica che misura è e premi «AGGIUNGI».",
        "html": "Se un sensore fatto in casa non viene trovato, sceglilo in «Aggiungi un sensore che non viene trovato», indica che misura è e premi <b>«AGGIUNGI»</b>."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      }
    ],
    "consigli": [
      "Nessuna casella è obbligatoria e ognuna basta da sola: la pagina mostra solo le fonti che hai.",
      "Lascia vuota «La misura in copertina»: in copertina va la misura messa peggio, che di solito è la risposta giusta.",
      "I confini di serie seguono le norme (indice europeo, EN 16798-1 per la CO₂, OMS per il monossido). Cambiali solo se sai perché; per tornare indietro usa <b>«Rimetti le norme»</b>.",
      "Un treno soppresso diventa un allarme. ---"
    ]
  },
  "agenda": {
    "titolo": "Agenda",
    "scopo": "Gli impegni e le cose da fare, nella stessa pagina. Qui scegli quali calendari e quali liste guardare.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b> con <b>«📱 Telefono»</b>, <b>«🖥️ Computer»</b> e <b>«▶ Apri l'anteprima»</b>.",
      "<b>«📅 Calendario»</b>: i calendari di Home Assistant scelti (per esempio «Famiglia», «Lavoro»), con la stanza, la matita ✏️ e il cestino 🗑️. Sotto, <b>«＋ AGGIUNGI CALENDARIO»</b> e <b>«🪄 RILEVA DA HOME ASSISTANT»</b>.",
      "<b>«✅ Cose da fare»</b>: le liste ToDo di Home Assistant (per esempio «Spesa», «Cose di casa»), con <b>«＋ AGGIUNGI LISTA»</b> e <b>«🪄 RILEVA DA HOME ASSISTANT»</b>.",
      "<b>«🟢 SEZIONE VISIBILE IN DASHBOARD — TOCCA PER NASCONDERE»</b> e <b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "Sotto «📅 Calendario» tocca «🪄 RILEVA DA HOME ASSISTANT» per prendere tutti i calendari, oppure «＋ AGGIUNGI CALENDARIO» per sceglierne uno.",
        "html": "Sotto «📅 Calendario» tocca <b>«🪄 RILEVA DA HOME ASSISTANT»</b> per prendere tutti i calendari, oppure <b>«＋ AGGIUNGI CALENDARIO»</b> per sceglierne uno."
      },
      {
        "testo": "Togli con il cestino 🗑️ quelli che non vuoi.",
        "html": "Togli con il cestino 🗑️ quelli che non vuoi."
      },
      {
        "testo": "Fai lo stesso sotto «✅ Cose da fare» con le liste.",
        "html": "Fai lo stesso sotto «✅ Cose da fare» con le liste."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      }
    ],
    "consigli": [
      "La sezione «Agenda» compare nella barra appena scegli un calendario.",
      "La tessera in Home mostra i prossimi due impegni. Se la tessera si vede o no lo decidi nella scheda <b>Widget</b>.",
      "Le cose da fare si spuntano dalla tessera e dalla sezione; quelle con una scadenza compaiono nel giorno in cui scadono. ---"
    ]
  },
  "rifiuti": {
    "titolo": "Rifiuti",
    "scopo": "La raccolta differenziata. La pagina risponde alla domanda della sera, «cosa metto fuori stasera», e la tessera in Home si accende il giorno prima del ritiro.",
    "campi": [
      "<b>«✋ Sposta e nascondi»</b> con <b>«📱 Telefono»</b>, <b>«🖥️ Computer»</b> e <b>«▶ Apri l'anteprima»</b>.",
      "<b>«♻️ Raccolta differenziata»</b>: un bidone per materiale, ognuno con il suo sensore. Si aggiunge con <b>«＋ AGGIUNGI MATERIALE»</b>.",
      "<b>«Calendario o sensore unico (facoltativo)»</b>: per chi ha tutti i ritiri in un posto solo.",
      "<b>«Da che ora si guarda a domani»</b>: da quest'ora la pagina parla del ritiro di domani.",
      "<b>«🗓️ Il calendario di casa»</b>: due settimane che si ripetono, scritte a mano, con il campo «La prima settimana comincia il» e i giorni da «LUN» a «DOM» di «SETTIMANA 1» e «SETTIMANA 2».",
      "<b>«🟢 SEZIONE VISIBILE IN DASHBOARD — TOCCA PER NASCONDERE»</b> e <b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "Con i sensori di Home Assistant: Tocca «＋ AGGIUNGI MATERIALE».",
        "html": "<b>Con i sensori di Home Assistant</b>: Tocca <b>«＋ AGGIUNGI MATERIALE»</b>."
      },
      {
        "testo": "Scegli «Che materiale è» (carta, plastica…) e il «Sensore o calendario del ritiro».",
        "html": "Scegli «Che materiale è» (carta, plastica…) e il «Sensore o calendario del ritiro»."
      },
      {
        "testo": "Ripeti per ogni materiale e premi «💾 SALVA SEZIONE».",
        "html": "Ripeti per ogni materiale e premi <b>«💾 SALVA SEZIONE»</b>."
      },
      {
        "testo": "Con un calendario unico: In «Calendario o sensore unico (facoltativo)» scegli il calendario con un evento per ritiro, o il sensore con l'elenco dei ritiri.",
        "html": "<b>Con un calendario unico</b>: In «Calendario o sensore unico (facoltativo)» scegli il calendario con un evento per ritiro, o il sensore con l'elenco dei ritiri."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE». Ogni voce diventa una riga, e il materiale lo indovina dal nome.",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>. Ogni voce diventa una riga, e il materiale lo indovina dal nome."
      },
      {
        "testo": "A mano, senza sensori: In «🗓️ Il calendario di casa» scegli la data in «La prima settimana comincia il».",
        "html": "<b>A mano, senza sensori</b>: In «🗓️ Il calendario di casa» scegli la data in «La prima settimana comincia il»."
      },
      {
        "testo": "Tocca un giorno della «SETTIMANA 1» e scegli cosa esce. Fai lo stesso per la «SETTIMANA 2».",
        "html": "Tocca un giorno della «SETTIMANA 1» e scegli cosa esce. Fai lo stesso per la «SETTIMANA 2»."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      }
    ],
    "consigli": [
      "Imposta «Da che ora si guarda a domani» all'ora in cui il ritiro di oggi è già passato.",
      "Se un materiale ha già il suo sensore, il calendario di casa non lo ripete: comanda il sensore. ---"
    ]
  },
  "alexa": {
    "titolo": "Notifiche",
    "scopo": "Le notifiche arrivano ai telefoni. Con questa scheda le dicono anche gli Echo di casa, per chi è in casa con le mani occupate. Vale per tutta la casa.",
    "campi": [
      "<b>«Fai dire le notifiche agli Echo»</b>: l'interruttore e la scelta degli Echo. Se in Home Assistant non c'è nessun Echo, leggi «Nessun Echo in Home Assistant».",
      "<b>«Quali notifiche»</b>: «Urgenti: antifurto, allarmi, campanello, blackout», «Sicurezza: inserimenti, aperture, movimento», «Casa: elettrodomestici, frigo, pioggia, animali», «Persone: chi arriva», «Le tue notifiche personalizzate», «Dalle automazioni di Home Assistant».",
      "<b>«Di notte zitti»</b>: con gli orari «Dalle» e «alle».",
      "<b>«Come lo dice»</b>: «Annuncio» (prima il suono, poi la voce) oppure «Voce» (solo la voce).",
      "<b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "Prima, in Home Assistant, aggiungi l'integrazione «Alexa Devices» (oppure «Alexa Media Player» da HACS) e accedi con il tuo account Amazon. Gli Echo compaiono qui da soli.",
        "html": "Prima, in Home Assistant, aggiungi l'integrazione «Alexa Devices» (oppure «Alexa Media Player» da HACS) e accedi con il tuo account Amazon. Gli Echo compaiono qui da soli."
      },
      {
        "testo": "Accendi «Fai dire le notifiche agli Echo» e tocca gli Echo che devono parlare.",
        "html": "Accendi <b>«Fai dire le notifiche agli Echo»</b> e tocca gli Echo che devono parlare."
      },
      {
        "testo": "In «Quali notifiche» accendi i gruppi che vuoi sentire.",
        "html": "In «Quali notifiche» accendi i gruppi che vuoi sentire."
      },
      {
        "testo": "Se vuoi silenzio di notte, accendi «Di notte zitti» e scegli «Dalle» e «alle».",
        "html": "Se vuoi silenzio di notte, accendi «Di notte zitti» e scegli «Dalle» e «alle»."
      },
      {
        "testo": "In «Come lo dice» scegli «Annuncio» o «Voce».",
        "html": "In «Come lo dice» scegli «Annuncio» o «Voce»."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      }
    ],
    "consigli": [
      "Gli Echo dicono solo le notifiche accese nelle Notifiche dell'app: una voce spenta su tutti i telefoni non la dicono.",
      "Di notte le notifiche urgenti si dicono lo stesso. ---"
    ]
  },
  "alexa_avvisi": {
    "titolo": "Avvisi personalizzati",
    "scopo": "Frasi tue che gli Echo dicono a un orario o quando cambia qualcosa in casa, per esempio «È ora di andare a scuola».",
    "campi": [
      "<b>«Alexa non parla ancora»</b>: compare se gli Echo non sono ancora accesi nella scheda «Notifiche».",
      "<b>«Avvisi personalizzati»</b>: l'elenco delle tue frasi.",
      "<b>«＋ Nuovo avviso»</b>: crea una frase nuova.",
      "<b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "Se vedi «Alexa non parla ancora», vai prima nella scheda Notifiche, accendi gli Echo e sceglili.",
        "html": "Se vedi «Alexa non parla ancora», vai prima nella scheda <b>Notifiche</b>, accendi gli Echo e sceglili."
      },
      {
        "testo": "Tocca «＋ Nuovo avviso».",
        "html": "Tocca <b>«＋ Nuovo avviso»</b>."
      },
      {
        "testo": "Scrivi la frase in «Cosa dice».",
        "html": "Scrivi la frase in «Cosa dice»."
      },
      {
        "testo": "Scegli quando: «A un orario» (con i giorni) oppure «Quando cambia qualcosa».",
        "html": "Scegli quando: «A un orario» (con i giorni) oppure «Quando cambia qualcosa»."
      },
      {
        "testo": "In «Su quali Echo» scegli gli Echo. Se non ne scegli nessuno, usa quelli della scheda Notifiche.",
        "html": "In «Su quali Echo» scegli gli Echo. Se non ne scegli nessuno, usa quelli della scheda Notifiche."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      }
    ],
    "consigli": [
      "Gli avvisi a orario si dicono anche di notte. ---"
    ]
  },
  "alexa_musica": {
    "titolo": "Musica",
    "scopo": "Fa suonare la musica e le radio sugli Echo di casa.",
    "campi": [
      "Se in Home Assistant non c'è nessun Echo, la scheda mostra solo «Nessun Echo in Home Assistant» e come rimediare.",
      "Con gli Echo collegati: gli Echo su cui suonare, cosa suonare (un artista, un brano, un album, una playlist o una radio) e le radio preferite scelte in Musica › Radio.",
      "<b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "In Home Assistant aggiungi l'integrazione «Alexa Devices», oppure «Alexa Media Player» da HACS, e accedi con il tuo account Amazon.",
        "html": "In Home Assistant aggiungi l'integrazione «Alexa Devices», oppure «Alexa Media Player» da HACS, e accedi con il tuo account Amazon."
      },
      {
        "testo": "Torna in questa scheda: gli Echo compaiono da soli.",
        "html": "Torna in questa scheda: gli Echo compaiono da soli."
      },
      {
        "testo": "Tocca un Echo per sceglierlo e scegli cosa suonare.",
        "html": "Tocca un Echo per sceglierlo e scegli cosa suonare."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      }
    ],
    "consigli": [
      "Il servizio musicale deve essere collegato agli Echo nell'app Alexa.",
      "Le radio preferite si scelgono nella scheda <b>Radio</b> (famiglia Casa); sugli Echo le cerca TuneIn. ---"
    ]
  },
  "sez6": {
    "titolo": "MiniPC",
    "scopo": "Tiene d'occhio il computer su cui gira Home Assistant, gli altri computer di casa e la rete: processore, memoria, disco, temperatura, internet, velocità della linea.",
    "campi": [
      "<b>«🖥️ Monitoraggio server»</b>: i valori del computer principale. Dalla tendina «— Scegli parametro —» scegli cosa mostrare («CPU (%)», «RAM (%)», «Disco (%)», «Temperatura CPU (°C)», «Internet», «Speedtest Download (Mbit/s)»…) e premi <b>«＋ AGGIUNGI»</b>. Ogni riga ha la sua entità, la matita «Modifica» e il cestino.",
      "<b>«✋ Sposta e nascondi»</b> con <b>«📱 Telefono»</b>, <b>«🖥️ Computer»</b> e <b>«▶ Apri l'anteprima»</b>.",
      "<b>«🖧 Altri nodi del cluster»</b>: gli altri computer, uno per riga, con <b>«🔗 AGGIUNGI DA UN'INTEGRAZIONE»</b> (Proxmox VE, Glances, System Monitor…) e <b>«＋ AGGIUNGI NODO»</b>.",
      "<b>Le macchine e la rete</b>: ogni riga è una macchina, con l'entità, il nome, il disegno e la fascia in cui sta («Macchina o container» oppure «Pezzo di rete»). C'è <b>«DA QUALI INTEGRAZIONI»</b> e <b>«＋ AGGIUNGI MACCHINA»</b>.",
      "<b>«Si vede in Home»</b>: mostra o nasconde la tessera in Home.",
      "<b>«🟢 SEZIONE VISIBILE IN DASHBOARD — TOCCA PER NASCONDERE»</b> e <b>«💾 SALVA SEZIONE»</b>."
    ],
    "passi": [
      {
        "testo": "Il computer principale: In «🖥️ Monitoraggio server» scegli un parametro dalla tendina e premi «＋ AGGIUNGI».",
        "html": "<b>Il computer principale</b>: In «🖥️ Monitoraggio server» scegli un parametro dalla tendina e premi <b>«＋ AGGIUNGI»</b>."
      },
      {
        "testo": "Nella riga scegli l'entità giusta (per esempio sensor.minipc_cpu).",
        "html": "Nella riga scegli l'entità giusta (per esempio <code>sensor.minipc_cpu</code>)."
      },
      {
        "testo": "Ripeti solo per i valori che vuoi vedere, poi premi «💾 SALVA SEZIONE».",
        "html": "Ripeti solo per i valori che vuoi vedere, poi premi <b>«💾 SALVA SEZIONE»</b>."
      },
      {
        "testo": "Gli altri nodi: Tocca «🔗 AGGIUNGI DA UN'INTEGRAZIONE» e scegli il dispositivo del nodo, oppure «＋ AGGIUNGI NODO».",
        "html": "<b>Gli altri nodi</b>: Tocca <b>«🔗 AGGIUNGI DA UN'INTEGRAZIONE»</b> e scegli il dispositivo del nodo, oppure <b>«＋ AGGIUNGI NODO»</b>."
      },
      {
        "testo": "Dai un nome al nodo e controlla le caselle.",
        "html": "Dai un nome al nodo e controlla le caselle."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      },
      {
        "testo": "Le macchine e la rete: Tocca «＋ AGGIUNGI MACCHINA».",
        "html": "<b>Le macchine e la rete</b>: Tocca <b>«＋ AGGIUNGI MACCHINA»</b>."
      },
      {
        "testo": "Scegli l'«Entità della macchina», il nome e il disegno.",
        "html": "Scegli l'«Entità della macchina», il nome e il disegno."
      },
      {
        "testo": "In «In quale fascia» scegli «Macchina o container» o «Pezzo di rete».",
        "html": "In «In quale fascia» scegli «Macchina o container» o «Pezzo di rete»."
      },
      {
        "testo": "Premi «💾 SALVA SEZIONE».",
        "html": "Premi <b>«💾 SALVA SEZIONE»</b>."
      }
    ],
    "consigli": [
      "Le caselle dei nodi sono tutte facoltative: una casella vuota è una barra che non compare.",
      "Finché non scegli l'entità, una macchina non si vede né nella pagina né nel conto di quelle giù.",
      "«Si vede in Home» è lo stesso interruttore di <b>Configurazione → Widget</b>, dove scegli anche l'ordine delle tessere. ---"
    ]
  },
  "scollegati": {
    "titolo": "Dispositivi non connessi",
    "scopo": "Mostra tutti i dispositivi di Home Assistant che non rispondono, anche quelli che la plancia non mostra. Un apparecchio finisce qui quando tacciono tutte le sue entità.",
    "campi": [
      "<b>L'elenco dei dispositivi che non rispondono.</b> Se va tutto bene leggi «Adesso risponde tutto».",
      "<b>Il cestino 🗑️</b>: toglie un dispositivo dall'avviso.",
      "<b>Il campanello 🔔</b>: fra i dispositivi tolti, rimette quello che vuoi nell'avviso."
    ],
    "passi": [
      {
        "testo": "Apri la scheda: non c'è niente da impostare, l'elenco si riempie da solo.",
        "html": "Apri la scheda: non c'è niente da impostare, l'elenco si riempie da solo."
      },
      {
        "testo": "Se un dispositivo è spento apposta (per esempio un apparecchio di stagione), tocca il cestino 🗑️: non darà più l'avviso.",
        "html": "Se un dispositivo è spento apposta (per esempio un apparecchio di stagione), tocca il cestino 🗑️: non darà più l'avviso."
      },
      {
        "testo": "Per riaverlo nell'avviso, trovalo fra quelli tolti e tocca il campanello.",
        "html": "Per riaverlo nell'avviso, trovalo fra quelli tolti e tocca il campanello."
      }
    ],
    "consigli": [
      "Aiutanti, automazioni e script non compaiono: non hanno un apparecchio dietro.",
      "Quando un dispositivo smette di rispondere, in Home compare anche la sua tessera. ---"
    ]
  }
});

/* I passi di «Crea la tua casa», la procedura della Casa 3D (capitolo 28). */
export const GUIDE_3D = Object.freeze({
  "0": {
    "titolo": "Planimetria",
    "scopo": "Dai alla procedura la forma del piano: da qui vengono muri, porte, finestre e stanze. Si sceglie anche quale piano della casa si sta facendo.",
    "campi": [
      "<b>«Il piano»</b>: i tasti dei piani, dal seminterrato al terzo piano.",
      "<b>«Carica una foto o un PDF della planimetria»</b>: il PDF del catasto va bene così com'è, la scala la legge dal foglio.",
      "<b>«Carica il disegno DWG»</b>: scala e nomi delle stanze li prende dal disegno.",
      "<b>«Disegnala qui»</b>: scrivi larghezza e profondità del piano in metri, poi dividi le stanze col «Muro dritto».",
      "<b>«Dalle foto delle stanze»</b>: fotografi ogni stanza intera e la pianta si fa da sola, misurando le cose di misura nota (forno, WC, condizionatore…).",
      "<b>«Consigli»</b>: foto dall'alto, foglio intero, buona luce."
    ],
    "passi": [
      {
        "testo": "Tocca il piano che stai facendo in «Il piano» (di solito «Piano terra»).",
        "html": "Tocca il piano che stai facendo in «Il piano» (di solito «Piano terra»)."
      },
      {
        "testo": "Premi «Carica una foto o un PDF della planimetria» e scegli il file. Se hai il disegno del tecnico, premi invece «Carica il disegno DWG».",
        "html": "Premi «Carica una foto o un PDF della planimetria» e scegli il file. Se hai il disegno del tecnico, premi invece «Carica il disegno DWG»."
      },
      {
        "testo": "Aspetta il messaggio «✓ Raddrizzata»: la foto è stata raddrizzata da sola.",
        "html": "Aspetta il messaggio «✓ Raddrizzata»: la foto è stata raddrizzata da sola."
      },
      {
        "testo": "Premi «Avanti →».",
        "html": "Premi «Avanti →»."
      },
      {
        "testo": "Senza planimetria: In «Non hai una planimetria?» scrivi le misure esterne del piano, per esempio 12 × 8 metri.",
        "html": "<b>Senza planimetria</b>: In «Non hai una planimetria?» scrivi le misure esterne del piano, per esempio 12 × 8 metri."
      },
      {
        "testo": "Premi «Disegnala qui», poi al passo dei muri dividi le stanze con «Muro dritto».",
        "html": "Premi «Disegnala qui», poi al passo dei muri dividi le stanze con «Muro dritto»."
      }
    ],
    "consigli": [
      "La foto non deve essere dritta e le scritte non danno fastidio: conta che il foglio sia intero e ben illuminato.",
      "Il PDF del catasto è il modo più preciso: la scala la legge da solo."
    ]
  },
  "1": {
    "titolo": "Scala",
    "scopo": "Insegna alla procedura quanto è grande la casa: quanti pixel della foto fanno un metro. Senza la scala giusta le stanze vengono troppo grandi o troppo piccole.",
    "campi": [
      "La pianta, su cui si toccano i due estremi di una misura nota.",
      "«Punti: 0 di 2», che diventa «✓ Due punti scelti».",
      "La casella «metri» e la riga «1 metro = … pixel della foto».",
      "Spesso la scala la trova da sola: «✓ Scala trovata dallo spessore dei muri»."
    ],
    "passi": [
      {
        "testo": "Tocca sulla pianta il primo estremo di una misura che conosci: una quota scritta, un muro intero, una porta (di solito 80 cm).",
        "html": "Tocca sulla pianta il primo estremo di una misura che conosci: una quota scritta, un muro intero, una porta (di solito 80 cm)."
      },
      {
        "testo": "Tocca il secondo estremo: compare «✓ Due punti scelti».",
        "html": "Tocca il secondo estremo: compare «✓ Due punti scelti»."
      },
      {
        "testo": "Scrivi nella casella «metri» quanto è lunga (per esempio 12,30).",
        "html": "Scrivi nella casella «metri» quanto è lunga (per esempio 12,30)."
      },
      {
        "testo": "Premi «Riconosci i muri →».",
        "html": "Premi «Riconosci i muri →»."
      }
    ],
    "consigli": [
      "Scegli la misura più lunga che conosci, per esempio un lato intero della casa: l'errore si riduce.",
      "Se alla fine le stanze hanno superfici strane, torna a «Scala» e rifai la misura."
    ]
  },
  "2": {
    "titolo": "Muri",
    "scopo": "La procedura riconosce da sola muri, porte e finestre. Qui controlli il risultato e lo correggi: è il passo che decide quante stanze avrà la casa.",
    "campi": [
      "<b>«Muro dritto»</b>: trascina da un punto all'altro e il muro viene dritto.",
      "<b>«Muro»</b>: trascina per disegnare un muro che divide due stanze unite.",
      "<b>«Gomma»</b>: trascina per cancellare un pezzo di muro sbagliato.",
      "<b>«Porta»</b>: tocca un muro per aprirci una porta (80 cm).",
      "<b>«Finestra»</b>: tocca un muro per aprirci una finestra (120 cm).",
      "La legenda dei colori: muro, porta, finestra, stanza."
    ],
    "passi": [
      {
        "testo": "Guarda la pianta colorata: ogni colore è una stanza.",
        "html": "Guarda la pianta colorata: ogni colore è una stanza."
      },
      {
        "testo": "Se due stanze sono unite, scegli «Muro dritto» e trascina il dito dove passa il muro che manca.",
        "html": "Se due stanze sono unite, scegli «Muro dritto» e trascina il dito dove passa il muro che manca."
      },
      {
        "testo": "Se c'è un muro di troppo, scegli «Gomma» e trascinala sopra.",
        "html": "Se c'è un muro di troppo, scegli «Gomma» e trascinala sopra."
      },
      {
        "testo": "Se manca una porta o una finestra, scegli «Porta» o «Finestra» e tocca il muro.",
        "html": "Se manca una porta o una finestra, scegli «Porta» o «Finestra» e tocca il muro."
      },
      {
        "testo": "Premi «Avanti →».",
        "html": "Premi «Avanti →»."
      }
    ],
    "consigli": [
      "Le strisce sottili ai bordi della pianta sono di solito il margine del foglio: al passo dopo le segni come «fuori casa» con 🌳.",
      "Una porta mancante fra due stanze non le unisce: è solo un buco nel muro."
    ]
  },
  "3": {
    "titolo": "Stanze",
    "scopo": "Dai un nome a ogni stanza. Se in Home Assistant hai le aree, la procedura le propone: così luci e sensori di quell'area finiscono nella stanza giusta.",
    "campi": [
      "Una riga per stanza, con il suo colore, la superficie in m² e i tasti per il nome.",
      "Il tasto 🌳 per dire che è fuori casa: le sue aperture diventano finestre."
    ],
    "passi": [
      {
        "testo": "Per ogni stanza scegli il nome da «— scegli un nome —», oppure scrivilo in «o scrivi un nome».",
        "html": "Per ogni stanza scegli il nome da «— scegli un nome —», oppure scrivilo in «o scrivi un nome»."
      },
      {
        "testo": "Tocca 🌳 sulle stanze che sono fuori: cortile, terrazzo, strisce di margine.",
        "html": "Tocca 🌳 sulle stanze che sono fuori: cortile, terrazzo, strisce di margine."
      },
      {
        "testo": "Controlla le superfici: se sono tutte troppo grandi o piccole, torna alla «Scala».",
        "html": "Controlla le superfici: se sono tutte troppo grandi o piccole, torna alla «Scala»."
      },
      {
        "testo": "Premi «Avanti →».",
        "html": "Premi «Avanti →»."
      }
    ],
    "consigli": [
      "Usa gli stessi nomi delle aree di Home Assistant: ritroverai i dispositivi già al loro posto."
    ]
  },
  "4": {
    "titolo": "Foto stanze",
    "scopo": "Dalle foto la procedura riconosce arredi e dispositivi (divano, letto, punti luce, telecamere, finestre…), con il loro colore e il loro posto. È facoltativo: puoi saltarlo e arredare dopo, in 3D.",
    "campi": [
      "I tasti delle stanze, con il numero di foto già messe.",
      "«Aggiungi foto di …» per ogni stanza.",
      "Per ogni foto: <b>«Verso dove guardavi?»</b>, cioè quale parete si vede di fronte (in alto nella pianta = ↑); gli oggetti riconosciuti, ognuno con ⚡ per collegarlo a un'entità e ✕ per toglierlo.",
      "Se il riconoscimento automatico non è disponibile: «segna tu arredi e dispositivi toccandoli nella foto»."
    ],
    "passi": [
      {
        "testo": "Tocca una stanza.",
        "html": "Tocca una stanza."
      },
      {
        "testo": "Premi «Aggiungi foto di …» e scegli una foto della stanza intera.",
        "html": "Premi «Aggiungi foto di …» e scegli una foto della stanza intera."
      },
      {
        "testo": "Indica «Verso dove guardavi?».",
        "html": "Indica «Verso dove guardavi?»."
      },
      {
        "testo": "Controlla gli oggetti trovati. Per aggiungerne uno: «Scegli cosa e toccalo nella foto».",
        "html": "Controlla gli oggetti trovati. Per aggiungerne uno: «Scegli cosa e toccalo nella foto»."
      },
      {
        "testo": "Sugli oggetti che sono dispositivi (luci, telecamere…) premi ⚡ e scegli l'entità di Home Assistant.",
        "html": "Sugli oggetti che sono dispositivi (luci, telecamere…) premi ⚡ e scegli l'entità di Home Assistant."
      },
      {
        "testo": "Ripeti per le altre stanze, poi premi «Avanti →».",
        "html": "Ripeti per le altre stanze, poi premi «Avanti →»."
      }
    ],
    "consigli": [
      "Una foto dall'angolo della stanza, che prenda due pareti, funziona meglio.",
      "Puoi saltare questo passo: i dispositivi li aggiungi anche al passo dopo, e gli arredi in 3D con «Arreda»."
    ]
  },
  "5": {
    "titolo": "Dispositivi",
    "scopo": "Collega ogni dispositivo della casa 3D alla sua entità di Home Assistant: è quello che fa accendere la luce in 3D quando è accesa davvero, e che permette di comandarla con un tocco.",
    "campi": [
      "«Dispositivi ed entità»: i dispositivi stanza per stanza, con il contatore «collegati · mancanti».",
      "Per ognuno, la tendina dell'entità o la casella «o scrivi l'entità (es. light.salone)».",
      "«Aggiungi un dispositivo»: Punto luce, Telecamera, Tapparella, Sensore finestra, Sensore porta, Sensore movimento, Sensore presenza, Termometro, Climatizzatore, Termostato, Rilevatore fumo, Sensore allagamento, Presa, TV, Altoparlante, Sirena."
    ],
    "passi": [
      {
        "testo": "Per ogni dispositivo già trovato, scegli l'entità dalla tendina.",
        "html": "Per ogni dispositivo già trovato, scegli l'entità dalla tendina."
      },
      {
        "testo": "Per aggiungerne uno: in «Aggiungi un dispositivo» scegli che cos'è e la stanza.",
        "html": "Per aggiungerne uno: in «Aggiungi un dispositivo» scegli che cos'è e la stanza."
      },
      {
        "testo": "Premi «Aggiungi senza foto»: il dispositivo va dove si monta di solito (soffitto, muro, angolo, finestra).",
        "html": "Premi «Aggiungi senza foto»: il dispositivo va dove si monta di solito (soffitto, muro, angolo, finestra)."
      },
      {
        "testo": "Scegli la sua entità.",
        "html": "Scegli la sua entità."
      },
      {
        "testo": "Premi «Avanti →».",
        "html": "Premi «Avanti →»."
      }
    ],
    "consigli": [
      "Il posto esatto non conta adesso: in 3D lo sposti dove vuoi.",
      "Un dispositivo senza entità si vede in 3D, ma non si accende e non si comanda."
    ]
  },
  "6": {
    "titolo": "Esterno",
    "scopo": "Decide come si vede la casa da fuori: villa o palazzo, il tetto e i colori. A sinistra vedi subito l'anteprima.",
    "campi": [
      "«Com'è da fuori»: «🏡 Villa» o «🏢 Palazzo». Per il palazzo si scelgono anche quanti piani ha e a che piano è la tua casa.",
      "«Tetto»: «A falde» o «Piano».",
      "«Foto della facciata»: con una foto, «Scegli cosa, poi toccalo nella foto per prenderne il colore».",
      "«Senza foto scegli i colori qui sotto»: Facciata, Persiane, Tetto."
    ],
    "passi": [
      {
        "testo": "Scegli «🏡 Villa» o «🏢 Palazzo».",
        "html": "Scegli «🏡 Villa» o «🏢 Palazzo»."
      },
      {
        "testo": "Scegli il «Tetto».",
        "html": "Scegli il «Tetto»."
      },
      {
        "testo": "Scegli i colori: dalla foto con «Aggiungi una foto da fuori», oppure toccando i pallini sotto Facciata, Persiane e Tetto.",
        "html": "Scegli i colori: dalla foto con «Aggiungi una foto da fuori», oppure toccando i pallini sotto Facciata, Persiane e Tetto."
      },
      {
        "testo": "Premi «Crea la casa →».",
        "html": "Premi «Crea la casa →»."
      }
    ],
    "consigli": []
  },
  "7": {
    "titolo": "Casa 3D",
    "scopo": "Controlli il riepilogo del piano e decidi: salvare e aprire la casa, aggiungere un altro piano, oppure rifare questo.",
    "campi": [],
    "passi": [
      {
        "testo": "Controlla il riepilogo: se manca qualcosa, torna indietro con «← Indietro».",
        "html": "Controlla il riepilogo: se manca qualcosa, torna indietro con «← Indietro»."
      },
      {
        "testo": "Se la casa ha altri piani, premi «➕ Aggiungi un altro piano» e ripeti i passi per quel piano.",
        "html": "Se la casa ha altri piani, premi «➕ Aggiungi un altro piano» e ripeti i passi per quel piano."
      },
      {
        "testo": "Quando hai finito, premi «🏠 Salva e apri la casa in 3D».",
        "html": "Quando hai finito, premi «🏠 Salva e apri la casa in 3D»."
      }
    ],
    "consigli": [
      "Puoi sempre tornare qui: in 3D c'è «🏗️ Crea / modifica la casa».",
      "In 3D sposti, ruoti e aggiungi quello che manca."
    ]
  }
});
