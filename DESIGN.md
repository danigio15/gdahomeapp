---
name: gdahome.org
description: "Un sito di prodotto come quelli delle app: blu pieno a fasce, le schermate dentro un telefono con un'ombra vera, tasti e schede arrotondati, aria intorno."
colors:
  carta: "#ffffff"
  campo: "#eef3ff"
  campo-premium: "#f7f9ff"
  notte: "#0f172a"
  blu: "#1d4ed8"
  blu-scuro: "#1e3a8a"
  blu-chiaro: "#dbe4ff"
  inchiostro: "#0f172a"
  inchiostro-lieve: "#475569"
  su-blu: "#c7d2fe"
  ambra: "#f59e0b"
  bene: "#16a34a"
  male: "#b91c1c"
  filo: "#d7dde8"
  filo-tenue: "#e8edf5"
typography:
  display:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(2.4rem, 5vw, 4.2rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(2rem, 4.2vw, 3.2rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.92rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  pastiglia:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  numeral:
    fontFamily: "Oswald, Archivo, sans-serif"
    fontSize: "2.2rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "normal"
  code:
    fontFamily: "ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "0.88em"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
rounded:
  codice: "6px"
  marchio: "9px"
  piccolo: "12px"
  schermo: "16px"
  raggio: "20px"
  orologio: "24px"
  telefono: "38px"
  pastiglia: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "28px"
  xxl: "32px"
  colonna: "48px"
  bordo-pagina: "clamp(16px, 4vw, 48px)"
  blocco: "clamp(40px, 6vw, 72px)"
  sezione: "clamp(56px, 8vw, 112px)"
components:
  bottone:
    backgroundColor: "{colors.carta}"
    textColor: "{colors.inchiostro}"
    rounded: "{rounded.piccolo}"
    padding: "0 24px"
    height: "50px"
  bottone-hover:
    backgroundColor: "{colors.inchiostro}"
    textColor: "{colors.carta}"
  bottone-pieno:
    backgroundColor: "{colors.blu}"
    textColor: "{colors.carta}"
    rounded: "{rounded.piccolo}"
    padding: "0 24px"
    height: "50px"
  bottone-pieno-hover:
    backgroundColor: "{colors.blu-scuro}"
    textColor: "{colors.carta}"
  bottone-pieno-su-blu:
    backgroundColor: "{colors.carta}"
    textColor: "{colors.blu-scuro}"
    rounded: "{rounded.piccolo}"
    padding: "0 24px"
    height: "50px"
  bottone-pieno-su-blu-hover:
    backgroundColor: "{colors.ambra}"
    textColor: "{colors.notte}"
  bottone-contorno-su-blu:
    backgroundColor: "transparent"
    textColor: "{colors.carta}"
    rounded: "{rounded.piccolo}"
    padding: "0 24px"
    height: "50px"
  bottone-testata:
    backgroundColor: "{colors.blu}"
    textColor: "{colors.carta}"
    rounded: "{rounded.piccolo}"
    padding: "0 18px"
    height: "42px"
  voce-navigazione:
    textColor: "{colors.inchiostro-lieve}"
    typography: "{typography.label}"
    rounded: "{rounded.pastiglia}"
    padding: "8px 10px"
  voce-navigazione-hover:
    backgroundColor: "{colors.campo}"
    textColor: "{colors.inchiostro}"
  voce-navigazione-accesa:
    textColor: "{colors.inchiostro}"
    typography: "{typography.label}"
    padding: "8px 10px"
  lingua:
    backgroundColor: "{colors.campo}"
    textColor: "{colors.inchiostro-lieve}"
    typography: "{typography.pastiglia}"
    rounded: "{rounded.pastiglia}"
    padding: "6px 12px"
  lingua-scelta:
    backgroundColor: "{colors.carta}"
    textColor: "{colors.inchiostro}"
  pastiglia-sezione:
    backgroundColor: "{colors.campo}"
    textColor: "{colors.inchiostro}"
    rounded: "{rounded.pastiglia}"
    padding: "8px 14px 8px 10px"
  pastiglia-sezione-hover:
    backgroundColor: "{colors.blu-chiaro}"
    textColor: "{colors.inchiostro}"
  spia:
    backgroundColor: "{colors.carta}"
    textColor: "{colors.inchiostro-lieve}"
    typography: "{typography.pastiglia}"
    rounded: "{rounded.pastiglia}"
    padding: "7px 14px"
  spia-accesa:
    backgroundColor: "{colors.carta}"
    textColor: "{colors.inchiostro}"
  piano-prova:
    backgroundColor: "{colors.ambra}"
    textColor: "{colors.notte}"
    rounded: "{rounded.pastiglia}"
    padding: "5px 11px"
  sottotitolo-informativa:
    backgroundColor: "{colors.blu-chiaro}"
    textColor: "{colors.blu-scuro}"
    rounded: "{rounded.pastiglia}"
    padding: "6px 14px"
  scheda-su-campo:
    backgroundColor: "{colors.carta}"
    textColor: "{colors.inchiostro}"
    rounded: "{rounded.raggio}"
    padding: "28px"
  scheda-su-carta:
    backgroundColor: "{colors.campo}"
    textColor: "{colors.inchiostro}"
    rounded: "{rounded.raggio}"
    padding: "28px"
  nota:
    backgroundColor: "{colors.carta}"
    textColor: "{colors.inchiostro-lieve}"
    rounded: "{rounded.raggio}"
    padding: "22px 26px"
  passo-di-scarico:
    backgroundColor: "{colors.campo}"
    textColor: "{colors.inchiostro}"
    rounded: "{rounded.raggio}"
    padding: "22px 24px"
  numero-del-passo:
    backgroundColor: "{colors.blu}"
    textColor: "{colors.carta}"
    rounded: "{rounded.pastiglia}"
    size: "44px"
  telefono:
    backgroundColor: "{colors.notte}"
    rounded: "{rounded.telefono}"
  schermo:
    backgroundColor: "{colors.carta}"
    rounded: "{rounded.schermo}"
  modulo:
    backgroundColor: "{colors.campo}"
    textColor: "{colors.inchiostro}"
    rounded: "{rounded.raggio}"
    padding: "28px"
  campo-di-modulo:
    backgroundColor: "{colors.carta}"
    textColor: "{colors.inchiostro}"
    rounded: "{rounded.piccolo}"
    padding: "13px 16px"
  listino:
    backgroundColor: "{colors.carta}"
    textColor: "{colors.inchiostro-lieve}"
    rounded: "{rounded.raggio}"
    padding: "16px 20px"
  listino-premium:
    backgroundColor: "{colors.blu-scuro}"
    textColor: "{colors.carta}"
    padding: "24px 20px 20px"
  piede:
    backgroundColor: "{colors.notte}"
    textColor: "{colors.su-blu}"
---

# Design System: gdahome.org

Questo documento descrive il sito pubblico in `sito/` (`index.html`, `privacy.html`, `stile.css`, `privacy.css`, `sito.js`); il sistema sta tutto in `stile.css`, e `privacy.css` ne prende i colori, i caratteri e i tasti. L'app Flutter (`app/lib/vestito/tema.dart`) e le console degli add-on (`ponte/console`, `quadro/console`, `quadro/gestore`) hanno sistemi propri e separati, e non sono descritti qui.

## Overview

**Creative North Star: "Il sito dell'app"**

Il sito è fatto come i siti delle app che chi arriva qui già conosce, e fatto con cura: il blu di GdAHome è un colore vero, che si prende tutta la copertina, la colonna Premium del listino e il piede; le sezioni si alternano fra bianco e un campo azzurrino, così lo scorrimento ha un ritmo; le schermate vere dell'app stanno dentro un telefono disegnato in CSS, con una cornice scura e un'ombra che le stacca dalla pagina; i tasti e le schede sono arrotondati e intorno c'è aria.

Il colore è pieno e piatto. Non ci sono fondi a sfumature, vetro sfocato, aloni, testo sfumato: sono il vestito di mille siti usciti uguali nello stesso anno, e il sito li rifiuta per scelta. L'ombra è una sola famiglia, morbida e spostata in basso come la fa la luce, in tre pesi. Il sistema è chiaro soltanto (`color-scheme: light only`): è una copertina, e una copertina si presenta sempre allo stesso modo.

**Key Characteristics:**

- Blu pieno a fasce: la copertina, la colonna Premium e il piede sono campi di colore, non bordi.
- Sezioni che si alternano fra carta bianca e campo azzurrino; nessuna riga di separazione fra l'una e l'altra.
- Le schermate dentro un telefono: cornice di 9px color notte, angoli a 38px, ombra forte.
- Archivo variabile a larghezza normale, 700 i titoli, 400 il testo, 600–700 le etichette in minuscolo; Oswald solo per i prezzi.
- Un'ambra sola, come una luce accesa: la spia, la voce del menu corrente, il segno di Premium.

## Colors

Quindici valori in `:root` di `stile.css`, con nomi italiani; tre famiglie vere (il blu, l'inchiostro con i suoi fili, l'ambra) più i due colori dei segni.

### Primary

- **Blu di GdAHome** (`blu`): i collegamenti nel testo, il tasto pieno su carta («Installa l'add-on» in testata, «Manda» nel modulo), il bordo di 2px sopra ogni voce di scheda tecnica e di «tre strade», il cerchio numerato dei passi, la parola «come» nei passi, il bordo del campo di modulo a fuoco, la selezione del testo.
- **Blu scuro** (`blu-scuro`): il fondo della copertina e della colonna Premium del listino; lo stato hover dei collegamenti e del tasto pieno; il testo del tasto bianco sulla copertina e della pastiglia «Ultimo aggiornamento» nell'informativa.
- **Blu chiaro** (`blu-chiaro`): il fondo delle pastiglie di serie sotto il puntatore e della pastiglia nell'informativa. Un blu che si tocca, non che si legge.
- **Su blu** (`su-blu`): il testo di secondo livello quando sta sul blu scuro o sulla notte: la guida della copertina, la nota sotto i tasti, il periodo del prezzo Premium, tutto il piede.

### Secondary

- **Ambra, la luce accesa** (`ambra`): il pallino della spia quando è accesa, la riga di 2px sotto la voce del menu della sezione corrente, il fondo della pastiglia «primi 14 giorni gratis» nel listino, l'anello di fuoco (`outline: 3px`), il tasto bianco della copertina e i collegamenti del piede sotto il puntatore. Sta sempre su una cosa piccola: mai un fondo di sezione, mai un testo corrente, mai un collegamento a riposo.

### Tertiary

- **Verde, il sì** (`bene`): la spunta davanti alle voci degli elenchi e il bordo dell'esito del modulo quando il messaggio è partito. Nient'altro.
- **Rosso, il no** (`male`): la croce davanti alle voci dell'elenco «contro» e il bordo e il testo dell'esito del modulo quando l'invio fallisce. Nient'altro.

### Neutral

- **Carta** (`carta`): la pagina, la testata appiccicata, le sezioni pari, le schede e le note quando stanno sul campo, i campi di modulo, il tasto a contorno, il tasto pieno sulla copertina.
- **Campo** (`campo`): l'azzurrino delle sezioni dispari (`fascia`) e dell'informativa; dentro una sezione bianca è il fondo di schede, note, passi e modulo; il fondo delle pastiglie di serie, del gruppo lingua, del `code` in linea, della voce del menu sotto il puntatore; l'intestazione del listino.
- **Campo Premium** (`campo-premium`): il velo ancora più chiaro delle celle della colonna Premium nel listino, sotto la sua testa blu scuro.
- **Notte** (`notte`): la cornice del telefono, il fondo del piede, il testo sull'ambra.
- **Inchiostro** (`inchiostro`): tutto il testo che si legge per primo, i titoli, il bordo del tasto a contorno e il suo fondo in hover. Ha lo stesso valore della notte: è lo stesso colore con due mestieri.
- **Inchiostro lieve** (`inchiostro-lieve`): il testo di secondo livello: le guide sotto i titoli, le celle dei listini, i testi delle schede, le voci del menu a riposo, le didascalie d'esempio, le note. Il `<b>` dentro questo testo torna all'inchiostro pieno.
- **Filo** (`filo`): il pallino della spia spenta e i segni «no» del listino.
- **Filo tenue** (`filo-tenue`): la riga di 1px sotto la testata, fra le righe del listino, fra le voci degli elenchi, sotto il disegno tecnico.

### Named Rules

**La regola del colore pieno.** Ogni fondo è un colore solo: niente `linear-gradient`, `radial-gradient`, `backdrop-filter`, `filter: blur`, aloni colorati o testo con `background-clip: text`. Se un blocco deve staccarsi, cambia campo (carta ↔ campo) o prende un'ombra.

**La regola della luce sola.** L'ambra è una luce: sta accesa su una cosa per volta mentre si scorre (la spia della copertina, poi la voce del menu della sezione corrente), e in più segna la prova gratuita di Premium nel listino. Non è mai un fondo di sezione, un collegamento a riposo o un testo corrente.

**La regola dei segni.** Verde e rosso sono i colori di un segno (spunta, croce, bordo dell'esito) e di niente altro: non diventano tasti, fondi o titoli.

## Typography

**Display Font:** Archivo variabile (wght 100–900, wdth 62–125%, usato a larghezza normale), servito da `sito/caratteri/archivo-variabile.woff2` (ripiego: Helvetica Neue, Arial, sans-serif)
**Body Font:** Archivo variabile, lo stesso file
**Label/Mono Font:** Oswald 500 per i prezzi (`sito/statico/font/`); `ui-monospace` per il `code` in linea

**Character:** una sola famiglia a larghezza normale, che fa la gerarchia con il peso e il corpo: 700 stretto e serrato per i titoli, 400 largo e arioso per il testo, 600–700 in minuscolo per le etichette. Non c'è maiuscoletto, non c'è spaziatura allargata: le etichette sono parole scritte come si scrivono. Oswald è il carattere dei numeri della plancia e resta ai prezzi.

### Hierarchy

- **Display** (700, `clamp(2.4rem, 5vw, 4.2rem)`, 1.08, -0.025em): il titolo della copertina, bianco sul blu scuro, uno per pagina. Nell'informativa è `clamp(2.2rem, 5vw, 3.4rem)` d'inchiostro.
- **Headline** (700, `clamp(2rem, 4.2vw, 3.2rem)`, 1.08, -0.025em): il titolo di ogni sezione, con la guida sotto a 1.12rem grigio lieve, in una testa larga al massimo 64ch. Nell'informativa i capitoli stanno a `clamp(1.4rem, 2.6vw, 1.8rem)`.
- **Title** (700, 1.12–1.6rem, 1.08, -0.025em): i sottotitoli dentro una sezione (1.6rem), il titolo della serie (1.4rem), i titoli delle schede e il nome del piano (1.3rem), il marchio in testata (1.2rem), i passi di «Scaricala» (1.15rem), i nomi delle voci di scheda tecnica (1.12rem).
- **Body** (400, 1.0625rem, 1.6): il testo. Le guide stanno a 64ch (50ch sulla copertina, a 1.15rem); la nota sotto i tasti a 56ch e 0.95rem; le note, le didascalie e il piede a 0.92–0.97rem.
- **Label** (600, 0.92rem, minuscolo): le voci del menu, i collegamenti del piede, le didascalie delle tavole (0.95rem), le pastiglie di serie (0.9rem), la riga tecnica (0.82rem). Sempre in frase, mai in maiuscolo.
- **Pastiglia** (700, 0.82rem): il testo dentro una pastiglia a 999px: la spia, i tasti lingua, la prova gratuita (0.78rem), il sottotitolo dell'informativa (0.85rem), le etichette dei campi (0.9rem).
- **Numeral** (Oswald 500, 2.2rem, 1, tabular-nums): i prezzi nel listino (1.7rem sotto 760px, 1.5rem sotto 480px), col periodo accanto in Archivo 400 a 1rem.
- **Code** (monospazio di sistema, 0.88em, su campo a 6px): quello che si copia tale e quale: il codice regalo `GDA-XXXX-XXXX-XXXX`, l'indirizzo dell'archivio, i domini nell'informativa. Mai per dare un'aria tecnica al testo.

### Named Rules

**La regola della frase.** Le etichette sono in minuscolo e senza spaziatura allargata: nessun `text-transform: uppercase`, nessun `letter-spacing` positivo, nessun occhiello sopra un titolo. Il peso (600 o 700) e il corpo bastano a dire che è un'etichetta.

**La regola dei numeri.** Oswald compare solo sui prezzi. Una parola in Oswald è un errore.

## Layout

La pagina sta in una colonna di 1180px (`--largo`) centrata, con un bordo laterale `clamp(16px, 4vw, 48px)` (`--bordo-pagina`). L'informativa usa una colonna di 820px con lo stesso bordo, e il suo foglio bianco a 20px di raggio sta sul campo azzurrino. La testata (`--cappello-alto`: 64px) è appiccicata in alto, bianca, con un filo tenue sotto; `scroll-padding-top` ne tiene conto (64px + 16px).

Le sezioni sono fasce a tutta larghezza che si alternano fra carta e campo (`fascia`), ognuna con `clamp(56px, 8vw, 112px)` sopra e sotto e nessuna riga fra l'una e l'altra; fra un blocco e l'altro dentro una sezione c'è `clamp(40px, 6vw, 72px)`. La copertina è blu scuro, con una griglia 6/12 + 6/12 (48px di colonna): testo a sinistra, telefono a destra (340px) che scende di 96px nel bianco della sezione sotto. La serie, su carta, è una griglia 3/12 + 9/12 con il titolo a sinistra e le pastiglie a destra. Le tavole stanno in file di 3 (o 4, o 2) con 40px fra le righe e 32px fra le colonne; «tavola e testo» è 7/12 + 5/12 (56px di colonna). Le schede tecniche sono tre colonne di testo (28px × 40px), il listino una tabella con la prima colonna al 26%; i passi di «Scaricala» sono righe a quattro colonne fisse (52px, 220px, resto, 160px). Il piede è notte, 7/12 + 5/12.

Punti di rottura, tutti con `max-width`:

- **1180px**: le voci del menu si stringono (0.86rem, 8px di padding).
- **940px**: la testata si ripiega (marchio + IT/EN + menu `<details>`); le voci diventano una colonna di righe a 12px di raggio; la copertina si impila (testo, poi telefono a 280px); le file di tavole passano a 2 colonne; la serie scorre di lato; le schede, le tavole con testo, i passi, il modulo e le due colonne di testo vanno a una colonna.
- **760px**: le tre strade e il piede vanno a una colonna; i prezzi scendono a 1.7rem.
- **600px**: le righe del modulo vanno a una colonna.
- **520px**: le tavole vanno a una colonna, larghe al massimo 300px.
- **480px**: il listino diventa una griglia a due colonne per riga.

La scala degli spazi osservata è 8 / 10 / 12 / 14 / 16 / 18 / 20 / 24 / 28 / 32 / 40 / 48 / 56px: i gap fra colonne sono 24, 32, 48 o 56; il padding interno delle schede è 28; i distacchi fra blocchi `clamp(32px, 5vw, 56px)` o `clamp(40px, 6vw, 72px)`.

## Elevation & Depth

Il sistema è a strati: i fondi fanno il grosso (carta, campo, blu scuro, notte), e le ombre staccano quello che sta sopra un fondo. Le ombre sono tutte dello stesso tipo: tinta d'inchiostro, spostate in basso, morbide; una vicina e una lontana sommate, come fa la luce dall'alto. Non ci sono aloni colorati intorno a niente, né sfocature del fondo. La testata prende un'ombra solo quando la pagina ha scorso (`giu`, dopo 8px): in cima non ha niente sotto.

### Shadow Vocabulary

- **Ombra** (`--ombra`: `0 12px 32px rgba(15, 23, 42, 0.1), 0 2px 6px rgba(15, 23, 42, 0.06)`): le schede, le note, il listino e il disegno tecnico quando stanno sul campo azzurrino; la spia; i passi di «Scaricala» sotto il puntatore.
- **Ombra alta** (`--ombra-alta`: `0 20px 48px rgba(15, 23, 42, 0.16), 0 4px 10px rgba(15, 23, 42, 0.08)`): le schermate larghe (`schermo`: tablet a muro, scheda dell'add-on, cruscotto) e gli orologi.
- **Ombra del telefono** (`--ombra-telefono`: `0 30px 60px rgba(15, 23, 42, 0.3), 0 10px 20px rgba(15, 23, 42, 0.14)`): ogni schermata dentro un telefono.
- **Ombra del tasto pieno** (`0 8px 20px rgba(29, 78, 216, 0.28)`; sulla copertina `0 10px 24px rgba(0, 0, 0, 0.22)`): sotto il tasto pieno, dello stesso blu del tasto. È un'ombra spostata in basso, non un alone intorno.
- **Ombra della testata** (`0 6px 24px rgba(15, 23, 42, 0.08)`): sotto la barra appiccicata, solo dopo lo scorrimento.
- **Rilievo della lingua** (`0 1px 3px rgba(15, 23, 42, 0.12)`): il tasto IT/EN scelto, che sta sopra il gruppo.

### Named Rules

**La regola dell'ombra sul campo.** Una scheda ha l'ombra solo quando sta sul campo azzurrino; nella sezione bianca la stessa scheda diventa campo e perde l'ombra. I telefoni e gli schermi hanno sempre la loro ombra, su qualunque fondo.

**La regola della luce dall'alto.** Ogni ombra ha x = 0 e y > 0, tinta d'inchiostro (o del colore del tasto che la fa). Niente ombre centrate, niente `inset` di elevazione, niente bagliori.

## Shapes

Tre raggi fanno tutto: 20px per le scatole (schede, note, passi, modulo, listino, disegno tecnico, foglio dell'informativa), 12px per quello che si tocca (tasti, campi di modulo, esito, voci del menu sul telefono) e 999px per le pastiglie (voci del menu, tasti lingua, pastiglie di serie, spia, prova gratuita, sottotitolo dell'informativa) e per il cerchio dei passi. Il telefono è un'immagine con 9px di bordo color notte e 38px di raggio; le schermate larghe hanno 16px senza bordo, gli orologi 24px senza bordo; il marchio ha 9px, il `code` 6px, l'anello di fuoco 6px.

I bordi sono rari e spessi quando ci sono: 2px d'inchiostro sul tasto a contorno, 2px di blu sopra le voci di scheda tecnica, 2px trasparenti sul campo di modulo che diventano blu a fuoco, 2px verdi o rossi sull'esito. Il resto si separa con un filo tenue di 1px o cambiando campo. I segni sono tratti: una spunta verde di 12×7px a 2.5px, una croce rossa, un cerchietto tratteggiato per «in arrivo»; le icone del menu sono tratti SVG a 1.8px con `stroke-linecap: square`.

## Components

### Buttons

- **Shape:** arrotondato (12px), altezza minima 50px, padding `0 24px`, Archivo 700 a 1rem, bordo di 2px.
- **Tasto a contorno** (`bottone`): carta con bordo e testo d'inchiostro; in hover si inverte (fondo inchiostro, testo carta) e sale di 2px. È il tasto secondario: «Guarda la plancia», «Scrivici».
- **Tasto pieno** (`bottone-pieno`): fondo e bordo blu, testo bianco, ombra blu sotto; in hover blu scuro. Uno per schermata: «Installa l'add-on» in testata, «Manda» nel modulo.
- **Sulla copertina:** il tasto pieno diventa bianco con testo blu scuro e ombra nera morbida, e in hover si accende d'ambra con testo notte; il tasto a contorno è trasparente con bordo bianco al 60% e testo bianco, in hover bianco al 12%.
- **In testata:** la stessa classe a 42px, padding `0 18px`, 0.92rem, senza bordo né ombra; nascosta sotto 940px.
- **Hover / Focus:** transizioni di 160ms ease-out su trasformazione, sfondo, colore, bordo e ombra; `translateY(-2px)` in hover, nessuno con `prefers-reduced-motion`. Il fuoco è l'anello globale ambra di 3px con 3px di distacco. Occupato o disabilitato: opacità 0.55, cursore `progress`, nessun sollevamento.

### Chips

- **Pastiglie di serie** (`sezioni li`): icona di 24px più nome in 600 a 0.9rem, su campo, padding `8px 14px 8px 10px`, 999px; in hover blu chiaro e sollevamento di 2px. Non sono collegamenti: sono un elenco.
- **Spia** (`spia`): pastiglia bianca con ombra, un pallino di 10px e la parola «accesa» in 700 a 0.82rem; a riposo pallino filo e testo lieve, accesa pallino ambra e testo inchiostro (transizione 260ms). Sta sopra il telefono della copertina, a 18px dal fondo.
- **Prova gratuita** (`piano-prova`): ambra con testo notte, 700 a 0.78rem, padding `5px 11px`. Solo sotto il prezzo Premium.
- **Tasti lingua** (`lingua`): due tasti IT/EN in 700 a 0.82rem dentro un gruppo su campo a 999px con 3px di padding; quello scelto (`aria-pressed="true"`) è bianco con rilievo e testo inchiostro.
- **Sottotitolo dell'informativa** (`sottotitolo-informativa`): blu chiaro con testo blu scuro, 700 a 0.85rem, sotto il titolo.

### Cards / Containers

- **Telefono** (`tavola`): l'immagine a piena larghezza con 9px di bordo notte, 38px di raggio e l'ombra del telefono; sotto, a 16px, la didascalia in 600 a 0.95rem d'inchiostro, con l'eventuale esempio in 500 a 0.85rem grigio lieve. In copertina 340px, nelle file 300px al massimo sotto 520px.
- **Schermo** (`tavola schermo`) e **orologio** (`tavola orologio`): l'immagine senza bordo, 16px (o 24px) di raggio, ombra alta.
- **Scheda** (`schede > div`): 20px di raggio, padding 28px, titolo in 700 a 1.3rem; su campo è carta con ombra, su carta è campo senza ombra. Due per riga.
- **Scheda tecnica** (`scheda`): niente riquadro: tre colonne di testo, ogni voce con un bordo blu di 2px sopra e 14px di padding, nome in 700 a 1.12rem e testo grigio lieve. Sei scatole uguali in fila sono la pagina che fanno tutti, e qui non ci sono.
- **Disegno tecnico** (`strada`): un SVG dentro una scatola bianca a 20px con ombra, con la didascalia sotto un filo tenue a 0.97rem e padding `18px 24px 22px`.
- **Nota** (`nota-privacy`): scatola a 20px, padding `22px 26px`, titolo in grassetto d'inchiostro, testo grigio lieve, al massimo 76ch; carta con ombra sul campo, campo senza ombra sulla carta.
- **Listino** (`listino`): tabella dentro una scatola bianca a 20px con ombra; intestazione su campo con il nome del piano (700, 1.3rem), il prezzo in Oswald e la pastiglia di prova; la colonna Premium ha la testa blu scuro con testo bianco e periodo su-blu, e le celle sul campo Premium. Righe da `16px 20px` separate da filo tenue; «sì» grigio lieve, «no» filo.
- **Passo di scarico** (`scarico`): scatola su campo a 20px, padding `22px 24px`, a quattro colonne: cerchio blu di 44px con il numero bianco, titolo (700, 1.15rem), testo lieve, «come» in blu 700 a destra. Se è un collegamento, in hover si solleva e prende l'ombra.

### Inputs / Fields

- **Style:** il modulo è una scatola su campo (20px, 28px di padding); ogni campo ha l'etichetta in 700 a 0.9rem sopra (8px) e il campo bianco a 12px di raggio, padding `13px 16px`, bordo di 2px trasparente. Le righe a due colonne hanno 20px di colonna.
- **Focus:** l'anello globale si spegne e il bordo diventa blu (transizione 160ms).
- **Error / Disabled:** l'esito (`modulo-esito`) è bianco a 12px, padding `12px 16px`, 0.95rem, con bordo verde di 2px; in errore bordo e testo rossi. Il modulo occupato porta `aria-busy` e il tasto scende a 0.55 di opacità.

### Navigation

- **Testata** (`cappello`): appiccicata, bianca, filo tenue sotto, 64px; marchio di 32px a 9px di raggio più il nome in 700 a 1.2rem; voci in 600 a 0.92rem grigio lieve dentro pastiglie a 999px (`8px 10px`), in hover inchiostro su campo; la voce della sezione corrente (`acceso`, `aria-current`) è d'inchiostro con una riga ambra di 2px sotto (`box-shadow: inset 0 -2px 0`) e angoli vivi. Poi il gruppo lingua e il tasto pieno.
- **Telefono (≤940px):** il tasto pieno sparisce; un `<details>` con icona a tre righe/croce (22px in un cerchio di 44px) apre la stessa lista come colonna, voci a 1rem con padding `12px 14px` e 12px di raggio; la voce accesa è su campo, senza riga ambra. Il menu si richiude scegliendo una voce o con Esc.
- **Collegamenti nel testo:** blu, sottolineati di 1px a 0.2em (3px nell'informativa); in hover blu scuro. Nel piede sono bianchi in 600 a 0.92rem senza sottolineatura, ambra in hover; nell'informativa il piede è grigio lieve, blu in hover.
- **Ritorno (informativa):** `indietro`: marchio 32px più il nome in 700 a 1.2rem, d'inchiostro, blu in hover.

### Il piede

Fascia notte con testo su-blu a 0.95rem: a sinistra la frase e sotto, oltre un filo bianco al 14%, il colofone a 0.88rem con la ragione sociale in bianco; a destra i collegamenti allineati a fine riga.

## Do's and Don'ts

### Do:

- **Do** alternare le sezioni fra carta e campo (`fascia`) e lasciare che il cambio di fondo faccia da separatore: nessuna riga fra una sezione e l'altra.
- **Do** mostrare le schermate del telefono dentro il telefono (9px di bordo notte, 38px di raggio, `--ombra-telefono`) e le schermate larghe come schermi a 16px con `--ombra-alta`.
- **Do** dare l'ombra a una scheda solo sul campo azzurrino e renderla campo senza ombra sulla carta.
- **Do** usare i tre raggi: 20px per le scatole, 12px per quello che si tocca, 999px per le pastiglie.
- **Do** fare i titoli in Archivo 700 a larghezza normale, interlinea 1.08, -0.025em, e le etichette in 600–700 in minuscolo.
- **Do** tenere un tasto pieno blu per schermata e il tasto a contorno d'inchiostro per tutto il resto; sulla copertina il tasto pieno è bianco.
- **Do** tenere le transizioni a 160ms ease-out, i sollevamenti a 2px, e spegnerli con `prefers-reduced-motion`.
- **Do** servire ogni carattere e ogni immagine da `sito/`: niente da domini esterni.

### Don't:

- **Don't** usare gradienti di sfondo, `backdrop-filter`, `filter: blur`, aloni colorati o testo sfumato, in nessuno stato.
- **Don't** usare ombre centrate, bagliori o ombre colorate intorno a un blocco: le ombre sono d'inchiostro e vanno verso il basso.
- **Don't** mettere l'ambra su un fondo di sezione, su un collegamento a riposo o su un testo corrente: è la luce di una cosa piccola.
- **Don't** usare verde e rosso fuori dai segni (spunta, croce, bordo dell'esito).
- **Don't** usare Oswald su parole: solo i prezzi.
- **Don't** scrivere etichette in maiuscolo o con spaziatura allargata, né mettere occhielli o righe introduttive sopra un titolo.
- **Don't** fare griglie di scatole uguali con icona, titolo e testo: le voci sono colonne di testo con un bordo blu sopra.
- **Don't** aggiungere un tema scuro: il sito è `color-scheme: light only`.
- **Don't** scrivere il nome dell'app in un altro modo da **GdAHome** (né «gdahome», né «GDAHOME»), né `gdanav` in maiuscolo.
