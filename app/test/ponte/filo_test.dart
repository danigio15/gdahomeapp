/// Le prove del filo, contro un ponte vero abbastanza.
///
/// La prova che conta piu' di tutte e' quella delle sottoscrizioni dopo una
/// caduta: e' il modo in cui un'app di casa si rompe in silenzio — smette di
/// aggiornarsi e nessuno se ne accorge finche' non si guarda una luce accesa
/// che nell'app risulta spenta.
library;

import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/ponte/errori.dart';
import 'package:gdahome/ponte/filo.dart';
import 'package:gdahome/ponte/indirizzo.dart';

import 'ponte_finto.dart';

void main() {
  late PonteFinto ponte;

  setUp(() async => ponte = await PonteFinto.alza());
  tearDown(() async => ponte.spegni());

  Filo filoCon({String segno = segnoBuono}) => Filo.fisso(
    indirizzo: ponte.indirizzo,
    segno: segno,
    chi: chiBuono,
    chiave: chiaveBuona,
    /* Nelle prove non si aspettano otto secondi per vedere una riconnessione. */
    attesaMassima: const Duration(milliseconds: 80),
    attesaDellaRisposta: const Duration(seconds: 3),
  );

  test('la stretta di mano va, e il filo si dice dentro', () async {
    final filo = filoCon();
    final visti = <StatoDelFilo>[];
    filo.stato.listen(visti.add);

    await filo.apri();

    expect(filo.dentro, isTrue);
    expect(filo.statoAdesso, StatoDelFilo.dentro);
    await Future<void>.delayed(Duration.zero);
    expect(visti, [StatoDelFilo.chiamando, StatoDelFilo.dentro]);
    await filo.chiudi();
  });

  test(
    'un segno rifiutato solleva, e non si riprova nemmeno una volta',
    () async {
      final filo = filoCon(segno: 'me lo sono inventato');

      await expectLater(filo.apri(), throwsA(isA<SegnoRifiutato>()));

      expect(filo.dentro, isFalse);
      final quantiSubito = ponte.collegamenti;
      /* Molto piu' della attesa massima: se ci riprovasse, si vedrebbe. */
      await Future<void>.delayed(const Duration(milliseconds: 400));
      expect(ponte.collegamenti, quantiSubito, reason: 'non deve ribussare');
      await filo.chiudi();
    },
  );

  test(
    'un telefono staccato mentre e\' collegato viene buttato fuori',
    () async {
      final filo = filoCon();
      await filo.apri();

      ponte.accettaIlSegno = false;
      await ponte.buttaGiu();

      await Future<void>.delayed(const Duration(milliseconds: 500));
      expect(filo.dentro, isFalse);
      await filo.chiudi();
    },
  );

  test('un comando va e torna, con il suo numero', () async {
    final filo = filoCon();
    await filo.apri();

    final risposta = await filo.chiedi({'type': 'get_states'});

    expect(risposta['success'], isTrue);
    expect(ponte.arrivati.single['type'], 'get_states');
    expect(ponte.arrivati.single['id'], isA<int>());
    await filo.chiudi();
  });

  test(
    'i numeri non si ripetono, e ogni risposta va alla sua richiesta',
    () async {
      final filo = filoCon();
      await filo.apri();

      await Future.wait([
        filo.chiedi({'type': 'get_config'}),
        filo.chiedi({'type': 'get_states'}),
        filo.chiedi({'type': 'get_services'}),
      ]);

      final numeri = ponte.arrivati.map((uno) => uno['id']).toList();
      expect(numeri.toSet().length, 3, reason: 'tre numeri diversi');
      await filo.chiudi();
    },
  );

  test('un comando rifiutato da Home Assistant arriva come tale', () async {
    final filo = filoCon();
    await filo.apri();

    await expectLater(
      filo.chiedi({'type': 'un_comando_che_non_esiste'}),
      throwsA(
        isA<ComandoRifiutato>().having(
          (e) => e.codice,
          'codice',
          'unknown_command',
        ),
      ),
    );
    await filo.chiudi();
  });

  test('un comando su un filo chiuso non parte', () async {
    final filo = filoCon();
    await expectLater(
      filo.chiedi({'type': 'get_states'}),
      throwsA(isA<FiloCaduto>()),
    );
    await filo.chiudi();
  });

  test(
    'una richiesta senza risposta muore da sola invece di restare appesa',
    () async {
      final filo = Filo.fisso(
        indirizzo: ponte.indirizzo,
        segno: segnoBuono,
        chi: chiBuono,
        chiave: chiaveBuona,
        attesaMassima: const Duration(milliseconds: 80),
        attesaDellaRisposta: const Duration(milliseconds: 150),
      );
      await filo.apri();
      ponte.muto = true;

      await expectLater(
        filo.chiedi({'type': 'get_states'}),
        throwsA(isA<FiloCaduto>()),
      );
      await filo.chiudi();
    },
  );

  test('le richieste in volo muoiono quando il filo cade', () async {
    final filo = filoCon();
    await filo.apri();
    ponte.muto = true;

    final inVolo = filo.chiedi({'type': 'get_states'});
    await Future<void>.delayed(const Duration(milliseconds: 30));
    await ponte.buttaGiu();

    await expectLater(inVolo, throwsA(isA<FiloCaduto>()));
    await filo.chiudi();
  });

  test('gli eventi di una sottoscrizione arrivano', () async {
    final filo = filoCon();
    await filo.apri();

    final eventi = await filo.sottoscrivi({'type': 'subscribe_events'});
    final visti = <Map<String, dynamic>>[];
    eventi.listen(visti.add);

    final id = ponte.arrivati.last['id'] as int;
    ponte.evento(id, {'event_type': 'state_changed'});

    await Future<void>.delayed(const Duration(milliseconds: 60));
    expect(visti.single['event_type'], 'state_changed');
    await filo.chiudi();
  });

  test('il filo si rialza da solo dopo una caduta', () async {
    final filo = filoCon();
    await filo.apri();
    expect(ponte.collegamenti, 1);

    await ponte.buttaGiu();
    /* Non basta aspettare che `dentro` torni vero: nell'istante subito dopo la
     * caduta e' ancora vero, perche' il filo non se n'e' accorto. Quello che
     * si aspetta e' che il ponte veda **un collegamento nuovo**. */
    await _finoA(
      () => ponte.collegamenti > 1 && filo.dentro,
      entro: const Duration(seconds: 4),
    );

    expect(ponte.collegamenti, greaterThan(1));
    expect(filo.dentro, isTrue);
    await filo.chiudi();
  });

  test('dopo la caduta la sottoscrizione risale da sola, e gli eventi ricominciano', () async {
    final filo = filoCon();
    await filo.apri();

    final eventi = await filo.sottoscrivi({'type': 'subscribe_events'});
    final visti = <Map<String, dynamic>>[];
    eventi.listen(visti.add);

    ponte.arrivati.clear();
    await ponte.buttaGiu();
    await _finoA(() => filo.dentro, entro: const Duration(seconds: 4));
    /* Dopo la riconnessione la sottoscrizione va rifatta: se il filo non la
     * rifacesse, qui non ci sarebbe nessun `subscribe_events`. */
    await _finoA(
      () => ponte.arrivati.any((uno) => uno['type'] == 'subscribe_events'),
      entro: const Duration(seconds: 4),
    );

    final nuovoId =
        ponte.arrivati.lastWhere(
              (uno) => uno['type'] == 'subscribe_events',
            )['id']
            as int;
    ponte.evento(nuovoId, {'event_type': 'state_changed'});

    await _finoA(() => visti.isNotEmpty, entro: const Duration(seconds: 4));
    expect(visti.single['event_type'], 'state_changed');
    await filo.chiudi();
  });

  test('chiudere apposta non fa ripartire niente', () async {
    final filo = filoCon();
    await filo.apri();
    await filo.chiudi();

    final quanti = ponte.collegamenti;
    await Future<void>.delayed(const Duration(milliseconds: 400));
    expect(ponte.collegamenti, quanti);
    expect(filo.dentro, isFalse);
  });

  test('l\'approdo si ricalcola a ogni tentativo: uscendo di casa si passa da fuori', () async {
    /* La prova di tutto il funzionamento fuori casa.
       *
       * Il primo indirizzo e' quello di rete locale e funziona; poi smette,
       * come quando si esce dal portone. Al tentativo dopo la sonda risponde
       * con l'indirizzo di fuori, e il filo ci va senza che nessuno gli abbia
       * detto niente. */
    final altroPonte = await PonteFinto.alza();
    var inCasa = true;
    final filo = Filo(
      approdo: () async => Approdo.diretto(
        inCasa ? DaDove.daDentro : DaDove.daFuori,
        inCasa ? ponte.indirizzo : altroPonte.indirizzo,
      ),
      segno: segnoBuono,
      chi: chiBuono,
      chiave: chiaveBuona,
      attesaMassima: const Duration(milliseconds: 80),
    );

    await filo.apri();
    expect(filo.approdoAdesso!.filo, ponte.indirizzo.filo);

    inCasa = false;
    await ponte.buttaGiu();

    await _finoA(
      () =>
          filo.dentro && filo.approdoAdesso?.filo == altroPonte.indirizzo.filo,
      entro: const Duration(seconds: 5),
    );
    expect(altroPonte.collegamenti, 1);
    await filo.chiudi();
    await altroPonte.spegni();
  });

  test('se non risponde nessun indirizzo, si continua a riprovare', () async {
    var chiesto = 0;
    final filo = Filo(
      approdo: () async {
        chiesto += 1;
        throw const PonteIrraggiungibile('nessuno risponde');
      },
      segno: segnoBuono,
      chi: chiBuono,
      chiave: chiaveBuona,
      attesaMassima: const Duration(milliseconds: 60),
    );

    await expectLater(
      filo.apri(entro: const Duration(milliseconds: 200)),
      throwsA(isA<PonteIrraggiungibile>()),
    );
    final finQui = chiesto;
    await Future<void>.delayed(const Duration(milliseconds: 300));
    expect(
      chiesto,
      greaterThan(finQui),
      reason: 'i tentativi vanno avanti da soli',
    );
    await filo.chiudi();
  });

  test('chiudere mentre si sta cercando la casa non riapre niente', () async {
    final filo = Filo(
      approdo: () async {
        await Future<void>.delayed(const Duration(milliseconds: 80));
        return Approdo.diretto(DaDove.daDentro, ponte.indirizzo);
      },
      segno: segnoBuono,
      chi: chiBuono,
      chiave: chiaveBuona,
      attesaMassima: const Duration(milliseconds: 60),
    );
    unawaited(filo.apri().catchError((Object _) {}));
    await Future<void>.delayed(const Duration(milliseconds: 20));
    await filo.chiudi();

    await Future<void>.delayed(const Duration(milliseconds: 300));
    expect(
      ponte.collegamenti,
      0,
      reason: 'non si e\' collegato dopo la chiusura',
    );
    expect(filo.dentro, isFalse);
  });

  test(
    'smettere di ascoltare una sottoscrizione lo dice a Home Assistant',
    () async {
      final filo = filoCon();
      await filo.apri();

      final eventi = await filo.sottoscrivi({'type': 'subscribe_events'});
      final ascolto = eventi.listen((_) {});
      await ascolto.cancel();

      await _finoA(
        () => ponte.arrivati.any((uno) => uno['type'] == 'unsubscribe_events'),
        entro: const Duration(seconds: 3),
      );
      await filo.chiudi();
    },
  );

  test('un messaggio mandato per conto di altri torna a chi l\'ha mandato, '
      'col numero del filo', () async {
    final filo = filoCon();
    await filo.apri();

    final tornati = <Map<String, dynamic>>[];
    final numero = filo.instrada({'type': 'get_states'}, tornati.add);

    await _finoA(() => tornati.isNotEmpty, entro: const Duration(seconds: 3));
    expect(tornati.single['id'], numero);
    expect(tornati.single['type'], 'result');
    expect(
      ponte.arrivati.where((uno) => uno['type'] == 'get_states').single['id'],
      numero,
    );

    /* Gli eventi con quel numero seguono la stessa strada, finche' non si
     * dimentica. */
    ponte.cambia(numero, 'light.sala', {'state': 'on'});
    await _finoA(() => tornati.length == 2, entro: const Duration(seconds: 3));
    expect(tornati.last['type'], 'event');

    filo.dimentica(numero);
    ponte.cambia(numero, 'light.sala', {'state': 'off'});
    await Future<void>.delayed(const Duration(milliseconds: 100));
    expect(tornati.length, 2, reason: 'dimenticato: non deve piu\' arrivare');

    /* E i numeri restano un contatore solo: quello dopo e' piu' grande. */
    final risposta = await filo.chiedi({'type': 'get_states'});
    expect(risposta['id'], greaterThan(numero));
    await filo.chiudi();
  });

  test(
    'dopo una caduta chi mandava per conto suo non riceve piu\' niente',
    () async {
      final filo = filoCon();
      await filo.apri();
      final tornati = <Map<String, dynamic>>[];
      final numero = filo.instrada({'type': 'subscribe_events'}, tornati.add);
      await _finoA(() => tornati.isNotEmpty, entro: const Duration(seconds: 3));

      await ponte.buttaGiu();
      await _finoA(() => filo.dentro, entro: const Duration(seconds: 5));
      ponte.cambia(numero, 'light.sala', {'state': 'on'});
      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(tornati.length, 1);
      expect(() => filo.dimentica(numero), returnsNormally);
      await filo.chiudi();
    },
  );

  test('senza filo non si instrada niente', () async {
    final filo = filoCon();
    expect(
      () => filo.instrada({'type': 'get_states'}, (_) {}),
      throwsA(isA<FiloCaduto>()),
    );
    await filo.chiudi();
  });
}

/// Aspetta che una cosa diventi vera, invece di aspettare un tempo a caso.
Future<void> _finoA(
  bool Function() condizione, {
  required Duration entro,
}) async {
  final fine = DateTime.now().add(entro);
  while (DateTime.now().isBefore(fine)) {
    if (condizione()) return;
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
  throw StateError('l\'attesa e\' scaduta');
}

/// Le prove dell'approdo mobile: quello che succede uscendo di casa.
void proveDellApprodo() {}
