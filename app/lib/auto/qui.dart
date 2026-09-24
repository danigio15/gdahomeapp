/// Dove si lascia la fotografia per Android Auto, su questo sistema.
///
/// Sul telefono e' un file nella cartella privata dell'app, che il servizio
/// dell'auto legge quando qualcuno sale in macchina. Nel browser non c'e'
/// nessuna auto e non c'e' nessun disco: la fotografia si butta, e chi disegna
/// la schermata non lo sa. L'import condizionale sceglie quando si costruisce.
library;

export 'sul_web.dart' if (dart.library.io) 'sul_telefono.dart';
