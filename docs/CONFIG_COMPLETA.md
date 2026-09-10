# La Config vera: cosa c'è, e cosa nell'app manca

Documento di verità, non di intenzioni. Serve a rispondere a una domanda sola:
**quanto manca perché la Configurazione dell'app sia quella della dashboard?**

La risposta breve, oggi: poco, e quel poco è scritto in fondo. Quando questo
documento è nato la risposta era «molto» — c'era l'alberatura e un editor
generico sopra le chiavi più semplici — e le parti che dicevano cosa mancava
sono rimaste dove stanno, riscritte man mano che quelle cose venivano fatte.
Si misura, non si stima: ogni numero qui sotto ha una prova che lo tiene.

## I numeri, contati

| | quante |
|---|---|
| Chiavi che la dashboard 1.4.17 sincronizza (`core/chiavi-di-configurazione.js`, revisione 41) | **103** (100 `cd_` più tre `dm_`) |
| Chiavi che la Configurazione dell'app sa leggere e scrivere | **101** (tutte le `cd_` più `dm_campi_scelti`; `dm_dashboard_state` e `dm_schema_version` sono del runtime) |
| Moduli della plancia che sono editor o pezzi di editor (`src/sections/*editor*`, `*integraz*`) | **38** |
| Righe dei moduli della plancia | ~110.000 |

Non è una stima: le 103 chiavi sono estratte dal file che le elenca, e le 101
sono un **elenco scritto a mano** in `app/test/chiavi_della_config_test.dart`,
e scritto a mano lo è apposta. Il conto lo si faceva frugando nei sorgenti:
bastava dichiarare quaranta costanti in un file di modello — nomi e basta,
senza una schermata dietro — e il numero saltava da quarantadue a ottantatré in
un pomeriggio, senza che nessuno potesse configurare niente di più. Adesso ogni
chiave che entra nel conto è una riga che qualcuno ha aggiunto sapendo cosa
stava dicendo, e una prova controlla che non sia una promessa: una chiave
elencata deve comparire nei sorgenti, o l'elenco cade.

### Cosa vuol dire «sa leggere e scrivere»

Che una schermata dell'app la apre, la mostra e la salva. **Non** che la
schermata sia bella come quella della dashboard, né che copra ogni angolo di
quella chiave: cinque delle cento — i ritratti, i dati in più dell'auto e
della continuità, i dispositivi di una volta — sono mappe che l'app fa vedere e
modificare riga per riga, dove la dashboard ha una maschera fatta apposta.
Sono chiavi che quasi nessuno tocca, e averle visibili è meglio che averle
invisibili; ma dire «uguale» lì sarebbe dire una cosa non vera.

Le altre novantacinque hanno la loro schermata, col cercatore di entità, il
catalogo delle integrazioni e le foto dove servono.

## Il difetto strutturale, risolto: la dashboard tiene *più* di tutto

Era il punto che contava più del conteggio, perché non si risolveva aggiungendo
schermate: si risolveva cambiando il modello. È stato cambiato — sotto c'è
com'era, e in fondo com'è adesso.

La dashboard non ha **una** auto, **un** impianto solare, **una** centrale
d'allarme. Ne tiene un elenco, più la chiave che dice **qual è quella scelta**:

| cosa | l'elenco | quale è scelta |
|---|---|---|
| Auto elettriche | `cd_ev_cars` | `cd_ev_car_active` |
| Impianti solari termici | `cd_solari` | `cd_solare_scelto` |
| Centrali d'allarme | `cd_centrali` | `cd_centrale_scelta` |
| Scaldabagni | `cd_scaldabagni` | — |
| Impianti termici | `cd_impianti_termici` | — |
| UPS / continuità | `cd_ups` | `cd_ups_meta` |

E ognuna di quelle voci non è «un nome e un'entità»: un'auto ha nome, marca,
modello, **la sua mappatura di entità** (`dm.ev_*`, dentro il profilo) e **due
foto** (`cd_ev_visual`, `cd_ev_image`, `cd_ev_image_plugged`).

