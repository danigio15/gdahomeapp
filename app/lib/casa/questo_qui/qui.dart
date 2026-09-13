/// Chi chiede a questo sistema come si chiama.
///
/// Sul telefono lo chiede a `dart:io`; nel browser al browser, che il suo nome
/// lo scrive in una riga sola. Le due strade non si possono nemmeno compilare
/// insieme — `package:web` su un telefono non esiste — e l'import
/// condizionale sceglie quando si costruisce.
library;

export 'sul_web.dart' if (dart.library.io) 'sul_telefono.dart';

/* E anche il nome e il sistema: chi chiede «com'e' fatto questo» vuole la
 * risposta, non due import per averla. */
export '../questo_dispositivo.dart' show QuestoDispositivo;
