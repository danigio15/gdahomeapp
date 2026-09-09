/// Nel browser: il lavoro si fa qui, non c'e' altro posto.
library;

import 'dart:async';

/// Fa [lavoro] e ne torna il risultato. Qui: sullo stesso filo.
Future<R> altrove<R>(FutureOr<R> Function() lavoro) async => await lavoro();
