# Aprire la repository: cosa si vede, e cosa succede alle due repository

> **Fatto: `gdahomeapp` è pubblica** (12 settembre 2026), perché è così che
> Home Assistant scarica un add-on — il Supervisor va a prendere gli archivi
> senza presentarsi, e da una repository privata si sente rispondere «non
> esiste». È la via **(a)** in fondo a questo documento.
>
> Messo a posto contestualmente: la licenza della dashboard dentro
> `ponte/plancia/` con la sua nota, gli indirizzi dell'archivio di add-on che
> puntavano ancora alla repository privata, e il `gettone` dichiarato inutile
> nelle opzioni.
>
> **Resta una cosa, e va fatta prima di dare l'app a qualcuno: la chiave
> Android.** Vedi il punto qui sotto — è l'unica conseguenza dell'apertura
> che non è una decisione ma un difetto.

Due domande, e sotto le risposte con le prove.

> 1. Gli utenti mica possono recuperare dalla repository l'APK e tutti i
>    dati del centralino?
> 2. Se metto in privato `dashboardmodern-v2` la nostra funzionerà sempre? I
>    nuovi rilasci dove devono essere effettuati poi? Tutto il motore dove si
>    trova?

---

## 1. Cosa diventa leggibile se `gdahomeapp` diventa pubblica

### L'APK: non è qui, e quando c'è è quello che la gente deve poter prendere

Nella repository non c'è nessun APK, e non c'è mai stato: lo costruisce il
bottone **«L'app da provare»** su Actions e lo lascia come *artifact* della
corsa, che scade dopo trenta giorni. Su una repository pubblica gli artifact
delle corse sono scaricabili da chiunque apra quella pagina.

Ed è quello che serve — l'app la gente la deve installare — ma cambia il
modo di consegnarla: invece di un artifact che scade, una **Release** con
l'APK dentro, quando è pronta. Una Release si trova, ha un numero di
versione, e non sparisce dopo un mese.

Dentro l'APK non c'è niente di segreto: c'è l'indirizzo del centralino, che
è pubblico per definizione, e nient'altro. Nessuna casa, nessun token,
nessuna chiave.

**Una cosa da sistemare prima, questa sì.** I pacchetti di prova sono firmati
con `app/android/app/chiave-di-prova.jks`, che sta nella repository con la
sua password scritta in `build.gradle.kts`. Oggi non protegge niente ed è
scritto anche nel commento. Ma su Android **l'identità di un'app è la sua
firma**: chiunque abbia quella chiave può firmare un pacchetto che il
telefono accetta come *aggiornamento* di gdahome. Finché la repository è
privata la chiave ce l'abbiamo noi; pubblica, ce l'hanno tutti.

Quindi, prima di aprire — o prima dei negozi, qualunque venga primo:

- una chiave vera, generata una volta, **fuori** dalla repository (fra i
  segreti di Actions, come `CHIAVE_ANDROID` e la sua password);
- i pacchetti che si danno alla gente firmati con quella;
- la chiave di prova resta solo per le prove, e chi ha la repository lo sa.

### I dati del centralino: nella repository c'è il codice, i dati stanno su Cloudflare

Nella repository c'è `nuvola/src`, cioè **come è fatto** il centralino. I
dati non sono qui e non possono esserci: stanno in un Durable Object per
casa, con il suo SQLite, dentro Cloudflare.

E quello che il centralino tiene, lo tiene in modo che non serva a chi lo
legge:

- **nessun gettone.** Il token di GitHub delle segnalazioni è un segreto del
  Worker (`GITHUB_SEGNALAZIONI`); quello di Cloudflare e gli altri sono
  segreti di Actions. Nella repository non ce n'è nessuno, e non ce n'è mai
  stato: `git log -S "github_pat_"` su tutta la storia non trova nessun
  gettone vero, solo la parola nei documenti che spiegano come si fa.
