/// Il WHOOP finto delle prove: lo sportello che fa lo scambio dei token, la
/// pagina dei token di WHOOP (per il PKCE) e l'API v2, tutti in un
/// `MockClient`. I dati sono inventati: una settimana qualunque di un
/// WHOOP qualunque.
library;

import 'dart:convert';

import 'package:gdahome/salute/whoop/collegamento_whoop.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// La mattina della scena: il 3 novembre, alle 9:30.
final mattinaWhoop = DateTime.parse('2026-11-03T09:30:00Z').toLocal();

String _alle(int giorno, int ora, [int minuto = 0]) =>
    DateTime.utc(2026, 11, giorno, ora, minuto).toIso8601String();

/// Sette mattine di recupero, dalla piu' nuova: 78, 64, 41, 85, 70, 29, 55.
Map<String, Object?> recuperiFinti({
  List<int> percenti = const [78, 64, 41, 85, 70, 29, 55],
  bool calibrando = false,
}) => {
  'records': [
    for (var i = 0; i < percenti.length; i++)
      {
        'cycle_id': 1000 - i,
        'sleep_id': 'notte-$i',
        'user_id': 4242,
        'created_at': _alle(3 - i, 6, 40),
        'updated_at': _alle(3 - i, 6, 42),
        'score_state': 'SCORED',
        'score': {
          'user_calibrating': calibrando,
          'recovery_score': percenti[i],
          'resting_heart_rate': 54 + i,
          'hrv_rmssd_milli': 48.2 - i,
          'spo2_percentage': 96.4,
          'skin_temp_celsius': 33.6,
        },
      },
  ],
  'next_token': null,
};

Map<String, Object?> cicliFinti() => {
  'records': [
    {
      'id': 77,
      'user_id': 4242,
      'start': _alle(3, 6, 40),
      'end': null,
      'timezone_offset': '+01:00',
      'score_state': 'SCORED',
      'score': {
        'strain': 12.4,
        'kilojoule': 9800.0,
        'average_heart_rate': 68,
        'max_heart_rate': 171,
      },
    },
    {
      'id': 76,
      'user_id': 4242,
      'start': _alle(2, 6, 55),
      'end': _alle(2, 22, 50),
      'score_state': 'SCORED',
      'score': {'strain': 15.1, 'kilojoule': 11000.0},
    },
  ],
};

Map<String, Object?> sonniFinti() => {
  'records': [
    /* Un pisolino del pomeriggio: non e' «la notte». */
    {
      'id': 'pisolino',
      'start': _alle(2, 14),
      'end': _alle(2, 14, 30),
      'nap': true,
      'score_state': 'SCORED',
      'score': {
        'stage_summary': {
          'total_light_sleep_time_milli': 1200000,
          'total_slow_wave_sleep_time_milli': 0,
          'total_rem_sleep_time_milli': 0,
          'total_awake_time_milli': 600000,
        },
      },
    },
    {
      'id': 'notte',
      'start': _alle(2, 22, 50),
      'end': _alle(3, 6, 40),
      'nap': false,
      'score_state': 'SCORED',
      'score': {
        'stage_summary': {
          'total_in_bed_time_milli': 28200000,
          'total_awake_time_milli': 1920000,
          'total_light_sleep_time_milli': 13800000,
          'total_slow_wave_sleep_time_milli': 5700000,
          'total_rem_sleep_time_milli': 6900000,
          'sleep_cycle_count': 5,
          'disturbance_count': 9,
        },
        'respiratory_rate': 14.6,
        'sleep_performance_percentage': 88,
        'sleep_consistency_percentage': 81,
        'sleep_efficiency_percentage': 92.3,
      },
    },
  ],
};

Map<String, Object?> allenamentiFinti() => {
  'records': [
    {
      'id': 'corsa',
      'start': _alle(2, 18),
      'end': _alle(2, 18, 46),
      'sport_name': 'running',
      'score_state': 'SCORED',
      'score': {
        'strain': 9.8,
        'average_heart_rate': 151,
        'max_heart_rate': 178,
        'kilojoule': 2100.0,
      },
    },
    /* Ancora da calcolare: non c'e'. */
    {
      'id': 'in-calcolo',
      'start': _alle(3, 8),
      'end': _alle(3, 8, 30),
      'sport_name': 'cycling',
      'score_state': 'PENDING_SCORE',
    },
  ],
};

/// La configurazione delle prove: pronta, con lo sportello finto.
final configurazioneFinta = ConfigurazioneWhoop(
  clientId: 'client-delle-prove',
  sportello: Uri.parse('https://sportello.esempio.it/whoop'),
);

/// Il WHOOP finto: quello che riceve, quello che risponde.
class ServerWhoopFinto {
  ServerWhoopFinto();

  final richieste = <http.Request>[];

