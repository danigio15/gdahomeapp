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
                      iPhone: «gdahome: nuova notifica» ◄───────┘
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

**Oggi l'iPhone mostra «gdahome: nuova notifica»**, e il testo vero quando si
tocca la notifica (o subito, se l'app è aperta). Per mostrare il testo prima di
toccarla serve una **Notification Service Extension**: un secondo pezzo
dell'app, nativo, che apre la busta mentre la notifica arriva. Non c'è, per
due ragioni:

- va aggiunta come target nel progetto di Xcode (`project.pbxproj`) e firmata
  con un suo profilo; il workflow firma senza un Mac, con la firma automatica,
  e un target in più è un pezzo che può fermare TestFlight;
- la chiave del filo sta nel portachiavi dell'app: l'estensione la potrebbe
  leggere solo con un gruppo di portachiavi condiviso, cioè spostando i segni
  di tutte le case già abbinate.

Il centralino manda già `mutable-content: 1`: il giorno che l'estensione c'è,
non cambia niente dalla parte della casa.

Le urgenti sono «sensibili al tempo» (`interruption-level`), ma il sistema le
tratta così solo con il permesso `com.apple.developer.usernotifications.time-sensitive`,
che il workflow aggiunge con la variabile `GDAHOME_NOTIFICHE_URGENTI = si`.
Le «critiche» (che suonano col telefono muto) vogliono un permesso che concede
Apple su richiesta: non ci sono.

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
