# Pubblicare gdahome su Android

Due strade, e conviene farle in quest'ordine: la prima è pronta oggi e non
costa niente, la seconda richiede venticinque euro e qualche settimana di
attesa che non dipende da noi.

---

## A. Il pacchetto firmato, da una release *(pronta, manca solo la chiave)*

Un indirizzo che si apre dal telefono, si tocca il file e Android installa.
È quello che si manda a una persona.

**Cosa c'è già:** Gradle firma con la chiave vera quando la trova, il workflow
la scrive dai segreti, e su un'etichetta `vX.Y.Z` il pacchetto finisce in una
release di GitHub con le istruzioni dentro. Senza chiave vera la release non si
fa — e non è pigrizia: la chiave di prova sta scritta nella repository, e un
pacchetto pubblico firmato con quella lo rifà chiunque.

**Cosa manca:** la chiave, che devi fare tu. Cinque minuti:
`docs/LA_CHIAVE_ANDROID.md`.

Poi:

```sh
git tag v1.4.25 && git push origin v1.4.25
```

e la corsa «L'app da provare» costruisce, firma e pubblica.

**Cosa vede chi la installa.** Android chiede il permesso di installare da
quella fonte — è la stessa domanda che fa per qualunque app fuori dal negozio —
e poi si comporta come tutte le altre. Gli aggiornamenti si installano sopra,
senza perdere l'abbinamento, **finché la chiave resta la stessa**.

---

## B. Il Play Store

Serve se vuoi che la trovi chi non ti conosce. Costa 25 $ una volta sola, più
del tempo.

### Il muro da sapere prima di cominciare

Un account **personale** aperto oggi non può pubblicare in produzione subito:
Google chiede prima un **test chiuso con almeno 12 tester per 14 giorni
consecutivi**, e solo dopo si può fare domanda per la produzione. Non è
aggirabile e non dipende da noi.

Un account **organizzazione** (serve un numero D-U-N-S, gratis, un paio di
settimane per averlo) quel passaggio non ce l'ha. Se gdahome deve diventare un
prodotto, l'account organizzazione è la strada più corta anche se all'inizio
sembra la più lunga.

### Personale o organizzazione: le quattro differenze che contano

Non e' una formalita' ed e' la scelta piu' pesante di tutta la pratica, perche'
**non si cambia**: per passare dall'una all'altra si apre un altro account e si
trasferisce l'app, che e' una procedura a se'.

| | personale | organizzazione |
|---|---|---|
| per aprirlo | un documento e un indirizzo | un'entita' legale e un numero **D-U-N-S** (gratis, una o due settimane) |
| prima di pubblicare in produzione | **12 tester per 14 giorni** di fila, e poi si fa domanda | niente di tutto questo |
| cosa si vede nella scheda | il **tuo nome e il tuo indirizzo**: Google obbliga a mostrare i contatti verificati, e per una persona sono quelli di casa | il nome e l'indirizzo della societa' |
| se un giorno si vende | incassi come persona | incassi come attivita', con la fattura che ti serve comunque |

La terza riga e' quella che sorprende chi non se l'aspetta: la scheda di un'app
di un account personale mostra il **nome e l'indirizzo fisico** dello
sviluppatore, e non e' nascondibile.

### E se un giorno si vuole far pagare qualcosa

Tre cose da sapere prima, non dopo:

1. **Quello che si consuma dentro l'app passa da Google.** Una funzione in
   piu', un abbonamento, uno sblocco: il Play Store vuole il suo sistema di
   pagamento, e trattiene una percentuale (15% sotto il primo milione di
   dollari l'anno, 30% sopra — e in Europa le regole sui pagamenti esterni si
   stanno muovendo, quindi vanno riguardate quando ci si arriva). Quello che
   **non** si consuma dentro l'app — un servizio, dell'assistenza, del
   materiale — segue regole diverse.
2. **Per incassare serve un profilo di pagamento**, cioe' un conto commerciante
   collegato all'account. Con l'account personale lo si apre come persona
   fisica.
3. **Vendere con continuita' e' un'attivita'**, e in Italia un'attivita' vuole
   la partita IVA. Non e' una cosa su cui dare consigli qui: e' una domanda da
   commercialista, e va fatta **prima** di aprire l'account, perche' e' la
   risposta che decide quale dei due aprire.

