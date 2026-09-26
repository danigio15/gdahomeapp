/// Le prove dell'abbinamento.
///
/// Quello che si sta provando e' due cose. La prima: che **ogni modo di
/// fallire arrivi alla schermata come una cosa diversa**. «Codice sbagliato»
/// si ribatte, «troppi tentativi» si aspetta, «casa piena» si risolve
/// staccando un telefono, «non ti raggiungo» e' l'indirizzo, «aggiorna» e'
/// una versione. Dire «non ha funzionato» a tutte vuol dire lasciare l'utente
/// a indovinare.
///
/// La seconda: che l'abbinamento passi **sempre** dal filo cifrato, con la
/// stretta di mano legata al codice — anche in casa — e che il codice non
/// viaggi mai, nemmeno dentro una busta.
library;

import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/ponte/abbinamento.dart';
import 'package:gdahome/ponte/errori.dart';
import 'package:gdahome/ponte/indirizzo.dart';
import 'package:gdahome/ponte/invito.dart';
import 'package:gdahome/ponte/presa.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'ponte_finto.dart';

const dove = IndirizzoDelPonte(casa: '192.168.1.50');
const codice = 'ABCDEFGHJKMNPQRS';

http.Client rispondendo(int stato, Object corpo) => MockClient(
  (_) async =>
      http.Response(corpo is String ? corpo : jsonEncode(corpo), stato),
);

