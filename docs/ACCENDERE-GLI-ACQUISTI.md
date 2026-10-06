# Accendere gli acquisti

Tutto è pronto e **spento**. Questa pagina è quello che si legge il giorno che
si accende. Non serve ricordarsi niente: c'è un comando che dice a che punto
sei.

    node strumenti/accendi-gli-acquisti.mjs

Di suo **non accende niente**: guarda e racconta. Con `--fallo` fa solo
l'ultimo passo, quello del centralino.

## L'interruttore è uno solo

`CHIAVE_PUBBLICA_LICENZE`. Finché è la stringa vuota — com'è oggi — nessun
gettone vale, l'app non mette lucchetti e il centralino lascia passare tutti.
Non c'è nessun altro posto da toccare, e nessun altro modo di accendere per
sbaglio.

Sta in tre file qui (`ponte`, `centralino`, `app`) e in uno in gdanav. Li
scrive tutti `strumenti/chiave-licenze.mjs`, e una prova controlla che siano
d'accordo fra loro: se uno restasse indietro, una parte verificherebbe e
un'altra no, e non se ne accorgerebbe nessuno finché non chiama un cliente.

## Due passi, con la stessa chiave

Premium si vende nell'app gdahome, sull'iPhone e su Android, e vale per tutta
la casa: anche sugli altri telefoni abbinati e nel browser. Si accende in due
passi.

| | spento | primo passo | secondo passo |
|---|---|---|---|
| chiave nell'add-on e nell'app | vuota | **sì** | sì |
| chiave nel centralino | vuota | vuota | **sì** |
| la casa chiede i gettoni e gira le ricevute | no | sì | sì |
| la casa si limita | no | no | no |
| lucchetti di Base nell'app e nel browser | no | sì | sì |
| il fuori casa vuole Premium | no | no | **sì** |

**La casa non limita mai niente.** Tiene la licenza, gira le ricevute e dice
com'è messa; i lucchetti di Base li mettono l'app e il browser, e il fuori
casa lo chiude il centralino. È la scelta del 29 settembre: «base funziona e
anche addon funziona».

### La coppia nasce sulla macchina del quadro

**Qui la coppia non si fabbrica.** Sulla macchina del quadro, dalla sua copia
della repository:

    node strumenti/chiave-licenze.mjs --radice /tmp/chiave-licenze

Il comando fa la coppia, scrive la pubblica in una cartella di passaggio e
stampa due righe: la pubblica e `QUADRO_LICENZE_CHIAVE=…`, la privata.

1. La riga della privata va in `/etc/quadro/ambiente`, accanto alle altre
   chiavi del quadro. Poi si riavvia il quadro, e nel registro si controlla
   che dica «le licenze sono accese: la pubblica è …».
2. Si cancella `/tmp/chiave-licenze`. La privata non va in nessun file della
   repository, in nessun commit, in nessun segreto di GitHub, in nessuna chat.
   Chi ce l'ha fa Premium chiunque.
3. Di lì esce **solo la pubblica**: è quella che serve qui.

### Il primo passo: l'add-on e l'app

    node strumenti/chiave-licenze.mjs --senza-centralino --pubblica <la pubblica>

La pubblica va nell'add-on e nell'app; il centralino resta senza, e il fuori
casa aperto a tutti. Lo strumento rifiuta la pubblica di prova dei documenti.
gdanav non si tocca: dentro gdahome segue la casa.

Cosa fa l'app, e perché:

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
  sono chiuse, e la ricevuta aspetterebbe il Wi-Fi di casa. Con una ricevuta
  da portare invece si bussa al centralino — che al primo passo lascia
  passare — e appena la casa l'ha avuta è Premium. È anche quello che fa chi
  rivede l'app per Apple o per Google, da lontano, con una casa di prova Base.

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

## L'ordine, e perché è quello

### Prima della chiave

1. **I prodotti nei negozi, attivi.** Nella Play Console l'abbonamento
   `gdahome_premium` con i piani base `mensile` e `annuale`; in App Store
   Connect i prodotti `gdahome_premium_mensile` e `gdahome_premium_annuale`
   nel gruppo «gdahome Premium». Tutti con la prova di 14 giorni. *Perché
   prima:* una casa che diventa Base senza un prodotto da comprare ha un
   lucchetto e nessuna chiave.
2. **Le credenziali dei negozi sulla macchina del quadro.**
   `QUADRO_GOOGLE_SERVICE_ACCOUNT` per Google e le quattro di Apple
   (`QUADRO_APPLE_CHIAVE`, `QUADRO_APPLE_KEY_ID`, `QUADRO_APPLE_ISSUER`,
   `QUADRO_APPLE_BUNDLE`). Senza, i regali funzionano e gli acquisti
   rispondono 503: su Android senza la prima, sull'iPhone senza le altre.
3. **Le licenze regalate a chi deve tenerle** — le tue case, chi prova, gli
   installatori. *Perché prima:* dopo vuol dire che per un po' sono Base.

### La chiave, e dopo

4. **La coppia sul quadro e il primo passo**, come sopra.
5. **Un acquisto vero in sandbox, su tutti e due i telefoni.** Comprare
   davvero da una build interna (il test interno del Play Store, TestFlight) e
   guardare il giro intero: negozio → casa → quadro → gettone →
   `ponte/licenza/stato` dice Premium. È l'unico modo di sapere che la catena
   gira.
6. **Rilasciare add-on e app.** Le case si aggiornano da sole, una per volta.
7. **Per ultimo il centralino**, quando l'app nuova è nei negozi: `--fallo`, e
   poi si rilascia il centralino col bottone «Il tramite» su Actions.

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

## I rinnovi

Un abbonamento si rinnova da sé, e il negozio lo fa a periodo finito: Google
alla scadenza, Apple nel giorno prima. Il quadro lo scopre entro un'ora e la
casa richiede i gettoni ogni sei ore. Per questo una licenza del negozio vale
**tre giorni** oltre il periodo pagato: chi paga non resta mai Base per un
rinnovo in ritardo. A schermo si legge sempre la fine del periodo pagato. Chi
disdice tiene Premium al massimo tre giorni in più.

## Se qualcosa va storto

- **La privata è uscita.** Se ne fa un'altra sulla macchina del quadro, come
  sopra, si scrive la pubblica nuova con `chiave-licenze.mjs --pubblica` e si
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