L'editor a elenco della prima versione sapeva fare «un nome e qualche campo», e
ogni schermata costruita su quel modello era lavoro da rifare. Rifatto:
`app/lib/casa/plancia/piu_di_uno.dart` tiene l'elenco, la scelta, la mappatura
di entità e le foto dentro ogni voce, per tutte e sei le famiglie.

## Il difetto che resta: due modelli, e l'app conosce quello vecchio

I moduli della plancia leggono da un **modello canonico**
(`dm_dashboard_state.sections`), con `SECTION_KEYS` che lo aggancia alle chiavi
storiche (`rooms → cd_stanze`, `ev → cd_ev_cars`, `loads → cd_loads`…) e
`normalizeSection` in `core/migrations.js` che normalizza — identificativi
stabili, ordine, campi conservati.

L'app scrive **solo** le chiavi storiche. Oggi in gran parte funziona, perché le
sezioni leggono prima la chiave storica e poi il canonico
(`legacy.length ? legacy : canonicalProfiles()`), ma:

- non vale per le sezioni che leggono solo il canonico;
- non passa da `normalizeSection`, quindi l'app può scrivere una forma che la
  dashboard normalizzerebbe diversamente (un id mancante, un ordine, una
  collisione fra due stanze con lo stesso nome).

**Va deciso prima di scrivere altre schermate**, perché riguarda tutte.

## Cosa c'è, per famiglia

Tutte e cento le chiavi `cd_` hanno la loro schermata: la prova che le conta è
`app/test/chiavi_della_config_test.dart`, e una chiave elencata lì deve
comparire nei sorgenti o l'elenco cade. Le famiglie sono le sette di
`core/alberatura-del-config.js` — Plancia, Energia, Clima e acqua, Casa,
Sicurezza, Avvisi, Macchine e rete — con le trentaquattro schede della
plancia, e una prova (`configurazione_test.dart`) che le rilegge da quel file. Quello che resta più magro della
dashboard sono le cinque mappe dette qui sopra — i ritratti, i dati in più
dell'auto e della continuità, i dispositivi di una volta — che l'app fa vedere
riga per riga dove la dashboard ha una maschera fatta apposta.

## Le caselle: tutte e centodue

Oltre alle chiavi, la Config della dashboard ha le **caselle**: `CD_SLOTS`,
sette gruppi, centodue domande a cui si risponde con un'entità di Home
Assistant, e la risposta finisce in `cd_entity_overrides`.

| gruppo | quante | dove sta nell'app |
|---|---|---|
| 🏠 Home | 9 | «Home» |
| ⚡ Energia | 36 | «Le caselle dell'Energia» |
| 🚗 Auto elettrica | 17 | dentro il profilo di ogni auto |
| 🌞 Solare termico | 13 | dentro il profilo di ogni impianto |
| 🛡️ Sicurezza | 1 | «Sicurezza» |
| 🧺 Lavatrice | 12 | «Le entità della lavatrice» |
| 🖥️ MiniPC | 14 | «MiniPC» |

Due gruppi ci sono arrivati tardi, e vale la pena dire perché: l'Energia e la
lavatrice non si potevano riempire per niente, e non si vedeva. Il menu era
pieno, «Energia» c'era, e chi la apriva trovava il **modello** — che ne copre
ventiquattro su trentasei. Le altre dodici — i condizionatori, il boiler, i
carichi dei nodi, lo stato della rete — non stanno in `ENERGY_SLOT_MAP`, e
quindi non stavano da nessuna parte. Nel browser bastava aprire l'accordion
«⚡ Energia».

Adesso il conto lo tiene `app/test/caselle_test.dart`: se la plancia aggiunge
un gruppo, o se qualcuno stacca una voce, la prova cade.

E il **nome** di ogni casella si riscrive, come là: nella plancia l'etichetta è
un campo di testo sopra ogni riga e finisce in `cd_slot_labels`. Chi ha due
tetti chiama «Potenza tetto sud» quella che di serie è «Potenza fotovoltaico
(W)»; se dall'app la ritrovasse col nome vecchio, le due configurazioni
parlerebbero di due case diverse.

## Il multi-istanza, le integrazioni e le foto: fatti

