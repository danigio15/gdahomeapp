# Blindare: cosa è aperto, cosa è chiuso, cosa si può chiudere

Sotto il post del gruppo sono arrivate due domande:

> Ok, una domanda, rilascerai anche il codice sorgente dell app su github?

> Ma l accesso da remoto non era gratis? Come mai hai deciso di metterlo nel
> pacchetto premium?

La prima ha una risposta che esiste già, e la seconda ne ha una che va decisa.
Questo documento dice come stanno le cose davvero — cosa chiunque può leggere
oggi, cosa protegge il lavoro, e cosa si può chiudere e a che prezzo. Serve per
rispondere senza sbagliare, e per non spendere tempo a blindare la porta
sbagliata.

## 1. Il codice sorgente è già pubblico

`danigio15/gdahomeapp` e `danigio15/gdanav` sono **pubbliche**. Il codice che
Alessandro chiede se verrà rilasciato è già lì: l'app, l'add-on, il centralino,
la plancia, tutto.

E deve restare così. Non è una dimenticanza: è il **modo in cui l'add-on si
installa**. Lo dice `repository.yaml`, in cima a questa repository:

> Non serve nessun gettone, perché questa repository è pubblica.

Chi installa gdahome incolla `https://github.com/danigio15/gdahomeapp` in
Impostazioni → Add-on → Negozio → Archivi. Il Supervisor legge quel file e la
cartella `ponte/`. **Se la repository diventa privata, il Supervisor non la
legge più**: nessuno installa, e nessuno di quelli che l'hanno già riceve un
aggiornamento. Non è un rischio da valutare, è quello che succede.

## 2. E la plancia viaggia leggibile in ogni casa, per scelta

Anche se la repository si chiudesse, il codice della plancia resterebbe
leggibile a tutti, perché l'add-on **se lo porta dentro**:

    COPY plancia/ /app/plancia/          — ponte/Dockerfile

e lo porta in chiaro. È scritto nell'intestazione di
`officina/scripts/impacchetta-la-plancia.mjs`, che è il programma che lo
prepara:

> Niente minificazione, e stavolta con una misura sotto: sopra la compressione
> vale il dieci per cento — 95 kB su 956 — e non vale i nomi veri, che sono
> quelli che rendono leggibile un errore arrivato dal campo.

Quella decisione è giusta e conviene tenerla: è la ragione per cui una
segnalazione da un tablet di un'altra casa si legge e si capisce. Ma va saputa,
perché significa che **il codice della plancia è in mano a ogni persona che ha
installato l'add-on**, repository o non repository.

## 3. Quello che difende il lavoro non è il segreto: è la licenza

Il `LICENSE` di questa repository non è open source, e lo dice alla seconda
riga. È una licenza proprietaria: il codice si può **leggere** — anzi, si è
messo lì perché si possa controllare cosa fa una cosa che sta dentro casa — ma
non si può:

- ridistribuire, rimirrorare, ricaricare da un'altra parte (§3a);
- pubblicare su un negozio, un archivio di pacchetti o di add-on (§3b);
- tenere un fork pubblico come copia a sé stante (§3c, §4c);
- farne versioni modificate, port, rifacimenti col proprio nome (§3d);
- toglierne le firme, i sigilli e le prove di provenienza (§3e, §5);
- venderlo, affittarlo o metterlo dentro un prodotto o un servizio a pagamento
  (§3f);
- usare i nomi «gdahome», «GDA», «ponte», «centralino» o il logo per una cosa
  che non è questa (§3g).

Un fork è permesso **solo** come modo tecnico di preparare una pull request, e
va cancellato quando la pull request è chiusa (§4a, §4b).

La parola giusta, in inglese, è **source available**: sorgente disponibile, non
open source. Chi legge «pubblica su GitHub» pensa spesso «allora è mia»: non lo
è, e conviene dirlo con le parole esatte ogni volta che salta fuori.

## 4. Il paywall, invece, oggi non esiste

Questa è la cosa importante, e non c'entra con la paura del codice in chiaro.

`docs/LICENZE.md` descrive un sistema di licenze completo e ben pensato: il
quadro che firma un gettone Ed25519, l'add-on che lo tiene e lo verifica, il
centralino che chiude il telefono di una casa senza gettone con `4402`
`premium-richiesto`, l'app che mostra il lucchetto. **Quel sistema nel codice
non c'è.** Oggi, 27 settembre 2026:

| cosa dice il documento | com'è nel codice |
| --- | --- |
| `ponte/src/licenze.js` | non esiste |
| `quadro/src/licenze.js` e le vie `/v1/licenze/*` | non esistono |
| `chiave-licenze.js` in ponte, centralino, nuvola, app | non esistono |
| `strumenti/chiave-licenze.mjs` | non esiste |
| il centralino che chiude con `4402` | nel centralino non c'è nessun controllo di licenza |
| `plance.aggiungi` che rifiuta la seconda plancia in Base | non c'è |

