/// Una presa: un filo aperto verso la casa, visto da chi ci parla sopra.
///
/// Esiste perche' sotto al filo ci sono **tre** cose diverse — un WebSocket
/// verso la porta di casa, un WebSocket verso il centralino, e sopra a
/// entrambi la cifratura — e quello che ci parla sopra non deve saperlo. Il
/// `Filo` manda `auth` e riceve `auth_ok` allo stesso modo in tutti e tre i
/// casi.
///
/// E' l'interfaccia che ha anche il ponte dall'altra parte, con gli stessi
/// nomi (`manda`, `chiudi`): quando le due punte si somigliano, leggerle una
/// di fianco all'altra e' l'unico modo pratico di accorgersi che divergono.
library;

import 'dart:async';

import 'package:web_socket_channel/web_socket_channel.dart';

abstract interface class Presa {
  /// Quello che arriva. Uno stream solo, con un ascoltatore solo.
  Stream<String> get messaggi;

  void manda(String testo);

  Future<void> chiudi();
}

/// Come si apre un WebSocket. Sostituibile nelle prove.
typedef ApriIlCanale = WebSocketChannel Function(Uri dove);

/// Come si apre il filo nudo, prima della cifratura. Sostituibile nelle prove.
typedef ApriLaPresa = Future<Presa> Function(Uri dove);

WebSocketChannel _canaleVero(Uri dove) => WebSocketChannel.connect(dove);

/// La presa vera: un WebSocket.
class PresaSuWebSocket implements Presa {
  PresaSuWebSocket._(this._canale);

  /// Apre, e torna **quando il filo e' su davvero**.
  ///
  /// Aspettare `ready` non e' un dettaglio: qui la prima parola la dice il
  /// telefono — e' lui che comincia la stretta di mano — e scrivere su un
  /// canale che non si e' ancora aperto vuol dire perdere quella parola o
  /// sollevare, a seconda di come tira il vento.
  static Future<Presa> apri(Uri dove, {ApriIlCanale? con}) async {
    final canale = (con ?? _canaleVero)(dove);
    await canale.ready;
    return PresaSuWebSocket._(canale);
  }

  final WebSocketChannel _canale;

  @override
  Stream<String> get messaggi => _canale.stream.map(
    (dynamic grezzo) =>
        grezzo is String ? grezzo : String.fromCharCodes(grezzo as List<int>),
  );

  @override
  void manda(String testo) => _canale.sink.add(testo);

  @override
  Future<void> chiudi() async {
    try {
      await _canale.sink.close();
    } catch (_) {
      /* Gia' chiusa. */
    }
  }
}
