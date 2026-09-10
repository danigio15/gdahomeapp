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
(`app/lib/plancia/servitore.dart`). La sua Config è dentro di lei, ed è
`apriConfigEntita()`: il riquadro sopra la pagina, con le sue schede, il suo
cercatore di entità, le sue pastiglie, i suoi interruttori «nel widget».

Di quella Config, l'app sposta **la porta e non la stanza**:

- dalla barra in fondo alla plancia la voce sparisce — su un telefono quella
  fila di schede non ci sta, ed è la ragione per cui la porta si spostava;
- nel menu dell'app c'è «Configurazione», e apre lei
  (`Premesse.laConfigFuoriDallaPlancia` mette la maniglia nella pagina,
  `PlanciaVeraState.apriLaConfig` la tira);
- chiudendola si torna alla plancia, che non si è mai ricaricata.

Non si tocca un file della dashboard: si aggiunge una riga alla **pagina
servita**, come per il tema e le misure delle barre del telefono. Il ponte
ricontrolla i file uno per uno, e una plancia con un file cambiato si
direbbe modificata.

## Cosa l'app tiene di suo

Le poche scelte che sono di **questo dispositivo** e non della casa: non
viaggiano al ponte, e nella Config della casa non avrebbero senso — il tablet
in cucina può stare sullo scuro e il telefono in tasca no. Stanno nella voce
«L'app» (`app/lib/schermate/questo_telefono.dart`):

| cosa | dove finisce |
|---|---|
| Il tema del riquadro: come il telefono, chiaro, scuro | sul dispositivo |
| La tavolozza (`cd_tavolozza`, e `cd_theme` con lei) | sul dispositivo |
| La barra della plancia: a scomparsa o sempre visibile | sul dispositivo |
| Plancia leggera, composizione ibrida | sul dispositivo |

E il resto dell'app, che con la Config non c'entra: i dispositivi, gli
acquisti, le segnalazioni, l'assistenza, «Come va l'app», l'elenco delle case.

## Cosa se n'è andato

Trentatremila righe: ventisei schermate in Flutter, ventisette file di
modello che rifacevano quello della plancia, e le loro prove — comprese
quelle che tenevano onesto il conto delle chiavi. Non servono più: non c'è un
conto da tenere onesto, perché non c'è una seconda Config che possa restare
indietro. Se la dashboard aggiunge una casella, quella casella nell'app c'è
il giorno in cui il ponte porta la plancia nuova.

Restano nel ponte le cose che la plancia 1.4.17 chiede al suo backend, e che
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
