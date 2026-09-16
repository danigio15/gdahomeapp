/// Nel browser: il lavoro si fa qui, non c'e' altro posto.
library;

import 'dart:async';
import 'dart:typed_data';

/// Fa [lavoro] e ne torna il risultato. Qui: sullo stesso filo.
Future<R> altrove<R>(FutureOr<R> Function() lavoro) async => await lavoro();

/// Byte che tornano da un lavoro fatto altrove. Qui non vanno da nessuna
/// parte, e tornano quelli.
Future<Uint8List> byteDaAltrove(FutureOr<Uint8List> Function() lavoro) async =>
    await lavoro();

/// Byte dati a un lavoro fatto altrove. Qui restano dove sono.
Future<R> altroveCoiByte<R>(
  Uint8List byte,
  FutureOr<R> Function(Uint8List) lavoro,
) async => await lavoro(byte);
