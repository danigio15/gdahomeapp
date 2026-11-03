# Prossima app — note da portare nel rilascio

Questo file raccoglie cosa cambia nell'app fra un rilascio e l'altro, finché
la versione non si fa. Al rilascio: le righe vanno nel CHANGELOG del ponte
(nella sezione della versione) e i due testi qui sotto in `it-IT.txt` e
`en-US.txt`, poi questo file si svuota.

## Salute: l'ultimo valore, la data, e la casa che dice di no

- **Battito, ossigeno e battito a riposo si cercano per 30 giorni**, non più
  2 o 7: «in Salute il battito c'è, 73 il 1° novembre, ma l'app non lo vede».
  Pressione, peso e massa grassa restano a 45 giorni, il tetto oltre cui il
  ponte non scrive una misura (`VECCHIA` in `ponte/src/il-corpo-dal-telefono.js`).
  Si cerca a scalini (un giorno, una settimana, la finestra) per non chiedere
  migliaia di battiti a un Apple Watch.
- **Il sonno è l'ultima notte**, fino a 3 giorni indietro: un orologio rimasto
  a caricare stanotte non fa sparire quella di ieri.
- **La data accanto al valore** quando non è di oggi: «73 bpm · 1 nov»,
  «ieri», come nella plancia.
- **Una misura scelta che non arriva lo dice** sotto la riga, con dove
  guardare: Impostazioni › Salute › Accesso ai dati e dispositivi › GdAHome
  (Health Connect › Autorizzazioni app su Android). Apple non dice mai se il
  permesso di lettura c'è: si dicono tutte e due le possibilità.
- **La casa che non accetta le misure si vede**: senza GdAHome Premium, o col
  telefono non intestato a un utente di Home Assistant, la pagina lo scrive
  sotto l'interruttore («Acceso, ma la casa non accetta le misure») con il
  perché; prima l'errore si perdeva.

## Testi per i negozi

it-IT:
Salute più precisa: battito, ossigeno, pressione e peso si leggono anche se l'ultima misura è di qualche giorno fa, con la data accanto; il sonno è l'ultima notte registrata. Se una misura non arriva l'app dice dove controllare i permessi, e se la casa non accetta le misure lo spiega.

en-US:
More accurate Health: heart rate, blood oxygen, blood pressure and weight are read even when the latest reading is a few days old, with its date shown; sleep is the last recorded night. If a reading doesn't arrive the app says where to check permissions, and if your home doesn't accept readings it explains why.
