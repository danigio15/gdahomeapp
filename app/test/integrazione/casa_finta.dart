/// Una Home Assistant finta, per il ponte vero.
///
/// Sta dall'altra parte del ponte, dove nel mondo vero c'e' Home Assistant. Fa
/// la stretta di mano vera — `auth_required`, `auth` col segno del Supervisor,
/// `auth_ok` — e risponde ai comandi. Non e' Home Assistant: e' abbastanza
/// Home Assistant da mettere alla prova il ponte.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

const String segnoDelSupervisor = 'segno-finto-del-supervisor';

/// L'utente di Home Assistant a nome del quale la prova usa la console del
/// ponte. Nel mondo vero lo dice l'ingress con `X-Remote-User-Id`.
const String amministratoreDellaProva = 'utente-che-amministra';

class CasaFinta {
  CasaFinta._(this._server);

  final HttpServer _server;
  final List<WebSocket> _prese = [];

  /// Tutto quello che il ponte ha girato di qua.
  final List<Map<String, dynamic>> arrivati = [];

  /// Quello che si risponde a `get_states`.
  List<Map<String, dynamic>> entita = [];

  static Future<CasaFinta> alza() async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final casa = CasaFinta._(server);
    unawaited(casa._ascolta());
    return casa;
  }

  String get indirizzo => 'http://127.0.0.1:${_server.port}';

  Future<void> _ascolta() async {
    await for (final richiesta in _server) {
      if (WebSocketTransformer.isUpgradeRequest(richiesta)) {
        final presa = await WebSocketTransformer.upgrade(richiesta);
        _prese.add(presa);
        _manda(presa, {'type': 'auth_required', 'ha_version': '2025.1.0'});
        presa.listen(
          (dynamic grezzo) => _detto(presa, grezzo),
          onDone: () => _prese.remove(presa),
          onError: (Object _) => _prese.remove(presa),
        );
        continue;
      }
      /* La prova che il ponte fa per dire se Home Assistant e' viva. */
      richiesta.response
        ..statusCode = HttpStatus.ok
        ..headers.contentType = ContentType.json
        ..write('{"message":"API running."}');
      await richiesta.response.close();
    }
  }

  void _detto(WebSocket presa, dynamic grezzo) {
    final detto = jsonDecode(grezzo as String) as Map<String, dynamic>;

    if (detto['type'] == 'auth') {
      final buono = detto['access_token'] == segnoDelSupervisor;
      _manda(presa, buono ? {'type': 'auth_ok'} : {'type': 'auth_invalid'});
      if (!buono) presa.close();
      return;
    }

    /* Chi c'e' in casa: il ponte lo chiede per sapere chi amministra, e la
     * sua console si apre solo a un amministratore. Qui ce n'e' uno solo, ed
     * e' quello a nome del quale la prova preme i bottoni della console. */
    if (detto['type'] == 'config/auth/list') {
      _manda(presa, {
        'id': detto['id'],
        'type': 'result',
        'success': true,
        'result': [
          {
            'id': amministratoreDellaProva,
            'name': 'Chi prova',
            'is_owner': true,
            'is_active': true,
            'system_generated': false,
            'group_ids': ['system-admin'],
          },
        ],
      });
      return;
    }

    arrivati.add(detto);
    _manda(presa, {
      'id': detto['id'],
      'type': 'result',
      'success': true,
      'result': detto['type'] == 'get_states' ? entita : null,
    });
  }

  /// Cambia un'entita' e lo racconta a chi si e' sottoscritto, come farebbe
  /// Home Assistant.
  void cambia(String id, String stato, {String? nome}) {
    final sottoscritte = arrivati.where(
      (uno) => uno['type'] == 'subscribe_events',
    );
    if (sottoscritte.isEmpty) return;
    final numero = sottoscritte.last['id'];
    for (final presa in List.of(_prese)) {
      _manda(presa, {
        'id': numero,
        'type': 'event',
        'event': {
          'event_type': 'state_changed',
          'data': {
            'entity_id': id,
            'new_state': unaEntita(id, stato, nome: nome),
          },
        },
      });
    }
  }

  static Map<String, dynamic> unaEntita(
    String id,
    String stato, {
    String? nome,
    String? unita,
    String? tipo,
  }) => {
    'entity_id': id,
    'state': stato,
    'attributes': {
      if (nome != null) 'friendly_name': nome,
      if (unita != null) 'unit_of_measurement': unita,
      if (tipo != null) 'device_class': tipo,
    },
    'last_changed': DateTime.now().toUtc().toIso8601String(),
  };

  void _manda(WebSocket presa, Map<String, dynamic> cosa) {
    if (presa.readyState != WebSocket.open) return;
    try {
      presa.add(jsonEncode(cosa));
    } catch (_) {
      /* Chiusa fra il controllo e la scrittura. */
    }
  }

  Future<void> spegni() async {
    for (final presa in List.of(_prese)) {
      await presa.close();
    }
    _prese.clear();
    await _server.close(force: true);
  }
}
