/// Le prove dell'indirizzo.
///
/// Sembrano prove su una funzione stupida, e invece sono prove su **la prima
/// schermata che vede un utente**: se qui si sbaglia, l'app non parte e la
/// colpa sembra del ponte.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/ponte/indirizzo.dart';

void main() {
  test('il solo nome della casa prende la porta dell\'add-on', () {
    final letto = IndirizzoDelPonte.leggi('192.168.1.50')!;
    expect(letto.casa, '192.168.1.50');
    expect(letto.porta, 8098);
    expect(letto.sicuro, isFalse);
    expect(letto.filo.toString(), 'ws://192.168.1.50:8098/casa');
    expect(
      letto.abbinamento.toString(),
      'http://192.168.1.50:8098/abbinamento',
    );
    expect(letto.salute.toString(), 'http://192.168.1.50:8098/salute');
  });

  test('i quattro modi in cui la gente lo scrive danno la stessa cosa', () {
    const atteso = IndirizzoDelPonte(casa: 'casa.esempio.it');
    for (final scritto in [
      'casa.esempio.it',
      'casa.esempio.it:8098',
      'http://casa.esempio.it',
      '  http://casa.esempio.it/  ',
      'ws://casa.esempio.it:8098/casa',
      'CASA.ESEMPIO.IT',
    ]) {
      expect(IndirizzoDelPonte.leggi(scritto), atteso, reason: scritto);
    }
  });

  test('con https la porta diventa la 443, non quella dell\'add-on', () {
    /* Chi scrive `https` sta passando da un proxy inverso o dall'accesso
     * remoto: dietro c'e' la 443, e la porta dell'add-on non c'entra piu'. */
    final letto = IndirizzoDelPonte.leggi('https://casa.esempio.it')!;
    expect(letto.porta, 443);
    expect(letto.sicuro, isTrue);
    expect(letto.filo.toString(), 'wss://casa.esempio.it:443/casa');
  });

  test('una porta scritta apposta vince sempre', () {
    expect(
      IndirizzoDelPonte.leggi('https://casa.esempio.it:8443')!.porta,
      8443,
    );
    expect(IndirizzoDelPonte.leggi('192.168.1.50:9000')!.porta, 9000);
  });

  test('quello che non è un indirizzo torna null invece di sollevare', () {
    for (final scritto in [
      '',
      '   ',
      ':8098',
      'casa esempio',
      'http://',
      'ftp://casa.esempio.it',
      '192.168.1.50:0',
      '192.168.1.50:99999',
      '192.168.1.50:ottomilanovantotto',
      'casa@esempio.it',
    ]) {
      expect(IndirizzoDelPonte.leggi(scritto), isNull, reason: '«$scritto»');
    }
  });

  test('rivisto dall\'utente, la porta solita non si scrive', () {
    expect(
      IndirizzoDelPonte.leggi('192.168.1.50').toString(),
      'http://192.168.1.50',
    );
    expect(
      IndirizzoDelPonte.leggi('192.168.1.50:9000').toString(),
      'http://192.168.1.50:9000',
    );
    expect(
      IndirizzoDelPonte.leggi('https://casa.esempio.it').toString(),
      'https://casa.esempio.it',
    );
  });
}
