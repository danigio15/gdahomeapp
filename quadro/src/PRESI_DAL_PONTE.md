# Sette file presi dal ponte

`archivio.js`, `segreti.js` e `registro.js` sono **copie identiche** di quelli
in `../../ponte/src/`, come lo sono gia' in `../../centralino/src/`.

Dalla 1.5.9.14 se ne aggiungono quattro, per l'editor della plancia dentro il
cruscotto: `presa.js` (il server WebSocket scritto a mano, su cui la pagina
della plancia bussa), `marchio.js` (la vestizione della pagina col nome e il
logo di chi installa; legge `../marchio/`, che qui e' `quadro/marchio/`),
`inventario.js` (il setaccio dell'inventario di casa: quello che arriva da una
casa ripassa dallo stesso setaccio che l'ha fatto partire) e `catalogo.js` (il
menu delle integrazioni, costruito dai registri).

Non sono una libreria condivisa, e non e' pigrizia: il ponte e' un add-on, e un
add-on si costruisce con la sua cartella come unico contesto. Non puo'
importare niente che stia fuori da li'. Un pacchetto pubblicato per sette file
sarebbe una cerimonia piu' grande della cosa.

Quindi si copiano, e c'e' una prova — `copie.test.js` — che fallisce nel
momento in cui divergono. La copia si aggiorna cosi':

```bash
cp ponte/src/{archivio,segreti,registro,presa,marchio,inventario,catalogo}.js quadro/src/
```

Le due immagini di `quadro/marchio/` sono copie di `ponte/marchio/`, e servono
a `marchio.js` per vestire la pagina della plancia quando l'installatore non
ha un logo suo.
