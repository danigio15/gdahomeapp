/// Il riquadro che mostra la plancia vera, su questo sistema.
///
/// Sul telefono e' un WebView, con le impostazioni che alla plancia servono —
/// i video delle telecamere che partono da soli, il JavaScript. Sul web e' un
/// riquadro `iframe`, e le impostazioni non esistono. L'import condizionale
/// sceglie quando si costruisce, e chi disegna la schermata non lo sa.
library;

export 'sul_web.dart' if (dart.library.io) 'sul_telefono.dart';
