# La Config è quella della dashboard, e basta

Documento di verità, non di intenzioni. La domanda a cui rispondeva era:
**quanto manca perché la Configurazione dell'app sia quella della
dashboard?** La risposta, per mesi, è stata «poco»: ogni giro chiudeva le
caselle che mancavano, la prova le contava, e il numero saliva.

Il numero saliva e la risposta era sbagliata, perché la domanda era sbagliata.
Due schermate che leggono e scrivono le stesse chiavi non sono la stessa
schermata: hanno due grafiche, due alberature, due posti dove ogni cosa sta,
due modi di chiamarla. La Config dell'app aveva le caselle giuste e non era la
Config: le foto dei ritratti erano finite fuori dalle persone, i varchi
avevano le righe senza la tendina della stanza e senza il colore dello stato,
la stessa scheda letta sui due telefoni non si riconosceva.

**Adesso ce n'è una.** È quella della dashboard, e l'app apre lei.

## Com'è fatta, oggi

La plancia dentro l'app è quella vera: la stessa pagina che si apre in Home
Assistant, servita dal ponte e cucita sul filo dell'app
(`app/lib/plancia/servitore.dart`). La sua Configurazione è una **pagina della
plancia**, `#page-config`, e dentro ci sta tutto:

| tessera | cosa fa |
|---|---|
| 🧩 Configura Entità | apre `apriConfigEntita()`, l'editor col cercatore, le sette famiglie, le pastiglie |
| 🎨 Tema | chiaro, scuro, auto — «su questo dispositivo», lo scrive lei — con le sei tavolozze innestate sotto (`tavolozze-section.js`) |
| 📌 Barra di navigazione | a scomparsa o fissa, anche questa del dispositivo |
| 💙 Sostieni il progetto | il collegamento delle donazioni; **nascosta nell'app**, dove gli acquisti ci sono |
| 🎫 Segnalazioni | la sua strada passa dall'integrazione: nell'app resta nascosta, vedi sotto |
| 💬 Assistenza | si toglie da sé quando la chat non risponde |

Dentro la plancia le porte della Configurazione sono tre: la linguetta nella
barra, l'ingranaggio in cima e il menu del tasto ☰. Nella dashboard ci vogliono
tutte — lì la Config è una pagina come le altre — e nell'app no: la porta è la
voce del menu, e tre porte sulla stessa stanza sono due di troppo. Nell'app
restano nascoste tutte e tre, e con loro il tasto «← HOME» che la pagina si
disegna in cima: chi ci arriva dal menu torna col menu, non con un tasto che lo
riporta sulla Home della plancia. Col ☰ se ne va anche il «Reset totale», che
cancella tutta la configurazione: nell'app non si perde niente che non si possa
rifare dalla Config, e non si tocca per sbaglio.

Di quella pagina, l'app sposta **la porta e non la stanza**:

- dalla barra in fondo alla plancia la voce sparisce — su un telefono quella
  fila di schede non ci sta, ed è la ragione per cui la porta si spostava;
- nel menu dell'app c'è «Configurazione», e preme la sua linguetta
  (`Premesse.laConfigFuoriDallaPlancia` mette le maniglie nella pagina,
  `PlanciaVeraState.apriLaConfig` le tira);
- tornando alla Plancia la pagina si chiude e la plancia torna dov'era
  (`gdahomeTornaDallaConfig`), che è quello che farebbe toccando un'altra
  linguetta della sua barra.

Per un giro l'app apriva **solo l'editor**, e la pagina la nascondeva. Era
mezza scelta: l'editor è la parte grossa, ma il Tema, la Tavolozza, la Barra
e le donazioni stanno nella pagina, non nell'editor. Nascosta la pagina,
quelle si perdevano — e l'app se ne era rifatti tre suoi, in Flutter, che
scriveva nel deposito della pagina a ogni caricamento: due padroni per la
stessa preferenza, e vinceva sempre quello di Flutter. Adesso si apre la
pagina, e i suoi comandi sono i suoi.