**Quindi, in breve.** Se c'e' anche solo l'idea di far pagare qualcosa, o di
dare gdahome a gente che non conosci: **organizzazione**. Costa due settimane
di attesa per il D-U-N-S e ti risparmia i 12 tester, l'indirizzo di casa nella
scheda, e un trasloco di account il giorno che vendi il primo abbonamento.

Se invece l'account serve **adesso** per pubblicare gratis e vedere come va, il
personale va bene: sappi che i 12 tester per 14 giorni li devi fare, e che
spostarsi dopo costa un account nuovo piu' un trasferimento dell'app.

### E se una societa' non c'e'

E' il caso normale, e non chiude niente — cambia solo l'ordine delle cose.

L'account organizzazione vuole **un'entita' legale**, e in Italia la piu'
piccola e' la **ditta individuale** con partita IVA: basta, e puo' avere un
D-U-N-S. Ma aprirla per pubblicare un'app gratis e' mettere il carro davanti ai
buoi — una partita IVA ha dei costi che tornano ogni anno, e la si apre quando
c'e' qualcosa da fatturare, non prima. Quella domanda e' da commercialista, non
da qui.

Quindi, senza societa', le strade sono due:

1. **Non passare dal negozio, per adesso.** Il pacchetto firmato in una release
   si installa, si aggiorna e si manda a chiunque: nessun account, nessun
   documento, nessun indirizzo pubblicato, e nessuno che debba approvare
   niente. Per provare con delle persone vere e' anche piu' comodo del negozio.
