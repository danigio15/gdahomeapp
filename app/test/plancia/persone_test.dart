/// Le prove delle persone in Home: a casa, in rientro, fuori con la
/// batteria agli sgoccioli — le tre situazioni della casa demo.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/plancia/persone.dart';

import 'casa_demo.dart';

void main() {
  final demo = CasaDemo.leggi();
  final config = demo.configurazione;
  /* Le entita' della casa demo sono cambiate novanta secondi prima che il
   * file fosse scritto: si legge quell'istante e ci si mette nove minuti
   * dopo, come nell'anteprima. */
  final adesso = demo
      .stato('person.giovanni')!
      .cambiataIl!
      .add(const Duration(minutes: 9, seconds: 30));

  test('chi e\' a casa, chi rientra, chi e\' in una zona', () {
    final persone = personeDellaHome(config, demo.stato, adesso: adesso);
    expect(persone.map((p) => p.nome), ['Giovanni', 'Laura', 'Marco']);

    final giovanni = persone[0];
    expect(giovanni.presenza, Presenza.casa);
    expect(giovanni.etichettaDellaZona, 'Casa');
    expect(giovanni.batteria, 82);
    expect(giovanni.inCarica, isTrue);
    expect(
      giovanni.distanza,
      isNull,
      reason: 'a casa il viaggio non si racconta',
    );
    expect(giovanni.daQuanto?.testo, '9 min fa');
    expect(giovanni.iniziali, 'G');
    expect(giovanni.colore, '#0ea5e9');

    final laura = persone[1];
    expect(laura.presenza, Presenza.fuori);
    expect(laura.etichettaDellaZona, 'Fuori');
    expect(laura.distanza, 8.4);
    expect(laura.unitaDellaDistanza, 'km');
    expect(laura.viaggio, 14);
    expect(laura.batteria, 46);
    expect(laura.inCarica, isFalse);

    final marco = persone[2];
    expect(marco.presenza, Presenza.zona);
    expect(marco.etichettaDellaZona, 'Ufficio');
    expect(marco.batteria, 9);
    expect(marco.batteriaBassa, isTrue);
  });

  test(
    'una persona che Home Assistant non conosce non e\' «fuori»: non si sa',
    () {
      final persone = personeDellaHome(
        config,
        demo.con({'person.marco': null}),
        adesso: adesso,
      );
      final marco = persone[2];
      expect(marco.nota, isFalse);
      expect(marco.daQuanto, isNull);
    },
  );

  test('i metri diventano chilometri appena smettono di leggersi', () {
    final leggi = demo.con({
      'sensor.laura_distanza': entita(
        'sensor.laura_distanza',
        '2350',
        attributi: {'unit_of_measurement': 'm'},
      ),
    });
    final laura = personeDellaHome(config, leggi, adesso: adesso)[1];
    expect(laura.distanza, 2.4);
    expect(laura.unitaDellaDistanza, 'km');
  });

  test('da quanto, a misura di card', () {
    final ora = DateTime(2026, 9, 8, 12);
    expect(
      DaQuanto.da(ora.subtract(const Duration(seconds: 40)), ora)?.testo,
      'adesso',
    );
    expect(
      DaQuanto.da(ora.subtract(const Duration(minutes: 9)), ora)?.testo,
      '9 min fa',
    );
    expect(
      DaQuanto.da(ora.subtract(const Duration(hours: 3)), ora)?.testo,
      '3 h fa',
    );
    expect(
      DaQuanto.da(ora.subtract(const Duration(days: 2)), ora)?.testo,
      '2 g fa',
    );
  });
}
