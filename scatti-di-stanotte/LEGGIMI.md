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

## `zigbee-elenco-della-rete.png` e gli altri tre

Questi non sono il browser: sono **l'app**, disegnata da Flutter a 390×844 con
i caratteri veri, e non sono disegnati a mano — si apre la sezione Zigbee
contro un ponte finto e si preme dove preme una persona.

- **`zigbee-elenco-della-rete.png`** — sotto i tasti c'è chi c'è già, con
  quanti sono. Ogni riga: nome, marca e modello sotto, e la pila per chi va a
  batteria. Da qui si entra.
- **`zigbee-scheda-dispositivo.png`** — la scheda di uno: si rinomina, si
  manda nella plancia, si toglie dalla rete. «Sta in fondo a un ramo · va a
  batteria» e la targa, per riconoscerlo.
- **`zigbee-togli-dalla-rete.png`** — prima di togliere si dice **la parte che
  costa**: per rimetterlo lo si riabbina da qui. E di un ripetitore si dice
  anche che tiene su la rete per gli altri.
- **`zigbee-mappa-nell-app.png`** — la mappa, quella dei due `.svg` qui sopra,
  **dentro l'app**: si allarga con due dita e si rifà il giro.

### La mappa nell'app era vuota, e non si vedeva da qui

Gli `.svg` qui sopra sono sempre stati giusti, e nel browser si sono sempre
visti. Sul telefono no: i disegni erano un `<svg>` dentro l'altro — SVG valido,
che i browser disegnano — e `flutter_svg` gli `<svg>` annidati li **salta**.
Nell'app uscivano gli anelli colorati, i fili e i nomi, e dentro ogni anello il
vuoto: proprio le icone dei dispositivi, che sono il motivo per cui la mappa è
fatta così.

Nessuna prova se ne era accorta perché tutte guardavano il **testo** dell'SVG,
e il testo era giusto. Si è visto fotografando la schermata.

Adesso ogni disegno è un `<g>` spostato e ridotto, che disegnano tutti e due, e
una prova nuova conta **i pixel dentro gli anelli**: se torna una forma che sul
telefono non si disegna, diventa rossa.

*(Nello scatto la pila accanto ai nomi esce come un rettangolo vuoto: è
l'emoji, che nel carattere della prova non c'è. Sul telefono si vede.)*

## `sfondo-sfocatura-contro-sfumatura.png` e `velo-del-popup-la-scelta.png`

### La plancia andava a 15 fotogrammi al secondo, ferma

«La torre 3d va a scatti quando si clicca e non apre subito il popup storico»
(#125). Non era la torre e non era il clic: **ogni pagina** della plancia, con
nessuno che la tocca, stava a 15 fotogrammi al secondo. Il clic si notava
soltanto perché è il momento in cui uno si aspetta una risposta.

A mangiarsi tutto sono le due macchie di sfondo: larghe mezzo schermo, con un
`filter: blur(100px)` che il browser rifà in continuazione.

Misurato sulla plancia servita, col freno della CPU a sei:

| | al secondo | fotogramma peggiore |
|---|---|---|
| Home, prima | 18 | 67 ms |
| Home, dopo | **60** | 17 ms |
| MiniPC, prima | 15 | 167 ms |
| MiniPC, dopo | **59** | 50 ms |
| il clic sul prisma, prima | 17 fotogrammi in 1,5 s | 183 ms |
| il clic sul prisma, dopo | 39 | 133 ms |

Le cure che **non** curano, misurate: `will-change: transform` (c'era già, per
questo stesso motivo) lascia tutto com'era, e fermare l'animazione porta a 17.
Non è il movimento che costa, è la sfocatura.

`sfondo-sfocatura-contro-sfumatura.png` è il perché la cura non si vede: una
sfocatura di un cerchio pieno **è già** una sfumatura radiale, e scritta come
tale — con gli stop presi dalla curva di una gaussiana, non a occhio — le due
figure non si distinguono. A colore pieno, che è il caso peggiore; nella
plancia sono pastello al 50%.

### Quello che resta, ed è una scelta tua

`velo-del-popup-la-scelta.png`. Il velo dei popup ha un
`backdrop-filter: blur(20px)` su tutto lo schermo, e finché il popup è aperto
costa **metà dei fotogrammi**: 39 al secondo con, 87 senza. Il raggio non
c'entra — 12, 8 o 4 px costano uguale: è avere un `backdrop-filter`, non
quanto è grande.

Qui però la cura si vede, e non la decido io: a sinistra com'è adesso, dietro
non si legge niente; a destra col velo più coperto e senza sfocatura, dietro si
intravede. Sono due effetti diversi. Dimmi tu.
