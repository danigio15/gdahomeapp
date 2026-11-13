import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/notifiche/dietro_il_velo.dart';

/* I tasti delle notifiche aggiravano il lucchetto: «Disinserisci» toccato
 * dalla tendina partiva verso la casa col velo ancora su. */
void main() {
  test('col velo su il tocco aspetta, e parte quando il velo scende', () {
    final velo = ValueNotifier<bool>(true);
    final partiti = <String>[];
    final fila = DietroIlVelo<String>(velo, partiti.add);

    fila.arriva('disinserisci');
    fila.arriva('apri cancello');
    expect(partiti, isEmpty);
    expect(fila.inFila, 2);

    /* Il velo resta su (un «no» al volto): non parte niente. */
    velo.value = true;
    expect(partiti, isEmpty);

    velo.value = false;
    expect(partiti, ['disinserisci', 'apri cancello']);
    expect(fila.inFila, 0);

    /* A velo giu' passa subito. */
    fila.arriva('ok');
    expect(partiti.last, 'ok');
    fila.chiudi();
  });

  test('chiusa la fila, quello che aspettava non parte piu\'', () {
    final velo = ValueNotifier<bool>(true);
    final partiti = <String>[];
    final fila = DietroIlVelo<String>(velo, partiti.add);
    fila.arriva('disinserisci');
    fila.chiudi();
    velo.value = false;
    expect(partiti, isEmpty);
  });

  test('senza velo si passa sempre', () {
    final partiti = <String>[];
    DietroIlVelo<String>(null, partiti.add).arriva('ok');
    expect(partiti, ['ok']);
  });
}
