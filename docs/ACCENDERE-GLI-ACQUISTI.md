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

Sta in quattro file qui (`ponte`, `centralino`, `nuvola`, `app`) e in uno in
gdanav. Li scrive tutti `strumenti/chiave-licenze.mjs`, e una prova controlla
che siano d'accordo fra loro: se uno restasse indietro, una parte verificherebbe
e un'altra no, e non se ne accorgerebbe nessuno finché non chiama un cliente.

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
7. **Per ultimo il centralino, e la nuvola.**

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