2. **Account personale adesso, e organizzazione quando servira'.** Le app **si
   trasferiscono** da un account Play a un altro: e' una procedura di Google,
   la scheda si porta dietro recensioni e installazioni, e chi ce l'ha
   installata non si accorge di niente. Non e' quindi una porta che si chiude —
   e' un giro in piu' da fare piu' avanti, con qualche condizione da
   verificare quando ci si arriva (soprattutto se nel frattempo si sono vendute
   cose dentro l'app).

Quello che l'account personale ti chiede subito resta: **12 tester per 14
giorni** prima della produzione, e il **tuo indirizzo** nella scheda. Se le 12
persone non ce le hai, la strada 1 non e' un ripiego: e' l'unica che funziona
davvero oggi.

### Aprire l'account, passo per passo

Serve un account Google — va bene quello che hai gia', e **e' per sempre**:
quell'account possiede le app, e spostarle dopo e' un giro lungo. Se gdahome
deve durare, conviene aprirlo con l'indirizzo che userai anche fra cinque anni,
non con quello del telefono di adesso.

1. `play.google.com/console`, entra con l'account Google.
2. **Scegli il tipo, e scegli bene**: personale oppure organizzazione. Non si
   cambia dopo — per cambiarlo si apre un altro account e si ricomincia. E'
   qui che si decide se dovrai fare i 12 tester per 14 giorni (personale) o no
   (organizzazione).
3. **Nome dello sviluppatore**: e' pubblico, sta sotto il nome dell'app nel
   negozio. «gdahome» va bene.
4. Paga i **25 $**, una volta sola e per sempre.
5. **Verifica dell'identita'**: un documento e l'indirizzo. Per
   l'organizzazione anche il numero D-U-N-S e i dati della societa'. Di solito
   rispondono in uno o tre giorni; qualche volta di piu', e non c'e' niente da
   fare che aspettare.
6. Dentro la console: **Crea app** → nome, lingua, «App» e non «Gioco»,
   gratuita. Da li' in poi le caselle sono quelle della tabella qui sotto.

### Quello che il negozio chiede, e quello che abbiamo

| cosa | stato |
|---|---|
| `.aab` firmato (il Play Store non prende gli APK) | lo costruisce la corsa «L'app da provare» quando c'è la chiave, e lo lascia fra gli artefatti |
| Icona 512×512 | `docs/negozio/icona-512.png` |
| Grafica 1024×500 | `docs/negozio/grafica-1024x500.png` |
| Almeno 2 fotografie del telefono | `docs/negozio/1-…` → `5-…`, cinque, già della misura giusta |
| Informativa privacy a un indirizzo pubblico | `docs/PRIVACY.md` — l'indirizzo è `https://github.com/danigio15/gdahomeapp/blob/main/docs/PRIVACY.md` |
| Titolo, descrizione breve e lunga | qui sotto, da copiare |
| Modulo «Sicurezza dei dati» | le risposte qui sotto |
| Fascia d'età, categoria, contatti | si compilano lì, cinque minuti |

### Il nome e le descrizioni

**Titolo** (max 30):

```
gdahome
```

**Descrizione breve** (max 80):

```
La tua casa in una plancia: Home Assistant, sul telefono, senza complicazioni.
```

**Descrizione lunga** (max 4000):

```
gdahome apre la tua casa sul telefono.

Una plancia sola, fatta per essere guardata: le luci, il clima, le tapparelle,
le telecamere, i consumi, le persone. Quello che in Home Assistant sta in dieci
pagine diverse, qui sta dove lo cerchi.

Serve Home Assistant in casa, con l'add-on gdahome installato: si aggiunge dal
negozio degli add-on in cinque minuti, e da lì in poi l'app si abbina
inquadrando un codice a quadretti. Nessuna password da inserire, nessun token
da copiare, nessuna porta da aprire sul router.

• Da dentro casa l'app trova il ponte da sola.
• Da fuori passa da un centralino, e quello che gira è cifrato fra il telefono
  e la tua casa: il centralino instrada e non legge niente.
• Nessun account gdahome, nessuna pubblicità, nessun tracciamento.

La plancia è quella di DashboardModern, servita dalla tua casa: le sue sezioni,
le sue tessere, la sua configurazione. Si configura dal telefono, e quello che
cambi è tuo e resta a casa tua.

gdahome è un progetto aperto: il codice è su github.com/danigio15/gdahomeapp.
```

*(Il testo è una proposta: leggilo e cambialo dove non ti suona. Le parole del
negozio sono le tue, non mie.)*

### Il modulo «Sicurezza dei dati», risposta per risposta

Google chiede di dichiarare cosa raccogli. Per gdahome:

- **Raccogli o condividi dati utente?** Sì — ma solo quelli qui sotto, e solo
  quando è l'utente a mandarli.
- **Foto e video**: *raccolti*, **facoltativi**, per **assistenza clienti** —
  sono gli allegati che si attaccano a una segnalazione. Non condivisi con
  terzi.
- **Messaggi degli utenti**: *raccolti*, **facoltativi**, per **assistenza
  clienti** — il testo della segnalazione e la chat di assistenza.
- **Log di diagnostica dell'app**: *raccolti*, **facoltativi**, per
  **assistenza clienti** — le poche righe sullo stato dell'app allegate a una
  segnalazione.
- **Posizione, contatti, rubrica, salute, finanza, identificatori
  pubblicitari**: *no*, niente di tutto questo.
- **I dati sono cifrati in transito?** Sì.
- **L'utente può chiedere la cancellazione?** Sì, dalla chat di assistenza.

La fotocamera non va dichiarata come raccolta dati: serve a leggere il codice
di abbinamento, l'immagine non si salva e non esce dal telefono.

### L'ordine delle cose

1. Fai la chiave (`docs/LA_CHIAVE_ANDROID.md`) e metti i due segreti su GitHub.
2. Metti l'etichetta: `git tag v1.4.25 && git push origin v1.4.25`. Esce la
   release con l'APK **e** l'`.aab` fra gli artefatti della corsa.
3. Apri l'account Play (25 $). Personale o organizzazione: vedi il muro qui
   sopra.
4. Crea l'app, carica l'`.aab` in **test interno** — quello è immediato, e ti
   serve a vedere la scheda vera con le tue fotografie.
5. Compila scheda, privacy e sicurezza dei dati con la roba di questa pagina.
6. Poi la strada lunga: test chiuso, i 12 tester, i 14 giorni, la domanda per
   la produzione.

**Il Play App Signing.** Quando carichi il primo `.aab`, Google propone di
tenere lui la chiave di firma finale. Conviene dire di sì: da quel momento la
chiave che hai fatto tu serve solo a firmare quello che carichi, e se la perdi
Google te la fa ri-registrare invece di lasciarti con un'app che non si può più
aggiornare. Senza Play App Signing, perdere la chiave vuol dire perdere l'app.

---

## E l'iPhone?

Compila già — la corsa lo costruisce a ogni giro, senza firma — e per
installarlo serve l'account sviluppatore Apple (99 €/anno) e quattro segreti su
GitHub: sta in `docs/IPHONE.md`. Non è in programma adesso.
