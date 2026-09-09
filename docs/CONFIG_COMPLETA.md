# La Config vera: cosa c'è, e cosa nell'app manca

Documento di verità, non di intenzioni. Serve a rispondere a una domanda sola:
**quanto manca perché la Configurazione dell'app sia quella della dashboard?**

La risposta breve: molto. Quello che c'è oggi nell'app è l'**alberatura** con un
editor generico sopra le chiavi più semplici. La Config della dashboard è
un'altra cosa, e questo documento la misura invece di stimarla.

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

## Il difetto strutturale: la dashboard tiene *più* di tutto

È il punto che conta più del conteggio, perché non si risolve aggiungendo
schermate: si risolve cambiando il modello.

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

L'editor a elenco che ho scritto sa fare «un nome e qualche campo». Non sa fare
niente di tutto questo, e ogni schermata costruita su quel modello è lavoro da
rifare.

## Il secondo difetto: due modelli, e l'app conosce quello vecchio

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

## Cosa manca, per famiglia

Segnate `✅` le chiavi che l'app oggi sa davvero leggere e scrivere.

### La casa e le pagine
`cd_branding` ✅ · `cd_sections` ✅ · `cd_sections_manual` · `cd_navbar_order` ✅
· `cd_navbar_mode` ✅ · `cd_section_names` · `cd_sezioni_mie` · `cd_stanze` ✅ ·
`cd_stanze_entita` · `cd_floors` · `cd_floor_icons` · `cd_hidden_elements` ·
`cd_text_overrides` · `cd_slot_labels` · `cd_solo_lettura`

### La Home
`cd_widgets` · `cd_home_blocchi` · `cd_evidenza` · `cd_quick_actions` ✅ ·
`cd_avvisi_custom` ✅ · `cd_avvisi_icone` · `cd_avvisi_names_extra` ·
`cd_gruppi_extra` · `cd_gruppi_removed` · `cd_meteo_entita_proprie` ·
`cd_stati_invertiti` · `cd_todo` · `cd_calendari` · `cd_people` · `cd_rifiuti`

### L'energia — è la famiglia più grossa, e l'app non ne tocca una
`cd_energy_model` · `cd_energia_tessere` · `cd_energy_views` · `cd_loads` ·
`cd_flow_nodes` · `cd_subload_groups` · `cd_subloads_extra` ·
`cd_report_devices` · `cd_devices` · `cd_costo_kwh` · `cd_prezzo_immissione`

### L'auto elettrica
`cd_ev_cars` · `cd_ev_car_active` · `cd_ev_visual` · `cd_ev_meta` ·
`cd_entity_overrides` ✅ *(le caselle sì, i profili no)*

### Il caldo e il freddo
`cd_clima_units` ✅ · `cd_clima_rapido` · `cd_clima_rapido_unita` ·
`cd_clima_inverti_card` · `cd_impianti_termici` · `cd_caldaia` ·
`cd_termico_caldo` · `cd_scaldabagni` · `cd_solari` · `cd_solare_scelto` ·
`cd_umidita_soglia`

### Le cose di casa
`cd_luci` ✅ · `cd_luci_rooms` · `cd_luci_order` · `cd_luci_room_order` ·
`cd_prese` ✅ · `cd_tapparelle` ✅ · `cd_tapparelle_soglia` · `cd_appliances` ✅
*(nome e una entità: la vera ne vuole molte, più i programmi)* ·
`cd_lavatrice_programmi` · `cd_lavatrice_visual` · `cd_robot` ·
`cd_media_player` · `cd_piscina` ✅ · `cd_irrigazione` ✅ · `cd_cameras` ·
`cd_visual_prefer_image`

### La sicurezza
`cd_centrali` · `cd_centrale_scelta` · `cd_antifurto_modi` ·
`cd_security_doors` · `cd_porte_conferma` · `cd_allerte`

### Il resto
`cd_ups` · `cd_ups_meta` · `cd_entita_mie` · `cd_fumo_rilevato`

## Il terzo pezzo che manca del tutto: le integrazioni

Un elettrodomestico moderno arriva in Home Assistant da un'integrazione — hOn,
Home Connect, Miele, LG ThinQ — come **un dispositivo con dentro venti o trenta
entità**. La dashboard lo sceglie da un menu a tre passi: l'integrazione, il
dispositivo, e le sue entità si mappano da sole.

Nell'app non c'è, e si vede: per configurare l'auto elettrica bisogna battere
a mano diciassette identificativi.

Il pezzo difficile **c'è già ed è finito**: `ponte/src/catalogo.js` legge i
registri di Home Assistant e serve il menu con la stessa forma che aveva
l'integrazione, sotto `dashboardmodern/integrations/catalog`. Risponde con
`integrations` (dominio, nome, quanti dispositivi), `devices` (id, nome, marca,
modello, stanza, quante entità) e, chiedendo `device_ids`, le entità di quei
dispositivi con classe, unità e categoria.

**Manca solo il lato app: nessuno lo chiama.** È il pezzo col rapporto fra
valore e lavoro migliore di tutti.

Stessa cosa per le **foto**: `ponte/src/foto.js` serve già `www/list` e
`www/upload`, e l'app non li usa — per questo l'auto non ha la sua immagine.

## In che ordine va fatto

L'ordine non è per importanza: è perché ogni riga costruita sul modello
sbagliato è una riga da riscrivere.

1. **Il modello.** Decidere canonico contro storico, e portare
   `normalizeSection` (o la parte che serve) dalla parte dell'app. Senza
   questo, tutto il resto è provvisorio.
2. **Il multi-istanza.** Elenco + «qual è scelta», con la mappatura di entità
   e le foto dentro ogni voce. Sblocca auto, solari, centrali, scaldabagni,
   impianti termici, UPS in un colpo solo.
3. **Le integrazioni.** Il menu a tre passi sul catalogo del ponte. È quello
   che toglie di mezzo il battere a mano.
4. **Le foto.** `www/list` e `www/upload`, e l'immagine dell'auto.
5. **L'energia.** Carichi, nodi, sottocarichi, report: da sola vale quanto
   tutte le altre messe insieme.
6. **Il resto**, chiave per chiave, con questo documento come lista.

## Come si tiene onesto questo conto

Una prova conta le chiavi che l'app copre e le confronta con le 83: quando se
ne aggiunge una alla dashboard, o una all'app, il numero qui sopra si aggiorna
da solo invece di invecchiare in silenzio.