void main() {
  late PonteFinto ponte;
  setUp(() async => ponte = await PonteFinto.alza());
  tearDown(() async => ponte.spegni());

  /* Tutte le prese vanno al ponte finto, qualunque indirizzo si chieda: si
   * guarda cosa si dicono, e dove l'app aveva deciso di bussare. */
  final bussati = <Uri>[];
  Future<Presa> alPonteFinto(Uri dove) {
    bussati.add(dove);
    return PresaSuWebSocket.apri(ponte.indirizzo.filo);
  }

  setUp(bussati.clear);

  test(
    'il codice buono torna tutto quello che serve, non solo il segno',
    () async {
      ponte.codiceVivo = codice;
      ponte.ritorno = {
        'casa': 'casa_${'0' * 32}',
        'centralino': 'wss://centralino.esempio.it',
        'indirizzi': ['192.168.1.50:8098'],
      };

      final abbinato = await Abbinamento.chiedi(
        dove: dove,
        /* Battuto come viene: minuscolo, coi trattini. */
        codice: 'abcd-efgh-jkmn-pqrs',
        nome: 'iPhone di Anna',
        sistema: 'ios',
        apri: alPonteFinto,
      );

      expect(abbinato.segno, segnoBuono);
      expect(abbinato.chiave, chiaveBuona);
      expect(abbinato.identificativo, chiBuono);
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

      /* Dal filo, non da una POST in chiaro. */
      expect(bussati.single.toString(), 'ws://192.168.1.50:8098/casa');
      expect(ponte.strette.single['abbina'], 2);
      final conferma = ponte.conferme.single;
      expect(conferma['t'], 'conferma');
      expect(conferma['nome'], 'iPhone di Anna');
      expect(conferma['sistema'], 'ios');
      /* E il codice non ha viaggiato, ne' in chiaro ne' in busta: sta dentro
       * la chiave, e basta. */
      expect(jsonEncode(ponte.strette), isNot(contains(codice)));
      expect(jsonEncode(ponte.conferme), isNot(contains(codice)));
      expect(ponte.codiceVivo, isNull, reason: 'il codice si è speso');
    },
  );

  test('un codice sbagliato non riceve niente, e lo sa', () async {
    ponte.codiceVivo = codice;
    await expectLater(
      Abbinamento.chiedi(
        dove: dove,
        codice: 'SBAGLIATO2345678',
        nome: 'x',
        sistema: 'ios',
        apri: alPonteFinto,
      ),
      throwsA(
        isA<CodiceRifiutato>().having(
          (e) => e.spiegazione,
          'spiegazione',
          'codice sbagliato',
        ),
      ),
    );
    expect(ponte.conferme, isEmpty, reason: 'la conferma non si è aperta');
    expect(ponte.codiceVivo, codice, reason: 'il codice vero resta buono');
  });

  test('senza un codice vivo lo dice', () async {
    await expectLater(
      Abbinamento.chiedi(
        dove: dove,
        codice: codice,
        nome: 'x',
        sistema: 'ios',
        apri: alPonteFinto,
      ),
      throwsA(isA<CodiceRifiutato>()),
    );
  });

  test('una casa piena lo dice dentro il cifrato', () async {
    ponte
      ..codiceVivo = codice
      ..casaPiena = true;
    await expectLater(
      Abbinamento.chiedi(
        dove: dove,
        codice: codice,
        nome: 'x',
        sistema: 'ios',
        apri: alPonteFinto,
      ),
      throwsA(isA<TroppiDispositivi>()),
    );
  });

  test('ogni no della casa arriva come cosa sua', () async {
    final casi = <Map<String, dynamic>, Matcher>{
      {'no': 'troppi tentativi', 'motivo': 'tentativi'}: isA<TroppiTentativi>(),
      {'no': 'nessun codice', 'motivo': 'nessuno'}: isA<CodiceRifiutato>(),
      {'no': 'aggiorna l\'app', 'motivo': 'aggiorna'}: isA<StrettaRifiutata>(),
      /* Un ponte di prima: `abbina: 2` non lo conosce, e lo prende per un
       * telefono che non sa chi sia. */
      {
        'no': 'riabbina questo telefono',
        'riabbina': true,
      }: isA<StrettaRifiutata>().having(
        (e) => e.spiegazione,
        'spiegazione',
        contains('versione vecchia'),
      ),
    };
    for (final caso in casi.entries) {
      await expectLater(
        Abbinamento.chiedi(
          dove: dove,
          codice: codice,
          nome: 'x',
          sistema: 'ios',
          apri: (_) async => _PresaCheRisponde({'v': 1, ...caso.key}),
        ),
        throwsA(caso.value),
        reason: '${caso.key}',
      );
    }
  });

  test('una rete che non c\'è diventa «non ti raggiungo»', () async {
    await expectLater(
      Abbinamento.chiedi(
        dove: dove,
        codice: codice,
        nome: 'x',
        sistema: 'ios',
        apri: (_) async => throw const _ReteAssente(),
      ),
      throwsA(isA<PonteIrraggiungibile>()),
    );
  });

  test('in chiaro, fuori casa, non ci si abbina nemmeno', () async {
    /* Un indirizzo pubblico senza cifrato: da li' passerebbe la stretta di
     * mano per una rete che non e' nostra. Non si bussa proprio. */
    for (final scritto in ['http://casa.esempio.it', '8.8.8.8:8098']) {
      await expectLater(
        Abbinamento.chiedi(
          dove: IndirizzoDelPonte.leggi(scritto)!,
          codice: codice,
          nome: 'x',
          sistema: 'ios',
          apri: alPonteFinto,
        ),
        throwsA(isA<PonteIrraggiungibile>()),
        reason: scritto,
      );
    }
    expect(bussati, isEmpty);
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
    ponte.codiceVivo = 'ABCD';
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
      apri: alPonteFinto,
    );

    expect(bussato.toString(), 'http://192.168.1.50:8098/salute');
    expect(bussati.single.toString(), 'ws://192.168.1.50:8098/casa');
    expect(entrata.daDentro, IndirizzoDelPonte.leggi('192.168.1.50:8098'));
    expect(entrata.abbinato.identificativo, chiBuono);
  });

  test('un indirizzo pubblico in chiaro nel QR code non si prova: si passa dal centralino', () async {
    final bussate = <Uri>[];
    final quale = await _dovePorta(
      Invito.leggi(
        'gdahome|1|ABCD|wss://centralino.esempio.dev|casa.esempio.it:8098',
      ),
      bussa: (dove) async {
        bussate.add(dove);
        return true;
      },
    );
    expect(bussate, isEmpty);
    expect(quale, 'wss://centralino.esempio.dev');
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
  Future<bool> Function(Uri)? bussa,
}) async {
  late Uri aperto;
  try {
    await Abbinamento.conLInvito(
      invito,
      nome: 'x',
      sistema: 'ios',
      centralinoDiRipiego: ripiego,
      bussa: bussa ?? (_) async => rispondono,
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

/// Una presa che alla prima parola risponde una riga, e chiude.
class _PresaCheRisponde implements Presa {
  _PresaCheRisponde(this._risposta);

  final Map<String, dynamic> _risposta;
  final _uscita = StreamController<String>();

  @override
  Stream<String> get messaggi => _uscita.stream;

  @override
  void manda(String testo) {
    if (_uscita.isClosed) return;
    _uscita.add(jsonEncode(_risposta));
    unawaited(_uscita.close());
  }

  @override
  Future<void> chiudi() async {
    if (!_uscita.isClosed) await _uscita.close();
  }
}
