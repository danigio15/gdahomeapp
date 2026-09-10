# Il ritratto di una persona

Nella Config della dashboard la faccia di una persona non è una foto: **si
compone**. Chi sei, che capelli, che barba, di che colore, che carnagione, come
sei vestito, occhiali, collana. Quello che si salva sono le **scelte**, non
un'immagine — undici parole dentro `cd_people`, sotto `avatar.face`.

Nell'app quelle scelte non si potevano nemmeno fare: la schermata «Le persone»
era quella generica delle voci, con un nome, un'entità e un emoji.

## Chi disegna

**La plancia.** Non noi, e non è pigrizia.

Il compositore incastra render 3D di Fluent Emoji e poi li ritocca pixel per
pixel: tinte a luminanza preservata, una barba trapiantata da un'altra testa e
riscalata sulla mandibola giusta, le iridi ricolorate dove il laboratorio le ha
misurate, un colletto dipinto, gli occhiali ancorati agli occhi. Sono ottocento
righe più un catalogo di misure generato da uno script.

Rifarle in Dart vorrebbe dire due cose. La prima è il tempo. La seconda è
peggio: il giorno che una di quelle formule cambia nella plancia, **la stessa
persona avrebbe due facce diverse** a seconda di dove la si guarda. Che è
esattamente quello che questa app non deve fare.

Allora:

```
la schermata dell'app
        │  le scelte, come parametri
        ▼
 una pagina nostra, servita di fianco ai file della plancia
        │  import ./src/sections/person-avatar-section.js
        ▼
 il compositore della plancia, quello vero
        │  le figure, sul filo, dal ponte
        ▼
 un'immagine, dentro il riquadro
```

Stesso codice, stesse figure, stesso risultato. E resta uguale **da solo**
quando la plancia cambia.

## I pezzi

| dove | cosa fa |
|---|---|
| `app/lib/casa/plancia/persone.dart` | quali scelte esistono, e come si scrivono |
| `app/lib/plancia/ritratto.dart` | la pagina che chiede il ritratto al compositore |
| `app/lib/plancia/servitore.dart` | la serve, sul telefono |
| `app/lib/plancia/servitore_qui/sul_web.dart` | la serve, nel browser |
| `app/lib/schermate/configurazione/ritratto.dart` | le file da cui si sceglie, e l'anteprima |
| `app/lib/schermate/configurazione/persone.dart` | tutto il resto di una persona |

La pagina si chiama `gdahome-ritratto.html` e sta **dentro la cartella dei file
della plancia**, perché è lì che va a prendere il modulo che disegna, con un
indirizzo relativo: così vale sul telefono e nel browser, dove davanti c'è il
prefisso dell'app.

## Le file che non si vedono

Non tutte le scelte valgono per tutti, e mostrarle lo stesso vorrebbe dire
mostrarle per finta:

- **Capelli** e **Colore dei capelli** solo per uomo, donna e neutro: ragazzi e
  anziani a monte non sono stati renderizzati coi tagli.
- **Colore del vestito** solo per i tessuti a tinta piena, che il compositore sa
  ricolorare — non per l'astronauta.
- **Colore della barba** solo se una barba c'è; e lasciandolo su «naturale»
  segue i capelli, perché su una testa bionda una barba nera non è naturale,
  è un trucco.

## Quando il ritratto non si vede

Serve la casa collegata: le figure arrivano dal ponte, sul filo, come i file
della plancia. Senza, restano l'emoji e — per ultime — le iniziali, che non sono
un ripiego triste: sono l'avatar che non si deve disegnare, come nelle rubriche
dei telefoni.

## Una cosa che Dart non ha

Gli accenti. La plancia scompone con `normalize("NFKD")` e butta via i segni;
**Dart la normalizzazione Unicode non ce l'ha nella libreria di serie**, e la
sola espressione regolare che toglie i segni non trova niente da togliere —
senza scomporre, «ò» è un carattere solo e non due.

Risultato: «Niccolò» diventava `niccol`, e la stanza «Salottò» non era la stessa
di «Salotto». La tavola sta scritta a mano in
`app/lib/casa/plancia/lettere.dart`, copre il latino accentato d'Europa, e la
usano sia gli identificativi delle persone sia il motore che appaia le stanze
alle aree di Home Assistant.
