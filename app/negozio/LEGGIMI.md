# «Novità» del negozio

Un file per lingua, e **il nome del file è la lingua**: `it-IT.txt`,
`en-US.txt`. Li legge `strumenti/porta-nel-negozio.mjs` e li porta su come
«Novità» della versione.

Stanno qui e non in una casella del Play Console per un motivo solo: quello che
il negozio racconta di una versione, così, si rilegge. Scritto a mano nella
casella non lascia traccia da nessuna parte — e la volta dopo nessuno sa cosa
c'era scritto l'altra volta.

**Il Play Console prende 500 caratteri per lingua.** Il conto lo fa lo
strumento prima di caricare qualunque cosa, e una prova lo tiene fermo
(`ponte/test/il-negozio.test.js`): scoprirlo dopo aver caricato settanta
megabyte vorrebbe dire rifare tutto.

Si scrivono per chi legge la scheda dell'app sul telefono, non per chi legge i
commit: cosa può fare adesso che prima non poteva. Quello che è cambiato dentro
— l'add-on, il ponte, le prove — nel negozio non c'entra niente: quello sta in
`ponte/CHANGELOG.md`, che è la finestra dell'aggiornamento in Home Assistant.

Una lingua nuova è un file nuovo, e basta: va su al giro dopo. Una lingua che
nel Play Console non è dichiarata, però, fa rifiutare tutto — prima si aggiunge
là, poi qui.
