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
2. **Regalo del gestore**: dalla pagina del gestore del quadro si regalano
   licenze a una casa (per `casa_…`) o si generano **codici regalo** (per
   gdahome o gdanav, di N mesi o per sempre).
3. **Regalo dell'installatore**: quando il gestore crea (o modifica) un
   installatore gli da' un **pacchetto**: quante licenze gdahome e quante
   gdanav. L'installatore dalla sua pagina ne assegna una a una delle sue case,
   o genera un codice da dare al cliente. Se la toglie, torna nel pacchetto.

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
  "emesso": 1759300000000
}
```

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
- `nuvola/src/chiave-licenze.js`
- `app/lib/licenza/chiave.dart`
- in gdanav: `packages/gdanav_app/lib/stato/chiave_licenze.dart`

**Di serie e' vuota**: nessun gettone vale, tutti sono Base (e gdanav fa quello
che fa oggi col negozio). Prima del rilascio si lancia una volta

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
| `POST /v1/licenze/casa` | `{casa, segreto}` | `{gettoni: {gdahome?: string, gdanav?: string}, licenze: [{lic, app, origine, scade}]}` |
| `POST /v1/licenze/negozio` | `{casa, segreto, app, piattaforma: "android"\|"ios", prodotto, ricevuta}` | come sopra; `402 {errore}` se la ricevuta non vale; `503 {errore: "verifica-non-configurata"}` se mancano le chiavi del negozio |
| `POST /v1/licenze/riscatta` | `{codice, casa, segreto}` oppure `{codice, telefono, segreto}` | come sopra; `404` codice che non c'e', `409` gia' usato |

**Dal telefono con gdanav da solo**: `POST /v1/licenze/telefono`
`{telefono, segreto}` → come sopra (stessa regola della prima volta).

**Dal gestore** (sessione della pagina del gestore):

- `GET /gestore/licenze` — tutte le licenze e i codici;
- `POST /gestore/licenze` `{app, casa, mesi|null, nota}` — regalo a una casa;
- `POST /gestore/codici` `{app, quanti, mesi|null, nota}` — codici regalo;
- `DELETE /gestore/licenze/:lic` — revoca;
- `PATCH /gestore/installatori/:id` `{pacchetto: {gdahome, gdanav}}` — il
  pacchetto (anche in creazione, `POST /installatori`).

**Dall'installatore** (sessione della sua pagina):

- `GET /licenze` — il suo pacchetto (`{gdahome: {totali, usate}, gdanav: …}`),
  le sue licenze, i suoi codici;
- `POST /licenze` `{app, casa, mesi|null}` — a una delle **sue** case;
- `POST /codici` `{app, mesi|null}` — un codice dal suo pacchetto;
- `DELETE /licenze/:lic` — la toglie, torna nel pacchetto.

Controllo delle ricevute: Google Play Developer API
(`purchases.subscriptionsv2.get`) con un service account
(`QUADRO_GOOGLE_SERVICE_ACCOUNT`, il JSON), e App Store Server API
(`GET /inApps/v1/transactions/{id}`) con `QUADRO_APPLE_CHIAVE`,
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

## Il centralino (centralino e nuvola)

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
- Base: una casa sola (la seconda si aggiunge solo se una casa gia' abbinata
  e' Premium), solo la plancia principale, niente strade fuori casa (centralino
  e indirizzo pubblico), «Configurazione» e «Zigbee» con il lucchetto che porta
  alla pagina Premium.
- La pagina Premium: i due piani coi prezzi del negozio, «Ripristina acquisti»,
  «Ho un codice regalo». Sul web non si compra: si riscatta un codice, o si
  compra dal telefono.
- gdanav riceve `premiumOspite` = la casa in uso e' Premium.
