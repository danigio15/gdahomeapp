/// Il servitore su questo sistema: c'e' sul telefono, non sul web.
///
/// Sul web non si puo' aprire un server dentro la pagina, e il WebView li' e'
/// un riquadro che punta a un servitore acceso a parte — quello del collaudo,
/// `bin/servitore.dart`. L'import condizionale sceglie la versione giusta
/// quando si costruisce, e chi disegna la schermata non lo sa.
library;

export 'nessuno.dart' if (dart.library.io) 'sul_telefono.dart';
