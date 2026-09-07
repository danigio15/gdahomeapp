# Provare l'app davvero

Tre strade, dalla piu' rapida alla piu' completa. Tutte e tre vogliono prima
**il ponte acceso** sulla tua Home Assistant: senza quello l'app non ha niente
a cui bussare.

---

## Prima di tutto: il ponte

Due strade, e **quale delle due dipende da una cosa sola: se la repository e'
privata**.

Home Assistant, quando gli si da' l'indirizzo di un archivio di add-on, va a
prenderlo **senza presentarsi a nessuno**. Su una repository privata quella
richiesta torna indietro come «non esiste», e nel negozio non compare niente.
Non e' un errore da aggiustare: e' che il Supervisor non ha nessuna chiave da
mostrare, e non c'e' modo di dargliene una senza scriverla dentro la
configurazione di Home Assistant.

Quindi: **se vuoi tenere la repository privata, si installa a mano.** Non e'
piu' difficile, e' solo un'altra strada.

### A. A mano, con la repository che resta privata *(consigliata)*

L'add-on si mette in una cartella di Home Assistant e il Supervisor lo trova da
solo.

1. **Scarica il codice.** Sulla pagina della repository: **Code → Download
   ZIP**. Funziona anche se e' privata, perche' tu sei dentro.
2. **Apri la cartella `addons` di Home Assistant.** Ci si arriva con uno
   qualunque di questi, quello che hai gia':
   - l'add-on **Samba share**, che la fa comparire come cartella di rete;
   - l'add-on **Advanced SSH & Web Terminal**;
   - l'add-on **Studio Code Server** o **File editor**.
3. **Copiaci dentro la cartella `ponte`** presa dallo ZIP, cosi' com'e'. Alla
   fine deve esserci `addons/ponte/config.yaml`.
4. In Home Assistant: **Impostazioni → Add-on → Negozio degli add-on**, menu in
   alto a destra → **Ricarica**. Compare una sezione **Local add-ons** con
   dentro **Il ponte di DashboardModern**.
5. Installalo. **La prima volta ci mette qualche minuto**: non lo scarica
   gia' pronto, se lo costruisce sul posto — su un Raspberry anche cinque o
   dieci minuti. Le volte dopo e' immediato.
6. Avvialo.

Per aggiornarlo: riscarichi lo ZIP, risostituisci la cartella, e nel negozio
premi **Ricarica**.

### B. Con l'indirizzo, se la rendi pubblica

1. **Impostazioni → Add-on → Negozio degli add-on**, menu in alto a destra →
   **Archivi**, e incolla `https://github.com/danigio15/gdahomeapp`.
2. Nell'elenco compare **Il ponte di DashboardModern**: installalo e avvialo.

Piu' comodo, e si aggiorna da solo. Ma vuol dire che il codice lo legge
chiunque.

### E poi, in tutti e due i casi

1. Nella barra laterale compare **Il ponte**. Aprilo: e' la console.
2. Premi **Fabbrica un codice**. Escono otto lettere, valide cinque minuti.

Quel codice serve una volta sola, alla prima accensione dell'app.

> **L'app invece non c'entra niente con tutto questo.** L'APK si scarica da
> Actions, e li' sei autenticato: la repository puo' restare privata quanto
> vuoi.

---

## 1. Sul telefono Android, col pacchetto pronto *(la piu' comoda)*

Non serve installare niente sul computer: il pacchetto lo costruisce GitHub.

1. Sulla repository: **Actions → «L'app da provare» → Run workflow**.
2. Quando finisce (cinque minuti circa), in fondo alla pagina della corsa c'e'
   **gdahome-android**: scaricalo. Dentro c'e' `app-debug.apk`.
3. Passa il file sul telefono e aprilo. Android chiedera' di consentire
   l'installazione da questa origine: e' la richiesta normale per un'app che
   non arriva dal Play Store.
4. Apri l'app, e riempi il modulo:
   - **Come si chiama**: quello che vuoi — «Casa».
   - **Indirizzo sulla rete di casa**: l'indirizzo di Home Assistant con la
     porta del ponte, per esempio `192.168.1.50:8098`.
   - **Indirizzo pubblico**: lascialo vuoto per la prima prova; serve per
     funzionare **fuori casa**, e senza l'app va solo sotto il tuo Wi-Fi.
   - **Codice**: le otto lettere della console.

Il pacchetto e' di *debug*, non di *release*: si installa uguale, ma e' un po'
piu' lento e non e' quello che andrebbe su un negozio.

## 2. Sul computer o sul telefono, dal browser *(la piu' rapida in assoluto)*

Stessa cosa, ma senza installare niente da nessuna parte.

1. **Actions → «L'app da provare»**, e scarica **gdahome-web**.
2. Scompatta, e servi quella cartella da un computer sulla rete di casa:

   ```bash
   cd gdahome-web
   python3 -m http.server 8000
   ```

3. Dal telefono, sulla stessa rete, apri `http://<ip-del-computer>:8000`.
   Su iPhone, **Condividi → Aggiungi a Home** la mette fra le app.

Una cosa da sapere: il browser fa parlare la pagina col ponte solo se i due
sono **tutti e due** in chiaro o **tutti e due** in cifrato. Se servi la pagina
in `http` e il ponte risponde in `http`, funziona. Mischiarli no — e' il
browser che lo impedisce, non l'app.

## 3. Dal codice, con Flutter *(per lavorarci)*

