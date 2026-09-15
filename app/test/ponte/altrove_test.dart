/// I byte che cambiano isolato: trasferiti, non copiati.
///
/// E' il pezzo di strada che nel browser non esiste — li' l'aiutante non c'e'
/// e il lavoro si fa dove capita — quindi il collaudo, che gira in un
/// browser, non lo guarda mai. Qui l'aiutante c'e' davvero.
library;

import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/ponte/altrove/altrove.dart';

void main() {
  test('i byte tornano dall\'aiutante interi', () async {
    final venuti = await byteDaAltrove(
      () => Uint8List.fromList(utf8.encode('questo è tornato: più giù')),
    );
    expect(utf8.decode(venuti), 'questo è tornato: più giù');
  });

  test('i byte vanno all\'aiutante interi', () async {
    final detto = Uint8List.fromList(utf8.encode('{"a": "andato: più giù"}'));
    final letto = await altroveCoiByte(
      detto,
      (byte) => jsonDecode(utf8.decode(byte)),
    );
    expect(letto, {'a': 'andato: più giù'});
  });

  test('una vista si spedisce senza portarsi via i fratelli', () async {
    /* Spezzare un mucchio non copia: ogni pezzo e' una **vista** sugli stessi
     * byte arrivati. Spedire una vista cosi' com'e' vorrebbe dire portarsi
     * via il blocco che ci sta sotto — e con lui i fratelli che ancora
     * aspettano il loro turno. Quindi una vista si copia prima di partire, e
     * questa prova sta qui perche' quel giorno non si scopra sul telefono di
     * qualcuno. */
    final tutto = Uint8List.fromList(utf8.encode('{"uno": 1}\n{"due": 2}'));
    final primo = Uint8List.sublistView(tutto, 0, 10);
    final secondo = Uint8List.sublistView(tutto, 11);

    expect(
      await altroveCoiByte(primo, (byte) => jsonDecode(utf8.decode(byte))),
      {'uno': 1},
    );
    /* Il fratello e' ancora li', e si legge. */
    expect(
      await altroveCoiByte(secondo, (byte) => jsonDecode(utf8.decode(byte))),
      {'due': 2},
    );
  });

  test('un lavoro andato storto altrove si vede da qui', () async {
    await expectLater(
      byteDaAltrove(() => throw StateError('non se ne parla')),
      throwsA(isA<Exception>()),
    );
  });
}
