/// Il collaudo: le due meta' vere che si parlano.
///
/// Tutte le altre prove hanno un finto in mezzo. L'app e' provata contro un
/// ponte finto scritto in Dart; il ponte e' provato contro una Home Assistant
/// finta scritta in Node. Ognuna delle due meta' e' convinta che l'altra si
/// comporti come se l'e' immaginata — e finche' non si incontrano, quella
/// convinzione non l'ha verificata nessuno.
///
/// Qui si incontrano. Il ponte e' il processo vero, `node ponte/src/index.js`,
/// quello che gira dentro l'add-on. Il cliente e' il codice vero dell'app. I
/// finti restano solo alle estremita': una Home Assistant dietro il ponte, e
/// nessuno davanti al cliente.
///
/// Serve `node`. Se non c'e', le prove si saltano invece di rompersi.
@Timeout(Duration(seconds: 90))
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/ponte/abbinamento.dart';
import 'package:gdahome/ponte/errori.dart';
import 'package:gdahome/ponte/indirizzo.dart';

import 'casa_finta.dart';
import 'ponte_vero.dart';

void main() {
  if (!PonteVero.cENode) {
    test('il collaudo dal vivo vuole node, che qui non c\'è', () {
      markTestSkipped('node non è installato');
    }, skip: true);
    return;
  }

  late CasaFinta casa;
  late PonteVero ponte;

  setUp(() async {
    casa = await CasaFinta.alza();
    casa.entita = [
      CasaFinta.unaEntita('light.cucina', 'on', nome: 'Luce cucina'),
      CasaFinta.unaEntita('light.salotto', 'off', nome: 'Luce salotto'),
      CasaFinta.unaEntita(
        'binary_sensor.finestra',
        'on',
        nome: 'Finestra bagno',
        tipo: 'window',
      ),
      CasaFinta.unaEntita(
        'sensor.fuori',
        '18.4',
        nome: 'Temperatura fuori',
        tipo: 'temperature',
        unita: '°C',
      ),
    ];
    ponte = await PonteVero.accendi(casa);
  });

  tearDown(() async {
    await ponte.spegni();
    await casa.spegni();
  });

  test('il ponte vero si alza e dice di essere vivo', () async {
    final dove = IndirizzoDelPonte.leggi(ponte.indirizzo)!;
    expect(await Abbinamento.cePonte(dove.salute), isTrue);
  });

  test(
    'dal codice della console al segno, con il codice usato una volta sola',
    () async {
      final dove = IndirizzoDelPonte.leggi(ponte.indirizzo)!;
      final codice = await ponte.codiceDiAbbinamento();

      final abbinato = await Abbinamento.chiedi(
        dove: dove,
        codice: codice,
        nome: 'iPhone del collaudo',
        sistema: 'ios',
      );
      expect(abbinato.segno, matches(RegExp(r'^[0-9a-f]{64}$')));
      /* La chiave del filo e' l'altra meta': senza, il telefono farebbe la
       * stretta di mano col ponte vero e poi non capirebbe una parola. */
      expect(abbinato.chiave, matches(RegExp(r'^[0-9a-f]{64}$')));
      expect(abbinato.chiave, isNot(abbinato.segno));
      expect(abbinato.identificativo, startsWith('dm_'));
      /* E il ponte vero dice dove tornare. Questo banco non ha centralino —
       * non c'e' nessun Supervisor da cui sapere gli indirizzi di casa — ma
       * l'identificativo della casa c'e' sempre. */
      expect(
        abbinato.casaAlCentralino,
        matches(RegExp(r'^casa_[0-9a-f]{32}$')),
      );

      /* Lo stesso codice, una seconda volta, non vale piu'. */
      await expectLater(
        Abbinamento.chiedi(
          dove: dove,
          codice: codice,
          nome: 'un altro',
          sistema: 'ios',
        ),
        throwsA(isA<CodiceRifiutato>()),
      );

      /* E il ponte, dalla sua parte, ha registrato il telefono. */
      final stato = await ponte.statoDellaConsole();
      final telefoni = stato['dispositivi'] as List<dynamic>;
      expect(telefoni.length, 1);
      expect((telefoni.first as Map)['nome'], 'iPhone del collaudo');
    },
  );

  test('un codice inventato non abbina niente', () async {
    final dove = IndirizzoDelPonte.leggi(ponte.indirizzo)!;
    await ponte.codiceDiAbbinamento();
    await expectLater(
      Abbinamento.chiedi(
        dove: dove,
        codice: 'INVENTA2',
        nome: 'x',
        sistema: 'ios',
      ),
      throwsA(isA<CodiceRifiutato>()),
    );
    final stato = await ponte.statoDellaConsole();
    expect(stato['dispositivi'], isEmpty);
  });

  test(
    'abbinato, il cliente vero entra e legge la casa attraverso il ponte vero',
    () async {
      final collegamento = await _abbinaEApri(ponte);
      try {
        expect(collegamento.comeVa, ComeVa.aperta);
        expect(collegamento.dentro, isTrue);
        expect(collegamento.daDove, DaDove.daDentro);

        final stato = collegamento.stato!;
        expect(stato.quante, 4);
        expect(stato['light.cucina']!.nome, 'Luce cucina');
        expect(stato['light.cucina']!.accesa, isTrue);
        expect(stato['sensor.fuori']!.unita, '°C');

        /* Il segno del Supervisor non ha mai attraversato il ponte. */
        expect(collegamento.casa!.segno, isNot(segnoDelSupervisor));

        /* E le buste del ponte vero — Node — si aprono qui — Dart —
         * compresse: e' l'unica prova in cui il gzip attraversa davvero le
         * due implementazioni. */
        expect(collegamento.traffico, contains(', gzip)'));
      } finally {
        await collegamento.chiudi();
      }
    },
  );

  test(
    'un comando dell\'app arriva a Home Assistant, passando per il ponte',
    () async {
      final collegamento = await _abbinaEApri(ponte);
      try {
        casa.arrivati.clear();
        await collegamento.stato!.comanda('turn_off', 'light.cucina');

        final comando = casa.arrivati.firstWhere(
          (uno) => uno['type'] == 'call_service',
        );
        expect(comando['domain'], 'light');
        expect(comando['service'], 'turn_off');
        expect(comando['target'], {'entity_id': 'light.cucina'});
      } finally {
        await collegamento.chiudi();
      }
    },
  );

  test('un cambiamento in casa arriva fino all\'app', () async {
    final collegamento = await _abbinaEApri(ponte);
    try {
      expect(collegamento.stato!['light.salotto']!.accesa, isFalse);

      casa.cambia('light.salotto', 'on', nome: 'Luce salotto');

      await _finoA(() => collegamento.stato!['light.salotto']!.accesa);
      expect(collegamento.stato!['light.salotto']!.accesa, isTrue);
    } finally {
      await collegamento.chiudi();
    }
  });

  test('un segno inventato non apre il filo', () async {
    final archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.apri();
    await archivio.aggiungi(
      nome: 'Casa',
      segno: 'un segno che non ho mai ricevuto',
      inCasa: IndirizzoDelPonte.leggi(ponte.indirizzo)!,
    );
    final collegamento = Collegamento(archivio: archivio);
    try {
      await collegamento.apri();
      expect(collegamento.comeVa, ComeVa.segnoScaduto);
    } finally {
      await collegamento.chiudi();
    }
  });

  test('staccato dalla console, il telefono non rientra più', () async {
    final collegamento = await _abbinaEApri(ponte);
    try {
      final stato = await ponte.statoDellaConsole();
      final id = ((stato['dispositivi'] as List).first as Map)['id'] as String;

      /* Nel mondo vero e' un dito sul bottone «Stacca». */
      await _staccaDallaConsole(ponte, id);

      await collegamento.apri(forza: true);
      expect(collegamento.comeVa, ComeVa.segnoScaduto);
    } finally {
      await collegamento.chiudi();
    }
  });
}

