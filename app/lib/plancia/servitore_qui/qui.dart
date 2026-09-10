/// Il servitore su questo sistema: ce n'e' uno per il telefono e uno per il
/// browser, e fanno la stessa cosa in due modi diversi.
///
/// Sul telefono e' un server vero su `127.0.0.1`. Nel browser un server non si
/// puo' aprire, e allora e' un **service worker**: si mette in mezzo alle
/// richieste della plancia e risponde lui, chiedendo i file sul filo esattamente
/// come li chiede il telefono.
///
/// L'import condizionale sceglie la versione giusta quando si costruisce, e chi
/// disegna la schermata non lo sa: vede un servitore, e gli chiede la pagina.
library;

export 'sul_web.dart' if (dart.library.io) 'sul_telefono.dart';
