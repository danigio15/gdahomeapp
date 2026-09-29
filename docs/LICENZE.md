# Le licenze: gdahome Premium e gdanav Premium

Questo file e' il contratto fra i pezzi: il quadro che le rilascia, l'add-on
che le tiene, il centralino che le fa rispettare, l'app gdahome e gdanav che le
mostrano. Chi tocca uno di questi pezzi legge qui prima.

## Cosa si paga

| | Base / gratis | Premium |
| --- | --- | --- |
| **gdahome** (4,99 €/mese · 49,99 €/anno) | una plancia (la principale), una casa, collegamento solo in casa | fino a 8 plance e 10 case, collegamento da fuori casa (centralino), configurazione della plancia dall'app, dispositivi Zigbee dall'app con «Dove lo metto?», **gdanav Premium compreso** |
| **gdanav** (2,99 €/mese · 29,99 €/anno) | auto termica completa (percorso, distributori, prezzi); auto elettrica con la batteria scritta a mano e percorso senza soste; traffico, autovelox e meteo per tutti | Home Assistant e fonti automatiche della batteria (OBD, Android Auto, gdahome), percorso con le soste alle colonnine e il loro stato in tempo reale, Android Auto e CarPlay |

I prezzi stanno nei negozi (Play Console, App Store Connect), non nel codice.
Prodotti:

| | Google Play | App Store |
| --- | --- | --- |
| gdahome | abbonamento `gdahome_premium`, piani base `mensile` e `annuale` | `gdahome_premium_mensile`, `gdahome_premium_annuale` (gruppo «gdahome Premium») |
| gdanav | abbonamento `gdanav_premium`, piani base `mensile` e `annuale` | `gdanav_premium_mensile`, `gdanav_premium_annuale` (gruppo «gdanav Premium») |

## Di chi e' una licenza

- **gdahome: della casa**, non del telefono. Il soggetto e' l'identita' della
  casa verso il centralino, `casa_` + 32 cifre esadecimali
  (`ponte/src/identita.js`). Tutti i telefoni abbinati a quella casa, e la web
  app, sono Premium insieme a lei.
- **gdanav da sola: del telefono.** Il soggetto e' `tel_` + 32 cifre
  esadecimali, nato una volta sola nell'archivio sicuro di gdanav. L'abbonamento
  comprato nel negozio resta controllato dal telefono come oggi; il quadro
  serve per i **codici regalo**.
- **gdanav dentro gdahome** segue la casa: gdahome Premium = gdanav Premium.

## Da dove arriva

1. **Negozio**: l'app gdahome compra, manda la ricevuta alla casa sul filo
   cifrato (`ponte/licenza/negozio`), la casa la gira al quadro, il quadro la
   controlla con Google o Apple e segna la licenza fino alla scadenza
   dell'abbonamento.
   La prima volta un abbonamento ha **14 giorni di prova gratuita**, per
   gdahome e per gdanav: nella Play Console e' un'offerta «prova gratuita»
   su tutti e due i piani base (`mensile` e `annuale`), in App Store Connect
   un'offerta introduttiva «free trial 2 weeks» su tutti e due i prodotti.
   Durante la prova la licenza (e il gettone) lo dice con `prova: true`, e
   `scade` e' la fine della prova.
   La scadenza del negozio e' quella del **periodo in corso** (la prova, il
   mese, l'anno): i rinnovi li richiede il quadro da se'. Tiene
   l'identificativo dell'acquisto (il token di Google, la transazione
   originale di Apple) e, per le licenze che scadono entro un giorno o sono
   scadute da meno di 35, lo richiede al negozio quando la casa (o il
   telefono) chiede i gettoni e ogni ora per tutte, al massimo una volta
   l'ora per licenza. Rinnovato, `scade` va avanti; scaduto o rimborsato, la
   licenza scade da se'; il negozio che non risponde non toglie niente.
2. **Regalo del gestore**: dalla pagina del gestore del quadro si regalano
   licenze a una casa (per `casa_…`) o si generano **codici regalo** (per
   gdahome o gdanav, di N mesi o per sempre).
