# L'app sull'iPhone

Su Android un pacchetto lo scarichi e lo installi. Su iPhone no: Apple non lo
permette. L'unica strada senza computer è **TestFlight**, e TestFlight vuole
l'account sviluppatore Apple — 99 € l'anno, non c'è modo di aggirarlo.

Questo documento serve a fare tutto **dal telefono**, in mezz'ora, una volta
sola.

## Cosa c'è già

L'app per iPhone è scritta e compila: il lavoro «iPhone (IPA)» su GitHub la
costruisce a ogni giro e diventa verde. Quello che manca è solo la firma di
Apple.

I permessi che l'iPhone chiede sono già scritti, e sono quattro:

| Cosa | Perché |
|---|---|
| Fotocamera | Il codice a quadretti che collega l'app alla casa, e le foto da allegare a una segnalazione |
| Galleria | Scegliere una foto già scattata |
| Microfono | Solo se registri un video |
| **Rete locale** | Parlare con Home Assistant quando sei in casa, senza passare da internet |

L'ultimo è quello che quasi tutti dimenticano. Da iOS 14 un'app che non lo
dichiara non riceve un rifiuto educato: **non riceve niente**, e sembra che la
casa non risponda proprio quando è nella stanza accanto.

## I quattro segreti da caricare

Servono a far firmare l'app da Apple senza avere un Mac. Si prendono tutti da
[App Store Connect](https://appstoreconnect.apple.com), che funziona dal
browser del telefono.

1. **Users and Access → Integrations → App Store Connect API → +**
   Nome: `gdahome`, ruolo: **App Manager**.
   Ti fa scaricare un file `AuthKey_XXXXXXXX.p8`. **Si scarica una volta sola**:
   se lo perdi, si rifà la chiave.
2. Sulla stessa pagina leggi **Key ID** (otto caratteri) e **Issuer ID** (una
   riga lunga con i trattini).
3. Il **Team ID** sta su [developer.apple.com/account](https://developer.apple.com/account)
   → Membership: dieci caratteri.

Poi, su GitHub: **Settings → Secrets and variables → Actions → New repository
secret**, quattro volte.

| Nome del segreto | Cosa ci metti |
|---|---|
| `APPLE_CHIAVE_P8` | Tutto il contenuto del file `.p8`, righe `-----BEGIN` e `-----END` comprese |
| `APPLE_CHIAVE_ID` | Il Key ID |
| `APPLE_EMITTENTE` | L'Issuer ID |
| `APPLE_SQUADRA` | Il Team ID |

Da quel momento il lavoro «L'app da provare» firma l'app e la manda su
TestFlight da solo. Non serve né certificato né profilo: con la chiave qui
sopra se li fa dare da Apple e se li tiene lui.

## Poi

Apple ti manda una mail quando la versione è pronta (qualche minuto). Installi
**TestFlight** dall'App Store, entri con lo stesso account, e l'app è lì.

Da TestFlight la puoi dare da provare fino a **10.000 persone**: basta il loro
indirizzo mail, e non serve che passino dall'App Store.

## Cosa cambia rispetto ad Android

Niente, dentro. È la stessa app: stesso filo, stessa plancia, stessa
configurazione. Cambiano tre cose fuori:

- **Il permesso della rete locale** te lo chiede la prima volta che cerchi la
  casa. Dicendo di no, in casa non entra — resta il centralino, che è più
  lento.
- **Le notifiche** vogliono un certificato in più, e per ora l'app non ne manda.
- **Il pacchetto pesa di più**: iOS non sa fare quello che Android fa con gli
  APK divisi per processore.

## Se un giorno vuoi metterla sull'App Store

Da TestFlight all'App Store è un bottone, ma in mezzo c'è la revisione di
Apple: vogliono una descrizione, le fotografie, un'informativa privacy
raggiungibile da un indirizzo pubblico, e una risposta alla domanda «che dati
raccogli». gdahome non raccoglie niente e non manda niente a nessuno: la
risposta è corta, ma va scritta.
