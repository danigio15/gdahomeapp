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
import 'package:gdahome/ponte/invito.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const dove = IndirizzoDelPonte(casa: '192.168.1.50');

http.Client rispondendo(int stato, Object corpo) => MockClient(
  (_) async =>
      http.Response(corpo is String ? corpo : jsonEncode(corpo), stato),
);

void main() {
  test(
    'il codice buono torna tutto quello che serve, non solo il segno',
    () async {
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
      expect(
        abbinato.centralino,
        IndirizzoDelCentralino.leggi('wss://centralino.esempio.it'),
      );
      expect(
        abbinato.indirizzi.single,
        IndirizzoDelPonte.leggi('192.168.1.50:8098'),
      );
      expect(vista.url.toString(), 'http://192.168.1.50:8098/abbinamento');
      final mandato = jsonDecode(vista.body) as Map<String, dynamic>;
      expect(mandato['codice'], 'ABCD2345');
      expect(mandato['nome'], 'iPhone di Anna');
      expect(mandato['sistema'], 'ios');
    },
  );

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

  test('una risposta che non è JSON non fa esplodere niente', () async {
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

  test('una rete che non c\'è diventa «non ti raggiungo»', () async {
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

  /* ─── Quello che si e' inquadrato ──────────────────────────────────────
   *
   * Il QR code dice **due** strade per la stessa casa, e quale sia quella
   * buona dipende da dove si sta in quel momento. Non lo si chiede a chi
   * guarda lo schermo — non lo saprebbe dire — quindi lo si prova qui: le due
   * strade, e le due volte in cui non c'e' niente da scegliere. */

  test('sul divano si va dritti, senza passare da fuori', () async {
    /* Dritti e' meglio quando si puo': sono i millesimi contro i decimi, e
     * soprattutto non ha bisogno che internet ci sia. */
    late Uri bussato;
    final entrata = await Abbinamento.conLInvito(
      Invito.leggi(
        'gdahome|1|ABCD|wss://centralino.esempio.dev|192.168.1.50:8098',
      ),
      nome: 'iPhone di Anna',
      sistema: 'ios',
      bussa: (dove) async {
        bussato = dove;
        return true;
      },
      cliente: rispondendo(201, {
        'segno': 'a' * 64,
        'chiave': 'b' * 64,
        'dispositivo': {'id': 'dm_1', 'nome': 'iPhone di Anna'},
      }),
    );

    expect(bussato.toString(), 'http://192.168.1.50:8098/salute');
    expect(entrata.daDentro, IndirizzoDelPonte.leggi('192.168.1.50:8098'));
    expect(entrata.abbinato.identificativo, 'dm_1');
  });

  test(
    'alla stazione non risponde nessuno, e si passa dal centralino',
    () async {
      /* Il silenzio degli indirizzi di casa e' una risposta: vuol dire «non sei
     * in casa». Qui si guarda che quel silenzio porti dall'altra parte, e non
     * a un errore. */
      final quale = await _dovePorta(
        Invito.leggi(
          'gdahome|1|ABCD|wss://centralino.esempio.dev|192.168.1.50:8098',
        ),
        rispondono: false,
      );
      expect(quale, 'wss://centralino.esempio.dev');
    },
  );

  test('il centralino del QR code vince su quello dell\'app', () async {
    /* E' il caso che prima non funzionava affatto: una casa che chiama un
     * centralino suo, e un'app costruita con un altro. Le due meta' non si
     * incontravano mai, e quello che si vedeva era «non trovo la casa». */
    final quale = await _dovePorta(
      Invito.leggi('gdahome|1|ABCD|wss://quello.della.casa||'),
      ripiego: IndirizzoDelCentralino.leggi('wss://quello.dell.app'),
    );
    expect(quale, 'wss://quello.della.casa');
  });

  test('un QR code che non dice il centralino usa quello dell\'app', () async {
    final quale = await _dovePorta(
      Invito.leggi('gdahome|1|ABCD||'),
      ripiego: IndirizzoDelCentralino.leggi('wss://quello.dell.app'),
    );
    expect(quale, 'wss://quello.dell.app');
  });

  test('un QR code senza nessuna strada lo dice, invece di provarci', () async {
    await expectLater(
      Abbinamento.conLInvito(
        Invito.leggi('gdahome|1|ABCD||'),
        nome: 'x',
        sistema: 'ios',
      ),
      throwsA(
        isA<PonteIrraggiungibile>().having(
          (e) => e.spiegazione,
          'spiegazione',
          contains('non dice da dove si entra'),
        ),
      ),
    );
  });

  test('il silenzio di tutti gli indirizzi è una risposta', () async {
    /* La differenza fra le due: `qualeRisponde` dice «nessuno», ed e' quello
     * che fa scegliere la strada; `qualeIndirizzo` deve tenerne uno comunque,
     * perche' domani, tornati a casa, quello e' meglio di niente. */
    final due = [
      IndirizzoDelPonte.leggi('192.168.1.50:8098')!,
      IndirizzoDelPonte.leggi('10.0.0.4:8098')!,
    ];
    expect(
      await Abbinamento.qualeRisponde(due, bussa: (_) async => false),
      isNull,
    );
    expect(
      await Abbinamento.qualeIndirizzo(due, bussa: (_) async => false),
      due.first,
    );
    expect(
      await Abbinamento.qualeRisponde(const [], bussa: (_) async => true),
      isNull,
    );
  });

  test('il saluto dice se il ponte c\'è', () async {
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

/// Dove e' andata a bussare: torna l'indirizzo del centralino a cui l'app ha
/// aperto il filo, senza che serva un centralino vero.
///
/// La presa finta chiude subito: quello che si sta guardando non e' cosa si
/// dicono — quello lo provano le prove del centralino — ma **a chi** l'app ha
/// deciso di parlare.
Future<String> _dovePorta(
  Invito invito, {
  IndirizzoDelCentralino? ripiego,
  bool rispondono = false,
}) async {
  late Uri aperto;
  try {
    await Abbinamento.conLInvito(
      invito,
      nome: 'x',
      sistema: 'ios',
      centralinoDiRipiego: ripiego,
      bussa: (_) async => rispondono,
      apri: (dove) async {
        aperto = dove;
        throw const _ReteAssente();
      },
    );
  } on PonteIrraggiungibile {
    /* Aspettata: la presa finta non apre niente. */
  }
  return '${aperto.scheme}://${aperto.host}';
}

class _ReteAssente implements Exception {
  const _ReteAssente();
  @override
  String toString() => 'Connection refused';
}
