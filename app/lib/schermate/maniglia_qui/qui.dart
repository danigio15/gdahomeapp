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
/// riceve un tocco**: la maniglia si vede e non si apre, e a barra aperta le
/// sue voci non si premono. Non e' un difetto nostro: e' come e' fatto il web,
/// e vale per qualunque cosa si metta sopra un riquadro.
///
/// Allora nel browser si fanno due cose, e le fa questo:
///
///  - una **fascia** invisibile, un elemento vero della pagina, messa dove sta
///    la maniglia e sopra il riquadro. Non fa il gesto: lo **rivela**. Il tocco
///    ha per bersaglio lei, sale fino alla vista, e il motore ne ricava le
///    coordinate dalla finestra — `event_position_helper.dart` — quindi la
///    maniglia disegnata da Flutter lo riceve dov'e' davvero, col suo tocco e
///    il suo trascinamento. Cosi' il gesto resta uno: quello dell'app, che sul
///    telefono e nel browser e' lo stesso pezzo di codice;
///
///  - mentre la barra copre la plancia, il **riquadro si fa da parte**: i
///    tocchi lo attraversano, arrivano all'app, e le voci della barra si
///    premono come sul telefono.
///
/// L'import condizionale sceglie la versione giusta quando si costruisce, e la
/// barra non sa su cosa sta girando.
library;

export 'sul_web.dart' if (dart.library.io) 'sul_telefono.dart';
