# Il sito

Il posto dove il progetto si racconta a chi non l'ha mai visto: cos'è l'app,
come fa la casa a rispondere da fuori senza che si apra niente sul router, e
le due app — **gdahome** e **gdanav** — fatte vedere con le loro fotografie.

Sta su **[gdahome.org](https://gdahome.org)**.

## Com'è fatta la pagina

Dall'alto in basso, una sezione per volta:

| Sezione | Cosa fa vedere |
| --- | --- |
| `#inizio` | la copertina, scura: il titolo al centro, «Presto su Google Play e App Store», e sotto la scena con tutti gli schermi — il tablet a muro, i due telefoni (plancia e gdanav), Apple Watch e Wear OS — e i quattro numeri |
| `#plancia` | le schermate della plancia in una fila che scorre di lato, e sotto l'elenco delle sezioni |
| `#app` | «Una casa, ogni schermo»: tre racconti, il menu del telefono, la plancia a muro (Soggiorno ed Energia) e gli orologi su una scheda scura |
| `#come` | come funziona, su fondo scuro: tre passi numerati e le tre cose che contano per la sicurezza |
| `#gdanav` | il navigatore, col suo marchio e sette schermate in fila |
| `#prezzi` | una tabella Base/Premium riga per riga, e i tre modi di avere Premium |
| `#installatori`, `#scarica`, `#sostieni`, `#contatti` | per chi installa, le tre tappe per metterla in casa, il sostegno (una fascia ambra) e il modulo |

**Fotografie vere, non mockup.** Tutte le immagini sono schermate dell'app e
dei suoi schermi: quelle della plancia vengono da `docs/immagini/`, quelle del
tablet a muro sono il pannello vero acceso con la casa delle prove e2e,
quelle degli orologi vengono dai rami `vetrina/apple-watch` e
`vetrina/wear-os`. Prima nella sezione della plancia c'era la plancia vera in
un riquadro, e sul server a volte restava vuoto con un avviso: adesso sono
fotografie, stanno nella repository e ci sono sempre.

**Le file che scorrono di lato** (`.galleria`) caricano le loro fotografie
subito, senza `loading="lazy"`: un'immagine che sta fuori a destra in un
contenitore che scorre il browser non la chiede finché non ci si arriva, e
il collaudo — che guarda che ogni immagine abbia dei pixel — la darebbe per
persa.

## Una luce sola

**Il fondo resta chiaro**, anche a chi tiene il telefono in tema scuro: è
carta calda (`--fondo`), e il collaudo lo controlla. C'era un tema scuro che
seguiva quello del sistema, e chi apriva gdahome.org in tema scuro si trovava
una pagina diversa da quella che gli era stata mostrata. Le fasce scure — la
copertina, «come funziona», il racconto degli orologi, il fondo — sono parti
della pagina e valgono per tutti: le schermate chiare dell'app ci stanno
dentro una cornice, non galleggiano sul nero.

**I caratteri** sono Inter per tutto, coi titoli stretti e in minuscolo, e
Oswald solo per i numeri grandi (i quattro della copertina, i passi, le
tappe). Tutti e due serviti da `statico/font/`.

## Per chi installa, e dove scrivere

Il **cruscotto installatore** ha una sezione sua (`#installatori`), perché è
l'unico pezzo di gdahome che non è per chi abita la casa: come sta ogni casa,
le licenze Premium da dare ai clienti, e accanto cosa **non** vede, con le
parole del quadro (`quadro/README.md`). **Quanto costa** (`#prezzi`) dice Base
e Premium, come si ha Premium e gdanav, coi prezzi e le regole di
[`docs/LICENZE.md`](../docs/LICENZE.md); il sostegno (`#sostieni`) sta a parte,
perché non sblocca niente.

E c'è un posto dove **scrivere** (`#contatti`): un modulo con nome, email e
messaggio, che arriva per posta a `assistenza@gdahome.org`. È l'unica cosa
della pagina che non è un file. Manda un `POST /contatto`, che Caddy passa al
tramite sulla stessa macchina, e il tramite lo consegna al server di posta
della casella che risponde (`centralino/src/posta.js`, e il perché sta lì).
Senza JavaScript funziona lo stesso: il modulo è un modulo, e il tramite
risponde con una pagina nella lingua che si stava leggendo. Con JavaScript
l'esito compare sotto il tasto, e la pagina resta dov'è.

Se il tramite non ha un server di posta, il modulo non fa finta: dice che non è
attivo e a chi scrivere. Le impostazioni le chiede `centralino/accendi.sh`
(`POSTA_SERVER`, `POSTA_UTENTE`, …), e `/salute` del tramite porta
`posta: true` quando è acceso.

## Come si guarda

La pagina è fatta di file fermi, e tutti quelli che usa stanno in `sito/`:

```bash
cd sito && python3 -m http.server 8099
```

Poi `http://127.0.0.1:8099/`.

## I file

|                                   |                                                                                                                                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`                      | la pagina: la copertina, la plancia, l'app gdahome (telefono, muro, polso), come funziona, gdanav, quanto costa, per chi installa, scaricala, sostegno, contatti                     |
| `privacy.html`                    | l'informativa — la gemella di `docs/PRIVACY.md`, ed è l'indirizzo che il Play Store tiene da parte                                                                                        |
| `stile.css`                       | i colori, i caratteri, la scena della copertina, le file che scorrono, i racconti, il listino; l'informativa ne prende caratteri, colori e tasti della lingua                     |
| `privacy.css`                     | l'unica cosa che nell'informativa è diversa: una colonna stretta, da leggere                                                                                                              |
| `casa-in-pagina.js`               | la Home Assistant finta della plancia di prima: la pagina non la usa più                                                                                                                  |
| `sito.js`                         | la lingua, l'ombra sotto la barra, le schede che compaiono, il modulo dei contatti — lo caricano tutte e due le pagine                                                                    |
| `statico/`                        | marchio, icone, caratteri, casa demo e le schermate della plancia — **non si toccano a mano**, sono salvati nella repository                                                              |
| `statico/app/`, `statico/gdanav/` | le fotografie delle due app, del tablet a muro e degli orologi, ridotte in JPG (quelle di gdanav e il suo marchio vengono da `danigio15/gdanav`) — **si fanno a mano**, e lo script non le tocca |
| `dashboardmodern_static/`         | la plancia vera — fuori da git; la pagina non la usa più, la vuole lo scambio sul server                                                                                                  |
| `gdahome.png`                     | il marchio dell'informativa                                                                                                                                                               |
| `robots.txt`, `sitemap.xml`       | si può guardare tutto, e le pagine sono due                                                                                                                                               |

## Quello che non si ribatte a mano

Il marchio, le icone, i caratteri Inter e Oswald, le schermate della plancia
(solo quelle che le pagine usano, da `docs/immagini/`), la casa demo e la
plancia intera: li porta uno script, dalle cartelle dove stanno per davvero.

```bash
node strumenti/porta-nel-sito.mjs
```

Rifà `statico/oggetti/`, `statico/font/` e `statico/schermate/`, e basta:
`statico/app/` e `statico/gdanav/` sono fatte a mano e restano come sono. Prima
lo script buttava via tutta `statico/`, e sul server — dove gira prima di ogni
scambio — le fotografie delle app sarebbero sparite a ogni versione.

La plancia (`dashboardmodern_static/`) la porta ancora, anche se la pagina non
la mostra più: lo scambio sul server (`prepara.sh`, che nasce da
`centralino/accendi.sh`) porta il sito **solo** se dopo lo script c'è
`dashboardmodern_static/legacy/dashboard.html`. Finché quella regola resta,
la plancia si porta; è fuori da git e non pesa sulla repository.

## Dove si pubblica

Su **gdahome.org**, e non c'è nessun posto nuovo dove pubblicarlo: è la stessa
macchina del tramite, lo stesso Caddy, lo stesso giro con cui si aggiorna tutto
il resto.

Il bottone è **uno solo**, ed è quello di sempre: **Actions → «Il tramite» →
Run workflow**. Sposta un segno, e da lì in poi non tocca a noi — la macchina
se ne accorge entro dieci minuti, si scarica quella versione, la prova, e solo
se le prove passano scambia. Nessuna chiave da nessuna parte, nessuna porta
nuova aperta.

### Cosa succede sulla macchina

`prepara.sh` (che nasce da [`centralino/accendi.sh`](../centralino/accendi.sh))
scarica il pacchetto della versione e, prima di copiare `sito/`, lancia la
stessa `node strumenti/porta-nel-sito.mjs` che si lancia qui.

Se non ci riesce, **il sito non si scambia**: resta quello di prima, intero.
Attenzione: `prepara.sh` si scrive sulla macchina quando si lancia
`accendi.sh`, e non si aggiorna da solo con le versioni. Se il sito pubblicato
resta indietro, o gli mancano dei file, la prima cosa da guardare è quale
`prepara.sh` c'è sulla macchina. Il resto
dell'aggiornamento va avanti lo stesso, perché il tramite è un servizio e il
sito è una pagina, e non si tiene fermo il primo per la seconda.

Davanti c'è Caddy, che si prende il certificato da solo e serve la cartella
così com'è. Nel suo blocco ci sono quattro cose e basta:

- **niente `try_files`** — una pagina che non esiste deve dire che non esiste,
  non far finta di essere l'indice;
- **due velocità di cache** — `statico/` un giorno, perché
  cambiano solo quando cambia la versione; le pagine no, perché un testo
  corretto che resta in cache è un testo corretto che nessuno legge;
- **`www` è un redirect vero**, non un secondo sito;
- **`/contatto` va al tramite** — l'unica via del sito che non è un file: il
  modulo dei contatti, che il tramite spedisce per posta.

### E prima di spostare il segno

C'è l'altro bottone, **Actions → «Il sito»**, che non pubblica niente: apre il
sito con un browser vero e guarda che le fotografie delle app arrivino tutte.
Parte da sé a ogni
modifica di `sito/` o di `ponte/plancia/`. È il controllo che una pagina ferma
non può farsi da sola — se non trovasse i suoi file non ci sarebbe nessun
errore da nessuna parte, ci sarebbe una pagina bianca.

E le prove che la **macchina** rigira da sé prima di scambiare
([`centralino/test/sito.test.js`](../centralino/test/sito.test.js)) tengono le
due promesse che si rompono per distrazione: che la pagina non tiri su niente
da fuori — nessun carattere scaricato, nessuna libreria, nessun contatore — e
che l'informativa pubblicata dica quello che dice `docs/PRIVACY.md`, sezione
per sezione e con la stessa data. E guardano che **ogni file che le pagine
chiamano stia dentro `sito/`**, salvato in git e scritto con le stesse
maiuscole: un'immagine che punta fuori da `sito/` si vede aprendo la pagina
dalla repository, e sul server è un buco.

## Come si prova

Con un browser vero, come tutto il resto del collaudo:

```bash
cd collaudo && npm install && cd ..
node collaudo/guarda-il-sito.mjs
```

Apre il sito a tre larghezze — telefono, tablet, computer — e guarda, in
ordine di quanto fa male sbagliarlo:

1. **le fotografie arrivano**: si scorre tutta la pagina (le immagini sono
   caricate quando ci si arriva) e si chiede al browser se in ogni immagine ci
   sono davvero dei pixel, perché un'immagine che non arriva lascia un buco e
   non fa nessun rumore;
2. **la plancia, l'app e gdanav** hanno la loro sezione, la loro voce nel menu
   e le loro fotografie; nella pagina non c'è più nessun riquadro;
3. **niente errori** in console e nessun file che non arriva;
4. **niente scorrimento di lato** a nessuna larghezza, e il menu del telefono
   si apre e si richiude;
5. **la lingua si cambia** coi due tasti, anche nelle sezioni nuove, e si torna
   all'italiano;
6. **i link portano dove dicono**, il modulo dei contatti manda al tramite, il
   bottone delle donazioni è quello della plancia;
7. **la copertina resta chiara** anche a chi preferisce il tema scuro;
8. **l'informativa è vestita come il sito**: i caratteri giusti, il fondo
   giusto, una colonna da leggere e i collegamenti che si distinguono dal
   testo.

Le fotografie finiscono in `collaudo/foto/sito-*.png`.

Se la pagina non trovasse i suoi file non ci sarebbe nessun errore da nessuna
parte: ci sarebbe una pagina bianca. Per questo si guarda con un browser vero.
