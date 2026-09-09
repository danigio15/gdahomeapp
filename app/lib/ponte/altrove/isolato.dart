/// Sul telefono e nelle prove: il lavoro va in un altro isolato.
library;

import 'dart:async';
import 'dart:isolate';

/// Fa [lavoro] in un isolato a parte e ne torna il risultato.
///
/// [lavoro] deve portarsi dietro solo cose che si possono spedire — byte,
/// testo, numeri — e il risultato torna copiato. Per questo chi lo usa passa
/// i byte della chiave e non la chiave, e ricostruisce dentro quello che gli
/// serve.
Future<R> altrove<R>(FutureOr<R> Function() lavoro) => Isolate.run(lavoro);
