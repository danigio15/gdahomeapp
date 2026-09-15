/// Le prove del filo, contro un ponte vero abbastanza.
///
/// La prova che conta piu' di tutte e' quella delle sottoscrizioni dopo una
/// caduta: e' il modo in cui un'app di casa si rompe in silenzio — smette di
/// aggiornarsi e nessuno se ne accorge finche' non si guarda una luce accesa
/// che nell'app risulta spenta.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/misure/lavori.dart';
import 'package:gdahome/ponte/errori.dart';
import 'package:gdahome/ponte/filo.dart';
import 'package:gdahome/ponte/indirizzo.dart';
import 'package:gdahome/ponte/presa.dart';

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

  test('un telefono staccato mentre è collegato viene buttato fuori', () async {
    final filo = filoCon();
    await filo.apri();

    ponte.accettaIlSegno = false;
    await ponte.buttaGiu();

    await Future<void>.delayed(const Duration(milliseconds: 500));
    expect(filo.dentro, isFalse);
    await filo.chiudi();
  });

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
      reason: 'non si è collegato dopo la chiusura',
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

    final tornati = <Instradato>[];
    final numero = filo.instrada({'type': 'get_states'}, tornati.add);

    await _finoA(() => tornati.isNotEmpty, entro: const Duration(seconds: 3));
    expect(tornati.single.id, numero);
    expect(tornati.single.tipo, 'result');
    expect(tornati.single.successo, isTrue);
    expect(tornati.single.detto['id'], numero);
    /* I byte si riconsegnano col numero di chi aveva chiesto, cambiando solo
     * quello: il resto e' lo stesso, byte per byte. */
    final riscritto = jsonDecode(utf8.decode(tornati.single.conNumero(99)));
    expect(riscritto, {...tornati.single.detto, 'id': 99});
    /* E per lo **stesso** numero non si riscrive niente: si riconsegnano quei
     * byte. Su un `get_states` da un megabyte e mezzo una copia risparmiata
     * non e' tempo — un megabyte si copia in pochi millesimi — e' roba da
     * buttare in meno, e i decimi di secondo di quella si pagano dopo, sul
     * filo che disegna, quando il raccoglitore passa. */
    expect(
      tornati.single.conNumero(numero),
      same(tornati.single.byte),
      reason: 'col suo numero non si alloca niente di nuovo',
    );
    expect(
      ponte.arrivati.where((uno) => uno['type'] == 'get_states').single['id'],
      numero,
    );

    /* Gli eventi con quel numero seguono la stessa strada, finche' non si
     * dimentica. */
    ponte.cambia(numero, 'light.sala', {'state': 'on'});
    await _finoA(() => tornati.length == 2, entro: const Duration(seconds: 3));
    expect(tornati.last.tipo, 'event');
    expect(tornati.last.successo, isNull);

    filo.dimentica(numero);
    ponte.cambia(numero, 'light.sala', {'state': 'off'});
    await Future<void>.delayed(const Duration(milliseconds: 100));
    expect(tornati.length, 2, reason: 'dimenticato: non deve più arrivare');

    /* E i numeri restano un contatore solo: quello dopo e' piu' grande. */
    final risposta = await filo.chiedi({'type': 'get_states'});
    expect(risposta['id'], greaterThan(numero));
    await filo.chiudi();
  });

  test(
    'dopo una caduta chi mandava per conto suo non riceve più niente',
    () async {
      final filo = filoCon();
      await filo.apri();
      final tornati = <Instradato>[];
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

  test('un mucchio di eventi si spacchetta, e le buste si contano', () async {
    /* Da fuori casa il ponte manda gli eventi insieme, in una busta sola:
     * passando dal centralino ogni messaggio e' una richiesta contata, e una
     * casa vera ne manda cinque al secondo — quarantamila all'ora, contro le
     * centomila al giorno che il piano gratuito regala. Qui si prova che chi
     * li riceve non se ne accorge: ogni pezzo rifa' la strada che avrebbe
     * fatto da solo. */
    final filo = filoCon();
    await filo.apri();
    final tornati = <Instradato>[];
    final numero = filo.instrada({'type': 'subscribe_events'}, tornati.add);
    await _finoA(() => tornati.isNotEmpty, entro: const Duration(seconds: 3));
    final prima = tornati.length;

    ponte.mucchio(numero, [
      {
        'event_type': 'state_changed',
        'data': {
          'entity_id': 'light.cucina',
          'new_state': {'state': 'on'},
        },
      },
      {
        'event_type': 'state_changed',
        'data': {
          'entity_id': 'light.salotto',
          'new_state': {'state': 'off'},
        },
      },
      {
        'event_type': 'state_changed',
        'data': {
          'entity_id': 'sensor.frigo',
          'new_state': {'state': '4'},
        },
      },
    ]);

    await _finoA(
      () => tornati.length - prima == 3,
      entro: const Duration(seconds: 3),
    );
    /* Nell'ordine in cui la casa ha parlato, e interi. */
    final entita = tornati
        .skip(prima)
        .map(
          (uno) =>
              (((uno.detto['event'] as Map)['data'] as Map)['entity_id']
                  as String),
        )
        .toList();
    expect(entita, ['light.cucina', 'light.salotto', 'sensor.frigo']);

    /* E in diagnostica le due cose si vedono separate: i messaggi, e le
     * buste — che sono quello che il centralino fa pagare. */
    expect(filo.traffico, contains(' buste'));
    await filo.chiudi();
  });

  test(
    'quello che si instrada arriva in byte, interi e rinumerabili',
    () async {
      /* La strada di un messaggio della plancia non passa mai per una stringa:
     * dalla busta decifrata escono byte, la testa si legge dai byte, il
     * numero si cambia nei byte, e i byte si scrivono nel WebSocket verso la
     * pagina. Qui si prova che in tutto quel giro non si perde niente —
     * comprese le lettere accentate, che in UTF-8 sono due byte e sono il
     * modo piu' facile di accorgersi che qualcuno ha contato caratteri dove
     * c'erano byte. */
      final filo = filoCon();
      await filo.apri();
      final tornati = <Instradato>[];
      final numero = filo.instrada({'type': 'subscribe_events'}, tornati.add);
      await _finoA(() => tornati.isNotEmpty, entro: const Duration(seconds: 3));
      final prima = tornati.length;

      ponte.cambia(numero, 'sensor.temperatura_camera_da_letto', {
        'state': '21.5',
        'attributes': {'friendly_name': 'Temperatura in camera — più giù'},
      });
      await _finoA(
        () => tornati.length > prima,
        entro: const Duration(seconds: 3),
      );

      final venuto = tornati.last;
      expect(venuto.tipo, 'event');
      expect(venuto.id, numero);

      /* Byte per byte quello che la casa ha detto. */
      expect(
        utf8.decode(venuto.byte),
        jsonEncode({
          'id': numero,
          'type': 'event',
          'event': {
            'event_type': 'state_changed',
            'data': {
              'entity_id': 'sensor.temperatura_camera_da_letto',
              'new_state': {
                'state': '21.5',
                'attributes': {
                  'friendly_name': 'Temperatura in camera — più giù',
                },
              },
            },
          },
        }),
      );

      /* Rinumerato: cambia il numero in testa e **solo** quello. Gli accenti
     * sono dopo, e devono uscire di qui come sono entrati. */
      final rinumerato =
          jsonDecode(utf8.decode(venuto.conNumero(7))) as Map<String, dynamic>;
      expect(rinumerato['id'], 7);
      expect(rinumerato, {...venuto.detto, 'id': 7});
      expect(
        (((((rinumerato['event'] as Map)['data'] as Map)['new_state']
                    as Map)['attributes']
                as Map)['friendly_name']
            as String),
        'Temperatura in camera — più giù',
      );

      await filo.chiudi();
    },
  );

  test(
    'un mucchio si spezza senza copiare, e i pezzi restano interi',
    () async {
      /* I pezzi di un mucchio sono viste sugli stessi byte arrivati, una per
     * messaggio: spezzarlo non alloca niente. Una vista sbagliata di un byte
     * non si vedrebbe nel JSON aperto — lo si vedrebbe qui, guardando i byte
     * che poi finiscono nel WebSocket della pagina. */
      final filo = filoCon();
      await filo.apri();
      final tornati = <Instradato>[];
      final numero = filo.instrada({'type': 'subscribe_events'}, tornati.add);
      await _finoA(() => tornati.isNotEmpty, entro: const Duration(seconds: 3));
      final prima = tornati.length;

      final dette = [
        {
          'event_type': 'state_changed',
          'data': {
            'entity_id': 'light.cucina',
            'new_state': {
              'state': 'on',
              'attributes': {'amici': 'à è ì ò ù'},
            },
          },
        },
        {
          'event_type': 'state_changed',
          'data': {
            'entity_id': 'light.salotto',
            'new_state': {'state': 'off'},
          },
        },
      ];
      ponte.mucchio(numero, dette);

      await _finoA(
        () => tornati.length - prima == dette.length,
        entro: const Duration(seconds: 3),
      );
      expect(
        tornati.skip(prima).map((uno) => utf8.decode(uno.byte)).toList(),
        dette
            .map(
              (cosa) =>
                  jsonEncode({'id': numero, 'type': 'event', 'event': cosa}),
            )
            .toList(),
      );

      await filo.chiudi();
    },
  );

  test('una risposta grossa si legge altrove, e arriva intera', () async {
    /* Sopra la soglia il JSON non si legge su questo filo: i byte partono per
     * l'aiutante — **trasferiti**, non copiati — e tornano mappe. E' la strada
     * che sul telefono fa un `get_states` di una casa vera, e nel browser non
     * esiste: la si prova qui, dove l'aiutante c'e' davvero. */
    ponte.entita = [
      for (var quale = 0; quale < 400; quale += 1)
        PonteFinto.unaEntita(
          'sensor.roba_$quale',
          '$quale',
          nome: 'Roba numero $quale, con un nome lungo e un accento: più giù',
          unita: '°C',
        ),
    ];
    final filo = filoCon();
    await filo.apri();

    final risposta = await filo.chiedi({'type': 'get_states'});
    final venute = risposta['result'] as List;
    expect(venute, hasLength(400));
    expect(
      (venute.last as Map)['attributes'],
      containsPair(
        'friendly_name',
        'Roba numero 399, con un nome lungo e un accento: più giù',
      ),
    );
    /* E che sia passata davvero dall'aiutante — e non letta qui, che sarebbe
     * la prova buona per il motivo sbagliato — lo dice la diagnostica: e' il
     * lavoro contato con quel nome. */
    expect(
      Lavori.io.tutti.map((uno) => uno.cosa),
      contains('messaggi letti altrove'),
    );

    await filo.chiudi();
  });

  test('al risveglio un filo morto in silenzio si chiude e ribussa', () async {
    final filo = Filo.fisso(
      indirizzo: ponte.indirizzo,
      segno: segnoBuono,
      chi: chiBuono,
      chiave: chiaveBuona,
      attesaMassima: const Duration(milliseconds: 80),
      attesaDellaRisposta: const Duration(seconds: 3),
      pazienzaAlRisveglio: const Duration(milliseconds: 300),
    );
    await filo.apri();
    final visti = <StatoDelFilo>[];
    filo.stato.listen(visti.add);

    /* Il ponte c'e' ma non risponde piu': e' il socket che il telefono si
     * ritrova in mano dopo un po' in tasca. */
    ponte.muto = true;
    filo.sveglia();
    await _finoA(
      () => visti.contains(StatoDelFilo.chiamando),
      entro: const Duration(seconds: 3),
    );
    expect(filo.traffico, contains('mentre l\'app dormiva'));

    ponte.muto = false;
    await _finoA(() => filo.dentro, entro: const Duration(seconds: 5));
    expect(filo.traffico, contains('caduto 1 volta'));
    await filo.chiudi();
  });

  test('il traffico dice se il gzip c\'è: con un ponte nuovo sì, con uno vecchio no', () async {
    final filo = Filo.fisso(
      indirizzo: ponte.indirizzo,
      segno: segnoBuono,
      chi: chiBuono,
      chiave: chiaveBuona,
    );
    await filo.apri();
    expect(filo.traffico, contains('sul filo, gzip)'));
    await filo.chiudi();

    /* Un ponte di prima: nella stretta di mano non dice niente del gzip,
     * e l'app non comprime verso di lui. Si parlano lo stesso. */
    ponte.conosceIlGzip = false;
    final vecchio = Filo.fisso(
      indirizzo: ponte.indirizzo,
      segno: segnoBuono,
      chi: chiBuono,
      chiave: chiaveBuona,
    );
    await vecchio.apri();
    expect(vecchio.dentro, isTrue);
    expect(vecchio.traffico, contains('senza gzip)'));
    await vecchio.chiudi();
    ponte.conosceIlGzip = true;
  });

  test('quando chi chiude dice perché, la caduta lo ripete', () async {
    /* «Il filo si e' chiuso» non dice niente a nessuno. «Questa casa adesso
     * non e' collegata» — che e' quello che dice il centralino quando
     * l'add-on non e' attaccato — dice tutto, ed e' l'unica frase che viene
     * da chi lo sa davvero. */
    final filo = Filo.fisso(
      indirizzo: ponte.indirizzo,
      segno: segnoBuono,
      chi: chiBuono,
      chiave: chiaveBuona,
      attesaMassima: const Duration(seconds: 30),
    );
    await filo.apri();
    expect(filo.dentro, isTrue);

    for (final presa in [...ponte.prese]) {
      await presa.chiudi(perche: 'casa non collegata');
    }
    await _finoA(
      () => filo.traffico?.contains('casa non collegata') ?? false,
      entro: const Duration(seconds: 3),
    );
    expect(filo.traffico, contains('casa non collegata'));
    await filo.chiudi();
  });

  test(
    'una presa che non si apre non tiene il filo appeso: si riprova',
    () async {
      /* Il modo peggiore di rompersi: un telefono che si sveglia con la radio
     * ancora fredda apriva una presa che non si apriva e non falliva, e
     * l'app restava a «sto cercando la casa» per sempre — sembrava tutto in
     * corso, e non stava succedendo niente. */
      var quante = 0;
      final filo = Filo.fisso(
        indirizzo: ponte.indirizzo,
        segno: segnoBuono,
        chi: chiBuono,
        chiave: chiaveBuona,
        apri: (dove) {
          quante += 1;
          /* La prima resta li' e non torna mai. */
          if (quante == 1) return Completer<Presa>().future;
          return PresaSuWebSocket.apri(dove);
        },
        attesaDellApertura: const Duration(milliseconds: 300),
        attesaMassima: const Duration(milliseconds: 100),
      );

      await filo.apri(entro: const Duration(seconds: 5));
      expect(filo.dentro, isTrue);
      expect(quante, 2, reason: 'la prima si è lasciata perdere');
      await filo.chiudi();
    },
  );

  test(
    'al risveglio una bussata appesa si lascia perdere e se ne fa un\'altra',
    () async {
      /* Con una scadenza lunga solo il risveglio puo' salvarla: e' il caso di
     * chi riprende in mano il telefono e non vuole aspettare. */
      var quante = 0;
      final filo = Filo.fisso(
        indirizzo: ponte.indirizzo,
        segno: segnoBuono,
        chi: chiBuono,
        chiave: chiaveBuona,
        apri: (dove) {
          quante += 1;
          if (quante == 1) return Completer<Presa>().future;
          return PresaSuWebSocket.apri(dove);
        },
        attesaDellApertura: const Duration(seconds: 30),
        pazienzaAlRisveglio: const Duration(milliseconds: 50),
      );

      unawaited(
        filo.apri(entro: const Duration(seconds: 5)).catchError((_) {}),
      );
      await _finoA(() => quante == 1, entro: const Duration(seconds: 2));
      /* Oltre la pazienza: adesso quella bussata e' «appesa da un po'». */
      await Future<void>.delayed(const Duration(milliseconds: 120));

      filo.sveglia();
      await _finoA(() => filo.dentro, entro: const Duration(seconds: 5));
      expect(quante, 2);
      await filo.chiudi();
    },
  );

  test('al risveglio un filo vivo resta dentro', () async {
    final filo = Filo.fisso(
      indirizzo: ponte.indirizzo,
      segno: segnoBuono,
      chi: chiBuono,
      chiave: chiaveBuona,
      attesaMassima: const Duration(milliseconds: 80),
      attesaDellaRisposta: const Duration(seconds: 3),
      pazienzaAlRisveglio: const Duration(milliseconds: 300),
    );
    await filo.apri();
    final visti = <StatoDelFilo>[];
    filo.stato.listen(visti.add);
    filo.sveglia();
    await Future<void>.delayed(const Duration(milliseconds: 700));
    expect(visti, isEmpty);
    expect(filo.dentro, isTrue);
    expect(filo.traffico, contains('mai caduto'));
    await filo.chiudi();
  });

  test('un filo chiuso apposta non è una caduta', () async {
    /* Quando l'app non e' davanti il filo si chiude da se': e' voluto, ed e'
     * quello che non tiene una casa aperta in tasca per niente. Solo che
     * chiudere una presa fa scattare il suo `onDone`, e quello finiva contato
     * fra le cadute: nella diagnostica si leggeva «caduto 1 volta: il filo si
     * e' chiuso» sotto «app messa da parte 1 volta» — la stessa cosa scritta
     * due volte, una delle quali come guasto. Chi guarda quel pannello per
     * capire se qualcosa non va si mette a inseguire un fantasma. */
    final filo = Filo.fisso(
      indirizzo: ponte.indirizzo,
      segno: segnoBuono,
      chi: chiBuono,
      chiave: chiaveBuona,
    );
    await filo.apri();
    expect(filo.dentro, isTrue);

    await filo.chiudi();
    expect(filo.ultimeCadute, isEmpty);
    expect(filo.traffico, contains('mai caduto'));
  });

  test('senza filo non si instrada niente', () async {
    final filo = filoCon();
    expect(
      () => filo.instrada({'type': 'get_states'}, (_) {}),
      throwsA(isA<FiloCaduto>()),
    );
    await filo.chiudi();
  });

  group('quando il telefono non ha ancora rete', () {
    /* «Dopo 30 minuti di inattivo»: il telefono va in Doze, e quando si
     * riprende in mano la radio non e' ancora su. Il sistema risponde
     * «Failed host lookup: No address associated with hostname», che non vuol
     * dire che la casa non c'e' — vuol dire che il telefono non ha rete, e
     * fra un secondo ce l'ha. */

    test('la riconosce dalle parole che usa il sistema', () {
      expect(
        Filo.laReteNonCEAncora(
          const SocketException(
            "Failed host lookup: 'gdahome-centralino.esempio.workers.dev'",
            osError: OSError('No address associated with hostname', 7),
          ),
        ),
        isTrue,
      );
      expect(
        Filo.laReteNonCEAncora(Exception('Network is unreachable')),
        isTrue,
      );
      /* Una casa che rifiuta invece e' una caduta vera: non va confusa. */
      expect(Filo.laReteNonCEAncora(Exception('Connection refused')), isFalse);
      expect(
        Filo.laReteNonCEAncora(const PonteIrraggiungibile('boh')),
        isFalse,
      );
    });

    test('non è una caduta, e si riprova in fretta', () async {
      var quante = 0;
      final filo = Filo.fisso(
        indirizzo: ponte.indirizzo,
        segno: segnoBuono,
        chi: chiBuono,
        chiave: chiaveBuona,
        apri: (dove) {
          quante += 1;
          /* Le prime tre: la radio non e' ancora su. */
          if (quante <= 3) {
            throw const SocketException(
              'Failed host lookup: \'ponte.esempio\'',
              osError: OSError('No address associated with hostname', 7),
            );
          }
          return PresaSuWebSocket.apri(dove);
        },
        attesaAFreddo: const Duration(milliseconds: 10),
        /* Se le contasse come cadute aspetterebbe questo, e la prova
         * scadrebbe: e' il modo di dimostrare che non le conta. */
        attesaMassima: const Duration(seconds: 20),
      );

      await filo.apri(entro: const Duration(seconds: 5));
      expect(filo.dentro, isTrue);
      expect(quante, 4);
      /* E soprattutto: in «Come va l'app» non resta scritto niente. */
      expect(filo.ultimeCadute, isEmpty);
      await filo.chiudi();
    });

    test('se la rete non torna proprio, alla fine è una caduta', () async {
      final filo = Filo.fisso(
        indirizzo: ponte.indirizzo,
        segno: segnoBuono,
        chi: chiBuono,
        chiave: chiaveBuona,
        apri: (_) => throw const SocketException(
          'Failed host lookup: \'ponte.esempio\'',
          osError: OSError('No address associated with hostname', 7),
        ),
        attesaAFreddo: const Duration(milliseconds: 5),
        quantiTentativiAFreddo: 3,
        attesaMassima: const Duration(milliseconds: 20),
      );

      unawaited(
        filo.apri(entro: const Duration(seconds: 3)).catchError((_) {}),
      );
      /* Tre tentativi veloci non contano; dal quarto in poi si', e il motivo
       * scritto e' quello vero del sistema, non «non riesco ad aprire». */
      await Future<void>.delayed(const Duration(milliseconds: 300));
      expect(filo.ultimeCadute, isNotEmpty);
      expect(filo.ultimeCadute.first, contains('Failed host lookup'));
      await filo.chiudi();
    });
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
  throw StateError('l\'attesa è scaduta');
}

/// Le prove dell'approdo mobile: quello che succede uscendo di casa.
void proveDellApprodo() {}
