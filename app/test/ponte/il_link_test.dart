/// Le prove del link che apre l'app: `gdahome://collega?invito=…`.
///
/// Il vettore e' **lo stesso** di `ponte/test/il-link-apre-gdahome.test.js`,
/// ricopiato identico: li' la console lo scrive, qui l'app lo rilegge. Non si
/// tocca da una parte sola.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/ponte/il_link.dart';
import 'package:gdahome/ponte/indirizzo.dart';

const _link =
    'gdahome://collega?invito=gdahome%7C1%7CABCD2345EFGH6789%7Cwss%3A%2F%2F'
    'centralino.esempio.dev%7C192.168.1.50%3A8098%2C10.0.0.4%3A8098';

void main() {
  test('quello che scrive la console, l\'app lo rilegge intero', () {
    final letto = leggiIlLink(Uri.parse(_link));
    expect(letto, isA<InvitoDalLink>());
    final invito = (letto! as InvitoDalLink).invito;
    expect(invito.codice, 'ABCD2345EFGH6789');
    expect(
      invito.centralino,
      IndirizzoDelCentralino.leggi('wss://centralino.esempio.dev'),
    );
    expect(invito.indirizzi, [
      IndirizzoDelPonte.leggi('192.168.1.50:8098'),
      IndirizzoDelPonte.leggi('10.0.0.4:8098'),
    ]);
  });

  test('lo schema e il nome non badano alle maiuscole', () {
    final letto = leggiIlLink(
      Uri.parse(
        'GdAHome://Collega?invito=gdahome%7C1%7CABCD2345EFGH6789%7C%7C',
      ),
    );
    expect((letto! as InvitoDalLink).invito.codice, 'ABCD2345EFGH6789');
  });

  test('un link che non e\' nostro non si guarda nemmeno', () {
    /* Nella versione web il «link» e' l'indirizzo della pagina. */
    expect(leggiIlLink(Uri.parse('https://casa.esempio.dev/')), isNull);
    expect(leggiIlLink(Uri.parse('altro://collega?invito=x')), isNull);
  });

  test('un link nostro ma storto si dice, e non abbina niente', () {
    for (final storto in [
      'gdahome://collega',
      'gdahome://collega?invito=',
      'gdahome://collega?invito=qualcosa%7Caltro',
      'gdahome://collega?invito=gdahome%7C1%7C%7C%7C',
      'gdahome://altro?invito=gdahome%7C1%7CABCD%7C%7C',
    ]) {
      expect(
        leggiIlLink(Uri.parse(storto)),
        isA<LinkIllegibile>(),
        reason: storto,
      );
    }
  });

  test('un invito di un ponte piu\' nuovo manda ad aggiornare', () {
    final letto = leggiIlLink(
      Uri.parse('gdahome://collega?invito=gdahome%7C9%7CABCD%7C%7C'),
    );
    expect((letto! as LinkIllegibile).spiegazione, contains('aggiorna'));
  });
}
