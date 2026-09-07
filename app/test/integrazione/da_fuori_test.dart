/// Il collaudo di quello che l'app promette: **entrare da fuori senza che
/// nessuno abbia configurato niente**.
///
/// La catena intera, tutta vera tranne Home Assistant:
///
///     app (Dart)  ──►  centralino (node)  ◄──  ponte (node)  ──►  HA finta
///
/// Il telefono qui **non ha nessun indirizzo della casa**. Non ce l'ha e non
/// glielo si da': ha otto lettere, e basta quello. E' la differenza fra
/// «funziona se apri una porta sul router» e «funziona», ed e' l'unica prova
/// che la dimostra per intero — tutte le altre hanno un finto in mezzo proprio
/// nel punto che conta.
///
/// Serve `node`. Se non c'e', le prove si saltano invece di rompersi.
@Timeout(Duration(seconds: 120))
library;

import 'dart:io' show Platform;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/ponte/abbinamento.dart';
import 'package:gdahome/ponte/errori.dart';
import 'package:gdahome/ponte/indirizzo.dart';

import 'casa_finta.dart';
import 'centralino_vero.dart';
import 'ponte_vero.dart';

void main() {
  if (!PonteVero.cENode) {
    test('il collaudo da fuori vuole node, che qui non c\'e\'', () {
      markTestSkipped('node non e\' installato');
    }, skip: true);
    return;
  }

  late CasaFinta casa;
  /* `null` quando il centralino non lo accendiamo noi. */
  CentralinoVero? centralino;
  late PonteVero ponte;
  late IndirizzoDelCentralino dove;

  /* La stessa prova, contro **un altro centralino**.
   *
   *     CENTRALINO_ESTERNO=ws://127.0.0.1:8787 flutter test
   *
   * Serve a quello su Cloudflare: e' un'altra scrittura dello stesso
   * centralino, e l'unico modo serio di dire «sono intercambiabili» e' che la
   * prova che conta passi identica contro tutti e due. */
  final esterno = Platform.environment['CENTRALINO_ESTERNO'];

  setUp(() async {
    casa = await CasaFinta.alza();
    casa.entita = [
      CasaFinta.unaEntita('light.cucina', 'on', nome: 'Luce cucina'),
      CasaFinta.unaEntita('light.salotto', 'off', nome: 'Luce salotto'),
    ];

    if (esterno == null) {
      centralino = await CentralinoVero.accendi();
    }
    final indirizzo = esterno ?? centralino!.dove;
    dove = IndirizzoDelCentralino.leggi(indirizzo)!;
    ponte = await PonteVero.accendi(casa, centralino: indirizzo);

    /* Il ponte chiama fuori da solo appena si alza: si aspetta che sia
     * arrivato, se no il telefono bussa a una casa che non c'e' ancora.
     * Lo si chiede al ponte e non al centralino, cosi' la domanda vale per
     * qualunque centralino. */
    await _finoA(
      () async =>
          ((await ponte.statoDellaConsole())['centralino']
              as Map<String, dynamic>?)?['dentro'] ==
          true,
      perche:
          'il ponte non e\' arrivato al centralino:\n'
          '${ponte.registro.join('\n')}',
    );
  });

  tearDown(() async {
    await ponte.spegni();
    await centralino?.spegni();
    await casa.spegni();
  });

  /// Abbina col solo codice e apre il collegamento, **senza mai dare all'app
  /// un indirizzo della casa**.
  Future<Collegamento> abbinaEApri() async {
    final abbinato = await Abbinamento.colCodice(
      centralino: dove,
      codice: await ponte.codiceDiAbbinamento(),
      nome: 'Telefono in stazione',
      sistema: 'android',
    );

    final archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.apri();
    await archivio.aggiungi(
      nome: 'Casa lontana',
      segno: abbinato.segno,
      identificativo: abbinato.identificativo,
      chiave: abbinato.chiave,
      casaAlCentralino: abbinato.casaAlCentralino,
      centralino: abbinato.centralino,
    );

    final collegamento = Collegamento(archivio: archivio);
    await collegamento.apri();
    return collegamento;
  }

  test('col solo codice si abbina, senza sapere dove sia la casa', () async {
    final codice = await ponte.codiceDiAbbinamento();

    /* Il centralino sa che c'e' un abbinamento in corso, ma il codice non lo
     * ha mai visto: gli e' arrivata la sua impronta. */
    final abbinato = await Abbinamento.colCodice(
      centralino: dove,
      codice: codice,
      nome: 'Telefono in stazione',
      sistema: 'android',
    );

    expect(abbinato.segno, matches(RegExp(r'^[0-9a-f]{64}$')));
    expect(abbinato.chiave, matches(RegExp(r'^[0-9a-f]{64}$')));
    expect(abbinato.identificativo, startsWith('dm_'));
    expect(abbinato.casaAlCentralino, matches(RegExp(r'^casa_[0-9a-f]{32}$')));
    expect(abbinato.centralino, dove);

    /* E il ponte, dalla sua parte, ha registrato il telefono. */
    final stato = await ponte.statoDellaConsole();
    final telefoni = stato['dispositivi'] as List<dynamic>;
    expect(telefoni.length, 1);
    expect((telefoni.first as Map)['nome'], 'Telefono in stazione');
  });

  test('un codice inventato non abbina niente, e non dice di piu\'', () async {
    await ponte.codiceDiAbbinamento();
    await expectLater(
      Abbinamento.colCodice(
        centralino: dove,
        codice: 'INVENTA2',
        nome: 'x',
        sistema: 'android',
      ),
      /* Il centralino non ha nessun abbinamento aperto su quell'impronta:
       * chiude, e non c'e' niente da cui capire se il codice esisteva. */
      throwsA(isA<ErroreDelPonte>()),
    );
    expect((await ponte.statoDellaConsole())['dispositivi'], isEmpty);
  });

  test(
    'abbinato dal centralino, il telefono legge la casa e la comanda',
    () async {
      final collegamento = await abbinaEApri();
      try {
        expect(collegamento.comeVa, ComeVa.aperta);
        /* Non «da dentro»: questa casa non ha nessun indirizzo di rete locale
       * nell'archivio, e ci si arriva solo dal centralino. */
        expect(collegamento.daDove, DaDove.dalCentralino);

        final stato = collegamento.stato!;
        expect(stato.quante, 2);
        expect(stato['light.cucina']!.accesa, isTrue);

        /* E il comando torna indietro fino a Home Assistant. */
        casa.arrivati.clear();
        await stato.comanda('turn_off', 'light.cucina');
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

  test('una casa grande arriva intera, spezzata per strada', () async {
    /* La prova del muro vero, e quella che sarebbe servita prima.
     *
     * La prima cosa che l'app chiede e' `get_states`: **tutta la casa in un
     * messaggio solo**. Su una casa vera sono due o tre megabyte, e dal
     * centralino non passano — le funzioni sulla nuvola hanno un tetto di un
     * megabyte per messaggio, e non e' un'impostazione. Quello che si vedeva
     * era un'app che diceva «il filo si e' interrotto» ogni tre secondi,
     * senza una riga di spiegazione da nessuna parte.
     *
     * Qui la casa finta ha ottomila entita', che fanno circa un megabyte e
     * mezzo — sopra al tetto, e sopra alla misura del pezzo. Se la busta non
     * si spezzasse, questa prova non finirebbe. */
    casa.entita = [
      for (var i = 0; i < 8000; i += 1)
        CasaFinta.unaEntita(
          'light.lampada_$i',
          i.isEven ? 'on' : 'off',
          nome: 'Lampada numero $i, con un nome lungo per far peso',
        ),
    ];

    final collegamento = await abbinaEApri();
    try {
      expect(collegamento.comeVa, ComeVa.aperta);
      expect(collegamento.stato!.quante, 8000);
      expect(collegamento.stato!['light.lampada_0']!.accesa, isTrue);
      expect(collegamento.stato!['light.lampada_7999']!.accesa, isFalse);
    } finally {
      await collegamento.chiudi();
    }
  });

  test(
    'un cambiamento in casa arriva al telefono passando dal centralino',
    () async {
      final collegamento = await abbinaEApri();
      try {
        expect(collegamento.stato!['light.salotto']!.accesa, isFalse);
        casa.cambia('light.salotto', 'on', nome: 'Luce salotto');
        await _finoA(() async => collegamento.stato!['light.salotto']!.accesa);
      } finally {
        await collegamento.chiudi();
      }
    },
  );

  test('il centralino conta le case e i telefoni, e non sa altro', () async {
    /* La promessa che regge tutto il resto. Il centralino vede passare i
     * byte di questo collegamento: se ci si potesse leggere dentro, «non
     * serve fidarsi di chi lo gestisce» sarebbe una frase e non un fatto.
     *
     * Che sia vero byte per byte lo prova `ponte/test/cieco.test.js`, che
     * registra tutto quello che attraversa il centralino e controlla che non
     * ci sia dentro niente di leggibile. Qui si prova il fatto piu' piccolo e
     * piu' concreto: il centralino conosce l'identificativo della casa, che
     * gli serve a instradare, e non conosce nessun segno. */
    final quello = centralino;
    if (quello == null) {
      markTestSkipped('questo centralino non tiene i conti');
      return;
    }
    final collegamento = await abbinaEApri();
    try {
      final salute = await quello.salute();
      expect(salute['case'], 1);
      expect(salute['telefoni'], 1);
      expect(
        salute.toString(),
        isNot(contains(collegamento.casa!.segno)),
        reason: 'il segno al centralino non passa',
      );
    } finally {
      await collegamento.chiudi();
    }
  });
}

Future<void> _finoA(
  Future<bool> Function() condizione, {
  Duration entro = const Duration(seconds: 20),
  String perche = 'l\'attesa e\' scaduta',
}) async {
  final fine = DateTime.now().add(entro);
  while (DateTime.now().isBefore(fine)) {
    if (await condizione()) return;
    await Future<void>.delayed(const Duration(milliseconds: 50));
  }
  throw StateError(perche);
}
