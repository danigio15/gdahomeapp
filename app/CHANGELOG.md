# Cosa cambia nell'app GdAHome

Le novità dell'app sul telefono (e del navigatore GdANav che ha dentro),
versione per versione. Da qui le prendono le release `app-v…` su GitHub.

**Dalla 1.19.19 l'app ha numero e note suoi**: l'add-on per Home Assistant ha
i suoi in `ponte/CHANGELOG.md`, ed è quello che Home Assistant fa vedere. Un
rilascio dell'app non fa comparire un aggiornamento dell'add-on, e al
contrario.

## 1.19.25

- **Il benvenuto**: una pagina sola, con la scheda per collegarsi sullo
  stesso cielo della copertina e il bottone sempre in vista; inserendo il
  codice a mano non si chiede più l'indirizzo di casa.
- **Mac e iPhone**: l'app non si chiude più quando si chiude la finestra
  (sul Mac) mentre il navigatore o la plancia sono aperti.
- **Navigatore, «Voce di guida»**: dal menu si sceglie la voce che parla fra
  quelle italiane del telefono (ascoltandola prima), e anche volume e
  velocità, non più solo dall'auto.
- **Navigatore, vista «Corsie»**: col telefono in orizzontale il menu delle
  viste mostra tutte le voci, «Corsie» compresa.

## 1.19.24

- **Il benvenuto nuovo**: la prima schermata dopo il download ha una
  copertina con le schede che scorrono (la casa, l'energia, il navigatore, la
  sicurezza) e i passi esatti per collegare la casa da Home Assistant.
- **Premium**: la pagina degli abbonamenti ha una veste nuova.
- **Navigatore, vista «Corsie»**: agli svincoli con rampe affiancate la
  fascia verde resta sulla sua rampa, senza saltare sopra il parapetto su
  quella accanto; prima dei sottopassi segue la bretella invece di tagliare
  sul prato.

## 1.19.23

- **Navigatore, vista «Corsie»**: la fascia verde sta dentro la corsia, più
  stretta, e non finisce sulle righe né sul marciapiede, anche alla
  partenza.
- **Navigatore, svolte strette**: dove si gira stretti a destra la fascia gira
  all'incrocio, senza andare oltre e tornare indietro col nodo.
- **Navigatore, raccordi**: agli incroci a triangolo la fascia prende il
  raccordo come si guida, senza l'uncino «<».
- **Navigatore, sensi unici**: il controllo delle strade davanti lascia
  sempre disegnare lo schermo, e si ferma da solo dopo un numero fisso di
  pezzi.

## 1.19.22

- **Navigatore, sensi unici**: la linea del percorso si rimette sulla
  carreggiata giusta lungo tutto il percorso, subito, anche a chilometri di
  distanza e con la mappa spostata col dito, non solo arrivandoci vicino.
- **Navigatore, ferrovie**: ai passaggi a livello la strada resta a terra,
  senza un ponte che non c'è; dove la strada passa sopra i binari, i binari
  scendono sotto in trincea.
- **Navigatore, vista «Corsie»**: la fascia verde del percorso resta
  sull'asfalto e va liscia anche attorno alle isole e alle rotonde, senza
  zig-zag e senza denti.
- **Navigatore, assistenza**: nel menu, «Copia il percorso per
  l'assistenza» copia il percorso da mandarci quando la linea non va.
- **Campanello**: nella notifica di chi ha suonato la foto si vede subito.

## 1.19.21

- **Navigatore, la linea del percorso sulla strada giusta**: anche quando
  alla partenza il GPS non c'è ancora o le strade attorno arrivano tardi,
  la linea si rimette da sola sulla carreggiata giusta e non taglia più
  fra un ramo e l'altro degli incroci a triangolo.
- **Navigatore, la linea dove si guarda**: spostando la mappa col dito, la
  linea del percorso resta quella in 3D attaccata all'asfalto anche lontano
  dall'auto.
- **Navigatore, al semaforo**: fermi da qualche secondo, la freccia si
  porta dove l'auto è davvero invece di restare qualche metro indietro.
- **Navigatore, le rotonde**: nella vista «Corsie» la rotonda ha il suo
  anello e l'isola in mezzo, e le strade che arrivano si fermano al bordo
  invece di finirci dentro con linee e marciapiedi.

## 1.19.20

- **Navigatore, strade in 3D**: le curve sono arrotondate, senza spigoli, e
  nelle vie strette con le case a filo strada la strada si stringe invece di
  entrare nelle case.
- **Navigatore, viadotti e svincoli**: ponti e rampe stanno all'altezza di
  quello che scavalcano davvero, salgono e scendono senza scalini né salite
  impossibili, e agli svincoli e alle biforcazioni le carreggiate non
  entrano più una dentro l'altra. Le strade che si uniscono o corrono
  affiancate stanno alla stessa quota.
- **Navigatore, vista «Corsie» sui viadotti**: la telecamera segue la quota
  dell'auto e niente (ponti, piloni) si mette più fra la telecamera e
  l'auto; i piloni non stanno più sull'asfalto delle rampe di sotto; nei
  sottopassi la linea del percorso è tratteggiata; la zebratura c'è solo
  nel triangolo dove le strade si dividono; la linea del percorso e le
  corsie non fanno più salti.

## 1.19.19

- **Navigatore in auto, zoom e dito**: nella vista «Corsie» i tasti + e −
  funzionano anche da fermi (prima da fermi + non cambiava niente, e con −
  la vista finiva lontana e in alto); con la scena 3D la mappa si sposta
  col dito, e torna sull'auto da sola o con «Centra».
- **Navigatore, la freccia dov'è l'auto**: la freccia usa anche
  l'accelerometro del telefono, e sente le frenate e le ripartenze quando
  succedono invece che un secondo dopo col GPS. Al semaforo si ferma dove
  ci si ferma e non torna più indietro; andando sta sull'auto. Il telefono
  impara da solo com'è messo nel supporto con qualche frenata (se lo si
  sposta, reimpara). Nella diagnosi di Android Auto, «La freccia: frenate e
  ripartenze» dice se l'auto passa la sua velocità e se l'accelerometro è
  pronto.
- **Navigatore, rotonde**: entrando piano in una rotonda la freccia non
  salta più avanti sull'anello prima dell'auto.
- **Navigatore, viadotti e svincoli**: niente più linee bianche di
  traverso sulla carreggiata dove una rampa si stacca dal viadotto, né
  pareti in mezzo alle corsie o nella zebratura fra due rampe.
