# Provare l'app davvero

Tre strade, dalla piu' rapida alla piu' completa. Tutte e tre vogliono prima
**il ponte acceso** sulla tua Home Assistant: senza quello l'app non ha niente
a cui bussare.

---

## Prima di tutto: il ponte

1. In Home Assistant: **Impostazioni → Add-on → Negozio degli add-on**, menu in
   alto a destra → **Archivi**, e incolla
   `https://github.com/danigio15/gdahomeapp`.
2. Nell'elenco compare **Il ponte di DashboardModern**: installalo e avvialo.
3. Nella barra laterale compare **Il ponte**. Aprilo: e' la console.
4. Premi **Fabbrica un codice**. Escono otto lettere, valide cinque minuti.

Quel codice serve una volta sola, alla prima accensione dell'app.

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

## Cosa guardare, una volta dentro

- **Sotto il nome della casa** c'e' scritto da dove stai passando: «in casa»
  col simbolo del Wi-Fi, «da fuori» col mondo. E' la cosa piu' utile da
  controllare per prima.
- **Spegni il Wi-Fi del telefono** e passa alla rete del cellulare. Se hai
  messo anche l'indirizzo pubblico, dopo qualche secondo l'app deve tornare su
  da sola e la scritta deve diventare «da fuori». Se non l'hai messo, deve dire
  che non trova la casa **e spiegare che manca l'indirizzo pubblico**.
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
