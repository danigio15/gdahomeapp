/// Le prove dell'abbinamento.
///
/// Quello che si sta provando non e' che la POST parta: e' che **ogni modo di
/// fallire arrivi alla schermata come una cosa diversa**. «Codice sbagliato» si
/// ribatte, «troppi tentativi» si aspetta, «casa piena» si risolve staccando un
/// telefono, «non ti raggiungo» e' l'indirizzo. Dire «non ha funzionato» a
/// tutte e quattro vuol dire lasciare l'utente a indovinare.
library;

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/ponte/abbinamento.dart';
import 'package:gdahome/ponte/errori.dart';
import 'package:gdahome/ponte/indirizzo.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const dove = IndirizzoDelPonte(casa: '192.168.1.50');

http.Client rispondendo(int stato, Object corpo) => MockClient(
  (_) async =>
      http.Response(corpo is String ? corpo : jsonEncode(corpo), stato),
);

void main() {
  test('il codice buono torna tutto quello che serve, non solo il segno', () async {
    late http.Request vista;
    final cliente = MockClient((richiesta) async {
      vista = richiesta;
      return http.Response(
        jsonEncode({
          'segno': 'a' * 64,
          'chiave': 'b' * 64,
          'dispositivo': {'id': 'dm_1', 'nome': 'iPhone di Anna'},
          'ritorno': {
            'casa': 'casa_${'0' * 32}',
            'centralino': 'wss://centralino.esempio.it',
            'indirizzi': ['192.168.1.50:8098'],
          },
        }),
        201,
      );
    });

    final abbinato = await Abbinamento.chiedi(
      dove: dove,
      codice: 'ABCD2345',
      nome: 'iPhone di Anna',
      sistema: 'ios',
      cliente: cliente,
    );

    expect(abbinato.segno, 'a' * 64);
    expect(abbinato.chiave, 'b' * 64);
    expect(abbinato.identificativo, 'dm_1');
    /* Da qui l'app impara dove tornare, senza che nessuno abbia battuto un
     * indirizzo. */
    expect(abbinato.casaAlCentralino, 'casa_${'0' * 32}');
    expect(abbinato.centralino, IndirizzoDelCentralino.leggi('wss://centralino.esempio.it'));
    expect(abbinato.indirizzi.single, IndirizzoDelPonte.leggi('192.168.1.50:8098'));
    expect(vista.url.toString(), 'http://192.168.1.50:8098/abbinamento');
    final mandato = jsonDecode(vista.body) as Map<String, dynamic>;
    expect(mandato['codice'], 'ABCD2345');
    expect(mandato['nome'], 'iPhone di Anna');
    expect(mandato['sistema'], 'ios');
  });

  test('ogni rifiuto del ponte arriva come cosa sua', () async {
    final casi = <int, Matcher>{
      403: isA<CodiceRifiutato>(),
      429: isA<TroppiTentativi>(),
      409: isA<TroppiDispositivi>(),
      500: isA<PonteIrraggiungibile>(),
    };
    for (final caso in casi.entries) {
      await expectLater(
        Abbinamento.chiedi(
          dove: dove,
          codice: 'ABCD2345',
          nome: 'x',
          sistema: 'ios',
          cliente: rispondendo(caso.key, {'errore': 'no'}),
        ),
        throwsA(caso.value),
        reason: 'stato ${caso.key}',
      );
    }
  });

  test('la spiegazione del ponte arriva fino allo schermo', () async {
    await expectLater(
      Abbinamento.chiedi(
        dove: dove,
        codice: 'X',
        nome: 'x',
        sistema: 'ios',
        cliente: rispondendo(403, {'errore': 'codice sbagliato'}),
      ),
      throwsA(
        isA<CodiceRifiutato>().having(
          (e) => e.spiegazione,
          'spiegazione',
          'codice sbagliato',
        ),
      ),
    );
  });

  test('una risposta senza segno non passa per buona', () async {
    await expectLater(
      Abbinamento.chiedi(
        dove: dove,
        codice: 'X',
        nome: 'x',
        sistema: 'ios',
        cliente: rispondendo(201, {'dispositivo': <String, dynamic>{}}),
      ),
      throwsA(isA<PonteIrraggiungibile>()),
    );
  });

  test('una risposta che non e\' JSON non fa esplodere niente', () async {
    await expectLater(
      Abbinamento.chiedi(
        dove: dove,
        codice: 'X',
        nome: 'x',
        sistema: 'ios',
        cliente: rispondendo(403, '<html>errore del proxy</html>'),
      ),
      throwsA(isA<CodiceRifiutato>()),
    );
  });

  test('una rete che non c\'e\' diventa «non ti raggiungo»', () async {
    await expectLater(
      Abbinamento.chiedi(
        dove: dove,
        codice: 'X',
        nome: 'x',
        sistema: 'ios',
        cliente: MockClient((_) async => throw const _ReteAssente()),
      ),
      throwsA(isA<PonteIrraggiungibile>()),
    );
  });

  test('il saluto dice se il ponte c\'e\'', () async {
    expect(
      await Abbinamento.cePonte(
        dove.salute,
        cliente: rispondendo(200, {'vivo': true}),
      ),
      isTrue,
    );
    expect(
      await Abbinamento.cePonte(
        dove.salute,
        cliente: rispondendo(200, {'vivo': false}),
      ),
      isFalse,
    );
    expect(
      await Abbinamento.cePonte(dove.salute, cliente: rispondendo(404, {})),
      isFalse,
    );
    expect(
      await Abbinamento.cePonte(
        dove.salute,
        cliente: MockClient((_) async => throw const _ReteAssente()),
      ),
      isFalse,
    );
  });
}

class _ReteAssente implements Exception {
  const _ReteAssente();
  @override
  String toString() => 'Connection refused';
}
