# Come si rilascia

Ogni rilascio si decide prima in base a **dove va**, e si dice così anche nel
CHANGELOG e nella PR.

## Solo Home Assistant (add-on, ponte, plancia)

Quando l'app sul telefono non cambia: le modifiche stanno in `ponte/` (anche
la plancia, `ponte/plancia/`), negli strumenti o nei workflow dell'add-on.

- Il numero è quello dell'ultima versione dell'app **col quarto numero**:
  dopo la 1.18.7 vengono la 1.18.7.1, la 1.18.7.2… (fino a .99).
- `ponte/config.yaml` porta il numero a quattro cifre; `app/pubspec.yaml` e
  `app/lib/versione.dart` restano a `1.18.7` e il numero di costruzione segue
  la correzione (1.18.7.1 → 1180701), come vuole `ponte/test/marchio.test.js`;
  `ponte/plancia/ORIGINE.json` resta a `1.18.7`.
- Nel CHANGELOG il titolo è `## 1.18.7.1 — solo Home Assistant`.
- **Niente** build dell'app, niente Play, niente TestFlight, niente App Store:
  si unisce la PR e basta. Le immagini dell'add-on si costruiscono da sole.

## App GdAHome (telefono, tablet, auto)

Quando cambia qualcosa che l'app si porta dentro: `app/`, il navigatore
(GdANav, `app/pubspec.lock`), o una modifica che serve all'app e al ponte
insieme.

- Numero nuovo a tre cifre (1.18.8), uguale in app, add-on e plancia.
- Nel CHANGELOG il titolo è `## 1.18.8 — app e Home Assistant`.
- Dopo il merge: la build dell'app (`app.yml`, test interno e TestFlight) e,
  quando lo si chiede, la produzione nei negozi.