3. **Regalo dell'installatore**: quando il gestore crea (o modifica) un
   installatore gli da' un **pacchetto**: per ogni app, quante licenze **di
   ogni durata** — per esempio 10 gdahome di 1 mese, 5 gdahome di 1 anno, 2
   gdanav per sempre. La durata la decide il gestore (nella sua pagina: 1, 3,
   6, 12, 24 mesi o per sempre; dall'API qualunque numero di mesi da 1 a 120,
   o `"sempre"`). L'installatore dalla sua pagina ne assegna una a una delle
   sue case, o genera un codice da dare al cliente, scegliendo una delle
   durate che ha ancora nel pacchetto per quell'app: la durata comincia quando
   la assegna, o quando il cliente riscatta il codice. Ogni app + durata e' un
   conto a se': se la toglie (o annulla il codice non usato), torna in quello.

Un codice regalo si riscatta dall'app gdahome (per la casa) o da gdanav (per
il telefono): `GDA-XXXX-XXXX-XXXX`, alfabeto senza lettere ambigue
(`ABCDEFGHJKMNPQRSTUVWXYZ23456789`), una volta sola.

## Il gettone

Il quadro firma, tutti gli altri verificano con la chiave pubblica scritta nel
loro codice. Nessuno chiede al quadro «e' vero?» a ogni apertura.

```
gettone = base64url(payload JSON) + "." + base64url(firma Ed25519)
firma   = Ed25519(chiave privata del quadro, byte ASCII del primo pezzo)
```

base64url senza `=`. Il payload:

```json
{
  "v": 1,
  "app": "gdahome",          // "gdahome" oppure "gdanav"
  "sog": "casa_0123…",       // "casa_…" oppure "tel_…"
  "lic": "lic_9f2c…",        // l'identificativo della licenza nel quadro
  "origine": "negozio",      // "negozio" | "regalo" | "installatore"
  "scade": 1767225600000,    // quando finisce la licenza (ms), null = per sempre
  "fino": 1759999999000,     // quando smette di valere QUESTO gettone (ms)
  "emesso": 1759300000000,
  "prova": true              // facoltativo: c'e' solo durante la prova gratuita
}
```

`prova` c'e' **solo** quando e' vero (un abbonamento del negozio nei suoi
giorni gratis): chi verifica non lo guarda per decidere, e i campi che non
conosce li lascia stare.

Regole di verifica, uguali ovunque:

- firma giusta con `CHIAVE_PUBBLICA_LICENZE`;
- `v == 1`, `sog` e' il soggetto atteso, `fino > adesso`;
- `scade == null || scade > adesso`;
- un gettone `app: "gdahome"` vale **anche per gdanav** (Premium compreso).

`fino` e' al massimo **8 giorni** dopo `emesso`: la casa lo rinnova ogni 6 ore,
quindi una licenza revocata smette di valere entro 8 giorni anche su una casa
che non risponde, e una casa senza internet resta Premium per 8 giorni.

### La chiave

`CHIAVE_PUBBLICA_LICENZE` e' la chiave pubblica Ed25519 grezza (32 byte) in
base64url. Sta, sempre uguale, in:

- `ponte/src/chiave-licenze.js`
- `centralino/src/chiave-licenze.js`
- `app/lib/licenza/chiave.dart`
- in gdanav: `packages/gdanav_app/lib/stato/chiave_licenze.dart`

**Di serie e' vuota**: nessun gettone vale, tutti sono Base (e gdanav fa quello
che fa oggi col negozio).