Erano i tre pezzi che questo documento dava per mancanti, ed è la parte che è
invecchiata di più. Restano scritti perché il *perché* vale ancora.

- **Il multi-istanza.** `app/lib/casa/plancia/piu_di_uno.dart`: elenco più
  «qual è scelta», per tutte e sei le famiglie — auto, impianti solari,
  centrali d'allarme, scaldabagni, impianti termici, continuità — più le
  vasche della piscina, che hanno una forma loro (`casa/plancia/vasche.dart`). La mappatura
  di entità e le foto stanno **dentro** la voce, che era il punto: un'auto non
  è «un nome e un'entità».
- **Le integrazioni.** Il menu a tre passi sul catalogo del ponte c'è
  (`app/lib/schermate/configurazione/integrazioni.dart`), e sotto c'è il motore
  che riempie le caselle da solo (`app/lib/casa/plancia/legame.dart`): è il
  porto fedele di `core/appliance-device-binding.js`, con i suoi tredici ruoli
  e i suoi punteggi. Non c'è più niente da battere a mano.
- **Le foto.** `www/list` e `www/upload` li usa l'app
  (`app/lib/schermate/configurazione/le_foto.dart`), e si sfoglia anche quello
  che sta già in `config/www` di Home Assistant, in sola lettura.

## Il controllo campo per campo, e cosa ne è uscito

Le chiavi c'erano tutte e le caselle anche, e non bastava: **dentro** una
chiave ci sono i campi, e lì la Config dell'app era più corta di quella della
dashboard senza che si vedesse da nessuna parte.

Il controllo è meccanico e sta in `app/test/stessa_config_test.dart`: legge gli
editor veri della plancia (`ponte/plancia/src/sections/*.js`), tira fuori il
nome di ogni casella che salvano, e cade se un nome non compare nei sorgenti
dell'app. Fa anche il contrario, che è il difetto peggiore dei due.

**Due caselle finivano in un posto che nessuno legge.** Si riempivano, si
salvavano senza un errore, e non facevano niente:

| nell'app era | la plancia legge | cosa non succedeva |
|---|---|---|
| `contact_out`, «Contatto della zanzariera» | `inferriata` | il secondo contatto della finestra non contava |
| `min` sulla zona d'irrigazione | `mins` | la zona restava ai dieci minuti di serie |

La prima non era nemmeno la stessa cosa: `INFERRIATA_KEYS` sono `inferriata`,
`inferriata_entity`, `grate_entity`, `outer_contact`, e l'inferriata è quella
che sta davanti al vetro e si apre di lato — non una zanzariera. Il numero già
battuto in `min` non si perde: la casella giusta lo legge e al primo
salvataggio lo sposta.

**E ventidue campi non c'erano.** Per sezione:

- **Finestre** — `kind` (tapparella, tenda, tenda da sole), `inferriata`,
  `down` (il relè che la fa scendere, per i motori a due fili),
  `tenda` + `tendaDown`, `tendaSole` + `tendaSoleDown` (sulla stessa finestra
  ci stanno insieme fino a tre coperture), `preset` (la posizione preferita),
  `umidita` (la soglia di questa finestra: il bagno non è la camera).
- **Irrigazione** — `weatherEnt`, e tutta **l'umidità del terreno**:
  `soilEnt`, `soilMin`, `soilMax`, `soilSkipAbove`, `soilStartBelow`. Non è un
  dettaglio: col terreno già bagnato il programma delle ore fisse *salta*, e
  sotto la soglia bassa parte da solo. Chi configurava dall'app aveva
  l'irrigazione che andava lo stesso sul bagnato. Più `room` sulla zona.
