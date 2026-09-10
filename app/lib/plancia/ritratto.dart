/// Il ritratto di una persona, disegnato **dalla plancia stessa**.
///
/// Nella Config della dashboard il ritratto non e' una foto: si compone —
/// persona, capelli, barba, colore dei capelli e della barba, occhi,
/// carnagione, vestito, colore del vestito, occhiali, collana — e quello che
/// si salva sono le scelte, non un'immagine. A disegnarle e' un compositore
/// che incastra render 3D di Fluent Emoji e li ritocca pixel per pixel: tinte
/// a luminanza preservata, una barba trapiantata da un'altra testa e
/// riscalata, le iridi ricolorate dove il laboratorio le ha misurate, un
/// colletto dipinto, gli occhiali ancorati agli occhi.
///
/// Rifarlo in Dart vorrebbe dire riscrivere ottocento righe di pixel piu' un
/// catalogo di misure generato da uno script — e vorrebbe dire soprattutto una
/// cosa: che il giorno che una di quelle formule cambia nella plancia, la
/// stessa persona avrebbe **due facce diverse** a seconda di dove la si
/// guarda. Che e' esattamente quello che questa app non deve fare.
///
/// Allora il ritratto lo disegna chi lo disegna gia': questa pagina carica il
/// modulo della plancia — `src/sections/person-avatar-section.js`, servito dal
/// ponte come tutto il resto — e gli chiede l'immagine. Stesso codice, stesse
/// figure, stesso risultato, e resta uguale da solo quando la plancia cambia.
library;

/// Come si chiama la pagina. Sta di fianco ai file della plancia, e non e' un
/// file della plancia: la serve il servitore, che se ne accorge dal nome.
const fileDelRitratto = 'gdahome-ritratto.html';

/// La pagina. Tre righe di lavoro, e il resto e' non farsi notare.
///
/// Sta scritta qui e non in un file perche' deve arrivare identica dai due
/// servitori — quello vero del telefono e il service worker del browser — e
/// due copie di tre righe sono due copie che prima o poi divergono.
const paginaDelRitratto = '''
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html,
      body {
        margin: 0;
        height: 100%;
        overflow: hidden;
        background: transparent;
      }
      img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        display: block;
      }
    </style>
  </head>
  <body>
    <img id="ritratto" alt="" />
    <script type="module">
      /* Il compositore della plancia, preso dove sta. L'indirizzo e' relativo
         apposta: questa pagina viene servita di fianco ai moduli, e cosi' vale
         sia sul telefono sia nel browser, dove davanti c'e' il prefisso
         dell'app. */
      import { ritrattoFermo } from "./src/sections/person-avatar-section.js";

      const scelte = Object.fromEntries(new URLSearchParams(location.search));
      ritrattoFermo(scelte)
        .then((dove) => {
          if (dove) document.getElementById("ritratto").src = dove;
        })
        .catch(() => {
          /* Un ritratto che non si disegna lascia il posto vuoto: chi sta
             scegliendo vede la scheda, non un errore in mezzo alle file. */
        });
    </script>
  </body>
</html>
''';

/// L'indirizzo della pagina per queste scelte.
///
/// [base] e' dove stanno i file della plancia — `/dashboardmodern_static/<impronta>`
/// — perche' il modulo che disegna sta li' dentro e si chiama per indirizzo
/// relativo.
Uri indirizzoDelRitratto(Uri servitore, String base, Map<String, String> scelte) =>
    servitore.replace(
      path: '$base/$fileDelRitratto',
      queryParameters: scelte,
    );