**Prima l'iPhone**: con `LICENZE_SOLO_SULL_IPHONE = true` (nei tre file JS) e
`licenzeSoloSullIPhone = true` (nell'app) la chiave sta solo nell'add-on e
nell'app, e il centralino resta vuoto. La casa chiede i gettoni
e gira le ricevute ma non si limita; i lucchetti ci sono solo nell'app per
iPhone. Si scrive con `node strumenti/chiave-licenze.mjs --solo-iphone
--pubblica <x>`, e il perche' sta in
[`ACCENDERE-GLI-ACQUISTI.md`](ACCENDERE-GLI-ACQUISTI.md).

Prima del rilascio per tutti si lancia una volta

    node strumenti/chiave-licenze.mjs [--gdanav ../gdanav]

che fabbrica la coppia, scrive la pubblica in tutti i file qui sopra e stampa
la privata, da mettere **solo** sulla macchina del quadro come
`QUADRO_LICENZE_CHIAVE` (32 byte base64url, il `d` di una JWK Ed25519).

Per le prove c'e' una coppia **di prova**, che non va mai in un file di
produzione:

    pubblica  6P9sdqQtlHcmH7Ve_SgzmyJmxJS28CNORRJJfjI3rnI
    privata   Q2Iu3eKMxw3Y1GS9MypZjXvjPfHB959KImNldY80xr0

## Il quadro: le vie

Tutte in JSON, sotto `https://quadro.gdahome.org`.

**Dalla casa** (identita' come verso il centralino: la prima volta che una
`casa_…` si presenta, il quadro ne tiene l'impronta del segreto; dopo, solo
quel segreto entra):

| Via | Corpo | Risposta |
| --- | --- | --- |
| `POST /v1/licenze/casa` | `{casa, segreto}` | `{gettoni: {gdahome?: string, gdanav?: string}, licenze: [{lic, app, origine, scade, prova}]}` |
| `POST /v1/licenze/negozio` | `{casa, segreto, app, piattaforma: "android"\|"ios", prodotto, ricevuta}` | come sopra; `402 {errore}` se la ricevuta non vale; `503 {errore: "verifica-non-configurata"}` se mancano le chiavi del negozio |
| `POST /v1/licenze/riscatta` | `{codice, casa, segreto}` oppure `{codice, telefono, segreto}` | come sopra; `404` codice che non c'e', `409` gia' usato |

**Dal telefono con gdanav da solo**: `POST /v1/licenze/telefono`
`{telefono, segreto}` → come sopra (stessa regola della prima volta).

**Dal gestore** (sessione della pagina del gestore):

- `GET /gestore/licenze` — tutte le licenze e i codici;
- `POST /gestore/licenze` `{app, casa, mesi|null, nota}` — regalo a una casa;
- `POST /gestore/codici` `{app, quanti, mesi|null, nota}` — codici regalo;
- `DELETE /gestore/licenze/:lic` — revoca;
- `PATCH /gestore/installatori/:id` (o `PUT /gestore/installatore/:id`)
  `{pacchetto: {gdahome: {"1": 10, "12": 5}, gdanav: {"sempre": 2}}}` — il
  pacchetto, anche in creazione (`POST /gestore/installatori`). Per ogni app,
  quante licenze per durata: la chiave e' il numero di mesi (1..120, come
  stringa) oppure `"sempre"`. Una app nominata prende quei conti **tutti
  interi** (una durata che non c'e' piu' e' tolta), una non nominata resta
  com'era; gli zeri spariscono. Si accetta anche l'elenco del GET
  (`[{durata, totali}]`) e, come prima, un numero (`gdahome: 5`), che vale
  `{"12": 5}` — anche quando e' scritto cosi' nell'archivio. Una durata non
  valida: `400 {errore: "durata-non-valida"}`, e non si cambia niente.
- `GET /gestore/installatori` — per ogni installatore anche `pacchetto`, nella
  forma dei conti per durata:
  `{gdahome: [{durata: "1", totali: 10, usate: 0}, {durata: "12", totali: 5,
  usate: 2}], gdanav: [{durata: "sempre", totali: 2, usate: 1}]}`, dalla
  durata piu' corta a `"sempre"`. `usate` = licenze date non tolte + codici
  non ancora riscattati ne' annullati. Una durata tolta dal gestore con
  licenze ancora in giro resta nell'elenco con `totali: 0`.

**Dall'installatore** (sessione della sua pagina):

- `GET /licenze` — il suo pacchetto, nella stessa forma del gestore
  (`{gdahome: [{durata, totali, usate}], gdanav: […]}`), le sue licenze, i
  suoi codici (ognuno con `taglio`, la durata del pacchetto da cui viene);
