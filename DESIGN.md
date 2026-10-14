---
name: gdahome.org
description: "Il catalogo delle placche: carta bianca, righe sottili, le schermate vere come tavole numerate."
colors:
  carta: "#ffffff"
  campo: "#eef0f3"
  inchiostro: "#0b1220"
  inchiostro-lieve: "#4b5563"
  blu: "#1d4ed8"
  blu-scuro: "#1e3a8a"
  ambra: "#f59e0b"
  ambra-inchiostro: "#9a5b00"
  male: "#b91c1c"
  filo: "#c9ced6"
  filo-tenue: "#e3e6eb"
typography:
  display:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(2.3rem, 5.6vw, 4.7rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 120"
  headline:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(1.9rem, 4vw, 3.2rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 118"
  title:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 110"
  body:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
    fontVariation: "'wdth' 100"
  label:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.74rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 80"
  numeral:
    fontFamily: "Oswald, Archivo, sans-serif"
    fontSize: "2rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0"
rounded:
  none: "0px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "14px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
  bordo-pagina: "clamp(16px, 4vw, 48px)"
  sezione: "clamp(40px, 6vw, 84px)"
components:
  bottone:
    backgroundColor: "{colors.carta}"
    textColor: "{colors.inchiostro}"
    rounded: "{rounded.none}"
    padding: "0 20px"
    height: "46px"
  bottone-hover:
    backgroundColor: "{colors.inchiostro}"
    textColor: "{colors.carta}"
  bottone-pieno:
    backgroundColor: "{colors.blu}"
    textColor: "{colors.carta}"
    rounded: "{rounded.none}"
    padding: "0 20px"
    height: "46px"
  bottone-pieno-hover:
    backgroundColor: "{colors.blu-scuro}"
    textColor: "{colors.carta}"
  voce-navigazione:
    textColor: "{colors.inchiostro-lieve}"
    typography: "{typography.label}"
    padding: "0 14px"
  voce-navigazione-accesa:
    textColor: "{colors.inchiostro}"
    typography: "{typography.label}"
    padding: "0 14px"
  tavola:
    backgroundColor: "{colors.carta}"
    textColor: "{colors.inchiostro-lieve}"
    rounded: "{rounded.none}"
  campo:
    backgroundColor: "transparent"
    textColor: "{colors.inchiostro}"
    rounded: "{rounded.none}"
    padding: "10px 0"
  piano-prova:
    backgroundColor: "{colors.carta}"
    textColor: "{colors.blu}"
    rounded: "{rounded.none}"
    padding: "3px 8px"
  nota-campo:
    backgroundColor: "{colors.campo}"
    textColor: "{colors.inchiostro-lieve}"
    rounded: "{rounded.none}"
    padding: "18px 20px"
---

# Design System: gdahome.org

Questo documento descrive il sito pubblico in `sito/` (`index.html`, `privacy.html`, `stile.css`, `privacy.css`, `sito.js`). L'app Flutter (`app/lib/vestito/tema.dart`) e le console degli add-on (`ponte/console`, `quadro/console`, `quadro/gestore`) hanno sistemi propri e separati, e non sono descritti qui.

## Overview

**Creative North Star: "Il catalogo delle placche"**

Il sito è impaginato come il catalogo di placche e interruttori di un elettricista: carta bianca, una griglia di righe sottili, e le schermate vere dell'app messe dritte sulla pagina come tavole, ognuna con il suo numero («Fig. n»), la sua didascalia e la sua riga d'articolo. Non c'è un telefono disegnato intorno alle schermate, non ci sono fondi, aloni o schede: una tavola è un'immagine con un filo di 1px intorno, e il resto della pagina sta zitto.

La struttura è fatta quasi solo di righe orizzontali: una riga d'inchiostro apre ogni sezione, una riga grigia separa ogni voce di scheda, di listino, di elenco. I colori sono quattro e ognuno fa una cosa sola; l'ambra, in particolare, è una luce accesa, e nella pagina ne è accesa una sola per volta. Il sistema è chiaro soltanto (`color-scheme: light only`): è una copertina, e una copertina si presenta sempre allo stesso modo.

**Key Characteristics:**

- Carta bianca e righe di 1px: la griglia è fatta di bordi, non di spazi colorati.
- Tavole piatte con filo di 1px, numerate in Oswald («Fig. n»), con didascalia in maiuscoletto stretto.
- Archivo variabile per tutto il testo, con l'asse della larghezza come gerarchia (120 → 80).
- Un elemento acceso d'ambra per volta; blu per i collegamenti e l'unico tasto pieno.
- Nessuna ombra, nessuna sfocatura, nessun raggio, nessun movimento d'ingresso.

## Colors

Undici valori in `:root` di `stile.css`, con nomi italiani; quattro ruoli veri (inchiostro, blu, ambra, carta) e le loro varianti.

### Primary

- **Blu del catalogo** (`blu`): i collegamenti nel testo, il titolo di un passo di «Scaricala» quando ci si passa sopra, il bordo e il testo della targhetta «primi 14 giorni gratis», l'anello di fuoco (`outline: 2px solid`), la sottolineatura del campo attivo, e lo sfondo dell'unico tasto pieno («Installa l'add-on»).
- **Blu scuro** (`blu-scuro`): lo stato hover dei collegamenti e del tasto pieno. Non compare a riposo.

### Secondary

- **Ambra, la luce accesa** (`ambra`): la riga sotto la voce del menu della sezione in cui si sta leggendo (2px), la riga a sinistra della voce accesa nell'indice sul bordo, il bordo dell'icona di serie sotto il puntatore, il quadratino della spia «accesa» nella prima tavola. È sempre un bordo o un riempimento di 10px: mai uno sfondo di testo, mai un testo.
- **Ambra d'inchiostro** (`ambra-inchiostro`): la parola «accesa» accanto alla spia quando è accesa; l'unico testo color ambra, scurito per restare leggibile su carta.

### Tertiary

- **Rosso, il male** (`male`): il segno davanti alle voci dell'elenco «contro» e il bordo e il testo dell'esito del modulo quando l'invio fallisce. Non ha altri usi.

### Neutral

- **Carta** (`carta`): lo sfondo della pagina, della testata appiccicata e di ogni tavola; il testo sui tasti pieni e sul tasto a filo quando è in hover.
- **Campo** (`campo`): il grigio su cui si appoggia una tavola o una nota: la striscia della serie, la nota sulla privacy nel listino, lo sfondo del `code` in linea.
- **Inchiostro** (`inchiostro`): tutto il testo che si legge per primo, i titoli, le righe d'apertura delle sezioni e delle tabelle (1px), il bordo dei tasti, la selezione del testo.
- **Inchiostro lieve** (`inchiostro-lieve`): il testo di secondo livello: le guide sotto i titoli, le celle dei listini, le didascalie, le voci del menu a riposo, il segnaposto nei campi. Il `<b>` dentro questo testo torna all'inchiostro pieno.
- **Filo** (`filo`): la riga di 1px che fa la griglia: il bordo delle tavole, il separatore delle righe di scheda, listino e campo, i bordi laterali del gruppo lingua e del marchio, le quote della prima tavola.
- **Filo tenue** (`filo-tenue`): la riga più chiara fra le voci degli elenchi col trattino e fra le voci del menu del telefono.

### Named Rules

**La regola della luce sola.** L'ambra segna una cosa sola per volta: in copertina la spia della prima tavola, scorrendo la voce del menu (e dell'indice sul bordo) della sezione corrente. Due elementi ambra sullo stesso schermo sono un errore.

**La regola dell'inchiostro e del filo.** Le righe che aprono (sezione, tabella, scheda, modulo, piede) sono d'inchiostro; le righe che separano dentro sono di filo. Una riga non è mai più spessa di 1px, tranne i 2px della voce accesa e della sottolineatura della lingua scelta.

## Typography

**Display Font:** Archivo variabile (wght 100–900, wdth 62–125%), servito da `sito/caratteri/archivo-variabile.woff2` (ripiego: Helvetica Neue, Arial, sans-serif)
**Body Font:** Archivo variabile, lo stesso file
**Label/Mono Font:** Oswald 500 per i numeri (`sito/statico/font/`); `ui-monospace` per il `code` in linea

**Character:** una sola famiglia che cambia larghezza come voce: larga e nera per i titoli di serie, normale per il testo, stretta e in maiuscoletto per le didascalie e le righe tecniche. Oswald è il carattere dei numeri della plancia e resta ai numeri: i prezzi, i passi, i «Fig. n».

### Hierarchy

- **Display** (800, `clamp(2.3rem, 5.6vw, 4.7rem)`, 1.02, wdth 120, -0.02em): il titolo di apertura, uno solo per pagina. Nell'informativa scende a `clamp(2.2rem, 5vw, 3.6rem)` con wdth 118.
- **Headline** (800, `clamp(1.9rem, 4vw, 3.2rem)`, 1.02, wdth 118): il titolo di ogni sezione, nella testa a due colonne con la guida accanto. Nell'informativa i capitoli stanno a `clamp(1.3rem, 2.6vw, 1.7rem)`, wdth 112.
- **Title** (800, 1.15–1.35rem, 1.02, wdth 110–112): i sottotitoli dentro una sezione (1.35rem, con una riga di filo sopra), i titoli delle schede (1.2rem), i passi di «Scaricala» (1.15rem), il nome del piano nel listino (1.25rem, wdth 112), il marchio in testata (1.1rem, 700, wdth 112).
- **Body** (400, 1.0625rem, 1.55, wdth 100): il testo. Le guide stanno fra 48ch e 64ch; la nota sotto i tasti a 56ch; il testo di apertura a 1.12rem e 52ch; le note e il piede a 0.92–0.95rem.
- **Label** (600, 0.74rem, 1.3, wdth 80, 0.08em, maiuscolo): la riga tecnica: didascalie, voci del menu e dell'indice, tasti lingua, nomi di riga delle schede, intestazioni dei listini, etichette dei campi, collegamenti del piede. I nomi `gdahome` e `gdanav` restano minuscoli anche qui.
- **Numeral** (Oswald 500, tabular-nums): i prezzi nel listino (2rem, 1.6rem sotto 760px, 1.5rem sotto 480px), i numeri dei passi (2rem), i «Fig. n» nelle didascalie (0.86rem).

### Named Rules

**La regola della larghezza.** La gerarchia si fa con l'asse `wdth` di Archivo, non con un secondo carattere: 120 il titolo di apertura, 118 i titoli di sezione, 110–112 i titoli minori e il marchio, 100 il testo, 80 la riga tecnica. I titoli sono sempre 800 con interlinea 1.02 e -0.02em.

**La regola dei numeri.** Oswald compare solo su numeri: prezzi, passi, numeri di figura. Una parola in Oswald è un errore.

## Layout

La pagina sta in una colonna di 1280px (`--largo`) centrata, con un bordo laterale `clamp(16px, 4vw, 48px)` (`--bordo-pagina`). L'informativa usa una colonna di 760px con lo stesso bordo. La testata (`--cappello-alto`: 60px) è appiccicata in alto con una riga d'inchiostro sotto; `scroll-padding-top` ne tiene conto (60px + 24px).

Ogni sezione principale apre con una riga d'inchiostro a tutta larghezza e respira `clamp(40px, 6vw, 84px)` sopra e `clamp(48px, 7vw, 96px)` sotto; la testa di sezione è una griglia 8/12 + 4/12 con titolo e guida allineati in basso, 48px di colonna. L'apertura è una griglia 6/12 + 6/12 (56px di colonna) con il testo a sinistra e la prima tavola a destra (massimo 400px), con le quote disegnate a sinistra e sotto. Le tavole stanno in file di 3 (o 4, o 2) con 32px fra le righe e 24px fra le colonne; «tavola e testo» è 7/12 + 5/12. Le schede nome–valore sono griglie 4/12 + 8/12 con righe da 14px di padding. Il listino è una tabella con righe di 14px e la prima colonna al 30%.

Punti di rottura, tutti con `max-width` tranne il primo:

- **1480px e oltre**: compare l'indice sul bordo destro, fissato a metà altezza, con una riga di filo a sinistra.
- **940px**: la testata si ripiega (marchio + menu `<details>` + lingua), le voci del menu diventano una colonna separata da filo tenue; l'apertura si impila nell'ordine titolo, tavola (320px), tasti, testo; le file di tavole passano a 2 colonne; la striscia della serie scorre di lato a passi di 76px.
- **760px**: la testa di sezione, le tre strade e il piede vanno a una colonna; i prezzi scendono a 1.6rem.
- **600px**: le righe di scheda e le righe del modulo vanno a una colonna.
- **520px**: le tavole vanno a una colonna, larghe al massimo 320px.
- **480px**: il listino diventa una griglia a due colonne per riga.

La scala degli spazi osservata è 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 24 / 28 / 32 / 48 / 56px: i gap fra colonne sono 24 o 48, le righe interne 14, i distacchi fra blocchi `clamp(32px, 5vw, 56px)`.

## Elevation & Depth

Nessuna ombra, nessuna sfocatura, nessun gradiente, nessuna stratificazione tonale: la profondità non esiste e non è simulata. Una tavola sta sulla carta con un filo di 1px; una nota o la striscia della serie si appoggiano sul grigio `campo` con lo stesso filo intorno. La testata appiccicata si separa dalla pagina con la sua riga d'inchiostro, non con un'ombra. L'unico `box-shadow` del foglio di stile è `0 2px 0 blu` sotto il campo di modulo attivo: è una sottolineatura, non un'elevazione, e va letto come tale.

### Named Rules

**La regola della carta piatta.** Niente `box-shadow` di elevazione, niente `filter: blur`, niente `backdrop-filter`, niente gradienti di sfondo, in nessuno stato. Se serve staccare un blocco, si usa un filo di 1px o lo sfondo `campo`.

## Shapes

Tutto ha gli angoli vivi: nessun `border-radius` in nessuna regola, tasti e targhette compresi. Le forme sono rettangoli con bordo di 1px (tavole, tasti a filo, targhetta di prova, esito del modulo, nota) o rettangoli senza bordo con una riga sopra e sotto (sezioni, tabelle, schede, modulo, piede). Le icone in linea sono tratti SVG a `stroke-linecap: square` e 1.8 di spessore; i segni degli elenchi sono una lineetta di 12×1px d'inchiostro, un quadratino ruotato di 10px col bordo rosso per i «contro», una lineetta tratteggiata per «in arrivo»; la spia è un quadrato di 10px con bordo d'inchiostro che si riempie d'ambra. Le quote della prima tavola sono parentesi sottili di filo con i segni alle estremità.

## Components

### Buttons

- **Shape:** rettangolo ad angoli vivi (0px), altezza minima 46px, padding `0 20px`, testo 600 a 0.98rem con -0.005em.
- **Tasto a filo** (`bottone`): carta con bordo di 1px d'inchiostro e testo d'inchiostro; in hover si inverte (sfondo inchiostro, testo carta). È il tasto normale: «Guarda la plancia», «Scrivici».
- **Tasto pieno** (`bottone-pieno`): sfondo e bordo blu, testo carta; in hover blu scuro. Uno per schermata: «Installa l'add-on» in testata e nell'apertura, «Manda» nel modulo.
- **Hover / Focus:** transizioni di 120ms ease-out su sfondo, colore e bordo; il fuoco è l'anello globale blu di 2px con 2px di distacco. Occupato o disabilitato: opacità 0.55 e cursore `progress`.
- **In testata:** la stessa classe senza altezza minima, 0.9rem, padding `0 16px`, nascosta sotto 940px.

### Chips

- **Targhetta di prova** (`piano-prova`): testo in riga tecnica (0.72rem, 0.08em, maiuscolo) blu con bordo blu di 1px, padding `3px 8px`, su carta. Compare solo sotto il prezzo Premium per «primi 14 giorni gratis». Nessuna variante selezionata.
- **Tasti lingua** (`lingua`): due tasti testo IT/EN in riga tecnica, grigio lieve a riposo; quello scelto (`aria-pressed="true"`) è d'inchiostro con sottolineatura di 2px a 0.35em.

### Cards / Containers

- **Tavola** (`tavola`): l'immagine a piena larghezza con bordo di 1px di filo su carta, nessun raggio, nessuna ombra; sotto, a 10px, la didascalia in riga tecnica grigio lieve con «Fig. n» in Oswald d'inchiostro a sinistra e, a destra, la spia o il titolo; eventualmente una riga d'articolo («GDA · Luci · sezione 3 di 30») a 6px. La prima tavola porta le quote (parentesi di filo a -18px a sinistra e sotto) e una didascalia a 28px.
- **Disegno tecnico** (`strada`): un SVG dentro un bordo di 1px di filo, con la didascalia sotto una riga di filo, in testo normale a 0.95rem con padding `14px 18px 16px`.
- **Nota** (`nota-privacy`): un blocco su `campo` con bordo di filo, padding `18px 20px`, titolo in grassetto d'inchiostro e testo grigio lieve, largo al massimo 76ch.
- **Serie** (`serie`): striscia a tutta larghezza su `campo` con filo sopra e sotto; dentro, 10 icone di 28px per riga con il nome sotto a 0.74rem wdth 84; sotto il puntatore la voce prende bordo ambra, sfondo carta e testo d'inchiostro.
- **Scheda tecnica** (`scheda`): righe nome–valore separate da filo, aperte da inchiostro; il nome in riga tecnica d'inchiostro, il valore grigio lieve.
- **Listino** (`listino`): tabella aperta da inchiostro; intestazioni con nome del piano (1.25rem, 800, wdth 112), prezzo in Oswald a 2rem con il periodo in Archivo 400 a 1rem grigio lieve, e la targhetta di prova; celle `si` d'inchiostro, `no` grigio lieve.
- **Passo di scarico** (`scarico`): riga-collegamento a quattro colonne (56px numero in Oswald 2rem, titolo, testo, «come» in blu 600) separata da filo; in hover il titolo diventa blu.

### Inputs / Fields

- **Style:** nessun riquadro. L'etichetta in riga tecnica sopra (6px), il campo trasparente senza bordo con padding `10px 0`, e una riga di filo sotto l'intero blocco (`campo`, padding `14px 0`). Le righe stanno in griglie a due colonne con 24px di colonna.
- **Focus:** l'anello globale si spegne e al suo posto la riga sotto diventa blu di 2px (`box-shadow: 0 2px 0 blu`).
- **Error / Disabled:** l'esito (`modulo-esito`) è un blocco con bordo di 1px d'inchiostro, padding `12px 14px`, 0.95rem; in errore bordo e testo rossi (`male`). Il modulo occupato porta `aria-busy` e il tasto scende a 0.55 di opacità. Segnaposto in grigio lieve.

### Navigation

- **Testata** (`cappello`): appiccicata, carta, riga d'inchiostro sotto, 60px; marchio 28px + nome in Archivo 700 wdth 112 con bordo di filo a destra; voci in riga tecnica grigio lieve, padding `0 14px`, con una riga di 2px trasparente sotto; in hover d'inchiostro; la voce della sezione corrente (`acceso`, `aria-current`) è d'inchiostro con la riga ambra. Il gruppo lingua ha filo a sinistra e a destra; poi il tasto pieno.
- **Telefono (≤940px):** il marchio perde il bordo; un `<details>` con icona a tre righe/croce (22px) apre la stessa lista come colonna, voci a 0.9rem con padding `11px 0` e filo tenue fra loro; la voce accesa tiene la riga ambra.
- **Indice sul bordo (≥1480px):** la stessa lista, fissa a destra a metà altezza, 0.72rem, padding `7px 22px 7px 14px`, riga di filo a sinistra; la voce accesa porta 2px d'ambra a sinistra.
- **Collegamenti nel testo:** blu, sottolineati di 1px a 0.18em (3px nell'informativa); in hover blu scuro. Nel piede i collegamenti sono in riga tecnica grigio lieve, senza sottolineatura, d'inchiostro in hover.
- **Ritorno (informativa):** `indietro`: marchio 28px + nome in Archivo 700 wdth 112, d'inchiostro, blu in hover.

### La spia

Il quadratino di 10px nella didascalia della prima tavola (`spia`): bordo d'inchiostro su carta a riposo, riempito d'ambra con la parola «accesa» in ambra d'inchiostro quando è acceso. Si accende 600ms dopo il caricamento (subito con `prefers-reduced-motion`), con una transizione di 260ms, e si spegne quando si scorre via dalla copertina, perché a quel punto la luce passa alla voce del menu. È l'unico movimento autoriale della pagina.

## Do's and Don'ts

### Do:

- **Do** aprire ogni blocco strutturale (sezione, tabella, scheda, modulo, piede) con una riga di 1px d'inchiostro e separare le righe interne con 1px di filo.
- **Do** mostrare le schermate come tavole: immagine dritta, bordo di 1px di filo, «Fig. n» in Oswald e didascalia in riga tecnica sotto.
- **Do** fare la gerarchia dei titoli con l'asse `wdth` di Archivo (120 / 118 / 110 / 100 / 80), peso 800, interlinea 1.02, -0.02em.
- **Do** tenere l'ambra su un elemento solo per volta, come bordo o riempimento di 10px, mai come testo pieno (il testo accanto usa `ambra-inchiostro`).
- **Do** usare un tasto pieno blu per schermata e il tasto a filo d'inchiostro per tutto il resto.
- **Do** servire ogni carattere e ogni immagine da `sito/`: niente da domini esterni.
- **Do** tenere le transizioni a 120ms ease-out e solo sugli stati (sfondo, colore, bordo), senza animazioni d'ingresso.

### Don't:

- **Don't** usare `box-shadow` di elevazione, `filter: blur`, `backdrop-filter` o gradienti di sfondo, in nessuno stato.
- **Don't** usare `border-radius`: tasti, targhette, tavole e campi hanno gli angoli vivi.
- **Don't** disegnare un telefono intorno alle schermate, né mettere le tavole su fondi colorati o sfocati.
- **Don't** usare Oswald su parole: solo prezzi, passi e numeri di figura.
- **Don't** accendere due elementi d'ambra insieme, né usare l'ambra per collegamenti o tasti.
- **Don't** aggiungere un tema scuro: il sito è `color-scheme: light only`.
- **Don't** scrivere `gdahome` e `gdanav` in maiuscolo, nemmeno dove tutto il resto è in riga tecnica maiuscola.
- **Don't** mettere occhielli o righe introduttive sopra i titoli: la riga tecnica sta sotto le tavole e nelle schede, non sopra un titolo.