/// Fa tutto quello che fa una persona al primo avvio: codice dalla console,
/// abbinamento, e apertura della casa.
Future<Collegamento> _abbinaEApri(PonteVero ponte) async {
  final dove = IndirizzoDelPonte.leggi(ponte.indirizzo)!;
  final codice = await ponte.codiceDiAbbinamento();
  final abbinato = await Abbinamento.chiedi(
    dove: dove,
    codice: codice,
    nome: 'Telefono del collaudo',
    sistema: 'android',
  );

  final archivio = ArchivioDelleCase(CassaforteInMemoria());
  await archivio.apri();
  await archivio.aggiungi(
    nome: 'Casa del collaudo',
    segno: abbinato.segno,
    identificativo: abbinato.identificativo,
    chiave: abbinato.chiave,
    casaAlCentralino: abbinato.casaAlCentralino,
    centralino: abbinato.centralino,
    inCasa: dove,
  );

  final collegamento = Collegamento(archivio: archivio);
  await collegamento.apri();
  /* Le entita' si leggono solo quando servono: qui servono subito. */
  await collegamento.serveLaCasa();
  return collegamento;
}

Future<void> _staccaDallaConsole(PonteVero ponte, String id) async {
  final cliente = HttpClient();
  try {
    final richiesta = await cliente.deleteUrl(
      Uri.parse('${ponte.console}/api/dispositivi/$id'),
    );
    /* Il dito e' di un amministratore: lo dice l'ingress. */
    richiesta.headers.set('X-Remote-User-Id', amministratoreDellaProva);
    final risposta = await richiesta.close();
    await risposta.drain<void>();
  } finally {
    cliente.close(force: true);
  }
}

Future<void> _finoA(
  bool Function() condizione, {
  Duration entro = const Duration(seconds: 10),
}) async {
  final fine = DateTime.now().add(entro);
  while (DateTime.now().isBefore(fine)) {
    if (condizione()) return;
    await Future<void>.delayed(const Duration(milliseconds: 20));
  }
  throw StateError('l\'attesa è scaduta');
}
