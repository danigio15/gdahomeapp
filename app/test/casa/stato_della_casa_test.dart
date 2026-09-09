/// Le prove dello stato della casa.
///
/// La prova che vale piu' delle altre e' l'ultima: dopo una caduta del filo,
/// lo stato **si rilegge tutto**. Senza, un'entita' cambiata mentre il
/// telefono era in ascensore resta a schermo col valore vecchio per sempre, e
/// non c'e' niente che lo faccia notare — l'app sembra funzionare.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/entita.dart';
import 'package:gdahome/casa/stato_della_casa.dart';
import 'package:gdahome/ponte/filo.dart';

import '../ponte/ponte_finto.dart';

void main() {
  late PonteFinto ponte;
  late Filo filo;
  late StatoDellaCasa casa;

  setUp(() async {
    ponte = await PonteFinto.alza();
    ponte.entita = [
      PonteFinto.unaEntita('light.cucina', 'off', nome: 'Luce cucina'),
      PonteFinto.unaEntita('light.salotto', 'on', nome: 'Luce salotto'),
      PonteFinto.unaEntita(
        'sensor.fuori',
        '18.4',
        nome: 'Temperatura fuori',
        unita: '°C',
      ),
    ];
    filo = Filo.fisso(
      indirizzo: ponte.indirizzo,
      segno: segnoBuono,
      chi: chiBuono,
      chiave: chiaveBuona,
      attesaMassima: const Duration(milliseconds: 80),
      attesaDellaRisposta: const Duration(seconds: 3),
    );
    await filo.apri();
    /* Senza respiro fra gli avvisi: qui si contano uno a uno. */
    casa = StatoDellaCasa(filo, respiro: Duration.zero);
  });

  tearDown(() async {
    await casa.stacca();
    await filo.chiudi();
    await ponte.spegni();
  });

  test('attaccandosi, legge tutta la casa', () async {
    await casa.attacca();

    expect(casa.pieno, isTrue);
    expect(casa.quante, 3);
    expect(casa['light.cucina']!.nome, 'Luce cucina');
    expect(casa['light.cucina']!.accesa, isFalse);
    expect(casa['light.salotto']!.accesa, isTrue);
    expect(casa['sensor.fuori']!.unita, '°C');
  });

  test(
    'le entita\' tornano in ordine di nome, non di identificativo',
    () async {
      await casa.attacca();
      expect(casa.tutte().map((una) => una.id), [
        'light.cucina',
        'light.salotto',
        'sensor.fuori',
      ]);
    },
  );

  test('si contano per dominio, e si chiedono per dominio', () async {
    await casa.attacca();
    expect(casa.domini(), {'light': 2, 'sensor': 1});
    expect(casa.delDominio('light').length, 2);
    expect(casa.delDominio('vacuum'), isEmpty);
  });

  test('un cambiamento arriva e si vede', () async {
    await casa.attacca();
    var avvisi = 0;
    casa.cambiamenti.listen((_) => avvisi += 1);

    final id =
        ponte.arrivati.lastWhere(
              (uno) => uno['type'] == 'subscribe_events',
            )['id']
            as int;
    ponte.cambia(
      id,
      'light.cucina',
      PonteFinto.unaEntita('light.cucina', 'on', nome: 'Luce cucina'),
    );

    await _finoA(() => casa['light.cucina']!.accesa);
    expect(casa['light.cucina']!.accesa, isTrue);
    expect(avvisi, greaterThan(0));
  });

  test('un\'entita\' tolta da Home Assistant sparisce anche di qui', () async {
    await casa.attacca();
    final id =
        ponte.arrivati.lastWhere(
              (uno) => uno['type'] == 'subscribe_events',
            )['id']
            as int;

    ponte.cambia(id, 'light.cucina', null);

    await _finoA(() => casa['light.cucina'] == null);
    expect(casa.quante, 2);
  });

  test('comandare manda un call_service fatto bene', () async {
    await casa.attacca();
    ponte.arrivati.clear();

    await casa.comanda('turn_on', 'light.cucina', con: {'brightness_pct': 40});

    final mandato = ponte.arrivati.single;
    expect(mandato['type'], 'call_service');
    expect(mandato['domain'], 'light');
    expect(mandato['service'], 'turn_on');
    expect(mandato['target'], {'entity_id': 'light.cucina'});
    expect(mandato['service_data'], {'brightness_pct': 40});
  });

  test('dopo una caduta del filo la casa si rilegge tutta', () async {
    await casa.attacca();
    expect(casa['light.cucina']!.stato, 'off');

    /* Mentre il telefono e' giu', in casa succede qualcosa. Nessun evento puo'
     * arrivare: il filo non c'e'. */
    ponte.entita = [
      PonteFinto.unaEntita('light.cucina', 'on', nome: 'Luce cucina'),
      PonteFinto.unaEntita('light.salotto', 'on', nome: 'Luce salotto'),
      PonteFinto.unaEntita(
        'sensor.fuori',
        '21.9',
        nome: 'Temperatura fuori',
        unita: '°C',
      ),
    ];
    await ponte.buttaGiu();

    await _finoA(
      () =>
          casa['light.cucina']?.stato == 'on' &&
          casa['sensor.fuori']?.stato == '21.9',
      entro: const Duration(seconds: 5),
    );
    expect(casa['light.cucina']!.stato, 'on');
    expect(casa['sensor.fuori']!.stato, '21.9');
  });

  test('un\'entita\' storta non fa cadere niente', () {
    expect(Entita.leggi(null), isNull);
    expect(Entita.leggi('una stringa'), isNull);
    expect(Entita.leggi({'entity_id': 'light.x'}), isNull);
    expect(Entita.leggi({'state': 'on'}), isNull);
    final senzaAttributi = Entita.leggi({
      'entity_id': 'light.x',
      'state': 'on',
    })!;
    expect(
      senzaAttributi.nome,
      'light.x',
      reason: 'senza nome vale l\'identificativo',
    );
    expect(senzaAttributi.attributi, isEmpty);
  });

  test('unavailable e unknown sono la stessa cosa per chi guarda', () {
    for (final stato in ['unavailable', 'unknown']) {
      final una = Entita.leggi({'entity_id': 'sensor.x', 'state': stato})!;
      expect(una.muta, isTrue, reason: stato);
    }
    expect(
      Entita.leggi({'entity_id': 'sensor.x', 'state': '18.4'})!.muta,
      isFalse,
    );
  });

  test('col respiro, una raffica di cambiamenti e\' un avviso solo', () async {
    /* Una casa vera cambia decine di volte al secondo. Chi disegna deve
     * vedere l'ultimo stato, non ridisegnare a ogni sensore. */
    final calma = StatoDellaCasa(
      filo,
      respiro: const Duration(milliseconds: 120),
    );
    await calma.attacca();
    var avvisi = 0;
    calma.cambiamenti.listen((_) => avvisi += 1);
    final id =
        ponte.arrivati.lastWhere(
              (uno) => uno['type'] == 'subscribe_events',
            )['id']
            as int;

    for (var giro = 0; giro < 30; giro += 1) {
      ponte.cambia(
        id,
        'sensor.fuori',
        PonteFinto.unaEntita(
          'sensor.fuori',
          '${20 + giro}',
          nome: 'Temperatura fuori',
          unita: '°C',
        ),
      );
    }
    await _finoA(() => calma['sensor.fuori']!.stato == '49');
    /* Il primo passa subito, gli altri si accodano: l'ultimo avviso arriva
     * alla fine del respiro, e con lui l'ultimo stato. */
    await _finoA(() => avvisi >= 1);
    await Future<void>.delayed(const Duration(milliseconds: 250));
    expect(avvisi, inInclusiveRange(1, 3));
    expect(calma['sensor.fuori']!.stato, '49');
    await calma.stacca();
  });
}

Future<void> _finoA(
  bool Function() condizione, {
  Duration entro = const Duration(seconds: 3),
}) async {
  final fine = DateTime.now().add(entro);
  while (DateTime.now().isBefore(fine)) {
    if (condizione()) return;
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
  throw StateError('l\'attesa e\' scaduta');
}
