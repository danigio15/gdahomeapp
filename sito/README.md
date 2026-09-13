# Il sito

Il posto dove il progetto si racconta a chi non l'ha mai visto: cos'è l'app,
come fa la casa a rispondere da fuori senza che si apra niente sul router, e
**la plancia vera che ci gira dentro**.

Sta su **[gdahome.org](https://gdahome.org)**.

## La plancia non è una riproduzione: è la plancia

È il pezzo per cui il sito esiste, ed è anche la cosa che il sito **non**
disegna. In un riquadro, nella pagina, gira **DashboardModern**: gli stessi
file che stanno dentro l'add-on, `ponte/plancia/`, copiati byte per byte. Le
trenta voci della barra sono le sue, le tessere sono le sue, i ritratti 3D
delle persone sono i suoi.

C'era una versione precedente di questa pagina in cui la plancia era
ridisegnata a mano in duemila righe di HTML. Somigliava, e si vedeva che non
era lei — che è esattamente quello che `docs/PIANO.md` dice di non fare:

> un renderer parallelo […] o viene identico, e allora riscriverlo non è
> servito a niente, o viene diverso, e l'utente lo riconosce come peggiore.

### Come fa a girare senza una casa

Una plancia vuole un Home Assistant dietro, e un sito statico non ce l'ha: non
può aprire un WebSocket verso casa, e non ci sarebbe nessuna casa a cui
aprirlo.

Ma la plancia ha **un gancio fatto apposta**. Il suo preludio
(`legacy/bridge-prelude.js`) guarda se qualcuno ha già messo un
`__DASHBOARDMODERN_BRIDGE_WS__` nella finestra, e se c'è usa quello invece del
WebSocket vero. È lo stesso gancio con cui l'app sul telefono le cuce addosso
il proprio filo, ed è scritto in [`docs/WEB.md`](../docs/WEB.md): «non è un
WebSocket: è un oggetto finto, messo nella pagina insieme alle altre
premesse».

Di qua dal gancio c'è `casa-in-pagina.js`: una Home Assistant finta che parla
il protocollo vero, con le stesse risposte di `collaudo/casa-finta.js` — la
Home Assistant finta contro cui girano le prove dal vivo. Quello che lì è un
server in Node, qui è un oggetto in pagina: cambia chi consegna le buste, non
cosa c'è dentro. Due comandi non sono di Home Assistant ma del **ponte** —
`dashboardmodern/config/get` e `config/set` — e sono risposti come li risponde
lui, regole comprese (i valori si sostituiscono, una scrittura vuota sopra una
plancia configurata si rifiuta, la revisione cresce e basta).

Dentro c'è la **casa demo del collaudo**: le stesse 235 entità di
`collaudo/casa-demo.json` contro cui girano le prove. Sette stanze, otto luci,
cinque termostati, un fotovoltaico con la batteria, sei elettrodomestici,
un'auto, una piscina.

### Quello che è finto, e il sito lo scrive

Dall'altra parte non c'è nessuna casa: gli stati stanno in una mappa nella
pagina. Premere un interruttore la cambia, e il cambiamento torna indietro
come tornerebbe da Home Assistant — quindi la plancia si muove per davvero —
ma non si accende niente da nessuna parte, e ricaricando la pagina torna tutto
com'era.

Le **due telecamere** sono l'unica cosa che non si può far vedere: la plancia
le chiede come immagini su `/api/camera_proxy/`, e un sito statico non ha un
Home Assistant che gliele dia. In casa quelle due richieste passano dal ponte e
tornano col fotogramma.

## Come si guarda

La plancia non sta nella repository due volte: `sito/dashboardmodern_static/`
è fuori da git e si fa con un comando.

```bash
node strumenti/porta-nel-sito.mjs
cd sito && python3 -m http.server 8099
```

Poi `http://127.0.0.1:8099/`. Un server ci vuole: un `iframe` su `file://` non
carica i moduli della plancia.

## I file

|                             |                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `index.html`                | la pagina: il colpo d'occhio, come funziona, la plancia, cosa fa, i download, i documenti                          |
| `stile.css`                 | i colori (quelli di `app/lib/vestito/tema.dart`), i caratteri, il fondo vivo coi due aloni, il telaio del riquadro |
| `casa-in-pagina.js`         | la Home Assistant finta che fa girare la plancia                                                                   |
| `sito.js`                   | chiaro e scuro, l'ombra sotto la barra, le schede che compaiono                                                    |
| `statico/`                  | roba portata da altrove — **non si tocca a mano**, è salvata nella repository                                      |
| `dashboardmodern_static/`   | la plancia vera — **non si tocca a mano**, ed è fuori da git                                                       |
| `_redirects`                | `www` porta all'indirizzo senza `www`                                                                              |
| `_headers`                  | quanto tenere in cache: la pagina no, la plancia un giorno                                                         |
| `robots.txt`, `sitemap.xml` | si può guardare tutto, e c'è una pagina sola                                                                       |

## Quello che non si ribatte a mano

Il marchio, le 47 icone, i caratteri Inter e Oswald, la casa demo, e la
plancia intera: li porta uno script, dalle cartelle dove stanno per davvero.

```bash
node strumenti/porta-nel-sito.mjs
```

Si rilancia quando cambia il marchio, un'icona, la casa demo, o quando arriva
una versione nuova della plancia. Quello che finisce in `statico/` è salvato
nella repository (seicento kilobyte); la plancia no, perché sono diciassette
megabyte identici a quelli che stanno già in `ponte/plancia/`.

Lo script **si ferma** se in `dashboard.html` non trova più il preludio dove
se lo aspetta: meglio fermarsi che pubblicare una plancia che resta sul velo
d'avvio.

## Dove si pubblica

Sono file statici: va bene qualunque posto che serva una cartella.

- **Cloudflare Pages** — c'è già il bottone: **Actions → «Il sito» → Run
  workflow**. Ci vuole una cosa sola, una volta sola: un gettone di Cloudflare
  fra i segreti della repository (`CLOUDFLARE_PAGES_TOKEN`, o
  `CLOUDFLARE_API_TOKEN` se è lo stesso del centralino), fatto con «Cloudflare
  Pages: Edit» e «Account Settings: Read». Il progetto su Cloudflare lo crea
  la prima corsa, e l'indirizzo diventa `https://gdahome.pages.dev`. La
  repository resta privata e il sito è pubblico, e non costa niente — come il
  centralino, che ci gira già sopra.

  Da lì in poi si ripubblica da sé a ogni modifica di `sito/` sul ramo
  principale; da un altro ramo esce un'anteprima col suo indirizzo, e quello
  pubblico non si tocca. E non pubblica niente se la plancia non parte: prima
  di caricare, il workflow la apre con un browser vero.

  **Il dominio.** Il workflow chiede a Cloudflare di mettere `gdahome.org` (e
  il suo `www`) davanti al progetto. L'unica cosa che non può fare è portarci
  il dominio: o il dominio è già un sito Cloudflare sullo stesso account — e
  allora i record li scrive Cloudflare — oppure nel pannello di chi tiene il
  dominio ci vuole un `CNAME` da `gdahome.org` e da `www.gdahome.org` a
  `gdahome.pages.dev`. Finché non arriva, il sito c'è lo stesso su
  `.pages.dev`: quell'indirizzo non si tocca mai.

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
node strumenti/porta-nel-sito.mjs
cd collaudo && npm install && cd ..
node collaudo/guarda-il-sito.mjs
```

Apre il sito a tre larghezze — telefono, tablet, computer — e guarda, in
ordine di quanto fa male sbagliarlo:

1. **la plancia parte**: esce dal velo d'avvio, tira su la sua barra con tutte
   le sue voci (compresa quella che si è fatta chi ci abita, l'acquario), e
   apre le sue pagine;
2. **la plancia risponde**: un comando dato alla plancia arriva fino alla casa
   finta in pagina e le cambia lo stato;
3. **niente errori** in console e nessun file che non arriva — le due
   telecamere sono l'eccezione, ed è scritta nel collaudo;
4. **niente scorrimento di lato** a nessuna larghezza;
5. **i link portano dove dicono**, e il chiaro e scuro si accende.

Le fotografie finiscono in `collaudo/foto/sito-*.png`.

Se la pagina non trovasse i suoi file non ci sarebbe nessun errore da nessuna
parte: ci sarebbe una pagina bianca. Per questo si guarda con un browser vero.