- **Piscina** — `lightEnt` (la luce della vasca), `clMin` e `clMax` (la banda
  del cloro, che c'era per il pH e non per lui), e **le vasche sono più
  d'una**: `casa/plancia/vasche.dart` è il porto di `pool-model.js`, con la
  fila di pastiglie come l'Energia.
- **Azioni rapide** — `type`. Erano otto tipi e l'app ne faceva tre: mancavano
  i quattro popup (luci scelte, tutte le luci, Clima, Antifurto, Lavatrice) e
  con loro `lights`, le luci che ci vanno dentro. Più `confirm`, il «sei
  sicuro?» prima di eseguire — che su un bottone che apre il cancello vale più
  di tutto il resto.
- **Prese** — `bloccata`: «si vede ma non si comanda», per il frigo, il modem,
  il congelatore.
- **Stanze** — `temp_name` e `hum_name`: come si chiamano quei due sensori
  sulla tessera. Senza, la sonda fuori dalla finestra si chiamava
  «Temperatura» come tutte le altre.

### Il secondo giro: la forma, non solo i campi

I campi non bastavano. Una chiave può tenere un **elenco** o un **oggetto**, e
sbagliare quello è peggio di una casella mancante: la casella mancante non
c'era, la forma sbagliata cancella quello che c'era.

- **`cd_impianti_termici`** sembrava una famiglia come le auto e non lo è: tiene
  **tre sì/no** — «cosa c'è nel locale caldaia»: solare, scaldabagno, caldaia —
  e la pagina Gestione termica mostra solo quelli spuntati. L'app ci scriveva un
  elenco di profili con dentro delle entità, e `normalizzaScelta` scarta un
  Array: la scelta fatta dal browser **spariva al primo salvataggio dall'app**.
  Adesso sono tre interruttori, come là.
- **`cd_fumo_rilevato`** è il contrario: un elenco dei rilevatori che hanno già
  suonato, letto dall'app come mappa. Risultava sempre vuoto — «nessun
  rilevatore ha suonato» anche col registro pieno — e «Ho letto» ci scriveva un
  oggetto dove va un elenco.

E due sezioni erano ferme a metà:

- **Robot** — c'erano nome, entità e stanza. Mancavano la sua mappa, la batteria
  quando sta in un sensore a parte (i tagliaerba la pubblicano così), e i suoi
  **tasti**, fino a dodici: «le varie entità del robot continuano a non essere
  visibili, da solo la modalità aspirazione».
- **Quadro avvisi** — un avviso nella dashboard guarda **più entità insieme** e
  ha **sei condizioni** (accesa, spenta, uguale a, diversa da, maggiore,
  minore). L'app ne faceva una sola, la prima, e su una entità sola: «temperatura
  sopra 30» o «termostato in heat» dall'app non si potevano fare.

### Il terzo giro: le caselle contro il loro modello

Il controllo «la parola compare da qualche parte nella plancia» era un pavimento
troppo basso, e si è visto. `temp`, `battery`, `load`, `status` compaiono tutte
— in altri file, per altre cose — e intanto:

| nell'app era | la plancia legge | dove |
|---|---|---|
| `temp` | `temperatura` | uno scaldabagno |
| `battery` | `batteria` | un gruppo di continuità |
| `load` | `carico` | un gruppo di continuità |
| `status` | `stato` | un gruppo di continuità |
| `entity` sciolto | `caselle['dm.security_centrale_allarme']` | una centrale d'allarme |

Cinque caselle che si riempivano, si salvavano, e lasciavano la scheda vuota.
Adesso ogni scheda si controlla contro **il file che ne dichiara la forma**
(`scaldabagno-model.js`, `ups-model.js`, `robot-model.js`…), col nome intero e
non come sottostringa — cercando `temp` dentro `.temperatura` la prova che
doveva accorgersene passava contenta.

Con i nomi giusti sono arrivati anche i campi che mancavano:

- **Scaldabagni** — erano due, sono nove: l'entità `water_heater`,
  l'interruttore per chi lo comanda a relè, temperatura, obiettivo, potenza,
  energia, il bagno in cui sta.
- **Continuità** — erano tre, sono nove: stato, rete, batteria, carico,
  autonomia, tensione, potenza, temperatura, più il verso della lettura.
- **Centrali d'allarme** — l'entità è passata nella sua casella dentro il
  profilo, dov'è nelle auto e negli impianti solari.

### Il quarto giro: le liste della Home parlavano la lingua sbagliata

`SchermataDiVoci` serve **sei liste** con una schermata sola — lettori,
calendari, liste di cose da fare, entità in evidenza, entità mie, sezioni mie —
e scriveva sempre `nome` e `icona`. Le sei però non le chiamano allo stesso
modo:

| lista | il modello legge | andava? |
|---|---|---|
| Lettori e casse | `nome \|\| name`, `icona \|\| icon` | sì |
| Le entità mie | `nome \|\| name` | sì |
| Le sezioni mie | `nome ?? name` | sì |
| **I calendari** | `name` | **no** |
| **Le liste di cose da fare** | `name` | **no** |
| **In evidenza** | `name`, `icon` | **no** |

Il nome dato a un calendario o a una lista si salvava e non lo vedeva nessuno:
la plancia continuava a mostrare quello che l'entità ha in Home Assistant. Ora
ogni lista dichiara la lingua delle sue due caselle, e in lettura si accettano
tutti e due i nomi — quello che era già scritto si ritrova al suo posto.

Con loro:

- **Lettori e casse** — mancava la **stanza**, che nella pagina Media serve a
  raggruppare gli altoparlanti.
- **Porte da sorvegliare** — mancava il **disegno**: era fisso a 🚪, e il
  cancello e il portone del garage si somigliavano tutti.

Controllati e già uguali: la raccolta (la dashboard non fa scegliere icona e
colore, li ricalcola dal materiale), il PIN di una porta, i calendari col loro
colore, le sezioni mie, le entità mie.

**Una cosa che non viaggiava, e non era colpa dell'app**: `cd_radar_meteo` —
la posizione, il raggio e il servizio del radar pioggia — fino alla 1.4.16 la
plancia la scriveva e la rileggeva da `localStorage`, fuori dalle chiavi che
sincronizza: chi configurava il radar sul tablet non se lo ritrovava sul
telefono. Dalla 1.4.17 sta nell'elenco (`CONFIG_KEYS`), arriva al ponte, e
l'app ha la sua voce, «Il radar meteo».

### Il quinto giro: la barra della plancia, e cosa mostra una tessera

- **Le sezioni erano otto, nella plancia sono dodici.** `cdNavVisMap()` è la
  mappa che decide quale tasto della barra sparisce quando in `cd_sections` c'è
  scritto `false`, e ne elenca dodici. L'app ne mostrava otto: gli
  **elettrodomestici**, le **finestre**, l'**irrigazione** e la **piscina** si
  toglievano dalla barra dal browser e non dall'app. Chi la piscina non ce l'ha
  si teneva il suo tasto.
- **«Cosa mostra» una tessera che riassume.** `cd_widgets.sorgenti`: la tessera
  Temperatura senza scelta dice la media di tutte le stanze, e si può dire
  «mostrami quella della cucina»; il Clima uguale, con le sue unità. Il modello
  dell'app la chiave la leggeva e la scriveva già — mancava la tendina che la
  riempie.

- **Tre schermate esistevano e non si potevano aprire.** «Le tessere della
  Home» (`cd_widgets`), «L'ordine della Home» (`cd_home_blocchi`) e «In
  evidenza» (`cd_evidenza`) erano instradate in `voci.dart` e non c'erano
  nell'alberatura: il codice c'era tutto, dal menu non ci si arrivava in nessun
  modo. Ed è il difetto che spiega perché il conto delle chiavi non basta —
  quelle tre risultavano coperte perché il loro nome compariva nei sorgenti:
  compariva **dentro la schermata che nessuno poteva aprire**.

Tre campanelli nuovi: uno legge `cdNavVisMap` dal runtime e confronta le due
liste di sezioni nei due versi; uno controlla che ogni schermata instradata
abbia la sua voce nel menu (il contrario si può: una voce senza `case` è una
schermata dell'app, che il menu apre per conto suo).

### Il sesto giro: la chiave dichiarata e mai usata

`cd_report_devices` — le righe che si scelgono nel Report Analisi
dell'Energia — era dichiarata in `casa/plancia/home.dart` e **nessuna
schermata la apriva**. Il conto delle chiavi la dava per coperta perché il suo
nome nei sorgenti compariva: compariva nella riga che lo dichiara.

Ed è precisamente il difetto contro cui il commento di quella prova metteva in
guardia — «bastava dichiarare quaranta costanti in un file di modello, nomi e
basta, senza una schermata dietro». Succedeva su una chiave, e la prova non se
ne accorgeva. Adesso una chiave deve comparire **fuori** dalla riga che la
dichiara, e l'ho verificato togliendo la schermata per vedere il campanello
suonare.

Controllati in questo giro e già uguali: le allerte meteo (sei categorie con le
loro caselle in più — magnitudo e distanza dei terremoti, distanza dei
fulmini), i carichi e i nodi dell'energia, i sottocarichi, gli impianti, le
persone, le prese, le luci, il clima rapido, i piani, le entità delle stanze,
i sensori girati, le soglie di casa, il costo del kWh e il prezzo di
immissione.

### Il settimo giro: la plancia dalla 1.4.11 alla 1.4.17

Novantotto commit, e la Config della plancia cambiata in tre modi: un'alberatura
a sette famiglie al posto della fila di linguette, diciassette chiavi nuove
(`cd_animali`, `cd_varchi`, `cd_presenza`, `cd_macchine`, `cd_batterie`,
`cd_vmc`, `cd_assist`, `cd_barra_casa`, `cd_radar_meteo`, `cd_grafico_stanze`,
`cd_antifurto_su_misura`, `cd_batteria_verso`, `cd_ev_motore`, `cd_flusso_home`,
`cd_lingua`, `cd_orologio`, `cd_allag_rilevato`, più `dm_campi_scelti` come
segno dentro i carichi), e gli editor di prima con caselle in più. Tutto questo
è nell'app, e ognuno con la sua prova contro il sorgente della plancia:

- **le schermate nuove**, una per chiave — gli animali con le sedici caselle e
  le sette azioni di `animali-model.js`, i varchi e la presenza come correzioni
  di quello che Home Assistant dichiara, le macchine e la rete per
  integrazione, le batterie con la soglia, la ventilazione a quattro macchine,
  Assist, la riga sotto il meteo, il radar, il grafico delle temperature con
  le serie spente, i tasti su misura dell'antifurto, il verso della batteria,
  il motore dell'auto, la lingua e l'orologio nei Generali, la tavolozza;
- **gli editor cambiati**: le allerte a otto categorie con la qualità dell'aria
  (`cd_allerte.aria`, che la plancia stessa perde a un «Salva» qualunque e
  l'app invece tiene), le porte con «cosa fa il tocco» sulle serrature che
  sanno aprire, i calendari di una o più persone, il clima con la modalità, lo
  spegnimento automatico e i mesi (`unified-editors-section.js`), gli
  elettrodomestici coi comandi a parte e il setaccio delle entità, i carichi
  con la stanza, la raccolta a turni di due settimane, la caldaia con le otto
  caselle del pellet (`GRUPPO_PELLET`), l'irrigazione con gli altri orari
  (`cd_irrigazione.orari`, ora più minuti e soglia del terreno), il Report che
  dice riga per riga se l'entità è un contatore cumulativo
  (`isCumulativeEnergyEntity`), il motore che indovina con il televisore come
  stato e tasto e i dispositivi sotto **tutte** le loro integrazioni;
- **l'interruttore «Nel widget / Fuori»** di `widget-entity-choice-section.js`:
  in ogni scheda che parla di una tessera della Home, accanto all'entità c'è
  la parola in contrario, e si scrive in `cd_widgets.excluded` come
  `tessera|entità` — le regole sono quelle di `core/fuori-dai-widget.js`,
  portate in `casa/plancia/fuori.dart` con la prova che rilegge le tabelle
  delle tessere da quel file;
- **il ponte**: lo spegnimento programmato del clima
  (`dashboardmodern/clima/timer/list|set|clear`, tenuto dal ponte e non dal
  telefono) e il catalogo delle integrazioni chiesto per entità, che sono le
  due cose che la plancia 1.4.17 chiede al suo backend e che qui non c'erano.

### L'ottavo giro: l'auto e la colonnina da un'integrazione

Nella plancia «Auto elettrica» ha il menu delle integrazioni: si sceglie
l'integrazione, si sceglie il dispositivo, e la vettura nasce con le caselle
`dm.ev_*` già piene (`auto-integrazione-section.js`). Nell'app l'auto si
compilava a mano, casella per casella, col cercatore — mancava già alla 1.4.11.
Adesso c'è, ed è lo stesso motore: `casa/plancia/legame_auto.dart` è il porto
riga per riga di `core/auto-device-binding.js` (le domande nello stesso ordine,
i vocabolari nelle stesse lingue, la batteria di servizio anche in volt, il
cavo letto dall'auto prima dello stato della ricarica, il target comandabile
che vince sul sensore) e di `core/wallbox-device-binding.js` (le nove caselle
della colonnina, evcc con la modalità e il limite che si comanda, la regola
per cui il secondo dispositivo si aggiunge al primo e un comando scalza una
lettura). L'auto nata dal dispositivo va nel suo profilo, e se è la prima — o
quella in uso — versa le caselle nelle sostituzioni di casa come fa «Usa»,
tenendo da parte quelle della colonnina (`soloLaColonnina`). La colonnina e
evcc hanno la loro scheda sotto l'elenco delle auto, con le caselle che la casa
ha adesso e il tasto per collegarle. Le prove (`legame_auto_test.dart`)
passano una EV6 coreana con venti entità, una go-e e un evcc.

## Quello che resta davvero

1. **Il modello canonico.** L'app scrive solo le chiavi storiche, e non passa
   da `normalizeSection`. È il difetto descritto qui sopra, ed è l'unico dei
   tre «difetti strutturali» ancora aperto. Oggi funziona perché le sezioni
   leggono prima la chiave storica; il giorno che una sezione leggerà solo il
   canonico, si vedrà.
2. **Le cinque mappe.** `cd_ev_visual`, `cd_ev_meta`, `cd_ups_meta`,
   `cd_devices`, `cd_report_devices`: visibili e modificabili riga per riga,
   senza la maschera che hanno là. Sono chiavi che quasi nessuno tocca.
3. **Le icone `mdi:` delle stanze nelle azioni rapide**: la plancia 1.4.17 le
   accetta accanto agli emoji; l'app scrive ancora solo l'emoji.

## Come si tiene onesto questo conto

Tre prove, e nessun numero scritto a mano che non ne abbia una dietro:

- `app/test/chiavi_della_config_test.dart` conta le chiavi, controlla che
  quelle dichiarate compaiano davvero nei sorgenti, e che compaiano **fuori
  dalla riga che le dichiara** — una costante sola in fondo a un file di
  modello non passa più;
- `app/test/caselle_test.dart` controlla che nessun gruppo di `CD_SLOTS` resti
  senza una schermata che lo apra;
- `app/test/stessa_config_test.dart` controlla i **campi**, nei due versi — che
  nessuna casella degli editor della plancia resti fuori dall'app, e che nessuna
  casella dell'app finisca in un posto che nella plancia non legge nessuno — e
  la **forma** di ogni chiave, elenco contro oggetto, presa dal valore di
  ripiego che la plancia stessa passa a `readJson`; le caselle di ogni scheda
  contro il file che ne dichiara il modello; e la **lingua** delle due caselle
  di ogni lista della Home, guardando se quel modello legge `.nome` o `.name`;
- `app/test/configurazione_test.dart` controlla che l'alberatura copra tutte le
  schede della Config della plancia, e che famiglie e schede siano quelle di
  `alberatura-del-config.js`;
- `app/test/{animali,correzioni,vmc,scelte,caldo,orari,fuori}_test.dart`
  rileggono dai sorgenti della plancia le caselle degli animali, le classi dei
  varchi e della presenza, i campi della ventilazione, le lingue, le caselle
  della caldaia (`CASELLE_CALDAIA`), le tabelle delle tessere
  (`TESSERE_PER_SCHEDA`, `TESSERE_PER_BLOCCO`): se la plancia le cambia, la
  prova cade prima che se ne accorga qualcuno.
