# Tre file presi dal ponte

`archivio.js`, `segreti.js` e `registro.js` sono **copie identiche** di quelli
in `../../ponte/src/`, come lo sono gia' in `../../centralino/src/`.

Non sono una libreria condivisa, e non e' pigrizia: il ponte e' un add-on, e un
add-on si costruisce con la sua cartella come unico contesto. Non puo'
importare niente che stia fuori da li'. Un pacchetto pubblicato per tre file da
duecento righe sarebbe una cerimonia piu' grande della cosa.

Quindi si copiano, e c'e' una prova — `copie.test.js` — che fallisce nel
momento in cui divergono. La copia si aggiorna cosi':

```bash
cp ponte/src/{archivio,segreti,registro}.js quadro/src/
```