Serve [Flutter](https://docs.flutter.dev/get-started/install) installato.

```bash
git clone https://github.com/danigio15/gdahomeapp
cd gdahomeapp/app
flutter pub get
flutter devices          # il telefono attaccato col cavo, o un browser
flutter run              # e da qui in poi si ricarica a caldo mentre scrivi
```

Per l'iPhone servono un Mac, Xcode e un account sviluppatore Apple: e' l'unica
strada, e non c'e' modo di aggirarla.

---

## Da fuori casa: la strada che funziona

Il ponte sta su una porta sua — la 8098 — e da fuori quella porta bisogna
poterla raggiungere. **L'accesso remoto di Home Assistant non serve a
niente qui**: il suo tunnel arriva a Home Assistant e si ferma li', le porte
degli add-on non le fa passare, e non c'e' nessuna impostazione che glielo
faccia fare. Se ci provi, l'app te lo dice.

Quella che funziona, senza toccare il router e senza aprire niente al mondo, e'
**Tailscale**: una rete privata fra i tuoi apparecchi. Il telefono vede la casa
come se ci fosse dentro, da ovunque.

### Come si mette

1. **Su Home Assistant.** Negozio degli add-on → cerca **Tailscale** → installa
   → avvia. Apri il suo **Log**: stampa un indirizzo lungo che comincia per
   `https://login.tailscale.com/…`. Aprilo nel browser e accedi (l'account e'
   gratuito e si fa li').
2. **Sul telefono.** Installa l'app **Tailscale**, accedi con lo **stesso**
   account, e accendila.
3. **Trova l'indirizzo di casa.** Su
   [login.tailscale.com/admin/machines](https://login.tailscale.com/admin/machines)
   compaiono i tuoi apparecchi. Quello di Home Assistant ha un indirizzo che
   comincia per `100.` — per esempio `100.92.14.7`.
4. **Provalo prima dell'app.** Dal telefono, con Tailscale acceso **e il Wi-Fi
   di casa spento**, apri nel browser:

   ```
   http://100.92.14.7:8098/salute
   ```

   Deve rispondere `{"vivo":true,...}`. Se risponde quello, hai finito: il
   telefono raggiunge il ponte da fuori.
5. **Nell'app**, nel campo **Indirizzo pubblico**, scrivi `100.92.14.7:8098`.

Da quel momento l'app funziona in tutte e due i posti, e passa dall'uno
all'altro da sola: in casa usa l'indirizzo di rete locale, che e' piu' veloce;
fuori usa quello di Tailscale. Sotto il nome della casa leggi da quale dei due
sta passando.

Gratis fino a cento apparecchi, cifrato, e sul router non si apre niente.

### Le altre due strade

* **Un proxy inverso** davanti alla porta 8098, col tuo dominio e il tuo
  certificato. Funziona, ma vuole un dominio, un certificato e una porta aperta
  sul router.
* **Niente.** L'app funziona solo sotto il Wi-Fi di casa, e da fuori dice che
  non trova la casa. Per molti va benissimo.

> ⚠️ Quello che **non va fatto** e' aprire la 8098 sul router cosi' com'e'. Il
> ponte parla in chiaro: su internet nudo il codice di abbinamento e il segno
> viaggerebbero leggibili da chiunque stia in mezzo. O c'e' un proxy che ci
> mette il cifrato davanti, o si sta dentro una rete privata come Tailscale.

---

## Cosa guardare, una volta dentro

- **Sotto il nome della casa** c'e' scritto da dove stai passando: «in casa»
  col simbolo del Wi-Fi, «da fuori» col mondo. E' la cosa piu' utile da
  controllare per prima.
- **Spegni il Wi-Fi del telefono** e passa alla rete del cellulare. Se hai
  messo Tailscale, dopo qualche secondo l'app deve tornare su da sola e la
  scritta deve diventare «da fuori». Se non l'hai messo, deve dire che non
  trova la casa **e spiegare che manca l'indirizzo pubblico** — e se ci hai
  messo un indirizzo di Nabu Casa, deve spiegare perche' quello non puo'
  funzionare.
- **Metti il telefono in tasca** per qualche minuto e riprendilo: il filo cade
  e si rialza da solo, e i valori devono essere quelli veri, non quelli di
  prima.
- **Dalla console del ponte, premi «Stacca»** sul telefono mentre l'app e'
  aperta: deve accorgersene subito e dire che va riabbinato.
- **Aggiungi una seconda casa** — anche la stessa, con un altro nome — e passa
  dall'una all'altra dal simbolo in alto a destra.

## Se qualcosa non va

| | |
|---|---|
| «Non trovo nessun ponte a questi indirizzi» | L'add-on e' acceso? La porta e' quella scritta nelle sue opzioni (8098 di difetto)? Il telefono e' sulla rete giusta? |
| «Codice sbagliato o scaduto» | Dura cinque minuti e si usa una volta. Fabbricane un altro. |
| «Troppi tentativi» | Dieci codici sbagliati in un quarto d'ora chiudono la porta. Passa il quarto d'ora. |
| L'app dice «da riabbinare» | Il telefono e' stato staccato dalla console. Fabbrica un codice nuovo e rifai. |
| Funziona in casa e non fuori | Manca l'indirizzo pubblico, o non arriva fino alla porta del ponte. |

Il registro dell'add-on — in Home Assistant, nella scheda del ponte — dice
sempre chi ha bussato e com'e' andata.
