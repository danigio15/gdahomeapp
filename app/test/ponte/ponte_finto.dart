/// Un ponte finto: finto nel comportamento, vero nel protocollo.
///
/// E' un server WebSocket di `dart:io` che fa la stessa stretta di mano che fa
/// il ponte vero — e quindi quella che fa Home Assistant. Serve a provare il
/// filo senza un telefono, senza un emulatore e senza una casa: le prove
/// girano in un secondo dentro la CI.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:gdahome/ponte/indirizzo.dart';

const String segnoBuono = 'un-segno-che-va-bene';

class PonteFinto {
  PonteFinto._(this._server);

  final HttpServer _server;
  final List<Map<String, dynamic>> arrivati = [];
  final List<WebSocket> prese = [];

  /// Quante volte qualcuno si e' collegato. Serve a provare la riconnessione.
  int collegamenti = 0;

  /// Quando e' `false`, il ponte rifiuta ogni segno: e' il telefono staccato
  /// dalla console.
  bool accettaIlSegno = true;

  /// Quando e' `true`, non risponde ai comandi: e' Home Assistant che tace.
  bool muto = false;

  static Future<PonteFinto> alza() async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final ponte = PonteFinto._(server);
    unawaited(ponte._ascolta());
    return ponte;
  }

  IndirizzoDelPonte get indirizzo =>
      IndirizzoDelPonte(casa: '127.0.0.1', porta: _server.port);

  Future<void> _ascolta() async {
    await for (final richiesta in _server) {
      if (!WebSocketTransformer.isUpgradeRequest(richiesta) ||
          richiesta.uri.path != '/casa') {
        richiesta.response.statusCode = HttpStatus.notFound;
        await richiesta.response.close();
        continue;
      }
      final presa = await WebSocketTransformer.upgrade(richiesta);
      collegamenti += 1;
      prese.add(presa);
      _manda(presa, {'type': 'auth_required', 'ha_version': 'ponte'});
      presa.listen(
        (dynamic grezzo) => _detto(presa, grezzo),
        onDone: () => prese.remove(presa),
        onError: (Object _) => prese.remove(presa),
      );
    }
  }

  void _detto(WebSocket presa, dynamic grezzo) {
    final detto = jsonDecode(grezzo as String) as Map<String, dynamic>;

    if (detto['type'] == 'auth') {
      final buono = accettaIlSegno && detto['access_token'] == segnoBuono;
      _manda(
        presa,
        buono
            ? {'type': 'auth_ok', 'ha_version': 'ponte'}
            : {'type': 'auth_invalid', 'message': 'segno non valido'},
      );
      if (!buono) presa.close();
      return;
    }

    arrivati.add(detto);
    if (muto) return;

    final id = detto['id'];
    if (detto['type'] == 'un_comando_che_non_esiste') {
      _manda(presa, {
        'id': id,
        'type': 'result',
        'success': false,
        'error': {'code': 'unknown_command', 'message': 'non so cosa sia'},
      });
      return;
    }
    _manda(presa, {
      'id': id,
      'type': 'result',
      'success': true,
      'result': detto['type'] == 'get_states' ? entita : null,
    });
  }

  /// Scrive solo se dall'altra parte c'e' ancora qualcuno.
  ///
  /// Serve perche' un telefono che se ne va chiude il filo *mentre* il ponte
  /// gli sta rispondendo — chiudere l'app dopo aver disdetto una
  /// sottoscrizione fa esattamente questo. Un ponte vero quella risposta la
  /// perde e non se ne accorge; qui senza guardia diventa un errore che fa
  /// fallire una prova che non c'entra niente.
  void _manda(WebSocket presa, Map<String, dynamic> cosa) {
    if (presa.readyState != WebSocket.open) return;
    try {
      presa.add(jsonEncode(cosa));
    } catch (_) {
      /* Chiusa fra il controllo e la scrittura. */
    }
  }

  /// Quello che il ponte finto risponde a `get_states`. Le prove lo cambiano.
  List<Map<String, dynamic>> entita = [];

  /// Comodo per costruire un'entita' senza scrivere ogni volta la stessa roba.
  static Map<String, dynamic> unaEntita(
    String id,
    String stato, {
    String? nome,
    String? unita,
  }) => {
    'entity_id': id,
    'state': stato,
    'attributes': {
      if (nome != null) 'friendly_name': nome,
      if (unita != null) 'unit_of_measurement': unita,
    },
    'last_changed': '2026-09-07T07:00:00.000000+00:00',
  };

  /// Manda un `state_changed` come lo manderebbe Home Assistant.
  void cambia(int id, String entita, Map<String, dynamic>? nuovo) {
    evento(id, {
      'event_type': 'state_changed',
      'data': {'entity_id': entita, 'new_state': nuovo},
    });
  }

  /// Manda un evento a chi si e' sottoscritto con quel numero.
  void evento(int id, Map<String, dynamic> cosa) {
    for (final presa in List.of(prese)) {
      _manda(presa, {'id': id, 'type': 'event', 'event': cosa});
    }
  }

  /// Butta giu' il filo senza avvisare: e' l'ascensore, la galleria, il
  /// passaggio dal Wi-Fi al 4G.
  Future<void> buttaGiu() async {
    for (final presa in List.of(prese)) {
      await presa.close();
    }
    prese.clear();
  }

  Future<void> spegni() async {
    await buttaGiu();
    await _server.close(force: true);
  }
}
