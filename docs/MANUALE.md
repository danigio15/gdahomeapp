# Manuale d'uso di GdAHome

<p align="center"><img src="immagini/banner.png" alt="GdAHome" width="520"></p>

Questo manuale spiega **passo per passo, con le schermate vere**, come si
installa e come si usa GdAHome: l'add-on in Home Assistant, l'app sul
telefono, la plancia e tutte le sue funzioni.

**Come leggere le schermate.** Su molte immagini ci sono dei **cerchi rossi
numerati** con un riquadro attorno a un elemento. Sotto ogni immagine la
**legenda** spiega cosa sono: ① corrisponde al cerchio 1, ② al 2 e così via.

**Altre convenzioni**
- I nomi tra «virgolette basse» sono le parole scritte sullo schermo.
- La freccia → indica il percorso da seguire, un tocco dopo l'altro.
- **(Premium)** segna le funzioni che richiedono GdAHome Premium
  ([capitolo 16](#16-gdahome-premium-e-licenze)). Tutto il resto è compreso
  nella versione gratuita, **Base**.

> Le schermate vengono da una **casa di prova** con nomi d'esempio («Casa del
> collaudo», «Persona 1», «Faretti soggiorno»…). Nella tua app vedrai i nomi
> della tua casa.

---

## Indice

1. [Cos'è GdAHome](#1-cosè-gdahome)
2. [Cosa serve](#2-cosa-serve)
3. [Installare l'add-on in Home Assistant](#3-installare-ladd-on-in-home-assistant)
4. [Abbinare il telefono alla casa](#4-abbinare-il-telefono-alla-casa)
5. [Il menu dell'app](#5-il-menu-dellapp)
6. [La plancia: usarla tutti i giorni](#6-la-plancia-usarla-tutti-i-giorni)
7. [Configurare la plancia](#7-configurare-la-plancia)
8. [Più plance: a muro, Colpo d'occhio, Casa 3D](#8-più-plance-a-muro-colpo-docchio-casa-3d)
9. [Più case e il collegamento da fuori casa](#9-più-case-e-il-collegamento-da-fuori-casa)
10. [Le notifiche](#10-le-notifiche)
11. [Il riepilogo della sera e «La tua giornata»](#11-il-riepilogo-della-sera-e-la-tua-giornata)
12. [La Salute dall'orologio](#12-la-salute-dallorologio)
13. [Dispositivi, integrazioni, aiutanti e Zigbee](#13-dispositivi-integrazioni-aiutanti-e-zigbee)
14. [Automazioni e Pianificatore](#14-automazioni-e-pianificatore)
15. [In auto e al polso: GdANav, Android Auto, CarPlay, orologi](#15-in-auto-e-al-polso-gdanav-android-auto-carplay-orologi)
16. [GdAHome Premium e licenze](#16-gdahome-premium-e-licenze)
17. [Impostazioni dell'app, lucchetto e diagnostica](#17-impostazioni-dellapp-lucchetto-e-diagnostica)
18. [Aggiornamenti e riavvio della casa](#18-aggiornamenti-e-riavvio-della-casa)
19. [Segnalazioni e assistenza](#19-segnalazioni-e-assistenza)
20. [La pagina «Configura GdAHome» in Home Assistant](#20-la-pagina-configura-gdahome-in-home-assistant)
21. [Le opzioni dell'add-on](#21-le-opzioni-delladd-on)
22. [Se la casa te l'ha montata un installatore](#22-se-la-casa-te-lha-montata-un-installatore)
23. [Per chi installa: il cruscotto](#23-per-chi-installa-il-cruscotto)
24. [Se qualcosa non va](#24-se-qualcosa-non-va)
25. [Domande frequenti](#25-domande-frequenti)
26. [Privacy, contatti e chi c'è dietro](#26-privacy-contatti-e-chi-cè-dietro)

---

## 1. Cos'è GdAHome

GdAHome porta Home Assistant sul telefono in **una pagina sola fatta per essere
guardata**: la **plancia**. In alto ci sono il meteo, l'antifurto e chi è in
casa; sotto ci sono le sezioni (luci, clima, tapparelle, telecamere, consumi,
persone e una trentina di altre), divise per stanza.

GdAHome è fatta di **due pezzi che lavorano insieme**:

| | Pezzo | Cosa fa |
| :-: | --- | --- |
| 🏠 | **L'add-on**, dentro Home Assistant | Contiene la plancia, abbina i telefoni e custodisce il segreto di Home Assistant, che non esce mai da lì. Nella barra laterale di Home Assistant compare come **«Configura GdAHome»**. |
| 📱 | **L'app**, sul telefono | Per Android e iPhone/iPad, e anche dal browser su [webapp.gdahome.org](https://webapp.gdahome.org). Si abbina **inquadrando un QR code**: niente indirizzi, password o token da copiare. |

<p align="center">
  <img src="manuale/img/a-home.jpg" width="230" alt="L'app con la plancia">
  <img src="manuale/img/p-luci.jpg" width="230" alt="La sezione Luci">
  <img src="manuale/img/p-clima.jpg" width="230" alt="La sezione Clima">
</p>
<p align="center"><sub>L'app aperta sulla plancia, la sezione Luci e la sezione Clima.</sub></p>

---

## 2. Cosa serve

**Un Home Assistant con il Supervisor**:

| Home Assistant | GdAHome |
| --- | :-: |
| **OS**: il sistema completo, su Raspberry, mini PC o macchina virtuale | ✅ |
| **Supervised**: Debian con l'installatore ufficiale | ✅ |
| **Container**: solo l'immagine Docker | ❌ nessun add-on, di nessuno |
| **Core**: in un ambiente Python | ❌ idem |

Su Container e Core il negozio degli add-on non esiste: non dipende da
GdAHome. Chi ha Container può passare a Supervised sulla stessa macchina,
perché Docker c'è già.

Servono anche:
- **un telefono o un tablet**, Android o iPhone/iPad, oppure un browser (l'app
  nel browser è compresa in Premium);
- **nessun account**: GdAHome non ne chiede.

> GdAHome è un **add-on**, non un'integrazione: **HACS non lo accetta**. Si
> installa dal negozio degli add-on.

---

## 3. Installare l'add-on in Home Assistant

### 3.1 Aggiungere l'archivio

1. In Home Assistant apri **Impostazioni → Add-on → Negozio degli add-on**.
2. Tocca i **tre puntini** in alto a destra → **Archivi**.
3. Incolla questo indirizzo e premi **Aggiungi**:
   ```
   https://github.com/danigio15/gdahomeapp
   ```
4. Chiudi la finestra.

### 3.2 Installare e avviare

1. Nell'elenco compare la sezione **GdAHome**: apri l'add-on.
2. Premi **Installa**. La prima volta ci vogliono alcuni minuti, **anche dieci
   su un Raspberry**.
3. Premi **Avvia**.
4. Accendi **Mostra nella barra laterale**: comparirà la voce **«Configura
   GdAHome»**.

### 3.3 Il primo controllo

Apri **«Configura GdAHome»** dalla barra laterale. Si apre la sezione
**Casa**:

<p align="center"><img src="manuale/img/console-casa.jpg" width="680" alt="La sezione Casa della pagina dell'add-on"></p>

**Legenda**
- ① **Le schede**: Casa, Telefoni, Plance, Licenza, Avanzate. Su un telefono
  diventano un elenco, e si torna indietro con «‹».
- ② **Lo stato della casa**: «Tutto a posto» quando funziona tutto, «C'è una
  cosa da sistemare» quando c'è un problema. Sotto ci sono le righe dei
  controlli (Home Assistant, Da fuori casa…).
- ③ **«Collega l'app»**: abbina un telefono nuovo (capitolo 4).
- ④ **«I tuoi telefoni»**: i telefoni abbinati.
- ⑤ **«Le plance»**: le plance della casa.
- ⑥ **«Licenza»**: Base o Premium.
- ⑦ **«Avanzate»**: versione, link per il browser, diagnostica.

**Se c'è scritto «Serve riavviare Home Assistant una volta»** (succede la
prima volta):
1. Vai in **Impostazioni → Sistema**.
2. In alto a destra tocca **⏻ → Riavvia Home Assistant**.
3. Entro un minuto dal riavvio la plancia compare da sola fra le Dashboard.

### 3.4 Se avevi l'integrazione DashboardModern

Non serve più: la plancia è già nell'add-on, e **alla prima apertura GdAHome
prende la configurazione che avevi**. Disinstalla l'integrazione da HACS e
togli la sua voce da **Impostazioni → Dashboard**. Se la lasci, quella voce
mostra «Errore di configurazione».

### 3.5 Aggiornare l'add-on

Si aggiorna come ogni altro add-on: **Impostazioni → Add-on → GdAHome →
Aggiorna**. Puoi farlo anche dall'app, dalla pagina
[Aggiornamenti](#18-aggiornamenti-e-riavvio-della-casa).

---

## 4. Abbinare il telefono alla casa

### 4.1 Scaricare l'app

- **Android**: [Google Play](https://play.google.com/store/apps/details?id=com.gdahome.gdahome), cerca «GdAHome».
- **iPhone e iPad**: [App Store](https://apps.apple.com/app/id6816421418).
- **Browser**: [webapp.gdahome.org](https://webapp.gdahome.org) (si abbina scrivendo il codice).

### 4.2 Generare il QR code (in Home Assistant)

1. Apri **«Configura GdAHome»** e premi la tessera blu **«Collega l'app»**.
   Si apre la pagina **«Collega l'app GdAHome»**, con tre passi.

<p align="center"><img src="manuale/img/console-abbina-1.jpg" width="680" alt="Collega l'app: prima di generare"></p>

**Legenda**
- ① **«Per chi è l'app?»**: scegli dall'elenco l'utente di Home Assistant che
  userà il telefono. L'app vedrà **quello che vede quella persona**.
- ② **«Genera il QR code»**: resta grigio finché non hai scelto la persona.
- ③ Qui comparirà il QR code.

2. Scegli la persona in ①.
3. Premi ②, **«Genera il QR code»**.

<p align="center"><img src="manuale/img/console-abbina-2.jpg" width="680" alt="Collega l'app: QR code pronto"></p>

**Legenda**
- ① **L'anteprima**: dice quali plance vedrà il telefono, per esempio «Vedrà
  la plancia «GdAHome».».
- ② **Il QR code** da inquadrare con l'app.
- ③ **Il conto alla rovescia**: «Vale ancora 4:58». Il codice vale **5
  minuti e una volta sola**.
- ④ **«Non riesci a inquadrarlo?»**: mostra i **sedici caratteri** da
  scrivere a mano, in quattro gruppi.
- ⑤ **«Un QR code nuovo»**: se è scaduto, ne crea un altro.
- ⑥ **«Annulla»**: cancella subito il codice.

### 4.3 Inquadrarlo con l'app

<p align="center">
  <img src="manuale/img/a-collega.jpg" width="250" alt="Colleghiamo la casa">
  <img src="manuale/img/a-modulo.jpg" width="250" alt="Il codice scritto a mano">
</p>

**Legenda** (schermata a sinistra)
- ① **«Inquadra il QR code»**: apre la fotocamera.
- ② **«Come si chiama»**: il nome della casa nell'app, per esempio «Casa» o
  «Casa al mare».
- ③ **«Di chi è questo telefono?»**: il tuo nome (facoltativo). Serve a
  riconoscere il telefono fra quelli abbinati.
- ④ **«Non puoi inquadrarlo? Inserisci il codice»**: per scrivere il codice a
  mano.

**Con il QR code**
1. Apri l'app: compare **«Colleghiamo la casa»**.
2. Se vuoi, cambia il nome ② e scrivi il tuo nome ③.
3. Premi ① e consenti l'uso della fotocamera. Al buio c'è il tasto
   **«Torcia»**.
4. Inquadra il QR code sullo schermo di Home Assistant.

Fatto: la plancia si apre. 🔒 **Non ti verrà mai chiesta la password di Home
Assistant.**

**Con il codice a mano** (schermata a destra)
1. Premi ④.
2. In **«Inserisci il codice mostrato»** scrivi i sedici caratteri, un gruppo
   alla volta.
3. Lascia vuoto **«Indirizzo di casa (facoltativo)»**. Scrivilo solo se l'app
   lo chiede: è l'indirizzo di Home Assistant sulla rete di casa, per esempio
   `192.168.1.50`.
4. Premi **«Abbina»**.

### 4.4 Errori possibili

| Messaggio | Cosa fare |
| --- | --- |
| «Non trovo la casa. Controlla che l'add-on sia acceso, e che il codice non sia scaduto…» | Controlla che l'add-on sia avviato e genera un QR nuovo. |
| «Non trovo GdAHome a quell'indirizzo…» | Collegati al Wi-Fi di casa e controlla l'indirizzo. |
| «GdAHome non ha il permesso di usare la fotocamera…» | Consenti la fotocamera nelle impostazioni del telefono, oppure usa il codice a mano. |
| «L'accesso remoto di Home Assistant non arriva agli add-on…» | Collegati al Wi-Fi di casa e scrivi l'indirizzo locale. |

### 4.5 Da sapere

- Ogni telefono ha **il suo abbinamento** e si toglie con un tasto (capitolo
  20).
- Un telefono vede **le plance della persona** per cui è stato abbinato.
- Con **Base** si abbinano **fino a 2 telefoni**; con **Premium**, quanti ne
  vuoi.
- Se avevi abbinato il telefono prima che esistesse il nome del proprietario,
  l'app te lo chiede una volta, con il foglio **«Di chi è questo
  telefono?»**: scrivi il nome e premi **«Salva»**, oppure **«Più tardi»**.

---

## 5. Il menu dell'app

### 5.1 Aprire e chiudere il menu

Il menu si apre in tre modi:
- toccando i **tre trattini** in alto a sinistra della plancia;
- toccando **☰** in alto a sinistra nelle altre pagine;
- premendo **Indietro** su Android. Con il menu aperto, un altro Indietro
  esce dall'app.

Il menu si chiude toccando una voce, trascinandolo verso sinistra, oppure da
solo dopo qualche secondo.

<p align="center">
  <img src="manuale/img/a-menu.jpg" width="250" alt="Il menu">
  <img src="manuale/img/a-plance.jpg" width="250" alt="Il selettore delle plance">
  <img src="manuale/img/a-menu-lucchetti.jpg" width="250" alt="Il menu completo con i lucchetti">
</p>

**Legenda** (prima schermata)
- ① **Il nome della casa**, e sotto come sei collegato: «in casa» (verde) o
  «da fuori».
- ② **⇄ Le tue case**: per passare a un'altra casa o aggiungerne una
  (capitolo 9).
- ③ **«Cerca una sezione»**: scrivi un nome per trovare subito la voce.
- ④ **«Plancia»**: torna alla plancia.
- ⑤ **⇕ Quale plancia**: tocca qui per cambiare plancia. L'elenco «PLANCE
  DI QUESTA CASA» è nella seconda schermata; le plance con il lucchetto
  richiedono Premium.
- ⑥ **Una voce Premium**: con Premium ha il bollino «✨ PREMIUM», con Base un
  lucchetto.

La terza schermata è il menu completo **sul telefono**. Alcune voci ci sono
solo nell'app e non nel browser: GdANav, Notifiche, Salute, Zigbee e
Impostazioni app.

### 5.2 Tutte le voci

**Gruppo «Casa»**

| Voce | A cosa serve | Note |
| --- | --- | --- |
| Plancia | Torna alla plancia | |
| Dispositivi | Dispositivi stanza per stanza e integrazioni | Premium, solo amministratori |
| GdANav | Il navigatore | Solo app |
| Configurazione plancia | Cambia la plancia dal telefono | Premium |
| Aggiornamenti | Aggiornamenti di Home Assistant, degli add-on e dei firmware; riavvio | Il numero indica quanti sono in attesa |
| Notifiche | Cosa ricevere su questo telefono | Solo app |
| Salute | Le misure dell'orologio inviate alla casa | Solo app, Premium |

**Gruppo «Avanzate»**

| Voce | A cosa serve | Note |
| --- | --- | --- |
| Automazioni | Automazioni e Pianificatore | Premium, solo amministratori |
| Aiutanti | Interruttori, numeri, timer, sensori calcolati | Premium, solo amministratori |
| Zigbee | Abbinare dispositivi Zigbee | Solo app, Premium, solo con ZHA o Zigbee2MQTT |
| Gestione installatore | Il cruscotto di chi installa | Solo sugli impianti degli installatori |

**Gruppo «Aiuto»**

| Voce | A cosa serve |
| --- | --- |
| Impostazioni app | Plancia leggera e lucchetto con volto o impronta |
| Diagnostica app | Come sta andando l'app |
| Segnalazioni | Un problema, un'idea o una domanda |
| Assistenza | Chat privata con chi fa l'app |
| GdAHome Premium | Abbonamento, prova gratuita, codice regalo |

---

## 6. La plancia: usarla tutti i giorni

### 6.1 Com'è fatta

<p align="center">
  <img src="manuale/img/p-home.jpg" width="260" alt="La Home della plancia">
  <img src="manuale/img/p-stanze.jpg" width="260" alt="Le stanze">
</p>

**Legenda**
- ① **Il menu della plancia** (tre trattini). Nell'app apre il menu
  dell'app.
- ② **La testata**: nome della casa, meteo, ora, stato del collegamento.

In fondo allo schermo c'è la **barra delle sezioni**: scorrila e tocca una
sezione per aprirla. In ogni sezione, **«← HOME»** in alto riporta alla Home.

Nella Home trovi, dall'alto in basso:
- i blocchi di riepilogo: rifiuti di domani, antifurto, avvisi;
- **Persone**: chi è in casa e chi è fuori, con batteria e posizione;
- **Assistente di casa**: le cose da fare, per esempio una batteria scarica;
- **Widget**: i riquadri con i numeri della casa (luci accese, clima,
  aggiornamenti…).

La seconda schermata è la sezione **Stanze**: ogni stanza mostra quante luci
sono accese, la temperatura e cosa c'è dentro. Toccala per aprirla.

### 6.2 Come si comanda

- **Un tocco** su una luce la accende o la spegne. **Trascinando la barra**
  sotto la luce ne cambi la luminosità.
- **Un tocco** su una tapparella, un termostato o una telecamera apre i suoi
  comandi o il video dal vivo.
- I tasti come **«Accendi tutte» / «Spegni tutte»** agiscono su tutta la
  sezione.
- **Porte e cancelli** si aprono dalla sezione «Apri porte» e, se l'hai
  impostato, chiedono il **PIN**.

<p align="center">
  <img src="manuale/img/p-sicurezza.jpg" width="230" alt="Sicurezza">
  <img src="manuale/img/p-finestre.jpg" width="230" alt="Finestre">
  <img src="manuale/img/p-energia.jpg" width="230" alt="Energia">
</p>
<p align="center"><sub>Sicurezza (antifurto con i modi Casa, Fuori, Notte…), Finestre (tapparelle con Apri, Stop, Chiudi) ed Energia (il flusso fra sole, rete, batteria e casa).</sub></p>

<p align="center">
  <img src="manuale/img/p-porte.jpg" width="230" alt="Apri porte e cancelli">
  <img src="manuale/img/p-elettrodomestici.jpg" width="230" alt="Elettrodomestici">
  <img src="manuale/img/p-auto.jpg" width="230" alt="Auto elettrica">
</p>
<p align="center"><sub>Apri porte e cancelli («Apri», «Blocca», «Sblocca»), Elettrodomestici (cicli e consumi) e Auto (batteria, autonomia, ricarica).</sub></p>

<p align="center">
  <img src="manuale/img/p-meteo.jpg" width="230" alt="Meteo">
  <img src="manuale/img/p-presenza.jpg" width="230" alt="Presenza">
  <img src="manuale/img/p-salute.jpg" width="230" alt="Salute">
</p>
<p align="center"><sub>Meteo, Presenza (stanze libere e ultimi passaggi) e Salute (le misure dell'orologio, capitolo 12).</sub></p>

### 6.3 Le sezioni della plancia

Le sezioni si accendono e si spengono dalla Configurazione (capitolo 7). Una
sezione senza contenuto non compare nella barra.

| Sezione | Cosa contiene |
| --- | --- |
| 🏠 Home | Il riepilogo della casa e i widget |
| ⚡ Energia | Fotovoltaico, rete, accumulo, consumi, tariffe, report |
| 🚗 Auto | Auto elettrica, colonnina, evcc, ricarica di notte |
| 🧭 GdANav | Viaggi pianificati, che ritrovi nel navigatore |
| 🌞 Gestione termica | Solare termico, scaldabagno, caldaia, pellet |
| 🛡️ Sicurezza | Antifurto, telecamere, sensori di fumo e gas |
| 🖥️ MiniPC (Server e rete) | Server, container, rete |
| 🌡️ Temperatura | Le temperature delle stanze |
| 🌦️ Meteo | Condizioni, previsioni, radar |
| ⚽ Sport | Squadra del cuore, Formula 1, MotoGP |
| ❤️ Salute | Le misure dall'orologio |
| ❄️ Clima | Termostati, condizionatori, VMC |
| 🪟 Finestre | Tapparelle e finestre |
| 🏊 Piscina · 💧 Irrigazione · 🪴 Piante | |
| 🧺 Elettrodomestici | Lavatrice, lavastoviglie e altri, con cicli e costi |
| 🤖 Robot | Aspirapolvere robot |
| 🐾 Animali | Anche acquari e terrari |
| 💡 Luci · 🔌 Prese · 🛋️ Stanze | |
| 📅 Agenda · 🗑️ Rifiuti · ⛈️ Allerte | |
| 🔌 UPS | Gruppi di continuità |
| 🚪 Varchi · 🏃 Presenza | Porte e finestre aperte, movimento |
| 🔓 Apri porte | Porte e cancelli, con PIN |
| 📮 Citofono | Campanello e posta |
| 🎵 Musica | Lettori, radio, Alexa |
| 🔋 Batterie | Le batterie dei dispositivi |
| 🖨️ Stampanti · 💧 Acqua e gas | |
| ⭐ Le tue sezioni | Sezioni create da te |

---

## 7. Configurare la plancia

**(Premium dall'app; dal browser è sempre disponibile all'amministratore.)**

### 7.1 Aprire la Configurazione

- Dall'app: menu → **«Configurazione plancia»**.
- Dalla plancia: la voce **CONFIG** in fondo alla barra delle sezioni.

La Configurazione si apre solo all'utente indicato come «Utente admin».

<p align="center"><img src="manuale/img/p-config.jpg" width="270" alt="La pagina Configurazione"></p>

**Legenda**
- ① **«Configura Entità»**: l'editor completo della plancia. Qui si sceglie
  cosa va in ogni sezione.
- ② **«Tema»**: Chiaro, Scuro, Auto e le tavolozze (Notte blu, Grafite,
  Bosco…). Vale solo per questo dispositivo.
- ③ **«Barra di navigazione»**: «A scomparsa» o «Fissa». Vale solo per questo
  dispositivo.
- ④ **«Segnalazioni»**: per segnalare un problema senza uscire dalla plancia.

### 7.2 L'editor: come è organizzato

Tocca ① **«Configura Entità»**: si apre l'**EDITOR DASHBOARD**.

<p align="center">
  <img src="manuale/img/p-cfg-editor.jpg" width="260" alt="L'editor, scheda Impostazioni">
  <img src="manuale/img/p-cfg-sezioni.jpg" width="260" alt="L'elenco delle sezioni">
</p>

**Legenda** (schermata a sinistra)
- ① **Le famiglie**: Plancia, Energia, Clima e acqua, Casa, Sicurezza, Avvisi,
  Alexa, Macchine e rete, oppure «Tutte». Toccane una per vedere solo le sue
  schede.
- ② **Le schede**: la colonna di icone a sinistra. Ogni icona è una scheda
  (Impostazioni, Home, Luci, Clima…). In cima c'è la casella «Cerca in tutta
  la configurazione».
- ③ **«💾 Salva generali»**: salva il nome della plancia e l'utente
  amministratore.

**Legenda** (schermata a destra: «Le sezioni della plancia», più in basso
nella scheda Impostazioni)
- ① **L'interruttore** verde: accende o spegne la sezione nella plancia.
- ② **«Configura»**: apre la scheda di quella sezione.

### 7.3 Mettere un dispositivo in una sezione (esempio: una luce)

<p align="center">
  <img src="manuale/img/p-cfg-luci.jpg" width="250" alt="Scheda Luci">
  <img src="manuale/img/p-cfg-stanze.jpg" width="250" alt="Scheda Stanze">
  <img src="manuale/img/p-cfg-azioni.jpg" width="250" alt="Scheda Azioni rapide">
</p>

1. Nell'editor apri la scheda **Luci** (famiglia Casa).
2. Nella riga di una luce scegli quale entità di Home Assistant mostrare.
3. Dalla tendina della riga scegli la **stanza** (per esempio «Soggiorno»).
4. Per aggiungere un'altra luce usa il tasto **+**; per toglierla, il
   cestino.
5. Premi **Salva** in fondo alla scheda.

Se lasci la scheda senza salvare, compare **«Ricordati di salvare»** con tre
scelte: salvare, uscire senza salvare, restare.

**Le altre schede che si usano di più:**
- **Stanze** (al centro): l'anteprima e l'ordine delle stanze. Le stanze
  vengono dalle aree di Home Assistant e si riordinano trascinandole.
- **Azioni** (a destra): i tasti rapidi della Home, per esempio «Esco», che
  spegne tutto. Sono anche i comandi proposti in auto e sull'orologio.

### 7.4 Le tue sezioni, le persone, gli annunci

<p align="center">
  <img src="manuale/img/p-cfg-tuesezioni.jpg" width="250" alt="Le tue sezioni">
  <img src="manuale/img/p-cfg-persone.jpg" width="250" alt="Persone">
  <img src="manuale/img/p-cfg-notifiche.jpg" width="250" alt="Notifiche su Echo">
</p>

- **Le tue sezioni** (a sinistra): crea una sezione nuova con titolo e icona e
  mettici le entità che vuoi (nell'esempio, «Acquario»). La sezione compare
  nella barra.
- **Le tue entità**: aggiunge entità in fondo a una sezione esistente.
- **Persone** (al centro): le persone della Home. Usa **«+ Aggiungi
  persona»** oppure **«Importa da Home Assistant»**.
- **Notifiche** (a destra, famiglia Alexa): fa dire le notifiche dagli
  altoparlanti Echo, se in Home Assistant c'è l'integrazione Alexa.

### 7.5 Backup e ripristino della plancia

<p align="center"><img src="manuale/img/p-cfg-backup.jpg" width="250" alt="Backup"></p>

1. Apri la scheda **Backup**.
2. **«Scarica il file»** salva tutta la configurazione in un file JSON;
   **«Copia negli appunti»** la copia come testo.
3. Per ripristinare: **«Scegli il file»** (oppure incolla il testo) e
   conferma. Il ripristino **non cancella** quello che nel file non c'è.

---

## 8. Più plance: a muro, Colpo d'occhio, Casa 3D

Con **Base** c'è una plancia, la principale. Con **Premium** puoi averne
**fino a 30 per casa**, per esempio una per la famiglia, una per il tablet in
cucina e una per l'ufficio.

### 8.1 Creare una plancia

Le plance si creano dalla pagina dell'add-on in Home Assistant:
**«Configura GdAHome» → Plance**.

<p align="center"><img src="manuale/img/console-plance.jpg" width="680" alt="Le plance"></p>

**Legenda**
- ① **«Aggiungi una plancia»**: apre il modulo per una plancia nuova.
- ② **«Apri»**: apre la plancia in Home Assistant.
- ③ **«Gestisci»**: chi la vede, rinomina, togli.

<p align="center"><img src="manuale/img/console-plance-nuova.jpg" width="680" alt="Una plancia nuova"></p>

**Legenda**
- ① **«Nome»**: fino a 40 caratteri, per esempio «Casa al mare».
- ② **«Tipo»**:
  - **📟 A muro**: per tablet a muro e NSPanel. Comandi grandi, una
    schermata sola. Nasce già pronta, con le stanze e le scene della
    principale.
  - **👁️ Colpo d'occhio**: una pagina sola con il meteo e riquadri grandi.
  - **🧊 Casa 3D**: la casa in tre dimensioni.
  - **🏠 Classica**: una plancia completa, da preparare da zero.
- ③ **«Chi la vede»**: spunta gli utenti che possono vederla. **Nessuna
  spunta = la vedono tutti.** Per un tablet a muro, spunta l'utente con cui è
  entrato il tablet.
- ④ **«Aggiungi la plancia»**: crea la plancia.

Nell'app la nuova plancia compare nel **selettore delle plance** del menu (⇕,
capitolo 5).

### 8.2 Chi vede una plancia

Premi **Gestisci** accanto alla plancia:

<p align="center"><img src="manuale/img/console-plance-gestisci.jpg" width="680" alt="Gestisci una plancia"></p>

**Legenda**
- ① **«Chi la vede»**: la frase dice chi la vede adesso.
- ② **«Solo gli amministratori della casa»**: la riserva agli amministratori.
  Sotto, **«e anche, solo questi utenti»** permette di spuntare singole
  persone. Le scelte si salvano subito.
- ③ **«Rinomina»**. Per le plance aggiunte c'è anche **«Togli la
  plancia»**, che cancella anche sezioni e stanze e non si può annullare.

Chi non vede nessuna plancia legge nell'app «Non hai plance associate alla
tua utenza».

### 8.3 La plancia a muro (Premium)

Trasforma un tablet fisso o un **Sonoff NSPanel** in un pannello con comandi
grandi, **fino a 8 pagine**.

<p align="center"><img src="manuale/img/p-cfg-muro.jpg" width="260" alt="Scheda A muro"></p>

1. Apri la plancia del tablet e vai in **Configurazione → Configura Entità →
   scheda «A muro»**.
2. Accendi **«Usa questa plancia a muro»**.
3. In **«Prende le cose da»** scegli se usare stanze, luci, clima e antifurto
   di questa plancia o della **principale**.
4. In **«Le pagine di questo tablet»** premi **«+ Aggiungi una pagina»** e
   scegli il tipo: Stanza, Scene, Ingresso, Personalizzata, Tutte le luci,
   Clima, Tutte le tapparelle, Ambienti, Telecamere, Energia, Musica, Meteo,
   Mixer audio…
5. Per ogni pagina scegli quanti riquadri: da 4 a 24 (di serie 6).
6. In **«Altre impostazioni»** regola orientamento, tema, riposo, notte
   (schermo nero), luminosità, chi c'è vicino (sensore di presenza) e il **PIN
   per uscire** dal pannello.
7. Premi **«Salva»**. Finché non salvi, il tablet non vede le modifiche.

Sul tablet si passa da una pagina all'altra con le linguette o facendo
scorrere il dito. Dopo qualche minuto senza tocchi resta l'orologio.

### 8.4 Colpo d'occhio (Premium)

Una pagina sola: nome della casa e ora, meteo, e i riquadri grandi
**Fotovoltaico**, **Telecamere**, **Antifurto** e **Cancello**. Si accende
in Configurazione → scheda **«Colpo d'occhio»** → **«Accesa: questa plancia
si apre a colpo d'occhio»**.

### 8.5 Casa 3D (Premium)

1. Crea una plancia di tipo **🧊 Casa 3D** e aprila.
2. Premi **«Crea la tua casa»** e segui gli **8 passi**:
   1. **Planimetria**: una foto anche storta, un PDF, un DWG, le misure a mano
      o le foto delle stanze.
   2. **Scala**: segna due punti di cui conosci la distanza.
   3. **Muri**: riconosciuti da soli; li ritocchi con muro, gomma, porta,
      finestra.
   4. **Stanze**: i nomi dalle aree di Home Assistant o scritti da te.
   5. **Foto delle stanze**: arredi e dispositivi riconosciuti.
   6. **Dispositivi**: collega ogni oggetto alla sua entità.
   7. **Esterno**: villa o palazzo, tetto, colori.
   8. **Casa 3D**: salva e apri, oppure aggiungi un piano.

Nella casa 3D un tocco accende le luci, muove le tapparelle o apre le
telecamere. Le foto restano sul dispositivo da cui le carichi.

> Con Base la plancia a muro resta una plancia normale, e Colpo d'occhio e
> Casa 3D mostrano un avviso. **La configurazione resta salvata.**

---

## 9. Più case e il collegamento da fuori casa

### 9.1 Le tue case (Premium: fino a 10)

Apri il menu e tocca **⇄** (② nella prima schermata del capitolo 5).

<p align="center">
  <img src="manuale/img/a-le-case.jpg" width="250" alt="Le tue case">
  <img src="manuale/img/a-case-lucchetto.jpg" width="250" alt="Aggiungere una casa con Base">
</p>

- **Passare a un'altra casa**: tocca il suo nome. Sotto il nome c'è da dove
  la raggiungi: «in casa adesso», «da fuori adesso», «solo sotto il Wi-Fi di
  casa».
- **Aggiungere una casa**: premi **«Aggiungi»** e ripeti l'abbinamento
  (capitolo 4) sull'Home Assistant dell'altra casa. Con Base il tasto ha il
  lucchetto (schermata a destra).
- **Togliere una casa dal telefono**: tocca il **cestino** e conferma con
  **«Elimina»**. Per toglierla anche dalla parte della casa: «Configura
  GdAHome» → Telefoni → ⋯ → «Togli da questa casa».

### 9.2 Da fuori casa (Premium)

Sul Wi-Fi di casa l'app parla direttamente con l'add-on. **Con Premium** la
casa si raggiunge da qualunque posto:
- **senza aprire porte sul router**, senza VPN e senza indirizzo pubblico;
- **cifrato da un capo all'altro**;
- **in automatico**: appena esci di casa l'app cambia strada da sola.

L'opzione dell'add-on **«Da fuori casa»** deve essere accesa (lo è di serie).

<p align="center">
  <img src="immagini/fuori-casa-serve-premium.png" width="230" alt="Fuori casa serve Premium">
  <img src="manuale/img/a-riconnessione.jpg" width="230" alt="Riconnessione">
</p>
<p align="center"><sub>A sinistra: con Base, fuori dal Wi-Fi di casa. A destra: mentre l'add-on si aggiorna o Home Assistant si riavvia, l'app riprova da sola.</sub></p>

### 9.3 L'app dal browser (Premium)

Apri [webapp.gdahome.org](https://webapp.gdahome.org) e abbinala con il
**codice a mano** (paragrafo 4.3). L'indirizzo esatto lo trovi anche in
«Configura GdAHome» → Avanzate → «GdAHome nel browser».

---

## 10. Le notifiche

La casa ti avvisa **anche ad app chiusa**: l'antifurto che scatta, il
campanello, la lavatrice che ha finito.
- **Le regole stanno nell'add-on**: è la casa a guardare i sensori e a
  decidere quando scriverti.
- **Sul telefono scegli quali** notifiche ricevere.
- Le notifiche partono **già cifrate** con la chiave del tuo telefono: né il
  centralino, né Google, né Apple le possono leggere.

> **Con Base** arrivano solo gli **avvisi di sicurezza**: fumo, gas,
> allagamento, antifurto scattato e campanello. **Tutto il resto è
> Premium**, e nella pagina è segnato con un lucchetto.

### 10.1 Attivarle

1. La prima volta che entri in una casa compare **«Le notifiche di casa»**:
   premi **«Attiva»** e consenti le notifiche al telefono. Se avevi scelto
   «Non ora», le attivi dalla pagina Notifiche.
2. Apri menu → **«Notifiche»**.

<p align="center"><img src="manuale/img/a-notifiche-1.jpg" width="280" alt="La pagina Notifiche"></p>

**Legenda**
- ① **Per quale casa**: ogni casa ha le sue notifiche. Tocca il nome della
  casa per cui stai scegliendo.
- ② **«Notifiche di GdAHome»**: l'interruttore principale. Sotto devono
  comparire **«Attive su questo iPhone»** (o telefono) e **«Cifrate»**.
- ③ **«Come le vuoi»**:
  - **«Semplici»**: solo testo (di serie);
  - **«Elaborate»** (Premium): con il grafico e le foto delle telecamere.
- ④ **L'avviso di Base**: con Base arrivano solo gli avvisi di sicurezza.

3. Accendi ②.
4. In fondo alla pagina premi **«Manda una notifica di prova»**. Se leggi
   «Partita: arriva fra qualche secondo», funziona.

**Requisiti:**
- l'opzione dell'add-on **«Da fuori casa»** deve essere accesa, perché le
  notifiche passano dal centralino;
- il telefono deve essere abbinato a un utente di Home Assistant.

Se manca qualcosa, la pagina lo dice con una scheda gialla e spiega cosa
fare.

### 10.2 Cosa puoi ricevere

Scorri la pagina: ogni voce ha un interruttore, e di serie sono tutte
accese.

<p align="center">
  <img src="manuale/img/a-notifiche-2.jpg" width="230" alt="Urgenti e Sicurezza">
  <img src="manuale/img/a-notifiche-3.jpg" width="230" alt="Casa, Persone, Assistente">
  <img src="manuale/img/a-notifiche-4.jpg" width="230" alt="Personalizzate e Quando">
</p>

| Categoria | Voce | Quando arriva |
| --- | --- | --- |
| **Urgenti** (suonano anche in silenzioso) | Antifurto scattato | Subito, con la zona |
| | Allagamento, fumo, gas | Dal primo sensore che se ne accorge |
| | Campanello | Con la foto della porta e «Apri cancello» |
| | Manca la corrente | Dagli UPS: autonomia, e quando torna |
| **Sicurezza** | Antifurto inserito o disinserito | Totale, notte, parziale, vacanza |
| | Uscito senza antifurto | L'ultimo esce e l'antifurto è spento |
| | Porta o garage aperti | Di notte, o con la casa vuota |
| | Movimento davanti alle telecamere | Con la foto, a casa vuota o di notte |
| **Casa** | Elettrodomestico finito | Durata, kWh e costo |
| | Freezer e frigo | Troppo caldi, o porta aperta |
| | Pioggia con finestre aperte | Mezz'ora prima |
| | La pappa degli animali | Quando è ora |
| **Persone** | Arrivi e uscite | Solo per le persone che scegli |
| **Assistente di casa** | Suggerimenti | Luci o clima accesi con la casa vuota, ecc. |
| **Manutenzione** | Riepilogo serale | Ogni sera all'ora scelta |
| **Viaggi** | Quando partire | I viaggi pianificati in GdANav |

In fondo alla pagina (terza schermata) trovi:
- le **«Notifiche personalizzate»** (paragrafo 10.5);
- la scheda **«Quando»**, con:
  - **«Ore di silenzio»**: accese di serie, dalle 23:00 alle 07:00. Tocca gli
    orari per cambiarli. **Le urgenti passano comunque.**
  - **«Solo quando sono fuori casa»**: quando sei in casa, le notifiche di
    «Casa» e «Assistente» restano zitte.

### 10.3 Regolare una singola notifica

**Tocca il nome di una voce** (non l'interruttore): si apre il suo foglio.
Le scelte valgono **solo per quella notifica, su questo telefono**, e si
salvano subito.

<p align="center">
  <img src="manuale/img/a-notifica-foglio.jpg" width="230" alt="Foglio di una notifica">
  <img src="manuale/img/a-notifica-quali.jpg" width="230" alt="Quali telecamere">
  <img src="manuale/img/a-notifica-video.jpg" width="230" alt="Mini video">
</p>

| Scelta | Cosa fa |
| --- | --- |
| **Stile** | Come tutte, Semplice oppure Elaborata |
| **Quali** | Quali elettrodomestici, UPS o telecamere seguire. Si apre un elenco con «Cerca», le spunte e «Fatto» (seconda schermata) |
| **Quando** (Movimento) | «Casa vuota o notte» (di serie), «Casa vuota», «Di notte», «Sempre» |
| **Video** (Movimento, Premium) | «Mini video del movimento»: 5 secondi prima e 5 dopo (terza schermata) |
| **Solo se** | Per esempio «Solo se il ciclo costa più di … €» |
| **Suono** | «Muta», «Normale», «Il suo suono» |
| **Orari** | «Sempre» oppure «Solo in queste ore» |
| **Come** | «Subito» oppure «Nel riepilogo della sera» (Premium) |

**«Prova: mandamela adesso»** ti manda subito un esempio.

> Le notifiche **urgenti** non si possono silenziare: arrivano sempre e
> subito.

### 10.4 Com'è una notifica, e cosa fare quando arriva

<p align="center">
  <img src="manuale/img/a-n-antifurto.jpg" width="200" alt="Antifurto">
  <img src="manuale/img/a-n-lavatrice.jpg" width="200" alt="Lavatrice">
  <img src="manuale/img/a-n-movimento.jpg" width="200" alt="Movimento">
  <img src="manuale/img/a-n-campanello.jpg" width="200" alt="Campanello">
</p>
<p align="center"><sub>Quattro notifiche aperte nell'app: antifurto inserito, lavatrice finita (con il costo e la parte presa dal sole), movimento davanti a una telecamera, campanello a tutto schermo.</sub></p>

**Toccando la notifica** si apre la pagina giusta: Sicurezza, la telecamera,
Elettrodomestici, Energia, Persone, Meteo, «La tua giornata» o GdANav.

**I tasti nelle notifiche** (valgono 2 ore):

| Notifica | Tasti |
| --- | --- |
| Antifurto scattato | «Spegni sirena», «Disinserisci», «Guarda» |
| Campanello | «Apri cancello» / «Apri», «Ignora» |
| Uscito senza antifurto | «Inserisci», «Più tardi» |
| Porta o garage aperti | «Chiudi», «Va bene così», «Più tardi» |
| Movimento | «Guarda», «Inserisci antifurto» |
| Luci con casa vuota | «Spegni», «Restano così», «Più tardi» |
| Riepilogo serale | «Apri la giornata», «OK» |

- **«Va bene così»** zittisce quel suggerimento per 12 ore.
- **«Più tardi»** lo rimanda di un'ora.
- Con il lucchetto dell'app acceso, i tasti chiedono prima volto o impronta.

**Il campanello** si presenta a tutto schermo, come una telefonata, con la
foto dal vivo della porta e i tasti **«Ignora»** e **«Apri»**. «Apri» chiede
prima di sbloccare il telefono. Resta valido per 60 secondi.

<p align="center">
  <img src="manuale/img/a-n-telecamera.jpg" width="200" alt="Telecamera">
  <img src="manuale/img/a-n-video.jpg" width="200" alt="Mini video">
  <img src="manuale/img/a-n-luci.jpg" width="200" alt="Assistente: luci">
  <img src="manuale/img/a-n-garage.jpg" width="200" alt="Assistente: garage">
</p>
<p align="center"><sub>Da una notifica di movimento: la foto del momento, «Guarda dal vivo» e il mini video. A destra due suggerimenti dell'assistente («Nessuno in casa da 1 h» con «Spegni le 2 luci», e il garage aperto con «Chiudi»).</sub></p>

### 10.5 Notifiche personalizzate (Premium)

Sono regole tue, per esempio «quando il freezer va sopra i -12 °C per 10
minuti, avvisami».

1. Notifiche → **«Notifiche personalizzate»** → **«Aggiungi»**.

<p align="center">
  <img src="manuale/img/a-editor-1.jpg" width="270" alt="Nuova notifica">
  <img src="manuale/img/a-editor-2.jpg" width="270" alt="Nuova notifica, seconda parte">
</p>

**Legenda** (schermata a sinistra)
- ① **I tre passi**: Entità → Condizione → Messaggio.
- ② **L'entità** da controllare: toccala e cerca il sensore.
- ③ **La condizione e il valore**: «sopra», «sotto», «uguale a» o «diverso
  da», e il valore (per esempio -12 °C).
- ④ **Per quanto tempo**: subito, 1, 5, 10, 15, 30 minuti o 1 ora.
- ⑤ **Il valore di adesso** («tutto a posto» o «scatterebbe») e il
  **grafico delle ultime 24 ore**, con la soglia tratteggiata.
- ⑥ **«Titolo»** del messaggio (obbligatorio).
- ⑦ **«Prova adesso»**: la ricevi subito, solo tu.
- ⑧ **«Salva»**.

2. Compila ②, ③ e ④.
3. Scrivi il **Titolo** ⑥ e, se vuoi, il testo «Sotto il titolo».
4. Nella seconda parte (a destra) scegli:
   - **«Urgenza»**: «Bassa», «Normale» oppure «Urgente» (passa anche in
     silenzioso);
   - **«Chi la riceve»**: di serie solo tu; un amministratore può scegliere
     altre persone;
   - **«Non ripetere per»**: al massimo una volta ogni 15 min, 30 min, 1 h,
     3 h, 12 h o 24 h.
5. Premi **⑦ «Prova adesso»** per vedere com'è, poi **⑧ «Salva»**.

Ogni casa può avere fino a 40 notifiche personalizzate. Per toglierne una:
aprila → **«Togli questa notifica»**.

### 10.6 Le notifiche che già mandi con Home Assistant (Premium)

Se hai automazioni di Home Assistant che mandano notifiche alla sua app,
GdAHome le trova e le elenca nella scheda **«Da Home Assistant»**.

<p align="center">
  <img src="manuale/img/a-da-ha-1.jpg" width="230" alt="Da Home Assistant">
  <img src="manuale/img/a-da-ha-foglio.jpg" width="230" alt="Una automazione di Home Assistant">
</p>

1. Premi **«Accendi quelle di questo telefono»**, oppure tocca una singola
   automazione (seconda schermata).
2. Scegli **«Chi la riceve»** e se deve **«Rispetta le ore di silenzio»**.
3. Premi **«Ricevila anche in GdAHome»**.

Arrivano nello stesso momento e con lo stesso testo, ma cifrate. L'app di
Home Assistant continua a riceverle: se non le vuoi doppie, spegnile lì.

---

## 11. Il riepilogo della sera e «La tua giornata»

### 11.1 Il riepilogo serale (Premium)

Ogni sera, all'ora che scegli (di serie **20:30**), arriva **una notifica
sola** con la giornata della casa: energia dal sole, soldi spesi e
risparmiati, chi ha consumato di più, un consiglio per domani e le cose da
sistemare.

<p align="center"><img src="manuale/img/a-scheda-giornata.jpg" width="420" alt="La scheda del riepilogo"></p>

**Per cambiare l'ora:** Notifiche → Manutenzione → **«Riepilogo serale»** →
tocca l'orario **«Ogni sera alle»**.

### 11.2 La pagina «La tua giornata» (Premium)

Si apre toccando il riepilogo serale (o **«Apri la giornata»**), oppure da
Notifiche → Manutenzione → **«La tua giornata»**. Per aggiornarla, tira la
pagina verso il basso.

<p align="center">
  <img src="manuale/img/a-giornata-1.jpg" width="180" alt="La tua giornata 1">
  <img src="manuale/img/a-giornata-2.jpg" width="180" alt="La tua giornata 2">
  <img src="manuale/img/a-giornata-3.jpg" width="180" alt="La tua giornata 3">
  <img src="manuale/img/a-giornata-4.jpg" width="180" alt="La tua giornata 4">
</p>
<p align="center"><sub>La pagina intera, dall'alto in basso.</sub></p>

| Sezione | Cosa racconta |
| --- | --- |
| In breve | Tre o quattro fatti della giornata |
| Energia | Ora per ora, chi ha consumato di più, i soldi, la batteria di casa |
| Clima di casa | Temperature per stanza, quanto è stato acceso il riscaldamento |
| Acqua calda | Il solare termico e quanto ha fatto risparmiare |
| Auto e consumi | Ricariche, chilometri, acqua e gas |
| La casa | Porte aperte, automazioni eseguite, avvisi |
| Rispetto a | Ieri, la settimana, il mese |
| Domani | Il meteo e le ore di sole |
| Da sistemare | Le cose che chiedono attenzione |

---

## 12. La Salute dall'orologio

**(Premium, solo nell'app sul telefono.)** Passi, battito, pressione, peso,
sonno e le altre misure dell'orologio arrivano a casa e diventano sensori di
Home Assistant. Funziona con:
- **Apple Salute**: iPhone e Apple Watch;
- **Health Connect** su Android: Galaxy Watch, Pixel Watch, Fitbit, Amazfit e
  gli altri. Serve Android 8 o successivo.

<p align="center">
  <img src="manuale/img/a-salute-1.jpg" width="250" alt="Salute, parte alta">
  <img src="manuale/img/a-salute-2.jpg" width="250" alt="Salute, parte bassa">
  <img src="manuale/img/p-salute.jpg" width="250" alt="La pagina Salute della plancia">
</p>

### 12.1 Attivarla

1. Menu → **«Salute»**.
2. Su Android, se manca Health Connect, premi **«Installa Health Connect»**.
3. Accendi **«Manda le misure alla casa»** e concedi il permesso di lettura
   della salute.
4. Lascia acceso **«Manda anche ad app chiusa»**.
5. In **«Come ti chiama la casa»** scrivi il tuo nome: con questo nome le tue
   misure compaiono nella plancia.
6. In **«Cosa mandare»** spunta le misure: Passi, Distanza, Piani saliti,
   Battito, Battito a riposo, Peso, Massa grassa, Pressione, Ossigeno, Sonno,
   Calorie…
7. Premi **«Manda adesso»** per il primo invio.

Ogni persona di famiglia fa lo stesso **sul proprio telefono**. Nella sezione
Salute della plancia (terza schermata) compare una persona per telefono.
Toccando una scheda apri lo storico a 7, 30 o 90 giorni.

### 12.2 Se una misura non arriva

- **Android**: premi **«Dai i permessi che mancano»**. Se la richiesta non
  compare, vai in **Impostazioni → Health Connect → Autorizzazioni app →
  GdAHome**.
- **iPhone**: vai in **Impostazioni → Salute → Accesso ai dati e dispositivi →
  GdAHome**.

**Privacy.** Le misure vanno **solo alla tua casa**, cifrate. GdAHome non
scrive mai in Salute. Spegnendo l'interruttore, la casa cancella le tue
misure.

> Chiunque possa aprire la plancia con la sezione Salute vede le misure. Se
> vuoi tenerle riservate, metti la sezione in una plancia visibile solo a te
> («Chi la vede», capitolo 8).

---

## 13. Dispositivi, integrazioni, aiutanti e Zigbee

Queste pagine **cambiano Home Assistant**: sono **Premium** e solo per **chi
amministra Home Assistant**. Gli altri utenti non le vedono nel menu.

### 13.1 Dispositivi

Menu → **«Dispositivi»**.

<p align="center">
  <img src="manuale/img/p-dispositivi.jpg" width="250" alt="Dispositivi">
  <img src="manuale/img/p-disp-foglio.jpg" width="250" alt="Un dispositivo">
</p>

**Legenda** (schermata a sinistra)
- In cima, i tre riquadri: quanti **dispositivi**, quante **entità**, quanti
  **non rispondono**.
- ⑤ **Un dispositivo**: nome, marca e modello, e a destra il suo comando o
  il suo stato. «Non risponde» in rosso vuol dire scollegato.
- Sopra l'elenco ci sono le schede **«Dispositivi»** e **«Integrazioni»**,
  il raggruppamento **«Per stanza» / «Per integrazione»** e la casella
  **«Cerca un dispositivo…»**.

**Toccando un dispositivo** si apre il suo foglio (a destra): marca, modello,
integrazione, **tutte le sue entità** con i comandi, e **«↻ Ricarica
l'integrazione»**.

### 13.2 Integrazioni

Tocca la scheda **«Integrazioni»**.

<p align="center">
  <img src="manuale/img/p-integrazioni.jpg" width="250" alt="Integrazioni">
  <img src="manuale/img/p-integr-foglio.jpg" width="250" alt="Una integrazione">
</p>

**Legenda**
- ① **I riquadri**: «Installate», «Dispositivi» e «Da sistemare».
- **«Da guardare»** raccoglie le integrazioni con un problema. Per esempio
  «Casa · errore auth» vuol dire che **l'accesso va rifatto**: tocca ↻ o
  «Ripara».
- **«＋ Aggiungi»** aggiunge un'integrazione nuova.

**Aggiungere un'integrazione**
1. Premi **«＋ Aggiungi»**.
2. Cerca il nome (per esempio «Shelly», «Hue», «Sonos»).
3. Rispondi alle domande della procedura guidata di Home Assistant, una alla
   volta.

Toccando un'integrazione trovi **«Ricarica»**, **«⚙️ Opzioni»**,
**«Disattiva»** ed **«Elimina»**.

> **«Elimina»** toglie l'integrazione con tutti i suoi dispositivi, e le
> automazioni che li usano smettono di funzionare. Non si torna indietro.

### 13.3 Aiutanti

Menu → **«Aiutanti»**: interruttori, numeri, elenchi, timer e sensori
«fatti in casa», da usare nelle automazioni.

<p align="center">
  <img src="manuale/img/p-aiutanti.jpg" width="230" alt="Aiutanti">
  <img src="manuale/img/p-aiut-nuovo.jpg" width="230" alt="Nuovo aiutante: il tipo">
  <img src="manuale/img/p-aiut-modulo.jpg" width="230" alt="Nuovo aiutante: il modulo">
</p>

**Legenda** (prima schermata)
- ① **«Per tipo» / «Tutti»**: come raggruppare l'elenco.
- ② **«Cerca un aiutante…»**.
- ③ **Un gruppo** (Interruttori): gli aiutanti di quel tipo. Toccane uno per
  cambiarne subito il valore, modificarlo o eliminarlo.

**Creare un aiutante**
1. Premi **«＋ Nuovo»**.
2. Scegli il tipo (seconda schermata): Interruttori, Numeri, Elenchi, Testi,
   Date e ore, Pulsanti, Timer, Contatori, Programmi.
3. Compila il modulo (terza schermata): **Nome**, **Icona** e i campi del
   tipo scelto.
4. Premi **«Salva in Home Assistant»**.

### 13.4 Zigbee: aggiungere un dispositivo dal telefono

**(Premium, solo app.)** La voce **«Zigbee»** compare se in casa c'è **ZHA**
o **Zigbee2MQTT**.

<p align="center">
  <img src="manuale/img/a-zigbee.jpg" width="250" alt="Zigbee">
  <img src="manuale/img/p-dove-lo-metto.jpg" width="250" alt="Dove lo metto?">
</p>

1. Menu → **«Zigbee»** (prima schermata).
2. Leggi **«Prima di cominciare»**:
   - porta il dispositivo **vicino a una presa o a una lampadina già in
     casa**;
   - **tienilo spento**.
3. Premi **«Apri la rete»**. Parte un conto alla rovescia di circa 4 minuti,
   poi la rete si richiude da sola.
4. **Accendi il dispositivo** e mettilo in abbinamento. Quasi sempre si tiene
   premuto il tasto per cinque secondi, finché la spia non lampeggia.
5. Aspetta. Quando compare **«È entrato»**, scrivi un nome chiaro in **«Come
   lo chiami»** (per esempio «Luce comodino») e premi **«Chiamalo così»**.
6. Premi **«Adesso mettilo nella plancia»**: si apre **«Dove lo metto?»**
   (seconda schermata).
7. La plancia ti propone la sezione giusta e ti dice perché (qui: «è una
   lampadina»).
   - Scegli la **«Stanza»**.
   - Se preferisci, sotto **«Oppure»** scegli un'altra sezione.
8. Premi **«Mettilo in Luci»** (o nella sezione scelta). **«Più tardi»**
   rimanda.

Dalla pagina Zigbee, toccando un dispositivo già presente, puoi rinominarlo
(**«Salva il nome»**), metterlo nella plancia o toglierlo dalla rete
(**«Togli dalla rete»**). **«Guarda la rete»** disegna la mappa della rete.

---

## 14. Automazioni e Pianificatore

**(Premium, solo amministratori.)** Sono **vere automazioni di Home
Assistant**: le esegue la casa anche ad app chiusa. Le ritrovi anche in
Home Assistant, in **Impostazioni → Automazioni**.

### 14.1 L'elenco

Menu → **«Automazioni»**.

<p align="center">
  <img src="manuale/img/p-automazioni.jpg" width="250" alt="Automazioni">
  <img src="manuale/img/p-automazioni-aperte.jpg" width="250" alt="Elenco delle automazioni">
</p>

**Legenda** (schermata a sinistra)
- ① **«Automazioni»** e ② **«Pianificatore»**: le due schede della pagina.
- I riquadri **«Attive»**, **«Spente»** e **«Prossima»** (la prossima che
  scatta a un orario).
- ③ **«N proposte per la tua casa»**: idee pensate sui tuoi dispositivi.
  Tocca **«Vedi ›»**; per ognuna scegli **«Crea»** o **«No, grazie»**.
- ④ **Come raggruppare**: «Per categoria», «Per tipo», «Per stanza».
- A destra della ricerca c'è **«＋ Nuova»**, per crearne una.

Nell'elenco (a destra), ogni automazione ha il suo **interruttore** per
accenderla o spegnerla. Toccandola trovi **«Esegui ora»**, **«✏️
Modifica»**, **«Duplica»** ed **«Elimina»**.

### 14.2 Creare un'automazione

1. Premi **«＋ Nuova»**.
2. Scegli un modello pronto oppure **«Da zero»** (prima schermata qui
   sotto).

<p align="center">
  <img src="manuale/img/p-aut-nuova.jpg" width="230" alt="Nuova automazione: i modelli">
  <img src="manuale/img/p-aut-editor.jpg" width="230" alt="L'editor: Quando e Solo se">
  <img src="manuale/img/p-aut-editor-2.jpg" width="230" alt="L'editor: Allora e Salva">
</p>

I modelli sono: «Luce col movimento», «Tapparelle a orario», «Clima spento
con finestra aperta», «Avvisami quando la lavatrice ha finito», «Tutti
fuori: spegni tutto», «Bentornato a casa», «Cronotermostato», «Routine a
orari», «Calendario a fasce» e «Da zero».

3. Compila i tre blocchi dell'editor (seconda e terza schermata):
   - **QUANDO** (cosa la fa partire): a un orario, una porta che si apre, c'è
     movimento, un valore che sale o scende, qualcuno che arriva o esce,
     l'antifurto, un elettrodomestico che finisce…
   - **SOLO SE** (facoltativo): è notte, fra due orari, certi giorni, chi è
     in casa, un'entità in un certo stato. Aggiungi con **«+ Un'altra
     condizione»**.
   - **ALLORA** (cosa fare): accendi, spegni, tapparella, clima, notifica,
     aspetta… Ogni azione ha il suo numero (1, 2, 3); aggiungi con **«+
     Aggiungi un'azione»**.
4. Controlla la frase **«Si legge così:»**, che racconta l'automazione in
   italiano. Per esempio: «quando c'è movimento in Movimento giardino, solo
   se di notte, accendi Faretti soggiorno al 30%, aspetta 2 min e spegni
   Faretti soggiorno».
5. Premi **«💾 SALVA IN HOME ASSISTANT»**.

### 14.3 Il Pianificatore: routine a orari e calendari a fasce

Tocca la scheda **«Pianificatore»**.

<p align="center">
  <img src="manuale/img/p-pianificatore.jpg" width="230" alt="Pianificatore vuoto">
  <img src="manuale/img/p-pian-nuova.jpg" width="230" alt="Nuova nel Pianificatore">
  <img src="manuale/img/p-pian-fasce.jpg" width="230" alt="Calendario a fasce">
</p>

1. Premi **«＋ Crea la prima»** (o **«＋ Nuova»**).
2. Scegli il tipo (seconda schermata):
   - **«Routine a orari»**: a ogni orario le sue azioni. Per esempio «alle
     6:30 caldaia, alle 7 tapparelle su».
   - **«Calendario a fasce»**: tiene accesa una cosa nelle fasce che disegni.

**Calendario a fasce** (terza schermata)
1. Scrivi il **«Nome»** e scegli in **«Cosa accende»** l'entità (per esempio
   la caldaia o l'antifurto).
2. In **«Quando vale»** scegli **«Tutto l'anno»** oppure un periodo.
3. In **«Le fasce»** **trascina il dito** sulle barre dei giorni per segnare
   quando è acceso.
4. Per fare prima usa **«Copia lun su mar–ven»** e **«Copia sab su dom»**;
   **«Svuota»** cancella tutto.
5. Salva.

**Routine a orari**
1. Scegli i **giorni**.
2. Premi **«＋ Aggiungi un orario»** e, per ogni orario, scegli le azioni.
3. Scegli **«Quando vale»** e salva.

---

## 15. In auto e al polso: GdANav, Android Auto, CarPlay, orologi

### 15.1 GdANav, il navigatore

Nell'app c'è **GdANav**, un navigatore pensato per l'auto elettrica che va
bene anche a benzina o a gasolio. Offre:
- percorso con guida vocale e lo svincolo ingrandito agli incroci;
- distributori con i prezzi del giorno;
- traffico, autovelox e meteo lungo la strada;
- segnalazioni degli utenti: incidenti, polizia, lavori, strade chiuse.

<p align="center">
  <img src="manuale/img/s-guida-svincolo.jpg" width="200" alt="Lo svincolo">
  <img src="manuale/img/s-viaggio-soste.jpg" width="200" alt="Le soste di ricarica">
  <img src="manuale/img/s-distributori-prezzi.jpg" width="200" alt="Distributori e prezzi">
  <img src="manuale/img/s-segnala.jpg" width="200" alt="Segnalare">
</p>
<p align="center"><sub>La guida con lo svincolo, il viaggio con le soste alle colonnine, i distributori con i prezzi e le segnalazioni.</sub></p>

**Aprirlo**
- Menu → **«GdANav»**, oppure tocca la tessera GdANav in cima al menu.
- **«A casa»** e **«Al lavoro»** partono subito, se quei luoghi sono
  impostati nel navigatore.
- GdANav si accende da solo quando colleghi il telefono all'auto.

**Segnalare** qualcosa sulla strada: tocca il **triangolo giallo** e scegli
cosa (traffico, polizia, incidente, pericolo, lavori, strada chiusa,
autovelox).

**L'auto elettrica.** GdANav usa l'auto della sezione **Auto** della plancia
e ne legge dal vivo batteria e autonomia.

| | GdANav (gratis) | GdANav Premium (compreso in GdAHome Premium) |
| --- | :-: | :-: |
| Auto a benzina o gasolio | completa | completa |
| Auto elettrica | batteria scritta a mano, percorso senza soste | batteria **letta dall'auto**, **soste alle colonnine** |
| Traffico, autovelox, meteo | ✅ | ✅ |
| Home Assistant, Android Auto, CarPlay | — | ✅ |

### 15.2 Pianificare un viaggio (GdANav Premium)

I viaggi si pianificano dal telefono (tessera GdANav → **«Pianifica i
viaggi»**) oppure dal computer, nella sezione **GdANav** della plancia. Li
ritrovi nel navigatore, su CarPlay e su Android Auto.

<p align="center">
  <img src="manuale/img/p-gdanav.jpg" width="250" alt="GdANav nella plancia">
  <img src="manuale/img/p-gdanav-nuovo.jpg" width="250" alt="Nuovo viaggio">
</p>

1. Premi **«+ Nuovo viaggio»**.
2. Scegli **«Una volta»**, **«Ogni settimana»** oppure **«A tappe»**.
3. Se vuoi, scrivi un nome (per esempio «Giro clienti»).
4. Controlla la **partenza** («Casa», oppure **«Cambia»**) e scrivi **«Dove
   vai?»**. Scegli il suggerimento con 📍.
5. Scegli **«Quando»** e **«Arrivo entro»** oppure **«Parto alle»**, con
   l'orario.
6. Con l'auto elettrica, nella scheda **«L'auto»** scegli la carica alla
   partenza e quella minima all'arrivo. Il piano mostra le **soste di
   ricarica**.
7. In **«Avvisi»** scegli quanti minuti prima di partire vuoi l'avviso.
8. In **«Prepara l'auto e la casa»** puoi:
   - accendere il **clima dell'auto** 10 minuti prima;
   - avere nell'avviso un tasto per aprire il **garage** (non si apre mai da
     solo).
9. Premi **«Salva il viaggio»**.

### 15.3 La casa in Android Auto e CarPlay (Premium)

Sullo schermo dell'auto si apre la mappa di GdANav. Il tasto con la
**casetta** apre i **«Comandi rapidi»**: una griglia di tasti di casa (6 su
ogni auto, fino a 12 sugli schermi grandi). Da lì trovi anche:
- **«Dispositivi»**;
- **«Azioni rapide»**;
- **«Come sta la casa»** (energia e chi è in casa).

**Scegliere i tasti per l'auto (cancello, portone…)**
1. Sul telefono apri **GdANav** → menu ☰ → **«Comandi rapidi in auto»**.
2. La prima volta la pagina è già compilata con le azioni rapide della
   plancia, il cancello e il garage.
3. In **«I TUOI COMANDI»** (fino a 12):
   - **tocca** un comando per cambiare nome, icona e **«Chiedi conferma in
     auto»**, poi **«Salva»**;
   - **tieni premuto** per spostarlo: i primi 6 si vedono su ogni auto;
   - il tasto **meno** lo toglie.
4. Per aggiungerne altri:
   - **«AZIONI RAPIDE DELLA PLANCIA»** → **«Aggiungi»**;
   - **«DALLA CASA»** → cerca e tocca;
   - oppure **«Crea un comando»**:
     1. scegli il dispositivo;
     2. scegli cosa fa (per esempio «Apri»);
     3. scrivi il nome sul tasto;
     4. premi **«Aggiungi in auto»**.

Le modifiche si salvano da sole. Le serrature chiedono sempre conferma.

**«Quasi a casa»**: nella stessa pagina scegli quale comando proporre
arrivando (per esempio «Apri cancello») e **«Quanto prima di arrivare»**
(100 m – 2 km, di serie 500 m). Arrivando, l'auto chiede **«Quasi a casa»**
con **«Fallo»** / **«Non ora»**. Perché funzioni, imposta **«Casa»** nel
navigatore.

Su iPhone puoi usare **Siri**: «Portami a casa con GdAHome», «Portami al
lavoro con GdAHome», «Naviga con GdAHome».

### 15.4 Al polso: Apple Watch e Wear OS (Premium)

L'orologio **non ha impostazioni sue**: i suoi tasti sono gli stessi
**«Comandi rapidi in auto»**.
1. Apri GdAHome sul telefono **una volta** con l'orologio collegato.
2. Sull'orologio trovi:
   - i comandi rapidi;
   - **«Dispositivi»**;
   - **«Azioni rapide»**;
   - **«Come sta la casa»**;
   - il **«Navigatore»**: «Portami a casa» e «Al lavoro», e durante la guida
     la freccia con la distanza.

Se l'orologio dice «Il telefono non risponde», tieni il telefono vicino. Su
Wear OS controlla anche il Bluetooth.

---

## 16. GdAHome Premium e licenze

### 16.1 Base e Premium a confronto

| | **Base**<br>gratis, per sempre | **Premium**<br>4,99 € al mese · 49,99 € all'anno |
| --- | :-: | :-: |
| L'add-on e la plancia in Home Assistant | ✅ | ✅ |
| Plance | una, la principale | fino a **30** per casa |
| Telefoni abbinati alla casa | fino a 2 | **senza limite** |
| Case nell'app | una | fino a **10** |
| Dove funziona | sul Wi-Fi di casa | **anche da fuori**, cifrato |
| L'app dal browser | — | ✅ |
| Configurare la plancia dal telefono | — | ✅ |
| Dispositivi, integrazioni, aiutanti, automazioni | — | ✅ |
| Zigbee dall'app | — | ✅ |
| Notifiche | solo sicurezza | tutte, elaborate, mini video, riepilogo serale |
| La tua giornata | — | ✅ |
| Plancia a muro, Colpo d'occhio, Casa 3D | — | ✅ |
| La Salute dall'orologio | — | ✅ |
| Al polso e in auto | — | ✅ |
| GdANav | gratis | **Premium compreso** |
| Segnalazioni, assistenza, aggiornamenti, lucchetto | ✅ | ✅ |

> **I primi 14 giorni di Premium sono gratis**, la prima volta. Se non ti
> serve, disdici dal Play Store o dall'App Store prima che finiscano.

**Premium è della casa, non del telefono.** Si attiva **una volta per la
casa**: tutti i telefoni abbinati, e anche l'app nel browser, diventano
Premium insieme. Chi abita con te **non paga un'altra volta**.

### 16.2 Attivare Premium dall'app

<p align="center">
  <img src="manuale/img/a-premium.jpg" width="260" alt="La pagina Premium">
  <img src="manuale/img/a-premium-attivo.jpg" width="260" alt="Premium attivo">
</p>

**Legenda** (schermata a sinistra)
- ① **Cosa comprende Premium.**
- ② **«Annuale»**: 49,99 € all'anno (si risparmia il 17%).
- ③ **«Mensile»**: 4,99 € al mese.
- ④ **«Prova gratis per 14 giorni»**: avvia la prova e poi l'abbonamento.

1. Menu → **«GdAHome Premium»**.
2. Scegli ② o ③.
3. Premi ④ e conferma con Google Play o con l'App Store.
4. Compare **«Fatto: ora la casa è Premium.»**. La pagina diventa come quella
   a destra.

Più in basso nella pagina ci sono altri tre tasti:
- **«Gestisci abbonamento»**: apre l'abbonamento nel negozio, per cambiarlo o
  disdirlo.
- **«Ripristina abbonamento»**: dopo un cambio di telefono. Un abbonamento
  vale per **una casa alla volta**.
- **«Ho un codice regalo»**: vedi qui sotto.

**Dal browser non si compra**: compri dal telefono, e vale anche nel browser.

### 16.3 Con un codice regalo

I codici sono fatti così: `GDA-XXXX-XXXX-XXXX` e **valgono una volta
sola**.

<p align="center"><img src="manuale/img/d-codice-regalo.jpg" width="250" alt="Codice regalo"></p>

**Dall'app (anche dal browser)**
1. Menu → **«GdAHome Premium»** → **«Ho un codice regalo»**.
2. Scrivi il codice.
3. Premi **«Riscatta»**.

**Dalla pagina dell'add-on**: «Configura GdAHome» → **Licenza** → casella
③ e tasto ④ (vedi capitolo 20.4).

### 16.4 Dal tuo installatore

Se l'impianto te l'ha fatto un installatore, può:
- **assegnare Premium direttamente alla tua casa**: non devi fare niente;
- **mandarti un codice regalo**, che riscatti come sopra.

### 16.5 Quando Premium finisce

**Non si perde niente.** La casa torna Base:
- la plancia principale resta; le altre **restano salvate** e tornano con
  Premium;
- restano abbinati **i due telefoni usati più di recente**, gli altri si
  staccano;
- una casa senza internet resta Premium per **fino a 8 giorni**.

---

## 17. Impostazioni dell'app, lucchetto e diagnostica

### 17.1 Impostazioni app

Menu → **«Impostazioni app»** (solo nell'app sul telefono).

<p align="center"><img src="manuale/img/a-impostazioni.jpg" width="280" alt="Impostazioni app"></p>

**Legenda**
- ① **«Plancia leggera»** (spenta di serie): ferma le animazioni e toglie le
  sfocature. Accendila solo se il telefono va a scatti.
- ② **«Composizione ibrida»** (Android): prova a spegnerla solo se, con lei
  accesa, l'app va peggio.
- ③ **«Chiedilo quando apro l'app»**: il **lucchetto**. L'app si apre solo
  con il volto o l'impronta.
- ④ **«Anche quando ci torno»**: lo chiede di nuovo se hai lasciato l'app per
  più di un minuto.

**Accendere il lucchetto**
1. Accendi ③.
2. Più sotto, in **«Con che cosa»**, scegli **«Volto»** e/o **«Impronta»**.
3. In **«E una seconda volta prima di»** puoi chiederlo anche per:
   - «Aprire le pagine di gestione»;
   - «Comandare dalla scheda Dispositivi»;
   - «Togliere una casa dall'app».

Volto e impronta **non escono dal telefono**: GdAHome riceve solo un «sì».

### 17.2 Diagnostica app

<p align="center"><img src="manuale/img/a-diagnostica.jpg" width="250" alt="Diagnostica app"></p>

Menu → **«Diagnostica app»**: una pagina di sola lettura su come va l'app
nell'ultimo minuto. Mostra fotogrammi lenti, il collegamento con la casa e
quanto ci mettono i dati. **Se l'app va a scatti**, fai una foto di questa
pagina e allegala a una segnalazione.

---

## 18. Aggiornamenti e riavvio della casa

Menu → **«Aggiornamenti»**. Il numero sulla voce dice quanti aggiornamenti
sono in attesa.

<p align="center">
  <img src="manuale/img/a-aggiornamenti.jpg" width="250" alt="Aggiornamenti">
  <img src="manuale/img/a-aggiornamenti-foglio.jpg" width="250" alt="Cosa cambia">
</p>

**Installare un aggiornamento**
1. In **«Da fare»** ci sono gli aggiornamenti di Home Assistant, degli
   add-on, di GdAHome e dei firmware.
2. Tocca **«Cosa cambia»** per leggere le novità (schermata a destra).
3. Premi **«Installa»** e conferma con **«Aggiorna»**.

Quelli segnati **«riavvia la casa»** riavviano Home Assistant: per qualche
minuto l'app resta senza collegamento, poi si ricollega da sola.

**Riavviare Home Assistant** (quando qualcosa non risponde e non si capisce
perché)
1. In fondo, scheda **«Riavvia Home Assistant»** → **«Riavvia»**.
2. Conferma.
3. Per qualche minuto luci, tapparelle e automazioni non rispondono.

**Aggiornare l'app.** L'app si aggiorna dal Play Store o dall'App Store. Se è
troppo vecchia, compare **«C'è una versione nuova di GdAHome»**: premi il tasto
e aggiorna. Case e plance restano come sono.

<p align="center"><img src="manuale/img/a-aggiorna-app.jpg" width="220" alt="C'è una versione nuova"></p>

---

## 19. Segnalazioni e assistenza

### 19.1 Segnalazioni

Servono per un **problema**, un'**idea** o una **domanda**. Arrivano a chi fa
l'app con le informazioni tecniche già allegate, e la risposta torna nell'app.

> **Le segnalazioni sono pubbliche**: diventano pagine su GitHub che chiunque
> può leggere. Non scriverci password, dati personali o indirizzi.

<p align="center">
  <img src="manuale/img/a-segnalazioni.jpg" width="230" alt="Le tue segnalazioni">
  <img src="manuale/img/a-segn-nuova.jpg" width="230" alt="Nuova segnalazione">
  <img src="manuale/img/a-segn-finestra.jpg" width="230" alt="Foto e video pubblici">
</p>

1. Menu → **«Segnalazioni»** → **«Nuova segnalazione»**.
2. Scegli il tipo: **«Problema»**, **«Idea»** oppure **«Domanda»**.
3. Scrivi il titolo **«In due parole»** (per esempio «La luce del salotto non
   risponde»).
4. In **«Racconta»** spiega cosa stavi facendo, cosa ti aspettavi e cosa è
   successo.
5. Se serve, allega **foto e video** con **«Foto»**, **«Scatta»** o
   **«Video»** (massimo 10 MB). La prima volta l'app ricorda che foto e
   video saranno pubblici (terza schermata): premi **«Ho capito»**.
6. Premi **«Manda»**.

In **«Le tue segnalazioni»** (prima schermata) le filtri per **«Da
lavorare»**, **«In lavorazione»**, **«Chiuse»**, **«Tutte»**. Apri una
segnalazione per leggere le risposte e aggiungere messaggi.

### 19.2 Assistenza

<p align="center"><img src="manuale/img/a-assistenza.jpg" width="230" alt="Assistenza"></p>

Menu → **«Assistenza»**: una **chat privata** con chi fa l'app, che non
finisce su nessuna pagina pubblica.
1. Scrivi nella casella **«Scrivi a chi fa l'app…»** e invia.
2. La risposta arriva qui sotto.

Con il messaggio partono da sole le versioni di plancia, add-on e app.
**È la strada più veloce per chiedere aiuto.**

---

## 20. La pagina «Configura GdAHome» in Home Assistant

Nella barra laterale di Home Assistant c'è **«Configura GdAHome»**. Qui
gestisci telefoni, plance e licenza. La pagina **Casa** è nel capitolo 3.3,
l'abbinamento nel capitolo 4.2, le plance nel capitolo 8.

<p align="center"><img src="manuale/img/d-addon-scheda.jpg" width="680" alt="La pagina dell'add-on con i telefoni abbinati"></p>
<p align="center"><sub>La pagina con due telefoni abbinati.</sub></p>

### 20.1 Telefoni

Scheda **Telefoni**: i telefoni e i tablet abbinati, con il contatore (per
esempio «2 di 10»). Ogni riga mostra:
- il nome e il proprietario;
- **«Collegato adesso»** oppure quando è stato visto l'ultima volta;
- il modello e la versione dell'app.

Il menu **«⋯»** della riga ha due voci:
- **«Rinomina»**: scrivi il nome e premi **Salva**.
- **«Togli da questa casa»**: il telefono **esce subito**. Per rientrare
  dovrà abbinarsi di nuovo con un QR nuovo.

> **Hai perso il telefono?** Toglilo da qui: da quel momento non entra più.

### 20.2 Licenza

<p align="center"><img src="manuale/img/console-licenza.jpg" width="680" alt="Licenza"></p>

**Legenda**
- ① **Lo stato**: «Base», oppure «Premium attivo» con la scadenza e la
  provenienza (abbonamento, regalo, installatore).
- ② **«Ricontrolla adesso»**: chiede subito la licenza. Usalo dopo aver
  appena comprato Premium. La casa la ricontrolla comunque da sola ogni 6
  ore.
- ③ **La casella del codice regalo** (`GDA-XXXX-XXXX-XXXX`).
- ④ **«Attiva»**: riscatta il codice.
- ⑤ **«Matricola della casa»**: il codice da mandare a chi ti vuole regalare
  Premium (con il tasto **Copia**).

Al centro, la tabella **«Base e Premium»** segna con «il tuo» il piano della
tua casa.

<p align="center"><img src="manuale/img/d-licenza-premium.jpg" width="560" alt="Licenza Premium"></p>
<p align="center"><sub>La stessa scheda con Premium attivo.</sub></p>

### 20.3 Avanzate

<p align="center"><img src="manuale/img/console-avanzate.jpg" width="680" alt="Avanzate"></p>

**Legenda**
- ① **«Versione e aggiornamenti»**: la versione dell'add-on. Gli
  aggiornamenti arrivano da Home Assistant.
- ② **«GdAHome nel browser»**: l'indirizzo dell'app dal browser, con
  **«Apri nel browser»**. Con Premium funziona da casa e da fuori.

---

## 21. Le opzioni dell'add-on

In Home Assistant: **Impostazioni → Add-on → GdAHome → Configurazione**.
Dopo ogni cambio premi **Salva**: l'add-on si riavvia da solo.

### 21.1 «La casa»: le opzioni che contano

| Opzione | Di serie | Cosa fa |
| --- | --- | --- |
| **Da fuori casa** | acceso | L'app entra anche da fuori passando dal centralino. Serve anche per notifiche e segnalazioni. |
| **Il codice di chi ti ha fatto l'impianto** | vuoto | Lascialo vuoto, a meno che un installatore non ti abbia dato un codice (capitolo 22). |
| **Ogni quanto parte un rapporto** | 1 minuto | Conta solo se il codice sopra è scritto. |
| **Lascia che chi ti ha fatto l'impianto aggiorni da lontano** | spento | Può solo installare aggiornamenti già in attesa e riavviare Home Assistant. |
| **Lascia che chi ti ha fatto l'impianto configuri la plancia da lontano** | spento | Può vedere e cambiare com'è fatta la plancia. |
| **Lascia che la plancia porti il marchio di chi ti ha fatto l'impianto** | acceso | Il nome e il logo dell'installatore sulla plancia. |
| **Quanto vive un QR di abbinamento** | 5 minuti | Da 1 a 60. |
| **Dopo quanto un telefono va riabbinato** | 90 giorni | 0 = mai. |
| **Quanti telefoni insieme** | 10 | Con Base al massimo 2; con Premium senza limite. |

### 21.2 Le altre sezioni

- **«Chi installa»**: solo per chi monta GdAHome nelle case degli altri. In
  casa tua lascia tutto com'è.
- **«Chi gestisce il cruscotto»** e **«L'assistenza»**: servono a una sola
  casa al mondo. **Lasciale vuote.**
- **«Avanzate»**:
  - la porta dell'app (8098): cambiala solo se è già usata da un altro
    programma;
  - **«Quanto scrive il registro»**: lascia «info».

---

## 22. Se la casa te l'ha montata un installatore

Il tuo installatore può tenere d'occhio l'impianto **senza entrare in casa
tua**. Decidi tu, con interruttori che puoi spegnere quando vuoi.

### 22.1 Collegare la casa all'installatore

1. L'installatore ti dà un **codice di abbinamento**: 16 caratteri, valido un
   giorno.
2. In Home Assistant apri **Impostazioni → Add-on → GdAHome →
   Configurazione**.
3. Incolla il codice in **«Il codice di chi ti ha fatto l'impianto»** e premi
   **Salva**.

### 22.2 Cosa vede e cosa non vede

| L'installatore vede | L'installatore **non** vede |
| --- | --- |
| Come sta la macchina: processore, memoria, disco, temperatura | Se le luci sono accese o le porte aperte |
| Rete e internet | Chi è in casa e dove sono le persone |
| Versioni, add-on, aggiornamenti in attesa | Cosa riprendono le telecamere |
| Quanti telefoni e i nomi delle plance | Il nome del tuo Wi-Fi |
| I nomi dei dispositivi che non rispondono, le batterie scariche, l'ultimo backup | |

Il rapporto lo leggi parola per parola in **«Configura GdAHome» →
Installatore → «Leggi l'ultimo rapporto, parola per parola»**.

### 22.3 I permessi in più (spenti di serie)

- **«…aggiorni da lontano»**: può installare gli aggiornamenti già pronti
  (sempre dopo un backup) e riavviare Home Assistant. Nient'altro.
- **«…configuri la plancia da lontano»**: può sistemare la plancia senza
  venire. Vede i nomi di stanze, dispositivi ed entità, **mai** le
  telecamere né gli stati dei sensori.
- **«…porti il marchio»** (acceso di serie): la plancia mostra il suo nome e
  il suo logo.

### 22.4 Smettere

In **«Configura GdAHome» → Installatore** premi **«Smetti di mandarlo»** e
conferma con **Smetti**.

---

## 23. Per chi installa: il cruscotto

Chi monta impianti per i clienti ha il **cruscotto per installatori**
(**«Gestione installatore»**): tutti gli impianti in una pagina e le licenze
Premium da dare ai clienti.

<p align="center"><img src="manuale/img/d-cruscotto.jpg" width="700" alt="Il cruscotto per installatori"></p>

### 23.1 Come si comincia

1. **Chiedi l'accesso** su [gdahome.org/#contatti](https://gdahome.org/#contatti):
   ricevi il codice del cruscotto e il pacchetto di licenze.
2. Sul **tuo** Home Assistant (mai su quello di un cliente) apri le opzioni
   dell'add-on, sezione **«Chi installa»**.
3. Accendi l'interruttore, scrivi il codice e premi **Salva**.
4. Compare **«Gestione installatore»** nella barra laterale e nel menu
   dell'app.

Il cruscotto ha quattro schede: **Impianti · Aggiornamenti · Abbinamento ·
Licenze**.

### 23.2 Collegare un cliente

1. Scheda **Abbinamento** → **«Genera codice»** e **copialo**. Vale un giorno
   e per un solo impianto.
2. A casa del cliente: **Impostazioni → Add-on → GdAHome → Configurazione** →
   incolla in **«Il codice di chi ti ha fatto l'impianto»** → **Salva**.
3. Entro un minuto l'impianto compare in **«Nuovi impianti»**: dagli un nome
   e premi **Salva**.

### 23.3 Tenere d'occhio gli impianti

- La scheda **Impianti** colora ogni impianto: **in ordine**, **da
  verificare**, **offline**.
- **«Da verificare ora»** mette in cima quelli che chiedono qualcosa.
- Ogni impianto ha **dieci controlli** al giorno: plancia, telefoni,
  collegamento da fuori, dispositivi, aggiornamenti, add-on, rete, macchina,
  backup, batterie.
- Ricevi un avviso quando una casa smette di farsi sentire e quando riprende.

Se il cliente l'ha permesso, dalla scheda dell'impianto puoi **installare gli
aggiornamenti** (uno alla volta, dopo il backup) e **riavviare Home
Assistant**.

### 23.4 Le licenze per i clienti

Nella scheda **Licenze**, scegli **App** e **Durata**, poi una delle due
strade:
- **«Assegna all'impianto»**: la casa è Premium subito;
- **«Genera un codice»**: lo mandi al cliente, che lo scrive in **«Ho un
  codice regalo»**.

Una licenza tolta o un codice annullato **torna nel tuo pacchetto**.

---

## 24. Se qualcosa non va

| Cosa succede | Cosa fare |
| --- | --- |
| Il QR non funziona | Vale 5 minuti e una volta sola: generane uno nuovo, oppure usa il codice a mano (4.3). |
| «Fuori casa serve GdAHome Premium» | Con Base la casa si apre solo dal Wi-Fi di casa. |
| Da fuori non entro, ma ho Premium | In «Configura GdAHome» → Casa leggi il motivo sotto «Da fuori casa». Controlla che l'opzione «Da fuori casa» sia accesa. |
| «Da fuori casa: cade di continuo» | C'è un'altra copia della casa accesa (per esempio un backup ripristinato su un'altra macchina): spegni GdAHome sulla copia. |
| «Riconnessione…» | L'add-on si sta aggiornando o Home Assistant si sta riavviando: l'app riprova da sola. |
| «Questo telefono è stato staccato» | Riabbinalo con un QR nuovo. |
| «Con Base si abbinano al massimo 2 telefoni» | Sono rimasti i due usati più di recente. Con Premium riabbini anche questo. |
| «Non hai plance associate alla tua utenza» | L'amministratore deve abilitarti: «Configura GdAHome» → Plance → Gestisci → «Chi la vede». |
| La plancia dice che Home Assistant va riavviato | Riavvia Home Assistant (3.3). |
| Le notifiche non arrivano | Controlla l'interruttore principale, il permesso del telefono e l'opzione «Da fuori casa», poi premi «Manda una notifica di prova». |
| La Salute non arriva | Paragrafo 12.2. |
| L'app va a scatti | Accendi «Plancia leggera» (17.1); se non basta, manda una segnalazione con la foto di «Diagnostica app». |
| Manca la voce «Zigbee» | Serve ZHA o Zigbee2MQTT, Premium, e l'app sul telefono. |
| Mancano Dispositivi, Automazioni, Aiutanti | Sono solo per chi amministra Home Assistant, e con Premium. |
| Ho perso il telefono | «Configura GdAHome» → Telefoni → ⋯ → «Togli da questa casa». |

Se il problema resta, scrivi in **Assistenza** o apri una **Segnalazione**
(capitolo 19).

---

## 25. Domande frequenti

**Si installa su Home Assistant in Docker?**
No: su Container e Core gli add-on non esistono. Serve OS o Supervised.

**L'add-on serve solo per l'app?**
No: la plancia si usa anche in Home Assistant, da qualunque browser di casa.

**Devo installare anche l'integrazione DashboardModern?**
No: la plancia è già nell'add-on.

**Siamo in quattro in casa: paghiamo quattro volte?**
No. Premium è della casa: tutti i telefoni abbinati sono Premium insieme.

**Il mio installatore mi ha dato un codice. Dove lo metto?**
Dipende dal codice:
- **codice regalo** (`GDA-…`): nell'app, «GdAHome Premium» → «Ho un codice
  regalo»;
- **codice di abbinamento** (16 caratteri): nelle opzioni dell'add-on, in «Il
  codice di chi ti ha fatto l'impianto».

**Devo creare un account?**
No.

**Qualcuno può vedere le mie telecamere?**
No. Da fuori i messaggi viaggiano cifrati fra telefono e casa, e il segreto
di Home Assistant non lascia mai l'add-on.

**Le automazioni create dall'app funzionano ad app chiusa?**
Sì: sono automazioni di Home Assistant e le esegue la casa.

**Cosa succede se disdico Premium?**
Non perdi niente: la casa torna Base e quello che hai preparato resta
salvato.

**L'app parla inglese?**
Sì: sceglie da sola la lingua del telefono (italiano o inglese).

---

## 26. Privacy, contatti e chi c'è dietro

**I tuoi dati restano in casa.** Nessun account, nessuna pubblicità, nessun
tracciamento. Per sapere se una casa è Premium, l'add-on manda solo un
identificativo anonimo. I pagamenti li gestiscono Google e Apple. I dettagli
sono nell'[informativa sulla privacy](https://gdahome.org/privacy.html) e nei
[termini d'uso](TERMINI.md).

**Contatti**
- Nell'app: **Assistenza** (la via più veloce) e **Segnalazioni**.
- Sito: [gdahome.org](https://gdahome.org).
- Email: **domotica@crvgroup.it**.

**Chi c'è dietro.** GdAHome la fa **CRV Immobiliare S.r.l.**, impresa di
impianti elettrici e tecnologici di Aversa (CE).

---

<sub>Manuale aggiornato a GdAHome 1.19.1. Le schermate vengono da una casa di
prova: nella tua app vedrai i nomi della tua casa.</sub>
