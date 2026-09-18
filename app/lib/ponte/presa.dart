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
import 'dart:typed_data';

import 'package:web_socket_channel/web_socket_channel.dart';

import 'errori.dart';
import 'parole_del_centralino.dart';

abstract interface class Presa {
  /// Quello che arriva. Uno stream solo, con un ascoltatore solo.
  Stream<String> get messaggi;

  void manda(String testo);

  Future<void> chiudi();
}

/// La presa **sopra le buste**: quella su cui parla il filo.
///
/// Sotto ce n'e' sempre una nuda — [Presa] — dove passano le buste, che sono
/// testo (base64). Qui passa quello che c'era dentro, e passa in **byte**:
/// dentro una busta c'e' JSON, e chi lo legge lo legge dai byte senza mai
/// farne una stringa. Sono le stringhe grosse che costano: si allocano
/// nell'isolato che decifra, si copiano in questo, e poi si buttano — mentre
/// i byte, fra isolati, si trasferiscono e non si copiano.
///
/// E' un'interfaccia a parte e non la stessa di sotto perche' le due non sono
/// la stessa cosa: chiamarle allo stesso modo faceva sembrare intercambiabili
/// il filo nudo e quello aperto, che parlano due lingue diverse.
abstract interface class PresaAperta {
  /// Quello che arriva, aperto. Uno stream solo, con un ascoltatore solo.
  Stream<Uint8List> get messaggi;

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

  /// Quello che arriva, e in fondo **il perche' di chi ha chiuso**.
  ///
  /// Chi chiude un WebSocket puo' dire perche', e chi sta dall'altra parte di
  /// solito lo butta via. Qui no: e' l'unica frase che viene da chi lo sa
  /// davvero. «Questa casa adesso non e' collegata» — che il centralino dice
  /// quando l'add-on non e' attaccato — vale mille volte «il filo si e'
  /// chiuso», che e' quello che si vedeva prima e che non dice niente a
  /// nessuno.
  ///
  /// E la si dice come si dice a una persona, non come la dice il centralino:
  /// vedi `parole_del_centralino.dart`. Quella frase finisce **a schermo** —
  /// sotto «Non trovo la casa», e nella diagnostica — e «casa non collegata»,
  /// cosi' com'e', chi la legge la prende per un difetto del telefono.
  @override
  Stream<String> get messaggi => _canale.stream.transform(
    StreamTransformer<dynamic, String>.fromHandlers(
      handleData: (dynamic grezzo, sink) => sink.add(
        grezzo is String ? grezzo : String.fromCharCodes(grezzo as List<int>),
      ),
      handleDone: (sink) {
        final perche = _canale.closeReason;
        if (perche != null && perche.trim().isNotEmpty) {
          sink.addError(FiloCaduto(inParoleNostre(perche)));
        }
        sink.close();
      },
    ),
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
