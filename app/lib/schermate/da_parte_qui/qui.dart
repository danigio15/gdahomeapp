/// Come si fa arrivare un tocco alla barra, su questo sistema.
///
/// Sul telefono non c'e' niente da fare, e questo non fa niente: la barra
/// galleggia sopra la plancia e i tocchi le arrivano, perche' il riquadro della
/// plancia e' un WebView disegnato **dentro** la scena dell'app.
///
/// Nel browser no. Li' la plancia e' un `iframe`, e un `iframe` non sta dentro
/// la scena: sta accanto. Il motore web disegna tutto su una tela che i tocchi
/// non li prende — `pointer-events: none`, in `style_manager.dart` — e sul
/// riquadro del `iframe` li rimette — `pointer-events: auto`, in `slots.dart`.
/// Il risultato e' che **tutto quello che l'app disegna sopra la plancia non
/// riceve un tocco**: a barra aperta le sue voci si vedono e non si premono, e
/// toccare fuori non la chiude. Non e' un difetto nostro: e' come e' fatto il
/// web, e vale per qualunque cosa si metta sopra un riquadro.
///
/// E' anche la ragione per cui sopra la plancia l'app non disegna piu' niente
/// per aprire la barra: la porta del menu, sulla plancia, e' un tasto **della
/// pagina** — i suoi tre trattini (`plancia/premesse.dart`) — e il tasto
/// indietro del telefono. Cosi' non c'e' nessun gesto nostro sopra la pagina,
/// e nessun tocco da rivelare.
///
/// Resta una cosa, e la fa questo: mentre la barra copre la plancia, il
/// **riquadro si fa da parte**. I tocchi lo attraversano, arrivano all'app, e
/// le voci della barra si premono come sul telefono.
///
/// L'import condizionale sceglie la versione giusta quando si costruisce, e la
/// barra non sa su cosa sta girando.
library;

export 'sul_web.dart' if (dart.library.io) 'sul_telefono.dart';
