# Le notifiche

La casa avvisa il telefono anche ad app chiusa: l'antifurto che scatta, il
campanello, la lavatrice che ha finito. Questa pagina dice come funziona, chi
vede cosa, e cosa va acceso a mano.

## Il viaggio

```
 Home Assistant ──state_changed──► ponte (sentinella.js: le regole)
                                     │ notifiche.js: a chi, quando, se
                                     │ spinta.js: chiusa per ogni telefono
                                     ▼
                       {t:"spinta", telefono, busta}  sul filo della casa
                                     ▼
                                 centralino (spinte.js) ──► Firebase (FCM HTTP v1)
                                                                │
                      Android: solo dati ◄──────────────────────┤
                      l'app apre la busta e mostra la notifica  │
                                                                │
                      iPhone: «GdAHome: nuova notifica» ◄───────┘
                      la busta si apre quando la si tocca
```

- **La busta** è chiusa con una chiave ricavata (HKDF, etichetta
  `gdahome/spinta/v1`) dalla chiave del filo che il telefono ha ricevuto
  abbinandosi: AES-256-GCM, nonce casuale, il telefono nei dati autenticati.
  Il centralino, Google e Apple vedono un blocco chiuso, l'identificativo del
  telefono (`dm_…`) e, sull'iPhone, una frase sempre uguale.
- **Le foto non viaggiano nella notifica.** Dentro c'è solo il nome della
  telecamera, e solo se quell'utente la può vedere nella plancia. La foto la
  chiede l'app alla casa, sul filo cifrato, con le regole della plancia.
- **I tasti** («Spegni», «Inserisci», «Apri cancello», «Più tardi») non
  portano comandi: portano un riferimento. Il telefono, dal suo filo e col suo
  segno, dice «notifica X, tasto Y»; la casa esegue quello che aveva preparato
  per quel telefono, una volta sola, entro due ore. «Apri cancello» col
  telefono bloccato chiede prima di sbloccarlo.

## Chi le riceve

Solo i telefoni abbinati **e intestati** a un utente di Home Assistant attivo,
che vede almeno una plancia di quella casa. Un telefono abbinato prima che i
telefoni si intestassero non riceve: la pagina «Notifiche» dice di
riabbinarlo. Le impostazioni sono per telefono e per casa, e stanno sul ponte
(`/data/notifiche.json`, 600). Le personalizzate sono della casa: chi
amministra le fa per tutti, gli altri solo per sé.

Ore di silenzio: passano solo le urgenti. «Solo quando sono fuori casa»: in
casa tacciono Casa e Assistente (serve la `person.*` dell'utente). Ogni evento
ha la sua pausa contro i doppioni, e ogni telefono al più 30 notifiche
all'ora; il centralino ne fa passare al più 30 al minuto e 300 all'ora per
casa.

Le notifiche passano dal centralino: con `da_fuori_casa` spento non hanno
strada, e l'app lo dice.

## Android

Tre canali: **Urgenti** (suono, importanza massima), **Casa**, **Manutenzione**
(senza suono). Il campanello è una notifica a tutto schermo come una chiamata
(`USE_FULL_SCREEN_INTENT`): da Android 14 lo decide chi usa il telefono, e se
dice di no resta una notifica urgente in cima. La schermata del campanello
mostra la foto dal vivo (una ogni due secondi, sul filo).

Firebase si accende solo se c'è `google-services.json`, che scrive il workflow
dal segreto `GDAHOME_FIREBASE_ANDROID`, e solo per il pacchetto vero
(`com.gdahome.gdahome`): quello firmato di prova esce senza notifiche.

## iPhone

Apple consegna sempre una frase da mostrare: è quella di riserva, «GdAHome:
nuova notifica», con la busta accanto. Dalla 1.13.0 la apre la **Notification
Service Extension** (`app/ios/NotificheService`) mentre la notifica arriva, e
sull'iPhone si legge il titolo e il testo veri.

- L'estensione non legge il portachiavi dell'app. L'app le lascia **solo la
  chiave delle notifiche** di ogni casa (`lib/notifiche/chiavi_per_l_iphone.dart`,
  `Runner/ChiaviDelleNotifiche.swift`), in un gruppo di portachiavi diviso solo
  con lei, leggibile dopo il primo sblocco e solo su quel telefono. La chiave
  del filo, che apre la casa, resta dov'era: nessuna casa va riabbinata.
- Se qualcosa non va — una casa tolta, una busta toccata, il tempo che finisce
  — la notifica resta con la frase di riserva: mai una notifica persa.
- Il target si aggiunge al progetto nel workflow (`strumenti/notifiche-in-xcode.rb`),
  come l'orologio, e si firma con la firma automatica: Apple crea da sé
  l'identificativo `com.gdahome.gdahome.NotificheService` e il suo profilo. La
  «prova del negozio» firma per davvero senza andare su TestFlight.

Le urgenti sono «sensibili al tempo» (`interruption-level`), ma il sistema le
tratta così solo con il permesso `com.apple.developer.usernotifications.time-sensitive`,
che il workflow aggiunge con la variabile `GDAHOME_NOTIFICHE_URGENTI = si`.
Le «critiche» (che suonano col telefono muto) vogliono un permesso che concede
Apple su richiesta: non ci sono.

## Semplici o elaborate

Nella pagina Notifiche dell'app, «Come le vuoi»: **Semplici** (solo testo, di
serie) o **Elaborate**. Ogni voce si apre e si sceglie anche da sola — stile,
quali dispositivi, una soglia, il suono, gli orari, subito o nel riepilogo
della sera — e tutto va sul ponte come le altre impostazioni (`stile`, `su`).