Non si tocca un file della dashboard: si aggiunge una riga alla **pagina
servita**, come per le misure delle barre del telefono. Il ponte ricontrolla i
file uno per uno, e una plancia con un file cambiato si direbbe modificata.

## Cosa l'app tiene di suo

Due interruttori, e sono dell'**app**, non della plancia: la plancia non ce li
ha e non li può avere, perché riguardano il modo in cui l'app la tiene dentro
un riquadro. Stanno dove stanno i numeri che sono la ragione per cui uno li
cerca — «**Come va l'app**», che è una voce del menu e la schermata che apre
anche l'Assistenza (`app/lib/schermate/diagnostica.dart`):

| cosa | dove finisce |
|---|---|
| Plancia leggera: ferma le animazioni infinite e le sfocature | sul dispositivo |
| Composizione ibrida: su Android il riquadro lo compone il sistema | sul dispositivo |

Il tema, la tavolozza e la barra **non sono qui**: sono tre tessere della
pagina Configurazione della dashboard, che le tratta già come scelte del
dispositivo. Erano rifatte in una schermata dell'app, «L'app», e quella
schermata è stata cancellata: restavano due interruttori, e stanno meglio
accanto ai fotogrammi.

E il resto dell'app, che con la Config non c'entra: i dispositivi, gli
acquisti, le segnalazioni, l'assistenza, «Come va l'app», l'elenco delle case.

## Cosa se n'è andato

Trentatremila righe: ventisei schermate in Flutter, ventisette file di
modello che rifacevano quello della plancia, e le loro prove — comprese
quelle che tenevano onesto il conto delle chiavi. Non servono più: non c'è un
conto da tenere onesto, perché non c'è una seconda Config che possa restare
indietro. Se la dashboard aggiunge una casella, quella casella nell'app c'è
il giorno in cui il ponte porta la plancia nuova.

Restano nel ponte le cose che la plancia 1.4.18 chiede al suo backend, e che
in un add-on senza integrazione nessuno le darebbe:

- lo spegnimento programmato del clima
  (`dashboardmodern/clima/timer/list|set|clear`): il conto alla rovescia lo
  tiene il ponte, sul disco, e non il telefono;
- il catalogo delle integrazioni, anche per nome di entità
  (`entity_ids`), che serve alle macchine e alla rete;
- la configurazione stessa (`config/get|set|restore`), che è dove la Config
  scrive e da dove ogni telefono la rilegge.

## Le due cose che un WebView non ha di suo

Una pagina dentro un WebView non e' una pagina dentro un browser, e due cose
della Config gliele si sono dovute dare:

- **le foto.** La Config le carica con una casella `<input type="file">`, e su
  Android un WebView non apre nessuna finestra: si toccava «scegli una foto» e
  non succedeva niente. Adesso apre la galleria del telefono
  (`setOnShowFileSelector`, in `app/lib/schermate/riquadro/sul_telefono.dart`)
  e il file torna alla pagina come se l'avesse scelto un browser. Sull'iPhone
  il WebView ce l'ha di suo.
- **il WebSocket.** Non e' della Config, e' di tutta la plancia: la pagina
  crede di parlare con Home Assistant, e parla col filo dell'app. Sta in
  `app/lib/plancia/cucitura.dart` da prima di questa storia.

## Come si controlla che sia davvero la sua

Il collaudo apre la voce del menu, aspetta `#editor-modal` **dentro il
riquadro della plancia** e fotografa quello che c'è: se un giorno comparisse
una schermata nostra, la foto lo direbbe subito. Poi passa da una scheda
all'altra chiamando `editorSwitch`, che è la funzione della dashboard — non
esiste nulla di nostro da chiamare.

    cd app && flutter build web --release --pwa-strategy=none \
      --dart-define=COLLAUDO=true
    cd collaudo && node guarda.mjs
