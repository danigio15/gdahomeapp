# Gli scatti di stanotte

Non mockup: sono `legacy/dashboard.html` **servita davvero**, guidata con
Chromium a 412 px (un telefono), con una casa finta dentro e la configurazione
scritta nel deposito come la scrive la plancia.

## `dispositivi-non-connessi.png`

La casa finta ha, apposta, i casi che contano:

- **Asciugatrice** e **Lavastoviglie** rispondono, e di ognuna tace la sola
  serratura bambini. Nell'elenco **non compaiono**, ed è la regola del ponte:
  un dispositivo è giù solo se tacciono tutte le sue entità.
- **Ripetitore giardino** tace tutto: una riga sola, col suo nome, «2 entità ·
  da 31 h», e il cestino.
- **Vacanza** è un `input_boolean`: un dispositivo non ce l'ha, quindi resta una
  riga per conto suo, col suo identificativo scritto sotto.
- **Presa albero di Natale** era già stata tolta col cestino: sta sotto «Tolti
  dall'avviso», e adesso ha il **campanello** che la rimette.

## `report-prima-e-dopo.png`

La stessa testata di Energia in quattro momenti: sopra la 1.6.0.6, sotto
adesso; a sinistra appena aperta, a destra coi dati arrivati. La riga colorata
segna dove finisce il riquadro.

- **prima**: 79 px → 99 px, **salta di 20 px** quando arrivano le pastiglie
- **dopo**: 99 px → 99 px, **ferma**

I singoli scatti stanno accanto, se servono interi.

## `mappa-zigbee-chiara.png` / `mappa-zigbee-scura.png`

La mappa della rete Zigbee, disegnata dal ponte e mostrata dall'app con
`flutter_svg`: **un disegno solo** invece di uno in Dart e uno in JavaScript
che il giorno che cambiano dicono cose diverse. Accanto ci sono gli `.svg`,
che sono quello che viaggia davvero.

La rete finta è fatta apposta coi casi che contano: un'antenna, quattro
ripetitori a corrente, nove cose a batteria, **un ramo debole** (il garage,
LQI 35 — tratteggiato e pallido) e **due che non parlano con nessuno**, che
stanno in una fascia a parte con scritto perché.

- al centro l'antenna, intorno i ripetitori, fuori chi sta in fondo a un ramo:
  è la forma che una rete Zigbee **ha**, non una disposizione scelta
- un terminale si mette all'angolo del ripetitore con cui parla, e se ne parla
  con più d'uno a quello che sente meglio: il filo è corto e si vede a colpo
  d'occhio quale ramo regge quale pezzo di casa
- lo spessore e il tratteggio dicono la qualità; un collegamento si conta una
  volta sola, con la misura **peggiore** dei due versi, perché un filo vale
  quanto il suo verso più debole
- 🔋 accanto al nome: va a batteria

I pallini sono **disegni veri**: i 124 del catalogo della plancia, gli stessi
delle tessere e delle schede. Il disegno dice *che cosa è* quell'apparecchio,
l'anello colorato *che mestiere fa* nella rete — due domande diverse, e chi
apre la mappa le fa tutte e due.

Quale disegno tocca a chi si sceglie dal nome, che è imperfetto e si sa:
«Fumo cucina» becca il rilevatore, «Coso 3» no e prende il neutro del suo
mestiere. La strada giusta è un'altra e sta segnata nel codice — le classi che
Home Assistant dà alle entità (`device_class: smoke`), che sono un fatto e non
una parola scelta.
