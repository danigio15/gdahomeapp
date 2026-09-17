/// Dove sta girando questa copia dell'app, e come si torna alla console.
///
/// Serve a chiudere un anello che si era chiuso addosso a chi installava
/// l'add-on. Nella console di gdahome c'e' un tasto «Apri gdahome» che apre
/// l'app **nella stessa scheda** — e deve restare cosi', perche' la sessione
/// dell'ingress la tiene viva la pagina di Home Assistant e una scheda a parte
/// dopo qualche minuto si sente rispondere «401». Ma l'app, senza nessuna casa
/// abbinata, diceva: «apri gdahome dalla barra laterale e premi Genera QR
/// code» — e la barra laterale riportava all'app. Il codice non si generava
/// mai.
///
/// Da qui l'app sa due cose: se e' l'add-on a servirla dentro Home Assistant,
/// e come tornare alla console che quel codice lo fabbrica. Sul telefono non
/// c'e' nessun ingress e nessuna console da aprire, e la risposta e' no.
///
/// L'import condizionale sceglie la versione giusta quando si costruisce, come
/// per il servitore della plancia (`plancia/servitore_qui/qui.dart`).
library;

export 'nel_browser.dart' if (dart.library.io) 'sul_telefono.dart';