- `POST /licenze` `{app, casa, durata}` — a una delle **sue** case;
- `POST /codici` `{app, durata}` — un codice dal suo pacchetto;
- `DELETE /licenze/:lic`, `DELETE /codici/:codice` — la toglie (o lo annulla
  se non e' stato usato), e il posto torna nella sua durata.

`durata` e' una delle durate del suo pacchetto per quell'app: `"12"`,
`"sempre"` (si accetta anche il numero, e il vecchio `mesi`, con `null` = per
sempre). Il posto preso resta scritto sulla licenza e sul codice (`taglio`), e
un codice riscattato lo passa alla licenza che diventa. Gli errori:

| | |
| --- | --- |
| `400 durata-mancante` | non ha detto la durata |
| `400 durata-non-valida` | non e' un numero di mesi da 1 a 120 ne' `"sempre"` |
| `400 durata-non-nel-pacchetto` | quella durata per quell'app nel suo pacchetto non c'e' |
| `409 pacchetto-esaurito` | c'e', ma e' finita; oppure per quell'app non ha niente |

Una licenza o un codice di un installatore scritti prima delle durate, senza
`taglio`, si contano nei 12 mesi (un codice con i suoi `mesi`, in quelli).

Controllo delle ricevute: Google Play Developer API
(`purchases.subscriptionsv2.get`) con un service account
(`QUADRO_GOOGLE_SERVICE_ACCOUNT`, il JSON), e App Store Server API
(`GET /inApps/v1/transactions/{id}`, e per i rinnovi
`GET /inApps/v1/subscriptions/{originalTransactionId}`) con `QUADRO_APPLE_CHIAVE`,
`QUADRO_APPLE_KEY_ID`, `QUADRO_APPLE_ISSUER`, `QUADRO_APPLE_BUNDLE`. Senza,
`503`: i regali funzionano lo stesso.

## L'add-on

- `ponte/src/licenze.js` chiede `POST /v1/licenze/casa` all'accensione e ogni
  6 ore, tiene l'ultimo gettone in `/data/licenze.json`, lo verifica da se'.
  **Questa chiamata e' separata dal rapporto** (che resta spento di serie):
  manda solo `casa` e `segreto`.
- Comandi sul filo cifrato: `ponte/licenza/stato` → `{gdahome: {attiva,
  scade, origine}, gdanav: {…}, gettoni: {…}}`; `ponte/licenza/negozio`
  `{app, piattaforma, prodotto, ricevuta}`; `ponte/licenza/riscatta` `{codice}`.
- Il segreto che manda al quadro e' quello che la casa ha gia' per il quadro
  (`/data/quadro.json`), non quello del centralino: il segreto del centralino
  non esce verso un'altra macchina.
- Base: `plance.aggiungi` rifiuta la seconda plancia (`premium-richiesto`,
  `POST /api/plance` risponde 402), le plance oltre la principale non si
  servono all'app; un canale che arriva dal centralino e non e' un abbinamento
  viene rifiutato con `motivo: "premium-richiesto"` (l'abbinamento si').
- La console dell'add-on mostra lo stato della licenza e un campo per il
  codice regalo.

## Il centralino

La casa manda il gettone quando si presenta e ogni volta che lo rinnova
(messaggio `{"t": "licenza", "tipo": "licenza", "gettone": "…"}` sul filo della
casa: il protocollo del centralino usa `t`, si mandano tutti e due; stringa
vuota = nessuna licenza; si accetta anche `gettone` dentro `sono-io`). Un
telefono che bussa a `/telefono/<casa>` di una casa **senza gettone gdahome
valido** viene chiuso con codice `4402` e motivo `premium-richiesto`.
L'abbinamento (`/abbinamento/…`) resta aperto a tutti. Con la chiave vuota il
controllo e' spento (tutti passano, come oggi): si accende insieme alla chiave.

## L'app gdahome

- Chiede `ponte/licenza/stato` a ogni collegamento, verifica il gettone, lo
  ricorda per casa. Premium = la casa in uso ha un gettone gdahome valido.
- Una casa che le licenze non le sa tenere — il comando non lo conosce, o
  risponde `attive: false` — si ricorda come `senza_licenze` e resta aperta:
  li' Premium non si puo' comprare.
- Prima dell'iPhone tutto questo vale solo nell'app per iPhone: su Android e
  nel browser non si chiede niente alla casa e non c'e' nessun lucchetto.
- Base: una casa sola (la seconda si aggiunge solo se una casa gia' abbinata
  e' Premium), solo la plancia principale, niente strade fuori casa (centralino
  e indirizzo pubblico), «Configurazione» e «Zigbee» con il lucchetto che porta
  alla pagina Premium.
- La pagina Premium: i due piani coi prezzi del negozio, «Ripristina acquisti»,
  «Ho un codice regalo». Sul web non si compra: si riscatta un codice, o si
  compra dal telefono. Sull'iPhone il codice regalo non c'e' (App Store, regola
  3.1.1): si riscatta in Home Assistant o dal browser.
