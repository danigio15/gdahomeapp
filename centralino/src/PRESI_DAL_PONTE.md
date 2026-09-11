# Tre file presi dal ponte

`presa.js`, `segreti.js` e `archivio.js` sono **copie identiche** di quelli in
`../../ponte/src/`.

Non sono una libreria condivisa, e non e' pigrizia: il ponte e' un add-on, e un
add-on si costruisce con la sua cartella come unico contesto. Non puo' importare
niente che stia fuori da li'. Un pacchetto pubblicato per tre file da duecento
righe sarebbe una cerimonia piu' grande della cosa.

Quindi si copiano, e c'e' una prova — `copie.test.js` — che fallisce nel
momento in cui divergono. La copia si aggiorna cosi':

```bash
cp ponte/src/{presa,segreti,archivio}.js centralino/src/
```

## E uno preso dalla nuvola

`segnalazioni.js` e' una copia identica di `../../nuvola/src/segnalazioni.js`,
e la ragione e' un'altra: per un po' la stessa cosa gira in due posti — il
Worker per le case che non hanno ancora aggiornato, la macchina per le altre —
e due copie che divergono vorrebbero dire due comportamenti diversi a seconda
di dove una casa e' finita.

```bash
cp nuvola/src/segnalazioni.js centralino/src/
```

Quando il Worker si spegnera', questa copia diventa l'originale e la riga qui
sopra si cancella.

