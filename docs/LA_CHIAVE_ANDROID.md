# La chiave con cui si firma l'app per Android

Cinque minuti, una volta sola, e poi non si tocca più per anni.

## Cos'è, e perché non la faccio io

Un'app per Android è firmata. La firma non dice chi l'ha scritta: dice che
**questo pacchetto e quello di ieri vengono dalla stessa mano**, ed è l'unica
cosa che permette ad Android di installare il nuovo sopra il vecchio. Con due
firme diverse rifiuta, e chi ce l'ha installata deve disinstallare — perdendo
l'abbinamento con casa, perché il segno della casa sta nel portachiavi del
telefono e con l'app se ne va.

Oggi nella repository c'è `app/android/app/chiave-di-prova.jks`, con la sua
parola scritta accanto. Serve esattamente a quello e a niente altro: firmare i
pacchetti che ci si passa a mano, così si aggiornano fra loro. **Non è un
segreto e non protegge niente**, e per la stessa ragione con quella non si
pubblica: chiunque legga la repository può firmare un pacchetto qualunque, e il
telefono di chi ha l'app se lo prenderebbe come un aggiornamento.

Quindi serve una chiave vera. **La devi fare tu**, sul tuo computer, e non deve
passare da nessuna parte: né da questa chat, né dalla repository, né da un
messaggio. Io non la vedo mai, e non è una formalità — una chiave che è passata
da qualche parte è una chiave da rifare.

## Farla

Serve `keytool`, che arriva con Java (`apt install default-jdk` su Linux, o
`brew install openjdk` su un Mac; su Windows c'è dentro Android Studio).

In una cartella **fuori** dalla repository:

```sh
keytool -genkeypair -v \
  -keystore chiave-gdahome.jks \
  -alias gdahome \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -storetype JKS
```

Chiede una parola — sceglila lunga e **scrivila dove tieni le altre**, in un
gestore di password — e poi nome, organizzazione, città e paese. Quei campi
finiscono dentro il certificato e non si cambiano più: metti il tuo nome e
`gdahome`, il resto è indifferente.

> **L'ultima domanda è quella che si sbaglia.** «Immettere la password della
> chiave per \<gdahome\> (INVIO se corrisponde a quella del keystore)»: lì si
> preme **solo invio**. Un portachiavi ha infatti **due** parole — una apre il
> portachiavi, l'altra apre la chiave che c'è dentro — e battendone una
> seconda ci si ritrova con due parole diverse.
>
> Come ci si accorge di averlo fatto: se dopo quella domanda `keytool` chiede
> «Immettere nuovamente la nuova password», la parola l'hai battuta. Con
> l'invio non lo chiede.
>
> Non è un disastro: o si mette la seconda parola nel segreto
> `CHIAVE_ANDROID_KEY_PASSWORD`, o si fanno tornare uguali con
>
> ```sh
> keytool -keypasswd -keystore chiave-gdahome.jks -alias gdahome
> ```

`-validity 10000` sono ventisette anni. Non è esagerazione: una chiave scaduta
non firma più, e rifarla vuol dire che nessuno può più aggiornare l'app.

## Metterla su GitHub

Il portachiavi è un file di byte, e un segreto di GitHub è testo: si passa in
base64.

```sh
base64 -w0 chiave-gdahome.jks > chiave-gdahome.txt   # su un Mac: base64 -i chiave-gdahome.jks -o chiave-gdahome.txt
```

Poi su `gdahomeapp`: **Settings → Secrets and variables → Actions → New
repository secret**, e due segreti:

| nome | cosa ci va |
|---|---|
| `CHIAVE_ANDROID` | tutto il contenuto di `chiave-gdahome.txt` |
| `CHIAVE_ANDROID_PASSWORD` | la parola del portachiavi |

E due facoltativi, per i casi che capitano:

| nome | quando serve |
|---|---|
| `CHIAVE_ANDROID_ALIAS` | se hai usato un alias diverso da `gdahome` |
| `CHIAVE_ANDROID_KEY_PASSWORD` | se la parola della chiave non è quella del portachiavi |

Poi cancella `chiave-gdahome.txt` (il `.jks` no, quello si tiene).

## Tenerla

**Il `.jks` e la sua parola vanno conservati come si conserva un documento**:
una copia in un disco esterno o in un gestore di password, non una sola sul
computer di tutti i giorni. Perderla costa questo:

- **col pacchetto che si passa a mano** (come adesso): chi ce l'ha installata
  deve disinstallare e riabbinare. Fastidio, non disastro;
- **sul Play Store**, se un giorno ci si va senza il Play App Signing di
  Google: l'app **non si può più aggiornare**, per nessuno, mai. Si ricomincia
  con un'altra app e un altro nome.

## Da lì in poi

Niente. Il workflow «L'app da provare» guarda se i due segreti ci sono: se
ci sono firma con la chiave vera e lo scrive nel riepilogo della corsa; se non
ci sono firma con quella di prova e lo scrive uguale.

E prima di costruire prova **tutto quello che Gradle chiederà**: che sia un
portachiavi, che la parola lo apra, che dentro ci sia una chiave con quel
nome, e che si riesca ad aprirla. Sono quattro controlli e non uno perché
falliscono per quattro ragioni diverse, e chi legge deve sapere quale — la
differenza è fra un errore in due secondi che dice cosa fare e uno dopo sei
minuti, dentro Gradle, che dice «Cannot recover key». Quale delle due ha
firmato è sempre a schermo, perché è la differenza fra un pacchetto che si può
dare a qualcuno e uno che si tiene per sé.

E su un'etichetta — `git tag v1.4.24 && git push origin v1.4.24` — con la
chiave vera il pacchetto finisce in una **release**: un indirizzo che si apre
dal telefono, si tocca il file, e Android lo installa. Senza la chiave vera la
release non si fa, e il riepilogo dice perché.
