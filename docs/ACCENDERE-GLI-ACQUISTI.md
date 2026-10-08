# Accendere gli acquisti

**Dalla 1.10.0 il primo passo è fatto**: la chiave è nell'add-on e nell'app, il
centralino è ancora senza. Fino alla 1.9.2 tutto era pronto e spento. Questa
pagina dice come si accende, e cosa resta: il secondo passo, quello del
centralino. Non serve ricordarsi niente: c'è un comando che dice a che punto
sei.

    node strumenti/accendi-gli-acquisti.mjs

Di suo **non accende niente**: guarda e racconta. Con `--fallo` fa solo
l'ultimo passo, quello del centralino.

## L'interruttore è uno solo

`CHIAVE_PUBBLICA_LICENZE`. Finché è la stringa vuota — com'è stata fino alla
1.9.2 — nessun gettone vale, l'app non mette lucchetti e il centralino lascia
passare tutti. Non c'è nessun altro posto da toccare, e nessun altro modo di
accendere per sbaglio. Dalla 1.10.0 nell'add-on e nell'app c'è la pubblica
della macchina del quadro; nel centralino è ancora vuota.

Sta in tre file qui (`ponte`, `centralino`, `app`) e in uno in gdanav. Li
scrive tutti `strumenti/chiave-licenze.mjs`, e una prova controlla che siano
d'accordo fra loro: se uno restasse indietro, una parte verificherebbe e
un'altra no, e non se ne accorgerebbe nessuno finché non chiama un cliente.

## Due passi, con la stessa chiave

Premium si vende nell'app gdahome, sull'iPhone e su Android, e vale per tutta
la casa: anche sugli altri telefoni abbinati e nel browser. Si accende in due
passi.

| | spento (fino alla 1.9.2) | primo passo (dalla 1.10.0) | secondo passo |
|---|---|---|---|
| chiave nell'add-on e nell'app | vuota | **sì** | sì |
| chiave nel centralino | vuota | vuota | **sì** |
| la casa chiede i gettoni e gira le ricevute | no | sì | sì |
| la casa si limita | no | no | no |
| lucchetti di Base nell'app e nel browser | no | sì | sì |
| si compra nell'app, sull'iPhone e su Android | no | sì | sì |
| il fuori casa vuole Premium | no | no | **sì** |

**La casa non limita mai niente.** Tiene la licenza, gira le ricevute e dice
com'è messa; i lucchetti di Base li mettono l'app e il browser, e il fuori
casa lo chiude il centralino. È la scelta del 29 settembre: «base funziona e
anche addon funziona».

### La coppia nasce sulla macchina del quadro

**Qui la coppia non si fabbrica.** Sulla macchina del quadro, da root, c'è lo
strumento che la fa (`quadro/le-licenze.mjs`, che sul quadro sta in
`/opt/quadro/quadro`):

    cd /opt/quadro/quadro
    node le-licenze.mjs chiave
    systemctl restart quadro

1. Lo strumento fa la coppia, scrive la privata in `/etc/quadro/ambiente` e
   stampa **solo la pubblica**: «La pubblica: …». La privata non la stampa
   mai.
2. Se la chiave c'è già, non la cambia: ne ridice la pubblica. È anche il modo
   di ritrovarla quando serve.
3. Dopo il riavvio, il registro del quadro deve dire «le licenze sono accese:
   la pubblica è …», la stessa:

       journalctl -u quadro -b --no-pager | grep -iE "licenze|ricevute"

4. Di lì esce **solo la pubblica**: è quella che serve qui, e si può mandare
   in chat. La privata non va in nessun file della repository, in nessun
   commit, in nessun segreto di GitHub, in nessuna chat. Chi ce l'ha fa
   Premium chiunque.

Lo strumento arriva sul quadro col rilascio che lo contiene: il quadro segue
l'etichetta `tramite` e si aggiorna da solo entro dieci minuti.

### Il primo passo: l'add-on e l'app

    node strumenti/chiave-licenze.mjs --senza-centralino --pubblica <la pubblica>

