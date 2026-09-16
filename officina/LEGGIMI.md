# L'officina della plancia

Qui dentro c'è il progetto **DashboardModern**: i suoi strumenti, le sue prove,
i suoi documenti e l'integrazione per Home Assistant da cui è nato.

Fino a settembre 2026 stava in una repository sua, `dashboardmodern-v2`. Quella
repository non esiste più: il progetto vive qui, e da qui si aggiorna e si
corregge. Questa cartella è la sua metà che **non si serve a nessuno** — gli
attrezzi. La metà che arriva nelle case è `ponte/plancia/`, ed è quella che
l'add-on dà al telefono e al browser.

Non sono due copie. `custom_components/dashboardmodern/frontend` qui è un
**collegamento** a `ponte/plancia/`: gli strumenti trovano i file dove si sono
sempre aspettati di trovarli, e quello che toccano è la plancia vera, non un
doppione che il giorno dopo racconta un'altra storia.

## Cosa c'è

- **`scripts/`** — gli attrezzi. Il più importante è
  `generate_build_info.py`: rifà `legacy/build-info.js`, cioè l'elenco dei
  moduli che la pagina carica. **Senza di lui non si può aggiungere una
  sezione nuova alla plancia**, ed è la ragione per cui questa cartella è
  stata portata qui prima che l'altra repository sparisse. Accanto ci sono gli
  attrezzi delle traduzioni, degli avatar, dei loghi delle auto e dei moduli.
- **`tests/`**, **`playwright.config.js`**, **`pyproject.toml`**,
  **`requirements_test.txt`** — le prove della dashboard, le sue.
- **`docs/`** — i documenti del progetto: la strategia, la mappa delle
  sezioni, le traduzioni, il registro dei biglietti, il diario delle versioni
  prima della 1.0.
- **`custom_components/dashboardmodern/`** — l'integrazione per Home Assistant,
  in Python. In gdahome **non si usa**: tutto quello che l'integrazione faceva
  per la plancia lo fa il ponte (`ponte/src/commissioni.js`), ed è per questo
  che l'add-on non chiede di installare niente in Home Assistant. Sta qui
  perché è dove è scritto **come** rispondeva: quando il ponte deve rispondere
  come rispondeva lei, la risposta giusta si legge qui.
- **`brand/`**, **`ARCHITECTURE.md`**, **`DECISIONS.md`**, **`CHANGELOG.md`**,
  **`CONTRIBUTING.md`** — il marchio e la memoria del progetto.

## Cosa non c'è, e perché

**`docs/preview/`**: ventidue megabyte di anteprime generate. Le rifà
`scripts/capture-previews.mjs` quando servono. Questa repository la clona ogni
Home Assistant che ha gdahome fra gli Archivi, a ogni giro del negozio:
ventidue megabyte di immagini che si rigenerano da sole li scaricherebbero
tutti, per sempre, per niente.

## L'unica cosa che è stata cambiata

`scripts/generate_build_info.py` cercava il `.git` accanto a sé, perché prima
lì c'era la radice di una repository. Adesso la radice è un piano più su, e lo
script lo sa (`REPOSITORY = ROOT.parent`). Tutto il resto è com'era.

Provato: rigenerando `build-info.js` da qui esce lo stesso elenco di moduli,
la stessa versione e lo stesso schema di quello dentro la plancia. Cambiano il
commit e la data — che è quello che devono fare — e `assetHash`, perché la
copia servita non porta i file che l'add-on non serve.
