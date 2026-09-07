/// Le prove dell'invito.
///
/// I vettori qui sotto sono **gli stessi** che stanno in
/// `ponte/test/invito.test.js`, ricopiati identici. Non c'e' nessun
/// compilatore che tenga insieme le due meta' di questo formato — una la
/// scrive Node, l'altra la legge Dart — e queste righe sono l'unica cosa che
/// lo faccia. Non si toccano da una parte sola.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/ponte/indirizzo.dart';
import 'package:gdahome/ponte/invito.dart';

void main() {
  group('quello che scrive il ponte, l\'app lo rilegge', () {
    test('tutto quello che c\'e\' da dire', () {
      final letto = Invito.leggi(
        'gdahome|1|ABCD2345EFGH6789|wss://centralino.esempio.dev|'
        '192.168.1.50:8098,10.0.0.4:8098',
      );
      expect(letto.codice, 'ABCD2345EFGH6789');
      expect(
        letto.centralino,
        IndirizzoDelCentralino.leggi('wss://centralino.esempio.dev'),
      );
      expect(letto.indirizzi, [
        IndirizzoDelPonte.leggi('192.168.1.50:8098'),
        IndirizzoDelPonte.leggi('10.0.0.4:8098'),
      ]);
    });

    test('una casa senza centralino: si entra solo da dentro', () {
      final letto = Invito.leggi(
        'gdahome|1|ABCD2345EFGH6789||192.168.1.50:8098',
      );
      expect(letto.codice, 'ABCD2345EFGH6789');
      expect(letto.centralino, isNull);
      expect(letto.indirizzi, [IndirizzoDelPonte.leggi('192.168.1.50:8098')]);
    });

    test('una casa di cui non si sanno gli indirizzi', () {
      final letto = Invito.leggi(
        'gdahome|1|ABCD2345EFGH6789|wss://centralino.esempio.dev|',
      );
      expect(letto.codice, 'ABCD2345EFGH6789');
      expect(letto.centralino?.casa, 'centralino.esempio.dev');
      expect(letto.indirizzi, isEmpty);
    });

    test('il codice e basta', () {
      final letto = Invito.leggi('gdahome|1|ABCD2345EFGH6789||');
      expect(letto.codice, 'ABCD2345EFGH6789');
      expect(letto.centralino, isNull);
      expect(letto.indirizzi, isEmpty);
    });
  });

  test('perdona quello che ci mette in mezzo chi legge i quadretti', () {
    /* Un lettore di QR restituisce quello che trova, e ogni tanto ci lascia
     * attaccato un a capo. Non e' un motivo per dire di no a un codice buono. */
    final letto = Invito.leggi(
      '  gdahome|1|ABCD2345EFGH6789||192.168.1.50:8098 \n',
    );
    expect(letto.codice, 'ABCD2345EFGH6789');
    expect(letto.indirizzi, hasLength(1));

    expect(Invito.leggi('GDAHOME|1|ABCD||').codice, 'ABCD');
  });

  test('un campo in piu\' non rompe l\'app di oggi', () {
    /* E' il motivo per cui i campi stanno in coda e non in mezzo: quello che
     * arrivera' domani, un'app di oggi lo salta e va avanti. */
    final letto = Invito.leggi(
      'gdahome|1|ABCD||192.168.1.50:8098|qualcosa|che|verra\'|dopo',
    );
    expect(letto.codice, 'ABCD');
    expect(letto.indirizzi, hasLength(1));
  });

  test('un invito di domani si riconosce come tale, e lo si dice', () {
    /* La differenza che conta: «non ti capisco» manda a controllare il codice,
     * «sei vecchia» manda ad aggiornare l'app. */
    expect(
      () => Invito.leggi('gdahome|2|ABCD||'),
      throwsA(isA<InvitoTroppoNuovo>()),
    );
  });

  test('quello che non e\' un invito lo dice, invece di leggerlo a meta\'', () {
    for (final roba in [
      '',
      '   ',
      'ciao',
      'https://www.esempio.it/',
      'gdahome',
      'gdahome|1',
      'gdahome|1|',
      'gdahome|1||',
      'gdahome|x|ABCD||',
      'altracosa|1|ABCD||',
    ]) {
      expect(
        () => Invito.leggi(roba),
        throwsA(isA<InvitoIllegibile>()),
        reason: '«$roba» non e\' un invito',
      );
    }
  });

  test('un indirizzo storto si salta, e il resto dell\'invito vale', () {
    /* Una casa che dice una sciocchezza non deve far fallire l'abbinamento di
     * chi ha appena inquadrato: si tiene quello che c'e'. */
    final letto = Invito.leggi(
      'gdahome|1|ABCD|non un indirizzo|192.168.1.50:8098,,cosi\' no!,10.0.0.4:8098',
    );
    expect(letto.centralino, isNull);
    expect(letto.indirizzi, [
      IndirizzoDelPonte.leggi('192.168.1.50:8098'),
      IndirizzoDelPonte.leggi('10.0.0.4:8098'),
    ]);
  });
}