- **nessun segreto di casa.** Il centralino non tiene il segreto di una
  casa: ne tiene l'**impronta** SHA-256 (`nuvola/src/segreti.js`), e la
  confronta a tempo costante. Con l'impronta non si bussa: non si torna
  indietro.
- **nessuno stato della casa.** Quello che passa dal centralino è già
  cifrato fra il telefono e il ponte. Il centralino gira buste che non può
  aprire, e questo si legge nel codice — che è il punto: si può verificare.

Detto in breve: aprire la repository non fa «recuperare i dati». Fa
**leggere il protocollo**. Ed è una cosa buona se la sicurezza non dipende
dal fatto che il codice sia segreto, e qui non dipende: il codice di
abbinamento scade, il segreto della casa sta solo in casa e sul telefono, la
cifratura è punto‑punto. Chi legge il codice non entra in una casa.

### Quello che invece diventa pubblico davvero, e va deciso prima

1. **`ponte/plancia/` — diciannove megabyte con la sorgente della
   dashboard.** Non è roba compilata: sono gli 887 file della 1.4.19 con i
   commenti dentro, `legacy/` e `src/` compresi. Aprire `gdahomeapp` vuol
   dire **pubblicare una copia della dashboard**. Tu sei l'autore di tutte
   e due, quindi puoi; ma due cose vanno messe a posto:
   - in quella cartella **non c'è nessuna LICENSE**. Chi clona si trova il
     codice della dashboard sotto la licenza di gdahome, che è un'altra.
     Va messa `ponte/plancia/LICENSE` — quella di `dashboardmodern-v2` — e
     una riga che dice che quella cartella è sua e non nostra.
   - la licenza della dashboard vieta a **chiunque altro** di
     ridistribuirla (§3a), di farne versioni derivate (§3c) e di metterla
     in un prodotto a pagamento (§3d). Pubblicandola dentro gdahome la si
     mette dove è più facile prenderla: la licenza resta quella, ma va
     scritta accanto, non lasciata a chi va a cercarla.
2. **`docs/ACQUISTI.md`** — il listino, cosa è gratis e cosa no, come si
   vende. È una decisione, non un difetto: se la repository è pubblica lo
   leggono tutti, concorrenti compresi.
3. **`ponte/app/`** — l'app web costruita. Nessun segreto, ed è già servita
   in chiaro dal centralino: non cambia niente.
4. **La storia dei commit**, tutta, con i messaggi lunghi che raccontano
   anche gli errori fatti e le scelte. Per come sono scritti non è un
   problema — è la parte migliore da far leggere — ma va saputo.
5. **Le corse di Actions**, con i loro log. Nessun segreto viene stampato
   (i gettoni si controllano per lunghezza e prefisso, non si scrivono), ma
   i log restano pubblici.
6. **`gdahome-segnalazioni` deve restare privata.** Lì dentro ci sono le
   parole della gente e le foto della loro casa, allegate alle issue in
   `allegati/`. Quella repository non si apre mai.

Una cosa che **non** succede: una repository pubblica non espone i segreti
di Actions a chi manda una modifica da fuori. Nessun workflow qui usa
`pull_request_target`, che è l'unico trigger che passerebbe i segreti a
codice di altri; quello che gira sulle proposte è `pull_request`, e lì i
segreti non ci sono.

---

## 2. Se `dashboardmodern-v2` va in privato

Oggi è **pubblica** (38 stelle, 2 fork, 15 issue aperte). Metterla in
privato non spegne niente di gdahome.

### Funziona, e non cambia niente a casa di nessuno

La plancia è **dentro l'add-on**: `ponte/plancia/`, 887 file, versione
1.4.19, agganciata al commit `e97f5ba`. Il ponte la serve dal disco, il
telefono la chiede al ponte, e il ponte non va mai su github.com a
prenderla. Una casa accesa non si accorge di niente.

Anche la **chat di assistenza** continua: il suo centralino è un Worker già
acceso su Cloudflare, e un Worker pubblicato non dipende dalla visibilità
della repository da cui è uscito. La repository servirebbe solo per
**ripubblicarlo**.

