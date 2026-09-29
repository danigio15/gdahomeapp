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
cp ponte/src/{presa,segreti,archivio,registro,testo,gettone,chiave-licenze}.js centralino/src/
```

`gettone.js` e `chiave-licenze.js` sono le licenze (`docs/LICENZE.md`): il
gettone si verifica con le stesse regole nel ponte e nel centralino, e la
chiave pubblica e' la stessa riga — la scrive `strumenti/chiave-licenze.mjs`
in tutti i posti insieme.

## E due che adesso sono gli originali

`segnalazioni.js` e `versioni.js` erano copie di quelli del vecchio centralino
su Cloudflare, finche' le case giravano in due posti. Quel centralino non c'e'
piu': gli originali sono questi, e le prove delle segnalazioni stanno in
`../test/segnalazioni.test.js`.
