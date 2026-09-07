/// L'abbinamento: la sola volta in cui l'app parla col ponte in HTTP.
///
/// Si presenta il codice di otto lettere che la console ha fabbricato, e si
/// riceve il segno. Il segno esce dal ponte **una volta sola**: da quel momento
/// non c'e' nessuna strada per rileggerlo, quindi chi chiama lo deve mettere
/// via subito nel portachiavi.
library;

import 'dart:convert';

import 'package:http/http.dart' as http;

import 'errori.dart';
import 'indirizzo.dart';

/// Quanto si aspetta il ponte prima di dire che non c'e'.
const Duration _attesa = Duration(seconds: 12);

class Abbinamento {
  const Abbinamento._();

  /// Chiede il segno. Solleva un [ErroreDelPonte] con dentro il perche'.
  static Future<String> chiedi({
    required IndirizzoDelPonte dove,
    required String codice,
    required String nome,
    required String sistema,
    http.Client? cliente,
  }) async {
    final suo = cliente == null;
    final chi = cliente ?? http.Client();
    try {
      final risposta = await chi
          .post(
            dove.abbinamento,
            headers: const {'content-type': 'application/json'},
            body: jsonEncode({
              /* Il ponte ripulisce il codice per conto suo — maiuscole, spazi,
               * trattini — quindi qui si manda com'e' stato battuto. */
              'codice': codice,
              'nome': nome,
              'sistema': sistema,
            }),
          )
          .timeout(_attesa);

      final corpo = _leggi(risposta.body);

      switch (risposta.statusCode) {
        case 201:
          final segno = corpo['segno'];
          if (segno is! String || segno.isEmpty) {
            throw const PonteIrraggiungibile(
              'il ponte ha risposto senza segno',
            );
          }
          return segno;
        case 403:
          throw CodiceRifiutato(_perche(corpo, 'codice sbagliato o scaduto'));
        case 429:
          throw TroppiTentativi(
            _perche(corpo, 'troppi tentativi: riprova fra un quarto d\'ora'),
          );
        case 409:
          throw TroppiDispositivi(
            _perche(
              corpo,
              'questa casa ha gia\' tutti i telefoni che puo\' avere',
            ),
          );
        default:
          throw PonteIrraggiungibile(
            _perche(corpo, 'il ponte ha risposto ${risposta.statusCode}'),
          );
      }
    } on ErroreDelPonte {
      rethrow;
    } catch (errore) {
      /* Rete assente, indirizzo che non risolve, attesa scaduta, certificato
       * rifiutato: per chi guarda lo schermo sono tutti la stessa cosa. */
      throw PonteIrraggiungibile(_leggibile(errore));
    } finally {
      if (suo) chi.close();
    }
  }

  /// Il ponte c'e' e risponde? Serve al primo avvio, per dire «indirizzo
  /// sbagliato» prima ancora di chiedere il codice.
  static Future<bool> cePonte(
    IndirizzoDelPonte dove, {
    http.Client? cliente,
  }) async {
    final suo = cliente == null;
    final chi = cliente ?? http.Client();
    try {
      final risposta = await chi.get(dove.salute).timeout(_attesa);
      if (risposta.statusCode != 200) return false;
      return _leggi(risposta.body)['vivo'] == true;
    } catch (_) {
      return false;
    } finally {
      if (suo) chi.close();
    }
  }

  static Map<String, dynamic> _leggi(String corpo) {
    try {
      final letto = jsonDecode(corpo);
      return letto is Map<String, dynamic> ? letto : const {};
    } catch (_) {
      return const {};
    }
  }

  static String _perche(Map<String, dynamic> corpo, String difetto) {
    final detto = corpo['errore'];
    return detto is String && detto.isNotEmpty ? detto : difetto;
  }

  static String _leggibile(Object errore) {
    final testo = errore.toString();
    if (testo.contains('TimeoutException')) {
      return 'il ponte non ha risposto in tempo';
    }
    if (testo.contains('Failed host lookup')) {
      return 'questo indirizzo non esiste';
    }
    if (testo.contains('Connection refused')) {
      return 'il ponte non risponde su questa porta';
    }
    return 'non riesco a raggiungere il ponte';
  }
}
