/// Il biglietto con cui il telefono apre il cruscotto nel suo browser.
///
/// «Continua a chiedere il codice da web.» Dal telefono «Apri nel browser»
/// apre un browser che non e' il nostro, e la chiave nell'indirizzo non ci
/// va: ci va un biglietto chiesto al quadro con la chiave, che il cruscotto
/// cambia con la chiave una volta sola.
library;

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/schermate/riquadro/biglietto.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

final _pagina = Uri.parse('https://quadro.gdahome.org/console/');
final _biglietto = 'a' * 32;

void main() {
  test(
    'si chiede al quadro con la chiave, e finisce nell\'indirizzo',
    () async {
      http.Request? vista;
      final cliente = MockClient((richiesta) async {
        vista = richiesta;
        return http.Response(
          jsonEncode({'biglietto': _biglietto, 'scade': 1}),
          200,
        );
      });
      final dove = await conIlBiglietto(_pagina, 'la-chiave', cliente: cliente);
      expect(vista!.method, 'POST');
      expect(
        vista!.url.toString(),
        'https://quadro.gdahome.org/console/biglietto',
      );
      expect(vista!.headers['authorization'], 'Bearer la-chiave');
      expect(
        dove.toString(),
        'https://quadro.gdahome.org/console/?biglietto=$_biglietto',
      );
    },
  );

  test(
    'senza la barra in fondo la via sta lo stesso accanto alla pagina',
    () async {
      http.Request? vista;
      final cliente = MockClient((richiesta) async {
        vista = richiesta;
        return http.Response(jsonEncode({'biglietto': _biglietto}), 200);
      });
      final dove = await conIlBiglietto(
        Uri.parse('https://quadro.gdahome.org/console'),
        'la-chiave',
        cliente: cliente,
      );
      expect(vista!.url.path, '/console/biglietto');
      expect(dove.queryParameters['biglietto'], _biglietto);
    },
  );

  test('senza chiave non si chiede niente: la pagina com\'e\'', () async {
    var chiamate = 0;
    final cliente = MockClient((_) async {
      chiamate += 1;
      return http.Response('{}', 200);
    });
    expect(await conIlBiglietto(_pagina, '', cliente: cliente), _pagina);
    expect(chiamate, 0);
  });

  test(
    'se il quadro dice di no, o risponde male, si apre la pagina com\'e\'',
    () async {
      Future<Uri> con(http.Client cliente) =>
          conIlBiglietto(_pagina, 'la-chiave', cliente: cliente);
      expect(
        await con(
          MockClient(
            (_) async =>
                http.Response('{"errore":"la chiave non va bene"}', 401),
          ),
        ),
        _pagina,
      );
      expect(
        await con(MockClient((_) async => throw Exception('rete assente'))),
        _pagina,
      );
      expect(
        await con(MockClient((_) async => http.Response('non json', 200))),
        _pagina,
      );
      expect(
        await con(
          MockClient((_) async => http.Response('{"biglietto":""}', 200)),
        ),
        _pagina,
      );
    },
  );

  test(
    'un quadro che non risponde in tempo non tiene fermo il tasto',
    () async {
      final cliente = MockClient((_) async {
        await Future<void>.delayed(const Duration(milliseconds: 200));
        return http.Response(jsonEncode({'biglietto': _biglietto}), 200);
      });
      expect(
        await conIlBiglietto(
          _pagina,
          'la-chiave',
          cliente: cliente,
          entro: const Duration(milliseconds: 20),
        ),
        _pagina,
      );
    },
  );
}
