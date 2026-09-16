# L'officina della plancia

Qui dentro c'è il progetto **DashboardModern**, tutto: i suoi strumenti, le sue
prove, i suoi documenti, la sua integrazione per Home Assistant e le macchine
che lo costruivano.

Fino a settembre 2026 stava in una repository sua, `dashboardmodern-v2`. Quella
repository non esiste più: il progetto vive qui, e da qui si aggiorna e si
corregge. Questa cartella è la sua metà che **non si serve a nessuno** — gli
attrezzi. La metà che arriva nelle case è `ponte/plancia/`, ed è quella che
l'add-on dà al telefono e al browser.

Non sono due copie. Dentro `custom_components/dashboardmodern/frontend/` le
quattro cartelle che l'add-on serve — `legacy`, `src`, `avatars`, `brands` —
sono **collegamenti** a `ponte/plancia/`: gli strumenti trovano i file dove si
sono sempre aspettati di trovarli, e quello che toccano è la plancia vera, non
un doppione che il giorno dopo racconta un'altra storia. Accanto ai
collegamenti stanno, veri, i file che l'add-on non serve: `e2e/` e `tests/`, le
prove del frontend, e `panel.js` e `dashboard-card.js`, i due ingressi
dell'integrazione.

## Cosa c'è

- **`scripts/`** — gli attrezzi. Il più importante è
  `generate_build_info.py`: rifà `legacy/build-info.js`, cioè l'elenco dei
  moduli che la pagina carica. **Senza di lui non si può aggiungere una
  sezione nuova alla plancia**, ed è la ragione per cui questa cartella è
  stata portata qui prima che l'altra repository sparisse. Accanto ci sono gli
  attrezzi delle traduzioni, degli avatar, dei loghi delle auto, dei moduli, e
  `vendor_legacy.py`, che rifà il guscio inglese dal guscio originale.
- **Le prove**: `tests/` (quelle dell'integrazione, in Python),
  `custom_components/dashboardmodern/frontend/tests/` (quelle del frontend, che
  girano con `node --test`), `custom_components/dashboardmodern/frontend/e2e/`
  (quelle col browser vero) e `playwright.config.js`, che le lancia.
- **`docs/`** — i documenti del progetto: la strategia, la mappa delle
  sezioni, le traduzioni, il registro dei biglietti, il diario delle versioni
  prima della 1.0.
- **`custom_components/dashboardmodern/`** — l'integrazione per Home Assistant,
  in Python. In gdahome **non si usa**: tutto quello che l'integrazione faceva
  per la plancia lo fa il ponte (`ponte/src/commissioni.js`), ed è per questo
  che l'add-on non chiede di installare niente in Home Assistant. Sta qui
  perché è dove è scritto **come** rispondeva: quando il ponte deve rispondere
  come rispondeva lei, la risposta giusta si legge qui.
- **`.github/`** — le macchine che costruivano la dashboard. Sono ferme: GitHub
  guarda solo il `.github/` alla radice della repository, e quello è di
  gdahome. Stanno qui per lo stesso motivo dell'integrazione — dicono come si
  faceva una cosa, il giorno che serve rifarla.
- **`centralino/`**, **`README.md`**, **`info.md`**, **`hacs.json`**,
  **`package.json`**, **`package-lock.json`** — il resto della repository
  com'era: la sua scheda per HACS, il suo README, il suo centralino.
- **`brand/`**, **`ARCHITECTURE.md`**, **`DECISIONS.md`**, **`CHANGELOG.md`**,
  **`CONTRIBUTING.md`** — il marchio e la memoria del progetto.
- **`LICENSE`** — la licenza di questa cartella, che è la sua e non quella di
  gdahome. La stessa carta sta accanto ai file serviti, in
  `ponte/plancia/LICENSE`, perché vale anche per quelli.

## Cosa non c'è, e perché

**`docs/preview/`**: ventidue megabyte di anteprime generate. Le rifà
`scripts/capture-previews.mjs` quando servono. Questa repository la clona ogni
Home Assistant che ha gdahome fra gli Archivi, a ogni giro del negozio:
ventidue megabyte di immagini che si rigenerano da sole li scaricherebbero
tutti, per sempre, per niente.

È l'unica cosa che manca. Tutto il resto della release 1.4.32 è qui: 1937 file,
contati uno per uno.

## L'unica cosa che è stata cambiata

`scripts/generate_build_info.py` cercava il `.git` accanto a sé, perché prima
lì c'era la radice di una repository. Adesso la radice è un piano più su, e lo
script lo sa (`REPOSITORY = ROOT.parent`). Tutto il resto è com'era.

Provato: rigenerando `build-info.js` da qui esce lo stesso elenco di moduli, la
stessa versione, lo stesso schema **e lo stesso `assetHash`** di quello dentro
la plancia — `dc92d364dfdbc4bf`. Cambiano il commit e la data, che è quello che
devono fare.
