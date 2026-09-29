# Accendere gli acquisti

Tutto è pronto e **spento**. Questa pagina è quello che si legge il giorno che
si accende. Non serve ricordarsi niente: c'è un comando che dice a che punto
sei.

    node strumenti/accendi-gli-acquisti.mjs

Di suo **non accende niente**: guarda e racconta. Accende solo con `--fallo`.

## L'interruttore è uno solo

`CHIAVE_PUBBLICA_LICENZE`. Finché è la stringa vuota — com'è oggi — nessun
gettone vale, l'add-on non limita niente, l'app non mette lucchetti e il
centralino lascia passare tutti. Non c'è nessun altro posto da toccare, e
nessun altro modo di accendere per sbaglio.

Sta in tre file qui (`ponte`, `centralino`, `app`) e in uno in
gdanav. Li scrive tutti `strumenti/chiave-licenze.mjs`, e una prova controlla
che siano d'accordo fra loro: se uno restasse indietro, una parte verificherebbe
e un'altra no, e non se ne accorgerebbe nessuno finché non chiama un cliente.

## Prima l'iPhone

C'è una tappa in mezzo, ed è quella di adesso: **Premium si vende solo
nell'app per iPhone**, che è la prima a uscire nell'App Store. Android è
ancora in prova interna, e lì come nel browser resta tutto aperto.

| | spento | prima l'iPhone | per tutti |
|---|---|---|---|
| chiave nell'add-on e nell'app | vuota | **sì** | sì |
| chiave nel centralino | vuota | vuota | sì |
| `LICENZE_SOLO_SULL_IPHONE` | `false` | **`true`** | `false` |
| la casa chiede i gettoni e gira le ricevute | no | **sì** | sì |
| la casa si limita (plance, telefoni da fuori) | no | **no** | sì, se Base |
| lucchetti e negozio nell'app | no | **solo sull'iPhone** | dappertutto |

Si scrive così, con la pubblica che la macchina del quadro ha stampato:

    node strumenti/chiave-licenze.mjs --solo-iphone --pubblica <la pubblica>

**La coppia qui non si fabbrica.** Nasce sulla macchina del quadro, con un
comando che scrive la privata in `/etc/quadro/ambiente` e stampa solo la
pubblica: la privata non passa da nessun terminale che non sia quello, da
nessuna chat, da nessun file della repository. Prima di questa tappa lì
servono anche le credenziali di Apple (`QUADRO_APPLE_*`), se no le ricevute
dell'iPhone rispondono 503.

Cosa fa l'app per iPhone, e perché:

- **Una casa con l'add-on vecchio non si chiude.** Un add-on che le licenze
  non le sa tenere — di prima, o con la chiave vuota — non può ricevere un
  acquisto: un lucchetto lì sarebbe senza chiave. L'app se lo ricorda
  (`senza_licenze` nell'archivio delle case) e la lascia aperta finché
  l'add-on non si aggiorna.
- **Niente «Ho un codice regalo».** Per l'App Store aprire una funzione con un
  codice nostro è una «chiave di licenza» (regola 3.1.1), e l'app torna
  indietro dalla revisione. I codici si riscattano dalla scheda gdahome in
  Home Assistant, o dal browser, e Premium arriva anche sull'iPhone: è della
  casa.
- **Chi compra fuori casa entra subito.** Con la casa Base le strade di fuori
  sono chiuse, e la ricevuta aspetterebbe il Wi-Fi di casa. Con una ricevuta
  da portare invece si bussa al centralino — che prima dell'iPhone lascia
  passare — e appena la casa l'ha avuta è Premium. È anche quello che fa
  chi rivede l'app per Apple, da lontano, con una casa di prova Base.

Il giorno che si accende per tutti, `--fallo` riconosce la tappa e **tiene
la stessa chiave**: la privata è già sul quadro e ha già firmato i gettoni
in giro. Scrive la pubblica anche nel centralino, e spegne la bandierina.

## L'ordine, e perché è quello

### Prima di girare l'interruttore

1. **I prodotti nei negozi, attivi.** `gdahome_premium` con i piani `mensile` e
   `annuale`, e i due prodotti di App Store Connect, con la prova di 14 giorni.
   *Perché prima:* una casa che diventa Base senza un prodotto da comprare ha un
   lucchetto e nessuna chiave.
2. **Le credenziali dei negozi sulla macchina del quadro.**
   `QUADRO_GOOGLE_SERVICE_ACCOUNT` e le quattro di Apple. Senza, i regali
   funzionano e gli acquisti rispondono 503.
3. **Le licenze regalate a chi deve tenerle** — le tue case, chi prova, gli
   installatori. *Perché prima:* dopo vuol dire che per un po' sono Base.

### Girare l'interruttore

    node strumenti/accendi-gli-acquisti.mjs --fallo

Gira le prove, fabbrica la coppia, scrive la pubblica nei file e **stampa la
privata una volta sola**. Quella va solo nell'ambiente della macchina del
quadro, come `QUADRO_LICENZE_CHIAVE`: in nessun file, in nessun commit. Chi ce
l'ha fa Premium chiunque.

Se gdanav non è nella cartella accanto, il comando lo dice e lascia scritto come
rimettercela.

### Dopo

4. **Un acquisto vero in sandbox.** Comprare davvero da una build interna e
   guardare il giro intero: negozio → casa → quadro → gettone → `ponte/licenza/stato`
   dice Premium. È l'unico modo di sapere che la catena gira.
5. **Rilasciare add-on e app.** Le case si aggiornano da sole, una per volta. I
   limiti locali scattano man mano, casa per casa.
6. **Aspettare.** Il numero è `pronte_alla_licenza` contro `case`, nei numeri
   del centralino (`GET /numeri`).
7. **Per ultimo il centralino.**

## Il passo 7 è quello che fa male

Là il controllo si accende **per tutti insieme**, e una casa con l'add-on
vecchio un gettone non lo manda affatto — non perché non paga, ma perché quella
versione del ponte le licenze non le conosce. Si chiuderebbe fuori da sola,
pagante o no.

Per questo esiste `pronte_alla_licenza`: quante delle case collegate adesso
sanno dire la loro licenza. Si conta **anche a controllo spento**, cioè da oggi,
se no il numero arriverebbe il giorno dopo averne avuto bisogno.

| | |
|---|---|
| `pronte_alla_licenza` = `case` | si può accendere il centralino |
| `pronte_alla_licenza` < `case` | accendere toglie l'accesso da fuori a quella differenza |

Non c'è una soglia giusta scritta da nessuna parte: è una scelta, ed è tua.
Quello che il numero ti dà è **quante case** stai per chiudere fuori, invece di
scoprirlo dalle telefonate.

## Se qualcosa va storto

- **La privata è uscita.** Se ne fabbrica un'altra e si rilascia tutto: i
  gettoni vecchi smettono di valere entro otto giorni, e le case li rinnovano da
  sole.
- **Si è acceso troppo presto.** Si rimette la chiave vuota e si rilascia: tutti
  tornano come prima. Sul centralino basta togliere la chiave e riavviare —
  quello è il pezzo che si rimette a posto in un minuto.
- **Una casa pagante è rimasta fuori.** Dalla pagina del gestore le si regala
  una licenza subito; il gettone le arriva al prossimo giro (sei ore, o al
  riavvio dell'add-on).

## Quello che l'interruttore non fa

Non blocca chi si modifica l'add-on in casa propria. Le funzioni che girano lì
dentro — le plance in più, la configurazione dall'app, lo Zigbee — sono sul suo
computer, e nessun sistema al mondo lo impedisce. Quello che è protetto davvero
è ciò che passa dalle tue macchine: l'accesso da fuori casa, l'emissione delle
licenze, la verifica delle ricevute. Il conto completo sta in
[`BLINDATURA.md`](BLINDATURA.md).