Le elaborate portano nella busta una **scheda**: i numeri, non il disegno (il
ciclo di un elettrodomestico, la giornata del sole, l'UPS, l'antifurto). Il
disegno lo fa il telefono: su Android l'app (`lib/notifiche/scheda.dart`,
anche ad app chiusa, nel servizio che Android sveglia), sull'iPhone
l'estensione (`NotificheService/LaScheda.swift`). Se il disegno non riesce, la
notifica arriva semplice.

Il movimento e l'antifurto possono portare la **foto della telecamera**. In
una spinta non ci sta: la casa la chiude con la stessa chiave delle notifiche
di quel telefono (dati autenticati `gdahome/foto/v1|telefono`) e la lascia al
centralino sul suo filo (`{t: "foto"}` → `{t: "foto-ok", id}`). Il centralino
la tiene in memoria **dieci minuti** e la dà **una volta sola** a
`GET /foto/<id>` (`centralino/src/foto.js`); non la può aprire. L'app su
Android e l'estensione sull'iPhone la prendono, la aprono e la mettono nella
notifica. Con le semplici la casa non manda nessuna foto.

## Cosa va fatto a mano

1. **Firebase**: nel progetto, l'app Android `com.gdahome.gdahome` e l'app iOS
   `com.gdahome.gdahome`, con la chiave APNs caricata (fatto).
2. **Apple Developer**: sull'identificativo `com.gdahome.gdahome` la capacità
   **Push Notifications** (la firma automatica di solito la accende da sé) e,
   se si vogliono le urgenti sensibili al tempo, **Time Sensitive
   Notifications** più la variabile `GDAHOME_NOTIFICHE_URGENTI = si`.
3. **Il tramite**: rilanciare una volta `centralino/accendi.sh` sulla macchina.
   Fa la chiave della macchina e alla fine dice la sua metà pubblica: va in
   GitHub → Settings → Secrets and variables → Actions → **Variables** come
   `TRAMITE_CHIAVE_DELLA_BUSTA`. Poi «Il tramite»: il segreto
   `GDAHOME_FIREBASE_INVIO` parte chiuso per la macchina nel messaggio del
   segno, e la macchina lo apre (`tramite-apri-la-busta`). Per cambiarlo si
   rimanda una versione nuova del tramite.
4. **L'add-on** va aggiornato, e l'app pure: le case con l'add-on di prima non
   conoscono `ponte/notifiche/…`, e l'app lo dice.
