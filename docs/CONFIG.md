# La Config, e il menu dell'app che la replica

Letto dalla release **1.4.15** di DashboardModern v2 (tag `v1.4.15`,
manifest `"version": "1.4.15"`), nel file
`custom_components/dashboardmodern/frontend/legacy/dashboard-runtime-it.js`,
righe 1282–1300: la fila `.ed-tabs` in cima all'editor. Più la scheda
**Prese**, che non sta lì — la aggiungono i moduli da soli, in
`frontend/legacy/modules-entry.js`, funzione `registerEditorTabs()`, e la
infilano subito dopo le Luci.

Diciannove schede in tutto. Fra la 1.4.11 e la 1.4.15 quella fila non è
cambiata di una riga: l'alberatura qui sotto vale per tutte e due.

## L'alberatura com'è nella plancia

    ⚙️ Impostazioni      visib        Generali (nome, sottotitolo, utente admin)
                                      Ordine navbar
                                      Rilevamento e manutenzione
                                      Sezioni accese/spente
    🏠 Home              sez0
    ⚡ Energia            sez1
    🚗 EV                sez2
    🌞 Solare            sez3
    🛡️ Sicurezza         sez4
    🖥️ MiniPC            sez6
    🌡️ Temperatura       sez7
    ⚡ Azioni             sez8
    ❄️ Clima             sez9
    🏊 Piscina           pool
    💧 Irrigazione       irr
    🪟 Finestre          tapp
    🛋️ Stanze            stanze
    💡 Luci              luci
    🔌 Prese             prese       ← la aggiungono i moduli
    🧺 Elettrodom.       appliances
    🔔 Avvisi            avvisi
    🩺 Runtime           runtime

Fuori dalla fila, raggiungibili da dentro: `sost` (sostituzioni),
`rileva`, `load`, `testi`, `hide`, `export`.

Le **sezioni** che la scheda Impostazioni accende e spegne sono otto, e sono
un'altra cosa dalle schede (`cdVisibSez()`):

    home     🏠 Home            Meteo, avvisi, azioni rapide
    energy   ⚡ Energia          Fotovoltaico e consumi
    ev       🚗 Auto elettrica  EV + wallbox (EVCC)
    boiler   🌞 Solare termico  Boiler solare
    clima    ❄️ Clima           Condizionatori e riscaldamento
    temp     🌡️ Temperatura     Temperature e umidità
    security 🛡️ Sicurezza       Telecamere e allarme
    server   🖥️ MiniPC          Monitoraggio server

Una cosa che c'è già e che serve al passo dopo: in **Generali** c'è il campo
*«Utente admin (vuoto = Config visibile a tutti)»*, salvato in
`cd_connection.admin_users[0]`. Il concetto di «chi comanda la
configurazione» non lo stiamo inventando: la plancia ce l'ha già, e l'app lo
eredita.

## Perché non si può ricopiare così com'è

Sono diciannove bottoni in **una striscia orizzontale**. Su un telefono se ne
vedono tre per volta e per arrivare a «Elettrodomestici» si scorre al buio,
senza sapere quante ce ne siano né dove si è. Su un monitor la striscia si
vede tutta e funziona; su un telefono no.

E c'è la ragione grossa: la configurazione della casa è una cosa **dell'app**,
non di una delle sue schermate. Chi la cerca la cerca nel menu, non dentro la
pagina che sta guardando. Oggi invece si apre da dentro la plancia, come un
riquadro sopra la pagina — ed è anche la parte più pesante da caricare, per
tutti, anche per chi non la apre mai.

## Il menu dell'app

Nella barra laterale, nove voci. La Configurazione è **una** voce, e dentro ha
tutte e diciannove le schede:

    Plancia            la casa, com'è
    Dispositivi        tutte le entità, in elenco
    Configurazione  ←  qui dentro c'è la Config
    Acquisti           cosa è acceso, cosa si può sbloccare
    Segnalazioni
    Assistenza
    Aiutanti           (in arrivo)
    Zigbee             (in arrivo)
    Automazioni        (in arrivo)

