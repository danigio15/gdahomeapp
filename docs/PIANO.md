# Il piano

Scritto dopo aver misurato cosa c'e' davvero in
[dashboardmodern-v2](https://github.com/danigio15/dashboardmodern-v2), non a
occhio: 182.000 righe di frontend, 7.000 di Python, ventitre sezioni che
funzionano, quindici lingue, versione 1.4.11 distribuita su HACS con utenti
veri.

## Le tre decisioni gia' prese

| | scelta | cosa cambia |
|---|---|---|
| **Accesso da fuori** | un **add-on** che fa da ponte | fatto, sta in `ponte/` |
| **Zigbee** | **ZHA e Zigbee2MQTT tutti e due** | il pairing va dietro un'interfaccia sola con due adattatori; la fase costa il doppio |
| **La plancia** | resta quella che c'e' | non si riscrive niente di cio' che gia' funziona |
| **Con cosa si scrive l'app** | **Flutter** | una sola app per tutti e due i telefoni, e l'interfaccia piu' fluida delle tre strade |

Sulla terza vale la pena essere espliciti, perche' e' la decisione che fa
risparmiare piu' tempo di tutte. Il progetto vecchio ha gia' provato a
riscrivere la plancia in nativo e ha smesso, mettendolo per iscritto: un
renderer parallelo deve rifare da zero un documento di 892 KB con 328 funzioni,
e o viene identico — e allora riscriverlo non e' servito a niente — o viene
diverso, e l'utente lo riconosce come peggiore. Quindi: **le sezioni che
esistono si mostrano in una WebView; le funzioni nuove si scrivono native.**
Non e' un compromesso, e' il punto: le tre funzioni che vogliamo non esistono
da nessuna parte, quindi scriverle native non costa un minuto in piu'.

## Cosa manca davvero

Verificato nel codice del progetto vecchio: la plancia **legge e comanda**
entita', non ne **crea**.

| | c'e' oggi |
|---|---|
| Aggiungere un dispositivo Zigbee | niente |
| Scrivere un'automazione | niente |
| Creare un aiutante | niente |
| Flussi di configurazione di Home Assistant | niente |
| Notifiche native | niente |

Quindi non c'e' niente da smontare: c'e' da costruire.

## Le fasi

### Fase 1 — il guscio *(quasi chiusa)*

* ✅ L'add-on: abbinamento con codice a tempo, revoca, filo verso Home
  Assistant, console dentro Home Assistant, 60 prove.
* ✅ Il filo in Dart: stretta di mano, comandi numerati, sottoscrizioni,
  riconnessione con attesa che raddoppia, e le sottoscrizioni che risalgono da
  sole dopo una caduta.
* ✅ Il primo avvio: indirizzo e codice, segno nel portachiavi del sistema
  (Keychain su iPhone, Keystore su Android), e il ponte controllato *prima* di
  bruciare il codice.
* ✅ La casa viva: `get_states` piu' `state_changed`, con la rilettura completa
  dopo ogni riconnessione.
* ⬜ **La plancia dentro l'app.** Manca un pezzo che al momento non c'e' da
  nessuna parte: il ponte passa il *filo*, cioe' il WebSocket, ma non le
  *pagine*. Per far vedere la plancia in una WebView il ponte deve saper
  passare anche l'HTTP del frontend di Home Assistant, sessione compresa. E' il
  prossimo lavoro, ed e' piu' delicato del filo — una WebView autenticata e' un
  posto dove si sbaglia facile.

### Fase 2 — gli aiutanti

Si spaccano in due gruppi, e solo il primo e' facile.

* **I sette classici** — `input_boolean`, `input_number`, `input_text`,
  `input_select`, `input_datetime`, `counter`, `timer`. Home Assistant ha un
  comando `*/create` per ognuno: si creano, si elencano, si cancellano. Questo
  e' il gruppo della fase 2.
* **Quelli che passano da un flusso di configurazione** — modello, soglia,
  derivata, contatore consumi, gruppo. Vogliono le API dei flussi, che sono
  un'altra cosa e un altro lavoro. Fase 5.

### Fase 3 — Zigbee, tutti e due

Un'interfaccia sola davanti, due adattatori dietro:

```
        ┌──────────── quello che vede l'app ────────────┐
        │  cerca · abbina · dai un nome · metti in una  │
        │  stanza · guarda com'e' andata · togli        │
        └───────────────────────────────────────────────┘
                    │                        │
              ┌─────┴─────┐            ┌─────┴─────┐
              │    ZHA    │            │    Z2M    │
              │ WebSocket │            │   MQTT    │
              └───────────┘            └───────────┘
```

Il pezzo delicato non e' parlare con i due sistemi: e' che **l'abbinamento non
e' un bottone, e' un processo con degli stati**. Si apre la rete, si aspetta che
il dispositivo si faccia vivo, poi c'e' l'intervista — che puo' durare minuti e
puo' fallire a meta'. L'app deve raccontare cosa sta succedendo, non girare una
rotella.

Il ponte gia' si prepara: se in casa c'e' un broker MQTT configurato, `run.sh`
lo passa all'add-on. Serve a Z2M quando sara' il suo turno.

### Fase 4 — il mago delle automazioni

Rifare l'editor di Home Assistant sul telefono sono mesi, e verrebbe peggio del
suo. Quindi non si rifa'.

Al posto suo, **un mago su una decina di schemi** che coprono quasi tutto
quello che la gente scrive davvero: a un orario, quando cambia uno stato,
quando qualcuno arriva o esce, all'alba o al tramonto, quando un numero passa
una soglia, quando si preme un pulsante. Piu' l'elenco: accendi, spegni, esegui
adesso, guarda l'ultima volta che e' partita.

Home Assistant le salva con una chiamata REST e un ricaricamento: la scrittura
e' la parte facile. Il lavoro e' tutto nell'interfaccia.

### Fase 5 — il resto

Notifiche native (servono FCM e APNs), impronta digitale e Face ID, riquadri
nella schermata iniziale, gli aiutanti da flusso di configurazione.

### Fase 6 — i negozi

Programma sviluppatori Apple (99 $ l'anno) e Google Play (25 $ una volta).
Attenzione a una cosa: Apple in revisione vuole che l'app abbia un valore suo,
e una WebView e basta rischia il rifiuto. **Le fasi 2, 3 e 4 sono anche la
risposta a quella revisione**, non solo funzioni in piu'.

## Le cose che decidono tutto, e che non sono codice

1. **Far arrivare il traffico al ponte.** Il ponte non apre porte per conto
   suo, e non deve: e' una scelta di chi installa. Nabu Casa, una VPN, o un
   proxy inverso.
2. **Le quindici lingue** del progetto vecchio vanno riportate nell'app.
3. **Cosa puo' fare un telefono abbinato**: tutto quello che puo' fare il
   ponte. Non c'e' un filtro per tipo di comando, e non c'e' apposta — un
   filtro per esclusione lascia sempre fuori qualcosa e da' l'idea sbagliata
   che il telefono sia limitato. Quello che c'e' e' che un telefono entra solo
   se qualcuno gia' dentro Home Assistant ha fatto un codice negli ultimi
   cinque minuti, e si stacca con un bottone.

## Flutter, e cosa vuol dire in pratica

Una sola app per Android e iPhone, disegnata da Flutter invece che dal sistema:
vuol dire che quello che si vede e' identico sui due telefoni, e che le
animazioni sono le stesse. E' la strada che da' il risultato piu' fluido.

Il prezzo e' Dart, che e' un linguaggio nuovo rispetto a tutto il resto del
progetto. Si paga una volta, e per limitare quanto si paga il codice e' diviso
in due meta' con una regola netta:

* **`app/lib/ponte/` non sa che Flutter esiste.** E' Dart e basta: la stretta
  di mano col ponte, i comandi, le sottoscrizioni, la riconnessione. Si prova
  con `flutter test` contro un ponte finto, senza telefono, senza emulatore e
  senza schermo — che e' l'unico modo di avere prove che girano davvero a ogni
  commit.
* **`app/lib/schermate/` e' Flutter**, e sopra quella meta' non c'e' niente da
  provare che non sia guardare lo schermo.

La divisione non e' pulizia fine a se stessa: e' quello che permette alla CI di
dire qualcosa di vero sull'app senza avere un telefono attaccato.

## Come si mettono insieme i pezzi

```
    app/lib/schermate/          Flutter: primo avvio, plancia, impostazioni
            │
    app/lib/ponte/              Dart puro: il filo, i comandi — provato
            │
        ══════════  WSS  ══════════
            │
    ponte/  (add-on)             gia' fatto, 60 prove
            │
    Home Assistant
```

La cosa importante e' che il pezzo di mezzo — `app/lib/ponte/` — parla il
**protocollo di Home Assistant**, non un protocollo nostro: l'add-on si
presenta come Home Assistant apposta. Vuol dire che lo stesso codice del filo
funziona anche puntato dritto a un Home Assistant, senza ponte, e che nessuno
dei due lati e' incastrato con l'altro.