  /// Il codice che WHOOP ha dato a chi ha detto di si'.
  String codiceBuono = 'codice-buono';
  String accesso = 'accesso-1';
  String rinnovo = 'rinnovo-1';
  int durata = 3600;
  int _giri = 1;

  /// Il rinnovo rifiutato: l'accesso tolto dal sito di WHOOP.
  bool rifiutaIlRinnovo = false;

  /// Nessuna risposta: la rete giu'.
  bool giu = false;

  /// Lo sportello che risponde da se', senza chiedere a WHOOP: 429 (troppe
  /// richieste), 503 (non configurato), come `centralino/src/whoop.js`.
  int? sportelloFerma;

  /// L'API risponde 401 una volta, anche col token buono (scaduto prima).
  bool scadutoUnaVolta = false;

  /// Le vie dell'API che rispondono 403 (scope negato).
  final negate = <String>{};
  bool revocato = false;

  Object? recuperi = recuperiFinti();
  Object? cicli = cicliFinti();
  Object? sonni = sonniFinti();
  Object? allenamenti = allenamentiFinti();

  late final http.Client rete = MockClient(_rispondi);

  /// Le richieste a una via (il pezzo finale dell'indirizzo).
  List<http.Request> a(String via) => [
    for (final r in richieste)
      if (r.url.path.endsWith(via)) r,
  ];

  /// Tutto quello che e' uscito dal telefono, in chiaro: per cercarci quello
  /// che non deve esserci.
  String get tuttoQuelloCheEUscito =>
      [for (final r in richieste) '${r.method} ${r.url} ${r.body}'].join('\n');

  http.Response _json(int stato, Object? corpo) => http.Response(
    jsonEncode(corpo),
    stato,
    headers: {'content-type': 'application/json'},
  );

  Map<String, Object?> _nuoviToken() {
    _giri++;
    accesso = 'accesso-$_giri';
    rinnovo = 'rinnovo-$_giri';
    return {
      'access_token': accesso,
      'refresh_token': rinnovo,
      'expires_in': durata,
      'scope': scopeWhoop.join(' '),
      'token_type': 'bearer',
    };
  }

  Future<http.Response> _rispondi(http.Request r) async {
    richieste.add(r);
    if (giu) throw http.ClientException('la rete e\' giu\'');
    final via = r.url.path;
    if (r.url.host == 'sportello.esempio.it' && via == '/whoop/token') {
      if (sportelloFerma case final stato?) {
        return _json(stato, {'errore': 'fermato'});
      }
      final campi = (jsonDecode(r.body) as Map).cast<String, Object?>();
      return _token(campi);
    }
    if (r.url == tokenWhoop) {
      final campi = Uri.splitQueryString(r.body);
      if (campi['client_id'] != configurazioneFinta.clientId) {
        return _json(401, {'error': 'invalid_client'});
      }
      if (campi['grant_type'] == 'authorization_code' &&
          (campi['code_verifier'] ?? '').length < 43) {
        return _json(400, {'error': 'invalid_grant'});
      }
      return _token(campi);
    }
    if (r.url.host == 'api.prod.whoop.com' && via.startsWith('/developer')) {
      if (r.headers['authorization'] != 'Bearer $accesso') {
        return _json(401, {'error': 'unauthorized'});
      }
      if (scadutoUnaVolta) {
        scadutoUnaVolta = false;
        return _json(401, {'error': 'expired'});
      }
      final dentro = via.substring('/developer'.length);
      if (negate.contains(dentro)) return _json(403, {'error': 'forbidden'});
      return switch ((r.method, dentro)) {
        ('GET', '/v2/recovery') => _json(200, recuperi),
        ('GET', '/v2/cycle') => _json(200, cicli),
        ('GET', '/v2/activity/sleep') => _json(200, sonni),
        ('GET', '/v2/activity/workout') => _json(200, allenamenti),
        ('GET', '/v2/user/profile/basic') => _json(200, {
          'user_id': 4242,
          'email': 'nessuno@esempio.it',
          'first_name': 'Prova',
          'last_name': 'Finta',
        }),
        ('DELETE', '/v2/user/access') => () {
          revocato = true;
          return http.Response('', 204);
        }(),
        _ => _json(404, {'error': 'not found'}),
      };
    }
    return _json(404, {'error': 'non qui'});
  }

  http.Response _token(Map<String, Object?> campi) {
    switch (campi['grant_type']) {
      case 'authorization_code':
        if (campi['code'] != codiceBuono ||
            campi['redirect_uri'] != ritornoWhoop) {
          return _json(400, {'error': 'invalid_grant'});
        }
        return _json(200, _nuoviToken());
      case 'refresh_token':
        if (rifiutaIlRinnovo || campi['refresh_token'] != rinnovo) {
          return _json(400, {'error': 'invalid_grant'});
        }
        return _json(200, _nuoviToken());
    }
    return _json(400, {'error': 'unsupported_grant_type'});
  }
}