E dentro Configurazione, le stesse voci raggruppate in **cinque famiglie**
più due nuove. Non si perde niente e non si inventa niente: si raggruppa.

    La casa
      Generali                  ← visib      nome, sottotitolo, chi comanda
      Le sezioni                ← visib      quali pagine si vedono (le otto)
      L'ordine della barra      ← visib      in che fila stanno
      Le stanze                 ← stanze

    Le pagine
      Home                      ← sez0
      Energia                   ← sez1
      Auto elettrica            ← sez2
      Solare termico            ← sez3
      Sicurezza                 ← sez4
      MiniPC                    ← sez6
      Temperatura               ← sez7
      Azioni rapide             ← sez8
      Clima                     ← sez9

    Le cose di casa
      Luci                      ← luci
      Prese                     ← prese
      Finestre                  ← tapp
      Elettrodomestici          ← appliances
      Piscina                   ← pool
      Irrigazione               ← irr

    Gli avvisi
      Quadro avvisi             ← avvisi

    Manutenzione
      Autorilevamento           ← visib
      Sostituzioni              ← sost
      Runtime                   ← runtime
      Riporta tutto com'era     ← visib

    Chi può entrare                                              (nuova)
      Le persone
      I telefoni abbinati
      Chi comanda la configurazione

    L'app                                                        (nuova)
      Plancia leggera
      Come va l'app
      Acquisti

Le voci marcate `←` sono la stessa scheda della plancia, con lo stesso nome e
gli stessi campi. Le due famiglie in fondo nella plancia non ci sono: la prima
perché una pagina web non sa chi la sta guardando, la seconda perché riguarda
il telefono e non la casa.

L'alberatura sta scritta in un posto solo,
`app/lib/schermate/configurazione/albero.dart`, e una prova
(`app/test/configurazione_test.dart`) verifica che nessuna delle diciannove
schede resti fuori. Se domani la plancia ne aggiunge una, la prova se ne
accorge prima di noi.

## Cosa scrive, e dove finisce

Niente di nuovo: la configurazione è già un mucchio di chiavi che stanno sul
ponte (`ponte/src/configurazione.js`, comandi `dashboardmodern/config/get`,
`set`, `restore`, file `/data/plancia.json`). L'app legge e scrive **le
stesse chiavi con gli stessi comandi**, e la plancia se le ritrova. Non c'è un
secondo formato da tenere allineato, e non c'è niente da migrare: chi ha
configurato la dashboard dal browser apre l'app e trova le sue cose.

Quando l'app scrive, la pagina si ricarica da sé — è quello che fa già oggi
quando la configurazione arriva da un altro telefono.

## Più utenti, e i telefoni

Oggi un telefono abbinato è un telefono e basta: un identificativo, una
chiave, un nome. Serve un gradino in più — una **persona**, con i suoi
telefoni sotto. Le regole, in ordine di importanza:

- un telefono può non avere nessuna persona: è il caso di adesso, e resta
  quello di serie — la casa è una sola e la vedono tutti uguale;
- una persona ha uno o più telefoni. Staccare una persona stacca i suoi;
- la configurazione della plancia resta **della casa**, non della persona: è
  quello che ci si aspetta, e non si vuole finire con sei plance diverse per
  sei telefoni. Quello che può essere della persona è cosa le si lascia
  toccare;
- chi può cambiare la configurazione: di serie chi ha abbinato per primo —
  che è poi lo stesso `admin_users` che la plancia ha già. Gli altri guardano
  e comandano, ma non riscrivono la plancia agli altri. È una casella per
  persona, non un sistema di permessi.

Il ponte tiene le persone accanto ai dispositivi (`ponte/src/dispositivi.js`),
e la console le mostra. Il centralino non cambia: instrada telefoni, e chi sia
dietro un telefono non lo sa e non deve saperlo.

## Cosa c'è già e cosa manca

| pezzo | dove | stato |
|---|---|---|
| L'alberatura, letta dalla 1.4.15 | `app/lib/schermate/configurazione/albero.dart` | ✅ |
| La schermata che la mostra | `app/lib/schermate/configurazione.dart` | ✅ |
| La voce nel menu | `app/lib/schermate/menu.dart` | ✅ |
| La prova che non si perde una scheda | `app/test/configurazione_test.dart` | ✅ |
| Le schermate delle singole voci | `app/lib/schermate/configurazione/` | ⬜ |
| Le persone, accanto ai dispositivi | `ponte/src/dispositivi.js` | ⬜ |
| Chi comanda la configurazione | `ponte/`, `app/` | ⬜ |