### Cosa si rompe: una cosa sola, e ha già la sua toppa

Il bottone **«La plancia nuova»** su Actions, che importa una versione nuova
della plancia: chiede a GitHub `releases/latest` e poi il tarball del tag di
`danigio15/dashboardmodern-v2`. Con la repository privata, senza gettone,
GitHub risponde 404.

Il workflow lo prevede già: usa il segreto `GETTONE_PLANCIA` e, se manca, lo
dice con le parole giuste. Da fare una volta sola:

1. su GitHub, un **token a grana fine** su `dashboardmodern-v2` soltanto,
   con **Contents: Read-only** e nient'altro;
2. fra i segreti di `gdahomeapp`: Settings → Secrets and variables →
   Actions → `GETTONE_PLANCIA`.

Da lì in poi l'import funziona come prima.

### I rilasci: due posti, e non si mischiano

| cosa si rilascia | dove | come |
|---|---|---|
| **La plancia** | `dashboardmodern-v2` | si lavora lì e si fa una **release `vX.Y.Z`**: è quella che il bottone «La plancia nuova» va a prendere |
| **L'add-on (il ponte)** | `gdahomeapp` | si alza `version` in `ponte/config.yaml` — è quel numero che fa comparire «Aggiorna gdahome» nella console — e si spinge su `main` |
| **L'app** (Android, iPhone, web) | `gdahomeapp` | Actions → «L'app da provare»; e «gdahome dentro l'add-on» per l'app web che l'add-on si porta dietro |
| **L'app in una release** (Android) | `gdahomeapp` | un'etichetta `vX.Y.Z` spinta su `main`: il pacchetto firmato finisce fra le release, che è un indirizzo da aprire col telefono. Serve la chiave vera (`docs/LA_CHIAVE_ANDROID.md`), se no la release non si fa |
| **Il centralino di gdahome** | `gdahomeapp` | Actions → «Il centralino» |
| **Il centralino della chat** | `dashboardmodern-v2/centralino` | da lì, quando serve: è già acceso |

Un add-on tenuto in `/addons/gdahome` non ha nessun negozio dietro, quindi
**la versione nel manifesto è l'unico modo** perché una casa sappia che c'è
qualcosa di nuovo. Rilasciare senza alzarla significa non rilasciare.

### Dove sta il motore

| pezzo | dove | cosa fa |
|---|---|---|
| la plancia, quella che si vede | `dashboardmodern-v2`, vendorata in `gdahomeapp/ponte/plancia/` | tutte le sue sezioni, la Config, i temi |
| il ponte | `gdahomeapp/ponte/src` | il filo con Home Assistant, la plancia servita, la configurazione, le foto, il catalogo, i timer del clima, le segnalazioni, la chat, l'aggiornamento di sé |
| l'app | `gdahomeapp/app/lib` | il filo cifrato, le case, la plancia nel riquadro, la Config, le segnalazioni, l'assistenza |
| il centralino di gdahome | `gdahomeapp/nuvola/src` → Cloudflare | l'abbinamento, il filo da fuori casa, le segnalazioni verso GitHub, e gdahome da browser |
| il centralino della chat | `dashboardmodern-v2/centralino` → Cloudflare | le conversazioni dell'assistenza, di tutte le case |
| le segnalazioni | `danigio15/gdahome-segnalazioni` | le issue e gli allegati |

---

## Il consiglio

Le due domande si incrociano, ed è meglio dirlo: **se `gdahomeapp` diventa
pubblica portandosi dietro `ponte/plancia/`, mettere `dashboardmodern-v2` in
privato non nasconde niente.** La 1.4.19 sarebbe leggibile lì, con i
commenti.

Le combinazioni che stanno in piedi sono tre:

