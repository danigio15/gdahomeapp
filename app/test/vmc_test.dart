/// La VMC: il porto di `vmc-model.js`.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/plancia/vmc.dart';

void main() {
  test('una macchina ha tutte le caselle, nell\'ordine della plancia', () {
    final una = normalizzaVmc({
      'name': 'Comfoair',
      'room': 'soffitta',
      'esterna': ' sensor.e ',
    });
    expect(una.keys.toList(), ['id', 'nome', 'stanza', ...campiDellaVmc]);
    expect(una['id'], 'vmc-1');
    expect(una['nome'], 'Comfoair');
    expect(una['stanza'], 'soffitta');
    expect(una['esterna'], 'sensor.e');
    expect(una['clima'], '');
  });

  test('non piu\' di quattro, e senza doppioni', () {
    final tutte = normalizzaVmcTutte([
      for (var i = 0; i < 6; i += 1) {'id': 'vmc', 'nome': 'V$i'},
    ]);
    expect(tutte, hasLength(massimoVmc));
    expect(tutte.map((una) => una['id']), ['vmc', 'vmc-2', 'vmc-3', 'vmc-4']);
    expect(normalizzaVmcTutte({'nome': 'una sola'}), hasLength(1));
  });

  test('disegnabile solo con una casella piena', () {
    expect(vmcDisegnabile(normalizzaVmc({'nome': 'x'})), isFalse);
    expect(
      vmcDisegnabile(normalizzaVmc({'bypass': 'binary_sensor.b'})),
      isTrue,
    );
  });

  test('le caselle sono quelle di CAMPI_VMC', () {
    expect(campiDellaVmc, [
      'clima',
      for (final (chiave, _, _, _) in temperatureDellaVmc) chiave,
      for (final (chiave, _, _, _) in interruttoriDellaVmc) chiave,
      for (final (chiave, _, _, _) in numeriDellaVmc) chiave,
    ]);
  });
}