Quindi: **oggi tutto è sbloccato per tutti, e l'accesso da fuori casa funziona
per chiunque, gratis.** Nell'app Flutter la parola «premium» compare in **un
file solo**, e per dire il contrario (`senzaPremium: true`,
`app/lib/schermate/navigatore_qui/sul_telefono.dart`: «Niente Premium nell'app
unita: tutto sbloccato, niente negozio»). Finché il codice sta così, nessuno
paga niente, con o senza sorgenti pubblici.

### Ed è da qui che nasce la seconda domanda

Il piano però **è già pubblicato**, e come se fosse fatto:

- il `README.md` di questa repository mostra nove immagini di Premium che nel
  codice non esiste: `fuori-casa-serve-premium.png` («Fuori casa serve gdahome
  Premium»), `menu-con-i-lucchetti.png`, `plance-col-lucchetto.png`,
  `premium-prova-14-giorni.png`, `premium-attivo.png`,
  `addon-licenza-base.png`, `addon-licenza-premium.png`. Non le disegna nessun
  programma della repository: sono immagini fatte a mano, e sono lì in mezzo
  agli scatti veri, senza niente che dica che sono un progetto;
- il sito `gdahome.org` (`sito/index.html`) pubblica i prezzi — 4,99 €/mese,
  49,99 €/anno, 2,99 e 29,99 per gdanav — e i 14 giorni di prova.

Alessandro non ha letto il codice: ha letto quello. La sua domanda non è «hai
cambiato il programma», è **«hai cambiato i patti»**, e da dove guarda lui è una
domanda giusta. Prima di rispondergli conviene sapere che il disallineamento è
questo: le promesse sono già in piazza, la roba non c'è ancora. Da sistemare in
uno dei due modi — costruendo le licenze, oppure dicendo chiaro, dove si mostra
Premium, che è quello che verrà e non quello che c'è.

Vale la pena dire com'è fatto quel sistema, perché risponde da solo alla paura:
il gettone lo firma **il quadro**, che è una macchina a Giovanni, e chi verifica
ha solo la chiave **pubblica**. Avere il sorgente non serve a fabbricarsi un
gettone, come avere il sorgente di un browser non serve a fabbricarsi il
certificato di una banca. E l'accesso da fuori casa lo fa rispettare il
**centralino**, che è di nuovo una macchina a Giovanni: chi si modifica l'add-on
in casa propria non può far passare il suo telefono da un server che non è suo.

Il resto — otto plance, dieci case, la configurazione dall'app, lo Zigbee — gira
**in casa di chi paga**, e quello nessuno lo può chiudere: né la licenza, né
l'offuscamento, né il codice tenuto segreto. Chi vuole scavalcarlo cambia due
righe sul suo disco e nessuno lo verrà a sapere. Non è un guaio di questo
progetto: è così per ogni programma che gira sul computer di qualcun altro. La
difesa lì è la licenza (§3e vieta espressamente di scavalcare i controlli) e il
fatto che chi ha voglia di fare quel lavoro non avrebbe pagato comunque.

## 5. L'unica cosa che non si ripara: una credenziale

In una repository pubblica il codice si legge, e va bene. Una **chiave**, no — e
una chiave finita in un commit non si toglie cancellandola dopo: il commit di
prima resta, chi ha forkato ce l'ha comunque, e i programmi che setacciano
GitHub la trovano in minuti.

Da oggi c'è un guardiano: `strumenti/nessun-segreto.mjs`, che gira nelle Prove
come primo passo (`npm run check:segreti`). Guarda i file tracciati da git —
cioè esattamente quello che è pubblico, compreso `ponte/app/main.dart.js`, dove
si vedrebbe un valore murato dentro con `--dart-define` — e cerca le forme che,
quando le trovi, sono **sempre** una perdita vera: una chiave privata, il JSON
di un'utenza di servizio di Google, una chiave delle API, un gettone di GitHub,
un JWT firmato, una chiave di Stripe, una chiave Ed25519 grezza accanto alla
parola «privata», e una delle credenziali di questo progetto scritta col suo
valore invece di arrivare dall'ambiente.

Non c'è una regola generica su «password», ed è voluto: prenderebbe ogni finta
password di ogni prova, e un guardiano che grida ogni giorno lo si spegne entro
la settimana — e allora il giorno che prende quella vera nessuno lo sta più
guardando.

Oggi la repository è pulita: 2332 file di testo guardati, nessun segreto. Le due
cose che il guardiano trova e che sono dichiarate come eccezioni, col motivo
scritto accanto, sono chiavi **di prova**: il certificato autofirmato di
`centralino/test/posta.test.js` e la coppia di prova delle licenze in
`docs/LICENZE.md`. Le prove (`ponte/test/nessun-segreto.test.js`) controllano
anche il contrario di quello che si spera: che ogni regola **suoni** davanti
alla sua credenziale finta, e che un'eccezione che non copre più niente venga
tolta invece di restare aperta per abitudine.

Sopra il guardiano ci sono le due difese di GitHub, e una delle due è già in
piedi — verificato sul campo, nel modo migliore:

- **Push protection: già accesa.** Il primo tentativo di mandare su queste
  stesse prove è stato **rifiutato da GitHub**: `GH013`, «Stripe API Key»,
  `ponte/test/nessun-segreto.test.js:42`. Era una chiave finta scritta nella
  prova, e la protezione ha fatto benissimo — non può sapere che è finta. Le
  finte credenziali adesso si scrivono a pezzi e la forma intera esiste solo in
  memoria: un guardiano non chiede a quello vero un'eccezione per sé. Serve
  saperlo per un'altra ragione: **se un giorno un push viene rifiutato così,
  non si cerca il modo di farlo passare.** Si cambia la credenziale.
- **Secret scanning: da accendere**, ed è gratis sulle repository pubbliche
  (lo dice GitHub stesso nel rifiuto: «This repository does not have Secret
  Scanning enabled, but is eligible»). Una spunta in
  `github.com/danigio15/gdahomeapp/settings/security_analysis`. Serve perché
  setaccia anche la **storia**, che né il guardiano né la protezione al push
  guardano: loro difendono da qui in avanti, quella dice se c'è qualcosa
  indietro.

E la firma dell'app resta com'è, che è giusta: la chiave vera arriva da un file
non tracciato, e una costruzione `release` senza quella chiave **si ferma**
invece di uscire firmata di prova (`app/android/app/build.gradle.kts`).

## 6. Le scelte che restano, col loro prezzo

| cosa si può fare | cosa si guadagna | cosa costa |
| --- | --- | --- |
| **Lasciare `gdahomeapp` pubblica** | l'add-on si installa e si aggiorna; la licenza continua a vietare tutto il resto | il codice si legge (ma si legge già da ogni add-on installato) |
| Renderla privata | niente | **nessuno installa più gdahome, e nessuno riceve aggiornamenti**. Da non fare |
| Spostare l'add-on in una repository pubblica sua, e chiudere il resto | l'app Flutter, il quadro e il centralino non si leggono più | **scartata da Giovanni**: «tutto ciò che è legato alle app non le possiamo tirare fuori da GitHub». E aveva ragione anche tecnicamente: due repository, due CI, i workflow da rifare, la storia da tagliare — e la plancia resterebbe leggibile comunque, perché viaggia dentro l'add-on |
| Minificare o offuscare la plancia | qualche minuto in più a chi vuole leggerla | un errore dal campo non si legge più — che è il motivo per cui non si fa. Guadagno vicino a zero |
| Rendere privata **`gdanav`** | il codice dell'app in auto non si legge | niente: gdanav si distribuisce dai negozi, non da GitHub. È l'unica chiusura che non rompe nulla |
| **Costruire il sistema delle licenze** di `docs/LICENZE.md` | è l'unica cosa che cambia chi paga e chi no | il lavoro descritto nel documento, e va fatto prima di chiedere soldi |

Le due righe di mezzo sono chiuse: l'app e tutto quello che le sta attorno
restano dove sono. Resta quindi, in ordine di quanto conta: **prima** il
sistema delle licenze — senza quello non si incassa, e nessun altro lavoro di
questa lista cambia di un euro quello che entra; **poi** la spunta di secret
scanning, che costa un minuto; **poi** `gdanav` privata, se se ne ha voglia.
L'offuscamento, mai.

## 7. Cosa rispondere, nel gruppo

Sul sorgente — si può incollare così:

> Il codice è già tutto pubblico su GitHub: github.com/danigio15/gdahomeapp per
> l'app e l'add-on, github.com/danigio15/gdanav per il navigatore. L'ho messo lì
> apposta: una cosa che sta dentro casa tua è giusto che si possa aprire e
> guardare cosa fa dei tuoi dati. Una precisazione però: è «sorgente
> disponibile», non open source. Si legge, si studia, si può proporre una
> modifica; non si può ripubblicare, rimarchiare o metterci sopra un prodotto —
> sta scritto nel file LICENSE.

Sull'accesso da remoto la risposta la deve dare Giovanni, perché è una scelta e
non un fatto. I tre fatti utili per scriverla:

1. **oggi funziona per tutti e gratis**, e continuerà finché il sistema delle
   licenze non c'è (§4);
2. il **centralino è una macchina che si paga ogni mese**, tutti i mesi, ed è la
   ragione per cui nel piano quella voce sta fra quelle a pagamento: non è una
   funzione in più da vendere, è un costo che qualcuno deve coprire;
3. Alessandro l'ha letto dal README e dal sito, dove Premium è mostrato come se
   ci fosse già.

Quello che resta da decidere — e che è **esattamente** quello che lui sta
chiedendo — è **se chi lo usa già lo tiene**. Su questo conviene essere
espliciti in un senso o nell'altro: «chi ce l'ha ora lo tiene» è una risposta,
«dal giorno X serve Premium anche a chi lo usava» è una risposta; non
rispondere no, perché la domanda resta lì e la rifà qualcun altro. E finché le
licenze non ci sono, vale la pena dirlo: **non è cambiato ancora niente**.

---

Aggiornato il 27 settembre 2026. Se si tocca il `LICENSE`, `repository.yaml`,
il sistema delle licenze o il guardiano dei segreti, si aggiorna anche questo.