- **(a) Entrambe pubbliche.** Coerente con la licenza della dashboard, che è
  «source available»: si legge, si installa a casa propria, non si
  ridistribuisce. Prima di aprire: la chiave Android vera, la LICENSE dentro
  `ponte/plancia/`, e la decisione su `ACQUISTI.md`.
- **(b) Come adesso: dashboard pubblica, `gdahomeapp` privata.** Si
  distribuiscono solo le cose costruite — l'APK e lo ZIP dell'add-on — e chi
  installa non ha bisogno di vedere niente. È la via che chiede meno lavoro
  oggi, ed è quella che stiamo seguendo.
- **(c) `gdahomeapp` pubblica senza la plancia dentro.** Allora l'add-on
  dovrebbe scaricarsela al primo avvio, e da una repository privata
  servirebbe un gettone **in ogni casa**: il contrario di «facile, senza
  troppe cose da installare». Da non fare.

Quello che non sta in piedi è **`gdahomeapp` pubblica con la plancia dentro
e `dashboardmodern-v2` privata**: il lavoro di chiudere una porta, con
l'altra aperta accanto.

---

## Dopo: cosa è stato fatto e cosa manca

Si è scelta la **(a)**, e la scelta è già in piedi. Il conto, onesto:

**Fatto**

- `ponte/plancia/LICENSE` — la licenza di DashboardModern, accanto al suo
  codice — e `ponte/plancia/LEGGIMI.txt`, che dice a chi passa di lì che
  quella cartella non è di gdahome e che leggere non vuol dire poter
  prendere. Il sigillo della plancia non se ne accorge: `provenienza.js`
  guarda solo `legacy/`, `src/`, `avatars/` e `brands/`, e questi due file
  stanno sopra.
- `repository.yaml` e `ponte/config.yaml` non puntano più alla repository
  privata: chi apre la scheda dell'add-on trova un indirizzo che esiste.
- Il `gettone` fra le opzioni: dichiarato inutile. Chi installa dal negozio
  riceve gli aggiornamenti dal negozio; chi tiene l'add-on come copia locale
  usa il bottone nella console, che adesso legge un manifesto pubblico senza
  presentarsi. Resta solo per chi si tenesse una copia privata.
- Verificato con `git log --all -p` su tutti i 198 commit: **nessun gettone,
  nessuna chiave privata, nessun segreto** in tutta la storia.

**Manca, e non è una decisione: la chiave con cui si firmano i pacchetti
Android.**

`app/android/app/chiave-di-prova.jks` sta nella repository, e la sua password
— `gdahome` — è scritta in chiaro in `build.gradle.kts`. Era voluto e il
commento lo spiega: senza una chiave ferma, ogni macchina che compila ne
genera una nuova, Android vede due firme diverse e **rifiuta di installare il
pacchetto nuovo sopra il vecchio**; chi lo prova deve disinstallare, e
disinstallando perde l'abbinamento.

Su una repository pubblica quella chiave ce l'hanno tutti. E su Android
**l'identità di un'app è la sua firma**: chi ha la chiave può firmare un
pacchetto che il telefono di chi ha gdahome accetta come *aggiornamento*.
Oggi non è ancora un danno — i soli pacchetti in giro sono quelli di prova,
installati da chi li ha costruiti — ma va chiuso prima di darne uno a
qualcuno.

Le due metà del lavoro:

1. **Una chiave vera, generata una volta, che non passa da qui** (`keytool
   -genkeypair`), messa fra i segreti di Actions come `CHIAVE_ANDROID` (il
   keystore in base64) e `CHIAVE_ANDROID_PASSWORD`. Questa metà la può fare
   solo chi ha la repository: un segreto di Actions non si scrive da dentro
   una corsa.
2. **Il progetto che la usa quando c'è** e ricade sulla chiave di prova
   quando non c'è, così le compilazioni sul banco continuano a funzionare e
   i pacchetti che si danno alla gente sono firmati con quella vera. Questa
   metà è codice, e si fa qui.

Finché la (1) non c'è, la (2) non cambia niente: per questo è la prima.
