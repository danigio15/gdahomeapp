/// Il navigatore, su questo sistema: gdanav sul telefono, niente nel browser.
///
/// L'import condizionale sceglie quando si costruisce, e nella webapp gdanav
/// non entra proprio — ne' la mappa, ne' la posizione, ne' il Bluetooth.
library;

export 'sul_web.dart' if (dart.library.io) 'sul_telefono.dart';