- Una ricevuta che non arriva alla casa resta aperta nel negozio e si
  riprova. Se non arriva perche' si e' fuori casa con Base, per portarla si
  prende la strada del centralino.
- gdanav riceve `premiumOspite` = la casa in uso e' Premium.

## Il giorno dei pagamenti: le app vecchie si fermano

Le app della fase di prova hanno tutto aperto. Il giorno che esce la versione
pubblica con i pagamenti vanno fermate, se no chi le ha non paghera' mai. Per
questo c'e' un interruttore sul centralino, **spento di serie** (minima `0` =
non si ferma nessuno).

**Come si accende.** Si scrive in `VERSIONE_MINIMA_APP` il numero di
costruzione della prima versione pubblica a pagamento
(`costruzioneDiQuestApp` in `app/lib/versione.dart`, per esempio `1070000`).
E' una variabile d'ambiente del centralino: sta in `/etc/tramite/ambiente`, o
si passa a `VERSIONE_MINIMA_APP=1070000 bash accendi.sh`, che la ricorda ai
giri dopo. Poi si riavvia il servizio.

Il centralino la dice a tutti su `GET /versioni` →
`{"gdahome": {"minima": 1070000}}` (pubblica, CORS aperto, tenuta 5 minuti).
Scritta male vale `0`: un errore di battitura non spegne le app di tutti. Per
riaprire tutto si rimette `0`.

**Chi la legge, e cosa succede.**

- **L'add-on** (`ponte/src/versione-minima.js`) la chiede al suo centralino (o
  a quello di difetto, se la casa non ne usa nessuno) all'accensione e ogni 6
  ore, e tiene l'ultima in `/data/versioni.json`. Il telefono dice il suo
  numero nella prima parola in chiaro della stretta di mano, campo `app`
  (`{v:1, chi, apertura, mia, …, app: 1061100}`; vedi `ponte/src/portiere.js` e
  `app/lib/ponte/stretta.dart`). Con la minima sopra zero, chi non lo dice o ne
  dice uno piu' piccolo si sente rispondere
  `{v:1, no:"…", motivo:"aggiorna-l-app", minima:N}` e la porta si chiude —
  in casa e da fuori, abbinamento compreso.
- **L'app nuova** (`app/lib/aggiornamento_obbligatorio.dart`) la chiede anche
  da se' al centralino di difetto (in `https`) all'avvio, tornando davanti e
  ogni 6 ore, la ricorda sul telefono (senza rete non si riapre) e, se e'
  sotto, si copre tutta con «C'è una versione nuova di gdahome: aggiornala per
  continuare» e il bottone per il negozio. La stessa pagina compare quando la
  casa risponde `aggiorna-l-app`. Nel browser non si ferma mai (l'app web la
  serve l'add-on, sempre della sua stessa costruzione), e nemmeno nelle
  costruzioni di prova, a meno di `--dart-define=VERSIONE_MINIMA_SEMPRE=true`.
- **Le app della prova di oggi** il controllo non ce l'hanno e il numero non
  lo dicono: le ferma l'add-on aggiornato, che le rifiuta; la frase del no
  («questa versione di gdahome e' vecchia: aggiornala dal negozio per
  continuare») la mostrano come mostrano ogni no della casa.

**Prima di accenderla**: l'add-on che esce insieme alla versione a pagamento
deve portarsi l'app web ricostruita (`porta-l-app`), cosi' dice anche lei il
suo numero. Se l'app web di un add-on e' sotto la minima, l'add-on lo scrive
nel registro.

**Il limite.** Una casa che tiene l'add-on vecchio **e** l'app vecchia
continua a funzionare sulla rete di casa: nessuno dei due sa della minima. Da
fuori invece no: il centralino, una volta scritta la chiave delle licenze,
chiude i telefoni delle case senza gettone Premium, e l'add-on vecchio il
gettone non lo manda. Il numero `app` non lo firma nessuno: e' un cancello
per le app della prova, non una serratura.