La pubblica va nell'add-on e nell'app; il centralino resta senza, e il fuori
casa aperto a tutti. Lo strumento rifiuta la pubblica di prova dei documenti.
gdanav non si tocca: dentro gdahome segue la casa.

Cosa fa l'app, e perché:

- **Si compra sull'iPhone e su Android.** I due piani coi prezzi del negozio e
  la prova di 14 giorni; «Ripristina abbonamento» prima chiede, perché un
  abbonamento vale per una casa alla volta e ripristinarlo lo toglie alla casa
  dove sta.
- **Una casa con l'add-on vecchio resta Base e lì non si compra.** Un add-on
  che le licenze non le sa tenere non può ricevere un acquisto. L'app se lo
  ricorda (`senza_licenze` nell'archivio delle case), e la pagina Premium dice
  di aggiornare l'add-on invece di proporre un abbonamento: nessuno paga per
  una casa che non può diventare Premium.
- **Niente «Ho un codice regalo» sull'iPhone.** Per l'App Store aprire una
  funzione con un codice nostro è una «chiave di licenza» (regola 3.1.1), e
  l'app torna indietro dalla revisione. I codici si riscattano dall'app per
  Android, dalla scheda gdahome in Home Assistant o dal browser, e Premium
  arriva anche sull'iPhone: è della casa.
- **Chi compra fuori casa entra subito.** Con la casa Base le strade di fuori
  sono chiuse, e la ricevuta aspetterebbe il Wi-Fi di casa. Invece la porta
  il centralino: l'app gliela consegna firmata con la chiave del telefono, la
  casa controlla la firma e la gira al quadro, e il gettone torna indietro
  subito. Funziona al primo passo e al secondo, col fuori casa chiuso.
- **La casa di prova resta Premium.** Chi rivede l'app per Apple o per Google
  entra da lontano col codice della casa di prova, e la casa di prova ha
  Premium regalato: Google vede tutto senza comprare, perché lì chi rivede non
  compra. Apple invece vuole provare l'acquisto, e allora sul telefono entrato
  con quel codice la pagina Premium tiene in vista gli abbonamenti anche con
  la casa Premium (`telefonoDiProva` in `ponte/licenza/stato`, dalla 1.10.4).
  Sugli altri telefoni la pagina resta quella di sempre.
- **Un acquisto rimasto a metà non si perde.** Su Google Play un acquisto
  pagato con l'app chiusa prima che la casa rispondesse non torna da solo:
  all'avvio l'app chiede quelli non ancora confermati e li riporta alla casa.
  Sull'App Store lo fa StoreKit.

### Il secondo passo: il centralino, per ultimo

    node strumenti/accendi-gli-acquisti.mjs --fallo

Riconosce il primo passo, gira le prove e **tiene la stessa chiave**: la
privata è già sul quadro e ha già firmato i gettoni in giro. Scrive la
pubblica anche nel centralino (e in gdanav, se è nella cartella accanto). Su
una repository ancora spenta si rifiuta: prima viene il primo passo. Se gdanav
non è accanto, il comando dice come rimetterci la chiave.

### Le prove, il giorno della chiave

Le prove passano in tutti e tre gli stati: spento, primo passo, secondo passo.
Nessuna prova scrive nei file della chiave: `--fallo` si prova su una copia di
passaggio, mai su questa repository. Le prove che accendono una casa vera la
fanno bussare a una porta chiusa di questa macchina (`PONTE_QUADRO_DOVE`), e
mai al quadro vero, che se no si riempirebbe di case finte a ogni giro della
CI. Quelle che provano la strada da fuori accendono il centralino senza chiave,
perché una casa di prova non ha un gettone firmato dal quadro.

## Le credenziali dei negozi

Il quadro controlla ogni ricevuta col negozio che l'ha emessa. Senza le sue
credenziali i regali funzionano, e gli acquisti rispondono 503: su Android
senza quelle di Google, sull'iPhone senza quelle di Apple. Si scrivono con lo
stesso strumento della chiave, che le mette in `/etc/quadro/ambiente` nella
forma che vuole systemd e non ne stampa nessuna.

**Google Play: un service account.** In Google Cloud, nel progetto collegato
alla Play Console, se ne crea uno nuovo solo per il quadro (IAM → Account di
servizio → Crea), e gli si aggiunge una chiave JSON (Chiavi → Aggiungi chiave
→ JSON): si scarica un file. Nella Play Console lo si invita fra gli utenti
(Utenti e autorizzazioni), con i permessi sui dati finanziari e su ordini e
abbonamenti dell'app gdahome. Google può metterci qualche ora ad accettarlo.

**App Store: una chiave per gli acquisti in-app.** In App Store Connect, Utenti
e accesso → Integrazioni → Acquisto in-app: si genera una chiave e si scarica
il file `.p8` (una volta sola). Sulla stessa pagina ci sono il Key ID (dieci
caratteri) e l'Issuer ID.

I due file si portano sulla macchina del quadro (per esempio con `scp`, in
`/root`), e da root:

    cd /opt/quadro/quadro
    node le-licenze.mjs google /root/google.json
    node le-licenze.mjs apple /root/AuthKey_XXXXXXXXXX.p8 XXXXXXXXXX <issuer id>
    shred -u /root/google.json /root/AuthKey_XXXXXXXXXX.p8
    systemctl restart quadro

Nel registro non devono più esserci le righe «senza le chiavi di Google Play»
o «senza le chiavi di App Store». `node le-licenze.mjs`, senza altro, dice cosa
c'è e cosa manca. Le credenziali non vanno in nessun altro posto: né nella
repository, né su GitHub, né in chat.

## L'ordine, e perché è quello

### Prima della chiave

1. **I prodotti nei negozi, attivi.** Nella Play Console l'abbonamento
   `gdahome_premium` con i piani base `mensile` e `annuale`; in App Store
   Connect i prodotti `gdahome_premium_mensile` e `gdahome_premium_annuale`
   nel gruppo «gdahome Premium». Tutti con la prova di 14 giorni. *Perché
   prima:* una casa che diventa Base senza un prodotto da comprare ha un
   lucchetto e nessuna chiave.
2. **Il rilascio che porta lo strumento sul quadro.** Con lui arriva anche
   l'app che sa vendere su Android: spenta finché non c'è la chiave.
3. **Le credenziali dei negozi sul quadro**, come sopra.
4. **Le licenze regalate a chi deve tenerle** — le tue case, chi prova, gli
   installatori. *Perché prima:* dopo vuol dire che per un po' sono Base.

### La chiave, e dopo

5. **La coppia sul quadro**, come sopra: ne esce la pubblica.
6. **Il primo passo**, con la pubblica, e una versione nuova dell'add-on e
   dell'app: l'app va nel test interno del Play Store e su TestFlight.
7. **Un acquisto vero in sandbox, su tutti e due i telefoni.** Comprare
   davvero dalla build interna e guardare il giro intero: negozio → casa →
   quadro → gettone → la pagina Premium dice Premium. È l'unico modo di sapere
   che la catena gira coi negozi veri.
8. **Rilasciare add-on e app**, con gli abbonamenti dentro la revisione dei
   negozi. Le case si aggiornano da sole, una per volta.
9. **Per ultimo il centralino e le app vecchie**, quando l'app nuova è nei
   negozi per tutti: `--fallo`, poi si rilascia il centralino col bottone «Il
   tramite» su Actions, e si alza la versione minima delle app (sotto).

## Il secondo passo è quello che fa male

Là il controllo si accende **per tutti insieme**. Una casa con l'add-on
vecchio un gettone non lo manda affatto — non perché non paga, ma perché
quella versione del ponte le licenze non le conosce — e da fuori casa non
entra più: il centralino le risponde «aggiorna l'add-on» (`4426`) invece di
«serve Premium». Nessuno ha pagato a vuoto, perché con l'add-on vecchio l'app
non vende; ma quella casa, da fuori, resta chiusa finché non si aggiorna.

Per questo esiste `pronte_alla_licenza`: quante delle case collegate adesso
sanno dire la loro licenza. Si conta **anche a controllo spento**, cioè da
oggi, se no il numero arriverebbe il giorno dopo averne avuto bisogno. Si
legge in `GET /salute` del centralino, chiesto dalla macchina stessa
(`curl http://127.0.0.1:8099/salute`): da fuori quei numeri non si vedono.

| | |
|---|---|
| `pronte_alla_licenza` = `case` | si può accendere il centralino |
| `pronte_alla_licenza` < `case` | accendere chiude il fuori casa a quella differenza, finché non aggiornano |

Non c'è una soglia giusta scritta da nessuna parte: è una scelta, ed è tua.
Quello che il numero ti dà è **quante case** sentiranno «aggiorna l'add-on»,
invece di scoprirlo dalle telefonate.

## Le app vecchie

Un'app di prima della chiave ha tutto aperto, e lo tiene: i suoi lucchetti
non esistono. Il centralino le chiude il fuori casa, ma le plance in più, la
configurazione e Zigbee restano aperte finché non si aggiorna. Per questo il
centralino ha la versione minima delle app (`VERSIONE_MINIMA_APP`, spenta di
serie): con la prima versione con la chiave — la 1.10.0 è la costruzione
`1100000` — chi ha un'app più vecchia si sente dire di aggiornarla, in casa e
da fuori. Si alza solo quando quella versione si può scaricare da tutti e due
i negozi, per tutti. Come si fa sta in
[`LICENZE.md`](LICENZE.md#il-giorno-dei-pagamenti-le-app-vecchie-si-fermano).

## I rinnovi

Un abbonamento si rinnova da sé, e il negozio lo fa a periodo finito: Google
alla scadenza, Apple nel giorno prima. Il quadro lo scopre entro un'ora e la
casa richiede i gettoni ogni sei ore. Per questo una licenza del negozio vale
**tre giorni** oltre il periodo pagato: chi paga non resta mai Base per un
rinnovo in ritardo. A schermo si legge sempre la fine del periodo pagato; nei
tre giorni, «Premium è attivo · abbonamento». Chi disdice tiene Premium al
massimo tre giorni in più.

## Se qualcosa va storto

- **Il quadro dice ancora «senza le chiavi di …».** `node le-licenze.mjs`
  sulla macchina del quadro dice cosa manca e cosa c'è ma non si legge.
- **La privata è uscita.** Si toglie a mano la riga `QUADRO_LICENZE_CHIAVE` da
  `/etc/quadro/ambiente`, se ne fa un'altra con `node le-licenze.mjs chiave`,
  si scrive la pubblica nuova con `chiave-licenze.mjs --pubblica` e si
  rilascia tutto: i gettoni vecchi smettono di valere entro otto giorni, e le
  case li rinnovano da sole.
- **Si è acceso troppo presto.** Si rimette la chiave vuota e si rilascia:
  tutti tornano come prima. Sul centralino basta togliere la chiave e
  riavviare — quello è il pezzo che si rimette a posto in un minuto.
- **Una casa pagante è rimasta fuori.** Dalla pagina del gestore le si regala
  una licenza subito; il gettone le arriva al prossimo giro (sei ore, o al
  riavvio dell'add-on).

## Quello che l'interruttore non fa

Non blocca chi si modifica l'add-on o l'app in casa propria. Le funzioni che
girano lì dentro — le plance in più, la configurazione, lo Zigbee — sono sul
suo computer, e nessun sistema al mondo lo impedisce. Quello che è protetto
davvero è ciò che passa dalle tue macchine: l'accesso da fuori casa,
l'emissione delle licenze, la verifica delle ricevute. Il conto completo sta
in [`BLINDATURA.md`](BLINDATURA.md).
