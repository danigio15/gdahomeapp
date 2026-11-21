# Cosa cambia nell'app GdAHome

Le novità dell'app sul telefono (e del navigatore GdANav che ha dentro),
versione per versione. Da qui le prendono le release `app-v…` su GitHub.

**Dalla 1.19.19 l'app ha numero e note suoi**: l'add-on per Home Assistant ha
i suoi in `ponte/CHANGELOG.md`, ed è quello che Home Assistant fa vedere. Un
rilascio dell'app non fa comparire un aggiornamento dell'add-on, e al
contrario.

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
