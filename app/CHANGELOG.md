# Cosa cambia nell'app GdAHome

Le novità dell'app sul telefono (e del navigatore GdANav che ha dentro),
versione per versione. Da qui le prendono le release `app-v…` su GitHub.

**Dalla 1.19.19 l'app ha numero e note suoi**: l'add-on per Home Assistant ha
i suoi in `ponte/CHANGELOG.md`, ed è quello che Home Assistant fa vedere. Un
rilascio dell'app non fa comparire un aggiornamento dell'add-on, e al
contrario.

## 1.19.30

- **Salute su Android**: la variabilità del battito (HRV) e la frequenza del
  respiro da Health Connect arrivano con una prossima versione. Su iPhone ci
  sono già, e su Android si vedono quando arrivano da WHOOP collegato.
- **Android, le versioni di prima**: dentro ci sono anche le novità della
  1.19.28 e della 1.19.29, che su Android non erano arrivate nel negozio.

## 1.19.29

- **Le pagine che si aprono**: aprendo Premium o un'altra pagina, non si vede
  più la pagina di prima attraverso quella nuova mentre arriva.
- **Navigatore, vista «Corsie»**: non compaiono più strade e sopraelevate che
  non esistono (strade private, viadotti in costruzione), le gallerie stanno
  sotto le strade, e incroci e zebrature restano dentro l'asfalto.

## 1.19.28

- **Salute, i dati del WHOOP**: quello che l'app WHOOP scrive in Apple Salute
  o in Health Connect arriva anche in GdAHome, con la scritta «da WHOOP»:
  sonno, battito, battito a riposo e ossigeno.
- **Salute, misure nuove**: la variabilità del battito (HRV) e la frequenza
  del respiro; su iPhone anche la temperatura del polso durante il sonno.
- **Salute dopo aver ricollegato il telefono**: le misure partono subito,
  senza aspettare il quarto d'ora.

## 1.19.27

- **Navigatore, vista «Corsie» sotto i cavalcavia**: il ponte che passa
  sopra l'auto resta visibile in trasparenza, invece di sparire tagliato di
  netto.
- **Navigatore, i rettilinei prima di un ponte**: il percorso resta pieno e
  la freccia arancione, senza diventare tratteggiato come se qualcosa li
  coprisse.
- **Navigatore, le ferrovie**: i binari sollevati poggiano su un rilevato,
  non restano sospesi nel vuoto.
- **Navigatore, il riquadro della manovra**: senza la sfocatura sopra la
  mappa, che su Android rallentava la guida.

## 1.19.26

- **Novità**: dopo ogni aggiornamento l'app mostra una volta cosa è
  cambiato, e le note di tutte le versioni si ritrovano in Impostazioni app
  › «Novità».
- **Collegare la casa dallo stesso telefono**: nella pagina «Collega l'app»
  di Home Assistant, aperta dal telefono da collegare, «Apri GdAHome su
  questo telefono» apre l'app che chiede «Collegare questa casa?»; vale anche
  per riabbinare un telefono con l'app rimessa.
- **Navigatore, il riquadro della manovra**: lontano dalla svolta diventa una
  riga sola su un fondo di vetro, e torna grande avvicinandosi; dal menu
  «Dimensione indicazioni» si può tenere sempre grande.

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
