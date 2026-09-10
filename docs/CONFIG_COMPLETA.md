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
| Chiavi che la dashboard sincronizza (`config-persistence-section.js`) | **83** (85 meno le due di servizio) |
| Chiavi che la Configurazione dell'app sa leggere e scrivere | **83** |
| Moduli della plancia che sono editor o pezzi di editor (`src/sections/*editor*`, `*integraz*`) | **30** |
| Righe dei moduli della plancia | ~91.000 |

Non è una stima: le 83 chiavi sono estratte dal file che le elenca, e le 83
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
quella chiave: cinque delle ottantatré — i ritratti, i dati in più dell'auto e
della continuità, i dispositivi di una volta — sono mappe che l'app fa vedere e
modificare riga per riga, dove la dashboard ha una maschera fatta apposta.
Sono chiavi che quasi nessuno tocca, e averle visibili è meglio che averle
invisibili; ma dire «uguale» lì sarebbe dire una cosa non vera.

Le altre settantotto hanno la loro schermata, col cercatore di entità, il
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

Tutte e ottantatré le chiavi hanno la loro schermata: la prova che le conta è
`app/test/chiavi_della_config_test.dart`, e una chiave elencata lì deve
comparire nei sorgenti o l'elenco cade. Quello che resta più magro della
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

## Quello che resta davvero

1. **Il modello canonico.** L'app scrive solo le chiavi storiche, e non passa
   da `normalizeSection`. È il difetto descritto qui sopra, ed è l'unico dei
   tre «difetti strutturali» ancora aperto. Oggi funziona perché le sezioni
   leggono prima la chiave storica; il giorno che una sezione leggerà solo il
   canonico, si vedrà.
2. **Le cinque mappe.** `cd_ev_visual`, `cd_ev_meta`, `cd_ups_meta`,
   `cd_devices`, `cd_report_devices`: visibili e modificabili riga per riga,
   senza la maschera che hanno là. Sono chiavi che quasi nessuno tocca.

## Come si tiene onesto questo conto

Tre prove, e nessun numero scritto a mano che non ne abbia una dietro:

- `app/test/chiavi_della_config_test.dart` conta le chiavi e controlla che
  quelle dichiarate compaiano davvero nei sorgenti;
- `app/test/caselle_test.dart` controlla che nessun gruppo di `CD_SLOTS` resti
  senza una schermata che lo apra;
- `app/test/stessa_config_test.dart` controlla i **campi**, nei due versi — che
  nessuna casella degli editor della plancia resti fuori dall'app, e che nessuna
  casella dell'app finisca in un posto che nella plancia non legge nessuno — e
  la **forma** di ogni chiave, elenco contro oggetto, presa dal valore di
  ripiego che la plancia stessa passa a `readJson`, e le caselle di ogni scheda
  contro il file che ne dichiara il modello;
- `app/test/configurazione_test.dart` controlla che l'alberatura copra tutte le
  schede della Config della plancia.
