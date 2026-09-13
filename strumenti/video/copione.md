# Il copione

Quello che si vede scritto sul filmato, scena per scena, con il momento in cui
comincia ciascuna. Serve a due cose: leggerlo a voce sopra il video (in fondo
c'è come si attacca), e rileggere le parole senza rifare la ripresa.

I tempi fra parentesi sono **dall'inizio della scena**; quelli in grassetto
sono dall'inizio del filmato. Le durate le dichiara `scene.js`, ed è da lì che
vanno riletti se una scena cambia.

---

### **0:00** — Apertura *(8s)*

> (1,9s) Una casa in Home Assistant, e un telefono.
>
> (4,6s) Nel mezzo due cose da installare: **un add-on** e **l'app**.

### **0:08** — Cos'è *(11s)*

Le tre schede: l'add-on, l'app, la plancia.

> (2,0s) Tre pezzi, e in Home Assistant se ne installa **uno solo**.
>
> (6,4s) La plancia arriva insieme all'add-on: nient'altro da mettere.

### **0:19** — Come ci si arriva *(14s)*

Il telefono, il centralino, la casa; e le due strade che si accendono una per
volta.

> (1,4s) In casa il telefono va dritto: la casa la trova da solo sul Wi-Fi.
>
> (5,6s) Da fuori **è la casa che chiama**, e il telefono arriva da lì.
>
> (10,6s) Sul router non si tocca niente. Il centralino instrada e non può
> leggere.

---

## L'add-on, dal negozio

### **0:33** — Impostazioni → Add-on *(9s)*

> (0,9s) In Home Assistant: **Impostazioni**.
>
> (3,3s) Poi **Add-on**.
>
> (6,8s) Da qui si apre il negozio degli add-on.

### **0:42** — Il negozio *(11s)*

> (0,7s) In fondo alla pagina: **Negozio degli add-on**.
>
> (3,2s) Qui dentro ci sono gli add-on che Home Assistant conosce già.
>
> (6,4s) gdahome non è tra quelli: si aggiunge il suo archivio, dai **tre
> puntini**.

### **0:53** — Archivi, e l'indirizzo *(10,6s)*

Si incolla `https://github.com/danigio15/gdahomeapp`.

> (0,5s) Dai tre puntini: **Archivi**.
>
> (2,8s) Si incolla l'indirizzo della repository, e basta questo.
>
> (7,4s) **Aggiungi**, e si chiude.

### **1:04** — gdahome compare *(8,5s)*

> (0,7s) Nel negozio compare una sezione **gdahome**, con dentro l'add-on.
>
> (4,2s) Si apre, e si installa come tutti gli altri.

### **1:12** — Installa, poi Avvia *(14s)*

> (0,6s) **Installa**.
>
> (2,9s) La prima volta ci mette qualche minuto: se lo costruisce sul posto.
>
> (6,9s) Poi **Avvia**.
>
> (9,2s) E nella barra laterale compare **gdahome**: è la sua console.

---

## Il telefono

### **1:26** — Il codice *(11s)*

> (0,6s) Dalla console: **Fabbrica un codice**.
>
> (3,2s) Esce un quadretto, e vale cinque minuti.
>
> (7,0s) Sotto ci sono le stesse cose in lettere, per chi non può inquadrare.

### **1:37** — Si inquadra *(11,5s)*

> (1,0s) Sul telefono c'è un bottone solo: **Inquadra il codice**.
>
> (3,2s) Dentro il quadretto c'è anche **dove sta la casa**: non serve saperlo.
>
> (7,5s) Fatto. Da qui in poi il telefono entra da solo, in casa e fuori.

### **1:49** — La plancia *(13s)*

> (2,4s) La home dell'app è la plancia.
>
> (5,2s) Le luci, il clima, l'energia: si toccano da qui.
>
> (8,8s) In Home Assistant non c'è niente da installare: la porta l'add-on.

### **2:02** — L'app, dal negozio del telefono *(15s)*

In alto, per tutta la scena: **«Anteprima: sui negozi non c'è ancora»**.

> (2,2s) Quando sarà pubblicata sarà questa la strada: cercarla e premere
> **Installa**.
>
> (4,8s) Nessun file da passare, nessun permesso strano da concedere.
>
> (9,6s) Oggi però sui negozi non c'è: intanto si apre dal browser.

### **2:17** — Intanto, oggi *(11,5s)*

Una strada sola — dal browser — in due passi, e sotto la pastiglia **«Per iOS:
prossimamente»**.

> (1,4s) Intanto l'app si apre **dal browser**, e non si installa niente:
> l'indirizzo lo dà l'add-on.
>
> (6,2s) È la stessa app, su qualunque schermo. **Per iOS: prossimamente.**

### **2:28** — Chiusura *(9,5s)*

> (2,4s) Un indirizzo da incollare, e un quadretto da inquadrare.
>
> (6,4s) **github.com/danigio15/gdahomeapp**

**Fine: 2:37.**

---

## Se lo si legge a voce

Il filmato è muto (il ffmpeg di Playwright sa fare il video e basta), quindi la
voce si attacca dopo, senza rifare la ripresa e con un ffmpeg vero:

```
ffmpeg -i gdahome-presentazione.webm -i voce.m4a \
       -c:v copy -c:a libopus -shortest gdahome-con-voce.webm
```

Due cose da sapere prima di registrare:

- **le righe stanno sullo schermo il tempo che c'è scritto qui**, e sono
  pensate per essere lette senza fretta: se una frase letta a voce dura di più,
  si allunga la scena in `scene.js` invece di leggere di corsa;
- **le parole in grassetto sono quelle che si vedono anche nella finestra** —
  «Impostazioni», «Archivi», «Installa» — e conviene dirle come le dice Home
  Assistant, se no chi guarda cerca sullo schermo una parola che non c'è.
