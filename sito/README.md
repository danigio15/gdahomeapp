# Il sito

Il posto dove il progetto si racconta a chi non l'ha mai visto: cos'è l'app,
come fa la casa a rispondere da fuori senza che si apra niente sul router,
**una plancia che si tocca**, e quanto costa.

Sta tutto in questa cartella, sono file statici, e non c'è niente da
costruire: si copiano da qualche parte e sono un sito.

## La plancia che si tocca

È il pezzo per cui il sito esiste. Non è un filmato e non sono fotografie: è
l'app disegnata in HTML, con dentro la **casa demo del collaudo** — le stesse
234 entità di `collaudo/casa-demo.json` contro cui girano le prove. Sette
stanze, otto luci, cinque termostati, un fotovoltaico con la batteria, sei
elettrodomestici, due telecamere.

Chi arriva sul sito accende una luce e vede il consumo salire nella pagina
dell'energia; chiude le tapparelle e le vede scendere; sposta un termostato,
inserisce l'allarme, apre la schermata Acquisti e trova il listino vero. Un
filmato lo si guarda; una plancia la si tocca.

**Quello che è finto, e il sito lo scrive.** Dall'altra parte non c'è nessuna
casa: i comandi cambiano una mappa in memoria, non un'entità di Home
Assistant. Il fotovoltaico segue l'ora vera di chi guarda — di notte non
produce, e la casa tira dalla batteria — perché una vetrina che mostra il sole
a mezzanotte si riconosce subito. L'unica cosa inventata nel disegno della
giornata è la curva dei consumi: la casa demo è la fotografia di un istante,
non di un giorno.

## Come si guarda

Basta un doppio clic su `index.html`: la casa demo è un `<script>` e non un
file da scaricare, quindi funziona anche su `file://`, senza server.

Con un server, se si preferisce:

```bash
cd sito && python3 -m http.server 8099
```

## I file

| | |
|---|---|
| `index.html` | la pagina: il colpo d'occhio, come funziona, la plancia, cosa fa, i piani, i download, i documenti |
| `stile.css` | i colori (quelli di `app/lib/vestito/tema.dart`), i caratteri, il fondo vivo coi due aloni |
| `plancia.css` | il vestito della plancia dimostrativa: tutto quello che comincia per `pl-` |
| `plancia.js` | la plancia dimostrativa: le nove sezioni, le schermate dell'app, il bilancio dell'energia |
| `listino.js` | i prezzi |
| `sito.js` | chiaro e scuro, l'ombra sotto la barra, le schede che compaiono, i prezzi nella tabella |
| `statico/` | roba portata da altrove: **non si tocca a mano** |

## Le due cose da non ribattere a mano

**I prezzi.** `listino.js` è la copia di
`app/lib/schermate/acquisti/catalogo.dart`, che nel progetto è il posto dove
stanno i prezzi. Li leggono la schermata Acquisti dentro la plancia
dimostrativa e la tabella della sezione «Piani»: quando cambia il catalogo
dell'app, cambia anche quel file. Tre posti che dicono tre prezzi diversi è il
modo più rapido di perdere la fiducia di chi paga.

**Tutto quello che sta in `statico/`.** Il marchio, le 47 icone, i caratteri
Inter e Oswald, la casa demo: li porta uno script, dalle cartelle dove stanno
per davvero.

```bash
node strumenti/porta-nel-sito.mjs
```

Si rilancia quando cambia il marchio, un'icona, la casa demo del collaudo.
Quello che esce è salvato nella repository apposta: il sito si pubblica com'è.

## Dove si pubblica

Sono file statici: va bene qualunque posto che serva una cartella.

- **Cloudflare Pages** — è la strada naturale, perché il centralino ci gira
  già sopra ed è gratis: si punta il progetto a questa repository con
  `sito` come cartella di uscita, oppure si carica la cartella da
  `wrangler pages deploy sito`. La repository resta privata e il sito è
  pubblico.
- **GitHub Pages** — funziona, con un avvertimento: finché la repository è
  privata, un sito Pages pubblico richiede un piano a pagamento; se no lo
  vede solo chi ha accesso alla repository.
- **Qualunque altro posto** — un bucket, un hosting qualunque, la cartella
  `www` di un server. Non serve Node, non serve un passo di costruzione, non
  ci sono richieste verso l'esterno: i caratteri stanno qui dentro.

Una sola avvertenza sui contenuti: i bottoni dei download puntano a GitHub, e
**finché la repository è privata rispondono «non esiste»** a chi non ci ha
accesso. La pagina lo dice, invece di far sbattere la gente contro un 404.

## Come si prova

Con un browser vero, come tutto il resto del collaudo:

```bash
cd collaudo && npm install && cd ..
node collaudo/guarda-il-sito.mjs
```

Serve `sito/`, lo apre a tre larghezze — telefono, tablet, computer — e
guarda quattro cose: che **la plancia risponda ai clic** (la luce che si
spegne, la tapparella che scende, il termostato che si sposta, l'allarme che
si inserisce, il lucchetto che porta ai piani), che non ci siano errori in
console né file che non arrivano, che la pagina non scorra di lato a nessuna
larghezza, e che i prezzi ci siano davvero. Le fotografie finiscono in
`collaudo/foto/sito-*.png`.

Se la pagina non trovasse i suoi file non ci sarebbe nessun errore da nessuna
parte: ci sarebbe una pagina bianca. Per questo si guarda con un browser vero.
